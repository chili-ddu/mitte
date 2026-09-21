// 장비 = 룰. 오른손(주무기)은 공격, 왼손(보조)은 방어 또는 특수기.
import type { GType } from './types.js';

export type MainHand = 'gladius' | 'sica' | 'trident' | 'spear';
export type OffHand = 'scutum' | 'parmula' | 'parma' | 'medium' | 'net' | 'blade' | 'armblade' | 'lasso' | 'none'; // armblade: 스키소르의 왼팔 관 반달 날 · lasso: 라쿠에아리우스의 올가미 // parma: 둥근 청동 방패(호플로마쿠스·에퀘스), medium: 중형 직사각 방패(프로보카토르), blade: 왼손 시카(디마카에루스)

export interface MainHandSpec {
  range: number;         // 사거리 (1 근접, 2 후열에서 공격)
  defIgnore: number;     // 상대 방어 무시 비율
  shieldPierce?: number; // 상대 방패 막기 확률에 곱한다 (1 = 그대로, 낮을수록 방패를 넘긴다)
  parry?: number;        // 이 무기로 상대 공격을 받아넘길 확률 (방패로 막지 못했을 때). 긴 자루가 잘 받아낸다
  label: string;
}
export interface OffHandSpec {
  role: 'guard' | 'skill' | 'none';
  block?: number;          // guard: 매 타 막을 확률 (방패 테두리로 쳐내기도 한다 — parry 참고) (막을 때마다 CONFIG.shield.wear 만큼 닳는다)
  firstHitReduce?: number; // (구) 첫 피격 감소 비율 — 2026-09-17 매 타 확률 막기로 바뀌며 미사용
  parry?: number;          // 보조 손으로 받아넘길 확률 (짧은 시카·그물 자루). 방패는 막기(block)로 대신한다
  evade?: number;          // 회피 (예약). 2026-09-17 시험: 가벼운 무장에 회피를 주니 느린 무르밀로만 이중으로 손해를 봐 승률 폭이 12→18%p 로 벌어졌다 — 채택하지 않음
  skill?: 'bind' | 'twin'; // skill: 특수기 종류 (bind 그물 속박, twin 쌍검 연속 공격)
  comboBonus?: number;     // twin: 연속 공격 확률 가산
  label: string;
}

export const MAIN_HAND: Record<MainHand, MainHandSpec> = {
  gladius: { range: 1, defIgnore: 0,   parry: 0.04, label: '글라디우스' },
  sica:    { range: 1, defIgnore: 0,   shieldPierce: 0.5, parry: 0.06, label: '시카' }, // 곡도: 갑옷을 뚫는 무기가 아니라 방패 너머로 넘겨 찍는 무기다 (2026-09-17: 방어 30% 무시 → 방패 막기 무력화)
  trident: { range: 2, defIgnore: 0,   shieldPierce: 0.85, parry: 0.10, label: '삼지창' }, // 세 갈래라 방패 위로 걸리기도 한다
  spear:   { range: 2, defIgnore: 0,   shieldPierce: 0.9,  parry: 0.05, label: '창' },
};
export const OFF_HAND: Record<OffHand, OffHandSpec> = {
  scutum:  { role: 'guard', block: 0.54, parry: 0.06, firstHitReduce: 0.5, label: '스쿠툼' },   // 큰 직사각 방패: 가장 잘 막지만 무거워 숨이 빨리 찬다
  parmula: { role: 'guard', block: 0.27, parry: 0.03, firstHitReduce: 0.2, label: '파르물라' }, // 작은 방패
  parma:   { role: 'guard', block: 0.32, parry: 0.04, firstHitReduce: 0.25, label: '파르마' },  // 둥근 청동 방패
  medium:  { role: 'guard', block: 0.43, parry: 0.05, firstHitReduce: 0.4, label: '중형 방패' }, // 프로보카토르의 중형 직사각 방패
  blade:   { role: 'skill', skill: 'twin', parry: 0.12, comboBonus: 0.15, label: '짧은 시카' }, // 쌍검: 연속 공격 +15%
  net:     { role: 'skill', skill: 'bind', parry: 0.04, label: '그물' },          // 특수기: 첫 공격 시 1턴 속박
  armblade: { role: 'skill', skill: 'twin', parry: 0.12, label: '팔 칼날' },     // 스키소르: 왼팔 관 끝의 반달 날
  lasso:   { role: 'skill', skill: 'bind', parry: 0.04, label: '올가미' },        // 라쿠에아리우스
  none:    { role: 'none', parry: 0.06, label: '없음' },
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
  scissor:     { main: 'gladius', off: 'armblade' }, // 글라디우스 + 팔 칼날
  laquearius:  { main: 'spear',   off: 'lasso' },   // 창 + 올가미
};
// 장비로 설명되지 않는 유형 성향
// 접근 방식: aggressive 직진 돌진 / cautious 방패 세우고 천천히 옆걸음 / feint 지그재그 페인트 / ranged 거리 유지
export type ApproachStyle = 'aggressive' | 'cautious' | 'feint' | 'ranged';
// critTaken: 치명타를 맞을 확률 보정 (투구 없음 1.6, 매끈한 투구 0.7)
// greaves: 정강이받이(오크레아) 수 — 2 양 다리 · 1 한쪽 · 0 없음. 다리 노리기 확률을 줄인다 (레티아리우스는 투구도 방패도 정강이받이도 없다)
export const TYPE_TRAIT: Record<GType, { pursuer?: boolean; style: ApproachStyle; critTaken: number; greaves: 0 | 1 | 2 }> = {
  murmillo: { style: 'cautious', critTaken: 1.0, greaves: 1 }, secutor: { pursuer: true, style: 'aggressive', critTaken: 0.7, greaves: 1 }, thraex: { style: 'feint', critTaken: 1.0, greaves: 2 }, retiarius: { style: 'ranged', critTaken: 1.6, greaves: 0 },
  hoplomachus: { style: 'cautious', critTaken: 1.0, greaves: 2 }, provocator: { style: 'cautious', critTaken: 0.8 /* 가슴판 */, greaves: 1 }, eques: { pursuer: true, style: 'aggressive', critTaken: 1.1, greaves: 1 }, dimachaerus: { style: 'feint', critTaken: 1.3 /* 방패 없음 */, greaves: 1 },
  scissor: { pursuer: true, style: 'aggressive', critTaken: 0.7, greaves: 1 }, laquearius: { style: 'ranged', critTaken: 1.6, greaves: 0 }, // (critTaken·greaves 는 2026-09-18 부터 전투가 읽지 않는다 — 그림용)
};
export function equipOf(type: GType): Equipment { return TYPE_EQUIP[type]; }
// 손으로 읽어 주는 장비 이름. 규칙은 주무기·보조로 정의돼 있지만, 사람에게는 어느 손에 무엇이 들렸는지가 더 분명하다. 왼손잡이(스카이바)는 좌우가 바뀐다 — 그래서 상대가 방패로 막기 어렵다
export function equipHands(type: GType, scaeva?: boolean): { right: string; left: string } {
  const e = TYPE_EQUIP[type], main = MAIN_HAND[e.main].label, off = OFF_HAND[e.off].label;
  return scaeva ? { right: off, left: main } : { right: main, left: off };
}
export const equipHandsKo = (type: GType, scaeva?: boolean) => { const h = equipHands(type, scaeva); return `오른손 ${h.right} · 왼손 ${h.left}`; };
