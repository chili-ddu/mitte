import type { Gladiator, GType } from './types.js';
import { retalentCaps } from './growth.js';

import { Rng } from './rng.js';
import { CONFIG } from './config.js';
import { valueOf, makeGladiator, TYPES } from './gladiator.js';
import { rollTalent } from './talent.js';

// 판매대: 이미 나온 유형은 가중치를 낮춰 뽑는다 (2026-09-18: 무조건 배제 → 확률, 주무기 → 유형 기준. 같은 유형 둘이 나란히 서는 일이 드물되, 같은 무장을 모을 길은 열어 둔다)
function pickType(rng: Rng, used: Set<GType>): GType {
  const w = TYPES.map(t => used.has(t) ? CONFIG.market.dupWeight : 1); const total = w.reduce((a, b) => a + b, 0);
  let r = rng.next() * total; for (let i = 0; i < TYPES.length; i++) { r -= w[i]; if (r <= 0) return TYPES[i]; } return TYPES[TYPES.length - 1];
}
export function offerMarket(rng: Rng, season = 1, taken?: Set<string>): Gladiator[] {
  const list: Gladiator[] = []; const used = new Set<GType>();
  const add = (g: Gladiator) => { used.add(g.type); list.push(g); };
  const nTiro = rng.int(2, 3); // 첫 시즌 혜택은 없앴다 (2026-09-16: 시작 검투사 둘을 직접 고르므로 그 역할이 끝났다)
  for (let i = 0; i < nTiro; i++) add(withOrigin(rng, makeGladiator(rng, 'tiro', { type: pickType(rng, used), taken }), season));
  if (rng.chance(0.5)) { const v = withOrigin(rng, makeGladiator(rng, 'veteranus', { season, type: pickType(rng, used), taken }), season); v.buyPrice = valueOf(v); add(v); } // 베테라누스는 절반 확률
  return list;
}
// 출신 부여: 첫 시즌은 노예 상인만 (규칙을 익힐 때 변수를 줄인다)
function withOrigin(rng: Rng, g: Gladiator, season: number): Gladiator {
  const O = CONFIG.origins; g.origin = 'slave';
  if (season <= 1) return g;
  const r = rng.next();
  if (r < O.mix.captive) { g.origin = 'captive'; g.base.atk += O.captive.atk; g.base.hp += O.captive.hp; g.buyPrice = valueOf(g); }
  else if (r < O.mix.captive + O.mix.damnatus) { g.origin = 'damnatus'; g.base.atk = Math.max(1, g.base.atk + O.damnatus.stat); g.base.def = Math.max(0, g.base.def + O.damnatus.stat); g.buyPrice = valueOf(g); }
  return g;
}
// 자유민 지원자(아욱토라티): 호민관 앞에서 선서하고 라니스타와 직접 계약. 루두스 문 앞에 찾아온다
export function offerApplicants(rng: Rng, season: number, fame: number, taken?: Set<string>): Gladiator[] {
  const O = CONFIG.origins.auctoratus; const out: Gladiator[] = [];
  if (season <= 1) return out;
  const n = rng.chance(O.base + fame * O.perFame) ? (rng.chance(O.second) ? 2 : 1) : 0;
  for (let i = 0; i < n; i++) {
    const g = makeGladiator(rng, rng.chance(0.5) ? 'veteranus' : 'tiro', { season, taken }); g.origin = 'auctoratus'; if (!g.legend) { const t0 = g.talent ?? 0; g.talent = rollTalent(rng, 0.5); retalentCaps(g, t0, g.talent ?? 0); } /* 전설이 아니면 한 단계 위일 확률 50% */ // 자유민 지원자는 자질이 한 단계 위일 확률 50% (상한도 따라간다) g.buyPrice = Math.round(g.buyPrice * O.price); g.age = rng.int(CONFIG.age.applicant[0], CONFIG.age.applicant[1]);
    if (g.rank === 'veteranus') { g.wins = Math.max(g.wins, 3); g.fights = Math.max(g.fights, 5); g.buyPrice = Math.round(valueOf(g) * O.price); }
    out.push(g);
  }
  return out;
}
