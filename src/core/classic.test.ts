import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from './rng.js';
import { CONFIG } from './config.js';
import { newGame, canFulfill, validTeam, isImportant } from './game.js';
import { offerContracts, resetContractIds } from './contracts.js';
import { canPairFrom, partnersOf, isClassicPair } from './classic.js';
import { makeGladiator } from './gladiator.js';
import type { GType } from './types.js';

test('짝 매칭 — 한 사람은 한 자리', () => {
  assert.equal(canPairFrom(['murmillo'], ['thraex']), true);
  assert.equal(canPairFrom(['murmillo'], ['thraex', 'retiarius']), false);
  assert.equal(canPairFrom(['murmillo', 'secutor'], ['thraex', 'retiarius']), true);
  assert.equal(canPairFrom(['murmillo', 'murmillo'], ['thraex', 'retiarius']), false);
  for (const t of Object.keys(CONFIG.typePower) as GType[]) { assert.ok(partnersOf(t).length > 0, t); for (const p of partnersOf(t)) assert.ok(isClassicPair(t, p)); }
});

test('정식 대결 계약은 생성 시점에 우리 로스터로 채울 수 있고, 상대는 주문한 짝이다', () => {
  let seen = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const st = newGame(seed); resetContractIds(); for (const g of st.roster) g.rank = 'veteranus'; /* 시작 검투사는 티로 둘이라 등급 2·3 정식 대결이 안 나온다 — 시드 운에 기대지 않게 베테라누스로 */
    const cs = offerContracts(new Rng(seed * 7), 3, 60, st.rivals, st.roster);
    for (const c of cs) { if (!c.classic) continue; seen++;
      assert.equal(c.enemy.length, c.size); assert.ok(canFulfill(st, c), `seed ${seed} 채울 수 없는 정식 대결`);
      assert.equal(isImportant(c), false); }
  }
  assert.ok(seen > 0, '정식 대결 계약이 한 번도 안 나왔다');
});

test('정식 대결은 짝이 아니면 성립하지 않는다', () => {
  const rng = new Rng(5); const st = newGame(5); resetContractIds();
  const thraex = makeGladiator(rng, 'veteranus', { season: 1, type: 'thraex' });
  const c = { ...offerContracts(new Rng(9), 1, 0, [], st.roster)[0], size: 1 as const, needVeterans: 0, classic: true, enemy: [thraex], enemyPreview: ['thraex' as GType] };
  const m = makeGladiator(rng, 'veteranus', { season: 1, type: 'murmillo' }), r = makeGladiator(rng, 'veteranus', { season: 1, type: 'retiarius' });
  st.roster.push(m, r);
  assert.equal(validTeam(st, c, [m]), null);
  assert.match(validTeam(st, c, [r]) ?? '', /짝/);
});
