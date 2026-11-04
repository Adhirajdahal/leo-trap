'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function ChallengeAcceptPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [msg, setMsg] = useState('Joining challenge…');

  useEffect(() => {
    (async () => {
      const sb = supabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { router.replace(`/?next=/challenge/${params.id}`); return; }
      const r = await fetch(`/api/challenges/${params.id}/accept`, { method: 'POST' });
      const j = await r.json();
      if (j.error) { setMsg(`❌ ${j.error}`); return; }
      router.replace(`/game/${j.game_id}`);
    })();
  }, [params.id, router]);

  return (
    <section className="card narrow">
      <div className="message">{msg}</div>
    </section>
  );
}
