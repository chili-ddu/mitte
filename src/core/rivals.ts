// 상대 파밀리아: 시즌을 넘어 유지되는 경쟁 검투사단. 계약의 상대는 여기서 뽑히고, 그들도 전적·부상·사망·명예가 쌓인다
// 2026-09-20(docs/10): 시즌 수로 세지지 않는다. 금고(purse)·기세(mood)·즐겨 사는 무장(focus)으로 자기 살림을 하고, 자기 경기 결과로 자란다
import type { Gladiator, GType } from './types.js';
import { Rng } from './rng.js';
import { CONFIG } from './config.js';
import { makeGladiator, pickTrainStat, powerOf, TYPES } from './gladiator.js';
import { classKey } from './classes.js';
import { masteryCandidates } from './dictata.js';
import { growthSpeed, capOf, addProgress } from './growth.js';

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
export const RIVAL_DEFS: { id: number; name: string; profile: RivalProfile; fameReq: number; desc: string; focus: string }[] = [
  { id: 2, name: '암플리아투스 파밀리아', profile: 'local', fameReq: 0, desc: '폼페이의 지방 파밀리아. 큰 방패를 즐겨 산다', focus: 'bigShield+gladius' },
  { id: 4, name: '스카이바 파밀리아', profile: 'local', fameReq: 0, desc: '이웃 도시의 지방 파밀리아. 곡도를 즐겨 산다', focus: 'smallShield+sica' },
  { id: 3, name: '네로니아누스 루두스', profile: 'major', fameReq: 40, desc: '황실 소유의 큰 루두스. 베테라누스가 많고 창을 즐겨 산다', focus: 'smallShield+spear' },
  { id: 1, name: '율리우스 파밀리아', profile: 'grand', fameReq: 60, desc: '카푸아의 최대 루두스. 로마 경기의 단골. 그물을 즐겨 산다', focus: 'bare+spear' },
];
const ROSTER_SIZE = 6;
export const TEAM_COLOR_IDS = ['caeruleum', 'viride', 'aerugo', 'sil', 'minium', 'aes'] as const; // 벽화 안료 여섯 — 화면의 TEAM_COLORS 와 같은 순서 (우리 하나 + 파밀리아 넷이 서로 다르게)
export const pickColor = (rng: Rng, used: (string | undefined)[]): string => { const free = TEAM_COLOR_IDS.filter(c => !used.includes(c)); return rng.pick(free.length ? free : [...TEAM_COLOR_IDS]); };
const VET_P: Record<RivalProfile, number> = { local: 0.35, major: 0.6, grand: 0.8 }; // 처음 명단의 베테라누스 비율 (밑천)
const ORD = ['', ' 세쿤두스', ' 테르티우스', ' 콰르투스', ' 퀸투스'];
const RV = () => CONFIG.rivals;
function pickType(rng: Rng, focus: string): GType { const pool = TYPES.filter(t => classKey(t) === focus); return pool.length && rng.chance(RV().focusP) ? rng.pick(pool) : rng.pick(TYPES); }
function makeMember(rng: Rng, season: number, roster: Gladiator[], rank: 'tiro' | 'veteranus', focus: string, taken?: Set<string>): Gladiator {
  const g = makeGladiator(rng, rank, { season, type: pickType(rng, focus), taken });
  if (rank === 'veteranus') { g.wins = rng.int(3, 3 + Math.min(9, Math.floor(season / 2))); g.fights = g.wins + rng.int(0, 3); g.honor = rng.int(0, Math.min(30, season * 2));
    const cand = masteryCandidates(g.type); const n = Math.min(2, Math.floor(g.wins / 3)); for (let k = 0; k < n; k++) if (rng.chance(CONFIG.mastery.rivalVetP)) { const pick = rng.pick(cand.filter(m => !(g.dictata ?? []).includes(m.id))); if (pick) (g.dictata ??= []).push(pick.id); } } // 상대 베테라누스도 승수만큼 익힌 것이 있다
  const base = g.name; let k = 0; while (roster.some(o => o.name === g.name) && k < ORD.length - 1) { k++; g.name = base + ORD[k]; } // 같은 파밀리아 안에서 이름 겹침 방지
  return g;
}
function makeRival(rng: Rng, season: number, def: typeof RIVAL_DEFS[number], used: (string | undefined)[] = [], taken?: Set<string>): Rival {
  const r: Gladiator[] = []; for (let k = 0; k < ROSTER_SIZE; k++) r.push(makeMember(rng, season, r, rng.chance(VET_P[def.profile]) ? 'veteranus' : 'tiro', def.focus, taken));
  return { id: def.id, name: def.name, roster: r, vsMe: { wins: 0, losses: 0, draws: 0 }, profile: def.profile, since: season, mood: 0, purse: RV().purseStart[def.profile], focus: def.focus, color: pickColor(rng, used) };
}
// 새 게임: 호감도 조건을 채운 파밀리아만 (처음엔 지방 둘)
export function makeRivals(rng: Rng, season = 1, fame = 0, myColor?: string, taken?: Set<string>): Rival[] { const out: Rival[] = []; for (const d of RIVAL_DEFS) if (fame >= d.fameReq) out.push(makeRival(rng, season, d, [myColor, ...out.map(r => r.color)], taken)); return out; }
// 시즌 시작: 호감도가 조건에 이르면 큰 루두스가 이 지방에 나타난다. 돌아온 목록 = 이번에 나타난 파밀리아
export function arriveRivals(rng: Rng, rivals: Rival[], season: number, fame: number, myColor?: string, taken?: Set<string>): Rival[] {
  const out: Rival[] = [];
  for (const d of RIVAL_DEFS) { if (fame >= d.fameReq && !rivals.some(r => r.id === d.id)) { const r = makeRival(rng, season, d, [myColor, ...rivals.map(x => x.color)], taken); rivals.push(r); out.push(r); } }
  return out;
}
export const rivalDef = (r: Rival) => RIVAL_DEFS.find(d => d.id === r.id);
export const bumpMood = (r: Rival, d: number) => { r.mood = Math.max(RV().moodMin, Math.min(RV().moodMax, (r.mood ?? 0) + d)); };
// 시즌마다 살림: 부상 회복, 나이, 보이지 않는 다른 경기(금고 ±, 드물게 사망), 금고로 훈련·보충. 돌아온 목록 = 포룸에 실을 소식
export function replenishRivals(rng: Rng, rivals: Rival[], season: number, taken?: Set<string>): string[] {
  const news: string[] = []; const C = RV();
  for (const r of rivals) {
    for (const g of r.roster) { if (g.injured > 0) g.injured--; if ((season - 1) % 4 === 0) g.age = (g.age ?? 22) + 1; }
    // 보이지 않는 다른 경기: 우리가 없어도 세상이 돈다
    if (rng.chance(C.otherGames.winP)) { r.purse += C.purseWin; } else { r.purse += C.purseLose; if (rng.chance(C.otherGames.deathP / C.otherGames.winP)) { const alive = r.roster.filter(g => g.alive); if (alive.length > 2) { const dead = rng.pick(alive); r.roster = r.roster.filter(g => g !== dead); bumpMood(r, dead === rivalStar(r) ? -2 : -1); news.push(`${r.name}의 ${dead.name}${dead === rivalStar(r) ? '(간판)' : ''}이(가) 다른 경기에서 쓰러졌다`); } } }
    // 훈련: 금고가 있으면 둘 — 자기 클래스 풀로
    for (let k = 0; k < C.trainPerSeason && r.purse >= C.trainCost; k++) { const pool = r.roster.filter(g => g.alive && g.injured === 0); if (!pool.length) break; const g = rng.pick(pool); const stat = pickTrainStat(rng, g); if (g.base[stat] < capOf(g, stat)) addProgress(g, stat, (stat === 'hp' ? C.trainHp * CONFIG.growthModel.hpStep : C.trainGain * CONFIG.growthModel.step) * growthSpeed(g, stat, true)); /* 파밀리아는 독토르가 늘 있는 집 — 같은 성장 모델, 상한까지 */ r.purse -= C.trainCost; }
    // 보충: 금고가 허락하는 만큼. 기세가 좋으면 베테라누스
    while (r.roster.length < ROSTER_SIZE) { const vet = (r.mood ?? 0) > 0 && r.purse >= C.buyVet; const cost = vet ? C.buyVet : C.buyTiro; if (r.purse < cost) break; r.purse -= cost; r.roster.push(makeMember(rng, season, r.roster, vet ? 'veteranus' : 'tiro', r.focus, taken)); }
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
export const GRUDGE = CONFIG.grudge;
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
