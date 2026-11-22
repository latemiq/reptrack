import { Level, Panel, Tile, fmtDay, fmtNum, td, th } from '@/components/trainer/stats/shared'
import { focusMeta } from '@/lib/plans'
import { PERIOD_LABEL, type BlockStat, type Load } from '@/lib/plan-stats'

type Range = [number, number]

function Value({ value, range, unit = '' }: { value: number | null; range?: Range; unit?: string }) {
  if (value == null) return <>—</>
  const shown = Math.round(value * 10) / 10
  const verdict = !range ? null : shown < range[0] ? '↓ poniżej' : shown > range[1] ? '↑ powyżej' : '✓ w zakresie'
  return (
    <>
      {fmtNum(shown, 1)}{unit}
      {verdict && <span className={`block text-[10px] ${verdict.startsWith('✓') ? 'text-[#999]' : 'text-[#f5a03a]'}`}>{verdict}</span>}
    </>
  )
}

const RANGE_ROWS: { label: string; key: keyof Load; guide: 'intensity' | 'reps' | 'sets'; unit: string }[] = [
  { label: 'Intensywność', key: 'intensity', guide: 'intensity', unit: '%' },
  { label: 'Powt. w serii', key: 'repsPerSet', guide: 'reps', unit: '' },
  { label: 'Serie na ćwiczenie', key: 'setsPerExercise', guide: 'sets', unit: '' },
]

/** One block: is its load right for the phase, and did it bring strength gains. */
export default function MesoSection({ block }: { block: BlockStat }) {
  const { progress, guide, weeks } = block
  const started = weeks[0].state !== 'future'
  const hasRanges = RANGE_ROWS.some(r => guide[r.guide])
  return (
    <Level kicker="Mezocykl" title={block.name}
      sub={`${focusMeta(block.focus).label} · okres: ${PERIOD_LABEL[guide.period].toLowerCase()} · ${fmtDay(weeks[0].start)}–${fmtDay(weeks[weeks.length - 1].end)}`}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Tile label="Długość bloku" value={`${weeks.length} tyg.`} />
        <Tile label="Sesje" value={`${progress.done} / ${progress.due}`} sub="zrobione / po terminie" />
        <Tile label="Serie w bloku" value={started ? fmtNum(block.done.sets) : '—'} sub={`plan: ${fmtNum(block.planned.sets)}`} />
        <Tile label="Tonaż bloku" value={started ? `${fmtNum(block.done.tonnage)} kg` : '—'} sub={`plan: ${fmtNum(block.planned.tonnage)} kg`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-2.5">
        <Panel title="Obciążenie a cel bloku"
          hint={hasRanges
            ? 'Zakresy wg NSCA (CSCS, rozdz. 21). Średnie ze wszystkich ćwiczeń, więc akcesoria podnoszą liczbę powtórzeń.'
            : 'Dla tego celu nie ma zakresów referencyjnych.'}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>{['Parametr', 'Zakres', 'Plan', 'Wykonanie'].map(h => <th key={h} className={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {RANGE_ROWS.map(r => {
                  const range = guide[r.guide]
                  return (
                    <tr key={r.key}>
                      <td className={`${td} !whitespace-normal`}>{r.label}</td>
                      <td className={td}>{range ? `${range[0]}–${range[1]}${r.unit}` : '—'}</td>
                      <td className={td}><Value value={block.planned[r.key]} range={range} unit={r.unit} /></td>
                      <td className={td}><Value value={started ? block.done[r.key] : null} range={range} unit={r.unit} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Zmiana siły w bloku" hint="Szacowane 1RM: pierwszy → ostatni tydzień z danym ćwiczeniem">
          {block.gains.length ? (
            <table className="w-full">
              <tbody>
                {block.gains.map(g => (
                  <tr key={g.id}>
                    <td className={`${td} !whitespace-normal`}>{g.name}</td>
                    <td className={`${td} text-right`}>{fmtNum(g.from, 1)} → {fmtNum(g.to, 1)} kg</td>
                    <td className={`${td} text-right`}>
                      {g.percent >= 0.05 ? '↑ +' : g.percent <= -0.05 ? '↓ ' : ''}{fmtNum(g.percent, 1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-[12px] text-[#777]">Pojawi się, gdy to samo ćwiczenie z ciężarem będzie zrobione w dwóch różnych tygodniach bloku.</p>}
        </Panel>
      </div>
    </Level>
  )
}
