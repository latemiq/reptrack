'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWorkoutStore } from '@/lib/stores/useWorkoutStore'
import type { WorkoutTemplate } from '@/lib/templates'
import { relativeDay } from '@/lib/stats'

export default function GymPage() {
  const router = useRouter()
  const { activeWorkout, startWorkout } = useWorkoutStore()
  const [templates, setTemplates] = useState<WorkoutTemplate[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/gym/templates')
      .then(async res => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then(d => setTemplates(d.templates))
      .catch(() => { setTemplates([]); setError('Nie udało się wczytać szablonów. Sprawdź połączenie z bazą.') })
  }, [])

  const begin = (name: string, tmpl: WorkoutTemplate | null) => {
    startWorkout(
      name,
      (tmpl?.exercises ?? []).map(ex => ({ ...ex, id: crypto.randomUUID() })),
      tmpl?.id,
    )
    const w = useWorkoutStore.getState().activeWorkout
    if (w) router.push(`/gym/log/${w.id}`)
  }

  return (
    <div className="min-h-full bg-[#080808] text-[#f0ece4]">
      <main className="px-4 md:px-7 py-6 md:py-7">

        <div className="mb-8">
          <p className="text-[10px] font-mono text-[#444] uppercase tracking-[2px] mb-1">Siłownia</p>
          <h1 className="font-display text-[28px] font-black mb-1">Treningi</h1>
          <p className="text-[13px] text-[#666]">Wybierz szablon żeby rozpocząć sesję</p>
        </div>

        {activeWorkout && (
          <div className="bg-[#f5a03a]/[0.06] border border-[#f5a03a]/20 rounded-2xl p-5 mb-6 flex flex-wrap gap-3 justify-between items-center">
            <div>
              <div className="text-[10px] font-mono text-[#f5a03a] uppercase tracking-[2px] mb-1">Trening trwa</div>
              <div className="font-display text-[16px] font-black">{activeWorkout.name}</div>
            </div>
            <button
              onClick={() => router.push(`/gym/log/${activeWorkout.id}`)}
              className="px-5 py-2.5 rounded-xl bg-[#f5a03a] text-[#080808] text-[12px] font-mono uppercase tracking-[1.3px] font-medium hover:bg-[#ffb04a] transition-all"
            >
              Wróć do treningu →
            </button>
          </div>
        )}

        {error && <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] text-red-400">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates === null && [0, 1, 2].map(i => (
            <div key={i} className="h-[124px] rounded-2xl bg-[#0f0f0f] border border-[#1a1a1a] animate-pulse" />
          ))}
          {templates?.map(t => (
            <button
              key={t.id}
              onClick={() => begin(t.name, t)}
              disabled={!!activeWorkout}
              className="bg-[#0f0f0f] border border-[#1a1a1a] hover:border-[#f5a03a]/30 hover:bg-[#f5a03a]/[0.03] disabled:opacity-40 disabled:cursor-not-allowed rounded-2xl p-5 text-left transition-all hover:-translate-y-1"
            >
              <div className="w-8 h-8 rounded-lg bg-[#f5a03a]/10 border border-[#f5a03a]/20 flex items-center justify-center mb-3">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="4" y="6.5" width="8" height="3" rx="1.5" fill="none" stroke="#f5a03a" strokeWidth="1.5"/>
                  <rect x="1" y="6.5" width="3" height="3" rx="1" fill="none" stroke="#f5a03a" strokeWidth="1.5"/>
                  <rect x="12" y="6.5" width="3" height="3" rx="1" fill="none" stroke="#f5a03a" strokeWidth="1.5"/>
                </svg>
              </div>
              <div className="font-display text-[16px] font-black mb-1">{t.name}</div>
              <div className="text-[10px] font-mono text-[#666]">
                {t.exercises.length} ćwiczeń · {t.last_used_at ? `ostatnio ${relativeDay(t.last_used_at)}` : 'jeszcze nieużyty'}
              </div>
            </button>
          ))}
          {templates !== null && (
            <button
              onClick={() => begin(`Trening ${new Date().toLocaleDateString('pl-PL')}`, null)}
              disabled={!!activeWorkout}
              className="bg-[#0f0f0f] border border-dashed border-[#2a2a2a] hover:border-[#f5a03a]/25 hover:bg-[#f5a03a]/[0.02] disabled:opacity-40 disabled:cursor-not-allowed rounded-2xl p-5 text-left transition-all hover:-translate-y-1"
            >
              <div className="w-8 h-8 rounded-lg border border-dashed border-[#333] flex items-center justify-center mb-3">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2v10M2 7h10" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="font-display text-[16px] font-black mb-1 text-[#888]">Pusty trening</div>
              <div className="text-[10px] font-mono text-[#444]">Zacznij od zera</div>
            </button>
          )}
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Szablony', href: '/gym/templates', desc: 'Twórz i edytuj własne szablony' },
            { label: 'Historia', href: '/gym/history', desc: 'Archiwum ukończonych treningów' },
            { label: 'Ćwiczenia', href: '/gym/exercises', desc: 'Atlas i własna baza ćwiczeń' },
          ].map(item => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className="bg-[#0f0f0f] border border-[#1a1a1a] hover:border-[#2a2a2a] rounded-2xl p-5 text-left transition-all"
            >
              <div className="font-display text-[15px] font-black mb-1">{item.label}</div>
              <div className="text-[10px] font-mono text-[#555]">{item.desc}</div>
            </button>
          ))}
        </div>

      </main>
    </div>
  )
}
