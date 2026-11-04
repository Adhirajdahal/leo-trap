import { NextResponse } from 'next/server';
import { supabaseAdmin, requireAdmin } from '@/lib/supabase/server';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { approve } = await req.json();
  const { error } = await supabaseAdmin.rpc('review_bank_request', {
    p_request_id: params.id,
    p_admin_id: admin.user.id,
    p_approve: !!approve,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
