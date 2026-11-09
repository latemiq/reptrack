import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import NotificationsView from '@/components/notifications/NotificationsView'
import { AUTH_BYPASS } from '@/lib/auth-bypass'

export const metadata = {
  title: 'RepTrack — Powiadomienia',
}

export default async function NotificationsPage() {
  if (AUTH_BYPASS) {
    return <NotificationsView />
  }

  const { userId } = await auth()
  if (!userId) redirect('/auth')

  return <NotificationsView />
}
