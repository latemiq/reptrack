'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { fmtDuration, relativeDay } from '@/lib/stats'
import { useNotificationsStore, selectUnreadCount } from '@/lib/stores/useNotificationsStore'
import AddWeightModal from '@/components/weight/AddWeightModal'

interface DashboardData {
  weekNumber: number
  week: {
    km: number
    goalKm: number | null
    deltaPct: number | null
    runs: number
    workouts: number
    days: { date: string; today: boolean; run: boolean; lift: boolean }[]
  }
  weight: {
    latest: number | null
    delta: number | null
    history: number[]
    goal: { target: number; progress: number } | null
  }
  records: {
    best5kSeconds: number | null
    lifts: { name: string; kg: number }[]
  }
  activities: { id: string; type: 'run' | 'lift'; name: string; at: string; value: number; unit: string }[]
  goals: { id: string; name: string; category: string | null; target: number; unit: string | null; progress: number }[]
}

const WEEK = ['pon', 'wt', 'śr', 'czw', 'pt', 'sb', 'nd']
const ARC_CIRCUMFERENCE = 2 * Math.PI * 18

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Dobry wieczór'
  if (h < 12) return 'Dobry ranek'
  if (h < 18) return 'Dzień dobry'
  return 'Dobry wieczór'
}

function ArcSVG({ id, color = '#c8f53a' }: { id: string; color?: string }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="overflow-visible absolute top-4 right-4">
      <circle cx="24" cy="24" r="18" fill="none" stroke="#1a1a1a" strokeWidth="3" />
      <circle
        id={id} cx="24" cy="24" r="18" fill="none"
        stroke={color} strokeWidth="3" strokeLinecap="round"
        strokeDasharray={ARC_CIRCUMFERENCE}
        strokeDashoffset={ARC_CIRCUMFERENCE}
        transform="rotate(-90 24 24)"
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.16,1,.3,1)' }}
      />
    </svg>
  )
}

function WeekStrip({ days }: { days: DashboardData['week']['days'] }) {
  return (
    <div className="flex gap-1.5 mt-3.5">
      {days.map((d, i) => {
        const s = d.today && !d.run && !d.lift ? 'today' : d.run ? 'run' : d.lift ? 'lift' : ''
        return (
          <div key={d.date} className={`flex-1 rounded-lg py-1.5 px-1 text-center border transition-colors ${
            s === 'today'  ? 'bg-[#c8f53a]/[0.08] border-[#c8f53a]/40'
            : s === 'run'  ? 'bg-[#c8f53a]/[0.05] border-[#c8f53a]/20'
            : s === 'lift' ? 'bg-[#f5a03a]/[0.05] border-[#f5a03a]/20'
            : 'bg-[#131313] border-[#1a1a1a]'
          }`}>
            <span className={`block text-[7px] font-mono uppercase mb-1 ${d.today ? 'text-[#c8f53a]' : 'text-[#333]'}`}>{WEEK[i]}</span>
            <div className={`w-1 h-1 rounded-full mx-auto ${
              s === 'run' || s === 'today' ? 'bg-[#c8f53a]'
              : s === 'lift' ? 'bg-[#f5a03a]'
              : 'bg-[#1e1e1e]'
            }`} />
          </div>
        )
      })}
    </div>
  )
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-[#555] py-6 text-center">{children}</p>
}

export default function Dashboard() {
  const { user } = useUser()
  const displayName = user?.firstName ?? user?.username ?? 'Sportowcu'
  const router = useRouter()
  const unreadCount = useNotificationsStore(selectUnreadCount)

  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [showWeight, setShowWeight] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const mainRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/dashboard')
      .then(async res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(json => { if (!cancelled) { setData(json); setError('') } })
      .catch(() => { if (!cancelled) setError('Nie udało się wczytać danych. Sprawdź połączenie z bazą.') })
    return () => { cancelled = true }
  }, [reloadKey])

  const weekPct = data?.week.goalKm ? Math.min(100, Math.round((data.week.km / data.week.goalKm) * 100)) : 0
  const weightPct = data?.weight.goal?.progress ?? 0

  useGSAP(() => {
    if (!data) return
    const tl = gsap.timeline({ delay: 0.05 })
    tl.from('.dash-hero', { opacity: 0, y: 20, duration: 0.5, stagger: 0.1, ease: 'expo.out' })
    tl.from('.dash-panel', { opacity: 0, y: 16, duration: 0.45, stagger: 0.08, ease: 'expo.out' }, '-=0.3')
    tl.call(() => {
      animateCounter('dash-cv-0', data.week.km, 1100, 1)
      if (data.weight.latest != null) animateCounter('dash-cv-1', data.weight.latest, 900, 1)
      setArc('dash-arc-0', weekPct)
      setArc('dash-arc-1', weightPct)
      document.querySelectorAll<HTMLElement>('[data-goal-bar]').forEach((bar, i) => {
        setTimeout(() => { bar.style.width = `${bar.dataset.goalBar}%` }, i * 120)
      })
    }, [], '-=0.4')
    tl.from('.dash-feed-item', { opacity: 0, x: -10, duration: 0.35, stagger: 0.07, ease: 'expo.out' }, '-=0.6')
  }, { scope: mainRef, dependencies: [data] })

  const weightBars = data?.weight.history ?? []
  const wMin = Math.min(...weightBars), wMax = Math.max(...weightBars)

  return (
    <div ref={mainRef} className="min-h-full bg-[#080808] text-[#f0ece4] font-sans">
      <main className="w-full overflow-x-hidden bg-[#080808]">
        {/* TOP BAR */}
        <div className="flex justify-between items-center px-4 md:px-7 pt-5 md:pt-6 mb-6">
          <div>
            <p className="text-[10px] font-mono text-[#444] uppercase tracking-[2px] mb-1">
              {new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="font-display text-[20px] md:text-[22px] font-black text-[#f0ece4]">
              {greeting()}, <em className="not-italic text-[#c8f53a]">{displayName}</em>
            </h1>
          </div>
          <div className="flex items-center gap-2.5">
            {data && <span className="text-[10px] font-mono text-[#444] uppercase tracking-[1.5px]">Tydzień {data.weekNumber}</span>}
            <Link href="/notifications" aria-label="Powiadomienia"
              className="relative w-9 h-9 rounded-xl bg-[#111] border border-[#1e1e1e] flex items-center justify-center hover:border-[#333] transition-colors">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2a4 4 0 00-4 4c0 2-.5 3-1.5 4h11C12.5 9 12 8 12 6a4 4 0 00-4-4zM6.5 13.5a1.5 1.5 0 003 0" stroke="#888" strokeWidth="1.5" strokeLinecap="round"/></svg>
              {unreadCount > 0 && <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#c8f53a] border-2 border-[#080808]" />}
            </Link>
          </div>
        </div>

        <div className="px-4 md:px-7 pb-7 space-y-3">
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] text-red-400 flex justify-between items-center">
              {error}
              <button onClick={() => setReloadKey(k => k + 1)} className="font-mono text-[10px] uppercase tracking-wider hover:text-red-300">Ponów</button>
            </div>
          )}

          {!data && !error && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[0, 1, 2].map(i => <div key={i} className="h-[170px] rounded-2xl bg-[#0f0f0f] border border-[#1a1a1a] animate-pulse" />)}
            </div>
          )}

          {data && (
            <>
              {/* HERO KARTY */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 md:gap-3">

                {/* Km tygodnia */}
                <div className="dash-hero bg-[#0f0f0f] border border-[#c8f53a]/15 rounded-2xl p-5 relative overflow-hidden hover:border-[#c8f53a]/30 transition-colors">
                  {data.week.goalKm != null && <ArcSVG id="dash-arc-0" />}
                  <p className="text-[9px] font-mono text-[#444] uppercase tracking-[1.5px] mb-2.5 flex items-center justify-between pr-14">
                    Km / tydzień
                    {data.week.deltaPct != null && (
                      <span className={`rounded px-1.5 py-0.5 ${data.week.deltaPct >= 0 ? 'text-[#c8f53a] bg-[#c8f53a]/10' : 'text-[#f5a03a] bg-[#f5a03a]/10'}`}>
                        {data.week.deltaPct >= 0 ? '+' : ''}{data.week.deltaPct}%
                      </span>
                    )}
                  </p>
                  <div id="dash-cv-0" className="font-display text-[34px] font-black text-[#c8f53a] leading-none mb-1">0</div>
                  <p className="text-[10px] font-mono text-[#444]">
                    {data.week.goalKm != null
                      ? `cel: ${data.week.goalKm} km · zostało ${Math.max(0, Math.round((data.week.goalKm - data.week.km) * 10) / 10)}`
                      : <Link href="/settings" className="hover:text-[#c8f53a]">ustaw cel tygodniowy →</Link>}
                  </p>
                  <WeekStrip days={data.week.days} />
                </div>

                {/* Masa ciała */}
                <div className="dash-hero bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-5 relative overflow-hidden hover:border-[#2a2a2a] transition-colors">
                  {data.weight.goal && <ArcSVG id="dash-arc-1" color="#f5a03a" />}
                  <p className="text-[9px] font-mono text-[#444] uppercase tracking-[1.5px] mb-2.5 flex items-center justify-between pr-14">
                    Masa ciała
                    {data.weight.delta != null && data.weight.delta !== 0 && (
                      <span className="text-[#f5a03a] bg-[#f5a03a]/10 rounded px-1.5 py-0.5">{data.weight.delta > 0 ? '+' : ''}{data.weight.delta}kg</span>
                    )}
                  </p>
                  {data.weight.latest != null ? (
                    <>
                      <div id="dash-cv-1" className="font-display text-[34px] font-black text-[#f0ece4] leading-none mb-1">0</div>
                      <p className="text-[10px] font-mono text-[#444]">
                        {data.weight.goal
                          ? `cel: ${data.weight.goal.target} kg · zostało ${Math.abs(Math.round((data.weight.latest - data.weight.goal.target) * 10) / 10)} kg`
                          : 'brak celu wagowego'}
                      </p>
                      <div className="flex gap-1 items-end h-7 mt-3.5">
                        {weightBars.map((v, i) => {
                          const h = wMax > wMin ? ((v - wMin) / (wMax - wMin)) * 20 + 6 : 14
                          return <div key={i} className="flex-1 rounded-sm" style={{ height: h, background: i === weightBars.length - 1 ? '#f5a03a' : '#1e1e1e' }} />
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="font-display text-[34px] font-black text-[#333] leading-none mb-1">—</div>
                  )}
                  <button onClick={() => setShowWeight(true)}
                    className="mt-3 text-[9px] font-mono uppercase tracking-[1.5px] text-[#555] hover:text-[#f5a03a] transition-colors">
                    + Dodaj pomiar
                  </button>
                </div>

                {/* Rekordy */}
                <div className="dash-hero bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-5 relative overflow-hidden hover:border-[#2a2a2a] transition-colors">
                  <p className="text-[9px] font-mono text-[#444] uppercase tracking-[1.5px] mb-2.5">Rekord 5 km</p>
                  <div className="font-display text-[26px] font-black text-[#f0ece4] leading-none mb-1">
                    {data.records.best5kSeconds != null ? fmtDuration(data.records.best5kSeconds) : '—'}
                  </div>
                  <p className="text-[10px] font-mono text-[#444] mb-4">
                    {data.records.best5kSeconds != null ? 'szacowany z biegów ≥ 5 km' : 'przebiegnij 5 km, żeby ustanowić rekord'}
                  </p>
                  <div className="flex flex-col gap-2">
                    {data.records.lifts.length === 0 && (
                      <span className="text-[10px] font-mono text-[#333]">Brak rekordów siłowych</span>
                    )}
                    {data.records.lifts.map(l => (
                      <div key={l.name} className="flex justify-between items-center gap-2">
                        <span className="text-[10px] font-mono text-[#444] truncate">{l.name}</span>
                        <span className="text-[10px] font-mono text-[#c8f53a] flex-shrink-0">{l.kg} kg</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* DOLNA SIATKA */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

                {/* Feed aktywności */}
                <div className="dash-panel bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-5">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="font-display text-[15px] font-black text-[#f0ece4]">Aktywności</h2>
                    <Link href="/gym/history" className="text-[9px] font-mono text-[#444] uppercase tracking-[1.5px] hover:text-[#c8f53a] transition-colors">Historia →</Link>
                  </div>
                  {data.activities.length === 0 ? (
                    <EmptyLine>
                      Brak aktywności. <Link href="/gym" className="text-[#f5a03a] hover:underline">Zacznij trening</Link> albo <Link href="/running" className="text-[#c8f53a] hover:underline">dodaj bieg</Link>.
                    </EmptyLine>
                  ) : (
                    <div className="flex flex-col">
                      {data.activities.map((a, i) => (
                        <button key={`${a.type}-${a.id}`}
                          onClick={() => router.push(a.type === 'run' ? `/running/${a.id}` : '/gym/history')}
                          className={`dash-feed-item flex items-center gap-2.5 py-2.5 text-left hover:bg-white/[0.015] rounded-md ${i < data.activities.length - 1 ? 'border-b border-[#131313]' : ''}`}>
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-[14px]
                            ${a.type === 'run' ? 'bg-[#c8f53a]/10 border border-[#c8f53a]/20' : 'bg-[#f5a03a]/10 border border-[#f5a03a]/20'}`}>
                            {a.type === 'run' ? '🏃' : '🏋️'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-medium text-[#ccc] truncate">{a.name}</div>
                            <div className="text-[9px] font-mono text-[#444]">{relativeDay(a.at)}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-display text-[14px] font-black text-[#f0ece4]">{a.value}</div>
                            <div className="text-[9px] font-mono text-[#444]">{a.unit}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cele */}
                <div className="dash-panel bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-5">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="font-display text-[15px] font-black text-[#f0ece4]">Cele</h2>
                    <Link href="/goals" className="text-[9px] font-mono text-[#444] uppercase tracking-[1.5px] hover:text-[#c8f53a] transition-colors">Edytuj →</Link>
                  </div>
                  {data.goals.length === 0 ? (
                    <EmptyLine>Nie masz aktywnych celów. <Link href="/goals" className="text-[#c88cff] hover:underline">Dodaj pierwszy</Link>.</EmptyLine>
                  ) : (
                    <div className="flex flex-col gap-3.5">
                      {data.goals.map(g => {
                        const orange = g.category === 'running' || g.category === 'body'
                        return (
                          <div key={g.id}>
                            <div className="flex justify-between items-baseline mb-1.5 gap-2">
                              <span className="text-[11px] text-[#777] truncate">{g.name} — {g.target} {g.unit ?? ''}</span>
                              <span className={`text-[10px] font-mono flex-shrink-0 ${orange ? 'text-[#f5a03a]' : 'text-[#c8f53a]'}`}>{g.progress}%</span>
                            </div>
                            <div className="h-1 bg-[#141414] rounded-full overflow-hidden">
                              <div data-goal-bar={g.progress}
                                className={`h-full rounded-full transition-[width] duration-[1200ms] ease-[cubic-bezier(.16,1,.3,1)] ${orange ? 'bg-[#f5a03a]' : 'bg-[#c8f53a]'}`}
                                style={{ width: 0 }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* AI COACH */}
              <div onClick={() => router.push('/coach')}
                className="dash-panel bg-[#0f0f0f] border border-[#c8f53a]/15 rounded-2xl p-5 relative overflow-hidden cursor-pointer hover:border-[#c8f53a]/35 transition-colors group">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c8f53a]/40 to-transparent" />
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-2 h-2 rounded-full bg-[#c8f53a] animate-pulse" />
                  <span className="text-[10px] font-mono text-[#c8f53a] uppercase tracking-[2px]">AI Coach</span>
                  <span className="ml-auto text-[9px] font-mono text-[#444] group-hover:text-[#c8f53a] transition-colors">Otwórz →</span>
                </div>
                <p className="text-[12px] text-[#888] leading-relaxed">
                  W tym tygodniu: <strong className="text-[#f0ece4] font-medium">{data.week.workouts}</strong> {data.week.workouts === 1 ? 'trening siłowy' : 'treningi siłowe'} i{' '}
                  <strong className="text-[#f0ece4] font-medium">{data.week.runs}</strong> {data.week.runs === 1 ? 'bieg' : 'biegi'} ({data.week.km} km).
                  Zapytaj coacha o analizę tygodnia, plan na kolejne dni albo progres w ćwiczeniach.
                </p>
              </div>
            </>
          )}
        </div>
      </main>

      {showWeight && (
        <AddWeightModal
          onClose={() => setShowWeight(false)}
          onSaved={() => { setShowWeight(false); setReloadKey(k => k + 1) }}
        />
      )}
    </div>
  )
}

function animateCounter(id: string, target: number, duration: number, decimals: number) {
  const el = document.getElementById(id)
  if (!el) return
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min((now - start) / duration, 1)
    const eased = 1 - Math.pow(1 - t, 4)
    el.textContent = (eased * target).toFixed(decimals)
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

function setArc(id: string, pct: number) {
  const el = document.getElementById(id)
  if (!el) return
  el.setAttribute('stroke-dashoffset', String(ARC_CIRCUMFERENCE - (ARC_CIRCUMFERENCE * pct) / 100))
}
