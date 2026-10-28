'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AddWeightModal from '@/components/weight/AddWeightModal'
import TrainerSection from '@/components/settings/TrainerSection'

interface FormState {
  weightKg: number
  heightCm: number
  age: number | ''
  level: string
  location: string
  bio: string
  weeklyKmGoal: number | ''
  weeklyDays: number | ''
}

const LEVELS = [
  { key: 'beginner',     label: 'Początkujący',        sub: 'Zaczynam przygodę z treningiem' },
  { key: 'intermediate', label: 'Średniozaawansowany',  sub: '1–3 lata regularnego treningu' },
  { key: 'advanced',     label: 'Zaawansowany',         sub: 'Ponad 3 lata, wiem co robię' },
]

export default function SettingsForm() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>({ weightKg: 78, heightCm: 178, age: '', level: '', location: '', bio: '', weeklyKmGoal: '', weeklyDays: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [showWeightModal, setShowWeightModal] = useState(false)
  // Trainers have no own training data — only general info and trainer settings.
  const [isTrainer, setIsTrainer] = useState(false)

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(data => {
        if (data.profile) {
          const p = data.profile
          setIsTrainer(p.role === 'trainer')
          setForm({
            weightKg: p.weightKg ?? 78,
            heightCm: p.heightCm ?? 178,
            age:      p.age ?? '',
            level:    p.level ?? '',
            location: p.location ?? '',
            bio:      p.bio ?? '',
            weeklyKmGoal: p.weeklyKmGoal ?? '',
            weeklyDays:   p.weeklyDays ?? '',
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setStatus('idle')
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isTrainer ? {
          location: form.location || null,
          bio:      form.bio || null,
        } : {
          weight_kg: form.weightKg,
          height_cm: form.heightCm,
          age:       form.age === '' ? null : Number(form.age),
          level:     form.level || null,
          location:  form.location || null,
          bio:       form.bio || null,
          weekly_km_goal: form.weeklyKmGoal === '' ? null : Number(form.weeklyKmGoal),
          weekly_days:    form.weeklyDays === '' ? null : Number(form.weeklyDays),
        }),
      })
      setStatus(res.ok ? 'saved' : 'error')
      if (res.ok) setTimeout(() => setStatus('idle'), 3000)
    } catch {
      setStatus('error')
    } finally {
      setSaving(false)
    }
  }

  const label = 'block text-[10px] font-mono uppercase tracking-[2px] text-[#555] mb-2'
  const input = 'w-full bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl px-4 py-3 text-sm text-[#f0ece4] placeholder:text-[#333] focus:outline-none focus:border-[#c8f53a]/40 transition-colors'

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#c8f53a]/30 border-t-[#c8f53a] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080808] text-[#f0ece4]">

      {/* Topbar */}
      <div className="px-4 md:px-7 pt-5 pb-2 flex items-center gap-4 border-b border-[#1a1a1a]">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-xl bg-[#111] border border-[#1e1e1e] flex items-center justify-center text-[#888] hover:text-[#f0ece4] hover:border-[#333] transition-all cursor-pointer"
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 16 16">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div>
          <p className="text-[10px] font-mono text-[#444] uppercase tracking-[2px]">Konto</p>
          <h1 className="font-display text-[20px] font-black leading-tight">
            Twoje <em className="not-italic text-[#c8f53a]">dane</em>
          </h1>
        </div>
      </div>

      <div className="px-4 md:px-7 py-6 max-w-2xl space-y-4">

        {!isTrainer && <>
        {/* Body metrics */}
        <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-5 md:p-6 space-y-5">
          <p className="text-[10px] font-mono uppercase tracking-[2px] text-[#444]">Dane ciała</p>

          <div>
            <div className="flex justify-between items-baseline mb-2">
              <span className={label}>Waga</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowWeightModal(true)}
                  className="px-3 py-1 rounded-lg bg-[#c8f53a]/10 border border-[#c8f53a]/20 text-[9px] font-mono uppercase tracking-[1.2px] text-[#c8f53a] hover:bg-[#c8f53a]/20 transition-colors"
                >
                  + Zaloguj pomiar
                </button>
                <span className="font-display text-2xl font-black text-[#c8f53a]">
                  {form.weightKg} <span className="text-sm font-sans font-light text-[#555]">kg</span>
                </span>
              </div>
            </div>
            <input type="range" min={30} max={200} step={0.5}
              value={form.weightKg}
              onChange={e => setForm(f => ({ ...f, weightKg: +e.target.value }))}
              className="w-full accent-[#c8f53a]" />
            <div className="flex justify-between mt-1">
              <span className="text-[9px] font-mono text-[#333]">30 kg</span>
              <span className="text-[9px] font-mono text-[#333]">200 kg</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-baseline mb-2">
              <span className={label}>Wzrost</span>
              <span className="font-display text-2xl font-black text-[#f5a03a]">
                {form.heightCm} <span className="text-sm font-sans font-light text-[#555]">cm</span>
              </span>
            </div>
            <input type="range" min={140} max={220} step={1}
              value={form.heightCm}
              onChange={e => setForm(f => ({ ...f, heightCm: +e.target.value }))}
              className="w-full accent-[#f5a03a]" />
            <div className="flex justify-between mt-1">
              <span className="text-[9px] font-mono text-[#333]">140 cm</span>
              <span className="text-[9px] font-mono text-[#333]">220 cm</span>
            </div>
          </div>

          <div>
            <label className={label}>Wiek</label>
            <input type="number" min={10} max={100} placeholder="np. 25"
              value={form.age}
              onChange={e => setForm(f => ({ ...f, age: e.target.value === '' ? '' : +e.target.value }))}
              className={input} />
          </div>
        </div>

        {/* Training level */}
        <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-5 md:p-6 space-y-3">
          <p className="text-[10px] font-mono uppercase tracking-[2px] text-[#444]">Poziom treningowy</p>
          {LEVELS.map(({ key, label: lbl, sub }) => {
            const sel = form.level === key
            return (
              <button key={key}
                onClick={() => setForm(f => ({ ...f, level: key }))}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left cursor-pointer transition-all duration-200 ${
                  sel
                    ? 'bg-[#c8f53a]/[0.06] border-[#c8f53a]/30'
                    : 'bg-white/[0.02] border-white/[0.06] hover:border-white/10'
                }`}>
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-[#d0ccc4]">{lbl}</div>
                  <div className="text-[10px] font-mono text-[#555]">{sub}</div>
                </div>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${
                  sel ? 'bg-[#c8f53a] border-[#c8f53a]' : 'border-[#2a2a2a]'
                }`}>
                  {sel && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2 2 4-4" stroke="#080808" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Weekly targets */}
        <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-5 md:p-6 space-y-4">
          <p className="text-[10px] font-mono uppercase tracking-[2px] text-[#444]">Cele tygodniowe</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Km / tydzień</label>
              <input type="number" min={0} step={1} placeholder="np. 30"
                value={form.weeklyKmGoal}
                onChange={e => setForm(f => ({ ...f, weeklyKmGoal: e.target.value === '' ? '' : Number(e.target.value) }))}
                className={input} />
            </div>
            <div>
              <label className={label}>Treningi / tydzień</label>
              <input type="number" min={0} max={14} step={1} placeholder="np. 4"
                value={form.weeklyDays}
                onChange={e => setForm(f => ({ ...f, weeklyDays: e.target.value === '' ? '' : Number(e.target.value) }))}
                className={input} />
            </div>
          </div>
        </div>

        </>}

        {/* Personal info */}
        <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-5 md:p-6 space-y-4">
          <p className="text-[10px] font-mono uppercase tracking-[2px] text-[#444]">Informacje</p>

          <div>
            <label className={label}>Lokalizacja</label>
            <input type="text" placeholder="np. Warszawa"
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              className={input} />
          </div>

          <div>
            <label className={label}>Bio</label>
            <textarea rows={3} placeholder="Kilka słów o sobie..."
              value={form.bio}
              onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
              className={`${input} resize-none`} />
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-4 rounded-xl text-[13px] font-mono uppercase tracking-[1.5px] font-medium bg-[#c8f53a] text-[#080808] hover:bg-[#d8ff4a] disabled:opacity-50 hover:-translate-y-px active:scale-[0.98] transition-all cursor-pointer"
          >
            {saving
              ? <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="20" strokeDashoffset="10"/>
                  </svg>
                  Zapisuję...
                </span>
              : 'Zapisz zmiany'}
          </button>
          {status === 'saved' && (
            <span className="text-[#c8f53a] text-[12px] font-mono">✓ Zapisano</span>
          )}
          {status === 'error' && (
            <span className="text-red-400 text-[12px] font-mono">Błąd zapisu</span>
          )}
        </div>

        <TrainerSection onRoleChange={role => setIsTrainer(role === 'trainer')} />
      </div>

      {showWeightModal && (
        <AddWeightModal
          currentWeight={form.weightKg}
          onClose={() => setShowWeightModal(false)}
          onSaved={kg => {
            setForm(f => ({ ...f, weightKg: kg }))
            setShowWeightModal(false)
          }}
        />
      )}
    </div>
  )
}
