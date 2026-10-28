import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ensureProfile, getUserId, unauthorized } from '@/lib/api-auth'
import { forbidden, generateInviteCode, getRole } from '@/lib/trainer'

/** Creates a single-use invite code the client types in on their phone. */
export async function POST() {
  const userId = await getUserId()
  if (!userId) return unauthorized()
  await ensureProfile(userId)
  if (await getRole(userId) !== 'trainer') return forbidden('Tylko dla trenerów')

  const supabase = supabaseAdmin()
  // Retry on the (unlikely) unique-code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from('coach_clients')
      .insert({ trainer_id: userId, invite_code: generateInviteCode() })
      .select('id, invite_code, expires_at, created_at')
      .single()

    if (data) {
      return NextResponse.json({
        invite: { id: data.id, code: data.invite_code, expiresAt: data.expires_at, createdAt: data.created_at },
      })
    }
    if (error?.code !== '23505') {
      console.error('Invite create error:', error)
      break
    }
  }

  return NextResponse.json({ error: 'Nie udało się utworzyć zaproszenia' }, { status: 500 })
}
