'use client'

import { Bar, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtNum } from '@/components/trainer/stats/shared'

// Checked with a colour-blindness validator on #0f0f0f. The app's bright lime is too light for a data mark there.
export const SERIES = { planned: '#8a7ff0', done: '#7f9e22' }

export interface ChartPoint {
  week: number
  /** Tooltip heading: week, dates and block. */
  title: string
  planned?: number | null
  done: number | null
}

interface Props {
  points: ChartPoint[]
  kind: 'bars' | 'lines'
  selectedWeek: number
  onSelect: (index: number) => void
  unit?: string
  doneLabel?: string
}

/** One measure over the weeks of a plan. Volume and intensity get a chart each, never a second y-axis. */
export default function WeekChart({ points, kind, selectedWeek, onSelect, unit = '', doneLabel = 'Wykonanie' }: Props) {
  const series = [
    ...(points.some(p => p.planned !== undefined) ? [{ key: 'planned' as const, name: 'Plan' }] : []),
    { key: 'done' as const, name: doneLabel },
  ]
  return (
    <>
      <div className="h-[210px] cursor-pointer">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} barGap={2} accessibilityLayer margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            onClick={e => { if (typeof e?.activeTooltipIndex === 'number') onSelect(e.activeTooltipIndex) }}>
            <CartesianGrid stroke="#1e1e1e" vertical={false} />
            {/* A category is a band under bars but a single point under lines. */}
            {kind === 'bars'
              ? <ReferenceArea x1={selectedWeek} x2={selectedWeek} fill="#ffffff" fillOpacity={0.05} ifOverflow="visible" />
              : <ReferenceLine x={selectedWeek} stroke="#444" />}
            <XAxis dataKey="week" tick={{ fill: '#777', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#262626' }} minTickGap={8} />
            <YAxis width={56} tick={{ fill: '#777', fontSize: 11 }} tickLine={false} axisLine={false}
              domain={kind === 'bars' ? [0, 'auto'] : ['auto', 'auto']} tickFormatter={v => (unit === ' kg' && v >= 1000 ? `${fmtNum(v / 1000, 1)} t` : `${fmtNum(v)}${unit}`)} />
            <Tooltip
              cursor={kind === 'bars' ? { fill: '#ffffff08' } : { stroke: '#444' }}
              contentStyle={{ background: '#131313', border: '1px solid #262626', borderRadius: 12, fontSize: 12 }}
              labelStyle={{ color: '#999' }}
              itemStyle={{ color: '#f0ece4' }}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.title ?? ''}
              formatter={(v, name) => [`${fmtNum(Number(v), 1)}${unit}`, name]}
            />
            {series.map(s => kind === 'bars'
              ? <Bar key={s.key} dataKey={s.key} name={s.name} fill={SERIES[s.key]} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              : (
                <Line key={s.key} dataKey={s.key} name={s.name} stroke={SERIES[s.key]} strokeWidth={2} isAnimationActive={false}
                  dot={{ r: 4, fill: SERIES[s.key], stroke: '#0f0f0f', strokeWidth: 2 }} activeDot={{ r: 6, fill: SERIES[s.key] }} />
              ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-[#999]">
        {series.length > 1 && series.map(s => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: SERIES[s.key] }} />{s.name}
          </span>
        ))}
        <span className="ml-auto text-[#777]">oś pozioma: tydzień planu</span>
      </div>
    </>
  )
}
