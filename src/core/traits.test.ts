// 특성 골든: 파밀리아에서 센 단계가 규칙대로 켜지고, 전투에 실제로 실리는가 (2026-09-18)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from './rng.js';
import { battle } from './battle.js';
import { makeGladiator, resetIds } from './gladiator.js';
import { countTraits, levelOf, traitLevelsOf, unitMods, noTraits } from './traits.js';
import type { GType, Lineage } from './types.js';
import { CONFIG } from './config.js';

const mk = (rng: Rng, type: GType, lineage?: Lineage) => makeGladiator(rng, 'tiro', { type, lineage });

test('문턱 1·2·3 → 단계 1·2·3 (편성 머릿수)', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 9].map(levelOf), [0, 1, 2, 3, 3, 3]);
});

test('팀에서 센다 — 독토르·죽은 자는 빼고, 부상자는 넣는다', () => {
  resetIds(); const rng = new Rng(11);
  const roster = [mk(rng, 'murmillo', 'nature'), mk(rng, 'secutor', 'nature'), mk(rng, 'provocator', 'victory'), mk(rng, 'thraex', 'victory')];
  roster[2].status = 'doctor'; roster[3].injured = 2;
  const c = countTraits(roster);
  assert.equal(c.trait.bigShield, 2, '독토르는 안 센다'); assert.equal(c.trait.gladius, 2); assert.equal(c.trait.smallShield, 1, '부상자는 센다'); assert.equal(c.trait.sica, 1);
  assert.equal(c.lineage.nature, 2); assert.equal(c.lineage.victory, 1);
  const L = traitLevelsOf(roster);
  assert.equal(L.trait.bigShield, 2); assert.equal(L.trait.smallShield, 1); assert.equal(L.lineage.nature, 2);
});

test('보정은 그 특성을 가진 검투사에게만 걸린다', () => {
  resetIds(); const rng = new Rng(3);
  const L = noTraits(); L.trait.bigShield = 1; L.lineage.nature = 1;
  const mur = mk(rng, 'murmillo', 'nature'), ret = mk(rng, 'retiarius', 'victory');
  assert.equal(unitMods(mur, L).def, CONFIG.traits.bigShield.def[0]); assert.equal(unitMods(mur, L).atkMul, CONFIG.traits.nature.atk[0]);
  assert.equal(unitMods(ret, L).def, 0); assert.equal(unitMods(ret, L).atkMul, 1);
});

test('특성 단계는 경기 결과를 바꾼다 (같은 시드, 특성 유무)', () => {
  const run = (L?: ReturnType<typeof noTraits>) => { resetIds(); const rng = new Rng(21); const A = [makeGladiator(rng, 'veteranus', { type: 'murmillo' })], B = [makeGladiator(rng, 'tiro', { type: 'thraex' })]; return battle(rng, A, B, L ? { traitsA: L } : {}); };
  const base = run(); const L = noTraits(); L.trait.bigShield = 3; L.trait.gladius = 2; const withT = run(L);
  assert.notDeepEqual(withT.frames, base.frames, '큰방패 3단계·글라디우스 2단계가 걸리면 경기가 달라진다');
});
