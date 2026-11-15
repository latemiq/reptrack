import { useClerk, useUser } from '@clerk/expo'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { Btn, Card, ErrorBox, Field, Kicker, Screen, Title } from '@/components/ui'
import { useApi } from '@/lib/api'
import { C } from '@/lib/theme'

interface Trainer { relationId: string; name: string; since: string | null }

/** Profile: account, the connected trainer (join by QR or code, leave), sign out. */
export default function Profile() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const api = useApi()
  const [trainers, setTrainers] = useState<Trainer[] | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(() => {
    api<{ trainers: Trainer[] }>('/api/athlete/trainers').then(d => setTrainers(d.trainers)).catch(() => setTrainers([]))
  }, [api])
  useFocusEffect(useCallback(() => { load() }, [load]))

  const join = async () => {
    setBusy(true)
    setMessage(null)
    try {
      await api('/api/athlete/trainers', { method: 'POST', body: JSON.stringify({ code }) })
      setCode('')
      setMessage({ ok: true, text: 'Połączono z trenerem. Widzi teraz Twoje treningi.' })
      load()
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Nie udało się użyć kodu.' })
    } finally { setBusy(false) }
  }

  const leave = (t: Trainer) => Alert.alert(`Odłączyć ${t.name}?`, 'Trener straci podgląd Twoich treningów.', [
    { text: 'Nie', style: 'cancel' },
    { text: 'Odłącz', style: 'destructive', onPress: async () => { await api(`/api/athlete/trainers/${t.relationId}`, { method: 'DELETE' }).catch(() => {}); load() } },
  ])

  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ')

  return (
    <Screen>
      <Kicker>Konto</Kicker>
      <Title>{name || 'Profil'}</Title>
      <Text style={{ color: C.muted, fontSize: 13, marginTop: 2, marginBottom: 20 }}>{user?.primaryEmailAddress?.emailAddress}</Text>

      <Card style={{ gap: 10 }}>
        <Kicker>Trener</Kicker>
        {trainers?.map(t => (
          <View key={t.relationId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="person-circle-outline" size={30} color={C.lime} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 15 }}>{t.name}</Text>
              <Text style={{ color: C.muted, fontSize: 12 }}>{t.since ? `od ${new Date(t.since).toLocaleDateString('pl-PL')}` : 'aktywny'} · widzi Twoje treningi</Text>
            </View>
            <Text onPress={() => leave(t)} style={{ color: C.faint, fontSize: 12 }}>Odłącz</Text>
          </View>
        ))}
        {trainers?.length === 0 && <Text style={{ color: C.muted, fontSize: 13 }}>Nie masz jeszcze trenera. Zeskanuj jego kod QR albo wpisz kod.</Text>}

        <Btn title="Zeskanuj kod QR trenera" onPress={() => router.push('/join')} />
        {message && <ErrorBox message={message.ok ? null : message.text} />}
        {message?.ok && <Text style={{ color: C.lime, fontSize: 13 }}>{message.text}</Text>}
        <Field label="albo wpisz kod" value={code} onChangeText={t => setCode(t.toUpperCase())} autoCapitalize="characters" placeholder="np. K7PX2Q" maxLength={12} />
        <Btn title="Połącz" variant="ghost" onPress={join} loading={busy} disabled={code.trim().length < 4} />
      </Card>

      <Btn title="Wyloguj" variant="ghost" style={{ marginTop: 24 }} onPress={() => Alert.alert('Wylogować?', undefined, [
        { text: 'Nie', style: 'cancel' },
        { text: 'Wyloguj', style: 'destructive', onPress: () => signOut() },
      ])} />
    </Screen>
  )
}
