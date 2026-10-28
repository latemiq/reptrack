'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fmtDuration, fmtPace } from '@/lib/stats'

interface RunRow {
  id: string
  name: string
  ran_at: string
  distance_km: number | string
  duration_seconds: number
  avg_pace_seconds_per_km: number | null
  avg_hr: number | null
  max_hr: number | null
  elevation_gain_m: number | string | null
  calories: number | null
  location: string | null
  type: string | null
  source: string | null
  notes: string | null
}

const TYPE_LABELS: Record<string, string> = {
  easy: 'Spokojny', tempo: 'Tempo', long: 'Długi', interval: 'Interwały', recovery: 'Regeneracyjny', race: 'Zawody',
}

export default function RunDetail({ id }: { id: string }) {
  const router = useRouter()
  const [run, setRun] = useState<RunRow | null>(null)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch(`/api/running/${id}`)
      .then(async res => {
        if (res.status === 404) throw new Error('Nie znaleziono biegu')
        if (!res.ok) throw new Error('Nie udało się wczytać biegu')
        return res.json()
      })
      .then(d => setRun(d.run))
      .catch(e => setError(e.message))
  }, [id])

  const handleDelete = async () => {
    if (!confirm('Usunąć ten bieg? Tej operacji nie można cofnąć.')) return
    setDeleting(true)
    const res = await fetch(`/api/running/${id}`, { method: 'DELETE' }).catch(() => null)
    if (res?.ok) {
      router.push('/running')
    } else {
      setDeleting(false)
      setError('Nie udało się usunąć biegu')
    }
  }

  if (error && !run) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <h1 className="font-display text-[22px] font-black mb-2">{error}</h1>
        <button onClick={() => router.push('/running')} className="mt-3 text-[11px] font-mono uppercase tracking-[1.5px] text-[#f5a03a] hover:underline">← Wróć do biegów</button>
      </div>
    )
  }

  if (!run) {
    return <div className="px-4 md:px-7 py-6"><div className="h-[300px] rounded-2xl bg-[#0f0f0f] border border-[#1a1a1a] animate-pulse" /></div>
  }

  const km = Number(run.distance_km)
  const pace = run.avg_pace_seconds_per_km ?? (km > 0 ? run.duration_seconds / km : null)
  const ranAt = new Date(run.ran_at)

  const stats: [string, string][] = [
    ['Dystans', `${km.toFixed(2)} km`],
    ['Czas', fmtDuration(run.duration_seconds)],
    ['Tempo', pace ? `${fmtPace(pace)} /km` : '—'],
    ['Prędkość', run.duration_seconds ? `${(km / (run.duration_seconds / 3600)).toFixed(1)} km/h` : '—'],
    ['Śr. tętno', run.avg_hr ? `${run.avg_hr} bpm` : '—'],
    ['Maks. tętno', run.max_hr ? `${run.max_hr} bpm` : '—'],
    ['Przewyższenie', run.elevation_gain_m != null ? `${Number(run.elevation_gain_m)} m` : '—'],
    ['Kalorie', run.calories ? `${run.calories} kcal` : '—'],
  ]

  return (
    <div className="min-h-full bg-[#080808] text-[#f0ece4]">
      <div className="px-4 md:px-7 pt-5 md:pt-6 pb-2 flex flex-wrap gap-3 justify-between items-end">
        <div>
          <button onClick={() => router.push('/running')} className="text-[10px] font-mono text-[#444] uppercase tracking-[2px] mb-1 hover:text-[#f5a03a]">← Bieganie</button>
          <h1 className="font-display text-[24px] font-black">{run.name}</h1>
          <p className="text-[11px] font-mono text-[#666] mt-1">
            {ranAt.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {' · '}{ranAt.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
            {run.location && ` · ${run.location}`}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <span className="px-2.5 py-1 rounded-md text-[9px] font-mono uppercase tracking-[1px] bg-[#f5a03a]/[0.08] border border-[#f5a03a]/25 text-[#f5a03a]">
            {TYPE_LABELS[run.type ?? 'easy'] ?? run.type}
          </span>
          <button onClick={handleDelete} disabled={deleting}
            className="px-4 py-2 rounded-lg bg-[#111] border border-[#1e1e1e] text-[#888] text-[11px] font-mono uppercase tracking-[1.3px] hover:border-red-500/30 hover:text-red-400 transition-all disabled:opacity-50">
            {deleting ? 'Usuwam...' : 'Usuń'}
          </button>
        </div>
      </div>

      <div className="px-4 md:px-7 pb-7 pt-3 space-y-3">
        {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] text-red-400">{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {stats.map(([label, value], i) => (
            <div key={label} className={`rounded-2xl p-4 border ${i === 0 ? 'bg-[#f5a03a]/[0.04] border-[#f5a03a]/20' : 'bg-[#0f0f0f] border-[#1a1a1a]'}`}>
              <div className="text-[9px] font-mono text-[#444] uppercase tracking-[1.3px] mb-2">{label}</div>
              <div className={`font-display text-[22px] font-black leading-none ${i === 0 ? 'text-[#f5a03a]' : 'text-[#f0ece4]'}`}>{value}</div>
            </div>
          ))}
        </div>

        {run.notes && (
          <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-4">
            <div className="text-[9px] font-mono text-[#444] uppercase tracking-[1.3px] mb-2">Notatki</div>
            <p className="text-[13px] text-[#ccc] whitespace-pre-wrap">{run.notes}</p>
          </div>
        )}

        <div className="text-[9px] font-mono text-[#333] uppercase tracking-[1.5px]">
          Źródło: {run.source === 'manual' || !run.source ? 'wpis ręczny' : run.source}
        </div>
      </div>
    </div>
  )
}
