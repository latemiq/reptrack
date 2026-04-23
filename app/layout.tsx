import type { Metadata } from 'next'
import './globals.css'

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
    <html lang="pl" className="dark">
      <body className="bg-[#0a0a0a] text-[#f0ece4] antialiased">
        {children}
      </body>
    </html>
  )
}
