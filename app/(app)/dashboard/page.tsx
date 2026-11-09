import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Dashboard from '@/components/dashboard/Dashboard'
import { AUTH_BYPASS } from '@/lib/auth-bypass'

export const metadata = {
  title: 'RepTrack — Dashboard',
}

export default async function DashboardPage() {
  if (AUTH_BYPASS) {
    return <Dashboard />
  }

  const { userId } = await auth()
  if (!userId) redirect('/auth')

  return <Dashboard />
}
