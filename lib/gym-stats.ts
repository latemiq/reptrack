// Strength stats shared by the gym screens and their API routes.

export interface StatSet {
  exercise_id: string
  exercise_name: string | null
  exercise_position: number
  set_number: number
  reps: number | null
  weight_kg: number | string | null
}

export interface StatWorkout {
  id: string
  name: string
  started_at: string
  duration_seconds: number | null
  total_tonnage: number | string | null
  workout_sets: StatSet[]
}

/** Estimated one-rep max (Epley). Single reps count as-is. */
export function e1rm(weight: number, reps: number): number {
  if (!weight || !reps) return 0
  return reps === 1 ? weight : weight * (1 + reps / 30)
}

/** Monday 00:00 (local time) of the week containing `d`. */
export function mondayOf(d: Date): Date {
  const m = new Date(d)
  m.setHours(0, 0, 0, 0)
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7))
  return m
}

/** 0 = Monday … 6 = Sunday. */
export const weekdayIndex = (d: Date) => (d.getDay() + 6) % 7

export interface ExerciseBest {
  weight: number
  reps: number
  e1rm: number
}

/** Best set (by e1RM) of each exercise within one workout. */
export function bestPerExercise(w: StatWorkout): Map<string, ExerciseBest & { name: string }> {
  const out = new Map<string, ExerciseBest & { name: string }>()
  for (const s of w.workout_sets ?? []) {
    const weight = Number(s.weight_kg ?? 0)
    const reps = s.reps ?? 0
    const est = e1rm(weight, reps)
    if (!est) continue
    const prev = out.get(s.exercise_id)
    if (!prev || est > prev.e1rm) out.set(s.exercise_id, { weight, reps, e1rm: est, name: s.exercise_name ?? s.exercise_id })
  }
  return out
}

export interface PrEvent {
  workoutId: string
  exerciseId: string
  name: string
  weight: number
  reps: number
  /** Previous best weight for the same exercise (null for the first time it was done). */
  previousWeight: number | null
  at: string
}

/**
 * Personal records: a workout sets a PR for an exercise when its best e1RM beats
 * every earlier workout. The first time an exercise is done doesn't count.
 */
export function findPrs(workouts: StatWorkout[]): PrEvent[] {
  const chronological = [...workouts].sort((a, b) => a.started_at.localeCompare(b.started_at))
  const best = new Map<string, ExerciseBest>()
  const prs: PrEvent[] = []
  for (const w of chronological) {
    for (const [id, cur] of Array.from(bestPerExercise(w))) {
      const prev = best.get(id)
      if (prev && cur.e1rm > prev.e1rm + 0.01) {
        prs.push({ workoutId: w.id, exerciseId: id, name: cur.name, weight: cur.weight, reps: cur.reps, previousWeight: prev.weight, at: w.started_at })
      }
      if (!prev || cur.e1rm > prev.e1rm) best.set(id, cur)
    }
  }
  return prs
}

/** Short "a × b" summary of an exercise's sets in one workout, e.g. "3 × 140 kg" or "4 × 8". */
export function setsSummary(sets: StatSet[]): string {
  if (!sets.length) return ''
  const top = Math.max(...sets.map(s => Number(s.weight_kg ?? 0)))
  if (top > 0) return `${sets.length} × ${Number.isInteger(top) ? top : top.toFixed(1).replace('.', ',')} kg`
  const reps = Math.max(...sets.map(s => s.reps ?? 0))
  return `${sets.length} × ${reps || '?'}`
}

export const fmtKg = (kg: number) => (Number.isInteger(kg) ? String(kg) : kg.toFixed(1).replace('.', ','))
export const fmtTonnes = (kg: number) => `${(kg / 1000).toFixed(1).replace('.', ',')} t`
