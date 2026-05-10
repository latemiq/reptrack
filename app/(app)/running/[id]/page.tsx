import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) redirect('/auth')

  const { id } = await params

  return (
    <div className="flex items-center justify-center h-screen bg-[#080808] text-[#f0ece4]">
      <div className="text-center max-w-md">
        <h1 className="font-display text-[28px] font-black mb-2">Szczegóły biegu</h1>
        <p className="text-[14px] text-[#666] mb-2">ID: {id}</p>
        <p className="text-[12px] text-[#555]">Ta strona jest w budowie — wkrótce dostępne pełne dane biegu, mapa GPS, splity i analiza.</p>
      </div>
    </div>
  )
}
