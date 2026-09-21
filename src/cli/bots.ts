// 자동 플레이 전략. 밸런스 검증용.
import type { GameState, FightReport } from '../core/game.js';
import { available, buy, canBuy, endSeason, fight, train, refuseAll, validTeam, rosterCap, upgrade, upgradeCost, trainCap, rerollMarket, pickTrainStat, acceptChallenge, declineChallenge, rivalOf, rivalStar, forfeitChallenges, canSendChallenge, sendChallenge, challengeFee, hireDoctor, doctorFor, inBed, putInBed, bedPatient } from '../core/game.js';
import { classKey } from '../core/classes.js';
import { fullyGrown } from '../core/growth.js';
import { HOST } from '../core/hosts.js';
import type { Contract, Gladiator } from '../core/types.js';
import { upkeepOf, type Facility } from '../core/game.js';
import { CONFIG } from '../core/config.js';
import { countTraits, TYPE_TRAITS } from '../core/traits.js';
import { isClassicPair } from '../core/classic.js';

export type Bot = (st: GameState, onFight?: (r: FightReport) => void) => void;

function power(g: Gladiator) { return g.base.hp / 10 + g.base.atk + g.base.def + g.wins * 2; }

function pickTeam(st: GameState, c: Contract): Gladiator[] | null {
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
  if (c.classic) { // 정식 대결: 상대마다 짝이 되는 유형을, 센 순서로 (베테라누스 요건은 validTeam 이 거른다)
    const rest = [...sorted]; for (const e of c.enemy) { const k = rest.findIndex(g => isClassicPair(g.type, e.type)); if (k < 0) return null; team.push(rest[k]); rest.splice(k, 1); }
  } else {
    for (const v of vets.slice(0, c.needVeterans)) team.push(v);
    if (c.size >= 2) { // 2인 이상: 센 후보 6명 안에서 전력 합 + 같은 특성 보너스(둘째 사람부터 한 명당 +6)가 가장 큰 조합 — 특성은 편성에서 센다 (2026-09-18)
      const cand = sorted.filter(g => !team.includes(g)).slice(0, 6); let best: Gladiator[] | null = null, bs = -Infinity;
      const rec = (start: number, cur: Gladiator[]) => { if (team.length + cur.length === c.size) { const all = [...team, ...cur]; const cnt = countTraits(all).trait; const mx = Math.max(...Object.values(cnt)); const sc = all.reduce((a, g) => a + scoreOf(g), 0) + (mx - 1) * 6; if (sc > bs) { bs = sc; best = [...cur]; } return; } for (let i = start; i < cand.length; i++) { cur.push(cand[i]); rec(i + 1, cur); cur.pop(); } };
      rec(0, []); if (best) team.push(...(best as Gladiator[]));
    }
    for (const g of sorted) { if (team.length >= c.size) break; if (!team.includes(g)) team.push(g); }
  }
  // 상대가 확연히 강하면 받지 않는다 (밸런스 시뮬용: 실제 플레이어는 공개 정보로 가늠)
  const mine = team.reduce((a, g) => a + power(g), 0) / team.length, theirs = c.enemy.reduce((a, g) => a + power(g), 0) / c.enemy.length;
  if (mine < theirs * 0.7) return null;
  return validTeam(st, c, team) ? null : team;
}

// 특성 몰기: 파밀리아에서 이미 가장 많은 특성에 합류하는 매물을 먼저 산다 (특성은 로스터에서 세므로 구매가 곧 특성 단계 — docs/08 R4)
function traitScore(st: GameState, g: Gladiator) { const c = countTraits(st.roster); return TYPE_TRAITS[g.type].reduce((a, t) => a + c.trait[t], 0) + c.lineage[g.lineage]; }
function buyPolicy(st: GameState, mode: 'cheap' | 'vets' | 'balanced' | 'trait', reserve: number, cap = 6) {
  if (mode === 'trait' && st.roster.length < Math.min(cap, rosterCap(st)) && st.money - CONFIG.market.reroll.cost >= reserve + 3000) { const c = countTraits(st.roster).trait; const top = (Object.keys(c) as (keyof typeof c)[]).sort((a, b) => c[b] - c[a])[0]; if (!st.market.some(g => TYPE_TRAITS[g.type].includes(top) && st.money - g.buyPrice >= reserve)) rerollMarket(st); } // 특성 몰기: 판매대에 우리가 가장 많이 모은 특성이 없으면 상인을 다시 부른다 (2026-09-18 3단계)
  const list = [...st.market].sort((a, b) => mode === 'cheap' ? a.buyPrice - b.buyPrice : mode === 'vets' ? b.buyPrice - a.buyPrice : mode === 'trait' ? (traitScore(st, b) - traitScore(st, a)) || (power(b) / b.buyPrice - power(a) / a.buyPrice) : power(b) / b.buyPrice - power(a) / a.buyPrice);
  for (const g of list) {
    if (mode === 'vets' && g.rank !== 'veteranus' && available(st).length >= 3) continue;
    if (st.roster.length >= Math.min(cap, rosterCap(st))) break;
    if (st.money - g.buyPrice < reserve) continue;
    if (canBuy(st, g)) buy(st, g);
  }
}

// 시설 강화 정책: 시즌마다 최대 둘까지, 예비금을 남기고 값싼 것부터. 사람 플레이어는 남는 돈을 시설에 넣는다 (2026-09-16 사용자: 실험에도 시설강화를 넣어야 한다)
function upgradePolicy(st: GameState, reserve: number) {
  const keep = upkeepOf(st) * 4 + reserve + 4000; // 유지비 넉 철치와 매물 살 돈은 남긴다 (시설을 올리면 유지비가 따라 오르므로 여유를 크게)
  const order: Facility[] = ['palus', 'medicine', 'kitchen', 'beds', 'herbs', 'gym'];
  for (let n = 0; n < 1; n++) { // 한 철에 하나씩만
    let best: { f: Facility; idx: number; cost: number } | null = null;
    for (const f of order) { const c = upgradeCost(st, f); if (c != null && st.money - c > keep && (!best || c < best.cost)) best = { f, idx: 0, cost: c }; }
    for (let i = 0; i < st.ludus.cells.length; i++) { const c = upgradeCost(st, 'cell', i); if (c != null && st.money - c > keep && (!best || c < best.cost)) best = { f: 'cell', idx: i, cost: c }; } // 숙소 질: 피로가 덜 쌓인다
    if (!best) return;
    upgrade(st, best.f, best.idx);
  }
}
function healAll(st: GameState) { for (const g of st.roster) { if (g.injured <= 0 || inBed(st, g)) continue; for (let k = 0; k < st.ludus.beds; k++) { if (bedPatient(st, k)) continue; if (putInBed(st, g, k)) break; } } } /* 빈 침상만 — 점유된 침상을 덮어쓰면 마지막 부상자만 눕는다 (Codex 리뷰 P1) */ // 즉시 치료는 없다 — 빈 침상에 눕힌다 (2026-09-21)

function makeBot(buyMode: 'cheap' | 'vets' | 'balanced' | 'trait', accept: (c: Contract) => boolean, cellsTo = 6): Bot { // cellsTo: 켈라를 몇 칸까지 늘리나 (특성 몰기는 15 — 6명 3단계를 보려고)
  return (st, onFight) => {
    while (!st.over && st.season <= CONFIG.simSeasons) { // 시즌 제한이 없으므로 시뮬은 고정 길이
      const reserve = st.roster.length * CONFIG.upkeepPerGladiator * 2;
      { const c = upgradeCost(st, 'cells'); if (c != null && st.roster.length >= rosterCap(st) && rosterCap(st) < cellsTo && st.money > c + reserve + 4000) upgrade(st, 'cells'); } // 감방이 차면 증축
      upgradePolicy(st, reserve); // 남는 돈은 시설로 (사람 플레이어처럼): 팔루스 → 의술 → 숙소 질 → 조리장 → 침상 → 약재 → 훈련 시설
      if (st.season >= 5) { // 독토르(2026-09-21 사용자: 시즌 5쯤부터): 가장 많은 클래스에 독토르가 없으면 — 우리 자유민(루디스)을 앉히거나, 문 앞 자유민 지원자를 사서 앉힌다
        const fighters = st.roster.filter(g => g.alive && g.status !== 'doctor'); const cnt: Record<string, number> = {}; for (const g of fighters) cnt[classKey(g.type)] = (cnt[classKey(g.type)] ?? 0) + 1;
        const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]?.[0]; const has = top && fighters.some(g => classKey(g.type) === top && doctorFor(st, g.type));
        if (top && !has && fighters.length >= 5 && st.money > reserve + 12000) { const own = st.roster.find(g => g.status === 'rudiarius' && classKey(g.type) === top); if (own) hireDoctor(st, own); /* 급료 800 이 봇 살림엔 무겁다: 싸울 사람 다섯에 돈이 넉넉할 때만 (09-21 측정: 조건 없이 앉히면 파산 11~20%) */
          else { const ap = st.applicants.find(g => classKey(g.type) === top); if (ap && !st.roster.some(g => g.status === 'doctor') && st.money - ap.buyPrice > reserve + 9000 && st.roster.length < rosterCap(st) && buy(st, ap)) hireDoctor(st, ap); } } } /* 독토르는 한 명, 살림이 넉넉할 때만 (급료 800 — 09-21 첫 시험에서 파산 14~20%) */
      buyPolicy(st, buyMode, reserve, cellsTo);
      healAll(st);
      { let slots = trainCap(st); for (const g of st.roster) { if (slots <= 0 || st.money < reserve + CONFIG.trainCost) break; if (g.injured || g.status === 'doctor' || g.trained || fullyGrown(g)) continue; // 팔루스 자리만큼 매 시즌 훈련한다 (플레이어가 팔루스에 세우는 것과 같게). 낮은 능력치를 단련
        train(st, g, pickTrainStat(st.rng, g)); slots--; } }
      { const best = Math.max(0, ...available(st).map(power)); for (const rv of st.rivals) { const star = rivalStar(rv); if (!star || !canSendChallenge(st, rv) || st.money < challengeFee(st, rv) + reserve) continue; if (best >= power(star) * 1.05) { sendChallenge(st, rv); break; } } } // 도전을 건다: 우리 으뜸이 간판보다 5% 세면 (시즌당 하나)
      for (const c of [...st.pendingChallenges]) { const rv = rivalOf(st.rivals, c.rivalId); const star = rv ? rivalStar(rv) : undefined; const best = Math.max(0, ...available(st).map(power)); if (star && best >= power(star) * 0.9 && !acceptChallenge(st, c)) continue; declineChallenge(st, c); } // 도전장: 우리 으뜸이 간판의 90% 이상이면 받는다
      const cs = [...st.contracts].sort((a, b) => (b.challenge ? 1 : 0) - (a.challenge ? 1 : 0) || b.tier - a.tier); // 도전 계약부터 (받았으면 반드시 세운다)
      let fought = false; const fightedIds = new Set<number>();
      for (const c of cs) {
        if (!accept(c)) continue;
        const t = pickTeam(st, c);
        if (!t) continue;
        if (HOST[c.host].bet) { const mine = t.reduce((a, g) => a + power(g), 0) / t.length, theirs = c.enemy.reduce((a, g) => a + power(g), 0) / c.enemy.length; c.bet = mine > theirs * 1.15; } // 우세하면 내기를 받는다
        const r = fight(st, c, t); onFight?.(r); fought = true; fightedIds.add(c.id); // 검투사는 시즌당 1회 출전이므로 사실상 인원이 허락하는 만큼
      }
      forfeitChallenges(st, st.contracts.filter(c => c.challenge && !fightedIds.has(c.id))); // 받아 놓고 못 세운 도전은 벌을 받는다
      if (!fought) refuseAll(st);
      endSeason(st);
    }
  };
}

export const BOTS: Record<string, Bot> = {
  '싼놈모으기': makeBot('cheap', () => true),
  '베테만': makeBot('vets', () => true),
  '가성비': makeBot('balanced', () => true), // (구) 가성비+시너지 — 시너지는 2026-09-18 특성으로 바뀌어 편성 조합이 아니라 구매의 문제가 됐다
  '특성몰기(15칸)': makeBot('trait', () => true, 15), // 같은 특성을 사 모으고 켈라를 15칸까지 — 특성 2·3단계를 재는 봇
  '안전제일(등급1만)': makeBot('balanced', c => c.tier === 1 && c.host !== 'mourner'),
  '피계약만': makeBot('cheap', c => c.host === 'mourner'),
};
