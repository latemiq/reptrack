'use client'

import { useEffect, useState } from 'react'

// Chrome/Android fires this before showing its own install UI; not in the TS DOM lib.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'reptrack:install-dismissed-at'
const DISMISS_DAYS = 14

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY))
    return at > 0 && Date.now() - at < DISMISS_DAYS * 86400000
  } catch {
    return false
  }
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent)

/**
 * Mobile banner: "Zainstaluj RepTrack". Android/Chrome gets the native install dialog,
 * iPhone (Safari has no install API) gets "Udostępnij → Do ekranu początkowego" steps.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [ios, setIos] = useState(false)
  const [visible, setVisible] = useState(false)
  const [showIosSteps, setShowIosSteps] = useState(false)

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return

    if (isIos()) {
      setIos(true)
      setVisible(true)
      return
    }
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    const onInstalled = () => setVisible(false)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* private mode — just hide */ }
    setVisible(false)
  }

  const install = async () => {
    if (ios) { setShowIosSteps(s => !s); return }
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    setDeferred(null)
    if (outcome === 'accepted') setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="lg:hidden mx-4 mt-3 rounded-2xl border border-[#c8f53a]/25 bg-[#c8f53a]/[0.06] p-3">
      <div className="flex items-center gap-3">
        <img src="/icons/192.png" alt="" className="w-10 h-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-[#f0ece4]">Zainstaluj RepTrack</div>
          <div className="text-[11px] text-[#888]">Szybki dostęp z ekranu głównego, pełny ekran.</div>
        </div>
        <button onClick={install}
          className="px-3 py-2 rounded-xl text-[10px] font-mono uppercase tracking-[1.2px] bg-[#c8f53a] text-[#080808] flex-shrink-0 cursor-pointer">
          {ios ? 'Jak?' : 'Instaluj'}
        </button>
        <button onClick={dismiss} aria-label="Nie teraz" className="w-7 h-7 text-[#666] hover:text-[#f0ece4] flex-shrink-0 cursor-pointer">×</button>
      </div>
      {showIosSteps && (
        <ol className="mt-3 space-y-1.5 text-[12px] text-[#ccc] list-decimal list-inside">
          <li>Otwórz tę stronę w <b>Safari</b>.</li>
          <li>Stuknij <b>Udostępnij</b> <span className="inline-block px-1 rounded bg-white/10">⬆︎</span> na dolnym pasku.</li>
          <li>Wybierz <b>Do ekranu początkowego</b>, a potem <b>Dodaj</b>.</li>
        </ol>
      )}
    </div>
  )
}
