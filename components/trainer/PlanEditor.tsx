'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import SessionEditor from '@/components/trainer/SessionEditor'
import {
  DAY_LABELS, FOCUS_OPTIONS, cloneMesocycle, cloneSession, cloneWeek, emptyMesocycle, emptyWeek, focusMeta,
  formatPrescription, newId, nextMonday, weekStart,
  type Focus, type Macrocycle, type Mesocycle, type PlannedSession,
} from '@/lib/plans'

interface Props {
  clientId: string
  /** null → new plan (gets an id client-side and is created on first save). */
  planId: string | null
}

const newPlan = (clientId: string): Macrocycle => ({
  id: newId(), clientId, name: '', goal: '', startDate: nextMonday(), notes: '',
  mesocycles: [emptyMesocycle('Blok 1', 4)],
})

const fmtDay = (d: Date) => d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })

export default function PlanEditor({ clientId, planId }: Props) {
  const router = useRouter()
  const [plan, setPlan] = useState<Macrocycle | null>(planId ? null : newPlan(clientId))
  const [isNew, setIsNew] = useState(!planId)
  const [mesoId, setMesoId] = useState<string | null>(null)
  const [open, setOpen] = useState<{ weekId: string; sessionId: string } | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [clientName, setClientName] = useState('')

  useEffect(() => {
    fetch(`/api/trainer/clients/${encodeURIComponent(clientId)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => setClientName(d?.client?.name ?? ''))
      .catch(() => {})
  }, [clientId])

  useEffect(() => {
    if (!planId) return
    fetch(`/api/trainer/plans/${planId}`)
      .then(async r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => setPlan(d.plan))
      .catch(() => setStatus({ kind: 'error', text: 'Nie udało się wczytać planu.' }))
  }, [planId])

  useEffect(() => {
    if (plan && (!mesoId || !plan.mesocycles.some(m => m.id === mesoId))) setMesoId(plan.mesocycles[0]?.id ?? null)
  }, [plan, mesoId])

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  /** Immutable update via a mutable draft. */
  const edit = useCallback((fn: (draft: Macrocycle) => void) => {
    setPlan(p => {
      if (!p) return p
      const d = structuredClone(p)
      fn(d)
      return d
    })
    setDirty(true)
    setStatus(null)
  }, [])

  // Global week numbering across blocks: weekOffset[mesoId] = index of its first week.
  const weekOffset = useMemo(() => {
    const out: Record<string, number> = {}
    let n = 0
    for (const m of plan?.mesocycles ?? []) { out[m.id] = n; n += m.microcycles.length }
    return out
  }, [plan])
  const totalWeeks = plan?.mesocycles.reduce((s, m) => s + m.microcycles.length, 0) ?? 0

  const save = async () => {
    if (!plan) return
    if (!plan.name.trim()) { setStatus({ kind: 'error', text: 'Podaj nazwę makrocyklu.' }); return }
    setSaving(true)
    const res = await fetch(`/api/trainer/plans/${plan.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan),
    }).catch(() => null)
    setSaving(false)
    if (!res?.ok) {
      const d = await res?.json().catch(() => null)
      setStatus({ kind: 'error', text: d?.error ?? 'Zapis nie powiódł się.' })
      return
    }
    setDirty(false)
    setStatus({ kind: 'ok', text: 'Zapisano' })
    if (isNew) {
      setIsNew(false)
      router.replace(`/trainer/${encodeURIComponent(clientId)}/plans/${plan.id}`)
    }
  }

  const deletePlan = async () => {
    if (!plan || !confirm(`Usunąć makrocykl „${plan.name || 'bez nazwy'}”? Tej operacji nie można cofnąć.`)) return
    if (!isNew) {
      const res = await fetch(`/api/trainer/plans/${plan.id}`, { method: 'DELETE' }).catch(() => null)
      if (!res?.ok) { setStatus({ kind: 'error', text: 'Nie udało się usunąć planu.' }); return }
    }
    setDirty(false)
    router.push(`/trainer/${encodeURIComponent(clientId)}`)
  }

  const goBack = () => {
    if (dirty && !confirm('Masz niezapisane zmiany. Wyjść bez zapisu?')) return
    router.push(`/trainer/${encodeURIComponent(clientId)}`)
  }

  if (!plan) {
    return (
      <div className="min-h-full bg-[#080808] p-7">
        {status ? <p className="text-[13px] text-red-400">{status.text}</p>
          : <div className="h-40 rounded-2xl bg-[#0f0f0f] border border-[#1a1a1a] animate-pulse" />}
      </div>
    )
  }

  const meso = plan.mesocycles.find(m => m.id === mesoId) ?? plan.mesocycles[0]
  const mesoIdx = meso ? plan.mesocycles.indexOf(meso) : -1

  const editMeso = (fn: (m: Mesocycle) => void) => edit(d => { const m = d.mesocycles.find(x => x.id === meso?.id); if (m) fn(m) })

  const moveMeso = (dir: -1 | 1) => edit(d => {
    const j = mesoIdx + dir
    if (j < 0 || j >= d.mesocycles.length) return
    ;[d.mesocycles[mesoIdx], d.mesocycles[j]] = [d.mesocycles[j], d.mesocycles[mesoIdx]]
  })

  const addSession = (weekId: string, day: number) => {
    const s: PlannedSession = { id: newId(), dayOfWeek: day, name: 'Trening', notes: '', exercises: [] }
    editMeso(m => m.microcycles.find(w => w.id === weekId)?.sessions.push(s))
    setOpen({ weekId, sessionId: s.id })
  }

  // Resolve the open session.
  let openSession: PlannedSession | undefined
  let openWeekIdx = -1
  if (open && meso) {
    openWeekIdx = meso.microcycles.findIndex(w => w.id === open.weekId)
    openSession = meso.microcycles[openWeekIdx]?.sessions.find(s => s.id === open.sessionId)
  }

  const input = 'w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-sm text-[#f0ece4] placeholder:text-[#333] focus:outline-none focus:border-[#c8f53a]/40 transition-colors'
  const label = 'block text-[9px] font-mono uppercase tracking-[2px] text-[#555] mb-1.5'
  const smallBtn = 'text-[10px] font-mono uppercase tracking-[1.3px] cursor-pointer transition-colors'

  return (
    <div className="min-h-full bg-[#080808] text-[#f0ece4]">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-[#080808]/95 backdrop-blur border-b border-[#1a1a1a] px-4 md:px-7 py-3 flex items-center gap-3">
        <button onClick={goBack} className="text-[10px] font-mono text-[#444] uppercase tracking-[2px] hover:text-[#c8f53a] cursor-pointer">← {clientName || 'Podopieczny'}</button>
        <span className="text-[10px] font-mono text-[#333]">/</span>
        <span className="text-[12px] text-[#888] truncate">{plan.name || 'Nowy makrocykl'}</span>
        <div className="ml-auto flex items-center gap-3">
          {status && <span className={`text-[11px] font-mono ${status.kind === 'ok' ? 'text-[#c8f53a]' : 'text-red-400'}`}>{status.kind === 'ok' ? '✓ ' : ''}{status.text}</span>}
          {dirty && !status && <span className="text-[11px] font-mono text-[#f5a03a]">Niezapisane zmiany</span>}
          <button onClick={save} disabled={saving || (!dirty && !isNew)}
            className="px-4 py-2 rounded-xl text-[11px] font-mono uppercase tracking-[1.3px] bg-[#c8f53a] text-[#080808] hover:bg-[#d8ff4a] disabled:opacity-40 transition-all cursor-pointer">
            {saving ? 'Zapisuję…' : 'Zapisz plan'}
          </button>
        </div>
      </div>

      <div className="px-4 md:px-7 py-5 space-y-4">
        {/* Macrocycle */}
        <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-4 md:p-5">
          <p className="text-[10px] font-mono uppercase tracking-[2px] text-[#444] mb-3">Makrocykl</p>
          <div className="grid gap-3 md:grid-cols-[2fr_2fr_160px]">
            <div>
              <label className={label}>Nazwa</label>
              <input value={plan.name} onChange={e => edit(d => { d.name = e.target.value })} placeholder="np. Przygotowanie do zawodów 2027" className={input} />
            </div>
            <div>
              <label className={label}>Cel</label>
              <input value={plan.goal} onChange={e => edit(d => { d.goal = e.target.value })} placeholder="np. przysiad 180 kg, −4 kg" className={input} />
            </div>
            <div>
              <label className={label}>Start</label>
              <input type="date" value={plan.startDate} onChange={e => e.target.value && edit(d => { d.startDate = e.target.value })} className={`${input} [color-scheme:dark]`} />
            </div>
          </div>
          <div className="mt-3">
            <label className={label}>Notatki</label>
            <textarea rows={2} value={plan.notes} onChange={e => edit(d => { d.notes = e.target.value })} placeholder="Założenia, kontuzje, dostępny sprzęt…" className={`${input} resize-none`} />
          </div>
        </div>

        {/* Timeline of blocks */}
        <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-mono uppercase tracking-[2px] text-[#444]">
              Mezocykle · {totalWeeks} tyg. · {fmtDay(weekStart(plan.startDate, 0))}–{fmtDay(new Date(weekStart(plan.startDate, totalWeeks).getTime() - 86400000))}
            </p>
            <button onClick={() => {
              const m = emptyMesocycle(`Blok ${plan.mesocycles.length + 1}`, 4)
              edit(d => { d.mesocycles.push(m) })
              setMesoId(m.id)
            }} className={`${smallBtn} text-[#c8f53a] hover:underline`}>+ Blok</button>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {plan.mesocycles.map(m => {
              const f = focusMeta(m.focus)
              const active = m.id === meso?.id
              return (
                <button key={m.id} onClick={() => setMesoId(m.id)}
                  style={{ flexGrow: Math.max(m.microcycles.length, 1), borderColor: active ? f.color : undefined, background: `${f.color}${active ? '22' : '10'}` }}
                  className={`min-w-[110px] basis-0 text-left rounded-xl border px-3 py-2.5 transition-colors cursor-pointer ${active ? '' : 'border-[#1e1e1e] hover:border-[#2a2a2a]'}`}>
                  <div className="text-[12px] font-medium text-[#ddd] truncate">{m.name}</div>
                  <div className="text-[9px] font-mono uppercase tracking-[1px] truncate" style={{ color: f.color }}>
                    {f.label} · {m.microcycles.length} tyg.
                  </div>
                </button>
              )
            })}
            {plan.mesocycles.length === 0 && <p className="text-[12px] text-[#555] py-2">Dodaj pierwszy blok.</p>}
          </div>
        </div>

        {/* Selected block */}
        {meso && (
          <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-4 md:p-5 space-y-4">
            <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto] items-end">
              <div>
                <label className={label}>Nazwa bloku</label>
                <input value={meso.name} onChange={e => editMeso(m => { m.name = e.target.value })} className={input} />
              </div>
              <div>
                <label className={label}>Charakter</label>
                <select value={meso.focus ?? ''} onChange={e => editMeso(m => { m.focus = (e.target.value || null) as Focus | null })}
                  className={`${input} cursor-pointer`}>
                  <option value="">—</option>
                  {FOCUS_OPTIONS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pb-2.5">
                <button onClick={() => moveMeso(-1)} disabled={mesoIdx === 0} className={`${smallBtn} text-[#666] hover:text-[#f0ece4] disabled:opacity-30`}>← Przesuń</button>
                <button onClick={() => moveMeso(1)} disabled={mesoIdx === plan.mesocycles.length - 1} className={`${smallBtn} text-[#666] hover:text-[#f0ece4] disabled:opacity-30`}>Przesuń →</button>
                <button onClick={() => {
                  const c = cloneMesocycle(meso)
                  edit(d => { d.mesocycles.splice(mesoIdx + 1, 0, c) })
                  setMesoId(c.id)
                }} className={`${smallBtn} text-[#888] hover:text-[#f0ece4]`}>Duplikuj</button>
                <button onClick={() => {
                  if (!confirm(`Usunąć blok „${meso.name}” razem z ${meso.microcycles.length} tygodniami?`)) return
                  edit(d => { d.mesocycles.splice(mesoIdx, 1) })
                  setMesoId(null)
                }} className={`${smallBtn} text-[#555] hover:text-red-400`}>Usuń</button>
              </div>
            </div>

            {/* Week × day grid */}
            <div className="overflow-x-auto -mx-1 px-1">
              <div className="min-w-[860px]">
                <div className="grid grid-cols-[120px_repeat(7,1fr)] gap-1.5 mb-1.5">
                  <span />
                  {DAY_LABELS.map(d => <span key={d} className="text-[9px] font-mono uppercase tracking-[1.5px] text-[#444] text-center">{d}</span>)}
                </div>

                <div className="space-y-1.5">
                  {meso.microcycles.map((w, wi) => {
                    const globalIdx = (weekOffset[meso.id] ?? 0) + wi
                    const start = weekStart(plan.startDate, globalIdx)
                    return (
                      <div key={w.id} className="grid grid-cols-[120px_repeat(7,1fr)] gap-1.5">
                        <div className="bg-[#131313] border border-[#1c1c1c] rounded-xl px-2.5 py-2 flex flex-col justify-between">
                          <div>
                            <div className="text-[12px] font-medium text-[#ddd]">Tydz. {globalIdx + 1}</div>
                            <div className="text-[9px] font-mono text-[#555]">{fmtDay(start)} · {wi + 1}/{meso.microcycles.length} w bloku</div>
                          </div>
                          <div className="flex gap-2 mt-1.5">
                            <button onClick={() => editMeso(m => { m.microcycles.splice(wi + 1, 0, cloneWeek(w)) })}
                              className={`${smallBtn} text-[#666] hover:text-[#f0ece4]`} title="Duplikuj tydzień">Kopiuj</button>
                            <button onClick={() => {
                              if (w.sessions.length && !confirm(`Usunąć tydzień ${globalIdx + 1} z ${w.sessions.length} sesjami?`)) return
                              editMeso(m => { m.microcycles.splice(wi, 1) })
                            }} className={`${smallBtn} text-[#555] hover:text-red-400`} title="Usuń tydzień">Usuń</button>
                          </div>
                        </div>

                        {DAY_LABELS.map((_, di) => {
                          const day = di + 1
                          const sessions = w.sessions.filter(s => s.dayOfWeek === day)
                          return (
                            <div key={day} className="group min-h-[76px] bg-[#0b0b0b] border border-[#181818] rounded-xl p-1 flex flex-col gap-1">
                              {sessions.map(s => (
                                <button key={s.id} onClick={() => setOpen({ weekId: w.id, sessionId: s.id })}
                                  className="text-left rounded-lg bg-[#c8f53a]/[0.07] border border-[#c8f53a]/20 hover:border-[#c8f53a]/50 px-2 py-1.5 cursor-pointer transition-colors">
                                  <div className="text-[11px] font-medium text-[#e8e4dc] truncate">{s.name || 'Trening'}</div>
                                  <div className="text-[9px] font-mono text-[#777] truncate">
                                    {s.exercises.length} ćw. · {s.exercises.reduce((n, e) => n + e.sets, 0)} serii
                                  </div>
                                </button>
                              ))}
                              <button onClick={() => addSession(w.id, day)}
                                className="mt-auto rounded-lg text-[14px] leading-none py-1 text-[#2a2a2a] group-hover:text-[#666] hover:!text-[#c8f53a] hover:bg-white/[0.02] cursor-pointer"
                                aria-label={`Dodaj sesję: tydzień ${globalIdx + 1}, ${DAY_LABELS[di]}`}>+</button>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={() => editMeso(m => {
                const last = m.microcycles[m.microcycles.length - 1]
                m.microcycles.push(last ? cloneWeek(last) : emptyWeek())
              })} className={`${smallBtn} text-[#c8f53a] hover:underline`}>+ Tydzień (kopia ostatniego)</button>
              <button onClick={() => editMeso(m => { m.microcycles.push(emptyWeek()) })} className={`${smallBtn} text-[#888] hover:text-[#f0ece4]`}>+ Pusty tydzień</button>
            </div>

            <div>
              <label className={label}>Notatki do bloku</label>
              <textarea rows={2} value={meso.notes} onChange={e => editMeso(m => { m.notes = e.target.value })} placeholder="Cel bloku, zakres intensywności, objętość…" className={`${input} resize-none`} />
            </div>
          </div>
        )}

        {/* Read-only overview of the selected block's first week, handy when printing/screen-sharing */}
        {meso && meso.microcycles[0]?.sessions.length > 0 && (
          <details className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-4 md:p-5">
            <summary className="text-[10px] font-mono uppercase tracking-[2px] text-[#444] cursor-pointer">Podgląd pierwszego tygodnia bloku</summary>
            <div className="grid gap-2 md:grid-cols-2 mt-3">
              {meso.microcycles[0].sessions.map(s => (
                <div key={s.id} className="bg-[#131313] border border-[#1c1c1c] rounded-xl p-3">
                  <div className="text-[12px] font-medium text-[#ccc] mb-1.5">{DAY_LABELS[s.dayOfWeek - 1]} · {s.name}</div>
                  {s.exercises.map((e, i) => (
                    <div key={i} className="flex justify-between gap-3 text-[11px] py-0.5">
                      <span className="text-[#999] truncate">{e.name}</span>
                      <span className="font-mono text-[#777] flex-shrink-0">{formatPrescription(e)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </details>
        )}

        <div className="flex justify-end">
          <button onClick={deletePlan} className={`${smallBtn} text-[#555] hover:text-red-400`}>Usuń makrocykl</button>
        </div>
      </div>

      {open && openSession && meso && (
        <SessionEditor
          session={openSession}
          weekLabel={`Tydz. ${(weekOffset[meso.id] ?? 0) + openWeekIdx + 1}`}
          remainingWeeks={meso.microcycles.length - openWeekIdx - 1}
          onClose={() => setOpen(null)}
          onChange={s => editMeso(m => {
            const w = m.microcycles[openWeekIdx]
            w.sessions = w.sessions.map(x => (x.id === s.id ? s : x))
          })}
          onDelete={() => {
            editMeso(m => {
              const w = m.microcycles[openWeekIdx]
              w.sessions = w.sessions.filter(x => x.id !== open.sessionId)
            })
            setOpen(null)
          }}
          onDuplicate={() => {
            const c = cloneSession(openSession!)
            editMeso(m => { m.microcycles[openWeekIdx].sessions.push(c) })
            setOpen({ weekId: open.weekId, sessionId: c.id })
          }}
          onPropagate={stepKg => {
            const src = openSession!
            editMeso(m => {
              for (let k = openWeekIdx + 1; k < m.microcycles.length; k++) {
                const w = m.microcycles[k]
                const c = cloneSession(src)
                const n = k - openWeekIdx
                c.exercises = c.exercises.map(e => ({
                  ...e,
                  weightKg: e.weightKg != null ? Math.round((e.weightKg + stepKg * n) * 4) / 4 : null,
                }))
                const idx = w.sessions.findIndex(x => x.dayOfWeek === src.dayOfWeek && x.name === src.name)
                if (idx >= 0) w.sessions[idx] = c
                else w.sessions.push(c)
              }
            })
            setStatus({ kind: 'ok', text: `Skopiowano na ${meso.microcycles.length - openWeekIdx - 1} tyg. — pamiętaj zapisać` })
          }}
        />
      )}
    </div>
  )
}
