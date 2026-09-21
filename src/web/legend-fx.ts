// 전설의 순간 — 인물마다 다른 연출 (2026-09-22 사용자: "각자 고유 연출이 있었으면, 엄청 화려하게").
// battle.ts 가 `dictata: 'L_<id>'` 이벤트를 내면 battle-view 가 슬로모션·줌·함성과 함께 여기를 2.4초 튼다. 월드 좌표(카메라 안)에서 그린다. 순수 연출 — Math.random 은 안 쓰고 hash 로 흔든다.
import type { GType } from '../core/types.js';
import { drawStickman } from './stickman.js';
const hash01 = (a: number, b: number) => { const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return h - Math.floor(h); };
const ease = (k: number) => 1 - Math.pow(1 - k, 3);
const GOLD = '#e8c96a', GOLD2 = '#f7e3a1', RED = '#a8321f', INK = '#3a2412';
export interface BurstArgs { legend: string; type: GType; x: number; y: number; k: number; face: 1 | -1; seed: number; t: number; team: string }
// k: 0 → 1 (2.4초), t: 경기 시각(흔들림용)
export function drawLegendBurst(ctx: CanvasRenderingContext2D, a: BurstArgs) {
  const { x, y, k, seed, t, face } = a; const fade = k < 0.15 ? k / 0.15 : k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
  ctx.save();
  // 공통: 발밑 황금 원 + 빛기둥 (모든 전설)
  { const g = ctx.createRadialGradient(x, y + 30, 2, x, y + 30, 70); g.addColorStop(0, `rgba(247,227,161,${0.5 * fade})`); g.addColorStop(1, 'rgba(247,227,161,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y + 30, 70, 22, 0, 0, Math.PI * 2); ctx.fill();
    const up = ease(Math.min(1, k * 2.5)); ctx.globalAlpha = 0.28 * fade; ctx.fillStyle = GOLD2; ctx.beginPath(); ctx.moveTo(x - 26, y + 30); ctx.lineTo(x - 14, y + 30 - 220 * up); ctx.lineTo(x + 14, y + 30 - 220 * up); ctx.lineTo(x + 26, y + 30); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
  switch (a.legend) {
    case 'flamma': { // 불꽃: 몸을 감싸는 불길과 위로 흩어지는 불티
      const g = ctx.createRadialGradient(x, y - 10, 4, x, y - 10, 60); g.addColorStop(0, `rgba(255,170,40,${0.45 * fade})`); g.addColorStop(1, 'rgba(255,90,20,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 10, 60, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 26; i++) { const h0 = hash01(seed + i, 1), h1 = hash01(seed + i, 2); const ang = h0 * Math.PI * 2; const bx = x + Math.cos(ang) * (14 + h1 * 12), by = y + 30 - h1 * 6; const hgt = (26 + h0 * 40) * (0.6 + 0.4 * Math.sin(t * 11 + i)); const sway = Math.sin(t * 9 + i * 1.7) * 6;
        ctx.globalAlpha = 0.85 * fade; ctx.fillStyle = i % 3 ? '#ff8a1f' : '#ffd23f'; ctx.beginPath(); ctx.moveTo(bx - 5, by); ctx.quadraticCurveTo(bx - 7 + sway, by - hgt * 0.5, bx + sway * 1.4, by - hgt); ctx.quadraticCurveTo(bx + 7 + sway, by - hgt * 0.5, bx + 5, by); ctx.closePath(); ctx.fill(); }
      for (let i = 0; i < 40; i++) { const h0 = hash01(seed + i, 3), h1 = hash01(seed + i, 4); const life = (k * 1.6 + h1) % 1; const ex = x + (h0 - 0.5) * 90 + Math.sin(t * 5 + i) * 8, ey = y + 30 - life * 150; ctx.globalAlpha = (1 - life) * fade; ctx.fillStyle = h0 > 0.5 ? '#ffd23f' : '#ff6a1f'; ctx.beginPath(); ctx.arc(ex, ey, 1.2 + h1 * 1.8, 0, Math.PI * 2); ctx.fill(); }
      break; }
    case 'spiculus': { // 황제의 방패: 황금 반구가 솟고 테두리를 빛이 돈다
      const r = 62 * ease(Math.min(1, k * 2)); ctx.globalAlpha = 0.22 * fade; const g = ctx.createRadialGradient(x, y + 10, r * 0.2, x, y + 10, r); g.addColorStop(0, 'rgba(247,227,161,0.1)'); g.addColorStop(1, 'rgba(232,201,106,0.6)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y + 10, r, r * 1.05, 0, Math.PI, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.9 * fade; ctx.strokeStyle = GOLD; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.ellipse(x, y + 10, r, r * 1.05, 0, Math.PI, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y + 10, r, r * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 4; i++) { const ang = Math.PI + ((t * 1.6 + i / 4) % 1) * Math.PI; const px = x + Math.cos(ang) * r, py = y + 10 + Math.sin(ang) * r * 1.05; ctx.fillStyle = '#fff6d0'; ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#fff6d0'; ctx.beginPath(); ctx.moveTo(px - 8, py); ctx.lineTo(px + 8, py); ctx.moveTo(px, py - 8); ctx.lineTo(px, py + 8); ctx.stroke(); }
      for (let i = 0; i < 12; i++) { const h0 = hash01(seed + i, 5); const ang = Math.PI + h0 * Math.PI; const rr = r * (0.3 + ((k * 1.2 + h0) % 1) * 0.7); ctx.globalAlpha = 0.5 * fade; ctx.strokeStyle = GOLD2; ctx.beginPath(); ctx.moveTo(x + Math.cos(ang) * rr * 0.8, y + 10 + Math.sin(ang) * rr * 0.84); ctx.lineTo(x + Math.cos(ang) * rr, y + 10 + Math.sin(ang) * rr * 1.05); ctx.stroke(); }
      break; }
    case 'celadus': { // 함성: 관중 충격파 위에 허초 잔상과 실제 베기선을 겹친다
      const fakeK = ease(Math.min(1, k * 2.4)); ctx.globalAlpha = 0.28 * fade; drawStickman(ctx, a.type, { x: x - face * (34 + fakeK * 18), y: y + 30, scale: 1.08, facing: face, pose: 'guard', t: t + 0.15, team: '#9b2c1c', accessories: [] });
      ctx.globalAlpha = 0.62 * fade; ctx.strokeStyle = '#9b2c1c'; ctx.lineWidth = 1.4; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(x - face * 42, y - 24); ctx.quadraticCurveTo(x - face * 18, y - 50, x + face * 18, y - 20); ctx.stroke(); ctx.setLineDash([]);
      for (let i = 0; i < 3; i++) { const q = Math.max(0, Math.min(1, k * 3 - i * 0.18)); if (q <= 0) continue; ctx.globalAlpha = (1 - q * 0.55) * fade; ctx.strokeStyle = i === 0 ? '#fff8e0' : GOLD; ctx.lineWidth = 3 - i * 0.6; ctx.beginPath(); ctx.moveTo(x - face * (10 + i * 3), y - 36 + i * 10); ctx.quadraticCurveTo(x + face * 52, y - 60 + i * 8, x + face * (95 + q * 34), y - 20 + i * 14); ctx.stroke(); }
      for (let i = 0; i < 3; i++) { const kk = Math.max(0, Math.min(1, (k * 2.2 - i * 0.25))); if (kk <= 0) continue; const rr = 10 + ease(kk) * 130; ctx.globalAlpha = (1 - kk) * 0.9 * fade; ctx.strokeStyle = i === 1 ? GOLD : '#fff8e0'; ctx.lineWidth = 4 - i; ctx.beginPath(); ctx.ellipse(x, y + 4, rr, rr * 0.6, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.lineWidth = 1.4; for (let i = 0; i < 28; i++) { const ang = (i / 28) * Math.PI * 2 + hash01(seed, i) * 0.2; const l0 = 30 + hash01(seed + i, 6) * 30, l1 = l0 + 40 + Math.sin(t * 14 + i) * 14; ctx.globalAlpha = 0.7 * fade; ctx.strokeStyle = i % 2 ? '#fff8e0' : GOLD; ctx.beginPath(); ctx.moveTo(x + Math.cos(ang) * l0, y + 4 + Math.sin(ang) * l0 * 0.6); ctx.lineTo(x + Math.cos(ang) * l1, y + 4 + Math.sin(ang) * l1 * 0.6); ctx.stroke(); }
      ctx.globalAlpha = 0.9 * fade; ctx.fillStyle = INK; ctx.font = 'bold 13px serif'; ctx.textAlign = 'center'; for (let i = 0; i < 5; i++) { const h0 = hash01(seed + i, 7); const ang = -Math.PI * (0.2 + h0 * 0.6); const d = 60 + ((k * 1.5 + h0) % 1) * 60; ctx.globalAlpha = (1 - ((k * 1.5 + h0) % 1)) * fade; ctx.fillText(['켈라두스!', '아아!', '함성!', '켈라두스!', '오오!'][i], x + Math.cos(ang) * d, y - 20 + Math.sin(ang) * d * 0.6); }
      break; }
    case 'crescens': { // 의사의 손: 빗나간 그물을 손목으로 되감아 바로 다시 펼친다
      const pull = ease(Math.min(1, k * 2.2)); const cast = ease(Math.max(0, Math.min(1, k * 2.2 - 0.75))); const cx = x + face * (84 - pull * 58 + cast * 80), cy = y - 18 + Math.sin(t * 8) * 3; const rr = 34 + cast * 28 - pull * 10;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#ead8aa'; ctx.lineWidth = 1.3; ctx.globalAlpha = 0.9 * fade; ctx.beginPath(); ctx.moveTo(x + face * 8, y - 14); ctx.quadraticCurveTo(x + face * (34 + Math.sin(t * 6) * 8), y - 52, cx - face * rr * 0.55, cy); ctx.stroke();
      ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 1.1; ctx.globalAlpha = 0.78 * fade; for (let i = -3; i <= 3; i++) { const q = i / 3; ctx.beginPath(); ctx.moveTo(cx + face * q * rr, cy - rr * 0.42); ctx.lineTo(cx - face * q * rr, cy + rr * 0.42); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - face * rr * 0.8, cy + q * rr * 0.42); ctx.lineTo(cx + face * rr * 0.8, cy - q * rr * 0.42); ctx.stroke(); }
      ctx.strokeStyle = GOLD2; ctx.lineWidth = 2; ctx.globalAlpha = 0.85 * fade; ctx.beginPath(); ctx.ellipse(cx, cy, rr * 0.9, rr * 0.48, -face * 0.18, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 18; i++) { const h0 = hash01(seed + i, 8), h1 = hash01(seed + i, 9); const q = (k * 1.7 + h1) % 1; const px = cx - face * q * 70 + (h0 - 0.5) * 24, py = cy + (h0 - 0.5) * 32 + q * 16; ctx.globalAlpha = (1 - q) * 0.55 * fade; ctx.fillStyle = '#c9b48f'; ctx.beginPath(); ctx.ellipse(px, py, 6 + q * 8, 2.5 + q * 3, 0, 0, Math.PI * 2); ctx.fill(); }
      break; }
    case 'priscus': { // 버티는 자: 발이 모래에 박히고 심판의 멈춤 손짓처럼 버틴다
      ctx.globalAlpha = 0.85 * fade; ctx.strokeStyle = GOLD2; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; const palmK = ease(Math.min(1, k * 2)); ctx.beginPath(); ctx.arc(x - face * 34, y - 44, 9 + palmK * 5, 0, Math.PI * 2); ctx.stroke(); for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x - face * (42 + i * 2), y - 54); ctx.lineTo(x - face * (52 + i * 4), y - 70 - palmK * 16); ctx.stroke(); }
      ctx.strokeStyle = '#4a2f18'; ctx.lineWidth = 3; for (const dx of [-10, 10]) { ctx.beginPath(); ctx.moveTo(x + dx, y + 30); ctx.lineTo(x + dx - face * 18, y + 36); ctx.moveTo(x + dx, y + 30); ctx.lineTo(x + dx + face * 16, y + 38); ctx.stroke(); }
      ctx.strokeStyle = '#4a2f18'; ctx.lineWidth = 2; ctx.globalAlpha = 0.85 * fade; const grow = ease(Math.min(1, k * 2)); for (let i = 0; i < 9; i++) { const ang = (i / 9) * Math.PI * 2 + hash01(seed, i + 3) * 0.4; ctx.beginPath(); let px = x, py = y + 30; ctx.moveTo(px, py); for (let s = 1; s <= 5; s++) { const d = (s / 5) * 80 * grow; px = x + Math.cos(ang) * d + (hash01(seed + i, s) - 0.5) * 12; py = y + 30 + Math.sin(ang) * d * 0.4; ctx.lineTo(px, py); } ctx.stroke(); }
      for (let i = 0; i < 6; i++) { const h0 = hash01(seed + i, 10); const ang = (i / 6) * Math.PI * 2 + 0.5; const d = 44 + h0 * 24; const px = x + Math.cos(ang) * d, py = y + 30 + Math.sin(ang) * d * 0.4; const hgt = (30 + h0 * 40) * ease(Math.max(0, Math.min(1, k * 2.5 - i * 0.12))); ctx.globalAlpha = 0.95 * fade; ctx.fillStyle = '#8d7a5e'; ctx.fillRect(px - 7, py - hgt, 14, hgt); ctx.fillStyle = '#5e4b33'; ctx.fillRect(px + 4, py - hgt, 3, hgt); ctx.fillStyle = '#b3a184'; ctx.fillRect(px - 7, py - hgt, 14, 3); }
      for (let i = 0; i < 24; i++) { const h0 = hash01(seed + i, 11), h1 = hash01(seed + i, 12); const life = (k * 1.5 + h1) % 1; ctx.globalAlpha = 0.5 * (1 - life) * fade; ctx.fillStyle = '#c9b48f'; ctx.beginPath(); ctx.ellipse(x + (h0 - 0.5) * 140, y + 30 - life * 50, 8 + life * 14, 4 + life * 6, 0, 0, Math.PI * 2); ctx.fill(); }
      break; }
    case 'verus': { // 진실의 창: 앞으로 뻗는 빛의 창과 흩어지는 불꽃
      const len = 220 * ease(Math.min(1, k * 3)); const x0 = x + face * 10, y0 = y - 14, x1 = x0 + face * len, y1 = y0 - 8;
      const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, 'rgba(255,255,230,0)'); g.addColorStop(0.3, `rgba(255,250,200,${0.95 * fade})`); g.addColorStop(1, 'rgba(232,201,106,0)'); ctx.strokeStyle = g; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = `rgba(255,255,255,${fade})`; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.fillStyle = '#fff6d0'; for (let i = 0; i < 30; i++) { const h0 = hash01(seed + i, 13), h1 = hash01(seed + i, 14); const q = (k * 2 + h0) % 1; const px = x0 + face * len * q, py = y0 - 8 * q + (h1 - 0.5) * 30 * q; ctx.globalAlpha = (1 - q) * fade; ctx.beginPath(); ctx.arc(px, py, 1 + h1 * 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 0.8 * fade; ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5; for (let i = 0; i < 8; i++) { const ang = (i / 8) * Math.PI * 2 + t * 6; ctx.beginPath(); ctx.moveTo(x1 + Math.cos(ang) * 6, y1 + Math.sin(ang) * 6); ctx.lineTo(x1 + Math.cos(ang) * (16 + Math.sin(t * 20 + i) * 6), y1 + Math.sin(ang) * (16 + Math.sin(t * 20 + i) * 6)); ctx.stroke(); }
      break; }
    case 'tetraites': { // 유리잔의 기수: 재장전된 돌진 궤적, 말발굽 먼지, 유리 파편은 보조
      const dash = ease(Math.min(1, k * 2.4)); ctx.lineCap = 'round'; for (let i = 0; i < 5; i++) { const yy = y - 28 + i * 13; ctx.globalAlpha = (0.72 - i * 0.08) * fade; ctx.strokeStyle = i % 2 ? GOLD2 : '#9b2c1c'; ctx.lineWidth = 2.8 - i * 0.25; ctx.beginPath(); ctx.moveTo(x - face * (96 + i * 10) * dash, yy + Math.sin(t * 5 + i) * 4); ctx.quadraticCurveTo(x - face * 32, yy - 8, x + face * (54 + dash * 78), yy - 2); ctx.stroke(); }
      ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 1.4; for (let i = 0; i < 8; i++) { const q = (i / 8 + k * 1.5) % 1; const px = x - face * (20 + q * 150), py = y + 38 + Math.sin(i) * 10; ctx.globalAlpha = (1 - q) * 0.65 * fade; ctx.beginPath(); ctx.arc(px - 4, py, 4, -0.2, Math.PI * 1.1); ctx.stroke(); ctx.beginPath(); ctx.arc(px + 5, py + 1, 4, -0.2, Math.PI * 1.1); ctx.stroke(); }
      for (let i = 0; i < 30; i++) { const h0 = hash01(seed + i, 15), h1 = hash01(seed + i, 16); const life = (k * 1.3 + h1) % 1; const px = x - face * (life * 150) + (h0 - 0.5) * 60, py = y + 30 - h0 * 40 - life * 20; ctx.globalAlpha = 0.45 * (1 - life) * fade; ctx.fillStyle = '#d9c49a'; ctx.beginPath(); ctx.ellipse(px, py, 10 + life * 24, 6 + life * 12, 0, 0, Math.PI * 2); ctx.fill(); }
      for (let i = 0; i < 18; i++) { const h0 = hash01(seed + i, 17), h1 = hash01(seed + i, 18), h2 = hash01(seed + i, 19); const q = Math.min(1, k * 1.8); const ang = h0 * Math.PI * 2; const d = 10 + q * (28 + h1 * 54); const px = x + Math.cos(ang) * d, py = y - 6 + Math.sin(ang) * d * 0.6 + q * q * 36 * h2; ctx.save(); ctx.translate(px, py); ctx.rotate(t * 8 + i); ctx.globalAlpha = (1 - q * 0.7) * 0.75 * fade; ctx.fillStyle = i % 4 ? 'rgba(230,246,255,0.65)' : '#ffffff'; ctx.beginPath(); ctx.moveTo(0, -4 - h1 * 4); ctx.lineTo(3 + h2 * 3, 0); ctx.lineTo(0, 4 + h0 * 4); ctx.lineTo(-3 - h1 * 3, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#7fc7e8'; ctx.lineWidth = 0.6; ctx.stroke(); ctx.restore(); }
      break; }
    case 'hermes': { // 세 가지 무기: 세 빛깔의 잔상이 겹친다
      const cols = [RED, GOLD, '#2c4f9b']; for (let i = 0; i < 3; i++) { const off = (i - 1) * 18 * ease(Math.min(1, k * 2.5)) + Math.sin(t * 9 + i * 2) * 3; ctx.globalAlpha = 0.5 * fade; drawStickman(ctx, a.type, { x: x + off * face, y: y + 30, scale: 1.15, facing: face, pose: 'guard', t: t + i * 0.3, team: cols[i], accessories: [] }); }
      ctx.globalAlpha = 0.9 * fade; ctx.lineWidth = 1.6; for (let i = 0; i < 3; i++) { ctx.strokeStyle = cols[i]; const rr = 44 + i * 10 + Math.sin(t * 6 + i) * 4; ctx.beginPath(); ctx.ellipse(x, y + 4, rr, rr * 0.55, t * (i % 2 ? 1 : -1) + i, 0, Math.PI * 1.4); ctx.stroke(); }
      break; }
    case 'columbus': { // 비둘기: 맞을 자리에 흰 잔상만 남기고 옆으로 빠진다
      const slip = ease(Math.min(1, k * 2.8)); ctx.globalAlpha = 0.22 * fade; drawStickman(ctx, a.type, { x: x - face * (42 + slip * 12), y: y + 30, scale: 1.12, facing: face, pose: 'hit', t, team: '#ffffff', accessories: [] });
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.lineCap = 'round'; for (let i = 0; i < 5; i++) { const q = i / 5; ctx.globalAlpha = (1 - q) * 0.55 * fade; ctx.beginPath(); ctx.moveTo(x - face * (48 + q * 34), y - 28 + i * 9); ctx.quadraticCurveTo(x - face * (18 + q * 14), y - 42 + i * 6, x + face * (22 + slip * 22), y - 22 + i * 3); ctx.stroke(); }
      for (let i = 0; i < 18; i++) { const h0 = hash01(seed + i, 20), h1 = hash01(seed + i, 21); const q = (k * 1.2 + h1) % 1; const px = x - face * (30 + q * 72) + (h0 - 0.5) * 26, py = y - 30 - h0 * 18 + q * 86 + Math.sin(t * 6 + i) * 4; ctx.save(); ctx.translate(px, py); ctx.rotate(Math.sin(t * 4 + i) * 0.8); ctx.globalAlpha = (1 - q * 0.75) * 0.78 * fade; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(0, 0, 5, 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#cfcfcf'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.stroke(); ctx.restore(); }
      const g = ctx.createRadialGradient(x, y - 10, 5, x, y - 10, 70); g.addColorStop(0, `rgba(255,255,255,${0.35 * fade})`); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 10, 70, 0, Math.PI * 2); ctx.fill();
      break; }
    case 'prudens': { // 신중: 머리 위에서 도는 빛의 올가미와 꼬리 빛
      const rr = 34 + Math.sin(t * 3) * 4; ctx.save(); ctx.translate(x, y - 46); ctx.rotate(t * 5); ctx.globalAlpha = 0.9 * fade; ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, rr, rr * 0.36, 0, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = '#fff6d0'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, 0, rr, rr * 0.36, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      ctx.lineWidth = 2; for (let i = 0; i < 14; i++) { const q = i / 14; const ang = t * 5 - q * 1.6; const px = x + Math.cos(ang) * rr, py = y - 46 + Math.sin(ang) * rr * 0.36; ctx.globalAlpha = (1 - q) * 0.8 * fade; ctx.strokeStyle = GOLD2; ctx.beginPath(); ctx.arc(px, py, 3 + (1 - q) * 3, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = 0.7 * fade; ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + face * 8, y - 12); ctx.quadraticCurveTo(x + face * 30, y - 40, x + Math.cos(t * 5) * rr, y - 46 + Math.sin(t * 5) * rr * 0.36); ctx.stroke();
      break; }
  }
  ctx.restore();
}
// 화면 위 띠: 인물 이름과 딕타타 이름 (카메라 무관). k 0 → 1
export function drawLegendBanner(ctx: CanvasRenderingContext2D, W: number, H: number, name: string, dict: string, k: number) {
  const inK = ease(Math.min(1, k * 4)), out = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1; if (out <= 0) return;
  ctx.save(); ctx.globalAlpha = out;
  if (k < 0.12) { ctx.fillStyle = `rgba(255,246,208,${(1 - k / 0.12) * 0.55})`; ctx.fillRect(0, 0, W, H); } // 첫 순간의 섬광
  const y = H * 0.22; ctx.fillStyle = 'rgba(58,36,18,0.72)'; ctx.fillRect(0, y - 26 * inK, W, 52 * inK);
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, y - 26 * inK); ctx.lineTo(W, y - 26 * inK); ctx.moveTo(0, y + 26 * inK); ctx.lineTo(W, y + 26 * inK); ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = GOLD2; ctx.font = `bold ${Math.round(26 * (0.6 + 0.4 * inK))}px serif`; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 6; ctx.fillText(`${name} — ${dict}`, W / 2, y);
  ctx.shadowBlur = 0; ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#f3ead0'; ctx.fillText('LEGENDA', W / 2, y - 18 * inK - 8);
  ctx.restore();
}
