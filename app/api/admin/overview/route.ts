import { NextResponse } from 'next/server';
import { supabaseAdmin, requireAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [{ count: userCount }, { data: profiles }, { count: activeGames },
         { count: openChallenges }, { count: pendingBank }, { data: recentTx }] =
    await Promise.all([
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('profiles').select('chips'),
      supabaseAdmin.from('games').select('*', { count: 'exact', head: true }).eq('status','active'),
      supabaseAdmin.from('challenges').select('*', { count: 'exact', head: true }).eq('status','open'),
      supabaseAdmin.from('bank_requests').select('*', { count: 'exact', head: true }).eq('status','pending'),
      supabaseAdmin.from('transactions')
        .select('*, profiles:user_id(name)')
        .order('created_at', { ascending: false }).limit(20),
    ]);

  const totalChips = (profiles ?? []).reduce((s: number, p: any) => s + p.chips, 0);

  return NextResponse.json({
    users: userCount ?? 0,
    totalChips,
    activeGames: activeGames ?? 0,
    openChallenges: openChallenges ?? 0,
    pendingBank: pendingBank ?? 0,
    recentTransactions: recentTx ?? [],
  });
}
