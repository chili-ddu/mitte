// 자동 플레이 전략. 밸런스 검증용.
import type { GameState, FightReport } from '../core/game.js';
import { available, buy, canBuy, endSeason, fight, heal, train, refuseAll, validTeam, rosterCap, upgrade, upgradeCost, doSkillTrain, skillTrainable } from '../core/game.js';
import { learnSkill, skillsOf } from '../core/skills.js';
import { HOST } from '../core/hosts.js';
import type { Contract, Gladiator } from '../core/types.js';
import { CONFIG } from '../core/config.js';
import { computeSynergies, describeSynergies } from '../core/synergy.js';

export type Bot = (st: GameState, onFight?: (r: FightReport) => void) => void;

function power(g: Gladiator) { return g.base.hp / 10 + g.base.atk + g.base.def + g.wins * 2; }

function pickTeam(st: GameState, c: Contract, strategy: 'strong' | 'synergy'): Gladiator[] | null {
  const pool = available(st).filter(g => (g.fatigue ?? 0) < 2); // 피로 2 이상은 쉬게 한다
  if (pool.length < c.size) return null;
  const scoreOf = (g: Gladiator) => {
    let s = power(g) - (g.fatigue ?? 0) * 6; // 피로한 검투사는 뒤로
    return s;
  };
  const sorted = [...pool].sort((a, b) => scoreOf(b) - scoreOf(a));
  // 베테라누스 요구 충족
  const vets = sorted.filter(g => g.rank === 'veteranus');
  if (vets.length < c.needVeterans) return null;
  const team: Gladiator[] = [];
  for (const v of vets.slice(0, c.needVeterans)) team.push(v);
  for (const g of sorted) { if (team.length >= c.size) break; if (!team.includes(g)) team.push(g); }
  // 상대가 확연히 강하면 받지 않는다 (밸런스 시뮬용: 실제 플레이어는 공개 정보로 가늠)
  const mine = team.reduce((a, g) => a + power(g), 0) / team.length, theirs = c.enemy.reduce((a, g) => a + power(g), 0) / c.enemy.length;
  if (mine < theirs * 0.7) return null;
  if (strategy === 'synergy' && team.length >= 2) { // 시너지가 더 많이 나오는 조합으로 교체 시도
    for (const g of sorted) { if (team.includes(g)) continue; for (let k = team.length - 1; k >= 0; k--) { const alt = [...team]; alt[k] = g; if (describeSynergies(computeSynergies(alt)).length > describeSynergies(computeSynergies(team)).length && !validTeam(st, c, alt)) { team.splice(0, team.length, ...alt); break; } } }
  }
  return validTeam(st, c, team) ? null : team;
}

function buyPolicy(st: GameState, mode: 'cheap' | 'vets' | 'balanced', reserve: number) {
  const list = [...st.market].sort((a, b) => mode === 'cheap' ? a.buyPrice - b.buyPrice : mode === 'vets' ? b.buyPrice - a.buyPrice : power(b) / b.buyPrice - power(a) / a.buyPrice);
  for (const g of list) {
    if (mode === 'vets' && g.rank !== 'veteranus' && available(st).length >= 3) continue;
    if (st.roster.length >= Math.min(6, rosterCap(st))) break;
    if (st.money - g.buyPrice < reserve) continue;
    if (canBuy(st, g)) buy(st, g);
  }
}

function healAll(st: GameState) { for (const g of st.roster) if (g.injured > 0 && st.money > CONFIG.healCost + 2000) heal(st, g); }

function makeBot(buyMode: 'cheap' | 'vets' | 'balanced', team: 'strong' | 'synergy', accept: (c: Contract) => boolean): Bot {
  return (st, onFight) => {
    while (!st.over && st.season <= CONFIG.simSeasons) { // 시즌 제한이 없으므로 시뮬은 고정 길이
      const reserve = st.roster.length * CONFIG.upkeepPerGladiator * 2;
      { const c = upgradeCost(st, 'cells'); if (c != null && st.roster.length >= rosterCap(st) && rosterCap(st) < 6 && st.money > c + reserve + 4000) upgrade(st, 'cells'); } // 감방이 차면 증축
      { const c = upgradeCost(st, 'palus'); if (c != null && st.money > 25000 + c) upgrade(st, 'palus'); } // 여유 자금은 팔루스
      buyPolicy(st, buyMode, reserve);
      healAll(st);
      if (st.money > 15000) for (const g of st.roster) { if (st.money < 15000) break; if (skillTrainable(st, g) && !g.trained) { const r = doSkillTrain(st, g); if (r?.ok) learnSkill(g, r.id, skillsOf(g)[0]); continue; } train(st, g, g.base.atk <= g.base.def + 6 ? 'atk' : 'def'); } // 여유 자금은 훈련에 (기술 훈련 우선)
      const cs = [...st.contracts].sort((a, b) => b.tier - a.tier);
      let fought = false;
      for (const c of cs) {
        if (!accept(c)) continue;
        const t = pickTeam(st, c, team);
        if (!t) continue;
        if (HOST[c.host].bet) { const mine = t.reduce((a, g) => a + power(g), 0) / t.length, theirs = c.enemy.reduce((a, g) => a + power(g), 0) / c.enemy.length; c.bet = mine > theirs * 1.15; } // 우세하면 내기를 받는다
        const r = fight(st, c, t); onFight?.(r); fought = true; // 검투사는 시즌당 1회 출전이므로 사실상 인원이 허락하는 만큼
      }
      if (!fought) refuseAll(st);
      endSeason(st);
    }
  };
}

export const BOTS: Record<string, Bot> = {
  '싼놈모으기': makeBot('cheap', 'strong', () => true),
  '베테만': makeBot('vets', 'strong', () => true),
  '가성비+시너지': makeBot('balanced', 'synergy', () => true),
  '안전제일(등급1만)': makeBot('balanced', 'synergy', c => c.tier === 1 && c.host !== 'mourner'),
  '피계약만': makeBot('cheap', 'strong', c => c.host === 'mourner'),
};
