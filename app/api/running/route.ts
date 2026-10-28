import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserId, unauthorized } from '@/lib/api-auth'
import { syncRunningGoals } from '@/lib/goals'

const toPositiveNumber = (value: unknown) => {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

const toNullableNumber = (value: unknown) => {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

const toNullableInt = (value: unknown) => {
  const n = toNullableNumber(value)
  return n == null ? null : Math.round(n)
}

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return unauthorized()
  const supabase = supabaseAdmin()

  const { searchParams } = new URL(req.url)
  const requestedLimit = Number(searchParams.get('limit') ?? '200')
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 500) : 200
  const range = searchParams.get('range') ?? '30d'

  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : range === 'all' ? null : 365

  let query = supabase
    .from('runs')
    .select('*')
    .eq('user_id', userId)
    .order('ran_at', { ascending: false })
    .limit(limit)
  if (days != null) query = query.gte('ran_at', new Date(Date.now() - days * 86400000).toISOString())

  const { data, error } = await query

  if (error) {
    console.error('Runs fetch error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ runs: data ?? [] })
}

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return unauthorized()
  const supabase = supabaseAdmin()

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Nieprawidłowy JSON' }, { status: 400 })
  }

  const distanceKm = toPositiveNumber((body as { distance_km?: unknown }).distance_km)
  const durationSeconds = toPositiveNumber((body as { duration_seconds?: unknown }).duration_seconds)

  if (distanceKm == null || durationSeconds == null) {
    return NextResponse.json({ error: 'Brak wymaganych pól (distance_km, duration_seconds)' }, { status: 400 })
  }

  const rawDate = (body as { date?: unknown }).date
  const parsedDate = typeof rawDate === 'string' && rawDate.trim()
    ? new Date(rawDate)
    : new Date()

  if (Number.isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: 'Nieprawidłowa data biegu' }, { status: 400 })
  }

  const ranAt = parsedDate.toISOString()
  const source = typeof (body as { source?: unknown }).source === 'string'
    ? (body as { source: string }).source
    : 'manual'
  const name = typeof (body as { name?: unknown }).name === 'string' && (body as { name: string }).name.trim()
    ? (body as { name: string }).name.trim()
    : `Bieg ${new Date(ranAt).toLocaleDateString('pl-PL')}`
  const type = typeof (body as { type?: unknown }).type === 'string'
    ? (body as { type: string }).type
    : 'easy'
  const location = typeof (body as { location?: unknown }).location === 'string'
    ? (body as { location: string }).location
    : null

  const avgPace = toNullableInt((body as { avg_pace_seconds_per_km?: unknown }).avg_pace_seconds_per_km)
    ?? (distanceKm > 0 ? Math.round(durationSeconds / distanceKm) : null)

  const { data, error } = await supabase
    .from('runs')
    .insert({
      user_id: userId,
      name,
      distance_km: distanceKm,
      duration_seconds: Math.round(durationSeconds),
      avg_pace_seconds_per_km: avgPace,
      avg_hr: toNullableInt((body as { avg_hr?: unknown }).avg_hr),
      max_hr: toNullableInt((body as { max_hr?: unknown }).max_hr),
      elevation_gain_m: toNullableNumber((body as { elevation_gain_m?: unknown }).elevation_gain_m),
      calories: toNullableInt((body as { calories?: unknown }).calories),
      location,
      type,
      source,
      ran_at: ranAt,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('Insert run error:', error)
    return NextResponse.json({ error: 'Zapis nie powiódł się' }, { status: 500 })
  }

  await syncRunningGoals(userId)

  return NextResponse.json({ id: data.id, success: true })
}
