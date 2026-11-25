import { router } from 'expo-router'
import { useCallback } from 'react'
import { useApi } from '@/lib/api'
import type { WarmupItem } from '@/lib/warmup'
import { useWorkout, type ExerciseEntry } from '@/lib/workout-store'

type NewExercise = Omit<ExerciseEntry, 'id' | 'sets' | 'previous'>
type Previous = NonNullable<ExerciseEntry['previous']>

/** Fetches last-time results for the "Poprz." column. Missing data is fine — the column stays empty. */
export function usePrevious() {
  const api = useApi()
  return useCallback(async (ids: string[]): Promise<Record<string, Previous>> => {
    if (!ids.length) return {}
    try {
      return (await api<{ previous: Record<string, Previous> }>(`/api/gym/previous?ids=${encodeURIComponent(ids.join(','))}`)).previous
    } catch {
      return {}
    }
  }, [api])
}

/** Starts a workout with previous results attached and opens the live workout screen. */
export function useStartWorkout() {
  const fetchPrevious = usePrevious()
  return useCallback(async (name: string, exercises: NewExercise[], templateId?: string, trainerNote?: string, warmup?: WarmupItem[]) => {
    if (useWorkout.getState().workout) { router.push('/workout'); return }
    const previous = await fetchPrevious(Array.from(new Set(exercises.map(e => e.exerciseId))))
    useWorkout.getState().start(name, exercises.map(e => ({ ...e, previous: previous[e.exerciseId] })), templateId, trainerNote, warmup)
    router.push('/workout')
  }, [fetchPrevious])
}
