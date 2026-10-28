import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserId, unauthorized } from '@/lib/api-auth'

/** Client ends the cooperation with a trainer (by relation id). */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const { error } = await supabaseAdmin()
    .from('coach_clients')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('client_id', userId)
    .eq('status', 'active')

  if (error) {
    console.error('Leave trainer error:', error)
    return NextResponse.json({ error: 'Nie udało się zakończyć współpracy' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
