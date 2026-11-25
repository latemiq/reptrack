import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ensureProfile, getUserId, unauthorized } from '@/lib/api-auth'
import { DEFAULT_TEMPLATES } from '@/lib/templates'

const positiveOrNull = (v: unknown) => {
  const n = Number(v)
  return v != null && Number.isFinite(n) && n > 0 ? n : null
}

export async function POST(req: Request) {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Nieprawidłowy JSON' }, { status: 400 })
  }

  const weightKg   = positiveOrNull(body.weightKg)
  const heightCm   = positiveOrNull(body.heightCm)
  const weeklyDays = positiveOrNull(body.weeklyDays)
  const level      = ['beginner', 'intermediate', 'advanced'].includes(body.level) ? body.level : null
  const goals: string[] = Array.isArray(body.goals) ? body.goals : []
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim().slice(0, 60) : ''

  const supabase = supabaseAdmin()
  await ensureProfile(userId)
  const { data: before } = await supabase.from('profiles').select('onboarded_at').eq('id', userId).maybeSingle()

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('profiles')
    .update({
      weight_kg:    weightKg,
      height_cm:    heightCm ? Math.round(heightCm) : null,
      level,
      weekly_days:  weeklyDays ? Math.round(weeklyDays) : null,
      // Clerk's webhook also syncs the name, but it can't reach localhost and may come later.
      ...(firstName ? { first_name: firstName } : {}),
      onboarded_at: now,
      updated_at:   now,
    })
    .eq('id', userId)

  if (error) {
    console.error('Onboarding profile error:', error)
    return NextResponse.json({ error: 'Zapis profilu nie powiódł się' }, { status: 500 })
  }

  // A starter push/pull/legs split, once, so a new account's gym screen isn't empty.
  // Only on the first onboarding: templates the user deletes later must not come back.
  if (!before?.onboarded_at) {
    const { count } = await supabase.from('workout_templates').select('id', { count: 'exact', head: true }).eq('user_id', userId)
    if (!count) {
      const { error: seedErr } = await supabase.from('workout_templates').insert(DEFAULT_TEMPLATES.map(t => ({ ...t, user_id: userId })))
      if (seedErr) console.error('Onboarding templates error:', seedErr)
    }
  }

  if (weightKg) {
    await supabase.from('weight_logs').insert({ user_id: userId, weight_kg: weightKg })
  }

  const GOAL_MAP: Record<string, { name: string; category: string; unit: string; start: number; target: number }> = {
    run:      { name: 'Przebiec 100 km',     category: 'running',  unit: 'km', start: 0, target: 100 },
    strength: { name: 'Zwiększyć siłę',      category: 'strength', unit: 'kg', start: 0, target: 100 },
    weight:   { name: 'Zmienić masę ciała',  category: 'body',     unit: 'kg', start: weightKg ?? 75, target: weightKg ? Math.round(weightKg - 3) : 72 },
  }

  const goalRows = goals
    .filter(g => GOAL_MAP[g])
    .map(g => ({
      user_id:       userId,
      name:          GOAL_MAP[g].name,
      category:      GOAL_MAP[g].category,
      type:          GOAL_MAP[g].category,
      unit:          GOAL_MAP[g].unit,
      target_value:  GOAL_MAP[g].target,
      start_value:   GOAL_MAP[g].start,
      current_value: GOAL_MAP[g].start,
      status:        'active',
    }))

  if (goalRows.length > 0) {
    const { error: goalsErr } = await supabase.from('goals').insert(goalRows)
    if (goalsErr) console.error('Onboarding goals error:', goalsErr)
  }

  return NextResponse.json({ success: true })
}
