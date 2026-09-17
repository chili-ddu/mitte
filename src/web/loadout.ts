// 그림용 장비. 오른손(main)·왼손(off)은 core/equipment.ts 의 룰 장비와 같은 이름을 쓴다.
import type { GType } from '../core/types.js';
import { TYPE_EQUIP, type MainHand, type OffHand } from '../core/equipment.js';

export type Helmet = 'crested' | 'smooth' | 'griffin' | 'brimmed' | 'visored' | 'plumed' | 'none'; // visored: 면갑 투구(프로보카토르), plumed: 챙+깃털(에퀘스)
export type Extra = 'manica' | 'greaves' | 'galerus' | 'pectorale';
// 악세사리: 별칭·전적으로 생기는 장식. 부착점에 겹쳐 그린다
export type Accessory = 'laurel' | 'scar' | 'sash' | 'palm' | 'armband' | 'staff' | 'rudis' | 'grudge' | 'revenge'; // 예명 밖의 표식: 독토르의 훈련 막대 · 자유민의 나무 검 · 원한(검은 그림자) · 복수(붉은 눈빛) (2026-09-17 사용자)

export interface Loadout {
  main: MainHand;        // 오른손: 공격
  off: OffHand;          // 왼손: 방어(방패) 또는 특수기(그물)
  helmet: Helmet;
  extras: Extra[];
  accessories: Accessory[];
  tunic?: boolean;       // 에퀘스: 맨몸이 아니라 튜닉 차림
}

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
};

export function loadoutFor(type: GType, accessories: Accessory[] = []): Loadout {
  const eq = TYPE_EQUIP[type], look = TYPE_LOOK[type];
  return { main: eq.main, off: eq.off, helmet: look.helmet, extras: [...look.extras], accessories: [...accessories], tunic: look.tunic };
}
export const hasBigShield = (l: Loadout) => l.off === 'scutum';
export const hasNet = (l: Loadout) => l.off === 'net';
