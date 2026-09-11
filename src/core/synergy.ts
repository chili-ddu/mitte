import type { Gladiator, GType, Lineage } from './types.js';
import { equipOf } from './equipment.js';

export interface Synergies {
  shieldWall: boolean;   // 무르밀로+세쿠토르 2명 이상
  huntPair: boolean;     // 레티아리우스 + 세쿠토르
  lightHeavy: boolean;   // 큰 방패 + 작은 방패: 팀 전체 받는 피해 −8%
  nature2: boolean; nature3: boolean;
  victory2: boolean; victory3: boolean;
}

export function computeSynergies(team: Gladiator[]): Synergies {
  const count = (pred: (g: Gladiator) => boolean) => team.filter(pred).length;
  const has = (t: GType) => team.some(g => g.type === t);
  const lin = (l: Lineage) => count(g => g.lineage === l);
  return {
    shieldWall: count(g => equipOf(g.type).off === 'scutum') >= 2, // 큰 방패 2명 이상
    huntPair: has('retiarius') && has('secutor'),
    lightHeavy: team.some(g => equipOf(g.type).off === 'scutum') && team.some(g => equipOf(g.type).off === 'parmula'), // 큰 방패 + 작은 방패
    nature2: lin('nature') >= 2, nature3: lin('nature') >= 3,
    victory2: lin('victory') >= 2, victory3: lin('victory') >= 3,
  };
}

export function describeSynergies(s: Synergies): string[] {
  const out: string[] = [];
  if (s.shieldWall) out.push('방패벽');
  if (s.huntPair) out.push('사냥조');
  if (s.lightHeavy) out.push('경중 조합');
  if (s.nature3) out.push('자연×3'); else if (s.nature2) out.push('자연×2');
  if (s.victory3) out.push('승리×3'); else if (s.victory2) out.push('승리×2');
  return out;
}

// ── 전통 짝(파리아): 로마인이 "제대로 된 대결"로 여긴 유형 조합. 내 팀과 상대 유형이 모두 짝지어지면 흥행 보너스 (호감도·미시오)
const CLASSIC_PAIRS: [GType, GType][] = [['murmillo', 'thraex'], ['murmillo', 'hoplomachus'], ['retiarius', 'secutor'], ['provocator', 'provocator'], ['eques', 'eques'], ['dimachaerus', 'hoplomachus'], ['dimachaerus', 'dimachaerus']]; // 로마의 정해진 짝
export function isClassicPair(a: GType, b: GType): boolean { return CLASSIC_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a)); }
// 내 유형 목록과 상대 유형 목록이 1:1로 전부 전통 짝을 이루는가 (탐욕 매칭)
export function classicMatchup(mine: GType[], theirs: GType[]): boolean {
  if (!mine.length || mine.length !== theirs.length) return false;
  const rest = [...theirs];
  for (const m of mine) { const k = rest.findIndex(t => isClassicPair(m, t)); if (k < 0) return false; rest.splice(k, 1); }
  return true;
}
