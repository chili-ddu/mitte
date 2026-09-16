// 장비가 만드는 상성을 말로 옮긴다. 상성표는 없다(2026-09-11 제거) — 여기 문장은 전부 장비·유형 데이터에서 그때그때 만들어지므로 규칙을 고치면 문구도 따라 바뀐다.
// 편성 화면이 "이번 상대에게 무엇이 걸리는가"를 한 줄씩 보여주는 데 쓴다.
import type { Gladiator } from './types.js';
import { MAIN_HAND, OFF_HAND, TYPE_TRAIT, equipOf } from './equipment.js';
import { effectiveStats } from './gladiator.js';

export interface MatchupNote { ko: string; good: boolean } // good: 우리에게 유리한 이야기

const BIG_SHIELD = 0.4;   // 이 이상이면 '큰 방패'
const PIERCE = 0.6;       // 이 이하면 '방패를 넘기는 무기'
const SLOW = 4;           // 이 이하면 '느리다'
const BARE_HEAD = 1.3;    // critTaken 이 이 이상이면 '투구가 없다'

const has = (team: Gladiator[], f: (g: Gladiator) => boolean) => team.some(f);
const nameOf = (team: Gladiator[], f: (g: Gladiator) => boolean) => team.find(f)?.name.replace('(적)', '') ?? '';

export function matchupNotes(team: Gladiator[], enemy: Gladiator[]): MatchupNote[] {
  if (!enemy.length) return [];
  const out: MatchupNote[] = [];
  const bigShield = (g: Gladiator) => (OFF_HAND[equipOf(g.type).off].block ?? 0) >= BIG_SHIELD;
  const pierces = (g: Gladiator) => (MAIN_HAND[equipOf(g.type).main].shieldPierce ?? 1) <= PIERCE;
  const nets = (g: Gladiator) => OFF_HAND[equipOf(g.type).off].skill === 'bind';
  const slow = (g: Gladiator) => effectiveStats(g).spd <= SLOW;
  const reach = (g: Gladiator) => equipOf(g.type).main === 'spear' || equipOf(g.type).main === 'trident';
  const melee = (g: Gladiator) => !reach(g);
  const bareLegs = (g: Gladiator) => TYPE_TRAIT[g.type].greaves === 0;
  const bareHead = (g: Gladiator) => TYPE_TRAIT[g.type].critTaken >= BARE_HEAD;

  if (!team.length) { // 아직 아무도 배정하지 않았다: 상대 쪽 사실만 일러 준다 (누구를 고를지 정하는 데 쓰라고)
    const out0: MatchupNote[] = [];
    if (has(enemy, bigShield)) out0.push({ ko: '상대는 큰 방패를 든다 — 곡도가 넘긴다', good: true });
    if (has(enemy, pierces)) out0.push({ ko: '상대는 곡도를 든다 — 방패가 덜 막는다', good: false });
    if (has(enemy, nets)) out0.push({ ko: '상대는 그물을 던진다 — 느린 검투사는 걸린다', good: false });
    if (has(enemy, reach)) out0.push({ ko: '상대는 창을 든다 — 품 안까지 파고들어야 한다', good: false });
    if (has(enemy, bareLegs)) out0.push({ ko: '상대는 정강이받이가 없다 — 다리가 열린다', good: true });
    if (has(enemy, bareHead)) out0.push({ ko: '상대는 투구가 없다 — 치명타가 잘 난다', good: true });
    return out0;
  }
  // 방패와 곡도
  if (has(enemy, bigShield) && has(team, pierces)) out.push({ ko: `${nameOf(team, pierces)}의 곡도가 상대의 큰 방패를 넘는다`, good: true });
  if (has(team, bigShield) && has(enemy, pierces)) out.push({ ko: '상대의 곡도가 우리 방패를 넘는다', good: false });
  // 그물
  if (has(enemy, nets) && has(team, slow)) out.push({ ko: `${nameOf(team, slow)}은(는) 느려 그물에 걸리기 쉽다`, good: false });
  if (has(team, nets) && has(enemy, slow)) out.push({ ko: '상대가 느려 그물이 잘 걸린다', good: true });
  if (has(enemy, nets) && !has(team, slow)) out.push({ ko: '우리가 빨라 그물을 피하기 쉽다', good: true });
  // 다리
  if (has(enemy, bareLegs) && has(team, melee)) out.push({ ko: '상대는 정강이받이가 없다 — 다리를 노릴 수 있다', good: true });
  if (has(team, bareLegs) && has(enemy, melee)) out.push({ ko: `${nameOf(team, bareLegs)}은(는) 다리가 비어 있다`, good: false });
  // 사거리
  if (has(enemy, reach) && has(team, melee)) out.push({ ko: '상대의 창을 품 안까지 파고들어야 한다', good: false });
  if (has(team, reach) && has(enemy, melee)) out.push({ ko: '우리 창이 들어오는 길목을 먼저 찌른다', good: true });
  // 투구
  if (has(enemy, bareHead)) out.push({ ko: '상대는 투구가 없어 치명타가 잘 난다', good: true });
  if (has(team, bareHead)) out.push({ ko: `${nameOf(team, bareHead)}은(는) 투구가 없다`, good: false });
  return out;
}
