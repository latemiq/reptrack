import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

interface IncomingSet {
  weightKg: number | null
  reps: number | null
  rpe: number | null
  done: boolean
  completedAt?: number
}

interface IncomingExercise {
  exerciseId: string
  sets: IncomingSet[]
}

interface IncomingWorkout {
  templateId?: string | null
  name: string
  notes?: string
  startedAt: number
  exercises: IncomingExercise[]
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workout = await req.json().catch(() => null) as IncomingWorkout | null

  if (!workout?.name || !Array.isArray(workout.exercises)) {
    return NextResponse.json({ error: 'Invalid workout' }, { status: 400 })
  }

  const finishedAt = Date.now()
  if (!Number.isFinite(workout.startedAt) || workout.startedAt > finishedAt) {
    return NextResponse.json({ error: 'Invalid workout start time' }, { status: 400 })
  }
  if (workout.exercises.some(ex => !ex.exerciseId || !Array.isArray(ex.sets))) {
    return NextResponse.json({ error: 'Invalid workout exercises' }, { status: 400 })
  }

  const durationSeconds = Math.floor((finishedAt - workout.startedAt) / 1000)

  const tonnage = workout.exercises.reduce((sum, ex) =>
    sum + ex.sets.reduce((s, set) => {
      if (!set.done || !set.weightKg || !set.reps) return s
      return s + set.weightKg * set.reps
    }, 0), 0)

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
    return NextResponse.json({ error: 'Insert workout failed', details: workoutErr }, { status: 500 })
  }

  const setsToInsert = workout.exercises.flatMap((ex, exPos) =>
    ex.sets
      .filter(s => s.done)
      .map((s, idx) => ({
        workout_id: workoutRow.id,
        exercise_id: ex.exerciseId,
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
      await supabase.from('workouts').delete().eq('id', workoutRow.id)
      return NextResponse.json({ error: 'Insert sets failed', details: setsErr }, { status: 500 })
    }
  }

  return NextResponse.json({ id: workoutRow.id, success: true })
}
