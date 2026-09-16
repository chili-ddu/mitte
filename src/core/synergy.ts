import type { Gladiator, GType, Lineage } from './types.js';
import { equipOf } from './equipment.js';

export interface Synergies {
  shieldWall: boolean;   // 무르밀로+세쿠토르 2명 이상
  huntPair: boolean;     // 레티아리우스 + 세쿠토르
  lightHeavy: boolean;   // 큰 방패 + 작은 방패: 팀 전체 받는 피해 −8%
  nature2: boolean; nature3: boolean;
  victory2: boolean; victory3: boolean;
  cavalry: boolean;      // 에퀴테스 2: 경기 첫 순서로 짝지어 등장하던 기병 — 첫 5초 속도 +2
  spearWall: boolean;    // 호플로마쿠스 + 프로보카토르: 창·중형 방패의 중장 — 첫 타 ×1.2
  sicaBrothers: boolean; // 트라엑스 + 디마카에루스: 곡도(시카) 둘 — 방어 무시 +10%p
  myth2: boolean;        // 신화 계보 2: 관중이 이름에 홀린다 — 미시오 +5%
  hometown: boolean;     // 지명 계보 2: 동향, 서로 돌본다 — 시즌 끝 피로 −1
  nickname2: boolean;    // 별칭 계보 2: 낙서에 오르는 이름들 — 승리 호감도 +1
  captives: boolean;     // 전쟁 포로 2 이상: 이방인 부대의 결속 — 공격 +1 (관중의 냉담은 그대로)
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
    cavalry: count(g => g.type === 'eques') >= 2, spearWall: has('hoplomachus') && has('provocator'), sicaBrothers: has('thraex') && has('dimachaerus'),
    myth2: lin('myth') >= 2, hometown: lin('place') >= 2, nickname2: lin('nickname') >= 2, captives: count(g => g.origin === 'captive') >= 2,
  };
}

export function describeSynergies(s: Synergies): string[] {
  const out: string[] = [];
  if (s.shieldWall) out.push('방패벽');
  if (s.huntPair) out.push('사냥조');
  if (s.lightHeavy) out.push('경중 조합');
  if (s.nature3) out.push('자연×3'); else if (s.nature2) out.push('자연×2');
  if (s.victory3) out.push('승리×3'); else if (s.victory2) out.push('승리×2');
  if (s.cavalry) out.push('기병대'); if (s.spearWall) out.push('창 벽'); if (s.sicaBrothers) out.push('곡도 형제');
  if (s.myth2) out.push('신화×2'); if (s.hometown) out.push('동향'); if (s.nickname2) out.push('별칭×2'); if (s.captives) out.push('동포');
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
