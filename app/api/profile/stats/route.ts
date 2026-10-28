import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserId, unauthorized } from '@/lib/api-auth'
import { computeStreak, dayKey } from '@/lib/stats'

export async function GET() {
  const userId = await getUserId()
  if (!userId) return unauthorized()
  const supabase = supabaseAdmin()

  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString()
  const [runsAgg, workoutsAgg, profileRes, completedGoals] = await Promise.all([
    supabase.from('runs').select('distance_km').eq('user_id', userId),
    supabase.from('workouts').select('total_tonnage').eq('user_id', userId).not('finished_at', 'is', null),
    supabase.from('profiles').select('created_at').eq('id', userId).maybeSingle(),
    supabase.from('goals').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'completed').gte('completed_at', yearStart),
  ])

  // numeric columns come back from PostgREST as strings
  const totalDistanceKm = (runsAgg.data ?? []).reduce((s, r) => s + Number(r.distance_km ?? 0), 0)
  const totalRuns       = runsAgg.data?.length ?? 0
  const totalTonnageKg  = (workoutsAgg.data ?? []).reduce((s, w) => s + Number(w.total_tonnage ?? 0), 0)
  const createdAt       = profileRes.data?.created_at ? new Date(profileRes.data.created_at) : new Date()
  const memberMonths    = Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / (30 * 86400000)))
  const totalWorkouts   = workoutsAgg.data?.length ?? 0

  // Streak: merge activity dates from runs + workouts (last 60 days)
  const since = new Date(Date.now() - 60 * 86400000).toISOString()
  const [{ data: recentRuns }, { data: recentWorkouts }] = await Promise.all([
    supabase.from('runs').select('ran_at').eq('user_id', userId).gte('ran_at', since),
    supabase.from('workouts').select('finished_at').eq('user_id', userId).not('finished_at', 'is', null).gte('finished_at', since),
  ])

  const dates = new Set<string>()
  recentRuns?.forEach(r => r.ran_at && dates.add(dayKey(r.ran_at)))
  recentWorkouts?.forEach(w => w.finished_at && dates.add(dayKey(w.finished_at)))
  const currentStreak = computeStreak(dates)

  return NextResponse.json({
    stats: {
      totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
      totalRuns,
      totalTonnageKg:  Math.round(totalTonnageKg),
      totalWorkouts,
      currentStreak,
      prsThisYear:     completedGoals.count ?? 0,
      memberMonths,
    }
  })
}
