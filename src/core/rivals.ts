// 상대 파밀리아: 시즌을 넘어 유지되는 경쟁 검투사단. 계약의 상대는 여기서 뽑히고, 그들도 전적·부상·사망·명예가 쌓인다
// 2026-09-20(docs/10): 시즌 수로 세지지 않는다. 금고(purse)·기세(mood)·즐겨 사는 무장(focus)으로 자기 살림을 하고, 자기 경기 결과로 자란다
import type { Gladiator, GType } from './types.js';
import { Rng } from './rng.js';
import { CONFIG } from './config.js';
import { makeGladiator, powerOf, valueOf, TYPES } from './gladiator.js';
import { legendOfType } from './legends.js';
import { classKey } from './classes.js';
import { masteryCandidates } from './dictata.js';
import { growAll } from './growth.js';

export type RivalProfile = 'local' | 'major' | 'grand'; // 지방 파밀리아 · 큰 루두스 · 최대 루두스
export interface Rival {
  id: number; name: string; roster: Gladiator[];
  vsMe?: { wins: number; losses: number; draws: number }; // 그 파밀리아가 나를 상대로 거둔 전적
  profile?: RivalProfile; since?: number;                  // 나타난 시즌
  color?: string;          // 파밀리아 색 (TEAM_COLOR_IDS 중 하나, 새 게임·등장 때 우리와 다른 것으로 굴림. 2026-09-21 사용자)
  mood: number;            // 기세 −2~+2: 이기면 오르고 간판이 죽으면 떨어진다. 도전장을 낼지, 베테라누스를 살지 정한다
  purse: number;           // 금고: 검투사를 사고 훈련시킬 돈. 자기 경기 결과로 ±
  focus: string;           // 즐겨 사는 클래스 (classKey)
  revengeDue?: number;     // 이 시즌에 복수 도전장을 낸다
  silentUntil?: number;    // 간판이 죽어 이 시즌까지 도전장을 안 낸다
  refused?: number;        // 우리가 이 파밀리아의 도전장을 거절한 횟수
}
// 고증: 카푸아의 율리우스 루두스(카이사르), 네로의 루두스는 지방 파밀리아보다 훨씬 컸다. 폼페이 경기 광고의 주최자 암플리아투스 가문
// 처음엔 비등한 지방 파밀리아 둘만 있고, 호감도가 오르면 큰 루두스가 이 지방에 나타난다. 프로필은 성장이 아니라 밑천(금고)의 차이
/* 파밀리아 특징(2026-09-22 사용자): 파밀리아는 '누구를 세우는가'(명단 성향)만 갖고, '어떤 경기인가'(상금·미시오·짝 주문)는 주최자의 몫. 도전장·훈련·교체는 창작이고 사다리·이름 방식은 고증 (docs/03 §15) */
export type RivalTrait = 'weak' | 'brawler' | 'careful' | 'trader' | 'trainer' | 'noble' | 'classic' | 'elite' | 'legend';
export const RIVAL_TRAIT_KO: Record<RivalTrait, string> = { weak: '훈련 부실', brawler: '호전적', careful: '신중', trader: '상인', trainer: '훈련소', noble: '명가', classic: '정식 대결', elite: '정예', legend: '전설 보유' };
export const RIVAL_TRAIT_DESC: Record<RivalTrait, string> = { weak: '독토르가 없어 명단이 자라지 않는다', brawler: '도전장을 두 배로 자주 보내고 기세가 크게 오르내린다', careful: '간판이 우리 으뜸보다 셀 때만 도전장을 보낸다', trader: '시즌마다 가장 약한 검투사를 팔고 새로 산다 — 같은 얼굴을 오래 안 본다', trainer: '시즌마다 셋을 훈련한다 — 오래 두면 세진다', noble: '베테라누스가 많고, 이 집을 이기면 호감이 하나 더 오른다', classic: '이 집이 낀 계약은 전통 짝 주문이 두 배로 잦다', elite: '거의 전원이 베테라누스', legend: '전설의 이름을 가진 검투사를 두고 있다' };
/* 단계별 파밀리아 (2026-09-22 사용자: 스테이지를 넘기는 느낌 — 처음엔 한 팀, 명성이 오르면 더 센 파밀리아가 나타난다, 막마다 둘이라 셋 고르기가 선택이 된다). stage = 막, quality = 능력치 배율, vetP = 처음 명단의 베테라누스 비율. 명성·시즌을 채우면 **나타나고**(시트에 보인다), 그 막을 간판 내기로 졸업해야 **붙을 수 있다**(계약·도전장·셋 고르기) — 2026-09-22 사용자: 출현은 하되 아직 깬 게 아니니까 */
export const RIVAL_DEFS: { id: number; name: string; city: string; profile: RivalProfile; stage: number; fameReq: number; seasonReq: number; quality: number; vetP: number; traits: RivalTrait[]; desc: string; focus: string }[] = [
  { id: 2, name: '암플리아투스 파밀리아', city: '폼페이', profile: 'local', stage: 1, fameReq: 0, seasonReq: 1, quality: 0.85, vetP: 0.2, traits: ['weak'], desc: '폼페이 광고문에 남은 라니스타 암플리아투스의 파밀리아. 큰 방패를 즐겨 산다', focus: 'bigShield+gladius' },
  { id: 4, name: '스카이바 파밀리아', city: '누케리아', profile: 'local', stage: 2, fameReq: 10, seasonReq: 3, quality: 0.9, vetP: 0.35, traits: ['brawler'], desc: '이웃 누케리아의 지방 파밀리아. 곡도를 즐겨 사고 걸핏하면 도전장을 보낸다', focus: 'smallShield+sica' },
  { id: 5, name: '옥타비우스 파밀리아', city: '놀라', profile: 'local', stage: 2, fameReq: 10, seasonReq: 4, quality: 0.9, vetP: 0.35, traits: ['careful'], desc: '놀라의 지방 파밀리아. 창을 즐겨 사고 이길 싸움만 건다', focus: 'smallShield+spear' },
  { id: 3, name: '네로니아누스 루두스', city: '카푸아', profile: 'major', stage: 3, fameReq: 25, seasonReq: 6, quality: 1.0, vetP: 0.6, traits: ['noble'], desc: '카푸아의 황실 루두스. 베테라누스가 많고 창을 즐겨 산다', focus: 'smallShield+spear' },
  { id: 6, name: '폴리비우스 파밀리아', city: '푸테올리', profile: 'major', stage: 3, fameReq: 25, seasonReq: 7, quality: 1.0, vetP: 0.55, traits: ['trader'], desc: '푸테올리 항구의 큰 루두스. 검투사 매매로 컸고 쌍검을 즐겨 산다', focus: 'bare+sica' },
  { id: 7, name: '아틸리우스 파밀리아', city: '카푸아', profile: 'major', stage: 4, fameReq: 40, seasonReq: 10, quality: 1.03, vetP: 0.65, traits: ['trainer'], desc: '폼페이 낙서의 검투사 마르쿠스 아틸리우스를 간판으로 알려진 집. 큰 방패, 훈련이 혹독하다', focus: 'bigShield+gladius' },
  { id: 8, name: '발레리우스 파밀리아', city: '카푸아', profile: 'major', stage: 4, fameReq: 40, seasonReq: 11, quality: 1.03, vetP: 0.7, traits: ['brawler'], desc: '카푸아의 큰 루두스. 말 탄 에퀘스를 즐겨 사고 싸움을 찾아다닌다', focus: 'smallShield+gladius' },
  { id: 1, name: '율리우스 파밀리아', city: '카푸아', profile: 'grand', stage: 5, fameReq: 60, seasonReq: 14, quality: 1.06, vetP: 0.8, traits: ['classic'], desc: '카푸아의 최대 루두스. 로마 경기의 단골이라 전통 짝 주문이 잦다. 그물을 즐겨 산다', focus: 'bare+spear' },
  { id: 9, name: '세르비우스 파밀리아', city: '라벤나', profile: 'grand', stage: 5, fameReq: 60, seasonReq: 15, quality: 1.06, vetP: 0.8, traits: ['brawler', 'noble'], desc: '황실 루두스가 있던 라벤나의 명가. 그물과 창, 도전장을 즐긴다', focus: 'bare+spear' },
  { id: 10, name: '아우렐리우스 루두스', city: '로마', profile: 'grand', stage: 6, fameReq: 80, seasonReq: 20, quality: 1.1, vetP: 0.9, traits: ['elite'], desc: '로마의 루두스. 정예만 세운다', focus: 'bigShield+gladius' },
  { id: 11, name: '도미티우스 루두스', city: '로마', profile: 'grand', stage: 6, fameReq: 80, seasonReq: 21, quality: 1.1, vetP: 0.85, traits: ['legend'], desc: '로마의 루두스. 전설의 이름을 가진 검투사를 둔다. 쌍검과 반달 날', focus: 'bare+sica' },
  { id: 12, name: '루두스 마그누스', city: '로마', profile: 'grand', stage: 7, fameReq: 90, seasonReq: 26, quality: 1.12, vetP: 0.95, traits: ['noble', 'trainer'], desc: '콜로세움 곁의 황실 최대 루두스. 마지막 막', focus: '' },
];
export const rivalTraits = (r: Rival): RivalTrait[] => RIVAL_DEFS.find(d => d.id === r.id)?.traits ?? [];


const ROSTER_SIZE: Record<RivalProfile, number> = { local: 5, major: 7, grand: 8 }; // 명단 수 (2026-09-22 사용자: 규모별 5·7·8 — 지방은 얼굴이 빨리 익고, 큰 집은 깊다). 한 시즌 두 집이면 상대 풀 10~16
export const TEAM_COLOR_IDS = ['caeruleum', 'viride', 'aerugo', 'sil', 'minium', 'aes'] as const; // 벽화 안료 여섯 — 화면의 TEAM_COLORS 와 같은 순서 (우리 하나 + 파밀리아 넷이 서로 다르게)
export const pickColor = (rng: Rng, used: (string | undefined)[]): string => { const free = TEAM_COLOR_IDS.filter(c => !used.includes(c)); return rng.pick(free.length ? free : [...TEAM_COLOR_IDS]); };
const ORD = ['', ' 세쿤두스', ' 테르티우스', ' 콰르투스', ' 퀸투스'];
const RV = () => CONFIG.rivals;
function pickType(rng: Rng, focus: string): GType { const pool = TYPES.filter(t => classKey(t) === focus); return pool.length && rng.chance(RV().focusP) ? rng.pick(pool) : rng.pick(TYPES); }
/* 파밀리아 품질: 능력치·상한에 배율 (2026-09-22). 지방 파밀리아는 ×0.9 — 값도 다시 센다 (배상금·표시 전력이 실제 몸을 따르게) */
export function applyQuality(g: Gladiator, q: number): Gladiator { if (q === 1) return g; for (const k of ['hp', 'atk', 'def', 'hand'] as const) { g.base[k] = Math.max(1, Math.round(g.base[k] * q)); if (g.cap) g.cap[k] = Math.max(g.base[k], Math.round(g.cap[k] * q)); } g.buyPrice = valueOf(g); return g; }
function makeMember(rng: Rng, season: number, roster: Gladiator[], rank: 'tiro' | 'veteranus', focus: string, taken?: Set<string>, quality = 1): Gladiator {
  const g = applyQuality(makeGladiator(rng, rank, { season, type: pickType(rng, focus), taken }), quality);
  if (rank === 'veteranus') { g.wins = rng.int(3, 3 + Math.min(9, Math.floor(season / 2))); g.fights = g.wins + rng.int(0, 3); g.honor = rng.int(0, Math.min(30, season * 2));
    const cand = masteryCandidates(g.type); const n = Math.min(2, Math.floor(g.wins / 3)); for (let k = 0; k < n; k++) if (rng.chance(CONFIG.mastery.rivalVetP)) { const pick = rng.pick(cand.filter(m => !(g.dictata ?? []).includes(m.id))); if (pick) (g.dictata ??= []).push(pick.id); } } // 상대 베테라누스도 승수만큼 익힌 것이 있다
  const base = g.name; let k = 0; while (roster.some(o => o.name === g.name) && k < ORD.length - 1) { k++; g.name = base + ORD[k]; } // 같은 파밀리아 안에서 이름 겹침 방지
  return g;
}
function makeRival(rng: Rng, season: number, def: typeof RIVAL_DEFS[number], used: (string | undefined)[] = [], taken?: Set<string>): Rival {
  const r: Gladiator[] = []; for (let k = 0; k < ROSTER_SIZE[def.profile]; k++) r.push(makeMember(rng, season, r, rng.chance(def.vetP) ? 'veteranus' : 'tiro', def.focus, taken, def.quality));
  if (def.traits.includes('legend') && !r.some(g => g.legend)) { for (let k = 0; k < r.length; k++) { const l = legendOfType(r[k].type); if (l && !taken?.has(l.id)) { r[k] = applyQuality(makeGladiator(rng, 'veteranus', { season, legend: l.id, taken }), def.quality); taken?.add(l.id); break; } } } /* 전설 보유 */
  return { id: def.id, name: def.name, roster: r, vsMe: { wins: 0, losses: 0, draws: 0 }, profile: def.profile, since: season, mood: 0, purse: RV().purseStart[def.profile], focus: def.focus, color: pickColor(rng, used) };
}
// 새 게임: 호감도 조건을 채운 파밀리아만 (처음엔 지방 둘)
export function makeRivals(rng: Rng, season = 1, fame = 0, myColor?: string, taken?: Set<string>): Rival[] { const out: Rival[] = []; for (const d of RIVAL_DEFS) if (fame >= d.fameReq && season >= d.seasonReq) out.push(makeRival(rng, season, d, [myColor, ...out.map(r => r.color)], taken)); return out; }
// 시즌 시작: 호감도가 조건에 이르면 큰 루두스가 이 지방에 나타난다. 돌아온 목록 = 이번에 나타난 파밀리아
export function arriveRivals(rng: Rng, rivals: Rival[], season: number, fame: number, myColor?: string, taken?: Set<string>): Rival[] {
  const out: Rival[] = [];
  for (const d of RIVAL_DEFS) { if (fame >= d.fameReq && season >= d.seasonReq && !rivals.some(r => r.id === d.id)) { const r = makeRival(rng, season, d, [myColor, ...rivals.map(x => x.color)], taken); rivals.push(r); out.push(r); } }
  return out;
}
export const rivalDef = (r: Rival) => RIVAL_DEFS.find(d => d.id === r.id);
export const bumpMood = (r: Rival, d: number) => { const k = rivalTraits(r).includes('brawler') ? 2 : 1; r.mood = Math.max(RV().moodMin, Math.min(RV().moodMax, (r.mood ?? 0) + d * k)); }; /* 호전적: 기세가 두 배로 오르내린다 */
// 시즌마다 살림: 부상 회복, 나이, 보이지 않는 다른 경기(금고 ±, 드물게 사망), 금고로 훈련·보충. 돌아온 목록 = 포룸에 실을 소식
export function replenishRivals(rng: Rng, rivals: Rival[], season: number, taken?: Set<string>): string[] {
  const news: string[] = []; const C = RV();
  for (const r of rivals) {
    for (const g of r.roster) { if (g.injured > 0) g.injured--; if ((season - 1) % 4 === 0) g.age = (g.age ?? 22) + 1; }
    // 보이지 않는 다른 경기: 우리가 없어도 세상이 돈다
    if (rng.chance(C.otherGames.winP)) { r.purse += C.purseWin; } else { r.purse += C.purseLose; if (rng.chance(C.otherGames.deathP / C.otherGames.winP)) { const alive = r.roster.filter(g => g.alive); if (alive.length > 2) { const dead = rng.pick(alive); r.roster = r.roster.filter(g => g !== dead); bumpMood(r, dead === rivalStar(r) ? -2 : -1); news.push(`${r.name}의 ${dead.name}${dead === rivalStar(r) ? '(간판)' : ''}이(가) 다른 경기에서 쓰러졌다`); } } }
    // 훈련: 금고가 있으면 둘 — 자기 클래스 풀로
    const tr = rivalTraits(r); const trains = tr.includes('weak') ? 0 : C.trainPerSeason + (tr.includes('trainer') ? 1 : 0); /* 특징: 훈련 부실 0 · 훈련소 +1 */
    if (tr.includes('trader') && r.purse >= C.buyTiro) { const pool = r.roster.filter(g => g.alive && !g.legend).sort((a, b) => powerOf(a) - powerOf(b)); const out = pool[0]; if (out) { r.roster = r.roster.filter(g => g !== out); r.purse += Math.round(valueOf(out) / 2); news.push(`${r.name}이(가) ${out.name}을(를) 팔았다`); } } /* 상인: 가장 약한 하나를 팔아 자리를 비운다 (보충이 새로 산다) */
    for (let k = 0; k < trains && r.purse >= C.trainCost; k++) { const pool = r.roster.filter(g => g.alive && g.injured === 0); if (!pool.length) break; const g = rng.pick(pool); growAll(g, k => k === 'hp' ? C.trainHp : C.trainGain, true); /* 파밀리아는 독토르가 늘 있는 집 — 같은 성장 모델, 상한까지 */ r.purse -= C.trainCost; }
    // 보충: 금고가 허락하는 만큼. 기세가 좋으면 베테라누스
    while (r.roster.length < ROSTER_SIZE[r.profile ?? 'local']) { const vet = (r.mood ?? 0) > 0 && r.purse >= C.buyVet; const cost = vet ? C.buyVet : C.buyTiro; if (r.purse < cost) break; r.purse -= cost; r.roster.push(makeMember(rng, season, r.roster, vet ? 'veteranus' : 'tiro', r.focus, taken, rivalDef(r)?.quality ?? 1)); }
  }
  return news;
}
// 출전 가능한 검투사에서 size 명을 고른다 (부족하면 null)
export function pickEnemies(rng: Rng, rival: Rival, size: number): Gladiator[] | null {
  const pool = rival.roster.filter(g => g.alive && g.injured === 0);
  if (pool.length < size) return null;
  const out: Gladiator[] = []; const rest = [...pool];
  for (let i = 0; i < size; i++) { const k = rng.int(0, rest.length - 1); out.push(rest[k]); rest.splice(k, 1); }
  return out;
}
// 도전 계약의 상대: 간판 + 명예 순 정예 (부상 아닌 사람만)
export function pickElite(rival: Rival, size: number): Gladiator[] | null {
  const pool = rival.roster.filter(g => g.alive && g.injured === 0).sort((a, b) => ((b.honor ?? 0) - (a.honor ?? 0)) || (b.wins - a.wins) || (powerOf(b) - powerOf(a)));
  return pool.length >= size ? pool.slice(0, size) : null;
}
export function rivalOf(rivals: Rival[], id?: number): Rival | undefined { return rivals.find(r => r.id === id); }
export function memberById(rivals: Rival[], id: number): { rival: Rival; g: Gladiator } | undefined { for (const r of rivals) { const g = r.roster.find(x => x.id === id); if (g) return { rival: r, g }; } return undefined; }
// 간판 검투사: 명예가 가장 높은(같으면 승수) 검투사
export function rivalStar(r: Rival): Gladiator | undefined { return [...r.roster].filter(g => g.alive).sort((a, b) => ((b.honor ?? 0) - (a.honor ?? 0)) || (b.wins - a.wins))[0]; }
export function recordVsMe(r: Rival): string { const v = r.vsMe ?? { wins: 0, losses: 0, draws: 0 }; const total = v.wins + v.losses + v.draws; return total ? `${total}전 ${v.losses}승 ${v.wins}패${v.draws ? ` ${v.draws}무` : ''}` : '첫 대결'; } // 내 기준 (내 승/패)
// 우리와 견주기: 양쪽 상위 셋 평균 전력. 'strong' = 그쪽이 세다
export function compareRival(r: Rival, mine: Gladiator[]): 'strong' | 'even' | 'weak' {
  const n = Math.max(1, Math.min(3, mine.filter(g => g.alive).length)); /* 우리 인원만큼만 견준다 — 둘뿐인 첫 시즌에 여섯 명 파밀리아가 다 '세다'로 나오지 않게 (2026-09-21) */
  const top = (gs: Gladiator[]) => { const p = gs.filter(g => g.alive).map(powerOf).sort((a, b) => b - a).slice(0, n); return p.length ? p.reduce((a, b) => a + b, 0) / p.length : 0; };
  const a = top(r.roster), b = top(mine); if (!b) return 'strong'; const k = a / b; return k >= 1.08 ? 'strong' : k <= 0.92 ? 'weak' : 'even';
}
export const COMPARE_KO: Record<'strong' | 'even' | 'weak', string> = { strong: '우리보다 세다', even: '우리와 비슷하다', weak: '우리보다 약하다' };
