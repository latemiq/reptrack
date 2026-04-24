import { auth } from '@clerk/nextjs/server'
import { cookies, headers } from 'next/headers'
import ClientAuthDebug from './ClientAuthDebug'

export const metadata = {
  title: 'RepTrack - Debug Auth',
}

export default async function DebugAuthPage() {
  const { userId, sessionId, orgId } = await auth()
  const cookieStore = cookies()
  const headerStore = headers()

  const relevantCookies = cookieStore
    .getAll()
    .filter(({ name }) =>
      name.includes('clerk') ||
      name.startsWith('__session') ||
      name.startsWith('__client') ||
      name.startsWith('__refresh')
    )
    .map(({ name }) => name)

  const serverData = {
    userId,
    sessionId,
    orgId,
    host: headerStore.get('host'),
    forwardedHost: headerStore.get('x-forwarded-host'),
    forwardedProto: headerStore.get('x-forwarded-proto'),
    cookieNames: relevantCookies,
  }

  return (
    <main className="min-h-screen bg-[#080808] px-6 py-10 text-[#f0ece4]">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <section className="rounded-2xl border border-[#1f1f1f] bg-[#101010] p-6">
          <h1 className="mb-2 text-lg font-semibold">Debug Auth</h1>
          <p className="mb-4 text-sm text-[#8a8a8a]">
            Po zalogowaniu porownaj stan serwera i klienta. Jesli klient widzi sesje, a serwer nie, problem jest w handoff SSR/middleware.
          </p>
          <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-[#cfcfcf]">
            {JSON.stringify(serverData, null, 2)}
          </pre>
        </section>

        <ClientAuthDebug />
      </div>
    </main>
  )
}
