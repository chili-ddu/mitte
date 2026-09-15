// 기술(스킬): 훈련이나 경험으로 배우고, 경기 중 조건이 맞을 때 확률로 발동한다. 발동할수록 숙련되어 확률이 오른다.
// 별칭(에피테트)이 이력이 만든 상시 패시브라면, 기술은 배워서 익힌 액티브 동작이다.
// 고증: 팔루스에서 정해진 동작(딕타타)을 반복해 익히고 무장별 독토르가 가르쳤다. 같은 유형 안의 서열 프리무스·세쿤두스 팔루스(비문)는 기술 슬롯 수로 쓴다.
import type { Gladiator, GType } from './types.js';

export type SkillId = 'feint' | 'shield_bash' | 'riposte' | 'twin_cut' | 'net_recover' | 'spear_ward' | 'stand_firm' | 'second_wind' | 'appeal' | 'charge_plus';
export interface SkillDef { id: SkillId; name: string; types: GType[] | 'all'; base: number; desc: string; learn: string; worth?: number } // worth: 전력 점수 환산 (거울 대결 600판에서 잰 승률 이득 ≈ 공격 1점 = 4.5점 기준)

export const SKILLS: SkillDef[] = [
  { id: 'feint', name: '허초', types: 'all', base: 0.50, desc: '공격 때 발동하면 상대의 방패 감소를 무시하고 방어를 1/5만 치며 피해 +10%.', learn: '경험: 한 경기에서 방패에 3번 막힌 뒤' },
  { id: 'shield_bash', name: '방패치기', types: ['murmillo', 'secutor', 'provocator'], base: 0.80, desc: '방패로 막았을 때 발동하면 상대를 2.5초 비틀거리게 하고 곧바로 되친다.', learn: '경험: 한 경기에서 3번 막아낸 뒤' },
  { id: 'riposte', name: '되치기', types: 'all', base: 0.80, desc: '막은 직후 발동하면 즉시 반격한다(공격력 200%).', learn: '경험: 막고 나서 이긴 경기' },
  { id: 'twin_cut', name: '이중베기', types: ['thraex', 'dimachaerus'], base: 0.25, desc: '연속 공격 확률 +25%.', learn: '경험: 연속 공격으로 상대를 쓰러뜨린 뒤' },
  { id: 'net_recover', name: '그물회수', types: ['retiarius'], base: 0.50, desc: '던진 그물을 거둬 경기 중 한 번 더 던진다.', learn: '경험: 그물로 묶은 상대를 쓰러뜨린 뒤' },
  { id: 'spear_ward', name: '창견제', types: ['hoplomachus', 'eques'], base: 0.40, desc: '근접한 적이 공격하려 할 때 발동하면 창으로 밀어내 그 공격을 무산시키고 창끝으로 찌른다(공격 40%).', learn: '경험: 근접 유형을 이긴 뒤' },
  { id: 'stand_firm', name: '버티기', types: 'all', base: 0.70, desc: 'HP 50% 아래에서 맞을 때 발동하면 피해 −45%.', learn: '경험: HP 20% 아래에서 살아남은 뒤' },
  { id: 'second_wind', name: '숨고르기', types: 'all', base: 0.70, desc: '경기 중 한 번, HP 25% 아래로 떨어질 때 발동하면 심판(수마 루디스)이 잠시 경기를 멈춘다: 2초 동안 공격받지 않고 거리를 벌리며 최대 HP의 25%를 회복.', learn: '경험: HP 20% 아래에서 살아남은 뒤' },
  { id: 'appeal', name: '관중호소', types: 'all', base: 0.60, desc: '쓰러졌을 때 발동하면 검지를 높이 들어 미시오 확률 +10%.', learn: '경험: 미시오로 살아난 뒤' },
  { id: 'charge_plus', name: '돌진강화', types: ['hoplomachus', 'eques', 'secutor'], base: 0.80, desc: '돌진 공격 때 발동하면 피해 ×2.5, 상대가 1.5초 비틀거린다.', learn: '경험: 돌진 공격으로 상대를 쓰러뜨린 뒤' },
];
export const SKILL_WORTH: Record<SkillId, number> = { feint: 4, shield_bash: 4, riposte: 3.5, twin_cut: 4.5, net_recover: 4.5, spear_ward: 3.5, stand_firm: 6.5, second_wind: 5.5, appeal: 0, charge_plus: 2.5 }; // 거울 대결 600판 승률 이득(공 +1 = +18pt = 전력 4점 기준): 버티기 +30, 숨고르기 +25, 이중베기·그물회수 +21, 방패치기 +19, 허초 +17, 되치기 +16, 창견제 근접 상대 +16, 돌진강화 +12. 관중호소는 전투 밖(미시오 +10%)
export const SKILL_BY_ID: Record<SkillId, SkillDef> = Object.fromEntries(SKILLS.map(s => [s.id, s])) as Record<SkillId, SkillDef>;
export const MASTERY_PER_USE = 0.02, MASTERY_MAX = 0.15, MAX_OFFERS = 2;

export const skillsOf = (g: Gladiator): SkillId[] => (g.skills ?? []) as SkillId[];
export const hasSkill = (g: Gladiator, id: SkillId) => skillsOf(g).includes(id);
export const masteryOf = (g: Gladiator, id: SkillId) => g.skillMastery?.[id] ?? 0;
export const masteryBonus = (g: Gladiator, id: SkillId) => Math.min(MASTERY_MAX, masteryOf(g, id) * MASTERY_PER_USE);
let forceProc = false; export function setForceProc(v: boolean) { forceProc = v; } // 테스트용: 기술이 조건만 맞으면 반드시 발동 (?debug&proc)
export const procChance = (g: Gladiator, id: SkillId) => forceProc ? 1 : SKILL_BY_ID[id].base + masteryBonus(g, id) + ((g.epithets ?? []).includes('dictata') ? 0.03 : 0); // 별칭 '딕타타의 달인' +3%
export function addMastery(g: Gladiator, id: SkillId, n = 1) { (g.skillMastery ??= {})[id] = masteryOf(g, id) + n; }

// 프리무스 팔루스: 같은 유형 안의 1등 (승수 8·명예 20). 슬롯 티로 1 · 베테라누스 2 · 프리무스 팔루스 3
export const isPrimusPalus = (g: Gladiator) => g.rank === 'veteranus' && g.wins >= 8 && (g.honor ?? 0) >= 20;
export const skillSlots = (g: Gladiator) => (isPrimusPalus(g) ? 3 : g.rank === 'veteranus' ? 2 : 1) + ((g.talent ?? 0) >= 3 ? 1 : 0); // 천부는 기술 자리 +1
export const skillFits = (g: Gladiator, id: SkillId) => { const t = SKILL_BY_ID[id].types; return t === 'all' || t.includes(g.type); };
export const eligibleSkills = (g: Gladiator): SkillDef[] => SKILLS.filter(s => skillFits(g, s.id) && !hasSkill(g, s.id));

// 배울 기회(제안): 훈련 성공이나 경기 경험으로 생긴다. 플레이어가 배울지 정한다 (슬롯이 차면 하나를 버리고 배운다)
export function offerSkill(g: Gladiator, id: SkillId): boolean {
  if (hasSkill(g, id) || !skillFits(g, id)) return false;
  const offers = (g.skillOffers ??= []) as SkillId[];
  if (offers.includes(id) || offers.length >= MAX_OFFERS) return false;
  offers.push(id); return true;
}
export function learnSkill(g: Gladiator, id: SkillId, replace?: SkillId): boolean {
  if (hasSkill(g, id) || !skillFits(g, id)) return false;
  const list = skillsOf(g);
  if (list.length >= skillSlots(g)) { if (!replace || !list.includes(replace)) return false; g.skills = list.filter(x => x !== replace); if (g.skillMastery) delete g.skillMastery[replace]; }
  (g.skills ??= []).push(id); g.skillOffers = (g.skillOffers ?? []).filter(x => x !== id); return true;
}
export function declineSkill(g: Gladiator, id: SkillId) { g.skillOffers = (g.skillOffers ?? []).filter(x => x !== id); }
export const SKILL_NAME = (id: string) => SKILL_BY_ID[id as SkillId]?.name ?? id;
// 베테라누스 매물·지원자·상대에게 무작위 기술 n개 (유형에 맞는 것만)
export function grantRandomSkills(rng: { pick<T>(a: T[]): T }, g: Gladiator, n: number) { for (let k = 0; k < n; k++) { const e = eligibleSkills(g); if (!e.length) break; (g.skills ??= []).push(rng.pick(e).id); } }
