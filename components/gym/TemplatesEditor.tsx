'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TemplateExercise, WorkoutTemplate } from '@/lib/templates'
import ExercisePicker from '@/components/gym/ExercisePicker'

interface Draft {
  id: string | null
  name: string
  exercises: TemplateExercise[]
}

const emptyDraft = (): Draft => ({ id: null, name: '', exercises: [] })

export default function TemplatesEditor() {
  const router = useRouter()
  const [templates, setTemplates] = useState<WorkoutTemplate[] | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () =>
    fetch('/api/gym/templates')
      .then(async r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => setTemplates(d.templates))
      .catch(() => { setTemplates([]); setError('Nie udało się wczytać szablonów.') })

  useEffect(() => { load() }, [])

  const updateExercise = (idx: number, patch: Partial<TemplateExercise>) =>
    setDraft(d => d && { ...d, exercises: d.exercises.map((e, i) => (i === idx ? { ...e, ...patch } : e)) })

  const moveExercise = (idx: number, dir: -1 | 1) =>
    setDraft(d => {
      if (!d) return d
      const j = idx + dir
      if (j < 0 || j >= d.exercises.length) return d
      const arr = [...d.exercises]
      ;[arr[idx], arr[j]] = [arr[j], arr[idx]]
      return { ...d, exercises: arr }
    })

  const handleSave = async () => {
    if (!draft) return
    if (!draft.name.trim()) { setError('Podaj nazwę szablonu'); return }
    if (draft.exercises.length === 0) { setError('Dodaj co najmniej jedno ćwiczenie'); return }
    setSaving(true)
    setError('')
    const res = await fetch(draft.id ? `/api/gym/templates/${draft.id}` : '/api/gym/templates', {
      method: draft.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: draft.name, exercises: draft.exercises }),
    }).catch(() => null)
    setSaving(false)
    if (!res?.ok) {
      const data = await res?.json().catch(() => ({}))
      setError(data?.error ?? 'Zapis nie powiódł się')
      return
    }
    setDraft(null)
    load()
  }

  const handleDelete = async (t: WorkoutTemplate) => {
    if (!confirm(`Usunąć szablon „${t.name}”?`)) return
    const res = await fetch(`/api/gym/templates/${t.id}`, { method: 'DELETE' }).catch(() => null)
    if (res?.ok) setTemplates(ts => (ts ?? []).filter(x => x.id !== t.id))
    else setError('Nie udało się usunąć szablonu')
  }

  const num = 'w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-2 py-1.5 text-[12px] text-[#f0ece4] focus:outline-none focus:border-[#f5a03a]/40'

  return (
    <div className="min-h-full bg-[#080808] text-[#f0ece4]">
      <div className="px-4 md:px-7 pt-5 md:pt-6 pb-2 flex flex-wrap gap-3 justify-between items-end">
        <div>
          <button onClick={() => router.push('/gym')} className="text-[10px] font-mono text-[#444] uppercase tracking-[2px] mb-1 hover:text-[#f5a03a]">← Siłownia</button>
          <h1 className="font-display text-[24px] font-black">Szablony <em className="not-italic text-[#f5a03a]">treningów</em></h1>
        </div>
        {!draft && (
          <button onClick={() => { setDraft(emptyDraft()); setError('') }}
            className="px-4 py-2 rounded-lg bg-[#f5a03a] text-[#080808] text-[11px] font-mono uppercase tracking-[1.3px] font-medium hover:bg-[#ffb04a] transition-all">
            + Nowy szablon
          </button>
        )}
      </div>

      <div className="px-4 md:px-7 pb-7 pt-3 space-y-3 max-w-3xl">
        {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] text-red-400">{error}</div>}

        {draft && (
          <div className="bg-[#0f0f0f] border border-[#f5a03a]/20 rounded-2xl p-5 space-y-4">
            <div>
              <label className="block text-[9px] font-mono uppercase tracking-[1.5px] text-[#555] mb-1.5">Nazwa</label>
              <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}
                placeholder="np. Upper body A"
                className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-sm text-[#f0ece4] placeholder:text-[#444] focus:outline-none focus:border-[#f5a03a]/40" />
            </div>

            <div>
              <label className="block text-[9px] font-mono uppercase tracking-[1.5px] text-[#555] mb-1.5">Ćwiczenia</label>
              {draft.exercises.length > 0 && (
                <div className="space-y-2 mb-3">
                  <div className="hidden sm:grid grid-cols-[1fr_56px_56px_64px_64px_60px] gap-2 px-1 text-[8px] font-mono uppercase tracking-wider text-[#444]">
                    <span>Ćwiczenie</span><span>Serie</span><span>Powt.</span><span>Kg</span><span>Przerwa s</span><span />
                  </div>
                  {draft.exercises.map((ex, i) => (
                    <div key={`${ex.exerciseId}-${i}`} className="grid grid-cols-[1fr_56px_56px_64px_64px_60px] gap-2 items-center bg-[#131313] border border-[#1c1c1c] rounded-xl p-2">
                      <span className="text-[12px] text-[#ccc] truncate px-1">{ex.name}</span>
                      <input type="number" min={1} value={ex.targetSets} onChange={e => updateExercise(i, { targetSets: Number(e.target.value) })} className={num} />
                      <input type="number" min={1} value={ex.targetReps} onChange={e => updateExercise(i, { targetReps: Number(e.target.value) })} className={num} />
                      <input type="number" min={0} step={0.5} placeholder="—" value={ex.targetWeight ?? ''} onChange={e => updateExercise(i, { targetWeight: e.target.value === '' ? null : Number(e.target.value) })} className={num} />
                      <input type="number" min={0} step={15} value={ex.restSeconds} onChange={e => updateExercise(i, { restSeconds: Number(e.target.value) })} className={num} />
                      <div className="flex gap-0.5 justify-end">
                        <button onClick={() => moveExercise(i, -1)} className="w-5 h-6 text-[#555] hover:text-[#f0ece4]" aria-label="W górę">↑</button>
                        <button onClick={() => moveExercise(i, 1)} className="w-5 h-6 text-[#555] hover:text-[#f0ece4]" aria-label="W dół">↓</button>
                        <button onClick={() => setDraft({ ...draft, exercises: draft.exercises.filter((_, j) => j !== i) })} className="w-5 h-6 text-[#555] hover:text-red-400" aria-label="Usuń">×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <ExercisePicker onPick={ex => setDraft(d => d && {
                ...d,
                exercises: [...d.exercises, { exerciseId: ex.id, name: ex.name, targetSets: 3, targetReps: 8, targetWeight: null, restSeconds: 120 }],
              })} />
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => { setDraft(null); setError('') }} className="px-4 py-2 rounded-lg bg-[#111] border border-[#1e1e1e] text-[#888] text-[11px] font-mono uppercase tracking-[1.3px] hover:border-[#333]">Anuluj</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-[#f5a03a] text-[#080808] text-[11px] font-mono uppercase tracking-[1.3px] font-medium hover:bg-[#ffb04a] disabled:opacity-50">
                {saving ? 'Zapisuję…' : 'Zapisz szablon'}
              </button>
            </div>
          </div>
        )}

        {templates === null && [0, 1].map(i => <div key={i} className="h-[80px] rounded-2xl bg-[#0f0f0f] border border-[#1a1a1a] animate-pulse" />)}

        {templates?.map(t => (
          <div key={t.id} className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-4">
            <div className="flex justify-between items-start gap-3 mb-2">
              <div className="font-display text-[15px] font-black">{t.name}</div>
              <div className="flex gap-3 flex-shrink-0">
                <button onClick={() => { setDraft({ id: t.id, name: t.name, exercises: t.exercises }); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  className="text-[10px] font-mono uppercase tracking-[1.3px] text-[#666] hover:text-[#f5a03a]">Edytuj</button>
                <button onClick={() => handleDelete(t)} className="text-[10px] font-mono uppercase tracking-[1.3px] text-[#666] hover:text-red-400">Usuń</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {t.exercises.map((ex, i) => (
                <span key={i} className="text-[10px] font-mono px-2 py-1 rounded-md bg-[#131313] border border-[#1e1e1e] text-[#888]">
                  {ex.name} · {ex.targetSets}×{ex.targetReps}{ex.targetWeight ? ` @ ${ex.targetWeight}kg` : ''}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
