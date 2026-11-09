import VerifyMfa from '@/components/mfa/VerifyMfa'

export const metadata = {
  title: 'RepTrack — Weryfikacja dwuetapowa',
}

// Outside the (app) layout on purpose: that layout redirects here while 2FA is pending.
export default function VerifyMfaPage({ searchParams }: { searchParams: { next?: string } }) {
  // Only same-site paths, so the page can't be used as an open redirect.
  const next = searchParams.next?.startsWith('/') && !searchParams.next.startsWith('//') ? searchParams.next : '/dashboard'
  return <VerifyMfa next={next} />
}
