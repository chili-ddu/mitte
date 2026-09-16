// 스틱맨 초상 캔버스와 대화 장면 루프 (Codex: 그림)
import { S, myInk, myLight } from './state.js';
import { type GType, type Gladiator } from '../core/types.js';
import { ENEMY, INK, drawStickman, type Pose, type Skeleton, walkSkeleton } from './stickman.js';
import { accessoriesOf } from '../core/epithets.js';
import { sfx } from './sound.js';
import { drawTalkScene } from './detail.js';

export const TYPE_COLOR: Record<GType, string> = { murmillo: '#2c4f9b', secutor: '#1f7a6d', thraex: '#9b2c1c', retiarius: '#c58a1a', hoplomachus: '#5a7a2c', provocator: '#6b4a8a', eques: '#b5651d', dimachaerus: '#4a4a4a' };
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
export function glyphSvg(t: GType, size = 22) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', String(size)); svg.setAttribute('height', String(size));
  for (const d of TYPE_GLYPH[t]) { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); p.setAttribute('fill', 'none'); p.setAttribute('stroke', '#fff'); p.setAttribute('stroke-width', '2'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); svg.append(p); }
  return svg;
}
export function drawGlyph(ctx: CanvasRenderingContext2D, t: GType, x: number, y: number, size: number) {
  ctx.save(); ctx.translate(x - size / 2, y - size / 2); ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const d of TYPE_GLYPH[t]) ctx.stroke(new Path2D(d));
  ctx.restore();
}
// ── 스틱맨 초상: 작은 캔버스에 장비 갖춘 스틱맨. 살아 움직이는 초상들은 공용 루프가 갱신
export const portraits = new Set<{ c: HTMLCanvasElement; g: Gladiator; pose: 'idle' | 'sit'; enemy?: boolean; enter?: number; lastStep?: number; fixed?: { pose?: Pose; skeleton?: Skeleton } }>();
export function portrait(g: Gladiator, size = 64, enemy = false, fixed?: { pose?: Pose; skeleton?: Skeleton }, hgt = size) { // fixed: 결과 화면처럼 정해진 자세(승리·패배·시신)로 그린다. hgt: 세로가 더 긴 초상(상세)은 폭·높이를 따로
  const c = document.createElement('canvas'); c.width = size * devicePixelRatio; c.height = hgt * devicePixelRatio; c.style.width = size + 'px'; c.style.height = hgt + 'px'; c.className = 'portrait';
  const entry = { c, g, pose: (g.injured ? 'sit' : 'idle') as 'idle' | 'sit', enemy, enter: 0, lastStep: -1, fixed }; // enter: 걸어 들어오는 연출 시작 시각(0 이면 없음)
  portraits.add(entry); drawPortrait(entry, 0);
  return c;
}
function drawPortrait(e: { c: HTMLCanvasElement; g: Gladiator; pose: 'idle' | 'sit'; enemy?: boolean; enter?: number; lastStep?: number; fixed?: { pose?: Pose; skeleton?: Skeleton } }, t: number) {
  const ctx = e.c.getContext('2d')!; const W = e.c.width / devicePixelRatio, S = e.c.height / devicePixelRatio; // S: 높이 (인물 크기·발 위치 기준), W: 폭 (가운데 맞춤)
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); ctx.clearRect(0, 0, W, S);
  ctx.fillStyle = '#e3d3a6'; ctx.fillRect(0, 0, W, S); ctx.fillStyle = '#cbb67f'; ctx.fillRect(0, S - 8, W, 8);
  const team = e.enemy ? ENEMY : e.g.rank === 'veteranus' ? myInk() : myLight();
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
export function startPortraitLoop() {
  if (S.portraitLoop) return; S.portraitLoop = true;
  const tick = () => { const t = performance.now() / 1000; for (const e of portraits) { if (!e.c.isConnected) { portraits.delete(e); continue; } drawPortrait(e, t); } for (const e of talkScenes) { if (!e.c.isConnected) { talkScenes.delete(e); continue; } drawTalkScene(e, t); } requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
// 매각·내보내기·구매 확인: 검투사와 라니스타가 마주 서서 주고받는 대화 장면. 말풍선이 차례로 뜨고, 아래에 '· ' 효과 줄과 확인 버튼
export const talkScenes = new Set<{ c: HTMLCanvasElement; g: Gladiator; start: number; what: 'sell' | 'release' | 'buy' | 'heal'; healed?: number }>();
