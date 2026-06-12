import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import SettingsForm from '@/components/settings/SettingsForm'

export const metadata = {
  title: 'RepTrack – Ustawienia',
}

export default async function SettingsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/auth')
  return <SettingsForm />
}
