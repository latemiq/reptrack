import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { generateRegistrationOptions, verifyRegistrationResponse, type RegistrationResponseJSON } from '@simplewebauthn/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getSessionIgnoringMfa, getUserId, unauthorized } from '@/lib/api-auth'
import {
  checkEmailCode, checkTotp, decrypt, encrypt, getMfaState, hashCode, invalidateMfaState, markSessionVerified,
  newEmailCode, newTotpSecret, regenerateBackupCodes, relyingParty, storeChallenge, takeChallenge, totpUri,
} from '@/lib/mfa'
import { mailConfigured, sendMail } from '@/lib/mailer'

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

/**
 * Turning 2FA methods on and off. Requires a fully signed-in session — when 2FA
 * is already on, getUserId() demands that this session passed it, so an attacker
 * with only the password can't add their own method or switch 2FA off.
 * Body: { action, ...params }.
 */
export async function POST(req: NextRequest) {
  const userId = await getUserId()
  const session = await getSessionIgnoringMfa()
  if (!userId || !session || userId === 'dev_user') return unauthorized()
  const sessionId = session.sessionId ?? ''

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const supabase = supabaseAdmin()
  const now = new Date().toISOString()

  // The first method switched on gets backup codes, and this session counts as verified
  // so enabling 2FA doesn't immediately lock the user out of the page they are on.
  const afterEnable = async (wasEnabled: boolean) => {
    invalidateMfaState(userId)
    markSessionVerified(userId, sessionId)
    return wasEnabled ? null : regenerateBackupCodes(userId)
  }
  // Last method switched off → 2FA is off; drop the now useless backup codes.
  const afterDisable = async () => {
    invalidateMfaState(userId)
    if (!(await getMfaState(userId)).enabled) await supabase.from('mfa_backup_codes').delete().eq('user_id', userId)
  }

  try {
    const before = await getMfaState(userId)

    switch (body.action) {
      // ── Authenticator app ──
      case 'totp_setup': {
        const user = await currentUser()
        const secret = newTotpSecret()
        await supabase.from('mfa_settings').upsert(
          { user_id: userId, totp_pending_secret: encrypt(secret), updated_at: now }, { onConflict: 'user_id' })
        return NextResponse.json({ secret, uri: totpUri(user?.primaryEmailAddress?.emailAddress ?? 'RepTrack', secret) })
      }
      case 'totp_enable': {
        const { data } = await supabase.from('mfa_settings').select('totp_pending_secret').eq('user_id', userId).maybeSingle()
        if (!data?.totp_pending_secret) return bad('Zacznij konfigurację od nowa.')
        const secret = decrypt(data.totp_pending_secret)
        if (!checkTotp(String(body.code ?? ''), secret)) return bad('Nieprawidłowy kod. Wpisz aktualny kod z aplikacji.')
        await supabase.from('mfa_settings').update({
          totp_secret: data.totp_pending_secret, totp_pending_secret: null, totp_enabled: true, updated_at: now,
        }).eq('user_id', userId)
        return NextResponse.json({ backupCodes: await afterEnable(before.enabled) })
      }
      case 'totp_disable': {
        await supabase.from('mfa_settings').update({ totp_secret: null, totp_enabled: false, updated_at: now }).eq('user_id', userId)
        await afterDisable()
        return NextResponse.json({ success: true })
      }

      // ── Passkeys (fingerprint / Face ID) ──
      case 'passkey_options': {
        const { rpID, rpName } = relyingParty()
        const user = await currentUser()
        const { data: existing } = await supabase.from('mfa_passkeys').select('credential_id, transports').eq('user_id', userId)
        const options = await generateRegistrationOptions({
          rpName,
          rpID,
          userName: user?.primaryEmailAddress?.emailAddress ?? userId,
          userDisplayName: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || undefined,
          userID: new TextEncoder().encode(userId),
          attestationType: 'none',
          excludeCredentials: (existing ?? []).map(c => ({ id: c.credential_id, transports: c.transports as never })),
          authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
        })
        await storeChallenge(userId, 'passkey_register', options.challenge, 5)
        return NextResponse.json({ options })
      }
      case 'passkey_register': {
        const challenge = await takeChallenge(userId, 'passkey_register')
        if (!challenge) return bad('Czas na dodanie klucza minął. Spróbuj ponownie.')
        const { rpID, origin } = relyingParty()
        const result = await verifyRegistrationResponse({
          response: body.response as RegistrationResponseJSON,
          expectedChallenge: challenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          requireUserVerification: true,
        })
        if (!result.verified) return bad('Nie udało się zweryfikować klucza.')
        const { credential } = result.registrationInfo
        await supabase.from('mfa_passkeys').insert({
          user_id: userId,
          credential_id: credential.id,
          public_key: Buffer.from(credential.publicKey).toString('base64url'),
          counter: credential.counter,
          transports: credential.transports ?? [],
          name: typeof body.name === 'string' ? body.name.slice(0, 60) : null,
        })
        return NextResponse.json({ backupCodes: await afterEnable(before.enabled) })
      }
      case 'passkey_delete': {
        await supabase.from('mfa_passkeys').delete().eq('id', String(body.id ?? '')).eq('user_id', userId)
        await afterDisable()
        return NextResponse.json({ success: true })
      }

      // ── Email code ──
      case 'email_send': {
        const user = await currentUser()
        const email = user?.primaryEmailAddress?.emailAddress
        if (!email || !mailConfigured()) return bad('Wysyłka maili nie jest skonfigurowana.', 503)
        const code = newEmailCode()
        await storeChallenge(userId, 'email_enable', hashCode(code), 10)
        await sendMail(email, `RepTrack — kod ${code}`, `Twój kod do włączenia weryfikacji dwuetapowej: ${code}\n\nKod jest ważny 10 minut. Jeśli to nie Ty, zignoruj tę wiadomość.`)
        return NextResponse.json({ success: true })
      }
      case 'email_enable': {
        if (!(await checkEmailCode(userId, 'email_enable', String(body.code ?? '')))) return bad('Nieprawidłowy lub wygasły kod.')
        await supabase.from('mfa_settings').upsert({ user_id: userId, email_enabled: true, updated_at: now }, { onConflict: 'user_id' })
        return NextResponse.json({ backupCodes: await afterEnable(before.enabled) })
      }
      case 'email_disable': {
        await supabase.from('mfa_settings').update({ email_enabled: false, updated_at: now }).eq('user_id', userId)
        await afterDisable()
        return NextResponse.json({ success: true })
      }

      case 'backup_regenerate': {
        if (!before.enabled) return bad('Najpierw włącz weryfikację dwuetapową.')
        return NextResponse.json({ backupCodes: await regenerateBackupCodes(userId) })
      }

      default:
        return bad('Nieznana akcja')
    }
  } catch (err) {
    console.error('MFA manage error:', err)
    return bad('Operacja nie powiodła się. Spróbuj ponownie.', 500)
  }
}
