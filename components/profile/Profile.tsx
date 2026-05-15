'use client'

import { useGSAP } from '@gsap/react'
import { useUser } from '@clerk/nextjs'
import gsap from 'gsap'
import { useMemo, useRef } from 'react'

type Accent = 'lime' | 'orange' | 'purple' | 'blue' | 'white'

interface ProfileStat {
  label: string
  value: number
  suffix?: string
  sub: string
  trend: string
  accent: Accent
}

interface BodyMetric {
  label: string
  value: string
  unit: string
  helper: string
  progress: number
  accent: Accent
}

interface RecordItem {
  label: string
  value: string
  date: string
  accent: Accent
}

interface GoalItem {
  title: string
  meta: string
  progress: number
  accent: Accent
}

const accentStyles: Record<Accent, {
  text: string
  bg: string
  border: string
  fill: string
  soft: string
}> = {
  lime: {
    text: 'text-[#c8f53a]',
    bg: 'bg-[#c8f53a]',
    border: 'border-[#c8f53a]/25',
    fill: 'bg-[#c8f53a]',
    soft: 'bg-[#c8f53a]/10 text-[#c8f53a]',
  },
  orange: {
    text: 'text-[#f5a03a]',
    bg: 'bg-[#f5a03a]',
    border: 'border-[#f5a03a]/25',
    fill: 'bg-[#f5a03a]',
    soft: 'bg-[#f5a03a]/10 text-[#f5a03a]',
  },
  purple: {
    text: 'text-[#c88cff]',
    bg: 'bg-[#c88cff]',
    border: 'border-[#c88cff]/25',
    fill: 'bg-[#c88cff]',
    soft: 'bg-[#c88cff]/10 text-[#c88cff]',
  },
  blue: {
    text: 'text-[#3cc8ff]',
    bg: 'bg-[#3cc8ff]',
    border: 'border-[#3cc8ff]/25',
    fill: 'bg-[#3cc8ff]',
    soft: 'bg-[#3cc8ff]/10 text-[#3cc8ff]',
  },
  white: {
    text: 'text-[#f0ece4]',
    bg: 'bg-[#f0ece4]',
    border: 'border-[#2a2a2a]',
    fill: 'bg-[#f0ece4]',
    soft: 'bg-white/[0.04] text-[#f0ece4]',
  },
}

const profileStats: ProfileStat[] = [
  { label: 'Treningi', value: 128, sub: 'w 2026 roku', trend: '+18 mies.', accent: 'lime' },
  { label: 'Seria', value: 14, suffix: 'dni', sub: 'ostatnia przerwa: 1 dzień', trend: 'ciągłość', accent: 'purple' },
  { label: 'Objętość', value: 38, suffix: 'km', sub: 'bieganie w tym tygodniu', trend: '+12%', accent: 'orange' },
  { label: 'Cele', value: 5, sub: 'aktywne kierunki pracy', trend: '4 na torze', accent: 'blue' },
]

const bodyMetrics: BodyMetric[] = [
  { label: 'Masa ciała', value: '78.0', unit: 'kg', helper: 'cel: 76 kg', progress: 67, accent: 'orange' },
  { label: 'Wzrost', value: '178', unit: 'cm', helper: 'BMI: 24.6', progress: 78, accent: 'white' },
  { label: 'Sen', value: '7.2', unit: 'h', helper: 'średnia 7 dni', progress: 82, accent: 'purple' },
  { label: 'Regeneracja', value: '84', unit: '%', helper: 'gotowość dziś', progress: 84, accent: 'lime' },
]

const records: RecordItem[] = [
  { label: 'Martwy ciąg', value: '140 kg', date: '03.05.2026', accent: 'orange' },
  { label: 'Przysiad', value: '120 kg', date: '28.03.2026', accent: 'orange' },
  { label: '5 km', value: '22:14', date: '22.04.2026', accent: 'lime' },
  { label: '10 km', value: '47:32', date: '12.04.2026', accent: 'lime' },
]

const goals: GoalItem[] = [
  { title: 'Maraton Warszawski 3:45', meta: '28.09.2026', progress: 55, accent: 'purple' },
  { title: 'Martwy ciąg 160 kg', meta: '21.06.2026', progress: 72, accent: 'orange' },
  { title: '50 km tygodniowo', meta: 'aktywny nawyk', progress: 76, accent: 'lime' },
]

const trainingSplit = [
  { label: 'Bieganie', value: '48%', accent: 'lime' as const },
  { label: 'Siłownia', value: '36%', accent: 'orange' as const },
  { label: 'Mobilność', value: '16%', accent: 'blue' as const },
]

const integrations = [
  { name: 'Garmin', status: 'Połączone', accent: 'lime' as const },
  { name: 'Strava', status: 'Połączone', accent: 'orange' as const },
  { name: 'Apple Health', status: 'Do konfiguracji', accent: 'white' as const },
]

const preferences = [
  { label: 'Jednostki metryczne', active: true },
  { label: 'Raport AI co tydzień', active: true },
  { label: 'Powiadomienia o celach', active: false },
]

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'U'
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('')
}

function animateCounter(el: HTMLElement, target: number, suffix: string, duration: number) {
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min((now - start) / duration, 1)
    const eased = 1 - Math.pow(1 - t, 4)
    el.textContent = `${Math.round(eased * target)}${suffix}`
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

export default function Profile() {
  const rootRef = useRef<HTMLDivElement>(null)
  const { user, isSignedIn } = useUser()

  const displayName = user?.fullName ?? user?.firstName ?? user?.username ?? 'Mateusz Kowalski'
  const email = user?.primaryEmailAddress?.emailAddress ?? 'demo@reptrack.local'
  const initials = useMemo(() => getInitials(displayName), [displayName])
  const avatarUrl = user?.imageUrl

  useGSAP(() => {
    const root = rootRef.current
    if (!root) return

    const tl = gsap.timeline({ delay: 0.05 })
    tl.from(root.querySelectorAll('.profile-reveal'), {
      opacity: 0,
      y: 14,
      duration: 0.45,
      stagger: 0.055,
      ease: 'expo.out',
    })

    tl.call(() => {
      root.querySelectorAll<HTMLElement>('[data-count-target]').forEach((el, index) => {
        animateCounter(el, Number(el.dataset.countTarget ?? 0), el.dataset.countSuffix ?? '', 760 + index * 90)
      })

      root.querySelectorAll<HTMLElement>('[data-progress-target]').forEach((bar, index) => {
        gsap.to(bar, {
          width: `${bar.dataset.progressTarget}%`,
          duration: 1.1,
          delay: index * 0.05,
          ease: 'expo.out',
        })
      })
    }, undefined, '-=0.2')
  }, { scope: rootRef })

  return (
    <div ref={rootRef} className="min-h-full bg-[#080808] text-[#f0ece4]">
      <div className="profile-reveal flex flex-wrap items-end justify-between gap-3 px-7 pb-2 pt-6">
        <div>
          <p className="mb-1 text-[10px] font-mono uppercase tracking-[2px] text-[#444]">Profil · RepTrack</p>
          <h1 className="font-display text-[24px] font-black leading-none">
            Centrum <em className="not-italic text-[#c8f53a]">atlety</em>
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-[9px] border border-[#1e1e1e] bg-[#111] px-4 py-2 text-[11px] font-mono uppercase tracking-[1.2px] text-[#888] transition-all hover:border-[#333] hover:text-[#f0ece4]"
          >
            Eksport
          </button>
          <button
            type="button"
            className="rounded-[9px] bg-[#c8f53a] px-4 py-2 text-[11px] font-mono uppercase tracking-[1.2px] text-[#080808] transition-all hover:-translate-y-px hover:bg-[#d7ff5a]"
          >
            Edytuj profil
          </button>
        </div>
      </div>

      <div className="px-7 pb-7 pt-3">
        <section className="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
          <div className="profile-reveal relative overflow-hidden rounded-2xl border border-[#c8f53a]/20 bg-[#0f0f0f] p-5">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c8f53a]/35 to-transparent" />
            <div className="flex flex-col gap-5 md:flex-row md:items-center">
              <div className="relative h-[112px] w-[112px] shrink-0 overflow-hidden rounded-2xl border border-[#c8f53a]/25 bg-[#141414]">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-display text-[34px] font-black text-[#c8f53a]">
                    {initials}
                  </div>
                )}
                <div className="absolute bottom-2 right-2 h-3 w-3 rounded-full border-2 border-[#0f0f0f] bg-[#c8f53a]" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-[#c8f53a]/10 px-2 py-1 text-[9px] font-mono uppercase tracking-[1.2px] text-[#c8f53a]">
                    {isSignedIn ? 'Konto aktywne' : 'Tryb demo'}
                  </span>
                  <span className="rounded-md bg-[#f5a03a]/10 px-2 py-1 text-[9px] font-mono uppercase tracking-[1.2px] text-[#f5a03a]">
                    Hybryda · bieg + siła
                  </span>
                </div>
                <h2 className="truncate font-display text-[32px] font-black leading-none text-[#f0ece4]">{displayName}</h2>
                <p className="mt-2 truncate text-[12px] font-mono text-[#555]">{email}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {[
                    ['Poziom', 'Zaawansowany'],
                    ['Cel główny', 'Maraton 3:45'],
                    ['Plan', '5 dni / tydz.'],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] px-3 py-2">
                      <div className="text-[8px] font-mono uppercase tracking-[1.2px] text-[#444]">{label}</div>
                      <div className="mt-1 truncate text-[12px] font-medium text-[#ccc]">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <aside className="profile-reveal rounded-2xl border border-[#1a1a1a] bg-[#0f0f0f] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-mono uppercase tracking-[1.4px] text-[#444]">Status tygodnia</p>
                <h2 className="mt-1 font-display text-[15px] font-black">Gotowość do pracy</h2>
              </div>
              <span className="rounded-md bg-[#c8f53a]/10 px-2 py-1 text-[10px] font-mono text-[#c8f53a]">84%</span>
            </div>
            <div className="space-y-3">
              {trainingSplit.map((item) => {
                const accent = accentStyles[item.accent]
                return (
                  <div key={item.label}>
                    <div className="mb-1.5 flex justify-between text-[10px] font-mono">
                      <span className="text-[#666]">{item.label}</span>
                      <span className={accent.text}>{item.value}</span>
                    </div>
                    <div className="h-[6px] overflow-hidden rounded-full bg-[#161616]">
                      <div className={`h-full w-0 rounded-full ${accent.fill}`} data-progress-target={Number(item.value.replace('%', ''))} />
                    </div>
                  </div>
                )
              })}
            </div>
          </aside>
        </section>

        <section className="mt-3 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
          {profileStats.map((stat) => {
            const accent = accentStyles[stat.accent]
            return (
              <article
                key={stat.label}
                className={`profile-reveal rounded-[14px] border bg-[#0f0f0f] p-4 transition-all hover:-translate-y-0.5 hover:border-[#2a2a2a] ${accent.border}`}
              >
                <div className="mb-2 flex items-center justify-between text-[9px] font-mono uppercase tracking-[1.2px] text-[#444]">
                  {stat.label}
                  <span className={`rounded px-1.5 py-px ${accent.soft}`}>{stat.trend}</span>
                </div>
                <div className={`font-display text-[32px] font-black leading-none ${accent.text}`}>
                  <span data-count-target={stat.value} data-count-suffix={stat.suffix ? ` ${stat.suffix}` : ''}>0</span>
                </div>
                <div className="mt-1 text-[9px] font-mono text-[#444]">{stat.sub}</div>
              </article>
            )
          })}
        </section>

        <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="profile-reveal rounded-2xl border border-[#1a1a1a] bg-[#0f0f0f] p-[18px]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-[15px] font-black">Parametry</h2>
              <span className="text-[10px] font-mono uppercase tracking-[1.2px] text-[#444]">Aktualizacja dziś</span>
            </div>
            <div className="grid gap-2.5 md:grid-cols-2">
              {bodyMetrics.map((metric) => {
                const accent = accentStyles[metric.accent]
                return (
                  <div key={metric.label} className="rounded-[14px] border border-[#1a1a1a] bg-[#0a0a0a] p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[9px] font-mono uppercase tracking-[1.2px] text-[#444]">{metric.label}</span>
                      <span className={`h-1.5 w-1.5 rounded-full ${accent.bg}`} />
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className={`font-display text-[25px] font-black leading-none ${accent.text}`}>{metric.value}</span>
                      <span className="text-[10px] font-mono text-[#666]">{metric.unit}</span>
                    </div>
                    <div className="mt-2 text-[10px] font-mono text-[#555]">{metric.helper}</div>
                    <div className="mt-3 h-[5px] overflow-hidden rounded-full bg-[#161616]">
                      <div className={`h-full w-0 rounded-full ${accent.fill}`} data-progress-target={metric.progress} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <aside className="profile-reveal rounded-2xl border border-[#1a1a1a] bg-[#0f0f0f] p-[18px]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-[15px] font-black">Integracje</h2>
              <button type="button" className="text-[10px] font-mono uppercase tracking-[1.2px] text-[#444] transition-colors hover:text-[#c8f53a]">
                Zarządzaj
              </button>
            </div>
            <div className="space-y-2">
              {integrations.map((item) => {
                const accent = accentStyles[item.accent]
                return (
                  <div key={item.name} className="flex items-center justify-between rounded-[12px] border border-[#1a1a1a] bg-[#0a0a0a] px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className={`h-2 w-2 rounded-full ${accent.bg}`} />
                      <span className="text-[12px] font-medium text-[#ccc]">{item.name}</span>
                    </div>
                    <span className={`rounded px-2 py-0.5 text-[8px] font-mono uppercase tracking-[1px] ${accent.soft}`}>{item.status}</span>
                  </div>
                )
              })}
            </div>
          </aside>
        </section>

        <section className="mt-3 grid gap-3 xl:grid-cols-3">
          <div className="profile-reveal rounded-2xl border border-[#1a1a1a] bg-[#0f0f0f] p-[18px]">
            <h2 className="mb-4 font-display text-[15px] font-black">Rekordy</h2>
            <div className="space-y-2">
              {records.map((record) => {
                const accent = accentStyles[record.accent]
                return (
                  <div key={record.label} className="flex items-center justify-between border-b border-[#141414] pb-2 last:border-0 last:pb-0">
                    <div>
                      <div className="text-[12px] font-medium text-[#ccc]">{record.label}</div>
                      <div className="mt-0.5 text-[9px] font-mono text-[#444]">{record.date}</div>
                    </div>
                    <div className={`font-display text-[16px] font-black ${accent.text}`}>{record.value}</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="profile-reveal rounded-2xl border border-[#1a1a1a] bg-[#0f0f0f] p-[18px]">
            <h2 className="mb-4 font-display text-[15px] font-black">Aktywne cele</h2>
            <div className="space-y-3">
              {goals.map((goal) => {
                const accent = accentStyles[goal.accent]
                return (
                  <div key={goal.title}>
                    <div className="mb-1.5 flex justify-between gap-3">
                      <span className="truncate text-[12px] font-medium text-[#ccc]">{goal.title}</span>
                      <span className="shrink-0 text-[9px] font-mono text-[#555]">{goal.meta}</span>
                    </div>
                    <div className="h-[5px] overflow-hidden rounded-full bg-[#161616]">
                      <div className={`h-full w-0 rounded-full ${accent.fill}`} data-progress-target={goal.progress} />
                    </div>
                    <div className={`mt-1 text-right text-[9px] font-mono ${accent.text}`}>{goal.progress}%</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="profile-reveal rounded-2xl border border-[#1a1a1a] bg-[#0f0f0f] p-[18px]">
            <h2 className="mb-4 font-display text-[15px] font-black">Preferencje</h2>
            <div className="space-y-2">
              {preferences.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="flex w-full items-center justify-between rounded-[12px] border border-[#1a1a1a] bg-[#0a0a0a] px-3 py-2.5 text-left transition-colors hover:border-[#2a2a2a]"
                >
                  <span className="text-[12px] text-[#ccc]">{item.label}</span>
                  <span className={`relative h-5 w-9 rounded-full transition-colors ${item.active ? 'bg-[#c8f53a]/80' : 'bg-[#1e1e1e]'}`}>
                    <span className={`absolute top-1 h-3 w-3 rounded-full bg-[#080808] transition-transform ${item.active ? 'left-5' : 'left-1'}`} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
