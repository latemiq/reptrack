import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserId, unauthorized } from '@/lib/api-auth'
import { PERSON_COLUMNS, forbidden, getRole, toPersonSummary } from '@/lib/trainer'

/** Trainer's active clients (with recent activity) and still-valid pending invites. */
export async function GET() {
  const userId = await getUserId()
  if (!userId) return unauthorized()
  if (await getRole(userId) !== 'trainer') return forbidden('Tylko dla trenerów')

  const supabase = supabaseAdmin()
  const { data: relations, error } = await supabase
    .from('coach_clients')
    .select('id, client_id, invite_code, status, expires_at, created_at, accepted_at')
    .eq('trainer_id', userId)
    .in('status', ['active', 'pending'])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Trainer clients fetch error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const now = Date.now()
  const active = (relations ?? []).filter(r => r.status === 'active' && r.client_id)
  const invites = (relations ?? [])
    .filter(r => r.status === 'pending' && new Date(r.expires_at).getTime() > now)
    .map(r => ({ id: r.id, code: r.invite_code, expiresAt: r.expires_at, createdAt: r.created_at }))

  const clientIds = active.map(r => r.client_id as string)
  if (clientIds.length === 0) return NextResponse.json({ clients: [], invites })

  const since = new Date(now - 30 * 86400000).toISOString()
  const [{ data: profiles }, { data: recent }, lastWorkouts] = await Promise.all([
    supabase.from('profiles').select(PERSON_COLUMNS).in('id', clientIds),
    supabase
      .from('workouts')
      .select('user_id, total_tonnage')
      .in('user_id', clientIds)
      .not('finished_at', 'is', null)
      .gte('started_at', since),
    Promise.all(clientIds.map(id =>
      supabase
        .from('workouts')
        .select('user_id, name, started_at')
        .eq('user_id', id)
        .not('finished_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(r => r.data)
    )),
  ])

  const clients = active.map(r => {
    const id = r.client_id as string
    const profile = profiles?.find(p => p.id === id)
    const mine = (recent ?? []).filter(w => w.user_id === id)
    const last = lastWorkouts.find(w => w?.user_id === id)
    return {
      relationId: r.id,
      ...(profile ? toPersonSummary(profile) : { id, name: 'Bez nazwy', email: null, imageUrl: null }),
      since: r.accepted_at,
      workouts30d: mine.length,
      tonnage30d: mine.reduce((s, w) => s + Number(w.total_tonnage ?? 0), 0),
      lastWorkout: last ? { name: last.name, startedAt: last.started_at } : null,
    }
  })

  return NextResponse.json({ clients, invites })
}
