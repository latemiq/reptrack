import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import RunningOverview from '@/components/running/RunningOverview'

export const metadata = {
  title: 'RepTrack — Bieganie',
  description: 'Twoje biegi, tempo, rekordy i cele',
}

export default async function RunningPage() {
  const { userId } = await auth()
  if (!userId) redirect('/auth')

  return <RunningOverview />
}
