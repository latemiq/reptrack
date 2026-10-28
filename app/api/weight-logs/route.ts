import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserId, unauthorized } from '@/lib/api-auth'
import { syncBodyGoals } from '@/lib/goals'

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Nieprawidłowy JSON' }, { status: 400 })
  }

  const weightKg = Number((body as { weight_kg?: unknown }).weight_kg)
  if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 500) {
    return NextResponse.json({ error: 'Nieprawidłowa waga' }, { status: 400 })
  }

  const rawDate = (body as { date?: unknown }).date
  const loggedAt = typeof rawDate === 'string' && rawDate.trim() && !Number.isNaN(new Date(rawDate).getTime())
    ? new Date(rawDate).toISOString()
    : new Date().toISOString()

  const supabase = supabaseAdmin()
  const { error } = await supabase
    .from('weight_logs')
    .insert({ user_id: userId, weight_kg: weightKg, logged_at: loggedAt })

  if (error) {
    console.error('Weight log insert error:', error)
    return NextResponse.json({ error: 'Zapis nie powiódł się' }, { status: 500 })
  }

  await syncBodyGoals(userId, weightKg)

  return NextResponse.json({ success: true })
}

export async function GET() {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const { data, error } = await supabaseAdmin()
    .from('weight_logs')
    .select('id, weight_kg, logged_at')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(90)

  if (error) {
    console.error('Weight logs fetch error:', error)
    return NextResponse.json({ measurements: [] })
  }

  return NextResponse.json({
    measurements: (data ?? []).map(m => ({ id: m.id, weight_kg: Number(m.weight_kg), recorded_at: m.logged_at })),
  })
}
