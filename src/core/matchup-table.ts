// 유형 상성표: 전력이 같은 짝을 1대1 로 600판씩 붙여 잰 실제 승률 (행이 열을 이길 확률). 몸 상태·왼손잡이는 빼고 유형 차이만 남겼다.
// **손으로 고치지 않는다** — 전투 규칙을 바꾸면 `node --import tsx src/cli/_mkmatchup.ts` 로 다시 구워 붙인다 (2026-09-20 측정)
import type { GType } from './types.js';
export const TYPE_MATCHUP: Record<GType, Record<GType, number>> = {
  murmillo: { murmillo: 0.500, secutor: 0.513, thraex: 0.417, retiarius: 0.578, hoplomachus: 0.535, provocator: 0.527, eques: 0.583, dimachaerus: 0.457, scissor: 0.537, laquearius: 0.592 },
  secutor: { murmillo: 0.458, secutor: 0.500, thraex: 0.380, retiarius: 0.625, hoplomachus: 0.578, provocator: 0.457, eques: 0.478, dimachaerus: 0.385, scissor: 0.447, laquearius: 0.678 },
  thraex: { murmillo: 0.557, secutor: 0.603, thraex: 0.500, retiarius: 0.358, hoplomachus: 0.540, provocator: 0.580, eques: 0.520, dimachaerus: 0.348, scissor: 0.480, laquearius: 0.400 },
  retiarius: { murmillo: 0.442, secutor: 0.335, thraex: 0.590, retiarius: 0.500, hoplomachus: 0.397, provocator: 0.410, eques: 0.458, dimachaerus: 0.675, scissor: 0.497, laquearius: 0.487 },
  hoplomachus: { murmillo: 0.507, secutor: 0.428, thraex: 0.508, retiarius: 0.572, hoplomachus: 0.500, provocator: 0.403, eques: 0.543, dimachaerus: 0.545, scissor: 0.660, laquearius: 0.577 },
  provocator: { murmillo: 0.485, secutor: 0.515, thraex: 0.442, retiarius: 0.533, hoplomachus: 0.527, provocator: 0.500, eques: 0.518, dimachaerus: 0.420, scissor: 0.613, laquearius: 0.575 },
  eques: { murmillo: 0.448, secutor: 0.545, thraex: 0.495, retiarius: 0.532, hoplomachus: 0.455, provocator: 0.450, eques: 0.500, dimachaerus: 0.468, scissor: 0.465, laquearius: 0.505 },
  dimachaerus: { murmillo: 0.512, secutor: 0.528, thraex: 0.597, retiarius: 0.300, hoplomachus: 0.493, provocator: 0.538, eques: 0.632, dimachaerus: 0.500, scissor: 0.307, laquearius: 0.360 },
  scissor: { murmillo: 0.448, secutor: 0.532, thraex: 0.508, retiarius: 0.502, hoplomachus: 0.363, provocator: 0.387, eques: 0.540, dimachaerus: 0.643, scissor: 0.500, laquearius: 0.510 },
  laquearius: { murmillo: 0.465, secutor: 0.332, thraex: 0.573, retiarius: 0.525, hoplomachus: 0.417, provocator: 0.420, eques: 0.502, dimachaerus: 0.642, scissor: 0.475, laquearius: 0.500 },
};
