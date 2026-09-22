// 진입점: 부트스트랩(무대·저장·초기 상태)·render() 분배·헤더 아래 서판 토글·탭 바
import { S, randomColor } from './state.js';
import { LEGEND_BY_ID } from '../core/legends.js';
import { sfx, unlockAudio } from './sound.js';

import { available, deserialize, newGame, palusTrainees, serialize, fight, type GameState, acceptChallenge, declineChallenge, rivalOf, rivalStar } from '../core/game.js';
import { makeGladiator } from '../core/gladiator.js';
import { HOSTS_BY_TIER } from '../core/hosts.js';
import { Rng } from '../core/rng.js';
import { renderBattle } from './battle-view.js';
import { TYPES } from '../core/gladiator.js';
import { CONFIG } from '../core/config.js';

import type { GType, Contract } from '../core/types.js';
import { h, hideTip, isAction, isChip, showTip, tipTarget, toast } from './dom.js';
import { startPortraitLoop } from './portrait.js';
import { coach, headerBox, headerEl } from './header.js';
import { renderSheet, renderSheetBody } from './sheets.js';
import { confirmPage, detailPage, gladSheet } from './detail.js';
import { cellPanel } from './cells.js';
import { renderOver, renderSuccession, renderSummary } from './summary.js';
import { renderPlan, seasonConfirmPage, seasonWarnings, tabletsPage } from './plan.js';
import { CELLS_MIN_H, TOWN_H, VIEW_W, renderTown } from './town.js';
import { gladCard, CARD_PORTRAIT } from './gcard.js'; /* 검투사 카드는 한 종류 (2026-09-17) */

export const app = document.getElementById('app')!;
 // 마을 장면의 보이는 폭 (월드 단위): 라니스타 주변만, 이웃 장소는 걸어가서 본다
const STAGE_W = 400, STAGE_H = 800; // 무대 폭 · 기준 높이 (세로 화면에서는 화면 비율대로 600~900, 가로 화면에서는 800 고정)
 // 무대 폭 · 기준 높이 (세로 화면에서는 화면 비율대로 600~900, 가로 화면에서는 800 고정)
function fitStage() {
  const stage = document.getElementById('stage'); const probe = document.getElementById('safe-probe'); if (!stage) return;
  const cs = probe ? getComputedStyle(probe) : null; const ins = { t: parseFloat(cs?.paddingTop ?? '0') || 0, r: parseFloat(cs?.paddingRight ?? '0') || 0, b: parseFloat(cs?.paddingBottom ?? '0') || 0, l: parseFloat(cs?.paddingLeft ?? '0') || 0 };
  const aw = innerWidth - ins.l - ins.r, ah = innerHeight - ins.t - ins.b;
  let k: number, hgt: number;
  if (aw < ah) { k = aw / STAGE_W; hgt = Math.round(Math.max(600, Math.min(900, ah / k))); } // 세로 화면(폰): 폭을 무대에 맞추고 높이는 화면 비율대로
  else { hgt = STAGE_H; k = Math.min(ah / hgt, aw / STAGE_W); } // 가로 화면(PC·옆으로 든 폰): 폰 모양 무대 400×800 을 높이에 맞춰 가운데 세운다
  stage.style.width = `${STAGE_W}px`; stage.style.height = `${hgt}px`; stage.style.transform = `translate(-50%, -50%) scale(${k})`; stage.style.left = `${ins.l + aw / 2}px`; stage.style.top = `${ins.t + ah / 2}px`;
  document.documentElement.style.setProperty('--stage-k', String(k)); document.documentElement.style.setProperty('--stage-w', `${STAGE_W}px`); document.documentElement.style.setProperty('--stage-h', `${hgt}px`);
}
addEventListener('resize', fitStage);
 addEventListener('orientationchange', () => setTimeout(fitStage, 50));
 fitStage();
document.addEventListener('pointerdown', () => unlockAudio(), { capture: true });
const SAVE_KEY = 'lanista-save';
export const DEBUG = /[?&]debug/.test(location.search); // 테스트용 버튼(건너뛰기·결과 보기) 표시
 // 테스트용 버튼(건너뛰기·결과 보기) 표시
function loadSave(): GameState | null { try { const raw = localStorage.getItem(SAVE_KEY); return raw ? deserialize(JSON.parse(raw)) : null; } catch { return null; } }
export function save() { if (FIGHT_PARAM) return; /* 디버그 전투는 저장을 건드리지 않는다 */ try { localStorage.setItem(SAVE_KEY, JSON.stringify(serialize(S.st))); } catch { /* 저장 불가 환경 */ } }
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch {} }
const saved = loadSave();
S.st = saved ?? newGame(Number(location.hash.slice(1)) || Math.floor(Math.random() * 100000));
S.resumed = !!saved;
S.showIntro = !saved && localStorage.getItem('lanista-intro') !== '1';
S.coachOff = localStorage.getItem('lanista-coach') === '1'; // 첫 시즌 안내를 껐는가 (2번째 시즌부터는 자동으로 끝)
// ── 전투 장면 디버그 (2026-09-19 사용자): ?debug&fight=우리:상대 — 유형을 쉼표로, '?' 는 무작위. 시드는 #N. 저장을 건드리지 않고 경기 하나만 굴려 바로 전투 장면으로 간다
// 예: ?debug&fight=eques,retiarius:murmillo,thraex#42 · ?debug&fight=?:?  결과 화면에서 '다시 (시드 +1)' 로 반복
export const FIGHT_PARAM = DEBUG ? new URLSearchParams(location.search).get('fight') : null;
export const DEBUG_SEED = () => Number(location.hash.slice(1)) || 1;
export function debugFight(spec: string) {
  const seed = DEBUG_SEED(); const rng = new Rng(seed * 7919 + 1);
  const parse = (s: string): (GType | `L:${string}`)[] => s.split(',').map(x => x.trim()).filter(Boolean).map(x => (x === '?' ? rng.pick(TYPES) : LEGEND_BY_ID[x] ? `L:${x}` : x) as GType | `L:${string}`).filter(t => TYPES.includes(t as GType) || String(t).startsWith('L:')); /* 전설 id(flamma …)를 쓰면 그 인물로 (2026-09-22) */
  const mk = (r: Rng, t: GType | `L:${string}`) => String(t).startsWith('L:') ? makeGladiator(r, 'veteranus', { season: 3, legend: String(t).slice(2) }) : makeGladiator(r, 'veteranus', { season: 3, type: t as GType });
  const [mineS, theirsS = '?'] = spec.split(':'); const mine = parse(mineS), theirs = parse(theirsS);
  if (!mine.length || !theirs.length) return false;
  const st = newGame(seed); st.roster = mine.map((t, i) => { const g = mk(new Rng(seed * 31 + i), t); g.boughtSeason = 1; return g; });
  const enemy = theirs.map((t, i) => mk(new Rng(seed * 53 + i), t));
  const size = Math.min(3, Math.max(mine.length, theirs.length)) as 1 | 2 | 3;
  const c = { id: 9999, tier: 1 as const, venue: '디버그 경기장', host: HOSTS_BY_TIER[1][0], needVeterans: 0, size, enemy, enemyPreview: enemy.map(e => e.type), accepted: [] as never[] };
  st.contracts = [c]; S.st = st; S.resumed = false; S.showIntro = false; S.setup = null; S.assign = {}; S.trainPlan = {};
  S.queue = []; S.seasonReports = []; S.skipped = [];
  S.report = fight(st, c, st.roster); S.seasonReports.push(S.report); S.phase = 'battle'; return true;
}
 // 첫 실행: 제목 화면 (관중 함성과 함께)
S.phase = 'manage';
// 편성: 계약별 배정, 미배정 검투사의 훈련 선택
S.assign = {};            // contractId → gladiator ids
            // contractId → gladiator ids
S.trainPlan = (() => { try { return JSON.parse(localStorage.getItem('lanista-plan') ?? '{}'); } catch { return {}; } })(); // gladiator id → 시즌 행동 (켈라에서 정한다, 새로고침해도 유지)
 // 팔루스에 선 검투사가 단련할 것: 공·방, 기술을 배울 조건이 되면 기술도 후보
S.planSel = null;                    // 편성 중 선택된 계약 id
                    // 편성 중 선택된 계약 id
S.queue = [];
S.skipped = []; // 앞 경기 부상·사망으로 무산된 계약 // 시즌 진행 중 남은 경기
 // 앞 경기 부상·사망으로 무산된 계약 // 시즌 진행 중 남은 경기
S.marketSel = null;                  // 시장에서 선택한 검투사 id
                  // 시장에서 선택한 검투사 id
export type View = 'medic' | 'yard' | 'ludus' | 'market' | 'grave'; // 관리 단계의 장소: 의무실 · 훈련소 · 정문(루두스 문 앞) · 시장. 좁은 화면이라 루두스를 세 장면으로 나눈다
 // 관리 단계의 장소: 의무실 · 훈련소 · 정문(루두스 문 앞) · 시장. 좁은 화면이라 루두스를 세 장면으로 나눈다
export const VIEW_KO: Record<View, string> = { medic: '의무실', yard: '훈련소', ludus: '포룸', market: '시장', grave: '묘지' }; // ludus = 포룸(광장): 정문 밖 광장에서 계약·지원자·소식
 // ludus = 포룸(광장): 정문 밖 광장에서 계약·지원자·소식
S.view = 'ludus';
S.travel = null; // 이동 전환 중
 // 이동 전환 중
S.seasonReports = [];
S.seasonSummary = null;
S.report = null;
S.notice = '';
S.helpSec = null;
S.sheet = null; // news·market·medic·yard·applicants: 대시보드를 대신하는 서랍 // glad: 켈라 방을 누르면 여는 검투사 카드 시트 (검투사 목록 시트를 대신한다)
 // news·market·medic·yard·applicants: 대시보드를 대신하는 서랍 // glad: 켈라 방을 누르면 여는 검투사 카드 시트 (검투사 목록 시트를 대신한다)
S.gladSel = null; // 검투사 시트에 보이는 검투사 id
 // 검투사 시트에 보이는 검투사 id
S.detailSwipe = null;
S.setup = saved ? null : { color: randomColor() }; // 저장이 없으면 새 게임 설정부터
S.detail = null; // solo: 장면에서 바로 연 확인 페이지 (밑에 상세 없음, 닫으면 장면으로) // confirm: 매각·내보내기·구매는 오른쪽으로 한 번 더 넘어가는 확인 페이지
 // solo: 장면에서 바로 연 확인 페이지 (밑에 상세 없음, 닫으면 장면으로) // confirm: 매각·내보내기·구매는 오른쪽으로 한 번 더 넘어가는 확인 페이지
S.cellDrag = null; // 켈라에서 스틱맨을 끌어 방을 바꾼다 (캔버스 좌표) // 검투사 상세 페이지 (오른쪽에서 밀려 들어옴). roster: 내 검투사, market: 시장 노예
 // 켈라에서 스틱맨을 끌어 방을 바꾼다 (캔버스 좌표) // 검투사 상세 페이지 (오른쪽에서 밀려 들어옴). roster: 내 검투사, market: 시장 노예
S.cellSel = 0; // 켈라에서 고른 칸
 // 켈라에서 고른 칸
S.cellSide = null; // 가로 배치: 켈라가 열려 있을 때 오른쪽 칸에 무엇을 보일지 (검투사 시트 / 빈 방 / 안내)
 // 가로 배치: 켈라가 열려 있을 때 오른쪽 칸에 무엇을 보일지 (검투사 시트 / 빈 방 / 안내)
S.cellPop = null; // fresh: 처음 열릴 때만 펼침 애니메이션 // 켈라 팝오버: 누른 방의 화면 좌표(중심)에서 펼쳐진다
 // fresh: 처음 열릴 때만 펼침 애니메이션 // 켈라 팝오버: 누른 방의 화면 좌표(중심)에서 펼쳐진다
S.cellsOpen = false;
 S.cellsP = 0;
S.bedPick = null; // 빈 침상을 눌러 켈라에서 부상자를 고르는 중 (침상 번호)
 // 빈 침상을 눌러 켈라에서 부상자를 고르는 중 (침상 번호)
S.palusMode = false; // 팔루스 배정 모드: 훈련소에서 기둥을 누르면 켈라가 열리고, 방을 누르면 빈 팔루스에 세우고 다시 누르면 내려온다 (자리는 고르지 않는다)
 // 팔루스 배정 모드: 훈련소에서 기둥을 누르면 켈라가 열리고, 방을 누르면 빈 팔루스에 세우고 다시 누르면 내려온다 (자리는 고르지 않는다)
S.offerPage = 0; // 새 기술 모달: 보고 있는 검투사 순번 // 켈라 화면: 디스플레이 아래에서 위로 올라온다 (0~1) // 화면 위에 여는 시트(모달). 스크롤 대신 시트로 상세를 본다
 // 인라인 SVG (Lucide circle-help 형태), 파일 요청 없음
// 커스텀 드롭다운: 네이티브 select 는 펼친 목록을 꾸밀 수 없어서 버튼 + 목록으로 만든다. 열림 상태는 key 로 기억 (render 가 다시 그려도 유지)
S.ddOpen = null;
document.addEventListener('pointerdown', (ev) => { if (S.ddOpen && !(ev.target as Element).closest?.('.dd')) { S.ddOpen = null; document.querySelectorAll('.dd.open').forEach(d => d.classList.remove('open')); } }, { capture: true });
S.eventPlan = { cena: false, pompa: false, votum: false, edicta: false, guests: false }; // 편성 화면에서 고른 시즌 행사 // 대시보드 맨 위에 한 번 보여줄 알림
// ── 말풍선(툴팁): data-tip 이 있는 요소를 폰에서 길게 누르거나(450ms), 버튼이 아닌 요소는 탭하면, PC 에서는 마우스를 올리면 보인다
S.tipEl = null;
 S.tipFor = null;
 S.tipTimer = 0;
 S.tipSuppressClick = false;
document.addEventListener('pointerdown', (ev) => { hideTip(); clearTimeout(S.tipTimer); const t = tipTarget(ev); if (!t) return;
  if (ev.pointerType === 'mouse') return; // 마우스는 호버로
  S.tipTimer = window.setTimeout(() => { showTip(t); S.tipSuppressClick = true; }, 450); }, { capture: true });
document.addEventListener('pointerup', () => clearTimeout(S.tipTimer), { capture: true });
document.addEventListener('pointercancel', () => clearTimeout(S.tipTimer), { capture: true });
document.addEventListener('click', (ev) => { if (S.tipSuppressClick) { S.tipSuppressClick = false; ev.stopPropagation(); ev.preventDefault(); return; } // 길게 눌러 말풍선을 봤으면 그 클릭은 동작하지 않는다
  const t = tipTarget(ev); if (t && (!isAction(t) || (isChip(t) && !t.closest('.card.contract.detail, .gtile, .slot, .etile, .gcard')))) { showTip(t); ev.stopPropagation(); } }, { capture: true }); // 칩(배지·효과 칩·타일)은 카드 안에 있어도 탭하면 말풍선 — 단 계약 광고 카드와 **검투사 카드**에서는 탭이 카드를 고르는 게 우선이다 (설명은 길게 누르기·호버). 2026-09-17: 기술 칩이 카드 오른쪽 기둥을 다 채우게 되면서 그 자리를 누르면 배정이 씹혔다
 // 칩(배지·효과 칩·타일)은 카드 안에 있어도 탭하면 말풍선 — 단 계약 광고 카드에서는 탭이 카드를 여는 게 우선 (설명은 길게 누르기·호버)
// 마우스: 같은 대상 안에서 자식(아이콘·배지) 사이를 오가도 말풍선을 다시 만들지 않고, 대상 밖으로 나갈 때만 지운다 (깜박임 방지)
document.addEventListener('mouseover', (ev) => { if (matchMedia('(hover: none)').matches) return; const t = tipTarget(ev); if (t && t !== S.tipFor) showTip(t); });
document.addEventListener('mouseout', (ev) => { const t = tipTarget(ev); if (!t) return; const to = (ev as MouseEvent).relatedTarget as Element | null; if (to && t.contains(to)) return; hideTip(); });
addEventListener('scroll', hideTip, { capture: true });
S.portraitLoop = false;
startPortraitLoop();
// 준비 화면 대시보드 높이: 화면에 그린 뒤 남는 높이를 재서 하단 바 바로 위까지 채운다 (창 크기가 바뀌면 다시)
function fitDash() {
  const body = document.querySelector<HTMLElement>('.dash .dashbody'); const bar = document.querySelector<HTMLElement>('.tabbar'); if (!body) return;
  const top = body.getBoundingClientRect().top; const barH = bar ? bar.getBoundingClientRect().height : 58;
  body.style.height = `${Math.max(140, Math.floor(innerHeight - top - barH - 8))}px`; // 8 = 바 위 여백. 페이지는 스크롤되지 않고 대시보드 안에서만 스크롤
}
window.addEventListener('resize', () => { if (S.phase === 'manage') fitDash(); });
// 그리기를 마친 **뒤에** 알림을 흘려보낸다 — 그리는 도중에 정해지는 알림(예: 저장 이어하기)이 한 번 늦게 뜨지 않도록 (2026-09-17 사용자 지적)
export function render() { renderScreen(); if (S.notice) { toast(S.notice); S.notice = ''; } }
function renderScreen() {
  save();
  // 장면 패널이 닫힐 때(토글 해제·다른 토글·켈라 열기·상세로 이동): 켈라처럼 아래로 내려가며 사라지게, 옛 패널 노드를 잠시 남겨 둔다
  const oldPanel = app.querySelector('.scenepanel:not(.closing)') as HTMLElement | null; const oldKey = oldPanel ? [...oldPanel.classList].find(c => c.startsWith('key-'))?.slice(4) : null;
  const stillClosing = [...app.querySelectorAll('.scenepanel.closing')] as HTMLElement[];
  app.replaceChildren(); app.classList.remove('fit'); app.classList.remove('land', 'plan', 'battle', 'page');
  app.append(headerEl()); requestAnimationFrame(() => { document.documentElement.style.setProperty('--head-h', `${headerBox.offsetHeight}px`); document.documentElement.style.setProperty('--head-b', `${headerBox.offsetTop + headerBox.offsetHeight}px`); /* 헤더(붉은 띠) 아래 끝 — 모달 페이지가 여기서 바로 시작한다 (2026-09-22 사용자) */ const tl = app.querySelector<HTMLElement>('.sidetools.inland'); document.documentElement.style.setProperty('--top-h', `${tl && tl.offsetHeight ? tl.offsetTop + tl.offsetHeight : headerBox.offsetTop + headerBox.offsetHeight}px`); }); // 헤더(두 줄)와 그 아래 토글 줄의 바닥 높이. 시트·상세는 이 아래에서 시작한다
  const curKey = S.cellsOpen ? 'cells' : S.sheet; const stillOpen = !!oldPanel && oldKey === curKey; // 같은 시트가 열린 채 다시 그리는 것이면 내려오는 모션을 되풀이하지 않는다 (팔루스·침상 누르면 켈라가 두 번 내려오던 것)
  if (oldPanel && (S.phase === 'manage' || S.phase === 'plan') && oldKey !== curKey) { /* 켈라도 시트의 하나(key-cells) */ oldPanel.classList.add('closing'); stillClosing.push(oldPanel); window.setTimeout(() => oldPanel.remove(), 380); }
  for (const n of stillClosing) app.append(n);
  const SCENE_KEYS = ['facilities', 'doctors', 'rivals', 'news', 'market', 'yard', 'medic', 'applicants', 'chronicle', 'help'] as const; /* help 도 전체 높이 장면 패널로 (2026-09-22 사용자) */ type SceneKey = typeof SCENE_KEYS[number];
  if (S.sheet && (S.phase === 'manage' || S.phase === 'plan') && (SCENE_KEYS as readonly string[]).includes(S.sheet)) { /* 편성에서도 같은 장면 패널 — 준비에서만 패널이고 편성에선 옛 모달로 떨어지던 것 (2026-09-22 사용자) */ // 준비 화면: 모달 대신 장면 안에서 켈라처럼 올라오는 패널. 왼쪽 토글로 오간다
    const key = S.sheet as SceneKey; const body = renderSheetBody(); const nodes = body.filter((n): n is Node => !!n);
    let h2: Element | null = null; for (const n of [...nodes].reverse()) { if (n instanceof HTMLElement) { h2 = n.tagName === 'H2' ? n : n.querySelector('h2'); if (h2) break; } }
    app.append(h('div', { class: `scenepanel key-${key}${stillOpen ? ' still' : ''}` }, h('div', { class: 'eave' }, h2 ?? h('h2', {}, ''), h('button', { class: 'close', title: '닫기', 'aria-label': '닫기', onclick: () => { S.sheet = null; S.helpSec = null; render(); } }, '✕')), h('div', { class: 'sheetbody' }, ...nodes.filter(n => n !== h2)))); // 켈라와 같은 틀: 제목 띠 오른쪽에 닫기 — 토글 서판이 없는 시트(지원자·시장·소식·의무실·훈련소)는 세로 무대에서 장면을 덮어 달리 닫을 길이 없었다
  } else if (S.sheet) app.append(renderSheet());
  if (S.phase === 'manage' && !S.showIntro && !S.setup && !S.st.pendingSuccession && S.st.pendingChallenges.length) { /* 색 고르기(설정)가 떠 있으면 그 뒤로 숨지 않게 기다린다 */ // 도전장(docs/10): 계약보다 먼저 답한다 — 수락하면 필수 배정, 거절하면 그쪽 기세 +1
    const c = S.st.pendingChallenges[0]; const rv = rivalOf(S.st.rivals, c.rivalId); const star = rv ? rivalStar(rv) : undefined;
    const cannot = (() => { const a = S.st.roster.filter(g => g.alive && g.injured === 0 && g.status !== 'doctor').length; return a < c.size ? `${c.size}명을 세울 수 없다 (출전 가능 ${a}명)` : null; })();
    app.append(h('div', { class: 'overlay' }, h('div', { class: 'modal challenge' },
      h('h2', {}, '도전장이 왔다'),
      h('p', {}, h('b', {}, rv?.name ?? '파밀리아'), `이(가) 우리를 지목했다. ${c.venue}에서 `, h('span', { style: 'white-space:nowrap' }, `${c.size}대${c.size}`), '.'),
      h('div', { class: 'offerbox' }, ...c.enemy.map(e => gladCard(e, { enemy: true, size: CARD_PORTRAIT, cls: 'full', nameExtra: [h('span', { class: 'meta' }, e === star ? ' 간판' : '')] }))),
      h('div', { class: 'challenge-terms' },
        h('span', { class: 'term danger', title: '상대는 우리 전력에 맞춰 약해지지 않는다' }, '간판·정예'),
        h('span', { class: 'term good', title: '도전장을 이기면 상금 배율이 오른다' }, `상금 ×${CONFIG.challenge.prize}`),
        h('span', { class: 'term good', title: '도전장을 이기면 호감도가 오른다' }, `호감 +${CONFIG.challenge.fame}`),
        h('span', { class: 'term warn', title: '받으면 이번 시즌 반드시 세워야 한다' }, '수락 시 필수 출전')),
      h('p', { class: 'hint' }, '피해도 벌점은 없지만, 상대 파밀리아의 기세가 오른다.'),
      cannot ? h('p', { class: 'warn' }, cannot) : null,
      h('div', { class: 'actions' }, h('button', { class: 'primary', disabled: !!cannot, onclick: () => { const err = acceptChallenge(S.st, c); if (err) toast(err, 'bad'); else { sfx.drum(1); toast('도전을 받았다 — 편성에서 세운다', 'good'); } save(); render(); } }, '받는다'), h('button', { onclick: () => { declineChallenge(S.st, c); save(); render(); } }, '피한다')))));
  }
  if (S.showIntro) app.append(h('div', { class: 'overlay intro' }, h('div', { class: 'introbox' },
    h('div', { class: 'title' }, '미테!'), h('div', { class: 'sub' }, '라니스타의 길'),
    h('p', {}, '검투사는 지고도 살 수 있다.'), h('p', {}, '관중이 미테!를 외치게 하라.'),
    h('p', { class: 'hint' }, '검투사를 사들이고, 시설을 키우고, 계약에 맞춰 내보내라. 명예와 호감도가 높을수록 관중은 살려 달라 외친다.'),
    h('button', { class: 'primary', onclick: () => { unlockAudio(); sfx.chant(3); sfx.cheer(0.8); S.showIntro = false; localStorage.setItem('lanista-intro', '1'); render(); } }, '입장'))));
  if (S.setup && !S.showIntro) { // 새 게임: 색은 랜덤 배정, 검투사 둘은 물려받는다 (2026-09-21 사용자: 색 고르기 창을 없앴다). S.setup 은 '새 게임을 시작하라'는 표시로만 남는다
    const seed = Number(location.hash.slice(1)) || Math.floor(Math.random() * 100000);
    S.st = newGame(seed, { color: S.setup.color }); S.setup = null; S.phase = 'manage'; S.view = 'ludus'; S.townCanvas = null; S.assign = {}; S.trainPlan = {}; sfx.fanfare(); save(); render(); return;
  }
  if (S.cellPop) { // 켈라 팝업: 누른 방에서 펼쳐진다 (스테이지 좌표, 화면 안에 들어오게 보정). 사람이 있으면 검투사 시트, 빈 방이면 넣을 검투사 고르기
    const stageH = document.getElementById('stage')?.clientHeight ?? STAGE_H; const W = Math.min(400, (document.getElementById('stage')?.clientWidth ?? STAGE_W) - 12), H = Math.min(460, stageH - 50);
    const left = Math.max(6, Math.min((document.getElementById('stage')?.clientWidth ?? STAGE_W) - W - 6, S.cellPop.cx - W / 2)), top = Math.max(40, Math.min(stageH - H - 6, S.cellPop.cy - 30));
    app.append(h('div', { class: 'popscrim', onclick: () => { S.cellPop = null; render(); } }),
      h('div', { class: `cellpop${S.cellPop.fresh ? ' fresh' : ''}`, style: `left:${left}px;top:${top}px;width:${W}px;max-height:${H}px;transform-origin:${S.cellPop.cx - left}px ${S.cellPop.cy - top}px` },
        h('button', { class: 'xclose', title: '닫기', onclick: () => { S.cellPop = null; render(); } }, '✕'), S.gladSel != null && S.st.roster.some(g => g.id === S.gladSel) ? gladSheet() : cellPanel(S.cellSel)));
    S.cellPop.fresh = false;
  }
  if (S.resumed) { S.resumed = false; S.notice = '저장된 게임을 이어합니다.'; }
  if (S.phase === 'over') { app.append(renderOver()); app.classList.add('land', 'page'); return; }
  // 단계 표시
  const steps = [['manage', '1 관리 · 시장과 루두스'], ['plan', '2 편성 · 계약과 배치'], ['battle', '3 시즌 진행 · 경기 관람']] as const;
  void steps; // 단계 표시줄은 숨김
  if (S.phase === 'plan') { app.append(renderPlan()); return; }
  if (S.phase === 'summary') { const n = renderSummary(); app.append(n); const bar = (n as HTMLElement).querySelector('.tabbar'); if (bar) app.append(bar); app.classList.add('land', 'page'); return; } // 정산도 무대 안: 아래 바는 본문 밖으로 꺼내 고정
  if (S.st.pendingSuccession) { app.append(renderSuccession()); return; } // 정산을 본 뒤 관리 화면에 들어올 때 후계자를 정한다
  { const town = renderTown(); app.append(sideToolsLand([{ icon: 'cells', title: '켈라', on: S.cellsOpen, onclick: () => { S.cellsOpen = !S.cellsOpen; S.cellPop = null; S.cellSide = null; if (S.cellsOpen) S.sheet = null; else { S.bedPick = null; S.palusMode = false; S.detail = null; S.shownDetail = null; } render(); } /* 켈라를 닫으면 그 안에서 연 검투사 상세도 같이 닫는다 */ }, { key: 'facilities', icon: 'facilities', title: '시설 강화' }, { key: 'doctors', icon: 'doctors', title: '독토르', badge: S.st.roster.filter(g => g.status === 'doctor').length }, { key: 'rivals', icon: 'rivals', title: '파밀리아' }, ...(S.view === 'medic' ? [{ key: 'medic' as const, icon: 'place' as const, title: '의무실' }] : [])])); app.append(town); /* 장소 서판: 그 장소의 안내·버튼(상인 다시 부르기·훈련 추천 배치·침상). 2026-09-22 사용자: 시트가 있는데 여는 길이 없었다 */
    if (S.cellsOpen && S.cellsCanvas) { const inj = S.st.roster.filter(g => g.injured).length, docs = S.st.roster.filter(g => g.status === 'doctor').length; // 켈라 = 시트의 하나: 다른 시트와 같은 틀(처마 제목 띠·✕·같은 모션). 본문은 켈라 캔버스
      const title = S.bedPick != null ? `침상 ${S.bedPick + 1}에 눕힐 부상자의 방을 누르세요` : S.palusMode ? `팔루스 배정 ${palusTrainees(S.st).length}/${S.st.ludus.palus} — 방을 누르면 세우고, 다시 누르면 내려옵니다` : `켈라 ${S.st.roster.length}/${S.st.ludus.cells.length} · 출전 가능 ${available(S.st).length}${inj ? ` · 부상 ${inj}` : ''}${docs ? ` · 독토르 ${docs}` : ''}`;
      app.append(h('div', { class: `scenepanel key-cells${stillOpen ? ' still' : ''}` }, h('div', { class: 'eave' }, h('h2', {}, title, S.bedPick == null && !S.palusMode ? h('span', { class: 'hint' }, ' 방을 누르면 검투사') : null), h('button', { class: 'close', title: '닫기', 'aria-label': '닫기', onclick: () => { S.cellsOpen = false; S.bedPick = null; S.palusMode = false; S.cellPop = null; S.cellSide = null; S.detail = null; S.shownDetail = null; render(); } }, '✕')), h('div', { class: 'sheetbody' }, S.cellsCanvas))); } } // 토글은 헤더 아래 한 줄 (켈라 = 지금 검투사 인벤토리, 나머지는 정보 서랍). 시트는 이 줄 밑에서 아래로 내려온다
  { const c = coach(); if (c) app.append(c); }
  // 대시보드: 지금 이 화면에서 결정할 일 + 오른쪽 위 이동 버튼

  if (S.detail) { if (!S.detail.solo) app.append(detailPage()); if (S.detail.confirm) app.append(confirmPage()); } // 검투사 상세 페이지: 장면 위로 오른쪽에서 밀려 들어온다. 확인 페이지는 그 위로 한 번 더
  if (S.tabletQueue && S.seasonFrom === 'manage') { const cs = S.tabletQueue.map(id => S.st.contracts.find(x => x.id === id)).filter((c): c is Contract => !!c); if (cs.length) app.append(tabletsPage(cs)); else S.tabletQueue = null; } /* 마을의 해로 시즌을 넘길 때 배정해 둔 계약이 있으면 서판(서명)이 마을 위로 (2026-09-22 사용자) */
  if (S.seasonConfirm && S.seasonFrom === 'manage') app.append(seasonConfirmPage(seasonWarnings())); /* 시즌 넘기기: 계약 벽을 거치지 않고 마을 위로 바로 (뒤로가기는 마을 그대로) */
  app.classList.add('land'); // 준비 화면: 가로 배치 (왼쪽 장면 · 오른쪽 대시보드). 높이는 CSS 그리드가 잡는다
  // 아래 탭 바: 상세(검투사·시설·파밀리아·규칙)는 시트로 연다 — 화면을 스크롤하지 않도록
  // 편성 버튼은 없다: 포룸의 공고벽을 누르면 편성으로 (규칙은 메뉴에, 토글은 장면 위)
}
// ── 탭 바 (화면 아래 고정): 왼쪽은 준비 → 편성 → 전투 단계, 오른쪽은 시트를 여닫는 아이콘 토글(현황 배지). 시트는 화면 위에 여는 상세
type StageItem = { label: string; on?: boolean; primary?: boolean; disabled?: boolean; onclick?: () => void };
type ToolItem = { key?: 'doctors' | 'rivals' | 'events' | 'facilities' | 'market' | 'yard' | 'medic'; icon: ToolIcon; title: string; badge?: number; on?: boolean; onclick?: () => void }; // key 가 없으면 on/onclick 으로 직접 토글 (켈라)
 // key 가 없으면 on/onclick 으로 직접 토글 (켈라)
type ToolIcon = 'roster' | 'doctors' | 'rivals' | 'events' | 'cells' | 'facilities' | 'place';
const TOOL_SVG: Record<ToolIcon, string> = { // Lucide 아이콘 (ISC): swords · graduation-cap(교관) · users · calendar-days · scroll-text(장소 서판)
  place: '<path d="M15 12h-5"/><path d="M15 8h-5"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/>',
  roster: '<path d="m14.5 17.5 3 3"/><path d="m21 3-9 9"/><path d="M6 21 21 6"/><path d="M3 6l3 3"/><path d="m2.5 21.5 3-3"/><path d="M14 21l-3-3"/><path d="M10 6.5 3.5 13"/>',
  doctors: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  rivals: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  cells: '<path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-8h6v8"/>',
  facilities: '<path d="m15 12-8.5 8.5a2.12 2.12 0 1 1-3-3L12 9"/><path d="M17.64 15 22 10.64"/><path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91"/>', // 망치 (시설 강화)
  events: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>',
};
const barBox = h('nav', { class: 'tabbar' }) as HTMLElement; // 하단 바도 한 요소를 유지하고 내용만 바꾼다 (깜박임 방지)
 // 하단 바도 한 요소를 유지하고 내용만 바꾼다 (깜박임 방지)
export function tabbar(stages: StageItem[], tools: ToolItem[] = []): Node {
  const stageEls = stages.map(t => h('button', { class: `stage${t.on ? ' on' : ''}${t.primary ? ' primary' : ''}`, disabled: t.disabled, onclick: t.onclick }, t.label));
  const toolEls = toolButtons(tools);
  barBox.replaceChildren(h('div', { class: 'stages' }, ...stageEls), ...(tools.length ? [h('div', { class: 'sidetools' }, ...toolEls)] : [])); // 편성 등에서는 화면 오른쪽에 세로로 뜬다 (fixed)
  return barBox;
}
function toolButtons(tools: ToolItem[]): HTMLElement[] {
  return tools.map(t => { const on = t.key ? S.sheet === t.key : !!t.on; const b = h('button', { class: `tool${on ? ' on' : ''}`, title: t.title, 'aria-label': t.title, onclick: t.key ? () => { const k = t.key!; S.sheet = S.sheet === k ? null : k; S.cellsOpen = false; S.bedPick = null; S.palusMode = false; S.cellPop = null; S.cellSide = null; S.detail = null; S.shownDetail = null; /* 켈라에서 연 상세는 다른 서판으로 가면 닫힌다 (2026-09-22 사용자) */ render(); } : t.onclick }); // 토글은 서로 배타적: 패널을 열면 켈라는 내려가고 침상·팔루스 배정 모드도 풀린다
    b.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TOOL_SVG[t.icon]}</svg>`;
    if (t.badge) b.append(h('span', { class: 'nbadge' }, String(t.badge))); return b; });
}
// 준비 화면의 아이콘 토글: 디스플레이(장면) 오른쪽 아래에 세로로 — 대시보드를 가리지 않는다
// 가로 배치: 장면 밖 맨 왼쪽 세로 띠 (왼손 엄지 자리)
export function sideToolsLand(tools: ToolItem[]): Node { return h('div', { class: 'sidetools inland' }, ...toolButtons(tools).map((b, i) => { b.insertBefore(h('span', { class: 'lbl' }, tools[i].title), b.querySelector('.nbadge')); return b; })); } // 처마 밑에 매달린 서판: 아이콘 + 이름 (+ 수)
 // 처마 밑에 매달린 서판: 아이콘 + 이름 (+ 수)
// 단계 버튼: 지금 누를 수 있는 것만 (준비에서는 '편성', 편성에서는 '준비' 와 '전투'). 화살표 없이
 // 마을 장면 높이 · 켈라 장면의 위 여백(처마 토글이 덮는 만큼, 월드 단위) · 켈라 장면 최소 높이 (3×5 방, 방 높이 100 + 여백)
S.cellsH = CELLS_MIN_H; // 켈라 장면 높이: 무대 바닥까지 채운다 (renderTown 의 draw 가 매 프레임 잰다). 방은 그만큼 세로로 늘어난다
 // 켈라 장면 높이: 무대 바닥까지 채운다 (renderTown 의 draw 가 매 프레임 잰다). 방은 그만큼 세로로 늘어난다
S.townH = TOWN_H;
// 켈라 방 시트: 방을 누르면 그 검투사의 카드 + 행동 버튼 + 이 방 강화 + 다른 방으로 옮기기 (검투사 목록 시트와 켈라 팝오버를 하나로 합쳤다)
// 검투사 상세 페이지: 왼쪽에 검투사가 크게 서 있고(불러낸 느낌), 오른쪽에 정보와 행동. 내 검투사(켈라)와 시장 노예가 같은 틀을 쓴다
S.shownDetail = null; // 지금 떠 있는 상세 페이지 (kind:id)
 // 실제 위치는 캔버스를 만들 때 restX(view) 로 잡는다
S.camX = 0;
 S.camV = 0;
 S.camPan = 0;
S.zoomIn = null; // 장면 줌인 연출 (포룸 공고벽 → 편성). wx/wy: 월드 초점, k: 최종 배율 // camPan: 좁은 화면에서 손가락으로 끌어 본 만큼의 오프셋 (이동하면 0)
 // 장면 줌인 연출 (포룸 공고벽 → 편성). wx/wy: 월드 초점, k: 최종 배율 // camPan: 좁은 화면에서 손가락으로 끌어 본 만큼의 오프셋 (이동하면 0)
// VIEW_W(보이는 폭, 월드 단위)는 위쪽 선언. 440: 라니스타 주변만 보이고 이웃 장소는 걸어가서 본다
S.VW = VIEW_W;
 // 이동한 장소를 화면 가운데에, 양옆은 이웃 장소가 자연스럽게 이어진다
S.townCanvas = null;
 S.cellsCanvas = null; // cellsCanvas: 켈라 전용 덮개 캔버스 (마을 위, 처마 밑에서 무대 바닥까지). 마을 캔버스는 켈라를 열어도 크기가 변하지 않는다 // 한 번 만들고 유지 (화면 재구성 때 끊기지 않게)
S.stickFn = null; // 훈련장이 매 프레임 넘겨 주는 보조 인물 그리기
S.pageSlide = null; // 편성 페이지 전환 방향: 계약 → 검투사(오른쪽에서), 검투사 → 계약(왼쪽에서)
 // 편성 페이지 전환 방향: 계약 → 검투사(오른쪽에서), 검투사 → 계약(왼쪽에서)
S.shownPlan = null; // 지금 떠 있는 편성 페이지의 계약 id (재렌더 때 다시 밀려 들어오지 않게)
 // 지금 떠 있는 편성 페이지의 계약 id (재렌더 때 다시 밀려 들어오지 않게)
 // 계약에 배정된 검투사들
S.tabletQueue = null;
 S.tabletIdx = 0; // 결투 낙서를 누르면 준비된 계약마다 밀랍 서판이 차례로 나온다 (도장으로 서명) → 마지막 뒤 시즌 시작 확인
// 계약서(밀랍 서판): 라니스타 ↔ 주최자의 대여 계약. 나무 틀 안 검은 밀랍에 조건을 적고, 도장(SIGNATVM)을 찍어 서명한다 (가이우스 3.146: 무사 귀환 시 대여료, 사망·불구 시 배상)
S.shownTablet = false; // 서판 페이지가 떠 있는지 (특약 체크로 재렌더될 때 다시 밀려 들어오지 않게)
// 시즌 시작 확인 페이지: 왼쪽에 경고(문구 한 줄 + '· ' 효과 줄), 오른쪽에 시즌 행사 고르기, 아래 금화 줄과 도장(INCIPIT)
S.seasonFrom = 'plan';
S.seasonConfirm = false;
 S.shownSeason = false;
if (FIGHT_PARAM && debugFight(FIGHT_PARAM)) renderBattle(); else render(); /* 디버그 전투는 상태 초기화가 끝난 뒤 굴려 바로 전투 장면으로 */ /* 디버그 전투는 상태 초기화가 끝난 뒤 굴려 바로 전투 장면으로 (S.report = null 같은 초기화에 덮이지 않게) */

// ── 새 배포 확인 (홈 화면에 저장해 두면 index.html 이 캐시되어 새 판이 와도 모른다)
// 자바스크립트·CSS 는 이름에 해시가 박혀 새 이름이면 반드시 새로 받지만, 그 이름을 알려주는 index.html 이 낡으면 영영 모른다.
// 그래서 서버의 index.html 을 캐시 무시로 읽어 지금 돌고 있는 번들 이름과 비교한다. 다르면 새로고침 (저장은 늘 되어 있으니 잃는 것이 없다).
const BUNDLE_URL = new URL(import.meta.url).pathname; // 예: /mitte/assets/index-XXXX.js
const BUNDLE = BUNDLE_URL.split('/').pop() ?? '';
const BASE = BUNDLE_URL.replace(/assets\/[^/]*$/, ''); // 배포 기준 경로
let lastCheck = 0;
async function checkUpdate() {
  if (!BUNDLE.startsWith('index-') || S.phase !== 'manage') return; // 개발 중이거나 경기 중이면 건너뛴다
  if (Date.now() - lastCheck < 60_000) return; lastCheck = Date.now();
  try {
    const res = await fetch(`${BASE}index.html?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const m = (await res.text()).match(/assets\/index-[A-Za-z0-9_-]+\.js/);
    if (m && !m[0].endsWith(BUNDLE) && !sessionStorage.getItem('reloaded')) { sessionStorage.setItem('reloaded', '1'); location.reload(); }
  } catch { /* 오프라인이면 그냥 둔다 */ }
}
void checkUpdate();                                                      // 켜자마자 (비동기라 첫 화면을 막지 않는다. 늦게 새로고침하면 조작 중에 튕기는 꼴이 된다)
document.addEventListener('visibilitychange', () => { if (!document.hidden) void checkUpdate(); }); // 홈 화면 앱으로 돌아올 때마다
