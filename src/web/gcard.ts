// 검투사 카드 한 종류. 화면마다 따로 짜던 초상 묶음을 여기로 모았다 (2026-09-17 사용자: "카드는 모두 통일")
// 순서와 밀도는 어디서나 같다 — [초상(명예·티로 T)+체력바 | ATK·DEF·DEX·SPD] / [무기 표식 + 이름] / [전적 · 전력]. 딕타타는 카드에 안 보인다 (2026-09-22 사용자)
import type { Gladiator, Lineage } from '../core/types.js';
import { h, sq } from './dom.js';
import { CONFIG } from '../core/config.js';
import { atCap } from '../core/growth.js';
import { portrait } from './portrait.js';
import { effectiveStats, powerOf, powerNow, hpParts, LINEAGE_KO, LINEAGE_DESC } from '../core/gladiator.js';
import { overworkChance } from '../core/game.js';
import { S } from './state.js';

export const CARD_PORTRAIT = 52; // 검투사 카드의 초상 크기 — 어느 화면이든 같다 (2026-09-17 사용자: 선택칸 카드에 모두 맞춘다)
export interface GCardOpts { enemy?: boolean; size?: number; name?: string; mood?: 'grudge' | 'revenge'; foes?: Gladiator[]; /* 이번 경기에서 마주 설 상대 — 전력에 상성이 실린다 */ /* 이번 상대와의 인연 — 초상이 경계 자세로 서고 그늘·눈빛이 돈다 */ meta?: (Node | string | null | undefined)[];
  nameExtra?: (Node | null)[]; /* 이름 뒤에 붙는 표식(예명·출신·독토르 …). 그 문구를 아는 화면이 만들어 넘긴다 */
  rows?: (Node | null)[]; /* 카드 아래에 덧붙는 줄(능력치 요약 같은 것) */
  acts?: (Node | null)[]; /* 맨 아래 행동 버튼 */
  bars?: boolean; capNums?: boolean; figure?: number; hgt?: number; missio?: boolean; age?: boolean; /* 이름 옆에 작은 나이 (상세만 — 검투사 카드엔 안 나온다, 2026-09-22 사용자) */ /* 전적 옆에 미시오 (상세만, 2026-09-22 사용자) */ /* figure: 초상 속 검투사만 키우는 배율 (흙 바탕은 그대로) · hgt: 초상 캔버스 높이를 따로 (창끝이 위로 잘리지 않게) */ /* 오른쪽 기둥을 숫자 대신 상한까지의 막대로 (상세의 넓은 카드, 2026-09-22 사용자). capNums: 상한 숫자도 (디버그) */
  sel?: boolean; other?: boolean; dis?: boolean; cls?: string; onclick?: () => void }

const honorBadge = (g: Gladiator) => { const b = h('span', { class: 'honor', title: `명예 ${g.honor ?? 0}: 쓰러졌을 때 관중이 살려 줄 확률과 루디스에 영향` }); b.innerHTML = `<svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.5 12.9 17 22l-5-3-5 3 1.5-9.1"/></svg>`; b.append(h('i', {}, String(g.honor ?? 0))); return b; }; /* 숫자는 따로 감싸 위치를 맞춘다 (2026-09-17 사용자: 조금 높다) */ // 초상 왼쪽 아래 명예 배지
// 계보는 카드 배경의 물결무늬로 (2026-09-17 사용자: 다섯을 다 표현하되 칩을 늘리지 않는다).
// 자연=잎 · 승리=종려가지 · 신화=신전 기둥 · 별명=말풍선 · 지명=성문. 규칙이 걸린 것은 자연뿐이라 자연만 색이 산다.
const LIN_SVG: Record<Lineage, string> = {
  nature: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  victory: '<path d="M12 22V4"/><path d="M12 19c-4.2-1.4-7.3-4-9.2-7.6 4.2-.2 7.2 1.3 9.2 4.4Z"/><path d="M12 19c4.2-1.4 7.3-4 9.2-7.6-4.2-.2-7.2 1.3-9.2 4.4Z"/><path d="M12 14c-3.7-1.4-6.4-3.7-8-7 3.7-.1 6.3 1.2 8 3.8Z"/><path d="M12 14c3.7-1.4 6.4-3.7 8-7-3.7-.1-6.3 1.2-8 3.8Z"/><path d="M12 9c-2.6-1.3-4.4-3.2-5.4-5.8 2.8.2 4.6 1.2 5.4 3.2Z"/><path d="M12 9c2.6-1.3 4.4-3.2 5.4-5.8-2.8.2-4.6 1.2-5.4 3.2Z"/>',
  myth: '<path d="M3 22h18"/><path d="M6 22V8"/><path d="M12 22V8"/><path d="M18 22V8"/><path d="M2 8h20"/><path d="M12 2 3 8h18Z"/>',
  nickname: '<path d="M20 15a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3Z"/><path d="M8 10h8"/><path d="M8 14h5"/>',
  place: '<path d="M3 22V10l9-6 9 6v12"/><path d="M9 22v-6a3 3 0 0 1 6 0v6"/><path d="M3 22h18"/>',
};
const lineageBg = (g: Gladiator) => { const el = h('span', { class: `linbg ${g.lineage}`, title: `이름 유래: ${LINEAGE_KO[g.lineage]} — ${LINEAGE_DESC[g.lineage]}${g.lineage === 'nature' ? '. 같은 편에 둘이면 공격 +8%, 셋이면 첫 공격에 상대를 붙든다' : ' (전투 효과는 없다)'}` });
  el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${LIN_SVG[g.lineage]}</svg>`;
  return el; };
// 어느 손으로 쥐는가 — 계보 무늬 맞은편(왼쪽 아래)에 벽에 긁어 쓴 L·R. 획을 삐뚤게 긋고 붉은 덧선을 얹는다 (2026-09-17 사용자)
const HAND_SVG = {
  R: '<path d="M6.5 3.5 L7.2 21"/><path d="M6.8 3.8 C13 3, 16.5 5.2, 16 8.6 C15.6 11.6, 12 12.6, 7 12.2"/><path d="M10 12.4 L17 21"/>',
  L: '<path d="M8 3 L7.2 20.4"/><path d="M7.2 20.4 L18 19.4"/>',
};
const handBg = (g: Gladiator) => { const left = !!g.scaeva;
  const el = h('span', { class: `handbg ${left ? 'left' : 'right'}`, title: left ? '왼손잡이(스카이바): 열에 하나. 반대쪽에서 들어오니 상대가 방패로 막을 확률이 절반이 된다. 상대도 왼손잡이면 서로 익숙해 효과가 없다' : '오른손잡이 — 여느 검투사처럼 오른손으로 쥔다' });
  const d = HAND_SVG[left ? 'L' : 'R'];
  el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">`
    + `<g stroke="currentColor" stroke-width="2.6">${d}</g>`
    + `<g stroke="#9b2c1c" stroke-width="1.1" opacity=".55" transform="translate(.8 -.6)">${d}</g>` /* 붉은 덧선: 낙서를 두 번 긁은 자국 */
    + `</svg>`;
  return el; };
// 체력바: 왼쪽부터 진한 초록=보태진 몫(승수 성장·조리장·가벼운 몸) · 연두=타고난 몫 · 붉은=깎인 몫(피로·노쇠·무거운 몸) (2026-09-17 사용자)
const hpBar = (g: Gladiator, capNums = false) => { const mine = S.st?.roster.includes(g) ?? false;
  const kitchen = mine ? (S.st.ludus.kitchen ?? 0) * CONFIG.ludus.kitchen.hpPerLevel : 0; /* 조리장은 우리 사람에게만 */
  const p = hpParts(g, kitchen); const UNIT = HP_UNIT; /* 체력바는 독자적인 둥근 막대, 한 단 120 (2026-09-22 사용자): 120 이 차면 다음 색이 덮고, 상한은 그 단 색의 눈금 */
  const split = (x: number) => { let t = Math.floor(x / UNIT), r = x - t * UNIT; if (r === 0 && t > 0) { t--; r = UNIT; } return { t, r }; }; const col = (i: number) => TIER_COLORS[Math.min(TIER_COLORS.length - 1, i)];
  const { t: tier, r: rem } = split(p.total); const cap = g.cap?.hp ?? p.base; const { t: capTier, r: capRem } = split(cap); const capped = atCap(g, 'hp');
  const cutW = Math.min(rem, p.pen); /* 깎인 몫(피로)은 채움 끝에 붉게 */
  return h('div', { class: `hpbar${capped ? ' capped' : ''}`, title: `체력 ${p.total} = 타고난 ${p.base}${p.bonus ? ` + 보탬 ${p.bonus}` : ''}${p.pen ? ` − 깎임 ${p.pen}` : ''} — ${UNIT}씩 ${tier}줄 채우고 ${rem}${capNums ? ` · 상한 ${cap}` : ''}${capped ? ' · 상한에 닿았다' : ''}\n보탬: 조리장 · 깎임: 피로` },
    h('div', { class: 'track', style: `background:${tier > 0 ? col(tier) : ''}` }, h('i', { class: 'fill', style: `width:${(rem / UNIT * 100).toFixed(1)}%;background:${col(tier + 1)}` }), cutW > 0 ? h('i', { class: 'cut', style: `left:${((rem - cutW) / UNIT * 100).toFixed(1)}%;width:${(cutW / UNIT * 100).toFixed(1)}%` }) : null,
      h('i', { class: 'capmark', style: `left:${(capRem / UNIT * 100).toFixed(1)}%;background:${col(capTier + 1)}`, title: capNums ? `상한 ${cap}` : '상한' }), h('span', { class: 'n' }, String(p.total)))); };
// 전력이 달라지면 숫자를 굴리고 색을 서서히 입힌다 (2026-09-17 사용자). 화면마다 마지막으로 보여 준 값을 기억해 두고, 바뀐 카드만 움직인다
const shownPower = new Map<number, number>();
function rollTo(line: HTMLElement, el: HTMLElement, from: number, to: number, d: number) {
  const ROLL = 520, t0 = performance.now();
  requestAnimationFrame(() => { line.classList.remove('flat'); line.classList.add(d > 0 ? 'up' : d < 0 ? 'down' : 'flat'); }); /* 색은 CSS transition 으로 번진다 */
  const step = () => { const k = Math.min(1, (performance.now() - t0) / ROLL), e = 1 - Math.pow(1 - k, 3); /* 끝에서 부드럽게 멎는다 */
    el.textContent = String(Math.round(from + (to - from) * e));
    if (k < 1 && el.isConnected) requestAnimationFrame(step); else el.textContent = String(to); };
  requestAnimationFrame(step);
}
// 아래: 왼쪽 칸 능력치 · 오른쪽 칸 전적. 숫자는 **실제 싸울 때의 값**이다 — 승수 성장·피로·노쇠·예명이 모두 녹아 있고,
// 타고난 값과 다르면 그 차이를 옆에 붙인다. 미시오는 뺐다: 규칙에서 쓰이는 데가 예명 '불사' 뿐이다 (2026-09-17 사용자)
const CELLS = 20; // 막대 하나 = 스무 칸, 한 칸 = 1점 (2026-09-22 사용자: 상세 카드가 가로 전체를 쓰게 되어 열에서 스물로). 스무 칸이 차면 다음 색이 덮는다 — 단은 20 단위 (공 33 = 1단 + 13칸, 걸음 8 = 8칸)
const HP_UNIT = 120; /* 체력 한 단 (2026-09-22 사용자): 티로(76~110)는 1단 초록, 다 큰 보통 상한(130~220)은 2단 파랑, 천부 한 우물 무르밀로 최대(약 330)만 3단 빨강 */
const TIER_UNIT = { atk: CELLS, def: CELLS, hand: CELLS, hp: HP_UNIT, spd: CELLS } as const; // 체력은 알약 막대에서 한 단 120 (2026-09-22 사용자)
const TIER_COLORS = ['#d8c596', '#3f9b2f', '#1f5fd6', '#c8281e']; // 빈 칸 모래 → 1단 초록 → 2단 파랑 → 3단부터 빨강 (2026-09-22 사용자: 초록·파랑·빨강 셋만). 능력치는 한 단 20, 체력은 100 — 이웃한 단끼리 색상환에서 멀게 (2026-09-22 사용자: 초록·청록·청은 헷갈렸다)
const statLines = (g: Gladiator, foes: Gladiator[] = [], bars = false, capNums = false, missio = false) => { const e = effectiveStats(g), b = g.base;
  /* 칸 막대 (2026-09-22 사용자): 능력치를 '단' 으로 나눠 한 단이 차면 다음 색이 위를 덮는다 (격투 게임 체력바처럼). 상한은 그 단의 색으로 칠한 화살표 */
  const bar = (k: 'atk' | 'def' | 'hand' | 'hp' | 'spd', label: string) => { const fixed = k === 'spd'; const cap = fixed ? 8 : (g.cap?.[k] ?? b[k]); const capped = !fixed && atCap(g, k); const now = k === 'spd' ? e.spd : k === 'hand' ? e.hand : e[k];
    const unit = TIER_UNIT[k]; const v = b[k]; const split = (x: number) => { let t = Math.floor(x / unit), r = x - t * unit; if (r === 0 && t > 0) { t--; r = unit; } return { t, r }; }; /* 딱 채운 값은 그 단이 꽉 찬 것으로 */
    const { t: tier, r: rem } = split(v); const col = (i: number) => TIER_COLORS[Math.min(TIER_COLORS.length - 1, i)];
    const under = col(tier), over = col(tier + 1), fw = rem / unit; /* 바탕 = 채운 단의 색(0단이면 모래), 위 = 채우는 중인 다음 단의 색. 걸음도 같은 단 규칙(한 단 2), 상한 화살표만 없다 */
    const { t: capTier, r: capRem } = split(cap); const capX = capRem / unit; const capColor = col(capTier + 1);
    const tip = fixed ? `걸음 ${v} — 유형이 정하고 자라지 않는다 (가장 빠른 유형 8)` : `${label} ${v} — ${unit}씩 ${tier}줄 채우고 ${rem}${k === 'hp' ? ' (한 칸 10)' : '칸'}${capNums ? ` · 상한 ${cap}` : ''}${capped ? ' · 상한에 닿았다' : ''}`;
    const per = unit / CELLS; const lit = Math.floor(rem / per); const cells = Array.from({ length: CELLS }, (_, i) => h('i', { class: i < lit ? 'on' : '', style: i < lit ? `background:${over}` : tier > 0 ? `background:${under}` : '' })); /* 켜진 칸 = 채우는 중인 단의 색, 꺼진 칸 = 아래 단의 색(0단이면 모래). 체력은 한 칸 10 이라 정수 칸만 */
    void fw; void capX;
    const markRem = (fixed ? rem : capRem) / per, markColor = fixed ? over : capColor; /* 걸음은 상한이 없으니 제 값 칸에 표식 (유형 고정) */
    return h('div', { class: `sline gbar cells${capped ? ' capped' : ''}${fixed ? ' fixed' : ''}`, title: tip }, h('span', { class: 'k' }, label), h('div', { class: 'trackwrap' }, h('div', { class: 'track' }, ...cells), h('div', { class: 'ruler' }, h('i', { class: 'tick t0' }), h('i', { class: 'tick t5' }), h('i', { class: 'tick t10' }), h('s', { class: 'capmark', style: `left:${(((markRem - 0.5) / CELLS) * 100).toFixed(1)}%;color:${markColor}`, title: fixed ? '유형 고정' : capNums ? `상한 ${cap}` : '상한' }, '▲'))), h('b', { class: 'v' }, capNums && !fixed ? `${now}/${cap}` : String(now), now !== b[k] ? h('em', { class: now > b[k] ? 'up' : 'down' }, `${now > b[k] ? '+' : '−'}${Math.abs(now - b[k])}`) : null)); }; /* 자(ruler): 0·10 에 긴 눈금, 5·6 사이에 짧은 눈금, 상한은 자 위의 ▲ (2026-09-22 사용자) — 막대 위에 두면 카드 위쪽에서 잘렸다 */
  const stat = (k: string, now: number, base: number, capped = false) => h('div', { class: `sline${capped ? ' capped' : ''}`, title: capped ? '더 자라지 않는다 — 상한에 닿았다' : '' }, h('span', { class: 'k' }, k),
    h('span', { class: 'v' }, String(now), now !== base ? h('em', { class: now > base ? 'up' : 'down' }, `${now > base ? '+' : '−'}${Math.abs(now - base)}`) : null));
  const pw = Math.round(powerNow(g, foes)), pw0 = Math.round(powerOf(g)), d = pw - pw0; // 타고난 전력과의 차이 (상성 포함)
  const prev = shownPower.get(g.id); shownPower.set(g.id, pw); const rolling = prev != null && prev !== pw; // 값이 실제로 달라졌을 때만 굴린다
  const pwLine = h('div', { class: `sline pw ${rolling ? 'flat' : d > 0 ? 'up' : d < 0 ? 'down' : 'flat'}`, title: `전력 ${pw}${d ? ` (타고난 ${pw0} 에서 ${d > 0 ? '+' : '−'}${Math.abs(d)})` : ''} — 승수 성장·예명·노쇠·피로·몸 상태${foes.length ? '·이번 상대와의 상성' : ''}을 반영한 지금 값` });
  pwLine.innerHTML = `<svg class="pwi" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/></svg>`;
  const vEl = h('span', { class: 'v' }, String(rolling ? prev : pw));
  pwLine.prepend(h('em', { class: 'tr' }, h('i', { class: d > 0 ? 'on' : '' }, '▲'), h('i', { class: d < 0 ? 'on' : '' }, '▼'))); pwLine.append(vEl); /* 화살표는 위아래 한 쌍이 늘 있고 해당하는 쪽만 켜진다 (2026-09-22 사용자) · 칼 아이콘 · 값, 오른쪽 정렬 */
  if (rolling) rollTo(pwLine, vEl, prev!, pw, d); // 상성이 붙으면 숫자가 굴러가고 색이 서서히 물든다 /* 화살표는 줄 맨 오른쪽에 못 박는다 — 숫자가 길어져도 자리가 안 흔들린다 (2026-09-17 사용자) */ /* 오름·내림은 화살표와 글자 색으로. 화살표가 없어도 자리는 비워 둔다 (2026-09-17 사용자) */
  return { col: bars ? [bar('atk', 'ATK'), bar('def', 'DEF'), bar('hand', 'DEX'), bar('spd', 'SPD')] : [stat('ATK', e.atk, b.atk, atCap(g, 'atk')), stat('DEF', e.def, b.def, atCap(g, 'def')), stat('DEX', e.hand, b.hand, atCap(g, 'hand')), stat('SPD', e.spd, b.spd)], /* 오른쪽 기둥: 능력치 넷 (2026-09-22 사용자: 딕타타 칩 대신) */
    row: [h('div', { class: 'sline rec' }, h('span', { class: 'v' }, `${g.fights}전 ${g.wins}승${missio ? ` · 미시오 ${g.missios}` : ''}`), ), pwLine] }; }; /* 전적 줄엔 칩을 두지 않는다 — 전설·'다 컸다' 둘 다 뺐다. 다 컸다는 어디에도 표현하지 않는다 (2026-09-22 사용자) */ /* 자질 칩은 뺐다 — 초상 뒤 흙빛이 말한다 (2026-09-22 사용자). 표식 자리엔 전설·다 컸다만 */ /* 자질 표식 (2026-09-22 사용자: 처음부터 공개) */

// 부상: 린넨 띠에 피가 배어난다. 단계가 오를수록 얼룩이 커지고 번진다 (1~3시즌, 2026-09-17 사용자)
const woundMark = (g: Gladiator) => { const lv = Math.max(1, Math.min(3, g.injured)); const el = h('span', { class: `wound w${lv}`, title: `부상: 앞으로 ${g.injured}시즌 쉰다. 치료비를 내면 바로 낫는다` });
  const blood = [`<circle cx="9.4" cy="5" r="1.9" fill="#7a1f16" opacity=".8"/>`,
    `<circle cx="9.6" cy="4.9" r="2.7" fill="#7a1f16" opacity=".9"/><circle cx="5.4" cy="9.4" r="1.7" fill="#7a1f16" opacity=".65"/>`,
    `<circle cx="9.3" cy="5.2" r="3.4" fill="#7a1f16"/><circle cx="5" cy="9.6" r="2.4" fill="#7a1f16" opacity=".85"/><circle cx="12" cy="9.8" r="1.6" fill="#8a2417" opacity=".75"/>`][lv - 1];
  el.innerHTML = `<svg viewBox="0 0 16 16" width="19" height="19"><g stroke="#3a2412" stroke-width="5" stroke-linecap="round" opacity=".4"><path d="M2.5 6.4 L13 2.6"/><path d="M3 11.2 L13.4 7.4"/></g><g stroke="#f3ead0" stroke-width="3.6" stroke-linecap="round"><path d="M2.5 6.4 L13 2.6"/><path d="M3 11.2 L13.4 7.4"/></g>${blood}</svg>`;
  return el; };
// 피로: 숨이 줄어드는 눈금 넷. 쌓일수록 칸이 **빠진다**(채우면 배터리가 차는 것처럼 보인다 — 2026-09-17 사용자).
// 과로가 시작되는 피로 4 부터는 테두리가 붉게 선다
const tiredMark = (g: Gladiator) => { const f = g.fatigue ?? 0, F = CONFIG.fatigue;
  const cells = F.overworkAt - F.free - 1; /* 벌 없는 피로(1)와 과로가 시작되는 피로(5) 사이 — 지금 규칙으로 셋. 4 에서 다 빈다 */
  const left = Math.max(0, Math.min(cells, F.overworkAt - 1 - f)), hot = f >= F.overworkAt; /* 4 에서 칸이 다 비고, 5(과로 시작)부터 테두리가 붉다 (2026-09-17 사용자) */
  const pen = Math.max(0, f - F.free) * F.statPenalty;
  return h('span', { class: `tired${hot ? ' hot' : left === 0 ? ' warn' : ''}`, title: `피로 ${f} — 남은 숨 ${left}/${cells}${pen ? `. 공·방 −${pen} · 체력 −${pen * CONFIG.hpPenPerStat}` : f ? '. 아직 벌은 없다' : ''}${f >= F.overworkAt ? `. 과로 구간이다 — 시즌 끝에 과로사 ${Math.round(overworkChance(f) * 100)}%` : f ? '. 쉬면 돌아온다' : ''}` },
    ...Array.from({ length: cells }, (_, i) => h('i', { class: i < left ? 'on' : '' }))); };
// 티로: 벽에 긁어 쓴 T. 폼페이 광고·낙서가 첫 경기인 자에게만 t. 를 붙였다 — 베테라누스는 표식이 없는 것이 기본이다 (2026-09-17 사용자)
const tiroMark = () => { const el = h('span', { class: 'tiro', title: "티로: 아직 경기를 치르지 않은 신참. 폼페이 낙서도 신참에게만 't.' 를 붙였다 (v. 승리 · m. 미시오 · p. 사망과 같은 표기)" });
  el.innerHTML = `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke-linecap="round"><g stroke="#f3ead0" stroke-width="4.4" opacity=".55"><path d="M3.4 3.6 L12.8 2.9"/><path d="M8 3.2 L7.4 13"/></g><g stroke="#3a2412" stroke-width="2.4"><path d="M3.4 3.6 L12.8 2.9"/><path d="M8 3.2 L7.4 13"/></g><g stroke="#9b2c1c" stroke-width="1" opacity=".6"><path d="M3.8 4.4 L12.6 3.7"/><path d="M8.6 3.6 L8 12.6"/></g></svg>`;
  return el; };

// 낱장. 이미 타일 상자가 있는 곳(.gtile·.etile·.slot)은 이것을 펼쳐 쓴다.
// 2026-09-22 사용자: 카드 본체(.gc-core)는 어디서나 같은 폭·높이 — 초상+칩 / 유형+이름 / 능력치 넷만. 길이가 변하는 것(예명·출신 표식, 힌트 meta)은 본체 밖 .gc-below 로
export const gladCardParts = (g: Gladiator, opts: GCardOpts = {}) => { const lines = statLines(g, opts.foes, !!opts.bars, !!opts.capNums, !!opts.missio); return [
  lineageBg(g), handBg(g), /* 카드 배경: 왼쪽 위 계보 · 오른쪽 아래 쥐는 손 (2026-09-17 사용자) */
  h('div', { class: 'gc-core' },
  h('div', { class: 'mini-top' },
    h('div', { class: 'mini-left' }, /* 스틱맨 박스와 체력바가 한 기둥 — 기술 칩은 그 높이만큼 선다 (2026-09-17 사용자) */
      h('div', { class: 'mini-port' }, portrait(g, opts.size ?? CARD_PORTRAIT, !!opts.enemy, undefined, opts.hgt ?? opts.size ?? CARD_PORTRAIT, false, opts.mood, opts.figure), g.injured > 0 ? woundMark(g) : null, tiredMark(g), /* 피로는 0 이어도 늘 보인다 — 남은 숨을 재는 눈금이다 (2026-09-17 사용자) */ g.rank === 'tiro' ? tiroMark() : null, honorBadge(g)),
      hpBar(g, !!opts.capNums)),
    h('div', { class: 'mini-stats mini-col', title: '실제 싸울 때의 값 (피로·예명·몸 상태 반영). 옆의 숫자는 타고난 값과의 차이. 상한에 닿으면 굵게' }, ...lines.col)),
  h('div', { class: 'mini-name', title: opts.name ?? g.name.replace('(적)', '') }, sq(g.type), ' ', h('span', { class: 'nm' }, opts.name ?? g.name.replace('(적)', '')), opts.age && g.age != null ? h('span', { class: 'agetag' }, `${g.age}세`) : null),
  h('div', { class: 'mini-stats mini-row' }, ...lines.row)),
  ((opts.nameExtra ?? []).filter(Boolean).length || (opts.meta ?? []).filter(Boolean).length) ? h('div', { class: 'gc-below' }, ...(opts.nameExtra ?? []).filter((n): n is Node => !!n), ...(opts.meta ?? []).filter((n): n is Node => !!n)) : null,
]; };
// 상자까지 포함한 카드. 새로 카드를 놓는 자리는 이것을 쓴다. 상자(.gcard)는 본체 크기로 고정이고, 덧붙는 줄(rows)·행동(acts)·표식(nameExtra)·meta 는 옆(.gc-side)에 선다 — 좁으면 아래로 내려간다 (2026-09-22 사용자)
export const gladCard = (g: Gladiator, opts: GCardOpts = {}) => { const parts = gladCardParts(g, { ...opts, nameExtra: [], meta: [] });
  const side = [...(opts.nameExtra ?? []).filter(Boolean).length || (opts.meta ?? []).filter(Boolean).length ? [h('div', { class: 'gc-tags' }, ...(opts.nameExtra ?? []).filter((n): n is Node => !!n), ...(opts.meta ?? []).filter((n): n is Node => !!n))] : [],
    ...(opts.rows ?? []).filter((n): n is Node => !!n).map(n => h('div', { class: 'gc-row' }, n)),
    ...((opts.acts ?? []).filter(Boolean).length ? [h('div', { class: 'gc-acts' }, ...(opts.acts ?? []).filter((n): n is Node => !!n))] : [])];
  return h('div', { class: `gcwrap${opts.cls ? ` ${opts.cls}` : ''}${opts.dis ? ' dis' : ''}`, onclick: opts.onclick },
    h('div', { class: `gcard${opts.enemy ? ' enemy' : ''}${opts.sel ? ' sel' : ''}${opts.other ? ' other' : ''}${opts.dis ? ' dis' : ''}${opts.cls ? ` ${opts.cls}` : ''}` }, ...parts),
    side.length ? h('div', { class: 'gc-side' }, ...side) : null); };
