import AuthFlow from '@/components/auth/AuthFlow'

export const metadata = {
  title: 'RepTrack — Logowanie',
  description: 'Zaloguj lub zarejestruj się w RepTrack',
}

export default function AuthPage() {
  return <AuthFlow />
}
