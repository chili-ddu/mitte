import { doSkillTrain, skillTrainable, newGame, available, canFulfill, buy, sell, heal, train, fight, fightExpense, refuseAll, upkeepOf, doctorFor, trainGain, mentoredBy, hireDoctor, backToArena, release, rosterCap, healCostOf, trainCap, trainedCount, injurySeasons, upgrade, upgradeCost, cellQuality, gymBonus, swapCells, moveToCell, occupantOf, cellOf, holdEvents, EVENT_KO, EVENT_KEYS, doShow, doRecover, ACTION_KO, ORIGIN_KO, renewCost, renewContract, refuseRudis, retrain, rivalOf, rivalStar, recordVsMe, priceOf, mortality, canRetire, retire, successorOptions, succeed, type Action, type SeasonEvents, type Facility, endSeason, validTeam, score, seasonName, SEASON_KO, serialize, deserialize, type GameState, type FightReport } from '../core/game.js';
import { label, sellPrice, rentFee, fansOf, TYPE_KO, LINEAGE_KO } from '../core/gladiator.js';
import { HOST_KO } from '../core/contracts.js';
import { HOST, FANS_STAR } from '../core/hosts.js';
import { accessoriesOf, EPITHETS, EPITHET_BY_ID, type EpithetId } from '../core/epithets.js';
import { SKILLS, SKILL_BY_ID, SKILL_NAME, skillsOf, skillSlots, learnSkill, declineSkill, masteryBonus, isPrimusPalus, procChance, type SkillId } from '../core/skills.js';
import { computeSynergies, describeSynergies, classicMatchup } from '../core/synergy.js';
import { survivalChance } from '../core/missio.js';
import { CONFIG } from '../core/config.js';
import type { Contract, Gladiator, GType } from '../core/types.js';
import { sfx, startCrowd, setCrowd, stopCrowd, unlockAudio, soundEnabled, setSoundEnabled } from './sound.js';
import { INK, ENEMY, drawStickman, drawSeated, clipSkeleton, clipLength, CEREMONIES, attackClipFor, comboClipFor, deathClipFor, isDeathClip, drawNetOverlay, drawNetProjectile, runSkeleton, type ClipName, NPC_POSES, walkSkeleton, type Skeleton, type DrawOpts } from './stickman.js';
import { loadoutFor, hasBigShield } from './loadout.js';
import { ARENA } from '../core/battle.js';

const TYPE_COLOR: Record<GType, string> = { murmillo: '#2c4f9b', secutor: '#1f7a6d', thraex: '#9b2c1c', retiarius: '#c58a1a', hoplomachus: '#5a7a2c', provocator: '#6b4a8a', eques: '#b5651d', dimachaerus: '#4a4a4a' };
// 24x24 좌표계의 무기 도형. 카드(SVG)와 전투 화면(Canvas Path2D)이 공유
const TYPE_GLYPH: Record<GType, string[]> = {
  murmillo:  ['M5 4h8v11l-4 4-4-4z', 'M18 3v13', 'M15.5 16h5'],                 // 큰 방패 + 글라디우스
  secutor:   ['M12 4a6 6 0 0 1 6 6v9H6v-9a6 6 0 0 1 6-6z', 'M9.5 11h1.5', 'M13 11h1.5'], // 매끈한 투구 + 눈구멍
  thraex:    ['M8 20c-1-7 3-13 10-15', 'M18 5l-3 .5', 'M7 5.5a3 3 0 1 0 0 .01'],   // 시카(곡도) + 작은 방패
  retiarius: ['M12 21V8', 'M7 3v5a5 5 0 0 0 10 0V3', 'M12 3v5'],                  // 삼지창
  hoplomachus: ['M15 21L15 4', 'M13 6l2-3 2 3', 'M8 13a4 4 0 1 0 0 .01'],           // 창 + 둥근 방패
  provocator:  ['M6 5h9v9l-4.5 4L6 14z', 'M18 4v14', 'M15.5 17h5'],                 // 중형 방패 + 글라디우스
  eques:       ['M16 21V4', 'M14 6l2-3 2 3', 'M7 14a3.5 3.5 0 1 0 0 .01', 'M4 4c2 1 3 3 2 6'], // 창 + 둥근 방패 + 깃털
  dimachaerus: ['M6 20c-1-7 3-13 10-15', 'M18 20c1-7-3-13-10-15'],                  // 시카 둘 교차
};
function glyphSvg(t: GType, size = 22) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', String(size)); svg.setAttribute('height', String(size));
  for (const d of TYPE_GLYPH[t]) { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); p.setAttribute('fill', 'none'); p.setAttribute('stroke', '#fff'); p.setAttribute('stroke-width', '2'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); svg.append(p); }
  return svg;
}
function drawGlyph(ctx: CanvasRenderingContext2D, t: GType, x: number, y: number, size: number) {
  ctx.save(); ctx.translate(x - size / 2, y - size / 2); ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const d of TYPE_GLYPH[t]) ctx.stroke(new Path2D(d));
  ctx.restore();
}
const app = document.getElementById('app')!;
document.addEventListener('pointerdown', () => unlockAudio(), { capture: true });
const SAVE_KEY = 'lanista-save';
function loadSave(): GameState | null { try { const raw = localStorage.getItem(SAVE_KEY); return raw ? deserialize(JSON.parse(raw)) : null; } catch { return null; } }
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(serialize(st))); } catch { /* 저장 불가 환경 */ } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch {} }
const saved = loadSave();
let st: GameState = saved ?? newGame(Number(location.hash.slice(1)) || Math.floor(Math.random() * 100000));
let resumed = !!saved;
let showIntro = !saved && localStorage.getItem('lanista-intro') !== '1';
let coachOff = localStorage.getItem('lanista-coach') === '1'; // 첫 시즌 안내를 껐는가 (2번째 시즌부터는 자동으로 끝)
// 첫 시즌 안내: 지금 상태에서 다음에 할 일을 한 줄로. 화면 위쪽에 손가락 표시와 함께
function coach(): Node | null {
  if (coachOff || st.season > 1) return null;
  const assigned = Object.values(assign).reduce((a, ids) => a + ids.length, 0);
  let text = '', arrow: 'tabs' | 'plan' | 'go' | 'none' = 'none';
  if (phase === 'manage' && cellsOpen) text = '방을 누르면 검투사를 옮기고 숙소 질을 올릴 수 있습니다. 집 버튼으로 돌아갑니다.';
  else if (phase === 'manage' && view === 'market') { text = st.roster.length < 3 ? '판매대의 검투사를 누르고 구매하세요. 계약 규모에 맞춰 최소 3명이 편합니다.' : '충분합니다. 위 팻말에서 정문으로 돌아가 편성으로 가세요.'; arrow = st.roster.length < 3 ? 'none' : 'tabs'; }
  else if (phase === 'manage') { if (st.roster.length < 3 && st.market.length) { text = '검투사 2명으로 시작합니다. 위 팻말의 시장에서 한 명 더 사 두면 계약을 더 받을 수 있습니다.'; arrow = 'tabs'; } else { text = '편성 단계로 가서 계약에 검투사를 배정합니다. 검투사는 시즌당 한 번만 출전합니다.'; arrow = 'plan'; } }
  else if (phase === 'plan') { if (!assigned) { text = '계약 카드를 고른 뒤 아래 검투사를 눌러 배정합니다. 주최자 배지를 길게 누르면 상금·미시오 조건이 보입니다. 배정 안 된 검투사는 훈련·시범을 고르세요.'; } else { text = '시즌 진행을 누르면 경기가 시작됩니다. 지더라도 관중이 미테!를 외치면 삽니다. 판정 때 화면을 두드려 보세요.'; arrow = 'go'; } }
  else if (phase === 'summary') text = '대여료는 승패와 무관하게 받습니다. 다음 시즌엔 왼쪽 아래 집 버튼(켈라)과 의무실·훈련소의 시설도 살펴보세요.';
  if (!text) return null;
  return h('div', { class: `coach ${arrow}` }, h('span', { class: 'hand' }, '☞'), h('span', { class: 'grow' }, text), h('button', { class: 'tiny', title: '안내 끄기', onclick: () => { coachOff = true; localStorage.setItem('lanista-coach', '1'); render(); } }, '✕'));
} // 첫 실행: 제목 화면 (관중 함성과 함께)
let phase: 'manage' | 'plan' | 'battle' | 'result' | 'summary' | 'over' = 'manage';
// 편성: 계약별 배정, 미배정 검투사의 훈련 선택
let assign: Record<number, number[]> = {};            // contractId → gladiator ids
let trainPlan: Record<number, Action> = {}; // gladiator id → 시즌 행동
let planSel: number | null = null;                    // 편성 중 선택된 계약 id
let queue: { c: Contract; team: Gladiator[] }[] = [];
let skipped: Contract[] = []; // 앞 경기 부상·사망으로 무산된 계약 // 시즌 진행 중 남은 경기
let marketSel: number | null = null;                  // 시장에서 선택한 검투사 id
type View = 'medic' | 'yard' | 'ludus' | 'market' | 'grave'; // 관리 단계의 장소: 의무실 · 훈련소 · 정문(루두스 문 앞) · 시장. 좁은 화면이라 루두스를 세 장면으로 나눈다
const VIEW_KO: Record<View, string> = { medic: '의무실', yard: '훈련소', ludus: '정문', market: '시장', grave: '묘지' };
let view: View = 'ludus';
let travel: { to: View; from: View; fromX: number; start: number } | null = null; // 이동 전환 중
let seasonReports: FightReport[] = [];
let seasonSummary: { upkeep: number; gift: number; trained: { g: Gladiator; stat: 'atk' | 'def' }[]; acted: { g: Gladiator; act: Action; note: string }[]; before: number; fameBefore: number; refused: number; skipped: Contract[]; label: string; events: SeasonEvents } | null = null;
let report: FightReport | null = null;
let notice = '';
let sheet: 'help' | 'roster' | 'facilities' | 'doctors' | 'rivals' | 'events' | 'menu' | 'chronicle' | null = null;
let cellSel = 0; // 켈라 팝오버에서 고른 칸
let cellPop: { cx: number; cy: number; fresh: boolean } | null = null; // fresh: 처음 열릴 때만 펼침 애니메이션 // 켈라 팝오버: 누른 방의 화면 좌표(중심)에서 펼쳐진다
let cellsOpen = false, cellsP = 0;
let offersDismissed = 0; // 이 시즌에 '나중에'를 눌렀으면 시즌 번호 // 켈라 화면: 디스플레이 아래에서 위로 올라온다 (0~1) // 화면 위에 여는 시트(모달). 스크롤 대신 시트로 상세를 본다
const hintSpan = (t: string) => h('span', { class: 'hint', style: 'text-transform:none;letter-spacing:0;margin-left:8px' }, t);
// 확인 창: 브라우저 confirm/alert 대신 게임 안 모달 (폰에서도 같은 모양, 화면 재구성과 무관하게 body 에 붙는다)
function ask(msg: string, opts: { ok?: string; cancel?: boolean; title?: string } = {}): Promise<boolean> {
  return new Promise(res => {
    const close = (v: boolean) => { ov.remove(); res(v); };
    const ov = h('div', { class: 'overlay', onclick: (ev: Event) => { if (ev.target === ev.currentTarget) close(false); } },
      h('div', { class: 'modal ask' }, opts.title ? h('h2', {}, opts.title) : null, ...msg.split('\n').map(l => h('p', {}, l)),
        h('div', { class: 'actions' }, opts.cancel === false ? null : h('button', { onclick: () => close(false) }, '취소'), h('button', { class: 'primary', onclick: () => close(true) }, opts.ok ?? '확인'))));
    document.body.append(ov); (ov.querySelector('button.primary') as HTMLButtonElement).focus();
  });
}
const tell = (msg: string, title?: string) => ask(msg, { cancel: false, title });
// ? 아이콘: 누르면 자세한 설명 모달. 화면에는 짧은 말만 남긴다
const helpBtn = (title: string, body: string) => { const b = h('button', { class: 'qmark', title: '설명', onclick: (ev: Event) => { ev.stopPropagation(); void tell(body, title); } });
  b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>'; return b; }; // 인라인 SVG (Lucide circle-help 형태), 파일 요청 없음
// 커스텀 드롭다운: 네이티브 select 는 펼친 목록을 꾸밀 수 없어서 버튼 + 목록으로 만든다. 열림 상태는 key 로 기억 (render 가 다시 그려도 유지)
let ddOpen: string | null = null;
document.addEventListener('pointerdown', (ev) => { if (ddOpen && !(ev.target as Element).closest?.('.dd')) { ddOpen = null; document.querySelectorAll('.dd.open').forEach(d => d.classList.remove('open')); } }, { capture: true });
function dropdown(key: string, options: { value: string; label: string }[], value: string, onPick: (v: string) => void, placeholder = ''): Node {
  const cur = options.find(o => o.value === value);
  const wrap = h('div', { class: `dd${ddOpen === key ? ' open' : ''}` });
  const btn = h('button', { class: 'ddbtn', onclick: (ev: Event) => { ev.stopPropagation(); ddOpen = ddOpen === key ? null : key; wrap.classList.toggle('open', ddOpen === key); } }, h('span', { class: 'ddarrow' }), cur ? cur.label : placeholder); // 화살표는 글자 앞
  const list = h('div', { class: 'ddlist' }, ...options.map(o => h('div', { class: `ddopt${o.value === value ? ' on' : ''}`, onclick: (ev: Event) => { ev.stopPropagation(); ddOpen = null; onPick(o.value); } }, o.label)));
  wrap.append(btn, list); return wrap;
}
// 헤더의 설정(톱니바퀴) 버튼: 메뉴 시트 (인라인 SVG, Lucide settings 형태)
function gearBtn(): Node { const b = h('button', { class: `gear${sheet === 'menu' ? ' on' : ''}`, title: '메뉴', onclick: () => { sheet = sheet === 'menu' ? null : 'menu'; render(); } });
  b.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>';
  return b; }
// 계절 그림 (로마 사계절 도상: 봄 꽃가지 · 여름 밀 이삭 · 가을 포도송이 · 겨울 헐벗은 가지). 낙서풍 선 그림, 헤더의 계절 글자를 대신한다
function seasonIcon(season: number): Node {
  const k = (season - 1) % 4; const sp = h('span', { class: `season-ico s${k}`, title: `${SEASON_KO[k]} — ${['꽃가지 (봄)', '밀 이삭 (여름, 수확)', '포도송이 (가을, 포도 수확)', '헐벗은 가지 (겨울)'][k]}` });
  const paths = [
    '<path d="M12 21V9"/><path d="M12 13c-3 0-5-2-5-5 3 0 5 2 5 5z"/><path d="M12 16c3 0 5-2 5-5-3 0-5 2-5 5z"/><circle cx="12" cy="6" r="2.4"/><path d="M9.5 4.5 8 3M14.5 4.5 16 3M12 3.2V2"/>',
    '<path d="M12 22V8"/><path d="M12 8c-2.5-.5-4-2.5-4-5 2.5.5 4 2.5 4 5z"/><path d="M12 8c2.5-.5 4-2.5 4-5-2.5.5-4 2.5-4 5z"/><path d="M12 12c-2.5-.5-4-2.5-4-5 2.5.5 4 2.5 4 5z"/><path d="M12 12c2.5-.5 4-2.5 4-5-2.5.5-4 2.5-4 5z"/><path d="M12 16c-2.5-.5-4-2.5-4-5 2.5.5 4 2.5 4 5z"/><path d="M12 16c2.5-.5 4-2.5 4-5-2.5.5-4 2.5-4 5z"/>',
    '<path d="M12 2v4"/><path d="M12 6c3 0 5 1 6 3-2 0-4 1-6 2-2-1-4-2-6-2 1-2 3-3 6-3z"/><circle cx="9" cy="12.5" r="2.2"/><circle cx="15" cy="12.5" r="2.2"/><circle cx="7.5" cy="16.5" r="2.2"/><circle cx="12" cy="16.5" r="2.2"/><circle cx="16.5" cy="16.5" r="2.2"/><circle cx="10" cy="20" r="2.2"/><circle cx="14.5" cy="20" r="2.2"/>',
    '<path d="M12 22V6"/><path d="M12 13l-5-4M12 13l5-4M12 9l-3-3M12 9l3-3M7 9l-2-2M17 9l2-2"/><path d="M4 21h16" stroke-dasharray="2 3"/>',
  ][k];
  sp.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  return sp;
}
// 작은 상태 아이콘 (인라인 SVG): cross = 부상(붕대 십자), staff = 독토르(지휘봉)
function svgIcon(kind: 'cross' | 'staff'): Node { const sp = h('span', { class: 'ico' });
  sp.innerHTML = kind === 'cross' ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 4v16M4 12h16"/></svg>'
    : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 20 18 6"/><path d="M15 5l4 4"/></svg>';
  return sp; }
let rosterSort: 'cell' | 'honor' | 'type' | 'wins' = (['cell', 'honor', 'type', 'wins'].includes(localStorage.getItem('lanista-sort') ?? '') ? localStorage.getItem('lanista-sort') as typeof rosterSort : 'cell');
// 접이식 패널: 열림 상태를 기억한다
function foldPanel(key: string, title: string, hint: string, ...kids: (Node | null)[]): Node {
  const open = localStorage.getItem(`lanista-open-${key}`) !== '0';
  const d = h('details', { class: 'panel fold', style: 'margin-bottom:10px' }, h('summary', {}, h('h2', {}, title, h('span', { class: 'hint', style: 'text-transform:none;letter-spacing:0;margin-left:8px' }, hint))), ...kids) as HTMLDetailsElement;
  if (open) d.setAttribute('open', '');
  d.addEventListener('toggle', () => localStorage.setItem(`lanista-open-${key}`, d.open ? '1' : '0'));
  return d;
}
let eventPlan: SeasonEvents = { cena: false, pompa: false, votum: false, edicta: false, guests: false }; // 편성 화면에서 고른 시즌 행사 // 대시보드 맨 위에 한 번 보여줄 알림

const h = (tag: string, attrs: Record<string, any> = {}, ...kids: (Node | string | null | undefined)[]) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v === false || v == null || v === '') continue; if (k === 'class') el.className = v; else if (k.startsWith('on')) (el as any)[k] = v; else if (k === 'title') el.setAttribute('data-tip', v); /* title → 탭·호버 말풍선 (폰에서는 title 이 안 보인다) */ else el.setAttribute(k, v === true ? '' : v); }
  for (const k of kids) if (k != null) el.append(k);
  return el;
};
// ── 말풍선(툴팁): data-tip 이 있는 요소를 폰에서 길게 누르거나(450ms), 버튼이 아닌 요소는 탭하면, PC 에서는 마우스를 올리면 보인다
let tipEl: HTMLElement | null = null; let tipTimer = 0; let tipSuppressClick = false;
function showTip(target: Element) {
  const text = target.getAttribute('data-tip'); if (!text) return;
  hideTip(); const el = h('div', { class: 'tip' }, ...text.split('\n').map(l => h('div', {}, l))); document.body.append(el); tipEl = el;
  const r = target.getBoundingClientRect(); el.style.maxWidth = Math.min(280, innerWidth - 16) + 'px'; const w = el.offsetWidth;
  const left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)); el.style.left = left + 'px';
  const above = r.top > el.offsetHeight + 16; el.style.top = (above ? r.top - el.offsetHeight - 8 : r.bottom + 8) + 'px'; el.classList.toggle('below', !above);
  el.style.setProperty('--ax', (r.left + r.width / 2 - left) + 'px');
}
function hideTip() { if (tipEl) { tipEl.remove(); tipEl = null; } }
const tipTarget = (ev: Event) => (ev.target as Element).closest?.('[data-tip]') as Element | null;
const isAction = (el: Element) => !!el.closest('button, a, select, .card, .drow, .slot, .ddopt');
document.addEventListener('pointerdown', (ev) => { hideTip(); clearTimeout(tipTimer); const t = tipTarget(ev); if (!t) return;
  if (ev.pointerType === 'mouse') return; // 마우스는 호버로
  tipTimer = window.setTimeout(() => { showTip(t); tipSuppressClick = true; }, 450); }, { capture: true });
document.addEventListener('pointerup', () => clearTimeout(tipTimer), { capture: true });
document.addEventListener('pointercancel', () => clearTimeout(tipTimer), { capture: true });
document.addEventListener('click', (ev) => { if (tipSuppressClick) { tipSuppressClick = false; ev.stopPropagation(); ev.preventDefault(); return; } // 길게 눌러 말풍선을 봤으면 그 클릭은 동작하지 않는다
  const t = tipTarget(ev); if (t && !isAction(t)) { showTip(t); ev.stopPropagation(); } }, { capture: true });
document.addEventListener('mouseover', (ev) => { if (matchMedia('(hover: none)').matches) return; const t = tipTarget(ev); if (t) showTip(t); });
document.addEventListener('mouseout', (ev) => { if (tipTarget(ev)) hideTip(); });
addEventListener('scroll', hideTip, { capture: true });
const sq = (t: GType) => h('span', { class: 'sq', style: `background:${TYPE_COLOR[t]}` }, glyphSvg(t));

// ── 스틱맨 초상: 작은 캔버스에 장비 갖춘 스틱맨. 살아 움직이는 초상들은 공용 루프가 갱신
const portraits = new Set<{ c: HTMLCanvasElement; g: Gladiator; pose: 'idle' | 'sit'; enemy?: boolean }>();
function portrait(g: Gladiator, size = 64, enemy = false) {
  const c = document.createElement('canvas'); c.width = size * devicePixelRatio; c.height = size * devicePixelRatio; c.style.width = c.style.height = size + 'px'; c.className = 'portrait';
  const entry = { c, g, pose: (g.injured ? 'sit' : 'idle') as 'idle' | 'sit', enemy };
  portraits.add(entry); drawPortrait(entry, 0);
  return c;
}
function drawPortrait(e: { c: HTMLCanvasElement; g: Gladiator; pose: 'idle' | 'sit'; enemy?: boolean }, t: number) {
  const ctx = e.c.getContext('2d')!; const S = e.c.width / devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = '#e3d3a6'; ctx.fillRect(0, 0, S, S); ctx.fillStyle = '#cbb67f'; ctx.fillRect(0, S - 8, S, 8);
  const team = e.enemy ? ENEMY : e.g.rank === 'veteranus' ? '#2c4f9b' : '#6e7f9b';
  drawStickman(ctx, e.g.type, { x: S / 2 - 2, y: S - 6, scale: 0.68, pose: 'idle', t, team, accessories: accessoriesOf(e.g) }); // 투구 볏이 잘리지 않게
  if (e.pose === 'sit') { // 치료 중: 장비 상태 그대로, 치료 표시만 (팔 붕대 + 모서리 붕대 마크)
    const sc = 0.68, ax = S / 2 - 2 + 6 * sc, ay = S - 6 - 34 * sc; // 앞팔 위팔 근처
    ctx.strokeStyle = '#f3ead0'; ctx.lineWidth = 3; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(ax - 4, ay - 1); ctx.lineTo(ax + 4, ay + 2); ctx.moveTo(ax - 4, ay + 3); ctx.lineTo(ax + 4, ay + 6); ctx.stroke();
    ctx.strokeStyle = '#9b2c1c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax - 4, ay - 1); ctx.lineTo(ax + 4, ay + 2); ctx.moveTo(ax - 4, ay + 3); ctx.lineTo(ax + 4, ay + 6); ctx.stroke();
    // 모서리 마크: 둥근 배지 안에 붕대 두 겹 교차
    const bx = S - 11, by = 11; ctx.fillStyle = '#f3ead0'; ctx.strokeStyle = '#9b2c1c'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(bx, by, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx - 4.5, by - 3); ctx.lineTo(bx + 4.5, by + 3); ctx.moveTo(bx - 4.5, by + 3); ctx.lineTo(bx + 4.5, by - 3); ctx.stroke();
    ctx.strokeStyle = '#f3ead0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx - 4.5, by - 3); ctx.lineTo(bx + 4.5, by + 3); ctx.moveTo(bx - 4.5, by + 3); ctx.lineTo(bx + 4.5, by - 3); ctx.stroke();
  }
}
let portraitLoop = false;
function startPortraitLoop() {
  if (portraitLoop) return; portraitLoop = true;
  const tick = () => { const t = performance.now() / 1000; for (const e of portraits) { if (!e.c.isConnected) { portraits.delete(e); continue; } drawPortrait(e, t); } requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
startPortraitLoop();

const ORIGIN_SHORT: Record<string, string> = { captive: '포로', damnatus: '죄수', auctoratus: '자유민 계약' };
function originBadge(g: Gladiator): Node | null {
  if (!g.origin || g.origin === 'slave') return null;
  const O = CONFIG.origins;
  const tip = g.origin === 'captive' ? `전쟁 포로: 값이 싸고 강하지만 관중이 냉담해 미시오 ${Math.round(O.captive.missio * 100)}%` : g.origin === 'damnatus' ? `형벌 죄수: 매우 싸고 약함. 사망 배상 절반, ${O.damnatus.freeAfter}시즌(3년) 뒤 형기 만료로 자유` : `자유민 계약자: 계약금만 내고 데려오며 급료(대여료의 ${Math.round(CONFIG.rudiariusShare * 100)}%)를 받음. ${O.auctoratus.term}시즌 계약`;
  const left = g.origin === 'auctoratus' && g.contractUntil != null ? ` ${Math.max(0, g.contractUntil - st.season + 1)}시즌` : g.origin === 'damnatus' && g.boughtSeason != null && (g.status ?? 'slave') === 'slave' ? ` ${Math.max(0, O.damnatus.freeAfter - (st.season - g.boughtSeason + 1))}시즌` : '';
  return h('span', { class: `badge origin ${g.origin}`, title: tip }, ORIGIN_SHORT[g.origin] + left);
}
// 계약 상대 설명: 파밀리아 이름 + 이름(유형·전적). 원한·복수 관계 표시
function enemyLine(c: Contract): Node {
  const rv = rivalOf(st.rivals, c.rivalId);
  const parts: (Node | string)[] = [h('b', {}, rv ? rv.name : '떠돌이 검투사단'), rv ? h('span', { class: 'hint' }, ` (${recordVsMe(rv)}) `) : '', ': '];
  const star = rv ? rivalStar(rv) : undefined;
  c.enemy.forEach((e, i) => { parts.push(i ? ', ' : '', sq(e.type), ' ', `${e.name.replace('(적)', '')} (${e.rank === 'tiro' ? '티로' : '베테'} ${e.wins}승/${e.fights}전${(e.honor ?? 0) >= 30 ? ` · 명예 ${e.honor}` : ''}${(e.skills ?? []).length ? ` · 기술 ${(e.skills ?? []).map(SKILL_NAME).join('·')}` : ''})`); if (star && star.id === e.id && ((star.honor ?? 0) >= 20 || star.wins >= 5)) parts.push(' ', h('span', { class: 'badge star', title: '이 파밀리아의 간판 검투사' }, '간판'));
    const spBy = st.roster.filter(g => (g.spared ?? []).includes(e.id)), beat = st.roster.filter(g => (g.beatenBy ?? []).includes(e.id));
    if (spBy.length) parts.push(' ', h('span', { class: 'badge grudge', title: `${spBy.map(g => g.name).join(', ')} 이(가) 살려 준 자. 재대결이면 공격 +10%, 그에게 지면 미시오 −15% (우르비쿠스의 경고)` }, `원한 ← ${spBy.map(g => g.name).join(', ')}`));
    if (beat.length) parts.push(' ', h('span', { class: 'badge revenge', title: `${beat.map(g => g.name).join(', ')} 을(를) 쓰러뜨린 자. 꺾으면 복수 (명예 +8, '복수자')` }, `복수 기회 → ${beat.map(g => g.name).join(', ')}`)); });
  return h('div', { class: 'meta enemyline' }, ...parts);
}
const hostPrize = (c: Contract) => Math.round(CONFIG.prizePerTier * c.tier * HOST[c.host].prize);
const hostSpan = (c: Contract) => { const H = HOST[c.host]; return h('span', { class: `host ${c.host}`, title: `${H.ko}: ${H.desc}\n상금 ×${H.prize} · 대여료 ×${H.rent} · 미시오 ${H.missio >= 0 ? '+' : ''}${Math.round(H.missio * 100)}% · 루디스 ${H.rudis >= 0 ? '+' : ''}${Math.round(H.rudis * 100)}%${H.fameWin ? ` · 승리 호감도 +${H.fameWin}` : ''}${H.honorAll ? ` · 출전자 명예 +${H.honorAll}` : ''}${H.bet ? ' · 내기 가능' : ''}` }, H.ko); };
function skillBadges(g: Gladiator): Node[] {
  return skillsOf(g).map(id => { const d = SKILL_BY_ID[id]; const mb = masteryBonus(g, id); return h('span', { class: 'badge skill', title: `${d.name}: ${d.desc} 발동 ${Math.round(procChance(g, id) * 100)}%${mb ? ` (숙련 +${Math.round(mb * 100)}%)` : ''}` }, d.name); });
}
// 배울 기회: 배우기 / 넘기기. 슬롯이 차 있으면 버릴 기술을 고른다
function skillOfferRows(g: Gladiator, after: () => void = render): Node[] {
  const offers = (g.skillOffers ?? []) as SkillId[]; if (!offers.length) return [];
  const slots = skillSlots(g), have = skillsOf(g);
  return offers.map(id => { const d = SKILL_BY_ID[id]; let replace: SkillId | undefined = have[0];
    const row = h('div', { class: 'offer' }, h('div', { class: 'grow' }, h('b', {}, `새 기술 '${d.name}'`), h('span', { class: 'meta' }, ` ${d.desc}`), h('div', { class: 'meta' }, `슬롯 ${have.length}/${slots}${isPrimusPalus(g) ? ' · 프리무스 팔루스' : ''}`)));
    if (have.length >= slots) row.append(dropdown(`rep-${g.id}-${id}`, have.map(x => ({ value: x, label: `${SKILL_NAME(x)} 버림` })), replace ?? '', v => { replace = v as SkillId; }, '버릴 기술'));
    row.append(h('button', { class: 'primary', onclick: (ev: Event) => { ev.stopPropagation(); if (learnSkill(g, id, have.length >= slots ? replace : undefined)) { sfx.coin(); after(); } } }, '배우기'), h('button', { onclick: (ev: Event) => { ev.stopPropagation(); declineSkill(g, id); after(); } }, '넘기기'));
    return row; });
}
function epithetBadges(g: Gladiator): Node[] {
  const sc = g.scaeva ? [h('span', { class: 'badge scaeva', title: '왼손잡이(스카이바): 타고난 특성. 상대 방패의 첫 타격 감소를 절반으로 만든다 (비문에 따로 표기될 만큼 귀했다)' }, '왼손잡이')] : [];
  return [...sc, ...skillBadges(g), ...(g.epithets ?? []).map(id => { const e = EPITHET_BY_ID[id as EpithetId]; return e ? h('span', { class: 'badge epithet', title: `${e.latin} · ${e.cond} → ${e.effect}${e.attested ? ' (실제 기록)' : ''}` }, `'${e.name}'`) : null; }).filter((n): n is HTMLElement => !!n)];
}
function gladCard(g: Gladiator, extra: (Node | null)[] = [], opts: { sel?: boolean; dis?: boolean; onclick?: () => void; tag?: Node | null } = {}) {
  return h('div', { class: `card${opts.sel ? ' sel' : ''}${opts.dis ? ' dis' : ''}`, onclick: opts.onclick },
    portrait(g, 56),
    h('div', { class: 'grow' },
      h('div', {}, h('span', { class: `rank ${g.rank}` }, g.rank === 'tiro' ? '티로' : '베테'), g.status === 'rudiarius' ? h('span', { class: 'badge free' }, '자유민') : g.status === 'doctor' ? h('span', { class: 'badge doc' }, '독토르') : null, g.status !== 'doctor' && mentoredBy(st, g) ? h('span', { class: 'badge mentor' }, '기술 전수') : null, originBadge(g), ' ', h('span', { class: 'sq small', style: `background:${TYPE_COLOR[g.type]}` }, glyphSvg(g.type, 14)), ' ', h('span', { class: 'nm' }, g.name), ' ', ...epithetBadges(g), h('span', { class: 'meta' }, `${TYPE_KO[g.type]} · ${LINEAGE_KO[g.lineage]} · ${g.age ?? '?'}세`), opts.tag ?? null),
      h('div', { class: 'meta' }, `HP ${g.base.hp}  공 ${g.base.atk}  방 ${g.base.def}  |  ${g.wins}승/${g.fights}전  미시오 ${g.missios}  명예 ${g.honor ?? 0}  팬 ${fansOf(g)}${fansOf(g) >= FANS_STAR ? '★' : ''}${g.injured ? '  ⚠ 부상' : ''}${g.fought ? '  ✓ 출전 완료' : ''}${(g.fatigue ?? 0) > 0 ? `  피로 ${g.fatigue} (공·방 −${(g.fatigue ?? 0) * CONFIG.fatigue.statPenalty})` : ''}${g.trained ? '  훈련함' : ''}`)),
    ...extra);
}

function render() {
  save();
  app.replaceChildren();
  app.append(h('header', {},
    h('div', { class: 'hrow' }, h('h1', {}, '라니스타'), h('span', { class: 'stat', title: st.lanista.trait === 'doctor' ? `전직 독토르 (${TYPE_KO[st.lanista.type!]} 훈련 +1)` : st.lanista.trait === 'freedman' ? '해방노예 출신 (시장 10% 할인)' : '창업자' }, st.lanista.name, h('span', {}, ` ${st.lanista.age}세`)), h('span', { style: 'flex:1' }), h('span', { class: 'stat season' }, `${Math.floor((st.season - 1) / 4) + 1}년차`, seasonIcon(st.season))),
    h('div', { class: 'hrow' }, h('span', { class: 'stat' }, `${st.money.toLocaleString()} HS`, h('span', {}, ` 유지비 ${upkeepOf(st).toLocaleString()}`)), h('span', { class: 'stat' }, `호감도 ${st.fame}`), h('span', { class: 'stat' }, `검투사 ${st.roster.length}`, h('span', {}, `/${rosterCap(st)}`)), h('span', { style: 'flex:1' }),
      gearBtn())));
  if (sheet) app.append(renderSheet());
  if (phase === 'manage' && !showIntro && !st.pendingSuccession && offersDismissed !== st.season) { // 새 기술 깨침: 루두스로 돌아오면 배울지 정한다
    const learners = st.roster.filter(g => (g.skillOffers ?? []).length);
    if (learners.length) app.append(h('div', { class: 'overlay' }, h('div', { class: 'modal offers' },
      h('h2', {}, '새 기술을 깨쳤다', helpBtn('기술 배우기', '경기 경험이나 기술 훈련으로 깨친 기술입니다. 배우면 슬롯을 하나 쓰고(티로 1 · 베테라누스 2 · 프리무스 팔루스 3), 슬롯이 차 있으면 버릴 기술을 골라 바꿉니다. 넘기면 이 기회는 사라지지만 나중에 다시 깨칠 수 있습니다.')),
      ...learners.map(g => h('div', { class: 'card' }, portrait(g, 48), h('div', { class: 'grow' }, h('div', {}, sq(g.type), ' ', h('b', {}, g.name), h('span', { class: 'meta' }, ` ${TYPE_KO[g.type]} · 기술 ${skillsOf(g).length ? skillsOf(g).map(SKILL_NAME).join('·') : '없음'}`)), ...skillOfferRows(g)))),
      h('div', { class: 'actions' }, h('button', { onclick: () => { offersDismissed = st.season; render(); } }, '나중에 (카드에서 정하기)')))));
  }
  if (showIntro) app.append(h('div', { class: 'overlay intro' }, h('div', { class: 'introbox' },
    h('div', { class: 'title' }, '미테!'), h('div', { class: 'sub' }, '라니스타의 길'),
    h('p', {}, '검투사는 지고도 살 수 있다.'), h('p', {}, '관중이 미테!를 외치게 하라.'),
    h('p', { class: 'hint' }, '검투사를 사들이고, 시설을 키우고, 계약에 맞춰 내보내라. 명예와 호감도가 높을수록 관중은 살려 달라 외친다.'),
    h('button', { class: 'primary', onclick: () => { unlockAudio(); sfx.chant(3); sfx.cheer(0.8); showIntro = false; localStorage.setItem('lanista-intro', '1'); render(); } }, '입장'))));
  if (cellPop) { // 켈라 팝오버: 누른 방에서 펼쳐진다 (고정 좌표, 화면 안에 들어오게 보정)
    const W = 300, H = Math.min(420, innerHeight - 24);
    const left = Math.max(8, Math.min(innerWidth - W - 8, cellPop.cx - W / 2)), top = Math.max(8, Math.min(innerHeight - H - 8, cellPop.cy - 40));
    app.append(h('div', { class: 'popscrim', onclick: () => { cellPop = null; render(); } }),
      h('div', { class: `cellpop${cellPop.fresh ? ' fresh' : ''}`, style: `left:${left}px;top:${top}px;width:${W}px;max-height:${H}px;transform-origin:${cellPop.cx - left}px ${cellPop.cy - top}px` },
        h('button', { class: 'xclose', title: '닫기', onclick: () => { cellPop = null; render(); } }, '✕'), cellPanel(cellSel)));
    cellPop.fresh = false;
  }
  if (resumed) { resumed = false; notice = '저장된 게임을 이어합니다.'; }
  if (phase === 'over') { app.append(renderOver()); return; }
  // 단계 표시
  const steps = [['manage', '1 관리 · 시장과 루두스'], ['plan', '2 편성 · 계약과 배치'], ['battle', '3 시즌 진행 · 경기 관람']] as const;
  void steps; // 단계 표시줄은 숨김
  if (phase === 'plan') { app.append(renderPlan()); return; }
  if (phase === 'summary') { app.append(renderSummary()); return; }
  if (st.pendingSuccession) { app.append(renderSuccession()); return; } // 정산을 본 뒤 관리 화면에 들어올 때 후계자를 정한다
  app.append(renderTown());
  { const c = coach(); if (c) app.append(c); }
  // 대시보드: 지금 이 화면에서 결정할 일 + 오른쪽 위 이동 버튼
  const nav = [h('button', { class: 'primary wide', onclick: () => { phase = 'plan'; sheet = null; planSel = st.contracts[0]?.id ?? null; render(); } }, '편성 단계로 →')];
  const noticeEl = notice ? h('div', { class: 'ditem notice' }, h('span', { class: 'dot' }), h('span', { class: 'grow' }, notice)) : null; notice = '';
  app.append(h('div', { class: 'dash' }, h('div', { class: 'dashbody' }, noticeEl, ...renderDash()), h('div', { class: 'nav' }, ...nav)));
  // 아래 탭 바: 상세(검투사·시설·파밀리아·규칙)는 시트로 연다 — 화면을 스크롤하지 않도록
  const tab = (key: typeof sheet, label: string, badge = 0) => ({ label, badge, on: sheet === key, onclick: () => { sheet = sheet === key ? null : key; render(); } });
  app.append(tabbar([{ label: '루두스', on: !sheet, onclick: () => { sheet = null; render(); } }, tab('roster', '검투사', st.roster.length), tab('doctors', '독토르', st.roster.filter(g => g.status === 'doctor').length), tab('rivals', '파밀리아', st.rivals.length)])); // 규칙은 메뉴에 // 배지 = 현황 (검투사 수 · 독토르 수 · 파밀리아 수)
}
// ── 탭 바 (화면 아래 고정) 와 시트 (화면 위에 여는 상세)
function tabbar(items: { label: string; badge?: number; on?: boolean; primary?: boolean; disabled?: boolean; onclick: () => void }[]): Node {
  return h('nav', { class: 'tabbar' }, ...items.map(t => h('button', { class: `${t.on ? 'on' : ''}${t.primary ? ' primary' : ''}`, disabled: t.disabled, onclick: t.onclick }, t.label, t.badge ? h('span', { class: 'nbadge' }, String(t.badge)) : null))); // 숫자는 글자 대신 알림 배지로
}
function renderSheet(): Node {
  if (sheet === 'menu') { // 메뉴는 헤더의 톱니바퀴 아래로 내려온다 (아래서 올라오는 시트가 아니라)
    const g = document.querySelector('header .gear')?.getBoundingClientRect();
    const top = g ? g.bottom + 6 : 56, right = g ? Math.max(8, innerWidth - g.right) : 8;
    return h('div', { class: 'overlay clear', onclick: (ev: Event) => { if (ev.target === ev.currentTarget) { sheet = null; render(); } } },
      h('div', { class: 'dropmenu', style: `top:${top}px;right:${right}px` }, menuPanel()));
  }
  const body: (Node | null)[] = sheet === 'help' ? [h('h2', {}, '시너지 · 규칙'), renderHelp()]
    : sheet === 'roster' ? [applicantsPanel(), rosterPanel()]
    : sheet === 'facilities' ? [facilitiesPanel()]
    : sheet === 'doctors' ? [doctorsPanel()]
    : sheet === 'chronicle' ? [chroniclePanel()]
    : sheet === 'rivals' ? [rivalsPanel()]
    : sheet === 'events' ? [eventsPanel()]
    : [menuPanel()];
  // 머리(제목·닫기)는 고정, 몸통만 스크롤. 제목은 본문 패널의 h2 를 그대로 끌어올린다 (배지·정렬·설명 아이콘 포함)
  const nodes = body.filter((n): n is Node => !!n);
  let h2: Element | null = null;
  for (const n of [...nodes].reverse()) { if (n instanceof HTMLElement) { h2 = n.tagName === 'H2' ? n : n.querySelector('h2'); if (h2) break; } }
  const head = h('div', { class: 'sheethead' }, h2 ?? h('h2', {}, ''), h('button', { class: 'xclose', title: '닫기', onclick: () => { sheet = null; render(); } }, '✕'));
  return h('div', { class: 'overlay sheet', onclick: (ev: Event) => { if (ev.target === ev.currentTarget) { sheet = null; render(); } } },
    h('div', { class: 'modal' }, head, h('div', { class: 'sheetbody' }, ...nodes.filter(n => n !== h2))));
}
// 켈라 시트: 칸의 거주자와 숙소 질, 이 칸에 넣을 검투사 고르기
function cellPanel(k: number): Node {
  const q = st.ludus.cells[k] ?? 0, g = occupantOf(st, k), cost = upgradeCost(st, 'cell', k);
  const row = (x: Gladiator, cur: boolean) => h('div', { class: `drow${cur ? ' sel' : ''}`, onclick: cur ? undefined : () => { moveToCell(st, x, k); cellPop = null; render(); } }, // 옮기면 팝오버를 닫는다
    portrait(x, 34), ' ', h('span', { class: 'nm' }, x.name), h('span', { class: 'meta' }, ` ${TYPE_KO[x.type]} · ${x.rank === 'tiro' ? '티로' : '베테'}${x.injured ? ' · 부상' : ''}`), h('span', { style: 'flex:1' }), cur ? h('span', { class: 'hint' }, '이 칸') : h('span', { class: 'hint' }, `${cellOfIdx(x) + 1}번 →`));
  return h('div', { class: 'panel' }, h('h2', {}, `켈라 ${k + 1}번`, h('span', { class: 'stars', style: 'margin-left:8px' }, '★'.repeat(q) + '☆'.repeat(CONFIG.ludus.cells.qualityCost.length - q)), helpBtn('켈라', '검투사가 자는 작은 방입니다. 검투사를 고르면 이 칸으로 오고, 이미 누가 있으면 서로 자리를 바꿉니다.\n숙소 질 ★1 휴식 피로 −2, ★2 유지비 −25%, ★3 명예 +1/시즌. 질은 칸에 붙어 있어 검투사를 옮기면 그 칸의 질을 받습니다.')),
    h('div', { class: 'frow' }, h('div', { class: 'grow' }, h('b', {}, g ? g.name : '빈 칸'), h('div', { class: 'meta' }, g ? `${TYPE_KO[g.type]} · 명예 ${g.honor ?? 0} · 피로 ${g.fatigue ?? 0}` : '검투사를 고르면 이 칸에 들어옵니다')), cost != null ? h('button', { disabled: !canPayFac(cost), onclick: () => { if (upgrade(st, 'cell', k)) { sfx.coin(); render(); } } }, `질↑ ${cost.toLocaleString()}`) : h('span', { class: 'hint' }, '최고')),
    h('div', { class: 'dlist' }, ...st.roster.map(x => row(x, x === g))));
}
const cellOfIdx = (g: Gladiator) => cellOf(st, g);
// 켈라 화면: 회랑 뒤 작은 방들. 칸마다 문·질(등잔 수)·거주자(앉은 모습). 누르면 시트
function cellRects(n: number): { x: number; y: number; w: number; h: number }[] {
  const cols = n <= 4 ? 2 : n <= 6 ? 3 : 4, rows = Math.ceil(n / cols); const gap = 8; // 칸이 적으면 크게 (2열), 많으면 4열
  const w = (VW - 16 - (cols - 1) * gap) / cols, hh = Math.min(120, (TOWN.H - 44 - (rows - 1) * gap) / rows); // 줄이 적으면 방을 크게
  return Array.from({ length: n }, (_, i) => ({ x: 8 + (i % cols) * (w + gap), y: 30 + Math.floor(i / cols) * (hh + gap), w, h: hh }));
}
function drawCellsScene(ctx: CanvasRenderingContext2D, t: number) {
  const VH = TOWN.H; const n = st.ludus.cells.length; const rects = cellRects(n);
  ctx.fillStyle = '#cbb67f'; ctx.fillRect(0, 0, VW, VH); // 회벽
  ctx.fillStyle = '#b39c6a'; ctx.fillRect(0, 0, VW, 22); ctx.fillStyle = '#9b4a2c'; ctx.fillRect(0, 18, VW, 6); // 회랑 처마
  rects.forEach((r, k) => {
    const q = st.ludus.cells[k] ?? 0, g = occupantOf(st, k);
    ctx.fillStyle = g ? '#5a4224' : '#8f7a4e'; ctx.fillRect(r.x, r.y, r.w, r.h); // 방 안 (빈 칸은 막힌 벽처럼 밝게)
    ctx.fillStyle = '#3a2412'; ctx.fillRect(r.x, r.y, r.w, 4); ctx.fillRect(r.x, r.y, 4, r.h); ctx.fillRect(r.x + r.w - 4, r.y, 4, r.h); // 문틀
    ctx.fillStyle = q >= 2 ? '#7a5a1c' : '#5a4224'; ctx.fillRect(r.x + 4, r.y + r.h - 6, r.w - 8, 6); // 바닥
    if (q >= 1) { ctx.fillStyle = '#e8c96a'; ctx.fillRect(r.x + 8, r.y + r.h - 14, r.w * 0.45, 5); } // 짚자리 → 매트
    if (q >= 3) { ctx.fillStyle = '#9b2c1c'; ctx.fillRect(r.x + r.w - 20, r.y + 10, 12, 16); } // 벽걸이 천
    for (let i = 0; i < q; i++) { const lx = r.x + r.w - 10 - i * 9, ly = r.y + 8; ctx.fillStyle = '#e8c96a'; ctx.beginPath(); ctx.ellipse(lx, ly + 3 + Math.sin(t * 9 + i + k) * 0.4, 2.2, 3.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#8a6a44'; ctx.fillRect(lx - 3, ly + 6, 6, 2); } // 등잔 = 질
    if (g) drawStickman(ctx, g.type, { x: r.x + r.w * 0.42, y: r.y + r.h - 7, scale: Math.min(0.95, r.h / 92), pose: 'sit', t: t + k, team: g.rank === 'veteranus' ? '#2c4f9b' : '#6e7f9b', bare: true, facing: 1, accessories: accessoriesOf(g) });
  });
}
function cellBtn(): Node {
  const b = h('button', { class: `cellbtn${cellsOpen ? ' on' : ''}`, title: '켈라', onclick: () => { cellsOpen = !cellsOpen; cellPop = null; render(); } });
  b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-8h6v8"/></svg>';
  return b;
}
// 독토르 시트: 고용한 교관(유형·기준 능력치·기술 전수·제자와 보너스)과 고용할 수 있는 자유민
function doctorsPanel(): Node {
  const docs = st.roster.filter(g => g.status === 'doctor'), free = st.roster.filter(g => g.status === 'rudiarius');
  const docCard = (d: Gladiator) => { const pupils = st.roster.filter(g => g !== d && g.type === d.type && g.status !== 'doctor');
    return h('div', { class: 'card' }, portrait(d, 56),
      h('div', { class: 'grow' },
        h('div', {}, h('span', { class: 'badge doc' }, '독토르'), h('b', {}, d.name), h('span', { class: 'meta' }, ` ${TYPE_KO[d.type]} · ${d.age ?? '?'}세 · ${d.wins}승/${d.fights}전`), d.wins >= CONFIG.doctorSkillWins ? h('span', { class: 'badge mentor', style: 'margin-left:6px' }, '기술 전수') : null),
        h('div', { class: 'meta' }, `기준 공 ${d.base.atk} · 방 ${d.base.def} · 급료 ${CONFIG.doctorSalary}/시즌 · 가르칠 기술: ${skillsOf(d).length ? skillsOf(d).map(SKILL_NAME).join('·') : '없음 (현역 때 익힌 기술이 없다)'}`),
        h('div', { class: 'meta' }, pupils.length ? '제자: ' + pupils.map(g => `${g.name} (공 +${trainGain(st, g, 'atk') - 1 - gymBonus(st)}·방 +${trainGain(st, g, 'def') - 1 - gymBonus(st)})`).join(', ') : `같은 유형(${TYPE_KO[d.type]}) 제자가 없습니다`)),
      h('button', { onclick: () => { backToArena(st, d); render(); } }, '다시 출전'),
      h('button', { onclick: () => { void ask(`${d.name} 을(를) 루두스에서 내보냅니까?`, { ok: '내보내기' }).then(ok => { if (ok) { release(st, d); render(); } }); } }, '내보내기')); };
  const freeCard = (g: Gladiator) => h('div', { class: 'card' }, portrait(g, 56),
    h('div', { class: 'grow' }, h('div', {}, h('span', { class: 'badge free' }, '자유민'), h('b', {}, g.name), h('span', { class: 'meta' }, ` ${TYPE_KO[g.type]} · ${g.wins}승/${g.fights}전`)), h('div', { class: 'meta' }, `공 ${g.base.atk} · 방 ${g.base.def}${doctorFor(st, g.type) ? ` · ${TYPE_KO[g.type]} 독토르 이미 있음` : ''}`)),
    h('button', { class: 'primary', onclick: () => { hireDoctor(st, g); render(); } }, `고용 ${CONFIG.doctorSalary}/시즌`));
  return h('div', { class: 'panel' }, h('h2', {}, '독토르', helpBtn('독토르', `루디스를 받은 자유민을 교관으로 고용합니다. 출전하지 않고 시즌 급료 ${CONFIG.doctorSalary} HS. 같은 유형 훈련에서 독토르의 능력치가 훈련생보다 ${CONFIG.doctorBonus.gapSmall} 이상 높으면 +1, ${CONFIG.doctorBonus.gapBig} 이상이면 +2. ${CONFIG.doctorSkillWins}승 이상이면 유형 기술을 전수합니다. 비문의 doctor secutorum·myrmillonum 처럼 무장별로 한 명씩 두는 것이 자연스럽습니다. 독토르는 라니스타의 후계자 후보가 됩니다.`)),
    ...docs.map(docCard), docs.length ? null : h('div', { class: 'hint', style: 'margin-bottom:8px' }, '고용한 독토르가 없습니다.'),
    free.length ? h('h3', { class: 'sub' }, '고용할 수 있는 자유민') : null, ...free.map(freeCard),
    !docs.length && !free.length ? h('div', { class: 'hint' }, `검투사가 ${CONFIG.rudis.wins}승에 이르면 루디스(자유)를 받을 수 있고, 그 자유민을 독토르로 고용합니다.`) : null);
}
// 연대기: 역대 라니스타 · 명예의 전당(루디스) · 묘비 · 최근 연혁
function chroniclePanel(): Node {
  const hall = [...(st.hall ?? [])].reverse(), dead = [...st.graveyard].reverse(), log = [...st.history].reverse().slice(0, 40);
  const sec = (title: string, hint: string, kids: (Node | null)[]) => h('div', { class: 'chsec' }, h('h3', { class: 'sub' }, title, hintSpan(hint)), ...(kids.length ? kids : [h('div', { class: 'hint' }, '아직 없음')]));
  const lanistas = [...(st.lineageLog ?? []).map(l => h('div', { class: 'drow' }, h('span', { class: 'meta' }, '⚖'), ' ', h('span', {}, l))), h('div', { class: 'drow sel' }, h('span', { class: 'meta' }, '⚖'), ' ', h('b', {}, st.lanista.name), h('span', { class: 'meta' }, ` ${st.lanista.age}세 · ${st.lanista.since}번째 시즌부터 · ${st.lanista.trait === 'doctor' ? '전직 독토르' : st.lanista.trait === 'freedman' ? '해방노예' : '창업자'}`))];
  return h('div', { class: 'panel' }, h('h2', {}, '연대기', helpBtn('연대기', '루두스의 역사입니다. 역대 라니스타는 은퇴·사망으로 물려준 순서, 명예의 전당은 루디스(나무 검)로 자유를 얻은 검투사, 묘비는 경기장에서 죽은 검투사입니다. 폼페이 낙서와 묘비처럼 이름·전적·별칭이 남습니다.')),
    sec('역대 라니스타', `${(st.lineageLog?.length ?? 0) + 1}대`, lanistas),
    sec('명예의 전당', `루디스 ${hall.length}`, hall.map(e => h('div', { class: 'drow' }, sq(e.type), ' ', h('b', {}, e.name), h('span', { class: 'meta' }, ` ${TYPE_KO[e.type]} · ${e.wins}승/${e.fights}전 · 명예 ${e.honor} · ${seasonName(e.season)}${e.how === 'damnatus' ? ' · 형기 만료' : e.how === 'refused' ? ' · 루디스 거절' : ''}`), ...e.epithets.map(id => { const ep = EPITHET_BY_ID[id as EpithetId]; return ep ? h('span', { class: 'badge epithet', style: 'margin-left:4px' }, ep.name) : null; }), ...(e.skills ?? []).map(id => h('span', { class: 'badge skill', style: 'margin-left:4px' }, SKILL_NAME(id)))))),
    sec('묘비', `${dead.length}명`, dead.map(g => h('div', { class: 'drow' }, sq(g.type), ' ', h('b', {}, g.name), h('span', { class: 'meta' }, ` ${TYPE_KO[g.type]} · ${g.wins}승/${g.fights}전${g.age ? ` · ${g.age}세` : ''} — 관중은 침묵했다`)))),
    sec('연혁', '최근 40건', log.map(l => h('div', { class: 'meta', style: 'padding:2px 0' }, l))));
}
function menuPanel(): Node {
  return h('div', {}, h('div', { class: 'menulist' },
    canRetire(st) && !st.pendingSuccession && phase === 'manage' ? h('button', { title: `${CONFIG.lanista.voluntaryAge}세(세니오레스)부터 자발적으로 물러나 후계자에게 넘길 수 있습니다`, onclick: () => { void ask(`${st.lanista.name} (${st.lanista.age}세) 이(가) 은퇴하고 후계자를 정합니까?`, { ok: '은퇴' }).then(ok => { if (ok) { sheet = null; retire(st); render(); } }); } }, `은퇴 (${st.lanista.age}세, 후계자에게 넘김)`) : null,
    h('button', { title: '효과음 켜기/끄기', onclick: () => { setSoundEnabled(!soundEnabled()); render(); } }, soundEnabled() ? '🔊 효과음 켜짐' : '🔇 효과음 꺼짐'),
    h('button', { onclick: () => { sheet = 'help'; render(); } }, '시너지 · 규칙'),
    h('button', { onclick: () => { // 저장을 파일로 내려받기 (다른 기기·브라우저에서 이어가기)
      const blob = new Blob([JSON.stringify(serialize(st))], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `mitte-save-${st.lanista.name.split(' ').pop()}-${st.season}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); } }, '저장 파일로 내려받기'),
    h('button', { onclick: () => { const inp = h('input', { type: 'file', accept: '.json,application/json' }) as HTMLInputElement;
      inp.onchange = () => { const f = inp.files?.[0]; if (!f) return; f.text().then(txt => { try { const next = deserialize(JSON.parse(txt)); void ask(`${next.lanista.name} ${next.season}번째 시즌 저장을 불러옵니다. 지금 게임은 덮어씁니다.`, { ok: '불러오기' }).then(ok => { if (!ok) return; st = next; phase = 'manage'; sheet = null; assign = {}; trainPlan = {}; townCanvas = null; view = 'ludus'; cellsOpen = false; notice = '저장 파일을 불러왔습니다.'; render(); }); } catch { void tell('저장 파일을 읽을 수 없습니다.'); } }); };
      inp.click(); } }, '저장 파일 불러오기'),
    h('button', { onclick: () => { void ask('저장을 지우고 새 게임을 시작합니까?', { ok: '새 게임' }).then(ok => { if (!ok) return; clearSave(); st = newGame(Math.floor(Math.random() * 100000)); phase = 'manage'; sheet = null; assign = {}; trainPlan = {}; townCanvas = null; view = 'ludus'; render(); }); } }, '새 게임')));
}
  // 문 앞의 지원자 (자유민 아욱토라티): 계약금으로 데려온다
function applicantsPanel(): Node | null {
  if (!st.applicants.length) return null;
    const full = st.roster.length >= rosterCap(st);
    return (h('div', { class: 'panel', style: 'margin-bottom:10px' }, h('h2', {}, '문 앞의 지원자', helpBtn('자유민 지원자 (아욱토라티)', `자유민 검투사가 스스로 계약을 청합니다. 계약금만 내면 되고, 출전마다 대여료의 ${Math.round(CONFIG.rudiariusShare * 100)}%를 급료로 받으며 ${CONFIG.origins.auctoratus.term}시즌 계약입니다. 자유민이라 팔 수 없고 사망 배상도 없습니다. 이번 시즌이 지나면 떠납니다.`)),
      h('div', { class: 'cardgrid' }, ...st.applicants.map(g => gladCard(g, [
        h('button', { class: 'primary', disabled: st.money < g.buyPrice || full, title: full ? '켈라이 가득 찼습니다' : '', onclick: () => { if (buy(st, g)) { sfx.coin(); render(); } } }, `계약 ${g.buyPrice.toLocaleString()}`)])))));
}
  // 루두스 시설: 세 건물 × 세부 항목. 모든 항목이 유한 단계 (장기 지출처)
// 시설 행 (이름 · 단계 · 효과 · 강화 버튼). 시설 시트와 의무실·훈련소 대시보드가 같이 쓴다
const canPayFac = (cost: number) => st.money - cost >= upkeepOf(st); // 다음 시즌 유지비는 남겨 둔다
function facBtn(f: Facility, idx = 0): Node { const cost = upgradeCost(st, f, idx); return cost != null ? h('button', { disabled: !canPayFac(cost), title: !canPayFac(cost) && st.money >= cost ? `유지비 ${upkeepOf(st).toLocaleString()} HS 를 남기려면 자금이 더 필요합니다` : '', onclick: () => { if (upgrade(st, f, idx)) { sfx.coin(); render(); } } }, `${cost.toLocaleString()}`) : h('span', { class: 'hint' }, '최대'); }
function facRow(name: string, level: string, effect: string, f: Facility): Node { return h('div', { class: 'frow' }, h('div', { class: 'grow' }, h('b', {}, name), ' ', h('span', { class: 'meta' }, level), h('div', { class: 'meta' }, effect)), facBtn(f)); }
function facRows(group: 'cells' | 'medic' | 'yard'): Node[] {
  const L = CONFIG.ludus, u = st.ludus;
  if (group === 'cells') return [facRow('켈라 증축', `${u.cells.length}칸 / ${L.cells.max}`, `+${L.cells.per}칸`, 'cells'), facRow('조리장', `${u.kitchen} / ${L.kitchen.cost.length}단계`, `출전 HP +${u.kitchen * L.kitchen.hpPerLevel}`, 'kitchen')];
  if (group === 'medic') return [
    facRow('침상', `${u.beds}개 / ${L.beds.max}`, `부상 ${st.roster.filter(g => g.injured > 0).length}명`, 'beds'),
    facRow('의술', `${u.medicine} / ${L.medicine.cost.length}단계`, `부상 ${u.medicine >= L.medicine.injuryAt ? 1 : 2}시즌 · 치료 ${healCostOf(st)}`, 'medicine'),
    facRow('약재', `${u.herbs} / ${L.herbs.cost.length}단계`, `피로 면제 ${Math.round(u.herbs * L.herbs.skipFatiguePer * 100)}%`, 'herbs')];
  return [facRow('팔루스', `${u.palus}개 / ${L.palus.max}`, `훈련 ${trainedCount(st)}/${u.palus}명`, 'palus'), facRow('훈련 시설', `${u.gym} / ${L.gym.cost.length}단계`, `훈련 폭 +${gymBonus(st)}`, 'gym')];
}
function facilitiesPanel(): Node {
    const L = CONFIG.ludus, u = st.ludus;
    const canPay = canPayFac; void L;
    // 켈라: 칸 목록 (거주자 + 숙소 질 별 + 강화 버튼). 칸 순서 = 로스터 순서, ◀▶ 로 옮김
    const cells = u.cells.map((q, k) => { const g = occupantOf(st, k); const cost = upgradeCost(st, 'cell', k);
      return h('div', { class: `cellbox q${q}${g ? '' : ' empty'}` },
        h('div', { class: 'cellhead' }, h('span', { class: 'meta' }, `${k + 1}번`), h('span', { class: 'stars' }, '★'.repeat(q) + '☆'.repeat(L.cells.qualityCost.length - q))),
        h('div', { class: 'nm' }, g ? g.name : '빈 칸'),
        h('div', { class: 'cellbtns' },
          g && k > 0 ? h('button', { class: 'tiny', title: '앞 칸과 바꾸기', onclick: () => { swapCells(st, k, k - 1); render(); } }, '◀') : null,
          cost != null ? h('button', { class: 'tiny', disabled: !canPay(cost), title: `숙소 질 +1 (${cost.toLocaleString()} HS)`, onclick: () => { if (upgrade(st, 'cell', k)) render(); } }, `질↑ ${(cost / 1000).toFixed(0)}k`) : h('span', { class: 'hint' }, '최고'),
          g && k < u.cells.length - 1 ? h('button', { class: 'tiny', title: '뒤 칸과 바꾸기', onclick: () => { swapCells(st, k, k + 1); render(); } }, '▶') : null)); });
    return h('div', { class: 'panel' }, h('h2', {}, '루두스 시설', hintSpan(`켈라 ${u.cells.length} · 침상 ${u.beds} · 팔루스 ${u.palus}`), helpBtn('루두스 시설', '모든 시설은 단계가 정해져 있습니다.\n켈라: 칸 수 = 검투사 상한. 칸마다 숙소 질 ★1 휴식 피로 −2, ★2 유지비 −25%, ★3 명예 +1/시즌.\n조리장: 출전 HP +5/단계.\n의무실: 침상(모자라면 부상 +1시즌), 의술(2단계 부상 1시즌, 4단계 치료 250), 약재(피로 면제 20%/단계).\n훈련장: 팔루스 = 시즌당 훈련 인원, 훈련 시설 3·5단계에서 훈련 폭 +1.\n강화 버튼은 다음 시즌 유지비를 남길 수 있을 때만 켜집니다.')),
      h('div', { class: 'fgrid' },
        h('div', { class: 'fcol' }, h('h3', {}, '켈라 · 숙소'),
          h('div', { class: 'cells' }, ...cells),
          ...facRows('cells')),
        h('div', { class: 'fcol' }, h('h3', {}, '의무실'),
          ...facRows('medic')),
        h('div', { class: 'fcol' }, h('h3', {}, '훈련장'),
          ...facRows('yard'))));
}
  // 상대 파밀리아 패널: 간판 검투사, 나와의 전적, 명단 요약
function rivalsPanel(): Node {
    return h('div', { class: 'panel' }, h('h2', {}, '상대 파밀리아', hintSpan(`${st.rivals.length}곳 · 이번 시즌 계약 상대 ${new Set(st.contracts.map(c => c.rivalId).filter(Boolean)).size}곳`)),
      h('div', { class: 'rivals' }, ...st.rivals.map(rv => { const star = rivalStar(rv); const inContracts = st.contracts.filter(c => c.rivalId === rv.id).length;
        return h('div', { class: 'rivalcard' }, star ? portrait(star, 56, true) : h('div', { class: 'portrait', style: 'width:56px;height:56px' }),
          h('div', { class: 'grow' }, h('div', {}, h('b', {}, rv.name), inContracts ? h('span', { class: 'badge revenge', style: 'margin-left:6px' }, `이번 시즌 계약 ${inContracts}`) : null),
            h('div', { class: 'meta' }, star && ((star.honor ?? 0) >= 20 || star.wins >= 3) ? `간판: ${star.name} (${TYPE_KO[star.type]} ${star.rank === 'tiro' ? '티로' : '베테'}, ${star.wins}승/${star.fights}전, 명예 ${star.honor ?? 0}${(star.skills ?? []).length ? `, 기술 ${(star.skills ?? []).map(SKILL_NAME).join('·')}` : ''})` : '아직 이름난 검투사가 없음'),
            h('div', { class: 'meta' }, `${recordVsMe(rv)} · 명단 ${rv.roster.filter(g => g.alive).length}명 (부상 ${rv.roster.filter(g => g.injured > 0).length})`),
            h('div', { class: 'meta rivalroster' }, ...rv.roster.filter(g => g.alive).map(g => h('span', { class: `rmini${g.injured ? ' inj' : ''}`, title: `${g.name} · ${TYPE_KO[g.type]} · ${g.wins}승/${g.fights}전 · 명예 ${g.honor ?? 0}${g.injured ? ' · 부상' : ''}` }, h('span', { class: 'sq small', style: `background:${TYPE_COLOR[g.type]}` }, glyphSvg(g.type, 12)), ` ${g.name}`))))); })));
}
function rosterPanel(): Node {
  // 루두스 검투사 목록 (전체 폭, 카드 2열). 계약은 대시보드에 있으므로 여기서는 생략
  const sortKeys: [typeof rosterSort, string][] = [['cell', '켈라'], ['honor', '명예'], ['wins', '승수'], ['type', '유형']];
  const sorted = [...st.roster].map((g, i) => ({ g, i })).sort((a, b) => rosterSort === 'cell' ? a.i - b.i : rosterSort === 'honor' ? (b.g.honor ?? 0) - (a.g.honor ?? 0) : rosterSort === 'wins' ? b.g.wins - a.g.wins : a.g.type.localeCompare(b.g.type)).map(x => x.g);
  const sortSel = dropdown('sort', sortKeys.map(([value, label]) => ({ value, label })), rosterSort, v => { rosterSort = v as typeof rosterSort; localStorage.setItem('lanista-sort', rosterSort); render(); });
  const injN = st.roster.filter(g => g.injured > 0).length, docN = st.roster.filter(g => g.status === 'doctor').length;
  return h('div', { class: 'panel' }, h('h2', { class: 'rowhead' }, `${st.roster.length}명`,
      injN ? h('span', { class: 'stat-ico injured', title: `부상 ${injN}명` }, svgIcon('cross'), String(injN)) : null,
      docN ? h('span', { class: 'stat-ico doc', title: `독토르 ${docN}명 (유형마다 둘 수 있다)` }, svgIcon('staff'), String(docN)) : null,
      h('span', { style: 'flex:1' }), sortSel),
    h('div', { class: 'cardgrid' }, ...sorted.map(g => gladCard(g, [
      g.injured ? h('button', { disabled: st.money < healCostOf(st), onclick: () => { heal(st, g); render(); } }, `치료 ${healCostOf(st)}`) : null,
      (g.status ?? 'slave') === 'slave' ? h('button', { onclick: () => { void ask(`${g.name} 을(를) ${sellPrice(g)} HS 에 매각합니까?`, { ok: '매각' }).then(ok => { if (ok) { sell(st, g); render(); } }); } }, `매각 ${sellPrice(g).toLocaleString()}`) : null,
      g.status === 'rudiarius' ? h('button', { title: `출전 대신 훈련을 맡긴다. 시즌 급료 ${CONFIG.doctorSalary} HS, 같은 유형 훈련 +${CONFIG.doctorBonus}`, onclick: () => { hireDoctor(st, g); render(); } }, `독토르 고용 ${CONFIG.doctorSalary}/시즌`) : null,
      g.status === 'doctor' ? h('button', { onclick: () => { backToArena(st, g); render(); } }, '다시 출전 계약') : null,
      !g.injured && g.status !== 'doctor' && !g.fought ? dropdown(`retrain-${g.id}`, (Object.keys(TYPE_KO) as GType[]).filter(t => t !== g.type).map(t => ({ value: t, label: TYPE_KO[t] })), '', v => { const t = v as GType; void ask(`${g.name} 을(를) ${TYPE_KO[t]} 로 재훈련합니까? ${CONFIG.retrainCost} HS, 이번 시즌 출전 불가. 공·방은 유지, 속도·사거리는 새 유형`, { ok: '재훈련' }).then(ok => { if (ok) { if (!retrain(st, g, t)) void tell('자금이 모자랍니다'); } render(); }); }, '유형 전환…') : null,
      g.status === 'rudiarius' && g.contractUntil != null && g.contractUntil - st.season <= 1 ? h('button', { class: 'primary', disabled: st.money < renewCost(g), title: `계약 ${CONFIG.origins.auctoratus.term}시즌 연장`, onclick: () => { renewContract(st, g); render(); } }, `재계약 ${renewCost(g).toLocaleString()}`) : null,
      g.status && g.status !== 'slave' ? h('button', { onclick: () => { void ask(`${g.name} 을(를) 루두스에서 내보냅니까? (자유민이라 값을 받을 수 없습니다)`, { ok: '내보내기' }).then(ok => { if (ok) { release(st, g); render(); } }); } }, '내보내기') : null,
      ...skillOfferRows(g),
    ], { dis: !!g.injured }))),
    st.graveyard.length ? h('div', { class: 'grave' }, '묘비: ' + st.graveyard.map(g => `${g.name} ${g.wins}승/${g.fights}전`).join(' · ')) : null);
}

// ── 후계: 은퇴한 라니스타의 뒤를 이을 사람을 고른다
function renderSuccession(): Node {
  const opts = successorOptions(st);
  return h('div', { class: 'overlay' }, h('div', { class: 'modal' },
    h('h2', {}, `${st.lanista.name} ${st.lanista.dead ? '사망' : '은퇴'}`, h('span', { class: 'hint', style: 'margin-left:10px;font-weight:400' }, `${st.lanista.age}세 · 후계자를 정하십시오`)),
    h('div', { class: 'hint', style: 'margin-bottom:8px' }, `자금·검투사·시설은 그대로 잇고, 호감도는 ${Math.round(CONFIG.lanista.fameKeep * 100)}%에 후계자의 명예 일부가 더해집니다. 독토르가 이으면 검투사 명단에서 빠집니다.`),
    ...opts.map(o => h('div', { class: 'card', onclick: () => { succeed(st, o); notice = `${st.lanista.name} 이(가) 루두스를 이어받았습니다.`; render(); } },
      o.from ? portrait(o.from, 56) : h('div', { class: 'portrait', style: 'width:56px;height:56px;display:flex;align-items:center;justify-content:center;font-size:22px' }, '⚖'),
      h('div', { class: 'grow' }, h('div', {}, h('b', {}, o.label), o.from ? h('span', { class: 'meta' }, ` ${o.from.age ?? '?'}세`) : null), h('div', { class: 'meta' }, o.desc), o.from ? h('div', { class: 'meta' }, `명예 ${o.from.honor ?? 0} → 호감도 계승 +${Math.round((o.from.honor ?? 0) * CONFIG.lanista.fameFromHonor)}`) : null),
      h('button', { class: 'primary' }, '승계')))));
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
      row('결과', `살아남으면 ${Math.round(M.injuryChance * 100)}% 확률로 부상 (${injurySeasons(st)}시즌 출전 불가, 치료 ${healCostOf(st)} HS). 실패하면 사망하고 주최자가 배상 (구매가×${CONFIG.deathComp.priceMult} + 승수×${CONFIG.deathComp.perWin}).`)),
    sec('주최자 (에디토르)',
      ...(Object.keys(HOST) as (keyof typeof HOST)[]).map(k => { const H = HOST[k]; return row(H.ko, `${H.desc} 상금 ×${H.prize}, 대여료 ×${H.rent}, 미시오 ${H.missio >= 0 ? '+' : ''}${Math.round(H.missio * 100)}%, 루디스 ${H.rudis >= 0 ? '+' : ''}${Math.round(H.rudis * 100)}%${H.fameWin ? `, 승리 호감도 +${H.fameWin}` : ''}${H.honorAll ? `, 출전자 명예 +${H.honorAll}` : ''}.`); }),
      row('팬', `명예 + 승수×2 + 별칭×5. ${FANS_STAR} 이상이면 스타: 관중이 이름을 외치고 관중석이 더 차며, 선거 후보의 경기에서 이기면 호감도 +1 (폼페이 낙서의 팬심).`),
      row('내기 (스폰시오)', '기량 시합에 거는 내기는 로마법에서도 허용됐다(Digesta 11.5). 도박꾼 주최자의 계약에서 받으면 이길 때 상금 두 배, 지면 상금만큼 물어낸다.')),
    sec('경영',
      row('수입', `계약마다 대여료 (티로 ${CONFIG.rentTiro}, 베테라누스 ${CONFIG.rentVeteran}) + 승리 상금 (등급×${CONFIG.prizePerTier}). 대여료는 승패와 무관 (고증).`),
      row('출전 경비', `대여료의 ${Math.round(CONFIG.fightExpense.rentRate * 100)}% (장비 정비·식량·의료) + 등급×${CONFIG.fightExpense.perTier} (이동·호송) 이 경기마다 차감.`),
      row('지출', `시즌 유지비 검투사 1명당 ${CONFIG.upkeepPerGladiator}. 훈련 ${CONFIG.trainCost} (시즌당 1회, 공 또는 방 +1).`),
      row('호감도', `승리 +${CONFIG.fameDelta.win}, 패배 ${CONFIG.fameDelta.lose}, 사망 ${CONFIG.fameDelta.death}, 매 시즌 ${CONFIG.fameDelta.decay} (한 번이라도 출전하면 +${CONFIG.fameDelta.active}). 받을 수 있는 계약을 거절하면 시즌당 ${CONFIG.fameDelta.refuse} (인원·베테라누스 부족은 벌점 없음). 등급 2는 ${CONFIG.fameTierReq[2]}, 등급 3은 ${CONFIG.fameTierReq[3]} 이상 필요.`),
      row('별칭', `베테라누스가 전적 조건을 채우면 붙는다 (최대 3개, 초상·경기 화면에 장식). ${EPITHETS.map(e => `'${e.name}'${e.attested ? '*' : ''}(${e.cond}: ${e.effect})`).join(' · ')}. *는 폼페이 낙서·묘비·마르티알리스의 실제 기록.`),
      row('상대 파밀리아', `상대는 시즌을 넘어 유지되는 네 파밀리아(율리우스·암플리아투스·네로니아누스·스카이바)에서 나온다. 그들도 승패·명예·부상·사망이 쌓이고 빈자리를 채운다. 경기 광고(에딕타)처럼 상대 이름과 전적은 전부 공개.`),
      row('원한과 복수', `내가 이기고 살려 준 상대를 다시 만나면 그는 공격 ×${CONFIG.grudge.atk}, 그에게 지면 미시오 ${Math.round(CONFIG.grudge.missio * 100)}% (우르비쿠스 묘비: "네가 이긴 자를 조심하라"). 나를 쓰러뜨렸던 상대를 꺾으면 복수: 명예 +${CONFIG.grudge.revengeHonor}, 별칭 '복수자'.`),
      row('유형 전환', `관리 화면 카드에서 다른 유형으로 재훈련 (${CONFIG.retrainCost} HS, 그 시즌 출전 불가). 공·방은 유지, 속도·사거리는 새 유형. 세 유형으로 각각 이기면 '혼자서 세 유형을 다 싸우는 자'(헤르메스).`),
      row('기술 전수 (추가 유형)', `호플로마쿠스·에퀘스 돌진 ×${CONFIG.mentor.chargeMult}, 프로보카토르 치명타 피격 ${CONFIG.mentor.critTaken}, 디마카에루스 연속 +${Math.round(CONFIG.mentor.twinBonus * 100)}% 추가.`),
      row('왼손잡이', `타고난 특성(매물 10%). 왼손잡이(스카이바)는 상대 방패의 첫 타격 감소를 절반으로 만든다. 비문에 따로 표기될 만큼 귀했다.`),
      row('루디스 거절', `루디스를 받은 경기의 결과 화면에서 거절할 수 있다. 플람마처럼 노예로 남는 대신 명예 +8.`),
      row('나이', `검투사는 티로 ${CONFIG.age.tiro[0]}~${CONFIG.age.tiro[1]}세, 베테라누스 ${CONFIG.age.veteran[0]}~${CONFIG.age.veteran[1]}세로 들어오고 봄마다 한 살. ${CONFIG.age.spdFrom}세부터 ${CONFIG.age.spdEvery}년마다 속도 −1, ${CONFIG.age.statFrom}세부터 ${CONFIG.age.statEvery}년마다 공·방 −1 (비문의 검투사 사망 연령은 대부분 20~30대).`),
      row('후계', `라니스타는 봄마다 한 살 먹는다. 정해진 은퇴 나이는 없고 해마다 나이에 따라 죽을 확률이 있다 (40세 미만 1%, 40대 2.5%, 50대 4.5%, 60대 8%, 70세 이상 14% — 울피아누스 생명표 근사). ${CONFIG.lanista.voluntaryAge}세(세니오레스)부터 자발 은퇴 가능. 독토르 후계자는 제 나이 그대로 잇는다. 후계자는 독토르 중 한 명(그 유형 훈련 +${CONFIG.lanista.doctorTrainBonus}, 명예×${CONFIG.lanista.fameFromHonor} 만큼 호감도에 보탬) 또는 부하 해방노예(시장 ${Math.round(CONFIG.lanista.freedmanDiscount * 100)}% 할인). 자금·검투사·시설은 그대로, 호감도는 ${Math.round(CONFIG.lanista.fameKeep * 100)}% 계승.`),
      row('확보 경로', `시장 매물의 출신: 노예 상인(기본), 전쟁 포로(값 −35%, 공격·HP 높음, 미시오 −5%), 형벌 죄수(값 −60%, 능력치 −2, 배상 절반, 12시즌 뒤 자유), 자유민 계약자(아욱토라티)는 시장에 서지 않고 루두스 문 앞에 찾아온다(호감도가 높을수록 자주): 계약금 ×0.8, 급료 지급, 8시즌 계약, 재계약 = 계약금 절반. 첫 시즌은 노예 상인만.`),
      row('루디스', `승리로 ${CONFIG.rudis.wins}승에 이르면 주최자가 확률적으로 루디스(나무 검)를 내려 자유민이 된다 (기본 ${Math.round(CONFIG.rudis.base * 100)}% + 호감도, 관대 +20%/잔혹 −20%). 자유민은 팔 수 없고 사망 배상도 없다. 계속 출전하면 대여료의 ${Math.round(CONFIG.rudiariusShare * 100)}%를 급료로 가져간다.`),
      row('독토르', `자유민을 교관으로 고용하면 출전하지 않고 시즌 급료 ${CONFIG.doctorSalary} HS 를 받는다. 같은 유형 훈련에서 독토르의 해당 능력치가 훈련생보다 ${CONFIG.doctorBonus.gapSmall} 이상 높으면 +1, ${CONFIG.doctorBonus.gapBig} 이상이면 +2 추가 (스승을 넘어서면 보너스 없음).`),
      row('기술 전수', `${CONFIG.doctorSkillWins}승 이상 독토르는 같은 유형 제자에게 유형 기술을 전수: 세쿠토르 연속 공격 +${Math.round(CONFIG.mentor.comboBonus * 100)}%, 무르밀로 방패 첫 타격 감소 ${Math.round(CONFIG.mentor.shieldReduce * 100)}%, 트라엑스 방어 무시 ${Math.round(CONFIG.mentor.sicaIgnore * 100)}%, 레티아리우스 속박 ${CONFIG.mentor.bindSec}초.`),
      row('시설', `켈라 칸 수 = 로스터 상한(4→16). 칸마다 숙소 질 ★1 피로 회복 −2, ★2 유지비 −25%, ★3 명예 +1/시즌. 조리장 출전 HP +5/단계. 의무실: 침상(1→4, 모자라면 부상 +1시즌)·의술(2단계 부상 1시즌, 4단계 치료 250)·약재(피로 면제 20%/단계). 훈련장: 팔루스 = 시즌당 훈련 인원(2→6)·훈련 시설(3·5단계 훈련 폭 +1).`),
      row('시즌 행동', `출전하지 않는 검투사는 편성에서 행동을 고른다. 휴식(피로 −1, ★1 숙소면 −2) · 훈련 공/방(팔루스 자리) · 시범(훈련장 공개, 명예 +${CONFIG.actions.show.honor}). 부상자는 요양(무료, 회복 +${CONFIG.actions.recover.extra}시즌 가속) 또는 치료.`),
      row('시즌 행사', `편성 화면에서 선택. 공개 만찬(케나 리베라) ${CONFIG.events.cena.cost}: 출전 검투사 명예 +${CONFIG.events.cena.honor}, 호감도 +${CONFIG.events.cena.fame}. 행렬(폼파) ${CONFIG.events.pompa.cost}: 명예 +${CONFIG.events.pompa.honor}, 호감도 +${CONFIG.events.pompa.fame}. 네메시스 봉헌 ${CONFIG.events.votum.cost}: 이번 시즌 미시오 +${Math.round(CONFIG.events.votum.missio * 100)}%. 벽화 광고(에딕타) ${CONFIG.events.edicta.cost}: 출전 검투사 명예 +${CONFIG.events.edicta.honor}. 귀족 손님 초대 ${CONFIG.events.guests.cost}: 출전 가능 검투사 명예 +${CONFIG.events.guests.honor}, 호감도 +${CONFIG.events.guests.fame}, 사례금 +${CONFIG.events.guests.gift}.`),
      row('명예', `검투사 개인의 인기. 승리 +${CONFIG.honor.win} (등급마다 +${CONFIG.honor.perTier}), 전통 짝 +${CONFIG.honor.classic}, 화관(주최자 만족) +${CONFIG.honor.crown}, 패배 ${CONFIG.honor.lose}. 미시오 생존 +${CONFIG.honor.missioPer * 100}%/점, 대여료 +${CONFIG.honor.rentPer * 100}%/점 (스타는 비싸다). 폼페이 낙서의 팬심과 비싼 스타를 죽이기 꺼린 주최자가 근거.`),
      row('출전', `계약마다 규모가 다름 (1대1 · 2대2 · 3대3). 검투사는 시즌당 1회만 출전. ${CONFIG.promoteWins}승이면 베테라누스로 승격.`),
      row('피로', `출전마다 피로 +1 (최대 ${CONFIG.fatigue.max}), 쉬는 시즌마다 −1. 피로 1당 공·방 −${CONFIG.fatigue.statPenalty}, 미시오 −${Math.round(CONFIG.fatigue.missioPenalty * 100)}%. 로스터를 돌려 쉬게 할 것.`)));
}

// ── 대시보드: 현재 장소에서 선택해야 하는 일들
function renderDash(): Node[] {
  const item = (cls: string, text: string, extra?: Node | null) => h('div', { class: `ditem ${cls}` }, h('span', { class: 'dot' }), h('span', { class: 'grow' }, text), extra ?? null);
  if (view === 'market') {
    const g = st.market.find(x => x.id === marketSel);
    const out: Node[] = [h('h3', {}, '노예 시장', h('span', { class: 'hint', style: 'margin-left:8px;text-transform:none' }, `매물 ${st.market.length}명 · 보유 ${st.money.toLocaleString()} HS`))];
    if (!st.market.length) return [...out, item('idle', '이번 시즌 매물이 없습니다.')];
    const full = st.roster.length >= rosterCap(st);
    if (full) out.push(item('warn', `켈라이 가득 찼습니다 (${st.roster.length}/${rosterCap(st)}). 루두스에서 켈라을 증축하거나 검투사를 매각해야 살 수 있습니다.`));
    if (g && g.origin && g.origin !== 'slave') out.push(item('idle', `${ORIGIN_KO[g.origin]}: ` + (g.origin === 'captive' ? `값 ${Math.round((1 - CONFIG.origins.captive.price) * 100)}% 저렴, 공격 +${CONFIG.origins.captive.atk}·HP +${CONFIG.origins.captive.hp}. 관중이 이방인에게 냉담해 미시오 ${Math.round(CONFIG.origins.captive.missio * 100)}%.` : g.origin === 'damnatus' ? `값 ${Math.round((1 - CONFIG.origins.damnatus.price) * 100)}% 저렴, 능력치 ${CONFIG.origins.damnatus.stat}. 사망 배상 절반. ${CONFIG.origins.damnatus.freeAfter}시즌 뒤 형기 만료로 자유민이 됨.` : `계약금 ${g.buyPrice.toLocaleString()} HS 로 ${CONFIG.origins.auctoratus.term}시즌 계약. 자유민이라 매각·배상 없음, 출전마다 대여료의 ${Math.round(CONFIG.rudiariusShare * 100)}% 급료. 만료 전 재계약(계약금의 절반) 가능.`)));
    if (g) out.push(gladCard(g, [h('button', { class: 'primary', disabled: st.money < priceOf(st, g) || full, onclick: () => { if (buy(st, g)) { sfx.coin(); marketSel = null; render(); } } }, `구매 ${priceOf(st, g).toLocaleString()}${priceOf(st, g) < g.buyPrice ? ' (할인)' : ''}`)], { sel: true }),
      st.money < priceOf(st, g) ? item('warn', `자금이 ${(priceOf(st, g) - st.money).toLocaleString()} HS 부족합니다.`) : null as unknown as Node);
    else out.push(h('div', { class: 'card ghost' }, h('span', { class: 'hint' }, '매물을 고르세요'))); // 선택 전에도 같은 높이를 차지해 목록이 움직이지 않는다
    out.push(h('div', { class: 'dlist' }, ...st.market.map(m => h('div', { class: `drow${m.id === marketSel ? ' sel' : ''}${st.money < priceOf(st, m) ? ' dis' : ''}`, onclick: () => { marketSel = m.id; render(); } },
      h('span', { class: 'sq small', style: `background:${TYPE_COLOR[m.type]}` }, glyphSvg(m.type, 14)), ' ', h('span', { class: 'nm' }, m.name), ' ', originBadge(m), m.scaeva ? h('span', { class: 'badge scaeva' }, '왼손잡이') : null, h('span', { class: 'meta' }, `${TYPE_KO[m.type]} · ${m.age ?? '?'}세 · HP ${m.base.hp} 공 ${m.base.atk} 방 ${m.base.def}`), h('span', { style: 'flex:1' }), h('span', { class: 'price' }, `${priceOf(st, m).toLocaleString()} HS`)))));
    return out.filter(Boolean);
  }
  if (cellsOpen) { // 켈라 화면: 칸별 숙소 질 강화 + 증축·조리장
    const out: Node[] = [h('h3', {}, '켈라', h('span', { class: 'hint', style: 'margin-left:8px;text-transform:none' }, `${st.roster.length} / ${st.ludus.cells.length}칸`), helpBtn('켈라', '켈라 수 = 검투사 상한. 칸마다 숙소 질을 올릴 수 있고(★1 휴식 피로 −2, ★2 유지비 −25%, ★3 명예 +1/시즌), 질은 칸에 붙어 있습니다. 위 그림의 방을 누르면 거주자를 바꿀 수 있습니다.'))];
    out.push(item('idle', '위 그림의 방을 누르면 거주자와 숙소 질을 정합니다.'));
    out.push(h('div', { class: 'dlist' }, ...facRows('cells')));
    return out;
  }
  if (view === 'grave') { // 묘지: 대시보드에 연대기를 그대로 보여 준다 (역대 라니스타 · 명예의 전당 · 묘비 · 연혁)
    const c = chroniclePanel() as HTMLElement; c.classList.remove('panel'); c.classList.add('chronicle');
    return [c];
  }
  if (view === 'medic') { // 의무실: 부상자 치료·요양, 침상·의술·약재
    const injured = st.roster.filter(g => g.injured);
    const out: Node[] = [h('h3', {}, '의무실', h('span', { class: 'hint', style: 'margin-left:8px;text-transform:none' }, `침상 ${st.ludus.beds} · 부상 ${injured.length}명 · 치료 ${healCostOf(st)} HS`), helpBtn('의무실', `부상자는 ${injurySeasons(st)}시즌 동안 출전하지 못합니다. 치료(${healCostOf(st)} HS)하면 바로 복귀하고, 편성에서 요양을 고르면 무료로 회복이 ${CONFIG.actions.recover.extra}시즌 빨라집니다.\n침상보다 부상자가 많으면 넘치는 사람은 회복이 1시즌 늦어집니다. 의술 ${CONFIG.ludus.medicine.injuryAt}단계부터 부상 1시즌, ${CONFIG.ludus.medicine.cheapAt}단계부터 치료 250 HS. 약재는 단계마다 경기 후 피로를 20% 확률로 면제합니다.`))];
    if (!injured.length) out.push(item('idle', '부상자 없음'));
    for (const g of injured) out.push(h('div', { class: 'drow' }, h('span', { class: 'sq small', style: `background:${TYPE_COLOR[g.type]}` }, glyphSvg(g.type, 14)), ' ', h('span', { class: 'nm' }, g.name), h('span', { class: 'meta' }, ` 부상 ${g.injured}시즌`), h('span', { style: 'flex:1' }),
      h('button', { class: 'tiny', disabled: st.money < healCostOf(st), onclick: () => { heal(st, g); render(); } }, `치료 ${healCostOf(st)}`)));
    if (injured.length > st.ludus.beds) out.push(item('warn', `침상 ${st.ludus.beds}개보다 부상자가 많아 ${injured.length - st.ludus.beds}명은 회복이 1시즌 늦어집니다.`));
    out.push(h('div', { class: 'dlist' }, ...facRows('medic')));
    return out;
  }
  if (view === 'yard') { // 훈련소: 검투사 상태와 팔루스·훈련 시설. 행동 선택은 편성 단계
    const docs = st.roster.filter(g => g.status === 'doctor');
    const out: Node[] = [h('h3', {}, '훈련소', h('span', { class: 'hint', style: 'margin-left:8px;text-transform:none' }, `검투사 ${st.roster.length}명 · 출전 가능 ${available(st).length} · 팔루스 ${st.ludus.palus}`))];
    if (!st.roster.length) out.push(item('warn', '검투사가 없습니다. 시장에서 사들이세요.'));
    for (const g of st.roster) out.push(h('div', { class: 'drow' }, h('span', { class: 'sq small', style: `background:${TYPE_COLOR[g.type]}` }, glyphSvg(g.type, 14)), ' ', h('span', { class: 'nm' }, g.name), h('span', { class: 'meta' }, ` ${TYPE_KO[g.type]} · ${g.rank === 'tiro' ? '티로' : '베테'} · ${g.wins}승/${g.fights}전${g.status === 'doctor' ? ' · 독토르' : g.status === 'rudiarius' ? ' · 자유민' : ''}${g.injured ? ` · 부상 ${g.injured}` : ''}${(g.fatigue ?? 0) > 0 ? ` · 피로 ${g.fatigue}` : ''}`)));
    if (docs.length) out.push(item('idle', `독토르 ${docs.map(g => `${g.name}(${TYPE_KO[g.type]})`).join(', ')} — 같은 유형 훈련 +1~2.`));
    out.push(item('idle', `훈련 정원 ${trainCap(st) >= 99 ? '∞' : trainCap(st)}명 · 훈련 폭 +${1 + gymBonus(st)}`, helpBtn('훈련', `출전하지 않는 검투사는 편성 단계에서 휴식·훈련(공/방)·시범 중 하나를, 부상자는 요양을 고릅니다. 훈련은 1인당 ${CONFIG.trainCost.toLocaleString()} HS, 시즌당 팔루스 수만큼만. 같은 유형 독토르가 있으면 격차에 따라 +1~2.`)));
    out.push(h('div', { class: 'dlist' }, ...facRows('yard')));
    return out;
  }
  // 정문(루두스 문 앞): 계약·지원자·상대 등 결정할 일 목록
  const out: Node[] = [h('h3', {}, '정문', h('span', { class: 'hint', style: 'margin-left:8px;text-transform:none' }, `${seasonName(st.season)} · ${st.money.toLocaleString()} HS`))];
  const injured = st.roster.filter(g => g.injured); const avail = available(st);
  const upkeep = upkeepOf(st);
  if (!st.roster.length) out.push(item('warn', '검투사가 없습니다. 시장에서 검투사를 사들이세요.'));
  { const p = mortality(st.lanista.age + 1); const docs = st.roster.filter(g => g.status === 'doctor').length;
    if (st.lanista.age >= 46) out.push(item(p >= 0.045 ? 'warn' : 'idle', `${st.lanista.name} ${st.lanista.age}세 — 해마다 ${Math.round(p * 100)}%의 확률로 세상을 떠날 수 있습니다. 후계 후보: 독토르 ${docs}명${docs ? '' : ' (없으면 부하 해방노예가 잇습니다)'}. 헤더의 '은퇴'로 미리 물려줄 수 있습니다.`)); }
  if (st.applicants.length) out.push(item('todo', `루두스 문 앞에 자유민 지원자 ${st.applicants.length}명: ${st.applicants.map(g => `${g.name}(${TYPE_KO[g.type]}·${g.rank === 'tiro' ? '티로' : '베테'}, 계약금 ${g.buyPrice.toLocaleString()})`).join(', ')} — 아래 '문 앞의 지원자'에서 계약.`));
  { const expiring = st.roster.filter(g => g.status === 'rudiarius' && g.contractUntil != null && g.contractUntil - st.season <= 1); if (expiring.length) out.push(item('warn', `계약 만료 임박: ${expiring.map(g => `${g.name} (${Math.max(0, g.contractUntil! - st.season + 1)}시즌)`).join(', ')} — 재계약(계약금의 절반)하지 않으면 떠납니다.`)); }
  { const free = st.roster.filter(g => g.status === 'rudiarius'); const docs = st.roster.filter(g => g.status === 'doctor');
    if (free.length) out.push(item('todo', `자유민(루디아리우스) ${free.length}명: ${free.map(g => g.name).join(', ')} — 급료(대여료의 ${Math.round(CONFIG.rudiariusShare * 100)}%)를 받고 계속 출전하거나, 독토르로 고용(${CONFIG.doctorSalary} HS/시즌, 같은 유형 훈련 강화).`));
    if (docs.length) out.push(item('idle', `독토르 ${docs.length}명: ${docs.map(g => `${g.name}(${TYPE_KO[g.type]} 공 ${g.base.atk}·방 ${g.base.def}${g.wins >= CONFIG.doctorSkillWins ? ' · 기술 전수' : ''})`).join(', ')} — 능력치가 앞서는 만큼 같은 유형 훈련 +1~2.`)); }
  if (injured.length) out.push(item('warn', `부상 검투사 ${injured.length}명: ${injured.map(g => g.name).join(', ')} — 치료(${healCostOf(st)} HS)하면 이번 시즌 출전 가능.`));
  // 계약·상대 이야기는 편성 화면에 있으므로 정문에서는 다루지 않는다 (편성에서 관리로 되돌아올 수 있음)
  if (st.roster.length >= rosterCap(st)) out.push(item('idle', `켈라 ${st.roster.length}/${rosterCap(st)} 가득 참 (증축 ${upgradeCost(st, 'cells')?.toLocaleString() ?? '최대'} HS)`));
  if (st.money < upkeep) out.push(item('warn', `자금이 시즌 유지비 ${upkeep.toLocaleString()} HS 보다 적습니다`));
  else out.push(item('idle', `시즌 유지비 ${upkeep.toLocaleString()} HS`));
  if (st.market.length) out.push(item('idle', `시장 매물 ${st.market.length}명 (${Math.min(...st.market.map(m => m.buyPrice)).toLocaleString()} HS 부터)`));
  return out;
}

// ── 타운: 훈련장(0~1076) + 길(1076~1420) + 시장(1420~1940)을 한 장면으로. 카메라가 라니스타를 따라 옆으로 이동
const GY = 258; // 마을 공통 땅선. 디스플레이(300) 바닥 가까이에 두어 인물이 땅 위에 서 있는 느낌
const MEDIC = { W: 420, H: 230 }; // 의무실: 훈련장 왼쪽의 독립 건물 (침상 최대 4, 의사 탁자, 약재 선반)
const TOWN = { gapW: 60, roadW: 344, wallW: 130, tailW: 290, get yardX() { return MEDIC.W + this.gapW; }, get marketX() { return this.yardX + YARD.W + this.roadW; }, get wallX() { return this.marketX + MARKET.W; }, get W() { return this.wallX + this.wallW + this.tailW; }, H: 300 }; // 시장 → 성벽(문) → 성문 밖 묘지
const lanista = { x: 0, target: 0, walking: false, v: 0, vmax: 340 }; // 실제 위치는 캔버스를 만들 때 restX(view) 로 잡는다
let camX = 0, camV = 0, camPan = 0; // camPan: 좁은 화면에서 손가락으로 끌어 본 만큼의 오프셋 (이동하면 0)
let VW = 1076; // 보이는 폭 (월드 단위). 화면 폭에 따라 fit() 이 정한다
const restX = (v: View) => v === 'grave' ? TOWN.W - 70 : v === 'market' ? TOWN.marketX + 14 : v === 'medic' ? 250 : v === 'yard' ? TOWN.yardX + 268 : TOWN.yardX + YARD.W - 65;   // 라니스타가 서는 자리 (의무실 앞 · 대련장과 팔루스 사이 · 정문 앞 · 시장 앞)
const clampCam = (x: number) => Math.max(0, Math.min(TOWN.W - VW, x));
// 카메라 기준 위치: 시장은 건물이 화면 가운데 조금 오른쪽. 루두스는 폭이 충분하면 훈련장 전체, 좁으면 라니스타 주변(화면 60% 지점)
const camFor = (v: View) => v === 'grave' ? clampCam(TOWN.W - VW) : v === 'market' ? clampCam(TOWN.marketX + MARKET.W / 2 - VW * (VW < MARKET.W + 80 ? 0.5 : 0.58)) : v === 'medic' ? clampCam(MEDIC.W / 2 - VW * 0.5) : v === 'yard' ? clampCam(TOWN.yardX + 8) : clampCam(TOWN.yardX + YARD.W - 130); // 정문: 문루 왼쪽 끝부터 바깥 길까지 // 훈련소 = 연습장, 정문 = 문루를 가운데에 두고 바깥 길(지원자)까지
let townCanvas: HTMLCanvasElement | null = null; // 한 번 만들고 유지 (화면 재구성 때 끊기지 않게)
function renderTown() {
  if (townCanvas) return h('div', { class: 'panel yardwrap' }, townCanvas, locTabs(), cellBtn());
  const c = h('canvas', { class: 'yard' }) as HTMLCanvasElement; townCanvas = c;
  const VH = TOWN.H; let zoom = 1, lastCw = 0; c.style.height = VH + 'px';
  const ctx = c.getContext('2d')!; ctx.scale(devicePixelRatio, devicePixelRatio);
  // 화면 폭에 맞춘다: 좁은 화면은 줌 0.8 까지만 줄이고 보이는 폭(VW)을 좁혀 라니스타 주변만 보여 준다 (찌그러짐 없음)
  const fit = () => {
    const cw = c.clientWidth; if (!cw || cw === lastCw) return; lastCw = cw;
    zoom = Math.max(0.92, Math.min(1, cw / 1076)); VW = cw / zoom;
    c.width = Math.round(cw * devicePixelRatio); c.height = Math.round(VH * zoom * devicePixelRatio); c.style.height = VH * zoom + 'px';
    ctx.setTransform(devicePixelRatio * zoom, 0, 0, devicePixelRatio * zoom, 0, 0);
    if (!lanista.walking) { camPan = 0; camX = camFor(view); camV = 0; }
  };
  if (!lanista.walking) { lanista.x = restX(view); lanista.target = lanista.x; camX = camFor(view); }
  let last = performance.now();
  const draw = () => {
    if (!c.isConnected) { requestAnimationFrame(draw); return; } // 잠시 떨어져 있어도 루프 유지
    fit();
    const now = performance.now(); const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000;
    // 라니스타 이동
    if (lanista.walking) { // 걸음: 출발부터 끝까지 점점 빨라지며 도착 (감속 없음)
      const d = lanista.target - lanista.x; const dist = Math.abs(d);
      const ACC = lanista.vmax * 0.45;
      lanista.v = Math.min(lanista.vmax, lanista.v + ACC * dt);
      const step = lanista.v * dt;
      if (dist <= Math.max(step, 1.5)) { lanista.x = lanista.target; lanista.walking = false; lanista.v = 0; travel = null; render(); requestAnimationFrame(draw); return; }
      lanista.x += Math.sign(d) * step;
    }
    // 카메라: 걷는 동안 라니스타를 따라가고(화면 40% 지점), 정지하면 장면 위치로
    // 카메라: 스프링 추종 (속도를 가져 출발·정지가 매끄럽다). 걷는 동안 진행 방향 앞쪽을 조금 더 보여줌
    // 카메라 목표: 출발 화면 위치 → 도착 화면 위치를 걸음 진행률로 잇는다 (도착 순간 목표가 튀지 않음)
    let camTarget = camFor(view) + camPan;
    { const k = 30, c2 = 2 * Math.sqrt(k); const a = (camTarget - camX) * k - camV * c2; camV += a * dt; camX += camV * dt; }
    ctx.clearRect(0, 0, VW, VH);
    ctx.save(); ctx.translate(-camX, 0);
    // ── 배경 층 (마을 전체에 이어짐)
    ctx.fillStyle = '#e6d6ad'; ctx.fillRect(0, 0, TOWN.W, VH); // 하늘
    // 거리 집 정면 (길 구간 + 시장 뒤까지): 지붕·창·문
    for (let x = TOWN.yardX + YARD.W - 40; x < TOWN.W; x += 118) {
      if (x + 104 > TOWN.marketX - 10) break; // 시장 광장 뒤는 회랑, 그 너머는 성벽과 성문 밖
      const hh = 70 + ((x / 118) % 3) * 14; const y0 = GY - 14 - hh;
      ctx.fillStyle = '#c9b283'; ctx.fillRect(x, y0, 104, hh);
      ctx.fillStyle = '#9b4a2c'; ctx.fillRect(x - 6, y0 - 12, 116, 14); // 기와 지붕
      ctx.fillStyle = '#7a6743'; ctx.fillRect(x + 14, y0 + 18, 16, 16); ctx.fillRect(x + 72, y0 + 18, 16, 16); // 창
      ctx.fillStyle = '#3a2412'; ctx.fillRect(x + 44, y0 + hh - 34, 18, 34); // 문
    }
    // 땅: 아래 띠만 (모래 → 포장길 → 광장, 서서히). 훈련장 구간은 마당 전체를 모래로
    { const g = ctx.createLinearGradient(0, 0, TOWN.W, 0); g.addColorStop(0, '#dccb9c'); g.addColorStop((TOWN.yardX + YARD.W) / TOWN.W, '#dccb9c'); g.addColorStop((TOWN.yardX + YARD.W + 120) / TOWN.W, '#cbb67f'); g.addColorStop((TOWN.marketX - 40) / TOWN.W, '#cbb67f'); g.addColorStop(TOWN.marketX / TOWN.W, '#d6c59a'); g.addColorStop(1, '#d6c59a');
      ctx.fillStyle = g; ctx.fillRect(0, GY - 14, TOWN.W, VH - GY + 14);
      ctx.fillStyle = '#dccb9c'; ctx.fillRect(TOWN.yardX, GY - 210, YARD.W, VH); /* 훈련장 모래 (지붕선 아래부터) */
      ctx.fillStyle = '#cbb67f'; ctx.fillRect(0, GY - 14, TOWN.yardX, VH); /* 의무실 앞·사이 통로 */ }
    // 포장길 돌 무늬 (길 구간)
    ctx.strokeStyle = '#b9a26f'; ctx.lineWidth = 1; for (let x = TOWN.yardX + YARD.W + 10; x < TOWN.marketX + 20; x += 34) { for (let yy = GY - 4; yy < VH; yy += 16) { ctx.beginPath(); ctx.moveTo(x + ((yy / 16) % 2) * 17, yy); ctx.lineTo(x + ((yy / 16) % 2) * 17 + 28, yy); ctx.stroke(); } }
    // ── 구조물 층
    // 거리 행인: 길을 오간다 (주기적으로 왕복)
    { const span = TOWN.roadW + MARKET.W - 80; const p1 = TOWN.yardX + YARD.W + 40 + ((t * 38) % span), p2 = TOWN.wallX - 40 - ((t * 30 + 300) % span); // 행인은 성문 안쪽(길·시장)만 오간다
      drawCivilian(ctx, p1, GY, 0.9, 'walk', t, 11, 1); drawCivilian(ctx, p2, GY, 0.9, 'walk', t, 5, -1); }
    // 루두스 문 밖의 자유민 지원자: 문루 앞 길에 서서 기다린다
    ctx.save(); ctx.translate(TOWN.yardX, GY - 210); drawYardScene(ctx, t); ctx.restore();          // 훈련장 (발 = 210 → GY)
    ctx.save(); ctx.translate(0, GY - 210); drawMedicScene(ctx, t); ctx.restore();                 // 의무실 (독립 건물)
    st.applicants.forEach((g, i) => { const x = TOWN.yardX + YARD.W + 24 + i * 30; drawStickman(ctx, g.type, { x, y: GY, scale: 0.9, skeleton: NPC_POSES.watch, t: t + i, ink: INK, bare: true, garment: 'tunic', garmentColor: '#b9c2a8', facing: -1 }); }); // 문 밖 길에 서서 기다리는 자유민 지원자
    ctx.save(); ctx.translate(TOWN.marketX, GY - 30 - (MARKET.H - 68)); drawMarketScene(ctx, t); ctx.restore();
    ctx.save(); ctx.translate(TOWN.wallX, GY); drawCityWall(ctx); ctx.restore();                  // 성벽과 성문 (시장과 묘지 사이)
    ctx.save(); ctx.translate(TOWN.W - TOWN.tailW, GY); drawGraveScene(ctx, t); ctx.restore(); // 묘지 (성문 밖 길가 묘역, 발 = GY) // 시장 (판매대 윗면 = GY-30, 앞면·가격표가 디스플레이 안에 들어오도록)
    // 라니스타: 토가 입은 인물 (걷기 또는 서서 구경)
    { const facing: 1 | -1 = lanista.walking ? (lanista.target > lanista.x ? 1 : -1) : (view === 'ludus' || view === 'market' ? 1 : -1); // 묘지에서는 오른쪽 끝에 서서 왼쪽 묘비들을 본다 // 시장에서는 판매대 왼쪽 앞에 서서 오른쪽(매물)을 본다
      drawLanista(ctx, lanista.x, GY, facing, t * Math.max(0.4, lanista.walking ? lanista.v / 300 : 1), lanista.walking);
    }
    ctx.restore();
    // 켈라 화면: 아래에서 위로 올라와 마을을 덮는다
    { const target = cellsOpen ? 1 : 0; const k = 1 - Math.exp(-dt * 9); cellsP += (target - cellsP) * k; if (Math.abs(target - cellsP) < 0.004) cellsP = target;
      if (cellsP > 0.001) { ctx.save(); ctx.translate(0, VH * (1 - cellsP)); drawCellsScene(ctx, t); ctx.restore(); } }
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
  // 스와이프: 왼쪽으로 밀면 다음 장소, 오른쪽으로 밀면 이전 장소 (의무실 → 훈련소 → 정문 → 시장). 스와이프했으면 클릭으로 치지 않는다
  const ORDER: View[] = ['medic', 'yard', 'ludus', 'market', 'grave'];
  let drag: { x0: number; t0: number } | null = null; let dragged = false;
  c.onpointerdown = (ev) => { drag = { x0: ev.clientX, t0: performance.now() }; };
  c.onpointerup = (ev) => { if (!drag) return; if (cellsOpen) { drag = null; return; } const dx = ev.clientX - drag.x0, el = performance.now() - drag.t0; drag = null; dragged = Math.abs(dx) > 40 && el < 700;
    if (dragged) { const i = ORDER.indexOf(view); const to = ORDER[Math.max(0, Math.min(ORDER.length - 1, i + (dx < 0 ? 1 : -1)))]; if (to !== view) startTravel(to); } };
  c.onpointercancel = () => { drag = null; };
  c.onclick = (ev) => { // 켈라 화면이면 방 클릭, 아니면 시장 매물 클릭 (카메라 보정)
    if (dragged) { dragged = false; return; }
    const r = c.getBoundingClientRect();
    if (cellsP > 0.9) { const lx = (ev.clientX - r.left) * (VW / r.width), ly = (ev.clientY - r.top) * (TOWN.H / r.height); const k = cellRects(st.ludus.cells.length).findIndex(q => lx >= q.x && lx <= q.x + q.w && ly >= q.y && ly <= q.y + q.h); if (k >= 0) { const q = cellRects(st.ludus.cells.length)[k]; cellSel = k; cellPop = { cx: r.left + (q.x + q.w / 2) * (r.width / VW), cy: r.top + (q.y + q.h / 2) * (r.height / TOWN.H), fresh: true }; render(); } return; }
    if (view === 'grave') { document.querySelector('.dashbody')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; } // 묘비를 누르면 아래 연대기로
    if (view === 'yard') { // 네메시스 사당을 누르면 설명과 이번 시즌 봉헌 여부
      const lx = (ev.clientX - r.left) * (VW / r.width) + camX - TOWN.yardX, ly = (ev.clientY - r.top) * (TOWN.H / r.height) - (GY - 210);
      if (Math.abs(lx - YARD.W / 2) <= 30 && ly >= 30 && ly <= 86) void tell(`복수와 운명의 여신 네메시스의 감실입니다. 검투사들은 경기 전에 여기서 기도하고 봉헌했습니다(원형경기장 곁의 네메세움 비문 근거).\n이번 시즌 봉헌: ${st.events?.votum ? '함 (미시오 +3%)' : '안 함'}. 편성 화면의 시즌 행사에서 ${CONFIG.events.votum.cost} HS 로 봉헌하면 그 시즌 미시오 확률이 +${Math.round(CONFIG.events.votum.missio * 100)}% 오릅니다.`, '네메시스 사당');
      return; }
    if (view !== 'market') return; const x = (ev.clientX - r.left) * (VW / r.width) + camX - TOWN.marketX;
    const items = st.market; let best: Gladiator | null = null, bd = items.length > 1 ? (marketSlotX(items.length, 1) - marketSlotX(items.length, 0)) / 2 : 80;
    items.forEach((g, i) => { const d = Math.abs(x - marketSlotX(items.length, i)); if (d < bd) { bd = d; best = g; } });
    marketSel = best ? (best as Gladiator).id : null; render();
  };
  return h('div', { class: 'panel yardwrap' }, c, locTabs(), cellBtn());
}
// 디스플레이 상단의 장소 표지판: 누르면 그 장소로 화면이 옮겨가고 라니스타가 따라온다
function locTabs(): Node {
  return h('div', { class: `loctabs${cellsOpen ? ' hidden' : ''}` }, ...(['medic', 'yard', 'ludus', 'market', 'grave'] as View[]).map(v => h('button', { class: view === v ? 'on' : '', onclick: () => startTravel(v) }, VIEW_KO[v])));
}
// 라니스타: 크림색 토가(자주색 띠·주름), 짧은 머리·수염, 서판을 든 손. 발이 (x,y)
function drawLanista(ctx: CanvasRenderingContext2D, x: number, y: number, facing: 1 | -1, t: number, walking: boolean) {
  // 기본 리그 + 토가(자주색 클라부스) + 서판. 걸을 때도 앞손은 서판을 든 채
  const sk: Skeleton = walking ? { ...walkSkeleton(t * 9, 0.8), frontArm: [55, 50] } : NPC_POSES.tablet;
  drawStickman(ctx, 'murmillo', { x, y, scale: 1.0, facing, skeleton: sk, t, ink: INK, bare: true, garment: 'toga', garmentColor: '#f3ead0', beard: true, /* 클라부스 없음: 라니스타는 인파미스 신분 (고증) */
    hands: (c, f) => { c.fillStyle = '#d9c69a'; c.fillRect(f.hx - 2, f.hy - 12, 9, 12); c.strokeStyle = INK; c.lineWidth = 1; c.strokeRect(f.hx - 2, f.hy - 12, 9, 12); c.beginPath(); c.moveTo(f.hx, f.hy - 8); c.lineTo(f.hx + 5, f.hy - 8); c.moveTo(f.hx, f.hy - 4); c.lineTo(f.hx + 5, f.hy - 4); c.stroke(); } });
}
// 장소 이동: 화면(카메라·대시보드)이 먼저 새 장소로 옮겨가고, 라니스타는 화면 밖 가장자리에서 걸어 들어와 제자리에 선다
function startTravel(to: View) {
  if (to === view && !lanista.walking) return;
  camPan = 0; sheet = null; marketSel = null;
  const from = view; view = to; camV = 0;
  travel = { to, from, fromX: lanista.x, start: performance.now() };
  lanista.target = restX(to);
  // 지금 화면에 보이면 순간이동 없이 끝까지 걷는다 (먼 길은 걸음을 빠르게 해 2초 안팎). 이미 화면 밖이면 새 장소 가장자리에서 등장
  const onScreen = lanista.x >= camX - 10 && lanista.x <= camX + VW + 10;
  const cam = camFor(to);
  if (!onScreen) lanista.x = lanista.x < lanista.target ? cam - 30 : cam + VW + 30;
  lanista.vmax = Math.max(340, Math.abs(lanista.target - lanista.x) / 2.2);
  lanista.walking = true; lanista.v = Math.max(lanista.v, 90);
  render();
}


// ── 검투사 시장: 판매대(카타스타) 위에 사슬로 묶인 매물이 한 줄로 서 있다. 클릭하면 앞으로 나와 강조, 아래에 상세·구매
// 시민(구경꾼·행인): 짧은 튜닉 스틱맨. pose: watch(팔짱) / point(손가락질) / child(아이) / tiptoe(까치발) / walk
function drawCivilian(ctx: CanvasRenderingContext2D, x: number, y: number, sc: number, pose: 'watch' | 'point' | 'child' | 'tiptoe' | 'walk', t: number, seed: number, facing: 1 | -1 = 1) {
  // 기본 리그 + 튜닉. 자세만 다르다
  const tint = ['#c9b283', '#b9c2a8', '#c8a878', '#a8b6c2'][seed % 4];
  let sk: Skeleton; let scale = sc;
  if (pose === 'watch') sk = NPC_POSES.watch;
  else if (pose === 'point') { const a = Math.sin(t * 2 + seed) * 4; sk = { ...NPC_POSES.point, frontArm: [120 + a, 15] }; }
  else if (pose === 'tiptoe') sk = { ...NPC_POSES.tiptoe, lift: Math.abs(Math.sin(t * 3 + seed)) * 4 };
  else if (pose === 'walk') sk = walkSkeleton(t * 8 + seed);
  else { sk = NPC_POSES.stand; scale *= 0.62; }
  drawStickman(ctx, 'murmillo', { x, y, scale, facing, skeleton: sk, t: t + seed, ink: INK, bare: true, garment: 'tunic', garmentColor: tint });
}
const MARKET = { W: 400, H: 250 }; // 폰 화면 폭에 맞춰 좁힘. 매물 최대 4명이 한 줄
const marketSlotX = (n: number, i: number) => { const W = MARKET.W; const gap = Math.min(120, (W - 120) / Math.max(1, n - 1)); const startX = W / 2 - gap * (n - 1) / 2 + 10; return n === 1 ? W / 2 + 10 : startX + i * gap; };
const marketTagW = (n: number) => n > 1 ? Math.min(86, marketSlotX(n, 1) - marketSlotX(n, 0) - 8) : 86; // 가격표 폭
// 시장 장면을 (0,0) 기준으로 그린다
function drawMarketScene(ctx: CanvasRenderingContext2D, t: number) {
  const W = MARKET.W, H = MARKET.H;
  const items = st.market;
  const slotX = (i: number) => marketSlotX(items.length, i);
  const ink = INK;
    ctx.clearRect(0, 0, W, H);
    // 야외 노예 시장(포룸 광장): 뒤에 열주 회랑, 판매대 위에만 장대 차양. 벽 없음
    // 회랑: 땅(판매대 뒤)에서 선 기둥 + 뒤 그늘진 벽 + 엔타블러처·지붕
    ctx.fillStyle = '#c9b283'; ctx.fillRect(-10, 40, W + 20, H - 108);            // 회랑 안쪽 벽(그늘)
    ctx.fillStyle = '#b39c6a'; ctx.fillRect(-10, H - 74, W + 20, 8);              // 기단
    for (let x = 12; x <= W - 12; x += 62) { ctx.fillStyle = '#d9c69a'; ctx.fillRect(x - 6, 46, 12, H - 120); ctx.fillStyle = '#b39c6a'; ctx.fillRect(x - 9, 40, 18, 6); ctx.fillRect(x - 9, H - 78, 18, 5); } // 열주
    ctx.fillStyle = '#b39c6a'; ctx.fillRect(-10, 28, W + 20, 12); ctx.fillStyle = '#9b4a2c'; ctx.fillRect(-14, 18, W + 28, 10); // 엔타블러처·지붕
    for (const px of [44, W - 44]) { ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(px, H - 60); ctx.lineTo(px, 84); ctx.stroke(); } // 차양 장대
    ctx.fillStyle = '#9b2c1c'; ctx.beginPath(); ctx.moveTo(30, 84); ctx.lineTo(W - 30, 84); ctx.lineTo(W - 40, 100); ctx.lineTo(40, 100); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#e8c96a'; ctx.lineWidth = 2; ctx.beginPath(); for (let x = 42; x < W - 38; x += 12) { ctx.moveTo(x, 100); ctx.lineTo(x, 106); } ctx.stroke();
    ctx.strokeStyle = '#7a5a2c'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(44, 84); ctx.lineTo(60, 70); ctx.moveTo(W - 44, 84); ctx.lineTo(W - 60, 70); ctx.stroke(); // 장대 당김줄
    ctx.fillStyle = '#e8d9b5'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('VENALICIUM', W / 2, 96);
    // 판매대 (카타스타): 윗면 띠 + 앞면
    ctx.fillStyle = '#c4ad76'; ctx.fillRect(30, H - 68, W - 60, 8); ctx.fillStyle = '#a89064'; ctx.fillRect(30, H - 60, W - 60, 20); ctx.fillStyle = '#8f7a4e'; ctx.fillRect(30, H - 40, W - 60, 40);
    // 상인 (오른쪽 끝, 라니스타가 왼쪽에 서므로): 줄무늬 튜닉에 두루마리를 든 스틱맨 (기본 리그)
    drawStickman(ctx, 'murmillo', { x: W - 26, y: H - 68, scale: 0.95, facing: -1, skeleton: NPC_POSES.tablet, t, ink, bare: true, garment: 'tunic', garmentColor: '#c8a878', garmentStripe: '#7a1f16',
      hands: (c, f) => { c.fillStyle = '#e8d9b5'; c.fillRect(f.hx - 2, f.hy - 12, 9, 13); c.strokeStyle = ink; c.lineWidth = 1; c.strokeRect(f.hx - 2, f.hy - 12, 9, 13); } });
    if (!items.length) return; // 매물 없음: 빈 카타스타만 (안내는 대시보드에)
    // 사슬: 목 고리 사이를 늘어진 곡선(카테너리 느낌)으로, 작은 고리들이 곡선을 따라 이어짐. 살짝 흔들림
    const neckOf = (g: Gladiator, i: number) => { const sel = g.id === marketSel; const sc0 = sel ? 1.18 : 1.05; return { x: slotX(i) - 1 * sc0, y: H - 68 + (sel ? 8 : 0) - 44 * sc0 }; };
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    for (let i = 0; i < items.length; i++) {
      const a = neckOf(items[i], i);
      ctx.beginPath(); ctx.arc(a.x, a.y, 4.5, 0, Math.PI * 2); ctx.stroke(); // 목 쇠고리
      if (i === 0) continue;
      const b = neckOf(items[i - 1], i - 1);
      const dx = a.x - b.x; const sag = Math.abs(dx) * 0.28 + Math.sin(t * 1.3 + i) * 3;
      const cx = (a.x + b.x) / 2, cy = Math.max(a.y, b.y) + sag;
      // 곡선을 따라 고리 그리기
      const n = Math.max(6, Math.floor(Math.abs(dx) / 9));
      for (let k = 0; k <= n; k++) {
        const u = k / n; const x = (1 - u) * (1 - u) * b.x + 2 * (1 - u) * u * cx + u * u * a.x, y = (1 - u) * (1 - u) * b.y + 2 * (1 - u) * u * cy + u * u * a.y;
        const nu = Math.min(1, u + 0.01); const x2 = (1 - nu) * (1 - nu) * b.x + 2 * (1 - nu) * nu * cx + nu * nu * a.x, y2 = (1 - nu) * (1 - nu) * b.y + 2 * (1 - nu) * nu * cy + nu * nu * a.y;
        const ang = Math.atan2(y2 - y, x2 - x);
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang + (k % 2 ? Math.PI / 2 : 0)); ctx.beginPath(); ctx.ellipse(0, 0, 4.2, 2.2, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
    }
    // 상인 쪽 끝: 첫 매물 고리에서 상인 손으로 늘어진 줄
    if (items.length) { const a = neckOf(items[0], 0); const hx = 42, hy = H - 68 - 36; const sag = Math.abs(a.x - hx) * 0.3; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + hx) / 2, Math.max(a.y, hy) + sag, hx, hy); ctx.stroke(); }
    // 매물
    items.forEach((g, i) => {
      const sel = g.id === marketSel, dim = marketSel != null && !sel;
      const x = slotX(i), y = H - 68 + (sel ? 8 : 0);
      ctx.globalAlpha = dim ? 0.45 : 1;
      const team = g.rank === 'veteranus' ? '#2c4f9b' : '#6e7f9b';
      const sc0 = sel ? 1.18 : 1.05;
      drawStickman(ctx, g.type, { x, y, scale: sc0, pose: sel ? 'captive_up' : 'captive', t: t + i, team, facing: 1, bare: true }); // 시장: 맨몸 + 손목 묶임 (고증)
      // 손목 밧줄: 두 손이 모인 자리(몸 앞 아래)에 고리 + 아래로 늘어진 줄
      { const wx = x + 9 * sc0, wy = y - 27 * sc0; ctx.strokeStyle = '#7a5a2c'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.ellipse(wx, wy, 5 * sc0, 3.2 * sc0, 0, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(wx, wy + 3 * sc0); ctx.lineTo(wx - 2, wy + 12 * sc0); ctx.stroke(); }
      ctx.strokeStyle = '#e8d9b5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 8, y - 1); ctx.lineTo(x + 8, y - 1); ctx.stroke(); // 발의 백묵 (수입 노예 표시)
      // 가격표(티툴루스): 판매대 앞면. 작게 — 유형 아이콘 + 가격, 아래 이름 (능력치는 대시보드에)
      const pw = marketTagW(items.length), px = x - pw / 2, py = H - 52;
      ctx.globalAlpha = dim ? 0.55 : 1; ctx.fillStyle = '#efe5c9'; ctx.fillRect(px, py, pw, 34); ctx.strokeStyle = sel ? '#2c4f9b' : ink; ctx.lineWidth = sel ? 2 : 1.2; ctx.strokeRect(px, py, pw, 34);
      ctx.fillStyle = TYPE_COLOR[g.type]; ctx.fillRect(px + 3, py + 3, 18, 18); drawGlyph(ctx, g.type, px + 12, py + 12, 14);
      ctx.textAlign = 'left'; ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = '#9b2c1c'; ctx.fillText(`${g.buyPrice.toLocaleString()}`, px + 25, py + 13);
      ctx.font = '9px sans-serif'; ctx.fillStyle = ink; ctx.fillText(g.name.length > 7 ? g.name.slice(0, 7) + '…' : g.name, px + 25, py + 24);
      ctx.font = '8px sans-serif'; ctx.fillStyle = '#5a4a2e'; ctx.fillText(`${g.rank === 'tiro' ? '티로' : '베테'}${g.origin && g.origin !== 'slave' ? ' ' + ORIGIN_SHORT[g.origin] : ''}`, px + 3, py + 31);
      ctx.textAlign = 'center';
      if (sel) { ctx.strokeStyle = '#2c4f9b'; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.strokeRect(x - 34, y - 90, 68, 92); ctx.setLineDash([]); }
      ctx.globalAlpha = 1;
    });
  // 구경꾼: 판매대 앞 광장(가격표보다 앞에 그려 가리지 않음) + 판매대 옆
  // 가격표(폭 pw, 중심 slotX)가 차지한 구간을 빼고 남는 틈마다 세운다. 좁은 틈은 어른 1명, 넓으면 아이도
  const crowd: { x: number; y: number; sc: number; pose: 'watch' | 'point' | 'child' | 'tiptoe'; f: 1 | -1 }[] = [];
  { const n = items.length; const pw = marketTagW(n);
    const blocks = n ? items.map((_, k) => [slotX(k) - pw / 2 - 6, slotX(k) + pw / 2 + 6] as [number, number]) : [];
    const gaps: [number, number][] = []; let cur = 24;
    for (const [a, b] of blocks) { if (a - cur >= 14) gaps.push([cur, a]); cur = Math.max(cur, b); }
    if (W - 24 - cur >= 14) gaps.push([cur, W - 24]);
    const poses: ('watch' | 'point' | 'tiptoe')[] = ['watch', 'point', 'tiptoe', 'watch'];
    gaps.forEach((g, k) => { const gw = g[1] - g[0]; const cx = (g[0] + g[1]) / 2; const f: 1 | -1 = cx < W / 2 ? 1 : -1;
      if (gw >= 60) { crowd.push({ x: cx - 12, y: H + 8, sc: 0.92, pose: poses[k % poses.length], f }); crowd.push({ x: cx + 14, y: H + 10, sc: 0.92, pose: 'child', f }); }
      else if (gw >= 22) crowd.push({ x: cx, y: H + 8, sc: 0.9, pose: poses[k % poses.length], f });
      else crowd.push({ x: cx, y: H + 10, sc: 0.92, pose: 'child', f }); }); // 좁은 틈엔 아이만
    crowd.push({ x: W - 40, y: H - 62, sc: 0.85, pose: 'tiptoe', f: -1 }); // 판매대 옆 까치발
  }
  crowd.forEach((c, i) => drawCivilian(ctx, c.x, c.y, c.sc, c.pose, t, i * 7 + 1, c.f));
}

const YARD = { W: 600, H: 230 }; // 안뜰 0~470 + 문루 470~600(폭 130). 정문 화면은 문루부터 시작해 훈련소가 보이지 않는다 // 훈련소(대련장·무기고·팔루스·급식소)가 폰 한 화면(≈400)에 들어오고, 정문 화면은 문루+바깥 길 // 좁은 화면에 맞춰 훈련장을 좁히고 정문(문루)을 넓혔다
// 채찍 물리 상태 (프레임 간 유지)
const WN = 18, WSEG = 4.2;
// 의사(메디쿠스): 환자가 있으면 선반(집)과 침상 사이를 오가며 치료. 좌표는 훈련장 기준
const medic = { x: 330, mode: 'home' as 'home' | 'go' | 'tend' | 'back', act: 'grind' as 'grind' | 'shelf' | 'tend' | 'lean' | 'cup', until: 0, target: 330, bed: 0, last: -1, seed: 1 };
const whipState = { p: [] as { x: number; y: number; px: number; py: number }[], last: -1, crackT: -9, crackX: 0 };
type StickPose = 'stand' | 'point' | 'stir' | 'tend' | 'whip' | 'walk' | 'grind' | 'shelf' | 'lean' | 'cup';
let stickFn: ((x: number, y: number, sc: number, pose: StickPose, t: number, seed: number, facing?: 1 | -1) => void) | null = null; // 훈련장이 매 프레임 넘겨 주는 보조 인물 그리기
// 의무실 장면 (0,0) 기준, 발 = H-20. 침상은 시설 수(최대 4)만큼, 부상자가 그 위에 눕고 넘치면 벽가에 앉는다. 의사는 탁자와 침상을 오간다
function drawMedicScene(ctx: CanvasRenderingContext2D, t: number) {
  const W = MEDIC.W, H = MEDIC.H; const stick = stickFn; if (!stick) return;
  const injured = st.roster.filter(g => g.injured);
  // 건물: 기와 지붕선, 회벽, 붉은 띠(하단 장식), 바닥 돌
  ctx.fillStyle = '#cbb67f'; ctx.fillRect(0, 30, W, H - 50);
  ctx.fillStyle = '#9b4a2c'; ctx.fillRect(-8, 22, W + 16, 10);
  ctx.fillStyle = '#b39c6a'; ctx.fillRect(0, 32, W, 6);
  ctx.fillStyle = '#9b2c1c'; ctx.globalAlpha = 0.55; ctx.fillRect(0, 84, W, 10); ctx.globalAlpha = 1;
  ctx.fillStyle = '#a58f60'; ctx.fillRect(-14, 30, 14, H - 50); ctx.fillRect(W, 30, 14, H - 50); // 양쪽 벽
  ctx.fillStyle = '#b8a67a'; ctx.fillRect(0, H - 20, W, 60); ctx.strokeStyle = '#a58f60'; ctx.lineWidth = 1; for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, H - 20); ctx.lineTo(x, H + 40); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W, H); ctx.moveTo(0, H + 20); ctx.lineTo(W, H + 20); ctx.stroke(); // 돌바닥 (디스플레이 바닥까지)
  // 창 (빛)
  for (const wx of [70, 210]) { ctx.fillStyle = '#e6d6ad'; ctx.fillRect(wx, 46, 30, 26); ctx.strokeStyle = '#8f7a4e'; ctx.lineWidth = 2; ctx.strokeRect(wx, 46, 30, 26); ctx.beginPath(); ctx.moveTo(wx + 15, 46); ctx.lineTo(wx + 15, 72); ctx.stroke(); }
  // 침상 (시설 수만큼, 최대 4): 폭 74, 다리
  const beds = Math.max(1, Math.min(4, st.ludus.beds)); const bedX = Array.from({ length: beds }, (_, i) => 16 + i * 80);
  ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 3; ctx.beginPath();
  for (const bx of bedX) { ctx.moveTo(bx, H - 40); ctx.lineTo(bx + 74, H - 40); ctx.moveTo(bx + 4, H - 40); ctx.lineTo(bx + 4, H - 24); ctx.moveTo(bx + 70, H - 40); ctx.lineTo(bx + 70, H - 24); }
  ctx.stroke();
  ctx.fillStyle = '#e8d9b5'; for (const bx of bedX) ctx.fillRect(bx + 2, H - 45, 70, 5); // 매트리스
  // 의사 탁자(약절구) + 선반(약병) + 약재 다발 (약재 단계만큼 천장에 매달림)
  const TX = 350;
  ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(TX - 6, H - 46); ctx.lineTo(TX + 38, H - 46); ctx.moveTo(TX - 2, H - 46); ctx.lineTo(TX - 2, H - 24); ctx.moveTo(TX + 34, H - 46); ctx.lineTo(TX + 34, H - 24); ctx.stroke();
  ctx.fillStyle = '#8f7a4e'; ctx.beginPath(); ctx.moveTo(TX + 6, H - 46); ctx.lineTo(TX + 26, H - 46); ctx.lineTo(TX + 23, H - 55); ctx.lineTo(TX + 9, H - 55); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#8a6a44'; ctx.fillRect(TX - 10, 118, 58, 3); for (let k = 0; k < 2 + Math.min(3, st.ludus.medicine); k++) { ctx.fillStyle = ['#b9a26f', '#9b2c1c', '#b9a26f', '#5a4224', '#3b7a2c'][k % 5]; ctx.fillRect(TX - 6 + k * 11, 108, 7, 10); }
  for (let k = 0; k < st.ludus.herbs; k++) { const hx = 300 - k * 22; ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx, 38); ctx.lineTo(hx, 52); ctx.stroke(); ctx.fillStyle = '#5f7a3c'; ctx.beginPath(); ctx.moveTo(hx, 50); ctx.lineTo(hx - 6, 68); ctx.lineTo(hx + 6, 68); ctx.closePath(); ctx.fill(); }
  if (st.ludus.medicine >= 3) stick(W - 18, H - 22, 0.85, 'tend', t, 9, -1); // 의술 3단계: 조수
  { // 의사: 탁자 앞에서 약을 빻거나 선반에서 약병을 꺼내고, 환자가 있으면 붕대 뭉치를 들고 침상으로 가 붕대·살피기·물 먹이기 중 하나를 한 뒤 돌아온다
    const dt = medic.last < 0 ? 0 : Math.min(0.05, t - medic.last); medic.last = t;
    const HOME = TX - 20; const bedSide = (k: number) => bedX[k % bedX.length] + 62;
    const patients = Math.min(injured.length, bedX.length);
    const rnd = () => { medic.seed = (medic.seed * 1103515245 + 12345) & 0x7fffffff; return medic.seed / 0x7fffffff; };
    const homeActs = ['grind', 'shelf'] as const, bedActs = ['tend', 'lean', 'cup'] as const;
    if (medic.mode === 'home' && t >= medic.until) { if (patients) { medic.mode = 'go'; medic.bed = Math.floor(rnd() * patients); medic.target = bedSide(medic.bed); } else { medic.act = homeActs[Math.floor(rnd() * homeActs.length)]; medic.until = t + 2.5 + rnd() * 2; } }
    if (medic.mode === 'tend' && t >= medic.until) { if (rnd() < 0.4) { medic.act = bedActs[Math.floor(rnd() * bedActs.length)]; medic.until = t + 2 + rnd() * 1.5; } else { medic.mode = 'back'; medic.target = HOME; } }
    if (medic.mode === 'go' || medic.mode === 'back') {
      const d = medic.target - medic.x; const step = 70 * dt;
      if (Math.abs(d) <= step) { medic.x = medic.target; if (medic.mode === 'go') { medic.mode = 'tend'; medic.act = bedActs[Math.floor(rnd() * bedActs.length)]; medic.until = t + 2.5 + rnd() * 1.5; } else { medic.mode = 'home'; medic.act = homeActs[Math.floor(rnd() * homeActs.length)]; medic.until = t + 2 + rnd() * 2; } }
      else medic.x += Math.sign(d) * step;
    }
    if (!patients && medic.mode !== 'home' && medic.mode !== 'back') { medic.mode = 'back'; medic.target = HOME; } // 환자가 사라지면 복귀
    const walking = medic.mode === 'go' || medic.mode === 'back';
    const facing: 1 | -1 = walking ? (medic.target < medic.x ? -1 : 1) : medic.mode === 'tend' ? -1 : 1; // 탁자·선반은 오른쪽
    const pose: StickPose = walking ? 'walk' : medic.mode === 'tend' ? medic.act : (medic.act === 'shelf' ? 'shelf' : 'grind');
    stick(medic.x, H - 22, 0.95, pose, t, 3, facing);
  }
  // 부상자: 침상에 눕고(머리 왼쪽), 침상이 모자라면 오른쪽 벽가에 앉는다
  injured.forEach((g, i) => { const team = g.rank === 'veteranus' ? '#2c4f9b' : '#6e7f9b';
    if (i < bedX.length) { const bx = bedX[i]; ctx.save(); ctx.beginPath(); ctx.rect(bx - 4, 0, 92, H); ctx.clip();
      drawStickman(ctx, g.type, { x: bx + 78, y: H - 38, scale: 0.9, pose: 'down_back', t: t + i, team, bare: true, facing: 1 }); ctx.restore(); }
    else drawStickman(ctx, g.type, { x: TX + 60 + (i - bedX.length) * 22, y: H - 20, scale: 0.9, pose: 'sit', t: t + i, team, bare: true, facing: -1 });
  });
}
// 성벽: 도시 경계. 높은 벽·총안·아치 성문(열림). 발 = 0
function drawCityWall(ctx: CanvasRenderingContext2D) {
  const W = TOWN.wallW, H = 200;
  ctx.fillStyle = '#a58f60'; ctx.fillRect(0, -H, W, H + 14); // 땅선 아래까지 내려 뒤쪽 인물의 발이 비치지 않게
  ctx.fillStyle = '#8f7a4e'; for (let y = -H + 20; y < 0; y += 22) { ctx.fillRect(0, y, W, 2); } for (let y = -H + 20, k = 0; y < 0; y += 22, k++) { for (let x = (k % 2) * 20; x < W; x += 40) ctx.fillRect(x, y, 2, 22); } // 석재 줄눈
  ctx.fillStyle = '#a58f60'; for (let x = 4; x < W; x += 24) ctx.fillRect(x, -H - 14, 14, 14); // 총안(흉벽)
  ctx.fillStyle = '#3a2412'; ctx.beginPath(); ctx.moveTo(W / 2 - 28, 0); ctx.lineTo(W / 2 - 28, -84); ctx.arc(W / 2, -84, 28, Math.PI, 0); ctx.lineTo(W / 2 + 28, 0); ctx.closePath(); ctx.fill(); // 성문 아치 (열림)
  ctx.fillStyle = '#b39c6a'; ctx.fillRect(W / 2 - 34, -118, 68, 6); // 아치 위 인방
}
// 묘지: 성문 밖 길가 묘역 (폼페이 누케리아 문 밖처럼). 묘비(스텔라)는 죽은 검투사 수만큼(최대 8), 사이프러스 두 그루, 담. 누르면 연대기
function drawGraveScene(ctx: CanvasRenderingContext2D, t: number) {
  const W = TOWN.tailW; const dead = st.graveyard;
  ctx.fillStyle = '#b39c6a'; ctx.fillRect(0, -96, W, 8); ctx.fillStyle = '#c9b283'; ctx.fillRect(0, -88, W, 74); // 담 (낮은 벽)
  ctx.strokeStyle = '#b39c6a'; ctx.lineWidth = 1; for (let x = 0; x < W; x += 36) { ctx.beginPath(); ctx.moveTo(x, -88); ctx.lineTo(x, -14); ctx.stroke(); }
  for (const cx of [26, W - 30]) { // 사이프러스
    ctx.fillStyle = '#3f4a2c'; ctx.beginPath(); ctx.moveTo(cx, -150); ctx.quadraticCurveTo(cx + 13, -90, cx + 9, -16); ctx.lineTo(cx - 9, -16); ctx.quadraticCurveTo(cx - 13, -90, cx, -150); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4a3418'; ctx.fillRect(cx - 2, -16, 4, 16);
  }
  const n = Math.min(7, dead.length); const gap = Math.min(40, (W - 120) / Math.max(1, n));
  for (let i = 0; i < n; i++) { const g = dead[i]; const x = 58 + i * gap, sway = Math.sin(t * 0.8 + i) * 0.4;
    ctx.fillStyle = '#d9c69a'; ctx.beginPath(); ctx.moveTo(x - 13, 0); ctx.lineTo(x - 13, -52); ctx.arc(x, -52, 13, Math.PI, 0); ctx.lineTo(x + 13, 0); ctx.closePath(); ctx.fill(); // 묘비
    ctx.strokeStyle = '#8f7a4e'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#5a3a1c'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(g.name.slice(0, 5), x, -28); ctx.font = '6px sans-serif'; ctx.fillText(`${g.wins}승 ${g.fights}전`, x, -18); { const ep = (g.epithets ?? [])[0]; const nm = ep ? EPITHET_BY_ID[ep as EpithetId]?.name : ''; if (nm) { ctx.font = '5px sans-serif'; ctx.fillText(nm.slice(0, 7), x, -10); } } // 비문에 별칭도 새긴다 // 비문: 이름과 전적 (폼페이 묘비처럼)
    ctx.fillStyle = '#5f7a3c'; ctx.beginPath(); ctx.ellipse(x + sway, -2, 7, 2.5, 0, 0, Math.PI * 2); ctx.fill(); // 화환 자리의 풀
  }
  if (!n) { ctx.fillStyle = '#d9c69a'; ctx.beginPath(); ctx.moveTo(W / 2 - 12, 0); ctx.lineTo(W / 2 - 12, -40); ctx.arc(W / 2, -40, 12, Math.PI, 0); ctx.lineTo(W / 2 + 12, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#8f7a4e'; ctx.lineWidth = 1.5; ctx.stroke(); } // 빈 묘역: 루두스 공동 묘비 하나
}
// 훈련장 장면을 (0,0) 기준으로 그린다. 타운 캔버스가 카메라 오프셋을 적용해 호출
function drawYardScene(ctx: CanvasRenderingContext2D, t: number) {
  const W = YARD.W, H = YARD.H;
  const roster = st.roster;
  const ink = INK;
  // ── 채찍 물리 (베를레 사슬): 손잡이 쪽 고리가 끝으로 달려가며 빨라지고 팁이 땅을 친다.
  // 손(0번 점)만 궤적을 따라 움직이고 나머지 마디는 관성·중력·길이 제약으로 따라온다. 좌표는 인물 기준(발=0,0, 앞=+x)
  const whipHand = (ph: number): { x: number; y: number } => { // 3.0초 주기 손 궤적
    const seg = (a: number, b: number, k: number) => a + (b - a) * k;
    if (ph < 0.7) return { x: 14, y: -34 };                                                                   // 쉼
    if (ph < 1.6) { const k = (ph - 0.7) / 0.9; const e = Math.sin(k * Math.PI / 2); return { x: seg(14, -18, e), y: seg(-34, -68, e) }; } // 천천히 머리 뒤로 들어올림
    if (ph < 1.72) { const k = (ph - 1.6) / 0.12; const e = 1 - (1 - k) * (1 - k); return { x: seg(-18, 30, e), y: seg(-68, -40, e) }; } // 짧고 세게 앞으로
    if (ph < 1.95) { const k = (ph - 1.72) / 0.23; return { x: 30 - k * 8, y: -40 + k * 8 }; }              // 멈춤 (고리가 끝으로)
    return { x: 20, y: -34 };
  };

  const whipStep = (t: number, hand: { x: number; y: number }) => {
    const ph = t % 3.0;
    if (!whipState.p.length || whipState.last < 0 || t - whipState.last > 0.5) { // 초기화: 앞 바닥에 늘어짐
      whipState.p = Array.from({ length: WN }, (_, i) => ({ x: hand.x + i * WSEG * 0.9, y: Math.min(0, hand.y + i * 6), px: 0, py: 0 }));
      for (const q of whipState.p) { q.px = q.x; q.py = q.y; }
      whipState.last = t;
    }
    let dt = Math.min(0.05, t - whipState.last); whipState.last = t;
    const steps = 4; const h2 = dt / steps;
    for (let sIdx = 0; sIdx < steps; sIdx++) {
      const P = whipState.p;
      P[0].x = hand.x; P[0].y = hand.y; // 손
      for (let i = 1; i < WN; i++) { // 베를레 적분: 관성 + 중력 + 감쇠
        const q = P[i]; const vx = (q.x - q.px) * 0.988, vy = (q.y - q.py) * 0.988;
        q.px = q.x; q.py = q.y; q.x += vx; q.y += vy + 520 * h2 * h2;
        if (q.y > 0) { q.y = 0; q.px = q.x - vx * 0.4; } // 땅: 마찰
      }
      for (let it = 0; it < 6; it++) for (let i = 1; i < WN; i++) { // 길이 제약 (손잡이 쪽이 무겁게: 앞 마디 우선)
        const a = P[i - 1], b = P[i]; const dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 1e-6; const diff = (d - WSEG) / d;
        const wa = i === 1 ? 0 : 0.35, wb = i === 1 ? 1 : 0.65;
        a.x += dx * diff * wa; a.y += dy * diff * wa; b.x -= dx * diff * wb; b.y -= dy * diff * wb;
      }
    }
    // 스냅 감지: 팁 속도가 크고 땅 근처면 "딱!"
    const tip = whipState.p[WN - 1]; const sp = Math.hypot(tip.x - tip.px, tip.y - tip.py) / Math.max(h2, 1e-3);
    if (ph > 1.65 && ph < 2.2 && sp > 600 && tip.y > -10 && t - whipState.crackT > 1.5) { whipState.crackT = t; whipState.crackX = tip.x; if (document.visibilityState === 'visible' && view === 'ludus' && !travel) sfx.whip(); }
    return hand;
  };
  const drawWhip = (t: number, facing: number, sc: number) => {
    const P = whipState.p; if (!P.length) return;
    ctx.save(); ctx.scale(facing, 1);
    ctx.strokeStyle = '#5a3a1c'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(P[0].x - 3, P[0].y + 10); ctx.lineTo(P[0].x, P[0].y); ctx.stroke(); // 손잡이
    ctx.strokeStyle = '#3a2412';
    for (let i = 1; i < WN; i++) { const k = i / WN; ctx.lineWidth = 3.2 * (1 - k) + 0.5; ctx.beginPath(); ctx.moveTo(P[i - 1].x, P[i - 1].y); ctx.lineTo(P[i].x, P[i].y); ctx.stroke(); }
    const since = t - whipState.crackT;
    if (since >= 0 && since < 0.35) { const q = since / 0.35; ctx.strokeStyle = '#bfa877'; ctx.lineWidth = 1.5; ctx.globalAlpha = 1 - q;
      for (let i = 0; i < 4; i++) { const a = Math.PI + (i / 3) * Math.PI; const rr = 4 + q * 18; ctx.beginPath(); ctx.arc(whipState.crackX + Math.cos(a) * rr, -2 + Math.sin(a) * rr * 0.5, 2.5 + q * 2, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = 1; ctx.restore(); ctx.save(); ctx.fillStyle = '#9b2c1c'; ctx.font = `bold ${11 / sc}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('딱!', whipState.crackX * facing, -18 - q * 8); }
    ctx.restore();
  };
  const stick = (x: number, y: number, sc: number, pose: 'stand' | 'point' | 'stir' | 'tend' | 'whip' | 'walk' | 'grind' | 'shelf' | 'lean' | 'cup', t: number, seed: number, facing: 1 | -1 = 1) => { // 보조 인물(교관·요리사·의사·로라리우스): 기본 리그 + 역할 튜닉 + 소품
    const tunic = pose === 'point' ? '#efe5c9' : pose === 'stir' ? '#a8784a' : pose === 'tend' || pose === 'walk' || pose === 'grind' || pose === 'shelf' || pose === 'lean' || pose === 'cup' ? '#f3ead0' : pose === 'whip' ? '#5a4224' : '#c9b283';
    let sk: Skeleton = NPC_POSES.stand; let hands: DrawOpts['hands'];
    if (pose === 'point') { const a = Math.sin(t * 3 + seed) * 5; sk = { ...NPC_POSES.point, frontArm: [115 + a, 15], backArm: [-42, -25] };
      hands = (c, f) => { const d = f.ang * Math.PI / 180; c.strokeStyle = ink; c.lineWidth = 4; c.beginPath(); c.moveTo(f.hx - Math.sin(d) * 3, f.hy - Math.cos(d) * 3); c.lineTo(f.hx + Math.sin(d) * 11, f.hy + Math.cos(d) * 11); c.stroke(); }; } // 지휘봉(루디스)
    else if (pose === 'stir') { const a = Math.sin(t * 2 + seed) * 6; sk = { ...NPC_POSES.stir, frontArm: [-75 + a, -30] };
      hands = (c, f) => { c.strokeStyle = ink; c.lineWidth = 3; c.beginPath(); c.moveTo(f.hx, f.hy); c.lineTo(f.hx - 13, f.hy + 9); c.stroke(); c.beginPath(); c.arc(f.hx - 15, f.hy + 10, 3, 0, Math.PI * 2); c.stroke(); }; } // 국자
    else if (pose === 'tend') { const a = Math.sin(t * 4 + seed) * 6; sk = { ...NPC_POSES.tend, frontArm: [70 + a, 35], backArm: [55 - a, 45] };
      hands = (c, f) => { c.strokeStyle = '#e8d9b5'; c.lineWidth = 3; c.beginPath(); c.moveTo(f.hx, f.hy); c.lineTo(f.hx + 8, f.hy + 2); c.stroke(); }; } // 붕대
    else if (pose === 'walk') { sk = { ...walkSkeleton(t * 8 + seed, 0.5), frontArm: [50, 45] };
      hands = (c, f) => { c.fillStyle = '#e8d9b5'; c.beginPath(); c.arc(f.hx + 2, f.hy + 1, 3.2, 0, Math.PI * 2); c.fill(); c.strokeStyle = ink; c.lineWidth = 1; c.stroke(); }; } // 붕대 뭉치를 들고 걷는다
    else if (pose === 'grind') { const a = Math.sin(t * 7 + seed) * 6; sk = { ...NPC_POSES.tend, lean: 12, frontArm: [78 + a, 30], backArm: [-38, -25] };
      hands = (c, f) => { c.strokeStyle = ink; c.lineWidth = 2.6; c.beginPath(); c.moveTo(f.hx, f.hy); c.lineTo(f.hx + 3, f.hy + 9); c.stroke(); }; } // 약절구 공이
    else if (pose === 'shelf') { const a = Math.sin(t * 2 + seed) * 4; sk = { ...NPC_POSES.stand, lean: -4, frontArm: [150 + a, 12], backArm: [-40, -25], headBob: -2 };
      hands = (c, f) => { c.fillStyle = '#b9a26f'; c.fillRect(f.hx - 3, f.hy - 6, 6, 7); c.strokeStyle = ink; c.lineWidth = 1; c.strokeRect(f.hx - 3, f.hy - 6, 6, 7); }; } // 선반의 약병
    else if (pose === 'lean') { const a = Math.sin(t * 3 + seed) * 3; sk = { lean: 30 + a, frontArm: [70, 40], backArm: [60, 50], frontLeg: [14, -6], backLeg: [-12, 6], headBob: 4 }; } // 환자 위로 몸을 숙여 살핌
    else if (pose === 'cup') { const a = Math.sin(t * 2.5 + seed) * 3; sk = { ...NPC_POSES.tend, lean: 18, frontArm: [88 + a, 18], backArm: [-35, -25] };
      hands = (c, f) => { c.fillStyle = '#c8a878'; c.beginPath(); c.moveTo(f.hx - 3, f.hy - 4); c.lineTo(f.hx + 3, f.hy - 4); c.lineTo(f.hx + 2, f.hy + 2); c.lineTo(f.hx - 2, f.hy + 2); c.closePath(); c.fill(); c.strokeStyle = ink; c.lineWidth = 1; c.stroke(); }; } // 물잔
    else if (pose === 'whip') { const hand = whipHand((t + seed) % 3.0); sk = { ...NPC_POSES.stand, lean: 6, reach: hand, backArm: [-45, -25] };
      hands = (c, f) => { whipStep(t + seed, { x: f.hx, y: f.hy }); drawWhip(t + seed, 1, sc); }; } // 채찍: 실제 손 위치에서 물리로 따라옴
    drawStickman(ctx, 'murmillo', { x, y, scale: sc, facing, skeleton: sk, t: t + seed, ink, bare: true, garment: 'tunic', garmentColor: tunic, garmentStripe: pose === 'point' ? '#9b2c1c' : undefined, apron: pose === 'stir', hands });
  };
    // (배경은 타운이 깐다) 2층 주랑 회랑: 위층 난간 + 아래층 아치 + 켈라 문
    ctx.fillStyle = '#b39c6a'; ctx.fillRect(0, 0, W, 78);
    ctx.fillStyle = '#a58f60'; ctx.fillRect(0, 0, W, 26);            // 2층 벽
    ctx.strokeStyle = '#8f7a4e'; ctx.lineWidth = 2; ctx.beginPath(); for (let x = 12; x < W; x += 24) { ctx.moveTo(x, 8); ctx.lineTo(x, 24); } ctx.stroke(); // 2층 난간
    ctx.fillStyle = '#8f7a4e'; ctx.fillRect(0, 26, W, 4);
    const cellCap = rosterCap(st); let cellK = 0;
    for (let x = 34; x < W; x += 68) {                                // 1층 아치 + 열주
      ctx.fillStyle = '#7a6743'; ctx.beginPath(); ctx.moveTo(x - 18, 78); ctx.lineTo(x - 18, 48); ctx.arc(x, 48, 18, Math.PI, 0); ctx.lineTo(x + 18, 78); ctx.closePath(); ctx.fill();
      const isCell = Math.abs(x - W / 2) > 40 && cellK < cellCap; if (isCell) cellK++; // 켈라은 상한 수만큼 열려 있고, 나머지는 막힌 벽
      if (isCell) { const q = st.ludus.cells[cellK - 1] ?? 0; ctx.fillStyle = q >= 2 ? '#5a3a1c' : '#3a2412'; ctx.fillRect(x - 7, 56, 14, 22); ctx.fillStyle = q >= 1 ? '#e8c96a' : '#5a4224'; ctx.fillRect(x - 5, 60, 10, 2); ctx.fillRect(x - 5, 64, 10, 2); if (q >= 3) { ctx.fillStyle = '#9b2c1c'; ctx.fillRect(x - 9, 52, 18, 3); } } // 켈라 문: 질 1 창에 불빛, 2 나무문, 3 붉은 차양
      else { ctx.fillStyle = '#8f7a4e'; ctx.fillRect(x - 10, 52, 20, 26); } // 막힌 아치 (증축 전)
      ctx.fillStyle = '#d9c69a'; ctx.fillRect(x + 26, 32, 8, 46);     // 기둥
    }
    ctx.fillStyle = '#8f7a4e'; ctx.fillRect(0, 78, W, 5);
    // 네메시스 사당 (회랑 가운데): 감실 + 상 + 화환
    { const sx = W / 2; ctx.fillStyle = '#9b2c1c'; ctx.fillRect(sx - 22, 40, 44, 38); ctx.fillStyle = '#e8d9b5'; ctx.fillRect(sx - 18, 44, 36, 34);
      ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, 76); ctx.lineTo(sx, 58); ctx.moveTo(sx - 7, 66); ctx.lineTo(sx + 7, 66); ctx.stroke(); ctx.beginPath(); ctx.arc(sx, 53, 4, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#3b7a2c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, 46, 16, 0.2, Math.PI - 0.2); ctx.stroke();
      if (st.events?.votum) { for (const dx of [-14, 14]) { ctx.fillStyle = '#e8d9b5'; ctx.fillRect(sx + dx - 2, 68, 4, 8); ctx.fillStyle = '#e8c96a'; ctx.beginPath(); ctx.ellipse(sx + dx, 65 + Math.sin(t * 9 + dx) * 0.6, 2, 3.5, 0, 0, Math.PI * 2); ctx.fill(); } } } // 봉헌: 촛불 둘
    // 왼쪽: 의무실로 통하는 문 (의무실은 담 너머 독립 건물)
    ctx.fillStyle = '#3a2412'; ctx.beginPath(); ctx.moveTo(14, H - 26); ctx.lineTo(14, 120); ctx.arc(28, 120, 14, Math.PI, 0); ctx.lineTo(42, H - 26); ctx.closePath(); ctx.fill();
    stickFn = stick; // 의무실 장면이 같은 보조 인물 리그를 쓴다
    // 작은 타원 연습장 + 관람석: 루두스 마그누스의 미니 원형경기장
    ctx.strokeStyle = '#c4ad76'; ctx.lineWidth = 2; ctx.beginPath(); ctx.beginPath(); ctx.ellipse(150, 140, 90, 26, 0, 0, Math.PI * 2); ctx.fillStyle = '#e4d3a4'; ctx.fill(); ctx.stroke();
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 7) { const px = 150 + Math.cos(a) * 90, py = 140 + Math.sin(a) * 26; ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - 9); ctx.stroke(); } // 낮은 말뚝 울타리 // 원형 대련장: 왼쪽 위(회랑 바로 아래)에 두어 앞쪽 땅은 통로로 비운다
    // (관람석은 뺐다: 폭을 아끼려고)
    // 교관(독토르): 관람석 앞에서 막대로 지시
    stick(56, 170, 0.68, 'point', t, 1); // 교관은 대련장 왼쪽 앞
    roster.filter(g => g.status === 'doctor').forEach((g, i) => { const x = 74 + i * 18; stick(x, 172, 0.68, 'point', t + i * 2, 11 + i); }); // 고용한 독토르(전직 검투사)는 교관 옆
    // 로라리우스(채찍 든 감독): 대련 조 뒤에서 채찍을 휘두름
    stick(246, 170, 0.68, 'whip', t, 5); // 로라리우스는 대련장 오른쪽 앞
    // 훈련 기둥(팔루스) 둘 + 목검 거치
    const healthyN = roster.filter(g => !g.injured).length; const sparN = Math.min(4, healthyN) - (Math.min(4, healthyN) % 2); // 대련은 짝이 맞는 만큼만 (최대 2조)
    const postN = Math.min(6, Math.max(st.ludus.palus, healthyN - sparN)); /* 팔루스 수 = 시설 */ const posts = Array.from({ length: postN }, (_, i) => 352 + i * (postN <= 2 ? 40 : postN === 3 ? 34 : postN === 4 ? 30 : 22)); // 팔루스는 연습장 밖(오른쪽), 홀로 훈련하는 인원만큼
    for (const px of posts) { ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(px, H - 22); ctx.lineTo(px, H - 118); ctx.stroke(); ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px - 5, H - 60); ctx.lineTo(px + 5, H - 64); ctx.moveTo(px - 5, H - 84); ctx.lineTo(px + 5, H - 88); ctx.stroke(); }
    // 무기고 거치대 (가운데 뒤): 방패·창·목검
    { ctx.save(); ctx.translate(0, -26); const ax = 50; ctx.strokeStyle = '#6b4a22'; /* 무기고: 왼쪽 뒤, 회랑 벽에 붙여 더 뒤로 */ ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ax, 92); ctx.lineTo(ax + 120, 92); ctx.moveTo(ax + 4, 92); ctx.lineTo(ax + 4, 128); ctx.moveTo(ax + 116, 92); ctx.lineTo(ax + 116, 128); ctx.stroke();
      ctx.strokeStyle = ink; ctx.lineWidth = 2.2; for (let i = 0; i < 3; i++) { const x = ax + 16 + i * 22; ctx.beginPath(); ctx.rect(x, 96, 12, 26); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, 104); ctx.lineTo(x + 12, 100); ctx.moveTo(x, 114); ctx.lineTo(x + 12, 110); ctx.stroke(); }
      for (let i = 0; i < 2; i++) { const x = ax + 88 + i * 12; ctx.beginPath(); ctx.moveTo(x, 130); ctx.lineTo(x, 88); ctx.moveTo(x - 3, 92); ctx.lineTo(x, 84); ctx.lineTo(x + 3, 92); ctx.stroke(); }
      ctx.restore(); }
    // 보리죽 솥 (오른쪽 뒤) + 요리사 + 김
    { const kx = 300; ctx.fillStyle = INK; /* 급식소: 대련장(~240) 오른쪽, 겹치지 않게 */ ctx.beginPath(); ctx.ellipse(kx, 124, 22, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(kx - 22, 112, 44, 12);
      ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(kx - 26, 130); ctx.lineTo(kx - 26, 96); ctx.lineTo(kx + 26, 96); ctx.lineTo(kx + 26, 130); ctx.stroke();
      ctx.strokeStyle = '#bfa877'; ctx.lineWidth = 2; ctx.globalAlpha = 0.7; for (let i = 0; i < 3; i++) { const yy = 104 - ((t * 14 + i * 9) % 26); ctx.beginPath(); ctx.moveTo(kx - 8 + i * 8, yy + 6); ctx.quadraticCurveTo(kx - 4 + i * 8, yy, kx - 8 + i * 8, yy - 6); ctx.stroke(); } ctx.globalAlpha = 1;
      stick(kx + 34, 140, 0.9, 'stir', t, 2); }
    // 검투사 배치: 부상자 → 침상, 짝이 맞는 앞 2~4명 → 연습장 대련, 나머지 → 오른쪽 팔루스에서 홀로 훈련
    const healthy = roster.filter(g => !g.injured);
    healthy.forEach((g, i) => {
      const team = g.rank === 'veteranus' ? '#2c4f9b' : '#6e7f9b';
      if (i < sparN) { // 대련: 연습장 타원 안에서 마주보고 한쪽은 공격, 한쪽은 막기(교대)
        const pair = Math.floor(i / 2), side = i % 2;
        const cx = 118 + pair * 66, gap = 20; const period = 2200; const ph = ((t * 1000) + pair * 700) % period; const attackerSide = ph < period / 2 ? 0 : 1; const el = ph % (period / 2);
        const isAtk = side === attackerSide; const clip = isAtk ? attackClipFor(g.type) : 'block';
        drawStickman(ctx, g.type, { x: cx + (side ? gap : -gap), y: 156, scale: 0.62, facing: side ? -1 : 1, skeleton: clipSkeleton(clip, Math.min(el, clipLength(clip))), t, team, accessories: accessoriesOf(g) });
        return;
      }
      // 나머지는 오른쪽 팔루스에서 홀로 각목(목검) 훈련: 공격 클립 반복, 사람마다 위상 다르게
      const k2 = i - sparN; const px = posts[k2 % posts.length]; const clip = attackClipFor(g.type); const len = clipLength(clip) + 700; const el = ((t * 1000) + k2 * 400) % len;
      drawStickman(ctx, g.type, { x: px - 44, y: H - 20, scale: 0.9, skeleton: clipSkeleton(clip, el), t, team, accessories: accessoriesOf(g) });
    });
    // 루두스 건물 마감: 회랑 지붕선, 왼쪽 담, 오른쪽 정문(문루)
    ctx.fillStyle = '#9b4a2c'; ctx.fillRect(-8, -6, W + 16, 8);                       // 기와 지붕선
    ctx.fillStyle = '#a58f60'; ctx.fillRect(-14, -6, 14, H - 40);                      // 왼쪽 담
    ctx.fillStyle = '#a58f60'; ctx.fillRect(W - 130, -22, 144, H + 2);                 // 문루 (폭 130) — 바닥은 땅선(H−20)에 닿는다
    ctx.fillStyle = '#8f7a4e'; ctx.fillRect(W - 130, 110, 144, 4); ctx.fillRect(W - 130, 160, 144, 4); // 석재 줄눈
    ctx.fillStyle = '#9b4a2c'; ctx.fillRect(W - 138, -30, 160, 10);                    // 문루 지붕
    ctx.strokeStyle = '#8f7a4e'; ctx.lineWidth = 2; ctx.beginPath(); for (let x = W - 124; x < W + 12; x += 12) { ctx.moveTo(x, -20); ctx.lineTo(x, -6); } ctx.stroke(); // 문루 난간
    for (const wx of [W - 110, W - 10]) { ctx.fillStyle = '#3a2412'; ctx.fillRect(wx - 5, 30, 10, 16); } // 작은 창
    ctx.fillStyle = '#3a2412'; ctx.beginPath(); ctx.moveTo(W - 92, H - 20); ctx.lineTo(W - 92, 84); ctx.arc(W - 65, 84, 27, Math.PI, 0); ctx.lineTo(W - 38, H - 20); ctx.closePath(); ctx.fill(); // 아치 문(열림), 바닥까지
    ctx.fillStyle = '#e8d9b5'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('LUDUS', W - 65, 40);
}

// 계약 카드용 경기장 아이콘: 등급별 크기·재질
function arenaIcon(tier: number) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 64 40'); svg.setAttribute('width', '64'); svg.setAttribute('height', '40'); svg.classList.add('arena-icon');
  const rings = tier === 1 ? 2 : tier === 2 ? 3 : 4; const wood = tier === 1;
  for (let i = rings; i >= 1; i--) { const e = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse'); e.setAttribute('cx', '32'); e.setAttribute('cy', '22'); e.setAttribute('rx', String(12 + i * (tier === 3 ? 5 : 4))); e.setAttribute('ry', String(6 + i * 3)); e.setAttribute('fill', i % 2 ? (wood ? '#c8a878' : '#c9b283') : (wood ? '#b8956a' : '#bfa877')); e.setAttribute('stroke', wood ? '#8a6a44' : '#a58f60'); svg.append(e); }
  const f = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse'); f.setAttribute('cx', '32'); f.setAttribute('cy', '22'); f.setAttribute('rx', '12'); f.setAttribute('ry', '6'); f.setAttribute('fill', '#d8c48f'); f.setAttribute('stroke', '#9c8656'); svg.append(f);
  const b = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); b.setAttribute('x', '28'); b.setAttribute('y', '12'); b.setAttribute('width', '8'); b.setAttribute('height', '4'); b.setAttribute('fill', '#9b2c1c'); svg.append(b);
  return svg;
}
function assignedTo(gid: number): number | null { for (const cid in assign) if (assign[cid].includes(gid)) return +cid; return null; }

function renderPlan() {
  const wrap = h('div', {}); // 계약 → 검투사 → 시즌 예상. 행사·규칙은 탭 바에서 시트로
  const teamOf = (c: Contract) => (assign[c.id] ?? []).map(id => st.roster.find(g => g.id === id)!).filter(Boolean);
  // 계약 카드 (배정 칸 3개)
  const cpanel = h('div', { class: 'panel' }, h('h2', {}, '계약 · 배치', hintSpan('계약을 고르고 아래 검투사를 눌러 배정')));
  for (const c of st.contracts) {
    const team = teamOf(c); const err = team.length ? validTeam(st, c, team) : `${c.size}명이 필요합니다`;
    const tired = team.filter(g => (g.fatigue ?? 0) > 0);
    const previewFull = c.enemyPreview.length === c.size; const classicNow = team.length === c.size && previewFull && classicMatchup(team.map(g => g.type), c.enemyPreview); // 상대가 전부 공개됐을 때만 확정
    const classicMaybe = team.length === c.size && !previewFull && c.enemyPreview.length > 0 && c.enemyPreview.every(t => team.some(g => classicMatchup([g.type], [t])));
    const syn = computeSynergies(team);
    if (planSel !== c.id) { // 선택되지 않은 계약은 한 줄 요약 (화면을 스크롤하지 않도록). 누르면 펼친다
      cpanel.append(h('div', { class: `card contract mini${err ? '' : ' ready'}`, onclick: () => { planSel = c.id; render(); } },
        h('div', { class: 'grow' }, h('div', {}, h('span', { class: 'tier' }, `등급 ${c.tier}`), ' ', c.venue, ' ', h('span', { class: 'size' }, `${c.size}대${c.size}`), ' · ', hostSpan(c)),
          h('div', { class: 'meta' }, `${rivalOf(st.rivals, c.rivalId)?.name ?? '떠돌이 검투사단'} · 상금 ${hostPrize(c).toLocaleString()}${c.bet ? ' ×2 내기' : ''} · 배정 ${team.length}/${c.size}`, err ? '' : h('span', { class: 'req ok', style: 'margin-left:6px' }, '준비 ✓')))));
      continue;
    }
    cpanel.append(h('div', { class: `card contract sel`, onclick: () => { planSel = c.id; render(); } }, arenaIcon(c.tier),
      h('div', { class: 'grow' },
        h('div', {}, h('span', { class: 'tier' }, `등급 ${c.tier}`), ' ', c.venue, ' ', h('span', { class: 'size' }, `${c.size}대${c.size}`), ' · ', hostSpan(c), h('span', { class: 'meta' }, ` · 상금 ${hostPrize(c).toLocaleString()}`), c.needVeterans ? h('span', { class: 'meta' }, `  · 베테라누스 ${c.needVeterans}명 필수`) : null),
        enemyLine(c),
        HOST[c.host].bet ? h('div', { class: 'betline' }, h('span', { class: 'meta' }, `스폰시오: 이기면 상금 ${(hostPrize(c) * 2).toLocaleString()}, 지면 −${hostPrize(c).toLocaleString()}`), h('button', { class: `tiny bet${c.bet ? ' on' : ''}`, title: '기량 시합에 거는 내기(스폰시오)는 로마법이 허용했다. 무승부는 무효', onclick: (ev: Event) => { ev.stopPropagation(); c.bet = !c.bet; render(); } }, c.bet ? '내기 받음 ✓' : '내기 받기')) : null,
        h('div', { class: 'slots' }, ...Array.from({ length: c.size }, (_, i) => { const g = team[i]; return h('span', { class: `slot${g ? ' filled' : ''}`, onclick: (ev: Event) => { ev.stopPropagation(); if (g) { assign[c.id] = assign[c.id].filter(x => x !== g.id); render(); } else { planSel = c.id; render(); } } }, ...(g ? [sq(g.type), ' ', g.name] : ['빈 자리'])); })),
        h('div', { class: 'meta fixedline' }, ...describeSynergies(syn).map(t => h('span', { class: 'syn' }, t)), classicNow ? h('span', { class: 'syn classic' }, '전통 짝 ✓') : classicMaybe ? h('span', { class: 'syn classic maybe' }, '전통 짝 예상') : null, describeSynergies(syn).length || classicNow || classicMaybe ? '' : '시너지 없음', team.length ? ` · 생존 ${team.map(g => `${g.name} ${Math.round(survivalChance(g, st.fame, c.host, syn, classicNow, CONFIG.missio.tierBonus[c.tier] ?? 0) * 100)}%`).join(', ')} · 대여료 ${Math.round(team.reduce((a, g) => a + rentFee(g, c.tier), 0) * HOST[c.host].rent).toLocaleString()} 경비 −${fightExpense(team, c.tier).toLocaleString()}` : '', tired.length ? h('span', { style: 'color:var(--red)' }, ` · 피로 ${tired.map(g => `${g.name} −${(g.fatigue ?? 0) * CONFIG.fatigue.statPenalty}`).join(', ')}`) : null),
        h('div', { class: err ? 'req' : 'req ok' }, err ?? '출전 준비 완료 ✓'))));
  }
  if (!st.contracts.length) cpanel.append(h('div', { class: 'hint' }, '이번 시즌 계약이 없습니다. 전원 훈련 또는 휴식.'));
  { const need = st.contracts.reduce((a, c) => a + c.size, 0), have = available(st).length;
    if (have < need) cpanel.append(h('div', { class: 'hint', style: 'margin-top:6px' }, `출전 가능 ${have}명으로는 계약 전부(${need}자리)를 채울 수 없습니다.` + (st.market.length ? ` 시장에 매물 ${st.market.length}명 (${Math.min(...st.market.map(m => m.buyPrice)).toLocaleString()} HS 부터) — ` : ' '), st.market.length ? h('a', { href: '#', onclick: (ev: Event) => { ev.preventDefault(); phase = 'manage'; render(); startTravel('market'); } }, '시장으로 가기 →') : null)); }

  // 시즌 예상 수지
  const readyQ = st.contracts.filter(c => { const t = teamOf(c); return t.length === c.size && !validTeam(st, c, t); });
  const rentSum = readyQ.reduce((a, c) => a + Math.round(teamOf(c).reduce((b, g) => b + rentFee(g, c.tier), 0) * HOST[c.host].rent), 0);
  const expSum = readyQ.reduce((a, c) => a + fightExpense(teamOf(c), c.tier), 0);
  const trainN = st.roster.filter(g => assignedTo(g.id) == null && (trainPlan[g.id] === 'atk' || trainPlan[g.id] === 'def' || trainPlan[g.id] === 'skill')).length;
  const trainRoom = trainCap(st) - trainedCount(st); // 훈련장 남은 자리
  const upkeep = upkeepOf(st);
  const ready = readyQ.length;
  const evCost = EVENT_KEYS.reduce((a, k) => a + (eventPlan[k] ? CONFIG.events[k].cost : 0), 0), evN = EVENT_KEYS.filter(k => eventPlan[k]).length;
  const proj = h('div', { class: 'hint', style: 'margin:8px 2px 0' }, `시즌 예상: 출전 ${ready}경기 · 대여료 +${rentSum.toLocaleString()} · 경비 −${expSum.toLocaleString()} · 훈련 ${trainN}/${trainCap(st) >= 99 ? '∞' : trainCap(st)}명 −${(trainN * CONFIG.trainCost).toLocaleString()} · 유지비 −${upkeep.toLocaleString()}${evCost ? ` · 행사 −${evCost.toLocaleString()}` : ''} → 순 ${(rentSum - expSum - trainN * CONFIG.trainCost - upkeep - evCost).toLocaleString()} HS`, helpBtn('시즌 예상', `대여료는 승패와 무관하게 출전마다 받고(고증), 출전 경비는 대여료의 ${Math.round(CONFIG.fightExpense.rentRate * 100)}% + 등급×${CONFIG.fightExpense.perTier}. 상금·사망 배상금은 예상에서 뺐습니다.\n받을 수 있는 계약을 비워 두면 거절로 쳐서 시즌당 호감도 ${CONFIG.fameDelta.refuse}. 인원이나 베테라누스가 모자라 못 받는 계약은 벌점이 없습니다.`));
  const go = () => {
    const healable = st.roster.filter(g => g.injured && st.money >= healCostOf(st)).length;
    const refusable = st.contracts.filter(c => !readyQ.includes(c) && canFulfill(st, c)).length;
    const warn = [!ready ? '이번 시즌 경기가 없습니다.' : '', refusable ? `받을 수 있는 계약 ${refusable}건을 거절합니다 (호감도 ${CONFIG.fameDelta.refuse}).` : '', healable ? `치료할 수 있는 부상자가 ${healable}명 있습니다.` : ''].filter(Boolean);
    if (!warn.length) { startSeason(); return; }
    void ask(warn.join('\n') + '\n그래도 진행합니까?', { ok: '진행' }).then(ok => { if (ok) startSeason(); });
  };
  const tab = (key: typeof sheet, label: string, badge = 0) => ({ label, badge, on: sheet === key, onclick: () => { sheet = sheet === key ? null : key; render(); } });
  const bar = tabbar([{ label: '← 관리', onclick: () => { sheet = null; phase = 'manage'; render(); } }, tab('events', '행사', evN), { label: ready ? `시즌 진행 (${ready}경기) →` : '시즌 진행 →', primary: true, onclick: go }]);
  // 검투사 목록: 배정/훈련
  const rpanel = h('div', { class: 'panel' }, h('h2', {}, '검투사 배정'));
  for (const g of st.roster) {
    const at = assignedTo(g.id); const c = at != null ? st.contracts.find(x => x.id === at) : null;
    const selC = planSel != null ? st.contracts.find(x => x.id === planSel) : null;
    const isDoc = g.status === 'doctor';
    const canAssign = !g.injured && !g.fought && !isDoc && at == null && selC != null && (assign[selC.id]?.length ?? 0) < selC.size;
    const tp = trainPlan[g.id] ?? 'rest';
    if (at != null || isDoc) { // 배정된 검투사·독토르는 한 줄로 접는다 (누르면 배정 해제). 화면을 스크롤하지 않도록
      rpanel.append(h('div', { class: `card mini${at != null ? ' sel' : ''}`, onclick: at != null ? () => { assign[at] = assign[at].filter(x => x !== g.id); render(); } : undefined },
        portrait(g, 34), h('div', { class: 'grow' }, sq(g.type), ' ', h('b', {}, g.name), at != null ? h('span', { class: 'syn', style: 'margin-left:6px' }, `→ ${c?.venue.slice(0, 6) ?? '계약'}`) : h('span', { class: 'badge doc', style: 'margin-left:6px' }, '독토르')),
        at != null ? h('span', { class: 'hint' }, '해제') : null));
      continue;
    }
    rpanel.append(gladCard(g, [
      isDoc ? h('span', { class: 'hint' }, `독토르 — ${TYPE_KO[g.type]} 훈련 (공 ${g.base.atk}·방 ${g.base.def} 기준)${g.wins >= CONFIG.doctorSkillWins ? ' · 기술 전수' : ''}`) : null,
      mentoredBy(st, g) ? h('span', { class: 'badge mentor', title: '독토르에게 유형 기술을 전수받음' }, '기술 전수') : null,
      !g.injured && !isDoc ? h('span', { class: `seg${at != null ? ' off' : ''}` },
        ...(['rest', 'atk', 'def', 'skill', 'show'] as const).map(k => {
          const isTrain = k === 'atk' || k === 'def' || k === 'skill';
          const trainFull = isTrain && !(tp === 'atk' || tp === 'def' || tp === 'skill') && trainN >= trainRoom;
          const str = k === 'skill' ? skillTrainable(st, g) : null;
          const dis = at != null || (isTrain && (st.money < CONFIG.trainCost || trainFull)) || (k === 'skill' && !str);
          const title = at != null ? '출전 검투사는 다른 행동을 할 수 없습니다' : trainFull ? `훈련장 수용 인원 ${trainCap(st)}명이 찼습니다` : k === 'skill' ? (str ? `기술 훈련 (${CONFIG.trainCost} HS): ${str.from === 'doctor' ? '같은 유형 독토르에게' : '훈련 시설에서 독학으로'} ${str.pool.map(SKILL_NAME).join('·')} 중 하나를 ${Math.round((str.from === 'doctor' ? CONFIG.skills.trainChance : CONFIG.skills.gymChance) * 100)}% 확률로 깨친다` : `같은 유형 독토르가 아는 기술이 없고 훈련 시설도 ${CONFIG.skills.gymLevel}단계 미만입니다`) : k === 'show' ? `훈련장을 열어 시민 앞에서 연습: 명예 +${CONFIG.actions.show.honor}` : k === 'rest' ? `피로 −${cellQuality(st, g) >= 1 ? 2 : 1}` : '';
          const label = k === 'skill' ? ACTION_KO[k] : isTrain ? `${ACTION_KO[k]} +${trainGain(st, g, k as 'atk' | 'def')}` : k === 'show' ? `${ACTION_KO[k]} 명예 +${CONFIG.actions.show.honor}` : ACTION_KO[k];
          return h('button', { class: tp === k ? 'on' : '', disabled: dis, title, onclick: (ev: Event) => { ev.stopPropagation(); trainPlan[g.id] = k; render(); } }, label); })) : null,
      g.injured && !isDoc ? h('span', { class: 'seg' },
        h('button', { class: tp === 'recover' ? 'on' : '', title: `요양: 이번 시즌 부상 회복 +${CONFIG.actions.recover.extra} (무료)`, onclick: (ev: Event) => { ev.stopPropagation(); trainPlan[g.id] = tp === 'recover' ? 'rest' : 'recover'; render(); } }, `요양 (부상 ${g.injured}→${Math.max(0, g.injured - 1 - CONFIG.actions.recover.extra)}시즌)`),
        h('button', { disabled: st.money < healCostOf(st), onclick: (ev: Event) => { ev.stopPropagation(); heal(st, g); render(); } }, `치료 ${healCostOf(st)}`)) : null,
      ...skillOfferRows(g),
    ], { sel: at != null, dis: !!g.injured || isDoc, tag: at != null ? h('span', { class: 'syn', style: 'margin-left:6px' }, `→ ${c?.venue.slice(0, 6) ?? '계약'}`) : null, onclick: () => { if (at != null) { assign[at] = assign[at].filter(x => x !== g.id); render(); } else if (canAssign && selC) { (assign[selC.id] ??= []).push(g.id); render(); } } }));
  }
  { const c = coach(); if (c) wrap.prepend(c); }
  wrap.append(cpanel, rpanel, proj, bar);
  return wrap;
}
function eventsPanel(): Node {
  const E = CONFIG.events; const evCost = EVENT_KEYS.reduce((a, k) => a + (eventPlan[k] ? E[k].cost : 0), 0);
    const ev = (k: keyof SeasonEvents, effect: string) => h('label', { class: `evrow${eventPlan[k] ? ' on' : ''}` }, h('input', { type: 'checkbox', checked: eventPlan[k] ? 'checked' : undefined, onchange: (e: Event) => { eventPlan[k] = (e.target as HTMLInputElement).checked; render(); } }), h('span', { class: 'grow' }, h('b', {}, EVENT_KO[k]), ' ', h('span', { class: 'meta' }, effect)), h('span', {}, `${E[k].cost.toLocaleString()} HS`));
    return h('div', { class: 'panel' }, h('h2', {}, '시즌 행사', helpBtn('시즌 행사', '전투 밖에서 명예·호감도를 올리는 행사입니다. 시즌 진행을 누를 때 결제되고, 그 시즌에만 효과가 있습니다. 케나 리베라(공개 만찬)·폼파(행렬)·네메시스 봉헌·에딕타(벽화 광고)·귀족 초대는 모두 폼페이 낙서와 비문에 남은 실제 관행입니다.')),
      ev('cena', `경기 전날 시민 앞에서 만찬 — 출전 검투사 명예 +${E.cena.honor}, 호감도 +${E.cena.fame}`),
      ev('pompa', `경기 당일 행진 참여 — 출전 검투사 명예 +${E.pompa.honor}, 호감도 +${E.pompa.fame}`),
      ev('votum', `사당에 봉헌 — 이번 시즌 미시오 +${Math.round(E.votum.missio * 100)}%`),
      ev('edicta', `화공을 사서 거리 벽에 출전 검투사 이름을 그림 — 출전 검투사 명예 +${E.edicta.honor}`),
      ev('guests', `귀족을 루두스로 초대해 연습을 보이고 연회 — 출전 가능 검투사 명예 +${E.guests.honor}, 호감도 +${E.guests.fame}, 사례금 +${E.guests.gift}`),
      evCost ? h('div', { class: 'hint' }, `행사 비용 −${evCost.toLocaleString()} HS`) : null);
}

// ── 3단계: 시즌 진행
function startSeason() {
  const moneyBefore = st.money; // 행사 결제 전 잔액 (정산 기준)
  const held = holdEvents(st, eventPlan); eventPlan = { cena: false, pompa: false, votum: false, edicta: false, guests: false };
  if (EVENT_KEYS.some(k => held[k])) notice = `행사: ${EVENT_KEYS.filter(k => held[k]).map(k => EVENT_KO[k]).join(', ')}`;
  queue = st.contracts.map(c => ({ c, team: (assign[c.id] ?? []).map(id => st.roster.find(g => g.id === id)!).filter(Boolean) })).filter(q => q.team.length === q.c.size && !validTeam(st, q.c, q.team));
  seasonReports = []; skipped = []; seasonSummary = { upkeep: 0, gift: 0, trained: [], acted: [], before: moneyBefore, fameBefore: st.fame, refused: 0, skipped: [], label: seasonName(st.season), events: { ...held } };
  phase = 'battle'; save();
  nextFight();
}
function nextFight() {
  let q = queue.shift();
  while (q && validTeam(st, q.c, q.team)) { skipped.push(q.c); q = queue.shift(); } // 앞 경기의 부상·사망으로 팀이 깨진 계약은 건너뜀 (거절 벌점 없음: 아래 finishSeason 참고)
  if (!q) { finishSeason(); return; }
  report = fight(st, q.c, q.team);
  seasonReports.push(report);
  renderBattle();
}
function finishSeason() {
  const label = seasonName(st.season); const fameBefore0 = st.fame - seasonReports.reduce((a, r) => a + r.fameDelta, 0); // 경기 전 호감도
  // 훈련 처리
  const trained: { g: Gladiator; stat: 'atk' | 'def' }[] = [];
  const acted: { g: Gladiator; act: Action; note: string }[] = [];
  for (const g of st.roster) { const tp = trainPlan[g.id]; if (!tp || tp === 'rest' || assignedTo(g.id) != null || g.fought) continue;
    if (tp === 'atk' || tp === 'def') { if (train(st, g, tp)) trained.push({ g, stat: tp }); }
    else if (tp === 'show') { const r = doShow(st, g); if (r) acted.push({ g, act: tp, note: `명예 +${r.honor}` }); }
    else if (tp === 'recover') { if (doRecover(st, g)) acted.push({ g, act: tp, note: '회복 가속' }); }
    else if (tp === 'skill') { const r = doSkillTrain(st, g); if (r) acted.push({ g, act: tp, note: `${SKILL_BY_ID[r.id].name} ${r.ok ? '깨침 — 카드에서 배울지 정하세요' : '실패'}` }); } }
  const skippedNow = [...skipped];
  if (skipped.length) st.contracts = st.contracts.filter(c => !skipped.includes(c)); // 무산된 계약은 벌점 없이 소멸
  const refused = st.contracts.length ? refuseAll(st) : 0;
  const eventsHeld = { ...(st.events ?? { cena: false, pompa: false, votum: false, edicta: false, guests: false }) }; // endSeason 이 초기화하므로 미리 보관
  const { upkeep, gift } = endSeason(st);
  seasonSummary = { upkeep, gift, trained, acted, before: seasonSummary?.before ?? st.money, fameBefore: fameBefore0, refused, skipped: skippedNow, label, events: eventsHeld };
  assign = {}; trainPlan = {}; planSel = null;
  phase = st.over ? 'over' : 'summary';
  render();
}
function renderSummary() {
  const sum = seasonSummary!;
  const W = seasonReports.filter(r => r.winner === 'A').length, L = seasonReports.filter(r => r.winner === 'B').length, D = seasonReports.filter(r => r.winner === 'draw').length;
  const salary = seasonReports.reduce((a, r) => a + r.salary, 0);
  const betLoss = seasonReports.reduce((a, r) => a + (r.bet && !r.bet.won ? r.bet.amount : 0), 0);
  const rent = seasonReports.reduce((a, r) => a + r.rent, 0), expense = seasonReports.reduce((a, r) => a + r.expense, 0), prize = seasonReports.reduce((a, r) => a + r.prize, 0), comp = seasonReports.reduce((a, r) => a + r.compensation, 0);
  const trainCost = (sum.trained.length + sum.acted.filter(a => a.act === 'skill').length) * CONFIG.trainCost;
  const evHeld = EVENT_KEYS.filter(k => sum.events[k]); const evCost = evHeld.reduce((a, k) => a + CONFIG.events[k].cost, 0); const evFame = (sum.events.cena ? CONFIG.events.cena.fame : 0) + (sum.events.pompa ? CONFIG.events.pompa.fame : 0) + (sum.events.guests ? CONFIG.events.guests.fame : 0);
  const net = st.money - sum.before;
  const fameFights = seasonReports.reduce((a, r) => a + r.fameDelta, 0);
  const money = (label: string, v: number, sign: 1 | -1 = 1) => h('div', { class: 'mrow' }, h('span', {}, label), h('span', { class: v ? (sign > 0 ? 'plus' : 'minus') : '' }, `${sign > 0 ? '+' : '−'}${Math.abs(v).toLocaleString()}`));
  const badge = (cls: string, text: string) => h('span', { class: `badge ${cls}` }, text);
  const fateOf = (r: FightReport, g: Gladiator) => { const f = r.fates.find(x => x.g.id === g.id); const downed = r.downed.some(d => d.id === g.id); const won = r.winner === 'A';
    return f?.fate === 'dead' ? badge('dead', '사망') : f?.fate === 'injured' ? badge('injured', '부상') : downed ? badge('missio', won ? '쓰러졌으나 무사' : '미테! 살았다') : badge('ok', '무사'); };
  // 경기 카드
  const games = seasonReports.map(r => h('div', { class: `gamecard ${r.winner === 'A' ? 'win' : r.winner === 'B' ? 'lose' : 'draw'}` },
    h('div', { class: 'ghead' }, arenaIcon(r.contract.tier), h('div', { class: 'grow' },
      h('div', {}, h('b', { class: r.winner === 'A' ? 'plus' : r.winner === 'B' ? 'minus' : '' }, r.winner === 'A' ? '승리' : r.winner === 'B' ? '패배' : '무승부'), ` · 등급 ${r.contract.tier} ${r.contract.venue} `, h('span', { class: 'size' }, `${r.contract.size}대${r.contract.size}`), ' · ', h('span', { class: 'meta' }, HOST_KO[r.contract.host]), r.classic ? h('span', { class: 'syn classic', style: 'margin-left:6px' }, '전통 짝') : null),
      h('div', { class: 'meta' }, `대여 +${r.rent.toLocaleString()} · 경비 −${r.expense.toLocaleString()} · 상금 +${r.prize.toLocaleString()}${r.compensation ? ` · 배상 +${r.compensation.toLocaleString()}` : ''} · 호감도 ${r.fameDelta >= 0 ? '+' : ''}${r.fameDelta}`))),
    h('div', { class: 'grow2' }, ...r.team.map(g => h('div', { class: 'mini' }, portrait(g, 44), h('div', {}, h('div', { class: 'nm' }, g.name), h('div', {}, fateOf(r, g), r.promoted.includes(g) ? badge('promo', '★ 승급') : null)))))));
  // 로스터 변화
  const dead = seasonReports.flatMap(r => r.fates.filter(f => f.fate === 'dead').map(f => f.g));
  const injuredNow = st.roster.filter(g => g.injured > 0);
  const tired = st.roster.filter(g => (g.fatigue ?? 0) >= 2);
  const promoted = seasonReports.flatMap(r => r.promoted);
  const rosterItems: Node[] = [];
  if (promoted.length) rosterItems.push(h('div', { class: 'ditem todo' }, h('span', { class: 'dot' }), h('span', {}, `승급: ${promoted.map(g => g.name).join(', ')} → 베테라누스`)));
  { const ne = seasonReports.flatMap(r => r.newEpithets); if (ne.length) rosterItems.push(h('div', { class: 'ditem todo' }, h('span', { class: 'dot' }), h('span', {}, `별칭: ${ne.map(x => `${x.g.name} '${x.e.name}' (${x.e.effect})`).join(', ')}`))); }
  { const freed = seasonReports.flatMap(r => r.rudis); if (freed.length) rosterItems.push(h('div', { class: 'ditem todo' }, h('span', { class: 'dot' }), h('span', {}, `루디스: ${freed.map(g => g.name).join(', ')} — 자유민이 됐습니다. 관리 화면에서 독토르 고용 또는 계속 출전을 정하세요.`))); }
  if (sum.trained.length) rosterItems.push(h('div', { class: 'ditem todo' }, h('span', { class: 'dot' }), h('span', {}, `훈련: ${sum.trained.map(t => `${t.g.name} ${t.stat === 'atk' ? '공격' : '방어'} +1`).join(', ')}`)));
  if (st.lastLeft?.length) rosterItems.push(h('div', { class: 'ditem warn' }, h('span', { class: 'dot' }), h('span', {}, `계약 만료로 떠남: ${st.lastLeft.join(', ')}`)));
  if (st.lastFreed?.length) rosterItems.push(h('div', { class: 'ditem todo' }, h('span', { class: 'dot' }), h('span', {}, `형기 만료: ${st.lastFreed.join(', ')} — 자유민이 됐습니다 (독토르 고용 또는 급료 출전)`)));
  if (sum.acted.length) rosterItems.push(h('div', { class: 'ditem todo' }, h('span', { class: 'dot' }), h('span', {}, `행동: ${sum.acted.map(a => `${a.g.name} ${ACTION_KO[a.act]} (${a.note})`).join(', ')}`)));
  if (injuredNow.length) rosterItems.push(h('div', { class: 'ditem warn' }, h('span', { class: 'dot' }), h('span', {}, `부상 회복 중: ${injuredNow.map(g => `${g.name} (${g.injured}시즌)`).join(', ')} — 치료 ${healCostOf(st)} HS 로 바로 복귀 가능`)));
  if (tired.length) rosterItems.push(h('div', { class: 'ditem warn' }, h('span', { class: 'dot' }), h('span', {}, `피로 누적: ${tired.map(g => `${g.name} (피로 ${g.fatigue})`).join(', ')} — 한 시즌 쉬게 할 것`)));
  if (dead.length) rosterItems.push(h('div', { class: 'ditem warn' }, h('span', { class: 'dot' }), h('span', {}, `묘비에 새 이름: ${dead.map(g => `${g.name} ${g.wins}승/${g.fights}전`).join(', ')} — 관중은 침묵했다`)));
  if (evHeld.length) rosterItems.push(h('div', { class: 'ditem todo' }, h('span', { class: 'dot' }), h('span', {}, `행사: ${evHeld.map(k => EVENT_KO[k]).join(', ')} — 출전 검투사 명예·호감도 상승`)));
  if (!rosterItems.length) rosterItems.push(h('div', { class: 'ditem idle' }, h('span', { class: 'dot' }), h('span', {}, '로스터 변화 없음')));
  // 다음 시즌 예고
  const nextItems: Node[] = [];
  if (!st.over) {
    nextItems.push(h('div', { class: 'ditem todo' }, h('span', { class: 'dot' }), h('span', {}, st.contracts.length ? `새 계약 ${st.contracts.length}건: ${st.contracts.map(c => `등급 ${c.tier} ${c.venue} ${c.size}대${c.size}`).join(' / ')}` : '새 계약 없음')));
    nextItems.push(h('div', { class: 'ditem idle' }, h('span', { class: 'dot' }), h('span', {}, st.market.length ? `시장 매물 ${st.market.length}명 (${Math.min(...st.market.map(m => m.buyPrice)).toLocaleString()} HS 부터)` : '시장 매물 없음')));
    nextItems.push(h('div', { class: 'ditem idle' }, h('span', { class: 'dot' }), h('span', {}, `출전 가능 ${available(st).length}명 · 다음 시즌 유지비 ${upkeepOf(st).toLocaleString()} HS`)));
  }
  return h('div', {}, coach(),
    h('div', { class: 'panel', style: 'margin-bottom:10px' }, h('h2', {}, `${sum.label} 정산`, h('span', { class: 'hint', style: 'text-transform:none;letter-spacing:0;margin-left:8px' }, `경기 ${seasonReports.length}회 · ${W}승 ${L}패 ${D}무`)),
      seasonReports.length ? h('div', { class: 'games' }, ...games) : h('div', { class: 'hint' }, '이번 시즌 경기 없음'),
      sum.skipped.length ? h('div', { class: 'hint', style: 'margin-top:4px' }, `무산된 계약 (앞 경기 부상·사망): ${sum.skipped.map(c => c.venue).join(', ')}`) : null),
    h('div', { class: 'cols' },
      h('div', { class: 'panel' }, h('div', { class: 'cols2' }, h('div', {}, h('h2', {}, '자금'),
        h('div', { class: 'mtable', style: 'border-top:none;padding-top:0;margin-top:0' }, money('대여료', rent), money('출전 경비', expense, -1), money('승리 상금', prize), betLoss ? money('내기 패배', betLoss, -1) : null, money('사망 배상금', comp), salary ? money('자유민 급료', salary, -1) : null, evCost ? money('시즌 행사', evCost, -1) : null, money('훈련', trainCost, -1), sum.gift ? money('귀족 사례금', sum.gift) : null, money('유지비·급료', sum.upkeep, -1),
          h('div', { class: 'mrow total' }, h('span', {}, '시즌 순수지'), h('span', { class: net >= 0 ? 'plus' : 'minus' }, `${net >= 0 ? '+' : '−'}${Math.abs(net).toLocaleString()} HS`)),
          h('div', { class: 'mrow', style: 'grid-column:1 / -1' }, h('span', {}, '잔액'), h('span', {}, `${sum.before.toLocaleString()} → ${st.money.toLocaleString()} HS`))),
        ), h('div', {}, h('h2', {}, '호감도'),
        h('div', { class: 'mtable', style: 'border-top:none;padding-top:0;margin-top:0' }, money('경기', fameFights, fameFights >= 0 ? 1 : -1), money('거절', Math.abs(sum.refused), sum.refused < 0 ? -1 : 1), money('망각', 1, -1), money('출전 활동', seasonReports.length ? CONFIG.fameDelta.active : 0), evFame ? money('행사', evFame) : null,
          h('div', { class: 'mrow total' }, h('span', {}, '호감도'), h('span', {}, `${sum.fameBefore} → ${st.fame}`)))))),
      h('div', {}, h('div', { class: 'panel', style: 'margin-bottom:10px' }, h('h2', {}, '로스터'), ...rosterItems),
        st.over ? null : h('div', { class: 'panel' }, h('h2', {}, `다음 시즌 · ${seasonName(st.season)}`), ...nextItems))),
    tabbar([{ label: `다음 시즌 (${seasonName(st.season)}) →`, primary: true, onclick: () => { phase = 'manage'; render(); } }]));
}

function renderOver() {
  return h('div', { class: 'panel' }, h('h2', {}, '게임 종료'),
    h('p', {}, `${st.reason}. 최종 점수 ${score(st).toLocaleString()} (자금 + 검투사 매각가 + 호감도×100)`),
    h('div', { class: 'grave' }, st.graveyard.length ? '묘비: ' + st.graveyard.map(g => `${g.name} ${g.wins}승/${g.fights}전`).join(' · ') : '사망자 없음'),
    st.lineageLog?.length ? h('div', { class: 'grave' }, '역대 라니스타: ' + st.lineageLog.join(' → ') + ` → ${st.lanista.name}`) : null,
    h('div', { class: 'log', style: 'margin-top:8px;max-height:300px' }, st.history.join('\n')),
    h('div', { class: 'actions' }, h('button', { class: 'primary', onclick: () => { clearSave(); st = newGame(Math.floor(Math.random() * 100000)); phase = 'manage'; assign = {}; trainPlan = {}; townCanvas = null; view = 'ludus'; render(); } }, '새 게임')));
}

// ---------- 전투 재생 ----------

// ── 경기장(월드 좌표, 검투사 비율). 바닥 타원 중심 (0,0). 관객석은 타원 링으로 사방을 두르되 먼 쪽이 높이 들린다.
const hash01 = (a: number, b: number) => { const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return h - Math.floor(h); };
const WORLD = { rx: 680, ry: 150, rows: 6, seat: 46, sc: 0.9, wood: false, velarium: false }; // ry 는 tilt=1(낮은 각도)일 때. 관중 = 검투사 비율. 경기마다 등급에 맞춰 바뀐다
// 등급별 경기장: 1 = 목조 가설 경기장(작고 관중석 3단, 나무 판자), 2 = 지방 석조 경기장, 3 = 대경기장(9단, 벨라리움 차양)
const ARENA_BY_TIER: Record<number, Partial<typeof WORLD>> = {
  1: { rx: 520, ry: 118, rows: 3, wood: true, velarium: false },
  2: { rx: 680, ry: 150, rows: 6, wood: false, velarium: false },
  3: { rx: 880, ry: 190, rows: 9, wood: false, velarium: true },
};
function applyArena(tier: number) { Object.assign(WORLD, ARENA_BY_TIER[tier] ?? ARENA_BY_TIER[2]); }
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
// tilt 0 = 탑뷰(평면도), 1 = 낮은 각도
const floorRy = (tilt: number) => lerp(WORLD.rx * 0.74, WORLD.ry, tilt);
const ringOf = (k: number, tilt = 1) => ({ cy: -k * lerp(0, 40, tilt), rx: WORLD.rx * (1.05 + 0.09 * k), ry: floorRy(tilt) * (lerp(1.05, 1.15, tilt) + lerp(0.09, 0.34, tilt) * k) });
// 좌석 목록 (한 번 계산). 함성 오버레이와 캐시 렌더가 공유
// 관중 방향: 경기장 중앙을 향함 (왼쪽 관객석은 오른쪽을, 오른쪽은 왼쪽을). 20%는 반대로
const seatFacing = (sd: { x: number; j: number; k: number }): 1 | -1 => { const base: 1 | -1 = sd.x < 0 ? 1 : -1; return hash01(sd.j * 3 + 1, sd.k * 5 + 2) < 0.2 ? (base === 1 ? -1 : 1) : base; };
function seatList(density: number, tilt = 1) {
  const rx = WORLD.rx, ry = floorRy(tilt); const out: { x: number; y: number; h: number; k: number; j: number; toga: boolean; near: boolean }[] = [];
  for (let k = 0; k < WORLD.rows; k++) {
    const o = ringOf(k, tilt), i = k === 0 ? { cy: 0, rx: rx * 1.03, ry: ry * 1.04 } : ringOf(k - 1, tilt);
    const mid = { cy: (o.cy + i.cy) / 2, rx: (o.rx + i.rx) / 2, ry: (o.ry + i.ry) / 2 };
    const step = k === 0 ? WORLD.seat * 1.8 : WORLD.seat;
    const n = Math.floor(Math.PI * 2 * mid.rx / step);
    const fill = k === 0 ? Math.min(0.5, 0.2 + density * 0.4) : Math.min(1, density * (0.8 + k * 0.05));
    for (let j = 0; j <= n; j++) {
      const h = hash01(j, k); if (h > fill) continue;
      const a = (j / n) * Math.PI * 2;
      if (k <= 2 && Math.abs(a - Math.PI * 1.5) < [0.26, 0.19, 0.13][k]) continue; // 주최자석 뒤·옆은 비움
      out.push({ x: Math.cos(a) * mid.rx + (hash01(k, j) - 0.5) * 8, y: mid.cy + Math.sin(a) * mid.ry, h, k, j, toga: k === 0, near: Math.sin(a) > 0.25 });
    }
  }
  return out;
}
function drawArenaWorld(ctx: CanvasRenderingContext2D, density: number, tilt: number, view: { x0: number; y0: number; x1: number; y1: number }, lod: 'full' | 'lite' = 'full', armsUp = false) {
  const rx = WORLD.rx, ry = floorRy(tilt);
  const R = (k: number) => ringOf(k, tilt);
  // 바깥 벽 그림자
  { const o = R(WORLD.rows - 1); ctx.fillStyle = '#9c8656'; ctx.beginPath(); ctx.ellipse(0, o.cy + 16 * tilt, o.rx * 1.03, o.ry * 1.06, 0, 0, Math.PI * 2); ctx.fill(); }
  // 관객석 링 (바깥부터)
  for (let k = WORLD.rows - 1; k >= 0; k--) {
    const o = R(k), i = k === 0 ? { cy: 0, rx: rx * 1.03, ry: ry * 1.04 } : R(k - 1);
    ctx.fillStyle = WORLD.wood ? (k % 2 ? '#a97f4f' : '#9d7446') : (k % 2 ? '#c9b283' : '#bfa877');
    ctx.beginPath(); ctx.ellipse(0, o.cy, o.rx, o.ry, 0, 0, Math.PI * 2); ctx.ellipse(0, i.cy, i.rx, i.ry, 0, 0, Math.PI * 2, true); ctx.fill();
    ctx.strokeStyle = WORLD.wood ? '#6b4a22' : '#a58f60'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, o.cy, o.rx, o.ry, 0, 0, Math.PI * 2); ctx.stroke();
    if (WORLD.wood) { ctx.strokeStyle = '#7a5a30'; ctx.lineWidth = 1; ctx.beginPath(); const n = Math.floor(Math.PI * 2 * o.rx / 30); for (let j = 0; j < n; j++) { const a = (j / n) * Math.PI * 2; ctx.moveTo(Math.cos(a) * i.rx, i.cy + Math.sin(a) * i.ry); ctx.lineTo(Math.cos(a) * o.rx, o.cy + Math.sin(a) * o.ry); } ctx.stroke(); } // 판자 이음새
  }
  // 꼭대기 아치 회랑 (먼 쪽 절반) + 벨라리움 기둥
  if (tilt > 0.35 && WORLD.wood) { const o = R(WORLD.rows - 1); const n = Math.floor(Math.PI * o.rx / 36); ctx.globalAlpha = Math.min(1, (tilt - 0.35) / 0.4); // 목조: 나무 기둥과 난간
    ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i <= n; i++) { const a = Math.PI + (i / n) * Math.PI; const x = Math.cos(a) * o.rx, y = o.cy + Math.sin(a) * o.ry; ctx.moveTo(x, y + 2); ctx.lineTo(x, y - 22); } ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, o.cy - 20, o.rx, o.ry, 0, Math.PI, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
  else if (tilt > 0.35) { const o = R(WORLD.rows - 1); const n = Math.floor(Math.PI * o.rx / 48); ctx.globalAlpha = Math.min(1, (tilt - 0.35) / 0.4);
    for (let i = 0; i <= n; i++) { const a = Math.PI + (i / n) * Math.PI; const x = Math.cos(a) * o.rx, y = o.cy + Math.sin(a) * o.ry;
      ctx.fillStyle = '#8f7a4e'; ctx.beginPath(); ctx.moveTo(x - 9, y + 4); ctx.lineTo(x - 9, y - 16); ctx.arc(x, y - 16, 9, Math.PI, 0); ctx.lineTo(x + 9, y + 4); ctx.closePath(); ctx.fill();
      if (i % 4 === 0) { ctx.strokeStyle = '#6b5638'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - 24); ctx.lineTo(x, y - 70); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y - 70); ctx.lineTo(x + 26, y - 60); ctx.stroke();
        if (WORLD.velarium) { ctx.fillStyle = '#e8d9b5'; ctx.globalAlpha *= 0.85; ctx.beginPath(); ctx.moveTo(x, y - 70); ctx.lineTo(x + 26, y - 60); ctx.lineTo(x + 40, y - 30); ctx.lineTo(x - 10, y - 36); ctx.closePath(); ctx.fill(); ctx.globalAlpha = Math.min(1, (tilt - 0.35) / 0.4); } } // 벨라리움: 기둥에 걸린 차양; }
    }
    ctx.globalAlpha = 1;
  }
  // 포디움 벽 + 문 + 주최자석
  ctx.fillStyle = '#a89064'; ctx.beginPath(); ctx.ellipse(0, 0, rx * 1.03, ry * 1.04, 0, 0, Math.PI * 2); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2, true); ctx.fill();
  ctx.strokeStyle = '#7d6743'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  for (const side of [-1, 1]) { const gx = side * rx * 0.995, gy = 0; ctx.fillStyle = '#3a2412'; ctx.beginPath(); ctx.ellipse(gx, gy, 14, 26, 0, 0, Math.PI * 2); ctx.fill(); }
  drawHostBox(ctx, -ry * 1.03, tilt);
  // 모래 바닥 + 자국
  ctx.fillStyle = '#d8c48f'; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#cbb67f'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) { const yy = -ry * 0.7 + i * ry * 0.2; ctx.beginPath(); ctx.moveTo(-rx * 0.6 + hash01(i, 3) * 60, yy); ctx.quadraticCurveTo(hash01(i, 5) * 100 - 50, yy + 8, rx * 0.55 - hash01(i, 7) * 60, yy); ctx.stroke(); }
  // 관중: 앉은 스틱맨 (정적). 함성 동작은 drawCheerOverlay 가 덧그린다
  // 관중 전환: 탑뷰(전원, 점) → 기울기 0~0.45 서서히 사라짐 → 0.65~1 먼 쪽만 앉은 스틱맨으로 서서히 나타남. 가까운 쪽은 돌아오지 않음
  const fadeOut = Math.max(0, 1 - tilt / 0.45), fadeIn = Math.max(0, Math.min(1, (tilt - 0.8) / 0.2));
  if (fadeOut > 0) { // 탑뷰 점: 그 순간의 기울기 위치 (사라지는 중)
    ctx.globalAlpha = fadeOut;
    for (const sd of seatList(density, tilt)) {
      if (sd.x < view.x0 - 60 || sd.x > view.x1 + 60 || sd.y < view.y0 - 100 || sd.y > view.y1 + 30) continue;
      drawSeated(ctx, sd.x, sd.y, WORLD.sc, sd.h < 0.5 ? INK : '#5a4224', false, sd.toga, sd.j * 31 + sd.k, 0);
    }
    ctx.globalAlpha = 1;
  }
  if (fadeIn > 0) { // 앉은 관중: 처음부터 최종 좌석(tilt=1) 위치에서 나타난다 (자리 찾아가는 움직임 없음)
    ctx.globalAlpha = fadeIn;
    for (const sd of seatList(density, 1)) {
      if (sd.near) continue;
      if (sd.h < 0.35 && lod === 'full') continue; // 환호 담당은 캐시에서 빼고 매 프레임 그린다
      if (sd.x < view.x0 - 60 || sd.x > view.x1 + 60 || sd.y < view.y0 - 100 || sd.y > view.y1 + 30) continue;
      drawSeated(ctx, sd.x, sd.y - (armsUp ? 4 + (sd.j % 3) * 3 : 0), WORLD.sc, sd.h < 0.5 ? INK : '#5a4224', armsUp, sd.toga, sd.j * 31 + sd.k, 1, true, seatFacing(sd));
    }
    ctx.globalAlpha = 1;
  }
}

// 주최자석(트리부날): 포디움 정중앙에 튀어나온 돌 단상 + 기둥 + 붉은 천막 차양 + 휘장 + 화환 + 호위(릭토르) 둘
function drawHostBox(ctx: CanvasRenderingContext2D, py: number, tilt: number, hostDrawn = false) {
  const bh = lerp(34, 74, tilt), bw = 200;
  // 단상 (돌) + 계단
  ctx.fillStyle = '#a89064'; ctx.fillRect(-bw / 2, py - 6, bw, 14);
  ctx.fillStyle = '#8f7a4e'; ctx.fillRect(-bw / 2 - 10, py + 6, bw + 20, 6);
  // 뒤 휘장
  ctx.fillStyle = '#7a1f16'; ctx.fillRect(-bw / 2 + 16, py - bh, bw - 32, bh - 4);
  ctx.strokeStyle = '#5a140f'; ctx.lineWidth = 1.5; for (let i = 1; i < 6; i++) { const x = -bw / 2 + 16 + (bw - 32) * i / 6; ctx.beginPath(); ctx.moveTo(x, py - bh + 4); ctx.lineTo(x + 3, py - 6); ctx.stroke(); }
  // 기둥 둘
  for (const sx of [-1, 1]) { const x = sx * (bw / 2 - 10); ctx.fillStyle = '#d9c69a'; ctx.fillRect(x - 6, py - bh - 6, 12, bh + 2); ctx.fillStyle = '#b39c6a'; ctx.fillRect(x - 9, py - bh - 10, 18, 6); ctx.fillRect(x - 9, py - 8, 18, 5); }
  // 천막 차양 (붉은 천 + 술)
  ctx.fillStyle = '#9b2c1c'; ctx.beginPath(); ctx.moveTo(-bw / 2 - 16, py - bh - 6); ctx.lineTo(bw / 2 + 16, py - bh - 6); ctx.lineTo(bw / 2 + 4, py - bh - 26 * tilt - 6); ctx.lineTo(-bw / 2 - 4, py - bh - 26 * tilt - 6); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#e8c96a'; ctx.lineWidth = 2; ctx.beginPath(); for (let x = -bw / 2 - 14; x <= bw / 2 + 14; x += 10) { ctx.moveTo(x, py - bh - 6); ctx.lineTo(x, py - bh + 2); } ctx.stroke();
  // 화환 (녹색 호) 두 개
  ctx.strokeStyle = '#3b7a2c'; ctx.lineWidth = 3; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * bw / 4, py - bh + 6, 22, 0.15, Math.PI - 0.15); ctx.stroke(); }
  // 호위(릭토르) 둘: 서 있는 작은 스틱맨 + 도끼 묶음
  for (const sx of [-1, 1]) { const x = sx * (bw / 2 - 30); ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, py - 6); ctx.lineTo(x, py - 34); ctx.moveTo(x - 6, py - 6); ctx.lineTo(x, py - 20); ctx.lineTo(x + 6, py - 6); ctx.moveTo(x, py - 30); ctx.lineTo(x - 8, py - 18); ctx.moveTo(x, py - 30); ctx.lineTo(x + 7 * sx, py - 24); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, py - 41, 7, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(x + 7 * sx, py - 2); ctx.lineTo(x + 7 * sx, py - 52); ctx.stroke(); // 파스케스
    ctx.fillStyle = INK; ctx.fillRect(x + 7 * sx - 5, py - 56, 10, 8); }
  // 주최자 (앉음)
  if (!hostDrawn) drawSeated(ctx, 0, py - 40, WORLD.sc * 1.05, INK, false, true, 77, 1);
}
// 함성 오버레이: 화면 안 관중 일부가 팔을 들고 들썩임 (가벼움)
function drawCheerOverlay(ctx: CanvasRenderingContext2D, seats: ReturnType<typeof seatList>, t: number, cheer: number, view: { x0: number; y0: number; x1: number; y1: number }, cloth = 0) {
  // cloth: 흰 천(마파)을 흔드는 관중 비율 — 미시오 판정 때 "살려라"의 뜻 (고증: 천을 흔드는 건 관중)
  for (const sd of seats) {
    if (sd.h >= 0.35 || sd.near) continue; // 캐시에 없는 동적 관중(먼 쪽)만
    if (sd.x < view.x0 - 60 || sd.x > view.x1 + 60 || sd.y < view.y0 - 100 || sd.y > view.y1 + 30) continue;
    const up = cheer > 0;
    const bob = up ? Math.abs(Math.sin(t * 16 + sd.j * 0.7 + sd.k)) * 8 * Math.min(1, cheer * 2) : 0;
    drawSeated(ctx, sd.x, sd.y - bob, WORLD.sc, INK, up, sd.toga, sd.j * 31 + sd.k, 1, true, seatFacing(sd));
    if (up && cloth > 0 && hash01(sd.j * 13 + 5, sd.k * 7 + 3) < cloth) { // 든 손끝에 흰 천
      const f = seatFacing(sd); const w = Math.sin(t * 12 + sd.j + sd.k) * 6; const hx = sd.x + 12 * f * WORLD.sc, hy = sd.y - bob - 11 * WORLD.sc; // 든 손끝 (머리 기준 −11)
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(hx + 7 * f + w, hy - 12, hx + 14 * f + w, hy - 4); ctx.quadraticCurveTo(hx + 7 * f + w * 0.5, hy + 1, hx, hy); ctx.fill(); ctx.stroke();
    }
  }
}

function renderBattle() {
  const r = report!;
  app.replaceChildren();
  const canvas = h('canvas', { id: 'arena' }) as HTMLCanvasElement;
  const logEl = h('div', { class: 'log' });
  const skip = h('button', {}, '건너뛰기');
  const clock = h('span', { class: 'hint' }, '0.0s');
  const legendShown = localStorage.getItem('lanista-legend') === '1'; localStorage.setItem('lanista-legend', '1'); // 범례는 처음 한 번만
  const wrap = h('div', { class: 'panel battle' }, // 편성처럼 화면 전환 (모달 아님)
    h('h2', {}, `${r.contract.venue} — ${HOST_KO[r.contract.host]}`, h('span', { class: 'hint', style: 'margin-left:10px;font-weight:400' }, `${r.contract.size}대${r.contract.size} · ${queue.length + 1}경기 남음`)),
    h('div', { class: 'hint', style: 'margin:-6px 0 6px' }, ...(legendShown ? [] : [h('span', { style: 'color:#2c4f9b;font-weight:700' }, '■ 파란 방패·허리천 = 내 루두스'), '   ', h('span', { style: `color:${ENEMY};font-weight:700` }, '■ 자주색 = 상대 파밀리아'), '   ']), clock),
    canvas, h('div', { class: 'actions' }, skip));
  app.append(wrap); window.scrollTo(0, 0);
  const W = canvas.clientWidth || 720, H = canvas.clientHeight || 500; // 높이는 CSS(min(500px, 60vh))를 따른다
  canvas.width = W * devicePixelRatio; canvas.height = H * devicePixelRatio;
  const ctx = canvas.getContext('2d')!; ctx.scale(devicePixelRatio, devicePixelRatio);
  const ZK = Math.max(0.72, Math.min(1, W / 1000)); // 좁은 화면: 줌을 낮춰 싸움이 화면에 들어오게 (폰 ≈ 0.72, 보이는 폭 ≈ 620)
  // 룰 좌표 → 월드 좌표 (바닥 타원 안, 화면 폭에 맞춤)
  const sx = (x: number) => (x / ARENA.w - 0.5) * 1120; // 바닥 폭 거의 전체
  const sy = (y: number) => (y / ARENA.h - 0.5) * floorRy(tilt) * 1.27 - 8;
  const SC = 0.9;
  const units = [...r.team.map(g => ({ g, side: 'A' as const })), ...r.contract.enemy.map(g => ({ g, side: 'B' as const }))];
  const byId = Object.fromEntries(units.map(u => [u.g.id, u]));
  const hp: Record<number, number> = { ...r.initialHp };
  const face: Record<number, 1 | -1> = Object.fromEntries(units.map(u => [u.g.id, u.side === 'A' ? 1 : -1]));
  const engaged: Record<number, number | undefined> = {};
  const boundUntil: Record<number, number> = {};
  const clips: Record<number, { clip: ClipName; start: number }> = Object.fromEntries(units.map(u => [u.g.id, { clip: 'guard', start: -9 }]));
  const play = (id: number, clip: ClipName, at: number) => { clips[id] = { clip, start: at }; };
  let flash: { id: number; t: number; text: string; color: string }[] = [];
  let nets: { from: number; to: number; start: number; dur: number }[] = [];
  const netAway: Record<number, boolean> = {};
  const pending: { at: number; fn: () => void }[] = [];
  const phaseOf: Record<number, number> = {};
  const leapUntil: Record<number, number> = {};
  const jolt: Record<number, { amp: number; until: number }> = {};
  let slowUntil = -1;
  let zoomAt: { x: number; y: number } | null = null; let zoomStart = -1;
  const fx: { kind: 'slash' | 'dust' | 'ink'; x: number; y: number; t: number; dir: number; seed: number }[] = [];
  const shouts: { text: string; t: number; x: number }[] = [];
  let armedEi = -1; // 미리 줌인을 건 이벤트 인덱스
  let holdUntil = -1; // 줌 유지(슬로모션) 끝
  let zoomOutDur = 1.2;
  let crowdCheer = 0;
  const shout = (text: string, x: number) => { shouts.length = 0; shouts.push({ text, t: 1.2, x }); crowdCheer = 0.7; sfx.cheer(0.5); };
  applyArena(r.contract.tier); // 등급별 경기장 규모
  const fansAvg = [...r.team, ...r.contract.enemy].reduce((a, g) => a + fansOf(g), 0) / (r.team.length + r.contract.enemy.length);
  const density = Math.min(1, 0.12 + st.fame / 100 * 0.55 + (r.contract.tier - 1) * 0.22 + fansAvg / 200); // 팬이 많으면 관중석이 찬다
  startCrowd(0.2 + density * 0.4); sfx.gate(); sfx.drum(2);
  { const star = [...r.team].filter(g => fansOf(g) >= FANS_STAR).sort((a, b) => fansOf(b) - fansOf(a))[0]; if (star) pending.push({ at: 0.5, fn: () => { shout(`${star.name}!  ${star.name}!`, 0); crowdCheer = 1; } }); } // 스타가 나오면 관중이 이름을 외친다
  // 경기장·관중을 한 번만 그려 캐시 (월드 좌표, 1px = 1 단위)
  const outer0 = ringOf(WORLD.rows - 1, 0), outer1 = ringOf(WORLD.rows - 1, 1);
  const AW = Math.ceil(Math.max(outer0.rx, outer1.rx) * 2.2), AH = Math.ceil(Math.max(outer0.ry, outer1.ry) * 2.3 + 160), AOX = AW / 2, AOY = AH / 2 + 60;
  const arenaCache = document.createElement('canvas'); arenaCache.width = AW; arenaCache.height = AH;
  { const c2 = arenaCache.getContext('2d')!; c2.translate(AOX, AOY); drawArenaWorld(c2, density, 1, { x0: -AOX, y0: -AOY, x1: AOX, y1: AH - AOY }); }
  const arenaCacheUp = document.createElement('canvas'); arenaCacheUp.width = AW; arenaCacheUp.height = AH; // 관중 전원 팔 든 판 (세레모니 열광용)
  { const c2 = arenaCacheUp.getContext('2d')!; c2.translate(AOX, AOY); drawArenaWorld(c2, density, 1, { x0: -AOX, y0: -AOY, x1: AOX, y1: AH - AOY }, 'full', true); }
  let frenzy = false;
  let hostMood: 'none' | 'pleased' | 'flat' | 'judging' = 'none';
  let hostGesture: 'none' | 'cloth' | 'thumb' = 'none'; // 판정: 손 들어 올림(살려라) / 엄지 내림(죽여라)
  let crowdCloth = 0; // 천을 흔드는 관중 비율 (판정 중)
  let hostShout = '';
  let palmAt = -1; let palmTarget = { x: 0, y: 0 }; let throwUntil = -1; let palmKind: 'palm' | 'rudis' = 'palm';
  let palm: { t: number; x0: number; y0: number; x1: number; y1: number } | null = null; // 종려가지 던지기
  const seats = seatList(density, 1);
  let tilt = 0;
  const drops: { x: number; y: number; vx: number; vy: number; r: number; ground: number }[] = [];
  const stains: { x: number; y: number; r: number; a: number }[] = [];
  const bleed = (x: number, y: number, dir: number, n: number, power: number) => {
    for (let i = 0; i < n; i++) { const a = (Math.random() - 0.5) * 1.6 + (dir > 0 ? 0 : Math.PI); const sp = 60 + Math.random() * 120 * power;
      drops.push({ x, y: y - 10 - Math.random() * 14, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.4 - 40 - Math.random() * 80 * power, r: 1 + Math.random() * 1.8 * power, ground: y + 18 + Math.random() * 12 }); }
  };
  const speedOf: Record<number, number> = {}; const prevPos: Record<number, { x: number; y: number }> = {};

  const frames = r.frames; let fi = 0;
  function posAt(ct: number): Record<number, { x: number; y: number; hp: number }> {
    while (fi < frames.length - 2 && frames[fi + 1].t <= ct) fi++;
    const a = frames[fi], b = frames[Math.min(fi + 1, frames.length - 1)];
    const k = b.t > a.t ? Math.max(0, Math.min(1, (ct - a.t) / (b.t - a.t))) : 0;
    const out: Record<number, { x: number; y: number; hp: number }> = {};
    a.u.forEach((ua, idx) => { const ub = b.u[idx]; out[ua[0]] = { x: sx(ua[1] + (ub[1] - ua[1]) * k), y: sy(ua[2] + (ub[2] - ua[2]) * k), hp: ua[3] }; });
    return out;
  }

  let ei = 0;
  function armCinematic(ct: number) {
    // 다음 공격 이벤트가 치명타 또는 쓰러뜨림이면 공격 전에 줌인·슬로모션을 건다
    if (armedEi >= ei) return;
    for (let k = ei; k < r.events.length; k++) {
      const e = r.events[k]; if (e.kind !== 'attack') continue;
      if (e.t - ct > 0.45) return;
      if (!e.downed) return; // 쓰러뜨리는 타격만 시네마틱 (치명타는 흔들림·표시만)
      const pp = posAt(ct);
      zoomAt = { x: (pp[e.actor].x + pp[e.target!].x) / 2, y: (pp[e.actor].y + pp[e.target!].y) / 2 - 10 };
      zoomStart = ct; armedEi = k;
      const hitDelay = (e.combo ? 0.12 : 0.2) + (e.net ? 0.55 : 0);
      const isLast = !r.events.slice(k + 1).some(x => x.kind === 'attack' && x.downed); // 마지막으로 쓰러지는 타격인가
      holdUntil = e.t + hitDelay + (isLast ? 0.95 : 0.35); // 마지막만 눕는 장면까지, 중간은 짧게
      slowUntil = holdUntil;
      zoomOutDur = isLast ? 1.2 : 0.5;
      return;
    }
  }
  function fireEvents(ct: number) {
    armCinematic(ct);
    while (ei < r.events.length && r.events[ei].t <= ct) {
      const e = r.events[ei++];
      if (e.kind === 'skill') { flash.push({ id: e.actor, t: 1.3, text: SKILL_NAME(e.skill ?? ''), color: '#c58a1a' }); if (e.skill === 'shield_bash') sfx.block(); else if (e.skill === 'net_recover') sfx.net(); else if (e.skill === 'second_wind') sfx.cheer(0.3); else sfx.whip(); continue; }
      if (e.kind !== 'attack' || e.target == null) continue;
      const aid = e.actor, tid = e.target, tgtType = byId[tid].g.type;
      engaged[aid] = tid; engaged[tid] = aid;
      const counter = !e.combo && r.events[ei - 2] && r.events[ei - 2].actor === tid && r.events[ei - 2].target === aid && !r.events[ei - 2].downed;
      if (e.skill === 'riposte') flash.push({ id: aid, t: 1.2, text: '되받아치기!', color: '#c58a1a' }); else if (counter) flash.push({ id: aid, t: 1, text: '반격!', color: '#2c4f9b' });
      if (e.combo) flash.push({ id: aid, t: 1, text: '연속!', color: '#c58a1a' });
      if (e.charge) { flash.push({ id: aid, t: 1, text: '돌진!', color: '#9b2c1c' }); leapUntil[aid] = ct + 0.28; const p0 = posAt(ct)[aid]; fx.push({ kind: 'dust', x: p0.x, y: p0.y + 34, t: 0.5, dir: face[aid], seed: aid }); shout('우와아!', p0.x); }
      const hitDelay = e.combo ? 0.12 : 0.2;
      const isFinal = !!e.downed && !r.events.slice(ei).some(x => x.kind === 'attack' && x.downed);
      if (e.net) {
        play(aid, 'net_throw', ct); netAway[aid] = true;
        nets.push({ from: aid, to: tid, start: ct + 0.14, dur: 0.38 }); sfx.net();
        pending.push({ at: ct + 0.5, fn: () => { boundUntil[tid] = ct + 0.5 + 1.2; } });
        pending.push({ at: ct + 0.55, fn: () => play(aid, attackClipFor(byId[aid].g.type), ct + 0.55) });
        pending.push({ at: ct + 1.6, fn: () => { netAway[aid] = false; } });
      } else play(aid, e.combo ? comboClipFor(byId[aid].g.type) : attackClipFor(byId[aid].g.type), ct);
      pending.push({ at: ct + hitDelay + (e.net ? 0.55 : 0), fn: () => {
        hp[tid] = e.targetHp!;
        play(tid, e.downed ? deathClipFor(byId[aid].g.type) : e.blocked && hasBigShield(loadoutFor(tgtType)) ? 'block' : 'hit', ct + hitDelay);
        if (e.downed) sfx.down(); else if (e.blocked) sfx.block(); else if (e.crit) sfx.crit(); else sfx.hit(!!(e.counter || e.charge || e.combo));
        const stack = flash.filter(f => f.id === tid).length;
        flash.push({ id: tid, t: 1 + stack * 0.35, text: `-${e.dmg}${e.counter ? '!' : ''}${e.charge ? ' 돌진' : ''}${e.combo ? ' 연속' : ''}${e.blocked ? ' 방패' : ''}${e.net ? ' 그물' : ''}`, color: e.counter ? '#9b2c1c' : e.blocked ? '#2c4f9b' : '#2b1d0e' });
        const heavy = e.counter || e.charge || e.downed;
        const amp = e.downed ? 7 : e.crit ? 9 : heavy ? 5 : 3; // 치명타는 흔들림 최대
        jolt[tid] = { amp, until: ct + (e.crit ? 0.32 : 0.22) }; jolt[aid] = { amp: amp * 0.6, until: ct + 0.16 };
        const pt = posAt(ct)[tid]; const pa = posAt(ct)[aid];
        fx.push({ kind: 'slash', x: pt.x, y: pt.y - 6, t: 0.28, dir: pa.x <= pt.x ? 1 : -1, seed: aid * 7 + tid });
        const ratioDmg = (e.dmg ?? 0) / r.initialHp[tid];
        const pBlood = e.downed ? 1 : Math.max(0.15, Math.min(1, ratioDmg * 3.2));
        if (!e.blocked && Math.random() < pBlood) bleed(pt.x, pt.y, pa.x <= pt.x ? 1 : -1, e.downed ? 22 : Math.round(4 + ratioDmg * 40), e.downed ? 1.6 : 0.7 + ratioDmg * 2);
        if (e.crit) flash.push({ id: tid, t: 1.3, text: '치명타!', color: '#9b1f14' });
        if (e.downed) shout(isFinal ? '이우굴라!  이우굴라!' : '이우굴라!', pt.x);
        else if (e.crit) shout('하베트!  하베트!', pt.x);
        else if (heavy) shout('하베트!', pt.x);
        else if (e.blocked) shout('오오…', pt.x);
      } });
      logEl.append(h('div', {}, `${e.t.toFixed(1)}s ${byId[aid].g.name} → ${byId[tid].g.name} ${e.dmg}${e.combo ? ' 연속!' : ''}${e.blocked ? ' 방패로 막음' : ''}${e.net ? ' 그물!' : ''}${e.downed ? ' 쓰러짐' : ''}`));
    }
    for (let k = pending.length - 1; k >= 0; k--) if (pending[k].at <= ct) { const p = pending.splice(k, 1)[0]; p.fn(); }
  }

  // ── 카메라: 준비 단계엔 경기장 전체(줌아웃) → 시작하면 검투사 쪽으로 줌인(관객석 1~2층까지)
  const outer = ringOf(WORLD.rows - 1, 0);
  const ZOUT = Math.min(W / (2 * outer.rx * 1.08), H / (2 * outer.ry * 1.1));
  const CAM_IN = { z: 0.78 * ZK, x: 0, y: -150 * ZK }; // 관객석 2층까지. x 는 싸움 중심을 따라감
  let followX = 0;
  const CAM_OUT = { z: ZOUT, x: 0, y: 0 };
  const INTRO_HOLD = 1.0, INTRO_ZOOM = 2.2;
  let intro = 0; // 실시간 경과

  // 카메라 상태: 목표(z, cx, cy)를 향해 부드럽게 따라간다. 들어갈 땐 빠르게(8/s), 빠질 땐 느리게(2/s)
  const camCur = { z: 0, cx: 0, cy: 0, init: false };
  function camera(ct: number, dtReal: number) {
    let z: number, cx: number, cy: number;
    if (intro < INTRO_HOLD) { z = CAM_OUT.z; cx = CAM_OUT.x; cy = CAM_OUT.y; tilt = 0; }
    else if (intro < INTRO_HOLD + INTRO_ZOOM) { const k = (intro - INTRO_HOLD) / INTRO_ZOOM; const e = 1 - Math.pow(1 - k, 3); tilt = e; z = CAM_OUT.z + (CAM_IN.z - CAM_OUT.z) * e; cx = CAM_OUT.x + (followX - CAM_OUT.x) * e; cy = CAM_OUT.y + (CAM_IN.y - CAM_OUT.y) * e; }
    else { z = CAM_IN.z; cx = followX; cy = CAM_IN.y; tilt = 1; }
    // 시네마틱 목표: 줌 유지 구간이면 ZMAX 로 zoomAt 을 본다
    const ZMAX = 1.9;
    let tz = z, tx = cx, ty = cy;
    if (zoomAt && ct < holdUntil) { tz = z * ZMAX; tx = zoomAt.x; ty = zoomAt.y; }
    else if (zoomAt && ct >= holdUntil + zoomOutDur) { zoomAt = null; zoomStart = -1; }
    if (intro < INTRO_HOLD + INTRO_ZOOM || !camCur.init) { camCur.z = tz; camCur.cx = tx; camCur.cy = ty; camCur.init = intro >= INTRO_HOLD + INTRO_ZOOM; return { z: tz, cx: tx, cy: ty }; }
    // 목표를 향해 이동 (줌인은 빠르게, 줌아웃은 느리게)
    const rate = tz > camCur.z ? 8 : 2.2;
    const a = 1 - Math.exp(-rate * dtReal);
    camCur.z += (tz - camCur.z) * a; camCur.cx += (tx - camCur.cx) * a; camCur.cy += (ty - camCur.cy) * a;
    return { z: camCur.z, cx: camCur.cx, cy: camCur.cy };
  }

  function draw(ct: number, dt: number) {
    const pos = posAt(ct);
    { const al = units.filter(u => hp[u.g.id] > 0); const mx = al.length ? al.reduce((a, u) => a + pos[u.g.id].x, 0) / al.length : 0;
      const lim = Math.max(0, WORLD.rx - W / (2 * CAM_IN.z) + 40);
      const tx = Math.max(-lim, Math.min(lim, mx));
      followX += (tx - followX) * Math.min(1, dt * 2.5); }
    const cam = camera(ct, lastDtReal);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#e6d6ad'; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.scale(cam.z, cam.z); ctx.translate(-cam.cx, -cam.cy);
    const view = { x0: cam.cx - W / (2 * cam.z), y0: cam.cy - H / (2 * cam.z), x1: cam.cx + W / (2 * cam.z), y1: cam.cy + H / (2 * cam.z) };
    if (tilt < 1) drawArenaWorld(ctx, density, tilt, view, 'lite'); // 인트로: 그 순간의 기울기로 직접 그림 (간략 관중)
    else if (frenzy) { const ph = Math.floor(ct * 7) % 2; ctx.drawImage(ph ? arenaCacheUp : arenaCache, -AOX, ph ? -AOY - 5 : -AOY); } // 열광: 두 판 번갈아 + 들썩
    else ctx.drawImage(arenaCache, -AOX, -AOY);                     // 경기 중: 캐시
    if (tilt >= 0.5) drawCheerOverlay(ctx, seats, ct, crowdCheer, view, crowdCloth); if (crowdCheer > 0) crowdCheer -= dt;
    // 주최자 반응 (세레모니)
    if (hostMood !== 'none') {
      const py = -floorRy(1) * 1.03;
      drawHostBox(ctx, py, 1, true); // 단상 다시 그림 (주최자 제외)
      if (palmAt >= 0 && ct >= palmAt) { palm = { t: 0, x0: 0, y0: py - 50, x1: palmTarget.x, y1: palmTarget.y }; throwUntil = ct + 0.5; if (palmKind === 'palm') hostShout = '주최자가 종려가지를 던진다!'; palmAt = -1; }
      if (ct < throwUntil) { // 던지기: 팔을 앞으로 뻗은 서 있는 자세
        ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, py - 8); ctx.lineTo(0, py - 40); ctx.moveTo(-6, py - 8); ctx.lineTo(0, py - 24); ctx.lineTo(6, py - 8); ctx.moveTo(0, py - 36); ctx.lineTo(-10, py - 28); ctx.moveTo(0, py - 36); ctx.lineTo(14, py - 48); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, py - 49, 9, 0, Math.PI * 2); ctx.stroke();
      }
      else if (hostMood === 'judging') { // 판정: 일어서서 관중을 살피다가 손수건을 흔들거나 엄지를 내린다
        let look = 0; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, py - 8); ctx.lineTo(0, py - 40); ctx.moveTo(-6, py - 8); ctx.lineTo(0, py - 24); ctx.lineTo(6, py - 8); ctx.stroke(); // 다리·몸
        ctx.fillStyle = '#efe5c9'; ctx.beginPath(); ctx.moveTo(-6, py - 38); ctx.lineTo(6, py - 38); ctx.lineTo(8, py - 14); ctx.lineTo(-8, py - 14); ctx.closePath(); ctx.fill(); ctx.stroke(); // 토가
        ctx.strokeStyle = '#6b2d7a'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-2, py - 36); ctx.lineTo(-3, py - 16); ctx.stroke(); ctx.strokeStyle = INK; ctx.lineWidth = 3;
        if (hostGesture === 'cloth') { const w = Math.sin(ct * 6) * 2; ctx.beginPath(); ctx.moveTo(0, py - 36); ctx.lineTo(-9, py - 28); ctx.moveTo(0, py - 36); ctx.lineTo(9, py - 50); ctx.lineTo(10 + w, py - 64); ctx.stroke();
          ctx.lineWidth = 1.8; ctx.beginPath(); for (let k = -2; k <= 2; k++) { ctx.moveTo(10 + w, py - 64); ctx.lineTo(10 + w + k * 2.6, py - 71); } ctx.stroke(); } // 편 손을 높이 들어 올림 (살려라)
        else if (hostGesture === 'thumb') { ctx.beginPath(); ctx.moveTo(0, py - 36); ctx.lineTo(-9, py - 28); ctx.moveTo(0, py - 36); ctx.lineTo(12, py - 30); ctx.lineTo(22, py - 26); ctx.stroke(); ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(22, py - 26); ctx.lineTo(23, py - 16); ctx.stroke(); } // 팔 뻗어 엄지 내림 (폴리케 베르소)
        else { look = Math.sin(ct * 1.5) * 3; ctx.beginPath(); ctx.moveTo(0, py - 36); ctx.lineTo(-8, py - 24); ctx.lineTo(-3, py - 18); ctx.moveTo(0, py - 36); ctx.lineTo(8, py - 26); ctx.lineTo(2, py - 20); ctx.stroke(); } // 팔짱 끼고 관중을 살핌 (고개 돌림)
        ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(look, py - 49, 9, 0, Math.PI * 2); ctx.save(); ctx.fillStyle = '#eadfc0'; ctx.fill(); ctx.restore(); ctx.stroke(); }
      else if (hostMood === 'pleased') { const bob = Math.abs(Math.sin(ct * 12)) * 6; drawSeated(ctx, 0, py - 46 - bob, WORLD.sc * 1.05, INK, true, true, 77, 1); }
      else drawSeated(ctx, 0, py - 40, WORLD.sc * 1.05, INK, false, true, 77, 1);
    }
    ctx.fillStyle = '#8a1e14';
    for (const st0 of stains) { ctx.globalAlpha = st0.a; ctx.beginPath(); ctx.ellipse(st0.x, st0.y, st0.r * 1.4, st0.r * 0.7, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    const order = [...units].sort((a, b) => (hp[a.g.id] > 0 ? 1 : 0) - (hp[b.g.id] > 0 ? 1 : 0) || pos[a.g.id].y - pos[b.g.id].y);
    for (const u of order) {
      const id = u.g.id; const p = pos[id]; const isAlive = hp[id] > 0;
      const pv = prevPos[id]; let sp = 0;
      if (pv && dt > 0) { sp = Math.hypot(p.x - pv.x, p.y - pv.y) / dt; if (Math.abs(p.x - pv.x) > 0.3) face[id] = p.x > pv.x ? 1 : -1; }
      prevPos[id] = { x: p.x, y: p.y };
      speedOf[id] = sp; phaseOf[id] = (phaseOf[id] ?? 0) + dt * (sp > 120 ? 16 : 7);
      const eng = engaged[id]; if (eng != null && hp[eng] > 0 && sp < 30) face[id] = pos[eng].x >= p.x ? 1 : -1;
      const a = clips[id]; const el = (ct - a.start) * 1000;
      let sk = clipSkeleton(a.clip, el);
      let lapDx = 0;
      if (lap[id]) { const L = lap[id]; const e2 = ct - L.start; const T = 3.2; const k2 = Math.min(1, e2 / T); lapDx = Math.sin(k2 * Math.PI) * 260 * L.dir; face[id] = (k2 < 0.5 ? L.dir : -L.dir) as 1 | -1; sk = { ...runSkeleton(ct * 14, true), frontArm: [-160, -10], backArm: [-140, 10] }; }
      const isBound = isAlive && ct < (boundUntil[id] ?? 0) && !isDeathClip(a.clip);
      const busy = el < clipLength(a.clip);
      if (isBound && !busy) sk = clipSkeleton('bound', 120);
      else if (isAlive && !busy && sp > 12) sk = runSkeleton(phaseOf[id], sp > 120);
      if (ct < (leapUntil[id] ?? 0)) { const k = 1 - (leapUntil[id] - ct) / 0.28; sk = { ...sk, lift: (sk.lift ?? 0) + Math.sin(k * Math.PI) * 16 }; }
      let exitDx = 0, exitAlpha = 1; let exitSk: Skeleton | null = null;
      if (exits[id]) { const E = exits[id]; const e2 = Math.max(0, ct - E.start); exitDx = e2 * 90 * E.dir; exitAlpha = Math.max(0, 1 - Math.max(0, e2 - 1.2) / 1.2); exitSk = walkSkeleton(e2 * 9, 1); face[id] = E.dir; }
      if (exitSk) sk = exitSk;
      const inJudge = judged.has(id) && judge != null && (judgeLive[id] || judge.stage < 4 || busy); // 판정 중인 패자는 선명하게, 처형된 뒤에는 시신처럼 흐리게
      ctx.globalAlpha = (isAlive || (isDeathClip(a.clip) && busy) || inJudge) ? exitAlpha : 0.55;
      const jz = jolt[id] && ct < jolt[id].until ? jolt[id] : null;
      const jx = jz ? Math.sin(ct * 90 + id) * jz.amp * (jz.until - ct) / 0.22 : 0, jy = jz ? Math.cos(ct * 70 + id) * jz.amp * 0.5 * (jz.until - ct) / 0.22 : 0;
      if (a.clip.startsWith('combo') && busy && el > 120 && el < 300) { // 연속 공격: 2타의 잔상 (60ms 전 자세를 흐리게 겹쳐 그린다)
        const gs = clipSkeleton(a.clip, el - 60); ctx.save(); ctx.globalAlpha *= 0.32;
        drawStickman(ctx, u.g.type, { x: p.x + jx + lapDx + exitDx - face[id] * 6, y: p.y + 30 * SC + jy, scale: 1.15 * SC, facing: face[id], skeleton: gs, t: ct, team: u.side === 'A' ? '#2c4f9b' : ENEMY, accessories: accessoriesOf(u.g) }); ctx.restore(); }
      drawStickman(ctx, u.g.type, { x: p.x + jx + lapDx + exitDx, y: p.y + 30 * SC + jy, scale: 1.15 * SC, facing: face[id], skeleton: sk, t: ct, wobble: isBound && !busy, noNet: !!netAway[id], team: u.side === 'A' ? '#2c4f9b' : ENEMY, accessories: accessoriesOf(u.g) });
      if (exitAlpha <= 0) { ctx.globalAlpha = 1; continue; }
      ctx.globalAlpha = 1;
      ctx.fillStyle = TYPE_COLOR[u.g.type]; ctx.beginPath(); ctx.arc(p.x - 22 + lapDx, p.y + 40, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = u.side === 'A' ? '#2c4f9b' : ENEMY; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(u.side === 'A' ? u.g.name : u.g.name.replace('(적)', ''), p.x + 3 + lapDx, p.y + 44);
      const ratio = Math.max(0, hp[id]) / r.initialHp[id];
      ctx.fillStyle = '#7a6a4e'; ctx.fillRect(p.x - 17, p.y - 56, 34, 4);
      ctx.fillStyle = ratio > 0.5 ? '#3b7a2c' : ratio > 0.25 ? '#c58a1a' : '#9b2c1c'; ctx.fillRect(p.x - 17, p.y - 56, 34 * ratio, 4);
    }
    if (palm) { // 종려가지: 주최자석에서 승자에게 포물선으로
      palm.t = Math.min(1, palm.t + dt / 1.1); const k = palm.t; const x = palm.x0 + (palm.x1 - palm.x0) * k, y = palm.y0 + (palm.y1 - palm.y0) * k - Math.sin(k * Math.PI) * 120;
      ctx.save(); ctx.translate(x, y); ctx.rotate(k * 9);
      if (palmKind === 'rudis') { ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, -16); ctx.stroke(); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-7, 4); ctx.lineTo(7, 4); ctx.stroke(); } // 루디스: 나무 검
      else { ctx.strokeStyle = '#3b7a2c'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, -16); for (let i = 1; i <= 4; i++) { ctx.moveTo(0, -i * 4); ctx.lineTo(-7, -i * 4 - 5); ctx.moveTo(0, -i * 4); ctx.lineTo(7, -i * 4 - 5); } ctx.stroke(); }
      ctx.restore();
    }
    nets = nets.filter(n => ct < n.start + n.dur + 0.05);
    for (const n of nets) {
      const k = Math.max(0, Math.min(1, (ct - n.start) / n.dur)); if (k <= 0) continue;
      const a = pos[n.from], b = pos[n.to];
      const x0 = a.x + face[n.from] * 10, y0 = a.y - 10;
      const x = x0 + (b.x - x0) * k, y = y0 + (b.y - 10 - y0) * k - Math.sin(k * Math.PI) * 70;
      drawNetProjectile(ctx, x, y, 26, Math.min(1, Math.max(0, (k - 0.15) / 0.5)), k * 6);
    }
    for (const u of units) if (hp[u.g.id] > 0 && ct < (boundUntil[u.g.id] ?? 0)) drawNetOverlay(ctx, pos[u.g.id].x, pos[u.g.id].y + 32 * SC, 78 * SC, undefined, ct);
    ctx.fillStyle = '#9b1f14';
    for (let k = drops.length - 1; k >= 0; k--) {
      const d = drops[k]; d.vy += 420 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= 0.98;
      if (d.y >= d.ground) { stains.push({ x: d.x, y: d.ground, r: d.r * 1.6, a: 0.55 }); drops.splice(k, 1); continue; }
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
    }
    for (let k = fx.length - 1; k >= 0; k--) {
      const f = fx[k]; f.t -= dt; if (f.t <= 0) { fx.splice(k, 1); continue; }
      ctx.save(); ctx.strokeStyle = '#3a2412'; ctx.fillStyle = '#3a2412'; ctx.lineCap = 'round';
      if (f.kind === 'slash') { const k2 = 1 - f.t / 0.28; ctx.globalAlpha = 1 - k2; ctx.lineWidth = 3 - k2 * 2; ctx.beginPath(); ctx.arc(f.x - f.dir * 8, f.y, 26 + k2 * 10, -0.9 * f.dir + (f.dir > 0 ? 0 : Math.PI), 0.5 * f.dir + (f.dir > 0 ? 0 : Math.PI), f.dir < 0); ctx.stroke(); }
      else if (f.kind === 'dust') { const k2 = 1 - f.t / 0.5; ctx.globalAlpha = 0.6 * (1 - k2); ctx.lineWidth = 1.5; for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI + Math.PI; const rr = 8 + k2 * 22; ctx.beginPath(); ctx.arc(f.x - f.dir * 10 + Math.cos(a) * rr, f.y + Math.sin(a) * rr * 0.4, 3 + k2 * 4, 0, Math.PI * 2); ctx.stroke(); } }
      ctx.restore();
    }
    for (const f of flash) { ctx.fillStyle = f.color; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(f.text, pos[f.id].x + 30, pos[f.id].y - 14 - (1 - Math.min(1, f.t)) * 14 - Math.max(0, f.t - 1) * 30); }
    ctx.restore();
    // HUD: 함성 (카메라 무관), 준비 단계 안내
    for (let k = shouts.length - 1; k >= 0; k--) {
      const sh = shouts[k]; sh.t -= dt; if (sh.t <= 0) { shouts.splice(k, 1); continue; }
      const scx = W / 2 + (sh.x - cam.cx) * cam.z;
      ctx.save(); ctx.globalAlpha = Math.min(1, sh.t); ctx.fillStyle = '#7a3a1c'; ctx.font = `bold ${sh.text.length > 8 ? 20 : 16}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(sh.text, Math.max(60, Math.min(W - 60, scx)), 70 - (1.2 - sh.t) * 10); ctx.restore();
    }
    if (hostShout) { ctx.save(); ctx.fillStyle = hostMood === 'pleased' ? '#3b7a2c' : '#7a6a4e'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(hostShout, W / 2, 96); ctx.restore(); }
    if (intro < INTRO_HOLD) { ctx.save(); ctx.fillStyle = '#5a3a1c'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(r.contract.venue, W / 2, H - 22); ctx.restore(); }
  }

  const CEREMONY = 3.2;
  const JUDGE = 5.4; // 판정: 청원 1.2 → 주최자석 1.6 → 판결 1.0 → 집행·퇴장 1.6
  const hasJudge = r.winner !== 'draw';
  const END = r.duration + 1.2 + (hasJudge ? JUDGE : 0) + CEREMONY;
  let ceremonyStarted = false;
  // 미시오 판정: 패배 측의 쓰러진 검투사. 내 검투사는 실제 판정(r.fates), 상대는 연출용 결과
  let judge: { start: number; stage: number; losers: { id: number; live: boolean; x: number; y: number }[] } | null = null;
  // 판정 중에 화면을 두드리면 내 루두스 식솔과 팬들이 함께 "미테!"를 외친다 (연출: 함성·손수건이 늘어난다. 결정은 주최자의 몫)
  canvas.onpointerdown = () => { if (!judge || done || judge.stage > 2) return; crowdCloth = Math.min(1, crowdCloth + 0.12); crowdCheer = 0.7; sfx.chant(1); shouts.length = 0; shouts.push({ text: '미테!  미테!', t: 1.0, x: (Math.random() - 0.5) * 500 }); };
  const judged = new Set<number>(); const judgeLive: Record<number, boolean> = {};
  const bleedAt: { at: number; x: number; y: number; dir: number }[] = [];
  const exits: Record<number, { start: number; dir: 1 | -1 }> = {};
  const fateOf = (id: number) => r.fates.find(f => f.g.id === id)?.fate;
  const hostBonus = HOST[r.contract.host].missio;
  const lap: Record<number, { start: number; dir: 1 | -1 }> = {}; // 한 바퀴 세레모니: 달려갔다 돌아옴
  let ct = 0, lastReal = performance.now(), done = false, lastDtReal = 0.016, frameNo = 0;
  const anim = () => {
    const now = performance.now(); const realRaw = (now - lastReal) / 1000; const real = Math.min(0.05, realRaw); lastReal = now; lastDtReal = real;
    let dt = real;
    if (intro < INTRO_HOLD + INTRO_ZOOM) { intro += Math.min(0.3, realRaw); dt = 0; } // 준비 단계: 실제 경과 시간으로 (프레임이 느려도 제때 줌인)
    else if (ct < slowUntil) dt = real * 0.3;
    if (!done && dt > 0) { ct += dt; fireEvents(ct); flash = flash.filter(f => (f.t -= dt * 1.8) > 0); }
    if (!done && hasJudge && !judge && ct >= r.duration + 1.0) {
      const pos0 = posAt(ct);
      const losers = units.filter(u => u.side !== r.winner && hp[u.g.id] <= 0).map(u => ({ id: u.g.id, live: u.side === 'A' ? fateOf(u.g.id) !== 'dead' : (r.enemyFates.find(f => f.g.id === u.g.id)?.fate ?? 'unharmed') !== 'dead', x: pos0[u.g.id].x, y: pos0[u.g.id].y }));
      judge = { start: ct, stage: 0, losers };
      for (const l of losers) { judged.add(l.id); judgeLive[l.id] = l.live; play(l.id, 'plea', ct); engaged[l.id] = undefined; face[l.id] = l.x < 0 ? 1 : -1; }
      const L0 = losers[0]; zoomAt = { x: L0.x, y: L0.y - 10 }; zoomStart = ct; holdUntil = ct + 1.3; zoomOutDur = 0.5;
      shout('미테!  미테!', L0.x); hostShout = '쓰러진 검투사가 검지를 들어 미시오를 청한다 — 화면을 두드려 함께 외치자'; crowdCloth = 0.4;
    }
    if (judge && !done) {
      const e = ct - judge.start; const py = -floorRy(1) * 1.03;
      if (judge.stage === 0 && e >= 1.2) { judge.stage = 1; hostMood = 'judging'; sfx.drum(2); hostGesture = 'none'; crowdCloth = hostBonus > 0 ? 0.8 : hostBonus < 0 ? 0.2 : 0.5; zoomAt = { x: 0, y: py - 30 }; zoomStart = ct; holdUntil = ct + 1.7; zoomOutDur = 0.5; hostShout = '주최자가 관중의 뜻을 살핀다…'; shout(hostBonus < 0 ? '이우굴라!' : '미테!', 0); }
      if (judge.stage === 1 && e >= 2.0) { judge.stage = 2; shout(hostBonus > 0 ? '미테!  미테!' : '이우굴라!  이우굴라!', 0); }
      if (judge.stage === 2 && e >= 2.8) { judge.stage = 3; const allLive = judge.losers.every(l => l.live); const anyLive = judge.losers.some(l => l.live);
        hostGesture = allLive ? 'cloth' : 'thumb'; crowdCloth = allLive ? 0.9 : 0.1; if (allLive) sfx.cheer(1); else { sfx.boo(); sfx.drum(3); } holdUntil = ct + 1.0; zoomOutDur = 0.5;
        hostShout = allLive ? '주최자가 손을 높이 든다 — 미숨! 살려라' : anyLive ? '주최자가 엄지를 내린다 — 한 명은 살리고, 한 명은…' : '주최자가 엄지를 내린다 — 이우굴라! 죽여라';
        shout(allLive ? '미숨!' : '이우굴라!', 0); }
      if (judge.stage === 3 && e >= 3.8) { judge.stage = 4; const L0 = judge.losers[0]; zoomAt = { x: L0.x, y: L0.y - 10 }; zoomStart = ct; holdUntil = ct + 1.2; zoomOutDur = 0.6;
        const winners = units.filter(u => u.side === r.winner && hp[u.g.id] > 0); const pos1 = posAt(ct);
        judge.losers.forEach((l, i) => {
          if (l.live) { play(l.id, 'rise', ct); exits[l.id] = { start: ct + 1.2 + i * 0.2, dir: (l.x < 0 ? -1 : 1) as 1 | -1 }; }
          else { const w = winners[i % Math.max(1, winners.length)]; if (w) { face[w.g.id] = l.x >= pos1[w.g.id].x ? 1 : -1; play(w.g.id, attackClipFor(w.g.type), ct + 0.1); }
            play(l.id, 'slump', ct + 0.35); bleedAt.push({ at: ct + 0.4, x: l.x, y: l.y, dir: l.x < 0 ? 1 : -1 }); }
        });
        hostShout = judge.losers.every(l => l.live) ? '패자는 부축을 받아 물러난다' : '검투사는 숙명을 받아들인다'; }
    }
    if (!done && !ceremonyStarted && r.winner !== 'draw' && ct >= r.duration + 1.0 + (hasJudge ? JUDGE : 0)) {
      ceremonyStarted = true; hostGesture = 'none'; crowdCloth = 0;
      const winners = units.filter(u => u.side === r.winner && hp[u.g.id] > 0);
      const order = [...CEREMONIES].sort((a, b) => hash01(a.length * 3 + Math.floor(r.duration * 10), 1) - hash01(b.length * 3 + Math.floor(r.duration * 10), 1)); // 경기마다 다른 순서
      winners.forEach((u, i) => { const c = order[i % order.length]; play(u.g.id, c, ct); engaged[u.g.id] = undefined; face[u.g.id] = 1; if (c === 'lap') lap[u.g.id] = { start: ct, dir: (i % 2 ? -1 : 1) as 1 | -1 }; });
      const star = winners[0]; if (star) shout(`${star.g.name.replace('(적)', '')}!  ${star.g.name.replace('(적)', '')}!`, posAt(ct)[star.g.id].x);
      crowdCheer = 999; frenzy = true; sfx.fanfare(); sfx.cheer(1); // 결과 보기까지 관중 전원 열광
      hostMood = r.fameDelta >= 5 ? 'pleased' : 'flat';
      const freed = winners.find(u => r.rudis.includes(u.g));
      if (freed) { const w0 = posAt(ct)[freed.g.id]; palmAt = holdUntil + 0.1; palmTarget = { x: w0.x, y: w0.y + 20 }; palmKind = 'rudis'; hostMood = 'pleased'; hostShout = `주최자가 ${freed.g.name} 에게 루디스를 내린다 — 자유!`; }
      else if (hostMood === 'pleased' && winners.length) { const w0 = posAt(ct)[winners[0].g.id]; palmAt = holdUntil + 0.1; palmTarget = { x: w0.x, y: w0.y + 20 }; hostShout = '주최자가 만족했다'; }
      else hostShout = '주최자는 무표정하다';
      const p0 = winners.length ? posAt(ct)[star!.g.id] : { x: 0, y: 0 }; zoomAt = { x: p0.x, y: p0.y - 10 }; zoomStart = ct; holdUntil = ct + CEREMONY - 0.8; zoomOutDur = 0.8;
    }
    for (let i = bleedAt.length - 1; i >= 0; i--) if (ct >= bleedAt[i].at) { const b = bleedAt[i]; bleed(b.x, b.y, b.dir, 18, 1.3); bleedAt.splice(i, 1); }
    if ((frameNo++ & 7) === 0) setCrowd(0.2 + density * 0.4 + (crowdCheer > 0 ? 0.35 : 0) + (frenzy ? 0.5 : 0));
    draw(ct, Math.max(dt, real * 0.25));
    clock.textContent = intro < INTRO_HOLD + INTRO_ZOOM ? '준비…' : `${Math.min(ct, r.duration).toFixed(1)}s / ${r.duration.toFixed(1)}s`;
    if (!done && ct >= END) { done = true; skip.textContent = '결과 보기'; }
    if (phase === 'battle') requestAnimationFrame(anim);
  };
  anim();
  skip.onclick = () => { if (intro < INTRO_HOLD + INTRO_ZOOM) { intro = INTRO_HOLD + INTRO_ZOOM; return; } stopCrowd(); phase = 'result'; renderResult(); };
}

function renderResult() {
  const r = report!;
  app.replaceChildren();
  const won = r.winner === 'A';
  const net = r.rent - r.expense + r.prize + r.compensation - (r.bet && !r.bet.won ? r.bet.amount : 0);
  const fateBadge = (g: Gladiator) => {
    const f = r.fates.find(x => x.g.id === g.id); const downed = r.downed.some(d => d.id === g.id); const promoted = r.promoted.includes(g);
    const parts: Node[] = [];
    if (f?.fate === 'dead') parts.push(h('span', { class: 'badge dead' }, '사망'));
    else if (f?.fate === 'injured') parts.push(h('span', { class: 'badge injured' }, '부상'));
    else if (downed && !won) parts.push(h('span', { class: 'badge missio' }, '미시오 생존'));
    else if (downed) parts.push(h('span', { class: 'badge missio' }, '쓰러졌으나 무사'));
    else parts.push(h('span', { class: 'badge ok' }, '무사'));
    if (promoted) parts.push(h('span', { class: 'badge promo' }, '★ 베테라누스 승급'));
    if (r.rudis.includes(g)) { parts.push(h('span', { class: 'badge free' }, g.status === 'rudiarius' ? '루디스 — 자유민이 되다' : `루디스 거절 (${g.rudisRefused ?? 0}회째)`));
      if (g.status === 'rudiarius') parts.push(h('button', { class: 'tiny', title: '플람마처럼 자유를 물리고 노예로 남는다. 명예 +8', onclick: () => { void ask(`${g.name} 이(가) 루디스를 거절합니까? 노예로 남고 명예 +8`, { ok: '거절' }).then(ok => { if (ok) { refuseRudis(st, g); renderResult(); } }); } }, '루디스 거절 (명예 +8)')); }
    for (const ne of r.newEpithets.filter(x => x.g === g)) parts.push(h('span', { class: 'badge epithet', title: `${ne.e.cond} → ${ne.e.effect}` }, `별칭 '${ne.e.name}' 획득`));
    for (const so of r.newSkillOffers.filter(x => x.g === g)) parts.push(h('span', { class: 'badge skill', title: '시즌이 끝나고 루두스로 돌아오면 배울지 정합니다' }, `기술 '${SKILL_BY_ID[so.id].name}' 깨침`));
    if (f?.p != null) parts.push(h('span', { class: 'hint' }, ` 생존 확률 ${(f.p * 100).toFixed(0)}%`));
    return parts;
  };
  const myCards = r.team.map(g => h('div', { class: 'fatecard' }, portrait(g, 56), h('div', { class: 'grow' },
    h('div', {}, h('span', { class: 'sq small', style: `background:${TYPE_COLOR[g.type]}` }, glyphSvg(g.type, 14)), ' ', h('span', { class: 'nm' }, g.name)),
    h('div', {}, ...fateBadge(g)))));
  const enemyCards = r.contract.enemy.map(g => { const ef = r.enemyFates.find(f => f.g.id === g.id); const rvName = rivalOf(st.rivals, r.contract.rivalId)?.name ?? '떠돌이 검투사단';
    return h('div', { class: `fatecard enemy${ef ? ' down' : ''}` }, portrait(g, 56, true), h('div', { class: 'grow' },
    h('div', {}, h('span', { class: 'sq small', style: `background:${TYPE_COLOR[g.type]}` }, glyphSvg(g.type, 14)), ' ', h('span', { class: 'nm' }, g.name.replace('(적)', '')), h('span', { class: 'meta' }, ` ${rvName}`)),
    h('div', {}, ef ? h('span', { class: `badge ${ef.fate === 'dead' ? 'dead' : ef.fate === 'injured' ? 'injured' : 'missio'}` }, ef.fate === 'dead' ? '사망' : ef.fate === 'injured' ? '미시오 · 부상' : '미시오 생존') : h('span', { class: 'badge ok' }, won ? '무사' : '승리'),
      r.revenges.some(x => x.enemy.id === g.id) ? h('span', { class: 'badge revenge' }, '복수 성공') : null, r.grudges.some(x => x.enemy.id === g.id) ? h('span', { class: 'badge grudge' }, '원한 재대결') : null))); });
  const money = (label: string, v: number, sign: 1 | -1 = 1) => h('div', { class: 'mrow' }, h('span', {}, label), h('span', { class: v ? (sign > 0 ? 'plus' : 'minus') : '' }, `${sign > 0 ? '+' : '−'}${v.toLocaleString()}`));
  app.append(h('div', { class: 'overlay' }, h('div', { class: 'modal result' },
    h('h2', { style: `color:${won ? 'var(--ok)' : r.winner === 'draw' ? 'var(--dim)' : 'var(--red)'}` }, won ? '승리' : r.winner === 'draw' ? '무승부 (스탄테스 미시)' : '패배', h('span', { class: 'hint', style: 'margin-left:10px;font-weight:400' }, `${r.contract.venue} · ${HOST_KO[r.contract.host]} · ${r.duration.toFixed(1)}초${rivalOf(st.rivals, r.contract.rivalId) ? ` · ${rivalOf(st.rivals, r.contract.rivalId)!.name} (${recordVsMe(rivalOf(st.rivals, r.contract.rivalId)!)})` : ''}`), r.classic ? h('span', { class: 'syn classic', style: 'margin-left:8px' }, '전통 짝 대결') : null),
    h('div', { class: 'rcols' },
      h('div', {}, h('h3', {}, '내 루두스'), ...myCards),
      h('div', {}, h('h3', {}, '상대 파밀리아'), ...enemyCards)),
    h('div', { class: 'mtable' }, money('대여료', r.rent), money('출전 경비', r.expense, -1), money(r.bet?.won ? '승리 상금 (내기 ×2)' : '승리 상금', r.prize), money('사망 배상금', r.compensation), r.salary ? money('자유민 급료', r.salary, -1) : null, r.bet && !r.bet.won ? money('내기 패배', r.bet.amount, -1) : null,
      h('div', { class: 'mrow total' }, h('span', {}, '이번 경기 수지'), h('span', { class: net >= 0 ? 'plus' : 'minus' }, `${net >= 0 ? '+' : '−'}${Math.abs(net).toLocaleString()} HS`)),
      h('div', { class: 'mrow' }, h('span', {}, '호감도' + (r.classic && r.winner === 'A' ? ` (전통 짝 +${CONFIG.fameDelta.classicWin} 포함)` : '')), h('span', { class: r.fameDelta >= 0 ? 'plus' : 'minus' }, `${r.fameDelta >= 0 ? '+' : ''}${r.fameDelta}`))),
    h('details', {}, h('summary', { class: 'hint', style: 'cursor:pointer' }, `전투 기록 보기 (${r.duration.toFixed(1)}초)`), h('div', { class: 'log', style: 'margin-top:6px;max-height:220px' }, r.log.join('\n'))),
    h('div', { class: 'actions' }, h('button', { class: 'primary', onclick: () => { phase = 'battle'; nextFight(); } }, queue.length ? `다음 경기 → (${queue.length}경기 남음)` : '시즌 정산으로 →')))));
}

render();
