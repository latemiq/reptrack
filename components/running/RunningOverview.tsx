'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import AddRunModal from './AddRunModal'
import { fmtDuration, fmtPace, relativeDay, startOfWeek } from '@/lib/stats'

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type RunType = 'easy' | 'tempo' | 'long' | 'interval' | 'recovery' | 'race'

interface RunRow {
  id: string
  name: string
  ran_at: string
  distance_km: number | string
  duration_seconds: number
  avg_pace_seconds_per_km: number | null
  avg_hr: number | null
  max_hr: number | null
  elevation_gain_m: number | string | null
  location: string | null
  type: RunType | null
}

export interface Run {
  id: string
  name: string
  ranAt: Date
  dateLabel: string
  distanceKm: number
  durationSeconds: number
  avgPaceSecondsPerKm: number
  avgHr: number | null
  elevationGainM: number | null
  location: string | null
  type: RunType
  isPR: boolean
  isToday: boolean
}

interface RunningGoal {
  id: string
  name: string
  category: string | null
  unit: string | null
  target_value: number | string
  current_value: number | string | null
  target_date: string | null
  status: string
  progress: number
}

type RangeFilter = '7d' | '30d' | '90d' | 'year'
type TypeFilter   = 'all' | 'tempo' | 'long' | 'interval'

const RANGE_DAYS: Record<RangeFilter, number> = { '7d': 7, '30d': 30, '90d': 90, 'year': 365 }
const RANGE_LABELS: Record<RangeFilter, string> = { '7d': '7d', '30d': '30d', '90d': '90d', 'year': 'Rok' }
const RANGE_LONG: Record<RangeFilter, string> = { '7d': '7 dni', '30d': '30 dni', '90d': '90 dni', 'year': 'rok' }
const TYPE_LABELS: Record<TypeFilter, string> = { all: 'Wszystkie', tempo: 'Tempo', long: 'Długie', interval: 'Interwały' }

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const toRun = (r: RunRow): Run => {
  const ranAt = new Date(r.ran_at)
  const km = Number(r.distance_km)
  const isToday = ranAt.toDateString() === new Date().toDateString()
  return {
    id: r.id,
    name: r.name,
    ranAt,
    dateLabel: `${relativeDay(r.ran_at)} · ${ranAt.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`,
    distanceKm: km,
    durationSeconds: r.duration_seconds,
    avgPaceSecondsPerKm: r.avg_pace_seconds_per_km ?? (km > 0 ? Math.round(r.duration_seconds / km) : 0),
    avgHr: r.avg_hr,
    elevationGainM: r.elevation_gain_m != null ? Number(r.elevation_gain_m) : null,
    location: r.location,
    type: (r.type ?? 'easy') as RunType,
    isPR: false,
    isToday,
  }
}

/** Best time over `km`, estimated from runs at least that long (avg pace × km). */
const bestTimeFor = (runs: Run[], km: number): { seconds: number; runId: string } | null => {
  let best: { seconds: number; runId: string } | null = null
  for (const r of runs) {
    if (r.distanceKm < km || !r.avgPaceSecondsPerKm) continue
    const seconds = Math.round(r.avgPaceSecondsPerKm * km)
    if (!best || seconds < best.seconds) best = { seconds, runId: r.id }
  }
  return best
}

const avgPaceOf = (runs: Run[]) => {
  const km = runs.reduce((s, r) => s + r.distanceKm, 0)
  const sec = runs.reduce((s, r) => s + r.durationSeconds, 0)
  return km > 0 ? sec / km : 0
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function HeroCard({
  tag, value, sub, trend, trendUp, valueColor, accent, animateId,
}: {
  tag: string; value: string; sub: string
  trend?: string; trendUp?: boolean
  valueColor?: 'lime' | 'orange' | 'white'
  accent?: boolean
  animateId?: string
}) {
  const colorMap = {
    lime: 'text-[#c8f53a]',
    orange: 'text-[#f5a03a]',
    white: 'text-[#f0ece4]',
  }
  return (
    <div className={`hero-card relative overflow-hidden rounded-2xl p-4 transition-all duration-250 ${
      accent
        ? 'bg-[#f5a03a]/[0.04] border border-[#f5a03a]/18 hover:border-[#f5a03a]/30'
        : 'bg-[#0f0f0f] border border-[#1a1a1a] hover:border-[#2a2a2a]'
    }`}>
      <div className="text-[9px] font-mono text-[#444] uppercase tracking-[1.3px] mb-2 flex justify-between items-center">
        <span>{tag}</span>
        {trend && (
          <span className={`rounded px-1.5 py-0.5 ${
            trendUp
              ? 'bg-[#c8f53a]/[0.12] text-[#c8f53a]'
              : 'bg-[#f5a03a]/[0.12] text-[#f5a03a]'
          }`}>{trend}</span>
        )}
      </div>
      <div id={animateId}
        className={`font-display text-[26px] font-black leading-none mb-1 ${colorMap[valueColor ?? 'orange']}`}>
        {value}
      </div>
      <div className="text-[9px] font-mono text-[#444]">{sub}</div>
    </div>
  )
}

function RunListItem({ run, onClick }: { run: Run; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="run-item grid grid-cols-[36px_1fr_auto_auto_auto] gap-3.5 items-center px-1.5 py-2.5 transition-colors rounded-md hover:bg-white/[0.02] border-b border-[#131313] last:border-b-0 w-full text-left"
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-[14px] flex-shrink-0 ${
        run.isPR
          ? 'bg-[#c8f53a]/10 border border-[#c8f53a]/25'
          : 'bg-[#f5a03a]/10 border border-[#f5a03a]/20'
      }`}>🏃</div>

      <div className="min-w-0">
        <div className="text-[12px] font-medium text-[#ccc] mb-0.5 flex items-center gap-1.5 truncate">
          <span className="truncate">{run.name}</span>
          {run.isPR && <span className="text-[7px] font-mono uppercase tracking-[0.8px] text-[#c8f53a] bg-[#c8f53a]/15 rounded px-1 py-0.5 flex-shrink-0">PR</span>}
          {run.isToday && <span className="text-[7px] font-mono uppercase tracking-[0.8px] text-[#c8f53a] bg-[#c8f53a]/15 rounded px-1 py-0.5 flex-shrink-0">DZIŚ</span>}
        </div>
        <div className="text-[9px] font-mono text-[#444] truncate">{run.dateLabel}{run.location && ` · ${run.location}`}</div>
      </div>

      <div className="text-right min-w-[54px]">
        <div className="font-display text-[13px] font-black text-[#f0ece4]">{run.distanceKm.toFixed(1)}</div>
        <div className="text-[8px] font-mono text-[#444] uppercase">km</div>
      </div>
      <div className="text-right min-w-[54px]">
        <div className="font-display text-[13px] font-black text-[#f0ece4]">{fmtPace(run.avgPaceSecondsPerKm)}</div>
        <div className="text-[8px] font-mono text-[#444] uppercase">/km</div>
      </div>
      <div className="hidden sm:block text-right min-w-[54px]">
        <div className="font-display text-[13px] font-black text-[#f0ece4]">{run.avgHr ?? '—'}</div>
        <div className="text-[8px] font-mono text-[#444] uppercase">bpm</div>
      </div>
    </button>
  )
}

/** Distance per day over the last 7 days. */
function DistanceChart({ days }: { days: { label: string; km: number }[] }) {
  const max = Math.max(...days.map(d => d.km), 0.1)
  const total = days.reduce((s, d) => s + d.km, 0)
  const bestIdx = days.findIndex(d => d.km === max && d.km > 0)

  return (
    <div className="side-card bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-4">
      <div className="flex justify-between items-center mb-2.5">
        <div className="font-display text-[13px] font-black text-[#f0ece4]">Dystans · 7 dni</div>
        <div className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#f5a03a]/[0.12] text-[#f5a03a]">{total.toFixed(1)} km</div>
      </div>
      <div className="flex items-end justify-between gap-1 h-[80px] mb-1.5">
        {days.map((d, i) => (
          <div key={i}
            title={`${d.km.toFixed(1)} km`}
            data-h={d.km > 0 ? Math.max(8, Math.round((d.km / max) * 100)) : 3}
            className={`pace-bar flex-1 rounded-t-md rounded-b-sm transition-[height] duration-[1200ms] ease-[cubic-bezier(.16,1,.3,1)] ${
              i === bestIdx
                ? 'bg-gradient-to-b from-[#c8f53a]/70 to-[#c8f53a]/25'
                : d.km > 0 ? 'bg-gradient-to-b from-[#f5a03a]/60 to-[#f5a03a]/20' : 'bg-[#1a1a1a]'
            }`}
            style={{ height: '0%' }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[8px] font-mono text-[#333]">
        {days.map((d, i) => <span key={i}>{d.label}</span>)}
      </div>
    </div>
  )
}

function LastRunCard({ run, onClick }: { run: Run; onClick: () => void }) {
  return (
    <button onClick={onClick} className="side-card bg-[#0f0f0f] border border-[#1a1a1a] hover:border-[#2a2a2a] rounded-2xl p-4 text-left w-full transition-colors">
      <div className="flex justify-between items-center mb-3">
        <div className="font-display text-[13px] font-black text-[#f0ece4]">Ostatni bieg</div>
        <div className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#f5a03a]/[0.12] text-[#f5a03a]">{run.dateLabel}</div>
      </div>
      <div className="text-[12px] text-[#ccc] mb-3 truncate">{run.name}</div>
      <div className="grid grid-cols-3 gap-2">
        {[
          ['Dystans', `${run.distanceKm.toFixed(2)} km`],
          ['Czas', fmtDuration(run.durationSeconds)],
          ['Tempo', `${fmtPace(run.avgPaceSecondsPerKm)}/km`],
          ['Tętno', run.avgHr ? `${run.avgHr} bpm` : '—'],
          ['Przewyższ.', run.elevationGainM != null ? `${run.elevationGainM} m` : '—'],
          ['Typ', run.type],
        ].map(([l, v]) => (
          <div key={l}>
            <div className="text-[8px] font-mono text-[#444] uppercase tracking-[1px] mb-0.5">{l}</div>
            <div className="text-[12px] font-display font-black text-[#f0ece4]">{v}</div>
          </div>
        ))}
      </div>
    </button>
  )
}

function BottomCard({ title, items }: {
  title: string
  items: { label: string; value: string; accent?: boolean }[]
}) {
  return (
    <div className="bottom-card bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-4">
      <div className="text-[11px] font-mono text-[#888] uppercase tracking-[1.2px] mb-2.5">{title}</div>
      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div key={i} className="flex justify-between items-center text-[11px] gap-2">
            <span className="text-[#888] truncate">{item.label}</span>
            <span className={`font-display text-[13px] font-black flex-shrink-0 ${item.accent ? 'text-[#f5a03a]' : 'text-[#f0ece4]'}`}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function RunningOverview() {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)

  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('30d')
  const [typeFilter, setTypeFilter]   = useState<TypeFilter>('all')
  const [showAddRun, setShowAddRun]   = useState(false)

  const [allRuns, setAllRuns] = useState<Run[] | null>(null)
  const [weekGoalKm, setWeekGoalKm] = useState<number | null>(null)
  const [runningGoal, setRunningGoal] = useState<RunningGoal | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [runsRes, profileRes, goalsRes] = await Promise.all([
        fetch('/api/running?range=all&limit=500'),
        fetch('/api/profile'),
        fetch('/api/goals'),
      ])
      if (!runsRes.ok) throw new Error(`HTTP ${runsRes.status}`)
      const { runs } = await runsRes.json() as { runs: RunRow[] }
      setAllRuns(runs.map(toRun))
      setError('')
      if (profileRes.ok) setWeekGoalKm((await profileRes.json()).profile?.weeklyKmGoal ?? null)
      if (goalsRes.ok) {
        const { goals } = await goalsRes.json() as { goals: RunningGoal[] }
        setRunningGoal(goals.find(g => g.category === 'running' && g.status === 'active') ?? null)
      }
    } catch {
      setError('Nie udało się wczytać biegów. Sprawdź połączenie z bazą.')
      setAllRuns(prev => prev ?? [])
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Derived data ──────────────────────────────────────────────────────────
  const view = useMemo(() => {
    const runs = allRuns ?? []
    const days = RANGE_DAYS[rangeFilter]
    const now = Date.now()
    const since = now - days * 86400000
    const prevSince = now - 2 * days * 86400000

    const pr5 = bestTimeFor(runs, 5)
    const pr10 = bestTimeFor(runs, 10)
    const prHalf = bestTimeFor(runs, 21.0975)
    const prIds = new Set([pr5?.runId, pr10?.runId, prHalf?.runId].filter(Boolean))
    const withPR = runs.map(r => ({ ...r, isPR: prIds.has(r.id) }))

    const inRange = withPR.filter(r => r.ranAt.getTime() >= since)
    const prevRange = withPR.filter(r => r.ranAt.getTime() >= prevSince && r.ranAt.getTime() < since)

    const totalKm = inRange.reduce((s, r) => s + r.distanceKm, 0)
    const prevKm = prevRange.reduce((s, r) => s + r.distanceKm, 0)
    const totalSec = inRange.reduce((s, r) => s + r.durationSeconds, 0)
    const avgPace = avgPaceOf(inRange)
    const prevPace = avgPaceOf(prevRange)

    const weekStart = startOfWeek().getTime()
    const weekRuns = withPR.filter(r => r.ranAt.getTime() >= weekStart)

    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - (6 - i))
      const next = d.getTime() + 86400000
      return {
        label: d.toLocaleDateString('pl-PL', { weekday: 'short' }).slice(0, 2),
        km: withPR.filter(r => r.ranAt.getTime() >= d.getTime() && r.ranAt.getTime() < next).reduce((s, r) => s + r.distanceKm, 0),
      }
    })

    return {
      runs: withPR,
      inRange,
      totalKm,
      kmDeltaPct: prevKm > 0 ? Math.round(((totalKm - prevKm) / prevKm) * 100) : null,
      avgPace,
      paceDelta: avgPace && prevPace ? Math.round(avgPace - prevPace) : null,
      totalHours: totalSec / 3600,
      avgRunMinutes: inRange.length ? Math.round(totalSec / inRange.length / 60) : 0,
      pr5, pr10, prHalf,
      weekKm: weekRuns.reduce((s, r) => s + r.distanceKm, 0),
      weekCount: weekRuns.length,
      weekSec: weekRuns.reduce((s, r) => s + r.durationSeconds, 0),
      last7,
    }
  }, [allRuns, rangeFilter])

  const filteredRuns = useMemo(() => {
    const list = typeFilter === 'all' ? view.inRange : view.inRange.filter(r => r.type === typeFilter)
    return list.slice(0, 25)
  }, [view.inRange, typeFilter])

  const lastRun = view.runs[0]

  // ── Animations ────────────────────────────────────────────────────────────
  useGSAP(() => {
    if (!allRuns) return
    const tl = gsap.timeline({ delay: 0.05 })
    tl.from('.hero-card',  { opacity:0, y:16, duration:0.5, stagger:0.08, ease:'expo.out' })
    tl.from('.run-list-card, .side-card', { opacity:0, y:14, duration:0.45, stagger:0.08, ease:'expo.out' }, '-=0.25')
    tl.from('.bottom-card', { opacity:0, y:12, duration:0.4, stagger:0.07, ease:'expo.out' }, '-=0.2')
  }, { scope: containerRef, dependencies: [allRuns === null] })

  useEffect(() => {
    if (!allRuns) return
    animateCounter('cnt-distance', view.totalKm, 1100, v => `${v.toFixed(1)} km`)
    animateCounter('cnt-pace', view.avgPace, 900, v => (view.avgPace ? fmtPace(v) : '—'))
    animateCounter('cnt-hours', view.totalHours, 1000, v => `${v.toFixed(1)}h`)
    const t = setTimeout(() => {
      document.querySelectorAll<HTMLElement>('.pace-bar').forEach((b, i) => {
        setTimeout(() => { b.style.height = `${b.dataset.h}%` }, i * 70)
      })
    }, 300)
    return () => clearTimeout(t)
  }, [allRuns, view])

  const fmtOpt = (pr: { seconds: number } | null) => (pr ? fmtDuration(pr.seconds) : '—')

  return (
    <div ref={containerRef} className="flex min-h-full bg-[#080808] text-[#f0ece4] font-sans">
      <main className="flex-1 overflow-x-hidden">

        {/* TOPBAR */}
        <div className="run-topbar px-4 md:px-7 pt-5 md:pt-6 pb-2 flex flex-wrap gap-3 justify-between items-end">
          <div>
            <p className="text-[10px] font-mono text-[#444] uppercase tracking-[2px] mb-1">
              Bieganie · {RANGE_LONG[rangeFilter]}
            </p>
            <h1 className="font-display text-[24px] font-black">
              Twoje <em className="not-italic text-[#f5a03a]">biegi</em>
            </h1>
          </div>
          <div className="flex gap-2">
            <div className="flex gap-1.5">
              {(['7d', '30d', '90d', 'year'] as RangeFilter[]).map(r => (
                <button key={r} onClick={() => setRangeFilter(r)}
                  className={`px-3 md:px-3.5 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-[1.2px] transition-all border ${
                    rangeFilter === r
                      ? 'bg-[#f5a03a]/[0.08] border-[#f5a03a]/25 text-[#f5a03a]'
                      : 'bg-[#111] border-[#1e1e1e] text-[#888] hover:border-[#333]'
                  }`}>{RANGE_LABELS[r]}</button>
              ))}
            </div>
            <button onClick={() => setShowAddRun(true)}
              className="ml-1 px-4 py-1.5 rounded-lg bg-[#f5a03a] text-[#080808] text-[11px] font-mono uppercase tracking-[1.3px] font-medium hover:bg-[#ffb04a] hover:-translate-y-px active:scale-[0.98] transition-all flex items-center gap-1.5">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M5.5 2v7M2 5.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span className="hidden sm:inline">Dodaj bieg</span>
            </button>
            <button onClick={() => router.push('/running/import')}
              className="px-4 py-1.5 rounded-lg bg-[#111] border border-[#1e1e1e] text-[#888] text-[11px] font-mono uppercase tracking-[1.3px] font-medium hover:border-[#2e2e2e] hover:-translate-y-px active:scale-[0.98] transition-all flex items-center gap-1.5">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M5.5 8V2M3 4.5l2.5-2.5 2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 9.5h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <span className="hidden sm:inline">Import</span>
            </button>
          </div>
        </div>

        <div className="px-4 md:px-7 pb-6 md:pb-7 pt-3">
          {error && (
            <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] text-red-400">{error}</div>
          )}

          {allRuns === null ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {[0, 1, 2, 3].map(i => <div key={i} className="h-[92px] rounded-2xl bg-[#0f0f0f] border border-[#1a1a1a] animate-pulse" />)}
            </div>
          ) : (
            <>
              {/* HERO GRID */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-2.5 mb-3">
                <HeroCard accent tag="Dystans" valueColor="orange"
                  trend={view.kmDeltaPct != null ? `${view.kmDeltaPct >= 0 ? '+' : ''}${view.kmDeltaPct}%` : undefined}
                  trendUp={(view.kmDeltaPct ?? 0) >= 0}
                  value="0" sub={`${view.inRange.length} biegów · ${RANGE_LONG[rangeFilter]}`}
                  animateId="cnt-distance"
                />
                <HeroCard tag="Średnie tempo" valueColor="white"
                  trend={view.paceDelta ? `${view.paceDelta > 0 ? '+' : ''}${view.paceDelta}s` : undefined}
                  trendUp={(view.paceDelta ?? 0) <= 0}
                  value="—" sub="vs. poprzedni okres"
                  animateId="cnt-pace"
                />
                <HeroCard tag="Czas biegu" valueColor="white"
                  value="0h" sub={view.inRange.length ? `Średnio ${view.avgRunMinutes} min / bieg` : 'brak biegów w okresie'}
                  animateId="cnt-hours"
                />
                <HeroCard tag="Rekord 5 km" valueColor="lime"
                  trend={view.pr5 ? 'PR' : undefined} trendUp
                  value={fmtOpt(view.pr5)} sub={view.pr5 ? 'szacowany z biegów ≥ 5 km' : 'brak biegu ≥ 5 km'}
                />
              </div>

              {/* MAIN GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-3 mb-3">

                {/* RUN LIST */}
                <div className="run-list-card bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-[18px]">
                  <div className="flex flex-wrap gap-2 justify-between items-center mb-3.5">
                    <div className="font-display text-[14px] font-black">Ostatnie biegi</div>
                    <div className="flex gap-1.5">
                      {(['all', 'tempo', 'long', 'interval'] as TypeFilter[]).map(t => (
                        <button key={t} onClick={() => setTypeFilter(t)}
                          className={`px-2.5 py-1 rounded-md text-[9px] font-mono uppercase tracking-[1px] transition-all border ${
                            typeFilter === t
                              ? 'bg-[#f5a03a]/[0.08] border-[#f5a03a]/25 text-[#f5a03a]'
                              : 'bg-white/[0.02] border-white/[0.06] text-[#666] hover:text-[#f5a03a] hover:border-[#f5a03a]/20'
                          }`}>{TYPE_LABELS[t]}</button>
                      ))}
                    </div>
                  </div>

                  {filteredRuns.length === 0 ? (
                    <div className="text-center py-10 text-[12px] text-[#555]">
                      {allRuns.length === 0
                        ? <>Nie masz jeszcze żadnych biegów. <button onClick={() => setShowAddRun(true)} className="text-[#f5a03a] hover:underline">Dodaj pierwszy</button> albo zaimportuj zrzut ekranu.</>
                        : typeFilter === 'all' ? `Brak biegów w okresie: ${RANGE_LONG[rangeFilter]}` : `Brak biegów typu ${TYPE_LABELS[typeFilter]}`}
                    </div>
                  ) : filteredRuns.map(run => (
                    <RunListItem key={run.id} run={run} onClick={() => router.push(`/running/${run.id}`)} />
                  ))}
                </div>

                {/* SIDE COLUMN */}
                <div className="flex flex-col gap-2.5">
                  <DistanceChart days={view.last7} />
                  {lastRun && <LastRunCard run={lastRun} onClick={() => router.push(`/running/${lastRun.id}`)} />}
                </div>
              </div>

              {/* BOTTOM ROW */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <BottomCard title="Ten tydzień" items={[
                  { label: 'Dystans', value: weekGoalKm ? `${view.weekKm.toFixed(1)} / ${weekGoalKm} km` : `${view.weekKm.toFixed(1)} km`, accent: true },
                  { label: 'Liczba biegów', value: String(view.weekCount) },
                  { label: 'Czas', value: `${Math.floor(view.weekSec / 3600)}h ${Math.round((view.weekSec % 3600) / 60)}m` },
                ]} />
                <BottomCard title="Rekordy osobiste" items={[
                  { label: '5 km',       value: fmtOpt(view.pr5), accent: true },
                  { label: '10 km',      value: fmtOpt(view.pr10) },
                  { label: 'Półmaraton', value: fmtOpt(view.prHalf) },
                ]} />
                <BottomCard title="Cel biegowy" items={runningGoal ? [
                  { label: runningGoal.name, value: `${Number(runningGoal.target_value)} ${runningGoal.unit ?? ''}`, accent: true },
                  { label: 'Postęp', value: `${runningGoal.progress}%` },
                  { label: 'Termin', value: runningGoal.target_date ? new Date(runningGoal.target_date).toLocaleDateString('pl-PL') : '—' },
                ] : [
                  { label: 'Brak celu biegowego', value: '—' },
                  { label: 'Dodaj go w zakładce Cele', value: '→' },
                ]} />
              </div>
            </>
          )}
        </div>
      </main>

      {showAddRun && (
        <AddRunModal
          onClose={() => setShowAddRun(false)}
          onSaved={() => { setShowAddRun(false); load() }}
        />
      )}
    </div>
  )
}

function animateCounter(id: string, target: number, duration: number, fmt: (v: number) => string) {
  const el = document.getElementById(id)
  if (!el) return
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min((now - start) / duration, 1)
    const eased = 1 - Math.pow(1 - t, 4)
    el.textContent = fmt(eased * target)
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}
