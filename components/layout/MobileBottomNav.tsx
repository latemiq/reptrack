'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useNotificationsStore, selectUnreadCount } from '@/lib/stores/useNotificationsStore'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  activeColor: string
}

function DashIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
      <rect x="2" y="2" width="7" height="7" rx="1.5" stroke={active ? '#c8f53a' : 'currentColor'} strokeWidth="1.5" />
      <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function GymIcon() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
      <rect x="1" y="8" width="3" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="16" y="8" width="3" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="4" y="6" width="3" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13" y="6" width="3" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <line x1="7" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function RunIcon() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
      <path d="M12 3a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 7l2-1.5 2 2-1.5 3 3 2M5 9l2.5-1 .5 3-3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CoachIcon() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
      <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 9.5C7 8.12 8.12 7 9.5 7S12 8.12 12 9.5c0 1-.6 1.85-1.5 2.24V13h-2v-1.26C7.6 11.35 7 10.5 7 9.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="10" cy="15.5" r=".75" fill="currentColor" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
      <path d="M10 2a6 6 0 0 0-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 0 0-6-6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8.5 16.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

const NAV_ITEMS = [
  { href: '/dashboard',      label: 'Home',    Icon: DashIcon,   activeColor: '#c8f53a' },
  { href: '/gym',            label: 'Siłownia', Icon: GymIcon,   activeColor: '#f5a03a' },
  { href: '/running',        label: 'Bieganie', Icon: RunIcon,   activeColor: '#c8f53a' },
  { href: '/coach',          label: 'Coach',   Icon: CoachIcon,  activeColor: '#c8f53a' },
  { href: '/notifications',  label: 'Powiad.', Icon: BellIcon,   activeColor: '#c8f53a' },
]

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function MobileBottomNav() {
  const pathname = usePathname()
  const unreadCount = useNotificationsStore(selectUnreadCount)

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-lg border-t border-[#1a1a1a] safe-area-bottom">
      <div className="flex justify-around items-center h-[62px] px-1 pt-1.5">
        {NAV_ITEMS.map(({ href, label, Icon, activeColor }) => {
          const isActive = isActiveRoute(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className="relative flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] px-2 py-1 rounded-lg"
            >
              <span
                className="text-[18px] leading-none transition-opacity relative"
                style={{ opacity: isActive ? 1 : 0.4, color: isActive ? activeColor : '#888' }}
              >
                <Icon active={isActive} />
                {href === '/notifications' && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-[8px] font-bold text-white flex items-center justify-center leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </span>
              <span
                className="text-[8.5px] font-mono uppercase tracking-[0.6px] leading-none"
                style={{ color: isActive ? '#F0ECE4' : '#555' }}
              >
                {label}
              </span>
              {isActive && (
                <span
                  className="absolute bottom-0.5 w-1 h-1 rounded-full"
                  style={{ background: activeColor }}
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
