// 스틱맨 초상 캔버스와 대화 장면 루프 (Codex: 그림)
import { S, myInk, rivalInkOf } from './state.js';
import { talentOf } from '../core/talent.js';
import { type MainHand, type OffHand } from '../core/equipment.js';
import { type GType, type Gladiator } from '../core/types.js';
import { drawStickman, drawHorse, type Pose, type Skeleton, walkSkeleton } from './stickman.js';
import { accessoriesOf, type EpithetAccessory } from '../core/epithets.js';
const accOf = (g: Gladiator, mood?: 'grudge' | 'revenge'): EpithetAccessory[] => [...accessoriesOf(g), ...(mood ? [mood] : []), ...(g.status === 'doctor' ? ['staff' as const] : []), ...(g.status === 'rudiarius' ? ['rudis' as const] : [])]; // 신분이 옷차림에 드러난다: 독토르의 훈련 막대, 자유민의 나무 검
import { sfx } from './sound.js';
import { drawTalkScene } from './detail.js';

// 계보 색: 카드 배경 무늬(style.css 의 .linbg)와 같은 안료. 스틱맨 뒤 흙에도 이 색이 돈다 (2026-09-17 사용자)
export const TALENT_SOIL = ['222,204,158', '190,140,58', '150,30,28', '236,188,40'] as const; // 자질별 뒤 바탕 (r,g,b) — 2026-09-22 사용자: 평범 연한 황토 · 재능 진한 황토 · 비범 핏빛 · 천부 금빛
export const TYPE_COLOR: Record<GType, string> = { murmillo: '#2c4f9b', secutor: '#1f7a6d', thraex: '#9b2c1c', retiarius: '#c58a1a', hoplomachus: '#5a7a2c', provocator: '#6b4a8a', eques: '#b5651d', dimachaerus: '#4a4a4a', scissor: '#2f6f8f', laquearius: '#a3652a' };
// 24x24 좌표계의 무기 도형. 카드(SVG)와 전투 화면(Canvas Path2D)이 공유
const TYPE_GLYPH: Record<GType, string[]> = {
  murmillo:  ['M5 4h8v11l-4 4-4-4z', 'M18 3v13', 'M15.5 16h5'],                 // 큰 방패 + 글라디우스
  secutor:   ['M12 4a6 6 0 0 1 6 6v9H6v-9a6 6 0 0 1 6-6z', 'M9.5 11h1.5', 'M13 11h1.5'], // 매끈한 투구 + 눈구멍
  thraex:    ['M8 20c-1-7 3-13 10-15', 'M18 5l-3 .5', 'M7 5.5a3 3 0 1 0 0 .01'],   // 시카(곡도) + 작은 방패
  retiarius: ['M12 21V8', 'M7 3v5a5 5 0 0 0 10 0V3', 'M12 3v5'],                  // 삼지창
  hoplomachus: ['M15 21L15 4', 'M13 6l2-3 2 3', 'M8 13a4 4 0 1 0 0 .01'],           // 창 + 둥근 방패
  provocator:  ['M6 5h9v9l-4.5 4L6 14z', 'M18 4v14', 'M15.5 17h5'],                 // 중형 방패 + 글라디우스
  eques:       ['M17 21V5', 'M15 7l2-3 2 3', 'M3 19v-5c0-4 3-7 6-7l3 2-1 3-2 1v6', 'M8 7l1-2.5'], // 창 + 말 머리(귀 하나) — 깃털은 안 읽혔다 (2026-09-22 사용자)
  dimachaerus: ['M6 20c-1-7 3-13 10-15', 'M18 20c1-7-3-13-10-15'],                  // 시카 둘 교차
  scissor:     ['M17 3v14', 'M14.5 17h5', 'M6 6v8', 'M6 14c0 4 3 5 5 3'],            // 글라디우스 + 팔 관 끝의 반달 날
  laquearius:  ['M9 21V4', 'M7 6l2-3 2 3', 'M17 12a3.5 3.5 0 1 0 0 .01', 'M17 15.5v5'], // 창 + 올가미 고리
};
// 장비 아이콘 (2026-09-22 사용자: 유형 아이콘 = 주장비 + 보조장비): 24 상자, 흰 선
export const GEAR_GLYPH: Record<MainHand | OffHand, string[]> = { /* 2026-09-22 사용자: 더 직관적으로 — 실루엣이 한눈에 읽히게 */
  gladius: ['M12 3l2.5 3v9h-5V6z', 'M8 15h8', 'M12 15v3', 'M10.5 20h3'],                 // 곧은 양날 칼: 날 폭 + 십자 날밑 + 손잡이 + 칼자루 끝
  sica:    ['M7 20c0-6 2-11 8-15', 'M15 5c2 1 3 3 2 5', 'M7 20l2 1'],                    // 안으로 굽은 낫칼 + 손잡이
  spear:   ['M12 22V7', 'M12 2l3 5h-6z', 'M10.5 12h3'],                                    // 긴 자루 + 잎날 + 감은 끈
  trident: ['M12 22V9', 'M6 3v4a6 6 0 0 0 12 0V3', 'M12 3v7', 'M9 13h6'],                 // 세 갈래 + 자루 + 고정 띠
  scutum:  ['M6 3h12v11c0 4-3 6-6 7-3-1-6-3-6-7z', 'M12 3v18', 'M12 11m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0'], // 큰 직사각 방패: 등뼈 + 방패심
  parmula: ['M7 5h10v9c0 3-2 4-5 5-3-1-5-2-5-5z', 'M12 10m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0'],   // 작은 각진 방패 + 방패심
  parma:   ['M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0', 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0'],  // 둥근 방패 + 방패심
  medium:  ['M5 4h14v10c0 4-4 6-7 7-3-1-7-3-7-7z', 'M12 4v17'],                            // 중형 직사각 방패 + 등뼈
  net:     ['M4 12c0-4 4-8 8-8s8 4 8 8-4 8-8 8-8-4-8-8z', 'M6 8l12 8', 'M18 8L6 16', 'M12 4v16', 'M4 12h16', 'M12 20l-3 3', 'M12 20l3 3'], // 둥근 그물 + 추 끈
  blade:   ['M17 20c0-6-2-11-8-15', 'M9 5c-2 1-3 3-2 5', 'M17 20l-2 1'],                   // 둘째 낫칼 (왼손, 반대 방향)
  armblade: ['M8 3v10', 'M8 13c0 5 4 7 8 5', 'M11 3h-6', 'M5 3v10'],                       // 팔 관(두 줄) 끝의 반달 날
  lasso:   ['M14 8m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0', 'M10 11l-5 10', 'M9 13l-4 8'],     // 올가미 고리 + 늘어진 줄 둘
  none:    ['M8 13V7', 'M11 12V5', 'M14 12V6', 'M17 13V8', 'M8 13c0 6 9 6 9 0', 'M8 13l-2 3'], // 펼친 손 (맨손)
};
export function gearSvg(kind: MainHand | OffHand, size = 18) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', String(size)); svg.setAttribute('height', String(size));
  for (const d of GEAR_GLYPH[kind]) { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); p.setAttribute('fill', 'none'); p.setAttribute('stroke', '#fff'); p.setAttribute('stroke-width', '2'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); svg.append(p); }
  return svg;
}
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
export const portraits = new Set<{ c: HTMLCanvasElement; g: Gladiator; pose: 'idle' | 'sit'; enemy?: boolean; enter?: number; lastStep?: number; fixed?: { pose?: Pose; skeleton?: Skeleton }; mood?: 'grudge' | 'revenge'; figure?: number }>();
export function portrait(g: Gladiator, size = 64, enemy = false, fixed?: { pose?: Pose; skeleton?: Skeleton }, hgt = size, bare = false, mood?: 'grudge' | 'revenge', figure = 1) { /* figure: 검투사만 키우는 배율 — 흙 바탕은 그대로 (2026-09-22 사용자) */ // mood: 이번 상대와 인연이 있다 — 경계 자세로 서고 원한은 그늘이, 복수는 붉은 눈빛이 돈다 (2026-09-17 사용자) // bare: 배경 판 없이 (상세 화면 — 낙서가 종이에 바로 그려진 느낌) // fixed: 결과 화면처럼 정해진 자세(승리·패배·시신)로 그린다. hgt: 세로가 더 긴 초상(상세)은 폭·높이를 따로
  const c = document.createElement('canvas'); c.width = size * devicePixelRatio; c.height = hgt * devicePixelRatio; c.style.width = size + 'px'; c.style.height = hgt + 'px'; c.className = 'portrait';
  const entry = { c, g, pose: (g.injured ? 'sit' : 'idle') as 'idle' | 'sit', enemy, enter: 0, lastStep: -1, fixed, bare, mood, figure }; // enter: 걸어 들어오는 연출 시작 시각(0 이면 없음)
  portraits.add(entry); drawPortrait(entry, 0);
  return c;
}
const hexA = (hex: string, a: number) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`; // #rrggbb → rgba
function drawPortrait(e: { c: HTMLCanvasElement; g: Gladiator; pose: 'idle' | 'sit'; enemy?: boolean; enter?: number; lastStep?: number; fixed?: { pose?: Pose; skeleton?: Skeleton }; bare?: boolean; mood?: 'grudge' | 'revenge'; figure?: number }, t: number) {
  const ctx = e.c.getContext('2d')!; const W = e.c.width / devicePixelRatio, S = e.c.height / devicePixelRatio; // S: 높이 (인물 크기·발 위치 기준), W: 폭 (가운데 맞춤)
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); ctx.clearRect(0, 0, W, S);
  if (e.bare) { ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = '#6b4a22'; ctx.beginPath(); ctx.ellipse(W / 2, S - 6, W * 0.26, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); } // 배경 판 없이 발밑 그림자만
  else { // 배경 판에 테두리가 없다: 가운데만 진하고 가장자리로 갈수록 투명해져 카드 바닥에 녹는다 (2026-09-17 사용자: 선의 구분이 없는 느낌)
    const soil = TALENT_SOIL[talentOf(e.g)]; /* 뒤 흙빛이 자질을 말한다 (2026-09-22 사용자: 전적 줄의 자질 칩 대신) — 평범 모래 · 재능 황토 · 비범 붉은 흙 · 천부 금빛 */
    const HS = Math.min(S, 84); /* 흙 바탕은 84 크기까지만 — 상세의 넘치는 큰 초상에서 흙까지 커지지 않게, 더 작게 (2026-09-22 사용자) */
    const halo = ctx.createRadialGradient(W / 2, S - HS * 0.52, HS * 0.08, W / 2, S - HS * 0.52, HS * 0.62);
    halo.addColorStop(0, `rgba(${soil},.88)`); halo.addColorStop(0.55, `rgba(${soil},.48)`); halo.addColorStop(1, `rgba(${soil},0)`);
    ctx.fillStyle = halo; ctx.fillRect(0, 0, W, S);
    const tint = '#6b4a22'; /* 계보 안료 얼룩은 뺐다 — 캔버스 전체에 옅게 깔려 네모 경계가 비쳤다 (2026-09-22 사용자). 계보는 카드의 문양(.linbg)이 말한다. 발밑 그늘만 흙빛 */
    const floor = ctx.createRadialGradient(W / 2, S - 7, 1, W / 2, S - 7, W * 0.42); // 발밑 그늘도 번지게 — 바닥 선을 긋지 않는다
    floor.addColorStop(0, hexA(tint, 0.3)); floor.addColorStop(1, hexA(tint, 0)); /* 발밑 그늘도 같은 안료로 */
    ctx.save(); ctx.translate(0, 0); ctx.scale(1, 0.34); ctx.fillStyle = floor; ctx.fillRect(0, (S - 7) / 0.34 - W * 0.42, W, W * 0.84); ctx.restore(); }
  const team = e.enemy ? rivalInkOf(e.g) : myInk();
  const sc0 = 0.68 * (S / 64) * (e.figure ?? 1); // 초상 크기에 비례. 유형에 따라 비율을 달리하지 않는다 — 기본 스틱맨은 같고 장비만 덧그린다 (2026-09-22 사용자). 창끝은 상세 캔버스를 위로 늘려(176) 담고, 작은 카드에선 잘려도 둔다
  const ENTER = 1.1; const el = e.enter ? (performance.now() - e.enter) / 1000 : ENTER; // 걸어 들어오기: 왼쪽 밖에서 가운데까지 1.1초
  if (el < ENTER) { const k = el / ENTER, ease = 1 - Math.pow(1 - k, 2); const x = -30 * sc0 + (W / 2 - 2 + 30 * sc0) * ease; const walk = walkSkeleton(el * 9, 1);
    if (e.g.type === 'eques' && !e.g.injured) { ctx.save(); ctx.globalAlpha = 0.85; drawHorse(ctx, x - 8 * sc0, S - 6, sc0 * 0.95, 1, el, team, 'walk'); ctx.restore(); } /* 말은 검투사 뒤(왼쪽)에서 고삐에 끌려 같이 걸어 들어온다 (2026-09-22 사용자) */
    drawStickman(ctx, e.g.type, { x, y: S - 6, scale: sc0, skeleton: walk, t, team, accessories: accOf(e.g, e.mood), facing: 1 });
    const stepNo = Math.floor(el * 4.5); if (stepNo !== e.lastStep) { e.lastStep = stepNo; if (stepNo > 0) sfx.step(); } return; } // 발소리 (반 걸음마다)
  if (e.fixed) { const sc = sc0 * 0.82; const dx = e.fixed.skeleton ? W * 0.22 : 0; drawStickman(ctx, e.g.type, { x: W / 2 - 2 + dx, y: S - 8, scale: sc, pose: e.fixed.pose, skeleton: e.fixed.skeleton, t, team, accessories: accOf(e.g, e.mood) }); return; } // 정해진 자세 (결과 화면): 조금 작게, 시신은 왼쪽으로 눕는 만큼 오른쪽으로 밀어 틀 안에
  if (e.g.type === 'eques' && !e.g.injured) { ctx.save(); ctx.globalAlpha = 0.85; drawHorse(ctx, W / 2 - 2 - 8 * sc0, S - 6, sc0 * 0.95, 1, t, team, 'stand'); ctx.restore(); } /* 걸어 들어온 자리에 그대로, 머리는 오른쪽 (2026-09-22 사용자) — 작은 카드(52)에도 그린다 (사용자: 카드에도 말) */ /* 결투장과 같은 크기 — 캔버스 밖으로 잘려도 그대로 (2026-09-22 사용자: 강아지 같다) */ /* 에퀘스는 말을 뒤에 끌고 온다 — 큰 초상에서만, 서 있는 말 (2026-09-22 사용자 ㅋㅋ) */
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
export const talkScenes = new Set<{ c: HTMLCanvasElement; g: Gladiator; start: number; what: 'sell' | 'release' | 'buy' }>();
