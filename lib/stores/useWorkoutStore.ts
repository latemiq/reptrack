import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// ─── TYPY ────────────────────────────────────────────────────────────────────

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
  targetWeight: number | null
  restSeconds: number
  notes?: string
  sets: SetEntry[]
}

export interface ActiveWorkout {
  id: string
  name: string
  templateId: string | null
  startedAt: number
  exercises: ExerciseEntry[]
  notes?: string
}

interface RestTimerState {
  isActive: boolean
  totalSeconds: number
  remainingSeconds: number
  exerciseId: string | null
}

interface WorkoutStore {
  activeWorkout: ActiveWorkout | null
  restTimer: RestTimerState

  startWorkout: (name: string, exercises: Omit<ExerciseEntry, 'sets'>[], templateId?: string) => void
  finishWorkout: () => ActiveWorkout | null
  cancelWorkout: () => void

  addExercise: (exercise: Omit<ExerciseEntry, 'sets'>) => void
  removeExercise: (exerciseId: string) => void
  reorderExercise: (exerciseId: string, direction: 'up' | 'down') => void

  addSet: (exerciseId: string) => void
  updateSet: (exerciseId: string, setId: string, patch: Partial<SetEntry>) => void
  completeSet: (exerciseId: string, setId: string) => void
  removeSet: (exerciseId: string, setId: string) => void

  startRestTimer: (seconds: number, exerciseId: string) => void
  tickRestTimer: () => void
  skipRestTimer: () => void
  addRestTime: (extraSeconds: number) => void
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const newId = () => crypto.randomUUID()

const emptyTimer: RestTimerState = { isActive: false, totalSeconds: 0, remainingSeconds: 0, exerciseId: null }

// ─── STORE ───────────────────────────────────────────────────────────────────

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set, get) => ({
      activeWorkout: null,
      restTimer: emptyTimer,

      startWorkout: (name, exercises, templateId) => {
        set({
          activeWorkout: {
            id: newId(),
            name,
            templateId: templateId ?? null,
            startedAt: Date.now(),
            exercises: exercises.map(ex => ({
              ...ex,
              sets: [{ id: newId(), weightKg: ex.targetWeight, reps: ex.targetReps, rpe: null, done: false }],
            })),
          },
        })
      },

      finishWorkout: () => {
        const final = get().activeWorkout
        set({ activeWorkout: null, restTimer: emptyTimer })
        return final
      },

      cancelWorkout: () => {
        set({ activeWorkout: null, restTimer: emptyTimer })
      },

      addExercise: (exercise) => {
        const w = get().activeWorkout
        if (!w) return
        set({ activeWorkout: { ...w, exercises: [...w.exercises, { ...exercise, sets: [] }] } })
      },

      removeExercise: (exerciseId) => {
        const w = get().activeWorkout
        if (!w) return
        set({ activeWorkout: { ...w, exercises: w.exercises.filter(e => e.id !== exerciseId) } })
      },

      reorderExercise: (exerciseId, direction) => {
        const w = get().activeWorkout
        if (!w) return
        const idx = w.exercises.findIndex(e => e.id === exerciseId)
        if (idx === -1) return
        const newIdx = direction === 'up' ? idx - 1 : idx + 1
        if (newIdx < 0 || newIdx >= w.exercises.length) return
        const arr = [...w.exercises]
        ;[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
        set({ activeWorkout: { ...w, exercises: arr } })
      },

      addSet: (exerciseId) => {
        const w = get().activeWorkout
        if (!w) return
        set({
          activeWorkout: {
            ...w,
            exercises: w.exercises.map(ex => {
              if (ex.id !== exerciseId) return ex
              const last = ex.sets[ex.sets.length - 1]
              return {
                ...ex,
                sets: [...ex.sets, {
                  id: newId(),
                  weightKg: last?.weightKg ?? ex.targetWeight,
                  reps: last?.reps ?? ex.targetReps,
                  rpe: null,
                  done: false,
                }],
              }
            }),
          },
        })
      },

      updateSet: (exerciseId, setId, patch) => {
        const w = get().activeWorkout
        if (!w) return
        set({
          activeWorkout: {
            ...w,
            exercises: w.exercises.map(ex =>
              ex.id !== exerciseId ? ex : {
                ...ex,
                sets: ex.sets.map(s => s.id === setId ? { ...s, ...patch } : s),
              }
            ),
          },
        })
      },

      completeSet: (exerciseId, setId) => {
        const exercise = get().activeWorkout?.exercises.find(e => e.id === exerciseId)
        if (!exercise) return
        get().updateSet(exerciseId, setId, { done: true, completedAt: Date.now() })
        if (exercise.restSeconds > 0) get().startRestTimer(exercise.restSeconds, exerciseId)
      },

      removeSet: (exerciseId, setId) => {
        const w = get().activeWorkout
        if (!w) return
        set({
          activeWorkout: {
            ...w,
            exercises: w.exercises.map(ex =>
              ex.id !== exerciseId ? ex : { ...ex, sets: ex.sets.filter(s => s.id !== setId) }
            ),
          },
        })
      },

      startRestTimer: (seconds, exerciseId) => {
        set({ restTimer: { isActive: true, totalSeconds: seconds, remainingSeconds: seconds, exerciseId } })
      },

      tickRestTimer: () => {
        const t = get().restTimer
        if (!t.isActive || t.remainingSeconds <= 0) return
        set({ restTimer: { ...t, remainingSeconds: t.remainingSeconds - 1 } })
      },

      skipRestTimer: () => { set({ restTimer: emptyTimer }) },

      addRestTime: (extra) => {
        const t = get().restTimer
        if (!t.isActive) return
        set({ restTimer: { ...t, remainingSeconds: t.remainingSeconds + extra, totalSeconds: t.totalSeconds + extra } })
      },
    }),
    {
      name: 'reptrack-workout',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ activeWorkout: state.activeWorkout }),
    }
  )
)

// ─── SELEKTORY ────────────────────────────────────────────────────────────────

export const selectProgress = (state: WorkoutStore) => {
  const w = state.activeWorkout
  if (!w) return { done: 0, total: 0, pct: 0 }
  let done = 0, total = 0
  w.exercises.forEach(ex => {
    total += ex.targetSets || ex.sets.length
    done += ex.sets.filter(s => s.done).length
  })
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}

export const selectActiveExercise = (state: WorkoutStore) => {
  const w = state.activeWorkout
  if (!w) return null
  return w.exercises.find(ex => {
    const target = ex.targetSets || ex.sets.length
    return ex.sets.filter(s => s.done).length < target
  }) ?? null
}

export const selectTotalTonnage = (state: WorkoutStore): number => {
  const w = state.activeWorkout
  if (!w) return 0
  return w.exercises.reduce((sum, ex) =>
    sum + ex.sets.reduce((s, set) => {
      if (!set.done || !set.weightKg || !set.reps) return s
      return s + set.weightKg * set.reps
    }, 0), 0)
}
