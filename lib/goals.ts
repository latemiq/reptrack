import { supabaseAdmin } from '@/lib/supabase/admin'
import { goalProgress, type GoalRow } from '@/lib/goal-progress'

async function saveCurrentValue(goal: GoalRow, current: number) {
  const reached = goalProgress({ ...goal, current_value: current }) >= 100
  const now = new Date().toISOString()
  await supabaseAdmin()
    .from('goals')
    .update({
      current_value: current,
      updated_at: now,
      ...(reached ? { status: 'completed', completed_at: now } : {}),
    })
    .eq('id', goal.id)
}

async function activeGoals(userId: string, category: string, unit: string): Promise<GoalRow[]> {
  const { data } = await supabaseAdmin()
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .eq('category', category)
    .eq('unit', unit)
    .eq('status', 'active')
  return (data ?? []) as GoalRow[]
}

/** Body-weight goals track the latest weigh-in. */
export async function syncBodyGoals(userId: string, latestWeightKg: number) {
  const goals = await activeGoals(userId, 'body', 'kg')
  await Promise.all(goals.map(g => saveCurrentValue(g, latestWeightKg)))
}

/** Running km goals track total distance run since the goal was created. */
export async function syncRunningGoals(userId: string) {
  const goals = await activeGoals(userId, 'running', 'km')
  if (goals.length === 0) return

  const oldest = goals.reduce((min, g) => (g.created_at < min ? g.created_at : min), goals[0].created_at)
  const { data: runs } = await supabaseAdmin()
    .from('runs')
    .select('distance_km, ran_at')
    .eq('user_id', userId)
    .gte('ran_at', oldest)

  await Promise.all(goals.map(g => {
    const km = (runs ?? [])
      .filter(r => r.ran_at >= g.created_at)
      .reduce((sum, r) => sum + Number(r.distance_km), 0)
    return saveCurrentValue(g, Number(g.start_value) + Math.round(km * 10) / 10)
  }))
}
