import { useAuth, useClerk } from '@clerk/expo'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Redirect, Tabs } from 'expo-router'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Body, Btn, Kicker, Loading, Screen, Title } from '@/components/ui'
import { useApi } from '@/lib/api'
import { C } from '@/lib/theme'

/** Signed-in area. Trainer accounts are pointed to the web panel — this app is for athletes. */
export default function TabsLayout() {
  const { isLoaded, isSignedIn } = useAuth()
  const { signOut } = useClerk()
  const api = useApi()
  const [role, setRole] = useState<'athlete' | 'trainer' | null>(null)

  useEffect(() => {
    if (!isSignedIn) return
    api<{ profile: { role?: string } }>('/api/profile')
      .then(d => setRole(d.profile?.role === 'trainer' ? 'trainer' : 'athlete'))
      .catch(() => setRole('athlete'))
  }, [isSignedIn, api])

  if (!isLoaded) return <Screen scroll={false}><Loading /></Screen>
  if (!isSignedIn) return <Redirect href="/sign-in" />
  if (role === null) return <Screen scroll={false}><Loading /></Screen>

  if (role === 'trainer') {
    return (
      <Screen>
        <View style={{ paddingTop: 40, gap: 12 }}>
          <Kicker color={C.lime}>Konto trenera</Kicker>
          <Title>Panel trenera jest na komputerze</Title>
          <Body dim>Aplikacja na telefon jest dla podopiecznych. Podopiecznych, plany i statystyki znajdziesz na reptrack-five-tau.vercel.app.</Body>
          <Btn title="Wyloguj" variant="ghost" onPress={() => signOut()} style={{ marginTop: 12 }} />
        </View>
      </Screen>
    )
  }

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: C.lime,
      tabBarInactiveTintColor: C.faint,
      tabBarStyle: { backgroundColor: '#0f0f0f', borderTopColor: C.cardBorder },
      sceneStyle: { backgroundColor: C.bg },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Trening', tabBarIcon: ({ color, size }) => <Ionicons name="barbell" color={String(color)} size={size} /> }} />
      <Tabs.Screen name="history" options={{ title: 'Historia', tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" color={String(color)} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={String(color)} size={size} /> }} />
    </Tabs>
  )
}
