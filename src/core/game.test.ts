// 게임 진행 골든 테스트: 새 게임·시즌·저장이 시드대로 재현되는가
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, score, serialize, deserialize, endSeason, available, canReroll, rerollMarket } from './game.js';
import { formLabel, formMod } from './gladiator.js';
import { CONFIG } from './config.js';

test('새 게임은 시드대로 재현된다 (골든)', () => {
  const st = newGame(2026);
  assert.equal(st.money, CONFIG.startMoney);
  assert.deepEqual(st.roster.map(g => [g.name, g.base.atk, g.base.def]), [['파트로클루스', 14, 7], ['파두스', 14, 2]] /* 2026-09-21 서열 배율 삭제·나이만큼 자란 몸·시작 보정 삭제, 파밀리아 색 굴림으로 난수 이동 */);
  assert.deepEqual(st.roster.map(g => [g.rank, g.wins, g.fights]), [['tiro', 0, 0], ['tiro', 0, 0]], '시작 검투사는 제일 어린 티로, 전적 없음 (2026-09-21 사용자)');
  assert.equal(+(st.formTeam ?? 0).toFixed(3), -0.336);
  assert.deepEqual(st.roster.map(g => +(g.form ?? 0).toFixed(3)), [-0.486, 0.013]);
  assert.equal(st.contracts.length, 4);
  assert.equal(score(st), 28270); /* 2026-09-21 값 기준점 113·파밀리아 색 굴림 */ // 2026-09-17 시작 검투사를 티로에서 일반 검투사(전적 3~6승)로 바꾸며 값이 올랐다. 난수 소비가 늘어 계약 수·몸 상태도 다시 굴려진다
  assert.deepEqual(newGame(2026).roster.map(g => g.name), st.roster.map(g => g.name), '두 번 만들어도 같다');
});

test('몸 상태는 시즌마다 다시 정해지고 모두에게 있다', () => {
  const st = newGame(11);
  const before = st.roster.map(g => g.form);
  endSeason(st);
  const after = st.roster.map(g => g.form);
  assert.ok(after.every(f => typeof f === 'number' && Math.abs(f!) <= 1), '모두 −1~1');
  assert.notDeepEqual(after, before, '철이 바뀌면 다시 굴린다');
});

test('몸 상태의 말과 수치가 맞물린다', () => {
  const st = newGame(5); const g = st.roster[0];
  g.form = 0.8; assert.equal(formLabel(g), '가벼움'); assert.deepEqual(formMod(g), { atk: 4, def: 3, hp: 6 }); // 2026-09-17 몸 상태가 체력에도 걸린다
  g.form = -0.8; assert.equal(formLabel(g), '무거움'); assert.deepEqual(formMod(g), { atk: -4, def: -3, hp: -6 });
  g.form = 0; assert.equal(formLabel(g), null); assert.deepEqual(formMod(g), { atk: 0, def: 0, hp: 0 });
  g.form = CONFIG.form.tell; assert.equal(formLabel(g), '가벼움', '문턱 위는 드러난다');
});

test('저장하고 불러오면 그대로다 (몸 상태 포함)', () => {
  const st = newGame(77); endSeason(st);
  const back = deserialize(JSON.parse(JSON.stringify(serialize(st))));
  assert.equal(back.money, st.money);
  assert.equal(back.season, st.season);
  assert.equal(back.formTeam, st.formTeam);
  assert.deepEqual(back.roster.map(g => [g.name, g.form, g.fatigue]), st.roster.map(g => [g.name, g.form, g.fatigue]));
  assert.equal(score(back), score(st));
});

test('출전 가능 명단은 부상·독토르·이번 철 출전자를 뺀다', () => {
  const st = newGame(9);
  assert.equal(available(st).length, st.roster.length);
  st.roster[0].injured = 1;
  assert.ok(!available(st).includes(st.roster[0]));
  st.roster[0].injured = 0; st.roster[0].fought = true;
  assert.ok(!available(st).includes(st.roster[0]));
});

test('상인을 다시 부른다 — 값을 치르고 시즌당 한 번, 판매대가 바뀐다', () => {
  const st = newGame(21); const before = st.market.map(g => g.id); const money = st.money;
  assert.ok(canReroll(st)); assert.ok(rerollMarket(st));
  assert.equal(st.money, money - CONFIG.market.reroll.cost);
  assert.notDeepEqual(st.market.map(g => g.id), before);
  assert.equal(canReroll(st), false, '시즌당 한 번'); assert.equal(rerollMarket(st), false);
  endSeason(st); assert.ok(canReroll(st), '새 시즌이면 다시 부를 수 있다');
});
