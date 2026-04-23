interface ActivityItemProps {
  type: 'gym' | 'run'
  title: string
  meta: string
  value: string
  valueSuffix?: string
  date: string
}

export function ActivityItem({ type, title, meta, value, valueSuffix, date }: ActivityItemProps) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-[#1e1e1e] last:border-0">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 ${
        type === 'gym' ? 'bg-[#c8f53a]/10 text-[#c8f53a]' : 'bg-[#f5a03a]/10 text-[#f5a03a]'
      }`}>
        {type === 'gym' ? '🏋' : '🏃'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-dm-sans text-sm text-[#f0ece4] truncate">{title}</div>
        <div className="font-dm-mono text-[10px] text-[#555] truncate">{meta}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-syne font-bold text-sm" style={{ color: type === 'gym' ? '#c8f53a' : '#f5a03a' }}>
          {value}<span className="font-dm-mono font-normal text-[#555] text-xs ml-0.5">{valueSuffix}</span>
        </div>
        <div className="font-dm-mono text-[10px] text-[#555]">{date}</div>
      </div>
    </div>
  )
}
