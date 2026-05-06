import { Suspense } from 'react'
import ExercisesAtlas from '@/components/gym/ExercisesAtlas'

export const metadata = {
  title: 'RepTrack — Atlas Ćwiczeń',
  description: 'Baza 870+ ćwiczeń z opisami i obrazkami',
}

export default function ExercisesPage() {
  return (
    <Suspense fallback={<div className="bg-[#080808] min-h-screen" />}>
      <ExercisesAtlas />
    </Suspense>
  )
}
