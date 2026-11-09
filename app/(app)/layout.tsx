'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useUser, useClerk } from '@clerk/nextjs'
import { useNotificationsStore, selectUnreadCount } from '@/lib/stores/useNotificationsStore'
import InstallPrompt from '@/components/pwa/InstallPrompt'
import { pendingMfaRedirect } from '@/lib/mfa-client'

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
    href: '/goals',
    label: 'Cele',
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="10" cy="10" r="1" fill="currentColor" />
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

const ACCOUNT_ITEMS = [
  {
    href: '/profile',
    label: 'Profil',
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
        <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 17c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Ustawienia',
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
]

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  /** Custom active check; defaults to href prefix match. */
  match?: (pathname: string) => boolean
}

const isPlanRoute = (p: string) => p.startsWith('/trainer/plans') || /^\/trainer\/[^/]+\/plans(\/|$)/.test(p)

// role = 'trainer' gets a separate app: stats, clients and planning — no own workouts.
const TRAINER_NAV: NavItem[] = [
  {
    href: '/trainer',
    label: 'Pulpit',
    match: p => p === '/trainer',
    icon: NAV_ITEMS[0].icon,
  },
  {
    href: '/trainer/clients',
    label: 'Podopieczni',
    match: p => p.startsWith('/trainer/') && !isPlanRoute(p),
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
        <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="14" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2 16c0-2.76 2.24-5 5-5s5 2.24 5 5M12.5 12.2c.47-.13.97-.2 1.5-.2 2.21 0 4 1.79 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/trainer/plans',
    label: 'Plany',
    match: isPlanRoute,
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
        <rect x="2.5" y="3.5" width="15" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2.5 7.5h15M6.5 2v3M13.5 2v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M6 11h3M6 14h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
]
const TRAINER_ACCOUNT: NavItem[] = ACCOUNT_ITEMS.filter(i => i.href === '/settings')

/** Paths a trainer may open; anything else redirects to the trainer home. */
const isTrainerAllowed = (p: string) => p === '/trainer' || p.startsWith('/trainer/') || p.startsWith('/settings')

function isActive(pathname: string, item: NavItem) {
  return item.match ? item.match(pathname) : pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useUser()
  const { signOut } = useClerk()
  const unreadCount = useNotificationsStore(selectUnreadCount)
  const fetchNotifications = useNotificationsStore(s => s.fetchNotifications)

  useEffect(() => { fetchNotifications() }, [fetchNotifications, pathname])

  // null until loaded, so a trainer never sees the athlete menu flash.
  const [role, setRole] = useState<'athlete' | 'trainer' | null>(null)
  useEffect(() => {
    const loadRole = () =>
      fetch('/api/profile')
        .then(r => (r.ok ? r.json() : null))
        .then(d => setRole(d?.profile?.role === 'trainer' ? 'trainer' : 'athlete'))
        .catch(() => setRole('athlete'))
    loadRole()
    window.addEventListener('reptrack:role-changed', loadRole)
    return () => window.removeEventListener('reptrack:role-changed', loadRole)
  }, [])
  const isTrainer = role === 'trainer'

  useEffect(() => {
    if (isTrainer && !isTrainerAllowed(pathname)) router.replace('/trainer')
  }, [isTrainer, pathname, router])

  // Users with 2FA must pass the second step before the app shows anything —
  // the API refuses data until then, so send them to the verification screen.
  useEffect(() => {
    pendingMfaRedirect(pathname).then(to => { if (to) router.replace(to) })
  }, [pathname, router])

  const sidebarItems: NavItem[] = role === null ? [] : isTrainer ? TRAINER_NAV : NAV_ITEMS
  const accountItems: NavItem[] = role === null ? [] : isTrainer ? TRAINER_ACCOUNT : ACCOUNT_ITEMS
  const mobileItems: NavItem[] = role === null ? []
    : isTrainer ? [...TRAINER_NAV, ...TRAINER_ACCOUNT]
    : [...NAV_ITEMS.filter(i => i.href !== '/notifications'), ACCOUNT_ITEMS[0]]
  const profileHref = isTrainer ? '/settings' : '/profile'
  const activeNavItem = [...sidebarItems, ...accountItems].find(item => isActive(pathname, item))

  const userInitials = user
    ? (`${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`).toUpperCase() ||
      user.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() || 'U'
    : 'U'
  const displayName = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Profil' : '...'
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? ''

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
          {sidebarItems.map((item) => {
            const active = isActive(pathname, item)
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

        <div className="mt-auto border-t border-[#1e1e1e] px-3 pt-3 pb-4 flex flex-col gap-1">
          <p className="px-3 pb-1 text-[9px] font-dm-mono text-[#2a2a2a] uppercase tracking-[2px]">Konto</p>
          {accountItems.map((item) => {
            const active = isActive(pathname, item)
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg font-dm-sans text-sm transition-all ${
                  active ? 'bg-[#141414] text-[#c8f53a]' : 'text-[#555] hover:text-[#f0ece4] hover:bg-[#141414]'
                }`}>
                <span className={active ? 'text-[#c8f53a]' : 'text-[#333]'}>{item.icon}</span>
                {item.label}
                {active && <span className="ml-auto w-1 h-1 rounded-full bg-[#c8f53a]" />}
              </Link>
            )
          })}
          <Link href={profileHref}
            className="mt-1 flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[#c8f53a]/[0.05] border border-[#c8f53a]/15 hover:border-[#c8f53a]/25 transition-colors">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#c8f53a] to-[#7ef5b0] flex items-center justify-center text-[#080808] font-bold text-[10px] flex-shrink-0 overflow-hidden">
              {user?.imageUrl
                ? <img src={user.imageUrl} alt="" className="w-full h-full object-cover" />
                : userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium text-[#f0ece4] leading-none truncate">{displayName}</div>
              <div className="text-[9px] font-dm-mono text-[#444] mt-0.5 truncate">{userEmail}</div>
            </div>
          </Link>
          <button
            onClick={() => signOut(() => router.push('/auth'))}
            className="flex items-center gap-3 px-3 py-2 rounded-lg font-dm-sans text-sm text-[#555] hover:text-red-400 hover:bg-red-500/[0.06] transition-all w-full text-left cursor-pointer">
            <span className="text-[#333]">
              <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
                <path d="M8 3H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M13 14l3-4-3-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="16" y1="10" x2="8" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </span>
            Wyloguj się
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Desktop topbar */}
        <header className="hidden lg:flex items-center justify-between px-8 py-4 border-b border-[#1e1e1e] bg-[#0f0f0f] shrink-0">
          <div>
            <h1 className="font-syne font-bold text-[#f0ece4] text-base">
              {isTrainer && <span className="text-[#555] font-normal">Trener · </span>}{activeNavItem?.label ?? 'RepTrack'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-dm-mono text-[11px] text-[#555]">
              {new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <Link href={profileHref} className="w-8 h-8 rounded-full bg-[#141414] border border-[#1e1e1e] flex items-center justify-center overflow-hidden hover:border-[#333] transition-colors">
              {user?.imageUrl
                ? <img src={user.imageUrl} alt="" className="w-full h-full object-cover" />
                : <span className="text-[#c8f53a] text-xs font-syne font-bold">{userInitials}</span>}
            </Link>
          </div>
        </header>

        {/* Scrollable page */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          {role === 'athlete' && <InstallPrompt />}
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0f0f0f] border-t border-[#1e1e1e] flex justify-around px-2 py-2 safe-area-bottom">
        {mobileItems.map((item) => {
          const active = isActive(pathname, item)
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
