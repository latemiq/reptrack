'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useShallow } from 'zustand/react/shallow'
import { useWorkoutStore, selectProgress, selectTotalTonnage, type ExerciseEntry, type SetEntry } from '@/lib/stores/useWorkoutStore'
import { fetchPrevious } from '@/lib/start-workout'
import { fmtKg, fmtTonnes } from '@/lib/gym-stats'
import { supersetLabels } from '@/lib/plans'
import ExercisePicker from '@/components/gym/ExercisePicker'
import SupersetToggle from '@/components/gym/SupersetToggle'

const fmtTime = (totalSec: number) => {
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

const num = (v: string) => (v === '' ? null : Number(v.replace(',', '.')))
const isDone = (ex: ExerciseEntry) => ex.sets.length > 0 && ex.sets.every(s => s.done)
const repsText = (ex: ExerciseEntry) =>
  ex.targetRepsMax && ex.targetRepsMax !== ex.targetReps ? `${ex.targetReps}–${ex.targetRepsMax}` : String(ex.targetReps)

/**
 * Number input that keeps what the user is typing ("42," on the way to "42,5")
 * and accepts both comma and dot; shows Polish formatting when not focused.
 */
function NumField({ value, onChange, ...rest }: {
  value: number | null
  onChange: (v: number | null) => void
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [text, setText] = useState<string | null>(null)
  return (
    <input {...rest} type="text"
      value={text ?? (value != null ? fmtKg(value) : '')}
      onFocus={e => { setText(value != null ? fmtKg(value) : ''); e.currentTarget.select() }}
      onChange={e => {
        const t = e.target.value.replace(/[^\d.,]/g, '')
        setText(t)
        const n = num(t)
        onChange(n == null || Number.isNaN(n) ? null : n)
      }}
      onBlur={() => setText(null)} />
  )
}

// ─── Set row ────────────────────────────────────────────────────────────────

function SetRow({ set, index, previous, onChange, onToggle }: {
  set: SetEntry
  index: number
  previous?: { weightKg: number | null; reps: number | null }
  onChange: (patch: Partial<SetEntry>) => void
  onToggle: () => void
}) {
  const field = `w-full rounded-lg py-1.5 text-center text-[15px] font-mono outline-none transition-colors ${
    set.done ? 'bg-transparent border border-transparent text-[#f0ece4]' : 'bg-[#0a0a0a] border border-[#262626] focus:border-[#c8f53a]/50 text-[#f0ece4]'
  }`
  return (
    <div className={`grid grid-cols-[26px_1fr_68px_56px_36px] gap-1.5 items-center px-1.5 py-1 rounded-lg transition-colors ${set.done ? 'bg-[#162000]' : ''}`}>
      <span className={`text-[13px] font-mono ${set.done ? 'text-[#c8f53a]' : 'text-[#888]'}`}>{index + 1}</span>
      <span className="text-[12px] text-[#666] font-mono truncate">
        {previous ? `${previous.weightKg != null ? fmtKg(previous.weightKg) : '–'}×${previous.reps ?? '–'}` : '—'}
      </span>
      <NumField inputMode="decimal" aria-label={`Ciężar, seria ${index + 1}`}
        value={set.weightKg} placeholder={previous?.weightKg != null ? fmtKg(previous.weightKg) : 'kg'}
        onChange={v => onChange({ weightKg: v })} readOnly={set.done} className={field} />
      <NumField inputMode="numeric" aria-label={`Powtórzenia, seria ${index + 1}`}
        value={set.reps} placeholder={previous?.reps != null ? String(previous.reps) : 'powt.'}
        onChange={v => onChange({ reps: v == null ? null : Math.round(v) })} readOnly={set.done} className={field} />
      <button onClick={onToggle} aria-label={set.done ? 'Cofnij zaliczenie serii' : 'Zalicz serię'}
        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
          set.done ? 'bg-[#c8f53a] text-[#0f1a00]' : 'border border-[#333] text-[#444] hover:border-[#c8f53a]/50'
        }`}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </div>
  )
}

// ─── Exercise card ──────────────────────────────────────────────────────────

function SupersetBadge({ label }: { label: string | null }) {
  if (!label) return null
  return <span className="shrink-0 px-1.5 py-0.5 rounded bg-[#f5a03a]/15 text-[#f5a03a] text-[11px] font-mono">{label}</span>
}

function ExerciseCard({ ex, index, total, label, expanded, onExpand, onOpen }: {
  ex: ExerciseEntry
  index: number
  total: number
  /** Superset label like "A1", null when standalone. */
  label: string | null
  expanded: boolean
  onExpand: () => void
  /** Opens another exercise (the next one of a superset). */
  onOpen: (id: string) => void
}) {
  const { updateSet, completeSet, addSet, removeSet, removeExercise, reorderExercise, toggleSuperset } = useWorkoutStore()
  const [menu, setMenu] = useState(false)
  const doneCount = ex.sets.filter(s => s.done).length
  const done = isDone(ex)

  if (!expanded) {
    return (
      <button onClick={onExpand}
        className={`w-full flex items-center gap-3 rounded-2xl bg-[#111] border px-4 py-3 text-left cursor-pointer hover:border-[#2a2a2a] ${label ? 'border-[#f5a03a]/20' : 'border-[#1e1e1e]'}`}>
        <SupersetBadge label={label} />
        <span className={`flex-1 min-w-0 truncate text-[14px] ${done ? 'text-[#777]' : ''}`}>{ex.name}</span>
        <span className={`text-[12px] font-mono ${done ? 'text-[#c8f53a]' : 'text-[#777]'}`}>{doneCount}/{ex.sets.length}</span>
        {done && <span className="text-[#c8f53a]" aria-label="ukończone">✓</span>}
      </button>
    )
  }

  const toggle = (set: SetEntry) => {
    if (set.done) updateSet(ex.id, set.id, { done: false, completedAt: undefined })
    else {
      const next = completeSet(ex.id, set.id)
      if (next) onOpen(next)
    }
  }

  return (
    <div className="rounded-2xl bg-[#111] border border-[#c8f53a]/25 p-3">
      <div className="flex items-start gap-2 px-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <SupersetBadge label={label} />
            <div className="text-[15px] font-medium text-[#c8f53a] truncate">{ex.name}</div>
          </div>
          {label && <div className="text-[11px] text-[#f5a03a] mt-0.5">Superseria — serie na zmianę, przerwa po ostatnim ćwiczeniu</div>}
          <div className="text-[12px] text-[#777] mt-0.5">
            {ex.plan ? `Plan: ${ex.plan}` : `Cel: ${ex.targetSets}×${repsText(ex)}${ex.targetWeight ? ` @ ${fmtKg(ex.targetWeight)} kg` : ''}`}
            {ex.restSeconds ? ` · przerwa ${fmtTime(ex.restSeconds)}` : ''}
          </div>
          {ex.notes && (
            <div className="mt-1.5 rounded-lg bg-[#c8f53a]/[0.06] border border-[#c8f53a]/15 px-2.5 py-1.5 text-[12px] text-[#d8e8b0]">
              <span className="text-[#c8f53a]">Trener:</span> {ex.notes}
            </div>
          )}
        </div>
        <div className="relative">
          <button onClick={() => setMenu(m => !m)} aria-label="Opcje ćwiczenia" className="w-8 h-8 rounded-lg text-[#777] hover:text-[#f0ece4] cursor-pointer">⋯</button>
          {menu && (
            <div className="absolute right-0 top-9 z-20 w-60 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] py-1 shadow-xl" onMouseLeave={() => setMenu(false)}>
              {index > 0 && <button onClick={() => { reorderExercise(ex.id, 'up'); setMenu(false) }} className="w-full text-left px-3 py-2 text-[13px] hover:bg-white/[0.05] cursor-pointer">Przesuń wyżej</button>}
              {index < total - 1 && <button onClick={() => { reorderExercise(ex.id, 'down'); setMenu(false) }} className="w-full text-left px-3 py-2 text-[13px] hover:bg-white/[0.05] cursor-pointer">Przesuń niżej</button>}
              {index > 0 && (
                <button onClick={() => { toggleSuperset(ex.id); setMenu(false) }} className="w-full text-left px-3 py-2 text-[13px] text-[#f5a03a] hover:bg-white/[0.05] cursor-pointer">
                  {ex.superset ? 'Rozłącz superserię' : 'Superseria z ćwiczeniem wyżej'}
                </button>
              )}
              <button onClick={() => { if (confirm(`Usunąć „${ex.name}” z treningu?`)) removeExercise(ex.id) }} className="w-full text-left px-3 py-2 text-[13px] text-red-400 hover:bg-white/[0.05] cursor-pointer">Usuń ćwiczenie</button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[26px_1fr_68px_56px_36px] gap-1.5 px-1.5 mt-3 mb-1 text-[11px] font-mono text-[#555] uppercase">
        <span>Ser</span><span>Poprz.</span><span className="text-center">kg</span><span className="text-center">Powt</span><span />
      </div>
      <div className="space-y-1">
        {ex.sets.map((set, i) => (
          <SetRow key={set.id} set={set} index={i} previous={ex.previous?.[i]}
            onChange={patch => updateSet(ex.id, set.id, patch)} onToggle={() => toggle(set)} />
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        <button onClick={() => addSet(ex.id)} className="flex-1 py-2 rounded-lg text-[12px] text-[#999] hover:text-[#c8f53a] hover:bg-white/[0.02] cursor-pointer">+ Dodaj serię</button>
        {ex.sets.length > 1 && !ex.sets[ex.sets.length - 1].done && (
          <button onClick={() => removeSet(ex.id, ex.sets[ex.sets.length - 1].id)} className="px-3 py-2 rounded-lg text-[12px] text-[#666] hover:text-red-400 cursor-pointer">− Usuń</button>
        )}
      </div>
    </div>
  )
}

// ─── Rest timer bar ─────────────────────────────────────────────────────────

function RestBar() {
  const { restTimer, tickRestTimer, skipRestTimer, addRestTime } = useWorkoutStore()

  useEffect(() => {
    if (!restTimer.isActive) return
    const i = setInterval(() => tickRestTimer(), 1000)
    return () => clearInterval(i)
  }, [restTimer.isActive, tickRestTimer])

  useEffect(() => {
    if (restTimer.isActive && restTimer.remainingSeconds <= 0) {
      try { navigator.vibrate?.([200, 100, 200]) } catch { /* not supported */ }
      skipRestTimer()
    }
  }, [restTimer.remainingSeconds, restTimer.isActive, skipRestTimer])

  if (!restTimer.isActive) return null
  const pct = restTimer.totalSeconds ? (restTimer.remainingSeconds / restTimer.totalSeconds) * 100 : 0

  return (
    <div className="sticky bottom-0 z-30 -mx-4 md:mx-0 md:rounded-2xl bg-[#151515] border-t md:border border-[#262626] px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[1.5px] text-[#f5a03a]">Przerwa</div>
          <div className="text-[26px] font-mono leading-none">{fmtTime(Math.max(0, restTimer.remainingSeconds))}</div>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => addRestTime(-15)} className="px-3 py-2 rounded-full bg-[#222] text-[12px] text-[#ccc] cursor-pointer">−15 s</button>
          <button onClick={() => addRestTime(15)} className="px-3 py-2 rounded-full bg-[#222] text-[12px] text-[#ccc] cursor-pointer">+15 s</button>
          <button onClick={skipRestTimer} className="px-3 py-2 rounded-full bg-[#f5a03a] text-[12px] text-[#2a1600] font-medium cursor-pointer">Pomiń</button>
        </div>
      </div>
      <div className="h-[3px] rounded-full bg-[#262626] mt-2.5 overflow-hidden">
        <div className="h-full bg-[#f5a03a] transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function ActiveWorkout() {
  const router = useRouter()
  const { activeWorkout, finishWorkout, cancelWorkout, addExercise } = useWorkoutStore()
  // selectProgress builds a new object each call — compare shallowly or zustand re-renders forever.
  const progress = useWorkoutStore(useShallow(selectProgress))
  const tonnage = useWorkoutStore(selectTotalTonnage)
  const [elapsed, setElapsed] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [asSuperset, setAsSuperset] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (!activeWorkout) return
    const tick = () => setElapsed(Math.floor((Date.now() - activeWorkout.startedAt) / 1000))
    tick()
    const i = setInterval(tick, 1000)
    return () => clearInterval(i)
  }, [activeWorkout])

  if (!activeWorkout) {
    return (
      <div className="min-h-full flex items-center justify-center bg-[#080808] text-[#f0ece4] p-6">
        <div className="text-center max-w-sm">
          <div className="font-display text-[24px] font-black mb-2">Brak aktywnego treningu</div>
          <p className="text-[14px] text-[#777] mb-6">Wybierz szablon albo trening od trenera, żeby zacząć.</p>
          <button onClick={() => router.push('/gym')} className="px-6 py-3 rounded-xl bg-[#c8f53a] text-[#0f1a00] text-[12px] font-mono uppercase tracking-[1.5px] cursor-pointer">Przejdź do siłowni</button>
        </div>
      </div>
    )
  }

  // The first unfinished exercise is open unless the user opened another one.
  const firstOpen = activeWorkout.exercises.find(ex => !isDone(ex))?.id ?? null
  const openId = expandedId && activeWorkout.exercises.some(e => e.id === expandedId) ? expandedId : firstOpen
  const labels = supersetLabels(activeWorkout.exercises)

  const addFromPicker = async (pick: { id: string; name: string }) => {
    setPicking(false)
    // In a superset both exercises run the same number of rounds.
    const partner = asSuperset ? activeWorkout.exercises[activeWorkout.exercises.length - 1] : undefined
    setAsSuperset(false)
    const previous = (await fetchPrevious([pick.id]))[pick.id]
    const id = crypto.randomUUID()
    addExercise({
      id, exerciseId: pick.id, name: pick.name, previous, superset: !!partner,
      targetSets: partner?.sets.length ?? (previous?.length || 3), targetReps: previous?.[0]?.reps ?? 8, targetWeight: null,
      restSeconds: partner?.restSeconds ?? 120,
    })
    setExpandedId(id)
  }

  const finish = async () => {
    if (progress.done === 0) {
      // Nothing logged: don't create an empty workout in the history.
      if (!confirm('Nie zaliczyłeś żadnej serii, więc trening nie zostanie zapisany. Odrzucić go?')) return
      cancelWorkout()
      router.push('/gym')
      return
    }
    const left = progress.total - progress.done
    if (left > 0 && !confirm(`Zostało ${left} niezaliczonych serii. Zakończyć trening? Zapiszą się tylko zaliczone serie.`)) return
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch('/api/gym/workouts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(activeWorkout) })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Zapis nie powiódł się (${res.status})`)
      finishWorkout()
      router.push('/gym/history')
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Nie udało się zapisać treningu')
      setSaving(false)
    }
  }

  const cancel = () => {
    if (!confirm('Anulować trening? Zalogowane serie zostaną utracone.')) return
    cancelWorkout()
    router.push('/gym')
  }

  return (
    <div className="min-h-full bg-[#080808] text-[#f0ece4]">
      <div className="max-w-2xl mx-auto px-4 md:px-7 min-h-full flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-[#080808] pt-3 pb-2 -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/gym')} aria-label="Wróć do siłowni (trening trwa dalej)"
              className="w-9 h-9 rounded-xl text-[#888] hover:text-[#f0ece4] flex items-center justify-center cursor-pointer">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M5 8l5 5 5-5" /></svg>
            </button>
            <div className="flex-1 min-w-0 text-center">
              <div className="text-[15px] font-medium truncate">{activeWorkout.name}</div>
              <div className="text-[12px] font-mono text-[#777]">{fmtTime(elapsed)} · {fmtTonnes(tonnage)}</div>
            </div>
            <button onClick={finish} disabled={saving}
              className="px-3.5 py-2 rounded-xl bg-[#c8f53a] text-[#0f1a00] text-[13px] font-medium disabled:opacity-60 cursor-pointer">
              {saving ? 'Zapisuję…' : 'Zakończ'}
            </button>
          </div>
          <div className="h-1 rounded-full bg-[#1a1a1a] mt-2.5 overflow-hidden">
            <div className="h-full bg-[#c8f53a] transition-[width] duration-300" style={{ width: `${progress.pct}%` }} />
          </div>
        </header>

        {saveError && (
          <div className="mt-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] text-red-400">
            {saveError}. Trening jest nadal zapisany na tym urządzeniu — spróbuj ponownie.
          </div>
        )}

        <div className="flex-1 space-y-2 pt-2 pb-4">
          {activeWorkout.trainerNote && (
            <div className="rounded-2xl bg-[#c8f53a]/[0.06] border border-[#c8f53a]/20 px-4 py-3 text-[13px] text-[#d8e8b0]">
              <div className="text-[11px] font-mono uppercase tracking-[1.5px] text-[#c8f53a] mb-0.5">Uwaga trenera do treningu</div>
              {activeWorkout.trainerNote}
            </div>
          )}
          {activeWorkout.exercises.length === 0 && !picking && (
            <p className="text-center text-[13px] text-[#666] py-8">Pusty trening — dodaj pierwsze ćwiczenie.</p>
          )}
          {activeWorkout.exercises.map((ex, i) => (
            <ExerciseCard key={ex.id} ex={ex} index={i} total={activeWorkout.exercises.length} label={labels[i]}
              expanded={ex.id === openId} onExpand={() => setExpandedId(ex.id)} onOpen={setExpandedId} />
          ))}

          {picking ? (
            <div className="rounded-2xl bg-[#111] border border-[#1e1e1e] p-3 space-y-2">
              <SupersetToggle partner={activeWorkout.exercises[activeWorkout.exercises.length - 1]?.name} checked={asSuperset} onChange={setAsSuperset} />
              <ExercisePicker accent="#c8f53a" onPick={addFromPicker} />
              <button onClick={() => setPicking(false)} className="w-full py-1.5 text-[12px] text-[#666] cursor-pointer">Anuluj</button>
            </div>
          ) : (
            <button onClick={() => setPicking(true)} className="w-full py-3 rounded-2xl border border-dashed border-[#2a2a2a] text-[13px] text-[#999] hover:text-[#c8f53a] hover:border-[#c8f53a]/40 cursor-pointer">
              + Dodaj ćwiczenie
            </button>
          )}

          <button onClick={cancel} className="w-full py-3 text-[12px] text-[#555] hover:text-red-400 cursor-pointer">Anuluj trening</button>
        </div>

        <RestBar />
      </div>
    </div>
  )
}
