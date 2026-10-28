import ClientDetail from '@/components/trainer/ClientDetail'

export const metadata = {
  title: 'RepTrack — Podopieczny',
}

export default function ClientPage({ params }: { params: { clientId: string } }) {
  return <ClientDetail clientId={decodeURIComponent(params.clientId)} />
}
