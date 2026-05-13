interface ProgressBarProps {
  value: number
  max: number
  label?: string
  accent?: 'lime' | 'orange'
  showPercent?: boolean
}

export function ProgressBar({ value, max, label, accent = 'lime', showPercent }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0
  const color = accent === 'lime' ? '#c8f53a' : '#f5a03a'

  return (
    <div className="flex flex-col gap-1.5">
      {(label || showPercent) && (
        <div className="flex justify-between items-center">
          {label && <span className="font-dm-sans text-xs text-[#555]">{label}</span>}
          {showPercent && <span className="font-dm-mono text-[11px]" style={{ color }}>{pct}%</span>}
        </div>
      )}
      <div className="w-full h-1.5 bg-[#1e1e1e] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}
