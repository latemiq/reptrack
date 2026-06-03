import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export const revalidate = 3600

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('exercises')
    .select('id, catalog_id, name, source, level, force, mechanic, equipment, primary_muscles, secondary_muscles, instructions, category, images')
    .or(`source.eq.catalog,user_id.eq.${userId}`)
    .order('name', { ascending: true })

  if (error) {
    console.error('Atlas fetch error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ exercises: data ?? [] })
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  const name = (body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'Nazwa jest wymagana' }, { status: 400 })

  const primary_muscles: string[] = Array.isArray(body.primary_muscles) ? body.primary_muscles : []
  const secondary_muscles: string[] = Array.isArray(body.secondary_muscles) ? body.secondary_muscles : []
  const instructions: string[] = Array.isArray(body.instructions)
    ? body.instructions.map((s: string) => s.trim()).filter(Boolean)
    : []

  const { data, error } = await supabase
    .from('exercises')
    .insert({
      user_id: userId,
      source: 'custom',
      is_custom: true,
      name,
      category: body.category ?? null,
      level: body.level ?? null,
      force: body.force ?? null,
      mechanic: body.mechanic ?? null,
      equipment: body.equipment ?? null,
      muscle_group: body.muscle_group ?? null,
      primary_muscles,
      secondary_muscles,
      instructions,
      images: [],
    })
    .select('id, catalog_id, name, source, level, force, mechanic, equipment, primary_muscles, secondary_muscles, instructions, category, images')
    .single()

  if (error) {
    console.error('Exercise insert error:', error)
    return NextResponse.json({ error: 'Błąd zapisu' }, { status: 500 })
  }

  return NextResponse.json({ exercise: data }, { status: 201 })
}
