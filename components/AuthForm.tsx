'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function AuthForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('next');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(''); setBusy(true);
    const sb = supabaseBrowser();
    try {
      if (mode === 'register') {
        if (password.length < 6) throw new Error('Password must be at least 6 characters');
        const { error } = await sb.auth.signUp({
          email, password,
          options: { data: { name: name.trim() || email.split('@')[0] } },
        });
        if (error) throw error;
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.replace(next || '/lobby');
    } catch (e: any) {
      setErr(e.message ?? 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card narrow">
      <h2>Player Wallet</h2>
      <p className="hint">Create a wallet with 1,000 chips, or log in. Chips are play-money for betting.</p>
      {mode === 'register' && (
        <label>Display name
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. SP" autoComplete="nickname" />
        </label>
      )}
      <label>Email
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
      </label>
      <label>Password
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
      </label>
      <div className="btn-row">
        <button onClick={submit} disabled={busy}>
          {busy ? '…' : mode === 'register' ? '💰 Create Wallet' : '🔓 Log In'}
        </button>
        <button className="secondary" onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setErr(''); }} disabled={busy}>
          {mode === 'login' ? 'Sign up' : 'Have an account?'}
        </button>
      </div>
      <div className="error">{err}</div>
      <p className="hint center">🤖 No opponent? <a href="/practice.html">Practice vs AI (offline)</a></p>
    </section>
  );
}
