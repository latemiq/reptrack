'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { relativeDay } from '@/lib/stats'

interface SetRow {
  exercise_id: string
  exercise_name: string | null
  exercise_position: number
  set_number: number
  reps: number | null
  weight_kg: number | string | null
  rpe: number | string | null
}

interface WorkoutRow {
  id: string
  name: string
  notes: string | null
  started_at: string
  duration_seconds: number | null
  total_tonnage: number | string | null
  workout_sets: SetRow[]
}

function groupSets(sets: SetRow[]) {
  const groups = new Map<number, { name: string; sets: SetRow[] }>()
  for (const s of [...sets].sort((a, b) => a.exercise_position - b.exercise_position || a.set_number - b.set_number)) {
    const g = groups.get(s.exercise_position) ?? { name: s.exercise_name ?? s.exercise_id, sets: [] }
    g.sets.push(s)
    groups.set(s.exercise_position, g)
  }
  return Array.from(groups.values())
}

export default function WorkoutHistory() {
  const router = useRouter()
  const [workouts, setWorkouts] = useState<WorkoutRow[] | null>(null)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/gym/workouts?limit=100')
      .then(async res => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then(d => {
        setWorkouts(d.workouts)
        setOpenId(d.workouts[0]?.id ?? null)
      })
      .catch(() => { setWorkouts([]); setError('Nie udało się wczytać historii. Sprawdź połączenie z bazą.') })
  }, [])

  const summary = useMemo(() => {
    const list = workouts ?? []
    const since = Date.now() - 30 * 86400000
    const recent = list.filter(w => new Date(w.started_at).getTime() >= since)
    return {
      count: recent.length,
      tonnage: recent.reduce((s, w) => s + Number(w.total_tonnage ?? 0), 0),
      minutes: recent.reduce((s, w) => s + (w.duration_seconds ?? 0), 0) / 60,
    }
  }, [workouts])

  const handleDelete = async (id: string) => {
    if (!confirm('Usunąć ten trening z historii?')) return
    const res = await fetch(`/api/gym/workouts/${id}`, { method: 'DELETE' }).catch(() => null)
    if (res?.ok) setWorkouts(ws => (ws ?? []).filter(w => w.id !== id))
    else setError('Nie udało się usunąć treningu')
  }

  return (
    <div className="min-h-full bg-[#080808] text-[#f0ece4]">
      <div className="px-4 md:px-7 pt-5 md:pt-6 pb-2">
        <button onClick={() => router.push('/gym')} className="text-[10px] font-mono text-[#444] uppercase tracking-[2px] mb-1 hover:text-[#f5a03a]">← Siłownia</button>
        <h1 className="font-display text-[24px] font-black">Historia <em className="not-italic text-[#f5a03a]">treningów</em></h1>
      </div>

      <div className="px-4 md:px-7 pb-7 pt-3 space-y-3">
        {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] text-red-400">{error}</div>}

        <div className="grid grid-cols-3 gap-2.5">
          {[
            ['Treningi · 30 dni', String(summary.count)],
            ['Tonaż · 30 dni', `${(summary.tonnage / 1000).toFixed(1)} t`],
            ['Czas · 30 dni', `${Math.floor(summary.minutes / 60)}h ${Math.round(summary.minutes % 60)}m`],
          ].map(([label, value]) => (
            <div key={label} className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-4">
              <div className="text-[9px] font-mono text-[#444] uppercase tracking-[1.3px] mb-2">{label}</div>
              <div className="font-display text-[22px] font-black text-[#f5a03a] leading-none">{value}</div>
            </div>
          ))}
        </div>

        {workouts === null && [0, 1, 2].map(i => <div key={i} className="h-[72px] rounded-2xl bg-[#0f0f0f] border border-[#1a1a1a] animate-pulse" />)}

        {workouts?.length === 0 && !error && (
          <div className="text-center py-16 text-[13px] text-[#555]">
            Brak ukończonych treningów. <button onClick={() => router.push('/gym')} className="text-[#f5a03a] hover:underline">Zacznij pierwszy</button>.
          </div>
        )}

        {workouts?.map(w => {
          const open = openId === w.id
          const groups = groupSets(w.workout_sets ?? [])
          const date = new Date(w.started_at)
          return (
            <div key={w.id} className={`rounded-2xl border transition-colors ${open ? 'bg-[#0f0f0f] border-[#f5a03a]/20' : 'bg-[#0f0f0f] border-[#1a1a1a] hover:border-[#2a2a2a]'}`}>
              <button onClick={() => setOpenId(open ? null : w.id)} className="w-full text-left p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#f5a03a]/10 border border-[#f5a03a]/20 flex items-center justify-center text-[14px] flex-shrink-0">🏋️</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-[#ddd] truncate">{w.name}</div>
                  <div className="text-[10px] font-mono text-[#555]">
                    {relativeDay(w.started_at)} · {date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })} · {groups.length} ćw. · {Math.round((w.duration_seconds ?? 0) / 60)} min
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-display text-[15px] font-black">{Math.round(Number(w.total_tonnage ?? 0)).toLocaleString('pl-PL')}</div>
                  <div className="text-[8px] font-mono text-[#444] uppercase">kg tonaż</div>
                </div>
                <span className={`text-[#444] text-[12px] transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
              </button>

              {open && (
                <div className="px-4 pb-4 border-t border-[#161616] pt-3">
                  {groups.length === 0 && <p className="text-[11px] text-[#555]">Brak zapisanych serii.</p>}
                  <div className="grid gap-2 md:grid-cols-2">
                    {groups.map((g, i) => (
                      <div key={i} className="bg-[#131313] border border-[#1c1c1c] rounded-xl p-3">
                        <div className="text-[12px] font-medium text-[#ccc] mb-1.5">{g.name}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {g.sets.map(s => (
                            <span key={s.set_number} className="text-[10px] font-mono px-2 py-1 rounded-md bg-[#0a0a0a] border border-[#1e1e1e] text-[#999]">
                              {s.weight_kg != null ? `${Number(s.weight_kg)}kg × ` : ''}{s.reps ?? '?'}{s.rpe != null ? ` @${Number(s.rpe)}` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {w.notes && <p className="mt-3 text-[12px] text-[#888] whitespace-pre-wrap">{w.notes}</p>}
                  <div className="mt-3 flex justify-end">
                    <button onClick={() => handleDelete(w.id)} className="text-[10px] font-mono uppercase tracking-[1.3px] text-[#555] hover:text-red-400 transition-colors">Usuń trening</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
