import type { Gladiator } from './types.js';
import { Rng } from './rng.js';
import { CONFIG } from './config.js';
import { valueOf } from './gladiator.js';

import { CAST, castState, makeFromCast, type CastBook } from './cast.js';
import type { Talent } from './talent.js';
// 시장 = 오토체스 상점 (docs/08 8절). 호감도 단계가 등급 확률을 정하고, 명부에서 아직 팔리지 않은 사람을 세운다. 시즌마다 2명, 리롤로 다시 뽑는다
function tierProbs(fame: number): [number, number, number, number] { let p = CONFIG.market.tierTable[0][1]; for (const [at, v] of CONFIG.market.tierTable) if (fame >= at) p = v; return p; }
function eligible(book: CastBook, t: Talent, shown: Set<string>) { return CAST.filter(e => e.role === 'market' && e.talent === t && !shown.has(e.id) && !castState(book, e.id).taken && !castState(book, e.id).gone && castState(book, e.id).app < CONFIG.market.maxApp[t]); }
export function drawMarket(rng: Rng, season: number, fame: number, book: CastBook, n: number, shown: Set<string> = new Set()): Gladiator[] {
  const out: Gladiator[] = []; const probs = tierProbs(fame);
  for (let i = 0; i < n; i++) {
    let r = rng.next() * 100; let t: Talent = 0; for (let k = 0; k < 4; k++) { r -= probs[k]; if (r < 0) { t = k as Talent; break; } }
    let pool = eligible(book, t, shown); for (let k = t - 1; k >= 0 && !pool.length; k--) pool = eligible(book, k as Talent, shown); // 그 등급이 다 팔렸으면 아래 등급
    if (!pool.length) break;
    const e = rng.pick(pool); shown.add(e.id); castState(book, e.id).app++; out.push(makeFromCast(e, season));
  }
  return out;
}
// 시즌 시작: 앞 시즌에 안 팔린 사람은 등장 횟수를 다 썼으면 떠난다(gone). 옛 저장(명부 없음)은 지금까지처럼 랜덤
export function offerMarket(rng: Rng, season: number, fame: number, book: CastBook, prev: Gladiator[] = []): Gladiator[] {
  for (const g of prev) if (g.castId) { const st = castState(book, g.castId); const e = CAST.find(x => x.id === g.castId); if (e && st.app >= CONFIG.market.maxApp[e.talent]) st.gone = true; }
  return drawMarket(rng, season, fame, book, season === 1 ? CONFIG.market.firstSeason : CONFIG.market.perSeason);
}
// 시작 로스터: 펠릭스(재능 무르밀로, 루두스에 딸려 온 사람) + 평범 중 무르밀로 아닌 유형 하나
export function starters(rng: Rng, book: CastBook): Gladiator[] {
  const felix = CAST.find(e => e.name === '펠릭스')!; const others = CAST.filter(e => e.role === 'market' && e.talent === 0 && e.type !== 'murmillo');
  return [felix, rng.pick(others)].map(e => { castState(book, e.id).taken = true; const g = makeFromCast(e, 1); g.origin = 'slave'; g.buyPrice = valueOf(g); return g; });
}
// 자유민 지원자(아욱토라티) 채널은 2026-09-27 폐지 — 랜덤 생성이라 명부 원칙 밖이었고, 명부로 옮기면 한 번뿐인 천부가 계약 만료로 떠난다. 아욱토라티는 루디스 뒤 자유민 계약(급료·재계약)으로만 남긴다
