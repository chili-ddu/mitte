import type { Contract, GType, HostKind, Gladiator } from './types.js';
import { Rng } from './rng.js';
import { CONFIG } from './config.js';
import { makeGladiator } from './gladiator.js';
import { pickEnemies, rivalDef, dojoOrder, kindOf, type Rival } from './rivals.js';
import { teamPower } from './gladiator.js';

const VENUES: Record<number, string[]> = {
  1: ['놀라 목조 경기장', '누케리아 목조 경기장', '헤르쿨라네움 광장'],
  2: ['폼페이 경기장', '카푸아 경기장', '푸테올리 경기장'],
  3: ['로마 콜로세움', '베로나 경기장', '카르타고 경기장'],
};
import { HOST, HOSTS_BY_TIER } from './hosts.js';
import { offerClauses } from './clauses.js';
export const HOST_KO: Record<HostKind, string> = Object.fromEntries(Object.entries(HOST).map(([k, v]) => [k, v.ko])) as Record<HostKind, string>;

let cid = 1;
export function resetContractIds() { cid = 1; }
export function nextContractId() { return cid++; }
export function venueFor(rng: Rng, tier: 1 | 2 | 3) { return rng.pick(VENUES[tier]); }

// 난이도 분포: 내 로스터 전력을 기준으로 약·중·중·강 (계약 3개면 약·중·강, 2개면 중·강). 목표 = 내 검투사 평균 전력 × 인원 × 비율
export type Difficulty = 'weak' | 'even' | 'strong';
const DIFF_RATIO = (): Record<Difficulty, number> => CONFIG.contractDiff.ratio; // 설정값 (밸런스 스윕용)
const DIST: Record<number, Difficulty[]> = { 2: ['even', 'strong'], 3: ['weak', 'even', 'strong'], 4: ['weak', 'even', 'even', 'strong'] };
// 파밀리아에서 목표 전력에 가장 가까운 조합 (조합 수가 작아 전부 본다). 보정은 없다: 있는 검투사 그대로
function closestCombo(pool: Gladiator[], size: number, target: number): Gladiator[] | null {
  if (pool.length < size) return null; let best: Gladiator[] | null = null, bd = Infinity;
  const rec = (start: number, cur: Gladiator[]) => { if (cur.length === size) { const d = Math.abs(teamPower(cur) - target); if (d < bd) { bd = d; best = [...cur]; } return; } for (let i = start; i < pool.length; i++) { cur.push(pool[i]); rec(i + 1, cur); cur.pop(); } };
  rec(0, []); return best;
}
// 지금 도장(졸업 전인 파밀리아 중 순서가 앞선 집)의 조합: 아직 못 꺾은 사람이 많이 든 조합을 목표 전력 +30% 아래에서 고른다 (약한 쪽은 제한 없음: 내 로스터가 커져도 그 집의 남은 사람을 만나야 졸업이 된다. 승률은 소속의 서열 비율로 잡는다). 일반 계약이 도장 진행을 끌고 가게 한다
function dojoCombo(pool: Gladiator[], size: number, target: number): Gladiator[] | null {
  if (pool.length < size) return null; let best: Gladiator[] | null = null, bu = -1, bd = Infinity;
  const rec = (start: number, cur: Gladiator[]) => { if (cur.length === size) { const d = Math.abs(teamPower(cur) - target); if (teamPower(cur) > target * 1.3) return; const u = cur.filter(g => !(g.lostToMe ?? 0)).length; if (u > bu || (u === bu && d < bd)) { bu = u; bd = d; best = [...cur]; } return; } for (let i = start; i < pool.length; i++) { cur.push(pool[i]); rec(i + 1, cur); cur.pop(); } };
  rec(0, []); return bu > 0 ? best : null; // 못 꺾은 사람이 하나도 없으면 도장 우선은 의미 없다
}
export function offerContracts(rng: Rng, season: number, fame: number, rivals: Rival[] = [], roster: Gladiator[] = []): Contract[] {
  const dojo = rivals.filter(r => !r.graduated && rivalDef(r) && kindOf(rivalDef(r)!) === 'main').sort((a, b) => dojoOrder(a) - dojoOrder(b))[0]; let dojoUsed = 0; // 시즌당 도장 우선 계약 최대 2건 (메인만)
  const pool = rivals.filter(r => { const d = rivalDef(r); return !(r.graduated && d && kindOf(d) !== 'main'); }); // 졸업한 서브는 계약이 끊긴다 (메인은 졸업 뒤에도 계약 공급원)
  const n = rng.int(2, 4); // 1대1 위주라 계약 수를 늘려 시즌 총 출전 자리를 유지
  const out: Contract[] = [];
  const mine = roster.filter(g => g.alive && g.status !== 'doctor'); const ref = mine.length ? teamPower(mine) / mine.length : 0; // 내 검투사 한 명의 평균 전력 (없으면 옛 방식)
  const CD = CONFIG.contractDiff; const dist = [...DIST[n]].map(d => season <= 2 && d === 'strong' ? 'even' : season >= CD.lateFrom && d === 'weak' && rng.chance(CD.lateWeakToStrong) ? 'strong' : d).sort(() => rng.next() - 0.5); // 순서는 섞는다. 첫 두 시즌은 강한 상대 없음, 후반엔 약한 계약이 강한 계약으로 바뀌기도
  for (let i = 0; i < n; i++) {
    // 시즌이 갈수록, 호감도가 높을수록 상위 등급
    let tier: 1 | 2 | 3 = 1;
    if (season >= 3 && fame >= CONFIG.fameTierReq[2] && rng.chance(0.3 + season * 0.04)) tier = 2; // 첫 두 시즌은 등급 1만
    if (fame >= CONFIG.fameTierReq[3] && rng.chance(0.3)) tier = 3;
    const host: HostKind = rng.pick(HOSTS_BY_TIER[tier]);
    const strength = 0.75 + season * 0.03 + (tier - 1) * 0.15; // 적 강도
    const size: 1 | 2 | 3 = tier === 1 ? rng.pick([1, 1, 1, 1, 2, 2] as const) : tier === 2 ? rng.pick([1, 1, 2, 2, 3] as const) : rng.pick([2, 3, 3] as const); // 고증: 무누스의 기본은 1대1 결투(파리아). 집단전은 대형 경기에만
    // 상대: 파밀리아 중 하나에서 뽑는다 (맞는 조합이 없으면 타지 라니스타의 검투사)
    let rivalId: number | undefined; let enemy: Gladiator[] | null = null;
    const diff = dist[i]; const target = ref * size * DIFF_RATIO()[diff];
    if (rivals.length) {
      if (ref > 0 && dojo && dojoUsed < 2) { const combo = dojoCombo(dojo.roster.filter(g => g.alive && g.injured === 0 && g.id !== dojo.starId && !g.pledged), size, target); if (combo) { enemy = combo; rivalId = dojo.id; dojoUsed++; } }
      if (enemy) { /* 도장 우선 */ }
      else if (ref > 0) { let bd = Infinity; for (const rv of pool) { const combo = closestCombo(rv.roster.filter(g => g.alive && g.injured === 0 && g.id !== rv.starId && !g.pledged), size, target); /* 간판은 졸업전에서만 만난다 */ if (!combo) continue; const d = Math.abs(teamPower(combo) - target); if (d < bd) { bd = d; enemy = combo; rivalId = rv.id; } }
        if (enemy && bd > target * 0.15) { enemy = null; rivalId = undefined; } } // 목표에 가장 가까운 파밀리아 조합. 15% 넘게 벗어나면 파밀리아 밖에서 (주최자가 다른 라니스타에게서 빌려 온 검투사 — 고증: 지방 무누스는 여러 라니스타의 검투사를 섞어 세웠다)
      else { const order = [...pool].sort(() => rng.next() - 0.5); for (const rv of order) { enemy = pickEnemies(rng, rv, size); if (enemy) { rivalId = rv.id; break; } } }
    }
    if (!enemy) enemy = Array.from({ length: size }, () => { // 타지 라니스타의 검투사: 서열로만 난이도를 맞춘다 (약 = 형 선고자 티로 · 중 = 티로/베테라누스 반반 · 강 = 베테라누스). 능력치를 따로 깎거나 올리지 않는다
      if (ref <= 0) return makeGladiator(rng, rng.chance(Math.min(0.8, strength - 0.6)) ? 'veteranus' : 'tiro', { season });
      if (diff === 'strong') return makeGladiator(rng, 'veteranus', { season });
      if (diff === 'even') return makeGladiator(rng, rng.chance(0.5) ? 'veteranus' : 'tiro', { season });
      const g = makeGladiator(rng, 'tiro'); const O = CONFIG.origins.damnatus; g.origin = 'damnatus'; g.base.atk = Math.max(1, g.base.atk + O.stat); g.base.def = Math.max(0, g.base.def + O.stat); return g; // 고증: 형 선고자(담나티 아드 루둠)는 훈련이 짧은 값싼 싸움꾼이었다
    });
    const enemyPreview: GType[] = enemy.map(e => e.type); // 에딕타(경기 광고)에 짝이 전부 실렸듯 상대는 공개
    const rvd = rivalId != null ? rivalDef({ id: rivalId } as Rival) : undefined; const clauses = rvd && kindOf(rvd) === 'damnati' ? ['sine_missione' as const, ...offerClauses(rng, host, tier).filter(x => x !== 'sine_missione')].slice(0, 2) : offerClauses(rng, host, tier); // 죄수단 경기는 시네 미시오네를 내건다
    out.push({ id: cid++, tier, venue: rng.pick(VENUES[tier]), host, needVeterans: tier >= 2 ? 1 : 0, size, enemy, enemyPreview, rivalId, clauses, accepted: [] });
  }
  // 매 시즌 등급 1 계약이 최소 하나는 있어야 한다 (베테라누스 없는 루두스가 한 시즌을 날리지 않도록)
  if (!out.some(c => c.tier === 1)) { out[0].tier = 1; out[0].venue = rng.pick(VENUES[1]); out[0].needVeterans = 0; }
  return out;
}
