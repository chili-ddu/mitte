// 별칭(에피테트): 전적으로 얻는 개성. 베테라누스부터 발동, 검투사당 최대 3개. 폼페이 낙서·묘비의 실제 별칭을 섞음
import type { Gladiator } from './types.js';

export type EpithetId = 'invictus' | 'immortalis' | 'superstes' | 'cicatrix' | 'suspirium' | 'flamma' | 'retiarii_terror' | 'coronatus' | 'attilius' | 'par' | 'magister' | 'martia' | 'omnia_solus' | 'vindex';
export type EpithetAccessory = 'laurel' | 'scar' | 'sash' | 'palm' | 'armband' | 'staff' | 'rudis' | 'grudge' | 'revenge' | 'legend'; // 예명 밖의 표식: 신분(막대·나무 검)과 인연(원한·복수) (2026-09-17 사용자)
export interface EpithetDef { id: EpithetId; name: string; latin: string; attested: boolean; cond: string; effect: string; accessory: EpithetAccessory; check: (g: Gladiator) => boolean; anyRank?: boolean }
export const MAX_EPITHETS = 1; // 2026-09-22 사용자: 검투사 하나에 예명 하나 (플람마·켈라두스처럼 이름이 곧 별명). 먼저 얻은 것 고정, 단 실제 기록(attested) 예명이 뒤에 조건을 채우면 창작 예명을 밀어낸다

export const EPITHETS: EpithetDef[] = [
  { id: 'invictus', name: '무패', latin: 'Invictus', attested: false, cond: '5연승', effect: '팬 ×1.3', accessory: 'laurel', check: g => (g.streak ?? 0) >= 5 },
  { id: 'immortalis', name: '불사', latin: 'Immortalis', attested: false, cond: '미시오 생존 3회', effect: '미시오 생존 +15%', accessory: 'armband', check: g => g.missios >= 3 },
  { id: 'superstes', name: '생존자', latin: 'Superstes', attested: false, cond: '동료가 모두 쓰러진 뒤 홀로 승리', effect: '미시오 +10%', accessory: 'sash', check: g => (g.soloWins ?? 0) >= 1 },
  { id: 'cicatrix', name: '흉터', latin: 'Cicatrix', attested: false, cond: '부상 3회 생존', effect: '부상 확률 −25% (굳은 몸)', accessory: 'scar', check: g => (g.injuries ?? 0) >= 3 },
  { id: 'suspirium', name: '소녀들의 한숨', latin: 'Suspirium puellarum', attested: true, cond: '트라엑스로 3승', effect: '명예 +10, 승리마다 명예 +2 추가', accessory: 'palm', check: g => g.type === 'thraex' && g.wins >= 3 }, /* 실제 주인 켈라두스는 트라엑스 (전설 사연과 맞춤, 2026-09-22) */
  /* '불꽃(Flamma)' 예명은 뺐다 — 플람마가 전설 인물이 됐다 (2026-09-22) */
  { id: 'coronatus', name: '화관의 주인', latin: 'Coronatus', attested: true, cond: '화관(주최자 만족 승리) 5개', effect: '대여료 +10%', accessory: 'laurel', check: g => (g.crowns ?? 0) >= 5 },
  { id: 'attilius', name: '티로의 기적', latin: 'Attilius', attested: true, cond: '티로일 때 승수 10 이상의 베테라누스를 1대1로 꺾음', effect: '즉시 베테라누스 승급, 명예 +8', accessory: 'palm', check: g => !!g.tiroUpset, anyRank: true },
  { id: 'par', name: '스탄테스 미시', latin: 'Stantes missi', attested: true, cond: '무승부 2회', effect: '미시오 +5%, 명예 +5', accessory: 'armband', check: g => (g.draws ?? 0) >= 2 },
  { id: 'magister', name: '검투사이자 스승', latin: 'Gladiator et magister', attested: true, cond: '승수 8 이상의 독토르', effect: '스승의 이름 — 효과는 없다 (기술 전수는 2026-09-18 뺐다)', accessory: 'sash', check: g => g.status === 'doctor' && g.wins >= 8, anyRank: true },
  { id: 'martia', name: '군신의 기쁨', latin: 'Martia voluptas', attested: true, cond: '명예 80 이상', effect: '출전마다 호감도 +1', accessory: 'laurel', check: g => (g.honor ?? 0) >= 80 },
  { id: 'omnia_solus', name: '혼자서 세 유형을 다 싸우는 자', latin: 'Omnia solus', attested: true, cond: '세 가지 유형으로 각각 승리 (유형 전환)', effect: '어떤 상대와도 전통 짝으로 인정, 명예 +10', accessory: 'laurel', check: g => (g.typesWon ?? []).length >= 3 },
  { id: 'vindex', name: '복수자', latin: 'Vindex', attested: true, cond: '나를 쓰러뜨렸던 상대를 재대결에서 꺾음', effect: '복수 경기 승리 명예 두 배', accessory: 'sash', check: g => (g.revenged ?? 0) >= 1 },
  { id: 'retiarii_terror', name: '그물꾼의 악몽', latin: 'Terror retiariorum', attested: false, cond: '레티아리우스 상대 3승', effect: '레티아리우스 상대 경기 상금 +20%', accessory: 'armband', check: g => (g.retiariusWins ?? 0) >= 3 },
];
export const EPITHET_BY_ID: Record<EpithetId, EpithetDef> = Object.fromEntries(EPITHETS.map(e => [e.id, e])) as Record<EpithetId, EpithetDef>;

export function has(g: Gladiator, id: EpithetId): boolean { return (g.epithets ?? []).includes(id); }
// 전투·판정에 쓰는 보정치
// 예명 효과는 살림과 명성에만 (2026-09-22 사용자: 능력치는 훈련의 영역 — 공·방·HP·피해 배율은 전부 뺐다)
export function epithetMods(g: Gladiator): { missio: number; rent: number; fans: number; injury: number; revengeHonor: number; prizeVsRetiarius: number } {
  const m = { missio: 0, rent: 1, fans: 1, injury: 1, revengeHonor: 1, prizeVsRetiarius: 1 };
  if (has(g, 'coronatus')) m.rent *= 1.10;
  if (has(g, 'par')) m.missio += 0.05;
  if (has(g, 'immortalis')) m.missio += 0.15;
  if (has(g, 'superstes')) m.missio += 0.10;
  if (has(g, 'invictus')) m.fans *= 1.3;
  if (has(g, 'cicatrix')) m.injury *= 0.75;
  if (has(g, 'vindex')) m.revengeHonor *= 2;
  if (has(g, 'retiarii_terror')) m.prizeVsRetiarius *= 1.2;
  return m;
}
// 조건을 채운 새 별칭을 붙인다 (베테라누스만). 붙인 별칭 목록을 돌려준다
export function grantEpithets(g: Gladiator): EpithetDef[] {
  const out: EpithetDef[] = []; g.epithets ??= []; if (g.epithets.length > MAX_EPITHETS) g.epithets = g.epithets.slice(0, MAX_EPITHETS); /* 옛 저장(최대 셋)은 첫 것만 */
  for (const e of EPITHETS) { if (g.rank !== 'veteranus' && !e.anyRank) continue; if (g.epithets.includes(e.id) || !e.check(g)) continue;
    if (g.epithets.length >= MAX_EPITHETS) { const cur = EPITHET_BY_ID[g.epithets[0] as EpithetId]; if (!(e.attested && cur && !cur.attested)) continue; g.epithets = []; } /* 자리가 찼으면 실제 기록 예명이 창작 예명을 밀어낼 때만 */
    g.epithets.push(e.id); out.push(e);
    if (e.id === 'suspirium') g.honor = Math.min(100, (g.honor ?? 0) + 10); if (e.id === 'flamma' || e.id === 'par') g.honor = Math.min(100, (g.honor ?? 0) + 5);
    if (e.id === 'attilius') { g.rank = 'veteranus'; g.honor = Math.min(100, (g.honor ?? 0) + 8); }
    if (e.id === 'omnia_solus') g.honor = Math.min(100, (g.honor ?? 0) + 10); }
  return out;
}
export function accessoriesOf(g: Gladiator): EpithetAccessory[] { return Array.from(new Set([...(g.legend ? ['legend' as const] : []), ...(g.epithets ?? []).map(id => EPITHET_BY_ID[id as EpithetId]?.accessory).filter((a): a is EpithetAccessory => !!a)])); } // 전설은 황금 띠 (2026-09-22)
