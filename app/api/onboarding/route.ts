import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { weightKg, heightCm, level, weeklyDays, goals } = body

  const profileUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (weightKg != null) profileUpdates.weight_kg = weightKg
  if (heightCm != null) profileUpdates.height_cm = heightCm
  if (level) profileUpdates.level = level

  await supabase.from('profiles').update(profileUpdates).eq('id', userId)

  if (Array.isArray(goals) && goals.length > 0) {
    const GOAL_MAP: Record<string, { name: string; category: string; type: string; unit: string; target_value: number }> = {
      run:      { name: 'Poprawić bieganie',   category: 'cardio',    type: 'distance', unit: 'km', target_value: 500 },
      strength: { name: 'Zwiększyć siłę',      category: 'strength',  type: 'weight',   unit: 'kg', target_value: 100 },
      weight:   { name: 'Zmienić masę ciała',  category: 'body',      type: 'weight',   unit: 'kg', target_value: weightKg ?? 75 },
    }

    const goalRows = goals
      .filter((g: string) => GOAL_MAP[g])
      .map((g: string) => ({
        user_id:      userId,
        name:         GOAL_MAP[g].name,
        category:     GOAL_MAP[g].category,
        type:         GOAL_MAP[g].type,
        unit:         GOAL_MAP[g].unit,
        target_value: GOAL_MAP[g].target_value,
        start_value:  g === 'weight' ? (weightKg ?? 75) : 0,
        status:       'active',
      }))

    if (goalRows.length > 0) {
      await supabase.from('goals').insert(goalRows)
    }
  }

  return NextResponse.json({ success: true })
}
