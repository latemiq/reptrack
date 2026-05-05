import dynamic from 'next/dynamic'

export const metadata = { title: 'RepTrack — Aktywny trening' }

const ActiveWorkout = dynamic(() => import('@/components/gym/ActiveWorkout'), {
  ssr: false,
  loading: () => <div className="bg-[#080808] min-h-screen" />,
})

export default function ActiveWorkoutPage() {
  return <ActiveWorkout />
}
