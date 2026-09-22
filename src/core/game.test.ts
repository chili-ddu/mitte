// 게임 진행 골든 테스트: 새 게임·시즌·저장이 시드대로 재현되는가
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, score, serialize, deserialize, endSeason, available, canReroll, rerollMarket } from './game.js';
import { CONFIG } from './config.js';

test('새 게임은 시드대로 재현된다 (골든)', () => {
  const st = newGame(2026);
  assert.equal(st.money, CONFIG.startMoney);
  assert.deepEqual(st.roster.map(g => [g.name, g.base.atk, g.base.def]), [['파트로클루스', 14, 7], ['파두스', 14, 2]] /* 2026-09-21 서열 배율 삭제·나이만큼 자란 몸·시작 보정 삭제, 파밀리아 색 굴림으로 난수 이동 */);
  assert.deepEqual(st.roster.map(g => [g.rank, g.wins, g.fights]), [['tiro', 0, 0], ['tiro', 0, 0]], '시작 검투사는 제일 어린 티로, 전적 없음 (2026-09-21 사용자)');
  assert.equal(st.contracts.length, 2); /* 2026-09-22 몸 상태 굴림이 빠져 난수가 당겨졌다 (4 → 2) */
  assert.equal(score(st), 27955); /* 2026-09-22 자질이 값에 (28270 → 28935), 할인 30세·priceBase 120 (→ 27955) */ // 2026-09-17 시작 검투사를 티로에서 일반 검투사(전적 3~6승)로 바꾸며 값이 올랐다. 난수 소비가 늘어 계약 수·몸 상태도 다시 굴려진다
  assert.deepEqual(newGame(2026).roster.map(g => g.name), st.roster.map(g => g.name), '두 번 만들어도 같다');
});

test('저장하고 불러오면 그대로다', () => {
  const st = newGame(77); endSeason(st);
  const back = deserialize(JSON.parse(JSON.stringify(serialize(st))));
  assert.equal(back.money, st.money);
  assert.equal(back.season, st.season);
  assert.deepEqual(back.roster.map(g => [g.name, g.fatigue, g.base.atk]), st.roster.map(g => [g.name, g.fatigue, g.base.atk]));
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
