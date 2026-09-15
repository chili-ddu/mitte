import type { ClauseId, Contract, HostKind } from './types.js';
import { HOST } from './hosts.js';
import type { Rng } from './rng.js';

// 특약(계약서 조항). 폼페이 공고와 법 기록에 근거: 스폰시오(내기, 로마법 허용) · 차양과 살수(vela et sparsiones, 공고 정형구) · 시네 미시오네(패자를 살리지 않음, 아우구스투스가 금지했으나 기록에 남음)
export interface ClauseDef { id: ClauseId; ko: string; latin: string; desc: string; effect: (c: Contract, basePrize: number) => string; prizeMul: number; fame: number; noMissio: boolean; winnerHonor: number }
export const CLAUSES: Record<ClauseId, ClauseDef> = {
  sponsio: { id: 'sponsio', ko: '스폰시오', latin: 'SPONSIO', desc: '기량 시합에 거는 내기. 로마법이 허용했다. 무승부는 무효', effect: (_c, p) => `이기면 ×2 (${(p * 2).toLocaleString()}), 지면 −${p.toLocaleString()}`, prizeMul: 1, fame: 0, noMissio: false, winnerHonor: 0 },
  vela: { id: 'vela', ko: '차양과 살수', latin: 'VELA ET SPARSIONES', desc: '공고에 "차양이 있고 물을 뿌린다"고 적는다. 관중이 몰리지만 그 비용을 상금에서 뺀다', effect: () => '호감도 +1, 상금 −10%', prizeMul: 0.9, fame: 1, noMissio: false, winnerHonor: 0 },
  sine_missione: { id: 'sine_missione', ko: '시네 미시오네', latin: 'SINE MISSIONE', desc: '패자를 살려 보내지 않는다. 아우구스투스가 금지했지만 기록에 남은 조건. 쓰러진 쪽은 양쪽 모두 죽는다', effect: () => '상금 +50%, 승자 명예 +2, 쓰러지면 미시오 없이 죽는다', prizeMul: 1.5, fame: 0, noMissio: true, winnerHonor: 2 },
};
// 계약에 내걸 특약 후보 (최대 2): 도박꾼은 스폰시오, 등급 2 이상은 차양·살수, 장례 상주·황제는 시네 미시오네
export function offerClauses(rng: Rng, host: HostKind, tier: number): ClauseId[] {
  const out: ClauseId[] = [];
  if (HOST[host].bet) out.push('sponsio');
  if ((host === 'mourner' || host === 'imperial') && tier >= 2 && rng.chance(0.5)) out.push('sine_missione');
  if (tier >= 2 && rng.chance(0.6)) out.push('vela');
  return out.slice(0, 2);
}
export const clausesOf = (c: Contract): ClauseId[] => c.clauses ?? (HOST[c.host].bet ? ['sponsio'] : []); // 옛 저장: 도박꾼이면 스폰시오만
export const acceptedOf = (c: Contract): ClauseId[] => c.accepted ?? (c.bet ? ['sponsio'] : []);
export function setClause(c: Contract, id: ClauseId, on: boolean) { const a = new Set(acceptedOf(c)); if (on) a.add(id); else a.delete(id); c.accepted = [...a]; c.bet = a.has('sponsio'); }
