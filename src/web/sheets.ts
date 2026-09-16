// 시트(시설·독토르·파밀리아·소식·지원자·규칙)와 대시보드 항목
import { S } from './state.js';
import { EVENT_KEYS, EVENT_KO, ORIGIN_KO, available, backToArena, buy, canRetire, deserialize, doctorFor, facilityUpkeep, gymBonus, healCostOf, hireDoctor, inBed, injurySeasons, mortality, newGame, palusTrainees, priceOf, recordVsMe, release, retire, rivalStar, rosterCap, seasonName, serialize, trainCap, trainGain, type Facility, type SeasonEvents, upgrade, upgradeCost, upkeepOf } from '../core/game.js';
import { type Gladiator } from '../core/types.js';
import { LINEAGE_KO, TYPE_KO } from '../core/gladiator.js';
import { CONFIG } from '../core/config.js';
import { SKILLS, SKILL_NAME, skillsOf } from '../core/skills.js';
import { EPITHETS, EPITHET_BY_ID, type EpithetId } from '../core/epithets.js';
import { setSoundEnabled, sfx, soundEnabled, unlockAudio } from './sound.js';
import { rivalDef } from '../core/rivals.js';
import { FANS_STAR, HOST } from '../core/hosts.js';
import { View, clearSave, render } from './main.js';
import { ask, h, helpBtn, hintSpan, sq, tell } from './dom.js';
import { gladCard, gladSheet } from './detail.js';
import { cellPanel } from './cells.js';
import { TYPE_COLOR, glyphSvg, portrait } from './portrait.js';

// 시트 닫기: 아래로 내려가는 동작 뒤에 지운다 (켈라가 내려가듯)
function closeSheet() {
  const ov = document.querySelector('.overlay.sheet'); if (!ov) { S.sheet = null; render(); return; }
  ov.classList.add('closing'); window.setTimeout(() => { S.sheet = null; render(); }, 300);
}
export function renderSheetBody(): (Node | null)[] {
  return S.sheet === 'help' ? [h('h2', {}, '시너지 · 규칙'), renderHelp()]
    : S.sheet === 'glad' ? [gladSheet()]
    : S.sheet === 'facilities' ? [facilitiesPanel()]
    : S.sheet === 'doctors' ? [doctorsPanel()]
    : S.sheet === 'chronicle' ? [chroniclePanel()]
    : S.sheet === 'rivals' ? [rivalsPanel()]
    : S.sheet === 'events' ? [eventsPanel()]
    : S.sheet === 'news' ? [h('div', { class: 'panel' }, h('h2', {}, '소식', hintSpan(`${seasonName(S.st.season)} · ${S.st.money.toLocaleString()} HS`)), ...renderDash('ludus', true).slice(1))]
    : S.sheet === 'market' ? [h('div', { class: 'panel' }, h('h2', {}, '노예 시장'), ...renderDash('market').slice(1))]
    : S.sheet === 'medic' ? [h('div', { class: 'panel' }, h('h2', {}, '의무실'), ...renderDash('medic').slice(1))]
    : S.sheet === 'yard' ? [h('div', { class: 'panel' }, h('h2', {}, '훈련소'), ...renderDash('yard').slice(1))]
    : S.sheet === 'applicants' ? [applicantsPanel() ?? h('div', { class: 'panel' }, h('h2', {}, '문 앞의 지원자'), h('div', { class: 'hint' }, '지금은 지원자가 없습니다.'))]
    : S.sheet === 'cell' ? [cellPanel(S.cellSel)]
    : [menuPanel()];
}
export function renderSheet(): Node {
  if (S.sheet === 'menu') { // 메뉴는 헤더의 톱니바퀴 아래로 내려온다 (아래서 올라오는 시트가 아니라)
    const g = document.querySelector('header .gear')?.getBoundingClientRect(), sr = document.getElementById('stage')?.getBoundingClientRect(); const sk = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--stage-k')) || 1; // 메뉴는 무대(#stage, 배율 sk) 안에 붙으므로 화면 px 를 무대 좌표로 바꿔야 한다 — 안 그러면 배율만큼 어긋난다
    const top = g && sr ? (g.bottom - sr.top) / sk + 6 : 56, right = g && sr ? Math.max(8, (sr.right - g.right) / sk) : 8;
    return h('div', { class: 'overlay clear', onclick: (ev: Event) => { if (ev.target === ev.currentTarget) { S.sheet = null; render(); } } },
      h('div', { class: 'dropmenu', style: `top:${top}px;right:${right}px` }, menuPanel()));
  }
  const body = renderSheetBody();
  // 머리(제목·닫기)는 고정, 몸통만 스크롤. 제목은 본문 패널의 h2 를 그대로 끌어올린다 (배지·정렬·설명 아이콘 포함)
  const nodes = body.filter((n): n is Node => !!n);
  let h2: Element | null = null;
  for (const n of [...nodes].reverse()) { if (n instanceof HTMLElement) { h2 = n.tagName === 'H2' ? n : n.querySelector('h2'); if (h2) break; } }
  const head = h('div', { class: 'sheethead' }, h2 ?? h('h2', {}, ''), h('button', { class: 'xclose', title: '닫기', onclick: closeSheet }, '✕'));
  return h('div', { class: 'overlay sheet', onclick: (ev: Event) => { if (ev.target === ev.currentTarget) closeSheet(); } },
    h('div', { class: 'modal' }, head, h('div', { class: 'sheetbody' }, ...nodes.filter(n => n !== h2))));
}
// 독토르 시트: 고용한 교관(유형·기준 능력치·기술 전수·제자와 보너스)과 고용할 수 있는 자유민
function doctorsPanel(): Node {
  const docs = S.st.roster.filter(g => g.status === 'doctor'), free = S.st.roster.filter(g => g.status === 'rudiarius');
  const docCard = (d: Gladiator) => { const pupils = S.st.roster.filter(g => g !== d && g.type === d.type && g.status !== 'doctor');
    return h('div', { class: 'card' }, portrait(d, 56),
      h('div', { class: 'grow' },
        h('div', {}, h('span', { class: 'badge doc' }, '독토르'), h('b', {}, d.name), h('span', { class: 'meta' }, ` ${TYPE_KO[d.type]} · ${d.age ?? '?'}세 · ${d.wins}승/${d.fights}전`), d.wins >= CONFIG.doctorSkillWins ? h('span', { class: 'badge mentor', style: 'margin-left:6px' }, '기술 전수') : null),
        h('div', { class: 'meta' }, `기준 공 ${d.base.atk} · 방 ${d.base.def} · 급료 ${CONFIG.doctorSalary}/시즌 · 가르칠 기술: ${skillsOf(d).length ? skillsOf(d).map(SKILL_NAME).join('·') : '없음 (현역 때 익힌 기술이 없다)'}`),
        h('div', { class: 'meta' }, pupils.length ? '제자: ' + pupils.map(g => `${g.name} (공 +${trainGain(S.st, g, 'atk') - 1 - gymBonus(S.st)}·방 +${trainGain(S.st, g, 'def') - 1 - gymBonus(S.st)})`).join(', ') : `같은 유형(${TYPE_KO[d.type]}) 제자가 없습니다`)),
      h('button', { onclick: () => { backToArena(S.st, d); render(); } }, '다시 출전'),
      h('button', { onclick: () => { void ask(`${d.name} 을(를) 루두스에서 내보냅니까?`, { ok: '내보내기' }).then(ok => { if (ok) { release(S.st, d); render(); } }); } }, '내보내기')); };
  const freeCard = (g: Gladiator) => h('div', { class: 'card' }, portrait(g, 56),
    h('div', { class: 'grow' }, h('div', {}, h('span', { class: 'badge free' }, '자유민'), h('b', {}, g.name), h('span', { class: 'meta' }, ` ${TYPE_KO[g.type]} · ${g.wins}승/${g.fights}전`)), h('div', { class: 'meta' }, `공 ${g.base.atk} · 방 ${g.base.def}${doctorFor(S.st, g.type) ? ` · ${TYPE_KO[g.type]} 독토르 이미 있음` : ''}`)),
    h('button', { class: 'primary', title: `${g.name} 에게 독토르 자리를 제안한다. 시즌 급료 ${CONFIG.doctorSalary} HS`, onclick: () => { hireDoctor(S.st, g); S.notice = `${g.name} 이(가) 독토르 제안을 받아들였다`; render(); } }, `독토르 제안 ${CONFIG.doctorSalary}/시즌`));
  return h('div', { class: 'panel' }, h('h2', {}, '독토르', helpBtn('독토르', `루디스를 받은 자유민을 교관으로 고용합니다. 출전하지 않고 시즌 급료 ${CONFIG.doctorSalary} HS. 같은 유형 훈련에서 독토르의 능력치가 훈련생보다 ${CONFIG.doctorBonus.gapSmall} 이상 높으면 +1, ${CONFIG.doctorBonus.gapBig} 이상이면 +2. ${CONFIG.doctorSkillWins}승 이상이면 유형 기술을 전수합니다. 비문의 doctor secutorum·myrmillonum 처럼 무장별로 한 명씩 두는 것이 자연스럽습니다. 독토르는 라니스타의 후계자 후보가 됩니다.`)),
    ...docs.map(docCard), docs.length ? null : h('div', { class: 'hint', style: 'margin-bottom:8px' }, '고용한 독토르가 없습니다.'),
    free.length ? h('h3', { class: 'sub' }, '고용할 수 있는 자유민') : null, ...free.map(freeCard),
    !docs.length && !free.length ? h('div', { class: 'hint' }, `검투사가 ${CONFIG.rudis.wins}승에 이르면 루디스(자유)를 받을 수 있고, 그 자유민을 독토르로 고용합니다.`) : null);
}
// 연대기: 역대 라니스타 · 명예의 전당(루디스) · 묘비 · 최근 연혁
// 연혁 중 '특별한 일'만: 일상 기록(구매·매각·훈련·시범·요양·재계약·시설·매 경기 결과)은 뺀다
const ROUTINE = /( 매각 \d| 훈련\(| 기술 훈련 | 시범 \(| 요양$| 재계약 \d| 대여 \d| 번 칸 \d|: (켈라|숙소|침상|의술|약재|조리장|팔루스|훈련 시설|증축|공개 만찬|행렬|네메시스 봉헌|벽화 광고|귀족 손님)[^:]* \d+$)/;
const isSpecialEvent = (l: string) => !ROUTINE.test(l);
function chroniclePanel(): Node {
  const hall = [...(S.st.hall ?? [])].reverse(), dead = [...S.st.graveyard].reverse(), log = [...S.st.history].reverse().filter(isSpecialEvent); // 특별한 일은 전부 (최근이 위)
  const sec = (title: string, hint: string, kids: (Node | null)[]) => h('div', { class: 'chsec' }, h('h3', { class: 'sub' }, title, hintSpan(hint)), ...(kids.length ? kids : [h('div', { class: 'hint' }, '아직 없음')]));
  const lanistas = [...(S.st.lineageLog ?? []).map(l => h('div', { class: 'drow' }, h('span', { class: 'meta' }, '⚖'), ' ', h('span', {}, l))), h('div', { class: 'drow sel' }, h('span', { class: 'meta' }, '⚖'), ' ', h('b', {}, S.st.lanista.name), h('span', { class: 'meta' }, ` ${S.st.lanista.age}세 · ${S.st.lanista.since}번째 시즌부터 · ${S.st.lanista.trait === 'doctor' ? '전직 독토르' : S.st.lanista.trait === 'freedman' ? '해방노예' : '창업자'}`))];
  return h('div', { class: 'panel' }, h('h2', {}, '연대기', helpBtn('연대기', '루두스의 역사입니다. 역대 라니스타는 은퇴·사망으로 물려준 순서, 명예의 전당은 루디스(나무 검)로 자유를 얻은 검투사, 묘비는 경기장에서 죽은 검투사입니다. 폼페이 낙서와 묘비처럼 이름·전적·별칭이 남습니다.')),
    sec('역대 라니스타', `${(S.st.lineageLog?.length ?? 0) + 1}대`, lanistas),
    sec('명예의 전당', `루디스 ${hall.length}`, hall.map(e => h('div', { class: 'drow' }, sq(e.type), ' ', h('b', {}, e.name), h('span', { class: 'meta' }, ` ${TYPE_KO[e.type]} · ${e.wins}승/${e.fights}전 · 명예 ${e.honor} · ${seasonName(e.season)}${e.how === 'damnatus' ? ' · 형기 만료' : e.how === 'refused' ? ' · 루디스 거절' : ''}`), ...e.epithets.map(id => { const ep = EPITHET_BY_ID[id as EpithetId]; return ep ? h('span', { class: 'badge epithet', style: 'margin-left:4px' }, ep.name) : null; }), ...(e.skills ?? []).map(id => h('span', { class: 'badge skill', style: 'margin-left:4px' }, SKILL_NAME(id)))))),
    sec('묘비', `${dead.length}명`, dead.map(g => h('div', { class: 'drow' }, sq(g.type), ' ', h('b', {}, g.name), h('span', { class: 'meta' }, ` ${TYPE_KO[g.type]} · ${g.wins}승/${g.fights}전${g.age ? ` · ${g.age}세` : ''} — 관중은 침묵했다`)))),
    sec('연혁', `특별한 일 ${log.length}건`, log.map(l => h('div', { class: 'meta', style: 'padding:2px 0' }, l))));
}
function menuPanel(): Node {
  return h('div', {}, h('div', { class: 'menulist' },
    canRetire(S.st) && !S.st.pendingSuccession && S.phase === 'manage' ? h('button', { title: `${CONFIG.lanista.voluntaryAge}세(세니오레스)부터 자발적으로 물러나 후계자에게 넘길 수 있습니다`, onclick: () => { void ask(`${S.st.lanista.name} (${S.st.lanista.age}세) 이(가) 은퇴하고 후계자를 정합니까?`, { ok: '은퇴' }).then(ok => { if (ok) { S.sheet = null; retire(S.st); render(); } }); } }, `은퇴 (${S.st.lanista.age}세, 후계자에게 넘김)`) : null,
    h('label', { class: 'toggle' }, h('span', { class: 'grow' }, '효과음'), h('input', { type: 'checkbox', checked: soundEnabled() ? 'checked' : undefined, onchange: (e: Event) => { setSoundEnabled((e.target as HTMLInputElement).checked); if (soundEnabled()) { unlockAudio(); sfx.coin(); } render(); } }), h('span', { class: 'knob' })), // 켜짐/꺼짐이 한눈에 보이는 스위치
    h('button', { onclick: () => { S.sheet = 'help'; render(); } }, '시너지 · 규칙'),
    h('button', { onclick: () => { // 저장을 파일로 내려받기 (다른 기기·브라우저에서 이어가기)
      const blob = new Blob([JSON.stringify(serialize(S.st))], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `mitte-save-${S.st.lanista.name.split(' ').pop()}-${S.st.season}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); } }, '저장 파일로 내려받기'),
    h('button', { onclick: () => { const inp = h('input', { type: 'file', accept: '.json,application/json' }) as HTMLInputElement;
      inp.onchange = () => { const f = inp.files?.[0]; if (!f) return; f.text().then(txt => { try { const next = deserialize(JSON.parse(txt)); void ask(`${next.lanista.name} ${next.season}번째 시즌 저장을 불러옵니다. 지금 게임은 덮어씁니다.`, { ok: '불러오기' }).then(ok => { if (!ok) return; S.st = next; S.phase = 'manage'; S.sheet = null; S.assign = {}; S.trainPlan = {}; S.townCanvas = null; S.view = 'ludus'; S.cellsOpen = false; S.notice = '저장 파일을 불러왔습니다.'; render(); }); } catch { void tell('저장 파일을 읽을 수 없습니다.'); } }); };
      inp.click(); } }, '저장 파일 불러오기'),
    h('button', { onclick: () => { void ask('저장을 지우고 새 게임을 시작합니까?', { ok: '새 게임' }).then(ok => { if (!ok) return; clearSave(); S.setup = { color: S.st.color ?? 'caeruleum', types: [] }; S.phase = 'manage'; S.sheet = null; /* 새 게임도 설정 화면부터 */ S.assign = {}; S.trainPlan = {}; S.townCanvas = null; S.view = 'ludus'; render(); }); } }, '새 게임')));
}
  // 문 앞의 지원자 (자유민 아욱토라티): 계약금으로 데려온다
function applicantsPanel(): Node | null {
  if (!S.st.applicants.length) return null;
    const full = S.st.roster.length >= rosterCap(S.st);
    return (h('div', { class: 'panel', style: 'margin-bottom:10px' }, h('h2', {}, '문 앞의 지원자', helpBtn('자유민 지원자 (아욱토라티)', `자유민 검투사가 스스로 계약을 청합니다. 계약금만 내면 되고, 출전마다 대여료의 ${Math.round(CONFIG.rudiariusShare * 100)}%를 급료로 받으며 ${CONFIG.origins.auctoratus.term}시즌 계약입니다. 자유민이라 팔 수 없고 사망 배상도 없습니다. 이번 시즌이 지나면 떠납니다.`)),
      h('div', { class: 'cardgrid' }, ...S.st.applicants.map(g => gladCard(g, [
        h('button', { class: 'primary', disabled: S.st.money < g.buyPrice || full, title: full ? '켈라이 가득 찼습니다' : '', onclick: () => { if (buy(S.st, g)) { sfx.coin(); render(); } } }, `계약 ${g.buyPrice.toLocaleString()}`)])))));
}
  // 루두스 시설: 세 건물 × 세부 항목. 모든 항목이 유한 단계 (장기 지출처)
// 시설 행 (이름 · 단계 · 효과 · 강화 버튼). 시설 시트와 의무실·훈련소 대시보드가 같이 쓴다
export const canPayFac = (cost: number) => S.st.money - cost >= upkeepOf(S.st); // 다음 시즌 유지비는 남겨 둔다
 // 다음 시즌 유지비는 남겨 둔다
function facBtn(f: Facility, idx = 0): Node { const cost = upgradeCost(S.st, f, idx); return cost != null ? h('button', { disabled: !canPayFac(cost), title: !canPayFac(cost) && S.st.money >= cost ? `유지비 ${upkeepOf(S.st).toLocaleString()} HS 를 남기려면 자금이 더 필요합니다` : '', onclick: () => { if (upgrade(S.st, f, idx)) { sfx.coin(); render(); } } }, `${cost.toLocaleString()}`) : h('span', { class: 'hint' }, '최대'); }
function facRow(name: string, level: string, effect: string, f: Facility): Node { return h('div', { class: 'frow' }, h('div', { class: 'grow' }, h('b', {}, name), ' ', h('span', { class: 'meta' }, level), h('div', { class: 'meta' }, effect)), facBtn(f)); }
function facRows(group: 'cells' | 'medic' | 'yard'): Node[] {
  const medDesc = (lv: number) => { const M = CONFIG.ludus.medicine; const hc = M.healCostByLevel[Math.min(lv, M.healCostByLevel.length - 1)], ic = M.injuryChanceByLevel[Math.min(lv, M.injuryChanceByLevel.length - 1)]; return `부상 ${lv >= M.injuryAt ? 1 : 2}시즌 · 치료 ${hc} · 부상 ${Math.round(ic * 100)}%${lv >= M.fatigueRestAt ? ' · 피로 +1' : ''}`; }; // 의술 단계별 효과 한 줄
  const L = CONFIG.ludus, u = S.st.ludus;
  const nx = (f: Facility, cur: string, next: string) => upgradeCost(S.st, f) == null ? `${cur} · 최대` : `${cur} → ${next}`; // 지금 값 → 다음 단계 값 (최대치는 보이지 않는다)
  if (group === 'cells') return [facRow('켈라 증축', `${u.cells.length}칸`, nx('cells', `${u.cells.length}칸`, `${u.cells.length + L.cells.per}칸`), 'cells'), facRow('조리장', `${u.kitchen}단계`, nx('kitchen', `출전 HP +${u.kitchen * L.kitchen.hpPerLevel}`, `+${(u.kitchen + 1) * L.kitchen.hpPerLevel}`), 'kitchen')];
  if (group === 'medic') return [
    facRow('침상', `${u.beds}개`, `${nx('beds', `동시 회복 ${u.beds}명`, `${u.beds + 1}명`)} · 부상 ${S.st.roster.filter(g => g.injured > 0).length}명`, 'beds'),
    facRow('의술', `${u.medicine}단계`, nx('medicine', medDesc(u.medicine), medDesc(u.medicine + 1)), 'medicine'),
    facRow('약재', `${u.herbs}단계`, nx('herbs', `피로 면제 ${Math.round(u.herbs * L.herbs.skipFatiguePer * 100)}%`, `${Math.round((u.herbs + 1) * L.herbs.skipFatiguePer * 100)}%`), 'herbs')];
  return [facRow('팔루스', `${u.palus}개`, `${nx('palus', `훈련 자리 ${u.palus}`, `${u.palus + 1}`)} · 세운 검투사 ${palusTrainees(S.st).length}`, 'palus'), facRow('훈련 시설', `${u.gym}단계`, nx('gym', `훈련 폭 +${gymBonus(S.st)}`, `+${L.gym.bonusAt.filter(a => u.gym + 1 >= a).length}`), 'gym')];
}
function facilitiesPanel(): Node {
    const u = S.st.ludus;
    // 방(숙소 질) 강화는 켈라의 각 방 시트에서. 여기서는 증축·조리장·의무실·훈련장만
    return h('div', { class: 'panel' }, h('h2', {}, '루두스 시설', hintSpan(`켈라 ${u.cells.length} · 침상 ${u.beds} · 팔루스 ${u.palus} · 시설 유지비 ${facilityUpkeep(S.st).toLocaleString()}/시즌`), helpBtn('루두스 시설', '모든 시설은 단계가 정해져 있습니다.\n켈라: 칸 수 = 검투사 상한. 칸마다 숙소 질 ★1 휴식 피로 −2, ★2 유지비 −25%, ★3 명예 +1/시즌.\n조리장: 출전 HP +5/단계.\n의무실: 침상(모자라면 부상 +1시즌), 의술(2단계 부상 1시즌, 4단계 치료 250), 약재(피로 면제 20%/단계).\n훈련장: 팔루스 = 시즌당 훈련 인원, 훈련 시설 3·5단계에서 훈련 폭 +1.\n강화 버튼은 다음 시즌 유지비를 남길 수 있을 때만 켜집니다.')),
      h('div', { class: 'fgrid' },
        h('div', { class: 'fcol' }, h('h3', {}, '켈라 · 조리장'),
          ...facRows('cells')),
        h('div', { class: 'fcol' }, h('h3', {}, '의무실'),
          ...facRows('medic')),
        h('div', { class: 'fcol' }, h('h3', {}, '훈련장'),
          ...facRows('yard'))));
}
  // 상대 파밀리아 패널: 간판 검투사, 나와의 전적, 명단 요약
function rivalsPanel(): Node {
    return h('div', { class: 'panel' }, h('h2', {}, '상대 파밀리아', hintSpan(`${S.st.rivals.length}곳 · 이번 시즌 계약 상대 ${new Set(S.st.contracts.map(c => c.rivalId).filter(Boolean)).size}곳`)),
      h('div', { class: 'rivals' }, ...S.st.rivals.map(rv => { const star = rivalStar(rv); const inContracts = S.st.contracts.filter(c => c.rivalId === rv.id).length;
        return h('div', { class: 'rivalcard' }, star ? portrait(star, 56, true) : h('div', { class: 'portrait', style: 'width:56px;height:56px' }),
          h('div', { class: 'grow' }, h('div', {}, h('b', {}, rv.name), h('span', { class: `badge prof ${rv.profile ?? 'local'}`, style: 'margin-left:6px', title: rivalDef(rv)?.desc ?? '' }, rv.profile === 'grand' ? '최대 루두스' : rv.profile === 'major' ? '큰 루두스' : '지방 파밀리아'), inContracts ? h('span', { class: 'badge revenge', style: 'margin-left:6px' }, `이번 시즌 계약 ${inContracts}`) : null),
            h('div', { class: 'meta' }, star && ((star.honor ?? 0) >= 20 || star.wins >= 3) ? `간판: ${star.name} (${TYPE_KO[star.type]} ${star.rank === 'tiro' ? '티로' : '베테'}, ${star.wins}승/${star.fights}전, 명예 ${star.honor ?? 0}${(star.skills ?? []).length ? `, 기술 ${(star.skills ?? []).map(SKILL_NAME).join('·')}` : ''})` : '아직 이름난 검투사가 없음'),
            h('div', { class: 'meta' }, `${recordVsMe(rv)} · 명단 ${rv.roster.filter(g => g.alive).length}명 (부상 ${rv.roster.filter(g => g.injured > 0).length})`),
            h('div', { class: 'meta rivalroster' }, ...rv.roster.filter(g => g.alive).map(g => h('span', { class: `rmini${g.injured ? ' inj' : ''}`, title: `${g.name} · ${TYPE_KO[g.type]} · ${g.wins}승/${g.fights}전 · 명예 ${g.honor ?? 0}${g.injured ? ' · 부상' : ''}` }, h('span', { class: 'sq small', style: `background:${TYPE_COLOR[g.type]}` }, glyphSvg(g.type, 12)), ` ${g.name}`))))); })));
}
// ── 도움말: 장비 규칙 + 시너지 효과 + 전투·미시오·경제 규칙 (상성은 제거됨) (수치는 config/equipment/synergy 와 동기화)
function renderHelp(): Node {
  const row = (title: string, body: string) => h('div', { class: 'hrow' }, h('b', {}, title), h('span', {}, body));
  const sec = (title: string, ...kids: (Node | null)[]) => h('div', { class: 'hsec' }, h('h3', {}, title), ...kids);
  const M = CONFIG.missio;
  return h('div', { class: 'help' },
    sec('장비 (유형 = 장비 실루엣)',
      row('무르밀로', '글라디우스 + 큰 방패(스쿠툼). 첫 타격을 반으로 막는다. 신중하게 접근.'),
      row('세쿠토르', '글라디우스 + 큰 방패 + 매끈한 투구. 첫 타격 반감, 치명타를 30% 덜 맞음. 공격적으로 추격.'),
      row('트라엑스', '시카(곡도) + 작은 방패(파르물라). 시카는 방패 너머로 찍어 상대 방어 30%를 무시. 견제하며 접근.'),
      row('레티아리우스', '삼지창 + 그물. 긴 사거리로 거리를 두고 싸움. 첫 공격에 그물을 던져 1.2초 속박. 투구가 없어 치명타를 60% 더 맞음.'),
      row('호플로마쿠스', '창 + 둥근 청동 방패(파르마) + 단검. 창의 긴 사거리로 찌르고, 둥근 방패는 첫 타격 25% 감소. 무르밀로의 전통 짝.'),
      row('프로보카토르', '글라디우스 + 중형 방패 + 가슴판. 중형 방패 첫 타격 40% 감소, 가슴판 덕에 치명타 20% 덜 맞음. 프로보카토르끼리 붙는 것이 전통.'),
      row('에퀘스', '창 + 둥근 방패, 챙 투구에 깃털, 튜닉 차림. 원래 말을 타고 시작하던 유형이라 빠르게 돌진해 먼저 친다. 에퀘스끼리 붙는 것이 전통.'),
      row('디마카에루스', '시카 두 자루, 방패 없음. 연속 공격 +15%, 대신 치명타를 30% 더 맞음. 호플로마쿠스 또는 같은 디마카에루스와 짝.')),
    sec('시너지 (같은 팀 3명 조합)',
      row('방패벽', '큰 방패 2명 이상 → 큰 방패 든 검투사 방어 +3.'),
      row('사냥조', '레티아리우스 + 세쿠토르 → 세쿠토르가 그물에 걸린 적을 노리고, 속박된 적에게 피해 ×1.5.'),
      row('경중 조합', '큰 방패 + 작은 방패 → 팀 전체가 받는 피해 −8%.'),
      row('자연 계열 ×2 / ×3', '×2: 공격 +8%. ×3: 첫 타격에 상대가 0.8초 기세에 눌린다.'),
      row('전통 짝', `무르밀로–트라엑스, 레티아리우스–세쿠토르처럼 로마인이 좋아한 대결 조합. 내 팀과 상대가 전부 짝지어지면 승리 시 호감도 +${CONFIG.fameDelta.classicWin}, 패배 시 미시오 +${Math.round(CONFIG.missio.classic * 100)}%.`),
      row('승리 계열 ×2 / ×3', `×2: 미시오(패자 생존) 확률 +${Math.round(M.victorySynergy * 100)}%. ×3: 시간 초과 무승부 때 승리 판정.`)),
    sec('기술 (배워서 익히는 동작)',
      row('배우기', `경기 경험(조건을 채우면 ${Math.round(CONFIG.skills.expChance * 100)}%)이나 편성의 '기술 훈련'(같은 유형 독토르 ${Math.round(CONFIG.skills.trainChance * 100)}%, 8승 독토르 +${Math.round(CONFIG.skills.masterBonus * 100)}%, 훈련 시설 ${CONFIG.skills.gymLevel}단계부터 독학 ${Math.round(CONFIG.skills.gymChance * 100)}%)으로 배울 기회가 생기고, 카드에서 배울지 정한다. 슬롯은 티로 1, 베테라누스 2, 프리무스 팔루스(승수 8·명예 20) 3. 상대 베테라누스도 1~2개 가진다.`),
      row('숙련', `발동할 때마다 확률 +${Math.round(0.02 * 100)}% (최대 +15%). 독토르가 되면 아는 기술을 제자에게 가르친다.`),
      ...SKILLS.map(sk => row(sk.name, `${sk.types === 'all' ? '공용' : sk.types.map(t => TYPE_KO[t]).join('·')} · 기본 ${Math.round(sk.base * 100)}% · ${sk.desc} (${sk.learn})`))),
    sec('전투',
      row('연속 공격', `${Math.round(CONFIG.combo.base * 100)}% + 속도×${CONFIG.combo.perSpd * 100}% 로 한 번 더 친다.`),
      row('치명타', `${Math.round(CONFIG.crit.base * 100)}% + 속도×${CONFIG.crit.perSpd * 100}% (투구 보정). 피해 ×${CONFIG.crit.mult}, 방패 반감 무시.`),
      row('돌진', '멀리서 달려들어 치면 피해 ×1.15.'),
      row('시간 초과', '60초가 지나면 무승부 (승리 ×3 시너지가 있으면 승리).')),
    sec('미시오 (패자의 목숨)',
      row('기본', `${Math.round(M.base * 100)}% + 호감도×${M.perFame * 100}% + 승수×${M.perWin * 100}% (최대 ${M.maxWins}승).`),
      row('주최자', `성격에 따라 상금·대여료·미시오·루디스가 다르다 (아래 '주최자' 절). 등급 1 경기 +${Math.round(M.tierBonus[1] * 100)}%, 등급 2 +${Math.round(M.tierBonus[2] * 100)}% (지방 주최자는 사망 배상을 꺼려 살려 주는 편).`),
      row('결과', `살아남으면 ${Math.round(M.injuryChance * 100)}% 확률로 부상 (${injurySeasons(S.st)}시즌 출전 불가, 치료 ${healCostOf(S.st)} HS). 실패하면 사망하고 주최자가 배상 (구매가×${CONFIG.deathComp.priceMult} + 승수×${CONFIG.deathComp.perWin}).`)),
    sec('주최자 (에디토르)',
      ...(Object.keys(HOST) as (keyof typeof HOST)[]).map(k => { const H = HOST[k]; return row(H.ko, `${H.desc} 상금 ×${H.prize}, 대여료 ×${H.rent}, 미시오 ${H.missio >= 0 ? '+' : ''}${Math.round(H.missio * 100)}%, 루디스 ${H.rudis >= 0 ? '+' : ''}${Math.round(H.rudis * 100)}%${H.fameWin ? `, 승리 호감도 +${H.fameWin}` : ''}${H.honorAll ? `, 출전자 명예 +${H.honorAll}` : ''}.`); }),
      row('팬', `명예 + 승수×2 + 별칭×5. ${FANS_STAR} 이상이면 스타: 관중이 이름을 외치고 관중석이 더 차며, 선거 후보의 경기에서 이기면 호감도 +1 (폼페이 낙서의 팬심).`),
      row('내기 (스폰시오)', '기량 시합에 거는 내기는 로마법에서도 허용됐다(Digesta 11.5). 도박꾼 주최자의 계약에서 받으면 이길 때 상금 두 배, 지면 상금만큼 물어낸다.')),
    sec('경영',
      row('수입', `계약마다 대여료 (티로 ${CONFIG.rentTiro}, 베테라누스 ${CONFIG.rentVeteran}) + 승리 상금 (등급×${CONFIG.prizePerTier}). 대여료는 승패와 무관 (고증).`),
      row('출전 경비', `대여료의 ${Math.round(CONFIG.fightExpense.rentRate * 100)}% (장비 정비·식량·의료) + 등급별 이동·호송비 (${[1, 2, 3].map(t => CONFIG.fightExpense.byTier[t].toLocaleString()).join(' · ')}) 가 경기마다 차감. 큰 경기일수록 가는 길이 비싸다.`),
      row('지출', `시즌 유지비: 티로 ${CONFIG.upkeepTiro}, 베테라누스 ${CONFIG.upkeepPerGladiator}, 독토르 ${CONFIG.doctorSalary} (켈라 4칸 이하 작은 루두스는 검투사 유지비 −25%). 시설은 단계마다 유지비. 호감도 ${CONFIG.upkeepFame.from} 이상이면 명성 유지비 (호감도−50)×${CONFIG.upkeepFame.per}. 훈련은 따로 돈을 받지 않고 팔루스 유지비(${CONFIG.upkeepFacility.palus}/개)에 든다.`),
      row('호감도', `승리 +${CONFIG.fameDelta.win} (호감도 ${CONFIG.fameDelta.winAt[0][0]}↑이면 +${CONFIG.fameDelta.winAt[0][1]}, ${CONFIG.fameDelta.winAt[1][0]}↑이면 +${CONFIG.fameDelta.winAt[1][1]}), 패배 ${CONFIG.fameDelta.lose}, 사망 ${CONFIG.fameDelta.death}. 매 시즌 망각 ${CONFIG.fameDelta.decay} (${CONFIG.fameDelta.decayAt[0][0]}↑ ${CONFIG.fameDelta.decayAt[0][1]}, ${CONFIG.fameDelta.decayAt[1][0]}↑ ${CONFIG.fameDelta.decayAt[1][1]}; 한 번이라도 출전하면 +${CONFIG.fameDelta.active}). 명성은 오를수록 지키기 어렵다. 받을 수 있는 중요한 계약(등급 2·3)을 거절하면 시즌당 ${CONFIG.fameDelta.refuse} (검투사를 전부 내보냈으면 벌점 없음). 등급 2는 ${CONFIG.fameTierReq[2]}, 등급 3은 ${CONFIG.fameTierReq[3]} 이상 필요.`),
      row('별칭', `베테라누스가 전적 조건을 채우면 붙는다 (최대 3개, 초상·경기 화면에 장식). ${EPITHETS.map(e => `'${e.name}'${e.attested ? '*' : ''}(${e.cond}: ${e.effect})`).join(' · ')}. *는 폼페이 낙서·묘비·마르티알리스의 실제 기록.`),
      row('상대 파밀리아', `상대는 시즌을 넘어 유지되는 네 파밀리아(율리우스·암플리아투스·네로니아누스·스카이바)에서 나온다. 그들도 승패·명예·부상·사망이 쌓이고 빈자리를 채운다. 경기 광고(에딕타)처럼 상대 이름과 전적은 전부 공개.`),
      row('원한과 복수', `내가 이기고 살려 준 상대를 다시 만나면 그는 공격 ×${CONFIG.grudge.atk}, 그에게 지면 미시오 ${Math.round(CONFIG.grudge.missio * 100)}% (우르비쿠스 묘비: "네가 이긴 자를 조심하라"). 나를 쓰러뜨렸던 상대를 꺾으면 복수: 명예 +${CONFIG.grudge.revengeHonor}, 별칭 '복수자'.`),
      row('유형 전환', `검투사가 스스로 청할 때만(이벤트, 준비 중) 다른 유형으로 재훈련 (${CONFIG.retrainCost} HS, 그 시즌 출전 불가). 공·방은 유지, 속도·사거리는 새 유형. 세 유형으로 각각 이기면 '혼자서 세 유형을 다 싸우는 자'(헤르메스).`),
      row('기술 전수 (추가 유형)', `호플로마쿠스·에퀘스 돌진 ×${CONFIG.mentor.chargeMult}, 프로보카토르 치명타 피격 ${CONFIG.mentor.critTaken}, 디마카에루스 연속 +${Math.round(CONFIG.mentor.twinBonus * 100)}% 추가.`),
      row('왼손잡이', `타고난 특성(매물 10%). 왼손잡이(스카이바)는 상대 방패의 첫 타격 감소를 절반으로 만든다. 비문에 따로 표기될 만큼 귀했다.`),
      row('루디스 거절', `루디스를 받은 경기의 결과 화면에서 거절할 수 있다. 플람마처럼 노예로 남는 대신 명예 +8.`),
      row('나이', `검투사는 티로 ${CONFIG.age.tiro[0]}~${CONFIG.age.tiro[1]}세, 베테라누스 ${CONFIG.age.veteran[0]}~${CONFIG.age.veteran[1]}세로 들어오고 봄마다 한 살. ${CONFIG.age.spdFrom}세부터 ${CONFIG.age.spdEvery}년마다 속도 −1, ${CONFIG.age.statFrom}세부터 ${CONFIG.age.statEvery}년마다 공·방 −1 (비문의 검투사 사망 연령은 대부분 20~30대).`),
      row('후계', `라니스타는 봄마다 한 살 먹는다. 정해진 은퇴 나이는 없고 해마다 나이에 따라 죽을 확률이 있다 (40세 미만 1%, 40대 2.5%, 50대 4.5%, 60대 8%, 70세 이상 14% — 울피아누스 생명표 근사). ${CONFIG.lanista.voluntaryAge}세(세니오레스)부터 자발 은퇴 가능. 독토르 후계자는 제 나이 그대로 잇는다. 후계자는 독토르 중 한 명(그 유형 훈련 +${CONFIG.lanista.doctorTrainBonus}, 명예×${CONFIG.lanista.fameFromHonor} 만큼 호감도에 보탬) 또는 부하 해방노예(시장 ${Math.round(CONFIG.lanista.freedmanDiscount * 100)}% 할인). 자금·검투사·시설은 그대로, 호감도는 ${Math.round(CONFIG.lanista.fameKeep * 100)}% 계승.`),
      row('확보 경로', `시장 매물의 출신: 노예 상인(기본), 전쟁 포로(값 −35%, 공격·HP 높음, 미시오 −5%), 형벌 죄수(값 −60%, 능력치 −2, 배상 절반, 12시즌 뒤 자유), 자유민 계약자(아욱토라티)는 시장에 서지 않고 루두스 문 앞에 찾아온다(호감도가 높을수록 자주): 계약금 ×0.8, 급료 지급, 8시즌 계약, 재계약 = 계약금 절반. 첫 시즌은 노예 상인만.`),
      row('루디스', `승리로 ${CONFIG.rudis.wins}승에 이르면 주최자가 확률적으로 루디스(나무 검)를 내려 자유민이 된다 (기본 ${Math.round(CONFIG.rudis.base * 100)}% + 호감도, 관대 +20%/잔혹 −20%). 자유민은 팔 수 없고 사망 배상도 없다. 계속 출전하면 대여료의 ${Math.round(CONFIG.rudiariusShare * 100)}%를 급료로 가져간다.`),
      row('독토르', `자유민을 교관으로 고용하면 출전하지 않고 시즌 급료 ${CONFIG.doctorSalary} HS 를 받는다. 같은 유형 훈련에서 독토르의 해당 능력치가 훈련생보다 ${CONFIG.doctorBonus.gapSmall} 이상 높으면 +1, ${CONFIG.doctorBonus.gapBig} 이상이면 +2 추가 (스승을 넘어서면 보너스 없음).`),
      row('기술 전수', `${CONFIG.doctorSkillWins}승 이상 독토르는 같은 유형 제자에게 유형 기술을 전수: 세쿠토르 연속 공격 +${Math.round(CONFIG.mentor.comboBonus * 100)}%, 무르밀로 방패 첫 타격 감소 ${Math.round(CONFIG.mentor.shieldReduce * 100)}%, 트라엑스 방어 무시 ${Math.round(CONFIG.mentor.sicaIgnore * 100)}%, 레티아리우스 속박 ${CONFIG.mentor.bindSec}초.`),
      row('시설', `켈라 칸 수 = 로스터 상한(3→15, 한 줄 3칸씩 증축). 칸마다 숙소 질 ★1 피로 회복 −2, ★2 피로 덜 쌓임, ★3 명예 +1/시즌 (★마다 유지비 +100). 시설은 단계마다 유지비가 붙는다(조리장·훈련 시설·약재 150, 의술·침상·팔루스·증축 칸 50~100). 조리장 출전 HP +5/단계. 의무실: 침상(1→4, 모자라면 부상 +1시즌)·의술(2단계 부상 1시즌, 4단계 치료 250)·약재(피로 면제 20%/단계). 훈련장: 팔루스 = 시즌당 훈련 인원(2→6)·훈련 시설(3·5단계 훈련 폭 +1).`),
      row('시즌 행동', `출전하지 않는 검투사는 편성에서 행동을 고른다. 휴식(피로 −1, ★1 숙소면 −2) · 훈련 공/방(팔루스 자리) · 시범(훈련장 공개, 명예 +${CONFIG.actions.show.honor}). 부상자는 요양(무료, 회복 +${CONFIG.actions.recover.extra}시즌 가속) 또는 치료.`),
      row('시즌 행사', `편성 화면에서 선택. 공개 만찬(케나 리베라) ${CONFIG.events.cena.cost}: 출전 검투사 명예 +${CONFIG.events.cena.honor}, 호감도 +${CONFIG.events.cena.fame}. 행렬(폼파) ${CONFIG.events.pompa.cost}: 명예 +${CONFIG.events.pompa.honor}, 호감도 +${CONFIG.events.pompa.fame}. 네메시스 봉헌 ${CONFIG.events.votum.cost}: 이번 시즌 미시오 +${Math.round(CONFIG.events.votum.missio * 100)}%. 벽화 광고(에딕타) ${CONFIG.events.edicta.cost}: 출전 검투사 명예 +${CONFIG.events.edicta.honor}. 귀족 손님 초대 ${CONFIG.events.guests.cost}: 출전 가능 검투사 명예 +${CONFIG.events.guests.honor}, 호감도 +${CONFIG.events.guests.fame}, 사례금 +${CONFIG.events.guests.gift}.`),
      row('명예', `검투사 개인의 인기. 승리 +${CONFIG.honor.win} (등급마다 +${CONFIG.honor.perTier}), 전통 짝 +${CONFIG.honor.classic}, 화관(주최자 만족) +${CONFIG.honor.crown}, 패배 ${CONFIG.honor.lose}. 미시오 생존 +${CONFIG.honor.missioPer * 100}%/점, 대여료 +${CONFIG.honor.rentPer * 100}%/점 (스타는 비싸다). 폼페이 낙서의 팬심과 비싼 스타를 죽이기 꺼린 주최자가 근거.`),
      row('출전', `계약마다 규모가 다름 (1대1 · 2대2 · 3대3). 검투사는 시즌당 1회만 출전. ${CONFIG.promoteWins}승이면 베테라누스로 승격.`),
      row('피로', `출전 뒤 피로가 쌓일 확률: 힘든 경기 ${Math.round(CONFIG.fatigue.chanceHard * 100)}%, 가벼운 경기(쓰러지지 않고 HP ${Math.round(CONFIG.fatigue.cleanWinHp * 100)}%↑ 남기며 이김) ${Math.round(CONFIG.fatigue.chanceClean * 100)}%, 숙소 ★마다 −${Math.round(CONFIG.fatigue.perCellStar * 100)}%. 쉬는 시즌마다 −1(★1 숙소 −2). 첫 ${CONFIG.fatigue.free}점은 괜찮고 그 위로 1점마다 공·방 −${CONFIG.fatigue.statPenalty}, 미시오 −${Math.round(CONFIG.fatigue.missioPenalty * 100)}%. 피로 ${CONFIG.fatigue.overworkAt} 이상인 채 시즌을 넘기면 (피로−${CONFIG.fatigue.overworkAt - 1})×${Math.round(CONFIG.fatigue.overworkPer * 100)}% 로 과로사. 로스터를 돌려 쉬게 할 것.`)));
}
// ── 대시보드: 현재 장소에서 선택해야 하는 일들
export function renderDash(v: View = S.view, forNews = false): Node[] {
  const view = v; // 서랍에서 다른 장소의 내용을 그릴 때 쓴다. forNews: 소식 배지·소식 시트용 — 켈라가 열려 있어도 켈라 항목이 아니라 마을 소식을 센다
  const item = (cls: string, text: string, extra?: Node | null) => h('div', { class: `ditem ${cls}` }, h('span', { class: 'dot' }), h('span', { class: 'grow' }, text), extra ?? null);
  if (view === 'market') {
    const g = S.st.market.find(x => x.id === S.marketSel);
    const out: Node[] = [h('h3', {}, '노예 시장', h('span', { class: 'hint', style: 'margin-left:8px;text-transform:none' }, `매물 ${S.st.market.length}명 · 보유 ${S.st.money.toLocaleString()} HS`))];
    if (!S.st.market.length) return [...out, item('idle', '이번 시즌 매물이 없습니다.')];
    const full = S.st.roster.length >= rosterCap(S.st);
    if (full) out.push(item('warn', `켈라이 가득 찼습니다 (${S.st.roster.length}/${rosterCap(S.st)}). 루두스에서 켈라을 증축하거나 검투사를 매각해야 살 수 있습니다.`));
    if (g && g.origin && g.origin !== 'slave') out.push(item('idle', `${ORIGIN_KO[g.origin]}: ` + (g.origin === 'captive' ? `값 ${Math.round((1 - CONFIG.origins.captive.price) * 100)}% 저렴, 공격 +${CONFIG.origins.captive.atk}·HP +${CONFIG.origins.captive.hp}. 관중이 이방인에게 냉담해 미시오 ${Math.round(CONFIG.origins.captive.missio * 100)}%.` : g.origin === 'damnatus' ? `값 ${Math.round((1 - CONFIG.origins.damnatus.price) * 100)}% 저렴, 능력치 ${CONFIG.origins.damnatus.stat}. 사망 배상 절반. ${CONFIG.origins.damnatus.freeAfter}시즌 뒤 형기 만료로 자유민이 됨.` : `계약금 ${g.buyPrice.toLocaleString()} HS 로 ${CONFIG.origins.auctoratus.term}시즌 계약. 자유민이라 매각·배상 없음, 출전마다 대여료의 ${Math.round(CONFIG.rudiariusShare * 100)}% 급료. 만료 전 재계약(계약금의 절반) 가능.`)));
    if (g) { // 고른 매물의 자세한 정보 (목록은 없다: 위 판매대의 검투사를 눌러 고른다)
      const price = priceOf(S.st, g);
      out.push(gladCard(g, [h('button', { class: 'primary', disabled: S.st.money < price || full, onclick: () => { if (buy(S.st, g)) { sfx.coin(); S.marketSel = null; S.detail = null; render(); } } }, `구매 ${price.toLocaleString()}${price < g.buyPrice ? ' (할인)' : ''}`)], { sel: true }));
      out.push(h('div', { class: 'meta', style: 'padding:2px 4px' }, `${TYPE_KO[g.type]} · ${g.age ?? '?'}세 · ${g.rank === 'tiro' ? '티로' : '베테라누스'} · 속도 ${g.base.spd} · 사거리 ${g.base.range}${g.lineage ? ` · 계보 ${LINEAGE_KO[g.lineage]}` : ''}${(g.skills ?? []).length ? ` · 기술 ${(g.skills ?? []).map(SKILL_NAME).join('·')}` : ''}${g.scaeva ? ' · 왼손잡이(상대 방패의 첫 타격 감소 절반)' : ''}`));
      if (S.st.money < price) out.push(item('warn', `자금이 ${(price - S.st.money).toLocaleString()} HS 부족합니다.`));
      const idx = S.st.market.findIndex(m => m.id === g.id); out.push(h('div', { class: 'hint', style: 'padding:2px 4px' }, `매물 ${idx + 1}/${S.st.market.length} — 판매대의 다른 검투사를 누르면 바꿔 본다`));
    } else out.push(h('div', { class: 'card ghost' }, h('span', { class: 'hint' }, '판매대의 검투사를 누르면 자세히 보입니다')));
    return out.filter(Boolean);
  }
  if (S.cellsOpen && !forNews) { // 켈라 화면: 칸별 숙소 질 강화 + 증축·조리장
    const out: Node[] = [h('h3', {}, '켈라', h('span', { class: 'hint', style: 'margin-left:8px;text-transform:none' }, `${S.st.roster.length} / ${S.st.ludus.cells.length}칸`), helpBtn('켈라', '켈라 수 = 검투사 상한. 칸마다 숙소 질을 올릴 수 있고(★1 휴식 피로 −2, ★2 유지비 −25%, ★3 명예 +1/시즌), 질은 칸에 붙어 있습니다. 위 그림의 방을 누르면 거주자를 바꿀 수 있습니다.'))];
    out.push(item('idle', '위 그림의 방을 누르면 거주자와 숙소 질을 정합니다.'));
    out.push(h('div', { class: 'dlist' }, ...facRows('cells')));
    return out;
  }
  if (view === 'grave') { // 묘지: 대시보드에 연대기를 그대로 보여 준다 (역대 라니스타 · 명예의 전당 · 묘비 · 연혁)
    const c = chroniclePanel() as HTMLElement; c.classList.remove('panel'); c.classList.add('chronicle');
    return [c];
  }
  if (view === 'medic') { // 의무실: 부상자 치료·요양, 침상·의술·약재
    const injured = S.st.roster.filter(g => g.injured);
    const out: Node[] = [h('h3', {}, '의무실', h('span', { class: 'hint', style: 'margin-left:8px;text-transform:none' }, `침상 ${S.st.ludus.beds} · 부상 ${injured.length}명 · 치료 ${healCostOf(S.st)} HS`), helpBtn('의무실', `부상자는 ${injurySeasons(S.st)}시즌 동안 출전하지 못합니다. 치료(${healCostOf(S.st)} HS)하면 바로 복귀하고, 편성에서 요양을 고르면 무료로 회복이 ${CONFIG.actions.recover.extra}시즌 빨라집니다.\n침상보다 부상자가 많으면 넘치는 사람은 회복이 1시즌 늦어집니다. 의술은 단계마다: 1 치료비 400 · 2 부상 1시즌 · 3 치료비 250 · 4 쓰러진 뒤 부상 확률 40% · 5 30%와 시즌 끝 피로 회복 +1. 약재는 단계마다 경기 후 피로를 20% 확률로 면제합니다.`))];
    if (!injured.length) out.push(item('idle', '부상자 없음'));
    // 부상자 개별 표시는 디스플레이의 침상(십자 팻말·치료 금액·이름·무기 아이콘)에서. 대시보드에는 두지 않는다
    { const noBed = injured.filter(g => !inBed(S.st, g)).length; if (noBed) out.push(item('warn', `침상에 눕지 않은 부상자 ${noBed}명은 이번 시즌 낫지 못합니다. 빈 침상을 눌러 눕히세요.`)); }
    out.push(h('div', { class: 'dlist' }, ...facRows('medic')));
    return out;
  }
  if (view === 'yard') { // 훈련소: 팔루스·훈련 시설·독토르. 검투사 개인 정보는 켈라, 행동 선택도 켈라
    const docs = S.st.roster.filter(g => g.status === 'doctor');
    const out: Node[] = [h('h3', {}, '훈련소', h('span', { class: 'hint', style: 'margin-left:8px;text-transform:none' }, `검투사 ${S.st.roster.length}명 · 출전 가능 ${available(S.st).length} · 팔루스 ${S.st.ludus.palus}`))];
    if (!S.st.roster.length) out.push(item('warn', '검투사가 없습니다. 시장에서 사들이세요.'));
    // 검투사 개인 정보는 켈라에서 본다 (여기서는 훈련 시설과 독토르만)
    if (docs.length) out.push(item('idle', `독토르 ${docs.map(g => `${g.name}(${TYPE_KO[g.type]})`).join(', ')} — 같은 유형 훈련 +1~2.`));
    out.push(item('idle', `팔루스 ${trainCap(S.st)}개 · 세운 검투사 ${palusTrainees(S.st).length}명 · 훈련 폭 +${1 + gymBonus(S.st)}`, helpBtn('훈련', `훈련은 훈련장의 팔루스(기둥)에 검투사를 세워서 합니다. 빈 기둥을 누르면 켈라에서 세울 검투사를 고르고, 선 검투사를 누르면 공격·방어·기술 중 무엇을 단련할지 정합니다. 시즌이 끝날 때 훈련하며 팔루스 수가 곧 훈련 인원입니다. 훈련비는 따로 없고 팔루스 유지비(${CONFIG.upkeepFacility.palus}/개)에 듭니다. 출전 검투사도 세울 수 있지만 피로가 쌓일 수 있습니다. 세우지 않은 검투사는 피로가 있으면 쉬고, 없으면 시범(명예 +1)을 합니다. 부상자는 요양합니다.`)));
    out.push(h('div', { class: 'dlist' }, ...facRows('yard')));
    return out;
  }
  // 정문(루두스 문 앞): 계약·지원자·상대 등 결정할 일 목록
  const out: Node[] = [h('h3', {}, '정문', h('span', { class: 'hint', style: 'margin-left:8px;text-transform:none' }, `${seasonName(S.st.season)} · ${S.st.money.toLocaleString()} HS`))];
  const injured = S.st.roster.filter(g => g.injured); const avail = available(S.st);
  const upkeep = upkeepOf(S.st);
  if (!S.st.roster.length) out.push(item('warn', '검투사가 없습니다. 시장에서 검투사를 사들이세요.'));
  for (const rv of S.st.rivals.filter(r => r.since === S.st.season && S.st.season > 1)) out.push(item('todo', `${rv.name} 이(가) 이 지방에 나타났다 — ${rivalDef(rv)?.desc ?? ''}. 앞으로 계약 상대로 만난다.`)); // 호감도가 올라 큰 루두스가 온 시즌
  { const p = mortality(S.st.lanista.age + 1); const docs = S.st.roster.filter(g => g.status === 'doctor').length;
    if (S.st.lanista.age >= 46) out.push(item(p >= 0.045 ? 'warn' : 'idle', `${S.st.lanista.name} ${S.st.lanista.age}세 — 해마다 ${Math.round(p * 100)}%의 확률로 세상을 떠날 수 있습니다. 후계 후보: 독토르 ${docs}명${docs ? '' : ' (없으면 부하 해방노예가 잇습니다)'}. 헤더의 '은퇴'로 미리 물려줄 수 있습니다.`)); }
  if (S.st.applicants.length) out.push(item('todo', `루두스 문루 아래에 자유민 지원자 ${S.st.applicants.length}명: ${S.st.applicants.map(g => `${g.name}(${TYPE_KO[g.type]}·${g.rank === 'tiro' ? '티로' : '베테'}, 계약금 ${g.buyPrice.toLocaleString()})`).join(', ')} — 훈련소에서 지원자를 누르면 계약.`));
  { const expiring = S.st.roster.filter(g => g.status === 'rudiarius' && g.contractUntil != null && g.contractUntil - S.st.season <= 1); if (expiring.length) out.push(item('warn', `계약 만료 임박: ${expiring.map(g => `${g.name} (${Math.max(0, g.contractUntil! - S.st.season + 1)}시즌)`).join(', ')} — 재계약(계약금의 절반)하지 않으면 떠납니다.`)); }
  { const free = S.st.roster.filter(g => g.status === 'rudiarius'); const docs = S.st.roster.filter(g => g.status === 'doctor');
    if (free.length) out.push(item('todo', `자유민(루디아리우스) ${free.length}명: ${free.map(g => g.name).join(', ')} — 급료(대여료의 ${Math.round(CONFIG.rudiariusShare * 100)}%)를 받고 계속 출전하거나, 독토르로 고용(${CONFIG.doctorSalary} HS/시즌, 같은 유형 훈련 강화).`));
    if (docs.length) out.push(item('idle', `독토르 ${docs.length}명: ${docs.map(g => `${g.name}(${TYPE_KO[g.type]} 공 ${g.base.atk}·방 ${g.base.def}${g.wins >= CONFIG.doctorSkillWins ? ' · 기술 전수' : ''})`).join(', ')} — 능력치가 앞서는 만큼 같은 유형 훈련 +1~2.`)); }
  if (injured.length) out.push(item('warn', `부상 검투사 ${injured.length}명: ${injured.map(g => g.name).join(', ')} — 치료(${healCostOf(S.st)} HS)하면 이번 시즌 출전 가능.`));
  // 계약·상대 이야기는 편성 화면에 있으므로 정문에서는 다루지 않는다 (편성에서 관리로 되돌아올 수 있음)
  if (S.st.roster.length >= rosterCap(S.st)) out.push(item('idle', `켈라 ${S.st.roster.length}/${rosterCap(S.st)} 가득 참 (증축 ${upgradeCost(S.st, 'cells')?.toLocaleString() ?? '최대'} HS)`));
  if (S.st.money < upkeep) out.push(item('warn', `자금이 시즌 유지비 ${upkeep.toLocaleString()} HS 보다 적습니다`));
  else out.push(item('idle', `시즌 유지비 ${upkeep.toLocaleString()} HS`));
  if (S.st.market.length) out.push(item('idle', `시장 매물 ${S.st.market.length}명 (${Math.min(...S.st.market.map(m => m.buyPrice)).toLocaleString()} HS 부터)`));
  return out; // 지원자 카드는 '지원자' 서랍(장면의 지원자를 누르면)
}
export function eventRows(): Node[] {
  const E = CONFIG.events;
  // 행사 줄: 라틴 이름 굵게 + 설명 한 줄, 그 아래 효과 한 줄('· ')
  const ev = (k: keyof SeasonEvents, desc: string, effect: string) => h('label', { class: `evrow${S.eventPlan[k] ? ' on' : ''}` }, h('input', { type: 'checkbox', checked: S.eventPlan[k] ? 'checked' : undefined, onchange: (e: Event) => { S.eventPlan[k] = (e.target as HTMLInputElement).checked; render(); } }), h('span', { class: 'grow' }, h('div', {}, h('b', {}, EVENT_KO[k]), ' ', h('span', { class: 'meta' }, desc)), h('div', { class: 'effect' }, `· ${effect}`)), h('span', {}, `${E[k].cost.toLocaleString()} HS`));
  return [
    ev('cena', '경기 전날 시민 앞에서 여는 공개 만찬', `출전 검투사 명예 +${E.cena.honor} · 호감도 +${E.cena.fame}`),
    ev('pompa', '경기 당일 도시를 도는 행렬에 참여', `출전 검투사 명예 +${E.pompa.honor} · 호감도 +${E.pompa.fame}`),
    ev('votum', '경기장 곁 사당에 봉헌', `이번 시즌 미시오 +${Math.round(E.votum.missio * 100)}%`),
    ev('edicta', '화공을 사서 거리 벽에 출전 검투사 이름을 그림', `출전 검투사 명예 +${E.edicta.honor}`),
    ev('guests', '귀족을 루두스로 초대해 연습을 보이고 연회', `출전 가능 검투사 명예 +${E.guests.honor} · 호감도 +${E.guests.fame} · 다음 시즌 그 귀족의 선거 경기 계약이 오고, 이기면 사례금 +${E.guests.gift}`)];
}
function eventsPanel(): Node {
  const E = CONFIG.events; const evCost = EVENT_KEYS.reduce((a, k) => a + (S.eventPlan[k] ? E[k].cost : 0), 0);
  return h('div', { class: 'panel' }, h('h2', {}, '시즌 행사', helpBtn('시즌 행사', '전투 밖에서 명예·호감도를 올리는 행사입니다. \'전투\' 를 누를 때 결제되고, 그 시즌에만 효과가 있습니다. 케나 리베라(공개 만찬)·폼파(행렬)·네메시스 봉헌·에딕타(벽화 광고)·귀족 초대는 모두 폼페이 낙서와 비문에 남은 실제 관행입니다.')),
    ...eventRows(), evCost ? h('div', { class: 'hint' }, `행사 비용 −${evCost.toLocaleString()} HS`) : null);
}
