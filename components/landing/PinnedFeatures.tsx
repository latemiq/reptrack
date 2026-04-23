'use client'
import { useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { PhoneFrame } from '@/components/ui/PhoneFrame'

gsap.registerPlugin(ScrollTrigger)

const FEATURES = [
  {
    num: '01',
    title: ['Wszystko', 'w jednym', 'miejscu'],
    desc: 'Dashboard łączy dane z siłowni i biegania. Widzisz tygodniowy wolumen, dystans, wagę i progresję w jednym widoku — bez przełączania między aplikacjami.',
    tags: ['Dashboard', 'Tygodniowy przegląd', 'Progresja'],
  },
  {
    num: '02',
    title: ['Własna baza', 'ćwiczeń', 'i serie'],
    desc: 'Dodaj własne ćwiczenia, grupuj po partiach, loguj serie z wagą, powtórzeniami i RPE. Historia każdego ćwiczenia w jednym miejscu.',
    tags: ['Siłownia', 'Własne ćwiczenia', 'RPE', 'Progresja'],
  },
  {
    num: '03',
    title: ['Screenshot', '→ dane', 'automatycznie'],
    desc: 'Zrób screenshot z Garmin Connect, Stravy lub Apple Fitness i wgraj go. AI odczyta dystans, tempo, tętno i datę — bez ręcznego wpisywania.',
    tags: ['Garmin', 'Strava', 'Claude Vision', 'AI'],
  },
  {
    num: '04',
    title: ['AI Coach', 'który naprawdę', 'rozumie'],
    desc: 'Co tydzień AI analizuje Twoje dane — identyfikuje plateau, śledzi zmęczenie i daje jedną konkretną rekomendację. Żadnych ogólników.',
    tags: ['Claude AI', 'Tygodniowy raport', 'Personalizacja'],
  },
]

export function PinnedFeatures() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  useGSAP(() => {
    const mm = gsap.matchMedia()

    mm.add('(min-width: 1024px)', () => {
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top top',
        end: 'bottom bottom',
        pin: stickyRef.current,
        scrub: true,
        onUpdate: (self) => {
          setActiveIdx(Math.min(3, Math.floor(self.progress * 4)))
        },
      })
    })

    mm.add('(max-width: 1023px)', () => {
      gsap.utils.toArray<HTMLElement>('.feature-block-mobile').forEach((el) => {
        gsap.from(el, {
          scrollTrigger: { trigger: el, start: 'top 85%' },
          opacity: 0,
          y: 28,
          duration: 0.55,
          ease: 'expo.out',
        })
      })
    })
  }, { scope: sectionRef })

  return (
    <section id="features" ref={sectionRef} className="relative">
      {/* Desktop: pinned layout */}
      <div className="hidden lg:flex" style={{ minHeight: `${FEATURES.length * 100}vh` }}>
        {/* Sticky phone side */}
        <div ref={stickyRef} className="w-1/2 h-screen flex items-center justify-center">
          <div className="relative">
            <div className="absolute -inset-20 rounded-full opacity-5 blur-3xl"
              style={{ background: 'radial-gradient(#c8f53a, transparent)' }}
            />
            <PhoneFrame activePane={activeIdx} />
          </div>
        </div>

        {/* Scrolling features */}
        <div className="w-1/2 py-[15vh] px-16 xl:px-24">
          {FEATURES.map((f, i) => (
            <div key={i}
              className="min-h-screen flex flex-col justify-center py-16 transition-opacity duration-500"
              style={{ opacity: i === activeIdx ? 1 : i < activeIdx ? 0.12 : 0.25 }}
            >
              <FeatureContent feature={f} />
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: stacked */}
      <div className="lg:hidden px-6 py-16 flex flex-col gap-20">
        {FEATURES.map((f, i) => (
          <div key={i} className="feature-block-mobile flex flex-col gap-8">
            <div className="flex justify-center">
              <PhoneFrame activePane={i} />
            </div>
            <FeatureContent feature={f} />
          </div>
        ))}
      </div>
    </section>
  )
}

function FeatureContent({ feature }: { feature: typeof FEATURES[0] }) {
  return (
    <div className="feature-block">
      <div className="font-dm-mono text-[#c8f53a] text-xs tracking-widest mb-6">{feature.num}</div>
      <h2 className="font-syne font-extrabold text-[clamp(2.5rem,4vw,3.5rem)] leading-[1] text-[#f0ece4] mb-6">
        {feature.title.map((line, i) => (
          <span key={i} className="block">{line}</span>
        ))}
      </h2>
      <p className="font-dm-sans text-[#555] text-base leading-relaxed mb-8 max-w-sm">
        {feature.desc}
      </p>
      <div className="flex flex-wrap gap-2">
        {feature.tags.map((tag) => (
          <span key={tag} className="font-dm-mono text-[10px] text-[#333] border border-[#1e1e1e] px-3 py-1.5 rounded-full tracking-wider uppercase">
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}
