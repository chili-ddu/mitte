// 화면의 공유 가변 상태. main.ts 의 모듈 수준 let 을 한 객체로 모았다 (2026-09-16 리팩터링). 각 화면 모듈은 여기서 읽고 쓴다
import type { Action, SeasonEvents, GameState, FightReport, TrainStat } from '../core/game.js';
import type { Contract, Gladiator, GType } from '../core/types.js';
import type { View } from './main.js';
import type { StickPose } from './scenes.js';
import { ENEMY } from './stickman.js';
export interface State {
  st: GameState;
  resumed: boolean;
  showIntro: boolean;
  coachOff: boolean;
  phase: 'manage' | 'plan' | 'battle' | 'result' | 'summary' | 'over';
  assign: Record<number, number[]>;
  trainPlan: Record<number, Action>;
  planSel: number | null;
  queue: { c: Contract; team: Gladiator[] }[];
  skipped: Contract[];
  marketSel: number | null;
  view: View;
  travel: { to: View; from: View; fromX: number; start: number } | null;
  seasonReports: FightReport[];
  seasonSummary: { upkeep: number; gift: number; bedCost?: number; trained: { g: Gladiator; stat: TrainStat; gain: number }[]; acted: { g: Gladiator; act: Action; note: string }[]; before: number; fameBefore: number; refused: number; skipped: Contract[]; label: string; events: SeasonEvents } | null;
  report: FightReport | null;
  notice: string;
  sheet: 'help' | 'glad' | 'facilities' | 'doctors' | 'rivals' | 'events' | 'menu' | 'chronicle' | 'news' | 'market' | 'medic' | 'yard' | 'applicants' | 'cell' | null;
  gladSel: number | null;
  detail: { kind: 'roster' | 'market'; id: number; confirm?: 'sell' | 'release' | 'buy' | 'heal'; solo?: boolean } | null;
  detailSwipe: 1 | -1 | null;
  setup: { color: string } | null; /* 새 게임 시작 표시: 색은 랜덤 (2026-09-21 색 고르기 창 삭제, 2026-09-18 유형 선택 삭제). render 가 보고 바로 새 게임을 만든다 */ /* 상세를 좌우로 밀어 이웃 검투사로 넘긴 방향 (들어오는 애니메이션에만 쓰고 바로 비운다) */
  cellDrag: { id: number; k0: number; px: number; py: number; over: number | null; moved: boolean } | null;
  cellSel: number;
  cellSide: 'glad' | 'empty' | null;
  cellPop: { cx: number; cy: number; fresh: boolean } | null;
  cellsOpen: boolean;
  cellsP: number;
  bedPick: number | null;
  palusMode: boolean;
  offerPage: number;
  ddOpen: string | null;
  eventPlan: SeasonEvents;
  tipEl: HTMLElement | null;
  tipFor: Element | null;
  tipTimer: number;
  tipSuppressClick: boolean;
  portraitLoop: boolean;
  cellsH: number;
  townH: number;
  shownDetail: string | null;
  camX: number;
  camV: number;
  camPan: number;
  zoomIn: { start: number; dur: number; wx: number; wy: number; k: number; done: () => void; fired?: boolean } | null;
  VW: number;
  townCanvas: HTMLCanvasElement | null;
  cellsCanvas: HTMLCanvasElement | null;
  stickFn: ((x: number, y: number, sc: number, pose: StickPose, t: number, seed: number, facing?: 1 | -1) => void) | null;
  pageSlide: 'fwd' | 'back' | null;
  shownPlan: number | null;
  tabletQueue: number[] | null;
  tabletIdx: number;
  shownTablet: boolean;
  seasonConfirm: boolean;
  seasonFrom: 'plan' | 'manage'; /* 시즌 진행 창을 연 자리 (뒤로가기가 돌아갈 곳): 계약 벽에서 왔나, 마을에서 바로 넘겼나 */
  shownSeason: boolean;
}
export const S = {} as State; // 초기값은 main.ts 가 원래 순서대로 대입한다

// 우리 파밀리아 색: 새 게임에서 고른다. 벽화 안료로 설명되는 여섯 가지 (자유 색상은 낙서풍 팔레트를 깬다)
// ink = 베테라누스, light = 티로. 상대는 stickman.ts 의 ENEMY(자주)
export const TEAM_COLORS: { id: string; ko: string; ink: string; light: string }[] = [
  { id: 'caeruleum', ko: '청금', ink: '#2c4f9b', light: '#6e7f9b' },   // 이집트 청(카이룰레움) — 기본
  { id: 'viride', ko: '초록토', ink: '#3b7a4a', light: '#7b9b7e' },    // 녹토(테라 베르데)
  { id: 'aerugo', ko: '청록', ink: '#2e7d7d', light: '#6e9b9b' },      // 청동 녹
  { id: 'sil', ko: '황토', ink: '#b8860b', light: '#c2a86a' },         // 황토(실)
  { id: 'minium', ko: '주사', ink: '#a8321f', light: '#b87a6a' },      // 주사(미니움)
  { id: 'aes', ko: '구리', ink: '#8a5a2b', light: '#a98a66' },         // 구리빛 흙
];
export const teamColorOf = (id?: string) => TEAM_COLORS.find(c => c.id === id) ?? TEAM_COLORS[0];
export const myInk = () => teamColorOf(S.st?.color).ink;      // 베테라누스
export const myLight = () => teamColorOf(S.st?.color).light;  // 티로
export const randomColor = () => TEAM_COLORS[Math.floor(Math.random() * TEAM_COLORS.length)].id; // 새 게임 설정의 첫 색 (2026-09-21 사용자: 랜덤 배정 — 바꿀 수는 있다)
export const rivalInk = (rivalId?: number) => { const c = rivalId === undefined ? undefined : S.st?.rivals.find(r => r.id === rivalId)?.color; return c ? teamColorOf(c).ink : ENEMY; }; // 상대 파밀리아 색 (없으면 자주)
export const rivalInkOf = (g: Gladiator) => rivalInk(S.st?.rivals.find(r => r.roster.some(x => x.id === g.id))?.id); // 검투사가 속한 파밀리아 색
