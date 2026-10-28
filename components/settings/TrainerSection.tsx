'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface TrainerRow {
  relationId: string
  name: string
  email: string | null
  since: string | null
}

/** Settings card: connect to a trainer with an invite code, and toggle trainer mode. Saves on its own. */
export default function TrainerSection() {
  const [trainers, setTrainers] = useState<TrainerRow[]>([])
  const [role, setRole] = useState<'athlete' | 'trainer'>('athlete')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const loadTrainers = () =>
    fetch('/api/athlete/trainers')
      .then(r => (r.ok ? r.json() : { trainers: [] }))
      .then(d => setTrainers(d.trainers))
      .catch(() => {})

  useEffect(() => {
    loadTrainers()
    fetch('/api/profile')
      .then(r => (r.ok ? r.json() : null))
      .then(d => setRole(d?.profile?.role === 'trainer' ? 'trainer' : 'athlete'))
      .catch(() => {})
  }, [])

  const join = async () => {
    if (!code.trim()) return
    setBusy(true)
    setMessage(null)
    const res = await fetch('/api/athlete/trainers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }).catch(() => null)
    setBusy(false)
    if (res?.ok) {
      setCode('')
      setMessage({ kind: 'ok', text: 'Połączono z trenerem. Widzi teraz Twoje treningi.' })
      loadTrainers()
    } else {
      const d = await res?.json().catch(() => null)
      setMessage({ kind: 'error', text: d?.error ?? 'Nie udało się użyć kodu.' })
    }
  }

  const leave = async (t: TrainerRow) => {
    if (!confirm(`Zakończyć współpracę z: ${t.name}? Trener straci podgląd Twoich treningów.`)) return
    const res = await fetch(`/api/athlete/trainers/${t.relationId}`, { method: 'DELETE' }).catch(() => null)
    if (res?.ok) setTrainers(list => list.filter(x => x.relationId !== t.relationId))
  }

  const toggleRole = async () => {
    const next = role === 'trainer' ? 'athlete' : 'trainer'
    setBusy(true)
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: next }),
    }).catch(() => null)
    setBusy(false)
    if (res?.ok) {
      setRole(next)
      window.dispatchEvent(new Event('reptrack:role-changed'))
    }
  }

  const input = 'flex-1 min-w-0 bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl px-4 py-3 text-sm font-mono tracking-[3px] uppercase text-[#f0ece4] placeholder:text-[#333] placeholder:tracking-normal placeholder:normal-case focus:outline-none focus:border-[#c8f53a]/40 transition-colors'

  return (
    <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-5 md:p-6 space-y-4">
      <p className="text-[10px] font-mono uppercase tracking-[2px] text-[#444]">Trener</p>

      {trainers.map(t => (
        <div key={t.relationId} className="flex items-center gap-3 bg-[#131313] border border-[#1c1c1c] rounded-xl px-4 py-3">
          <div className="flex-1 min-w-0">
            <div className="text-[13px] text-[#ddd] truncate">{t.name}</div>
            <div className="text-[10px] font-mono text-[#555]">
              {t.since ? `od ${new Date(t.since).toLocaleDateString('pl-PL')}` : 'aktywny'} · widzi Twoje treningi
            </div>
          </div>
          <button onClick={() => leave(t)} className="text-[10px] font-mono uppercase tracking-[1.3px] text-[#555] hover:text-red-400 cursor-pointer">
            Odłącz
          </button>
        </div>
      ))}

      <div>
        <label className="block text-[10px] font-mono uppercase tracking-[2px] text-[#555] mb-2">Kod od trenera</label>
        <div className="flex gap-2">
          <input value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && join()}
            placeholder="np. K7PX2Q" maxLength={12} autoCapitalize="characters" className={input} />
          <button onClick={join} disabled={busy || !code.trim()}
            className="px-4 rounded-xl text-[11px] font-mono uppercase tracking-[1.3px] bg-[#c8f53a] text-[#080808] hover:bg-[#d8ff4a] disabled:opacity-40 transition-all cursor-pointer">
            Połącz
          </button>
        </div>
        {message && (
          <p className={`mt-2 text-[12px] ${message.kind === 'ok' ? 'text-[#c8f53a]' : 'text-red-400'}`}>{message.text}</p>
        )}
      </div>

      <div className="flex items-center gap-3 pt-3 border-t border-[#1a1a1a]">
        <div className="flex-1">
          <div className="text-[13px] text-[#d0ccc4]">Tryb trenera</div>
          <div className="text-[10px] font-mono text-[#555]">
            {role === 'trainer'
              ? <>Włączony · <Link href="/trainer" className="text-[#c8f53a] hover:underline">otwórz panel</Link></>
              : 'Zapraszaj podopiecznych i podglądaj ich treningi'}
          </div>
        </div>
        <button onClick={toggleRole} disabled={busy} role="switch" aria-checked={role === 'trainer'}
          className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer disabled:opacity-50 ${role === 'trainer' ? 'bg-[#c8f53a]' : 'bg-[#222]'}`}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-[#080808] transition-all ${role === 'trainer' ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>
    </div>
  )
}
