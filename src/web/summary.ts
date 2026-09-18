// 시즌 정산·후계·게임 종료 화면
import { S } from './state.js';
import { ACTION_KO, TRAIN_KO, EVENT_KEYS, EVENT_KO, healCostOf, newGame, score, seasonName, succeed, successorOptions, type FightReport } from '../core/game.js';
import { CONFIG } from '../core/config.js';
import { type Gladiator } from '../core/types.js';
import { HOST_KO } from '../core/contracts.js';
import { h } from './dom.js';
import { clearSave, render, tabbar } from './main.js';
import { portrait } from './portrait.js';
import { gladCard, CARD_PORTRAIT } from './gcard.js';
import { arenaIcon } from './scenes.js';
import { coach } from './header.js';
import { camFor, lanista, restX } from './town.js';

// ── 후계: 은퇴한 라니스타의 뒤를 이을 사람을 고른다
export function renderSuccession(): Node {
  const opts = successorOptions(S.st);
  return h('div', { class: 'overlay' }, h('div', { class: 'modal' },
    h('h2', {}, `${S.st.lanista.name} ${S.st.lanista.dead ? '사망' : '은퇴'}`, h('span', { class: 'hint', style: 'margin-left:10px;font-weight:400' }, `${S.st.lanista.age}세 · 후계자를 정하십시오`)),
    h('div', { class: 'hint', style: 'margin-bottom:8px' }, `자금·검투사·시설은 그대로 잇고, 호감도는 ${Math.round(CONFIG.lanista.fameKeep * 100)}%에 후계자의 명예 일부가 더해집니다. 독토르가 이으면 검투사 명단에서 빠집니다.`),
    ...opts.map(o => h('div', { class: 'card', onclick: () => { succeed(S.st, o); S.notice = `${S.st.lanista.name} 이(가) 루두스를 이어받았습니다.`; render(); } },
      o.from ? portrait(o.from, 56) : h('div', { class: 'portrait', style: 'width:56px;height:56px;display:flex;align-items:center;justify-content:center;font-size:22px' }, '⚖'),
      h('div', { class: 'grow' }, h('div', {}, h('b', {}, o.label), o.from ? h('span', { class: 'meta' }, ` ${o.from.age ?? '?'}세`) : null), h('div', { class: 'meta' }, o.desc), o.from ? h('div', { class: 'meta' }, `명예 ${o.from.honor ?? 0} → 호감도 계승 +${Math.round((o.from.honor ?? 0) * CONFIG.lanista.fameFromHonor)}`) : null),
      h('button', { class: 'primary' }, '승계')))));
}
export function renderSummary() {
  const sum = S.seasonSummary!;
  const W = S.seasonReports.filter(r => r.winner === 'A').length, L = S.seasonReports.filter(r => r.winner === 'B').length, D = S.seasonReports.filter(r => r.winner === 'draw').length;
  const salary = S.seasonReports.reduce((a, r) => a + r.salary, 0);
  const betLoss = S.seasonReports.reduce((a, r) => a + (r.bet && !r.bet.won ? r.bet.amount : 0), 0);
  const rent = S.seasonReports.reduce((a, r) => a + r.rent, 0), expense = S.seasonReports.reduce((a, r) => a + r.expense, 0), prize = S.seasonReports.reduce((a, r) => a + r.prize, 0), comp = S.seasonReports.reduce((a, r) => a + r.compensation, 0);
  const evHeld = EVENT_KEYS.filter(k => sum.events[k]); const evCost = evHeld.reduce((a, k) => a + CONFIG.events[k].cost, 0); const evFame = (sum.events.cena ? CONFIG.events.cena.fame : 0) + (sum.events.pompa ? CONFIG.events.pompa.fame : 0) + (sum.events.guests ? CONFIG.events.guests.fame : 0);
  const net = S.st.money - sum.before;
  const fameFights = S.seasonReports.reduce((a, r) => a + r.fameDelta, 0);
  const money = (label: string, v: number, sign: 1 | -1 = 1) => h('div', { class: 'mrow' }, h('span', {}, label), h('span', { class: v ? (sign > 0 ? 'plus' : 'minus') : '' }, `${sign > 0 ? '+' : '−'}${Math.abs(v).toLocaleString()}`));
  const fline = (text: string, tone: 'bad' | 'good' | 'grave' | 'plain' = 'plain') => h('span', { class: `fline ${tone}` }, text); // 정산도 칩 대신 문장으로 (2026-09-17 사용자)
  const fateOf = (r: FightReport, g: Gladiator) => { const f = r.fates.find(x => x.g.id === g.id); const downed = r.downed.some(d => d.id === g.id); const won = r.winner === 'A';
    return f?.fate === 'dead' ? fline(f.wound ? '그 자리에서 숨졌다' : '관중의 뜻으로 처형됐다', 'grave') : f?.fate === 'injured' ? fline(g.injured >= 3 ? '크게 다쳐 눕는다' : '다쳐서 쉰다', 'bad') : downed ? fline(won ? '쓰러졌으나 걸어 나왔다' : '미테! 관중이 살렸다', 'bad') : fline('무사하다'); };
  const nameOf = (r: FightReport, id: number) => [...r.team, ...r.contract.enemy].find(g => g.id === id)?.name.replace('(적)', '') ?? '누군가';
  const turnOf = (r: FightReport) => { const last = [...r.events].reverse().find(e => e.kind === 'attack' && e.downed); if (last?.open) return `${nameOf(r, last.target!)}의 빈틈이 승부를 갈랐다.`; if (last?.crit) return `${nameOf(r, last.actor)}의 치명타가 갑주 틈을 찔렀다.`; const st = r.events.find(e => e.kind === 'stumble'); return st ? `${nameOf(r, st.actor)}이(가) 먼저 헛디뎠다.` : r.log.slice(-1)[0] ?? '짧은 경기였다.'; };
  // 경기 카드
  const games = S.seasonReports.map(r => { const gnet = r.rent - r.expense + r.prize + r.compensation - (r.bet && !r.bet.won ? r.bet.amount : 0), harm = r.fates.filter(f => f.fate === 'dead' || f.fate === 'injured');
    return h('div', { class: `gamecard ${r.winner === 'A' ? 'win' : r.winner === 'B' ? 'lose' : 'draw'}` },
    h('div', { class: 'ghead' }, arenaIcon(r.contract.tier), h('div', { class: 'grow' },
      h('div', {}, h('b', { class: r.winner === 'A' ? 'plus' : r.winner === 'B' ? 'minus' : '' }, r.winner === 'A' ? '승리' : r.winner === 'B' ? '패배' : '무승부'), ` · 등급 ${r.contract.tier} ${r.contract.venue} `, h('span', { class: 'size' }, `${r.contract.size}대${r.contract.size}`), ' · ', h('span', { class: 'meta' }, HOST_KO[r.contract.host]), r.classic ? h('span', { class: 'syn classic', style: 'margin-left:6px' }, '전통 짝') : null),
      h('div', { class: 'meta' }, `수지 ${gnet >= 0 ? '+' : '−'}${Math.abs(gnet).toLocaleString()} HS · 호감도 ${r.fameDelta >= 0 ? '+' : ''}${r.fameDelta}${harm.length ? ` · 피해 ${harm.length}` : ''}`),
      h('div', { class: 'turnline' }, turnOf(r)))),
    h('div', { class: 'grow2' }, ...r.team.map(g => gladCard(g, { size: CARD_PORTRAIT, cls: 'small', rows: [h('div', {}, fateOf(r, g), r.promoted.includes(g) ? fline(' · 베테라누스로 승급', 'good') : null)] })))); }); /* 정산도 공통 검투사 카드 (2026-09-17 사용자) */
  // 로스터 변화
  const dead = S.seasonReports.flatMap(r => r.fates.filter(f => f.fate === 'dead').map(f => f.g));
  const injuredNow = S.st.roster.filter(g => g.injured > 0);
  const tired = S.st.roster.filter(g => (g.fatigue ?? 0) >= 2);
  const promoted = S.seasonReports.flatMap(r => r.promoted);
  const rosterItems: Node[] = [];
  if (promoted.length) rosterItems.push(h('div', { class: 'ditem todo' }, h('span', { class: 'dot' }), h('span', {}, `승급: ${promoted.map(g => g.name).join(', ')} → 베테라누스`)));
  { const ne = S.seasonReports.flatMap(r => r.newEpithets); if (ne.length) rosterItems.push(h('div', { class: 'ditem todo' }, h('span', { class: 'dot' }), h('span', {}, `별칭: ${ne.map(x => `${x.g.name} '${x.e.name}' (${x.e.effect})`).join(', ')}`))); }
  { const freed = S.seasonReports.flatMap(r => r.rudis); if (freed.length) rosterItems.push(h('div', { class: 'ditem todo' }, h('span', { class: 'dot' }), h('span', {}, `루디스: ${freed.map(g => g.name).join(', ')} — 자유민이 됐습니다. 관리 화면에서 독토르 고용 또는 계속 출전을 정하세요.`))); }
  if (sum.trained.length) rosterItems.push(h('div', { class: 'ditem todo' }, h('span', { class: 'dot' }), h('span', {}, `훈련: ${sum.trained.map(t => `${t.g.name} ${TRAIN_KO[t.stat]} +${t.gain}`).join(', ')}`)));
  if (S.st.lastLeft?.length) rosterItems.push(h('div', { class: 'ditem warn' }, h('span', { class: 'dot' }), h('span', {}, `계약 만료로 떠남: ${S.st.lastLeft.join(', ')}`)));
  if (S.st.lastOverwork?.length) rosterItems.push(h('div', { class: 'ditem warn' }, h('span', { class: 'dot' }), h('span', {}, `혹사 끝에 쓰러져 죽음: ${S.st.lastOverwork.join(', ')} — 피로가 쌓인 채 시즌을 넘겼다`)));
  if (S.st.lastFreed?.length) rosterItems.push(h('div', { class: 'ditem todo' }, h('span', { class: 'dot' }), h('span', {}, `형기 만료: ${S.st.lastFreed.join(', ')} — 자유민이 됐습니다 (독토르 고용 또는 급료 출전)`)));
  if (sum.acted.length) rosterItems.push(h('div', { class: 'ditem todo' }, h('span', { class: 'dot' }), h('span', {}, `행동: ${sum.acted.map(a => `${a.g.name} ${ACTION_KO[a.act]} (${a.note})`).join(', ')}`)));
  if (injuredNow.length) rosterItems.push(h('div', { class: 'ditem warn' }, h('span', { class: 'dot' }), h('span', {}, `부상 회복 중: ${injuredNow.map(g => `${g.name} (${g.injured}시즌)`).join(', ')} — 치료 ${healCostOf(S.st)} HS 로 바로 복귀 가능`)));
  if (tired.length) rosterItems.push(h('div', { class: 'ditem warn' }, h('span', { class: 'dot' }), h('span', {}, `피로 누적: ${tired.map(g => `${g.name} (피로 ${g.fatigue})`).join(', ')} — 한 시즌 쉬게 할 것`)));
  if (dead.length) rosterItems.push(h('div', { class: 'ditem warn' }, h('span', { class: 'dot' }), h('span', {}, `묘비에 새 이름: ${dead.map(g => `${g.name} ${g.wins}승/${g.fights}전`).join(', ')} — 관중은 침묵했다`)));
  if (evHeld.length) rosterItems.push(h('div', { class: 'ditem todo' }, h('span', { class: 'dot' }), h('span', {}, `행사: ${evHeld.map(k => EVENT_KO[k]).join(', ')} — 출전 검투사 명예·호감도 상승`)));
  if (!rosterItems.length) rosterItems.push(h('div', { class: 'ditem idle' }, h('span', { class: 'dot' }), h('span', {}, '로스터 변화 없음')));
  // 다음 시즌 예고는 뺐다: 새 계약·매물·유지비는 다음 시즌에 들어가서 본다
  return h('div', {}, coach(),
    h('div', { class: 'panel', style: 'margin-bottom:10px' }, h('h2', {}, `${sum.label} 정산`, h('span', { class: 'hint', style: 'text-transform:none;letter-spacing:0;margin-left:8px' }, `경기 ${S.seasonReports.length}회 · ${W}승 ${L}패 ${D}무`)),
      S.seasonReports.length ? h('div', { class: 'games' }, ...games) : h('div', { class: 'hint' }, '이번 시즌 경기 없음'),
      sum.skipped.length ? h('div', { class: 'hint', style: 'margin-top:4px' }, `무산된 계약 (앞 경기 부상·사망): ${sum.skipped.map(c => c.venue).join(', ')}`) : null),
    h('div', { class: 'cols' },
      h('div', { class: 'panel' }, h('div', { class: 'cols2' }, h('div', {}, h('h2', {}, '자금'),
        h('div', { class: 'mtable', style: 'border-top:none;padding-top:0;margin-top:0' }, money('대여료', rent), money('출전 경비', expense, -1), money('승리 상금', prize), betLoss ? money('내기 패배', betLoss, -1) : null, money('사망 배상금', comp), salary ? money('자유민 급료', salary, -1) : null, evCost ? money('시즌 행사', evCost, -1) : null, sum.gift ? money('귀족 사례금', sum.gift) : null, money('유지비·급료', sum.upkeep, -1),
          h('div', { class: 'mrow total' }, h('span', {}, '시즌 순수지'), h('span', { class: net >= 0 ? 'plus' : 'minus' }, `${net >= 0 ? '+' : '−'}${Math.abs(net).toLocaleString()} HS`)),
          h('div', { class: 'mrow', style: 'grid-column:1 / -1' }, h('span', {}, '잔액'), h('span', {}, `${sum.before.toLocaleString()} → ${S.st.money.toLocaleString()} HS`))),
        ), h('div', {}, h('h2', {}, '호감도'),
        h('div', { class: 'mtable', style: 'border-top:none;padding-top:0;margin-top:0' }, money('경기', fameFights, fameFights >= 0 ? 1 : -1), money('거절', Math.abs(sum.refused), sum.refused < 0 ? -1 : 1), money('망각', 1, -1), money('출전 활동', S.seasonReports.length ? CONFIG.fameDelta.active : 0), evFame ? money('행사', evFame) : null,
          h('div', { class: 'mrow total' }, h('span', {}, '호감도'), h('span', {}, `${sum.fameBefore} → ${S.st.fame}`)))))),
      h('div', {}, h('div', { class: 'panel', style: 'margin-bottom:10px' }, h('h2', {}, '로스터'), ...rosterItems),
        null)),
    tabbar([{ label: `다음 시즌 (${seasonName(S.st.season)})`, primary: true, onclick: () => { S.phase = 'manage'; S.view = 'ludus'; S.cellsOpen = false; S.camPan = 0; if (!lanista.walking) { lanista.x = restX('ludus'); lanista.target = lanista.x; S.camX = camFor('ludus'); S.camV = 0; } render(); } }])); // 새 시즌은 정문에서 시작
}
export function renderOver() {
  return h('div', { class: 'panel' }, h('h2', {}, '게임 종료'),
    h('p', {}, `${S.st.reason}. 최종 점수 ${score(S.st).toLocaleString()} (자금 + 검투사 매각가 + 호감도×100)`),
    h('div', { class: 'grave' }, S.st.graveyard.length ? '묘비: ' + S.st.graveyard.map(g => `${g.name} ${g.wins}승/${g.fights}전`).join(' · ') : '사망자 없음'),
    S.st.lineageLog?.length ? h('div', { class: 'grave' }, '역대 라니스타: ' + S.st.lineageLog.join(' → ') + ` → ${S.st.lanista.name}`) : null,
    h('div', { class: 'log', style: 'margin-top:8px;max-height:300px' }, S.st.history.join('\n')),
    h('div', { class: 'actions' }, h('button', { class: 'primary', onclick: () => { clearSave(); S.setup = { color: S.st.color ?? 'caeruleum' }; S.phase = 'manage'; S.assign = {}; S.trainPlan = {}; S.townCanvas = null; S.view = 'ludus'; render(); } }, '새 게임')));
}
