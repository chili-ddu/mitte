// 장비 수치·딕타타가 만드는 상성을 말로 옮긴다 (2026-09-18 유형 정리로 되살림 — 사거리·막기·그물·올가미·추격만. 값은 classes.ts / dictata.ts 에서 읽는다)
// 편성 화면(plan.ts)이 "이번 상대에게 무엇이 걸리는가"를 한 줄씩 보여주고, 전력 표시(gladiator.ts matchupFactor)는 matchupOwner 로 누구 전력을 움직일지 정한다.
import type { Gladiator, GType } from './types.js';
import { rangeOf, blockOf } from './classes.js';
import { hasDictata } from './dictata.js';
import { effectiveStats } from './gladiator.js';

export interface MatchupNote { ko: string; good: boolean } // good: 우리에게 유리한 이야기
const SLOW = 4; // 이 이하면 '느리다' (그물에 잘 걸린다)
const has = (team: Gladiator[], f: (g: Gladiator) => boolean) => team.some(f);
const nameOf = (team: Gladiator[], f: (g: Gladiator) => boolean) => team.find(f)?.name.replace('(적)', '') ?? '';
const nets = (g: Gladiator) => hasDictata(g.type, 'net') || hasDictata(g.type, 'lasso');
const reach = (g: Gladiator) => rangeOf(g.type) >= 2;
const bigShield = (g: Gladiator) => blockOf(g.type) >= 0.5;
const slow = (g: Gladiator) => effectiveStats(g).spd <= SLOW;
const pursuer = (g: Gladiator) => hasDictata(g.type, 'pursue');

export function matchupNotes(team: Gladiator[], enemy: Gladiator[]): MatchupNote[] {
  if (!enemy.length) return [];
  const out: MatchupNote[] = [];
  if (!team.length) { // 아직 아무도 배정하지 않았다: 상대 쪽 사실만 일러 준다
    if (has(enemy, nets)) out.push({ ko: '상대는 그물을 던진다 — 느린 검투사는 걸린다', good: false });
    if (has(enemy, reach)) out.push({ ko: '상대는 창을 든다 — 들어가는 길목을 먼저 찌른다', good: false });
    if (has(enemy, bigShield)) out.push({ ko: '상대는 큰 방패를 든다 — 곡도가 넘긴다', good: true });
    return out;
  }
  if (has(enemy, nets) && has(team, slow)) out.push({ ko: `${nameOf(team, slow)}은(는) 느려 그물에 걸리기 쉽다`, good: false });
  if (has(team, nets) && has(enemy, slow)) out.push({ ko: '상대가 느려 그물이 잘 걸린다', good: true });
  if (has(enemy, reach) && !has(team, reach)) out.push({ ko: '상대의 창이 들어오는 길목을 먼저 찌른다', good: false });
  if (has(team, reach) && !has(enemy, reach)) out.push({ ko: '우리 창이 들어오는 길목을 먼저 찌른다', good: true });
  if (has(team, pursuer) && has(enemy, reach)) out.push({ ko: `${nameOf(team, pursuer)}이(가) 창 든 상대를 쫓아 세게 친다`, good: true });
  if (has(enemy, pursuer) && has(team, reach)) out.push({ ko: '상대 세쿠토르가 우리 창을 쫓는다', good: false });
  return out;
}
// 이 짝의 기울기를 누구 탓으로 볼 것인가 — 한 번의 배정에 한쪽만 움직이게. 그물 → 사거리 → 추격 → 큰 방패 순으로 먼저 걸리는 쪽이 임자
export function matchupOwner(a: GType, b: GType): GType {
  const net = (t: GType) => hasDictata(t, 'net') || hasDictata(t, 'lasso');
  const rng = (t: GType) => rangeOf(t) >= 2;
  const pur = (t: GType) => hasDictata(t, 'pursue');
  const big = (t: GType) => blockOf(t) >= 0.5;
  for (const f of [net, rng, pur, big]) { const x = f(a), y = f(b); if (x !== y) return x ? a : b; }
  return a;
}
