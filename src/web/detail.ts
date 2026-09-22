// 검투사 상세·확정(구매/매각/치료) 페이지와 카드 조각
import { S, myInk } from './state.js';
import { type Contract, type Gladiator } from '../core/types.js';
import { CONFIG } from '../core/config.js';
import { buy, canBuy, cellOf, cellQuality, bedCostOf, inBed, leavePalus, occupantOf, palusOf, priceOf, release, renewContract, renewCost, rosterCap, sell, upgrade, upgradeCost } from '../core/game.js';

import { ORIGIN_KO, ORIGIN_DESC, CELL_Q_KO } from '../core/game.js';
import { FANS_STAR, HOST } from '../core/hosts.js';
import { sfx } from './sound.js';
import { EPITHET_BY_ID, accessoriesOf, type EpithetId } from '../core/epithets.js';
import { LINEAGE_KO, LINEAGE_DESC, TYPE_KO, fansOf, sellPrice, isPrimusPalus } from '../core/gladiator.js';
import { INK, NPC_POSES, drawStickman, type Skeleton, walkSkeleton } from './stickman.js';
import { backBtn, h, helpBtn, gearLine } from './dom.js';
import { render, save, DEBUG } from './main.js';
import { portraits, talkScenes } from './portrait.js';

import { assignedTo } from './plan.js';
import { canPayFac } from './sheets.js';
import { gladCard, CARD_PORTRAIT } from './gcard.js';
import { masteryOf, masteryCandidates, basicDictataOf, masterySlotsUsed } from '../core/dictata.js';
import { ageBand, AGE_BAND_KO, trainShares, CURVE_KO, CURVE_DESC, TRAIT_DESC, TRAIT_KO as GROWTH_TRAIT_KO } from '../core/growth.js';
const KO4 = { hp: '체력', atk: '공격', def: '방어', hand: '손놀림' } as const;
import { talentOf, TALENT_KO } from '../core/talent.js';
import { LEGEND_BY_ID, legendGen } from '../core/legends.js'; /* 검투사 카드는 한 종류 (2026-09-17) */

export const ORIGIN_SHORT: Record<string, string> = { captive: '포로', damnatus: '죄수', auctoratus: '자유민 계약' };
function originBadge(g: Gladiator): Node | null {
  if (!g.origin || g.origin === 'slave') return null;
  const O = CONFIG.origins;
  const tip = g.origin === 'captive' ? `전쟁 포로: 값이 싸고 강하지만 관중이 냉담해 미시오 ${Math.round(O.captive.missio * 100)}%` : g.origin === 'damnatus' ? `형벌 죄수: 매우 싸고 약함. 사망 배상 절반, ${O.damnatus.freeAfter}시즌(3년) 뒤 형기 만료로 자유` : `자유민 계약자: 계약금만 내고 데려오며 급료(대여료의 ${Math.round(CONFIG.rudiariusShare * 100)}%)를 받음. ${O.auctoratus.term}시즌 계약`;
  const left = g.origin === 'auctoratus' && g.contractUntil != null ? ` ${Math.max(0, g.contractUntil - S.st.season + 1)}시즌` : g.origin === 'damnatus' && g.boughtSeason != null && (g.status ?? 'slave') === 'slave' ? ` ${Math.max(0, O.damnatus.freeAfter - (S.st.season - g.boughtSeason + 1))}시즌` : '';
  return h('span', { class: `badge origin ${g.origin}`, title: tip }, ORIGIN_SHORT[g.origin] + left);
}
// 계약 상대 설명: 파밀리아 이름 + 이름(유형·전적). 원한·복수 관계 표시
export const hostPrize = (c: Contract) => Math.round(CONFIG.prizePerTier * c.tier * HOST[c.host].prize);
export const hostSpan = (c: Contract) => { const H = HOST[c.host]; return h('span', { class: `host ${c.host}`, title: `${H.ko}: ${H.desc}\n상금 ×${H.prize} · 대여료 ×${H.rent} · 미시오 ${H.missio >= 0 ? '+' : ''}${Math.round(H.missio * 100)}% · 루디스 ${H.rudis >= 0 ? '+' : ''}${Math.round(H.rudis * 100)}%${H.fameWin ? ` · 승리 호감도 +${H.fameWin}` : ''}${H.honorAll ? ` · 출전자 명예 +${H.honorAll}` : ''}${H.bet ? ' · 내기 가능' : ''}` }, H.ko); };
// 성장형·자질 칩 (상세, 2026-09-22 사용자): 곡선 · 결 · 자질 — 색은 자질 흙빛과 같은 계열
function growthChips(g: Gladiator): Node[] { const gr = g.growth; const out: Node[] = [];
  if (gr?.curveKnown && gr.curve !== 'normal') out.push(h('span', { class: `badge chip curve ${gr.curve}`, title: `성장형 — ${CURVE_DESC[gr.curve]}` }, CURVE_KO[gr.curve])); /* 성장형 '평범'은 칩을 안 단다 — 자질 '평범'과 겹쳐 보였다. 특이한 곡선만 (2026-09-22 사용자) */
  if (gr?.trait && gr.traitKnown) { const ONE_KO: Record<string, string> = { hp: '체력', atk: '공격', def: '방어', hand: '손놀림' }; const one = gr.trait === 'one' && gr.one ? ONE_KO[gr.one] : null;
    out.push(h('span', { class: `badge chip trait ${gr.trait}${one ? ` one-${gr.one}` : ''}`, title: `결 — ${GROWTH_TRAIT_KO[gr.trait]}${one ? ` (${one})` : ''}: ${TRAIT_DESC[gr.trait]}` }, GROWTH_TRAIT_KO[gr.trait])); } /* '한 우물(체력)' 대신 '한 우물' — 어느 능력치인지는 칩 색과 툴팁이 말한다 (2026-09-22 사용자) */
  const t = talentOf(g); out.push(h('span', { class: `badge chip talent t${t}`, title: `자질 — 성장 속도 ×${CONFIG.growthModel.talentMul[t]}, 상한 ×${CONFIG.growthModel.talentCap[t]}` }, TALENT_KO[t]));
  if (g.legend) out.push(h('span', { class: 'badge chip legendtag', title: `전설 — ${LEGEND_BY_ID[g.legend]?.lore ?? ''}. 이름·나이·성장형·잠재치·고유 딕타타가 정해져 있다` }, '전설')); /* 천부 옆 전설 칩 (2026-09-22 사용자) */
  return out; }
function epithetBadges(g: Gladiator): Node[] {
  const sc: Node[] = []; // 왼손잡이 칩은 뺐다 — 카드 바닥에 뒤집힌 손이 그려진다 (2026-09-17 사용자)
  return [...sc, ...(g.epithets ?? []).map(id => { const e = EPITHET_BY_ID[id as EpithetId]; return e ? h('span', { class: 'badge epithet', title: `${e.latin} · ${e.cond} → ${e.effect}${e.attested ? ' (실제 기록)' : ''}` }, `'${e.name}'`) : null; }).filter((n): n is HTMLElement => !!n)];
}
// 켈라·시장·지원자의 검투사 카드. 모양은 공통 카드(gcard.ts) 그대로 쓰고, 이 화면만 아는 표식(예명·출신·상태)과 능력치 줄, 행동 버튼을 얹는다 (2026-09-17 사용자: "카드는 모두 통일")
export function gladRow(g: Gladiator, extra: (Node | null)[] = [], opts: { sel?: boolean; other?: boolean; dis?: boolean; onclick?: () => void; tag?: Node | null } = {}) {
  const nameExtra: (Node | null)[] = [
    /* '자유민' 칩도 뺐다 — 초상이 허리에 나무 검(루디스)을 찼다 (2026-09-17 사용자) */
    originBadge(g), ...epithetBadges(g), opts.tag ?? null];
  const stat = h('span', {}, `${g.wins}승/${g.fights}전 · 미시오 ${g.missios} · 팬 ${fansOf(g)}${fansOf(g) >= FANS_STAR ? '★' : ''}`); /* HP·공·방은 카드가 세로로 세워 보여 준다 */
  const state = `${TYPE_KO[g.type]} · ${LINEAGE_KO[g.lineage]} · ${g.age ?? '?'}세${g.injured ? ' · ⚠ 부상' : ''}${g.fought ? ' · ✓ 출전 완료' : ''}${(g.fatigue ?? 0) > 0 ? ` · 피로 ${g.fatigue} (공·방 −${(g.fatigue ?? 0) * CONFIG.fatigue.statPenalty})` : ''}${g.trained ? ' · 훈련함' : ''}`;
  return gladCard(g, { size: CARD_PORTRAIT, cls: 'full', sel: opts.sel, other: opts.other, dis: opts.dis, onclick: opts.onclick, nameExtra, rows: [stat, h('span', {}, state)], acts: extra });
}
// 검투사 카드의 행동 버튼(치료·매각·독토르·재훈련·재계약·내보내기·기술 제안). 켈라 방 시트가 쓴다
function gladActions(g: Gladiator): (Node | null)[] {
  return [
      g.injured ? h('span', { class: 'hint', title: '즉시 치료는 없다. 침상에 눕히면 시즌마다 1씩 낫고 치료비를 낸다. 눕히지 못하면 낫기도 덧나기도 한다' }, inBed(S.st, g) ? `침상 · 시즌 치료비 ${bedCostOf(S.st)}` : '침상 밖 — 덧날 수 있다') : null,
      (g.status ?? 'slave') === 'slave' ? h('button', { onclick: () => openConfirm(g, 'sell') }, `매각 ${sellPrice(g).toLocaleString()}`) : null,
      g.status === 'rudiarius' && g.contractUntil != null && g.contractUntil - S.st.season <= 1 ? h('button', { class: 'primary', disabled: S.st.money < renewCost(g), title: `계약 ${CONFIG.origins.auctoratus.term}시즌 연장`, onclick: () => { renewContract(S.st, g); render(); } }, `재계약 ${renewCost(g).toLocaleString()}`) : null,
      g.status && g.status !== 'slave' ? h('button', { onclick: () => openConfirm(g, 'release') }, '내보내기') : null,
    ];
}
 // 지금 떠 있는 상세 페이지 (kind:id)
function closeDetail() { const el = document.querySelector('.detailpage'); S.shownDetail = null; if (!el) { S.detail = null; render(); return; } el.classList.add('closing'); window.setTimeout(() => { S.detail = null; render(); }, 280); }
// 상세를 좌우로 밀면 이웃 검투사로 간다 (켈라는 격자 순서, 시장은 판매대 순서). 끝에서는 반대쪽 끝으로 돈다
type DetailKind = 'roster' | 'market' | 'applicant';
const detailOrder = (kind: DetailKind): Gladiator[] => kind === 'market' ? S.st.market : kind === 'applicant' ? S.st.applicants : Array.from({ length: S.st.ludus.cells.length }, (_, k) => occupantOf(S.st, k)).filter((g): g is Gladiator => !!g);
function swipeDetail(dir: 1 | -1) { const d = S.detail; if (!d || d.confirm) return; const list = detailOrder(d.kind); if (list.length < 2) return; const i = list.findIndex(g => g.id === d.id); if (i < 0) return; d.id = list[(i + dir + list.length) % list.length].id; S.detailSwipe = dir; sfx.step(); render(); }
function swipeArea(el: HTMLElement): HTMLElement { // 가로로 60px 넘게 끌면 이웃으로. 세로로 더 움직였으면 스크롤, 버튼에서 시작했으면 그 버튼의 몫. 끌 때 투명해지지 않는다 (2026-09-22 사용자)
  let p: { x: number; y: number; t: number; id: number; live: boolean } | null = null;
  const settle = (ms = 180) => { el.style.transition = `transform ${ms}ms cubic-bezier(.16,.84,.3,1), opacity ${ms}ms`; window.setTimeout(() => { el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; el.style.willChange = ''; }, ms + 30); };
  el.addEventListener('pointerdown', (ev: PointerEvent) => { p = (ev.target as Element).closest?.('button, input, .dd') ? null : { x: ev.clientX, y: ev.clientY, t: performance.now(), id: ev.pointerId, live: false }; if (p) el.style.willChange = 'transform, opacity'; });
  el.addEventListener('pointermove', (ev: PointerEvent) => { const q = p; if (!q) return; const dx = ev.clientX - q.x, dy = ev.clientY - q.y; if (!q.live) { if (Math.abs(dy) > 16 && Math.abs(dy) > Math.abs(dx)) { p = null; el.style.willChange = ''; return; } if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.25) return; q.live = true; el.setPointerCapture(q.id); } ev.preventDefault(); const pull = Math.sign(dx) * Math.min(70, Math.pow(Math.abs(dx), 0.84)); el.style.transition = ''; el.style.transform = `translateX(${pull}px) rotate(${pull * 0.011}deg)`;  });
  el.addEventListener('pointercancel', () => { p = null; settle(160); });
  el.addEventListener('pointerup', (ev: PointerEvent) => { const q = p; p = null; if (!q) return; const dx = ev.clientX - q.x, dy = ev.clientY - q.y, dt = performance.now() - q.t; if (!q.live || dt > 900 || Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.35) { settle(170); return; } const dir: 1 | -1 = dx < 0 ? 1 : -1; el.style.transition = 'transform 170ms cubic-bezier(.5,0,.8,.4), opacity 170ms'; el.style.transform = `translateX(${dir > 0 ? -105 : 105}%) rotate(${dir > 0 ? -1.8 : 1.8}deg)`;  window.setTimeout(() => swipeDetail(dir), 135); });
  return el;
}
export function openConfirm(g: Gladiator, what: 'sell' | 'release' | 'buy') { if (!S.detail) S.detail = { kind: what === 'buy' ? 'market' : 'roster', id: g.id, solo: true }; S.detail.confirm = what; render(); }
function closeConfirm() { const el = document.querySelector('.detailpage.confirm'); const done = () => { if (S.detail?.solo) S.detail = null; else if (S.detail) delete S.detail.confirm; render(); }; if (!el || !S.detail) { done(); return; } el.classList.add('closing'); window.setTimeout(done, 280); }
export function drawTalkScene(e: { c: HTMLCanvasElement; g: Gladiator; start: number; what: 'sell' | 'release' | 'buy' }, t: number) {
  const ctx = e.c.getContext('2d')!; const W = e.c.width / devicePixelRatio, H = e.c.height / devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#e3d3a6'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#cbb67f'; ctx.fillRect(0, H - 10, W, 10);
  const el = (performance.now() - e.start) / 1000; const sc = Math.min(1.08, Math.max(0.92, W / 340)), gy = H - 10; /* 확인 대화 장면용 인물 크기: 모바일 패널 안에서 라니스타와 검투사가 잘리지 않게 */
  // 검투사: 왼쪽에서 걸어 들어와 라니스타 앞에 선다 (구매는 사슬 풀린 노예가 상인 쪽에서 오듯 조금 늦게)
  const ENTER = 0.9; const gx1 = W * 0.36; const k = Math.min(1, el / ENTER), ease = 1 - Math.pow(1 - k, 2); const gx = -40 + (gx1 + 40) * ease;
  /* 치료 장면은 뺐다 (2026-09-22: 즉시 치료가 없어진 뒤 남아 있던 껍데기) */
  const team = myInk(); const w = Math.sin(t * 2);
  const gsk: Skeleton = k < 1 ? walkSkeleton(el * 9, 1) : e.what === 'release' ? { ...NPC_POSES.stand, lean: 2, frontArm: [30 + w * 3, 40], headBob: 1 } : e.what === 'sell' ? { ...NPC_POSES.stand, lean: -3, headBob: 6 + w * 0.5, frontArm: [10, 8] } : { ...NPC_POSES.stand, lean: 4, headBob: 2, frontArm: [20 + w * 3, 15] };
  if (e.what === 'buy') { // 시장 노예: 판매대와 똑같이 맨몸 + 손목 묶임 + 발의 백묵 (걸어 들어온 뒤)
    if (k < 1) drawStickman(ctx, e.g.type, { x: gx, y: gy, scale: sc, skeleton: gsk, t, team, facing: 1, bare: true });
    else { drawStickman(ctx, e.g.type, { x: gx, y: gy, scale: sc, pose: 'captive_up', t, team, facing: 1, bare: true });
      const wx = gx + 9 * sc, wy = gy - 27 * sc; ctx.strokeStyle = '#7a5a2c'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.ellipse(wx, wy, 5 * sc, 3.2 * sc, 0, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(wx, wy + 3 * sc); ctx.lineTo(wx - 2, wy + 12 * sc); ctx.stroke();
      ctx.strokeStyle = '#e8d9b5'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(gx - 8 * sc, gy - 1); ctx.lineTo(gx + 8 * sc, gy - 1); ctx.stroke(); }
  } else drawStickman(ctx, e.g.type, { x: gx, y: gy, scale: sc, skeleton: gsk, t, team, accessories: accessoriesOf(e.g), facing: 1 });
  // 라니스타: 오른쪽에 서서 서판을 들고 말한다 (말풍선이 뜰 때 손짓)
  const talking = (el > 0.2 && el < 1.4) || (el > 2.6 && el < 3.8); const lsk: Skeleton = talking ? { ...NPC_POSES.point, lean: 5, frontArm: [80 + w * 15, 30 - w * 8], backArm: [-40, -25], headBob: 1 + w } : { ...NPC_POSES.tablet, lean: 3, headBob: w * 0.6 };
  drawStickman(ctx, 'murmillo', { x: W * 0.68, y: gy, scale: sc, facing: -1, skeleton: lsk, t, ink: INK, bare: true, garment: 'toga', garmentColor: '#f3ead0', beard: true,
    hands: (c, f) => { c.fillStyle = '#d9c69a'; c.fillRect(f.hx - 7, f.hy - 12, 9, 12); c.strokeStyle = INK; c.lineWidth = 1; c.strokeRect(f.hx - 7, f.hy - 12, 9, 12); } });
}
function talkLines(g: Gladiator, what: 'sell' | 'release' | 'buy'): { who: 'l' | 'g'; text: string }[] {
  const L = S.st.lanista.name.split(' ')[0]; void L;
  if (what === 'sell') { const p = sellPrice(g).toLocaleString();
    return [{ who: 'l', text: `상인이 값을 불렀다. ${p} HS.` }, { who: 'g', text: g.injured ? '이 몸으로도 사 간답니까, 도미네.' : g.wins >= 3 ? `${g.wins}승을 올린 저를… 파시는 겁니까.` : '…팔려 가는 겁니까, 도미네.' }, { who: 'l', text: '루두스도 먹고살아야지. 잘 가라.' }]; }
  if (what === 'release') return [{ who: 'l', text: g.status === 'doctor' ? '수고했다. 이제 제자들은 내가 맡지.' : '계약은 여기까지다. 목검은 두고 가라.' }, { who: 'g', text: g.status === 'doctor' ? '제자들을 잘 부탁드립니다, 도미네.' : '고맙습니다. 이 이름은 이 루두스가 만든 것입니다.' }, { who: 'l', text: '가서 네 이름으로 살아라.' }];
  const p = priceOf(S.st, g).toLocaleString();
  return [{ who: 'l', text: '이름이 뭐냐.' }, { who: 'g', text: g.origin === 'captive' ? `${g.name}. …포로입니다. 검을 쥐게 해 주십시오.` : g.origin === 'damnatus' ? `${g.name}입니다. 죄수지만 살아남을 줄은 압니다.` : `${g.name}입니다. 상인이 그렇게 불렀습니다.` }, { who: 'l', text: `${p} HS. 켈라에 자리를 마련하겠다.` }];
}
// 금화 줄: 동전 아이콘 + 굵은 금액 + 지불/획득 (+ 작은 주석)
export function moneyRow(m: { amount: number; verb: string; note?: string }): Node {
  const ic = h('span', { class: 'coin' }); ic.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>';
  return h('div', { class: `moneyrow ${m.verb === '지불' ? 'pay' : 'gain'}` }, ic, h('b', {}, `${m.amount.toLocaleString()} HS`), h('span', { class: 'verb' }, m.verb), m.note ? h('span', { class: 'note' }, m.note) : null);
}
export function confirmPage(): Node {
  const d = S.detail!; const g = detailOrder(d.kind).find(x => x.id === d.id) ?? (d.kind === 'roster' ? S.st.roster : d.kind === 'market' ? S.st.market : S.st.applicants).find(x => x.id === d.id); if (!g) { delete d.confirm; return h('div'); }
  const what = d.confirm!; const O = CONFIG.origins;
  const lines: string[] = []; let okLabel = '', disabled = false, why = ''; let money: { amount: number; verb: string; note?: string } | null = null; // 왼쪽 금화 줄: 얼마 지불 / 얼마 획득
  if (what === 'sell') {
    const p = sellPrice(g); okLabel = '매각'; money = { amount: p, verb: '획득' };
    lines.push(`· 켈라 ${cellOf(S.st, g) + 1}번이 비고 유지비가 줄어든다`, '· 전적·기술·별칭은 함께 떠난다. 되사올 수 없다');
    if (assignedTo(g.id) != null) lines.push('· 이번 시즌 편성에서 빠진다');
  } else if (what === 'release') {
    okLabel = '내보내기'; money = { amount: 0, verb: '획득', note: '자유민이라 값을 받지 못한다' };
    lines.push(g.status === 'doctor' ? '· 독토르 급료가 사라지고 같은 유형 훈련 보너스도 끝난다' : '· 급료와 켈라 유지비가 사라진다', '· 다시 부를 수 없다');
  } else {
    const price = priceOf(S.st, g); const full = S.st.roster.length >= rosterCap(S.st); okLabel = '구매'; money = { amount: price, verb: '지불', note: price < g.buyPrice ? `해방노예 할인, 정가 ${g.buyPrice.toLocaleString()}` : undefined };
    disabled = S.st.money < price || full; why = S.st.money < price ? `자금 ${(price - S.st.money).toLocaleString()} HS 부족` : full ? `켈라 ${S.st.roster.length}/${rosterCap(S.st)} 가득 참` : '';
    lines.push(`· 켈라 ${S.st.roster.length}/${rosterCap(S.st)} → ${S.st.roster.length + 1}/${rosterCap(S.st)}, 유지비 늘어남`);
    if (g.origin === 'captive') lines.push(`· 전쟁 포로: 관중이 냉담해 미시오 ${Math.round(O.captive.missio * 100)}%`);
    if (g.origin === 'damnatus') lines.push(`· 형벌 죄수: 사망 배상 절반, ${O.damnatus.freeAfter}시즌 뒤 형기 만료로 자유민`);
    if (g.origin === 'auctoratus') { okLabel = '계약'; money = { amount: g.buyPrice, verb: '계약금' }; lines.push(`· 자유민 계약 ${O.auctoratus.term}시즌 · 출전마다 대여료의 ${Math.round(CONFIG.rudiariusShare * 100)}% 급료`, '· 팔 수 없고 사망 배상도 없다'); }
  }
  // 확인: 붉은 라틴어 도장이 장면 위에 쾅 찍히고(북소리), 잠시 뒤 실행되며 페이지가 닫힌다
  const stampText = what === 'sell' ? 'VENDITVS' : what === 'release' ? 'DIMISSVS' : 'EMPTVS'; // 팔림 / 내보냄 / 사들임
  let stamped = false;
  const doIt = () => {
    if (stamped) return; stamped = true;
    if (what === 'buy' && !canBuy(S.st, g)) return;
    const page = document.querySelector('.detailpage.confirm');
    if (page) page.append(h('div', { class: 'stamp confirmstamp' }, h('span', {}, stampText))); sfx.down(); window.setTimeout(() => sfx.drum(1), 40);
    window.setTimeout(() => {
      if (what === 'sell') { sell(S.st, g); sfx.coin(); S.notice = `${g.name} 매각`; }
      else if (what === 'release') { release(S.st, g); S.notice = `${g.name} 이(가) 루두스를 떠났다`; }
      else { if (!buy(S.st, g)) return; sfx.coin(); S.marketSel = null; S.notice = `${g.name} 을(를) 들였다`; }
      S.detail = null; S.shownDetail = null; render();
    }, 900);
  };
  // 장면 캔버스 (패널 폭) + 말풍선 (검투사 위 왼쪽, 라니스타 위 오른쪽), 차례로 1.2초 간격
  const SW = 340, SH = 220; const c = document.createElement('canvas');
  c.width = SW * devicePixelRatio; c.height = SH * devicePixelRatio; c.style.width = '100%'; c.style.height = `${SH}px`; c.className = 'talkcanvas'; /* 그림은 논리 폭 340 기준으로 그리고 CSS 가 패널 폭에 맞춘다 */
  const e = { c, g, start: performance.now(), what }; talkScenes.add(e); drawTalkScene(e, 0);
  const bubbles = talkLines(g, what).map((l, i) => h('div', { class: `bubble ${l.who}`, style: `animation-delay:${0.25 + i * 1.2}s; top:${6 + i * 40}px` }, l.text)); // 순서대로 위에서 아래로 (대화 순서가 읽히게)
  return h('div', { class: 'detailpage confirm talk' },
    h('div', { class: 'talkscene' }, c, ...bubbles),
    h('div', { class: 'cbox row' }, h('div', { class: 'effects' }, money ? moneyRow(money) : null, ...lines.map(t => h('div', { class: 'effect' }, t))),
      h('div', { class: 'cbtns' }, why ? h('span', { class: 'hint', style: 'color:var(--red)' }, why) : null,
        h('button', { class: `sealbtn${disabled ? ' off' : ''}`, disabled, title: why || '도장을 찍어 확정합니다', onclick: doIt }, h('span', { class: 'latin' }, stampText), h('span', { class: 'ko' }, okLabel)))), // 도장 모양 버튼: 라틴어 도장 글자 + 아래 작은 한국어
    backBtn(closeConfirm, '상세로 돌아가기'));
}
export function detailPage(): Node {
  const d = S.detail!; const g = d.kind === 'roster' ? S.st.roster.find(x => x.id === d.id) : d.kind === 'applicant' ? S.st.applicants.find(x => x.id === d.id) : S.st.market.find(x => x.id === d.id);
  if (!g) { S.detail = null; return h('div'); }
  const again = S.shownDetail === `${d.kind}:${d.id}`; S.shownDetail = `${d.kind}:${d.id}`; // 같은 검투사가 이미 떠 있으면(확인 페이지를 열고 닫을 때의 재렌더) 슬라이드·걸어 들어오기를 반복하지 않는다
  const status = g.rank === 'tiro' ? '티로' : isPrimusPalus(g) ? '프리무스 팔루스' : '베테라누스'; /* 칩은 등급만 (2026-09-22 사용자: 자유민은 출신 칩과 겹쳤다). 독토르·자유민 신분은 초상의 막대·나무 검과 상태 절이 말한다 */
  /* 왼쪽 = 카드 그대로(어디서나 같은 116) + 카드에서 뺀 정보 한 묶음 (2026-09-22 사용자: 카드를 기준으로 상세 개편) */
  const info = h('div', { class: 'dinfo' },
    (() => { const [ty, , mn, sep, of] = gearLine(g.type); return h('div', { class: 'meta dmeta gearline two' }, h('div', { class: 'gl' }, ty), h('div', { class: 'gl' }, mn, sep, of)); })(), /* 두 줄: 유형 / 주장비 · 보조장비 (2026-09-22 사용자) */ /* 유형 아이콘 유형명 · 주장비 아이콘 장비명 · 보조장비 아이콘 장비명 — 왼손·오른손 말 없이 자리로 (2026-09-22 사용자) */
    h('div', { class: 'dbadges chips' }, /* 첫 줄 = 기본 정보: 등급 · 나이 · 출신 (2026-09-22 사용자) */
      h('span', { class: 'badge chip status', title: '등급 — 티로(첫 경기 전) · 베테라누스 · 프리무스 팔루스(승 8·명예 20)' }, status),
      h('span', { class: 'badge chip age', title: '나이대 — 청년(~23) · 장년(24~29) · 노년(30~)' }, AGE_BAND_KO[ageBand(g.age ?? 24)]) /* 나이 숫자는 카드 이름 옆으로 (2026-09-22 사용자) */,
      g.origin ? h('span', { class: `badge chip origin ${g.origin}`, title: `출신 — ${ORIGIN_DESC[g.origin]}` }, ORIGIN_KO[g.origin]) : null,
      g.status === 'rudiarius' && g.contractUntil != null ? h('span', { class: 'badge chip contract', title: `자유민 계약 — 급료는 출전마다 대여료의 ${Math.round(CONFIG.rudiariusShare * 100)}%. 끝나면 떠난다` }, `계약 ${Math.max(0, g.contractUntil - S.st.season + 1)}시즌`) : null, /* 상태 칸에서 옮겨 온 칩 (2026-09-22 사용자) */
      d.kind === 'roster' && g.origin === 'damnatus' && g.boughtSeason != null ? h('span', { class: 'badge chip term', title: '형벌 죄수 — 형기가 끝나면 자유민이 된다' }, `형기 ${Math.max(0, CONFIG.origins.damnatus.freeAfter - (S.st.season - g.boughtSeason + 1))}시즌`) : null,
      h('span', { class: `badge chip hand${g.scaeva ? ' scaeva' : ''}`, title: g.scaeva ? '왼손잡이(스카에바) — 비문에 따로 적힐 만큼 귀했다' : '오른손잡이' }, g.scaeva ? '왼손' : '오른손')), /* 손잡이는 기본 정보 줄에 둘 다 (2026-09-22 사용자: 길면 오른손·왼손으로만) */
    h('div', { class: 'dbadges chips rolled' }, /* 둘째 줄 = 굴려서 정해진 것: 이름 유래 · 성장형 · 자질 · 예명 */
      h('span', { class: `badge chip lin ${g.lineage}`, title: `이름 유래 — ${LINEAGE_DESC[g.lineage]}` }, LINEAGE_KO[g.lineage]),
      ...growthChips(g),
      ...epithetBadges(g)));
  const card = gladCard(g, { size: 132, hgt: 176, enemy: false, cls: 'big wide', bars: true, capNums: DEBUG, figure: 0.92, missio: true, age: true });
  card.append(h('span', { class: 'fanstag', title: `팬 ${fansOf(g)} — 명예 + 승수×2 + 예명. ${FANS_STAR} 이상이면 ★ 인기 검투사` }, `팬 ${fansOf(g)}${fansOf(g) >= FANS_STAR ? '★' : ''}`)); /* 팬 수는 카드 밖 오른쪽 위 (2026-09-22 사용자) */ /* 캔버스 높이 176 — 에퀘스·호플로마쿠스의 창끝이 위로 잘리지 않게. 배율은 캔버스 높이에 비례해 커지므로 0.92 로 눌러 132 캔버스 × 1.22 와 같은 크기 (사용자: 너무 커졌다) */ /* 초상 132 를 104 칸에 — 위·왼쪽으로 카드 밖까지 넘친다. 흙은 104 크기 그대로, 검투사만 1.22 배 (2026-09-22 사용자) */ /* 상세는 넓으니 큰 카드: 오른쪽 끝까지 쓰고, 능력치 기둥은 숫자 대신 상한까지의 막대 (2026-09-22 사용자) */
  if (!again) for (const e of portraits) if (card.contains(e.c)) e.enter = performance.now(); /* 큰 초상: 왼쪽에서 발소리를 내며 걸어 들어온다 */
  const left = h('div', { class: 'dleft dtop' }, card); /* T 배치: 위는 카드만(가로 전체), 아래 왼쪽 = 칩+딕타타, 아래 오른쪽 = 행동 (2026-09-22 사용자) */
  S.gladSel = g.id; S.marketSel = d.kind === 'market' ? g.id : S.marketSel;
  const { mid, side } = detailRight(g, d.kind);
  const page = h('div', { class: `detailpage${again || S.detailSwipe ? ' still' : ''}` }, left, h('div', { class: 'dright' }, info, mid), h('div', { class: 'dright side' }, side),
    backBtn(closeDetail, d.kind === 'market' ? '판매대로 돌아가기' : d.kind === 'applicant' ? '문루로 돌아가기' : '켈라로 돌아가기'));
  if (S.detailSwipe) { const from = S.detailSwipe > 0 ? 105 : -105; S.detailSwipe = null; requestAnimationFrame(() => page.animate([{ transform: `translateX(${from}%) rotate(${from > 0 ? 1.6 : -1.6}deg)` }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.16,.84,.3,1)' })); } /* 민 방향에서 밀려 들어온다. style.css 는 Codex 담당이라 애니메이션을 여기서 직접 준다 */
  return swipeArea(page);
}
// 상세 페이지 오른쪽: 왼쪽(초상·이름·유형·신분·별칭)과 겹치지 않게 능력치 → 전적 → 상태 → 기술 → 시즌 행동 → 행동 → 방 순서. 시장 노예는 능력치·전적·기술·출신·가격
const SEC_ICON: Record<string, string> = {
  stats: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/>',
  record: '<circle cx="12" cy="8" r="6"/><path d="M15.5 12.9 17 22l-5-3-5 3 1.5-9.1"/>',
  status: '<path d="M12 4v16M4 12h16"/>',
  plan: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  growth: '<path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/>',
  skills: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/>',
  act: '<path d="M18 11V6a2 2 0 0 0-4 0v1a2 2 0 0 0-4 0v2a2 2 0 0 0-4 0v6a6 6 0 0 0 12 0v-1"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/>',
  room: '<path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-8h6v8"/>',
  origin: '<path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><circle cx="12" cy="12" r="10"/>',
};
function dsec(kind: string, title: string, ...kids: (Node | string | null)[]): Node {
  const ic = h('span', { class: 'dico' }); ic.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SEC_ICON[kind.split(' ')[0]]}</svg>`;
  return h('div', { class: `dbox ${kind}` }, h('div', { class: 'dhead' }, ic, h('span', {}, title)), h('div', { class: 'dbody' }, ...kids.filter((n): n is Node | string => !!n)));
}
function detailRight(g: Gladiator, kind: DetailKind): { mid: Node; side: Node } {
  /* 딕타타 칸: 전부 칩으로 (2026-09-22 사용자). 처음부터 아는 기본 셋(주장비·보조장비·유형)과 전설 고유는 진한 칩, 숙련 후보 열둘은 익힌 것만 칠하고 나머지는 점선. 자리가 차면 문턱을 넘은 새것이 가장 오래된 것과 바뀐다 */
  const have = new Set(g.dictata ?? []); const career = g.career ?? {};
  const chip = (cls: string, name: string, title: string) => h('span', { class: `badge chip dict ${cls}`, title }, name);
  const basics = basicDictataOf(g.type).map(d => chip('basic', d.name, `${d.name} — 처음부터 안다. ${d.desc}`));
  const legends = masteryOf(g).filter(m => m.layer === 'legend').map(m => chip('lgd', m.name, /* 'legend' 클래스는 범례(.legend) 규칙에 걸려 딕타타 줄이 깨졌다 (2026-09-22 사용자) */ `${m.name} — 전설의 고유 딕타타. ${m.ko}${g.legend ? ` · 전설 ${legendGen(g.legend, S.st.graveyard, S.st.hall?.map(x => x.name) ?? [])}대: ${LEGEND_BY_ID[g.legend]?.lore ?? ''}` : ''}`));
  const seen = new Set<string>(); const cands = masteryCandidates(g.type).filter(m => { const dup = seen.has(m.name); seen.add(m.name); return !dup; }).map(m0 => { const same = masteryCandidates(g.type).filter(x => x.name === m0.name); const m = same.find(x => have.has(x.id)) ?? same.find(x => (g.dictataPast ?? []).includes(x.id)) ?? m0; /* 같은 이름이 두 층에 걸리면(클래스·유형의 '재돌격'·'뛰어넘기') 칩은 하나 — 익히는 것도 이름당 하나다 */
    const on = have.has(m.id), past = (g.dictataPast ?? []).includes(m.id), now = career[m.cond.key] ?? 0;
    return chip(on ? 'on' : past ? 'past' : 'off', m.name, `${m.name} — ${m.ko} (${m.cond.ko}${on ? '' : `, 지금 ${now}`})${past ? ' · 자리에서 밀려나 다시 익히지 않는다' : ''}`); });
  const dictRows = h('div', { class: 'dbadges chips dictchips' }, ...basics, ...legends, ...cands);
  /* 상태 칸은 뺐다 (2026-09-22 사용자): 부상·독토르·출전 완료는 카드 표식·명부가 말하고, 자유민 계약·형기는 기본 정보 칩으로 옮겼다 */
  // 가운데 열: 전적 → 능력치 → 기술 → 상태 → 시즌 행동 (시장: 출신)
  const mid: (Node | null)[] = [
    /* 피로 칸은 뺐다 (2026-09-22 사용자) — 카드의 피로 알과 막대의 −표시가 말한다 */
    h('div', { class: 'dictsec' }, h('span', { class: 'dlabel', title: `숙련 ${masterySlotsUsed(g)}/${CONFIG.mastery.slots} — 자리가 차면 문턱을 넘은 새것이 가장 오래된 것과 바뀐다` }, '딕타타'), dictRows), /* 상자 없이 '딕타타' 이름표만 (2026-09-22 사용자). 숙련 수/자리는 툴팁 */ /* 성장 칸은 뺐다 — 상한은 카드 막대의 ▲, 상인 말은 출신 칸으로 (2026-09-22 사용자) */
  ];
  const side: (Node | null)[] = [];
  if (kind === 'applicant') { /* 문 앞 자유민 지원자 (2026-09-22 사용자): 시장처럼 상세에서 계약, 스와이프로 다음 지원자 */
    const price = g.buyPrice; const full = S.st.roster.length >= rosterCap(S.st); const O = CONFIG.origins.auctoratus;
    side.push(dsec('act', '자유민 계약', h('div', { class: 'statrow col' }, h('button', { class: 'primary', disabled: S.st.money < price || full, title: full ? '켈라가 가득 찼습니다' : `계약금 ${price.toLocaleString()} HS · ${O.term}시즌 · 출전마다 대여료의 ${Math.round(CONFIG.rudiariusShare * 100)}% 급료. 팔 수 없고 사망 배상도 없다`, onclick: () => openConfirm(g, 'buy') }, `계약 ${price.toLocaleString()} HS`), h('span', { class: 'hint' }, `${O.term}시즌 · 급료 대여료의 ${Math.round(CONFIG.rudiariusShare * 100)}%`), S.st.money < price ? h('span', { class: 'hint', style: 'color:var(--red)' }, `자금 ${(price - S.st.money).toLocaleString()} HS 부족`) : full ? h('span', { class: 'hint' }, `켈라 ${S.st.roster.length}/${rosterCap(S.st)} 가득 참`) : null)));
  } else if (kind === 'market') {
    const price = priceOf(S.st, g); const full = S.st.roster.length >= rosterCap(S.st);
    /* 출신 칸은 뺐다 (2026-09-22 사용자) — 출신은 카드 아래 칩과 그 툴팁이 말한다. 상인의 말도 함께 뺐다 */
    side.push(dsec('act', '계약', h('div', { class: 'statrow col' }, h('button', { class: 'primary', disabled: S.st.money < price || full, title: full ? '켈라가 가득 찼습니다' : '', onclick: () => openConfirm(g, 'buy') }, `구매 ${price.toLocaleString()} HS${price < g.buyPrice ? ' (할인)' : ''}`), S.st.money < price ? h('span', { class: 'hint', style: 'color:var(--red)' }, `자금 ${(price - S.st.money).toLocaleString()} HS 부족`) : full ? h('span', { class: 'hint' }, `켈라 ${S.st.roster.length}/${rosterCap(S.st)} 가득 참`) : null)));
  } else {
    const k = cellOf(S.st, g); const q = S.st.ludus.cells[k] ?? 0, cost = k >= 0 ? upgradeCost(S.st, 'cell', k) : null;
    // (시즌 행동 칸은 뺐다 — 훈련은 팔루스 배치, 나머지는 자동. 치료는 아래 '행동'에)
    // 오른쪽 열: 켈라 → 행동 (치료·매각·재계약·내보내기)
    const CELL_FX = ['효과 없음', '피로 회복 −2', '피로 덜 쌓임(단계마다 −15%)', '명예 +1/시즌']; // 숙소 질 0~3 효과 (단계마다 유지비 +100)
    side.push(dsec('room', '숙소', h('div', { class: 'statrow col' }, h('span', { class: `badge chip bedding q${q}` }, CELL_Q_KO[q]),
      h('div', { class: 'line' }, h('span', { class: 'k' }, '지금 '), `${CELL_Q_KO[q]} — ${CELL_FX[q]}`), q < CELL_FX.length - 1 ? h('div', { class: 'line' }, h('span', { class: 'k' }, '손보면 '), `${CELL_Q_KO[q + 1]} — ${CELL_FX[q + 1]}`) : null, cost != null ? h('button', { disabled: !canPayFac(cost), title: '맨바닥 → 짚자리 → 삿자리 → 양털 요', onclick: () => { if (upgrade(S.st, 'cell', k)) { sfx.coin(); render(); } } }, `방 손보기 ${cost.toLocaleString()}`) : h('span', { class: 'hint' }, '더 손볼 데 없음'))));
    const acts = gladActions(g).filter((n): n is Node => !!n); if (acts.length) side.push(dsec('act', '행동', h('div', { class: 'statrow col' }, ...acts)));
  }
  return { mid: h('div', { class: 'dmid' }, ...mid.filter((n): n is Node => !!n)), side: h('div', { class: 'dside' }, ...side.filter((n): n is Node => !!n)) };
}
export function gladSheet(): Node {
  const g = S.st.roster.find(x => x.id === S.gladSel); if (!g) return h('div', { class: 'panel' }, h('h2', {}, '검투사'), h('div', { class: 'hint' }, '루두스를 떠났습니다.'));
  const k = cellOf(S.st, g); const q = S.st.ludus.cells[k] ?? 0, cost = k >= 0 ? upgradeCost(S.st, 'cell', k) : null;
  return h('div', { class: 'panel' },
    h('h2', {}, '숙소', h('span', { class: `badge chip bedding q${q}`, style: 'margin-left:8px' }, CELL_Q_KO[q]), helpBtn('켈라와 검투사', '검투사가 자는 작은 방입니다. 방 장식이 상태입니다: 벽의 획수 = 승수(5승 묶음), 종려가지 = 5승마다, 월계관 = 명예 20 이상(40 이상 금빛), 하트 낙서 = 팬 스타, 목검 = 배운 기술 수, 오른쪽 벽 걸이 = 그 유형의 투구·방패·무기, 벽의 나무 검 = 자유민(루디스), 지팡이 = 독토르, 붕대·목발 = 부상. 피로는 자세로: 1 축 처져 앉음, 2 꾸벅임(z z), 3 벽에 기대 잠. 왼쪽 아래 ★ = 켈라 등급.\n\n숙소 질 ★1 피로 회복 −2 · ★2 유지비 −25% · ★3 명예 +1/시즌. 여기서 치료·매각·재훈련·재계약을 하고, 방을 강화하거나 다른 방으로 옮깁니다.')),
    gladRow(g, gladActions(g), { dis: !!g.injured }),
    h('div', { class: 'frow', style: 'margin-top:8px' }, h('div', { class: 'grow' }, h('b', {}, '이 방 강화'), h('div', { class: 'meta' }, '짚자리 피로 회복 −2 · 삿자리 피로 덜 쌓임 · 양털 요 명예 +1/시즌 (단계마다 유지비 +100)')), cost != null ? h('button', { disabled: !canPayFac(cost), onclick: () => { if (upgrade(S.st, 'cell', k)) { sfx.coin(); render(); } } }, `방 손보기 ${cost.toLocaleString()}`) : h('span', { class: 'hint' }, '더 손볼 데 없음')),
    h('div', { class: 'two' }, // 왼쪽 시즌 행동 · 오른쪽 방 옮기기
      h('div', {}, h('h3', { class: 'sub' }, '시즌 행동', g.status === 'doctor' ? h('span', { class: 'hint', style: 'margin-left:6px' }, '독토르') : assignedTo(g.id) != null ? h('span', { class: 'hint', style: 'margin-left:6px' }, '출전 예정') : null),
        g.status !== 'doctor' ? h('div', { class: 'segcol' }, ...actionSeg(g)) : h('div', { class: 'hint' }, '가르치는 중')),
      )); // 방 옮기기는 켈라에서 스틱맨을 끌어서
}
// 시즌 행동 선택. 훈련은 훈련소의 팔루스에 세워서 한다 — 팔루스에 선 검투사는 여기서 공/방/기술 중 무엇을 단련할지 고르고 내려올 수도 있다. 나머지는 휴식·시범, 부상자는 요양·치료. 시즌이 끝날 때 실행
function actionSeg(g: Gladiator): (Node | null)[] {
  const at = assignedTo(g.id), slot = palusOf(S.st, g);
  if (g.status === 'doctor') return [];
  if (g.injured) return [h('span', { class: 'seg' }, h('span', { class: 'hint' }, inBed(S.st, g) ? `침상 요양 (부상 ${g.injured}→${Math.max(0, g.injured - 1 - CONFIG.actions.recover.extra)}시즌 · 치료비 ${bedCostOf(S.st)})` : `침상 밖 — 시즌마다 ${Math.round(CONFIG.injury.natural.heal * 100)}% 낫고 ${Math.round(CONFIG.injury.natural.worsen * 100)}% 덧난다. 부상 ${CONFIG.injury.deathAt}이면 죽는다`))]; // 즉시 치료는 없다 (2026-09-21): 의무실 그림에서 침상에 눕힌다
  if (slot >= 0) { // 팔루스에 서 있다: 무엇을 단련할지는 시즌 끝에 무작위 (공·방, 조건이 되면 기술)
    const fatigueTip = at != null ? ` · 출전 뒤 훈련: 피로가 쌓일 확률 ${Math.round(Math.max(0, CONFIG.fatigue.trainAfterFight - cellQuality(S.st, g) * CONFIG.fatigue.perCellStar) * 100)}%` : '';
    return [h('span', { class: 'seg' },
      h('span', { class: 'hint', title: `시즌 끝에 네 능력치가 클래스 풀 비율로 같이 오른다 (${(['atk', 'def', 'hp', 'hand'] as const).map(k => `${KO4[k]} ${Math.round(trainShares(g)[k] * 100)}%`).join(' · ')})${fatigueTip}` }, `팔루스 ${slot + 1} — 네 능력치가 같이`),
      h('button', { title: `팔루스 ${slot + 1}에서 내려온다 (이번 시즌 훈련 없음)`, onclick: (ev: Event) => { ev.stopPropagation(); leavePalus(S.st, g); save(); render(); } }, '내려오기'))];
  }
  const f = g.fatigue ?? 0; return [h('span', { class: 'hint' }, at != null ? '출전만' : f > 0 ? `휴식 (피로 ${f} → −${cellQuality(S.st, g) >= 1 ? 2 : 1}${S.st.ludus.medicine >= CONFIG.ludus.medicine.fatigueRestAt ? '−1' : ''})` : `시범 (명예 +${CONFIG.actions.show.honor}) — 훈련은 훈련소의 팔루스에 세워서`)]; // 고르지 않는다: 팔루스에 안 섰으면 피로가 있으면 쉬고, 없으면 시범
}
