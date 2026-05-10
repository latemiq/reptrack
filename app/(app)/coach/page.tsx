import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import CoachChat from '@/components/coach/CoachChat'

const AUTH_BYPASS = process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true'

export const metadata = {
  title: 'RepTrack – Coach AI',
  description: 'Konsultacje z AI Coachem na podstawie Twoich danych treningowych',
}

export default async function CoachPage() {
  if (AUTH_BYPASS) {
    return <CoachChat />
  }

  const { userId } = await auth()
  if (!userId) redirect('/auth')

  return <CoachChat />
}
