// Warm-up before a workout: cardio on a machine or light exercises for the muscles of the day.
// Stored apart from workout_sets (workouts.warmup, workout_templates.warmup, planned_sessions.warmup),
// so it never counts towards sets, tonnage, records or the muscle map.
// Copy of lib/warmup.ts in the web app — keep them in sync.

export interface CardioWarmup {
  kind: 'cardio'
  /** e.g. "Bieżnia", "Ergometr wioślarski". */
  machine: string
  minutes: number | null
  distanceKm: number | null
  /** Pace, speed or resistance as typed: "6 km/h", "poziom 8", "2:05/500 m". */
  level: string
  done?: boolean
}

export interface ExerciseWarmup {
  kind: 'exercise'
  name: string
  sets: number
  /** Reps, or seconds for holds; null = "as you feel". */
  reps: number | null
  done?: boolean
}

export type WarmupItem = CardioWarmup | ExerciseWarmup

export const CARDIO_MACHINES = ['Bieżnia', 'Rower stacjonarny', 'Ergometr wioślarski', 'Orbitrek', 'Stepper', 'SkiErg', 'Skakanka']

/** Suggestions for warming up the muscles of the day. */
export const WARMUP_EXERCISES: { group: string; names: string[] }[] = [
  { group: 'Całe ciało', names: ['Pajacyki', 'Krążenia ramion', 'Krążenia bioder'] },
  { group: 'Klatka i barki', names: ['Face pull z gumą', 'Rozciąganie gumy przed sobą', 'Pompki', 'Przenoszenie kija nad głową'] },
  { group: 'Plecy', names: ['Martwy wis', 'Podciąganie łopatek', 'Wiosłowanie z gumą'] },
  { group: 'Nogi i pośladki', names: ['Przysiad bez obciążenia', 'Wymachy nóg', 'Most biodrowy', 'Chód z gumą w bok', 'Wykroki bez obciążenia'] },
  { group: 'Brzuch', names: ['Dead bug', 'Deska (plank)', 'Bird dog'] },
]

const LIMIT = 12

const num = (v: unknown, min: number, max: number): number | null => {
  if (v == null || v === '') return null
  const n = Number(typeof v === 'string' ? v.replace(',', '.') : v)
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : null
}
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** Validates warm-up items from a client; drops anything malformed instead of failing the whole save. */
export function sanitizeWarmup(input: unknown, keepDone = true): WarmupItem[] {
  if (!Array.isArray(input)) return []
  const out: WarmupItem[] = []
  for (const raw of input.slice(0, LIMIT)) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const done = keepDone && r.done === true ? { done: true } : {}
    if (r.kind === 'cardio') {
      const machine = text(r.machine, 60)
      if (!machine) continue
      const minutes = num(r.minutes, 0, 180)
      const distanceKm = num(r.distanceKm, 0, 100)
      out.push({ kind: 'cardio', machine, minutes: minutes == null ? null : Math.round(minutes), distanceKm, level: text(r.level, 30), ...done })
    } else if (r.kind === 'exercise') {
      const name = text(r.name, 80)
      if (!name) continue
      const reps = num(r.reps, 1, 300)
      out.push({ kind: 'exercise', name, sets: Math.round(num(r.sets, 1, 10) ?? 1), reps: reps == null ? null : Math.round(reps), ...done })
    }
  }
  return out
}

const fmt = (n: number) => String(n).replace('.', ',')

/** One line per item, e.g. "Bieżnia 8 min · 1,2 km · 6 km/h" or "Pajacyki 2×30". */
export function warmupLabel(item: WarmupItem): string {
  if (item.kind === 'cardio') {
    return [item.machine, item.minutes != null ? `${item.minutes} min` : null, item.distanceKm != null ? `${fmt(item.distanceKm)} km` : null, item.level || null]
      .filter(Boolean).join(' · ')
  }
  return item.reps != null ? `${item.name} ${item.sets}×${item.reps}` : item.sets > 1 ? `${item.name} ×${item.sets}` : item.name
}
