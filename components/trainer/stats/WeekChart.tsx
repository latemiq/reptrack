'use client'

import { Bar, BarChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtNum } from '@/components/trainer/stats/shared'

// Checked with a colour-blindness validator on #0f0f0f. The app's bright lime is too light for a data mark there.
const SERIES = [
  { key: 'planned', name: 'Plan', color: '#8a7ff0' },
  { key: 'done', name: 'Zapis', color: '#7f9e22' },
] as const

export interface ChartPoint {
  week: number
  /** Tooltip heading: week, dates and block. */
  title: string
  planned: number
  done: number | null
}

interface Props {
  points: ChartPoint[]
  selectedWeek: number
  onSelect: (index: number) => void
}

/** Planned vs. logged sets over the weeks of a plan. */
export default function WeekChart({ points, selectedWeek, onSelect }: Props) {
  return (
    <>
      <div className="h-[210px] cursor-pointer">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} barGap={2} accessibilityLayer margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            onClick={e => { if (typeof e?.activeTooltipIndex === 'number') onSelect(e.activeTooltipIndex) }}>
            <CartesianGrid stroke="#1e1e1e" vertical={false} />
            <ReferenceArea x1={selectedWeek} x2={selectedWeek} fill="#ffffff" fillOpacity={0.05} ifOverflow="visible" />
            <XAxis dataKey="week" tick={{ fill: '#777', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#262626' }} minTickGap={8} />
            <YAxis width={40} allowDecimals={false} tick={{ fill: '#777', fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: '#ffffff08' }}
              contentStyle={{ background: '#131313', border: '1px solid #262626', borderRadius: 12, fontSize: 12 }}
              labelStyle={{ color: '#999' }}
              itemStyle={{ color: '#f0ece4' }}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.title ?? ''}
              formatter={(v, name) => [fmtNum(Number(v)), name]}
            />
            {SERIES.map(s => (
              <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-[#999]">
        {SERIES.map(s => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />{s.name}
          </span>
        ))}
        <span className="ml-auto text-[#777]">oś pozioma: tydzień planu</span>
      </div>
    </>
  )
}
