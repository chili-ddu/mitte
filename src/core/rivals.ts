// 상대 파밀리아: 시즌을 넘어 유지되는 경쟁 검투사단. 계약의 상대는 여기서 뽑히고, 그들도 전적·부상·사망·명예가 쌓인다
import type { Gladiator } from './types.js';
import { Rng } from './rng.js';
import { CONFIG } from './config.js';
import { makeGladiator } from './gladiator.js';

export interface Rival { id: number; name: string; roster: Gladiator[]; vsMe?: { wins: number; losses: number; draws: number } } // vsMe: 그 파밀리아가 나를 상대로 거둔 전적
// 고증: 카푸아의 율리우스 루두스(카이사르), 네로의 루두스, 폼페이 경기 광고의 주최자 암플리아투스 가문
const RIVAL_NAMES = ['율리우스 파밀리아', '암플리아투스 파밀리아', '네로니아누스 루두스', '스카이바 파밀리아'];
const ROSTER_SIZE = 6;

function strengthAt(season: number) { return 0.75 + season * 0.03; }
const ORD = ['', ' 세쿤두스', ' 테르티우스', ' 콰르투스', ' 퀸투스'];
function makeMember(rng: Rng, season: number, roster: Gladiator[] = []): Gladiator {
  const s = strengthAt(season); const rank = rng.chance(Math.min(0.8, s - 0.6)) ? 'veteranus' : 'tiro';
  const g = makeGladiator(rng, rank);
  const base = g.name; let k = 0; while (roster.some(o => o.name === g.name) && k < ORD.length - 1) { k++; g.name = base + ORD[k]; } // 같은 파밀리아 안에서 이름 겹침 방지
  return g;
}
export function makeRivals(rng: Rng, season = 1, n = 4): Rival[] {
  return Array.from({ length: n }, (_, i) => ({ id: i + 1, name: RIVAL_NAMES[i % RIVAL_NAMES.length], roster: (() => { const r: Gladiator[] = []; for (let k = 0; k < ROSTER_SIZE; k++) r.push(makeMember(rng, season, r)); return r; })(), vsMe: { wins: 0, losses: 0, draws: 0 } }));
}
// 시즌마다: 부상 회복, 빈자리 보충, 봄에는 나이
export function replenishRivals(rng: Rng, rivals: Rival[], season: number) {
  for (const r of rivals) {
    for (const g of r.roster) { if (g.injured > 0) g.injured--; if ((season - 1) % 4 === 0) g.age = (g.age ?? 22) + 1; }
    while (r.roster.length < ROSTER_SIZE) r.roster.push(makeMember(rng, season, r.roster));
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
export function recordVsMe(r: Rival): string { const v = r.vsMe ?? { wins: 0, losses: 0, draws: 0 }; const total = v.wins + v.losses + v.draws; return total ? `나와 ${total}전: 내 ${v.losses}승 ${v.wins}패${v.draws ? ` ${v.draws}무` : ''}` : '나와 첫 대결'; }
