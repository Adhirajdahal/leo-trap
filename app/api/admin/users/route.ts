import { NextResponse } from 'next/server';
import { supabaseAdmin, requireAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  let query = supabaseAdmin
    .from('profiles')
    .select('id,name,chips,wins,losses,role,created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (q) query = query.ilike('name', `%${q}%`);

  const { data } = await query;
  return NextResponse.json({ users: data ?? [] });
}
