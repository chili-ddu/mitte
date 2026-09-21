// 전력식 가중치 측정: 거울 대결(같은 유형, 같은 능력치)에서 한쪽만 스탯을 올렸을 때 승률이 얼마나 오르는가. npm run stat:worth [N]
// 결과의 %p 비율이 곧 CONFIG.power 의 비율이다 (공 +1 = 4.5 를 자로).
import { Rng } from '../core/rng.js';
import { battle } from '../core/battle.js';
import { makeGladiator, TYPES } from '../core/gladiator.js';
import type { Gladiator } from '../core/types.js';
const N = Number(process.argv[2] ?? 300); const rng = new Rng(11);
const STEPS: [keyof Gladiator['base'], number][] = [['hp', 10], ['atk', 1], ['def', 1], ['spd', 1], ['hand', 1]];
const gain: Record<string, number> = {};
for (const [stat, step] of STEPS) { let w = 0, n = 0;
  for (const t of TYPES) for (let i = 0; i < N; i++) {
    const a = makeGladiator(rng, 'veteranus', { season: 3, type: t }); const b = makeGladiator(rng, 'veteranus', { season: 3, type: t }); b.base = { ...a.base }; b.base[stat] += step; a.form = 0; b.form = 0; a.scaeva = false; b.scaeva = false;
    const flip = i % 2 === 1; const r = battle(new Rng(i * 7 + t.length), flip ? [b] : [a], flip ? [a] : [b]); if (r.winner === 'draw') continue; n++; if (r.winner === (flip ? 'A' : 'B')) w++; }
  gain[stat] = (w / n - 0.5) * 100; }
const per = { hp: gain.hp / 10, atk: gain.atk, def: gain.def, spd: gain.spd, hand: gain.hand };
console.log('스탯 +1 당 승률 이득 (%p, 거울 대결):', Object.fromEntries(Object.entries(per).map(([k, v]) => [k, +v.toFixed(2)])));
const k = 4.5 / per.atk; console.log('공 4.5 기준 가중치:', Object.fromEntries(Object.entries(per).map(([kk, v]) => [kk, +(v * k).toFixed(2)])));
