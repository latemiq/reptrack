import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserId, unauthorized } from '@/lib/api-auth'
import { DEFAULT_TEMPLATES, sanitizeTemplateExercises } from '@/lib/templates'

const COLUMNS = 'id, name, exercises, last_used_at, created_at'

export async function GET() {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('workout_templates')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Templates fetch error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // First visit: seed a starter PPL split so the gym screen isn't empty.
  if ((data ?? []).length === 0) {
    const { data: seeded, error: seedErr } = await supabase
      .from('workout_templates')
      .insert(DEFAULT_TEMPLATES.map(t => ({ ...t, user_id: userId })))
      .select(COLUMNS)
    if (seedErr) console.error('Templates seed error:', seedErr)
    return NextResponse.json({ templates: seeded ?? [] })
  }

  return NextResponse.json({ templates: data })
}

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const body = await req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Podaj nazwę szablonu' }, { status: 400 })

  const exercises = sanitizeTemplateExercises(body?.exercises ?? [])
  if (!exercises) return NextResponse.json({ error: 'Nieprawidłowa lista ćwiczeń' }, { status: 400 })

  const { data, error } = await supabaseAdmin()
    .from('workout_templates')
    .insert({ user_id: userId, name, exercises })
    .select(COLUMNS)
    .single()

  if (error) {
    console.error('Template insert error:', error)
    return NextResponse.json({ error: 'Zapis nie powiódł się' }, { status: 500 })
  }

  return NextResponse.json({ template: data }, { status: 201 })
}
