'use client'
import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import Link from 'next/link'

gsap.registerPlugin()

export function Hero() {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    gsap.from('.hero-badge', { opacity: 0, y: 20, duration: 0.6, delay: 0.1, ease: 'expo.out' })
    gsap.from('.hero-title', { opacity: 0, y: 40, duration: 0.8, delay: 0.2, ease: 'expo.out' })
    gsap.from('.hero-sub',   { opacity: 0, y: 24, duration: 0.7, delay: 0.4, ease: 'expo.out' })
    gsap.from('.hero-btns',  { opacity: 0, y: 24, duration: 0.7, delay: 0.55, ease: 'expo.out' })
    gsap.from('.hero-stats', { opacity: 0, y: 16, duration: 0.6, delay: 0.7, ease: 'expo.out', stagger: 0.08 })
  }, { scope: containerRef })

  return (
    <section ref={containerRef} className="relative min-h-screen flex flex-col justify-center px-6 md:px-16 lg:px-24 pt-28 pb-20 overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.025]"
        style={{ backgroundImage: 'linear-gradient(#f0ece4 1px, transparent 1px), linear-gradient(90deg, #f0ece4 1px, transparent 1px)', backgroundSize: '60px 60px' }}
      />

      {/* Glow blob */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-[0.06] blur-[120px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, #c8f53a 0%, transparent 70%)' }}
      />

      <div className="relative z-10 max-w-5xl mx-auto w-full">
        {/* Badge */}
        <div className="hero-badge inline-flex items-center gap-2 mb-8">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#c8f53a] animate-pulse" />
          <span className="font-dm-mono text-xs text-[#c8f53a] tracking-widest uppercase">
            AI-powered fitness tracker
          </span>
        </div>

        {/* Title */}
        <h1 className="hero-title font-syne font-extrabold text-[clamp(3rem,8vw,7rem)] leading-[0.95] text-[#f0ece4] mb-6">
          Trening.<br />
          <span className="text-[#c8f53a]">Dane.</span><br />
          Wyniki.
        </h1>

        {/* Subtitle */}
        <p className="hero-sub font-dm-sans font-light text-[#555] text-lg md:text-xl max-w-xl mb-10 leading-relaxed">
          Jedno miejsce dla siłowni i biegania. AI analizuje Twoje dane, czyta screenshoty z Garmina i Stravy, i daje Ci konkretne wskazówki — nie ogólniki.
        </p>

        {/* Buttons */}
        <div className="hero-btns flex flex-wrap gap-4">
          <Link href="/dashboard"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#c8f53a] text-black font-syne font-bold text-sm tracking-wide hover:bg-[#d4ff4a] transition-colors">
            Zacznij za darmo
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M8 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <a href="#features"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-[#1e1e1e] text-[#f0ece4] font-dm-sans text-sm hover:border-[#333] transition-colors">
            Zobacz funkcje
          </a>
        </div>

        {/* Quick stats */}
        <div className="flex flex-wrap gap-8 mt-16 pt-8 border-t border-[#1e1e1e]">
          {[
            { value: '12 400', suffix: ' kg', label: 'Avg weekly volume' },
            { value: '4.8', suffix: '/5', label: 'AI accuracy score' },
            { value: '38', suffix: ' km', label: 'Avg weekly run' },
          ].map((s, i) => (
            <div key={i} className="hero-stats">
              <div className="font-syne font-bold text-2xl text-[#f0ece4]">
                {s.value}<span className="text-[#c8f53a]">{s.suffix}</span>
              </div>
              <div className="font-dm-mono text-[11px] text-[#555] uppercase tracking-widest mt-0.5">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
