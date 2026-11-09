import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

import { AUTH_BYPASS } from '@/lib/auth-bypass'

export { AUTH_BYPASS }
const DEV_USER_ID = 'dev_user'

/** Clerk user ID, or a fixed dev ID when NEXT_PUBLIC_BYPASS_AUTH=true. */
export async function getUserId(): Promise<string | null> {
  const { userId } = await auth()
  if (userId) return userId
  return AUTH_BYPASS ? DEV_USER_ID : null
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
