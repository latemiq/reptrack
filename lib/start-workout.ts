'use client'

import { useWorkoutStore, type ExerciseEntry } from '@/lib/stores/useWorkoutStore'

type Previous = NonNullable<ExerciseEntry['previous']>

/** Last performance of the given exercises (for the "Poprzednio" column and prefilled weights). */
export async function fetchPrevious(exerciseIds: string[]): Promise<Record<string, Previous>> {
  if (!exerciseIds.length) return {}
  const res = await fetch(`/api/gym/previous?ids=${encodeURIComponent(exerciseIds.join(','))}`).catch(() => null)
  if (!res?.ok) return {}
  return (await res.json()).previous ?? {}
}

/** Starts a workout with previous results attached; returns the new workout id. */
export async function startWorkoutWithHistory(
  name: string,
  exercises: Omit<ExerciseEntry, 'id' | 'sets' | 'previous'>[],
  templateId?: string,
): Promise<string | null> {
  const previous = await fetchPrevious(Array.from(new Set(exercises.map(e => e.exerciseId))))
  useWorkoutStore.getState().startWorkout(
    name,
    exercises.map(ex => ({ ...ex, id: crypto.randomUUID(), previous: previous[ex.exerciseId] })),
    templateId,
  )
  return useWorkoutStore.getState().activeWorkout?.id ?? null
}
