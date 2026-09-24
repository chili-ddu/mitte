import type { Contract, Gladiator, GType, ClauseId } from './types.js';
import { Rng } from './rng.js';
import { CONFIG } from './config.js';
import { battle } from './battle.js';
import { judgeLoser, judgeWinnerDowned, type Fate } from './missio.js';
import { offerContracts, resetContractIds, nextContractId, venueFor } from './contracts.js';
import { offerMarket, offerApplicants, starters, drawMarket } from './market.js';
import { castState, type CastBook } from './cast.js';
import { label, maybePromote, rentFee, resetIds, sellPrice, valueOf, peekNextId, setNextId, makeGladiator } from './gladiator.js';
import { computeSynergies, classicMatchup } from './synergy.js';
import { TYPE_KO as TYPE_LABEL, TYPE_STATS } from './gladiator.js';
import { grantEpithets, type EpithetDef } from './epithets.js';
import { SKILLS, SKILL_BY_ID, hasSkill, procChance, addMastery, offerSkill, eligibleSkills, skillFits, type SkillId } from './skills.js';
import { makeRivals, replenishRivals, arriveRivals, memberById, rivalOf, rivalStar, recordVsMe, rivalDef, promoteStar, makeStar, makeSecond, challengeProgress, dojoOrder, type Rival } from './rivals.js';
import { HOST, migrateHost, FANS_STAR } from './hosts.js';
import { CLAUSES, acceptedOf } from './clauses.js';
import { awaken, talentOf, TALENT_KO, TALENT_TRAIN_BONUS, TALENT_SKILL_MUL } from './talent.js';
import { fansOf, powerOf, teamPower } from './gladiator.js';
export { rivalOf, memberById, rivalStar, recordVsMe, rivalDef, challengeProgress, dojoOrder };
import { offerClauses } from './clauses.js';

export interface FightReport {
  contract: Contract;
  team: Gladiator[];
  winner: 'A' | 'B' | 'draw';
  turns: number;
  log: string[];
  events: import('./types.js').BattleEvent[];
  frames: import('./types.js').BattleFrame[];
  duration: number;
  initialHp: Record<number, number>;
  downed: Gladiator[];
  rent: number; expense: number; salary: number; prize: number; compensation: number; // salary: 자유민 검투사 급료
  fates: { g: Gladiator; fate: Fate; p?: number; wound?: boolean }[]; // wound: 상처로 죽음 (판정 없이 쓰러져 숨짐)
  promoted: Gladiator[];
  fameDelta: number;
  classic: boolean;      // 전통 짝 대결이었는가 (호감도 +2, 미시오 +5%)
  rudis: Gladiator[];    // 이 경기에서 루디스(자유)를 받은 검투사
  newEpithets: { g: Gladiator; e: EpithetDef }[]; // 이 경기로 얻은 별칭
  newSkillOffers: { g: Gladiator; id: SkillId }[]; // 이 경기의 경험으로 배울 수 있게 된 기술
  bet?: { won: boolean; amount: number }; // 스폰시오 결과
  clauses: ClauseId[]; // 받아들인 특약
  awakened: { g: Gladiator; from: number; to: number; why: string }[]; // 이 경기로 자질을 깨우친 검투사
  guestGift: number;   // 귀족 사례금 (초대했던 귀족의 경기를 이겼을 때)
  enemyFates: { g: Gladiator; fate: Fate; wound?: boolean }[]; // 상대 쓰러진 검투사의 운명 (실제 판정)
  grudges: { mine: Gladiator; enemy: Gladiator }[]; // 이번 경기의 원한 재대결
  revenges: { mine: Gladiator; enemy: Gladiator }[]; // 복수 성공
  challenge?: { rival: Rival; won: boolean; graduated: boolean; gained?: Gladiator; lost?: Gladiator; starDied?: boolean; noRoom?: boolean }; // 졸업전 결과: 간판 이적 / 판돈 상실 / 간판 사고사 / 켈라가 없어 못 데려옴
}

export interface GameState {
  rng: Rng;
  season: number;      // 1..12
  money: number;
  fame: number;
  roster: Gladiator[];
  graveyard: Gladiator[];
  contracts: Contract[];
  market: Gladiator[];
  applicants: Gladiator[]; // 루두스 문 앞의 자유민 지원자 (시즌마다 갱신)
  rivals: Rival[];     // 상대 파밀리아 (시즌을 넘어 유지)
  history: string[];
  over: boolean;
  reason?: string;
  ludus: Ludus;        // 시설 단계
  events?: SeasonEvents; // 이번 시즌에 치른 행사
  lanista: Lanista;    // 현재 라니스타
  pendingSuccession?: boolean; // 은퇴했고 후계자 선택 대기
  lineageLog?: string[]; // 역대 라니스타
  hall?: HallEntry[]; // 명예의 전당: 루디스를 받은 검투사 (떠난 뒤에도 남는다)
  guestPromise?: boolean; // 귀족 손님 초대 뒤: 다음 시즌 후보 경기 계약이 온다
  cast: CastBook;      // 고정 명부 상태 (등장 횟수·떠남·소속)
  rerolled?: string[]; // 이번 시즌 리롤로 이미 본 명부 id
  lastDecay?: number;  // 직전 시즌 망각량 (정산 표시)
  invited?: number;    // 황제 루두스 초청을 받은 시즌 (1회차 엔딩)
  lastLeft?: string[]; lastFreed?: string[]; lastOverwork?: string[]; lastNoBed?: string[]; // 직전 시즌 종료 때 떠난 계약자 / 형기 만료로 자유가 된 죄수 / 과로사 / 침상이 없어 못 나은 부상자 (정산 표시용)
}
export interface SeasonEvents { cena: boolean; pompa: boolean; votum: boolean; edicta: boolean; guests: boolean }
export const EVENT_KEYS = ['cena', 'pompa', 'votum', 'edicta', 'guests'] as const;
export const EVENT_KO: Record<keyof SeasonEvents, string> = { cena: '케나 리베라', pompa: '폼파', votum: '네메시스 봉헌', edicta: '에딕타', guests: '귀족 손님 초대' }; // 라틴 이름을 앞에 (설명은 행사 줄에)
// 시즌 행사 결제: 시즌 진행 직전에 한 번. 돈이 모자라면 그 행사는 건너뜀
export function holdEvents(st: GameState, choice: SeasonEvents): SeasonEvents {
  const held: SeasonEvents = { cena: false, pompa: false, votum: false, edicta: false, guests: false };
  for (const k of EVENT_KEYS) { if (!choice[k]) continue; const cost = CONFIG.events[k].cost; if (st.money < cost) continue; st.money -= cost; held[k] = true; st.history.push(`${seasonName(st.season)}: ${EVENT_KO[k]} ${cost}`); }
  st.events = held; return held;
}
export interface HallEntry { name: string; type: GType; wins: number; fights: number; honor: number; season: number; epithets: string[]; skills?: string[]; how: 'rudis' | 'damnatus' | 'refused' }
export function hallAdd(st: GameState, g: Gladiator, how: HallEntry['how']) { (st.hall ??= []).push({ name: g.name, type: g.type, wins: g.wins, fights: g.fights, honor: g.honor ?? 0, season: st.season, epithets: [...(g.epithets ?? [])], skills: [...(g.skills ?? [])], how }); }
export interface Lanista { name: string; age: number; trait: 'founder' | 'freedman' | 'doctor'; type?: GType; since: number; dead?: boolean }
const LANISTA_NAMES = ['가이우스 바티아투스', '루키우스 아우렐리우스', '마르쿠스 아티우스', '퀸투스 카시우스', '티투스 플라비우스', '푸블리우스 살비우스', '그나이우스 포르키우스', '데키무스 마밀리우스'];
export function makeLanista(rng: Rng, season: number, fixed = false): Lanista { const L = CONFIG.lanista; return fixed ? { name: L.fixed.name, age: L.fixed.age, trait: 'founder', since: season } : { name: rng.pick(LANISTA_NAMES), age: rng.int(L.ageMin, L.ageMax), trait: 'founder', since: season }; } // fixed: 1회차 주인공. 아니면 먼 친척
// 해마다 죽을 확률 (나이 구간표)
export function mortality(age: number): number { for (const [upto, p] of CONFIG.lanista.mortality) if (age < upto) return p; return 0.14; }
export function canRetire(st: GameState): boolean { return st.lanista.age >= CONFIG.lanista.voluntaryAge || successorOptions(st).some(o => o.from); } // 자발 계승: 후계자 후보(루디아리우스·독토르)가 있으면 언제든. 비용은 호감도 ×0.6
export const mustRetire = (st: GameState): boolean => st.lanista.age >= CONFIG.lanista.mandatoryAge;
export interface SuccessorOption { key: string; label: string; desc: string; from?: Gladiator; trait: Lanista['trait']; type?: GType }
export function successorOptions(st: GameState): SuccessorOption[] {
  const out: SuccessorOption[] = st.roster.filter(g => g.status === 'doctor').map(g => ({ key: `doc-${g.id}`, label: `${g.name} (독토르, ${TYPE_LABEL[g.type]})`, desc: `전직 검투사 (기술 훈련 성공률 +${Math.round(CONFIG.lanista.skillTrainBonus * 100)}%). ${TYPE_LABEL[g.type]} 훈련 +${CONFIG.lanista.doctorTrainBonus}. 명예 ${g.honor ?? 0} 만큼 호감도 계승에 보탬`, from: g, trait: 'doctor', type: g.type }));
  for (const g of st.roster.filter(g => g.status === 'rudiarius')) out.push({ key: `rud-${g.id}`, label: `${g.name} (루디아리우스, ${TYPE_LABEL[g.type]}, ${g.age ?? '?'}세)`, desc: `루디스를 받은 자유민. 시장 매물 ${Math.round(CONFIG.lanista.freedmanDiscount * 100)}% 할인. 명예 ${g.honor ?? 0} 만큼 호감도 계승에 보탬. 젊을수록 오래 이끈다`, from: g, trait: 'freedman' });
  out.push({ key: 'freedman', label: '부하 해방노예', desc: `루두스 살림을 맡던 해방노예. 시장 매물 ${Math.round(CONFIG.lanista.freedmanDiscount * 100)}% 할인`, trait: 'freedman' });
  return out;
}
export function retire(st: GameState, dead = false) { st.pendingSuccession = true; st.lanista.dead = dead; st.history.push(`${seasonName(st.season)}: ${st.lanista.name} ${dead ? '사망' : '은퇴'} (${st.lanista.age}세)`); }
export function succeed(st: GameState, opt: SuccessorOption) {
  const L = CONFIG.lanista; const honor = opt.from?.honor ?? 0;
  (st.lineageLog ??= []).push(`${st.lanista.name} (${st.lanista.since}~${st.season}번째 시즌, ${st.lanista.age}세 ${st.lanista.dead ? '사망' : '은퇴'})`);
  if (opt.from) st.roster = st.roster.filter(r => r !== opt.from);
  const name = opt.from ? opt.from.name : st.rng.pick(LANISTA_NAMES);
  st.lanista = { name, age: opt.from?.age ?? st.rng.int(34, 42), trait: opt.trait, type: opt.type, since: st.season }; // 독토르 후계자는 제 나이 그대로
  st.fame = Math.max(0, Math.min(100, Math.round(st.fame * L.fameKeep + honor * L.fameFromHonor)));
  if (st.money > 0) { const tax = Math.round(st.money * L.inheritanceTax); st.money -= tax; st.history.push(`${seasonName(st.season)}: 유산세 ${tax} HS (5%)`); } // 비케시마 헤레디타티움
  st.pendingSuccession = false;
  st.history.push(`${seasonName(st.season)}: ${name} 라니스타 승계`);
}
export const SEASON_KO = ['봄', '여름', '가을', '겨울'];
export function seasonName(s: number) { return `${Math.floor((s - 1) / 4) + 1}년차 ${SEASON_KO[(s - 1) % 4]}`; }

export interface Ludus { cells: number[]; kitchen: number; beds: number; medicine: number; herbs: number; palus: number; gym: number; bedsUse: (number | null)[] } // cells: 칸별 숙소 질(0~3). bedsUse: 침상마다 누운 검투사 id (부상자를 라니스타가 직접 눕힌다)
export function newLudus(): Ludus { return { cells: Array(CONFIG.ludus.cells.start).fill(0), kitchen: 0, beds: CONFIG.ludus.beds.start, medicine: 0, herbs: 0, palus: CONFIG.ludus.palus.start, gym: 0, bedsUse: [] }; }
// 침상: 누운 부상자만 시즌 말에 낫고 요양도 할 수 있다. 여러 명이 한 시즌에 다치면 누구를 눕힐지 라니스타가 고른다
export function bedPatient(st: GameState, slot: number): Gladiator | null { const id = st.ludus.bedsUse?.[slot]; if (id == null) return null; const g = st.roster.find(x => x.id === id); return g && g.injured > 0 ? g : null; }
export function inBed(st: GameState, g: Gladiator): boolean { return (st.ludus.bedsUse ?? []).slice(0, st.ludus.beds).includes(g.id) && g.injured > 0; }
export function putInBed(st: GameState, g: Gladiator, slot: number): boolean { if (g.injured <= 0 || slot < 0 || slot >= st.ludus.beds) return false; const u = (st.ludus.bedsUse ??= []); for (let i = 0; i < u.length; i++) if (u[i] === g.id) u[i] = null; u[slot] = g.id; return true; }
export function pruneBeds(st: GameState) { const u = (st.ludus.bedsUse ??= []); for (let i = 0; i < u.length; i++) { const id = u[i]; if (id == null) continue; const g = st.roster.find(x => x.id === id); if (!g || g.injured <= 0) u[i] = null; } }
export function rosterCap(st: GameState): number { return st.ludus.cells.length; }
// 켈라 칸 번호: 검투사마다 저장(`g.cell`). 없거나 겹치면 가장 앞의 빈 칸을 준다
export function cellOf(st: GameState, g: Gladiator): number {
  const used = new Set(st.roster.filter(x => x !== g && x.cell != null).map(x => x.cell!));
  if (g.cell != null && g.cell < st.ludus.cells.length && !used.has(g.cell)) return g.cell;
  let k = 0; while (used.has(k)) k++; g.cell = k; return k;
}
export function occupantOf(st: GameState, k: number): Gladiator | undefined { return st.roster.find(g => cellOf(st, g) === k); }
export function cellQuality(st: GameState, g: Gladiator): number { const i = cellOf(st, g); return i >= 0 && i < st.ludus.cells.length ? st.ludus.cells[i] : 0; }
export function injurySeasons(st: GameState): number { return st.ludus.medicine >= CONFIG.ludus.medicine.injuryAt ? 1 : 2; } // 침상은 여기가 아니라 시즌 말 회복 인원 상한으로 작용한다
export function healCostOf(st: GameState): number { return st.ludus.medicine >= CONFIG.ludus.medicine.cheapAt ? 250 : CONFIG.healCost; }
export function trainCap(st: GameState): number { return st.ludus.palus; }
export function trainedCount(st: GameState): number { return st.roster.filter(g => g.trained).length; }
export function gymBonus(st: GameState): number { return CONFIG.ludus.gym.bonusAt.filter(a => st.ludus.gym >= a).length; }
// 시설 유지비: 증축 칸 + 숙소 ★ + 조리장·침상·의술·약재·팔루스·훈련 시설 단계
export function facilityUpkeep(st: GameState): number { const U = CONFIG.upkeepFacility, L = CONFIG.ludus, u = st.ludus; return Math.max(0, u.cells.length - L.cells.start) * U.cell + u.cells.reduce((a, q) => a + q, 0) * U.star + u.kitchen * U.kitchen + Math.max(0, u.beds - L.beds.start) * U.bed + u.medicine * U.medicine + u.herbs * U.herbs + Math.max(0, u.palus - L.palus.start) * U.palus + u.gym * U.gym; }
export function fameUpkeep(st: GameState): number { const F = CONFIG.upkeepFame; return st.fame >= F.from ? (st.fame - 50) * F.per : 0; } // 명성 유지비
export function gladiatorUpkeep(st: GameState): number { const small = st.ludus.cells.length <= CONFIG.ludus.cells.start ? CONFIG.upkeepSmallLudus : 1; return st.roster.reduce((a, g) => a + Math.round((g.status === 'doctor' ? CONFIG.doctorSalary : g.rank === 'tiro' ? CONFIG.upkeepTiro : CONFIG.upkeepPerGladiator) * (g.status === 'doctor' ? 1 : small)), 0); } // 티로 200 · 베테라누스 300 · 독토르 급료. 작은 루두스(4칸)는 −25%
export function upkeepOf(st: GameState): number { return gladiatorUpkeep(st) + facilityUpkeep(st) + fameUpkeep(st); }
export type Facility = 'cells' | 'cell' | 'kitchen' | 'beds' | 'medicine' | 'herbs' | 'palus' | 'gym';
export const FACILITY_KO: Record<Facility, string> = { cells: '켈라 증축', cell: '숙소 질', kitchen: '조리장', beds: '침상', medicine: '의술', herbs: '약재', palus: '팔루스', gym: '훈련 시설' };
// 다음 단계 비용 (null = 최대). cell 은 idx 번째 칸
export function upgradeCost(st: GameState, f: Facility, idx = 0): number | null {
  const L = CONFIG.ludus, u = st.ludus;
  switch (f) {
    case 'cells': return u.cells.length >= L.cells.max ? null : L.cells.addCost((u.cells.length - L.cells.start) / L.cells.per);
    case 'cell': { const q = u.cells[idx]; return q == null || q >= L.cells.qualityCost.length ? null : L.cells.qualityCost[q]; }
    case 'kitchen': return u.kitchen >= L.kitchen.cost.length ? null : L.kitchen.cost[u.kitchen];
    case 'beds': return u.beds >= L.beds.max ? null : L.beds.cost[u.beds - L.beds.start];
    case 'medicine': return u.medicine >= L.medicine.cost.length ? null : L.medicine.cost[u.medicine];
    case 'herbs': return u.herbs >= L.herbs.cost.length ? null : L.herbs.cost[u.herbs];
    case 'palus': return u.palus >= L.palus.max ? null : L.palus.cost[u.palus - L.palus.start];
    case 'gym': return u.gym >= L.gym.cost.length ? null : L.gym.cost[u.gym];
  }
}
export function facilityLevel(st: GameState, f: Facility, idx = 0): number { const u = st.ludus; return f === 'cells' ? u.cells.length : f === 'cell' ? u.cells[idx] ?? 0 : u[f]; }
export function upgrade(st: GameState, f: Facility, idx = 0): boolean {
  const cost = upgradeCost(st, f, idx); if (cost == null || st.money < cost) return false;
  st.money -= cost;
  if (f === 'cells') for (let k = 0; k < CONFIG.ludus.cells.per; k++) st.ludus.cells.push(0);
  else if (f === 'cell') st.ludus.cells[idx]++;
  else st.ludus[f]++;
  st.history.push(`${seasonName(st.season)}: ${FACILITY_KO[f]}${f === 'cell' ? ` ${idx + 1}번 칸` : ''} ${cost}`);
  return true;
}
// 검투사를 다른 칸으로 옮긴다 (로스터 순서 교환)
// 검투사를 k번 켈라로 옮긴다: 그 칸에 누가 있으면 서로 자리를 바꾼다
export function moveToCell(st: GameState, g: Gladiator, k: number) { if (k < 0 || k >= st.ludus.cells.length) return; const from = cellOf(st, g); const o = occupantOf(st, k); if (o && o !== g) o.cell = from; g.cell = k; }
export function swapCells(st: GameState, a: number, b: number) { const ga = occupantOf(st, a), gb = occupantOf(st, b); if (ga) ga.cell = b; if (gb) gb.cell = a; }

export function newGame(seed: number): GameState {
  resetIds(); resetContractIds();
  const rng = new Rng(seed);
  const cast: CastBook = {};
  const st: GameState = { rng, season: 1, money: CONFIG.startMoney, fame: CONFIG.startFame, roster: [], graveyard: [], contracts: [], market: [], applicants: [], rivals: makeRivals(rng, 1, cast), history: [], over: false, ludus: newLudus(), lanista: makeLanista(rng, 1, true), cast };
  for (const g of starters(rng, cast)) { disambiguate(st, g); st.roster.push(g); } // 시작 로스터: 펠릭스 + 평범 하나 (명부)
  startSeason(st);
  return st;
}

export function startSeason(st: GameState) {
  st.events = { cena: false, pompa: false, votum: false, edicta: false, guests: false }; st.rerolled = [];
  for (const r of arriveRivals(st.rng, st.rivals, st.season, st.cast)) st.history.push(`${seasonName(st.season)}: ${r.name} 이(가) 이 지방에 나타났다`); // 앞 집을 졸업하면 다음 집이 온다 (도장 사슬)
  replenishRivals(st.rng, st.rivals, st.season, st.fame, st.cast); // 소속 보충. 간판·두 번째는 승격으로만. 시장에서 떠난 사람이 먼저
  st.contracts = offerContracts(st.rng, st.season, st.fame, st.rivals, st.roster); // 내 전력 기준 약·중·중·강
  claimPledged(st); // 켈라가 비었으면 기다리던 간판이 먼저 온다
  offerChallenge(st); // 졸업전(간판내기): 조건을 채운 파밀리아 중 도장 순서가 앞선 하나
  if (st.guestPromise && st.contracts.length) { st.contracts[0].host = 'candidate'; st.contracts[0].guest = true; st.guestPromise = false; st.history.push(`${seasonName(st.season)}: 초대했던 귀족이 선거 경기 계약을 들고 왔다 (${st.contracts[0].venue})`); } // 귀족 손님 초대의 인연
  st.market = offerMarket(st.rng, st.season, st.fame, st.cast, st.market);
  st.applicants = offerApplicants(st.rng, st.season, st.fame);
}

export function available(st: GameState): Gladiator[] { return st.roster.filter(g => g.alive && g.injured === 0 && !g.fought && g.status !== 'doctor'); }
// 훈련 폭: 기본 1 + 같은 유형 독토르가 해당 능력치에서 얼마나 앞서는가
export function trainGain(st: GameState, g: Gladiator, stat: 'atk' | 'def'): number { const d = doctorFor(st, g.type); const gap = d && d !== g ? d.base[stat] - g.base[stat] : 0; return 1 + gymBonus(st) + (gap >= CONFIG.doctorBonus.gapBig ? 2 : gap >= CONFIG.doctorBonus.gapSmall ? 1 : 0) + (st.lanista.trait === 'doctor' && st.lanista.type === g.type ? CONFIG.lanista.doctorTrainBonus : 0); }
// 기술 전수: 승수 8 이상 독토르의 같은 유형 제자
export function mentoredBy(st: GameState, g: Gladiator): Gladiator | undefined { const d = doctorFor(st, g.type); if (d && d !== g && d.wins >= CONFIG.doctorSkillWins) return d; return st.roster.find(x => x.status === 'doctor' && x !== g && (x.epithets ?? []).includes('magister')); } // '검투사이자 스승'은 모든 유형에게
export function doctorFor(st: GameState, type: Gladiator['type']): Gladiator | undefined { return st.roster.find(g => g.status === 'doctor' && g.type === type); }
// 자유민 → 독토르 고용 / 독토르 → 다시 출전(아욱토라투스) / 자유민 내보내기
export function hireDoctor(st: GameState, g: Gladiator) { if (g.status !== 'rudiarius') return; g.status = 'doctor'; grantEpithets(g); st.history.push(`${seasonName(st.season)}: ${g.name} 독토르 고용`); }
// 루디스 거절 (플람마): 자유를 물리고 노예로 남는다. 명예 +8
export function refuseRudis(st: GameState, g: Gladiator) { if (g.status !== 'rudiarius' || g.rudisSeason !== st.season) return; g.status = 'slave'; g.rudisSeason = undefined; { const e = (st.hall ?? []).find(x => x.name === g.name && x.season === st.season); if (e) e.how = 'refused'; } g.rudisRefused = (g.rudisRefused ?? 0) + 1; g.honor = Math.min(100, (g.honor ?? 0) + 8); st.history.push(`${seasonName(st.season)}: ${g.name} 루디스 거절 (${g.rudisRefused}회째)`); }
export function backToArena(st: GameState, g: Gladiator) { if (g.status !== 'doctor') return; g.status = 'rudiarius'; st.history.push(`${seasonName(st.season)}: ${g.name} 다시 출전 계약`); }
export function release(st: GameState, g: Gladiator) { if (!g.status || g.status === 'slave') return; st.roster = st.roster.filter(r => r !== g); st.history.push(`${seasonName(st.season)}: ${g.name} 루두스를 떠남`); }
// 이 계약을 지금 로스터로 받을 수 있는가 (인원·베테라누스 요건)
export function canFulfill(st: GameState, c: Contract, exclude: Set<number> = new Set()): boolean { const a = available(st).filter(g => !exclude.has(g.id)); return a.length >= c.size && a.filter(g => g.rank === 'veteranus').length >= c.needVeterans; } // exclude: 다른 계약에 이미 배정된 검투사 (그들을 빼고도 채울 수 있어야 '거절'이다)

export function priceOf(st: GameState, g: Gladiator): number { return st.lanista.trait === 'freedman' && st.market.includes(g) ? Math.round(g.buyPrice * (1 - CONFIG.lanista.freedmanDiscount)) : g.buyPrice; } // 해방노예 라니스타는 시장에서 값을 깎는다
export function canBuy(st: GameState, g: Gladiator): boolean { return st.money >= priceOf(st, g) && st.roster.length < rosterCap(st); } // 켈라이 차면 못 산다
const ORDINALS = ['', ' 세쿤두스', ' 테르티우스', ' 콰르투스', ' 퀸투스'];
// 루두스 안에서 이름이 겹치면 로마식 서수를 붙인다 (고증: 예명 중복은 흔했다)
function disambiguate(st: GameState, g: Gladiator) {
  const base = g.name.replace(/ (세쿤두스|테르티우스|콰르투스|퀸투스)$/, '');
  const taken = new Set([...st.roster, ...st.graveyard].map(r => r.name));
  for (const ord of ORDINALS) { const n = base + ord; if (!taken.has(n)) { g.name = n; return; } }
  g.name = base + ' ' + (st.roster.length + st.graveyard.length + 1);
}
// 리롤: 상인에게 수수료를 내고 다른 매물을 본다 (이번 시즌 이미 본 사람은 다시 안 나온다)
export function rerollMarket(st: GameState): boolean {
  if (st.money < CONFIG.market.reroll) return false; st.money -= CONFIG.market.reroll;
  const shown = new Set((st.rerolled ??= []).concat(st.market.map(g => g.castId!).filter(Boolean))); st.rerolled = [...shown];
  for (const g of st.market) if (g.castId) { const e = castState(st.cast, g.castId); const t = st.market.find(x => x.castId === g.castId)!.talent ?? 0; if (e.app >= CONFIG.market.maxApp[t]) e.gone = true; }
  st.market = drawMarket(st.rng, st.season, st.fame, st.cast, CONFIG.market.perSeason, shown); st.history.push(`${seasonName(st.season)}: 시장 리롤 ${CONFIG.market.reroll}`); return true;
}
export function buy(st: GameState, g: Gladiator): boolean {
  if (!canBuy(st, g)) return false;
  disambiguate(st, g);
  st.money -= priceOf(st, g); st.roster.push(g); st.market = st.market.filter(m => m !== g); st.applicants = st.applicants.filter(m => m !== g); if (g.castId) castState(st.cast, g.castId).taken = true;
  g.boughtSeason = st.season;
  if (g.origin === 'auctoratus') { g.status = 'rudiarius'; g.contractUntil = st.season + CONFIG.origins.auctoratus.term - 1; } // 자유민 계약자: 급료 받는 자유민, 계약 기간
  st.history.push(g.origin === 'auctoratus' ? `${seasonName(st.season)}: ${label(g)} 자유민 계약 (계약금 ${priceOf(st, g)})` : `${seasonName(st.season)}: ${label(g)} 들여옴 (${ORIGIN_KO[g.origin ?? 'slave']}, ${priceOf(st, g)} HS)`); // 검투사를 들인 일은 연혁의 특별한 일
  return true;
}
export function sell(st: GameState, g: Gladiator) {
  if (g.status && g.status !== 'slave') return; // 자유민은 팔 수 없다
  const p = sellPrice(g); st.money += p; st.roster = st.roster.filter(r => r !== g);
  st.history.push(`${seasonName(st.season)}: ${label(g)} 매각 ${p}`);
}
// 자질 = 훈련 상한. 남은 성장량 (0이면 더는 훈련이 안 된다)
export const talentCapOf = (g: Gladiator): number => CONFIG.talentCap[talentOf(g)];
export const trainLeft = (g: Gladiator): number => Math.max(0, talentCapOf(g) - (g.trainGain ?? 0));
// 훈련: 시즌당 1회, 공격 또는 방어 +1. 자질 상한까지만
export function train(st: GameState, g: Gladiator, stat: 'atk' | 'def'): boolean {
  if (g.trained || !g.alive || st.money < CONFIG.trainCost || trainedCount(st) >= trainCap(st) || trainLeft(g) <= 0) return false; // 훈련장 수용 인원 · 자질 상한
  let gain = trainGain(st, g, stat); // 같은 유형 독토르가 앞서는 만큼 추가
  if (st.rng.chance(TALENT_TRAIN_BONUS[talentOf(g)])) gain += 1; // 자질: 재능 35% · 비범 55% · 천부 70% 로 +1 더 (상한까지 빨리 오르는 속도)
  gain = Math.min(gain, trainLeft(g)); g.trainGain = (g.trainGain ?? 0) + gain;
  st.money -= CONFIG.trainCost; g.trained = true; g.base[stat] += gain; g.talentKnown = true; // 첫 훈련에서 자질이 밝혀진다
  st.history.push(`${seasonName(st.season)}: ${g.name} 훈련(${stat === 'atk' ? '공격' : '방어'} +${gain}) ${CONFIG.trainCost}`);
  { const d = doctorFor(st, g.type); if (d && d !== g && (d.honor ?? 0) >= 30) { const a = awaken(st.rng, g, `${d.name} 의 가르침`); if (a) st.history.push(`${seasonName(st.season)}: ${g.name} 자질을 깨우치다 (${TALENT_KO[a.from]} → ${TALENT_KO[a.to]}, ${a.why})`); } } // 명예 높은 독토르의 가르침은 깨우침의 계기
  return true;
}
// ── 시즌 행동 (편성에서 고르고 시즌 종료 때 실행)
export type Action = 'auto' | 'rest' | 'atk' | 'def' | 'skill' | 'show' | 'recover'; // auto: 자율 — 피로 2 이상이면 휴식, 1이면 휴식 포함 무작위, 아니면 공·방 중 무작위 훈련
export const ACTION_KO: Record<Action, string> = { auto: '자율', rest: '휴식', atk: '훈련·공', def: '훈련·방', skill: '기술 훈련', show: '시범', recover: '요양' };
export const AUTO_REST_FATIGUE = 2; // 자율에서 무조건 휴식하는 피로 기준 (1이면 휴식도 무작위 후보)
// 기술 훈련: 팔루스 자리를 쓰고 훈련비를 낸다. 같은 유형 독토르가 아는 기술(내가 모르는 것) 중 하나, 독토르가 없으면 훈련 시설 3단계부터 유형에 맞는 기술 하나를 확률로 깨친다 → 배울 기회(제안)
export function skillTrainable(st: GameState, g: Gladiator): { from: 'doctor' | 'gym'; pool: SkillId[] } | null {
  if (g.injured > 0 || g.status === 'doctor' || !g.alive) return null;
  const d = doctorFor(st, g.type); const pool = d && d !== g ? (d.skills ?? []).filter(id => skillFits(g, id as SkillId) && !hasSkill(g, id as SkillId)) as SkillId[] : [];
  if (pool.length) return { from: 'doctor', pool };
  if (st.ludus.gym >= CONFIG.skills.gymLevel) { const e = eligibleSkills(g).map(x => x.id); if (e.length) return { from: 'gym', pool: e }; }
  return null;
}
export function doSkillTrain(st: GameState, g: Gladiator): { id: SkillId; ok: boolean; from: 'doctor' | 'gym' } | null {
  const tr = skillTrainable(st, g); if (!tr || g.trained || st.money < CONFIG.trainCost || trainedCount(st) >= trainCap(st)) return null;
  st.money -= CONFIG.trainCost; g.trained = true;
  const id = st.rng.pick(tr.pool); const d = doctorFor(st, g.type);
  const p = (tr.from === 'doctor' ? CONFIG.skills.trainChance + (d && d.wins >= CONFIG.doctorSkillWins ? CONFIG.skills.masterBonus : 0) : CONFIG.skills.gymChance) + (st.lanista.trait === 'doctor' ? CONFIG.lanista.skillTrainBonus : 0); // 독토르 출신 라니스타는 가르칠 줄 안다
  const ok = st.rng.chance(p) && offerSkill(g, id);
  st.history.push(`${seasonName(st.season)}: ${g.name} 기술 훈련 ${SKILL_BY_ID[id].name} ${ok ? '깨침' : '실패'} ${CONFIG.trainCost}`);
  return { id, ok, from: tr.from };
}
export function doShow(st: GameState, g: Gladiator): { honor: number } | null {
  if (g.injured > 0 || g.status === 'doctor') return null;
  const honor = CONFIG.actions.show.honor; g.honor = Math.min(100, (g.honor ?? 0) + honor);
  st.history.push(`${seasonName(st.season)}: ${g.name} 시범 (명예 +${honor})`); return { honor };
}
export function doRecover(st: GameState, g: Gladiator): boolean {
  if (g.injured <= 0 || !inBed(st, g)) return false; g.injured = Math.max(0, g.injured - CONFIG.actions.recover.extra); // 침상에 누운 부상자만. endSeason 에서 한 번 더 −1
  st.history.push(`${seasonName(st.season)}: ${g.name} 요양`); return true;
}
export const ORIGIN_KO: Record<NonNullable<Gladiator['origin']>, string> = { slave: '노예 상인', captive: '전쟁 포로', damnatus: '형벌 죄수', auctoratus: '자유민 계약' };
export function renewCost(g: Gladiator): number { return Math.round(g.buyPrice * CONFIG.origins.auctoratus.renew); }
export function renewContract(st: GameState, g: Gladiator): boolean {
  if (g.status !== 'rudiarius' || g.contractUntil == null || st.money < renewCost(g)) return false;
  st.money -= renewCost(g); g.contractUntil = Math.max(g.contractUntil, st.season) + CONFIG.origins.auctoratus.term;
  st.history.push(`${seasonName(st.season)}: ${g.name} 재계약 ${renewCost(g)}`); return true;
}
// 유형 전환(재훈련): 헤르메스처럼 여러 무장을 익힌다. 비용을 내고 그 시즌은 훈련장에 매인다. 능력치는 새 유형의 속도·사거리를 따르고 공·방은 유지
export function retrain(st: GameState, g: Gladiator, type: GType): boolean {
  if (type === g.type || g.injured > 0 || g.status === 'doctor' || g.fought || st.money < CONFIG.retrainCost || !g.alive) return false;
  st.money -= CONFIG.retrainCost; const from = g.type; g.type = type; g.base.spd = TYPE_STATS[type].spd; g.base.range = TYPE_STATS[type].range; g.fought = true; g.trained = true;
  g.skills = (g.skills ?? []).filter(id => skillFits(g, id as SkillId)); g.skillOffers = (g.skillOffers ?? []).filter(id => skillFits(g, id as SkillId)); // 무장에 묶인 기술은 새 유형에서 못 쓴다
  st.history.push(`${seasonName(st.season)}: ${g.name} 유형 전환 ${TYPE_LABEL[from]} → ${TYPE_LABEL[type]} ${CONFIG.retrainCost}`); return true;
}
export function heal(st: GameState, g: Gladiator): boolean {
  const cost = healCostOf(st); if (g.injured === 0 || st.money < cost) return false;
  st.money -= cost; g.injured = 0; pruneBeds(st); return true;
}

export function fightExpense(team: Gladiator[], tier: number): number { const rent = team.reduce((s, g) => s + rentFee(g, tier), 0); return Math.round(rent * CONFIG.fightExpense.rentRate + tier * CONFIG.fightExpense.perTier); }
// 졸업전(간판내기) 계약. 조건: 그 집이 나타났고 졸업 전 · 간판을 뺀 로스터 전원을 내가 쓰러뜨려 봄 · 간판 생존·부상 없음 · 등급 3 도장은 등급 3 주최자(호감도) · 켈라에 빈 칸. 시즌당 1건, 도장 순서가 앞선 집부터
export function canChallenge(st: GameState, r: Rival): { ok: boolean; why?: string } {
  const def = rivalDef(r); if (!def) return { ok: false, why: '정의 없음' };
  if (r.graduated) return { ok: false, why: '졸업' };
  const star = r.roster.find(g => g.id === r.starId); if (!star || !star.alive) return { ok: false, why: '간판 없음' }; if (star.injured > 0) return { ok: false, why: '간판 부상' };
  if (!def.visitor) { const p = challengeProgress(r); if (p.total === 0 || p.beaten < p.total) return { ok: false, why: `꺾은 사람 ${p.beaten}/${p.total}` }; } // 방문단은 오자마자 걸어온다
  if (def.challenge.tier === 3 && st.fame < CONFIG.fameTierReq[3]) return { ok: false, why: `호감도 ${CONFIG.fameTierReq[3]} 필요 (큰 경기 주최자)` };
  return { ok: true };
}
// 판돈으로 넘어온 간판을 내 로스터로. 켈라가 없으면 약속(pledged)만 남기고 빈 칸이 생기는 시즌에 온다
function takeStar(st: GameState, rv: Rival, star: Gladiator, injured = false): boolean {
  if (st.roster.length >= rosterCap(st)) { star.pledged = true; return false; }
  rv.roster = rv.roster.filter(x => x !== star); star.pledged = undefined; star.status = 'slave'; star.origin = 'slave'; star.boughtSeason = st.season; star.fought = true; if (injured) star.injured = Math.max(star.injured, 2); star.lostToMe = undefined; star.buyPrice = valueOf(star); star.talentKnown = true; disambiguate(st, star); st.roster.push(star);
  st.history.push(`${seasonName(st.season)}: 간판 ${star.name} 이(가) 판돈으로 우리 루두스에 왔다`); return true;
}
function claimPledged(st: GameState) { for (const rv of st.rivals) for (const g of [...rv.roster]) if (g.pledged && g.alive) { if (!takeStar(st, rv, g)) break; } } // 켈라가 비었으면 기다리던 간판이 온다
function offerChallenge(st: GameState) {
  const cands = st.rivals.filter(r => canChallenge(st, r).ok).sort((a, b) => dojoOrder(a) - dojoOrder(b));
  for (const r of cands) {
    const def = rivalDef(r)!; const star = r.roster.find(g => g.id === r.starId)!;
    const escorts = r.roster.filter(g => g.alive && g.injured === 0 && g.id !== r.starId && g.id !== r.secondId).sort((a, b) => powerOf(b) - powerOf(a)).slice(0, def.challenge.size - 1); // 간판 + 소속 (두 번째는 안 나온다: 이름 있는 사람은 간판 하나)
    if (escorts.length < def.challenge.size - 1) continue;
    const tier = def.challenge.tier; const host = tier === 3 ? 'imperial' : 'candidate'; const enemy = [star, ...escorts];
    r.challengeSince ??= st.season;
    st.contracts.push({ id: nextContractId(), tier, venue: venueFor(st.rng, tier), host, needVeterans: 0, size: def.challenge.size, enemy, enemyPreview: enemy.map(e => e.type), rivalId: r.id, clauses: offerClauses(st.rng, host, tier).filter(id => id !== 'sine_missione'), accepted: [], challenge: { rivalId: r.id } }); // 시네 미시오네는 뺀다 (간판을 죽이면 판돈이 사라진다)
    st.history.push(`${seasonName(st.season)}: ${r.name} 이(가) 간판 ${star.name} 을(를) 걸고 졸업전을 제안했다`);
    return;
  }
}
export function validTeam(st: GameState, c: Contract, team: Gladiator[]): string | null {
  if (team.length !== c.size) return `${c.size}명이 필요합니다`;
  if (c.challenge && c.challenge.stakeId != null && !team.some(g => g.id === c.challenge!.stakeId)) return '판돈으로 건 검투사가 팀에 없습니다'; // 판돈을 아직 안 골랐으면 출전 때 가장 약한 사람으로
  if (team.some(g => g.fought)) return '이번 시즌 이미 출전한 검투사가 있습니다 (시즌당 1회)';
  if (team.some(g => !g.alive || g.injured > 0)) return '출전 불가 검투사가 포함되어 있습니다';
  if (new Set(team).size !== team.length) return '중복';
  const vets = team.filter(g => g.rank === 'veteranus').length;
  if (vets < c.needVeterans) return `베테라누스 ${c.needVeterans}명 이상 필요`;
  return null;
}

export function fight(st: GameState, c: Contract, team: Gladiator[]): FightReport {
  const err = validTeam(st, c, team); if (err) throw new Error(err);
  if (c.challenge && (c.size === 1 || !team.some(g => g.id === c.challenge!.stakeId))) c.challenge.stakeId = [...team].sort((a, b) => powerOf(a) - powerOf(b))[0].id; // 1대1은 출전자가 곧 판돈. 안 골랐으면 가장 약한 사람
  const grudges: FightReport['grudges'] = [];
  for (const g of team) for (const e of c.enemy) if ((g.spared ?? []).includes(e.id)) grudges.push({ mine: g, enemy: e }); // 살려 준 상대와의 재대결
  const boosted = new Set(grudges.map(x => x.enemy.id));
  const res = battle(st.rng, team, c.enemy, { mentored: new Set(team.filter(g => mentoredBy(st, g)).map(g => g.id)), hpBonusA: st.ludus.kitchen * CONFIG.ludus.kitchen.hpPerLevel, boostedB: boosted, boostMul: CONFIG.grudge.atk });
  const syn = computeSynergies(team);
  const classic = classicMatchup(team.map(g => g.type), c.enemy.map(g => g.type)) || (c.size === 1 && (team[0].epithets ?? []).includes('omnia_solus')); // 만능 검투사는 어떤 짝이든 볼거리
  const HK = HOST[c.host];
  const rent = Math.round(team.reduce((s, g) => s + rentFee(g, c.tier), 0) * HK.rent); // 인색한 유지는 깎고 황제는 후하다
  const expense = fightExpense(team, c.tier);
  const won = res.winner === 'A';
  const acc = acceptedOf(c); const sine = acc.includes('sine_missione'); const clauseMul = acc.reduce((m, id) => m * CLAUSES[id].prizeMul, 1); // 특약: 상금 배율 (차양 −10%, 시네 미시오네 +50%)
  const basePrize = Math.round(CONFIG.prizePerTier * c.tier * HK.prize * clauseMul);
  const guestGift = won && c.guest ? CONFIG.events.guests.gift : 0; // 초대했던 귀족의 경기를 이기면 사례금
  let prize = won ? basePrize : 0;
  let bet: FightReport['bet'];
  if (acc.includes('sponsio') && HK.bet) { if (won) { prize *= 2; bet = { won: true, amount: basePrize }; } else if (res.winner === 'B') { st.money -= basePrize; bet = { won: false, amount: basePrize }; } } // 스폰시오: 이기면 두 배, 지면 물어낸다
  let compensation = 0;
  const fates: FightReport['fates'] = [];
  const promoted: Gladiator[] = []; const rudis: Gladiator[] = [];
  const enemyHasRet = c.enemy.some(e => e.type === 'retiarius');
  const alliesAllDown = res.downed.A.length >= team.length - 1; // 나 말고 전부 쓰러짐
  // 즉사: 쓰러뜨린 타격이 그 자리에서 목숨을 앗는다 (판정 없음). 치명타면 확률이 높다. 승리 측 쓰러진 검투사도 해당
  const instantDeath = (id: number) => { const ev = [...res.events].reverse().find(e => e.kind === 'attack' && e.downed && e.target === id); const ID = CONFIG.missio.instantDeath; return st.rng.chance(ev?.crit ? ID.crit : ID.base); };
  const killMine = (g: Gladiator, how: string) => { g.alive = false; if ((g.status ?? 'slave') === 'slave') compensation += Math.round((valueOf(g) * CONFIG.deathComp.priceMult + g.wins * CONFIG.deathComp.perWin) * (g.origin === 'damnatus' ? CONFIG.origins.damnatus.comp : 1)); st.graveyard.push(g); st.roster = st.roster.filter(r => r !== g); st.history.push(`${seasonName(st.season)}: ${g.name} ${c.venue}에서 ${how} (${g.wins}승/${g.fights}전)`); };
  for (const g of team) {
    g.fights++; g.fought = true;
    const downed = res.downed.A.includes(g);
    if (downed && instantDeath(g.id)) { killMine(g, '상처로 즉사'); fates.push({ g, fate: 'dead', wound: true }); if (res.winner === 'B') g.streak = 0; continue; } // 쓰러지는 순간 죽었다: 승패 기록만 남기고 판정은 없다
    if (won) { g.streak = (g.streak ?? 0) + 1; if (!(g.typesWon ??= []).includes(g.type)) g.typesWon.push(g.type); if (enemyHasRet) g.retiariusWins = (g.retiariusWins ?? 0) + 1; if (!downed && team.length > 1 && alliesAllDown) g.soloWins = (g.soloWins ?? 0) + 1;
      if (g.rank === 'tiro' && c.size === 1 && c.enemy[0].rank === 'veteranus' && c.enemy[0].wins >= 10) g.tiroUpset = true; } // 아틸리우스: 신참이 노장을 꺾다
    else if (res.winner === 'B') g.streak = 0;
    else g.draws = (g.draws ?? 0) + 1; // 스탄테스 미시
    if (won) {
      g.wins++;
      if (maybePromote(g)) { promoted.push(g); st.history.push(`${seasonName(st.season)}: ${g.name} 베테라누스 승격 (${c.venue})`); }
      if ((g.status ?? 'slave') === 'slave' && g.wins >= CONFIG.rudis.wins && !downed) { // 루디스: 주최자가 자유를 내린다
        const p = CONFIG.rudis.base + st.fame * CONFIG.rudis.perFame + HK.rudis;
        if (st.rng.chance(p)) { g.status = 'rudiarius'; g.rudisSeason = st.season; rudis.push(g); hallAdd(st, g, 'rudis'); st.history.push(`${seasonName(st.season)}: ${g.name} 루디스 수여 — 자유 (${c.venue}, ${HOST[c.host].ko})`); }
      }
      if (downed) { const f = judgeWinnerDowned(st.rng); if (f === 'injured') { g.injured = injurySeasons(st); g.injuries = (g.injuries ?? 0) + 1; } fates.push({ g, fate: f }); }
      else fates.push({ g, fate: 'unharmed' });
    } else if (downed) {
      const grudged = grudges.some(x => x.mine === g);
      let appeal = 0; if (hasSkill(g, 'appeal') && st.rng.chance(procChance(g, 'appeal'))) { appeal = 0.10; addMastery(g, 'appeal'); res.events.push({ t: res.duration, turn: res.turns, kind: 'skill', actor: g.id, skill: 'appeal' }); } // 관중호소
      const { fate, p } = sine ? { fate: 'dead' as Fate, p: 0 } : judgeLoser(st.rng, g, st.fame, c.host, syn, classic, (st.events?.votum ? CONFIG.events.votum.missio : 0) + (grudged ? CONFIG.grudge.missio : 0) + (CONFIG.missio.tierBonus[c.tier] ?? 0) + appeal); // 시네 미시오네: 판정 없이 죽는다 // 등급이 낮은 지방 경기일수록 주최자가 배상을 꺼려 살려 준다
      if (fate === 'dead') killMine(g, '처형됨'); // 판정에서 죽음 (이우굴라). 자유민은 재산이 아니라 배상 없음
      else { g.missios++; if (fate === 'injured') { g.injured = injurySeasons(st); g.injuries = (g.injuries ?? 0) + 1; } } // 의무실 없으면 2 = 이번 시즌 남은 계약 + 다음 시즌
      fates.push({ g, fate, p }); // 판정 사망은 처형 (즉사는 위에서)
    } else fates.push({ g, fate: 'unharmed' });
  }
  const lastHp = (id: number) => { const fr = res.frames[res.frames.length - 1]; const u = fr?.u.find(x => x[0] === id); return u ? u[3] : 0; }; // 경기 끝 HP (프레임: [id, x, y, hp])
  for (const g of team) { if (st.rng.chance(st.ludus.herbs * CONFIG.ludus.herbs.skipFatiguePer)) continue;
    const F = CONFIG.fatigue; const clean = won && !res.downed.A.includes(g) && lastHp(g.id) >= res.initialHp[g.id] * F.cleanWinHp; // 가벼운 경기: 쓰러지지 않고 HP 70%↑ 남기며 이김
    const p = Math.max(0, (clean ? F.chanceClean : F.chanceHard) - cellQuality(st, g) * F.perCellStar); // 좋은 숙소일수록 피로가 덜 쌓인다
    if (st.rng.chance(p)) g.fatigue = Math.min(F.max, (g.fatigue ?? 0) + 1); } // 피로는 판정이 끝난 뒤에 쌓인다. 약재가 있으면 면제 확률
  { const rv = rivalOf(st.rivals, c.rivalId); if (rv) { rv.vsMe ??= { wins: 0, losses: 0, draws: 0 }; if (won) rv.vsMe.losses++; else if (res.winner === 'B') rv.vsMe.wins++; else rv.vsMe.draws++; } } // 파밀리아 상대 전적
  // 상대 파밀리아에 결과 반영: 이긴 상대는 전적·명예, 쓰러진 상대는 실제 판정 (사망이면 명단에서 사라진다)
  const enemyFates: FightReport['enemyFates'] = []; const revenges: FightReport['revenges'] = [];
  const enemySyn = computeSynergies(c.enemy);
  for (const e of c.enemy) {
    const m = memberById(st.rivals, e.id); const live = m ? m.g : e; // 저장 후에는 객체가 다르므로 id 로 찾는다
    const downed = res.downed.B.some(d => d.id === e.id);
    live.fights++; if (downed) live.lostToMe = (live.lostToMe ?? 0) + 1; // 졸업전 조건: 그 집 검투사를 전부 쓰러뜨려 봤는가
    if (downed && instantDeath(e.id)) { live.alive = false; if (m) m.rival.roster = m.rival.roster.filter(x => x !== live); enemyFates.push({ g: e, fate: 'dead', wound: true }); continue; } // 상대도 쓰러지는 순간 죽을 수 있다
    if (res.winner === 'B') { live.wins++; live.streak = (live.streak ?? 0) + 1; live.honor = Math.min(100, (live.honor ?? 0) + 3); maybePromote(live);
      for (const g of team) if (res.downed.A.includes(g)) { (g.beatenBy ??= []); if (!g.beatenBy.includes(live.id)) g.beatenBy.push(live.id); } }
    else if (won) { live.streak = 0;
      for (const g of team) if ((g.beatenBy ?? []).includes(live.id) && !res.downed.A.includes(g)) { revenges.push({ mine: g, enemy: e }); g.revenged = (g.revenged ?? 0) + 1; g.beatenBy = g.beatenBy!.filter(x => x !== live.id); g.honor = Math.min(100, (g.honor ?? 0) + CONFIG.grudge.revengeHonor); }
    }
    if (downed && won) {
      const { fate } = sine ? { fate: 'dead' as Fate } : judgeLoser(st.rng, live, st.fame, c.host, enemySyn, classic, (CONFIG.missio.tierBonus[c.tier] ?? 0) + (hasSkill(live, 'appeal') && st.rng.chance(procChance(live, 'appeal')) ? 0.10 : 0));
      enemyFates.push({ g: e, fate });
      if (fate === 'dead') { live.alive = false; if (m) m.rival.roster = m.rival.roster.filter(x => x !== live); }
      else { live.missios++; if (fate === 'injured') live.injured = 2; for (const g of team) if (!res.downed.A.includes(g)) { (g.spared ??= []); if (!g.spared.includes(live.id)) g.spared.push(live.id); } } // 살려 준 상대를 기억한다
    } else if (downed) enemyFates.push({ g: e, fate: 'unharmed' });
  }
  // 졸업전 정산: 이기면 졸업 + 간판 이적(살아 있을 때), 지면 판돈 검투사가 그 집으로. 무승부는 아무 일 없음. 미시오는 별개 — 간판이 사고로 죽으면 명예·호감도만
  let challenge: FightReport['challenge'];
  if (c.challenge) {
    const rv = rivalOf(st.rivals, c.challenge.rivalId);
    if (rv) {
      const star = rv.roster.find(g => g.id === rv.starId); const starDied = !!star && !star.alive;
      if (won) {
        rv.graduated = st.season; st.history.push(`${seasonName(st.season)}: ${rv.name} 졸업 — 간판내기 승리`);
        let gained: Gladiator | undefined; let noRoom = false;
        if (star && star.alive) {
          if (takeStar(st, rv, star, enemyFates.find(f => f.g.id === star.id)?.fate === 'injured')) gained = star;
          else { noRoom = true; st.history.push(`${seasonName(st.season)}: 켈라가 가득 차 간판 ${star.name} 은(는) 빈 칸이 날 때까지 기다린다`); }
        }
        promoteStar(rv); challenge = { rival: rv, won: true, graduated: true, gained, starDied, noRoom };
        if (rivalDef(rv)?.visitor) { st.over = true; st.reason = '황제 루두스 초청'; st.invited = st.season; st.history.push(`${seasonName(st.season)}: 황제 루두스의 초청장 — 로마로`); } // 1회차 엔딩
      } else if (res.winner === 'B') {
        const mine = team.find(g => g.id === c.challenge!.stakeId); let lost: Gladiator | undefined;
        if (mine && mine.alive) { st.roster = st.roster.filter(r => r !== mine); mine.cell = undefined; pruneBeds(st); mine.status = 'slave'; mine.fought = true; mine.lostToMe = undefined; mine.boughtSeason = st.season; rv.roster.push(mine); lost = mine; st.history.push(`${seasonName(st.season)}: 판돈 ${mine.name} 을(를) ${rv.name} 에 빼앗겼다`); }
        promoteStar(rv); challenge = { rival: rv, won: false, graduated: false, lost, starDied };
      } else { promoteStar(rv); challenge = { rival: rv, won: false, graduated: false, starDied }; }
    }
  }
  let fameDelta = 0;
  const F = CONFIG.fame;
  if (challenge?.won) fameDelta += CONFIG.challenge.fameWin; else if (challenge && res.winner === 'B') fameDelta += CONFIG.challenge.fameLose; // 도장 승리는 계단, 패배는 소문이 반대로
  const baseFame = Math.round((won ? F.win * c.tier + (classic ? F.classic : 0) + (c.host === 'candidate' && team.some(g => fansOf(g) >= FANS_STAR) ? 1 : 0) : res.winner === 'B' ? F.lose : 0) * HK.fameMul); // 승리 +2×등급, 전통 짝 +1, 선거 후보는 스타가 나온 경기에 표가 모인다. 주최자 배율
  fameDelta += baseFame;
  if (HK.honorAll) for (const g of team) if (g.alive) g.honor = Math.min(100, (g.honor ?? 0) + HK.honorAll); // 장례 경기: 출전 자체가 기록에 남는다
  const H = CONFIG.honor; const crowned = won && (c.tier >= 2 || classic); // 주최자 만족 = 화관: 큰 경기나 전통 짝 승리
  if (crowned) for (const g of team) if (g.alive) g.crowns = (g.crowns ?? 0) + 1;
  if (team.some(g => (g.epithets ?? []).includes('martia'))) fameDelta += 1; // '군신의 기쁨': 출전만으로 관중이 온다
  for (const id of acc) fameDelta += CLAUSES[id].fame; // 차양·살수: 관중이 몰린다
  if (won) for (const id of acc) if (CLAUSES[id].winnerHonor) for (const g of team) if (g.alive && !res.downed.A.includes(g)) g.honor = Math.min(100, (g.honor ?? 0) + CLAUSES[id].winnerHonor); // 시네 미시오네 승자 명예
  const evHonor = (st.events?.cena ? CONFIG.events.cena.honor : 0) + (st.events?.pompa ? CONFIG.events.pompa.honor : 0) + (st.events?.edicta ? CONFIG.events.edicta.honor : 0); // 행사: 만찬·행렬·벽화에 이름이 오른 검투사
  // 기술 숙련(발동 횟수)과 경험으로 생기는 배울 기회
  const newSkillOffers: FightReport['newSkillOffers'] = [];
  for (const [idS, uses] of Object.entries(res.skillUses ?? {})) { const id = Number(idS); const g = team.find(x => x.id === id) ?? memberById(st.rivals, id)?.g ?? c.enemy.find(x => x.id === id); if (g) for (const [sk, n] of Object.entries(uses)) addMastery(g, sk as SkillId, n); }
  for (const g of team) { if (!g.alive) continue; const x = res.exp?.[g.id]; if (!x) continue; const cand: SkillId[] = [];
    if (x.blockedOn >= 3) cand.push('feint'); if (x.blocks >= 3) cand.push('shield_bash'); if (x.wonAfterBlock && won) cand.push('riposte'); if (x.comboKill) cand.push('twin_cut'); if (x.netKill) cand.push('net_recover'); if (x.meleeKill) cand.push('spear_ward'); if (x.lowHp) { cand.push('stand_firm'); cand.push('second_wind'); } if (x.chargeKill) cand.push('charge_plus');
    if (fates.find(f => f.g === g && f.fate !== 'dead' && res.downed.A.includes(g))) cand.push('appeal');
    for (const id of cand) if (skillFits(g, id) && !hasSkill(g, id) && st.rng.chance(Math.min(0.9, CONFIG.skills.expChance * TALENT_SKILL_MUL[talentOf(g)])) && offerSkill(g, id)) newSkillOffers.push({ g, id }); } // 자질이 높을수록 경험으로 기술을 잘 깨친다
  const newEpithets: FightReport['newEpithets'] = [];
  for (const g of team) { if (!g.alive) continue; for (const e of grantEpithets(g)) { newEpithets.push({ g, e }); st.history.push(`${seasonName(st.season)}: ${g.name} 별칭 '${e.name}' 을 얻다`); } if (won && (g.epithets ?? []).includes('suspirium')) g.honor = Math.min(100, (g.honor ?? 0) + 2); }
  for (const g of team) { if (!g.alive) continue; const d = evHonor + (won ? H.win + (c.tier - 1) * H.perTier + (classic ? H.classic : 0) + (crowned ? H.crown : 0) : res.winner === 'B' ? H.lose : 0); g.honor = Math.max(0, Math.min(100, (g.honor ?? 0) + d)); }
  st.fame = Math.max(0, Math.min(100, st.fame + fameDelta));
  const salary = team.filter(g => g.status === 'rudiarius').reduce((a, g) => a + Math.round(rentFee(g, c.tier) * CONFIG.rudiariusShare), 0); // 자유민 급료
  st.money += rent + prize + compensation - expense - salary + guestGift;
  st.contracts = st.contracts.filter(x => x !== c);
  st.history.push(`${seasonName(st.season)}: ${c.venue} ${won ? '승' : res.winner === 'draw' ? '무' : '패'} 대여 ${rent} 경비 -${expense}${salary ? ` 급료 -${salary}` : ''} 상금 ${prize} 배상 ${compensation}`);
  // 자질 깨우침: 열세에서 이김 · 미시오로 살아난 뒤 첫 승리 · 5승·10승 달성. 첫 경기에서 자질이 밝혀진다
  const awakened: FightReport['awakened'] = [];
  { const mine = team.reduce((a, g) => a + powerOf(g), 0) / team.length, theirs = c.enemy.reduce((a, g) => a + powerOf(g), 0) / c.enemy.length; const underdog = won && mine < theirs * 0.9;
    for (const g of team) { if (!g.alive) continue; g.talentKnown = true; const stood = !res.downed.A.includes(g);
      let why = ''; if (won && stood && underdog) why = '열세를 뒤집은 승리'; else if (won && stood && g.lastMissio) why = '미시오 뒤의 첫 승리'; else if (won && stood && (g.wins === 5 || g.wins === 10)) why = `${g.wins}승`;
      if (why) { const a = awaken(st.rng, g, why); if (a) { awakened.push({ g, ...a }); st.history.push(`${seasonName(st.season)}: ${g.name} 자질을 깨우치다 (${TALENT_KO[a.from]} → ${TALENT_KO[a.to]}, ${a.why})`); } }
      g.lastMissio = fates.some(f => f.g === g && f.fate !== 'dead' && res.downed.A.includes(g)) ? true : (won && stood ? false : g.lastMissio); } }
  return { contract: c, team, winner: res.winner, turns: res.turns, log: res.log, events: res.events, frames: res.frames, duration: res.duration, initialHp: res.initialHp, downed: res.downed.A, newSkillOffers, awakened, bet, clauses: acc, guestGift, rent, expense, salary, prize, compensation, fates, promoted, fameDelta, classic, rudis, newEpithets, enemyFates, grudges, revenges, challenge };
}

// 남은 계약 거절. 벌점은 시즌당 1회, 그리고 실제로 받을 수 있었던 계약이 있을 때만 (인원·베테라누스 부족은 벌점 없음)
// 거절 벌점: 받을 수 있었던 '중요한' 계약(등급 2·3 — 큰 지방 경기·로마)을 안 치렀을 때만 시즌당 1회. 등급 1 소규모 무누스는 거절해도 벌점 없음
export const isImportant = (c: Contract) => c.tier >= 2;
export function refuseAll(st: GameState): number {
  const penalized = st.fame >= CONFIG.fame.refuseFrom && st.contracts.some(c => isImportant(c) && canFulfill(st, c)); // 아직 이름이 없을 때(호감도 40 미만)는 거절해도 벌점 없음
  const d = penalized ? CONFIG.fame.refuse : 0;
  st.fame = Math.max(0, st.fame + d);
  st.contracts = [];
  return d;
}

// 시즌 종료: 유지비, 부상 회복, 호감도 망각, 다음 시즌
export function endSeason(st: GameState): { upkeep: number; gift: number } {
  const upkeep = upkeepOf(st); // 독토르는 급료
  st.money -= upkeep;
  let gift = 0;
  if (st.events?.guests) { st.guestPromise = true; const shown = st.roster.filter(g => g.alive && g.status !== 'doctor' && g.injured === 0); for (const g of shown) g.honor = Math.min(100, (g.honor ?? 0) + CONFIG.events.guests.honor); } // 귀족 손님: 연습을 본 손님이 이름을 기억하고 다음 시즌 경기 계약을 들고 온다. 사례금은 그 경기를 이겼을 때 (fight 의 guestGift)
  for (const g of st.roster) for (const e of grantEpithets(g)) st.history.push(`${seasonName(st.season)}: ${g.name} 별칭 '${e.name}' 을 얻다`); // 시즌 종료: 독토르·명예 조건 등 경기 밖 별칭
  const freedNow: Gladiator[] = [], leftNow: Gladiator[] = [];
  for (const g of st.roster) {
    if (g.origin === 'damnatus' && (g.status ?? 'slave') === 'slave' && g.boughtSeason != null && st.season - g.boughtSeason + 1 >= CONFIG.origins.damnatus.freeAfter) { g.status = 'rudiarius'; g.rudisSeason = st.season; freedNow.push(g); hallAdd(st, g, 'damnatus'); st.history.push(`${seasonName(st.season)}: ${g.name} 형기 만료 — 자유`); }
    if (g.status === 'rudiarius' && g.contractUntil != null && st.season >= g.contractUntil) leftNow.push(g);
  }
  for (const g of leftNow) { st.roster = st.roster.filter(r => r !== g); st.history.push(`${seasonName(st.season)}: ${g.name} 계약 만료로 떠남`); }
  // 과로사: 피로가 4 이상인 채 시즌을 넘기면 (피로−3)×12% 로 쓰러져 죽는다 (혹사)
  const F = CONFIG.fatigue; const overworked = st.roster.filter(g => (g.fatigue ?? 0) >= F.overworkAt && st.rng.chance(((g.fatigue ?? 0) - F.overworkAt + 1) * F.overworkPer));
  for (const g of overworked) { g.alive = false; st.graveyard.push(g); st.roster = st.roster.filter(r => r !== g); st.history.push(`${seasonName(st.season)}: ${g.name} 혹사 끝에 쓰러져 죽다 (피로 ${g.fatigue})`); }
  st.lastLeft = leftNow.map(g => g.name); st.lastFreed = freedNow.map(g => g.name); st.lastOverwork = overworked.map(g => g.name);
  const evFame = (st.events?.cena ? CONFIG.events.cena.fame : 0) + (st.events?.pompa ? CONFIG.events.pompa.fame : 0) + (st.events?.guests ? CONFIG.events.guests.fame : 0);
  st.fame = Math.max(0, Math.min(100, st.fame + evFame));
  const recoverSet = new Set(st.roster.filter(g => g.injured > 0 && inBed(st, g))); st.lastNoBed = st.roster.filter(g => g.injured > 0 && !recoverSet.has(g)).map(g => g.name); // 침상에 누운 부상자만 낫는다. 눕지 않은 부상자는 이번 시즌 회복 없음
  for (const g of st.roster) { const q = cellQuality(st, g); if (g.injured > 0 && recoverSet.has(g)) g.injured--; if (!g.fought) g.fatigue = Math.max(0, (g.fatigue ?? 0) - (q >= 1 ? 2 : 1)); if (q >= 3) g.honor = Math.min(100, (g.honor ?? 0) + 1); g.fought = false; g.trained = false; } // 쉰 검투사는 피로 회복 (좋은 숙소는 −2), 최고 숙소는 명예 +1
  pruneBeds(st); // 나은 사람은 침상에서 내려온다
  const decay = Math.round(st.fame * CONFIG.fame.decayRate); st.lastDecay = decay; // 망각: 현재값의 5% (높을수록 빨리 잊힌다 → 평형점)
  st.fame = Math.max(0, st.fame - decay);
  if (st.money < 0) { st.over = true; st.reason = '파산'; return { upkeep, gift }; }
  if (CONFIG.seasons > 0 && st.season >= CONFIG.seasons) { st.over = true; st.reason = `${CONFIG.seasons}시즌 완료`; return { upkeep, gift }; }
  st.season++;
  if ((st.season - 1) % 4 === 0) { // 새해: 모두 한 살. 라니스타는 정해진 나이에 은퇴하거나, 55세부터 해마다 병으로 물러날 수 있다
    for (const g of st.roster) g.age = (g.age ?? 22) + 1;
    st.lanista.age++;
    if (!st.pendingSuccession && mustRetire(st)) retire(st, false); // 46세(세니오레스) 의무 계승
    else if (!st.pendingSuccession && st.rng.chance(mortality(st.lanista.age))) retire(st, true); // 나이별 사망 확률 (낮게: 사고)
  }
  startSeason(st);
  return { upkeep, gift };
}

export function score(st: GameState): number {
  return st.money + st.roster.reduce((s, g) => s + sellPrice(g), 0) + st.fame * 100;
}

// ---------- 회차 종료 (docs/08 2·4절): 루두스를 황제 루두스에 매각하고 후계자와 검투사 둘(+방문단 간판)이 로마로 떠난다. 다음 회차가 읽을 계승 데이터 ----------
export interface Legacy { v: 1; season: number; sale: number; lanista: string; heir: { name: string; age: number; trait: Lanista['trait']; type?: GType; honor: number }; gladiators: Gladiator[]; graduated: string[]; graveyard: string[]; hall: HallEntry[] }
export const saleValue = (st: GameState): number => score(st); // 매각 금액 = 자금 + 검투사 매각가 + 호감도×100 (엔딩 점수)
export function makeLegacy(st: GameState, heir: SuccessorOption, picks: Gladiator[]): Legacy {
  const visitorStar = st.roster.find(g => g.name === '갈루스' && g.castId == null); const gl = [...picks]; if (visitorStar && !gl.includes(visitorStar)) gl.push(visitorStar); // 방문단 간판은 데려가는 둘과 별도로 따라간다
  return { v: 1, season: st.season, sale: saleValue(st), lanista: st.lanista.name, heir: { name: heir.from ? heir.from.name : st.rng.pick(LANISTA_NAMES), age: heir.from?.age ?? st.rng.int(34, 42), trait: heir.trait, type: heir.type, honor: heir.from?.honor ?? 0 }, gladiators: gl.map(g => ({ ...g, fought: false, trained: false, cell: undefined, injured: 0, fatigue: 0 })), graduated: st.rivals.filter(r => r.graduated).map(r => r.name), graveyard: st.graveyard.map(g => g.name), hall: st.hall ?? [] };
}
// ---------- 저장 ----------
export interface SaveData { v: 1; rng: number; season: number; money: number; fame: number; roster: Gladiator[]; graveyard: Gladiator[]; contracts: Contract[]; market: Gladiator[]; history: string[]; over: boolean; reason?: string; nextId: number; ludus?: unknown; events?: SeasonEvents; applicants?: Gladiator[]; rivals?: Rival[]; lanista?: Lanista; pendingSuccession?: boolean; lineageLog?: string[]; hall?: HallEntry[]; guestPromise?: boolean; cast?: CastBook; invited?: number; }
export function serialize(st: GameState): SaveData {
  return { v: 1, rng: st.rng.state, season: st.season, money: st.money, fame: st.fame, roster: st.roster, graveyard: st.graveyard, contracts: st.contracts, market: st.market, history: st.history, over: st.over, reason: st.reason, nextId: peekNextId(), ludus: st.ludus, events: st.events, applicants: st.applicants, rivals: st.rivals, lanista: st.lanista, pendingSuccession: st.pendingSuccession, lineageLog: st.lineageLog, hall: st.hall, guestPromise: st.guestPromise, cast: st.cast, invited: st.invited };
}
// 구 저장(cells 숫자·infirmary·yard) → 새 구조
// 옛 저장의 파밀리아: 지정 간판·두 번째가 없으면 새로 만들어 끼우고 정원(6)을 넘는 소속은 약한 순으로 뺀다. 이미 나타난 집은 사슬과 무관하게 남는다
function migrateRivals(rng: Rng, rivals: Rival[], season: number): Rival[] {
  return rivals.map(r0 => {
    const r: Rival = { ...r0, vsMe: r0.vsMe ?? { wins: 0, losses: 0, draws: 0 } }; const def = rivalDef(r);
    if (def && r.starId == null) { const star = makeStar(rng, season, def), second = makeSecond(rng, season, def); r.roster = [star, second, ...r.roster.sort((a, b) => powerOf(b) - powerOf(a))].slice(0, 6); r.starId = star.id; r.secondId = second.id; }
    for (const g of r.roster) g.boughtSeason ??= 1;
    return r;
  });
}
function migrateLudus(l: unknown): Ludus {
  if (!l || typeof l !== 'object') return newLudus();
  const o = l as Record<string, unknown>;
  if (Array.isArray(o.cells)) { const L = { ...newLudus(), ...(o as unknown as Ludus) } as Ludus & { stands?: number }; delete L.stands; if (!Array.isArray(L.bedsUse)) L.bedsUse = []; return L; }
  const n = typeof o.cells === 'number' ? o.cells : 0, inf = typeof o.infirmary === 'number' ? o.infirmary : 0, yd = typeof o.yard === 'number' ? o.yard : 0;
  const L = newLudus(); L.cells = Array(CONFIG.ludus.cells.start + n * CONFIG.ludus.cells.per).fill(0); L.beds = inf >= 1 ? 2 : 1; L.medicine = inf * 2; L.palus = [2, 4, 6][yd] ?? 2; return L;
}
export function deserialize(d: SaveData): GameState {
  const rng = new Rng(1); rng.state = d.rng;
  setNextId(d.nextId);
  const contracts = d.contracts.map(c => ({ ...c, host: migrateHost(c.host as string), size: (c.size ?? c.enemy.length) as 1 | 2 | 3 })); // 구 저장: size 없음
  for (const g of [...d.roster, ...d.market, ...(d.applicants ?? []), ...contracts.flatMap(c => c.enemy)]) if (g.age == null) g.age = g.rank === 'tiro' ? 20 : 27; // 구 저장: 나이 없음
  return { cast: d.cast ?? {}, invited: d.invited, rng, season: d.season, money: d.money, fame: d.fame, roster: d.roster, graveyard: d.graveyard, contracts, market: d.market, applicants: d.applicants ?? [], rivals: migrateRivals(rng, d.rivals ?? makeRivals(rng, d.season), d.season), lanista: d.lanista ? { name: d.lanista.name, age: d.lanista.age, trait: d.lanista.trait, type: d.lanista.type, since: d.lanista.since, dead: d.lanista.dead } : makeLanista(rng, d.season), pendingSuccession: d.pendingSuccession, lineageLog: d.lineageLog, guestPromise: d.guestPromise, hall: d.hall ?? d.roster.filter(g => g.status === 'rudiarius' || g.status === 'doctor').map(g => ({ name: g.name, type: g.type, wins: g.wins, fights: g.fights, honor: g.honor ?? 0, season: g.rudisSeason ?? d.season, epithets: [...(g.epithets ?? [])], how: 'rudis' as const })), history: d.history, over: d.over && !(CONFIG.seasons === 0 && /시즌 완료$/.test(d.reason ?? '')), reason: CONFIG.seasons === 0 && /시즌 완료$/.test(d.reason ?? '') ? undefined : d.reason /* 시즌 제한이 있던 옛 저장의 '12시즌 완료' 종료는 되살린다 */, ludus: migrateLudus(d.ludus), events: { cena: false, pompa: false, votum: false, edicta: false, guests: false, ...(d.events ?? {}) } };
}

// 계약 난이도 표시: 상대 전력 ÷ 내 최선 팀(같은 인원, 출전 가능한 검투사 중 상위) 전력. 0.85 미만 약함 · 1.15 초과 강함
export function difficultyOf(st: GameState, c: Contract): { ratio: number; label: 'weak' | 'even' | 'strong' } | null {
  const mine = st.roster.filter(g => g.alive && g.status !== 'doctor').sort((a, b) => powerOf(b) - powerOf(a)).slice(0, c.size);
  if (mine.length < c.size) return null;
  const ratio = teamPower(c.enemy) / Math.max(1, teamPower(mine));
  return { ratio, label: ratio < 0.85 ? 'weak' : ratio > 1.15 ? 'strong' : 'even' };
}
