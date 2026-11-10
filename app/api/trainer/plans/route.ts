import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserId, unauthorized } from '@/lib/api-auth'
import { forbidden, getActiveClients, getRole } from '@/lib/trainer'
import { MACRO_SUMMARY_SELECT, toMacroSummary, type MacroSummaryRow } from '@/lib/plans'

/** All macrocycles of the trainer's active clients, with client names. */
export async function GET() {
  const userId = await getUserId()
  if (!userId) return unauthorized()
  if (await getRole(userId) !== 'trainer') return forbidden('Tylko dla trenerów')

  const clients = await getActiveClients(userId)
  if (clients.length === 0) return NextResponse.json({ plans: [], clients: [] })

  const { data, error } = await supabaseAdmin()
    .from('macrocycles')
    .select(MACRO_SUMMARY_SELECT)
    .eq('trainer_id', userId)
    .in('client_id', clients.map(c => c.id))
    .order('start_date', { ascending: false })

  if (error) {
    console.error('Trainer plans fetch error:', error)
    return NextResponse.json({ error: 'Błąd bazy danych. Spróbuj ponownie.' }, { status: 500 })
  }

  const plans = ((data ?? []) as unknown as MacroSummaryRow[]).map(r => {
    const client = clients.find(c => c.id === r.client_id)
    return { ...toMacroSummary(r), clientId: r.client_id, clientName: client?.name ?? 'Bez nazwy' }
  })

  return NextResponse.json({ plans, clients: clients.map(c => ({ id: c.id, name: c.name })) })
}
