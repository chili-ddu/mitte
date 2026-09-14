import type { Gladiator, GType, Lineage, Rank, Stats } from './types.js';
import { Rng } from './rng.js';
import { CONFIG } from './config.js';
import { epithetMods } from './epithets.js';
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

export function makeGladiator(rng: Rng, rank: Rank, opts: { type?: GType; lineage?: Lineage } = {}): Gladiator {
  const type = opts.type ?? rng.pick(TYPES);
  const lineage = opts.lineage ?? rng.pick(LINEAGES_1ST);
  const pool = (namesJson as Record<string, { ko: string }[]>)[lineage];
  const name = rng.pick(pool).ko;
  const s = TYPE_STATS[type];
  const mult = rank === 'tiro' ? 0.85 : 1.0;
  const jitter = () => rng.range(0.9, 1.1);
  const base: Stats = {
    hp: Math.round(s.hp * mult * jitter()),
    atk: Math.round(s.atk * mult * jitter()),
    def: Math.round(s.def * mult * jitter()),
    spd: s.spd,
    range: s.range,
  };
  const [lo, hi] = rank === 'tiro' ? CONFIG.tiroPrice : CONFIG.veteranPrice;
  const wins = rank === 'veteranus' ? rng.int(3, 6) : 0;
  const [a0, a1] = rank === 'tiro' ? CONFIG.age.tiro : CONFIG.age.veteran;
  return { id: nextId++, name, lineage, type, rank, base, fights: wins + rng.int(0, 2), wins, missios: 0, injured: 0, buyPrice: rng.int(lo, hi), alive: true, age: rng.int(a0, a1), scaeva: rng.chance(0.1) || undefined }; // 왼손잡이 10% (비문에 따로 표기될 만큼 귀했다)
}

export function effectiveStats(g: Gladiator): Stats {
  const grow = 1 + g.wins * 0.02;
  const pen = (g.fatigue ?? 0) * CONFIG.fatigue.statPenalty + agePenalty(g).stat; // 피로 + 노쇠
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
export function sellPrice(g: Gladiator): number {
  return Math.round(g.buyPrice * CONFIG.sellBase + g.wins * CONFIG.sellPerWin);
}
export function maybePromote(g: Gladiator): boolean {
  if (g.rank === 'tiro' && g.wins >= CONFIG.promoteWins) { g.rank = 'veteranus'; return true; }
  return false;
}
export function label(g: Gladiator): string {
  return `${g.name}(${TYPE_KO[g.type]}·${LINEAGE_KO[g.lineage]}·${g.rank === 'tiro' ? '티로' : '베테'} ${g.wins}승/${g.fights}전)`;
}

// 전력 점수: 계약 난이도(상대가 나보다 강한가)를 재는 대략치. 능력치 + 서열 + 기술 수. 전투 규칙 자체는 아니다
export function powerOf(g: Gladiator): number {
  const b = g.base; const skills = (g.skills ?? []).length;
  return b.hp * 0.35 + b.atk * 4 + b.def * 3.5 + b.spd * 2 + skills * 6 + (g.rank === 'veteranus' ? 8 : 0) - (g.fatigue ?? 0) * 6;
}
export const teamPower = (team: Gladiator[]) => team.reduce((a, g) => a + powerOf(g), 0);
