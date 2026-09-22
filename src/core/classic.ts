// 전통 짝(파리아): 로마인이 "제대로 된 대결"로 여긴 유형 조합. 2단계(docs/08 4-6)에서 계약 조건이 된다. synergy.ts 에서 옮김 (2026-09-18)
import type { GType } from './types.js';

// ── 전통 짝(파리아): 로마인이 "제대로 된 대결"로 여긴 유형 조합. 주최자가 주문한 정식 대결 계약(Contract.classic)의 성립 조건 — 짝이 서면 흥행 보너스 (호감도·미시오·명예)
const CLASSIC_PAIRS: [GType, GType][] = [['murmillo', 'thraex'], ['murmillo', 'hoplomachus'], ['retiarius', 'secutor'], ['provocator', 'provocator'], ['eques', 'eques'], ['dimachaerus', 'hoplomachus'], ['dimachaerus', 'dimachaerus'], ['scissor', 'retiarius'], ['laquearius', 'secutor']]; // 스키소르–레티아리우스는 부조(고증), 라쿠에아리우스–세쿠토르는 레티아리우스 변형이라는 유추 (2026-09-18 docs/09) // 로마의 정해진 짝
export function isClassicPair(a: GType, b: GType): boolean { return CLASSIC_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a)); }
// 내 유형 목록과 상대 유형 목록이 1:1로 전부 전통 짝을 이루는가 — 완전 매칭 (탐욕이면 [A,B]:[wA,wB] 에서 B 가 wA 를 먼저 잡아 실패할 수 있다. 2026-09-18 유형 열이 되며 드러남)
function perfectMatch(mine: GType[], theirs: GType[]): boolean {
  if (mine.length !== theirs.length) return false;
  const rest = [...theirs];
  const rec = (i: number): boolean => { if (i === mine.length) return true; for (let k = 0; k < rest.length; k++) { if (!isClassicPair(mine[i], rest[k])) continue; const [t] = rest.splice(k, 1); if (rec(i + 1)) { rest.splice(k, 0, t); return true; } rest.splice(k, 0, t); } return false; };
  return rec(0);
}
export function classicMatchup(mine: GType[], theirs: GType[]): boolean { return mine.length > 0 && perfectMatch(mine, theirs); }

// 이 유형의 정식 짝들 (없는 유형은 없다 — 여덟 유형 모두 짝이 있다)
export function partnersOf(t: GType): GType[] { return CLASSIC_PAIRS.flatMap(([x, y]) => x === t ? [y] : y === t ? [x] : []); }
// 가진 유형들(중복 허용)로 상대 유형 전부에 짝을 세울 수 있는가 — 탐욕 매칭 (한 사람은 한 자리)
/* 부분 짝: 지금 세운 사람들(mine, 상대보다 적어도 된다)을 서로 다른 상대에게 짝지을 수 있는가 — 편성 중에 짝이 아닌 사람을 미리 막는다 (2026-09-22 사용자) */
export function fitsClassic(mine: GType[], theirs: GType[]): boolean {
  if (mine.length > theirs.length) return false; const used = new Set<number>();
  const rec = (i: number): boolean => { if (i === mine.length) return true; for (let k = 0; k < theirs.length; k++) { if (used.has(k) || !isClassicPair(mine[i], theirs[k])) continue; used.add(k); if (rec(i + 1)) return true; used.delete(k); } return false; };
  return rec(0);
}
export function canPairFrom(mine: GType[], theirs: GType[]): boolean {
  // 가진 유형(중복 허용, 상대보다 많아도 됨)에서 상대 전원의 짝을 고를 수 있는가 — 상대 각각에 서로 다른 사람
  const rest = [...mine];
  const rec = (i: number): boolean => { if (i === theirs.length) return true; for (let k = 0; k < rest.length; k++) { if (!isClassicPair(rest[k], theirs[i])) continue; const [m] = rest.splice(k, 1); if (rec(i + 1)) { rest.splice(k, 0, m); return true; } rest.splice(k, 0, m); } return false; };
  return rec(0);
}
