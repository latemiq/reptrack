'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AddGoalModal from './AddGoalModal'

type GoalTone = 'strength' | 'running' | 'body' | 'habit'
type GoalStatus = 'onTrack' | 'ahead' | 'behind' | 'open'

interface Goal {
  id: string
  name: string
  category: string | null
  unit: string | null
  target_value: number | string
  start_value: number | string
  current_value: number | string | null
  target_date: string | null
  status: string
  created_at: string
  completed_at: string | null
  progress: number
}

const FEATURE_CIRC = 2 * Math.PI * 90

const CATEGORY_LABEL: Record<GoalTone, string> = {
  strength: '🏋️ Siła',
  running:  '🏃 Bieganie',
  body:     '⚖️ Sylwetka',
  habit:    '🎯 Nawyk',
}

const goalTone: Record<GoalTone, { tag: string; fill: string; filter: string }> = {
  strength: { tag: 'text-[#f5a03a] bg-[#f5a03a]/10', fill: 'bg-[#f5a03a]', filter: 'border-[#f5a03a]/20 text-[#f5a03a]' },
  running:  { tag: 'text-[#c8f53a] bg-[#c8f53a]/10', fill: 'bg-[#c8f53a]', filter: 'border-[#c8f53a]/20 text-[#c8f53a]' },
  body:     { tag: 'text-[#3cc8ff] bg-[#3cc8ff]/10', fill: 'bg-[#3cc8ff]', filter: 'border-[#3cc8ff]/20 text-[#3cc8ff]' },
  habit:    { tag: 'text-[#c88cff] bg-[#c88cff]/10', fill: 'bg-[#c88cff]', filter: 'border-[#c88cff]/20 text-[#c88cff]' },
}

const statusCfg: Record<GoalStatus, { label: string; text: string; dot: string }> = {
  onTrack: { label: 'Na drodze',    text: 'text-[#c8f53a]', dot: 'bg-[#c8f53a]' },
  ahead:   { label: 'Przed planem', text: 'text-[#3cc8ff]', dot: 'bg-[#3cc8ff]' },
  behind:  { label: 'Opóźnienie',   text: 'text-[#f5a03a]', dot: 'bg-[#f5a03a]' },
  open:    { label: 'Bez terminu',  text: 'text-[#888]',    dot: 'bg-[#555]' },
}

const toneOf = (g: Goal): GoalTone =>
  (['strength', 'running', 'body', 'habit'] as const).find(t => t === g.category) ?? 'habit'

/** Compares progress with the share of time already elapsed until the deadline. */
function statusOf(g: Goal): GoalStatus {
  if (!g.target_date) return 'open'
  const start = new Date(g.created_at).getTime()
  const end = new Date(g.target_date).getTime()
  if (end <= start) return g.progress >= 100 ? 'onTrack' : 'behind'
  const elapsed = Math.min(1, Math.max(0, (Date.now() - start) / (end - start))) * 100
  if (g.progress >= elapsed + 15) return 'ahead'
  if (g.progress >= elapsed - 10) return 'onTrack'
  return 'behind'
}

const fmtNum = (v: number | string | null) => (v == null ? '—' : String(Math.round(Number(v) * 10) / 10))

function deadlineMeta(g: Goal) {
  if (!g.target_date) return 'bez terminu'
  const days = Math.ceil((new Date(g.target_date).getTime() - Date.now()) / 86400000)
  const date = new Date(g.target_date).toLocaleDateString('pl-PL')
  if (days < 0) return `${date} · po terminie`
  if (days < 14) return `${date} · ${days} dni`
  return `${date} · ${Math.round(days / 7)} tyg.`
}

function GoalCard({ goal, onUpdated, onError }: { goal: Goal; onUpdated: () => void; onError: (msg: string) => void }) {
  const tone = goalTone[toneOf(goal)]
  const status = statusCfg[statusOf(goal)]
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(fmtNum(goal.current_value ?? goal.start_value))
  const [busy, setBusy] = useState(false)

  const patch = async (body: object) => {
    setBusy(true)
    const res = await fetch(`/api/goals/${goal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null)
    setBusy(false)
    if (res?.ok) { setEditing(false); onUpdated() } else onError('Nie udało się zaktualizować celu')
  }

  const remove = async () => {
    if (!confirm(`Usunąć cel „${goal.name}”?`)) return
    const res = await fetch(`/api/goals/${goal.id}`, { method: 'DELETE' }).catch(() => null)
    if (res?.ok) onUpdated(); else onError('Nie udało się usunąć celu')
  }

  return (
    <article className="goals-reveal rounded-[14px] border border-[#1a1a1a] bg-[#0f0f0f] p-4 transition-colors hover:border-[#2a2a2a]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className={`rounded px-2 py-0.5 text-[8px] font-mono uppercase tracking-[1.2px] ${tone.tag}`}>{CATEGORY_LABEL[toneOf(goal)]}</span>
        <span className={`inline-flex items-center gap-1 text-[8px] font-mono uppercase tracking-[1.2px] ${status.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
      </div>
      <h3 className="mb-2.5 text-[13px] font-medium leading-snug text-[#f0ece4]">{goal.name}</h3>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <input type="number" step="any" autoFocus value={value} onChange={e => setValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') patch({ current_value: Number(value) }); if (e.key === 'Escape') setEditing(false) }}
              className="w-20 bg-[#0a0a0a] border border-[#2a2a2a] rounded-md px-2 py-1 text-[13px] text-[#f0ece4] focus:outline-none focus:border-[#c88cff]/40" />
            <button disabled={busy} onClick={() => patch({ current_value: Number(value) })} className="text-[10px] font-mono text-[#c88cff] hover:underline">OK</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} title="Zaktualizuj postęp" className="font-display text-[18px] font-black hover:text-[#c88cff] transition-colors">
            {fmtNum(goal.current_value ?? goal.start_value)}
            {goal.unit && <span className="ml-1 text-[11px] font-mono text-[#666]">{goal.unit}</span>}
          </button>
        )}
        <div className="text-[10px] font-mono text-[#444]">
          cel: <strong className="font-medium text-[#888]">{fmtNum(goal.target_value)} {goal.unit ?? ''}</strong>
        </div>
      </div>
      <div className="mb-2 h-[5px] overflow-hidden rounded-full bg-[#141414]">
        <div className={`h-full w-0 rounded-full ${tone.fill}`} data-progress-target={goal.progress} />
      </div>
      <div className="flex justify-between gap-3 text-[9px] font-mono text-[#444]">
        <span>{deadlineMeta(goal)}</span>
        <span className="font-medium text-[#888]">{goal.progress}%</span>
      </div>
      <div className="mt-3 pt-2.5 border-t border-[#161616] flex justify-between text-[9px] font-mono uppercase tracking-[1px]">
        <button onClick={() => setEditing(true)} className="text-[#555] hover:text-[#c88cff]">Aktualizuj</button>
        <div className="flex gap-3">
          <button disabled={busy} onClick={() => patch({ status: 'completed' })} className="text-[#555] hover:text-[#c8f53a]">✓ Ukończ</button>
          <button onClick={remove} className="text-[#555] hover:text-red-400">Usuń</button>
        </div>
      </div>
    </article>
  )
}

export default function GoalsView() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [showAddGoal, setShowAddGoal] = useState(false)
  const [goals, setGoals] = useState<Goal[] | null>(null)
  const [filter, setFilter] = useState<GoalTone | 'all'>('all')
  const [error, setError] = useState('')

  const load = useCallback(() => {
    fetch('/api/goals')
      .then(async r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => { setGoals(d.goals); setError('') })
      .catch(() => { setGoals(g => g ?? []); setError('Nie udało się wczytać celów. Sprawdź połączenie z bazą.') })
  }, [])

  useEffect(() => { load() }, [load])

  const active = useMemo(() => (goals ?? []).filter(g => g.status === 'active'), [goals])
  const completed = useMemo(() => (goals ?? [])
    .filter(g => g.status === 'completed')
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')), [goals])
  const visible = filter === 'all' ? active : active.filter(g => toneOf(g) === filter)

  const featured = useMemo(() => {
    const dated = active.filter(g => g.target_date).sort((a, b) => a.target_date!.localeCompare(b.target_date!))
    return dated[0] ?? [...active].sort((a, b) => b.progress - a.progress)[0] ?? null
  }, [active])

  const yearStart = `${new Date().getFullYear()}-01-01`
  const kpis = [
    { label: 'Aktywne',          value: active.length, sub: 'w trakcie realizacji', cls: 'text-[#c88cff]', card: 'border-[#c88cff]/20 bg-[#c88cff]/[0.04]' },
    { label: 'Na dobrej drodze', value: active.filter(g => ['onTrack', 'ahead'].includes(statusOf(g))).length, sub: `z ${active.length} aktywnych`, cls: 'text-[#c8f53a]', card: 'border-[#1a1a1a] bg-[#0f0f0f]' },
    { label: 'Wymaga uwagi',     value: active.filter(g => statusOf(g) === 'behind').length, sub: 'opóźnienie względem terminu', cls: 'text-[#f5a03a]', card: 'border-[#1a1a1a] bg-[#0f0f0f]' },
    { label: 'Ukończone',        value: completed.filter(g => (g.completed_at ?? '') >= yearStart).length, sub: `w ${new Date().getFullYear()}`, cls: 'text-[#f0ece4]', card: 'border-[#1a1a1a] bg-[#0f0f0f]' },
  ]

  useGSAP(() => {
    const root = rootRef.current
    if (!root || goals === null) return

    gsap.from(root.querySelectorAll('.goals-reveal'), { opacity: 0, y: 14, duration: 0.45, stagger: 0.05, ease: 'expo.out' })

    root.querySelectorAll<HTMLElement>('[data-progress-target]').forEach((bar, index) => {
      gsap.to(bar, { width: `${bar.dataset.progressTarget}%`, duration: 1.15, delay: 0.2 + index * 0.05, ease: 'expo.out' })
    })

    const circle = root.querySelector<SVGCircleElement>('[data-feature-circle]')
    if (circle && featured) {
      gsap.to(circle, { strokeDashoffset: FEATURE_CIRC * (1 - featured.progress / 100), duration: 1.45, ease: 'expo.out' })
    }
  }, { scope: rootRef, dependencies: [goals, filter] })

  return (
    <div ref={rootRef} className="min-h-full bg-[#080808] text-[#f0ece4]">
      <div className="flex items-end justify-between px-4 md:px-7 pt-6 pb-2">
        <div>
          <p className="text-[10px] font-mono text-[#444] uppercase tracking-[2px] mb-1">Cele · {new Date().getFullYear()}</p>
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

      <div className="px-4 md:px-7 pb-7 pt-3">
        {error && <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] text-red-400">{error}</div>}

        {goals === null ? (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5">
            {[0, 1, 2, 3].map(i => <div key={i} className="h-[96px] rounded-[14px] bg-[#0f0f0f] border border-[#1a1a1a] animate-pulse" />)}
          </div>
        ) : (
          <>
            <section className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 mb-3.5">
              {kpis.map(kpi => (
                <div key={kpi.label} className={`goals-reveal rounded-[14px] border p-4 ${kpi.card}`}>
                  <div className="mb-2 text-[9px] font-mono uppercase tracking-[1.3px] text-[#444]">{kpi.label}</div>
                  <div className={`font-display text-[32px] font-black leading-none ${kpi.cls}`}>{kpi.value}</div>
                  <div className="mt-1 text-[9px] font-mono text-[#444]">{kpi.sub}</div>
                </div>
              ))}
            </section>

            {featured && (
              <section className="goals-reveal relative overflow-hidden rounded-[18px] border border-[#c88cff]/20 bg-[#0f0f0f] p-6 mb-3.5">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c88cff]/40 to-transparent" />
                <div className="grid items-center gap-7 md:grid-cols-[200px_minmax(0,1fr)]">
                  <div className="relative mx-auto h-[180px] w-[180px]">
                    <svg className="h-full w-full -rotate-90 drop-shadow-[0_0_12px_rgba(200,140,255,0.35)]" viewBox="0 0 200 200">
                      <circle cx="100" cy="100" r="90" fill="none" stroke="#1a1a1a" strokeWidth="10" />
                      <circle cx="100" cy="100" r="90" fill="none" stroke="#c88cff" strokeWidth="10" strokeLinecap="round"
                        strokeDasharray={FEATURE_CIRC} strokeDashoffset={FEATURE_CIRC} data-feature-circle />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="font-display text-[44px] font-black leading-none text-[#c88cff]">{featured.progress}%</div>
                      <div className="mt-1 text-[9px] font-mono uppercase tracking-[1.5px] text-[#666]">progres</div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3.5">
                    <div>
                      <div className="mb-2 inline-flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-[2.5px] text-[#c88cff]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#c88cff] animate-pulse" />
                        {featured.target_date ? 'Najbliższy termin' : 'Najbliżej celu'}
                      </div>
                      <h2 className="font-display text-[26px] font-black leading-[1.05]">{featured.name}</h2>
                    </div>
                    <div>
                      <div className="mb-1 text-[9px] font-mono uppercase tracking-[1.5px] text-[#444]">Obecnie → cel</div>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-display text-[22px] font-black">{fmtNum(featured.current_value ?? featured.start_value)} {featured.unit}</span>
                        <span className="text-sm text-[#444]">→</span>
                        <span className="font-display text-[22px] font-black text-[#c88cff]">{fmtNum(featured.target_value)} {featured.unit}</span>
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-[9px] font-mono uppercase tracking-[1.5px] text-[#444]">Termin</div>
                      <div className="font-display text-[18px] font-black">{deadlineMeta(featured)}</div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section className="goals-reveal mb-2.5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-[15px] font-black">Aktywne cele</h2>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setFilter('all')}
                  className={`rounded-lg border px-3 py-1.5 text-[10px] font-mono uppercase tracking-[1px] ${filter === 'all' ? 'border-[#c88cff]/25 bg-[#c88cff]/10 text-[#c88cff]' : 'border-[#1e1e1e] text-[#666]'}`}>Wszystkie</button>
                {(['strength', 'running', 'body', 'habit'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setFilter(t)}
                    className={`rounded-lg border px-3 py-1.5 text-[10px] font-mono uppercase tracking-[1px] ${filter === t ? `${goalTone[t].filter} bg-white/[0.04]` : 'border-[#1e1e1e] text-[#666]'}`}>
                    {CATEGORY_LABEL[t].split(' ')[1]}
                  </button>
                ))}
              </div>
            </section>

            {visible.length === 0 ? (
              <div className="goals-reveal rounded-[14px] border border-dashed border-[#222] p-8 text-center text-[12px] text-[#555] mb-3.5">
                {active.length === 0 ? 'Nie masz aktywnych celów.' : 'Brak celów w tej kategorii.'}{' '}
                <button onClick={() => setShowAddGoal(true)} className="text-[#c88cff] hover:underline">Dodaj cel</button>
              </div>
            ) : (
              <section className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3 mb-3.5">
                {visible.map(goal => <GoalCard key={`${goal.id}-${goal.current_value}`} goal={goal} onUpdated={load} onError={setError} />)}
              </section>
            )}

            <p className="text-[10px] font-mono text-[#444] mb-3.5">
              Cele wagowe (kg) aktualizują się same po dodaniu pomiaru, a biegowe (km) po zapisaniu biegu. Pozostałe aktualizujesz, klikając wartość.
            </p>

            {completed.length > 0 && (
              <section className="goals-reveal rounded-2xl border border-[#1a1a1a] bg-[#0f0f0f] p-[18px]">
                <h2 className="font-display text-[14px] font-black mb-3.5">Ukończone</h2>
                <div className="flex flex-col gap-2">
                  {completed.slice(0, 10).map((goal, index) => (
                    <div key={goal.id} className={`flex items-center gap-2.5 py-1.5 ${index < Math.min(completed.length, 10) - 1 ? 'border-b border-[#131313]' : ''}`}>
                      <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border border-[#c88cff]/20 bg-[#c88cff]/10 text-[13px]">
                        {CATEGORY_LABEL[toneOf(goal)].split(' ')[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11.5px] font-medium text-[#bbb]">{goal.name} — {fmtNum(goal.target_value)} {goal.unit ?? ''}</div>
                        <div className="text-[9px] font-mono text-[#444]">{goal.completed_at ? new Date(goal.completed_at).toLocaleDateString('pl-PL') : ''}</div>
                      </div>
                      <div className="font-display text-[13px] font-black text-[#c88cff]">✓</div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
      {showAddGoal && (
        <AddGoalModal
          onClose={() => setShowAddGoal(false)}
          onSaved={() => { setShowAddGoal(false); load() }}
        />
      )}
    </div>
  )
}
