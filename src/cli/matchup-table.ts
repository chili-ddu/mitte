// 상성표를 구워 core/matchup-table.ts 로 내보낸다. 규칙을 고치면 다시 돌린다: node --import tsx src/cli/_mkmatchup.ts 600
import { Rng } from '../core/rng.js';
import { battle } from '../core/battle.js';
import { makeGladiator, powerOf, TYPES } from '../core/gladiator.js';
const N = Number(process.argv[2] ?? 600), BAND = 5;
const rng = new Rng(7);
const grid: Record<string, Record<string, number>> = {};
for (const a of TYPES) { grid[a] = {};
  for (const b of TYPES) { if (a === b) { grid[a][b] = 0.5; continue; }
    let n = 0, w = 0, guard = 0;
    while (n < N && guard < N * 80) { guard++;
      const A = makeGladiator(rng, 'tiro', { type: a }), B = makeGladiator(rng, 'tiro', { type: b });
      if (Math.abs(powerOf(A) - powerOf(B)) > BAND) continue;
      A.form = 0; B.form = 0; A.scaeva = false; B.scaeva = false;
      const r = battle(rng, [A], [B]); n++;
      if (r.winner === 'A') w++; }
    grid[a][b] = n ? +(w / n).toFixed(3) : 0.5; } }
const rows = TYPES.map(a => `  ${a}: { ${TYPES.map(b => `${b}: ${grid[a][b].toFixed(3)}`).join(', ')} },`).join('\n');
console.log(`// 유형 상성표: 전력이 같은 짝을 1대1 로 ${N}판씩 붙여 잰 실제 승률 (행이 열을 이길 확률). 몸 상태·왼손잡이는 빼고 유형 차이만 남겼다.
// **손으로 고치지 않는다** — 전투 규칙을 바꾸면 \`node --import tsx src/cli/_mkmatchup.ts\` 로 다시 구워 붙인다 (${new Date().toISOString().slice(0, 10)} 측정)
import type { GType } from './types.js';
export const TYPE_MATCHUP: Record<GType, Record<GType, number>> = {
${rows}
};`);
