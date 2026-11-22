import { Level, Panel, fmtDay, fmtNum, td, th } from '@/components/trainer/stats/shared'
import { fmtKg, type StatSet } from '@/lib/gym-stats'
import { DAY_LABELS, formatPrescription } from '@/lib/plans'
import type { SessionStatus, WeekStat } from '@/lib/plan-stats'

const STATUS: Record<SessionStatus, { label: string; className: string }> = {
  done: { label: '✓ Zapisana', className: 'text-[#c8f53a]' },
  unlogged: { label: '– Brak zapisu', className: 'text-[#999]' },
  today: { label: '● Dziś', className: 'text-[#f0ece4]' },
  upcoming: { label: '○ Zaplanowana', className: 'text-[#777]' },
}

/** "3×5 · 100 kg", or every set when they differ. */
function describeSets(sets: StatSet[]): string {
  const same = sets.every(s => s.reps === sets[0].reps && Number(s.weight_kg ?? 0) === Number(sets[0].weight_kg ?? 0))
  const kg = (s: StatSet) => Number(s.weight_kg ?? 0)
  if (same) return `${sets.length}×${sets[0].reps ?? '?'}${kg(sets[0]) ? ` · ${fmtKg(kg(sets[0]))} kg` : ''}`
  return sets.map(s => `${s.reps ?? '?'}${kg(s) ? `×${fmtKg(kg(s))} kg` : ''}`).join(', ')
}

interface Props {
  week: WeekStat
  total: number
  onSelect: (index: number) => void
}

/** One week: every planned session next to what was really done. */
export default function MicroSection({ week, total, onSelect }: Props) {
  const nav = 'px-3 py-1.5 rounded-lg border border-[#222] text-[11px] text-[#999] cursor-pointer disabled:opacity-30 disabled:cursor-default'
  return (
    <Level kicker="Mikrocykl" title={`Tydzień ${week.index + 1} z ${total}`}
      sub={`${fmtDay(week.start)}–${fmtDay(week.end)}${week.state === 'current' ? ' · trwa' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <button className={nav} disabled={week.index === 0} onClick={() => onSelect(week.index - 1)}>← Poprzedni</button>
        <button className={nav} disabled={week.index === total - 1} onClick={() => onSelect(week.index + 1)}>Następny →</button>
        <p className="text-[12px] text-[#999]">Serie: {fmtNum(week.doneSets)} z {fmtNum(week.plannedSets)}</p>
      </div>

      {!week.sessions.length && <p className="text-[12px] text-[#777]">Brak zaplanowanych sesji w tym tygodniu.</p>}

      <div className="grid xl:grid-cols-2 gap-2.5">
        {week.sessions.map(s => {
          const movedTo = s.workout && new Date(s.workout.started_at)
          const moved = movedTo && movedTo.toDateString() !== s.date.toDateString()
          return (
            <Panel key={s.session.id} title={s.session.name}
              hint={`${DAY_LABELS[s.session.dayOfWeek - 1]} ${fmtDay(s.date)}${moved ? ` · zapis z ${fmtDay(movedTo)}` : ''}`}
              action={<span className={`text-[11px] ${STATUS[s.status].className}`}>{STATUS[s.status].label}</span>}>
              <table className="w-full">
                <thead>
                  <tr>{['Ćwiczenie', 'Plan', 'Zapis'].map(h => <th key={h} className={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {s.exercises.map((e, i) => {
                    const short = s.status === 'done' && e.planned && e.done.length < e.planned.sets
                    return (
                      <tr key={i}>
                        <td className={`${td} !whitespace-normal`}>{e.name}</td>
                        <td className={`${td} !whitespace-normal`}>{e.planned ? formatPrescription(e.planned) : 'poza planem'}</td>
                        <td className={`${td} !whitespace-normal`}>
                          {e.done.length ? describeSets(e.done) : '—'}
                          {short && <span className="block text-[10px] text-[#f5a03a]">{e.done.length} z {e.planned?.sets} serii</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Panel>
          )
        })}
      </div>

      {week.extra.length > 0 && (
        <Panel title="Treningi poza planem" hint="Wliczają się do serii tygodnia">
          <ul className="space-y-1 text-[12px] text-[#ccc]">
            {week.extra.map(w => <li key={w.id}>{fmtDay(new Date(w.started_at))} · {w.name} · serie: {w.workout_sets.length}</li>)}
          </ul>
        </Panel>
      )}
    </Level>
  )
}
