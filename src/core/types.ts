export type GType = 'murmillo' | 'secutor' | 'thraex' | 'retiarius' | 'hoplomachus' | 'provocator' | 'eques' | 'dimachaerus';
export type Lineage = 'nature' | 'victory' | 'myth' | 'nickname' | 'place';
export type Rank = 'tiro' | 'veteranus';
export type HostKind = 'magistrate' | 'candidate' | 'miser' | 'mourner' | 'gambler' | 'imperial'; // 지방 관리(보통) · 선거 후보 · 인색한 유지 · 장례 상주 · 도박꾼 · 황제

export interface Stats { hp: number; atk: number; def: number; spd: number; range: number; }

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
  skills?: string[];      // 기술 id 목록 (core/skills.ts)
  skillMastery?: Record<string, number>; // 기술별 발동 횟수 (숙련)
  skillOffers?: string[]; // 배울 수 있게 된 기술 (플레이어가 배울지 정한다)
  bonded?: boolean;     // 이번 시즌 동향(지명 계보 둘) 조합으로 싸웠다 — 시즌 끝 피로 −1 뒤 지움
  streak?: number;      // 현재 연승
  injuries?: number;    // 부상 생존 횟수
  soloWins?: number;    // 동료 전멸 뒤 홀로 이긴 횟수
  retiariusWins?: number; // 레티아리우스가 낀 상대에게 이긴 횟수
  crowns?: number;      // 화관(주최자 만족 승리) 수
  draws?: number;       // 무승부(스탄테스 미시) 수
  tiroUpset?: boolean;  // 티로일 때 승수 10 이상 베테라누스를 1대1로 꺾음
  scaeva?: boolean;     // 왼손잡이 (타고남): 상대 방패의 첫 타격 감소 절반
  rudisRefused?: number; // 루디스를 거절한 횟수 (플람마)
  typesWon?: GType[];   // 승리를 거둔 유형들 (유형 전환 별칭)
  spared?: number[];    // 내가 이기고 살려 준 상대 id (원한)
  beatenBy?: number[];  // 나를 쓰러뜨린 상대 id (복수 대상)
  revenged?: number;    // 복수 성공 횟수
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
  kind: 'attack' | 'bound' | 'skill' | 'stumble'; // stumble: 지쳐서 헛디딤 (공격 무산, 잠시 무방비)
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
  downed?: boolean;
  skill?: string;         // 발동한 기술 id (kind 'skill', 또는 공격에 실린 기술)
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
  skillUses?: Record<number, Record<string, number>>; // 검투사별 기술 발동 횟수 (숙련에 반영)
  exp?: Record<number, { blocks: number; blockedOn: number; combos: number; comboKill: boolean; netKill: boolean; charges: number; chargeKill: boolean; lowHp: boolean; meleeKill: boolean; wonAfterBlock: boolean }>; // 경험 조건 집계
  counterWin: boolean;   // (구) 상성 우위. 상성 제거 후 항상 false
  form?: Record<number, number>; // 검투사별 그날의 몸 상태 f∈[−1,1] (표시용)
}
