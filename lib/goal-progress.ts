export interface GoalRow {
  id: string
  name: string
  category: string | null
  type: string
  unit: string | null
  target_value: number | string
  start_value: number | string
  current_value: number | string | null
  target_date: string | null
  status: string | null
  created_at: string
  completed_at?: string | null
}

/** 0–100. Works both for increasing goals (deadlift 140→160) and decreasing ones (weight 80→76). */
export function goalProgress(goal: Pick<GoalRow, 'start_value' | 'target_value' | 'current_value'>): number {
  const start   = Number(goal.start_value)
  const target  = Number(goal.target_value)
  const current = goal.current_value == null ? start : Number(goal.current_value)
  if (![start, target, current].every(Number.isFinite)) return 0
  if (target === start) return current === target ? 100 : 0
  const pct = ((current - start) / (target - start)) * 100
  return Math.max(0, Math.min(100, Math.round(pct)))
}
