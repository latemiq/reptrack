'use client'

import { useRouter } from 'next/navigation'
import { useWorkoutStore, type ExerciseEntry } from '@/lib/stores/useWorkoutStore'

type ExerciseTemplate = Omit<ExerciseEntry, 'sets'>

const TEMPLATES = [
  { id: 'push', name: 'Push · klatka + barki', exercises: 5, lastUsed: '3 dni temu' },
  { id: 'pull', name: 'Pull · plecy + biceps', exercises: 5, lastUsed: '5 dni temu' },
  { id: 'legs', name: 'Legs · uda + łydki',    exercises: 6, lastUsed: 'tydzień' },
]

const PUSH_EXERCISES: ExerciseTemplate[] = [
  { id: '1', exerciseId: 'bench',    name: 'Wyciskanie sztangi na ławce',  targetSets: 4, targetReps: 6,  targetWeight: 100, restSeconds: 180 },
  { id: '2', exerciseId: 'incline',  name: 'Wyciskanie hantli skos góra',  targetSets: 3, targetReps: 8,  targetWeight: 32,  restSeconds: 150 },
  { id: '3', exerciseId: 'ohp',      name: 'OHP — wyciskanie żołnierskie', targetSets: 4, targetReps: 6,  targetWeight: 65,  restSeconds: 150 },
  { id: '4', exerciseId: 'dips',     name: 'Pompki na poręczach',          targetSets: 3, targetReps: 10, targetWeight: null, restSeconds: 120 },
  { id: '5', exerciseId: 'pushdown', name: 'Wyciskanie francuskie linkami', targetSets: 3, targetReps: 12, targetWeight: 25,  restSeconds: 90  },
]

const MOCK_EXERCISES: Record<string, ExerciseTemplate[]> = {
  push: PUSH_EXERCISES,
  pull: [],
  legs: [],
}

export default function GymPage() {
  const router = useRouter()
  const { activeWorkout, startWorkout } = useWorkoutStore()

  const handleStart = (templateId: string) => {
    const tmpl = TEMPLATES.find(t => t.id === templateId)
    if (!tmpl) return
    const exercises = MOCK_EXERCISES[templateId as keyof typeof MOCK_EXERCISES] ?? []
    startWorkout(tmpl.name, exercises, templateId)
    setTimeout(() => {
      const w = useWorkoutStore.getState().activeWorkout
      if (w) router.push(`/gym/log/${w.id}`)
    }, 50)
  }

  return (
    <div className="flex h-screen bg-[#080808] text-[#f0ece4]">
      <main className="flex-1 overflow-y-auto px-7 py-7">

        <div className="mb-8">
          <p className="text-[10px] font-mono text-[#444] uppercase tracking-[2px] mb-1">Siłownia</p>
          <h1 className="font-display text-[28px] font-black mb-1">Treningi</h1>
          <p className="text-[13px] text-[#666]">Wybierz szablon żeby rozpocząć sesję</p>
        </div>

        {activeWorkout && (
          <div className="bg-[#f5a03a]/[0.06] border border-[#f5a03a]/20 rounded-2xl p-5 mb-6 flex justify-between items-center">
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

        <div className="grid grid-cols-3 gap-3">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => handleStart(t.id)}
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
              <div className="text-[10px] font-mono text-[#666]">{t.exercises} ćwiczeń · {t.lastUsed}</div>
            </button>
          ))}
          <button
            onClick={() => {
              const name = `Trening ${new Date().toLocaleDateString('pl-PL')}`
              startWorkout(name, [], 'blank')
              setTimeout(() => {
                const w = useWorkoutStore.getState().activeWorkout
                if (w) router.push(`/gym/log/${w.id}`)
              }, 50)
            }}
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
        </div>

        <div className="mt-8 grid grid-cols-3 gap-3">
          {[
            { label: 'Szablony', href: '/gym/templates', desc: 'Twórz i edytuj własne szablony' },
            { label: 'Historia', href: '/gym/history', desc: 'Archiwum ukończonych treningów' },
            { label: 'Ćwiczenia', href: '/gym/exercises', desc: 'Własna baza ćwiczeń' },
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
