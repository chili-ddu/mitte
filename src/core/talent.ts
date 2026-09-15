import type { Gladiator } from './types.js';
import type { Rng } from './rng.js';
// 자질(ingenium): 성장 가중치. 평범 60% · 재능 28% · 비범 10% · 천부 2%. 시장에서는 상인의 한 줄로만 짐작하고, 첫 훈련이나 첫 경기 뒤에 밝혀진다
export type Talent = 0 | 1 | 2 | 3;
export const TALENT_KO = ['평범', '재능', '비범', '천부'] as const;
export const TALENT_RATE = [0.60, 0.28, 0.10, 0.02] as const;
export const TALENT_TRAIN_BONUS = [0, 0.35, 0.55, 0.70] as const;   // 훈련 때 +1이 더 붙을 확률
export const TALENT_SKILL_MUL = [1, 1.5, 1.8, 2.0] as const;        // 경기 경험으로 기술을 깨칠 확률 배율
export const TALENT_PRICE_MUL = [1, 1.15, 1.4, 1.8] as const;       // 상인의 눈만큼 값에 반영
export const AWAKEN_CHANCE = 0.12;                                   // 계기마다 한 단계 오를 확률
export const TALENT_HINT: Record<Talent, string[]> = { // 상인의 한 줄 (자질을 짐작하게, 확정은 아님)
  0: ['튼튼하기는 하오.', '시키는 대로는 하는 놈이오.', '값은 이 정도면 됐소.'],
  1: ['눈이 살아 있소.', '힘줄이 좋소.', '가르치면 배우는 놈이오.'],
  2: ['움직임이 남다르오. 한번 보시오.', '이런 놈은 자주 안 나오오.', '몸이 스스로 아는 놈이오.'],
  3: ['……이건 내가 팔 게 아닌데.', '평생 한 번 볼까 말까 한 몸이오.', '이 손목을 보시오. 타고났소.'],
};
export function rollTalent(rng: Rng, shift = 0): Talent { const r = rng.next(); let t: Talent = r < TALENT_RATE[3] ? 3 : r < TALENT_RATE[3] + TALENT_RATE[2] ? 2 : r < 1 - TALENT_RATE[0] ? 1 : 0; if (shift > 0 && t < 3 && rng.chance(shift)) t = (t + 1) as Talent; return t; } // shift: 한 단계 위로 오를 확률 (자유민 지원자·강한 파밀리아 출신)
export const talentOf = (g: Gladiator): Talent => (g.talent ?? 0) as Talent;
export function talentHint(rng: Rng, g: Gladiator): string { const list = TALENT_HINT[talentOf(g)]; return list[Math.floor(rng.next() * list.length)]; }
// 깨우침: 계기(열세 승리·미시오 뒤 승리·5승·10승·명예 높은 독토르의 가르침)마다 12%로 한 단계 오른다
export function awaken(rng: Rng, g: Gladiator, why: string): { from: Talent; to: Talent; why: string } | null { const t = talentOf(g); if (t >= 3 || !rng.chance(AWAKEN_CHANCE)) return null; g.talent = (t + 1) as Talent; g.talentKnown = true; return { from: t, to: g.talent, why }; }
