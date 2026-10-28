'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { focusMeta, weekStart, type MacrocycleSummary } from '@/lib/plans'

const fmt = (d: Date) => d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: '2-digit' })

/** Client's macrocycles with a block timeline and a "current week" marker. */
export default function PlanList({ clientId }: { clientId: string }) {
  const [plans, setPlans] = useState<MacrocycleSummary[] | null>(null)
  const base = `/trainer/${encodeURIComponent(clientId)}/plans`

  useEffect(() => {
    fetch(`/api/trainer/clients/${encodeURIComponent(clientId)}/plans`)
      .then(r => (r.ok ? r.json() : { plans: [] }))
      .then(d => setPlans(d.plans))
      .catch(() => setPlans([]))
  }, [clientId])

  return (
    <div className="px-4 md:px-7 pt-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono uppercase tracking-[2px] text-[#444]">Plany treningowe</p>
        <Link href={`${base}/new`} className="text-[10px] font-mono uppercase tracking-[1.3px] text-[#c8f53a] hover:underline">+ Nowy makrocykl</Link>
      </div>

      {plans === null && <div className="h-[84px] rounded-2xl bg-[#0f0f0f] border border-[#1a1a1a] animate-pulse" />}

      {plans?.length === 0 && (
        <div className="bg-[#0f0f0f] border border-dashed border-[#222] rounded-2xl p-5 text-center text-[12px] text-[#555]">
          Brak planu. <Link href={`${base}/new`} className="text-[#c8f53a] hover:underline">Ułóż pierwszy makrocykl</Link> — bloki, tygodnie i sesje z seriami, powtórzeniami i ciężarem.
        </div>
      )}

      {plans?.map(p => {
        const start = weekStart(p.startDate, 0)
        const end = new Date(weekStart(p.startDate, p.weeks).getTime() - 86400000)
        const weekNow = Math.floor((Date.now() - start.getTime()) / (7 * 86400000))
        const running = weekNow >= 0 && weekNow < p.weeks
        return (
          <Link key={p.id} href={`${base}/${p.id}`}
            className="block bg-[#0f0f0f] border border-[#1a1a1a] hover:border-[#c8f53a]/25 rounded-2xl p-4 transition-colors">
            <div className="flex items-baseline gap-3 mb-2.5">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-[#ddd] truncate">{p.name}</div>
                <div className="text-[10px] font-mono text-[#555] truncate">
                  {fmt(start)} – {fmt(end)} · {p.weeks} tyg.{p.goal ? ` · ${p.goal}` : ''}
                </div>
              </div>
              <span className={`text-[9px] font-mono uppercase tracking-[1.3px] flex-shrink-0 ${running ? 'text-[#c8f53a]' : 'text-[#444]'}`}>
                {running ? `Tydzień ${weekNow + 1}/${p.weeks}` : weekNow < 0 ? 'Zaplanowany' : 'Zakończony'}
              </span>
            </div>
            <div className="relative flex gap-0.5 h-6">
              {p.mesocycles.map((m, i) => {
                const f = focusMeta(m.focus)
                return (
                  <div key={i} style={{ flexGrow: Math.max(m.weeks, 1), background: `${f.color}26`, borderColor: `${f.color}55` }}
                    className="basis-0 rounded-md border px-1.5 flex items-center overflow-hidden" title={`${m.name} · ${f.label} · ${m.weeks} tyg.`}>
                    <span className="text-[9px] font-mono truncate" style={{ color: f.color }}>{m.name}</span>
                  </div>
                )
              })}
              {running && p.weeks > 0 && (
                <div className="absolute -top-1 -bottom-1 w-0.5 bg-[#f0ece4] rounded" style={{ left: `${((weekNow + 0.5) / p.weeks) * 100}%` }} />
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
