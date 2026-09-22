import type { Gladiator, GType, Lineage, Rank, Stats } from './types.js';
import { Rng } from './rng.js';
import { CONFIG } from './config.js';
import { rollGrowth, rollCaps, secondWind } from './growth.js';
import { classKey } from './classes.js';
import { TYPE_MATCHUP } from './matchup-table.js';
import { matchupOwner } from './matchup.js';
import { epithetMods } from './epithets.js';
import { rollTalent, talentOf, TALENT_PRICE_MUL } from './talent.js';
import { legendOfType, LEGEND_BY_ID, type Legend } from './legends.js';
import namesJson from '../../data/names.json' with { type: 'json' };

// spd = 걸음(유형 고정) · hand = 손놀림 기본치(굴리고 자란다). 사거리는 classes.ts (2026-09-20)
// 공격은 2026-09-22 한 자릿수로 다시 쟀다(14~17 → 7~9): 피해 공식이 CONFIG.atkScale(2) 를 곱해 전투는 그대로. 네 능력치가 같은 눈금(2~10)에서 시작해 20칸 막대가 같은 뜻이 되게
export const TYPE_STATS: Record<GType, Stats> = {
  murmillo:  { hp: 115, atk: 7, def: 8, spd: 3, hand: 3 },
  secutor:   { hp: 110, atk: 7, def: 7, spd: 5, hand: 5 },
  thraex:    { hp: 90,  atk: 9, def: 4, spd: 6, hand: 6 },
  retiarius: { hp: 100, atk: 8, def: 2, spd: 8, hand: 8 },
  hoplomachus: { hp: 95, atk: 8, def: 5, spd: 5, hand: 5 },
  provocator:  { hp: 110, atk: 7, def: 7, spd: 4, hand: 4 },
  eques:       { hp: 100, atk: 8, def: 4, spd: 8, hand: 8 },
  dimachaerus: { hp: 95,  atk: 9, def: 3, spd: 7, hand: 7 },
  scissor:     { hp: 110, atk: 8, def: 4, spd: 6, hand: 6 }, // 세쿠토르 변형: 방패 대신 왼팔 관 끝의 반달 날 (부조·모자이크)
  laquearius:  { hp: 100, atk: 8, def: 3, spd: 8, hand: 8 }, // 레티아리우스 변형: 그물 대신 올가미 (이시도루스)
};
export const TYPE_KO: Record<GType, string> = { murmillo: '무르밀로', secutor: '세쿠토르', thraex: '트라엑스', retiarius: '레티아리우스', hoplomachus: '호플로마쿠스', provocator: '프로보카토르', eques: '에퀘스', dimachaerus: '디마카에루스', scissor: '스키소르', laquearius: '라쿠에아리우스' };
export const LINEAGE_KO: Record<Lineage, string> = { nature: '자연', victory: '승리', myth: '신화', nickname: '별호', place: '지역' }; // 이름 유래 다섯 갈래 (2026-09-22 사용자: 별명 → 별호, 지명 → 지역 — '별명'은 예명과 헷갈렸다)
export const LINEAGE_DESC: Record<Lineage, string> = { nature: '짐승·자연에서 온 이름 — 곰·사자·번개, 포로에게 붙이던 힘의 이름', victory: '승리·행운을 비는 이름 — 빅토르·펠릭스, 로마인 자원자', myth: '신·영웅에서 온 이름 — 헤르메스·아킬레우스, 그리스계', nickname: '별호가 굳은 이름 — 싸움꾼·비둘기·넷째, 생김새나 버릇', place: '고향·도시 이름 — 카푸아누스·폼페이아누스' }; // 툴팁·규칙 설명

// 계보 다섯 모두 (2026-09-18 사용자: 그동안 자연·승리 둘만 뽑아 신화·별명·지명 이름 60개와 그 무늬가 한 번도 나오지 않았다)
const LINEAGES_1ST: Lineage[] = ['nature', 'victory', 'myth', 'nickname', 'place'];
export const TYPES: GType[] = ['murmillo', 'secutor', 'thraex', 'retiarius', 'hoplomachus', 'provocator', 'eques', 'dimachaerus', 'scissor', 'laquearius'];

let nextId = 1;
export function resetIds() { nextId = 1; }
export function peekNextId() { return nextId; }
export function setNextId(n: number) { nextId = n; }

export function makeGladiator(rng: Rng, rank: Rank, opts: { type?: GType; lineage?: Lineage; season?: number; age?: number; taken?: Set<string>; legend?: string } = {}): Gladiator { /* legend: 디버그용 — 이 전설을 강제로 */ /* taken: 살아 있는 전설 id — 넘기면 천부가 전설로 나올 수 있고, 꺼낸 전설은 여기에 더한다. 안 넘기면(시작 검투사·타지 검투사·측정) 천부는 비범으로 내린다 */
  const type = opts.legend ? LEGEND_BY_ID[opts.legend].type : opts.type ?? rng.pick(TYPES);
  const lineage = opts.lineage ?? rng.pick(LINEAGES_1ST);
  const pool = (namesJson as Record<string, { ko: string }[]>)[lineage];
  const name = rng.pick(pool).ko;
  const [a0, a1] = rank === 'tiro' ? CONFIG.age.tiro : CONFIG.age.veteran; let age = opts.age ?? rng.int(a0, a1); // 나이가 곧 자란 정도 (2026-09-21)
  const s = TYPE_STATS[type]; /* 서열 배율 없음 (2026-09-21): 현재치는 유형 기본에서 나이만큼 상한 쪽으로 자라 있다 */
  const base: Stats = { hp: s.hp, atk: s.atk, def: s.def, spd: s.spd, hand: s.hand };
  const wins = rank === 'veteranus' ? rng.int(3, 6) : 0;
  const g: Gladiator = { id: nextId++, name, lineage, type, rank, base, fights: wins + rng.int(0, 2), wins, missios: 0, injured: 0, buyPrice: 0, alive: true, age, scaeva: rng.chance(0.1) || undefined }; // 왼손잡이 10% (비문에 따로 표기될 만큼 귀했다)
  g.talent = rollTalent(rng); g.talentKnown = true; /* 2026-09-22 사용자: 자질도 처음부터 보인다 (성장형·상한과 같이) — 값에도 처음부터 들어간다 */ g.growth = rollGrowth(rng);
  let legend: Legend | undefined; if (opts.legend) { legend = LEGEND_BY_ID[opts.legend]; g.talent = 3; } else if (g.talent === 3) { const l = legendOfType(type); if (l && opts.taken && !opts.taken.has(l.id) && rng.chance(CONFIG.legend.p)) { legend = l; opts.taken.add(l.id); } } /* 천부 중 확률로 전설 (2026-09-22 사용자): 그 유형의 인물이 비어 있어야 한다. 아니면 그냥 천부 */
  if (legend) { g.legend = legend.id; g.name = legend.name; age = legend.age; g.age = age; g.growth = { ...legend.growth }; g.dictata = [legend.dictata]; g.scaeva = undefined; }
  g.cap = rollCaps(rng, type, base, age, g.growth, s, g.talent, legend?.pot); secondWind(g); /* 서른 넘은 늦바람 매물은 만들 때 바로 상한 +15% (2026-09-22) */
  { const A = CONFIG.growthModel.grownByAge; const f = A.max * Math.max(0, Math.min(1, (age - A.from) / (A.to - A.from))); for (const k of ['hp', 'atk', 'def', 'hand'] as const) g.base[k] = Math.min(g.cap[k], g.base[k] + Math.round((g.cap[k] - g.base[k]) * f * rng.range(0.85, 1.15))); } // 나이만큼 자라 있다 (±15% 흔들림)
  g.buyPrice = valueOf(g); return g; // 값은 난수가 아니라 능력치·승수로 (+ 상인의 눈만큼 자질). 자질은 초기 능력치에 안 얹는다 (성장 가중치)
}

export function effectiveStats(g: Gladiator): Stats {
  const grow = 1; // 승수 성장(+2%/승)은 2026-09-20 뺐다 — 능력치는 훈련으로만 자라고, 경기 경험은 숙련 딕타타로 간다(docs/09). 승수는 신분·명예·값에만
  const pen = Math.max(0, (g.fatigue ?? 0) - CONFIG.fatigue.free) * CONFIG.fatigue.statPenalty; // 피로(첫 1점 무료). 노쇠는 2026-09-22 뺐다
  return { hp: Math.max(1, Math.round(g.base.hp * grow) - pen * CONFIG.hpPenPerStat), atk: Math.max(1, Math.round(g.base.atk * grow) - Math.floor(pen / CONFIG.atkScale)), /* 공격은 눈금이 절반이라 피로 벌점도 절반(내림) */ def: Math.max(0, Math.round(g.base.def * grow) - pen), spd: Math.max(1, g.base.spd), hand: Math.max(1, Math.round(g.base.hand * grow)) }; // 예명 능력치 효과는 2026-09-22 뺐다
}
// 체력 한 줄을 이루는 몫들 — 화면의 체력바가 이 값으로 초록(기본)·연초록(보너스)·붉은(패널티)을 칠한다 (2026-09-17 사용자)
export interface HpParts { base: number; bonus: number; pen: number; total: number }
export function hpParts(g: Gladiator, kitchen = 0): HpParts {
  const base = g.base.hp;
  const wear = Math.max(0, (g.fatigue ?? 0) - CONFIG.fatigue.free) * CONFIG.fatigue.statPenalty * CONFIG.hpPenPerStat; // 피로
  const bonus = kitchen; /* 보탬은 조리장만 — 예명·몸 상태는 2026-09-22 뺐다 */
  const pen = wear;
  return { base, bonus, pen, total: Math.max(1, base + bonus - pen) };
}

// 나이와 몸 (2026-09-22 사용자: 노쇠는 능력치가 아니라 부상으로): 30세부터 해마다 부상 확률 +10%, 최대 ×1.6
export function injuryAgeMul(g: Gladiator): number { const A = CONFIG.age, age = g.age ?? 22; return Math.min(A.injuryMax, 1 + Math.max(0, age - A.injuryFrom + 1) * A.injuryPer); }
export function healAgeCut(g: Gladiator): number { const A = CONFIG.age, age = g.age ?? 22; return A.healCutFrom.filter(a => age >= a).length * A.healCut; } // 방치 자연 회복이 30세·36세에 −5%p 씩

// 팬: 명예 + 승수×2 + 별칭×5. 30 이상이면 스타 (관중이 이름을 외친다)
export function fansOf(g: Gladiator): number { return Math.round(((g.honor ?? 0) + g.wins * 2 + ((g.epithets ?? []).length ? 5 : 0)) * epithetMods(g).fans); } // 예명이 있으면 +5 (하나만 단다), '무패' 는 팬 ×1.3
export function rentFee(g: Gladiator, tier: number): number {
  return Math.round((g.rank === 'tiro' ? CONFIG.rentTiro : CONFIG.rentVeteran) * tier * (1 + (g.honor ?? 0) * CONFIG.honor.rentPer) * epithetMods(g).rent); // 스타는 비싸다
}
// 검투사의 값: (전력 − 85) × 85 + 베테라누스 1,200 + 명예 × 15, 50 단위, 최소 1,000
export function ageMul(g: Gladiator): number { const P = CONFIG.statRoll.agePrice; return Math.max(P.min, 1 - Math.max(0, (g.age ?? 22) - P.from) * P.per); }
export function valueOf(g: Gladiator): number { const pw = powerOf({ ...g, fatigue: 0 }); const O = CONFIG.origins; const origin = g.origin === 'captive' ? O.captive.price : g.origin === 'damnatus' && (g.status ?? 'slave') === 'slave' ? O.damnatus.price : 1; return Math.max(1000, Math.round(((pw - CONFIG.priceBase) * 85 + (g.rank === 'veteranus' ? 1200 : 0) + (g.honor ?? 0) * 15) * origin * TALENT_PRICE_MUL[talentOf(g)] * ageMul(g) / 50) * 50); } // 자질은 밝혀진 뒤에만 값에 (시장에서는 상인도 모른다: 값으로 새지 않는다). 나이 24세 넘기면 해마다 −4% // 자질은 밝혀진 뒤(재능 +15%, 비범 +40%, 천부 +80%) // 값 = 전투력 + 계급 프리미엄(베테라누스는 대여료가 2.5배) + 명예(대여료 가산). 출신 할인(포로·죄수)은 값 자체에: 사고팔 때 같은 기준
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
/* 몸 상태(form)는 2026-09-22 뺐다 — 시즌 단위 소음이 전투의 확률 위에 한 겹 더 얹혀 설명이 아니라 핑계로 읽혔다 */
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
  const e = effectiveStats(g);
  const W = CONFIG.power; const raw = e.hp * W.hp + e.atk * W.atk + e.def * W.def + e.spd * W.spd + e.hand * W.hand + (CONFIG.typePower[g.type] ?? 0);
  return raw * matchupFactor(g, foes); // 마주 설 상대가 정해졌으면 상성만큼 오르내린다
}

export const teamPower = (team: Gladiator[]) => team.reduce((a, g) => a + powerOf(g), 0);

// 프리무스 팔루스: 같은 유형 안의 1등 (승수 8·명예 20). 비문의 서열 호칭 — 기술 슬롯 수로 쓰던 것은 2026-09-18 기술 개념과 함께 뺐고 호칭만 남는다
export const isPrimusPalus = (g: Gladiator) => g.rank === 'veteranus' && g.wins >= 8 && (g.honor ?? 0) >= 20;

// 팔루스에 선 검투사가 무엇을 단련할지: 클래스 성장 풀의 가중치로 뽑는다 (2026-09-20 docs/09). 상대 파밀리아도 같은 풀로 훈련한다
export type TrainStat = 'atk' | 'def' | 'hp' | 'hand';
export function pickTrainStat(rng: Rng, g: Gladiator): TrainStat { const w0 = CONFIG.growth[classKey(g.type)] ?? { atk: 25, def: 25, hp: 25, hand: 25 }; const keys: TrainStat[] = ['atk', 'def', 'hp', 'hand']; const w = Object.fromEntries(keys.map(k => [k, g.cap && g.base[k] >= g.cap[k] ? 0 : (g.growth?.trait === 'even' ? 25 : w0[k])])) as Record<TrainStat, number>; /* 상한에 닿은 능력치는 안 뽑는다 · 고른 몸은 풀을 무시 */ const total = keys.reduce((a, k) => a + w[k], 0); if (total <= 0) return 'atk'; let r = rng.next() * total; for (const k of keys) { r -= w[k]; if (r <= 0) return k; } return 'atk'; }
