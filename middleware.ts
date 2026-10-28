import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const AUTH_BYPASS = process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true'

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/gym(.*)',
  '/running(.*)',
  '/coach(.*)',
  '/notifications(.*)',
  '/profile(.*)',
  '/settings(.*)',
  '/goals(.*)',
  '/trainer(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (!AUTH_BYPASS && isProtectedRoute(req)) {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.redirect(new URL('/auth', req.url))
    }
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for Clerk's auto-proxy path
    '/__clerk/(.*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
