import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserId, unauthorized } from '@/lib/api-auth'
import { forbidden, hasClientAccess } from '@/lib/trainer'
import { MACRO_SUMMARY_SELECT, toMacroSummary, type MacroSummaryRow } from '@/lib/plans'

/** Macrocycles the trainer has built for this client, newest start first. */
export async function GET(_req: NextRequest, { params }: { params: { clientId: string } }) {
  const userId = await getUserId()
  if (!userId) return unauthorized()
  if (!await hasClientAccess(userId, params.clientId)) return forbidden()

  const { data, error } = await supabaseAdmin()
    .from('macrocycles')
    .select(MACRO_SUMMARY_SELECT)
    .eq('trainer_id', userId)
    .eq('client_id', params.clientId)
    .order('start_date', { ascending: false })

  if (error) {
    console.error('Plans fetch error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const plans = ((data ?? []) as unknown as MacroSummaryRow[]).map(toMacroSummary)

  return NextResponse.json({ plans })
}
