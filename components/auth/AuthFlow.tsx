'use client'

import { useSignUp, useSignIn, useClerk } from '@clerk/nextjs'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useRef, useState, useCallback, useEffect, useId, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { fetchInvitePreview, redeemInvite } from '@/lib/invites'
import { clerkErrorCode, clerkErrorPl } from '@/lib/clerk-errors'

type Mode = 'choose' | 'login' | 'register' | 'reset'
type Step = 'email' | 'password' | 'verify' | 'reset' | 'second' | 'profile' | 'goals' | 'stats' | 'success'

/** Second-step methods Clerk may ask for after the password (email_code = new-device check). */
type SecondStrategy = 'email_code' | 'totp' | 'phone_code' | 'backup_code'
const SECOND_ORDER: SecondStrategy[] = ['email_code', 'totp', 'phone_code', 'backup_code']

interface Profile { name: string; weight: number; height: number }
interface TrainingStats { level: string; weeklyDays: number }

const INPUT = 'w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3.5 text-sm text-[#f0ece4] placeholder:text-[#8a8a8a] focus:outline-none focus:border-[#c8f53a]/40 transition-colors'
const LABEL = 'block text-[10px] font-mono uppercase tracking-[2px] text-neutral-400 mb-2'

function Field({ label, type = 'text', placeholder, value, onChange, autoFocus = false, autoComplete, inputMode, name }: {
  label: string; type?: string; placeholder: string
  value: string; onChange: (v: string) => void; autoFocus?: boolean
  autoComplete?: string; inputMode?: 'numeric' | 'email' | 'text'; name?: string
}) {
  const id = useId()
  return (
    <div className="mb-4">
      <label htmlFor={id} className={LABEL}>{label}</label>
      <input id={id} name={name} type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
        autoFocus={autoFocus} autoComplete={autoComplete} inputMode={inputMode} className={INPUT} />
    </div>
  )
}

/** Password with a show/hide toggle. autoComplete tells password managers whether to fill or to save a new one. */
function PasswordField({ label, value, onChange, autoComplete, autoFocus = false, children }: {
  label: string; value: string; onChange: (v: string) => void
  autoComplete: 'current-password' | 'new-password'; autoFocus?: boolean; children?: ReactNode
}) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  return (
    <div className="mb-5">
      <label htmlFor={id} className={LABEL}>{label}</label>
      <div className="relative">
        <input id={id} name="password" type={visible ? 'text' : 'password'} autoFocus={autoFocus} autoComplete={autoComplete}
          value={value} onChange={e => onChange(e.target.value)} placeholder="••••••••" className={`${INPUT} pr-12`}
          aria-describedby={children ? `${id}-rules` : undefined} />
        <button type="button" onClick={() => setVisible(v => !v)} aria-label={visible ? 'Ukryj hasło' : 'Pokaż hasło'} aria-pressed={visible}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-lg text-neutral-400 hover:text-[#f0ece4] cursor-pointer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
            {visible && <path d="M4 4l16 16" />}
          </svg>
        </button>
      </div>
      {children && <div id={`${id}-rules`}>{children}</div>}
    </div>
  )
}

/** Clerk's rules for this app: 8+ characters; easy-to-guess and leaked passwords are rejected on submit. */
function PwRules({ value }: { value: string }) {
  const long = value.length >= 8
  return (
    <div className="mt-2 text-[11px] leading-relaxed">
      <p className={long ? 'text-[#c8f53a]' : 'text-neutral-400'}>{long ? '✓' : '○'} Co najmniej 8 znaków</p>
      <p className="text-[#8a8a8a]">Hasła łatwe do zgadnięcia albo takie, które wyciekły z innych serwisów, odrzucimy.</p>
    </div>
  )
}

/** Each step is a form, so Enter submits it and password managers recognise the login. */
function StepForm({ onSubmit, loading, children }: { onSubmit: () => void; loading: boolean; children: ReactNode }) {
  return (
    <form noValidate onSubmit={e => { e.preventDefault(); if (!loading) onSubmit() }}>
      {children}
    </form>
  )
}

function Dots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex gap-1.5 mb-7">
      {Array.from({length:total},(_,i)=>(
        <div key={i} className={`h-1.5 rounded-full transition-all duration-400 ${i<current?'bg-[#c8f53a] w-5':i===current?'bg-[#c8f53a]/50 w-3':'bg-[#1e1e1e] w-1.5'}`}/>
      ))}
    </div>
  )
}

/** Submits the step's form; pass onClick only outside a form. */
function BtnPrimary({ onClick, children, loading=false }: { onClick?:()=>void; children:React.ReactNode; loading?:boolean }) {
  return (
    <button type={onClick ? 'button' : 'submit'} onClick={onClick} disabled={loading}
      className="w-full py-4 rounded-xl text-[13px] font-mono uppercase tracking-[1.5px] font-medium bg-[#c8f53a] text-[#080808] hover:bg-[#d8ff4a] disabled:opacity-50 hover:-translate-y-px active:scale-[0.98] transition-all duration-200 mt-1 cursor-pointer">
      {loading ? <span className="flex items-center justify-center gap-2"><svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="20" strokeDashoffset="10"/></svg>Ładowanie...</span> : children}
    </button>
  )
}

function BtnBack({ onClick }: { onClick:()=>void }) {
  return (
    <button type="button" onClick={onClick} className="w-full py-3 mt-2 rounded-xl text-[12px] font-mono uppercase tracking-[1.5px] bg-transparent border border-white/[0.08] text-neutral-400 hover:border-white/20 hover:text-neutral-400 transition-all duration-200 cursor-pointer">
      ← Wróć
    </button>
  )
}

function ErrMsg({ msg }: { msg: string }) {
  if (!msg) return null
  return <div role="alert" className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] font-mono">{msg}</div>
}

const BG_MAP: Record<string, number> = {
  choose:0, email:1, password:2, verify:2, reset:2, second:2, profile:3, goals:4, stats:4, success:5
}

/**
 * invite: trainer invite code from a scanned QR (/join/[code] → /auth?invite=CODE).
 * expired: the user was signed out after inactivity (IdleLogout).
 */
export default function AuthFlow({ invite = null, expired = false }: { invite?: string | null; expired?: boolean }) {
  const router = useRouter()
  const { signUp, isLoaded: upLoaded } = useSignUp()
  const { signIn, isLoaded: inLoaded } = useSignIn()
  const clerk = useClerk()
  const { setActive } = clerk

  /**
   * Clerk refuses a new sign-in/sign-up while another session is still active
   * ("You're already signed in") — e.g. when switching between accounts.
   * End that session first and continue on the reset client's resources.
   */
  const withoutActiveSession = async () => {
    if (clerk.session) await clerk.signOut(() => {}) // callback = no redirect
    return { signIn: clerk.client?.signIn ?? signIn, signUp: clerk.client?.signUp ?? signUp }
  }

  const [mode, setMode] = useState<Mode>('choose')
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [profile, setProfile] = useState<Profile>({ name:'', weight:78, height:178 })
  const [goals, setGoals] = useState<string[]>([])
  const [trainingStats, setTrainingStats] = useState<TrainingStats>({ level: '', weeklyDays: 3 })
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [inviteTrainer, setInviteTrainer] = useState<string | null>(null)
  const [inviteJoined, setInviteJoined] = useState(false)

  useEffect(() => {
    if (!invite) return
    fetchInvitePreview(invite).then(p => {
      if (p.valid) setInviteTrainer(p.trainer?.name ?? 'Twój trener')
    })
  }, [invite])

  const cardRef = useRef<HTMLDivElement>(null)
  const bgRef0 = useRef<HTMLDivElement>(null)
  const bgRef1 = useRef<HTMLDivElement>(null)
  const bgRef2 = useRef<HTMLDivElement>(null)
  const bgRef3 = useRef<HTMLDivElement>(null)
  const bgRef4 = useRef<HTMLDivElement>(null)
  const bgRef5 = useRef<HTMLDivElement>(null)
  const bgRefs = [bgRef0, bgRef1, bgRef2, bgRef3, bgRef4, bgRef5]

  const go = useCallback((nextStep: Step) => {
    setError('')
    setErrorCode(null)
    const nextBg = BG_MAP[nextStep] ?? 0
    gsap.timeline()
      .to(cardRef.current, { opacity:0, y:-18, duration:0.28, ease:'power2.in' })
      .call(() => {
        bgRefs.forEach((r,i) => gsap.to(r.current,{opacity:i===nextBg?1:0,duration:0.7,ease:'power2.inOut'}))
        setStep(nextStep)
      })
      .to(cardRef.current, { opacity:1, y:0, duration:0.45, ease:'expo.out' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useGSAP(() => {
    gsap.from(cardRef.current,{opacity:0,y:24,duration:0.8,ease:'expo.out',delay:0.1})
  },[])

  const navigateToDashboard = () => {
    router.push('/dashboard')
  }

  const handleRegEmail = () => {
    const normalizedEmail = email.trim()
    if (!normalizedEmail) {
      setError('Wpisz adres email')
      return
    }

    setCreatedSessionId(null)
    setEmail(normalizedEmail)
    go('password')
  }

  const handleRegPassword = async () => {
    if (!signUp || !upLoaded) return
    setLoading(true)
    try {
      const normalizedEmail = email.trim()
      const fresh = (await withoutActiveSession()).signUp ?? signUp
      await fresh.create({ emailAddress: normalizedEmail, password })
      await fresh.prepareEmailAddressVerification({ strategy: 'email_code' })
      setEmail(normalizedEmail)
      setCode('')
      go('verify')
    } catch (e: unknown) {
      setError(clerkErrorPl(e))
      setErrorCode(clerkErrorCode(e))
    } finally { setLoading(false) }
  }

  const resendSignUpCode = async () => {
    if (!signUp) return
    setLoading(true)
    setError('')
    try { await signUp.prepareEmailAddressVerification({ strategy: 'email_code' }) } catch (e: unknown) { setError(clerkErrorPl(e)) } finally { setLoading(false) }
  }

  /** The email already has an account: switch to signing in with it. */
  const loginInstead = () => {
    setMode('login')
    setPassword('')
    go('password')
  }

  const handleVerify = async () => {
    if (!signUp || !upLoaded) return
    setLoading(true)
    try {
      const res = await signUp.attemptEmailAddressVerification({ code: code.trim() })
      if (res.status === 'complete' && res.createdSessionId) {
        setCreatedSessionId(res.createdSessionId)
        go('profile')
      } else if (res.status === 'missing_requirements') {
        const missing = res.missingFields?.join(', ') || '?'
        setError(`Brakujące pola: [${missing}] — uzupełnij je w Clerk Dashboard (Configure → Email, Phone, Username → Personal information)`)
      } else {
        setError(`Nieoczekiwany status: ${res.status}`)
      }
    } catch (e: unknown) {
      setError(clerkErrorPl(e))
    } finally { setLoading(false) }
  }

  const handleProfile = () => {
    go('goals')
  }

  const handleGoals = () => {
    if (goals.length === 0) {
      setError('Wybierz co najmniej jeden cel')
      return
    }
    go('stats')
  }

  const handleStats = async () => {
    const sessionId = createdSessionId ?? signUp?.createdSessionId
    if (!sessionId) {
      setError('Sesja wygasła lub rejestracja nie została ukończona. Zacznij od nowa.')
      return
    }
    setLoading(true)
    try {
      await setActive({ session: sessionId })
      const firstName = profile.name.trim()
      if (firstName) await clerk.user?.update({ firstName }).catch(() => { /* saved below too */ })
      try {
        await fetch('/api/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: firstName || undefined,
            weightKg:  profile.weight,
            heightCm:  profile.height,
            level:     trainingStats.level || 'beginner',
            weeklyDays: trainingStats.weeklyDays,
            goals,
          }),
        })
      } catch { /* best-effort — don't block the user */ }
      if (invite && inviteTrainer) {
        const joined = await redeemInvite(invite)
        setInviteJoined(joined.ok)
      }
      go('success')
      setTimeout(navigateToDashboard, 1500)
    } catch (e: unknown) {
      setError(clerkErrorPl(e))
    } finally { setLoading(false) }
  }

  const handleLogEmail = () => {
    const trimmedEmail = email.trim()
    if (!trimmedEmail) { setError('Wpisz adres email'); return }
    if (!inLoaded) { setError('Trwa inicjalizacja — odśwież stronę'); return }
    setEmail(trimmedEmail)
    go('password')
  }

  /** After any successful sign-in: activate the session, redeem a pending trainer invite, open the app. */
  const finishLogin = async (sessionId: string | null) => {
    await setActive({ session: sessionId })
    if (invite && inviteTrainer) {
      const joined = await redeemInvite(invite)
      // On failure the join page explains why (expired, already used, …).
      router.push(joined.ok ? '/dashboard' : `/join/${invite}`)
    } else {
      router.push('/dashboard')
    }
  }

  // Clerk's second step: the factor in use and where the code went (masked email/phone).
  const [second, setSecond] = useState<{ strategy: SecondStrategy; available: SecondStrategy[]; sentTo?: string } | null>(null)

  type Factor = { strategy: string; emailAddressId?: string; phoneNumberId?: string; safeIdentifier?: string }

  /** Sends the code for email/phone factors. (This Clerk SDK version doesn't type email_code yet, hence the casts.) */
  const prepareSecond = async (strategy: SecondStrategy) => {
    const signInRes = clerk.client?.signIn ?? signIn
    if (!signInRes) return
    const factor = (signInRes.supportedSecondFactors as Factor[] | null)?.find(f => f.strategy === strategy)
    if (strategy === 'email_code') {
      await signInRes.prepareSecondFactor({ strategy: 'email_code', emailAddressId: factor?.emailAddressId } as never)
    } else if (strategy === 'phone_code') {
      await signInRes.prepareSecondFactor({ strategy: 'phone_code', phoneNumberId: factor?.phoneNumberId } as never)
    }
    return factor?.safeIdentifier
  }

  const startSecond = async (available: SecondStrategy[], strategy: SecondStrategy) => {
    const sentTo = await prepareSecond(strategy)
    setSecond({ strategy, available, sentTo })
    setCode('')
    go('second')
  }

  const handleLogPassword = async () => {
    if (!signIn || !inLoaded) { setError('Trwa inicjalizacja — odśwież stronę'); return }
    setLoading(true)
    try {
      const fresh = (await withoutActiveSession()).signIn ?? signIn
      let res = await fresh.create({ identifier: email, password })

      if (res.status === 'needs_first_factor') {
        res = await fresh.attemptFirstFactor({ strategy: 'password', password })
      }

      if (res.status === 'complete') {
        await finishLogin(res.createdSessionId)
      // Device Trust (new device → code by email): this SDK gets it as needs_second_factor, newer ones as needs_client_trust.
      } else if (res.status === 'needs_second_factor' || (res.status as string) === 'needs_client_trust') {
        const offered = ((res.supportedSecondFactors ?? []) as Factor[]).map(f => f.strategy)
        const available = SECOND_ORDER.filter(st => offered.includes(st))
        if (!available.length) { setError(`Wymagany dodatkowy krok logowania (${offered.join(', ') || 'nieznany'}), którego aplikacja nie obsługuje.`); return }
        await startSecond(available, available[0])
      } else {
        setError(`Nie można zakończyć logowania (status: ${res.status})`)
      }
    } catch (e: unknown) {
      setError(clerkErrorPl(e))
    } finally { setLoading(false) }
  }

  const handleSecond = async () => {
    const signInRes = clerk.client?.signIn ?? signIn
    if (!signInRes || !second) return
    setLoading(true)
    try {
      const res = await signInRes.attemptSecondFactor({ strategy: second.strategy, code: code.replace(/\s/g, '') } as never)
      if (res.status === 'complete') await finishLogin(res.createdSessionId)
      else setError(`Nie można zakończyć logowania (status: ${res.status})`)
    } catch (e: unknown) {
      setError(clerkErrorPl(e))
    } finally { setLoading(false) }
  }

  const resendSecond = async () => {
    if (!second) return
    setLoading(true)
    setError('')
    try { await prepareSecond(second.strategy) } catch (e: unknown) { setError(clerkErrorPl(e)) } finally { setLoading(false) }
  }

  /** Forgot password: Clerk emails a code; the code and a new password sign the user in. */
  const startReset = async () => {
    const normalizedEmail = email.trim()
    if (!normalizedEmail) { setError('Wpisz adres email'); return }
    if (!signIn || !inLoaded) { setError('Trwa inicjalizacja — odśwież stronę'); return }
    setLoading(true)
    try {
      const fresh = (await withoutActiveSession()).signIn ?? signIn
      await fresh.create({ strategy: 'reset_password_email_code', identifier: normalizedEmail })
      setEmail(normalizedEmail)
      setMode('reset')
      setCode('')
      setPassword('')
      go('reset')
    } catch (e: unknown) {
      setError(clerkErrorPl(e))
    } finally { setLoading(false) }
  }

  const handleReset = async () => {
    const signInRes = clerk.client?.signIn ?? signIn
    if (!signInRes) return
    if (password.length < 8) { setError('Hasło musi mieć co najmniej 8 znaków.'); return }
    setLoading(true)
    try {
      // After a rejected password the code is already used; only the new password is sent again.
      let res = signInRes
      if (res.status !== 'needs_new_password') {
        res = await signInRes.attemptFirstFactor({ strategy: 'reset_password_email_code', code: code.replace(/\s/g, '') })
      }
      res = await res.resetPassword({ password, signOutOfOtherSessions: true })
      if (res.status === 'complete') {
        await finishLogin(res.createdSessionId)
      } else if (res.status === 'needs_second_factor') {
        const offered = ((res.supportedSecondFactors ?? []) as Factor[]).map(f => f.strategy)
        const available = SECOND_ORDER.filter(st => offered.includes(st))
        if (!available.length) { setError('Hasło zmienione. Zaloguj się nowym hasłem.'); return }
        await startSecond(available, available[0])
      } else {
        setError(`Nie można zakończyć resetu hasła (status: ${res.status})`)
      }
    } catch (e: unknown) {
      setError(clerkErrorPl(e))
    } finally { setLoading(false) }
  }

  const renderStep = () => {
    if (mode === 'choose') return (
      <>
        <div className="text-center mb-7">
          {inviteTrainer ? (
            <>
              <p className="text-[10px] font-mono uppercase tracking-[2px] text-[#c8f53a] mb-2">Zaproszenie od trenera</p>
              <h1 className="font-display text-2xl font-black text-[#f0ece4] leading-tight mb-2">{inviteTrainer} zaprasza Cię do <em className="not-italic text-[#c8f53a]">RepTrack</em></h1>
              <p className="text-[13px] text-neutral-400">Załóż konto i wypełnij krótką ankietę — trener od razu zobaczy Twój profil.</p>
            </>
          ) : (
            <>
              <h1 className="font-display text-2xl font-black text-[#f0ece4] leading-tight mb-2">Witaj w <em className="not-italic text-[#c8f53a]">RepTrack</em></h1>
              <p className="text-[13px] text-neutral-400">Wybierz jak chcesz zacząć</p>
            </>
          )}
        </div>
        {expired && !clerk.user && (
          <p className="mb-4 rounded-xl border border-[#f5a03a]/25 bg-[#f5a03a]/[0.06] px-4 py-3 text-[12px] text-[#f5a03a]">
            Wylogowaliśmy Cię po dłuższej bezczynności. Zaloguj się ponownie.
          </p>
        )}
        {clerk.user && (
          <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-[12px] text-neutral-400 mb-2">
              Jesteś zalogowany jako <span className="text-[#f0ece4]">{clerk.user.primaryEmailAddress?.emailAddress}</span>.
              Logowanie na inne konto zamknie tę sesję.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => router.push('/dashboard')} className="flex-1 py-2 rounded-lg bg-[#c8f53a] text-[#080808] text-[11px] font-mono uppercase tracking-[1.2px] cursor-pointer">Przejdź do aplikacji</button>
              <button type="button" onClick={() => clerk.signOut(() => router.refresh())} className="flex-1 py-2 rounded-lg border border-white/10 text-neutral-300 text-[11px] font-mono uppercase tracking-[1.2px] cursor-pointer">Wyloguj</button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label:'Nowe konto', sub:'Rejestracja', lime:true, fn:()=>{setMode('register');go('email')} },
            { label:'Mam konto', sub:'Logowanie', lime:false, fn:()=>{setMode('login');go('email')} },
          ].map(({label,sub,lime,fn})=>(
            <button type="button" key={label} onClick={fn} className={`rounded-2xl p-6 text-center border transition-all duration-300 hover:-translate-y-1 cursor-pointer ${lime?'bg-[#c8f53a]/[0.06] border-[#c8f53a]/30 hover:bg-[#c8f53a]/10 hover:border-[#c8f53a]/60':'bg-white/[0.03] border-white/10 hover:border-white/20'}`}>
              <div className="text-base font-black font-display text-[#f0ece4] mb-1">{label}</div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">{sub}</div>
            </button>
          ))}
        </div>
      </>
    )

    if (step === 'email') return (
      <StepForm loading={loading} onSubmit={mode==='register'?handleRegEmail:mode==='reset'?startReset:handleLogEmail}>
        {mode!=='reset'&&<Dots total={mode==='register'?6:3} current={0}/>}
        <p className="text-[10px] font-mono uppercase tracking-[2.5px] text-neutral-400 mb-2">{mode==='register'?'Krok 1 z 6':mode==='reset'?'Reset hasła':'Krok 1 z 3'}</p>
        <h2 className="font-display text-2xl font-black text-[#f0ece4] mb-1">Twój <em className="not-italic text-[#c8f53a]">email</em></h2>
        <p className="text-[13px] text-neutral-400 mb-6">{mode==='register'?'Wyślemy kod weryfikacyjny.':mode==='reset'?'Wyślemy kod do ustawienia nowego hasła.':'Wpisz email powiązany z kontem.'}</p>
        <ErrMsg msg={error}/>
        <Field label="Adres email" type="email" name="email" autoComplete={mode==='register'?'email':'username'} inputMode="email"
          placeholder="mateusz@example.com" value={email} onChange={setEmail} autoFocus/>
        <BtnPrimary loading={loading}>{mode==='reset'?'Wyślij kod →':'Dalej →'}</BtnPrimary>
        <BtnBack onClick={()=>{ if (mode==='reset') { setMode('login'); go('password') } else { setMode('choose'); go('email') } }}/>
      </StepForm>
    )

    if (step === 'password') return (
      <StepForm loading={loading} onSubmit={mode==='register'?handleRegPassword:handleLogPassword}>
        <Dots total={mode==='register'?6:3} current={1}/>
        <p className="text-[10px] font-mono uppercase tracking-[2.5px] text-neutral-400 mb-2">{mode==='register'?'Krok 2 z 6':'Krok 2 z 3'}</p>
        <h2 className="font-display text-2xl font-black text-[#f0ece4] mb-1">{mode==='register'?<>Ustaw <em className="not-italic text-[#c8f53a]">hasło</em></>:<>Wpisz <em className="not-italic text-[#c8f53a]">hasło</em></>}</h2>
        <p className="text-[13px] text-neutral-400 mb-6">{mode==='register'?`Konto: ${email}`:`Logowanie jako ${email}`}</p>
        <ErrMsg msg={error}/>
        {mode==='register'&&errorCode==='form_identifier_exists'&&(
          <button type="button" onClick={loginInstead} className="w-full -mt-2 mb-4 py-2.5 rounded-xl border border-[#c8f53a]/30 text-[#c8f53a] text-[11px] font-mono uppercase tracking-[1.3px] cursor-pointer">
            Zaloguj się tym adresem →
          </button>
        )}
        {/* Tells password managers which account the password belongs to. */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <PasswordField label="Hasło" value={password} onChange={setPassword} autoFocus
          autoComplete={mode==='register'?'new-password':'current-password'}>
          {mode==='register'&&<PwRules value={password}/>}
        </PasswordField>
        {mode==='login'&&(
          <button type="button" onClick={startReset} disabled={loading}
            className="block ml-auto -mt-3 mb-4 text-[11px] text-neutral-400 hover:text-[#c8f53a] underline-offset-2 hover:underline cursor-pointer">
            Nie pamiętasz hasła?
          </button>
        )}
        <BtnPrimary loading={loading}>{mode==='register'?'Dalej →':'Zaloguj →'}</BtnPrimary>
        <BtnBack onClick={()=>go('email')}/>
      </StepForm>
    )

    if (step === 'reset') return (
      <StepForm loading={loading} onSubmit={handleReset}>
        <p className="text-[10px] font-mono uppercase tracking-[2.5px] text-neutral-400 mb-2">Reset hasła</p>
        <h2 className="font-display text-2xl font-black text-[#f0ece4] mb-1">Nowe <em className="not-italic text-[#c8f53a]">hasło</em></h2>
        <p className="text-[13px] text-neutral-400 mb-6">Wysłaliśmy 6-cyfrowy kod na <strong className="text-[#f0ece4] font-normal">{email}</strong>. Sprawdź też spam.</p>
        <ErrMsg msg={error}/>
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <Field label="Kod z maila" name="code" autoComplete="one-time-code" inputMode="numeric" placeholder="123456" value={code} onChange={setCode} autoFocus/>
        <PasswordField label="Nowe hasło" value={password} onChange={setPassword} autoComplete="new-password">
          <PwRules value={password}/>
        </PasswordField>
        <BtnPrimary loading={loading}>Ustaw hasło i zaloguj →</BtnPrimary>
        <button type="button" onClick={startReset} disabled={loading} className="w-full mt-3 text-[11px] font-mono uppercase tracking-[1.3px] text-neutral-400 hover:text-[#c8f53a] cursor-pointer">Wyślij kod ponownie</button>
        <BtnBack onClick={()=>{ setMode('login'); go('password') }}/>
      </StepForm>
    )

    if (step === 'second' && second) {
      const label: Record<SecondStrategy, string> = {
        email_code: 'Kod z maila', totp: 'Kod z aplikacji', phone_code: 'Kod z SMS-a', backup_code: 'Kod zapasowy',
      }
      const hint: Record<SecondStrategy, string> = {
        email_code: `Logujesz się z nowego urządzenia. Wysłaliśmy 6-cyfrowy kod na ${second.sentTo ?? 'Twój email'} — sprawdź też spam.`,
        totp: 'Wpisz 6-cyfrowy kod z aplikacji uwierzytelniającej.',
        phone_code: `Wysłaliśmy kod SMS na ${second.sentTo ?? 'Twój numer'}.`,
        backup_code: 'Wpisz jeden z kodów zapasowych.',
      }
      return (
        <StepForm loading={loading} onSubmit={handleSecond}>
          <Dots total={3} current={2}/>
          <p className="text-[10px] font-mono uppercase tracking-[2.5px] text-neutral-400 mb-2">Krok 3 z 3</p>
          <h2 className="font-display text-2xl font-black text-[#f0ece4] mb-1">Potwierdź <em className="not-italic text-[#c8f53a]">logowanie</em></h2>
          <p className="text-[13px] text-neutral-400 mb-6">{hint[second.strategy]}</p>
          <ErrMsg msg={error}/>
          <Field label={label[second.strategy]} name="code" autoComplete="one-time-code" inputMode={second.strategy === 'backup_code' ? 'text' : 'numeric'}
            placeholder="123456" value={code} onChange={setCode} autoFocus/>
          <BtnPrimary loading={loading}>Zaloguj →</BtnPrimary>
          {(second.strategy === 'email_code' || second.strategy === 'phone_code') && (
            <button type="button" onClick={resendSecond} disabled={loading} className="w-full mt-3 text-[11px] font-mono uppercase tracking-[1.3px] text-neutral-400 hover:text-[#c8f53a] cursor-pointer">Wyślij kod ponownie</button>
          )}
          {second.available.filter(st => st !== second.strategy).map(st => (
            <button type="button" key={st} onClick={() => { setError(''); startSecond(second.available, st).catch(e => setError(clerkErrorPl(e))) }}
              className="w-full mt-2 text-[11px] font-mono uppercase tracking-[1.3px] text-neutral-400 hover:text-[#c8f53a] cursor-pointer">
              Użyj: {label[st].toLowerCase()}
            </button>
          ))}
          <BtnBack onClick={()=>go('password')}/>
        </StepForm>
      )
    }

    if (step === 'verify') return (
      <StepForm loading={loading} onSubmit={handleVerify}>
        <Dots total={6} current={2}/>
        <p className="text-[10px] font-mono uppercase tracking-[2.5px] text-neutral-400 mb-2">Krok 3 z 6</p>
        <h2 className="font-display text-2xl font-black text-[#f0ece4] mb-1">Sprawdź <em className="not-italic text-[#c8f53a]">email</em></h2>
        <p className="text-[13px] text-neutral-400 mb-6">Wysłaliśmy 6-cyfrowy kod na <strong className="text-neutral-400 font-normal">{email}</strong></p>
        <ErrMsg msg={error}/>
        <Field label="Kod weryfikacyjny" name="code" autoComplete="one-time-code" inputMode="numeric" placeholder="123456" value={code} onChange={setCode} autoFocus/>
        <BtnPrimary loading={loading}>Zweryfikuj →</BtnPrimary>
        <button type="button" onClick={resendSignUpCode} disabled={loading} className="w-full mt-3 text-[11px] font-mono uppercase tracking-[1.3px] text-neutral-400 hover:text-[#c8f53a] cursor-pointer">Wyślij kod ponownie</button>
        <BtnBack onClick={()=>go('password')}/>
      </StepForm>
    )

    if (step === 'profile') return (
      <StepForm loading={loading} onSubmit={handleProfile}>
        <Dots total={6} current={3}/>
        <p className="text-[10px] font-mono uppercase tracking-[2.5px] text-neutral-400 mb-2">Krok 4 z 6</p>
        <h2 className="font-display text-2xl font-black text-[#f0ece4] mb-1">Twój <em className="not-italic text-[#c8f53a]">profil</em></h2>
        <p className="text-[13px] text-neutral-400 mb-5">Dane pomagają AI dokładniej analizować postępy.</p>
        <Field label="Imię" name="given-name" autoComplete="given-name" placeholder="Mateusz" value={profile.name} onChange={v=>setProfile(p=>({...p,name:v}))} autoFocus/>
        <div className="mb-5">
          <div className="flex justify-between items-baseline mb-2.5">
            <span className="text-[10px] font-mono uppercase tracking-[1.5px] text-neutral-400">Waga</span>
            <span className="font-display text-2xl font-black text-[#c8f53a]">{profile.weight} <span className="text-sm font-sans font-light text-neutral-400">kg</span></span>
          </div>
          <input type="range" min={40} max={150} step={1} value={profile.weight} onChange={e=>setProfile(p=>({...p,weight:+e.target.value}))} className="w-full accent-[#c8f53a]"/>
        </div>
        <div className="mb-6">
          <div className="flex justify-between items-baseline mb-2.5">
            <span className="text-[10px] font-mono uppercase tracking-[1.5px] text-neutral-400">Wzrost</span>
            <span className="font-display text-2xl font-black text-[#f5a03a]">{profile.height} <span className="text-sm font-sans font-light text-neutral-400">cm</span></span>
          </div>
          <input type="range" min={140} max={220} step={1} value={profile.height} onChange={e=>setProfile(p=>({...p,height:+e.target.value}))} className="w-full accent-[#f5a03a]"/>
        </div>
        <BtnPrimary loading={loading}>Dalej →</BtnPrimary>
        <BtnBack onClick={()=>go('verify')}/>
      </StepForm>
    )

    if (step === 'goals') return (
      <StepForm loading={loading} onSubmit={handleGoals}>
        <Dots total={6} current={4}/>
        <p className="text-[10px] font-mono uppercase tracking-[2.5px] text-neutral-400 mb-2">Krok 5 z 6</p>
        <h2 className="font-display text-2xl font-black text-[#f0ece4] mb-1">Twoje <em className="not-italic text-[#c8f53a]">cele</em></h2>
        <p className="text-[13px] text-neutral-400 mb-5">Wybierz co chcesz osiągnąć.</p>
        <div className="flex flex-col gap-2 mb-5">
          {[
            {key:'run',label:'Poprawić bieganie',sub:'Tempo, dystans, maraton',icon:'🏃'},
            {key:'strength',label:'Zwiększyć siłę',sub:'PR na siłowni, masa mięśniowa',icon:'🏋️'},
            {key:'weight',label:'Zmienić masę ciała',sub:'Schudnąć lub przytyć',icon:'⚖️'},
          ].map(({key,label,sub,icon})=>{
            const sel=goals.includes(key)
            return (
              <button type="button" key={key} aria-pressed={sel} onClick={()=>setGoals(g=>sel?g.filter(x=>x!==key):[...g,key])}
                className={`flex items-center gap-3 p-4 rounded-2xl border text-left cursor-pointer transition-all duration-200 ${sel?'bg-[#c8f53a]/[0.08] border-[#c8f53a]/40 translate-x-1':'bg-white/[0.02] border-white/[0.08] hover:border-[#c8f53a]/20 hover:translate-x-1'}`}>
                <span style={{fontSize:16}}>{icon}</span>
                <div className="flex-1"><div className="text-[13px] font-medium text-[#d0ccc4]">{label}</div><div className="text-[10px] font-mono text-[#8a8a8a]">{sub}</div></div>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${sel?'bg-[#c8f53a] border-[#c8f53a]':'border-white/10'}`}>
                  {sel&&<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#080808" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                </div>
              </button>
            )
          })}
        </div>
        <BtnPrimary loading={loading}>Dalej →</BtnPrimary>
        <BtnBack onClick={()=>go('profile')}/>
      </StepForm>
    )

    if (step === 'stats') return (
      <StepForm loading={loading} onSubmit={handleStats}>
        <Dots total={6} current={5}/>
        <p className="text-[10px] font-mono uppercase tracking-[2.5px] text-neutral-400 mb-2">Krok 6 z 6</p>
        <h2 className="font-display text-2xl font-black text-[#f0ece4] mb-1">Twój <em className="not-italic text-[#c8f53a]">poziom</em></h2>
        <p className="text-[13px] text-neutral-400 mb-5">Dopasujemy plan do Twojego doświadczenia.</p>
        <div className="flex flex-col gap-2 mb-5">
          {[
            {key:'beginner',   label:'Początkujący',         sub:'Zaczynam przygodę z treningiem'},
            {key:'intermediate',label:'Średniozaawansowany', sub:'1–3 lata regularnego treningu'},
            {key:'advanced',   label:'Zaawansowany',         sub:'Ponad 3 lata, wiem co robię'},
          ].map(({key,label,sub})=>{
            const sel=trainingStats.level===key
            return (
              <button type="button" key={key} aria-pressed={sel} onClick={()=>setTrainingStats(s=>({...s,level:key}))}
                className={`flex items-center gap-3 p-4 rounded-2xl border text-left cursor-pointer transition-all duration-200 ${sel?'bg-[#c8f53a]/[0.08] border-[#c8f53a]/40 translate-x-1':'bg-white/[0.02] border-white/[0.08] hover:border-[#c8f53a]/20 hover:translate-x-1'}`}>
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-[#d0ccc4]">{label}</div>
                  <div className="text-[10px] font-mono text-[#8a8a8a]">{sub}</div>
                </div>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${sel?'bg-[#c8f53a] border-[#c8f53a]':'border-white/10'}`}>
                  {sel&&<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#080808" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                </div>
              </button>
            )
          })}
        </div>
        <div className="mb-6">
          <div className="flex justify-between items-baseline mb-2.5">
            <span className="text-[10px] font-mono uppercase tracking-[1.5px] text-neutral-400">Treningi / tydzień</span>
            <span className="font-display text-2xl font-black text-[#c8f53a]">{trainingStats.weeklyDays}<span className="text-sm font-sans font-light text-neutral-400 ml-1">dni</span></span>
          </div>
          <input type="range" min={1} max={7} step={1} value={trainingStats.weeklyDays}
            onChange={e=>setTrainingStats(s=>({...s,weeklyDays:+e.target.value}))}
            className="w-full accent-[#c8f53a]"/>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] font-mono text-[#8a8a8a]">1 dzień</span>
            <span className="text-[9px] font-mono text-[#8a8a8a]">7 dni</span>
          </div>
        </div>
        <BtnPrimary loading={loading}>Utwórz konto →</BtnPrimary>
        <BtnBack onClick={()=>go('goals')}/>
      </StepForm>
    )

    if (step === 'success') return (
      <div className="text-center py-4">
        <div className="w-16 h-16 rounded-full bg-[#c8f53a]/10 border border-[#c8f53a]/30 flex items-center justify-center mx-auto mb-6">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M6 14l5 5 11-11" stroke="#c8f53a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <h2 className="font-display text-3xl font-black text-[#f0ece4] mb-2">{mode==='register'?'Konto gotowe!':'Witaj z powrotem!'}</h2>
        <p className="text-[13px] text-neutral-400 mb-7">{mode==='register'?'Twój profil jest skonfigurowany. Czas progresować.':'Zalogowano pomyślnie.'}</p>
        {inviteJoined && inviteTrainer && (
          <p className="-mt-4 mb-6 text-[12px] text-[#c8f53a]">Dołączono do trenera: {inviteTrainer}</p>
        )}
        {mode==='register'&&(
          <div className="grid grid-cols-3 gap-2 mb-6">
            {[
              [String(trainingStats.weeklyDays), 'Dni/tydz'],
              [trainingStats.level==='advanced'?'Exp':trainingStats.level==='intermediate'?'Mid':'New', 'Poziom'],
              [String(goals.length), 'Cele'],
            ].map(([val,lbl])=>(
              <div key={lbl} className="bg-white/[0.03] border border-white/[0.06] rounded-xl py-3.5 px-2">
                <div className="font-display text-xl font-black text-[#c8f53a]">{val}</div>
                <div className="text-[8px] font-mono uppercase tracking-wider text-[#8a8a8a] mt-0.5">{lbl}</div>
              </div>
            ))}
          </div>
        )}
        <BtnPrimary onClick={navigateToDashboard}>Przejdź do aplikacji →</BtnPrimary>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#080808]">
      {/* TŁA */}
      <div ref={bgRef0} className="absolute inset-0 opacity-100 pointer-events-none">
        <div className="absolute inset-y-0 left-0 w-1/2 bg-[#0d0d0d] border-r border-[#1a1a1a]"/>
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[#0a0f05]"/>
        <div className="absolute inset-y-0 left-1/2 w-px bg-[#c8f53a]/30"/>
      </div>
      <div ref={bgRef1} className="absolute inset-0 opacity-0 pointer-events-none bg-[#080808]">
        <div className="absolute inset-0 [background-image:linear-gradient(rgba(200,245,58,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(200,245,58,0.04)_1px,transparent_1px)] [background-size:48px_48px] animate-gridMove"/>
        <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#c8f53a]/50 to-transparent animate-scan"/>
      </div>
      <div ref={bgRef2} className="absolute inset-0 opacity-0 pointer-events-none bg-[#080808] overflow-hidden">
        {Array.from({length:24},(_,i)=>(
          <div key={i} className="absolute w-1 h-1 rounded-full bg-[#c8f53a]/25 animate-float"
            style={{left:`${(i*37+13)%100}%`,top:`${(i*53+7)%100}%`,animationDuration:`${4+i%5}s`,animationDelay:`${(i*0.3)%4}s`}}/>
        ))}
      </div>
      <div ref={bgRef3} className="absolute inset-0 opacity-0 pointer-events-none bg-[#0a0808]">
        <div className="absolute inset-0 [background-image:linear-gradient(rgba(245,160,58,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(245,160,58,0.04)_1px,transparent_1px)] [background-size:40px_40px]"/>
        <div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] rounded-full border border-[#f5a03a]/15 animate-pulseRing" style={{transform:'translate(-50%,-50%)'}}/>
        <div className="absolute top-1/2 left-1/2 w-[500px] h-[500px] rounded-full border border-[#f5a03a]/10 animate-pulseRing" style={{transform:'translate(-50%,-50%)',animationDelay:'0.8s'}}/>
      </div>
      <div ref={bgRef4} className="absolute inset-0 opacity-0 pointer-events-none bg-[#080808]">
        {[20,40,60,80].map((t,i)=>(
          <div key={t} className="absolute left-0 right-0 h-px bg-[#c8f53a]/[0.08] animate-trackSlide" style={{top:`${t}%`,animationDelay:`${i*0.5}s`}}/>
        ))}
      </div>
      <div ref={bgRef5} className="absolute inset-0 opacity-0 pointer-events-none bg-[#080808]">
        <div className="absolute inset-0 [background-image:radial-gradient(circle_at_50%_50%,rgba(200,245,58,0.05)_0%,transparent_60%)]"/>
      </div>

      {/* Clerk CAPTCHA - musi być zawsze w DOM */}
      <div id="clerk-captcha" className="absolute opacity-0 pointer-events-none" aria-hidden="true" />

      {/* KARTA */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-8">
        <div ref={cardRef} className="w-full max-w-sm bg-white/[0.03] border border-white/[0.08] rounded-3xl p-10 backdrop-blur-xl">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-2 h-2 rounded-full bg-[#c8f53a]"/>
            <span className="font-display text-base font-black text-[#f0ece4]">RepTrack</span>
          </div>
          {renderStep()}
        </div>
      </div>
    </div>
  )
}
