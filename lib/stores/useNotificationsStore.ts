import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// ─── TYPY ────────────────────────────────────────────────────────────────────

export type NotifCategory = 'training' | 'goals' | 'coach'

export interface Notification {
  id: string
  category: NotifCategory
  title: string
  body: string
  at: string
  read: boolean
  accent: string
}

interface NotificationsStore {
  notifications: Notification[]
  readIds: string[]
  loaded: boolean
  fetchNotifications: () => Promise<void>
  markRead: (id: string) => void
  markAllRead: () => void
}

// ─── STORE ───────────────────────────────────────────────────────────────────
// Notifications are derived server-side from the user's data; only the read
// state lives here (persisted per browser).

export const useNotificationsStore = create<NotificationsStore>()(
  persist(
    (set, get) => ({
      notifications: [],
      readIds: [],
      loaded: false,

      fetchNotifications: async () => {
        try {
          const res = await fetch('/api/notifications')
          if (!res.ok) return
          const data = await res.json() as { notifications: Omit<Notification, 'read'>[] }
          const read = new Set(get().readIds)
          const notifications = data.notifications.map(n => ({ ...n, read: read.has(n.id) }))
          // Forget read IDs that no longer exist so storage doesn't grow forever
          const alive = new Set(notifications.map(n => n.id))
          set({ notifications, loaded: true, readIds: get().readIds.filter(id => alive.has(id)) })
        } catch {
          // offline / API down — keep whatever we have
        }
      },

      markRead: (id) =>
        set((state) => ({
          readIds: state.readIds.includes(id) ? state.readIds : [...state.readIds, id],
          notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        })),

      markAllRead: () =>
        set((state) => ({
          readIds: Array.from(new Set([...state.readIds, ...state.notifications.map(n => n.id)])),
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        })),
    }),
    {
      name: 'reptrack-notifications',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ readIds: state.readIds }),
      migrate: () => ({ readIds: [] }),
    }
  )
)

// ─── SELEKTORY ───────────────────────────────────────────────────────────────

export const selectUnreadCount = (state: NotificationsStore) =>
  state.notifications.filter((n) => !n.read).length
