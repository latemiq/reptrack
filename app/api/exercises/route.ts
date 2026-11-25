import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserId, unauthorized } from '@/lib/api-auth'
// Polish names/instructions for catalog exercises (scripts/translate-exercises.ts), keyed by catalog_id.
import translationsPl from '@/data/exercises-pl.json'

const PL = translationsPl as Record<string, { name: string; instructions: string[] }>

export const revalidate = 3600

const FULL = 'id, catalog_id, name, source, level, force, mechanic, equipment, primary_muscles, secondary_muscles, instructions, category, images'
// For pickers (the mobile workout screen): names and muscles only, a fraction of the size.
const LITE = 'id, catalog_id, name, source, primary_muscles, secondary_muscles, category'

/** ?lite=1 returns only what an exercise picker needs. */
export async function GET(req: Request) {
  const userId = await getUserId()
  if (!userId) return unauthorized()
  const supabase = supabaseAdmin()
  const lite = new URL(req.url).searchParams.get('lite') === '1'

  const { data, error } = await supabase
    .from('exercises')
    // Column list chosen at runtime; the typed select parser only accepts literals.
    .select((lite ? LITE : FULL) as '*')
    .or(`source.eq.catalog,user_id.eq.${userId}`)
    .order('name', { ascending: true })

  if (error) {
    console.error('Atlas fetch error:', error)
    return NextResponse.json({ error: 'Błąd bazy danych. Spróbuj ponownie.' }, { status: 500 })
  }

  // Show catalog exercises in Polish; keep the English name for search (name_en).
  const exercises = (data ?? []).map(e => {
    const pl = e.catalog_id ? PL[e.catalog_id] : undefined
    if (!pl) return e
    return lite ? { ...e, name: pl.name, name_en: e.name } : { ...e, name: pl.name, name_en: e.name, instructions: pl.instructions.length ? pl.instructions : (e as { instructions?: string[] }).instructions }
  }).sort((a, b) => a.name.localeCompare(b.name, 'pl'))

  return NextResponse.json({ exercises })
}

export async function POST(request: Request) {
  const userId = await getUserId()
  if (!userId) return unauthorized()
  const supabase = supabaseAdmin()

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
