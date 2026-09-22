// 마을 장면 그림(의무실·훈련소·포룸·시장·묘지·거리)과 좌표 상수 (Codex: 그림)
import { S, myInk } from './state.js';
import { INK, NPC_POSES, attackClipFor, clipLength, clipSkeleton, drawStickman, type DrawOpts, type Skeleton, walkSkeleton } from './stickman.js';
import { type Contract, type Gladiator } from '../core/types.js';
import { HOST } from '../core/hosts.js';
import { bedPatient, bedCostOf, inBed, palusOf, palusTrainee, rosterCap, validTeam, rerollsLeft, canReroll, recommendTrainees } from '../core/game.js';
import { EPITHET_BY_ID, accessoriesOf, type EpithetId } from '../core/epithets.js';
import { sfx } from './sound.js';
import { CH, GY, MEDIC, TOWN, drawCivilian } from './town.js';
import { ORIGIN_SHORT, hostPrize } from './detail.js';
import { TYPE_COLOR, drawGlyph } from './portrait.js';

export const MARKET = { W: 400, H: 250 }; // 폰 화면 폭에 맞춰 좁힘. 매물 최대 4명이 한 줄
 // 폰 화면 폭에 맞춰 좁힘. 매물 최대 4명이 한 줄
export const MK = { sc: 0.9, get ox() { return (MARKET.W * (1 - this.sc)) / 2; } }; // 시장 장면 축소 배율과 가운데 정렬 여백
 // 시장 장면 축소 배율과 가운데 정렬 여백
export const marketSlotX = (n: number, i: number) => { const W = MARKET.W; const gap = Math.min(120, (W - 120) / Math.max(1, n - 1)); const startX = W / 2 - gap * (n - 1) / 2 + 10; return n === 1 ? W / 2 + 10 : startX + i * gap; };
const marketTagW = (n: number) => n > 1 ? Math.min(86, marketSlotX(n, 1) - marketSlotX(n, 0) - 8) : 86; // 가격표 폭
 // 가격표 폭
// 시장 장면을 (0,0) 기준으로 그린다
// 장소 사이 소품. 발 = GY
export function drawStreetProps(ctx: CanvasRenderingContext2D, t: number) {
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
export function drawCountryside(ctx: CanvasRenderingContext2D, x0: number, w: number, t: number, side: 'left' | 'right') {
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
export const FORUM = { sun: { x: 222, y: -258, r: 18 }, wallW: 200, posterW: 52, posterH: 66, posterGapX: 68, posterGapY: 74, posterX0: 40, posterY0: -170, posterAt: (i: number) => ({ x: 40 + (i % 2) * 68, y: -170 + Math.floor(i / 2) * 74 }) }; // 공고 2×2 (52×66). 벽 위가 처마(캔버스 위 ~54 유닛)에 가리지 않게 벽 꼭대기는 -178 까지만 // 공고벽: 공고 4장이 한 줄에, 계약 카드와 같은 세로 비율 (줌인하면 카드로 이어진다)
 // 공고 2×2 (52×66). 벽 위가 처마(캔버스 위 ~54 유닛)에 가리지 않게 벽 꼭대기는 -178 까지만 // 공고벽: 공고 4장이 한 줄에, 계약 카드와 같은 세로 비율 (줌인하면 카드로 이어진다)
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
/* 시즌 넘기기 해: 화면에 고정된 HUD — 어느 장소로 가든 따라다닌다 (2026-09-22 사용자). 원점이 해의 중심. 누르면 계약 벽·서판을 건너뛰고 바로 시즌 진행 창으로 */
export function drawSun(ctx: CanvasRenderingContext2D, t: number) {
  const s = FORUM.sun, pulse = 1 + Math.sin(t * 1.6) * 0.035;
  ctx.save(); ctx.scale(pulse, pulse);
  /* 솔(Sol) 고증 (2026-09-22 사용자): 로마의 해는 살 달린 원반이 아니라 사람 얼굴에 살 일곱이 뻗는 방사관(corona radiata) — 동전의 솔 인빅투스, 네로 거상, 폼페이 벽화. 얼굴은 넣지 않는다(스틱맨과 같이) */
  ctx.fillStyle = '#e8c96a'; ctx.strokeStyle = '#9b2c1c'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.arc(0, 0, s.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  for (let k = 0; k < 7; k++) { const a = -Math.PI * (0.92 - k * 0.14) + Math.sin(t * 1.3 + k) * 0.03, len = 13 + 4 * Math.sin(t * 2.2 + k * 1.9); /* 살 길이 9 → 13 (2026-09-22 사용자: 조금 더 길게) */ /* 관의 살 일곱: 머리 위쪽 반원에 부채꼴로, 살마다 길이가 숨 쉬듯 늘고 줄며 살짝 흔들린다 */
    const nx = -Math.sin(a), ny = Math.cos(a), bx = Math.cos(a) * (s.r - 1), by = Math.sin(a) * (s.r - 1), tx = Math.cos(a) * (s.r + len), ty = Math.sin(a) * (s.r + len); /* 솔잎 모양 (2026-09-22 사용자: 직선에 화살촉은 안 예뻤다) — 밑은 2.4 폭, 끝은 뾰족한 가는 쐐기를 붉게 채운다 */
    ctx.fillStyle = '#9b2c1c'; ctx.beginPath(); ctx.moveTo(bx + nx * 1.2, by + ny * 1.2); ctx.quadraticCurveTo(bx + nx * 0.9 + (tx - bx) * 0.55, by + ny * 0.9 + (ty - by) * 0.55, tx, ty); ctx.quadraticCurveTo(bx - nx * 0.9 + (tx - bx) * 0.55, by - ny * 0.9 + (ty - by) * 0.55, bx - nx * 1.2, by - ny * 1.2); ctx.closePath(); ctx.fill(); }
  /* 얼굴은 뺐다 — 스틱맨도 얼굴이 없다 (2026-09-22 사용자). 방사관의 살 일곱만 솔을 말한다 */
  ctx.restore();
  const lx = -(s.r + 40); /* 살이 17 까지 뻗으니 글자·화살표는 그 밖으로 (2026-09-22 사용자: 화살표를 더 옆으로) */ /* 글자 오른쪽 끝 — 화살표와 사이를 띄운다 (2026-09-22 사용자) */ /* 글자는 해 왼쪽, 세로 가운데 — 해 아래에 두면 지붕·성벽에 가려질 때가 있었다 (2026-09-22 사용자). TEMPVS 는 4 더 왼쪽 */
  ctx.textAlign = 'right'; ctx.fillStyle = '#9b2c1c'; ctx.font = 'bold 9px serif'; ctx.fillText('TEMPVS', lx - 4, -3); /* 시간 — 폼페이 낙서처럼 붉은 글씨 */
  ctx.fillStyle = INK; ctx.font = 'bold 8px sans-serif'; ctx.fillText('시즌 넘기기', lx, 8); ctx.textAlign = 'left';
  { const ax = -(s.r + 30) + Math.sin(t * 3) * 1.5, ay = 5; ctx.strokeStyle = '#9b2c1c'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + 9, ay); ctx.moveTo(ax + 5, ay - 3.5); ctx.lineTo(ax + 9, ay); ctx.lineTo(ax + 5, ay + 3.5); ctx.stroke(); } /* 글자와 해 사이 붉은 화살표가 해를 향해 까딱인다 — 누르면 시즌이 넘어간다는 것을 강조 (2026-09-22 사용자) */
}
export function drawForumScene(ctx: CanvasRenderingContext2D, t: number) {
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
  ctx.save(); ctx.beginPath(); ctx.rect(0, -178, FORUM.wallW, 164); ctx.clip(); // 공고와 낙서 체크는 회벽 안에서만 보인다. 작은 화면·확대 연출에서도 벽 밖으로 삐져나오지 않게
  S.st.contracts.forEach((c, i) => { const { x: px, y: py } = FORUM.posterAt(i); drawMiniContract(ctx, c, px, py, FORUM.posterW, FORUM.posterH); }); ctx.restore(); // 2×2
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
export function drawMarketScene(ctx: CanvasRenderingContext2D, t: number) {
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
    drawStickman(ctx, 'murmillo', { x: W - 26, y: H - 68, scale: 1.0, facing: -1, skeleton: NPC_POSES.tablet, t, ink, bare: true, garment: 'tunic', garmentColor: '#c8a878', garmentStripe: '#7a1f16',
      hands: (c, f) => { c.fillStyle = '#e8d9b5'; c.fillRect(f.hx - 2, f.hy - 12, 9, 13); c.strokeStyle = ink; c.lineWidth = 1; c.strokeRect(f.hx - 2, f.hy - 12, 9, 13); } });
    if (!items.length) return; // 매물 없음: 빈 카타스타만 (안내는 대시보드에)
    // 사슬: 목 고리 사이를 늘어진 곡선(카테너리 느낌)으로, 작은 고리들이 곡선을 따라 이어짐. 살짝 흔들림
    const neckOf = (g: Gladiator, i: number) => { const sel = g.id === S.marketSel; const sc0 = sel ? 1.22 : 1.12; return { x: slotX(i) - 1 * sc0, y: H - 68 + (sel ? 8 : 0) - 44 * sc0 }; };
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
      const team = myInk();
      const sc0 = sel ? 1.22 : 1.12; /* 2026-09-22 사용자: 장면이 0.9 로 축소돼 노예가 작아 보였다 — 매물은 크게 */
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
      if (gw >= 60) { crowd.push({ x: cx - 12, y: H + 8, sc: 1.15, pose: poses[k % poses.length], f }); crowd.push({ x: cx + 16, y: H + 10, sc: 1.05, pose: 'child', f }); } /* 판매대 앞은 보는 쪽에 가까우니 매물보다 크게 (2026-09-22 사용자: 원근이 거꾸로였다) */
      else if (gw >= 22) crowd.push({ x: cx, y: H + 8, sc: 1.15, pose: poses[k % poses.length], f });
      else crowd.push({ x: cx, y: H + 10, sc: 1.05, pose: 'child', f }); }); // 좁은 틈엔 아이만
    /* 판매대 옆 까치발 행인은 뺐다 — 상인·종과 오른쪽 끝에 셋이 몰렸다 (2026-09-22 사용자) */
  }
  crowd.forEach((c, i) => drawCivilian(ctx, c.x, c.y, c.sc, c.pose, t, i * 7 + 1, c.f));
}
// 상인을 부르는 종 (2026-09-22 사용자: 서판 메뉴 대신 오른쪽 오브젝트): 기둥에 매단 청동 종. 남은 횟수가 있으면 살짝 흔들리고 금빛, 없으면 매듭으로 묶여 잿빛
export const MARKET_BELL = { x: MARKET.W + 30, y: MARKET.H - 118, r: 22 }; /* 성벽 앞에 따로 그린다 (town.ts) */ /* 판매대 밖 오른쪽 (사용자: 조금 더 오른쪽) */ // 장면 좌표 (누르는 판정도 여기)
export function drawMarketBell(ctx: CanvasRenderingContext2D, t: number) {
  const B = MARKET_BELL; const can = rerollsLeft(S.st) > 0 && canReroll(S.st); const sway = can ? Math.sin(t * 1.7) * 0.06 : 0;
  ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(B.x + 14, MARKET.H); ctx.lineTo(B.x + 14, B.y - 26); ctx.lineTo(B.x - 6, B.y - 26); ctx.stroke(); // 기둥과 팔
  ctx.translate(B.x - 6, B.y - 26); ctx.rotate(sway);
  ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 10); ctx.stroke(); // 끈
  ctx.fillStyle = can ? '#c9a13a' : '#8a8378'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-9, 24); ctx.quadraticCurveTo(-11, 8, -3, 8); ctx.lineTo(3, 8); ctx.quadraticCurveTo(11, 8, 9, 24); ctx.lineTo(12, 27); ctx.lineTo(-12, 27); ctx.closePath(); ctx.fill(); ctx.stroke(); // 종 몸
  ctx.fillStyle = can ? '#f3e2a0' : '#b5ae9f'; ctx.beginPath(); ctx.ellipse(-3, 14, 2, 5, 0.3, 0, Math.PI * 2); ctx.fill(); // 빛
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 29, 2.4, 0, Math.PI * 2); ctx.fill(); // 추
  if (!can) { ctx.strokeStyle = '#a8321f'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-10, 18); ctx.lineTo(10, 24); ctx.moveTo(-10, 24); ctx.lineTo(10, 18); ctx.stroke(); } // 묶인 종
  ctx.restore();
  ctx.fillStyle = INK; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.globalAlpha = 0.8; ctx.fillText(can ? '종을 치면 다른 상인' : '이번 시즌은 끝', B.x - 4, B.y + 12); ctx.globalAlpha = 1;
}
export const YARD = { W: 600, H: 230 }; // 안뜰 0~470 + 문루 470~600(폭 130). 정문 화면은 문루부터 시작해 훈련소가 보이지 않는다 // 훈련소(대련장·무기고·팔루스·급식소)가 폰 한 화면(≈400)에 들어오고, 정문 화면은 문루+바깥 길 // 좁은 화면에 맞춰 훈련장을 좁히고 정문(문루)을 넓혔다
 // 안뜰 0~470 + 문루 470~600(폭 130). 정문 화면은 문루부터 시작해 훈련소가 보이지 않는다 // 훈련소(대련장·무기고·팔루스·급식소)가 폰 한 화면(≈400)에 들어오고, 정문 화면은 문루+바깥 길 // 좁은 화면에 맞춰 훈련장을 좁히고 정문(문루)을 넓혔다
export const palusPosts = (n: number) => Array.from({ length: n }, (_, i) => 300 + i * (n <= 2 ? 44 : n === 3 ? 38 : n === 4 ? 32 : n <= 6 ? 26 : 22)); // 팔루스 x (훈련장 좌표): 급식소를 뺀 자리부터 300~454, 8개도 문루(470) 앞에 선다 // 팔루스 x (훈련장 좌표, 연습장 오른쪽). 그림과 클릭이 같은 자리를 쓴다\n// 채찍 물리 상태 (프레임 간 유지)
 // 팔루스 x (훈련장 좌표): 급식소를 뺀 자리부터 300~454, 8개도 문루(470) 앞에 선다 // 팔루스 x (훈련장 좌표, 연습장 오른쪽). 그림과 클릭이 같은 자리를 쓴다\n// 채찍 물리 상태 (프레임 간 유지)
const WN = 18, WSEG = 4.2;
// 의사(메디쿠스): 환자가 있으면 선반(집)과 침상 사이를 오가며 치료. 좌표는 훈련장 기준
const medic = { x: 330, mode: 'home' as 'home' | 'go' | 'tend' | 'back', act: 'grind' as 'grind' | 'shelf' | 'tend' | 'lean' | 'cup', until: 0, target: 330, bed: 0, last: -1, seed: 1 };
const whipState = { p: [] as { x: number; y: number; px: number; py: number }[], last: -1, crackT: -9, crackX: 0 };
export type StickPose = 'stand' | 'point' | 'stir' | 'tend' | 'whip' | 'walk' | 'grind' | 'shelf' | 'lean' | 'cup';
 // 훈련장이 매 프레임 넘겨 주는 보조 인물 그리기
// 의무실 장면 (0,0) 기준, 발 = H-20. 침상은 시설 수(최대 4)만큼, 부상자가 그 위에 눕고 넘치면 벽가에 앉는다. 의사는 탁자와 침상을 오간다
export function drawMedicScene(ctx: CanvasRenderingContext2D, t: number) {
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
  const cost = `${bedCostOf(S.st).toLocaleString()}/시즌`; ctx.font = 'bold 10px sans-serif'; const costW = ctx.measureText(cost).width;
  const crosses = (cx: number, cy: number, n: number, k: number) => { const w = n * 17 + 10 + costW + 6; ctx.fillStyle = '#f3ead0'; ctx.strokeStyle = '#8f7a4e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(cx - w / 2, cy - 10, w, 20, 4); ctx.fill(); ctx.stroke(); // 십자(남은 시즌) + 치료 금액
    for (let j = 0; j < n; j++) { const x = cx - w / 2 + 12 + j * 17, bob = Math.sin(t * 2 + k + j) * 0.6; ctx.fillStyle = '#9b2c1c'; ctx.fillRect(x - 6.5, cy - 2 + bob, 13, 4); ctx.fillRect(x - 2, cy - 6.5 + bob, 4, 13); }
    ctx.fillStyle = '#3a2412'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(cost, cx - w / 2 + 12 + n * 17, cy + 3.5); ctx.textAlign = 'center'; };
  const nameTag = (g: Gladiator, cx: number, cy: number) => { ctx.font = 'bold 10px sans-serif'; const nw = ctx.measureText(g.name).width; const x0 = cx - (nw + 18) / 2; ctx.fillStyle = TYPE_COLOR[g.type]; ctx.fillRect(x0, cy - 12, 14, 14); drawGlyph(ctx, g.type, x0 + 7, cy - 5, 11); ctx.fillStyle = '#3a2412'; ctx.textAlign = 'left'; ctx.fillText(g.name, x0 + 18, cy - 1); ctx.textAlign = 'center'; }; // 무기(유형) 아이콘 + 이름
  occupied.forEach((g, i) => { const bx = bedX[i];
    if (!g) { // 빈 침상: 누르면 켈라에서 부상자를 고른다 (부상자가 있을 때만 표시)
      if (S.st.roster.some(x => x.injured > 0 && !inBed(S.st, x))) { const bob = Math.sin(t * 2 + i) * 1.2; ctx.strokeStyle = '#9b2c1c'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(bx + 37 - 7, H - 62 + bob); ctx.lineTo(bx + 37 + 7, H - 62 + bob); ctx.moveTo(bx + 37, H - 69 + bob); ctx.lineTo(bx + 37, H - 55 + bob); ctx.stroke(); ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(58,36,18,.7)'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('부상자 눕히기', bx + 37, H - 6); }
      return; }
    const team = myInk();
    ctx.save(); ctx.beginPath(); ctx.rect(bx - 4, 0, 92, H); ctx.clip();
    drawStickman(ctx, g.type, { x: bx + 78, y: H - 38, scale: 0.9, pose: 'down_back', t: t + i, team, bare: true, facing: 1 }); ctx.restore(); crosses(bx + 37, H - 80, Math.min(4, g.injured), i);
    nameTag(g, bx + 37, H - 6); }); // 침상 아래 무기 아이콘 + 이름
}
// 성벽: 도시 경계. 높은 벽·총안·아치 성문(열림). 발 = 0
export function drawCityWall(ctx: CanvasRenderingContext2D) {
  const W = TOWN.wallW, H = 200;
  ctx.fillStyle = '#a58f60'; ctx.fillRect(0, -H, W, H + 14); // 땅선 아래까지 내려 뒤쪽 인물의 발이 비치지 않게
  ctx.fillStyle = '#8f7a4e'; for (let y = -H + 20; y < 0; y += 22) { ctx.fillRect(0, y, W, 2); } for (let y = -H + 20, k = 0; y < 0; y += 22, k++) { for (let x = (k % 2) * 20; x < W; x += 40) ctx.fillRect(x, y, 2, 22); } // 석재 줄눈
  ctx.fillStyle = '#a58f60'; for (let x = 4; x < W; x += 24) ctx.fillRect(x, -H - 14, 14, 14); // 총안(흉벽)
  ctx.fillStyle = '#3a2412'; ctx.beginPath(); ctx.moveTo(W / 2 - 28, 0); ctx.lineTo(W / 2 - 28, -84); ctx.arc(W / 2, -84, 28, Math.PI, 0); ctx.lineTo(W / 2 + 28, 0); ctx.closePath(); ctx.fill(); // 성문 아치 (열림)
  ctx.fillStyle = '#b39c6a'; ctx.fillRect(W / 2 - 34, -118, 68, 6); // 아치 위 인방
}
// 묘지: 성문 밖 길가 묘역 (폼페이 누케리아 문 밖처럼). 묘비(스텔라)는 죽은 검투사 수만큼(최대 8), 사이프러스 두 그루, 담. 누르면 연대기
export function drawGraveScene(ctx: CanvasRenderingContext2D, t: number) {
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
export function drawYardScene(ctx: CanvasRenderingContext2D, t: number) {
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
    if (ph > 1.65 && ph < 2.2 && sp > 600 && tip.y > -10 && t - whipState.crackT > 1.5) { whipState.crackT = t; whipState.crackX = tip.x; { const wx = TOWN.yardX + tip.x, onScreen = wx > S.camX + 16 && wx < S.camX + S.VW - 16; /* 채찍이 실제로 화면 안에 있을 때만 (S.view 는 카메라가 향하는 곳일 뿐, 보이는 것과 다르다) */
      if (document.visibilityState === 'visible' && onScreen) sfx.whip(); } }
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
      hands = (_c, f) => { whipStep(t + seed, { x: f.hx, y: f.hy }); drawWhip(t + seed, 1, sc); }; } // 채찍: 실제 손 위치에서 물리로 따라옴
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
    roster.filter(g => g.status === 'doctor').forEach((_g, i) => { const x = 70 + i * 22; stick(x, 180, 0.85, 'point', t + i * 2, 11 + i); }); // 고용한 독토르(전직 검투사)는 교관 옆
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
    const teamColor = (_g: Gladiator) => myInk();
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
  drawYardSign(ctx, t);
}
// 훈련 서판 (2026-09-22 사용자: 서판 메뉴 대신 시장의 종처럼 그림 안에): 회랑 벽에 건 나무 명부. 세울 만한 사람이 있으면 밀랍이 살아 있고 누르면 추천 배치, 없으면 잿빛
export const YARD_SIGN = { x: 258, y: 62, w: 30, h: 24 }; // 훈련장 좌표: 회랑 벽, 무기고 거치대(~240)와 네메시스 감실(270~) 사이 — 문루는 정문 화면의 것 (2026-09-22 사용자)
export function drawYardSign(ctx: CanvasRenderingContext2D, t: number) {
  const G = YARD_SIGN; const busy = new Set(Object.values(S.assign).flat()); const can = recommendTrainees(S.st, busy, true).length > 0; /* 추천은 찼어도 다시 세운다 */
  ctx.save(); ctx.translate(G.x, G.y); if (can) ctx.rotate(Math.sin(t * 1.3) * 0.02);
  ctx.strokeStyle = '#3a2412'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(-6, 0); ctx.moveTo(0, -8); ctx.lineTo(6, 0); ctx.stroke(); // 못에 건 끈
  ctx.fillStyle = can ? '#8a6a44' : '#7a7267'; ctx.fillRect(-G.w / 2, 0, G.w, G.h); ctx.strokeStyle = '#3a2412'; ctx.lineWidth = 1.5; ctx.strokeRect(-G.w / 2, 0, G.w, G.h); // 나무 틀
  ctx.fillStyle = can ? '#e8d9b5' : '#a8a196'; ctx.fillRect(-G.w / 2 + 3, 3, G.w - 6, G.h - 6); // 밀랍
  ctx.strokeStyle = can ? '#6b4a22' : '#8a8378'; ctx.lineWidth = 1; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-G.w / 2 + 6, 8 + i * 5); ctx.lineTo(G.w / 2 - 6 - (i === 2 ? 6 : 0), 8 + i * 5); ctx.stroke(); } // 글줄
  ctx.restore();
  ctx.fillStyle = INK; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.globalAlpha = 0.8; ctx.fillText(can ? '명부: 추천' : '세울 사람 없음', G.x, G.y + G.h + 11); ctx.globalAlpha = 1;
}
// 계약 카드용 경기장 아이콘: 등급별 크기·재질
// 경기장 그림: 등급마다 다르게 — 1 목조 경기장(나무 관람석 2단·기둥), 2 석조 원형경기장(돌 관람석 3단·아치), 3 로마 대경기장(4단·아치 줄·붉은 차양)
// 경기장 그림: 회벽에 붉은 흙물감과 검댕으로 그은 벽화풍. 채움 없이 삐뚤한 겹선(짙은 선 + 옅은 덧선)으로만 그린다
export function arenaIcon(tier: number) {
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
