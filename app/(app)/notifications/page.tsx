import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import NotificationsView from '@/components/notifications/NotificationsView'

const AUTH_BYPASS = process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true'

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
