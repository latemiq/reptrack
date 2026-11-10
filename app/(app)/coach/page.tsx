import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import CoachChat from '@/components/coach/CoachChat'
import { AUTH_BYPASS } from '@/lib/auth-bypass'

export const metadata = {
  title: 'RepTrack — Asystent AI',
  description: 'Konsultacje z Asystentem AI na podstawie Twoich danych treningowych',
}

export default async function CoachPage() {
  if (AUTH_BYPASS) {
    return <CoachChat />
  }

  const { userId } = await auth()
  if (!userId) redirect('/auth')

  return <CoachChat />
}
