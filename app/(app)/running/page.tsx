import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import RunningOverview from '@/components/running/RunningOverview'

const AUTH_BYPASS = process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true'

export const metadata = {
  title: 'RepTrack — Bieganie',
  description: 'Twoje biegi, tempo, rekordy i cele',
}

export default async function RunningPage() {
  if (AUTH_BYPASS) {
    return <RunningOverview />
  }

  const { userId } = await auth()
  if (!userId) redirect('/auth')

  return <RunningOverview />
}
