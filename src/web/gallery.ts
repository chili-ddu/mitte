import { drawStickman, clipSkeleton, clipLength, attackClipFor, drawNetOverlay, type Pose, type ClipName } from './stickman.js';
import type { GType } from '../core/types.js';
import { attackClipForLoadout, deathClipForWeapon, offhandClipFor, comboClipForLoadout } from './stickman.js';
import type { Loadout } from './loadout.js';
import { LEGENDS } from '../core/legends.js';
import type { LegendMark } from '../core/epithets.js';
import { TYPES, TYPE_KO as KO } from '../core/gladiator.js'; /* 유형 목록은 한 곳에서 (2026-09-18 유형 열) */
const POSES: Pose[] = ['idle', 'guard', 'hit', 'bound', 'kneel_down', 'fly_back', 'sit_slump'];
// 막기는 큰 방패 유형만 (게임 룰과 동일)
const hasBlock = (t: GType) => t === 'murmillo' || t === 'secutor' || t === 'provocator' || t === 'hoplomachus' || t === 'eques';
// 유형별 공격 자세 열
const ATTACK_POSES: Record<GType, Pose[]> = { murmillo: ['stab_ready', 'stab'], secutor: ['stab_ready', 'stab', 'stab_deep'], thraex: ['windup', 'attack', 'swing'], retiarius: ['net_ready', 'net_throw', 'stab_ready', 'stab'], hoplomachus: ['stab_ready', 'stab'], provocator: ['stab_ready', 'stab'], eques: ['stab_ready', 'stab'], dimachaerus: ['windup', 'attack', 'swing'], scissor: ['stab_ready', 'stab', 'swing'], laquearius: ['net_ready', 'net_throw', 'stab_ready', 'stab'] };
const CLIPS = (t: GType): ClipName[] => [attackClipFor(t), t === 'retiarius' || t === 'laquearius' ? 'net_throw' : hasBlock(t) ? 'block' : 'hit', 'die_forward', 'die_back', 'die_side'];
// 조합 줄: 같은 몸에 장비만 바꾼 예. 유형이 아니라 장비가 그림과 동작을 정한다
const COMBOS: { name: string; l: Loadout }[] = [
  { name: '오른손 창 · 왼손 큰방패 · 챙투구+흉갑 (프로보카토르 느낌)', l: { main: 'spear', off: 'scutum', helmet: 'brimmed', extras: ['pectorale', 'manica'], accessories: [] } },
  { name: '오른손 글라디우스 · 왼손 작은방패 · 맨머리 + 월계관·흉터', l: { main: 'gladius', off: 'parmula', helmet: 'none', extras: [], accessories: ['laurel', 'scar'] } },
  { name: '오른손 시카 · 왼손 그물 · 매끈투구 + 붉은띠', l: { main: 'sica', off: 'net', helmet: 'smooth', extras: ['manica'], accessories: ['sash'] } },
  { name: '오른손 삼지창 · 왼손 없음 · 갈레루스 + 종려가지', l: { main: 'trident', off: 'none', helmet: 'none', extras: ['galerus'], accessories: ['palm', 'armband'] } },
];
const c = document.getElementById('c') as HTMLCanvasElement;
const W = 2200, H = (TYPES.length + COMBOS.length + 1) * 150 + 20; const dpr = devicePixelRatio; /* +1: 전설 줄 */
c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px';
const ctx = c.getContext('2d')!; ctx.scale(dpr, dpr);
function frame(ts: number) {
  const t = ts / 1000;
  ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#dcc89a'; ctx.fillRect(0, 0, W, H);
  TYPES.forEach((type, r) => {
    const y = 130 + r * 150;
    ctx.fillStyle = '#7a6a4e'; ctx.font = '12px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(KO[type], 16, y - 100);
    ctx.strokeStyle = '#c9b47f'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y + 2); ctx.lineTo(W, y + 2); ctx.stroke();
    const cols: Pose[] = [...POSES, ...(hasBlock(type) ? ['block' as Pose] : []), ...ATTACK_POSES[type]];
    cols.forEach((pose, i) => { drawStickman(ctx, type, { x: 100 + i * 110, y, scale: 1.4, pose, t, wobble: pose === 'bound' }); if (pose === 'bound') drawNetOverlay(ctx, 100 + i * 110, y, 58 * 1.4, undefined, t); ctx.fillStyle = '#7a6a4e'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(pose, 100 + i * 110, y + 16); });
    // 클립 재생 열
    CLIPS(type).forEach((c, i) => {
      const len = clipLength(c) + 700;
      const el = (ts % len);
      const x = 100 + 12 * 110 + 40 + i * 140;
      drawStickman(ctx, type, { x, y, scale: 1.4, skeleton: clipSkeleton(c, el), t });
      ctx.fillStyle = '#7a6a4e'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(c, x, y + 16);
    });
    // 마주보기
    drawStickman(ctx, type, { x: 100 + 12 * 110 + 40 + 5 * 140, y, scale: 1.4, skeleton: clipSkeleton(attackClipFor(type), ts % (clipLength(attackClipFor(type)) + 500)), facing: -1, t });
  });
  // 조합 줄
  COMBOS.forEach((cb, r) => {
    const y = 130 + (TYPES.length + r) * 150;
    ctx.fillStyle = '#7a6a4e'; ctx.font = '12px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('조합: ' + cb.name, 16, y - 100);
    ctx.strokeStyle = '#c9b47f'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y + 2); ctx.lineTo(W, y + 2); ctx.stroke();
    (['idle', 'guard', 'hit'] as Pose[]).forEach((pose, i) => drawStickman(ctx, cb.l, { x: 100 + i * 110, y, scale: 1.4, pose, t }));
    const atk = attackClipForLoadout(cb.l), die = deathClipForWeapon(cb.l.main), offc = offhandClipFor(cb.l.off);
    [atk, comboClipForLoadout(cb.l), ...(offc ? [offc.clip] : []), die].forEach((cl, i) => { const len = clipLength(cl) + 700; const x = 100 + 4 * 110 + i * 150; drawStickman(ctx, cb.l, { x, y, scale: 1.4, skeleton: clipSkeleton(cl, ts % len), t }); ctx.fillStyle = '#7a6a4e'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(cl, x, y + 16); });
  });
  { const y = 130 + (TYPES.length + COMBOS.length) * 150; /* 전설 줄: 열 명의 표식 (2026-09-22) */
    ctx.fillStyle = '#7a6a4e'; ctx.font = '12px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('전설: ' + LEGENDS.map(l => l.name).join(' · '), 16, y - 100);
    ctx.strokeStyle = '#c9b47f'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y + 2); ctx.lineTo(W, y + 2); ctx.stroke();
    LEGENDS.forEach((l, i) => { drawStickman(ctx, l.type, { x: 100 + i * 200, y, scale: 2.0, pose: 'idle', t, accessories: ['legend', `leg_${l.id}` as LegendMark] }); ctx.fillStyle = '#7a6a4e'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(l.name, 100 + i * 200, y + 16); }); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
