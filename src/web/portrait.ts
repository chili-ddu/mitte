// 스틱맨 초상 캔버스와 대화 장면 루프 (Codex: 그림)
import { S, myInk, myLight, rivalInkOf } from './state.js';
import { type GType, type Gladiator } from '../core/types.js';
import { INK, drawStickman, type Pose, type Skeleton, walkSkeleton } from './stickman.js';
import { accessoriesOf, type EpithetAccessory } from '../core/epithets.js';
const accOf = (g: Gladiator, mood?: 'grudge' | 'revenge'): EpithetAccessory[] => [...accessoriesOf(g), ...(mood ? [mood] : []), ...(g.status === 'doctor' ? ['staff' as const] : []), ...(g.status === 'rudiarius' ? ['rudis' as const] : [])]; // 신분이 옷차림에 드러난다: 독토르의 훈련 막대, 자유민의 나무 검
import { sfx } from './sound.js';
import { drawTalkScene } from './detail.js';

// 계보 색: 카드 배경 무늬(style.css 의 .linbg)와 같은 안료. 스틱맨 뒤 흙에도 이 색이 돈다 (2026-09-17 사용자)
export const LINEAGE_COLOR: Record<string, string> = { nature: '#2f6a22', victory: '#b08a3a', myth: '#7a2a6a', nickname: '#4a5a78', place: '#7a4a3a' };
export const TYPE_COLOR: Record<GType, string> = { murmillo: '#2c4f9b', secutor: '#1f7a6d', thraex: '#9b2c1c', retiarius: '#c58a1a', hoplomachus: '#5a7a2c', provocator: '#6b4a8a', eques: '#b5651d', dimachaerus: '#4a4a4a', scissor: '#2f6f8f', laquearius: '#a3652a' };
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
  scissor:     ['M17 3v14', 'M14.5 17h5', 'M6 6v8', 'M6 14c0 4 3 5 5 3'],            // 글라디우스 + 팔 관 끝의 반달 날
  laquearius:  ['M9 21V4', 'M7 6l2-3 2 3', 'M17 12a3.5 3.5 0 1 0 0 .01', 'M17 15.5v5'], // 창 + 올가미 고리
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
// 인연이 있는 초상은 가만히 서 있지 않는다 — 복수는 이따금 허공을 베고, 원한은 칼을 들썩이며 노려본다 (2026-09-17 사용자)
function moodPose(mood: 'grudge' | 'revenge', t: number, seed: number): Pose {
  const c = (t * 0.85 + seed * 0.7) % 4.4; // 검투사마다 박자를 어긋나게 (한 줄이 한꺼번에 움직이면 기계 같다)
  if (mood === 'revenge') return c < 3.2 ? 'guard' : c < 3.5 ? 'windup' : c < 3.8 ? 'swing' : c < 4.1 ? 'recover' : 'guard';
  return c < 3.4 ? 'guard' : c < 3.9 ? 'windup' : 'guard';
}
// ── 스틱맨 초상: 작은 캔버스에 장비 갖춘 스틱맨. 살아 움직이는 초상들은 공용 루프가 갱신
export const portraits = new Set<{ c: HTMLCanvasElement; g: Gladiator; pose: 'idle' | 'sit'; enemy?: boolean; enter?: number; lastStep?: number; fixed?: { pose?: Pose; skeleton?: Skeleton }; mood?: 'grudge' | 'revenge' }>();
export function portrait(g: Gladiator, size = 64, enemy = false, fixed?: { pose?: Pose; skeleton?: Skeleton }, hgt = size, bare = false, mood?: 'grudge' | 'revenge') { // mood: 이번 상대와 인연이 있다 — 경계 자세로 서고 원한은 그늘이, 복수는 붉은 눈빛이 돈다 (2026-09-17 사용자) // bare: 배경 판 없이 (상세 화면 — 낙서가 종이에 바로 그려진 느낌) // fixed: 결과 화면처럼 정해진 자세(승리·패배·시신)로 그린다. hgt: 세로가 더 긴 초상(상세)은 폭·높이를 따로
  const c = document.createElement('canvas'); c.width = size * devicePixelRatio; c.height = hgt * devicePixelRatio; c.style.width = size + 'px'; c.style.height = hgt + 'px'; c.className = 'portrait';
  const entry = { c, g, pose: (g.injured ? 'sit' : 'idle') as 'idle' | 'sit', enemy, enter: 0, lastStep: -1, fixed, bare, mood }; // enter: 걸어 들어오는 연출 시작 시각(0 이면 없음)
  portraits.add(entry); drawPortrait(entry, 0);
  return c;
}
const hexA = (hex: string, a: number) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`; // #rrggbb → rgba
function drawPortrait(e: { c: HTMLCanvasElement; g: Gladiator; pose: 'idle' | 'sit'; enemy?: boolean; enter?: number; lastStep?: number; fixed?: { pose?: Pose; skeleton?: Skeleton }; bare?: boolean; mood?: 'grudge' | 'revenge' }, t: number) {
  const ctx = e.c.getContext('2d')!; const W = e.c.width / devicePixelRatio, S = e.c.height / devicePixelRatio; // S: 높이 (인물 크기·발 위치 기준), W: 폭 (가운데 맞춤)
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); ctx.clearRect(0, 0, W, S);
  if (e.bare) { ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = '#6b4a22'; ctx.beginPath(); ctx.ellipse(W / 2, S - 6, W * 0.26, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); } // 배경 판 없이 발밑 그림자만
  else { // 배경 판에 테두리가 없다: 가운데만 진하고 가장자리로 갈수록 투명해져 카드 바닥에 녹는다 (2026-09-17 사용자: 선의 구분이 없는 느낌)
    const halo = ctx.createRadialGradient(W / 2, S * 0.48, S * 0.08, W / 2, S * 0.48, S * 0.62);
    halo.addColorStop(0, 'rgba(216,197,150,.85)'); halo.addColorStop(0.55, 'rgba(216,197,150,.45)'); halo.addColorStop(1, 'rgba(216,197,150,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, W, S);
    const tint = LINEAGE_COLOR[e.g.lineage] ?? '#6b4a22'; // 계보의 안료가 뒤 흙에 섞인다
    const lin = ctx.createRadialGradient(W / 2, S * 0.5, S * 0.06, W / 2, S * 0.5, S * 0.6);
    lin.addColorStop(0, hexA(tint, 0.2)); lin.addColorStop(0.6, hexA(tint, 0.1)); lin.addColorStop(1, hexA(tint, 0));
    ctx.fillStyle = lin; ctx.fillRect(0, 0, W, S);
    const floor = ctx.createRadialGradient(W / 2, S - 7, 1, W / 2, S - 7, W * 0.42); // 발밑 그늘도 번지게 — 바닥 선을 긋지 않는다
    floor.addColorStop(0, hexA(tint, 0.3)); floor.addColorStop(1, hexA(tint, 0)); /* 발밑 그늘도 같은 안료로 */
    ctx.save(); ctx.translate(0, 0); ctx.scale(1, 0.34); ctx.fillStyle = floor; ctx.fillRect(0, (S - 7) / 0.34 - W * 0.42, W, W * 0.84); ctx.restore(); }
  const team = e.enemy ? rivalInkOf(e.g) : e.g.rank === 'veteranus' ? myInk() : myLight();
  const sc0 = 0.68 * (S / 64); // 초상 크기에 비례 (상세 페이지의 큰 초상은 2배 이상)
  const ENTER = 1.1; const el = e.enter ? (performance.now() - e.enter) / 1000 : ENTER; // 걸어 들어오기: 왼쪽 밖에서 가운데까지 1.1초
  if (el < ENTER) { const k = el / ENTER, ease = 1 - Math.pow(1 - k, 2); const x = -30 * sc0 + (W / 2 - 2 + 30 * sc0) * ease; const walk = walkSkeleton(el * 9, 1);
    drawStickman(ctx, e.g.type, { x, y: S - 6, scale: sc0, skeleton: walk, t, team, accessories: accOf(e.g, e.mood), facing: 1 });
    const stepNo = Math.floor(el * 4.5); if (stepNo !== e.lastStep) { e.lastStep = stepNo; if (stepNo > 0) sfx.step(); } return; } // 발소리 (반 걸음마다)
  if (e.fixed) { const sc = sc0 * 0.82; const dx = e.fixed.skeleton ? W * 0.22 : 0; drawStickman(ctx, e.g.type, { x: W / 2 - 2 + dx, y: S - 8, scale: sc, pose: e.fixed.pose, skeleton: e.fixed.skeleton, t, team, accessories: accOf(e.g, e.mood) }); return; } // 정해진 자세 (결과 화면): 조금 작게, 시신은 왼쪽으로 눕는 만큼 오른쪽으로 밀어 틀 안에
  drawStickman(ctx, e.g.type, { x: W / 2 - 2, y: S - 6, scale: sc0, pose: e.mood ? moodPose(e.mood, t, e.g.id) : 'idle', t, team, accessories: accOf(e.g, e.mood) }); // 투구 볏이 잘리지 않게
  if (e.pose === 'sit') { // 치료 중: 장비 상태 그대로, 팔에 감은 붕대만. 모서리의 ✕ 배지는 뺐다 — 부상은 카드의 린넨 표식이 말한다 (2026-09-17 사용자)
    const sc = sc0, ax = S / 2 - 2 + 6 * sc, ay = S - 6 - 34 * sc; // 앞팔 위팔 근처
    ctx.strokeStyle = '#f3ead0'; ctx.lineWidth = 3; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(ax - 4, ay - 1); ctx.lineTo(ax + 4, ay + 2); ctx.moveTo(ax - 4, ay + 3); ctx.lineTo(ax + 4, ay + 6); ctx.stroke();
    ctx.strokeStyle = '#9b2c1c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax - 4, ay - 1); ctx.lineTo(ax + 4, ay + 2); ctx.moveTo(ax - 4, ay + 3); ctx.lineTo(ax + 4, ay + 6); ctx.stroke();
  }
}
export function startPortraitLoop() {
  if (S.portraitLoop) return; S.portraitLoop = true;
  const tick = () => { const t = performance.now() / 1000; for (const e of portraits) { if (!e.c.isConnected) { portraits.delete(e); continue; } drawPortrait(e, t); } for (const e of talkScenes) { if (!e.c.isConnected) { talkScenes.delete(e); continue; } drawTalkScene(e, t); } requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
// 매각·내보내기·구매 확인: 검투사와 라니스타가 마주 서서 주고받는 대화 장면. 말풍선이 차례로 뜨고, 아래에 '· ' 효과 줄과 확인 버튼
export const talkScenes = new Set<{ c: HTMLCanvasElement; g: Gladiator; start: number; what: 'sell' | 'release' | 'buy' | 'heal'; healed?: number }>();
