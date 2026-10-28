import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserId, unauthorized } from '@/lib/api-auth'
import { sanitizeTemplateExercises } from '@/lib/templates'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Nieprawidłowy JSON' }, { status: 400 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('name' in body) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'Podaj nazwę szablonu' }, { status: 400 })
    updates.name = name
  }
  if ('exercises' in body) {
    const exercises = sanitizeTemplateExercises(body.exercises)
    if (!exercises) return NextResponse.json({ error: 'Nieprawidłowa lista ćwiczeń' }, { status: 400 })
    updates.exercises = exercises
  }

  const { error } = await supabaseAdmin()
    .from('workout_templates')
    .update(updates)
    .eq('id', params.id)
    .eq('user_id', userId)

  if (error) {
    console.error('Template update error:', error)
    return NextResponse.json({ error: 'Zapis nie powiódł się' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const { error } = await supabaseAdmin()
    .from('workout_templates')
    .delete()
    .eq('id', params.id)
    .eq('user_id', userId)

  if (error) {
    console.error('Template delete error:', error)
    return NextResponse.json({ error: 'Usuwanie nie powiodło się' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
