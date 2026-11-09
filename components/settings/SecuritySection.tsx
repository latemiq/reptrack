'use client'

import { useCallback, useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { startRegistration } from '@simplewebauthn/browser'
import { deviceName, fetchMfaStatus, mfaPost, passkeysSupported, webauthnError, type MfaStatus } from '@/lib/mfa-client'

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')

/**
 * Settings card for RepTrack's own 2FA (free — not Clerk's paid MFA):
 * fingerprint/Face ID passkeys, authenticator app (TOTP), emailed code, backup codes.
 */
export default function SecuritySection() {
  const [status, setStatus] = useState<MfaStatus | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [totpSetup, setTotpSetup] = useState<{ uri: string; secret: string } | null>(null)
  const [emailSetup, setEmailSetup] = useState(false)
  const [code, setCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)

  const load = useCallback(async () => {
    const s = await fetchMfaStatus()
    if (s) setStatus(s)
    else setUnavailable(true)
  }, [])

  useEffect(() => { load() }, [load])

  const card = 'bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-5 md:p-6'
  const label = 'text-[10px] font-mono uppercase tracking-[2px] text-[#444]'

  if (unavailable) {
    return (
      <div className={card}>
        <p className={`${label} mb-2`}>Bezpieczeństwo</p>
        <p className="text-[12px] text-[#666]">Dostępne po zalogowaniu (niedostępne w trybie testowym bez logowania).</p>
      </div>
    )
  }
  if (!status) return <div className={`${card} h-40 animate-pulse`} />

  /** Runs a /api/mfa/manage action; shows backup codes when enabling the first method returns them. */
  const manage = async (body: Record<string, unknown>) => {
    setBusy(true)
    setError('')
    const res = await mfaPost<{ backupCodes?: string[] | null; uri?: string; secret?: string }>('manage', body)
    setBusy(false)
    if (!res.ok) { setError(res.error); return null }
    if (res.data.backupCodes) setBackupCodes(res.data.backupCodes)
    await load()
    return res.data
  }

  const addPasskey = async () => {
    setBusy(true)
    setError('')
    const opt = await mfaPost<{ options: Parameters<typeof startRegistration>[0]['optionsJSON'] }>('manage', { action: 'passkey_options' })
    if (!opt.ok) { setBusy(false); setError(opt.error); return }
    try {
      const response = await startRegistration({ optionsJSON: opt.data.options })
      await manage({ action: 'passkey_register', response, name: deviceName() })
    } catch (e) {
      setError(webauthnError(e, 'Nie udało się dodać klucza.'))
    } finally {
      setBusy(false)
    }
  }

  const removePasskey = (id: string) => {
    if (!confirm('Usunąć ten klucz dostępu?')) return
    manage({ action: 'passkey_delete', id })
  }

  const startTotp = async () => {
    const data = await manage({ action: 'totp_setup' })
    if (data?.uri && data.secret) { setTotpSetup({ uri: data.uri, secret: data.secret }); setCode('') }
  }

  const confirmTotp = async () => {
    if (await manage({ action: 'totp_enable', code })) { setTotpSetup(null); setCode('') }
  }

  const startEmail = async () => {
    if (await manage({ action: 'email_send' })) { setEmailSetup(true); setCode('') }
  }

  const confirmEmail = async () => {
    if (await manage({ action: 'email_enable', code })) { setEmailSetup(false); setCode('') }
  }

  const disable = (action: 'totp_disable' | 'email_disable', what: string) => {
    if (!confirm(`Wyłączyć ${what}?`)) return
    manage({ action })
  }

  const regenerate = () => {
    if (!confirm('Wygenerować nowe kody zapasowe? Poprzednie przestaną działać.')) return
    manage({ action: 'backup_regenerate' })
  }

  const downloadCodes = () => {
    if (!backupCodes) return
    const blob = new Blob([`RepTrack — kody zapasowe\nKażdy kod działa jeden raz.\n\n${backupCodes.join('\n')}\n`], { type: 'text/plain' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'reptrack-kody-zapasowe.txt' })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const btn = 'px-3 py-2 rounded-xl text-[10px] font-mono uppercase tracking-[1.2px] cursor-pointer transition-colors disabled:opacity-40'
  const primary = `${btn} bg-[#c8f53a] text-[#080808] hover:bg-[#d8ff4a]`
  const ghost = `${btn} border border-[#2a2a2a] text-[#aaa] hover:text-[#f0ece4] hover:border-[#444]`
  const offBtn = `${btn} text-[#666] hover:text-red-400`
  const codeInput = 'flex-1 min-w-0 bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl px-4 py-2.5 text-[16px] font-mono tracking-[4px] text-[#f0ece4] placeholder:text-[#333] focus:outline-none focus:border-[#c8f53a]/40'
  const methodTitle = 'text-[13px] text-[#d0ccc4]'
  const methodSub = 'text-[11px] text-[#666]'
  const on = <span className="text-[11px] font-mono text-[#c8f53a] mr-auto">✓ Włączone</span>

  return (
    <div className={`${card} space-y-5`}>
      <div className="flex items-center justify-between gap-3">
        <p className={label}>Bezpieczeństwo · weryfikacja dwuetapowa</p>
        <span className={`text-[9px] font-mono uppercase tracking-[1.3px] ${status.enabled ? 'text-[#c8f53a]' : 'text-[#f5a03a]'}`}>
          {status.enabled ? 'Włączona' : 'Tylko hasło'}
        </span>
      </div>
      <p className="text-[11px] text-[#666] -mt-3">
        Po wpisaniu hasła RepTrack poprosi o drugi krok. Wystarczy jedna metoda; możesz włączyć kilka.
      </p>

      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] text-red-400">{error}</div>}

      {/* Passkeys */}
      <div className="space-y-2.5">
        <div>
          <div className={methodTitle}>Odcisk palca / Face ID</div>
          <div className={methodSub}>Klucz dostępu zapisany w tym telefonie lub komputerze — potwierdzasz jednym dotknięciem.</div>
        </div>
        {status.passkeyList.map(p => (
          <div key={p.id} className="flex items-center gap-3 bg-[#131313] border border-[#1c1c1c] rounded-xl px-3 py-2.5">
            <span className="text-[16px]">🔑</span>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] text-[#ddd] truncate">{p.name || 'Klucz dostępu'}</div>
              <div className="text-[10px] font-mono text-[#555]">dodany {fmtDate(p.createdAt)} · ostatnio {fmtDate(p.lastUsedAt)}</div>
            </div>
            <button onClick={() => removePasskey(p.id)} disabled={busy} className={offBtn}>Usuń</button>
          </div>
        ))}
        {passkeysSupported()
          ? <button onClick={addPasskey} disabled={busy} className={primary}>+ Dodaj na tym urządzeniu</button>
          : <p className="text-[11px] text-[#f5a03a]">Ta przeglądarka nie obsługuje odcisku palca / Face ID.</p>}
      </div>

      {/* Authenticator app */}
      <div className="space-y-2.5 pt-4 border-t border-[#1a1a1a]">
        <div>
          <div className={methodTitle}>Aplikacja uwierzytelniająca</div>
          <div className={methodSub}>Google Authenticator, Microsoft Authenticator, 1Password itp. — 6-cyfrowy kod zmieniający się co 30 s.</div>
        </div>
        {status.totp && <div className="flex items-center gap-2">{on}<button onClick={() => disable('totp_disable', 'aplikację uwierzytelniającą')} disabled={busy} className={offBtn}>Wyłącz</button></div>}
        {!status.totp && !totpSetup && <button onClick={startTotp} disabled={busy} className={primary}>Włącz</button>}
        {totpSetup && (
          <div className="bg-[#131313] border border-[#c8f53a]/20 rounded-xl p-4 space-y-3">
            <ol className="text-[12px] text-[#bbb] space-y-1 list-decimal list-inside">
              <li>W aplikacji dodaj konto i zeskanuj kod QR.</li>
              <li>Jeśli konfigurujesz na tym samym telefonie — skopiuj klucz i wpisz go ręcznie.</li>
              <li>Wpisz 6-cyfrowy kod z aplikacji.</li>
            </ol>
            <div className="flex flex-wrap items-center gap-4">
              <div className="bg-white rounded-xl p-3"><QRCodeSVG value={totpSetup.uri} size={148} marginSize={0} /></div>
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-mono uppercase tracking-[1.3px] text-[#555] mb-1">Klucz do wpisania ręcznie</div>
                <code className="block text-[12px] font-mono text-[#f0ece4] break-all select-all">{totpSetup.secret}</code>
              </div>
            </div>
            <div className="flex gap-2">
              <input value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={8}
                onKeyDown={e => e.key === 'Enter' && confirmTotp()} className={codeInput} />
              <button onClick={confirmTotp} disabled={busy || code.trim().length < 6} className={primary}>Potwierdź</button>
              <button onClick={() => setTotpSetup(null)} disabled={busy} className={ghost}>Anuluj</button>
            </div>
          </div>
        )}
      </div>

      {/* Email */}
      <div className="space-y-2.5 pt-4 border-t border-[#1a1a1a]">
        <div>
          <div className={methodTitle}>Kod z maila</div>
          <div className={methodSub}>
            {status.emailAvailable
              ? `6-cyfrowy kod wysyłany na ${status.emailMasked}.`
              : 'Niedostępne — wysyłka maili nie jest jeszcze skonfigurowana na serwerze.'}
          </div>
        </div>
        {status.email && <div className="flex items-center gap-2">{on}<button onClick={() => disable('email_disable', 'kod z maila')} disabled={busy} className={offBtn}>Wyłącz</button></div>}
        {!status.email && status.emailAvailable && !emailSetup && <button onClick={startEmail} disabled={busy} className={primary}>Włącz</button>}
        {emailSetup && (
          <div className="bg-[#131313] border border-[#c8f53a]/20 rounded-xl p-4 space-y-3">
            <p className="text-[12px] text-[#bbb]">Wysłaliśmy kod na {status.emailMasked}. Wpisz go, żeby potwierdzić adres.</p>
            <div className="flex gap-2">
              <input value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={6}
                onKeyDown={e => e.key === 'Enter' && confirmEmail()} className={codeInput} />
              <button onClick={confirmEmail} disabled={busy || code.trim().length < 6} className={primary}>Potwierdź</button>
              <button onClick={() => setEmailSetup(false)} disabled={busy} className={ghost}>Anuluj</button>
            </div>
          </div>
        )}
      </div>

      {/* Backup codes */}
      {status.enabled && !backupCodes && (
        <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-[#1a1a1a]">
          <div className="mr-auto">
            <div className={methodTitle}>Kody zapasowe</div>
            <div className={methodSub}>Pozostało {status.backupCodesLeft} z 10 — na wypadek zgubienia telefonu.</div>
          </div>
          <button onClick={regenerate} disabled={busy} className={ghost}>Nowe kody</button>
        </div>
      )}
      {backupCodes && (
        <div className="bg-[#131313] border border-[#f5a03a]/30 rounded-xl p-4 space-y-3">
          <div className="text-[12px] text-[#f5a03a]">
            Zapisz kody zapasowe w bezpiecznym miejscu. Każdy działa raz, gdy nie masz dostępu do telefonu. Nie pokażemy ich ponownie.
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {backupCodes.map(c => <code key={c} className="text-[12px] font-mono text-[#f0ece4] bg-[#0a0a0a] rounded-lg px-2 py-1.5 text-center select-all">{c}</code>)}
          </div>
          <div className="flex gap-2">
            <button onClick={downloadCodes} className={ghost}>Pobierz .txt</button>
            <button onClick={() => navigator.clipboard?.writeText(backupCodes.join('\n'))} className={ghost}>Kopiuj</button>
            <button onClick={() => setBackupCodes(null)} className={`${btn} ml-auto text-[#888] hover:text-[#f0ece4]`}>Zapisałem</button>
          </div>
        </div>
      )}
    </div>
  )
}
