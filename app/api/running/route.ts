import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Number(searchParams.get('limit') ?? '50')
  const range = searchParams.get('range') ?? '30d'

  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const { data, error } = await supabase
    .from('runs')
    .select('*')
    .eq('user_id', userId)
    .gte('ran_at', since)
    .order('ran_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Runs fetch error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ runs: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (!body.distance_km || !body.duration_seconds) {
    return NextResponse.json({ error: 'Brak wymaganych pól (distance_km, duration_seconds)' }, { status: 400 })
  }

  const ranAt = body.date
    ? new Date(body.date).toISOString()
    : new Date().toISOString()

  const { data, error } = await supabase
    .from('runs')
    .insert({
      user_id: userId,
      name: body.name ?? `Bieg ${new Date(ranAt).toLocaleDateString('pl-PL')}`,
      distance_km: body.distance_km,
      duration_seconds: body.duration_seconds,
      avg_pace_seconds_per_km: body.avg_pace_seconds_per_km,
      avg_hr: body.avg_hr,
      max_hr: body.max_hr,
      elevation_gain_m: body.elevation_gain_m,
      calories: body.calories,
      location: body.location,
      type: body.type ?? 'easy',
      source: body.source ?? 'manual',
      ran_at: ranAt,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('Insert run error:', error)
    return NextResponse.json({ error: 'Zapis nie powiódł się' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id, success: true })
}
