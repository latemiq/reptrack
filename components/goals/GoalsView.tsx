'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useRef, useState } from 'react'
import AddGoalModal from './AddGoalModal'

type KpiTone = 'purple' | 'lime' | 'orange' | 'white'
type GoalTone = 'strength' | 'running' | 'body' | 'habit'
type GoalStatus = 'onTrack' | 'ahead' | 'plateau'

interface GoalCard {
  category: string
  tone: GoalTone
  status: GoalStatus
  statusLabel: string
  title: string
  current: string
  currentUnit?: string
  target: string
  meta: string
  progress: number
}

const FEATURE_PROGRESS = 55
const FEATURE_CIRC = 2 * Math.PI * 90

const kpiTone: Record<KpiTone, { value: string; trend: string; card: string }> = {
  purple: {
    value: 'text-[#c88cff]',
    trend: 'text-[#c88cff] bg-[#c88cff]/10',
    card: 'border-[#c88cff]/20 bg-[#c88cff]/[0.04]',
  },
  lime: {
    value: 'text-[#c8f53a]',
    trend: 'text-[#c8f53a] bg-[#c8f53a]/10',
    card: 'border-[#1a1a1a] bg-[#0f0f0f]',
  },
  orange: {
    value: 'text-[#f5a03a]',
    trend: 'text-[#f5a03a] bg-[#f5a03a]/10',
    card: 'border-[#1a1a1a] bg-[#0f0f0f]',
  },
  white: {
    value: 'text-[#f0ece4]',
    trend: 'text-[#c88cff] bg-[#c88cff]/10',
    card: 'border-[#1a1a1a] bg-[#0f0f0f]',
  },
}

const goalTone: Record<GoalTone, { tag: string; fill: string; dot: string }> = {
  strength: {
    tag: 'text-[#f5a03a] bg-[#f5a03a]/10',
    fill: 'bg-[#f5a03a]',
    dot: 'bg-[#f5a03a]',
  },
  running: {
    tag: 'text-[#c8f53a] bg-[#c8f53a]/10',
    fill: 'bg-[#c8f53a]',
    dot: 'bg-[#c8f53a]',
  },
  body: {
    tag: 'text-[#3cc8ff] bg-[#3cc8ff]/10',
    fill: 'bg-[#3cc8ff]',
    dot: 'bg-[#3cc8ff]',
  },
  habit: {
    tag: 'text-[#c88cff] bg-[#c88cff]/10',
    fill: 'bg-[#c88cff]',
    dot: 'bg-[#c88cff]',
  },
}

const statusTone: Record<GoalStatus, { text: string; dot: string }> = {
  onTrack: { text: 'text-[#c8f53a]', dot: 'bg-[#c8f53a]' },
  ahead: { text: 'text-[#3cc8ff]', dot: 'bg-[#3cc8ff]' },
  plateau: { text: 'text-[#f5a03a]', dot: 'bg-[#f5a03a]' },
}

const kpis = [
  { label: 'Aktywne', value: 5, trend: '5', sub: '2 dodane w tym mies.', tone: 'purple' as const },
  { label: 'Na dobrej drodze', value: 4, trend: '✓', sub: 'z 5 aktywnych', tone: 'lime' as const },
  { label: 'Wymaga uwagi', value: 1, trend: '!', sub: 'plateau lub spóźnienie', tone: 'orange' as const },
  { label: 'Ukończone', value: 8, trend: '2026', sub: 'w tym roku', tone: 'white' as const },
]

const activeGoals: GoalCard[] = [
  {
    category: '🏋️ Siła',
    tone: 'strength',
    status: 'onTrack',
    statusLabel: 'Na drodze',
    title: 'Martwy ciąg → 160 kg',
    current: '140',
    currentUnit: 'kg',
    target: '160 kg',
    meta: '21.06.2026 · 6 tyg.',
    progress: 72,
  },
  {
    category: '🏃 Bieganie',
    tone: 'running',
    status: 'onTrack',
    statusLabel: 'Na drodze',
    title: 'Maraton → 3:45',
    current: '4:10',
    target: '3:45',
    meta: '28.09.2026 · 20 tyg.',
    progress: 55,
  },
  {
    category: '⚖️ Sylwetka',
    tone: 'body',
    status: 'onTrack',
    statusLabel: 'Na drodze',
    title: 'Masa ciała → 76 kg',
    current: '78.0',
    currentUnit: 'kg',
    target: '76 kg',
    meta: '15.07.2026 · 9 tyg.',
    progress: 67,
  },
  {
    category: '🎯 Nawyk',
    tone: 'habit',
    status: 'ahead',
    statusLabel: 'Przed planem',
    title: '50 km / tydzień (4 tyg.)',
    current: '38.4',
    currentUnit: 'km',
    target: '50 km',
    meta: 'aktywny · ten tydz.',
    progress: 76,
  },
  {
    category: '🏋️ Siła',
    tone: 'strength',
    status: 'plateau',
    statusLabel: 'Plateau',
    title: 'Wyciskanie → 110 kg',
    current: '100',
    currentUnit: 'kg',
    target: '110 kg',
    meta: '30.06.2026 · 7 tyg.',
    progress: 40,
  },
  {
    category: '🏃 Bieganie',
    tone: 'running',
    status: 'onTrack',
    statusLabel: 'Na drodze',
    title: 'PR 5 km → 21:00',
    current: '22:14',
    target: '21:00',
    meta: 'otwarty · brak terminu',
    progress: 44,
  },
]

const aiTips = [
  {
    tone: 'bg-[#c8f53a]',
    label: 'Sugestia',
    text: <>Tempo 5 km się <strong className="text-[#f0ece4] font-medium">poprawia</strong>. Rozważ podniesienie celu maratonu do <strong className="text-[#f0ece4] font-medium">3:42</strong>.</>,
  },
  {
    tone: 'bg-[#f5a03a]',
    label: 'Uwaga',
    text: <>Cel <strong className="text-[#f0ece4] font-medium">martwy ciąg 160 kg</strong> stoi w miejscu od 3 tyg. Spróbuj deload.</>,
  },
  {
    tone: 'bg-[#c88cff]',
    label: 'Nowy cel?',
    text: <>Bazując na progresie tempa, możesz celować w <strong className="text-[#f0ece4] font-medium">półmaraton sub-1:45</strong>.</>,
  },
]

const timelineEvents = [
  { label: 'DZIŚ', left: 8, tone: 'bg-[#c8f53a] animate-pulse', size: 'w-2.5 h-2.5 rounded-full', top: true },
  { label: '160 kg · 21.06', left: 22, tone: 'bg-[#c88cff]', size: 'w-2.5 h-2.5 rounded-full' },
  { label: 'Bench 110', left: 31, tone: 'bg-[#1e1e1e]', size: 'w-2 h-2 rounded-full', top: true },
  { label: 'Waga 76 kg', left: 50, tone: 'bg-[#1e1e1e]', size: 'w-2 h-2 rounded-full' },
  { label: 'Półmaraton', left: 70, tone: 'bg-[#1e1e1e]', size: 'w-2 h-2 rounded-full', top: true },
  { label: 'Maraton · 28.09', left: 92, tone: 'bg-[#c8f53a]', size: 'w-3.5 h-3.5 rounded-[3px]' },
]

const completedGoals = [
  { icon: '🏃', name: 'PR 10 km → 47:32', date: '12.04.2026' },
  { icon: '🏋️', name: 'Przysiad 120 kg', date: '28.03.2026' },
  { icon: '🎯', name: '4 treningi / tydzień · Q1', date: '31.03.2026' },
]

function animateCounter(el: HTMLElement, target: number, duration: number) {
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min((now - start) / duration, 1)
    const eased = 1 - Math.pow(1 - t, 4)
    el.textContent = String(Math.round(eased * target))
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

export default function GoalsView() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [showAddGoal, setShowAddGoal] = useState(false)

  useGSAP(() => {
    const root = rootRef.current
    if (!root) return

    const tl = gsap.timeline({ delay: 0.05 })
    tl.from(root.querySelectorAll('.goals-reveal'), {
      opacity: 0,
      y: 14,
      duration: 0.45,
      stagger: 0.055,
      ease: 'expo.out',
    })

    tl.call(() => {
      root.querySelectorAll<HTMLElement>('[data-count-target]').forEach((el, index) => {
        animateCounter(el, Number(el.dataset.countTarget ?? 0), 760 + index * 90)
      })

      root.querySelectorAll<HTMLElement>('[data-progress-target]').forEach((bar, index) => {
        gsap.to(bar, {
          width: `${bar.dataset.progressTarget}%`,
          duration: 1.15,
          delay: index * 0.06,
          ease: 'expo.out',
        })
      })

      const circle = root.querySelector<SVGCircleElement>('[data-feature-circle]')
      if (circle) {
        gsap.to(circle, {
          strokeDashoffset: FEATURE_CIRC * (1 - FEATURE_PROGRESS / 100),
          duration: 1.45,
          ease: 'expo.out',
        })
      }

      const pct = root.querySelector<HTMLElement>('[data-feature-percent]')
      if (pct) {
        const state = { value: 0 }
        gsap.to(state, {
          value: FEATURE_PROGRESS,
          duration: 1.15,
          ease: 'expo.out',
          onUpdate: () => {
            pct.textContent = `${Math.round(state.value)}%`
          },
        })
      }
    }, undefined, '-=0.2')

    gsap.from(root.querySelectorAll('.goals-ai-tip'), {
      opacity: 0,
      x: 10,
      duration: 0.35,
      stagger: 0.08,
      ease: 'expo.out',
      delay: 0.45,
    })
  }, { scope: rootRef })

  return (
    <div ref={rootRef} className="min-h-full bg-[#080808] text-[#f0ece4]">
      <div className="goals-reveal flex items-end justify-between px-7 pt-6 pb-2">
        <div>
          <p className="text-[10px] font-mono text-[#444] uppercase tracking-[2px] mb-1">Cele · 2026</p>
          <h1 className="font-display text-[24px] font-black leading-none">
            Twoje <em className="not-italic text-[#c88cff]">cele</em>
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowAddGoal(true)}
          className="rounded-[9px] bg-[#c88cff] px-4 py-2 text-[11px] font-mono uppercase tracking-[1.3px] text-[#080808] transition-all hover:-translate-y-px hover:bg-[#d8a0ff]"
        >
          + Nowy cel
        </button>
      </div>

      <div className="px-7 pb-7 pt-3">
        <section className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 mb-3.5">
          {kpis.map((kpi) => {
            const tone = kpiTone[kpi.tone]
            return (
              <div
                key={kpi.label}
                className={`goals-reveal rounded-[14px] border p-4 transition-all hover:-translate-y-0.5 hover:border-[#2a2a2a] ${tone.card}`}
              >
                <div className="mb-2 flex items-center justify-between text-[9px] font-mono uppercase tracking-[1.3px] text-[#444]">
                  {kpi.label}
                  <span className={`rounded px-1.5 py-px ${tone.trend}`}>{kpi.trend}</span>
                </div>
                <div
                  className={`font-display text-[32px] font-black leading-none ${tone.value}`}
                  data-count-target={kpi.value}
                >
                  0
                </div>
                <div className="mt-1 text-[9px] font-mono text-[#444]">{kpi.sub}</div>
              </div>
            )
          })}
        </section>

        <section className="goals-reveal grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px] mb-3.5">
          <div className="relative overflow-hidden rounded-[18px] border border-[#c88cff]/20 bg-[#0f0f0f] p-6">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c88cff]/40 to-transparent" />
            <div className="relative z-[1] mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 inline-flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-[2.5px] text-[#c88cff]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#c88cff] animate-pulse" />
                  Najbliższy duży cel
                </div>
                <h2 className="font-display text-[28px] font-black leading-[1.05]">
                  Maraton Warszawski<br />
                  <em className="not-italic text-[#c88cff]">3:45:00</em>
                </h2>
              </div>
              <span className="rounded-md bg-[#f5a03a]/10 px-2 py-1 text-[10px] font-mono text-[#f5a03a]">Bieganie</span>
            </div>

            <div className="relative z-[1] grid items-center gap-7 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="relative mx-auto h-[200px] w-[200px]">
                <svg className="h-full w-full -rotate-90 drop-shadow-[0_0_12px_rgba(200,140,255,0.35)]" viewBox="0 0 200 200">
                  <circle cx="100" cy="100" r="90" fill="none" stroke="#1a1a1a" strokeWidth="10" />
                  <circle
                    cx="100"
                    cy="100"
                    r="90"
                    fill="none"
                    stroke="#c88cff"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={FEATURE_CIRC}
                    strokeDashoffset={FEATURE_CIRC}
                    data-feature-circle
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="font-display text-[48px] font-black leading-none text-[#c88cff]" data-feature-percent>0%</div>
                  <div className="mt-1 text-[9px] font-mono uppercase tracking-[1.5px] text-[#666]">progres</div>
                </div>
              </div>

              <div className="flex flex-col gap-3.5">
                <div>
                  <div className="mb-1 text-[9px] font-mono uppercase tracking-[1.5px] text-[#444]">Czas obecny → docelowy</div>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-display text-[22px] font-black text-[#f0ece4]">4:10:00</span>
                    <span className="text-sm text-[#444]">→</span>
                    <span className="font-display text-[22px] font-black text-[#c88cff]">3:45:00</span>
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[9px] font-mono uppercase tracking-[1.5px] text-[#444]">Termin</div>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-display text-[22px] font-black text-[#f0ece4]">28.09.2026</span>
                    <span className="text-[11px] font-light text-[#666]">· 20 tygodni</span>
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-2.5 rounded-[11px] border border-[#1a1a1a] bg-[#0a0a0a] p-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#c88cff]/10 text-[13px] text-[#c88cff]">✦</div>
                  <p className="text-[11px] leading-6 text-[#bbb]">
                    Przy obecnym tempie wzrostu (<strong className="font-medium text-[#c88cff]">-8 s/km/tydz.</strong>) osiągniesz cel <strong className="font-medium text-[#c88cff]">3 tygodnie przed</strong> terminem.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-[18px] border border-[#1a1a1a] bg-[#0f0f0f] p-[18px]">
            <div className="mb-3.5 flex items-center gap-2 border-b border-[#161616] pb-3">
              <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-[#c8f53a]/25 bg-[#c8f53a]/10">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M8 1L9.5 5.5L14 6L11 9L11.5 13.5L8 11L4.5 13.5L5 9L2 6L6.5 5.5L8 1Z" stroke="#c8f53a" strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="font-display text-[13px] font-black">
                Wgląd <em className="not-italic text-[#c8f53a]">AI</em>
              </div>
            </div>

            {aiTips.map((tip) => (
              <div
                key={tip.label}
                className="goals-ai-tip mb-2 rounded-[11px] border border-[#1a1a1a] bg-[#131313] p-3 transition-colors hover:border-[#c8f53a]/20 hover:bg-[#c8f53a]/[0.02]"
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${tip.tone}`} />
                  <span className="text-[8px] font-mono uppercase tracking-[1.2px] text-[#888]">{tip.label}</span>
                </div>
                <p className="text-[11px] leading-5 text-[#ccc]">{tip.text}</p>
              </div>
            ))}
          </aside>
        </section>

        <section className="goals-reveal mb-2.5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-[15px] font-black">Aktywne cele</h2>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className="rounded-lg border border-[#c88cff]/25 bg-[#c88cff]/10 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[1px] text-[#c88cff]">Wszystkie</button>
            <button type="button" className="rounded-lg border border-[#f5a03a]/20 bg-[#f5a03a]/[0.04] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[1px] text-[#f5a03a]">Siła</button>
            <button type="button" className="rounded-lg border border-[#c8f53a]/20 bg-[#c8f53a]/[0.04] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[1px] text-[#c8f53a]">Bieganie</button>
            <button type="button" className="rounded-lg border border-[#3cc8ff]/20 bg-[#3cc8ff]/[0.04] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[1px] text-[#3cc8ff]">Sylwetka</button>
            <button type="button" className="rounded-lg border border-[#c88cff]/20 bg-[#c88cff]/[0.04] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[1px] text-[#c88cff]">Nawyki</button>
          </div>
        </section>

        <section className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3 mb-3.5">
          {activeGoals.map((goal) => {
            const tone = goalTone[goal.tone]
            const status = statusTone[goal.status]
            return (
              <article key={goal.title} className="goals-reveal rounded-[14px] border border-[#1a1a1a] bg-[#0f0f0f] p-4 transition-all hover:-translate-y-0.5 hover:border-[#2a2a2a]">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <span className={`rounded px-2 py-0.5 text-[8px] font-mono uppercase tracking-[1.2px] ${tone.tag}`}>{goal.category}</span>
                  <span className={`inline-flex items-center gap-1 text-[8px] font-mono uppercase tracking-[1.2px] ${status.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                    {goal.statusLabel}
                  </span>
                </div>
                <h3 className="mb-2.5 text-[13px] font-medium leading-snug text-[#f0ece4]">{goal.title}</h3>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <div className="font-display text-[18px] font-black">
                    {goal.current}
                    {goal.currentUnit && <span className="ml-1 text-[11px] font-mono text-[#666]">{goal.currentUnit}</span>}
                  </div>
                  <div className="text-[10px] font-mono text-[#444]">
                    cel: <strong className="font-medium text-[#888]">{goal.target}</strong>
                  </div>
                </div>
                <div className="mb-2 h-[5px] overflow-hidden rounded-full bg-[#141414]">
                  <div className={`h-full w-0 rounded-full ${tone.fill}`} data-progress-target={goal.progress} />
                </div>
                <div className="flex justify-between gap-3 text-[9px] font-mono text-[#444]">
                  <span>{goal.meta}</span>
                  <span className="font-medium text-[#888]">{goal.progress}%</span>
                </div>
              </article>
            )
          })}
        </section>

        <section className="grid gap-3 xl:grid-cols-[1.4fr_1fr]">
          <div className="goals-reveal rounded-2xl border border-[#1a1a1a] bg-[#0f0f0f] p-[18px]">
            <div className="mb-3.5 flex items-center justify-between">
              <h2 className="font-display text-[14px] font-black">Oś czasu · 2026</h2>
              <span className="text-[10px] font-mono text-[#666]">Maj → Wrzesień</span>
            </div>
            <div className="relative h-[60px] rounded-sm border-x border-dashed border-[#1e1e1e] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.01)_50%,transparent)] px-2">
              <div className="absolute left-0 right-0 top-1/2 h-px bg-[#1e1e1e]" />
              {timelineEvents.map((event) => (
                <div
                  key={event.label}
                  className={`absolute top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 border-2 border-[#080808] ${event.size} ${event.tone}`}
                  style={{ left: `${event.left}%` }}
                >
                  <div className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-mono text-[#444] ${event.top ? 'bottom-4' : 'top-4'}`}>
                    {event.label}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[8px] font-mono uppercase tracking-[1.5px] text-[#333]">
              <span>maj</span>
              <span>cze</span>
              <span>lip</span>
              <span>sie</span>
              <span>wrz</span>
            </div>
          </div>

          <div className="goals-reveal rounded-2xl border border-[#1a1a1a] bg-[#0f0f0f] p-[18px]">
            <div className="mb-3.5 flex items-center justify-between">
              <h2 className="font-display text-[14px] font-black">Ukończone</h2>
              <button type="button" className="text-[11px] text-[#444] transition-colors hover:text-[#c88cff]">Wszystkie →</button>
            </div>
            <div className="flex flex-col gap-2">
              {completedGoals.map((goal, index) => (
                <div key={goal.name} className={`flex items-center gap-2.5 py-1.5 ${index < completedGoals.length - 1 ? 'border-b border-[#131313]' : ''}`}>
                  <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border border-[#c88cff]/20 bg-[#c88cff]/10 text-[13px]">{goal.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11.5px] font-medium text-[#bbb]">{goal.name}</div>
                    <div className="text-[9px] font-mono text-[#444]">{goal.date}</div>
                  </div>
                  <div className="font-display text-[13px] font-black text-[#c88cff]">✓</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      {showAddGoal && (
        <AddGoalModal
          onClose={() => setShowAddGoal(false)}
          onSaved={() => setShowAddGoal(false)}
        />
      )}
    </div>
  )
}
