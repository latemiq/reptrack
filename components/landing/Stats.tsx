'use client'
import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const STATS = [
  { value: 12400, suffix: ' kg', label: 'Avg weekly volume tracked', color: 'lime' },
  { value: 38, suffix: ' km', label: 'Average weekly running distance', color: 'orange' },
  { value: 5, suffix: 'x', label: 'Workouts logged per week', color: 'lime' },
  { value: 98, suffix: '%', label: 'Screenshot parsing accuracy', color: 'orange' },
]

export function Stats() {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    const counters = containerRef.current?.querySelectorAll<HTMLElement>('.counter-el')
    counters?.forEach((el, i) => {
      const target = STATS[i]
      const obj = { val: 0 }
      gsap.to(obj, {
        scrollTrigger: { trigger: el, start: 'top 80%' },
        val: target.value,
        duration: 1.4,
        ease: 'power3.out',
        onUpdate() {
          el.textContent = Math.round(obj.val).toLocaleString('pl') + target.suffix
        },
      })
    })

    gsap.from('.stat-block', {
      scrollTrigger: { trigger: containerRef.current, start: 'top 75%' },
      opacity: 0,
      y: 32,
      stagger: 0.1,
      duration: 0.6,
      ease: 'expo.out',
    })
  }, { scope: containerRef })

  return (
    <section ref={containerRef} className="px-6 md:px-16 lg:px-24 py-24 border-t border-[#1e1e1e]">
      <div className="max-w-5xl mx-auto">
        <div className="font-dm-mono text-[11px] text-[#555] uppercase tracking-widest mb-12">
          Numbers don't lie
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#1e1e1e]">
          {STATS.map((s, i) => (
            <div key={i} className="stat-block bg-[#0a0a0a] px-8 py-10">
              <div
                className={`counter-el font-syne font-extrabold text-4xl md:text-5xl mb-2 ${s.color === 'lime' ? 'text-[#c8f53a]' : 'text-[#f5a03a]'}`}
              >
                0{s.suffix}
              </div>
              <div className="font-dm-mono text-[11px] text-[#555] uppercase tracking-wider leading-relaxed">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
