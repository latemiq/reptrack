'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useEffect, useRef, useState } from 'react'
import { useUser } from '@clerk/nextjs'

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

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  insights?: InsightCell[]
  timestamp: Date
  isStreaming?: boolean
}

interface ContextChip {
  id: string
  icon?: string
  label: string
  variant: 'lime' | 'orange'
  active: boolean
}

// ─── MOCK DATA ────────────────────────────────────────────────────────────────

const MOCK_CONVERSATIONS: Conversation[] = [
  { id: '1', title: 'Plateau na martwym ciągu',       category: 'gym',      updatedAt: new Date(),                        group: 'today'     },
  { id: '2', title: 'Plan tygodnia po cardio',         category: 'running',  updatedAt: new Date(),                        group: 'today'     },
  { id: '3', title: 'Czemu wolniej biegnę rano?',      category: 'running',  updatedAt: new Date(Date.now() - 86400000),   group: 'yesterday' },
  { id: '4', title: 'Deficyt vs. utrzymanie siły',     category: 'diet',     updatedAt: new Date(Date.now() - 86400000),   group: 'yesterday' },
  { id: '5', title: 'Przygotowanie do półmaratonu',    category: 'running',  updatedAt: new Date(Date.now() - 4 * 86400000), group: 'older'   },
  { id: '6', title: 'Push/Pull/Legs split – review',   category: 'gym',      updatedAt: new Date(Date.now() - 6 * 86400000), group: 'older'   },
  { id: '7', title: 'Regeneracja po PR',               category: 'recovery', updatedAt: new Date(Date.now() - 8 * 86400000), group: 'older'   },
]

const CATEGORY_CONFIG: Record<Category, { label: string; orange?: boolean }> = {
  gym:      { label: 'Siłownia' },
  running:  { label: 'Bieganie', orange: true },
  diet:     { label: 'Dieta' },
  recovery: { label: 'Recovery' },
}

const SUGGESTED_PROMPTS = [
  'Pokaż plan deload',
  'Dlaczego nie bench?',
  'Jak długo plateau?',
  'Co jeść w deload?',
]

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function CategoryTag({ category }: { category: Category }) {
  const cfg = CATEGORY_CONFIG[category]
  return (
    <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${
      cfg.orange ? 'bg-[#f5a03a]/10 text-[#f5a03a]' : 'bg-[#c8f53a]/10 text-[#c8f53a]'
    }`}>
      {cfg.label}
    </span>
  )
}

function InsightCard({ cells }: { cells: InsightCell[] }) {
  return (
    <div className="mt-2.5 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-3 grid grid-cols-2 gap-2">
      {cells.map((c, i) => (
        <div key={i} className="p-1.5">
          <div className="text-[8px] font-mono text-[#444] uppercase tracking-[1.5px] mb-1">{c.label}</div>
          <div className={`font-display text-[18px] font-black leading-none ${
            c.color === 'orange' ? 'text-[#f5a03a]'
            : c.color === 'white'  ? 'text-[#f0ece4]'
            : 'text-[#c8f53a]'
          }`}>
            {c.value}{c.unit && <span className="text-[11px] text-[#666]"> {c.unit}</span>}
          </div>
          {c.sub && <div className="text-[9px] font-mono text-[#666] mt-0.5">{c.sub}</div>}
        </div>
      ))}
    </div>
  )
}

function TypingDots() {
  return (
    <div className="flex gap-1 p-3.5">
      {[0, 1, 2].map(i => (
        <div key={i}
          className="w-1.5 h-1.5 rounded-full bg-[#c8f53a] opacity-40 animate-typing"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
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

  const [activeConvId, setActiveConvId] = useState('1')
  const [conversations] = useState<Conversation[]>(MOCK_CONVERSATIONS)
  const [contextChips, setContextChips] = useState<ContextChip[]>([
    { id: 'period', label: 'Ostatnie 4 tygodnie', variant: 'lime',   active: true },
    { id: 'runs',   icon: '🏃', label: '12 biegów',     variant: 'orange', active: true },
    { id: 'gym',    icon: '🏋️', label: '16 treningów',  variant: 'lime',   active: true },
    { id: 'health', icon: '⚖️', label: 'Waga, sen',     variant: 'orange', active: true },
  ])

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm1', role: 'assistant',
      content: 'Cześć! Przeanalizowałem Twoje dane z ostatnich 4 tygodni. Widzę dwa ciekawe wzorce: **plateau na martwym ciągu od 3 tygodni** oraz *znaczącą poprawę tempa biegowego*. O czym chcesz porozmawiać?',
      timestamp: new Date(),
    },
    {
      id: 'm2', role: 'user',
      content: 'Pogadajmy o martwym ciągu. Stoję na 140kg już trzeci tydzień, frustrujące to.',
      timestamp: new Date(),
    },
    {
      id: 'm3', role: 'assistant',
      content: 'Widzę co się dzieje. Twoje **RPE rośnie** przy tym samym ciężarze (8 → 9 → 9.5), a objętość spada. To klasyczna *akumulacja zmęczenia*, nie brak siły.',
      insights: [
        { label: 'Aktualne 1RM',  value: '158',    unit: 'kg',  sub: 'szac. z RPE',    color: 'white'  },
        { label: 'Plateau',       value: '21',     unit: 'dni', sub: '3 sesje 140kg',  color: 'orange' },
        { label: 'Tonaż / tydz.', value: '↓ 12%',              sub: 'vs. tydzień 1'                   },
        { label: 'Sugestia',      value: 'Deload',              sub: '7 dni · -30%'                    },
      ],
      timestamp: new Date(),
    },
  ])

  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const userInitials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'U'
    : 'U'

  // ── Entry animations ───────────────────────────────────────────────────────
  useGSAP(() => {
    const tl = gsap.timeline({ delay: 0.05 })

    tl.from('.coach-conv-item', {
      opacity: 0, x: -12, duration: 0.4, stagger: 0.05, ease: 'expo.out',
    })
    tl.from('.coach-ctx-chip', {
      opacity: 0, y: -8, duration: 0.4, stagger: 0.07, ease: 'expo.out',
    }, '-=0.3')
    tl.from('.coach-msg', {
      opacity: 0, y: 14, duration: 0.5, stagger: 0.15, ease: 'expo.out',
    }, '-=0.3')
    tl.from('.coach-sugg-chip', {
      opacity: 0, y: 8, duration: 0.35, stagger: 0.05, ease: 'expo.out',
    }, '-=0.4')
  }, { scope: containerRef })

  // ── Auto-scroll on new message ─────────────────────────────────────────────
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [messages, isLoading])

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = inputValue.trim()
    if (!text || isLoading) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInputValue('')
    setIsLoading(true)

    if (scanFxRef.current) {
      scanFxRef.current.classList.add('active')
      setTimeout(() => scanFxRef.current?.classList.remove('active'), 2400)
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

      if (!res.ok || !res.body) throw new Error('Stream failed')

      const aiMsgId = crypto.randomUUID()
      setMessages(prev => [...prev, {
        id: aiMsgId, role: 'assistant', content: '', timestamp: new Date(), isStreaming: true,
      }])

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'text') {
              setMessages(prev => prev.map(m =>
                m.id === aiMsgId ? { ...m, content: m.content + data.delta } : m
              ))
            }
            if (data.type === 'done') {
              setMessages(prev => prev.map(m =>
                m.id === aiMsgId ? { ...m, isStreaming: false } : m
              ))
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } catch (e) {
      console.error('Coach API error:', e)
    } finally {
      setIsLoading(false)
    }
  }

  // ── Ctrl+Enter sends ───────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Auto-resize textarea ───────────────────────────────────────────────────
  useEffect(() => {
    const ta = inputRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 80) + 'px'
  }, [inputValue])

  // ── Remove context chip ────────────────────────────────────────────────────
  const removeChip = (id: string) => {
    setContextChips(prev => prev.map(c => c.id === id ? { ...c, active: false } : c))
  }

  // ── Group conversations ────────────────────────────────────────────────────
  const grouped = {
    today:     conversations.filter(c => c.group === 'today'),
    yesterday: conversations.filter(c => c.group === 'yesterday'),
    older:     conversations.filter(c => c.group === 'older'),
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="flex h-screen bg-[#080808] text-[#f0ece4] font-sans overflow-hidden">

      {/* ── SIDEBAR ── */}
      <aside className="w-[240px] flex-shrink-0 bg-[#0c0c0c] border-r border-[#1a1a1a] flex flex-col py-4">
        <div className="px-3.5 pb-3 border-b border-[#141414] flex justify-between items-center">
          <button className="flex items-center gap-1.5 text-[11px] font-mono text-[#666] uppercase tracking-[1.5px] hover:text-[#c8f53a] transition-colors cursor-none"
            onClick={() => window.history.back()}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M7 2L3 5.5l4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Wróć
          </button>
          <button
            onClick={() => {/* TODO: createConversation() */}}
            title="Nowa konsultacja"
            className="w-7 h-7 rounded-lg bg-[#c8f53a] flex items-center justify-center cursor-none hover:scale-110 hover:rotate-90 transition-transform duration-200"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="#080808" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(['today', 'yesterday', 'older'] as const).map(group => {
            const convs = grouped[group]
            if (convs.length === 0) return null
            const labels = { today: 'Dziś', yesterday: 'Wczoraj', older: 'Wcześniej' }
            return (
              <div key={group}>
                <p className="px-3.5 pt-3.5 pb-1.5 text-[9px] font-mono text-[#2a2a2a] uppercase tracking-[2.5px]">
                  {labels[group]}
                </p>
                {convs.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                    className={`coach-conv-item w-full text-left p-2.5 rounded-lg border transition-all duration-150 cursor-none ${
                      activeConvId === conv.id
                        ? 'bg-[#c8f53a]/[0.06] border-[#c8f53a]/15'
                        : 'border-transparent hover:bg-white/[0.02] hover:border-white/[0.04]'
                    }`}
                  >
                    <div className={`text-[12px] font-medium mb-0.5 truncate ${
                      activeConvId === conv.id ? 'text-[#f0ece4]' : 'text-[#bbb]'
                    }`}>{conv.title}</div>
                    <div className="text-[9px] font-mono text-[#444] flex justify-between items-center">
                      <span>{conv.updatedAt.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</span>
                      <CategoryTag category={conv.category} />
                    </div>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </aside>

      {/* ── MAIN CHAT ── */}
      <main className="flex-1 flex flex-col bg-[#080808] relative">
        {/* Scan overlay */}
        <div ref={scanFxRef}
          className="absolute inset-0 pointer-events-none z-[5] opacity-0 transition-opacity duration-300
                     [&.active]:opacity-100 bg-gradient-to-b from-transparent via-[#c8f53a]/[0.02] to-transparent
                     [background-size:100%_200%] [&.active]:animate-scanBg"
        />

        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#141414] bg-[#0a0a0a]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#c8f53a]/15 to-[#c8f53a]/5 border border-[#c8f53a]/25 flex items-center justify-center relative">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 2L11 6L15 6.5L12 9.5L13 14L9 12L5 14L6 9.5L3 6.5L7 6L9 2Z" fill="none" stroke="#c8f53a" strokeWidth="1.3" strokeLinejoin="round"/>
              </svg>
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#c8f53a] border-2 border-[#0a0a0a] animate-pulse" />
            </div>
            <div>
              <div className="font-display text-[15px] font-black text-[#f0ece4]">
                Coach <em className="not-italic text-[#c8f53a]">AI</em>
              </div>
              <div className="text-[10px] font-mono text-[#c8f53a] uppercase tracking-[1.5px] flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-[#c8f53a] animate-pulse" />
                Online · Claude Opus
              </div>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button title="Historia" className="w-8 h-8 rounded-lg bg-[#111] border border-[#1e1e1e] flex items-center justify-center hover:border-[#333] transition-colors cursor-none">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5" stroke="#888" strokeWidth="1.3"/>
                <path d="M7 4v3l2 1.5" stroke="#888" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>
            <button title="Ustawienia konsultacji" className="w-8 h-8 rounded-lg bg-[#111] border border-[#1e1e1e] flex items-center justify-center hover:border-[#333] transition-colors cursor-none">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="2" stroke="#888" strokeWidth="1.3"/>
                <path d="M7 1v2M7 11v2M1 7h2M11 7h2" stroke="#888" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* CONTEXT CHIPS */}
        <div className="px-6 py-2.5 bg-[#0a0a0a] border-b border-[#141414] flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="text-[9px] font-mono text-[#444] uppercase tracking-[1.5px] whitespace-nowrap">Kontekst:</span>
          {contextChips.filter(c => c.active).map(chip => (
            <div key={chip.id}
              className={`coach-ctx-chip flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-mono whitespace-nowrap cursor-none transition-all ${
                chip.variant === 'orange'
                  ? 'bg-[#f5a03a]/[0.06] border-[#f5a03a]/15 text-[#f5a03a] hover:bg-[#f5a03a]/10'
                  : 'bg-[#c8f53a]/[0.06] border-[#c8f53a]/15 text-[#c8f53a] hover:bg-[#c8f53a]/10'
              }`}
            >
              {chip.icon && <span style={{ fontSize: 10 }}>{chip.icon}</span>}
              {!chip.icon && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              )}
              {chip.label}
              <button onClick={() => removeChip(chip.id)} className="text-[#444] hover:text-[#f0ece4] cursor-none ml-0.5">×</button>
            </div>
          ))}
        </div>

        {/* MESSAGES */}
        <div ref={messagesRef} className="flex-1 overflow-y-auto px-6 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {messages.map(msg => (
            <div key={msg.id} className={`coach-msg flex gap-2.5 mb-4.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-[30px] h-[30px] rounded-lg flex-shrink-0 flex items-center justify-center text-[11px] font-mono font-bold ${
                msg.role === 'assistant'
                  ? 'bg-[#c8f53a]/10 border border-[#c8f53a]/20 text-[#c8f53a]'
                  : 'bg-gradient-to-br from-[#c8f53a] to-[#7ef5b0] text-[#080808]'
              }`}>
                {msg.role === 'assistant' ? 'AI' : userInitials}
              </div>
              <div className="max-w-[75%]">
                <div className={`text-[9px] font-mono text-[#444] uppercase tracking-wider mb-1 flex items-center gap-1.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <span>{msg.role === 'assistant' ? 'Coach AI' : 'Ty'}</span>
                  <span>·</span>
                  <span>{msg.timestamp.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className={`rounded-2xl px-3.5 py-3 text-[13px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#c8f53a]/[0.06] border border-[#c8f53a]/15 text-[#f0ece4] rounded-br-[4px]'
                    : 'bg-[#111] border border-[#1a1a1a] text-[#d0ccc4] rounded-bl-[4px]'
                }`}>
                  <FormattedText text={msg.content} />
                  {msg.insights && <InsightCard cells={msg.insights} />}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="coach-msg flex gap-2.5 mb-4.5">
              <div className="w-[30px] h-[30px] rounded-lg flex-shrink-0 flex items-center justify-center text-[11px] font-mono font-bold bg-[#c8f53a]/10 border border-[#c8f53a]/20 text-[#c8f53a]">AI</div>
              <div className="max-w-[75%]">
                <div className="text-[9px] font-mono text-[#444] uppercase tracking-wider mb-1">Coach AI · pisze...</div>
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl rounded-bl-[4px] p-0">
                  <TypingDots />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SUGGESTIONS */}
        <div className="px-6 pb-3">
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
        <div className="px-6 pt-3.5 pb-4 border-t border-[#141414] bg-[#0a0a0a]">
          <div className="bg-[#111] border border-[#1e1e1e] focus-within:border-[#c8f53a]/30 rounded-2xl p-2.5 flex items-end gap-2 transition-colors">
            <div className="flex gap-1 pb-1">
              <button title="Załącz screenshot" className="w-7 h-7 rounded-md flex items-center justify-center text-[#666] hover:bg-white/[0.04] hover:text-[#c8f53a] transition-all cursor-none">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M9.5 7v3a2.5 2.5 0 01-5 0V4.5a1.5 1.5 0 013 0V9a0.5 0.5 0 01-1 0V5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
              </button>
              <button title="Dodaj kontekst" className="w-7 h-7 rounded-md flex items-center justify-center text-[#666] hover:bg-white/[0.04] hover:text-[#c8f53a] transition-all cursor-none">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <textarea
              ref={inputRef}
              rows={1}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Zapytaj o swoje treningi..."
              className="flex-1 bg-transparent border-none text-[#f0ece4] text-[13px] resize-none min-h-[24px] max-h-[80px] outline-none py-1 leading-relaxed placeholder:text-[#444]"
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className="w-[34px] h-[34px] rounded-[9px] bg-[#c8f53a] hover:bg-[#d8ff4a] disabled:opacity-30 disabled:cursor-not-allowed enabled:hover:scale-105 active:scale-95 flex items-center justify-center cursor-none transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M14 2L7 9M14 2l-5 12-2-5-5-2 12-5z" stroke="#080808" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          <div className="flex justify-between mt-1.5 px-1">
            <span className="text-[9px] font-mono text-[#333]">Ctrl + Enter aby wysłać</span>
            <span className="text-[9px] font-mono text-[#333]">Coach widzi twoje dane treningowe</span>
          </div>
        </div>
      </main>
    </div>
  )
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

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
        return <span key={i}>{part}</span>
      })}
    </>
  )
}
