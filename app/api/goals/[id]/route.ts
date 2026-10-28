import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserId, unauthorized } from '@/lib/api-auth'
import { goalProgress } from '@/lib/goal-progress'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Nieprawidłowy JSON' }, { status: 400 })
  }

  const supabase = supabaseAdmin()
  const { data: goal } = await supabase
    .from('goals')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', userId)
    .maybeSingle()
  if (!goal) return NextResponse.json({ error: 'Nie znaleziono celu' }, { status: 404 })

  const now = new Date().toISOString()
  const updates: Record<string, unknown> = { updated_at: now }

  if ('current_value' in body) {
    const v = Number(body.current_value)
    if (!Number.isFinite(v)) return NextResponse.json({ error: 'Nieprawidłowa wartość' }, { status: 400 })
    updates.current_value = v
    if (goal.status === 'active' && goalProgress({ ...goal, current_value: v }) >= 100) {
      updates.status = 'completed'
      updates.completed_at = now
    }
  }

  if (body.status === 'completed' || body.status === 'active' || body.status === 'archived') {
    updates.status = body.status
    updates.completed_at = body.status === 'completed' ? now : null
  }

  const { error } = await supabase.from('goals').update(updates).eq('id', params.id).eq('user_id', userId)
  if (error) {
    console.error('Goal update error:', error)
    return NextResponse.json({ error: 'Zapis nie powiódł się' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const { error } = await supabaseAdmin().from('goals').delete().eq('id', params.id).eq('user_id', userId)
  if (error) {
    console.error('Goal delete error:', error)
    return NextResponse.json({ error: 'Usuwanie nie powiodło się' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
