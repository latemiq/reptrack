'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { TemplateExercise, WorkoutTemplate } from '@/lib/templates'
import { relativeDay } from '@/lib/stats'
import { fmtKg } from '@/lib/gym-stats'
import { moveKeepingSupersets, removeKeepingSupersets, supersetLabels } from '@/lib/plans'
import ExercisePicker from '@/components/gym/ExercisePicker'
import GymTabs from '@/components/gym/GymTabs'
import SupersetToggle from '@/components/gym/SupersetToggle'
import WarmupEditor from '@/components/gym/WarmupEditor'
import type { WarmupItem } from '@/lib/warmup'

interface Draft {
  id: string | null
  name: string
  exercises: TemplateExercise[]
  warmup: WarmupItem[]
}

const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300]
const fmtRest = (s: number) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : 'brak')
const repsLabel = (e: TemplateExercise) => (e.targetRepsMax && e.targetRepsMax !== e.targetReps ? `${e.targetReps}–${e.targetRepsMax}` : String(e.targetReps))

/** Rough session length: each set ≈ 45 s of work plus the rest after it. */
const estimateMinutes = (ex: TemplateExercise[]) => Math.round(ex.reduce((s, e) => s + e.targetSets * (45 + e.restSeconds), 0) / 60)

const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex-1 min-w-0 rounded-lg bg-[#0a0a0a] border border-[#222] focus-within:border-[#c8f53a]/50 px-2 py-1 text-center">
      <span className="block text-[11px] text-[#666]">{label}</span>
      {children}
    </label>
  )
}

const cell = 'w-full bg-transparent text-center text-[15px] text-[#f0ece4] outline-none'

/** Templates: list → editor with draggable exercise cards and per-exercise sets/reps/kg/rest. */
export default function TemplatesEditor() {
  const router = useRouter()
  const params = useSearchParams()
  const [templates, setTemplates] = useState<WorkoutTemplate[] | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [openIdx, setOpenIdx] = useState<number | null>(0)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [asSuperset, setAsSuperset] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() =>
    fetch('/api/gym/templates')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => setTemplates(d.templates as WorkoutTemplate[]))
      .catch(() => { setTemplates([]); setError('Nie udało się wczytać szablonów.') }), [])

  useEffect(() => { load() }, [load])

  // Deep links from the gym home: ?new=1 or ?edit=<id>.
  useEffect(() => {
    if (!templates || draft) return
    const editId = params.get('edit')
    const t = editId ? templates.find(x => x.id === editId) : null
    if (t) { setDraft({ id: t.id, name: t.name, exercises: t.exercises, warmup: t.warmup ?? [] }); setOpenIdx(null) }
    else if (params.get('new')) { setDraft({ id: null, name: '', exercises: [], warmup: [] }); setOpenIdx(null) }
  }, [templates, params, draft])

  const close = () => { setDraft(null); setError(''); router.replace('/gym/templates') }

  const patchEx = (idx: number, p: Partial<TemplateExercise>) =>
    setDraft(d => d && { ...d, exercises: d.exercises.map((e, i) => (i === idx ? { ...e, ...p } : e)) })

  const move = (from: number, to: number) => setDraft(d => d && { ...d, exercises: moveKeepingSupersets(d.exercises, from, to) })

  const save = async () => {
    if (!draft) return
    if (!draft.name.trim()) { setError('Podaj nazwę szablonu.'); return }
    if (draft.exercises.length === 0) { setError('Dodaj co najmniej jedno ćwiczenie.'); return }
    setSaving(true)
    setError('')
    const res = await fetch(draft.id ? `/api/gym/templates/${draft.id}` : '/api/gym/templates', {
      method: draft.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: draft.name, exercises: draft.exercises, warmup: draft.warmup }),
    }).catch(() => null)
    setSaving(false)
    if (!res?.ok) { setError((await res?.json().catch(() => null))?.error ?? 'Zapis nie powiódł się.'); return }
    await load()
    close()
  }

  const remove = async () => {
    if (!draft?.id || !confirm(`Usunąć szablon „${draft.name}”?`)) return
    const res = await fetch(`/api/gym/templates/${draft.id}`, { method: 'DELETE' }).catch(() => null)
    if (!res?.ok) { setError('Nie udało się usunąć szablonu.'); return }
    await load()
    close()
  }

  // ── Editor ──
  if (draft) {
    const totalSets = draft.exercises.reduce((s, e) => s + e.targetSets, 0)
    const labels = supersetLabels(draft.exercises)
    return (
      <div className="min-h-full bg-[#080808] text-[#f0ece4]">
        <div className="max-w-2xl mx-auto px-4 md:px-7 pt-4 md:pt-6 pb-8 space-y-3">
          <div className="flex items-center gap-2">
            <button onClick={close} aria-label="Wróć do listy" className="w-9 h-9 rounded-xl text-[#888] hover:text-[#f0ece4] cursor-pointer">‹</button>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-mono text-[#666] uppercase tracking-[1.5px]">{draft.id ? 'Szablon' : 'Nowy szablon'}</p>
              <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Nazwa, np. Push A" autoFocus={!draft.id}
                className="w-full bg-transparent font-display text-[22px] font-black outline-none placeholder:text-[#333]" />
            </div>
            <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl bg-[#c8f53a] text-[#0f1a00] text-[13px] font-medium disabled:opacity-60 cursor-pointer">
              {saving ? 'Zapisuję…' : 'Zapisz'}
            </button>
          </div>
          <p className="text-[12px] text-[#777] px-1">
            {draft.exercises.length} ćw · ~{estimateMinutes(draft.exercises)} min · {totalSets} serii
          </p>

          {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] text-red-400">{error}</div>}

          <WarmupEditor value={draft.warmup} onChange={warmup => setDraft(d => d && { ...d, warmup })} />

          <div>
            {draft.exercises.map((ex, i) => {
              const open = openIdx === i
              return (
                <Fragment key={`${ex.exerciseId}-${i}`}>
                {i > 0 && (
                  <div className="flex justify-center h-7 items-center">
                    <button onClick={() => patchEx(i, { superset: !ex.superset })}
                      title={ex.superset ? 'Rozłącz superserię' : 'Połącz z ćwiczeniem wyżej w superserię'}
                      className={`px-2.5 py-0.5 rounded-md text-[11px] border cursor-pointer transition-colors ${
                        ex.superset ? 'bg-[#f5a03a]/10 border-[#f5a03a]/40 text-[#f5a03a]' : 'border-transparent text-[#444] hover:text-[#f5a03a] hover:border-[#f5a03a]/30'
                      }`}>
                      {ex.superset ? '⛓ superseria · rozłącz' : '+ superseria'}
                    </button>
                  </div>
                )}
                <div
                  draggable onDragStart={() => setDragIdx(i)} onDragEnd={() => setDragIdx(null)}
                  onDragOver={e => { e.preventDefault(); if (dragIdx != null && dragIdx !== i) { move(dragIdx, i); setDragIdx(i) } }}
                  className={`rounded-2xl bg-[#111] border p-3 transition-colors ${open ? 'border-[#c8f53a]/25' : labels[i] ? 'border-[#f5a03a]/25' : 'border-[#1e1e1e]'} ${dragIdx === i ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className="cursor-grab text-[#555] select-none px-1" aria-hidden="true">⠿</span>
                    <button onClick={() => setOpenIdx(open ? null : i)} className="flex-1 min-w-0 flex items-center gap-2 text-left cursor-pointer">
                      {labels[i] && <span className="shrink-0 px-1.5 py-0.5 rounded bg-[#f5a03a]/15 text-[#f5a03a] text-[11px] font-mono">{labels[i]}</span>}
                      <span className="flex-1 min-w-0 truncate text-[14px]">{ex.name}</span>
                      {!open && <span className="text-[12px] text-[#777]">{ex.targetSets}×{repsLabel(ex)}{ex.targetWeight ? ` · ${fmtKg(ex.targetWeight)} kg` : ''}</span>}
                    </button>
                    <div className="flex">
                      <button onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Wyżej" className="w-7 h-7 text-[#555] hover:text-[#f0ece4] disabled:opacity-20 cursor-pointer">↑</button>
                      <button onClick={() => move(i, i + 1)} disabled={i === draft.exercises.length - 1} aria-label="Niżej" className="w-7 h-7 text-[#555] hover:text-[#f0ece4] disabled:opacity-20 cursor-pointer">↓</button>
                      <button onClick={() => setDraft({ ...draft, exercises: removeKeepingSupersets(draft.exercises, i) })} aria-label={`Usuń ${ex.name}`}
                        className="w-7 h-7 text-[#555] hover:text-red-400 cursor-pointer">×</button>
                    </div>
                  </div>
                  {open && (
                    <div className="flex gap-1.5 mt-2.5 pl-6">
                      <Field label="serie">
                        <input inputMode="numeric" className={cell} value={ex.targetSets}
                          onChange={e => patchEx(i, { targetSets: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} />
                      </Field>
                      <Field label="powt.">
                        <div className="flex items-center">
                          <input inputMode="numeric" className={cell} value={ex.targetReps} aria-label="Powtórzenia od"
                            onChange={e => patchEx(i, { targetReps: Math.max(1, Number(e.target.value) || 1) })} />
                          <span className="text-[#555]">–</span>
                          <input inputMode="numeric" className={cell} value={ex.targetRepsMax ?? ''} placeholder="do" aria-label="Powtórzenia do"
                            onChange={e => patchEx(i, { targetRepsMax: numOrNull(e.target.value) })} />
                        </div>
                      </Field>
                      <Field label="kg">
                        <input inputMode="decimal" className={cell} value={ex.targetWeight ?? ''} placeholder="—"
                          onChange={e => patchEx(i, { targetWeight: numOrNull(e.target.value) })} />
                      </Field>
                      <Field label="przerwa">
                        <select className={`${cell} appearance-none cursor-pointer`} value={ex.restSeconds}
                          onChange={e => patchEx(i, { restSeconds: Number(e.target.value) })}>
                          {REST_OPTIONS.map(s => <option key={s} value={s} className="bg-[#111]">{fmtRest(s)}</option>)}
                        </select>
                      </Field>
                    </div>
                  )}
                </div>
                </Fragment>
              )
            })}
          </div>

          <div className="rounded-2xl border border-dashed border-[#2a2a2a] p-3 space-y-2">
            <SupersetToggle partner={draft.exercises[draft.exercises.length - 1]?.name} checked={asSuperset} onChange={setAsSuperset} />
            <ExercisePicker accent="#c8f53a" showGroups onPick={pick => {
              setDraft(d => {
                if (!d) return d
                const partner = asSuperset ? d.exercises[d.exercises.length - 1] : undefined
                return { ...d, exercises: [...d.exercises, {
                  exerciseId: pick.id, name: pick.name, targetSets: partner?.targetSets ?? 3, targetReps: 8, targetRepsMax: 10, targetWeight: null,
                  restSeconds: partner?.restSeconds ?? 120, superset: !!partner,
                }] }
              })
              setAsSuperset(false)
              setOpenIdx(draft.exercises.length)
            }} />
          </div>

          {draft.id && (
            <button onClick={remove} className="w-full py-3 text-[12px] text-[#555] hover:text-red-400 cursor-pointer">Usuń szablon</button>
          )}
        </div>
      </div>
    )
  }

  // ── List ──
  return (
    <div className="min-h-full bg-[#080808] text-[#f0ece4]">
      <div className="max-w-2xl mx-auto px-4 md:px-7 pt-4 md:pt-6 pb-8 space-y-4">
        <GymTabs />
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-mono text-[#666] uppercase tracking-[1.5px]">Siłownia</p>
            <h1 className="font-display text-[24px] font-black leading-tight">Szablony</h1>
          </div>
          <button onClick={() => { setDraft({ id: null, name: '', exercises: [], warmup: [] }); setOpenIdx(null) }}
            className="px-4 py-2 rounded-xl bg-[#c8f53a] text-[#0f1a00] text-[13px] font-medium cursor-pointer">+ Nowy</button>
        </div>

        {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] text-red-400">{error}</div>}

        <div className="space-y-2">
          {templates === null && [0, 1, 2].map(i => <div key={i} className="h-[76px] rounded-2xl bg-[#0f0f0f] border border-[#1a1a1a] animate-pulse" />)}
          {templates?.length === 0 && !error && <p className="text-center py-10 text-[13px] text-[#555]">Nie masz jeszcze szablonów.</p>}
          {templates?.map(t => (
            <button key={t.id} onClick={() => { setDraft({ id: t.id, name: t.name, exercises: t.exercises, warmup: t.warmup ?? [] }); setOpenIdx(null) }}
              className="w-full text-left rounded-2xl bg-[#111] border border-[#1e1e1e] hover:border-[#2a2a2a] px-4 py-3 cursor-pointer">
              <div className="flex items-baseline gap-2">
                <span className="flex-1 min-w-0 truncate text-[15px] font-medium">{t.name}</span>
                <span className="text-[12px] text-[#777] flex-shrink-0">{t.last_used_at ? relativeDay(t.last_used_at) : 'nowy'}</span>
              </div>
              <div className="text-[12px] text-[#777] mt-1 line-clamp-2">
                {t.exercises.map(e => `${e.name} ${e.targetSets}×${repsLabel(e)}`).join(' · ')}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
