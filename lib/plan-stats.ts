// Periodization statistics: what the trainer planned vs. what the client did, per macro-, meso- and microcycle.
// Runs in the browser on purpose: days and weeks follow local time, the server (Vercel) runs in UTC.

import { e1rm, weekdayIndex, type StatSet, type StatWorkout } from '@/lib/gym-stats'
import type { Focus, Macrocycle, PlannedExercise, PlannedSession } from '@/lib/plans'

const DAY = 86400000
/** How far back a set still counts towards the client's current estimated 1RM. */
export const REFERENCE_DAYS = 84
/** The Epley estimate is unreliable for longer sets. */
const MAX_REPS_FOR_1RM = 12

export type Period = 'preparatory' | 'transition' | 'recovery' | 'unknown'

export const PERIOD_LABEL: Record<Period, string> = {
  preparatory: 'Przygotowawczy',
  transition: 'Przejściowy',
  recovery: 'Odciążenie',
  unknown: 'Nieokreślony',
}

type Range = [number, number]
interface PhaseGuide {
  period: Period
  intensity?: Range
  sets?: Range
  reps?: Range
}

/** Classical periodization ranges from NSCA Essentials of Strength Training and Conditioning, ch. 21. */
export const PHASE_GUIDE: Record<Focus, PhaseGuide> = {
  hypertrophy: { period: 'preparatory', intensity: [50, 75], sets: [3, 6], reps: [8, 20] },
  endurance: { period: 'preparatory', intensity: [50, 75], sets: [3, 6], reps: [8, 20] },
  strength: { period: 'preparatory', intensity: [80, 95], sets: [2, 6], reps: [2, 6] },
  power: { period: 'transition', intensity: [30, 95], sets: [2, 5], reps: [2, 5] },
  deload: { period: 'recovery' },
  other: { period: 'unknown' },
}

export interface Load {
  sets: number
  reps: number
  tonnage: number
  /** Rep-weighted mean % of 1RM; null when no set has a known load. */
  intensity: number | null
  repsPerSet: number | null
  setsPerExercise: number | null
}

export interface ExerciseRow {
  id: string
  name: string
  planned: PlannedExercise | null
  done: StatSet[]
}

export type SessionStatus = 'done' | 'missed' | 'today' | 'upcoming'

export interface SessionStat {
  session: PlannedSession
  date: Date
  status: SessionStatus
  workout: StatWorkout | null
  exercises: ExerciseRow[]
}

export interface WeekStat {
  index: number
  block: number
  start: Date
  end: Date
  state: 'past' | 'current' | 'future'
  planned: Load
  /** null = the week hasn't started yet. */
  done: Load | null
  sessions: SessionStat[]
  /** Workouts of that week that match no planned session. */
  extra: StatWorkout[]
  /** Highest estimated 1RM per exercise in that week. */
  best: Map<string, number>
}

export interface Progress {
  /** Sessions whose day has passed, plus the ones already done. */
  due: number
  done: number
  plannedSets: number
  doneSets: number
}

export interface BlockStat {
  id: string
  index: number
  name: string
  focus: Focus | null
  guide: PhaseGuide
  weeks: WeekStat[]
  planned: Load
  done: Load
  progress: Progress
  /** Change of estimated 1RM between the first and the last week the exercise was done in this block. */
  gains: { id: string; name: string; from: number; to: number; percent: number }[]
}

export interface PlanStats {
  weeks: WeekStat[]
  blocks: BlockStat[]
  progress: Progress
  /** 0-based; below 0 before the start, >= weeks.length after the end. */
  currentWeek: number
  lifts: { id: string; name: string }[]
}

interface Entry {
  exercise: string
  sets: number
  reps: number | null
  kg: number | null
  percent: number | null
}

function summarize(entries: Entry[]): Load {
  let sets = 0, reps = 0, tonnage = 0, setsWithReps = 0, weighted = 0, intensityReps = 0
  const exercises = new Set<string>()
  for (const e of entries) {
    sets += e.sets
    exercises.add(e.exercise)
    if (!e.reps) continue
    const total = e.sets * e.reps
    reps += total
    setsWithReps += e.sets
    if (e.kg) tonnage += total * e.kg
    if (e.percent) {
      weighted += total * e.percent
      intensityReps += total
    }
  }
  return {
    sets,
    reps,
    tonnage,
    intensity: intensityReps ? weighted / intensityReps : null,
    repsPerSet: setsWithReps ? reps / setsWithReps : null,
    setsPerExercise: exercises.size ? sets / exercises.size : null,
  }
}

/** Midnight, local time. */
const dayOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
// Rounded, because a day is 23 or 25 hours long when the clocks change.
const daysBetween = (from: Date, to: Date) => Math.round((dayOf(to).getTime() - dayOf(from).getTime()) / DAY)
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
const midReps = (e: PlannedExercise) => {
  const min = e.repsMin ?? e.repsMax
  const max = e.repsMax ?? e.repsMin
  return min != null && max != null ? (min + max) / 2 : null
}

function matchWorkouts(sessions: { session: PlannedSession; date: Date }[], workouts: StatWorkout[]) {
  const free = new Set(workouts)
  const matched = new Map<string, StatWorkout>()
  const distance = (w: StatWorkout, date: Date) => Math.abs(daysBetween(date, new Date(w.started_at)))
  const claim = (fits: (w: StatWorkout, s: { session: PlannedSession; date: Date }) => boolean) => {
    for (const s of sessions) {
      if (matched.has(s.session.id)) continue
      const found = Array.from(free).filter(w => fits(w, s)).sort((a, b) => distance(a, s.date) - distance(b, s.date))[0]
      if (!found) continue
      free.delete(found)
      matched.set(s.session.id, found)
    }
  }
  // Exact day first, so two sessions with one name don't swap; then a moved session; then a renamed one.
  claim((w, s) => sameName(w.name, s.session.name) && distance(w, s.date) === 0)
  claim((w, s) => sameName(w.name, s.session.name))
  claim((w, s) => distance(w, s.date) === 0)
  return { matched, extra: Array.from(free) }
}

function exerciseRows(session: PlannedSession, workout: StatWorkout | null): ExerciseRow[] {
  const left = new Map<string, StatSet[]>()
  for (const s of workout?.workout_sets ?? []) left.set(s.exercise_id, [...(left.get(s.exercise_id) ?? []), s])

  const rows: ExerciseRow[] = session.exercises.map((planned, i) => {
    const all = (left.get(planned.exerciseId) ?? []).sort((a, b) => a.exercise_position - b.exercise_position || a.set_number - b.set_number)
    // The same exercise planned twice: the first row takes its planned sets, the last one the rest.
    const repeated = session.exercises.slice(i + 1).some(e => e.exerciseId === planned.exerciseId)
    const done = repeated ? all.slice(0, planned.sets) : all
    left.set(planned.exerciseId, all.slice(done.length))
    return { id: planned.exerciseId, name: planned.name, planned, done }
  })
  left.forEach((done, id) => {
    if (done.length) rows.push({ id, name: done[0].exercise_name ?? id, planned: null, done })
  })
  return rows
}

function progressOf(weeks: WeekStat[]): Progress {
  const out: Progress = { due: 0, done: 0, plannedSets: 0, doneSets: 0 }
  for (const s of weeks.flatMap(w => w.sessions)) {
    if (s.status !== 'done' && s.status !== 'missed') continue
    out.due++
    if (s.status === 'done') out.done++
    for (const e of s.exercises) {
      if (!e.planned) continue
      out.plannedSets += e.planned.sets
      // Capped, so extra sets of one exercise don't hide skipped sets of another.
      out.doneSets += Math.min(e.done.length, e.planned.sets)
    }
  }
  return out
}

export function planStats(plan: Macrocycle, workouts: StatWorkout[], now = new Date()): PlanStats {
  const [year, month, day] = plan.startDate.split('-').map(Number)
  const start = new Date(year, month - 1, day)
  const today = dayOf(now)
  const currentWeek = Math.floor(daysBetween(start, today) / 7)
  const startWeekday = weekdayIndex(start)

  const byWeek = new Map<number, StatWorkout[]>()
  const estimates: { id: string; at: Date; value: number }[] = []
  const names = new Map<string, string>()
  for (const w of workouts) {
    const at = new Date(w.started_at)
    const index = Math.floor(daysBetween(start, at) / 7)
    byWeek.set(index, [...(byWeek.get(index) ?? []), w])
    for (const s of w.workout_sets) {
      const reps = s.reps ?? 0
      const value = reps <= MAX_REPS_FOR_1RM ? e1rm(Number(s.weight_kg ?? 0), reps) : 0
      if (!value) continue
      estimates.push({ id: s.exercise_id, at, value })
      names.set(s.exercise_id, s.exercise_name ?? s.exercise_id)
    }
  }

  const plannedEntries: Entry[][] = []
  const doneEntries: Entry[][] = []
  const planned = plan.mesocycles.flatMap((m, block) => m.microcycles.map(micro => ({ micro, block })))

  const weeks: WeekStat[] = planned.map(({ micro, block }, index) => {
    const from = addDays(start, index * 7)
    const until = addDays(from, 7)
    // Future weeks are measured against what the client can lift today.
    const refUntil = index > currentWeek ? addDays(today, 1) : until
    const refFrom = addDays(refUntil, -REFERENCE_DAYS)
    const reference = new Map<string, number>()
    const best = new Map<string, number>()
    for (const e of estimates) {
      if (e.at >= refFrom && e.at < refUntil) reference.set(e.id, Math.max(reference.get(e.id) ?? 0, e.value))
      if (e.at >= from && e.at < until) best.set(e.id, Math.max(best.get(e.id) ?? 0, e.value))
    }

    const dated = micro.sessions
      .map(session => ({ session, date: addDays(from, (session.dayOfWeek - 1 - startWeekday + 7) % 7) }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
    const inWeek = byWeek.get(index) ?? []
    const { matched, extra } = matchWorkouts(dated, inWeek)

    const sessions: SessionStat[] = dated.map(({ session, date }) => {
      const workout = matched.get(session.id) ?? null
      const offset = daysBetween(today, date)
      const status: SessionStatus = workout ? 'done' : offset < 0 ? 'missed' : offset === 0 ? 'today' : 'upcoming'
      return { session, date, status, workout, exercises: exerciseRows(session, workout) }
    })

    plannedEntries[index] = micro.sessions.flatMap(s => s.exercises.map((e, i) => {
      const ref = reference.get(e.exerciseId)
      const kg = e.weightKg ?? (e.percent1rm && ref ? (ref * e.percent1rm) / 100 : null)
      const percent = e.percent1rm ?? (kg && ref ? (kg / ref) * 100 : null)
      return { exercise: `${s.id}:${i}`, sets: e.sets, reps: midReps(e), kg, percent }
    }))
    doneEntries[index] = inWeek.flatMap(w => w.workout_sets.map(s => {
      const kg = Number(s.weight_kg ?? 0) || null
      const ref = reference.get(s.exercise_id)
      return { exercise: `${w.id}:${s.exercise_position}`, sets: 1, reps: s.reps, kg, percent: kg && ref ? (kg / ref) * 100 : null }
    }))

    return {
      index,
      block,
      start: from,
      end: addDays(from, 6),
      state: index < currentWeek ? 'past' : index === currentWeek ? 'current' : 'future',
      planned: summarize(plannedEntries[index]),
      done: index <= currentWeek ? summarize(doneEntries[index]) : null,
      sessions,
      extra,
      best,
    }
  })

  const blocks: BlockStat[] = plan.mesocycles.map((m, index) => {
    const own = weeks.filter(w => w.block === index)
    const spans = new Map<string, { from: number; to: number; weeks: number }>()
    for (const w of own) {
      w.best.forEach((value, id) => {
        const span = spans.get(id)
        if (span) { span.to = value; span.weeks++ } else spans.set(id, { from: value, to: value, weeks: 1 })
      })
    }
    const gains = Array.from(spans)
      .filter(([, s]) => s.weeks > 1)
      .map(([id, s]) => ({ id, name: names.get(id) ?? id, from: s.from, to: s.to, percent: (s.to / s.from - 1) * 100 }))
      .sort((a, b) => b.percent - a.percent)

    return {
      id: m.id,
      index,
      name: m.name,
      focus: m.focus,
      guide: PHASE_GUIDE[m.focus ?? 'other'],
      weeks: own,
      planned: summarize(own.flatMap(w => plannedEntries[w.index])),
      done: summarize(own.flatMap(w => doneEntries[w.index])),
      progress: progressOf(own),
      gains,
    }
  })

  // Lifts with the most weeks of data first, so the chart opens on a useful one.
  const liftWeeks = new Map<string, number>()
  for (const w of weeks) w.best.forEach((_, id) => liftWeeks.set(id, (liftWeeks.get(id) ?? 0) + 1))
  const lifts = Array.from(liftWeeks).sort((a, b) => b[1] - a[1]).map(([id]) => ({ id, name: names.get(id) ?? id }))

  return { weeks, blocks, progress: progressOf(weeks), currentWeek, lifts }
}
