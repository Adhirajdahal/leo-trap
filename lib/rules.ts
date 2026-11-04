import type { GameState, Move, Player, Cell } from './types';

export const SIZE = 500, PAD = 60, STEP = (SIZE - 2 * PAD) / 4;
export const ALL_POINTS = Array.from({ length: 25 }, (_, i) => i);
export const TIGER_START = [0, 4, 20, 24];

export function gridPos(idx: number) {
  const r = Math.floor(idx / 5), c = idx % 5;
  return { x: PAD + c * STEP, y: PAD + r * STEP };
}

const ADJ: Record<number, number[]> = {};
const SET: Record<number, Set<number>> = {};
function addEdge(a: number, b: number) {
  if (!SET[a]) { ADJ[a] = []; SET[a] = new Set(); }
  if (!SET[b]) { ADJ[b] = []; SET[b] = new Set(); }
  if (!SET[a].has(b)) { ADJ[a].push(b); SET[a].add(b); }
  if (!SET[b].has(a)) { ADJ[b].push(a); SET[b].add(a); }
}
for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
  const i = r * 5 + c;
  if (c < 4) addEdge(i, i + 1);
  if (r < 4) addEdge(i, i + 5);
}
addEdge(0, 6); addEdge(4, 8); addEdge(20, 16); addEdge(24, 18);
addEdge(6, 12); addEdge(8, 12); addEdge(16, 12); addEdge(18, 12);
export { ADJ };

export function coord(p: number): string {
  const r = Math.floor(p / 5), c = p % 5;
  return String.fromCharCode(65 + c) + (5 - r);
}

export function initialGame(): GameState {
  const board: Record<string, Cell> = {};
  ALL_POINTS.forEach(p => board[p] = null);
  TIGER_START.forEach(p => board[p] = 'tiger');
  return { board, goatsInHand: 20, goatsCaptured: 0, turn: 'tiger', gameOver: false, winner: null, moveLog: [] };
}

function landingPoint(p: number, mid: number): number | null {
  const pp = gridPos(p), mp = gridPos(mid);
  const dx = mp.x - pp.x, dy = mp.y - pp.y;
  const tx = mp.x + dx, ty = mp.y + dy;
  for (const q of ALL_POINTS) {
    const qp = gridPos(q);
    if (Math.abs(qp.x - tx) < 1 && Math.abs(qp.y - ty) < 1) return q;
  }
  return null;
}

export function tigerMoves(state: GameState, p: number) {
  const moves: { to: number; capture: number | null }[] = [];
  for (const n of ADJ[p] || []) {
    if (state.board[n] === null) moves.push({ to: n, capture: null });
    else if (state.board[n] === 'goat') {
      const landing = landingPoint(p, n);
      if (landing !== null && state.board[landing] === null) moves.push({ to: landing, capture: n });
    }
  }
  return moves;
}

export function goatMoves(state: GameState, p: number) {
  const moves: { to: number; capture: null }[] = [];
  for (const n of ADJ[p] || []) if (state.board[n] === null) moves.push({ to: n, capture: null });
  return moves;
}

function anyTigerMoveExists(state: GameState): boolean {
  for (const p of ALL_POINTS)
    if (state.board[p] === 'tiger' && tigerMoves(state, p).length > 0) return true;
  return false;
}
function anyGoatMoveExists(state: GameState): boolean {
  for (const p of ALL_POINTS)
    if (state.board[p] === 'goat' && goatMoves(state, p).length > 0) return true;
  return false;
}

export function validateAndApply(
  state: GameState, move: Move, player: Player
): { ok: true; state: GameState } | { ok: false; error: string } {
  if (state.gameOver) return { ok: false, error: 'Game is over' };
  if (state.turn !== player) return { ok: false, error: 'Not your turn' };

  const next: GameState = { ...state, board: { ...state.board }, moveLog: [...state.moveLog] };

  if (move.kind === 'place_goat') {
    if (player !== 'goat') return { ok: false, error: 'Only goat places goats' };
    if (state.goatsInHand <= 0) return { ok: false, error: 'No goats in hand' };
    if (state.board[move.to] !== null) return { ok: false, error: 'Point occupied' };
    next.board[move.to] = 'goat';
    next.goatsInHand--;
    next.moveLog.push(`🐐 → ${coord(move.to)}`);
    next.turn = 'tiger';
    if (!anyTigerMoveExists(next)) { next.gameOver = true; next.winner = 'goat'; }
  } else if (move.kind === 'move_tiger') {
    if (player !== 'tiger') return { ok: false, error: 'Only tiger moves tigers' };
    if (state.board[move.from] !== 'tiger') return { ok: false, error: 'No tiger there' };
    const mv = tigerMoves(state, move.from).find(m => m.to === move.to);
    if (!mv) return { ok: false, error: 'Illegal tiger move' };
    next.board[move.from] = null;
    next.board[move.to] = 'tiger';
    let cap = '';
    if (mv.capture !== null) {
      next.board[mv.capture] = null;
      next.goatsCaptured++;
      cap = ` captures 🐐 ${coord(mv.capture)}`;
    }
    next.moveLog.push(`🐯 ${coord(move.from)}→${coord(move.to)}${cap}`);
    if (next.goatsCaptured >= 5) { next.gameOver = true; next.winner = 'tiger'; }
    else {
      next.turn = 'goat';
      if (next.goatsInHand === 0 && !anyGoatMoveExists(next)) { next.gameOver = true; next.winner = 'tiger'; }
    }
  } else {
    if (player !== 'goat') return { ok: false, error: 'Only goat moves goats' };
    if (state.goatsInHand > 0) return { ok: false, error: 'Place all goats first' };
    if (state.board[move.from] !== 'goat') return { ok: false, error: 'No goat there' };
    const mv = goatMoves(state, move.from).find(m => m.to === move.to);
    if (!mv) return { ok: false, error: 'Illegal goat move' };
    next.board[move.from] = null;
    next.board[move.to] = 'goat';
    next.moveLog.push(`🐐 ${coord(move.from)}→${coord(move.to)}`);
    next.turn = 'tiger';
    if (!anyTigerMoveExists(next)) { next.gameOver = true; next.winner = 'goat'; }
  }

  return { ok: true, state: next };
}

export function forfeitState(state: GameState, forfeiting: Player): GameState {
  return { ...state, gameOver: true, winner: forfeiting === 'tiger' ? 'goat' : 'tiger',
    moveLog: [...state.moveLog, `🏳 ${forfeiting} resigned`] };
}
