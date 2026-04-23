'use client'

import { useSignUp, useSignIn } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useRef, useState, useCallback } from 'react'

type Mode = 'choose' | 'login' | 'register'
type Step = 'email' | 'password' | 'verify' | 'profile' | 'goals' | 'success'

interface Profile { name: string; weight: number; height: number }

function Field({ label, type = 'text', placeholder, value, onChange, autoFocus = false }: {
  label: string; type?: string; placeholder: string
  value: string; onChange: (v: string) => void; autoFocus?: boolean
}) {
  return (
    <div className="mb-4">
      <label className="block text-[10px] font-mono uppercase tracking-[2px] text-neutral-600 mb-2">{label}</label>
      <input type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
        autoFocus={autoFocus}
        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3.5 text-sm text-[#f0ece4] placeholder:text-neutral-700 focus:outline-none focus:border-[#c8f53a]/40 transition-colors"
      />
    </div>
  )
}

function PwStrength({ value }: { value: string }) {
  const score = (value.length >= 8 ? 1 : 0) + (/\d/.test(value) ? 1 : 0) + (/[^a-zA-Z0-9]/.test(value) ? 1 : 0)
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1.5">
        {[1,2,3].map(i => <div key={i} className={`h-[3px] flex-1 rounded-sm transition-all duration-300 ${score >= i ? 'bg-[#c8f53a]' : 'bg-[#1a1a1a]'}`} />)}
      </div>
      <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-600">
        {value.length === 0 ? 'Wpisz hasło' : score < 2 ? 'Słabe' : score < 3 ? 'Dobre' : 'Silne'}
      </span>
    </div>
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

function BtnPrimary({ onClick, children, loading=false }: { onClick:()=>void; children:React.ReactNode; loading?:boolean }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="w-full py-4 rounded-xl text-[13px] font-mono uppercase tracking-[1.5px] font-medium bg-[#c8f53a] text-[#080808] hover:bg-[#d8ff4a] disabled:opacity-50 hover:-translate-y-px active:scale-[0.98] transition-all duration-200 mt-1 cursor-pointer">
      {loading ? <span className="flex items-center justify-center gap-2"><svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="20" strokeDashoffset="10"/></svg>Ładowanie...</span> : children}
    </button>
  )
}

function BtnBack({ onClick }: { onClick:()=>void }) {
  return (
    <button onClick={onClick} className="w-full py-3 mt-2 rounded-xl text-[12px] font-mono uppercase tracking-[1.5px] bg-transparent border border-white/[0.08] text-neutral-600 hover:border-white/20 hover:text-neutral-400 transition-all duration-200 cursor-pointer">
      ← Wróć
    </button>
  )
}

function ErrMsg({ msg }: { msg: string }) {
  if (!msg) return null
  return <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] font-mono">{msg}</div>
}

const BG_MAP: Record<string, number> = {
  choose:0, email:1, password:2, verify:2, profile:3, goals:4, success:5
}

export default function AuthFlow() {
  const router = useRouter()
  const { signUp, setActive: setActiveUp, isLoaded: upLoaded } = useSignUp()
  const { signIn, setActive: setActiveIn, isLoaded: inLoaded } = useSignIn()

  const [mode, setMode] = useState<Mode>('choose')
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [profile, setProfile] = useState<Profile>({ name:'', weight:78, height:178 })
  const [goals, setGoals] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  const handleRegEmail = async () => {
    if (!signUp || !upLoaded) return
    setLoading(true)
    try {
      await signUp.create({ emailAddress: email })
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
      go('password')
    } catch (e: unknown) {
      setError((e as {errors?:{message:string}[]}).errors?.[0]?.message ?? 'Błąd')
    } finally { setLoading(false) }
  }

  const handleRegPassword = async () => {
    if (!signUp || !upLoaded) return
    setLoading(true)
    try {
      await signUp.update({ password })
      go('verify')
    } catch (e: unknown) {
      setError((e as {errors?:{message:string}[]}).errors?.[0]?.message ?? 'Błąd')
    } finally { setLoading(false) }
  }

  const handleVerify = async () => {
    if (!signUp || !upLoaded) return
    setLoading(true)
    try {
      await signUp.attemptEmailAddressVerification({ code })
      go('profile')
    } catch (e: unknown) {
      setError((e as {errors?:{message:string}[]}).errors?.[0]?.message ?? 'Nieprawidłowy kod')
    } finally { setLoading(false) }
  }

  const handleProfile = () => {
    go('goals')
  }

  const handleGoals = async () => {
    if (!signUp || !setActiveUp) return
    setLoading(true)
    try {
      let sessionId = signUp.createdSessionId
      if (!sessionId) {
        const updated = await signUp.update({
          firstName: profile.name || undefined,
        })
        sessionId = updated.createdSessionId
      }
      if (sessionId) await setActiveUp({ session: sessionId })
      go('success')
    } catch (e: unknown) {
      setError((e as {errors?:{message:string}[]}).errors?.[0]?.message ?? 'Błąd')
    } finally { setLoading(false) }
  }

  const handleLogEmail = async () => {
    if (!signIn || !inLoaded) return
    setLoading(true)
    try {
      const res = await signIn.create({ identifier: email })
      if (res.status === 'needs_first_factor') go('password')
    } catch (e: unknown) {
      setError((e as {errors?:{message:string}[]}).errors?.[0]?.message ?? 'Konto nie istnieje')
    } finally { setLoading(false) }
  }

  const handleLogPassword = async () => {
    if (!signIn || !setActiveIn || !inLoaded) return
    setLoading(true)
    try {
      const res = await signIn.attemptFirstFactor({ strategy:'password', password })
      if (res.status === 'complete') {
        await setActiveIn({ session: res.createdSessionId })
        go('success')
      }
    } catch (e: unknown) {
      setError((e as {errors?:{message:string}[]}).errors?.[0]?.message ?? 'Nieprawidłowe hasło')
    } finally { setLoading(false) }
  }

  const renderStep = () => {
    if (mode === 'choose') return (
      <>
        <div className="text-center mb-7">
          <h1 className="font-display text-2xl font-black text-[#f0ece4] leading-tight mb-2">Witaj w <em className="not-italic text-[#c8f53a]">RepTrack</em></h1>
          <p className="text-[13px] text-neutral-600">Wybierz jak chcesz zacząć</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label:'Nowe konto', sub:'Rejestracja', lime:true, fn:()=>{setMode('register');go('email')} },
            { label:'Mam konto', sub:'Logowanie', lime:false, fn:()=>{setMode('login');go('email')} },
          ].map(({label,sub,lime,fn})=>(
            <button key={label} onClick={fn} className={`rounded-2xl p-6 text-center border transition-all duration-300 hover:-translate-y-1 cursor-pointer ${lime?'bg-[#c8f53a]/[0.06] border-[#c8f53a]/30 hover:bg-[#c8f53a]/10 hover:border-[#c8f53a]/60':'bg-white/[0.03] border-white/10 hover:border-white/20'}`}>
              <div className="text-base font-black font-display text-[#f0ece4] mb-1">{label}</div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-600">{sub}</div>
            </button>
          ))}
        </div>
      </>
    )

    if (step === 'email') return (
      <>
        <Dots total={mode==='register'?5:3} current={0}/>
        <p className="text-[10px] font-mono uppercase tracking-[2.5px] text-neutral-600 mb-2">{mode==='register'?'Krok 1 z 5':'Krok 1 z 3'}</p>
        <h2 className="font-display text-2xl font-black text-[#f0ece4] mb-1">Twój <em className="not-italic text-[#c8f53a]">email</em></h2>
        <p className="text-[13px] text-neutral-600 mb-6">{mode==='register'?'Wyślemy kod weryfikacyjny.':'Wpisz email powiązany z kontem.'}</p>
        <ErrMsg msg={error}/>
        <Field label="Adres email" type="email" placeholder="mateusz@example.com" value={email} onChange={setEmail} autoFocus/>
        <BtnPrimary loading={loading} onClick={mode==='register'?handleRegEmail:handleLogEmail}>Dalej →</BtnPrimary>
        <BtnBack onClick={()=>{setMode('choose');go('email')}}/>
      </>
    )

    if (step === 'password') return (
      <>
        <Dots total={mode==='register'?5:3} current={1}/>
        <p className="text-[10px] font-mono uppercase tracking-[2.5px] text-neutral-600 mb-2">{mode==='register'?'Krok 2 z 5':'Krok 2 z 3'}</p>
        <h2 className="font-display text-2xl font-black text-[#f0ece4] mb-1">{mode==='register'?<>Ustaw <em className="not-italic text-[#c8f53a]">hasło</em></>:<>Wpisz <em className="not-italic text-[#c8f53a]">hasło</em></>}</h2>
        <p className="text-[13px] text-neutral-600 mb-6">{mode==='register'?'Min. 8 znaków, cyfry i symbole.':`Logowanie jako ${email}`}</p>
        <ErrMsg msg={error}/>
        <div className="mb-5">
          <label className="block text-[10px] font-mono uppercase tracking-[2px] text-neutral-600 mb-2">Hasło</label>
          <input type="password" autoFocus value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3.5 text-sm text-[#f0ece4] placeholder:text-neutral-700 focus:outline-none focus:border-[#c8f53a]/40 transition-colors"/>
          {mode==='register'&&<PwStrength value={password}/>}
        </div>
        <BtnPrimary loading={loading} onClick={mode==='register'?handleRegPassword:handleLogPassword}>{mode==='register'?'Dalej →':'Zaloguj →'}</BtnPrimary>
        <BtnBack onClick={()=>go('email')}/>
      </>
    )

    if (step === 'verify') return (
      <>
        <Dots total={5} current={2}/>
        <p className="text-[10px] font-mono uppercase tracking-[2.5px] text-neutral-600 mb-2">Krok 3 z 5</p>
        <h2 className="font-display text-2xl font-black text-[#f0ece4] mb-1">Sprawdź <em className="not-italic text-[#c8f53a]">email</em></h2>
        <p className="text-[13px] text-neutral-600 mb-6">Wysłaliśmy 6-cyfrowy kod na <strong className="text-neutral-400 font-normal">{email}</strong></p>
        <ErrMsg msg={error}/>
        <Field label="Kod weryfikacyjny" placeholder="123456" value={code} onChange={setCode} autoFocus/>
        <BtnPrimary loading={loading} onClick={handleVerify}>Zweryfikuj →</BtnPrimary>
        <BtnBack onClick={()=>go('password')}/>
      </>
    )

    if (step === 'profile') return (
      <>
        <Dots total={5} current={3}/>
        <p className="text-[10px] font-mono uppercase tracking-[2.5px] text-neutral-600 mb-2">Krok 4 z 5</p>
        <h2 className="font-display text-2xl font-black text-[#f0ece4] mb-1">Twój <em className="not-italic text-[#c8f53a]">profil</em></h2>
        <p className="text-[13px] text-neutral-600 mb-5">Dane pomagają AI dokładniej analizować postępy.</p>
        <Field label="Imię" placeholder="Mateusz" value={profile.name} onChange={v=>setProfile(p=>({...p,name:v}))} autoFocus/>
        <div className="mb-5">
          <div className="flex justify-between items-baseline mb-2.5">
            <span className="text-[10px] font-mono uppercase tracking-[1.5px] text-neutral-600">Waga</span>
            <span className="font-display text-2xl font-black text-[#c8f53a]">{profile.weight} <span className="text-sm font-sans font-light text-neutral-600">kg</span></span>
          </div>
          <input type="range" min={40} max={150} step={1} value={profile.weight} onChange={e=>setProfile(p=>({...p,weight:+e.target.value}))} className="w-full accent-[#c8f53a]"/>
        </div>
        <div className="mb-6">
          <div className="flex justify-between items-baseline mb-2.5">
            <span className="text-[10px] font-mono uppercase tracking-[1.5px] text-neutral-600">Wzrost</span>
            <span className="font-display text-2xl font-black text-[#f5a03a]">{profile.height} <span className="text-sm font-sans font-light text-neutral-600">cm</span></span>
          </div>
          <input type="range" min={140} max={220} step={1} value={profile.height} onChange={e=>setProfile(p=>({...p,height:+e.target.value}))} className="w-full accent-[#f5a03a]"/>
        </div>
        <BtnPrimary onClick={handleProfile}>Dalej →</BtnPrimary>
        <BtnBack onClick={()=>go('verify')}/>
      </>
    )

    if (step === 'goals') return (
      <>
        <Dots total={5} current={4}/>
        <p className="text-[10px] font-mono uppercase tracking-[2.5px] text-neutral-600 mb-2">Krok 5 z 5</p>
        <h2 className="font-display text-2xl font-black text-[#f0ece4] mb-1">Twoje <em className="not-italic text-[#c8f53a]">cele</em></h2>
        <p className="text-[13px] text-neutral-600 mb-5">Wybierz co chcesz osiągnąć.</p>
        <div className="flex flex-col gap-2 mb-5">
          {[
            {key:'run',label:'Poprawić bieganie',sub:'Tempo, dystans, maraton',icon:'🏃'},
            {key:'strength',label:'Zwiększyć siłę',sub:'PR na siłowni, masa mięśniowa',icon:'🏋️'},
            {key:'weight',label:'Zmienić masę ciała',sub:'Schudnąć lub przytyć',icon:'⚖️'},
          ].map(({key,label,sub,icon})=>{
            const sel=goals.includes(key)
            return (
              <button key={key} onClick={()=>setGoals(g=>sel?g.filter(x=>x!==key):[...g,key])}
                className={`flex items-center gap-3 p-4 rounded-2xl border text-left cursor-pointer transition-all duration-200 ${sel?'bg-[#c8f53a]/[0.08] border-[#c8f53a]/40 translate-x-1':'bg-white/[0.02] border-white/[0.08] hover:border-[#c8f53a]/20 hover:translate-x-1'}`}>
                <span style={{fontSize:16}}>{icon}</span>
                <div className="flex-1"><div className="text-[13px] font-medium text-[#d0ccc4]">{label}</div><div className="text-[10px] font-mono text-neutral-700">{sub}</div></div>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${sel?'bg-[#c8f53a] border-[#c8f53a]':'border-white/10'}`}>
                  {sel&&<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#080808" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                </div>
              </button>
            )
          })}
        </div>
        <BtnPrimary loading={loading} onClick={handleGoals}>Utwórz konto →</BtnPrimary>
        <BtnBack onClick={()=>go('profile')}/>
      </>
    )

    if (step === 'success') return (
      <div className="text-center py-4">
        <div className="w-16 h-16 rounded-full bg-[#c8f53a]/10 border border-[#c8f53a]/30 flex items-center justify-center mx-auto mb-6">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M6 14l5 5 11-11" stroke="#c8f53a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <h2 className="font-display text-3xl font-black text-[#f0ece4] mb-2">{mode==='register'?'Konto gotowe!':'Witaj z powrotem!'}</h2>
        <p className="text-[13px] text-neutral-600 mb-7">{mode==='register'?'Twój profil jest skonfigurowany. Czas progresować.':'Zalogowano pomyślnie.'}</p>
        {mode==='register'&&(
          <div className="grid grid-cols-3 gap-2 mb-6">
            {[['0','Treningi'],['45km','Plan'],[String(goals.length),'Cele']].map(([val,lbl])=>(
              <div key={lbl} className="bg-white/[0.03] border border-white/[0.06] rounded-xl py-3.5 px-2">
                <div className="font-display text-xl font-black text-[#c8f53a]">{val}</div>
                <div className="text-[8px] font-mono uppercase tracking-wider text-neutral-700 mt-0.5">{lbl}</div>
              </div>
            ))}
          </div>
        )}
        <BtnPrimary onClick={()=>router.push('/dashboard')}>Przejdź do aplikacji →</BtnPrimary>
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
