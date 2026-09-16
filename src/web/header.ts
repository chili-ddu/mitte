// 헤더: 이름·월계관 호감도·자금·소식·설정 (Codex: 배치)
import { S } from './state.js';
import { SEASON_KO, upkeepOf } from '../core/game.js';
import { TYPE_KO } from '../core/gladiator.js';
import { h } from './dom.js';
import { render } from './main.js';
import { renderDash } from './sheets.js';

 // 첫 시즌 안내를 껐는가 (2번째 시즌부터는 자동으로 끝)
// 첫 시즌 안내: 지금 상태에서 다음에 할 일을 한 줄로. 화면 위쪽에 손가락 표시와 함께
export function coach(): Node | null {
  if (S.coachOff || S.st.season > 1) return null;
  const assigned = Object.values(S.assign).reduce((a, ids) => a + ids.length, 0);
  let text = '', arrow: 'tabs' | 'plan' | 'go' | 'none' = 'none';
  if (S.phase === 'manage' && S.cellsOpen) text = '방을 누르면 검투사를 옮기고 숙소 질을 올릴 수 있습니다. 집 버튼으로 돌아갑니다.';
  else if (S.phase === 'manage' && S.view === 'market') { text = S.st.roster.length < 3 ? '판매대의 검투사를 누르고 구매하세요. 계약 규모에 맞춰 최소 3명이 편합니다.' : '충분합니다. 위 팻말에서 정문으로 돌아가 편성으로 가세요.'; arrow = S.st.roster.length < 3 ? 'none' : 'tabs'; }
  else if (S.phase === 'manage') { if (S.st.roster.length < 3 && S.st.market.length) { text = '검투사 2명으로 시작합니다. 위 팻말의 시장에서 한 명 더 사 두면 계약을 더 받을 수 있습니다.'; arrow = 'tabs'; } else { text = '아래 \'편성\' 을 눌러 계약에 검투사를 배정합니다. 검투사는 시즌당 한 번만 출전합니다.'; arrow = 'plan'; } }
  else if (S.phase === 'plan') { if (!assigned) { text = '계약 카드를 고른 뒤 아래 검투사를 눌러 배정합니다. 주최자 배지를 길게 누르면 상금·미시오 조건이 보입니다. 배정 안 된 검투사는 훈련·시범을 고르세요.'; } else { text = '아래 \'전투\' 를 누르면 경기가 시작됩니다. 지더라도 관중이 미테!를 외치면 삽니다. 판정 때 화면을 두드려 보세요.'; arrow = 'go'; } }
  else if (S.phase === 'summary') text = '대여료는 승패와 무관하게 받습니다. 다음 시즌엔 왼쪽 아래 집 버튼(켈라)과 의무실·훈련소의 시설도 살펴보세요.';
  if (!text) return null;
  return h('div', { class: `coach ${arrow}` }, h('span', { class: 'hand' }, '☞'), h('span', { class: 'grow' }, text), h('button', { class: 'tiny', title: '안내 끄기', onclick: () => { S.coachOff = true; localStorage.setItem('lanista-coach', '1'); render(); } }, '✕'));
} // 첫 실행: 제목 화면 (관중 함성과 함께)
// 헤더의 설정(톱니바퀴) 버튼: 메뉴 시트 (인라인 SVG, Lucide settings 형태)
function gearBtn(): Node { const b = h('button', { class: `gear${S.sheet === 'menu' ? ' on' : ''}`, title: '메뉴', onclick: () => { S.sheet = S.sheet === 'menu' ? null : 'menu'; render(); } });
  b.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>';
  return b; }
// 계절 그림 (로마 사계절 도상: 봄 꽃가지 · 여름 밀 이삭 · 가을 포도송이 · 겨울 헐벗은 가지). 낙서풍 선 그림, 헤더의 계절 글자를 대신한다
function seasonIcon(season: number): Node {
  const k = (season - 1) % 4; const sp = h('span', { class: `season-ico s${k}`, title: `${SEASON_KO[k]} — ${['꽃가지 (봄)', '밀 이삭 (여름, 수확)', '포도송이 (가을, 포도 수확)', '헐벗은 가지 (겨울)'][k]}` });
  const paths = [
    '<path d="M12 21V9"/><path d="M12 13c-3 0-5-2-5-5 3 0 5 2 5 5z"/><path d="M12 16c3 0 5-2 5-5-3 0-5 2-5 5z"/><circle cx="12" cy="6" r="2.4"/><path d="M9.5 4.5 8 3M14.5 4.5 16 3M12 3.2V2"/>',
    '<path d="M12 22V8"/><path d="M12 8c-2.5-.5-4-2.5-4-5 2.5.5 4 2.5 4 5z"/><path d="M12 8c2.5-.5 4-2.5 4-5-2.5.5-4 2.5-4 5z"/><path d="M12 12c-2.5-.5-4-2.5-4-5 2.5.5 4 2.5 4 5z"/><path d="M12 12c2.5-.5 4-2.5 4-5-2.5.5-4 2.5-4 5z"/><path d="M12 16c-2.5-.5-4-2.5-4-5 2.5.5 4 2.5 4 5z"/><path d="M12 16c2.5-.5 4-2.5 4-5-2.5.5-4 2.5-4 5z"/>',
    '<path d="M12 2v4"/><path d="M12 6c3 0 5 1 6 3-2 0-4 1-6 2-2-1-4-2-6-2 1-2 3-3 6-3z"/><circle cx="9" cy="12.5" r="2.2"/><circle cx="15" cy="12.5" r="2.2"/><circle cx="7.5" cy="16.5" r="2.2"/><circle cx="12" cy="16.5" r="2.2"/><circle cx="16.5" cy="16.5" r="2.2"/><circle cx="10" cy="20" r="2.2"/><circle cx="14.5" cy="20" r="2.2"/>',
    '<path d="M12 22V6"/><path d="M12 13l-5-4M12 13l5-4M12 9l-3-3M12 9l3-3M7 9l-2-2M17 9l2-2"/><path d="M4 21h16" stroke-dasharray="2 3"/>',
  ][k];
  sp.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  return sp;
}
// 헤더(라니스타·자금·호감도·검투사 수·톱니바퀴): 관리·편성·전투·결과 화면이 같이 쓴다
export const headerBox = h('header', {}) as HTMLElement; // 한 번 만들고 내용만 바꾼다 (매번 새로 만들면 고정 헤더가 깜박인다)
 // 한 번 만들고 내용만 바꾼다 (매번 새로 만들면 고정 헤더가 깜박인다)
// 호감도: 숫자 대신 월계관 단계 (사용자 결정). 잎이 찬 쌍 = 단계. 문턱은 규칙의 문턱 그대로 — 25 등급 2 계약 · 50 승리 값 체감·파밀리아 강화 · 60 등급 3 계약·명성 유지비 · 80 정점(망각 최대). 숫자는 툴팁에
const FAME_STAGES: [number, string][] = [[0, '무명'], [25, '벽에 이름'], [50, '거리의 화제'], [60, '이름을 날림'], [80, '캄파니아의 자랑']]; // 낙서 계열: 폼페이 벽에 이름이 적히기 시작해 온 지방의 자랑이 되기까지
 // 낙서 계열: 폼페이 벽에 이름이 적히기 시작해 온 지방의 자랑이 되기까지
function fameMeter(): Node {
  const f = S.st.fame; let s = 0; for (let i = 0; i < FAME_STAGES.length; i++) if (f >= FAME_STAGES[i][0]) s = i;
  const next = FAME_STAGES[s + 1]; const gold = s === FAME_STAGES.length - 1;
  const leaves: string[] = []; // 아래 매듭에서 양쪽으로 올라가는 잎 4쌍 (위는 열린 관). 찬 쌍 = 단계
  for (let i = 0; i < 4; i++) for (const side of [-1, 1]) { const a = (270 + side * (i + 1) * 38) * Math.PI / 180; const x = 12 + 8 * Math.cos(a), y = 12 - 8 * Math.sin(a); const rot = -(a * 180 / Math.PI) - 90 * side;
    leaves.push(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="2.6" ry="1.4" transform="rotate(${rot.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${i < s ? (gold ? '#c9a227' : '#4e8a3a') : 'none'}" stroke="${i < s ? (gold ? '#8a6a12' : '#2c5a1e') : '#8a7a56'}" stroke-width="1"/>`); }
  const ico = h('span', { class: `wreath${gold ? ' gold' : ''}` }); ico.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22"><path d="M8.5 20.5 Q12 22.5 15.5 20.5" fill="none" stroke="#8a7a56" stroke-width="1.2"/>${leaves.join('')}</svg>`; // 아래 매듭 리본
  return h('span', { class: 'stat fame', title: `호감도 ${f} · ${FAME_STAGES[s][1]}${next ? ` — ${next[0]}부터 '${next[1]}'` : ''}. 문턱: 25 등급 2 계약 · 50 파밀리아 강화 · 60 등급 3 계약·명성 유지비 · 80 정점` }, ico, FAME_STAGES[s][1]);
}
export function headerEl(): Node {
  headerBox.replaceChildren(
    h('div', { class: 'hrow' }, h('span', { class: 'stat', title: S.st.lanista.trait === 'doctor' ? `전직 독토르 (${TYPE_KO[S.st.lanista.type!]} 훈련 +1)` : S.st.lanista.trait === 'freedman' ? '해방노예 출신 (시장 10% 할인)' : '창업자' }, S.st.lanista.name, h('span', {}, ` ${S.st.lanista.age}세`)), fameMeter(), h('span', { style: 'flex:1' }), h('span', { class: 'stat season', title: `${SEASON_KO[(S.st.season - 1) % 4]} — ${S.st.season}번째 시즌. 시즌을 넘기려면 포룸 하늘의 해를 누릅니다` }, `${Math.floor((S.st.season - 1) / 4) + 1}년차`, seasonIcon(S.st.season))),
    h('div', { class: 'hrow' }, (() => { const live = S.phase === 'battle' || S.phase === 'result'; const shown = live ? (S.seasonSummary?.before ?? S.st.money) : S.st.money; /* 경기·결과 화면에서는 시즌 시작 때 금액 그대로 — 대여료·상금이 미리 들어오면 승패가 새어 나간다. 정산에서 한꺼번에 들어온다 */
      return h('span', { class: 'stat', title: live ? '경기 중에는 시즌 시작 때 금액입니다. 대여료·상금·경비는 시즌 정산에서 한꺼번에 들어옵니다' : undefined }, `${shown.toLocaleString()} HS`, h('span', {}, live ? ' 정산 전' : ` 유지비 ${upkeepOf(S.st).toLocaleString()}`)); })(), h('span', { style: 'flex:1' }),
      newsBtn(), gearBtn()));
  return headerBox;
}
// 소식 배지: 정문 항목 중 할 일·경고 수
const newsCount = () => renderDash('ludus', true).filter(n => n instanceof HTMLElement && /\b(todo|warn)\b/.test(n.className)).length;
function newsBtn(): Node { const n = newsCount(); const b = h('button', { class: `newsbtn${S.sheet === 'news' ? ' on' : ''}`, title: '소식', onclick: () => { S.sheet = S.sheet === 'news' ? null : 'news'; S.cellsOpen = false; S.bedPick = null; S.palusMode = false; S.cellPop = null; S.cellSide = null; render(); } }); // 소식도 다른 시트·켈라와 배타적
  b.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/></svg>'; if (n) b.append(h('span', { class: 'nbadge' }, String(n))); return b; } // 두루마리(소식)
