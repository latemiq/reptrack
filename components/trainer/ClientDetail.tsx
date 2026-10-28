'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import WorkoutHistory from '@/components/gym/WorkoutHistory'
import { Avatar } from '@/components/trainer/TrainerDashboard'

interface Client {
  id: string
  name: string
  email: string | null
  imageUrl: string | null
  age: number | null
  heightCm: number | null
  weightKg: number | null
  level: string | null
  weeklyDays: number | null
  since: string | null
}

const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Początkujący',
  intermediate: 'Średniozaawansowany',
  advanced: 'Zaawansowany',
}

export default function ClientDetail({ clientId }: { clientId: string }) {
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/trainer/clients/${encodeURIComponent(clientId)}`)
      .then(async res => {
        if (res.status === 403) throw new Error('Nie masz dostępu do tego podopiecznego.')
        if (!res.ok) throw new Error('Nie udało się wczytać podopiecznego.')
        return res.json()
      })
      .then(d => setClient(d.client))
      .catch((e: Error) => setError(e.message))
  }, [clientId])

  const endCooperation = async () => {
    if (!client || !confirm(`Zakończyć współpracę z: ${client.name}? Stracisz podgląd jego treningów.`)) return
    const res = await fetch(`/api/trainer/clients/${encodeURIComponent(clientId)}`, { method: 'DELETE' }).catch(() => null)
    if (res?.ok) router.push('/trainer')
    else setError('Nie udało się zakończyć współpracy.')
  }

  const facts = client ? [
    ['Wiek', client.age != null ? `${client.age} lat` : '—'],
    ['Waga', client.weightKg != null ? `${client.weightKg} kg` : '—'],
    ['Wzrost', client.heightCm != null ? `${client.heightCm} cm` : '—'],
    ['Poziom', client.level ? LEVEL_LABELS[client.level] ?? client.level : '—'],
    ['Treningi / tydz.', client.weeklyDays != null ? String(client.weeklyDays) : '—'],
  ] : []

  return (
    <div className="min-h-full bg-[#080808] text-[#f0ece4]">
      <div className="px-4 md:px-7 pt-5 md:pt-6 pb-2">
        <button onClick={() => router.push('/trainer')} className="text-[10px] font-mono text-[#444] uppercase tracking-[2px] mb-2 hover:text-[#c8f53a]">← Podopieczni</button>

        {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] text-red-400">{error}</div>}

        {!client && !error && <div className="h-[110px] rounded-2xl bg-[#0f0f0f] border border-[#1a1a1a] animate-pulse" />}

        {client && (
          <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-4 md:p-5">
            <div className="flex items-center gap-3">
              <Avatar name={client.name} imageUrl={client.imageUrl} size={44} />
              <div className="flex-1 min-w-0">
                <h1 className="font-display text-[20px] font-black leading-tight truncate">{client.name}</h1>
                <p className="text-[10px] font-mono text-[#555] truncate">
                  {client.email}{client.since ? ` · współpraca od ${new Date(client.since).toLocaleDateString('pl-PL')}` : ''}
                </p>
              </div>
              <button onClick={endCooperation} className="text-[10px] font-mono uppercase tracking-[1.3px] text-[#555] hover:text-red-400 cursor-pointer flex-shrink-0">
                Zakończ współpracę
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4">
              {facts.map(([label, value]) => (
                <div key={label} className="bg-[#131313] border border-[#1c1c1c] rounded-xl px-3 py-2">
                  <div className="text-[8px] font-mono text-[#444] uppercase tracking-[1.3px]">{label}</div>
                  <div className="text-[13px] text-[#ddd] mt-0.5">{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {client && (
        <>
          <div className="px-4 md:px-7 pt-4">
            <p className="text-[10px] font-mono uppercase tracking-[2px] text-[#444]">Historia treningów</p>
          </div>
          <WorkoutHistory endpoint={`/api/trainer/clients/${encodeURIComponent(clientId)}/workouts?limit=100`} readOnly />
        </>
      )}
    </div>
  )
}
