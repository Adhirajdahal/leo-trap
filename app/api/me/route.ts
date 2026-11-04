import { NextResponse } from 'next/server';
import { supabaseAuth, supabaseAdmin } from '@/lib/supabase/server';

export async function GET() {
  const auth = supabaseAuth();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const { data: profile, error } = await supabaseAdmin
    .from('profiles').select('*').eq('id', user.id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile });
}
