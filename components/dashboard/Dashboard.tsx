'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserButton, useUser } from '@clerk/nextjs'
import GoalsView from '@/components/goals/GoalsView'
import Profile from '@/components/profile/Profile'

interface Run   { id: string; name: string; distance: number; pace: string; date: string }
interface Lift  { id: string; name: string; exercises: number; duration: string; date: string }
type Activity = (Run & { type: 'run' }) | (Lift & { type: 'lift' })

interface GoalItem { label: string; pct: number; orange?: boolean }

const MOCK_ACTIVITIES: Activity[] = [
  { id:'1', type:'run',  name:'Bieg poranny',       distance:12.4, pace:'5:12', date:'dziś' },
  { id:'2', type:'lift', name:'Push · klatka+barki', exercises:6,  duration:'58 min', date:'wczoraj' },
  { id:'3', type:'run',  name:'Tempo 5 km',          distance:5.0,  pace:'4:26', date:'wt · PR 22:14' },
  { id:'4', type:'lift', name:'Pull · plecy+biceps',  exercises:5,  duration:'52 min', date:'pon' },
]

const MOCK_GOALS: GoalItem[] = [
  { label:'Martwy ciąg — 160 kg', pct:72 },
  { label:'Maraton — 3:45',       pct:55, orange:true },
  { label:'Masa ciała — 76 kg',   pct:67 },
  { label:'Km / tydzień — 50',    pct:76, orange:true },
]

const WEEK = ['pon','wt','śr','czw','pt','sb','nd']
const WEEK_STATE = ['lift','run','lift','run','today','',''] as const

const ARC_CIRCUMFERENCE = 2 * Math.PI * 18

function ArcSVG({ pct, color = '#c8f53a', id }: { pct: number; color?: string; id: string }) {
  const circ = ARC_CIRCUMFERENCE
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="overflow-visible absolute top-4 right-4">
      <circle cx="24" cy="24" r="18" fill="none" stroke="#1a1a1a" strokeWidth="3" />
      <circle
        id={id} cx="24" cy="24" r="18" fill="none"
        stroke={color} strokeWidth="3" strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ - (circ * pct / 100)}
        transform="rotate(-90 24 24)"
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.16,1,.3,1)' }}
      />
    </svg>
  )
}

function WeekStrip() {
  return (
    <div className="flex gap-1.5 mt-3.5">
      {WEEK.map((d, i) => {
        const s = WEEK_STATE[i]
        return (
          <div key={d} className={`flex-1 rounded-lg py-1.5 px-1 text-center border transition-colors ${
            s === 'today'  ? 'bg-[#c8f53a]/[0.08] border-[#c8f53a]/40'
            : s === 'run'  ? 'bg-[#c8f53a]/[0.05] border-[#c8f53a]/20'
            : s === 'lift' ? 'bg-[#f5a03a]/[0.05] border-[#f5a03a]/20'
            : 'bg-[#131313] border-[#1a1a1a]'
          }`}>
            <span className={`block text-[7px] font-mono uppercase mb-1 ${s === 'today' ? 'text-[#c8f53a]' : 'text-[#333]'}`}>{d}</span>
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

function NavItem({
  label, active, badge, badgeOrange, icon, onClick, tone = 'lime',
}: {
  label: string; active?: boolean; badge?: string; badgeOrange?: boolean
  icon: React.ReactNode; onClick: () => void; tone?: 'lime' | 'purple'
}) {
  const activeClasses = tone === 'purple'
    ? 'bg-[#c88cff]/[0.08] border border-[#c88cff]/20'
    : 'bg-[#c8f53a]/[0.08] border border-[#c8f53a]/20'
  const iconActiveClass = tone === 'purple' ? 'bg-[#c88cff]/15' : 'bg-[#c8f53a]/15'

  return (
    <button onClick={onClick} className={`
      w-full flex items-center gap-2.5 px-3 py-2.5 mx-2 rounded-xl text-left
      transition-all duration-200 group
      ${active
        ? activeClasses
        : 'border border-transparent hover:bg-white/[0.03]'
      }
    `} style={{ width: 'calc(100% - 16px)' }}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all
        ${active ? iconActiveClass : 'group-hover:scale-105'}`}>
        {icon}
      </div>
      <span className={`text-[13px] transition-colors ${active ? 'text-[#f0ece4] font-medium' : 'text-[#777] group-hover:text-[#bbb]'}`}>
        {label}
      </span>
      {badge && (
        <span className={`ml-auto text-[9px] font-mono rounded px-1.5 py-0.5 ${
          badgeOrange ? 'bg-[#f5a03a]/15 text-[#f5a03a]' : 'bg-[#c8f53a]/15 text-[#c8f53a]'
        }`}>{badge}</span>
      )}
    </button>
  )
}

export default function Dashboard() {
  const { isSignedIn, user } = useUser()
  const displayName = user?.firstName ?? user?.username ?? 'Użytkowniku'
  const displayEmail = user?.primaryEmailAddress?.emailAddress ?? 'demo@reptrack.local'

  const router = useRouter()
  const [activeNav, setActiveNav] = useState('dashboard')
  const mainRef    = useRef<HTMLDivElement>(null)
  const topbarRef  = useRef<HTMLDivElement>(null)
  const heroRefs   = useRef<(HTMLDivElement | null)[]>([])
  const feedRef    = useRef<HTMLDivElement>(null)
  const goalsRef   = useRef<HTMLDivElement>(null)
  const aiRef      = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    const tl = gsap.timeline({ delay: 0.05 })

    tl.from('.dash-nav-item', {
      opacity: 0, x: -16, duration: 0.4, stagger: 0.05, ease: 'expo.out'
    })
    tl.from(topbarRef.current, {
      opacity: 0, y: -12, duration: 0.45, ease: 'expo.out'
    }, '-=0.2')
    tl.from(heroRefs.current.filter(Boolean), {
      opacity: 0, y: 20, duration: 0.5, stagger: 0.1, ease: 'expo.out'
    }, '-=0.25')
    tl.from([feedRef.current, goalsRef.current], {
      opacity: 0, y: 16, duration: 0.45, stagger: 0.08, ease: 'expo.out'
    }, '-=0.3')
    tl.from(aiRef.current, {
      opacity: 0, y: 14, duration: 0.4, ease: 'expo.out'
    }, '-=0.3')
    tl.call(() => {
      animateCounter('dash-cv-0', 38.4, 1100, 1)
      animateCounter('dash-cv-1', 78.0, 900, 1)
      animateArcs()
      animateBars()
    }, [], '-=0.4')
    tl.from('.dash-feed-item', {
      opacity: 0, x: -10, duration: 0.35, stagger: 0.07, ease: 'expo.out'
    }, '-=0.8')
    tl.from('.dash-ai-bubble', {
      opacity: 0, y: 10, duration: 0.4, stagger: 0.1, ease: 'expo.out'
    }, '-=0.5')
    tl.from('.dash-goal-bar-wrap', {
      opacity: 0, x: -8, duration: 0.35, stagger: 0.08, ease: 'expo.out'
    }, '-=0.8')
  }, { scope: mainRef })

  useGSAP(() => {
    heroRefs.current.forEach(card => {
      if (!card) return
      card.addEventListener('mouseenter', () => gsap.to(card, { y: -3, duration: 0.3, ease: 'power2.out' }))
      card.addEventListener('mouseleave', () => gsap.to(card, { y: 0,  duration: 0.3, ease: 'power2.out' }))
    })
  }, [])

  const handleNavClick = (key: string) => {
    setActiveNav(key)
    if (mainRef.current) {
      gsap.fromTo(mainRef.current, { opacity: 0.7 }, { opacity: 1, duration: 0.3, ease: 'power2.out' })
    }
  }

  const isStandaloneView = activeNav === 'goals' || activeNav === 'profile'

  return (
    <div ref={mainRef} className="flex h-screen bg-[#080808] text-[#f0ece4] font-sans overflow-hidden">

      {/* SIDEBAR */}
      <aside className="w-[220px] flex-shrink-0 bg-[#0c0c0c] border-r border-[#1a1a1a] flex flex-col py-7 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c8f53a]/30 to-transparent" />

        <div className="dash-nav-item flex items-center gap-2 px-5 pb-7 border-b border-[#141414]">
          <div className="w-2 h-2 rounded-full bg-[#c8f53a]" />
          <span className="font-display text-base font-black text-[#f0ece4]">RepTrack</span>
        </div>

        <p className="dash-nav-item px-5 pt-5 pb-2 text-[9px] font-mono text-[#2a2a2a] uppercase tracking-[2.5px]">Główne</p>

        <div className="dash-nav-item">
          <NavItem label="Dashboard" active={activeNav==='dashboard'} onClick={()=>handleNavClick('dashboard')}
            icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" fill={activeNav==='dashboard'?'#c8f53a':'#444'}/><rect x="9" y="1" width="6" height="6" rx="1.5" fill="#222"/><rect x="1" y="9" width="6" height="6" rx="1.5" fill="#222"/><rect x="9" y="9" width="6" height="6" rx="1.5" fill="#222"/></svg>}
          />
        </div>
        <div className="dash-nav-item">
          <NavItem label="Bieganie" active={activeNav==='running'} badge="3" onClick={()=>router.push('/running')}
            icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="#555" strokeWidth="1.5"/><path d="M8 5.5v2.5l2 2" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          />
        </div>
        <div className="dash-nav-item">
          <NavItem label="Siłownia" active={activeNav==='gym'} badge="+2.5" badgeOrange onClick={()=>router.push('/gym')}
            icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="4" y="6.5" width="8" height="3" rx="1.5" fill="none" stroke="#555" strokeWidth="1.5"/><rect x="1" y="6.5" width="3" height="3" rx="1" fill="none" stroke="#555" strokeWidth="1.5"/><rect x="12" y="6.5" width="3" height="3" rx="1" fill="none" stroke="#555" strokeWidth="1.5"/></svg>}
          />
        </div>
        <div className="dash-nav-item">
          <NavItem label="Import" active={activeNav==='import'} onClick={()=>router.push('/running/import')}
            icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 10V4M5 7l3-3 3 3" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 12h12" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          />
        </div>

        <p className="dash-nav-item px-5 pt-5 pb-2 text-[9px] font-mono text-[#2a2a2a] uppercase tracking-[2.5px]">Analiza</p>

        <div className="dash-nav-item">
          <NavItem label="AI Coach" active={activeNav==='coach'} onClick={()=>router.push('/coach')}
            icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5.5" r="2.5" stroke="#555" strokeWidth="1.5"/><path d="M3.5 13.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          />
        </div>
        <div className="dash-nav-item">
          <NavItem label="Postępy" active={activeNav==='progress'} onClick={()=>handleNavClick('progress')}
            icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><polyline points="2,12 6,7 9,9 14,4" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          />
        </div>
        <div className="dash-nav-item">
          <NavItem label="Cele" active={activeNav==='goals'} tone="purple" onClick={()=>handleNavClick('goals')}
            icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke={activeNav==='goals'?'#c88cff':'#555'} strokeWidth="1.5"/><circle cx="8" cy="8" r="3" stroke={activeNav==='goals'?'#c88cff':'#555'} strokeWidth="1.5"/><circle cx="8" cy="8" r="1" fill={activeNav==='goals'?'#c88cff':'#555'}/></svg>}
          />
        </div>
        <div className="dash-nav-item">
          <NavItem label="Atlas ćwiczeń" active={activeNav==='exercises'} onClick={()=>router.push('/gym/exercises')}
            icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="#555" strokeWidth="1.5"/><line x1="2" y1="6" x2="14" y2="6" stroke="#555" strokeWidth="1.5"/><circle cx="5" cy="9.5" r="0.8" fill="#555"/></svg>}
          />
        </div>

        <div className="mt-auto pt-4 border-t border-[#141414] px-2">
          <div className="dash-nav-item">
            <NavItem label="Profil" active={activeNav==='profile'} onClick={()=>handleNavClick('profile')}
              icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="2.5" stroke="#555" strokeWidth="1.5"/><path d="M3 13c0-2.761 2.239-5 5-5s5 2.239 5 5" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/></svg>}
            />
          </div>
          <div className="flex items-center gap-2.5 px-3 py-2 mt-1">
            {isSignedIn ? (
              <UserButton afterSignOutUrl="/auth" appearance={{
                elements: { avatarBox: 'w-8 h-8 ring-1 ring-[#c8f53a]/20' }
              }}/>
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#141414] border border-[#1e1e1e] flex items-center justify-center ring-1 ring-[#c8f53a]/20">
                <span className="text-[#c8f53a] text-xs font-syne font-bold">D</span>
              </div>
            )}
            <div>
              <div className="text-[12px] font-medium text-[#bbb]">{displayName}</div>
              <div className="text-[10px] font-mono text-[#444]">{displayEmail}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-[#080808]">
        {activeNav === 'goals' && <GoalsView />}
        {activeNav === 'profile' && <Profile />}

        <div className={isStandaloneView ? 'hidden' : ''}>
        {/* TOP BAR */}
        <div ref={topbarRef} className="flex justify-between items-center px-7 pt-6 mb-6">
          <div>
            <p className="text-[10px] font-mono text-[#444] uppercase tracking-[2px] mb-1">
              {new Date().toLocaleDateString('pl-PL', { weekday:'long', day:'numeric', month:'long' })}
            </p>
            <h1 className="font-display text-[22px] font-black text-[#f0ece4]">
              Dobry ranek, <em className="not-italic text-[#c8f53a]">{displayName}</em>
            </h1>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] font-mono text-[#444] uppercase tracking-[1.5px]">Tydzień 17</span>
            <button className="relative w-9 h-9 rounded-xl bg-[#111] border border-[#1e1e1e] flex items-center justify-center hover:border-[#333] transition-colors">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2a4 4 0 00-4 4c0 2-.5 3-1.5 4h11C12.5 9 12 8 12 6a4 4 0 00-4-4zM6.5 13.5a1.5 1.5 0 003 0" stroke="#888" strokeWidth="1.5" strokeLinecap="round"/></svg>
              <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#c8f53a] border-2 border-[#080808]" />
            </button>
          </div>
        </div>

        <div className="px-7 pb-7 space-y-3">

          {/* HERO KARTY */}
          <div className="grid grid-cols-3 gap-3">

            {/* Km tygodnia */}
            <div ref={el => { heroRefs.current[0] = el }}
              className="bg-[#0f0f0f] border border-[#c8f53a]/15 rounded-2xl p-5 relative overflow-hidden hover:border-[#c8f53a]/30 transition-colors group">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c8f53a]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <ArcSVG pct={85} id="dash-arc-0" />
              <p className="text-[9px] font-mono text-[#444] uppercase tracking-[1.5px] mb-2.5 flex items-center justify-between pr-14">
                Km / tydzień
                <span className="text-[#c8f53a] bg-[#c8f53a]/10 rounded px-1.5 py-0.5">+12%</span>
              </p>
              <div id="dash-cv-0" className="font-display text-[34px] font-black text-[#c8f53a] leading-none mb-1">0</div>
              <p className="text-[10px] font-mono text-[#444]">cel: 45 km · zostało 6.6</p>
              <WeekStrip />
            </div>

            {/* Masa ciała */}
            <div ref={el => { heroRefs.current[1] = el }}
              className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-5 relative overflow-hidden hover:border-[#2a2a2a] transition-colors">
              <ArcSVG pct={67} id="dash-arc-1" color="#f5a03a" />
              <p className="text-[9px] font-mono text-[#444] uppercase tracking-[1.5px] mb-2.5 flex items-center justify-between pr-14">
                Masa ciała
                <span className="text-[#f5a03a] bg-[#f5a03a]/10 rounded px-1.5 py-0.5">-0.4kg</span>
              </p>
              <div id="dash-cv-1" className="font-display text-[34px] font-black text-[#f0ece4] leading-none mb-1">0</div>
              <p className="text-[10px] font-mono text-[#444]">cel: 76 kg · zostało 2 kg</p>
              <div className="flex gap-1 items-end h-7 mt-3.5">
                {[78.4,78.2,78.0,78.3,77.9,78.1,78.0].map((v,i) => {
                  const min=77.7, max=78.6
                  const h = Math.max(8, ((v-min)/(max-min)) * 20 + 6)
                  return <div key={i} className="flex-1 rounded-sm transition-all" style={{ height: h, background: i===6?'#f5a03a':'#1e1e1e' }} />
                })}
              </div>
            </div>

            {/* PR i rekordy */}
            <div ref={el => { heroRefs.current[2] = el }}
              className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-5 relative overflow-hidden hover:border-[#2a2a2a] transition-colors">
              <p className="text-[9px] font-mono text-[#444] uppercase tracking-[1.5px] mb-2.5 flex items-center justify-between">
                Rekord 5 km
                <span className="text-[#c8f53a] bg-[#c8f53a]/10 rounded px-1.5 py-0.5">nowy!</span>
              </p>
              <div className="font-display text-[26px] font-black text-[#f0ece4] leading-none mb-1">22:14</div>
              <p className="text-[10px] font-mono text-[#444] mb-4">poprawa o 0:32 · wt 22.04</p>
              <div className="flex flex-col gap-2">
                {[['Martwy ciąg','140 kg'],['Przysiad','120 kg'],['OHP','70 kg']].map(([lbl,val])=>(
                  <div key={lbl} className="flex justify-between items-center">
                    <span className="text-[10px] font-mono text-[#444]">{lbl}</span>
                    <span className="text-[10px] font-mono text-[#c8f53a]">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* DOLNA SIATKA */}
          <div className="grid grid-cols-2 gap-3">

            {/* Feed aktywności */}
            <div ref={feedRef} className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-display text-[15px] font-black text-[#f0ece4]">Aktywności</h2>
                <button className="text-[9px] font-mono text-[#444] uppercase tracking-[1.5px] hover:text-[#c8f53a] transition-colors">Wszystkie →</button>
              </div>
              <div className="flex flex-col">
                {MOCK_ACTIVITIES.map((a, i) => (
                  <div key={a.id} className={`dash-feed-item flex items-center gap-2.5 py-2.5 ${i < MOCK_ACTIVITIES.length-1 ? 'border-b border-[#131313]' : ''}`}>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-[14px]
                      ${a.type==='run' ? 'bg-[#c8f53a]/10 border border-[#c8f53a]/20' : 'bg-[#f5a03a]/10 border border-[#f5a03a]/20'}`}>
                      {a.type === 'run' ? '🏃' : '🏋️'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-[#ccc] truncate">{a.name}</div>
                      <div className="text-[9px] font-mono text-[#444]">{a.date}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-display text-[14px] font-black text-[#f0ece4]">
                        {a.type === 'run' ? a.distance : a.exercises}
                      </div>
                      <div className="text-[9px] font-mono text-[#444]">{a.type==='run'?'km':'ćw.'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cele */}
            <div ref={goalsRef} className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-display text-[15px] font-black text-[#f0ece4]">Cele</h2>
                <button className="text-[9px] font-mono text-[#444] uppercase tracking-[1.5px] hover:text-[#c8f53a] transition-colors">Edytuj →</button>
              </div>
              <div className="flex flex-col gap-3.5">
                {MOCK_GOALS.map((g, i) => (
                  <div key={i} className="dash-goal-bar-wrap">
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="text-[11px] text-[#777]">{g.label}</span>
                      <span id={`dash-gp-${i}`} className={`text-[10px] font-mono ${g.orange ? 'text-[#f5a03a]' : 'text-[#c8f53a]'}`}>0%</span>
                    </div>
                    <div className="h-1 bg-[#141414] rounded-full overflow-hidden">
                      <div id={`dash-gb-${i}`}
                        className={`h-full rounded-full transition-[width] duration-[1200ms] ease-[cubic-bezier(.16,1,.3,1)] ${g.orange ? 'bg-[#f5a03a]' : 'bg-[#c8f53a]'}`}
                        style={{ width: 0 }}
                        data-target={g.pct}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* AI COACH */}
          <div ref={aiRef}
            onClick={() => router.push('/coach')}
            className="bg-[#0f0f0f] border border-[#c8f53a]/15 rounded-2xl p-5 relative overflow-hidden cursor-none hover:border-[#c8f53a]/35 hover:bg-[#0f0f0f]/80 transition-colors group">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c8f53a]/40 to-transparent" />
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-2 h-2 rounded-full bg-[#c8f53a] animate-pulse" />
              <span className="text-[10px] font-mono text-[#c8f53a] uppercase tracking-[2px]">AI Coach · Analiza tygodniowa</span>
              <span className="ml-auto text-[9px] font-mono text-[#444] group-hover:text-[#c8f53a] transition-colors">Otwórz →</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon:'🏃', txt:<>Tempo 5km poprawiło się o <strong className="text-[#f0ece4] font-medium">8 sek/km</strong>. Zwiększ objętość o 10% w przyszłym tygodniu.</> },
                { icon:'🏋️', txt:<>Plateau na martwym ciągu od <strong className="text-[#f0ece4] font-medium">3 tygodni</strong>. Spróbuj deload + zmień zakres na 3×3.</> },
                { icon:'⚖️', txt:<>Waga spada <strong className="text-[#f0ece4] font-medium">regularnie</strong>. Kalorie w normie. Utrzymaj obecny deficyt.</> },
              ].map(({ icon, txt }, i) => (
                <div key={i} className="dash-ai-bubble bg-[#131313] border border-[#1e1e1e] rounded-xl p-3">
                  <div className="text-base mb-1.5">{icon}</div>
                  <p className="text-[11px] text-[#777] leading-relaxed">{txt}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
        </div>
      </main>
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

function animateArcs() {
  const targets = [85, 67]
  ;['dash-arc-0', 'dash-arc-1'].forEach((id, i) => {
    const el = document.getElementById(id)
    if (!el) return
    const circ = 113
    el.setAttribute('stroke-dashoffset', String(circ))
    setTimeout(() => {
      el.setAttribute('stroke-dashoffset', String(circ - (circ * targets[i] / 100)))
    }, 50)
  })
}

function animateBars() {
  [0, 1, 2, 3].forEach((i) => {
    const bar   = document.getElementById(`dash-gb-${i}`)
    const label = document.getElementById(`dash-gp-${i}`)
    const target = Number(bar?.dataset.target ?? 0)
    if (!bar || !label) return
    setTimeout(() => {
      let current = 0
      const step = setInterval(() => {
        current += 2
        if (current >= target) { current = target; clearInterval(step) }
        bar.style.width = `${current}%`
        label.textContent = `${current}%`
      }, 16)
    }, i * 120)
  })
}
