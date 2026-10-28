import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserId, unauthorized } from '@/lib/api-auth'
import { forbidden, getActiveClients, getRole } from '@/lib/trainer'
import { currentWeekIndex, type Focus } from '@/lib/plans'

const WEEKS = 8
const DAY = 86400000

function mondayOf(d: Date) {
  const m = new Date(d)
  m.setHours(0, 0, 0, 0)
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7))
  return m
}

interface WorkoutRow {
  id: string
  user_id: string
  name: string
  started_at: string
  duration_seconds: number | null
  total_tonnage: number | string | null
  workout_sets: { count: number }[]
}

interface Attention {
  id: string
  name: string
  imageUrl: string | null
  reason: 'inactive' | 'no_workouts' | 'no_plan'
  days: number | null
}

interface PlanRow {
  id: string
  client_id: string
  name: string
  start_date: string
  mesocycles: { position: number; name: string; focus: Focus | null; microcycles: { position: number; planned_sessions: { id: string }[] }[] }[]
}

/** Trainer home: KPIs, weekly volume, clients needing attention, running plans, recent workouts. */
export async function GET() {
  const userId = await getUserId()
  if (!userId) return unauthorized()
  if (await getRole(userId) !== 'trainer') return forbidden('Tylko dla trenerów')

  const supabase = supabaseAdmin()
  const clients = await getActiveClients(userId)
  const ids = clients.map(c => c.id)

  const thisMonday = mondayOf(new Date())
  const since = new Date(thisMonday.getTime() - (WEEKS - 1) * 7 * DAY)

  const [{ count: pendingInvites }, workoutsRes, plansRes, lastRes] = await Promise.all([
    supabase.from('coach_clients').select('id', { count: 'exact', head: true })
      .eq('trainer_id', userId).eq('status', 'pending').gt('expires_at', new Date().toISOString()),
    ids.length
      ? supabase.from('workouts')
          .select('id, user_id, name, started_at, duration_seconds, total_tonnage, workout_sets(count)')
          .in('user_id', ids).not('finished_at', 'is', null).gte('started_at', since.toISOString())
          .order('started_at', { ascending: false })
      : Promise.resolve({ data: [] as WorkoutRow[], error: null }),
    ids.length
      ? supabase.from('macrocycles')
          .select('id, client_id, name, start_date, mesocycles(position, name, focus, microcycles(position, planned_sessions(id)))')
          .eq('trainer_id', userId).in('client_id', ids)
      : Promise.resolve({ data: [] as PlanRow[], error: null }),
    // Last workout per client, including ones older than the 8-week window.
    Promise.all(ids.map(id =>
      supabase.from('workouts').select('started_at').eq('user_id', id).not('finished_at', 'is', null)
        .order('started_at', { ascending: false }).limit(1).maybeSingle()
        .then(r => [id, r.data?.started_at ?? null] as const)
    )),
  ])

  if (workoutsRes.error || plansRes.error) {
    console.error('Trainer overview error:', workoutsRes.error ?? plansRes.error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const workouts = (workoutsRes.data ?? []) as unknown as WorkoutRow[]
  const nameOf = (id: string) => clients.find(c => c.id === id)?.name ?? 'Bez nazwy'

  // Weekly series, oldest → newest.
  const weekly = Array.from({ length: WEEKS }, (_, i) => {
    const start = new Date(since.getTime() + i * 7 * DAY)
    const end = start.getTime() + 7 * DAY
    const inWeek = workouts.filter(w => {
      const t = new Date(w.started_at).getTime()
      return t >= start.getTime() && t < end
    })
    return {
      weekStart: start.toISOString(),
      workouts: inWeek.length,
      tonnage: Math.round(inWeek.reduce((s, w) => s + Number(w.total_tonnage ?? 0), 0)),
      activeClients: new Set(inWeek.map(w => w.user_id)).size,
    }
  })
  const thisWeek = weekly[WEEKS - 1]
  const lastWeek = weekly[WEEKS - 2]

  const thisWeekByClient = new Map<string, number>()
  for (const w of workouts) {
    if (new Date(w.started_at).getTime() >= thisMonday.getTime()) {
      thisWeekByClient.set(w.user_id, (thisWeekByClient.get(w.user_id) ?? 0) + 1)
    }
  }

  // Running plans: current block/week and planned-vs-done sessions this week.
  const now = Date.now()
  const plans = ((plansRes.data ?? []) as unknown as PlanRow[]).flatMap(p => {
    const blocks = [...p.mesocycles].sort((a, b) => a.position - b.position)
    const weeks = blocks.flatMap(b => [...b.microcycles].sort((x, y) => x.position - y.position).map(w => ({ block: b, w })))
    const idx = currentWeekIndex(p.start_date, now)
    if (idx < 0 || idx >= weeks.length) return []
    const cur = weeks[idx]
    return [{
      id: p.id,
      name: p.name,
      clientId: p.client_id,
      clientName: nameOf(p.client_id),
      week: idx + 1,
      weeks: weeks.length,
      blockName: cur.block.name,
      focus: cur.block.focus,
      plannedThisWeek: cur.w.planned_sessions.length,
      doneThisWeek: thisWeekByClient.get(p.client_id) ?? 0,
    }]
  })

  const lastByClient = new Map(lastRes)
  const withPlan = new Set(plans.map(p => p.clientId))
  const attention = clients.flatMap((c): Attention[] => {
    const last = lastByClient.get(c.id) ?? null
    const days = last ? Math.floor((now - new Date(last).getTime()) / DAY) : null
    const base = { id: c.id, name: c.name, imageUrl: c.imageUrl, days }
    if (days == null) return [{ ...base, reason: 'no_workouts' }]
    if (days >= 7) return [{ ...base, reason: 'inactive' }]
    if (!withPlan.has(c.id)) return [{ ...base, reason: 'no_plan' }]
    return []
  }).sort((a, b) => (b.days ?? 999) - (a.days ?? 999))

  const recent = workouts.slice(0, 12).map(w => ({
    id: w.id,
    clientId: w.user_id,
    clientName: nameOf(w.user_id),
    name: w.name,
    startedAt: w.started_at,
    tonnage: Math.round(Number(w.total_tonnage ?? 0)),
    durationSec: w.duration_seconds,
    sets: w.workout_sets?.[0]?.count ?? 0,
  }))

  return NextResponse.json({
    totals: {
      clients: clients.length,
      activeThisWeek: thisWeek.activeClients,
      workoutsThisWeek: thisWeek.workouts,
      workoutsLastWeek: lastWeek.workouts,
      tonnageThisWeek: thisWeek.tonnage,
      tonnageLastWeek: lastWeek.tonnage,
      runningPlans: plans.length,
      pendingInvites: pendingInvites ?? 0,
    },
    weekly,
    attention,
    plans,
    recent,
  })
}
