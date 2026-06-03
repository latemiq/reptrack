'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  CATEGORY_PL, LEVEL_PL, FORCE_PL, MECHANIC_PL, EQUIPMENT_PL, MUSCLE_PL,
} from '@/lib/exercises/translations'

const ALL_MUSCLES = Object.keys(MUSCLE_PL) as (keyof typeof MUSCLE_PL)[]

function SelectField({
  label, value, onChange, options, placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Record<string, string>
  placeholder: string
}) {
  return (
    <div>
      <label className="block text-[11px] font-mono text-[#666] uppercase tracking-[1.5px] mb-1.5">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-[#0f0f0f] border border-[#1a1a1a] focus:border-[#f5a03a]/40 rounded-xl px-4 py-3 text-[13px] text-[#f0ece4] outline-none transition-colors appearance-none"
      >
        <option value="">{placeholder}</option>
        {Object.entries(options).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
    </div>
  )
}

function MuscleToggle({
  muscle, active, onClick,
}: {
  muscle: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-[1px] transition-all border ${
        active
          ? 'bg-[#f5a03a]/10 border-[#f5a03a]/30 text-[#f5a03a]'
          : 'bg-white/[0.02] border-white/[0.06] text-[#666] hover:border-white/15 hover:text-[#bbb]'
      }`}
    >
      {MUSCLE_PL[muscle as keyof typeof MUSCLE_PL] ?? muscle}
    </button>
  )
}

export default function NewExercisePage() {
  const router = useRouter()

  const [name, setName]                           = useState('')
  const [category, setCategory]                   = useState('')
  const [level, setLevel]                         = useState('')
  const [force, setForce]                         = useState('')
  const [mechanic, setMechanic]                   = useState('')
  const [equipment, setEquipment]                 = useState('')
  const [primaryMuscles, setPrimaryMuscles]       = useState<string[]>([])
  const [secondaryMuscles, setSecondaryMuscles]   = useState<string[]>([])
  const [instructions, setInstructions]           = useState<string[]>([''])
  const [saving, setSaving]                       = useState(false)
  const [error, setError]                         = useState('')

  const toggleMuscle = (
    muscle: string,
    list: string[],
    setList: (v: string[]) => void,
    otherList: string[],
    setOtherList: (v: string[]) => void,
  ) => {
    if (list.includes(muscle)) {
      setList(list.filter(m => m !== muscle))
    } else {
      setOtherList(otherList.filter(m => m !== muscle))
      setList([...list, muscle])
    }
  }

  const updateInstruction = (i: number, val: string) => {
    const next = [...instructions]
    next[i] = val
    setInstructions(next)
  }

  const removeInstruction = (i: number) =>
    setInstructions(instructions.filter((_, idx) => idx !== i))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Nazwa ćwiczenia jest wymagana.'); return }
    setError('')
    setSaving(true)

    try {
      const res = await fetch('/api/exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category: category || null,
          level: level || null,
          force: force || null,
          mechanic: mechanic || null,
          equipment: equipment || null,
          primary_muscles: primaryMuscles,
          secondary_muscles: secondaryMuscles,
          instructions: instructions.filter(s => s.trim()),
        }),
      })

      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Błąd zapisu'); setSaving(false); return }
      router.push('/gym/exercises')
    } catch {
      setError('Błąd połączenia. Spróbuj ponownie.')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#080808] text-[#f0ece4]">
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#0f0f0f] border border-[#1a1a1a] text-[#666] hover:text-[#f0ece4] hover:border-[#2a2a2a] transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div>
            <p className="text-[10px] font-mono text-[#444] uppercase tracking-[2px] mb-0.5">Siłownia · atlas</p>
            <h1 className="font-display text-[22px] font-black">
              Własne <em className="not-italic text-[#c8f53a]">ćwiczenie</em>
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Nazwa */}
          <div>
            <label className="block text-[11px] font-mono text-[#666] uppercase tracking-[1.5px] mb-1.5">
              Nazwa <span className="text-[#f5a03a]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="np. Wyciskanie sztangi"
              className="w-full bg-[#0f0f0f] border border-[#1a1a1a] focus:border-[#f5a03a]/40 rounded-xl px-4 py-3 text-[13px] text-[#f0ece4] placeholder:text-[#444] outline-none transition-colors"
            />
          </div>

          {/* Kategoria + Poziom */}
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Kategoria"
              value={category}
              onChange={setCategory}
              options={CATEGORY_PL}
              placeholder="Wybierz..."
            />
            <SelectField
              label="Poziom"
              value={level}
              onChange={setLevel}
              options={LEVEL_PL}
              placeholder="Wybierz..."
            />
          </div>

          {/* Siła + Mechanika */}
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Typ siły"
              value={force}
              onChange={setForce}
              options={FORCE_PL}
              placeholder="Wybierz..."
            />
            <SelectField
              label="Mechanika"
              value={mechanic}
              onChange={setMechanic}
              options={MECHANIC_PL}
              placeholder="Wybierz..."
            />
          </div>

          {/* Sprzęt */}
          <SelectField
            label="Sprzęt"
            value={equipment}
            onChange={setEquipment}
            options={EQUIPMENT_PL}
            placeholder="Wybierz..."
          />

          {/* Mięśnie główne */}
          <div>
            <label className="block text-[11px] font-mono text-[#666] uppercase tracking-[1.5px] mb-2">
              Mięśnie główne
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_MUSCLES.map(m => (
                <MuscleToggle
                  key={m}
                  muscle={m}
                  active={primaryMuscles.includes(m)}
                  onClick={() => toggleMuscle(m, primaryMuscles, setPrimaryMuscles, secondaryMuscles, setSecondaryMuscles)}
                />
              ))}
            </div>
          </div>

          {/* Mięśnie pomocnicze */}
          <div>
            <label className="block text-[11px] font-mono text-[#666] uppercase tracking-[1.5px] mb-2">
              Mięśnie pomocnicze
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_MUSCLES.map(m => (
                <MuscleToggle
                  key={m}
                  muscle={m}
                  active={secondaryMuscles.includes(m)}
                  onClick={() => toggleMuscle(m, secondaryMuscles, setSecondaryMuscles, primaryMuscles, setPrimaryMuscles)}
                />
              ))}
            </div>
          </div>

          {/* Instrukcje */}
          <div>
            <label className="block text-[11px] font-mono text-[#666] uppercase tracking-[1.5px] mb-2">
              Instrukcje (opcjonalne)
            </label>
            <div className="space-y-2">
              {instructions.map((step, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="mt-3 w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-full bg-[#1a1a1a] text-[9px] font-mono text-[#555]">
                    {i + 1}
                  </div>
                  <input
                    type="text"
                    value={step}
                    onChange={e => updateInstruction(i, e.target.value)}
                    placeholder={`Krok ${i + 1}...`}
                    className="flex-1 bg-[#0f0f0f] border border-[#1a1a1a] focus:border-[#f5a03a]/40 rounded-xl px-4 py-3 text-[13px] text-[#f0ece4] placeholder:text-[#444] outline-none transition-colors"
                  />
                  {instructions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeInstruction(i)}
                      className="mt-2.5 w-8 h-8 flex items-center justify-center text-[#444] hover:text-[#f55] transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setInstructions([...instructions, ''])}
              className="mt-2 text-[11px] font-mono text-[#555] hover:text-[#f5a03a] uppercase tracking-[1px] transition-colors"
            >
              + Dodaj krok
            </button>
          </div>

          {/* Error */}
          {error && (
            <p className="text-[12px] text-[#f55] font-mono bg-[#f55]/5 border border-[#f55]/20 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          {/* Przyciski */}
          <div className="flex gap-3 pt-2 pb-8">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 py-3.5 rounded-xl bg-[#0f0f0f] border border-[#1a1a1a] text-[#666] text-[12px] font-mono uppercase tracking-[1.3px] hover:border-[#2a2a2a] hover:text-[#999] transition-all"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-[2] py-3.5 rounded-xl bg-[#c8f53a] text-[#080808] text-[12px] font-mono font-bold uppercase tracking-[1.3px] hover:bg-[#d4ff44] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Zapisywanie...' : 'Zapisz ćwiczenie'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
