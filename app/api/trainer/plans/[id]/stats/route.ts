import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserId, unauthorized } from '@/lib/api-auth'
import { forbidden, hasClientAccess } from '@/lib/trainer'
import { MACRO_TREE_SELECT, isUuid, macroFromRow, weekStart, type MacroDbRow } from '@/lib/plans'
import { REFERENCE_DAYS } from '@/lib/plan-stats'

const DAY = 86400000
const dbError = () => NextResponse.json({ error: 'Błąd bazy danych. Spróbuj ponownie.' }, { status: 500 })

/** Plan tree plus the client's workouts around it. The numbers are computed in the browser (lib/plan-stats.ts). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId()
  if (!userId) return unauthorized()
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Nie znaleziono planu' }, { status: 404 })

  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('macrocycles')
    .select(MACRO_TREE_SELECT)
    .eq('id', params.id)
    .eq('trainer_id', userId)
    .maybeSingle()

  if (error) {
    console.error('Plan stats fetch error:', error)
    return dbError()
  }
  if (!data) return NextResponse.json({ error: 'Nie znaleziono planu' }, { status: 404 })

  const plan = macroFromRow(data as unknown as MacroDbRow)
  if (!await hasClientAccess(userId, plan.clientId)) return forbidden()

  const weeks = plan.mesocycles.reduce((n, m) => n + m.microcycles.length, 0)
  // A spare day on both ends: the browser assigns days in the trainer's time zone.
  // The earlier weeks give the 1RM reference for the start of the plan (or for a plan that hasn't started).
  const from = new Date(Math.min(weekStart(plan.startDate, 0).getTime(), Date.now()) - (REFERENCE_DAYS + 1) * DAY)
  const to = new Date(weekStart(plan.startDate, weeks).getTime() + DAY)

  const { data: workouts, error: workoutsError } = await supabase
    .from('workouts')
    .select('id, name, started_at, duration_seconds, total_tonnage, workout_sets(exercise_id, exercise_name, exercise_position, set_number, reps, weight_kg)')
    .eq('user_id', plan.clientId)
    .not('finished_at', 'is', null)
    .gte('started_at', from.toISOString())
    .lt('started_at', to.toISOString())
    .order('started_at', { ascending: false })
    .limit(1000)

  if (workoutsError) {
    console.error('Plan stats workouts error:', workoutsError)
    return dbError()
  }

  return NextResponse.json({ plan, workouts: workouts ?? [] })
}
