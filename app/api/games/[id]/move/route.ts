import { NextResponse } from 'next/server';
import { supabaseAuth, supabaseAdmin } from '@/lib/supabase/server';
import { validateAndApply } from '@/lib/rules';
import type { Move, Player } from '@/lib/types';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = supabaseAuth();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const move = (await req.json()) as Move;
  const { data: game, error: gErr } = await supabaseAdmin
    .from('games').select('*').eq('id', params.id).single();
  if (gErr || !game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  if (game.status !== 'active') return NextResponse.json({ error: 'Game is not active' }, { status: 400 });

  const side: Player | null =
    user.id === game.tiger_player ? 'tiger' :
    user.id === game.goat_player ? 'goat' : null;
  if (!side) return NextResponse.json({ error: 'Not a player' }, { status: 403 });

  const result = validateAndApply(game.state, move, side);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const { error: rpcErr } = await supabaseAdmin.rpc('commit_move', {
    p_game_id: params.id,
    p_user_id: user.id,
    p_new_state: result.state,
    p_expected_version: game.state_version,
  });
  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 409 });
  return NextResponse.json({ ok: true });
}
