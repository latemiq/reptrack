'use client'

import { useAuth, useClerk, useUser } from '@clerk/nextjs'

export default function ClientAuthDebug() {
  const clerk = useClerk()
  const { isLoaded, isSignedIn, sessionId, userId } = useAuth()
  const { user } = useUser()

  const data = {
    isLoaded,
    isSignedIn,
    sessionId,
    userId,
    email: user?.primaryEmailAddress?.emailAddress ?? null,
    username: user?.username ?? null,
    buildUrlWithAuth: clerk.buildUrlWithAuth('/dashboard'),
  }

  return (
    <section className="rounded-2xl border border-[#1f1f1f] bg-[#101010] p-6">
      <h2 className="mb-4 text-sm font-semibold text-[#f0ece4]">Client Clerk</h2>
      <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-[#cfcfcf]">
        {JSON.stringify(data, null, 2)}
      </pre>
    </section>
  )
}
