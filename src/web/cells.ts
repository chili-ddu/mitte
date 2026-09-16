// 켈라(방 격자) 장면과 방 시트
import { S, myInk, myLight } from './state.js';
import { cellOf, moveToCell, occupantOf, palusOf, upgrade, upgradeCost } from '../core/game.js';
import { type Gladiator } from '../core/types.js';
import { TYPE_KO, fansOf } from '../core/gladiator.js';
import { CONFIG } from '../core/config.js';
import { sfx } from './sound.js';
import { FANS_STAR } from '../core/hosts.js';
import { drawGearRack, drawStickman, type Skeleton } from './stickman.js';
import { skillsOf } from '../core/skills.js';
import { accessoriesOf } from '../core/epithets.js';
import { h, helpBtn } from './dom.js';
import { render } from './main.js';
import { TYPE_COLOR, drawGlyph, portrait } from './portrait.js';
import { canPayFac } from './sheets.js';
import { CELLS_TOP } from './town.js';

// 켈라 시트: 칸의 거주자와 숙소 질, 이 칸에 넣을 검투사 고르기
export function cellPanel(k: number): Node {
  const q = S.st.ludus.cells[k] ?? 0, g = occupantOf(S.st, k), cost = upgradeCost(S.st, 'cell', k);
  const row = (x: Gladiator, cur: boolean) => h('div', { class: `drow${cur ? ' sel' : ''}`, onclick: cur ? undefined : () => { moveToCell(S.st, x, k); S.cellPop = null; S.gladSel = x.id; S.cellSide = 'glad'; render(); } }, // 옮기면 팝오버를 닫는다
    portrait(x, 34), ' ', h('span', { class: 'nm' }, x.name), h('span', { class: 'meta' }, ` ${TYPE_KO[x.type]} · ${x.rank === 'tiro' ? '티로' : '베테'}${x.injured ? ' · 부상' : ''}`), h('span', { style: 'flex:1' }), cur ? h('span', { class: 'hint' }, '이 칸') : h('span', { class: 'hint' }, `${cellOfIdx(x) + 1}번 →`));
  return h('div', { class: 'panel' }, h('h2', {}, `켈라 ${k + 1}번`, h('span', { class: 'stars', style: 'margin-left:8px' }, '★'.repeat(q) + '☆'.repeat(CONFIG.ludus.cells.qualityCost.length - q)), helpBtn('켈라', '검투사가 자는 작은 방입니다. 검투사를 고르면 이 칸으로 오고, 이미 누가 있으면 서로 자리를 바꿉니다.\n숙소 질 ★1 휴식 피로 −2, ★2 유지비 −25%, ★3 명예 +1/시즌. 질은 칸에 붙어 있어 검투사를 옮기면 그 칸의 질을 받습니다.')),
    h('div', { class: 'frow' }, h('div', { class: 'grow' }, h('b', {}, g ? g.name : '빈 칸'), h('div', { class: 'meta' }, g ? `${TYPE_KO[g.type]} · 명예 ${g.honor ?? 0} · 피로 ${g.fatigue ?? 0}` : '검투사를 고르면 이 칸에 들어옵니다')), cost != null ? h('button', { disabled: !canPayFac(cost), onclick: () => { if (upgrade(S.st, 'cell', k)) { sfx.coin(); render(); } } }, `방 손보기 ${cost.toLocaleString()}`) : h('span', { class: 'hint' }, '더 손볼 데 없음')),
    h('div', { class: 'dlist' }, ...S.st.roster.map(x => row(x, x === g))));
}
const cellOfIdx = (g: Gladiator) => cellOf(S.st, g);
 // 마을 캔버스의 현재 논리 높이: 평소 TOWN_H, 켈라가 열리는 만큼 cellsH 까지 자란다 (renderTown 의 draw 가 매 프레임 정한다). 세로 무대에서 닫힌 마을 아래 빈 흙길이 화면 절반을 먹던 문제의 답 답
export function cellRects(_n: number): { x: number; y: number; w: number; h: number }[] {
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
    if (g.status !== 'doctor') drawGearRack(ctx, g.type, r.w - 24 * sc, r.h - 7, 0.9 * sc, g.id, g.rank === 'veteranus' ? myInk() : myLight()); // 바닥 기준: 선반 위 투구, 못에 건 검, 기대 세운 창·방패
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
 // 피로 1: 팔을 늘어뜨리고 축 처져 앉음
function cellSleep(t: number): { sk: Skeleton; facing?: 1 | -1 } { const br = Math.sin(t * 1.1) * 1.2; return { sk: { ...SIT, lean: -18 + br, frontArm: [-20, 10], backArm: [20, 10], frontLeg: [78, -20], backLeg: [66, -6], headBob: 9, sink: 20 } }; } // 피로 3: 벽에 등을 기대고 고개 꺾인 채 잠
 // 피로 3: 벽에 등을 기대고 고개 꺾인 채 잠
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
export function drawCellsScene(ctx: CanvasRenderingContext2D, t: number) {
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
      drawStickman(ctx, g.type, { x: r.x + r.w * 0.42, y: r.y + r.h - 7, scale: Math.min(0.95, r.h / 92, r.w / 96), skeleton: sk.sk, t: t + k, team: g.rank === 'veteranus' ? myInk() : myLight(), bare: true, facing: fx, accessories: accessoriesOf(g) });
      drawCellDecor(ctx, r, g, t, 'front'); }
    if (S.bedPick != null || S.palusMode) { const ok = !!g && (S.bedPick != null ? g.injured > 0 : g.alive && g.injured <= 0 && g.status !== 'doctor'); if (!ok) { ctx.fillStyle = 'rgba(203,182,127,.74)'; ctx.fillRect(r.x, r.y, r.w, r.h); } else if (S.palusMode && g && palusOf(S.st, g) >= 0) { ctx.fillStyle = '#9b2c1c'; ctx.fillRect(r.x + 4, r.y + r.h - 22, r.w - 8, 16); ctx.fillStyle = '#f3ead0'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`팔루스 ${palusOf(S.st, g) + 1}`, r.x + r.w / 2, r.y + r.h - 10); } /* 방 아래쪽 띠 (이름을 가리지 않게) */ } // 배정 모드: 고를 수 없는 방은 흐리게 — 침상은 부상자만, 팔루스는 건강하고 아직 안 선 검투사만
  });
  if (S.cellDrag && S.cellDrag.moved) { const g = S.st.roster.find(x => x.id === S.cellDrag!.id); if (g) { ctx.save(); ctx.globalAlpha = 0.9; ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 6; drawStickman(ctx, g.type, { x: S.cellDrag.px, y: S.cellDrag.py + 26, scale: 1.0, pose: 'idle', t, team: g.rank === 'veteranus' ? myInk() : myLight(), bare: true, facing: 1, accessories: accessoriesOf(g) }); ctx.restore();
    ctx.save(); ctx.font = 'bold 11px sans-serif'; const nw = ctx.measureText(g.name).width, bx = S.cellDrag.px - (nw + 22) / 2, by = S.cellDrag.py - 84; ctx.fillStyle = 'rgba(243,234,208,.95)'; ctx.beginPath(); ctx.roundRect(bx - 5, by - 12, nw + 32, 20, 5); ctx.fill(); ctx.fillStyle = TYPE_COLOR[g.type]; ctx.fillRect(bx, by - 9, 14, 14); drawGlyph(ctx, g.type, bx + 7, by - 2, 11); ctx.fillStyle = '#3a2412'; ctx.textAlign = 'left'; ctx.fillText(g.name, bx + 18, by + 3); ctx.restore(); } } // 끌고 가는 검투사 (그림자) + 머리 위 무기 아이콘·이름표
}
