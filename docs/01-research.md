# 사전조사: 콜로세움 자동전투 게임

작성일: 2026-09-09

## 1. 한 줄 요약

"검투사 양성소(루두스) 주인이 되어 검투사를 사고 배치해서 콜로세움에서 자동전투로 이기는 게임"은
경쟁작이 거의 없는 빈 자리다. 자동전투 장르의 검증된 공식 위에, 검투사 역사 소재가
유닛 종류·상성·군중·생사 판정까지 거의 그대로 게임 시스템으로 옮겨진다.

## 2. 기존 게임 조사

### 2-1. 직접 경쟁작 (검투사 x 자동전투)

| 게임 | 플랫폼 | 형태 | 참고할 점 | 빈 틈 |
|---|---|---|---|---|
| [GLADIMAKER](https://store.steampowered.com/app/4310900) (2026, 한국 팀) | Steam | 1인칭 자동전투 RPG, 검투사 1명 육성 | 국내 팀이 같은 소재로 100% 긍정 평가. 소재 자체는 먹힌다는 증거 | 팀 빌딩·시너지가 아님 |
| [Gladiator Guild Manager](https://store.steampowered.com/app/1043260) | Steam | 검투사 고용 + 배치 + 자동전투, 월간 챔피언십 | 80% 긍정(1,600여 리뷰). "고용→배치→자동전투→수익" 루프가 통한다 | 판타지 클래스(마법사, 야수). 로마 검투사 고증은 없음. 라운드제 상점·리롤 경제 없음 |
| [Glory of the Colosseum](https://milopanta.itch.io/glory-of-the-colosseum) | 웹(itch) | 게임잼 출품작, 2버튼 | 웹 자동전투 검투사물이 존재는 함 | 완성도 낮음 (2.5/5) |
| Domina | Steam(판매 중단) | 루두스 경영 + 실시간 전투 | 픽셀아트·분위기·잔혹함으로 호평. "검투사 경영"에 팬층 있음 | 밸런스 문제 지적. 현재 구매 불가 |

결론: **"로마 검투사 고증 + TFT식 상점·시너지 자동전투"** 조합은 아직 없다.

### 2-2. 장르 레퍼런스 (자동전투)

| 게임 | 배울 것 |
|---|---|
| TFT / 오토체스 | 경제 핵심 공식: 골드 이자, 레벨업(유닛 수↑) vs 리롤(희귀 유닛 찾기) 긴장. 시너지(종족/직업) 2중 태그 |
| [Super Auto Pets](https://en.wikipedia.org/wiki/Super_Auto_Pets) | 싱글 플레이 자동전투의 정답. 타이머 없음, 10승이 목표, 상대는 다른 플레이어의 저장된 팀(비동기). 1인 개발 규모 |
| Backpack Battles | 배치 자체가 퍼즐. 유닛 대신 아이템 인접 시너지 |
| The Bazaar | 캐릭터별 완전히 다른 아이템 풀. 연출·세계관으로 차별화 |

핵심 루프(공통): **상점 단계(구매·배치·경제) → 전투 단계(자동) → 반복, 체력 0이면 패배**

## 3. 검투사 역사 소재 → 게임 시스템 매핑

### 3-1. 검투사 유형 (유닛 로스터 후보)

| 유형 | 장비 | 스타일 | 역사적 상성 | 게임 역할 초안 |
|---|---|---|---|---|
| **무르밀로** (Murmillo) | 글라디우스, 큰 직사각 방패, 무거운 투구 | 느리고 단단한 전진 | vs 트라엑스, 호플로마쿠스 | 탱커. 전열 |
| **트라엑스** (Thraex) | 시카(곡도), 작은 방패, 양 다리 정강이받이 | 방패 너머로 찍는 공격 | vs 무르밀로 | 방어 관통 딜러 |
| **레티아리우스** (Retiarius) | 그물, 삼지창, 단검. 투구 없음 | 회피·거리 유지 | vs 세쿠토르 | 원거리·군중제어(그물 = 속박) |
| **세쿠토르** (Secutor) | 글라디우스, 큰 방패, 매끈한 투구 | 끈질긴 추격 | vs 레티아리우스 (전용 카운터) | 돌진형. 원거리 유닛에게 특효 |
| **호플로마쿠스** (Hoplomachus) | 긴 창, 작은 원형 방패 | 거리 두고 찌르기 | vs 무르밀로, 트라엑스 | 사거리 2칸 딜러 |
| **프로보카토르** (Provocator) | 검, 큰 방패, 흉갑 | 같은 유형끼리만 대결 | 미러전 | 균형형. "같은 유형 인접 시 강화" 시너지 |
| **스키소르** (Scissor) | 팔뚝에 끼우는 반달 칼날 | 그물 절단, 삼지창 튕겨냄 | vs 레티아리우스 | 군중제어 해제·면역 |
| **에퀘스** (Eques) | 기마 → 하마 후 검 | 화려, 개막전 담당 | vs 에퀘스 | 첫 턴 돌진 후 보병화. 선공 유닛 |

역사적으로 **"무거운 방패 vs 가벼운 기동"** 대비가 매치업의 기본이다. 이걸 그대로 상성 삼각형으로 쓸 수 있다.

### 3-2. 로마 검투사 문화 → 시스템

| 역사 용어 | 뜻 | 게임 시스템 후보 |
|---|---|---|
| **라니스타** (Lanista) | 검투사 양성소 주인·조련사 | 플레이어 역할 |
| **루두스** (Ludus) | 검투사 양성소 | 플레이어의 팀·본진 |
| **파밀리아** (Familia gladiatorium) | 한 주인 아래 검투사 무리 | 팀. 시너지 그룹 이름으로 사용 가능 |
| **티로 → 베테라누스** | 첫 출전 → 경험자 | 유닛 성장(별 1→3 대신 티로/베테라누스/프리무스) |
| **루디스** (Rudis) | 자유를 상징하는 나무검 | 만렙 보상 or 유닛 "은퇴"시켜 영구 버프로 환원 |
| **미시오** (Missio) | 패자 살려주기. 군중 반응이 좌우 | **패배해도 유닛 손실 없음의 근거.** 군중 호감도가 낮으면 유닛 영구 손실 위험 |
| **폴리케 베르소** (Pollice verso) | 군중의 "죽여라" 신호 | 위와 연동 |
| **시네 미시오네** (Sine missione) | 자비 없는 죽음의 대결 | 고위험·고보상 특수 라운드 |
| **스탄테스 미시** (Stantes missi) | 무승부, 둘 다 생존 | 시간 초과 무승부 룰의 근거 |
| **에디토르** (Editor) | 경기 주최자(황제·귀족) | 라운드 규칙 변경자 = "이번 경기 주최자의 취향" 랜덤 이벤트 |
| **폼파** (Pompa) | 개막 행진 | 라운드 시작 연출 |
| **베나티오** (Venatio) | 맹수 사냥 쇼 | 보스 라운드 = 사자·곰·코끼리 |
| 경제 현실 | 검투사는 비싼 자산. 죽으면 주최자가 배상 | 유닛 = 자산이라는 감각. 팔면 환불 |

### 3-3. 이 소재의 강점

- 유닛 상성이 **역사에서 이미 검증된 디자인**이다. 만들어내는 게 아니라 옮기면 된다.
- "군중 호감도"라는 자동전투 장르에 없는 **제3의 자원**이 자연스럽게 나온다.
- 아트가 정해져 있다: 모래, 흙먼지, 청동, 붉은 천. 색깔 네모로 시작해도 톤을 잡기 쉽다.
- GLADIMAKER 사례로 한국 시장에서 소재 자체는 통한다는 게 확인됐다.

### 3-4. 단체전은 역사에 있었나

- 기본은 1:1 결투. 그러나 **카테르바리이(Catervarii) / 그레가팀(Gregatim)** 이라는 단체 난전 형식이 실제로 존재했다. 주최자·특별 관객의 요청으로 열렸고 관객이 좋아했지만 드물었다.
- 무기 혼합은 오히려 기본 원칙이었다. 다른 장비끼리 붙이는 것이 경기의 핵심 재미였으므로 단체전은 자연히 다양한 무기가 섞였다.
- 대규모 전투 재현(카이사르: 보병 500·기병 30·코끼리 20), 나우마키아(모의 해전)처럼 "전쟁 쇼"도 있었다.
- 게임 적용: 기본 라운드 = 카테르바리이(소규모 단체전), 특별 라운드 = 1:1 전통 결투, 보스 라운드 = 베나티오(맹수)·대규모 전투 재현.

## 4. 열린 질문 (컨셉 단계에서 정할 것)

1. **싱글 vs 비동기 멀티**: Super Auto Pets 방식(상대 = 저장된 다른 팀)이 1인 개발에 가장 현실적. 처음엔 미리 짜둔 적 조합으로 시작.
2. **군중 호감도**를 핵심 자원으로 둘지, 양념으로 둘지. 핵심으로 두면 "이기는 방법"과 "멋있게 이기는 방법"이 갈려서 독창적이지만 밸런스 난이도가 오른다.
3. **판타지 요소 허용 범위**: 순수 고증(8종 검투사 + 맹수)만 갈지, 신화(미노타우로스, 신의 가호)까지 갈지. 고증만으로는 유닛 수가 적어서 장기적으로 변형(지역: 트라키아·갈리아·누미디아 출신 = 종족 태그)이 필요.
4. **유닛 손실 여부**: 미시오 시스템을 살리면 유닛이 죽을 수 있다. 로그라이크 긴장감 vs 좌절감.
5. **전투 형태**: 격자(TFT식 위치 전략) vs 일렬(Super Auto Pets식 순서 전략). 일렬이 훨씬 단순하고 검투사 1:1 대결 느낌과도 어울린다.

## 출처

- [GLADIMAKER 출시 기사 (Inven Global)](https://www.invenglobal.com/articles/21124/first-person-auto-battler-rpg-gladimaker-launches-on-steam-and-stove-on-april-30)
- [Gladiator Guild Manager (Steam)](https://store.steampowered.com/app/1043260/Gladiator_Guild_Manager/)
- [Glory of the Colosseum (itch.io)](https://milopanta.itch.io/glory-of-the-colosseum)
- [Domina (Wikipedia)](https://en.wikipedia.org/wiki/Domina_(video_game))
- [Auto battler (Wikipedia)](https://en.wikipedia.org/wiki/Auto_battler)
- [Super Auto Pets (Wikipedia)](https://en.wikipedia.org/wiki/Super_Auto_Pets)
- [Super Auto Pets 리뷰 (Engadget)](https://www.engadget.com/super-auto-pets-auto-battler-game-143026957.html)
- [Backpack Battles vs The Bazaar (Steam 토론)](https://steamcommunity.com/app/1617400/discussions/0/592905417807427959/)
- [Roman Gladiator Types: A Complete Guide (Through Eternity)](https://www.througheternity.com/rome/roman-gladiator-types-a-complete-guide)
- [Gladiators: The Language of the Arena (Archaeology Magazine)](https://archive.archaeology.org/gladiators/glossary.html)
- [The Gladiator Myth: 경제 논리 (Substack)](https://tenebrarum.substack.com/p/economic-logic-roman-gladiators-myth)
- [Gladiator (Livius)](https://www.livius.org/articles/concept/gladiator/)
- [Gladiator Contests: Rules, Events (Facts and Details)](https://factsanddetails.com/world/cat56/sub399/item2061.html)
- [Arena: Gladiatorial Games (VRoma)](http://www.vroma.org/vromans/bmcmanus/arena.html)
