// 딕타타(dictata): 팔루스에서 독토르가 가르치는 규정 동작 (세네카·키케로). 2026-09-18 docs/09 — 기술 열 개를 대신한다.
// 기본 딕타타는 세 겹: 주장비 하나 · 보조장비 하나 · 유형 하나. 유형이면 곧 아는 것이라 배우지 않고 카드에도 내놓지 않는다 — 도움말과 전투 연출로만.
// (숙련 딕타타 — 행동 누적 문턱을 넘고 같은 클래스 독토르가 있으면 익히는 것 — 는 다음 단계. 여기 정의는 기본 16 이다)
import type { GType } from './types.js';
import { CONFIG } from './config.js';
import { classOf, type MainTrait, type OffTrait } from './classes.js';

export type DictataId = 'thrust' | 'sica_over' | 'poke' | 'shove' | 'deflect' | 'slip'
  | 'shield_up' | 'pursue' | 'chest' | 'feint' | 'spear_wall' | 'dismount' | 'net' | 'twin' | 'arm_riposte' | 'lasso';
export interface DictataDef { id: DictataId; name: string; layer: 'main' | 'off' | 'type'; owner: MainTrait | OffTrait | GType; desc: string; note: string; once?: boolean }
const D = CONFIG.dictata;
export const DICTATA: DictataDef[] = [
  // 주장비
  { id: 'thrust', name: '찌르기', layer: 'main', owner: 'gladius', desc: `공격 때 ${Math.round(D.thrust.p * 100)}% 로 상대 방어의 절반만 친다`, note: '베게티우스: 베지 말고 찔러라' },
  { id: 'sica_over', name: '방패 뒤 찍기', layer: 'main', owner: 'sica', desc: `막혔을 때 ${Math.round(D.sicaOver.p * 100)}% 로 막힌 피해의 ${Math.round(D.sicaOver.share * 100)}% 를 방어 무시로 더 준다`, note: '시카의 굽은 날은 방패 너머로 넘어간다' },
  { id: 'poke', name: '길목 찌르기', layer: 'main', owner: 'spear', desc: `상대가 사거리 안으로 드는 순간 창끝이 먼저 닿는다 (공 ×${D.poke.mult}, 같은 상대엔 ${D.poke.gap}초에 한 번)`, note: '창의 사거리' },
  // 보조장비
  { id: 'shove', name: '방패 밀기', layer: 'off', owner: 'bigShield', desc: `붙어서 공격을 기다리는 동안 방패로 밀어 상대 숨을 ${D.shove.stamina} 깎는다`, note: '스쿠툼 밀어치기 — 군단 전술' },
  { id: 'deflect', name: '흘리기', layer: 'off', owner: 'smallShield', desc: `맞는 순간 ${Math.round(D.deflect.p * 100)}% 로 피해 절반, 옆으로 한 걸음`, note: '가벼운 방패는 받아 흘린다' },
  { id: 'slip', name: '빠지기', layer: 'off', owner: 'bare', desc: `맞은 직후 ${Math.round(D.slip.p * 100)}% 로 즉시 이탈해 상대 다음 공격을 ${D.slip.delay}초 늦춘다`, note: '무장이 가벼워 물러난다' },
  // 유형
  { id: 'shield_up', name: '방패 세우기', layer: 'type', owner: 'murmillo', desc: `HP ${Math.round(D.shieldUp.at * 100)}% 아래로 처음 떨어지면 ${D.shieldUp.sec}초 동안 막기 ×${D.shieldUp.mul}`, note: '신중한 무르밀로 (창작)', once: true },
  { id: 'pursue', name: '추격', layer: 'type', owner: 'secutor', desc: `창 든 상대나 묶인 상대에게 돌진하면 피해 ×${D.pursue.ranged}, 묶인 상대엔 ×${D.pursue.bound}`, note: '세쿠토르 = 쫓는 자. 레티아리우스 전용 상대' },
  { id: 'chest', name: '가슴판', layer: 'type', owner: 'provocator', desc: `치명타를 ${Math.round(D.chest.p * 100)}% 로 보통 타격으로 튕겨 낸다`, note: '카르디오필락스(가슴판)' },
  { id: 'feint', name: '허초', layer: 'type', owner: 'thraex', desc: `공격 때 ${Math.round(D.feint.p * 100)}% 로 들어가는 척 빠졌다 찌른다 — 그 타격은 방어를 무시한다`, note: '지그재그 트라엑스 (창작)' },
  { id: 'spear_wall', name: '창 벽', layer: 'type', owner: 'hoplomachus', desc: `붙은 근접 상대가 치려는 순간 ${Math.round(D.spearWall.p * 100)}% 로 창으로 밀어 그 공격을 무산시키고 찌른다 (공 ×${D.spearWall.poke})`, note: '창과 단검의 이중 무장' },
  { id: 'dismount', name: '기마 찌르기', layer: 'type', owner: 'eques', desc: `말을 타고 들어와 첫 돌진을 말 위에서 찌른다 — 반드시 적중, 피해 ×${D.dismount.mult}. 부딪힌 뒤 내려서 싸운다`, note: '기마 후 하마 — 고증', once: true },
  { id: 'net', name: '그물', layer: 'type', owner: 'retiarius', desc: `첫 공격에 그물을 던진다. 성공 ${Math.round(D.net.base * 100)}% − 상대 속도×${Math.round(D.net.perSpd * 100)}%, 걸리면 ${D.net.sec}초 묶인다. 빗나가면 그물을 잃는다`, note: '고증', once: true },
  { id: 'twin', name: '이중베기', layer: 'type', owner: 'dimachaerus', desc: `연속 공격 확률 +${Math.round(D.twin.combo * 100)}%p`, note: '두 자루' },
  { id: 'arm_riposte', name: '팔 칼날 되치기', layer: 'type', owner: 'scissor', desc: `맞은 직후 ${Math.round(D.armRiposte.p * 100)}% 로 반달 날로 되친다 (공 ×${D.armRiposte.mult})`, note: '아르벨라스의 팔 칼날' },
  { id: 'lasso', name: '올가미', layer: 'type', owner: 'laquearius', desc: `공격 때 ${Math.round(D.lasso.p * 100)}% 로 올가미를 던져 ${D.lasso.sec}초 묶는다 (${D.lasso.gap}초 간격). 빗나가도 잃지 않는다`, note: '이시도루스' },
];
export const DICTATA_BY_ID: Record<DictataId, DictataDef> = Object.fromEntries(DICTATA.map(d => [d.id, d])) as Record<DictataId, DictataDef>;
// 유형이 처음부터 아는 셋: 주장비 · 보조장비 · 유형 (유형 것이 아직 없는 유형은 둘)
export function basicDictataOf(type: GType): DictataDef[] {
  const c = classOf(type);
  return DICTATA.filter(d => (d.layer === 'main' && d.owner === c.main) || (d.layer === 'off' && d.owner === c.off) || (d.layer === 'type' && d.owner === type));
}
export const hasDictata = (type: GType, id: DictataId) => basicDictataOf(type).some(d => d.id === id);
export const DICTATA_NAME = (id: string): string => DICTATA_BY_ID[id as DictataId]?.name ?? MASTERY_NAME(id);
const MASTERY_NAME = (id: string): string => { const m = MASTERY_BY_ID[id]; if (m) return m.name; const alias: Record<string, string> = { poke_follow: '되찌르기', shove_follow: '밀고 찌르기', spear_throw: '창 던지기', bare_back: '되돌아 치기', small_riposte: '옆걸음 되치기', block_strike: '되치기', follow: '연계', riposte_follow: '반달 날 두 번', sweep: '휩쓸기', stumble: '헛디딤' }; return alias[id] ?? id; };

// ── 숙련 딕타타 (docs/09 2-α, 2026-09-21): 행동 누적 문턱을 넘고 같은 클래스 독토르가 있으면 익힌다. 자리 셋, 먼저 넘은 순서, 한 번 익히면 안 바뀐다.
// 후보는 네 층(주장비·보조장비·클래스·유형)에 셋씩 — 층 안의 순서가 곧 문턱 등급이고 층마다 엇갈린다(주장비 4·12·20 · 유형 7·13·21 · 보조 10·15·22 · 클래스 12·18·24 경기어치, 2026-09-21 `_rate` 측정의 경기당 누적치 × 경기 수). 효과는 아래 원시 손잡이의 조합으로 battle.ts 가 읽는다
export interface AfterHit { p: number; mult: number; when: 'always' | 'feint' | 'charge' | 'bound' | 'shove' | 'poke' | 'riposte' | 'deflect' | 'blocked' }
export interface Dodge { p: number; only?: 'crit' | 'charge' }
export interface MasteryEffect {
  pMul?: [DictataId, number];            // 기본 딕타타 확률 ×
  onBlockTrip?: { p: number; sec: number };   // 막은 직후 상대를 넘어뜨린다
  onBlockStrike?: { p: number; mult: number }; // 막은 직후 곧바로 친다
  afterHit?: AfterHit; // 어떤 동작 뒤 한 번 더 (blocked = 내 공격이 막힌 직후)
  shieldWall?: { at: number; sec: number };    // HP 비율 아래 첫 진입에 잠시 모든 타격을 막는다
  noTrip?: true;                               // 넘어지지 않는다 (밀기·걷어차기·헛디딤 넘어짐 무효)
  finishMul?: number;                          // HP 20% 아래 상대에 피해 ×
  critMul?: number;                            // 치명타 배율 ×
  legOnHit?: { p: number; sec: number; slow: number }; // 맞힌 뒤 다리를 베어 느리게
  pokeGapMul?: number;                         // 길목 찌르기 간격 ×
  stumbleOnHit?: { p: number; sec: number };   // 맞힌 뒤 상대 헛디딤(빈틈)
  dodge?: Dodge; // 맞는 순간 완전히 피한다
  secondWind?: true;                           // 경기 한 번, HP 25% 아래에서 심판이 멈춘다
  sweep?: number;                              // 붙은 적 둘을 함께 벤다 (둘째 ×)
  recharge?: true;                             // 상대가 넘어지거나 묶이면 돌진을 다시 장전
  shortCharge?: true;                          // 두 걸음 거리에서도 돌진
  netRecover?: true;                           // 빗나간 그물을 거둬 한 번 더
  farNet?: true;                               // 그물을 거리에서 던진다 (성공 −.1)
  boundCut?: number;                           // 묶이는 시간 ×
  lassoSecMul?: number;                        // 올가미 묶는 시간 ×
  lassoTrip?: number;                          // 올가미가 풀릴 때 넘어짐 확률
  lassoPull?: true;                            // 묶인 상대를 끌어당긴다
  staminaIgnore?: number;                      // 지친 상태를 무시하는 초 (한 번)
  comboTwice?: true;                           // 연속이 두 번까지
  shieldUpTwice?: true;                        // 방패 세우기가 두 번
  parry?: number;                              // 맞는 순간 피해 절반 (맨몸의 막기 대신)
  chaseHit?: number;                           // 이탈하는 상대를 따라가 한 타 (p)
  retreatMul?: number;                         // 이탈 속도 ×
  firstStrike?: true;                          // 같은 틱에 서로 휘두르면 먼저 친다 (행동 순서 +)
  allyGuard?: number;                          // 곁의 아군이 맞을 때 끼어들어 막을 확률
  throwOnce?: number;                          // 경기 한 번, 멀리서 창을 던진다 (공 ×)
  mountedRange?: true;                         // 말 위 돌진이 사거리 2 에서 시작
}
export type MasteryLayer = 'main' | 'off' | 'class' | 'type' | 'legend'; // legend: 전설 검투사의 고유 딕타타 (owner = 전설 id, 배우지 않고 타고난다, 자리 안 차지함)
export interface MasteryDef { id: string; name: string; layer: MasteryLayer; owner: string; cond: { key: string; n: number; ko: string }; ko: string; eff: MasteryEffect }
const M = (id: string, name: string, layer: MasteryLayer, owner: string, key: string, n: number, condKo: string, ko: string, eff: MasteryEffect): MasteryDef => ({ id, name, layer, owner, cond: { key, n, ko: condKo }, ko, eff });
export const MASTERY: MasteryDef[] = [
  // 주장비
  M('thrust_vital', '급소 찌르기', 'main', 'gladius', 'd:thrust', 6, '찌르기 6', '맞힌 뒤 25% 로 상대 0.5초 경직', { stumbleOnHit: { p: 0.25, sec: 0.5 } }),
  M('thrust_finish', '마무리 찌르기', 'main', 'gladius', 'kills', 4, '처치 4', 'HP 20% 아래 상대에 ×1.5', { finishMul: 1.5 }),
  M('thrust_under', '방패 아래 찌르기', 'main', 'gladius', 'blockedOn', 28, '막힘 28', '막힌 직후 방패 아래로 찔러 절반 피해', { afterHit: { p: 0.5, mult: 0.5, when: 'blocked' } }),
  M('sica_spin', '회전 베기', 'main', 'sica', 'combos', 4, '연속 4', '붙은 적 둘을 함께 벤다', { sweep: 0.6 }),
  M('sica_low', '낮게 베기', 'main', 'sica', 'd:sica_over', 8, '방패 뒤 찍기 8', '다리를 베어 3초 느리게', { legOnHit: { p: 0.25, sec: 3, slow: 0.35 } }),
  M('sica_down', '찍어 내리기', 'main', 'sica', 'crits', 10, '치명타 10', '치명타 ×1.5', { critMul: 1.5 }),
  M('spear_twice', '두 번 찌르기', 'main', 'spear', 'd:poke', 7, '길목 찌르기 7', '같은 상대 간격 절반', { pokeGapMul: 0.5 }),
  M('spear_butt', '창 돌려 치기', 'main', 'spear', 'd:poke', 19, '길목 찌르기 19', '자루로 후려 헛디디게', { stumbleOnHit: { p: 0.2, sec: 0.8 } }),
  M('spear_throw', '창 던지기', 'main', 'spear', 'rangedDmg', 600, '사거리 밖 피해 600', '경기 한 번, 멀리서 던져 맞힌다', { throwOnce: 1.2 }),
  // 보조장비
  M('big_kick', '방패 걷어차기', 'off', 'bigShield', 'blocks', 18, '막음 18', '막은 직후 차 넘어뜨린다', { onBlockTrip: { p: 0.25, sec: 0.8 } }),
  M('big_ram', '몸통 박치기', 'off', 'bigShield', 'd:shove', 10, '방패 밀기 10', '맞힌 뒤 35% 로 상대 헛디딤', { stumbleOnHit: { p: 0.35, sec: 0.6 } }),
  M('big_wall', '방패 벽', 'off', 'bigShield', 'dmgTaken', 1230, '받은 피해 1,230', 'HP 30% 아래 3초 전부 막음 (한 번)', { shieldWall: { at: 0.3, sec: 3 } }),
  M('small_riposte', '옆걸음 되치기', 'off', 'smallShield', 'd:deflect', 4, '흘리기 4', '흘린 직후 반격', { afterHit: { p: 0.6, mult: 1.0, when: 'deflect' } }),
  M('small_edge', '모서리 치기', 'off', 'smallShield', 'blocks', 27, '막음 27', '막은 직후 0.5초 경직', { onBlockTrip: { p: 0.3, sec: 0.5 } }),
  M('small_roll', '구르기', 'off', 'smallShield', 'chargedOn', 16, '돌진당함 16', '돌진을 굴러 피한다', { dodge: { p: 0.5, only: 'charge' } }),
  M('bare_back', '되돌아 치기', 'off', 'bare', 'd:slip', 11, '빠지기 11', '빠진 직후 빈틈 강타', { afterHit: { p: 0.5, mult: 1.2, when: 'deflect' } }),
  M('bare_wind', '숨고르기', 'off', 'bare', 'dmgTaken', 840, '받은 피해 840', '경기 한 번, HP 25% 아래에서 심판이 멈춘다', { secondWind: true }),
  M('bare_sway', '몸 젖히기', 'off', 'bare', 'dmgTaken', 1230, '받은 피해 1,230', '맞는 순간 10% 로 완전히 피한다', { dodge: { p: 0.1 } }),
  // 클래스
  M('c_bg_pushstab', '밀고 찌르기', 'class', 'bigShield+gladius', 'd:shove', 8, '방패 밀기 8', '밀친 직후 찌르기', { afterHit: { p: 0.5, mult: 0.8, when: 'shove' } }),
  M('c_bg_down', '방패 위 내려치기', 'class', 'bigShield+gladius', 'blocks', 33, '막음 33', '막은 직후 방패 위로 내려친다', { onBlockStrike: { p: 0.3, mult: 0.9 } }),
  M('c_bg_shoulder', '어깨 걸기', 'class', 'bigShield+gladius', 'nearAllySec', 39, '아군 곁 200초 39', '곁의 아군이 맞을 때 끼어들어 막는다', { allyGuard: 0.3 }),
  M('c_ss_feintcut', '허초 뒤 찍기', 'class', 'smallShield+sica', 'd:feint', 17, '허초 17', '허초가 통하면 곧바로 찍는다', { afterHit: { p: 0.6, mult: 0.8, when: 'feint' } }),
  M('c_ss_pushcut', '밀치고 베기', 'class', 'smallShield+sica', 'blocks', 33, '막음 33', '작은 방패로 밀치고 벤다', { onBlockStrike: { p: 0.3, mult: 0.8 } }),
  M('c_ss_behind', '뒤로 돌기', 'class', 'smallShield+sica', 'combos', 24, '연속 24', '지그재그 끝에 등 뒤로 (빈틈)', { stumbleOnHit: { p: 0.15, sec: 0.6 } }),
  M('c_sp_restab', '되찌르기', 'class', 'smallShield+spear', 'd:spear_wall', 5, '창 벽 5', '창 벽 뒤 곧바로 찌른다', { afterHit: { p: 0.6, mult: 0.7, when: 'poke' } }),
  M('c_sp_standstab', '세우고 찌르기', 'class', 'smallShield+spear', 'blocks', 33, '막음 33', '막은 직후 찌른다', { onBlockStrike: { p: 0.3, mult: 0.8 } }),
  M('c_sp_backstab', '물러서며 찌르기', 'class', 'smallShield+spear', 'dmgTaken', 1340, '받은 피해 1,340', '이탈하며 찌른다', { afterHit: { p: 0.3, mult: 0.6, when: 'always' } }),
  M('c_sg_chargecut', '돌진 후 베기', 'class', 'smallShield+gladius', 'charges', 9, '돌진 9', '돌진 적중 뒤 한 번 더', { afterHit: { p: 0.6, mult: 0.8, when: 'charge' } }),
  M('c_sg_leap', '뛰어넘기', 'class', 'smallShield+gladius', 'charges', 13, '돌진 13', '지나쳐 등 뒤 빈틈을 친다', { stumbleOnHit: { p: 0.3, sec: 0.6 } }),
  M('c_sg_recharge', '재돌격', 'class', 'smallShield+gladius', 'charges', 17, '돌진 17', '넘어지거나 묶인 상대에 다시 돌진', { recharge: true }),
  M('c_bs_twostep', '두 번 물러서기', 'class', 'bare+spear', 'd:slip', 14, '빠지기 14', '물러서며 두 번 찌른다', { afterHit: { p: 0.5, mult: 0.6, when: 'poke' } }),
  M('c_bs_flee', '달아나기', 'class', 'bare+spear', 'dmgTaken', 1010, '받은 피해 1,010', '이탈 속도 ×1.5', { retreatMul: 1.5 }),
  M('c_bs_hook', '삼지창 걸기', 'class', 'bare+spear', 'd:poke', 38, '찌르기 적중 38', '상대 무기를 걸어 0.5초 경직', { stumbleOnHit: { p: 0.2, sec: 0.5 } }),
  M('c_bc_triple', '세 번 베기', 'class', 'bare+sica', 'combos', 12, '연속 12', '연속이 두 번까지', { comboTwice: true }),
  M('c_bc_twin', '양날', 'class', 'bare+sica', 'flanked', 5, '붙은 적 둘 50초 5', '둘을 함께 벤다', { sweep: 0.6 }),
  M('c_bc_duck', '몸 낮추기', 'class', 'bare+sica', 'critsTaken', 12, '치명타 피격 12', '치명타를 확률로 피한다', { dodge: { p: 0.4, only: 'crit' } }),
  M('c_bgl_riposte', '되치기', 'class', 'bare+gladius', 'd:arm_riposte', 8, '팔 칼날 되치기 8', '되친 직후 한 번 더', { afterHit: { p: 0.5, mult: 0.8, when: 'riposte' } }),
  M('c_bgl_shove', '팔 칼날 밀치기', 'class', 'bare+gladius', 'charges', 13, '돌진 13', '관으로 밀어 넘어뜨린다', { stumbleOnHit: { p: 0.25, sec: 0.8 } }),
  M('c_bgl_hook', '낫 걸기', 'class', 'bare+gladius', 'blockedOn', 34, '막힘 34', '반달 날로 상대 방패를 걸어 내린다 (막히면 곧 찌른다)', { afterHit: { p: 0.5, mult: 0.6, when: 'blocked' } }),
  // 유형
  M('t_mur_twice', '두 번 세우기', 'type', 'murmillo', 'd:shield_up', 4, '방패 세우기 4', '방패 세우기가 두 번', { shieldUpTwice: true }),
  M('t_mur_stand', '굳건히 서기', 'type', 'murmillo', 'boundTimes', 3, '넘어짐 3', '넘어지지 않는다', { noTrip: true }),
  M('t_mur_head', '물고기 박치기', 'type', 'murmillo', 'blocks', 38, '막음 38', '볏 투구로 받아 헛디디게', { stumbleOnHit: { p: 0.2, sec: 0.6 } }),
  M('t_sec_chase', '끝까지 쫓기', 'type', 'secutor', 'charges', 5, '돌진 5', '이탈하는 상대를 따라가 한 타 더', { chaseHit: 0.4 }),
  M('t_sec_head', '투구 박치기', 'type', 'secutor', 'd:pursue', 3, '추격 3', '머리로 받아 헛디디게', { stumbleOnHit: { p: 0.25, sec: 0.6 } }),
  M('t_sec_breath', '숨 참기', 'type', 'secutor', 'critsTaken', 11, '치명타 피격 11', '지친 상태를 3초 무시 (한 번)', { staminaIgnore: 3 }),
  M('t_pro_ram', '가슴판 박치기', 'type', 'provocator', 'd:chest', 4, '가슴판 4', '부딪혀 상대를 경직시킨다', { stumbleOnHit: { p: 0.25, sec: 0.5 } }),
  M('t_pro_first', '맞불', 'type', 'provocator', 'blocks', 24, '막음 24', '같은 순간엔 먼저 친다', { firstStrike: true }),
  M('t_pro_short', '짧은 돌진', 'type', 'provocator', 'charges', 15, '돌진 15', '두 걸음 거리에서도 돌진', { shortCharge: true }),
  M('t_thr_double', '허초 연타', 'type', 'thraex', 'd:feint', 10, '허초 10', '허초 뒤 곧바로 한 번 더', { afterHit: { p: 0.5, mult: 0.9, when: 'feint' } }),
  M('t_thr_griffin', '그리핀 돌진', 'type', 'thraex', 'combos', 13, '연속 13', '지그재그 끝에 돌진', { shortCharge: true }),
  M('t_thr_turn', '뒤돌아 베기', 'type', 'thraex', 'critsTaken', 11, '치명타 피격 11', '등 뒤로 돌아 벤다 (빈틈)', { stumbleOnHit: { p: 0.2, sec: 0.6 } }),
  M('t_hop_dagger', '단검 찌르기', 'type', 'hoplomachus', 'd:spear_wall', 3, '창 벽 3', '품 안의 상대를 단검으로', { afterHit: { p: 0.5, mult: 0.7, when: 'always' } }),
  M('t_hop_stand', '세우고 찌르기', 'type', 'hoplomachus', 'blocks', 24, '막음 24', '막은 직후 찌른다', { onBlockStrike: { p: 0.3, mult: 0.8 } }),
  M('t_hop_wall', '밀집 창', 'type', 'hoplomachus', 'nearAllySec', 34, '아군 곁 200초 34', '아군을 노리는 적을 창으로 밀어낸다', { allyGuard: 0.3 }),
  M('t_eq_recharge', '재돌격', 'type', 'eques', 'charges', 5, '돌진 5', '넘어지거나 묶인 상대에 다시 돌진', { recharge: true }),
  M('t_eq_leap', '뛰어넘기', 'type', 'eques', 'd:dismount', 8, '말 위 돌진 8', '등 뒤 빈틈을 친다', { stumbleOnHit: { p: 0.3, sec: 0.6 } }),
  M('t_eq_lance', '말 위 찌르기', 'type', 'eques', 'd:dismount', 13, '첫 돌진 적중 13', '말 위 돌진이 사거리 2 에서 시작', { mountedRange: true }),
  M('t_ret_recover', '그물 회수', 'type', 'retiarius', 'misses', 3, '그물 빗나감 3', '빗나간 그물을 거둬 한 번 더', { netRecover: true }),
  M('t_ret_double', '삼지창 두 번', 'type', 'retiarius', 'd:net', 9, '그물 9', '묶인 상대를 연속으로', { afterHit: { p: 0.7, mult: 0.8, when: 'bound' } }),
  M('t_ret_far', '물러서며 던지기', 'type', 'retiarius', 'dmgTaken', 1180, '받은 피해 1,180', '거리에서 그물을 던진다 (성공 −.1)', { farNet: true }),
  M('t_dim_triple', '세 번 베기', 'type', 'dimachaerus', 'combos', 7, '연속 7', '연속이 두 번까지', { comboTwice: true }),
  M('t_dim_parry', '양손 막기', 'type', 'dimachaerus', 'dmgTaken', 730, '받은 피해 730', '두 자루로 받아넘긴다 (15%)', { parry: 0.15 }),
  M('t_dim_spin', '회전 베기', 'type', 'dimachaerus', 'flanked', 6, '붙은 적 둘 50초 6', '둘을 함께 벤다', { sweep: 0.6 }),
  M('t_sci_cutnet', '그물 자르기', 'type', 'scissor', 'boundTimes', 2, '묶임 2', '묶임을 절반에 끊는다', { boundCut: 0.5 }),
  M('t_sci_double', '반달 날 두 번', 'type', 'scissor', 'd:arm_riposte', 9, '되치기 9', '되치기가 두 번', { afterHit: { p: 0.6, mult: 1.0, when: 'riposte' } }),
  M('t_sci_guard', '관 방패', 'type', 'scissor', 'blockedOn', 30, '막힘 30', '팔 관으로 막는다 (20%)', { parry: 0.2 }),
  M('t_laq_pull', '끌어당기기', 'type', 'laquearius', 'd:lasso', 9, '올가미 적중 9', '묶인 상대를 끌어당긴다', { lassoPull: true }),
  M('t_laq_trip', '발 걸기', 'type', 'laquearius', 'd:lasso', 17, '올가미 적중 17', '풀릴 때 넘어뜨린다', { lassoTrip: 0.3 }),
  M('t_laq_twice', '두 번 감기', 'type', 'laquearius', 'misses', 8, '올가미 빗나감 8', '묶는 시간 ×1.5', { lassoSecMul: 1.5 }),
];
// 전설의 고유 딕타타 (2026-09-22 사용자: 전투 효과만). 기존 손잡이를 둘씩 묶어 세게 — 문턱 없음
const LG = (id: string, name: string, ko: string, eff: MasteryEffect): MasteryDef => ({ id: `L_${id}`, name, layer: 'legend', owner: id, cond: { key: 'legend', n: 0, ko: '타고남' }, ko, eff });
export const LEGEND_MASTERY: MasteryDef[] = [
  LG('flamma', '불꽃', 'HP 25% 아래에서 심판이 한 번 멈추고, 지친 몸을 6초 무시한다', { secondWind: true, staminaIgnore: 6 }),
  LG('spiculus', '황제의 방패', 'HP 50% 아래 첫 진입에 3초 동안 모든 타격을 막고, 방패 세우기가 두 번, 막은 직후 30% 로 되친다(×0.8)', { shieldWall: { at: 0.5, sec: 3 }, shieldUpTwice: true, onBlockStrike: { p: 0.3, mult: 0.8 } }),
  LG('celadus', '함성', '허초 ×1.5, 허초 뒤 50% 로 한 번 더 베고(×1.0), 같은 틱이면 먼저 친다', { pMul: ['feint', 1.5], afterHit: { p: 0.5, mult: 1.0, when: 'feint' }, firstStrike: true }),
  LG('crescens', '의사의 손', '그물 ×1.5, 빗나간 그물을 거둬 한 번 더, 거리에서도 던지고, 묶인 상대에 30% 로 한 타 더', { pMul: ['net', 1.5], netRecover: true, farNet: true, afterHit: { p: 0.3, mult: 1.0, when: 'bound' } }),
  LG('priscus', '버티는 자', '넘어지지 않고, HP 25% 아래에서 심판이 한 번 멈춘다', { noTrip: true, secondWind: true }),
  LG('verus', '진실의 창', '경기 한 번 멀리서 창을 던지고(×1.2), 길목 찌르기 간격 ×0.8', { throwOnce: 1.2, pokeGapMul: 0.8 }), /* 1.5·0.6 은 같은 유형 상대 96% */
  LG('tetraites', '유리잔의 기수', '상대가 넘어지거나 묶이면 돌진을 다시 장전, 두 걸음 거리에서도 돌진, 말 위 돌진은 사거리 2 에서, 돌진 뒤 25% 로 한 타 더', { recharge: true, shortCharge: true, mountedRange: true, afterHit: { p: 0.25, mult: 0.8, when: 'charge' } }),
  LG('hermes', '세 가지 무기', '연속이 두 번까지, 치명타 ×1.3', { comboTwice: true, critMul: 1.3 }),
  LG('columbus', '비둘기', '맞는 순간 15% 로 완전히 피하고, 이탈이 ×1.3 빠르다', { dodge: { p: 0.15 }, retreatMul: 1.3 }),
  LG('prudens', '신중', '올가미 ×1.5 오래 묶고, 묶은 상대를 끌어당기고, 풀릴 때 70% 로 넘어뜨리고, 묶인 상대에 30% 로 한 타 더', { lassoSecMul: 1.5, lassoPull: true, lassoTrip: 0.7, afterHit: { p: 0.3, mult: 1.0, when: 'bound' } }),
];
export const MASTERY_BY_ID: Record<string, MasteryDef> = Object.fromEntries([...MASTERY, ...LEGEND_MASTERY].map(m => [m.id, m]));
export const MASTERY_SLOTS = 4;
// 이 유형이 익힐 수 있는 후보 (네 층)
export function masteryCandidates(type: GType): MasteryDef[] { const c = classOf(type); const ck = `${c.off}+${c.main}`; return MASTERY.filter(m => (m.layer === 'main' && m.owner === c.main) || (m.layer === 'off' && m.owner === c.off) || (m.layer === 'class' && m.owner === ck) || (m.layer === 'type' && m.owner === type)); }
export const masteryOf = (g: { dictata?: string[]; type: GType; legend?: string }): MasteryDef[] => (g.dictata ?? []).map(id => MASTERY_BY_ID[id]).filter((m): m is MasteryDef => !!m && (m.layer === 'legend' ? m.owner === g.legend : masteryCandidates(g.type).includes(m)));
export const masterySlotsUsed = (g: { dictata?: string[] }) => (g.dictata ?? []).filter(id => MASTERY_BY_ID[id]?.layer !== 'legend').length; // 전설의 고유 딕타타는 자리를 안 차지한다 // 유형이 바뀌면 안 맞는 층은 잠든다
// 경력 누적으로 문턱을 넘은 후보 (아직 안 익힌 것, 이름이 같은 것은 하나만 — 후보끼리도, Codex 리뷰)
export function masteryReady(g: { dictata?: string[]; career?: Record<string, number>; type: GType }): MasteryDef[] {
  const have = new Set(g.dictata ?? []); const names = new Set((g.dictata ?? []).map(id => MASTERY_BY_ID[id]?.name)); const out: MasteryDef[] = [];
  for (const m of masteryCandidates(g.type)) { if (have.has(m.id) || names.has(m.name) || (g.career?.[m.cond.key] ?? 0) < m.cond.n) continue; names.add(m.name); out.push(m); }
  return out;
}
// 학습 효과 합치기 (battle.ts 가 유닛마다 한 번). 같은 손잡이가 겹치면 덮어쓰지 않고 모은다: 뒤따르는 타격·회피·확률 배율은 목록으로, 확률 손잡이는 합쳐서(1−Π(1−p)), 배율은 큰 쪽 (Codex 리뷰 P2)
export interface MergedEffect extends Omit<MasteryEffect, 'afterHit' | 'dodge' | 'pMul'> { afterHits: AfterHit[]; dodges: Dodge[]; pMuls: Partial<Record<DictataId, number>> }
export function mergeMastery(list: MasteryDef[]): MergedEffect {
  const out: MergedEffect = { afterHits: [], dodges: [], pMuls: {} };
  const orP = (a: number | undefined, b: number) => a == null ? b : 1 - (1 - a) * (1 - b);
  for (const m of list) { const e = m.eff;
    if (e.afterHit) out.afterHits.push(e.afterHit); if (e.dodge) out.dodges.push(e.dodge); if (e.pMul) out.pMuls[e.pMul[0]] = (out.pMuls[e.pMul[0]] ?? 1) * e.pMul[1];
    if (e.onBlockTrip) out.onBlockTrip = { p: orP(out.onBlockTrip?.p, e.onBlockTrip.p), sec: Math.max(out.onBlockTrip?.sec ?? 0, e.onBlockTrip.sec) };
    if (e.onBlockStrike) out.onBlockStrike = { p: orP(out.onBlockStrike?.p, e.onBlockStrike.p), mult: Math.max(out.onBlockStrike?.mult ?? 0, e.onBlockStrike.mult) };
    if (e.stumbleOnHit) out.stumbleOnHit = { p: orP(out.stumbleOnHit?.p, e.stumbleOnHit.p), sec: Math.max(out.stumbleOnHit?.sec ?? 0, e.stumbleOnHit.sec) };
    if (e.legOnHit) out.legOnHit = { p: orP(out.legOnHit?.p, e.legOnHit.p), sec: Math.max(out.legOnHit?.sec ?? 0, e.legOnHit.sec), slow: Math.max(out.legOnHit?.slow ?? 0, e.legOnHit.slow) };
    for (const k of ['finishMul', 'critMul', 'sweep', 'parry', 'chaseHit', 'retreatMul', 'allyGuard', 'throwOnce', 'staminaIgnore', 'lassoSecMul', 'lassoTrip'] as const) if (e[k] != null) (out as unknown as Record<string, unknown>)[k] = Math.max((out[k] as number | undefined) ?? 0, e[k] as number);
    for (const k of ['pokeGapMul', 'boundCut'] as const) if (e[k] != null) (out as unknown as Record<string, unknown>)[k] = Math.min((out[k] as number | undefined) ?? Infinity, e[k] as number);
    if (e.shieldWall) out.shieldWall = e.shieldWall;
    for (const k of ['noTrip', 'secondWind', 'recharge', 'shortCharge', 'netRecover', 'farNet', 'lassoPull', 'comboTwice', 'shieldUpTwice', 'firstStrike', 'mountedRange'] as const) if (e[k]) (out as unknown as Record<string, unknown>)[k] = true; }
  return out;
}
