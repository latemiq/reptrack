'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useWorkoutStore } from '@/lib/stores/useWorkoutStore'
import { startWorkoutWithHistory } from '@/lib/start-workout'
import { relativeDay } from '@/lib/stats'
import { fmtKg, fmtTonnes, type PrEvent } from '@/lib/gym-stats'
import { formatPrescription, type PlannedExercise } from '@/lib/plans'
import type { WorkoutTemplate } from '@/lib/templates'
import GymTabs from '@/components/gym/GymTabs'

interface Overview {
  week: { days: boolean[]; today: number; done: number; goal: number | null }
  tonnage: { thisWeek: number; lastWeek: number }
  recentPrs: PrEvent[]
  planToday: { planName: string; name: string; notes: string; exercises: PlannedExercise[] } | null
}

const DAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd']

const fromPlan = (e: PlannedExercise) => ({
  exerciseId: e.exerciseId,
  name: e.name,
  targetSets: e.sets,
  targetReps: e.repsMin ?? e.repsMax ?? 8,
  targetRepsMax: e.repsMax,
  targetWeight: e.weightKg,
  restSeconds: e.restSeconds ?? 120,
  plan: formatPrescription(e),
  notes: e.notes || undefined,
})

const repsLabel = (min: number, max?: number | null) => (max && max !== min ? `${min}–${max}` : String(min))

/** Gym home: this week at a glance, one big "start" for today, templates, records. */
export default function GymHome() {
  const router = useRouter()
  const activeWorkout = useWorkoutStore(s => s.activeWorkout)
  const [templates, setTemplates] = useState<WorkoutTemplate[] | null>(null)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    fetch('/api/gym/templates')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => setTemplates(d.templates))
      .catch(() => { setTemplates([]); setError('Nie udało się wczytać szablonów.') })
    fetch('/api/gym/overview')
      .then(r => (r.ok ? r.json() : null))
      .then(setOverview)
      .catch(() => {})
  }, [])

  // Suggested next template when there's no plan for today: the one done longest ago.
  const suggested = useMemo(() => {
    if (!templates?.length) return null
    return [...templates].sort((a, b) => (a.last_used_at ?? '').localeCompare(b.last_used_at ?? ''))[0]
  }, [templates])

  const start = async (name: string, exercises: Parameters<typeof startWorkoutWithHistory>[1], templateId?: string, trainerNote?: string) => {
    if (activeWorkout) { router.push(`/gym/log/${activeWorkout.id}`); return }
    setStarting(true)
    const id = await startWorkoutWithHistory(name, exercises, templateId, trainerNote)
    if (id) router.push(`/gym/log/${id}`)
    else setStarting(false)
  }

  const startTemplate = (t: WorkoutTemplate) => start(t.name, t.exercises, t.id)
  const startEmpty = () => start(`Trening ${new Date().toLocaleDateString('pl-PL')}`, [])

  const plan = overview?.planToday
  const hero = plan
    ? { kicker: 'Dziś · od trenera', name: plan.name, items: plan.exercises.map(e => `${e.name} ${e.sets}×${repsLabel(e.repsMin ?? e.repsMax ?? 0, e.repsMax)}`), note: plan.notes, go: () => start(plan.name, plan.exercises.map(fromPlan), undefined, plan.notes) }
    : suggested
      ? { kicker: suggested.last_used_at ? `Proponowany · ostatnio ${relativeDay(suggested.last_used_at)}` : 'Proponowany', name: suggested.name, items: suggested.exercises.map(e => `${e.name} ${e.targetSets}×${repsLabel(e.targetReps, e.targetRepsMax)}`), go: () => startTemplate(suggested) }
      : null

  const week = overview?.week
  const tonnageDelta = overview && overview.tonnage.lastWeek > 0
    ? Math.round(((overview.tonnage.thisWeek - overview.tonnage.lastWeek) / overview.tonnage.lastWeek) * 100)
    : null
  const pr = overview?.recentPrs[0]

  return (
    <div className="min-h-full bg-[#080808] text-[#f0ece4]">
      <div className="max-w-2xl mx-auto px-4 md:px-7 pt-4 md:pt-6 pb-8 space-y-4">
        <GymTabs />

        {/* Week */}
        <section>
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-[11px] font-mono text-[#666] uppercase tracking-[1.5px]">Siłownia</p>
              <h1 className="font-display text-[24px] font-black leading-tight">Ten tydzień</h1>
            </div>
            <div className="text-right">
              <div className="font-display text-[22px] font-black text-[#c8f53a] leading-none">
                {week ? `${week.done}${week.goal ? `/${week.goal}` : ''}` : '–'}
              </div>
              <div className="text-[11px] font-mono text-[#666] uppercase tracking-[1px]">treningi</div>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {DAYS.map((d, i) => {
              const done = week?.days[i]
              const today = week?.today === i
              return (
                <div key={d} className="flex flex-col items-center gap-1">
                  <span className={`text-[11px] ${today ? 'text-[#c8f53a]' : 'text-[#555]'}`}>{d}</span>
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center ${
                    done ? 'bg-[#c8f53a] text-[#0f1a00]'
                      : today ? 'border-2 border-[#c8f53a]'
                        : 'bg-[#141414]'
                  }`}>
                    {done && <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-label="trening"><path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </span>
                </div>
              )
            })}
          </div>
        </section>

        {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] text-red-400">{error}</div>}

        {/* Start */}
        {activeWorkout ? (
          <button onClick={() => router.push(`/gym/log/${activeWorkout.id}`)}
            className="w-full text-left rounded-2xl p-4 bg-[#f5a03a] text-[#2a1600] cursor-pointer">
            <div className="text-[11px] font-mono uppercase tracking-[1.5px]">Trening trwa</div>
            <div className="font-display text-[20px] font-black my-0.5">{activeWorkout.name}</div>
            <div className="mt-3 rounded-xl bg-[#080808] text-[#f5a03a] py-3 text-center text-[12px] font-mono uppercase tracking-[1.5px]">Wróć do treningu →</div>
          </button>
        ) : hero ? (
          <div className="rounded-2xl p-4 bg-[#c8f53a] text-[#1a2400]">
            <div className="text-[11px] font-mono uppercase tracking-[1.5px]">{hero.kicker}</div>
            <div className="font-display text-[22px] font-black my-0.5">{hero.name}</div>
            {'note' in hero && hero.note && (
              <div className="text-[12px] leading-relaxed mb-2 rounded-lg bg-[#1a2400]/10 px-2.5 py-1.5">
                <span className="font-medium">Uwaga trenera:</span> {hero.note}
              </div>
            )}
            <div className="text-[12px] leading-relaxed mb-3 line-clamp-2">
              {hero.items.slice(0, 3).join(' · ')}{hero.items.length > 3 ? ` · +${hero.items.length - 3}` : ''}
            </div>
            <button onClick={hero.go} disabled={starting}
              className="w-full rounded-xl bg-[#080808] text-[#c8f53a] py-3.5 text-[12px] font-mono uppercase tracking-[1.5px] disabled:opacity-60 cursor-pointer">
              {starting ? 'Przygotowuję…' : '▶ Rozpocznij'}
            </button>
          </div>
        ) : (
          <div className={`rounded-2xl h-[156px] ${templates === null ? 'bg-[#0f0f0f] animate-pulse' : 'hidden'}`} />
        )}

        {/* Templates */}
        <section>
          <div className="flex items-center justify-between mb-2 px-0.5">
            <span className="text-[11px] font-mono text-[#666] uppercase tracking-[1.5px]">Szablony</span>
            <Link href="/gym/templates?new=1" className="text-[12px] text-[#c8f53a] hover:underline">+ Nowy</Link>
          </div>
          <div className="rounded-2xl bg-[#0f0f0f] border border-[#1a1a1a] divide-y divide-[#1a1a1a]">
            {templates === null && [0, 1, 2].map(i => <div key={i} className="h-[52px] animate-pulse" />)}
            {templates?.map(t => (
              <div key={t.id} className="flex items-center">
                <button onClick={() => startTemplate(t)} disabled={starting}
                  className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.02] cursor-pointer">
                  <span className="flex-1 min-w-0 truncate text-[14px]">{t.name}</span>
                  <span className="text-[12px] text-[#777] flex-shrink-0">
                    {t.exercises.length} ćw · {t.last_used_at ? relativeDay(t.last_used_at) : 'nowy'}
                  </span>
                </button>
                <Link href={`/gym/templates?edit=${t.id}`} aria-label={`Edytuj ${t.name}`}
                  className="px-3 py-3.5 text-[#555] hover:text-[#c8f53a]">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M13.5 3.5l3 3L7 16H4v-3z" /></svg>
                </Link>
              </div>
            ))}
            {templates !== null && (
              <button onClick={startEmpty} disabled={starting}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-[14px] text-[#999] hover:bg-white/[0.02] cursor-pointer">
                <span className="flex-1">Pusty trening</span>
                <span className="text-[#555] text-[16px]">+</span>
              </button>
            )}
          </div>
        </section>

        {/* Records + volume */}
        <div className="grid grid-cols-2 gap-2.5">
          <Link href="/gym/history" className="rounded-2xl bg-[#0f0f0f] border border-[#1a1a1a] p-4 hover:border-[#2a2a2a]">
            <div className="text-[11px] font-mono text-[#666] uppercase tracking-[1.5px]">Rekord</div>
            {pr ? (
              <>
                <div className="text-[13px] text-[#ccc] mt-2 truncate">{pr.name}</div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-[20px] font-black">{fmtKg(pr.weight)} kg</span>
                  <span className="text-[11px] text-[#c8f53a]">× {pr.reps}</span>
                </div>
                <div className="text-[11px] text-[#666]">{relativeDay(pr.at)}{pr.previousWeight != null ? ` · było ${fmtKg(pr.previousWeight)} kg` : ''}</div>
              </>
            ) : (
              <div className="text-[12px] text-[#555] mt-2">{overview ? 'Brak rekordów w ostatnim miesiącu' : '…'}</div>
            )}
          </Link>
          <div className="rounded-2xl bg-[#0f0f0f] border border-[#1a1a1a] p-4">
            <div className="text-[11px] font-mono text-[#666] uppercase tracking-[1.5px]">Tonaż tygodnia</div>
            <div className="font-display text-[20px] font-black mt-2">{overview ? fmtTonnes(overview.tonnage.thisWeek) : '–'}</div>
            <div className={`text-[11px] ${tonnageDelta == null ? 'text-[#666]' : tonnageDelta >= 0 ? 'text-[#c8f53a]' : 'text-[#f5a03a]'}`}>
              {tonnageDelta == null ? 'brak danych z poprz. tygodnia' : `${tonnageDelta >= 0 ? '+' : ''}${tonnageDelta}% vs poprz.`}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
