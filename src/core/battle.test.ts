// 전투 골든 테스트: 시드가 같으면 결과가 같아야 한다. 규칙을 고치면 여기가 먼저 깨진다 — 의도한 변화면 값을 갱신하고 docs/06 에 근거를 남긴다.
// 실행: npm test  (node:test + tsx, 새 의존성 없음)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from './rng.js';
import { battle } from './battle.js';
import { makeGladiator, resetIds } from './gladiator.js';
import { CONFIG } from './config.js';

// 시드마다 (승자, 초, 프레임 수, 이벤트 수). 2026-09-17 유형 균형 개편(매 타 방패 막기·시카 방패 넘기·그물 빗나감·다리 노리기·무기 받아넘기기·창 길목 찌르기·방패 밀어붙이기·전력 가중치 재측정·넘어짐·무기 떨구기) 뒤 다시 기록
const GOLDEN: Record<number, { winner: string; dur: number; frames: number; events: number }> = {
  1: { winner: 'A', dur: 6.4, frames: 66, events: 9 },
  7: { winner: 'A', dur: 6.6, frames: 68, events: 10 },
  42: { winner: 'B', dur: 24.6, frames: 248, events: 26 },
};
const duel = (seed: number) => { resetIds(); const rng = new Rng(seed); const A = [makeGladiator(rng, 'veteranus', { type: 'murmillo' })], B = [makeGladiator(rng, 'tiro', { type: 'thraex' })]; return { r: battle(rng, A, B), A, B }; };

test('같은 시드는 같은 경기를 만든다 (골든)', () => {
  for (const [seedS, want] of Object.entries(GOLDEN)) { const { r } = duel(Number(seedS));
    assert.equal(r.winner, want.winner, `시드 ${seedS} 승자`);
    assert.equal(+r.duration.toFixed(1), want.dur, `시드 ${seedS} 초`);
    assert.equal(r.frames.length, want.frames, `시드 ${seedS} 프레임 수`);
    assert.equal(r.events.length, want.events, `시드 ${seedS} 이벤트 수`); }
});

test('같은 시드로 두 번 돌리면 완전히 같다', () => {
  const a = duel(7).r, b = duel(7).r;
  assert.deepEqual(a.frames, b.frames);
  assert.deepEqual(a.log, b.log);
});

test('프레임은 [id, x, y, hp, 숨] 다섯 칸을 나른다', () => {
  const { r } = duel(42);
  for (const f of r.frames) for (const u of f.u) { assert.equal(u.length, 5); assert.ok(u[4] >= 0 && u[4] <= CONFIG.stamina.max, `숨 범위 ${u[4]}`); }
  assert.ok(r.frames.some(f => f.u.some(u => u[4] < CONFIG.stamina.windedAt)), '경기가 길면 누군가는 지쳐야 한다');
});

test('우리 편은 정해 둔 몸 상태를 쓰고 상대는 경기 때 굴린다', () => {
  resetIds(); const rng = new Rng(3);
  const A = [makeGladiator(rng, 'tiro', { type: 'secutor' })], B = [makeGladiator(rng, 'tiro', { type: 'thraex' })];
  A[0].form = 0.75;
  const r = battle(rng, A, B);
  assert.equal(r.form?.[A[0].id], 0.75, '저장해 둔 값 그대로');
  assert.notEqual(r.form?.[B[0].id], undefined, '상대도 값은 있다');
  assert.ok(Math.abs(r.form![B[0].id]) <= 1);
});

test('전투는 제한 시간 안에 끝난다', () => {
  for (let seed = 1; seed <= 30; seed++) { const { r } = duel(seed); assert.ok(r.duration <= 60.1, `시드 ${seed} 가 ${r.duration}초`); }
});

test('피해는 1 아래로 내려가지 않는다', () => {
  for (let seed = 1; seed <= 20; seed++) { const { r } = duel(seed); for (const e of r.events) if (e.kind === 'attack') assert.ok((e.dmg ?? 0) >= 1, `시드 ${seed} 에 0 피해`); }
});
