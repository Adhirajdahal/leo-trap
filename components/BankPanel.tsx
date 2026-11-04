'use client';
import { useEffect, useState } from 'react';

export default function BankPanel() {
  const [amount, setAmount] = useState(500);
  const [kind, setKind] = useState<'deposit' | 'withdrawal'>('deposit');
  const [rows, setRows] = useState<any[]>([]);
  const [msg, setMsg] = useState('');

  async function load() {
    const r = await fetch('/api/bank').then(r => r.json()).catch(() => ({}));
    setRows(r.requests ?? []);
  }
  useEffect(() => { load(); }, []);

  async function submit() {
    setMsg('');
    const r = await fetch('/api/bank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, kind }),
    });
    const j = await r.json();
    if (j.error) setMsg(j.error);
    else { setMsg('✅ Request submitted — an admin will review it.'); load(); }
  }

  return (
    <div className="panel">
      <h3>🏦 Bank</h3>
      <div className="bet-controls">
        <label>Amount
          <input type="number" min={1} value={amount} onChange={e => setAmount(+e.target.value)} />
        </label>
        <label>Kind
          <select value={kind} onChange={e => setKind(e.target.value as any)}>
            <option value="deposit">Deposit (top up)</option>
            <option value="withdrawal">Withdraw (cash out)</option>
          </select>
        </label>
        <button onClick={submit}>Request</button>
      </div>
      {msg && <div className="hint">{msg}</div>}
      {rows.length > 0 && (
        <div style={{ marginTop: 10, fontSize: '0.85em' }}>
          {rows.map(r => (
            <div className="row" key={r.id}>
              <span className="who">{r.kind} · {r.amount} chips</span>
              <span style={{ color: r.status === 'pending' ? '#3498db' : r.status === 'approved' ? '#2ecc71' : '#e74c3c' }}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
