// 켈라: 방 격자를 검투사 카드로 (2026-09-22 사용자: 방 그림 대신 카드, 방 바꾸기 없음, 정렬·즐겨찾기)
import { S } from './state.js';
import { available, cellOf, CELL_Q_KO, occupantOf, palusOf, palusTrainee, putAtPalus, leavePalus, putInBed, inBed } from '../core/game.js';
import { type Gladiator } from '../core/types.js';
import { powerOf } from '../core/gladiator.js';
import { CONFIG } from '../core/config.js';
import { h, toast } from './dom.js';
import { render, save } from './main.js';
import { gladCard, CARD_PORTRAIT } from './gcard.js';

export type CellsSort = 'cell' | 'power' | 'fatigue' | 'age';
export const CELLS_SORT_KO: Record<CellsSort, string> = { cell: '들어온 순', power: '전력', fatigue: '피로', age: '나이' };

/* 정렬: 즐겨찾기가 늘 앞, 그 다음 고른 기준. 방 번호는 보이지 않는다 (2026-09-22 사용자: 카드가 되니 번호는 뜻이 없다) — 숙소 질 ★만 카드에 붙는다 */
function sorted(): Gladiator[] {
  const list = S.st.roster.filter(g => g.alive); const k = S.cellsSort;
  const key = (g: Gladiator) => k === 'power' ? -powerOf(g) : k === 'fatigue' ? -(g.fatigue ?? 0) : k === 'age' ? -(g.age ?? 0) : cellOf(S.st, g); /* '들어온 순' = 방 순서 */
  return list.sort((a, b) => (Number(!!b.fav) - Number(!!a.fav)) || (key(a) - key(b)) || (cellOf(S.st, a) - cellOf(S.st, b)));
}

/* 켈라 본문: 정렬 줄 + 카드 격자. 침상·팔루스 고르기 모드에선 해당 없는 카드를 흐리게, 카드를 누르면 그 자리에 세운다 */
export function cellsGrid(): Node {
  const built = S.st.ludus.cells.length, max = CONFIG.ludus.cells.max; const pick = S.bedPick != null ? 'bed' : S.palusMode ? 'palus' : null;
  const eligible = (g: Gladiator) => pick === 'bed' ? g.injured > 0 && !inBed(S.st, g) : pick === 'palus' ? g.alive && g.injured <= 0 && g.status !== 'doctor' : true;
  const onCard = (g: Gladiator) => {
    if (pick === 'palus') { if (palusOf(S.st, g) >= 0) { leavePalus(S.st, g); toast(`${g.name} 훈련에서 뺐다`); save(); render(); return; }
      const free = Array.from({ length: S.st.ludus.palus }, (_, i) => i).find(i => !palusTrainee(S.st, i)); if (free == null) { toast(`훈련 자리 ${S.st.ludus.palus}개가 모두 찼다`, 'bad'); return; }
      if (putAtPalus(S.st, g, free)) { toast(`${g.name} 훈련에 넣었다`, 'good'); save(); } else toast(g.injured > 0 ? '부상자는 훈련할 수 없다' : g.status === 'doctor' ? '독토르는 가르치는 중이다' : '세울 수 없다', 'bad'); render(); return; }
    if (pick === 'bed') { if (g.injured > 0 && S.bedPick != null && putInBed(S.st, g, S.bedPick)) { toast(`${g.name} 을(를) 침상 ${S.bedPick + 1}에 눕혔다`, 'good'); S.bedPick = null; S.cellsOpen = false; save(); } else toast('부상자만 침상에 눕힐 수 있다', 'bad'); render(); return; }
    S.gladSel = g.id; S.detail = { kind: 'roster', id: g.id }; render(); // 사람이 있는 방 → 검투사 상세 (오른쪽에서)
  };
  const slot = (g: Gladiator) => { const q = S.st.ludus.cells[cellOf(S.st, g)] ?? 0; const onP = palusOf(S.st, g) >= 0, ok = eligible(g);
    const card = gladCard(g, { size: CARD_PORTRAIT, dis: !!pick && !ok, sel: pick === 'palus' && onP, onclick: () => onCard(g) });
    const fav = h('button', { class: `favbtn${g.fav ? ' on' : ''}`, title: g.fav ? '즐겨찾기 해제' : '즐겨찾기 — 켈라에서 늘 앞에 선다', onclick: (ev: Event) => { ev.stopPropagation(); g.fav = !g.fav; save(); render(); } }, g.fav ? '★' : '☆');
    return h('div', { class: `cellslot${ok ? '' : ' dim'}` }, card, h('div', { class: 'roomtag' }, fav, h('span', { class: `badge chip bedding q${q}`, title: `숙소 ${CELL_Q_KO[q]} — 상세의 숙소 칸에서 손본다` }, CELL_Q_KO[q]), onP ? h('span', { class: 'badge chip palus' }, '훈련 중') : null, inBed(S.st, g) ? h('span', { class: 'badge chip bed' }, '침상') : null)); };
  const emptySlots = Array.from({ length: built }, (_, k) => k).filter(k => !occupantOf(S.st, k)).map(k => { const q = S.st.ludus.cells[k] ?? 0; return h('div', { class: 'cellslot empty' }, h('div', { class: 'gcard ghost' }), h('div', { class: 'roomtag' }, h('span', { class: 'favbtn' }, '☆'), h('span', { class: `badge chip bedding q${q}` }, CELL_Q_KO[q]))); }); /* 지은 빈 방: 글자 없는 점선 카드 + 그 방의 잠자리 (2026-09-22 사용자: '빈 방' 글자만 빼기) */
  const unbuilt = Array.from({ length: max - built }, () => h('div', { class: 'cellslot unbuilt', title: '아직 짓지 않은 방 — 누르면 시설 강화', onclick: () => { S.sheet = 'facilities'; S.cellsOpen = false; render(); } }, h('div', { class: 'gcard ghost brick' }), h('div', { class: 'roomtag' }, h('span', { class: 'favbtn' }, '☆'), h('span', { class: 'badge chip bedding q0' }, CELL_Q_KO[0])))); /* 글자 없는 벽돌 카드, 아래 줄은 간격을 맞추려 빈 즐겨찾기·맨바닥 (2026-09-22 사용자) */
  return h('div', { class: 'cellsbody' }, h('div', { class: 'cellgrid' }, ...sorted().map(slot), ...emptySlots, ...unbuilt));
}
export const cellsAvailable = () => available(S.st).length; /* 처마 제목용 */
/* 정렬 드롭박스: 처마의 닫기 왼쪽 (2026-09-22 사용자: 공간이 부족하면 드롭박스로) */
export function cellsSortSelect(): Node { const sel = h('select', { class: 'cellsortsel', title: '정렬', onchange: (ev: Event) => { S.cellsSort = (ev.target as HTMLSelectElement).value as CellsSort; render(); } }, ...(Object.keys(CELLS_SORT_KO) as CellsSort[]).map(k => h('option', { value: k }, CELLS_SORT_KO[k]))) as HTMLSelectElement; sel.value = S.cellsSort; return sel; }
