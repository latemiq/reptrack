'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import GymTabs from '@/components/gym/GymTabs'
import {
  MUSCLE_GROUP_PL, EQUIPMENT_PL, LEVEL_PL, MUSCLE_PL,
  FORCE_PL, MECHANIC_PL, translate,
  type MuscleGroupKey,
} from '@/lib/exercises/translations'

// ─── TYPY ─────────────────────────────────────────────────────────────────────

export interface ExerciseRow {
  id: string
  catalog_id: string | null
  name: string
  /** Original English name when the catalog entry is shown in Polish. */
  name_en?: string
  source: 'catalog' | 'custom'
  level: 'beginner' | 'intermediate' | 'expert' | null
  force: string | null
  mechanic: string | null
  equipment: string | null
  primary_muscles: string[]
  secondary_muscles: string[]
  instructions: string[]
  category: string | null
  images: string[]
}

interface ExercisesAtlasProps {
  pickMode?: boolean
  onPick?: (exercise: ExerciseRow) => void
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const muscleToGroupSet = (muscles: string[]): Set<MuscleGroupKey> => {
  const groups = new Set<MuscleGroupKey>()
  for (const muscle of muscles) {
    for (const [key, cfg] of Object.entries(MUSCLE_GROUP_PL) as [MuscleGroupKey, typeof MUSCLE_GROUP_PL[MuscleGroupKey]][]) {
      if ((cfg.muscles as readonly string[]).includes(muscle)) groups.add(key)
    }
  }
  return groups
}

// ─── SUB-KOMPONENTY ───────────────────────────────────────────────────────────

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-[1.2px] transition-all border whitespace-nowrap ${
        active
          ? 'bg-[#f5a03a]/[0.1] border-[#f5a03a]/30 text-[#f5a03a]'
          : 'bg-white/[0.02] border-white/[0.06] text-[#666] hover:border-white/15 hover:text-[#bbb]'
      }`}>
      {label}
    </button>
  )
}

function ExerciseCard({ exercise, onClick }: { exercise: ExerciseRow; onClick: () => void }) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError]   = useState(false)
  const primaryImage = exercise.images?.[0]

  return (
    <button
      onClick={onClick}
      className="atlas-card group bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl overflow-hidden text-left hover:border-[#f5a03a]/30 hover:-translate-y-1 transition-all duration-200"
    >
      <div className="relative aspect-[4/3] bg-[#0a0a0a] overflow-hidden">
        {primaryImage && !imgError ? (
          <>
            {!imgLoaded && <div className="absolute inset-0 bg-[#131313] animate-pulse" />}
            <Image
              src={primaryImage}
              alt={exercise.name}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className={`object-cover group-hover:scale-105 transition-all duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#333] text-3xl">🏋️</div>
        )}

        {exercise.level && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[9px] font-mono uppercase tracking-wider text-[#ccc]">
            {translate(exercise.level, LEVEL_PL)}
          </div>
        )}
        {exercise.source === 'custom' && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-[#c8f53a]/20 backdrop-blur-sm text-[9px] font-mono uppercase tracking-wider text-[#c8f53a] border border-[#c8f53a]/30">
            Własne
          </div>
        )}
      </div>

      <div className="p-3.5">
        <div className="text-[13px] font-medium text-[#f0ece4] mb-1.5 line-clamp-2 leading-tight">
          {exercise.name}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {exercise.equipment && (
            <span className="text-[9px] font-mono text-[#666] uppercase tracking-wider">
              {translate(exercise.equipment, EQUIPMENT_PL)}
            </span>
          )}
          {exercise.primary_muscles[0] && (
            <>
              <span className="text-[#333] text-[8px]">·</span>
              <span className="text-[9px] font-mono text-[#f5a03a] uppercase tracking-wider">
                {translate(exercise.primary_muscles[0], MUSCLE_PL)}
              </span>
            </>
          )}
        </div>
      </div>
    </button>
  )
}

function ExerciseDetail({ exercise, onClose, onAddToWorkout }: {
  exercise: ExerciseRow
  onClose: () => void
  onAddToWorkout?: () => void
}) {
  const [imgIdx, setImgIdx] = useState(0)
  const overlayRef = useRef<HTMLDivElement>(null)
  const sheetRef   = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out' })
    gsap.fromTo(sheetRef.current,
      { opacity: 0, y: 30, scale: 0.96 },
      { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: 'expo.out' })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div ref={overlayRef}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-stretch md:items-center justify-center p-0 md:p-6"
      onClick={onClose}
    >
      <div ref={sheetRef}
        onClick={e => e.stopPropagation()}
        className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-none md:rounded-3xl w-full h-full md:h-auto md:max-w-3xl md:max-h-[88vh] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="relative aspect-[16/10] bg-[#0a0a0a] overflow-hidden md:rounded-t-3xl">
          {exercise.images.length > 0 ? (
            <Image
              key={imgIdx}
              src={exercise.images[imgIdx]}
              alt={`${exercise.name} - krok ${imgIdx + 1}`}
              fill sizes="800px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#333] text-5xl">🏋️</div>
          )}

          {exercise.images.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5">
              {exercise.images.map((_, i) => (
                <button key={i} onClick={() => setImgIdx(i)}
                  className={`h-1.5 rounded-full transition-all ${i === imgIdx ? 'bg-[#f5a03a] w-4' : 'bg-white/30 w-1.5'}`}
                />
              ))}
            </div>
          )}

          <button onClick={onClose}
            className="absolute top-3 right-3 w-11 h-11 md:w-9 md:h-9 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center text-[#ccc] hover:text-white hover:border-white/30 transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="p-6">
          <h2 className="font-display text-[24px] font-black text-[#f0ece4] mb-2">{exercise.name}</h2>

          <div className="flex gap-1.5 flex-wrap mb-5">
            {[
              exercise.level   && translate(exercise.level, LEVEL_PL),
              exercise.equipment && translate(exercise.equipment, EQUIPMENT_PL),
              exercise.force   && translate(exercise.force, FORCE_PL),
              exercise.mechanic && translate(exercise.mechanic, MECHANIC_PL),
            ].filter(Boolean).map((tag, i) => (
              <span key={i} className="px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-[10px] font-mono uppercase tracking-wider text-[#bbb]">
                {tag}
              </span>
            ))}
          </div>

          {(exercise.primary_muscles.length > 0 || exercise.secondary_muscles.length > 0) && (
            <div className="grid grid-cols-2 gap-3 mb-6">
              {exercise.primary_muscles.length > 0 && (
                <div className="bg-[#f5a03a]/[0.05] border border-[#f5a03a]/20 rounded-xl p-3.5">
                  <div className="text-[9px] font-mono text-[#f5a03a] uppercase tracking-[1.5px] mb-2">Główne mięśnie</div>
                  <p className="text-[12px] text-[#f0ece4]">
                    {exercise.primary_muscles.map(m => translate(m, MUSCLE_PL)).join(' · ')}
                  </p>
                </div>
              )}
              {exercise.secondary_muscles.length > 0 && (
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3.5">
                  <div className="text-[9px] font-mono text-[#666] uppercase tracking-[1.5px] mb-2">Mięśnie pomocnicze</div>
                  <p className="text-[12px] text-[#aaa]">
                    {exercise.secondary_muscles.map(m => translate(m, MUSCLE_PL)).join(' · ')}
                  </p>
                </div>
              )}
            </div>
          )}

          {exercise.instructions.length > 0 && (
            <div>
              <div className="text-[10px] font-mono text-[#666] uppercase tracking-[2px] mb-3">Wykonanie</div>
              <ol className="space-y-3">
                {exercise.instructions.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-md bg-[#1a1a1a] flex items-center justify-center text-[10px] font-mono text-[#f5a03a] mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-[13px] text-[#bbb] leading-relaxed">{step}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {onAddToWorkout && (
            <div className="mt-6 pt-5 border-t border-[#1a1a1a]">
              <button onClick={onAddToWorkout}
                className="w-full py-3.5 rounded-xl bg-[#f5a03a] text-[#080808] font-mono text-[12px] uppercase tracking-[1.5px] font-medium hover:bg-[#ffb04a] hover:-translate-y-px transition-all"
              >
                + Dodaj do treningu
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── GŁÓWNY KOMPONENT ─────────────────────────────────────────────────────────

const PAGE_SIZE = 24

export default function ExercisesAtlas({ pickMode = false, onPick }: ExercisesAtlasProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const containerRef = useRef<HTMLDivElement>(null)

  const [exercises, setExercises] = useState<ExerciseRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const [search, setSearch]           = useState('')
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroupKey | null>(null)
  const [equipment, setEquipment]     = useState<string | null>(null)
  const [level, setLevel]             = useState<string | null>(null)
  const [page, setPage]               = useState(0)
  const [selected, setSelected]       = useState<ExerciseRow | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/exercises')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(data => { if (!cancelled) { setExercises(data.exercises ?? []); setLoading(false) } })
      .catch(e  => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return exercises.filter(ex => {
      // Polish name, plus the original English one (e.g. "bench press") when translated.
      if (q && !`${ex.name} ${ex.name_en ?? ''}`.toLowerCase().includes(q)) return false
      if (muscleGroup) {
        const groups = muscleToGroupSet([...ex.primary_muscles, ...ex.secondary_muscles])
        if (!groups.has(muscleGroup)) return false
      }
      if (equipment && ex.equipment !== equipment) return false
      if (level && ex.level !== level) return false
      return true
    })
  }, [exercises, search, muscleGroup, equipment, level])

  const paginated  = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page])
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  useEffect(() => { setPage(0) }, [search, muscleGroup, equipment, level])

  const availableEquipment = useMemo(() => {
    const set = new Set<string>()
    exercises.forEach(ex => { if (ex.equipment) set.add(ex.equipment) })
    return Array.from(set).sort()
  }, [exercises])

  useGSAP(() => {
    gsap.fromTo('.atlas-card',
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.4, stagger: 0.03, ease: 'expo.out' })
  }, { scope: containerRef, dependencies: [page, paginated.length] })

  const returnTo = searchParams.get('returnTo')

  const handleCardClick = (exercise: ExerciseRow) => {
    if (pickMode && onPick) { onPick(exercise); return }
    setSelected(exercise)
  }

  const handleAddToWorkout = (exercise: ExerciseRow) => {
    if (returnTo) {
      sessionStorage.setItem('reptrack-selected-exercise', JSON.stringify({
        id: exercise.id,
        catalog_id: exercise.catalog_id,
        name: exercise.name,
      }))
      router.push(returnTo)
    } else {
      setSelected(null)
    }
  }

  return (
    <div ref={containerRef} className={pickMode ? '' : 'flex h-screen bg-[#080808] text-[#f0ece4] overflow-hidden'}>
      <main className={pickMode ? '' : 'flex-1 overflow-y-auto px-4 md:px-7 py-5 md:py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'}>

        {!pickMode && <div className="max-w-2xl mb-4"><GymTabs /></div>}
        {!pickMode && (
          <div className="mb-6 flex justify-between items-end">
            <div>
              <p className="text-[11px] font-mono text-[#666] uppercase tracking-[1.5px]">Siłownia</p>
              <h1 className="font-display text-[24px] font-black leading-tight">Ćwiczenia</h1>
              <p className="text-[12px] text-[#666] mt-1">
                {loading ? '...' : `${filtered.length} z ${exercises.length} ćwiczeń`}
              </p>
            </div>
            <button
              onClick={() => router.push('/gym/exercises/new')}
              className="px-4 py-3 md:py-2.5 min-h-[44px] rounded-xl bg-[#0f0f0f] border border-[#1a1a1a] text-[#888] text-[11px] font-mono uppercase tracking-[1.3px] hover:border-[#c8f53a]/30 hover:text-[#c8f53a] transition-all"
            >
              + Własne ćwiczenie
            </button>
          </div>
        )}

        {/* Search */}
        <div className="mb-4 relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#444]" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <input
            type="search"
            placeholder="Szukaj ćwiczenia..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#0f0f0f] border border-[#1a1a1a] focus:border-[#f5a03a]/40 rounded-xl pl-10 pr-4 py-3 text-[13px] text-[#f0ece4] placeholder:text-[#444] outline-none transition-colors"
          />
        </div>

        {/* Filtry */}
        <div className="space-y-2 mb-6">
          <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FilterPill label="Wszystkie" active={muscleGroup === null} onClick={() => setMuscleGroup(null)} />
            {(Object.entries(MUSCLE_GROUP_PL) as [MuscleGroupKey, typeof MUSCLE_GROUP_PL[MuscleGroupKey]][]).map(([key, cfg]) => (
              <FilterPill key={key} label={cfg.label} active={muscleGroup === key} onClick={() => setMuscleGroup(key)} />
            ))}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FilterPill label="Cały sprzęt" active={equipment === null} onClick={() => setEquipment(null)} />
            {availableEquipment.map(eq => (
              <FilterPill key={eq} label={translate(eq, EQUIPMENT_PL)} active={equipment === eq} onClick={() => setEquipment(eq)} />
            ))}
          </div>
          <div className="flex gap-1.5">
            <FilterPill label="Każdy poziom" active={level === null} onClick={() => setLevel(null)} />
            {(['beginner', 'intermediate', 'expert'] as const).map(l => (
              <FilterPill key={l} label={translate(l, LEVEL_PL)} active={level === l} onClick={() => setLevel(l)} />
            ))}
          </div>
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-[#131313]" />
                <div className="p-3.5 space-y-2">
                  <div className="h-3 bg-[#131313] rounded" />
                  <div className="h-2 bg-[#131313] rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5 text-red-400 text-[13px]">
            Błąd ładowania bazy: {error}
            <p className="text-[11px] text-red-400/60 mt-1">Sprawdź czy seed został uruchomiony i Supabase działa.</p>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-3 opacity-40">🔍</div>
            <p className="text-[14px] text-[#888] mb-1">Nie znaleziono ćwiczeń</p>
            <p className="text-[11px] text-[#555]">Spróbuj zmienić filtry lub wyszukiwanie</p>
          </div>
        )}

        {!loading && !error && paginated.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {paginated.map(ex => (
                <ExerciseCard key={ex.id} exercise={ex} onClick={() => handleCardClick(ex)} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  disabled={page === 0}
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  className="px-5 py-3 md:px-4 md:py-2 rounded-lg bg-[#0f0f0f] border border-[#1a1a1a] text-[#888] text-[12px] md:text-[11px] font-mono uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed hover:border-[#333] hover:text-[#ccc] transition-all"
                >← Wstecz</button>
                <span className="text-[11px] font-mono text-[#666] px-3">{page + 1} / {totalPages}</span>
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  className="px-5 py-3 md:px-4 md:py-2 rounded-lg bg-[#0f0f0f] border border-[#1a1a1a] text-[#888] text-[12px] md:text-[11px] font-mono uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed hover:border-[#333] hover:text-[#ccc] transition-all"
                >Dalej →</button>
              </div>
            )}
          </>
        )}
      </main>

      {selected && (
        <ExerciseDetail
          exercise={selected}
          onClose={() => setSelected(null)}
          onAddToWorkout={returnTo ? () => handleAddToWorkout(selected) : undefined}
        />
      )}
    </div>
  )
}
