import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserId, unauthorized } from '@/lib/api-auth'
import { forbidden, hasClientAccess } from '@/lib/trainer'
import { MACRO_TREE_SELECT, isUuid, macroFromRow, sanitizeMacrocycle, type MacroDbRow } from '@/lib/plans'

const notFound = () => NextResponse.json({ error: 'Nie znaleziono planu' }, { status: 404 })

async function ownedMacro(trainerId: string, id: string) {
  const { data } = await supabaseAdmin()
    .from('macrocycles')
    .select('id, client_id')
    .eq('id', id)
    .eq('trainer_id', trainerId)
    .maybeSingle()
  return data
}

/** Full plan tree. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId()
  if (!userId) return unauthorized()
  if (!isUuid(params.id)) return notFound()

  const { data, error } = await supabaseAdmin()
    .from('macrocycles')
    .select(MACRO_TREE_SELECT)
    .eq('id', params.id)
    .eq('trainer_id', userId)
    .maybeSingle()

  if (error) {
    console.error('Plan fetch error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
  if (!data) return notFound()
  if (!await hasClientAccess(userId, data.client_id)) return forbidden()

  return NextResponse.json({ plan: macroFromRow(data as unknown as MacroDbRow) })
}

/** Creates or replaces the whole plan tree. Body: Macrocycle (id from the URL, clientId required). */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId()
  if (!userId) return unauthorized()
  if (!isUuid(params.id)) return notFound()

  const body = await req.json().catch(() => null)
  const clientId = typeof body?.clientId === 'string' ? body.clientId : ''
  if (!clientId || !await hasClientAccess(userId, clientId)) return forbidden()

  const existing = await ownedMacro(userId, params.id)
  if (existing && existing.client_id !== clientId) return forbidden()

  const result = sanitizeMacrocycle(body)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })

  const { error } = await supabaseAdmin().rpc('save_macrocycle', {
    p: { ...result.plan, id: params.id, trainerId: userId, clientId },
  })

  if (error) {
    console.error('Plan save error:', error)
    // 23505: a node ID collides with a row of another plan.
    const status = error.code === '23505' || error.code === 'P0001' ? 409 : 500
    return NextResponse.json({ error: 'Zapis planu nie powiódł się' }, { status })
  }

  return NextResponse.json({ id: params.id, savedAt: new Date().toISOString() })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId()
  if (!userId) return unauthorized()
  if (!isUuid(params.id)) return notFound()

  const { error } = await supabaseAdmin()
    .from('macrocycles')
    .delete()
    .eq('id', params.id)
    .eq('trainer_id', userId)

  if (error) {
    console.error('Plan delete error:', error)
    return NextResponse.json({ error: 'Usuwanie nie powiodło się' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
