'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { relativeDay } from '@/lib/stats'
import { focusMeta, type Focus } from '@/lib/plans'
import { Avatar } from '@/components/trainer/TrainerDashboard'
import BecomeTrainer from '@/components/trainer/BecomeTrainer'
import InviteQrModal from '@/components/trainer/InviteQrModal'

interface Overview {
  totals: {
    clients: number
    activeThisWeek: number
    workoutsThisWeek: number
    workoutsLastWeek: number
    tonnageThisWeek: number
    tonnageLastWeek: number
    runningPlans: number
    pendingInvites: number
  }
  weekly: { weekStart: string; workouts: number; tonnage: number; activeClients: number }[]
  attention: { id: string; name: string; imageUrl: string | null; reason: 'inactive' | 'no_workouts' | 'no_plan'; days: number | null }[]
  plans: { id: string; name: string; clientId: string; clientName: string; week: number; weeks: number; blockName: string; focus: Focus | null; plannedThisWeek: number; doneThisWeek: number }[]
  recent: { id: string; clientId: string; clientName: string; name: string; startedAt: string; tonnage: number; durationSec: number | null; sets: number }[]
}

const clientHref = (id: string) => `/trainer/${encodeURIComponent(id)}`

function Delta({ now, prev }: { now: number; prev: number }) {
  if (prev === 0 && now === 0) return null
  const diff = now - prev
  const pct = prev > 0 ? Math.round((diff / prev) * 100) : null
  const up = diff >= 0
  return (
    <span className={`text-[10px] font-mono ${up ? 'text-[#7ef5b0]' : 'text-[#f5a03a]'}`}>
      {up ? '▲' : '▼'} {pct != null ? `${Math.abs(pct)}%` : Math.abs(diff)} vs poprz. tydz.
    </span>
  )
}

const card = 'bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl'
const sectionLabel = 'text-[10px] font-mono uppercase tracking-[2px] text-[#444]'

export default function TrainerOverview() {
  const [data, setData] = useState<Overview | null>(null)
  const [notTrainer, setNotTrainer] = useState(false)
  const [error, setError] = useState('')
  const [invite, setInvite] = useState<{ code: string; expiresAt: string } | null>(null)
  const [inviting, setInviting] = useState(false)

  const load = useCallback(async () => {
    setError('')
    const res = await fetch('/api/trainer/overview').catch(() => null)
    if (res?.status === 403) { setNotTrainer(true); return }
    if (!res?.ok) { setError('Nie udało się wczytać statystyk.'); return }
    setNotTrainer(false)
    setData(await res.json())
  }, [])

  useEffect(() => { load() }, [load])

  const createInvite = async () => {
    setInviting(true)
    const res = await fetch('/api/trainer/invites', { method: 'POST' }).catch(() => null)
    setInviting(false)
    if (!res?.ok) { setError('Nie udało się utworzyć zaproszenia.'); return }
    setInvite((await res.json()).invite)
  }

  if (notTrainer) return <BecomeTrainer onDone={load} />

  const t = data?.totals
  const maxWeekly = Math.max(1, ...(data?.weekly ?? []).map(w => w.workouts))

  return (
    <div className="min-h-full bg-[#080808] text-[#f0ece4]">
      <div className="px-4 md:px-7 pt-5 md:pt-6 pb-2 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-mono text-[#444] uppercase tracking-[2px] mb-1">Panel trenera</p>
          <h1 className="font-display text-[24px] font-black">Twój <em className="not-italic text-[#c8f53a]">pulpit</em></h1>
        </div>
        <button onClick={createInvite} disabled={inviting}
          className="px-4 py-2.5 rounded-xl text-[11px] font-mono uppercase tracking-[1.3px] bg-[#c8f53a] text-[#080808] hover:bg-[#d8ff4a] disabled:opacity-50 transition-all cursor-pointer flex-shrink-0">
          + Zaproś podopiecznego
        </button>
      </div>

      <div className="px-4 md:px-7 pb-7 pt-3 space-y-4">
        {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] text-red-400">{error}</div>}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {!t && [0, 1, 2, 3].map(i => <div key={i} className={`${card} h-[104px] animate-pulse`} />)}
          {t && [
            {
              label: 'Podopieczni', value: String(t.clients),
              sub: <span className="text-[10px] font-mono text-[#666]">{t.activeThisWeek} aktywnych w tym tyg.{t.pendingInvites ? ` · ${t.pendingInvites} zaprosz.` : ''}</span>,
            },
            { label: 'Treningi · ten tydzień', value: String(t.workoutsThisWeek), sub: <Delta now={t.workoutsThisWeek} prev={t.workoutsLastWeek} /> },
            { label: 'Tonaż · ten tydzień', value: `${(t.tonnageThisWeek / 1000).toFixed(1)} t`, sub: <Delta now={t.tonnageThisWeek} prev={t.tonnageLastWeek} /> },
            { label: 'Plany w toku', value: String(t.runningPlans), sub: <Link href="/trainer/plans" className="text-[10px] font-mono text-[#c8f53a] hover:underline">wszystkie plany →</Link> },
          ].map(k => (
            <div key={k.label} className={`${card} p-4`}>
              <div className="text-[9px] font-mono text-[#444] uppercase tracking-[1.3px] mb-2">{k.label}</div>
              <div className="font-display text-[26px] font-black text-[#c8f53a] leading-none mb-2">{k.value}</div>
              {k.sub}
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          {/* Weekly workouts */}
          <div className={`${card} p-4 md:p-5`}>
            <div className="flex items-baseline justify-between mb-4">
              <p className={sectionLabel}>Treningi podopiecznych · 8 tygodni</p>
              <span className="text-[10px] font-mono text-[#555]">łącznie {(data?.weekly ?? []).reduce((s, w) => s + w.workouts, 0)}</span>
            </div>
            <div className="flex items-end gap-2 h-[150px]">
              {(data?.weekly ?? []).map((w, i, arr) => {
                const current = i === arr.length - 1
                return (
                  <div key={w.weekStart} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end"
                    title={`${w.workouts} treningów · ${(w.tonnage / 1000).toFixed(1)} t · ${w.activeClients} os.`}>
                    <span className="text-[10px] font-mono text-[#888]">{w.workouts || ''}</span>
                    <div className={`w-full max-w-[34px] rounded-t-md ${current ? 'bg-[#c8f53a]' : 'bg-[#c8f53a]/30'}`}
                      style={{ height: `${Math.max(2, (w.workouts / maxWeekly) * 100)}%` }} />
                    <span className="text-[9px] font-mono text-[#444]">
                      {new Date(w.weekStart).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                )
              })}
              {!data && <div className="w-full h-full rounded-xl bg-[#131313] animate-pulse" />}
            </div>
          </div>

          {/* Needs attention */}
          <div className={`${card} p-4 md:p-5`}>
            <p className={`${sectionLabel} mb-3`}>Wymaga uwagi</p>
            {data && data.attention.length === 0 && (
              <p className="text-[12px] text-[#555]">Wszyscy trenują i mają plan. 👌</p>
            )}
            <div className="space-y-1.5">
              {data?.attention.map(a => (
                <Link key={a.id} href={clientHref(a.id)} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.02]">
                  <Avatar name={a.name} imageUrl={a.imageUrl} size={30} />
                  <span className="flex-1 min-w-0 text-[12px] text-[#ddd] truncate">{a.name}</span>
                  <span className={`text-[10px] font-mono flex-shrink-0 ${a.reason === 'no_plan' ? 'text-[#888]' : 'text-[#f5a03a]'}`}>
                    {a.reason === 'inactive' ? `${a.days} dni bez treningu` : a.reason === 'no_workouts' ? 'brak treningów' : 'brak planu'}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Running plans */}
          <div className={`${card} p-4 md:p-5`}>
            <div className="flex items-baseline justify-between mb-3">
              <p className={sectionLabel}>Plany w toku · ten tydzień</p>
              <Link href="/trainer/plans" className="text-[10px] font-mono uppercase tracking-[1.3px] text-[#c8f53a] hover:underline">Plany</Link>
            </div>
            {data && data.plans.length === 0 && (
              <p className="text-[12px] text-[#555]">Żaden plan nie trwa teraz. Ułóż makrocykl na karcie podopiecznego.</p>
            )}
            <div className="space-y-2.5">
              {data?.plans.map(p => {
                const f = focusMeta(p.focus)
                const ratio = p.plannedThisWeek ? Math.min(1, p.doneThisWeek / p.plannedThisWeek) : 0
                return (
                  <Link key={p.id} href={`${clientHref(p.clientId)}/plans/${p.id}`} className="block rounded-xl bg-[#131313] border border-[#1c1c1c] hover:border-[#c8f53a]/25 p-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[12px] font-medium text-[#ddd] truncate">{p.clientName}</span>
                      <span className="text-[10px] text-[#666] truncate">· {p.name}</span>
                      <span className="ml-auto text-[9px] font-mono uppercase tracking-[1px] flex-shrink-0" style={{ color: f.color }}>
                        {p.blockName} · tydz. {p.week}/{p.weeks}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex-1 h-1.5 rounded-full bg-[#0a0a0a] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, background: f.color }} />
                      </div>
                      <span className="text-[10px] font-mono text-[#888] flex-shrink-0">
                        {p.doneThisWeek}/{p.plannedThisWeek} sesji
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Recent workouts */}
          <div className={`${card} p-4 md:p-5`}>
            <div className="flex items-baseline justify-between mb-3">
              <p className={sectionLabel}>Ostatnie treningi</p>
              <Link href="/trainer/clients" className="text-[10px] font-mono uppercase tracking-[1.3px] text-[#c8f53a] hover:underline">Podopieczni</Link>
            </div>
            {data && data.recent.length === 0 && <p className="text-[12px] text-[#555]">Brak treningów w ostatnich tygodniach.</p>}
            <div className="divide-y divide-[#161616]">
              {data?.recent.map(r => (
                <Link key={r.id} href={clientHref(r.clientId)} className="flex items-center gap-3 py-2 hover:bg-white/[0.02] rounded-lg px-1">
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-[#ddd] truncate">{r.clientName} <span className="text-[#666]">· {r.name}</span></div>
                    <div className="text-[10px] font-mono text-[#555]">
                      {relativeDay(r.startedAt)} · {r.sets} serii{r.durationSec ? ` · ${Math.round(r.durationSec / 60)} min` : ''}
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-[#999] flex-shrink-0">{r.tonnage.toLocaleString('pl-PL')} kg</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {invite && <InviteQrModal code={invite.code} expiresAt={invite.expiresAt} onClose={() => { setInvite(null); load() }} />}
    </div>
  )
}
