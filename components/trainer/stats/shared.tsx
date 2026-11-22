import type { ReactNode } from 'react'

export const fmtDay = (d: Date) => d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })

export const fmtNum = (v: number | null | undefined, digits = 0) =>
  v == null ? '—' : v.toLocaleString('pl-PL', { maximumFractionDigits: digits })

export const th = 'px-2 py-2 text-left text-[10px] font-mono uppercase tracking-[1.3px] font-normal text-[#777] whitespace-nowrap'
export const td = 'px-2 py-2 text-[12px] text-[#ccc] tabular-nums whitespace-nowrap border-t border-[#1a1a1a]'

export function Panel({ title, hint, action, children }: { title: string; hint?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0 bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h3 className="text-[13px] font-medium text-[#ddd]">{title}</h3>
          {hint && <p className="text-[11px] text-[#777] mt-0.5">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

export function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 bg-[#131313] border border-[#1c1c1c] rounded-xl px-3 py-2.5">
      <div className="text-[9px] font-mono uppercase tracking-[1.3px] text-[#777]">{label}</div>
      <div className="text-[22px] font-semibold text-[#f0ece4] mt-0.5">{value}</div>
      {sub && <div className="text-[11px] text-[#777]">{sub}</div>}
    </div>
  )
}

export function Level({ kicker, title, sub, children }: { kicker: string; title: string; sub?: string; children: ReactNode }) {
  return (
    <section aria-label={kicker} className="space-y-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-4">
        <span className="text-[10px] font-mono uppercase tracking-[2px] text-[#c8f53a]">{kicker}</span>
        <h2 className="font-display text-[17px] font-black">{title}</h2>
        {sub && <span className="text-[11px] text-[#777]">{sub}</span>}
      </div>
      {children}
    </section>
  )
}
