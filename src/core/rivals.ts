// 상대 파밀리아: 시즌을 넘어 유지되는 경쟁 검투사단. 계약의 상대는 여기서 뽑히고, 그들도 전적·부상·사망·명예가 쌓인다
// 2026-09-20(docs/10): 시즌 수로 세지지 않는다. 금고(purse)·기세(mood)·즐겨 사는 무장(focus)으로 자기 살림을 하고, 자기 경기 결과로 자란다
// 2026-10-01(docs/11 5·6절, 옛 main 바탕으로 다시 얹음): 막 진행은 **도장 사슬** — 메인 여섯은 order 순서로, 앞 집을 졸업(간판 내기 승리)해야 다음 집이 온다. 호감도와 무관. 서브 여덟은 단계마다 갈라져 나오는 선택지. 간판·두 번째는 이름·유형이 정해져 있고(전설 열 명이 얼굴이 된다) 간판은 절대 강도(challenge.strength × basePower). 살림·도전장·연차 상대 고르기는 그대로
import type { Gladiator, GType, Lineage } from './types.js';
import { Rng } from './rng.js';
import { CONFIG } from './config.js';
import { makeGladiator, powerOf, valueOf, TYPES, RESERVED_NAMES, fitPower } from './gladiator.js';
import { LEGEND_BY_ID } from './legends.js';
import { masteryCandidates } from './dictata.js';
import { growAll } from './growth.js';
import { CAST, castState, makeFromCast, type CastBook } from './cast.js';

export type RivalProfile = 'local' | 'major' | 'grand'; // 지방 파밀리아 · 큰 루두스 · 최대 루두스
export interface Rival {
  id: number; name: string; roster: Gladiator[];
  vsMe?: { wins: number; losses: number; draws: number }; // 그 파밀리아가 나를 상대로 거둔 전적
  profile?: RivalProfile; since?: number;                  // 나타난 시즌
  color?: string;          // 파밀리아 색 (TEAM_COLOR_IDS 중 하나, 새 게임·등장 때 우리와 다른 것으로 굴림. 2026-09-21 사용자)
  mood: number;            // 기세 −2~+2: 이기면 오르고 간판이 죽으면 떨어진다. 도전장을 낼지, 베테라누스를 살지 정한다
  purse: number;           // 금고: 검투사를 사고 훈련시킬 돈. 자기 경기 결과로 ±
  focus: string;           // 즐겨 사는 클래스 (classKey) — 표시용. 보충 유형은 def.typeWeights 가 정한다 (2026-10-01)
  revengeDue?: number;     // 이 시즌에 복수 도전장을 낸다
  silentUntil?: number;    // 간판이 죽어 이 시즌까지 도전장을 안 낸다
  refused?: number;        // 우리가 이 파밀리아의 도전장을 거절한 횟수
  starId?: number;         // 지정 간판 (2026-10-01 도장 사슬). 없으면 명예 최고
  secondId?: number;       // 두 번째 — 간판이 빠지면 잇는다
  graduated?: number;      // 졸업(간판 내기 승리) 시즌. 메인은 다음 도장을 열고, 서브는 그 집 계약이 끊긴다
  challengeSince?: number; // 간판 내기를 처음 건 시즌 (기록용)
  beatenIds?: number[];    // 우리 앞에 쓰러진 적이 있는 이 집 사람들의 id (서로 다른 사람 수가 졸업 조건 — 죽거나 팔려 나가도 센다, 2026-10-01)
}
// 고증: 카푸아의 율리우스 루두스(카이사르), 네로의 루두스는 지방 파밀리아보다 훨씬 컸다. 폼페이 경기 광고의 주최자 암플리아투스 가문. 누케리아는 59년 폼페이와 원형경기장 난동을 벌인 앙숙. 카푸아는 검투사 양성의 본산
/* 파밀리아 특징(2026-09-22 사용자): 파밀리아는 '누구를 세우는가'(명단 성향)만 갖고, '어떤 경기인가'(상금·미시오·짝 주문)는 주최자의 몫. 도전장·훈련·교체는 창작이고 사다리·이름 방식은 고증 (docs/03 §15) */
export type RivalTrait = 'weak' | 'brawler' | 'careful' | 'trader' | 'trainer' | 'noble' | 'classic' | 'elite' | 'legend';
export const RIVAL_TRAIT_KO: Record<RivalTrait, string> = { weak: '훈련 부실', brawler: '호전적', careful: '신중', trader: '상인', trainer: '훈련소', noble: '명가', classic: '정식 대결', elite: '정예', legend: '전설 보유' };
export const RIVAL_TRAIT_DESC: Record<RivalTrait, string> = { weak: '독토르가 없어 명단이 자라지 않는다', brawler: '도전장을 두 배로 자주 보내고 기세가 크게 오르내린다', careful: '간판이 우리 으뜸보다 셀 때만 도전장을 보낸다', trader: '시즌마다 가장 약한 검투사를 팔고 새로 산다 — 같은 얼굴을 오래 안 본다', trainer: '시즌마다 셋을 훈련한다 — 오래 두면 세진다', noble: '베테라누스가 많고, 이 집을 이기면 호감이 하나 더 오른다', classic: '이 집이 낀 계약은 전통 짝 주문이 두 배로 잦다', elite: '거의 전원이 베테라누스', legend: '전설의 이름을 가진 검투사를 두고 있다' };
export type RivalKind = 'main' | 'sub' | 'damnati'; // 메인(도장) · 서브(성장 계단·선택. 졸업하면 얼굴을 얻고 그 집 계약이 끊긴다) · 죄수단(이름 없는 죄수, 시네 미시오네, 간판·졸업 없음)
export interface NamedSpec { name: string; type: GType; lineage: Lineage; legend?: string; scaeva?: boolean } // legend: 전설 id (legends.ts) — 이름·유형·능력치가 그 인물의 고정값
export interface RivalDef {
  id: number; name: string; city: string; profile: RivalProfile; traits: RivalTrait[]; desc: string; focus: string;
  kind?: RivalKind; order: number;   // 도장 순서 (메인 1~6, 서브 101~). 화면은 메인만 'N/6'
  after?: number;                    // 이 id 를 졸업해야 나타난다 (없으면 시작부터)
  star: NamedSpec & { honor: number }; // 지정 간판. 명예로 미시오가 거의 확정되어 사고사만 남는다
  second?: NamedSpec;                // 두 번째 (서브는 없을 수 있다)
  typeWeights: Partial<Record<GType, number>>; // 소속의 유형 경향 (없는 유형은 1)
  challenge: { size: 1 | 2 | 3; strength: number; tier: 1 | 2 | 3 }; // 졸업전(간판 내기) 규모 · 간판 절대 강도 계수 · 계약 등급 (3이면 호감도 60 — 큰 경기 주최자가 있어야 열린다)
  size?: number;                     // 정원 (메인 6 = 간판+두 번째+소속 4, 서브 4 = 얼굴+소속 3)
  color?: string;                    // 서브의 색 한 줄
}
export const kindOf = (d: RivalDef): RivalKind => d.kind ?? 'main';
export const sizeOf = (d: RivalDef) => d.size ?? 6;
export const MAIN_COUNT = 6;
/* 1회차 캄파니아 (docs/11 5-1·6). 간판 명예는 도장 순서대로 40·50·60·70·80·90. 전설(legends.ts)은 그 인물의 고정 유형을 따른다 — 테트라이테스는 에퀘스(설계의 프로보카토르 아님) */
export const RIVAL_DEFS: RivalDef[] = [
  { id: 4, name: '스카이바 파밀리아', city: '스타비아이', profile: 'local', order: 1, star: { name: '알바누스', type: 'murmillo', lineage: 'victory', honor: 40, scaeva: true }, second: { name: '심마쿠스', type: 'thraex', lineage: 'nickname' }, typeWeights: { murmillo: 4, thraex: 4 }, challenge: { size: 1, strength: 0.9, tier: 1 }, traits: ['brawler'], desc: '이웃 도시의 지방 파밀리아. 왼손잡이 유파 — 간판 알바누스가 왼손잡이다. 걸핏하면 도전장을 보낸다', focus: 'bigShield+gladius' },
  { id: 2, name: '암플리아투스 파밀리아', city: '폼페이', profile: 'local', order: 2, star: { name: '몬타누스', type: 'retiarius', lineage: 'nature', honor: 50 }, second: { name: '아라킨투스', type: 'secutor', lineage: 'place' }, typeWeights: { retiarius: 4, secutor: 4 }, challenge: { size: 1, strength: 1.0, tier: 1 }, traits: ['classic'], desc: '폼페이 광고문에 남은 라니스타 암플리아투스의 흥행 가문. 그물과 세쿠토르의 전통 짝 위주', focus: 'bare+spear' },
  { id: 5, name: '누케리아 파밀리아', city: '누케리아', profile: 'local', order: 3, after: 2, star: { name: '타우루스', type: 'dimachaerus', lineage: 'nature', honor: 60 }, second: { name: '우르수스', type: 'hoplomachus', lineage: 'nature' }, typeWeights: { dimachaerus: 4, hoplomachus: 4 }, challenge: { size: 1, strength: 1.1, tier: 2 }, traits: ['brawler'], desc: '폼페이의 앙숙 누케리아(59년 원형경기장 난동). 방패 없는 거친 유형', focus: 'bare+sica' },
  { id: 3, name: '네로니아누스 루두스', city: '카푸아', profile: 'major', order: 4, after: 5, star: { name: '힐라루스', type: 'thraex', lineage: 'victory', honor: 70 }, second: { name: '스피쿨루스', type: 'murmillo', lineage: 'nickname', legend: 'spiculus' }, typeWeights: {}, challenge: { size: 1, strength: 1.2, tier: 2 }, traits: ['noble'], desc: '카푸아의 황실 루두스. 베테라누스가 많다. 두 번째는 네로가 총애한 스피쿨루스', focus: 'smallShield+spear' },
  { id: 6, name: '카푸아 파밀리아', city: '카푸아', profile: 'major', order: 5, after: 3, star: { name: '카스토르', type: 'eques', lineage: 'myth', honor: 80 }, second: { name: '테트라이테스', type: 'eques', lineage: 'place', legend: 'tetraites' }, typeWeights: { eques: 4, provocator: 4 }, challenge: { size: 2, strength: 1.3, tier: 3 }, traits: ['trainer'], desc: '검투사 양성의 본산 카푸아. 기술과 독토르. 말 탄 에퀘스 둘이 이름났다', focus: 'smallShield+gladius' },
  { id: 1, name: '율리우스 파밀리아', city: '카푸아', profile: 'grand', order: 6, after: 6, star: { name: '오케아누스', type: 'secutor', lineage: 'nature', honor: 90 }, second: { name: '세베루스', type: 'hoplomachus', lineage: 'victory' }, typeWeights: {}, challenge: { size: 3, strength: 1.45, tier: 3 }, traits: ['classic', 'noble'], desc: '카이사르가 세운 카푸아의 최대 루두스. 로마 경기의 단골이라 전통 짝 주문이 잦다. 1회차의 마지막 도장', focus: 'bigShield+gladius' },
  { id: 11, kind: 'sub', size: 4, name: '헤르쿨라네움 파밀리아', city: '헤르쿨라네움', profile: 'local', order: 101, color: '미남 검투사단', star: { name: '켈라두스', type: 'thraex', lineage: 'nickname', legend: 'celadus', honor: 40 }, typeWeights: { thraex: 3, retiarius: 3, eques: 2 }, challenge: { size: 1, strength: 0.85, tier: 1 }, traits: ['weak'], desc: '경량 유형의 미남 검투사단 — 관중석의 소녀들이 따라다닌다. 얼굴은 "소녀들의 한숨" 켈라두스', focus: 'smallShield+sica' },
  { id: 12, kind: 'sub', size: 4, name: '폼페이 흥행단', city: '폼페이', profile: 'local', order: 102, color: '쇼맨', star: { name: '크레스켄스', type: 'retiarius', lineage: 'nature', legend: 'crescens', honor: 45 }, typeWeights: { retiarius: 3, secutor: 3 }, challenge: { size: 1, strength: 0.95, tier: 1 }, traits: ['classic'], desc: '평범 위주의 소규모 흥행단. 이기든 지든 관중에게 손을 흔드는 쇼맨들. 얼굴은 "밤의 소녀들의 의사" 크레스켄스', focus: 'bare+spear' },
  { id: 13, kind: 'sub', size: 4, name: '순회 검투사단', city: '아텔라', profile: 'local', order: 103, after: 2, color: '떠돌이단', star: { name: '플람마', type: 'secutor', lineage: 'nature', legend: 'flamma', honor: 60 }, typeWeights: {}, challenge: { size: 1, strength: 1.05, tier: 2 }, traits: ['trader'], desc: '도시를 도는 떠돌이단. 시장에서 안 팔린 사람들이 여기로 온다. 아텔라는 소극의 고향 — 배우 출신이 섞였다. 얼굴은 루디스를 네 번 거절한 플람마', focus: 'bigShield+gladius' },
  { id: 14, kind: 'sub', size: 4, name: '놀라 파밀리아', city: '놀라', profile: 'local', order: 104, after: 2, color: '방패벽', star: { name: '아틸리우스', type: 'murmillo', lineage: 'victory', honor: 50 }, typeWeights: { murmillo: 4, provocator: 4 }, challenge: { size: 2, strength: 1.15, tier: 2 }, traits: ['careful'], desc: '수염 기른 방패벽. 말이 없다. 얼굴은 폼페이 낙서의 마르쿠스 아틸리우스', focus: 'bigShield+gladius' },
  { id: 15, kind: 'damnati', size: 4, name: '담나티 (죄수단)', city: '폼페이', profile: 'local', order: 105, after: 2, color: '죄수단', star: { name: '죄수', type: 'dimachaerus', lineage: 'nickname', honor: 0 }, typeWeights: { dimachaerus: 3, thraex: 3 }, challenge: { size: 1, strength: 1.0, tier: 1 }, traits: ['weak'], desc: '형벌로 검투장에 보내진 이름 없는 죄수들. 시네 미시오네 — 호감도는 오르지만 명예는 없다. 간판도 졸업도 없다', focus: 'bare+sica' },
  { id: 16, kind: 'sub', size: 4, name: '푸테올리 항구 파밀리아', city: '푸테올리', profile: 'major', order: 106, after: 3, color: '항구의 포로', star: { name: '우르비쿠스', type: 'secutor', lineage: 'place', honor: 60 }, typeWeights: { secutor: 3, dimachaerus: 3, hoplomachus: 2 }, challenge: { size: 3, strength: 1.25, tier: 2 }, traits: ['brawler'], desc: '항구의 거친 포로들. 강하고 부상이 잦다. 3대3', focus: 'bigShield+gladius' },
  { id: 17, kind: 'sub', size: 3, name: '여성 검투사단', city: '할리카르나소스', profile: 'local', order: 107, after: 3, color: '작은 단', star: { name: '아마존', type: 'provocator', lineage: 'myth', honor: 50 }, second: { name: '아킬리아', type: 'provocator', lineage: 'myth' }, typeWeights: { provocator: 4, retiarius: 2 }, challenge: { size: 1, strength: 1.2, tier: 2 }, traits: ['careful'], desc: '아마존과 아킬리아의 짝(할리카르나소스 부조). 셋뿐인 작은 단', focus: 'bigShield+gladius' },
  { id: 18, kind: 'sub', size: 4, name: '베네벤툼 파밀리아', city: '베네벤툼', profile: 'major', order: 108, after: 6, color: '노장', star: { name: '푸그낙스', type: 'thraex', lineage: 'nickname', honor: 70 }, typeWeights: { thraex: 3, hoplomachus: 3, provocator: 2 }, challenge: { size: 1, strength: 1.35, tier: 3 }, traits: ['trainer', 'noble'], desc: '노장들. 기술은 많고 체력은 없다. 등급 3 주최자가 있어야 졸업전이 열린다', focus: 'smallShield+sica' },
];
for (const d of RIVAL_DEFS) { RESERVED_NAMES.add(d.star.name); if (d.second) RESERVED_NAMES.add(d.second.name); } // 얼굴 이름은 랜덤 풀에서 뺀다
export const rivalTraits = (r: Rival): RivalTrait[] => RIVAL_DEFS.find(d => d.id === r.id)?.traits ?? [];
export const rivalDef = (r: Rival): RivalDef | undefined => RIVAL_DEFS.find(d => d.id === r.id);
export const dojoOrder = (r: Rival) => rivalDef(r)?.order ?? 0;
export const isMain = (r: Rival) => { const d = rivalDef(r); return !!d && kindOf(d) === 'main'; };

export const TEAM_COLOR_IDS = ['caeruleum', 'viride', 'aerugo', 'sil', 'minium', 'aes'] as const; // 벽화 안료 여섯 — 화면의 TEAM_COLORS 와 같은 순서 (우리 하나 + 파밀리아 넷이 서로 다르게)
export const pickColor = (rng: Rng, used: (string | undefined)[]): string => { const free = TEAM_COLOR_IDS.filter(c => !used.includes(c)); return rng.pick(free.length ? free : [...TEAM_COLOR_IDS]); };
const ORD = ['', ' 세쿤두스', ' 테르티우스', ' 콰르투스', ' 퀸투스'];
const RV = () => CONFIG.rivals;
function weightedType(rng: Rng, w: Partial<Record<GType, number>>): GType { const total = TYPES.reduce((a, t) => a + (w[t] ?? 1), 0); let r = rng.next() * total; for (const t of TYPES) { r -= w[t] ?? 1; if (r < 0) return t; } return TYPES[TYPES.length - 1]; }
/* 파밀리아 품질: 능력치·상한에 배율 (2026-09-22). 타지 라니스타의 검투사(contracts.ts)에 쓴다 — 지방 무누스는 ×0.9 */
export function applyQuality(g: Gladiator, q: number): Gladiator { if (q === 1) return g; for (const k of ['hp', 'atk', 'def', 'hand'] as const) { g.base[k] = Math.max(1, Math.round(g.base[k] * q)); if (g.cap) g.cap[k] = Math.max(g.base[k], Math.round(g.cap[k] * q)); } g.buyPrice = valueOf(g); return g; }
function dedupe(g: Gladiator, roster: Gladiator[]) { const base = g.name; let k = 0; while (roster.some(o => o !== g && o.name === g.name) && k < ORD.length - 1) { k++; g.name = base + ORD[k]; } } // 같은 파밀리아 안에서 이름 겹침 방지
function vetRecord(rng: Rng, g: Gladiator, season: number) { g.wins = rng.int(3, 3 + Math.min(9, Math.floor(season / 2))); g.fights = g.wins + rng.int(0, 3); g.honor = rng.int(0, Math.min(30, season * 2));
  const cand = masteryCandidates(g.type); const n = Math.min(2, Math.floor(g.wins / 3)); for (let k = 0; k < n; k++) if (rng.chance(CONFIG.mastery.rivalVetP)) { const pick = rng.pick(cand.filter(m => !(g.dictata ?? []).includes(m.id))); if (pick) (g.dictata ??= []).push(pick.id); } } // 상대 베테라누스도 승수만큼 익힌 것이 있다
function makeMember(rng: Rng, season: number, roster: Gladiator[], rank: 'tiro' | 'veteranus', def: RivalDef | undefined): Gladiator {
  const g = makeGladiator(rng, rank, { season, type: weightedType(rng, def?.typeWeights ?? {}) }); g.boughtSeason = season;
  if (rank === 'veteranus') vetRecord(rng, g, season);
  if (def && kindOf(def) !== 'damnati') fitTo(g, dojoPower(def) * CONFIG.challenge.memberPowerMul); /* 소속은 간판의 0.8배 — 도장의 격이 한 덩어리로 오르내린다 (2026-10-01: 명부 소속을 나이만큼 자란 몸 그대로 두면 도장 1 소속이 간판보다 셌다) */
  dedupe(g, roster); return g;
}
// 절대 강도에 맞춘다 (간판·두 번째·소속). 맞춘 몸이 상한을 넘지 않게 상한도 올린다
function fitTo(g: Gladiator, power: number): Gladiator { fitPower(g, power); if (g.cap) for (const k of ['hp', 'atk', 'def', 'hand'] as const) g.cap[k] = Math.max(g.cap[k], g.base[k]); return g; }
export const dojoPower = (def: RivalDef) => CONFIG.challenge.basePower * def.challenge.strength; // 그 집 간판의 절대 강도
// 지정 간판·두 번째: 이름·유형·명예가 정해져 있고 전력은 절대 강도(도장 계수 × basePower). 승수는 명예에 맞춘다. 전설이면 이름·성장형·딕타타·사연은 그 인물의 고정값이되 몸은 도장 강도에 맞춘다 (2026-10-01: 시장의 고정 몸은 대개 도장 4 이후의 얼굴에게 너무 약하다 — 얼굴로 설 때는 그 집의 격을 따른다)
function makeNamed(rng: Rng, season: number, spec: NamedSpec, honor: number, power: number, talent: 2 | 3): Gladiator {
  const C = CONFIG.challenge;
  const g = spec.legend ? makeGladiator(rng, 'veteranus', { season, legend: spec.legend }) : makeGladiator(rng, 'veteranus', { season, type: spec.type, lineage: spec.lineage, name: spec.name, talent, age: rng.int(C.starAge[0], C.starAge[1]) });
  g.honor = honor; g.wins = Math.max(g.wins, Math.round(honor / C.starWinsPerHonor)); g.fights = Math.max(g.fights, g.wins + rng.int(0, 3)); if (spec.scaeva) g.scaeva = true; g.boughtSeason = season;
  return fitTo(g, power);
}
export const makeStar = (rng: Rng, season: number, def: RivalDef) => makeNamed(rng, season, def.star, def.star.honor, CONFIG.challenge.basePower * def.challenge.strength, 3);
export const makeSecond = (rng: Rng, season: number, def: RivalDef) => def.second ? makeNamed(rng, season, def.second, Math.round(def.star.honor * CONFIG.challenge.secondHonorMul), CONFIG.challenge.basePower * def.challenge.strength * CONFIG.challenge.secondPowerMul, 2) : undefined;
// 죄수: 이름 없이 '죄수'로만. 티로에 죄수 보정. 담나티 아드 루둠은 훈련이 짧은 값싼 싸움꾼이었다
function makeDamnatus(rng: Rng, season: number, roster: Gladiator[], def: RivalDef): Gladiator { const g = makeGladiator(rng, 'tiro', { season, type: weightedType(rng, def.typeWeights), name: '죄수' }); const O = CONFIG.origins.damnatus; g.origin = 'damnatus'; g.base.atk = Math.max(1, g.base.atk + O.stat); g.base.def = Math.max(0, g.base.def + O.stat); if (g.cap) { g.cap.atk = Math.max(g.base.atk, g.cap.atk + O.stat); g.cap.def = Math.max(g.base.def, g.cap.def + O.stat); } g.boughtSeason = season; dedupe(g, roster); return g; }
function makeRival(rng: Rng, season: number, def: RivalDef, used: (string | undefined)[] = [], book?: CastBook): Rival {
  const base = { id: def.id, name: def.name, vsMe: { wins: 0, losses: 0, draws: 0 }, profile: def.profile, since: season, mood: 0, purse: RV().purseStart[def.profile], focus: def.focus, color: pickColor(rng, used) };
  if (kindOf(def) === 'damnati') { const r: Gladiator[] = []; while (r.length < sizeOf(def)) r.push(makeDamnatus(rng, season, r, def)); return { ...base, roster: r }; } // 죄수단: 간판 없음
  const star = makeStar(rng, season, def), second = makeSecond(rng, season, def);
  const r: Gladiator[] = second ? [star, second] : [star];
  if (book) for (const e of CAST.filter(e => e.role === 'member' && e.familia === def.id)) { if (castState(book, e.id).taken) continue; castState(book, e.id).taken = true; const g = makeFromCast(e, season, { member: true }); if (g.rank === 'veteranus') vetRecord(rng, g, season); fitTo(g, dojoPower(def) * CONFIG.challenge.memberPowerMul); dedupe(g, r); r.push(g); } // 소속은 명부에서 — 몸은 도장 강도에 맞춘다
  while (r.length < sizeOf(def)) r.push(makeMember(rng, season, r, rng.chance(RV().fillVetP) ? 'veteranus' : 'tiro', def));
  return { ...base, roster: r, starId: star.id, secondId: second?.id };
}
// 간판이 빠지면 두 번째가, 둘 다 없으면 소속 중 명예 최고가 잇는다. 파밀리아는 무너지지 않는다 (해체·자동 졸업으로 두면 간판을 죽이는 게 지름길이 된다)
export function promoteStar(r: Rival) {
  const d = rivalDef(r); if (d && kindOf(d) === 'damnati') return;
  const alive = (id?: number) => id != null && r.roster.some(g => g.id === id && g.alive);
  const best = (skip: (number | undefined)[]) => [...r.roster].filter(g => g.alive && !skip.includes(g.id)).sort((a, b) => ((b.honor ?? 0) - (a.honor ?? 0)) || (b.wins - a.wins))[0];
  if (!alive(r.starId)) { r.starId = alive(r.secondId) ? r.secondId : best([])?.id; if (r.starId === r.secondId) r.secondId = undefined; }
  if (!alive(r.secondId)) r.secondId = d?.second ? best([r.starId])?.id : undefined; // 두 번째 자리는 정의에 있는 집만 채운다
}
export const isNamed = (r: Rival, g: Gladiator) => g.id === r.starId || g.id === r.secondId;
// 새 게임: 앞 집이 없는 파밀리아만 (스카이바·암플리아투스 + 서브 둘)
export function makeRivals(rng: Rng, season = 1, myColor?: string, book?: CastBook): Rival[] { const out: Rival[] = []; for (const d of RIVAL_DEFS) if (d.after == null) out.push(makeRival(rng, season, d, [myColor, ...out.map(r => r.color)], book)); return out; }
// 시즌 끝: 앞 집을 졸업했으면 다음 집이 이 지방에 나타난다 (도장 사슬). 돌아온 목록 = 이번에 나타난 파밀리아
export function arriveRivals(rng: Rng, rivals: Rival[], season: number, myColor?: string, book?: CastBook): Rival[] {
  const out: Rival[] = [];
  for (const d of RIVAL_DEFS) { if (rivals.some(r => r.id === d.id)) continue; const prev = d.after == null ? undefined : rivals.find(r => r.id === d.after); if (d.after == null || prev?.graduated) { const r = makeRival(rng, season, d, [myColor, ...rivals.map(x => x.color)], book); rivals.push(r); out.push(r); } }
  return out;
}
export const bumpMood = (r: Rival, d: number) => { const k = rivalTraits(r).includes('brawler') ? 2 : 1; r.mood = Math.max(RV().moodMin, Math.min(RV().moodMax, (r.mood ?? 0) + d * k)); }; /* 호전적: 기세가 두 배로 오르내린다 */
// 시즌마다 살림: 부상 회복, 나이, 보이지 않는 다른 경기(금고 ±, 드물게 사망), 금고로 훈련·보충. 돌아온 목록 = 포룸에 실을 소식. 간판·두 번째는 살림 밖 (절대 강도 — 회차 안 성장 없음, docs/11 5-1)
export function replenishRivals(rng: Rng, rivals: Rival[], season: number, book?: CastBook): string[] {
  const news: string[] = []; const C = RV();
  for (const r of rivals) {
    const def = rivalDef(r); const damnati = !!def && kindOf(def) === 'damnati';
    for (const g of r.roster) { if (g.injured > 0) g.injured--; if ((season - 1) % 4 === 0) g.age = (g.age ?? 22) + 1; }
    promoteStar(r);
    // 보이지 않는 다른 경기: 우리가 없어도 세상이 돈다 (이름 있는 사람은 안 죽는다 — 얼굴은 우리 앞에서만 진다)
    if (rng.chance(C.otherGames.winP)) { r.purse += C.purseWin; } else { r.purse += C.purseLose; if (rng.chance(C.otherGames.deathP / C.otherGames.winP)) { const alive = r.roster.filter(g => g.alive && !isNamed(r, g)); if (alive.length > 2) { const dead = rng.pick(alive); r.roster = r.roster.filter(g => g !== dead); bumpMood(r, -1); news.push(`${r.name}의 ${dead.name}이(가) 다른 경기에서 쓰러졌다`); } } }
    const tr = rivalTraits(r); const trains = tr.includes('weak') ? 0 : C.trainPerSeason + (tr.includes('trainer') ? 1 : 0); /* 특징: 훈련 부실 0 · 훈련소 +1 */
    if (tr.includes('trader') && r.purse >= C.buyTiro) { const pool = r.roster.filter(g => g.alive && !isNamed(r, g) && !g.castId).sort((a, b) => powerOf(a) - powerOf(b)); const out = pool[0]; if (out) { r.roster = r.roster.filter(g => g !== out); r.purse += Math.round(valueOf(out) / 2); news.push(`${r.name}이(가) ${out.name}을(를) 팔았다`); } } /* 상인: 가장 약한 하나를 팔아 자리를 비운다 (명부의 고정 소속은 안 판다) */
    for (let k = 0; k < trains && r.purse >= C.trainCost; k++) { const pool = r.roster.filter(g => g.alive && g.injured === 0 && !isNamed(r, g)); if (!pool.length) break; const g = rng.pick(pool); growAll(g, k => k === 'hp' ? C.trainHp : C.trainGain, true); /* 파밀리아는 독토르가 늘 있는 집 — 같은 성장 모델, 상한까지 */ r.purse -= C.trainCost; }
    // 보충: 소속 자리만 (간판·두 번째 자리는 승격으로만). 시장에서 안 팔려 떠난 사람(gone)은 순회단(13)이 있으면 순회단으로, 없으면 아무 집에나 — "안 사면 적이 된다". 죄수단은 죄수로
    const cap = def ? sizeOf(def) : 6; const tourOpen = rivals.some(x => x.id === 13);
    while (r.roster.length < cap) {
      if (damnati) { r.roster.push(makeDamnatus(rng, season, r.roster, def!)); continue; }
      const gone = book && (r.id === 13 || !tourOpen) ? CAST.filter(e => e.role === 'market' && castState(book, e.id).gone && !castState(book, e.id).taken) : [];
      if (gone.length) { const e = rng.pick(gone); castState(book!, e.id).taken = true; const g = makeFromCast(e, season); g.origin = 'slave'; g.boughtSeason = season; if (def) fitTo(g, dojoPower(def) * CONFIG.challenge.memberPowerMul); dedupe(g, r.roster); r.roster.push(g); news.push(`${r.name}이(가) 시장에서 팔리지 않은 ${g.name}을(를) 데려갔다`); continue; }
      const vet = (r.mood ?? 0) > 0 && r.purse >= C.buyVet; const cost = vet ? C.buyVet : C.buyTiro; if (r.purse < cost) break; r.purse -= cost; r.roster.push(makeMember(rng, season, r.roster, vet ? 'veteranus' : 'tiro', def)); }
  }
  return news;
}
// 일반 계약·도전장에 나올 수 있는 사람: 살아 있고 안 다쳤고 간판이 아니다 (간판은 간판 내기에서만 만난다)
export const rivalPool = (r: Rival) => r.roster.filter(g => g.alive && g.injured === 0 && g.id !== r.starId);
// 출전 가능한 검투사에서 size 명을 고른다 (부족하면 null)
export function pickEnemies(rng: Rng, rival: Rival, size: number): Gladiator[] | null {
  const pool = rivalPool(rival);
  if (pool.length < size) return null;
  const out: Gladiator[] = []; const rest = [...pool];
  for (let i = 0; i < size; i++) { const k = rng.int(0, rest.length - 1); out.push(rest[k]); rest.splice(k, 1); }
  return out;
}
// 도전 계약의 상대: 두 번째 + 명예 순 정예 (간판·부상 제외)
export function pickElite(rival: Rival, size: number): Gladiator[] | null {
  const pool = rivalPool(rival).sort((a, b) => ((b.honor ?? 0) - (a.honor ?? 0)) || (b.wins - a.wins) || (powerOf(b) - powerOf(a)));
  return pool.length >= size ? pool.slice(0, size) : null;
}
// 간판 내기의 상대: 간판 + 소속 중 센 순 (두 번째는 안 나온다 — 이름 있는 사람은 간판 하나). 모자라면 null
export function pickStarBet(rival: Rival, size: number): Gladiator[] | null {
  const star = rivalStar(rival); if (!star || star.injured > 0) return null;
  const escorts = rivalPool(rival).filter(g => g.id !== rival.secondId).sort((a, b) => powerOf(b) - powerOf(a)).slice(0, size - 1);
  return escorts.length >= size - 1 ? [star, ...escorts] : null;
}
export function rivalOf(rivals: Rival[], id?: number): Rival | undefined { return rivals.find(r => r.id === id); }
export function memberById(rivals: Rival[], id: number): { rival: Rival; g: Gladiator } | undefined { for (const r of rivals) { const g = r.roster.find(x => x.id === id); if (g) return { rival: r, g }; } return undefined; }
// 간판 검투사: 지정값(starId). 없으면 명예가 가장 높은(같으면 승수) 검투사. 죄수단은 없다
export function rivalStar(r: Rival): Gladiator | undefined { const d = rivalDef(r); if (d && kindOf(d) === 'damnati') return undefined; return r.roster.find(g => g.id === r.starId && g.alive) ?? [...r.roster].filter(g => g.alive).sort((a, b) => ((b.honor ?? 0) - (a.honor ?? 0)) || (b.wins - a.wins))[0]; }
// 졸업 조건 진행 (docs/11 5-2): 그 집 사람을 정원(간판 제외)만큼 서로 다르게 꺾어 봤는가. 현재 명단이 아니라 누적 — 소속이 죽거나 팔려 나가고 새 얼굴이 와도 진도가 뒤로 가지 않는다 (2026-10-01: 현재 명단 기준으로 두면 살림의 교체 때문에 48시즌에도 5/5 가 안 찼다)
export function challengeProgress(r: Rival): { beaten: number; total: number } {
  const d = rivalDef(r); const total = d ? sizeOf(d) - 1 : 5; const beaten = Math.min(total, (r.beatenIds ?? []).filter(id => id !== r.starId).length);
  return { beaten, total };
}
export function noteBeaten(r: Rival, g: Gladiator) { (r.beatenIds ??= []); if (!r.beatenIds.includes(g.id)) r.beatenIds.push(g.id); }
export function recordVsMe(r: Rival): string { const v = r.vsMe ?? { wins: 0, losses: 0, draws: 0 }; const total = v.wins + v.losses + v.draws; return total ? `${total}전 ${v.losses}승 ${v.wins}패${v.draws ? ` ${v.draws}무` : ''}` : '첫 대결'; } // 내 기준 (내 승/패)
// 우리와 견주기: 양쪽 상위 셋 평균 전력. 'strong' = 그쪽이 세다
export function compareRival(r: Rival, mine: Gladiator[]): 'strong' | 'even' | 'weak' {
  const n = Math.max(1, Math.min(3, mine.filter(g => g.alive).length)); /* 우리 인원만큼만 견준다 — 둘뿐인 첫 시즌에 여섯 명 파밀리아가 다 '세다'로 나오지 않게 (2026-09-21) */
  const top = (gs: Gladiator[]) => { const p = gs.filter(g => g.alive).map(powerOf).sort((a, b) => b - a).slice(0, n); return p.length ? p.reduce((a, b) => a + b, 0) / p.length : 0; };
  const a = top(r.roster), b = top(mine); if (!b) return 'strong'; const k = a / b; return k >= 1.08 ? 'strong' : k <= 0.92 ? 'weak' : 'even';
}
export const COMPARE_KO: Record<'strong' | 'even' | 'weak', string> = { strong: '우리보다 세다', even: '우리와 비슷하다', weak: '우리보다 약하다' };
export const legendLore = (g: Gladiator) => g.legend ? LEGEND_BY_ID[g.legend]?.lore : undefined;
