import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserId, unauthorized } from '@/lib/api-auth'
import { PERSON_COLUMNS, forbidden, hasClientAccess, toPersonSummary } from '@/lib/trainer'

export interface WorkoutComment {
  id: string
  workoutId: string
  authorId: string
  authorName: string
  /** 'athlete' = the workout's owner, 'trainer' = their trainer. */
  authorRole: 'athlete' | 'trainer'
  mine: boolean
  body: string
  createdAt: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Table not created yet (schema.sql not run): comments are simply unavailable.
const missingTable = (code?: string) => code === 'PGRST205' || code === '42P01'

/** Owners of the given workouts that the viewer may read: their own, or their clients'. */
async function accessibleOwners(viewerId: string, workoutIds: string[]) {
  const { data } = await supabaseAdmin().from('workouts').select('id, user_id').in('id', workoutIds)
  const allowed = new Map<string, string>() // workoutId → ownerId
  const access = new Map<string, boolean>()
  for (const w of data ?? []) {
    if (!access.has(w.user_id)) access.set(w.user_id, w.user_id === viewerId || await hasClientAccess(viewerId, w.user_id))
    if (access.get(w.user_id)) allowed.set(w.id, w.user_id)
  }
  return allowed
}

/** GET ?workouts=id1,id2 → { available, comments: { [workoutId]: WorkoutComment[] } } */
export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const ids = (new URL(req.url).searchParams.get('workouts') ?? '').split(',').filter(id => UUID_RE.test(id)).slice(0, 100)
  if (ids.length === 0) return NextResponse.json({ available: true, comments: {} })

  const owners = await accessibleOwners(userId, ids)
  if (owners.size === 0) return NextResponse.json({ available: true, comments: {} })

  const supabase = supabaseAdmin()
  const { data, error } = await supabase.from('workout_comments')
    .select('id, workout_id, author_id, body, created_at')
    .in('workout_id', Array.from(owners.keys()))
    .order('created_at', { ascending: true })

  if (error) {
    if (missingTable(error.code)) return NextResponse.json({ available: false, comments: {} })
    console.error('Comments fetch error:', error)
    return NextResponse.json({ error: 'Błąd bazy danych. Spróbuj ponownie.' }, { status: 500 })
  }

  const authorIds = Array.from(new Set((data ?? []).map(c => c.author_id)))
  const { data: profiles } = authorIds.length
    ? await supabase.from('profiles').select(PERSON_COLUMNS).in('id', authorIds)
    : { data: [] }

  const comments: Record<string, WorkoutComment[]> = {}
  for (const c of data ?? []) {
    const p = profiles?.find(x => x.id === c.author_id)
    const owner = owners.get(c.workout_id)
    ;(comments[c.workout_id] ??= []).push({
      id: c.id,
      workoutId: c.workout_id,
      authorId: c.author_id,
      authorName: p ? toPersonSummary(p).name : 'Użytkownik',
      authorRole: c.author_id === owner ? 'athlete' : 'trainer',
      mine: c.author_id === userId,
      body: c.body,
      createdAt: c.created_at,
    })
  }
  return NextResponse.json({ available: true, comments })
}

/** POST { workoutId, body } — the workout's owner or their trainer adds a comment. */
export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const payload = await req.json().catch(() => null)
  const workoutId = typeof payload?.workoutId === 'string' ? payload.workoutId : ''
  const body = typeof payload?.body === 'string' ? payload.body.trim().slice(0, 2000) : ''
  if (!UUID_RE.test(workoutId) || !body) return NextResponse.json({ error: 'Wpisz treść komentarza.' }, { status: 400 })

  if (!(await accessibleOwners(userId, [workoutId])).has(workoutId)) return forbidden()

  const { data, error } = await supabaseAdmin().from('workout_comments')
    .insert({ workout_id: workoutId, author_id: userId, body })
    .select('id, created_at').single()

  if (error) {
    if (missingTable(error.code)) return NextResponse.json({ error: 'Komentarze nie są jeszcze włączone w bazie.' }, { status: 503 })
    console.error('Comment insert error:', error)
    return NextResponse.json({ error: 'Nie udało się dodać komentarza.' }, { status: 500 })
  }
  return NextResponse.json({ id: data.id, createdAt: data.created_at }, { status: 201 })
}

/** DELETE ?id=… — authors can remove their own comments. */
export async function DELETE(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return unauthorized()
  const id = new URL(req.url).searchParams.get('id') ?? ''
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Nieprawidłowy komentarz' }, { status: 400 })

  const { error } = await supabaseAdmin().from('workout_comments').delete().eq('id', id).eq('author_id', userId)
  if (error) {
    console.error('Comment delete error:', error)
    return NextResponse.json({ error: 'Nie udało się usunąć komentarza.' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
