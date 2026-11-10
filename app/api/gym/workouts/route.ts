import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserId, unauthorized } from '@/lib/api-auth'

interface IncomingSet {
  weightKg: number | null
  reps: number | null
  rpe: number | null
  done: boolean
  completedAt?: number
}

interface IncomingExercise {
  exerciseId: string
  name?: string
  sets: IncomingSet[]
}

interface IncomingWorkout {
  templateId?: string | null
  name: string
  notes?: string
  startedAt: number
  exercises: IncomingExercise[]
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const { searchParams } = new URL(req.url)
  const requestedLimit = Number(searchParams.get('limit') ?? '30')
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100) : 30

  const { data, error } = await supabaseAdmin()
    .from('workouts')
    .select('id, template_id, name, notes, started_at, finished_at, duration_seconds, total_tonnage, workout_sets(exercise_id, exercise_name, exercise_position, set_number, reps, weight_kg, rpe)')
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Workouts fetch error:', error)
    return NextResponse.json({ error: 'Błąd bazy danych. Spróbuj ponownie.' }, { status: 500 })
  }

  return NextResponse.json({ workouts: data ?? [] })
}

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const workout = await req.json().catch(() => null) as IncomingWorkout | null

  if (!workout?.name || !Array.isArray(workout.exercises)) {
    return NextResponse.json({ error: 'Nieprawidłowe dane treningu' }, { status: 400 })
  }

  const finishedAt = Date.now()
  if (!Number.isFinite(workout.startedAt) || workout.startedAt > finishedAt) {
    return NextResponse.json({ error: 'Nieprawidłowy czas rozpoczęcia treningu' }, { status: 400 })
  }
  if (workout.exercises.some(ex => !ex.exerciseId || !Array.isArray(ex.sets))) {
    return NextResponse.json({ error: 'Nieprawidłowa lista ćwiczeń' }, { status: 400 })
  }

  const durationSeconds = Math.floor((finishedAt - workout.startedAt) / 1000)

  const tonnage = workout.exercises.reduce((sum, ex) =>
    sum + ex.sets.reduce((s, set) => {
      if (!set.done || !set.weightKg || !set.reps) return s
      return s + set.weightKg * set.reps
    }, 0), 0)

  const supabase = supabaseAdmin()
  const { data: workoutRow, error: workoutErr } = await supabase
    .from('workouts')
    .insert({
      user_id: userId,
      template_id: workout.templateId,
      name: workout.name,
      notes: workout.notes,
      started_at: new Date(workout.startedAt).toISOString(),
      finished_at: new Date(finishedAt).toISOString(),
      duration_seconds: durationSeconds,
      total_tonnage: tonnage,
    })
    .select('id')
    .single()

  if (workoutErr || !workoutRow) {
    console.error('Insert workout error:', workoutErr)
    return NextResponse.json({ error: 'Zapis treningu nie powiódł się' }, { status: 500 })
  }

  const setsToInsert = workout.exercises.flatMap((ex, exPos) =>
    ex.sets
      .filter(s => s.done)
      .map((s, idx) => ({
        workout_id: workoutRow.id,
        exercise_id: ex.exerciseId,
        exercise_name: typeof ex.name === 'string' ? ex.name : null,
        exercise_position: exPos,
        set_number: idx + 1,
        weight_kg: s.weightKg,
        reps: s.reps,
        rpe: s.rpe,
        completed_at: s.completedAt ? new Date(s.completedAt).toISOString() : null,
      }))
  )

  if (setsToInsert.length > 0) {
    const { error: setsErr } = await supabase.from('workout_sets').insert(setsToInsert)
    if (setsErr) {
      console.error('Insert sets error:', setsErr)
      await supabase.from('workouts').delete().eq('id', workoutRow.id)
      return NextResponse.json({ error: 'Zapis serii nie powiódł się' }, { status: 500 })
    }
  }

  if (workout.templateId && UUID_RE.test(workout.templateId)) {
    await supabase
      .from('workout_templates')
      .update({ last_used_at: new Date(finishedAt).toISOString() })
      .eq('id', workout.templateId)
      .eq('user_id', userId)
  }

  return NextResponse.json({ id: workoutRow.id, success: true })
}
