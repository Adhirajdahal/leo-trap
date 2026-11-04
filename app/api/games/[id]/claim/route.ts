import { NextResponse } from 'next/server';
import { supabaseAuth, supabaseAdmin } from '@/lib/supabase/server';
import { forfeitState } from '@/lib/rules';
import type { Player } from '@/lib/types';

const IDLE_MS = 5 * 60 * 1000;

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const auth = supabaseAuth();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const { data: game } = await supabaseAdmin
    .from('games').select('*').eq('id', params.id).single();
  if (!game) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (game.status !== 'active') return NextResponse.json({ error: 'Game not active' }, { status: 400 });

  const mySide: Player | null =
    user.id === game.tiger_player ? 'tiger' :
    user.id === game.goat_player ? 'goat' : null;
  if (!mySide) return NextResponse.json({ error: 'Not a player' }, { status: 403 });

  const idleMs = Date.now() - new Date(game.last_move_at).getTime();
  if (idleMs < IDLE_MS) return NextResponse.json({ error: 'Opponent has not been idle 5 minutes' }, { status: 400 });

  const opponent: Player = mySide === 'tiger' ? 'goat' : 'tiger';
  const newState = forfeitState(game.state, opponent);

  const { error } = await supabaseAdmin.rpc('commit_move', {
    p_game_id: params.id,
    p_user_id: user.id,
    p_new_state: newState,
    p_expected_version: game.state_version,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ ok: true });
}
