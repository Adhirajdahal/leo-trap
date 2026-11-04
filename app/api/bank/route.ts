import { NextResponse } from 'next/server';
import { supabaseAuth, supabaseAdmin } from '@/lib/supabase/server';

export async function GET() {
  const auth = supabaseAuth();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const { data } = await supabaseAdmin
    .from('bank_requests').select('*').eq('user_id', user.id)
    .order('created_at', { ascending: false }).limit(50);
  return NextResponse.json({ requests: data ?? [] });
}

export async function POST(req: Request) {
  const auth = supabaseAuth();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const { amount, kind, note } = await req.json();
  if (!['deposit','withdrawal'].includes(kind))
    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });

  const { data, error } = await supabaseAdmin.rpc('request_bank', {
    p_user_id: user.id,
    p_amount: Math.max(1, Math.trunc(Number(amount))),
    p_kind: kind,
    p_note: note || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ request_id: data });
}
