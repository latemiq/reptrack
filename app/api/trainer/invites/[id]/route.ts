import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserId, unauthorized } from '@/lib/api-auth'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const { error } = await supabaseAdmin()
    .from('coach_clients')
    .delete()
    .eq('id', params.id)
    .eq('trainer_id', userId)
    .eq('status', 'pending')

  if (error) {
    console.error('Invite delete error:', error)
    return NextResponse.json({ error: 'Usuwanie nie powiodło się' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
