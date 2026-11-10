'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useUser } from '@clerk/nextjs'

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Category = 'gym' | 'running' | 'diet' | 'recovery'
type ContextKey = 'gym' | 'running' | 'health' | 'goals'

interface Conversation {
  id: string
  title: string
  category: Category
  updatedAt: Date
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isError?: boolean
}

interface ContextChip {
  id: ContextKey
  icon?: string
  label: string
  count?: number
  variant: 'lime' | 'orange' | 'blue'
  active: boolean
}

interface ConversationRow { id: string; title: string; category: string; updated_at: string }

const CATEGORY_CFG: Record<Category, { label: string; color: string; bg: string }> = {
  gym:      { label: 'Siłownia',  color: '#f5a03a', bg: 'rgba(245,160,58,0.1)'  },
  running:  { label: 'Bieganie',  color: '#c8f53a', bg: 'rgba(200,245,58,0.1)'  },
  diet:     { label: 'Dieta',     color: '#3cc8ff', bg: 'rgba(60,200,255,0.1)'  },
  recovery: { label: 'Regeneracja',  color: '#c88cff', bg: 'rgba(200,140,255,0.1)' },
}

const SUGGESTED_PROMPTS = [
  'Podsumuj mój ostatni tydzień',
  'Jak idzie progres w ćwiczeniach siłowych?',
  'Zaplanuj mi treningi na kolejny tydzień',
  'Czy nie trenuję za dużo?',
]

const toConversation = (r: ConversationRow): Conversation => ({
  id: r.id,
  title: r.title,
  category: (r.category in CATEGORY_CFG ? r.category : 'gym') as Category,
  updatedAt: new Date(r.updated_at),
})

const dayGroup = (d: Date): 'today' | 'yesterday' | 'older' => {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (d >= today) return 'today'
  if (d.getTime() >= today.getTime() - 86400000) return 'yesterday'
  return 'older'
}

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  content: 'Cześć! Jestem Twoim Asystentem AI. Widzę Twoje treningi, biegi, pomiary wagi i cele z ostatnich 30 dni.\n\nZapytaj o analizę postępów, plan na kolejny tydzień albo cokolwiek, co Cię nurtuje w treningu.',
  timestamp: new Date(),
}

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

function ContextChipItem({ chip, onToggle }: { chip: ContextChip; onToggle: () => void }) {
  const colors = {
    lime:   'bg-[#c8f53a]/[0.06] border-[#c8f53a]/20 text-[#c8f53a] hover:bg-[#c8f53a]/10',
    orange: 'bg-[#f5a03a]/[0.06] border-[#f5a03a]/20 text-[#f5a03a] hover:bg-[#f5a03a]/10',
    blue:   'bg-[#3cc8ff]/[0.06] border-[#3cc8ff]/20 text-[#3cc8ff] hover:bg-[#3cc8ff]/10',
  }
  return (
    <button
      onClick={onToggle}
      title={chip.active ? 'Wyłącz ten kontekst' : 'Włącz ten kontekst'}
      className={`coach-ctx-chip flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-mono whitespace-nowrap transition-all ${
        chip.active ? colors[chip.variant] : 'bg-transparent border-[#1e1e1e] text-[#444] line-through'
      }`}
    >
      {chip.icon && <span style={{ fontSize: 10 }}>{chip.icon}</span>}
      {chip.count != null && <span>{chip.count}</span>}
      <span>{chip.label}</span>
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
  const { user } = useUser()
  const containerRef = useRef<HTMLDivElement>(null)
  const messagesRef  = useRef<HTMLDivElement>(null)
  const scanFxRef    = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLTextAreaElement>(null)

  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery]   = useState('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [showHistory, setShowHistory] = useState(false)

  const [contextChips, setContextChips] = useState<ContextChip[]>([
    { id: 'gym',     icon: '🏋️', label: 'treningów',     variant: 'orange', active: true },
    { id: 'running', icon: '🏃', label: 'biegów',        variant: 'lime',   active: true },
    { id: 'health',  icon: '⚖️', label: 'pomiarów wagi', variant: 'blue',   active: true },
    { id: 'goals',   icon: '🎯', label: 'celów',         variant: 'orange', active: true },
  ])

  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [inputValue, setInputValue]     = useState('')
  const [isAnalyzing, setIsAnalyzing]   = useState(false)
  const [analyzingText, setAnalyzingText] = useState('')

  const userInitials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'U'
    : 'U'

  // ── Load conversations + context counts ───────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/coach/conversations')
      if (!res.ok) return
      const data = await res.json() as { conversations: ConversationRow[]; context: Record<string, number> }
      setConversations(data.conversations.map(toConversation))
      const counts: Record<ContextKey, number> = {
        gym: data.context.workouts, running: data.context.runs, health: data.context.weights, goals: data.context.goals,
      }
      setContextChips(prev => prev.map(c => ({ ...c, count: counts[c.id] })))
    } catch { /* offline */ }
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])

  const openConversation = async (id: string) => {
    if (isAnalyzing) return
    setActiveConvId(id)
    setShowHistory(false)
    setMessages([])
    try {
      const res = await fetch(`/api/coach/conversations/${id}`)
      if (!res.ok) throw new Error()
      const data = await res.json() as { messages: { id: string; role: 'user' | 'assistant'; content: string; created_at: string }[] }
      setMessages(data.messages.map(m => ({ id: m.id, role: m.role, content: m.content, timestamp: new Date(m.created_at) })))
    } catch {
      setMessages([{ id: 'err', role: 'assistant', content: 'Nie udało się wczytać tej rozmowy.', timestamp: new Date(), isError: true }])
    }
  }

  const newConversation = () => {
    if (isAnalyzing) return
    setActiveConvId(null)
    setShowHistory(false)
    setMessages([{ ...WELCOME, timestamp: new Date() }])
    inputRef.current?.focus()
  }

  const deleteConversation = async (id: string) => {
    if (!confirm('Usunąć tę rozmowę?')) return
    const res = await fetch(`/api/coach/conversations/${id}`, { method: 'DELETE' }).catch(() => null)
    if (!res?.ok) return
    setConversations(cs => cs.filter(c => c.id !== id))
    if (activeConvId === id) newConversation()
  }

  const exportConversation = () => {
    const title = conversations.find(c => c.id === activeConvId)?.title ?? 'Rozmowa z Asystentem AI'
    const md = [`# ${title}`, '', ...messages.map(m =>
      `**${m.role === 'assistant' ? 'Asystent AI' : 'Ty'}** · ${m.timestamp.toLocaleString('pl-PL')}\n\n${m.content}\n`)].join('\n')
    const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `reptrack-coach-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Filtered + grouped conversations ──────────────────────────────────────
  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter(c => c.title.toLowerCase().includes(q))
  }, [conversations, searchQuery])

  const grouped = useMemo(() => ({
    today:     filteredConversations.filter(c => dayGroup(c.updatedAt) === 'today'),
    yesterday: filteredConversations.filter(c => dayGroup(c.updatedAt) === 'yesterday'),
    older:     filteredConversations.filter(c => dayGroup(c.updatedAt) === 'older'),
  }), [filteredConversations])

  // ── Entry animations ───────────────────────────────────────────────────────
  useGSAP(() => {
    const tl = gsap.timeline({ delay: 0.05 })
    tl.from('.coach-header',    { opacity: 0, y: -8,      duration: 0.4,                 ease: 'expo.out' })
    tl.from('.coach-ctx-bar',   { opacity: 0, y: -6,      duration: 0.4,                 ease: 'expo.out' }, '-=0.3')
    tl.from('.coach-ctx-chip',  { opacity: 0, scale: 0.9, duration: 0.3,  stagger: 0.05, ease: 'back.out(2)' }, '-=0.2')
    tl.from('.coach-sugg-chip', { opacity: 0, y: 8,       duration: 0.35, stagger: 0.05, ease: 'expo.out' }, '-=0.3')
    tl.from('.coach-input-bar', { opacity: 0, y: 10,      duration: 0.4,                 ease: 'expo.out' }, '-=0.4')
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

  // ── Send message (SSE stream from /api/coach/chat) ─────────────────────────
  const handleSend = async (preset?: string) => {
    const text = (preset ?? inputValue).trim()
    if (!text || isAnalyzing) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date() }
    const aiId = crypto.randomUUID()
    setMessages(prev => [...prev.filter(m => m.id !== 'welcome'), userMsg])
    setInputValue('')
    setIsAnalyzing(true)

    if (scanFxRef.current) {
      scanFxRef.current.classList.add('active')
      setTimeout(() => scanFxRef.current?.classList.remove('active'), 2400)
    }

    const phases = ['Wczytuję Twoje treningi i biegi', 'Analizuję progresję', 'Przygotowuję odpowiedź']
    let phaseIdx = 0
    setAnalyzingText(phases[0])
    const phaseInterval = setInterval(() => {
      phaseIdx = (phaseIdx + 1) % phases.length
      setAnalyzingText(phases[phaseIdx])
    }, 1600)

    let started = false
    const appendDelta = (delta: string) => {
      if (!started) {
        started = true
        clearInterval(phaseInterval)
        setIsAnalyzing(false)
        setMessages(prev => [...prev, { id: aiId, role: 'assistant', content: delta, timestamp: new Date() }])
      } else {
        setMessages(prev => prev.map(m => (m.id === aiId ? { ...m, content: m.content + delta } : m)))
      }
    }

    try {
      const res = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConvId,
          message: text,
          context: contextChips.filter(c => c.active).map(c => c.id),
        }),
      })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''
        for (const evt of events) {
          const line = evt.trim()
          if (!line.startsWith('data:')) continue
          const payload = JSON.parse(line.slice(5).trim()) as { type: string; delta?: string; id?: string; message?: string }
          if (payload.type === 'conversation' && payload.id) setActiveConvId(payload.id)
          else if (payload.type === 'text' && payload.delta) appendDelta(payload.delta)
          else if (payload.type === 'error') throw new Error(payload.message)
        }
      }
      if (!started) throw new Error('Coach nie zwrócił odpowiedzi. Spróbuj ponownie.')
    } catch (e) {
      console.error('Coach API error:', e)
      const msg = e instanceof Error && e.message && !e.message.startsWith('HTTP')
        ? e.message
        : 'Coach jest chwilowo niedostępny. Spróbuj ponownie za chwilę.'
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: msg, timestamp: new Date(), isError: true }])
    } finally {
      clearInterval(phaseInterval)
      setIsAnalyzing(false)
      setAnalyzingText('')
      loadConversations()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const toggleChip = (id: ContextKey) => {
    setContextChips(prev => prev.map(c => (c.id === id ? { ...c, active: !c.active } : c)))
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────
  const conversationList = (
    <>
      {(['today', 'yesterday', 'older'] as const).map(group => {
        const convs = grouped[group]
        if (convs.length === 0) return null
        const labels = { today: 'Dziś', yesterday: 'Wczoraj', older: 'Wcześniej' }
        return (
          <div key={group}>
            <p className="px-3 pt-2 pb-1.5 text-[8px] font-mono text-[#444] uppercase tracking-[2px]">
              {labels[group]}
            </p>
            {convs.map(conv => (
              <div
                key={conv.id}
                className={`coach-conv-item group relative w-full rounded-lg border mb-px transition-all duration-150 ${
                  activeConvId === conv.id
                    ? 'bg-[#c8f53a]/[0.06] border-[#c8f53a]/15'
                    : 'border-transparent hover:bg-white/[0.02] hover:border-white/[0.04]'
                }`}
              >
                <button onClick={() => openConversation(conv.id)} className="w-full text-left px-2.5 py-2">
                  <div className={`text-[11.5px] mb-1 leading-tight line-clamp-2 pr-4 ${
                    activeConvId === conv.id ? 'text-[#f0ece4] font-medium' : 'text-[#bbb]'
                  }`}>{conv.title}</div>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-mono text-[#444]">
                      {group === 'older'
                        ? conv.updatedAt.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })
                        : conv.updatedAt.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <CategoryBadge category={conv.category} />
                  </div>
                </button>
                <button
                  onClick={() => deleteConversation(conv.id)}
                  title="Usuń rozmowę"
                  className="absolute top-1.5 right-1.5 w-5 h-5 rounded text-[#555] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-[12px]"
                >×</button>
              </div>
            ))}
          </div>
        )
      })}

      {filteredConversations.length === 0 && (
        <div className="text-center py-8 px-3">
          <p className="text-[11px] text-[#555]">
            {searchQuery ? <>Brak rozmów pasujących do &ldquo;{searchQuery}&rdquo;</> : 'Nie masz jeszcze rozmów. Zadaj pierwsze pytanie!'}
          </p>
        </div>
      )}
    </>
  )

  return (
    <div ref={containerRef} className="flex h-full min-h-[calc(100vh-140px)] lg:min-h-0 bg-[#080808] text-[#f0ece4] font-sans overflow-hidden">

      {/* ── SIDEBAR ── */}
      <aside className="hidden md:flex w-[240px] flex-shrink-0 bg-[#0a0a0a] border-r border-[#161616] flex-col py-3.5">
        <div className="px-3 pb-2.5 border-b border-[#141414] flex justify-between items-center mb-1.5">
          <div className="font-display text-[13px] font-black text-[#f0ece4]">Konsultacje</div>
          <button
            onClick={newConversation}
            title="Nowa konsultacja"
            className="w-7 h-7 rounded-lg bg-[#c8f53a] text-[#080808] text-[14px] font-bold flex items-center justify-center hover:scale-110 transition-transform"
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

        <div className="flex-1 overflow-y-auto px-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {conversationList}
        </div>
      </aside>

      {/* ── MOBILE HISTORY OVERLAY ── */}
      {showHistory && (
        <div className="md:hidden fixed inset-0 z-[60] bg-[#080808]/95 backdrop-blur-sm flex flex-col pt-4 pb-24">
          <div className="px-4 pb-3 flex justify-between items-center border-b border-[#141414]">
            <div className="font-display text-[15px] font-black">Konsultacje</div>
            <button onClick={() => setShowHistory(false)} className="text-[#888] text-[20px] w-8 h-8">×</button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pt-2">{conversationList}</div>
        </div>
      )}

      {/* ── MAIN CHAT ── */}
      <main className="flex-1 flex flex-col bg-[#080808] relative min-w-0">
        {/* Scan overlay */}
        <div
          ref={scanFxRef}
          className="absolute inset-0 pointer-events-none z-[5] opacity-0 transition-opacity duration-300
                     [&.active]:opacity-100 bg-gradient-to-b from-transparent via-[#c8f53a]/[0.025] to-transparent
                     [background-size:100%_200%] [&.active]:animate-scan"
        />

        {/* HEADER */}
        <div className="coach-header flex items-center justify-between px-4 md:px-6 py-3 md:py-3.5 border-b border-[#141414] bg-[#0a0a0a]">
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
                Online
              </div>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => setShowHistory(true)} title="Historia rozmów"
              className="md:hidden w-8 h-8 rounded-lg bg-[#111] border border-[#1e1e1e] flex items-center justify-center hover:border-[#333] transition-colors text-[#888] text-[13px]">
              ☰
            </button>
            <button onClick={newConversation} title="Nowa konsultacja"
              className="md:hidden w-8 h-8 rounded-lg bg-[#c8f53a] text-[#080808] font-bold flex items-center justify-center">
              +
            </button>
            <button onClick={exportConversation} title="Eksport rozmowy (Markdown)"
              disabled={messages.length === 0}
              className="w-8 h-8 rounded-lg bg-[#111] border border-[#1e1e1e] flex items-center justify-center hover:border-[#333] transition-colors disabled:opacity-40">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v7M4 6l3 3 3-3" stroke="#888" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 11h10" stroke="#888" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* CONTEXT CHIPS */}
        <div className="coach-ctx-bar px-4 md:px-6 py-2.5 bg-[#0a0a0a] border-b border-[#141414] flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="text-[9px] font-mono text-[#444] uppercase tracking-[1.5px] whitespace-nowrap flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-[#c8f53a] animate-pulse" />
            Kontekst · 30 dni
          </span>
          {contextChips.map(chip => (
            <ContextChipItem key={chip.id} chip={chip} onToggle={() => toggleChip(chip.id)} />
          ))}
        </div>

        {/* MESSAGES */}
        <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {messages.map(msg => (
            <div key={msg.id} className={`coach-msg flex gap-2.5 mb-[18px] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-[30px] h-[30px] rounded-lg flex-shrink-0 flex items-center justify-center text-[11px] font-mono font-bold ${
                msg.role === 'assistant'
                  ? 'bg-[#c8f53a]/10 border border-[#c8f53a]/25 text-[#c8f53a]'
                  : 'bg-gradient-to-br from-[#c8f53a] to-[#7ef5b0] text-[#080808]'
              }`}>
                {msg.role === 'assistant' ? 'AI' : userInitials}
              </div>
              <div className="max-w-[85%] md:max-w-[75%] min-w-0">
                <div className={`text-[9px] font-mono text-[#444] uppercase tracking-wider mb-1.5 flex items-center gap-1.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <span>{msg.role === 'assistant' ? 'Asystent AI' : 'Ty'}</span>
                  <span>·</span>
                  <span>{msg.timestamp.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className={`rounded-2xl px-3.5 py-3 text-[13px] leading-[1.65] break-words ${
                  msg.isError
                    ? 'bg-red-500/[0.06] border border-red-500/20 text-red-300 rounded-tl-2xl rounded-bl-[4px]'
                    : msg.role === 'user'
                    ? 'bg-[#c8f53a]/[0.06] border border-[#c8f53a]/15 text-[#f0ece4] rounded-tr-2xl rounded-br-[4px] rounded-bl-2xl rounded-tl-2xl'
                    : 'bg-[#111] border border-[#1a1a1a] text-[#d0ccc4] rounded-tl-2xl rounded-bl-[4px] rounded-tr-2xl rounded-br-2xl'
                }`}>
                  <FormattedText text={msg.content} />
                </div>
              </div>
            </div>
          ))}

          {isAnalyzing && (
            <div className="coach-msg flex gap-2.5 mb-[18px]">
              <div className="w-[30px] h-[30px] rounded-lg flex-shrink-0 flex items-center justify-center text-[11px] font-mono font-bold bg-[#c8f53a]/10 border border-[#c8f53a]/25 text-[#c8f53a]">AI</div>
              <div className="max-w-[85%] md:max-w-[75%]">
                <div className="text-[9px] font-mono uppercase tracking-wider mb-1.5 text-[#c8f53a]">
                  Asystent AI · analizuje dane treningowe…
                </div>
                <div className="bg-[#111] border border-[#1a1a1a] rounded-tl-2xl rounded-bl-[4px] rounded-tr-2xl rounded-br-2xl">
                  <AnalyzingIndicator text={analyzingText} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SUGGESTIONS */}
        {messages.length <= 1 && !isAnalyzing && (
          <div className="px-4 md:px-6 pb-2.5 pt-1">
            <div className="text-[9px] font-mono text-[#444] uppercase tracking-[1.5px] mb-2">Zasugeruj:</div>
            <div className="flex gap-1.5 flex-wrap">
              {SUGGESTED_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => handleSend(prompt)}
                  className="coach-sugg-chip px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[11px] text-[#888] hover:bg-[#c8f53a]/[0.06] hover:border-[#c8f53a]/20 hover:text-[#c8f53a] hover:-translate-y-px transition-all whitespace-nowrap"
                >{prompt}</button>
              ))}
            </div>
          </div>
        )}

        {/* INPUT */}
        <div className="coach-input-bar px-4 md:px-6 pt-3 pb-4 border-t border-[#141414] bg-[#0a0a0a]">
          <div className="bg-[#111] border border-[#1e1e1e] focus-within:border-[#c8f53a]/30 rounded-2xl p-2.5 flex items-end gap-2 transition-colors">
            <textarea
              ref={inputRef}
              rows={1}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isAnalyzing}
              maxLength={4000}
              placeholder="Zapytaj o swoje treningi, plany, regenerację..."
              className="flex-1 bg-transparent border-none text-[#f0ece4] text-[13px] resize-none min-h-[22px] max-h-[80px] outline-none py-1 px-1 leading-[1.5] placeholder:text-[#444] disabled:opacity-50"
            />
            <button
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || isAnalyzing}
              className="w-[34px] h-[34px] rounded-[10px] bg-[#c8f53a] hover:bg-[#d8ff4a] disabled:opacity-30 disabled:cursor-not-allowed enabled:hover:scale-105 active:scale-95 flex items-center justify-center transition-all"
              aria-label="Wyślij wiadomość"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M13 1.5L6.5 8M13 1.5l-4.5 11-2-4.5-4.5-2 11-4.5z" stroke="#080808" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          <div className="flex justify-between mt-1.5 px-1">
            <span className="text-[9px] font-mono text-[#333]">Enter aby wysłać · Shift + Enter nowa linia</span>
            <span className="hidden sm:inline text-[9px] font-mono text-[#333]">Kliknij chip, by włączyć/wyłączyć kontekst</span>
          </div>
        </div>
      </main>
    </div>
  )
}
