import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const AUTH_BYPASS = process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true'

const isPublicRoute = createRouteMatcher([
  '/',
  '/auth(.*)',
  '/api/webhooks/clerk',
])

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/gym(.*)',
  '/running(.*)',
  '/coach(.*)',
  '/notifications(.*)',
  '/profile(.*)',
  '/settings(.*)',
  '/goals(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (!AUTH_BYPASS && isProtectedRoute(req)) {
    await auth().protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
