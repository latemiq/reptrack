import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { normalizeInviteCode, toPersonSummary, PERSON_COLUMNS } from '@/lib/trainer'

/**
 * Public invite preview for the QR landing page (/join/[code]) — works before sign-in.
 * Reveals only the trainer's display name and avatar for a valid, unused code.
 */
export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  const code = normalizeInviteCode(params.code)
  if (!code) return NextResponse.json({ valid: false }, { status: 404 })

  const supabase = supabaseAdmin()
  const { data: invite } = await supabase
    .from('coach_clients')
    .select('trainer_id, expires_at')
    .eq('invite_code', code)
    .eq('status', 'pending')
    .maybeSingle()

  if (!invite || new Date(invite.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ valid: false }, { status: 404 })
  }

  const { data: profile } = await supabase.from('profiles').select(PERSON_COLUMNS).eq('id', invite.trainer_id).maybeSingle()
  const trainer = profile ? toPersonSummary(profile) : null

  return NextResponse.json({
    valid: true,
    code,
    // email is deliberately not exposed on this unauthenticated endpoint
    trainer: { name: trainer && trainer.name !== trainer.email ? trainer.name : 'Twój trener', imageUrl: trainer?.imageUrl ?? null },
  })
}
