import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserId, unauthorized } from '@/lib/api-auth'
import { forbidden, hasClientAccess } from '@/lib/trainer'
import type { Focus, MacrocycleSummary } from '@/lib/plans'

interface SummaryRow {
  id: string
  name: string
  goal: string | null
  start_date: string
  updated_at: string | null
  mesocycles: { position: number; name: string; focus: Focus | null; microcycles: { id: string }[] }[]
}

/** Macrocycles the trainer has built for this client, newest start first. */
export async function GET(_req: NextRequest, { params }: { params: { clientId: string } }) {
  const userId = await getUserId()
  if (!userId) return unauthorized()
  if (!await hasClientAccess(userId, params.clientId)) return forbidden()

  const { data, error } = await supabaseAdmin()
    .from('macrocycles')
    .select('id, name, goal, start_date, updated_at, mesocycles(position, name, focus, microcycles(id))')
    .eq('trainer_id', userId)
    .eq('client_id', params.clientId)
    .order('start_date', { ascending: false })

  if (error) {
    console.error('Plans fetch error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const plans: MacrocycleSummary[] = ((data ?? []) as SummaryRow[]).map(r => {
    const mesocycles = [...r.mesocycles]
      .sort((a, b) => a.position - b.position)
      .map(m => ({ name: m.name, focus: m.focus, weeks: m.microcycles.length }))
    return {
      id: r.id,
      name: r.name,
      goal: r.goal,
      startDate: r.start_date,
      weeks: mesocycles.reduce((s, m) => s + m.weeks, 0),
      mesocycles,
      updatedAt: r.updated_at,
    }
  })

  return NextResponse.json({ plans })
}
