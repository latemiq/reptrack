import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080808] px-6 text-[#f0ece4]">
      <div className="w-full max-w-md rounded-3xl border border-[#1a1a1a] bg-[#101010] p-8 text-center">
        <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-[#4a4a4a]">404</p>
        <h1 className="mb-3 font-display text-3xl font-black">Nie ma takiej strony</h1>
        <p className="mb-6 text-sm text-[#7a7a7a]">
          Ten widok nie istnieje albo został przeniesiony.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex rounded-xl bg-[#c8f53a] px-5 py-3 text-sm font-medium text-[#0a0a0a] transition-opacity hover:opacity-90"
        >
          Przejdź do pulpitu
        </Link>
      </div>
    </main>
  )
}
