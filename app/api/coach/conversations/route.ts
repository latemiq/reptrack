import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return new NextResponse('Unauthorized', { status: 401 })

  // TODO: fetch from Supabase
  // const conversations = await supabase
  //   .from('coach_conversations')
  //   .select('id, title, category, updated_at')
  //   .eq('user_id', userId)
  //   .order('updated_at', { ascending: false })
  //   .limit(50)

  return NextResponse.json({ conversations: [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return new NextResponse('Unauthorized', { status: 401 })

  const body = await req.json().catch(() => null)
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const category = typeof body?.category === 'string' ? body.category : 'general'

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  // TODO: save to Supabase
  // const { data } = await supabase
  //   .from('coach_conversations')
  //   .insert({ user_id: userId, title, category })
  //   .select()
  //   .single()

  return NextResponse.json({ conversation: { id: crypto.randomUUID(), title, category } })
}
