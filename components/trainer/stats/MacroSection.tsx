'use client'

import { useState } from 'react'
import WeekChart from '@/components/trainer/stats/WeekChart'
import { Level, Panel, Tile, fmtDay, fmtNum, td, th } from '@/components/trainer/stats/shared'
import { focusMeta, type Macrocycle } from '@/lib/plans'
import { PERIOD_LABEL, type Period, type PlanStats } from '@/lib/plan-stats'

type Metric = 'sets' | 'reps' | 'tonnage'

const METRICS: { key: Metric; label: string; unit: string; hint: string }[] = [
  { key: 'sets', label: 'Serie', unit: '', hint: 'Liczba serii w tygodniu' },
  { key: 'reps', label: 'Powtórzenia', unit: '', hint: 'Suma powtórzeń w tygodniu. Dla zakresu, np. 6–8, plan liczy środek.' },
  { key: 'tonnage', label: 'Tonaż', unit: ' kg', hint: 'Ciężar × powtórzenia. Bez ćwiczeń, dla których nie ma ciężaru.' },
]

interface Props {
  plan: Macrocycle
  stats: PlanStats
  selectedWeek: number
  onSelect: (index: number) => void
}

/** Whole plan: timeline of periods and blocks, volume vs. intensity curves, strength trend. */
export default function MacroSection({ plan, stats, selectedWeek, onSelect }: Props) {
  const [metric, setMetric] = useState<Metric>('sets')
  const [liftId, setLiftId] = useState('')
  const { weeks, blocks, progress, currentWeek } = stats
  const running = currentWeek >= 0 && currentWeek < weeks.length
  const measure = METRICS.find(m => m.key === metric) ?? METRICS[0]
  const lift = stats.lifts.find(l => l.id === liftId) ?? stats.lifts[0]

  // Neighbouring blocks of the same period share one band.
  const periods: { period: Period; weeks: number }[] = []
  for (const b of blocks) {
    const last = periods[periods.length - 1]
    if (last?.period === b.guide.period) last.weeks += b.weeks.length
    else periods.push({ period: b.guide.period, weeks: b.weeks.length })
  }

  const point = (i: number) => {
    const w = weeks[i]
    const state = w.state === 'current' ? ' · trwa' : ''
    return { week: i + 1, title: `Tydzień ${i + 1} · ${fmtDay(w.start)}–${fmtDay(w.end)} · ${blocks[w.block].name}${state}` }
  }
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—')
  const now = running ? weeks[currentWeek] : null

  return (
    <Level kicker="Makrocykl" title={plan.name} sub={`${fmtDay(weeks[0].start)} – ${fmtDay(weeks[weeks.length - 1].end)}${plan.goal ? ` · ${plan.goal}` : ''}`}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Tile label="Tydzień planu"
          value={running ? `${currentWeek + 1} z ${weeks.length}` : currentWeek < 0 ? 'Przed startem' : 'Zakończony'}
          sub={now ? blocks[now.block].name : undefined} />
        <Tile label="Zrealizowane sesje" value={pct(progress.done, progress.due)} sub={`${progress.done} z ${progress.due}, których termin minął`} />
        <Tile label="Zrealizowane serie" value={pct(progress.doneSets, progress.plannedSets)} sub={`${progress.doneSets} z ${progress.plannedSets} zaplanowanych`} />
        <Tile label="Intensywność w tym tygodniu"
          value={now?.done?.intensity ? `${fmtNum(now.done.intensity)}%` : '—'}
          sub={now?.planned.intensity ? `plan: ${fmtNum(now.planned.intensity)}% 1RM` : 'średni % 1RM'} />
      </div>

      <Panel title="Oś makrocyklu" hint="Okres wynika z celu bloku. Kliknij blok albo tydzień, żeby zobaczyć szczegóły.">
        <div className="overflow-x-auto pb-1">
          <div style={{ minWidth: weeks.length * 28 }} className="space-y-1">
            <div className="flex">
              {periods.map((p, i) => p.weeks > 0 && (
                <div key={i} style={{ width: `${(p.weeks / weeks.length) * 100}%` }} className="px-px min-w-0" title={PERIOD_LABEL[p.period]}>
                  <div className="truncate text-[10px] font-mono uppercase tracking-[1.3px] text-[#999] border-b border-[#333] pb-1">{PERIOD_LABEL[p.period]}</div>
                </div>
              ))}
            </div>
            <div className="flex">
              {blocks.map(b => {
                if (!b.weeks.length) return null
                const f = focusMeta(b.focus)
                const active = weeks[selectedWeek].block === b.index
                const target = b.weeks.find(w => w.state === 'current') ?? b.weeks[0]
                return (
                  <div key={b.id} style={{ width: `${(b.weeks.length / weeks.length) * 100}%` }} className="px-px min-w-0">
                    <button onClick={() => onSelect(target.index)} aria-pressed={active} title={`${b.name} · ${f.label} · ${b.weeks.length} tyg.`}
                      className="w-full h-11 rounded-md border px-2 text-left cursor-pointer"
                      style={{ background: active ? `${f.color}33` : `${f.color}14`, borderColor: active ? f.color : `${f.color}44` }}>
                      <span className="block truncate text-[12px] text-[#f0ece4]">{b.name}</span>
                      <span className="block truncate text-[10px] text-[#999]">{f.label}</span>
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="flex">
              {weeks.map(w => (
                <div key={w.index} style={{ width: `${100 / weeks.length}%` }} className="px-px">
                  <button onClick={() => onSelect(w.index)} aria-pressed={w.index === selectedWeek}
                    aria-label={`Tydzień ${w.index + 1}${w.state === 'current' ? ', trwa' : ''}`}
                    className={`w-full h-8 rounded-md border text-[11px] tabular-nums cursor-pointer ${
                      w.index === selectedWeek ? 'bg-[#c8f53a] border-[#c8f53a] text-[#080808]'
                        : w.state === 'current' ? 'border-[#c8f53a] text-[#c8f53a]'
                        : w.state === 'past' ? 'bg-[#161616] border-[#222] text-[#999]' : 'border-[#1e1e1e] text-[#777]'}`}>
                    {w.index + 1}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid lg:grid-cols-2 gap-2.5">
        <Panel title="Objętość" hint={measure.hint} action={
          <div className="flex gap-1" role="group" aria-label="Miara objętości">
            {METRICS.map(m => (
              <button key={m.key} onClick={() => setMetric(m.key)} aria-pressed={m.key === metric}
                className={`px-2 py-1 rounded-lg border text-[11px] cursor-pointer ${m.key === metric ? 'border-[#c8f53a]/30 bg-[#c8f53a]/10 text-[#c8f53a]' : 'border-[#222] text-[#777]'}`}>
                {m.label}
              </button>
            ))}
          </div>
        }>
          <WeekChart kind="bars" unit={measure.unit} selectedWeek={selectedWeek + 1} onSelect={onSelect}
            points={weeks.map(w => ({ ...point(w.index), planned: w.planned[metric], done: w.done?.[metric] ?? null }))} />
        </Panel>

        <Panel title="Intensywność" hint="Średni % 1RM ważony powtórzeniami. 1RM szacowane z ostatnich 12 tygodni, z serii do 12 powtórzeń.">
          <WeekChart kind="lines" unit="%" selectedWeek={selectedWeek + 1} onSelect={onSelect}
            points={weeks.map(w => ({ ...point(w.index), planned: w.planned.intensity, done: w.done?.intensity ?? null }))} />
        </Panel>
      </div>

      {lift && (
        <Panel title="Siła w trakcie makrocyklu" hint="Najlepsze szacowane 1RM w każdym tygodniu" action={
          <select value={lift.id} onChange={e => setLiftId(e.target.value)} aria-label="Ćwiczenie"
            className="max-w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-2 py-1 text-[12px] text-[#ccc] [color-scheme:dark]">
            {stats.lifts.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        }>
          <WeekChart kind="lines" unit=" kg" doneLabel="Szacowane 1RM" selectedWeek={selectedWeek + 1} onSelect={onSelect}
            points={weeks.map(w => ({ ...point(w.index), done: w.best.get(lift.id) ?? null }))} />
        </Panel>
      )}

      <details className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-4">
        <summary className="text-[12px] text-[#999] cursor-pointer">Wszystkie tygodnie w tabeli</summary>
        <div className="overflow-x-auto mt-2">
          <table className="w-full">
            <thead>
              <tr>{['Tydz.', 'Blok', 'Sesje', 'Serie', 'Powtórzenia', 'Tonaż (kg)', '% 1RM'].map(h => <th key={h} className={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {weeks.map(w => (
                <tr key={w.index}>
                  <td className={td}>{w.index + 1}{w.state === 'current' ? ' (trwa)' : ''}</td>
                  <td className={td}>{blocks[w.block].name}</td>
                  <td className={td}>{w.done ? w.sessions.filter(s => s.status === 'done').length : '—'} / {w.sessions.length}</td>
                  {(['sets', 'reps', 'tonnage', 'intensity'] as const).map(k => (
                    <td key={k} className={td}>{fmtNum(w.done?.[k])} / {fmtNum(w.planned[k])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-[#777] mt-2">W każdej kolumnie: wykonanie / plan.</p>
        </div>
      </details>
    </Level>
  )
}
