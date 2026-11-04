import { NextResponse } from 'next/server';
import { supabaseAdmin, requireAdmin } from '@/lib/supabase/server';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { role } = await req.json();
  if (!['user','admin'].includes(role))
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  if (params.id === admin.user.id)
    return NextResponse.json({ error: 'Cannot change own role' }, { status: 400 });

  const { error } = await supabaseAdmin.from('profiles').update({ role }).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
