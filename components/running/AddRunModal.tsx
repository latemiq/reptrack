'use client'

import { useState } from 'react'

interface AddRunModalProps {
  onClose: () => void
  onSaved: () => void
}

const RUN_TYPES = [
  { value: 'easy',     label: 'Spokojny' },
  { value: 'tempo',    label: 'Tempo' },
  { value: 'long',     label: 'Długi' },
  { value: 'interval', label: 'Interwałowy' },
  { value: 'recovery', label: 'Regeneracja' },
  { value: 'race',     label: 'Wyścig' },
]

export default function AddRunModal({ onClose, onSaved }: AddRunModalProps) {
  const today = new Date().toISOString().slice(0, 10)

  const [name, setName] = useState('')
  const [date, setDate] = useState(today)
  const [distanceKm, setDistanceKm] = useState('')
  const [hours, setHours] = useState('0')
  const [minutes, setMinutes] = useState('')
  const [seconds, setSeconds] = useState('0')
  const [type, setType] = useState('easy')
  const [location, setLocation] = useState('')
  const [avgHr, setAvgHr] = useState('')
  const [maxHr, setMaxHr] = useState('')
  const [elevation, setElevation] = useState('')
  const [calories, setCalories] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    const distance = parseFloat(distanceKm)
    if (!distance || distance <= 0) { setError('Podaj prawidłowy dystans'); return }
    const h = parseInt(hours || '0', 10)
    const m = parseInt(minutes || '0', 10)
    const s = parseInt(seconds || '0', 10)
    const durationSeconds = h * 3600 + m * 60 + s
    if (durationSeconds <= 0) { setError('Podaj prawidłowy czas'); return }

    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/running', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || undefined,
          date,
          distance_km: distance,
          duration_seconds: durationSeconds,
          type,
          source: 'manual',
          location: location.trim() || undefined,
          avg_hr: avgHr ? parseInt(avgHr, 10) : undefined,
          max_hr: maxHr ? parseInt(maxHr, 10) : undefined,
          elevation_gain_m: elevation ? parseFloat(elevation) : undefined,
          calories: calories ? parseInt(calories, 10) : undefined,
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

  const inp = 'w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-sm text-[#f0ece4] placeholder:text-[#333] focus:outline-none focus:border-[#f5a03a]/40 transition-colors'
  const lbl = 'block text-[9px] font-mono uppercase tracking-[1.5px] text-[#555] mb-1.5'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-[#0f0f0f] border border-[#1a1a1a] rounded-[20px] overflow-hidden">

        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#1a1a1a]">
          <h2 className="font-display text-[16px] font-black">Dodaj bieg</h2>
          <button onClick={onClose} className="text-[#444] hover:text-[#888] transition-colors text-[22px] leading-none w-8 h-8 flex items-center justify-center">×</button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

          <div>
            <label className={lbl}>Nazwa (opcjonalna)</label>
            <input className={inp} placeholder="np. Bieg poranny" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Data</label>
              <input type="date" className={inp} value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Dystans (km) *</label>
              <input type="number" className={inp} placeholder="12.4" step="0.01" min="0.01" value={distanceKm} onChange={e => setDistanceKm(e.target.value)} />
            </div>
          </div>

          <div>
            <label className={lbl}>Czas * (godz · min · sek)</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'godz', val: hours,   set: setHours,   ph: '0',  max: undefined },
                { label: 'min',  val: minutes,  set: setMinutes, ph: '45', max: 59 },
                { label: 'sek',  val: seconds,  set: setSeconds, ph: '30', max: 59 },
              ].map(f => (
                <div key={f.label}>
                  <input type="number" className={inp} placeholder={f.ph} min="0" max={f.max} value={f.val}
                    onChange={e => f.set(e.target.value)} />
                  <div className="text-[8px] font-mono text-[#444] text-center mt-1">{f.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className={lbl}>Rodzaj biegu</label>
            <div className="flex flex-wrap gap-1.5">
              {RUN_TYPES.map(rt => (
                <button key={rt.value} type="button"
                  onClick={() => setType(rt.value)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-[1px] transition-all border ${
                    type === rt.value
                      ? 'bg-[#f5a03a]/10 border-[#f5a03a]/30 text-[#f5a03a]'
                      : 'border-[#1e1e1e] text-[#555] hover:border-[#2e2e2e] hover:text-[#888]'
                  }`}>
                  {rt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={lbl}>Lokalizacja (opcjonalna)</label>
            <input className={inp} placeholder="np. Park Skaryszewski" value={location} onChange={e => setLocation(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Śr. tętno (bpm)</label>
              <input type="number" className={inp} placeholder="152" min="40" max="250" value={avgHr} onChange={e => setAvgHr(e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Maks. tętno (bpm)</label>
              <input type="number" className={inp} placeholder="180" min="40" max="250" value={maxHr} onChange={e => setMaxHr(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Przewyższenie (m)</label>
              <input type="number" className={inp} placeholder="142" min="0" value={elevation} onChange={e => setElevation(e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Kalorie (kcal)</label>
              <input type="number" className={inp} placeholder="650" min="0" value={calories} onChange={e => setCalories(e.target.value)} />
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
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#f5a03a] text-[#080808] text-[11px] font-mono uppercase tracking-[1px] font-medium hover:bg-[#ffb04a] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? 'Zapisywanie…' : 'Zapisz bieg'}
          </button>
        </div>
      </div>
    </div>
  )
}
