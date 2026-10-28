import RunDetail from '@/components/running/RunDetail'

export const metadata = {
  title: 'RepTrack — Szczegóły biegu',
}

export default function RunDetailPage({ params }: { params: { id: string } }) {
  return <RunDetail id={params.id} />
}
