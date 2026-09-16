// 전투 화면: 경기장 그림·재생·결과 (규칙은 core/battle.ts, 여기는 재생만)
import { S, myInk, myLight } from './state.js';
import { CEREMONIES, ENEMY, INK, attackClipFor, backstepSkeleton, clipLength, clipSkeleton, comboClipFor, deathClipFor, drawNetOverlay, drawNetProjectile, drawSeated, drawStickman, isDeathClip, runSkeleton, type ClipName, type Skeleton, walkSkeleton } from './stickman.js';
import { SKILLS, SKILL_NAME, skillsOf } from '../core/skills.js';
import { type GType, type Gladiator, type HostKind } from '../core/types.js';
import { ARENA } from '../core/battle.js';
import { setCrowd, sfx, startCrowd, stopCrowd } from './sound.js';
import { fansOf, formLabel } from '../core/gladiator.js';
import { MAIN_HAND, equipOf } from '../core/equipment.js';
import { FANS_STAR, HOST } from '../core/hosts.js';
import { hasBigShield, loadoutFor } from './loadout.js';
import { accessoriesOf } from '../core/epithets.js';
import { refuseRudis, rivalOf, type FightReport } from '../core/game.js';
import { CONFIG } from '../core/config.js';
import { ask, h, sq, eun, ga } from './dom.js';
import { DEBUG, app } from './main.js';
import { TYPE_COLOR, glyphSvg } from './portrait.js';
import { headerEl } from './header.js';
import { graffitiBtn, nextFight } from './plan.js';

// ---------- 전투 재생 ----------

// ── 경기장(월드 좌표, 검투사 비율). 바닥 타원 중심 (0,0). 관객석은 타원 링으로 사방을 두르되 먼 쪽이 높이 들린다.
const hash01 = (a: number, b: number) => { const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return h - Math.floor(h); };
const WORLD = { rx: 680, ry: 150, rows: 6, seat: 46, sc: 0.9, wood: false, velarium: false, seatLift: 30 }; // seatLift: 관객 머리를 좌석선보다 위로 올려 몸이 좌석 띠 안에 앉게 (0이면 머리가 좌석선에 붙어 앞줄이 경기장 밖으로 내려앉아 보인다) // ry 는 tilt=1(낮은 각도)일 때. 관중 = 검투사 비율. 경기마다 등급에 맞춰 바뀐다
 // seatLift: 관객 머리를 좌석선보다 위로 올려 몸이 좌석 띠 안에 앉게 (0이면 머리가 좌석선에 붙어 앞줄이 경기장 밖으로 내려앉아 보인다) // ry 는 tilt=1(낮은 각도)일 때. 관중 = 검투사 비율. 경기마다 등급에 맞춰 바뀐다
// 등급별 경기장: 1 = 목조 가설 경기장(작고 관중석 3단, 나무 판자), 2 = 지방 석조 경기장, 3 = 대경기장(9단, 벨라리움 차양)
const ARENA_BY_TIER: Record<number, Partial<typeof WORLD>> = {
  1: { rx: 520, ry: 118, rows: 3, wood: true, velarium: false },
  2: { rx: 680, ry: 150, rows: 6, wood: false, velarium: false },
  3: { rx: 880, ry: 190, rows: 9, wood: false, velarium: true },
};
function applyArena(tier: number) { Object.assign(WORLD, ARENA_BY_TIER[tier] ?? ARENA_BY_TIER[2]); }
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
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
  // 회벽에 긁어 넣은 경기장처럼 보이도록 넓은 안료 얼룩을 먼저 깐다
  ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = '#efe1bd';
  for (let i = 0; i < 18; i++) { const x = -rx * 1.1 + hash01(i, 11) * rx * 2.2, y = -ry * 1.8 + hash01(i, 17) * ry * 3.2; ctx.beginPath(); ctx.ellipse(x, y, 28 + hash01(i, 19) * 70, 9 + hash01(i, 23) * 24, hash01(i, 29) * Math.PI, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  // 바깥 벽 그림자
  { const o = R(WORLD.rows - 1); ctx.fillStyle = '#8f7047'; ctx.beginPath(); ctx.ellipse(0, o.cy + 16 * tilt, o.rx * 1.03, o.ry * 1.06, 0, 0, Math.PI * 2); ctx.fill(); }
  // 관객석 링 (바깥부터)
  for (let k = WORLD.rows - 1; k >= 0; k--) {
    const o = R(k), i = k === 0 ? { cy: 0, rx: rx * 1.03, ry: ry * 1.04 } : R(k - 1);
    ctx.fillStyle = WORLD.wood ? (k % 2 ? '#94633c' : '#835735') : (k % 2 ? '#c3aa72' : '#af9561');
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
  ctx.fillStyle = '#98794f'; ctx.beginPath(); ctx.ellipse(0, 0, rx * 1.03, ry * 1.04, 0, 0, Math.PI * 2); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2, true); ctx.fill();
  ctx.strokeStyle = '#5a3a1c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  for (const side of [-1, 1]) { const gx = side * rx * 0.995, gy = 0; ctx.fillStyle = '#3a2412'; ctx.beginPath(); ctx.ellipse(gx, gy, 14, 26, 0, 0, Math.PI * 2); ctx.fill(); }
  drawHostBox(ctx, -ry * 1.03, tilt);
  // 모래 바닥 + 자국
  ctx.fillStyle = '#d1b576'; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = '#efe1bd';
  for (let i = 0; i < 38; i++) { const x = (hash01(i, 31) - 0.5) * rx * 1.7, y = (hash01(i, 37) - 0.5) * ry * 1.4; ctx.fillRect(x, y, 1 + hash01(i, 41) * 5, 1); }
  ctx.restore();
  ctx.strokeStyle = '#9f8355'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) { const yy = -ry * 0.7 + i * ry * 0.2; ctx.beginPath(); ctx.moveTo(-rx * 0.6 + hash01(i, 3) * 60, yy); ctx.quadraticCurveTo(hash01(i, 5) * 100 - 50, yy + 8, rx * 0.55 - hash01(i, 7) * 60, yy); ctx.stroke(); }
  ctx.save(); ctx.globalAlpha = 0.28; ctx.strokeStyle = '#9b2c1c'; ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) { const x = -rx * 0.45 + i * rx * 0.22 + hash01(i, 47) * 18, y = ry * (0.18 + hash01(i, 53) * 0.42); ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x + 12, y - 2); ctx.moveTo(x + 2, y - 7); ctx.lineTo(x + 8, y + 5); ctx.stroke(); }
  ctx.restore();
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
export function graffitiCheck(): Node {
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
export function renderBattle() {
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
    h('div', { class: 'stage' }, canvas, lineup, lineupTab,
      legendShown ? null : h('div', { class: 'legend' }, h('span', { style: `color:${myInk()};font-weight:700` }, '■ 파란 방패·허리천 = 내 루두스'), '   ', h('span', { style: `color:${ENEMY};font-weight:700` }, '■ 자주색 = 상대 파밀리아')),
      h('div', { class: 'actions' }, skip)));
  app.append(headerEl(), wrap); app.classList.add('land', 'battle'); window.scrollTo(0, 0); // 전투도 같은 가로 무대 안: 위 헤더는 그대로, 아래는 경기장이 채운다 (하단 바 없음)
// 경기장 높이 = 남는 높이 (스크롤 없이 바 바로 위까지)
  lineup.addEventListener('click', foldLineup); canvas.addEventListener('click', () => { introSkip(); if (!lineup.classList.contains('folded')) foldLineup(); }); // 편성이나 전투 화면을 누르면 접힌다. 접힌 뒤엔 아이콘 줄을 누르면 내려온다
  window.setTimeout(() => { if (S.phase === 'battle') foldLineup(); }, 4500); // 소개 연출이 끝날 즈음 접힌다
  const W = canvas.clientWidth || 868, H = canvas.clientHeight || 354; const SK = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--stage-k')) || 1) * devicePixelRatio; // 무대 배율 × DPR 만큼 실제 픽셀을 잡아 선명하게
  canvas.width = W * SK; canvas.height = H * SK;
  const ctx = canvas.getContext('2d')!; ctx.scale(SK, SK);
  const ZK = Math.max(0.72, Math.min(1, W / 1000)) * Math.min(1.2, Math.max(1, H / 540)); // 좁은 화면: 줌을 낮춰 싸움이 화면에 들어오게 (폰 ≈ 0.72, 보이는 폭 ≈ 620). 캔버스가 세로로 길면(화면 채움) 조금 더 당겨 위아래 빈 곳을 줄인다
  // 룰 좌표 → 월드 좌표 (바닥 타원 안, 화면 폭에 맞춤)
  const sx = (x: number) => (x / ARENA.w - 0.5) * 1120; // 바닥 폭 거의 전체
  const sy = (y: number) => (y / ARENA.h - 0.5) * floorRy(tilt) * 1.27 - 8;
  const SC = 1.02; // 전투 중 검투사 가독성: 경기장 줌과 별개로 장비 실루엣이 읽힐 만큼만 키운다
  const units = [...r.team.map(g => ({ g, side: 'A' as const })), ...r.contract.enemy.map(g => ({ g, side: 'B' as const }))];
  const byId = Object.fromEntries(units.map(u => [u.g.id, u]));
  const hp: Record<number, number> = { ...r.initialHp };
  // 반전 연출: 지고 있던 쪽이 앞서는 순간을 짚는다. 체력 비율(남은 합/처음 합)의 차이로 본다
  const sideIds = { A: r.team.map(g => g.id), B: r.contract.enemy.map(g => g.id) };
  const shareOf = (ids: number[]) => { const init = ids.reduce((a, id) => a + (r.initialHp[id] ?? 0), 0); return init ? ids.reduce((a, id) => a + Math.max(0, hp[id] ?? 0), 0) / init : 0; };
  let lead = 0, worstA = 0, worstB = 0, flips = 0; // worst*: 그 편이 가장 뒤처졌던 정도
  const REVERSE_GAP = 0.22, MAX_FLIPS = 2; // 이만큼 뒤처졌다가 앞서면 '뒤집혔다'. 한 경기에 두 번까지만

  const hpAppliedIdx: Record<number, number> = {}; // 대상별로 마지막에 반영한 이벤트 순번
  const face: Record<number, 1 | -1> = Object.fromEntries(units.map(u => [u.g.id, u.side === 'A' ? 1 : -1]));
  const engaged: Record<number, number | undefined> = {};
  const boundUntil: Record<number, number> = {};
  const clips: Record<number, { clip: ClipName; start: number }> = Object.fromEntries(units.map(u => [u.g.id, { clip: 'guard', start: -9 }]));
  const play = (id: number, clip: ClipName, at: number) => { clips[id] = { clip, start: at }; };
  const hitDelayOf = (combo?: boolean) => combo ? 0.22 : 0.26; // 공격은 예비동작을 눈으로 읽은 뒤 꽂히게 한다
  let flash: { id: number; t: number; text: string; color: string }[] = [];
  let nets: { from: number; to: number; start: number; dur: number }[] = [];
  const netAway: Record<number, boolean> = {};
  const pending: { at: number; fn: () => void }[] = [];
  const phaseOf: Record<number, number> = {};
  const leapUntil: Record<number, number> = {};
  const jolt: Record<number, { amp: number; until: number }> = {};
  const recoil: Record<number, { start: number; dur: number; dir: 1 | -1; dist: number }> = {};
  let shakeStart = -1, shakeUntil = -1, shakeAmp = 0;
  let slowUntil = -1;
  let zoomAt: { x: number; y: number } | null = null; let zoomStart = -1;
  type FxKind = 'tell' | 'slash' | 'pierce' | 'cleave' | 'thrust' | 'dust' | 'ink' | 'ghost' | 'shock' | 'gslash' | 'dslash' | 'netline' | 'push' | 'ring' | 'halo' | 'cloth' | 'trail';
  const fx: { kind: FxKind; x: number; y: number; t: number; dir: number; seed: number; id?: number; to?: number; life?: number }[] = []; // id: 붙어 다닐 검투사 · to: 상대 · life: 총 시간
  function impactProfile(type: GType) {
    const main = loadoutFor(type).main;
    if (main === 'sica') return { fx: 'cleave' as const, dist: 1.08, dur: 0.24, shake: 1.12, life: 0.3 }; // 찍어 꺾음
    if (main === 'spear' || main === 'trident') return { fx: 'thrust' as const, dist: 1.45, dur: 0.32, shake: 0.9, life: 0.34 }; // 찔러 밀어냄
    return { fx: 'pierce' as const, dist: 0.86, dur: 0.2, shake: 0.82, life: 0.24 }; // 짧고 깊은 찌름
  }
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
  // 연출은 조건 자체가 드물 때만 건다(경기당 0.1~0.2회) — 드문 일은 확률로 또 거르지 않고 무조건 보여 준다(사용자)
  const brink = new Set<number>(); // 벼랑에서 버틴 순간을 본 검투사 (한 번만)
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
  function posAt(ct: number): Record<number, { x: number; y: number; hp: number; sta: number }> {
    while (fi < frames.length - 2 && frames[fi + 1].t <= ct) fi++;
    const a = frames[fi], b = frames[Math.min(fi + 1, frames.length - 1)];
    const k = b.t > a.t ? Math.max(0, Math.min(1, (ct - a.t) / (b.t - a.t))) : 0;
    const out: Record<number, { x: number; y: number; hp: number; sta: number }> = {};
    a.u.forEach((ua, idx) => { const ub = b.u[idx]; out[ua[0]] = { x: sx(ua[1] + (ub[1] - ua[1]) * k), y: sy(ua[2] + (ub[2] - ua[2]) * k), hp: ua[3], sta: ua[4] ?? 100 }; });
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
      const hitDelay = hitDelayOf(e.combo) + (e.net ? 0.55 : 0);
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
      case 'second_wind': at('halo', 2.0); crowdCheer = 1; slowUntil = Math.max(slowUntil, ct + 0.6); sfx.cheer(0.7); break; // 심판이 경기를 멈추는 순간 — 반전의 문턱        // 심판 지팡이가 내려오고 흰 원, 초록 점
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
      if (e.kind === 'stumble') { const trip = !!e.trip; flash.push({ id: e.actor, t: trip ? 1.8 : 1.3, text: trip ? '넘어졌다!' : '헛디딤!', color: trip ? '#9b1f14' : '#6b4a22' });
        if (trip) { slowUntil = Math.max(slowUntil, ct + 0.4); crowdCheer = Math.max(crowdCheer, 0.7); const pp = posAt(ct)[e.actor]; shouts.length = 0; shouts.push({ text: '넘어졌다!', t: 1.4, x: pp.x }); } const p0 = posAt(ct)[e.actor]; fx.push({ kind: 'dust', x: p0.x, y: p0.y + 34, t: 0.5, dir: face[e.actor], seed: e.actor + 3 }); shout('오오…', p0.x); continue; } // 지쳐 헛디딤: 발밑 먼지
      if (e.kind !== 'attack' || e.target == null) continue;
      const aid = e.actor, tid = e.target, tgtType = byId[tid].g.type;
      engaged[aid] = tid; engaged[tid] = aid;
      if (e.skill === 'riposte') flash.push({ id: aid, t: 1.2, text: '되치기!', color: '#c58a1a' }); // '반격!' 표시는 뺐다: 서로 한 대씩 주고받기만 해도 떠서 뜻이 없었다. 반격은 되치기 기술일 때만
      if (e.combo) flash.push({ id: aid, t: 1, text: '연속!', color: '#c58a1a' });
      if (e.charge) { flash.push({ id: aid, t: 1, text: '돌진!', color: '#9b2c1c' }); leapUntil[aid] = ct + 0.28; const p0 = posAt(ct)[aid]; fx.push({ kind: 'dust', x: p0.x, y: p0.y + 34, t: 0.5, dir: face[aid], seed: aid }); shout('우와아!', p0.x); }
      const hitDelay = hitDelayOf(e.combo);
      { const p0 = posAt(ct)[aid], pt0 = posAt(ct)[tid], big = e.crit || e.downed || e.charge || e.counter; fx.push({ kind: 'tell', x: p0.x + face[aid] * 26, y: p0.y - 10, t: hitDelay, life: hitDelay, dir: face[aid], seed: aid * 17 + tid }); sfx.swing(big); if (e.crit && !e.downed) { zoomAt = { x: (p0.x + pt0.x) / 2, y: (p0.y + pt0.y) / 2 - 12 }; zoomStart = ct; holdUntil = Math.max(holdUntil, ct + hitDelay + 0.18); zoomOutDur = 0.35; } } // 공격 예고: 휘두름 소리와 붉은 궤적이 먼저 나오고, 치명타는 잠깐 당겨 본다
      const isFinal = !!e.downed && !r.events.slice(ei).some(x => x.kind === 'attack' && x.downed);
      if (e.net) {
        slowUntil = Math.max(slowUntil, ct + 0.45); crowdCheer = Math.max(crowdCheer, 0.8); /* 그물에 걸리면 판이 뒤집힌다 */
        play(aid, 'net_throw', ct); netAway[aid] = true;
        nets.push({ from: aid, to: tid, start: ct + 0.14, dur: 0.38 }); sfx.net();
        pending.push({ at: ct + 0.5, fn: () => { boundUntil[tid] = ct + 0.5 + 1.2; } });
        pending.push({ at: ct + 0.55, fn: () => play(aid, attackClipFor(byId[aid].g.type), ct + 0.55) });
        pending.push({ at: ct + 1.6, fn: () => { netAway[aid] = false; } });
      } else play(aid, e.combo ? comboClipFor(byId[aid].g.type) : attackClipFor(byId[aid].g.type), ct);
      const evIdx = ei; // 이벤트 순서. 연속 공격(2타)의 피격 반영이 1타보다 먼저 와도 앞선 값이 나중 값을 덮지 않게
      pending.push({ at: ct + hitDelay + (e.net ? 0.55 : 0), fn: () => {
        if (evIdx >= (hpAppliedIdx[tid] ?? -1)) { hpAppliedIdx[tid] = evIdx; hp[tid] = e.targetHp!; }
        { const nl = shareOf(sideIds.A) - shareOf(sideIds.B); // 체력 우세가 뒤집히는 순간: 잠깐 늦추고 관중이 술렁인다
          if (flips < MAX_FLIPS && nl > 0.02 && worstA <= -REVERSE_GAP) { flips++; worstA = 0; slowUntil = Math.max(slowUntil, ct + 0.55); crowdCheer = 1; sfx.cheer(0.8); const p = posAt(ct)[aid]; shouts.length = 0; shouts.push({ text: '뒤집혔다!', t: 1.6, x: p.x }); flash.push({ id: aid, t: 1.6, text: '반전!', color: '#9b1f14' }); }
          else if (flips < MAX_FLIPS && nl < -0.02 && worstB <= -REVERSE_GAP) { flips++; worstB = 0; slowUntil = Math.max(slowUntil, ct + 0.55); crowdCheer = 0.6; sfx.boo(); const p = posAt(ct)[aid]; shouts.length = 0; shouts.push({ text: '뒤집혔다!', t: 1.6, x: p.x }); }
          worstA = Math.min(worstA, nl); worstB = Math.min(worstB, -nl); lead = nl; void lead; }
        if (!e.downed && (e.targetHp ?? 0) > 0 && (e.targetHp ?? 0) / r.initialHp[tid] <= 0.08 && (hp[aid] ?? 0) / r.initialHp[aid] >= 0.4 && !brink.has(tid)) { brink.add(tid); /* 상대는 멀쩡한데 벼랑 끝에서 버텼다 */ // 벼랑 끝에서 버텼다
          slowUntil = Math.max(slowUntil, ct + 0.35); const p = posAt(ct)[tid]; shouts.length = 0; shouts.push({ text: '아직 섰다!', t: 1.4, x: p.x }); crowdCheer = Math.max(crowdCheer, 0.9); }
        play(tid, e.downed ? (woundOf(tid) || !isFinal ? deathClipFor(byId[aid].g.type) : 'yield') : e.blocked && hasBigShield(loadoutFor(tgtType)) ? 'block' : 'hit', ct + hitDelay); // 경기를 끝내는 마지막 쓰러짐만 항복 자세(무릎·검지). 단체전에서 먼저 쓰러진 자와 상처로 죽는 자는 눕는다
        if (e.downed && isFinal && !woundOf(tid)) yielded.add(tid);
        if (e.downed) sfx.down(); else if (e.blocked) sfx.block(); else if (e.crit) sfx.crit(); else sfx.hit(!!(e.counter || e.charge || e.combo));
        const stack = flash.filter(f => f.id === tid).length;
        flash.push({ id: tid, t: 1 + stack * 0.35, text: `-${e.dmg}${e.counter ? '!' : ''}${e.charge ? ' 돌진' : ''}${e.combo ? ' 연속' : ''}${e.blocked ? ' 방패' : ''}${e.net ? ' 그물' : ''}`, color: e.counter ? '#9b2c1c' : e.blocked ? '#2c4f9b' : '#2b1d0e' });
        const heavy = e.counter || e.charge || e.downed;
        const amp = e.downed ? 7 : e.crit ? 9 : heavy ? 5 : 3; // 치명타는 흔들림 최대
        jolt[tid] = { amp, until: ct + (e.crit ? 0.32 : 0.22) }; jolt[aid] = { amp: amp * 0.6, until: ct + 0.16 };
        const pt = posAt(ct)[tid]; const pa = posAt(ct)[aid];
        const imp = impactProfile(byId[aid].g.type), dir = (pa.x <= pt.x ? 1 : -1) as 1 | -1, baseDist = e.downed ? 32 : e.crit ? 26 : heavy ? 22 : 14;
        recoil[tid] = { start: ct, dur: Math.max(imp.dur, e.downed ? 0.34 : heavy ? 0.28 : 0.22), dir, dist: baseDist * (e.blocked ? 0.45 : imp.dist) };
        { const amp2 = (e.downed ? 5.5 : e.crit ? 4.5 : heavy ? 3.2 : 1.8) * (e.blocked ? 0.7 : imp.shake), shaking = ct < shakeUntil; if (e.downed || e.crit || e.open || e.net) slowUntil = Math.max(slowUntil, ct + (e.downed ? 0.38 : e.crit ? 0.22 : 0.18)); /* 눌림은 큰 순간에만 — 평타마다 멈칫하면 대비가 흐려진다 */ shakeStart = ct; shakeUntil = Math.max(shakeUntil, ct + (e.downed ? 0.24 : e.crit ? 0.18 : heavy ? 0.13 : 0.08)); shakeAmp = shaking ? Math.max(shakeAmp, amp2) : amp2; }
        if (!e.blocked) fx.push({ kind: imp.fx, x: pt.x, y: pt.y - 6, t: imp.life, life: imp.life, dir, seed: aid * 11 + tid });
        else fx.push({ kind: 'shock', x: pt.x - dir * 10, y: pt.y - 8, t: 0.26, life: 0.26, dir, seed: aid * 11 + tid });
        if (!e.blocked && imp.fx === 'thrust') fx.push({ kind: 'dust', x: pt.x + dir * 10, y: pt.y + 34, t: 0.42, dir, seed: tid + 9 }); // 창·삼지창은 밀린 발밑 먼지를 함께 낸다
        fx.push({ kind: 'slash', x: pt.x, y: pt.y - 6, t: 0.28, dir: pa.x <= pt.x ? 1 : -1, seed: aid * 7 + tid });
        const ratioDmg = (e.dmg ?? 0) / r.initialHp[tid];
        const pBlood = e.downed ? 1 : Math.max(0.15, Math.min(1, ratioDmg * 3.2));
        if (!e.blocked && Math.random() < pBlood) bleed(pt.x, pt.y, pa.x <= pt.x ? 1 : -1, e.downed ? 22 : Math.round(4 + ratioDmg * 40), e.downed ? 1.6 : 0.7 + ratioDmg * 2);
        if (e.crit) flash.push({ id: tid, t: 1.3, text: '치명타!', color: '#9b1f14' });
        if (e.open) flash.push({ id: tid, t: 1.3, text: '빈틈!', color: '#9b1f14' });
        if (e.downed && woundOf(tid)) { // 그 자리에서 숨이 끊기는 타격: 무기에 맞춰 마지막 장면을 길게 눌러 준다
          const cut = equipOf(byId[aid].g.type).main === 'sica'; slowUntil = Math.max(slowUntil, ct + 0.6); shakeAmp = Math.max(shakeAmp, 7); shakeUntil = Math.max(shakeUntil, ct + 0.3);
          bleed(pt.x, pt.y - (cut ? 16 : 6), pa.x <= pt.x ? 1 : -1, 30, 2.2); flash.push({ id: tid, t: 2, text: cut ? '목을 베었다' : '심장을 꿰뚫었다', color: '#9b1f14' }); }
        else if (e.downed && e.skill === 'riposte') { slowUntil = Math.max(slowUntil, ct + 0.45); flash.push({ id: aid, t: 1.8, text: '되받아쳐 끝냈다', color: '#c58a1a' }); } // 막고 되치기로 끝내는 순간
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
  const CAM_IN = { z: 0.86 * ZK, x: 0, y: -130 * ZK }; // 관객석 1~2층까지 보이되 검투사 장비가 읽히도록 한 걸음 당긴다. x 는 싸움 중심을 따라감
  let followX = 0;
  const CAM_OUT = { z: ZOUT, x: 0, y: 0 };
  // 입장(폼파): 왼쪽 파밀리아에 한 번, 오른쪽에 한 번, 그리고 가운데로 — 북이 한 번씩 울린다. 아무 곳이나 누르면 건너뛴다
  const INTRO_HOLD = 0.6, INTRO_LEFT = 1.9, INTRO_RIGHT = 3.2, INTRO_ZOOM = 4.0; // 누적 시각 (마지막이 가운데로 빠지는 끝)
  let intro = 0, introStage = -1, introSkipped = false; // 실시간 경과
  const introText = { big: '', sub: '', t: 0 };
  const sideCenter = (side: 'A' | 'B') => { const ids = side === 'A' ? r.team.map(g => g.id) : r.contract.enemy.map(g => g.id); const f = frames[0];
    const pts = f.u.filter(u => ids.includes(u[0])); if (!pts.length) return { x: 0, y: 0 };
    return { x: sx(pts.reduce((a, u) => a + u[1], 0) / pts.length), y: sy(pts.reduce((a, u) => a + u[2], 0) / pts.length) }; };
  const rivalName = rivalOf(S.st.rivals, r.contract.rivalId)?.name ?? '타지 라니스타의 검투사';
  const introSkip = () => { if (intro < INTRO_ZOOM) { intro = INTRO_ZOOM; introSkipped = true; introText.t = 0; } };

  // 카메라 상태: 목표(z, cx, cy)를 향해 부드럽게 따라간다. 들어갈 땐 빠르게(8/s), 빠질 땐 느리게(2/s)
  const camCur = { z: 0, cx: 0, cy: 0, init: false };
  function camera(ct: number, dtReal: number) {
    let z: number, cx: number, cy: number;
    if (intro < INTRO_HOLD) { z = CAM_OUT.z; cx = CAM_OUT.x; cy = CAM_OUT.y; tilt = 0; }
    else if (!introSkipped && intro < INTRO_RIGHT) { // 파밀리아 소개: 한쪽씩 당겨 본다
      const first = intro < INTRO_LEFT; const k = first ? (intro - INTRO_HOLD) / (INTRO_LEFT - INTRO_HOLD) : (intro - INTRO_LEFT) / (INTRO_RIGHT - INTRO_LEFT);
      const e = 1 - Math.pow(1 - Math.min(1, k), 3); tilt = 1; const c = sideCenter(first ? 'A' : 'B');
      z = CAM_IN.z * 1.35; cx = c.x; cy = c.y - 40; void e; }
    else if (intro < INTRO_ZOOM) { const k = (intro - (introSkipped ? INTRO_HOLD : INTRO_RIGHT)) / (INTRO_ZOOM - (introSkipped ? INTRO_HOLD : INTRO_RIGHT)); const e = 1 - Math.pow(1 - k, 3); tilt = introSkipped ? e : 1; z = CAM_OUT.z + (CAM_IN.z - CAM_OUT.z) * e; cx = CAM_OUT.x + (followX - CAM_OUT.x) * e; cy = CAM_OUT.y + (CAM_IN.y - CAM_OUT.y) * e; }
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
    const shakeK = ct < shakeUntil ? (shakeUntil - ct) / Math.max(0.001, shakeUntil - shakeStart) : 0;
    const shakeX = shakeK > 0 ? Math.sin(ct * 120 + frameNo) * shakeAmp * shakeK : 0, shakeY = shakeK > 0 ? Math.cos(ct * 97 + frameNo) * shakeAmp * 0.55 * shakeK : 0;
    ctx.save();
    ctx.translate(W / 2 + shakeX, H / 2 + shakeY); ctx.scale(cam.z, cam.z); ctx.translate(-cam.cx, -cam.cy);
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
      const rc = recoil[id], rk = rc ? Math.max(0, Math.min(1, (ct - rc.start) / rc.dur)) : 1;
      const recoilDx = rc && rk < 1 ? rc.dir * Math.sin(rk * Math.PI) * rc.dist * (1 - rk * 0.15) : 0;
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
      const winded = isAlive && ((p as { sta?: number }).sta ?? 100) < CONFIG.stamina.windedAt; // 숨이 찬 동안: 어깨를 들썩이며 몸이 조금 내려앉는다
      const breath = winded ? 1.4 + Math.sin(ct * 5.5 + id) * 1.6 : 0;
      if (a.clip.startsWith('combo') && busy && el > 120 && el < 300) { // 연속 공격: 2타의 잔상 (60ms 전 자세를 흐리게 겹쳐 그린다)
        const gs = clipSkeleton(a.clip, el - 60); ctx.save(); ctx.globalAlpha *= 0.32;
        drawStickman(ctx, u.g.type, { x: p.x + recoilDx + jx + lapDx + exitDx - face[id] * 6, y: p.y + 30 * SC + jy, scale: 1.15 * SC, facing: face[id], skeleton: gs, t: ct, team: u.side === 'A' ? myInk() : ENEMY, accessories: accessoriesOf(u.g) }); ctx.restore(); }
      drawStickman(ctx, u.g.type, { x: p.x + recoilDx + jx + lapDx + exitDx, y: p.y + 30 * SC + jy + breath, scale: 1.15 * SC, facing: face[id], skeleton: sk, t: ct, wobble: (isBound || winded) && !busy, noNet: !!netAway[id], team: u.side === 'A' ? myInk() : ENEMY, accessories: accessoriesOf(u.g) });
      if (winded && !busy) { const bx = p.x + recoilDx + lapDx + exitDx + face[id] * 18, by = p.y - 33 + breath, drift = (ct * 10 + id) % 1; ctx.save(); ctx.globalAlpha = exitAlpha * (0.34 + Math.sin(ct * 5.5 + id) * 0.12); ctx.strokeStyle = '#6e7f9b'; ctx.lineWidth = 1.3; ctx.lineCap = 'round'; for (let k = 0; k < 2; k++) { const d = (k * 5 + drift * 3) * face[id]; ctx.beginPath(); ctx.arc(bx + d, by - k * 5, 3 + k * 1.5, face[id] > 0 ? -0.9 : Math.PI - 0.9, face[id] > 0 ? 0.9 : Math.PI + 0.9); ctx.stroke(); } ctx.restore(); } // 숨참: 막대 없이도 지친 검투사를 읽게 하는 얇은 숨결
      if (exitAlpha <= 0) { ctx.globalAlpha = 1; continue; }
      ctx.globalAlpha = exitAlpha; // 퇴장(미시오 생존·승자 퇴장) 중에는 이름표·체력바도 사람과 함께 옮겨 가며 사라진다
      ctx.fillStyle = TYPE_COLOR[u.g.type]; ctx.beginPath(); ctx.arc(p.x + recoilDx - 22 + lapDx + exitDx, p.y + 40, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = u.side === 'A' ? myInk() : ENEMY; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(u.side === 'A' ? u.g.name : u.g.name.replace('(적)', ''), p.x + recoilDx + 3 + lapDx + exitDx, p.y + 44);
      const ratio = Math.max(0, hp[id]) / r.initialHp[id];
      ctx.fillStyle = '#7a6a4e'; ctx.fillRect(p.x + recoilDx - 17 + lapDx + exitDx, p.y - 56, 34, 4);
      ctx.fillStyle = ratio > 0.5 ? '#3b7a2c' : ratio > 0.25 ? '#c58a1a' : '#9b2c1c'; ctx.fillRect(p.x + recoilDx - 17 + lapDx + exitDx, p.y - 56, 34 * ratio, 4);
      { const sta = (p as { sta?: number }).sta ?? 100; if (isAlive && sta < CONFIG.stamina.windedAt) { const bx = p.x + recoilDx - 17 + lapDx + exitDx, k = sta / CONFIG.stamina.windedAt; ctx.globalAlpha = 0.75; ctx.fillStyle = '#8a7a56'; ctx.fillRect(bx, p.y - 50, 34, 1.5); ctx.fillStyle = '#6e7f9b'; ctx.fillRect(bx, p.y - 50, 34 * k, 1.5); ctx.globalAlpha = 1; } } /* 숨: 지쳤을 때만 체력 막대 밑에 가늘게 (자리만 잡아 둔 표시) */
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
      if (f.kind === 'tell') { const life = f.life ?? 0.2, k2 = 1 - f.t / life; ctx.strokeStyle = '#9b2c1c'; ctx.globalAlpha = 0.18 + k2 * 0.32; ctx.lineWidth = 1.8 + k2 * 1.2; ctx.beginPath(); ctx.arc(f.x - f.dir * 10, f.y, 18 + k2 * 8, -1.15 * f.dir + (f.dir > 0 ? 0 : Math.PI), 0.45 * f.dir + (f.dir > 0 ? 0 : Math.PI), f.dir < 0); ctx.stroke(); }
      else if (f.kind === 'slash') { const k2 = 1 - f.t / 0.28; ctx.globalAlpha = 1 - k2; ctx.lineWidth = 3 - k2 * 2; ctx.beginPath(); ctx.arc(f.x - f.dir * 8, f.y, 26 + k2 * 10, -0.9 * f.dir + (f.dir > 0 ? 0 : Math.PI), 0.5 * f.dir + (f.dir > 0 ? 0 : Math.PI), f.dir < 0); ctx.stroke(); }
      else if (f.kind === 'pierce') { const life = f.life ?? 0.24, k2 = 1 - f.t / life; ctx.strokeStyle = '#9b2c1c'; ctx.globalAlpha = 1 - k2; ctx.lineWidth = 3.4 - k2 * 2.2; ctx.beginPath(); ctx.moveTo(f.x - f.dir * (24 - k2 * 10), f.y + 3); ctx.lineTo(f.x + f.dir * (11 + k2 * 12), f.y - 3); ctx.stroke(); ctx.fillStyle = '#9b2c1c'; ctx.globalAlpha = 0.5 * (1 - k2); ctx.beginPath(); ctx.arc(f.x + f.dir * 8, f.y - 2, 3 + k2 * 3, 0, Math.PI * 2); ctx.fill(); }
      else if (f.kind === 'cleave') { const life = f.life ?? 0.3, k2 = 1 - f.t / life; ctx.strokeStyle = '#9b2c1c'; ctx.globalAlpha = 1 - k2; ctx.lineWidth = 4.2 - k2 * 2.5; ctx.beginPath(); ctx.arc(f.x - f.dir * 6, f.y - 4, 22 + k2 * 14, -1.35 * f.dir + (f.dir > 0 ? 0 : Math.PI), 0.65 * f.dir + (f.dir > 0 ? 0 : Math.PI), f.dir < 0); ctx.stroke(); ctx.strokeStyle = '#3a2412'; ctx.globalAlpha = 0.45 * (1 - k2); ctx.beginPath(); ctx.moveTo(f.x - f.dir * 4, f.y - 22); ctx.lineTo(f.x + f.dir * (8 + k2 * 10), f.y + 18); ctx.stroke(); }
      else if (f.kind === 'thrust') { const life = f.life ?? 0.34, k2 = 1 - f.t / life; ctx.strokeStyle = '#6b4a22'; ctx.globalAlpha = 0.78 * (1 - k2); ctx.lineWidth = 2.8 - k2 * 1.5; for (const o of [-4, 4]) { ctx.beginPath(); ctx.moveTo(f.x - f.dir * (34 + k2 * 8), f.y + o); ctx.lineTo(f.x + f.dir * (22 + k2 * 22), f.y + o * 0.4); ctx.stroke(); } ctx.strokeStyle = '#9b2c1c'; ctx.globalAlpha = 0.7 * (1 - k2); ctx.beginPath(); ctx.moveTo(f.x - f.dir * 8, f.y); ctx.lineTo(f.x + f.dir * (20 + k2 * 18), f.y - 2); ctx.stroke(); }
      else if (f.kind === 'dust') { const k2 = 1 - f.t / 0.5; ctx.globalAlpha = 0.6 * (1 - k2); ctx.lineWidth = 1.5; for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI + Math.PI; const rr = 8 + k2 * 22; ctx.beginPath(); ctx.arc(f.x - f.dir * 10 + Math.cos(a) * rr, f.y + Math.sin(a) * rr * 0.4, 3 + k2 * 4, 0, Math.PI * 2); ctx.stroke(); } }
      else { const life = f.life ?? 0.5, k2 = 1 - f.t / life; const u = f.id != null ? byId[f.id] : null; const cur = f.id != null ? pos[f.id] : null; // 기술 연출
        if (f.kind === 'ghost' && u && cur) { ctx.globalAlpha = 0.35 * (1 - k2); drawStickman(ctx, u.g.type, { x: cur.x - f.dir * (10 + k2 * 26), y: cur.y + 30 * SC, scale: 1.15 * SC, facing: f.dir as 1 | -1, pose: 'guard', t: 0, team: u.side === 'A' ? myInk() : ENEMY, accessories: accessoriesOf(u.g) }); }
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
    if (introText.t > 0) { // 입장 소개: 파밀리아 이름과 검투사들 (벽에 긁어 쓴 글씨처럼)
      const k = Math.min(1, (1.6 - introText.t) * 6), a = Math.min(1, introText.t * 2);
      ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.translate(W / 2, H - 92 + (1 - k) * 10); ctx.rotate(-0.02);
      ctx.fillStyle = '#9b2c1c'; ctx.font = 'bold 22px sans-serif'; ctx.fillText(introText.big, 0, 0);
      ctx.fillStyle = '#3a2412'; ctx.font = 'bold 13px sans-serif'; ctx.fillText(introText.sub, 0, 22);
      ctx.strokeStyle = '#9b2c1c'; ctx.lineWidth = 2; ctx.globalAlpha = a * 0.7; ctx.beginPath(); ctx.moveTo(-90 * k, 8); ctx.lineTo(90 * k, 8); ctx.stroke(); ctx.restore(); }
    if (intro < INTRO_ZOOM && intro > INTRO_HOLD) { ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#7a6a4e'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('두드리면 건너뜁니다', W / 2, H - 20); ctx.restore(); }
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
  const TEMPO_FAR = 1.45, TEMPO_NEAR = 0.85, REACH_PAD = 8; // 재생 속도: 아무도 칠 수 없는 빈 구간(다가가고 물러나는 동안)은 당기고, 칼이 닿는 구간은 규칙 속도로. 빠르기가 아니라 대비가 박진감을 만든다 (경기의 3분의 1이 빈 구간)
  const reachOf = (g: Gladiator) => (MAIN_HAND[equipOf(g.type).main].range >= 2 ? 95 : 48) + REACH_PAD;
  const engagedAt = (ct2: number) => { // 지금 이 순간 누군가 칠 수 있는가 (경기장 좌표)
    let i = 0; while (i < frames.length - 2 && frames[i + 1].t <= ct2) i++;
    const f = frames[i];
    for (const a of f.u) { const ua = byId[a[0]]; if (!ua || a[3] <= 0) continue;
      for (const b of f.u) { const ub = byId[b[0]]; if (!ub || b[3] <= 0 || ub.side === ua.side) continue;
        if (Math.hypot(a[1] - b[1], a[2] - b[2]) <= Math.max(reachOf(ua.g), reachOf(ub.g))) return true; } }
    return false; };
  let ct = 0, lastReal = performance.now(), done = false, doneAt = 0, lastDtReal = 0.016, frameNo = 0;
  const anim = () => {
    const now = performance.now(); const realRaw = (now - lastReal) / 1000; const real = Math.min(0.05, realRaw); lastReal = now; lastDtReal = real;
    let dt = real * (engagedAt(ct) ? TEMPO_NEAR : TEMPO_FAR);
    if (intro < INTRO_ZOOM) { intro += Math.min(0.3, realRaw); dt = 0; // 입장 동안은 경기를 멈춰 둔다
      const st2 = introSkipped ? 3 : intro < INTRO_HOLD ? 0 : intro < INTRO_LEFT ? 1 : intro < INTRO_RIGHT ? 2 : 3;
      if (st2 !== introStage) { introStage = st2; // 뚜둥 — 한쪽씩 소개하고 마지막에 가운데로
        if (st2 === 1) { introText.big = S.st.lanista.name + ' 의 파밀리아'; introText.sub = r.team.map(g => g.name).join(' · '); introText.t = 1.5; sfx.drum(1); crowdCheer = Math.max(crowdCheer, 0.8); }
        else if (st2 === 2) { introText.big = rivalName; introText.sub = r.contract.enemy.map(g => g.name.replace('(적)', '')).join(' · '); introText.t = 1.5; sfx.drum(1); crowdCheer = Math.max(crowdCheer, 0.8); }
        else if (st2 === 3) { introText.big = ''; introText.sub = ''; sfx.cheer(0.9); } }
      if (introText.t > 0) introText.t -= realRaw; } // 준비 단계: 실제 경과 시간으로 (프레임이 느려도 제때 줌인)
    else if (ct < slowUntil) dt = real * 0.25;
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
// 이 경기가 갈린 자리 한 줄. 새 규칙이 아니라 이벤트를 읽어 고른다 — 우연(헛디딤·빈틈·치명타·몸 상태)이 왜 승패가 됐는지 보이게
function comeback(r: FightReport): boolean { // 이긴 쪽이 경기 도중 크게 밀렸던가 (체력 비율 차 −0.25 아래)
  if (r.winner === 'draw') return false;
  const ids = { A: r.team.map(g => g.id), B: r.contract.enemy.map(g => g.id) };
  const init = (a: number[]) => a.reduce((s, id) => s + (r.initialHp[id] ?? 0), 0);
  const iA = init(ids.A), iB = init(ids.B); if (!iA || !iB) return false;
  let worst = 0;
  for (const f of r.frames) { const m = new Map(f.u.map(u => [u[0], u[3]]));
    const sA = ids.A.reduce((s, id) => s + Math.max(0, m.get(id) ?? 0), 0) / iA, sB = ids.B.reduce((s, id) => s + Math.max(0, m.get(id) ?? 0), 0) / iB;
    const d = r.winner === 'A' ? sA - sB : sB - sA; worst = Math.min(worst, d); }
  return worst <= -0.25;
}
function turningPoint(r: FightReport): string | null {
  const mine = new Set(r.team.map(g => g.id)), last = [...r.events].reverse().find(e => e.kind === 'attack' && e.downed);
  if (comeback(r)) return r.winner === 'A' ? '무너지기 직전에 뒤집었다.' : '이겨 가던 경기를 내주었다.';
  if (last?.open) { const n = nameOf(r, last.target!); return `${n}${ga(n)} 지쳐 헛디딘 틈이 마지막을 갈랐다.`; }
  if (last?.crit) return `${nameOf(r, last.actor)}의 깨끗한 일격이 갑주 틈을 찔렀다.`;
  const stumbles = r.events.filter(e => e.kind === 'stumble');
  if (stumbles.length) { const ours = stumbles.filter(e => mine.has(e.actor)).length; return ours > stumbles.length - ours ? '먼저 숨이 찬 쪽은 우리였다.' : '상대가 먼저 숨이 찼다.'; }
  const light = r.team.filter(g => formLabel(g) === '가벼움'), heavy = r.team.filter(g => formLabel(g) === '무거움');
  const first = r.winner === 'A' ? [light, heavy] : [heavy, light]; // 이겼으면 가벼운 쪽을, 졌으면 무거운 쪽을 먼저 말한다
  for (const list of first) if (list.length) { const g = list[0]; return `${g.name}${eun(g.name)} 오늘 몸이 ${formLabel(g) === '가벼움' ? '가벼웠다' : '무거웠다'}.`; }
  return null;
}
const nameOf = (r: FightReport, id: number) => [...r.team, ...r.contract.enemy].find(g => g.id === id)?.name.replace('(적)', '') ?? '누군가';
function renderResult() {
  const r = S.report!;
  app.replaceChildren(); app.classList.remove('fit'); app.classList.remove('land', 'plan', 'battle', 'page');
  const won = r.winner === 'A';
  const net = r.rent - r.expense + r.prize + r.compensation - (r.bet && !r.bet.won ? r.bet.amount : 0);
  const money = (label: string, v: number, sign: 1 | -1 = 1) => h('div', { class: 'mrow' }, h('span', {}, label), h('span', { class: v ? (sign > 0 ? 'plus' : 'minus') : '' }, `${sign > 0 ? '+' : '−'}${v.toLocaleString()}`));
  const bad = r.fates.filter(f => f.fate === 'dead' || f.fate === 'injured');
  const flags: Node[] = [];
  for (const f of bad) flags.push(h('span', { class: `badge ${f.fate === 'dead' ? 'dead' : 'injured'}` }, `${f.g.name} ${f.fate === 'dead' ? '사망' : '부상'}`));
  for (const g of r.rudis) { flags.push(h('span', { class: 'badge free' }, `${g.name} 루디스`)); if (g.status === 'rudiarius') flags.push(h('button', { class: 'tiny', title: '플람마처럼 자유를 물리고 노예로 남는다. 명예 +8', onclick: () => { void ask(`${g.name} 이(가) 루디스를 거절합니까? 노예로 남고 명예 +8`, { ok: '거절' }).then(ok => { if (ok) { refuseRudis(S.st, g); renderResult(); } }); } }, '거절')); }
  for (const g of r.promoted) flags.push(h('span', { class: 'badge promo' }, `${g.name} 승급`));
  for (const ne of r.newEpithets) flags.push(h('span', { class: 'badge epithet', title: `${ne.e.cond} → ${ne.e.effect}` }, `${ne.g.name} '${ne.e.name}'`));
  const title = won ? '승리' : r.winner === 'draw' ? '무승부' : '패배';
  const tp = turningPoint(r);
  app.append(h('div', { class: 'panel result' }, // 팝업이 아니라 편성·정산처럼 한 페이지
    h('h2', { style: `color:${won ? 'var(--ok)' : r.winner === 'draw' ? 'var(--dim)' : 'var(--red)'}` }, title, h('span', { class: 'hint', style: 'margin-left:10px;font-weight:400' }, `${r.contract.size}대${r.contract.size} · ${r.duration.toFixed(1)}초${r.classic ? ' · 전통 짝' : ''}`)),
    tp ? h('div', { class: 'hint turning' }, tp) : null,
    h('div', { class: 'resultbrief' },
      h('div', { class: 'scoreline' }, h('span', {}, '이번 경기'), h('b', { class: net >= 0 ? 'plus' : 'minus' }, `${net >= 0 ? '+' : '−'}${Math.abs(net).toLocaleString()} HS`), h('span', { class: r.fameDelta >= 0 ? 'plus' : 'minus' }, `호감도 ${r.fameDelta >= 0 ? '+' : ''}${r.fameDelta}`)),
      flags.length ? h('div', { class: 'flagline' }, ...flags) : h('div', { class: 'flagline' }, h('span', { class: 'badge ok' }, '우리 파밀리아 무사'))),
    h('details', { class: 'quickdetail' }, h('summary', { class: 'hint' }, '이번 경기 수지 보기'), h('div', { class: 'mtable' }, money('대여료', r.rent), money('출전 경비', r.expense, -1), money(r.bet?.won ? '승리 상금 (내기 ×2)' : '승리 상금', r.prize), r.guestGift ? money('귀족 사례금', r.guestGift) : null, money('사망 배상금', r.compensation), r.salary ? money('자유민 급료', r.salary, -1) : null, r.bet && !r.bet.won ? money('내기 패배', r.bet.amount, -1) : null,
      h('div', { class: 'mrow total' }, h('span', {}, '수지'), h('span', { class: net >= 0 ? 'plus' : 'minus' }, `${net >= 0 ? '+' : '−'}${Math.abs(net).toLocaleString()} HS`)))),
  ));
  app.prepend(headerEl()); window.scrollTo(0, 0);
  const needsChoice = r.rudis.some(g => g.status === 'rudiarius');
  const advance = () => { if (S.phase !== 'result' || S.report !== r) return; S.phase = 'battle'; nextFight(); };
  app.append(S.queue.length ? graffitiBtn('duel', 'SEQVENS', `다음 경기 (${S.queue.length}경기 남음)`, advance, S.queue.length) : graffitiBtn('coins', 'RATIONES', '시즌 정산으로', advance)); app.classList.add('land', 'page', 'gf'); // 결과도 무대 안: 아래 띠 자리에 낙서 그림 버튼 (다음 경기 = 결투 SEQVENS, 정산 = 동전 더미 RATIONES)
  if (!needsChoice) window.setTimeout(advance, flags.length ? 3200 : 2200); // 짧은 결과는 보고만 지나간다. 루디스 거절처럼 즉시 선택이 있으면 자동 넘김을 멈춘다.
}
