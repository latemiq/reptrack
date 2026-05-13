'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Category = 'gym' | 'running' | 'diet' | 'recovery'

interface Conversation {
  id: string
  title: string
  category: Category
  updatedAt: Date
  group: 'today' | 'yesterday' | 'older'
}

interface InsightCell {
  label: string
  value: string
  unit?: string
  sub?: string
  color?: 'lime' | 'orange' | 'white'
}

export interface WorkoutRef {
  id: string
  name: string
  date: string
  detail: string
  type: 'gym' | 'running'
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  insights?: InsightCell[]
  workoutRefs?: WorkoutRef[]
  timestamp: Date
  isStreaming?: boolean
}

interface ContextChip {
  id: string
  icon?: string
  label: string
  count?: number
  variant: 'lime' | 'orange' | 'blue'
  active: boolean
}

// ─── MOCK DATA ────────────────────────────────────────────────────────────────

const MOCK_CONVERSATIONS: Conversation[] = [
  { id: '1', title: 'Plateau na martwym ciągu – analiza 4 tygodni', category: 'gym',      updatedAt: new Date(),                          group: 'today'     },
  { id: '2', title: 'Plan tygodnia po cardio',                       category: 'running',  updatedAt: new Date(),                          group: 'today'     },
  { id: '3', title: 'Dlaczego wolniej biegnę rano niż wieczorem?',   category: 'running',  updatedAt: new Date(Date.now() - 86400000),     group: 'yesterday' },
  { id: '4', title: 'Deficyt vs. utrzymanie siły',                   category: 'diet',     updatedAt: new Date(Date.now() - 86400000),     group: 'yesterday' },
  { id: '5', title: 'Jak zaplanować deload week?',                   category: 'recovery', updatedAt: new Date(Date.now() - 86400000),     group: 'yesterday' },
  { id: '6', title: 'Półmaraton – przygotowanie 12 tygodni',         category: 'running',  updatedAt: new Date(Date.now() - 4 * 86400000), group: 'older'     },
  { id: '7', title: 'Push/Pull/Legs split – review',                 category: 'gym',      updatedAt: new Date(Date.now() - 6 * 86400000), group: 'older'     },
  { id: '8', title: 'Regeneracja po PR na 5 km',                     category: 'recovery', updatedAt: new Date(Date.now() - 8 * 86400000), group: 'older'     },
]

const CATEGORY_CFG: Record<Category, { label: string; color: string; bg: string }> = {
  gym:      { label: 'Siłownia',  color: '#f5a03a', bg: 'rgba(245,160,58,0.1)'  },
  running:  { label: 'Bieganie',  color: '#c8f53a', bg: 'rgba(200,245,58,0.1)'  },
  diet:     { label: 'Dieta',     color: '#3cc8ff', bg: 'rgba(60,200,255,0.1)'  },
  recovery: { label: 'Recovery',  color: '#c88cff', bg: 'rgba(200,140,255,0.1)' },
}

const SUGGESTED_PROMPTS = [
  'Pokaż mi plan deload',
  'Co z bieganiem podczas deload?',
  'Ile mam jeść w deload?',
  'Co po deload?',
]

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: Category }) {
  const cfg = CATEGORY_CFG[category]
  return (
    <span
      className="text-[8px] font-mono px-1.5 py-0.5 rounded uppercase tracking-[0.5px]"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  )
}

function ContextChipItem({ chip, onRemove }: { chip: ContextChip; onRemove: () => void }) {
  const colors = {
    lime:   'bg-[#c8f53a]/[0.06] border-[#c8f53a]/20 text-[#c8f53a] hover:bg-[#c8f53a]/10',
    orange: 'bg-[#f5a03a]/[0.06] border-[#f5a03a]/20 text-[#f5a03a] hover:bg-[#f5a03a]/10',
    blue:   'bg-[#3cc8ff]/[0.06] border-[#3cc8ff]/20 text-[#3cc8ff] hover:bg-[#3cc8ff]/10',
  }
  return (
    <div className={`coach-ctx-chip flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-mono whitespace-nowrap transition-all ${colors[chip.variant]}`}>
      {chip.icon && <span style={{ fontSize: 10 }}>{chip.icon}</span>}
      <span>{chip.label}</span>
      {chip.count != null && <span className="opacity-70">{chip.count}</span>}
      <button onClick={onRemove} className="text-current opacity-40 hover:opacity-100 ml-0.5 cursor-none" aria-label="Usuń kontekst">×</button>
    </div>
  )
}

function InsightCard({ cells }: { cells: InsightCell[] }) {
  const colorClass = (c?: InsightCell['color']) =>
    c === 'orange' ? 'text-[#f5a03a]'
    : c === 'white' ? 'text-[#f0ece4]'
    : 'text-[#c8f53a]'

  return (
    <div className="mt-2.5 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-3 grid grid-cols-2 gap-2">
      {cells.map((c, i) => (
        <div key={i} className="coach-insight-cell px-2 py-1.5">
          <div className="text-[8px] font-mono text-[#444] uppercase tracking-[1.5px] mb-1">{c.label}</div>
          <div className={`font-display font-black leading-none ${colorClass(c.color)} ${
            c.value.length > 6 ? 'text-[14px]' : 'text-[18px]'
          }`}>
            {c.value}{c.unit && <span className="text-[11px] text-[#666] font-light"> {c.unit}</span>}
          </div>
          {c.sub && <div className="text-[9px] font-mono text-[#666] mt-1">{c.sub}</div>}
        </div>
      ))}
    </div>
  )
}

function WorkoutRefCard({ workoutRef, onClick }: { workoutRef: WorkoutRef; onClick: () => void }) {
  const isGym = workoutRef.type === 'gym'
  const accent = isGym ? '#f5a03a' : '#c8f53a'
  return (
    <button
      onClick={onClick}
      className="mt-2.5 w-full bg-[#0a0a0a] border rounded-xl p-3 flex items-center gap-2.5 cursor-none transition-all hover:-translate-y-px text-left"
      style={{ borderColor: `${accent}33` }}
      onMouseEnter={e => { e.currentTarget.style.background = `${accent}0a`; e.currentTarget.style.borderColor = `${accent}55` }}
      onMouseLeave={e => { e.currentTarget.style.background = '#0a0a0a'; e.currentTarget.style.borderColor = `${accent}33` }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-[14px] flex-shrink-0"
        style={{ background: `${accent}1a` }}
      >
        {isGym ? '🏋️' : '🏃'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-[#f0ece4] font-medium truncate">
          {workoutRef.name} · {workoutRef.date}
        </div>
        <div className="text-[9.5px] font-mono text-[#666] truncate">
          {workoutRef.detail}
        </div>
      </div>
      <span className="text-[#444] text-[13px] flex-shrink-0">→</span>
    </button>
  )
}

function FormattedText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="text-[#c8f53a] font-medium">{part.slice(2, -2)}</strong>
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={i} className="not-italic text-[#f5a03a]">{part.slice(1, -1)}</em>
        }
        return part.split('\n').map((line, j, arr) => (
          <span key={`${i}-${j}`}>
            {line}
            {j < arr.length - 1 && <br />}
          </span>
        ))
      })}
    </>
  )
}

function AnalyzingIndicator({ text }: { text?: string }) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-3">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#c8f53a] opacity-40 animate-typing"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
      {text && (
        <span className="text-[10px] font-mono text-[#666] uppercase tracking-[1.5px]">{text}</span>
      )}
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function CoachChat() {
  const router = useRouter()
  const { user } = useUser()
  const containerRef = useRef<HTMLDivElement>(null)
  const messagesRef  = useRef<HTMLDivElement>(null)
  const scanFxRef    = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLTextAreaElement>(null)

  const [activeConvId, setActiveConvId] = useState('1')
  const [searchQuery, setSearchQuery]   = useState('')
  const [conversations] = useState<Conversation[]>(MOCK_CONVERSATIONS)

  const [contextChips, setContextChips] = useState<ContextChip[]>([
    { id: 'period',  label: 'Ostatnie 30 dni',        variant: 'lime',   active: true },
    { id: 'gym',     icon: '🏋️', label: 'treningów', count: 16, variant: 'orange', active: true },
    { id: 'running', icon: '🏃', label: 'biegów',     count: 12, variant: 'lime',   active: true },
    { id: 'health',  icon: '⚖️', label: 'Waga · sen · HRV',    variant: 'blue',   active: true },
    { id: 'goals',   icon: '🎯', label: 'cele',       count: 4,  variant: 'orange', active: true },
  ])

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm1', role: 'assistant',
      content: 'Cześć! Skończyłem analizę Twoich danych z ostatnich 4 tygodni.\n\nWidzę dwa wzorce wymagające uwagi: **plateau na martwym ciągu od 3 tygodni** oraz świetny *progres tempa biegowego* (8 sek/km szybciej). Przy obecnym deficycie kalorycznym te dwie rzeczy są ze sobą powiązane – zaraz Ci to pokażę.',
      timestamp: new Date(Date.now() - 120000),
    },
    {
      id: 'm2', role: 'user',
      content: 'Pogadajmy najpierw o martwym ciągu. Stoję na 140kg już trzeci tydzień i to mnie wkurza.',
      timestamp: new Date(Date.now() - 60000),
    },
    {
      id: 'm3', role: 'assistant',
      content: 'Spójrz na liczby – nie brakuje Ci siły, brakuje Ci *świeżości*. Twoje RPE rośnie przy tym samym ciężarze (8 → 9 → 9.5), a tonaż tygodniowy spadł o **12%**.',
      insights: [
        { label: 'Aktualne 1RM',  value: '158',    unit: 'kg',  sub: 'szac. z RPE · Epley', color: 'white'  },
        { label: 'Plateau',       value: '21',     unit: 'dni', sub: '3 sesje 140kg',        color: 'orange' },
        { label: 'Tonaż / tydz.', value: '↓ 12%',              sub: 'vs. tydzień 1'                          },
        { label: 'Sugestia',      value: 'Deload 7d',           sub: 'redukcja -30%'                          },
      ],
      workoutRefs: [
        { id: 'wk-123', name: 'Pull · plecy + biceps', date: '18.04', detail: 'Martwy ciąg 4×6 @ 140kg · RPE 9.5 · ostatnia sesja', type: 'gym' },
      ],
      timestamp: new Date(Date.now() - 30000),
    },
  ])

  const [inputValue, setInputValue]     = useState('')
  const [isAnalyzing, setIsAnalyzing]   = useState(false)
  const [analyzingText, setAnalyzingText] = useState('')

  const userInitials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'U'
    : 'U'

  // ── Filtered + grouped conversations ──────────────────────────────────────
  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter(c => c.title.toLowerCase().includes(q))
  }, [conversations, searchQuery])

  const grouped = useMemo(() => ({
    today:     filteredConversations.filter(c => c.group === 'today'),
    yesterday: filteredConversations.filter(c => c.group === 'yesterday'),
    older:     filteredConversations.filter(c => c.group === 'older'),
  }), [filteredConversations])

  // ── Entry animations ───────────────────────────────────────────────────────
  useGSAP(() => {
    const tl = gsap.timeline({ delay: 0.05 })
    tl.from('.coach-conv-item',    { opacity: 0, x: -10,     duration: 0.35, stagger: 0.04,  ease: 'expo.out' })
    tl.from('.coach-header',       { opacity: 0, y: -8,      duration: 0.4,                  ease: 'expo.out' }, '-=0.5')
    tl.from('.coach-ctx-bar',      { opacity: 0, y: -6,      duration: 0.4,                  ease: 'expo.out' }, '-=0.3')
    tl.from('.coach-ctx-chip',     { opacity: 0, scale: 0.9, duration: 0.3,  stagger: 0.05,  ease: 'back.out(2)' }, '-=0.2')
    tl.from('.coach-msg',          { opacity: 0, y: 14,      duration: 0.5,  stagger: 0.18,  ease: 'expo.out' }, '-=0.1')
    tl.from('.coach-insight-cell', { opacity: 0, y: 6,       duration: 0.3,  stagger: 0.06,  ease: 'expo.out' }, '-=0.3')
    tl.from('.coach-workout-ref',  { opacity: 0, scale: 0.95,duration: 0.4,                  ease: 'back.out(1.5)' }, '-=0.2')
    tl.from('.coach-sugg-chip',    { opacity: 0, y: 8,       duration: 0.35, stagger: 0.05,  ease: 'expo.out' }, '-=0.3')
    tl.from('.coach-input-bar',    { opacity: 0, y: 10,      duration: 0.4,                  ease: 'expo.out' }, '-=0.4')
  }, { scope: containerRef })

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [messages, isAnalyzing])

  // ── Auto-resize textarea ───────────────────────────────────────────────────
  useEffect(() => {
    const ta = inputRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 80) + 'px'
  }, [inputValue])

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = inputValue.trim()
    if (!text || isAnalyzing) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInputValue('')
    setIsAnalyzing(true)

    if (scanFxRef.current) {
      scanFxRef.current.classList.add('active')
      setTimeout(() => scanFxRef.current?.classList.remove('active'), 2400)
    }

    const phases = [
      'Sprawdzam HRV i RPE z ostatnich 7 dni',
      'Analizuję progresję tygodniową',
      'Generuję rekomendacje',
    ]
    let phaseIdx = 0
    setAnalyzingText(phases[0])
    const phaseInterval = setInterval(() => {
      phaseIdx = (phaseIdx + 1) % phases.length
      setAnalyzingText(phases[phaseIdx])
    }, 1200)

    try {
      // TODO: replace with fetch to /api/coach/chat with streaming
      await new Promise(r => setTimeout(r, 2400))
      clearInterval(phaseInterval)
      const aiMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '*(podłącz `/api/coach/chat` żeby działało – to mock response)*',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, aiMsg])
    } catch (e) {
      console.error('Coach API error:', e)
    } finally {
      clearInterval(phaseInterval)
      setIsAnalyzing(false)
      setAnalyzingText('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  const removeChip = (id: string) => {
    setContextChips(prev => prev.map(c => c.id === id ? { ...c, active: false } : c))
  }

  const handleWorkoutRefClick = (ref: WorkoutRef) => {
    if (ref.type === 'gym') router.push('/gym/history')
    else router.push(`/running/${ref.id}`)
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="flex h-screen bg-[#080808] text-[#f0ece4] font-sans overflow-hidden">

      {/* ── SIDEBAR ── */}
      <aside className="w-[240px] flex-shrink-0 bg-[#0a0a0a] border-r border-[#161616] flex flex-col py-3.5">
        <div className="px-3 pb-2.5 border-b border-[#141414] flex justify-between items-center mb-1.5">
          <div className="font-display text-[13px] font-black text-[#f0ece4]">Konsultacje</div>
          <button
            onClick={() => {/* TODO: createConversation() */}}
            title="Nowa konsultacja"
            className="w-7 h-7 rounded-lg bg-[#c8f53a] text-[#080808] text-[14px] font-bold flex items-center justify-center cursor-none hover:scale-110 transition-transform"
          >+</button>
        </div>

        {/* Search */}
        <div className="px-3 pb-2.5">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#555]" width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M8 8l2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <input
              type="search"
              placeholder="Szukaj rozmów..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#111] border border-[#1a1a1a] focus:border-[#c8f53a]/30 rounded-lg pl-7 pr-3 py-1.5 text-[11px] text-[#ccc] placeholder:text-[#444] outline-none transition-colors"
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(['today', 'yesterday', 'older'] as const).map(group => {
            const convs = grouped[group]
            if (convs.length === 0) return null
            const labels = { today: 'Dziś', yesterday: 'Wczoraj', older: 'Wcześniej' }
            return (
              <div key={group}>
                <p className="px-3 pt-2 pb-1.5 text-[8px] font-mono text-[#2a2a2a] uppercase tracking-[2px]">
                  {labels[group]}
                </p>
                {convs.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                    className={`coach-conv-item w-full text-left px-2.5 py-2 rounded-lg border mb-px transition-all duration-150 cursor-none ${
                      activeConvId === conv.id
                        ? 'bg-[#c8f53a]/[0.06] border-[#c8f53a]/15'
                        : 'border-transparent hover:bg-white/[0.02] hover:border-white/[0.04]'
                    }`}
                  >
                    <div className={`text-[11.5px] mb-1 leading-tight line-clamp-2 ${
                      activeConvId === conv.id ? 'text-[#f0ece4] font-medium' : 'text-[#bbb]'
                    }`}>{conv.title}</div>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-mono text-[#444]">
                        {conv.updatedAt.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <CategoryBadge category={conv.category} />
                    </div>
                  </button>
                ))}
              </div>
            )
          })}

          {filteredConversations.length === 0 && (
            <div className="text-center py-8 px-3">
              <p className="text-[11px] text-[#555]">Brak rozmów pasujących do &ldquo;{searchQuery}&rdquo;</p>
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN CHAT ── */}
      <main className="flex-1 flex flex-col bg-[#080808] relative">
        {/* Scan overlay */}
        <div
          ref={scanFxRef}
          className="absolute inset-0 pointer-events-none z-[5] opacity-0 transition-opacity duration-300
                     [&.active]:opacity-100 bg-gradient-to-b from-transparent via-[#c8f53a]/[0.025] to-transparent
                     [background-size:100%_200%] [&.active]:animate-scan"
        />

        {/* HEADER */}
        <div className="coach-header flex items-center justify-between px-6 py-3.5 border-b border-[#141414] bg-[#0a0a0a]">
          <div className="flex items-center gap-3">
            <div className="relative w-[38px] h-[38px] rounded-xl bg-gradient-to-br from-[#c8f53a]/[0.18] to-[#c8f53a]/[0.05] border border-[#c8f53a]/30 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2L12 7L17 7.5L13 11L14 16L10 13.5L6 16L7 11L3 7.5L8 7L10 2Z" fill="none" stroke="#c8f53a" strokeWidth="1.4" strokeLinejoin="round"/>
              </svg>
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#c8f53a] border-2 border-[#0a0a0a] animate-pulse" />
            </div>
            <div>
              <div className="font-display text-[15px] font-black text-[#f0ece4]">
                Coach <em className="not-italic text-[#c8f53a]">AI</em>
              </div>
              <div className="text-[9.5px] font-mono text-[#c8f53a] uppercase tracking-[1.8px] flex items-center gap-1.5 mt-0.5">
                <span className="w-1 h-1 rounded-full bg-[#c8f53a] animate-pulse" />
                Online · Claude Opus 4.7
              </div>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button title="Eksport rozmowy" className="w-8 h-8 rounded-lg bg-[#111] border border-[#1e1e1e] flex items-center justify-center hover:border-[#333] transition-colors cursor-none">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 9V2M4 5l3-3 3 3" stroke="#888" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 11h10" stroke="#888" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>
            <button title="Ustawienia" className="w-8 h-8 rounded-lg bg-[#111] border border-[#1e1e1e] flex items-center justify-center hover:border-[#333] transition-colors cursor-none">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="2" stroke="#888" strokeWidth="1.3"/>
                <path d="M7 1v2M7 11v2M1 7h2M11 7h2" stroke="#888" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* CONTEXT CHIPS */}
        <div className="coach-ctx-bar px-6 py-2.5 bg-[#0a0a0a] border-b border-[#141414] flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="text-[9px] font-mono text-[#444] uppercase tracking-[1.5px] whitespace-nowrap flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-[#c8f53a] animate-pulse" />
            Kontekst aktywny
          </span>
          {contextChips.filter(c => c.active).map(chip => (
            <ContextChipItem key={chip.id} chip={chip} onRemove={() => removeChip(chip.id)} />
          ))}
        </div>

        {/* MESSAGES */}
        <div ref={messagesRef} className="flex-1 overflow-y-auto px-6 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {messages.map(msg => (
            <div key={msg.id} className={`coach-msg flex gap-2.5 mb-[18px] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-[30px] h-[30px] rounded-lg flex-shrink-0 flex items-center justify-center text-[11px] font-mono font-bold ${
                msg.role === 'assistant'
                  ? 'bg-[#c8f53a]/10 border border-[#c8f53a]/25 text-[#c8f53a]'
                  : 'bg-gradient-to-br from-[#c8f53a] to-[#7ef5b0] text-[#080808]'
              }`}>
                {msg.role === 'assistant' ? 'AI' : userInitials}
              </div>
              <div className="max-w-[75%]">
                <div className={`text-[9px] font-mono text-[#444] uppercase tracking-wider mb-1.5 flex items-center gap-1.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <span>{msg.role === 'assistant' ? 'Coach AI' : 'Ty'}</span>
                  <span>·</span>
                  <span>{msg.timestamp.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className={`rounded-2xl px-3.5 py-3 text-[13px] leading-[1.65] ${
                  msg.role === 'user'
                    ? 'bg-[#c8f53a]/[0.06] border border-[#c8f53a]/15 text-[#f0ece4] rounded-tr-2xl rounded-br-[4px] rounded-bl-2xl rounded-tl-2xl'
                    : 'bg-[#111] border border-[#1a1a1a] text-[#d0ccc4] rounded-tl-2xl rounded-bl-[4px] rounded-tr-2xl rounded-br-2xl'
                }`}>
                  <FormattedText text={msg.content} />
                  {msg.insights && <InsightCard cells={msg.insights} />}
                  {msg.workoutRefs?.map(wref => (
                    <div key={wref.id} className="coach-workout-ref">
                      <WorkoutRefCard workoutRef={wref} onClick={() => handleWorkoutRefClick(wref)} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {isAnalyzing && (
            <div className="coach-msg flex gap-2.5 mb-[18px]">
              <div className="w-[30px] h-[30px] rounded-lg flex-shrink-0 flex items-center justify-center text-[11px] font-mono font-bold bg-[#c8f53a]/10 border border-[#c8f53a]/25 text-[#c8f53a]">AI</div>
              <div className="max-w-[75%]">
                <div className="text-[9px] font-mono uppercase tracking-wider mb-1.5 text-[#c8f53a]">
                  Coach AI · analizuje dane treningowe...
                </div>
                <div className="bg-[#111] border border-[#1a1a1a] rounded-tl-2xl rounded-bl-[4px] rounded-tr-2xl rounded-br-2xl">
                  <AnalyzingIndicator text={analyzingText} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SUGGESTIONS */}
        <div className="px-6 pb-2.5 pt-1">
          <div className="text-[9px] font-mono text-[#444] uppercase tracking-[1.5px] mb-2">Zasugeruj:</div>
          <div className="flex gap-1.5 flex-wrap">
            {SUGGESTED_PROMPTS.map(prompt => (
              <button
                key={prompt}
                onClick={() => { setInputValue(prompt); inputRef.current?.focus() }}
                className="coach-sugg-chip px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[11px] text-[#888] hover:bg-[#c8f53a]/[0.06] hover:border-[#c8f53a]/20 hover:text-[#c8f53a] hover:-translate-y-px transition-all cursor-none whitespace-nowrap"
              >{prompt}</button>
            ))}
          </div>
        </div>

        {/* INPUT */}
        <div className="coach-input-bar px-6 pt-3 pb-4 border-t border-[#141414] bg-[#0a0a0a]">
          <div className="bg-[#111] border border-[#1e1e1e] focus-within:border-[#c8f53a]/30 rounded-2xl p-2.5 flex items-end gap-2 transition-colors">
            <div className="flex gap-0.5 pb-1">
              <button title="Załącz screenshot" className="w-6 h-6 rounded-md flex items-center justify-center text-[#666] hover:bg-white/[0.04] hover:text-[#c8f53a] transition-all cursor-none">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M9 6.5v3a2.5 2.5 0 01-5 0V4.5a1.5 1.5 0 013 0V8.5a0.5 0.5 0 01-1 0V5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
              </button>
              <button title="Dodaj kontekst" className="w-6 h-6 rounded-md flex items-center justify-center text-[#666] hover:bg-white/[0.04] hover:text-[#c8f53a] transition-all cursor-none">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <textarea
              ref={inputRef}
              rows={1}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isAnalyzing}
              placeholder="Zapytaj o swoje treningi, plany, regenerację..."
              className="flex-1 bg-transparent border-none text-[#f0ece4] text-[13px] resize-none min-h-[22px] max-h-[80px] outline-none py-1 leading-[1.5] placeholder:text-[#444] disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isAnalyzing}
              className="w-[34px] h-[34px] rounded-[10px] bg-[#c8f53a] hover:bg-[#d8ff4a] disabled:opacity-30 disabled:cursor-not-allowed enabled:hover:scale-105 active:scale-95 flex items-center justify-center cursor-none transition-all"
              aria-label="Wyślij wiadomość"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M13 1.5L6.5 8M13 1.5l-4.5 11-2-4.5-4.5-2 11-4.5z" stroke="#080808" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          <div className="flex justify-between mt-1.5 px-1">
            <span className="text-[9px] font-mono text-[#333]">Ctrl + Enter aby wysłać · 📎 dla screenshota Garmin</span>
            <span className="text-[9px] font-mono text-[#333]">Coach widzi twoje dane treningowe</span>
          </div>
        </div>
      </main>
    </div>
  )
}
