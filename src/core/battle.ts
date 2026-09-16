// 위치 기반 자동전투. 0.1초 틱의 2D 시뮬레이션. 화면은 이 결과(프레임·이벤트)를 재생만 한다.
// (턴제 버전은 battle_turnbased.ts.txt 에 보관)
import type { BattleEvent, BattleFrame, BattleResult, Gladiator } from './types.js';
import { Rng } from './rng.js';
import { CONFIG } from './config.js';
import { effectiveStats } from './gladiator.js';
import { computeSynergies, type Synergies } from './synergy.js';
import { epithetMods } from './epithets.js';
import { equipOf, MAIN_HAND, OFF_HAND, TYPE_TRAIT } from './equipment.js';
import { hasSkill, procChance, SKILL_BY_ID, type SkillId } from './skills.js';

export const ARENA = { w: 720, h: 320, margin: 40 };
const DT = 0.1;                 // 틱(초)
const MAX_T = 60;               // 제한 시간(초) → 무승부
const BIND_SEC = 1.5; /* 그물 외의 속박(기술 등) 기본값. 그물은 CONFIG.net.sec */

interface Unit {
  g: Gladiator; side: 'A' | 'B';
  x: number; y: number; hp: number;
  atk: number; def: number; spd: number; range: number; reach: number; spd0: number; struck?: boolean; // spd0: 기본 속도 (기병대 보너스 계산용) · struck: 첫 타를 냈는가 (창 벽)
  moveSpeed: number;            // px/초
  interval: number;             // 공격 간격(초)
  cooldown: number;             // 남은 대기(초)
  boundUntil: number;
  blockChance: number; netUsed: boolean; slowUntil: number; lastD: number; pokeUntil: number; disarmUntil: number; // disarmUntil: 무기를 놓친 동안 (줍기 전까지) // lastD: 지난 틱의 대상 거리 (길목 찌르기 판정) · pokeUntil: 다음 길목 찌르기까지 // slowUntil: 다리를 맞아 걸음이 느린 동안 // blockChance: 매 타 방패로 막을 확률 (막을 때마다 닳는다)
  target?: number;
  lastAttacker?: number;
  retreatUntil: number;         // 타격 후 이탈하는 동안
  circleDir: 1 | -1;
  feintUntil: number;           // 짧게 들어갔다 빠지는 페인트
  feintIn: boolean;
  holdUntil: number;            // 공격·피격 동작 중 제자리
  sprint: boolean;              // 전력 질주 중(도착하면 돌진 공격)
  prevTarget?: number;
  stamina: number; weight: number; openUntil: number;   // 스태미나(0~max)와 장비 무게(휘두를 때 소모 배율) · openUntil: 헛디뎌 빈틈이 열린 동안
  secondWind: boolean; netRecovered: boolean; blocksMade: number; guardUntil: number; // guardUntil: 심판 중단(숨고르기) 동안 공격받지 않는다 // 기술: 숨 고르기·그물회수 1회, 방패로 막은 횟수
}

const tEqOf = (u: Unit) => equipOf(u.g.type).off; // 보조 손 장비
function makeUnits(team: Gladiator[], side: 'A' | 'B', syn: Synergies, hpBonus = 0, boosted?: Set<number>, boostMul = 1): Unit[] {
  return team.map((g, i) => {
    const s = effectiveStats(g); s.hp += hpBonus; // 조리장(식단) 보너스
    if (boosted?.has(g.id)) s.atk = Math.round(s.atk * boostMul); // 원한: 살려 준 상대가 이를 간다
    let atk = s.atk, def = s.def;
    const eq = equipOf(g.type);
    if (syn.shieldWall && eq.off === 'scutum') def += 3;
    if (syn.nature2) atk = Math.round(atk * 1.08);
    if (syn.captives && g.origin === 'captive') atk += CONFIG.synergy.captiveAtk; // 동포
    const range = MAIN_HAND[eq.main].range;
    const n = team.length;
    const y = ARENA.h / 2 + (i - (n - 1) / 2) * 90;
    const x = side === 'A' ? (range >= 2 ? 80 : 170) : (range >= 2 ? ARENA.w - 80 : ARENA.w - 170);
    return {
      g, side, x, y, hp: s.hp, atk, def, spd: s.spd, spd0: s.spd, range, reach: range >= 2 ? 95 : 48,
      moveSpeed: 60 + s.spd * 7, interval: Math.max(0.8, 1.8 - s.spd * 0.08),
      cooldown: 1.0 + ((i * 0.37 + (side === 'A' ? 0 : 0.2)) % 1.0) * 1.2, // 시작은 견제부터 (1.0~2.2초)
      retreatUntil: 0, circleDir: (i % 2 === 0 ? 1 : -1) as 1 | -1, feintUntil: 0, feintIn: true, holdUntil: 0, sprint: false,
      boundUntil: 0, blockChance: OFF_HAND[eq.off].role === 'guard' ? (OFF_HAND[eq.off].block ?? 0) : 0, slowUntil: 0, lastD: 999, pokeUntil: 0, disarmUntil: 0, netUsed: OFF_HAND[eq.off].skill !== 'bind',
      secondWind: false, netRecovered: false, blocksMade: 0, guardUntil: 0,
      stamina: CONFIG.stamina.max, weight: CONFIG.stamina.weight[eq.off], openUntil: 0,
    };
  });
}

export function battle(rng: Rng, teamA: Gladiator[], teamB: Gladiator[], opts: { mentored?: Set<number>; hpBonusA?: number; boostedB?: Set<number>; boostMul?: number } = {}): BattleResult {
  const synA = computeSynergies(teamA), synB = computeSynergies(teamB);
  const units = [...makeUnits(teamA, 'A', synA, opts.hpBonusA ?? 0), ...makeUnits(teamB, 'B', synB, 0, opts.boostedB, opts.boostMul ?? 1)];
  const form: Record<number, number> = {}; const teamForm = { A: rng.range(-1, 1), B: rng.range(-1, 1) }; for (const u of units) { const f = u.g.form ?? (teamForm[u.side] * CONFIG.form.team + rng.range(-1, 1) * (1 - CONFIG.form.team)); form[u.g.id] = f; /* 우리 검투사는 시즌 시작에 정해 둔 값(g.form), 상대는 경기 때 굴린다 — 내 사람의 상태는 알고 남의 것은 모른다 */ u.atk = Math.max(1, u.atk + Math.round(f * CONFIG.form.atk)); u.def = Math.max(0, u.def + Math.round(f * CONFIG.form.def)); } // 그날의 몸 상태: 경기 내내 남는 우연
  const mentored = opts.mentored ?? new Set<number>(); // 독토르에게 기술을 전수받은 검투사 (유형 특기 강화)
  const M = CONFIG.mentor;
  const syn = { A: synA, B: synB };
  const byId = new Map(units.map(u => [u.g.id, u]));
  const log: string[] = [];
  const events: BattleEvent[] = [];
  const frames: BattleFrame[] = [];
  const initialHp: Record<number, number> = Object.fromEntries(units.map(u => [u.g.id, u.hp]));
  const alive = (side: 'A' | 'B') => units.filter(u => u.side === side && u.hp > 0);
  const dist = (a: Unit, b: Unit) => Math.hypot(a.x - b.x, a.y - b.y);
  const natureFirst = { A: true, B: true };
  const fmt = (t: number) => t.toFixed(1) + 's';
  // 기술 발동 기록과 경험 집계
  const skillUses: Record<number, Record<string, number>> = {};
  const exp: NonNullable<BattleResult['exp']> = Object.fromEntries(units.map(u => [u.g.id, { blocks: 0, blockedOn: 0, combos: 0, comboKill: false, netKill: false, charges: 0, chargeKill: false, lowHp: false, meleeKill: false, wonAfterBlock: false }]));
  const proc = (x: Unit, id: SkillId): boolean => { if (!hasSkill(x.g, id) || !rng.chance(procChance(x.g, id))) return false; (skillUses[x.g.id] ??= {})[id] = ((skillUses[x.g.id] ??= {})[id] ?? 0) + 1; events.push({ t: +t.toFixed(2), turn: Math.floor(t) + 1, kind: 'skill', actor: x.g.id, skill: id }); log.push(`${fmt(t)} ${x.g.name} 기술 '${SKILL_BY_ID[id].name}'`); return true; };

  for (const u of units) if (Math.abs(form[u.g.id]) >= CONFIG.form.tell) log.push(`0.0s ${u.g.name} 오늘 몸이 ${form[u.g.id] > 0 ? '가볍다' : '무겁다'}`);
  let t = 0;
  const snapshot = () => frames.push({ t: +t.toFixed(2), u: units.map(u => [u.g.id, Math.round(u.x), Math.round(u.y), Math.max(0, Math.round(u.hp)), Math.max(0, Math.round(u.stamina))]) });
  snapshot();

  for (t = 0; t < MAX_T; t = +(t + DT).toFixed(2)) {
    // 행동 순서: 속도 높은 순 (동률은 난수)
    for (const u of units) if (syn[u.side].cavalry && u.g.type === 'eques') u.spd = u.spd0 + (t < CONFIG.synergy.cavalrySec ? CONFIG.synergy.cavalrySpd : 0); // 기병대: 첫 몇 초 기세
    const order = units.filter(u => u.hp > 0).sort((a, b) => b.spd - a.spd || rng.next() - 0.5);
    for (const u of order) {
      if (u.hp <= 0) continue;
      const enemies = alive(u.side === 'A' ? 'B' : 'A');
      if (!enemies.length) break;
      if (t < u.boundUntil) continue; // 속박
      u.cooldown -= DT;
      const ST = CONFIG.stamina; u.stamina = Math.min(ST.max, u.stamina + ST.regen * DT); const winded = u.stamina < ST.windedAt; // 숨은 늘 조금씩 돌아온다. 바닥이면 지침
      const holding = t < u.holdUntil; // 동작 중엔 이동하지 않는다

      // ── 대상 선택: 가까운 적 우선. 추격자는 원거리 적 우선. 아군 보호(위험한 아군을 때리는 근처 적)
      const trait = TYPE_TRAIT[u.g.type];
      let cands = enemies;
      if (trait.pursuer) { const ranged = enemies.filter(e => e.range >= 2); if (ranged.length) cands = ranged; }
      let target = cands.reduce((m, e) => dist(u, e) < dist(u, m) ? e : m);
      const allies = alive(u.side).filter(a => a !== u);
      for (const a of allies) {
        if (a.hp / initialHp[a.g.id] < 0.4 && a.lastAttacker != null) {
          const foe = byId.get(a.lastAttacker); if (foe && foe.hp > 0 && dist(u, foe) < 160) { target = foe; break; }
        }
      }
      if (syn[u.side].huntPair) { const b = enemies.find(e => t < e.boundUntil); if (b) target = b; }
      if (u.prevTarget != null && u.prevTarget !== target.g.id && byId.get(u.prevTarget)!.hp <= 0) u.sprint = true; // 쓰러뜨리고 합류: 뛰어든다
      u.prevTarget = target.g.id; u.target = target.g.id;

      // ── 이동 모델: 이탈(때린 뒤 거리 벌림) → 견제(거리 유지·옆으로 돌기·페인트) → 돌입(준비되면 전속력) 
      const d = dist(u, target);
      const ux = (target.x - u.x) / Math.max(1, d), uy = (target.y - u.y) / Math.max(1, d);
      let vx = 0, vy = 0;
      const ready = u.cooldown <= 0.3;
      if (t < u.retreatUntil && d < 100) { vx = -ux; vy = -uy; }                       // 이탈: 100까지만 벌린다
      else if (u.range >= 2) {                                                          // 원거리: 멀면 접근, 붙으면 그 자리에서 싸움 (도망치지 않음)
        if (d < CONFIG.polearm.inside) { vx = -ux; vy = -uy; } // 품 안으로 파고들면 창을 쓰려고 물러선다
        else if (d > u.reach) { if (d > 150 || u.sprint) u.sprint = true; vx = ux; vy = uy; } // 멀면 창을 겨누고 전력 질주 → 도착 즉시 돌진 (호플로마쿠스·에퀘스의 돌진)
        else { vx = -uy * 0.35 * u.circleDir; vy = ux * 0.35 * u.circleDir; }
      }
      else if (ready && !(t < target.retreatUntil && d > u.reach)) {                   // 돌입 (이탈 중인 상대는 쫓지 않음)
        const want = target.range >= 2 ? CONFIG.polearm.inside - 6 : u.reach; // 창을 든 상대에게는 품 안까지 파고든다 (창이 짧게 잡히는 거리)
        if (d > want) {
          const style = trait.style;
          if (d > 150 || u.sprint) { u.sprint = true; vx = ux; vy = uy; }                 // 멀면 전력 질주 → 도착 즉시 돌진 공격 (품 안까지)
          else if (style === 'cautious') { vx = ux * 0.6 + -uy * 0.5 * u.circleDir; vy = uy * 0.6 + ux * 0.5 * u.circleDir; }       // 방패 세우고 옆걸음
          else if (style === 'feint') { const z = Math.sin(t * 9 + u.g.id); vx = ux * 0.8 + -uy * 0.9 * z; vy = uy * 0.8 + ux * 0.9 * z; } // 지그재그
          else { vx = ux; vy = uy; }
        }
      }
      else {                                                                             // 견제: 100 안팎 유지 + 옆으로 + 페인트
        if (t < u.feintUntil) { const k = u.feintIn ? 0.9 : -0.9; vx = ux * k; vy = uy * k; }
        else {
          if (d < 75) { vx = -ux * 0.6; vy = -uy * 0.6; } else if (d > 100) { vx = ux * 0.8; vy = uy * 0.8; }
          vx += -uy * 0.75 * u.circleDir; vy += ux * 0.75 * u.circleDir;
          if (rng.chance(0.06)) { u.feintUntil = t + 0.25; u.feintIn = rng.chance(0.6); }   // 가끔 들어갔다 빠짐
          if (rng.chance(0.02)) u.circleDir = (u.circleDir === 1 ? -1 : 1);
        }
      }
      // 모든 유닛과 최소 간격 (뭉침 방지)
      for (const o of units) { if (o === u || o.hp <= 0) continue; const dd = dist(u, o); const rad = o.side === u.side ? 52 : 40; if (dd < rad && dd > 0) { const f = (rad - dd) / rad * 1.5; vx += (u.x - o.x) / dd * f; vy += (u.y - o.y) / dd * f; } }
      const vlen = holding ? 0 : Math.hypot(vx, vy);
      if (vlen > 0) {
        const sp = u.moveSpeed * (u.sprint ? 1.7 : 1) * (winded ? ST.windedMove : 1) * (t < u.slowUntil ? 1 - CONFIG.legs.slow : 1); /* 다리를 맞으면 걸음이 무디다 */
        if (u.sprint) u.stamina = Math.max(0, u.stamina - ST.sprintPerSec * DT);
        if (winded && rng.chance(CONFIG.trip.chance * (u.sprint ? 2.5 : 1))) { const TR = CONFIG.trip; u.boundUntil = Math.max(u.boundUntil, t + TR.sec); u.sprint = false; u.holdUntil = t + TR.sec; /* 지친 채 달리다 넘어진다 */
          events.push({ t: +t.toFixed(2), turn: Math.floor(t) + 1, kind: 'stumble', actor: u.g.id, trip: true }); log.push(`${fmt(t)} ${u.g.name} 발이 걸려 넘어짐!`); } // 질주는 숨을 먹는다
        u.x += vx / vlen * sp * DT; u.y += vy / vlen * sp * DT;
        u.x = Math.max(ARENA.margin, Math.min(ARENA.w - ARENA.margin, u.x));
        u.y = Math.max(ARENA.margin, Math.min(ARENA.h - ARENA.margin, u.y));
      }

      // ── 사거리·방패의 몸싸움 (공격 순서와 별개로 매 틱)
      { const d2 = dist(u, target), PL = CONFIG.polearm, SV = CONFIG.shove;
        const push = (a: Unit, b: Unit, px: number) => { const dd = Math.max(1, dist(a, b)); b.x = Math.max(ARENA.margin, Math.min(ARENA.w - ARENA.margin, b.x + (b.x - a.x) / dd * px)); b.y = Math.max(ARENA.margin, Math.min(ARENA.h - ARENA.margin, b.y + (b.y - a.y) / dd * px)); };
        if (u.range >= 2 && u.lastD > u.reach && d2 <= u.reach && t >= u.pokeUntil && t >= target.guardUntil) { // 길목 찌르기: 밖에서 안으로 들어오는 순간 창끝이 먼저 닿는다
          u.pokeUntil = t + PL.pokeGap; u.cooldown = Math.max(u.cooldown, u.interval * PL.pokeCost); /* 찌르면 다음 베기가 늦다 — 공짜가 아니라 맞바꿈 */ const pk = Math.max(1, Math.round(u.atk * PL.poke - target.def * 0.5)); target.hp -= pk; target.lastAttacker = u.g.id; push(u, target, PL.push);
          events.push({ t: +t.toFixed(2), turn: Math.floor(t) + 1, kind: 'attack', actor: u.g.id, target: target.g.id, dmg: pk, targetHp: Math.max(0, target.hp), counter: true, net: false, blocked: false, combo: false, charge: false, crit: false, downed: target.hp <= 0 });
          log.push(`${fmt(t)} ${u.g.name} 창끝으로 막아섬 → ${target.g.name} ${pk}${target.hp <= 0 ? ' 쓰러짐' : ''}`); }
        else if ((tEqOf(u) === 'scutum' || tEqOf(u) === 'medium') && d2 <= u.reach + 8 && !holding && u.cooldown > 0.25 && rng.chance(SV.chance)) { // 방패 밀어붙이기: 공격 사이에 상대를 밀어 숨을 깎는다
          push(u, target, SV.push); target.stamina = Math.max(0, target.stamina - SV.stamina); target.holdUntil = Math.max(target.holdUntil, t + 0.15);
          events.push({ t: +t.toFixed(2), turn: Math.floor(t) + 1, kind: 'skill', actor: u.g.id, target: target.g.id, skill: 'shield_bash' }); }
        u.lastD = d2; }
      // ── 공격
      if (u.cooldown > 0 || dist(u, target) > u.reach) continue;
      if (t < target.guardUntil || t < u.guardUntil) continue; // 심판이 멈춘 동안은 공격하지 않는다
      if (target.range >= 2 && u.range < 2 && proc(target, 'spear_ward')) { u.sprint = false; u.retreatUntil = t + 0.7; u.holdUntil = t + 0.3; u.cooldown = u.interval * 0.6; const poke = Math.max(2, Math.round(target.atk * 0.4 - u.def * 0.5)); u.hp -= poke; u.lastAttacker = target.g.id; events.push({ t: +t.toFixed(2), turn: Math.floor(t) + 1, kind: 'attack', actor: target.g.id, target: u.g.id, dmg: poke, targetHp: Math.max(0, u.hp), counter: true, net: false, blocked: false, combo: false, charge: false, crit: false, downed: u.hp <= 0, skill: 'spear_ward' }); log.push(`${fmt(t)} ${target.g.name} 창견제 → ${u.g.name} ${poke}${u.hp <= 0 ? ' 쓰러짐' : ''}`); continue; } // 창견제: 근접 공격이 무산되고 창끝에 찔린다
      if (winded && rng.chance(ST.stumble)) { u.sprint = false; u.holdUntil = t + ST.stumbleSec; u.openUntil = t + ST.stumbleSec; u.cooldown = ST.stumbleSec; for (const e of enemies) if (dist(e, u) < 120) { e.cooldown = Math.min(e.cooldown, 0.3); e.retreatUntil = 0; } events.push({ t: +t.toFixed(2), turn: Math.floor(t) + 1, kind: 'stumble', actor: u.g.id, target: target.g.id }); log.push(`${fmt(t)} ${u.g.name} 헛디딤!`); continue; } // 지친 몸으로 휘두르다 헛디딘다: 공격 무산, 잠시 무방비. 가까운 적은 이탈을 멈추고 바로 그 빈틈을 노린다
      u.stamina = Math.max(0, u.stamina - ST.swing * u.weight); // 휘두르는 값: 무거운 방패일수록 크다
      const charge = u.sprint; u.sprint = false;
      u.cooldown = u.interval * (winded ? ST.windedInterval : 1);
      u.holdUntil = t + 0.45;                                        // 공격 동작이 끝날 때까지 제자리
      if (u.range < 2) u.retreatUntil = u.holdUntil + 0.4 + rng.next() * 0.3; // 그 뒤 짧게 이탈
      if (rng.chance(0.4)) u.circleDir = (u.circleDir === 1 ? -1 : 1);
      for (let hit = 0; hit < 2; hit++) {
        if (hit === 1 && (target.hp <= 0 || !rng.chance(CONFIG.combo.base + u.spd * CONFIG.combo.perSpd + (mentored.has(u.g.id) && u.g.type === 'secutor' ? M.comboBonus : 0) + (mentored.has(u.g.id) && u.g.type === 'dimachaerus' ? M.twinBonus : 0) + (OFF_HAND[equipOf(u.g.type).off].comboBonus ?? 0) + (hasSkill(u.g, 'twin_cut') ? 0.15 : 0)))) break;
        const combo = hit === 1;
        if (combo && hasSkill(u.g, 'twin_cut')) { (skillUses[u.g.id] ??= {}).twin_cut = ((skillUses[u.g.id] ??= {}).twin_cut ?? 0) + 1; exp[u.g.id].combos++; } else if (combo) exp[u.g.id].combos++;
        let mult = 1.0;
        if (target.g.type === 'retiarius') mult *= epithetMods(u.g).vsRetiarius; // 별칭 '그물꾼의 악몽'
        const mySyn = syn[u.side], theirSyn = syn[target.side];
        const tEq = equipOf(target.g.type), uEq = equipOf(u.g.type);
        if (u.range >= 2 && dist(u, target) < CONFIG.polearm.inside) mult *= CONFIG.polearm.closePenalty; // 품 안: 창을 짧게 잡는다
        if (theirSyn.lightHeavy) mult *= 0.92; // 경중 조합: 받는 피해 −8%
        if (mySyn.huntPair && trait.pursuer && t < target.boundUntil) mult *= 1.5;
        if (mySyn.spearWall && !u.struck) mult *= CONFIG.synergy.spearFirst; u.struck = true; // 창 벽: 첫 타
        if (t < u.disarmUntil) mult *= OFF_HAND[uEq.off].skill === 'bind' ? CONFIG.disarm.pugioMul : CONFIG.disarm.atkMul; // 무기를 놓친 손 (레티아리우스는 허리에 단검이 있다)
        const feint = !combo && proc(u, 'feint'); // 허초: 방패 감소 무시 + 방어 1/3만
        const ignore = Math.min(0.9, (feint ? 0.2 : mentored.has(u.g.id) && uEq.main === 'sica' ? M.sicaIgnore : MAIN_HAND[uEq.main].defIgnore) + (mySyn.sicaBrothers && uEq.main === 'sica' ? CONFIG.synergy.sicaBrothers : 0)); // 곡도 형제
        const def = Math.round(target.def * (1 - ignore));
        if (feint) mult *= 1.1; // 허초: 빈틈을 찔러 피해 +10%
        if (charge && !combo) { mult *= mentored.has(u.g.id) && (u.g.type === 'hoplomachus' || u.g.type === 'eques') ? M.chargeMult : 1.15; exp[u.g.id].charges++; if (proc(u, 'charge_plus')) { mult *= 2.5; target.boundUntil = Math.max(target.boundUntil, t + 1.5); } } // 돌진 공격: 기세 보너스 (창 유형 전수 시 ×1.3)
        const crit = rng.chance((CONFIG.crit.base + u.spd * CONFIG.crit.perSpd) * (mentored.has(target.g.id) && target.g.type === 'provocator' ? M.critTaken : TYPE_TRAIT[target.g.type].critTaken));
        const open = t < target.openUntil || t < target.boundUntil; // 빈틈 강타: 헛디딘 상대·그물에 묶인 상대는 방어가 없다 (그물에 감긴 채로 방패를 들 수는 없다)
        let defUsed = def; if (crit) { mult *= CONFIG.crit.mult; defUsed = Math.round(defUsed * (1 - CONFIG.crit.defIgnore)); } if (open) { mult *= ST.openMult; defUsed = Math.round(defUsed * (1 - ST.openIgnore)); }
        let dmg = Math.max(1, Math.round(u.atk * mult * rng.range(0.85, 1.15) - defUsed));
        let blocked = false;
        { const SH = CONFIG.shield; /* 매 타 방패 막기: 치명타·허초는 넘어간다. 시카처럼 방패를 넘기는 무기는 확률을 깎는다. 막을 때마다 방패가 닳는다 */
          if (target.blockChance > 0 && !crit && !feint && t >= target.boundUntil && rng.chance(target.blockChance * (MAIN_HAND[uEq.main].shieldPierce ?? 1) * (u.g.scaeva && !target.g.scaeva ? SH.scaeva : 1))) {
            const cut = mentored.has(target.g.id) && tEq.off === 'scutum' && target.g.type === 'murmillo' ? M.shieldReduce : SH.cut;
            dmg = Math.max(1, Math.round(dmg * (1 - cut))); target.blockChance = Math.max(SH.min, target.blockChance - SH.wear); blocked = true; } }
        if (blocked) { target.blocksMade++; exp[target.g.id].blocks++; exp[u.g.id].blockedOn++; }
        let parried = false;
        if (!blocked && !crit && t >= target.boundUntil) { const PR = CONFIG.parry, pc = ((MAIN_HAND[tEq.main].parry ?? 0) + (OFF_HAND[tEq.off].parry ?? 0)) * PR.scale; /* 방패로 못 막으면 무기로 받아넘긴다 */
          if (pc > 0 && rng.chance(pc)) { dmg = Math.max(1, Math.round(dmg * (1 - PR.cut))); parried = true; } }
        let disarm = false, dropX = 0, dropY = 0;
        if ((blocked || parried) && t >= target.disarmUntil && rng.chance(CONFIG.disarm.chance * (target.stamina < CONFIG.stamina.windedAt ? CONFIG.disarm.windedMul : 1))) { // 막아 낸 손이 저려 무기를 놓친다
          const D = CONFIG.disarm; target.disarmUntil = t + D.sec; disarm = true;
          const a = rng.range(-1, 1) * Math.PI; dropX = Math.max(ARENA.margin, Math.min(ARENA.w - ARENA.margin, target.x + Math.cos(a) * D.dist)); dropY = Math.max(ARENA.margin, Math.min(ARENA.h - ARENA.margin, target.y + Math.sin(a) * D.dist * 0.5)); }
        if (target.hp / initialHp[target.g.id] < 0.5 && proc(target, 'stand_firm')) dmg = Math.round(dmg * 0.55); // 버티기 // 치명타는 방패 반감 무시
        target.hp -= dmg; target.lastAttacker = u.g.id; target.holdUntil = Math.max(target.holdUntil, t + 0.3); // 피격 경직
        if (target.hp > 0 && target.hp / initialHp[target.g.id] < 0.25 && !target.secondWind && proc(target, 'second_wind')) { target.secondWind = true; target.hp += Math.round(initialHp[target.g.id] * 0.25); target.guardUntil = t + 2; target.retreatUntil = t + 2; u.retreatUntil = Math.max(u.retreatUntil, t + 1.2); } // 숨고르기: 심판이 잠시 멈춘다
        if (target.hp > 0 && target.hp / initialHp[target.g.id] < 0.2) exp[target.g.id].lowHp = true;
        let net = false, stun = false;
        let netMiss = false;
        if (!u.netUsed && !combo && OFF_HAND[uEq.off].skill === 'bind') { u.netUsed = true; const NT = CONFIG.net; /* 던지면 그만이다 — 빗나가면 그물을 잃는다 */
          if (rng.chance(Math.max(NT.min, NT.base - target.spd * NT.perSpd))) { target.boundUntil = t + (mentored.has(u.g.id) ? M.bindSec : CONFIG.net.sec); net = true; } else netMiss = true; }
        else if (u.netUsed && !combo && !u.netRecovered && OFF_HAND[uEq.off].skill === 'bind' && proc(u, 'net_recover')) { u.netRecovered = true; target.boundUntil = t + BIND_SEC; net = true; } // 그물회수
        if (blocked && proc(target, 'shield_bash')) { u.boundUntil = Math.max(u.boundUntil, t + 2.5); target.cooldown = Math.min(target.cooldown, 0.2); stun = true; } // 방패치기: 공격자가 1.2초 비틀거리고 막은 쪽은 바로 되친다
        if (mySyn.nature3 && natureFirst[u.side]) { natureFirst[u.side] = false; target.boundUntil = Math.max(target.boundUntil, t + 0.8); stun = true; }
        const downed0 = target.hp <= 0; let leg = false;
        if (!downed0 && u.range < 2 && !combo) { const LG = CONFIG.legs; if (rng.chance(LG.chance * Math.pow(1 - LG.perGreave, TYPE_TRAIT[target.g.type].greaves))) { target.slowUntil = Math.max(target.slowUntil, t + LG.sec); leg = true; } } /* 정강이받이가 없을수록 하체가 열린다 */
        const downed = target.hp <= 0;
        if (downed) { if (combo) exp[u.g.id].comboKill = true; if (t < target.boundUntil && net) exp[u.g.id].netKill = true; if (charge && !combo) exp[u.g.id].chargeKill = true; if (target.range < 2 && u.range >= 2) exp[u.g.id].meleeKill = true; if (u.blocksMade > 0) exp[u.g.id].wonAfterBlock = true; }
        log.push(`${fmt(t)} ${u.g.name}(${u.side}) → ${target.g.name} ${dmg}${crit ? ' 치명타!' : ''}${open ? ' 빈틈!' : ''}${charge && !combo ? ' 돌진!' : ''}${combo ? ' 연속!' : ''}${blocked ? ' 방패!' : ''}${parried ? ' 받아넘김!' : ''}${disarm ? ' 무기를 놓침!' : ''}${net ? ' 그물!' : ''}${netMiss ? ' 그물 빗나감!' : ''}${leg ? ' 다리!' : ''}${stun ? ' 기세!' : ''}${downed ? ' 쓰러짐' : ''}`);
        events.push({ t: +t.toFixed(2), turn: Math.floor(t) + 1, kind: 'attack', actor: u.g.id, target: target.g.id, dmg, targetHp: Math.max(0, target.hp), counter: false, net, blocked, combo, charge: charge && !combo, crit, open, leg, parried, netMiss, disarm, dropX: disarm ? +dropX.toFixed(1) : undefined, dropY: disarm ? +dropY.toFixed(1) : undefined, downed });
        if (downed) break;
        if (blocked && u.hp > 0 && proc(target, 'riposte')) { // 되치기: 막은 직후 반격 (공격력 80%)
          const rd = Math.max(1, Math.round(target.atk * 2.0 * rng.range(0.85, 1.15) - u.def)); u.hp -= rd; u.lastAttacker = target.g.id; u.holdUntil = Math.max(u.holdUntil, t + 0.3);
          events.push({ t: +t.toFixed(2), turn: Math.floor(t) + 1, kind: 'attack', actor: target.g.id, target: u.g.id, dmg: rd, targetHp: Math.max(0, u.hp), counter: true, net: false, blocked: false, combo: false, charge: false, crit: false, downed: u.hp <= 0, skill: 'riposte' });
          log.push(`${fmt(t)} ${target.g.name} 되치기 → ${u.g.name} ${rd}${u.hp <= 0 ? ' 쓰러짐' : ''}`);
          if (u.hp <= 0) break;
        }
      }
    }
    snapshot();
    if (alive('A').length === 0 || alive('B').length === 0) break;
  }
  const a = alive('A').length, b = alive('B').length;
  let winner: BattleResult['winner'] = a > 0 && b === 0 ? 'A' : b > 0 && a === 0 ? 'B' : 'draw';
  if (winner === 'draw') {
    if (synA.victory3 && !synB.victory3) winner = 'A';
    else if (synB.victory3 && !synA.victory3) winner = 'B';
  }
  const downed = { A: units.filter(u => u.side === 'A' && u.hp <= 0).map(u => u.g), B: units.filter(u => u.side === 'B' && u.hp <= 0).map(u => u.g) };
  return { events, frames, initialHp, winner, turns: Math.ceil(t), duration: t, log, downed, counterWin: false, skillUses, exp, form };
}
