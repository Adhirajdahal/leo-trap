import { NextResponse } from 'next/server';
import { supabaseAuth, supabaseAdmin } from '@/lib/supabase/server';

export async function GET() {
  const { data } = await supabaseAdmin
    .from('challenges')
    .select('*, profiles:creator_id(name, wins, losses)')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(50);
  return NextResponse.json({ challenges: data ?? [] });
}

export async function POST(req: Request) {
  const { stake, side } = await req.json();
  const auth = supabaseAuth();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const { data, error } = await supabaseAdmin.rpc('create_challenge', {
    p_user_id: user.id,
    p_stake: Math.max(1, Math.floor(Number(stake))),
    p_side: side,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ challenge_id: data });
}
