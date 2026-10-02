// 게임 진행 골든 테스트: 새 게임·시즌·저장이 시드대로 재현되는가
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, score, serialize, deserialize, endSeason, available, canReroll, rerollMarket, buy, chooseRivals, canStarBet, sendStarBet, challengeProgress } from './game.js';
import { noteBeaten } from './rivals.js';
import { CONFIG } from './config.js';

test('새 게임은 시드대로 재현된다 (골든)', () => {
  const st = newGame(2026);
  assert.equal(st.money, CONFIG.startMoney);
  assert.deepEqual(st.roster.map(g => [g.name, g.base.atk, g.base.def]), [['펠릭스', 7, 9], ['삼니스', 9, 4]] /* 2026-10-01 도장 사슬: 파밀리아 넷(간판·두 번째·명부 소속)을 먼저 만들어 난수가 밀림 */ /* 2026-09-30 고정 명부: 시작은 펠릭스(재능 무르밀로 20세) + 명부의 평범 하나 — 항목 seed 로 굴려 게임 시드와 무관하게 같은 몸 */ /* 2026-09-22 공격 눈금 절반, 유형 재분배, 파밀리아 한 팀·명단 5 로 시작 — 난수 소비가 바뀜 */ /* 2026-09-21 서열 배율 삭제·나이만큼 자란 몸·시작 보정 삭제, 파밀리아 색 굴림으로 난수 이동 */);
  assert.deepEqual(st.roster.map(g => [g.rank, g.wins, g.fights]), [['tiro', 0, 0], ['tiro', 0, 0]], '시작 검투사는 제일 어린 티로, 전적 없음 (2026-09-21 사용자)');
  assert.equal(st.contracts.length, 0); /* 2026-10-01 도장 사슬: 처음부터 파밀리아 넷이라 1년차 상대 고르기(pendingRivalPick)가 먼저 — 고르기 전에는 공고벽이 비어 있다 */ assert.ok(st.pendingRivalPick); /* 2026-09-22 몸 상태 굴림이 빠져 (4 → 2), 파밀리아 열두 집·특징 (3 → 2) */
  assert.equal(score(st), 28970); /* 2026-10-01 도장 사슬 (→ 28970) */ /* 2026-09-30 고정 명부 시작 검투사 (→ 29250) */ /* 2026-09-22 자질이 값에, 할인 30세·priceBase 120, 전력 가중치 재측정, 유형 재분배, 파밀리아 한 팀·명단 5 (→ 28900) */ // 2026-09-17 시작 검투사를 티로에서 일반 검투사(전적 3~6승)로 바꾸며 값이 올랐다. 난수 소비가 늘어 계약 수·몸 상태도 다시 굴려진다
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

test('고정 명부: 시장은 명부에서만 뽑고, 산 사람은 다시 서지 않으며, 등장 횟수를 다 쓰면 떠난다', () => {
  const st = newGame(5);
  assert.ok(st.market.every(g => g.castId), '시장 매물은 전부 명부 항목');
  assert.equal(st.market.length, CONFIG.market.firstSeason);
  const first = st.market[0]; assert.ok(buy(st, first)); assert.equal(st.cast[first.castId!].taken, true);
  for (let i = 0; i < 12; i++) { endSeason(st); assert.ok(!st.market.some(g => g.castId === first.castId), '산 사람은 시장에 안 선다'); assert.ok(st.market.every(g => g.castId), '시장 매물은 전부 명부 항목'); assert.ok(st.market.length <= CONFIG.market.perSeason); }
  assert.ok(Object.values(st.cast).some(c => c.gone), '안 팔린 재능 이상은 등장 횟수를 다 쓰고 떠난다');
  assert.ok(st.roster.every(g => g.name !== '풀구르' || g.castId), '명부의 이름은 랜덤 생성이 쓰지 않는다');
});

test('도장 사슬: 명단을 정원만큼 꺾어야 간판 내기, 졸업하면 다음 도장이 나타난다', () => {
  const st = newGame(31); const dojo1 = st.rivals.find(r => r.id === 4)!; const dojo2 = st.rivals.find(r => r.id === 2)!;
  assert.ok(!st.rivals.some(r => r.id === 5), '누케리아는 암플리아투스를 졸업해야 온다');
  chooseRivals(st, [dojo1.id, dojo2.id]); assert.ok(st.contracts.length >= 1, '고르면 공고벽이 걸린다');
  assert.ok(canStarBet(st, dojo1), '아직 명단을 못 꺾어 간판 내기 불가');
  for (const g of dojo1.roster) if (g.id !== dojo1.starId) noteBeaten(dojo1, g);
  assert.deepEqual(challengeProgress(dojo1), { beaten: 5, total: 5 });
  assert.equal(canStarBet(st, dojo1), null); assert.ok(sendStarBet(st, dojo1));
  endSeason(st); const sb = st.contracts.find(c => c.starBet); assert.ok(sb, '다음 시즌 공고벽에 간판 내기'); assert.equal(sb!.enemy[0].id, dojo1.starId, '상대 첫 자리가 간판');
  dojo2.graduated = st.season; endSeason(st); assert.ok(st.rivals.some(r => r.id === 5), '암플리아투스를 졸업하면 누케리아가 나타난다'); assert.ok(st.rivals.some(r => r.id === 13), '순회 검투사단도');
  assert.ok(st.rivals.every(r => r.roster.every(g => g.id !== r.starId || (g.honor ?? 0) >= 40 || r.id === 15)), '간판은 명예를 갖고 온다');
});
