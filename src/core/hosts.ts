// 주최자(에디토르) 성격: 누가 왜 경기를 여는가에 따라 상금·대여료·미시오·루디스·호감도가 달라진다
// 고증: 폼페이 광고의 주최자 대부분은 공직 후보(선거용 경기). 무누스의 원래 뜻은 장례 봉헌. 지방 유지는 배상을 두려워해 살려 줬고,
// 황제·총독의 대규모 경기는 시네 미시오네(자비 없음)를 내걸기도 했다. 기량 시합에 거는 내기(스폰시오)는 합법(Digesta 11.5).
import type { HostKind } from './types.js';

export interface HostInfo { ko: string; short: string; prize: number; rent: number; missio: number; rudis: number; fameWin: number; honorAll: number; bet: boolean; desc: string }
export const HOST: Record<HostKind, HostInfo> = {
  candidate: { ko: '선거 후보', short: '후보', prize: 1.3, rent: 1.0, missio: 0, rudis: 0.1, fameWin: 0, honorAll: 0, bet: false, desc: '표를 얻으려 여는 경기. 상금이 후하고 볼거리를 원해 팬 많은 검투사가 나오면 호감도를 더 준다.' },
  miser: { ko: '인색한 유지', short: '유지', prize: 0.8, rent: 0.9, missio: 0.15, rudis: 0, fameWin: 0, honorAll: 0, bet: false, desc: '돈이 없는 지방 유지. 사망 배상이 두려워 살려 주는 편이지만 상금이 적고 대여료도 출전 전 협상에서 깎인다(대여료가 승패와 무관한 것은 그대로).' },
  mourner: { ko: '장례 경기 상주', short: '상주', prize: 1.0, rent: 1.0, missio: -0.15, rudis: -0.1, fameWin: 0, honorAll: 3, bet: false, desc: '죽은 이를 위한 봉헌 경기(무누스의 원래 뜻). 엄숙하고 피를 요구하지만, 출전 자체가 기록에 남아 명예를 준다.' },
  gambler: { ko: '도박꾼 부호', short: '도박꾼', prize: 1.0, rent: 1.0, missio: 0, rudis: 0, fameWin: 0, honorAll: 0, bet: true, desc: '내기(스폰시오)를 거는 부호. 받으면 이길 때 상금이 두 배, 지면 상금만큼 물어낸다. 거절해도 불이익은 없다.' },
  imperial: { ko: '황제·총독의 경기', short: '황제', prize: 1.5, rent: 1.1, missio: -0.25, rudis: 0.2, fameWin: 2, honorAll: 0, bet: false, desc: '로마의 황제나 속주 총독이 여는 대규모 경기. 상금·호감도·루디스가 가장 크지만 시네 미시오네(자비 없음)를 내건다.' },
};
export const HOST_KINDS = Object.keys(HOST) as HostKind[];
// 등급별 출현 (등급 3에만 황제)
export const HOSTS_BY_TIER: Record<1 | 2 | 3, HostKind[]> = {
  1: ['candidate', 'candidate', 'miser', 'mourner', 'gambler'],
  2: ['candidate', 'candidate', 'miser', 'mourner', 'gambler'],
  3: ['imperial', 'imperial', 'candidate', 'mourner', 'gambler'],
};
// 구 저장의 주최자 값 이관
export function migrateHost(h: string): HostKind { return h === 'merciful' ? 'miser' : h === 'bloody' ? 'mourner' : h === 'normal' ? 'candidate' : (h in HOST ? h as HostKind : 'candidate'); }
// 팬: 관중이 이름을 아는 정도. 명예·승수·별칭에서 나온다 (폼페이 낙서의 팬심)
export const FANS_STAR = 40;
