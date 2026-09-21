export type GType = 'murmillo' | 'secutor' | 'thraex' | 'retiarius' | 'hoplomachus' | 'provocator' | 'eques' | 'dimachaerus' | 'scissor' | 'laquearius'; // 2026-09-18 스키소르(아르벨라스)·라쿠에아리우스 추가 (docs/09)
export type Lineage = 'nature' | 'victory' | 'myth' | 'nickname' | 'place';
export type Rank = 'tiro' | 'veteranus';
export type HostKind = 'magistrate' | 'candidate' | 'miser' | 'mourner' | 'gambler' | 'imperial'; // 지방 관리(보통) · 선거 후보 · 인색한 유지 · 장례 상주 · 도박꾼 · 황제

export interface Stats { hp: number; atk: number; def: number; spd: number; hand: number; } // spd = 걸음(유형 고정: 이동·행동 순서·그물 회피) · hand = 손놀림(자란다: 공격 간격·연속·치명타). 사거리는 클래스 장비 수치(classes.ts) — 2026-09-20 docs/09

export interface Gladiator {
  id: number;
  name: string;
  cell?: number; // 켈라 칸 번호 (없으면 처음 볼 때 빈 칸을 배정)
  lineage: Lineage;
  type: GType;
  rank: Rank;
  base: Stats;          // 숨은 재능 포함 원본
  fights: number;
  wins: number;
  missios: number;      // 패배 후 생존 횟수
  injured: number;      // 남은 출전 불가 시즌
  fought?: boolean;     // 이번 시즌 출전함 (시즌당 1회)
  fatigue?: number;     // 누적 피로 0~3: 출전마다 +1, 쉬는 시즌마다 −1. 1당 공·방 −2, 미시오 −5%
  trained?: boolean;    // 이번 시즌 훈련함 (시즌당 1회)
  form?: number;        // 이번 철의 몸 상태 −1~1. 시즌이 시작될 때 굴려 두고 그 철의 모든 경기에 적용한다 (공 +round(f×5) · 방 +round(f×4)). 배정 화면에서 미리 보인다
  buyPrice: number;
  alive: boolean;
  origin?: 'slave' | 'captive' | 'damnatus' | 'auctoratus'; // 출신: 노예 상인 / 전쟁 포로 / 형벌 죄수 / 자유민 계약자
  boughtSeason?: number; // 들어온 시즌 (죄수 3년 만기, 계약 기간 계산)
  contractUntil?: number; // 자유민 계약 만료 시즌 (auctoratus·재계약)
  age?: number;         // 나이. 봄마다 +1. 31세부터 속도, 33세부터 공·방이 서서히 줄어든다
  talent?: 0 | 1 | 2 | 3; // 자질: 평범·재능·비범·천부 (성장 가중치. 능력치 자체는 아님)
  talentKnown?: boolean;  // 자질이 밝혀졌는가 (첫 훈련·첫 경기 뒤). 시장에서는 알 수 없고 값에도 들어가지 않는다
  lastMissio?: boolean;   // 직전 경기에서 미시오로 살아남음 (다음 경기 승리 = 깨우침 계기)
  epithets?: string[];  // 별칭 id 목록 (core/epithets.ts)
  streak?: number;      // 현재 연승
  injuries?: number;    // 부상 생존 횟수
  soloWins?: number;    // 동료 전멸 뒤 홀로 이긴 횟수
  retiariusWins?: number; // 레티아리우스가 낀 상대에게 이긴 횟수
  crowns?: number;      // 화관(주최자 만족 승리) 수
  draws?: number;       // 무승부(스탄테스 미시) 수
  tiroUpset?: boolean;  // 티로일 때 승수 10 이상 베테라누스를 1대1로 꺾음
  scaeva?: boolean;     // 왼손잡이 (타고남, 10%): 반대쪽에서 들어오니 상대가 방패로 막기 어렵다 — 막을 확률 절반. 상대도 왼손잡이면 서로 익숙해 효과 없음
  rudisRefused?: number; // 루디스를 거절한 횟수 (플람마)
  typesWon?: GType[];   // 승리를 거둔 유형들 (유형 전환 별칭)
  spared?: number[];    // 내가 이기고 살려 준 상대 id (원한)
  beatenBy?: number[];  // 나를 쓰러뜨린 상대 id (복수 대상)
  revenged?: number;    // 복수 성공 횟수
  dictata?: string[];     // 익힌 숙련 딕타타 id (최대 셋, docs/09 2-α)
  growth?: { curve: 'normal' | 'early' | 'late' | 'second'; trait?: 'one' | 'field' | 'pupil' | 'even'; one?: 'hp' | 'atk' | 'def' | 'hand'; curveKnown?: boolean; traitKnown?: boolean; trainings?: number; secondDone?: boolean }; // 성장형 (docs/09 §7)
  cap?: { hp: number; atk: number; def: number; hand: number }; // 잠재치(상한) — 닿으면 굵게
  prog?: { hp: number; atk: number; def: number; hand: number }; // 능력치 밑에 쌓인 소수점 (훈련 0.2 씩, 1이 차면 +1 — 2026-09-21 사용자)
  career?: Record<string, number>; // 행동 누적 (경기마다 UnitStats 를 더한다 — 숙련 딕타타 문턱의 재료, docs/09 2-α)
  honor?: number;       // 명예(인기) 0~100: 승리·전통 짝·화관으로 오르고 패배로 조금 깎임. 미시오 생존·대여료에 반영
  status?: 'slave' | 'rudiarius' | 'doctor'; // 노예(기본) / 루디스를 받은 자유민 (급료 받고 출전) / 교관 (출전 안 함, 같은 유형 훈련 강화)
  rudisSeason?: number; // 루디스를 받은 시즌
}

export type ClauseId = 'sponsio' | 'vela' | 'sine_missione'; // 특약: 내기 / 차양·살수 / 미시오 없음
export interface Contract {
  id: number;
  tier: 1 | 2 | 3;
  venue: string;
  host: HostKind;
  bet?: boolean;          // 스폰시오를 받았는가 (accepted 에 'sponsio' 가 있으면 true — 옛 코드 호환)
  clauses?: ClauseId[];   // 이 계약이 내건 특약 후보 (최대 2)
  accepted?: ClauseId[];  // 라니스타가 서명 때 받아들인 특약
  guest?: boolean;        // 초대했던 귀족이 들고 온 계약 (이기면 사례금)
  needVeterans: number;
  challenge?: 'in' | 'out'; // 도전 계약(docs/10): in = 파밀리아가 낸 도전장, out = 우리가 건 도전. 파밀리아가 간판·정예를 세우고 상한이 없다. 수락하면 필수 배정
  classic?: boolean;      // 주최자가 정식 대결(전통 짝)을 주문한 계약 — 짝이 되는 유형을 세워야 성립, 상금 ×1.4 (2026-09-18 docs/08 4-6)
  powerCap?: number;      // 상대 전력 상한 (경기장 등급별). 내 편은 제한 없음. 없으면 무제한 (옛 저장)
  size: 1 | 2 | 3;        // 경기 규모: 1대1 / 2대2 / 3대3
  enemy: Gladiator[];
  enemyPreview: GType[];  // 공개 정보 (에딕타처럼 상대 전원 공개)
  rivalId?: number;       // 상대 파밀리아
}

// (구) 턴제 전투 유닛. 위치 기반 전투에서는 battle.ts 내부 타입 사용
export interface BattleUnit {
  g: Gladiator;
  side: 'A' | 'B';
  hp: number;
  atk: number; def: number; spd: number; range: number;
  bound: number;        // 속박 남은 턴
  firstHitShield: boolean;
  netUsed: boolean;
  row: 'front' | 'back';
}

export interface BattleEvent {
  t: number;              // 초
  turn: number;           // 표시용(초 올림)
  kind: 'attack' | 'bound' | 'shove' | 'stumble' | 'dictata'; // shove: 방패 밀어붙이기 (기술 발동 이벤트는 2026-09-18 기술 개념과 함께 뺐다) // stumble: 지쳐서 헛디딤 (공격 무산, 잠시 무방비)
  actor: number;          // gladiator id
  target?: number;
  dmg?: number;
  targetHp?: number;
  counter?: boolean;
  net?: boolean;
  blocked?: boolean;      // 큰 방패로 첫 타격 반감
  combo?: boolean;        // 연속 공격(추가타)
  charge?: boolean;       // 달려들며 공격(돌진)
  crit?: boolean;         // 치명타
  open?: boolean;         // 빈틈 강타 (헛디딘 상대를 침)
  leg?: boolean;          // 다리를 노려 걸음을 묶음
  trip?: boolean;         // 지친 채 달리다 넘어짐 (일어날 때까지 무방비)
  disarm?: boolean;       // 무기를 놓쳤다 (dropX·dropY 로 날아간다)
  dropX?: number; dropY?: number;
  parried?: boolean;      // 무기로 받아넘김
  netMiss?: boolean;      // 그물을 던졌으나 빗나감 (그물을 잃는다)
  downed?: boolean;
  riposte?: boolean;      // 되치기(막거나 받아넘긴 직후의 반격)로 실린 공격
  dictata?: string;       // 이 타격에 실린(또는 kind 'dictata' 로 따로 일어난) 딕타타 id — 화면은 이름을 띄운다
}

// 위치 스냅샷: [id, x, y, hp]
export interface BattleFrame { t: number; u: [number, number, number, number, number][]; } // [검투사 id, x, y, 남은 HP, 남은 숨]

export interface BattleResult {
  events: BattleEvent[];
  frames: BattleFrame[];
  duration: number;       // 초
  initialHp: Record<number, number>;
  winner: 'A' | 'B' | 'draw';
  turns: number;
  log: string[];
  downed: { A: Gladiator[]; B: Gladiator[] };
  counterWin: boolean;   // (구) 상성 우위. 상성 제거 후 항상 false
  form?: Record<number, number>; // 검투사별 그날의 몸 상태 f∈[−1,1] (표시용)
  stats: Record<number, UnitStats>; // 검투사별 행동 누적 (숙련 딕타타 문턱의 재료)
  mounted: Record<number, number>;  // 말을 타고 들어온 검투사가 내린 시각 (에퀘스 — 화면이 그 전까지 말을 그린다)
}
// 한 경기의 행동 누적 (docs/09 2-α): 경기 뒤 검투사의 경력 누적치에 더한다
export interface UnitStats { dmgDealt: number; dmgTaken: number; blocks: number; blockedOn: number; crits: number; critsTaken: number; combos: number; charges: number; chargedOn: number; kills: number; boundKills: number; misses: number; boundTimes: number; flanked: number; rangedDmg: number; inside: number; nearAllySec: number; dictata: Record<string, number> }
