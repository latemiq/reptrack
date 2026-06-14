import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Nieprawidłowy JSON' }, { status: 400 })
  }

  const weightKg = Number((body as { weight_kg?: unknown }).weight_kg)
  if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 500) {
    return NextResponse.json({ error: 'Nieprawidłowa waga' }, { status: 400 })
  }

  const rawDate = (body as { date?: unknown }).date
  const recordedAt = typeof rawDate === 'string' && rawDate.trim()
    ? new Date(rawDate).toISOString()
    : new Date().toISOString()

  const { error } = await supabase
    .from('body_measurements')
    .insert({ user_id: userId, weight_kg: weightKg, recorded_at: recordedAt })

  if (error) {
    console.error('Weight log insert error:', error)
    return NextResponse.json({ error: 'Zapis nie powiódł się' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('body_measurements')
    .select('id, weight_kg, recorded_at')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false })
    .limit(90)

  if (error) {
    return NextResponse.json({ measurements: [] })
  }

  return NextResponse.json({ measurements: data ?? [] })
}
