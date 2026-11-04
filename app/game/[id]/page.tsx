import GameRoom from '@/components/GameRoom';

export default function GamePage({ params }: { params: { id: string } }) {
  return <GameRoom gameId={params.id} />;
}
