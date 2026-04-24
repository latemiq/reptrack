import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Dashboard from '@/components/dashboard/Dashboard'

export const metadata = {
  title: 'RepTrack — Dashboard',
}

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect('/auth')

  return <Dashboard />
}
