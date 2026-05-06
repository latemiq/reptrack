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
