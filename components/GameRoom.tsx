'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { tigerMoves, goatMoves } from '@/lib/rules';
import type { Game, Profile, Move } from '@/lib/types';
import Board from './Board';

export default function GameRoom({ gameId }: { gameId: string }) {
  const router = useRouter();
  const sb = supabaseBrowser();
  const [game, setGame] = useState<Game | null>(null);
  const [me, setMe] = useState<Profile | null>(null);
  const [tigerName, setTigerName] = useState('');
  const [goatName, setGoatName] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [validMoves, setValidMoves] = useState<number[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  async function load() {
    const { data: g } = await sb.from('games').select('*').eq('id', gameId).single();
    if (!g) return;
    setGame(g as Game);
    const meR = await fetch('/api/me').then(r => r.json()).catch(() => ({}));
    setMe(meR?.profile ?? null);
    const ids = [g.tiger_player, g.goat_player];
    const { data: profs } = await sb.from('profiles').select('id,name').in('id', ids);
    const map: Record<string, string> = {};
    (profs ?? []).forEach((p: any) => map[p.id] = p.name);
    setTigerName(map[g.tiger_player] ?? '—');
    setGoatName(map[g.goat_player] ?? '—');
  }

  useEffect(() => {
    load();
    const ch = sb.channel(`game:${gameId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload) => {
          setGame(payload.new as Game);
          setSelected(null); setValidMoves([]);
        })
      .subscribe();
    const iv = setInterval(load, 10000);
    const t = setInterval(() => setTick(x => x + 1), 1000);
    return () => { sb.removeChannel(ch); clearInterval(iv); clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const mySide = useMemo(() => {
    if (!game || !me) return null;
    if (me.id === game.tiger_player) return 'tiger' as const;
    if (me.id === game.goat_player) return 'goat' as const;
    return null;
  }, [game, me]);

  const state = game?.state;
  const myTurn = !!(game && mySide && state && !state.gameOver && state.turn === mySide);

  async function sendMove(move: Move) {
    setBusy(true); setErr('');
    const r = await fetch(`/api/games/${gameId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(move),
    });
    const j = await r.json();
    setBusy(false);
    if (j.error) setErr(j.error);
    else { setSelected(null); setValidMoves([]); }
  }

  function handlePointClick(p: number) {
    if (!state || !mySide || !myTurn || busy) return;

    if (mySide === 'goat' && state.goatsInHand > 0) {
      if (state.board[p] === null) sendMove({ kind: 'place_goat', to: p });
      return;
    }

    if (mySide === 'tiger') {
      if (selected === null) {
        if (state.board[p] === 'tiger') {
          const mv = tigerMoves(state, p);
          if (mv.length) { setSelected(p); setValidMoves(mv.map(m => m.to)); }
        }
      } else if (validMoves.includes(p)) {
        sendMove({ kind: 'move_tiger', from: selected, to: p });
      } else if (state.board[p] === 'tiger') {
        const mv = tigerMoves(state, p);
        setSelected(mv.length ? p : null);
        setValidMoves(mv.map(m => m.to));
      } else { setSelected(null); setValidMoves([]); }
    } else if (mySide === 'goat') {
      if (selected === null) {
        if (state.board[p] === 'goat') {
          const mv = goatMoves(state, p);
          if (mv.length) { setSelected(p); setValidMoves(mv.map(m => m.to)); }
        }
      } else if (validMoves.includes(p)) {
        sendMove({ kind: 'move_goat', from: selected, to: p });
      } else if (state.board[p] === 'goat') {
        const mv = goatMoves(state, p);
        setSelected(mv.length ? p : null);
        setValidMoves(mv.map(m => m.to));
      } else { setSelected(null); setValidMoves([]); }
    }
  }

  async function resign() {
    if (!confirm('Resign and forfeit the pot?')) return;
    const r = await fetch(`/api/games/${gameId}/resign`, { method: 'POST' });
    const j = await r.json();
    if (j.error) setErr(j.error);
  }

  async function claim() {
    setErr('');
    const r = await fetch(`/api/games/${gameId}/claim`, { method: 'POST' });
    const j = await r.json();
    if (j.error) setErr(j.error);
  }

  if (!game || !state || !me) {
    return <section className="card narrow"><div className="empty">Loading game…</div></section>;
  }

  const isWinnerMe = state.gameOver && game.winner === me.id;
  const pot = game.stake * 2;
  const idleMs = Date.now() - new Date(game.last_move_at).getTime();
  const canClaim = !state.gameOver && idleMs >= 5 * 60 * 1000;
  const idleSec = Math.max(0, Math.floor((5 * 60 * 1000 - idleMs) / 1000));

  return (
    <>
      <div className="card" style={{ maxWidth: 900, marginBottom: 16, padding: 14, display: 'flex', flexWrap: 'wrap', gap: '10px 24px', justifyContent: 'space-between' }}>
        <div>
          🐯 <b style={{ color: '#ff9f8a' }}>{tigerName}</b>
          <span style={{ margin: '0 8px', color: '#7f8c8d' }}>vs</span>
          🐐 <b style={{ color: '#85c1e9' }}>{goatName}</b>
        </div>
        <div>🎫 Stake: <b style={{ color: '#f1c40f' }}>{game.stake}</b> · Pot: <b style={{ color: '#f1c40f' }}>{pot}</b></div>
        <div style={{ color: '#9aa5b1', fontSize: '0.88em' }}>
          You play: <b style={{ color: mySide === 'tiger' ? '#ff9f8a' : '#85c1e9' }}>{mySide?.toUpperCase()}</b>
        </div>
      </div>

      <div className="game-container">
        <div className="board-wrap">
          <Board state={state} selected={selected} validMoves={validMoves}
            onPointClick={handlePointClick} myTurn={myTurn && !busy} />
        </div>

        <div className="info-panel">
          <div className={`turn-indicator ${state.gameOver ? (state.winner === 'tiger' ? 'tiger' : 'goat') : state.turn} ${myTurn && !state.gameOver ? 'my-turn' : ''}`}>
            {state.gameOver
              ? (state.winner === 'tiger' ? '🐯 TIGERS WIN' : '🐐 GOATS WIN')
              : state.turn === 'tiger' ? "🐯 TIGER'S TURN" : "🐐 GOAT'S TURN"}
          </div>

          <div className="stats">
            <div className="stat-row"><span>🐐 Captured (need 5)</span><span>{state.goatsCaptured} / 5</span></div>
            <div className="stat-row"><span>🐐 Goats on board</span><span>{Object.values(state.board).filter(v => v === 'goat').length}</span></div>
            <div className="stat-row"><span>🐐 In hand</span><span>{state.goatsInHand}</span></div>
          </div>

          <div className="message">
            {err ? <span style={{ color: '#e74c3c' }}>{err}</span>
              : state.gameOver ? 'Game over — return to lobby.'
              : myTurn
                ? (mySide === 'goat' && state.goatsInHand > 0
                    ? `Place a goat on an empty point (${state.goatsInHand} left).`
                    : selected === null ? 'Select a piece, then click a green target.' : 'Click a green target.')
                : 'Waiting for opponent…'}
          </div>

          <div className="history">
            {state.moveLog.slice(-30).map((m, i) => (
              <div key={i} className={`history-item ${m.startsWith('🐯') ? 'tiger' : 'goat'}`}>{m}</div>
            ))}
          </div>

          <div className="btn-row">
            {!state.gameOver && <button className="danger" onClick={resign}>🏳 Resign</button>}
            {!state.gameOver && (
              <button className="secondary" onClick={claim} disabled={!canClaim}>
                {canClaim ? '⏰ Claim win' : `⏰ Claim in ${Math.floor(idleSec/60)}:${String(idleSec%60).padStart(2,'0')}`}
              </button>
            )}
            <button className="secondary" onClick={() => router.push('/lobby')}>🏠 Lobby</button>
          </div>
        </div>
      </div>

      {state.gameOver && (
        <div className="overlay show">
          <div className="overlay-box">
            <h2 style={{ color: isWinnerMe ? '#2ecc71' : '#e74c3c' }}>
              {isWinnerMe ? '🏆 YOU WIN!' : '😢 YOU LOSE'}
            </h2>
            <p>{isWinnerMe ? `You won the ${pot}-chip pot!` : `The pot of ${pot} chips goes to the winner.`}</p>
            <button onClick={() => router.push('/lobby')}>BACK TO LOBBY</button>
          </div>
        </div>
      )}
    </>
  );
}
