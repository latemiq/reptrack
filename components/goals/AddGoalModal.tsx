'use client'

import { useState } from 'react'

interface AddGoalModalProps {
  onClose: () => void
  onSaved: () => void
}

const CATEGORIES = [
  { value: 'strength', label: 'Siła',      emoji: '🏋️', color: '#f5a03a' },
  { value: 'running',  label: 'Bieganie',  emoji: '🏃', color: '#c8f53a' },
  { value: 'body',     label: 'Sylwetka',  emoji: '⚖️', color: '#3cc8ff' },
  { value: 'habit',    label: 'Nawyk',     emoji: '🎯', color: '#c88cff' },
] as const

type Category = typeof CATEGORIES[number]['value']

const UNIT_PRESETS: Record<Category, { unit: string; placeholder: string }> = {
  strength: { unit: 'kg',   placeholder: 'np. 160' },
  running:  { unit: 'km',   placeholder: 'np. 50' },
  body:     { unit: 'kg',   placeholder: 'np. 76' },
  habit:    { unit: 'razy', placeholder: 'np. 4' },
}

export default function AddGoalModal({ onClose, onSaved }: AddGoalModalProps) {
  const [category, setCategory] = useState<Category>('strength')
  const [name, setName] = useState('')
  const [targetValue, setTargetValue] = useState('')
  const [unit, setUnit] = useState('kg')
  const [startValue, setStartValue] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleCategoryChange = (cat: Category) => {
    setCategory(cat)
    setUnit(UNIT_PRESETS[cat].unit)
  }

  const handleSave = async () => {
    if (!name.trim()) { setError('Podaj nazwę celu'); return }
    const tv = parseFloat(targetValue)
    if (!Number.isFinite(tv)) { setError('Podaj wartość docelową'); return }

    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category,
          target_value: tv,
          unit: unit.trim(),
          start_value: startValue ? parseFloat(startValue) : undefined,
          current_value: startValue ? parseFloat(startValue) : undefined,
          target_date: targetDate || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error || 'Nie udało się zapisać')
        return
      }
      onSaved()
    } catch {
      setError('Błąd sieci — spróbuj ponownie')
    } finally {
      setSaving(false)
    }
  }

  const inp = 'w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-sm text-[#f0ece4] placeholder:text-[#333] focus:outline-none focus:border-[#c88cff]/40 transition-colors'
  const lbl = 'block text-[9px] font-mono uppercase tracking-[1.5px] text-[#555] mb-1.5'

  const activeCat = CATEGORIES.find(c => c.value === category)!

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-[#0f0f0f] border border-[#1a1a1a] rounded-[20px] overflow-hidden">

        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#1a1a1a]">
          <h2 className="font-display text-[16px] font-black">Nowy cel</h2>
          <button onClick={onClose} className="text-[#444] hover:text-[#888] transition-colors text-[22px] leading-none w-8 h-8 flex items-center justify-center">×</button>
        </div>

        <div className="px-6 py-5 space-y-4">

          <div>
            <label className={lbl}>Kategoria</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(cat => (
                <button key={cat.value} type="button"
                  onClick={() => handleCategoryChange(cat.value)}
                  style={category === cat.value ? { borderColor: `${cat.color}40`, background: `${cat.color}0a` } : {}}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                    category === cat.value
                      ? 'border-current'
                      : 'border-[#1e1e1e] hover:border-[#2e2e2e]'
                  }`}>
                  <span className="text-[18px]">{cat.emoji}</span>
                  <span
                    className="text-[12px] font-medium"
                    style={{ color: category === cat.value ? cat.color : '#888' }}
                  >
                    {cat.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={lbl}>Nazwa celu *</label>
            <input className={inp} placeholder="np. Martwy ciąg → 160 kg" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div>
              <label className={lbl}>Wartość docelowa *</label>
              <input type="number" className={inp} placeholder={UNIT_PRESETS[category].placeholder}
                value={targetValue} onChange={e => setTargetValue(e.target.value)} step="any" />
            </div>
            <div>
              <label className={lbl}>Jednostka</label>
              <input className={inp} placeholder="kg" value={unit} onChange={e => setUnit(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Wartość startowa</label>
              <input type="number" className={inp} placeholder="np. 130" value={startValue}
                onChange={e => setStartValue(e.target.value)} step="any" />
            </div>
            <div>
              <label className={lbl}>Termin (opcjonalnie)</label>
              <input type="date" className={inp} value={targetDate} onChange={e => setTargetDate(e.target.value)} />
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-6 mb-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-[11px] text-red-400">
            {error}
          </div>
        )}

        <div className="px-6 pb-5 pt-1 flex gap-2.5">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#1e1e1e] text-[11px] font-mono uppercase tracking-[1px] text-[#555] hover:border-[#2e2e2e] hover:text-[#888] transition-colors">
            Anuluj
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ background: activeCat.color }}
            className="flex-1 px-4 py-2.5 rounded-xl text-[#080808] text-[11px] font-mono uppercase tracking-[1px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110">
            {saving ? 'Zapisywanie…' : 'Dodaj cel'}
          </button>
        </div>
      </div>
    </div>
  )
}
