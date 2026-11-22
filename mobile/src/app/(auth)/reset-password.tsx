import { useSignIn } from '@clerk/expo'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { Body, Btn, ErrorBox, Field, Kicker, PasswordField, PasswordRules, Screen, Title } from '@/components/ui'
import { clerkErrorPl } from '@/lib/clerk-errors'
import { C } from '@/lib/theme'

/** Forgot password: Clerk emails a code; the code and a new password sign the user in. */
export default function ResetPassword() {
  const { signIn, fetchStatus } = useSignIn()
  const params = useLocalSearchParams<{ email?: string }>()
  const [email, setEmail] = useState(params.email ?? '')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [step, setStep] = useState<'email' | 'reset'>('email')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const busy = fetchStatus === 'fetching'

  const sendCode = async () => {
    setError('')
    setInfo('')
    const { error: e } = await signIn.create({ identifier: email.trim() })
    if (e) { setError(clerkErrorPl(e)); return }
    const { error: sendErr } = await signIn.resetPasswordEmailCode.sendCode()
    if (sendErr) { setError(clerkErrorPl(sendErr)); return }
    if (step === 'reset') setInfo('Wysłaliśmy nowy kod.')
    setStep('reset')
  }

  const save = async () => {
    setError('')
    setInfo('')
    // After a rejected password the code is already used; only the new password is sent again.
    if (signIn.status !== 'needs_new_password') {
      const { error: e } = await signIn.resetPasswordEmailCode.verifyCode({ code: code.replace(/\s/g, '') })
      if (e) { setError(clerkErrorPl(e)); return }
    }
    const { error: e } = await signIn.resetPasswordEmailCode.submitPassword({ password, signOutOfOtherSessions: true })
    if (e) { setError(clerkErrorPl(e)); return }
    if (signIn.status === 'complete') {
      const { error: finErr } = await signIn.finalize()
      if (finErr) { setError(clerkErrorPl(finErr)); return }
      router.replace('/')
      return
    }
    // A second step (e.g. a new device) is handled by the normal sign-in screen.
    signIn.reset()
    router.replace({ pathname: '/sign-in', params: { email: email.trim() } })
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ paddingTop: 40 }}>
        <Text style={{ color: C.text, fontSize: 20, fontWeight: '800', marginBottom: 32 }}>
          Rep<Text style={{ color: C.lime }}>Track</Text>
        </Text>
        <Kicker>Reset hasła</Kicker>
        <ErrorBox message={error} />

        {step === 'email' ? (
          <>
            <Title>Nie pamiętasz hasła?</Title>
            <Body dim style={{ marginTop: 6, marginBottom: 24 }}>Wyślemy kod na email powiązany z kontem.</Body>
            <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email"
              keyboardType="email-address" placeholder="ty@example.com" onSubmitEditing={sendCode} />
            <Btn title="Wyślij kod" onPress={sendCode} loading={busy} disabled={!email.trim()} />
          </>
        ) : (
          <>
            <Title>Nowe hasło</Title>
            <Body dim style={{ marginTop: 6, marginBottom: 24 }}>Wpisz 6-cyfrowy kod wysłany na {email.trim()} i ustaw nowe hasło. Sprawdź też spam.</Body>
            {!!info && <Text style={{ color: C.lime, fontSize: 13, marginBottom: 12 }}>{info}</Text>}
            <Field label="Kod" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" placeholder="123456" />
            <PasswordField label="Nowe hasło" value={password} onChangeText={setPassword} autoComplete="new-password"
              textContentType="newPassword" placeholder="min. 8 znaków" onSubmitEditing={() => { if (password.length >= 8) save() }}>
              <PasswordRules value={password} />
            </PasswordField>
            <Btn title="Ustaw hasło i zaloguj" onPress={save} loading={busy} disabled={code.trim().length < 6 || password.length < 8} />
            <Btn title="Wyślij kod ponownie" variant="ghost" onPress={sendCode} style={{ marginTop: 10 }} />
          </>
        )}
        <Btn title="Wróć do logowania" variant="ghost" style={{ marginTop: 10 }}
          onPress={() => { signIn.reset(); router.replace({ pathname: '/sign-in', params: { email: email.trim() } }) }} />
      </View>
    </Screen>
  )
}
