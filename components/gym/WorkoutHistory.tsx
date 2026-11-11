'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { fmtKg, fmtTonnes, findPrs, mondayOf, setsSummary, weekdayIndex, type StatSet, type StatWorkout } from '@/lib/gym-stats'
import GymTabs from '@/components/gym/GymTabs'
import WorkoutComments from '@/components/gym/WorkoutComments'
import type { WorkoutComment } from '@/app/api/gym/comments/route'

interface WorkoutRow extends StatWorkout {
  notes: string | null
  workout_sets: (StatSet & { rpe: number | string | null })[]
}

interface WorkoutHistoryProps {
  /** Source of workouts; defaults to the signed-in user's own history. */
  endpoint?: string
  /** Hides delete actions and the gym tabs — used in the trainer's client view. */
  readOnly?: boolean
}

const DAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd']
const DAY = 86400000
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

function groupSets(sets: WorkoutRow['workout_sets']) {
  const groups = new Map<number, { id: string; name: string; sets: WorkoutRow['workout_sets'] }>()
  for (const s of [...sets].sort((a, b) => a.exercise_position - b.exercise_position || a.set_number - b.set_number)) {
    const g = groups.get(s.exercise_position) ?? { id: s.exercise_id, name: s.exercise_name ?? s.exercise_id, sets: [] }
    g.sets.push(s)
    groups.set(s.exercise_position, g)
  }
  return Array.from(groups.values())
}

function weekLabel(monday: Date) {
  const thisMonday = mondayOf(new Date())
  if (monday.getTime() === thisMonday.getTime()) return 'Ten tydzień'
  if (monday.getTime() === thisMonday.getTime() - 7 * DAY) return 'Poprzedni tydzień'
  const sunday = new Date(monday.getTime() + 6 * DAY)
  const f = (d: Date) => d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
  return `${f(monday)} – ${f(sunday)}`
}

/** Workout log: month calendar shaded by volume, then workouts grouped by week with PR markers. */
export default function WorkoutHistory({ endpoint = '/api/gym/workouts?limit=100', readOnly = false }: WorkoutHistoryProps = {}) {
  const [workouts, setWorkouts] = useState<WorkoutRow[] | null>(null)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [comments, setComments] = useState<Record<string, WorkoutComment[]>>({})
  const [commentsAvailable, setCommentsAvailable] = useState(false)

  useEffect(() => {
    fetch(endpoint)
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(d => {
        setWorkouts(d.workouts)
        // Land on the month of the latest workout (a client may not have trained this month).
        const latest = d.workouts[0]?.started_at
        if (latest) { const l = new Date(latest); setMonth(new Date(l.getFullYear(), l.getMonth(), 1)) }
      })
      .catch(() => { setWorkouts([]); setError('Nie udało się wczytać historii.') })
  }, [endpoint])

  // Comments for all loaded workouts in one request (trainer feedback + athlete replies).
  const loadComments = useCallback(async () => {
    const ids = (workouts ?? []).map(w => w.id)
    if (!ids.length) return
    const res = await fetch(`/api/gym/comments?workouts=${ids.join(',')}`).catch(() => null)
    if (!res?.ok) return
    const d = await res.json()
    setCommentsAvailable(d.available)
    setComments(d.comments)
  }, [workouts])

  useEffect(() => { loadComments() }, [loadComments])

  const prs = useMemo(() => findPrs(workouts ?? []), [workouts])
  const prSet = useMemo(() => new Set(prs.map(p => `${p.workoutId}:${p.exerciseId}`)), [prs])

  const monthWorkouts = useMemo(() => (workouts ?? []).filter(w => {
    const d = new Date(w.started_at)
    return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth()
  }), [workouts, month])

  // Calendar cells: Monday-first grid, shaded by the day's tonnage relative to the month's busiest day.
  const calendar = useMemo(() => {
    const byDay = new Map<string, number>()
    for (const w of monthWorkouts) {
      const k = dayKey(new Date(w.started_at))
      byDay.set(k, (byDay.get(k) ?? 0) + Math.max(1, Number(w.total_tonnage ?? 0)))
    }
    const max = Math.max(1, ...Array.from(byDay.values()))
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    const lead = weekdayIndex(month)
    const today = dayKey(new Date())
    return Array.from({ length: Math.ceil((lead + daysInMonth) / 7) * 7 }, (_, i) => {
      const day = i - lead + 1
      if (day < 1 || day > daysInMonth) return null
      const date = new Date(month.getFullYear(), month.getMonth(), day)
      const v = byDay.get(dayKey(date)) ?? 0
      return { day, date, level: v === 0 ? 0 : v / max > 0.66 ? 3 : v / max > 0.33 ? 2 : 1, today: dayKey(date) === today }
    })
  }, [monthWorkouts, month])

  const weeks = useMemo(() => {
    const groups = new Map<number, WorkoutRow[]>()
    for (const w of monthWorkouts) {
      const m = mondayOf(new Date(w.started_at)).getTime()
      groups.set(m, [...(groups.get(m) ?? []), w])
    }
    return Array.from(groups.entries()).sort((a, b) => b[0] - a[0])
  }, [monthWorkouts])

  const summary = {
    count: monthWorkouts.length,
    tonnage: monthWorkouts.reduce((s, w) => s + Number(w.total_tonnage ?? 0), 0),
    minutes: Math.round(monthWorkouts.reduce((s, w) => s + (w.duration_seconds ?? 0), 0) / 60),
  }

  const shiftMonth = (delta: number) => setMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1))
  const isCurrentMonth = month.getFullYear() === new Date().getFullYear() && month.getMonth() === new Date().getMonth()

  const openDay = (date: Date) => {
    const w = monthWorkouts.find(x => dayKey(new Date(x.started_at)) === dayKey(date))
    if (!w) return
    setOpenId(w.id)
    document.getElementById(`workout-${w.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Usunąć ten trening z historii?')) return
    const res = await fetch(`/api/gym/workouts/${id}`, { method: 'DELETE' }).catch(() => null)
    if (res?.ok) setWorkouts(ws => (ws ?? []).filter(w => w.id !== id))
    else setError('Nie udało się usunąć treningu.')
  }

  const levelClass = ['bg-[#141414]', 'bg-[#3a4a10]', 'bg-[#7a9a20]', 'bg-[#c8f53a]']

  return (
    <div className="min-h-full bg-[#080808] text-[#f0ece4]">
      <div className={`max-w-2xl mx-auto ${readOnly ? 'px-4 md:px-7 pt-2' : 'px-4 md:px-7 pt-4 md:pt-6'} pb-8 space-y-4`}>
        {!readOnly && (
          <>
            <GymTabs />
            <div>
              <p className="text-[11px] font-mono text-[#666] uppercase tracking-[1.5px]">Siłownia</p>
              <h1 className="font-display text-[24px] font-black leading-tight">Historia</h1>
            </div>
          </>
        )}

        {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] text-red-400">{error}</div>}

        {/* Month calendar */}
        <section className="rounded-2xl bg-[#0f0f0f] border border-[#1a1a1a] p-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => shiftMonth(-1)} aria-label="Poprzedni miesiąc" className="w-8 h-8 rounded-lg text-[#888] hover:text-[#f0ece4] cursor-pointer">‹</button>
            <span className="text-[14px] font-medium capitalize">{month.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}</span>
            <button onClick={() => shiftMonth(1)} disabled={isCurrentMonth} aria-label="Następny miesiąc" className="w-8 h-8 rounded-lg text-[#888] hover:text-[#f0ece4] disabled:opacity-20 cursor-pointer">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {DAYS.map(d => <span key={d} className="text-[11px] text-[#555] text-center">{d}</span>)}
            {calendar.map((c, i) => c ? (
              <button key={i} onClick={() => openDay(c.date)} disabled={!c.level}
                aria-label={`${c.day} ${c.level ? '— trening' : ''}`}
                className={`h-9 rounded-lg text-[11px] flex items-center justify-center ${levelClass[c.level]} ${
                  c.level >= 2 ? 'text-[#0f1a00]' : 'text-[#666]'
                } ${c.today ? 'ring-1 ring-[#c8f53a]' : ''} ${c.level ? 'cursor-pointer' : 'cursor-default'}`}>
                {c.day}
              </button>
            ) : <span key={i} />)}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[#1a1a1a] text-center">
            <div><div className="text-[16px] font-medium">{summary.count}</div><div className="text-[11px] text-[#666]">treningi</div></div>
            <div><div className="text-[16px] font-medium">{fmtTonnes(summary.tonnage)}</div><div className="text-[11px] text-[#666]">tonaż</div></div>
            <div><div className="text-[16px] font-medium">{Math.floor(summary.minutes / 60)} h {summary.minutes % 60} min</div><div className="text-[11px] text-[#666]">czas</div></div>
          </div>
        </section>

        {workouts === null && [0, 1, 2].map(i => <div key={i} className="h-[64px] rounded-2xl bg-[#0f0f0f] border border-[#1a1a1a] animate-pulse" />)}
        {workouts && monthWorkouts.length === 0 && !error && (
          <p className="text-center py-10 text-[13px] text-[#555]">Brak treningów w tym miesiącu.</p>
        )}

        {/* Workouts by week */}
        {weeks.map(([monday, list]) => (
          <section key={monday} className="space-y-2">
            <div className="flex items-baseline justify-between px-0.5">
              <span className="text-[11px] font-mono text-[#666] uppercase tracking-[1.5px]">{weekLabel(new Date(monday))}</span>
              <span className="text-[11px] text-[#555]">{list.length} · {fmtTonnes(list.reduce((s, w) => s + Number(w.total_tonnage ?? 0), 0))}</span>
            </div>
            {list.map(w => {
              const open = openId === w.id
              const groups = groupSets(w.workout_sets ?? [])
              const prCount = groups.filter(g => prSet.has(`${w.id}:${g.id}`)).length
              const date = new Date(w.started_at)
              return (
                <div key={w.id} id={`workout-${w.id}`} className={`rounded-2xl bg-[#111] border transition-colors ${open ? 'border-[#c8f53a]/25' : 'border-[#1e1e1e]'}`}>
                  <button onClick={() => setOpenId(open ? null : w.id)} className="w-full text-left px-4 py-3 flex items-center gap-3 cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-medium truncate">{w.name}</span>
                        {prCount > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#2a3a08] text-[#c8f53a] flex-shrink-0">{prCount} PR</span>}
                        {(comments[w.id]?.length ?? 0) > 0 && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#1a1a1a] text-[#bbb] flex-shrink-0 flex items-center gap-1" aria-label={`${comments[w.id].length} komentarzy`}>
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" strokeLinejoin="round" /></svg>
                            {comments[w.id].length}
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] text-[#777]">
                        {date.toLocaleDateString('pl-PL', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                        {' · '}{Math.round((w.duration_seconds ?? 0) / 60)} min · {fmtTonnes(Number(w.total_tonnage ?? 0))}
                      </div>
                    </div>
                    <span className={`text-[#555] transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
                  </button>

                  {open && (
                    <div className="px-4 pb-3 space-y-2.5">
                      {groups.length === 0 && <p className="text-[12px] text-[#555]">Brak zapisanych serii.</p>}
                      {groups.map(g => {
                        const isPr = prSet.has(`${w.id}:${g.id}`)
                        return (
                          <div key={g.id + g.sets[0]?.exercise_position}>
                            <div className="flex items-center gap-2 text-[13px]">
                              <span className="flex-1 min-w-0 truncate">{g.name}</span>
                              <span className="text-[#888]">{setsSummary(g.sets)}</span>
                              <span className={`w-3 text-[#c8f53a] ${isPr ? '' : 'invisible'}`} aria-label={isPr ? 'rekord' : undefined}>▲</span>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {g.sets.map(s => (
                                <span key={s.set_number} className="text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-[#0a0a0a] border border-[#1e1e1e] text-[#999]">
                                  {s.weight_kg != null ? `${fmtKg(Number(s.weight_kg))}×` : ''}{s.reps ?? '?'}{s.rpe != null ? ` @${Number(s.rpe)}` : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                      {w.notes && <p className="text-[12px] text-[#888] whitespace-pre-wrap">{w.notes}</p>}
                      <WorkoutComments workoutId={w.id} comments={comments[w.id] ?? []} available={commentsAvailable}
                        placeholder={readOnly ? 'Komentarz dla podopiecznego…' : 'Odpowiedz trenerowi…'} onChange={loadComments} />
                      {!readOnly && (
                        <div className="flex justify-end pt-1">
                          <button onClick={() => handleDelete(w.id)} className="text-[11px] text-[#555] hover:text-red-400 cursor-pointer">Usuń trening</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        ))}
      </div>
    </div>
  )
}
