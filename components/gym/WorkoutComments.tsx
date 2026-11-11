'use client'

import { useState } from 'react'
import type { WorkoutComment } from '@/app/api/gym/comments/route'
import { timeAgo } from '@/lib/stats'

/** Conversation under a finished workout: trainer feedback and the athlete's replies. */
export default function WorkoutComments({ workoutId, comments, available, placeholder, onChange }: {
  workoutId: string
  comments: WorkoutComment[]
  available: boolean
  placeholder: string
  onChange: () => void
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const send = async () => {
    if (!text.trim()) return
    setBusy(true)
    setError('')
    const res = await fetch('/api/gym/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workoutId, body: text }),
    }).catch(() => null)
    setBusy(false)
    if (!res?.ok) { setError((await res?.json().catch(() => null))?.error ?? 'Nie udało się wysłać komentarza.'); return }
    setText('')
    onChange()
  }

  const remove = async (id: string) => {
    if (!confirm('Usunąć ten komentarz?')) return
    const res = await fetch(`/api/gym/comments?id=${id}`, { method: 'DELETE' }).catch(() => null)
    if (res?.ok) onChange()
  }

  if (!available) return null

  return (
    <div className="pt-2.5 border-t border-[#1a1a1a] space-y-2">
      <div className="text-[11px] font-mono uppercase tracking-[1.5px] text-[#666]">Komentarze</div>
      {comments.map(c => (
        <div key={c.id} className={`rounded-xl px-3 py-2 text-[13px] ${
          c.authorRole === 'trainer' ? 'bg-[#c8f53a]/[0.07] border border-[#c8f53a]/20' : 'bg-[#0a0a0a] border border-[#1e1e1e]'
        }`}>
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className={`text-[12px] font-medium ${c.authorRole === 'trainer' ? 'text-[#c8f53a]' : 'text-[#ccc]'}`}>
              {c.mine ? 'Ty' : c.authorName}{c.authorRole === 'trainer' ? ' · trener' : ''}
            </span>
            <span className="text-[11px] text-[#555]">{timeAgo(c.createdAt)}</span>
            {c.mine && (
              <button onClick={() => remove(c.id)} className="ml-auto text-[11px] text-[#555] hover:text-red-400 cursor-pointer">Usuń</button>
            )}
          </div>
          <p className="text-[#ddd] whitespace-pre-wrap break-words">{c.body}</p>
        </div>
      ))}
      <div className="flex gap-2 items-end">
        <textarea value={text} onChange={e => setText(e.target.value)} rows={1} maxLength={2000} placeholder={placeholder}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          className="flex-1 min-w-0 resize-none bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl px-3 py-2 text-[13px] text-[#f0ece4] placeholder:text-[#444] focus:outline-none focus:border-[#c8f53a]/40" />
        <button onClick={send} disabled={busy || !text.trim()}
          className="px-3.5 py-2 rounded-xl bg-[#c8f53a] text-[#0f1a00] text-[12px] font-medium disabled:opacity-40 cursor-pointer">
          {busy ? '…' : 'Wyślij'}
        </button>
      </div>
      {error && <p className="text-[12px] text-red-400">{error}</p>}
    </div>
  )
}
