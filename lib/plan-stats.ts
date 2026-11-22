// Periodization statistics: what the trainer planned vs. what the client did, per macro-, meso- and microcycle.
// Runs in the browser on purpose: days and weeks follow local time, the server (Vercel) runs in UTC.
//
// Only counts of logged sets and sessions. Intensity, 1RM, rep totals and tonnage are deliberately absent
// until the log says what a number means: seconds or reps, with or without bodyweight, main lift or accessory.

import { weekdayIndex, type StatSet, type StatWorkout } from '@/lib/gym-stats'
import type { Focus, Macrocycle, PlannedExercise, PlannedSession } from '@/lib/plans'

const DAY = 86400000
export type Period = 'preparatory' | 'transition' | 'recovery' | 'unknown'

export const PERIOD_LABEL: Record<Period, string> = {
  preparatory: 'Przygotowawczy',
  transition: 'Przejściowy',
  recovery: 'Odciążenie',
  unknown: 'Nieokreślony',
}

const FOCUS_PERIOD: Record<Focus, Period> = {
  hypertrophy: 'preparatory',
  endurance: 'preparatory',
  strength: 'preparatory',
  power: 'transition',
  deload: 'recovery',
  other: 'unknown',
}

export interface ExerciseRow {
  id: string
  name: string
  planned: PlannedExercise | null
  done: StatSet[]
}

/** unlogged = the day has passed and nothing was saved, which doesn't prove the session was skipped. */
export type SessionStatus = 'done' | 'unlogged' | 'today' | 'upcoming'

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
  plannedSets: number
  /** null = the week hasn't started yet. */
  doneSets: number | null
  sessions: SessionStat[]
  /** Workouts of that week that match no planned session. */
  extra: StatWorkout[]
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
  period: Period
  weeks: WeekStat[]
  plannedSets: number
  doneSets: number
  progress: Progress
}

export interface PlanStats {
  weeks: WeekStat[]
  blocks: BlockStat[]
  progress: Progress
  /** 0-based; below 0 before the start, >= weeks.length after the end. */
  currentWeek: number
}

/** Midnight, local time. */
const dayOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
// Rounded, because a day is 23 or 25 hours long when the clocks change.
const daysBetween = (from: Date, to: Date) => Math.round((dayOf(to).getTime() - dayOf(from).getTime()) / DAY)
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

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
    if (s.status !== 'done' && s.status !== 'unlogged') continue
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
  for (const w of workouts) {
    const index = Math.floor(daysBetween(start, new Date(w.started_at)) / 7)
    byWeek.set(index, [...(byWeek.get(index) ?? []), w])
  }

  const planned = plan.mesocycles.flatMap((m, block) => m.microcycles.map(micro => ({ micro, block })))

  const weeks: WeekStat[] = planned.map(({ micro, block }, index) => {
    const from = addDays(start, index * 7)
    const dated = micro.sessions
      .map(session => ({ session, date: addDays(from, (session.dayOfWeek - 1 - startWeekday + 7) % 7) }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
    const inWeek = byWeek.get(index) ?? []
    const { matched, extra } = matchWorkouts(dated, inWeek)

    const sessions: SessionStat[] = dated.map(({ session, date }) => {
      const workout = matched.get(session.id) ?? null
      const offset = daysBetween(today, date)
      const status: SessionStatus = workout ? 'done' : offset < 0 ? 'unlogged' : offset === 0 ? 'today' : 'upcoming'
      return { session, date, status, workout, exercises: exerciseRows(session, workout) }
    })

    return {
      index,
      block,
      start: from,
      end: addDays(from, 6),
      state: index < currentWeek ? 'past' : index === currentWeek ? 'current' : 'future',
      plannedSets: micro.sessions.reduce((n, s) => n + s.exercises.reduce((m, e) => m + e.sets, 0), 0),
      doneSets: index <= currentWeek ? inWeek.reduce((n, w) => n + w.workout_sets.length, 0) : null,
      sessions,
      extra,
    }
  })

  const blocks: BlockStat[] = plan.mesocycles.map((m, index) => {
    const own = weeks.filter(w => w.block === index)
    return {
      id: m.id,
      index,
      name: m.name,
      focus: m.focus,
      period: FOCUS_PERIOD[m.focus ?? 'other'],
      weeks: own,
      plannedSets: own.reduce((n, w) => n + w.plannedSets, 0),
      doneSets: own.reduce((n, w) => n + (w.doneSets ?? 0), 0),
      progress: progressOf(own),
    }
  })

  return { weeks, blocks, progress: progressOf(weeks), currentWeek }
}
