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
  { id: 'dismount', name: '말에서 내려 치기', layer: 'type', owner: 'eques', desc: `말을 타고 들어와 첫 돌진을 말 위에서 — 반드시 적중, 피해 ×${D.dismount.mult}. 부딪힌 뒤 내려서 싸운다`, note: '기마 후 하마 — 고증', once: true },
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
export const DICTATA_NAME = (id: string) => DICTATA_BY_ID[id as DictataId]?.name ?? id;
