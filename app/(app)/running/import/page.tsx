import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import ImportScreenshot from '@/components/running/ImportScreenshot'

export const metadata = {
  title: 'RepTrack — Import biegu',
}

export default async function ImportPage() {
  const { userId } = await auth()
  if (!userId) redirect('/auth')
  return <ImportScreenshot />
}
