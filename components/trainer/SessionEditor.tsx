'use client'

import { Fragment, useState } from 'react'
import ExercisePicker from '@/components/gym/ExercisePicker'
import { DAY_LABELS, moveKeepingSupersets, removeKeepingSupersets, supersetLabels, type PlannedExercise, type PlannedSession } from '@/lib/plans'

interface Props {
  session: PlannedSession
  weekLabel: string
  remainingWeeks: number
  onChange: (s: PlannedSession) => void
  onDelete: () => void
  onDuplicate: () => void
  /** Copies this session into the following weeks of the block, adding weightStep kg per week. */
  onPropagate: (weightStep: number) => void
  onClose: () => void
}

const num = (v: string) => (v === '' ? null : Number(v))

export default function SessionEditor({ session, weekLabel, remainingWeeks, onChange, onDelete, onDuplicate, onPropagate, onClose }: Props) {
  const [step, setStep] = useState('2.5')

  const patch = (p: Partial<PlannedSession>) => onChange({ ...session, ...p })
  const patchEx = (idx: number, p: Partial<PlannedExercise>) =>
    patch({ exercises: session.exercises.map((e, i) => (i === idx ? { ...e, ...p } : e)) })
  const moveEx = (idx: number, dir: -1 | 1) => patch({ exercises: moveKeepingSupersets(session.exercises, idx, idx + dir) })
  const removeEx = (idx: number) => patch({ exercises: removeKeepingSupersets(session.exercises, idx) })
  const labels = supersetLabels(session.exercises)

  const field = 'bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-2 py-1.5 text-[12px] text-[#f0ece4] placeholder:text-[#333] focus:outline-none focus:border-[#c8f53a]/40'
  const cell = `${field} w-full text-center font-mono`
  const head = 'text-[8px] font-mono uppercase tracking-[1.2px] text-[#444] text-center'

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <aside className="relative w-full max-w-[760px] h-full bg-[#0c0c0c] border-l border-[#1e1e1e] overflow-y-auto">
        <div className="sticky top-0 z-10 bg-[#0c0c0c] border-b border-[#1a1a1a] px-5 py-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono text-[#444] uppercase tracking-[2px]">{weekLabel} · {DAY_LABELS[session.dayOfWeek - 1]}</p>
            <input value={session.name} onChange={e => patch({ name: e.target.value })} placeholder="Nazwa sesji, np. Push A"
              className="w-full bg-transparent font-display text-[20px] font-black text-[#f0ece4] focus:outline-none placeholder:text-[#333]" />
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-[#111] border border-[#1e1e1e] text-[#888] hover:text-[#f0ece4] cursor-pointer" aria-label="Zamknij">×</button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex flex-wrap gap-1.5">
            {DAY_LABELS.map((d, i) => (
              <button key={d} onClick={() => patch({ dayOfWeek: i + 1 })}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-mono border cursor-pointer transition-colors ${
                  session.dayOfWeek === i + 1 ? 'bg-[#c8f53a]/10 border-[#c8f53a]/40 text-[#c8f53a]' : 'border-[#1e1e1e] text-[#666] hover:text-[#ccc]'
                }`}>{d}</button>
            ))}
          </div>

          <div>
            <div className="hidden md:grid grid-cols-[1fr_44px_44px_44px_56px_52px_44px_56px_54px] gap-1.5 px-2 mb-1.5">
              <span className="text-[8px] font-mono uppercase tracking-[1.2px] text-[#444]">Ćwiczenie</span>
              <span className={head}>Serie</span>
              <span className={head}>Powt. od</span>
              <span className={head}>do</span>
              <span className={head}>kg</span>
              <span className={head}>%1RM</span>
              <span className={head}>RPE</span>
              <span className={head}>Przerwa s</span>
              <span />
            </div>

            <div>
              {session.exercises.map((e, i) => (
                <Fragment key={i}>
                {i > 0 && (
                  <div className="flex items-center justify-center h-6">
                    <button onClick={() => patchEx(i, { superset: !e.superset })}
                      title={e.superset ? 'Rozłącz superserię' : 'Połącz z ćwiczeniem wyżej w superserię'}
                      className={`px-2 py-0.5 rounded-md text-[9px] font-mono uppercase tracking-[1.2px] border cursor-pointer transition-colors ${
                        e.superset ? 'bg-[#f5a03a]/10 border-[#f5a03a]/40 text-[#f5a03a] hover:bg-[#f5a03a]/20' : 'border-transparent text-[#3a3a3a] hover:text-[#f5a03a] hover:border-[#f5a03a]/30'
                      }`}>
                      {e.superset ? '⛓ superseria · rozłącz' : '+ superseria'}
                    </button>
                  </div>
                )}
                <div className={`bg-[#131313] border rounded-xl p-2 space-y-1.5 ${labels[i] ? 'border-[#f5a03a]/30' : 'border-[#1c1c1c]'}`}>
                  <div className="grid grid-cols-4 md:grid-cols-[1fr_44px_44px_44px_56px_52px_44px_56px_54px] gap-1.5 items-center">
                    <span className="col-span-4 md:col-span-1 text-[12px] text-[#ddd] truncate px-1" title={e.name}>
                      {labels[i] && <span className="mr-1.5 px-1.5 py-0.5 rounded bg-[#f5a03a]/15 text-[#f5a03a] text-[10px] font-mono">{labels[i]}</span>}
                      {i + 1}. {e.name}
                    </span>
                    <input type="number" min={1} max={20} aria-label="Serie" value={e.sets} onChange={ev => patchEx(i, { sets: Math.max(1, Number(ev.target.value) || 1) })} className={cell} />
                    <input type="number" min={1} aria-label="Powtórzenia od" value={e.repsMin ?? ''} placeholder="—" onChange={ev => patchEx(i, { repsMin: num(ev.target.value) })} className={cell} />
                    <input type="number" min={1} aria-label="Powtórzenia do" value={e.repsMax ?? ''} placeholder="—" onChange={ev => patchEx(i, { repsMax: num(ev.target.value) })} className={cell} />
                    <input type="number" min={0} step={0.5} aria-label="Ciężar kg" value={e.weightKg ?? ''} placeholder="—" onChange={ev => patchEx(i, { weightKg: num(ev.target.value) })} className={cell} />
                    <input type="number" min={1} max={120} aria-label="Procent 1RM" value={e.percent1rm ?? ''} placeholder="—" onChange={ev => patchEx(i, { percent1rm: num(ev.target.value) })} className={cell} />
                    <input type="number" min={1} max={10} step={0.5} aria-label="RPE" value={e.rpe ?? ''} placeholder="—" onChange={ev => patchEx(i, { rpe: num(ev.target.value) })} className={cell} />
                    <input type="number" min={0} step={15} aria-label="Przerwa w sekundach" value={e.restSeconds ?? ''} placeholder="—" onChange={ev => patchEx(i, { restSeconds: num(ev.target.value) })} className={cell} />
                    <div className="flex justify-end">
                      <button onClick={() => moveEx(i, -1)} className="w-5 h-6 text-[#555] hover:text-[#f0ece4] cursor-pointer" aria-label="W górę">↑</button>
                      <button onClick={() => moveEx(i, 1)} className="w-5 h-6 text-[#555] hover:text-[#f0ece4] cursor-pointer" aria-label="W dół">↓</button>
                      <button onClick={() => removeEx(i)} className="w-5 h-6 text-[#555] hover:text-red-400 cursor-pointer" aria-label="Usuń">×</button>
                    </div>
                  </div>
                  <input value={e.notes} onChange={ev => patchEx(i, { notes: ev.target.value })} placeholder="Uwagi techniczne, tempo, wariant…"
                    className={`${field} w-full text-[11px]`} />
                </div>
                </Fragment>
              ))}
            </div>

            <div className="mt-2">
              <ExercisePicker accent="#c8f53a" onPick={ex => patch({
                exercises: [...session.exercises, {
                  exerciseId: ex.id, name: ex.name, sets: 3, repsMin: 8, repsMax: 10,
                  weightKg: null, percent1rm: null, rpe: null, restSeconds: 120, notes: '',
                }],
              })} />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[2px] text-[#555] mb-2">Uwagi do sesji</label>
            <textarea rows={2} value={session.notes} onChange={e => patch({ notes: e.target.value })} placeholder="Rozgrzewka, cel sesji…"
              className={`${field} w-full text-[13px] px-3 py-2 resize-none`} />
          </div>

          {remainingWeeks > 0 && (
            <div className="bg-[#0f0f0f] border border-[#c8f53a]/15 rounded-xl p-4 space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-[2px] text-[#444]">Progresja w bloku</p>
              <p className="text-[11px] text-[#777]">
                Skopiuj tę sesję na kolejne {remainingWeeks} {remainingWeeks === 1 ? 'tydzień' : 'tygodnie'} bloku (zastąpi sesję o tej samej nazwie i dniu), dodając ciężar co tydzień.
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#888]">+</span>
                <input type="number" step={0.5} value={step} onChange={e => setStep(e.target.value)} className={`${field} w-20 text-center font-mono`} aria-label="Przyrost kg na tydzień" />
                <span className="text-[11px] text-[#888]">kg / tydzień</span>
                <button onClick={() => onPropagate(Number(step) || 0)}
                  className="ml-auto px-3 py-2 rounded-lg text-[10px] font-mono uppercase tracking-[1.3px] bg-[#c8f53a]/10 border border-[#c8f53a]/30 text-[#c8f53a] hover:bg-[#c8f53a]/20 cursor-pointer">
                  Zastosuj
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2 border-t border-[#1a1a1a]">
            <button onClick={onDuplicate} className="text-[10px] font-mono uppercase tracking-[1.3px] text-[#888] hover:text-[#f0ece4] cursor-pointer">Duplikuj sesję</button>
            <button onClick={onDelete} className="ml-auto text-[10px] font-mono uppercase tracking-[1.3px] text-[#555] hover:text-red-400 cursor-pointer">Usuń sesję</button>
          </div>
        </div>
      </aside>
    </div>
  )
}
