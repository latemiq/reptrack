'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser, useClerk } from '@clerk/nextjs'

export interface ProfileData {
  firstName: string | null
  lastName:  string | null
  email:     string | null
  imageUrl:  string | null
  createdAt: number
  age:       number | null
  heightCm:  number | null
  weightKg:  number | null
  location:  string | null
  level:     'beginner' | 'intermediate' | 'advanced' | null
}

export interface LifetimeStats {
  totalDistanceKm: number
  totalRuns:       number
  totalTonnageKg:  number
  totalWorkouts:   number
  currentStreak:   number
  prsThisYear:     number
  memberMonths:    number
}

interface UserProfileProps {
  profile?: Partial<ProfileData>
  stats?:   Partial<LifetimeStats>
}

const MOCK_STATS: LifetimeStats = {
  totalDistanceKm: 0,
  totalRuns:       0,
  totalTonnageKg:  0,
  totalWorkouts:   0,
  currentStreak:   0,
  prsThisYear:     0,
  memberMonths:    0,
}

const initialsFrom = (first?: string | null, last?: string | null, email?: string | null): string => {
  const f = first?.[0]?.toUpperCase()
  const l = last?.[0]?.toUpperCase()
  if (f && l) return `${f}${l}`
  if (f) return f
  if (email) return email[0].toUpperCase()
  return 'U'
}

const fullNameFrom = (first?: string | null, last?: string | null): string => {
  return [first, last].filter(Boolean).join(' ') || 'Bez nazwy'
}

const animateCounter = (id: string, target: number, duration: number, fmt: (v: number) => string) => {
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

function LifetimeStatCard({
  icon, label, value, sub, valueColor, animateId,
}: {
  icon: string
  label: string
  value: string
  sub: string
  valueColor: 'lime' | 'orange' | 'purple' | 'white'
  animateId?: string
}) {
  const colorMap = {
    lime:   'text-[#c8f53a]',
    orange: 'text-[#f5a03a]',
    purple: 'text-[#c88cff]',
    white:  'text-[#f0ece4]',
  }
  return (
    <div className="lifetime-card bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-4 transition-all cursor-none hover:border-[#2a2a2a]">
      <div className="text-[9px] font-mono text-[#444] uppercase tracking-[1.2px] mb-2 flex items-center gap-1.5">
        <span className="text-[11px]">{icon}</span>
        {label}
      </div>
      <div id={animateId} className={`font-display text-[30px] font-black leading-none mb-1 ${colorMap[valueColor]}`}>
        {value}
      </div>
      <div className="text-[9px] font-mono text-[#444]">
        <span dangerouslySetInnerHTML={{ __html: sub.replace(/<b>([^<]+)<\/b>/g, '<strong class="text-[#666] font-medium">$1</strong>') }} />
      </div>
    </div>
  )
}

export default function UserProfile({ profile: profileProp, stats: statsProp }: UserProfileProps) {
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const { signOut } = useClerk()
  const containerRef = useRef<HTMLDivElement>(null)
  const [profile, setProfile] = useState<Partial<ProfileData>>(profileProp ?? {})
  const [liveStats, setLiveStats] = useState<LifetimeStats>(MOCK_STATS)

  useEffect(() => {
    if (!isLoaded) return
    let cancelled = false

    async function load() {
      try {
        const [profileRes, statsRes] = await Promise.all([
          fetch('/api/profile'),
          fetch('/api/profile/stats'),
        ])
        if (cancelled) return
        if (profileRes.ok) {
          const data = await profileRes.json()
          setProfile(prev => ({ ...prev, ...data.profile }))
        }
        if (statsRes.ok) {
          const data = await statsRes.json()
          if (data.stats) setLiveStats(prev => ({ ...prev, ...data.stats }))
        }
      } catch (e) {
        console.warn('Profile fetch failed:', e)
      }
    }
    load()
    return () => { cancelled = true }
  }, [isLoaded])

  const stats = { ...liveStats, ...(statsProp ?? {}) }

  const displayName = fullNameFrom(user?.firstName, user?.lastName)
  const initials    = initialsFrom(user?.firstName, user?.lastName, user?.primaryEmailAddress?.emailAddress)
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })
    : '—'

  useGSAP(() => {
    const tl = gsap.timeline({ delay: 0.05 })
    tl.from('.profile-topbar',  { opacity: 0, y: -8, duration: 0.4, ease: 'expo.out' })
    tl.from('.profile-header',  { opacity: 0, y: 12, duration: 0.5, ease: 'expo.out' }, '-=0.2')
    tl.from('.lifetime-card',   { opacity: 0, y: 14, duration: 0.5, stagger: 0.08, ease: 'expo.out' }, '-=0.25')
    tl.from('.profile-section', { opacity: 0, y: 12, duration: 0.5, stagger: 0.1, ease: 'expo.out' }, '-=0.2')

    tl.call(() => {
      animateCounter('lt-distance', stats.totalDistanceKm, 1100, v => `${Math.round(v)} km`)
      animateCounter('lt-tonnage',  stats.totalTonnageKg / 1000, 900, v => `${v.toFixed(1)} t`)
      animateCounter('lt-streak',   stats.currentStreak, 800, v => Math.round(v).toString())
      animateCounter('lt-prs',      stats.prsThisYear, 700, v => Math.round(v).toString())
    }, [], '-=0.3')
  }, { scope: containerRef, dependencies: [stats.totalDistanceKm] })

  useGSAP(() => {
    const cards = containerRef.current?.querySelectorAll('.lifetime-card')
    cards?.forEach(card => {
      card.addEventListener('mouseenter', () => gsap.to(card, { y: -3, duration: 0.25, ease: 'power2.out' }))
      card.addEventListener('mouseleave', () => gsap.to(card, { y:  0, duration: 0.25, ease: 'power2.out' }))
    })
  }, { scope: containerRef })

  return (
    <div ref={containerRef} className="min-h-full bg-[#080808] text-[#f0ece4] font-sans">

      {/* TOPBAR */}
      <div className="profile-topbar px-4 md:px-7 pt-5 md:pt-6 pb-2 flex justify-between items-end">
        <div>
          <p className="text-[10px] font-mono text-[#444] uppercase tracking-[2px] mb-1">
            Profil · od {memberSince}
          </p>
          <h1 className="font-display text-[20px] md:text-[24px] font-black">
            {user?.firstName ?? 'Twój'} <em className="not-italic text-[#c8f53a]">{user?.lastName ?? 'profil'}</em>
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/settings')}
            className="px-3 md:px-4 py-2.5 md:py-2 rounded-lg bg-[#111] border border-[#1e1e1e] text-[#888] text-[11px] font-mono uppercase tracking-[1.3px] hover:border-[#333] hover:text-[#ccc] transition-all cursor-none"
          >
            <span className="md:hidden">⚙</span>
            <span className="hidden md:inline">⚙ Ustawienia</span>
          </button>
          <button
            onClick={() => (user as unknown as { openUserProfile?: () => void })?.openUserProfile?.()}
            className="px-3 md:px-4 py-2.5 md:py-2 rounded-lg bg-[#111] border border-[#1e1e1e] text-[#888] text-[11px] font-mono uppercase tracking-[1.3px] hover:border-[#333] hover:text-[#ccc] transition-all cursor-none"
          >
            <span className="md:hidden">✎</span>
            <span className="hidden md:inline">Edytuj profil</span>
          </button>
          <button
            onClick={() => signOut(() => router.push('/auth'))}
            className="px-3 md:px-4 py-2.5 md:py-2 rounded-lg bg-red-500/[0.06] border border-red-500/20 text-red-400 text-[11px] font-mono uppercase tracking-[1.3px] hover:bg-red-500/10 hover:border-red-500/40 transition-all cursor-pointer"
          >
            <span className="md:hidden">↪</span>
            <span className="hidden md:inline">Wyloguj się</span>
          </button>
        </div>
      </div>

      <div className="px-4 md:px-7 pb-6 md:pb-7 pt-3 space-y-3 md:space-y-3.5">

        {/* HEADER CARD */}
        <div className="profile-header bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl md:rounded-3xl p-5 md:p-7 flex flex-col md:flex-row items-center md:items-center gap-4 md:gap-6 relative overflow-hidden">
          <div className="absolute -top-1/3 -right-[5%] w-[300px] h-[300px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(200,245,58,0.06), transparent 60%)' }}
          />

          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {user?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.imageUrl} alt={displayName}
                className="w-[88px] h-[88px] rounded-3xl object-cover" />
            ) : (
              <div className="w-[88px] h-[88px] rounded-3xl bg-gradient-to-br from-[#c8f53a] to-[#7ef5b0] flex items-center justify-center text-[#080808] font-display font-black text-[36px]">
                {initials}
              </div>
            )}
            <button
              onClick={() => (user as unknown as { openUserProfile?: () => void })?.openUserProfile?.()}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#080808] border-2 border-[#0f0f0f] flex items-center justify-center text-[#c8f53a] text-[12px] cursor-none hover:text-[#d8ff4a] transition-colors"
              aria-label="Edytuj zdjęcie"
            >✎</button>
          </div>

          {/* Info */}
          <div className="flex-1 z-10 text-center md:text-left">
            <div className="font-display text-[24px] md:text-[28px] font-black leading-tight mb-1">
              {displayName}
            </div>

            <div className="flex flex-wrap justify-center md:justify-start gap-1.5 items-center text-[11.5px] font-mono text-[#666]">
              {profile.age && <span>{profile.age} lat</span>}
              {profile.age && <span className="text-[#333]">·</span>}
              {profile.heightCm && <span>{profile.heightCm} cm</span>}
              {profile.heightCm && <span className="text-[#333]">·</span>}
              {profile.weightKg && <span>{profile.weightKg.toFixed(1)} kg</span>}
              {profile.weightKg && profile.location && <span className="text-[#333]">·</span>}
              {profile.location && <span>{profile.location}</span>}
              {!profile.age && !profile.heightCm && !profile.location && (
                <span className="text-[#555]">Dodaj dane w ustawieniach →</span>
              )}
            </div>

            <div className="flex flex-wrap justify-center md:justify-start gap-1.5 mt-2.5">
              <span className="px-2.5 py-1 rounded-md text-[9px] font-mono uppercase tracking-[1.2px] bg-[#c8f53a]/[0.08] border border-[#c8f53a]/20 text-[#c8f53a]">
                ● Aktywny · {stats.currentStreak} dni
              </span>
              {profile.level && (
                <span className="px-2.5 py-1 rounded-md text-[9px] font-mono uppercase tracking-[1.2px] bg-white/[0.04] border border-white/[0.08] text-[#888]">
                  {profile.level === 'beginner' ? 'Początkujący' : profile.level === 'intermediate' ? 'Średniozaawansowany' : 'Zaawansowany'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* LIFETIME STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3">
          <LifetimeStatCard icon="🏃" label="Bieganie · życie"
            value="0 km" sub={`<b>${stats.totalRuns}</b> biegów`}
            valueColor="lime" animateId="lt-distance" />
          <LifetimeStatCard icon="🏋" label="Siłownia · życie"
            value="0 t" sub={`<b>${stats.totalWorkouts}</b> treningów`}
            valueColor="orange" animateId="lt-tonnage" />
          <LifetimeStatCard icon="⚡" label="Seria treningowa"
            value="0" sub="<b>dni</b> z rzędu"
            valueColor="purple" animateId="lt-streak" />
          <LifetimeStatCard icon="🏆" label="Ukończone cele"
            value="0" sub={`<b>w ${new Date().getFullYear()}</b>`}
            valueColor="white" animateId="lt-prs" />
        </div>

        {/* PLACEHOLDERS */}
        <div className="profile-section grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-3">
          <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-5 md:p-6 min-h-[280px] flex flex-col items-center justify-center text-center">
            <div className="text-[42px] mb-3 opacity-40">📊</div>
            <div className="font-display text-[16px] font-black text-[#f0ece4] mb-1">Pomiary ciała</div>
            <p className="text-[12px] text-[#666] mb-4 max-w-[300px]">
              Śledź wagę, BF%, obwody. Wykresy postępu i automatyczne porównania.
            </p>
            <span className="text-[10px] font-mono text-[#444] uppercase tracking-[1.5px] px-3 py-1.5 rounded-md bg-white/[0.03] border border-white/[0.06]">
              Wkrótce
            </span>
          </div>

          <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-5 md:p-6 min-h-[280px] flex flex-col items-center justify-center text-center">
            <div className="text-[42px] mb-3 opacity-40">🏅</div>
            <div className="font-display text-[16px] font-black text-[#f0ece4] mb-1">Osiągnięcia</div>
            <p className="text-[12px] text-[#666] mb-4 max-w-[260px]">
              Odblokowuj odznaki za PRy, serie i milestone.
            </p>
            <span className="text-[10px] font-mono text-[#444] uppercase tracking-[1.5px] px-3 py-1.5 rounded-md bg-white/[0.03] border border-white/[0.06]">
              W planach
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
