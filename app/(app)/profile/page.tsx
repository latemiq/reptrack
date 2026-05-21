import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import UserProfile from '@/components/profile/UserProfile'

export const metadata = {
  title: 'RepTrack – Profil',
}

export default async function ProfilePage() {
  const { userId } = await auth()
  if (!userId) redirect('/auth')
  return <UserProfile />
}
