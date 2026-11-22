import PlanStatsView from '@/components/trainer/stats/PlanStatsView'

export const metadata = {
  title: 'RepTrack — Statystyki planu',
}

export default function PlanStatsPage({ params }: { params: { clientId: string; planId: string } }) {
  return <PlanStatsView clientId={decodeURIComponent(params.clientId)} planId={params.planId} />
}
