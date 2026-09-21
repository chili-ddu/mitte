// 검투사 카드 한 종류. 화면마다 따로 짜던 초상 묶음을 여기로 모았다 (2026-09-17 사용자: "카드는 모두 통일")
// 순서와 밀도는 어디서나 같다 — [초상(계급·명예) | 기술 칩] / [무기 표식 + 이름] / [전적 또는 능력치 + 덧붙임]
import type { Gladiator, Lineage } from '../core/types.js';
import { h, sq } from './dom.js';
import { CONFIG } from '../core/config.js';
import { masteryOf } from '../core/dictata.js';
import { atCap, fullyGrown } from '../core/growth.js';
import { portrait } from './portrait.js';
import { effectiveStats, powerOf, powerNow, hpParts, LINEAGE_KO } from '../core/gladiator.js';
import { overworkChance } from '../core/game.js';
import { S } from './state.js';

export const CARD_PORTRAIT = 52; // 검투사 카드의 초상 크기 — 어느 화면이든 같다 (2026-09-17 사용자: 선택칸 카드에 모두 맞춘다)
export interface GCardOpts { enemy?: boolean; size?: number; name?: string; mood?: 'grudge' | 'revenge'; foes?: Gladiator[]; /* 이번 경기에서 마주 설 상대 — 전력에 상성이 실린다 */ /* 이번 상대와의 인연 — 초상이 경계 자세로 서고 그늘·눈빛이 돈다 */ meta?: (Node | string | null | undefined)[];
  nameExtra?: (Node | null)[]; /* 이름 뒤에 붙는 표식(예명·출신·독토르 …). 그 문구를 아는 화면이 만들어 넘긴다 */
  rows?: (Node | null)[]; /* 카드 아래에 덧붙는 줄(능력치 요약 같은 것) */
  acts?: (Node | null)[]; /* 맨 아래 행동 버튼 */
  sel?: boolean; other?: boolean; dis?: boolean; cls?: string; onclick?: () => void }

const honorBadge = (g: Gladiator) => { const b = h('span', { class: 'honor', title: `명예 ${g.honor ?? 0}: 쓰러졌을 때 관중이 살려 줄 확률과 루디스에 영향` }); b.innerHTML = `<svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.5 12.9 17 22l-5-3-5 3 1.5-9.1"/></svg>`; b.append(h('i', {}, String(g.honor ?? 0))); return b; }; /* 숫자는 따로 감싸 위치를 맞춘다 (2026-09-17 사용자: 조금 높다) */ // 초상 왼쪽 아래 명예 배지
// 계보는 카드 배경의 물결무늬로 (2026-09-17 사용자: 다섯을 다 표현하되 칩을 늘리지 않는다).
// 자연=잎 · 승리=종려가지 · 신화=신전 기둥 · 별명=말풍선 · 지명=성문. 규칙이 걸린 것은 자연뿐이라 자연만 색이 산다.
const LIN_SVG: Record<Lineage, string> = {
  nature: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  victory: '<path d="M12 22V9"/><path d="M12 12c-2-3-5-4-8-4 1 3 4 5 8 4Z"/><path d="M12 12c2-3 5-4 8-4-1 3-4 5-8 4Z"/><path d="M12 8c-1.6-2.4-4-3.2-6.4-3.2C6.8 7.2 9.2 8.8 12 8Z"/><path d="M12 8c1.6-2.4 4-3.2 6.4-3.2C17.2 7.2 14.8 8.8 12 8Z"/>',
  myth: '<path d="M3 22h18"/><path d="M6 22V8"/><path d="M12 22V8"/><path d="M18 22V8"/><path d="M2 8h20"/><path d="M12 2 3 8h18Z"/>',
  nickname: '<path d="M20 15a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3Z"/><path d="M8 10h8"/><path d="M8 14h5"/>',
  place: '<path d="M3 22V10l9-6 9 6v12"/><path d="M9 22v-6a3 3 0 0 1 6 0v6"/><path d="M3 22h18"/>',
};
const lineageBg = (g: Gladiator) => { const el = h('span', { class: `linbg ${g.lineage}`, title: `${LINEAGE_KO[g.lineage]} 계보${g.lineage === 'nature' ? ' — 같은 편에 둘이면 공격 +8%, 셋이면 첫 공격에 상대를 붙든다' : ' (이름을 고르는 갈래. 전투 효과는 없다)'}` });
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
const hpBar = (g: Gladiator) => { const mine = S.st?.roster.includes(g) ?? false;
  const kitchen = mine ? (S.st.ludus.kitchen ?? 0) * CONFIG.ludus.kitchen.hpPerLevel : 0; /* 조리장은 우리 사람에게만 */
  const p = hpParts(g, kitchen), scale = Math.max(1, p.base + p.bonus);
  const solid = Math.min(p.total, p.base), extra = Math.max(0, p.total - p.base), cut = Math.max(0, p.base - p.total);
  const pct = (v: number) => `${(v / scale * 100).toFixed(1)}%`;
  return h('div', { class: 'hpbar', title: `체력 ${p.total} = 타고난 ${p.base}${p.bonus ? ` + 보탬 ${p.bonus}` : ''}${p.pen ? ` − 깎임 ${p.pen}` : ''}\n보탬: 승수 성장·조리장·가벼운 몸 · 깎임: 피로·노쇠·무거운 몸` },
    h('div', { class: 'track' }, h('i', { class: 'extra', style: `width:${pct(extra)}` }), h('i', { class: 'solid', style: `width:${pct(solid)}` }), h('i', { class: 'cut', style: `width:${pct(cut)}` }), h('span', { class: 'n' }, String(p.total)))); };
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
const statLines = (g: Gladiator, foes: Gladiator[] = []) => { const e = effectiveStats(g), b = g.base;
  const stat = (k: string, now: number, base: number, capped = false) => h('div', { class: `sline${capped ? ' capped' : ''}`, title: capped ? '더 자라지 않는다 — 상한에 닿았다' : '' }, h('span', { class: 'k' }, k),
    h('span', { class: 'v' }, String(now), now !== base ? h('em', { class: now > base ? 'up' : 'down' }, `${now > base ? '+' : '−'}${Math.abs(now - base)}`) : null));
  const pw = Math.round(powerNow(g, foes)), pw0 = Math.round(powerOf(g)), d = pw - pw0; // 타고난 전력과의 차이 (상성 포함)
  const prev = shownPower.get(g.id); shownPower.set(g.id, pw); const rolling = prev != null && prev !== pw; // 값이 실제로 달라졌을 때만 굴린다
  const pwLine = h('div', { class: `sline pw ${rolling ? 'flat' : d > 0 ? 'up' : d < 0 ? 'down' : 'flat'}`, title: `전력 ${pw}${d ? ` (타고난 ${pw0} 에서 ${d > 0 ? '+' : '−'}${Math.abs(d)})` : ''} — 승수 성장·예명·노쇠·피로·몸 상태${foes.length ? '·이번 상대와의 상성' : ''}을 반영한 지금 값` });
  pwLine.innerHTML = `<svg class="pwi" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/></svg>`;
  const vEl = h('span', { class: 'v' }, String(rolling ? prev : pw));
  pwLine.append(vEl, h('em', { class: 'tr' }, d > 0 ? '▲' : d < 0 ? '▼' : '\u00a0'));
  if (rolling) rollTo(pwLine, vEl, prev!, pw, d); // 상성이 붙으면 숫자가 굴러가고 색이 서서히 물든다 /* 화살표는 줄 맨 오른쪽에 못 박는다 — 숫자가 길어져도 자리가 안 흔들린다 (2026-09-17 사용자) */ /* 오름·내림은 화살표와 글자 색으로. 화살표가 없어도 자리는 비워 둔다 (2026-09-17 사용자) */
  return [stat('ATK', e.atk, b.atk, atCap(g, 'atk')), stat('DEF', e.def, b.def, atCap(g, 'def')),
    h('div', { class: 'sline rec' }, h('span', { class: 'v' }, `${g.fights}전 ${g.wins}승`), fullyGrown(g) ? h('span', { class: 'grown', title: '다 컸다 — 네 능력치 모두 상한. 팔거나 독토르로' }, '다 컸다') : null), pwLine]; };
const SKILL_ROWS = 3; // 기술 칩 자리: 기술 개념은 2026-09-18 뺐다(유형 정리 때 유형 기술 하나로 돌아올 자리). 빈 자리 셋을 그대로 잡아 카드 높이가 흔들리지 않게
export const emptySlots = (n = SKILL_ROWS) => Array.from({ length: n }, () => h('span', { class: 'badge empty lock' }));
const skillChips = (g: Gladiator) => { const have = masteryOf(g); return [...have.map(m => h('span', { class: 'badge skill', title: `${m.name}: ${m.ko} (${m.cond.ko})` }, m.name)), ...emptySlots(Math.max(0, SKILL_ROWS - have.length))]; }; /* 익힌 숙련 딕타타 (docs/09 2-α) — 빈 자리는 잠금 */

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

// 낱장(줄 셋). 이미 타일 상자가 있는 곳(.gtile·.etile·.slot)은 이것을 펼쳐 쓴다
export const gladCardParts = (g: Gladiator, opts: GCardOpts = {}) => [
  lineageBg(g), handBg(g), /* 카드 배경: 왼쪽 위 계보 · 오른쪽 아래 쥐는 손 (2026-09-17 사용자) */
  h('div', { class: 'mini-top' },
    h('div', { class: 'mini-left' }, /* 스틱맨 박스와 체력바가 한 기둥 — 기술 칩은 그 높이만큼 선다 (2026-09-17 사용자) */
      h('div', { class: 'mini-port' }, portrait(g, opts.size ?? CARD_PORTRAIT, !!opts.enemy, undefined, opts.size ?? CARD_PORTRAIT, false, opts.mood), g.injured > 0 ? woundMark(g) : null, tiredMark(g), /* 피로는 0 이어도 늘 보인다 — 남은 숨을 재는 눈금이다 (2026-09-17 사용자) */ g.rank === 'tiro' ? tiroMark() : null, honorBadge(g)),
      hpBar(g)),
    h('div', { class: 'mini-skills' }, ...skillChips(g))),
  h('div', { class: 'mini-name' }, sq(g.type), ' ', opts.name ?? g.name.replace('(적)', ''), ...(opts.nameExtra ?? []).filter((n): n is Node => !!n)),
  h('div', { class: 'mini-stats', title: '실제 싸울 때의 값 (승수 성장·피로·노쇠·예명 반영). 옆의 숫자는 타고난 값과의 차이' }, ...statLines(g, opts.foes)),
  (opts.meta ?? []).filter(Boolean).length ? h('div', { class: 'mini-meta' }, ...(opts.meta ?? [])) : null,
];
// 상자까지 포함한 카드. 새로 카드를 놓는 자리는 이것을 쓴다
export const gladCard = (g: Gladiator, opts: GCardOpts = {}) => h('div', { class: `gcard${opts.enemy ? ' enemy' : ''}${opts.sel ? ' sel' : ''}${opts.other ? ' other' : ''}${opts.dis ? ' dis' : ''}${opts.cls ? ` ${opts.cls}` : ''}`, onclick: opts.onclick },
  ...gladCardParts(g, opts),
  ...(opts.rows ?? []).filter((n): n is Node => !!n).map(n => h('div', { class: 'gc-row' }, n)),
  (opts.acts ?? []).filter(Boolean).length ? h('div', { class: 'gc-acts' }, ...(opts.acts ?? []).filter((n): n is Node => !!n)) : null);
