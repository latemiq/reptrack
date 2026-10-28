// Client-side helpers for trainer invites (QR → /join/[code] → /auth?invite=CODE).

export interface InvitePreview {
  valid: boolean
  code?: string
  trainer?: { name: string; imageUrl: string | null }
}

export async function fetchInvitePreview(code: string): Promise<InvitePreview> {
  const res = await fetch(`/api/invites/${encodeURIComponent(code)}`).catch(() => null)
  if (!res?.ok) return { valid: false }
  return res.json()
}

/** Connects the signed-in user to the inviting trainer. */
export async function redeemInvite(code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch('/api/athlete/trainers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  }).catch(() => null)
  if (res?.ok) return { ok: true }
  const d = await res?.json().catch(() => null)
  return { ok: false, error: d?.error ?? 'Nie udało się dołączyć do trenera.' }
}
