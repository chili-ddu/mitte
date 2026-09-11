import { drawStickman, clipSkeleton, clipLength, type ClipName } from './stickman.js';
import type { GType } from '../core/types.js';
const TYPES: GType[] = ['murmillo', 'thraex', 'retiarius'];
const CLIPS: ClipName[] = ['die_forward', 'die_back', 'die_side'];
const KO: Record<string, string> = { die_forward: '앞으로 무릎 꿇고', die_back: '뒤로 튕겨', die_side: '주저앉아 무너짐' };
const FRAMES = 7, CW = 150, RH = 150;
const c = document.getElementById('c') as HTMLCanvasElement;
const W = 80 + FRAMES * CW, H = TYPES.length * CLIPS.length * RH + 20; const dpr = devicePixelRatio;
c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px';
const ctx = c.getContext('2d')!; ctx.scale(dpr, dpr);
ctx.fillStyle = '#dcc89a'; ctx.fillRect(0, 0, W, H);
let row = 0;
for (const type of TYPES) for (const clip of CLIPS) {
  const y = 120 + row * RH;
  ctx.fillStyle = '#7a6a4e'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`${type} · ${KO[clip]}`, 10, y - 95);
  ctx.strokeStyle = '#c9b47f'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y + 2); ctx.lineTo(W, y + 2); ctx.stroke();
  const len = clipLength(clip);
  for (let i = 0; i < FRAMES; i++) {
    const el = len * i / (FRAMES - 1);
    drawStickman(ctx, type, { x: 80 + i * CW + 50, y, scale: 1.5, skeleton: clipSkeleton(clip, el), t: 0 });
    ctx.fillStyle = '#7a6a4e'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`${Math.round(el)}ms`, 80 + i * CW + 50, y + 14);
  }
  row++;
}
