import SettingsForm from '@/components/settings/SettingsForm'

export const metadata = {
  title: 'RepTrack – Ustawienia',
}

// Access is enforced by middleware.ts (redirects to /auth unless NEXT_PUBLIC_BYPASS_AUTH=true)
export default function SettingsPage() {
  return <SettingsForm />
}
