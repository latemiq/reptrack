'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchInvitePreview, redeemInvite, type InvitePreview } from '@/lib/invites'
import { pendingMfaRedirect } from '@/lib/mfa-client'

/** Signed-in user opened a trainer's QR link: confirm and join. */
export default function JoinInvite({ code }: { code: string }) {
  const router = useRouter()
  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [joined, setJoined] = useState(false)

  useEffect(() => { fetchInvitePreview(code).then(setPreview) }, [code])

  const join = async () => {
    setBusy(true)
    setError('')
    const res = await redeemInvite(code)
    if (!res.ok) {
      // A 2FA user who hasn't passed the second step yet: verify, then come back here.
      const to = await pendingMfaRedirect(`/join/${code}`)
      if (to) { router.replace(to); return }
      setBusy(false); setError(res.error); return
    }
    setJoined(true)
    // Someone who never finished the sign-up survey fills in the same data in Settings.
    const profile = await fetch('/api/profile').then(r => (r.ok ? r.json() : null)).catch(() => null)
    setTimeout(() => router.push(profile?.profile?.onboarded ? '/dashboard' : '/settings'), 1200)
  }

  const trainerName = preview?.trainer?.name ?? 'trener'

  return (
    <div className="min-h-screen bg-[#080808] text-[#f0ece4] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white/[0.03] border border-white/[0.08] rounded-3xl p-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-2 h-2 rounded-full bg-[#c8f53a]" />
          <span className="font-display text-base font-black">RepTrack</span>
        </div>

        {preview === null && <div className="h-32 rounded-2xl bg-white/[0.02] animate-pulse" />}

        {preview && !preview.valid && (
          <>
            <h1 className="font-display text-2xl font-black mb-2">Kod <em className="not-italic text-[#f5a03a]">nieaktywny</em></h1>
            <p className="text-[13px] text-neutral-500 mb-6">Zaproszenie wygasło albo zostało już użyte. Poproś trenera o nowy kod QR.</p>
            <button onClick={() => router.push('/dashboard')} className="text-[11px] font-mono uppercase tracking-[1.5px] text-neutral-500 hover:text-[#f0ece4] cursor-pointer">Przejdź do aplikacji →</button>
          </>
        )}

        {preview?.valid && !joined && (
          <>
            <div className="w-16 h-16 rounded-full mx-auto mb-4 overflow-hidden bg-gradient-to-br from-[#c8f53a] to-[#7ef5b0] flex items-center justify-center text-[#080808] font-bold">
              {preview.trainer?.imageUrl ? <img src={preview.trainer.imageUrl} alt="" className="w-full h-full object-cover" /> : trainerName.slice(0, 1).toUpperCase()}
            </div>
            <p className="text-[10px] font-mono uppercase tracking-[2px] text-neutral-500 mb-1">Zaproszenie od trenera</p>
            <h1 className="font-display text-2xl font-black mb-2">{trainerName}</h1>
            <p className="text-[13px] text-neutral-500 mb-6">Po dołączeniu trener zobaczy Twoje treningi (ćwiczenia, serie, powtórzenia, ciężary) i będzie mógł układać Ci plan.</p>
            {error && <p className="text-[12px] text-red-400 mb-3">{error}</p>}
            <button onClick={join} disabled={busy}
              className="w-full py-4 rounded-xl text-[13px] font-mono uppercase tracking-[1.5px] bg-[#c8f53a] text-[#080808] hover:bg-[#d8ff4a] disabled:opacity-50 transition-all cursor-pointer">
              {busy ? 'Dołączam…' : 'Dołącz →'}
            </button>
            <button onClick={() => router.push('/dashboard')} className="mt-3 text-[11px] font-mono uppercase tracking-[1.5px] text-neutral-600 hover:text-[#f0ece4] cursor-pointer">Nie teraz</button>
          </>
        )}

        {joined && (
          <>
            <div className="w-16 h-16 rounded-full bg-[#c8f53a]/10 border border-[#c8f53a]/30 flex items-center justify-center mx-auto mb-5">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M6 14l5 5 11-11" stroke="#c8f53a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <h1 className="font-display text-2xl font-black mb-2">Dołączono!</h1>
            <p className="text-[13px] text-neutral-500">Trenujesz teraz z: {trainerName}.</p>
          </>
        )}
      </div>
    </div>
  )
}
