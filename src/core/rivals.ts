// 상대 파밀리아: 시즌을 넘어 유지되는 경쟁 검투사단. 계약의 상대는 여기서 뽑히고, 그들도 전적·부상·사망·명예가 쌓인다
import type { Gladiator } from './types.js';
import { Rng } from './rng.js';
import { CONFIG } from './config.js';
import { makeGladiator } from './gladiator.js';
import { eligibleSkills } from './skills.js';

export type RivalProfile = 'local' | 'major' | 'grand'; // 지방 파밀리아 · 큰 루두스 · 최대 루두스
export interface Rival { id: number; name: string; roster: Gladiator[]; vsMe?: { wins: number; losses: number; draws: number }; profile?: RivalProfile; since?: number } // vsMe: 그 파밀리아가 나를 상대로 거둔 전적 · since: 나타난 시즌
// 고증: 카푸아의 율리우스 루두스(카이사르), 네로의 루두스는 지방 파밀리아보다 훨씬 컸다. 폼페이 경기 광고의 주최자 암플리아투스 가문
// 처음엔 비등한 지방 파밀리아 둘만 있고, 호감도가 오르면 큰 루두스가 이 지방에 나타난다
export const RIVAL_DEFS: { id: number; name: string; profile: RivalProfile; fameReq: number; desc: string }[] = [
  { id: 2, name: '암플리아투스 파밀리아', profile: 'local', fameReq: 0, desc: '폼페이의 지방 파밀리아' },
  { id: 4, name: '스카이바 파밀리아', profile: 'local', fameReq: 0, desc: '이웃 도시의 지방 파밀리아' },
  { id: 3, name: '네로니아누스 루두스', profile: 'major', fameReq: 40, desc: '황실 소유의 큰 루두스. 베테라누스가 많다' },
  { id: 1, name: '율리우스 파밀리아', profile: 'grand', fameReq: 60, desc: '카푸아의 최대 루두스. 로마 경기의 단골' },
];
const ROSTER_SIZE = 6;
const PROFILE = { local: { vet: 0, grow: 0, skills: 0 }, major: { vet: 0.35, grow: 1, skills: 1 }, grand: { vet: 0.6, grow: 2, skills: 1 } }; // 서열 확률 가산 · 공방 가산 · 기술 가산

function strengthAt(season: number, fame = 0) { void fame; return 0.75 + season * 0.03; } /* 내 호감도에 따른 가산은 뺐다 — 계약 생성기가 목표 전력으로 정규화해 효과가 없었다 (난이도는 CONFIG.contractDiff 의 이름값 가산으로) */ // 시즌 + 내 명성(50 위로 1점당 0.4%): 이름난 루두스에는 강한 파밀리아가 붙는다
const ORD = ['', ' 세쿤두스', ' 테르티우스', ' 콰르투스', ' 퀸투스'];
function makeMember(rng: Rng, season: number, roster: Gladiator[] = [], profile: RivalProfile = 'local', fame = 0): Gladiator {
  const P = PROFILE[profile]; const s = strengthAt(season, fame); const rank = rng.chance(Math.min(0.95, s - 0.6 + P.vet)) ? 'veteranus' : 'tiro';
  const g = makeGladiator(rng, rank, { season }); if (rank === 'veteranus' && P.grow) { g.base.atk += P.grow; g.base.def += P.grow; }
  // 상대도 시즌을 거치며 훈련한다: 베테라누스 시즌 단련은 makeGladiator(statRoll.vetGrow)에서, 승수·명예도 쌓인 채로 온다 (내 검투사만 자라면 후반 승률이 70%를 넘는다)
  if (rank === 'veteranus') { g.wins = rng.int(3, 3 + Math.min(9, Math.floor(season / 2))); g.fights = g.wins + rng.int(0, 3); g.honor = rng.int(0, Math.min(30, season * 2)); }
  if (rank === 'veteranus') { const n = rng.int(CONFIG.skills.rivalSkillsVet[0], CONFIG.skills.rivalSkillsVet[1]) + P.skills; for (let k = 0; k < n; k++) { const e = eligibleSkills(g); if (!e.length) break; (g.skills ??= []).push(rng.pick(e).id); } } // 상대 베테라누스도 기술을 1~2개 가진다
  const base = g.name; let k = 0; while (roster.some(o => o.name === g.name) && k < ORD.length - 1) { k++; g.name = base + ORD[k]; } // 같은 파밀리아 안에서 이름 겹침 방지
  return g;
}
function makeRival(rng: Rng, season: number, def: typeof RIVAL_DEFS[number]): Rival {
  const r: Gladiator[] = []; for (let k = 0; k < ROSTER_SIZE; k++) r.push(makeMember(rng, season, r, def.profile));
  return { id: def.id, name: def.name, roster: r, vsMe: { wins: 0, losses: 0, draws: 0 }, profile: def.profile, since: season };
}
// 새 게임: 호감도 조건을 채운 파밀리아만 (처음엔 지방 둘)
export function makeRivals(rng: Rng, season = 1, fame = 0): Rival[] { return RIVAL_DEFS.filter(d => fame >= d.fameReq).map(d => makeRival(rng, season, d)); }
// 시즌 시작: 호감도가 조건에 이르면 큰 루두스가 이 지방에 나타난다. 돌아온 목록 = 이번에 나타난 파밀리아
export function arriveRivals(rng: Rng, rivals: Rival[], season: number, fame: number): Rival[] {
  const out: Rival[] = [];
  for (const d of RIVAL_DEFS) { if (fame >= d.fameReq && !rivals.some(r => r.id === d.id)) { const r = makeRival(rng, season, d); rivals.push(r); out.push(r); } }
  return out;
}
export const rivalDef = (r: Rival) => RIVAL_DEFS.find(d => d.id === r.id);
// 시즌마다: 부상 회복, 빈자리 보충, 봄에는 나이
export function replenishRivals(rng: Rng, rivals: Rival[], season: number, fame = 0) {
  for (const r of rivals) {
    for (const g of r.roster) { if (g.injured > 0) g.injured--; if ((season - 1) % 4 === 0) g.age = (g.age ?? 22) + 1; }
    while (r.roster.length < ROSTER_SIZE) r.roster.push(makeMember(rng, season, r.roster, r.profile ?? 'local', fame));
  }
}
// 출전 가능한 검투사에서 size 명을 고른다 (부족하면 null)
export function pickEnemies(rng: Rng, rival: Rival, size: number): Gladiator[] | null {
  const pool = rival.roster.filter(g => g.alive && g.injured === 0);
  if (pool.length < size) return null;
  const out: Gladiator[] = []; const rest = [...pool];
  for (let i = 0; i < size; i++) { const k = rng.int(0, rest.length - 1); out.push(rest[k]); rest.splice(k, 1); }
  return out;
}
export function rivalOf(rivals: Rival[], id?: number): Rival | undefined { return rivals.find(r => r.id === id); }
export function memberById(rivals: Rival[], id: number): { rival: Rival; g: Gladiator } | undefined { for (const r of rivals) { const g = r.roster.find(x => x.id === id); if (g) return { rival: r, g }; } return undefined; }
export const GRUDGE = CONFIG.grudge;
// 간판 검투사: 명예가 가장 높은(같으면 승수) 검투사
export function rivalStar(r: Rival): Gladiator | undefined { return [...r.roster].filter(g => g.alive).sort((a, b) => ((b.honor ?? 0) - (a.honor ?? 0)) || (b.wins - a.wins))[0]; }
export function recordVsMe(r: Rival): string { const v = r.vsMe ?? { wins: 0, losses: 0, draws: 0 }; const total = v.wins + v.losses + v.draws; return total ? `${total}전 ${v.losses}승 ${v.wins}패${v.draws ? ` ${v.draws}무` : ''}` : '첫 대결'; } // 내 기준 (내 승/패)
