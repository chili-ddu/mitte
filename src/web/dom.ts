// DOM 도우미: h()·모달(ask/tell)·드롭다운·툴팁·칩 판별. 화면 모듈이 모두 쓴다
import { S } from './state.js';
import { type GType } from '../core/types.js';
import { TYPE_COLOR, glyphSvg } from './portrait.js';

 // 새 기술 모달: 보고 있는 검투사 순번 // 켈라 화면: 디스플레이 아래에서 위로 올라온다 (0~1) // 화면 위에 여는 시트(모달). 스크롤 대신 시트로 상세를 본다
export const hintSpan = (t: string) => h('span', { class: 'hint', style: 'text-transform:none;letter-spacing:0;margin-left:8px' }, t);
// 확인 창: 브라우저 confirm/alert 대신 게임 안 모달 (폰에서도 같은 모양, 화면 재구성과 무관하게 body 에 붙는다)
export function ask(msg: string, opts: { ok?: string; cancel?: boolean; title?: string } = {}): Promise<boolean> {
  return new Promise(res => {
    const close = (v: boolean) => { ov.remove(); res(v); };
    const ov = h('div', { class: 'overlay', onclick: (ev: Event) => { if (ev.target === ev.currentTarget) close(false); } },
      h('div', { class: 'modal ask' }, opts.title ? h('h2', {}, opts.title) : null, ...msg.split('\n').map(l => l.startsWith('· ') ? h('p', { class: 'fx' }, l.slice(2)) : h('p', {}, l)), // '· ' 로 시작하는 줄은 효과 설명 (다른 색)
        h('div', { class: 'actions' }, opts.cancel === false ? null : h('button', { onclick: () => close(false) }, '취소'), h('button', { class: 'primary', onclick: () => close(true) }, opts.ok ?? '확인'))));
    document.body.append(ov); (ov.querySelector('button.primary') as HTMLButtonElement).focus();
  });
}
// 토스트: 화면 위 가운데에 떴다가 떠오르며 사라지는 한 줄. **이 함수가 유일한 통로다** — 화면마다 따로 만들지 않는다 (2026-09-17 사용자)
// 말만 넘기면 되고(`toast('…')`), 좋고 나쁨은 tone 으로. `S.notice` 도 render() 가 이 함수로 흘려보낸다.
let toastTimer = 0;
export function toast(text: string, tone: 'good' | 'bad' | 'plain' = 'plain') {
  if (!text) return;
  document.querySelector('.toast')?.remove(); window.clearTimeout(toastTimer);
  const el = h('div', { class: `toast ${tone}` }, text); document.body.append(el);
  toastTimer = window.setTimeout(() => el.remove(), 3600); // 애니메이션(toastup 3.6s)이 끝나면 치운다
}
export const tell = (msg: string, title?: string) => ask(msg, { cancel: false, title });
// ? 아이콘: 누르면 자세한 설명 모달. 화면에는 짧은 말만 남긴다
export const helpBtn = (title: string, body: string) => { const b = h('button', { class: 'qmark', title: '설명', onclick: (ev: Event) => { ev.stopPropagation(); void tell(body, title); } });
  b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>'; return b; }; // 인라인 SVG (Lucide circle-help 형태), 파일 요청 없음
function dropdown(key: string, options: { value: string; label: string }[], value: string, onPick: (v: string) => void, placeholder = ''): Node {
  const cur = options.find(o => o.value === value);
  const wrap = h('div', { class: `dd${S.ddOpen === key ? ' open' : ''}` });
  const btn = h('button', { class: 'ddbtn', onclick: (ev: Event) => { ev.stopPropagation(); S.ddOpen = S.ddOpen === key ? null : key; wrap.classList.toggle('open', S.ddOpen === key); } }, h('span', { class: 'ddarrow' }), cur ? cur.label : placeholder); // 화살표는 글자 앞
  const list = h('div', { class: 'ddlist' }, ...options.map(o => h('div', { class: `ddopt${o.value === value ? ' on' : ''}`, onclick: (ev: Event) => { ev.stopPropagation(); S.ddOpen = null; onPick(o.value); } }, o.label)));
  wrap.append(btn, list); return wrap;
}
// 작은 상태 아이콘 (인라인 SVG): cross = 부상(붕대 십자), staff = 독토르(지휘봉)
// 접이식 패널: 열림 상태를 기억한다
function foldPanel(key: string, title: string, hint: string, ...kids: (Node | null)[]): Node {
  const open = localStorage.getItem(`lanista-open-${key}`) !== '0';
  const d = h('details', { class: 'panel fold', style: 'margin-bottom:10px' }, h('summary', {}, h('h2', {}, title, h('span', { class: 'hint', style: 'text-transform:none;letter-spacing:0;margin-left:8px' }, hint))), ...kids) as HTMLDetailsElement;
  if (open) d.setAttribute('open', '');
  d.addEventListener('toggle', () => localStorage.setItem(`lanista-open-${key}`, d.open ? '1' : '0'));
  return d;
}
 // 편성 화면에서 고른 시즌 행사 // 대시보드 맨 위에 한 번 보여줄 알림

export function h(tag: string, attrs: Record<string, any> = {}, ...kids: (Node | string | null | undefined)[]) { // 함수 선언(호이스팅): 다른 모듈이 초기화 때(headerBox·barBox) 부르므로 모듈 순환에서도 안전
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v === false || v == null || v === '') continue; if (k === 'class') el.className = v; else if (k.startsWith('on')) (el as any)[k] = v; else if (k === 'title') el.setAttribute('data-tip', v); /* title → 탭·호버 말풍선 (폰에서는 title 이 안 보인다) */ else el.setAttribute(k, v === true ? '' : v); }
  for (const k of kids) if (k != null) el.append(k);
  return el;
}
export function showTip(target: Element) {
  const text = target.getAttribute('data-tip'); if (!text) return;
  hideTip(); S.tipFor = target; const el = h('div', { class: 'tip' }, ...text.split('\n').map(l => h('div', {}, l))); document.body.append(el); S.tipEl = el;
  const r = target.getBoundingClientRect(); el.style.maxWidth = Math.min(280, innerWidth - 16) + 'px'; const w = el.offsetWidth;
  const left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)); el.style.left = left + 'px';
  const hd = document.querySelector('#app.land > header')?.getBoundingClientRect(); const above = r.top - el.offsetHeight - 8 > (hd ? hd.bottom : 0) + 4; el.style.top = (above ? r.top - el.offsetHeight - 8 : r.bottom + 8) + 'px'; el.classList.toggle('below', !above); // 위에 자리가 있어도 헤더를 가리면 아래로 (헤더 밑 토글 줄)
  el.style.setProperty('--ax', (r.left + r.width / 2 - left) + 'px');
}
// 한국어 조사: 받침이 있으면 '으로', 없거나 ㄹ 받침이면 '로' (포룸으로 · 훈련소로 · 의무실로)
export function ro(word: string): string { const c = word.charCodeAt(word.length - 1) - 0xAC00; const jong = c >= 0 && c <= 11171 ? c % 28 : 0; return jong === 0 || jong === 8 ? '로' : '으로'; }
export function ga(word: string): string { const c = word.charCodeAt(word.length - 1) - 0xAC00; return c >= 0 && c <= 11171 && c % 28 !== 0 ? '이' : '가'; } // 받침이 있으면 '이'
export function eul(word: string): string { const c = word.charCodeAt(word.length - 1) - 0xAC00; return c >= 0 && c <= 11171 && c % 28 !== 0 ? '을' : '를'; } // 받침이 있으면 '을'
export function eun(word: string): string { const c = word.charCodeAt(word.length - 1) - 0xAC00; return c >= 0 && c <= 11171 && c % 28 !== 0 ? '은' : '는'; } // 받침이 있으면 '은'
export function hideTip() { if (S.tipEl) { S.tipEl.remove(); S.tipEl = null; } S.tipFor = null; }
export const tipTarget = (ev: Event) => (ev.target as Element).closest?.('[data-tip]') as Element | null;
export const isAction = (el: Element) => !!el.closest('button, a, select, .card, .drow, .slot, .ddopt, .gtile');
export const isChip = (el: Element) => el.matches('.badge, .eff, .tile, .tierchip, .host, .rank, .stars') && !el.closest('button');
export const sq = (t: GType) => h('span', { class: 'sq', style: `background:${TYPE_COLOR[t]}` }, glyphSvg(t));
// 페이지 왼쪽 위 뒤로가기 (화살표 아이콘)
export function backBtn(onclick: () => void, title: string): Node {
  const b = h('button', { class: 'backbtn', title, 'aria-label': title, onclick });
  // 폼페이 낙서풍 화살표: 삐뚤한 겹선, 배경 없음
  b.innerHTML = `<svg viewBox="0 0 48 34" width="48" height="34" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M42 17 L30 16.5 L20 17.5 L9 17" stroke="#3a2412" stroke-width="2.6" opacity=".85"/>
    <path d="M43 19 L31 18.5 L21 19.4 L11 19" stroke="#3a2412" stroke-width="1.2" opacity=".55"/>
    <path d="M17 8 L12 12 L8 17.5 L12 23 L18 27" stroke="#3a2412" stroke-width="2.6" opacity=".85"/>
    <path d="M19 10 L14 13.5 L10.5 18 L14 22 L19 25" stroke="#3a2412" stroke-width="1.1" opacity=".5"/>
    <path d="M13 12.5 L9.5 17 L13 21.5" stroke="#9b2c1c" stroke-width="1.1" opacity=".55"/>
    <path d="M24 16.2 L36 15.8" stroke="#9b2c1c" stroke-width="1" opacity=".45"/>
  </svg>`;
  return b;
}
