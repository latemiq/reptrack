import UserProfile from '@/components/profile/UserProfile'

export const metadata = {
  title: 'RepTrack – Profil',
}

// Access is enforced by middleware.ts (redirects to /auth unless NEXT_PUBLIC_BYPASS_AUTH=true)
export default function ProfilePage() {
  return <UserProfile />
}
