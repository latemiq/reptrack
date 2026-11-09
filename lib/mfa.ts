// Own second-factor layer on top of Clerk's free plan.
// Clerk proves the password; RepTrack then asks for a passkey (WebAuthn), an
// authenticator-app code (TOTP) or an emailed code, and records success in an
// HMAC-signed cookie bound to the Clerk session. getUserId() (lib/api-auth)
// refuses API access until that cookie is present for users who enabled 2FA.

import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, randomInt, timingSafeEqual } from 'crypto'
import { cookies, headers } from 'next/headers'
import { authenticator } from 'otplib'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const MFA_COOKIE = 'rt_mfa'
const COOKIE_DAYS = 30
const MAX_FAILURES = 5
const LOCK_MINUTES = 15

authenticator.options = { window: 1 } // accept the previous/next 30 s code (clock drift)

// ─── Keys ───────────────────────────────────────────────────────────────────

let keys: { enc: Buffer; mac: Buffer } | null = null

/** Keys derived from MFA_SECRET. Throws if it is missing, so 2FA fails closed. */
function getKeys() {
  if (keys) return keys
  const secret = process.env.MFA_SECRET
  if (!secret || secret.length < 32) throw new Error('MFA_SECRET is missing or shorter than 32 characters')
  const derive = (info: string) => Buffer.from(hkdfSync('sha256', secret, 'reptrack-mfa', info, 32))
  keys = { enc: derive('encryption'), mac: derive('cookie-mac') }
  return keys
}

const b64u = (b: Buffer) => b.toString('base64url')
const hmac = (data: string) => createHmac('sha256', getKeys().mac).update(data).digest()

export function encrypt(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKeys().enc, iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return ['v1', b64u(iv), b64u(cipher.getAuthTag()), b64u(ct)].join('.')
}

export function decrypt(payload: string): string {
  const [v, iv, tag, ct] = payload.split('.')
  if (v !== 'v1') throw new Error('Unknown ciphertext version')
  const decipher = createDecipheriv('aes-256-gcm', getKeys().enc, Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString('utf8')
}

/** Keyed hash for backup and email codes (never stored in plain text). */
export const hashCode = (code: string) => b64u(hmac(`code:${normalizeCode(code)}`))
export const normalizeCode = (code: string) => code.toLowerCase().replace(/[\s-]/g, '')

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

// ─── Session cookie ─────────────────────────────────────────────────────────

function sign(userId: string, sessionId: string, exp: number) {
  const body = b64u(Buffer.from(JSON.stringify({ u: userId, s: sessionId, e: exp })))
  return `${body}.${b64u(hmac(body))}`
}

function readCookie(userId: string, sessionId: string): boolean {
  const raw = cookies().get(MFA_COOKIE)?.value
  if (!raw) return false
  const [body, sig] = raw.split('.')
  if (!body || !sig || !safeEqual(sig, b64u(hmac(body)))) return false
  try {
    const { u, s, e } = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    return u === userId && s === sessionId && typeof e === 'number' && e > Date.now()
  } catch {
    return false
  }
}

/** Marks the current Clerk session as having passed the second step. Call from route handlers only. */
export function markSessionVerified(userId: string, sessionId: string) {
  const exp = Date.now() + COOKIE_DAYS * 86400000
  cookies().set(MFA_COOKIE, sign(userId, sessionId, exp), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_DAYS * 86400,
  })
}

// ─── State ──────────────────────────────────────────────────────────────────

export interface MfaState {
  totp: boolean
  email: boolean
  passkeys: number
  enabled: boolean
}

// Short per-instance cache: getUserId() runs on every API request.
const stateCache = new Map<string, { state: MfaState; at: number }>()
const CACHE_MS = 15000

export function invalidateMfaState(userId: string) {
  stateCache.delete(userId)
}

export async function getMfaState(userId: string): Promise<MfaState> {
  const hit = stateCache.get(userId)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.state
  const supabase = supabaseAdmin()
  const [{ data: s, error: sErr }, { count, error: pErr }] = await Promise.all([
    supabase.from('mfa_settings').select('totp_enabled, email_enabled').eq('user_id', userId).maybeSingle(),
    supabase.from('mfa_passkeys').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ])
  const err = sErr ?? pErr
  // Tables not created yet (schema.sql not run): nobody can have enabled 2FA, so it is off.
  // Any other error fails closed: if we can't tell whether 2FA is on, don't treat it as off.
  if (err && !['PGRST205', '42P01'].includes(err.code)) throw new Error(`MFA state lookup failed: ${err.message}`)
  const state = { totp: !!s?.totp_enabled, email: !!s?.email_enabled, passkeys: count ?? 0, enabled: false }
  state.enabled = state.totp || state.email || state.passkeys > 0
  stateCache.set(userId, { state, at: Date.now() })
  return state
}

/** True when the user has no 2FA, or this session already passed it. */
export async function isMfaSatisfied(userId: string, sessionId: string | null): Promise<boolean> {
  const state = await getMfaState(userId)
  if (!state.enabled) return true
  return !!sessionId && readCookie(userId, sessionId)
}

// ─── Brute-force protection ─────────────────────────────────────────────────

export async function lockedUntil(userId: string): Promise<Date | null> {
  const { data } = await supabaseAdmin().from('mfa_settings').select('locked_until').eq('user_id', userId).maybeSingle()
  const until = data?.locked_until ? new Date(data.locked_until) : null
  return until && until.getTime() > Date.now() ? until : null
}

export async function recordFailure(userId: string) {
  const supabase = supabaseAdmin()
  const { data } = await supabase.from('mfa_settings').select('failed_attempts').eq('user_id', userId).maybeSingle()
  const failures = (data?.failed_attempts ?? 0) + 1
  const lock = failures >= MAX_FAILURES
  await supabase.from('mfa_settings').upsert({
    user_id: userId,
    failed_attempts: lock ? 0 : failures,
    locked_until: lock ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
}

export async function recordSuccess(userId: string) {
  await supabaseAdmin().from('mfa_settings')
    .update({ failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
}

// ─── TOTP ───────────────────────────────────────────────────────────────────

export const newTotpSecret = () => authenticator.generateSecret()
export const totpUri = (account: string, secret: string) => authenticator.keyuri(account, 'RepTrack', secret)
export const checkTotp = (code: string, secret: string) => authenticator.check(code.replace(/\s/g, ''), secret)

// ─── Backup codes ───────────────────────────────────────────────────────────

const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

/** Replaces the user's backup codes and returns the new plain codes (shown once). */
export async function regenerateBackupCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: 10 }, () => {
    const c = Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('')
    return `${c.slice(0, 4)}-${c.slice(4)}`
  })
  const supabase = supabaseAdmin()
  await supabase.from('mfa_backup_codes').delete().eq('user_id', userId)
  await supabase.from('mfa_backup_codes').insert(codes.map(c => ({ user_id: userId, code_hash: hashCode(c) })))
  return codes
}

export async function redeemBackupCode(userId: string, code: string): Promise<boolean> {
  // used_at filter in the update makes a code single-use even under concurrent requests.
  const { data } = await supabaseAdmin().from('mfa_backup_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', userId).eq('code_hash', hashCode(code)).is('used_at', null)
    .select('id')
  return (data?.length ?? 0) > 0
}

// ─── Challenges (WebAuthn, email codes) ─────────────────────────────────────

type ChallengeKind = 'passkey_register' | 'passkey_auth' | 'email_enable' | 'email_auth'

export async function storeChallenge(userId: string, kind: ChallengeKind, value: string, ttlMinutes: number) {
  const supabase = supabaseAdmin()
  await supabase.from('mfa_challenges').delete().eq('user_id', userId).eq('kind', kind)
  await supabase.from('mfa_challenges').insert({
    user_id: userId, kind, value, expires_at: new Date(Date.now() + ttlMinutes * 60000).toISOString(),
  })
}

/** Returns the latest unexpired challenge and deletes it (single use). */
export async function takeChallenge(userId: string, kind: ChallengeKind): Promise<string | null> {
  const supabase = supabaseAdmin()
  const { data } = await supabase.from('mfa_challenges').select('id, value, expires_at')
    .eq('user_id', userId).eq('kind', kind).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!data) return null
  await supabase.from('mfa_challenges').delete().eq('id', data.id)
  return new Date(data.expires_at).getTime() > Date.now() ? data.value : null
}

/** Checks an emailed code; the challenge survives wrong guesses up to 5 attempts. */
export async function checkEmailCode(userId: string, kind: 'email_enable' | 'email_auth', code: string): Promise<boolean> {
  const supabase = supabaseAdmin()
  const { data } = await supabase.from('mfa_challenges').select('id, value, attempts, expires_at')
    .eq('user_id', userId).eq('kind', kind).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!data || new Date(data.expires_at).getTime() < Date.now() || data.attempts >= MAX_FAILURES) return false
  if (safeEqual(data.value, hashCode(code))) {
    await supabase.from('mfa_challenges').delete().eq('id', data.id)
    return true
  }
  await supabase.from('mfa_challenges').update({ attempts: data.attempts + 1 }).eq('id', data.id)
  return false
}

export const newEmailCode = () => String(randomInt(0, 1000000)).padStart(6, '0')

// ─── WebAuthn relying party ─────────────────────────────────────────────────

/** RP ID and origin of the current request (localhost in dev, the Vercel domain in production). */
export function relyingParty() {
  const h = headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return { rpID: host.split(':')[0], origin: `${proto}://${host}`, rpName: 'RepTrack' }
}
