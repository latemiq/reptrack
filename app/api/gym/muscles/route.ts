import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserId, unauthorized } from '@/lib/api-auth'
import { mondayOf } from '@/lib/gym-stats'
import { SECONDARY_SET_WEIGHT, exerciseMuscles, type MuscleGroup } from '@/lib/exercises/muscles'

const DAY = 86400000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface MuscleWeek {
  sets: number
  exercises: { name: string; sets: number; primary: boolean }[]
}

/**
 * Sets per muscle group in the current week (Monday–Sunday) for the 3D muscle map.
 * `?week=-1` gives last week. A set counts fully for its main muscles and half for helping ones.
 */
export async function GET(req: Request) {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const offset = Math.min(0, Math.max(-52, Math.trunc(Number(new URL(req.url).searchParams.get('week') ?? 0)) || 0))
  const from = new Date(mondayOf(new Date()).getTime() + offset * 7 * DAY)
  const to = new Date(from.getTime() + 7 * DAY)

  const supabase = supabaseAdmin()
  const { data: workouts, error } = await supabase.from('workouts')
    .select('id, workout_sets(exercise_id, exercise_name)')
    .eq('user_id', userId).not('finished_at', 'is', null)
    .gte('started_at', from.toISOString()).lt('started_at', to.toISOString())

  if (error) {
    console.error('Muscle map error:', error)
    return NextResponse.json({ error: 'Błąd bazy danych. Spróbuj ponownie.' }, { status: 500 })
  }

  // Sets per exercise this week.
  const perExercise = new Map<string, { name: string; sets: number }>()
  for (const w of workouts ?? []) {
    for (const s of (w.workout_sets ?? []) as { exercise_id: string; exercise_name: string | null }[]) {
      const cur = perExercise.get(s.exercise_id) ?? { name: s.exercise_name ?? s.exercise_id, sets: 0 }
      cur.sets++
      perExercise.set(s.exercise_id, cur)
    }
  }

  const dbIds = Array.from(perExercise.keys()).filter(id => UUID.test(id))
  const fromDb = new Map<string, { primary_muscles: string[] | null; secondary_muscles: string[] | null }>()
  if (dbIds.length) {
    const { data } = await supabase.from('exercises').select('id, primary_muscles, secondary_muscles').in('id', dbIds)
    for (const e of data ?? []) fromDb.set(e.id, e)
  }

  const groups: Partial<Record<MuscleGroup, MuscleWeek>> = {}
  const add = (g: MuscleGroup, name: string, sets: number, primary: boolean) => {
    const cur = groups[g] ?? (groups[g] = { sets: 0, exercises: [] })
    cur.sets += primary ? sets : sets * SECONDARY_SET_WEIGHT
    cur.exercises.push({ name, sets, primary })
  }
  const unknown: string[] = []
  for (const [id, { name, sets }] of Array.from(perExercise)) {
    const m = exerciseMuscles(id, name, fromDb.get(id))
    if (!m.primary.length) unknown.push(name)
    m.primary.forEach(g => add(g, name, sets, true))
    m.secondary.forEach(g => add(g, name, sets, false))
  }
  for (const g of Object.values(groups)) {
    g.sets = Math.round(g.sets * 2) / 2
    g.exercises.sort((a, b) => Number(b.primary) - Number(a.primary) || b.sets - a.sets)
  }

  return NextResponse.json({
    weekStart: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`,
    workouts: workouts?.length ?? 0,
    totalSets: Array.from(perExercise.values()).reduce((s, e) => s + e.sets, 0),
    groups,
    unknown,
  })
}
