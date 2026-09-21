// 편성 특성 기여 측정: 같은 유형 N명(특성 N단계) vs 서로 다른 유형(1단계), 능력치는 같게 복사. 열 = 특성 없음 / 모두 1단계 고정 / 단계 그대로.
// "기여" = 단계 그대로 − 1단계 고정: 그 클래스의 2·3단계가 집단전에서 얼마나 값어치 있는가. npm run traits:gain [N]
import { Rng } from '../core/rng.js';
import { battle } from '../core/battle.js';
import { makeGladiator, TYPES } from '../core/gladiator.js';
import { noTraits, levelOf, TRAITS, LINEAGES, countTraits, TYPE_TRAITS, TRAIT_KO, type Level } from '../core/traits.js';
import type { GType, Gladiator } from '../core/types.js';
const N = Number(process.argv[2] ?? 400); const rng = new Rng(7);
const clone = (g: Gladiator, t: GType) => { const h = makeGladiator(rng, 'veteranus', { season: 3, type: t }); h.base = { ...g.base, spd: h.base.spd }; return h; };
const capped = (team: Gladiator[], cap: number) => { const c = countTraits(team); const out = noTraits(); for (const t of TRAITS) out.trait[t] = Math.min(cap, levelOf(c.trait[t])) as Level; for (const l of LINEAGES) out.lineage[l] = Math.min(cap, levelOf(c.lineage[l])) as Level; return out; };
function run(size: number, cap: number) {
  return TYPES.map(t => { let w = 0, l = 0;
    for (let i = 0; i < N; i++) { const A: Gladiator[] = [], B: Gladiator[] = []; const others = TYPES.filter(x => x !== t).sort(() => rng.next() - 0.5).slice(0, size);
      for (let k = 0; k < size; k++) { const a = makeGladiator(rng, 'veteranus', { season: 3, type: t }); A.push(a); B.push(clone(a, others[k])); }
      const flip = i % 2 === 1; const X = flip ? B : A, Y = flip ? A : B;
      const r = battle(new Rng(i), X, Y, { traitsA: capped(X, cap), traitsB: capped(Y, cap) });
      if (r.winner === (flip ? 'B' : 'A')) w++; else if (r.winner === (flip ? 'A' : 'B')) l++; }
    return Math.round(w / (w + l) * 100); });
}
for (const size of [2, 3]) { console.log(`\n${size}인전 같은 유형 ${size}명 vs 다른 유형 (능력치 동일, ${N}판) — 없음 / 1단계 고정 / 그대로 / 기여`);
  const c0 = run(size, 0), c1 = run(size, 1), c3 = run(size, 3); TYPES.forEach((t, i) => console.log(t.padEnd(12), `${c0[i]}%`.padStart(5), `${c1[i]}%`.padStart(5), `${c3[i]}%`.padStart(5), `${c3[i] - c1[i] >= 0 ? '+' : ''}${c3[i] - c1[i]}%p`.padStart(6), ' ', TYPE_TRAITS[t].map(x => TRAIT_KO[x]).join('·'))); }
