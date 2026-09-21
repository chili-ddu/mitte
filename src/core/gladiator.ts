import type { Gladiator, GType, Lineage, Rank, Stats } from './types.js';
import { Rng } from './rng.js';
import { CONFIG } from './config.js';
import { rollGrowth, rollCaps } from './growth.js';
import { classKey } from './classes.js';
import { TYPE_MATCHUP } from './matchup-table.js';
import { matchupOwner } from './matchup.js';
import { epithetMods } from './epithets.js';
import { rollTalent, talentOf, TALENT_PRICE_MUL } from './talent.js';
import namesJson from '../../data/names.json' with { type: 'json' };

// spd = 걸음(유형 고정) · hand = 손놀림 기본치(굴리고 자란다). 사거리는 classes.ts (2026-09-20)
export const TYPE_STATS: Record<GType, Stats> = {
  murmillo:  { hp: 120, atk: 14, def: 8, spd: 3, hand: 3 },
  secutor:   { hp: 110, atk: 14, def: 7, spd: 5, hand: 5 },
  thraex:    { hp: 95,  atk: 17, def: 4, spd: 6, hand: 6 },
  retiarius: { hp: 95,  atk: 15, def: 2, spd: 8, hand: 8 },
  hoplomachus: { hp: 100, atk: 15, def: 5, spd: 5, hand: 5 },
  provocator:  { hp: 115, atk: 14, def: 7, spd: 4, hand: 4 },
  eques:       { hp: 95,  atk: 15, def: 4, spd: 8, hand: 8 },
  dimachaerus: { hp: 95,  atk: 17, def: 3, spd: 7, hand: 7 },
  scissor:     { hp: 105, atk: 16, def: 4, spd: 6, hand: 6 }, // 세쿠토르 변형: 방패 대신 왼팔 관 끝의 반달 날 (부조·모자이크)
  laquearius:  { hp: 95,  atk: 14, def: 2, spd: 8, hand: 8 }, // 레티아리우스 변형: 그물 대신 올가미 (이시도루스)
};
export const TYPE_KO: Record<GType, string> = { murmillo: '무르밀로', secutor: '세쿠토르', thraex: '트라엑스', retiarius: '레티아리우스', hoplomachus: '호플로마쿠스', provocator: '프로보카토르', eques: '에퀘스', dimachaerus: '디마카에루스', scissor: '스키소르', laquearius: '라쿠에아리우스' };
export const LINEAGE_KO: Record<Lineage, string> = { nature: '자연', victory: '승리', myth: '신화', nickname: '별명', place: '지명' };

// 계보 다섯 모두 (2026-09-18 사용자: 그동안 자연·승리 둘만 뽑아 신화·별명·지명 이름 60개와 그 무늬가 한 번도 나오지 않았다)
const LINEAGES_1ST: Lineage[] = ['nature', 'victory', 'myth', 'nickname', 'place'];
export const TYPES: GType[] = ['murmillo', 'secutor', 'thraex', 'retiarius', 'hoplomachus', 'provocator', 'eques', 'dimachaerus', 'scissor', 'laquearius'];

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
  const s = TYPE_STATS[type]; const M = CONFIG.growthModel.rankMul[rank]; /* 초기 굴림 없음 (2026-09-21): 현재치는 유형 기본 × 서열. 차이는 잠재치·나이·성장형 */
  const grow = rank === 'veteranus' ? Math.min(CONFIG.statRoll.vetGrow.max, Math.floor(((opts.season ?? 1) - 1) / CONFIG.statRoll.vetGrow.every)) : 0; // 베테라누스 시즌 단련
  const base: Stats = { hp: Math.round(s.hp * M), atk: Math.round(s.atk * M) + grow, def: Math.round(s.def * M) + grow, spd: s.spd, hand: Math.max(1, Math.round(s.hand * M)) };
  const wins = rank === 'veteranus' ? rng.int(3, 6) : 0;
  const g: Gladiator = { id: nextId++, name, lineage, type, rank, base, fights: wins + rng.int(0, 2), wins, missios: 0, injured: 0, buyPrice: 0, alive: true, age, scaeva: rng.chance(0.1) || undefined }; // 왼손잡이 10% (비문에 따로 표기될 만큼 귀했다)
  g.talent = rollTalent(rng); g.growth = rollGrowth(rng); g.cap = rollCaps(rng, type, base, age, g.growth, s); g.buyPrice = valueOf(g); return g; // 값은 난수가 아니라 능력치·승수로 (+ 상인의 눈만큼 자질). 자질은 초기 능력치에 안 얹는다 (성장 가중치)
}

export function effectiveStats(g: Gladiator): Stats {
  const grow = 1; // 승수 성장(+2%/승)은 2026-09-20 뺐다 — 능력치는 훈련으로만 자라고, 경기 경험은 숙련 딕타타로 간다(docs/09). 승수는 신분·명예·값에만
  const pen = Math.max(0, (g.fatigue ?? 0) - CONFIG.fatigue.free) * CONFIG.fatigue.statPenalty + agePenalty(g).stat; // 피로(첫 1점 무료) + 노쇠
  const E = epithetMods(g); // 별칭
  return { hp: Math.max(1, Math.round(g.base.hp * grow * E.hp) - pen * CONFIG.hpPenPerStat), atk: Math.max(1, Math.round(g.base.atk * grow * E.atk) - pen), def: Math.max(0, Math.round(g.base.def * grow * E.def) - pen), spd: Math.max(1, g.base.spd - agePenalty(g).spd), hand: Math.max(1, Math.round(g.base.hand * grow) - agePenalty(g).spd) }; // 손놀림도 승수로 자라고 노쇠로 무뎌진다
}
// 노쇠: 31세부터 3년마다 속도 −1, 33세부터 2년마다 공·방 −1
// 체력 한 줄을 이루는 몫들 — 화면의 체력바가 이 값으로 초록(기본)·연초록(보너스)·붉은(패널티)을 칠한다 (2026-09-17 사용자)
export interface HpParts { base: number; bonus: number; pen: number; total: number }
export function hpParts(g: Gladiator, kitchen = 0): HpParts {
  const base = g.base.hp;
  const grown = Math.round(base * epithetMods(g).hp) - base; // 예명('흉터'는 음수) — 승수 성장은 2026-09-20 뺐다
  const wear = (Math.max(0, (g.fatigue ?? 0) - CONFIG.fatigue.free) * CONFIG.fatigue.statPenalty + agePenalty(g).stat) * CONFIG.hpPenPerStat; // 피로 + 노쇠
  const form = formMod(g).hp; // 이번 시즌 몸 상태
  const bonus = Math.max(0, grown) + kitchen + Math.max(0, form);
  const pen = wear + Math.max(0, -grown) + Math.max(0, -form);
  return { base, bonus, pen, total: Math.max(1, base + bonus - pen) };
}

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
// 전력(전투력): 거울 대결로 잰 가중치 — 공 1 = 4.5, 방 1 = 3, HP 1 = 0.44, 속도 1 = 1.35. 2026-09-17 재측정: 거울 대결로 잰 승률 이득이 HP+10 11.5%p · 공+1 11.8%p · 방+1 8.1%p · 속+1 3.6%p 였다 — 방패가 첫 타만 막던 시절에 잰 옛 값(방 4.5·속 2.2)은 방어와 속도를 과대평가하고 있었다. 비율은 측정값 그대로 두되 전체를 1.12배 해서 평균 전력을 옛 저울(135)에 맞춘다 — 등급 상한 160/200 과 값 기준선이 절대 수치를 쓰기 때문. 기술은 잰 값(SKILL_WORTH). 계급·승수는 전투에 영향이 없어 넣지 않는다. 피로는 무료 1점을 넘긴 만큼 공·방 −1 → −8.5/점
// 이번 철의 몸 상태: 값과 말. |f| 가 tell 을 넘어야 드러난다 (미지근한 날은 아무 말도 하지 않는다)
export const formMod = (g: Gladiator) => { const f = g.form ?? 0; return { atk: Math.round(f * CONFIG.form.atk), def: Math.round(f * CONFIG.form.def), hp: Math.round(f * CONFIG.form.hp) }; };
export const formLabel = (g: Gladiator): '가벼움' | '무거움' | null => { const f = g.form ?? 0; return f >= CONFIG.form.tell ? '가벼움' : f <= -CONFIG.form.tell ? '무거움' : null; };
export const formTip = (g: Gladiator) => { const m = formMod(g), l = formLabel(g); return `이번 철 몸 상태: ${l === '가벼움' ? '가볍다' : l === '무거움' ? '무겁다' : '보통'} — 체력 ${m.hp >= 0 ? '+' : ''}${m.hp} · 공 ${m.atk >= 0 ? '+' : ''}${m.atk} · 방 ${m.def >= 0 ? '+' : ''}${m.def}. 철마다 다시 정해진다`; };
export function powerOf(g: Gladiator): number {
  const b = g.base;
  const W = CONFIG.power; return b.hp * W.hp + b.atk * W.atk + b.def * W.def + b.spd * W.spd + b.hand * W.hand + (CONFIG.typePower[g.type] ?? 0) - Math.max(0, (g.fatigue ?? 0) - CONFIG.fatigue.free) * 8.5; // 유형 보정: 같은 전력이면 실제로 호각이도록
}
// 화면에 보여 줄 전력: 규칙이 쓰는 powerOf 와 같은 저울이되 **지금 몸**으로 잰다(승수 성장·예명·노쇠·피로·몸 상태).
// powerOf 는 타고난 값으로 재므로 계약 난이도·값 계산은 그대로 두고, 카드의 ± 만 이 차이를 보여 준다 (2026-09-17 사용자)
// 이번 상대와의 상성: 붙게 될 상대들을 평균해 1보다 크면 유리, 작으면 불리 (표는 matchup-table.ts — 실제 전투로 측정)
export function matchupFactor(g: Gladiator, foes: Gladiator[] = []): number {
  if (!foes.length) return 1;
  // 한 짝의 기울기는 **임자 쪽 전력만** 움직인다 — 같은 이야기로 양쪽이 동시에 오르내리지 않게 (2026-09-17 사용자)
  const d = foes.reduce((a, f) => a + (matchupOwner(g.type, f.type) === g.type ? (TYPE_MATCHUP[g.type]?.[f.type] ?? 0.5) - 0.5 : 0), 0) / foes.length;
  return 1 + d * CONFIG.matchup.power;
}
export function powerNow(g: Gladiator, foes: Gladiator[] = []): number {
  const e = effectiveStats(g), f = formMod(g);
  const W = CONFIG.power; const raw = (e.hp + f.hp) * W.hp + (e.atk + f.atk) * W.atk + (e.def + f.def) * W.def + e.spd * W.spd + e.hand * W.hand + (CONFIG.typePower[g.type] ?? 0);
  return raw * matchupFactor(g, foes); // 마주 설 상대가 정해졌으면 상성만큼 오르내린다
}

export const teamPower = (team: Gladiator[]) => team.reduce((a, g) => a + powerOf(g), 0);

// 프리무스 팔루스: 같은 유형 안의 1등 (승수 8·명예 20). 비문의 서열 호칭 — 기술 슬롯 수로 쓰던 것은 2026-09-18 기술 개념과 함께 뺐고 호칭만 남는다
export const isPrimusPalus = (g: Gladiator) => g.rank === 'veteranus' && g.wins >= 8 && (g.honor ?? 0) >= 20;

// 팔루스에 선 검투사가 무엇을 단련할지: 클래스 성장 풀의 가중치로 뽑는다 (2026-09-20 docs/09). 상대 파밀리아도 같은 풀로 훈련한다
export type TrainStat = 'atk' | 'def' | 'hp' | 'hand';
export function pickTrainStat(rng: Rng, g: Gladiator): TrainStat { const w0 = CONFIG.growth[classKey(g.type)] ?? { atk: 25, def: 25, hp: 25, hand: 25 }; const keys: TrainStat[] = ['atk', 'def', 'hp', 'hand']; const w = Object.fromEntries(keys.map(k => [k, g.cap && g.base[k] >= g.cap[k] ? 0 : (g.growth?.trait === 'even' ? 25 : w0[k])])) as Record<TrainStat, number>; /* 상한에 닿은 능력치는 안 뽑는다 · 고른 몸은 풀을 무시 */ const total = keys.reduce((a, k) => a + w[k], 0); if (total <= 0) return 'atk'; let r = rng.next() * total; for (const k of keys) { r -= w[k]; if (r <= 0) return k; } return 'atk'; }
