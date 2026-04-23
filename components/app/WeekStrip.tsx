'use client'

interface WeekStripProps {
  activeDays?: number[]
}

const DAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd']

export function WeekStrip({ activeDays = [] }: WeekStripProps) {
  const today = new Date().getDay()
  const todayIdx = today === 0 ? 6 : today - 1

  return (
    <div className="flex gap-1">
      {DAYS.map((day, i) => {
        const isToday = i === todayIdx
        const isActive = activeDays.includes(i)
        return (
          <div key={day} className="flex flex-col items-center gap-1 flex-1">
            <span className="font-dm-mono text-[9px] text-[#555] uppercase tracking-wider">{day}</span>
            <div
              className={`w-full aspect-square rounded-md flex items-center justify-center text-[9px] font-dm-mono transition-colors ${
                isToday
                  ? 'bg-[#c8f53a] text-black'
                  : isActive
                  ? 'bg-[#1e1e1e] border border-[#c8f53a]/30 text-[#c8f53a]'
                  : 'bg-[#0f0f0f] border border-[#1e1e1e] text-[#333]'
              }`}
            >
              {isActive && !isToday ? '✓' : ''}
            </div>
          </div>
        )
      })}
    </div>
  )
}
