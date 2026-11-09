import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getSessionIgnoringMfa, unauthorized } from '@/lib/api-auth'
import { getMfaState, isMfaSatisfied, lockedUntil } from '@/lib/mfa'
import { mailConfigured } from '@/lib/mailer'

/** j***@gmail.com */
const maskEmail = (e: string) => e.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => `${a}${'*'.repeat(Math.min(b.length, 5))}${c}`)

/** 2FA status for the settings card and the verification screen. Works before the second step. */
export async function GET() {
  const session = await getSessionIgnoringMfa()
  // dev_user (login bypass) has no Clerk account to protect.
  if (!session || !session.sessionId) return unauthorized()

  try {
    const state = await getMfaState(session.userId)
    const supabase = supabaseAdmin()
    const [{ data: passkeys }, { count: backupLeft }, user, locked] = await Promise.all([
      supabase.from('mfa_passkeys').select('id, name, created_at, last_used_at').eq('user_id', session.userId).order('created_at'),
      supabase.from('mfa_backup_codes').select('id', { count: 'exact', head: true }).eq('user_id', session.userId).is('used_at', null),
      currentUser().catch(() => null),
      lockedUntil(session.userId),
    ])
    const email = user?.primaryEmailAddress?.emailAddress ?? null

    return NextResponse.json({
      ...state,
      verified: await isMfaSatisfied(session.userId, session.sessionId),
      passkeyList: (passkeys ?? []).map(p => ({ id: p.id, name: p.name, createdAt: p.created_at, lastUsedAt: p.last_used_at })),
      backupCodesLeft: backupLeft ?? 0,
      emailAvailable: mailConfigured() && !!email,
      emailMasked: email ? maskEmail(email) : null,
      lockedUntil: locked?.toISOString() ?? null,
    })
  } catch (err) {
    console.error('MFA status error:', err)
    return NextResponse.json({ error: 'Weryfikacja dwuetapowa jest chwilowo niedostępna' }, { status: 500 })
  }
}
