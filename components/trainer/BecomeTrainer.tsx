'use client'

import { useState } from 'react'

/** Shown on trainer pages to an athlete account: switches the account to trainer mode. */
export default function BecomeTrainer({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const becomeTrainer = async () => {
    setBusy(true)
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'trainer' }),
    }).catch(() => null)
    setBusy(false)
    if (res?.ok) { window.dispatchEvent(new Event('reptrack:role-changed')); onDone() }
    else setError('Nie udało się włączyć trybu trenera.')
  }

  return (
    <div className="min-h-full bg-[#080808] text-[#f0ece4] px-4 md:px-7 py-10 flex justify-center">
      <div className="max-w-md w-full bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-6 text-center space-y-4">
        <h1 className="font-display text-[22px] font-black">Panel <em className="not-italic text-[#c8f53a]">trenera</em></h1>
        <p className="text-[13px] text-[#888]">
          Konto trenera to osobna aplikacja: statystyki podopiecznych, zaproszenia i planowanie cykli treningowych.
          Twoje własne treningi i biegi nie będą widoczne w tym trybie.
        </p>
        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <button onClick={becomeTrainer} disabled={busy}
          className="w-full py-3 rounded-xl text-[12px] font-mono uppercase tracking-[1.5px] bg-[#c8f53a] text-[#080808] hover:bg-[#d8ff4a] disabled:opacity-50 transition-all cursor-pointer">
          {busy ? 'Włączam…' : 'Jestem trenerem'}
        </button>
      </div>
    </div>
  )
}
