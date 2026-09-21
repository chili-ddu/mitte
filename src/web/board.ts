// 마을 아래 길가: 여정표(이티네라리움)·알붐(디핀티 상황판) (Codex: 모양)
import { S } from './state.js';
import { canFulfill, bedCostOf, inBed, palusTrainees, trainCap } from '../core/game.js';
import { VIEW_KO, View } from './main.js';
import { placeCenter, startTravel } from './town.js';
import { h } from './dom.js';

// 디스플레이 상단의 장소 표지판: 누르면 그 장소로 화면이 옮겨가고 라니스타가 따라온다
// 이정표(밀리아리움): 돌기둥 위에 나무 화살표 팻말. 지금 있는 곳은 원판, 나머지는 그 방향을 가리킨다 (왼쪽 장소 ◀ / 오른쪽 장소 ▶)
const VIEW_LA: Record<View, string> = { medic: 'MEDICVS', yard: 'PALVS', ludus: 'FORVM', market: 'CATASTA', grave: 'SEPVLCRA' }; // 여정표·알붐의 라틴 새김: 의사 · 훈련 기둥 · 광장 · 노예 진열대 · 무덤
 // 여정표·알붐의 라틴 새김: 의사 · 훈련 기둥 · 광장 · 노예 진열대 · 무덤
const roman = (n: number): string => { let r = ''; for (const [v, k] of [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']] as [number, string][]) while (n >= v) { r += k; n -= v; } return r || '—'; };
// 마을 아래 길가: 여정표 + 알붐. 방향을 가리키는 나무 팻말은 로마 것이 아니라서 뺐다
// 여정표(이티네라리움): 로마인은 지도 대신 역참을 순서대로 적은 목록으로 길을 알았다(안토니누스 여정표·비카렐로 은잔). 이 마을은 한 줄 길이라 목록이 곧 지도. 역참 사이 숫자는 파수스(걸음)
function itinerary(): Node {
  const order: View[] = ['medic', 'yard', 'ludus', 'market', 'grave']; const cur = order.indexOf(S.view);
  const passus = (a: View, b: View) => roman(Math.max(1, Math.round(Math.abs(placeCenter(b) - placeCenter(a)) / 4))); // 월드 4유닛 ≈ 1파수스 (분위기용 수치)
  return h('div', { class: 'itin' }, ...order.flatMap((v, i) => {
    const stn = h('button', { class: `stn${i === cur ? ' here' : ''}`, onclick: () => { if (v !== S.view) startTravel(v); }, title: i === cur ? '지금 여기' : `${VIEW_KO[v]}로` }, h('span', { class: 'la' }, VIEW_LA[v]), h('span', { class: 'ko' }, VIEW_KO[v]));
    return i < order.length - 1 ? [stn, h('span', { class: 'leg' }, h('span', { class: 'p' }, passus(v, order[i + 1])))] : [stn];
  }));
}
// 알붐(회칠한 게시벽)과 디핀티(붉은 글씨 공고): 포룸의 공고는 회칠 벽에 붉은 글씨로 썼다(폼페이 에딕타 무네룸). 이번 시즌 상황을 세계 안 물건으로 보여 준다. 줄을 누르면 그 장소로
function album(): Node {
  const lines: { la: string; n: number; ko: string; to?: View; warn?: boolean }[] = [];
  const cs = S.st.contracts, ok = cs.filter(c => canFulfill(S.st, c)).length;
  lines.push({ la: 'MVNERA', n: cs.length, ko: cs.length ? `계약 ${cs.length}건${ok < cs.length ? ` · 치를 수 있는 것 ${ok}` : ''}` : '이번 시즌 계약 없음', to: 'ludus' });
  lines.push({ la: 'VENALES', n: S.st.market.length, ko: S.st.market.length ? `시장 매물 ${S.st.market.length}명` : '시장 매물 없음', to: 'market' });
  if (S.st.applicants.length) lines.push({ la: 'AVCTORATI', n: S.st.applicants.length, ko: `문 앞 자유민 지원자 ${S.st.applicants.length}명`, to: 'ludus' }); // 정문(문루) 앞에 서 있다 — 정문은 포룸 화면
  { const pend = S.st.pendingChallenges.length, ch = S.st.contracts.filter(c => c.challenge).length; if (pend || ch) lines.push({ la: 'PROVOCATIO', n: pend + ch, ko: pend ? `도전장 ${pend}통이 답을 기다린다` : `도전 경기 ${ch}건 — 반드시 세운다`, to: 'ludus', warn: !!pend }); } // 도전장(docs/10): 관리 화면의 모달이 답을 받는다
  const inj = S.st.roster.filter(g => g.alive && g.injured > 0).length;
  { const noBed = S.st.roster.filter(g => g.alive && g.injured > 0 && !inBed(S.st, g)).length; lines.push({ la: 'SAVCII', n: inj, ko: inj ? `부상 ${inj}명${noBed ? ` · 침상 밖 ${noBed}명 (덧날 수 있다)` : ` · 시즌 치료비 ${(bedCostOf(S.st) * inj).toLocaleString()} HS`}` : '부상자 없음', to: 'medic', warn: noBed > 0 }); }
  const tr = palusTrainees(S.st).length, cap = trainCap(S.st); lines.push({ la: 'PALVS', n: tr, ko: tr ? `팔루스 ${tr}/${cap} 훈련 중` : `팔루스 ${cap}개 비어 있다`, to: 'yard' }); // 세운 만큼만 훈련한다 (초과 없음)
  return h('div', { class: 'album' }, ...lines.map(l => h(l.to ? 'button' : 'div', { class: `dip${l.n ? '' : ' dim'}${l.warn ? ' warn' : ''}`, ...(l.to ? { onclick: () => { if (l.to !== S.view) startTravel(l.to!); } } : {}) },
    h('span', { class: 'la' }, `${l.la} · ${roman(l.n)}`), h('span', { class: 'ko' }, l.ko)))); // 아래 남는 벽은 빈 회칠 그대로 (사용자: 소식은 넣지 않는다)
}
export function roadBoard(): Node {
  const covered = S.cellsOpen || (S.phase === 'manage' && !!S.sheet && ['facilities', 'doctors', 'rivals', 'news', 'market', 'applicants', 'chronicle'].includes(S.sheet)); // 켈라나 장면 패널이 덮으면 숨긴다
  return h('div', { class: `roadboard${covered ? ' hidden' : ''}` }, itinerary(), album());
}
