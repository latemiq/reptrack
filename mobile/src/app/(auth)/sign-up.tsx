import { useAuth, useSignUp } from '@clerk/expo'
import { Link, router } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Body, Btn, ErrorBox, Field, Kicker, Screen, Title } from '@/components/ui'
import { clerkErrorPl } from '@/lib/clerk-errors'
import { API_URL } from '@/lib/api'
import { C, R } from '@/lib/theme'

const LEVELS = [
  { key: 'beginner', label: 'Początkujący', sub: 'Zaczynam przygodę z treningiem' },
  { key: 'intermediate', label: 'Średniozaawansowany', sub: '1–3 lata regularnego treningu' },
  { key: 'advanced', label: 'Zaawansowany', sub: 'Ponad 3 lata' },
]

/** Sign-up: email + password → email code → short survey (same data as the web onboarding). */
export default function SignUp() {
  const { signUp, fetchStatus } = useSignUp()
  const { getToken } = useAuth()
  const [step, setStep] = useState<'account' | 'verify' | 'survey'>('account')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [level, setLevel] = useState('beginner')
  const [days, setDays] = useState(3)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const busy = fetchStatus === 'fetching'

  const createAccount = async () => {
    setError('')
    const { error: e } = await signUp.password({ emailAddress: email.trim(), password })
    if (e) { setError(clerkErrorPl(e)); return }
    const { error: sendErr } = await signUp.verifications.sendEmailCode()
    if (sendErr) { setError(clerkErrorPl(sendErr)); return }
    setStep('verify')
  }

  const verify = async () => {
    setError('')
    const { error: e } = await signUp.verifications.verifyEmailCode({ code: code.trim() })
    if (e) { setError(clerkErrorPl(e)); return }
    if (signUp.status !== 'complete') { setError(`Rejestracja niezakończona (${signUp.status}).`); return }
    const { error: finErr } = await signUp.finalize()
    if (finErr) { setError(clerkErrorPl(finErr)); return }
    setStep('survey')
  }

  const saveSurvey = async () => {
    setSaving(true)
    setError('')
    try {
      const token = await getToken()
      await fetch(`${API_URL}/api/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          weightKg: Number(weight.replace(',', '.')) || null,
          heightCm: Number(height) || null,
          level,
          weeklyDays: days,
          goals: [],
        }),
      })
    } catch { /* survey is best-effort — the profile can be filled later */ }
    setSaving(false)
    router.replace('/')
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ paddingTop: 40 }}>
        <Text style={{ color: C.text, fontSize: 20, fontWeight: '800', marginBottom: 32 }}>
          Rep<Text style={{ color: C.lime }}>Track</Text>
        </Text>
        <ErrorBox message={error} />

        {step === 'account' && (
          <>
            <Kicker>Krok 1 z 3</Kicker>
            <Title>Nowe konto</Title>
            <Body dim style={{ marginTop: 6, marginBottom: 24 }}>Wyślemy kod na email, żeby go potwierdzić.</Body>
            <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="ty@example.com" />
            <Field label="Hasło" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder="min. 8 znaków" />
            <Btn title="Dalej" onPress={createAccount} loading={busy} disabled={!email || password.length < 8} />
            <Link href="/sign-in" style={{ color: C.textDim, textAlign: 'center', marginTop: 20, fontSize: 14 }}>
              Masz konto? <Text style={{ color: C.lime }}>Zaloguj się</Text>
            </Link>
          </>
        )}

        {step === 'verify' && (
          <>
            <Kicker>Krok 2 z 3</Kicker>
            <Title>Sprawdź email</Title>
            <Body dim style={{ marginTop: 6, marginBottom: 24 }}>Wpisz 6-cyfrowy kod wysłany na {email}.</Body>
            <Field label="Kod" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" placeholder="123456" />
            <Btn title="Potwierdź" onPress={verify} loading={busy} disabled={code.trim().length < 6} />
            <Btn title="Wyślij kod ponownie" variant="ghost" style={{ marginTop: 10 }}
              onPress={async () => { const { error: e } = await signUp.verifications.sendEmailCode(); if (e) setError(clerkErrorPl(e)) }} />
          </>
        )}

        {step === 'survey' && (
          <>
            <Kicker>Krok 3 z 3</Kicker>
            <Title>O Tobie</Title>
            <Body dim style={{ marginTop: 6, marginBottom: 24 }}>Trener zobaczy te dane w Twoim profilu.</Body>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Field label="Waga (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="78" /></View>
              <View style={{ flex: 1 }}><Field label="Wzrost (cm)" value={height} onChangeText={setHeight} keyboardType="number-pad" placeholder="178" /></View>
            </View>
            <Text style={{ color: C.muted, fontSize: 11, letterSpacing: 1.5, marginBottom: 8 }}>POZIOM</Text>
            {LEVELS.map(l => (
              <Pressable key={l.key} onPress={() => setLevel(l.key)}
                style={{ borderWidth: 1, borderColor: level === l.key ? C.lime : C.cardBorder, backgroundColor: level === l.key ? C.limeTint : C.card, borderRadius: R.md, padding: 12, marginBottom: 8 }}>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: '600' }}>{l.label}</Text>
                <Text style={{ color: C.muted, fontSize: 12 }}>{l.sub}</Text>
              </Pressable>
            ))}
            <Text style={{ color: C.muted, fontSize: 11, letterSpacing: 1.5, marginVertical: 8 }}>TRENINGI W TYGODNIU</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 20 }}>
              {[1, 2, 3, 4, 5, 6, 7].map(n => (
                <Pressable key={n} onPress={() => setDays(n)}
                  style={{ flex: 1, height: 42, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: days === n ? C.lime : C.card, borderWidth: 1, borderColor: C.cardBorder }}>
                  <Text style={{ color: days === n ? C.limeDark : C.text, fontWeight: '700' }}>{n}</Text>
                </Pressable>
              ))}
            </View>
            <Btn title="Zaczynamy" onPress={saveSurvey} loading={saving} />
          </>
        )}
      </View>
    </Screen>
  )
}
