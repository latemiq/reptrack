'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import MacroSection from '@/components/trainer/stats/MacroSection'
import MesoSection from '@/components/trainer/stats/MesoSection'
import MicroSection from '@/components/trainer/stats/MicroSection'
import type { StatWorkout } from '@/lib/gym-stats'
import type { Macrocycle } from '@/lib/plans'
import { planStats } from '@/lib/plan-stats'

/** Trainer's periodization statistics: macrocycle → selected mesocycle → selected microcycle. */
export default function PlanStatsView({ clientId, planId }: { clientId: string; planId: string }) {
  const [data, setData] = useState<{ plan: Macrocycle; workouts: StatWorkout[] } | null>(null)
  const [clientName, setClientName] = useState('')
  const [error, setError] = useState('')
  const [picked, setPicked] = useState<number | null>(null)

  useEffect(() => {
    fetch(`/api/trainer/plans/${encodeURIComponent(planId)}/stats`)
      .then(async res => {
        const body = await res.json().catch(() => null)
        if (!res.ok) throw new Error(body?.error ?? 'Nie udało się wczytać statystyk.')
        setData(body)
      })
      .catch((e: Error) => setError(e.message))
  }, [planId])

  useEffect(() => {
    fetch(`/api/trainer/clients/${encodeURIComponent(clientId)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => setClientName(d?.client?.name ?? ''))
      .catch(() => {})
  }, [clientId])

  const stats = useMemo(() => (data ? planStats(data.plan, data.workouts) : null), [data])
  const base = `/trainer/${encodeURIComponent(clientId)}`
  // Opens on the week that is running, or the nearest one when the plan hasn't started or is over.
  const selected = stats?.weeks.length ? stats.weeks[picked ?? Math.min(Math.max(stats.currentWeek, 0), stats.weeks.length - 1)] : null

  return (
    <div className="min-h-full bg-[#080808] text-[#f0ece4]">
      <div className="px-4 md:px-7 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href={base} className="text-[10px] font-mono uppercase tracking-[2px] text-[#777] hover:text-[#c8f53a]">← {clientName || 'Podopieczny'}</Link>
          <Link href={`${base}/plans/${planId}`} className="text-[10px] font-mono uppercase tracking-[1.3px] text-[#c8f53a] hover:underline">Edytuj plan</Link>
        </div>
        <h1 className="font-display text-[20px] font-black mt-2">Statystyki periodyzacji</h1>

        {error && <div role="alert" className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] text-red-400">{error}</div>}
        {!data && !error && <div className="mt-4 h-[280px] rounded-2xl bg-[#0f0f0f] border border-[#1a1a1a] animate-pulse" />}
        {data && stats && !selected && <p className="mt-4 text-[12px] text-[#777]">Ten plan nie ma jeszcze tygodni.</p>}

        {data && stats && selected && (
          <div className="space-y-2.5">
            <MacroSection plan={data.plan} stats={stats} selectedWeek={selected.index} onSelect={setPicked} />
            <MesoSection block={stats.blocks[selected.block]} />
            <MicroSection week={selected} total={stats.weeks.length} onSelect={setPicked} />
          </div>
        )}
      </div>
    </div>
  )
}
