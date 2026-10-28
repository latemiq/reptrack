import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserId, unauthorized } from '@/lib/api-auth'
import { goalProgress, type GoalRow } from '@/lib/goal-progress'
import { best5kSeconds, dayKey, isoWeekNumber, startOfWeek } from '@/lib/stats'

export async function GET() {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const supabase = supabaseAdmin()
  const weekStart = startOfWeek()
  const prevWeekStart = new Date(weekStart.getTime() - 7 * 86400000)

  const [profileRes, runsRes, workoutsRes, weightsRes, goalsRes, setsRes] = await Promise.all([
    supabase.from('profiles').select('weekly_km_goal').eq('id', userId).maybeSingle(),
    supabase.from('runs').select('id, name, ran_at, distance_km, duration_seconds, avg_pace_seconds_per_km').eq('user_id', userId).order('ran_at', { ascending: false }).limit(200),
    supabase.from('workouts').select('id, name, started_at, duration_seconds, total_tonnage, workout_sets(exercise_position)').eq('user_id', userId).not('finished_at', 'is', null).order('started_at', { ascending: false }).limit(20),
    supabase.from('weight_logs').select('weight_kg, logged_at').eq('user_id', userId).order('logged_at', { ascending: false }).limit(14),
    supabase.from('goals').select('*').eq('user_id', userId).eq('status', 'active').order('created_at', { ascending: true }),
    supabase.from('workout_sets').select('exercise_name, exercise_id, weight_kg, workouts!inner(user_id)').eq('workouts.user_id', userId).not('weight_kg', 'is', null).order('weight_kg', { ascending: false }).limit(300),
  ])

  const failed = [profileRes, runsRes, workoutsRes, weightsRes, goalsRes, setsRes].find(r => r.error)
  if (failed) {
    console.error('Dashboard fetch error:', failed.error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const runs = runsRes.data ?? []
  const workouts = workoutsRes.data ?? []
  const goals = (goalsRes.data ?? []) as GoalRow[]

  // Week km + per-day activity strip
  const weekRuns = runs.filter(r => new Date(r.ran_at) >= weekStart)
  const prevWeekKm = runs
    .filter(r => new Date(r.ran_at) >= prevWeekStart && new Date(r.ran_at) < weekStart)
    .reduce((s, r) => s + Number(r.distance_km), 0)
  const weekKm = weekRuns.reduce((s, r) => s + Number(r.distance_km), 0)

  const runDays  = new Set(runs.map(r => dayKey(r.ran_at)))
  const liftDays = new Set(workouts.map(w => dayKey(w.started_at)))
  const todayKey = dayKey(new Date())
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart.getTime() + i * 86400000)
    const key = dayKey(d)
    return {
      date: key,
      today: key === todayKey,
      run:  runDays.has(key),
      lift: liftDays.has(key),
    }
  })

  // Weight
  const weights = (weightsRes.data ?? []).map(w => ({ kg: Number(w.weight_kg), at: w.logged_at })).reverse()
  const latestWeight = weights.at(-1)?.kg ?? null
  const bodyGoal = goals.find(g => g.category === 'body' && g.unit === 'kg') ?? null

  // Records: best 5k + heaviest set per exercise
  const lifts = new Map<string, number>()
  for (const s of setsRes.data ?? []) {
    const name = s.exercise_name ?? s.exercise_id
    const w = Number(s.weight_kg)
    if (!lifts.has(name) || w > lifts.get(name)!) lifts.set(name, w)
  }
  const topLifts = Array.from(lifts, ([name, kg]) => ({ name, kg }))
    .sort((a, b) => b.kg - a.kg)
    .slice(0, 3)

  // Activity feed
  const activities = [
    ...runs.slice(0, 6).map(r => ({
      id: r.id, type: 'run' as const, name: r.name, at: r.ran_at,
      value: Math.round(Number(r.distance_km) * 10) / 10, unit: 'km',
    })),
    ...workouts.slice(0, 6).map(w => ({
      id: w.id, type: 'lift' as const, name: w.name, at: w.started_at,
      value: new Set((w.workout_sets ?? []).map(s => s.exercise_position)).size, unit: 'ćw.',
    })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5)

  return NextResponse.json({
    weekNumber: isoWeekNumber(),
    week: {
      km: Math.round(weekKm * 10) / 10,
      goalKm: profileRes.data?.weekly_km_goal != null ? Number(profileRes.data.weekly_km_goal) : null,
      deltaPct: prevWeekKm > 0 ? Math.round(((weekKm - prevWeekKm) / prevWeekKm) * 100) : null,
      runs: weekRuns.length,
      workouts: workouts.filter(w => new Date(w.started_at) >= weekStart).length,
      days: weekDays,
    },
    weight: {
      latest: latestWeight,
      delta: weights.length >= 2 ? Math.round((weights.at(-1)!.kg - weights.at(-2)!.kg) * 10) / 10 : null,
      history: weights.slice(-7).map(w => w.kg),
      goal: bodyGoal ? { target: Number(bodyGoal.target_value), progress: goalProgress(bodyGoal) } : null,
    },
    records: {
      best5kSeconds: best5kSeconds(runs),
      lifts: topLifts,
    },
    activities,
    goals: goals.slice(0, 4).map(g => ({
      id: g.id,
      name: g.name,
      category: g.category,
      target: Number(g.target_value),
      unit: g.unit,
      progress: goalProgress(g),
    })),
  })
}
