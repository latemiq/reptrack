import { Hero } from '@/components/landing/Hero'
import { Marquee } from '@/components/landing/Marquee'
import { PinnedFeatures } from '@/components/landing/PinnedFeatures'
import { Stats } from '@/components/landing/Stats'
import { CTA } from '@/components/landing/CTA'
import Link from 'next/link'
import { redirect } from 'next/navigation'

const AUTH_BYPASS = process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true'

export default function LandingPage() {
  if (AUTH_BYPASS) {
    redirect('/dashboard')
  }

  return (
    <>
      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-16 py-5 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-[#1e1e1e]">
        <div className="font-syne font-extrabold text-[#f0ece4] text-lg tracking-tight">
          Rep<span className="text-[#c8f53a]">Track</span>
        </div>
        <nav className="hidden md:flex items-center gap-8">
          {['Funkcje', 'Dashboard', 'AI Coach'].map((item) => (
            <a key={item} href={item === 'Funkcje' ? '#features' : `/${item.toLowerCase().replace(' ', '-')}`}
              className="font-dm-sans text-sm text-[#555] hover:text-[#f0ece4] transition-colors">
              {item}
            </a>
          ))}
        </nav>
        <Link href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#c8f53a] text-black font-syne font-bold text-xs tracking-wide hover:bg-[#d4ff4a] transition-colors">
          Zacznij
        </Link>
      </header>

      <main>
        <Hero />
        <Marquee />
        <PinnedFeatures />
        <Stats />
        <CTA />
      </main>
    </>
  )
}
