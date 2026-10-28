'use client'

import { useEffect, useMemo, useState } from 'react'

export interface ExerciseOption { id: string; name: string }

/** Search the exercise atlas or add a free-text custom exercise. */
export default function ExercisePicker({ onPick, accent = '#f5a03a' }: { onPick: (ex: ExerciseOption) => void; accent?: string }) {
  const [options, setOptions] = useState<ExerciseOption[] | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetch('/api/exercises')
      .then(r => (r.ok ? r.json() : { exercises: [] }))
      .then(d => setOptions(d.exercises ?? []))
      .catch(() => setOptions([]))
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || !options) return []
    return options.filter(o => o.name.toLowerCase().includes(q)).slice(0, 8)
  }, [options, query])

  const addCustom = () => {
    const name = query.trim()
    if (!name) return
    onPick({ id: `custom:${name.toLowerCase().replace(/\s+/g, '-')}`, name })
    setQuery('')
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (results[0]) { onPick(results[0]); setQuery('') } else addCustom() } }}
        placeholder={options === null ? 'Wczytuję atlas ćwiczeń…' : 'Szukaj w atlasie (np. squat, bench press) lub wpisz własną nazwę…'}
        className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-sm text-[#f0ece4] placeholder:text-[#444] focus:outline-none focus:border-[var(--accent)]"
        style={{ ['--accent' as string]: accent }}
      />
      {query.trim() && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-[#111] border border-[#222] rounded-xl overflow-hidden shadow-xl">
          {results.map(r => (
            <button key={r.id} onClick={() => { onPick(r); setQuery('') }}
              className="w-full text-left px-3 py-2 text-[12px] text-[#ccc] hover:bg-white/[0.04]"
              onMouseEnter={e => (e.currentTarget.style.color = accent)} onMouseLeave={e => (e.currentTarget.style.color = '')}>
              {r.name}
            </button>
          ))}
          <button onClick={addCustom} className="w-full text-left px-3 py-2 text-[11px] font-mono text-[#666] hover:bg-white/[0.03] border-t border-[#1a1a1a]">
            + Dodaj „{query.trim()}” jako własne ćwiczenie
          </button>
        </div>
      )}
    </div>
  )
}
