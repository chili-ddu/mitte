// 편성: 계약 카드·배정·서판·시즌 확정·시즌 진행(시작→경기→정산)
import { S } from './state.js';
import { type Contract, type GType, type Gladiator } from '../core/types.js';
import { ACTION_KO, EVENT_KEYS, EVENT_KO, available, canFulfill, doRecover, doShow, doSkillTrain, endSeason, fight, fightExpense, healCostOf, holdEvents, isImportant, mentoredBy, palusOf, palusTrainees, recordVsMe, refuseAll, rivalOf, rivalStar, seasonName, skillTrainable, train, trainCap, type Action, upkeepOf, validTeam } from '../core/game.js';
import { Rng } from '../core/rng.js';
import { battle } from '../core/battle.js';
import { CONFIG } from '../core/config.js';
import { LINEAGE_KO, TYPE_KO, powerOf, rentFee } from '../core/gladiator.js';
import { HOST } from '../core/hosts.js';
import { CLAUSES, acceptedOf, clausesOf, setClause } from '../core/clauses.js';
import { sfx } from './sound.js';
import { classicMatchup, computeSynergies, describeSynergies, isClassicPair } from '../core/synergy.js';
import { SKILL_BY_ID, SKILL_NAME, skillSlots, skillsOf } from '../core/skills.js';
import { backBtn, h, sq, tell, ro } from './dom.js';
import { app, render, save, sideToolsLand, VIEW_KO } from './main.js';
import { hostPrize, hostSpan, moneyRow } from './detail.js';
import { arenaIcon } from './scenes.js';
import { graffitiCheck, renderBattle } from './battle-view.js';
import { portrait } from './portrait.js';
import { coach } from './header.js';
import { eventRows } from './sheets.js';

 // gladiator id → 시즌 행동 (켈라에서 정한다, 새로고침해도 유지)
const savePlan = () => { try { localStorage.setItem('lanista-plan', JSON.stringify(S.trainPlan)); } catch {} };
const setPlan = (g: Gladiator, a: Action) => { S.trainPlan[g.id] = a; savePlan(); };
export const planOf = (g: Gladiator): Action => S.trainPlan[g.id] ?? (g.injured ? 'recover' : 'rest'); // 정하지 않으면 휴식 (부상자는 요양). 훈련은 팔루스에 세워서 하고 무엇을 단련할지는 시즌 끝에 무작위
 // 정하지 않으면 휴식 (부상자는 요양). 훈련은 팔루스에 세워서 하고 무엇을 단련할지는 시즌 끝에 무작위
const rollTraining = (g: Gladiator): 'atk' | 'def' | 'skill' => { const pool: ('atk' | 'def' | 'skill')[] = ['atk', 'def']; if (skillTrainable(S.st, g)) pool.push('skill'); return pool[Math.floor(S.st.rng.next() * pool.length)]; }; // 팔루스에 선 검투사가 단련할 것: 공·방, 기술을 배울 조건이 되면 기술도 후보
export function assignedTo(gid: number): number | null { for (const cid in S.assign) if (S.assign[cid].includes(gid)) return +cid; return null; }
// 승리 예측: 실제 전투 규칙으로 40번 돌려 본 결과 (편성이 바뀔 때만 다시 계산). 상대 원한 보정·조리장 HP·독토르 전수까지 fight() 와 같게
const oddsCache = new Map<string, { win: number; draw: number }>();
function winOdds(c: Contract, team: Gladiator[]): { win: number; draw: number } {
  const key = `${c.id}:${team.map(g => `${g.id}/${g.base.atk}/${g.base.def}/${g.fatigue ?? 0}/${(g.skills ?? []).join('.')}`).join(',')}:${S.st.ludus.kitchen}`;
  const hit = oddsCache.get(key); if (hit) return hit;
  const N = 40; let win = 0, draw = 0; const rng = new Rng(c.id * 7919 + team.reduce((a, g) => a + g.id * 31, 17));
  const boosted = new Set<number>(); for (const g of team) for (const e of c.enemy) if ((g.spared ?? []).includes(e.id)) boosted.add(e.id);
  const mentored = new Set(team.filter(g => mentoredBy(S.st, g)).map(g => g.id));
  for (let i = 0; i < N; i++) { const r = battle(rng, team, c.enemy, { mentored, hpBonusA: S.st.ludus.kitchen * CONFIG.ludus.kitchen.hpPerLevel, boostedB: boosted, boostMul: CONFIG.grudge.atk }); if (r.winner === 'A') win++; else if (r.winner === 'draw') draw++; }
  const out = { win: win / N, draw: draw / N }; oddsCache.set(key, out); return out;
}
// 전력 비교는 숫자 대신 말로: 압도적 우위 · 우위 · 호각 · 열세 · 크게 열세 (라니스타의 감이지 계산표가 아니다)
const oddsSpan = (o: { win: number; draw: number }) => { const p = o.win; const [cls, word] = p >= 0.8 ? ['good', '압도적 우위'] : p >= 0.6 ? ['good', '우위'] : p >= 0.4 ? ['even', '호각'] : p >= 0.2 ? ['bad', '열세'] : ['bad', '크게 열세']; return h('span', { class: `odds ${cls}`, title: '실제 전투 규칙으로 여러 번 겨뤄 본 감. 상대의 기술·원한·내 시설까지 반영' }, `전력 ${word}`); };
// 전력 비교(전력 식): 내 팀 평균 전력 ÷ 상대 평균 전력. 자리를 다 못 채웠어도 평균으로 비교한다. 카드의 상대 강도 칩과 편성의 우위·열세가 같은 식
const powerRatio = (mine: Gladiator[], enemy: Gladiator[]) => { if (!mine.length || !enemy.length) return null; const a = mine.reduce((x, g) => x + powerOf(g), 0) / mine.length, b = enemy.reduce((x, g) => x + powerOf(g), 0) / enemy.length; return b > 0 ? a / b : null; };
const ratioSpan = (r: number | null, partial = false) => { if (r == null) return h('span', { class: 'odds none' }, '전력 —'); const [cls, word] = r >= 1.25 ? ['good', '압도적 우위'] : r >= 1.08 ? ['good', '우위'] : r >= 0.92 ? ['even', '호각'] : r >= 0.75 ? ['bad', '열세'] : ['bad', '크게 열세']; return h('span', { class: `odds ${cls}`, title: `전력 식으로 비교: 내 ${partial ? '배정한 검투사' : '팀'} 평균 전력이 상대의 ${Math.round(r * 100)}%${partial ? ' (자리를 다 채우면 확정)' : ''}` }, word); };
function difficultyBySim(c: Contract): { win: number; label: 'weak' | 'even' | 'strong' } | null {
  const pool = available(S.st).sort((a, b) => powerOf(b) - powerOf(a)); if (pool.length < c.size) return null;
  const vets = pool.filter(g => g.rank === 'veteranus'); if (vets.length < c.needVeterans) return null;
  const team: Gladiator[] = [...vets.slice(0, c.needVeterans)]; for (const g of pool) { if (team.length >= c.size) break; if (!team.includes(g)) team.push(g); }
  const r = powerRatio(team, c.enemy) ?? 1; return { win: r, label: r >= 1.08 ? 'weak' : r >= 0.92 ? 'even' : 'strong' }; // win 자리에 전력 비율
}
 // 편성 왼쪽 타일 아래 줄: 능력치(기본) / 전적 (스위치)
const teamOf = (c: Contract) => (S.assign[c.id] ?? []).map(id => S.st.roster.find(g => g.id === id)!).filter(Boolean); // 계약에 배정된 검투사들
 // 결투 낙서를 누르면 준비된 계약마다 밀랍 서판이 차례로 나온다 (도장으로 서명) → 마지막 뒤 시즌 시작 확인
function closePlanConfirm() { const el = document.querySelector('.planpage.tablet'); S.shownTablet = false; if (!el) { S.tabletQueue = null; render(); return; } el.classList.add('closing'); window.setTimeout(() => { S.tabletQueue = null; render(); }, 280); }
function closePlanPage() { const el = document.querySelector('.planpage'); S.shownPlan = null; if (!el) { S.planSel = null; render(); return; } el.classList.add('closing'); window.setTimeout(() => { S.planSel = null; render(); }, 280); }
 // 서판 페이지가 떠 있는지 (특약 체크로 재렌더될 때 다시 밀려 들어오지 않게)
// 계약서 페이지: 준비된 계약(최대 4)의 밀랍 서판을 한 페이지에 나란히. 특약(스폰시오)은 체크박스, 도장 한 번(SIGNATVM)으로 모두 서명 → 시즌 시작 확인
function tabletsPage(cs: Contract[]): Node {
  const again = S.shownTablet; S.shownTablet = true;
  const stampText = 'SIGNATVM'; let stamped = false;
  const tablet = (c: Contract) => { const H = HOST[c.host]; const team = teamOf(c); const rent = Math.round(team.reduce((a, g) => a + rentFee(g, c.tier), 0) * H.rent); const exp = fightExpense(team, c.tier);
    const row = (k: string, v: Node | string) => h('div', { class: 'trow' }, h('span', { class: 'tk' }, k), h('span', { class: 'tv' }, v));
    return h('div', { class: 'tabletwrap' }, h('div', { class: 'tablet' },
      h('div', { class: 'ttitle' }, 'LOCATIO', h('span', { class: 'sub' }, `등급 ${c.tier} · ${c.size}대${c.size}`)),
      row('주최', `${H.ko} · ${c.venue}`),
      row('출전', h('span', {}, ...team.flatMap((g, i) => [i ? ', ' : '', sq(g.type), ' ', g.name]))),
      row('대여료', `${rent.toLocaleString()} HS (경비 −${exp.toLocaleString()})`), row('상금', (() => { const mul = acceptedOf(c).reduce((m, id) => m * CLAUSES[id].prizeMul, 1); const p = Math.round(hostPrize(c) * mul); return c.bet ? `${(p * 2).toLocaleString()} HS (스폰시오 ×2)` : `${p.toLocaleString()} HS`; })()),
      row('특약', h('div', { class: 'tclauses' }, ...[0, 1].map(i => { const id = clausesOf(c)[i]; if (!id) return h('div', { class: 'tcheck none' }, h('span', { class: 'dash' }, '—')); const d = CLAUSES[id]; const on = acceptedOf(c).includes(id); // 특약은 항상 두 줄 자리를 잡는다 (서판 모양이 같도록). 없는 줄은 —
        return h('label', { class: `tcheck${on ? ' on' : ''}`, title: d.desc }, h('input', { type: 'checkbox', checked: on ? 'checked' : undefined, onchange: (e: Event) => { setClause(c, id, (e.target as HTMLInputElement).checked); render(); } }), h('span', {}, h('b', {}, d.ko), h('span', { class: 'meta' }, ` ${d.effect(c, hostPrize(c))}`))); }))),
      row('배상', '사망·불구 시 라니스타에게 몸값을 치른다'),
      h('div', { class: 'tfoot' }, `${S.st.lanista.name} · ${seasonName(S.st.season)}`))); };
  const sign = () => { if (stamped) return; stamped = true; const wraps = [...document.querySelectorAll('.planpage.tablet .tabletwrap')];
    wraps.forEach((w, i) => window.setTimeout(() => { w.append(h('div', { class: 'stamp small' }, h('span', {}, stampText))); sfx.down(); }, i * 160)); window.setTimeout(() => sfx.drum(1), 40); // 서판마다 차례로 쾅
    window.setTimeout(() => { S.notice = cs.length > 1 ? `계약서 ${cs.length}장에 서명했다` : `${cs[0].venue} 계약서에 서명했다`; S.shownTablet = false; S.tabletQueue = null; openSeasonConfirm('plan'); }, 900 + wraps.length * 160); };
  const btn = h('button', { class: 'sealbtn', title: '도장을 찍어 계약을 맺습니다', onclick: sign }, h('span', { class: 'latin' }, stampText), h('span', { class: 'ko' }, cs.length > 1 ? `${cs.length}장 서명` : '서명'));
  return h('div', { class: `planpage tablet n${cs.length}${again ? ' still' : ''}` }, h('div', { class: 'tablets' }, ...cs.map(tablet)), h('div', { class: 'cbtns tbtns' }, btn), backBtn(closePlanConfirm, '계약 벽으로 돌아가기'));
}
const honorBadge = (g: Gladiator) => { const b = h('span', { class: 'honor', title: `명예 ${g.honor ?? 0}: 쓰러졌을 때 관중이 살려 줄 확률과 루디스에 영향` }); b.innerHTML = `<svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.5 12.9 17 22l-5-3-5 3 1.5-9.1"/></svg>`; b.append(String(g.honor ?? 0)); return b; }; // 초상 왼쪽 아래 명예 배지
 // 초상 왼쪽 아래 명예 배지
const tileMeta = (g: Gladiator) => S.lineupView === 'record' ? `${g.wins}승/${g.fights}전` : `HP${g.base.hp}·ATK${g.base.atk}·DEF${g.base.def}`; // 편성 왼쪽 타일 아래 줄 (HP부터, 약자)
 // 편성 왼쪽 타일 아래 줄 (HP부터, 약자)
const skillChips = (g: Gladiator) => [...skillsOf(g).map(id => h('span', { class: 'badge skill', title: `${SKILL_BY_ID[id].name}: ${SKILL_BY_ID[id].desc}` }, SKILL_BY_ID[id].name)), ...Array.from({ length: Math.max(0, skillSlots(g) - skillsOf(g).length) }, () => h('span', { class: 'badge empty', title: '빈 기술 자리: 기술 훈련이나 경기 뒤 깨침으로 채운다' }, '\u00a0'))]; // 검투사 미니 카드의 기술 칩: 배운 기술과 빈 자리를 같은 폭으로 고정
const miniGlad = (g: Gladiator, opts: { enemy?: boolean; size?: number; name?: string; meta?: (Node | string | null | undefined)[] } = {}) => [
  h('div', { class: 'mini-top' }, h('div', { class: 'mini-port' }, portrait(g, opts.size ?? 40, !!opts.enemy), h('span', { class: `rank ${g.rank}` }, g.rank === 'tiro' ? '티로' : '베테'), honorBadge(g)), h('div', { class: 'mini-skills' }, ...skillChips(g))),
  h('div', { class: 'mini-name' }, sq(g.type), ' ', opts.name ?? g.name.replace('(적)', '')),
  h('div', { class: 'mini-meta' }, tileMeta(g), ...(opts.meta ?? [])),
]; // 편성 화면 공통 검투사 카드: 상대·배정·후보가 같은 정보 순서와 밀도로 보이게 한다
// 낙서 그림 버튼: 결투(두 검투사) / 셈판(동전 더미). 위에 붉은 라틴어를 덧쓴다. 계약 벽의 PVGNABVNT 와 같은 만듦새
const DUEL_SVG = `<svg viewBox="0 0 96 52" width="92" height="50" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <g stroke="#3a2412" stroke-width="2.2" opacity=".85">
      <circle cx="26" cy="12" r="5"/><path d="M26 17 L25 34"/><path d="M25 34 L18 48"/><path d="M25 34 L32 47"/><path d="M26 21 L40 18 L52 15"/><path d="M26 22 L16 28"/>
      <path d="M12 20 Q6 30 12 40 L20 40 Q24 30 20 20 Z"/>
      <circle cx="70" cy="12" r="5"/><path d="M70 17 L71 34"/><path d="M71 34 L64 47"/><path d="M71 34 L79 48"/><path d="M70 21 L58 23"/><path d="M70 22 L82 30 L86 40"/>
      <path d="M54 20 L62 20 L62 30 L54 30 Z"/><path d="M27 6 L31 3"/><path d="M69 6 L65 3"/>
    </g>
    <g stroke="#9b2c1c" stroke-width="1.1" opacity=".55">
      <path d="M27 20 L41 17 L53 14"/><path d="M13 21 Q8 30 13 39"/><path d="M71 22 L83 30 L87 40"/><circle cx="26" cy="12" r="5.6"/><circle cx="70" cy="12" r="5.6"/>
    </g>
  </svg>`;
const COINS_SVG = `<svg viewBox="0 0 96 52" width="92" height="50" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <g stroke="#3a2412" stroke-width="2.2" opacity=".85">
      <ellipse cx="30" cy="42" rx="14" ry="5"/><path d="M16 42v-6M44 42v-6"/><ellipse cx="30" cy="36" rx="14" ry="5"/><path d="M16 36v-6M44 36v-6"/><ellipse cx="30" cy="30" rx="14" ry="5"/>
      <ellipse cx="62" cy="42" rx="14" ry="5"/><path d="M48 42v-6M76 42v-6"/><ellipse cx="62" cy="36" rx="14" ry="5"/>
      <path d="M40 14 Q48 6 56 14"/><path d="M44 12 L46 18 M50 11 L50 18"/>
    </g>
    <g stroke="#9b2c1c" stroke-width="1.1" opacity=".55"><ellipse cx="30" cy="30.6" rx="14.5" ry="5.2"/><ellipse cx="62" cy="36.6" rx="14.5" ry="5.2"/></g>
  </svg>`;
export function graffitiBtn(kind: 'duel' | 'coins', word: string, title: string, onclick: () => void, badge?: number): Node {
  const b = h('button', { class: 'tabletbtn gfbtn', title, 'aria-label': title, onclick }); b.innerHTML = kind === 'duel' ? DUEL_SVG : COINS_SVG;
  b.prepend(h('span', { class: 'tword' }, word)); if (badge) b.append(h('span', { class: 'nbadge' }, String(badge))); return b;
}
// 시즌 시작 전 경고 줄 (계약 벽에서도, 마을에서 바로 넘길 때도 같은 것을 보여준다)
export function seasonWarnings(): string[] {
  const readyQ = S.st.contracts.filter(c => { const t = teamOf(c); return t.length === c.size && !validTeam(S.st, c, t); }), ready = readyQ.length;
    const healable = S.st.roster.filter(g => g.injured && S.st.money >= healCostOf(S.st)).length;
    const usedIds = new Set(readyQ.flatMap(c => S.assign[c.id] ?? [])); // 다른 계약에 내보내는 검투사는 빼고 판단: 전원을 이미 내보냈다면 거절이 아니다
    const refusable = S.st.fame >= CONFIG.fameDelta.refuseFrom ? S.st.contracts.filter(c => !readyQ.includes(c) && isImportant(c) && canFulfill(S.st, c, usedIds)) : []; // 벌점은 중요한 계약(등급 2·3)만 — 카드가 아니라 여기서 확인
    // 시즌 시작 전 확인: 한 줄씩, 짧게. 어느 계약인지는 굳이 밝히지 않는다
    const warn = [
      !ready ? '이번 시즌은 아무도 모래를 밟지 않습니다.\n· 경기 없음 — 대여료·상금 없이 유지비만 나갑니다.' : '',
      refusable.length ? `큰 경기의 주최자가 우리 검투사를 기다리다 크게 실망했습니다.\n· 호감도 ${CONFIG.fameDelta.refuse}` : '',
      healable ? `의무실에 부상자 ${healable}명이 누워 있습니다. 어서 낫기를.\n· 치료비 ${healCostOf(S.st).toLocaleString()} HS 면 지금 낫습니다. 아니면 요양으로 한 시즌.` : '',
      (() => { const F = CONFIG.fatigue; const risky = S.st.roster.filter(g => assignedTo(g.id) != null && (g.fatigue ?? 0) + 1 >= F.overworkAt); return risky.length ? `${risky.map(g => g.name).join(', ')} 은(는) 지쳐 있는데 또 모래를 밟습니다.\n· 출전하면 피로 ${risky.map(g => (g.fatigue ?? 0) + 1).join('·')} — 시즌 끝에 과로사 ${risky.map(g => Math.round(((g.fatigue ?? 0) + 1 - F.overworkAt + 1) * F.overworkPer * 100)).join('·')}%` : ''; })(),
    ].filter(Boolean);
    return warn;
}
export function renderPlan() {
  S.pageSlide = null; const lineupTop = h('div', { class: 'lineuptop' }); // 가로 배치: 왼쪽 계약 목록, 오른쪽 위 고른 계약의 편성 카드 + 아래 검투사 목록
  // 계약 카드 (배정 칸 3개)
  const cpanel = h('div', { class: 'panel contracts' }, backBtn(() => { S.sheet = null; S.phase = 'manage'; render(); }, '포룸으로 돌아가기')); // 계약 벽: 왼쪽 위 낙서 뒤로가기 + 계약 4칸 (시즌당 최대 4건)
  for (const c of S.st.contracts) {
    const team = teamOf(c); const err = team.length ? validTeam(S.st, c, team) : `${c.size}명이 필요합니다`;
    const tired = team.filter(g => (g.fatigue ?? 0) > 0);
    const previewFull = c.enemyPreview.length === c.size; const classicNow = team.length === c.size && previewFull && classicMatchup(team.map(g => g.type), c.enemyPreview); // 상대가 전부 공개됐을 때만 확정
    const classicMaybe = team.length === c.size && !previewFull && c.enemyPreview.length > 0 && c.enemyPreview.every(t => team.some(g => classicMatchup([g.type], [t])));
    const classicPart = team.length > 0 && team.length < c.size && previewFull && (() => { const rest = [...c.enemyPreview]; for (const g of team) { const k = rest.findIndex(y => isClassicPair(g.type, y)); if (k < 0) return false; rest.splice(k, 1); } return true; })(); // 다 채우기 전: 지금까지는 짝이 맞는다
    const syn = computeSynergies(team);
    { // 계약 카드(왼쪽): 주최자 효과·규모·상대 강도·배정 현황. 누르면 오른쪽에 검투사 목록
      const H = HOST[c.host];
      // 효과 칩: 아이콘 + 값. 오르면 초록, 내리면 빨강 (Lucide: coins · scroll · hand · sword · heart · award · dice · shield)
      const chip = (icon: string, text: string, tone: 'up' | 'down' | 'flat', tip: string) => { const el = h('span', { class: `eff ${tone}`, title: tip }); el.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>`; el.append(text); return el; };
      const I = { coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>', scroll: '<path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/>', hand: '<path d="M18 11V6a2 2 0 0 0-4 0v1a2 2 0 0 0-4 0v2a2 2 0 0 0-4 0v6a6 6 0 0 0 12 0v-1"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/>', sword: '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/>', heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>', award: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>', dice: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 8h.01"/><path d="M16 16h.01"/><path d="M12 12h.01"/>', shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>', landmark: '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>', tent: '<path d="M3.5 21 14 3"/><path d="M20.5 21 10 3"/><path d="M15.5 21 12 15l-3.5 6"/><path d="M2 21h20"/>', swords: '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/><line x1="7" x2="4" y1="17" y2="20"/><line x1="3" x2="5" y1="19" y2="21"/>' };
      const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
      const scaleChip = chip(c.tier === 3 ? I.landmark : I.tent, c.tier === 3 ? '로마' : c.tier === 2 ? '큰 지방' : '소규모', 'flat', c.tier === 3 ? '황제·총독이 여는 로마의 대규모 경기 (등급 3)' : c.tier === 2 ? '큰 지방 도시의 경기 (등급 2): 베테라누스 필요, 거절하면 호감도가 깎인다' : '지방 소규모 무누스 (등급 1): 거절해도 벌점 없음');
      const dfc = difficultyBySim(c); const diffChip = dfc ? chip(I.swords, dfc.label === 'weak' ? '상대 약함' : dfc.label === 'strong' ? '상대 강함' : '상대 비슷', dfc.label === 'weak' ? 'up' : dfc.label === 'strong' ? 'down' : 'flat', `전력 식으로 비교: 내 최선 ${c.size}명 평균 전력이 상대의 ${Math.round(dfc.win * 100)}%`) : null; // 상대 강도: 편성의 우위·열세와 같은 계산
      const effChips = [ // 규모는 등급 칩 아래, 상대 강도는 경기장 오른쪽 위, 상금은 카드 왼쪽 아래에 크게
        H.rent !== 1 ? chip(I.scroll, `대여 ×${H.rent}`, H.rent > 1 ? 'up' : 'down', '대여료는 승패와 무관하게 출전마다 받는다') : null, // ×1 이면 칩을 내지 않는다 (자리 절약)
        H.missio ? chip(I.hand, `미시오 ${pct(H.missio)}`, H.missio > 0 ? 'up' : 'down', '쓰러진 검투사를 살려 줄 확률') : null,
        H.rudis ? chip(I.sword, `루디스 ${pct(H.rudis)}`, H.rudis > 0 ? 'up' : 'down', '승자에게 자유(나무 검)를 내릴 확률') : null,
        H.fameWin ? chip(I.heart, `호감 +${H.fameWin}`, 'up', '이기면 호감도를 더 준다') : null,
        H.honorAll ? chip(I.award, `명예 +${H.honorAll}`, 'up', '출전자 전원 명예') : null,
        H.bet ? chip(I.dice, c.bet ? '내기 받음' : '내기 가능', 'flat', '스폰시오: 이기면 상금 두 배, 지면 상금만큼 물어냄') : null,
        c.needVeterans ? chip(I.shield, `베테 ${c.needVeterans}명`, 'flat', '베테라누스가 이만큼 있어야 치를 수 있다') : null].filter((n): n is HTMLElement => !!n);
      cpanel.append(h('div', { class: `card contract detail${err ? '' : ' ready'}${S.planSel === c.id ? ' sel' : ''}`, onclick: () => { S.planSel = c.id; render(); } }, h('div', { class: 'arenacol' }, h('span', { class: 'aleft' }, h('span', { class: 'tierchip', title: c.tier === 3 ? '로마 대경기장' : c.tier === 2 ? '석조 원형경기장' : '목조 경기장' }, `등급 ${c.tier}`), scaleChip, diffChip), h('span', { class: 'aicon' }, arenaIcon(c.tier), !err ? graffitiCheck() : null)), // 왼쪽 등급 칩, 가운데 그림(준비되면 체크), 오른쪽 위 상대 강도 + 아래 배정 수
        h('div', { class: 'grow' },
          h('div', { class: 'ctitle' }, h('b', {}, c.venue)), // 이름 한 줄
          h('div', { class: 'cmeta' }, h('span', { class: `eff count${err ? '' : ' ok'}`, title: `상대 ${c.size}명 대 내 배정 ${team.length}명` }, `${c.size}대${team.length}`), hostSpan(c)), // 인원 칩('3대0', 조금 크게) · 주최자 한 줄
          h('div', { class: 'effrow' }, ...effChips),
          isImportant(c) && err && S.st.fame >= CONFIG.fameDelta.refuseFrom && canFulfill(S.st, c, new Set(S.st.contracts.filter(x => x !== c && teamOf(x).length === x.size && !validTeam(S.st, x, teamOf(x))).flatMap(x => S.assign[x.id] ?? []))) ? h('div', { class: 'cpen', title: '큰 경기(등급 2·3)는 검투사를 보내지 않으면 주최자가 실망해 호감도가 깎입니다. 배정을 마치면 사라집니다' }, h('span', { class: 'pdot' }), `불참 시 호감도 ${CONFIG.fameDelta.refuse}`) : null, // 벌점 칩: 큰 경기인데 아직 편성이 안 됐을 때만
          (() => { const pr = h('div', { class: `cprize${H.prize > 1 ? ' up' : H.prize < 1 ? ' down' : ''}`, title: `승리 상금${H.prize !== 1 ? ` (주최자 ×${H.prize})` : ''}${c.bet ? ' · 스폰시오로 두 배' : ''}` }); pr.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${I.coins}</svg>`; pr.append(h('b', {}, `${(hostPrize(c) * (c.bet ? 2 : 1)).toLocaleString()}`), h('span', { class: 'unit' }, 'HS')); return pr; })()))); // 상금: 왼쪽 아래에 금화 + 큰 숫자 (제일 중요한 정보)
      if (S.planSel !== c.id) continue;
    }
    // 왼쪽 편성 카드: 줄마다 하나씩. 제목 / 규모·주최 / 전력 / 상대(파밀리아 줄 + 검투사 한 줄씩) / 자리(베테라누스 몫은 금색 표시) / 시너지 / 비용 / 피로
    // 자리 배치: 베테라누스가 왼쪽 대장 자리 — [배정된 베테][베테 몫 빈 자리][티로][빈 자리]
    const vetsIn = team.filter(g => g.rank === 'veteranus'), tirosIn = team.filter(g => g.rank !== 'veteranus'), vetsLeft = Math.max(0, c.needVeterans - vetsIn.length);
    const slotList: ({ g: Gladiator } | { vet: true } | { empty: true })[] = [...vetsIn.map(g => ({ g })), ...Array.from({ length: vetsLeft }, () => ({ vet: true as const })), ...tirosIn.map(g => ({ g })), ...Array.from({ length: Math.max(0, c.size - team.length - vetsLeft) }, () => ({ empty: true as const }))];
    const rv = rivalOf(S.st.rivals, c.rivalId);
    const rentLine = team.length ? `대여료 ${Math.round(team.reduce((a, g) => a + rentFee(g, c.tier), 0) * HOST[c.host].rent).toLocaleString()} · 경비 −${fightExpense(team, c.tier).toLocaleString()}` : '';
    lineupTop.append(h('div', { class: `card contract sel lineup` },
      h('div', { class: 'grow' },
        h('div', { class: 'ltitle' }, h('span', { class: 'tierchip' }, `등급 ${c.tier}`), h('b', {}, c.venue)), /* 등급은 계약 카드와 같은 칩 */
        h('div', { class: 'lmeta' }, h('span', { class: `eff count${team.length === c.size ? ' ok' : ''}`, title: `상대 ${c.size}명 대 내 배정 ${team.length}명` }, `${c.size}대${team.length}`), hostSpan(c), h('button', { class: 'lview', title: `누르면 ${S.lineupView === 'record' ? '능력치' : '전적'}로 바뀝니다`, onclick: (ev: Event) => { ev.stopPropagation(); S.lineupView = S.lineupView === 'record' ? 'stats' : 'record'; render(); } }, S.lineupView === 'record' ? '전적' : '능력치', h('span', { class: 'sw' }, '⇄')), h('span', { class: 'lodds' }, err && team.length === c.size ? h('span', { class: 'req' }, err) : ratioSpan(powerRatio(team, c.enemy), team.length < c.size))), // 전력은 규모·주최 줄 오른쪽 끝에, 전력 식으로 (자리를 채우는 중에도 평균으로)
        h('div', { class: 'lenemy' }, h('div', { class: 'lfam' }, h('b', {}, rv ? rv.name : '타지 라니스타의 검투사'), rv ? h('span', { class: 'hint' }, ` (${recordVsMe(rv)})`) : ''), // 버튼 하나로 전적 ⇄ 능력치 스위칭 (양쪽 타일에 같이 적용)
          h('div', { class: 'etiles' }, ...c.enemy.map(e => { const spBy = S.st.roster.filter(g => (g.spared ?? []).includes(e.id)); const star = rv ? rivalStar(rv) : undefined; // 상대 검투사도 스틱맨 초상 타일로 (복수 표시는 우리 타일 쪽에)
            return h('div', { class: 'etile', title: `${TYPE_KO[e.type]} · ${e.rank === 'tiro' ? '티로' : '베테라누스'} · ${e.wins}승/${e.fights}전${(e.honor ?? 0) >= 30 ? ` · 명예 ${e.honor}` : ''}${(e.skills ?? []).length ? `\n기술 ${(e.skills ?? []).map(SKILL_NAME).join('·')}` : ''}` },
              ...miniGlad(e, { enemy: true, size: 40, meta: [star && star.id === e.id && ((star.honor ?? 0) >= 20 || star.wins >= 5) ? h('span', { class: 'badge star', title: '이 파밀리아의 간판 검투사' }, '간판') : null, spBy.length ? h('span', { class: 'badge grudge', title: `${spBy.map(g => g.name).join(', ')} 이(가) 살려 준 자. 재대결이면 공격 +10%, 그에게 지면 미시오 −15%` }, '원한') : null] })); }))),
        h('div', { class: 'lally' }, h('div', { class: 'lfam' }, h('b', {}, '우리 파밀리아'), h('span', { class: 'hint' }, ` (${team.length}/${c.size})`)), h('div', { class: 'slots' }, ...slotList.map(sl => { const g = 'g' in sl ? sl.g : null; const vet = 'vet' in sl; return h('span', { class: `slot${g ? ' filled' : ''}${vet ? ' vet' : ''}`, title: vet ? '대장 자리: 베테라누스만 들어갈 수 있습니다' : '', onclick: (ev: Event) => { ev.stopPropagation(); if (g) { S.assign[c.id] = S.assign[c.id].filter(x => x !== g.id); render(); } else { S.planSel = c.id; render(); } } }, ...(g ? miniGlad(g, { size: 40 }) : [h('span', { class: 'hint' }, vet ? '베테라누스' : '빈 자리')])); }))), // 우리 편도 상대 블록처럼 박스로 감싼다. 배정된 아군은 상대 타일과 같은 모양. 베테라누스 몫(왼쪽)은 금색
        h('div', { class: 'lsyn' }, ...describeSynergies(syn).map(t => h('span', { class: 'syn' }, t)), classicNow ? h('span', { class: 'syn classic' }, '전통 짝 ✓') : classicMaybe ? h('span', { class: 'syn classic maybe' }, '전통 짝 예상') : classicPart ? h('span', { class: 'syn classic maybe' }, `전통 짝 ${team.length}/${c.size}`) : null), // 항상 한 줄 자리를 잡아 둔다 (시너지가 생겨도 카드 높이가 안 흔들리게, '시너지 없음' 문구 없음)
        h('div', { class: 'meta lcost' }, rentLine), // 대여료 줄도 항상 자리 유지
        )));
  }
  for (let i = S.st.contracts.length; i < 4; i++) cpanel.append(h('div', { class: 'card contract empty' }, h('span', { class: 'hint' }, i === 0 && !S.st.contracts.length ? '이번 시즌 계약 없음' : '빈 칸'))); // 한 줄 4칸 고정: 남는 칸은 빈 칸으로
  // (출전 가능 인원 부족·시장 안내는 뺐다: 계약 페이지는 계약만)

  // 시즌 예상 수지
  const readyQ = S.st.contracts.filter(c => { const t = teamOf(c); return t.length === c.size && !validTeam(S.st, c, t); });
  const rentSum = readyQ.reduce((a, c) => a + Math.round(teamOf(c).reduce((b, g) => b + rentFee(g, c.tier), 0) * HOST[c.host].rent), 0);
  const expSum = readyQ.reduce((a, c) => a + fightExpense(teamOf(c), c.tier), 0);
  const trainN = palusTrainees(S.st).length; // 팔루스에 선 인원
  const trainRoom = trainCap(S.st) - trainN; // 빈 팔루스
  const upkeep = upkeepOf(S.st);
  const ready = readyQ.length;
  const evCost = EVENT_KEYS.reduce((a, k) => a + (S.eventPlan[k] ? CONFIG.events[k].cost : 0), 0), evN = EVENT_KEYS.filter(k => S.eventPlan[k]).length;
  // 시즌 예상 줄은 뺐다 (계약 페이지는 계약만)
  const goConfirm = () => { const ids = readyQ.map(c => c.id); if (ids.length) { S.tabletQueue = ids; S.tabletIdx = 0; S.seasonFrom = 'plan'; render(); } else openSeasonConfirm('plan'); }; // 준비된 계약이 있으면 서판부터, 없으면 바로 시즌 시작 확인
  // 벽 오른쪽 아래의 밀랍 서판: 집어 들면 시즌 시작 확인(계약서·행사·도장)으로. 준비된 계약 수를 붉은 표로
  const tabletBtn = h('button', { class: 'tabletbtn', title: ready ? `준비된 계약 ${ready}건\n경기로 넘어갑니다` : '경기로 넘어갑니다\n경기 없이 넘길 수도 있습니다', 'aria-label': '시즌 시작', onclick: goConfirm });
  // 폼페이 낙서풍 결투 그림: 왼쪽 큰 방패의 무르밀로가 찌르고, 오른쪽 작은 방패의 트라이크스가 받는다. 삐뚤한 겹선(검댕 + 붉은 덧선)
  tabletBtn.innerHTML = DUEL_SVG;
  tabletBtn.prepend(h('span', { class: 'tword', title: '폼페이 광고 벽화의 정형구: (검투사들이) 싸울 것이다' }, 'PVGNABVNT')); // 그림 옆에 긁어 쓴 공고 정형구 (pugnabunt = 싸울 것이다) if (ready) tabletBtn.append(h('span', { class: 'nbadge' }, String(ready)));
  if (ready) tabletBtn.append(h('span', { class: 'nbadge' }, String(ready))); // 준비된 계약 수
  cpanel.append(tabletBtn);
  const bar = h('div'); // 편성 단계에는 하단 띠가 없다 (결투 낙서가 다음 단계)
  const tools = sideToolsLand([]); // 행사는 시즌 시작 확인 페이지에서 고른다
  // 검투사 목록: 배정/훈련
  const selC0 = S.planSel != null ? S.st.contracts.find(x => x.id === S.planSel) : null;
  const pleft = h('div', { class: 'pleft' }), pright = h('div', { class: 'pright' }); const rpanel = h('div', { class: 'panel roster' }, pleft, pright); // 편성 페이지: 왼쪽 공고·자리, 오른쪽 검투사 초상 격자
  if (selC0) pleft.append(lineupTop);

  // 추천: 이미 넣은 검투사와 시너지(방패벽·사냥조·경중 조합·계보)나 전통 짝이 생기는 검투사
  const teamSel = selC0 ? teamOf(selC0) : [];
  const synCount = (team: Gladiator[]) => describeSynergies(computeSynergies(team)).length;
  const baseSyn = synCount(teamSel);
  const classicPartial = (mine: GType[], theirs: GType[]) => { const rest = [...theirs]; for (const x of mine) { const k = rest.findIndex(y => isClassicPair(x, y)); if (k < 0) return false; rest.splice(k, 1); } return true; }; // 지금까지 넣은 이들이 전부 상대 누군가와 전통 짝이 되는가
  const recommend = (g: Gladiator): string | null => { if (!selC0 || teamSel.includes(g)) return null; const withG = [...teamSel, g];
    const gained = teamSel.length ? synCount(withG) - baseSyn : 0; if (gained > 0) { const before = new Set(describeSynergies(computeSynergies(teamSel))); return describeSynergies(computeSynergies(withG)).filter(t => !before.has(t)).join('·'); }
    if (selC0.enemyPreview.length === selC0.size) { const types = withG.map(x => x.type); if (withG.length === selC0.size ? classicMatchup(types, selC0.enemyPreview) : classicPartial(types, selC0.enemyPreview)) return '전통 짝'; } return null; }; // 1대1이나 첫 배정에서도, 아직 다 안 채웠어도 짝이 이어지면 알린다 (전에는 마지막 한 명을 넣을 때만 보였다)
  for (const g of selC0 ? S.st.roster : []) {
    const at = assignedTo(g.id); const c = at != null ? S.st.contracts.find(x => x.id === at) : null;
    const selC = S.planSel != null ? S.st.contracts.find(x => x.id === S.planSel) : null;
    const isDoc = g.status === 'doctor';
    // 조건: 고른 계약의 남은 자리가 모두 베테라누스 몫이면 티로는 넣을 수 없다 (validTeam 의 베테라누스 조건을 미리 적용)
    const elsewhere0 = at != null && selC != null && at !== selC.id; // 다른 계약에 배정됨
    const unfulfillable = !!selC && at == null && !canFulfill(S.st, selC); // 치를 수 없는 계약(베테라누스·인원 부족)이면 아무도 넣지 않는다
    const vetBlock = (() => { if (!selC || (at != null && !elsewhere0) || g.rank === 'veteranus') return false; const team = (S.assign[selC.id] ?? []).map(id => S.st.roster.find(x => x.id === id)).filter((x): x is Gladiator => !!x); const left = selC.size - team.length, vetsLeft = selC.needVeterans - team.filter(x => x.rank === 'veteranus').length;
      const freeVets = S.st.roster.filter(v => v.rank === 'veteranus' && v.alive && !v.injured && !v.fought && v.status !== 'doctor' && assignedTo(v.id) == null).length; // 아직 넣을 수 있는 베테라누스
      return left > 0 && vetsLeft > 0 && (vetsLeft >= left || freeVets < vetsLeft); })(); // 다른 계약에 있는 티로도 이 계약의 베테 몫 자리에는 못 온다
    const canAssign = !g.injured && !g.fought && !isDoc && at == null && selC != null && (S.assign[selC.id]?.length ?? 0) < selC.size && !vetBlock && !unfulfillable;
    // 교체 뒤에도 베테라누스 조건을 채우는가 (마지막 자리의 베테라누스를 티로로 바꾸면 안 된다)
    // 교체 대상: 화면의 마지막 자리 = 마지막에 넣은 티로. 티로가 없으면 마지막 베테라누스. (베테를 왼쪽 대장 자리에 두므로 '마지막에 넣은 사람'이 아니라 자리 순서로)
    const swapTarget = (() => { if (!selC) return null; const ids = S.assign[selC.id] ?? []; if (ids.length < selC.size) return null; const gl = ids.map(id => S.st.roster.find(x => x.id === id)).filter((x): x is Gladiator => !!x); const tiros = gl.filter(x => x.rank !== 'veteranus'); return (tiros.length ? tiros[tiros.length - 1] : gl[gl.length - 1]) ?? null; })();
    const swapKeepsVets = (() => { if (!selC) return false; const ids = S.assign[selC.id] ?? []; if (ids.length < selC.size) return true; if (!swapTarget) return false; const team = ids.filter(id => id !== swapTarget.id).map(id => S.st.roster.find(x => x.id === id)).filter((x): x is Gladiator => !!x); const vets = team.filter(x => x.rank === 'veteranus').length + (g.rank === 'veteranus' ? 1 : 0); return vets >= selC.needVeterans; })();
    const canSwap = !g.injured && !g.fought && !isDoc && at == null && selC != null && (S.assign[selC.id]?.length ?? 0) >= selC.size && !unfulfillable && swapKeepsVets; // 자리가 다 찼으면 마지막 자리(티로)와 교체
    const swapVetBlock = !g.injured && !g.fought && !isDoc && at == null && selC != null && (S.assign[selC.id]?.length ?? 0) >= selC.size && !unfulfillable && !swapKeepsVets;
    if (isDoc) { // 독토르도 같은 미니 카드 문법으로 보이게 접는다
      pright.append(h('div', { class: 'gtile dis' }, ...miniGlad(g, { size: 56, meta: [h('span', { class: 'badge doc' }, '독토르')] })));
      continue;
    }
    const elsewhere = at != null && selC != null && at !== selC.id; // 다른 계약에 배정됨: 누르면 그 계약에서 빼고 이 계약에 넣는다 (자리가 없으면 마지막과 교체)
    const rec = elsewhere ? recommend(g) : null;
    const fat = g.fatigue ?? 0;
    const tagNode = null; // 피로·부상은 표의 숫자로 (칩 없음)
    const elseSwapBlock = elsewhere && !!selC && (S.assign[selC.id]?.length ?? 0) >= selC.size && !swapKeepsVets; // 다른 계약의 티로: 이 계약이 찼고 교체하면 베테 조건이 깨지면 못 온다
    // 베테 조건으로 막힌 티로는 칩 없이 흐리게만 (왼쪽 금색 베테 자리가 이유를 말한다)
    const stateNode = elsewhere ? null : at != null ? h('span', { class: 'badge sel', title: '이 계약에 배정됨. 다시 누르면 뺀다' }, '출전') : g.injured ? null : g.fought ? h('span', { class: 'badge injured', title: '이번 시즌 이미 출전' }, '출전 완료') : swapVetBlock ? null : rec ? h('span', { class: 'badge rec' }, `추천 ${rec}`) : canSwap ? h('span', { class: 'hint', title: `누르면 ${swapTarget?.name ?? '마지막'} 과 교체` }, '교체') : canAssign && recommend(g) ? h('span', { class: 'badge rec', title: `함께 넣으면 ${recommend(g)}` }, `추천 ${recommend(g)}`) : unfulfillable ? h('span', { class: 'badge injured', title: '이 계약은 조건(베테라누스·인원)을 채울 수 없어 배정할 수 없습니다' }, '조건 미달') : null;
    const dis = !!g.injured || isDoc || vetBlock || swapVetBlock || elseSwapBlock || unfulfillable || (!!selC && at == null && !!g.fought);
    const revengeOn = selC ? selC.enemy.filter(e => (g.beatenBy ?? []).includes(e.id)) : []; const revengeNode = revengeOn.length ? h('span', { class: 'badge revenge', title: `${revengeOn.map(e => e.name.replace('(적)', '')).join(', ')} 에게 진 적이 있다. 꺾으면 복수 (명예 +8, '복수자')` }, '복수') : null; // 복수 기회는 우리 검투사 타일에
    const tip = `${TYPE_KO[g.type]} · ${g.rank === 'tiro' ? '티로' : '베테라누스'} · ${LINEAGE_KO[g.lineage]} · ${g.age ?? '?'}세\nHP ${g.base.hp} 공 ${g.base.atk} 방 ${g.base.def} 속도 ${g.base.spd} 사거리 ${g.base.range}\n${g.wins}승/${g.fights}전 · 미시오 ${g.missios} · 명예 ${g.honor ?? 0}${skillsOf(g).length ? `\n기술 ${skillsOf(g).map(SKILL_NAME).join('·')}` : ''}\n시즌 행동: ${ACTION_KO[planOf(g)]}`;
    pright.append(h('div', { class: `gtile${at != null && !elsewhere ? ' sel' : ''}${elsewhere ? ' other' : ''}${dis ? ' dis' : ''}`, title: tip,
      onclick: () => { if (at != null && !elsewhere) { S.assign[at] = S.assign[at].filter(x => x !== g.id); render(); } /* 다시 누르면 해제 */ else if (elsewhere && selC && !unfulfillable && swapKeepsVets && !vetBlock) { S.assign[at!] = S.assign[at!].filter(x => x !== g.id); const list = (S.assign[selC.id] ??= []); if (list.length >= selC.size && swapTarget) S.assign[selC.id] = list.filter(x => x !== swapTarget.id); (S.assign[selC.id] ??= []).push(g.id); render(); } else if (canAssign && selC) { (S.assign[selC.id] ??= []).push(g.id); render(); } else if (canSwap && selC && swapTarget) { S.assign[selC.id] = S.assign[selC.id].filter(x => x !== swapTarget.id); S.assign[selC.id].push(g.id); render(); } } }, // 교체: 화면 마지막 자리(티로)를 빼고 이 검투사를 넣는다
      ...miniGlad(g, { size: 56, meta: [fat >= 2 ? h('span', { class: `badge ${fat >= 3 ? 'injured' : 'warn'}`, title: `피로 ${fat}: 계속 출전하면 과로 위험이 오른다` }, `피로 ${fat}`) : null, stateNode, revengeNode, tagNode] }), elsewhere ? h('div', { class: 'tstamp', title: `${S.st.contracts.find(x => x.id === at)?.venue ?? '다른 계약'}에 배정됨. 누르면 이 계약으로 옮긴다` }, h('span', {}, 'LOCATVS')) : null)); // 초상 타일. 다른 계약에 빌려준 검투사는 도장(LOCATVS): 누르면 왼쪽 자리로 (교체: 마지막 자리를 빼고 이 검투사를 넣는다)
  }
  { const c = coach(); if (c) pleft.append(c); }
  app.classList.add('land', 'plan'); const frag = document.createDocumentFragment(); frag.append(tools, cpanel, bar);
  if (selC0) { // 편성 페이지: 상세 페이지처럼 오른쪽에서 밀려 들어온다. 같은 계약이면(카드를 눌러 재렌더) 그 자리에
    const again = S.shownPlan === selC0.id; S.shownPlan = selC0.id;
    const teamNow = teamOf(selC0); const done = teamNow.length === selC0.size && !validTeam(S.st, selC0, teamNow);
    frag.append(h('div', { class: `planpage${again ? ' still' : ''}` }, rpanel, backBtn(closePlanPage, '계약 벽으로 돌아가기'))); // 배정은 뒤로가기로 마친다 (서명은 결투 낙서를 누를 때 계약마다)
    void done;
  }
  if (S.tabletQueue) { const cs = S.tabletQueue.map(id => S.st.contracts.find(x => x.id === id)).filter((c): c is Contract => !!c); if (cs.length) frag.append(tabletsPage(cs)); else S.tabletQueue = null; }
  if (S.seasonConfirm) frag.append(seasonConfirmPage(seasonWarnings()));
  return frag; // 가로: 토글 띠 · 계약 4칸 · 버튼 (+ 편성 페이지 · 시즌 시작 확인)
}
// 시즌 넘기기: 계약 벽(광고)·서판을 거치지 않고 마을에서 바로 시즌 진행 창을 연다. 배정해 둔 계약이 있으면 그대로 치른다
export function openSeasonConfirm(from: 'plan' | 'manage') { S.seasonFrom = from; S.seasonConfirm = true; S.shownSeason = false; if (from === 'manage') { S.sheet = null; S.cellsOpen = false; S.cellPop = null; S.bedPick = null; S.palusMode = false; } render(); }
function closeSeasonConfirm() { const el = document.querySelector('.planpage.season'); S.shownSeason = false; const done = () => { S.seasonConfirm = false; render(); }; if (!el) { done(); return; } el.classList.add('closing'); window.setTimeout(done, 280); } /* 뒤로가기: 온 곳(계약 벽이든 마을이든)이 그대로 남아 있으므로 창만 닫는다 */
export function seasonConfirmPage(warn: string[]): Node {
  const E = CONFIG.events; const evCost = EVENT_KEYS.reduce((a, k) => a + (S.eventPlan[k] ? E[k].cost : 0), 0);
  const again = S.shownSeason; S.shownSeason = true;
  let stamped = false; const stampText = 'INCIPIT'; // 시작하다 — 경기의 막이 오른다
  const start = () => { if (stamped) return; stamped = true; const page = document.querySelector('.planpage.season'); if (page) page.append(h('div', { class: 'stamp' }, h('span', {}, stampText))); sfx.down(); window.setTimeout(() => sfx.drum(1), 40);
    window.setTimeout(() => { S.seasonConfirm = false; S.shownSeason = false; S.seasonFrom = 'plan'; startSeason(); }, 900); };
  const left = h('div', { class: 'scol warn' }, h('h3', {}, '시즌 시작 전에'),
    ...(warn.length ? warn.map(w => { const [f, ...rest] = w.split('\n'); return h('div', { class: 'wblock' }, h('div', { class: 'flavor' }, f), ...rest.map(r => h('div', { class: 'effect' }, r))); }) : [h('div', { class: 'flavor' }, '준비가 끝났습니다. 검투사들이 문 앞에 서 있습니다.')]));
  const right = h('div', { class: 'scol events' }, h('h3', {}, '시즌 행사', h('span', { class: 'hint', style: 'margin-left:6px' }, '이 시즌에만 효과')), ...eventRows());
  return h('div', { class: `planpage season${again ? ' still' : ''}` }, h('div', { class: 'scols' }, left, right),
    h('div', { class: 'cbox row sfoot' }, evCost ? moneyRow({ amount: evCost, verb: '지불' }) : h('div'), // 행사가 없으면 빈 자리, 있으면 금액만
      h('div', { class: 'cbtns' }, h('button', { class: 'sealbtn', title: '도장을 찍어 시즌을 시작합니다', onclick: start }, h('span', { class: 'latin' }, stampText), h('span', { class: 'ko' }, '시즌 시작')))),
    backBtn(closeSeasonConfirm, S.seasonFrom === 'manage' ? `${VIEW_KO[S.view]}${ro(VIEW_KO[S.view])} 돌아가기` : '계약으로 돌아가기'));
}
// ── 3단계: 시즌 진행
function startSeason() {
  const moneyBefore = S.st.money; // 행사 결제 전 잔액 (정산 기준)
  const held = holdEvents(S.st, S.eventPlan); S.eventPlan = { cena: false, pompa: false, votum: false, edicta: false, guests: false };
  if (EVENT_KEYS.some(k => held[k])) S.notice = `행사: ${EVENT_KEYS.filter(k => held[k]).map(k => EVENT_KO[k]).join(', ')}`;
  S.queue = S.st.contracts.map(c => ({ c, team: (S.assign[c.id] ?? []).map(id => S.st.roster.find(g => g.id === id)!).filter(Boolean) })).filter(q => q.team.length === q.c.size && !validTeam(S.st, q.c, q.team));
  S.seasonReports = []; S.skipped = []; S.seasonSummary = { upkeep: 0, gift: 0, trained: [], acted: [], before: moneyBefore, fameBefore: S.st.fame, refused: 0, skipped: [], label: seasonName(S.st.season), events: { ...held } };
  S.phase = 'battle'; save();
  nextFight();
}
export function nextFight() {
  let q = S.queue.shift(); const lost: string[] = [];
  while (q && validTeam(S.st, q.c, q.team)) { S.skipped.push(q.c); lost.push(`${q.c.venue} (${q.c.size}대${q.c.size}) — ${validTeam(S.st, q.c, q.team)}`); q = S.queue.shift(); } // 앞 경기의 부상·사망으로 팀이 깨진 계약은 건너뜀 (거절 벌점 없음: 아래 finishSeason 참고)
  if (lost.length) { const next = q; void tell(`앞 경기의 부상·사망으로 다음 계약을 치를 수 없습니다.\n${lost.join('\n')}\n거절 벌점은 없습니다.`, '무산된 경기').then(() => { if (!next) { finishSeason(); return; } S.report = fight(S.st, next.c, next.team); S.seasonReports.push(S.report); renderBattle(); }); return; }
  if (!q) { finishSeason(); return; }
  S.report = fight(S.st, q.c, q.team);
  S.seasonReports.push(S.report);
  renderBattle();
}
function finishSeason() {
  const label = seasonName(S.st.season); const fameBefore0 = S.st.fame - S.seasonReports.reduce((a, r) => a + r.fameDelta, 0); // 경기 전 호감도
  // 훈련 처리
  const trained: { g: Gladiator; stat: 'atk' | 'def' }[] = [];
  const acted: { g: Gladiator; act: Action; note: string }[] = [];
  for (const g of S.st.roster) { if (g.status === 'doctor' || !g.alive) continue; const tp: Action = planOf(g);
    if (palusOf(S.st, g) >= 0) { const k = rollTraining(g); // 팔루스에 선 검투사: 무엇을 단련할지 무작위. 자리 수만큼만 서 있으니 상한을 넘지 않는다. 출전했으면 피로가 쌓일 수 있다(train 안에서)
      if (k === 'skill') { const r = doSkillTrain(S.st, g); if (r) acted.push({ g, act: 'skill', note: `${SKILL_BY_ID[r.id].name} ${r.ok ? '깨침 — 돌아오면 배울지 정합니다' : '실패'}` }); else acted.push({ g, act: 'rest', note: '기술 훈련 못 함 (돈·조건)' }); }
      else if (train(S.st, g, k)) trained.push({ g, stat: k }); else acted.push({ g, act: 'rest', note: '훈련 못 함 (돈 부족)' });
      continue; }
    if (assignedTo(g.id) != null || g.fought) continue; // 출전만 한 검투사는 따로 행동 없음
    if (g.injured > 0) { if (doRecover(S.st, g)) acted.push({ g, act: 'recover', note: '회복 가속' }); } // 부상자는 자동 요양
    else if ((g.fatigue ?? 0) > 0) { /* 피로가 있으면 휴식 (endSeason 이 피로를 내린다) */ }
    else { const r = doShow(S.st, g); if (r) acted.push({ g, act: 'show', note: `명예 +${r.honor}` }); } } // 팔루스에 안 선 건강한 검투사는 자동 시범 (사용자: 시즌 행동을 고르지 않게)
  const skippedNow = [...S.skipped];
  if (S.skipped.length) S.st.contracts = S.st.contracts.filter(c => !S.skipped.includes(c)); // 무산된 계약은 벌점 없이 소멸
  const refused = S.st.contracts.length ? refuseAll(S.st) : 0;
  const eventsHeld = { ...(S.st.events ?? { cena: false, pompa: false, votum: false, edicta: false, guests: false }) }; // endSeason 이 초기화하므로 미리 보관
  const { upkeep, gift } = endSeason(S.st);
  S.seasonSummary = { upkeep, gift, trained, acted, before: S.seasonSummary?.before ?? S.st.money, fameBefore: fameBefore0, refused, skipped: skippedNow, label, events: eventsHeld };
  S.assign = {}; S.trainPlan = {}; savePlan(); S.planSel = null; // 시즌 행동은 시즌마다 다시 (기본 휴식). 팔루스에 선 검투사는 그대로 서 있다
  S.phase = S.st.over ? 'over' : 'summary';
  render();
}
