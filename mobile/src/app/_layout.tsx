import { ClerkProvider } from '@clerk/expo'
import { tokenCache } from '@clerk/expo/token-cache'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Updates from 'expo-updates'
import { useEffect } from 'react'
import { C } from '@/lib/theme'

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!

/**
 * expo-updates downloads a new version in the background on launch; apply it right away
 * instead of on the next cold start. A live workout survives the reload (it's persisted).
 */
function useApplyDownloadedUpdate() {
  const { isUpdatePending } = Updates.useUpdates()
  useEffect(() => {
    if (isUpdatePending) Updates.reloadAsync().catch(() => {})
  }, [isUpdatePending])
}

export default function RootLayout() {
  useApplyDownloadedUpdate()
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'fade' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="workout" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        <Stack.Screen name="join" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </ClerkProvider>
  )
}
