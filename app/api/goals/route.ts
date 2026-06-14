import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const VALID_CATEGORIES = ['strength', 'running', 'body', 'habit'] as const
type Category = typeof VALID_CATEGORIES[number]

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Goals fetch error:', error)
    return NextResponse.json({ goals: [] })
  }

  return NextResponse.json({ goals: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  const startValue = Number.isFinite(Number(b.start_value)) ? Number(b.start_value) : targetValue * 0.9
  const currentValue = Number.isFinite(Number(b.current_value)) ? Number(b.current_value) : startValue
  const unit = typeof b.unit === 'string' ? b.unit.trim() : ''

  const rawTargetDate = b.target_date
  const targetDate = typeof rawTargetDate === 'string' && rawTargetDate.trim()
    ? new Date(rawTargetDate).toISOString()
    : null

  const { data, error } = await supabase
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
