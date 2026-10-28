'use client'

import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

/**
 * Join link encoded in the QR. NEXT_PUBLIC_APP_URL lets a trainer on localhost
 * point phones at a LAN address or the deployed app instead.
 */
export function inviteUrl(code: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base.replace(/\/$/, '')}/join/${code}`
}

export default function InviteQrModal({ code, expiresAt, onClose }: { code: string; expiresAt: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const url = inviteUrl(code)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const copy = async () => {
    await navigator.clipboard?.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div role="dialog" aria-label="Kod QR zaproszenia"
        className="relative w-full max-w-sm bg-[#0f0f0f] border border-[#1e1e1e] rounded-3xl p-6 text-center">
        <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-lg text-[#666] hover:text-[#f0ece4] cursor-pointer" aria-label="Zamknij">×</button>
        <p className="text-[10px] font-mono uppercase tracking-[2px] text-[#444] mb-1">Zaproszenie</p>
        <h2 className="font-display text-[20px] font-black mb-4">Zeskanuj <em className="not-italic text-[#c8f53a]">telefonem</em></h2>

        <div className="bg-white rounded-2xl p-4 inline-block">
          <QRCodeSVG value={url} size={232} level="M" marginSize={0} />
        </div>

        <div className="mt-4 font-mono text-[26px] tracking-[6px] text-[#f0ece4]">{code}</div>
        <p className="text-[11px] text-[#666] mt-1">
          Podopieczny skanuje kod aparatem, zakłada konto i wypełnia ankietę.
          Kod jest jednorazowy, ważny do {new Date(expiresAt).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}.
        </p>

        <button onClick={copy}
          className="mt-4 w-full py-2.5 rounded-xl text-[11px] font-mono uppercase tracking-[1.3px] border border-[#c8f53a]/30 text-[#c8f53a] hover:bg-[#c8f53a]/10 cursor-pointer">
          {copied ? 'Skopiowano link' : 'Kopiuj link zaproszenia'}
        </button>
        {/^https?:\/\/(localhost|127\.0\.0\.1)/.test(url) && (
          <p className="mt-3 text-[10px] text-[#f5a03a]">
            Link wskazuje na localhost — telefon go nie otworzy. Ustaw NEXT_PUBLIC_APP_URL na adres w sieci lokalnej lub wdrożoną aplikację.
          </p>
        )}
      </div>
    </div>
  )
}
