// 게임 진행 골든 테스트: 새 게임·시즌·저장이 시드대로 재현되는가
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, score, serialize, deserialize, endSeason, available, canReroll, rerollMarket, buy, chooseRivals, canStarBet, sendStarBet, challengeProgress, successorOptions, succeed, canRetire, makeLegacy, isMain, VISITOR_ID, newGameRome, acceptChallenge, fight, visitorStar } from './game.js';
import { Rng } from './rng.js';
import { noteBeaten } from './rivals.js';
import { CONFIG } from './config.js';

test('새 게임은 시드대로 재현된다 (골든)', () => {
  const st = newGame(2026);
  assert.equal(st.money, CONFIG.startMoney);
  assert.deepEqual(st.roster.map(g => [g.name, g.base.atk, g.base.def]), [['펠릭스', 7, 9], ['클라우두스', 9, 3]] /* 2026-10-03 라니스타 고정(이름·나이 굴림이 사라져 난수가 당겨짐) */ /* 2026-10-01 도장 사슬: 파밀리아 넷(간판·두 번째·명부 소속)을 먼저 만들어 난수가 밀림 */ /* 2026-09-30 고정 명부: 시작은 펠릭스(재능 무르밀로 20세) + 명부의 평범 하나 — 항목 seed 로 굴려 게임 시드와 무관하게 같은 몸 */ /* 2026-09-22 공격 눈금 절반, 유형 재분배, 파밀리아 한 팀·명단 5 로 시작 — 난수 소비가 바뀜 */ /* 2026-09-21 서열 배율 삭제·나이만큼 자란 몸·시작 보정 삭제, 파밀리아 색 굴림으로 난수 이동 */);
  assert.deepEqual(st.roster.map(g => [g.rank, g.wins, g.fights]), [['tiro', 0, 0], ['tiro', 0, 0]], '시작 검투사는 제일 어린 티로, 전적 없음 (2026-09-21 사용자)');
  assert.equal(st.contracts.length, 0); /* 2026-10-01 도장 사슬: 처음부터 파밀리아 넷이라 1년차 상대 고르기(pendingRivalPick)가 먼저 — 고르기 전에는 공고벽이 비어 있다 */ assert.ok(st.pendingRivalPick); /* 2026-09-22 몸 상태 굴림이 빠져 (4 → 2), 파밀리아 열두 집·특징 (3 → 2) */
  assert.equal(score(st), 29040); /* 2026-10-03 라니스타 고정 (→ 29040) */ /* 2026-10-01 도장 사슬 (→ 28970) */ /* 2026-09-30 고정 명부 시작 검투사 (→ 29250) */ /* 2026-09-22 자질이 값에, 할인 30세·priceBase 120, 전력 가중치 재측정, 유형 재분배, 파밀리아 한 팀·명단 5 (→ 28900) */ // 2026-09-17 시작 검투사를 티로에서 일반 검투사(전적 3~6승)로 바꾸며 값이 올랐다. 난수 소비가 늘어 계약 수·몸 상태도 다시 굴려진다
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

test('라니스타: 루크리오 32세로 시작, 46세 봄에 반드시 물려주고 루디아리우스가 후계 후보가 된다', () => {
  const st = newGame(12); assert.equal(st.lanista.name, CONFIG.lanista.fixed.name); assert.equal(st.lanista.age, 32);
  const g = st.roster[0]; g.status = 'rudiarius'; g.honor = 50; assert.ok(successorOptions(st).some(o => o.from === g), '루디아리우스가 후보'); assert.ok(canRetire(st), '후보가 있으면 자발 계승 가능');
  st.lanista.age = CONFIG.lanista.mandatoryAge - 1; st.season = 4; st.rng = new Rng(3); /* 겨울 → 봄: 새해에 46세 */ endSeason(st);
  assert.equal(st.lanista.age, CONFIG.lanista.mandatoryAge); assert.ok(st.pendingSuccession, '46세가 되면 반드시 물려준다');
  const opt = successorOptions(st).find(o => o.from === g)!; const fame0 = st.fame; succeed(st, opt);
  assert.equal(st.lanista.name, g.name); assert.ok(!st.roster.includes(g), '후계자는 명단에서 빠진다'); assert.equal(st.fame, Math.round(fame0 * CONFIG.lanista.fameKeep + 50 * CONFIG.lanista.fameFromHonor));
});

test('1회차 엔딩: 율리우스를 졸업하면 방문단이 와서 간판 내기를 걸어오고, 이기면 초청 — 갈루스가 따라온다', () => {
  const st = newGame(41); for (const r of st.rivals) r.graduated = st.season; /* 처음 넷을 졸업한 셈 */
  for (let i = 0; i < 6 && !st.rivals.some(r => r.id === VISITOR_ID); i++) { endSeason(st); for (const r of st.rivals) if (!r.graduated && isMain(r) && r.id !== VISITOR_ID) r.graduated = st.season; } /* 방문단이 나타난 시즌에 멈춘다 (도전장은 그 시즌에만 답할 수 있다) */
  const v = st.rivals.find(r => r.id === VISITOR_ID); assert.ok(v, '율리우스 졸업 뒤 방문단이 나타난다');
  const c = st.pendingChallenges.find(x => x.rivalId === VISITOR_ID); assert.ok(c && c.starBet && c.size === 3, '오자마자 3대3 간판 내기를 걸어온다');
  assert.ok(canStarBet(st, v!), '방문단에는 우리가 걸 수 없다');
  const legacy = makeLegacy(st, successorOptions(st)[0], st.roster.slice(0, 2)); assert.equal(legacy.gladiators.length, 2); assert.equal(legacy.sale, score(st));
});

test('1회차 엔딩: 저장을 거쳐 방문단을 이겨도 갈루스는 하나, 그 시즌 정산이 초청을 파산으로 덮지 않는다', () => {
  let st = newGame(41); for (const r of st.rivals) r.graduated = st.season;
  for (let i = 0; i < 6 && !st.rivals.some(r => r.id === VISITOR_ID); i++) { endSeason(st); for (const r of st.rivals) if (!r.graduated && isMain(r) && r.id !== VISITOR_ID) r.graduated = st.season; }
  st = deserialize(JSON.parse(JSON.stringify(serialize(st)))); /* 계약 속 상대와 명단이 다른 객체가 된다 */
  while (st.roster.length < 3) st.roster.push({ ...st.roster[0], id: 9000 + st.roster.length, name: `보충${st.roster.length}` });
  for (const g of st.roster) { g.base.atk = 60; g.base.def = 60; g.base.hp = 400; g.injured = 0; g.fatigue = 0; } /* 반드시 이기게 */
  const c = st.pendingChallenges.find(x => x.rivalId === VISITOR_ID)!; assert.equal(acceptChallenge(st, c), null);
  const r = fight(st, c, st.roster.slice(0, 3)); assert.equal(r.winner, 'A'); assert.equal(st.reason, '황제 루두스 초청');
  const v = st.rivals.find(x => x.id === VISITOR_ID)!; assert.ok(visitorStar(st), '갈루스가 우리 켈라에'); assert.ok(!v.roster.some(g => g.name === '갈루스'), '방문단 명단에서는 빠진다');
  const season = st.season; st.money = -1_000_000; endSeason(st); assert.equal(st.reason, '황제 루두스 초청'); assert.equal(st.season, season, '다음 시즌을 열지 않는다');
});

test('2회차 로마: 계승 데이터로 시작하고, 마그누스를 졸업하면 근위대 최종전이 공고벽에 걸린다', () => {
  const st1 = newGame(51); const legacy = makeLegacy(st1, successorOptions(st1)[0], st1.roster.slice(0, 2));
  const st = newGameRome(7, legacy); assert.equal(st.region, 'roma'); assert.equal(st.roster.length, 2); assert.equal(st.lanista.name, legacy.heir.name);
  assert.ok(st.rivals.some(r => r.id === 21) && !st.rivals.some(r => r.id === 22), '갈리쿠스만 열려 있다 (다쿠스는 갈리쿠스 졸업 뒤)');
  for (let i = 0; i < 8 && !st.rivals.some(r => r.id === 26); i++) { for (const r of st.rivals) if (!r.graduated && isMain(r)) r.graduated = st.season; endSeason(st); }
  const f = st.rivals.find(r => r.id === 26); assert.ok(f, '마그누스 졸업 뒤 근위대 정예');
  assert.ok(st.contracts.some(c => c.starBet && c.rivalId === 26 && c.size === 3), '최종전이 바로 공고벽에 걸린다');
  assert.ok(f!.roster.every(g => g.type === 'murmillo' && g.status === 'rudiarius'), '근위병은 군단병(무르밀로 근사)·자유민');
});
