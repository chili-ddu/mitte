// 상대 파밀리아: 시즌을 넘어 유지되는 경쟁 검투사단. 계약의 상대는 여기서 뽑히고, 그들도 전적·부상·사망·명예가 쌓인다
import type { Gladiator, GType, Lineage } from './types.js';
import { Rng } from './rng.js';
import { CONFIG } from './config.js';
import { makeGladiator, fitPower, RESERVED_NAMES } from './gladiator.js';
import { CAST, castState, makeFromCast, type CastBook } from './cast.js';
import { eligibleSkills } from './skills.js';

export type RivalProfile = 'local' | 'major' | 'grand'; // 지방 파밀리아 · 큰 루두스 · 최대 루두스
export interface Rival { id: number; name: string; roster: Gladiator[]; vsMe?: { wins: number; losses: number; draws: number }; profile?: RivalProfile; since?: number; starId?: number; secondId?: number; graduated?: number; challengeSince?: number } // vsMe: 그 파밀리아가 나를 상대로 거둔 전적 · since: 나타난 시즌 · starId/secondId: 지정 간판·두 번째 · graduated: 졸업(간판내기 승리) 시즌 · challengeSince: 졸업전이 처음 뜬 시즌
// 고증: 카푸아의 율리우스 루두스(카이사르), 네로의 루두스는 지방 파밀리아보다 훨씬 컸다. 폼페이 경기 광고의 주최자 암플리아투스 가문. 누케리아는 59년 폼페이와 원형경기장 난동을 벌인 앙숙. 카푸아는 검투사 양성의 본산
// 도장깨기(docs/08-campaign.md): 파밀리아는 order 순서로 나타난다 — 앞 집을 졸업(간판내기 승리)해야 다음 집이 온다. 호감도와 무관. 간판·두 번째는 이름·유형이 정해져 있고 간판은 절대 강도(challenge.strength × basePower)
export interface RivalDef {
  id: number; name: string; profile: RivalProfile; desc: string;
  order: number;                 // 도장 순서 1~6
  after?: number;                // 이 id 를 졸업해야 나타난다 (없으면 시작부터)
  star: { name: string; type: GType; lineage: Lineage; honor: number; scaeva?: boolean }; // 지정 간판. 명예로 미시오가 거의 확정되어 사고사만 남는다
  second: { name: string; type: GType; lineage: Lineage };                                // 두 번째: 간판이 빠지면 잇는다
  typeWeights: Partial<Record<GType, number>>;                                             // 소속 4의 유형 경향 (없는 유형은 1)
  challenge: { size: 1 | 2 | 3; strength: number; tier: 1 | 2 | 3 };                      // 졸업전 규모 · 간판 절대 강도 계수 · 계약 등급 (3이면 등급 3 주최자가 있어야 열린다)
  visitor?: boolean;             // 방문단: 오자마자 간판내기를 걸어온다(전원 격파 조건 없음). 이기면 1회차 엔딩(황제 루두스 초청)
}
export const VISITOR_ID = 7;
export const RIVAL_DEFS: RivalDef[] = [
  { id: 4, name: '스카이바 파밀리아', profile: 'local', desc: '이웃 도시의 지방 파밀리아. 왼손잡이 유파', order: 1, star: { name: '알바누스', type: 'murmillo', lineage: 'victory', honor: 40, scaeva: true }, second: { name: '심마쿠스', type: 'thraex', lineage: 'nickname' }, typeWeights: { murmillo: 4, thraex: 4 }, challenge: { size: 1, strength: 0.9, tier: 1 } },
  { id: 2, name: '암플리아투스 파밀리아', profile: 'local', desc: '폼페이의 지방 파밀리아. 광고 벽화의 흥행 가문', order: 2, star: { name: '몬타누스', type: 'retiarius', lineage: 'nature', honor: 50 }, second: { name: '아라킨투스', type: 'secutor', lineage: 'place' }, typeWeights: { retiarius: 4, secutor: 4 }, challenge: { size: 1, strength: 1.0, tier: 1 } },
  { id: 5, name: '누케리아 파밀리아', profile: 'local', desc: '폼페이의 앙숙 누케리아. 방패 없는 거친 유형', order: 3, after: 2, star: { name: '타우루스', type: 'dimachaerus', lineage: 'nature', honor: 60 }, second: { name: '우르수스', type: 'hoplomachus', lineage: 'nature' }, typeWeights: { dimachaerus: 4, hoplomachus: 4 }, challenge: { size: 1, strength: 1.1, tier: 2 } },
  { id: 3, name: '네로니아누스 루두스', profile: 'major', desc: '황실 소유의 큰 루두스. 베테라누스가 많다', order: 4, after: 5, star: { name: '힐라루스', type: 'thraex', lineage: 'victory', honor: 70 }, second: { name: '스피쿨루스', type: 'murmillo', lineage: 'nickname' }, typeWeights: {}, challenge: { size: 1, strength: 1.2, tier: 2 } },
  { id: 6, name: '카푸아 파밀리아', profile: 'major', desc: '검투사 양성의 본산 카푸아. 기술과 독토르', order: 5, after: 3, star: { name: '카스토르', type: 'eques', lineage: 'myth', honor: 80 }, second: { name: '테트라이테스', type: 'provocator', lineage: 'nickname' }, typeWeights: { eques: 4, provocator: 4 }, challenge: { size: 2, strength: 1.3, tier: 3 } },
  { id: 1, name: '율리우스 파밀리아', profile: 'grand', desc: '카푸아의 최대 루두스. 로마 경기의 단골', order: 6, after: 6, star: { name: '오케아누스', type: 'secutor', lineage: 'nature', honor: 90 }, second: { name: '세베루스', type: 'hoplomachus', lineage: 'victory' }, typeWeights: {}, challenge: { size: 3, strength: 1.45, tier: 3 } },
  { id: VISITOR_ID, name: '황제 루두스 방문단', profile: 'grand', desc: '로마 직영 루두스 갈리쿠스의 사절. 동네 짱의 소문을 듣고 왔다. 간판 갈루스를 걸고 3대3 — 이기면 초청장과 갈루스를 얻어 로마로', order: 7, after: 1, star: { name: '갈루스', type: 'murmillo', lineage: 'place', honor: 95 }, second: { name: '브리토', type: 'provocator', lineage: 'place' }, typeWeights: {}, challenge: { size: 3, strength: 1.6, tier: 3 }, visitor: true },
];
for (const d of RIVAL_DEFS) { RESERVED_NAMES.add(d.star.name); RESERVED_NAMES.add(d.second.name); }
const TYPES_ALL: GType[] = ['murmillo', 'secutor', 'thraex', 'retiarius', 'hoplomachus', 'provocator', 'eques', 'dimachaerus'];
function weightedType(rng: Rng, w: Partial<Record<GType, number>>): GType { const total = TYPES_ALL.reduce((a, t) => a + (w[t] ?? 1), 0); let r = rng.next() * total; for (const t of TYPES_ALL) { r -= w[t] ?? 1; if (r < 0) return t; } return TYPES_ALL[TYPES_ALL.length - 1]; }
const ROSTER_SIZE = 6;
const PROFILE = { local: { vet: 0, grow: 0, skills: 0 }, major: { vet: 0.35, grow: 1, skills: 1 }, grand: { vet: 0.6, grow: 2, skills: 1 } }; // 서열 확률 가산 · 공방 가산 · 기술 가산

function strengthAt(season: number, fame = 0) { return 0.75 + season * 0.03 + Math.max(0, fame - 50) * CONFIG.rivalFameGrow; } // 시즌 + 내 명성(50 위로 1점당 0.4%): 이름난 루두스에는 강한 파밀리아가 붙는다
const ORD = ['', ' 세쿤두스', ' 테르티우스', ' 콰르투스', ' 퀸투스'];
function makeMember(rng: Rng, season: number, roster: Gladiator[] = [], profile: RivalProfile = 'local', fame = 0, typeWeights: Partial<Record<GType, number>> = {}): Gladiator {
  const P = PROFILE[profile]; const s = strengthAt(season, fame); const rank = rng.chance(Math.min(0.95, s - 0.6 + P.vet)) ? 'veteranus' : 'tiro';
  const g = makeGladiator(rng, rank, { season, type: weightedType(rng, typeWeights) }); g.boughtSeason = season; // 들어온 시즌 (졸업전 조건: 졸업전이 뜬 뒤 들어온 사람은 제외) if (rank === 'veteranus' && P.grow) { g.base.atk += P.grow; g.base.def += P.grow; }
  // 상대도 시즌을 거치며 훈련한다: 베테라누스 시즌 단련은 makeGladiator(statRoll.vetGrow)에서, 승수·명예도 쌓인 채로 온다 (내 검투사만 자라면 후반 승률이 70%를 넘는다)
  if (rank === 'veteranus') { g.wins = rng.int(3, 3 + Math.min(9, Math.floor(season / 2))); g.fights = g.wins + rng.int(0, 3); g.honor = rng.int(0, Math.min(30, season * 2)); }
  if (rank === 'veteranus') { const n = rng.int(CONFIG.skills.rivalSkillsVet[0], CONFIG.skills.rivalSkillsVet[1]) + P.skills; for (let k = 0; k < n; k++) { const e = eligibleSkills(g); if (!e.length) break; (g.skills ??= []).push(rng.pick(e).id); } } // 상대 베테라누스도 기술을 1~2개 가진다
  const base = g.name; let k = 0; while (roster.some(o => o.name === g.name) && k < ORD.length - 1) { k++; g.name = base + ORD[k]; } // 같은 파밀리아 안에서 이름 겹침 방지
  return g;
}
// 지정 간판: 이름·유형·명예가 정해져 있고 전력은 절대 강도. 승수는 명예에 맞춘다. 두 번째는 간판의 0.85배 전력, 절반 명예
function makeNamed(rng: Rng, season: number, spec: { name: string; type: GType; lineage: Lineage }, honor: number, power: number, profile: RivalProfile, scaeva?: boolean): Gladiator {
  const P = PROFILE[profile]; const C = CONFIG.challenge;
  const g = makeGladiator(rng, 'veteranus', { season, type: spec.type, lineage: spec.lineage, name: spec.name });
  g.honor = honor; g.wins = Math.max(3, Math.round(honor / C.starWinsPerHonor)); g.fights = g.wins + rng.int(0, 3); g.talent = 3; g.talentKnown = true; if (scaeva) g.scaeva = true; g.boughtSeason = season;
  const n = rng.int(CONFIG.skills.rivalSkillsVet[0], CONFIG.skills.rivalSkillsVet[1]) + P.skills; for (let k = 0; k < n; k++) { const e = eligibleSkills(g); if (!e.length) break; (g.skills ??= []).push(rng.pick(e).id); }
  return fitPower(g, power);
}
export function makeStar(rng: Rng, season: number, def: RivalDef): Gladiator { return makeNamed(rng, season, def.star, def.star.honor, CONFIG.challenge.basePower * def.challenge.strength, def.profile, def.star.scaeva); }
export function makeSecond(rng: Rng, season: number, def: RivalDef): Gladiator { return makeNamed(rng, season, def.second, Math.round(def.star.honor * CONFIG.challenge.secondHonorMul), CONFIG.challenge.basePower * def.challenge.strength * CONFIG.challenge.secondPowerMul, def.profile); }
function makeRival(rng: Rng, season: number, def: RivalDef, book?: CastBook): Rival {
  const star = makeStar(rng, season, def), second = makeSecond(rng, season, def);
  const r: Gladiator[] = [star, second];
  if (book) for (const e of CAST.filter(e => e.role === 'member' && e.familia === def.id)) { castState(book, e.id).taken = true; r.push(makeFromCast(e, season, { member: true })); } // 소속 4는 명부에서
  while (r.length < ROSTER_SIZE) r.push(makeMember(rng, season, r, def.profile, 0, def.typeWeights));
  return { id: def.id, name: def.name, roster: r, vsMe: { wins: 0, losses: 0, draws: 0 }, profile: def.profile, since: season, starId: star.id, secondId: second.id };
}
// 간판이 빠지면 두 번째가, 둘 다 없으면 소속 중 명예 최고가 잇는다. 파밀리아는 무너지지 않는다 (해체·자동 졸업으로 두면 간판을 죽이는 게 지름길이 된다)
export function promoteStar(r: Rival) {
  const alive = (id?: number) => id != null && r.roster.some(g => g.id === id && g.alive);
  const best = (skip: (number | undefined)[]) => [...r.roster].filter(g => g.alive && !skip.includes(g.id)).sort((a, b) => ((b.honor ?? 0) - (a.honor ?? 0)) || (b.wins - a.wins))[0];
  if (!alive(r.starId)) { r.starId = alive(r.secondId) ? r.secondId : best([])?.id; if (r.starId === r.secondId) r.secondId = undefined; }
  if (!alive(r.secondId)) r.secondId = best([r.starId])?.id;
}
export const namedCount = (r: Rival) => [r.starId, r.secondId].filter(id => id != null && r.roster.some(g => g.id === id)).length;
// 새 게임: 앞 집이 없는 파밀리아만 (처음엔 지방 둘)
export function makeRivals(rng: Rng, season = 1, book?: CastBook): Rival[] { return RIVAL_DEFS.filter(d => d.after == null).map(d => makeRival(rng, season, d, book)); }
// 시즌 시작: 앞 집을 졸업했으면 다음 집이 이 지방에 나타난다 (도장 사슬). 돌아온 목록 = 이번에 나타난 파밀리아
export function arriveRivals(rng: Rng, rivals: Rival[], season: number, book?: CastBook): Rival[] {
  const out: Rival[] = [];
  for (const d of RIVAL_DEFS) { if (rivals.some(r => r.id === d.id)) continue; const prev = d.after == null ? undefined : rivals.find(r => r.id === d.after); if (d.after == null || prev?.graduated) { const r = makeRival(rng, season, d, book); rivals.push(r); out.push(r); } }
  return out;
}
export const rivalDef = (r: Rival): RivalDef | undefined => RIVAL_DEFS.find(d => d.id === r.id);
// 시즌마다: 부상 회복, 빈자리 보충, 봄에는 나이
export function replenishRivals(rng: Rng, rivals: Rival[], season: number, fame = 0, book?: CastBook) {
  for (const r of rivals) {
    for (const g of r.roster) { if (g.injured > 0) g.injured--; if ((season - 1) % 4 === 0) g.age = (g.age ?? 22) + 1; }
    promoteStar(r);
    while (r.roster.length - namedCount(r) < ROSTER_SIZE - 2) { // 보충은 소속 자리(4)만. 간판·두 번째 자리는 승격으로만 채운다. 시장에서 안 팔려 떠난 사람(gone)이 먼저 온다 — "안 사면 적이 된다"
      const gone = book ? CAST.filter(e => e.role === 'market' && castState(book, e.id).gone && !castState(book, e.id).taken) : [];
      if (gone.length) { const e = rng.pick(gone); castState(book!, e.id).taken = true; const g = makeFromCast(e, season); g.origin = 'slave'; r.roster.push(g); }
      else r.roster.push(makeMember(rng, season, r.roster, r.profile ?? 'local', fame, rivalDef(r)?.typeWeights ?? {})); }
  }
}
// 출전 가능한 검투사에서 size 명을 고른다 (부족하면 null)
export function pickEnemies(rng: Rng, rival: Rival, size: number): Gladiator[] | null {
  const pool = rival.roster.filter(g => g.alive && g.injured === 0 && g.id !== rival.starId && !g.pledged); // 간판은 졸업전에서만 만난다. 약속된 판돈은 안 나온다
  if (pool.length < size) return null;
  const out: Gladiator[] = []; const rest = [...pool];
  for (let i = 0; i < size; i++) { const k = rng.int(0, rest.length - 1); out.push(rest[k]); rest.splice(k, 1); }
  return out;
}
export function rivalOf(rivals: Rival[], id?: number): Rival | undefined { return rivals.find(r => r.id === id); }
export function memberById(rivals: Rival[], id: number): { rival: Rival; g: Gladiator } | undefined { for (const r of rivals) { const g = r.roster.find(x => x.id === id); if (g) return { rival: r, g }; } return undefined; }
export const GRUDGE = CONFIG.grudge;
// 간판 검투사: 지정값(starId). 없으면(옛 저장) 명예가 가장 높은(같으면 승수) 검투사
export function rivalStar(r: Rival): Gladiator | undefined { return r.roster.find(g => g.id === r.starId && g.alive) ?? [...r.roster].filter(g => g.alive).sort((a, b) => ((b.honor ?? 0) - (a.honor ?? 0)) || (b.wins - a.wins))[0]; }
// 졸업전 조건 진행: 간판을 제외한 현재 로스터 중 내가 쓰러뜨려 본 사람 수 / 전체 (졸업전이 뜬 뒤 들어온 사람은 제외)
export function challengeProgress(r: Rival): { beaten: number; total: number } {
  const members = r.roster.filter(g => g.alive && g.id !== r.starId && !(r.challengeSince != null && (g.boughtSeason ?? 0) > r.challengeSince));
  return { beaten: members.filter(g => (g.lostToMe ?? 0) > 0).length, total: members.length };
}
export const dojoOrder = (r: Rival) => rivalDef(r)?.order ?? 0;
export function recordVsMe(r: Rival): string { const v = r.vsMe ?? { wins: 0, losses: 0, draws: 0 }; const total = v.wins + v.losses + v.draws; return total ? `${total}전 ${v.losses}승 ${v.wins}패${v.draws ? ` ${v.draws}무` : ''}` : '첫 대결'; } // 내 기준 (내 승/패)
