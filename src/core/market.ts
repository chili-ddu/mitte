import type { Gladiator } from './types.js';
import { Rng } from './rng.js';
import { CONFIG } from './config.js';
import { grantRandomSkills } from './skills.js';
import { valueOf, makeGladiator } from './gladiator.js';
import { rollTalent } from './talent.js';

export function offerMarket(rng: Rng, season = 1): Gladiator[] {
  const list: Gladiator[] = [];
  const nTiro = season === 1 ? rng.int(3, 4) : rng.int(2, 3); // 첫 시즌은 팀을 꾸릴 수 있게
  for (let i = 0; i < nTiro; i++) list.push(withOrigin(rng, makeGladiator(rng, 'tiro'), season));
  if (season === 1 && !list.some(g => g.buyPrice <= 1500)) { const g = makeGladiator(rng, 'tiro'); const O = CONFIG.origins; g.origin = 'damnatus'; g.base.atk = Math.max(1, g.base.atk + O.damnatus.stat); g.base.def = Math.max(0, g.base.def + O.damnatus.stat); g.buyPrice = valueOf(g); list.push(g); } // 첫 시즌엔 싼 죄수가 반드시 하나 (초반 완화)
  if (rng.chance(0.5)) { const v = withOrigin(rng, makeGladiator(rng, 'veteranus', { season }), season); grantRandomSkills(rng, v, rng.int(CONFIG.skills.rivalSkillsVet[0], CONFIG.skills.rivalSkillsVet[1])); v.buyPrice = valueOf(v); list.push(v); } // 베테라누스 매물도 기술을 갖고 있고 그만큼 비싸다
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
export function offerApplicants(rng: Rng, season: number, fame: number): Gladiator[] {
  const O = CONFIG.origins.auctoratus; const out: Gladiator[] = [];
  if (season <= 1) return out;
  const n = rng.chance(O.base + fame * O.perFame) ? (rng.chance(O.second) ? 2 : 1) : 0;
  for (let i = 0; i < n; i++) {
    const g = makeGladiator(rng, rng.chance(0.5) ? 'veteranus' : 'tiro', { season }); g.origin = 'auctoratus'; g.talent = rollTalent(rng, 0.5); // 자유민 지원자는 자질이 한 단계 위일 확률 50% g.buyPrice = Math.round(g.buyPrice * O.price); g.age = rng.int(CONFIG.age.applicant[0], CONFIG.age.applicant[1]);
    if (g.rank === 'veteranus') { g.wins = Math.max(g.wins, 3); g.fights = Math.max(g.fights, 5); grantRandomSkills(rng, g, rng.int(CONFIG.skills.rivalSkillsVet[0], CONFIG.skills.rivalSkillsVet[1])); g.buyPrice = Math.round(valueOf(g) * O.price); }
    out.push(g);
  }
  return out;
}
