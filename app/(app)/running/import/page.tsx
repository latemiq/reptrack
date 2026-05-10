import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import ImportScreenshot from '@/components/running/ImportScreenshot'

const AUTH_BYPASS = process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true'

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
