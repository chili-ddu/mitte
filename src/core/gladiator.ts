import type { Gladiator, GType, Lineage, Rank, Stats } from './types.js';
import { Rng } from './rng.js';
import { CONFIG } from './config.js';
import { epithetMods } from './epithets.js';
import { SKILL_WORTH } from './skills.js';
import { rollTalent, talentOf, TALENT_PRICE_MUL } from './talent.js';
import namesJson from '../../data/names.json' with { type: 'json' };

// range 는 전투에서 장비(equipment.ts)로 다시 계산된다. 여기 값은 표시용
export const TYPE_STATS: Record<GType, Stats> = {
  murmillo:  { hp: 120, atk: 14, def: 8, spd: 3, range: 1 },
  secutor:   { hp: 110, atk: 14, def: 7, spd: 5, range: 1 },
  thraex:    { hp: 95,  atk: 17, def: 4, spd: 6, range: 1 },
  retiarius: { hp: 95,  atk: 15, def: 2, spd: 8, range: 2 },
  hoplomachus: { hp: 100, atk: 15, def: 5, spd: 5, range: 2 },
  provocator:  { hp: 115, atk: 14, def: 7, spd: 4, range: 1 },
  eques:       { hp: 95,  atk: 15, def: 4, spd: 8, range: 2 },
  dimachaerus: { hp: 95,  atk: 17, def: 3, spd: 7, range: 1 },
};
export const TYPE_KO: Record<GType, string> = { murmillo: '무르밀로', secutor: '세쿠토르', thraex: '트라엑스', retiarius: '레티아리우스', hoplomachus: '호플로마쿠스', provocator: '프로보카토르', eques: '에퀘스', dimachaerus: '디마카에루스' };
export const LINEAGE_KO: Record<Lineage, string> = { nature: '자연', victory: '승리', myth: '신화', nickname: '별명', place: '지명' };

// 1차: 자연·승리 두 계열만
const LINEAGES_1ST: Lineage[] = ['nature', 'victory'];
const TYPES: GType[] = ['murmillo', 'secutor', 'thraex', 'retiarius', 'hoplomachus', 'provocator', 'eques', 'dimachaerus'];

let nextId = 1;
export function resetIds() { nextId = 1; }
export function peekNextId() { return nextId; }
export function setNextId(n: number) { nextId = n; }

export function makeGladiator(rng: Rng, rank: Rank, opts: { type?: GType; lineage?: Lineage; season?: number } = {}): Gladiator {
  const type = opts.type ?? rng.pick(TYPES);
  const lineage = opts.lineage ?? rng.pick(LINEAGES_1ST);
  const pool = (namesJson as Record<string, { ko: string }[]>)[lineage];
  const name = rng.pick(pool).ko;
  const [a0, a1] = rank === 'tiro' ? CONFIG.age.tiro : CONFIG.age.veteran; const age = rng.int(a0, a1);
  const s = TYPE_STATS[type]; const R = CONFIG.statRoll[rank]; const A = CONFIG.statRoll.age; const ageHi = A.hiBonus * Math.max(0, Math.min(1, (age - A.from) / (A.to - A.from))); // 나이가 들수록 위쪽 폭이 열린다 (단련했을 수도)
  const roll = (v: number, [lo, hi]: readonly [number, number]) => Math.round(v * rng.range(lo, hi + ageHi)); // 스탯마다 범위를 따로 굴린다
  const grow = rank === 'veteranus' ? Math.min(CONFIG.statRoll.vetGrow.max, Math.floor(((opts.season ?? 1) - 1) / CONFIG.statRoll.vetGrow.every)) : 0; // 베테라누스 시즌 단련
  const base: Stats = { hp: roll(s.hp, R.hp), atk: roll(s.atk, R.atk) + grow, def: roll(s.def, R.def) + grow, spd: s.spd, range: s.range };
  const wins = rank === 'veteranus' ? rng.int(3, 6) : 0;
  const g: Gladiator = { id: nextId++, name, lineage, type, rank, base, fights: wins + rng.int(0, 2), wins, missios: 0, injured: 0, buyPrice: 0, alive: true, age, scaeva: rng.chance(0.1) || undefined }; // 왼손잡이 10% (비문에 따로 표기될 만큼 귀했다)
  g.talent = rollTalent(rng); g.buyPrice = valueOf(g); return g; // 값은 난수가 아니라 능력치·승수로 (+ 상인의 눈만큼 자질). 자질은 초기 능력치에 안 얹는다 (성장 가중치)
}

export function effectiveStats(g: Gladiator): Stats {
  const grow = 1 + g.wins * 0.02;
  const pen = Math.max(0, (g.fatigue ?? 0) - CONFIG.fatigue.free) * CONFIG.fatigue.statPenalty + agePenalty(g).stat; // 피로(첫 1점 무료) + 노쇠
  const E = epithetMods(g); // 별칭
  return { hp: Math.round(g.base.hp * grow * E.hp), atk: Math.max(1, Math.round(g.base.atk * grow * E.atk) - pen), def: Math.max(0, Math.round(g.base.def * grow * E.def) - pen), spd: Math.max(1, g.base.spd - agePenalty(g).spd), range: g.base.range };
}
// 노쇠: 31세부터 3년마다 속도 −1, 33세부터 2년마다 공·방 −1
export function agePenalty(g: Gladiator): { spd: number; stat: number } {
  const A = CONFIG.age, age = g.age ?? 22;
  return { spd: age >= A.spdFrom ? Math.floor((age - A.spdFrom) / A.spdEvery) + 1 : 0, stat: age >= A.statFrom ? Math.floor((age - A.statFrom) / A.statEvery) + 1 : 0 };
}

// 팬: 명예 + 승수×2 + 별칭×5. 30 이상이면 스타 (관중이 이름을 외친다)
export function fansOf(g: Gladiator): number { return (g.honor ?? 0) + g.wins * 2 + (g.epithets ?? []).length * 5; }
export function rentFee(g: Gladiator, tier: number): number {
  return Math.round((g.rank === 'tiro' ? CONFIG.rentTiro : CONFIG.rentVeteran) * tier * (1 + (g.honor ?? 0) * CONFIG.honor.rentPer) * epithetMods(g).rent); // 스타는 비싸다
}
// 검투사의 값: (전력 − 85) × 85 + 베테라누스 1,200 + 명예 × 15, 50 단위, 최소 1,000
export function ageMul(g: Gladiator): number { const P = CONFIG.statRoll.agePrice; return Math.max(P.min, 1 - Math.max(0, (g.age ?? 22) - P.from) * P.per); }
export function valueOf(g: Gladiator): number { const pw = powerOf({ ...g, fatigue: 0 }); const O = CONFIG.origins; const origin = g.origin === 'captive' ? O.captive.price : g.origin === 'damnatus' && (g.status ?? 'slave') === 'slave' ? O.damnatus.price : 1; return Math.max(1000, Math.round(((pw - 85) * 85 + (g.rank === 'veteranus' ? 1200 : 0) + (g.honor ?? 0) * 15) * origin * (g.talentKnown ? TALENT_PRICE_MUL[talentOf(g)] : 1) * ageMul(g) / 50) * 50); } // 자질은 밝혀진 뒤에만 값에 (시장에서는 상인도 모른다: 값으로 새지 않는다). 나이 24세 넘기면 해마다 −4% // 자질은 밝혀진 뒤(재능 +15%, 비범 +40%, 천부 +80%) // 값 = 전투력 + 계급 프리미엄(베테라누스는 대여료가 2.5배) + 명예(대여료 가산). 출신 할인(포로·죄수)은 값 자체에: 사고팔 때 같은 기준
// 매각가: 지금 능력치·승수로 다시 매긴 값의 일부. 키워서 값이 오르면 구매가보다 비싸게 팔 수 있다
export function sellPrice(g: Gladiator): number { return Math.round(valueOf(g) * CONFIG.sellBase); }
export function maybePromote(g: Gladiator): boolean {
  if (g.rank === 'tiro' && g.wins >= CONFIG.promoteWins) { g.rank = 'veteranus'; return true; }
  return false;
}
export function label(g: Gladiator): string {
  return `${g.name}(${TYPE_KO[g.type]}·${LINEAGE_KO[g.lineage]}·${g.rank === 'tiro' ? '티로' : '베테'} ${g.wins}승/${g.fights}전)`;
}

// 전력 점수: 계약 난이도(상대가 나보다 강한가)를 재는 대략치. 능력치 + 서열 + 기술 수. 전투 규칙 자체는 아니다
// 전력(전투력): 거울 대결 600판으로 잰 가중치 — 공 1 = 4, 방 1 = 4.5, HP 1 = 0.38, 속도 1 = 2.2. 기술은 잰 값(SKILL_WORTH). 계급·승수는 전투에 영향이 없어 넣지 않는다. 피로는 무료 1점을 넘긴 만큼 공·방 −1 → −8.5/점
export function powerOf(g: Gladiator): number {
  const b = g.base; const skills = (g.skills ?? []).reduce((a, id) => a + (SKILL_WORTH[id as keyof typeof SKILL_WORTH] ?? 0), 0);
  return b.hp * 0.38 + b.atk * 4 + b.def * 4.5 + b.spd * 2.2 + skills - Math.max(0, (g.fatigue ?? 0) - CONFIG.fatigue.free) * 8.5;
}
export const teamPower = (team: Gladiator[]) => team.reduce((a, g) => a + powerOf(g), 0);
