import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0a0a0a',
          surface: '#0f0f0f',
          card: '#141414',
        },
        accent: {
          lime: '#c8f53a',
          orange: '#f5a03a',
        },
        text: {
          primary: '#f0ece4',
          muted: '#555555',
        },
        border: '#1e1e1e',
      },
      fontFamily: {
        display: ['var(--font-syne)', 'sans-serif'],
        mono: ['var(--font-dm-mono)', 'monospace'],
        sans: ['var(--font-dm-sans)', 'sans-serif'],
      },
      keyframes: {
        gridMove: { to: { backgroundPosition: '48px 48px' } },
        scan: {
          '0%,100%': { top: '-2px', opacity: '0' },
          '5%': { opacity: '1' },
          '95%': { opacity: '1' },
          '99%': { top: '100%', opacity: '0' },
        },
        float: {
          '0%': { transform: 'translateY(0)', opacity: '0.3' },
          '100%': { transform: 'translateY(-100vh)', opacity: '0' },
        },
        pulseRing: {
          '0%': { transform: 'translate(-50%,-50%) scale(0.6)', opacity: '1' },
          '100%': { transform: 'translate(-50%,-50%) scale(1.2)', opacity: '0' },
        },
        trackSlide: {
          '0%': { transform: 'scaleX(0)', transformOrigin: 'left' },
          '50%': { transform: 'scaleX(1)' },
          '100%': { transform: 'scaleX(1)', opacity: '0' },
        },
        typing: {
          '0%, 60%, 100%': { opacity: '0.3', transform: 'translateY(0)' },
          '30%': { opacity: '1', transform: 'translateY(-3px)' },
        },
        scanBg: {
          '0%': { backgroundPosition: '0 -100%' },
          '100%': { backgroundPosition: '0 200%' },
        },
        liveSlide: {
          '0%, 100%': { transform: 'translateX(-100%)' },
          '50%':       { transform: 'translateX(100%)' },
        },
        livePulse: {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(245,160,58,0.4)' },
          '50%':      { opacity: '0.7', boxShadow: '0 0 0 6px rgba(245,160,58,0)' },
        },
      },
      animation: {
        gridMove: 'gridMove 8s linear infinite',
        scan: 'scan 3s ease-in-out infinite',
        float: 'float linear infinite',
        pulseRing: 'pulseRing 2.5s ease-out infinite',
        trackSlide: 'trackSlide 4s linear infinite',
        typing: 'typing 1.4s ease-in-out infinite',
        scanBg: 'scanBg 3s linear infinite',
        liveSlide: 'liveSlide 3s ease-in-out infinite',
        livePulse: 'livePulse 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
