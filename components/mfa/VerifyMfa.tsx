'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'
import { startAuthentication } from '@simplewebauthn/browser'
import { fetchMfaStatus, mfaPost, passkeysSupported, webauthnError, type MfaStatus } from '@/lib/mfa-client'

type Method = 'passkey' | 'totp' | 'email' | 'backup'

const METHOD_LABEL: Record<Method, string> = {
  passkey: 'Odcisk palca / Face ID',
  totp: 'Kod z aplikacji',
  email: 'Kod z maila',
  backup: 'Kod zapasowy',
}

/** Second step after a Clerk sign-in: passkey, authenticator code, emailed code or backup code. */
export default function VerifyMfa({ next }: { next: string }) {
  const router = useRouter()
  const { signOut } = useClerk()
  const [status, setStatus] = useState<MfaStatus | null>(null)
  const [method, setMethod] = useState<Method | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [emailSent, setEmailSent] = useState(false)

  const done = useCallback(() => router.replace(next), [router, next])

  useEffect(() => {
    fetchMfaStatus().then(s => {
      if (!s) { setError('Nie udało się sprawdzić zabezpieczeń konta. Odśwież stronę.'); return }
      if (!s.enabled || s.verified) { done(); return }
      setStatus(s)
      setMethod(s.passkeys && passkeysSupported() ? 'passkey' : s.totp ? 'totp' : s.email ? 'email' : 'backup')
      if (s.lockedUntil) setError(`Zbyt wiele nieudanych prób. Spróbuj po ${new Date(s.lockedUntil).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}.`)
    })
  }, [done])

  const verifyWithPasskey = async () => {
    setBusy(true)
    setError('')
    const opt = await mfaPost<{ options: Parameters<typeof startAuthentication>[0]['optionsJSON'] }>('verify', { action: 'passkey_options' })
    if (!opt.ok) { setBusy(false); setError(opt.error); return }
    try {
      const response = await startAuthentication({ optionsJSON: opt.data.options })
      const res = await mfaPost('verify', { action: 'passkey', response })
      if (res.ok) return done()
      setError(res.error)
    } catch (e) {
      setError(webauthnError(e, 'Nie udało się użyć klucza dostępu.'))
    } finally {
      setBusy(false)
    }
  }

  const sendEmail = async () => {
    setBusy(true)
    setError('')
    const res = await mfaPost('verify', { action: 'email_send' })
    setBusy(false)
    if (res.ok) setEmailSent(true)
    else setError(res.error)
  }

  const submitCode = async () => {
    if (!method || method === 'passkey' || !code.trim()) return
    setBusy(true)
    setError('')
    const res = await mfaPost('verify', { action: method, code })
    setBusy(false)
    if (res.ok) return done()
    setError(res.error)
    setCode('')
  }

  const choose = (m: Method) => { setMethod(m); setCode(''); setError(''); setEmailSent(false) }

  const available: Method[] = status ? [
    ...(status.passkeys && passkeysSupported() ? ['passkey' as const] : []),
    ...(status.totp ? ['totp' as const] : []),
    ...(status.email && status.emailAvailable ? ['email' as const] : []),
    ...(status.backupCodesLeft ? ['backup' as const] : []),
  ] : []

  const input = 'w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3.5 text-[18px] font-mono tracking-[4px] text-center text-[#f0ece4] placeholder:text-neutral-700 placeholder:tracking-normal focus:outline-none focus:border-[#c8f53a]/40'
  const primary = 'w-full py-4 rounded-xl text-[13px] font-mono uppercase tracking-[1.5px] bg-[#c8f53a] text-[#080808] hover:bg-[#d8ff4a] disabled:opacity-50 transition-all cursor-pointer'

  return (
    <div className="min-h-screen bg-[#080808] text-[#f0ece4] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white/[0.03] border border-white/[0.08] rounded-3xl p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-2 h-2 rounded-full bg-[#c8f53a]" />
          <span className="font-display text-base font-black">RepTrack</span>
        </div>
        <h1 className="font-display text-2xl font-black mb-1">Potwierdź, że <em className="not-italic text-[#c8f53a]">to Ty</em></h1>
        <p className="text-[13px] text-neutral-500 mb-6">Twoje konto ma włączoną weryfikację dwuetapową.</p>

        {error && <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] text-red-400">{error}</div>}
        {!status && !error && <div className="h-28 rounded-2xl bg-white/[0.02] animate-pulse" />}

        {method === 'passkey' && (
          <button onClick={verifyWithPasskey} disabled={busy} className={primary}>
            {busy ? 'Czekam na urządzenie…' : '🔑 Użyj odcisku palca / Face ID'}
          </button>
        )}

        {method && method !== 'passkey' && (
          <div className="space-y-3">
            <p className="text-[12px] text-neutral-400">
              {method === 'totp' && 'Wpisz 6-cyfrowy kod z aplikacji uwierzytelniającej.'}
              {method === 'backup' && 'Wpisz jeden z kodów zapasowych (każdy działa raz).'}
              {method === 'email' && (emailSent
                ? `Wysłaliśmy kod na ${status?.emailMasked}. Sprawdź też spam.`
                : `Wyślemy 6-cyfrowy kod na ${status?.emailMasked}.`)}
            </p>
            {method === 'email' && !emailSent ? (
              <button onClick={sendEmail} disabled={busy} className={primary}>{busy ? 'Wysyłam…' : 'Wyślij kod'}</button>
            ) : (
              <>
                <input value={code} onChange={e => setCode(e.target.value)} autoFocus
                  inputMode={method === 'backup' ? 'text' : 'numeric'} autoComplete="one-time-code"
                  placeholder={method === 'backup' ? 'abcd-efgh' : '123456'} maxLength={12}
                  onKeyDown={e => e.key === 'Enter' && submitCode()} className={input} />
                <button onClick={submitCode} disabled={busy || !code.trim()} className={primary}>{busy ? 'Sprawdzam…' : 'Potwierdź →'}</button>
                {method === 'email' && (
                  <button onClick={sendEmail} disabled={busy} className="w-full text-[11px] font-mono uppercase tracking-[1.3px] text-neutral-500 hover:text-[#c8f53a] cursor-pointer">Wyślij ponownie</button>
                )}
              </>
            )}
          </div>
        )}

        {available.length > 1 && (
          <div className="mt-6 pt-4 border-t border-white/[0.06]">
            <p className="text-[10px] font-mono uppercase tracking-[1.5px] text-neutral-600 mb-2">Inny sposób</p>
            <div className="flex flex-wrap gap-1.5">
              {available.filter(m => m !== method).map(m => (
                <button key={m} onClick={() => choose(m)}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-[11px] text-neutral-400 hover:text-[#c8f53a] hover:border-[#c8f53a]/30 cursor-pointer">
                  {METHOD_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
        )}

        <button onClick={() => signOut(() => router.push('/auth'))}
          className="mt-6 w-full text-[11px] font-mono uppercase tracking-[1.3px] text-neutral-600 hover:text-[#f0ece4] cursor-pointer">
          Wyloguj się
        </button>
      </div>
    </div>
  )
}
