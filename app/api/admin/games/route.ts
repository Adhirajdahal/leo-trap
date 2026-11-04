import { NextResponse } from 'next/server';
import { supabaseAdmin, requireAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data } = await supabaseAdmin
    .from('games')
    .select('id,stake,state_version,status,last_move_at,created_at,tiger_player,goat_player')
    .order('created_at', { ascending: false })
    .limit(100);
  return NextResponse.json({ games: data ?? [] });
}
