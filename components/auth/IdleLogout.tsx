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
const readLast = () => {
  try { return Number(localStorage.getItem(KEY)) || null } catch { return null }
}
const writeLast = (t: number) => {
  try { localStorage.setItem(KEY, String(t)) } catch { /* private mode — in-memory check still works */ }
}

/**
 * Automatic sign-out after IDLE_MINUTES of inactivity. Activity is shared across
 * tabs via localStorage, and the check also runs when the app comes back to the
 * foreground, so a phone app reopened the next day starts at the login screen.
 * Never fires during a live workout (rest breaks are long and the log lives locally).
 */
export default function IdleLogout() {
  const router = useRouter()
  const { isSignedIn } = useAuth()
  const { signOut } = useClerk()

  useEffect(() => {
    if (!isSignedIn) return
    let memoryLast = now()
    let lastWrite = 0
    let signingOut = false

    const last = () => Math.max(memoryLast, readLast() ?? 0)

    const check = () => {
      if (signingOut) return
      if (useWorkoutStore.getState().activeWorkout) { memoryLast = now(); return }
      if (now() - last() > IDLE_MINUTES * 60_000) {
        signingOut = true
        writeLast(0)
        signOut(() => router.replace('/auth?expired=1'))
      }
    }

    const activity = () => {
      memoryLast = now()
      if (memoryLast - lastWrite > WRITE_THROTTLE_MS) { writeLast(memoryLast); lastWrite = memoryLast }
    }

    const onVisible = () => { if (document.visibilityState === 'visible') check() }

    // A stale timestamp from a previous visit means the session sat idle — check before counting this load as activity.
    const stored = readLast()
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
  }, [isSignedIn, signOut, router])

  return null
}
