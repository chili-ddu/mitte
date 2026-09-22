import type { Contract, GType, HostKind, Gladiator } from './types.js';
import { Rng } from './rng.js';
import { CONFIG } from './config.js';
import { makeGladiator } from './gladiator.js';
import { pickElite, applyQuality, rivalTraits, type Rival, type RivalProfile } from './rivals.js';
import { partnersOf } from './classic.js';
import { teamPower, powerOf } from './gladiator.js';

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

// 난이도 분포: 내 로스터 전력을 기준으로 약·중·중·강 (계약 3개면 약·중·강, 2개면 중·강). 목표 = 내 검투사 평균 전력 × 인원 × 비율
export type Difficulty = 'weak' | 'even' | 'strong';
const DIST: Record<number, Difficulty[]> = { 2: ['even', 'strong'], 3: ['weak', 'even', 'strong'], 4: ['weak', 'even', 'even', 'strong'] };
const PROFILE_OF_TIER: Record<number, RivalProfile> = { 1: 'local', 2: 'major', 3: 'grand' }; // 등급 1 은 지방 파밀리아, 2 는 큰 루두스, 3 은 최대 루두스의 명단에서 (2026-09-22 사용자: 상대는 내 전력이 아니라 세상의 것)
/* 파밀리아 명단에서 size 명 조합을 전력 순으로 늘어놓고 약·중·강 = 아래·가운데·위 셋째에서 하나 (2026-09-22). 내 전력에 맞추지 않는다 — 지방 파밀리아는 약하고, 명성이 올라 나타난 루두스는 세다 */
function comboByDiff(rng: Rng, pool: Gladiator[], size: number, diff: Difficulty): Gladiator[] | null {
  if (pool.length < size) return null; const all: Gladiator[][] = [];
  const rec = (start: number, cur: Gladiator[]) => { if (cur.length === size) { all.push([...cur]); return; } for (let i = start; i < pool.length; i++) { cur.push(pool[i]); rec(i + 1, cur); cur.pop(); } };
  rec(0, []); all.sort((a, b) => teamPower(a) - teamPower(b)); const n = all.length, third = Math.max(1, Math.floor(n / 3));
  const lo = diff === 'weak' ? 0 : diff === 'even' ? third : Math.max(0, n - third), hi = diff === 'weak' ? third : diff === 'even' ? Math.max(third + 1, n - third) : n;
  return all[rng.int(lo, Math.max(lo, hi - 1))];
}
export function offerContracts(rng: Rng, season: number, fame: number, rivals: Rival[] = [], roster: Gladiator[] = []): Contract[] {
  const n = rng.int(2, 4); // 1대1 위주라 계약 수를 늘려 시즌 총 출전 자리를 유지
  const out: Contract[] = [];
  const mine = roster.filter(g => g.alive && g.status !== 'doctor'); const ref = mine.length ? teamPower(mine) / mine.length : 0; // 내 검투사 한 명의 평균 전력 (없으면 옛 방식)
  const CD = CONFIG.contractDiff; const dist = [...DIST[n]].map(d => season <= 2 && d === 'strong' ? 'even' : season >= CD.lateFrom && d === 'weak' && rng.chance(CD.lateWeakToStrong) ? 'strong' : d).sort(() => rng.next() - 0.5); // 순서는 섞는다. 첫 두 시즌은 강한 상대 없음, 후반엔 약한 계약이 강한 계약으로 바뀌기도
  for (let i = 0; i < n; i++) {
    // 시즌이 갈수록, 호감도가 높을수록 상위 등급
    let tier: 1 | 2 | 3 = 1;
    if (season >= 3 && fame >= CONFIG.fameTierReq[2] && rng.chance(0.3 + season * 0.04)) tier = 2; // 첫 두 시즌은 등급 1만
    if (fame >= CONFIG.fameTierReq[3] && rng.chance(0.3)) tier = 3;
    while (tier < 3 && ref > CONFIG.tierPowerCap[tier] * CONFIG.tierGraduate && fame >= CONFIG.fameTierReq[tier + 1]) tier = (tier + 1) as 1 | 2 | 3; // 졸업 판정은 으뜸이 아니라 평균으로 — 으뜸 기준이면 새로 산 검투사를 키울 하위 경기가 사라진다(사용자) // 졸업: 상한을 추월한 등급은 더 이상 나를 부르지 않는다
    const host: HostKind = rng.pick(HOSTS_BY_TIER[tier]);
    const strength = 0.75 + season * 0.03 + (tier - 1) * 0.15; // 적 강도
    const cap = CONFIG.tierPowerCap[tier]; // 등급별 상대 전력 상한: 시골 경기장에 단련된 베테라누스는 나오지 않는다. 내 편은 제한 없음 // 상한: 등급별 고정값과 내 으뜸 검투사의 비율 중 큰 쪽 // 등급별 상대 전력 상한: 시골 경기장에 단련된 베테라누스는 나오지 않는다. 내 편은 제한 없음
    const fits = (g: Gladiator) => powerOf(g) <= cap;
    const size: 1 | 2 | 3 = tier === 1 ? rng.pick([1, 1, 1, 1, 2, 2] as const) : tier === 2 ? rng.pick([1, 1, 2, 2, 3] as const) : rng.pick([2, 3, 3] as const); // 고증: 무누스의 기본은 1대1 결투(파리아). 집단전은 대형 경기에만
    const capped = (make: () => Gladiator, type?: GType) => { for (let k = 0; k < 12; k++) { const g = make(); if (fits(g)) return g; } for (let k = 0; k < 12; k++) { const g = makeGladiator(rng, 'tiro', { season, type }); if (fits(g)) return g; } return make(); }; /* 정식 대결은 유형을 지켜야 하므로 티로 대체도 같은 유형으로 */ // 상한 안에 드는 검투사가 나올 때까지 (베테라누스가 안 들어가면 티로로)
    // 정식 대결(2026-09-18): 주최자가 짝을 주문한다. 우리 로스터에서 유형을 고르고 그 짝을 상대로 세운다 — 생성 시점엔 늘 채울 수 있다 (docs/08 4-6·10-1 ⑧)
    const ofTier = rivals.filter(rv => rv.profile === PROFILE_OF_TIER[tier]); const order = [...(ofTier.length ? ofTier : rivals)].sort(() => rng.next() - 0.5); // 등급에 맞는 파밀리아가 있으면 거기서만 — 없으면(아직 안 나타남) 아무 파밀리아
    const classicMul = order[0] && rivalTraits(order[0]).includes('classic') ? 2 : 1; /* 정식 대결 선호 파밀리아 */
    const needVets = tier === 3 ? size : tier === 2 ? 1 : 0; const classic = mine.length >= size && mine.filter(g => g.rank === 'veteranus').length >= needVets && rng.chance((CONFIG.classicContract.chance[tier] ?? 0) * classicMul); // 티로만 있는 로스터에 베테라누스 조건이 붙는 정식 대결을 내지 않는다 (09-21: 시작이 티로 둘이 되며 드러남)
    const wantEnemy: GType[] = []; if (classic) { const pool = [...mine].sort(() => rng.next() - 0.5).slice(0, size); for (const g of pool) wantEnemy.push(rng.pick(partnersOf(g.type))); }
    let rivalId: number | undefined; let enemy: Gladiator[] | null = null;
    const diff = dist[i]; const quality = CONFIG.rivals.quality[PROFILE_OF_TIER[tier]];
    const foreign = i === n - 1 && rng.chance(CONFIG.foreign.chance); // 마지막 자리는 15% 로 타지 흥행: 파밀리아 대신 타지 라니스타의 검투사 (이벤트, 2026-09-22 사용자)
    if (foreign) { /* 파밀리아를 거치지 않는다 */ }
    else if (classic && rivals.length) { // 주문한 유형이 있는 파밀리아에서 먼저 — 없으면 타지 라니스타에게서 빌려 온다 (지방 무누스는 여러 라니스타의 검투사를 섞어 세웠다)
      for (const rv of order) { const rest = rv.roster.filter(g => g.alive && g.injured === 0 && fits(g)).sort((a, b) => diff === 'strong' ? powerOf(b) - powerOf(a) : diff === 'weak' ? powerOf(a) - powerOf(b) : rng.next() - 0.5); const pick: Gladiator[] = [];
        for (const w of wantEnemy) { const k = rest.findIndex(g => g.type === w); if (k < 0) break; pick.push(rest[k]); rest.splice(k, 1); }
        if (pick.length === size) { enemy = pick; rivalId = rv.id; break; } } // 주문한 유형을 다 갖춘 첫 파밀리아. 강한 계약이면 그 유형 중 센 쪽, 약한 계약이면 약한 쪽
    }
    else if (rivals.length) { for (const rv of order) { const combo = comboByDiff(rng, rv.roster.filter(g => g.alive && g.injured === 0 && fits(g)), size, diff); if (combo) { enemy = combo; rivalId = rv.id; break; } } }
    if (!enemy && classic) enemy = wantEnemy.map(w => capped(() => makeGladiator(rng, diff === 'strong' ? 'veteranus' : diff === 'even' ? (rng.chance(0.5) ? 'veteranus' : 'tiro') : 'tiro', { season, type: w }), w)); // 주문한 유형 그대로
    if (!enemy) enemy = Array.from({ length: size }, () => capped(() => { // 타지 라니스타의 검투사: 서열로만 난이도를 맞춘다 (약 = 형 선고자 티로 · 중 = 티로/베테라누스 반반 · 강 = 베테라누스). 능력치를 따로 깎거나 올리지 않는다. 등급 상한 안에서
      if (ref <= 0) return makeGladiator(rng, rng.chance(Math.min(0.8, strength - 0.6)) ? 'veteranus' : 'tiro', { season });
      if (diff === 'strong') return makeGladiator(rng, 'veteranus', { season });
      if (diff === 'even') return makeGladiator(rng, rng.chance(0.5) ? 'veteranus' : 'tiro', { season });
      const g = makeGladiator(rng, 'tiro'); const O = CONFIG.origins.damnatus; g.origin = 'damnatus'; g.base.atk = Math.max(1, g.base.atk + O.stat); g.base.def = Math.max(0, g.base.def + O.stat); if (g.cap) { g.cap.atk = Math.max(g.base.atk, g.cap.atk + O.stat); g.cap.def = Math.max(g.base.def, g.cap.def + O.stat); } return g; // 고증: 형 선고자(담나티 아드 루둠)는 훈련이 짧은 값싼 싸움꾼이었다
    }));
    if (!rivalId) for (const e of enemy) applyQuality(e, quality); // 타지 라니스타의 검투사도 그 등급 세상의 품질로 (지방 무누스는 ×0.9)
    const enemyPreview: GType[] = enemy.map(e => e.type); // 에딕타(경기 광고)에 짝이 전부 실렸듯 상대는 공개
    out.push({ id: cid++, tier, venue: rng.pick(VENUES[tier]), host, needVeterans: tier === 3 ? size : tier === 2 ? 1 : 0, /* 등급 3(로마)은 티로를 세우지 않는다 — 리벨루스에 이름을 파는 경기다 (2026-09-17 사용자) */ powerCap: Number.isFinite(cap) ? cap : undefined, size, enemy, enemyPreview, rivalId, foreign: foreign || undefined, classic: classic || undefined, clauses: offerClauses(rng, host, tier), accepted: [] });
  }
  // 매 시즌 등급 1 계약이 최소 하나는 있어야 한다 (베테라누스 없는 루두스가 한 시즌을 날리지 않도록)
  if (!out.some(c => c.tier === 1)) { out[0].tier = 1; out[0].venue = rng.pick(VENUES[1]); out[0].needVeterans = 0; } // (등급을 내려도 상대·상한은 그대로: 이미 뽑힌 상대를 다시 뽑지 않는다)
  return out;
}

// 도전 계약(docs/10): 파밀리아가 간판·정예를 세운다. 우리 전력과 무관하고 상한이 없다. tier 는 파밀리아의 격
export function makeChallenge(rng: Rng, _season: number, rival: Rival, dir: 'in' | 'out', size: 1 | 2 | 3): Contract | null {
  const enemy = pickElite(rival, size); if (!enemy) return null;
  const tier: 1 | 2 | 3 = rival.profile === 'grand' ? 3 : rival.profile === 'major' ? 2 : 1;
  return { id: cid++, tier, venue: rng.pick(VENUES[tier]), host: rng.pick(HOSTS_BY_TIER[tier]), needVeterans: 0, size, enemy, enemyPreview: enemy.map(e => e.type), rivalId: rival.id, challenge: dir, clauses: [], accepted: [] };
}
export const challengeSize = (rival: Rival): 1 | 2 | 3 => ((rival.mood ?? 0) >= 2 ? 3 : (rival.mood ?? 0) >= 1 ? 2 : 1); // 기세가 좋을수록 큰 판을 건다 (간판 1대1이 기본)
