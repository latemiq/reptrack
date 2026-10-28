import { supabaseAdmin } from '@/lib/supabase/admin'
import { goalProgress, type GoalRow } from '@/lib/goal-progress'
import { dayKey } from '@/lib/stats'

export type ContextKey = 'gym' | 'running' | 'health' | 'goals'
export const ALL_CONTEXT: ContextKey[] = ['gym', 'running', 'health', 'goals']

const DAYS = 30

const fmtPace = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}/km` : '—')
const fmtDur  = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
}
const day = (iso: string) => dayKey(iso)

interface WorkoutWithSets {
  name: string
  started_at: string
  duration_seconds: number | null
  total_tonnage: number | string | null
  workout_sets: { exercise_id: string; exercise_name: string | null; exercise_position: number; reps: number | null; weight_kg: number | string | null; rpe: number | string | null }[]
}

export async function loadCoachData(userId: string) {
  const supabase = supabaseAdmin()
  const since = new Date(Date.now() - DAYS * 86400000).toISOString()

  const [profile, runs, workouts, weights, goals] = await Promise.all([
    supabase.from('profiles').select('first_name, age, height_cm, weight_kg, level, weekly_days, weekly_km_goal').eq('id', userId).maybeSingle(),
    supabase.from('runs').select('name, ran_at, distance_km, duration_seconds, avg_pace_seconds_per_km, avg_hr, type').eq('user_id', userId).gte('ran_at', since).order('ran_at', { ascending: false }),
    supabase.from('workouts').select('name, started_at, duration_seconds, total_tonnage, workout_sets(exercise_id, exercise_name, exercise_position, reps, weight_kg, rpe)').eq('user_id', userId).not('finished_at', 'is', null).gte('started_at', since).order('started_at', { ascending: false }),
    supabase.from('weight_logs').select('weight_kg, logged_at').eq('user_id', userId).gte('logged_at', since).order('logged_at', { ascending: true }),
    supabase.from('goals').select('*').eq('user_id', userId).eq('status', 'active'),
  ])

  return {
    profile:  profile.data,
    runs:     runs.data ?? [],
    workouts: (workouts.data ?? []) as WorkoutWithSets[],
    weights:  weights.data ?? [],
    goals:    (goals.data ?? []) as GoalRow[],
  }
}

export type CoachData = Awaited<ReturnType<typeof loadCoachData>>

/** Compact, model-readable summary of the user's training data. */
export function buildContextText(data: CoachData, keys: ContextKey[]): string {
  const parts: string[] = [`Dzisiejsza data: ${day(new Date().toISOString())}. Dane z ostatnich ${DAYS} dni.`]

  const p = data.profile
  if (p) {
    const fields = [
      p.first_name && `imię: ${p.first_name}`,
      p.age && `wiek: ${p.age}`,
      p.height_cm && `wzrost: ${p.height_cm} cm`,
      p.level && `poziom: ${p.level}`,
      p.weekly_days && `planowane treningi/tydz.: ${p.weekly_days}`,
      p.weekly_km_goal && `cel km/tydz.: ${p.weekly_km_goal}`,
    ].filter(Boolean)
    if (fields.length) parts.push(`PROFIL: ${fields.join(', ')}`)
  }

  if (keys.includes('gym')) {
    if (data.workouts.length === 0) {
      parts.push('TRENINGI SIŁOWE: brak zapisanych treningów.')
    } else {
      const lines = data.workouts.map(w => {
        const byExercise = new Map<string, string[]>()
        ;[...w.workout_sets]
          .sort((a, b) => a.exercise_position - b.exercise_position)
          .forEach(s => {
            const name = s.exercise_name ?? s.exercise_id
            const set = `${s.weight_kg != null ? `${Number(s.weight_kg)}kg×` : ''}${s.reps ?? '?'}${s.rpe != null ? `@${Number(s.rpe)}` : ''}`
            byExercise.set(name, [...(byExercise.get(name) ?? []), set])
          })
        const ex = Array.from(byExercise, ([name, sets]) => `${name}: ${sets.join(', ')}`).join('; ')
        return `- ${day(w.started_at)} ${w.name} (${Math.round((w.duration_seconds ?? 0) / 60)} min, tonaż ${Math.round(Number(w.total_tonnage ?? 0))} kg) — ${ex || 'brak serii'}`
      })
      parts.push(`TRENINGI SIŁOWE (${data.workouts.length}):\n${lines.join('\n')}`)
    }
  }

  if (keys.includes('running')) {
    if (data.runs.length === 0) {
      parts.push('BIEGI: brak zapisanych biegów.')
    } else {
      const lines = data.runs.map(r =>
        `- ${day(r.ran_at)} ${r.name} [${r.type}]: ${Number(r.distance_km)} km, ${fmtDur(r.duration_seconds)}, tempo ${fmtPace(r.avg_pace_seconds_per_km)}${r.avg_hr ? `, HR ${r.avg_hr}` : ''}`)
      parts.push(`BIEGI (${data.runs.length}):\n${lines.join('\n')}`)
    }
  }

  if (keys.includes('health')) {
    parts.push(data.weights.length === 0
      ? `MASA CIAŁA: brak pomiarów${p?.weight_kg ? ` (z profilu: ${p.weight_kg} kg)` : ''}.`
      : `MASA CIAŁA: ${data.weights.map(w => `${day(w.logged_at)} ${Number(w.weight_kg)} kg`).join(', ')}`)
  }

  if (keys.includes('goals')) {
    parts.push(data.goals.length === 0
      ? 'CELE: brak aktywnych celów.'
      : `CELE:\n${data.goals.map(g => `- ${g.name}: ${Number(g.current_value ?? g.start_value)} → ${Number(g.target_value)} ${g.unit ?? ''} (${goalProgress(g)}%)${g.target_date ? `, termin ${g.target_date}` : ''}`).join('\n')}`)
  }

  return parts.join('\n\n')
}
