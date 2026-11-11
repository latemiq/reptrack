import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserId, unauthorized } from '@/lib/api-auth'
import { goalProgress, type GoalRow } from '@/lib/goal-progress'
import { computeStreak, dayKey, fmtPace } from '@/lib/stats'

type Category = 'training' | 'goals' | 'coach'

interface NotificationOut {
  id: string
  category: Category
  title: string
  body: string
  at: string
  accent: string
}

const LIME = '#c8f53a'
const ORANGE = '#f5a03a'

/**
 * Notifications are derived from the user's data (no separate table):
 * saved sessions, goal milestones, streaks and inactivity reminders.
 * Read state is kept client-side by stable IDs.
 */
export async function GET() {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const supabase = supabaseAdmin()
  const since = new Date(Date.now() - 14 * 86400000).toISOString()

  const [runsRes, workoutsRes, goalsRes, lastRunRes, lastWorkoutRes] = await Promise.all([
    supabase.from('runs').select('id, name, ran_at, created_at, distance_km, avg_pace_seconds_per_km').eq('user_id', userId).gte('ran_at', since).order('ran_at', { ascending: false }),
    supabase.from('workouts').select('id, name, finished_at, duration_seconds, total_tonnage').eq('user_id', userId).not('finished_at', 'is', null).gte('finished_at', since).order('finished_at', { ascending: false }),
    supabase.from('goals').select('*').eq('user_id', userId).in('status', ['active', 'completed']),
    supabase.from('runs').select('ran_at').eq('user_id', userId).order('ran_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('workouts').select('finished_at').eq('user_id', userId).not('finished_at', 'is', null).order('finished_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  if (runsRes.error || workoutsRes.error || goalsRes.error) {
    console.error('Notifications fetch error:', runsRes.error ?? workoutsRes.error ?? goalsRes.error)
    return NextResponse.json({ error: 'Błąd bazy danych. Spróbuj ponownie.' }, { status: 500 })
  }

  const runs = runsRes.data ?? []
  const workouts = workoutsRes.data ?? []
  const goals = (goalsRes.data ?? []) as GoalRow[]
  const out: NotificationOut[] = []

  // Trainer comments on the user's recent workouts (table may not exist yet → skipped).
  const { data: recentIds } = await supabase.from('workouts').select('id, name').eq('user_id', userId).gte('started_at', new Date(Date.now() - 60 * 86400000).toISOString())
  if (recentIds?.length) {
    const { data: comments } = await supabase.from('workout_comments')
      .select('id, workout_id, author_id, body, created_at')
      .in('workout_id', recentIds.map(w => w.id)).neq('author_id', userId).gte('created_at', since)
    const authorIds = Array.from(new Set((comments ?? []).map(c => c.author_id)))
    const { data: authors } = authorIds.length ? await supabase.from('profiles').select('id, first_name, last_name').in('id', authorIds) : { data: [] }
    for (const c of comments ?? []) {
      const a = authors?.find(x => x.id === c.author_id)
      const who = [a?.first_name, a?.last_name].filter(Boolean).join(' ') || 'Trener'
      const workout = recentIds.find(w => w.id === c.workout_id)?.name ?? 'trening'
      out.push({
        id: `comment-${c.id}`,
        category: 'training',
        title: `Nowy komentarz od: ${who}`,
        body: `${workout}: „${c.body.length > 120 ? `${c.body.slice(0, 117)}…` : c.body}”`,
        at: c.created_at,
        accent: LIME,
      })
    }
  }

  for (const w of workouts) {
    out.push({
      id: `workout-${w.id}`,
      category: 'training',
      title: 'Trening zapisany',
      body: `${w.name} — ${Math.round((w.duration_seconds ?? 0) / 60)} min, tonaż ${Math.round(Number(w.total_tonnage ?? 0)).toLocaleString('pl-PL')} kg.`,
      at: w.finished_at!,
      accent: ORANGE,
    })
  }

  for (const r of runs) {
    out.push({
      id: `run-${r.id}`,
      category: 'training',
      title: 'Bieg zapisany',
      body: `${r.name} — ${Number(r.distance_km)} km w tempie ${fmtPace(r.avg_pace_seconds_per_km)}/km.`,
      at: r.created_at ?? r.ran_at,
      accent: LIME,
    })
  }

  for (const g of goals) {
    if (g.status === 'completed' && g.completed_at && g.completed_at >= since) {
      out.push({
        id: `goal-done-${g.id}`,
        category: 'goals',
        title: 'Cel osiągnięty! 🎯',
        body: `${g.name} — ${Number(g.target_value)} ${g.unit ?? ''}. Czas na kolejny cel.`,
        at: g.completed_at,
        accent: LIME,
      })
    } else if (g.status === 'active') {
      const pct = goalProgress(g)
      if (pct >= 75) {
        out.push({
          id: `goal-75-${g.id}`,
          category: 'goals',
          title: `Blisko celu — ${pct}%`,
          body: `${g.name}: ${Number(g.current_value ?? g.start_value)} z ${Number(g.target_value)} ${g.unit ?? ''}.`,
          at: (g as GoalRow & { updated_at?: string }).updated_at ?? g.created_at,
          accent: LIME,
        })
      }
      if (g.target_date) {
        const daysLeft = Math.ceil((new Date(g.target_date).getTime() - Date.now()) / 86400000)
        if (daysLeft >= 0 && daysLeft <= 7 && pct < 100) {
          out.push({
            id: `goal-deadline-${g.id}-${g.target_date}`,
            category: 'goals',
            title: 'Zbliża się termin celu',
            body: `${g.name} — zostało ${daysLeft} dni, postęp ${pct}%.`,
            at: new Date(new Date(g.target_date).getTime() - 7 * 86400000).toISOString(),
            accent: ORANGE,
          })
        }
      }
    }
  }

  const activeDays = new Set([...runs.map(r => dayKey(r.ran_at)), ...workouts.map(w => dayKey(w.finished_at!))])
  const streak = computeStreak(activeDays)
  if (streak >= 3) {
    out.push({
      id: `streak-${streak}-${dayKey(new Date())}`,
      category: 'training',
      title: `Seria ${streak} dni 🔥`,
      body: `Trenujesz ${streak} dni z rzędu. Pamiętaj też o regeneracji.`,
      at: new Date().toISOString(),
      accent: ORANGE,
    })
  }

  const lastActivity = [lastRunRes.data?.ran_at, lastWorkoutRes.data?.finished_at].filter(Boolean).sort().at(-1)
  const daysIdle = lastActivity ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86400000) : null
  if (daysIdle != null && daysIdle >= 4) {
    out.push({
      id: `idle-${dayKey(new Date())}`,
      category: 'coach',
      title: 'Dawno nie trenowałeś',
      body: `Ostatnia aktywność ${daysIdle} dni temu. Zapytaj Asystenta AI o plan powrotu do treningów.`,
      at: new Date().toISOString(),
      accent: LIME,
    })
  }
  if (daysIdle == null) {
    out.push({
      id: 'welcome',
      category: 'coach',
      title: 'Witaj w RepTrack!',
      body: 'Zaloguj pierwszy trening albo bieg — pulpit i Asystent AI zaczną pracować na Twoich danych.',
      at: new Date().toISOString(),
      accent: LIME,
    })
  }

  out.sort((a, b) => b.at.localeCompare(a.at))
  return NextResponse.json({ notifications: out.slice(0, 40) })
}
