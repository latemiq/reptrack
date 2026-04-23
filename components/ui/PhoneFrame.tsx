'use client'

interface PhoneFrameProps {
  children?: React.ReactNode
  activePane?: number
}

const PANE_CONTENT = [
  {
    title: 'Dashboard',
    items: [
      { label: 'Tygodniowy vol.', value: '12 400 kg', accent: 'lime' },
      { label: 'Dystans', value: '38.2 km', accent: 'orange' },
      { label: 'Treningi', value: '5', accent: 'lime' },
    ],
    chart: [40, 65, 52, 80, 60, 90, 75],
  },
  {
    title: 'Siłownia',
    items: [
      { label: 'Martwy ciąg', value: '140 kg × 5', accent: 'lime' },
      { label: 'Wyciskanie', value: '90 kg × 8', accent: 'lime' },
      { label: 'Przysiad', value: '120 kg × 5', accent: 'lime' },
    ],
    chart: [55, 60, 70, 65, 75, 80, 78],
  },
  {
    title: 'Garmin Import',
    items: [
      { label: 'Dystans', value: '10.5 km', accent: 'orange' },
      { label: 'Tempo', value: '5:12 /km', accent: 'orange' },
      { label: 'Tętno śr.', value: '158 bpm', accent: 'orange' },
    ],
    chart: [30, 45, 60, 55, 70, 65, 80],
  },
  {
    title: 'AI Coach',
    items: [
      { label: 'Priorytet', value: 'Regeneracja', accent: 'lime' },
      { label: 'Progres', value: '+12% vol.', accent: 'lime' },
      { label: 'HRV trend', value: '↑ Dobry', accent: 'orange' },
    ],
    chart: [50, 55, 65, 70, 68, 80, 85],
  },
]

export function PhoneFrame({ activePane = 0 }: PhoneFrameProps) {
  const pane = PANE_CONTENT[activePane] ?? PANE_CONTENT[0]
  const maxBar = Math.max(...pane.chart)

  return (
    <div
      className="relative w-[260px] h-[520px] rounded-[44px] overflow-hidden"
      style={{
        background: '#0f0f0f',
        border: '1.5px solid #2a2a2a',
        boxShadow: '0 0 80px rgba(200,245,58,0.08), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      {/* Notch */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-b-2xl z-10" />

      {/* Status bar */}
      <div className="flex justify-between items-center px-6 pt-8 pb-2">
        <span className="text-[10px] font-dm-mono text-[#555]">9:41</span>
        <span className="text-[10px] font-dm-mono text-[#555]">●●●</span>
      </div>

      {/* App header */}
      <div className="px-5 pt-1 pb-3 border-b border-[#1e1e1e]">
        <div className="flex items-center justify-between">
          <span className="font-syne font-800 text-[13px] text-[#f0ece4]">RepTrack</span>
          <span className="text-[10px] font-dm-mono text-[#c8f53a]">{pane.title}</span>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-4 flex flex-col gap-3">
        {/* Mini bar chart */}
        <div className="flex items-end gap-1 h-16 mb-1">
          {pane.chart.map((v, i) => (
            <div key={i} className="flex-1 rounded-sm transition-all duration-500"
              style={{
                height: `${(v / maxBar) * 100}%`,
                background: i === pane.chart.length - 1 ? '#c8f53a' : '#1e1e1e',
              }}
            />
          ))}
        </div>

        {/* Stats */}
        {pane.items.map((item, i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b border-[#1a1a1a]">
            <span className="text-[11px] font-dm-sans text-[#555]">{item.label}</span>
            <span className={`text-[13px] font-syne font-bold ${item.accent === 'lime' ? 'text-[#c8f53a]' : 'text-[#f5a03a]'}`}>
              {item.value}
            </span>
          </div>
        ))}

        {/* Bottom nav */}
        <div className="absolute bottom-6 left-0 right-0 flex justify-around px-6">
          {['⊞', '🏋', '🏃', '✦'].map((icon, i) => (
            <button key={i} className={`text-[16px] ${i === activePane % 4 ? 'opacity-100' : 'opacity-30'}`}>
              {icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
