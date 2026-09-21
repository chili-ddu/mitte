import type { Gladiator } from './types.js';
import type { Rng } from './rng.js';
// 자질(ingenium): 성장 가중치. 평범 60% · 재능 28% · 비범 10% · 천부 2%. 시장에서는 상인의 한 줄로만 짐작하고, 첫 훈련이나 첫 경기 뒤에 밝혀진다
export type Talent = 0 | 1 | 2 | 3;
export const TALENT_KO = ['평범', '재능', '비범', '천부'] as const;
export const TALENT_RATE = [0.60, 0.28, 0.10, 0.02] as const;
export const TALENT_TRAIN_BONUS = [0, 0.35, 0.55, 0.70] as const;   // 훈련 때 +1이 더 붙을 확률
export const TALENT_PRICE_MUL = [1, 1.15, 1.4, 1.8] as const;       // 밝혀진 뒤 값에 반영
export const AWAKEN_CHANCE = 0.12;                                   // 계기마다 한 단계 오를 확률
export function rollTalent(rng: Rng, shift = 0): Talent { const r = rng.next(); let t: Talent = r < TALENT_RATE[3] ? 3 : r < TALENT_RATE[3] + TALENT_RATE[2] ? 2 : r < 1 - TALENT_RATE[0] ? 1 : 0; if (shift > 0 && t < 3 && rng.chance(shift)) t = (t + 1) as Talent; return t; } // shift: 한 단계 위로 오를 확률 (자유민 지원자·강한 파밀리아 출신)
export const talentOf = (g: Gladiator): Talent => (g.talent ?? 0) as Talent;
// 시장에서는 자질을 알 수 없다 (상인 힌트 없음, 값에도 안 들어감). 첫 훈련·첫 경기에서 밝혀진다
export function awaken(rng: Rng, g: Gladiator, why: string): { from: Talent; to: Talent; why: string } | null { const t = talentOf(g); if (t >= 3 || !rng.chance(AWAKEN_CHANCE)) return null; g.talent = (t + 1) as Talent; g.talentKnown = true; return { from: t, to: g.talent, why }; }
