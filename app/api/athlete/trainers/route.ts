import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ensureProfile, getUserId, unauthorized } from '@/lib/api-auth'
import { PERSON_COLUMNS, normalizeInviteCode, toPersonSummary } from '@/lib/trainer'

/** Trainers the current user is actively connected to. */
export async function GET() {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const supabase = supabaseAdmin()
  const { data: relations, error } = await supabase
    .from('coach_clients')
    .select('id, trainer_id, accepted_at')
    .eq('client_id', userId)
    .eq('status', 'active')
    .order('accepted_at', { ascending: false })

  if (error) {
    console.error('Athlete trainers fetch error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
  if (!relations?.length) return NextResponse.json({ trainers: [] })

  const { data: profiles } = await supabase
    .from('profiles')
    .select(PERSON_COLUMNS)
    .in('id', relations.map(r => r.trainer_id))

  return NextResponse.json({
    trainers: relations.map(r => {
      const p = profiles?.find(x => x.id === r.trainer_id)
      return {
        relationId: r.id,
        ...(p ? toPersonSummary(p) : { id: r.trainer_id, name: 'Trener', email: null, imageUrl: null }),
        since: r.accepted_at,
      }
    }),
  })
}

/** Redeems a trainer's invite code: { code }. */
export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const body = await req.json().catch(() => null)
  const code = normalizeInviteCode(body?.code)
  if (!code) return NextResponse.json({ error: 'Nieprawidłowy kod' }, { status: 400 })

  await ensureProfile(userId)
  const supabase = supabaseAdmin()
  const { data: invite } = await supabase
    .from('coach_clients')
    .select('id, trainer_id, expires_at')
    .eq('invite_code', code)
    .eq('status', 'pending')
    .maybeSingle()

  if (!invite || new Date(invite.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Kod nie istnieje albo wygasł' }, { status: 404 })
  }
  if (invite.trainer_id === userId) {
    return NextResponse.json({ error: 'Nie możesz zostać własnym podopiecznym' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('coach_clients')
    .select('id')
    .eq('trainer_id', invite.trainer_id)
    .eq('client_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  if (existing) return NextResponse.json({ error: 'Już współpracujesz z tym trenerem' }, { status: 409 })

  // status=pending in the filter makes redemption single-use even under concurrent requests.
  const { data: accepted, error } = await supabase
    .from('coach_clients')
    .update({ client_id: userId, status: 'active', accepted_at: new Date().toISOString() })
    .eq('id', invite.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (error || !accepted) {
    console.error('Invite accept error:', error)
    return NextResponse.json({ error: 'Nie udało się użyć kodu' }, { status: 409 })
  }
  return NextResponse.json({ success: true })
}
