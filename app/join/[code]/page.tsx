import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import JoinInvite from '@/components/trainer/JoinInvite'
import { normalizeInviteCode } from '@/lib/trainer'

const AUTH_BYPASS = process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true'

export const metadata = {
  title: 'RepTrack — Zaproszenie od trenera',
}

// Target of the trainer's QR code. Signed-out visitors go through sign-up (with the
// invite carried along); signed-in ones confirm joining here.
export default async function JoinPage({ params }: { params: { code: string } }) {
  const code = normalizeInviteCode(params.code)
  if (!code) redirect('/auth')

  if (!AUTH_BYPASS) {
    const { userId } = await auth()
    if (!userId) redirect(`/auth?invite=${code}`)
  }
  return <JoinInvite code={code} />
}
