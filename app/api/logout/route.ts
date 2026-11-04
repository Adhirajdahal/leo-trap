import { NextResponse } from 'next/server';
import { supabaseAuth } from '@/lib/supabase/server';

export async function POST() {
  const sb = supabaseAuth();
  await sb.auth.signOut();
  return NextResponse.json({ ok: true });
}
