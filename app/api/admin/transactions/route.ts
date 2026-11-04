import { NextResponse } from 'next/server';
import { supabaseAdmin, requireAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = new URL(req.url).searchParams.get('user');
  let q = supabaseAdmin
    .from('transactions')
    .select('*, profiles:user_id(name)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (userId) q = q.eq('user_id', userId);

  const { data } = await q;
  return NextResponse.json({ transactions: data ?? [] });
}
