/** Monday 00:00 (server local time) of the current week. */
export function startOfWeek(d = new Date()): Date {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  const dow = (date.getDay() + 6) % 7 // 0 = Monday
  date.setDate(date.getDate() - dow)
  return date
}

export function isoWeekNumber(d = new Date()): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

/** YYYY-MM-DD in local time (toISOString would shift days across UTC midnight). */
export const dayKey = (d: Date | string) => {
  const date = new Date(d)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Consecutive active days ending today (or yesterday, if today has no activity yet). */
export function computeStreak(dates: Iterable<string>): number {
  const set = new Set(dates)
  const cursor = new Date()
  cursor.setHours(12, 0, 0, 0)
  if (!set.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)

  let streak = 0
  while (set.has(dayKey(cursor)) && streak <= 365) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/** Best 5 km time estimated from runs of at least 5 km (avg pace × 5). */
export function best5kSeconds(runs: { distance_km: number | string; duration_seconds: number }[]): number | null {
  let best: number | null = null
  for (const r of runs) {
    const km = Number(r.distance_km)
    if (km < 5 || !r.duration_seconds) continue
    const t = Math.round((r.duration_seconds / km) * 5)
    if (best == null || t < best) best = t
  }
  return best
}

export const fmtDuration = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60)
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
}

export const fmtPace = (secondsPerKm: number | null | undefined) => {
  if (!secondsPerKm || !Number.isFinite(secondsPerKm)) return '—'
  const total = Math.round(secondsPerKm)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** "dziś", "wczoraj", "pon" (this week) or "12.04". */
export function relativeDay(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const that = new Date(d)
  that.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - that.getTime()) / 86400000)
  if (diff === 0) return 'dziś'
  if (diff === 1) return 'wczoraj'
  if (diff < 7) return d.toLocaleDateString('pl-PL', { weekday: 'short' })
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })
}

export function timeAgo(iso: string): string {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (diffMin < 1) return 'przed chwilą'
  if (diffMin < 60) return `${diffMin} min temu`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `${diffH} godz. temu`
  const diffD = Math.round(diffH / 24)
  if (diffD === 1) return 'wczoraj'
  return `${diffD} dni temu`
}
