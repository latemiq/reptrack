import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [runsAgg, workoutsAgg] = await Promise.all([
    supabase.from('runs').select('distance_km').eq('user_id', userId),
    supabase.from('workouts').select('total_tonnage').eq('user_id', userId).not('finished_at', 'is', null),
  ])

  const totalDistanceKm = (runsAgg.data ?? []).reduce((s, r) => s + (r.distance_km ?? 0), 0)
  const totalRuns       = runsAgg.data?.length ?? 0
  const totalTonnageKg  = (workoutsAgg.data ?? []).reduce((s, w) => s + (w.total_tonnage ?? 0), 0)
  const totalWorkouts   = workoutsAgg.data?.length ?? 0

  // Streak: merge activity dates from runs + workouts (last 60 days)
  const since = new Date(Date.now() - 60 * 86400000).toISOString()
  const [{ data: recentRuns }, { data: recentWorkouts }] = await Promise.all([
    supabase.from('runs').select('ran_at').eq('user_id', userId).gte('ran_at', since),
    supabase.from('workouts').select('finished_at').eq('user_id', userId).not('finished_at', 'is', null).gte('finished_at', since),
  ])

  const dates = new Set<string>()
  recentRuns?.forEach(r => r.ran_at && dates.add(r.ran_at.slice(0, 10)))
  recentWorkouts?.forEach(w => w.finished_at && dates.add(w.finished_at.slice(0, 10)))
  const currentStreak = computeStreak(Array.from(dates))

  return NextResponse.json({
    stats: {
      totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
      totalRuns,
      totalTonnageKg:  Math.round(totalTonnageKg),
      totalWorkouts,
      currentStreak,
      prsThisYear:     0,
      memberMonths:    0,
    }
  })
}

function computeStreak(dates: string[]): number {
  const set = new Set(dates)
  let streak = 0
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  if (!set.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1)
  }

  while (set.has(cursor.toISOString().slice(0, 10))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
    if (streak > 365) break
  }
  return streak
}
