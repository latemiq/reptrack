'use client'

import { useEffect } from 'react'

/** Registers /sw.js in production builds (in dev it would fight with hot reload). */
export default function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(err => console.warn('SW registration failed', err))
  }, [])
  return null
}
