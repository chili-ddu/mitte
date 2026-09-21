// 검투사 상세·확정(구매/매각/치료) 페이지와 카드 조각
import { S, myInk, myLight } from './state.js';
import { type Contract, type Gladiator } from '../core/types.js';
import { CONFIG } from '../core/config.js';
import { buy, canBuy, cellOf, cellQuality, bedCostOf, inBed, leavePalus, moveToCell, occupantOf, palusOf, priceOf, recordVsMe, release, renewContract, renewCost, rivalOf, rivalStar, rosterCap, sell, trainGain, upgrade, upgradeCost } from '../core/game.js';
import { equipHandsKo } from '../core/equipment.js';
import { FANS_STAR, HOST } from '../core/hosts.js';
import { sfx } from './sound.js';
import { EPITHET_BY_ID, accessoriesOf, type EpithetId } from '../core/epithets.js';
import { LINEAGE_KO, TYPE_KO, fansOf, sellPrice, isPrimusPalus } from '../core/gladiator.js';
import { INK, NPC_POSES, drawStickman, type Skeleton, walkSkeleton } from './stickman.js';
import { backBtn, h, helpBtn, sq } from './dom.js';
import { render, save } from './main.js';
import { TYPE_COLOR, glyphSvg, portrait, portraits, talkScenes } from './portrait.js';
import { lerp } from './battle-view.js';
import { assignedTo, planOf } from './plan.js';
import { canPayFac } from './sheets.js';
import { gladCard, CARD_PORTRAIT, emptySlots } from './gcard.js';
import { masteryOf, masteryCandidates } from '../core/dictata.js';
import { atCap, fullyGrown, growthKo, merchantLine, ageBand, AGE_BAND_KO, progOf } from '../core/growth.js'; /* 검투사 카드는 한 종류 (2026-09-17) */

export const ORIGIN_SHORT: Record<string, string> = { captive: '포로', damnatus: '죄수', auctoratus: '자유민 계약' };
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
  c.enemy.forEach((e, i) => { parts.push(i ? ', ' : '', sq(e.type), ' ', `${e.name.replace('(적)', '')} (${e.rank === 'tiro' ? '티로' : '베테'} ${e.wins}승/${e.fights}전${(e.honor ?? 0) >= 30 ? ` · 명예 ${e.honor}` : ''})`); if (star && star.id === e.id && ((star.honor ?? 0) >= 20 || star.wins >= 5)) parts.push(' ', h('span', { class: 'badge star', title: '이 파밀리아의 간판 검투사' }, '간판'));
    const spBy = S.st.roster.filter(g => (g.spared ?? []).includes(e.id)), beat = S.st.roster.filter(g => (g.beatenBy ?? []).includes(e.id));
    if (spBy.length) parts.push(' ', h('span', { class: 'badge grudge', title: `${spBy.map(g => g.name).join(', ')} 이(가) 살려 준 자. 재대결이면 공격 +10%, 그에게 지면 미시오 −15% (우르비쿠스의 경고)` }, `원한 ← ${spBy.map(g => g.name).join(', ')}`));
    if (beat.length) parts.push(' ', h('span', { class: 'badge revenge', title: `${beat.map(g => g.name).join(', ')} 을(를) 쓰러뜨린 자. 꺾으면 복수 (명예 +8, '복수자')` }, `복수 기회 → ${beat.map(g => g.name).join(', ')}`)); });
  return h('div', { class: 'meta enemyline' }, ...parts);
}
export const hostPrize = (c: Contract) => Math.round(CONFIG.prizePerTier * c.tier * HOST[c.host].prize);
export const hostSpan = (c: Contract) => { const H = HOST[c.host]; return h('span', { class: `host ${c.host}`, title: `${H.ko}: ${H.desc}\n상금 ×${H.prize} · 대여료 ×${H.rent} · 미시오 ${H.missio >= 0 ? '+' : ''}${Math.round(H.missio * 100)}% · 루디스 ${H.rudis >= 0 ? '+' : ''}${Math.round(H.rudis * 100)}%${H.fameWin ? ` · 승리 호감도 +${H.fameWin}` : ''}${H.honorAll ? ` · 출전자 명예 +${H.honorAll}` : ''}${H.bet ? ' · 내기 가능' : ''}` }, H.ko); };
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
const detailOrder = (kind: 'roster' | 'market'): Gladiator[] => kind === 'market' ? S.st.market : Array.from({ length: S.st.ludus.cells.length }, (_, k) => occupantOf(S.st, k)).filter((g): g is Gladiator => !!g);
function swipeDetail(dir: 1 | -1) { const d = S.detail; if (!d || d.confirm) return; const list = detailOrder(d.kind); if (list.length < 2) return; const i = list.findIndex(g => g.id === d.id); if (i < 0) return; d.id = list[(i + dir + list.length) % list.length].id; S.detailSwipe = dir; sfx.step(); render(); }
function swipeArea(el: HTMLElement): HTMLElement { // 가로로 60px 넘게 끌면 이웃으로. 세로로 더 움직였으면 스크롤, 버튼에서 시작했으면 그 버튼의 몫
  let p: { x: number; y: number; t: number; id: number; live: boolean } | null = null;
  const settle = (ms = 180) => { el.style.transition = `transform ${ms}ms cubic-bezier(.16,.84,.3,1), opacity ${ms}ms`; window.setTimeout(() => { el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; el.style.willChange = ''; }, ms + 30); };
  el.addEventListener('pointerdown', (ev: PointerEvent) => { p = (ev.target as Element).closest?.('button, input, .dd') ? null : { x: ev.clientX, y: ev.clientY, t: performance.now(), id: ev.pointerId, live: false }; if (p) el.style.willChange = 'transform, opacity'; });
  el.addEventListener('pointermove', (ev: PointerEvent) => { const q = p; if (!q) return; const dx = ev.clientX - q.x, dy = ev.clientY - q.y; if (!q.live) { if (Math.abs(dy) > 16 && Math.abs(dy) > Math.abs(dx)) { p = null; el.style.willChange = ''; return; } if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.25) return; q.live = true; el.setPointerCapture(q.id); } ev.preventDefault(); const pull = Math.sign(dx) * Math.min(70, Math.pow(Math.abs(dx), 0.84)); el.style.transition = ''; el.style.transform = `translateX(${pull}px) rotate(${pull * 0.011}deg)`; el.style.opacity = String(Math.max(0.8, 1 - Math.abs(pull) / 520)); });
  el.addEventListener('pointercancel', () => { p = null; settle(160); });
  el.addEventListener('pointerup', (ev: PointerEvent) => { const q = p; p = null; if (!q) return; const dx = ev.clientX - q.x, dy = ev.clientY - q.y, dt = performance.now() - q.t; if (!q.live || dt > 900 || Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.35) { settle(170); return; } const dir: 1 | -1 = dx < 0 ? 1 : -1; el.style.transition = 'transform 170ms cubic-bezier(.5,0,.8,.4), opacity 170ms'; el.style.transform = `translateX(${dir > 0 ? -105 : 105}%) rotate(${dir > 0 ? -1.8 : 1.8}deg)`; el.style.opacity = '0.72'; window.setTimeout(() => swipeDetail(dir), 135); });
  return el;
}
export function openConfirm(g: Gladiator, what: 'sell' | 'release' | 'buy' | 'heal') { if (!S.detail) S.detail = { kind: what === 'buy' ? 'market' : 'roster', id: g.id, solo: true }; S.detail.confirm = what; render(); }
function closeConfirm() { const el = document.querySelector('.detailpage.confirm'); const done = () => { if (S.detail?.solo) S.detail = null; else if (S.detail) delete S.detail.confirm; render(); }; if (!el || !S.detail) { done(); return; } el.classList.add('closing'); window.setTimeout(done, 280); }
export function drawTalkScene(e: { c: HTMLCanvasElement; g: Gladiator; start: number; what: 'sell' | 'release' | 'buy' | 'heal'; healed?: number }, t: number) {
  const ctx = e.c.getContext('2d')!; const W = e.c.width / devicePixelRatio, H = e.c.height / devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#e3d3a6'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#cbb67f'; ctx.fillRect(0, H - 10, W, 10);
  const el = (performance.now() - e.start) / 1000; const sc = Math.min(1.08, Math.max(0.92, W / 340)), gy = H - 10; /* 확인 대화 장면용 인물 크기: 모바일 패널 안에서 라니스타와 검투사가 잘리지 않게 */
  // 검투사: 왼쪽에서 걸어 들어와 라니스타 앞에 선다 (구매는 사슬 풀린 노예가 상인 쪽에서 오듯 조금 늦게)
  const ENTER = 0.9; const gx1 = W * 0.36; const k = Math.min(1, el / ENTER), ease = 1 - Math.pow(1 - k, 2); const gx = -40 + (gx1 + 40) * ease;
  if (e.what === 'heal') { // 치료 장면: 침상에 걸터앉은 부상자(왼쪽) + 붕대 뭉치를 든 의사(오른쪽에서 걸어와 살핀다). 도장이 찍히면 일어선다
    const bx = gx1 - 30 * sc, by = gy; ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx, by - 22 * sc); ctx.lineTo(bx + 70 * sc, by - 22 * sc); ctx.moveTo(bx + 3, by - 22 * sc); ctx.lineTo(bx + 3, by); ctx.moveTo(bx + 70 * sc - 3, by - 22 * sc); ctx.lineTo(bx + 70 * sc - 3, by); ctx.stroke(); ctx.fillStyle = '#e8d9b5'; ctx.fillRect(bx + 2, by - 27 * sc, 70 * sc - 4, 5 * sc); // 침상
    const up = e.healed ? Math.max(0, Math.min(1, (performance.now() - e.healed) / 600)) : 0; const team = e.g.rank === 'veteranus' ? myInk() : myLight(); const w = Math.sin(t * 2);
    const sit: Skeleton = { ...NPC_POSES.stand, lean: 8, frontArm: [40, 60], backArm: [30, 50], frontLeg: [40, -70], backLeg: [-10, -70], headBob: 6 + w * 0.5, sink: 18 }; // 침상에 걸터앉음
    const stand: Skeleton = { ...NPC_POSES.stand, lean: -2, frontArm: [20 + w * 3, 15], headBob: 0 };
    const lerp = (a: number, b: number, u: number) => a + (b - a) * u; const pair = (a: readonly [number, number], b: readonly [number, number], u: number): [number, number] => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
    const mix = (a: Skeleton, b: Skeleton, u: number): Skeleton => ({ lean: lerp(a.lean, b.lean, u), frontArm: pair(a.frontArm, b.frontArm, u), backArm: pair(a.backArm, b.backArm, u), frontLeg: pair(a.frontLeg, b.frontLeg, u), backLeg: pair(a.backLeg, b.backLeg, u), headBob: lerp(a.headBob, b.headBob, u), sink: lerp(a.sink ?? 0, b.sink ?? 0, u) });
    drawStickman(ctx, e.g.type, { x: gx1 + 6 * sc, y: gy, scale: sc, skeleton: mix(sit, stand, up), t, team, accessories: accessoriesOf(e.g), facing: 1 });
    { const ax = gx1 + 12 * sc, ay = gy - 34 * sc - 18 * sc * (1 - up); ctx.strokeStyle = '#f3ead0'; ctx.lineWidth = 3.5 * (1 - up * 0.8) + 0.1; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(ax - 2 * sc, ay - 2); ctx.lineTo(ax + 3 * sc, ay + 3); ctx.moveTo(ax - 2 * sc, ay + 3); ctx.lineTo(ax + 3 * sc, ay + 8); ctx.stroke(); } // 팔의 붕대 (일어서며 옅어진다)
    const mk = Math.min(1, el / 1.0), mease = 1 - Math.pow(1 - mk, 2); const mx = W + 40 - (W + 40 - W * 0.64) * mease; // 의사: 오른쪽에서 걸어온다
    const tending = mk >= 1 && ((el > 1.2 && el < 2.4) || (el > 3.6 && el < 4.8)); const msk: Skeleton = mk < 1 ? { ...walkSkeleton(el * 9, 0.8), frontArm: [55, 50] } : tending ? { ...NPC_POSES.tend, lean: 14 + w * 2, frontArm: [72 + w * 6, 34], backArm: [50, 45], headBob: 5 } : { ...NPC_POSES.tablet, lean: 3, headBob: w * 0.6 };
    drawStickman(ctx, 'murmillo', { x: mx, y: gy, scale: sc, facing: -1, skeleton: msk, t, ink: INK, bare: true, garment: 'tunic', garmentColor: '#c8a878', garmentStripe: '#7a1f16', hands: (c, f) => { c.fillStyle = '#f3ead0'; c.beginPath(); c.arc(f.hx - 3, f.hy - 4, 5, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#c9b283'; c.lineWidth = 1; c.stroke(); } }); // 붕대 뭉치
    return; }
  const team = e.g.rank === 'veteranus' ? myInk() : myLight(); const w = Math.sin(t * 2);
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
export function moneyRow(m: { amount: number; verb: string; note?: string }): Node {
  const ic = h('span', { class: 'coin' }); ic.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>';
  return h('div', { class: `moneyrow ${m.verb === '지불' ? 'pay' : 'gain'}` }, ic, h('b', {}, `${m.amount.toLocaleString()} HS`), h('span', { class: 'verb' }, m.verb), m.note ? h('span', { class: 'note' }, m.note) : null);
}
export function confirmPage(): Node {
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
    const cost = bedCostOf(S.st); okLabel = '치료'; money = { amount: cost, verb: '지불' }; disabled = true; why = '즉시 치료는 없다';
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
    if (page) page.append(h('div', { class: 'stamp confirmstamp' }, h('span', {}, stampText))); sfx.down(); window.setTimeout(() => sfx.drum(1), 40);
    if (what === 'heal') for (const sc of talkScenes) if (sc.g === g) sc.healed = performance.now() + 250; // 도장 뒤 일어선다
    window.setTimeout(() => {
      if (what === 'heal') { return; }
      else if (what === 'sell') { sell(S.st, g); sfx.coin(); S.notice = `${g.name} 매각`; }
      else if (what === 'release') { release(S.st, g); S.notice = `${g.name} 이(가) 루두스를 떠났다`; }
      else { if (!buy(S.st, g)) return; sfx.coin(); S.marketSel = null; S.notice = `${g.name} 을(를) 들였다`; }
      S.detail = null; S.shownDetail = null; render();
    }, what === 'heal' ? 1400 : 900);
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
  const d = S.detail!; const g = d.kind === 'roster' ? S.st.roster.find(x => x.id === d.id) : S.st.market.find(x => x.id === d.id);
  if (!g) { S.detail = null; return h('div'); }
  const again = S.shownDetail === `${d.kind}:${d.id}`; S.shownDetail = `${d.kind}:${d.id}`; // 같은 검투사가 이미 떠 있으면(확인 페이지를 열고 닫을 때의 재렌더) 슬라이드·걸어 들어오기를 반복하지 않는다
  const figure = portrait(g, 116, false, undefined, 170, true); figure.classList.add('big'); /* 초상 크기는 여기(인라인)가 정한다 — 폭 116(오른쪽에 기술 칩 3개가 든다), 높이 170(인물은 높이 기준으로 크게) */ if (!again) for (const e of portraits) if (e.c === figure) { e.enter = performance.now(); } // 큰 초상: 왼쪽에서 발소리를 내며 걸어 들어온다
  const status = d.kind === 'market' ? (g.rank === 'tiro' ? '티로' : '베테라누스') : g.status === 'doctor' ? '독토르' : g.status === 'rudiarius' ? '자유민' : g.rank === 'tiro' ? '티로' : isPrimusPalus(g) ? '프리무스 팔루스' : '베테라누스';
  const dskills = h('div', { class: 'gskills dskills' }, ...masteryOf(g).map(m => h('span', { class: 'badge skill', title: `${m.name}: ${m.ko} (${m.cond.ko})` }, m.name)), ...emptySlots(Math.max(0, 3 - masteryOf(g).length))); /* 익힌 숙련 딕타타 (docs/09 2-α) */
  const left = h('div', { class: 'dleft' }, figure, h('div', { class: 'dinfo' }, h('div', { class: 'dname' }, sq(g.type), ' ', h('b', {}, g.name), h('span', { class: 'age' }, `${g.age ?? '?'}세`)), h('div', { class: 'meta dmeta' }, h('div', {}, equipHandsKo(g.type, g.scaeva)), `${TYPE_KO[g.type]} · ${status}${g.lineage ? ` · 계보 ${LINEAGE_KO[g.lineage]}` : ''}`), dskills, h('div', { class: 'dbadges' }, ...epithetBadges(g)))); /* 초상은 왼쪽에 붙이고, 오른쪽에 이름·나이 → 유형·신분·계보 → 기술 칩 한 줄 → 그 아래 특징(별칭) 칩 */
  S.gladSel = g.id; S.marketSel = d.kind === 'market' ? g.id : S.marketSel;
  const { mid, side } = detailRight(g, d.kind);
  const page = h('div', { class: `detailpage${again || S.detailSwipe ? ' still' : ''}` }, left, h('div', { class: 'dright' }, mid), h('div', { class: 'dright side' }, side),
    backBtn(closeDetail, d.kind === 'market' ? '판매대로 돌아가기' : '켈라로 돌아가기'));
  if (S.detailSwipe) { const from = S.detailSwipe > 0 ? 105 : -105; S.detailSwipe = null; requestAnimationFrame(() => page.animate([{ transform: `translateX(${from}%) rotate(${from > 0 ? 1.6 : -1.6}deg)`, opacity: 0.74 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.16,.84,.3,1)' })); } /* 민 방향에서 밀려 들어온다. style.css 는 Codex 담당이라 애니메이션을 여기서 직접 준다 */
  return swipeArea(page);
}
// 상세 페이지 오른쪽: 왼쪽(초상·이름·유형·신분·별칭)과 겹치지 않게 능력치 → 전적 → 상태 → 기술 → 시즌 행동 → 행동 → 방 순서. 시장 노예는 능력치·전적·기술·출신·가격
const SEC_ICON: Record<string, string> = {
  stats: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/>',
  record: '<circle cx="12" cy="8" r="6"/><path d="M15.5 12.9 17 22l-5-3-5 3 1.5-9.1"/>',
  status: '<path d="M12 4v16M4 12h16"/>',
  plan: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  growth: '<path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/>',
  act: '<path d="M18 11V6a2 2 0 0 0-4 0v1a2 2 0 0 0-4 0v2a2 2 0 0 0-4 0v6a6 6 0 0 0 12 0v-1"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/>',
  room: '<path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-8h6v8"/>',
  origin: '<path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><circle cx="12" cy="12" r="10"/>',
};
function dsec(kind: string, title: string, ...kids: (Node | string | null)[]): Node {
  const ic = h('span', { class: 'dico' }); ic.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SEC_ICON[kind.split(' ')[0]]}</svg>`;
  return h('div', { class: `dbox ${kind}` }, h('div', { class: 'dhead' }, ic, h('span', {}, title)), h('div', { class: 'dbody' }, ...kids.filter((n): n is Node | string => !!n)));
}
const tile = (k: string, v: string, cls = '', title?: string) => h('div', { class: `tile ${cls}`, title }, h('span', { class: 'k' }, k), h('b', {}, v));
const capCls = (g: Gladiator, k: 'hp' | 'atk' | 'def' | 'hand') => atCap(g, k) ? 'capped' : '';
function detailRight(g: Gladiator, kind: 'roster' | 'market'): { mid: Node; side: Node } {
  const fat = g.fatigue ?? 0; const b = g.base;
  const statsRow = h('div', { class: 'tiles' }, ...([['HP', b.hp, '체력', capCls(g, 'hp'), g.cap?.hp], ['ATK', b.atk, '공격', capCls(g, 'atk'), g.cap?.atk], ['DEF', b.def, '방어', capCls(g, 'def'), g.cap?.def], ['손놀림', b.hand, '손놀림: 공격 간격·연속·치명타 — 훈련으로 자란다', capCls(g, 'hand'), g.cap?.hand], ['걸음', b.spd, '걸음: 이동·행동 순서·그물 회피 — 유형이 정한다', '', undefined]] as const).map(([k, v, t, c, cap]) => { const key = (k === 'HP' ? 'hp' : k === 'ATK' ? 'atk' : k === 'DEF' ? 'def' : k === '손놀림' ? 'hand' : null) as 'hp' | 'atk' | 'def' | 'hand' | null; const p = key ? progOf(g, key) : 0; return tile(k, cap != null ? `${v}/${cap}` : String(v), c, c ? `${t} — 상한에 닿아 더 자라지 않는다` : cap != null ? `${t} · 상한 ${cap}${p > 0 ? ` · 다음 한 점까지 ${Math.max(1, Math.round((1 - p) / 0.2))}번쯤` : ''}` : t); }), /* 소수점은 안 보인다 — 툴팁에 '다음 한 점까지 몇 번' 만 (2026-09-21 사용자) */ /* 상한 공개 (2026-09-21 사용자) */
    fat ? tile('피로', String(fat), `fat${fat >= 3 ? ' bad' : ''}`, `첫 ${CONFIG.fatigue.free}점은 괜찮고, 그 위로 1점마다 공·방 −${CONFIG.fatigue.statPenalty}. ${CONFIG.fatigue.overworkAt} 이상인 채 시즌을 넘기면 과로사 위험`) : null);
  const recordRow = h('div', { class: 'tiles' }, tile('전적', `${g.wins}승 ${g.fights - g.wins}패`, '', '승/패. 승리를 쌓으면 베테라누스, 루디스, 별칭'), tile('미시오', String(g.missios), '', '져서 쓰러졌지만 관중이 살려 준 횟수'), tile('명예', String(g.honor ?? 0), '', '검투사의 명예. 미시오 확률과 별칭·루디스에 영향'), tile('팬', `${fansOf(g)}${fansOf(g) >= FANS_STAR ? '★' : ''}`, '', `관중의 팬. ${FANS_STAR} 이상이면 ★ 인기 검투사`));
  const statusBits: string[] = [];
  if (g.injured) statusBits.push(`부상 ${g.injured}시즌 남음`);
  if (g.status === 'rudiarius' && g.contractUntil != null) statusBits.push(`자유민 계약 ${Math.max(0, g.contractUntil - S.st.season + 1)}시즌 남음 · 급료 출전마다 대여료의 ${Math.round(CONFIG.rudiariusShare * 100)}%`);
  if (g.status === 'doctor') statusBits.push(`독토르로 ${TYPE_KO[g.type]} 훈련을 가르친다 · 급료 ${CONFIG.doctorSalary}/시즌`);
  if (g.fought) statusBits.push('이번 시즌 출전 완료');
  if (kind === 'roster' && g.origin === 'damnatus' && g.boughtSeason != null) statusBits.push(`형기 ${Math.max(0, CONFIG.origins.damnatus.freeAfter - (S.st.season - g.boughtSeason + 1))}시즌 뒤 자유`);
  // 가운데 열: 전적 → 능력치 → 기술 → 상태 → 시즌 행동 (시장: 출신)
  const mid: (Node | null)[] = [
    dsec('record', '전적', recordRow),
    dsec('stats', '능력치', statsRow),
    (() => { const capped = (['hp', 'atk', 'def', 'hand'] as const).filter(k => atCap(g, k)); const KO: Record<string, string> = { hp: '체력', atk: '공격', def: '방어', hand: '손놀림' }; const known = growthKo(g);
      return dsec('growth', '성장',
        h('div', { class: 'line' }, `나이대: ${AGE_BAND_KO[ageBand(g.age ?? 24)]} — ${ageBand(g.age ?? 24) === 'young' ? '빨리 크고 위가 넓다' : ageBand(g.age ?? 24) === 'prime' ? '보통으로 자란다' : '더디고 곧 노쇠한다'}`),
        h('div', { class: 'line' }, `성장형: ${known.length ? known.join(' · ') : '평범'}${kind === 'market' ? ` — 상인: "${merchantLine(g)}"` : ''}`),
        h('div', { class: 'line' }, fullyGrown(g) ? '다 컸다 — 네 능력치 모두 상한. 팔거나 독토르로' : capped.length ? `상한에 닿음: ${capped.map(k => KO[k]).join(' · ')} — 나머지는 더 자란다` : '아직 상한에 닿은 능력치가 없다')); })(), /* 성장은 별도 절 (2026-09-21 사용자) */
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
export function gladSheet(): Node {
  const g = S.st.roster.find(x => x.id === S.gladSel); if (!g) return h('div', { class: 'panel' }, h('h2', {}, '검투사'), h('div', { class: 'hint' }, '루두스를 떠났습니다.'));
  const k = cellOf(S.st, g); const q = S.st.ludus.cells[k] ?? 0, cost = k >= 0 ? upgradeCost(S.st, 'cell', k) : null;
  const cellRow = (j: number) => { const o = occupantOf(S.st, j), qj = S.st.ludus.cells[j] ?? 0; return h('div', { class: `drow${j === k ? ' sel' : ''}`, onclick: j === k ? undefined : () => { moveToCell(S.st, g, j); render(); } },
    h('span', { class: 'nm' }, `${j + 1}번`), h('span', { class: 'stars', style: 'margin-left:6px' }, '★'.repeat(qj) + '☆'.repeat(CONFIG.ludus.cells.qualityCost.length - qj)), o ? h('b', { style: 'margin-left:6px' }, o.name) : h('span', { class: 'meta' }, ' 빈 방'), h('span', { style: 'flex:1' }), j === k ? null : h('span', { class: 'hint' }, '옮기기 →')); }; // 방 줄: 번호 · ★ · 거주자 이름(굵게) — 누르면 그 방으로(사람이 있으면 자리를 바꾼다)
  return h('div', { class: 'panel' },
    h('h2', {}, `켈라 ${k + 1}번`, h('span', { class: 'stars', style: 'margin-left:8px' }, '★'.repeat(q) + '☆'.repeat(CONFIG.ludus.cells.qualityCost.length - q)), helpBtn('켈라와 검투사', '검투사가 자는 작은 방입니다. 방 장식이 상태입니다: 벽의 획수 = 승수(5승 묶음), 종려가지 = 5승마다, 월계관 = 명예 20 이상(40 이상 금빛), 하트 낙서 = 팬 스타, 목검 = 배운 기술 수, 오른쪽 벽 걸이 = 그 유형의 투구·방패·무기, 벽의 나무 검 = 자유민(루디스), 지팡이 = 독토르, 붕대·목발 = 부상. 피로는 자세로: 1 축 처져 앉음, 2 꾸벅임(z z), 3 벽에 기대 잠. 왼쪽 아래 ★ = 켈라 등급.\n\n숙소 질 ★1 피로 회복 −2 · ★2 유지비 −25% · ★3 명예 +1/시즌. 여기서 치료·매각·재훈련·재계약을 하고, 방을 강화하거나 다른 방으로 옮깁니다.')),
    gladRow(g, gladActions(g), { dis: !!g.injured }),
    h('div', { class: 'frow', style: 'margin-top:8px' }, h('div', { class: 'grow' }, h('b', {}, '이 방 강화'), h('div', { class: 'meta' }, '★1 피로 회복 −2 · ★2 피로 덜 쌓임 · ★3 명예 +1/시즌 (★마다 유지비 +100)')), cost != null ? h('button', { disabled: !canPayFac(cost), onclick: () => { if (upgrade(S.st, 'cell', k)) { sfx.coin(); render(); } } }, `방 손보기 ${cost.toLocaleString()}`) : h('span', { class: 'hint' }, '더 손볼 데 없음')),
    h('div', { class: 'two' }, // 왼쪽 시즌 행동 · 오른쪽 방 옮기기
      h('div', {}, h('h3', { class: 'sub' }, '시즌 행동', g.status === 'doctor' ? h('span', { class: 'hint', style: 'margin-left:6px' }, '독토르') : assignedTo(g.id) != null ? h('span', { class: 'hint', style: 'margin-left:6px' }, '출전 예정') : null),
        g.status !== 'doctor' ? h('div', { class: 'segcol' }, ...actionSeg(g)) : h('div', { class: 'hint' }, '가르치는 중')),
      )); // 방 옮기기는 켈라에서 스틱맨을 끌어서
}
// 시즌 행동 선택. 훈련은 훈련소의 팔루스에 세워서 한다 — 팔루스에 선 검투사는 여기서 공/방/기술 중 무엇을 단련할지 고르고 내려올 수도 있다. 나머지는 휴식·시범, 부상자는 요양·치료. 시즌이 끝날 때 실행
function actionSeg(g: Gladiator): (Node | null)[] {
  const at = assignedTo(g.id), tp = planOf(g), slot = palusOf(S.st, g);
  if (g.status === 'doctor') return [];
  if (g.injured) return [h('span', { class: 'seg' }, h('span', { class: 'hint' }, inBed(S.st, g) ? `침상 요양 (부상 ${g.injured}→${Math.max(0, g.injured - 1 - CONFIG.actions.recover.extra)}시즌 · 치료비 ${bedCostOf(S.st)})` : `침상 밖 — 시즌마다 ${Math.round(CONFIG.injury.natural.heal * 100)}% 낫고 ${Math.round(CONFIG.injury.natural.worsen * 100)}% 덧난다. 부상 ${CONFIG.injury.deathAt}이면 죽는다`))]; // 즉시 치료는 없다 (2026-09-21): 의무실 그림에서 침상에 눕힌다
  if (slot >= 0) { // 팔루스에 서 있다: 무엇을 단련할지는 시즌 끝에 무작위 (공·방, 조건이 되면 기술)
    const fatigueTip = at != null ? ` · 출전 뒤 훈련: 피로가 쌓일 확률 ${Math.round(Math.max(0, CONFIG.fatigue.trainAfterFight - cellQuality(S.st, g) * CONFIG.fatigue.perCellStar) * 100)}%` : '';
    return [h('span', { class: 'seg' },
      h('span', { class: 'hint', title: `시즌 끝에 공격(+${trainGain(S.st, g, 'atk')})·방어(+${trainGain(S.st, g, 'def')})·체력(+${trainGain(S.st, g, 'hp')}) 중 하나를 무작위로 단련${fatigueTip}` }, `팔루스 ${slot + 1} — 공·방·체력 중 무작위`),
      h('button', { title: `팔루스 ${slot + 1}에서 내려온다 (이번 시즌 훈련 없음)`, onclick: (ev: Event) => { ev.stopPropagation(); leavePalus(S.st, g); save(); render(); } }, '내려오기'))];
  }
  const f = g.fatigue ?? 0; return [h('span', { class: 'hint' }, at != null ? '출전만' : f > 0 ? `휴식 (피로 ${f} → −${cellQuality(S.st, g) >= 1 ? 2 : 1}${S.st.ludus.medicine >= CONFIG.ludus.medicine.fatigueRestAt ? '−1' : ''})` : `시범 (명예 +${CONFIG.actions.show.honor}) — 훈련은 훈련소의 팔루스에 세워서`)]; // 고르지 않는다: 팔루스에 안 섰으면 피로가 있으면 쉬고, 없으면 시범
}
