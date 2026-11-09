import { Suspense } from 'react'
import TemplatesEditor from '@/components/gym/TemplatesEditor'

export const metadata = {
  title: 'RepTrack — Szablony treningów',
}

// Suspense: the editor reads ?edit= / ?new= via useSearchParams.
export default function TemplatesPage() {
  return (
    <Suspense fallback={<div className="min-h-full bg-[#080808]" />}>
      <TemplatesEditor />
    </Suspense>
  )
}
