import { useSignIn } from '@clerk/expo'
import { Link, router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { Body, Btn, ErrorBox, Field, Kicker, PasswordField, Screen, Title } from '@/components/ui'
import { clerkErrorPl } from '@/lib/clerk-errors'
import { C } from '@/lib/theme'

/**
 * Email + password sign-in. A new device triggers Clerk Device Trust
 * (status needs_client_trust): a code is emailed and must be entered here.
 */
export default function SignIn() {
  const { signIn, fetchStatus } = useSignIn()
  const params = useLocalSearchParams<{ email?: string }>()
  const [email, setEmail] = useState(params.email ?? '')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'credentials' | 'code'>('credentials')
  const [method, setMethod] = useState<'email' | 'totp' | 'backup'>('email')
  const [error, setError] = useState('')
  const busy = fetchStatus === 'fetching'

  const done = async () => {
    const { error: e } = await signIn.finalize()
    if (e) { setError(clerkErrorPl(e)); return }
    router.replace('/')
  }

  const submit = async () => {
    setError('')
    const { error: e } = await signIn.password({ emailAddress: email.trim(), password })
    if (e) { setError(clerkErrorPl(e)); return }
    if (signIn.status === 'complete') return done()

    const factors = (signIn.supportedSecondFactors ?? []).map(f => f.strategy as string)
    if (signIn.status === 'needs_client_trust' || (signIn.status === 'needs_second_factor' && factors.includes('email_code'))) {
      const { error: sendErr } = await signIn.mfa.sendEmailCode()
      if (sendErr) { setError(clerkErrorPl(sendErr)); return }
      setMethod('email')
      setStep('code')
    } else if (signIn.status === 'needs_second_factor') {
      setMethod(factors.includes('totp') ? 'totp' : 'backup')
      setStep('code')
    } else {
      setError(`Nie można zakończyć logowania (${signIn.status}).`)
    }
  }

  const verify = async () => {
    setError('')
    const c = code.replace(/\s/g, '')
    const { error: e } = method === 'email' ? await signIn.mfa.verifyEmailCode({ code: c })
      : method === 'totp' ? await signIn.mfa.verifyTOTP({ code: c })
        : await signIn.mfa.verifyBackupCode({ code: c })
    if (e) { setError(clerkErrorPl(e)); return }
    if (signIn.status === 'complete') return done()
    setError(`Nie można zakończyć logowania (${signIn.status}).`)
  }

  const resend = async () => {
    setError('')
    const { error: e } = await signIn.mfa.sendEmailCode()
    if (e) setError(clerkErrorPl(e))
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ paddingTop: 40 }}>
        <Text style={{ color: C.text, fontSize: 20, fontWeight: '800', marginBottom: 32 }}>
          Rep<Text style={{ color: C.lime }}>Track</Text>
        </Text>

        {step === 'credentials' ? (
          <>
            <Kicker>Logowanie</Kicker>
            <Title>Witaj z powrotem</Title>
            <Body dim style={{ marginTop: 6, marginBottom: 24 }}>Zaloguj się kontem, którego używasz w RepTrack.</Body>
            <ErrorBox message={error} />
            <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email"
              keyboardType="email-address" placeholder="ty@example.com" />
            <PasswordField label="Hasło" value={password} onChangeText={setPassword} autoComplete="current-password"
              textContentType="password" placeholder="••••••••" onSubmitEditing={submit} />
            <Link href={{ pathname: '/reset-password', params: { email: email.trim() } }}
              style={{ color: C.textDim, fontSize: 13, alignSelf: 'flex-end', marginTop: -6, marginBottom: 14, paddingVertical: 4 }}>
              Nie pamiętasz hasła?
            </Link>
            <Btn title="Zaloguj" onPress={submit} loading={busy} disabled={!email || !password} />
            <Link href="/sign-up" style={{ color: C.textDim, textAlign: 'center', marginTop: 20, fontSize: 14 }}>
              Nie masz konta? <Text style={{ color: C.lime }}>Załóż je</Text>
            </Link>
          </>
        ) : (
          <>
            <Kicker>Krok 2 z 2</Kicker>
            <Title>Potwierdź logowanie</Title>
            <Body dim style={{ marginTop: 6, marginBottom: 24 }}>
              {method === 'email'
                ? 'Logujesz się z nowego urządzenia. Wysłaliśmy 6-cyfrowy kod na Twój email — sprawdź też spam.'
                : method === 'totp' ? 'Wpisz 6-cyfrowy kod z aplikacji uwierzytelniającej.' : 'Wpisz jeden z kodów zapasowych.'}
            </Body>
            <ErrorBox message={error} />
            <Field label="Kod" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code"
              placeholder="123456" onSubmitEditing={verify} />
            <Btn title="Zaloguj" onPress={verify} loading={busy} disabled={code.trim().length < 6} />
            {method === 'email' && <Btn title="Wyślij kod ponownie" variant="ghost" onPress={resend} style={{ marginTop: 10 }} />}
            <Btn title="Wróć" variant="ghost" onPress={() => { signIn.reset(); setStep('credentials'); setCode('') }} style={{ marginTop: 10 }} />
          </>
        )}
      </View>
    </Screen>
  )
}
