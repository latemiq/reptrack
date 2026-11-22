import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserId, unauthorized } from '@/lib/api-auth'
import { appDate, appMonday, appWeekday } from '@/lib/app-time'
import { findPrs, type StatWorkout } from '@/lib/gym-stats'
import { MACRO_TREE_SELECT, currentWeekIndex, macroFromRow, type MacroDbRow, type PlannedExercise } from '@/lib/plans'

const DAY = 86400000

/** Gym home: this week's training days vs goal, weekly tonnage, recent PRs and today's session from the trainer's plan. */
export async function GET() {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const supabase = supabaseAdmin()
  const now = new Date()
  const monday = appMonday(now)
  const since = new Date(monday.getTime() - 12 * 7 * DAY) // enough history to judge PRs

  const [{ data: workouts, error }, { data: profile }, { data: plans }] = await Promise.all([
    supabase.from('workouts')
      .select('id, name, started_at, duration_seconds, total_tonnage, workout_sets(exercise_id, exercise_name, exercise_position, set_number, reps, weight_kg)')
      .eq('user_id', userId).not('finished_at', 'is', null).gte('started_at', since.toISOString())
      .order('started_at', { ascending: false }),
    supabase.from('profiles').select('weekly_days').eq('id', userId).maybeSingle(),
    supabase.from('macrocycles').select(MACRO_TREE_SELECT).eq('client_id', userId).lte('start_date', appDate(now)),
  ])

  if (error) {
    console.error('Gym overview error:', error)
    return NextResponse.json({ error: 'Błąd bazy danych. Spróbuj ponownie.' }, { status: 500 })
  }

  const list = (workouts ?? []) as unknown as StatWorkout[]
  const lastMonday = appMonday(now, -1)
  const inRange = (w: StatWorkout, from: Date, to: Date) => {
    const t = new Date(w.started_at).getTime()
    return t >= from.getTime() && t < to.getTime()
  }
  const thisWeek = list.filter(w => inRange(w, monday, appMonday(now, 1)))
  const prevWeek = list.filter(w => inRange(w, lastMonday, monday))
  const tonnage = (ws: StatWorkout[]) => Math.round(ws.reduce((s, w) => s + Number(w.total_tonnage ?? 0), 0))

  const days = Array.from({ length: 7 }, () => false)
  for (const w of thisWeek) days[appWeekday(new Date(w.started_at))] = true

  // Today's session from an active trainer plan (1 = Monday in the plan model).
  let planToday: { planName: string; name: string; notes: string; exercises: PlannedExercise[] } | null = null
  for (const row of (plans ?? []) as unknown as MacroDbRow[]) {
    const plan = macroFromRow(row)
    const idx = currentWeekIndex(plan.startDate, now.getTime())
    const week = plan.mesocycles.flatMap(m => m.microcycles)[idx]
    const session = week?.sessions.find(s => s.dayOfWeek === appWeekday(now) + 1)
    if (session) { planToday = { planName: plan.name, name: session.name, notes: session.notes, exercises: session.exercises }; break }
  }

  const recentPrs = findPrs(list)
    .filter(p => new Date(p.at).getTime() >= now.getTime() - 30 * DAY)
    .reverse()
    .slice(0, 3)

  return NextResponse.json({
    week: { days, today: appWeekday(now), done: thisWeek.length, goal: profile?.weekly_days ?? null },
    tonnage: { thisWeek: tonnage(thisWeek), lastWeek: tonnage(prevWeek) },
    recentPrs,
    planToday,
    lastWorkout: list[0] ? { name: list[0].name, startedAt: list[0].started_at } : null,
  })
}
