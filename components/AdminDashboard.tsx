'use client';
import { useEffect, useState } from 'react';

type Tab = 'overview' | 'users' | 'bank' | 'ledger' | 'games';

export default function AdminDashboard({ adminName }: { adminName: string }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [bank, setBank] = useState<any[]>([]);
  const [tx, setTx] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [adjust, setAdjust] = useState<{ userId: string; name: string } | null>(null);
  const [delta, setDelta] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');

  async function loadOverview() {
    const r = await fetch('/api/admin/overview').then(r => r.json());
    setOverview(r);
    setTx(r.recentTransactions ?? []);
  }
  async function loadUsers() {
    const r = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`).then(r => r.json());
    setUsers(r.users ?? []);
  }
  async function loadBank() {
    const r = await fetch('/api/admin/bank-requests').then(r => r.json());
    setBank(r.requests ?? []);
  }
  async function loadLedger() {
    const r = await fetch('/api/admin/transactions').then(r => r.json());
    setTx(r.transactions ?? []);
  }
  async function loadGames() {
    const r = await fetch('/api/admin/games').then(r => r.json());
    setGames(r.games ?? []);
  }

  useEffect(() => { loadOverview(); }, []);
  useEffect(() => {
    if (tab === 'users') loadUsers();
    if (tab === 'bank') loadBank();
    if (tab === 'ledger') loadLedger();
    if (tab === 'games') loadGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function submitAdjust() {
    if (!adjust) return;
    const r = await fetch(`/api/admin/users/${adjust.userId}/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta: Number(delta), note }),
    });
    const j = await r.json();
    if (j.error) { setMsg(j.error); return; }
    setMsg(`✅ New balance: ${j.newBalance}`);
    setAdjust(null); setDelta(''); setNote('');
    loadUsers();
  }

  async function setRole(userId: string, role: 'user' | 'admin') {
    if (!confirm(`Change role to ${role}?`)) return;
    const r = await fetch(`/api/admin/users/${userId}/role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    const j = await r.json();
    if (j.error) setMsg(j.error);
    loadUsers();
  }

  async function reviewBank(id: string, approve: boolean) {
    const r = await fetch(`/api/admin/bank-requests/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approve }),
    });
    const j = await r.json();
    if (j.error) setMsg(j.error);
    loadBank();
  }

  async function logout() {
    await fetch('/api/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/';
  }

  return (
    <section className="card" style={{ maxWidth: 1000, width: '100%' }}>
      <div className="lobby-top">
        <div>🛡 <b>Admin Console</b> · {adminName}</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <a className="ghost-link" href="/lobby">← Lobby</a>
          <button className="secondary" onClick={logout}>Log out</button>
        </div>
      </div>

      <div className="btn-row" style={{ marginBottom: 16 }}>
        {(['overview','users','bank','ledger','games'] as Tab[]).map(t => (
          <button key={t} className={tab === t ? '' : 'secondary'}
            onClick={() => { setMsg(''); setTab(t); }}
            style={{ textTransform: 'capitalize' }}>{t}</button>
        ))}
      </div>

      {msg && <div className="hint">{msg}</div>}

      {tab === 'overview' && overview && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 16 }}>
            <Stat label="Users" value={overview.users} />
            <Stat label="Chips in economy" value={overview.totalChips} color="#f1c40f" />
            <Stat label="Active games" value={overview.activeGames} color="#2ecc71" />
            <Stat label="Open challenges" value={overview.openChallenges} color="#3498db" />
            <Stat label="Pending bank" value={overview.pendingBank} color="#e74c3c" />
          </div>
          <h3>Recent transactions</h3>
          <TxTable rows={overview.recentTransactions ?? []} />
        </>
      )}

      {tab === 'users' && (
        <>
          <div className="bet-controls">
            <label>Search <input value={q} onChange={e => setQ(e.target.value)} placeholder="name…" /></label>
            <button onClick={loadUsers}>Search</button>
          </div>
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table style={{ width: '100%', fontSize: '0.9em', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#f39c12', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
                  <th style={{ padding: 8 }}>Name</th>
                  <th style={{ padding: 8 }}>Chips</th>
                  <th style={{ padding: 8 }}>W/L</th>
                  <th style={{ padding: 8 }}>Role</th>
                  <th style={{ padding: 8 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: 8 }}>{u.name}</td>
                    <td style={{ padding: 8, color: '#f1c40f', fontWeight: 'bold' }}>{u.chips}</td>
                    <td style={{ padding: 8 }}>{u.wins}/{u.losses}</td>
                    <td style={{ padding: 8, color: u.role === 'admin' ? '#2ecc71' : '#9aa5b1' }}>{u.role}</td>
                    <td style={{ padding: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="secondary" onClick={() => { setAdjust({ userId: u.id, name: u.name }); setMsg(''); }}>💰 Adjust</button>
                      {u.role === 'user'
                        ? <button className="secondary" onClick={() => setRole(u.id, 'admin')}>🛡 Make admin</button>
                        : <button className="secondary" onClick={() => setRole(u.id, 'user')}>Demote</button>}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan={5} style={{ padding: 12, color: '#9aa5b1' }}>No users</td></tr>}
              </tbody>
            </table>
          </div>

          {adjust && (
            <div className="panel" style={{ border: '1px solid #f39c12', marginTop: 16 }}>
              <h3>Adjust chips for {adjust.name}</h3>
              <div className="bet-controls">
                <label>Delta (use − to debit)
                  <input type="number" value={delta} onChange={e => setDelta(e.target.value)} placeholder="e.g. 500 or -200" />
                </label>
                <label>Note
                  <input value={note} onChange={e => setNote(e.target.value)} placeholder="Reason" />
                </label>
                <button onClick={submitAdjust}>Apply</button>
                <button className="secondary" onClick={() => setAdjust(null)}>Cancel</button>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'bank' && (
        <table style={{ width: '100%', fontSize: '0.9em', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#f39c12', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
              <th style={{ padding: 8 }}>User</th>
              <th style={{ padding: 8 }}>Kind</th>
              <th style={{ padding: 8 }}>Amount</th>
              <th style={{ padding: 8 }}>Status</th>
              <th style={{ padding: 8 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bank.map(b => (
              <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <td style={{ padding: 8 }}>{(Array.isArray(b.profiles) ? b.profiles[0] : b.profiles)?.name ?? '—'}</td>
                <td style={{ padding: 8 }}>{b.kind}</td>
                <td style={{ padding: 8, color: '#f1c40f' }}>{b.amount}</td>
                <td style={{ padding: 8, color: b.status === 'pending' ? '#3498db' : b.status === 'approved' ? '#2ecc71' : '#e74c3c' }}>{b.status}</td>
                <td style={{ padding: 8, display: 'flex', gap: 6 }}>
                  {b.status === 'pending' && <>
                    <button onClick={() => reviewBank(b.id, true)}>✔ Approve</button>
                    <button className="danger" onClick={() => reviewBank(b.id, false)}>✖ Reject</button>
                  </>}
                </td>
              </tr>
            ))}
            {bank.length === 0 && <tr><td colSpan={5} style={{ padding: 12, color: '#9aa5b1' }}>No requests</td></tr>}
          </tbody>
        </table>
      )}

      {tab === 'ledger' && <TxTable rows={tx} />}

      {tab === 'games' && (
        <table style={{ width: '100%', fontSize: '0.9em', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#f39c12', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
              <th style={{ padding: 8 }}>Game</th>
              <th style={{ padding: 8 }}>Stake</th>
              <th style={{ padding: 8 }}>Status</th>
              <th style={{ padding: 8 }}>Last move</th>
              <th style={{ padding: 8 }}></th>
            </tr>
          </thead>
          <tbody>
            {games.map(g => (
              <tr key={g.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <td style={{ padding: 8, fontFamily: 'monospace', fontSize: '0.8em' }}>{g.id.slice(0, 8)}…</td>
                <td style={{ padding: 8, color: '#f1c40f' }}>{g.stake}</td>
                <td style={{ padding: 8 }}>{g.status}</td>
                <td style={{ padding: 8, color: '#9aa5b1' }}>{new Date(g.last_move_at).toLocaleString()}</td>
                <td style={{ padding: 8 }}><a className="ghost-link" href={`/game/${g.id}`} target="_blank" rel="noreferrer">View</a></td>
              </tr>
            ))}
            {games.length === 0 && <tr><td colSpan={5} style={{ padding: 12, color: '#9aa5b1' }}>No games</td></tr>}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Stat({ label, value, color = '#eee' }: { label: string; value: any; color?: string }) {
  return (
    <div className="panel" style={{ marginTop: 0, padding: 12 }}>
      <div style={{ color: '#9aa5b1', fontSize: '0.8em' }}>{label}</div>
      <div style={{ fontSize: '1.6em', fontWeight: 'bold', color }}>{value}</div>
    </div>
  );
}

function TxTable({ rows }: { rows: any[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', fontSize: '0.85em', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#f39c12', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
            <th style={{ padding: 6 }}>Time</th>
            <th style={{ padding: 6 }}>User</th>
            <th style={{ padding: 6 }}>Type</th>
            <th style={{ padding: 6 }}>Amount</th>
            <th style={{ padding: 6 }}>Balance</th>
            <th style={{ padding: 6 }}>Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(t => (
            <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <td style={{ padding: 6, color: '#9aa5b1' }}>{new Date(t.created_at).toLocaleString()}</td>
              <td style={{ padding: 6 }}>{(Array.isArray(t.profiles) ? t.profiles[0] : t.profiles)?.name ?? '—'}</td>
              <td style={{ padding: 6 }}>{t.type}</td>
              <td style={{ padding: 6, color: t.amount >= 0 ? '#2ecc71' : '#e74c3c', fontWeight: 'bold' }}>
                {t.amount > 0 ? '+' : ''}{t.amount}
              </td>
              <td style={{ padding: 6, color: '#f1c40f' }}>{t.balance_after}</td>
              <td style={{ padding: 6, color: '#9aa5b1', fontSize: '0.9em' }}>{t.note ?? ''}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} style={{ padding: 12, color: '#9aa5b1' }}>No transactions</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
