// 개인 사건과 서브 스토리 문턱 (docs/08 6절, 8차 플레이테스트 15번: 중반 정체 구간을 사건으로 채운다). 화면 의존성 없음 — 결과는 st.notices(이번 시즌 대시보드 한 줄)와 history 에 남긴다
import type { GameState } from './game.js';
import type { Contract, Gladiator, BattleEvent } from './types.js';
import { seasonName, refuseRudis } from './game.js';

const has = (st: GameState, name: string) => st.roster.find(g => g.alive && g.name === name && g.castId == null); // 이야기 인물(간판·얼굴)은 명부 id 가 없다
const once = (st: GameState, key: string): boolean => { const f = (st.flags ??= {}); if (f[key]) return false; f[key] = st.season; return true; };
const note = (st: GameState, text: string) => { (st.notices ??= []).push(text); st.history.push(`${seasonName(st.season)}: ${text}`); };

// 시즌 시작: 호감도 문턱(라니스타 루크리오의 야망 — 인파미스가 이름을 사는 과정), 켈라두스·크레스켄스 짝
export function storySeasonStart(st: GameState) {
  st.notices = [];
  if (st.region === 'campania') {
    if (st.season === 1) for (const t of [25, 40, 60, 80]) if (st.fame >= t) once(st, `fame${t}`); // 시작부터 넘어 있는 문턱은 사건이 아니다
    if (st.season === 1 && once(st, 'intro')) note(st, `${st.lanista.name}: 옛 주인 집안의 검투사단을 샀다. 인파미스라 손가락질받아도 좋다 — 이 도시의 파밀리아를 모두 꺾고 로마로 간다.`);
    if (st.fame >= 25 && once(st, 'fame25')) note(st, '이름이 알려지기 시작했다. 벽에 우리 루두스의 낙서가 처음 보인다 — 큰 지방 경기(등급 2)가 열린다.');
    if (st.fame >= 40 && once(st, 'fame40')) note(st, '귀족들이 초대에 응하기 시작했다. 얼마 전까지는 인파미스라며 문전박대였다.');
    if (st.fame >= 60 && once(st, 'fame60')) note(st, '큰 경기 주최자가 우리 검투사를 찾는다. 로마 경기의 단골 파밀리아와도 붙을 때다.');
    if (st.fame >= 80 && once(st, 'fame80')) note(st, '로마에서도 우리 루두스의 소문이 돈다고 한다. 황제 루두스의 사절이 이 도시에 온다는 말이 있다.');
  } else if (st.season === 1 && once(st, 'roma-intro')) note(st, `${st.lanista.name}: 로마다. 직영 루두스는 격이 다르다. 황제의 눈에 들면 금반지 — 인파미스를 벗는다.`);
  const cel = has(st, '켈라두스'), cre = has(st, '크레스켄스');
  if (cel && cre) { st.fame = Math.min(100, st.fame + 1); if (once(st, 'pair')) note(st, `켈라두스와 크레스켄스가 한 루두스에 — "소녀들의 한숨"과 "밤의 소녀들의 의사"가 나란히 서자 벽마다 낙서가 는다 (짝이 함께 있는 시즌마다 호감도 +1).`); }
}

// 경기 뒤: 아틸리우스–힐라루스(폼페이 낙서의 대결), 살려 준 자에게 죽음(우르비쿠스의 경고), 플람마의 루디스 거절
export function storyAfterFight(st: GameState, c: Contract, team: Gladiator[], events: BattleEvent[], downedB: Gladiator[], deadMine: Gladiator[], rudis: Gladiator[]) {
  const att = team.find(g => g.name === '아틸리우스' && g.castId == null), hil = c.enemy.find(e => e.name === '힐라루스');
  if (att && hil && att.alive && downedB.some(d => d.id === hil.id)) { att.honor = Math.min(100, (att.honor ?? 0) + 10); st.fame = Math.min(100, st.fame + 3); note(st, `아틸리우스가 힐라루스를 꺾었다 — 폼페이 벽에 그대로 새겨진 대결이 다시 벌어졌다 (명예 +10, 호감도 +3).`); }
  for (const g of deadMine) { const ev = [...events].reverse().find(e => e.kind === 'attack' && e.downed && e.target === g.id); const killer = ev && c.enemy.find(e => e.id === ev.actor); if (killer && (g.spared ?? []).includes(killer.id)) note(st, `${g.name} 은(는) 전에 살려 준 ${killer.name} 의 손에 죽었다 — 우르비쿠스의 경고: "네가 꺾은 자는 누구든 죽여라".`); }
  for (const g of rudis) if (g.name === '플람마' && g.castId == null) { refuseRudis(st, g); const n = g.rudisRefused ?? 1; note(st, n >= 4 ? `플람마가 네 번째 루디스를 거절했다. 이제 그는 모래 위에서만 살 것이다 (시칠리아 묘비: 34전, 루디스 4회 거절).` : `플람마가 루디스를 거절했다 (${n}번째). "나무 검은 필요 없다."`); }
}
