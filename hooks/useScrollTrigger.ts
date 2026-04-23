'use client'
import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

interface UseScrollTriggerOptions {
  trigger?: string | Element | null
  start?: string
  end?: string
  onEnter?: () => void
  onLeave?: () => void
  pin?: boolean | string | Element
  scrub?: boolean | number
}

export function useScrollTrigger(options: UseScrollTriggerOptions) {
  const instanceRef = useRef<ScrollTrigger | null>(null)

  useEffect(() => {
    instanceRef.current = ScrollTrigger.create({
      trigger: options.trigger ?? undefined,
      start: options.start ?? 'top 80%',
      end: options.end,
      pin: options.pin,
      scrub: options.scrub,
      onEnter: options.onEnter,
      onLeave: options.onLeave,
    })

    return () => {
      instanceRef.current?.kill()
    }
  }, [])

  return instanceRef
}
