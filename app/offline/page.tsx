'use client'

// Fallback shown by the service worker when a page can't be loaded without a connection.
export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#080808] text-[#f0ece4] flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#c8f53a]/10 border border-[#c8f53a]/30 flex items-center justify-center mx-auto mb-5 text-2xl">📡</div>
        <h1 className="font-display text-2xl font-black mb-2">Brak <em className="not-italic text-[#c8f53a]">połączenia</em></h1>
        <p className="text-[13px] text-neutral-500 mb-6">
          RepTrack potrzebuje internetu, żeby zapisać trening i pokazać go trenerowi. Sprawdź połączenie i spróbuj ponownie.
        </p>
        <button onClick={() => location.reload()}
          className="w-full py-3.5 rounded-xl text-[12px] font-mono uppercase tracking-[1.5px] bg-[#c8f53a] text-[#080808] cursor-pointer">
          Spróbuj ponownie
        </button>
      </div>
    </div>
  )
}
