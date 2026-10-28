// Periodization model shared by the trainer plan editor and /api/trainer/plans.
// Tree: Macrocycle → Mesocycle (block) → Microcycle (week) → PlannedSession → PlannedExercise.

export type Focus = 'hypertrophy' | 'strength' | 'power' | 'endurance' | 'deload' | 'other'

export const FOCUS_OPTIONS: { key: Focus; label: string; color: string }[] = [
  { key: 'hypertrophy', label: 'Hipertrofia',    color: '#c8f53a' },
  { key: 'strength',    label: 'Siła',           color: '#f5a03a' },
  { key: 'power',       label: 'Moc',            color: '#f55a3a' },
  { key: 'endurance',   label: 'Wytrzymałość',   color: '#3ac8f5' },
  { key: 'deload',      label: 'Deload',         color: '#7ef5b0' },
  { key: 'other',       label: 'Inny',           color: '#888888' },
]

export const focusMeta = (focus: Focus | null) => FOCUS_OPTIONS.find(f => f.key === focus) ?? FOCUS_OPTIONS[5]

export const DAY_LABELS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd']

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

export interface PlannedSession {
  id: string
  dayOfWeek: number // 1 = Monday … 7 = Sunday
  name: string
  notes: string
  exercises: PlannedExercise[]
}

export interface Microcycle {
  id: string
  notes: string
  sessions: PlannedSession[]
}

export interface Mesocycle {
  id: string
  name: string
  focus: Focus | null
  notes: string
  microcycles: Microcycle[]
}

export interface Macrocycle {
  id: string
  clientId: string
  name: string
  goal: string
  startDate: string // YYYY-MM-DD
  notes: string
  mesocycles: Mesocycle[]
}

export interface MacrocycleSummary {
  id: string
  name: string
  goal: string | null
  startDate: string
  weeks: number
  mesocycles: { name: string; focus: Focus | null; weeks: number }[]
  updatedAt: string | null
}

export interface MacroSummaryRow {
  id: string
  client_id: string
  name: string
  goal: string | null
  start_date: string
  updated_at: string | null
  mesocycles: { position: number; name: string; focus: Focus | null; microcycles: { id: string }[] }[]
}

export const MACRO_SUMMARY_SELECT = 'id, client_id, name, goal, start_date, updated_at, mesocycles(position, name, focus, microcycles(id))'

export function toMacroSummary(r: MacroSummaryRow): MacrocycleSummary {
  const mesocycles = [...r.mesocycles]
    .sort((a, b) => a.position - b.position)
    .map(m => ({ name: m.name, focus: m.focus, weeks: m.microcycles.length }))
  return {
    id: r.id,
    name: r.name,
    goal: r.goal,
    startDate: r.start_date,
    weeks: mesocycles.reduce((s, m) => s + m.weeks, 0),
    mesocycles,
    updatedAt: r.updated_at,
  }
}

/** 0-based index of the current week within a plan (may be <0 or ≥ weeks). */
export function currentWeekIndex(startDate: string, now = Date.now()): number {
  return Math.floor((now - weekStart(startDate, 0).getTime()) / (7 * 86400000))
}

export const newId = () => crypto.randomUUID()

export const emptyWeek = (): Microcycle => ({ id: newId(), notes: '', sessions: [] })

export const emptyMesocycle = (name: string, weeks = 4, focus: Focus | null = 'hypertrophy'): Mesocycle => ({
  id: newId(), name, focus, notes: '', microcycles: Array.from({ length: weeks }, emptyWeek),
})

/** Deep copy with fresh IDs — used for "duplicate week/session/block". */
export function cloneSession(s: PlannedSession): PlannedSession {
  return { ...s, id: newId(), exercises: s.exercises.map(e => ({ ...e })) }
}
export function cloneWeek(w: Microcycle): Microcycle {
  return { id: newId(), notes: w.notes, sessions: w.sessions.map(cloneSession) }
}
export function cloneMesocycle(m: Mesocycle): Mesocycle {
  return { ...m, id: newId(), name: `${m.name} (kopia)`, microcycles: m.microcycles.map(cloneWeek) }
}

/** Next Monday (or today if Monday) as YYYY-MM-DD. */
export function nextMonday(from = new Date()): string {
  const d = new Date(from)
  d.setHours(12, 0, 0, 0)
  const add = (8 - d.getDay()) % 7
  d.setDate(d.getDate() + add)
  return toISODate(d)
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Start date of the given 0-based global week index. */
export function weekStart(startDate: string, weekIndex: number): Date {
  const d = new Date(`${startDate}T12:00:00`)
  d.setDate(d.getDate() + weekIndex * 7)
  return d
}

export function formatReps(e: Pick<PlannedExercise, 'repsMin' | 'repsMax'>): string {
  if (e.repsMin != null && e.repsMax != null && e.repsMax !== e.repsMin) return `${e.repsMin}–${e.repsMax}`
  return String(e.repsMin ?? e.repsMax ?? '?')
}

/** One-line prescription, e.g. "4×6–8 · 80 kg · @8". */
export function formatPrescription(e: PlannedExercise): string {
  const parts = [`${e.sets}×${formatReps(e)}`]
  if (e.weightKg != null) parts.push(`${e.weightKg} kg`)
  else if (e.percent1rm != null) parts.push(`${e.percent1rm}% 1RM`)
  if (e.rpe != null) parts.push(`@${e.rpe}`)
  return parts.join(' · ')
}

// ─── Server-side validation ────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const FOCUS_KEYS = new Set<string>(FOCUS_OPTIONS.map(f => f.key))

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const optNum = (v: unknown, min: number, max: number): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : null
}
const optInt = (v: unknown, min: number, max: number) => {
  const n = optNum(v, min, max)
  return n == null ? null : Math.round(n)
}
const arr = (v: unknown): unknown[] | null => (Array.isArray(v) ? v : null)
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' ? v as Record<string, unknown> : null)

// Guards against accidental huge payloads, not a product limit.
const LIMITS = { mesocycles: 24, weeksTotal: 104, sessionsPerWeek: 21, exercisesPerSession: 40 }

/** Validates an incoming plan tree. Returns a normalized copy or an error message. */
export function sanitizeMacrocycle(input: unknown): { plan: Omit<Macrocycle, 'id' | 'clientId'> } | { error: string } {
  const p = obj(input)
  if (!p) return { error: 'Nieprawidłowy plan' }
  const name = str(p.name, 120)
  if (!name) return { error: 'Podaj nazwę makrocyklu' }
  if (typeof p.startDate !== 'string' || !DATE_RE.test(p.startDate) || isNaN(Date.parse(p.startDate))) {
    return { error: 'Nieprawidłowa data startu' }
  }

  const mesos = arr(p.mesocycles)
  if (!mesos || mesos.length > LIMITS.mesocycles) return { error: 'Nieprawidłowe mezocykle' }

  const ids = new Set<string>()
  const takeId = (v: unknown) => {
    if (typeof v !== 'string' || !UUID_RE.test(v) || ids.has(v)) return null
    ids.add(v)
    return v
  }

  let weeksTotal = 0
  const mesocycles: Mesocycle[] = []
  for (const rawM of mesos) {
    const m = obj(rawM)
    const mId = takeId(m?.id)
    const weeks = arr(m?.microcycles)
    if (!m || !mId || !weeks) return { error: 'Nieprawidłowy mezocykl' }
    weeksTotal += weeks.length
    if (weeksTotal > LIMITS.weeksTotal) return { error: `Maksymalnie ${LIMITS.weeksTotal} tygodni` }

    const microcycles: Microcycle[] = []
    for (const rawW of weeks) {
      const w = obj(rawW)
      const wId = takeId(w?.id)
      const sessions = arr(w?.sessions)
      if (!w || !wId || !sessions || sessions.length > LIMITS.sessionsPerWeek) return { error: 'Nieprawidłowy tydzień' }

      const outSessions: PlannedSession[] = []
      for (const rawS of sessions) {
        const s = obj(rawS)
        const sId = takeId(s?.id)
        const day = optInt(s?.dayOfWeek, 1, 7)
        const exercises = arr(s?.exercises)
        if (!s || !sId || day == null || !exercises || exercises.length > LIMITS.exercisesPerSession) {
          return { error: 'Nieprawidłowa sesja' }
        }
        const outEx: PlannedExercise[] = []
        for (const rawE of exercises) {
          const e = obj(rawE)
          const exerciseId = str(e?.exerciseId, 200)
          const exName = str(e?.name, 200)
          if (!e || !exerciseId || !exName) return { error: 'Nieprawidłowe ćwiczenie' }
          let repsMin = optInt(e.repsMin, 1, 100)
          let repsMax = optInt(e.repsMax, 1, 100)
          if (repsMin != null && repsMax != null && repsMin > repsMax) [repsMin, repsMax] = [repsMax, repsMin]
          outEx.push({
            exerciseId,
            name: exName,
            sets: optInt(e.sets, 1, 20) ?? 3,
            repsMin,
            repsMax,
            weightKg: optNum(e.weightKg, 0, 1000),
            percent1rm: optNum(e.percent1rm, 1, 120),
            rpe: optNum(e.rpe, 1, 10),
            restSeconds: optInt(e.restSeconds, 0, 1800),
            notes: str(e.notes, 500),
          })
        }
        outSessions.push({ id: sId, dayOfWeek: day, name: str(s.name, 120) || 'Trening', notes: str(s.notes, 1000), exercises: outEx })
      }
      microcycles.push({ id: wId, notes: str(w.notes, 1000), sessions: outSessions })
    }

    const focus = typeof m.focus === 'string' && FOCUS_KEYS.has(m.focus) ? m.focus as Focus : null
    mesocycles.push({ id: mId, name: str(m.name, 120) || 'Blok', focus, notes: str(m.notes, 1000), microcycles })
  }

  return {
    plan: { name, goal: str(p.goal, 300), startDate: p.startDate, notes: str(p.notes, 2000), mesocycles },
  }
}

export const isUuid = (v: string) => UUID_RE.test(v)

// ─── DB row → tree ─────────────────────────────────────────────────────────

interface ExerciseDbRow {
  position: number; exercise_id: string; exercise_name: string; sets: number
  reps_min: number | null; reps_max: number | null; weight_kg: number | string | null
  percent_1rm: number | string | null; rpe: number | string | null; rest_seconds: number | null; notes: string | null
}
interface SessionDbRow { id: string; position: number; day_of_week: number; name: string; notes: string | null; planned_exercises: ExerciseDbRow[] }
interface MicroDbRow { id: string; position: number; notes: string | null; planned_sessions: SessionDbRow[] }
interface MesoDbRow { id: string; position: number; name: string; focus: Focus | null; notes: string | null; microcycles: MicroDbRow[] }
export interface MacroDbRow {
  id: string; client_id: string; name: string; goal: string | null; start_date: string; notes: string | null
  mesocycles: MesoDbRow[]
}

const byPos = <T extends { position: number }>(a: T[] | null | undefined) => [...(a ?? [])].sort((x, y) => x.position - y.position)
const numOrNull = (v: number | string | null) => (v == null ? null : Number(v))

export const MACRO_TREE_SELECT =
  'id, client_id, name, goal, start_date, notes, mesocycles(id, position, name, focus, notes, microcycles(id, position, notes, planned_sessions(id, position, day_of_week, name, notes, planned_exercises(position, exercise_id, exercise_name, sets, reps_min, reps_max, weight_kg, percent_1rm, rpe, rest_seconds, notes))))'

export function macroFromRow(r: MacroDbRow): Macrocycle {
  return {
    id: r.id,
    clientId: r.client_id,
    name: r.name,
    goal: r.goal ?? '',
    startDate: r.start_date,
    notes: r.notes ?? '',
    mesocycles: byPos(r.mesocycles).map(m => ({
      id: m.id,
      name: m.name,
      focus: m.focus,
      notes: m.notes ?? '',
      microcycles: byPos(m.microcycles).map(w => ({
        id: w.id,
        notes: w.notes ?? '',
        sessions: byPos(w.planned_sessions)
          .sort((a, b) => a.day_of_week - b.day_of_week || a.position - b.position)
          .map(s => ({
            id: s.id,
            dayOfWeek: s.day_of_week,
            name: s.name,
            notes: s.notes ?? '',
            exercises: byPos(s.planned_exercises).map(e => ({
              exerciseId: e.exercise_id,
              name: e.exercise_name,
              sets: e.sets,
              repsMin: e.reps_min,
              repsMax: e.reps_max,
              weightKg: numOrNull(e.weight_kg),
              percent1rm: numOrNull(e.percent_1rm),
              rpe: numOrNull(e.rpe),
              restSeconds: e.rest_seconds,
              notes: e.notes ?? '',
            })),
          })),
      })),
    })),
  }
}
