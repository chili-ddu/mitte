// 클래스 = 주장비 특성 + 보조장비 특성 (2026-09-18, docs/09). 규칙의 단위는 유형이 아니라 이 짝이다.
// 장비 수치(사거리·막기)는 여기서 특성 값으로 정하고, 유형은 외형·능력치 성향·유형 딕타타만 더한다.
import type { GType } from './types.js';
import { CONFIG } from './config.js';
import { TYPE_TRAITS, TRAIT_KO, type Trait } from './traits.js';

export type MainTrait = 'gladius' | 'sica' | 'spear';
export type OffTrait = 'bigShield' | 'smallShield' | 'bare';
export interface ClassDef { main: MainTrait; off: OffTrait }
const isMain = (t: Trait): t is MainTrait => t === 'gladius' || t === 'sica' || t === 'spear';
export function classOf(type: GType): ClassDef { const [a, b] = TYPE_TRAITS[type]; return isMain(a) ? { main: a, off: b as OffTrait } : { main: b as MainTrait, off: a as OffTrait }; }
export const classKey = (type: GType) => { const c = classOf(type); return `${c.off}+${c.main}`; };
export const classKo = (type: GType) => { const c = classOf(type); return `${TRAIT_KO[c.off]}·${TRAIT_KO[c.main]}`; };
export const sameClass = (a: GType, b: GType) => classKey(a) === classKey(b);
// 장비 수치 — 특성 값 (2026-09-18 사용자: 사거리·막기만 되살린다, 투구·받아넘기기·닳음은 없다)
export const rangeOf = (type: GType): 1 | 2 => CONFIG.gear.range[classOf(type).main];
export const blockOf = (type: GType): number => CONFIG.gear.block[classOf(type).off];
export const reachOf = (type: GType): number => CONFIG.gear.reach[rangeOf(type)];
