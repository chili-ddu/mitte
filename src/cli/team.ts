// 무리경기 조합표: 2대2·3대3에서 유형 조합마다 승률을 잰다 (홑경기 상성표 matrix.ts 의 무리경기 판)
// npm run team -- [조합당 판수=200] [크기 2|3|0=둘 다] [시드=7] [전력 차 허용=5]
// 조건: 전력이 같은 팀끼리만(합 차이 ≤ 허용×인원), 특성·몸 상태·왼손잡이 없음, 상대 조합은 무작위 — 조합 자체의 힘만 본다
import { Rng } from '../core/rng.js';
import { battle } from '../core/battle.js';
import { makeGladiator, powerOf, TYPES, TYPE_KO } from '../core/gladiator.js';
import type { GType } from '../core/types.js';

const N = Number(process.argv[2] ?? 200), SIZE = Number(process.argv[3] ?? 0), SEED = Number(process.argv[4] ?? 7), BAND = Number(process.argv[5] ?? 5);
const SHORT = (t: GType) => TYPE_KO[t].slice(0, 2);

/* 중복을 허용한 조합 (순서 없음): 2인 55 · 3인 220 */
function combos(size: number): GType[][] {
  const out: GType[][] = [];
  const rec = (start: number, acc: GType[]) => { if (acc.length === size) { out.push([...acc]); return; } for (let i = start; i < TYPES.length; i++) rec(i, [...acc, TYPES[i]]); };
  rec(0, []); return out;
}

function run(size: number) {
  const rng = new Rng(SEED); const all = combos(size);
  const wins = new Map<string, { w: number; n: number }>(), typeW: Record<string, number> = {}, typeN: Record<string, number> = {};
  const key = (c: GType[]) => c.join('+');
  const make = (c: GType[]) => c.map(t => { const g = makeGladiator(rng, 'tiro', { type: t }); g.scaeva = false; return g; });
  const dur: number[] = [];
  for (const comp of all) {
    let n = 0, w = 0, guard = 0;
    while (n < N && guard < N * 200) { guard++;
      const foe = all[rng.int(0, all.length - 1)];
      const A = make(comp), B = make(foe);
      const pa = A.reduce((s, g) => s + powerOf(g), 0), pb = B.reduce((s, g) => s + powerOf(g), 0);
      if (Math.abs(pa - pb) > BAND * size) continue; // 전력이 같다고 표시되는 팀끼리만
      const r = battle(rng, A, B); n++; dur.push(r.duration);
      const won = r.winner === 'A';
      if (won) w++;
      for (const t of comp) { typeN[t] = (typeN[t] ?? 0) + 1; if (won) typeW[t] = (typeW[t] ?? 0) + 1; }
      for (const t of foe) { typeN[t] = (typeN[t] ?? 0) + 1; if (r.winner === 'B') typeW[t] = (typeW[t] ?? 0) + 1; }
    }
    wins.set(key(comp), { w, n });
  }
  const rows = all.map(c => { const r = wins.get(key(c))!; return { c, p: r.n ? r.w / r.n * 100 : -1, n: r.n }; }).filter(r => r.n > 0).sort((a, b) => b.p - a.p);
  const avg = (x: number[]) => x.length ? x.reduce((s, v) => s + v, 0) / x.length : 0;
  const name = (c: GType[]) => c.map(SHORT).join('·');
  console.log(`\n═══ ${size}대${size} 무리경기 조합표 — 조합 ${all.length}개 × ${N}판 (시드 ${SEED}, 전력 차 ${BAND * size} 이내, 평균 ${avg(dur).toFixed(1)}초)`);
  const show = (list: typeof rows, title: string) => { console.log(`\n${title}`); for (const r of list) console.log(`  ${name(r.c).padEnd(size === 2 ? 8 : 12)} ${r.p.toFixed(1).padStart(5)}%  (${r.n}판)`); };
  show(rows.slice(0, 12), '가장 센 조합');
  show(rows.slice(-12).reverse(), '가장 약한 조합');
  const pct = TYPES.map(t => (typeW[t] ?? 0) / (typeN[t] ?? 1) * 100);
  console.log('\n유형'.padEnd(14), '그 유형이 든 팀 승률');
  TYPES.forEach((t, i) => console.log(TYPE_KO[t].padEnd(13), `${pct[i].toFixed(1)}%`.padStart(8)));
  console.log(`\n조합 폭 ${(rows[0].p - rows[rows.length - 1].p).toFixed(1)}%p (${name(rows[0].c)} ${rows[0].p.toFixed(1)}% ~ ${name(rows[rows.length - 1].c)} ${rows[rows.length - 1].p.toFixed(1)}%)`);
  console.log(`유형 폭 ${(Math.max(...pct) - Math.min(...pct)).toFixed(1)}%p (목표 10 이하)`);
}

if (SIZE === 0) { run(2); run(3); } else run(SIZE);
