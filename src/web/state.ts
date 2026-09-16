// 화면의 공유 가변 상태. main.ts 의 모듈 수준 let 을 한 객체로 모았다 (2026-09-16 리팩터링). 각 화면 모듈은 여기서 읽고 쓴다
import type { Action, SeasonEvents, GameState, FightReport } from '../core/game.js';
import type { Contract, Gladiator } from '../core/types.js';
import type { View } from './main.js';
import type { StickPose } from './scenes.js';
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
  seasonSummary: { upkeep: number; gift: number; trained: { g: Gladiator; stat: 'atk' | 'def' }[]; acted: { g: Gladiator; act: Action; note: string }[]; before: number; fameBefore: number; refused: number; skipped: Contract[]; label: string; events: SeasonEvents } | null;
  report: FightReport | null;
  notice: string;
  sheet: 'help' | 'glad' | 'facilities' | 'doctors' | 'rivals' | 'events' | 'menu' | 'chronicle' | 'news' | 'market' | 'medic' | 'yard' | 'applicants' | 'cell' | null;
  gladSel: number | null;
  detail: { kind: 'roster' | 'market'; id: number; confirm?: 'sell' | 'release' | 'buy' | 'heal'; solo?: boolean } | null;
  detailSwipe: 1 | -1 | null; /* 상세를 좌우로 밀어 이웃 검투사로 넘긴 방향 (들어오는 애니메이션에만 쓰고 바로 비운다) */
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
  lineupView: 'record' | 'stats';
  tabletQueue: number[] | null;
  tabletIdx: number;
  shownTablet: boolean;
  seasonConfirm: boolean;
  seasonFrom: 'plan' | 'manage'; /* 시즌 진행 창을 연 자리 (뒤로가기가 돌아갈 곳): 계약 벽에서 왔나, 마을에서 바로 넘겼나 */
  shownSeason: boolean;
}
export const S = {} as State; // 초기값은 main.ts 가 원래 순서대로 대입한다
