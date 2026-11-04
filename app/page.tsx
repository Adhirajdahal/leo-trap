'use client';

import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AuthForm from '@/components/AuthForm';
import { supabaseBrowser } from '@/lib/supabase/client';

function HomeContent() {
  const router = useRouter();

  useEffect(() => {
    const sb = supabaseBrowser();

    sb.auth.getUser().then(({ data }) => {
      if (data.user) router.replace('/lobby');
    });
  }, [router]);

  return (
    <>
      <h1 className="top-title">
        🐯 LEO TRAP{' '}
        <span
          style={{
            color: '#2ecc71',
            WebkitTextFillColor: '#2ecc71',
            fontSize: '0.55em',
            letterSpacing: '4px',
          }}
        >
          ONLINE
        </span>{' '}
        🐐
      </h1>

      <div className="subtitle">
        Real-time Tigers vs Goats · Betting challenges · Winner takes the pot
      </div>

      <AuthForm />
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading LEO TRAP...</div>}>
      <HomeContent />
    </Suspense>
  );
}