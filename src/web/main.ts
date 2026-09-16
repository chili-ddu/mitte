import { S } from './state.js';
import { facilityUpkeep, bedPatient, inBed, putInBed, doSkillTrain, skillTrainable, newGame, available, canFulfill, buy, canBuy, sell, heal, train, fight, fightExpense, refuseAll, isImportant, difficultyOf, upkeepOf, doctorFor, trainGain, mentoredBy, hireDoctor, backToArena, release, rosterCap, healCostOf, trainCap, injurySeasons, upgrade, upgradeCost, cellQuality, gymBonus, swapCells, moveToCell, occupantOf, cellOf, holdEvents, EVENT_KO, EVENT_KEYS, doShow, doRecover, ACTION_KO, palusTrainee, palusOf, putAtPalus, leavePalus, palusTrainees, ORIGIN_KO, renewCost, renewContract, refuseRudis, retrain, rivalOf, rivalStar, recordVsMe, priceOf, mortality, canRetire, retire, successorOptions, succeed, type Action, type SeasonEvents, type Facility, endSeason, validTeam, score, seasonName, SEASON_KO, serialize, deserialize, type GameState, type FightReport } from '../core/game.js';
import { label, sellPrice, rentFee, fansOf, powerOf, TYPE_KO, LINEAGE_KO } from '../core/gladiator.js';
import { CLAUSES, clausesOf, acceptedOf, setClause } from '../core/clauses.js';
import { HOST_KO } from '../core/contracts.js';
import { HOST, FANS_STAR } from '../core/hosts.js';
import { rivalDef } from '../core/rivals.js';
import { accessoriesOf, EPITHETS, EPITHET_BY_ID, type EpithetId } from '../core/epithets.js';
import { SKILLS, SKILL_BY_ID, SKILL_NAME, setForceProc, skillsOf, skillSlots, learnSkill, declineSkill, masteryBonus, isPrimusPalus, procChance, type SkillId } from '../core/skills.js';
import { computeSynergies, describeSynergies, classicMatchup, isClassicPair } from '../core/synergy.js';
import { CONFIG } from '../core/config.js';
import type { HostKind, Contract, Gladiator, GType } from '../core/types.js';
import { sfx, startCrowd, setCrowd, stopCrowd, unlockAudio, soundEnabled, setSoundEnabled } from './sound.js';
import { INK, ENEMY, drawStickman, drawGearRack, drawSeated, clipSkeleton, clipLength, CEREMONIES, attackClipFor, comboClipFor, deathClipFor, isDeathClip, drawNetOverlay, drawNetProjectile, runSkeleton, backstepSkeleton, type ClipName, NPC_POSES, walkSkeleton, type Skeleton, type DrawOpts, type Pose } from './stickman.js';
import { loadoutFor, hasBigShield } from './loadout.js';
import { ARENA, battle } from '../core/battle.js';
import { Rng } from '../core/rng.js';

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
// 세로 기준 논리 무대 400×(600~900)를 기기에 맞춰 배율 조정. 안전 영역(노치·홈 바)은 빼고 잰다. 세로 전용 게임 — PC 나 옆으로 든 폰에서는 폰 모양 무대를 가운데 세운다
const VIEW_W = 440; // 마을 장면의 보이는 폭 (월드 단위): 라니스타 주변만, 이웃 장소는 걸어가서 본다
const STAGE_W = 400, STAGE_H = 800; // 무대 폭 · 기준 높이 (세로 화면에서는 화면 비율대로 600~900, 가로 화면에서는 800 고정)
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
addEventListener('resize', fitStage); addEventListener('orientationchange', () => setTimeout(fitStage, 50)); fitStage();
document.addEventListener('pointerdown', () => unlockAudio(), { capture: true });
const SAVE_KEY = 'lanista-save';
const DEBUG = /[?&]debug/.test(location.search); // 테스트용 버튼(건너뛰기·결과 보기) 표시
if (DEBUG && /[?&]proc/.test(location.search)) setForceProc(true); // ?debug&proc: 기술이 조건만 맞으면 반드시 발동 (연출 확인용)
function loadSave(): GameState | null { try { const raw = localStorage.getItem(SAVE_KEY); return raw ? deserialize(JSON.parse(raw)) : null; } catch { return null; } }
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(serialize(S.st))); } catch { /* 저장 불가 환경 */ } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch {} }
const saved = loadSave();
S.st = saved ?? newGame(Number(location.hash.slice(1)) || Math.floor(Math.random() * 100000));
S.resumed = !!saved;
S.showIntro = !saved && localStorage.getItem('lanista-intro') !== '1';
S.coachOff = localStorage.getItem('lanista-coach') === '1'; // 첫 시즌 안내를 껐는가 (2번째 시즌부터는 자동으로 끝)
// 첫 시즌 안내: 지금 상태에서 다음에 할 일을 한 줄로. 화면 위쪽에 손가락 표시와 함께
function coach(): Node | null {
  if (S.coachOff || S.st.season > 1) return null;
  const assigned = Object.values(S.assign).reduce((a, ids) => a + ids.length, 0);
  let text = '', arrow: 'tabs' | 'plan' | 'go' | 'none' = 'none';
  if (S.phase === 'manage' && S.cellsOpen) text = '방을 누르면 검투사를 옮기고 숙소 질을 올릴 수 있습니다. 집 버튼으로 돌아갑니다.';
  else if (S.phase === 'manage' && S.view === 'market') { text = S.st.roster.length < 3 ? '판매대의 검투사를 누르고 구매하세요. 계약 규모에 맞춰 최소 3명이 편합니다.' : '충분합니다. 위 팻말에서 정문으로 돌아가 편성으로 가세요.'; arrow = S.st.roster.length < 3 ? 'none' : 'tabs'; }
  else if (S.phase === 'manage') { if (S.st.roster.length < 3 && S.st.market.length) { text = '검투사 2명으로 시작합니다. 위 팻말의 시장에서 한 명 더 사 두면 계약을 더 받을 수 있습니다.'; arrow = 'tabs'; } else { text = '아래 \'편성\' 을 눌러 계약에 검투사를 배정합니다. 검투사는 시즌당 한 번만 출전합니다.'; arrow = 'plan'; } }
  else if (S.phase === 'plan') { if (!assigned) { text = '계약 카드를 고른 뒤 아래 검투사를 눌러 배정합니다. 주최자 배지를 길게 누르면 상금·미시오 조건이 보입니다. 배정 안 된 검투사는 훈련·시범을 고르세요.'; } else { text = '아래 \'전투\' 를 누르면 경기가 시작됩니다. 지더라도 관중이 미테!를 외치면 삽니다. 판정 때 화면을 두드려 보세요.'; arrow = 'go'; } }
  else if (S.phase === 'summary') text = '대여료는 승패와 무관하게 받습니다. 다음 시즌엔 왼쪽 아래 집 버튼(켈라)과 의무실·훈련소의 시설도 살펴보세요.';
  if (!text) return null;
  return h('div', { class: `coach ${arrow}` }, h('span', { class: 'hand' }, '☞'), h('span', { class: 'grow' }, text), h('button', { class: 'tiny', title: '안내 끄기', onclick: () => { S.coachOff = true; localStorage.setItem('lanista-coach', '1'); render(); } }, '✕'));
} // 첫 실행: 제목 화면 (관중 함성과 함께)
S.phase = 'manage';
// 편성: 계약별 배정, 미배정 검투사의 훈련 선택
S.assign = {};            // contractId → gladiator ids
S.trainPlan = (() => { try { return JSON.parse(localStorage.getItem('lanista-plan') ?? '{}'); } catch { return {}; } })(); // gladiator id → 시즌 행동 (켈라에서 정한다, 새로고침해도 유지)
const savePlan = () => { try { localStorage.setItem('lanista-plan', JSON.stringify(S.trainPlan)); } catch {} };
const setPlan = (g: Gladiator, a: Action) => { S.trainPlan[g.id] = a; savePlan(); };
const planOf = (g: Gladiator): Action => S.trainPlan[g.id] ?? (g.injured ? 'recover' : 'rest'); // 정하지 않으면 휴식 (부상자는 요양). 훈련은 팔루스에 세워서 하고 무엇을 단련할지는 시즌 끝에 무작위
const rollTraining = (g: Gladiator): 'atk' | 'def' | 'skill' => { const pool: ('atk' | 'def' | 'skill')[] = ['atk', 'def']; if (skillTrainable(S.st, g)) pool.push('skill'); return pool[Math.floor(S.st.rng.next() * pool.length)]; }; // 팔루스에 선 검투사가 단련할 것: 공·방, 기술을 배울 조건이 되면 기술도 후보
S.planSel = null;                    // 편성 중 선택된 계약 id
S.queue = [];
S.skipped = []; // 앞 경기 부상·사망으로 무산된 계약 // 시즌 진행 중 남은 경기
S.marketSel = null;                  // 시장에서 선택한 검투사 id
export type View = 'medic' | 'yard' | 'ludus' | 'market' | 'grave'; // 관리 단계의 장소: 의무실 · 훈련소 · 정문(루두스 문 앞) · 시장. 좁은 화면이라 루두스를 세 장면으로 나눈다
const VIEW_KO: Record<View, string> = { medic: '의무실', yard: '훈련소', ludus: '포룸', market: '시장', grave: '묘지' }; // ludus = 포룸(광장): 정문 밖 광장에서 계약·지원자·소식
S.view = 'ludus';
S.travel = null; // 이동 전환 중
S.seasonReports = [];
S.seasonSummary = null;
S.report = null;
S.notice = '';
S.sheet = null; // news·market·medic·yard·applicants: 대시보드를 대신하는 서랍 // glad: 켈라 방을 누르면 여는 검투사 카드 시트 (검투사 목록 시트를 대신한다)
S.gladSel = null; // 검투사 시트에 보이는 검투사 id
S.detail = null; // solo: 장면에서 바로 연 확인 페이지 (밑에 상세 없음, 닫으면 장면으로) // confirm: 매각·내보내기·구매는 오른쪽으로 한 번 더 넘어가는 확인 페이지
S.cellDrag = null; // 켈라에서 스틱맨을 끌어 방을 바꾼다 (캔버스 좌표) // 검투사 상세 페이지 (오른쪽에서 밀려 들어옴). roster: 내 검투사, market: 시장 노예
S.cellSel = 0; // 켈라에서 고른 칸
S.cellSide = null; // 가로 배치: 켈라가 열려 있을 때 오른쪽 칸에 무엇을 보일지 (검투사 시트 / 빈 방 / 안내)
S.cellPop = null; // fresh: 처음 열릴 때만 펼침 애니메이션 // 켈라 팝오버: 누른 방의 화면 좌표(중심)에서 펼쳐진다
S.cellsOpen = false; S.cellsP = 0;
S.bedPick = null; // 빈 침상을 눌러 켈라에서 부상자를 고르는 중 (침상 번호)
S.palusMode = false; // 팔루스 배정 모드: 훈련소에서 기둥을 누르면 켈라가 열리고, 방을 누르면 빈 팔루스에 세우고 다시 누르면 내려온다 (자리는 고르지 않는다)
S.offerPage = 0; // 새 기술 모달: 보고 있는 검투사 순번 // 켈라 화면: 디스플레이 아래에서 위로 올라온다 (0~1) // 화면 위에 여는 시트(모달). 스크롤 대신 시트로 상세를 본다
const hintSpan = (t: string) => h('span', { class: 'hint', style: 'text-transform:none;letter-spacing:0;margin-left:8px' }, t);
// 확인 창: 브라우저 confirm/alert 대신 게임 안 모달 (폰에서도 같은 모양, 화면 재구성과 무관하게 body 에 붙는다)
function ask(msg: string, opts: { ok?: string; cancel?: boolean; title?: string } = {}): Promise<boolean> {
  return new Promise(res => {
    const close = (v: boolean) => { ov.remove(); res(v); };
    const ov = h('div', { class: 'overlay', onclick: (ev: Event) => { if (ev.target === ev.currentTarget) close(false); } },
      h('div', { class: 'modal ask' }, opts.title ? h('h2', {}, opts.title) : null, ...msg.split('\n').map(l => l.startsWith('· ') ? h('p', { class: 'fx' }, l.slice(2)) : h('p', {}, l)), // '· ' 로 시작하는 줄은 효과 설명 (다른 색)
        h('div', { class: 'actions' }, opts.cancel === false ? null : h('button', { onclick: () => close(false) }, '취소'), h('button', { class: 'primary', onclick: () => close(true) }, opts.ok ?? '확인'))));
    document.body.append(ov); (ov.querySelector('button.primary') as HTMLButtonElement).focus();
  });
}
const tell = (msg: string, title?: string) => ask(msg, { cancel: false, title });
// ? 아이콘: 누르면 자세한 설명 모달. 화면에는 짧은 말만 남긴다
const helpBtn = (title: string, body: string) => { const b = h('button', { class: 'qmark', title: '설명', onclick: (ev: Event) => { ev.stopPropagation(); void tell(body, title); } });
  b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>'; return b; }; // 인라인 SVG (Lucide circle-help 형태), 파일 요청 없음
// 커스텀 드롭다운: 네이티브 select 는 펼친 목록을 꾸밀 수 없어서 버튼 + 목록으로 만든다. 열림 상태는 key 로 기억 (render 가 다시 그려도 유지)
S.ddOpen = null;
document.addEventListener('pointerdown', (ev) => { if (S.ddOpen && !(ev.target as Element).closest?.('.dd')) { S.ddOpen = null; document.querySelectorAll('.dd.open').forEach(d => d.classList.remove('open')); } }, { capture: true });
function dropdown(key: string, options: { value: string; label: string }[], value: string, onPick: (v: string) => void, placeholder = ''): Node {
  const cur = options.find(o => o.value === value);
  const wrap = h('div', { class: `dd${S.ddOpen === key ? ' open' : ''}` });
  const btn = h('button', { class: 'ddbtn', onclick: (ev: Event) => { ev.stopPropagation(); S.ddOpen = S.ddOpen === key ? null : key; wrap.classList.toggle('open', S.ddOpen === key); } }, h('span', { class: 'ddarrow' }), cur ? cur.label : placeholder); // 화살표는 글자 앞
  const list = h('div', { class: 'ddlist' }, ...options.map(o => h('div', { class: `ddopt${o.value === value ? ' on' : ''}`, onclick: (ev: Event) => { ev.stopPropagation(); S.ddOpen = null; onPick(o.value); } }, o.label)));
  wrap.append(btn, list); return wrap;
}
// 헤더의 설정(톱니바퀴) 버튼: 메뉴 시트 (인라인 SVG, Lucide settings 형태)
function gearBtn(): Node { const b = h('button', { class: `gear${S.sheet === 'menu' ? ' on' : ''}`, title: '메뉴', onclick: () => { S.sheet = S.sheet === 'menu' ? null : 'menu'; render(); } });
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
// 접이식 패널: 열림 상태를 기억한다
function foldPanel(key: string, title: string, hint: string, ...kids: (Node | null)[]): Node {
  const open = localStorage.getItem(`lanista-open-${key}`) !== '0';
  const d = h('details', { class: 'panel fold', style: 'margin-bottom:10px' }, h('summary', {}, h('h2', {}, title, h('span', { class: 'hint', style: 'text-transform:none;letter-spacing:0;margin-left:8px' }, hint))), ...kids) as HTMLDetailsElement;
  if (open) d.setAttribute('open', '');
  d.addEventListener('toggle', () => localStorage.setItem(`lanista-open-${key}`, d.open ? '1' : '0'));
  return d;
}
S.eventPlan = { cena: false, pompa: false, votum: false, edicta: false, guests: false }; // 편성 화면에서 고른 시즌 행사 // 대시보드 맨 위에 한 번 보여줄 알림

const h = (tag: string, attrs: Record<string, any> = {}, ...kids: (Node | string | null | undefined)[]) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v === false || v == null || v === '') continue; if (k === 'class') el.className = v; else if (k.startsWith('on')) (el as any)[k] = v; else if (k === 'title') el.setAttribute('data-tip', v); /* title → 탭·호버 말풍선 (폰에서는 title 이 안 보인다) */ else el.setAttribute(k, v === true ? '' : v); }
  for (const k of kids) if (k != null) el.append(k);
  return el;
};
// ── 말풍선(툴팁): data-tip 이 있는 요소를 폰에서 길게 누르거나(450ms), 버튼이 아닌 요소는 탭하면, PC 에서는 마우스를 올리면 보인다
S.tipEl = null; S.tipFor = null; S.tipTimer = 0; S.tipSuppressClick = false;
function showTip(target: Element) {
  const text = target.getAttribute('data-tip'); if (!text) return;
  hideTip(); S.tipFor = target; const el = h('div', { class: 'tip' }, ...text.split('\n').map(l => h('div', {}, l))); document.body.append(el); S.tipEl = el;
  const r = target.getBoundingClientRect(); el.style.maxWidth = Math.min(280, innerWidth - 16) + 'px'; const w = el.offsetWidth;
  const left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)); el.style.left = left + 'px';
  const hd = document.querySelector('#app.land > header')?.getBoundingClientRect(); const above = r.top - el.offsetHeight - 8 > (hd ? hd.bottom : 0) + 4; el.style.top = (above ? r.top - el.offsetHeight - 8 : r.bottom + 8) + 'px'; el.classList.toggle('below', !above); // 위에 자리가 있어도 헤더를 가리면 아래로 (헤더 밑 토글 줄)
  el.style.setProperty('--ax', (r.left + r.width / 2 - left) + 'px');
}
function hideTip() { if (S.tipEl) { S.tipEl.remove(); S.tipEl = null; } S.tipFor = null; }
const tipTarget = (ev: Event) => (ev.target as Element).closest?.('[data-tip]') as Element | null;
const isAction = (el: Element) => !!el.closest('button, a, select, .card, .drow, .slot, .ddopt, .gtile');
const isChip = (el: Element) => el.matches('.badge, .eff, .tile, .tierchip, .host, .rank, .stars') && !el.closest('button');
document.addEventListener('pointerdown', (ev) => { hideTip(); clearTimeout(S.tipTimer); const t = tipTarget(ev); if (!t) return;
  if (ev.pointerType === 'mouse') return; // 마우스는 호버로
  S.tipTimer = window.setTimeout(() => { showTip(t); S.tipSuppressClick = true; }, 450); }, { capture: true });
document.addEventListener('pointerup', () => clearTimeout(S.tipTimer), { capture: true });
document.addEventListener('pointercancel', () => clearTimeout(S.tipTimer), { capture: true });
document.addEventListener('click', (ev) => { if (S.tipSuppressClick) { S.tipSuppressClick = false; ev.stopPropagation(); ev.preventDefault(); return; } // 길게 눌러 말풍선을 봤으면 그 클릭은 동작하지 않는다
  const t = tipTarget(ev); if (t && (!isAction(t) || (isChip(t) && !t.closest('.card.contract.detail')))) { showTip(t); ev.stopPropagation(); } }, { capture: true }); // 칩(배지·효과 칩·타일)은 카드 안에 있어도 탭하면 말풍선 — 단 계약 광고 카드에서는 탭이 카드를 여는 게 우선 (설명은 길게 누르기·호버)
// 마우스: 같은 대상 안에서 자식(아이콘·배지) 사이를 오가도 말풍선을 다시 만들지 않고, 대상 밖으로 나갈 때만 지운다 (깜박임 방지)
document.addEventListener('mouseover', (ev) => { if (matchMedia('(hover: none)').matches) return; const t = tipTarget(ev); if (t && t !== S.tipFor) showTip(t); });
document.addEventListener('mouseout', (ev) => { const t = tipTarget(ev); if (!t) return; const to = (ev as MouseEvent).relatedTarget as Element | null; if (to && t.contains(to)) return; hideTip(); });
addEventListener('scroll', hideTip, { capture: true });
const sq = (t: GType) => h('span', { class: 'sq', style: `background:${TYPE_COLOR[t]}` }, glyphSvg(t));

// ── 스틱맨 초상: 작은 캔버스에 장비 갖춘 스틱맨. 살아 움직이는 초상들은 공용 루프가 갱신
const portraits = new Set<{ c: HTMLCanvasElement; g: Gladiator; pose: 'idle' | 'sit'; enemy?: boolean; enter?: number; lastStep?: number; fixed?: { pose?: Pose; skeleton?: Skeleton } }>();
function portrait(g: Gladiator, size = 64, enemy = false, fixed?: { pose?: Pose; skeleton?: Skeleton }, hgt = size) { // fixed: 결과 화면처럼 정해진 자세(승리·패배·시신)로 그린다. hgt: 세로가 더 긴 초상(상세)은 폭·높이를 따로
  const c = document.createElement('canvas'); c.width = size * devicePixelRatio; c.height = hgt * devicePixelRatio; c.style.width = size + 'px'; c.style.height = hgt + 'px'; c.className = 'portrait';
  const entry = { c, g, pose: (g.injured ? 'sit' : 'idle') as 'idle' | 'sit', enemy, enter: 0, lastStep: -1, fixed }; // enter: 걸어 들어오는 연출 시작 시각(0 이면 없음)
  portraits.add(entry); drawPortrait(entry, 0);
  return c;
}
function drawPortrait(e: { c: HTMLCanvasElement; g: Gladiator; pose: 'idle' | 'sit'; enemy?: boolean; enter?: number; lastStep?: number; fixed?: { pose?: Pose; skeleton?: Skeleton } }, t: number) {
  const ctx = e.c.getContext('2d')!; const W = e.c.width / devicePixelRatio, S = e.c.height / devicePixelRatio; // S: 높이 (인물 크기·발 위치 기준), W: 폭 (가운데 맞춤)
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); ctx.clearRect(0, 0, W, S);
  ctx.fillStyle = '#e3d3a6'; ctx.fillRect(0, 0, W, S); ctx.fillStyle = '#cbb67f'; ctx.fillRect(0, S - 8, W, 8);
  const team = e.enemy ? ENEMY : e.g.rank === 'veteranus' ? '#2c4f9b' : '#6e7f9b';
  const sc0 = 0.68 * (S / 64); // 초상 크기에 비례 (상세 페이지의 큰 초상은 2배 이상)
  const ENTER = 1.1; const el = e.enter ? (performance.now() - e.enter) / 1000 : ENTER; // 걸어 들어오기: 왼쪽 밖에서 가운데까지 1.1초
  if (el < ENTER) { const k = el / ENTER, ease = 1 - Math.pow(1 - k, 2); const x = -30 * sc0 + (W / 2 - 2 + 30 * sc0) * ease; const walk = walkSkeleton(el * 9, 1);
    drawStickman(ctx, e.g.type, { x, y: S - 6, scale: sc0, skeleton: walk, t, team, accessories: accessoriesOf(e.g), facing: 1 });
    const stepNo = Math.floor(el * 4.5); if (stepNo !== e.lastStep) { e.lastStep = stepNo; if (stepNo > 0) sfx.step(); } return; } // 발소리 (반 걸음마다)
  if (e.fixed) { const sc = sc0 * 0.82; const dx = e.fixed.skeleton ? W * 0.22 : 0; drawStickman(ctx, e.g.type, { x: W / 2 - 2 + dx, y: S - 8, scale: sc, pose: e.fixed.pose, skeleton: e.fixed.skeleton, t, team, accessories: accessoriesOf(e.g) }); return; } // 정해진 자세 (결과 화면): 조금 작게, 시신은 왼쪽으로 눕는 만큼 오른쪽으로 밀어 틀 안에
  drawStickman(ctx, e.g.type, { x: W / 2 - 2, y: S - 6, scale: sc0, pose: e.pose === 'sit' ? 'idle' : 'idle', t, team, accessories: accessoriesOf(e.g) }); // 투구 볏이 잘리지 않게
  if (e.pose === 'sit') { // 치료 중: 장비 상태 그대로, 치료 표시만 (팔 붕대 + 모서리 붕대 마크)
    const sc = sc0, ax = S / 2 - 2 + 6 * sc, ay = S - 6 - 34 * sc; // 앞팔 위팔 근처
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
S.portraitLoop = false;
function startPortraitLoop() {
  if (S.portraitLoop) return; S.portraitLoop = true;
  const tick = () => { const t = performance.now() / 1000; for (const e of portraits) { if (!e.c.isConnected) { portraits.delete(e); continue; } drawPortrait(e, t); } for (const e of talkScenes) { if (!e.c.isConnected) { talkScenes.delete(e); continue; } drawTalkScene(e, t); } requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
startPortraitLoop();

const ORIGIN_SHORT: Record<string, string> = { captive: '포로', damnatus: '죄수', auctoratus: '자유민 계약' };
function originBadge(g: Gladiator): Node | null {
  if (!g.origin || g.origin === 'slave') return null;
  const O = CONFIG.origins;
  const tip = g.origin === 'captive' ? `전쟁 포로: 값이 싸고 강하지만 관중이 냉담해 미시오 ${Math.round(O.captive.missio * 100)}%` : g.origin === 'damnatus' ? `형벌 죄수: 매우 싸고 약함. 사망 배상 절반, ${O.damnatus.freeAfter}시즌(3년) 뒤 형기 만료로 자유` : `자유민 계약자: 계약금만 내고 데려오며 급료(대여료의 ${Math.round(CONFIG.rudiariusShare * 100)}%)를 받음. ${O.auctoratus.term}시즌 계약`;
  const left = g.origin === 'auctoratus' && g.contractUntil != null ? ` ${Math.max(0, g.contractUntil - S.st.season + 1)}시즌` : g.origin === 'damnatus' && g.boughtSeason != null && (g.status ?? 'slave') === 'slave' ? ` ${Math.max(0, O.damnatus.freeAfter - (S.st.season - g.boughtSeason + 1))}시즌` : '';
  return h('span', { class: `badge origin ${g.origin}`, title: tip }, ORIGIN_SHORT[g.origin] + left);
}
// 계약 상대 설명: 파밀리아 이름 + 이름(유형·전적). 원한·복수 관계 표시
function enemyLine(c: Contract): Node {
  const rv = rivalOf(S.st.rivals, c.rivalId);
  const parts: (Node | string)[] = [h('b', {}, rv ? rv.name : '타지 라니스타의 검투사'), rv ? h('span', { class: 'hint' }, ` (${recordVsMe(rv)}) `) : '', ': '];
  const star = rv ? rivalStar(rv) : undefined;
  c.enemy.forEach((e, i) => { parts.push(i ? ', ' : '', sq(e.type), ' ', `${e.name.replace('(적)', '')} (${e.rank === 'tiro' ? '티로' : '베테'} ${e.wins}승/${e.fights}전${(e.honor ?? 0) >= 30 ? ` · 명예 ${e.honor}` : ''}${(e.skills ?? []).length ? ` · 기술 ${(e.skills ?? []).map(SKILL_NAME).join('·')}` : ''})`); if (star && star.id === e.id && ((star.honor ?? 0) >= 20 || star.wins >= 5)) parts.push(' ', h('span', { class: 'badge star', title: '이 파밀리아의 간판 검투사' }, '간판'));
    const spBy = S.st.roster.filter(g => (g.spared ?? []).includes(e.id)), beat = S.st.roster.filter(g => (g.beatenBy ?? []).includes(e.id));
    if (spBy.length) parts.push(' ', h('span', { class: 'badge grudge', title: `${spBy.map(g => g.name).join(', ')} 이(가) 살려 준 자. 재대결이면 공격 +10%, 그에게 지면 미시오 −15% (우르비쿠스의 경고)` }, `원한 ← ${spBy.map(g => g.name).join(', ')}`));
    if (beat.length) parts.push(' ', h('span', { class: 'badge revenge', title: `${beat.map(g => g.name).join(', ')} 을(를) 쓰러뜨린 자. 꺾으면 복수 (명예 +8, '복수자')` }, `복수 기회 → ${beat.map(g => g.name).join(', ')}`)); });
  return h('div', { class: 'meta enemyline' }, ...parts);
}
const hostPrize = (c: Contract) => Math.round(CONFIG.prizePerTier * c.tier * HOST[c.host].prize);
const hostSpan = (c: Contract) => { const H = HOST[c.host]; return h('span', { class: `host ${c.host}`, title: `${H.ko}: ${H.desc}\n상금 ×${H.prize} · 대여료 ×${H.rent} · 미시오 ${H.missio >= 0 ? '+' : ''}${Math.round(H.missio * 100)}% · 루디스 ${H.rudis >= 0 ? '+' : ''}${Math.round(H.rudis * 100)}%${H.fameWin ? ` · 승리 호감도 +${H.fameWin}` : ''}${H.honorAll ? ` · 출전자 명예 +${H.honorAll}` : ''}${H.bet ? ' · 내기 가능' : ''}` }, H.ko); };
function skillBadges(g: Gladiator): Node[] {
  return skillsOf(g).map(id => { const d = SKILL_BY_ID[id]; const mb = masteryBonus(g, id); return h('span', { class: 'badge skill', title: `${d.name}: ${d.desc} 발동 ${Math.round(procChance(g, id) * 100)}%${mb ? ` (숙련 +${Math.round(mb * 100)}%)` : ''}` }, d.name); });
}
// 배울 기회: 배우기 / 넘기기. 슬롯이 차 있으면 '배우기'를 누른 뒤 배운 기술 중 버릴 것을 고른다
function skillOfferRows(g: Gladiator, after: () => void = render, opts: { noDecline?: boolean } = {}): Node[] { // noDecline: 넘기기 버튼은 모달 페이징 줄 오른쪽에 하나만
  const offers = (g.skillOffers ?? []) as SkillId[]; if (!offers.length) return [];
  const slots = skillSlots(g), have = skillsOf(g);
  return offers.map(id => { const d = SKILL_BY_ID[id]; const full = have.length >= slots;
    const row = h('div', { class: 'offer' }, h('div', { class: 'grow' }, h('b', {}, `새 기술 '${d.name}'`), h('span', { class: 'meta' }, ` ${d.desc}`)));
    if (full) { // 슬롯이 찼으면 바로 교체 목록: 배운 기술 중 하나를 버리고 배운다 (넘기면 제안 포기)
      row.append(h('div', { class: 'replace' },
        h('div', { class: 'rhead' }, h('span', { class: 'meta' }, `슬롯이 찼습니다 (${have.length}/${slots}). 버릴 기술을 고르세요`), opts.noDecline ? null : h('button', { class: 'small', onclick: (ev: Event) => { ev.stopPropagation(); declineSkill(g, id); after(); } }, '넘기기')),
        ...have.map(x => { const dx = SKILL_BY_ID[x]; const mb = masteryBonus(g, x); return h('div', { class: 'ritem' },
          h('div', { class: 'grow' }, h('div', {}, h('b', {}, dx.name), h('span', { class: 'meta' }, ` 발동 ${Math.round(procChance(g, x) * 100)}%${mb ? ` (숙련 +${Math.round(mb * 100)}%)` : ''}`)), h('div', { class: 'meta desc' }, dx.desc)),
          h('button', { class: 'primary small', onclick: (ev: Event) => { ev.stopPropagation(); if (learnSkill(g, id, x)) { sfx.coin(); after(); } } }, '교체하기')); })));
    } else {
      row.append(h('button', { class: 'primary', onclick: (ev: Event) => { ev.stopPropagation(); if (learnSkill(g, id)) { sfx.coin(); after(); } } }, '배우기')); if (!opts.noDecline) row.append(h('button', { onclick: (ev: Event) => { ev.stopPropagation(); declineSkill(g, id); after(); } }, '넘기기'));
    }
    return row; });
}
function epithetBadges(g: Gladiator, withSkills = true): Node[] {
  const sc = g.scaeva ? [h('span', { class: 'badge scaeva', title: '왼손잡이(스카이바): 타고난 특성. 상대 방패의 첫 타격 감소를 절반으로 만든다 (비문에 따로 표기될 만큼 귀했다)' }, '왼손잡이')] : [];
  return [...sc, ...(withSkills ? skillBadges(g) : []), ...(g.epithets ?? []).map(id => { const e = EPITHET_BY_ID[id as EpithetId]; return e ? h('span', { class: 'badge epithet', title: `${e.latin} · ${e.cond} → ${e.effect}${e.attested ? ' (실제 기록)' : ''}` }, `'${e.name}'`) : null; }).filter((n): n is HTMLElement => !!n)];
}
function gladCard(g: Gladiator, extra: (Node | null)[] = [], opts: { sel?: boolean; other?: boolean; dis?: boolean; onclick?: () => void; tag?: Node | null } = {}) {
  return h('div', { class: `card${opts.sel ? ' sel' : ''}${opts.other ? ' other' : ''}${opts.dis ? ' dis' : ''}`, onclick: opts.onclick },
    portrait(g, 56),
    h('div', { class: 'grow' },
      h('div', {}, h('span', { class: `rank ${g.rank}`, title: g.rank === 'tiro' ? `티로: 신참. ${CONFIG.promoteWins}승을 채우면 베테라누스` : '베테라누스: 승리를 쌓은 경험자. 큰 경기의 필수 요건' }, g.rank === 'tiro' ? '티로' : '베테'), g.status === 'rudiarius' ? h('span', { class: 'badge free', title: '루디스를 받은 자유민. 계약으로 출전하며 출전마다 급료를 받는다. 팔 수 없다' }, '자유민') : g.status === 'doctor' ? h('span', { class: 'badge doc', title: '교관. 출전하지 않고 같은 유형 훈련을 돕는다' }, '독토르') : null, g.status !== 'doctor' && mentoredBy(S.st, g) ? h('span', { class: 'badge mentor', title: '독토르에게 유형 기술을 전수받음' }, '기술 전수') : null, originBadge(g), ' ', h('span', { class: 'sq small', style: `background:${TYPE_COLOR[g.type]}` }, glyphSvg(g.type, 14)), ' ', h('span', { class: 'nm' }, g.name), ' ', ...epithetBadges(g), h('span', { class: 'meta' }, `${TYPE_KO[g.type]} · ${LINEAGE_KO[g.lineage]} · ${g.age ?? '?'}세`), opts.tag ?? null),
      h('div', { class: 'meta' }, `HP ${g.base.hp}  공 ${g.base.atk}  방 ${g.base.def}  |  ${g.wins}승/${g.fights}전  미시오 ${g.missios}  명예 ${g.honor ?? 0}  팬 ${fansOf(g)}${fansOf(g) >= FANS_STAR ? '★' : ''}${g.injured ? '  ⚠ 부상' : ''}${g.fought ? '  ✓ 출전 완료' : ''}${(g.fatigue ?? 0) > 0 ? `  피로 ${g.fatigue} (공·방 −${(g.fatigue ?? 0) * CONFIG.fatigue.statPenalty})` : ''}${g.trained ? '  훈련함' : ''}`)),
    ...extra);
}

// 헤더(라니스타·자금·호감도·검투사 수·톱니바퀴): 관리·편성·전투·결과 화면이 같이 쓴다
const headerBox = h('header', {}) as HTMLElement; // 한 번 만들고 내용만 바꾼다 (매번 새로 만들면 고정 헤더가 깜박인다)
// 호감도: 숫자 대신 월계관 단계 (사용자 결정). 잎이 찬 쌍 = 단계. 문턱은 규칙의 문턱 그대로 — 25 등급 2 계약 · 50 승리 값 체감·파밀리아 강화 · 60 등급 3 계약·명성 유지비 · 80 정점(망각 최대). 숫자는 툴팁에
const FAME_STAGES: [number, string][] = [[0, '무명'], [25, '벽에 이름'], [50, '거리의 화제'], [60, '이름을 날림'], [80, '캄파니아의 자랑']]; // 낙서 계열: 폼페이 벽에 이름이 적히기 시작해 온 지방의 자랑이 되기까지
function fameMeter(): Node {
  const f = S.st.fame; let s = 0; for (let i = 0; i < FAME_STAGES.length; i++) if (f >= FAME_STAGES[i][0]) s = i;
  const next = FAME_STAGES[s + 1]; const gold = s === FAME_STAGES.length - 1;
  const leaves: string[] = []; // 아래 매듭에서 양쪽으로 올라가는 잎 4쌍 (위는 열린 관). 찬 쌍 = 단계
  for (let i = 0; i < 4; i++) for (const side of [-1, 1]) { const a = (270 + side * (i + 1) * 38) * Math.PI / 180; const x = 12 + 8 * Math.cos(a), y = 12 - 8 * Math.sin(a); const rot = -(a * 180 / Math.PI) - 90 * side;
    leaves.push(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="2.6" ry="1.4" transform="rotate(${rot.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${i < s ? (gold ? '#c9a227' : '#4e8a3a') : 'none'}" stroke="${i < s ? (gold ? '#8a6a12' : '#2c5a1e') : '#8a7a56'}" stroke-width="1"/>`); }
  const ico = h('span', { class: `wreath${gold ? ' gold' : ''}` }); ico.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22"><path d="M8.5 20.5 Q12 22.5 15.5 20.5" fill="none" stroke="#8a7a56" stroke-width="1.2"/>${leaves.join('')}</svg>`; // 아래 매듭 리본
  return h('span', { class: 'stat fame', title: `호감도 ${f} · ${FAME_STAGES[s][1]}${next ? ` — ${next[0]}부터 '${next[1]}'` : ''}. 문턱: 25 등급 2 계약 · 50 파밀리아 강화 · 60 등급 3 계약·명성 유지비 · 80 정점` }, ico, FAME_STAGES[s][1]);
}
function headerEl(): Node {
  headerBox.replaceChildren(
    h('div', { class: 'hrow' }, h('span', { class: 'stat', title: S.st.lanista.trait === 'doctor' ? `전직 독토르 (${TYPE_KO[S.st.lanista.type!]} 훈련 +1)` : S.st.lanista.trait === 'freedman' ? '해방노예 출신 (시장 10% 할인)' : '창업자' }, S.st.lanista.name, h('span', {}, ` ${S.st.lanista.age}세`)), fameMeter(), h('span', { style: 'flex:1' }), h('span', { class: 'stat season' }, `${Math.floor((S.st.season - 1) / 4) + 1}년차`, seasonIcon(S.st.season))),
    h('div', { class: 'hrow' }, h('span', { class: 'stat' }, `${S.st.money.toLocaleString()} HS`, h('span', {}, ` 유지비 ${upkeepOf(S.st).toLocaleString()}`)), h('span', { style: 'flex:1' }),
      newsBtn(), gearBtn()));
  return headerBox;
}
// 준비 화면 대시보드 높이: 화면에 그린 뒤 남는 높이를 재서 하단 바 바로 위까지 채운다 (창 크기가 바뀌면 다시)
function fitDash() {
  const body = document.querySelector<HTMLElement>('.dash .dashbody'); const bar = document.querySelector<HTMLElement>('.tabbar'); if (!body) return;
  const top = body.getBoundingClientRect().top; const barH = bar ? bar.getBoundingClientRect().height : 58;
  body.style.height = `${Math.max(140, Math.floor(innerHeight - top - barH - 8))}px`; // 8 = 바 위 여백. 페이지는 스크롤되지 않고 대시보드 안에서만 스크롤
}
window.addEventListener('resize', () => { if (S.phase === 'manage') fitDash(); });
function render() {
  save();
  // 장면 패널이 닫힐 때(토글 해제·다른 토글·켈라 열기·상세로 이동): 켈라처럼 아래로 내려가며 사라지게, 옛 패널 노드를 잠시 남겨 둔다
  const oldPanel = app.querySelector('.scenepanel:not(.closing)') as HTMLElement | null; const oldKey = oldPanel ? [...oldPanel.classList].find(c => c.startsWith('key-'))?.slice(4) : null;
  const stillClosing = [...app.querySelectorAll('.scenepanel.closing')] as HTMLElement[];
  app.replaceChildren(); app.classList.remove('fit'); app.classList.remove('land', 'plan', 'battle', 'page');
  app.append(headerEl()); requestAnimationFrame(() => { document.documentElement.style.setProperty('--head-h', `${headerBox.offsetHeight}px`); const tl = app.querySelector<HTMLElement>('.sidetools.inland'); document.documentElement.style.setProperty('--top-h', `${tl && tl.offsetHeight ? tl.offsetTop + tl.offsetHeight : headerBox.offsetTop + headerBox.offsetHeight}px`); }); // 헤더(두 줄)와 그 아래 토글 줄의 바닥 높이. 시트·상세는 이 아래에서 시작한다
  const curKey = S.cellsOpen ? 'cells' : S.sheet; const stillOpen = !!oldPanel && oldKey === curKey; // 같은 시트가 열린 채 다시 그리는 것이면 내려오는 모션을 되풀이하지 않는다 (팔루스·침상 누르면 켈라가 두 번 내려오던 것)
  if (oldPanel && S.phase === 'manage' && oldKey !== curKey) { /* 켈라도 시트의 하나(key-cells) */ oldPanel.classList.add('closing'); stillClosing.push(oldPanel); window.setTimeout(() => oldPanel.remove(), 380); }
  for (const n of stillClosing) app.append(n);
  const SCENE_KEYS = ['facilities', 'doctors', 'rivals', 'news', 'market', 'applicants', 'chronicle'] as const; type SceneKey = typeof SCENE_KEYS[number];
  if (S.sheet && S.phase === 'manage' && (SCENE_KEYS as readonly string[]).includes(S.sheet)) { // 준비 화면: 모달 대신 장면 안에서 켈라처럼 올라오는 패널. 왼쪽 토글로 오간다
    const key = S.sheet as SceneKey; const body = renderSheetBody(); const nodes = body.filter((n): n is Node => !!n);
    let h2: Element | null = null; for (const n of [...nodes].reverse()) { if (n instanceof HTMLElement) { h2 = n.tagName === 'H2' ? n : n.querySelector('h2'); if (h2) break; } }
    app.append(h('div', { class: `scenepanel key-${key}${stillOpen ? ' still' : ''}` }, h('div', { class: 'eave' }, h2 ?? h('h2', {}, ''), h('button', { class: 'close', title: '닫기', 'aria-label': '닫기', onclick: () => { S.sheet = null; render(); } }, '✕')), h('div', { class: 'sheetbody' }, ...nodes.filter(n => n !== h2)))); // 켈라와 같은 틀: 제목 띠 오른쪽에 닫기 — 토글 서판이 없는 시트(지원자·시장·소식·의무실·훈련소)는 세로 무대에서 장면을 덮어 달리 닫을 길이 없었다
  } else if (S.sheet) app.append(renderSheet());
  if (S.phase === 'manage' && !S.showIntro && !S.st.pendingSuccession) { // 새 기술 깨침: 루두스로 돌아오면 배울지 정한다 (배우기/넘기기 중 하나로 끝낸다)
    const learners = S.st.roster.filter(g => (g.skillOffers ?? []).length);
    if (learners.length) { // 한 명씩 보여주고 ◀ ▶ 로 넘긴다
      S.offerPage = Math.max(0, Math.min(S.offerPage, learners.length - 1)); const g = learners[S.offerPage];
      app.append(h('div', { class: 'overlay' }, h('div', { class: 'modal offers' },
        h('h2', {}, '새 기술을 깨쳤다', helpBtn('기술 배우기', '경기 경험이나 기술 훈련으로 깨친 기술입니다. 배우면 슬롯을 하나 쓰고(티로 1 · 베테라누스 2 · 프리무스 팔루스 3), 슬롯이 차 있으면 배운 기술 중 버릴 것을 골라 바꿉니다. 넘기면 이 기회는 사라지지만 나중에 다시 깨칠 수 있습니다.')),
        h('div', { class: 'card' }, portrait(g, 48), h('div', { class: 'grow' }, h('div', {}, sq(g.type), ' ', h('b', {}, g.name), h('span', { class: 'meta' }, ` ${TYPE_KO[g.type]} · ${g.rank === 'tiro' ? '티로' : isPrimusPalus(g) ? '프리무스 팔루스' : '베테라누스'}`)),
          h('div', { class: 'meta' }, `배운 기술 ${skillsOf(g).length}/${skillSlots(g)}: `, ...(skillsOf(g).length ? skillBadges(g) : ['없음'])), ...skillOfferRows(g, render, { noDecline: true }))),
        h('div', { class: 'actions pager' },
          h('button', { disabled: S.offerPage <= 0, onclick: () => { S.offerPage--; render(); } }, '◀'),
          h('span', { class: 'meta' }, `${S.offerPage + 1} / ${learners.length}`),
          h('button', { disabled: S.offerPage >= learners.length - 1, onclick: () => { S.offerPage++; render(); } }, '▶'),
          h('span', { style: 'flex:1' }),
          h('button', { onclick: () => { for (const id of [...(g.skillOffers ?? [])]) declineSkill(g, id as SkillId); render(); } }, '넘기기'))))); // 넘기기는 페이징 줄 오른쪽: 이 검투사의 제안을 모두 넘긴다. 여기서 끝낸다 (켈라에서 다시 정하지 않는다)
    }
  }
  if (S.showIntro) app.append(h('div', { class: 'overlay intro' }, h('div', { class: 'introbox' },
    h('div', { class: 'title' }, '미테!'), h('div', { class: 'sub' }, '라니스타의 길'),
    h('p', {}, '검투사는 지고도 살 수 있다.'), h('p', {}, '관중이 미테!를 외치게 하라.'),
    h('p', { class: 'hint' }, '검투사를 사들이고, 시설을 키우고, 계약에 맞춰 내보내라. 명예와 호감도가 높을수록 관중은 살려 달라 외친다.'),
    h('button', { class: 'primary', onclick: () => { unlockAudio(); sfx.chant(3); sfx.cheer(0.8); S.showIntro = false; localStorage.setItem('lanista-intro', '1'); render(); } }, '입장'))));
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
  { const town = renderTown(); app.append(sideToolsLand([{ icon: 'cells', title: '켈라', on: S.cellsOpen, onclick: () => { S.cellsOpen = !S.cellsOpen; S.cellPop = null; S.cellSide = null; if (S.cellsOpen) S.sheet = null; else { S.bedPick = null; S.palusMode = false; } render(); } }, { key: 'facilities', icon: 'facilities', title: '시설 강화' }, { key: 'doctors', icon: 'doctors', title: '독토르', badge: S.st.roster.filter(g => g.status === 'doctor').length }, { key: 'rivals', icon: 'rivals', title: '파밀리아' }])); app.append(town);
    if (S.cellsOpen && S.cellsCanvas) { const inj = S.st.roster.filter(g => g.injured).length, docs = S.st.roster.filter(g => g.status === 'doctor').length; // 켈라 = 시트의 하나: 다른 시트와 같은 틀(처마 제목 띠·✕·같은 모션). 본문은 켈라 캔버스
      const title = S.bedPick != null ? `침상 ${S.bedPick + 1}에 눕힐 부상자의 방을 누르세요` : S.palusMode ? `팔루스 배정 ${palusTrainees(S.st).length}/${S.st.ludus.palus} — 방을 누르면 세우고, 다시 누르면 내려옵니다` : `켈라 ${S.st.roster.length}/${S.st.ludus.cells.length} · 출전 가능 ${available(S.st).length}${inj ? ` · 부상 ${inj}` : ''}${docs ? ` · 독토르 ${docs}` : ''}`;
      app.append(h('div', { class: `scenepanel key-cells${stillOpen ? ' still' : ''}` }, h('div', { class: 'eave' }, h('h2', {}, title, S.bedPick == null && !S.palusMode ? h('span', { class: 'hint' }, ' 방을 누르면 검투사') : null), h('button', { class: 'close', title: '닫기', 'aria-label': '닫기', onclick: () => { S.cellsOpen = false; S.bedPick = null; S.palusMode = false; S.cellPop = null; S.cellSide = null; render(); } }, '✕')), h('div', { class: 'sheetbody' }, S.cellsCanvas))); } } // 토글은 헤더 아래 한 줄 (켈라 = 지금 검투사 인벤토리, 나머지는 정보 서랍). 시트는 이 줄 밑에서 아래로 내려온다
  { const c = coach(); if (c) app.append(c); }
  // 대시보드: 지금 이 화면에서 결정할 일 + 오른쪽 위 이동 버튼
  const noticeEl = S.notice ? h('div', { class: 'ditem notice' }, h('span', { class: 'dot' }), h('span', { class: 'grow' }, S.notice)) : null; S.notice = '';
  if (S.detail) { if (!S.detail.solo) app.append(detailPage()); if (S.detail.confirm) app.append(confirmPage()); } // 검투사 상세 페이지: 장면 위로 오른쪽에서 밀려 들어온다. 확인 페이지는 그 위로 한 번 더
  if (noticeEl) app.append(h('div', { class: 'toast' }, noticeEl.textContent ?? '')); // 토스트: 배경 없이 굵은 글자, 위 가운데에 나타나 위로 떠오르며 사라진다. 정보는 서랍과 장면 클릭으로
  app.classList.add('land'); // 준비 화면: 가로 배치 (왼쪽 장면 · 오른쪽 대시보드). 높이는 CSS 그리드가 잡는다
  // 아래 탭 바: 상세(검투사·시설·파밀리아·규칙)는 시트로 연다 — 화면을 스크롤하지 않도록
  // 편성 버튼은 없다: 포룸의 공고벽을 누르면 편성으로 (규칙은 메뉴에, 토글은 장면 위)
}
// ── 탭 바 (화면 아래 고정): 왼쪽은 준비 → 편성 → 전투 단계, 오른쪽은 시트를 여닫는 아이콘 토글(현황 배지). 시트는 화면 위에 여는 상세
type StageItem = { label: string; on?: boolean; primary?: boolean; disabled?: boolean; onclick?: () => void };
type ToolItem = { key?: 'doctors' | 'rivals' | 'events' | 'facilities'; icon: ToolIcon; title: string; badge?: number; on?: boolean; onclick?: () => void }; // key 가 없으면 on/onclick 으로 직접 토글 (켈라)
type ToolIcon = 'roster' | 'doctors' | 'rivals' | 'events' | 'cells' | 'facilities';
const TOOL_SVG: Record<ToolIcon, string> = { // Lucide 아이콘 (ISC): swords · graduation-cap(교관) · users · calendar-days
  roster: '<path d="m14.5 17.5 3 3"/><path d="m21 3-9 9"/><path d="M6 21 21 6"/><path d="M3 6l3 3"/><path d="m2.5 21.5 3-3"/><path d="M14 21l-3-3"/><path d="M10 6.5 3.5 13"/>',
  doctors: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  rivals: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  cells: '<path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-8h6v8"/>',
  facilities: '<path d="m15 12-8.5 8.5a2.12 2.12 0 1 1-3-3L12 9"/><path d="M17.64 15 22 10.64"/><path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91"/>', // 망치 (시설 강화)
  events: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>',
};
const barBox = h('nav', { class: 'tabbar' }) as HTMLElement; // 하단 바도 한 요소를 유지하고 내용만 바꾼다 (깜박임 방지)
function tabbar(stages: StageItem[], tools: ToolItem[] = []): Node {
  const stageEls = stages.map(t => h('button', { class: `stage${t.on ? ' on' : ''}${t.primary ? ' primary' : ''}`, disabled: t.disabled, onclick: t.onclick }, t.label));
  const toolEls = toolButtons(tools);
  barBox.replaceChildren(h('div', { class: 'stages' }, ...stageEls), ...(tools.length ? [h('div', { class: 'sidetools' }, ...toolEls)] : [])); // 편성 등에서는 화면 오른쪽에 세로로 뜬다 (fixed)
  return barBox;
}
function toolButtons(tools: ToolItem[]): HTMLElement[] {
  return tools.map(t => { const on = t.key ? S.sheet === t.key : !!t.on; const b = h('button', { class: `tool${on ? ' on' : ''}`, title: t.title, 'aria-label': t.title, onclick: t.key ? () => { const k = t.key!; S.sheet = S.sheet === k ? null : k; S.cellsOpen = false; S.bedPick = null; S.palusMode = false; S.cellPop = null; S.cellSide = null; render(); } : t.onclick }); // 토글은 서로 배타적: 패널을 열면 켈라는 내려가고 침상·팔루스 배정 모드도 풀린다
    b.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TOOL_SVG[t.icon]}</svg>`;
    if (t.badge) b.append(h('span', { class: 'nbadge' }, String(t.badge))); return b; });
}
// 준비 화면의 아이콘 토글: 디스플레이(장면) 오른쪽 아래에 세로로 — 대시보드를 가리지 않는다
function sideTools(tools: ToolItem[]): Node { return h('div', { class: 'sidetools indisplay' }, ...toolButtons(tools)); }
// 가로 배치: 장면 밖 맨 왼쪽 세로 띠 (왼손 엄지 자리)
function sideToolsLand(tools: ToolItem[]): Node { return h('div', { class: 'sidetools inland' }, ...toolButtons(tools).map((b, i) => { b.insertBefore(h('span', { class: 'lbl' }, tools[i].title), b.querySelector('.nbadge')); return b; })); } // 처마 밑에 매달린 서판: 아이콘 + 이름 (+ 수)
// 단계 버튼: 지금 누를 수 있는 것만 (준비에서는 '편성', 편성에서는 '준비' 와 '전투'). 화살표 없이
function stageItems(cur: 'manage' | 'plan', next?: { label: string; onclick: () => void }): StageItem[] {
  const toManage = () => { S.sheet = null; S.phase = 'manage'; render(); };
  const toPlan = () => { S.phase = 'plan'; S.sheet = null; S.planSel = null; render(); }; // 계약(경기장)을 먼저 고르면 검투사 목록이 나온다
  if (cur === 'manage') return [{ label: '편성', primary: true, onclick: toPlan }];
  return [{ label: next?.label ?? '전투', primary: true, onclick: next?.onclick }]; // '준비'는 계약 벽 왼쪽 위의 낙서 뒤로가기로
}
// 시트 닫기: 아래로 내려가는 동작 뒤에 지운다 (켈라가 내려가듯)
function closeSheet() {
  const ov = document.querySelector('.overlay.sheet'); if (!ov) { S.sheet = null; render(); return; }
  ov.classList.add('closing'); window.setTimeout(() => { S.sheet = null; render(); }, 300);
}
function renderSheetBody(): (Node | null)[] {
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
function renderSheet(): Node {
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
// 켈라 시트: 칸의 거주자와 숙소 질, 이 칸에 넣을 검투사 고르기
function cellPanel(k: number): Node {
  const q = S.st.ludus.cells[k] ?? 0, g = occupantOf(S.st, k), cost = upgradeCost(S.st, 'cell', k);
  const row = (x: Gladiator, cur: boolean) => h('div', { class: `drow${cur ? ' sel' : ''}`, onclick: cur ? undefined : () => { moveToCell(S.st, x, k); S.cellPop = null; S.gladSel = x.id; S.cellSide = 'glad'; render(); } }, // 옮기면 팝오버를 닫는다
    portrait(x, 34), ' ', h('span', { class: 'nm' }, x.name), h('span', { class: 'meta' }, ` ${TYPE_KO[x.type]} · ${x.rank === 'tiro' ? '티로' : '베테'}${x.injured ? ' · 부상' : ''}`), h('span', { style: 'flex:1' }), cur ? h('span', { class: 'hint' }, '이 칸') : h('span', { class: 'hint' }, `${cellOfIdx(x) + 1}번 →`));
  return h('div', { class: 'panel' }, h('h2', {}, `켈라 ${k + 1}번`, h('span', { class: 'stars', style: 'margin-left:8px' }, '★'.repeat(q) + '☆'.repeat(CONFIG.ludus.cells.qualityCost.length - q)), helpBtn('켈라', '검투사가 자는 작은 방입니다. 검투사를 고르면 이 칸으로 오고, 이미 누가 있으면 서로 자리를 바꿉니다.\n숙소 질 ★1 휴식 피로 −2, ★2 유지비 −25%, ★3 명예 +1/시즌. 질은 칸에 붙어 있어 검투사를 옮기면 그 칸의 질을 받습니다.')),
    h('div', { class: 'frow' }, h('div', { class: 'grow' }, h('b', {}, g ? g.name : '빈 칸'), h('div', { class: 'meta' }, g ? `${TYPE_KO[g.type]} · 명예 ${g.honor ?? 0} · 피로 ${g.fatigue ?? 0}` : '검투사를 고르면 이 칸에 들어옵니다')), cost != null ? h('button', { disabled: !canPayFac(cost), onclick: () => { if (upgrade(S.st, 'cell', k)) { sfx.coin(); render(); } } }, `방 손보기 ${cost.toLocaleString()}`) : h('span', { class: 'hint' }, '더 손볼 데 없음')),
    h('div', { class: 'dlist' }, ...S.st.roster.map(x => row(x, x === g))));
}
const cellOfIdx = (g: Gladiator) => cellOf(S.st, g);
// 켈라 화면: 회랑 뒤 작은 방들. 칸마다 문·질(등잔 수)·거주자(앉은 모습). 누르면 시트
const TOWN_H = 414, CELLS_TOP = 0, CELLS_MIN_H = CELLS_TOP + 40 + 5 * 100 + 4 * 6; // 마을 장면 높이 · 켈라 장면의 위 여백(처마 토글이 덮는 만큼, 월드 단위) · 켈라 장면 최소 높이 (3×5 방, 방 높이 100 + 여백)
S.cellsH = CELLS_MIN_H; // 켈라 장면 높이: 무대 바닥까지 채운다 (renderTown 의 draw 가 매 프레임 잰다). 방은 그만큼 세로로 늘어난다
S.townH = TOWN_H; const CH = () => S.townH; // 마을 캔버스의 현재 논리 높이: 평소 TOWN_H, 켈라가 열리는 만큼 cellsH 까지 자란다 (renderTown 의 draw 가 매 프레임 정한다). 세로 무대에서 닫힌 마을 아래 빈 흙길이 화면 절반을 먹던 문제의 답 답
function cellRects(_n: number): { x: number; y: number; w: number; h: number }[] {
  const n = CONFIG.ludus.cells.max, cols = 3, rows = Math.ceil(n / cols), gap = 6, margin = 12; // 방 자리는 최대 15칸을 미리 잡아 둔다 (5줄 × 3칸, 세로 무대)
  const w = (S.VW - margin * 2 - (cols - 1) * gap) / cols, hh = (S.cellsH - CELLS_TOP - 24 - (rows - 1) * gap) / rows;
  return Array.from({ length: n }, (_, i) => ({ x: margin + (i % cols) * (w + gap), y: CELLS_TOP + 12 + Math.floor(i / cols) * (hh + gap), w, h: hh })); // 처마 아래, 왼쪽 위부터 줄 단위로 채운다
}
// 켈라 장식으로 상태를 보여준다 (폼페이 낙서·비문·유물에서 따온 기호):
//  승수 = 벽에 긁은 획수(5개 묶음) · 5승마다 종려가지(팔마, 승리 상징) · 명예 20↑ 월계관(코로나) · 팬 ★ = 하트 낙서(수스피리움 푸엘라룸)
//  기술 = 목검 걸이(딕타타 연습) · 베테라누스 = 투구 걸이 · 자유민 = 벽의 루디스(나무 검) · 독토르 = 지팡이 · 부상 = 붕대 감고 누움 · 피로 2↑ = 잠 (z z)
function drawCellDecor(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, g: Gladiator, t: number, layer: 'wall' | 'front') {
  const sc = Math.max(0.55, Math.min(1, r.w / 190)); const scratch = 'rgba(232,217,181,.75)', wood = '#c9a86a', leaf = '#5f7a3c';
  ctx.save(); ctx.translate(r.x, r.y); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (layer === 'wall') {
    // 승수 획 (왼쪽 위 벽): 4획 + 사선 = 5승. 최대 20승까지
    const wins = Math.min(20, g.wins); ctx.strokeStyle = scratch; ctx.lineWidth = 1.4 * sc;
    for (let i = 0; i < wins; i++) { const grp = Math.floor(i / 5), k = i % 5; const gx = 9 * sc + grp * 16 * sc, gy = 10 * sc; ctx.beginPath();
      if (k < 4) { ctx.moveTo(gx + k * 3 * sc, gy); ctx.lineTo(gx + k * 3 * sc + 0.6, gy + 9 * sc); } else { ctx.moveTo(gx - 1, gy + 8 * sc); ctx.lineTo(gx + 11 * sc, gy + 1); } ctx.stroke(); }
    // 종려가지: 5승마다 하나 (최대 3), 획 아래
    const palms = Math.min(3, Math.floor(g.wins / 5));
    for (let i = 0; i < palms; i++) { const px = 12 * sc + i * 13 * sc, py = 24 * sc; ctx.strokeStyle = leaf; ctx.lineWidth = 1.3 * sc; ctx.beginPath(); ctx.moveTo(px, py + 14 * sc); ctx.lineTo(px + 4 * sc, py); ctx.stroke();
      for (let k = 1; k <= 4; k++) { const fx = px + k * sc, fy = py + 14 * sc - k * 3.2 * sc; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx - 4 * sc, fy - 3 * sc); ctx.moveTo(fx, fy); ctx.lineTo(fx + 4 * sc, fy - 2 * sc); ctx.stroke(); } }
    // 이름: 벽 위쪽 가운데에 긁어 쓴 낙서
    // 벽의 글자는 방 크기와 무관하게 읽히는 크기로 (방이 좁아도 5px 글씨는 안 된다): 이름 11px, 유형·명예 9px, 부상은 셋째 줄
    ctx.fillStyle = scratch; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(g.name, r.w * 0.5 + 4, 15);
    ctx.font = '9px sans-serif'; ctx.fillText(`${TYPE_KO[g.type]} · 명예 ${g.honor ?? 0}`, r.w * 0.5 + 4, 27); if (g.injured) { ctx.fillStyle = '#e0a58a'; ctx.fillText(`부상 ${g.injured}시즌`, r.w * 0.5 + 4, 38); } ctx.textAlign = 'left'; // 유형·명예(·부상)도 벽에
    { const q = S.st.ludus.cells[cellOf(S.st, g) ?? 0] ?? 0; if (q) { ctx.fillStyle = '#e8c96a'; ctx.font = '10px sans-serif'; ctx.textAlign = 'left'; for (let i = 0; i < q; i++) ctx.fillText('★', 6, r.h - 9 - i * 11); } } // 켈라 등급 (왼쪽 아래)
    // 월계관 (이름 오른쪽 위 벽): 명예 20 이상, 40 이상이면 금빛
    if ((g.honor ?? 0) >= 20) { const cx = r.w - 46 * sc, cy = 14 * sc, rr = 8 * sc; ctx.strokeStyle = (g.honor ?? 0) >= 40 ? '#d4a52a' : leaf; ctx.lineWidth = 1.6 * sc; ctx.beginPath(); ctx.arc(cx, cy, rr, Math.PI * 0.85, Math.PI * 2.15); ctx.stroke();
      for (let a = Math.PI * 0.9; a < Math.PI * 2.1; a += 0.42) { const lx = cx + Math.cos(a) * rr, ly = cy + Math.sin(a) * rr; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + Math.cos(a - 1.2) * 4 * sc, ly + Math.sin(a - 1.2) * 4 * sc); ctx.stroke(); } }
    // 팬 스타: 하트 낙서 둘 (오른쪽 벽, 등잔 아래)
    if (fansOf(g) >= FANS_STAR) { ctx.strokeStyle = 'rgba(155,44,28,.8)'; ctx.lineWidth = 1.3 * sc; for (const [hx, hy] of [[r.w - 56 * sc, 30 * sc], [r.w - 46 * sc, 36 * sc]]) { const z = 3.2 * sc; ctx.beginPath(); ctx.moveTo(hx, hy + z); ctx.bezierCurveTo(hx - z * 2, hy - z * 0.6, hx - z * 0.6, hy - z * 2, hx, hy - z * 0.5); ctx.bezierCurveTo(hx + z * 0.6, hy - z * 2, hx + z * 2, hy - z * 0.6, hx, hy + z); ctx.stroke(); } }
    // 장비 걸이 (오른쪽 벽): 유형의 투구·방패(그물)·무기. 독토르는 장비를 내려놓았다
    if (g.status !== 'doctor') drawGearRack(ctx, g.type, r.w - 24 * sc, r.h - 7, 0.9 * sc, g.id, g.rank === 'veteranus' ? '#2c4f9b' : '#6e7f9b'); // 바닥 기준: 선반 위 투구, 못에 건 검, 기대 세운 창·방패
    // 루디스 (자유민): 벽에 가로로 걸린 나무 검 + 붉은 띠
    if (g.status === 'rudiarius') { const rx = r.w * 0.5, ry = r.h * 0.38; ctx.strokeStyle = wood; ctx.lineWidth = 3 * sc; ctx.beginPath(); ctx.moveTo(rx - 16 * sc, ry); ctx.lineTo(rx + 14 * sc, ry); ctx.stroke(); ctx.lineWidth = 2 * sc; ctx.beginPath(); ctx.moveTo(rx + 2 * sc, ry - 5 * sc); ctx.lineTo(rx + 2 * sc, ry + 5 * sc); ctx.stroke(); ctx.strokeStyle = '#9b2c1c'; ctx.lineWidth = 1.5 * sc; ctx.beginPath(); ctx.moveTo(rx + 12 * sc, ry - 4 * sc); ctx.lineTo(rx + 8 * sc, ry + 6 * sc); ctx.stroke(); }
  } else {
    // 목검 걸이 (기술 수만큼, 오른쪽 아래): 세워 둔 목검들
    const sk = skillsOf(g).length;
    for (let i = 0; i < sk; i++) { const bx = r.w - 50 * sc - i * 6 * sc, by = r.h - 7; ctx.strokeStyle = wood; ctx.lineWidth = 2.2 * sc; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + 3 * sc, by - 22 * sc); ctx.stroke(); ctx.lineWidth = 1.6 * sc; ctx.beginPath(); ctx.moveTo(bx + 0.4 * sc - 3 * sc, by - 4 * sc); ctx.lineTo(bx + 0.4 * sc + 3.5 * sc, by - 5 * sc); ctx.stroke(); }
    // 지팡이 (독토르): 왼쪽 벽에 기대 세움
    if (g.status === 'doctor') { ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 2.4 * sc; ctx.beginPath(); ctx.moveTo(10 * sc, r.h - 7); ctx.lineTo(14 * sc, r.h - 7 - 34 * sc); ctx.stroke(); }
    // 붕대 (부상): 바닥의 붕대 뭉치(핏자국) + 벽에 기댄 목발
    if (g.injured) { const bx = r.w * 0.42 - 22 * sc, by = r.h - 7 - 3 * sc; ctx.fillStyle = '#efe5c9'; ctx.beginPath(); ctx.ellipse(bx, by, 5 * sc, 3 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#d8c9a4'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx - 4 * sc, by - 1); ctx.lineTo(bx + 4 * sc, by + 1); ctx.stroke(); ctx.fillStyle = 'rgba(155,44,28,.7)'; ctx.beginPath(); ctx.arc(bx + 1.5 * sc, by - 0.5, 1.4 * sc, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 2 * sc; ctx.beginPath(); ctx.moveTo(r.w * 0.5 + 20 * sc, r.h - 7); ctx.lineTo(r.w * 0.5 + 26 * sc, r.h - 7 - 30 * sc); ctx.moveTo(r.w * 0.5 + 23 * sc, r.h - 7 - 30 * sc); ctx.lineTo(r.w * 0.5 + 30 * sc, r.h - 7 - 29 * sc); ctx.stroke(); }
    // 졸음 (피로 2↑, 부상 아님): 고개 옆에서 z z 가 떠오른다
    else if ((g.fatigue ?? 0) >= 2) { ctx.fillStyle = scratch; ctx.font = `bold ${9 * sc}px sans-serif`; for (let i = 0; i < 2; i++) { const ph = (t * 0.6 + i * 0.5) % 1; ctx.globalAlpha = 1 - ph; ctx.fillText('z', r.w * 0.42 + 12 * sc + i * 6 * sc + ph * 4, r.h - 7 - 40 * sc - ph * 12 * sc - i * 4 * sc); } ctx.globalAlpha = 1; }
  }
  ctx.restore();
}
// 켈라 안 동작: 검투사마다 정해진 버릇 하나 (id 로 고정). 앉아 쉬기 · 기지개 · 목검 손질 · 무릎 꿇고 기도(네메시스) · 죽 먹기 · 벽에 낙서 · 팔굽혀펴기
const SIT: Skeleton = { lean: -6, frontArm: [-30, 30], backArm: [30, 30], frontLeg: [82, -25], backLeg: [70, -10], headBob: -2, sink: 19 };
function cellSlump(t: number): { sk: Skeleton; facing?: 1 | -1 } { return { sk: { ...SIT, lean: 10, frontArm: [-6, 8], backArm: [6, 8], headBob: 4 + Math.sin(t * 0.9) * 1 } }; } // 피로 1: 팔을 늘어뜨리고 축 처져 앉음
function cellSleep(t: number): { sk: Skeleton; facing?: 1 | -1 } { const br = Math.sin(t * 1.1) * 1.2; return { sk: { ...SIT, lean: -18 + br, frontArm: [-20, 10], backArm: [20, 10], frontLeg: [78, -20], backLeg: [66, -6], headBob: 9, sink: 20 } }; } // 피로 3: 벽에 등을 기대고 고개 꺾인 채 잠
function cellDoze(t: number): { sk: Skeleton; facing?: 1 | -1 } { const nod = Math.max(0, Math.sin(t * 1.3)) * 6; return { sk: { ...SIT, lean: 16 + nod, frontArm: [-8, 12], backArm: [8, 12], headBob: 7 + nod * 0.6 } }; }
function cellActivity(g: Gladiator, t: number): { sk: Skeleton; facing?: 1 | -1 } {
  const kind = ['sit', 'stretch', 'polish', 'pray', 'eat', 'scribble', 'pushup'][g.id % 7]; const w = Math.sin(t * 2.2), w2 = Math.sin(t * 5);
  switch (kind) {
    case 'stretch': return { sk: { lean: -4 + w * 3, frontArm: [-160 + w * 12, -10], backArm: [-150 - w * 12, 10], frontLeg: [14, -6], backLeg: [-14, 6], headBob: -2, lift: Math.max(0, w) * 2 } }; // 서서 두 팔 위로
    case 'polish': return { sk: { ...SIT, lean: 4, frontArm: [40 + w2 * 18, 40], backArm: [30, 45], headBob: 4 } }; // 앉아 무릎 위 목검을 문지른다
    case 'pray': return { sk: { lean: 6 + Math.max(0, w) * 4, frontArm: [50, 70], backArm: [50, 70], frontLeg: [75, -75], backLeg: [-20, -70], headBob: 5, sink: 10.5 }, facing: -1 }; // 벽 쪽 무릎 꿇고 두 손 모음
    case 'eat': { const up = Math.max(0, Math.sin(t * 1.6)); return { sk: { ...SIT, lean: 2, frontArm: [10 + up * 60, 70 + up * 40], backArm: [45, 40], headBob: up * 2 } }; } // 그릇 든 채 숟가락을 입으로
    case 'scribble': return { sk: { lean: 6, frontArm: [-120 + w2 * 5, -25 + w2 * 6], backArm: [10, 10], frontLeg: [12, -4], backLeg: [-12, 4], headBob: -3 }, facing: -1 }; // 벽에 낙서
    case 'pushup': { const u = (Math.sin(t * 2.6) + 1) * 0.5; return { sk: { lean: 78, frontArm: [-60 + u * 25, -20 - u * 40], backArm: [-60 + u * 25, -20 - u * 40], frontLeg: [-8, 0], backLeg: [-6, 0], headBob: 3, sink: 26 + u * 8 } }; } // 팔굽혀펴기
    default: return { sk: { ...SIT, headBob: -2 + Math.sin(t * 1.1) * 1.5 } };
  }
}
function drawCellsScene(ctx: CanvasRenderingContext2D, t: number) {
  const VH = S.cellsH; const n = CONFIG.ludus.cells.max; const built = S.st.ludus.cells.length; const rects = cellRects(n);
  ctx.fillStyle = '#cbb67f'; ctx.fillRect(0, 0, S.VW, VH); // 회벽
  // (회랑 처마 띠는 뺐다 — 바로 위에 서판 처마가 있다, 2026-09-16)
  rects.forEach((r, k) => {
    if (k >= built) { ctx.fillStyle = '#b8a67a'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = '#a58f60'; ctx.lineWidth = 1; for (let yy = r.y + 8; yy < r.y + r.h; yy += 12) { ctx.beginPath(); ctx.moveTo(r.x, yy); ctx.lineTo(r.x + r.w, yy); ctx.stroke(); for (let xx = r.x + ((yy / 12) % 2) * 14; xx < r.x + r.w; xx += 28) { ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy + 12); ctx.stroke(); } } return; } // 아직 짓지 않은 칸: 벽돌로 막힌 자리 (누르면 시설 강화)
    const q = S.st.ludus.cells[k] ?? 0, g = occupantOf(S.st, k);
    ctx.fillStyle = g ? '#5a4224' : '#8f7a4e'; ctx.fillRect(r.x, r.y, r.w, r.h); // 방 안 (빈 칸은 막힌 벽처럼 밝게)
    ctx.fillStyle = '#3a2412'; ctx.fillRect(r.x, r.y, r.w, 4); ctx.fillRect(r.x, r.y, 4, r.h); ctx.fillRect(r.x + r.w - 4, r.y, 4, r.h); // 문틀
    ctx.fillStyle = q >= 2 ? '#7a5a1c' : '#5a4224'; ctx.fillRect(r.x + 4, r.y + r.h - 6, r.w - 8, 6); // 바닥
    if (q >= 1) { ctx.fillStyle = '#e8c96a'; ctx.fillRect(r.x + 8, r.y + r.h - 14, r.w * 0.45, 5); } // 짚자리 → 매트
    if (q >= 3) { ctx.fillStyle = '#9b2c1c'; ctx.fillRect(r.x + r.w - 20, r.y + 10, 12, 16); } // 벽걸이 천
    for (let i = 0; i < q; i++) { const lx = r.x + r.w - 10 - i * 9, ly = r.y + 8; ctx.fillStyle = '#e8c96a'; ctx.beginPath(); ctx.ellipse(lx, ly + 3 + Math.sin(t * 9 + i + k) * 0.4, 2.2, 3.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#8a6a44'; ctx.fillRect(lx - 3, ly + 6, 6, 2); } // 등잔 = 질
    if (S.cellDrag && S.cellDrag.over === k && k !== S.cellDrag.k0) { ctx.strokeStyle = '#e8c96a'; ctx.lineWidth = 3; ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4); } // 놓을 방 강조
    if (g && S.cellDrag && S.cellDrag.id === g.id && S.cellDrag.moved) { drawCellDecor(ctx, r, g, t, 'wall'); drawCellDecor(ctx, r, g, t, 'front'); return; } // 끌려 나간 방은 비어 있다 (장식만 남음)
    if (g) { drawCellDecor(ctx, r, g, t, 'wall'); const fat = g.injured ? 2 : (g.fatigue ?? 0); // 피로는 자세로: 0 버릇대로 · 1 축 늘어져 앉음 · 2 꾸벅임(부상도) · 3 벽에 기대 잠
      const sk = fat >= 3 ? cellSleep(t + k) : fat === 2 ? cellDoze(t + k) : fat === 1 ? cellSlump(t + k) : cellActivity(g, t + k); const fx = sk.facing ?? 1;
      drawStickman(ctx, g.type, { x: r.x + r.w * 0.42, y: r.y + r.h - 7, scale: Math.min(0.95, r.h / 92, r.w / 96), skeleton: sk.sk, t: t + k, team: g.rank === 'veteranus' ? '#2c4f9b' : '#6e7f9b', bare: true, facing: fx, accessories: accessoriesOf(g) });
      drawCellDecor(ctx, r, g, t, 'front'); }
    if (S.bedPick != null || S.palusMode) { const ok = !!g && (S.bedPick != null ? g.injured > 0 : g.alive && g.injured <= 0 && g.status !== 'doctor'); if (!ok) { ctx.fillStyle = 'rgba(203,182,127,.74)'; ctx.fillRect(r.x, r.y, r.w, r.h); } else if (S.palusMode && g && palusOf(S.st, g) >= 0) { ctx.fillStyle = '#9b2c1c'; ctx.fillRect(r.x + 4, r.y + r.h - 22, r.w - 8, 16); ctx.fillStyle = '#f3ead0'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`팔루스 ${palusOf(S.st, g) + 1}`, r.x + r.w / 2, r.y + r.h - 10); } /* 방 아래쪽 띠 (이름을 가리지 않게) */ } // 배정 모드: 고를 수 없는 방은 흐리게 — 침상은 부상자만, 팔루스는 건강하고 아직 안 선 검투사만
  });
  if (S.cellDrag && S.cellDrag.moved) { const g = S.st.roster.find(x => x.id === S.cellDrag!.id); if (g) { ctx.save(); ctx.globalAlpha = 0.9; ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 6; drawStickman(ctx, g.type, { x: S.cellDrag.px, y: S.cellDrag.py + 26, scale: 1.0, pose: 'idle', t, team: g.rank === 'veteranus' ? '#2c4f9b' : '#6e7f9b', bare: true, facing: 1, accessories: accessoriesOf(g) }); ctx.restore();
    ctx.save(); ctx.font = 'bold 11px sans-serif'; const nw = ctx.measureText(g.name).width, bx = S.cellDrag.px - (nw + 22) / 2, by = S.cellDrag.py - 84; ctx.fillStyle = 'rgba(243,234,208,.95)'; ctx.beginPath(); ctx.roundRect(bx - 5, by - 12, nw + 32, 20, 5); ctx.fill(); ctx.fillStyle = TYPE_COLOR[g.type]; ctx.fillRect(bx, by - 9, 14, 14); drawGlyph(ctx, g.type, bx + 7, by - 2, 11); ctx.fillStyle = '#3a2412'; ctx.textAlign = 'left'; ctx.fillText(g.name, bx + 18, by + 3); ctx.restore(); } } // 끌고 가는 검투사 (그림자) + 머리 위 무기 아이콘·이름표
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
    h('button', { onclick: () => { void ask('저장을 지우고 새 게임을 시작합니까?', { ok: '새 게임' }).then(ok => { if (!ok) return; clearSave(); S.st = newGame(Math.floor(Math.random() * 100000)); S.phase = 'manage'; S.sheet = null; S.assign = {}; S.trainPlan = {}; S.townCanvas = null; S.view = 'ludus'; render(); }); } }, '새 게임')));
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
const canPayFac = (cost: number) => S.st.money - cost >= upkeepOf(S.st); // 다음 시즌 유지비는 남겨 둔다
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
// 검투사 카드의 행동 버튼(치료·매각·독토르·재훈련·재계약·내보내기·기술 제안). 켈라 방 시트가 쓴다
function gladActions(g: Gladiator): (Node | null)[] {
  return [
      g.injured ? h('button', { disabled: S.st.money < healCostOf(S.st), onclick: () => openConfirm(g, 'heal') }, `치료 ${healCostOf(S.st)}`) : null,
      (g.status ?? 'slave') === 'slave' ? h('button', { onclick: () => openConfirm(g, 'sell') }, `매각 ${sellPrice(g).toLocaleString()}`) : null,
      g.status === 'rudiarius' && g.contractUntil != null && g.contractUntil - S.st.season <= 1 ? h('button', { class: 'primary', disabled: S.st.money < renewCost(g), title: `계약 ${CONFIG.origins.auctoratus.term}시즌 연장`, onclick: () => { renewContract(S.st, g); render(); } }, `재계약 ${renewCost(g).toLocaleString()}`) : null,
      g.status && g.status !== 'slave' ? h('button', { onclick: () => openConfirm(g, 'release') }, '내보내기') : null,
    ];
}
// 켈라 방 시트: 방을 누르면 그 검투사의 카드 + 행동 버튼 + 이 방 강화 + 다른 방으로 옮기기 (검투사 목록 시트와 켈라 팝오버를 하나로 합쳤다)
// 검투사 상세 페이지: 왼쪽에 검투사가 크게 서 있고(불러낸 느낌), 오른쪽에 정보와 행동. 내 검투사(켈라)와 시장 노예가 같은 틀을 쓴다
S.shownDetail = null; // 지금 떠 있는 상세 페이지 (kind:id)
function closeDetail() { const el = document.querySelector('.detailpage'); S.shownDetail = null; if (!el) { S.detail = null; render(); return; } el.classList.add('closing'); window.setTimeout(() => { S.detail = null; render(); }, 280); }
function openConfirm(g: Gladiator, what: 'sell' | 'release' | 'buy' | 'heal') { if (!S.detail) S.detail = { kind: what === 'buy' ? 'market' : 'roster', id: g.id, solo: true }; S.detail.confirm = what; render(); }
function closeConfirm() { const el = document.querySelector('.detailpage.confirm'); const done = () => { if (S.detail?.solo) S.detail = null; else if (S.detail) delete S.detail.confirm; render(); }; if (!el || !S.detail) { done(); return; } el.classList.add('closing'); window.setTimeout(done, 280); }
// 매각·내보내기·구매 확인: 검투사와 라니스타가 마주 서서 주고받는 대화 장면. 말풍선이 차례로 뜨고, 아래에 '· ' 효과 줄과 확인 버튼
const talkScenes = new Set<{ c: HTMLCanvasElement; g: Gladiator; start: number; what: 'sell' | 'release' | 'buy' | 'heal'; healed?: number }>();
function drawTalkScene(e: { c: HTMLCanvasElement; g: Gladiator; start: number; what: 'sell' | 'release' | 'buy' | 'heal'; healed?: number }, t: number) {
  const ctx = e.c.getContext('2d')!; const W = e.c.width / devicePixelRatio, H = e.c.height / devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#e3d3a6'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#cbb67f'; ctx.fillRect(0, H - 10, W, 10);
  const el = (performance.now() - e.start) / 1000; const sc = 1.35, gy = H - 8; // 폭 384 장면에 맞춘 인물 크기
  // 검투사: 왼쪽에서 걸어 들어와 라니스타 앞에 선다 (구매는 사슬 풀린 노예가 상인 쪽에서 오듯 조금 늦게)
  const ENTER = 0.9; const gx1 = W * 0.36; const k = Math.min(1, el / ENTER), ease = 1 - Math.pow(1 - k, 2); const gx = -40 + (gx1 + 40) * ease;
  if (e.what === 'heal') { // 치료 장면: 침상에 걸터앉은 부상자(왼쪽) + 붕대 뭉치를 든 의사(오른쪽에서 걸어와 살핀다). 도장이 찍히면 일어선다
    const bx = gx1 - 30 * sc, by = gy; ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx, by - 22 * sc); ctx.lineTo(bx + 70 * sc, by - 22 * sc); ctx.moveTo(bx + 3, by - 22 * sc); ctx.lineTo(bx + 3, by); ctx.moveTo(bx + 70 * sc - 3, by - 22 * sc); ctx.lineTo(bx + 70 * sc - 3, by); ctx.stroke(); ctx.fillStyle = '#e8d9b5'; ctx.fillRect(bx + 2, by - 27 * sc, 70 * sc - 4, 5 * sc); // 침상
    const up = e.healed ? Math.max(0, Math.min(1, (performance.now() - e.healed) / 600)) : 0; const team = e.g.rank === 'veteranus' ? '#2c4f9b' : '#6e7f9b'; const w = Math.sin(t * 2);
    const sit: Skeleton = { ...NPC_POSES.stand, lean: 8, frontArm: [40, 60], backArm: [30, 50], frontLeg: [40, -70], backLeg: [-10, -70], headBob: 6 + w * 0.5, sink: 18 }; // 침상에 걸터앉음
    const stand: Skeleton = { ...NPC_POSES.stand, lean: -2, frontArm: [20 + w * 3, 15], headBob: 0 };
    const lerp = (a: number, b: number, u: number) => a + (b - a) * u; const pair = (a: readonly [number, number], b: readonly [number, number], u: number): [number, number] => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
    const mix = (a: Skeleton, b: Skeleton, u: number): Skeleton => ({ lean: lerp(a.lean, b.lean, u), frontArm: pair(a.frontArm, b.frontArm, u), backArm: pair(a.backArm, b.backArm, u), frontLeg: pair(a.frontLeg, b.frontLeg, u), backLeg: pair(a.backLeg, b.backLeg, u), headBob: lerp(a.headBob, b.headBob, u), sink: lerp(a.sink ?? 0, b.sink ?? 0, u) });
    drawStickman(ctx, e.g.type, { x: gx1 + 6 * sc, y: gy, scale: sc, skeleton: mix(sit, stand, up), t, team, accessories: accessoriesOf(e.g), facing: 1 });
    { const ax = gx1 + 12 * sc, ay = gy - 34 * sc - 18 * sc * (1 - up); ctx.strokeStyle = '#f3ead0'; ctx.lineWidth = 3.5 * (1 - up * 0.8) + 0.1; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(ax - 2 * sc, ay - 2); ctx.lineTo(ax + 3 * sc, ay + 3); ctx.moveTo(ax - 2 * sc, ay + 3); ctx.lineTo(ax + 3 * sc, ay + 8); ctx.stroke(); } // 팔의 붕대 (일어서며 옅어진다)
    const mk = Math.min(1, el / 1.0), mease = 1 - Math.pow(1 - mk, 2); const mx = W + 40 - (W + 40 - W * 0.62) * mease; // 의사: 오른쪽에서 걸어온다
    const tending = mk >= 1 && ((el > 1.2 && el < 2.4) || (el > 3.6 && el < 4.8)); const msk: Skeleton = mk < 1 ? { ...walkSkeleton(el * 9, 0.8), frontArm: [55, 50] } : tending ? { ...NPC_POSES.tend, lean: 14 + w * 2, frontArm: [72 + w * 6, 34], backArm: [50, 45], headBob: 5 } : { ...NPC_POSES.tablet, lean: 3, headBob: w * 0.6 };
    drawStickman(ctx, 'murmillo', { x: mx, y: gy, scale: sc, facing: -1, skeleton: msk, t, ink: INK, bare: true, garment: 'tunic', garmentColor: '#c8a878', garmentStripe: '#7a1f16', hands: (c, f) => { c.fillStyle = '#f3ead0'; c.beginPath(); c.arc(f.hx - 3, f.hy - 4, 5, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#c9b283'; c.lineWidth = 1; c.stroke(); } }); // 붕대 뭉치
    return; }
  const team = e.g.rank === 'veteranus' ? '#2c4f9b' : '#6e7f9b'; const w = Math.sin(t * 2);
  const gsk: Skeleton = k < 1 ? walkSkeleton(el * 9, 1) : e.what === 'release' ? { ...NPC_POSES.stand, lean: 2, frontArm: [30 + w * 3, 40], headBob: 1 } : e.what === 'sell' ? { ...NPC_POSES.stand, lean: -3, headBob: 6 + w * 0.5, frontArm: [10, 8] } : { ...NPC_POSES.stand, lean: 4, headBob: 2, frontArm: [20 + w * 3, 15] };
  if (e.what === 'buy') { // 시장 노예: 판매대와 똑같이 맨몸 + 손목 묶임 + 발의 백묵 (걸어 들어온 뒤)
    if (k < 1) drawStickman(ctx, e.g.type, { x: gx, y: gy, scale: sc, skeleton: gsk, t, team, facing: 1, bare: true });
    else { drawStickman(ctx, e.g.type, { x: gx, y: gy, scale: sc, pose: 'captive_up', t, team, facing: 1, bare: true });
      const wx = gx + 9 * sc, wy = gy - 27 * sc; ctx.strokeStyle = '#7a5a2c'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.ellipse(wx, wy, 5 * sc, 3.2 * sc, 0, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(wx, wy + 3 * sc); ctx.lineTo(wx - 2, wy + 12 * sc); ctx.stroke();
      ctx.strokeStyle = '#e8d9b5'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(gx - 8 * sc, gy - 1); ctx.lineTo(gx + 8 * sc, gy - 1); ctx.stroke(); }
  } else drawStickman(ctx, e.g.type, { x: gx, y: gy, scale: sc, skeleton: gsk, t, team, accessories: accessoriesOf(e.g), facing: 1 });
  // 라니스타: 오른쪽에 서서 서판을 들고 말한다 (말풍선이 뜰 때 손짓)
  const talking = (el > 0.2 && el < 1.4) || (el > 2.6 && el < 3.8); const lsk: Skeleton = talking ? { ...NPC_POSES.point, lean: 5, frontArm: [80 + w * 15, 30 - w * 8], backArm: [-40, -25], headBob: 1 + w } : { ...NPC_POSES.tablet, lean: 3, headBob: w * 0.6 };
  drawStickman(ctx, 'murmillo', { x: W * 0.64, y: gy, scale: sc, facing: -1, skeleton: lsk, t, ink: INK, bare: true, garment: 'toga', garmentColor: '#f3ead0', beard: true,
    hands: (c, f) => { c.fillStyle = '#d9c69a'; c.fillRect(f.hx - 7, f.hy - 12, 9, 12); c.strokeStyle = INK; c.lineWidth = 1; c.strokeRect(f.hx - 7, f.hy - 12, 9, 12); } });
}
function talkLines(g: Gladiator, what: 'sell' | 'release' | 'buy' | 'heal'): { who: 'l' | 'g'; text: string }[] {
  const L = S.st.lanista.name.split(' ')[0]; void L;
  if (what === 'heal') return [{ who: 'l', text: g.injured >= 2 ? '상처가 깊소. 약초를 바르고 붕대를 갈면 며칠이오.' : '뼈는 붙었소. 약초만 바르면 내일이라도 서겠소.' }, { who: 'g', text: g.wins >= 3 ? '고맙습니다. 다음 모래는 제가 밟겠습니다.' : '…아직 싸울 수 있습니다, 도미네.' }, { who: 'l', text: '값은 라니스타 몫이오. 손을 봅시다.' }]; // 의사 ↔ 검투사
  if (what === 'sell') { const p = sellPrice(g).toLocaleString();
    return [{ who: 'l', text: `상인이 값을 불렀다. ${p} HS.` }, { who: 'g', text: g.injured ? '이 몸으로도 사 간답니까, 도미네.' : g.wins >= 3 ? `${g.wins}승을 올린 저를… 파시는 겁니까.` : '…팔려 가는 겁니까, 도미네.' }, { who: 'l', text: '루두스도 먹고살아야지. 잘 가라.' }]; }
  if (what === 'release') return [{ who: 'l', text: g.status === 'doctor' ? '수고했다. 이제 제자들은 내가 맡지.' : '계약은 여기까지다. 목검은 두고 가라.' }, { who: 'g', text: g.status === 'doctor' ? '제자들을 잘 부탁드립니다, 도미네.' : '고맙습니다. 이 이름은 이 루두스가 만든 것입니다.' }, { who: 'l', text: '가서 네 이름으로 살아라.' }];
  const p = priceOf(S.st, g).toLocaleString();
  return [{ who: 'l', text: '이름이 뭐냐.' }, { who: 'g', text: g.origin === 'captive' ? `${g.name}. …포로입니다. 검을 쥐게 해 주십시오.` : g.origin === 'damnatus' ? `${g.name}입니다. 죄수지만 살아남을 줄은 압니다.` : `${g.name}입니다. 상인이 그렇게 불렀습니다.` }, { who: 'l', text: `${p} HS. 켈라에 자리를 마련하겠다.` }];
}
// 금화 줄: 동전 아이콘 + 굵은 금액 + 지불/획득 (+ 작은 주석)
function moneyRow(m: { amount: number; verb: string; note?: string }): Node {
  const ic = h('span', { class: 'coin' }); ic.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>';
  return h('div', { class: `moneyrow ${m.verb === '지불' ? 'pay' : 'gain'}` }, ic, h('b', {}, `${m.amount.toLocaleString()} HS`), h('span', { class: 'verb' }, m.verb), m.note ? h('span', { class: 'note' }, m.note) : null);
}
function confirmPage(): Node {
  const d = S.detail!; const g = (d.kind === 'roster' ? S.st.roster : S.st.market).find(x => x.id === d.id); if (!g) { delete d.confirm; return h('div'); }
  const what = d.confirm!; const O = CONFIG.origins;
  const lines: string[] = []; let okLabel = '', disabled = false, why = ''; let money: { amount: number; verb: string; note?: string } | null = null; // 왼쪽 금화 줄: 얼마 지불 / 얼마 획득
  if (what === 'sell') {
    const p = sellPrice(g); okLabel = '매각'; money = { amount: p, verb: '획득' };
    lines.push(`· 켈라 ${cellOf(S.st, g) + 1}번이 비고 유지비가 줄어든다`, '· 전적·기술·별칭은 함께 떠난다. 되사올 수 없다');
    if (assignedTo(g.id) != null) lines.push('· 이번 시즌 편성에서 빠진다');
  } else if (what === 'release') {
    okLabel = '내보내기'; money = { amount: 0, verb: '획득', note: '자유민이라 값을 받지 못한다' };
    lines.push(g.status === 'doctor' ? '· 독토르 급료가 사라지고 같은 유형 훈련 보너스도 끝난다' : '· 급료와 켈라 유지비가 사라진다', '· 다시 부를 수 없다');
  } else if (what === 'heal') {
    const cost = healCostOf(S.st); okLabel = '치료'; money = { amount: cost, verb: '지불' }; disabled = S.st.money < cost; why = S.st.money < cost ? `자금 ${(cost - S.st.money).toLocaleString()} HS 부족` : '';
    lines.push(`· 부상 ${g.injured}시즌이 지금 낫는다`, '· 이번 시즌 바로 출전할 수 있다', inBed(S.st, g) ? '· 침상이 비어 다른 부상자를 눕힐 수 있다' : '· 두면 침상에 누워야 시즌마다 1씩 낫는다 (요양은 2)');
  } else {
    const price = priceOf(S.st, g); const full = S.st.roster.length >= rosterCap(S.st); okLabel = '구매'; money = { amount: price, verb: '지불', note: price < g.buyPrice ? `해방노예 할인, 정가 ${g.buyPrice.toLocaleString()}` : undefined };
    disabled = S.st.money < price || full; why = S.st.money < price ? `자금 ${(price - S.st.money).toLocaleString()} HS 부족` : full ? `켈라 ${S.st.roster.length}/${rosterCap(S.st)} 가득 참` : '';
    lines.push(`· 켈라 ${S.st.roster.length}/${rosterCap(S.st)} → ${S.st.roster.length + 1}/${rosterCap(S.st)}, 유지비 늘어남`);
    if (g.origin === 'captive') lines.push(`· 전쟁 포로: 관중이 냉담해 미시오 ${Math.round(O.captive.missio * 100)}%`);
    if (g.origin === 'damnatus') lines.push(`· 형벌 죄수: 사망 배상 절반, ${O.damnatus.freeAfter}시즌 뒤 형기 만료로 자유민`);
  }
  // 확인: 붉은 라틴어 도장이 장면 위에 쾅 찍히고(북소리), 잠시 뒤 실행되며 페이지가 닫힌다
  const stampText = what === 'sell' ? 'VENDITVS' : what === 'release' ? 'DIMISSVS' : what === 'heal' ? 'SANATVS' : 'EMPTVS'; // 팔림 / 내보냄 / 나음 / 사들임
  let stamped = false;
  const doIt = () => {
    if (stamped) return; stamped = true;
    if (what === 'buy' && !canBuy(S.st, g)) return;
    const page = document.querySelector('.detailpage.confirm');
    if (page) page.append(h('div', { class: 'stamp' }, h('span', {}, stampText))); sfx.down(); window.setTimeout(() => sfx.drum(1), 40);
    if (what === 'heal') for (const sc of talkScenes) if (sc.g === g) sc.healed = performance.now() + 250; // 도장 뒤 일어선다
    window.setTimeout(() => {
      if (what === 'heal') { if (!heal(S.st, g)) return; sfx.coin(); S.notice = `${g.name} 이(가) 자리에서 일어났다`; }
      else if (what === 'sell') { sell(S.st, g); sfx.coin(); S.notice = `${g.name} 매각`; }
      else if (what === 'release') { release(S.st, g); S.notice = `${g.name} 이(가) 루두스를 떠났다`; }
      else { if (!buy(S.st, g)) return; sfx.coin(); S.marketSel = null; S.notice = `${g.name} 을(를) 들였다`; }
      S.detail = null; S.shownDetail = null; render();
    }, what === 'heal' ? 1400 : 900);
  };
  // 장면 캔버스 (무대 폭) + 말풍선 (검투사 위 왼쪽, 라니스타 위 오른쪽), 차례로 1.2초 간격
  const SW = 384, SH = 256; const c = document.createElement('canvas'); // 세로: 말풍선(위쪽 3줄)이 인물 머리를 가리지 않게 인물은 아래 반, 풍선은 위 반 c.width = SW * devicePixelRatio; c.height = SH * devicePixelRatio; c.style.width = SW + 'px'; c.style.height = SH + 'px'; c.className = 'talkcanvas'; // 장면 폭은 무대 폭에 맞춘다 (그림은 W 비율로 배치되어 그대로 따라온다)
  const e = { c, g, start: performance.now(), what }; talkScenes.add(e); drawTalkScene(e, 0);
  const bubbles = talkLines(g, what).map((l, i) => h('div', { class: `bubble ${l.who}`, style: `animation-delay:${0.25 + i * 1.2}s; top:${6 + i * 40}px` }, l.text)); // 순서대로 위에서 아래로 (대화 순서가 읽히게)
  return h('div', { class: 'detailpage confirm talk' },
    h('div', { class: 'talkscene' }, c, ...bubbles),
    h('div', { class: 'cbox row' }, h('div', { class: 'effects' }, money ? moneyRow(money) : null, ...lines.map(t => h('div', { class: 'effect' }, t))),
      h('div', { class: 'cbtns' }, why ? h('span', { class: 'hint', style: 'color:var(--red)' }, why) : null,
        h('button', { class: `sealbtn${disabled ? ' off' : ''}`, disabled, title: why || '도장을 찍어 확정합니다', onclick: doIt }, h('span', { class: 'latin' }, stampText), h('span', { class: 'ko' }, okLabel)))), // 도장 모양 버튼: 라틴어 도장 글자 + 아래 작은 한국어
    backBtn(closeConfirm, '상세로 돌아가기'));
}
// 페이지 왼쪽 위 뒤로가기 (화살표 아이콘)
function backBtn(onclick: () => void, title: string): Node {
  const b = h('button', { class: 'backbtn', title, 'aria-label': title, onclick });
  // 폼페이 낙서풍 화살표: 삐뚤한 겹선, 배경 없음
  b.innerHTML = `<svg viewBox="0 0 48 34" width="48" height="34" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M42 17 L30 16.5 L20 17.5 L9 17" stroke="#3a2412" stroke-width="2.6" opacity=".85"/>
    <path d="M43 19 L31 18.5 L21 19.4 L11 19" stroke="#3a2412" stroke-width="1.2" opacity=".55"/>
    <path d="M17 8 L12 12 L8 17.5 L12 23 L18 27" stroke="#3a2412" stroke-width="2.6" opacity=".85"/>
    <path d="M19 10 L14 13.5 L10.5 18 L14 22 L19 25" stroke="#3a2412" stroke-width="1.1" opacity=".5"/>
    <path d="M13 12.5 L9.5 17 L13 21.5" stroke="#9b2c1c" stroke-width="1.1" opacity=".55"/>
    <path d="M24 16.2 L36 15.8" stroke="#9b2c1c" stroke-width="1" opacity=".45"/>
  </svg>`;
  return b;
}
function detailPage(): Node {
  const d = S.detail!; const g = d.kind === 'roster' ? S.st.roster.find(x => x.id === d.id) : S.st.market.find(x => x.id === d.id);
  if (!g) { S.detail = null; return h('div'); }
  const again = S.shownDetail === `${d.kind}:${d.id}`; S.shownDetail = `${d.kind}:${d.id}`; // 같은 검투사가 이미 떠 있으면(확인 페이지를 열고 닫을 때의 재렌더) 슬라이드·걸어 들어오기를 반복하지 않는다
  const figure = portrait(g, 116, false, undefined, 170); figure.classList.add('big'); /* 초상 크기는 여기(인라인)가 정한다 — 폭 116(오른쪽에 기술 칩 3개가 든다), 높이 170(인물은 높이 기준으로 크게) */ if (!again) for (const e of portraits) if (e.c === figure) { e.enter = performance.now(); } // 큰 초상: 왼쪽에서 발소리를 내며 걸어 들어온다
  const status = d.kind === 'market' ? (g.rank === 'tiro' ? '티로' : '베테라누스') : g.status === 'doctor' ? '독토르' : g.status === 'rudiarius' ? '자유민' : g.rank === 'tiro' ? '티로' : isPrimusPalus(g) ? '프리무스 팔루스' : '베테라누스';
  const dskills = h('div', { class: 'gskills dskills' }, ...skillsOf(g).map(id => h('span', { class: 'badge skill', title: `${SKILL_BY_ID[id].name}: ${SKILL_BY_ID[id].desc}` }, SKILL_BY_ID[id].name)), ...Array.from({ length: Math.max(0, skillSlots(g) - skillsOf(g).length) }, () => h('span', { class: 'badge empty', title: '빈 기술 자리: 기술 훈련이나 경기 뒤 깨침으로 채운다' }, '\u00a0'))); // 편성 타일처럼 초상 오른쪽에 기술 칩과 빈 자리
  const left = h('div', { class: 'dleft' }, figure, h('div', { class: 'dinfo' }, h('div', { class: 'dname' }, sq(g.type), ' ', h('b', {}, g.name), h('span', { class: 'age' }, `${g.age ?? '?'}세`)), h('div', { class: 'meta dmeta' }, `${TYPE_KO[g.type]} · ${status}${g.lineage ? ` · 계보 ${LINEAGE_KO[g.lineage]}` : ''}`), dskills, h('div', { class: 'dbadges' }, ...epithetBadges(g, false)))); /* 초상은 왼쪽에 붙이고, 오른쪽에 이름·나이 → 유형·신분·계보 → 기술 칩 한 줄 → 그 아래 특징(별칭) 칩 */
  S.gladSel = g.id; S.marketSel = d.kind === 'market' ? g.id : S.marketSel;
  const { mid, side } = detailRight(g, d.kind);
  return h('div', { class: `detailpage${again ? ' still' : ''}` }, left, h('div', { class: 'dright' }, mid), h('div', { class: 'dright side' }, side),
    backBtn(closeDetail, d.kind === 'market' ? '판매대로 돌아가기' : '켈라로 돌아가기'));
}
// 상세 페이지 오른쪽: 왼쪽(초상·이름·유형·신분·별칭)과 겹치지 않게 능력치 → 전적 → 상태 → 기술 → 시즌 행동 → 행동 → 방 순서. 시장 노예는 능력치·전적·기술·출신·가격
const SEC_ICON: Record<string, string> = {
  stats: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/>',
  record: '<circle cx="12" cy="8" r="6"/><path d="M15.5 12.9 17 22l-5-3-5 3 1.5-9.1"/>',
  status: '<path d="M12 4v16M4 12h16"/>',
  skills: '<path d="M6 20 18 6"/><path d="M15 5l4 4"/><path d="M9 17 7 15"/>',
  plan: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  act: '<path d="M18 11V6a2 2 0 0 0-4 0v1a2 2 0 0 0-4 0v2a2 2 0 0 0-4 0v6a6 6 0 0 0 12 0v-1"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/>',
  room: '<path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-8h6v8"/>',
  origin: '<path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><circle cx="12" cy="12" r="10"/>',
};
function dsec(kind: string, title: string, ...kids: (Node | string | null)[]): Node {
  const ic = h('span', { class: 'dico' }); ic.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SEC_ICON[kind.split(' ')[0]]}</svg>`;
  return h('div', { class: `dbox ${kind}` }, h('div', { class: 'dhead' }, ic, h('span', {}, title)), h('div', { class: 'dbody' }, ...kids.filter((n): n is Node | string => !!n)));
}
const tile = (k: string, v: string, cls = '', title?: string) => h('div', { class: `tile ${cls}`, title }, h('span', { class: 'k' }, k), h('b', {}, v));
function detailRight(g: Gladiator, kind: 'roster' | 'market'): { mid: Node; side: Node } {
  const fat = g.fatigue ?? 0; const b = g.base;
  const statsRow = h('div', { class: 'tiles' }, ...([['HP', b.hp, '체력'], ['ATK', b.atk, '공격'], ['DEF', b.def, '방어'], ['SPD', b.spd, '속도'], ['RNG', b.range, '사거리']] as const).map(([k, v, t]) => tile(k, String(v), '', t)),
    fat ? tile('피로', String(fat), `fat${fat >= 3 ? ' bad' : ''}`, `첫 ${CONFIG.fatigue.free}점은 괜찮고, 그 위로 1점마다 공·방 −${CONFIG.fatigue.statPenalty}. ${CONFIG.fatigue.overworkAt} 이상인 채 시즌을 넘기면 과로사 위험`) : null);
  const recordRow = h('div', { class: 'tiles' }, tile('전적', `${g.wins}승 ${g.fights - g.wins}패`, '', '승/패. 승리를 쌓으면 베테라누스, 루디스, 별칭'), tile('미시오', String(g.missios), '', '져서 쓰러졌지만 관중이 살려 준 횟수'), tile('명예', String(g.honor ?? 0), '', '검투사의 명예. 미시오 확률과 별칭·루디스에 영향'), tile('팬', `${fansOf(g)}${fansOf(g) >= FANS_STAR ? '★' : ''}`, '', `관중의 팬. ${FANS_STAR} 이상이면 ★ 인기 검투사`));
  const statusBits: string[] = [];
  if (g.injured) statusBits.push(`부상 ${g.injured}시즌 남음`);
  if (g.status === 'rudiarius' && g.contractUntil != null) statusBits.push(`자유민 계약 ${Math.max(0, g.contractUntil - S.st.season + 1)}시즌 남음 · 급료 출전마다 대여료의 ${Math.round(CONFIG.rudiariusShare * 100)}%`);
  if (g.status === 'doctor') statusBits.push(`독토르로 ${TYPE_KO[g.type]} 훈련을 가르친다 · 급료 ${CONFIG.doctorSalary}/시즌`);
  if (g.fought) statusBits.push('이번 시즌 출전 완료');
  if (kind === 'roster' && g.origin === 'damnatus' && g.boughtSeason != null) statusBits.push(`형기 ${Math.max(0, CONFIG.origins.damnatus.freeAfter - (S.st.season - g.boughtSeason + 1))}시즌 뒤 자유`);
  const slots = skillSlots(g);
  // 가운데 열: 전적 → 능력치 → 기술 → 상태 → 시즌 행동 (시장: 출신)
  const mid: (Node | null)[] = [
    dsec('record', '전적', recordRow),
    dsec('stats', '능력치', statsRow),
    // (기술 칸은 초상 오른쪽 칩으로 옮김)
    statusBits.length ? dsec('status', '상태', ...statusBits.map(t => h('div', { class: 'line' }, t))) : null,
  ];
  const side: (Node | null)[] = [];
  if (kind === 'market') {
    const price = priceOf(S.st, g); const full = S.st.roster.length >= rosterCap(S.st); const O = CONFIG.origins;
    const originDesc = g.origin === 'captive' ? `전쟁 포로: 값 ${Math.round((1 - O.captive.price) * 100)}% 저렴, 공격 +${O.captive.atk}·HP +${O.captive.hp}. 관중이 이방인에게 냉담해 미시오 ${Math.round(O.captive.missio * 100)}%.` : g.origin === 'damnatus' ? `형벌 죄수: 값 ${Math.round((1 - O.damnatus.price) * 100)}% 저렴, 능력치 ${O.damnatus.stat}. 사망 배상 절반. ${O.damnatus.freeAfter}시즌 뒤 형기 만료로 자유민이 됨.` : '노예 상인이 데려온 검투사. 값은 능력치대로.';
    mid.push(dsec('origin', '출신', h('div', { class: 'line' }, originDesc)));
    side.push(dsec('act', '계약', h('div', { class: 'statrow col' }, h('button', { class: 'primary', disabled: S.st.money < price || full, title: full ? '켈라가 가득 찼습니다' : '', onclick: () => openConfirm(g, 'buy') }, `구매 ${price.toLocaleString()} HS${price < g.buyPrice ? ' (할인)' : ''}`), S.st.money < price ? h('span', { class: 'hint', style: 'color:var(--red)' }, `자금 ${(price - S.st.money).toLocaleString()} HS 부족`) : full ? h('span', { class: 'hint' }, `켈라 ${S.st.roster.length}/${rosterCap(S.st)} 가득 참`) : null)));
  } else {
    const k = cellOf(S.st, g); const q = S.st.ludus.cells[k] ?? 0, cost = k >= 0 ? upgradeCost(S.st, 'cell', k) : null;
    // (시즌 행동 칸은 뺐다 — 훈련은 팔루스 배치, 나머지는 자동. 치료는 아래 '행동'에)
    // 오른쪽 열: 켈라 → 행동 (치료·매각·재계약·내보내기)
    const CELL_FX = ['맨바닥', '피로 회복 −2', '피로 덜 쌓임(★마다 −15%)', '명예 +1/시즌']; // 숙소 질 0~3 효과 (★마다 유지비 +100)
    side.push(dsec('room', `켈라 ${k + 1}번`, h('div', { class: 'statrow col' }, h('span', { class: 'stars' }, '★'.repeat(q) + '☆'.repeat(CONFIG.ludus.cells.qualityCost.length - q)),
      h('div', { class: 'line' }, h('span', { class: 'k' }, '지금 '), CELL_FX[q]), q < CELL_FX.length - 1 ? h('div', { class: 'line' }, h('span', { class: 'k' }, '손보면 '), CELL_FX[q + 1]) : null, cost != null ? h('button', { disabled: !canPayFac(cost), title: '짚·침상·벽화를 들여 숙소를 낫게 한다', onclick: () => { if (upgrade(S.st, 'cell', k)) { sfx.coin(); render(); } } }, `방 손보기 ${cost.toLocaleString()}`) : h('span', { class: 'hint' }, '더 손볼 데 없음'))));
    const acts = gladActions(g).filter((n): n is Node => !!n); if (acts.length) side.push(dsec('act', '행동', h('div', { class: 'statrow col' }, ...acts)));
  }
  return { mid: h('div', { class: 'dmid' }, ...mid.filter((n): n is Node => !!n)), side: h('div', { class: 'dside' }, ...side.filter((n): n is Node => !!n)) };
}
function gladSheet(): Node {
  const g = S.st.roster.find(x => x.id === S.gladSel); if (!g) return h('div', { class: 'panel' }, h('h2', {}, '검투사'), h('div', { class: 'hint' }, '루두스를 떠났습니다.'));
  const k = cellOf(S.st, g); const q = S.st.ludus.cells[k] ?? 0, cost = k >= 0 ? upgradeCost(S.st, 'cell', k) : null;
  const cellRow = (j: number) => { const o = occupantOf(S.st, j), qj = S.st.ludus.cells[j] ?? 0; return h('div', { class: `drow${j === k ? ' sel' : ''}`, onclick: j === k ? undefined : () => { moveToCell(S.st, g, j); render(); } },
    h('span', { class: 'nm' }, `${j + 1}번`), h('span', { class: 'stars', style: 'margin-left:6px' }, '★'.repeat(qj) + '☆'.repeat(CONFIG.ludus.cells.qualityCost.length - qj)), o ? h('b', { style: 'margin-left:6px' }, o.name) : h('span', { class: 'meta' }, ' 빈 방'), h('span', { style: 'flex:1' }), j === k ? null : h('span', { class: 'hint' }, '옮기기 →')); }; // 방 줄: 번호 · ★ · 거주자 이름(굵게) — 누르면 그 방으로(사람이 있으면 자리를 바꾼다)
  return h('div', { class: 'panel' },
    h('h2', {}, `켈라 ${k + 1}번`, h('span', { class: 'stars', style: 'margin-left:8px' }, '★'.repeat(q) + '☆'.repeat(CONFIG.ludus.cells.qualityCost.length - q)), helpBtn('켈라와 검투사', '검투사가 자는 작은 방입니다. 방 장식이 상태입니다: 벽의 획수 = 승수(5승 묶음), 종려가지 = 5승마다, 월계관 = 명예 20 이상(40 이상 금빛), 하트 낙서 = 팬 스타, 목검 = 배운 기술 수, 오른쪽 벽 걸이 = 그 유형의 투구·방패·무기, 벽의 나무 검 = 자유민(루디스), 지팡이 = 독토르, 붕대·목발 = 부상. 피로는 자세로: 1 축 처져 앉음, 2 꾸벅임(z z), 3 벽에 기대 잠. 왼쪽 아래 ★ = 켈라 등급.\n\n숙소 질 ★1 피로 회복 −2 · ★2 유지비 −25% · ★3 명예 +1/시즌. 여기서 치료·매각·재훈련·재계약을 하고, 방을 강화하거나 다른 방으로 옮깁니다.')),
    gladCard(g, gladActions(g), { dis: !!g.injured }),
    h('div', { class: 'frow', style: 'margin-top:8px' }, h('div', { class: 'grow' }, h('b', {}, '이 방 강화'), h('div', { class: 'meta' }, '★1 피로 회복 −2 · ★2 피로 덜 쌓임 · ★3 명예 +1/시즌 (★마다 유지비 +100)')), cost != null ? h('button', { disabled: !canPayFac(cost), onclick: () => { if (upgrade(S.st, 'cell', k)) { sfx.coin(); render(); } } }, `방 손보기 ${cost.toLocaleString()}`) : h('span', { class: 'hint' }, '더 손볼 데 없음')),
    h('div', { class: 'two' }, // 왼쪽 시즌 행동 · 오른쪽 방 옮기기
      h('div', {}, h('h3', { class: 'sub' }, '시즌 행동', g.status === 'doctor' ? h('span', { class: 'hint', style: 'margin-left:6px' }, '독토르') : assignedTo(g.id) != null ? h('span', { class: 'hint', style: 'margin-left:6px' }, '출전 예정') : null),
        g.status !== 'doctor' ? h('div', { class: 'segcol' }, ...actionSeg(g)) : h('div', { class: 'hint' }, '가르치는 중')),
      )); // 방 옮기기는 켈라에서 스틱맨을 끌어서
}

// ── 후계: 은퇴한 라니스타의 뒤를 이을 사람을 고른다
function renderSuccession(): Node {
  const opts = successorOptions(S.st);
  return h('div', { class: 'overlay' }, h('div', { class: 'modal' },
    h('h2', {}, `${S.st.lanista.name} ${S.st.lanista.dead ? '사망' : '은퇴'}`, h('span', { class: 'hint', style: 'margin-left:10px;font-weight:400' }, `${S.st.lanista.age}세 · 후계자를 정하십시오`)),
    h('div', { class: 'hint', style: 'margin-bottom:8px' }, `자금·검투사·시설은 그대로 잇고, 호감도는 ${Math.round(CONFIG.lanista.fameKeep * 100)}%에 후계자의 명예 일부가 더해집니다. 독토르가 이으면 검투사 명단에서 빠집니다.`),
    ...opts.map(o => h('div', { class: 'card', onclick: () => { succeed(S.st, o); S.notice = `${S.st.lanista.name} 이(가) 루두스를 이어받았습니다.`; render(); } },
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
      row('결과', `살아남으면 ${Math.round(M.injuryChance * 100)}% 확률로 부상 (${injurySeasons(S.st)}시즌 출전 불가, 치료 ${healCostOf(S.st)} HS). 실패하면 사망하고 주최자가 배상 (구매가×${CONFIG.deathComp.priceMult} + 승수×${CONFIG.deathComp.perWin}).`)),
    sec('주최자 (에디토르)',
      ...(Object.keys(HOST) as (keyof typeof HOST)[]).map(k => { const H = HOST[k]; return row(H.ko, `${H.desc} 상금 ×${H.prize}, 대여료 ×${H.rent}, 미시오 ${H.missio >= 0 ? '+' : ''}${Math.round(H.missio * 100)}%, 루디스 ${H.rudis >= 0 ? '+' : ''}${Math.round(H.rudis * 100)}%${H.fameWin ? `, 승리 호감도 +${H.fameWin}` : ''}${H.honorAll ? `, 출전자 명예 +${H.honorAll}` : ''}.`); }),
      row('팬', `명예 + 승수×2 + 별칭×5. ${FANS_STAR} 이상이면 스타: 관중이 이름을 외치고 관중석이 더 차며, 선거 후보의 경기에서 이기면 호감도 +1 (폼페이 낙서의 팬심).`),
      row('내기 (스폰시오)', '기량 시합에 거는 내기는 로마법에서도 허용됐다(Digesta 11.5). 도박꾼 주최자의 계약에서 받으면 이길 때 상금 두 배, 지면 상금만큼 물어낸다.')),
    sec('경영',
      row('수입', `계약마다 대여료 (티로 ${CONFIG.rentTiro}, 베테라누스 ${CONFIG.rentVeteran}) + 승리 상금 (등급×${CONFIG.prizePerTier}). 대여료는 승패와 무관 (고증).`),
      row('출전 경비', `대여료의 ${Math.round(CONFIG.fightExpense.rentRate * 100)}% (장비 정비·식량·의료) + 등급×${CONFIG.fightExpense.perTier} (이동·호송) 이 경기마다 차감.`),
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
function renderDash(v: View = S.view, forNews = false): Node[] {
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
// 소식 배지: 정문 항목 중 할 일·경고 수
const newsCount = () => renderDash('ludus', true).filter(n => n instanceof HTMLElement && /\b(todo|warn)\b/.test(n.className)).length;
function newsBtn(): Node { const n = newsCount(); const b = h('button', { class: `newsbtn${S.sheet === 'news' ? ' on' : ''}`, title: '소식', onclick: () => { S.sheet = S.sheet === 'news' ? null : 'news'; S.cellsOpen = false; S.bedPick = null; S.palusMode = false; S.cellPop = null; S.cellSide = null; render(); } }); // 소식도 다른 시트·켈라와 배타적
  b.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/></svg>'; if (n) b.append(h('span', { class: 'nbadge' }, String(n))); return b; } // 두루마리(소식)

// ── 타운: 훈련장(0~1076) + 길(1076~1420) + 시장(1420~1940)을 한 장면으로. 카메라가 라니스타를 따라 옆으로 이동
const GY = 348; // 마을 공통 땅선. 258 → 348: 위에 하늘 90 유닛을 더 두어 지붕 위로 하늘이 보인다 (사용자, 세로 무대의 남는 높이를 장면이 쓴다). 장면 높이(TOWN_H 414)는 그만큼 함께 늘림
const MEDIC = { W: 420, H: 230 }; // 의무실: 훈련장 왼쪽의 독립 건물 (침상 최대 4, 의사 탁자, 약재 선반)
const TOWN = { padL: 420, padR: 420, gapW: 60, roadW: 380, forumX0: 40, forumW: 300, /* 포룸 300 + 시장까지 40: 세로 무대에 맞춰 포룸(440)과 길(520)을 줄였다 — 공고벽 200 + 제단이면 충분 */ get medicX() { return this.padL; }, get forumX() { return this.yardX + YARD.W + this.forumX0; }, wallW: 130, tailW: 290, get yardX() { return this.medicX + MEDIC.W + this.gapW; }, get marketX() { return this.yardX + YARD.W + this.roadW; }, get wallX() { return this.marketX + MARKET.W; }, get graveX() { return this.wallX + this.wallW; }, get W() { return this.graveX + this.tailW + this.padR; }, H: TOWN_H }; // 들판(padL) → 의무실 → 훈련소 → 포룸 → 시장 → 성벽(문) → 성문 밖 묘지 → 길(padR). 양 끝 여백 덕에 어느 장소든 화면 가운데에 온다
const lanista = { x: 0, target: 0, walking: false, v: 0, vmax: 340 }; // 실제 위치는 캔버스를 만들 때 restX(view) 로 잡는다
S.camX = 0; S.camV = 0; S.camPan = 0;
S.zoomIn = null; // 장면 줌인 연출 (포룸 공고벽 → 편성). wx/wy: 월드 초점, k: 최종 배율 // camPan: 좁은 화면에서 손가락으로 끌어 본 만큼의 오프셋 (이동하면 0)
// VIEW_W(보이는 폭, 월드 단위)는 위쪽 선언. 440: 라니스타 주변만 보이고 이웃 장소는 걸어가서 본다
S.VW = VIEW_W;
const restX = (v: View) => v === 'grave' ? TOWN.graveX + TOWN.tailW - 70 : v === 'market' ? TOWN.marketX + 44 : v === 'medic' ? TOWN.medicX + 250 : v === 'yard' ? TOWN.yardX + 84 : TOWN.forumX + FORUM.wallW + 40;   // 포룸: 공고벽 오른쪽 끝에 서서 벽을 본다 // 라니스타가 서는 자리 (의무실 앞 · 대련장과 팔루스 사이 · 정문 앞 · 시장 앞)
const clampCam = (x: number) => Math.max(0, Math.min(TOWN.W - S.VW, x));
// 카메라 기준 위치: 시장은 건물이 화면 가운데 조금 오른쪽. 루두스는 폭이 충분하면 훈련장 전체, 좁으면 라니스타 주변(화면 60% 지점)
const placeCenter = (v: View) => v === 'grave' ? TOWN.graveX + TOWN.tailW / 2 - 30 : v === 'market' ? TOWN.marketX + MARKET.W / 2 : v === 'medic' ? TOWN.medicX + MEDIC.W / 2 : v === 'yard' ? TOWN.yardX + 250 : TOWN.forumX + 50; // 장소의 가운데 (월드 x). 훈련소는 안뜰(무기고·연습장·팔루스)만, 정문(문루 470~600)은 포룸 화면에 속한다: 포룸 카메라를 왼쪽으로 당겨 문루 + 그 앞 지원자 + 공고벽이 한 화면에
const camFor = (v: View) => clampCam(placeCenter(v) - S.VW / 2); // 이동한 장소를 화면 가운데에, 양옆은 이웃 장소가 자연스럽게 이어진다
S.townCanvas = null; S.cellsCanvas = null; // cellsCanvas: 켈라 전용 덮개 캔버스 (마을 위, 처마 밑에서 무대 바닥까지). 마을 캔버스는 켈라를 열어도 크기가 변하지 않는다 // 한 번 만들고 유지 (화면 재구성 때 끊기지 않게)
function renderTown() {
  if (S.townCanvas && S.cellsCanvas) return h('div', { class: 'panel yardwrap' }, S.townCanvas, roadBoard());
  const c = h('canvas', { class: 'yard' }) as HTMLCanvasElement; S.townCanvas = c;
  const oc = h('canvas', { class: 'cellsoverlay' }) as HTMLCanvasElement; S.cellsCanvas = oc; const octx = oc.getContext('2d')!; // 켈라 덮개
  let zoom = 1, lastCw = 0, lastH = 0; c.style.height = CH() + 'px';
  const ctx = c.getContext('2d')!; ctx.scale(devicePixelRatio, devicePixelRatio);
  // 화면 폭에 맞춘다: 좁은 화면은 줌 0.8 까지만 줄이고 보이는 폭(VW)을 좁혀 라니스타 주변만 보여 준다 (찌그러짐 없음)
  const fit = () => {
    const cw = c.clientWidth, VH = CH(); if (!cw || (cw === lastCw && VH === lastH)) return; lastCw = cw; lastH = VH;
    zoom = cw / VIEW_W; S.VW = VIEW_W; // 보이는 폭을 폰 기준(404 유닛)으로 고정하고 화면 폭에 맞춰 확대 — PC 에서도 같은 장면이 보인다
    document.documentElement.style.setProperty('--yard-h', `${Math.round(VH * zoom)}px`);
    c.width = Math.round(cw * devicePixelRatio); c.height = Math.round(VH * zoom * devicePixelRatio); c.style.height = VH * zoom + 'px';
    ctx.setTransform(devicePixelRatio * zoom, 0, 0, devicePixelRatio * zoom, 0, 0);
    if (!lanista.walking) { S.camPan = 0; S.camX = camFor(S.view); S.camV = 0; }
  };
  if (!lanista.walking) { lanista.x = restX(S.view); lanista.target = lanista.x; S.camX = camFor(S.view); }
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
      if (dist <= Math.max(step, 1.5)) { lanista.x = lanista.target; lanista.walking = false; lanista.v = 0; S.travel = null; render(); requestAnimationFrame(draw); return; }
      lanista.x += Math.sign(d) * step;
    }
    // 카메라: 걷는 동안 라니스타를 따라가고(화면 40% 지점), 정지하면 장면 위치로
    // 카메라: 스프링 추종 (속도를 가져 출발·정지가 매끄럽다). 걷는 동안 진행 방향 앞쪽을 조금 더 보여줌
    // 카메라 목표: 출발 화면 위치 → 도착 화면 위치를 걸음 진행률로 잇는다 (도착 순간 목표가 튀지 않음)
    let camTarget = camFor(S.view) + S.camPan;
    { const k = 30, c2 = 2 * Math.sqrt(k); const a = (camTarget - S.camX) * k - S.camV * c2; S.camV += a * dt; S.camX += S.camV * dt; }
    ctx.clearRect(0, 0, S.VW, CH());
    ctx.save();
    if (S.zoomIn) { const e = Math.min(1, (performance.now() - S.zoomIn.start) / S.zoomIn.dur), ease = 1 - Math.pow(1 - e, 3); const z = 1 + (S.zoomIn.k - 1) * ease; const sx = S.zoomIn.wx - S.camX, sy = S.zoomIn.wy; ctx.translate(sx, sy); ctx.scale(z, z); ctx.translate(-sx, -sy); if (e >= 1 && !S.zoomIn.fired) { S.zoomIn.fired = true; const d = S.zoomIn.done; S.zoomIn = null; d(); } } // 초점(공고벽)을 향해 부드럽게 당긴다
    ctx.translate(-S.camX, 0);
    // ── 배경 층 (마을 전체에 이어짐)
    { const sky = ctx.createLinearGradient(0, 0, 0, GY - 120); sky.addColorStop(0, '#f1e7c9'); sky.addColorStop(1, '#e6d6ad'); ctx.fillStyle = sky; ctx.fillRect(0, 0, TOWN.W, CH()); } // 하늘: 위가 조금 밝은 회칠빛 (파랑은 낙서풍 팔레트와 어긋난다)
    // 거리 집 정면 (길 구간 + 시장 뒤까지): 지붕·창·문
    for (let x = TOWN.yardX + YARD.W - 40; x < TOWN.W; x += 118) {
      if (x + 104 > TOWN.marketX - 10) break; // 시장 광장 뒤는 회랑, 그 너머는 성벽과 성문 밖
      if (x + 104 > TOWN.forumX - 6 && x < TOWN.forumX + TOWN.forumW + 6) continue; // 포룸 자리는 비운다
      const hh = 70 + ((x / 118) % 3) * 14; const y0 = GY - 14 - hh;
      ctx.fillStyle = '#c9b283'; ctx.fillRect(x, y0, 104, hh);
      ctx.fillStyle = '#9b4a2c'; ctx.fillRect(x - 6, y0 - 12, 116, 14); // 기와 지붕
      ctx.fillStyle = '#7a6743'; ctx.fillRect(x + 14, y0 + 18, 16, 16); ctx.fillRect(x + 72, y0 + 18, 16, 16); // 창
      ctx.fillStyle = '#3a2412'; ctx.fillRect(x + 44, y0 + hh - 34, 18, 34); // 문
    }
    // 땅: 아래 띠만 (모래 → 포장길 → 광장, 서서히). 훈련장 구간은 마당 전체를 모래로
    { const g = ctx.createLinearGradient(0, 0, TOWN.W, 0); g.addColorStop(0, '#dccb9c'); g.addColorStop((TOWN.yardX + YARD.W) / TOWN.W, '#dccb9c'); g.addColorStop((TOWN.yardX + YARD.W + 120) / TOWN.W, '#cbb67f'); g.addColorStop((TOWN.marketX - 40) / TOWN.W, '#cbb67f'); g.addColorStop(TOWN.marketX / TOWN.W, '#d6c59a'); g.addColorStop(1, '#d6c59a');
      ctx.fillStyle = g; ctx.fillRect(0, GY - 14, TOWN.W, CH() - GY + 14);
      ctx.fillStyle = '#dccb9c'; ctx.fillRect(TOWN.yardX, GY - 210, YARD.W, CH()); /* 훈련장 모래 (지붕선 아래부터) */
      ctx.fillStyle = '#cbb67f'; ctx.fillRect(TOWN.medicX - 20, GY - 14, TOWN.yardX - TOWN.medicX + 20, CH()); /* 의무실 앞·사이 통로 */
      drawCountryside(ctx, 0, TOWN.medicX - 20, t, 'left'); drawCountryside(ctx, TOWN.graveX + TOWN.tailW, TOWN.padR, t, 'right'); } // 양 끝 들판과 길
    // 포장길 돌 무늬 (길 구간)
    ctx.strokeStyle = '#b9a26f'; ctx.lineWidth = 1; for (let x = TOWN.yardX + YARD.W + 10; x < TOWN.marketX + 20; x += 34) { for (let yy = GY - 4; yy < CH(); yy += 16) { ctx.beginPath(); ctx.moveTo(x + ((yy / 16) % 2) * 17, yy); ctx.lineTo(x + ((yy / 16) % 2) * 17 + 28, yy); ctx.stroke(); } }
    drawStreetProps(ctx, t); // 장소 사이의 소품: 우물·빨랫줄·수레·길가 사당·개·암포라 (장소가 자연스럽게 이어지게)
    // ── 구조물 층
    // 거리 행인: 길을 오간다 (주기적으로 왕복)
    // 루두스 문 밖의 자유민 지원자: 문루 앞 길에 서서 기다린다
    ctx.save(); ctx.translate(TOWN.yardX, GY - 210); drawYardScene(ctx, t); ctx.restore();          // 훈련장 (발 = 210 → GY)
    ctx.save(); ctx.translate(TOWN.medicX, GY - 210); drawMedicScene(ctx, t); ctx.restore();                 // 의무실 (독립 건물)
    ctx.save(); ctx.translate(TOWN.forumX, GY); drawForumScene(ctx, t); ctx.restore(); // 포룸(광장): 공고벽·제단·심부름꾼 (발 = GY)
    S.st.applicants.forEach((g, i) => { const x = TOWN.yardX + YARD.W - 58 - i * 26; drawStickman(ctx, g.type, { x, y: GY, scale: 0.9, skeleton: NPC_POSES.watch, t: t + i, ink: INK, bare: true, garment: 'tunic', garmentColor: '#b9c2a8', facing: -1 }); }); // 자유민 지원자: 루두스 문루 아래에 서서 훈련소 안을 본다 (계약을 청하러 찾아옴)
    ctx.save(); ctx.translate(TOWN.marketX + MK.ox, GY - MARKET.H * MK.sc); ctx.scale(MK.sc, MK.sc); drawMarketScene(ctx, t); ctx.restore(); // 시장: 조금 작게, 판매대 밑면이 땅(GY)에 닿게 뒤로 물려 길 뒤에 선다
    ctx.save(); ctx.translate(TOWN.wallX, GY); drawCityWall(ctx); ctx.restore();                  // 성벽과 성문 (시장과 묘지 사이)
    ctx.save(); ctx.translate(TOWN.graveX, GY); drawGraveScene(ctx, t); ctx.restore();
    { const span = TOWN.roadW + MARKET.W - 80; const p1 = TOWN.yardX + YARD.W + 40 + ((t * 38) % span), p2 = TOWN.wallX - 40 - ((t * 30 + 300) % span); // 거리 행인: 장면 앞(길 위)을 오간다. 성문 안쪽(길·시장)만
      drawCivilian(ctx, p1, GY + 4, 0.9, 'walk', t, 11, 1); drawCivilian(ctx, p2, GY + 4, 0.9, 'walk', t, 5, -1); } // 묘지 (성문 밖 길가 묘역, 발 = GY) // 시장 (판매대 윗면 = GY-30, 앞면·가격표가 디스플레이 안에 들어오도록)
    // 라니스타: 토가 입은 인물 (걷기 또는 서서 구경)
    { const facing: 1 | -1 = lanista.walking ? (lanista.target > lanista.x ? 1 : -1) : (S.view === 'market' || S.view === 'medic' || S.view === 'yard' ? 1 : -1); // 의무실: 의사(오른쪽)를 본다 · 포룸: 공고벽(왼쪽) · 훈련소: 왼쪽 끝에 서서 연습장·팔루스(오른쪽)를 본다 — 전엔 팔루스 첫 기둥 앞(268)에 서서 훈련하는 검투사와 겹쳤다 · 묘지: 묘비(왼쪽) // 묘지에서는 오른쪽 끝에 서서 왼쪽 묘비들을 본다 // 시장에서는 판매대 왼쪽 앞에 서서 오른쪽(매물)을 본다
      drawLanista(ctx, lanista.x, GY, facing, t * Math.max(0.4, lanista.walking ? lanista.v / 300 : 1), lanista.walking);
    }
    ctx.restore();
    // 켈라 화면: 시트(key-cells) 본문의 캔버스에 그린다. 마을 캔버스는 그대로
    S.cellsP = S.cellsOpen ? 1 : 0; // 열림/닫힘 모션은 시트 CSS(panelup/paneldown)가 맡는다
    if (S.cellsOpen && oc.isConnected) { const ow = oc.clientWidth, oh = oc.clientHeight; if (ow && oh) { const z = ow / VIEW_W; S.cellsH = Math.max(CELLS_MIN_H, Math.floor(oh / z)); const bw = Math.round(ow * devicePixelRatio), bh = Math.round(oh * devicePixelRatio); if (oc.width !== bw || oc.height !== bh) { oc.width = bw; oc.height = bh; }
      octx.setTransform(devicePixelRatio * z, 0, 0, devicePixelRatio * z, 0, 0); octx.clearRect(0, 0, VIEW_W, S.cellsH); drawCellsScene(octx, t); } }
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
  // 스와이프: 왼쪽으로 밀면 다음 장소, 오른쪽으로 밀면 이전 장소 (의무실 → 훈련소 → 정문 → 시장). 스와이프했으면 클릭으로 치지 않는다
  const ORDER: View[] = ['medic', 'yard', 'ludus', 'market', 'grave'];
  let drag: { x0: number; t0: number } | null = null; let dragged = false;
  const cellAt = (ev: PointerEvent | MouseEvent) => { const r = oc.getBoundingClientRect(); const lx = (ev.clientX - r.left) * (S.VW / r.width), ly = (ev.clientY - r.top) * (S.cellsH / r.height); const k = cellRects(0).findIndex(q => lx >= q.x && lx <= q.x + q.w && ly >= q.y && ly <= q.y + q.h); return { lx, ly, k: k < S.st.ludus.cells.length ? k : -1 }; }; // 증축 전 칸은 대상이 아니다
  c.onpointerdown = (ev) => { drag = { x0: ev.clientX, t0: performance.now() }; };
  oc.onpointerdown = (ev) => { if (!(S.cellsOpen && S.cellsP > 0.9)) return; const { lx, ly, k } = cellAt(ev); const occ = k >= 0 ? occupantOf(S.st, k) : null; if (occ) { S.cellDrag = { id: occ.id, k0: k, px: lx, py: ly, over: k, moved: false }; oc.setPointerCapture(ev.pointerId); } }; // 켈라: 사람이 있는 방에서 누르면 끌기 시작
  oc.onpointermove = (ev) => { if (!S.cellDrag) return; const { lx, ly, k } = cellAt(ev); if (Math.hypot(lx - S.cellDrag.px, ly - S.cellDrag.py) > 6) S.cellDrag.moved = true; S.cellDrag.px = lx; S.cellDrag.py = ly; S.cellDrag.over = k >= 0 ? k : null; };
  oc.onpointerup = () => { if (S.cellDrag) { const d = S.cellDrag; S.cellDrag = null; drag = null; if (d.moved) { dragged = true; const g = S.st.roster.find(x => x.id === d.id); if (g && d.over != null && d.over !== d.k0) { moveToCell(S.st, g, d.over); sfx.coin(); render(); } } } }; // 끌어서 놓으면 자리 바꿈 (놓은 방에 사람이 있으면 서로 교환). 안 움직였으면 클릭으로 처리
  c.onpointerup = (ev) => { if (!drag) return;
    if (S.cellsOpen) { drag = null; return; } const dx = ev.clientX - drag.x0, el = performance.now() - drag.t0; drag = null; dragged = Math.abs(dx) > 40 && el < 700;
    if (dragged) { const i = ORDER.indexOf(S.view); const to = ORDER[Math.max(0, Math.min(ORDER.length - 1, i + (dx < 0 ? 1 : -1)))]; if (to !== S.view) startTravel(to); } };
  c.onpointercancel = () => { drag = null; }; oc.onpointercancel = () => { S.cellDrag = null; };
  oc.onclick = (ev) => { // 켈라 덮개: 방 클릭 (배정 모드·상세)
    if (dragged) { dragged = false; return; } if (S.cellsP <= 0.9) return;
    const r = oc.getBoundingClientRect();
    { const lx = (ev.clientX - r.left) * (S.VW / r.width), ly = (ev.clientY - r.top) * (S.cellsH / r.height); const k = cellRects(0).findIndex(q => lx >= q.x && lx <= q.x + q.w && ly >= q.y && ly <= q.y + q.h); if (k >= S.st.ludus.cells.length) { S.sheet = 'facilities'; S.cellsOpen = false; render(); return; } if (k >= 0 && S.palusMode) { const occ = occupantOf(S.st, k); if (!occ) S.notice = '빈 방이다'; else if (palusOf(S.st, occ) >= 0) { leavePalus(S.st, occ); S.notice = `${occ.name} 이(가) 팔루스에서 내려왔다`; save(); }
        else { const free = Array.from({ length: S.st.ludus.palus }, (_, i) => i).find(i => !palusTrainee(S.st, i)); if (free == null) S.notice = `팔루스 ${S.st.ludus.palus}개가 모두 찼다`; else if (putAtPalus(S.st, occ, free)) { S.notice = `${occ.name} 을(를) 팔루스 ${free + 1}에 세웠다`; save(); } else S.notice = occ.injured > 0 ? '부상자는 훈련할 수 없다' : occ.status === 'doctor' ? '독토르는 가르치는 중이다' : '세울 수 없다'; }
        render(); return; } // 팔루스 배정 모드: 한 번 누르면 빈 자리에 세우고, 다시 누르면 내려온다. 켈라는 열린 채 (서판으로 닫는다)
            if (k >= 0 && S.bedPick != null) { const occ = occupantOf(S.st, k); if (occ && occ.injured > 0) { putInBed(S.st, occ, S.bedPick); S.notice = `${occ.name} 을(를) 침상 ${S.bedPick + 1}에 눕혔다`; S.bedPick = null; S.cellsOpen = false; } else S.notice = '부상자만 침상에 눕힐 수 있다'; render(); return; } // 침상 배정 모드
      if (k >= 0) { const occ = occupantOf(S.st, k); S.cellSel = k; const q = cellRects(S.st.ludus.cells.length)[k]; const ar = app.getBoundingClientRect(), sk = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--stage-k')) || 1; const cx = (r.left - ar.left) / sk + (q.x + q.w / 2) * (r.width / sk / S.VW), cy = (r.top - ar.top) / sk + (q.y + q.h / 2) * (r.height / sk / S.cellsH); if (occ) { S.gladSel = occ.id; S.detail = { kind: 'roster', id: occ.id }; S.cellPop = null; render(); return; } void cx; void cy; } return; } // 사람이 있는 방 → 검투사를 불러 상세 페이지(오른쪽에서). 빈 방은 아무것도 없음 (구매하면 자동 배정, 자리는 끌어서 바꾼다)
  };
  c.onclick = (ev) => { // 켈라 화면이면 방 클릭, 아니면 시장 매물 클릭 (카메라 보정)
    if (dragged) { dragged = false; return; }
    const r = c.getBoundingClientRect();
    if (S.view === 'grave') { S.sheet = 'chronicle'; render(); return; } // 묘비를 누르면 연대기 서랍
    if (S.view === 'medic') { // 침상 위 부상자를 누르면 치료 (확인 후). 침상이 모자라 탁자 옆에 앉은 부상자도 같다
      const lx = (ev.clientX - r.left) * (S.VW / r.width) + S.camX - TOWN.medicX, ly = (ev.clientY - r.top) * (CH() / r.height) - (GY - 210);
      const beds = Math.max(1, Math.min(4, S.st.ludus.beds)); const H = MEDIC.H;
      for (let i = 0; i < beds; i++) { const bx = 16 + i * 80; if (!(lx >= bx - 4 && lx <= bx + 88 && ly >= H - 90 && ly <= H - 4)) continue;
        const g = bedPatient(S.st, i);
        if (g) { openConfirm(g, 'heal'); return; } // 누운 부상자 → 치료 장면
        if (!S.st.roster.some(x => x.injured > 0 && !inBed(S.st, x))) { S.notice = '눕힐 부상자가 없다'; render(); return; }
        S.bedPick = i; S.cellsOpen = true; S.cellPop = null; S.cellSide = null; S.sheet = null; render(); return; } // 빈 침상 → 켈라에서 부상자 고르기
      return; } // 시설 강화는 왼쪽 망치 토글에서
    if (S.view === 'yard') { // 문루 아래 지원자를 누르면 계약 패널, 네메시스 사당을 누르면 설명과 이번 시즌 봉헌 여부
      const lx = (ev.clientX - r.left) * (S.VW / r.width) + S.camX - TOWN.yardX, ly = (ev.clientY - r.top) * (CH() / r.height) - (GY - 210);
      { const posts = palusPosts(S.st.ludus.palus), H = YARD.H; const first = posts[0] - 56, last = posts[posts.length - 1] + 12; // 팔루스 줄 전체 (기둥들과 그 왼쪽에 선 사람들)
        if (lx >= first && lx <= last && ly >= H - 104 && ly <= H - 8) { if (!S.st.roster.some(x => x.alive && x.injured <= 0 && x.status !== 'doctor')) { S.notice = '세울 검투사가 없다'; render(); return; } S.palusMode = true; S.bedPick = null; S.cellsOpen = true; S.cellPop = null; S.cellSide = null; S.sheet = null; render(); return; } } // 팔루스 줄을 누르면 켈라가 열려 배정 모드 (방을 누르면 세우고, 다시 누르면 내려온다)
      if (Math.abs(lx - YARD.W / 2) <= 30 && ly >= 30 && ly <= 86) void tell(`복수와 운명의 여신 네메시스의 감실입니다. 검투사들은 경기 전에 여기서 기도하고 봉헌했습니다(원형경기장 곁의 네메세움 비문 근거).\n이번 시즌 봉헌: ${S.st.events?.votum ? '함 (미시오 +3%)' : '안 함'}. 편성 화면의 시즌 행사에서 ${CONFIG.events.votum.cost} HS 로 봉헌하면 그 시즌 미시오 확률이 +${Math.round(CONFIG.events.votum.missio * 100)}% 오릅니다.`, '네메시스 사당');
      return; }
    if (S.view === 'ludus') { const lx = (ev.clientX - r.left) * (S.VW / r.width) + S.camX - TOWN.forumX, ly = (ev.clientY - r.top) * (CH() / r.height) - GY; // 포룸 기준 좌표 (발 = 0)
      { const yx = lx + (TOWN.forumX - TOWN.yardX), yy = ly + 210; if (S.st.applicants.length && yx >= YARD.W - 58 - S.st.applicants.length * 26 - 12 && yx <= YARD.W - 44 && yy >= 120 && yy <= 216) { S.sheet = 'applicants'; S.cellsOpen = false; render(); return; } } // 문루 아래 지원자 (문루는 훈련장 좌표에 그려지지만 포룸 화면에 보인다)
      if (lx >= 0 && lx <= FORUM.wallW + 20 && ly >= -186 && ly <= 8) { if (S.zoomIn) return; S.zoomIn = { start: performance.now(), dur: 560, wx: TOWN.forumX + FORUM.wallW / 2, wy: GY + FORUM.posterY0 + FORUM.posterGapY / 2 + FORUM.posterH / 2, k: Math.min(1.8, S.VW / FORUM.wallW), done: () => { S.phase = 'plan'; S.sheet = null; S.planSel = null; render(); } }; return; } // 공고벽·심부름꾼 → 줌인 연출 뒤 편성
      return; } // 소식은 헤더의 두루마리 아이콘에서
    if (S.view !== 'market') return; const x = ((ev.clientX - r.left) * (S.VW / r.width) + S.camX - TOWN.marketX - MK.ox) / MK.sc; // 시장 장면 좌표 (축소·가운데 정렬 반영)
    const items = S.st.market; let best: Gladiator | null = null, bd = items.length > 1 ? (marketSlotX(items.length, 1) - marketSlotX(items.length, 0)) / 2 : 80;
    items.forEach((g, i) => { const d = Math.abs(x - marketSlotX(items.length, i)); if (d < bd) { bd = d; best = g; } });
    S.marketSel = best ? (best as Gladiator).id : null; if (S.marketSel != null) { S.detail = { kind: 'market', id: S.marketSel }; S.sheet = null; } render(); // 판매대의 검투사를 누르면 상세 페이지 (오른쪽에서)
  };
  return h('div', { class: 'panel yardwrap' }, c, roadBoard());
}
// 디스플레이 상단의 장소 표지판: 누르면 그 장소로 화면이 옮겨가고 라니스타가 따라온다
// 이정표(밀리아리움): 돌기둥 위에 나무 화살표 팻말. 지금 있는 곳은 원판, 나머지는 그 방향을 가리킨다 (왼쪽 장소 ◀ / 오른쪽 장소 ▶)
const VIEW_LA: Record<View, string> = { medic: 'MEDICVS', yard: 'PALVS', ludus: 'FORVM', market: 'CATASTA', grave: 'SEPVLCRA' }; // 여정표·알붐의 라틴 새김: 의사 · 훈련 기둥 · 광장 · 노예 진열대 · 무덤
const roman = (n: number): string => { let r = ''; for (const [v, k] of [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']] as [number, string][]) while (n >= v) { r += k; n -= v; } return r || '—'; };
// 마을 아래 길가: 여정표 + 알붐. 방향을 가리키는 나무 팻말은 로마 것이 아니라서 뺐다
// 여정표(이티네라리움): 로마인은 지도 대신 역참을 순서대로 적은 목록으로 길을 알았다(안토니누스 여정표·비카렐로 은잔). 이 마을은 한 줄 길이라 목록이 곧 지도. 역참 사이 숫자는 파수스(걸음)
function itinerary(): Node {
  const order: View[] = ['medic', 'yard', 'ludus', 'market', 'grave']; const cur = order.indexOf(S.view);
  const passus = (a: View, b: View) => roman(Math.max(1, Math.round(Math.abs(placeCenter(b) - placeCenter(a)) / 4))); // 월드 4유닛 ≈ 1파수스 (분위기용 수치)
  return h('div', { class: 'itin' }, ...order.flatMap((v, i) => {
    const stn = h('button', { class: `stn${i === cur ? ' here' : ''}`, onclick: () => { if (v !== S.view) startTravel(v); }, title: i === cur ? '지금 여기' : `${VIEW_KO[v]}로` }, h('span', { class: 'la' }, VIEW_LA[v]), h('span', { class: 'ko' }, VIEW_KO[v]));
    return i < order.length - 1 ? [stn, h('span', { class: 'leg' }, h('span', { class: 'p' }, passus(v, order[i + 1])))] : [stn];
  }));
}
// 알붐(회칠한 게시벽)과 디핀티(붉은 글씨 공고): 포룸의 공고는 회칠 벽에 붉은 글씨로 썼다(폼페이 에딕타 무네룸). 이번 시즌 상황을 세계 안 물건으로 보여 준다. 줄을 누르면 그 장소로
function album(): Node {
  const lines: { la: string; n: number; ko: string; to?: View; warn?: boolean }[] = [];
  const cs = S.st.contracts, ok = cs.filter(c => canFulfill(S.st, c)).length;
  lines.push({ la: 'MVNERA', n: cs.length, ko: cs.length ? `계약 ${cs.length}건${ok < cs.length ? ` · 치를 수 있는 것 ${ok}` : ''}` : '이번 시즌 계약 없음', to: 'ludus' });
  lines.push({ la: 'VENALES', n: S.st.market.length, ko: S.st.market.length ? `시장 매물 ${S.st.market.length}명` : '시장 매물 없음', to: 'market' });
  if (S.st.applicants.length) lines.push({ la: 'AVCTORATI', n: S.st.applicants.length, ko: `문 앞 자유민 지원자 ${S.st.applicants.length}명`, to: 'ludus' }); // 정문(문루) 앞에 서 있다 — 정문은 포룸 화면
  const inj = S.st.roster.filter(g => g.alive && g.injured > 0).length;
  lines.push({ la: 'SAVCII', n: inj, ko: inj ? `부상 ${inj}명 · 치료 ${healCostOf(S.st).toLocaleString()} HS` : '부상자 없음', to: 'medic' });
  const tr = palusTrainees(S.st).length, cap = trainCap(S.st); lines.push({ la: 'PALVS', n: tr, ko: tr ? `팔루스 ${tr}/${cap} 훈련 중` : `팔루스 ${cap}개 비어 있다`, to: 'yard' }); // 세운 만큼만 훈련한다 (초과 없음)
  return h('div', { class: 'album' }, ...lines.map(l => h(l.to ? 'button' : 'div', { class: `dip${l.n ? '' : ' dim'}${l.warn ? ' warn' : ''}`, ...(l.to ? { onclick: () => { if (l.to !== S.view) startTravel(l.to!); } } : {}) },
    h('span', { class: 'la' }, `${l.la} · ${roman(l.n)}`), h('span', { class: 'ko' }, l.ko)))); // 아래 남는 벽은 빈 회칠 그대로 (사용자: 소식은 넣지 않는다)
}
function roadBoard(): Node {
  const covered = S.cellsOpen || (S.phase === 'manage' && !!S.sheet && ['facilities', 'doctors', 'rivals', 'news', 'market', 'applicants', 'chronicle'].includes(S.sheet)); // 켈라나 장면 패널이 덮으면 숨긴다
  return h('div', { class: `roadboard${covered ? ' hidden' : ''}` }, itinerary(), album());
}
// 라니스타: 크림색 토가(자주색 띠·주름), 짧은 머리·수염, 서판을 든 손. 발이 (x,y)
// 장소마다 다른 라니스타의 행동: 의무실 = 의사와 이야기(손짓) · 훈련소 = 서판 들고 보다가 이따금 지시(손가락질) · 포룸 = 공고를 올려다보며 읽고 서판에 적음 · 시장 = 몸을 숙여 매물을 살핌 · 묘지 = 고개 숙여 애도
function lanistaPose(v: View, t: number): Skeleton {
  const w = Math.sin(t * 2), slow = Math.sin(t * 0.9);
  switch (v) {
    case 'medic': return { ...NPC_POSES.point, lean: 4, frontArm: [70 + w * 18, 30 - w * 10], backArm: [-40, -25], headBob: 1 + slow };            // 손짓하며 말한다
    case 'yard': { const ph = (t % 6); return ph < 1.2 ? { ...NPC_POSES.point, frontArm: [125 + w * 4, 10] } : { ...NPC_POSES.tablet, headBob: slow * 1.5 }; }  // 6초마다 1.2초 지시
    case 'ludus': { const ph = (t % 7); return ph < 2.5 ? { ...NPC_POSES.tablet, lean: -4, frontArm: [150 + w * 3, 20], headBob: -3 } : { ...NPC_POSES.tablet, lean: 6, frontArm: [60, 55], headBob: 4 }; } // 공고를 올려다봄 ↔ 서판에 적음
    case 'market': return { ...NPC_POSES.tend, lean: 16 + w * 2, frontArm: [78 + w * 6, 28], backArm: [-38, -25], headBob: 5 };                        // 몸을 숙여 살핀다
    case 'grave': return { ...NPC_POSES.stand, lean: 10, frontArm: [40, 60], backArm: [40, 60], headBob: 9 + slow, frontLeg: [6, -2], backLeg: [-6, 2] };  // 두 손 모으고 고개 숙임
  }
}
function drawLanista(ctx: CanvasRenderingContext2D, x: number, y: number, facing: 1 | -1, t: number, walking: boolean) {
  // 기본 리그 + 토가(자주색 클라부스) + 서판. 걸을 때도 앞손은 서판을 든 채. 서 있을 땐 장소마다 다른 행동
  const sk: Skeleton = walking ? { ...walkSkeleton(t * 9, 0.8), frontArm: [55, 50] } : lanistaPose(S.view, t);
  drawStickman(ctx, 'murmillo', { x, y, scale: 1.0, facing, skeleton: sk, t, ink: INK, bare: true, garment: 'toga', garmentColor: '#f3ead0', beard: true, /* 클라부스 없음: 라니스타는 인파미스 신분 (고증) */
    hands: (c, f) => { c.fillStyle = '#d9c69a'; c.fillRect(f.hx - 2, f.hy - 12, 9, 12); c.strokeStyle = INK; c.lineWidth = 1; c.strokeRect(f.hx - 2, f.hy - 12, 9, 12); c.beginPath(); c.moveTo(f.hx, f.hy - 8); c.lineTo(f.hx + 5, f.hy - 8); c.moveTo(f.hx, f.hy - 4); c.lineTo(f.hx + 5, f.hy - 4); c.stroke(); } });
}
// 장소 이동: 화면(카메라·대시보드)이 먼저 새 장소로 옮겨가고, 라니스타는 화면 밖 가장자리에서 걸어 들어와 제자리에 선다
function startTravel(to: View) {
  if (to === S.view && !lanista.walking) return;
  S.camPan = 0; S.sheet = null; S.marketSel = null;
  const from = S.view; S.view = to; S.camV = 0;
  S.travel = { to, from, fromX: lanista.x, start: performance.now() };
  lanista.target = restX(to);
  // 지금 화면에 보이면 순간이동 없이 끝까지 걷는다 (먼 길은 걸음을 빠르게 해 2초 안팎). 이미 화면 밖이면 새 장소 가장자리에서 등장
  const onScreen = lanista.x >= S.camX - 10 && lanista.x <= S.camX + S.VW + 10;
  const cam = camFor(to);
  if (!onScreen) lanista.x = lanista.x < lanista.target ? cam - 30 : cam + S.VW + 30;
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
const MK = { sc: 0.8, get ox() { return (MARKET.W * (1 - this.sc)) / 2; } }; // 시장 장면 축소 배율과 가운데 정렬 여백
const marketSlotX = (n: number, i: number) => { const W = MARKET.W; const gap = Math.min(120, (W - 120) / Math.max(1, n - 1)); const startX = W / 2 - gap * (n - 1) / 2 + 10; return n === 1 ? W / 2 + 10 : startX + i * gap; };
const marketTagW = (n: number) => n > 1 ? Math.min(86, marketSlotX(n, 1) - marketSlotX(n, 0) - 8) : 86; // 가격표 폭
// 시장 장면을 (0,0) 기준으로 그린다
// 장소 사이 소품. 발 = GY
function drawStreetProps(ctx: CanvasRenderingContext2D, t: number) {
  const ink = INK; ctx.lineCap = 'round';
  { // 의무실 ↔ 훈련소 사이(60): 우물(푸테알)과 빨랫줄
    const x = TOWN.medicX + MEDIC.W + 30; ctx.fillStyle = '#b8a67a'; ctx.beginPath(); ctx.ellipse(x, GY - 4, 16, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#a58f60'; ctx.fillRect(x - 14, GY - 30, 28, 26); ctx.strokeStyle = '#8f7a4e'; ctx.lineWidth = 1; ctx.strokeRect(x - 14, GY - 30, 28, 26); ctx.fillStyle = '#5a4224'; ctx.beginPath(); ctx.ellipse(x, GY - 30, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 12, GY - 30); ctx.lineTo(x - 12, GY - 66); ctx.lineTo(x + 12, GY - 66); ctx.lineTo(x + 12, GY - 30); ctx.stroke(); ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, GY - 66); ctx.lineTo(x, GY - 44 + Math.sin(t * 1.3) * 3); ctx.stroke(); ctx.fillStyle = '#7a5a2c'; ctx.fillRect(x - 3, GY - 46 + Math.sin(t * 1.3) * 3, 6, 5); // 두레박
    ctx.strokeStyle = '#8f7a4e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(TOWN.medicX + MEDIC.W + 2, GY - 120); ctx.quadraticCurveTo(x, GY - 104, TOWN.yardX - 2, GY - 118); ctx.stroke(); // 빨랫줄
    for (let k = 0; k < 3; k++) { const cx = TOWN.medicX + MEDIC.W + 12 + k * 18, cy = GY - 114 + k * 2; ctx.fillStyle = k % 2 ? '#c9b283' : '#e8d9b5'; ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.sin(t * 2 + k) * 0.08); ctx.fillRect(-5, 0, 10, 14); ctx.restore(); } }
  { // 훈련소 문루 ↔ 포룸 사이(40): 암포라 실은 수레
    const x = TOWN.yardX + YARD.W + 12; ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 2; ctx.fillStyle = '#a5824a'; ctx.fillRect(x - 16, GY - 24, 32, 12); ctx.strokeRect(x - 16, GY - 24, 32, 12); ctx.beginPath(); ctx.arc(x - 8, GY - 6, 6, 0, Math.PI * 2); ctx.arc(x + 8, GY - 6, 6, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + 16, GY - 20); ctx.lineTo(x + 30, GY - 14); ctx.stroke();
    for (let k = 0; k < 3; k++) { const ax = x - 10 + k * 10; ctx.fillStyle = '#c9a86a'; ctx.beginPath(); ctx.ellipse(ax, GY - 30, 4, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#7a5a2c'; ctx.fillRect(ax - 2, GY - 39, 4, 3); } }
  { // 포룸 ↔ 시장 사이(40): 길가 사당(라라리움)과 개
    const x = TOWN.forumX + TOWN.forumW + 20; ctx.fillStyle = '#c9b283'; ctx.fillRect(x - 12, GY - 60, 24, 60); ctx.fillStyle = '#9b2c1c'; ctx.fillRect(x - 14, GY - 64, 28, 5); ctx.fillStyle = '#3a2412'; ctx.fillRect(x - 6, GY - 50, 12, 16); ctx.fillStyle = '#e8c96a'; ctx.beginPath(); ctx.ellipse(x, GY - 44 + Math.sin(t * 8) * 0.6, 2, 3.5, 0, 0, Math.PI * 2); ctx.fill(); // 감실 속 촛불
    { // 개: 목 없이 몸통 앞에 바로 붙은 머리(둥근 머리 + 주둥이 + 쫑긋 귀), 네 다리, 흔드는 꼬리. 이따금 고개를 든다
      const dx = x + 22 + Math.sin(t * 0.5) * 6, by = GY - 9, look = Math.sin(t * 0.7) > 0.6 ? -2 : 0;
      ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(dx - 8, by); ctx.lineTo(dx + 6, by); ctx.stroke(); // 몸통
      ctx.beginPath(); ctx.moveTo(dx - 6, by); ctx.lineTo(dx - 6, GY); ctx.moveTo(dx - 3, by); ctx.lineTo(dx - 3, GY); ctx.moveTo(dx + 2, by); ctx.lineTo(dx + 2, GY); ctx.moveTo(dx + 5, by); ctx.lineTo(dx + 5, GY); ctx.stroke(); // 다리 넷
      ctx.beginPath(); ctx.moveTo(dx - 8, by); ctx.lineTo(dx - 13, by - 5 + Math.sin(t * 6) * 2); ctx.stroke(); // 꼬리
      const hx = dx + 9, hy = by - 3 + look; // 머리: 몸통 앞끝에 바로
      ctx.beginPath(); ctx.ellipse(hx, hy, 4, 3.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(hx + 4, hy + 1, 3, 1.8, 0, 0, Math.PI * 2); ctx.fill(); // 주둥이
      ctx.beginPath(); ctx.moveTo(hx - 3, hy - 2); ctx.lineTo(hx - 2, hy - 7); ctx.lineTo(hx + 1, hy - 3); ctx.closePath(); ctx.fill(); // 귀
      ctx.fillStyle = '#e8d9b5'; ctx.beginPath(); ctx.arc(hx + 1, hy - 1, 0.8, 0, Math.PI * 2); ctx.fill(); // 눈
    } }
  { // 시장 ↔ 성벽: 성문 안쪽에 쌓아 둔 암포라와 짐
    const x = TOWN.wallX - 26; for (let k = 0; k < 4; k++) { const ax = x + (k % 3) * 9 - 9, ay = GY - 6 - Math.floor(k / 3) * 12; ctx.fillStyle = '#c9a86a'; ctx.beginPath(); ctx.ellipse(ax, ay - 7, 4, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 1; ctx.stroke(); } }
  { // 하늘: 새 두 마리가 마을 위를 천천히 가로지른다 (낙서풍 갈매기 획)
    for (let k = 0; k < 2; k++) { const span = TOWN.W + 200; const bx = ((t * (26 + k * 9) + k * 700) % span) - 100, by = 40 + k * 26 + Math.sin(t * 1.4 + k) * 6, flap = Math.sin(t * 7 + k * 2) * 3; ctx.strokeStyle = ink; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(bx - 7, by + flap); ctx.quadraticCurveTo(bx - 3, by - 3, bx, by); ctx.quadraticCurveTo(bx + 3, by - 3, bx + 7, by + flap); ctx.stroke(); } }
  { // 포룸 앞 길: 술집 카운터(테르모폴리움) — 돌 카운터에 박힌 항아리 셋과 걸린 간판
    const x = TOWN.forumX - 6; ctx.fillStyle = '#c9b283'; ctx.fillRect(x - 30, GY - 34, 34, 34); ctx.strokeStyle = '#8f7a4e'; ctx.lineWidth = 1; ctx.strokeRect(x - 30, GY - 34, 34, 34); for (let k = 0; k < 3; k++) { ctx.fillStyle = '#5a4224'; ctx.beginPath(); ctx.ellipse(x - 24 + k * 11, GY - 34, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#9b2c1c'; ctx.fillRect(x - 28, GY - 70, 30, 12); ctx.fillStyle = '#f3ead0'; ctx.font = 'bold 7px serif'; ctx.textAlign = 'center'; ctx.fillText('VINVM', x - 13, GY - 61); ctx.textAlign = 'left'; ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 13, GY - 70); ctx.lineTo(x - 13, GY - 80); ctx.stroke(); }
  { // 의무실 지붕 위 고양이 (꼬리를 흔들며 앉아 있다)
    const x = TOWN.medicX + 120, y = GY - 210 + 20; ctx.fillStyle = ink; ctx.beginPath(); ctx.ellipse(x, y - 6, 9, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(x + 9, y - 9, 4, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(x + 6, y - 12); ctx.lineTo(x + 7, y - 16); ctx.lineTo(x + 9, y - 12); ctx.moveTo(x + 10, y - 12); ctx.lineTo(x + 12, y - 16); ctx.lineTo(x + 12, y - 12); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x - 9, y - 5); ctx.quadraticCurveTo(x - 18, y - 8 + Math.sin(t * 2.5) * 4, x - 20, y - 16 + Math.sin(t * 2.5) * 6); ctx.stroke(); }
  { // 훈련소 회랑 지붕 위 비둘기 셋 (이따금 고개를 까딱)
    for (let k = 0; k < 3; k++) { const x = TOWN.yardX + 120 + k * 46 + (k % 2) * 8, y = GY - 210 - 2; const bob = Math.max(0, Math.sin(t * 3 + k * 2)) * 1.5; ctx.fillStyle = '#8a8a8a'; ctx.beginPath(); ctx.ellipse(x, y - 4, 5, 3.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(x + 4, y - 7 + bob, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 2, y - 1); ctx.lineTo(x - 2, y + 1); ctx.moveTo(x + 1, y - 1); ctx.lineTo(x + 1, y + 1); ctx.stroke(); } }
  { // 성벽 위 파수병: 흉벽 뒤에 서서(허리까지 성벽에 가려짐) 창을 들고 이따금 돌아본다. 성벽이 나중에 그려져 아래쪽을 덮는다
    const x = TOWN.wallX + TOWN.wallW / 2, y = GY - 200 + 4; drawCivilian(ctx, x, y, 0.7, 'watch', t, 41, Math.sin(t * 0.4) > 0 ? 1 : -1); ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 10, y - 14); ctx.lineTo(x + 10, y - 46); ctx.stroke(); ctx.fillStyle = '#8a8a8a'; ctx.beginPath(); ctx.moveTo(x + 10, y - 46); ctx.lineTo(x + 7, y - 52); ctx.lineTo(x + 10, y - 58); ctx.lineTo(x + 13, y - 52); ctx.closePath(); ctx.fill(); } // 창은 흉벽 위로 짧게 (화면 위에 잘리지 않게)
  { // 묘지 길가: 제물 그릇(과일)과 작은 화환, 꺼진 등잔 — 죽은 이를 기리는 흔적
    const x = TOWN.graveX + 96; ctx.fillStyle = '#a58f60'; ctx.beginPath(); ctx.ellipse(x, GY - 3, 8, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#9b2c1c'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x - 4 + k * 4, GY - 6 - (k % 2) * 2, 2, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = '#5f7a3c'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(x + 22, GY - 10, 6, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = '#e8c96a'; ctx.beginPath(); ctx.ellipse(x - 20, GY - 4, 4, 2.2, 0, 0, Math.PI * 2); ctx.fill(); }
  { // 시장 앞: 물통과 저울 (매물의 몸값을 잰다는 농담 겸 소품)
    const x = TOWN.marketX + MARKET.W - 24; ctx.fillStyle = '#8a7a58'; ctx.fillRect(x - 12, GY - 14, 24, 14); ctx.fillStyle = '#5a7a9b'; ctx.fillRect(x - 10, GY - 12, 20, 3);
    const sx = x - 34; ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, GY); ctx.lineTo(sx, GY - 40); ctx.moveTo(sx - 14, GY - 36 + Math.sin(t * 1.1) * 2); ctx.lineTo(sx + 14, GY - 36 - Math.sin(t * 1.1) * 2); ctx.stroke(); ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = 1; for (const d of [-14, 14]) { const py = GY - 36 + Math.sin(t * 1.1) * (d < 0 ? 2 : -2); ctx.beginPath(); ctx.moveTo(sx + d, py); ctx.lineTo(sx + d - 5, py + 9); ctx.lineTo(sx + d + 5, py + 9); ctx.closePath(); ctx.stroke(); } }
  { // 성문 밖 ↔ 묘지: 길가에 앉아 쉬는 나그네와 보따리
    const x = TOWN.graveX + 30; drawCivilian(ctx, x, GY, 0.85, 'watch', t, 31, 1); ctx.fillStyle = '#a58f60'; ctx.beginPath(); ctx.ellipse(x + 18, GY - 5, 8, 5, 0, 0, Math.PI * 2); ctx.fill(); }
}
// 마을 양 끝의 들판: 흙길이 이어지고, 올리브·사이프러스, 포도밭 이랑, 이정석(밀리아리움). 기준점 = 구간 왼쪽 끝, 발 = GY
function drawCountryside(ctx: CanvasRenderingContext2D, x0: number, w: number, t: number, side: 'left' | 'right') {
  ctx.save(); ctx.translate(x0, 0);
  ctx.fillStyle = '#d3c493'; ctx.fillRect(0, GY - 14, w, CH() - GY + 14); // 흙길
  ctx.fillStyle = '#c9c08a'; ctx.fillRect(0, GY - 60, w, 46); // 마른 풀밭
  ctx.strokeStyle = '#a5a06a'; ctx.lineWidth = 1; for (let x = 8; x < w; x += 22) { ctx.beginPath(); ctx.moveTo(x, GY - 20); ctx.lineTo(x + 6, GY - 32 - (x % 3) * 3); ctx.stroke(); } // 풀
  for (let k = 0; k < 4; k++) { const x = 40 + k * 90 + (side === 'right' ? 20 : 0); ctx.fillStyle = '#5f7a3c'; ctx.beginPath(); ctx.ellipse(x, GY - 96, 26, 22, 0, 0, Math.PI * 2); ctx.ellipse(x - 14, GY - 84, 18, 15, 0, 0, Math.PI * 2); ctx.ellipse(x + 16, GY - 86, 18, 15, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#4a3418'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, GY - 12); ctx.lineTo(x + 2, GY - 78); ctx.stroke(); } // 올리브 나무
  for (const cx of [w - 60, w - 34]) { ctx.fillStyle = '#3f4a2c'; ctx.beginPath(); ctx.moveTo(cx, GY - 150); ctx.quadraticCurveTo(cx + 12, GY - 90, cx + 8, GY - 12); ctx.lineTo(cx - 8, GY - 12); ctx.quadraticCurveTo(cx - 12, GY - 90, cx, GY - 150); ctx.closePath(); ctx.fill(); } // 사이프러스 둘
  { const mx = side === 'left' ? w - 120 : 60; ctx.fillStyle = '#b8a67a'; ctx.beginPath(); ctx.roundRect(mx - 8, GY - 44, 16, 44, 4); ctx.fill(); ctx.strokeStyle = '#8f7a4e'; ctx.stroke(); ctx.fillStyle = '#5a4224'; ctx.font = 'bold 8px serif'; ctx.textAlign = 'center'; ctx.fillText(side === 'left' ? 'XII' : 'XIII', mx, GY - 24); ctx.textAlign = 'left'; } // 이정석 (로마 마일)
  void t; ctx.restore();
}
// 포룸(광장): 뒤 회랑(열주·엔타블러처), 왼쪽 회벽에 이번 시즌 계약 공고문(에딕타: 붉은 글자, 등급이 높을수록 큼, 배정이 끝났으면 낙서 체크), 가운데 작은 제단, 공고 앞 심부름꾼, 오른쪽에 자유민 지원자. 기준점 = 광장 왼쪽 끝, 발 = 0
const FORUM = { wallW: 200, posterW: 52, posterH: 66, posterGapX: 68, posterGapY: 74, posterX0: 40, posterY0: -170, posterAt: (i: number) => ({ x: 40 + (i % 2) * 68, y: -170 + Math.floor(i / 2) * 74 }) }; // 공고 2×2 (52×66). 벽 위가 처마(캔버스 위 ~54 유닛)에 가리지 않게 벽 꼭대기는 -178 까지만 // 공고벽: 공고 4장이 한 줄에, 계약 카드와 같은 세로 비율 (줌인하면 카드로 이어진다)
// 공고문 = 계약 카드의 축소판. 위: 붉은 등급 칩 · 벽화풍 경기장 · 배정 수 / 가운데: 붉은 경기장 이름 / 아래: 효과 칩 줄(작은 알약). 배정이 끝나면 낙서 체크
function drawMiniContract(ctx: CanvasRenderingContext2D, c: Contract, px0: number, py0: number, pw0: number, ph0: number) {
  const k = pw0 / 70; ctx.save(); ctx.translate(px0, py0); ctx.scale(k, k); const px = 0, py = 0, pw = 70, ph = ph0 / k; // 70×98 기준으로 그리고 배율로 줄인다
  const OCHRE = '#9b2c1c', SOOT = '#3a2412';
  ctx.fillStyle = '#efe5c9'; ctx.fillRect(px, py, pw, ph); ctx.strokeStyle = '#b9a26f'; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
  // 등급 칩
  ctx.fillStyle = OCHRE; ctx.beginPath(); ctx.roundRect(px + 4, py + 5, 20, 8, 4); ctx.fill(); ctx.fillStyle = '#f3ead0'; ctx.font = 'bold 6px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`등급 ${c.tier}`, px + 6, py + 11.3);
  // 경기장: 벽화풍 겹선 타원 (등급만큼 단)
  { const cx = px + pw / 2, cy = py + 10, rings = c.tier === 1 ? 2 : c.tier === 2 ? 3 : 4; ctx.lineWidth = 0.9; // 경기장은 공고 가운데 (카드와 같게)
    for (let r = rings; r >= 1; r--) { ctx.strokeStyle = SOOT; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.ellipse(cx, cy, 3.5 + r * 1.6, 1.8 + r * 0.9, 0, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = OCHRE; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.ellipse(cx + 0.4, cy + 0.3, 3.5 + r * 1.6, 1.8 + r * 0.9, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.fillStyle = OCHRE; ctx.globalAlpha = 0.2; ctx.beginPath(); ctx.ellipse(cx, cy, 3.5, 1.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; ctx.fillRect(cx - 1.5, cy - 4.5, 3, 1.2);
    if (c.tier === 3) { ctx.strokeStyle = OCHRE; ctx.lineWidth = 1; ctx.beginPath(); for (let k = 0; k < 3; k++) { ctx.moveTo(cx - 8 + k * 6, cy - 6); ctx.quadraticCurveTo(cx - 5 + k * 6, cy - 9, cx - 2 + k * 6, cy - 6); } ctx.stroke(); } }
  // 배정 수
  const team = (S.assign[c.id] ?? []); ctx.fillStyle = SOOT; ctx.font = 'bold 6.5px sans-serif'; ctx.textAlign = 'right'; ctx.fillText(`${team.length}/${c.size}`, px + pw - 4, py + 12);
  // 경기장 이름 (붉은 글씨, 두 줄까지) → 규모·주최 줄 → 지렁이 글씨 → 왼쪽 아래 상금 (계약 카드와 같은 배치)
  ctx.textAlign = 'left'; const l2 = ''; { const y = py + 26, len = pw - 12 - ((c.id * 7) % 12); ctx.strokeStyle = OCHRE; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.globalAlpha = 0.9; // 경기장 이름: 굵은 붉은 지렁이 글씨 한 줄 (글자는 이 크기에서 넘치거나 뭉개진다)
    ctx.beginPath(); ctx.moveTo(px + 5, y); for (let x = 2; x <= len; x += 2) ctx.lineTo(px + 5 + x, y + Math.sin((x + c.id) * 1.2) * 1.4); ctx.stroke(); ctx.globalAlpha = 1; }
  { const my = py + (l2 ? 46 : 36); ctx.fillStyle = '#e4d3a4'; ctx.beginPath(); ctx.roundRect(px + 4, my - 6, 14, 8, 2); ctx.fill(); ctx.fillStyle = SOOT; ctx.font = 'bold 5.5px sans-serif'; ctx.fillText(`${c.size}대${c.size}`, px + 5.5, my); // 규모 칩
    const H = HOST[c.host]; if (c.host === 'magistrate') { ctx.strokeStyle = '#c9b283'; ctx.lineWidth = 0.6; ctx.strokeRect(px + 21, my - 6, 22, 8); ctx.fillStyle = 'rgba(58,36,18,.6)'; } else { ctx.fillStyle = c.host === 'imperial' ? '#9b2c1c' : c.host === 'gambler' ? '#e8c96a' : c.host === 'mourner' ? '#b8a6a6' : c.host === 'miser' ? '#d9d2b8' : '#e4d3a4'; ctx.beginPath(); ctx.roundRect(px + 21, my - 6, 22, 8, 2); ctx.fill(); ctx.fillStyle = c.host === 'imperial' ? '#fff' : '#5a3a1c'; }
    ctx.font = 'bold 5.5px sans-serif'; ctx.fillText(H.short, px + 23, my); } // 주최 칩
  { const y0 = py + (l2 ? 56 : 46); ctx.strokeStyle = OCHRE; ctx.lineWidth = 1.1; ctx.lineCap = 'round'; ctx.globalAlpha = 0.75; // 본문: 붉은 지렁이 글씨 세 줄
    for (let k = 0; k < 3; k++) { const y = y0 + k * 8; const len = pw - 10 - ((k * 7 + c.id * 5) % 22); ctx.beginPath(); ctx.moveTo(px + 5, y); for (let x = 2; x <= len; x += 2) ctx.lineTo(px + 5 + x, y + Math.sin((x + k * 3) * 1.4) * 1.1); ctx.stroke(); }
    ctx.globalAlpha = 1; }
  { const by = py + ph - 6; ctx.strokeStyle = 'rgba(58,36,18,.2)'; ctx.lineWidth = 0.6; ctx.setLineDash([1.5, 1.5]); ctx.beginPath(); ctx.moveTo(px + 4, by - 9); ctx.lineTo(px + pw - 4, by - 9); ctx.stroke(); ctx.setLineDash([]); // 상금: 점선 위, 왼쪽 아래에 금화 + 굵은 숫자
    ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(px + 8, by - 2.5, 2.6, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(px + 11, by - 1, 2.6, Math.PI * 1.1, Math.PI * 0.4); ctx.stroke();
    ctx.fillStyle = SOOT; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`${(hostPrize(c) * (c.bet ? 2 : 1)).toLocaleString()}`, px + 16, by); ctx.font = '5px sans-serif'; ctx.fillStyle = 'rgba(58,36,18,.6)'; const nw = ctx.measureText(`${(hostPrize(c) * (c.bet ? 2 : 1)).toLocaleString()}`).width; ctx.font = '5px sans-serif'; ctx.fillText('HS', px + 16 + nw * 1.6 + 2, by); }
  // 배정 완료 낙서 체크 (계약 카드의 체크와 같은 자리: 경기장 그림 위)
  if (team.length >= c.size && !validTeam(S.st, c, team.map(id => S.st.roster.find(g => g.id === id)!).filter(Boolean))) { ctx.strokeStyle = SOOT; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.moveTo(px + 25, py + 9); ctx.lineTo(px + 31, py + 16); ctx.lineTo(px + 45, py + 3); ctx.stroke(); ctx.globalAlpha = 1; }
  ctx.restore();
}
function drawForumScene(ctx: CanvasRenderingContext2D, t: number) {
  const W = TOWN.forumW, ink = INK;
  // 회랑: 뒤 벽 + 기둥 + 엔타블러처·지붕
  ctx.fillStyle = '#d9c9a2'; ctx.fillRect(0, -184, W, 170); ctx.fillStyle = '#9b4a2c'; ctx.fillRect(-8, -196, W + 16, 12); ctx.fillStyle = '#b39c6a'; ctx.fillRect(0, -184, W, 6); // 세로 무대: 공고 2×2 가 들어가게 벽을 높였다
  for (let x = FORUM.wallW + 10; x < W - 10; x += 52) { ctx.fillStyle = '#e6d6ad'; ctx.fillRect(x, -178, 10, 164); ctx.fillStyle = '#a58f60'; ctx.fillRect(x - 2, -178, 14, 5); ctx.fillRect(x - 2, -18, 14, 4); } // 열주
  for (let x = FORUM.wallW + 36; x < W - 20; x += 52) { ctx.fillStyle = '#7a6743'; ctx.beginPath(); ctx.moveTo(x - 12, -18); ctx.lineTo(x - 12, -60); ctx.arc(x, -60, 12, Math.PI, 0); ctx.lineTo(x + 12, -18); ctx.closePath(); ctx.fill(); } // 기둥 사이 아치 그늘
  // 공고벽(왼쪽): 회벽 + 붉은 띠
  ctx.fillStyle = '#e2d3ab'; ctx.fillRect(0, -178, FORUM.wallW, 164); ctx.fillStyle = '#9b2c1c'; ctx.globalAlpha = 0.5; ctx.fillRect(0, -32, FORUM.wallW, 8); ctx.globalAlpha = 1;
  ctx.fillStyle = ink; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('MVNERA', 8, -20); // 벽 아래 붉은 띠 옆 (위쪽은 처마에 가린다) // 벽 머리에 긁어 쓴 글자
  // 공고문: 계약마다 하나. 등급이 높을수록 크고 붉은 글자 줄이 많다. 배정이 끝난 계약엔 낙서 체크
  for (let i = S.st.contracts.length; i < 4; i++) { const { x: px, y: py } = FORUM.posterAt(i); ctx.strokeStyle = 'rgba(155,44,28,.25)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.strokeRect(px + 0.5, py + 0.5, FORUM.posterW, FORUM.posterH); ctx.setLineDash([]); } // 빈 자리: 옛 공고를 긁어낸 자국
  S.st.contracts.forEach((c, i) => { const { x: px, y: py } = FORUM.posterAt(i); drawMiniContract(ctx, c, px, py, FORUM.posterW, FORUM.posterH); }); // 2×2
  // 제단(가운데): 돌 제단 + 불
  { const ax = FORUM.wallW + 50; ctx.fillStyle = '#b39c6a'; ctx.fillRect(ax - 12, -26, 24, 26); ctx.fillStyle = '#a58f60'; ctx.fillRect(ax - 15, -30, 30, 5); ctx.fillStyle = '#e8c96a'; ctx.beginPath(); ctx.ellipse(ax, -34 + Math.sin(t * 9) * 0.8, 3, 5, 0, 0, Math.PI * 2); ctx.fill(); }
  // 구경꾼: 벽을 따라 걷다가 공고 앞에 멈춰 구경하고(팔짱·손가락질·발돋움) 다시 걸어간다. 세 사람이 서로 다른 주기·경로로
  { const n = Math.max(1, S.st.contracts.length); const posterX = (i: number) => FORUM.posterAt(i % n).x + FORUM.posterW / 2;
    const walkers: { period: number; off: number; a: number; b: number; pose: 'watch' | 'point' | 'tiptoe'; face: 1 | -1; scale: number; seed: number }[] = [
      { period: 26, off: 0, a: 0, b: 2, pose: 'watch', face: 1, scale: 0.85, seed: 20 }, { period: 31, off: 11, a: 1, b: 3, pose: 'point', face: -1, scale: 0.8, seed: 21 }, { period: 23, off: 19, a: 3, b: 1, pose: 'tiptoe', face: 1, scale: 0.9, seed: 22 }];
    for (const w of walkers) { const u = ((t + w.off) % w.period) / w.period; const L = -40, R = FORUM.wallW + 60; const pa = posterX(w.a) + 14, pb = posterX(w.b) - 14; const dir: 1 | -1 = pa <= pb ? 1 : -1; // 왼쪽에서 들어와 두 공고를 들르고 오른쪽으로 나간다 (b 가 앞이면 되돌아간다)
      const ease = (k: number) => k * k * (3 - 2 * k); let x: number, walking = true, pose: 'watch' | 'point' | 'tiptoe' = w.pose, facing: 1 | -1 = 1;
      if (u < 0.2) { x = L + (pa - L) * ease(u / 0.2); } else if (u < 0.42) { x = pa; walking = false; facing = w.face; } else if (u < 0.62) { x = pa + (pb - pa) * ease((u - 0.42) / 0.2); facing = dir; } else if (u < 0.82) { x = pb; walking = false; pose = w.pose === 'watch' ? 'point' : 'watch'; facing = -w.face as 1 | -1; } else { x = pb + (R - pb) * ease((u - 0.82) / 0.18); }
      drawCivilian(ctx, x, 0, w.scale, walking ? 'walk' : pose, t, w.seed, facing); } }
  // 자유민 지원자: 광장 오른쪽에 서서 기다린다
}
function drawMarketScene(ctx: CanvasRenderingContext2D, t: number) {
  const W = MARKET.W, H = MARKET.H;
  const items = S.st.market;
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
    drawStickman(ctx, 'murmillo', { x: W - 26, y: H - 68, scale: 0.9, facing: -1, skeleton: NPC_POSES.tablet, t, ink, bare: true, garment: 'tunic', garmentColor: '#c8a878', garmentStripe: '#7a1f16',
      hands: (c, f) => { c.fillStyle = '#e8d9b5'; c.fillRect(f.hx - 2, f.hy - 12, 9, 13); c.strokeStyle = ink; c.lineWidth = 1; c.strokeRect(f.hx - 2, f.hy - 12, 9, 13); } });
    if (!items.length) return; // 매물 없음: 빈 카타스타만 (안내는 대시보드에)
    // 사슬: 목 고리 사이를 늘어진 곡선(카테너리 느낌)으로, 작은 고리들이 곡선을 따라 이어짐. 살짝 흔들림
    const neckOf = (g: Gladiator, i: number) => { const sel = g.id === S.marketSel; const sc0 = sel ? 1.05 : 0.95; return { x: slotX(i) - 1 * sc0, y: H - 68 + (sel ? 8 : 0) - 44 * sc0 }; };
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
      const sel = g.id === S.marketSel, dim = S.marketSel != null && !sel;
      const x = slotX(i), y = H - 68 + (sel ? 8 : 0);
      ctx.globalAlpha = dim ? 0.45 : 1;
      const team = g.rank === 'veteranus' ? '#2c4f9b' : '#6e7f9b';
      const sc0 = sel ? 1.05 : 0.95;
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
const palusPosts = (n: number) => Array.from({ length: n }, (_, i) => 300 + i * (n <= 2 ? 44 : n === 3 ? 38 : n === 4 ? 32 : n <= 6 ? 26 : 22)); // 팔루스 x (훈련장 좌표): 급식소를 뺀 자리부터 300~454, 8개도 문루(470) 앞에 선다 // 팔루스 x (훈련장 좌표, 연습장 오른쪽). 그림과 클릭이 같은 자리를 쓴다\n// 채찍 물리 상태 (프레임 간 유지)
const WN = 18, WSEG = 4.2;
// 의사(메디쿠스): 환자가 있으면 선반(집)과 침상 사이를 오가며 치료. 좌표는 훈련장 기준
const medic = { x: 330, mode: 'home' as 'home' | 'go' | 'tend' | 'back', act: 'grind' as 'grind' | 'shelf' | 'tend' | 'lean' | 'cup', until: 0, target: 330, bed: 0, last: -1, seed: 1 };
const whipState = { p: [] as { x: number; y: number; px: number; py: number }[], last: -1, crackT: -9, crackX: 0 };
export type StickPose = 'stand' | 'point' | 'stir' | 'tend' | 'whip' | 'walk' | 'grind' | 'shelf' | 'lean' | 'cup';
S.stickFn = null; // 훈련장이 매 프레임 넘겨 주는 보조 인물 그리기
// 의무실 장면 (0,0) 기준, 발 = H-20. 침상은 시설 수(최대 4)만큼, 부상자가 그 위에 눕고 넘치면 벽가에 앉는다. 의사는 탁자와 침상을 오간다
function drawMedicScene(ctx: CanvasRenderingContext2D, t: number) {
  const W = MEDIC.W, H = MEDIC.H; const stick = S.stickFn; if (!stick) return;
  const beds0 = Math.max(1, Math.min(4, S.st.ludus.beds)); const occupied = Array.from({ length: beds0 }, (_, i) => bedPatient(S.st, i)); const occIdx = occupied.map((g, i) => g ? i : -1).filter(i => i >= 0); // 침상마다 누운 부상자 (없으면 빈 침상)
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
  const beds = Math.max(1, Math.min(4, S.st.ludus.beds)); const bedX = Array.from({ length: beds }, (_, i) => 16 + i * 80);
  ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 3; ctx.beginPath();
  for (const bx of bedX) { ctx.moveTo(bx, H - 40); ctx.lineTo(bx + 74, H - 40); ctx.moveTo(bx + 4, H - 40); ctx.lineTo(bx + 4, H - 24); ctx.moveTo(bx + 70, H - 40); ctx.lineTo(bx + 70, H - 24); }
  ctx.stroke();
  ctx.fillStyle = '#e8d9b5'; for (const bx of bedX) ctx.fillRect(bx + 2, H - 45, 70, 5); // 매트리스
  // 의사 탁자(약절구) + 선반(약병) + 약재 다발 (약재 단계만큼 천장에 매달림)
  const TX = 350;
  ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(TX - 6, H - 46); ctx.lineTo(TX + 38, H - 46); ctx.moveTo(TX - 2, H - 46); ctx.lineTo(TX - 2, H - 24); ctx.moveTo(TX + 34, H - 46); ctx.lineTo(TX + 34, H - 24); ctx.stroke();
  ctx.fillStyle = '#8f7a4e'; ctx.beginPath(); ctx.moveTo(TX + 6, H - 46); ctx.lineTo(TX + 26, H - 46); ctx.lineTo(TX + 23, H - 55); ctx.lineTo(TX + 9, H - 55); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#8a6a44'; ctx.fillRect(TX - 10, 118, 58, 3); for (let k = 0; k < 2 + Math.min(3, S.st.ludus.medicine); k++) { ctx.fillStyle = ['#b9a26f', '#9b2c1c', '#b9a26f', '#5a4224', '#3b7a2c'][k % 5]; ctx.fillRect(TX - 6 + k * 11, 108, 7, 10); }
  for (let k = 0; k < S.st.ludus.herbs; k++) { const hx = 300 - k * 22; ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx, 38); ctx.lineTo(hx, 52); ctx.stroke(); ctx.fillStyle = '#5f7a3c'; ctx.beginPath(); ctx.moveTo(hx, 50); ctx.lineTo(hx - 6, 68); ctx.lineTo(hx + 6, 68); ctx.closePath(); ctx.fill(); }
  if (S.st.ludus.medicine >= 3) stick(W - 18, H - 22, 0.9, 'tend', t, 9, -1); // 의술 3단계: 조수
  { // 의사: 탁자 앞에서 약을 빻거나 선반에서 약병을 꺼내고, 환자가 있으면 붕대 뭉치를 들고 침상으로 가 붕대·살피기·물 먹이기 중 하나를 한 뒤 돌아온다
    const dt = medic.last < 0 ? 0 : Math.min(0.05, t - medic.last); medic.last = t;
    const HOME = TX - 20; const bedSide = (k: number) => bedX[occIdx[k % Math.max(1, occIdx.length)] ?? 0] + 62;
    const patients = occIdx.length;
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
    stick(medic.x, H - 22, 0.9, pose, t, 3, facing);
  }
  // 부상자: 침상에 눕고(머리 왼쪽), 침상이 모자라면 오른쪽 벽가에 앉는다
  // 부상 표시: 남은 시즌 수만큼 구급 십자 (침상 위 작은 팻말). 누르면 치료
  const cost = `${healCostOf(S.st).toLocaleString()}`; ctx.font = 'bold 10px sans-serif'; const costW = ctx.measureText(cost).width;
  const crosses = (cx: number, cy: number, n: number, k: number) => { const w = n * 17 + 10 + costW + 6; ctx.fillStyle = '#f3ead0'; ctx.strokeStyle = '#8f7a4e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(cx - w / 2, cy - 10, w, 20, 4); ctx.fill(); ctx.stroke(); // 십자(남은 시즌) + 치료 금액
    for (let j = 0; j < n; j++) { const x = cx - w / 2 + 12 + j * 17, bob = Math.sin(t * 2 + k + j) * 0.6; ctx.fillStyle = '#9b2c1c'; ctx.fillRect(x - 6.5, cy - 2 + bob, 13, 4); ctx.fillRect(x - 2, cy - 6.5 + bob, 4, 13); }
    ctx.fillStyle = '#3a2412'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(cost, cx - w / 2 + 12 + n * 17, cy + 3.5); ctx.textAlign = 'center'; };
  const nameTag = (g: Gladiator, cx: number, cy: number) => { ctx.font = 'bold 10px sans-serif'; const nw = ctx.measureText(g.name).width; const x0 = cx - (nw + 18) / 2; ctx.fillStyle = TYPE_COLOR[g.type]; ctx.fillRect(x0, cy - 12, 14, 14); drawGlyph(ctx, g.type, x0 + 7, cy - 5, 11); ctx.fillStyle = '#3a2412'; ctx.textAlign = 'left'; ctx.fillText(g.name, x0 + 18, cy - 1); ctx.textAlign = 'center'; }; // 무기(유형) 아이콘 + 이름
  occupied.forEach((g, i) => { const bx = bedX[i];
    if (!g) { // 빈 침상: 누르면 켈라에서 부상자를 고른다 (부상자가 있을 때만 표시)
      if (S.st.roster.some(x => x.injured > 0 && !inBed(S.st, x))) { const bob = Math.sin(t * 2 + i) * 1.2; ctx.strokeStyle = '#9b2c1c'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(bx + 37 - 7, H - 62 + bob); ctx.lineTo(bx + 37 + 7, H - 62 + bob); ctx.moveTo(bx + 37, H - 69 + bob); ctx.lineTo(bx + 37, H - 55 + bob); ctx.stroke(); ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(58,36,18,.7)'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('부상자 눕히기', bx + 37, H - 6); }
      return; }
    const team = g.rank === 'veteranus' ? '#2c4f9b' : '#6e7f9b';
    ctx.save(); ctx.beginPath(); ctx.rect(bx - 4, 0, 92, H); ctx.clip();
    drawStickman(ctx, g.type, { x: bx + 78, y: H - 38, scale: 0.9, pose: 'down_back', t: t + i, team, bare: true, facing: 1 }); ctx.restore(); crosses(bx + 37, H - 80, Math.min(4, g.injured), i);
    nameTag(g, bx + 37, H - 6); }); // 침상 아래 무기 아이콘 + 이름
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
  const W = TOWN.tailW; const dead = S.st.graveyard;
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
  const roster = S.st.roster;
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
    if (ph > 1.65 && ph < 2.2 && sp > 600 && tip.y > -10 && t - whipState.crackT > 1.5) { whipState.crackT = t; whipState.crackX = tip.x; if (document.visibilityState === 'visible' && S.view === 'ludus' && !S.travel) sfx.whip(); }
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
    const cellCap = rosterCap(S.st); let cellK = 0;
    for (let x = 34; x < W; x += 68) {                                // 1층 아치 + 열주
      ctx.fillStyle = '#7a6743'; ctx.beginPath(); ctx.moveTo(x - 18, 78); ctx.lineTo(x - 18, 48); ctx.arc(x, 48, 18, Math.PI, 0); ctx.lineTo(x + 18, 78); ctx.closePath(); ctx.fill();
      const isDoor = x === 34; // 맨 왼쪽 아치 = 의무실로 통하는 통로 (의무실은 담 너머 독립 건물). 바닥에 문을 따로 세우지 않고 회랑 벽에 낸다
      const isCell = !isDoor && Math.abs(x - W / 2) > 40 && cellK < cellCap; if (isCell) cellK++; // 켈라은 상한 수만큼 열려 있고, 나머지는 막힌 벽
      if (isDoor) { ctx.fillStyle = '#3a2412'; ctx.beginPath(); ctx.moveTo(x - 12, 78); ctx.lineTo(x - 12, 56); ctx.arc(x, 56, 12, Math.PI, 0); ctx.lineTo(x + 12, 78); ctx.closePath(); ctx.fill(); // 열린 통로
        ctx.strokeStyle = '#3b7a2c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x, 34); ctx.stroke(); ctx.beginPath(); ctx.arc(x, 37, 3.5, 0.3, Math.PI * 1.7); ctx.stroke(); } // 문 위 작은 표지: 지팡이에 감긴 뱀(아스클레피오스)
      else if (isCell) { const q = S.st.ludus.cells[cellK - 1] ?? 0; ctx.fillStyle = q >= 2 ? '#5a3a1c' : '#3a2412'; ctx.fillRect(x - 7, 56, 14, 22); ctx.fillStyle = q >= 1 ? '#e8c96a' : '#5a4224'; ctx.fillRect(x - 5, 60, 10, 2); ctx.fillRect(x - 5, 64, 10, 2); if (q >= 3) { ctx.fillStyle = '#9b2c1c'; ctx.fillRect(x - 9, 52, 18, 3); } } // 켈라 문: 질 1 창에 불빛, 2 나무문, 3 붉은 차양
      else { ctx.fillStyle = '#8f7a4e'; ctx.fillRect(x - 10, 52, 20, 26); } // 막힌 아치 (증축 전)
      ctx.fillStyle = '#d9c69a'; ctx.fillRect(x + 26, 32, 8, 46);     // 기둥
    }
    ctx.fillStyle = '#8f7a4e'; ctx.fillRect(0, 78, W, 5);
    // 네메시스 사당 (회랑 가운데): 감실 + 상 + 화환
    { const sx = W / 2; ctx.fillStyle = '#9b2c1c'; ctx.fillRect(sx - 22, 40, 44, 38); ctx.fillStyle = '#e8d9b5'; ctx.fillRect(sx - 18, 44, 36, 34);
      ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, 76); ctx.lineTo(sx, 58); ctx.moveTo(sx - 7, 66); ctx.lineTo(sx + 7, 66); ctx.stroke(); ctx.beginPath(); ctx.arc(sx, 53, 4, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#3b7a2c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, 46, 16, 0.2, Math.PI - 0.2); ctx.stroke();
      if (S.st.events?.votum) { for (const dx of [-14, 14]) { ctx.fillStyle = '#e8d9b5'; ctx.fillRect(sx + dx - 2, 68, 4, 8); ctx.fillStyle = '#e8c96a'; ctx.beginPath(); ctx.ellipse(sx + dx, 65 + Math.sin(t * 9 + dx) * 0.6, 2, 3.5, 0, 0, Math.PI * 2); ctx.fill(); } } } // 봉헌: 촛불 둘
    S.stickFn = stick; // 의무실 장면이 같은 보조 인물 리그를 쓴다
    // 작은 타원 연습장 + 관람석: 루두스 마그누스의 미니 원형경기장
    ctx.strokeStyle = '#c4ad76'; ctx.lineWidth = 2; ctx.beginPath(); ctx.beginPath(); ctx.ellipse(160, 142, 118, 30, 0, 0, Math.PI * 2); ctx.fillStyle = '#e4d3a4'; ctx.fill(); ctx.stroke();
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 7) { const px = 160 + Math.cos(a) * 118, py = 142 + Math.sin(a) * 30; ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - 9); ctx.stroke(); } // 낮은 말뚝 울타리 // 원형 대련장: 왼쪽 위(회랑 바로 아래)에 두어 앞쪽 땅은 통로로 비운다
    // (관람석은 뺐다: 폭을 아끼려고)
    // 교관(독토르): 관람석 앞에서 막대로 지시
    stick(46, 178, 0.85, 'point', t, 1); // 교관은 대련장 왼쪽 앞
    roster.filter(g => g.status === 'doctor').forEach((g, i) => { const x = 70 + i * 22; stick(x, 180, 0.85, 'point', t + i * 2, 11 + i); }); // 고용한 독토르(전직 검투사)는 교관 옆
    // 로라리우스(채찍 든 감독): 대련 조 뒤에서 채찍을 휘두름
    stick(276, 178, 0.85, 'whip', t, 5); // 로라리우스는 대련장 오른쪽 앞
    // 보리죽 솥 (오른쪽 뒤 구석) + 요리사 + 김 — 팔루스보다 먼저 그려 뒤에 놓인다
    // (급식소는 뺐다 — 세로 무대에서 팔루스 자리를 넓게 쓰기 위해, 2026-09-16)
    // 훈련 기둥(팔루스) 둘 + 목검 거치
    const postN = S.st.ludus.palus; const posts = palusPosts(postN); // 팔루스 수 = 시설. 빈 기둥을 누르면 세울 검투사를 고른다
    for (const px of posts) { ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(px, H - 22); ctx.lineTo(px, H - 98); ctx.stroke(); ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px - 4, H - 52); ctx.lineTo(px + 4, H - 56); ctx.moveTo(px - 4, H - 74); ctx.lineTo(px + 4, H - 78); ctx.stroke(); } // 기둥은 사람 키보다 조금 낮게 (급식소와 덜 겹치게 작게)
    // 무기고 거치대 (가운데 뒤): 방패·창·목검
    { ctx.save(); ctx.translate(0, -26); const ax = 120; ctx.strokeStyle = '#6b4a22'; /* 무기고: 연습장 뒤 회랑 벽에. 세로 무대 카메라(140~580)에 들어오게 오른쪽으로 옮김 */ ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ax, 92); ctx.lineTo(ax + 120, 92); ctx.moveTo(ax + 4, 92); ctx.lineTo(ax + 4, 128); ctx.moveTo(ax + 116, 92); ctx.lineTo(ax + 116, 128); ctx.stroke();
      ctx.strokeStyle = ink; ctx.lineWidth = 2.2; for (let i = 0; i < 3; i++) { const x = ax + 16 + i * 22; ctx.beginPath(); ctx.rect(x, 96, 12, 26); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, 104); ctx.lineTo(x + 12, 100); ctx.moveTo(x, 114); ctx.lineTo(x + 12, 110); ctx.stroke(); }
      for (let i = 0; i < 2; i++) { const x = ax + 88 + i * 12; ctx.beginPath(); ctx.moveTo(x, 130); ctx.lineTo(x, 88); ctx.moveTo(x - 3, 92); ctx.lineTo(x, 84); ctx.lineTo(x + 3, 92); ctx.stroke(); }
      ctx.restore(); }
    // 검투사 배치: 팔루스에 세운 검투사는 그 기둥에서 각목(목검) 훈련(공격 클립 반복, 사람마다 위상 다르게). 세우지 않은 건강한 검투사는 짝이 맞는 만큼 연습장에서 대련(최대 2조)
    const teamColor = (g: Gladiator) => g.rank === 'veteranus' ? '#2c4f9b' : '#6e7f9b';
    for (let k2 = 0; k2 < postN; k2++) { const g = palusTrainee(S.st, k2); if (!g) continue; const px = posts[k2]; const clip = attackClipFor(g.type); const len = clipLength(clip) + 700; const el = ((t * 1000) + k2 * 400) % len;
      drawStickman(ctx, g.type, { x: px - 44, y: H - 20, scale: 0.9, skeleton: clipSkeleton(clip, el), t, team: teamColor(g), accessories: accessoriesOf(g) }); }
    const idle = roster.filter(g => g.alive && !g.injured && g.status !== 'doctor' && palusOf(S.st, g) < 0); const sparN = Math.min(4, idle.length) - (Math.min(4, idle.length) % 2);
    idle.slice(0, sparN).forEach((g, i) => { // 대련: 연습장 타원 안에서 마주보고 한쪽은 공격, 한쪽은 막기(교대)
      const pair = Math.floor(i / 2), side = i % 2;
      const cx = 118 + pair * 84, gap = 24; const period = 2200; const ph = ((t * 1000) + pair * 700) % period; const attackerSide = ph < period / 2 ? 0 : 1; const el = ph % (period / 2);
      const isAtk = side === attackerSide; const clip = isAtk ? attackClipFor(g.type) : 'block';
      drawStickman(ctx, g.type, { x: cx + (side ? gap : -gap), y: 160, scale: 0.85, facing: side ? -1 : 1, skeleton: clipSkeleton(clip, Math.min(el, clipLength(clip))), t, team: teamColor(g), accessories: accessoriesOf(g) });
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
// 경기장 그림: 등급마다 다르게 — 1 목조 경기장(나무 관람석 2단·기둥), 2 석조 원형경기장(돌 관람석 3단·아치), 3 로마 대경기장(4단·아치 줄·붉은 차양)
// 경기장 그림: 회벽에 붉은 흙물감과 검댕으로 그은 벽화풍. 채움 없이 삐뚤한 겹선(짙은 선 + 옅은 덧선)으로만 그린다
function arenaIcon(tier: number) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 64 40'); svg.setAttribute('width', '64'); svg.setAttribute('height', '40'); svg.classList.add('arena-icon', 'fresco');
  let seed = tier * 7919; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 - 0.5; }; // 결정적 흔들림
  const el = (tag: string, attrs: Record<string, string | number>) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const k in attrs) e.setAttribute(k, String(attrs[k])); svg.append(e); return e; };
  const OCHRE = '#9b2c1c', SOOT = '#3a2412';
  const wobbly = (pts: [number, number][], close: boolean, j = 0.9) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${(x + rnd() * j).toFixed(1)} ${(y + rnd() * j).toFixed(1)}`).join(' ') + (close ? ' Z' : '');
  const ellipsePts = (cx: number, cy: number, rx: number, ry: number, n = 22): [number, number][] => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
  const stroke = (d: string, color: string, w: number, op = 1) => el('path', { d, fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: op });
  const rings = tier === 1 ? 2 : tier === 2 ? 3 : 4; const RX = (i: number) => 12 + i * (tier === 3 ? 5 : 4.5), RY = (i: number) => 6 + i * 3;
  // 옅은 흙물감 씻김 (바탕)
  el('ellipse', { cx: 32, cy: 22, rx: RX(rings), ry: RY(rings), fill: OCHRE, opacity: 0.08 });
  for (let i = rings; i >= 1; i--) { const pts = ellipsePts(32, 22, RX(i), RY(i)); stroke(wobbly(pts, true), SOOT, i === rings ? 1.7 : 1.2, 0.85); stroke(wobbly(pts, true, 1.4), OCHRE, 0.9, 0.55); } // 관중석 단(겹선)
  if (tier === 1) for (let x = 10; x <= 54; x += 11) stroke(wobbly([[x, 20], [x, 34]], false), SOOT, 1.6, 0.8); // 목조: 받침 기둥
  if (tier >= 2) for (let k = 0; k < (tier === 3 ? 9 : 7); k++) { const a = Math.PI * (0.12 + 0.76 * k / (tier === 3 ? 8 : 6)); const x = 32 + Math.cos(a) * RX(rings) * 0.9, y = 22 + Math.sin(a) * RY(rings) * 0.9; stroke(`M${x - 1.6} ${y + 2} L${x - 1.6} ${y - 1} Q${x} ${y - 3.2} ${x + 1.6} ${y - 1} L${x + 1.6} ${y + 2}`, SOOT, 1.1, 0.85); } // 석조: 바깥 아치 줄
  if (tier === 3) for (let k = 0; k < 6; k++) stroke(wobbly([[10 + k * 9, 8], [14.5 + k * 9, 3.5], [19 + k * 9, 8]], false, 0.6), OCHRE, 1.8, 0.9); // 로마: 붉은 차양(벨라리움)
  const sand = ellipsePts(32, 22, 12, 6, 16); el('path', { d: wobbly(sand, true, 0.6), fill: OCHRE, opacity: 0.16 }); stroke(wobbly(sand, true), SOOT, 1.1, 0.8); // 모래밭
  stroke(wobbly([[28, 12], [36, 12]], false, 0.5), OCHRE, 2.6, 0.9); // 주최자석 붉은 띠
  return svg;
}
function assignedTo(gid: number): number | null { for (const cid in S.assign) if (S.assign[cid].includes(gid)) return +cid; return null; }

// 시즌 행동 선택. 훈련은 훈련소의 팔루스에 세워서 한다 — 팔루스에 선 검투사는 여기서 공/방/기술 중 무엇을 단련할지 고르고 내려올 수도 있다. 나머지는 휴식·시범, 부상자는 요양·치료. 시즌이 끝날 때 실행
function actionSeg(g: Gladiator): (Node | null)[] {
  const at = assignedTo(g.id), tp = planOf(g), slot = palusOf(S.st, g);
  if (g.status === 'doctor') return [];
  if (g.injured) return [h('span', { class: 'seg' }, h('span', { class: 'hint' }, `요양 중 (부상 ${g.injured}→${Math.max(0, g.injured - 1 - CONFIG.actions.recover.extra)}시즌)`),
    h('button', { disabled: S.st.money < healCostOf(S.st), onclick: (ev: Event) => { ev.stopPropagation(); openConfirm(g, 'heal'); } }, `치료 ${healCostOf(S.st)}`))]; // 부상자는 자동 요양, 치료만 고른다
  if (slot >= 0) { // 팔루스에 서 있다: 무엇을 단련할지는 시즌 끝에 무작위 (공·방, 조건이 되면 기술)
    const str = skillTrainable(S.st, g); const fatigueTip = at != null ? ` · 출전 뒤 훈련: 피로가 쌓일 확률 ${Math.round(Math.max(0, CONFIG.fatigue.trainAfterFight - cellQuality(S.st, g) * CONFIG.fatigue.perCellStar) * 100)}%` : '';
    return [h('span', { class: 'seg' },
      h('span', { class: 'hint', title: `시즌 끝에 공격(+${trainGain(S.st, g, 'atk')})·방어(+${trainGain(S.st, g, 'def')})${str ? `·기술(${str.pool.map(SKILL_NAME).join('·')} 중 하나, ${Math.round((str.from === 'doctor' ? CONFIG.skills.trainChance : CONFIG.skills.gymChance) * 100)}%)` : ''} 중 하나를 무작위로 단련${fatigueTip}` }, `팔루스 ${slot + 1} — 공·방${str ? '·기술' : ''} 중 무작위`),
      h('button', { title: `팔루스 ${slot + 1}에서 내려온다 (이번 시즌 훈련 없음)`, onclick: (ev: Event) => { ev.stopPropagation(); leavePalus(S.st, g); save(); render(); } }, '내려오기'))];
  }
  const f = g.fatigue ?? 0; return [h('span', { class: 'hint' }, at != null ? '출전만' : f > 0 ? `휴식 (피로 ${f} → −${cellQuality(S.st, g) >= 1 ? 2 : 1}${S.st.ludus.medicine >= CONFIG.ludus.medicine.fatigueRestAt ? '−1' : ''})` : `시범 (명예 +${CONFIG.actions.show.honor}) — 훈련은 훈련소의 팔루스에 세워서`)]; // 고르지 않는다: 팔루스에 안 섰으면 피로가 있으면 쉬고, 없으면 시범
}
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
S.pageSlide = null; // 편성 페이지 전환 방향: 계약 → 검투사(오른쪽에서), 검투사 → 계약(왼쪽에서)
S.shownPlan = null; // 지금 떠 있는 편성 페이지의 계약 id (재렌더 때 다시 밀려 들어오지 않게)
S.lineupView = 'stats'; // 편성 왼쪽 타일 아래 줄: 능력치(기본) / 전적 (스위치)
const teamOf = (c: Contract) => (S.assign[c.id] ?? []).map(id => S.st.roster.find(g => g.id === id)!).filter(Boolean); // 계약에 배정된 검투사들
S.tabletQueue = null; S.tabletIdx = 0; // 결투 낙서를 누르면 준비된 계약마다 밀랍 서판이 차례로 나온다 (도장으로 서명) → 마지막 뒤 시즌 시작 확인
function closePlanConfirm() { const el = document.querySelector('.planpage.tablet'); S.shownTablet = false; if (!el) { S.tabletQueue = null; render(); return; } el.classList.add('closing'); window.setTimeout(() => { S.tabletQueue = null; render(); }, 280); }
function closePlanPage() { const el = document.querySelector('.planpage'); S.shownPlan = null; if (!el) { S.planSel = null; render(); return; } el.classList.add('closing'); window.setTimeout(() => { S.planSel = null; render(); }, 280); }
// 계약서(밀랍 서판): 라니스타 ↔ 주최자의 대여 계약. 나무 틀 안 검은 밀랍에 조건을 적고, 도장(SIGNATVM)을 찍어 서명한다 (가이우스 3.146: 무사 귀환 시 대여료, 사망·불구 시 배상)
S.shownTablet = false; // 서판 페이지가 떠 있는지 (특약 체크로 재렌더될 때 다시 밀려 들어오지 않게)
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
    window.setTimeout(() => { S.notice = cs.length > 1 ? `계약서 ${cs.length}장에 서명했다` : `${cs[0].venue} 계약서에 서명했다`; S.shownTablet = false; S.tabletQueue = null; S.seasonConfirm = true; render(); }, 900 + wraps.length * 160); };
  const btn = h('button', { class: 'sealbtn', title: '도장을 찍어 계약을 맺습니다', onclick: sign }, h('span', { class: 'latin' }, stampText), h('span', { class: 'ko' }, cs.length > 1 ? `${cs.length}장 서명` : '서명'));
  return h('div', { class: `planpage tablet n${cs.length}${again ? ' still' : ''}` }, h('div', { class: 'tablets' }, ...cs.map(tablet)), h('div', { class: 'cbtns tbtns' }, btn), backBtn(closePlanConfirm, '계약 벽으로 돌아가기'));
}
const honorBadge = (g: Gladiator) => { const b = h('span', { class: 'honor', title: `명예 ${g.honor ?? 0}: 쓰러졌을 때 관중이 살려 줄 확률과 루디스에 영향` }); b.innerHTML = `<svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.5 12.9 17 22l-5-3-5 3 1.5-9.1"/></svg>`; b.append(String(g.honor ?? 0)); return b; }; // 초상 왼쪽 아래 명예 배지
const tileMeta = (g: Gladiator) => S.lineupView === 'record' ? `${g.wins}승/${g.fights}전` : `HP${g.base.hp}·ATK${g.base.atk}·DEF${g.base.def}`; // 편성 왼쪽 타일 아래 줄 (HP부터, 약자)
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
function graffitiBtn(kind: 'duel' | 'coins', word: string, title: string, onclick: () => void, badge?: number): Node {
  const b = h('button', { class: 'tabletbtn gfbtn', title, 'aria-label': title, onclick }); b.innerHTML = kind === 'duel' ? DUEL_SVG : COINS_SVG;
  b.prepend(h('span', { class: 'tword' }, word)); if (badge) b.append(h('span', { class: 'nbadge' }, String(badge))); return b;
}
function renderPlan() {
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
      cpanel.append(h('div', { class: `card contract detail${err ? '' : ' ready'}${S.planSel === c.id ? ' sel' : ''}`, onclick: () => { S.planSel = c.id; render(); } }, h('div', { class: 'arenacol' }, h('span', { class: 'aleft' }, h('span', { class: 'tierchip', title: c.tier === 3 ? '로마 대경기장' : c.tier === 2 ? '석조 원형경기장' : '목조 경기장' }, `등급 ${c.tier}`), c.powerCap != null ? h('span', { class: 'badge cap', title: `이 등급 경기장의 상대는 전력 ${c.powerCap} 이하로만 나온다 (내 편은 제한 없음)` }, `상대 ≤${c.powerCap}`) : null, scaleChip, diffChip), h('span', { class: 'aicon' }, arenaIcon(c.tier), !err ? graffitiCheck() : null)), // 왼쪽 등급 칩, 가운데 그림(준비되면 체크), 오른쪽 위 상대 강도 + 아래 배정 수
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
              h('div', { class: 'etop' }, h('div', { class: 'gport' }, portrait(e, 40, true), h('span', { class: `rank ${e.rank}` }, e.rank === 'tiro' ? '티로' : '베테'), honorBadge(e)), h('div', { class: 'eskills' }, ...skillsOf(e).map(id => h('span', { class: 'badge skill', title: `${SKILL_BY_ID[id].name}: ${SKILL_BY_ID[id].desc}` }, SKILL_BY_ID[id].name)), ...Array.from({ length: Math.max(0, skillSlots(e) - skillsOf(e).length) }, () => h('span', { class: 'badge empty' }, '\u00a0')))), // 우리 타일처럼 오른쪽에 기술
              h('div', { class: 'ename' }, sq(e.type), ' ', e.name.replace('(적)', '')),
              h('div', { class: 'emeta' }, tileMeta(e), star && star.id === e.id && ((star.honor ?? 0) >= 20 || star.wins >= 5) ? h('span', { class: 'badge star', title: '이 파밀리아의 간판 검투사' }, '간판') : null, spBy.length ? h('span', { class: 'badge grudge', title: `${spBy.map(g => g.name).join(', ')} 이(가) 살려 준 자. 재대결이면 공격 +10%, 그에게 지면 미시오 −15%` }, '원한') : null)); }))),
        h('div', { class: 'lally' }, h('div', { class: 'lfam' }, h('b', {}, '우리 파밀리아'), h('span', { class: 'hint' }, ` (${team.length}/${c.size})`)), h('div', { class: 'slots' }, ...slotList.map(sl => { const g = 'g' in sl ? sl.g : null; const vet = 'vet' in sl; return h('span', { class: `slot${g ? ' filled' : ''}${vet ? ' vet' : ''}`, title: vet ? '대장 자리: 베테라누스만 들어갈 수 있습니다' : '', onclick: (ev: Event) => { ev.stopPropagation(); if (g) { S.assign[c.id] = S.assign[c.id].filter(x => x !== g.id); render(); } else { S.planSel = c.id; render(); } } }, ...(g ? [h('div', { class: 'etop' }, h('div', { class: 'gport' }, portrait(g, 40), h('span', { class: `rank ${g.rank}` }, g.rank === 'tiro' ? '티로' : '베테'), honorBadge(g)), h('div', { class: 'eskills' }, ...skillsOf(g).map(id => h('span', { class: 'badge skill', title: `${SKILL_BY_ID[id].name}: ${SKILL_BY_ID[id].desc}` }, SKILL_BY_ID[id].name)), ...Array.from({ length: Math.max(0, skillSlots(g) - skillsOf(g).length) }, () => h('span', { class: 'badge empty' }, '\u00a0')))), h('div', { class: 'ename' }, sq(g.type), ' ', g.name), h('div', { class: 'emeta' }, tileMeta(g))] : [h('span', { class: 'hint' }, vet ? '베테라누스' : '빈 자리')])); }))), // 우리 편도 상대 블록처럼 박스로 감싼다. 배정된 아군은 상대 타일과 같은 모양. 베테라누스 몫(왼쪽)은 금색
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
  const warnings = () => {
    const healable = S.st.roster.filter(g => g.injured && S.st.money >= healCostOf(S.st)).length;
    const usedIds = new Set(readyQ.flatMap(c => S.assign[c.id] ?? [])); // 다른 계약에 내보내는 검투사는 빼고 판단: 전원을 이미 내보냈다면 거절이 아니다
    const refusable = S.st.fame >= CONFIG.fameDelta.refuseFrom ? S.st.contracts.filter(c => !readyQ.includes(c) && isImportant(c) && canFulfill(S.st, c, usedIds)) : []; // 벌점은 중요한 계약(등급 2·3)만 — 카드가 아니라 여기서 확인
    const blocked = S.st.contracts.filter(c => { const t = teamOf(c); return t.length === c.size && !!validTeam(S.st, c, t); }).map(c => `${c.venue}: ${validTeam(S.st, c, teamOf(c))}`);
    // 시즌 시작 전 확인: 한 줄씩, 짧게. 어느 계약인지는 굳이 밝히지 않는다
    const warn = [
      !ready ? '이번 시즌은 아무도 모래를 밟지 않습니다.\n· 경기 없음 — 대여료·상금 없이 유지비만 나갑니다.' : '',
      blocked.length ? `배정한 계약 ${blocked.length}건은 문이 열리지 않습니다.\n· 조건 미달 — 그 경기는 치르지 않은 것으로 칩니다.` : '',
      refusable.length ? `큰 경기의 주최자가 우리 검투사를 기다리다 크게 실망했습니다.\n· 호감도 ${CONFIG.fameDelta.refuse}` : '',
      healable ? `의무실에 부상자 ${healable}명이 누워 있습니다. 어서 낫기를.\n· 치료비 ${healCostOf(S.st).toLocaleString()} HS 면 지금 낫습니다. 아니면 요양으로 한 시즌.` : '',
      (() => { const F = CONFIG.fatigue; const risky = S.st.roster.filter(g => assignedTo(g.id) != null && (g.fatigue ?? 0) + 1 >= F.overworkAt); return risky.length ? `${risky.map(g => g.name).join(', ')} 은(는) 지쳐 있는데 또 모래를 밟습니다.\n· 출전하면 피로 ${risky.map(g => (g.fatigue ?? 0) + 1).join('·')} — 시즌 끝에 과로사 ${risky.map(g => Math.round(((g.fatigue ?? 0) + 1 - F.overworkAt + 1) * F.overworkPer * 100)).join('·')}%` : ''; })(),
    ].filter(Boolean);
    return warn;
  };
  const goConfirm = () => { const ids = readyQ.map(c => c.id); if (ids.length) { S.tabletQueue = ids; S.tabletIdx = 0; } else S.seasonConfirm = true; render(); }; // 준비된 계약이 있으면 서판부터, 없으면 바로 시즌 시작 확인
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
    if (isDoc) { // 독토르만 한 줄로 접는다
      pright.append(h('div', { class: 'gtile dis' }, h('div', { class: 'gtop' }, h('div', { class: 'gport' }, portrait(g, 56)), h('div', { class: 'gskills' })), h('div', { class: 'gname' }, sq(g.type), ' ', g.name), h('div', { class: 'gmeta' }, h('span', { class: 'badge doc' }, '독토르'))));
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
      h('div', { class: 'gtop' }, h('div', { class: 'gport' }, portrait(g, 56), h('span', { class: `rank ${g.rank}` }, g.rank === 'tiro' ? '티로' : '베테'), honorBadge(g)), h('div', { class: 'gskills' }, ...skillsOf(g).map(id => h('span', { class: 'badge skill', title: `${SKILL_BY_ID[id].name}: ${SKILL_BY_ID[id].desc}` }, SKILL_BY_ID[id].name)), ...Array.from({ length: Math.max(0, skillSlots(g) - skillsOf(g).length) }, () => h('span', { class: 'badge empty', title: '빈 기술 자리: 기술 훈련이나 경기 뒤 깨침으로 채운다' }, '\u00a0')))), // 왼쪽 초상(계급 칩 겹침) · 오른쪽 기술 칩 세로: 배운 것 + 배울 수 있는 빈 자리는 빈 칩
      h('div', { class: 'gname' }, sq(g.type), ' ', g.name),
      h('div', { class: 'ginfo2' }, // 왼쪽 능력치(약자) · 오른쪽 전적, 세로로
        h('div', { class: 'gcol' }, ...([['HP', g.base.hp], ['ATK', g.base.atk], ['DEF', g.base.def], ['SPD', g.base.spd]] as const).map(([k, v]) => h('div', {}, h('span', { class: 'k' }, k), h('b', {}, String(v))))),
        h('div', { class: 'gcol' }, h('div', {}, h('span', { class: 'k' }, '승'), h('b', {}, String(g.wins))), h('div', {}, h('span', { class: 'k' }, '패'), h('b', {}, String(g.fights - g.wins))), h('div', { class: fat >= 3 ? 'bad' : fat >= 2 ? 'warn' : '' }, h('span', { class: 'k' }, '피로'), h('b', {}, String(fat))), h('div', { class: g.injured ? 'bad' : '' }, h('span', { class: 'k' }, '부상'), h('b', {}, g.injured ? `${g.injured}시즌` : '0')))), // 오른쪽: 승·패·피로·부상 (칩 대신 숫자)
      h('div', { class: 'gmeta' }, stateNode, revengeNode, tagNode), elsewhere ? h('div', { class: 'tstamp', title: `${S.st.contracts.find(x => x.id === at)?.venue ?? '다른 계약'}에 배정됨. 누르면 이 계약으로 옮긴다` }, h('span', {}, 'LOCATVS')) : null)); // 초상 타일. 다른 계약에 빌려준 검투사는 도장(LOCATVS): 누르면 왼쪽 자리로 (교체: 마지막 자리를 빼고 이 검투사를 넣는다)
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
  if (S.seasonConfirm) frag.append(seasonConfirmPage(warnings()));
  return frag; // 가로: 토글 띠 · 계약 4칸 · 버튼 (+ 편성 페이지 · 시즌 시작 확인)
}
function eventRows(): Node[] {
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
// 시즌 시작 확인 페이지: 왼쪽에 경고(문구 한 줄 + '· ' 효과 줄), 오른쪽에 시즌 행사 고르기, 아래 금화 줄과 도장(INCIPIT)
S.seasonConfirm = false; S.shownSeason = false;
function closeSeasonConfirm() { const el = document.querySelector('.planpage.season'); S.shownSeason = false; if (!el) { S.seasonConfirm = false; render(); return; } el.classList.add('closing'); window.setTimeout(() => { S.seasonConfirm = false; render(); }, 280); }
function seasonConfirmPage(warn: string[]): Node {
  const E = CONFIG.events; const evCost = EVENT_KEYS.reduce((a, k) => a + (S.eventPlan[k] ? E[k].cost : 0), 0);
  const again = S.shownSeason; S.shownSeason = true;
  let stamped = false; const stampText = 'INCIPIT'; // 시작하다 — 경기의 막이 오른다
  const start = () => { if (stamped) return; stamped = true; const page = document.querySelector('.planpage.season'); if (page) page.append(h('div', { class: 'stamp' }, h('span', {}, stampText))); sfx.down(); window.setTimeout(() => sfx.drum(1), 40);
    window.setTimeout(() => { S.seasonConfirm = false; S.shownSeason = false; startSeason(); }, 900); };
  const left = h('div', { class: 'scol warn' }, h('h3', {}, '시즌 시작 전에'),
    ...(warn.length ? warn.map(w => { const [f, ...rest] = w.split('\n'); return h('div', { class: 'wblock' }, h('div', { class: 'flavor' }, f), ...rest.map(r => h('div', { class: 'effect' }, r))); }) : [h('div', { class: 'flavor' }, '준비가 끝났습니다. 검투사들이 문 앞에 서 있습니다.')]));
  const right = h('div', { class: 'scol events' }, h('h3', {}, '시즌 행사', h('span', { class: 'hint', style: 'margin-left:6px' }, '이 시즌에만 효과')), ...eventRows());
  return h('div', { class: `planpage season${again ? ' still' : ''}` }, h('div', { class: 'scols' }, left, right),
    h('div', { class: 'cbox row sfoot' }, evCost ? moneyRow({ amount: evCost, verb: '지불' }) : h('div'), // 행사가 없으면 빈 자리, 있으면 금액만
      h('div', { class: 'cbtns' }, h('button', { class: 'sealbtn', title: '도장을 찍어 시즌을 시작합니다', onclick: start }, h('span', { class: 'latin' }, stampText), h('span', { class: 'ko' }, '시즌 시작')))),
    backBtn(closeSeasonConfirm, '계약으로 돌아가기'));
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
function nextFight() {
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
function renderSummary() {
  const sum = S.seasonSummary!;
  const W = S.seasonReports.filter(r => r.winner === 'A').length, L = S.seasonReports.filter(r => r.winner === 'B').length, D = S.seasonReports.filter(r => r.winner === 'draw').length;
  const salary = S.seasonReports.reduce((a, r) => a + r.salary, 0);
  const betLoss = S.seasonReports.reduce((a, r) => a + (r.bet && !r.bet.won ? r.bet.amount : 0), 0);
  const rent = S.seasonReports.reduce((a, r) => a + r.rent, 0), expense = S.seasonReports.reduce((a, r) => a + r.expense, 0), prize = S.seasonReports.reduce((a, r) => a + r.prize, 0), comp = S.seasonReports.reduce((a, r) => a + r.compensation, 0);
  const evHeld = EVENT_KEYS.filter(k => sum.events[k]); const evCost = evHeld.reduce((a, k) => a + CONFIG.events[k].cost, 0); const evFame = (sum.events.cena ? CONFIG.events.cena.fame : 0) + (sum.events.pompa ? CONFIG.events.pompa.fame : 0) + (sum.events.guests ? CONFIG.events.guests.fame : 0);
  const net = S.st.money - sum.before;
  const fameFights = S.seasonReports.reduce((a, r) => a + r.fameDelta, 0);
  const money = (label: string, v: number, sign: 1 | -1 = 1) => h('div', { class: 'mrow' }, h('span', {}, label), h('span', { class: v ? (sign > 0 ? 'plus' : 'minus') : '' }, `${sign > 0 ? '+' : '−'}${Math.abs(v).toLocaleString()}`));
  const badge = (cls: string, text: string) => h('span', { class: `badge ${cls}` }, text);
  const fateOf = (r: FightReport, g: Gladiator) => { const f = r.fates.find(x => x.g.id === g.id); const downed = r.downed.some(d => d.id === g.id); const won = r.winner === 'A';
    return f?.fate === 'dead' ? badge('dead', f.wound ? '즉사' : '처형') : f?.fate === 'injured' ? badge('injured', '부상') : downed ? badge('missio', won ? '쓰러졌으나 무사' : '미테! 살았다') : badge('ok', '무사'); };
  // 경기 카드
  const games = S.seasonReports.map(r => h('div', { class: `gamecard ${r.winner === 'A' ? 'win' : r.winner === 'B' ? 'lose' : 'draw'}` },
    h('div', { class: 'ghead' }, arenaIcon(r.contract.tier), h('div', { class: 'grow' },
      h('div', {}, h('b', { class: r.winner === 'A' ? 'plus' : r.winner === 'B' ? 'minus' : '' }, r.winner === 'A' ? '승리' : r.winner === 'B' ? '패배' : '무승부'), ` · 등급 ${r.contract.tier} ${r.contract.venue} `, h('span', { class: 'size' }, `${r.contract.size}대${r.contract.size}`), ' · ', h('span', { class: 'meta' }, HOST_KO[r.contract.host]), r.classic ? h('span', { class: 'syn classic', style: 'margin-left:6px' }, '전통 짝') : null),
      h('div', { class: 'meta' }, `대여 +${r.rent.toLocaleString()} · 경비 −${r.expense.toLocaleString()} · 상금 +${r.prize.toLocaleString()}${r.compensation ? ` · 배상 +${r.compensation.toLocaleString()}` : ''} · 호감도 ${r.fameDelta >= 0 ? '+' : ''}${r.fameDelta}`))),
    h('div', { class: 'grow2' }, ...r.team.map(g => h('div', { class: 'mini' }, portrait(g, 44), h('div', {}, h('div', { class: 'nm' }, g.name), h('div', {}, fateOf(r, g), r.promoted.includes(g) ? badge('promo', '★ 승급') : null)))))));
  // 로스터 변화
  const dead = S.seasonReports.flatMap(r => r.fates.filter(f => f.fate === 'dead').map(f => f.g));
  const injuredNow = S.st.roster.filter(g => g.injured > 0);
  const tired = S.st.roster.filter(g => (g.fatigue ?? 0) >= 2);
  const promoted = S.seasonReports.flatMap(r => r.promoted);
  const rosterItems: Node[] = [];
  if (promoted.length) rosterItems.push(h('div', { class: 'ditem todo' }, h('span', { class: 'dot' }), h('span', {}, `승급: ${promoted.map(g => g.name).join(', ')} → 베테라누스`)));
  { const ne = S.seasonReports.flatMap(r => r.newEpithets); if (ne.length) rosterItems.push(h('div', { class: 'ditem todo' }, h('span', { class: 'dot' }), h('span', {}, `별칭: ${ne.map(x => `${x.g.name} '${x.e.name}' (${x.e.effect})`).join(', ')}`))); }
  { const freed = S.seasonReports.flatMap(r => r.rudis); if (freed.length) rosterItems.push(h('div', { class: 'ditem todo' }, h('span', { class: 'dot' }), h('span', {}, `루디스: ${freed.map(g => g.name).join(', ')} — 자유민이 됐습니다. 관리 화면에서 독토르 고용 또는 계속 출전을 정하세요.`))); }
  if (sum.trained.length) rosterItems.push(h('div', { class: 'ditem todo' }, h('span', { class: 'dot' }), h('span', {}, `훈련: ${sum.trained.map(t => `${t.g.name} ${t.stat === 'atk' ? '공격' : '방어'} +1`).join(', ')}`)));
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

function renderOver() {
  return h('div', { class: 'panel' }, h('h2', {}, '게임 종료'),
    h('p', {}, `${S.st.reason}. 최종 점수 ${score(S.st).toLocaleString()} (자금 + 검투사 매각가 + 호감도×100)`),
    h('div', { class: 'grave' }, S.st.graveyard.length ? '묘비: ' + S.st.graveyard.map(g => `${g.name} ${g.wins}승/${g.fights}전`).join(' · ') : '사망자 없음'),
    S.st.lineageLog?.length ? h('div', { class: 'grave' }, '역대 라니스타: ' + S.st.lineageLog.join(' → ') + ` → ${S.st.lanista.name}`) : null,
    h('div', { class: 'log', style: 'margin-top:8px;max-height:300px' }, S.st.history.join('\n')),
    h('div', { class: 'actions' }, h('button', { class: 'primary', onclick: () => { clearSave(); S.st = newGame(Math.floor(Math.random() * 100000)); S.phase = 'manage'; S.assign = {}; S.trainPlan = {}; S.townCanvas = null; S.view = 'ludus'; render(); } }, '새 게임')));
}

// ---------- 전투 재생 ----------

// ── 경기장(월드 좌표, 검투사 비율). 바닥 타원 중심 (0,0). 관객석은 타원 링으로 사방을 두르되 먼 쪽이 높이 들린다.
const hash01 = (a: number, b: number) => { const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return h - Math.floor(h); };
const WORLD = { rx: 680, ry: 150, rows: 6, seat: 46, sc: 0.9, wood: false, velarium: false, seatLift: 30 }; // seatLift: 관객 머리를 좌석선보다 위로 올려 몸이 좌석 띠 안에 앉게 (0이면 머리가 좌석선에 붙어 앞줄이 경기장 밖으로 내려앉아 보인다) // ry 는 tilt=1(낮은 각도)일 때. 관중 = 검투사 비율. 경기마다 등급에 맞춰 바뀐다
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
      out.push({ x: Math.cos(a) * mid.rx + (hash01(k, j) - 0.5) * 8, y: mid.cy + Math.sin(a) * mid.ry - WORLD.seatLift * lerp(0.6, 1, tilt), h, k, j, toga: k === 0, near: Math.sin(a) > 0.25 }); // 머리를 좌석선 위로
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

// 폼페이 낙서풍 체크: 경기장 그림 위에 긁어 그린 듯 겹친 획 (출전 준비 완료)
function graffitiCheck(): Node {
  const el = h('span', { class: 'ready-check', title: '출전 준비 완료' });
  el.innerHTML = `<svg viewBox="0 0 44 34" width="44" height="34" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 18 L9 22 L11 21 L14 28 L16 27 L19 22 L23 18 L27 14 L31 11 L35 9 L38 8" stroke="#3a2412" stroke-width="2.4" opacity=".85"/>
    <path d="M5 20 L9 24 L12 23 L15 30 L17 28 L21 22 L25 17 L29 13 L33 11 L37 9" stroke="#3a2412" stroke-width="1.2" opacity=".6"/>
    <path d="M7 17 L10 20 L13 25 L15 26" stroke="#9b2c1c" stroke-width="1.1" opacity=".55"/>
    <path d="M17 26 L22 20 L28 14 L34 10" stroke="#9b2c1c" stroke-width="1" opacity=".45"/>
    <path d="M14 31 L16 29" stroke="#3a2412" stroke-width="1.4" opacity=".5"/>
    <path d="M36 7 L39 10" stroke="#3a2412" stroke-width="1.2" opacity=".45"/>
  </svg>`;
  return el;
}
// 폼페이 낙서풍 VS: 벽에 긁어 쓴 듯 삐뚤한 획을 두 번 겹친다 (스틱맨과 같은 잉크색)
function vsGraffiti(): Node {
  const el = h('span', { class: 'vs', 'aria-hidden': 'true' });
  el.innerHTML = `<svg viewBox="0 0 120 60" width="120" height="60" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <g stroke="#3a2412" stroke-width="3.2" opacity=".55">
      <path d="M14 12 L27 47 L41 10"/><path d="M16 14 L29 45"/>
      <path d="M92 14 C80 6 66 12 70 22 C74 32 96 30 98 41 C99 51 78 55 66 46"/><path d="M90 16 C82 10 72 14 74 21"/>
    </g>
    <g stroke="#3a2412" stroke-width="1.4" opacity=".35">
      <path d="M12 14 L26 49"/><path d="M42 12 L28 48"/><path d="M96 43 C97 52 77 56 68 48"/>
      <path d="M50 30 L62 28"/><path d="M8 52 L112 8"/>
    </g>
  </svg>`;
  return el;
}
function renderBattle() {
  const r = S.report!;
  app.replaceChildren(); app.classList.remove('fit'); app.classList.remove('land', 'plan', 'battle', 'page');
  const canvas = h('canvas', { id: 'arena' }) as HTMLCanvasElement;
  const logEl = h('div', { class: 'log' });
  const skip = h('button', { style: DEBUG ? '' : 'display:none' }, '건너뛰기'); // 테스트용: 주소에 ?debug 가 있을 때만 보인다
  const legendShown = localStorage.getItem('lanista-legend') === '1'; localStorage.setItem('lanista-legend', '1'); // 범례는 처음 한 번만
  const lineup = h('div', { class: 'lineup overlay-lineup' }, // 누가 싸우는지: 윗줄 내 편, 아랫줄 상대, 사이 배경에 VS 문양 (유형·이름·서열·전적·공방)
      h('div', { class: 'side mine' }, ...r.team.map(g => h('span', { class: 'fighter mine', title: `${g.name}: HP ${g.base.hp} 공 ${g.base.atk} 방 ${g.base.def}${skillsOf(g).length ? ` · 기술 ${skillsOf(g).map(SKILL_NAME).join('·')}` : ''}` }, sq(g.type), ' ', h('b', {}, g.name), h('span', { class: 'meta' }, ` ${g.rank === 'tiro' ? '티로' : '베테'} ${g.wins}승/${g.fights}전 · 공${g.base.atk} 방${g.base.def}`)))),
      vsGraffiti(),
      h('div', { class: 'side enemy' }, ...r.contract.enemy.map(g => h('span', { class: 'fighter enemy', title: `${g.name.replace('(적)', '')}: HP ${g.base.hp} 공 ${g.base.atk} 방 ${g.base.def}${(g.skills ?? []).length ? ` · 기술 ${(g.skills ?? []).map(SKILL_NAME).join('·')}` : ''}` }, sq(g.type), ' ', h('b', {}, g.name.replace('(적)', '')), h('span', { class: 'meta' }, ` ${g.rank === 'tiro' ? '티로' : '베테'} ${g.wins}승/${g.fights}전 · 공${g.base.atk} 방${g.base.def}`)))));
  const miniSq = (g: Gladiator) => h('span', { class: 'sq small', style: `background:${TYPE_COLOR[g.type]}` }, glyphSvg(g.type, 14));
  const lineupTab = h('button', { class: 'lineup-tab', title: '편성 보기', onclick: () => { lineup.classList.remove('folded'); lineupTab.classList.remove('show'); } },
    ...r.team.map(miniSq), h('span', { class: 'vs-mini' }, 'vs'), ...r.contract.enemy.map(miniSq)); // 접힌 뒤엔 유형 아이콘 vs 유형 아이콘 줄. 누르면 편성이 내려온다
  const foldLineup = () => { lineup.classList.add('folded'); lineupTab.classList.add('show'); };
  const wrap = h('div', { class: 'panel battle' }, // 헤더 아래 장면 영역을 채운다 (헤더는 그대로). 편성(VS) 블록은 경기장 위에 겹쳐 띄웠다가 잠시 뒤 위로 접힌다
    h('div', { class: 'stage' }, canvas, h('div', { class: 'btitle' }, `${r.contract.venue} — ${HOST_KO[r.contract.host]}`), lineup, lineupTab,
      legendShown ? null : h('div', { class: 'legend' }, h('span', { style: 'color:#2c4f9b;font-weight:700' }, '■ 파란 방패·허리천 = 내 루두스'), '   ', h('span', { style: `color:${ENEMY};font-weight:700` }, '■ 자주색 = 상대 파밀리아')),
      h('div', { class: 'actions' }, skip)));
  app.append(headerEl(), wrap); app.classList.add('land', 'battle'); window.scrollTo(0, 0); // 전투도 같은 가로 무대 안: 위 헤더는 그대로, 아래는 경기장이 채운다 (하단 바 없음)
// 경기장 높이 = 남는 높이 (스크롤 없이 바 바로 위까지)
  lineup.addEventListener('click', foldLineup); canvas.addEventListener('click', () => { if (!lineup.classList.contains('folded')) foldLineup(); }); // 편성이나 전투 화면을 누르면 접힌다. 접힌 뒤엔 아이콘 줄을 누르면 내려온다
  window.setTimeout(() => { if (S.phase === 'battle') foldLineup(); }, 4500); // 소개 연출이 끝날 즈음 접힌다
  const W = canvas.clientWidth || 868, H = canvas.clientHeight || 354; const SK = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--stage-k')) || 1) * devicePixelRatio; // 무대 배율 × DPR 만큼 실제 픽셀을 잡아 선명하게
  canvas.width = W * SK; canvas.height = H * SK;
  const ctx = canvas.getContext('2d')!; ctx.scale(SK, SK);
  const ZK = Math.max(0.72, Math.min(1, W / 1000)) * Math.min(1.2, Math.max(1, H / 540)); // 좁은 화면: 줌을 낮춰 싸움이 화면에 들어오게 (폰 ≈ 0.72, 보이는 폭 ≈ 620). 캔버스가 세로로 길면(화면 채움) 조금 더 당겨 위아래 빈 곳을 줄인다
  // 룰 좌표 → 월드 좌표 (바닥 타원 안, 화면 폭에 맞춤)
  const sx = (x: number) => (x / ARENA.w - 0.5) * 1120; // 바닥 폭 거의 전체
  const sy = (y: number) => (y / ARENA.h - 0.5) * floorRy(tilt) * 1.27 - 8;
  const SC = 0.9;
  const units = [...r.team.map(g => ({ g, side: 'A' as const })), ...r.contract.enemy.map(g => ({ g, side: 'B' as const }))];
  const byId = Object.fromEntries(units.map(u => [u.g.id, u]));
  const hp: Record<number, number> = { ...r.initialHp };
  const hpAppliedIdx: Record<number, number> = {}; // 대상별로 마지막에 반영한 이벤트 순번
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
  type FxKind = 'slash' | 'dust' | 'ink' | 'ghost' | 'shock' | 'gslash' | 'dslash' | 'netline' | 'push' | 'ring' | 'halo' | 'cloth' | 'trail';
  const fx: { kind: FxKind; x: number; y: number; t: number; dir: number; seed: number; id?: number; to?: number; life?: number }[] = []; // id: 붙어 다닐 검투사 · to: 상대 · life: 총 시간
  const shouts: { text: string; t: number; x: number }[] = [];
  let armedEi = -1; // 미리 줌인을 건 이벤트 인덱스
  let holdUntil = -1; // 줌 유지(슬로모션) 끝
  let zoomOutDur = 1.2;
  let crowdCheer = 0;
  const shout = (text: string, x: number) => { shouts.length = 0; shouts.push({ text, t: 1.2, x }); crowdCheer = 0.7; sfx.cheer(0.5); };
  applyArena(r.contract.tier); // 등급별 경기장 규모
  const fansAvg = [...r.team, ...r.contract.enemy].reduce((a, g) => a + fansOf(g), 0) / (r.team.length + r.contract.enemy.length);
  const density = Math.min(1, 0.12 + S.st.fame / 100 * 0.55 + (r.contract.tier - 1) * 0.22 + fansAvg / 200); // 팬이 많으면 관중석이 찬다
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
  // 기술별 낙서풍 연출 (파티클). 상대 위치는 붙어 있는 상대(engaged)로
  function skillFx(id: number, skill: string, ct: number) {
    const p0 = posAt(ct)[id]; const d = face[id]; const tid = engaged[id]; const pt = tid != null ? posAt(ct)[tid] : null;
    const at = (kind: FxKind, life: number, extra: Partial<{ x: number; y: number; dir: number; to: number }> = {}) => fx.push({ kind, x: p0.x, y: p0.y, t: life, life, dir: d, seed: id * 13 + Math.floor(ct * 10), id, ...extra });
    switch (skill) {
      case 'feint': at('ghost', 0.45); break;                                                   // 잔상이 반대쪽으로 빠진다
      case 'shield_bash': at('shock', 0.35, { x: p0.x + d * 22 }); if (pt) fx.push({ kind: 'dust', x: pt.x, y: pt.y + 34, t: 0.5, dir: d, seed: id }); break; // 방패 앞 충격파 + 상대 발밑 먼지
      case 'riposte': at('gslash', 0.3, { x: p0.x + d * 26, y: p0.y - 4 }); break;              // 금색 역방향 베기
      case 'twin_cut': at('dslash', 0.34, { x: p0.x + d * 26, y: p0.y - 6 }); break;            // 엇갈린 두 획
      case 'net_recover': if (pt) at('netline', 0.55, { x: pt.x, y: pt.y - 10, to: tid }); break;  // 그물이 줄에 끌려 되돌아온다
      case 'spear_ward': at('push', 0.3, { x: p0.x + d * 30, y: p0.y - 8 }); if (pt) fx.push({ kind: 'dust', x: pt.x, y: pt.y + 34, t: 0.4, dir: d, seed: id + 1 }); break; // 창 끝에서 밀치는 직선
      case 'stand_firm': at('ring', 0.5, { y: p0.y + 34 }); break;                              // 발밑 먼지 고리 + 굵은 윤곽
      case 'second_wind': at('halo', 2.0); crowdCheer = Math.max(crowdCheer, 0.4); break;        // 심판 지팡이가 내려오고 흰 원, 초록 점
      case 'appeal': at('cloth', 1.2); crowdCloth = Math.min(1, crowdCloth + 0.3); break;         // 손수건이 날린다
      case 'charge_plus': at('trail', 0.45); break;                                               // 긴 먼지 자국
    }
  }
  if (DEBUG) { const keyFx = (ev: KeyboardEvent) => { const k = '1234567890'.indexOf(ev.key); if (k < 0 || S.phase !== 'battle') return; const id = r.team[0].id; engaged[id] ??= r.contract.enemy[0].id; skillFx(id, SKILLS[k].id, ct); flash.push({ id, t: 1.3, text: SKILLS[k].name, color: '#c58a1a' }); }; window.addEventListener('keydown', keyFx); } // 테스트: ?debug 에서 숫자키 1~0 으로 기술 연출을 강제로 띄운다
  function fireEvents(ct: number) {
    armCinematic(ct);
    while (ei < r.events.length && r.events[ei].t <= ct) {
      const e = r.events[ei++];
      if (e.kind === 'skill') { flash.push({ id: e.actor, t: 1.3, text: SKILL_NAME(e.skill ?? ''), color: '#c58a1a' }); if (e.skill === 'shield_bash') sfx.block(); else if (e.skill === 'net_recover') sfx.net(); else if (e.skill === 'second_wind') sfx.cheer(0.3); else sfx.whip();
        skillFx(e.actor, e.skill ?? '', ct); continue; }
      if (e.kind !== 'attack' || e.target == null) continue;
      const aid = e.actor, tid = e.target, tgtType = byId[tid].g.type;
      engaged[aid] = tid; engaged[tid] = aid;
      if (e.skill === 'riposte') flash.push({ id: aid, t: 1.2, text: '되치기!', color: '#c58a1a' }); // '반격!' 표시는 뺐다: 서로 한 대씩 주고받기만 해도 떠서 뜻이 없었다. 반격은 되치기 기술일 때만
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
      const evIdx = ei; // 이벤트 순서. 연속 공격(2타)의 피격 반영이 1타보다 먼저 와도 앞선 값이 나중 값을 덮지 않게
      pending.push({ at: ct + hitDelay + (e.net ? 0.55 : 0), fn: () => {
        if (evIdx >= (hpAppliedIdx[tid] ?? -1)) { hpAppliedIdx[tid] = evIdx; hp[tid] = e.targetHp!; }
        play(tid, e.downed ? (woundOf(tid) || !isFinal ? deathClipFor(byId[aid].g.type) : 'yield') : e.blocked && hasBigShield(loadoutFor(tgtType)) ? 'block' : 'hit', ct + hitDelay); // 경기를 끝내는 마지막 쓰러짐만 항복 자세(무릎·검지). 단체전에서 먼저 쓰러진 자와 상처로 죽는 자는 눕는다
        if (e.downed && isFinal && !woundOf(tid)) yielded.add(tid);
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
        if (e.downed && !woundOf(tid)) shout(isFinal ? '이우굴라!  이우굴라!' : '이우굴라!', pt.x); else if (e.downed) shout('…', pt.x); // 상처로 숨지면 관중은 말을 잃는다
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
      let mdir: 0 | 1 | -1 = 0; // 이동 방향
      if (pv && dt > 0) { sp = Math.hypot(p.x - pv.x, p.y - pv.y) / dt; if (Math.abs(p.x - pv.x) > 0.3) { mdir = p.x > pv.x ? 1 : -1; face[id] = mdir; } }
      prevPos[id] = { x: p.x, y: p.y };
      speedOf[id] = sp; phaseOf[id] = (phaseOf[id] ?? 0) + dt * (sp > 120 ? 16 : 7);
      const eng = engaged[id]; if (eng != null && hp[eng] > 0) face[id] = pos[eng].x >= p.x ? 1 : -1; // 붙은 상대는 물러날 때도 계속 본다 (등을 돌려 달리지 않는다)
      const a = clips[id]; const el = (ct - a.start) * 1000;
      let sk = clipSkeleton(a.clip, el);
      let lapDx = 0;
      if (lap[id]) { const L = lap[id]; const e2 = ct - L.start; const T = 3.2; const k2 = Math.min(1, e2 / T); lapDx = Math.sin(k2 * Math.PI) * 260 * L.dir; face[id] = (k2 < 0.5 ? L.dir : -L.dir) as 1 | -1; sk = { ...runSkeleton(ct * 14, true), frontArm: [-160, -10], backArm: [-140, 10] }; }
      const isBound = isAlive && ct < (boundUntil[id] ?? 0) && !isDeathClip(a.clip);
      const busy = el < clipLength(a.clip);
      if (isBound && !busy) sk = clipSkeleton('bound', 120);
      else if (isAlive && !busy && sp > 12) sk = mdir && mdir !== face[id] ? backstepSkeleton(phaseOf[id]) : runSkeleton(phaseOf[id], sp > 120); // 상대와 반대로 움직이면 뒷걸음
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
      ctx.globalAlpha = exitAlpha; // 퇴장(미시오 생존·승자 퇴장) 중에는 이름표·체력바도 사람과 함께 옮겨 가며 사라진다
      ctx.fillStyle = TYPE_COLOR[u.g.type]; ctx.beginPath(); ctx.arc(p.x - 22 + lapDx + exitDx, p.y + 40, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = u.side === 'A' ? '#2c4f9b' : ENEMY; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(u.side === 'A' ? u.g.name : u.g.name.replace('(적)', ''), p.x + 3 + lapDx + exitDx, p.y + 44);
      const ratio = Math.max(0, hp[id]) / r.initialHp[id];
      ctx.fillStyle = '#7a6a4e'; ctx.fillRect(p.x - 17 + lapDx + exitDx, p.y - 56, 34, 4);
      ctx.fillStyle = ratio > 0.5 ? '#3b7a2c' : ratio > 0.25 ? '#c58a1a' : '#9b2c1c'; ctx.fillRect(p.x - 17 + lapDx + exitDx, p.y - 56, 34 * ratio, 4);
      ctx.globalAlpha = 1;
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
      else { const life = f.life ?? 0.5, k2 = 1 - f.t / life; const u = f.id != null ? byId[f.id] : null; const cur = f.id != null ? pos[f.id] : null; // 기술 연출
        if (f.kind === 'ghost' && u && cur) { ctx.globalAlpha = 0.35 * (1 - k2); drawStickman(ctx, u.g.type, { x: cur.x - f.dir * (10 + k2 * 26), y: cur.y + 30 * SC, scale: 1.15 * SC, facing: f.dir as 1 | -1, pose: 'guard', t: 0, team: u.side === 'A' ? '#2c4f9b' : ENEMY, accessories: accessoriesOf(u.g) }); }
        else if (f.kind === 'shock') { ctx.globalAlpha = 0.8 * (1 - k2); ctx.lineWidth = 3 - k2 * 1.5; for (let i = 0; i < 2; i++) { const rr = 14 + k2 * 26 + i * 8; ctx.beginPath(); ctx.arc(f.x, f.y - 6, rr, -Math.PI * 0.45 + (f.dir > 0 ? 0 : Math.PI), Math.PI * 0.45 + (f.dir > 0 ? 0 : Math.PI)); ctx.stroke(); } }
        else if (f.kind === 'gslash') { ctx.strokeStyle = '#d4a52a'; ctx.globalAlpha = 1 - k2; ctx.lineWidth = 4 - k2 * 2; ctx.beginPath(); ctx.arc(f.x - f.dir * 8, f.y, 24 + k2 * 12, 0.5 * f.dir + (f.dir > 0 ? Math.PI : 0), -0.9 * f.dir + (f.dir > 0 ? Math.PI : 0), f.dir > 0); ctx.stroke(); }
        else if (f.kind === 'dslash') { ctx.globalAlpha = 1 - k2; ctx.lineWidth = 3 - k2 * 2; for (const o of [-7, 7]) { ctx.beginPath(); ctx.arc(f.x - f.dir * 8, f.y + o, 24 + k2 * 10, -0.9 * f.dir + (f.dir > 0 ? 0 : Math.PI), 0.5 * f.dir + (f.dir > 0 ? 0 : Math.PI), f.dir < 0); ctx.stroke(); } }
        else if (f.kind === 'netline' && cur) { const nx = f.x + (cur.x + f.dir * 10 - f.x) * k2, ny = f.y + (cur.y - 20 - f.y) * k2; ctx.globalAlpha = 0.9 * (1 - k2 * 0.5); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(cur.x + f.dir * 6, cur.y - 22); ctx.lineTo(nx, ny); ctx.stroke(); drawNetProjectile(ctx, nx, ny, 18, 1 - k2 * 0.8, k2 * 8); }
        else if (f.kind === 'push') { ctx.globalAlpha = 1 - k2; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + f.dir * (18 + k2 * 30), f.y); ctx.moveTo(f.x + f.dir * (12 + k2 * 30), f.y - 6); ctx.lineTo(f.x + f.dir * (18 + k2 * 30), f.y); ctx.lineTo(f.x + f.dir * (12 + k2 * 30), f.y + 6); ctx.stroke(); }
        else if (f.kind === 'ring') { ctx.globalAlpha = 0.7 * (1 - k2); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(f.x, f.y, 10 + k2 * 30, 4 + k2 * 10, 0, 0, Math.PI * 2); ctx.stroke(); if (u && cur && k2 < 0.6) { ctx.globalAlpha = 0.5 * (1 - k2 / 0.6); ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cur.x, cur.y + 4, 24, 0, Math.PI * 2); ctx.stroke(); } }
        else if (f.kind === 'halo' && cur) { ctx.globalAlpha = 0.7 * (1 - Math.max(0, k2 - 0.7) / 0.3); ctx.strokeStyle = '#f3ead0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cur.x, cur.y + 30, 34, 12, 0, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 3; const sy = cur.y - 70 + Math.min(1, k2 * 4) * 30; ctx.beginPath(); ctx.moveTo(cur.x - 40, sy - 40); ctx.lineTo(cur.x - 18, sy); ctx.stroke(); ctx.fillStyle = '#9b2c1c'; ctx.beginPath(); ctx.arc(cur.x - 18, sy, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#3b7a2c'; for (let i = 0; i < 5; i++) { const ph = (k2 * 2 + i * 0.2) % 1; ctx.globalAlpha = 0.8 * (1 - ph); ctx.beginPath(); ctx.arc(cur.x - 16 + i * 8, cur.y - 10 - ph * 40, 2.2, 0, Math.PI * 2); ctx.fill(); } }
        else if (f.kind === 'cloth' && cur) { ctx.fillStyle = '#f3ead0'; for (let i = 0; i < 4; i++) { const ph = (k2 + i * 0.25) % 1; ctx.globalAlpha = 0.9 * (1 - ph); ctx.save(); ctx.translate(cur.x - 12 + i * 8 + Math.sin(k2 * 10 + i) * 6, cur.y - 40 - ph * 50); ctx.rotate(Math.sin(k2 * 8 + i) * 0.6); ctx.fillRect(-4, -3, 8, 6); ctx.restore(); } }
        else if (f.kind === 'trail' && cur) { ctx.globalAlpha = 0.55 * (1 - k2); ctx.lineWidth = 1.5; for (let i = 0; i < 6; i++) { const rr = 4 + i * 3 + k2 * 6; ctx.beginPath(); ctx.arc(cur.x - f.dir * (14 + i * 14), cur.y + 34 - i * 1.5, rr, 0, Math.PI * 2); ctx.stroke(); } } }
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
    if (judge && judge.stage >= 1 && judge.stage <= 2 && !done) { // 판정 중: 쓰러진 검투사 이름을 크게 (확률 숫자는 감춘다)
      const e = ct - judge.start; const pulse = 1 + Math.sin(e * 9) * 0.04;
      judge.losers.forEach((l, i) => { const u = byId[l.id]; ctx.save(); ctx.translate(W / 2, 150 + i * 26); ctx.scale(pulse, pulse); ctx.textAlign = 'center';
        ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = '#3a2412'; ctx.fillText(`${u.g.name.replace('(적)', '')} — 관중의 뜻은…`, 0, 0); ctx.restore(); }); // 생존 확률 숫자는 보여주지 않는다 (긴장감)
      ctx.save(); ctx.fillStyle = '#7a3b1e'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.globalAlpha = 0.6 + Math.sin(ct * 6) * 0.4; ctx.fillText('화면을 두드려 함께 외쳐라!', W / 2, H - 30); ctx.restore(); }
    if (hostShout) { ctx.save(); ctx.fillStyle = hostMood === 'pleased' ? '#3b7a2c' : '#7a6a4e'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(hostShout, W / 2, 96); ctx.restore(); }
    if (intro < INTRO_HOLD) { ctx.save(); ctx.fillStyle = '#5a3a1c'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(r.contract.venue, W / 2, H - 22); ctx.restore(); }
  }

  const CEREMONY = 3.2;
  const JUDGE = 7.6; // 판정: 청원 1.6 → 주최자가 뜸을 들임(관중 침묵·북소리) 2.4 → 관중 외침 0.8 → 판결(잠깐 느려짐) 1.4 → 집행·퇴장 1.4
  let lastBeat = -1; // 판정 중 심장박동 북
  const hasJudge = r.winner !== 'draw'; let hasJudgeFailed = false; // 패자를 못 찾으면 판정 없이 마무리 (화면이 멈추지 않게)
  const END = r.duration + 1.2 + (hasJudge ? JUDGE : 0) + CEREMONY;
  let ceremonyStarted = false;
  // 미시오 판정: 패배 측의 쓰러진 검투사. 내 검투사는 실제 판정(r.fates), 상대는 연출용 결과
  let judge: { start: number; stage: number; losers: { id: number; live: boolean; x: number; y: number }[] } | null = null;
  // 판정 중에 화면을 두드리면 내 루두스 식솔과 팬들이 함께 "미테!"를 외친다 (연출: 함성·손수건이 늘어난다. 결정은 주최자의 몫)
  canvas.onpointerdown = () => { if (!judge || done || judge.stage > 2) return; crowdCloth = Math.min(1, crowdCloth + 0.15); crowdCheer = 0.7; sfx.chant(1); shouts.length = 0; shouts.push({ text: '미테!  미테!', t: 1.0, x: (Math.random() - 0.5) * 500 }); };
  const judged = new Set<number>();
  const yielded = new Set<number>(); // 항복 자세로 끝난 검투사 (마지막 쓰러짐)
  const judgeLive: Record<number, boolean> = {};
  const bleedAt: { at: number; x: number; y: number; dir: number }[] = [];
  const exits: Record<number, { start: number; dir: 1 | -1 }> = {};
  const fateOf = (id: number) => r.fates.find(f => f.g.id === id)?.fate;
  const woundOf = (id: number) => !!(r.fates.find(f => f.g.id === id)?.wound || r.enemyFates.find(f => f.g.id === id)?.wound); // 상처로 죽는가 (판정 없이)
  const hostBonus = HOST[r.contract.host].missio;
  const lap: Record<number, { start: number; dir: 1 | -1 }> = {}; // 한 바퀴 세레모니: 달려갔다 돌아옴
  let ct = 0, lastReal = performance.now(), done = false, doneAt = 0, lastDtReal = 0.016, frameNo = 0;
  const anim = () => {
    const now = performance.now(); const realRaw = (now - lastReal) / 1000; const real = Math.min(0.05, realRaw); lastReal = now; lastDtReal = real;
    let dt = real;
    if (intro < INTRO_HOLD + INTRO_ZOOM) { intro += Math.min(0.3, realRaw); dt = 0; } // 준비 단계: 실제 경과 시간으로 (프레임이 느려도 제때 줌인)
    else if (ct < slowUntil) dt = real * 0.3;
    if (!done && dt > 0) { ct += dt; fireEvents(ct); flash = flash.filter(f => (f.t -= dt * 1.8) > 0); }
    if (!done && hasJudge && !hasJudgeFailed && !judge && ct >= r.duration + 1.0) {
      const pos0 = posAt(ct);
      const losersRaw = units.filter(u => u.side !== r.winner && hp[u.g.id] <= 0 && !woundOf(u.g.id)); // 상처로 이미 숨진 자는 판정 대상이 아니다
      if (!losersRaw.length && units.some(u => u.side !== r.winner && woundOf(u.g.id))) { hasJudgeFailed = true; hostShout = '쓰러진 자는 다시 일어나지 못했다'; }
      else if (!losersRaw.length) { console.warn('judge: no losers', r.winner, JSON.stringify(hp), JSON.stringify(r.downed.map(g => g.id)), r.events.slice(-3).map(e => `${e.t}:${e.kind}:${e.actor}>${e.target}:${e.targetHp}:${e.downed}`).join(' ')); hasJudgeFailed = true; }
      const losers = losersRaw.map(u => ({ id: u.g.id, live: u.side === 'A' ? fateOf(u.g.id) !== 'dead' : (r.enemyFates.find(f => f.g.id === u.g.id)?.fate ?? 'unharmed') !== 'dead', x: pos0[u.g.id].x, y: pos0[u.g.id].y }));
      judge = { start: ct, stage: 0, losers };
      for (const l of losers) { judged.add(l.id); judgeLive[l.id] = l.live; play(l.id, yielded.has(l.id) ? 'plead' : 'plea', ct); engaged[l.id] = undefined; face[l.id] = l.x < 0 ? 1 : -1; } // 항복 자세면 그대로, 누워 있던 자는 일어나 무릎 꿇고 검지를 든다
      if (!losers.length) { judge = null; } else {
      const L0 = losers[0]; zoomAt = { x: L0.x, y: L0.y - 10 }; zoomStart = ct; holdUntil = ct + 1.3; zoomOutDur = 0.5;
      shout('미테!  미테!', L0.x); hostShout = '쓰러진 검투사가 검지를 들어 미시오를 청한다 — 화면을 두드려 함께 외치자'; crowdCloth = 0.4; }
    }
    if (judge && !done) {
      const e = ct - judge.start; const py = -floorRy(1) * 1.03;
      if (judge.stage === 0 && e >= 1.6) { judge.stage = 1; hostMood = 'judging'; sfx.drum(1); hostGesture = 'none'; crowdCloth = hostBonus > 0 ? 0.8 : hostBonus < 0 ? 0.2 : 0.5; zoomAt = { x: 0, y: py - 30 }; zoomStart = ct; holdUntil = ct + 2.6; zoomOutDur = 0.5; hostShout = '주최자가 일어선다… 관중이 숨을 죽인다'; shouts.length = 0; lastBeat = ct; }
      if (judge.stage === 1) { if (ct - lastBeat >= 0.75) { lastBeat = ct; sfx.drum(1); } if (e >= 3.0 && hostShout !== '주최자가 손을 든다…') hostShout = '주최자가 손을 든다…'; }
      if (judge.stage === 1 && e >= 4.0) { judge.stage = 2; shout(hostBonus > 0 ? '미테!  미테!' : '이우굴라!  이우굴라!', 0); }
      if (judge.stage === 2 && e >= 4.8) { judge.stage = 3; slowUntil = ct + 0.5; const allLive = judge.losers.every(l => l.live); const anyLive = judge.losers.some(l => l.live);
        hostGesture = allLive ? 'cloth' : 'thumb'; crowdCloth = allLive ? 0.9 : 0.1; if (allLive) sfx.cheer(1); else { sfx.boo(); sfx.drum(3); } holdUntil = ct + 1.0; zoomOutDur = 0.5;
        hostShout = allLive ? '주최자가 손을 높이 든다 — 미숨! 살려라' : anyLive ? '주최자가 엄지를 내린다 — 한 명은 살리고, 한 명은…' : '주최자가 엄지를 내린다 — 이우굴라! 죽여라';
        shout(allLive ? '미숨!' : '이우굴라!', 0); }
      if (judge.stage === 3 && e >= 6.2) { judge.stage = 4; const L0 = judge.losers[0]; zoomAt = { x: L0.x, y: L0.y - 10 }; zoomStart = ct; holdUntil = ct + 1.2; zoomOutDur = 0.6;
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
      else { // 덤덤한 반응: 승패와 주최자 성격에 따라 다르다
        const flat: Record<HostKind, string> = { magistrate: '관리는 서기에게 다음 순서를 묻는다', candidate: '후보는 관중석을 향해 손을 흔든다', miser: '유지는 상금 셈에 바쁘다', mourner: '상주는 말없이 고인의 자리를 바라본다', gambler: '부호는 판돈을 세며 고개를 끄덕인다', imperial: '황제는 고개만 까딱한다' };
        hostShout = r.winner === 'B' ? `${flat[r.contract.host]} — 승자는 상대 파밀리아` : flat[r.contract.host]; }
      const p0 = winners.length ? posAt(ct)[star!.g.id] : { x: 0, y: 0 }; zoomAt = { x: p0.x, y: p0.y - 10 }; zoomStart = ct; holdUntil = ct + CEREMONY - 0.8; zoomOutDur = 0.8;
    }
    for (let i = bleedAt.length - 1; i >= 0; i--) if (ct >= bleedAt[i].at) { const b = bleedAt[i]; bleed(b.x, b.y, b.dir, 18, 1.3); bleedAt.splice(i, 1); }
    if ((frameNo++ & 7) === 0) setCrowd(judge && judge.stage === 1 && !done ? 0.04 : 0.2 + density * 0.4 + (crowdCheer > 0 ? 0.35 : 0) + (frenzy ? 0.5 : 0)); // 판정 중엔 관중이 숨을 죽인다
    draw(ct, Math.max(dt, real * 0.25));
    if (!done && ct >= END) { done = true; doneAt = performance.now(); skip.textContent = '결과 보기'; }
    if (done && performance.now() - doneAt >= 1500 && S.phase === 'battle') { toResult(); return; } // 퇴장까지 다 보이면 1.5초 뒤 결과 화면으로 자동 전환 (done 이후엔 ct 가 멈추므로 실제 시간으로)
    if (S.phase === 'battle') requestAnimationFrame(anim);
  };
  anim();
  const toResult = () => { stopCrowd(); S.phase = 'result'; renderResult(); };
  skip.onclick = () => { if (intro < INTRO_HOLD + INTRO_ZOOM) { intro = INTRO_HOLD + INTRO_ZOOM; return; } toResult(); };
}

function renderResult() {
  const r = S.report!;
  app.replaceChildren(); app.classList.remove('fit'); app.classList.remove('land', 'plan', 'battle', 'page');
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
      if (g.status === 'rudiarius') parts.push(h('button', { class: 'tiny', title: '플람마처럼 자유를 물리고 노예로 남는다. 명예 +8', onclick: () => { void ask(`${g.name} 이(가) 루디스를 거절합니까? 노예로 남고 명예 +8`, { ok: '거절' }).then(ok => { if (ok) { refuseRudis(S.st, g); renderResult(); } }); } }, '루디스 거절 (명예 +8)')); }
    for (const ne of r.newEpithets.filter(x => x.g === g)) parts.push(h('span', { class: 'badge epithet', title: `${ne.e.cond} → ${ne.e.effect}` }, `별칭 '${ne.e.name}' 획득`));
    return parts;
  };
  // 결과 자세: 사망 = 시신(쓰러진 클립의 끝 장면), 부상·미시오 = 쓰러진 뒤 무릎, 승자 = 팔 들어 환호, 무승부·기타 = 경례
  const poseFor = (g: Gladiator, dead: boolean, down: boolean, winner: boolean, killer?: GType): { pose?: Pose; skeleton?: Skeleton } => dead ? { skeleton: clipSkeleton(deathClipFor(killer ?? 'murmillo'), clipLength(deathClipFor(killer ?? 'murmillo'))) } : down ? { pose: 'bow' } : winner ? { pose: 'victory_low' } : { pose: 'salute' }; // 환호는 팔을 너무 높이 들면 초상 위로 잘려 낮은 쪽
  const myCards = r.team.map(g => { const f = r.fates.find(x => x.g.id === g.id); const dead = f?.fate === 'dead', down = r.downed.some(d => d.id === g.id) || f?.fate === 'injured'; return h('div', { class: `fatecard${dead ? ' dead' : ''}` }, portrait(g, 84, false, poseFor(g, dead, down, won, r.contract.enemy[0]?.type)), h('div', { class: 'grow' },
    h('div', {}, h('span', { class: 'sq small', style: `background:${TYPE_COLOR[g.type]}` }, glyphSvg(g.type, 14)), ' ', h('span', { class: 'nm' }, g.name)),
    h('div', {}, ...fateBadge(g)))); });
  const enemyCards = r.contract.enemy.map(g => { const ef = r.enemyFates.find(f => f.g.id === g.id); const rvName = rivalOf(S.st.rivals, r.contract.rivalId)?.name ?? '타지 라니스타의 검투사'; const edead = ef?.fate === 'dead';
    return h('div', { class: `fatecard enemy${ef ? ' down' : ''}${edead ? ' dead' : ''}` }, portrait(g, 84, true, poseFor(g, edead, !!ef, r.winner === 'B', r.team[0]?.type)), h('div', { class: 'grow' },
    h('div', {}, h('span', { class: 'sq small', style: `background:${TYPE_COLOR[g.type]}` }, glyphSvg(g.type, 14)), ' ', h('span', { class: 'nm' }, g.name.replace('(적)', '')), h('span', { class: 'meta' }, ` ${rvName}`)),
    h('div', {}, ef ? h('span', { class: `badge ${ef.fate === 'dead' ? 'dead' : ef.fate === 'injured' ? 'injured' : 'missio'}` }, ef.fate === 'dead' ? (ef.wound ? '즉사' : '처형') : ef.fate === 'injured' ? '미시오 · 부상' : '미시오 생존') : h('span', { class: 'badge ok' }, won ? '무사' : '승리'),
      r.revenges.some(x => x.enemy.id === g.id) ? h('span', { class: 'badge revenge' }, '복수 성공') : null, r.grudges.some(x => x.enemy.id === g.id) ? h('span', { class: 'badge grudge' }, '원한 재대결') : null))); });
  const money = (label: string, v: number, sign: 1 | -1 = 1) => h('div', { class: 'mrow' }, h('span', {}, label), h('span', { class: v ? (sign > 0 ? 'plus' : 'minus') : '' }, `${sign > 0 ? '+' : '−'}${v.toLocaleString()}`));
  app.append(h('div', { class: 'panel result' }, // 팝업이 아니라 편성·정산처럼 한 페이지
    h('h2', { style: `color:${won ? 'var(--ok)' : r.winner === 'draw' ? 'var(--dim)' : 'var(--red)'}` }, won ? '승리' : r.winner === 'draw' ? '무승부 (스탄테스 미시)' : '패배', h('span', { class: 'hint', style: 'margin-left:10px;font-weight:400' }, `${r.contract.venue} · ${HOST_KO[r.contract.host]} · ${r.duration.toFixed(1)}초${rivalOf(S.st.rivals, r.contract.rivalId) ? ` · ${rivalOf(S.st.rivals, r.contract.rivalId)!.name} (${recordVsMe(rivalOf(S.st.rivals, r.contract.rivalId)!)})` : ''}`), r.classic ? h('span', { class: 'syn classic', style: 'margin-left:8px' }, '전통 짝 대결') : null),
    h('div', { class: 'rlayout' }, // 왼쪽: 검투사(우리·상대 위아래), 오른쪽: 수지·호감도·전투 기록
      h('div', { class: 'rleft' }, h('h3', {}, '우리 파밀리아'), ...myCards, h('h3', {}, '상대 파밀리아'), ...enemyCards),
      h('div', { class: 'rright' },
    h('div', { class: 'mtable' }, money('대여료', r.rent), money('출전 경비', r.expense, -1), money(r.bet?.won ? '승리 상금 (내기 ×2)' : '승리 상금', r.prize), r.guestGift ? money('귀족 사례금', r.guestGift) : null, money('사망 배상금', r.compensation), r.salary ? money('자유민 급료', r.salary, -1) : null, r.bet && !r.bet.won ? money('내기 패배', r.bet.amount, -1) : null,
      h('div', { class: 'mrow total' }, h('span', {}, '이번 경기 수지'), h('span', { class: net >= 0 ? 'plus' : 'minus' }, `${net >= 0 ? '+' : '−'}${Math.abs(net).toLocaleString()} HS`)),
      h('div', { class: 'mrow' }, h('span', {}, '호감도' + (r.classic && r.winner === 'A' ? ` (전통 짝 +${CONFIG.fameDelta.classicWin} 포함)` : '')), h('span', { class: r.fameDelta >= 0 ? 'plus' : 'minus' }, `${r.fameDelta >= 0 ? '+' : ''}${r.fameDelta}`))),
    h('details', {}, h('summary', { class: 'hint', style: 'cursor:pointer' }, `전투 기록 보기 (${r.duration.toFixed(1)}초)`), h('div', { class: 'log', style: 'margin-top:6px;max-height:220px' }, r.log.join('\n'))))),
  ));
  app.prepend(headerEl()); window.scrollTo(0, 0);
  app.append(S.queue.length ? graffitiBtn('duel', 'SEQVENS', `다음 경기 (${S.queue.length}경기 남음)`, () => { S.phase = 'battle'; nextFight(); }, S.queue.length) : graffitiBtn('coins', 'RATIONES', '시즌 정산으로', () => { S.phase = 'battle'; nextFight(); })); app.classList.add('land', 'page', 'gf'); // 결과도 무대 안: 아래 띠 자리에 낙서 그림 버튼 (다음 경기 = 결투 SEQVENS, 정산 = 동전 더미 RATIONES)
}

render();
