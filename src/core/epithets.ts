// 별칭(에피테트): 전적으로 얻는 개성. 베테라누스부터 발동, 검투사당 최대 3개. 폼페이 낙서·묘비의 실제 별칭을 섞음
import type { Gladiator } from './types.js';

export type EpithetId = 'invictus' | 'immortalis' | 'superstes' | 'cicatrix' | 'suspirium' | 'flamma' | 'retiarii_terror' | 'coronatus' | 'attilius' | 'par' | 'magister' | 'martia' | 'omnia_solus' | 'vindex';
export type EpithetAccessory = 'laurel' | 'scar' | 'sash' | 'palm' | 'armband' | 'staff' | 'rudis' | 'grudge' | 'revenge' | 'legend'; // 예명 밖의 표식: 신분(막대·나무 검)과 인연(원한·복수) (2026-09-17 사용자)
export interface EpithetDef { id: EpithetId; name: string; latin: string; attested: boolean; cond: string; effect: string; accessory: EpithetAccessory; check: (g: Gladiator) => boolean; anyRank?: boolean }
export const MAX_EPITHETS = 3;

export const EPITHETS: EpithetDef[] = [
  { id: 'invictus', name: '무패', latin: 'Invictus', attested: false, cond: '5연승', effect: '공격 +10%', accessory: 'laurel', check: g => (g.streak ?? 0) >= 5 },
  { id: 'immortalis', name: '불사', latin: 'Immortalis', attested: false, cond: '미시오 생존 3회', effect: '미시오 생존 +15%', accessory: 'armband', check: g => g.missios >= 3 },
  { id: 'superstes', name: '생존자', latin: 'Superstes', attested: false, cond: '동료가 모두 쓰러진 뒤 홀로 승리', effect: '방어 +10%', accessory: 'sash', check: g => (g.soloWins ?? 0) >= 1 },
  { id: 'cicatrix', name: '흉터', latin: 'Cicatrix', attested: false, cond: '부상 3회 생존', effect: 'HP −5%, 방어 +15%', accessory: 'scar', check: g => (g.injuries ?? 0) >= 3 },
  { id: 'suspirium', name: '소녀들의 한숨', latin: 'Suspirium puellarum', attested: true, cond: '투구 없는 유형(레티아리우스)으로 3승', effect: '명예 +10, 승리마다 명예 +2 추가', accessory: 'palm', check: g => g.type === 'retiarius' && g.wins >= 3 },
  { id: 'flamma', name: '불꽃', latin: 'Flamma', attested: true, cond: '15전 이상', effect: '공격 +8%, 명예 +5', accessory: 'sash', check: g => g.fights >= 15 },
  { id: 'coronatus', name: '화관의 주인', latin: 'Coronatus', attested: true, cond: '화관(주최자 만족 승리) 5개', effect: '대여료 +10%', accessory: 'laurel', check: g => (g.crowns ?? 0) >= 5 },
  { id: 'attilius', name: '티로의 기적', latin: 'Attilius', attested: true, cond: '티로일 때 승수 10 이상의 베테라누스를 1대1로 꺾음', effect: '즉시 베테라누스 승급, 명예 +8', accessory: 'palm', check: g => !!g.tiroUpset, anyRank: true },
  { id: 'par', name: '스탄테스 미시', latin: 'Stantes missi', attested: true, cond: '무승부 2회', effect: '미시오 +5%, 명예 +5', accessory: 'armband', check: g => (g.draws ?? 0) >= 2 },
  { id: 'magister', name: '검투사이자 스승', latin: 'Gladiator et magister', attested: true, cond: '승수 8 이상의 독토르', effect: '스승의 이름 — 효과는 없다 (기술 전수는 2026-09-18 뺐다)', accessory: 'sash', check: g => g.status === 'doctor' && g.wins >= 8, anyRank: true },
  { id: 'martia', name: '군신의 기쁨', latin: 'Martia voluptas', attested: true, cond: '명예 80 이상', effect: '출전마다 호감도 +1', accessory: 'laurel', check: g => (g.honor ?? 0) >= 80 },
  { id: 'omnia_solus', name: '혼자서 세 유형을 다 싸우는 자', latin: 'Omnia solus', attested: true, cond: '세 가지 유형으로 각각 승리 (유형 전환)', effect: '어떤 상대와도 전통 짝으로 인정, 명예 +10', accessory: 'laurel', check: g => (g.typesWon ?? []).length >= 3 },
  { id: 'vindex', name: '복수자', latin: 'Vindex', attested: true, cond: '나를 쓰러뜨렸던 상대를 재대결에서 꺾음', effect: '재대결 상대에게 피해 +10%', accessory: 'sash', check: g => (g.revenged ?? 0) >= 1 },
  { id: 'retiarii_terror', name: '그물꾼의 악몽', latin: 'Terror retiariorum', attested: false, cond: '레티아리우스 상대 3승', effect: '레티아리우스에게 피해 +15%', accessory: 'armband', check: g => (g.retiariusWins ?? 0) >= 3 },
];
export const EPITHET_BY_ID: Record<EpithetId, EpithetDef> = Object.fromEntries(EPITHETS.map(e => [e.id, e])) as Record<EpithetId, EpithetDef>;

export function has(g: Gladiator, id: EpithetId): boolean { return (g.epithets ?? []).includes(id); }
// 전투·판정에 쓰는 보정치
export function epithetMods(g: Gladiator): { atk: number; def: number; hp: number; missio: number; vsRetiarius: number; rent: number } {
  const m = { atk: 1, def: 1, hp: 1, missio: 0, vsRetiarius: 1, rent: 1 };
  if (has(g, 'coronatus')) m.rent *= 1.10;
  if (has(g, 'par')) m.missio += 0.05;
  if (has(g, 'invictus')) m.atk *= 1.10;
  if (has(g, 'flamma')) m.atk *= 1.08;
  if (has(g, 'superstes')) m.def *= 1.10;
  if (has(g, 'cicatrix')) { m.hp *= 0.95; m.def *= 1.15; }
  if (has(g, 'immortalis')) m.missio += 0.15;
  if (has(g, 'retiarii_terror')) m.vsRetiarius *= 1.15;
  return m;
}
// 조건을 채운 새 별칭을 붙인다 (베테라누스만). 붙인 별칭 목록을 돌려준다
export function grantEpithets(g: Gladiator): EpithetDef[] {
  const out: EpithetDef[] = []; g.epithets ??= [];
  for (const e of EPITHETS) { if (g.epithets.length >= MAX_EPITHETS) break; if (g.rank !== 'veteranus' && !e.anyRank) continue; if (g.epithets.includes(e.id) || !e.check(g)) continue; g.epithets.push(e.id); out.push(e);
    if (e.id === 'suspirium') g.honor = Math.min(100, (g.honor ?? 0) + 10); if (e.id === 'flamma' || e.id === 'par') g.honor = Math.min(100, (g.honor ?? 0) + 5);
    if (e.id === 'attilius') { g.rank = 'veteranus'; g.honor = Math.min(100, (g.honor ?? 0) + 8); }
    if (e.id === 'omnia_solus') g.honor = Math.min(100, (g.honor ?? 0) + 10); }
  return out;
}
export function accessoriesOf(g: Gladiator): EpithetAccessory[] { return Array.from(new Set([...(g.legend ? ['legend' as const] : []), ...(g.epithets ?? []).map(id => EPITHET_BY_ID[id as EpithetId]?.accessory).filter((a): a is EpithetAccessory => !!a)])); } // 전설은 황금 띠 (2026-09-22)
