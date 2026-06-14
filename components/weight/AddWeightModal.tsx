'use client'

import { useState } from 'react'

interface AddWeightModalProps {
  currentWeight?: number
  onClose: () => void
  onSaved: (weightKg: number) => void
}

export default function AddWeightModal({ currentWeight, onClose, onSaved }: AddWeightModalProps) {
  const today = new Date().toISOString().slice(0, 10)
  const [weight, setWeight] = useState(currentWeight ? String(currentWeight) : '')
  const [date, setDate] = useState(today)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    const kg = parseFloat(weight)
    if (!Number.isFinite(kg) || kg <= 0 || kg > 500) {
      setError('Podaj prawidłową wagę')
      return
    }

    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/weight-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weight_kg: kg, date }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error || 'Nie udało się zapisać')
        return
      }
      onSaved(kg)
    } catch {
      setError('Błąd sieci — spróbuj ponownie')
    } finally {
      setSaving(false)
    }
  }

  const inp = 'w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl px-4 py-3 text-sm text-[#f0ece4] placeholder:text-[#333] focus:outline-none focus:border-[#c8f53a]/40 transition-colors'
  const lbl = 'block text-[9px] font-mono uppercase tracking-[1.5px] text-[#555] mb-1.5'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm bg-[#0f0f0f] border border-[#1a1a1a] rounded-[20px] overflow-hidden">

        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#1a1a1a]">
          <h2 className="font-display text-[16px] font-black">Zaloguj wagę</h2>
          <button onClick={onClose} className="text-[#444] hover:text-[#888] transition-colors text-[22px] leading-none w-8 h-8 flex items-center justify-center">×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={lbl}>Waga (kg) *</label>
            <div className="relative">
              <input
                type="number"
                className={inp}
                placeholder="78.5"
                step="0.1"
                min="20"
                max="500"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                autoFocus
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-mono text-[#555]">kg</span>
            </div>
          </div>
          <div>
            <label className={lbl}>Data</label>
            <input type="date" className={inp} value={date} onChange={e => setDate(e.target.value)} />
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
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#c8f53a] text-[#080808] text-[11px] font-mono uppercase tracking-[1px] font-medium hover:bg-[#d8ff4a] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? 'Zapisywanie…' : 'Zapisz pomiar'}
          </button>
        </div>
      </div>
    </div>
  )
}
