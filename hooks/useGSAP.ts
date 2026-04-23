'use client'
import { useGSAP as useGSAPBase } from '@gsap/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useRef } from 'react'

gsap.registerPlugin(ScrollTrigger)

export { useGSAPBase as useGSAP }

export function useGSAPContext<T extends HTMLElement = HTMLDivElement>() {
  const containerRef = useRef<T>(null)
  return { containerRef }
}
