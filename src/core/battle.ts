// 위치 기반 자동전투. 0.1초 틱의 2D 시뮬레이션. 화면은 이 결과(프레임·이벤트)를 재생만 한다.
// (턴제 버전은 battle_turnbased.ts.txt 에 보관)
// 2026-09-18 재정비(docs/09): 유형은 능력치·속도·접근 방식·특성·계보에 **장비 수치 둘(사거리·막기)** 과 **딕타타 셋(주장비·보조장비·유형)** 으로 갈린다.
// 투구·받아넘기기·닳음·다리 노리기·무기 놓침은 없다. 기술 층은 별개로 나중에.
import type { BattleEvent, BattleFrame, BattleResult, Gladiator, UnitStats } from './types.js';
import { Rng } from './rng.js';
import { CONFIG } from './config.js';
import { effectiveStats } from './gladiator.js';
import { noTraits, unitMods, type TraitLevels, type TraitMods } from './traits.js';
import { epithetMods } from './epithets.js';
import { TYPE_TRAIT } from './equipment.js';
import { rangeOf, blockOf, reachOf } from './classes.js';
import { basicDictataOf, masteryOf, mergeMastery, type DictataId, type MergedEffect, type AfterHit } from './dictata.js';

export const ARENA = { w: 720, h: 320, margin: 40 };
const DT = 0.1;                 // 틱(초)
const MAX_T = 60;               // 제한 시간(초) → 무승부

interface Unit {
  g: Gladiator; side: 'A' | 'B';
  x: number; y: number; hp: number;
  atk: number; def: number; spd: number; hand: number; range: number; reach: number; m: TraitMods; // spd 걸음 · hand 손놀림 // m: 특성 보정 (편성에서 센 단계 → 이 검투사에게 걸리는 것만)
  d: Set<DictataId>;            // 아는 딕타타 (주장비·보조장비·유형)
  ms: MergedEffect;             // 익힌 숙련 딕타타의 효과, 합친 것 (docs/09 2-α)
  slowUntil: number; slowMul: number; wallUntil: number; wallUsed: boolean; windUsed: boolean; ignoreUntil: number; throwUsed: boolean; shieldUps: number; lastShove: number; rechargeAt: number;
  blockChance: number;          // 보조장비 막기 (큰 .5 · 작은 .3 · 맨몸 0)
  moveSpeed: number;            // px/초
  interval: number;             // 공격 간격(초)
  cooldown: number;             // 남은 대기(초)
  boundUntil: number;           // 넘어짐·붙듦·그물로 움직이지 못하는 동안
  target?: number;
  lastAttacker?: number;
  retreatUntil: number;         // 타격 후 이탈하는 동안
  circleDir: 1 | -1;
  feintUntil: number;           // 짧게 들어갔다 빠지는 페인트
  feintIn: boolean;
  holdUntil: number;            // 공격·피격 동작 중 제자리
  sprint: boolean;              // 전력 질주 중(도착하면 돌진 공격)
  prevTarget?: number;
  stamina: number; openUntil: number;   // 스태미나(0~max) · openUntil: 헛디뎌 빈틈이 열린 동안
  lastD: number; pokeAt: Record<number, number>; // 길목 찌르기: 지난 틱 거리 · 상대별 마지막 찌르기 시각
  netUsed: boolean; lassoAt: number;    // 그물(한 번) · 올가미(간격)
  shieldUpUntil: number; shieldUpDone: boolean; // 무르밀로 방패 세우기
  mounted: boolean;             // 에퀘스: 말 위 (첫 돌진까지)
  guardUntil: number;           // 창 벽에 밀려 공격이 무산된 직후
  s: UnitStats;
}

const newStats = (): UnitStats => ({ dmgDealt: 0, dmgTaken: 0, blocks: 0, blockedOn: 0, crits: 0, critsTaken: 0, combos: 0, charges: 0, chargedOn: 0, kills: 0, boundKills: 0, misses: 0, boundTimes: 0, flanked: 0, rangedDmg: 0, inside: 0, nearAllySec: 0, dictata: {} });
function makeUnits(team: Gladiator[], side: 'A' | 'B', L: TraitLevels, hpBonus = 0, boosted?: Set<number>, boostMul = 1): Unit[] {
  return team.map((g, i) => {
    const s = effectiveStats(g); s.hp += hpBonus; // 조리장(식단) 보너스
    if (boosted?.has(g.id)) s.atk = Math.round(s.atk * boostMul); // 원한: 살려 준 상대가 이를 간다
    const m = unitMods(g, L); // 특성: 편성에서 센 단계 중 이 검투사가 가진 것만
    const atk = Math.round(s.atk * m.atkMul), def = s.def + m.def; const spd = s.spd + m.spd, hand = s.hand;
    const range = rangeOf(g.type); const ms0 = mergeMastery(masteryOf(g)); const reach = reachOf(g.type) * (ms0.mountedRange && basicDictataOf(g.type).some(x => x.id === 'dismount') ? 2 : 1); // 말 위 찌르기: 말 위 돌진은 사거리 2
    const n = team.length;
    const y = ARENA.h / 2 + (i - (n - 1) / 2) * 90;
    const x = side === 'A' ? (range >= 2 ? 80 : 170) : (range >= 2 ? ARENA.w - 80 : ARENA.w - 170);
    const d = new Set<DictataId>(basicDictataOf(g.type).map(x => x.id)); const ms = mergeMastery(masteryOf(g));
    return {
      g, side, x, y, hp: s.hp, atk, def, spd, hand, range, reach, m, d, ms, blockChance: blockOf(g.type),
      slowUntil: 0, slowMul: 0, wallUntil: 0, wallUsed: false, windUsed: false, ignoreUntil: -1, throwUsed: false, shieldUps: 0, lastShove: -9, rechargeAt: -9,
      moveSpeed: 60 + spd * 7, interval: Math.max(0.8, 1.8 - hand * 0.08), // 걸음은 이동, 손놀림은 공격 간격
      cooldown: 1.0 + ((i * 0.37 + (side === 'A' ? 0 : 0.2)) % 1.0) * 1.2, // 시작은 견제부터 (1.0~2.2초)
      retreatUntil: 0, circleDir: (i % 2 === 0 ? 1 : -1) as 1 | -1, feintUntil: 0, feintIn: true, holdUntil: 0, sprint: false,
      boundUntil: 0, stamina: CONFIG.stamina.max + m.staminaMax, openUntil: 0,
      lastD: 999, pokeAt: {}, netUsed: !d.has('net'), lassoAt: -99, shieldUpUntil: 0, shieldUpDone: false, mounted: d.has('dismount'), guardUntil: 0, s: newStats(),
    };
  });
}

export function battle(rng: Rng, teamA: Gladiator[], teamB: Gladiator[], opts: { hpBonusA?: number; boostedB?: Set<number>; boostMul?: number; traitsA?: TraitLevels; traitsB?: TraitLevels } = {}): BattleResult { // traitsA/B: 각 편성에서 센 특성 단계 (없으면 0 — 시뮬·테스트)
  const units = [...makeUnits(teamA, 'A', opts.traitsA ?? noTraits(), opts.hpBonusA ?? 0), ...makeUnits(teamB, 'B', opts.traitsB ?? noTraits(), 0, opts.boostedB, opts.boostMul ?? 1)];
  const form: Record<number, number> = {}; const teamForm = { A: rng.range(-1, 1), B: rng.range(-1, 1) }; for (const u of units) { const f = u.g.form ?? (teamForm[u.side] * CONFIG.form.team + rng.range(-1, 1) * (1 - CONFIG.form.team)); form[u.g.id] = f; /* 우리 검투사는 시즌 시작에 정해 둔 값(g.form), 상대는 경기 때 굴린다 */ const F = CONFIG.form; u.hp = Math.max(1, u.hp + Math.round(f * F.hp)); u.atk = Math.max(1, u.atk + Math.round(f * F.atk)); u.def = Math.max(0, u.def + Math.round(f * F.def)); }
  const byId = new Map(units.map(u => [u.g.id, u]));
  const log: string[] = [];
  const events: BattleEvent[] = [];
  const frames: BattleFrame[] = [];
  const initialHp: Record<number, number> = Object.fromEntries(units.map(u => [u.g.id, u.hp]));
  const mounted: Record<number, number> = Object.fromEntries(units.filter(u => u.mounted).map(u => [u.g.id, Infinity]));
  const alive = (side: 'A' | 'B') => units.filter(u => u.side === side && u.hp > 0);
  const dist = (a: Unit, b: Unit) => Math.hypot(a.x - b.x, a.y - b.y);
  const natureFirst = { A: true, B: true }; // 자연 계보 2단계: 첫 공격에 붙듦 (편당 한 번)
  const fmt = (t: number) => t.toFixed(1) + 's';
  const D = CONFIG.dictata, ST = CONFIG.stamina;
  const used = (u: Unit, id: DictataId) => { u.s.dictata[id] = (u.s.dictata[id] ?? 0) + 1; };
  const clamp = (u: Unit) => { u.x = Math.max(ARENA.margin, Math.min(ARENA.w - ARENA.margin, u.x)); u.y = Math.max(ARENA.margin, Math.min(ARENA.h - ARENA.margin, u.y)); };
  const push = (a: Unit, b: Unit, px: number) => { const dd = Math.max(1, dist(a, b)); b.x += (b.x - a.x) / dd * px; b.y += (b.y - a.y) / dd * px; clamp(b); };
  const ev = (e: Omit<BattleEvent, 't' | 'turn'>) => events.push({ t: +t.toFixed(2), turn: Math.floor(t) + 1, ...e });
  const pOf = (u: Unit, id: DictataId, base: number) => base * (u.ms.pMuls[id] ?? 1); // 숙달: 기본 딕타타 확률 ×
  const follow = (a: Unit, b: Unit, when: AfterHit['when']): boolean => { for (const A of a.ms.afterHits) { if (A.when !== when || b.hp <= 0 || a.hp <= 0) continue; if (rng.chance(A.p)) { if (strike(a, b, A.mult, masteryOf(a.g).find(m => m.eff.afterHit === A)?.id ?? 'follow', when === 'riposte' || when === 'deflect')) return true; } } return false; }; // 뒤따르는 타격: 조건이 맞는 것을 전부 굴린다 (쓰러뜨리면 true)
  const trip = (v: Unit, sec: number) => { if (v.ms.noTrip) return false; v.boundUntil = Math.max(v.boundUntil, t + sec * v.m.boundMul); v.holdUntil = Math.max(v.holdUntil, t + sec * v.m.boundMul); v.sprint = false; v.s.boundTimes++; return true; }; // 넘어뜨리기 (굳건히 서기는 무효)
  const stumble = (v: Unit, sec: number) => { v.openUntil = Math.max(v.openUntil, t + sec); v.holdUntil = Math.max(v.holdUntil, t + sec); v.sprint = false; }; // 헛디딤(빈틈)
  const strike = (a: Unit, b: Unit, mult: number, id: string, counter = true) => { const dm = Math.max(1, Math.round(a.atk * mult * rng.range(0.85, 1.15) - b.def * 0.5)); b.hp -= dm; b.lastAttacker = a.g.id; a.s.dmgDealt += dm; b.s.dmgTaken += dm; a.s.dictata[id] = (a.s.dictata[id] ?? 0) + 1; ev({ kind: 'attack', actor: a.g.id, target: b.g.id, dmg: dm, targetHp: Math.max(0, b.hp), counter, net: false, blocked: false, combo: false, charge: false, crit: false, downed: b.hp <= 0, dictata: id }); log.push(`${fmt(t)} ${a.g.name} ${id} → ${b.g.name} ${dm}${b.hp <= 0 ? ' 쓰러짐' : ''}`); if (b.hp <= 0) a.s.kills++; return b.hp <= 0; }; // 숙련 딕타타의 추가 타격

  for (const u of units) if (Math.abs(form[u.g.id]) >= CONFIG.form.tell) log.push(`0.0s ${u.g.name} 오늘 몸이 ${form[u.g.id] > 0 ? '가볍다' : '무겁다'}`);
  let t = 0;
  const snapshot = () => frames.push({ t: +t.toFixed(2), u: units.map(u => [u.g.id, Math.round(u.x), Math.round(u.y), Math.max(0, Math.round(u.hp)), Math.max(0, Math.round(u.stamina))]) });
  snapshot();

  for (t = 0; t < MAX_T; t = +(t + DT).toFixed(2)) {
    // 행동 순서: 속도 높은 순 (동률은 난수)
    const order = units.filter(u => u.hp > 0).sort((a, b) => (b.spd + (b.ms.firstStrike ? 100 : 0)) - (a.spd + (a.ms.firstStrike ? 100 : 0)) || rng.next() - 0.5);
    for (const u of order) {
      if (u.hp <= 0) continue;
      const enemies = alive(u.side === 'A' ? 'B' : 'A');
      if (!enemies.length) break;
      if (t < u.boundUntil) continue; // 넘어짐·붙듦·그물
      u.cooldown -= DT;
      u.stamina = Math.min(ST.max + u.m.staminaMax, u.stamina + ST.regen * u.m.regenMul * DT); const winded = u.stamina < u.m.windedAt && t >= u.ignoreUntil; // 숨은 늘 조금씩 돌아온다. 바닥이면 지침 (숨 참기 동안은 무시)
      const holding = t < u.holdUntil; // 동작 중엔 이동하지 않는다
      if (u.d.has('shield_up') && u.shieldUps < (u.ms.shieldUpTwice ? 2 : 1) && t >= u.shieldUpUntil + 2 && u.hp < initialHp[u.g.id] * D.shieldUp.at / (u.shieldUps + 1)) { u.shieldUps++; u.shieldUpDone = true; u.shieldUpUntil = t + D.shieldUp.sec; used(u, 'shield_up'); ev({ kind: 'dictata', actor: u.g.id, dictata: 'shield_up' }); log.push(`${fmt(t)} ${u.g.name} 방패를 세운다`); } // 무르밀로: HP 절반 아래 첫 진입

      if (u.ms.shieldWall && !u.wallUsed && u.hp < initialHp[u.g.id] * u.ms.shieldWall.at) { u.wallUsed = true; u.wallUntil = t + u.ms.shieldWall.sec; ev({ kind: 'dictata', actor: u.g.id, dictata: 'big_wall' }); }
      if (u.ms.staminaIgnore && u.ignoreUntil < 0 && u.stamina < u.m.windedAt) { u.ignoreUntil = t + u.ms.staminaIgnore; ev({ kind: 'dictata', actor: u.g.id, dictata: 't_sec_breath' }); }
      // ── 대상 선택: 가까운 적 우선. 추격(세쿠토르)은 창 든·묶인 적 우선. 아군 보호(위험한 아군을 때리는 근처 적)
      const trait = TYPE_TRAIT[u.g.type];
      let cands = enemies;
      if (u.d.has('pursue')) { const prey = enemies.filter(e => e.range >= 2 || t < e.boundUntil); if (prey.length) cands = prey; }
      let target = cands.reduce((m, e) => dist(u, e) < dist(u, m) ? e : m);
      const allies = alive(u.side).filter(a => a !== u);
      for (const a of allies) {
        if (a.hp / initialHp[a.g.id] < 0.4 && a.lastAttacker != null) {
          const foe = byId.get(a.lastAttacker); if (foe && foe.hp > 0 && dist(u, foe) < 160) { target = foe; break; }
        }
      }
      if (u.prevTarget != null && u.prevTarget !== target.g.id && byId.get(u.prevTarget)!.hp <= 0) u.sprint = true; // 쓰러뜨리고 합류: 뛰어든다
      u.prevTarget = target.g.id; u.target = target.g.id;
      if (allies.some(a => dist(u, a) < 90)) u.s.nearAllySec += DT; if (enemies.filter(e => dist(u, e) <= e.reach + 6).length >= 2) u.s.flanked += DT;

      // ── 이동 모델: 이탈(때린 뒤 거리 벌림) → 견제(거리 유지·옆으로 돌기·페인트) → 돌입(준비되면 전속력)
      const d = dist(u, target);
      const ux = (target.x - u.x) / Math.max(1, d), uy = (target.y - u.y) / Math.max(1, d);
      let vx = 0, vy = 0;
      const ready = u.cooldown <= 0.3;
      if (u.ms.recharge && !u.sprint && d > u.reach && (t < target.boundUntil || t < target.openUntil) && t >= u.rechargeAt + 3) { u.sprint = true; u.rechargeAt = t; } // 재돌격: 넘어지거나 묶인 상대에 다시 돌진
      const farSprint = u.ms.shortCharge ? 90 : 150;
      if (u.mounted) { u.sprint = true; vx = ux; vy = uy; }                                  // 말 위: 곧장 달린다 (첫 돌진)
      else if (t < u.retreatUntil && d < 100) { vx = -ux; vy = -uy; }                       // 이탈: 100까지만 벌린다
      else if (u.range >= 2) {                                                              // 창: 멀면 접근, 붙으면 그 자리에서 싸움 (도망치지 않음)
        if (d > u.reach) { if (d > 150 || u.sprint) u.sprint = true; vx = ux; vy = uy; }
        else { vx = -uy * 0.35 * u.circleDir; vy = ux * 0.35 * u.circleDir; }
      }
      else if (ready && !(t < target.retreatUntil && d > u.reach)) {                         // 돌입 (이탈 중인 상대는 쫓지 않음)
        if (d > u.reach) {
          const style = trait.style;
          if (d > farSprint || u.sprint) { u.sprint = true; vx = ux; vy = uy; }                     // 멀면 전력 질주 → 도착 즉시 돌진 공격
          else if (style === 'cautious') { vx = ux * 0.6 + -uy * 0.5 * u.circleDir; vy = uy * 0.6 + ux * 0.5 * u.circleDir; }       // 방패 세우고 옆걸음
          else if (style === 'feint') { const z = Math.sin(t * 9 + u.g.id); vx = ux * 0.8 + -uy * 0.9 * z; vy = uy * 0.8 + ux * 0.9 * z; } // 지그재그
          else { vx = ux; vy = uy; }
        }
      }
      else {                                                                                 // 견제: 100 안팎 유지 + 옆으로 + 페인트
        if (t < u.feintUntil) { const k = u.feintIn ? 0.9 : -0.9; vx = ux * k; vy = uy * k; }
        else {
          if (d < 80) { vx = -ux * 0.7; vy = -uy * 0.7; } else if (d > 120) { vx = ux * 0.7; vy = uy * 0.7; }
          vx += -uy * 0.6 * u.circleDir; vy += ux * 0.6 * u.circleDir;
          if (rng.chance(0.06)) { u.feintUntil = t + 0.25; u.feintIn = rng.chance(0.6); }   // 가끔 들어갔다 빠짐
          if (rng.chance(0.02)) u.circleDir = (u.circleDir === 1 ? -1 : 1);
        }
      }
      // 모든 유닛과 최소 간격 (뭉침 방지)
      for (const o of units) { if (o === u || o.hp <= 0) continue; const dd = dist(u, o); const rad = o.side === u.side ? 52 : 40; if (dd < rad && dd > 0) { const f = (rad - dd) / rad * 1.5; vx += (u.x - o.x) / dd * f; vy += (u.y - o.y) / dd * f; } }
      const vlen = holding ? 0 : Math.hypot(vx, vy);
      if (vlen > 0) {
        const sp = u.moveSpeed * (u.sprint ? 1.7 : 1) * (winded ? ST.windedMove : 1) * (t < u.slowUntil ? 1 - u.slowMul : 1) * (t < u.retreatUntil ? (u.ms.retreatMul ?? 1) : 1);
        if (u.sprint && !u.mounted) u.stamina = Math.max(0, u.stamina - ST.sprintPerSec * DT);
        if (winded && !u.mounted && !u.ms.noTrip && rng.chance(CONFIG.trip.chance * (u.sprint ? 2.5 : 1))) { trip(u, CONFIG.trip.sec); /* 지친 채 달리다 넘어진다 */
          ev({ kind: 'stumble', actor: u.g.id, trip: true }); log.push(`${fmt(t)} ${u.g.name} 발이 걸려 넘어짐!`); } // 질주는 숨을 먹는다
        u.x += vx / vlen * sp * DT; u.y += vy / vlen * sp * DT; clamp(u);
      }

      { const d3 = dist(u, target);
        if (u.ms.throwOnce && !u.throwUsed && d3 > u.reach + 20 && d3 < 200 && t >= target.guardUntil) { u.throwUsed = true; strike(u, target, u.ms.throwOnce, 'spear_throw', false); u.cooldown = Math.max(u.cooldown, 0.6); } // 창 던지기: 경기 한 번
        if (u.ms.farNet && !u.netUsed && d3 > u.reach && d3 <= 140 && u.cooldown <= 0.3) { u.netUsed = true; used(u, 'net'); if (rng.chance(Math.max(D.net.min, D.net.base - 0.1 - target.spd * D.net.perSpd))) { target.boundUntil = t + D.net.sec * target.m.boundMul * (target.ms.boundCut ?? 1); target.s.boundTimes++; ev({ kind: 'attack', actor: u.g.id, target: target.g.id, dmg: 0, targetHp: Math.max(0, target.hp), counter: false, net: true, blocked: false, combo: false, charge: false, crit: false, downed: false, dictata: 'net' }); } else { u.s.misses++; if (u.ms.netRecover) u.netUsed = false; ev({ kind: 'attack', actor: u.g.id, target: target.g.id, dmg: 0, targetHp: Math.max(0, target.hp), counter: false, net: false, netMiss: true, blocked: false, combo: false, charge: false, crit: false, downed: false, dictata: 'net' }); } u.cooldown = Math.max(u.cooldown, 0.8); } } // 물러서며 던지기: 거리에서 그물
      // ── 길목 찌르기(창) · 방패 밀기(큰방패): 공격 순서와 별개로 매 틱
      { const d2 = dist(u, target);
        if (u.d.has('poke') && u.lastD > u.reach && d2 <= u.reach && t >= (u.pokeAt[target.g.id] ?? -99) + D.poke.gap * (u.ms.pokeGapMul ?? 1) && t >= target.guardUntil && !u.mounted) { // 밖에서 안으로 들어오는 순간 창끝이 먼저 닿는다
          u.pokeAt[target.g.id] = t; u.cooldown = Math.max(u.cooldown, u.interval * D.poke.cost); used(u, 'poke');
          const pk = Math.max(1, Math.round(u.atk * D.poke.mult - target.def * 0.5)); target.hp -= pk; target.lastAttacker = u.g.id; u.s.dmgDealt += pk; u.s.rangedDmg += pk; target.s.dmgTaken += pk; push(u, target, D.poke.push);
          ev({ kind: 'attack', actor: u.g.id, target: target.g.id, dmg: pk, targetHp: Math.max(0, target.hp), counter: true, net: false, blocked: false, combo: false, charge: false, crit: false, downed: target.hp <= 0, dictata: 'poke' });
          log.push(`${fmt(t)} ${u.g.name} 창끝으로 막아섬 → ${target.g.name} ${pk}${target.hp <= 0 ? ' 쓰러짐' : ''}`); if (target.hp <= 0) u.s.kills++;
          else follow(u, target, 'poke'); }
        else if (u.d.has('shove') && d2 <= u.reach + 8 && !holding && u.cooldown > 0.25 && rng.chance(D.shove.p)) { // 방패 밀기: 공격 사이에 상대를 밀어 숨을 깎는다
          push(u, target, D.shove.push); target.stamina = Math.max(0, target.stamina - D.shove.stamina); target.holdUntil = Math.max(target.holdUntil, t + 0.15); used(u, 'shove');
          ev({ kind: 'shove', actor: u.g.id, target: target.g.id, dictata: 'shove' }); u.lastShove = t;
          follow(u, target, 'shove'); }
        u.lastD = d2; }
      // ── 공격
      if (u.cooldown > 0) continue;
      if (dist(u, target) > u.reach) { if (!(u.ms.chaseHit && t < target.retreatUntil && dist(u, target) <= u.reach + 30 && rng.chance(u.ms.chaseHit))) continue; } // 끝까지 쫓기: 이탈하는 상대를 따라가 한 타
      if (t < target.guardUntil || t < u.guardUntil) continue;
      if (target.d.has('spear_wall') && u.range < 2 && !u.mounted && rng.chance(pOf(target, 'spear_wall', D.spearWall.p))) { // 호플로마쿠스 창 벽: 붙은 근접 상대의 공격을 창으로 밀어 무산시키고 찌른다
        u.sprint = false; u.retreatUntil = t + 0.7; u.holdUntil = t + 0.3; u.cooldown = u.interval * 0.6; used(target, 'spear_wall');
        const poke = Math.max(2, Math.round(target.atk * D.spearWall.poke - u.def * 0.5)); u.hp -= poke; u.lastAttacker = target.g.id; target.s.dmgDealt += poke; u.s.dmgTaken += poke; push(target, u, D.spearWall.push);
        ev({ kind: 'attack', actor: target.g.id, target: u.g.id, dmg: poke, targetHp: Math.max(0, u.hp), counter: true, net: false, blocked: false, combo: false, charge: false, crit: false, downed: u.hp <= 0, dictata: 'spear_wall' });
        log.push(`${fmt(t)} ${target.g.name} 창 벽 → ${u.g.name} ${poke}${u.hp <= 0 ? ' 쓰러짐' : ''}`); if (u.hp <= 0) target.s.kills++; else follow(target, u, 'poke'); continue; }
      if (winded && !u.mounted && rng.chance(ST.stumble * u.m.stumbleMul)) { u.sprint = false; u.holdUntil = t + ST.stumbleSec; u.openUntil = t + ST.stumbleSec; u.cooldown = ST.stumbleSec; for (const e of enemies) if (dist(e, u) < 120) { e.cooldown = Math.min(e.cooldown, 0.3); e.retreatUntil = 0; } ev({ kind: 'stumble', actor: u.g.id, target: target.g.id }); log.push(`${fmt(t)} ${u.g.name} 지쳐서 헛디딤`); continue; } // 지치면 헛디딘다: 공격이 무산되고 빈틈이 열린다
      u.stamina = Math.max(0, u.stamina - ST.swing); // 휘두르는 값
      const charge = u.sprint; u.sprint = false;
      const mountedCharge = u.mounted && charge; if (mountedCharge) { u.mounted = false; mounted[u.g.id] = t; used(u, 'dismount'); if (u.ms.mountedRange) u.reach = reachOf(u.g.type); } // 에퀘스: 말 위 첫 돌진 — 부딪히고 내린다
      u.cooldown = u.interval * (winded ? ST.windedInterval : 1);
      u.holdUntil = t + 0.45;                                        // 공격 동작이 끝날 때까지 제자리
      if (u.range < 2) u.retreatUntil = u.holdUntil + 0.4 + rng.next() * 0.3; // 그 뒤 짧게 이탈
      if (rng.chance(0.4)) u.circleDir = (u.circleDir === 1 ? -1 : 1);
      if (charge) { u.s.charges++; target.s.chargedOn++; }
      for (let hit = 0; hit < (u.ms.comboTwice ? 3 : 2); hit++) {
        if (hit >= 1) { const cb = CONFIG.combo.base + u.hand * CONFIG.combo.perSpd + (u.d.has('twin') ? D.twin.combo : 0); const cc = cb + Math.max(0, Math.min(u.m.combo, CONFIG.traits.bare.comboCap - cb)); /* 맨몸 특성은 상한까지만 */ if (target.hp <= 0 || !rng.chance(cc)) break; }
        const combo = hit >= 1; if (combo) { u.s.combos++; if (u.d.has('twin')) used(u, 'twin'); }
        let dictata: DictataId | undefined;
        let mult = 1.0;
        if (target.g.type === 'retiarius') mult *= epithetMods(u.g).vsRetiarius; // 별칭 '그물꾼의 악몽'
        if (target.hp / initialHp[target.g.id] < 0.15) mult *= u.m.finishMul; // 승리 계보 2단계: 끝을 낸다
        if (u.ms.finishMul && target.hp / initialHp[target.g.id] < 0.2) mult *= u.ms.finishMul; // 마무리 찌르기
        if (charge && !combo) { mult *= 1.15 * u.m.chargeMul; // 돌진 공격: 기세 보너스
          if (u.d.has('pursue') && (target.range >= 2 || t < target.boundUntil)) { mult *= t < target.boundUntil ? D.pursue.bound : D.pursue.ranged; dictata = 'pursue'; used(u, 'pursue'); } // 세쿠토르 추격
          if (mountedCharge) { mult *= D.dismount.mult; dictata = 'dismount'; } }
        let defUsed = target.def;
        if (!combo && u.d.has('feint') && rng.chance(pOf(u, 'feint', D.feint.p))) { defUsed = 0; dictata = 'feint'; used(u, 'feint'); } // 트라엑스 허초: 방어 무시
        else if (!combo && u.d.has('thrust') && rng.chance(pOf(u, 'thrust', D.thrust.p))) { defUsed = Math.round(defUsed * D.thrust.defMul); dictata = 'thrust'; used(u, 'thrust'); } // 글라디우스 찌르기: 방어 절반
        let crit = rng.chance(CONFIG.crit.base + u.m.crit + u.hand * CONFIG.crit.perSpd);
        if (crit && target.d.has('chest') && rng.chance(pOf(target, 'chest', D.chest.p))) { crit = false; used(target, 'chest'); ev({ kind: 'dictata', actor: target.g.id, target: u.g.id, dictata: 'chest' }); } // 프로보카토르 가슴판: 치명타를 튕긴다
        const open = t < target.openUntil || t < target.boundUntil; // 빈틈 강타: 헛디딘·넘어진·묶인 상대는 방어가 없다
        if (crit) { mult *= CONFIG.crit.mult * u.m.critMultMul * (u.ms.critMul ?? 1); defUsed = Math.round(defUsed * (1 - CONFIG.crit.defIgnore)); u.s.crits++; target.s.critsTaken++; } if (open) { mult *= ST.openMult * u.m.openMul; defUsed = Math.round(defUsed * (1 - ST.openIgnore)); }
        if (u.range >= 2 && dist(u, target) < 34) { u.s.inside += 1; } // (품 안 페널티는 없다 — 누적치만 센다)
        let dmg = Math.max(1, Math.round(u.atk * mult * rng.range(0.85, 1.15) - defUsed));
        { const dg = target.ms.dodges.find(dd => (!dd.only || (dd.only === 'crit' && crit) || (dd.only === 'charge' && charge && !combo)) && t >= target.boundUntil && rng.chance(dd.p)); if (dg) { ev({ kind: 'dictata', actor: target.g.id, target: u.g.id, dictata: dg.only === 'crit' ? 'c_bc_duck' : dg.only === 'charge' ? 'small_roll' : 'bare_sway' }); break; } } // 회피: 그 타격을 통째로 피한다
        let blocked = false;
        if (t < target.wallUntil) { dmg = 1; blocked = true; target.s.blocks++; u.s.blockedOn++; } // 방패 벽: 모든 타격을 막는다
        { const bc = target.blockChance * (t < target.shieldUpUntil ? D.shieldUp.mul : 1); /* 매 타 방패 막기: 치명타·말 위 돌진은 넘어간다. 닳지 않는다 */
          if (!blocked && bc > 0 && !crit && !mountedCharge && t >= target.boundUntil && rng.chance(Math.min(0.95, bc))) {
            const full = dmg; dmg = Math.max(1, Math.round(dmg * (1 - CONFIG.gear.blockCut))); blocked = true; target.s.blocks++; u.s.blockedOn++;
            if (u.d.has('sica_over') && rng.chance(pOf(u, 'sica_over', D.sicaOver.p))) { dmg += Math.round((full - dmg) * D.sicaOver.share); dictata = 'sica_over'; used(u, 'sica_over'); } } } // 곡도 방패 뒤 찍기: 막힌 몫의 일부를 방패 너머로
        // 아군 보호(어깨 걸기·밀집 창): 곁의 아군이 맞을 때 끼어들어 막는다
        if (!blocked) { const guard = alive(target.side).find(a => a !== target && a.ms.allyGuard && dist(a, target) < 70 && t >= a.boundUntil && rng.chance(a.ms.allyGuard!)); if (guard) { dmg = Math.max(1, Math.round(dmg * (1 - CONFIG.gear.blockCut))); blocked = true; guard.s.blocks++; u.s.blockedOn++; ev({ kind: 'dictata', actor: guard.g.id, target: u.g.id, dictata: guard.ms.allyGuard === 0.3 && guard.d.has('poke') ? 't_hop_wall' : 'c_bg_shoulder' }); } }
        let deflected = false;
        if (!blocked && !crit && t >= target.boundUntil && target.ms.parry && rng.chance(target.ms.parry)) { dmg = Math.max(1, Math.round(dmg * 0.5)); deflected = true; ev({ kind: 'dictata', actor: target.g.id, target: u.g.id, dictata: target.d.has('twin') ? 't_dim_parry' : 't_sci_guard' }); } // 양손 막기 · 관 방패
        if (!blocked && !deflected && !crit && t >= target.boundUntil && target.d.has('deflect') && rng.chance(pOf(target, 'deflect', D.deflect.p))) { dmg = Math.max(1, Math.round(dmg * (1 - D.deflect.cut))); deflected = true; used(target, 'deflect'); const sx = -uy * D.deflect.step * target.circleDir, sy = ux * D.deflect.step * target.circleDir; target.x += sx; target.y += sy; clamp(target); ev({ kind: 'dictata', actor: target.g.id, target: u.g.id, dictata: 'deflect' }); } // 작은방패 흘리기
        if (target.m.lowCut && target.hp / initialHp[target.g.id] < 0.30) dmg = Math.max(1, Math.round(dmg * (1 - target.m.lowCut))); // 승리 계보: 벼랑에서 버틴다
        target.hp -= dmg; target.lastAttacker = u.g.id; target.holdUntil = Math.max(target.holdUntil, t + 0.3); u.s.dmgDealt += dmg; target.s.dmgTaken += dmg; if (u.range >= 2) u.s.rangedDmg += dmg;
        if (target.hp > 0 && target.ms.secondWind && !target.windUsed && target.hp < initialHp[target.g.id] * 0.25) { target.windUsed = true; target.hp += Math.round(initialHp[target.g.id] * 0.25); target.guardUntil = t + 2; target.retreatUntil = t + 2; u.retreatUntil = Math.max(u.retreatUntil, t + 1.2); ev({ kind: 'dictata', actor: target.g.id, dictata: 'bare_wind' }); } // 숨고르기: 심판이 잠시 멈춘다
        if (target.hp > 0 && u.ms.legOnHit && !combo && rng.chance(u.ms.legOnHit.p)) { target.slowUntil = Math.max(target.slowUntil, t + u.ms.legOnHit.sec); target.slowMul = u.ms.legOnHit.slow; ev({ kind: 'dictata', actor: u.g.id, target: target.g.id, dictata: 'sica_low' }); }
        if (target.hp > 0 && u.ms.stumbleOnHit && !combo && rng.chance(u.ms.stumbleOnHit.p)) { stumble(target, u.ms.stumbleOnHit.sec); ev({ kind: 'dictata', actor: u.g.id, target: target.g.id, dictata: (masteryOf(u.g).find(m => m.eff.stumbleOnHit)?.id ?? 'stumble') }); }
        let net = false, netMiss = false, stun = false;
        if (!u.netUsed && !combo) { u.netUsed = true; /* 레티아리우스 그물: 던지면 그만이다 — 빗나가면 그물을 잃는다 */ used(u, 'net');
          if (rng.chance(Math.max(D.net.min, D.net.base - target.spd * D.net.perSpd))) { target.boundUntil = t + D.net.sec * target.m.boundMul * (target.ms.boundCut ?? 1); net = true; target.s.boundTimes++; } else { netMiss = true; u.s.misses++; if (u.ms.netRecover) u.netUsed = false; } dictata = 'net'; } // 그물 회수: 빗나가면 거둬 한 번 더 · 그물 자르기: 묶임 절반
        else if (u.d.has('lasso') && !combo && t >= u.lassoAt + D.lasso.gap) { u.lassoAt = t; used(u, 'lasso'); /* 라쿠에아리우스 올가미: 빗나가도 잃지 않는다 */
          if (rng.chance(pOf(u, 'lasso', D.lasso.p))) { target.boundUntil = t + D.lasso.sec * (u.ms.lassoSecMul ?? 1) * target.m.boundMul * (target.ms.boundCut ?? 1); net = true; target.s.boundTimes++; if (u.ms.lassoPull) { const dd = Math.max(1, dist(u, target)); target.x = u.x + (target.x - u.x) / dd * (u.reach - 6); target.y = u.y + (target.y - u.y) / dd * (u.reach - 6); clamp(target); } if (u.ms.lassoTrip && rng.chance(u.ms.lassoTrip)) { target.openUntil = Math.max(target.openUntil, target.boundUntil + 0.6); target.holdUntil = Math.max(target.holdUntil, target.boundUntil + 0.6); } } /* 발 걸기: 속박이 풀리는 순간 넘어진다 (Codex 리뷰) */ else { netMiss = true; u.s.misses++; } dictata = 'lasso'; }
        if (u.m.bindFirst && natureFirst[u.side]) { natureFirst[u.side] = false; target.boundUntil = Math.max(target.boundUntil, t + 0.8); stun = true; }
        const downed = target.hp <= 0;
        if (downed) { u.s.kills++; if (t < target.boundUntil && (net || target.boundUntil > t)) u.s.boundKills++; }
        log.push(`${fmt(t)} ${u.g.name}(${u.side}) → ${target.g.name} ${dmg}${crit ? ' 치명타!' : ''}${open ? ' 빈틈!' : ''}${charge && !combo ? ' 돌진!' : ''}${combo ? ' 연속!' : ''}${blocked ? ' 방패!' : ''}${deflected ? ' 흘림!' : ''}${net ? ' 그물!' : ''}${netMiss ? ' 그물 빗나감!' : ''}${stun ? ' 기세!' : ''}${dictata ? ` [${dictata}]` : ''}${downed ? ' 쓰러짐' : ''}`);
        ev({ kind: 'attack', actor: u.g.id, target: target.g.id, dmg, targetHp: Math.max(0, target.hp), counter: false, net, netMiss, blocked, parried: deflected, combo, charge: charge && !combo, crit, open, downed, dictata });
        if (downed) break;
        if (!combo && u.ms.sweep) { const other = enemies.find(e => e !== target && e.hp > 0 && dist(u, e) <= u.reach + 6); if (other) { if (strike(u, other, u.ms.sweep, masteryOf(u.g).find(m => m.eff.sweep)?.id ?? 'sweep', false)) { /* 둘째가 쓰러져도 첫째는 계속 */ } } } // 회전 베기·양날: 붙은 적 둘을 함께
        if (blocked && t >= target.wallUntil && target.ms.onBlockTrip && rng.chance(target.ms.onBlockTrip.p)) { if (target.ms.onBlockTrip.sec >= 0.8 ? trip(u, target.ms.onBlockTrip.sec) : (stumble(u, target.ms.onBlockTrip.sec), true)) ev({ kind: 'dictata', actor: target.g.id, target: u.g.id, dictata: target.ms.onBlockTrip.sec >= 0.8 ? 'big_kick' : 'small_edge' }); break; } // 방패 걷어차기·모서리 치기
        if (blocked && target.ms.onBlockStrike && u.hp > 0 && rng.chance(target.ms.onBlockStrike.p)) { if (strike(target, u, target.ms.onBlockStrike.mult, masteryOf(target.g).find(m => m.eff.onBlockStrike)?.id ?? 'block_strike')) break; } // 막은 직후 곧바로 친다
        if (blocked && follow(u, target, 'blocked')) break; // 막힌 직후: 방패 아래 찌르기·낫 걸기 (Codex 리뷰)
        if ((!combo && follow(u, target, 'always')) || (dictata === 'feint' && follow(u, target, 'feint')) || (charge && !combo && follow(u, target, 'charge')) || (t < target.boundUntil && follow(u, target, 'bound'))) break; // 뒤따르는 타격
        // ── 맞은 직후: 맨몸 빠지기 · 스키소르 팔 칼날 되치기
        if (target.d.has('slip') && rng.chance(pOf(target, 'slip', D.slip.p))) { target.retreatUntil = t + D.slip.retreat; target.holdUntil = t; u.cooldown += D.slip.delay; used(target, 'slip'); ev({ kind: 'dictata', actor: target.g.id, target: u.g.id, dictata: 'slip' }); follow(target, u, 'deflect'); break; } // 빠지면 연속 공격도 끊긴다
        if (deflected && target.d.has('deflect') && follow(target, u, 'deflect')) break; // 옆걸음 되치기
        if (target.d.has('arm_riposte') && u.hp > 0 && rng.chance(pOf(target, 'arm_riposte', D.armRiposte.p))) { used(target, 'arm_riposte');
          const rd = Math.max(1, Math.round(target.atk * D.armRiposte.mult * rng.range(0.85, 1.15) - u.def)); u.hp -= rd; u.lastAttacker = target.g.id; u.holdUntil = Math.max(u.holdUntil, t + 0.3); target.s.dmgDealt += rd; u.s.dmgTaken += rd;
          ev({ kind: 'attack', actor: target.g.id, target: u.g.id, dmg: rd, targetHp: Math.max(0, u.hp), counter: true, net: false, blocked: false, combo: false, charge: false, crit: false, downed: u.hp <= 0, riposte: true, dictata: 'arm_riposte' });
          log.push(`${fmt(t)} ${target.g.name} 팔 칼날 되치기 → ${u.g.name} ${rd}${u.hp <= 0 ? ' 쓰러짐' : ''}`); if (u.hp <= 0) { target.s.kills++; break; }
          if (follow(target, u, 'riposte')) break; }
      }
    }
    snapshot();
    if (alive('A').length === 0 || alive('B').length === 0) break;
  }
  const a = alive('A').length, b = alive('B').length;
  const winner: BattleResult['winner'] = a > 0 && b === 0 ? 'A' : b > 0 && a === 0 ? 'B' : 'draw'; // 동점은 무승부 (승리×3 동점 승리는 2026-09-18 뺐다)
  const downed = { A: units.filter(u => u.side === 'A' && u.hp <= 0).map(u => u.g), B: units.filter(u => u.side === 'B' && u.hp <= 0).map(u => u.g) };
  const stats: Record<number, UnitStats> = Object.fromEntries(units.map(u => [u.g.id, u.s]));
  return { events, frames, initialHp, winner, turns: Math.ceil(t), duration: t, log, downed, counterWin: false, form, stats, mounted };
}
