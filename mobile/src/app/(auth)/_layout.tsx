import { useAuth } from '@clerk/expo'
import { Redirect, Stack } from 'expo-router'
import { C } from '@/lib/theme'

export default function AuthLayout() {
  const { isLoaded, isSignedIn } = useAuth()
  if (isLoaded && isSignedIn) return <Redirect href="/" />
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }} />
}
