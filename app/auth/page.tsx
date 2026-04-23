import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import AuthFlow from '@/components/auth/AuthFlow'

export const metadata = {
  title: 'RepTrack — Logowanie',
  description: 'Zaloguj lub zarejestruj się w RepTrack',
}

export default async function AuthPage() {
  const { userId } = await auth()
  if (userId) redirect('/dashboard')
  return <AuthFlow />
}
