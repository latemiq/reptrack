import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserId, unauthorized } from '@/lib/api-auth'
import type { StatWorkout } from '@/lib/gym-stats'

/**
 * Last performance of given exercises: GET ?ids=bench,squat →
 * { previous: { bench: [{ weightKg, reps }, …], … } } from the most recent workout containing each.
 */
export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const ids = new Set((new URL(req.url).searchParams.get('ids') ?? '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 40))
  if (ids.size === 0) return NextResponse.json({ previous: {} })

  const { data, error } = await supabaseAdmin()
    .from('workouts')
    .select('id, name, started_at, duration_seconds, total_tonnage, workout_sets(exercise_id, exercise_name, exercise_position, set_number, reps, weight_kg)')
    .eq('user_id', userId).not('finished_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(60)

  if (error) {
    console.error('Previous sets error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const previous: Record<string, { weightKg: number | null; reps: number | null }[]> = {}
  for (const w of (data ?? []) as unknown as StatWorkout[]) {
    for (const id of Array.from(ids)) {
      if (previous[id]) continue
      const sets = w.workout_sets.filter(s => s.exercise_id === id).sort((a, b) => a.set_number - b.set_number)
      if (sets.length) previous[id] = sets.map(s => ({ weightKg: s.weight_kg != null ? Number(s.weight_kg) : null, reps: s.reps }))
    }
    if (Object.keys(previous).length === ids.size) break
  }

  return NextResponse.json({ previous })
}
