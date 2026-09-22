// 유형 상성표: 전력이 같은 짝만 1대1 로 붙여 유형끼리 실제로 호각인지 본다 (전력 계산식이 놓치는 것을 드러낸다)
// npm run matrix -- [짝당 판수=120] [전력 차 허용=5]
import { Rng } from '../core/rng.js';
import { battle } from '../core/battle.js';
import { makeGladiator, powerOf, TYPES, TYPE_KO } from '../core/gladiator.js';
import type { GType } from '../core/types.js';

const N = Number(process.argv[2] ?? 120), BAND = Number(process.argv[3] ?? 5);
const rng = new Rng(7);
const SHORT = (t: GType) => TYPE_KO[t].slice(0, 2);
const grid: Record<string, Record<string, number>> = {}; const win: Record<string, number> = {}, tot: Record<string, number> = {}, dmg: Record<string, number[]> = {}, dur: number[] = [];
for (const a of TYPES) { grid[a] = {};
  for (const b of TYPES) { if (a === b) { grid[a][b] = 50; continue; }
    let n = 0, w = 0, guard = 0;
    while (n < N && guard < N * 80) { guard++;
      const A = makeGladiator(rng, 'tiro', { type: a }), B = makeGladiator(rng, 'tiro', { type: b });
      if (Math.abs(powerOf(A) - powerOf(B)) > BAND) continue; // 전력이 같다고 표시되는 짝만
      A.scaeva = false; B.scaeva = false; // 몸 상태·왼손잡이는 빼고 유형 차이만
      const r = battle(rng, [A], [B]); n++; dur.push(r.duration);
      tot[a] = (tot[a] ?? 0) + 1; tot[b] = (tot[b] ?? 0) + 1;
      if (r.winner === 'A') { w++; win[a] = (win[a] ?? 0) + 1; } else if (r.winner === 'B') win[b] = (win[b] ?? 0) + 1;
      for (const e of r.events) if (e.kind === 'attack' && e.dmg) (dmg[e.actor === A.id ? a : b] ??= []).push(e.dmg); }
    grid[a][b] = n ? Math.round(w / n * 100) : -1; } }
const avg = (x: number[] = []) => x.length ? x.reduce((s, v) => s + v, 0) / x.length : 0;
console.log(`유형 상성표 (전력 차 ${BAND} 이내, 짝당 ${N}판, 평균 ${avg(dur).toFixed(1)}초)\n`);
console.log('    ', ...TYPES.map(t => SHORT(t).padStart(5)));
for (const a of TYPES) console.log(SHORT(a).padEnd(5), ...TYPES.map(b => (a === b ? '·' : `${grid[a][b]}%`).padStart(5)));
const pct = TYPES.map(t => Math.round((win[t] ?? 0) / (tot[t] ?? 1) * 100));
console.log('\n유형'.padEnd(14), '전체 승률', '타격당 피해');
TYPES.forEach((t, i) => console.log(TYPE_KO[t].padEnd(13), `${pct[i]}%`.padStart(8), avg(dmg[t]).toFixed(1).padStart(10)));
console.log(`\n승률 폭 ${Math.max(...pct) - Math.min(...pct)}%p (목표 10 이하) · 짝 최악 ${Math.min(...TYPES.flatMap(a => TYPES.filter(b => a !== b).map(b => grid[a][b])))}% ~ ${Math.max(...TYPES.flatMap(a => TYPES.filter(b => a !== b).map(b => grid[a][b])))}% (목표 35~65)`);
const bad = TYPES.flatMap(a => TYPES.filter(b => a !== b).map(b => ({ a, b, v: grid[a][b] }))).filter(x => x.v >= 65).sort((x, y) => y.v - x.v);
if (bad.length) console.log('치우친 짝:', bad.map(x => `${TYPE_KO[x.a]}>${TYPE_KO[x.b]} ${x.v}%`).join(' · '));
