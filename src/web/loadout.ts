// 그림용 장비. 오른손(main)·왼손(off)은 core/equipment.ts 의 룰 장비와 같은 이름을 쓴다.
import type { LegendMark } from '../core/epithets.js';
import type { GType } from '../core/types.js';
import { TYPE_EQUIP, type MainHand, type OffHand } from '../core/equipment.js';

export type Helmet = 'crested' | 'smooth' | 'griffin' | 'brimmed' | 'visored' | 'plumed' | 'none'; // visored: 면갑 투구(프로보카토르), plumed: 챙+깃털(에퀘스)
export type Extra = 'manica' | 'greaves' | 'galerus' | 'pectorale';
// 악세사리: 별칭·전적으로 생기는 장식. 부착점에 겹쳐 그린다
export type Accessory = 'laurel' | 'scar' | 'sash' | 'palm' | 'armband' | 'staff' | 'rudis' | 'grudge' | 'revenge' | 'legend' | LegendMark; /* LegendMark: 전설 열 명의 표식 (2026-09-22) */ // 예명 밖의 표식: 독토르의 훈련 막대 · 자유민의 나무 검 · 원한(검은 그림자) · 복수(붉은 눈빛) (2026-09-17 사용자)

export interface Loadout {
  main: MainHand;        // 오른손: 공격
  off: OffHand;          // 왼손: 방어(방패) 또는 특수기(그물)
  helmet: Helmet;
  extras: Extra[];
  accessories: Accessory[];
  tunic?: boolean;       // 에퀘스: 맨몸이 아니라 튜닉 차림
  crest?: string;        // 볏·깃털 색 (전설: 스피쿨루스 자주, 켈라두스 붉음, 베루스·테트라이테스 황토) — 2026-09-22
  emblem?: Emblem;       // 방패 문장 (전설)
  weaponTint?: string;   // 무기 색 (전설: 크레스켄스·헤르메스·프루덴스 황토, 콜룸부스 회벽)
}
export type Emblem = 'flame' | 'ring' | 'heart' | 'bar' | 'dot';
/* 전설 열 명의 장비 개성 (2026-09-22 사용자: 장비 외형도 개성 있게) — 표식(accessories)과 짝을 이룬다 */
const LEGEND_LOOK: Record<LegendMark, Partial<Pick<Loadout, 'crest' | 'emblem' | 'weaponTint'>>> = {
  leg_flamma: { emblem: 'flame' },                       // 큰 방패에 붉은 불꽃 — 이름 그대로
  leg_spiculus: { crest: '#7a2a6a', emblem: 'ring' },    // 자주 볏 + 황토 고리 — 황제의 방패
  leg_celadus: { crest: '#a8321f', emblem: 'heart' },    // 붉은 볏 + 작은 하트 — 소녀들의 한숨
  leg_crescens: { weaponTint: '#e8c96a' },               // 황금 삼지창
  leg_priscus: { emblem: 'bar' },                        // 방패에 회벽빛 가로띠 — 콜로세움의 첫 대결
  leg_verus: { crest: '#e8c96a', emblem: 'ring' },       // 황토 볏 + 붉은 고리 (프리스쿠스의 맞수)
  leg_tetraites: { crest: '#e8c96a', emblem: 'dot' },    // 황토 깃털 + 방패 점 — 유리잔의 기수
  leg_hermes: { weaponTint: '#e8c96a' },                 // 황금 쌍검
  leg_columbus: { weaponTint: '#e3d1a6' },               // 회벽빛(비둘기) 날
  leg_prudens: { weaponTint: '#e8c96a' },                // 황금 창
};

// 유형별 외형 (무기·방패는 룰 장비에서 가져온다)
const TYPE_LOOK: Record<GType, { helmet: Helmet; extras: Extra[]; tunic?: boolean }> = {
  murmillo:  { helmet: 'crested', extras: ['manica', 'greaves'] },
  secutor:   { helmet: 'smooth',  extras: ['manica', 'greaves'] },
  thraex:    { helmet: 'griffin', extras: ['greaves'] },
  retiarius: { helmet: 'none',    extras: ['galerus'] },
  hoplomachus: { helmet: 'brimmed', extras: ['manica', 'greaves'] },
  provocator:  { helmet: 'visored', extras: ['manica', 'greaves', 'pectorale'] },
  eques:       { helmet: 'plumed',  extras: ['manica'], tunic: true },
  dimachaerus: { helmet: 'smooth',  extras: ['manica', 'greaves'] },
  scissor:     { helmet: 'smooth',  extras: ['manica', 'greaves'] }, // 세쿠토르 투구 + 왼팔 관
  laquearius:  { helmet: 'none',    extras: ['galerus'] },           // 레티아리우스 몸 + 올가미
};

export function loadoutFor(type: GType, accessories: Accessory[] = []): Loadout {
  const eq = TYPE_EQUIP[type], look = TYPE_LOOK[type];
  const mark = accessories.find((a): a is LegendMark => a.startsWith('leg_')); const look2 = mark ? LEGEND_LOOK[mark] : {};
  return { main: eq.main, off: eq.off, helmet: look.helmet, extras: [...look.extras], accessories: [...accessories], tunic: look.tunic, ...look2 };
}
export const hasBigShield = (l: Loadout) => l.off === 'scutum';
export const hasNet = (l: Loadout) => l.off === 'net' || l.off === 'lasso'; // 올가미는 그물 그림을 빌린다 (2026-09-18)
