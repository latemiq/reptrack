import { Level, Tile, fmtDay, fmtNum } from '@/components/trainer/stats/shared'
import { focusMeta } from '@/lib/plans'
import { PERIOD_LABEL, type BlockStat } from '@/lib/plan-stats'

/** One block: how much of it made it into the client's log. */
export default function MesoSection({ block }: { block: BlockStat }) {
  const { progress, period, weeks } = block
  const started = weeks[0].state !== 'future'
  return (
    <Level kicker="Mezocykl" title={block.name}
      sub={`${focusMeta(block.focus).label} · okres: ${PERIOD_LABEL[period].toLowerCase()} · ${fmtDay(weeks[0].start)}–${fmtDay(weeks[weeks.length - 1].end)}`}>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        <Tile label="Długość bloku" value={`${weeks.length} tyg.`} />
        <Tile label="Sesje" value={`${progress.done} / ${progress.due}`} sub="zapisane / po terminie" />
        <Tile label="Serie w bloku" value={started ? fmtNum(block.doneSets) : '—'} sub={`plan całego bloku: ${fmtNum(block.plannedSets)}`} />
      </div>
    </Level>
  )
}
