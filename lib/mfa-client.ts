// Browser helpers for the RepTrack 2FA endpoints (/api/mfa*).

export interface MfaStatus {
  totp: boolean
  email: boolean
  passkeys: number
  enabled: boolean
  verified: boolean
  passkeyList: { id: string; name: string | null; createdAt: string; lastUsedAt: string | null }[]
  backupCodesLeft: number
  emailAvailable: boolean
  emailMasked: string | null
  lockedUntil: string | null
}

export async function fetchMfaStatus(): Promise<MfaStatus | null> {
  const res = await fetch('/api/mfa', { cache: 'no-store' }).catch(() => null)
  return res?.ok ? res.json() : null
}

export async function mfaPost<T = Record<string, unknown>>(path: 'manage' | 'verify', body: Record<string, unknown>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const res = await fetch(`/api/mfa/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => null)
  const data = await res?.json().catch(() => null)
  if (res?.ok) return { ok: true, data: data as T }
  return { ok: false, error: data?.error ?? 'Brak połączenia. Spróbuj ponownie.' }
}

/** Where to send a signed-in user who still owes the second step, or null. */
export async function pendingMfaRedirect(next: string): Promise<string | null> {
  const s = await fetchMfaStatus()
  return s?.enabled && !s.verified ? `/verify-2fa?next=${encodeURIComponent(next)}` : null
}

/** Short device label for a new passkey, e.g. "iPhone" or "Windows". */
export function deviceName(): string {
  const ua = navigator.userAgent
  if (/iphone/i.test(ua)) return 'iPhone'
  if (/ipad/i.test(ua)) return 'iPad'
  if (/android/i.test(ua)) return 'Android'
  if (/mac os/i.test(ua)) return 'Mac'
  if (/windows/i.test(ua)) return 'Windows'
  return 'To urządzenie'
}

export const passkeysSupported = () => typeof window !== 'undefined' && 'PublicKeyCredential' in window

/** WebAuthn cancel/timeout comes back as NotAllowedError. */
export const webauthnError = (e: unknown, fallback: string) =>
  e instanceof Error && (e.name === 'NotAllowedError' || e.name === 'AbortError')
    ? 'Anulowano albo czas minął.'
    : e instanceof Error && e.name === 'InvalidStateError'
      ? 'Ten klucz jest już dodany na tym urządzeniu.'
      : fallback
