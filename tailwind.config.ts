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
        syne: ['Syne', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
        sans: ['DM Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
