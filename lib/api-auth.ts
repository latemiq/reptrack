import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

import { AUTH_BYPASS } from '@/lib/auth-bypass'
import { isMfaSatisfied } from '@/lib/mfa'

export { AUTH_BYPASS }
// Dev bypass identity; DEV_BYPASS_USER_ID lets a local preview act as e.g. a seeded demo client.
const DEV_USER_ID = process.env.DEV_BYPASS_USER_ID || 'dev_user'

/**
 * Clerk user + session, ignoring the RepTrack second step. Only for the 2FA
 * endpoints themselves (status, verify, sign-out) — everything else uses getUserId().
 */
export async function getSessionIgnoringMfa(): Promise<{ userId: string; sessionId: string | null } | null> {
  const { userId, sessionId } = await auth()
  if (userId) return { userId, sessionId }
  return AUTH_BYPASS ? { userId: DEV_USER_ID, sessionId: null } : null
}

/**
 * Clerk user ID, or a fixed dev ID when NEXT_PUBLIC_BYPASS_AUTH=true.
 * Returns null for users with 2FA enabled until this session passed the second step,
 * so every API route behind it is protected by 2FA.
 */
export async function getUserId(): Promise<string | null> {
  const session = await getSessionIgnoringMfa()
  if (!session) return null
  if (session.userId === DEV_USER_ID) return session.userId
  try {
    return (await isMfaSatisfied(session.userId, session.sessionId)) ? session.userId : null
  } catch (err) {
    console.error('MFA check failed:', err)
    return null
  }
}

export const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

/**
 * Makes sure a profiles row exists. The Clerk webhook normally creates it,
 * but it can't reach localhost — so API routes create it lazily too.
 */
export async function ensureProfile(userId: string) {
  const supabase = supabaseAdmin()
  const { data } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle()
  if (data) return

  const row: Record<string, unknown> = { id: userId }
  if (userId !== DEV_USER_ID) {
    const user = await currentUser().catch(() => null)
    if (user) {
      row.email      = user.primaryEmailAddress?.emailAddress ?? null
      row.first_name = user.firstName
      row.last_name  = user.lastName
      row.image_url  = user.imageUrl
    }
  }
  await supabase.from('profiles').upsert(row, { onConflict: 'id', ignoreDuplicates: true })
}
