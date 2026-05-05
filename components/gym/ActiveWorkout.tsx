'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  useWorkoutStore,
  selectProgress,
  selectTotalTonnage,
  type ExerciseEntry,
  type SetEntry,
} from '@/lib/stores/useWorkoutStore'

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const fmtTime = (totalSec: number) => {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// ─── SUB-KOMPONENTY ───────────────────────────────────────────────────────────

function LiveBar({ workout, elapsed, tonnage, completedSets }: {
  workout: { name: string; startedAt: number }
  elapsed: number
  tonnage: number
  completedSets: number
}) {
  const startedTime = new Date(workout.startedAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
  return (
    <div className="relative overflow-hidden border-b border-[#f5a03a]/15 bg-gradient-to-r from-[#f5a03a]/[0.05] to-[#f5a03a]/[0.01] px-7 py-2.5 flex justify-between items-center">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#f5a03a] to-transparent animate-[liveSlide_3s_ease-in-out_infinite]" />
      <div className="flex items-center gap-3.5">
        <div className="w-1.5 h-1.5 rounded-full bg-[#f5a03a] animate-[livePulse_1.5s_ease-in-out_infinite]" />
        <div>
          <div className="text-[10px] font-mono text-[#f5a03a] uppercase tracking-[2px] font-medium">Trening trwa</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-display text-[14px] font-black text-[#f0ece4]">{workout.name}</span>
            <span className="text-[11px] font-mono text-[#888]">· rozpoczęty {startedTime}</span>
          </div>
        </div>
      </div>
      <div className="flex gap-5 items-center">
        <Stat value={fmtTime(elapsed)} label="Czas" />
        <Stat value={String(completedSets)} label="Serie" />
        <Stat value={`${(tonnage / 1000).toFixed(1)}t`} label="Tonaż" />
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <span className="font-display text-[14px] font-black text-[#f0ece4] mr-1">{value}</span>
      <span className="text-[9px] font-mono text-[#444] uppercase tracking-wider">{label}</span>
    </div>
  )
}

function ExerciseBlock({
  exercise, index, isActive, isDone, onCompleteSet, onUpdateSet, onAddSet, onRemoveSet,
}: {
  exercise: ExerciseEntry
  index: number
  isActive: boolean
  isDone: boolean
  onCompleteSet: (setId: string) => void
  onUpdateSet: (setId: string, patch: Partial<SetEntry>) => void
  onAddSet: () => void
  onRemoveSet: (setId: string) => void
}) {
  const completedCount = exercise.sets.filter(s => s.done).length
  const targetCount = exercise.targetSets || exercise.sets.length

  return (
    <div className={`workout-exercise mb-2.5 rounded-xl overflow-hidden border transition-all duration-200 ${
      isActive  ? 'border-[#f5a03a]/30 bg-[#f5a03a]/[0.03]'
      : isDone  ? 'border-[#1c1c1c] bg-[#131313] opacity-50'
      :           'border-[#1c1c1c] bg-[#131313]'
    }`}>
      <div className="flex justify-between items-center px-3.5 py-3">
        <div className="flex items-center gap-2.5 flex-1">
          <div className={`w-6 h-6 rounded-md flex items-center justify-center font-mono text-[10px] font-medium flex-shrink-0 ${
            isActive ? 'bg-[#f5a03a]/15 text-[#f5a03a]'
            : isDone ? 'bg-[#c8f53a]/15 text-[#c8f53a]'
            :          'bg-[#1a1a1a] text-[#666]'
          }`}>
            {index + 1}
          </div>
          <div>
            <div className={`text-[13px] font-medium mb-0.5 ${isActive ? 'text-[#f0ece4]' : 'text-[#ccc]'}`}>
              {exercise.name}
            </div>
            <div className="text-[9px] font-mono text-[#444] uppercase tracking-wider">
              {targetCount} serii · cel: {targetCount}×{exercise.targetReps}{exercise.targetWeight ? ` @ ${exercise.targetWeight}kg` : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-mono text-[#666]">
            <strong className={isActive ? 'text-[#f5a03a]' : isDone ? 'text-[#c8f53a]' : 'text-[#888]'}>
              {completedCount}/{targetCount}
            </strong> serie
          </span>
          {isDone && <span className="text-[#c8f53a] text-sm">✓</span>}
        </div>
      </div>

      {isActive && (
        <div className="px-3.5 pb-3.5">
          <div className="grid grid-cols-[32px_1fr_1fr_70px_32px] gap-2 px-1 py-1.5 text-[8px] font-mono text-[#444] uppercase tracking-wider border-b border-[#1a1a1a] mb-1">
            <span>SER</span><span>KG</span><span>POWT</span><span>RPE</span><span />
          </div>
          {exercise.sets.map((set, i) => (
            <SetRow
              key={set.id} set={set} setNumber={i + 1}
              onComplete={() => onCompleteSet(set.id)}
              onUpdate={patch => onUpdateSet(set.id, patch)}
              onRemove={() => onRemoveSet(set.id)}
            />
          ))}
          <button
            onClick={onAddSet}
            className="w-full mt-1.5 py-2 px-2.5 rounded-lg bg-transparent border border-dashed border-[#2a2a2a] text-[#555] text-[11px] font-mono uppercase tracking-[1.2px] hover:border-[#f5a03a]/30 hover:text-[#f5a03a] hover:border-solid transition-all flex items-center justify-center gap-1.5"
          >
            + Dodaj serię
          </button>
        </div>
      )}
    </div>
  )
}

function SetRow({ set, setNumber, onComplete, onUpdate, onRemove }: {
  set: SetEntry
  setNumber: number
  onComplete: () => void
  onUpdate: (patch: Partial<SetEntry>) => void
  onRemove: () => void
}) {
  const checkRef = useRef<HTMLButtonElement>(null)

  const handleComplete = () => {
    if (set.done) return
    onComplete()
    if (checkRef.current) {
      gsap.fromTo(checkRef.current, { scale: 0.8 }, { scale: 1, duration: 0.35, ease: 'back.out(2)' })
    }
  }

  return (
    <div className={`grid grid-cols-[32px_1fr_1fr_70px_32px] gap-2 items-center px-1 py-1.5 transition-opacity ${set.done ? 'opacity-55' : ''}`}>
      <span className={`font-mono text-[11px] font-medium ${set.done ? 'text-[#666]' : 'text-[#f5a03a]'}`}>{setNumber}</span>
      <input
        type="number" inputMode="decimal" placeholder={set.weightKg?.toString() ?? '—'}
        value={set.weightKg ?? ''}
        onChange={e => onUpdate({ weightKg: e.target.value === '' ? null : Number(e.target.value) })}
        disabled={set.done}
        className="bg-[#0a0a0a] border border-[#1e1e1e] focus:border-[#f5a03a]/40 rounded-md px-2.5 py-1.5 text-[12px] text-[#f0ece4] font-mono outline-none transition-colors placeholder:text-[#333] disabled:text-[#666]"
      />
      <input
        type="number" inputMode="numeric" placeholder={set.reps?.toString() ?? '—'}
        value={set.reps ?? ''}
        onChange={e => onUpdate({ reps: e.target.value === '' ? null : Number(e.target.value) })}
        disabled={set.done}
        className="bg-[#0a0a0a] border border-[#1e1e1e] focus:border-[#f5a03a]/40 rounded-md px-2.5 py-1.5 text-[12px] text-[#f0ece4] font-mono outline-none transition-colors placeholder:text-[#333] disabled:text-[#666]"
      />
      <input
        type="number" step="0.5" min="1" max="10" placeholder="—"
        value={set.rpe ?? ''}
        onChange={e => onUpdate({ rpe: e.target.value === '' ? null : Number(e.target.value) })}
        disabled={set.done}
        className="bg-[#0a0a0a] border border-[#1e1e1e] focus:border-[#f5a03a]/40 rounded-md px-2 py-1.5 text-[11px] text-[#888] font-mono outline-none transition-colors placeholder:text-[#333]"
      />
      <button
        ref={checkRef}
        onClick={handleComplete}
        className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${
          set.done
            ? 'bg-[#c8f53a] border-[#c8f53a]'
            : 'bg-[#1a1a1a] border-[#2a2a2a] hover:border-[#444]'
        }`}
        aria-label={set.done ? 'Seria ukończona' : 'Oznacz serię jako ukończoną'}
      >
        {set.done && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="#080808" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      {!set.done && (
        <button
          onClick={onRemove}
          className="col-start-5 row-start-1 hidden group-hover:flex w-8 h-8 rounded-lg border border-[#1e1e1e] items-center justify-center text-[#444] hover:text-[#f5a03a] hover:border-[#f5a03a]/30 transition-all text-xs"
        >×</button>
      )}
    </div>
  )
}

function RestTimer() {
  const { restTimer, tickRestTimer, skipRestTimer, addRestTime } = useWorkoutStore()

  useEffect(() => {
    if (!restTimer.isActive) return
    const interval = setInterval(() => tickRestTimer(), 1000)
    return () => clearInterval(interval)
  }, [restTimer.isActive, tickRestTimer])

  useEffect(() => {
    if (restTimer.isActive && restTimer.remainingSeconds <= 0) {
      skipRestTimer()
    }
  }, [restTimer.remainingSeconds, restTimer.isActive, skipRestTimer])

  if (!restTimer.isActive) {
    return (
      <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-5 text-center">
        <div className="text-[10px] font-mono text-[#444] uppercase tracking-[2px] mb-2">Timer</div>
        <p className="text-[12px] text-[#555]">Ukończ serię żeby uruchomić odliczanie</p>
      </div>
    )
  }

  const radius = 60
  const circumference = 2 * Math.PI * radius
  const pct = restTimer.remainingSeconds / restTimer.totalSeconds
  const dashOffset = circumference * (1 - pct)

  return (
    <div className="bg-[#0f0f0f] border border-[#f5a03a]/18 rounded-2xl p-5 text-center relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#f5a03a]/40 to-transparent" />
      <div className="text-[9px] font-mono text-[#f5a03a] uppercase tracking-[2px] mb-2.5 flex items-center justify-center gap-1.5">
        <span className="w-1 h-1 rounded-full bg-[#f5a03a] animate-pulse" />
        Odpoczynek
      </div>
      <div className="relative w-[140px] h-[140px] mx-auto mb-3">
        <svg className="w-full h-full -rotate-90">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="#1a1a1a" strokeWidth="6" />
          <circle cx="70" cy="70" r={radius} fill="none" stroke="#f5a03a" strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-display text-[32px] font-black text-[#f0ece4] leading-none">
            {fmtTime(restTimer.remainingSeconds)}
          </div>
          <div className="text-[9px] font-mono text-[#444] mt-1">z {fmtTime(restTimer.totalSeconds)}</div>
        </div>
      </div>
      <div className="flex gap-1.5 justify-center">
        <button onClick={skipRestTimer} className="px-3.5 py-1.5 rounded-lg bg-transparent border border-[#2a2a2a] text-[#888] text-[10px] font-mono uppercase tracking-[1.2px] hover:border-[#444] hover:text-[#ccc] transition-all">
          Pomiń
        </button>
        <button onClick={() => addRestTime(30)} className="px-3.5 py-1.5 rounded-lg bg-[#1a1a1a] text-[#ccc] text-[10px] font-mono uppercase tracking-[1.2px] hover:bg-[#222] transition-all">
          +30s
        </button>
      </div>
    </div>
  )
}

// ─── GŁÓWNY KOMPONENT ─────────────────────────────────────────────────────────

export default function ActiveWorkout() {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const [elapsed, setElapsed] = useState(0)

  const { activeWorkout, completeSet, updateSet, addSet, removeSet, finishWorkout, cancelWorkout } = useWorkoutStore()
  const progress = useWorkoutStore(selectProgress)
  const tonnage  = useWorkoutStore(selectTotalTonnage)

  useEffect(() => {
    if (!activeWorkout) return
    const tick = () => setElapsed(Math.floor((Date.now() - activeWorkout.startedAt) / 1000))
    tick()
    const i = setInterval(tick, 1000)
    return () => clearInterval(i)
  }, [activeWorkout])

  useGSAP(() => {
    if (!activeWorkout) return
    const tl = gsap.timeline({ delay: 0.05 })
    tl.from('.live-bar-anim', { opacity: 0, y: -12, duration: 0.45, ease: 'expo.out' })
    tl.from('.workout-topbar', { opacity: 0, y: -8, duration: 0.4, ease: 'expo.out' }, '-=0.25')
    tl.from(['.workout-area', '.workout-side > *'], { opacity: 0, y: 14, duration: 0.5, stagger: 0.08, ease: 'expo.out' }, '-=0.25')
    tl.from('.workout-exercise', { opacity: 0, x: -10, duration: 0.4, stagger: 0.06, ease: 'expo.out' }, '-=0.3')
  }, { scope: containerRef, dependencies: [activeWorkout?.id] })

  if (!activeWorkout) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#080808] text-[#f0ece4]">
        <div className="text-center max-w-md px-6">
          <div className="font-display text-[28px] font-black mb-3">Brak aktywnego treningu</div>
          <p className="text-[14px] text-[#666] mb-6">Wróć do siłowni i wybierz szablon żeby zacząć sesję.</p>
          <button onClick={() => router.push('/gym')} className="px-6 py-3 rounded-xl bg-[#f5a03a] text-[#080808] font-mono text-[12px] uppercase tracking-[1.5px] font-medium hover:bg-[#ffb04a] transition-all">
            Przejdź do siłowni →
          </button>
        </div>
      </div>
    )
  }

  const activeExerciseId = activeWorkout.exercises.find(ex => {
    const target = ex.targetSets || ex.sets.length
    return ex.sets.filter(s => s.done).length < target
  })?.id

  const completedSets = activeWorkout.exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.done).length, 0)

  const handleFinish = async () => {
    const final = finishWorkout()
    if (!final) return

    try {
      await fetch('/api/gym/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(final),
      })
    } catch {
      // zapisz lokalnie jeśli offline
    }

    router.push('/gym/history')
  }

  const handleCancel = () => {
    if (!confirm('Czy na pewno chcesz anulować trening? Wszystkie zalogowane serie zostaną stracone.')) return
    cancelWorkout()
    router.push('/gym')
  }

  return (
    <div ref={containerRef} className="flex h-screen bg-[#080808] text-[#f0ece4] font-sans overflow-hidden">
      <main className="flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

        <div className="live-bar-anim">
          <LiveBar workout={activeWorkout} elapsed={elapsed} tonnage={tonnage} completedSets={completedSets} />
        </div>

        <div className="workout-topbar px-7 pt-5 pb-2 flex justify-between items-end">
          <div>
            <p className="text-[10px] font-mono text-[#444] uppercase tracking-[2px] mb-1">Siłownia · aktywna sesja</p>
            <h1 className="font-display text-[22px] font-black">
              {activeWorkout.name.split('·').map((part, i) => (
                <span key={i}>
                  {i === 0 ? part : <em className="not-italic text-[#f5a03a]">·{part}</em>}
                </span>
              ))}
            </h1>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCancel} className="px-4 py-2 rounded-lg bg-[#111] border border-[#1e1e1e] text-[#888] text-[11px] font-mono uppercase tracking-[1.3px] hover:border-[#333] hover:text-[#ccc] transition-all">
              Anuluj
            </button>
            <button onClick={handleFinish} className="px-4 py-2 rounded-lg bg-[#f5a03a] text-[#080808] text-[11px] font-mono uppercase tracking-[1.3px] font-medium hover:bg-[#ffb04a] hover:-translate-y-px transition-all">
              Zakończ trening
            </button>
          </div>
        </div>

        <div className="px-7 pt-3 pb-7">
          <div className="grid grid-cols-[1fr_320px] gap-3.5">

            {/* WORKOUT AREA */}
            <div className="workout-area bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-5 min-h-[560px]">
              <div className="flex justify-between items-start mb-4 pb-3.5 border-b border-[#161616]">
                <div>
                  <div className="font-display text-[18px] font-black text-[#f0ece4] mb-0.5">{activeWorkout.name}</div>
                  <div className="text-[10px] font-mono text-[#666]">
                    {activeWorkout.exercises.length} ćwiczeń · {progress.done}/{progress.total} serii ukończonych
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="font-display text-[24px] font-black text-[#f5a03a]">{progress.pct}%</div>
                  <div className="text-[9px] font-mono text-[#444] uppercase tracking-[1.5px]">Postęp</div>
                </div>
              </div>

              {activeWorkout.exercises.map((ex, idx) => {
                const target = ex.targetSets || ex.sets.length
                const doneCount = ex.sets.filter(s => s.done).length
                const isDone = target > 0 && doneCount >= target
                const isActive = ex.id === activeExerciseId

                return (
                  <ExerciseBlock
                    key={ex.id} exercise={ex} index={idx}
                    isActive={isActive} isDone={isDone}
                    onCompleteSet={(setId) => completeSet(ex.id, setId)}
                    onUpdateSet={(setId, patch) => updateSet(ex.id, setId, patch)}
                    onAddSet={() => addSet(ex.id)}
                    onRemoveSet={(setId) => removeSet(ex.id, setId)}
                  />
                )
              })}

              <button
                onClick={() => router.push('/gym/exercises?selectFor=' + activeWorkout.id)}
                className="w-full flex items-center justify-center gap-2 py-3.5 mt-2.5 rounded-xl bg-transparent border border-dashed border-[#1e1e1e] text-[#555] text-[11px] font-mono uppercase tracking-[1.5px] hover:border-[#f5a03a]/30 hover:text-[#f5a03a] hover:bg-[#f5a03a]/[0.02] hover:border-solid transition-all"
              >
                + Dodaj ćwiczenie
              </button>
            </div>

            {/* SIDE PANEL */}
            <div className="workout-side flex flex-col gap-3">
              <RestTimer />

              <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[11px] font-mono text-[#888] uppercase tracking-[1.5px] font-medium">Historia</span>
                </div>
                <p className="text-[11px] text-[#555] leading-relaxed">
                  Podłącz Supabase żeby zobaczyć poprzednie wyniki dla aktywnego ćwiczenia.
                </p>
              </div>

              <div className="bg-[#0f0f0f] border border-[#c8f53a]/18 rounded-2xl p-4 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c8f53a]/40 to-transparent" />
                <div className="text-[9px] font-mono text-[#c8f53a] uppercase tracking-[2px] mb-2.5">Możliwy PR…</div>
                <p className="text-[11px] text-[#666]">Po 6 sesjach AI policzy szacowany 1RM</p>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}
