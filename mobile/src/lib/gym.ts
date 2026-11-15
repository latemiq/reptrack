// Gym data types and helpers — mirrors the web app's lib/gym-stats.ts and lib/plans.ts,
// so both clients compute weeks, PRs and prescriptions the same way.

export interface StatSet {
  exercise_id: string
  exercise_name: string | null
  exercise_position: number
  set_number: number
  reps: number | null
  weight_kg: number | string | null
  rpe?: number | string | null
}

export interface StatWorkout {
  id: string
  name: string
  notes?: string | null
  started_at: string
  duration_seconds: number | null
  total_tonnage: number | string | null
  workout_sets: StatSet[]
}

export interface PlannedExercise {
  exerciseId: string
  name: string
  sets: number
  repsMin: number | null
  repsMax: number | null
  weightKg: number | null
  percent1rm: number | null
  rpe: number | null
  restSeconds: number | null
  notes: string
}

export interface TemplateExercise {
  exerciseId: string
  name: string
  targetSets: number
  targetReps: number
  targetRepsMax?: number | null
  targetWeight: number | null
  restSeconds: number
}

export interface WorkoutTemplate {
  id: string
  name: string
  exercises: TemplateExercise[]
  last_used_at: string | null
}

export interface PrEvent {
  workoutId: string
  exerciseId: string
  name: string
  weight: number
  reps: number
  previousWeight: number | null
  at: string
}

export interface GymOverview {
  week: { days: boolean[]; today: number; done: number; goal: number | null }
  tonnage: { thisWeek: number; lastWeek: number }
  recentPrs: PrEvent[]
  planToday: { planName: string; name: string; notes: string; exercises: PlannedExercise[] } | null
}

export const fmtKg = (kg: number) => (Number.isInteger(kg) ? String(kg) : kg.toFixed(1).replace('.', ','))
export const fmtTonnes = (kg: number) => `${(kg / 1000).toFixed(1).replace('.', ',')} t`

export function formatPrescription(e: PlannedExercise): string {
  const reps = e.repsMin != null && e.repsMax != null && e.repsMax !== e.repsMin ? `${e.repsMin}–${e.repsMax}` : String(e.repsMin ?? e.repsMax ?? '?')
  const parts = [`${e.sets}×${reps}`]
  if (e.weightKg != null) parts.push(`${fmtKg(e.weightKg)} kg`)
  else if (e.percent1rm != null) parts.push(`${e.percent1rm}% 1RM`)
  if (e.rpe != null) parts.push(`RPE ${String(e.rpe).replace('.', ',')}`)
  return parts.join(' · ')
}

export const e1rm = (w: number, r: number) => (!w || !r ? 0 : r === 1 ? w : w * (1 + r / 30))

export function mondayOf(d: Date) {
  const m = new Date(d)
  m.setHours(0, 0, 0, 0)
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7))
  return m
}

/** Personal records: an exercise's best e1RM in a workout beating every earlier one. */
export function findPrs(workouts: StatWorkout[]): Set<string> {
  const best = new Map<string, number>()
  const prs = new Set<string>()
  for (const w of [...workouts].sort((a, b) => a.started_at.localeCompare(b.started_at))) {
    const top = new Map<string, number>()
    for (const s of w.workout_sets ?? []) {
      const v = e1rm(Number(s.weight_kg ?? 0), s.reps ?? 0)
      if (v > (top.get(s.exercise_id) ?? 0)) top.set(s.exercise_id, v)
    }
    for (const [id, v] of Array.from(top)) {
      const prev = best.get(id)
      if (prev != null && v > prev + 0.01) prs.add(`${w.id}:${id}`)
      if (prev == null || v > prev) best.set(id, v)
    }
  }
  return prs
}

export function relativeDay(iso: string): string {
  const d = new Date(iso)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const that = new Date(d); that.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - that.getTime()) / 86400000)
  if (diff === 0) return 'dziś'
  if (diff === 1) return 'wczoraj'
  if (diff < 7) return `${diff} dni temu`
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })
}

export function timeAgo(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'teraz'
  if (min < 60) return `${min} min temu`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} godz. temu`
  return relativeDay(iso)
}

// Popular exercises with Polish names (same ids as the web app's popular list).
export const POPULAR: { id: string; name: string; muscle: string }[] = [
  { id: 'squat', name: 'Przysiad ze sztangą', muscle: 'Nogi' },
  { id: 'bench', name: 'Wyciskanie sztangi na ławce', muscle: 'Klatka' },
  { id: 'deadlift', name: 'Martwy ciąg', muscle: 'Plecy' },
  { id: 'rdl', name: 'Rumuński martwy ciąg', muscle: 'Nogi' },
  { id: 'ohp', name: 'OHP — wyciskanie żołnierskie', muscle: 'Barki' },
  { id: 'pullup', name: 'Podciąganie na drążku', muscle: 'Plecy' },
  { id: 'row', name: 'Wiosłowanie sztangą', muscle: 'Plecy' },
  { id: 'latpulldown', name: 'Ściąganie drążka wyciągu górnego', muscle: 'Plecy' },
  { id: 'incline', name: 'Wyciskanie hantli skos góra', muscle: 'Klatka' },
  { id: 'dips', name: 'Pompki na poręczach', muscle: 'Klatka' },
  { id: 'lateralraise', name: 'Wznosy hantli bokiem', muscle: 'Barki' },
  { id: 'curl', name: 'Uginanie ramion ze sztangą', muscle: 'Ramiona' },
  { id: 'pushdown', name: 'Prostowanie ramion na wyciągu', muscle: 'Ramiona' },
  { id: 'legpress', name: 'Wypychanie na suwnicy', muscle: 'Nogi' },
  { id: 'bulgarian', name: 'Przysiad bułgarski', muscle: 'Nogi' },
  { id: 'hipthrust', name: 'Hip thrust', muscle: 'Nogi' },
  { id: 'legcurl', name: 'Uginanie nóg leżąc', muscle: 'Nogi' },
  { id: 'calf', name: 'Wspięcia na palce', muscle: 'Nogi' },
  { id: 'plank', name: 'Deska (plank)', muscle: 'Brzuch' },
]
