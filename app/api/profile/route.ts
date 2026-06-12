import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('profiles')
    .select('id, age, height_cm, weight_kg, location, level, bio, created_at')
    .eq('id', userId)
    .single()

  if (error || !data) {
    return NextResponse.json({ profile: {} })
  }

  let lastWeight: number | null = null
  try {
    const { data: m } = await supabase
      .from('body_measurements')
      .select('weight_kg')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single()
    lastWeight = m?.weight_kg ?? null
  } catch {
    // body_measurements table doesn't exist yet — OK
  }

  return NextResponse.json({
    profile: {
      age:      data.age,
      heightCm: data.height_cm,
      weightKg: lastWeight ?? data.weight_kg ?? null,
      location: data.location,
      level:    data.level,
      bio:      data.bio,
    }
  })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  const ALLOWED = ['age', 'height_cm', 'weight_kg', 'location', 'level', 'bio']

  for (const key of ALLOWED) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  updates.updated_at = new Date().toISOString()

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
