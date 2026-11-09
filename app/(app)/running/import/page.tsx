import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import ImportScreenshot from '@/components/running/ImportScreenshot'
import { AUTH_BYPASS } from '@/lib/auth-bypass'

export const metadata = {
  title: 'RepTrack — Import biegu',
}

export default async function ImportPage() {
  if (AUTH_BYPASS) {
    return <ImportScreenshot />
  }

  const { userId } = await auth()
  if (!userId) redirect('/auth')
  return <ImportScreenshot />
}
