import Ionicons from '@expo/vector-icons/Ionicons'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Body, Btn, ErrorBox, Title } from '@/components/ui'
import { useApi } from '@/lib/api'
import { C, R } from '@/lib/theme'

/** Pulls the invite code out of a trainer QR (…/join/CODE) or a bare code. */
function codeFromQr(data: string): string | null {
  const m = data.match(/\/join\/([A-Za-z0-9-]{4,16})/) ?? data.trim().match(/^([A-Za-z0-9]{4,12})$/)
  return m ? m[1].replace(/-/g, '').toUpperCase() : null
}

/** Native QR scanner for the trainer's invite. */
export default function Join() {
  const api = useApi()
  const [permission, requestPermission] = useCameraPermissions()
  const [status, setStatus] = useState<'scanning' | 'joining' | 'done'>('scanning')
  const [error, setError] = useState('')
  const handled = useRef(false)

  const onScan = async (data: string) => {
    if (handled.current) return
    const code = codeFromQr(data)
    if (!code) { setError('To nie jest kod zaproszenia RepTrack.'); return }
    handled.current = true
    setStatus('joining')
    setError('')
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    try {
      await api('/api/athlete/trainers', { method: 'POST', body: JSON.stringify({ code }) })
      setStatus('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się dołączyć.')
      setStatus('scanning')
      setTimeout(() => { handled.current = false }, 1500)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Ionicons name="close" size={26} color={C.textDim} /></Pressable>
        <Text style={{ color: C.text, fontSize: 16, fontWeight: '700', marginLeft: 12 }}>Dołącz do trenera</Text>
      </View>

      {status === 'done' ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12, alignItems: 'center' }}>
          <Ionicons name="checkmark-circle" size={64} color={C.lime} />
          <Title>Dołączono!</Title>
          <Body dim style={{ textAlign: 'center' }}>Trener widzi teraz Twoje treningi i może układać Ci plan.</Body>
          <Btn title="Gotowe" onPress={() => router.back()} style={{ alignSelf: 'stretch', marginTop: 12 }} />
        </View>
      ) : !permission ? null : !permission.granted ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
          <Title>Potrzebny dostęp do aparatu</Title>
          <Body dim>Aparat jest używany tylko do zeskanowania kodu QR trenera.</Body>
          <Btn title="Zezwól na aparat" onPress={requestPermission} />
        </View>
      ) : (
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
          <View style={st.frame}>
            <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={status === 'scanning' ? r => onScan(r.data) : undefined} />
          </View>
          <ErrorBox message={error} />
          <Body dim style={{ textAlign: 'center' }}>
            {status === 'joining' ? 'Łączę z trenerem…' : 'Skieruj aparat na kod QR, który pokazuje trener w swoim panelu.'}
          </Body>
        </View>
      )}
    </SafeAreaView>
  )
}

const st = StyleSheet.create({
  frame: { aspectRatio: 1, borderRadius: R.xl, overflow: 'hidden', borderWidth: 2, borderColor: C.lime },
})
