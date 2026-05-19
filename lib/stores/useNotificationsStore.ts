import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// ─── TYPY ────────────────────────────────────────────────────────────────────

export type NotifCategory = 'training' | 'goals' | 'coach'

export interface Notification {
  id: string
  category: NotifCategory
  title: string
  body: string
  time: string
  read: boolean
  accent: string
}

interface NotificationsStore {
  notifications: Notification[]
  markRead: (id: string) => void
  markAllRead: () => void
}

// ─── DANE STARTOWE ───────────────────────────────────────────────────────────

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    category: 'goals',
    title: 'Cel osiągnięty! 🎯',
    body: 'Maraton poniżej 3:45 — właśnie przekroczyłeś 80% postępu. Jeszcze 8 km do celu tygodniowego.',
    time: '2 min temu',
    read: false,
    accent: '#c8f53a',
  },
  {
    id: '2',
    category: 'coach',
    title: 'AI Coach ma dla Ciebie analizę',
    body: 'Twoje tempo na ostatnim biegu było o 12 s/km szybsze niż tydzień temu. Coach przygotował plan na przyszły tydzień.',
    time: '1 godz. temu',
    read: false,
    accent: '#c8f53a',
  },
  {
    id: '3',
    category: 'training',
    title: 'Seria 7 dni 🔥',
    body: 'Nie przerwałeś serii od tygodnia. Dzisiaj trening Pull — plecy + biceps zaplanowany na 18:30.',
    time: '3 godz. temu',
    read: false,
    accent: '#f5a03a',
  },
  {
    id: '4',
    category: 'training',
    title: 'Trening wczorajszy zapisany',
    body: 'Push · klatka + barki — 6 ćwiczeń, 58 min. Nowy rekord na wyciskaniu: 100 kg × 3.',
    time: 'wczoraj · 19:42',
    read: true,
    accent: '#f5a03a',
  },
  {
    id: '5',
    category: 'goals',
    title: 'Cel tygodniowy — 76%',
    body: 'Do końca tygodnia zostały 3 dni. Przebiegłeś 38 z 50 km. Możesz to zrobić.',
    time: 'wczoraj · 08:00',
    read: true,
    accent: '#c8f53a',
  },
  {
    id: '6',
    category: 'coach',
    title: 'Czas na regenerację',
    body: 'Trenujesz 6 dni pod rząd. Coach sugeruje lżejszą sesję lub dzień wolny, żeby uniknąć przetrenowania.',
    time: '2 dni temu',
    read: true,
    accent: '#c8f53a',
  },
  {
    id: '7',
    category: 'training',
    title: 'Przypomnienie o treningu',
    body: 'Masz zaplanowany bieg interwałowy. Idealna pogoda: 14°C, brak opadów.',
    time: '3 dni temu',
    read: true,
    accent: '#f5a03a',
  },
]

// ─── STORE ───────────────────────────────────────────────────────────────────

export const useNotificationsStore = create<NotificationsStore>()(
  persist(
    (set) => ({
      notifications: INITIAL_NOTIFICATIONS,

      markRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),

      markAllRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        })),
    }),
    {
      name: 'reptrack-notifications',
      storage: createJSONStorage(() => localStorage),
    }
  )
)

// ─── SELEKTORY ───────────────────────────────────────────────────────────────

export const selectUnreadCount = (state: NotificationsStore) =>
  state.notifications.filter((n) => !n.read).length
