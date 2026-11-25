'use client'

import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { ANDROID_APP } from '@/lib/android-app'

type Device = 'android' | 'ios' | 'desktop'

const mb = (bytes: number) => `${Math.round(bytes / 1048576)} MB`
const fmtDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
const pairs = (hex: string) => hex.toUpperCase().match(/.{2}/g)?.join(':') ?? hex

const STEPS = [
  { title: 'Pobierz plik', text: `RepTrack ${ANDROID_APP.version}, ${mb(ANDROID_APP.sizeBytes)}.` },
  { title: 'Otwórz go', text: 'Android zapyta o zgodę na instalację z przeglądarki. Zezwól. To jednorazowe.' },
  { title: 'Zaloguj się', text: 'Tym samym kontem co na stronie. Treningi i plan od trenera już tam są.' },
]

/** Android app download: a button on phones, a QR code on computers, an honest note on iPhones. */
export function AndroidDownload({ standalone = false }: { standalone?: boolean }) {
  const [device, setDevice] = useState<Device>('desktop')
  const [pageUrl, setPageUrl] = useState('')

  useEffect(() => {
    const ua = navigator.userAgent
    setDevice(/Android/i.test(ua) ? 'android' : /iPhone|iPad|iPod/i.test(ua) ? 'ios' : 'desktop')
    setPageUrl(`${window.location.origin}/android`)
  }, [])

  const download = `${ANDROID_APP.url}?download=${encodeURIComponent(ANDROID_APP.fileName)}`

  return (
    <section id="android" aria-labelledby="android-title" className={`px-6 md:px-16 lg:px-24 ${standalone ? 'pt-28 pb-16' : 'py-24 border-t border-[#1e1e1e]'}`}>
      <div className="max-w-5xl mx-auto grid md:grid-cols-[1.2fr_1fr] gap-10 md:gap-16 items-start">
        <div>
          <div className="font-dm-mono text-[11px] text-[#c8f53a] uppercase tracking-widest mb-5">Aplikacja na Androida</div>
          <h2 id="android-title" className="font-syne font-extrabold text-[clamp(2rem,5vw,3.5rem)] leading-[1] text-[#f0ece4] mb-5">
            Trening w kieszeni.
          </h2>
          <p className="font-dm-sans text-[#a3a3a3] text-base md:text-lg leading-relaxed mb-8 max-w-lg">
            Ta sama aplikacja, której używasz na siłowni: przerwy z wibracją, superserie, mapa mięśni i plan od trenera.
            Nowości przychodzą same, bez ponownego pobierania.
          </p>

          <div className="flex flex-wrap items-center gap-4 mb-3">
            <a href={download} download={ANDROID_APP.fileName}
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-[#c8f53a] text-black font-syne font-bold text-sm tracking-wide hover:bg-[#d4ff4a] transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
              </svg>
              Pobierz na Androida
            </a>
            <span className="font-dm-mono text-xs text-[#a3a3a3]">
              {mb(ANDROID_APP.sizeBytes)} · Android {ANDROID_APP.minAndroid}+ · wersja {ANDROID_APP.version}
            </span>
          </div>

          {device === 'ios' && (
            <p role="note" className="mt-4 rounded-xl border border-[#f5a03a]/25 bg-[#f5a03a]/[0.06] px-4 py-3 text-sm text-[#f5a03a] max-w-lg">
              Na iPhone’a aplikacji jeszcze nie ma. Możesz dodać stronę do ekranu głównego: Udostępnij → Do ekranu początkowego.
            </p>
          )}

          <ol className="mt-10 space-y-5 max-w-lg">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full border border-[#c8f53a]/40 text-[#c8f53a] font-dm-mono text-sm flex items-center justify-center">{i + 1}</span>
                <div>
                  <div className="font-dm-sans text-[#f0ece4] font-medium">{s.title}</div>
                  <div className="font-dm-sans text-sm text-[#a3a3a3] leading-relaxed">{s.text}</div>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-[#a3a3a3] max-w-lg">
            Masz starszą wersję i instalacja się nie udaje? Odinstaluj RepTrack i zainstaluj ponownie. Treningi są zapisane na koncie.
          </p>
        </div>

        <div className="space-y-4">
          {device === 'desktop' && pageUrl && (
            <div className="rounded-2xl border border-[#1e1e1e] bg-[#0f0f0f] p-6 flex flex-col items-center text-center">
              <div className="rounded-xl bg-[#f0ece4] p-3">
                <QRCodeSVG value={pageUrl} size={168} bgColor="#f0ece4" fgColor="#080808" level="M" title="Kod QR do strony pobierania aplikacji" />
              </div>
              <p className="mt-4 font-dm-sans text-sm text-[#a3a3a3]">Zeskanuj aparatem telefonu, żeby pobrać aplikację.</p>
            </div>
          )}
          <details className="rounded-2xl border border-[#1e1e1e] bg-[#0f0f0f] p-5">
            <summary className="cursor-pointer font-dm-sans text-sm text-[#a3a3a3]">Jak sprawdzić, że plik jest oryginalny</summary>
            <div className="mt-3 space-y-3 text-xs text-[#a3a3a3] leading-relaxed">
              <p>Wydano {fmtDate(ANDROID_APP.publishedAt)}. Suma SHA-256 pliku:</p>
              <code className="block break-all font-dm-mono text-[11px] text-[#f0ece4]">{ANDROID_APP.sha256}</code>
              <p>Odcisk certyfikatu, którym podpisana jest aplikacja (każda kolejna wersja musi go mieć):</p>
              <code className="block break-all font-dm-mono text-[11px] text-[#f0ece4]">{pairs(ANDROID_APP.certSha256)}</code>
            </div>
          </details>
        </div>
      </div>
    </section>
  )
}
