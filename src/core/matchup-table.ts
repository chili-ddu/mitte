// 유형 상성표: 전력이 같은 짝을 1대1 로 600판씩 붙여 잰 실제 승률 (행이 열을 이길 확률). 몸 상태·왼손잡이는 빼고 유형 차이만 남겼다.
// **손으로 고치지 않는다** — 전투 규칙을 바꾸면 `node --import tsx src/cli/_mkmatchup.ts` 로 다시 구워 붙인다 (2026-09-21 측정)
import type { GType } from './types.js';
export const TYPE_MATCHUP: Record<GType, Record<GType, number>> = {
  murmillo: { murmillo: 0.500, secutor: 0.630, thraex: 0.500, retiarius: 0.500, hoplomachus: 0.500, provocator: 0.528, eques: 0.500, dimachaerus: 0.500, scissor: 0.500, laquearius: 0.500 },
  secutor: { murmillo: 0.380, secutor: 0.500, thraex: 0.500, retiarius: 0.500, hoplomachus: 0.500, provocator: 0.458, eques: 0.500, dimachaerus: 0.500, scissor: 0.565, laquearius: 0.500 },
  thraex: { murmillo: 0.500, secutor: 0.500, thraex: 0.500, retiarius: 0.500, hoplomachus: 0.477, provocator: 0.500, eques: 0.502, dimachaerus: 0.360, scissor: 0.408, laquearius: 0.500 },
  retiarius: { murmillo: 0.500, secutor: 0.500, thraex: 0.500, retiarius: 0.500, hoplomachus: 0.500, provocator: 0.500, eques: 0.500, dimachaerus: 0.500, scissor: 0.500, laquearius: 0.622 },
  hoplomachus: { murmillo: 0.500, secutor: 0.500, thraex: 0.503, retiarius: 0.500, hoplomachus: 0.500, provocator: 0.500, eques: 0.563, dimachaerus: 0.552, scissor: 0.655, laquearius: 0.500 },
  provocator: { murmillo: 0.427, secutor: 0.562, thraex: 0.500, retiarius: 0.500, hoplomachus: 0.500, provocator: 0.500, eques: 0.500, dimachaerus: 0.500, scissor: 0.705, laquearius: 0.500 },
  eques: { murmillo: 0.500, secutor: 0.500, thraex: 0.498, retiarius: 0.500, hoplomachus: 0.477, provocator: 0.500, eques: 0.500, dimachaerus: 0.432, scissor: 0.493, laquearius: 0.500 },
  dimachaerus: { murmillo: 0.500, secutor: 0.500, thraex: 0.597, retiarius: 0.500, hoplomachus: 0.497, provocator: 0.500, eques: 0.607, dimachaerus: 0.500, scissor: 0.322, laquearius: 0.500 },
  scissor: { murmillo: 0.500, secutor: 0.433, thraex: 0.575, retiarius: 0.500, hoplomachus: 0.383, provocator: 0.275, eques: 0.610, dimachaerus: 0.715, scissor: 0.500, laquearius: 0.500 },
  laquearius: { murmillo: 0.500, secutor: 0.500, thraex: 0.500, retiarius: 0.348, hoplomachus: 0.500, provocator: 0.500, eques: 0.500, dimachaerus: 0.500, scissor: 0.500, laquearius: 0.500 },
};
