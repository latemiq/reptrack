'use client'

import { useState } from 'react'
import { useNotificationsStore, selectUnreadCount, type NotifCategory } from '@/lib/stores/useNotificationsStore'

const FILTERS: { key: NotifCategory | 'all'; label: string }[] = [
  { key: 'all',      label: 'Wszystkie' },
  { key: 'training', label: 'Treningi'  },
  { key: 'goals',    label: 'Cele'      },
  { key: 'coach',    label: 'AI Coach'  },
]

function BellIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 20 20">
      <path d="M10 2a6 6 0 0 0-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 0 0-6-6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8.5 16.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function TrophyIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 20 20">
      <path d="M10 13c-3.31 0-6-2.69-6-6V4h12v3c0 3.31-2.69 6-6 6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M4 6H2a1 1 0 0 0-1 1v1a3 3 0 0 0 3 3M16 6h2a1 1 0 0 1 1 1v1a3 3 0 0 1-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 13v3M7 18h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function BrainIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 20 20">
      <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 9.5C7 8.12 8.12 7 9.5 7S12 8.12 12 9.5c0 1-.6 1.85-1.5 2.24V13h-2v-1.26C7.6 11.35 7 10.5 7 9.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="10" cy="15.5" r=".75" fill="currentColor" />
    </svg>
  )
}

function FireIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 20 20">
      <path d="M10 2s1 3-1 5c0 0 3-1 4 2 0 0 1-4 3-4 0 0 1 6-2 9a6 6 0 0 1-8.5-8.5C6.5 4 10 2 10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  goals:    <TrophyIcon />,
  coach:    <BrainIcon />,
  training: <FireIcon />,
}

export default function NotificationsView() {
  const [active, setActive] = useState<NotifCategory | 'all'>('all')
  const { notifications, markRead, markAllRead } = useNotificationsStore()
  const unreadCount = useNotificationsStore(selectUnreadCount)

  const filtered = active === 'all'
    ? notifications
    : notifications.filter((n) => n.category === active)

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 py-6 md:px-8 md:py-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-syne font-extrabold text-[#f0ece4] text-[22px] md:text-[28px] leading-tight">
            Powiadomienia
          </h1>
          {unreadCount > 0 && (
            <p className="font-dm-mono text-[11px] text-[#555] mt-0.5 uppercase tracking-wider">
              {unreadCount} nieprzeczytanych
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="font-dm-mono text-[11px] text-[#555] hover:text-[#c8f53a] uppercase tracking-wider transition-colors py-2"
          >
            Oznacz wszystkie
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-5 scrollbar-none">
        {FILTERS.map((f) => {
          const count = f.key === 'all'
            ? unreadCount
            : notifications.filter((n) => n.category === f.key && !n.read).length
          return (
            <button
              key={f.key}
              onClick={() => setActive(f.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full font-dm-mono text-[11px] uppercase tracking-wider whitespace-nowrap transition-all shrink-0 ${
                active === f.key
                  ? 'bg-[#c8f53a]/10 text-[#c8f53a] border border-[#c8f53a]/30'
                  : 'bg-[#141414] text-[#555] border border-[#1e1e1e] hover:text-[#f0ece4]'
              }`}
            >
              {f.label}
              {count > 0 && (
                <span className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold ${
                  active === f.key ? 'bg-[#c8f53a] text-[#080808]' : 'bg-[#1e1e1e] text-[#888]'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Notifications list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-full bg-[#141414] border border-[#1e1e1e] flex items-center justify-center mb-4 text-[#333]">
            <BellIcon />
          </div>
          <p className="font-dm-sans text-[#555] text-sm">Brak powiadomień</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((notif) => (
            <button
              key={notif.id}
              onClick={() => markRead(notif.id)}
              className={`w-full text-left rounded-2xl border transition-all p-4 ${
                notif.read
                  ? 'bg-[#0f0f0f] border-[#1a1a1a]'
                  : 'bg-[#111] border-[#1e1e1e]'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    background: `${notif.accent}15`,
                    border: `1px solid ${notif.accent}30`,
                    color: notif.accent,
                  }}
                >
                  {CATEGORY_ICONS[notif.category]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`font-dm-sans text-sm font-medium leading-snug ${
                      notif.read ? 'text-[#888]' : 'text-[#f0ece4]'
                    }`}>
                      {notif.title}
                    </span>
                    {!notif.read && (
                      <span
                        className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                        style={{ background: notif.accent }}
                      />
                    )}
                  </div>
                  <p className={`font-dm-sans text-[12px] leading-relaxed mt-0.5 ${
                    notif.read ? 'text-[#444]' : 'text-[#666]'
                  }`}>
                    {notif.body}
                  </p>
                  <span className="font-dm-mono text-[10px] text-[#333] uppercase tracking-wider mt-2 block">
                    {notif.time}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

    </div>
  )
}
