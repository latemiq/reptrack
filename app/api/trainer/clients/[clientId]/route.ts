import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserId, unauthorized } from '@/lib/api-auth'
import { forbidden, hasClientAccess, toPersonSummary } from '@/lib/trainer'

/** Client card for the trainer: identity plus basic training profile. */
export async function GET(_req: NextRequest, { params }: { params: { clientId: string } }) {
  const userId = await getUserId()
  if (!userId) return unauthorized()
  if (!await hasClientAccess(userId, params.clientId)) return forbidden()

  const supabase = supabaseAdmin()
  const [{ data: profile }, { data: relation }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, first_name, last_name, username, email, image_url, age, height_cm, weight_kg, level, weekly_days')
      .eq('id', params.clientId)
      .maybeSingle(),
    supabase
      .from('coach_clients')
      .select('accepted_at')
      .eq('trainer_id', userId)
      .eq('client_id', params.clientId)
      .eq('status', 'active')
      .maybeSingle(),
  ])

  if (!profile) return NextResponse.json({ error: 'Nie znaleziono' }, { status: 404 })

  return NextResponse.json({
    client: {
      ...toPersonSummary(profile),
      age:        profile.age,
      heightCm:   profile.height_cm,
      weightKg:   profile.weight_kg != null ? Number(profile.weight_kg) : null,
      level:      profile.level,
      weeklyDays: profile.weekly_days,
      since:      relation?.accepted_at ?? null,
    },
  })
}

/** Trainer ends the cooperation. The client's data stays with the client. */
export async function DELETE(_req: NextRequest, { params }: { params: { clientId: string } }) {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const { error } = await supabaseAdmin()
    .from('coach_clients')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('trainer_id', userId)
    .eq('client_id', params.clientId)
    .eq('status', 'active')

  if (error) {
    console.error('End relation error:', error)
    return NextResponse.json({ error: 'Nie udało się zakończyć współpracy' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
