export type Player = 'tiger' | 'goat';
export type Cell = 'tiger' | 'goat' | null;

export interface GameState {
  board: Record<string, Cell>;
  goatsInHand: number;
  goatsCaptured: number;
  turn: Player;
  gameOver: boolean;
  winner: Player | null;
  moveLog: string[];
}

export type Move =
  | { kind: 'place_goat'; to: number }
  | { kind: 'move_tiger'; from: number; to: number }
  | { kind: 'move_goat'; from: number; to: number };

export interface Profile { id: string; name: string; chips: number; wins: number; losses: number; role: 'user' | 'admin'; }

export interface Challenge {
  id: string; creator_id: string; stake: number;
  creator_side: 'tiger' | 'goat' | 'random';
  status: 'open' | 'matched' | 'cancelled';
  game_id: string | null; created_at: string;
}

export interface Game {
  id: string; challenge_id: string | null;
  tiger_player: string; goat_player: string;
  stake: number; state: GameState; state_version: number;
  status: 'active' | 'finished';
  winner: string | null; last_move_at: string;
}
