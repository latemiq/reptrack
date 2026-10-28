'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { relativeDay } from '@/lib/stats'

interface ClientRow {
  relationId: string
  id: string
  name: string
  email: string | null
  imageUrl: string | null
  since: string | null
  workouts30d: number
  tonnage30d: number
  lastWorkout: { name: string; startedAt: string } | null
}

interface InviteRow {
  id: string
  code: string
  expiresAt: string
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

export function Avatar({ name, imageUrl, size = 36 }: { name: string; imageUrl: string | null; size?: number }) {
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{ width: size, height: size }}
      className="rounded-full bg-gradient-to-br from-[#c8f53a] to-[#7ef5b0] flex items-center justify-center text-[#080808] font-bold text-[11px] flex-shrink-0 overflow-hidden">
      {imageUrl ? <img src={imageUrl} alt="" className="w-full h-full object-cover" /> : initials}
    </div>
  )
}

export default function TrainerDashboard() {
  const [clients, setClients] = useState<ClientRow[] | null>(null)
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [notTrainer, setNotTrainer] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError('')
    const res = await fetch('/api/trainer/clients').catch(() => null)
    if (res?.status === 403) { setNotTrainer(true); setClients([]); return }
    if (!res?.ok) { setClients([]); setError('Nie udało się wczytać podopiecznych.'); return }
    const d = await res.json()
    setNotTrainer(false)
    setClients(d.clients)
    setInvites(d.invites)
  }, [])

  useEffect(() => { load() }, [load])

  const becomeTrainer = async () => {
    setBusy(true)
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'trainer' }),
    }).catch(() => null)
    setBusy(false)
    if (res?.ok) { window.dispatchEvent(new Event('reptrack:role-changed')); load() }
    else setError('Nie udało się włączyć trybu trenera.')
  }

  const createInvite = async () => {
    setBusy(true)
    const res = await fetch('/api/trainer/invites', { method: 'POST' }).catch(() => null)
    setBusy(false)
    if (!res?.ok) { setError('Nie udało się utworzyć zaproszenia.'); return }
    const { invite } = await res.json()
    setInvites(list => [invite, ...list])
  }

  const cancelInvite = async (id: string) => {
    const res = await fetch(`/api/trainer/invites/${id}`, { method: 'DELETE' }).catch(() => null)
    if (res?.ok) setInvites(list => list.filter(i => i.id !== id))
  }

  const copyCode = async (code: string) => {
    await navigator.clipboard?.writeText(code).catch(() => {})
    setCopied(code)
    setTimeout(() => setCopied(null), 1500)
  }

  if (notTrainer) {
    return (
      <div className="min-h-full bg-[#080808] text-[#f0ece4] px-4 md:px-7 py-10 flex justify-center">
        <div className="max-w-md w-full bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-6 text-center space-y-4">
          <h1 className="font-display text-[22px] font-black">Panel <em className="not-italic text-[#c8f53a]">trenera</em></h1>
          <p className="text-[13px] text-[#888]">
            Włącz tryb trenera, żeby zapraszać podopiecznych i podglądać ich treningi: ćwiczenia, serie, powtórzenia i ciężary.
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

  const totalWorkouts = (clients ?? []).reduce((s, c) => s + c.workouts30d, 0)
  const inactive = (clients ?? []).filter(c => !c.lastWorkout || daysSince(c.lastWorkout.startedAt) >= 7).length

  return (
    <div className="min-h-full bg-[#080808] text-[#f0ece4]">
      <div className="px-4 md:px-7 pt-5 md:pt-6 pb-2 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-mono text-[#444] uppercase tracking-[2px] mb-1">Panel trenera</p>
          <h1 className="font-display text-[24px] font-black">Twoi <em className="not-italic text-[#c8f53a]">podopieczni</em></h1>
        </div>
        <button onClick={createInvite} disabled={busy}
          className="px-4 py-2.5 rounded-xl text-[11px] font-mono uppercase tracking-[1.3px] bg-[#c8f53a] text-[#080808] hover:bg-[#d8ff4a] disabled:opacity-50 transition-all cursor-pointer flex-shrink-0">
          + Zaproś
        </button>
      </div>

      <div className="px-4 md:px-7 pb-7 pt-3 space-y-4">
        {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] text-red-400">{error}</div>}

        <div className="grid grid-cols-3 gap-2.5">
          {[
            ['Podopieczni', String(clients?.length ?? 0)],
            ['Treningi · 30 dni', String(totalWorkouts)],
            ['Bez treningu 7+ dni', String(inactive)],
          ].map(([label, value]) => (
            <div key={label} className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-4">
              <div className="text-[9px] font-mono text-[#444] uppercase tracking-[1.3px] mb-2">{label}</div>
              <div className="font-display text-[22px] font-black text-[#c8f53a] leading-none">{value}</div>
            </div>
          ))}
        </div>

        {invites.length > 0 && (
          <div className="bg-[#0f0f0f] border border-[#c8f53a]/15 rounded-2xl p-4 space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-[2px] text-[#444]">Aktywne zaproszenia</p>
            <p className="text-[11px] text-[#666]">Podopieczny wpisuje kod w aplikacji: Ustawienia → Trener.</p>
            {invites.map(inv => (
              <div key={inv.id} className="flex items-center gap-3 bg-[#131313] border border-[#1c1c1c] rounded-xl px-3 py-2.5">
                <span className="font-mono text-[18px] tracking-[4px] text-[#f0ece4]">{inv.code}</span>
                <span className="text-[10px] font-mono text-[#555]">
                  ważny do {new Date(inv.expiresAt).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}
                </span>
                <div className="ml-auto flex gap-3">
                  <button onClick={() => copyCode(inv.code)} className="text-[10px] font-mono uppercase tracking-[1.3px] text-[#c8f53a] hover:underline cursor-pointer">
                    {copied === inv.code ? 'Skopiowano' : 'Kopiuj'}
                  </button>
                  <button onClick={() => cancelInvite(inv.id)} className="text-[10px] font-mono uppercase tracking-[1.3px] text-[#555] hover:text-red-400 cursor-pointer">
                    Anuluj
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {clients === null && [0, 1, 2].map(i => <div key={i} className="h-[72px] rounded-2xl bg-[#0f0f0f] border border-[#1a1a1a] animate-pulse" />)}

        {clients?.length === 0 && !error && (
          <div className="text-center py-14 text-[13px] text-[#555]">
            Nie masz jeszcze podopiecznych. Kliknij <span className="text-[#c8f53a]">+ Zaproś</span> i przekaż kod.
          </div>
        )}

        <div className="grid gap-2.5 md:grid-cols-2">
          {clients?.map(c => {
            const stale = !c.lastWorkout || daysSince(c.lastWorkout.startedAt) >= 7
            return (
              <Link key={c.id} href={`/trainer/${encodeURIComponent(c.id)}`}
                className="bg-[#0f0f0f] border border-[#1a1a1a] hover:border-[#c8f53a]/25 rounded-2xl p-4 flex items-center gap-3 transition-colors">
                <Avatar name={c.name} imageUrl={c.imageUrl} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-[#ddd] truncate">{c.name}</div>
                  <div className={`text-[10px] font-mono truncate ${stale ? 'text-[#f5a03a]' : 'text-[#555]'}`}>
                    {c.lastWorkout
                      ? `Ostatnio: ${relativeDay(c.lastWorkout.startedAt)} · ${c.lastWorkout.name}`
                      : 'Brak treningów'}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-display text-[15px] font-black">{c.workouts30d}</div>
                  <div className="text-[8px] font-mono text-[#444] uppercase">tr. / 30 dni</div>
                </div>
                <span className="text-[#444] text-[12px]">›</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
