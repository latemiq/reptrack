import { randomInt } from 'crypto'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type Role = 'athlete' | 'trainer'

// Bez 0/O/1/I/L — kod przepisywany ręcznie z ekranu trenera na telefon.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateInviteCode(length = 6): string {
  let code = ''
  for (let i = 0; i < length; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  return code
}

export function normalizeInviteCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const code = raw.trim().toUpperCase().replace(/[\s-]/g, '')
  return /^[A-Z0-9]{4,12}$/.test(code) ? code : null
}

export const forbidden = (message = 'Forbidden') => NextResponse.json({ error: message }, { status: 403 })

export async function getRole(userId: string): Promise<Role> {
  const { data } = await supabaseAdmin().from('profiles').select('role').eq('id', userId).maybeSingle()
  return data?.role === 'trainer' ? 'trainer' : 'athlete'
}

/** True when trainerId has an active relation with clientId. Gate every read of client data with this. */
export async function hasClientAccess(trainerId: string, clientId: string): Promise<boolean> {
  const { data } = await supabaseAdmin()
    .from('coach_clients')
    .select('id')
    .eq('trainer_id', trainerId)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  return Boolean(data)
}

export interface PersonSummary {
  id: string
  name: string
  email: string | null
  imageUrl: string | null
}

export function toPersonSummary(p: { id: string; first_name?: string | null; last_name?: string | null; username?: string | null; email?: string | null; image_url?: string | null }): PersonSummary {
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username || p.email || 'Bez nazwy'
  return { id: p.id, name, email: p.email ?? null, imageUrl: p.image_url ?? null }
}

export const PERSON_COLUMNS = 'id, first_name, last_name, username, email, image_url'

/** Active clients of a trainer with display info. */
export async function getActiveClients(trainerId: string): Promise<(PersonSummary & { since: string | null })[]> {
  const supabase = supabaseAdmin()
  const { data: relations } = await supabase
    .from('coach_clients')
    .select('client_id, accepted_at')
    .eq('trainer_id', trainerId)
    .eq('status', 'active')
  const ids = (relations ?? []).map(r => r.client_id as string).filter(Boolean)
  if (ids.length === 0) return []
  const { data: profiles } = await supabase.from('profiles').select(PERSON_COLUMNS).in('id', ids)
  return (relations ?? []).map(r => {
    const p = profiles?.find(x => x.id === r.client_id)
    return {
      ...(p ? toPersonSummary(p) : { id: r.client_id as string, name: 'Bez nazwy', email: null, imageUrl: null }),
      since: r.accepted_at,
    }
  })
}
