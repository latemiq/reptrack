import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserId, unauthorized } from '@/lib/api-auth'
import { goalProgress } from '@/lib/goal-progress'

const VALID_CATEGORIES = ['strength', 'running', 'body', 'habit'] as const
type Category = typeof VALID_CATEGORIES[number]

export async function GET() {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const { data, error } = await supabaseAdmin()
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Goals fetch error:', error)
    return NextResponse.json({ error: 'Błąd bazy danych. Spróbuj ponownie.' }, { status: 500 })
  }

  return NextResponse.json({
    goals: (data ?? []).map(g => ({ ...g, progress: goalProgress(g) })),
  })
}

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Nieprawidłowy JSON' }, { status: 400 })
  }

  const b = body as Record<string, unknown>

  const name = typeof b.name === 'string' && b.name.trim() ? b.name.trim() : null
  if (!name) return NextResponse.json({ error: 'Brak nazwy celu' }, { status: 400 })

  const category: Category = VALID_CATEGORIES.includes(b.category as Category)
    ? (b.category as Category)
    : 'strength'

  const targetValue = Number(b.target_value)
  if (!Number.isFinite(targetValue)) {
    return NextResponse.json({ error: 'Nieprawidłowa wartość docelowa' }, { status: 400 })
  }

  const hasStart = b.start_value != null && Number.isFinite(Number(b.start_value))
  let startValue = hasStart ? Number(b.start_value) : 0
  if (!hasStart && category === 'body') {
    // Weight goals start from the latest weigh-in, not from 0
    const { data: lastLog } = await supabaseAdmin()
      .from('weight_logs')
      .select('weight_kg')
      .eq('user_id', userId)
      .order('logged_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (lastLog) startValue = Number(lastLog.weight_kg)
  }
  const currentValue = b.current_value != null && Number.isFinite(Number(b.current_value)) ? Number(b.current_value) : startValue
  const unit = typeof b.unit === 'string' ? b.unit.trim() : ''

  const rawTargetDate = b.target_date
  const targetDate = typeof rawTargetDate === 'string' && rawTargetDate.trim() && !Number.isNaN(new Date(rawTargetDate).getTime())
    ? rawTargetDate.slice(0, 10)
    : null

  const { data, error } = await supabaseAdmin()
    .from('goals')
    .insert({
      user_id:       userId,
      name,
      category,
      type:          category,
      unit:          unit || null,
      target_value:  targetValue,
      start_value:   startValue,
      current_value: currentValue,
      target_date:   targetDate,
      status:        'active',
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('Goal insert error:', error)
    return NextResponse.json({ error: 'Zapis nie powiódł się' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id, success: true })
}
