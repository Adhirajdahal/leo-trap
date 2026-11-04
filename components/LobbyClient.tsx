'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types';
import BankPanel from './BankPanel';

export default function LobbyClient() {
  const router = useRouter();
  const sb = supabaseBrowser();
  const [me, setMe] = useState<Profile | null>(null);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [myGames, setMyGames] = useState<any[]>([]);
  const [stake, setStake] = useState(50);
  const [side, setSide] = useState<'tiger' | 'goat' | 'random'>('tiger');
  const [status, setStatus] = useState('');
  const [copyId, setCopyId] = useState<string | null>(null);

  async function loadAll() {
    const meRes = await fetch('/api/me').then(r => r.json()).catch(() => ({}));
    if (meRes.profile) setMe(meRes.profile);
    const chRes = await fetch('/api/challenges').then(r => r.json()).catch(() => ({ challenges: [] }));
    setChallenges(chRes.challenges ?? []);
    if (meRes.profile) {
      const { data } = await sb.from('games').select('*')
        .or(`tiger_player.eq.${meRes.profile.id},goat_player.eq.${meRes.profile.id}`)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      setMyGames(data ?? []);
    }
  }

  useEffect(() => {
    loadAll();
    const ch = sb.channel('lobby-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, loadAll)
      .subscribe();
    const iv = setInterval(loadAll, 8000);
    return () => { sb.removeChannel(ch); clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createChallenge() {
    setStatus('');
    const r = await fetch('/api/challenges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stake, side }),
    });
    const j = await r.json();
    if (j.error) { setStatus(j.error); return; }
    setCopyId(j.challenge_id);
    setStatus('✅ Challenge posted! Copy the invite link below to send to a friend.');
    loadAll();
  }

  async function cancel(id: string) {
    if (!confirm('Cancel and refund this challenge?')) return;
    const r = await fetch(`/api/challenges/${id}`, { method: 'DELETE' });
    const j = await r.json();
    if (j.error) setStatus(j.error);
    loadAll();
  }

  async function accept(id: string) {
    const r = await fetch(`/api/challenges/${id}/accept`, { method: 'POST' });
    const j = await r.json();
    if (j.error) { setStatus(j.error); return; }
    router.push(`/game/${j.game_id}`);
  }

  async function logout() {
    await sb.auth.signOut();
    router.replace('/');
  }

  if (!me) return <div className="card narrow"><div className="empty">Loading…</div></div>;

  return (
    <section className="card" style={{ maxWidth: 760 }}>
      <div className="lobby-top">
        <div>Welcome, <b>{me.name}</b> {me.role === 'admin' && <span style={{ color: '#2ecc71', fontSize: '0.8em' }}>🛡 admin</span>}</div>
        <div className="chips">💰 {me.chips} chips</div>
        <div className="record">W {me.wins} · L {me.losses}</div>
        {me.role === 'admin' && <a className="ghost-link" href="/admin" style={{ marginLeft: 'auto' }}>Admin →</a>}
      </div>

      <div className="panel">
        <h3>📤 Send a betting challenge</h3>
        <div className="bet-controls">
          <label>Stake <input type="number" min={1} value={stake} onChange={e => setStake(+e.target.value)} /></label>
          <label>Side
            <select value={side} onChange={e => setSide(e.target.value as any)}>
              <option value="tiger">🐯 Tiger</option>
              <option value="goat">🐐 Goat</option>
              <option value="random">🎲 Random</option>
            </select>
          </label>
          <button onClick={createChallenge}>⚡ Post Challenge</button>
        </div>
        {copyId && (
          <div className="row" style={{ marginTop: 12 }}>
            <span className="who">
              <b>Invite link:</b>{' '}
              <code style={{ color: '#f1c40f', wordBreak: 'break-all' }}>
                {typeof window !== 'undefined' ? window.location.origin : ''}/challenge/{copyId}
              </code>
            </span>
            <button
              className="secondary"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/challenge/${copyId}`);
                setStatus('📋 Link copied!');
              }}
            >Copy</button>
          </div>
        )}
      </div>

      <div className="panel">
        <h3>🎯 Open challenges <span className="live-dot">●</span></h3>
        {challenges.length === 0 && <div className="empty">No open challenges yet — post one above!</div>}
        {challenges.map(c => {
          const p = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
          const isMine = c.creator_id === me.id;
          return (
            <div className="row" key={c.id}>
              <div className="who">
                <b>{p?.name ?? '—'}</b> · {c.creator_side}{' '}
                <span style={{ color: '#7f8c8d' }}>(W{p?.wins ?? 0}/L{p?.losses ?? 0})</span>
              </div>
              <div className="stake">💰 {c.stake}</div>
              {isMine
                ? <button className="danger" onClick={() => cancel(c.id)}>Cancel</button>
                : <button onClick={() => accept(c.id)}>Accept</button>}
            </div>
          );
        })}
      </div>

      <div className="panel">
        <h3>🎮 Your active games</h3>
        {myGames.length === 0 && <div className="empty">None right now</div>}
        {myGames.map(g => (
          <div className="row" key={g.id}>
            <div className="who">
              vs {(g.tiger_player === me.id ? 'goat' : 'tiger')} · 💰 {g.stake * 2} pot · {g.state?.goatsCaptured ?? 0}/5 captures
            </div>
            <button onClick={() => router.push(`/game/${g.id}`)}>Resume</button>
          </div>
        ))}
      </div>

      <BankPanel />

      {status && <div className="hint" style={{ marginTop: 12 }}>{status}</div>}

      <div className="btn-row spread" style={{ marginTop: 16 }}>
        <a className="ghost-link" href="/practice.html">🤖 Practice vs AI</a>
        <button className="secondary" onClick={logout}>🚪 Log out</button>
      </div>
    </section>
  );
}
