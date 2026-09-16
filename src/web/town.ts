// 마을 캔버스: 카메라·이동·라니스타·입력. 장면 그림은 scenes.ts, 켈라는 cells.ts
import { S } from './state.js';
import { INK, NPC_POSES, drawStickman, type Skeleton, walkSkeleton } from './stickman.js';
import { bedPatient, inBed, leavePalus, moveToCell, occupantOf, palusOf, palusTrainee, putAtPalus, putInBed } from '../core/game.js';
import { sfx } from './sound.js';
import { CONFIG } from '../core/config.js';
import { type Gladiator } from '../core/types.js';
import { FORUM, MARKET, MK, YARD, drawCityWall, drawCountryside, drawForumScene, drawGraveScene, drawMarketScene, drawMedicScene, drawStreetProps, drawYardScene, marketSlotX, palusPosts } from './scenes.js';
import { View, app, render, save } from './main.js';
import { h, tell } from './dom.js';
import { roadBoard } from './board.js';
import { cellRects, drawCellsScene } from './cells.js';
import { openConfirm } from './detail.js';

// 세로 기준 논리 무대 400×(600~900)를 기기에 맞춰 배율 조정. 안전 영역(노치·홈 바)은 빼고 잰다. 세로 전용 게임 — PC 나 옆으로 든 폰에서는 폰 모양 무대를 가운데 세운다
export const VIEW_W = 440; // 마을 장면의 보이는 폭 (월드 단위): 라니스타 주변만, 이웃 장소는 걸어가서 본다
// 켈라 화면: 회랑 뒤 작은 방들. 칸마다 문·질(등잔 수)·거주자(앉은 모습). 누르면 시트
export const TOWN_H = 414, CELLS_TOP = 0, CELLS_MIN_H = CELLS_TOP + 40 + 5 * 100 + 4 * 6; // 마을 장면 높이 · 켈라 장면의 위 여백(처마 토글이 덮는 만큼, 월드 단위) · 켈라 장면 최소 높이 (3×5 방, 방 높이 100 + 여백)
 export const CH = () => S.townH; // 마을 캔버스의 현재 논리 높이: 평소 TOWN_H, 켈라가 열리는 만큼 cellsH 까지 자란다 (renderTown 의 draw 가 매 프레임 정한다). 세로 무대에서 닫힌 마을 아래 빈 흙길이 화면 절반을 먹던 문제의 답 답
 // 두루마리(소식)

// ── 타운: 훈련장(0~1076) + 길(1076~1420) + 시장(1420~1940)을 한 장면으로. 카메라가 라니스타를 따라 옆으로 이동
export const GY = 348; // 마을 공통 땅선. 258 → 348: 위에 하늘 90 유닛을 더 두어 지붕 위로 하늘이 보인다 (사용자, 세로 무대의 남는 높이를 장면이 쓴다). 장면 높이(TOWN_H 414)는 그만큼 함께 늘림
 // 마을 공통 땅선. 258 → 348: 위에 하늘 90 유닛을 더 두어 지붕 위로 하늘이 보인다 (사용자, 세로 무대의 남는 높이를 장면이 쓴다). 장면 높이(TOWN_H 414)는 그만큼 함께 늘림
export const MEDIC = { W: 420, H: 230 }; // 의무실: 훈련장 왼쪽의 독립 건물 (침상 최대 4, 의사 탁자, 약재 선반)
 // 의무실: 훈련장 왼쪽의 독립 건물 (침상 최대 4, 의사 탁자, 약재 선반)
export const TOWN = { padL: 420, padR: 420, gapW: 60, roadW: 380, forumX0: 40, forumW: 300, /* 포룸 300 + 시장까지 40: 세로 무대에 맞춰 포룸(440)과 길(520)을 줄였다 — 공고벽 200 + 제단이면 충분 */ get medicX() { return this.padL; }, get forumX() { return this.yardX + YARD.W + this.forumX0; }, wallW: 130, tailW: 290, get yardX() { return this.medicX + MEDIC.W + this.gapW; }, get marketX() { return this.yardX + YARD.W + this.roadW; }, get wallX() { return this.marketX + MARKET.W; }, get graveX() { return this.wallX + this.wallW; }, get W() { return this.graveX + this.tailW + this.padR; }, H: TOWN_H }; // 들판(padL) → 의무실 → 훈련소 → 포룸 → 시장 → 성벽(문) → 성문 밖 묘지 → 길(padR). 양 끝 여백 덕에 어느 장소든 화면 가운데에 온다
 // 들판(padL) → 의무실 → 훈련소 → 포룸 → 시장 → 성벽(문) → 성문 밖 묘지 → 길(padR). 양 끝 여백 덕에 어느 장소든 화면 가운데에 온다
export const lanista = { x: 0, target: 0, walking: false, v: 0, vmax: 340 }; // 실제 위치는 캔버스를 만들 때 restX(view) 로 잡는다
export const restX = (v: View) => v === 'grave' ? TOWN.graveX + TOWN.tailW - 70 : v === 'market' ? TOWN.marketX + 44 : v === 'medic' ? TOWN.medicX + 250 : v === 'yard' ? TOWN.yardX + 84 : TOWN.forumX + FORUM.wallW + 40;   // 포룸: 공고벽 오른쪽 끝에 서서 벽을 본다 // 라니스타가 서는 자리 (의무실 앞 · 대련장과 팔루스 사이 · 정문 앞 · 시장 앞)
   // 포룸: 공고벽 오른쪽 끝에 서서 벽을 본다 // 라니스타가 서는 자리 (의무실 앞 · 대련장과 팔루스 사이 · 정문 앞 · 시장 앞)
const clampCam = (x: number) => Math.max(0, Math.min(TOWN.W - S.VW, x));
// 카메라 기준 위치: 시장은 건물이 화면 가운데 조금 오른쪽. 루두스는 폭이 충분하면 훈련장 전체, 좁으면 라니스타 주변(화면 60% 지점)
export const placeCenter = (v: View) => v === 'grave' ? TOWN.graveX + TOWN.tailW / 2 - 30 : v === 'market' ? TOWN.marketX + MARKET.W / 2 : v === 'medic' ? TOWN.medicX + MEDIC.W / 2 : v === 'yard' ? TOWN.yardX + 250 : TOWN.forumX + 50; // 장소의 가운데 (월드 x). 훈련소는 안뜰(무기고·연습장·팔루스)만, 정문(문루 470~600)은 포룸 화면에 속한다: 포룸 카메라를 왼쪽으로 당겨 문루 + 그 앞 지원자 + 공고벽이 한 화면에
 // 장소의 가운데 (월드 x). 훈련소는 안뜰(무기고·연습장·팔루스)만, 정문(문루 470~600)은 포룸 화면에 속한다: 포룸 카메라를 왼쪽으로 당겨 문루 + 그 앞 지원자 + 공고벽이 한 화면에
export const camFor = (v: View) => clampCam(placeCenter(v) - S.VW / 2); // 이동한 장소를 화면 가운데에, 양옆은 이웃 장소가 자연스럽게 이어진다
 // cellsCanvas: 켈라 전용 덮개 캔버스 (마을 위, 처마 밑에서 무대 바닥까지). 마을 캔버스는 켈라를 열어도 크기가 변하지 않는다 // 한 번 만들고 유지 (화면 재구성 때 끊기지 않게)
export function renderTown() {
  if (S.townCanvas && S.cellsCanvas) return h('div', { class: 'panel yardwrap' }, S.townCanvas, roadBoard());
  const c = h('canvas', { class: 'yard' }) as HTMLCanvasElement; S.townCanvas = c;
  const oc = h('canvas', { class: 'cellsoverlay' }) as HTMLCanvasElement; S.cellsCanvas = oc; const octx = oc.getContext('2d')!; // 켈라 덮개
  let zoom = 1, lastCw = 0, lastH = 0; c.style.height = CH() + 'px';
  const ctx = c.getContext('2d')!; ctx.scale(devicePixelRatio, devicePixelRatio);
  // 화면 폭에 맞춘다: 좁은 화면은 줌 0.8 까지만 줄이고 보이는 폭(VW)을 좁혀 라니스타 주변만 보여 준다 (찌그러짐 없음)
  const fit = () => {
    const cw = c.clientWidth, VH = CH(); if (!cw || (cw === lastCw && VH === lastH)) return; lastCw = cw; lastH = VH;
    zoom = cw / VIEW_W; S.VW = VIEW_W; // 보이는 폭을 폰 기준(404 유닛)으로 고정하고 화면 폭에 맞춰 확대 — PC 에서도 같은 장면이 보인다
    document.documentElement.style.setProperty('--yard-h', `${Math.round(VH * zoom)}px`);
    c.width = Math.round(cw * devicePixelRatio); c.height = Math.round(VH * zoom * devicePixelRatio); c.style.height = VH * zoom + 'px';
    ctx.setTransform(devicePixelRatio * zoom, 0, 0, devicePixelRatio * zoom, 0, 0);
    if (!lanista.walking) { S.camPan = 0; S.camX = camFor(S.view); S.camV = 0; }
  };
  if (!lanista.walking) { lanista.x = restX(S.view); lanista.target = lanista.x; S.camX = camFor(S.view); }
  let last = performance.now();
  const draw = () => {
    if (!c.isConnected) { requestAnimationFrame(draw); return; } // 잠시 떨어져 있어도 루프 유지
    fit();
    const now = performance.now(); const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000;
    // 라니스타 이동
    if (lanista.walking) { // 걸음: 출발부터 끝까지 점점 빨라지며 도착 (감속 없음)
      const d = lanista.target - lanista.x; const dist = Math.abs(d);
      const ACC = lanista.vmax * 0.45;
      lanista.v = Math.min(lanista.vmax, lanista.v + ACC * dt);
      const step = lanista.v * dt;
      if (dist <= Math.max(step, 1.5)) { lanista.x = lanista.target; lanista.walking = false; lanista.v = 0; S.travel = null; render(); requestAnimationFrame(draw); return; }
      lanista.x += Math.sign(d) * step;
    }
    // 카메라: 걷는 동안 라니스타를 따라가고(화면 40% 지점), 정지하면 장면 위치로
    // 카메라: 스프링 추종 (속도를 가져 출발·정지가 매끄럽다). 걷는 동안 진행 방향 앞쪽을 조금 더 보여줌
    // 카메라 목표: 출발 화면 위치 → 도착 화면 위치를 걸음 진행률로 잇는다 (도착 순간 목표가 튀지 않음)
    let camTarget = camFor(S.view) + S.camPan;
    { const k = 30, c2 = 2 * Math.sqrt(k); const a = (camTarget - S.camX) * k - S.camV * c2; S.camV += a * dt; S.camX += S.camV * dt; }
    ctx.clearRect(0, 0, S.VW, CH());
    ctx.save();
    if (S.zoomIn) { const e = Math.min(1, (performance.now() - S.zoomIn.start) / S.zoomIn.dur), ease = 1 - Math.pow(1 - e, 3); const z = 1 + (S.zoomIn.k - 1) * ease; const sx = S.zoomIn.wx - S.camX, sy = S.zoomIn.wy; ctx.translate(sx, sy); ctx.scale(z, z); ctx.translate(-sx, -sy); if (e >= 1 && !S.zoomIn.fired) { S.zoomIn.fired = true; const d = S.zoomIn.done; S.zoomIn = null; d(); } } // 초점(공고벽)을 향해 부드럽게 당긴다
    ctx.translate(-S.camX, 0);
    // ── 배경 층 (마을 전체에 이어짐)
    { const sky = ctx.createLinearGradient(0, 0, 0, GY - 120); sky.addColorStop(0, '#f1e7c9'); sky.addColorStop(1, '#e6d6ad'); ctx.fillStyle = sky; ctx.fillRect(0, 0, TOWN.W, CH()); } // 하늘: 위가 조금 밝은 회칠빛 (파랑은 낙서풍 팔레트와 어긋난다)
    // 거리 집 정면 (길 구간 + 시장 뒤까지): 지붕·창·문
    for (let x = TOWN.yardX + YARD.W - 40; x < TOWN.W; x += 118) {
      if (x + 104 > TOWN.marketX - 10) break; // 시장 광장 뒤는 회랑, 그 너머는 성벽과 성문 밖
      if (x + 104 > TOWN.forumX - 6 && x < TOWN.forumX + TOWN.forumW + 6) continue; // 포룸 자리는 비운다
      const hh = 70 + ((x / 118) % 3) * 14; const y0 = GY - 14 - hh;
      ctx.fillStyle = '#c9b283'; ctx.fillRect(x, y0, 104, hh);
      ctx.fillStyle = '#9b4a2c'; ctx.fillRect(x - 6, y0 - 12, 116, 14); // 기와 지붕
      ctx.fillStyle = '#7a6743'; ctx.fillRect(x + 14, y0 + 18, 16, 16); ctx.fillRect(x + 72, y0 + 18, 16, 16); // 창
      ctx.fillStyle = '#3a2412'; ctx.fillRect(x + 44, y0 + hh - 34, 18, 34); // 문
    }
    // 땅: 아래 띠만 (모래 → 포장길 → 광장, 서서히). 훈련장 구간은 마당 전체를 모래로
    { const g = ctx.createLinearGradient(0, 0, TOWN.W, 0); g.addColorStop(0, '#dccb9c'); g.addColorStop((TOWN.yardX + YARD.W) / TOWN.W, '#dccb9c'); g.addColorStop((TOWN.yardX + YARD.W + 120) / TOWN.W, '#cbb67f'); g.addColorStop((TOWN.marketX - 40) / TOWN.W, '#cbb67f'); g.addColorStop(TOWN.marketX / TOWN.W, '#d6c59a'); g.addColorStop(1, '#d6c59a');
      ctx.fillStyle = g; ctx.fillRect(0, GY - 14, TOWN.W, CH() - GY + 14);
      ctx.fillStyle = '#dccb9c'; ctx.fillRect(TOWN.yardX, GY - 210, YARD.W, CH()); /* 훈련장 모래 (지붕선 아래부터) */
      ctx.fillStyle = '#cbb67f'; ctx.fillRect(TOWN.medicX - 20, GY - 14, TOWN.yardX - TOWN.medicX + 20, CH()); /* 의무실 앞·사이 통로 */
      drawCountryside(ctx, 0, TOWN.medicX - 20, t, 'left'); drawCountryside(ctx, TOWN.graveX + TOWN.tailW, TOWN.padR, t, 'right'); } // 양 끝 들판과 길
    // 포장길 돌 무늬 (길 구간)
    ctx.strokeStyle = '#b9a26f'; ctx.lineWidth = 1; for (let x = TOWN.yardX + YARD.W + 10; x < TOWN.marketX + 20; x += 34) { for (let yy = GY - 4; yy < CH(); yy += 16) { ctx.beginPath(); ctx.moveTo(x + ((yy / 16) % 2) * 17, yy); ctx.lineTo(x + ((yy / 16) % 2) * 17 + 28, yy); ctx.stroke(); } }
    drawStreetProps(ctx, t); // 장소 사이의 소품: 우물·빨랫줄·수레·길가 사당·개·암포라 (장소가 자연스럽게 이어지게)
    // ── 구조물 층
    // 거리 행인: 길을 오간다 (주기적으로 왕복)
    // 루두스 문 밖의 자유민 지원자: 문루 앞 길에 서서 기다린다
    ctx.save(); ctx.translate(TOWN.yardX, GY - 210); drawYardScene(ctx, t); ctx.restore();          // 훈련장 (발 = 210 → GY)
    ctx.save(); ctx.translate(TOWN.medicX, GY - 210); drawMedicScene(ctx, t); ctx.restore();                 // 의무실 (독립 건물)
    ctx.save(); ctx.translate(TOWN.forumX, GY); drawForumScene(ctx, t); ctx.restore(); // 포룸(광장): 공고벽·제단·심부름꾼 (발 = GY)
    S.st.applicants.forEach((g, i) => { const x = TOWN.yardX + YARD.W - 58 - i * 26; drawStickman(ctx, g.type, { x, y: GY, scale: 0.9, skeleton: NPC_POSES.watch, t: t + i, ink: INK, bare: true, garment: 'tunic', garmentColor: '#b9c2a8', facing: -1 }); }); // 자유민 지원자: 루두스 문루 아래에 서서 훈련소 안을 본다 (계약을 청하러 찾아옴)
    ctx.save(); ctx.translate(TOWN.marketX + MK.ox, GY - MARKET.H * MK.sc); ctx.scale(MK.sc, MK.sc); drawMarketScene(ctx, t); ctx.restore(); // 시장: 조금 작게, 판매대 밑면이 땅(GY)에 닿게 뒤로 물려 길 뒤에 선다
    ctx.save(); ctx.translate(TOWN.wallX, GY); drawCityWall(ctx); ctx.restore();                  // 성벽과 성문 (시장과 묘지 사이)
    ctx.save(); ctx.translate(TOWN.graveX, GY); drawGraveScene(ctx, t); ctx.restore();
    { const span = TOWN.roadW + MARKET.W - 80; const p1 = TOWN.yardX + YARD.W + 40 + ((t * 38) % span), p2 = TOWN.wallX - 40 - ((t * 30 + 300) % span); // 거리 행인: 장면 앞(길 위)을 오간다. 성문 안쪽(길·시장)만
      drawCivilian(ctx, p1, GY + 4, 0.9, 'walk', t, 11, 1); drawCivilian(ctx, p2, GY + 4, 0.9, 'walk', t, 5, -1); } // 묘지 (성문 밖 길가 묘역, 발 = GY) // 시장 (판매대 윗면 = GY-30, 앞면·가격표가 디스플레이 안에 들어오도록)
    // 라니스타: 토가 입은 인물 (걷기 또는 서서 구경)
    { const facing: 1 | -1 = lanista.walking ? (lanista.target > lanista.x ? 1 : -1) : (S.view === 'market' || S.view === 'medic' || S.view === 'yard' ? 1 : -1); // 의무실: 의사(오른쪽)를 본다 · 포룸: 공고벽(왼쪽) · 훈련소: 왼쪽 끝에 서서 연습장·팔루스(오른쪽)를 본다 — 전엔 팔루스 첫 기둥 앞(268)에 서서 훈련하는 검투사와 겹쳤다 · 묘지: 묘비(왼쪽) // 묘지에서는 오른쪽 끝에 서서 왼쪽 묘비들을 본다 // 시장에서는 판매대 왼쪽 앞에 서서 오른쪽(매물)을 본다
      drawLanista(ctx, lanista.x, GY, facing, t * Math.max(0.4, lanista.walking ? lanista.v / 300 : 1), lanista.walking);
    }
    ctx.restore();
    // 켈라 화면: 시트(key-cells) 본문의 캔버스에 그린다. 마을 캔버스는 그대로
    S.cellsP = S.cellsOpen ? 1 : 0; // 열림/닫힘 모션은 시트 CSS(panelup/paneldown)가 맡는다
    if (S.cellsOpen && oc.isConnected) { const ow = oc.clientWidth, oh = oc.clientHeight; if (ow && oh) { const z = ow / VIEW_W; S.cellsH = Math.max(CELLS_MIN_H, Math.floor(oh / z)); const bw = Math.round(ow * devicePixelRatio), bh = Math.round(oh * devicePixelRatio); if (oc.width !== bw || oc.height !== bh) { oc.width = bw; oc.height = bh; }
      octx.setTransform(devicePixelRatio * z, 0, 0, devicePixelRatio * z, 0, 0); octx.clearRect(0, 0, VIEW_W, S.cellsH); drawCellsScene(octx, t); } }
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
  // 스와이프: 왼쪽으로 밀면 다음 장소, 오른쪽으로 밀면 이전 장소 (의무실 → 훈련소 → 정문 → 시장). 스와이프했으면 클릭으로 치지 않는다
  const ORDER: View[] = ['medic', 'yard', 'ludus', 'market', 'grave'];
  let drag: { x0: number; t0: number } | null = null; let dragged = false;
  const cellAt = (ev: PointerEvent | MouseEvent) => { const r = oc.getBoundingClientRect(); const lx = (ev.clientX - r.left) * (S.VW / r.width), ly = (ev.clientY - r.top) * (S.cellsH / r.height); const k = cellRects(0).findIndex(q => lx >= q.x && lx <= q.x + q.w && ly >= q.y && ly <= q.y + q.h); return { lx, ly, k: k < S.st.ludus.cells.length ? k : -1 }; }; // 증축 전 칸은 대상이 아니다
  c.onpointerdown = (ev) => { drag = { x0: ev.clientX, t0: performance.now() }; };
  oc.onpointerdown = (ev) => { if (!(S.cellsOpen && S.cellsP > 0.9)) return; const { lx, ly, k } = cellAt(ev); const occ = k >= 0 ? occupantOf(S.st, k) : null; if (occ) { S.cellDrag = { id: occ.id, k0: k, px: lx, py: ly, over: k, moved: false }; oc.setPointerCapture(ev.pointerId); } }; // 켈라: 사람이 있는 방에서 누르면 끌기 시작
  oc.onpointermove = (ev) => { if (!S.cellDrag) return; const { lx, ly, k } = cellAt(ev); if (Math.hypot(lx - S.cellDrag.px, ly - S.cellDrag.py) > 6) S.cellDrag.moved = true; S.cellDrag.px = lx; S.cellDrag.py = ly; S.cellDrag.over = k >= 0 ? k : null; };
  oc.onpointerup = () => { if (S.cellDrag) { const d = S.cellDrag; S.cellDrag = null; drag = null; if (d.moved) { dragged = true; const g = S.st.roster.find(x => x.id === d.id); if (g && d.over != null && d.over !== d.k0) { moveToCell(S.st, g, d.over); sfx.coin(); render(); } } } }; // 끌어서 놓으면 자리 바꿈 (놓은 방에 사람이 있으면 서로 교환). 안 움직였으면 클릭으로 처리
  c.onpointerup = (ev) => { if (!drag) return;
    if (S.cellsOpen) { drag = null; return; } const dx = ev.clientX - drag.x0, el = performance.now() - drag.t0; drag = null; dragged = Math.abs(dx) > 40 && el < 700;
    if (dragged) { const i = ORDER.indexOf(S.view); const to = ORDER[Math.max(0, Math.min(ORDER.length - 1, i + (dx < 0 ? 1 : -1)))]; if (to !== S.view) startTravel(to); } };
  c.onpointercancel = () => { drag = null; }; oc.onpointercancel = () => { S.cellDrag = null; };
  oc.onclick = (ev) => { // 켈라 덮개: 방 클릭 (배정 모드·상세)
    if (dragged) { dragged = false; return; } if (S.cellsP <= 0.9) return;
    const r = oc.getBoundingClientRect();
    { const lx = (ev.clientX - r.left) * (S.VW / r.width), ly = (ev.clientY - r.top) * (S.cellsH / r.height); const k = cellRects(0).findIndex(q => lx >= q.x && lx <= q.x + q.w && ly >= q.y && ly <= q.y + q.h); if (k >= S.st.ludus.cells.length) { S.sheet = 'facilities'; S.cellsOpen = false; render(); return; } if (k >= 0 && S.palusMode) { const occ = occupantOf(S.st, k); if (!occ) S.notice = '빈 방이다'; else if (palusOf(S.st, occ) >= 0) { leavePalus(S.st, occ); S.notice = `${occ.name} 이(가) 팔루스에서 내려왔다`; save(); }
        else { const free = Array.from({ length: S.st.ludus.palus }, (_, i) => i).find(i => !palusTrainee(S.st, i)); if (free == null) S.notice = `팔루스 ${S.st.ludus.palus}개가 모두 찼다`; else if (putAtPalus(S.st, occ, free)) { S.notice = `${occ.name} 을(를) 팔루스 ${free + 1}에 세웠다`; save(); } else S.notice = occ.injured > 0 ? '부상자는 훈련할 수 없다' : occ.status === 'doctor' ? '독토르는 가르치는 중이다' : '세울 수 없다'; }
        render(); return; } // 팔루스 배정 모드: 한 번 누르면 빈 자리에 세우고, 다시 누르면 내려온다. 켈라는 열린 채 (서판으로 닫는다)
            if (k >= 0 && S.bedPick != null) { const occ = occupantOf(S.st, k); if (occ && occ.injured > 0) { putInBed(S.st, occ, S.bedPick); S.notice = `${occ.name} 을(를) 침상 ${S.bedPick + 1}에 눕혔다`; S.bedPick = null; S.cellsOpen = false; } else S.notice = '부상자만 침상에 눕힐 수 있다'; render(); return; } // 침상 배정 모드
      if (k >= 0) { const occ = occupantOf(S.st, k); S.cellSel = k; const q = cellRects(S.st.ludus.cells.length)[k]; const ar = app.getBoundingClientRect(), sk = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--stage-k')) || 1; const cx = (r.left - ar.left) / sk + (q.x + q.w / 2) * (r.width / sk / S.VW), cy = (r.top - ar.top) / sk + (q.y + q.h / 2) * (r.height / sk / S.cellsH); if (occ) { S.gladSel = occ.id; S.detail = { kind: 'roster', id: occ.id }; S.cellPop = null; render(); return; } void cx; void cy; } return; } // 사람이 있는 방 → 검투사를 불러 상세 페이지(오른쪽에서). 빈 방은 아무것도 없음 (구매하면 자동 배정, 자리는 끌어서 바꾼다)
  };
  c.onclick = (ev) => { // 켈라 화면이면 방 클릭, 아니면 시장 매물 클릭 (카메라 보정)
    if (dragged) { dragged = false; return; }
    const r = c.getBoundingClientRect();
    if (S.view === 'grave') { S.sheet = 'chronicle'; render(); return; } // 묘비를 누르면 연대기 서랍
    if (S.view === 'medic') { // 침상 위 부상자를 누르면 치료 (확인 후). 침상이 모자라 탁자 옆에 앉은 부상자도 같다
      const lx = (ev.clientX - r.left) * (S.VW / r.width) + S.camX - TOWN.medicX, ly = (ev.clientY - r.top) * (CH() / r.height) - (GY - 210);
      const beds = Math.max(1, Math.min(4, S.st.ludus.beds)); const H = MEDIC.H;
      for (let i = 0; i < beds; i++) { const bx = 16 + i * 80; if (!(lx >= bx - 4 && lx <= bx + 88 && ly >= H - 90 && ly <= H - 4)) continue;
        const g = bedPatient(S.st, i);
        if (g) { openConfirm(g, 'heal'); return; } // 누운 부상자 → 치료 장면
        if (!S.st.roster.some(x => x.injured > 0 && !inBed(S.st, x))) { S.notice = '눕힐 부상자가 없다'; render(); return; }
        S.bedPick = i; S.cellsOpen = true; S.cellPop = null; S.cellSide = null; S.sheet = null; render(); return; } // 빈 침상 → 켈라에서 부상자 고르기
      return; } // 시설 강화는 왼쪽 망치 토글에서
    if (S.view === 'yard') { // 문루 아래 지원자를 누르면 계약 패널, 네메시스 사당을 누르면 설명과 이번 시즌 봉헌 여부
      const lx = (ev.clientX - r.left) * (S.VW / r.width) + S.camX - TOWN.yardX, ly = (ev.clientY - r.top) * (CH() / r.height) - (GY - 210);
      { const posts = palusPosts(S.st.ludus.palus), H = YARD.H; const first = posts[0] - 56, last = posts[posts.length - 1] + 12; // 팔루스 줄 전체 (기둥들과 그 왼쪽에 선 사람들)
        if (lx >= first && lx <= last && ly >= H - 104 && ly <= H - 8) { if (!S.st.roster.some(x => x.alive && x.injured <= 0 && x.status !== 'doctor')) { S.notice = '세울 검투사가 없다'; render(); return; } S.palusMode = true; S.bedPick = null; S.cellsOpen = true; S.cellPop = null; S.cellSide = null; S.sheet = null; render(); return; } } // 팔루스 줄을 누르면 켈라가 열려 배정 모드 (방을 누르면 세우고, 다시 누르면 내려온다)
      if (Math.abs(lx - YARD.W / 2) <= 30 && ly >= 30 && ly <= 86) void tell(`복수와 운명의 여신 네메시스의 감실입니다. 검투사들은 경기 전에 여기서 기도하고 봉헌했습니다(원형경기장 곁의 네메세움 비문 근거).\n이번 시즌 봉헌: ${S.st.events?.votum ? '함 (미시오 +3%)' : '안 함'}. 편성 화면의 시즌 행사에서 ${CONFIG.events.votum.cost} HS 로 봉헌하면 그 시즌 미시오 확률이 +${Math.round(CONFIG.events.votum.missio * 100)}% 오릅니다.`, '네메시스 사당');
      return; }
    if (S.view === 'ludus') { const lx = (ev.clientX - r.left) * (S.VW / r.width) + S.camX - TOWN.forumX, ly = (ev.clientY - r.top) * (CH() / r.height) - GY; // 포룸 기준 좌표 (발 = 0)
      { const yx = lx + (TOWN.forumX - TOWN.yardX), yy = ly + 210; if (S.st.applicants.length && yx >= YARD.W - 58 - S.st.applicants.length * 26 - 12 && yx <= YARD.W - 44 && yy >= 120 && yy <= 216) { S.sheet = 'applicants'; S.cellsOpen = false; render(); return; } } // 문루 아래 지원자 (문루는 훈련장 좌표에 그려지지만 포룸 화면에 보인다)
      if (lx >= 0 && lx <= FORUM.wallW + 20 && ly >= -186 && ly <= 8) { if (S.zoomIn) return; S.zoomIn = { start: performance.now(), dur: 560, wx: TOWN.forumX + FORUM.wallW / 2, wy: GY + FORUM.posterY0 + FORUM.posterGapY / 2 + FORUM.posterH / 2, k: Math.min(1.8, S.VW / FORUM.wallW), done: () => { S.phase = 'plan'; S.sheet = null; S.planSel = null; render(); } }; return; } // 공고벽·심부름꾼 → 줌인 연출 뒤 편성
      return; } // 소식은 헤더의 두루마리 아이콘에서
    if (S.view !== 'market') return; const x = ((ev.clientX - r.left) * (S.VW / r.width) + S.camX - TOWN.marketX - MK.ox) / MK.sc; // 시장 장면 좌표 (축소·가운데 정렬 반영)
    const items = S.st.market; let best: Gladiator | null = null, bd = items.length > 1 ? (marketSlotX(items.length, 1) - marketSlotX(items.length, 0)) / 2 : 80;
    items.forEach((g, i) => { const d = Math.abs(x - marketSlotX(items.length, i)); if (d < bd) { bd = d; best = g; } });
    S.marketSel = best ? (best as Gladiator).id : null; if (S.marketSel != null) { S.detail = { kind: 'market', id: S.marketSel }; S.sheet = null; } render(); // 판매대의 검투사를 누르면 상세 페이지 (오른쪽에서)
  };
  return h('div', { class: 'panel yardwrap' }, c, roadBoard());
}
// 라니스타: 크림색 토가(자주색 띠·주름), 짧은 머리·수염, 서판을 든 손. 발이 (x,y)
// 장소마다 다른 라니스타의 행동: 의무실 = 의사와 이야기(손짓) · 훈련소 = 서판 들고 보다가 이따금 지시(손가락질) · 포룸 = 공고를 올려다보며 읽고 서판에 적음 · 시장 = 몸을 숙여 매물을 살핌 · 묘지 = 고개 숙여 애도
function lanistaPose(v: View, t: number): Skeleton {
  const w = Math.sin(t * 2), slow = Math.sin(t * 0.9);
  switch (v) {
    case 'medic': return { ...NPC_POSES.point, lean: 4, frontArm: [70 + w * 18, 30 - w * 10], backArm: [-40, -25], headBob: 1 + slow };            // 손짓하며 말한다
    case 'yard': { const ph = (t % 6); return ph < 1.2 ? { ...NPC_POSES.point, frontArm: [125 + w * 4, 10] } : { ...NPC_POSES.tablet, headBob: slow * 1.5 }; }  // 6초마다 1.2초 지시
    case 'ludus': { const ph = (t % 7); return ph < 2.5 ? { ...NPC_POSES.tablet, lean: -4, frontArm: [150 + w * 3, 20], headBob: -3 } : { ...NPC_POSES.tablet, lean: 6, frontArm: [60, 55], headBob: 4 }; } // 공고를 올려다봄 ↔ 서판에 적음
    case 'market': return { ...NPC_POSES.tend, lean: 16 + w * 2, frontArm: [78 + w * 6, 28], backArm: [-38, -25], headBob: 5 };                        // 몸을 숙여 살핀다
    case 'grave': return { ...NPC_POSES.stand, lean: 10, frontArm: [40, 60], backArm: [40, 60], headBob: 9 + slow, frontLeg: [6, -2], backLeg: [-6, 2] };  // 두 손 모으고 고개 숙임
  }
}
function drawLanista(ctx: CanvasRenderingContext2D, x: number, y: number, facing: 1 | -1, t: number, walking: boolean) {
  // 기본 리그 + 토가(자주색 클라부스) + 서판. 걸을 때도 앞손은 서판을 든 채. 서 있을 땐 장소마다 다른 행동
  const sk: Skeleton = walking ? { ...walkSkeleton(t * 9, 0.8), frontArm: [55, 50] } : lanistaPose(S.view, t);
  drawStickman(ctx, 'murmillo', { x, y, scale: 1.0, facing, skeleton: sk, t, ink: INK, bare: true, garment: 'toga', garmentColor: '#f3ead0', beard: true, /* 클라부스 없음: 라니스타는 인파미스 신분 (고증) */
    hands: (c, f) => { c.fillStyle = '#d9c69a'; c.fillRect(f.hx - 2, f.hy - 12, 9, 12); c.strokeStyle = INK; c.lineWidth = 1; c.strokeRect(f.hx - 2, f.hy - 12, 9, 12); c.beginPath(); c.moveTo(f.hx, f.hy - 8); c.lineTo(f.hx + 5, f.hy - 8); c.moveTo(f.hx, f.hy - 4); c.lineTo(f.hx + 5, f.hy - 4); c.stroke(); } });
}
// 장소 이동: 화면(카메라·대시보드)이 먼저 새 장소로 옮겨가고, 라니스타는 화면 밖 가장자리에서 걸어 들어와 제자리에 선다
export function startTravel(to: View) {
  if (to === S.view && !lanista.walking) return;
  S.camPan = 0; S.sheet = null; S.marketSel = null;
  const from = S.view; S.view = to; S.camV = 0;
  S.travel = { to, from, fromX: lanista.x, start: performance.now() };
  lanista.target = restX(to);
  // 지금 화면에 보이면 순간이동 없이 끝까지 걷는다 (먼 길은 걸음을 빠르게 해 2초 안팎). 이미 화면 밖이면 새 장소 가장자리에서 등장
  const onScreen = lanista.x >= S.camX - 10 && lanista.x <= S.camX + S.VW + 10;
  const cam = camFor(to);
  if (!onScreen) lanista.x = lanista.x < lanista.target ? cam - 30 : cam + S.VW + 30;
  lanista.vmax = Math.max(340, Math.abs(lanista.target - lanista.x) / 2.2);
  lanista.walking = true; lanista.v = Math.max(lanista.v, 90);
  render();
}
// ── 검투사 시장: 판매대(카타스타) 위에 사슬로 묶인 매물이 한 줄로 서 있다. 클릭하면 앞으로 나와 강조, 아래에 상세·구매
// 시민(구경꾼·행인): 짧은 튜닉 스틱맨. pose: watch(팔짱) / point(손가락질) / child(아이) / tiptoe(까치발) / walk
export function drawCivilian(ctx: CanvasRenderingContext2D, x: number, y: number, sc: number, pose: 'watch' | 'point' | 'child' | 'tiptoe' | 'walk', t: number, seed: number, facing: 1 | -1 = 1) {
  // 기본 리그 + 튜닉. 자세만 다르다
  const tint = ['#c9b283', '#b9c2a8', '#c8a878', '#a8b6c2'][seed % 4];
  let sk: Skeleton; let scale = sc;
  if (pose === 'watch') sk = NPC_POSES.watch;
  else if (pose === 'point') { const a = Math.sin(t * 2 + seed) * 4; sk = { ...NPC_POSES.point, frontArm: [120 + a, 15] }; }
  else if (pose === 'tiptoe') sk = { ...NPC_POSES.tiptoe, lift: Math.abs(Math.sin(t * 3 + seed)) * 4 };
  else if (pose === 'walk') sk = walkSkeleton(t * 8 + seed);
  else { sk = NPC_POSES.stand; scale *= 0.62; }
  drawStickman(ctx, 'murmillo', { x, y, scale, facing, skeleton: sk, t: t + seed, ink: INK, bare: true, garment: 'tunic', garmentColor: tint });
}
