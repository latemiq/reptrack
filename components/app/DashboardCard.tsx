interface DashboardCardProps {
  label: string
  value: string | number
  suffix?: string
  sub?: string
  accent?: 'lime' | 'orange'
  children?: React.ReactNode
}

export function DashboardCard({ label, value, suffix, sub, accent = 'lime', children }: DashboardCardProps) {
  const accentColor = accent === 'lime' ? '#c8f53a' : '#f5a03a'

  return (
    <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-5 flex flex-col gap-3 hover:border-[#2a2a2a] transition-colors">
      <div className="font-dm-mono text-[11px] text-[#555] uppercase tracking-widest">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="font-syne font-extrabold text-3xl" style={{ color: accentColor }}>
          {typeof value === 'number' ? value.toLocaleString('pl') : value}
        </span>
        {suffix && (
          <span className="font-dm-mono text-sm text-[#555]">{suffix}</span>
        )}
      </div>
      {sub && (
        <div className="font-dm-sans text-xs text-[#555]">{sub}</div>
      )}
      {children}
    </div>
  )
}
