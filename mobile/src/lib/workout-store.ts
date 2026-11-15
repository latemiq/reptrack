import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

// The live workout lives on the phone until it's finished and sent to the server,
// so closing the app or losing signal mid-session never loses logged sets.

export interface SetEntry {
  id: string
  weightKg: number | null
  reps: number | null
  rpe: number | null
  done: boolean
  completedAt?: number
}

export interface ExerciseEntry {
  id: string
  exerciseId: string
  name: string
  targetSets: number
  targetReps: number
  targetRepsMax?: number | null
  targetWeight: number | null
  restSeconds: number
  /** Trainer prescription line, e.g. "4×6 · 80 kg · RPE 7". */
  plan?: string
  /** Trainer's note for this exercise. */
  notes?: string
  /** Sets from the last time ("Poprz." column). */
  previous?: { weightKg: number | null; reps: number | null }[]
  sets: SetEntry[]
}

export interface ActiveWorkout {
  id: string
  name: string
  templateId: string | null
  startedAt: number
  trainerNote?: string
  exercises: ExerciseEntry[]
}

export interface RestTimer {
  /** Epoch ms when the rest ends — survives the app going to background. */
  endsAt: number
  total: number
  notificationId?: string
}

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/** All planned sets up front, weights from the plan or from the same set last time. */
function plannedSets(ex: Omit<ExerciseEntry, 'sets'>): SetEntry[] {
  const n = Math.max(1, ex.targetSets || 1)
  return Array.from({ length: n }, (_, i) => {
    const prev = ex.previous?.[Math.min(i, (ex.previous?.length ?? 1) - 1)]
    return { id: newId(), weightKg: ex.targetWeight ?? prev?.weightKg ?? null, reps: ex.targetReps || prev?.reps || null, rpe: null, done: false }
  })
}

interface Store {
  workout: ActiveWorkout | null
  rest: RestTimer | null
  start: (name: string, exercises: Omit<ExerciseEntry, 'id' | 'sets'>[], templateId?: string, trainerNote?: string) => void
  finish: () => void
  addExercise: (ex: Omit<ExerciseEntry, 'id' | 'sets'>) => string
  removeExercise: (id: string) => void
  updateSet: (exId: string, setId: string, patch: Partial<SetEntry>) => void
  addSet: (exId: string) => void
  removeLastSet: (exId: string) => void
  setRest: (rest: RestTimer | null) => void
}

export const useWorkout = create<Store>()(persist((set, get) => ({
  workout: null,
  rest: null,

  start: (name, exercises, templateId, trainerNote) => set({
    rest: null,
    workout: {
      id: newId(), name, templateId: templateId ?? null, startedAt: Date.now(), trainerNote: trainerNote || undefined,
      exercises: exercises.map(e => { const ex = { ...e, id: newId() }; return { ...ex, sets: plannedSets(ex) } }),
    },
  }),

  finish: () => set({ workout: null, rest: null }),

  addExercise: ex => {
    const w = get().workout
    const id = newId()
    if (w) set({ workout: { ...w, exercises: [...w.exercises, { ...ex, id, sets: plannedSets({ ...ex, id }) }] } })
    return id
  },

  removeExercise: id => {
    const w = get().workout
    if (w) set({ workout: { ...w, exercises: w.exercises.filter(e => e.id !== id) } })
  },

  updateSet: (exId, setId, patch) => {
    const w = get().workout
    if (!w) return
    set({ workout: { ...w, exercises: w.exercises.map(e => e.id !== exId ? e : { ...e, sets: e.sets.map(s => s.id === setId ? { ...s, ...patch } : s) }) } })
  },

  addSet: exId => {
    const w = get().workout
    if (!w) return
    set({ workout: { ...w, exercises: w.exercises.map(e => {
      if (e.id !== exId) return e
      const last = e.sets[e.sets.length - 1]
      return { ...e, sets: [...e.sets, { id: newId(), weightKg: last?.weightKg ?? e.targetWeight, reps: last?.reps ?? e.targetReps, rpe: null, done: false }] }
    }) } })
  },

  removeLastSet: exId => {
    const w = get().workout
    if (!w) return
    set({ workout: { ...w, exercises: w.exercises.map(e => e.id !== exId || e.sets.length < 2 ? e : { ...e, sets: e.sets.slice(0, -1) }) } })
  },

  setRest: rest => set({ rest }),
}), {
  name: 'reptrack-workout',
  storage: createJSONStorage(() => AsyncStorage),
}))

export function progress(w: ActiveWorkout | null) {
  if (!w) return { done: 0, total: 0, pct: 0, tonnage: 0 }
  let done = 0, total = 0, tonnage = 0
  for (const e of w.exercises) for (const s of e.sets) {
    total++
    if (s.done) { done++; tonnage += (s.weightKg ?? 0) * (s.reps ?? 0) }
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0, tonnage }
}
