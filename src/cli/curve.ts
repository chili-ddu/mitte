// 전력 차별 승률 곡선. 우연성(역전 가능성)을 재는 도구 — 봇 경제와 무관하게 battle() 만 돌린다.
// npm run curve -- [판수=4000] [규모=1] [시드=7]   규모: 팀 인원 (1·2·3)
import { Rng } from '../core/rng.js';
import { battle } from '../core/battle.js';
import { makeGladiator } from '../core/gladiator.js';
import { teamPower } from '../core/gladiator.js';
import type { Gladiator } from '../core/types.js';

const N = Number(process.argv[2] ?? 4000), SIZE = Number(process.argv[3] ?? 1), SEED = Number(process.argv[4] ?? 7);
const rng = new Rng(SEED);
const roll = (): Gladiator[] => Array.from({ length: SIZE }, () => makeGladiator(rng, rng.chance(0.4) ? 'veteranus' : 'tiro', { season: rng.int(1, 12) })); // 시장 비율에 가깝게 베테라누스 40%
const EDGES = [-40, -25, -15, -8, -3, 3, 8, 15, 25, 40]; // 인당 평균 전력 차 구간 경계
const LABEL = ['≤−40', '−40~−25', '−25~−15', '−15~−8', '−8~−3', '−3~+3', '+3~+8', '+8~+15', '+15~+25', '+25~+40', '≥+40'];
const bucket = (d: number) => { let i = 0; while (i < EDGES.length && d >= EDGES[i]) i++; return i; };
const rows = LABEL.map(() => ({ n: 0, win: 0, draw: 0, dur: 0 }));
let draws = 0, dur = 0;
for (let i = 0; i < N; i++) {
  const A = roll(), B = roll();
  const d = (teamPower(A) - teamPower(B)) / SIZE; // A 기준 인당 전력 차
  const r = battle(rng, A, B);
  const b = rows[bucket(d)]; b.n++; b.dur += r.duration; if (r.winner === 'A') b.win++; else if (r.winner === 'draw') b.draw++;
  if (r.winner === 'draw') draws++; dur += r.duration;
}
console.log(`전력 차별 승률 (${SIZE}대${SIZE}, ${N}판, 시드 ${SEED}) — 무승부 ${(draws / N * 100).toFixed(1)}%, 평균 ${(dur / N).toFixed(1)}초\n`);
console.log('전력 차(인당)'.padEnd(12), '판수'.padStart(6), '승률'.padStart(6), '무승부'.padStart(6), '평균초'.padStart(6));
for (let i = 0; i < rows.length; i++) { const r = rows[i]; if (!r.n) continue; const dec = r.n - r.draw; console.log(LABEL[i].padEnd(12), String(r.n).padStart(6), (dec ? r.win / dec * 100 : 0).toFixed(0).padStart(5) + '%', (r.draw / r.n * 100).toFixed(0).padStart(5) + '%', (r.dur / r.n).toFixed(1).padStart(6)); } // 승률은 승부가 난 판 기준
