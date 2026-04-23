'use client'
import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Link from 'next/link'

gsap.registerPlugin(ScrollTrigger)

export function CTA() {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    gsap.from('.cta-inner', {
      scrollTrigger: { trigger: containerRef.current, start: 'top 75%' },
      opacity: 0,
      y: 40,
      duration: 0.8,
      ease: 'expo.out',
    })
  }, { scope: containerRef })

  return (
    <section ref={containerRef} className="px-6 md:px-16 lg:px-24 py-32 border-t border-[#1e1e1e]">
      <div className="cta-inner max-w-3xl mx-auto text-center">
        <div className="font-dm-mono text-[11px] text-[#c8f53a] uppercase tracking-widest mb-6">
          Zacznij teraz
        </div>
        <h2 className="font-syne font-extrabold text-[clamp(2.5rem,6vw,5rem)] leading-[1] text-[#f0ece4] mb-6">
          Twoje dane.<br />
          <span className="text-[#c8f53a]">Twoje wyniki.</span>
        </h2>
        <p className="font-dm-sans text-[#555] text-lg mb-12 max-w-lg mx-auto leading-relaxed">
          Bez subskrypcji na start. Zaloguj się, zacznij logować treningi i pozwól AI zrobić resztę.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-[#c8f53a] text-black font-syne font-bold text-sm tracking-wide hover:bg-[#d4ff4a] transition-colors">
            Zacznij za darmo
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M8 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-24 pt-8 border-t border-[#1e1e1e] flex flex-wrap justify-between items-center gap-4">
        <div className="font-syne font-bold text-[#f0ece4] text-lg">RepTrack</div>
        <div className="font-dm-mono text-[11px] text-[#333] tracking-wider">
          © 2025 · Built with Claude AI · Next.js 14
        </div>
      </div>
    </section>
  )
}
