// 유형 상성표: 전력이 같은 짝을 1대1 로 400판씩 붙여 잰 실제 승률 (행이 열을 이길 확률). 몸 상태·왼손잡이는 빼고 유형 차이만 남겼다.
// **손으로 고치지 않는다** — 전투 규칙을 바꾸면 `node --import tsx src/cli/_mkmatchup.ts` 로 다시 구워 붙인다 (2026-09-17 측정)
import type { GType } from './types.js';
export const TYPE_MATCHUP: Record<GType, Record<GType, number>> = {
  murmillo: { murmillo: 0.500, secutor: 0.497, thraex: 0.505, retiarius: 0.475, hoplomachus: 0.517, provocator: 0.530, eques: 0.415, dimachaerus: 0.482 },
  secutor: { murmillo: 0.555, secutor: 0.500, thraex: 0.415, retiarius: 0.535, hoplomachus: 0.522, provocator: 0.480, eques: 0.495, dimachaerus: 0.393 },
  thraex: { murmillo: 0.495, secutor: 0.565, thraex: 0.500, retiarius: 0.355, hoplomachus: 0.480, provocator: 0.482, eques: 0.547, dimachaerus: 0.425 },
  retiarius: { murmillo: 0.453, secutor: 0.405, thraex: 0.537, retiarius: 0.500, hoplomachus: 0.522, provocator: 0.482, eques: 0.453, dimachaerus: 0.610 },
  hoplomachus: { murmillo: 0.522, secutor: 0.427, thraex: 0.487, retiarius: 0.530, hoplomachus: 0.500, provocator: 0.450, eques: 0.515, dimachaerus: 0.450 },
  provocator: { murmillo: 0.410, secutor: 0.522, thraex: 0.485, retiarius: 0.440, hoplomachus: 0.517, provocator: 0.500, eques: 0.492, dimachaerus: 0.583 },
  eques: { murmillo: 0.482, secutor: 0.440, thraex: 0.427, retiarius: 0.512, hoplomachus: 0.460, provocator: 0.527, eques: 0.500, dimachaerus: 0.527 },
  dimachaerus: { murmillo: 0.427, secutor: 0.555, thraex: 0.557, retiarius: 0.340, hoplomachus: 0.575, provocator: 0.520, eques: 0.475, dimachaerus: 0.500 },
};
