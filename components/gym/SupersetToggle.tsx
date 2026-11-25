'use client'

/** Checkbox above an exercise picker: add the next exercise as a superset with the last one. */
export default function SupersetToggle({ partner, checked, onChange }: {
  /** Name of the exercise the new one would join; nothing renders without one. */
  partner: string | null | undefined
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  if (!partner) return null
  return (
    <label className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] cursor-pointer transition-colors ${
      checked ? 'border-[#f5a03a]/45 bg-[#f5a03a]/[0.08] text-[#f5a03a]' : 'border-[#222] text-[#999] hover:border-[#f5a03a]/30'
    }`}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="accent-[#f5a03a] w-4 h-4" />
      <span className="min-w-0 truncate">Superseria z: <b className="font-medium">{partner}</b></span>
    </label>
  )
}
