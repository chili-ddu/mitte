// 폼페이 낙서풍 스틱맨 렌더러. 유형 = 장비 실루엣.
import type { GType } from '../core/types.js';
import { loadoutFor, hasBigShield, hasNet, type Loadout, type Helmet, type Accessory } from './loadout.js';
import type { MainHand, OffHand } from '../core/equipment.js';

export type Pose = 'idle' | 'guard' | 'windup' | 'attack' | 'swing' | 'recover' | 'hit' | 'kneel' | 'down'
  | 'stab_ready' | 'stab' | 'stab_deep' | 'net_ready' | 'net_throw' | 'trident_ready' | 'trident_thrust' | 'block' | 'stagger' | 'collapse' | 'bound' | 'victory' | 'victory_low' | 'salute' | 'bow' | 'captive' | 'captive_up' | 'slash_ready' | 'slash' | 'up_ready' | 'up_swing' | 'sweep_ready' | 'sweep'
  | 'kneel_up' | 'kneel_down' | 'down_fwd' | 'fly_back' | 'down_back' | 'buckle' | 'down_side' | 'sit' | 'sit_slump' | 'down_sit' | 'bedsit' | 'plea';
export interface Hand { hx: number; hy: number; ang: number }
export interface DrawOpts { x: number; y: number; scale?: number; facing?: 1 | -1; pose?: Pose; skeleton?: Skeleton; t?: number; ink?: string; wobble?: boolean; noNet?: boolean; team?: string; bare?: boolean; accessories?: Accessory[];
  // ── 옷·소품 레이어 (검투사가 아닌 인물도 같은 몸을 쓴다: 몸 + 옷 + 소품)
  garment?: 'tunic' | 'toga'; garmentColor?: string; garmentStripe?: string; apron?: boolean; beard?: boolean;
  hands?: (ctx: CanvasRenderingContext2D, front: Hand, back: Hand, body: { shX: number; shY: number; hipY: number }) => void; // 손에 든 물건: 인물 좌표계(발=0,0, 앞=+x)에서 그린다
}

export const INK = '#7a3b1e'; // 먹색: 폼페이 벽 광고의 붉은 황토(루브리카) 톤
export const ENEMY = '#5e2a5c'; // 상대 파밀리아 팀 색 (먹색이 붉어져 자주로)

// 관절 각도(도). 몸통 기준. 0 = 아래, 양수 = 앞쪽(facing 방향)
export interface Skeleton { lean: number; frontArm: [number, number]; backArm: [number, number]; frontLeg: [number, number]; backLeg: [number, number]; headBob: number; lying?: boolean; sink?: number; lieK?: number; shift?: number; lift?: number; lieDir?: 1 | -1; turn?: number; reach?: { x: number; y: number }; /* 앞손이 이 점(발 기준)을 향하도록 팔 IK */ }

// ── 비검투사 자세 (시민·라니스타·교관 등). 같은 몸에 옷만 다르다
export const NPC_POSES = {
  stand:   { lean: 2,   frontArm: [15, 10],    backArm: [-42, -28], frontLeg: [10, -4],  backLeg: [-10, 4],  headBob: 0 }, // 뒷팔은 몸 뒤로 빼서 옷 밖으로 보이게
  watch:   { lean: 3,   frontArm: [-30, 110],  backArm: [30, -110], frontLeg: [12, -4],  backLeg: [-12, 4],  headBob: 0 }, // 팔짱
  point:   { lean: 6,   frontArm: [120, 15],   backArm: [-42, -25], frontLeg: [16, -6],  backLeg: [-14, 6],  headBob: 0 }, // 손가락질
  tiptoe:  { lean: 0,   frontArm: [40, 10],    backArm: [-45, -25], frontLeg: [6, -2],   backLeg: [-6, 2],   headBob: -1 },
  tablet:  { lean: 3,   frontArm: [55, 50],    backArm: [-40, -28], frontLeg: [12, -4],  backLeg: [-12, 4],  headBob: 0 }, // 서판을 들고 봄, 뒷팔은 뒤로
  tend:    { lean: 10,  frontArm: [70, 35],    backArm: [55, 45],   frontLeg: [18, -8],  backLeg: [-14, 6],  headBob: 2 }, // 두 손 앞으로 (붕대·물건)
  stir:    { lean: -4,  frontArm: [-75, -30],  backArm: [35, 30],   frontLeg: [12, -4],  backLeg: [-12, 4],  headBob: 0 }, // 뒤쪽 솥을 젓는다, 뒷팔은 앞으로 내밀어 보이게
} as const satisfies Record<string, Skeleton>;
export type NpcPose = keyof typeof NPC_POSES;
// 걷기: 다리 교차 + 팔 반대 스윙. phase 는 라디안
export function walkSkeleton(phase: number, armSwing = 1): Skeleton {
  const sw = Math.sin(phase);
  return { lean: 5, frontArm: [-25 * sw * armSwing + 5, 20], backArm: [32 * sw * armSwing - 12, 10], frontLeg: [22 * sw, -10 + Math.max(0, -sw) * 28], backLeg: [-22 * sw, Math.max(0, sw) * 28], headBob: 0, lift: Math.abs(Math.cos(phase)) * 1.5 };
}

export const POSES: Record<Pose, Skeleton> = {
  // 팔 각도: [상완, 전완]. 0 = 아래, 양수 = 앞. 무기는 전완 방향으로 이어진다
  idle:    { lean: 4,   frontArm: [-40, 80],   backArm: [30, 30],  frontLeg: [18, -8],  backLeg: [-18, 8],  headBob: 0 },
  guard:   { lean: 8,   frontArm: [-60, 95],   backArm: [40, 20],  frontLeg: [28, -14], backLeg: [-24, 14], headBob: 1 },
  windup:  { lean: -14, frontArm: [-165, 30],  backArm: [50, 25],  frontLeg: [12, -4],  backLeg: [-40, 24], headBob: -2 }, // 머리 위로 치켜듦
  attack:  { lean: 26,  frontArm: [115, -15],  backArm: [55, 30],  frontLeg: [60, -30], backLeg: [-40, 24], headBob: 3 },  // 앞으로 뻗어 가슴 높이에서 내려침
  swing:   { lean: 34,  frontArm: [85, -25],   backArm: [60, 35],  frontLeg: [64, -34], backLeg: [-44, 26], headBob: 4 },  // 끝까지 휘둘러 앞 아래로
  recover: { lean: 14,  frontArm: [20, 60],    backArm: [45, 22],  frontLeg: [40, -20], backLeg: [-30, 18], headBob: 1 },
  hit:     { lean: -20, frontArm: [-10, 70],   backArm: [60, 40],  frontLeg: [8, 0],    backLeg: [-42, 26], headBob: -3 },
  kneel:   { lean: -6,  frontArm: [-30, 60],   backArm: [45, 30],  frontLeg: [75, -75], backLeg: [-20, -70], headBob: -2, sink: 10.5 }, // 한쪽 무릎
  down:    { lean: 0,   frontArm: [-20, 15],   backArm: [25, 10],  frontLeg: [6, 30],   backLeg: [-4, 0],   headBob: 2, lying: true }, // 팔 늘어뜨림, 한 다리 살짝 굽힘
  // 글라디우스 찌르기: 방패를 앞세우고 허리에서 짧게. 무기 손은 뒤로 당겼다가 수평으로 뻗는다
  stab_ready:     { lean: 10,  frontArm: [-70, 130],  backArm: [70, 10],  frontLeg: [26, -12], backLeg: [-30, 18], headBob: 1 },  // 손 뒤로, 방패 앞
  stab:           { lean: 24,  frontArm: [95, -5],    backArm: [60, 15],  frontLeg: [58, -28], backLeg: [-42, 24], headBob: 2 },  // 수평 찌르기
  stab_deep:      { lean: 32,  frontArm: [100, -8],   backArm: [50, 20],  frontLeg: [70, -36], backLeg: [-50, 28], headBob: 3, sink: 3 }, // 세쿠토르: 한 발 더 밟고 들어감
  // 레티아리우스: 뒷손(그물) 휘둘러 던진 뒤, 앞손 삼지창 찌르기
  net_ready:      { lean: -8,  frontArm: [-50, 60],   backArm: [-120, 20], frontLeg: [14, -6],  backLeg: [-36, 22], headBob: -1 }, // 그물 뒤로 감음
  net_throw:      { lean: 18,  frontArm: [-40, 70],   backArm: [120, -10], frontLeg: [50, -24], backLeg: [-40, 24], headBob: 2 },  // 그물 앞으로 던짐
  trident_ready:  { lean: 6,   frontArm: [-60, 140],  backArm: [40, 30],  frontLeg: [24, -10], backLeg: [-30, 18], headBob: 0 },  // 삼지창 뒤로 당김
  trident_thrust: { lean: 30,  frontArm: [100, -10],  backArm: [60, 20],  frontLeg: [68, -34], backLeg: [-48, 26], headBob: 3 },  // 길게 찌름
  // 방패 막기: 방패 손을 앞으로 높이 들고 몸을 웅크려 뒤로 버팀
  block:          { lean: -10, frontArm: [-30, 40],   backArm: [95, -30], frontLeg: [34, -10], backLeg: [-30, 20], headBob: -4, sink: 5 },
  // 죽음: 뒤로 휘청 → 무릎이 꺾이며 앞으로 무너짐 → 눕기
  stagger:        { lean: -26, frontArm: [-40, 30],   backArm: [50, 50],  frontLeg: [30, 10],  backLeg: [-30, 35], headBob: -5, sink: 4 },
  collapse:       { lean: 28,  frontArm: [40, 30],    backArm: [30, 40],  frontLeg: [60, -95], backLeg: [-35, -60], headBob: 6, sink: 12 },
  // 그물에 걸림: 팔이 몸에 붙고 다리가 모여 버둥거림 (좌우로 흔들리는 건 draw 쪽에서)
  bound:          { lean: -8,  frontArm: [-15, 25],   backArm: [15, 20],  frontLeg: [6, -4],   backLeg: [-6, 4],   headBob: -2, sink: 2 },

  // ── 승리 세레모니: 무기 든 손을 치켜들고 위아래로
  victory:        { lean: -6,  frontArm: [-160, -10], backArm: [-140, 10], frontLeg: [16, -6],  backLeg: [-16, 6],  headBob: -3 },
  victory_low:    { lean: -2,  frontArm: [-120, 30],  backArm: [-100, 20], frontLeg: [16, -6],  backLeg: [-16, 6],  headBob: -1 },
  // 묶인 자세(시장): 두 손을 앞으로 모아 손목이 묶임, 고개 숙임, 발 모음. captive_up = 선택 시 고개 듦
  captive:        { lean: 6,   frontArm: [20, 30],    backArm: [24, 28],  frontLeg: [5, -2],   backLeg: [-4, 2],   headBob: 6 },
  captive_up:     { lean: 2,   frontArm: [20, 30],    backArm: [24, 28],  frontLeg: [6, -2],   backLeg: [-5, 2],   headBob: 0 },
  salute:         { lean: 4,   frontArm: [-150, -25], backArm: [30, 30],  frontLeg: [10, -4],  backLeg: [-10, 4],  headBob: -2 },  // 주최자석을 향해 팔 뻗어 경례
  bow:            { lean: 22,  frontArm: [-20, 30],   backArm: [20, 30],  frontLeg: [75, -75], backLeg: [-20, -70], headBob: 6, sink: 10.5 }, // 한쪽 무릎 인사
  // ── 연속 공격 (무기별 두 번째 동작)
  slash_ready:    { lean: 10,  frontArm: [-110, 60],  backArm: [50, 25],  frontLeg: [30, -14], backLeg: [-26, 16], headBob: 1 },  // 글라디우스: 팔을 뒤로 젖혀
  slash:          { lean: 20,  frontArm: [140, -60],  backArm: [55, 30],  frontLeg: [50, -24], backLeg: [-36, 22], headBob: 2 },  // 옆으로 베기 (팔이 앞으로 크게)
  up_ready:       { lean: 18,  frontArm: [30, 30],    backArm: [45, 25],  frontLeg: [40, -18], backLeg: [-30, 18], headBob: 3, sink: 3 }, // 시카: 낮게 숙여 칼을 아래로
  up_swing:       { lean: -12, frontArm: [-150, 20],  backArm: [50, 25],  frontLeg: [20, -8],  backLeg: [-36, 22], headBob: -3 }, // 올려치기
  sweep_ready:    { lean: 4,   frontArm: [-120, 100], backArm: [-40, 60], frontLeg: [26, -12], backLeg: [-26, 16], headBob: 0 },  // 삼지창: 자루를 뒤로
  sweep:          { lean: 22,  frontArm: [120, -30],  backArm: [90, -20], frontLeg: [56, -26], backLeg: [-40, 24], headBob: 2 },  // 자루로 옆으로 후려침
  // ── 죽음 1: 앞으로 무릎 꿇고 엎어짐 (내려찍기에 맞았을 때)
  kneel_up:       { lean: 6,   frontArm: [-20, 30],   backArm: [20, 30],  frontLeg: [75, -75], backLeg: [-20, -70], headBob: 2,  sink: 10.5 }, // 한쪽 무릎: 앞 정강이 수직, 뒷 정강이는 땅 따라 뒤로
  plea:           { lean: -4,  frontArm: [-172, -6],  backArm: [40, 30],  frontLeg: [75, -75], backLeg: [-20, -70], headBob: -3, sink: 10.5 }, // 한쪽 무릎 꿇고 검지를 높이 들어 미시오 청원
  kneel_down:     { lean: 30,  frontArm: [30, 40],    backArm: [25, 45],  frontLeg: [75, -75], backLeg: [-20, -70], headBob: 8,  sink: 10.5 }, // 고개 떨굼
  down_fwd:       { lean: 0,   frontArm: [40, 20],    backArm: [30, 20],  frontLeg: [-6, 20],  backLeg: [4, 0],    headBob: 2,  lying: true, lieDir: 1 }, // 앞으로 엎어짐

  // ── 죽음 2: 맞고 뒤로 튕겨 날아가 눕기 (묵직한 찌르기에 맞았을 때)
  fly_back:       { lean: -48, frontArm: [-60, -20],  backArm: [110, -20], frontLeg: [60, -20], backLeg: [-10, 30], headBob: -8, shift: -20, lift: 16 }, // 공중, 팔다리 벌어짐
  down_back:      { lean: 0,   frontArm: [-30, 10],   backArm: [40, 10],  frontLeg: [8, 26],   backLeg: [-4, 0],   headBob: 2,  lying: true, lieDir: -1, shift: -30 }, // 뒤로 누움

  // ── 죽음 3 (2026-09-10 교체): 다리 풀려 주저앉고, 앞으로 고꾸라졌다가, 뒤로 넘어감
  // 앉기: 엉덩이가 땅 근처(sink ≈ LEG-3), 두 다리는 앞으로 뻗음(허벅지 +80, 정강이 살짝 접힘)
  sit:            { lean: -6,  frontArm: [-30, 30],   backArm: [30, 30],  frontLeg: [82, -25], backLeg: [70, -10], headBob: -2, sink: 19 },
  bedsit:         { lean: 10,  frontArm: [45, 40],    backArm: [38, 45],  frontLeg: [88, -95], backLeg: [78, -88], headBob: 3 }, // 침상 가장자리에 걸터앉음 (엉덩이 = 침상 높이, 발은 늘어뜨림)
  sit_slump:      { lean: 34,  frontArm: [50, 30],    backArm: [40, 40],  frontLeg: [82, -25], backLeg: [70, -10], headBob: 9,  sink: 19 }, // 상체 앞으로 고꾸라짐
  down_sit:       { lean: 0,   frontArm: [-25, 20],   backArm: [35, 15],  frontLeg: [12, 40],  backLeg: [-2, 10],  headBob: 3,  lying: true, lieDir: -1, shift: -8 }, // 뒤로 넘어가 무릎 굽힌 채 누움
  // (구) 옆으로 구겨짐: 납작하게 눌러 표현했으나 덩어리처럼 보여 미사용
  buckle:         { lean: -4,  frontArm: [-25, 20],   backArm: [25, 25],  frontLeg: [60, -95], backLeg: [-35, -60], headBob: 4,  sink: 12, turn: 0.35 }, // 두 무릎 풀려 주저앉음, 몸이 돌아감
  down_side:      { lean: 0,   frontArm: [-40, 60],   backArm: [50, 40],  frontLeg: [30, 70],  backLeg: [10, 60],  headBob: 6,  lying: true, lieDir: -1, turn: 0.45, shift: -6 }, // 웅크린 채 옆으로
};

// 자세 보간. lying 은 0.5를 넘는 쪽으로 스냅, sink(몸 전체 내려앉기)는 보간
export function lerpSkeleton(a: Skeleton, b: Skeleton, k: number): Skeleton {
  const L = (x: number, y: number) => x + (y - x) * k;
  const L2 = (x: [number, number], y: [number, number]): [number, number] => [L(x[0], y[0]), L(x[1], y[1])];
  return { lean: L(a.lean, b.lean), frontArm: L2(a.frontArm, b.frontArm), backArm: L2(a.backArm, b.backArm), frontLeg: L2(a.frontLeg, b.frontLeg), backLeg: L2(a.backLeg, b.backLeg), headBob: L(a.headBob, b.headBob), sink: L(a.sink ?? 0, b.sink ?? 0), shift: L(a.shift ?? 0, b.shift ?? 0), lift: L(a.lift ?? 0, b.lift ?? 0), turn: L(a.turn ?? 0, b.turn ?? 0), lieDir: b.lieDir ?? a.lieDir ?? -1, lying: k < 0.5 ? a.lying : b.lying, lieK: b.lying && !a.lying ? Math.max(0, (k - 0.3) / 0.7) : a.lying && b.lying ? 1 : 0 };
}

// 클립: 키프레임(자세, 그 자세까지 걸리는 시간 ms). 마지막 자세에서 멈춘다
export type ClipName = 'attack' | 'stab' | 'stab_secutor' | 'net_trident' | 'net_throw' | 'hit' | 'block' | 'die' | 'die_forward' | 'die_back' | 'die_side' | 'guard' | 'idle' | 'bound' | 'combo_slash' | 'combo_up' | 'combo_sweep' | 'victory' | 'salute' | 'bow' | 'lap' | 'plea' | 'rise' | 'slump';
const CLIPS: Record<ClipName, { pose: Pose; dur: number }[]> = {
  attack: [{ pose: 'guard', dur: 0 }, { pose: 'windup', dur: 140 }, { pose: 'attack', dur: 70 }, { pose: 'swing', dur: 70 }, { pose: 'recover', dur: 130 }, { pose: 'guard', dur: 150 }], // 시카 내려찍기
  stab:         [{ pose: 'guard', dur: 0 }, { pose: 'stab_ready', dur: 110 }, { pose: 'stab', dur: 60 }, { pose: 'stab_ready', dur: 120 }, { pose: 'guard', dur: 120 }], // 글라디우스
  stab_secutor: [{ pose: 'guard', dur: 0 }, { pose: 'stab_ready', dur: 90 }, { pose: 'stab', dur: 50 }, { pose: 'stab_deep', dur: 60 }, { pose: 'stab_ready', dur: 130 }, { pose: 'guard', dur: 120 }], // 추격자: 한 발 더
  net_trident:  [{ pose: 'guard', dur: 0 }, { pose: 'net_ready', dur: 130 }, { pose: 'net_throw', dur: 90 }, { pose: 'trident_ready', dur: 110 }, { pose: 'trident_thrust', dur: 70 }, { pose: 'recover', dur: 120 }, { pose: 'guard', dur: 140 }], // (구) 합본
  combo_slash:  [{ pose: 'stab', dur: 0 }, { pose: 'slash_ready', dur: 130 }, { pose: 'slash', dur: 90 }, { pose: 'recover', dur: 110 }, { pose: 'guard', dur: 120 }],
  combo_up:     [{ pose: 'swing', dur: 0 }, { pose: 'up_ready', dur: 130 }, { pose: 'up_swing', dur: 95 }, { pose: 'recover', dur: 110 }, { pose: 'guard', dur: 120 }],
  combo_sweep:  [{ pose: 'stab', dur: 0 }, { pose: 'sweep_ready', dur: 130 }, { pose: 'sweep', dur: 95 }, { pose: 'recover', dur: 110 }, { pose: 'guard', dur: 120 }],
  salute:       [{ pose: 'guard', dur: 0 }, { pose: 'salute', dur: 400 }, { pose: 'salute', dur: 1600 }, { pose: 'guard', dur: 500 }, { pose: 'salute', dur: 300 }, { pose: 'salute', dur: 800 }],
  bow:          [{ pose: 'guard', dur: 0 }, { pose: 'bow', dur: 500 }, { pose: 'bow', dur: 1800 }, { pose: 'guard', dur: 600 }, { pose: 'victory', dur: 400 }, { pose: 'victory', dur: 600 }],
  lap:          [{ pose: 'guard', dur: 0 }, { pose: 'victory', dur: 250 }, { pose: 'victory', dur: 3500 }], // 이동은 화면 쪽에서 (달리며 팔 든 자세는 runSkeleton 로 대체)
  victory:      [{ pose: 'guard', dur: 0 }, { pose: 'victory', dur: 300 }, { pose: 'victory_low', dur: 350 }, { pose: 'victory', dur: 350 }, { pose: 'victory_low', dur: 350 }, { pose: 'victory', dur: 350 }, { pose: 'victory', dur: 1200 }],
  net_throw:    [{ pose: 'guard', dur: 0 }, { pose: 'net_ready', dur: 130 }, { pose: 'net_throw', dur: 90 }, { pose: 'net_throw', dur: 60 }, { pose: 'guard', dur: 140 }], // 왼손 특수기: 그물 던지기
  hit:    [{ pose: 'guard', dur: 0 }, { pose: 'hit', dur: 70 }, { pose: 'guard', dur: 260 }],
  block:  [{ pose: 'guard', dur: 0 }, { pose: 'block', dur: 60 }, { pose: 'block', dur: 220 }, { pose: 'guard', dur: 160 }],
  bound:  [{ pose: 'hit', dur: 0 }, { pose: 'bound', dur: 120 }],
  die:    [{ pose: 'hit', dur: 0 }, { pose: 'stagger', dur: 160 }, { pose: 'collapse', dur: 200 }, { pose: 'down', dur: 240 }],
  die_forward: [{ pose: 'hit', dur: 0 }, { pose: 'kneel_up', dur: 180 }, { pose: 'kneel_down', dur: 260 }, { pose: 'kneel_down', dur: 120 }, { pose: 'down_fwd', dur: 220 }],
  die_back:    [{ pose: 'hit', dur: 0 }, { pose: 'fly_back', dur: 130 }, { pose: 'down_back', dur: 200 }],
  die_side:    [{ pose: 'hit', dur: 0 }, { pose: 'sit', dur: 170 }, { pose: 'sit_slump', dur: 220 }, { pose: 'sit_slump', dur: 120 }, { pose: 'down_sit', dur: 240 }],
  guard:  [{ pose: 'guard', dur: 0 }],
  idle:   [{ pose: 'idle', dur: 0 }],
  plea:   [{ pose: 'down', dur: 0 }, { pose: 'kneel_up', dur: 600 }, { pose: 'plea', dur: 500 }, { pose: 'plea', dur: 200 }],          // 쓰러진 채 → 무릎 → 검지 들기
  rise:   [{ pose: 'plea', dur: 0 }, { pose: 'kneel_up', dur: 300 }, { pose: 'captive', dur: 500 }, { pose: 'idle', dur: 300 }],        // 살았다: 천천히 일어섬
  slump:  [{ pose: 'plea', dur: 0 }, { pose: 'kneel_down', dur: 220 }, { pose: 'kneel_down', dur: 200 }, { pose: 'down_fwd', dur: 320 }], // 처형: 고개 떨구고 엎어짐
};
// 이동 자세: 달리기(다리 교차 + 상하 바운스) / 살금살금(웅크린 채 발끝 통통)
export function runSkeleton(phase: number, run: boolean): Skeleton {
  const sw = Math.sin(phase);
  if (run) return { lean: 16, frontArm: [-50 - sw * 35, 60], backArm: [40 + sw * 35, 30], frontLeg: [28 + sw * 34, -30 + Math.max(0, -sw) * 40], backLeg: [-28 - sw * 34, 30 * Math.max(0, sw)], headBob: 1, lift: Math.abs(Math.cos(phase)) * 4 };
  return { lean: 12, frontArm: [-60, 90], backArm: [45, 25], frontLeg: [26 + sw * 10, -18], backLeg: [-22 - sw * 10, 14], headBob: 2, sink: 3, lift: Math.abs(Math.sin(phase * 0.5)) * 3 };
}
// 뒷걸음: 상대를 보며 방어 자세 그대로 뒤로 물러난다 (등을 보이지 않는다). 보폭은 걷기보다 짧다
export function backstepSkeleton(phase: number): Skeleton {
  const sw = Math.sin(phase);
  return { lean: -4, frontArm: [-60, 95], backArm: [40, 20], frontLeg: [14 + sw * 14, -12 + Math.max(0, sw) * 12], backLeg: [-16 - sw * 14, 10 + Math.max(0, -sw) * 10], headBob: 1, lift: Math.abs(Math.cos(phase)) * 2 };
}
export const CEREMONIES: ClipName[] = ['victory', 'salute', 'bow', 'lap'];
export function clipLength(name: ClipName) { return CLIPS[name].reduce((s, k) => s + k.dur, 0); }
// 유형별 공격 클립
// 오른손 무기에 따른 죽음 클립: 내려찍기=앞으로 엎어짐, 찌르기=뒤로 날아감, 삼지창=주저앉아 무너짐
export function deathClipForWeapon(w: MainHand): ClipName {
  return w === 'sica' ? 'die_forward' : w === 'trident' ? 'die_side' : 'die_back';
}
export function deathClipFor(attacker: GType): ClipName { return deathClipForWeapon(loadoutFor(attacker).main); }

// 오른손: 공격 동작
export function attackClipForLoadout(l: Loadout, aggressive = false): ClipName {
  switch (l.main) {
    case 'sica': return 'attack';                                   // 내려찍기
    case 'trident': case 'spear': return 'stab';                     // 긴 찌르기
    case 'gladius': return aggressive ? 'stab_secutor' : 'stab';    // 짧은 찌르기 (세쿠토르는 한 발 더)
  }
}
// 연속 공격: 무기별 두 번째 동작
export function comboClipForLoadout(l: Loadout): ClipName {
  return l.main === 'sica' ? 'combo_up' : (l.main === 'trident' || l.main === 'spear') ? 'combo_sweep' : 'combo_slash';
}
export function comboClipFor(type: GType): ClipName { return comboClipForLoadout(loadoutFor(type)); }
// 왼손: 방어 동작(방패) 또는 특수기 동작(그물). 없으면 null
export function offhandClipFor(off: OffHand): { kind: 'guard' | 'skill'; clip: ClipName } | null {
  switch (off) {
    case 'scutum': return { kind: 'guard', clip: 'block' };
    case 'parmula': return { kind: 'guard', clip: 'block' };
    case 'net': return { kind: 'skill', clip: 'net_throw' };
    default: return null;
  }
}
export function attackClipFor(type: GType): ClipName { return attackClipForLoadout(loadoutFor(type), type === 'secutor'); }
export function isDeathClip(c: ClipName) { return c === 'die' || c === 'die_forward' || c === 'die_back' || c === 'die_side' || c === 'slump'; }
const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
// 클립 시작 후 경과 ms → 자세
export function clipSkeleton(name: ClipName, elapsed: number): Skeleton {
  const keys = CLIPS[name];
  let t = 0;
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (elapsed < t + k.dur) return lerpSkeleton(POSES[keys[i - 1].pose], POSES[k.pose], easeOut((elapsed - t) / k.dur));
    t += k.dur;
  }
  return POSES[keys[keys.length - 1].pose];
}

// 낙서 느낌: 선을 살짝 흔든다 (시드 기반, 프레임마다 떨리지 않게)
function jit(seed: number, amp: number) { const x = Math.sin(seed * 12.9898) * 43758.5453; return (x - Math.floor(x) - 0.5) * amp; }

export function drawStickman(ctx: CanvasRenderingContext2D, who: GType | Loadout, o0: DrawOpts) {
  let o = o0;
  const L: Loadout = typeof who === 'string' ? loadoutFor(who, o0.accessories ?? []) : who;
  if (L.tunic && !o.garment && !o.bare) o = { ...o, garment: 'tunic', garmentColor: o.team ?? '#c9b283' }; // 에퀘스: 튜닉 차림 (팀 색)
  const type: GType = typeof who === 'string' ? who : 'murmillo'; // 시드용
  const s = o.scale ?? 1, f = o.facing ?? 1, pose = o.pose ?? 'idle', t = o.t ?? 0;
  const sk = o.skeleton ?? POSES[pose];
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(s * f, s);
  if (o.wobble) { ctx.translate(Math.sin(t * 28) * 1.6, 0); ctx.rotate(Math.sin(t * 22) * 0.06); } // 버둥거림
  if (sk.shift || sk.lift) ctx.translate(sk.shift ?? 0, -(sk.lift ?? 0));
  if (sk.turn) ctx.scale(1 - sk.turn * 0.6, 1); // 카메라 쪽으로 돌아 납작해짐
  ctx.strokeStyle = o.ink ?? INK; ctx.fillStyle = o.ink ?? INK;
  ctx.lineWidth = 3.0 / Math.sqrt(s); ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // 기준: 발이 (0,0). 몸통 길이 30, 다리 24, 팔 22, 머리 반지름 7
  // 아기자기한 비율(2026-09-09): 머리 크게, 다리·몸 짧게. 전체 키 ≈ 58
  const LEG = 22, BODY = 22, ARM = 17, HEAD = 9;
  const rad = (d: number) => d * Math.PI / 180;
  const seed = type.length * 7 + (pose === 'attack' ? 3 : 0);

  // sink: 엉덩이를 낮춘다 (발은 땅에 그대로)
  const hipY = -LEG + (sk.sink ?? 0);
  const lieK = sk.lying ? (sk.lieK ?? 1) : 0;
  if (lieK > 0) {
    // 엉덩이를 축으로 90도 눕힌다 (lieK 로 보간). lieDir: -1 = 뒤로(머리가 뒤), 1 = 앞으로(머리가 앞)
    const d = sk.lieDir ?? -1;
    ctx.translate(12 * d * lieK, -5 * lieK); ctx.rotate(rad(90 * d * lieK)); ctx.translate(0, -hipY * lieK);
  }
  const idleBob = (!o.skeleton && pose === 'idle') || (o.skeleton && !sk.lying) ? Math.sin(t * 2.2) * 1.2 : 0;

  // 다리
  const leg = (a: [number, number], hx: number) => {
    const kx = hx + Math.sin(rad(a[0])) * LEG * 0.55, ky = hipY + Math.cos(rad(a[0])) * LEG * 0.55;
    const fx = kx + Math.sin(rad(a[0] + a[1])) * LEG * 0.5, fy = ky + Math.cos(rad(a[0] + a[1])) * LEG * 0.5;
    const g = lieK > 0 ? Infinity : 0; // 서 있을 땐 무릎·발이 땅 아래로 못 내려감
    ctx.beginPath(); ctx.moveTo(hx, hipY); ctx.lineTo(kx + jit(seed + 1, 1), Math.min(ky, g)); ctx.lineTo(fx, Math.min(fy, g)); ctx.stroke();
    return { fx, fy };
  };
  leg(sk.backLeg, 0);
  leg(sk.frontLeg, 0);

  // 몸통
  const lean = rad(sk.lean);
  const shX = Math.sin(lean) * BODY, shY = hipY - Math.cos(lean) * BODY + idleBob;
  ctx.beginPath(); ctx.moveTo(0, hipY); ctx.lineTo(shX + jit(seed + 2, 1.2), shY); ctx.stroke();
  if (!o.garment) { // 로인클로스(허리 천): 낙서에서 눈에 띄는 삼각형
    ctx.save(); ctx.translate(0, hipY); ctx.rotate(lean * 0.6);
    ctx.beginPath(); ctx.moveTo(-4, -2); ctx.lineTo(4, -2); ctx.lineTo(0.5, 5.5); ctx.closePath();
    if (o.team) { ctx.save(); ctx.fillStyle = o.team; ctx.fill(); ctx.restore(); }
    ctx.stroke();
    ctx.restore();
  }
  // 옷: 튜닉(허벅지까지) / 토가(무릎까지, 자주색 띠·주름·어깨 자락). 뒷팔을 그린 뒤에 덮어 뒷팔 위쪽이 옷 뒤로 들어간다
  const drawGarment = () => { if (!o.garment) return;
    const toga = o.garment === 'toga'; const bottom = hipY + (toga ? 13 : 7); const sway = Math.sin(lean) * 4;
    ctx.save(); ctx.fillStyle = o.garmentColor ?? '#c9b283'; ctx.lineWidth = 1.6 / Math.sqrt(s);
    ctx.beginPath(); ctx.moveTo(shX - 5.5, shY + 1); ctx.lineTo(shX + 5.5, shY + 1); ctx.lineTo(7 + sway, bottom); ctx.lineTo(-7 + sway, bottom); ctx.closePath(); ctx.fill(); ctx.stroke(); // 옷은 몸보다 조금만 넓게 (팔이 보이도록)
    if (o.apron) { ctx.fillStyle = '#e8d9b5'; ctx.fillRect(shX - 4, shY + 12, 8, bottom - shY - 14); }
    if (o.garmentStripe) { ctx.strokeStyle = o.garmentStripe; ctx.lineWidth = 2.2 / Math.sqrt(s); ctx.beginPath(); ctx.moveTo(shX - 3, shY + 3); ctx.lineTo(-5 + sway * 0.6, bottom - 2); ctx.stroke(); }
    if (toga) {
      ctx.strokeStyle = '#b9a26f'; ctx.lineWidth = 1 / Math.sqrt(s); ctx.beginPath(); ctx.moveTo(shX + 3, shY + 8); ctx.lineTo(5 + sway * 0.4, bottom - 4); ctx.moveTo(shX + 7, shY + 14); ctx.lineTo(9 + sway * 0.4, bottom - 6); ctx.stroke(); // 주름
      // 어깨 너머 자락: 왼(뒤) 어깨에서 등 뒤로 늘어지는 채워진 띠 (망토가 아니라 토가 천의 끝)
      ctx.fillStyle = o.garmentColor ?? '#c9b283'; ctx.strokeStyle = o.ink ?? INK; ctx.lineWidth = 1.6 / Math.sqrt(s);
      ctx.beginPath(); ctx.moveTo(shX - 7, shY); ctx.lineTo(shX - 12, shY + 5); ctx.quadraticCurveTo(shX - 14 + sway * 0.5, shY + 22, -11 + sway, bottom - 2); ctx.lineTo(-6.5 + sway, bottom - 1); ctx.quadraticCurveTo(shX - 9, shY + 20, shX - 5.5, shY + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      // 움보: 가슴을 가로질러 오른쪽 허리로 내려가는 굵은 주름
      ctx.beginPath(); ctx.moveTo(shX - 7, shY + 4); ctx.quadraticCurveTo(shX + 7, shY + 15, 5 + sway * 0.5, hipY + 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(shX - 6, shY + 8); ctx.quadraticCurveTo(shX + 5, shY + 18, 3 + sway * 0.5, hipY + 6); ctx.stroke();
    }
    ctx.restore();
  };
  // 팔
  // 팔은 위팔·아래팔 두 마디. 마디별로 깊이를 나눌 수 있게 점만 계산하는 함수와 그리는 함수를 분리
  const armPts = (a: [number, number]) => {
    const ex = shX + Math.sin(rad(a[0])) * ARM * 0.5, ey = shY + Math.cos(rad(a[0])) * ARM * 0.5;
    const hx = ex + Math.sin(rad(a[0] + a[1])) * ARM * 0.5, hy = ey + Math.cos(rad(a[0] + a[1])) * ARM * 0.5;
    return { ex, ey, hx, hy, ang: a[0] + a[1] };
  };
  const seg = (x0: number, y0: number, x1: number, y1: number) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  const arm = (a: [number, number]) => { const p = armPts(a); seg(shX, shY, p.ex, p.ey); seg(p.ex, p.ey, p.hx, p.hy); return p; };
  // 뒷팔(방패 손) 먼저, 앞팔(무기 손) 나중. 옷을 입었으면 뒷팔 위팔은 옷 뒤, 아래팔은 앞으로 나올 때만 옷 앞에
  let back: { hx: number; hy: number; ang: number };
  if (o.garment) {
    const p = armPts(sk.backArm); back = p;
    const forearmFront = p.hx > shX + 3; // 손이 어깨선보다 앞이면 아래팔은 옷 앞
    seg(shX, shY, p.ex, p.ey);
    if (!forearmFront) seg(p.ex, p.ey, p.hx, p.hy);
    drawGarment(); ctx.strokeStyle = o.ink ?? INK; ctx.fillStyle = o.ink ?? INK; ctx.lineWidth = 3.0 / Math.sqrt(s); ctx.lineCap = 'round';
    if (forearmFront) seg(p.ex, p.ey, p.hx, p.hy);
  } else {
    back = arm(sk.backArm);
    if (!o.bare) drawOffhand(ctx, L, back.hx, back.hy, seed, sk.backArm[0] + sk.backArm[1], !!o.noNet, o.team);
  }
  let frontA = sk.frontArm;
  if (sk.reach) { // 2관절 IK: 앞손이 목표점을 향함 (팔꿈치는 아래쪽으로)
    const dx = sk.reach.x - shX, dy = sk.reach.y - shY; const d = Math.min(ARM - 0.01, Math.hypot(dx, dy));
    const th = Math.atan2(dx, dy) * 180 / Math.PI; const be = Math.acos(Math.max(-1, Math.min(1, d / ARM))) * 180 / Math.PI;
    const cand: [number, number][] = [[th + be, -2 * be], [th - be, 2 * be]];
    frontA = cand[0]; const ey0 = Math.cos(rad(cand[0][0])), ey1 = Math.cos(rad(cand[1][0])); if (ey1 > ey0) frontA = cand[1];
  }
  // 머리: 뒷팔·옷 뒤, 앞팔(카메라 쪽) 앞에 놓인다 → 앞팔은 머리 뒤에 그린다
  const hx0 = shX + Math.sin(lean) * (HEAD + 2), hy0 = shY - Math.cos(lean) * (HEAD + 2) + sk.headBob;
  drawHead(ctx, o.bare ? 'none' : L.helmet, hx0, hy0, HEAD, seed);
  if (o.beard) { ctx.lineWidth = 2.2 / Math.sqrt(s); ctx.beginPath(); ctx.moveTo(hx0 + 4, hy0 + 4); ctx.quadraticCurveTo(hx0 + 6, hy0 + 10, hx0 - 1, hy0 + 11); ctx.stroke(); }
  if (!o.bare) drawAccessories(ctx, L, hx0, hy0, HEAD, shX, shY, hipY, seed);
  ctx.strokeStyle = o.ink ?? INK; ctx.fillStyle = o.ink ?? INK; ctx.lineWidth = 3.0 / Math.sqrt(s);
  const front = arm(frontA);
  if (lieK < 0.5 && !o.bare) drawWeapon(ctx, L.main, front.hx, front.hy, front.ang, pose, seed);
  if (!o.bare) drawExtras(ctx, L, shX, shY, hipY, seed); // 쓰러지면 무기를 놓친다
  if (o.hands) { ctx.save(); o.hands(ctx, front, back, { shX, shY, hipY }); ctx.restore(); ctx.strokeStyle = o.ink ?? INK; ctx.fillStyle = o.ink ?? INK; ctx.lineWidth = 3.0 / Math.sqrt(s); }


  ctx.restore();
}

// 상대를 덮은 그물: 머리부터 발까지 덮는 돔. (x, footY) = 발 위치, h = 키
// 방에 거치해 둔 장비(켈라 장식). 기준점 = 벽 앞 바닥. 투구는 벽 선반 위, 검·시카는 못 두 개에 가로로 걸고, 창·삼지창은 벽에 비스듬히 세워 두고,
// 방패는 벽에 기대 바닥에 놓고, 그물은 못에 걸어 늘어뜨린다
export function drawGearRack(ctx: CanvasRenderingContext2D, who: GType | Loadout, x: number, floorY: number, s: number, seed: number, team?: string) {
  const L = typeof who === 'string' ? loadoutFor(who) : who;
  ctx.save(); ctx.translate(x, floorY); ctx.scale(s, s); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineCap = 'round';
  const peg = (px: number, py: number) => { ctx.fillStyle = '#3a2412'; ctx.fillRect(px - 1.2, py - 1.2, 2.4, 3.2); };
  // 선반 + 투구
  if (L.helmet !== 'none') { ctx.fillStyle = '#6b4a22'; ctx.fillRect(-14, -54, 28, 3); ctx.fillRect(-11, -51, 3, 5); ctx.fillRect(8, -51, 3, 5); drawHead(ctx, L.helmet, 0, -63, 9, seed, '#a08a60'); }
  // 무기
  const long = L.main === 'spear' || L.main === 'trident';
  if (long) { ctx.save(); ctx.translate(-13, -14); ctx.rotate(0.16); drawWeapon(ctx, L.main, 0, 0, 180, 'idle', seed); ctx.restore(); } // 자루 끝을 바닥에, 벽에 비스듬히 기대 세움
  else { peg(-8, -38); peg(6, -38); ctx.save(); ctx.translate(9, -36); ctx.rotate(-Math.PI / 2); drawWeapon(ctx, L.main, 0, 0, 180, 'idle', seed); ctx.restore(); } // 못 둘에 가로로 (손잡이 오른쪽)
  // 방패 / 그물 / 왼손 칼
  const shieldBottom: Partial<Record<string, number>> = { scutum: 11, medium: 8, parma: 9, parmula: 7 };
  const sb = shieldBottom[L.off];
  if (sb != null) { ctx.save(); ctx.translate(7, -sb - 1); ctx.rotate(-0.14); drawOffhand(ctx, L, 0, 0, seed, 0, false, team); ctx.restore(); } // 벽에 기대 바닥에
  else if (hasNet(L)) { peg(10, -44); ctx.save(); ctx.translate(10, -43); drawOffhand(ctx, L, 0, 0, seed, 0, false, team); ctx.restore(); } // 못에 걸어 늘어뜨림
  else if (L.off === 'blade') { peg(-8, -28); peg(6, -28); ctx.save(); ctx.translate(9, -26); ctx.rotate(-Math.PI / 2 + 0.9); drawOffhand(ctx, L, 0, 0, seed, 0, false, team); ctx.restore(); } // 두 번째 칼도 가로로
  ctx.restore();
}
export function drawNetOverlay(ctx: CanvasRenderingContext2D, x: number, footY: number, h: number, ink = INK, t = 0) {
  const rx = h * 0.42, ry = h * 0.56, cy = footY - h * 0.02; // 타원 중심은 발 근처, 위로 ry 만큼
  ctx.save(); ctx.strokeStyle = ink; ctx.lineWidth = 1.1; ctx.globalAlpha *= 0.65;
  ctx.translate(x, cy); ctx.scale(1, ry / rx);
  const sway = Math.sin(t * 6) * 1.5;
  // 윗 돔
  ctx.beginPath(); ctx.arc(0, 0, rx, Math.PI, Math.PI * 2); ctx.stroke();
  // 격자
  ctx.beginPath();
  for (let i = -rx + 7; i < rx; i += 7) { const hh = Math.sqrt(rx * rx - i * i); ctx.moveTo(i + sway * 0.3, -hh); ctx.lineTo(i, 2); }
  for (let j = 7; j < rx; j += 7) { const w = Math.sqrt(rx * rx - j * j); ctx.moveTo(-w, -j); ctx.lineTo(w, -j); }
  ctx.stroke();
  // 늘어진 단 (물결)
  ctx.beginPath(); ctx.moveTo(-rx, 0);
  for (let i = -rx; i <= rx; i += 6) ctx.lineTo(i, 2 + Math.abs(Math.sin(i * 0.5 + t * 4)) * 3);
  ctx.stroke();
  ctx.restore();
}
// 날아가는 그물: 뭉치(open=0)에서 펼쳐진 원(open=1)으로. spin 으로 회전
export function drawNetProjectile(ctx: CanvasRenderingContext2D, x: number, y: number, rMax: number, open: number, spin: number, ink = INK) {
  const r = 4 + (rMax - 4) * open;
  ctx.save(); ctx.translate(x, y); ctx.rotate(spin); ctx.strokeStyle = ink; ctx.lineWidth = 1.2; ctx.globalAlpha *= 0.9;
  if (open < 0.25) { // 뭉치: 작은 덩어리 + 꼬리
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-3, 2); ctx.quadraticCurveTo(-10, 6, -14, 2); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    const step = Math.max(5, r / 4);
    ctx.beginPath();
    for (let i = -r + step; i < r; i += step) { const hh = Math.sqrt(r * r - i * i); ctx.moveTo(i, -hh); ctx.lineTo(i, hh); ctx.moveTo(-hh, i); ctx.lineTo(hh, i); }
    ctx.stroke();
    // 가장자리 추(무게추) 4개
    ctx.fillStyle = ink; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(Math.cos(k * Math.PI / 2) * r, Math.sin(k * Math.PI / 2) * r, 1.8, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

export const SKIN = '#eadfc0'; // 머리 채움 (불투명: 뒤의 선이 비치지 않게)
function drawHead(ctx: CanvasRenderingContext2D, helmet: Helmet, x: number, y: number, r: number, seed: number, skin = SKIN) {
  ctx.beginPath(); ctx.arc(x + jit(seed + 3, .8), y, r, 0, Math.PI * 2); ctx.save(); ctx.fillStyle = skin; ctx.fill(); ctx.restore(); ctx.stroke();
  switch (helmet) {
    case 'crested': // 큰 볏 + 얼굴 격자 (무르밀로)
      ctx.beginPath(); ctx.moveTo(x - 2, y - r); ctx.quadraticCurveTo(x + 2, y - r - 12, x + 12, y - r - 2); ctx.lineTo(x + 6, y - r + 1); ctx.stroke();
      ctx.beginPath(); for (let i = -1; i <= 1; i++) { ctx.moveTo(x + 2, y + i * 3); ctx.lineTo(x + r, y + i * 3); } ctx.stroke();
      break;
    case 'smooth': // 매끈한 투구, 작은 눈구멍 (세쿠토르)
      ctx.beginPath(); ctx.arc(x, y, r + 1.5, Math.PI * 0.95, Math.PI * 2.05); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 3, y - 1, 1, 0, Math.PI * 2); ctx.fill();
      break;
    case 'griffin': // 굽은 볏 + 챙 (트라엑스)
      ctx.beginPath(); ctx.moveTo(x - 4, y - r + 1); ctx.quadraticCurveTo(x - 2, y - r - 11, x + 8, y - r - 8); ctx.quadraticCurveTo(x + 4, y - r - 3, x + 4, y - r + 1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - r - 2, y + 1); ctx.lineTo(x + r + 2, y + 1); ctx.stroke();
      break;
    case 'brimmed': // 챙 넓은 투구 + 볏 (호플로마쿠스)
      ctx.beginPath(); ctx.moveTo(x - r - 3, y - 2); ctx.lineTo(x + r + 3, y - 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 3, y - r); ctx.quadraticCurveTo(x, y - r - 11, x + 9, y - r - 4); ctx.lineTo(x + 5, y - r + 1); ctx.stroke();
      break;
    case 'visored': // 면갑 투구: 둥근 머리 + 얼굴 가리개 격자, 볏 없음 (프로보카토르)
      ctx.beginPath(); ctx.arc(x, y, r + 1.5, Math.PI * 0.9, Math.PI * 2.1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 1, y - 3); ctx.lineTo(x + r, y - 3); ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + r, y + 1); ctx.moveTo(x + 4, y - 5); ctx.lineTo(x + 4, y + 4); ctx.stroke();
      break;
    case 'plumed': // 챙 투구 + 깃털 둘 (에퀘스)
      ctx.beginPath(); ctx.moveTo(x - r - 3, y - 2); ctx.lineTo(x + r + 3, y - 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 3, y - r); ctx.quadraticCurveTo(x - 6, y - r - 9, x - 2, y - r - 13); ctx.moveTo(x + 3, y - r); ctx.quadraticCurveTo(x + 6, y - r - 9, x + 2, y - r - 13); ctx.stroke();
      break;
    case 'none': // 맨머리: 기본 스틱맨은 눈·머리카락 없이 동그라미만 (낙서 기본형)
      break;
  }
}

function drawOffhand(ctx: CanvasRenderingContext2D, L: Loadout, x: number, y: number, seed: number, handAng = 0, noNet = false, team?: string) {
  ctx.save(); ctx.translate(x, y);
  if (L.off === 'scutum' || L.off === 'parmula' || L.off === 'parma' || L.off === 'medium') ctx.rotate(Math.max(-25, Math.min(0, -(handAng - 40) * 0.5)) * Math.PI / 180); // 앞으로 뻗을수록 정면
  switch (L.off) {
    case 'scutum': // 큰 직사각형, 빗금 (팀 색)
      ctx.beginPath(); ctx.rect(-5, -13, 10, 24); if (team) { ctx.save(); ctx.fillStyle = team; ctx.globalAlpha *= 0.85; ctx.fill(); ctx.restore(); } ctx.stroke();
      ctx.beginPath(); for (let i = -9; i < 10; i += 5) { ctx.moveTo(-5, i); ctx.lineTo(5, i - 4); } ctx.stroke();
      break;
    case 'parmula': // 작은 원형 (팀 색)
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); if (team) { ctx.save(); ctx.fillStyle = team; ctx.globalAlpha *= 0.85; ctx.fill(); ctx.restore(); } ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
      break;
    case 'parma': // 둥근 청동 방패: 조금 크고 테두리 이중, 가운데 돌기 (팀 색)
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); if (team) { ctx.save(); ctx.fillStyle = team; ctx.globalAlpha *= 0.85; ctx.fill(); ctx.restore(); } ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
      break;
    case 'medium': // 중형 직사각형 (스쿠툼보다 짧다)
      ctx.beginPath(); ctx.rect(-5, -9, 10, 17); if (team) { ctx.save(); ctx.fillStyle = team; ctx.globalAlpha *= 0.85; ctx.fill(); ctx.restore(); } ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-5, -1); ctx.lineTo(5, -1); ctx.stroke();
      break;
    case 'blade': // 왼손 시카: 굽은 칼을 거꾸로 쥠
      ctx.save(); ctx.rotate(-0.9); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -8); ctx.quadraticCurveTo(1, -15, 6, -18); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-3, -1); ctx.lineTo(3, -1); ctx.stroke(); ctx.restore();
      break;
  }
  if (hasNet(L) && !noNet) { // 손에 든 그물
    ctx.save(); ctx.lineWidth *= 0.55;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) { ctx.moveTo(0, 0); ctx.quadraticCurveTo(-6 + i * 2, 7, -13 + i * 5, 16); }
    for (let j = 1; j <= 3; j++) { const y = 5 * j; ctx.moveTo(-3 - j * 2.5, y); ctx.quadraticCurveTo(0, y + 2, 3 + j * 2, y); }
    ctx.stroke(); ctx.restore();
  }
  ctx.restore();
}

// 부속: 팔보호대(마니카), 정강이받이, 어깨 보호대(갈레루스), 흉갑
function drawExtras(ctx: CanvasRenderingContext2D, L: Loadout, shX: number, shY: number, hipY: number, seed: number) {
  ctx.save(); ctx.lineWidth *= 0.6;
  if (L.extras.includes('galerus')) { ctx.beginPath(); ctx.moveTo(shX - 6, shY - 6); ctx.lineTo(shX - 2, shY - 12); ctx.lineTo(shX + 2, shY - 5); ctx.stroke(); }
  if (L.extras.includes('pectorale')) { ctx.beginPath(); ctx.rect(shX - 4, shY + 2, 8, 7); ctx.stroke(); }
  if (L.extras.includes('greaves')) { ctx.beginPath(); for (let i = 0; i < 3; i++) { ctx.moveTo(-3, -6 - i * 3); ctx.lineTo(3, -7 - i * 3); } ctx.stroke(); } // 앞다리 정강이 빗금(대략 위치)
  ctx.restore();
}

// 악세사리: 별칭·전적 장식
function drawAccessories(ctx: CanvasRenderingContext2D, L: Loadout, hx: number, hy: number, r: number, shX: number, shY: number, hipY: number, seed: number) {
  for (const a of L.accessories) {
    ctx.save();
    switch (a) {
      case 'laurel': // 월계관: 초록 잎사귀 + 금빛 띠
        ctx.strokeStyle = '#3b7a2c'; ctx.fillStyle = '#4f9a3a'; ctx.lineWidth *= 0.8;
        ctx.beginPath(); ctx.arc(hx, hy, r + 1.5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        for (let i = -3; i <= 3; i++) { const t = Math.PI * (1.15 + i * 0.12); const cx = hx + Math.cos(t) * (r + 2), cy = hy + Math.sin(t) * (r + 2) - 1; ctx.save(); ctx.translate(cx, cy); ctx.rotate(t + Math.PI / 2); ctx.beginPath(); ctx.ellipse(0, -2.5, 1.6, 3.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
        ctx.strokeStyle = '#e8c96a'; ctx.lineWidth *= 0.9; ctx.beginPath(); ctx.arc(hx, hy, r + 0.5, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
        break;
      case 'scar': // 흉터: 붉은 사선 + 봉합 자국
        ctx.strokeStyle = '#c0392b'; ctx.lineWidth *= 0.8; ctx.beginPath(); ctx.moveTo(hx + 1, hy - 5); ctx.lineTo(hx + 5, hy + 3); ctx.stroke();
        ctx.lineWidth *= 0.7; ctx.beginPath(); for (let i = 0; i < 3; i++) { const t = i / 2; const x = hx + 1 + 4 * t, y = hy - 5 + 8 * t; ctx.moveTo(x - 1.5, y + 0.8); ctx.lineTo(x + 1.5, y - 0.8); } ctx.stroke();
        break;
      case 'sash': // 붉은 띠: 어깨에서 허리로, 넓게
        ctx.strokeStyle = '#b8321f'; ctx.lineWidth *= 1.6; ctx.beginPath(); ctx.moveTo(shX - 3, shY + 2); ctx.lineTo(4, hipY - 2); ctx.stroke();
        ctx.strokeStyle = '#e8c96a'; ctx.lineWidth *= 0.35; ctx.beginPath(); ctx.moveTo(shX - 3, shY + 2); ctx.lineTo(4, hipY - 2); ctx.stroke();
        break;
      case 'armband': // 금빛 완장 (위팔)
        ctx.strokeStyle = '#d4a63a'; ctx.lineWidth *= 1.5; ctx.beginPath(); ctx.moveTo(shX + 3.5, shY + 7); ctx.lineTo(shX + 9.5, shY + 4.5); ctx.stroke();
        ctx.strokeStyle = '#8a6a1a'; ctx.lineWidth *= 0.4; ctx.beginPath(); ctx.moveTo(shX + 3.5, shY + 8.5); ctx.lineTo(shX + 9.5, shY + 6); ctx.stroke();
        break;
      case 'palm': // 종려가지: 초록, 등 뒤에 꽂힘
        ctx.strokeStyle = '#3b7a2c'; ctx.lineWidth *= 0.8; ctx.beginPath(); ctx.moveTo(shX - 4, shY); ctx.lineTo(shX - 10, shY - 18);
        for (let i = 1; i <= 4; i++) { ctx.moveTo(shX - 4 - i * 1.5, shY - i * 4.5); ctx.lineTo(shX - 9 - i * 1.5, shY - i * 4.5 - 2); ctx.moveTo(shX - 4 - i * 1.5, shY - i * 4.5); ctx.lineTo(shX - 1 - i * 1.5, shY - i * 4.5 - 4); }
        ctx.stroke();
        break;
    }
    ctx.restore();
  }
}

function drawWeapon(ctx: CanvasRenderingContext2D, w: MainHand, x: number, y: number, ang: number, pose: Pose, seed: number) {
  ctx.save(); ctx.translate(x, y);
  // 무기는 손 방향 + 앞쪽으로
  // 무기는 전완 방향으로 이어진다. 전완 벡터 (sin a, cos a) 를 '위(-y)' 축에 맞추려면 180 - a
  const dir = 180 - ang; // 공격: 정면, 대기·방어: 앞 아래로 비스듬히
  ctx.rotate(dir * Math.PI / 180);
  switch (w) {
    case 'gladius': // 글라디우스: 짧고 넓은 검
      ctx.beginPath(); ctx.moveTo(0, 3); ctx.lineTo(0, -20); ctx.lineTo(2.2, -24); ctx.lineTo(-2.2, -24); ctx.lineTo(0, -20); ctx.moveTo(-5, -2); ctx.lineTo(5, -2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(1.2, -4); ctx.lineTo(1.2, -19); ctx.stroke(); // 날 두께
      break;
    case 'sica': // 시카: 굽은 칼
      ctx.beginPath(); ctx.moveTo(0, 3); ctx.lineTo(0, -12); ctx.quadraticCurveTo(0, -23, 11, -26); ctx.moveTo(-4, -1); ctx.lineTo(4, -1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(1.5, -12); ctx.quadraticCurveTo(1.5, -20, 9, -23); ctx.stroke(); // 날 두께
      break;
    case 'trident': // 삼지창: 길다
      ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(0, -30); ctx.moveTo(-5.5, -26); ctx.lineTo(-5.5, -37); ctx.moveTo(5.5, -26); ctx.lineTo(5.5, -37); ctx.moveTo(-5.5, -26); ctx.lineTo(5.5, -26); ctx.moveTo(0, -30); ctx.lineTo(0, -39); ctx.stroke();
      break;
    case 'spear': // 창: 긴 자루 + 잎날
      ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(0, -32); ctx.moveTo(0, -32); ctx.lineTo(3, -37); ctx.lineTo(0, -44); ctx.lineTo(-3, -37); ctx.closePath(); ctx.stroke();
      break;
  }
  ctx.restore();
}

// 앉은 관중 스틱맨 (검투사와 같은 머리·선 굵기, 한 줄 몸통). 발이 (0,0).
// k = 몸 펼침 정도(0 탑뷰 점 → 1 완전한 앉은 모습). arms=팔 들기, toga=토가 사선
export function drawSeated(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, ink: string, arms: boolean, toga: boolean, seed: number, k = 1, anchorHead = true, facing: 1 | -1 = 1) {
  // anchorHead: (x,y) 를 머리 중심으로 삼는다 (좌석 위치 = 머리). 몸·다리는 아래로 자란다 → 계단과 한 몸으로 움직임
  const hip0 = -16 * k, sh0 = hip0 - 22 * k - 4, head0 = sh0 - 9;
  ctx.save(); ctx.translate(x, y); ctx.scale(scale * facing, scale); if (anchorHead) ctx.translate(0, -head0);
  ctx.strokeStyle = ink; ctx.lineWidth = 3.0 / Math.sqrt(scale); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const j = jit(seed, 1.5);
  const hipY = -16 * k, shY = hipY - 22 * k - 4;   // 엉덩이, 어깨
  if (k > 0.05) { // 무릎 굽힌 다리: 엉덩이 → 무릎(앞) → 발
    ctx.beginPath(); ctx.moveTo(0, hipY); ctx.lineTo((10 + j) * k, hipY + 1); ctx.lineTo(9 * k, 0); ctx.moveTo(0, hipY); ctx.lineTo((6 + j) * k, hipY + 2); ctx.lineTo(4 * k, 0); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(0, hipY); ctx.lineTo(-2 + j * 0.5, shY); ctx.stroke(); // 몸통
  if (toga && k > 0.5) { ctx.beginPath(); ctx.moveTo(-6, shY + 8); ctx.lineTo(5, shY + 18); ctx.stroke(); }
  if (arms) { ctx.beginPath(); ctx.moveTo(-2, shY + 2); ctx.lineTo(-12, shY - 8); ctx.lineTo(-14, shY - 20); ctx.moveTo(-2, shY + 2); ctx.lineTo(9, shY - 8); ctx.lineTo(12, shY - 20); ctx.stroke(); }
  else if (k > 0.3) { ctx.beginPath(); ctx.moveTo(-2, shY + 2); ctx.lineTo(-9, shY + 12); ctx.lineTo(2, shY + 20); ctx.moveTo(-2, shY + 2); ctx.lineTo(7, shY + 11); ctx.lineTo(10, shY + 20); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(-2 + j * 0.3, shY - 9, 9, 0, Math.PI * 2); ctx.save(); ctx.fillStyle = SKIN; ctx.fill(); ctx.restore(); ctx.stroke(); // 머리 (불투명)
  ctx.restore();
}
