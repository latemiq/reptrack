// RepTrack service worker — makes the app installable and gives an offline fallback.
// Data (API, Supabase) is never cached: workouts must always come from and go to the server.
const VERSION = 'v1'
const STATIC_CACHE = `reptrack-static-${VERSION}`
const OFFLINE_URL = '/offline'

self.addEventListener('install', event => {
  event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.add(OFFLINE_URL)))
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('reptrack-') && k !== STATIC_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Page navigations: always network; show the offline page when there is no connection.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)))
    return
  }

  // Hashed build assets and icons never change for a given URL — serve them from cache.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(cache =>
        cache.match(request).then(hit => hit || fetch(request).then(res => {
          if (res.ok) cache.put(request, res.clone())
          return res
        }))
      )
    )
  }
})
