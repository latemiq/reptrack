import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserId, unauthorized } from '@/lib/api-auth'
import { syncRunningGoals } from '@/lib/goals'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const { data, error } = await supabaseAdmin()
    .from('runs')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('Run fetch error:', error)
    return NextResponse.json({ error: 'Błąd bazy danych. Spróbuj ponownie.' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Nie znaleziono biegu' }, { status: 404 })

  return NextResponse.json({ run: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const { error } = await supabaseAdmin().from('runs').delete().eq('id', params.id).eq('user_id', userId)
  if (error) {
    console.error('Run delete error:', error)
    return NextResponse.json({ error: 'Usuwanie nie powiodło się' }, { status: 500 })
  }

  await syncRunningGoals(userId)
  return NextResponse.json({ success: true })
}
