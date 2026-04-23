import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Syne, DM_Sans, DM_Mono } from 'next/font/google'
import './globals.css'

const syne = Syne({ subsets: ['latin'], variable: '--font-syne', weight: ['700', '800'] })
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', weight: ['300', '400', '500'] })
const dmMono = DM_Mono({ subsets: ['latin'], variable: '--font-dm-mono', weight: ['400', '500'] })

export const metadata: Metadata = {
  title: 'RepTrack — AI Fitness Tracker',
  description: 'Track gym sessions and runs with AI-powered insights. Built for athletes who want data, not guesswork.',
  openGraph: {
    title: 'RepTrack',
    description: 'AI-powered fitness tracker for gym & running',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="pl" className="dark">
        <body className={`${syne.variable} ${dmSans.variable} ${dmMono.variable} bg-[#0a0a0a] text-[#f0ece4] antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
