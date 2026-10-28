import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ensureProfile, getUserId, unauthorized } from '@/lib/api-auth'

export async function GET() {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const supabase = supabaseAdmin()
  await ensureProfile(userId)

  const [{ data }, { data: lastLog }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, age, height_cm, weight_kg, location, level, bio, weekly_days, weekly_km_goal, onboarded_at, created_at')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('weight_logs')
      .select('weight_kg')
      .eq('user_id', userId)
      .order('logged_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (!data) return NextResponse.json({ profile: {} })

  return NextResponse.json({
    profile: {
      age:          data.age,
      heightCm:     data.height_cm,
      weightKg:     lastLog?.weight_kg != null ? Number(lastLog.weight_kg) : data.weight_kg != null ? Number(data.weight_kg) : null,
      location:     data.location,
      level:        data.level,
      bio:          data.bio,
      weeklyDays:   data.weekly_days,
      weeklyKmGoal: data.weekly_km_goal != null ? Number(data.weekly_km_goal) : null,
      onboarded:    Boolean(data.onboarded_at),
    },
  })
}

export async function PATCH(req: Request) {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Nieprawidłowy JSON' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  const ALLOWED = ['age', 'height_cm', 'weight_kg', 'location', 'level', 'bio', 'weekly_days', 'weekly_km_goal']
  for (const key of ALLOWED) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  updates.updated_at = new Date().toISOString()

  await ensureProfile(userId)
  const { error } = await supabaseAdmin().from('profiles').update(updates).eq('id', userId)

  if (error) {
    console.error('Profile update error:', error)
    return NextResponse.json({ error: 'Zapis nie powiódł się' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
