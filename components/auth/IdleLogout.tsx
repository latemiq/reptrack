'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, useClerk } from '@clerk/nextjs'
import { useWorkoutStore } from '@/lib/stores/useWorkoutStore'

/** Sign out after this long without any interaction (also counts time while the app was closed). */
export const IDLE_MINUTES = 60

const KEY = 'reptrack:last-activity'
const CHECK_MS = 30_000
const WRITE_THROTTLE_MS = 15_000

const now = () => Date.now()

/**
 * Last activity is stored together with the Clerk session it belongs to. A timestamp
 * from an earlier session must never count against a fresh sign-in — otherwise
 * logging in after a long break signs the user straight back out.
 */
const readLast = (sessionId: string): number | null => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { sid?: string; t?: number } | null
    return raw?.sid === sessionId && typeof raw.t === 'number' ? raw.t : null
  } catch { return null }
}
const writeLast = (sessionId: string, t: number) => {
  try { localStorage.setItem(KEY, JSON.stringify({ sid: sessionId, t })) } catch { /* private mode — in-memory check still works */ }
}

/**
 * Automatic sign-out after IDLE_MINUTES of inactivity in the same session. Activity
 * is shared across tabs via localStorage, and the check also runs when the app comes
 * back to the foreground, so a phone app left open overnight starts at the login screen.
 * Never fires during a live workout (rest breaks are long and the log lives locally).
 */
export default function IdleLogout() {
  const router = useRouter()
  const { isSignedIn, sessionId } = useAuth()
  const { signOut } = useClerk()

  useEffect(() => {
    if (!isSignedIn || !sessionId) return
    let memoryLast = now()
    let lastWrite = 0
    let signingOut = false

    const last = () => Math.max(memoryLast, readLast(sessionId) ?? 0)

    const check = () => {
      if (signingOut) return
      if (useWorkoutStore.getState().activeWorkout) { memoryLast = now(); return }
      if (now() - last() > IDLE_MINUTES * 60_000) {
        signingOut = true
        try { localStorage.removeItem(KEY) } catch { /* ignore */ }
        signOut(() => router.replace('/auth?expired=1'))
      }
    }

    const activity = () => {
      memoryLast = now()
      if (memoryLast - lastWrite > WRITE_THROTTLE_MS) { writeLast(sessionId, memoryLast); lastWrite = memoryLast }
    }

    const onVisible = () => { if (document.visibilityState === 'visible') check() }

    // Same session reopened after a long idle period → sign out. A new session starts fresh.
    const stored = readLast(sessionId)
    if (stored && now() - stored > IDLE_MINUTES * 60_000) { memoryLast = stored; check() }
    else activity()

    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const
    events.forEach(e => window.addEventListener(e, activity, { passive: true, capture: true }))
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(check, CHECK_MS)
    return () => {
      events.forEach(e => window.removeEventListener(e, activity, { capture: true }))
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    }
  }, [isSignedIn, sessionId, signOut, router])

  return null
}
