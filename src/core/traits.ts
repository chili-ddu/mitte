// 특성(트레이트): 시너지 12종을 대체한다 (2026-09-18, docs/08 4-3·13·14·16·17).
// 유형은 외형이고 규칙의 단위는 특성 짝(클래스)이다. 특성은 **편성(같이 나가는 팀)** 에서 세어 1·2·3명 문턱으로 1~3단계가 켜지고,
// 효과는 그 특성을 가진 검투사에게 전투 보정으로만 걸린다 — 능력치·값·전력엔 안 실린다. 상대도 자기 팀으로 똑같이 센다. (09-18 사용자: 켈라 머릿수가 아니라 편성 조합 — 켈라는 조합을 고를 폭)
import type { Gladiator, GType, Lineage } from './types.js';
import { CONFIG } from './config.js';

export type Trait = 'bigShield' | 'smallShield' | 'bare' | 'gladius' | 'sica' | 'spear';
export const TRAITS: Trait[] = ['bigShield', 'smallShield', 'bare', 'gladius', 'sica', 'spear'];
export const LINEAGES: Lineage[] = ['nature', 'victory', 'myth', 'nickname', 'place'];
export const TRAIT_KO: Record<Trait, string> = { bigShield: '큰방패', smallShield: '작은방패', bare: '맨몸', gladius: '글라디우스', sica: '곡도', spear: '창' };
// 툴팁용 고증 한 줄. 큰방패·작은방패는 로마의 관중 파벌 이름(스쿠타리이·파르물라리이)이고, 맨몸은 만든 이름이다
export const TRAIT_NOTE: Record<Trait, string> = {
  bigShield: '스쿠타리이 — 스쿠툼(큰 방패)을 든 자들. 프로보카토르의 중형 방패도 여기로 센다',
  smallShield: '파르물라리이 — 파르마·파르물라(작은 방패)를 든 자들',
  bare: '방패 없이 싸운다 — 레티아리우스·디마카에루스 (만든 이름)',
  gladius: '로마 보병의 표준 검. 에퀘스는 창으로 돌진한 뒤 내려서 검으로 싸웠다',
  sica: '트라키아의 곡도. 방패 너머로 찍는다',
  spear: '창·삼지창 — 사거리로 싸운다',
};
// 클래스표: 유형 → 특성 둘. 장비에서 자동 유도하지 않는다 — 에퀘스(장비는 창인데 글라디우스)·프로보카토르(중형인데 큰방패)처럼 표와 장비가 다른 곳이 있다
export const TYPE_TRAITS: Record<GType, [Trait, Trait]> = {
  murmillo: ['bigShield', 'gladius'], secutor: ['bigShield', 'gladius'], provocator: ['bigShield', 'gladius'],
  thraex: ['smallShield', 'sica'], hoplomachus: ['smallShield', 'spear'], eques: ['smallShield', 'gladius'],
  retiarius: ['bare', 'spear'], dimachaerus: ['bare', 'sica'],
  scissor: ['bare', 'gladius'], laquearius: ['bare', 'spear'], // 2026-09-18 추가
};

export type Level = 0 | 1 | 2 | 3;
export interface TraitLevels { trait: Record<Trait, Level>; lineage: Record<Lineage, Level> }
export interface TraitCounts { trait: Record<Trait, number>; lineage: Record<Lineage, number> }

export const noTraits = (): TraitLevels => ({ trait: { bigShield: 0, smallShield: 0, bare: 0, gladius: 0, sica: 0, spear: 0 }, lineage: { nature: 0, victory: 0, myth: 0, nickname: 0, place: 0 } });
// 몇 명이면 몇 단계인가: steps [1,2,3] → 혼자 1단계, 둘 2단계, 셋 3단계
export function levelOf(n: number): Level { const S = CONFIG.traits.steps; return (n >= S[2] ? 3 : n >= S[1] ? 2 : n >= S[0] ? 1 : 0) as Level; }
// 세는 범위: 살아 있고 독토르가 아닌 사람 (편성 팀은 모두 그렇다 — 로스터 보유량을 볼 때만 의미)
export const countable = (g: Gladiator) => g.alive && g.status !== 'doctor';
export function countTraits(roster: Gladiator[]): TraitCounts {
  const c: TraitCounts = { trait: { bigShield: 0, smallShield: 0, bare: 0, gladius: 0, sica: 0, spear: 0 }, lineage: { nature: 0, victory: 0, myth: 0, nickname: 0, place: 0 } };
  for (const g of roster) { if (!countable(g)) continue; for (const t of TYPE_TRAITS[g.type]) c.trait[t]++; c.lineage[g.lineage]++; }
  return c;
}
export function traitLevelsOf(roster: Gladiator[]): TraitLevels {
  const c = countTraits(roster); const out = noTraits();
  for (const t of TRAITS) out.trait[t] = levelOf(c.trait[t]);
  for (const l of LINEAGES) out.lineage[l] = levelOf(c.lineage[l]);
  return out;
}

// 한 검투사에게 걸리는 전투 보정 — 그가 가진 특성·계보의 단계만 본다. 값은 CONFIG.traits (단계별 배열, 누적값)
export interface TraitMods {
  def: number;                                                 // 큰방패 (자리표시: 장비 규칙이 돌아오면 다시 갈린다)
  spd: number;                                                 // 작은방패
  combo: number; openMul: number; boundMul: number;            // 맨몸
  crit: number;                                                // 글라디우스
  atkMul: number;                                              // 곡도 · 자연
  chargeMul: number;                                           // 창 · 신화
  bindFirst: boolean;                                          // 자연
  lowCut: number; finishMul: number;                           // 승리
  critMultMul: number;                                         // 신화
  stumbleMul: number;                                          // 별명
  staminaMax: number; windedAt: number; regenMul: number;      // 지명
}
export function identityMods(): TraitMods {
  return { def: 0, spd: 0, combo: 0, openMul: 1, boundMul: 1, crit: 0, atkMul: 1, chargeMul: 1, bindFirst: false, lowCut: 0, finishMul: 1, critMultMul: 1, stumbleMul: 1,
    staminaMax: 0, windedAt: CONFIG.stamina.windedAt, regenMul: 1 };
}
export function unitMods(g: Gladiator, L: TraitLevels): TraitMods {
  const m = identityMods(); const T = CONFIG.traits; const at = <X>(arr: readonly X[], lv: Level): X | undefined => lv ? arr[lv - 1] : undefined;
  for (const tr of TYPE_TRAITS[g.type]) { const lv = L.trait[tr]; if (!lv) continue;
    if (tr === 'bigShield') { m.def += at(T.bigShield.def, lv)!; }
    if (tr === 'smallShield') { m.spd += at(T.smallShield.spd, lv)!; }
    if (tr === 'bare') { m.combo += at(T.bare.combo, lv)!; m.openMul *= at(T.bare.open, lv)!; m.boundMul *= at(T.bare.bound, lv)!; }
    if (tr === 'gladius') { m.crit += at(T.gladius.crit, lv)!; }
    if (tr === 'sica') { m.atkMul *= at(T.sica.atk, lv)!; }
    if (tr === 'spear') { m.chargeMul *= at(T.spear.charge, lv)!; } /* 자리표시: 길목 찌르기는 장비 규칙과 함께 뺐다 — 유형 정리 때 다시 */
  }
  { const lv = L.lineage[g.lineage]; if (lv) { const l = g.lineage;
    if (l === 'nature') { m.atkMul *= at(T.nature.atk, lv)!; m.bindFirst = at(T.nature.bindFirst, lv)!; }
    if (l === 'victory') { m.lowCut += at(T.victory.lowCut, lv)!; m.finishMul *= at(T.victory.finish, lv)!; }
    if (l === 'myth') { m.chargeMul *= at(T.myth.charge, lv)!; m.critMultMul *= at(T.myth.critMult, lv)!; }
    if (l === 'nickname') { m.stumbleMul *= at(T.nickname.stumble, lv)!; }
    if (l === 'place') { m.staminaMax += at(T.place.staminaMax, lv)!; m.windedAt = at(T.place.windedAt, lv)!; m.regenMul *= at(T.place.regen, lv)!; } } }
  return m;
}
// 화면용: 켜진 특성 이름 목록 (단계 포함)
export function describeTraits(L: TraitLevels): string[] {
  const out: string[] = [];
  for (const t of TRAITS) if (L.trait[t]) out.push(`${TRAIT_KO[t]} ${L.trait[t]}`);
  return out;
}
