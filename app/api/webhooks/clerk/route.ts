import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET
  if (!secret) {
    console.error('Missing CLERK_WEBHOOK_SECRET')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const headerPayload = await headers()
  const svixId        = headerPayload.get('svix-id')
  const svixTimestamp = headerPayload.get('svix-timestamp')
  const svixSignature = headerPayload.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  const payload = await req.text()
  const wh = new Webhook(secret)

  let evt: { type: string; data: Record<string, unknown> }
  try {
    evt = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as { type: string; data: Record<string, unknown> }
  } catch (e) {
    console.error('Webhook verification failed:', e)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (evt.type === 'user.created' || evt.type === 'user.updated') {
    const userData = evt.data as {
      id: string
      email_addresses: { email_address: string; id: string }[]
      first_name: string | null
      last_name: string | null
      image_url: string | null
      primary_email_address_id: string | null
    }

    const primaryEmail = userData.email_addresses.find(
      e => e.id === userData.primary_email_address_id
    )?.email_address ?? userData.email_addresses[0]?.email_address ?? null

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id:         userData.id,
        email:      primaryEmail,
        first_name: userData.first_name,
        last_name:  userData.last_name,
        image_url:  userData.image_url,
        updated_at: new Date().toISOString(),
      })

    if (error) {
      console.error('Profile upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  if (evt.type === 'user.deleted') {
    const { id } = evt.data as { id: string }
    await supabase.from('profiles').delete().eq('id', id)
  }

  return NextResponse.json({ success: true })
}
