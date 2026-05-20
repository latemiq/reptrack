'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useNotificationsStore, selectUnreadCount } from '@/lib/stores/useNotificationsStore'

const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
        <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    href: '/gym',
    label: 'Siłownia',
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
        <rect x="1" y="8" width="3" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="16" y="8" width="3" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="4" y="6" width="3" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="13" y="6" width="3" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <line x1="7" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/running',
    label: 'Bieganie',
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
        <path d="M12 3a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 7l2-1.5 2 2-1.5 3 3 2M5 9l2.5-1 .5 3-3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/coach',
    label: 'AI Coach',
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
        <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8Z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 9.5C7 8.12 8.12 7 9.5 7S12 8.12 12 9.5c0 1-.6 1.85-1.5 2.24V13h-2v-1.26C7.6 11.35 7 10.5 7 9.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="10" cy="15.5" r=".75" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: '/notifications',
    label: 'Powiadomienia',
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
        <path d="M10 2a6 6 0 0 0-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 0 0-6-6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8.5 16.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const unreadCount = useNotificationsStore(selectUnreadCount)

  if (pathname.startsWith('/dashboard') || pathname.startsWith('/coach')) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 border-r border-[#1e1e1e] bg-[#0f0f0f] shrink-0">
        <div className="px-6 py-6 border-b border-[#1e1e1e]">
          <Link href="/" className="font-syne font-extrabold text-[#f0ece4] text-lg">
            Rep<span className="text-[#c8f53a]">Track</span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-dm-sans text-sm transition-all ${
                  active
                    ? 'bg-[#141414] text-[#c8f53a]'
                    : 'text-[#555] hover:text-[#f0ece4] hover:bg-[#141414]'
                }`}>
                <span className={`relative ${active ? 'text-[#c8f53a]' : 'text-[#333]'}`}>
                  {item.icon}
                  {item.href === '/notifications' && unreadCount > 0 ? (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-[8px] font-bold text-white flex items-center justify-center leading-none">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  ) : null}
                </span>
                {item.label}
                {active && (
                  <span className="ml-auto w-1 h-1 rounded-full bg-[#c8f53a]" />
                )}
              </Link>
            )
          })}
        </nav>

        <div className="px-6 py-5 border-t border-[#1e1e1e]">
          <div className="font-dm-mono text-[10px] text-[#333] uppercase tracking-widest">
            AI Fitness Tracker
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Desktop topbar */}
        <header className="hidden lg:flex items-center justify-between px-8 py-4 border-b border-[#1e1e1e] bg-[#0f0f0f] shrink-0">
          <div>
            <h1 className="font-syne font-bold text-[#f0ece4] text-base">
              {NAV_ITEMS.find((n) => pathname.startsWith(n.href))?.label ?? 'RepTrack'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-dm-mono text-[11px] text-[#555]">
              {new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <div className="w-8 h-8 rounded-full bg-[#141414] border border-[#1e1e1e] flex items-center justify-center">
              <span className="text-[#c8f53a] text-xs font-syne font-bold">U</span>
            </div>
          </div>
        </header>

        {/* Scrollable page */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0f0f0f] border-t border-[#1e1e1e] flex justify-around px-2 py-2 safe-area-bottom">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href}
              className={`flex flex-col items-center justify-center gap-1 min-w-[44px] min-h-[44px] px-3 py-2 rounded-xl transition-all ${
                active ? 'text-[#c8f53a]' : 'text-[#333]'
              }`}>
              <span className="relative">
                {item.icon}
                {item.href === '/notifications' && unreadCount > 0 ? (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-[8px] font-bold text-white flex items-center justify-center leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                ) : null}
              </span>
              <span className="font-dm-mono text-[9px] uppercase tracking-wider">
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
