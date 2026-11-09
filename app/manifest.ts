import type { MetadataRoute } from 'next'

// Served at /manifest.webmanifest and linked automatically by Next.
// Makes RepTrack installable ("Dodaj do ekranu głównego") as a PWA.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'RepTrack — trening i postępy',
    short_name: 'RepTrack',
    description: 'Zapisuj treningi siłowe i biegi. Twój trener widzi postępy na bieżąco.',
    lang: 'pl',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#080808',
    theme_color: '#080808',
    categories: ['fitness', 'health', 'sports'],
    icons: [
      { src: '/icons/192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Siłownia', short_name: 'Trening', url: '/gym', icons: [{ src: '/icons/192.png', sizes: '192x192' }] },
      { name: 'Historia treningów', short_name: 'Historia', url: '/gym/history', icons: [{ src: '/icons/192.png', sizes: '192x192' }] },
      { name: 'Bieganie', short_name: 'Bieganie', url: '/running', icons: [{ src: '/icons/192.png', sizes: '192x192' }] },
    ],
  }
}
