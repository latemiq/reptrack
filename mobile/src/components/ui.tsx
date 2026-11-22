import Ionicons from '@expo/vector-icons/Ionicons'
import { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { C, R } from '@/lib/theme'

/** Full-screen dark background with safe areas and optional scrolling. */
export function Screen({ children, scroll = true, padded = true, edges = ['top'] }: {
  children: React.ReactNode
  scroll?: boolean
  padded?: boolean
  edges?: ('top' | 'bottom' | 'left' | 'right')[]
}) {
  const body = padded ? <View style={s.padded}>{children}</View> : children
  return (
    <SafeAreaView style={s.screen} edges={edges}>
      {scroll ? <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">{body}</ScrollView> : body}
    </SafeAreaView>
  )
}

export function Kicker({ children, color = C.muted }: { children: React.ReactNode; color?: string }) {
  return <Text style={[s.kicker, { color }]}>{children}</Text>
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={s.title}>{children}</Text>
}

export function Body({ children, dim, style }: { children: React.ReactNode; dim?: boolean; style?: object }) {
  return <Text style={[s.body, dim && { color: C.muted }, style]}>{children}</Text>
}

export function Card({ children, style, accent }: { children: React.ReactNode; style?: ViewStyle; accent?: boolean }) {
  return <View style={[s.card, accent && { borderColor: C.limeLine }, style]}>{children}</View>
}

export function Btn({ title, onPress, variant = 'primary', loading, disabled, style }: {
  title: string
  onPress: () => void
  variant?: 'primary' | 'ghost' | 'dark' | 'orange'
  loading?: boolean
  disabled?: boolean
  style?: ViewStyle
}) {
  const bg = { primary: C.lime, ghost: 'transparent', dark: C.bg, orange: C.orange }[variant]
  const fg = { primary: C.limeDark, ghost: C.textDim, dark: C.lime, orange: C.orangeDark }[variant]
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress() }}
      disabled={disabled || loading}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        variant === 'ghost' && { borderWidth: 1, borderColor: C.fieldBorder }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{title}</Text>}
    </Pressable>
  )
}

export function Field({ label, ...props }: TextInputProps & { label?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label && <Text style={s.label}>{label}</Text>}
      <TextInput placeholderTextColor={C.textDim} {...props} style={[s.input, props.style]} />
    </View>
  )
}

/** Password with a show/hide button. */
export function PasswordField({ label, children, ...props }: Omit<TextInputProps, 'secureTextEntry'> & { label?: string; children?: React.ReactNode }) {
  const [visible, setVisible] = useState(false)
  return (
    <View style={{ marginBottom: 14 }}>
      {label && <Text style={s.label}>{label}</Text>}
      <View>
        <TextInput placeholderTextColor={C.textDim} autoCapitalize="none" autoCorrect={false} {...props}
          secureTextEntry={!visible} style={[s.input, { paddingRight: 52 }, props.style]} />
        <Pressable onPress={() => setVisible(v => !v)} hitSlop={8}
          accessibilityRole="button" accessibilityLabel={visible ? 'Ukryj hasło' : 'Pokaż hasło'} accessibilityState={{ selected: visible }}
          style={{ position: 'absolute', right: 4, top: 0, bottom: 0, width: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.textDim} />
        </Pressable>
      </View>
      {children}
    </View>
  )
}

/** Clerk's rules for this app: 8+ characters; easy-to-guess and leaked passwords are rejected on submit. */
export function PasswordRules({ value }: { value: string }) {
  const long = value.length >= 8
  return (
    <View style={{ marginTop: 6 }}>
      <Text style={{ color: long ? C.lime : C.textDim, fontSize: 12 }}>{long ? '✓' : '○'} Co najmniej 8 znaków</Text>
      <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>Hasła łatwe do zgadnięcia albo takie, które wyciekły z innych serwisów, odrzucimy.</Text>
    </View>
  )
}

export function ErrorBox({ message }: { message?: string | null }) {
  if (!message) return null
  return <View style={s.error}><Text style={{ color: C.danger, fontSize: 13 }}>{message}</Text></View>
}

export function Loading() {
  return <View style={{ padding: 40 }}><ActivityIndicator color={C.lime} /></View>
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  padded: { paddingHorizontal: 16, paddingTop: 12 },
  kicker: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'monospace' },
  title: { color: C.text, fontSize: 26, fontWeight: '800', marginTop: 2 },
  body: { color: C.text, fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: C.card, borderColor: C.cardBorder, borderWidth: 1, borderRadius: R.lg, padding: 14 },
  btn: { minHeight: 48, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  btnText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  label: { color: C.muted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6, fontFamily: 'monospace' },
  input: { backgroundColor: C.field, borderColor: C.fieldBorder, borderWidth: 1, borderRadius: R.md, color: C.text, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12 },
  error: { backgroundColor: 'rgba(248,113,113,0.1)', borderColor: 'rgba(248,113,113,0.25)', borderWidth: 1, borderRadius: R.md, padding: 12, marginBottom: 12 },
})
