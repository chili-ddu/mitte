import { test } from 'node:test';
import assert from 'node:assert/strict';
import { basicDictataOf, DICTATA } from './dictata.js';
import { TYPES } from './gladiator.js';
import { classOf, rangeOf, blockOf } from './classes.js';

test('유형마다 기본 딕타타 셋 — 주장비·보조장비·유형', () => {
  for (const t of TYPES) { const d = basicDictataOf(t); assert.equal(d.length, 3, t); assert.deepEqual(d.map(x => x.layer).sort(), ['main', 'off', 'type'], t); }
  assert.equal(new Set(DICTATA.map(d => d.id)).size, DICTATA.length, 'id 겹침 없음');
});
test('장비 수치는 클래스에서 나온다', () => {
  assert.deepEqual(classOf('secutor'), { main: 'gladius', off: 'bigShield' });
  assert.equal(rangeOf('hoplomachus'), 2); assert.equal(rangeOf('laquearius'), 2); assert.equal(rangeOf('murmillo'), 1);
  assert.equal(blockOf('murmillo'), 0.5); assert.equal(blockOf('thraex'), 0.3); assert.equal(blockOf('scissor'), 0);
});
