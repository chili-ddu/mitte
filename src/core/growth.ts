// 성장 모델 (2026-09-21, docs/09 §7): 초기 굴림 대신 **잠재치(상한)·나이·성장형**이 개체 차이를 만든다.
// 현재치는 유형 기본치 × 서열(티로 0.85 · 베테라누스 1.0)로 같고, 어디까지·얼마나 빨리 자라느냐가 다르다. 상한은 감춰져 있다가 닿으면 카드에 굵게 뜬다.
import type { Gladiator, Stats } from './types.js';
import type { Rng } from './rng.js';
import { CONFIG } from './config.js';
import { classKey } from './classes.js';
import { talentOf } from './talent.js';

export type GrowthCurve = 'normal' | 'early' | 'late' | 'second'; // 평범 · 유망주 · 대기만성 · 늦바람 (언제 크나)
export type GrowthTrait = 'one' | 'field' | 'pupil' | 'even';    // 한 우물 · 실전형 · 제자형 · 고른 몸 (어떻게 크나)
export type GrowStat = 'hp' | 'atk' | 'def' | 'hand';
export const GROW_STATS: GrowStat[] = ['hp', 'atk', 'def', 'hand'];
export interface Growth { curve: GrowthCurve; trait?: GrowthTrait; one?: GrowStat; curveKnown?: boolean; traitKnown?: boolean; trainings?: number; secondDone?: boolean }
export const CURVE_KO: Record<GrowthCurve, string> = { normal: '평범', early: '유망주', late: '대기만성', second: '늦바람' };
export const TRAIT_KO: Record<GrowthTrait, string> = { one: '한 우물', field: '실전형', pupil: '제자형', even: '고른 몸' };
export const CURVE_DESC: Record<GrowthCurve, string> = { normal: '나이대로 자란다', early: '젊어서 빨리 크고 일찍 멈춘다', late: '늦게 피어 오래 자란다', second: '서른에 한 번 더 자란다' };
export const TRAIT_DESC: Record<GrowthTrait, string> = { one: '한 능력치만 크게 자라고 나머지는 더디다', field: '팔루스보다 모래에서 자란다 — 출전마다 하나씩', pupil: '독토르 밑에서는 빨리, 없으면 더디게', even: '유형의 틀을 벗어나 넷이 고르게 자란다' };
const G = () => CONFIG.growthModel;

export type AgeBand = 'young' | 'prime' | 'old';
export const ageBand = (age: number): AgeBand => age <= G().age.youngTo ? 'young' : age <= G().age.primeTo ? 'prime' : 'old';
export const AGE_BAND_KO: Record<AgeBand, string> = { young: '청년', prime: '장년', old: '노년' };

export function rollGrowth(rng: Rng): Growth {
  const r = rng.next(); const C = G().curveRate; const curve: GrowthCurve = r < C.early ? 'early' : r < C.early + C.late ? 'late' : r < C.early + C.late + C.second ? 'second' : 'normal';
  const g: Growth = { curve, curveKnown: G().revealCurveAfter === 0, traitKnown: G().revealCurveAfter === 0 }; // 공개 설정이면 태어날 때부터 안다
  if (rng.chance(G().traitP)) { g.trait = rng.pick(['one', 'field', 'pupil', 'even'] as GrowthTrait[]); if (g.trait === 'one') g.one = rng.pick(GROW_STATS); }
  return g;
}
// 상한: 유형 기본치 × 잠재 굴림 × 나이 계수 × 곡선 상한 × 결(한 우물) × 클래스 풀 기울기. 현재치보다 낮으면 현재치(더 안 자란다)
export function rollCaps(rng: Rng, type: Gladiator['type'], base: Stats, age: number, growth: Growth, typeBase: Stats): Record<GrowStat, number> {
  const P = G(); const pot = rng.range(P.potential[0], P.potential[1]); const A = P.age; const ageK = A.capAtOld + (1 - A.capAtOld) * Math.max(0, Math.min(1, (A.capFullTo - age) / (A.capFullTo - A.youngFrom))) ; // 어릴수록 위가 넓다
  const pool = CONFIG.growth[classKey(type)] ?? { atk: 25, def: 25, hp: 25, hand: 25 };
  const out = {} as Record<GrowStat, number>;
  for (const k of GROW_STATS) { const tilt = growth.trait === 'even' ? 1 : 0.85 + (pool[k] / 100) * 0.6; const one = growth.trait === 'one' ? (growth.one === k ? P.oneCap : P.oneOtherCap) : 1; const even = growth.trait === 'even' ? P.evenCap : 1;
    const floor = Math.round(base[k] * P.minRoom[ageBand(age)]); out[k] = Math.max(base[k], floor, Math.round(typeBase[k] * pot * ageK * P.curveCap[growth.curve] * tilt * one * even)); } // 최소 여유: 나이대별로 현재치 위를 남긴다
  return out;
}
// 훈련 한 번의 상승 배율 (기본치 × 이것). 나이대·곡선·결·자질
export function growthSpeed(g: Gladiator, stat: GrowStat, hasDoctor: boolean): number {
  const P = G(); const gr = g.growth; if (!gr) return 1;
  const band = ageBand(g.age ?? 24); let k = P.curveSpeed[gr.curve][band];
  if (gr.trait === 'one') k *= gr.one === stat ? P.oneSpeed : P.oneOtherSpeed;
  if (gr.trait === 'field') k *= P.fieldTrainMul;
  if (gr.trait === 'pupil') k *= hasDoctor ? P.pupilWith : P.pupilWithout;
  return k * P.talentMul[talentOf(g)];
}
export const capOf = (g: Gladiator, k: GrowStat): number => g.cap?.[k] ?? Infinity;
export const atCap = (g: Gladiator, k: GrowStat): boolean => g.base[k] >= capOf(g, k);
export const fullyGrown = (g: Gladiator): boolean => !!g.cap && GROW_STATS.every(k => atCap(g, k));
// 늦바람: 서른이 되면 한 번 상한을 올린다
export function secondWind(g: Gladiator): boolean { const gr = g.growth; if (!gr || gr.curve !== 'second' || gr.secondDone || (g.age ?? 0) < G().secondAt || !g.cap) return false; for (const k of GROW_STATS) g.cap[k] = Math.round(g.cap[k] * G().secondBoost); gr.secondDone = true; return true; }
// 상인의 한 줄: 남은 폭으로 짐작 (상한은 감춘다)
export function merchantLine(g: Gladiator): string {
  if (!g.cap) return ''; const room = GROW_STATS.reduce((a, k) => a + (g.cap![k] - g.base[k]) / Math.max(1, g.base[k]), 0) / 4;
  return room >= 0.25 ? '아직 한참 자랄 몸이오' : room >= 0.1 ? '조금은 더 클 몸이오' : '다 큰 몸이오';
}
// 독토르의 판단: 밝혀진 곡선·결
export function growthKo(g: Gladiator): string[] { const gr = g.growth; if (!gr) return []; const out: string[] = []; if (gr.curveKnown) out.push(CURVE_KO[gr.curve]); if (gr.trait && gr.traitKnown) out.push(gr.trait === 'one' && gr.one ? `한 우물(${({ hp: '체력', atk: '공격', def: '방어', hand: '손놀림' } as Record<GrowStat, string>)[gr.one]})` : TRAIT_KO[gr.trait]); return out; }

// 훈련·출전 성장의 단위: 소수점을 prog 에 쌓고 1이 차면 base 가 오른다. 상한에 닿으면 더 안 쌓인다. 돌아온 것 = 실제로 오른 정수
export function addProgress(g: Gladiator, k: GrowStat, amount: number): number {
  if (amount <= 0) return 0; const cap = capOf(g, k); if (g.base[k] >= cap) { return 0; }
  const p = (g.prog ??= { hp: 0, atk: 0, def: 0, hand: 0 }); p[k] += amount; let up = Math.floor(p[k]); p[k] -= up;
  if (g.base[k] + up > cap) { up = cap - g.base[k]; p[k] = 0; } g.base[k] += up; if (g.base[k] >= cap) p[k] = 0; return up;
}
export const progOf = (g: Gladiator, k: GrowStat): number => g.prog?.[k] ?? 0;
