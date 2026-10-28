import PlanEditor from '@/components/trainer/PlanEditor'

export const metadata = {
  title: 'RepTrack — Plan treningowy',
}

// planId === 'new' opens an empty macrocycle that is created on first save.
export default function PlanPage({ params }: { params: { clientId: string; planId: string } }) {
  return (
    <PlanEditor
      key={params.planId === 'new' ? 'new' : 'existing'}
      clientId={decodeURIComponent(params.clientId)}
      planId={params.planId === 'new' ? null : params.planId}
    />
  )
}
