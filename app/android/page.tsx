import Link from 'next/link'
import { AndroidDownload } from '@/components/landing/AndroidDownload'

export const metadata = {
  title: 'RepTrack — aplikacja na Androida',
  description: 'Pobierz aplikację RepTrack na telefon z Androidem.',
}

/** Download page; the QR code on the home page points here. */
export default function AndroidPage() {
  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-16 py-5 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-[#1e1e1e]">
        <Link href="/" className="font-syne font-extrabold text-[#f0ece4] text-lg tracking-tight">
          Rep<span className="text-[#c8f53a]">Track</span>
        </Link>
        <Link href="/auth" className="font-dm-sans text-sm text-[#a3a3a3] hover:text-[#f0ece4]">Zaloguj się na stronie</Link>
      </header>
      <main className="min-h-screen bg-[#080808]">
        <AndroidDownload standalone />
      </main>
    </>
  )
}
