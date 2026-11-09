import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { generateAuthenticationOptions, verifyAuthenticationResponse, type AuthenticationResponseJSON } from '@simplewebauthn/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getSessionIgnoringMfa, unauthorized } from '@/lib/api-auth'
import {
  checkEmailCode, checkTotp, decrypt, getMfaState, hashCode, lockedUntil, markSessionVerified, newEmailCode,
  recordFailure, recordSuccess, relyingParty, storeChallenge, takeChallenge, redeemBackupCode,
} from '@/lib/mfa'
import { mailConfigured, sendMail } from '@/lib/mailer'

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

/**
 * The second step after a Clerk sign-in. Works with a signed-in Clerk session that
 * hasn't passed 2FA yet; on success sets the signed rt_mfa cookie for this session.
 * Body: { action: 'passkey_options' | 'passkey' | 'totp' | 'backup' | 'email_send' | 'email', ... }.
 * Wrong codes count towards a 15-minute lock after 5 failures.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionIgnoringMfa()
  if (!session?.sessionId) return unauthorized()
  const { userId, sessionId } = session

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const supabase = supabaseAdmin()

  try {
    const state = await getMfaState(userId)
    if (!state.enabled) return bad('Weryfikacja dwuetapowa nie jest włączona.')
    const locked = await lockedUntil(userId)
    if (locked) {
      return bad(`Zbyt wiele nieudanych prób. Spróbuj po ${locked.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' })}.`, 429)
    }

    const pass = async () => {
      await recordSuccess(userId)
      markSessionVerified(userId, sessionId)
      return NextResponse.json({ success: true })
    }
    const fail = async (msg: string) => {
      await recordFailure(userId)
      return bad(msg)
    }

    switch (body.action) {
      case 'passkey_options': {
        if (!state.passkeys) return bad('Brak zapisanych kluczy dostępu.')
        const { data: creds } = await supabase.from('mfa_passkeys').select('credential_id, transports').eq('user_id', userId)
        const options = await generateAuthenticationOptions({
          rpID: relyingParty().rpID,
          allowCredentials: (creds ?? []).map(c => ({ id: c.credential_id, transports: c.transports as never })),
          userVerification: 'required',
        })
        await storeChallenge(userId, 'passkey_auth', options.challenge, 5)
        return NextResponse.json({ options })
      }
      case 'passkey': {
        const response = body.response as AuthenticationResponseJSON | undefined
        const challenge = await takeChallenge(userId, 'passkey_auth')
        if (!challenge || !response?.id) return bad('Czas minął. Spróbuj ponownie.')
        const { data: cred } = await supabase.from('mfa_passkeys')
          .select('id, credential_id, public_key, counter, transports')
          .eq('user_id', userId).eq('credential_id', response.id).maybeSingle()
        if (!cred) return fail('Ten klucz nie należy do tego konta.')
        const { rpID, origin } = relyingParty()
        const result = await verifyAuthenticationResponse({
          response,
          expectedChallenge: challenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          requireUserVerification: true,
          credential: {
            id: cred.credential_id,
            publicKey: new Uint8Array(Buffer.from(cred.public_key, 'base64url')),
            counter: Number(cred.counter),
            transports: cred.transports as never,
          },
        })
        if (!result.verified) return fail('Nie udało się zweryfikować klucza.')
        await supabase.from('mfa_passkeys')
          .update({ counter: result.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
          .eq('id', cred.id)
        return pass()
      }
      case 'totp': {
        if (!state.totp) return bad('Aplikacja uwierzytelniająca nie jest włączona.')
        const { data } = await supabase.from('mfa_settings').select('totp_secret').eq('user_id', userId).maybeSingle()
        if (!data?.totp_secret) return bad('Aplikacja uwierzytelniająca nie jest włączona.')
        return checkTotp(String(body.code ?? ''), decrypt(data.totp_secret)) ? pass() : fail('Nieprawidłowy kod z aplikacji.')
      }
      case 'backup':
        return (await redeemBackupCode(userId, String(body.code ?? ''))) ? pass() : fail('Nieprawidłowy lub już użyty kod zapasowy.')
      case 'email_send': {
        if (!state.email) return bad('Kod mailowy nie jest włączony.')
        const email = (await currentUser())?.primaryEmailAddress?.emailAddress
        if (!email || !mailConfigured()) return bad('Wysyłka maili nie jest skonfigurowana.', 503)
        const code = newEmailCode()
        await storeChallenge(userId, 'email_auth', hashCode(code), 10)
        await sendMail(email, `RepTrack — kod logowania ${code}`, `Twój kod logowania do RepTrack: ${code}\n\nKod jest ważny 10 minut. Jeśli to nie Ty próbujesz się zalogować, zmień hasło.`)
        return NextResponse.json({ success: true })
      }
      case 'email': {
        if (!state.email) return bad('Kod mailowy nie jest włączony.')
        return (await checkEmailCode(userId, 'email_auth', String(body.code ?? ''))) ? pass() : fail('Nieprawidłowy lub wygasły kod.')
      }
      default:
        return bad('Nieznana akcja')
    }
  } catch (err) {
    console.error('MFA verify error:', err)
    return bad('Weryfikacja nie powiodła się. Spróbuj ponownie.', 500)
  }
}
