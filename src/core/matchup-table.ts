// 유형 상성표: 전력이 같은 짝을 1대1 로 600판씩 붙여 잰 실제 승률 (행이 열을 이길 확률). 몸 상태·왼손잡이는 빼고 유형 차이만 남겼다.
// **손으로 고치지 않는다** — 전투 규칙을 바꾸면 `node --import tsx src/cli/_mkmatchup.ts` 로 다시 구워 붙인다 (2026-09-22 측정)
import type { GType } from './types.js';
export const TYPE_MATCHUP: Record<GType, Record<GType, number>> = {
  murmillo: { murmillo: 0.500, secutor: 0.440, thraex: 0.350, retiarius: 0.530, hoplomachus: 0.525, provocator: 0.492, eques: 0.458, dimachaerus: 0.462, scissor: 0.523, laquearius: 0.498 },
  secutor: { murmillo: 0.522, secutor: 0.500, thraex: 0.317, retiarius: 0.600, hoplomachus: 0.598, provocator: 0.518, eques: 0.440, dimachaerus: 0.335, scissor: 0.422, laquearius: 0.652 },
  thraex: { murmillo: 0.598, secutor: 0.637, thraex: 0.500, retiarius: 0.302, hoplomachus: 0.498, provocator: 0.572, eques: 0.455, dimachaerus: 0.387, scissor: 0.475, laquearius: 0.355 },
  retiarius: { murmillo: 0.478, secutor: 0.362, thraex: 0.737, retiarius: 0.500, hoplomachus: 0.525, provocator: 0.492, eques: 0.475, dimachaerus: 0.635, scissor: 0.470, laquearius: 0.442 },
  hoplomachus: { murmillo: 0.475, secutor: 0.367, thraex: 0.462, retiarius: 0.442, hoplomachus: 0.500, provocator: 0.452, eques: 0.530, dimachaerus: 0.533, scissor: 0.647, laquearius: 0.448 },
  provocator: { murmillo: 0.483, secutor: 0.507, thraex: 0.395, retiarius: 0.488, hoplomachus: 0.522, provocator: 0.500, eques: 0.513, dimachaerus: 0.338, scissor: 0.567, laquearius: 0.535 },
  eques: { murmillo: 0.502, secutor: 0.565, thraex: 0.567, retiarius: 0.507, hoplomachus: 0.558, provocator: 0.505, eques: 0.500, dimachaerus: 0.475, scissor: 0.530, laquearius: 0.532 },
  dimachaerus: { murmillo: 0.592, secutor: 0.637, thraex: 0.627, retiarius: 0.338, hoplomachus: 0.473, provocator: 0.677, eques: 0.570, dimachaerus: 0.500, scissor: 0.387, laquearius: 0.283 },
  scissor: { murmillo: 0.432, secutor: 0.518, thraex: 0.552, retiarius: 0.493, hoplomachus: 0.375, provocator: 0.443, eques: 0.545, dimachaerus: 0.593, scissor: 0.500, laquearius: 0.505 },
  laquearius: { murmillo: 0.450, secutor: 0.363, thraex: 0.692, retiarius: 0.565, hoplomachus: 0.577, provocator: 0.438, eques: 0.475, dimachaerus: 0.695, scissor: 0.520, laquearius: 0.500 },
};
