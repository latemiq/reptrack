import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Syne, DM_Sans, DM_Mono } from 'next/font/google'
import { CustomCursor } from '@/components/ui/CustomCursor'
import RegisterServiceWorker from '@/components/pwa/RegisterServiceWorker'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#080808',
  // Lets the bottom nav pad itself above the iPhone home indicator (safe-area-bottom).
  viewportFit: 'cover',
}

const syne = Syne({ subsets: ['latin'], variable: '--font-syne', weight: ['700', '800'] })
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', weight: ['300', '400', '500'] })
const dmMono = DM_Mono({ subsets: ['latin'], variable: '--font-dm-mono', weight: ['400', '500'] })

export const metadata: Metadata = {
  title: 'RepTrack — AI Fitness Tracker',
  description: 'Track gym sessions and runs with AI-powered insights. Built for athletes who want data, not guesswork.',
  applicationName: 'RepTrack',
  // iPhone home-screen app: no Safari UI, dark status bar, own icon.
  appleWebApp: {
    capable: true,
    title: 'RepTrack',
    statusBarStyle: 'black',
  },
  icons: {
    icon: [{ url: '/icons/192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-180.png', sizes: '180x180', type: 'image/png' }],
  },
  formatDetection: { telephone: false },
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
          <CustomCursor />
          <RegisterServiceWorker />
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
