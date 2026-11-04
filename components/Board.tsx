'use client';
import { ALL_POINTS, ADJ, gridPos } from '@/lib/rules';
import type { GameState } from '@/lib/types';

interface Props {
  state: GameState;
  selected: number | null;
  validMoves: number[];
  onPointClick: (p: number) => void;
  myTurn: boolean;
}

export default function Board({ state, selected, validMoves, onPointClick, myTurn }: Props) {
  const edges: [number, number][] = [];
  const seen = new Set<string>();
  for (const a of Object.keys(ADJ)) {
    for (const b of ADJ[+a]) {
      const k = `${Math.min(+a, b)}-${Math.max(+a, b)}`;
      if (!seen.has(k)) { seen.add(k); edges.push([+a, b]); }
    }
  }

  return (
    <svg className="board" width={500} height={500} viewBox="0 0 500 500">
      <g className="lines">
        {edges.map(([a, b], i) => {
          const pa = gridPos(a), pb = gridPos(b);
          return <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} />;
        })}
      </g>

      {ALL_POINTS.map(p => {
        const { x, y } = gridPos(p);
        return <circle key={p} className="point" cx={x} cy={y} r={4} />;
      })}

      {validMoves.map(v => {
        const { x, y } = gridPos(v);
        return (
          <circle key={`v-${v}`} cx={x} cy={y} r={20}
            fill="rgba(46,204,113,0.35)" stroke="#2ecc71" strokeWidth={2}
            style={{ pointerEvents: 'none' }} />
        );
      })}

      {ALL_POINTS.map(p => {
        const cell = state.board[p];
        if (!cell) return null;
        const { x, y } = gridPos(p);
        return (
          <g key={`piece-${p}`} onClick={() => myTurn && onPointClick(p)}
             style={{ cursor: myTurn ? 'pointer' : 'default' }}>
            <circle cx={x} cy={y} r={cell === 'tiger' ? 22 : 18}
              className={`piece ${cell}${selected === p ? ' selected' : ''}`} />
            <text x={x} y={y + (cell === 'tiger' ? 8 : 7)}
              textAnchor="middle" fontSize={cell === 'tiger' ? 24 : 20}
              style={{ pointerEvents: 'none' }}>
              {cell === 'tiger' ? '🐯' : '🐐'}
            </text>
          </g>
        );
      })}

      {ALL_POINTS.map(p => {
        if (state.board[p] !== null) return null;
        const { x, y } = gridPos(p);
        return (
          <circle key={`hit-${p}`} cx={x} cy={y} r={22} fill="transparent"
            onClick={() => myTurn && onPointClick(p)}
            style={{ cursor: myTurn ? 'pointer' : 'default' }} />
        );
      })}
    </svg>
  );
}
