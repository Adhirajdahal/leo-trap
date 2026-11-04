import { NextResponse } from 'next/server';
import { supabaseAdmin, requireAdmin } from '@/lib/supabase/server';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { delta, note } = await req.json();
  const n = Math.trunc(Number(delta));
  if (!Number.isFinite(n) || n === 0)
    return NextResponse.json({ error: 'Delta must be non-zero integer' }, { status: 400 });

  const { data, error } = await supabaseAdmin.rpc('admin_adjust_chips', {
    p_admin_id: admin.user.id,
    p_user_id: params.id,
    p_delta: n,
    p_note: note || 'Manual adjustment',
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, newBalance: data });
}
