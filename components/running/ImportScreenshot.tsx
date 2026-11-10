'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface ParsedRun {
  distance_km: number | null
  duration_seconds: number | null
  avg_pace_seconds_per_km: number | null
  avg_hr: number | null
  max_hr: number | null
  elevation_gain_m: number | null
  calories: number | null
  date: string | null
  source_app: 'garmin' | 'strava' | 'apple_fitness' | 'other' | null
}

type Stage = 'upload' | 'parsing' | 'review' | 'saving' | 'done' | 'error'
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const fmtDuration = (s: number | null): string => {
  if (s == null) return ''
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

const parseDuration = (str: string): number | null => {
  const parts = str.split(':').map(Number)
  if (parts.some(isNaN)) return null
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return null
}

const fmtPace = (s: number | null): string => {
  if (s == null) return ''
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function ImportScreenshot() {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef  = useRef<HTMLDivElement>(null)

  const [stage, setStage]   = useState<Stage>('upload')
  const [error, setError]   = useState<string>('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imageMime, setImageMime] = useState<string>('image/jpeg')
  const [parsed, setParsed] = useState<ParsedRun | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  useGSAP(() => {
    gsap.from('.import-stage > *', {
      opacity: 0, y: 14, duration: 0.5, stagger: 0.08, ease: 'expo.out', delay: 0.05
    })
  }, { scope: containerRef, dependencies: [stage] })

  // ── FILE HANDLERS ─────────────────────────────────────────────────────────
  const handleFile = async (file: File) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('Wybierz plik graficzny (JPG, PNG, WebP lub GIF)')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Plik jest za duży (max 10 MB)')
      return
    }
    setError('')

    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string
      setImageUrl(dataUrl)
      const base64 = dataUrl.split(',')[1]
      setImageBase64(base64)
      setImageMime(file.type)
      await runParse(base64, file.type)
    }
    reader.readAsDataURL(file)
  }

  const runParse = async (base64: string, mimeType: string) => {
    setStage('parsing')
    setError('')
    try {
      const res = await fetch('/api/running/parse-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error ?? `Błąd parsowania (${res.status})`)
      }
      const { data } = await res.json()
      setParsed(data)
      setStage('review')
    } catch (e) {
      console.error('Parse error:', e)
      setError(e instanceof Error ? e.message : 'Nieznany błąd')
      setStage('error')
    }
  }

  const handleSave = async () => {
    if (!parsed || !imageBase64) return
    setStage('saving')
    try {
      const res = await fetch('/api/running', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...parsed,
          source: parsed.source_app ? `${parsed.source_app}_screenshot` : 'manual',
          screenshot_base64: imageBase64,
          screenshot_mime: imageMime,
        }),
      })
      if (!res.ok) throw new Error(`Zapis nie powiódł się (${res.status})`)
      const { id } = await res.json()
      setStage('done')
      setTimeout(() => router.push(`/running/${id}`), 800)
    } catch (e) {
      console.error('Save error:', e)
      setError(e instanceof Error ? e.message : 'Błąd zapisu')
      setStage('error')
    }
  }

  // ── DROP HANDLERS ─────────────────────────────────────────────────────────
  useEffect(() => {
    const el = dropZoneRef.current
    if (!el) return
    const onEnter = (e: DragEvent) => { e.preventDefault(); setIsDragging(true) }
    const onLeave = (e: DragEvent) => { e.preventDefault(); setIsDragging(false) }
    const onOver  = (e: DragEvent) => { e.preventDefault() }
    const onDrop  = (e: DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer?.files?.[0]
      if (file) handleFile(file)
    }
    el.addEventListener('dragenter', onEnter)
    el.addEventListener('dragleave', onLeave)
    el.addEventListener('dragover', onOver)
    el.addEventListener('drop', onDrop)
    return () => {
      el.removeEventListener('dragenter', onEnter)
      el.removeEventListener('dragleave', onLeave)
      el.removeEventListener('dragover', onOver)
      el.removeEventListener('drop', onDrop)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reset = () => {
    setStage('upload')
    setError('')
    setImageUrl(null)
    setImageBase64(null)
    setParsed(null)
  }

  const canSave = parsed != null
    && parsed.distance_km != null
    && parsed.distance_km > 0
    && parsed.duration_seconds != null
    && parsed.duration_seconds > 0

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className="flex h-screen bg-[#080808] text-[#f0ece4] font-sans overflow-hidden">
      <main className="flex-1 overflow-y-auto px-4 md:px-7 py-5 md:py-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* HEADER */}
        <div className="mb-6 flex justify-between items-end">
          <div>
            <p className="text-[10px] font-mono text-[#444] uppercase tracking-[2px] mb-1">Bieganie · Import</p>
            <h1 className="font-display text-[24px] font-black">
              Wrzuć <em className="not-italic text-[#f5a03a]">zrzut ekranu</em>
            </h1>
            <p className="text-[12px] text-[#666] mt-1">AI odczyta dystans, tempo, tętno i resztę danych</p>
          </div>
          <button onClick={() => router.push('/running')}
            className="px-3.5 py-2 rounded-lg bg-[#111] border border-[#1e1e1e] text-[#888] text-[11px] font-mono uppercase tracking-[1.2px] hover:border-[#333] hover:text-[#ccc] transition-all cursor-none">
            ← Wróć
          </button>
        </div>

        <div className="max-w-3xl">

          {/* STAGE: UPLOAD */}
          {stage === 'upload' && (
            <div className="import-stage">
              <div ref={dropZoneRef}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-6 md:p-12 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-[#f5a03a] bg-[#f5a03a]/[0.06]'
                    : 'border-[#1e1e1e] hover:border-[#f5a03a]/40 hover:bg-[#f5a03a]/[0.02]'
                }`}
              >
                <input ref={fileInputRef} type="file" accept={ALLOWED_IMAGE_TYPES.join(',')} hidden
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

                <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-all ${
                  isDragging
                    ? 'bg-[#f5a03a]/15 border border-[#f5a03a]/40'
                    : 'bg-[#111] border border-[#1e1e1e]'
                }`}>
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path d="M14 18V6M9 11l5-5 5 5" stroke={isDragging ? '#f5a03a' : '#666'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M5 21h18" stroke={isDragging ? '#f5a03a' : '#666'} strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </div>

                <div className="font-display text-[18px] font-black mb-2">
                  {isDragging ? 'Upuść zrzut ekranu tutaj' : 'Przeciągnij zrzut ekranu lub kliknij'}
                </div>
                <p className="text-[12px] text-[#666] mb-4">
                  Garmin Connect · Strava · Apple Fitness · inne aplikacje
                </p>
                <div className="inline-flex gap-1.5 text-[9px] font-mono text-[#444] uppercase tracking-[1.2px]">
                  <span className="px-2 py-1 rounded bg-white/[0.03] border border-white/[0.06]">JPG</span>
                  <span className="px-2 py-1 rounded bg-white/[0.03] border border-white/[0.06]">PNG</span>
                  <span className="px-2 py-1 rounded bg-white/[0.03] border border-white/[0.06]">WebP</span>
                  <span className="px-2 py-1 rounded bg-white/[0.03] border border-white/[0.06]">do 10MB</span>
                </div>
              </div>

              {error && (
                <div className="mt-3 text-[12px] text-red-400 text-center">{error}</div>
              )}

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { icon: '⚡', title: 'Auto-detekcja', sub: 'Rozpoznaje typ aplikacji' },
                  { icon: '✏', title: 'Edytowalne', sub: 'Skoryguj jeśli AI się pomyli' },
                  { icon: '🔒', title: 'Prywatność', sub: 'Tylko Twoje dane' },
                ].map(({ icon, title, sub }) => (
                  <div key={title} className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-3.5">
                    <div className="text-[18px] mb-1.5">{icon}</div>
                    <div className="text-[12px] font-medium text-[#ccc] mb-0.5">{title}</div>
                    <div className="text-[10px] font-mono text-[#555]">{sub}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STAGE: PARSING */}
          {stage === 'parsing' && (
            <div className="import-stage">
              <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4 bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-5">
                {imageUrl && (
                  <div className="relative aspect-[9/16] rounded-xl overflow-hidden bg-[#0a0a0a] border border-[#161616]">
                    <Image src={imageUrl} alt="Zrzut ekranu" fill sizes="200px" unoptimized className="object-cover" />
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#f5a03a] to-transparent animate-[importScan_2s_ease-in-out_infinite]" />
                    </div>
                  </div>
                )}
                <div className="flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex gap-1">
                      {[0,1,2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#f5a03a] animate-typing"
                          style={{ animationDelay: `${i*0.2}s` }} />
                      ))}
                    </div>
                    <span className="text-[10px] font-mono text-[#f5a03a] uppercase tracking-[1.5px]">AI analizuje</span>
                  </div>
                  <div className="font-display text-[20px] font-black mb-2">
                    Czytam <em className="not-italic text-[#f5a03a]">zrzut ekranu</em>...
                  </div>
                  <p className="text-[12px] text-[#666] leading-relaxed">
                    Rozpoznaję typ aplikacji, wyciągam dystans, tempo, tętno i czas. To zwykle trwa 3-5 sekund.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STAGE: REVIEW */}
          {stage === 'review' && parsed && (
            <div className="import-stage space-y-4">
              <div className="bg-[#c8f53a]/[0.06] border border-[#c8f53a]/20 rounded-xl p-3.5 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-[#c8f53a]/15 flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7l3 3 5-5" stroke="#c8f53a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-[12px] text-[#f0ece4] font-medium">Odczytałem dane</div>
                  <div className="text-[10px] font-mono text-[#666]">
                    źródło: {parsed.source_app ?? 'rozpoznane'} · Sprawdź i popraw jeśli trzeba
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4">
                {imageUrl && (
                  <div className="relative aspect-[9/16] rounded-xl overflow-hidden bg-[#0a0a0a] border border-[#161616]">
                    <Image src={imageUrl} alt="Zrzut ekranu" fill sizes="180px" unoptimized className="object-cover" />
                  </div>
                )}

                <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-5">
                  <div className="text-[10px] font-mono text-[#444] uppercase tracking-[1.5px] mb-3">Odczytane dane</div>

                  <div className="grid grid-cols-2 gap-3">
                    <FieldEdit label="Dystans" unit="km" value={parsed.distance_km?.toFixed(2) ?? ''}
                      onChange={v => setParsed({ ...parsed, distance_km: v === '' ? null : Number(v) })} />
                    <FieldEdit label="Czas" unit="" placeholder="h:mm:ss"
                      value={fmtDuration(parsed.duration_seconds)}
                      onChange={v => setParsed({ ...parsed, duration_seconds: parseDuration(v) })}
                      isText />
                    <FieldEdit label="Średnie tempo" unit="/km" placeholder="m:ss"
                      value={fmtPace(parsed.avg_pace_seconds_per_km)}
                      onChange={v => setParsed({ ...parsed, avg_pace_seconds_per_km: parseDuration(v) })}
                      isText />
                    <FieldEdit label="Średnie tętno" unit="bpm"
                      value={parsed.avg_hr?.toString() ?? ''}
                      onChange={v => setParsed({ ...parsed, avg_hr: v === '' ? null : Number(v) })} />
                    <FieldEdit label="Max tętno" unit="bpm"
                      value={parsed.max_hr?.toString() ?? ''}
                      onChange={v => setParsed({ ...parsed, max_hr: v === '' ? null : Number(v) })} />
                    <FieldEdit label="Przewyższenie" unit="m"
                      value={parsed.elevation_gain_m?.toString() ?? ''}
                      onChange={v => setParsed({ ...parsed, elevation_gain_m: v === '' ? null : Number(v) })} />
                    <FieldEdit label="Kalorie" unit="kcal"
                      value={parsed.calories?.toString() ?? ''}
                      onChange={v => setParsed({ ...parsed, calories: v === '' ? null : Number(v) })} />
                    <FieldEdit label="Data" unit="" placeholder="YYYY-MM-DD"
                      value={parsed.date ?? ''}
                      onChange={v => setParsed({ ...parsed, date: v || null })}
                      isText />
                  </div>

                  <div className="flex gap-2 mt-5">
                    <button onClick={reset}
                      className="flex-1 py-2.5 rounded-lg bg-[#111] border border-[#1e1e1e] text-[#888] text-[11px] font-mono uppercase tracking-[1.3px] hover:border-[#333] hover:text-[#ccc] transition-all cursor-none">
                      Inny zrzut ekranu
                    </button>
                    <button onClick={handleSave} disabled={!canSave}
                      className="flex-[2] py-2.5 rounded-lg bg-[#f5a03a] text-[#080808] text-[11px] font-mono uppercase tracking-[1.3px] font-medium hover:bg-[#ffb04a] hover:-translate-y-px active:scale-[0.98] transition-all cursor-none disabled:opacity-40 disabled:hover:translate-y-0">
                      Zapisz bieg →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STAGE: SAVING */}
          {stage === 'saving' && (
            <div className="import-stage bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-8 text-center">
              <div className="flex justify-center gap-1 mb-4">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-[#f5a03a] animate-typing"
                    style={{ animationDelay: `${i*0.2}s` }} />
                ))}
              </div>
              <div className="font-display text-[18px] font-black mb-1">Zapisuję bieg...</div>
              <p className="text-[12px] text-[#666]">Synchronizuję dane z bazą</p>
            </div>
          )}

          {/* STAGE: DONE */}
          {stage === 'done' && (
            <div className="import-stage bg-[#0f0f0f] border border-[#c8f53a]/30 rounded-2xl p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-[#c8f53a]/15 border border-[#c8f53a]/40 mx-auto mb-4 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12l4 4 10-10" stroke="#c8f53a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="font-display text-[20px] font-black mb-1">
                Bieg <em className="not-italic text-[#c8f53a]">zapisany</em>!
              </div>
              <p className="text-[12px] text-[#666]">Za chwilę otworzę szczegóły...</p>
            </div>
          )}

          {/* STAGE: ERROR */}
          {stage === 'error' && (
            <div className="import-stage bg-red-500/[0.05] border border-red-500/20 rounded-2xl p-5">
              <div className="text-[13px] text-red-400 font-medium mb-1">Coś poszło nie tak</div>
              <p className="text-[12px] text-red-400/70 mb-4">{error}</p>
              <button onClick={reset}
                className="px-4 py-2 rounded-lg bg-[#111] border border-[#1e1e1e] text-[#888] text-[11px] font-mono uppercase tracking-[1.3px] hover:border-[#333] hover:text-[#ccc] transition-all cursor-none">
                Spróbuj ponownie
              </button>
            </div>
          )}
        </div>
      </main>

      <style>{`
        @keyframes importScan {
          0%   { top: 0;    opacity: 1 }
          50%  { top: 100%; opacity: 1 }
          51%  { top: 100%; opacity: 0 }
          51.5%{ top: 0;    opacity: 0 }
          52%  { top: 0;    opacity: 1 }
          100% { top: 100%; opacity: 1 }
        }
      `}</style>
    </div>
  )
}

function FieldEdit({
  label, unit, value, onChange, placeholder, isText = false,
}: {
  label: string; unit: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  isText?: boolean
}) {
  return (
    <div>
      <label className="block text-[9px] font-mono text-[#444] uppercase tracking-[1.5px] mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={isText ? 'text' : 'number'}
          inputMode={isText ? 'text' : 'decimal'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? '—'}
          className="w-full bg-[#0a0a0a] border border-[#1e1e1e] focus:border-[#f5a03a]/40 rounded-lg px-3 py-2 pr-10 text-[13px] text-[#f0ece4] placeholder:text-[#333] outline-none transition-colors font-mono"
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono text-[#444]">{unit}</span>
        )}
      </div>
    </div>
  )
}
