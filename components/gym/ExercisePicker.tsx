'use client'

import { useEffect, useMemo, useState } from 'react'
import { POPULAR_EXERCISES } from '@/lib/exercises/popular'
import { MUSCLE_GROUP_PL, MUSCLE_PL, muscleToGroup } from '@/lib/exercises/translations'

export interface ExerciseOption { id: string; name: string }

interface AtlasRow { id: string; name: string; primary_muscles?: string[] | null }
interface Item extends ExerciseOption { muscle: string; haystack: string; popular: boolean }

/** Lowercase without Polish diacritics, so "lydki" finds "łydki". */
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')

const POPULAR_ITEMS: Item[] = POPULAR_EXERCISES.map(e => ({
  id: e.id, name: e.name, muscle: e.muscle, popular: true,
  haystack: norm([e.name, e.muscle, ...e.aliases].join(' ')),
}))

/**
 * Pick an exercise: popular Polish names first, then the (English) atlas;
 * matches names, aliases and muscle groups, or adds a free-text custom exercise.
 */
const GROUPS = ['Klatka', 'Plecy', 'Nogi', 'Barki', 'Ramiona', 'Brzuch']

export default function ExercisePicker({ onPick, accent = '#f5a03a', showGroups = false }: {
  onPick: (ex: ExerciseOption) => void
  accent?: string
  /** Muscle-group chips under the search field (Klatka, Plecy, …). */
  showGroups?: boolean
}) {
  const [atlas, setAtlas] = useState<Item[] | null>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [group, setGroup] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/exercises')
      .then(r => (r.ok ? r.json() : { exercises: [] }))
      .then(d => setAtlas(((d.exercises ?? []) as AtlasRow[]).map(o => {
        const primary = o.primary_muscles?.[0] ?? ''
        const muscle = MUSCLE_PL[primary] ?? ''
        const group = muscleToGroup(primary)
        // Group label too, so "plecy" also finds lats / middle-back atlas entries.
        const groupLabel = group ? MUSCLE_GROUP_PL[group].label : ''
        return { id: o.id, name: o.name, muscle, popular: false, haystack: norm(`${o.name} ${muscle} ${groupLabel}`) }
      })))
      .catch(() => setAtlas([]))
  }, [])

  const results = useMemo(() => {
    const q = norm(query.trim())
    if (!q && !group) return POPULAR_ITEMS.slice(0, 12)
    const words = [...(q ? q.split(/\s+/) : []), ...(group ? [norm(group)] : [])]
    const match = (i: Item) => words.every(w => i.haystack.includes(w))
    return [...POPULAR_ITEMS.filter(match), ...(atlas ?? []).filter(match)].slice(0, group && !q ? 30 : 12)
  }, [atlas, query, group])

  const pick = (ex: ExerciseOption) => {
    onPick({ id: ex.id, name: ex.name })
    setQuery('')
  }

  const addCustom = () => {
    const name = query.trim()
    if (!name) return
    pick({ id: `custom:${name.toLowerCase().replace(/\s+/g, '-')}`, name })
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={e => {
          if (e.key === 'Escape') setOpen(false)
          if (e.key === 'Enter') { e.preventDefault(); if (query.trim() && results[0]) pick(results[0]); else addCustom() }
        }}
        placeholder="+ Dodaj ćwiczenie — kliknij lub wpisz (np. przysiad, klatka, bench)…"
        className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-sm text-[#f0ece4] placeholder:text-[#555] focus:outline-none focus:border-[var(--accent)]"
        style={{ ['--accent' as string]: accent }}
      />
      {showGroups && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {GROUPS.map(g => (
            <button key={g} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { setGroup(cur => (cur === g ? null : g)); setOpen(true) }}
              className={`px-2.5 py-1 rounded-full text-[11px] border cursor-pointer transition-colors ${
                group === g ? 'border-transparent text-[#0f1a00]' : 'border-[#262626] text-[#999] hover:text-[#f0ece4]'
              }`}
              style={group === g ? { background: accent } : undefined}>
              {g}
            </button>
          ))}
        </div>
      )}
      {(open || !!group) && (
        // onMouseDown + preventDefault keeps the input focused, so the click lands before onBlur closes the list.
        <div className="absolute z-10 left-0 right-0 mt-1 bg-[#111] border border-[#222] rounded-xl overflow-hidden shadow-xl max-h-[320px] overflow-y-auto"
          onMouseDown={e => e.preventDefault()}>
          {!query.trim() && <div className="px-3 pt-2 pb-1 text-[11px] font-mono uppercase tracking-[1.5px] text-[#555]">{group ?? 'Popularne'}</div>}
          {results.map(r => (
            <button key={`${r.popular ? 'p' : 'a'}:${r.id}`} onClick={() => pick(r)}
              className="w-full flex items-center gap-3 text-left px-3 py-2 text-[12px] text-[#ccc] hover:bg-white/[0.04]"
              onMouseEnter={e => (e.currentTarget.style.color = accent)} onMouseLeave={e => (e.currentTarget.style.color = '')}>
              <span className="flex-1 truncate">{r.name}</span>
              {r.muscle && <span className="text-[9px] font-mono uppercase tracking-[1px] text-[#555] flex-shrink-0">{r.muscle}</span>}
            </button>
          ))}
          {query.trim() && results.length === 0 && atlas === null && (
            <div className="px-3 py-2 text-[11px] text-[#555]">Wczytuję atlas ćwiczeń…</div>
          )}
          {query.trim() && (
            <button onClick={addCustom} className="w-full text-left px-3 py-2 text-[11px] font-mono text-[#666] hover:bg-white/[0.03] border-t border-[#1a1a1a]">
              + Dodaj „{query.trim()}” jako własne ćwiczenie
            </button>
          )}
        </div>
      )}
    </div>
  )
}
