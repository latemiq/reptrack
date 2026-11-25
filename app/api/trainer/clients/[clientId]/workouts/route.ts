import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserId, unauthorized } from '@/lib/api-auth'
import { forbidden, hasClientAccess } from '@/lib/trainer'

/** Read-only workout history of a client. Same shape as GET /api/gym/workouts. */
export async function GET(req: NextRequest, { params }: { params: { clientId: string } }) {
  const userId = await getUserId()
  if (!userId) return unauthorized()
  if (!await hasClientAccess(userId, params.clientId)) return forbidden()

  const { searchParams } = new URL(req.url)
  const requestedLimit = Number(searchParams.get('limit') ?? '30')
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100) : 30

  const { data, error } = await supabaseAdmin()
    .from('workouts')
    .select('id, template_id, name, notes, started_at, finished_at, duration_seconds, total_tonnage, warmup, workout_sets(exercise_id, exercise_name, exercise_position, set_number, reps, weight_kg, rpe)')
    .eq('user_id', params.clientId)
    .not('finished_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Client workouts fetch error:', error)
    return NextResponse.json({ error: 'Błąd bazy danych. Spróbuj ponownie.' }, { status: 500 })
  }

  return NextResponse.json({ workouts: data ?? [] })
}
