'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type RunType = 'easy' | 'tempo' | 'long' | 'interval' | 'recovery' | 'race'

export interface Run {
  id: string
  name: string
  date: string
  distanceKm: number
  durationSeconds: number
  avgPaceSecondsPerKm: number
  avgHr: number | null
  maxHr: number | null
  elevationGainM: number | null
  location: string | null
  type: RunType
  isPR: boolean
  isToday: boolean
  routePath?: string
  hrZones?: number[]
}

export interface RunningStats {
  totalDistanceKm: number
  runCount: number
  avgPaceSecondsPerKm: number
  paceDeltaSeconds: number
  totalHours: number
  avgRunMinutes: number
  pr5kSeconds: number
  pr5kDeltaSeconds: number
  paceLast7Days: number[]
  weekDistanceKm: number
  weekGoalKm: number
  weekRunCount: number
  weekRunGoal: number
}

export interface RunningGoals {
  pr5k: { current: string; target: string }
  pr10k: { current: string; target: string }
  prHalf: { current: string; target: string }
  nextRace: { name: string; targetTime: string; date: string; weeksLeft: number }
}

type RangeFilter = '7d' | '30d' | '90d' | 'year'
type TypeFilter   = 'all' | 'tempo' | 'long' | 'interval'

// ─── MOCK DATA ────────────────────────────────────────────────────────────────

const MOCK_RUNS: Run[] = [
  { id:'r1', name:'Bieg poranny', date:'dziś · 7:14', distanceKm:12.4, durationSeconds:64*60+28, avgPaceSecondsPerKm:5*60+12, avgHr:152, maxHr:168, elevationGainM:142, location:'Ochota, Warszawa', type:'easy', isPR:false, isToday:true, hrZones:[8,42,32,14,4], routePath:'M 30 100 Q 70 60 110 75 T 200 50 Q 250 30 290 70 T 370 90' },
  { id:'r2', name:'Tempo 5 km', date:'wt · interwałowy', distanceKm:5.0, durationSeconds:22*60+14, avgPaceSecondsPerKm:4*60+26, avgHr:168, maxHr:182, elevationGainM:24, location:'Stadion Skra', type:'tempo', isPR:true, isToday:false },
  { id:'r3', name:'Long run niedzielny', date:'nd', distanceKm:18.2, durationSeconds:102*60+34, avgPaceSecondsPerKm:5*60+38, avgHr:144, maxHr:165, elevationGainM:88, location:'Park Skaryszewski', type:'long', isPR:false, isToday:false },
  { id:'r4', name:'Recovery run', date:'pt', distanceKm:6.0, durationSeconds:36*60+10, avgPaceSecondsPerKm:6*60+2, avgHr:132, maxHr:148, elevationGainM:32, location:null, type:'recovery', isPR:false, isToday:false },
  { id:'r5', name:'Interwały 6×400m', date:'śr', distanceKm:7.4, durationSeconds:35*60+50, avgPaceSecondsPerKm:4*60+50, avgHr:175, maxHr:188, elevationGainM:18, location:'Stadion Skra', type:'interval', isPR:false, isToday:false },
]

const MOCK_STATS: RunningStats = {
  totalDistanceKm: 148.6,
  runCount: 12,
  avgPaceSecondsPerKm: 5*60+12,
  paceDeltaSeconds: -8,
  totalHours: 9.4,
  avgRunMinutes: 47,
  pr5kSeconds: 22*60+14,
  pr5kDeltaSeconds: -32,
  paceLast7Days: [60, 48, 92, 65, 38, 72, 55],
  weekDistanceKm: 38.4,
  weekGoalKm: 45,
  weekRunCount: 3,
  weekRunGoal: 4,
}

const MOCK_GOALS: RunningGoals = {
  pr5k:  { current:'22:14',   target:'21:00' },
  pr10k: { current:'47:32',   target:'45:00' },
  prHalf:{ current:'1:48:00', target:'1:42:00' },
  nextRace: { name:'Maraton Warszawski', targetTime:'2:45:00', date:'28.09.2025', weeksLeft:22 },
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const fmtPace = (secondsPerKm: number) => {
  const m = Math.floor(secondsPerKm / 60)
  const s = secondsPerKm % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const fmtDuration = (s: number) => {
  if (s < 3600) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  }
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

const RANGE_LABELS: Record<RangeFilter, string> = { '7d':'7d', '30d':'30d', '90d':'90d', 'year':'Rok' }
const TYPE_LABELS: Record<TypeFilter, string> = { all:'Wszystkie', tempo:'Tempo', long:'Długie', interval:'Interwały' }

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
    <div className={`hero-card relative overflow-hidden rounded-2xl p-4 cursor-none transition-all duration-250 ${
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
      className="run-item grid grid-cols-[36px_1fr_auto_auto_auto] gap-3.5 items-center px-1.5 py-2.5 cursor-none transition-colors rounded-md hover:bg-white/[0.02] border-b border-[#131313] last:border-b-0 w-full text-left"
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
        <div className="text-[9px] font-mono text-[#444] truncate">{run.date}{run.location && ` · ${run.location}`}</div>
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

function PaceChart({ data, avgPace }: { data: number[]; avgPace: number }) {
  const max = Math.max(...data)
  const days = ['pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd']
  const bestIdx = data.indexOf(max)

  return (
    <div className="side-card bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-4">
      <div className="flex justify-between items-center mb-2.5">
        <div className="font-display text-[13px] font-black text-[#f0ece4]">Tempo · 7 dni</div>
        <div className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#f5a03a]/[0.12] text-[#f5a03a]">{fmtPace(avgPace)} śr.</div>
      </div>
      <div className="flex items-end justify-between gap-1 h-[80px] mb-1.5">
        {data.map((h, i) => (
          <div key={i}
            data-h={h}
            className={`pace-bar flex-1 rounded-t-md rounded-b-sm transition-[height] duration-[1200ms] ease-[cubic-bezier(.16,1,.3,1)] ${
              i === bestIdx
                ? 'bg-gradient-to-b from-[#c8f53a]/70 to-[#c8f53a]/25'
                : 'bg-gradient-to-b from-[#f5a03a]/60 to-[#f5a03a]/20'
            }`}
            style={{ height: '0%' }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[8px] font-mono text-[#333]">
        {days.map(d => <span key={d}>{d}</span>)}
      </div>
    </div>
  )
}

function MiniMap({ routePath, distanceKm, elevationGain }: {
  routePath?: string; distanceKm: number; elevationGain: number | null
}) {
  const pathRef = useRef<SVGPathElement>(null)

  useEffect(() => {
    const path = pathRef.current
    if (!path || !routePath) return
    const length = path.getTotalLength()
    path.style.strokeDasharray = String(length)
    path.style.strokeDashoffset = String(length)
    path.style.transition = 'stroke-dashoffset 2.2s cubic-bezier(.16,1,.3,1)'
    requestAnimationFrame(() => { path.style.strokeDashoffset = '0' })
  }, [routePath])

  return (
    <div className="side-card bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-4">
      <div className="flex justify-between items-center mb-2.5">
        <div className="font-display text-[13px] font-black text-[#f0ece4]">Trasa · dziś</div>
        <div className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#f5a03a]/[0.12] text-[#f5a03a]">{distanceKm.toFixed(1)} km</div>
      </div>
      <div className="relative h-[140px] rounded-xl overflow-hidden bg-[#0a0a0a] border border-[#161616]">
        <svg viewBox="0 0 400 140" preserveAspectRatio="none" className="w-full h-full block">
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(245,160,58,0.04)" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="400" height="140" fill="url(#grid)"/>
          {routePath && (
            <>
              <path ref={pathRef} d={routePath} fill="none" stroke="#f5a03a" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="30" cy="100" r="4" fill="#c8f53a"/>
              <circle cx="370" cy="90" r="4" fill="#f5a03a"/>
            </>
          )}
        </svg>
        <div className="absolute bottom-2 left-2.5 text-[9px] font-mono text-[#888] bg-black/70 px-2 py-1 rounded-md backdrop-blur-sm">
          {elevationGain != null ? `↑ ${elevationGain}m ↓ ${elevationGain - 4}m` : 'Brak danych'}
        </div>
      </div>
    </div>
  )
}

function HrZones({ zones, durationSeconds }: { zones: number[]; durationSeconds: number }) {
  const labels = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']
  const colors = ['#3a87f5', '#3af5b8', '#c8f53a', '#f5a03a', '#f53a3a']
  return (
    <div className="side-card bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-4">
      <div className="flex justify-between items-center mb-3">
        <div className="font-display text-[13px] font-black text-[#f0ece4]">Strefy tętna</div>
        <div className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-[#888]">{fmtDuration(durationSeconds)}</div>
      </div>
      <div className="flex flex-col gap-1.5">
        {zones.map((pct, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-[#666] w-7">{labels[i]}</span>
            <div className="flex-1 h-[5px] bg-[#1a1a1a] rounded-sm overflow-hidden">
              <div className="hr-zone-fill h-full rounded-sm transition-[width] duration-[1000ms] ease-[cubic-bezier(.16,1,.3,1)]"
                data-w={pct}
                style={{ width: '0%', background: colors[i] }}
              />
            </div>
            <span className="text-[9px] font-mono text-[#888] w-7 text-right">{pct}%</span>
          </div>
        ))}
      </div>
    </div>
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
          <div key={i} className="flex justify-between items-center text-[11px]">
            <span className="text-[#888]">{item.label}</span>
            <span className={`font-display text-[13px] font-black ${item.accent ? 'text-[#f5a03a]' : 'text-[#f0ece4]'}`}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

interface RunningOverviewProps {
  runs?: Run[]
  stats?: RunningStats
  goals?: RunningGoals
}

export default function RunningOverview({
  runs = MOCK_RUNS,
  stats = MOCK_STATS,
  goals = MOCK_GOALS,
}: RunningOverviewProps) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)

  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('30d')
  const [typeFilter, setTypeFilter]   = useState<TypeFilter>('all')

  const filteredRuns = useMemo(() => {
    if (typeFilter === 'all') return runs
    return runs.filter(r => r.type === typeFilter)
  }, [runs, typeFilter])

  const featuredRun = useMemo(() =>
    runs.find(r => r.isToday && r.routePath) ?? runs.find(r => r.routePath) ?? runs[0],
  [runs])

  useGSAP(() => {
    const tl = gsap.timeline({ delay: 0.05 })

    tl.from('.run-topbar', { opacity:0, y:-8, duration:0.4, ease:'expo.out' })
    tl.from('.hero-card',  { opacity:0, y:16, duration:0.5, stagger:0.08, ease:'expo.out' }, '-=0.2')
    tl.from('.run-list-card, .side-card', { opacity:0, y:14, duration:0.45, stagger:0.08, ease:'expo.out' }, '-=0.25')
    tl.from('.bottom-card', { opacity:0, y:12, duration:0.4, stagger:0.07, ease:'expo.out' }, '-=0.2')
    tl.from('.run-item',   { opacity:0, x:-10, duration:0.35, stagger:0.06, ease:'expo.out' }, '-=0.5')

    tl.call(() => {
      animateCounter('cnt-distance', stats.totalDistanceKm, 1100, v => `${v.toFixed(1)} km`)
      animateCounter('cnt-pace',     stats.avgPaceSecondsPerKm, 900, v => {
        const m = Math.floor(v / 60); const s = Math.round(v % 60)
        return `${m}:${String(s).padStart(2, '0')}`
      })
      animateCounter('cnt-hours', stats.totalHours, 1000, v => `${v.toFixed(1)}h`)

      document.querySelectorAll<HTMLElement>('.pace-bar').forEach((b, i) => {
        setTimeout(() => { b.style.height = `${b.dataset.h}%` }, i * 70)
      })

      document.querySelectorAll<HTMLElement>('.hr-zone-fill').forEach((z, i) => {
        setTimeout(() => { z.style.width = `${z.dataset.w}%` }, i * 100)
      })
    }, [], '-=0.5')
  }, { scope: containerRef })

  useGSAP(() => {
    const cards = containerRef.current?.querySelectorAll('.hero-card, .bottom-card, .side-card')
    cards?.forEach(card => {
      card.addEventListener('mouseenter', () => gsap.to(card, { y:-3, duration:0.25, ease:'power2.out' }))
      card.addEventListener('mouseleave', () => gsap.to(card, { y:0,  duration:0.25, ease:'power2.out' }))
    })
  }, { scope: containerRef })

  return (
    <div ref={containerRef} className="flex h-screen bg-[#080808] text-[#f0ece4] font-sans overflow-hidden">
      <main className="flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

        {/* TOPBAR */}
        <div className="run-topbar px-4 md:px-7 pt-5 md:pt-6 pb-2 flex justify-between items-end">
          <div>
            <p className="text-[10px] font-mono text-[#444] uppercase tracking-[2px] mb-1">
              Bieganie · {rangeFilter === '7d' ? '7 dni' : rangeFilter === '30d' ? '30 dni' : rangeFilter === '90d' ? '90 dni' : 'rok'}
            </p>
            <h1 className="font-display text-[24px] font-black">
              Twoje <em className="not-italic text-[#f5a03a]">biegi</em>
            </h1>
          </div>
          <div className="flex gap-2">
            <div className="flex gap-1.5">
              {(['7d', '30d', '90d', 'year'] as RangeFilter[]).map(r => (
                <button key={r} onClick={() => setRangeFilter(r)}
                  className={`px-3.5 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-[1.2px] transition-all border cursor-none ${
                    rangeFilter === r
                      ? 'bg-[#f5a03a]/[0.08] border-[#f5a03a]/25 text-[#f5a03a]'
                      : 'bg-[#111] border-[#1e1e1e] text-[#888] hover:border-[#333]'
                  }`}>{RANGE_LABELS[r]}</button>
              ))}
            </div>
            <button onClick={() => router.push('/running/import')}
              className="ml-2 px-4 py-1.5 rounded-lg bg-[#f5a03a] text-[#080808] text-[11px] font-mono uppercase tracking-[1.3px] font-medium hover:bg-[#ffb04a] hover:-translate-y-px active:scale-[0.98] transition-all cursor-none flex items-center gap-1.5">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M5.5 8V2M3 4.5l2.5-2.5 2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 9.5h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <span className="hidden sm:inline">Import Garmin</span>
            </button>
          </div>
        </div>

        <div className="px-4 md:px-7 pb-6 md:pb-7 pt-3">

          {/* HERO GRID */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-2.5 mb-3">
            <HeroCard accent tag="Dystans" trend="+12%" trendUp valueColor="orange"
              value="0" sub={`${stats.runCount} biegów · 30 dni`}
              animateId="cnt-distance"
            />
            <HeroCard tag="Średnie tempo" trend={`-${Math.abs(stats.paceDeltaSeconds)}s`} trendUp valueColor="white"
              value="0:00" sub="vs. miesiąc temu"
              animateId="cnt-pace"
            />
            <HeroCard tag="Czas biegu" valueColor="white"
              value="0h" sub={`Średnio ${stats.avgRunMinutes} min / bieg`}
              animateId="cnt-hours"
            />
            <HeroCard tag="Rekord 5 km" trend="PR" trendUp valueColor="lime"
              value={fmtDuration(stats.pr5kSeconds)} sub={`poprawa o 0:${Math.abs(stats.pr5kDeltaSeconds)}`}
            />
          </div>

          {/* MAIN GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-3 mb-3">

            {/* RUN LIST */}
            <div className="run-list-card bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-[18px]">
              <div className="flex justify-between items-center mb-3.5">
                <div className="font-display text-[14px] font-black">Ostatnie biegi</div>
                <div className="flex gap-1.5">
                  {(['all', 'tempo', 'long', 'interval'] as TypeFilter[]).map(t => (
                    <button key={t} onClick={() => setTypeFilter(t)}
                      className={`px-2.5 py-1 rounded-md text-[9px] font-mono uppercase tracking-[1px] transition-all border cursor-none ${
                        typeFilter === t
                          ? 'bg-[#f5a03a]/[0.08] border-[#f5a03a]/25 text-[#f5a03a]'
                          : 'bg-white/[0.02] border-white/[0.06] text-[#666] hover:text-[#f5a03a] hover:border-[#f5a03a]/20'
                      }`}>{TYPE_LABELS[t]}</button>
                  ))}
                </div>
              </div>

              {filteredRuns.length === 0 ? (
                <div className="text-center py-10 text-[12px] text-[#555]">
                  Brak biegów typu {TYPE_LABELS[typeFilter]}
                </div>
              ) : filteredRuns.map(run => (
                <RunListItem key={run.id} run={run} onClick={() => router.push(`/running/${run.id}`)} />
              ))}
            </div>

            {/* SIDE COLUMN */}
            <div className="flex flex-col gap-2.5">
              <PaceChart data={stats.paceLast7Days} avgPace={stats.avgPaceSecondsPerKm} />
              {featuredRun && (
                <MiniMap
                  routePath={featuredRun.routePath}
                  distanceKm={featuredRun.distanceKm}
                  elevationGain={featuredRun.elevationGainM}
                />
              )}
              {featuredRun?.hrZones && (
                <HrZones zones={featuredRun.hrZones} durationSeconds={featuredRun.durationSeconds} />
              )}
            </div>
          </div>

          {/* BOTTOM ROW */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <BottomCard title="Cele tygodnia" items={[
              { label:'Dystans',       value:`${stats.weekDistanceKm.toFixed(1)} / ${stats.weekGoalKm} km`, accent:true },
              { label:'Liczba biegów', value:`${stats.weekRunCount} / ${stats.weekRunGoal}` },
              { label:'Czas',          value:`${Math.floor(stats.totalHours)}h ${Math.round((stats.totalHours % 1) * 60)}m` },
            ]} />
            <BottomCard title="Rekordy osobiste" items={[
              { label:'5 km',        value:goals.pr5k.current, accent:true },
              { label:'10 km',       value:goals.pr10k.current },
              { label:'Półmaraton',  value:goals.prHalf.current },
            ]} />
            <BottomCard title="Następny cel" items={[
              { label:goals.nextRace.name, value:goals.nextRace.targetTime, accent:true },
              { label:'Termin',            value:goals.nextRace.date },
              { label:'Tygodni',           value:String(goals.nextRace.weeksLeft) },
            ]} />
          </div>
        </div>
      </main>
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
