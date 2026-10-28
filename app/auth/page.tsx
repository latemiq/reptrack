import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import AuthFlow from '@/components/auth/AuthFlow'
import { normalizeInviteCode } from '@/lib/trainer'

const AUTH_BYPASS = process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true'

export const metadata = {
  title: 'RepTrack — Logowanie',
  description: 'Zaloguj lub zarejestruj się w RepTrack',
}

export default async function AuthPage({ searchParams }: { searchParams: { invite?: string } }) {
  // Trainer invite carried over from a scanned QR code (/join/[code]).
  const invite = normalizeInviteCode(searchParams.invite)
  if (AUTH_BYPASS) redirect(invite ? `/join/${invite}` : '/dashboard')

  const { userId } = await auth()
  if (userId) redirect(invite ? `/join/${invite}` : '/dashboard')
  return <AuthFlow invite={invite} />
}
