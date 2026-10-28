import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserId, unauthorized } from '@/lib/api-auth'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const { data, error } = await supabaseAdmin()
    .from('coach_messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', params.id)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Messages fetch error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ messages: data ?? [] })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const { error } = await supabaseAdmin()
    .from('coach_conversations')
    .delete()
    .eq('id', params.id)
    .eq('user_id', userId)

  if (error) {
    console.error('Conversation delete error:', error)
    return NextResponse.json({ error: 'Usuwanie nie powiodło się' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
