'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/gym', label: 'Trening', icon: 'barbell' },
  { href: '/gym/history', label: 'Historia', icon: 'history' },
  { href: '/gym/templates', label: 'Szablony', icon: 'templates' },
  { href: '/gym/exercises', label: 'Ćwiczenia', icon: 'list' },
] as const

const ICONS: Record<(typeof TABS)[number]['icon'], React.ReactNode> = {
  barbell: <path d="M2 10h2m12 0h2M4 7v6m12-6v6M6.5 5.5v9m7-9v9M6.5 10h7" />,
  history: <><path d="M3.5 10a6.5 6.5 0 1 0 2-4.7L3.5 7.2" /><path d="M3.5 3.5v3.7h3.7M10 6.5V10l2.5 1.5" /></>,
  templates: <><rect x="3.5" y="3" width="13" height="14" rx="2" /><path d="M7 7h6M7 10h6M7 13h3.5" /></>,
  list: <path d="M7.5 5h9M7.5 10h9M7.5 15h9M3.5 5h.01M3.5 10h.01M3.5 15h.01" />,
}

/** Section switcher shared by all gym screens. */
export default function GymTabs() {
  const pathname = usePathname()
  const isActive = (href: string) => (href === '/gym' ? pathname === '/gym' : pathname.startsWith(href))
  return (
    <nav className="flex gap-1 p-1 rounded-2xl bg-[#0f0f0f] border border-[#1a1a1a]" aria-label="Sekcje siłowni">
      {TABS.map(t => {
        const active = isActive(t.href)
        return (
          <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] transition-colors ${
              active ? 'bg-[#c8f53a] text-[#0f1a00] font-medium' : 'text-[#777] hover:text-[#f0ece4] hover:bg-white/[0.03]'
            }`}>
            <svg className="hidden min-[440px]:block" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {ICONS[t.icon]}
            </svg>
            <span>{t.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
