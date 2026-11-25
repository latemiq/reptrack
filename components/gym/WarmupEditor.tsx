'use client'

import { useState } from 'react'
import { CARDIO_MACHINES, WARMUP_EXERCISES, type WarmupItem } from '@/lib/warmup'

const parse = (t: string) => { const n = Number(t.replace(',', '.')); return t.trim() === '' || Number.isNaN(n) ? null : n }
const show = (n: number | null) => (n == null ? '' : String(n).replace('.', ','))

const field = 'bg-[#0a0a0a] border border-[#262626] rounded-lg text-[13px] text-[#f0ece4] placeholder:text-[#555] focus:outline-none focus:border-[#f5a03a]/50 px-2 py-1.5'

/**
 * Warm-up prescription for a template or a trainer's session: cardio (minutes, km, pace/level)
 * and light exercises (sets × reps). Not counted in any statistics.
 */
export default function WarmupEditor({ value, onChange }: { value: WarmupItem[]; onChange: (v: WarmupItem[]) => void }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const patch = (i: number, p: Partial<WarmupItem>) => onChange(value.map((x, j) => (j === i ? { ...x, ...p } as WarmupItem : x)))
  const add = (item: WarmupItem) => { onChange([...value, item]); setName('') }

  return (
    <section aria-labelledby="warmup-title" className="rounded-2xl border border-[#f5a03a]/20 bg-[#f5a03a]/[0.03] p-3 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="warmup-title" className="text-[11px] font-mono uppercase tracking-[1.5px] text-[#f5a03a]">Rozgrzewka</h3>
        <span className="text-[11px] text-[#777]">nie liczy się do serii ani tonażu</span>
      </div>

      {value.map((w, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2 rounded-xl border border-[#262626] bg-[#0f0f0f] p-2">
          {w.kind === 'cardio' ? (
            <>
              <label className="flex-1 min-w-[120px] text-[11px] text-[#999]">Sprzęt
                <input value={w.machine} onChange={e => patch(i, { machine: e.target.value })} className={`${field} block w-full mt-1`} />
              </label>
              <label className="w-16 text-[11px] text-[#999]">min
                <input inputMode="decimal" value={show(w.minutes)} onChange={e => patch(i, { minutes: parse(e.target.value) })} className={`${field} block w-full mt-1 text-center`} />
              </label>
              <label className="w-16 text-[11px] text-[#999]">km
                <input inputMode="decimal" value={show(w.distanceKm)} onChange={e => patch(i, { distanceKm: parse(e.target.value) })} className={`${field} block w-full mt-1 text-center`} />
              </label>
              <label className="flex-1 min-w-[120px] text-[11px] text-[#999]">Tempo / poziom
                <input value={w.level} placeholder="6 km/h, poziom 8" onChange={e => patch(i, { level: e.target.value })} className={`${field} block w-full mt-1`} />
              </label>
            </>
          ) : (
            <>
              <label className="flex-1 min-w-[160px] text-[11px] text-[#999]">Ćwiczenie
                <input value={w.name} onChange={e => patch(i, { name: e.target.value })} className={`${field} block w-full mt-1`} />
              </label>
              <label className="w-16 text-[11px] text-[#999]">serie
                <input inputMode="numeric" value={show(w.sets)} onChange={e => patch(i, { sets: Math.max(1, Math.round(parse(e.target.value) ?? 1)) })} className={`${field} block w-full mt-1 text-center`} />
              </label>
              <label className="w-20 text-[11px] text-[#999]">powt. / s
                <input inputMode="numeric" value={show(w.reps)} onChange={e => patch(i, { reps: parse(e.target.value) })} className={`${field} block w-full mt-1 text-center`} />
              </label>
            </>
          )}
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Usuń z rozgrzewki"
            className="w-8 h-8 rounded-lg text-[#777] hover:text-red-400 cursor-pointer">✕</button>
        </div>
      ))}

      {!adding ? (
        <button type="button" onClick={() => setAdding(true)} className="w-full rounded-xl border border-dashed border-[#f5a03a]/40 py-2 text-[12px] text-[#f5a03a] cursor-pointer">
          + Dodaj rozgrzewkę
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] font-mono uppercase tracking-[1.3px] text-[#777]">Cardio</p>
          <div className="flex flex-wrap gap-1.5">
            {CARDIO_MACHINES.map(m => (
              <button type="button" key={m} onClick={() => add({ kind: 'cardio', machine: m, minutes: 5, distanceKm: null, level: '' })}
                className="rounded-full border border-[#262626] px-3 py-1 text-[12px] text-[#ddd] hover:border-[#f5a03a]/50 cursor-pointer">{m}</button>
            ))}
          </div>
          <p className="text-[11px] font-mono uppercase tracking-[1.3px] text-[#777]">Ćwiczenie na dogrzanie</p>
          <div className="flex gap-2">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nazwa albo wybierz poniżej" aria-label="Nazwa ćwiczenia rozgrzewkowego"
              onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { e.preventDefault(); add({ kind: 'exercise', name: name.trim(), sets: 2, reps: 15 }) } }}
              className={`${field} flex-1`} />
            <button type="button" disabled={!name.trim()} onClick={() => add({ kind: 'exercise', name: name.trim(), sets: 2, reps: 15 })}
              className="rounded-lg border border-[#f5a03a]/40 px-3 text-[12px] text-[#f5a03a] disabled:opacity-40 cursor-pointer">Dodaj</button>
          </div>
          {WARMUP_EXERCISES.map(g => (
            <div key={g.group}>
              <p className="text-[11px] text-[#777] mb-1">{g.group}</p>
              <div className="flex flex-wrap gap-1.5">
                {g.names.map(n => (
                  <button type="button" key={n} onClick={() => add({ kind: 'exercise', name: n, sets: 2, reps: 15 })}
                    className="rounded-full border border-[#262626] px-3 py-1 text-[12px] text-[#ddd] hover:border-[#f5a03a]/50 cursor-pointer">{n}</button>
                ))}
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setAdding(false)} className="w-full py-1.5 text-[12px] text-[#777] cursor-pointer">Gotowe</button>
        </div>
      )}
    </section>
  )
}
