'use client'
import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'

const ITEMS = [
  'Siłownia', '·', 'Bieganie', '·', 'AI Coach', '·', 'Garmin', '·', 'Strava',
  '·', 'Progresja', '·', 'Analiza', '·', 'Screenshoty', '·', 'Dashboard', '·',
]

export function Marquee() {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    gsap.to('.marquee-track', {
      xPercent: -50,
      duration: 18,
      ease: 'none',
      repeat: -1,
    })
  }, { scope: containerRef })

  const doubled = [...ITEMS, ...ITEMS]

  return (
    <div ref={containerRef} className="relative overflow-hidden py-5 border-y border-[#1e1e1e]">
      <div className="marquee-track flex whitespace-nowrap will-change-transform">
        {doubled.map((item, i) => (
          <span key={i} className={`px-5 font-dm-mono text-sm tracking-wider ${item === '·' ? 'text-[#c8f53a]' : 'text-[#333]'}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
