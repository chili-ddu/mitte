import type { Contract, GType, HostKind, Gladiator } from './types.js';
import { Rng } from './rng.js';
import { CONFIG } from './config.js';
import { makeGladiator } from './gladiator.js';
import { pickEnemies, type Rival } from './rivals.js';

const VENUES: Record<number, string[]> = {
  1: ['놀라 목조 경기장', '누케리아 목조 경기장', '헤르쿨라네움 광장'],
  2: ['폼페이 경기장', '카푸아 경기장', '푸테올리 경기장'],
  3: ['베로나 경기장', '카르타고 경기장'],
};
const HOSTS: HostKind[] = ['merciful', 'normal', 'normal', 'bloody'];
export const HOST_KO: Record<HostKind, string> = { merciful: '자비로운 주최자', normal: '보통 주최자', bloody: '피를 원하는 주최자' };

let cid = 1;
export function resetContractIds() { cid = 1; }

export function offerContracts(rng: Rng, season: number, fame: number, rivals: Rival[] = []): Contract[] {
  const n = rng.int(2, 4); // 1대1 위주라 계약 수를 늘려 시즌 총 출전 자리를 유지
  const out: Contract[] = [];
  for (let i = 0; i < n; i++) {
    // 시즌이 갈수록, 호감도가 높을수록 상위 등급
    let tier: 1 | 2 | 3 = 1;
    if (season >= 2 && fame >= CONFIG.fameTierReq[2] && rng.chance(0.3 + season * 0.04)) tier = 2; // 첫 시즌은 등급 1만
    if (fame >= CONFIG.fameTierReq[3] && rng.chance(0.3)) tier = 3;
    const host = rng.pick(HOSTS);
    const strength = 0.75 + season * 0.03 + (tier - 1) * 0.15; // 적 강도
    const size: 1 | 2 | 3 = tier === 1 ? rng.pick([1, 1, 1, 1, 2, 2] as const) : tier === 2 ? rng.pick([1, 1, 2, 2, 3] as const) : rng.pick([2, 3, 3] as const); // 고증: 무누스의 기본은 1대1 결투(파리아). 집단전은 대형 경기에만
    // 상대: 파밀리아 중 하나에서 뽑는다 (부족하면 떠돌이 검투사단)
    let rivalId: number | undefined; let enemy: Gladiator[] | null = null;
    if (rivals.length) { const order = [...rivals].sort(() => rng.next() - 0.5); for (const rv of order) { enemy = pickEnemies(rng, rv, size); if (enemy) { rivalId = rv.id; break; } } }
    if (!enemy) enemy = Array.from({ length: size }, () => makeGladiator(rng, rng.chance(Math.min(0.8, strength - 0.6)) ? 'veteranus' : 'tiro'));
    const enemyPreview: GType[] = enemy.map(e => e.type); // 에딕타(경기 광고)에 짝이 전부 실렸듯 상대는 공개
    out.push({ id: cid++, tier, venue: rng.pick(VENUES[tier]), host, needVeterans: tier >= 2 ? 1 : 0, size, enemy, enemyPreview, rivalId });
  }
  // 매 시즌 등급 1 계약이 최소 하나는 있어야 한다 (베테라누스 없는 루두스가 한 시즌을 날리지 않도록)
  if (!out.some(c => c.tier === 1)) { out[0].tier = 1; out[0].venue = rng.pick(VENUES[1]); out[0].needVeterans = 0; }
  return out;
}
