import LobbyClient from '@/components/LobbyClient';

export default function LobbyPage() {
  return (
    <>
      <h1 className="top-title">
        🐯 LEO TRAP{' '}
        <span style={{ color: '#2ecc71', WebkitTextFillColor: '#2ecc71', fontSize: '0.55em', letterSpacing: '4px' }}>ONLINE</span>{' '}
        🐐
      </h1>
      <div className="subtitle">Post a bet, share the link, play live</div>
      <LobbyClient />
    </>
  );
}
