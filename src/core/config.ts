// 숫자 초안. docs/05-numbers.md 와 동기화.
export const CONFIG = {
  seasons: 0,        // 0 = 시즌 제한 없음 (파산할 때까지). 시뮬은 simSeasons 만큼만 돈다
  simSeasons: 12,    // 봇 시뮬레이션 길이
  startMoney: 24000,
  startGladiators: 2, // 시작 로스터: 명부의 펠릭스(무르밀로·재능, 루두스에 딸려 온 사람) + 평범 중 무르밀로 아닌 유형 하나(시드) — docs/08 8절
  market: { perSeason: 2, firstSeason: 3, reroll: 800, maxApp: [99, 2, 1, 1] as const, // 시즌당 매물 2(첫 시즌 3) · 리롤 수수료(상인에게 좋은 물건을 먼저 보여 달라는 웃돈, 후반 지출처) · 등급별 최대 등장 횟수(평범 무제한·재능 2·비범 1·천부 1, 넘기면 다른 라니스타에게 팔려 파밀리아 보충 인원이 된다)
    tierTable: [[0, [60, 40, 0, 0]], [25, [35, 45, 20, 0]], [40, [15, 40, 35, 10]], [60, [5, 25, 45, 25]]] as [number, [number, number, number, number]][] }, // 오토체스 상점: 호감도 단계별 평범·재능·비범·천부 확률(%). 계약 등급 문턱과 같은 숫자
  upkeepPerGladiator: 300,  // 베테라누스 유지비. 검투사는 싸고 시설·명성이 비싸다 (2026-09-15 재편)
  upkeepTiro: 200,          // 티로 유지비
  upkeepFacility: { cell: 50, star: 100, kitchen: 150, bed: 100, medicine: 100, herbs: 150, palus: 100, gym: 150 }, // 시설 유지비: 증축 칸·숙소 ★·조리장 단계·침상(첫 침상 제외)·의술 단계·약재 단계·팔루스(기본 2 제외)·훈련 시설 단계
  upkeepSmallLudus: 0.75,   // 켈라 4칸 이하 작은 루두스는 검투사 유지비 −25% (초반 완화)
  upkeepFame: { from: 60, per: 40 },
  contractDiff: { ratio: { weak: 0.85, even: 1.1, strong: 1.4 }, lateFrom: 12, lateWeakToStrong: 0.5 }, // 계약 상대 강도(내 최선 팀 전력 대비) · 후반(lateFrom 시즌부터) 약한 계약이 강한 계약으로 바뀔 확률
  challenge: { fameWin: 10, fameLose: -4, basePower: 149, secondPowerMul: 0.85, secondHonorMul: 0.5, starWinsPerHonor: 5 }, // 졸업전(간판내기): 승리 호감도 +10(도장 하나가 일반 승리 여럿보다 큼) · 패배 −4 · 간판 절대 강도 = basePower(시즌 1 베테라누스 평균 전력 149 = 기술 포함, 2026-09-23 2,000명 측정) × 파밀리아 계수 · 두 번째는 간판의 0.85배 전력·절반 명예 · 간판 승수 = 명예÷5
  rivalFameGrow: 0.004,     // 경쟁 파밀리아 보충 검투사 강도: 내 호감도 50 위로 1점당 // 명성 유지비: 호감도 60부터 (호감도−50)×40 (연회·선물·후원 없이는 이름이 안 남는다)
  statRoll: { // 시장·상대 검투사의 초기 능력치: 유형 기본치에 스탯마다 [lo, hi] 배율을 따로 굴린다 (전력은 그 결과로 계산). 속도는 유형 고정
    tiro:      { hp: [0.80, 0.92], atk: [0.80, 0.92], def: [0.75, 0.92] },   // 어린 티로: 단련이 없으니 약하다
    veteranus: { hp: [0.95, 1.05], atk: [0.95, 1.05], def: [0.95, 1.05] },   // 베테라누스: 기본치 안팎
    age: { from: 20, to: 32, hiBonus: 0.20 },
    agePrice: { from: 24, per: 0.04, min: 0.6 },                              // 값: 24세를 넘기면 해마다 −4% (최저 ×0.6). 남은 현역 기간이 짧다 (고증: 디오클레티아누스 최고가격령도 노예 값을 나이대로 매겼다)                                 // 나이가 들수록 위쪽 폭이 열린다(20세 +0 → 32세 +0.20): 단련을 했을 수도, 안 했을 수도. 대신 31세부터 노쇠라 오래 못 쓴다
    vetGrow: { every: 3, max: 6 },                                           // 베테라누스는 시즌마다 단련된 채로 온다: 3시즌마다 공·방 +1 (최대 +6). 시장·경쟁 파밀리아 공통
  },
  rentTiro: 600,
  rentVeteran: 1500,
  prizePerTier: 1500,
  fightExpense: { rentRate: 0.25, perTier: 150 }, // 출전 경비 = 대여료×rate (장비 정비·식량·의료) + 등급×perTier (이동·호송). 대여료는 고증대로 승패 무관, 경비가 차감된다
  deathCompMultiplier: 10, // (구) 대여료 배수. 이제 미사용
  deathComp: { priceMult: 1.2, perWin: 0 }, // 배상 = 지금 값(valueOf: 능력치·승수) × 1.2 (대체 비용). 승수는 값에 이미 들어 있다
  sellBase: 0.7,   // 매각가 = 지금 값 × 0.7 (키우면 구매가를 넘길 수 있다)
  sellPerWin: 0,   // (구) 승당 가산. 값에 포함되어 미사용
  healCost: 500,
  trainCost: 1200,   // 훈련: 시즌당 1회, 공격 또는 방어 +1
  talentCap: [6, 10, 14, 18] as const, // 자질 = 훈련 상한: 훈련으로 오를 수 있는 공·방 총량 (평범 +6 · 재능 +10 · 비범 +14 · 천부 +18, 독토르·시설 가산 포함). 12시즌 기준이던 무제한 성장은 44시즌 회차에서 기본치의 다섯 배까지 불어 절대 강도의 간판을 무의미하게 만든다. 천부도 4~5년이면 다 크니 한 회차에 두 세대가 자란다 (docs/08 9절)
  rudis: { wins: 5, base: 0.45, perFame: 0.004 }, /* 주최자 보정은 core/hosts.ts */ // 루디스: 승리 시 승수가 wins 이상이면 주최자가 확률적으로 수여
  rudiariusShare: 0.4, // 자유민 검투사의 출전 급료 = 대여료의 40%
  doctorSalary: 800,   // 독토르 시즌 급료 (유지비 대신)
  doctorBonus: { gapSmall: 1, gapBig: 5 }, // 같은 유형 독토르의 해당 능력치가 훈련생보다 gapSmall 이상 높으면 +1, gapBig 이상이면 +2
  ludus: { // 루두스 시설 (장기 지출처). 모든 항목이 유한 단계
    cells: { start: 4, max: 16, per: 2, addCost: (n: number) => 5000 + n * 3000, qualityCost: [3000, 6000, 10000] }, // 칸 증축(n = 증축 횟수) / 칸마다 숙소 질 0~3
    kitchen: { cost: [4000, 8000, 14000], hpPerLevel: 5 },                    // 조리장: 출전 HP +5/단계
    beds: { start: 1, max: 4, cost: [3000, 6000, 10000] },                    // 침상: 동시에 회복 중인 부상자 수. 모자라면 부상 +1시즌
    medicine: { cost: [4000, 6000, 9000, 13000, 18000], injuryAt: 2, cheapAt: 4 }, // 의술: 2단계 부상 1시즌, 4단계 치료비 250
    herbs: { cost: [5000, 9000, 15000], skipFatiguePer: 0.2 },                // 약재: 경기 후 피로 면제 확률 20%/단계
    palus: { start: 2, max: 6, cost: [4000, 6000, 9000, 13000] },             // 팔루스 수 = 시즌당 훈련 인원
    gym: { cost: [3000, 5000, 8000, 12000, 18000], bonusAt: [3, 5] },         // 훈련 시설: 3·5단계에서 훈련 폭 +1
  },
  events: { // 시즌 행사 (전투 밖 명예·호감도 이벤트, 고증: 케나 리베라·폼파·봉헌)
    cena:  { cost: 1500, honor: 2, fame: 1 },   // 공개 만찬: 경기 전날 시민이 검투사를 구경 → 출전 검투사 명예 +2, 호감도 +1
    pompa: { cost: 800,  honor: 1, fame: 1 },   // 행렬: 경기 당일 행진에 참여 → 출전 검투사 명예 +1, 호감도 +1
    votum: { cost: 600,  missio: 0.03 },        // 네메시스 봉헌: 이번 시즌 미시오 +3%
    edicta: { cost: 500, honor: 2 },            // 벽화 광고(에딕타 무네룸): 화공을 사서 거리 벽에 출전 검투사 이름을 그림 → 출전 검투사 명예 +2
    guests: { cost: 1000, honor: 1, fame: 2, gift: 400 }, // 귀족 손님 초대: 연습을 보여주고 연회 → 출전 가능 검투사 명예 +1, 호감도 +2, 사례금 +400
  },
  actions: { // 검투사 개인의 시즌 행동 (출전·휴식·훈련 외)
    show:  { honor: 1 },                          // 시범: 훈련장을 열어 시민 앞에서 연습 (폼페이 루두스는 극장 옆 공개 회랑). 명예 +1
    recover: { extra: 1 },                        // 요양: 부상 회복 +1시즌 가속 (부상자 전용, 무료)
  },
  origins: { // 검투사 확보 경로 (고증: 노예 매매, 전쟁 포로, 형벌 담나티 아드 루둠, 자유민 아욱토라티)
    captive:    { price: 0.65, atk: 2, hp: 10, missio: -0.05 },   // 포로: 싸고 강하지만 관중이 이방인에게 냉담 (미시오 −5%)
    damnatus:   { price: 0.4, stat: -2, comp: 0.5, freeAfter: 12 }, // 죄수: 매우 싸고 약함, 배상 절반, 3년(12시즌) 뒤 자유(루디아리우스)
    auctoratus: { price: 0.8, term: 8, renew: 0.5, base: 0.3, perFame: 0.005, second: 0.25 }, // 자유민 지원자: 시장이 아니라 루두스 문 앞에 찾아온다. 시즌마다 확률 base+호감도×perFame, 그 뒤 second 확률로 한 명 더. 계약금(가격×0.8), 급료, 8시즌 계약, 재계약 = 계약금×0.5
    mix: { captive: 0.3, damnatus: 0.25 },                        // 시장 매물 비율 (나머지는 노예 상인). 자유민은 시장에 서지 않는다
  },
  age: { tiro: [17, 30], veteran: [24, 32], applicant: [24, 34], spdFrom: 31, spdEvery: 3, statFrom: 33, statEvery: 2 }, // 검투사 나이와 노쇠 (비문의 사망 연령은 대부분 20~30대, 30대 중반 넘겨 싸운 예는 드묾)
  lanista: { fixed: { name: '마르쿠스 메소니우스 루크리오', age: 32 }, /* 1회차 주인공 (docs/08 3절): 폼페이 광고의 메소니우스 집안 해방노예. 노예 시절 이름 루크리오(이익)를 코그노멘으로. 32세 고정 → 46세 의무 계승까지 14년 */ ageMin: 32, ageMax: 40, /* 먼 친척(후계자 후보가 없을 때) */ voluntaryAge: 46, mandatoryAge: 46, /* 세니오레스: 46세가 되면 반드시 물려준다 — 압박은 사망이 아니라 은퇴 나이가 맡는다 */ mortality: [[40, 0.01], [45, 0.03], [50, 0.06], [60, 0.09], [999, 0.15]] as [number, number][], inheritanceTax: 0.05 /* 유산세 5% (비케시마 헤레디타티움, 고증) */, fameKeep: 0.6, fameFromHonor: 0.2, freedmanDiscount: 0.1, doctorTrainBonus: 1, skillTrainBonus: 0.10 }, // 고증: 울피아누스 생명표 근사 — 해마다 죽을 확률 (40세 미만 1%, 40대 2.5%, 50대 4.5%, 60대 8%, 70세 이상 14%). 은퇴 나이는 없고 46세(세니오레스)부터 자발 은퇴. 호감도 60% + 후계자 명예×0.2 계승, 해방노예 후계 = 시장 10% 할인, 독토르 후계 = 그 유형 훈련 +1
  honor: { win: 3, perTier: 2, classic: 2, crown: 3, lose: -1, missioPer: 0.004, rentPer: 0.01 }, // 검투사 명예: 미시오 +0.4%/점, 대여료 +1%/점
  doctorSkillWins: 8,  // 승수가 이 이상인 독토르는 같은 유형 제자에게 유형 기술을 전수
  mentor: { comboBonus: 0.04, shieldReduce: 0.6, sicaIgnore: 0.4, bindSec: 1.6, chargeMult: 1.3, critTaken: 0.6, twinBonus: 0.10 }, // 추가 4유형: 호플로마쿠스·에퀘스 돌진 ×1.3, 프로보카토르 치명타 피격 0.6, 디마카에루스 연속 +10% 더
  grudge: { atk: 1.10, missio: -0.15, revengeHonor: 8 }, // 원한: 내가 살려 준 상대는 재대결에서 공격 ×1.1, 그 상대에게 지면 미시오 −15% (우르비쿠스의 경고). 나를 이겼던 상대를 꺾으면 '복수자' 명예 +8
  skills: { expChance: 0.25, trainChance: 0.35, masterBonus: 0.15, gymChance: 0.25, gymLevel: 3, rivalSkillsVet: [1, 2] as [number, number] }, // 기술: 경험으로 깨칠 확률, 독토르 훈련 성공률(+8승 독토르 보너스), 훈련 시설(3단계~) 독학 성공률, 상대 베테라누스 기술 수
  retrainCost: 2000,   // 유형 전환(재훈련): 비용, 그 시즌은 출전 불가 // 기술 전수: 세쿠토르 연속 +4% / 무르밀로 방패 첫 타격 감소 60% / 트라엑스 방어 무시 40% / 레티아리우스 속박 1.6초
  promoteWins: 3,
  teamSize: 3,   // 최대 규모 (계약마다 size 1~3)
  fatigue: { statPenalty: 1, missioPenalty: 0.03, max: 9, overworkAt: 4, overworkPer: 0.12, free: 1, cleanWinHp: 0.7, chanceHard: 0.8, chanceClean: 0.3, perCellStar: 0.15 }, // free: 페널티 없는 피로 점수(첫 1점 무료). 피로가 쌓일 확률: 힘든 경기 80%, 가벼운 경기(쓰러지지 않고 HP 70%↑ 이김) 30%, 숙소 ★마다 −15% // 피로는 계속 쌓인다(최대 9). 4부터 시즌 끝에 과로사 확률 (피로−3)×12% // 누적 피로: 출전 +1(최대 3), 쉬는 시즌 −1. 1당 공·방 −1, 미시오 −3% (−2/−5% 는 승률을 15%p 깎아 완화)
  maxTurns: 30,
  combo: { base: 0.12, perSpd: 0.01 },
  crit: { base: 0.08, perSpd: 0.005, mult: 1.6 }, // 치명타: 확률 = base + 속도×perSpd (× 피격자 투구 보정). 피해 ×1.6, 방패 반감 무시 // 연속 공격 확률 = base + 속도 × perSpd (한 턴 1회)
  startFame: 30,
  fameTierReq: { 1: 0, 2: 25, 3: 60 } as Record<number, number>,
  missio: { tierBonus: { 1: 0.10, 2: 0.05, 3: 0 } as Record<number, number>, classic: 0.05, base: 0.64, perFame: 0.003, perWin: 0.02, maxWins: 5, victorySynergy: 0.1, injuryChance: 0.5, instantDeath: { base: 0.03, crit: 0.08 } }, // instantDeath: 쓰러뜨리는 타격이 그 자리에서 목숨을 앗을 확률 (치명타면 더). 판정과 별개, 승리 측도 해당
  fame: { win: 3, classic: 1, lose: -1, refuse: -1, refuseFrom: 40, decayRate: 0.05 }, // 호감도 = 유지해야 하는 평판 (docs/08 7절, 2026-09-24 재정의): 계약 승리 +3×등급 · 전통 짝 +1 · 패배 −1 (승률 45% 봇 기준 승 +2·패 −2 는 등급 1 평형이 20 아래로 내려가 관중이 패배를 더 오래 기억하는 꼴이었다) · 거절 −1(시즌 1회, 호감도 40부터) · 망각 매 시즌 현재값의 5%(평형점 = 시즌 수입의 20배: 소화하는 계약 등급이 곧 천장) · 졸업전 ±는 challenge · 주최자는 배율(hosts.fameMul) · 행사는 events
} as const;
