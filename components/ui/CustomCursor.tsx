'use client'
import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const dot = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return

    let mouseX = 0
    let mouseY = 0
    let ringX = 0
    let ringY = 0

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY
      gsap.to(dot, { x: mouseX, y: mouseY, duration: 0.1, ease: 'power2.out' })
    }

    const lerp = () => {
      ringX += (mouseX - ringX) * 0.12
      ringY += (mouseY - ringY) * 0.12
      gsap.set(ring, { x: ringX, y: ringY })
      requestAnimationFrame(lerp)
    }
    const rafId = requestAnimationFrame(lerp)

    const onEnterLink = () => {
      gsap.to(ring, { scale: 1.6, borderColor: '#c8f53a', duration: 0.3, ease: 'expo.out' })
      gsap.to(dot, { scale: 0.5, duration: 0.3 })
    }
    const onLeaveLink = () => {
      gsap.to(ring, { scale: 1, borderColor: 'rgba(200,245,58,0.4)', duration: 0.3, ease: 'expo.out' })
      gsap.to(dot, { scale: 1, duration: 0.3 })
    }

    document.addEventListener('mousemove', onMove)
    document.querySelectorAll('a, button, [role="button"]').forEach((el) => {
      el.addEventListener('mouseenter', onEnterLink)
      el.addEventListener('mouseleave', onLeaveLink)
    })

    return () => {
      document.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(rafId)
    }
  }, [])

  return (
    <>
      {/* Dot */}
      <div
        ref={dotRef}
        className="fixed top-0 left-0 z-[9999] pointer-events-none"
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: '#c8f53a',
          transform: 'translate(-50%, -50%)',
          willChange: 'transform',
        }}
      />
      {/* Ring */}
      <div
        ref={ringRef}
        className="fixed top-0 left-0 z-[9998] pointer-events-none"
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '1.5px solid rgba(200,245,58,0.4)',
          transform: 'translate(-50%, -50%)',
          willChange: 'transform',
        }}
      />
    </>
  )
}
