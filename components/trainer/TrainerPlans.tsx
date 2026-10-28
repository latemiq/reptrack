'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { MacrocycleSummary } from '@/lib/plans'
import BecomeTrainer from '@/components/trainer/BecomeTrainer'
import { PlanCard, planStatus, type PlanStatus } from '@/components/trainer/PlanList'

type PlanRow = MacrocycleSummary & { clientId: string; clientName: string }

const FILTERS: { key: PlanStatus | 'all'; label: string }[] = [
  { key: 'running', label: 'W toku' },
  { key: 'planned', label: 'Zaplanowane' },
  { key: 'finished', label: 'Zakończone' },
  { key: 'all', label: 'Wszystkie' },
]

/** All macrocycles across the trainer's clients. */
export default function TrainerPlans() {
  const router = useRouter()
  const [plans, setPlans] = useState<PlanRow[] | null>(null)
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [notTrainer, setNotTrainer] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<PlanStatus | 'all'>('all')
  const [clientFilter, setClientFilter] = useState('')
  const [newFor, setNewFor] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/trainer/plans').catch(() => null)
    if (res?.status === 403) { setNotTrainer(true); return }
    if (!res?.ok) { setPlans([]); setError('Nie udało się wczytać planów.'); return }
    const d = await res.json()
    setNotTrainer(false)
    setPlans(d.plans)
    setClients(d.clients)
  }, [])

  useEffect(() => { load() }, [load])

  const visible = useMemo(() => (plans ?? []).filter(p =>
    (filter === 'all' || planStatus(p) === filter) && (!clientFilter || p.clientId === clientFilter)
  ), [plans, filter, clientFilter])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: plans?.length ?? 0, running: 0, planned: 0, finished: 0 }
    for (const p of plans ?? []) c[planStatus(p)]++
    return c
  }, [plans])

  if (notTrainer) return <BecomeTrainer onDone={load} />

  const select = 'bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl px-3 py-2 text-[12px] text-[#f0ece4] focus:outline-none focus:border-[#c8f53a]/40 cursor-pointer'

  return (
    <div className="min-h-full bg-[#080808] text-[#f0ece4]">
      <div className="px-4 md:px-7 pt-5 md:pt-6 pb-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-mono text-[#444] uppercase tracking-[2px] mb-1">Organizacja</p>
          <h1 className="font-display text-[24px] font-black">Plany <em className="not-italic text-[#c8f53a]">treningowe</em></h1>
        </div>
        <div className="flex gap-2">
          <select value={newFor} onChange={e => setNewFor(e.target.value)} className={select} aria-label="Podopieczny dla nowego planu">
            <option value="">Nowy plan dla…</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button disabled={!newFor} onClick={() => router.push(`/trainer/${encodeURIComponent(newFor)}/plans/new`)}
            className="px-4 py-2 rounded-xl text-[11px] font-mono uppercase tracking-[1.3px] bg-[#c8f53a] text-[#080808] hover:bg-[#d8ff4a] disabled:opacity-40 transition-all cursor-pointer">
            + Utwórz
          </button>
        </div>
      </div>

      <div className="px-4 md:px-7 pb-7 pt-3 space-y-3">
        {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] text-red-400">{error}</div>}

        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-mono border cursor-pointer transition-colors ${
                filter === f.key ? 'bg-[#c8f53a]/10 border-[#c8f53a]/40 text-[#c8f53a]' : 'border-[#1e1e1e] text-[#666] hover:text-[#ccc]'
              }`}>
              {f.label} <span className="opacity-60">{counts[f.key]}</span>
            </button>
          ))}
          <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} className={`${select} ml-auto`} aria-label="Filtruj po podopiecznym">
            <option value="">Wszyscy podopieczni</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {plans === null && [0, 1].map(i => <div key={i} className="h-[92px] rounded-2xl bg-[#0f0f0f] border border-[#1a1a1a] animate-pulse" />)}

        {plans && visible.length === 0 && (
          <div className="bg-[#0f0f0f] border border-dashed border-[#222] rounded-2xl p-6 text-center text-[12px] text-[#555]">
            {plans.length === 0 ? 'Nie masz jeszcze planów. Wybierz podopiecznego powyżej i utwórz pierwszy makrocykl.' : 'Brak planów dla wybranego filtra.'}
          </div>
        )}

        <div className="grid gap-2.5 xl:grid-cols-2">
          {visible.map(p => (
            <PlanCard key={p.id} plan={p} subtitle={p.clientName}
              href={`/trainer/${encodeURIComponent(p.clientId)}/plans/${p.id}`} />
          ))}
        </div>
      </div>
    </div>
  )
}
