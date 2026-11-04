import { NextResponse } from 'next/server';
import { supabaseAdmin, requireAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data } = await supabaseAdmin
    .from('bank_requests')
    .select('*, profiles:user_id(name, chips)')
    .order('created_at', { ascending: false })
    .limit(100);
  return NextResponse.json({ requests: data ?? [] });
}
