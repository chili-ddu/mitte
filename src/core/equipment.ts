// 장비 = 룰. 오른손(주무기)은 공격, 왼손(보조)은 방어 또는 특수기.
import type { GType } from './types.js';

export type MainHand = 'gladius' | 'sica' | 'trident' | 'spear';
export type OffHand = 'scutum' | 'parmula' | 'parma' | 'medium' | 'net' | 'blade' | 'none'; // parma: 둥근 청동 방패(호플로마쿠스·에퀘스), medium: 중형 직사각 방패(프로보카토르), blade: 왼손 시카(디마카에루스)

export interface MainHandSpec {
  range: number;         // 사거리 (1 근접, 2 후열에서 공격)
  defIgnore: number;     // 상대 방어 무시 비율
  label: string;
}
export interface OffHandSpec {
  role: 'guard' | 'skill' | 'none';
  firstHitReduce?: number; // guard: 첫 피격 감소 비율
  evade?: number;          // guard: 회피 보정 (미사용, 예약)
  skill?: 'bind' | 'twin'; // skill: 특수기 종류 (bind 그물 속박, twin 쌍검 연속 공격)
  comboBonus?: number;     // twin: 연속 공격 확률 가산
  label: string;
}

export const MAIN_HAND: Record<MainHand, MainHandSpec> = {
  gladius: { range: 1, defIgnore: 0,   label: '글라디우스' },
  sica:    { range: 1, defIgnore: 0.3, label: '시카' },        // 곡도: 방패 너머로 찍는다
  trident: { range: 2, defIgnore: 0,   label: '삼지창' },
  spear:   { range: 2, defIgnore: 0,   label: '창' },
};
export const OFF_HAND: Record<OffHand, OffHandSpec> = {
  scutum:  { role: 'guard', firstHitReduce: 0.5, label: '스쿠툼' },   // 큰 방패: 첫 타격 반감 + 막기 동작
  parmula: { role: 'guard', firstHitReduce: 0.2, label: '파르물라' }, // 작은 방패: 약한 감소
  parma:   { role: 'guard', firstHitReduce: 0.25, label: '파르마' },  // 둥근 청동 방패
  medium:  { role: 'guard', firstHitReduce: 0.4, label: '중형 방패' }, // 프로보카토르의 중형 직사각 방패
  blade:   { role: 'skill', skill: 'twin', comboBonus: 0.15, label: '왼손 시카' }, // 쌍검: 연속 공격 +15%
  net:     { role: 'skill', skill: 'bind', label: '그물' },          // 특수기: 첫 공격 시 1턴 속박
  none:    { role: 'none', label: '없음' },
};

export interface Equipment { main: MainHand; off: OffHand; }

// 유형 = 장비 세트 (+ 성향)
export const TYPE_EQUIP: Record<GType, Equipment> = {
  murmillo:  { main: 'gladius', off: 'scutum' },
  secutor:   { main: 'gladius', off: 'scutum' },
  thraex:    { main: 'sica',    off: 'parmula' },
  retiarius: { main: 'trident', off: 'net' },
  hoplomachus: { main: 'spear',   off: 'parma' },   // 창 + 둥근 방패 (+단검)
  provocator:  { main: 'gladius', off: 'medium' },  // 글라디우스 + 중형 방패 + 가슴판
  eques:       { main: 'spear',   off: 'parma' },   // 창 + 둥근 방패, 튜닉. 말은 생략 — 빠른 돌진으로 표현
  dimachaerus: { main: 'sica',    off: 'blade' },   // 시카 두 자루
};
// 장비로 설명되지 않는 유형 성향
// 접근 방식: aggressive 직진 돌진 / cautious 방패 세우고 천천히 옆걸음 / feint 지그재그 페인트 / ranged 거리 유지
export type ApproachStyle = 'aggressive' | 'cautious' | 'feint' | 'ranged';
// critTaken: 치명타를 맞을 확률 보정 (투구 없음 1.6, 매끈한 투구 0.7)
export const TYPE_TRAIT: Record<GType, { pursuer?: boolean; style: ApproachStyle; critTaken: number }> = {
  murmillo: { style: 'cautious', critTaken: 1.0 }, secutor: { pursuer: true, style: 'aggressive', critTaken: 0.7 }, thraex: { style: 'feint', critTaken: 1.0 }, retiarius: { style: 'ranged', critTaken: 1.6 },
  hoplomachus: { style: 'cautious', critTaken: 1.0 }, provocator: { style: 'cautious', critTaken: 0.8 /* 가슴판 */ }, eques: { pursuer: true, style: 'aggressive', critTaken: 1.1 }, dimachaerus: { style: 'feint', critTaken: 1.3 /* 방패 없음 */ },
};
export function equipOf(type: GType): Equipment { return TYPE_EQUIP[type]; }
