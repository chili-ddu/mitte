import type { Contract, Gladiator, GType, ClauseId } from './types.js';
import { Rng } from './rng.js';
import { CONFIG } from './config.js';
import { battle } from './battle.js';
import { judgeLoser, judgeWinnerDowned, type Fate } from './missio.js';
import { offerContracts, resetContractIds, makeChallenge, challengeSize } from './contracts.js';
import { offerMarket, offerApplicants } from './market.js';
import { equipOf } from './equipment.js';
import { TYPES } from './gladiator.js';
import { label, maybePromote, rentFee, resetIds, sellPrice, valueOf, peekNextId, setNextId, makeGladiator } from './gladiator.js';
import { classicMatchup, canPairFrom } from './classic.js';
import { traitLevelsOf } from './traits.js';
import { TYPE_KO as TYPE_LABEL, TYPE_STATS } from './gladiator.js';
import { grantEpithets, type EpithetDef } from './epithets.js';
import { RIVAL_DEFS, makeRivals, replenishRivals, arriveRivals, memberById, rivalOf, rivalStar, recordVsMe, bumpMood, compareRival, type Rival } from './rivals.js';
import { HOST, migrateHost, FANS_STAR } from './hosts.js';
import { CLAUSES, acceptedOf } from './clauses.js';
import { awaken, talentOf, TALENT_KO, TALENT_TRAIN_BONUS } from './talent.js';
import { fansOf, powerOf, teamPower } from './gladiator.js';
export { rivalOf, memberById, rivalStar, recordVsMe, compareRival };

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
  mounted: Record<number, number>; // 말 탄 검투사가 내린 시각 (에퀘스 — 화면이 그 전까지 말을 그린다)
  classic: boolean;      // 정식 대결 계약이었는가 (호감도 +2, 미시오 +5%, 상금 ×1.4)
  rudis: Gladiator[];    // 이 경기에서 루디스(자유)를 받은 검투사
  newEpithets: { g: Gladiator; e: EpithetDef }[]; // 이 경기로 얻은 별칭
  bet?: { won: boolean; amount: number }; // 스폰시오 결과
  clauses: ClauseId[]; // 받아들인 특약
  awakened: { g: Gladiator; from: number; to: number; why: string }[]; // 이 경기로 자질을 깨우친 검투사
  guestGift: number;   // 귀족 사례금 (초대했던 귀족의 경기를 이겼을 때)
  enemyFates: { g: Gladiator; fate: Fate; wound?: boolean }[]; // 상대 쓰러진 검투사의 운명 (실제 판정)
  grudges: { mine: Gladiator; enemy: Gladiator }[]; // 이번 경기의 원한 재대결
  revenges: { mine: Gladiator; enemy: Gladiator }[]; // 복수 성공
}

export interface GameState {
  color?: string;       // 우리 파밀리아 색 (새 게임에서 고른 벽화 안료). 화면이 스틱맨·초상·이름표에 쓴다
  formTeam?: number;    // 이번 철 파밀리아 전체의 분위기 −1~1 (검투사마다의 몸 상태에 절반 섞인다)
  rng: Rng;
  season: number;      // 1..12
  money: number;
  fame: number;
  roster: Gladiator[];
  graveyard: Gladiator[];
  contracts: Contract[];
  market: Gladiator[];
  marketRerolls?: number; // 이번 시즌 상인을 다시 부른 횟수 (CONFIG.market.reroll.perSeason 까지)
  applicants: Gladiator[]; // 루두스 문 앞의 자유민 지원자 (시즌마다 갱신)
  rivals: Rival[];     // 상대 파밀리아 (시즌을 넘어 유지)
  pendingChallenges: Contract[]; // 이번 시즌 들어온 도전장 — 수락하면 contracts 로, 거절하면 그쪽 기세 +1 (docs/10)
  challengeSent?: number;        // 이번 시즌 우리가 도전장을 보낸 파밀리아 (시즌당 하나)
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
export interface HallEntry { name: string; type: GType; wins: number; fights: number; honor: number; season: number; epithets: string[]; how: 'rudis' | 'damnatus' | 'refused' }
export function hallAdd(st: GameState, g: Gladiator, how: HallEntry['how']) { (st.hall ??= []).push({ name: g.name, type: g.type, wins: g.wins, fights: g.fights, honor: g.honor ?? 0, season: st.season, epithets: [...(g.epithets ?? [])], how }); }
export interface Lanista { name: string; age: number; trait: 'founder' | 'freedman' | 'doctor'; type?: GType; since: number; dead?: boolean }
const LANISTA_NAMES = ['가이우스 바티아투스', '루키우스 아우렐리우스', '마르쿠스 아티우스', '퀸투스 카시우스', '티투스 플라비우스', '푸블리우스 살비우스', '그나이우스 포르키우스', '데키무스 마밀리우스'];
export function makeLanista(rng: Rng, season: number): Lanista { const L = CONFIG.lanista; return { name: rng.pick(LANISTA_NAMES), age: rng.int(L.ageMin, L.ageMax), trait: 'founder', since: season }; }
// 해마다 죽을 확률 (나이 구간표)
export function mortality(age: number): number { for (const [upto, p] of CONFIG.lanista.mortality) if (age < upto) return p; return 0.14; }
export function canRetire(st: GameState): boolean { return st.lanista.age >= CONFIG.lanista.voluntaryAge; }
export interface SuccessorOption { key: string; label: string; desc: string; from?: Gladiator; trait: Lanista['trait']; type?: GType }
export function successorOptions(st: GameState): SuccessorOption[] {
  const out: SuccessorOption[] = st.roster.filter(g => g.status === 'doctor').map(g => ({ key: `doc-${g.id}`, label: `${g.name} (독토르, ${TYPE_LABEL[g.type]})`, desc: `전직 검투사. ${TYPE_LABEL[g.type]} 훈련 +${CONFIG.lanista.doctorTrainBonus}. 명예 ${g.honor ?? 0} 만큼 호감도 계승에 보탬`, from: g, trait: 'doctor', type: g.type }));
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

export interface Ludus { cells: number[]; kitchen: number; beds: number; medicine: number; herbs: number; palus: number; gym: number; bedsUse: (number | null)[]; palusUse: (number | null)[] } // cells: 칸별 숙소 질(0~3). palusUse: 팔루스마다 세운 검투사 id (훈련 자리). bedsUse: 침상마다 누운 검투사 id (부상자를 라니스타가 직접 눕힌다)
export function newLudus(): Ludus { return { cells: Array(CONFIG.ludus.cells.start).fill(0), kitchen: 0, beds: CONFIG.ludus.beds.start, medicine: 0, herbs: 0, palus: CONFIG.ludus.palus.start, gym: 0, bedsUse: [], palusUse: [] }; }
// 침상: 누운 부상자만 시즌 말에 낫고 요양도 할 수 있다. 여러 명이 한 시즌에 다치면 누구를 눕힐지 라니스타가 고른다
export function bedPatient(st: GameState, slot: number): Gladiator | null { const id = st.ludus.bedsUse?.[slot]; if (id == null) return null; const g = st.roster.find(x => x.id === id); return g && g.injured > 0 ? g : null; }
export function inBed(st: GameState, g: Gladiator): boolean { return (st.ludus.bedsUse ?? []).slice(0, st.ludus.beds).includes(g.id) && g.injured > 0; }
export function putInBed(st: GameState, g: Gladiator, slot: number): boolean { if (g.injured <= 0 || slot < 0 || slot >= st.ludus.beds) return false; const u = (st.ludus.bedsUse ??= []); for (let i = 0; i < u.length; i++) if (u[i] === g.id) u[i] = null; u[slot] = g.id; return true; }
export function pruneBeds(st: GameState) { const u = (st.ludus.bedsUse ??= []); for (let i = 0; i < u.length; i++) { const id = u[i]; if (id == null) continue; const g = st.roster.find(x => x.id === id); if (!g || g.injured <= 0) u[i] = null; } }
// 팔루스 배정: 훈련은 훈련장의 팔루스(기둥) 자리에 검투사를 세워서 한다 — 침상과 같은 모델. 자리 수 = 시설(palus)이라 훈련 인원이 상한을 넘을 수 없다. 시즌이 지나도 그대로 서 있고, 다치거나 떠나거나 독토르가 되면 내려온다
export function palusTrainee(st: GameState, slot: number): Gladiator | null { const id = st.ludus.palusUse?.[slot]; if (id == null) return null; const g = st.roster.find(x => x.id === id); return g && g.alive && g.injured <= 0 && g.status !== 'doctor' ? g : null; }
export function palusOf(st: GameState, g: Gladiator): number { const i = (st.ludus.palusUse ?? []).slice(0, st.ludus.palus).indexOf(g.id); return i >= 0 && g.alive && g.injured <= 0 && g.status !== 'doctor' ? i : -1; } // 서 있는 팔루스 번호, 없으면 −1
export function putAtPalus(st: GameState, g: Gladiator, slot: number): boolean { if (!g.alive || g.injured > 0 || g.status === 'doctor' || slot < 0 || slot >= st.ludus.palus) return false; const u = (st.ludus.palusUse ??= []); for (let i = 0; i < u.length; i++) if (u[i] === g.id) u[i] = null; u[slot] = g.id; return true; }
export function leavePalus(st: GameState, g: Gladiator) { const u = (st.ludus.palusUse ??= []); for (let i = 0; i < u.length; i++) if (u[i] === g.id) u[i] = null; }
export function prunePalus(st: GameState) { const u = (st.ludus.palusUse ??= []); for (let i = 0; i < u.length; i++) { const id = u[i]; if (id == null) continue; const g = st.roster.find(x => x.id === id); if (!g || !g.alive || g.injured > 0 || g.status === 'doctor') u[i] = null; } }
export function palusTrainees(st: GameState): Gladiator[] { return Array.from({ length: st.ludus.palus }, (_, i) => palusTrainee(st, i)).filter((g): g is Gladiator => !!g); }
export function rosterCap(st: GameState): number { return st.ludus.cells.length; }
// 켈라 칸 번호: 검투사마다 저장(`g.cell`). 없거나 겹치면 가장 앞의 빈 칸을 준다
export function cellOf(st: GameState, g: Gladiator): number {
  const used = new Set(st.roster.filter(x => x !== g && x.cell != null).map(x => x.cell!));
  if (g.cell != null && g.cell < st.ludus.cells.length && !used.has(g.cell)) return g.cell;
  let k = 0; while (used.has(k)) k++; g.cell = k; return k;
}
export function occupantOf(st: GameState, k: number): Gladiator | undefined { return st.roster.find(g => cellOf(st, g) === k); }
export function cellQuality(st: GameState, g: Gladiator): number { const i = cellOf(st, g); return i >= 0 && i < st.ludus.cells.length ? st.ludus.cells[i] : 0; }
// 과로사 확률: 피로가 쌓일수록 가파르게 (2026-09-17 사용자: 가중치를 주자). 화면도 이 함수를 그대로 쓴다
export function overworkChance(fatigue: number): number { const F = CONFIG.fatigue; const n = fatigue - F.overworkAt + 1; return n <= 0 ? 0 : Math.min(F.overworkCap, F.overworkPer * n * (1 + (n - 1) * F.overworkRamp)); }
export function injurySeasons(st: GameState): number { const I = CONFIG.injury, r = st.rng.next(); const s = r < I.mild ? 1 : r < I.mild + I.mid ? 2 : 3; return Math.max(1, s - (st.ludus.medicine >= CONFIG.ludus.medicine.injuryAt ? I.medicineCut : 0)); } // 상처의 무게를 굴린다 — 중상이면 세 시즌을 눕는다 // 침상은 여기가 아니라 시즌 말 회복 인원 상한으로 작용한다
export function healCostOf(st: GameState): number { const M = CONFIG.ludus.medicine; return M.healCostByLevel[Math.min(st.ludus.medicine, M.healCostByLevel.length - 1)]; }
export function injuryChanceOf(st: GameState): number { const M = CONFIG.ludus.medicine; return M.injuryChanceByLevel[Math.min(st.ludus.medicine, M.injuryChanceByLevel.length - 1)]; } // 내 검투사가 쓰러진 뒤 부상 확률 (의술 4·5단계에서 내려간다)
export function trainCap(st: GameState): number { return st.ludus.palus; }
export function trainedCount(st: GameState): number { return st.roster.filter(g => g.trained).length; }
export function gymBonus(st: GameState): number { return CONFIG.ludus.gym.bonusAt.filter(a => st.ludus.gym >= a).length; }
// 시설 유지비: 증축 칸 + 숙소 ★ + 조리장·침상·의술·약재·팔루스·훈련 시설 단계
export function facilityUpkeep(st: GameState): number { const U = CONFIG.upkeepFacility, L = CONFIG.ludus, u = st.ludus; return Math.max(0, u.cells.length - L.cells.start) * U.cell + u.cells.reduce((a, q) => a + q, 0) * U.star + u.kitchen * U.kitchen + Math.max(0, u.beds - L.beds.start) * U.bed + u.medicine * U.medicine + u.herbs * U.herbs + u.palus * U.palus /* 팔루스는 기본 2개부터 유지비 (2026-09-16): 훈련 회당 요금을 없애고 훈련장을 유지하는 값으로 */ + u.gym * U.gym; }
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
  if (f === 'cells') for (let k = 0; k < CONFIG.ludus.cells.per && st.ludus.cells.length < CONFIG.ludus.cells.max; k++) st.ludus.cells.push(0); // 마지막 증축은 상한(15)에 맞춰 1칸만
  else if (f === 'cell') st.ludus.cells[idx]++;
  else st.ludus[f]++;
  st.history.push(`${seasonName(st.season)}: ${FACILITY_KO[f]}${f === 'cell' ? ` ${idx + 1}번 칸` : ''} ${cost}`);
  return true;
}
// 검투사를 다른 칸으로 옮긴다 (로스터 순서 교환)
// 검투사를 k번 켈라로 옮긴다: 그 칸에 누가 있으면 서로 자리를 바꾼다
export function moveToCell(st: GameState, g: Gladiator, k: number) { if (k < 0 || k >= st.ludus.cells.length) return; const from = cellOf(st, g); const o = occupantOf(st, k); if (o && o !== g) o.cell = from; g.cell = k; }
export function swapCells(st: GameState, a: number, b: number) { const ga = occupantOf(st, a), gb = occupantOf(st, b); if (ga) ga.cell = b; if (gb) gb.cell = a; }

export function newGame(seed: number, opts: { types?: GType[]; color?: string } = {}): GameState {
  resetIds(); resetContractIds();
  const rng = new Rng(seed);
  const st: GameState = { rng, season: 1, money: CONFIG.startMoney, fame: CONFIG.startFame, roster: [], graveyard: [], contracts: [], market: [], applicants: [], rivals: makeRivals(rng, 1, CONFIG.startFame), pendingChallenges: [], history: [], over: false, ludus: newLudus(), lanista: makeLanista(rng, 1) };
  st.color = opts.color; // 고르지 않으면 화면의 기본 색
  const used = new Set<string>(); /* 시작 검투사 둘은 주무기가 겹치지 않게 (2026-09-18 사용자: 유형을 고르는 설정은 없앴다 — 물려받는 것이지 고르는 것이 아니다) */
  for (let i = 0; i < CONFIG.startGladiators; i++) { const free = TYPES.filter(t => !used.has(equipOf(t).main)); const type = opts.types?.[i] ?? rng.pick(free); used.add(equipOf(type).main); const g = makeGladiator(rng, 'tiro', { type }); g.rank = 'veteranus'; g.wins = rng.int(3, 6); for (const k of ['hp', 'atk', 'def', 'hand'] as const) g.base[k] = Math.round(g.base[k] * CONFIG.startBoost); /* 2026-09-20: 승수 성장(승당 +2%)을 뺀 만큼 시작 검투사 기본치를 한 번 올린다. 베테라누스 폭으로 굴리면 등급 1 상한(160)을 넘어 첫 시즌이 74% 가 됐다 */ g.fights = g.wins + rng.int(0, 2); g.buyPrice = valueOf(g); g.origin = 'slave'; g.boughtSeason = 1; disambiguate(st, g); st.roster.push(g); } /* 능력치는 갓 들어온 자의 폭으로 굴리되 전적은 여느 검투사의 기본값(3~6승·0~2패) — 처음부터 '일반 검투사'다 (2026-09-17 사용자) — 선택은 개성이지 힘이 아니다 */ // 전임자에게 물려받은 검투사
  startSeason(st);
  return st;
}

// 이번 철의 몸 상태: 파밀리아 공통분(그 철 우리 분위기)과 개인분을 섞는다. 시즌이 시작될 때 한 번 굴려 두므로 배정 화면에서 미리 보인다
export function rollForm(st: GameState, g: Gladiator) { g.form = (st.formTeam ?? 0) * CONFIG.form.team + st.rng.range(-1, 1) * (1 - CONFIG.form.team); }
function rollForms(st: GameState) { st.formTeam = st.rng.range(-1, 1); for (const g of st.roster) if (g.alive) rollForm(st, g); }
export function startSeason(st: GameState) {
  rollForms(st); // 몸 상태는 계약이 나오기 전에 정해 둔다 (배정할 때 보고 고른다)
  st.events = { cena: false, pompa: false, votum: false, edicta: false, guests: false };
  for (const r of arriveRivals(st.rng, st.rivals, st.season, st.fame)) st.history.push(`${seasonName(st.season)}: ${r.name} 이(가) 이 지방에 나타났다`); // 호감도가 오르면 큰 루두스가 온다
  for (const n of replenishRivals(st.rng, st.rivals, st.season)) st.history.push(`${seasonName(st.season)}: ${n}`); // 파밀리아 살림: 금고·기세·보이지 않는 경기 (docs/10)
  st.contracts = offerContracts(st.rng, st.season, st.fame, st.rivals, st.roster); // 내 전력 기준 약·중·중·강
  st.pendingChallenges = offerChallenges(st); st.challengeSent = undefined; // 파밀리아가 우리를 지목한다
  if (st.guestPromise && st.contracts.length) { st.contracts[0].host = 'candidate'; st.contracts[0].guest = true; st.guestPromise = false; st.history.push(`${seasonName(st.season)}: 초대했던 귀족이 선거 경기 계약을 들고 왔다 (${st.contracts[0].venue})`); } // 귀족 손님 초대의 인연
  st.market = offerMarket(st.rng, st.season); st.marketRerolls = 0;
  st.applicants = offerApplicants(st.rng, st.season, st.fame);
}

// ── 도전 계약 (docs/10)
const CH = () => CONFIG.challenge;
// 시즌 시작: 파밀리아마다 기세·복수로 도전장을 낼지 정한다 (시즌당 최대 하나)
function offerChallenges(st: GameState): Contract[] {
  const out: Contract[] = [];
  const order = [...st.rivals].sort(() => st.rng.next() - 0.5);
  for (const r of order) { if (out.length) break; if ((r.silentUntil ?? 0) >= st.season) continue;
    const revenge = r.revengeDue === st.season; const p = revenge ? CH().revengeP : CH().chanceBase + (r.mood ?? 0) * CH().chanceMood;
    if (!st.rng.chance(Math.max(0, p))) continue;
    const c = makeChallenge(st.rng, st.season, r, 'in', challengeSize(r)); if (!c) continue; out.push(c); r.revengeDue = undefined;
    st.history.push(`${seasonName(st.season)}: ${r.name}이(가) ${revenge ? '복수의 ' : ''}도전장을 보냈다 (${c.size}대${c.size}, ${c.venue})`); }
  return out;
}
export function acceptChallenge(st: GameState, c: Contract): string | null {
  if (!st.pendingChallenges.includes(c)) return '이미 답한 도전장';
  if (!canFulfill(st, c)) return `${c.size}명을 세울 수 없다`;
  st.pendingChallenges = st.pendingChallenges.filter(x => x !== c); st.contracts.push(c); st.history.push(`${seasonName(st.season)}: ${rivalOf(st.rivals, c.rivalId)?.name ?? '상대'}의 도전을 받았다`); return null;
}
export function declineChallenge(st: GameState, c: Contract) {
  if (!st.pendingChallenges.includes(c)) return; st.pendingChallenges = st.pendingChallenges.filter(x => x !== c);
  const r = rivalOf(st.rivals, c.rivalId); if (r) { bumpMood(r, CH().refuseMood); r.refused = (r.refused ?? 0) + 1; st.history.push(`${seasonName(st.season)}: ${r.name}의 도전을 피했다 — 그들이 우리를 얕본다`); }
}
export const challengeFee = (st: GameState, r: Rival) => Math.round(CONFIG.prizePerTier * (r.profile === 'grand' ? 3 : r.profile === 'major' ? 2 : 1) * CH().feeRate); // 섭외비: 그 격의 상금 × 비율
export const canSendChallenge = (st: GameState, r: Rival) => st.challengeSent == null && st.money >= challengeFee(st, r) && (r.silentUntil ?? 0) < st.season && !st.contracts.some(c => c.challenge && c.rivalId === r.id) && st.contracts.filter(c => c.challenge).length < CH().maxPerSeason && !!pickEliteOf(r, 1);
const pickEliteOf = (r: Rival, n: 1 | 2 | 3) => r.roster.filter(g => g.alive && g.injured === 0).length >= n ? r.roster : null;
// 우리가 도전장을 보낸다: 섭외비를 내고, 파밀리아가 곧 답한다 — 기세와 전력 비교로. 받으면 계약(필수 배정), 피하면 섭외비 반환·우리 호감도 +1
export function sendChallenge(st: GameState, r: Rival, size: 1 | 2 | 3 = 1): { accepted: boolean; contract?: Contract; text: string } {
  const fee = challengeFee(st, r); st.money -= fee; st.challengeSent = r.id;
  const cmp = compareRival(r, st.roster.filter(g => g.alive && g.status !== 'doctor')); // 'strong' = 그쪽이 세다
  const p = CH().acceptBase + (r.mood ?? 0) * CH().acceptMood + (cmp === 'weak' ? CH().acceptWeak : cmp === 'strong' ? CH().acceptStrong : 0);
  const c = st.rng.chance(p) ? makeChallenge(st.rng, st.season, r, 'out', size) : null;
  if (c) { st.contracts.push(c); st.history.push(`${seasonName(st.season)}: ${r.name}이(가) 우리 도전을 받았다 (${c.size}대${c.size}, ${c.venue}) — 섭외비 ${fee}`); return { accepted: true, contract: c, text: `${r.name}이(가) 도전을 받았다. ${c.venue}에서 ${c.size}대${c.size}` }; }
  st.money += fee; st.fame = Math.min(100, st.fame + 1); st.history.push(`${seasonName(st.season)}: ${r.name}이(가) 우리 도전을 피했다 (호감도 +1)`);
  return { accepted: false, text: `${r.name}이(가) 도전을 피했다. 섭외비는 돌려받았고, 사람들이 이야기한다 (호감도 +1)` };
}
// 시즌이 시작될 때 배정하지 않은 도전 계약: 걸어 놓고 안 나가면 기세를 더 올린다 (2026-09-20 사용자: 막기보다 벌로). 받은 도전장 미출전 = 기세 +1, 우리가 건 것 = 기세 +2 · 호감도 −2 (섭외비는 이미 냈다)
export function forfeitChallenges(st: GameState, unassigned: Contract[]): string[] {
  const out: string[] = [];
  for (const c of unassigned) { if (!c.challenge) continue; const r = rivalOf(st.rivals, c.rivalId); if (!r) continue;
    if (c.challenge === 'out') { bumpMood(r, 2); st.fame = Math.max(0, st.fame - 2); out.push(`${r.name}에게 걸어 놓은 도전에 나가지 않았다 — 그들의 기세가 크게 올랐고 우리 이름이 깎였다 (호감도 −2)`); }
    else { bumpMood(r, 1); r.refused = (r.refused ?? 0) + 1; out.push(`${r.name}의 도전을 받아 놓고 나가지 않았다 — 그들이 우리를 얕본다`); }
    st.history.push(`${seasonName(st.season)}: ${out[out.length - 1]}`); }
  return out;
}
export function available(st: GameState): Gladiator[] { return st.roster.filter(g => g.alive && g.injured === 0 && !g.fought && g.status !== 'doctor'); }
// 훈련 폭: 기본 1 + 같은 유형 독토르가 해당 능력치에서 얼마나 앞서는가
export function trainHpRange(st: GameState): [number, number] { const b = 1 + gymBonus(st); return [CONFIG.trainHpGain[0] * b, CONFIG.trainHpGain[1] * b]; } // 체력 훈련은 폭이 있다 — 미리 보여 줄 땐 범위로
export function trainGain(st: GameState, g: Gladiator, stat: TrainStat): number { if (stat === 'hp') { const [lo, hi] = trainHpRange(st); return Math.round((lo + hi) / 2); } /* 예상치(가운데). 실제 상승은 train() 이 굴린다 */ const d = doctorFor(st, g.type); const gap = d && d !== g ? d.base[stat] - g.base[stat] : 0; return CONFIG.trainGainBase + gymBonus(st) + (gap >= CONFIG.doctorBonus.gapBig ? 2 : gap >= CONFIG.doctorBonus.gapSmall ? 1 : 0) + (st.lanista.trait === 'doctor' && st.lanista.type === g.type ? CONFIG.lanista.doctorTrainBonus : 0); }
// 기술 전수: 승수 8 이상 독토르의 같은 유형 제자
export function doctorFor(st: GameState, type: Gladiator['type']): Gladiator | undefined { return st.roster.find(g => g.status === 'doctor' && g.type === type); }
// 자유민 → 독토르 고용 / 독토르 → 다시 출전(아욱토라투스) / 자유민 내보내기
export function hireDoctor(st: GameState, g: Gladiator) { if (g.status !== 'rudiarius') return; g.status = 'doctor'; grantEpithets(g); st.history.push(`${seasonName(st.season)}: ${g.name} 독토르 고용`); }
// 루디스 거절 (플람마): 자유를 물리고 노예로 남는다. 명예 +8
export function refuseRudis(st: GameState, g: Gladiator) { if (g.status !== 'rudiarius' || g.rudisSeason !== st.season) return; g.status = 'slave'; g.rudisSeason = undefined; { const e = (st.hall ?? []).find(x => x.name === g.name && x.season === st.season); if (e) e.how = 'refused'; } g.rudisRefused = (g.rudisRefused ?? 0) + 1; g.honor = Math.min(100, (g.honor ?? 0) + 8); st.history.push(`${seasonName(st.season)}: ${g.name} 루디스 거절 (${g.rudisRefused}회째)`); }
export function backToArena(st: GameState, g: Gladiator) { if (g.status !== 'doctor') return; g.status = 'rudiarius'; st.history.push(`${seasonName(st.season)}: ${g.name} 다시 출전 계약`); }
export function release(st: GameState, g: Gladiator) { if (!g.status || g.status === 'slave') return; st.roster = st.roster.filter(r => r !== g); st.history.push(`${seasonName(st.season)}: ${g.name} 루두스를 떠남`); }
// 이 계약을 지금 로스터로 받을 수 있는가 (인원·베테라누스 요건)
export function canFulfill(st: GameState, c: Contract, exclude: Set<number> = new Set()): boolean { const a = available(st).filter(g => !exclude.has(g.id)); return a.length >= c.size && a.filter(g => g.rank === 'veteranus').length >= c.needVeterans && (!c.classic || canPairFrom(a.map(g => g.type), c.enemy.map(e => e.type))); } // 정식 대결은 짝이 될 유형이 있어야 한다 // exclude: 다른 계약에 이미 배정된 검투사 (그들을 빼고도 채울 수 있어야 '거절'이다)

export function priceOf(st: GameState, g: Gladiator): number { return st.lanista.trait === 'freedman' && st.market.includes(g) ? Math.round(g.buyPrice * (1 - CONFIG.lanista.freedmanDiscount)) : g.buyPrice; } // 해방노예 라니스타는 시장에서 값을 깎는다
// 상인을 다시 부른다: 값을 치르고 판매대를 새로 뽑는다, 시즌당 정해진 횟수 (2026-09-18 3단계 — 같은 유형을 모으는 길)
export const rerollsLeft = (st: GameState) => CONFIG.market.reroll.perSeason - (st.marketRerolls ?? 0);
export const canReroll = (st: GameState) => !st.over && rerollsLeft(st) > 0 && st.money >= CONFIG.market.reroll.cost;
export function rerollMarket(st: GameState): boolean {
  if (!canReroll(st)) return false;
  st.money -= CONFIG.market.reroll.cost; st.marketRerolls = (st.marketRerolls ?? 0) + 1; st.market = offerMarket(st.rng, st.season);
  st.history.push(`${seasonName(st.season)}: 상인을 다시 불렀다 (${CONFIG.market.reroll.cost} HS, 매물 ${st.market.length}명)`); return true;
}
export function canBuy(st: GameState, g: Gladiator): boolean { return st.money >= priceOf(st, g) && st.roster.length < rosterCap(st); } // 켈라이 차면 못 산다
const ORDINALS = ['', ' 세쿤두스', ' 테르티우스', ' 콰르투스', ' 퀸투스'];
// 루두스 안에서 이름이 겹치면 로마식 서수를 붙인다 (고증: 예명 중복은 흔했다)
function disambiguate(st: GameState, g: Gladiator) {
  const base = g.name.replace(/ (세쿤두스|테르티우스|콰르투스|퀸투스)$/, '');
  const taken = new Set([...st.roster, ...st.graveyard].map(r => r.name));
  for (const ord of ORDINALS) { const n = base + ord; if (!taken.has(n)) { g.name = n; return; } }
  g.name = base + ' ' + (st.roster.length + st.graveyard.length + 1);
}
export function buy(st: GameState, g: Gladiator): boolean {
  if (!canBuy(st, g)) return false;
  disambiguate(st, g);
  st.money -= priceOf(st, g); rollForm(st, g); st.roster.push(g); /* 철 중간에 들어와도 그 철의 몸 상태를 받는다 */ st.market = st.market.filter(m => m !== g); st.applicants = st.applicants.filter(m => m !== g);
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
// 훈련: 시즌당 1회, 공격 또는 방어 +1
// 출전한 검투사가 훈련까지 겸하면 피로가 쌓일 수 있다 (숙소가 좋으면 덜). 출전만 하면 능력치가 안 오르니 격차가 벌어지던 문제의 답: 싸우면서도 단련하되 몸값을 치른다
export function trainFatigue(st: GameState, g: Gladiator): boolean {
  if (!g.fought) return false; const F = CONFIG.fatigue; const p = Math.max(0, F.trainAfterFight - cellQuality(st, g) * F.perCellStar);
  if (!st.rng.chance(p)) return false; g.fatigue = Math.min(F.max, (g.fatigue ?? 0) + 1); st.history.push(`${seasonName(st.season)}: ${g.name} 출전 뒤 훈련으로 피로 +1`); return true;
}
import { pickTrainStat, type TrainStat } from './gladiator.js';
export { pickTrainStat, type TrainStat }; // 팔루스에서 단련하는 것 셋 (2026-09-17 사용자: 체력도 오른다)
export function train(st: GameState, g: Gladiator, stat: TrainStat): boolean {
  if (g.trained || !g.alive || st.money < CONFIG.trainCost || trainedCount(st) >= trainCap(st)) return false; // 훈련장 수용 인원
  let gain = stat === 'hp' ? st.rng.int(...trainHpRange(st)) : trainGain(st, g, stat); // 체력은 범위에서 굴리고, 공·방은 독토르가 앞서는 만큼 더한다
  if (st.rng.chance(TALENT_TRAIN_BONUS[talentOf(g)])) gain += stat === 'hp' ? CONFIG.trainHpGain[0] : 1; // 자질: 재능 35% · 비범 55% · 천부 70% 로 한 단계 더
  st.money -= CONFIG.trainCost; g.trained = true; g.base[stat] += gain; g.talentKnown = true; // 첫 훈련에서 자질이 밝혀진다
  trainFatigue(st, g);
  st.history.push(`${seasonName(st.season)}: ${g.name} 훈련(${TRAIN_KO[stat]} +${gain})`);
  { const d = doctorFor(st, g.type); if (d && d !== g && (d.honor ?? 0) >= 30) { const a = awaken(st.rng, g, `${d.name} 의 가르침`); if (a) st.history.push(`${seasonName(st.season)}: ${g.name} 자질을 깨우치다 (${TALENT_KO[a.from]} → ${TALENT_KO[a.to]}, ${a.why})`); } } // 명예 높은 독토르의 가르침은 깨우침의 계기
  return true;
}
// ── 시즌 행동 (편성에서 고르고 시즌 종료 때 실행)
export const TRAIN_KO: Record<TrainStat, string> = { atk: '공격', def: '방어', hp: '체력', hand: '손놀림' };
export type Action = 'rest' | 'show' | 'recover' | 'atk' | 'def' | 'hp' | 'hand'; // 플레이어가 고르는 것은 rest·show·recover. 훈련은 팔루스에 세워서 하고 무엇을 단련할지는 무작위(공·방·체력) — atk·def·hp 는 정산 표시용 (기술 훈련은 2026-09-18 기술 개념과 함께 뺐다)
export const ACTION_KO: Record<Action, string> = { rest: '휴식', show: '시범', recover: '요양', atk: '훈련·공', def: '훈련·방', hp: '훈련·체력', hand: '훈련·손놀림' };
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
  st.money -= CONFIG.retrainCost; const from = g.type; g.type = type; g.base.spd = TYPE_STATS[type].spd; g.fought = true; g.trained = true;
  st.history.push(`${seasonName(st.season)}: ${g.name} 유형 전환 ${TYPE_LABEL[from]} → ${TYPE_LABEL[type]} ${CONFIG.retrainCost}`); return true;
}
export function heal(st: GameState, g: Gladiator): boolean {
  const cost = healCostOf(st); if (g.injured === 0 || st.money < cost) return false;
  st.money -= cost; g.injured = 0; pruneBeds(st); return true;
}

export function fightExpense(team: Gladiator[], tier: number): number { const rent = team.reduce((s, g) => s + rentFee(g, tier), 0); return Math.round(rent * CONFIG.fightExpense.rentRate + CONFIG.fightExpense.byTier[tier]); }
export function validTeam(st: GameState, c: Contract, team: Gladiator[]): string | null {
  if (team.length !== c.size) return `${c.size}명이 필요합니다`;
  if (team.some(g => g.fought)) return '이번 시즌 이미 출전한 검투사가 있습니다 (시즌당 1회)';
  if (team.some(g => !g.alive || g.injured > 0)) return '출전 불가 검투사가 포함되어 있습니다';
  if (new Set(team).size !== team.length) return '중복';
  const vets = team.filter(g => g.rank === 'veteranus').length;
  if (vets < c.needVeterans) return c.needVeterans >= c.size ? '티로는 나갈 수 없는 경기' : `티로는 ${c.size - c.needVeterans}명까지`;
  if (c.classic && !classicMatchup(team.map(g => g.type), c.enemy.map(e => e.type))) return '주최자가 정한 짝이 아닙니다'; // 정식 대결: 상대마다 짝이 되는 유형을 세운다 /* 표시해야 할 쪽은 예외(신참)다 — 베테라누스가 기본 (2026-09-17 사용자) */
  return null;
}

export function fight(st: GameState, c: Contract, team: Gladiator[]): FightReport {
  const err = validTeam(st, c, team); if (err) throw new Error(err);
  const grudges: FightReport['grudges'] = [];
  for (const g of team) for (const e of c.enemy) if ((g.spared ?? []).includes(e.id)) grudges.push({ mine: g, enemy: e }); // 살려 준 상대와의 재대결
  const boosted = new Set(grudges.map(x => x.enemy.id));
  const res = battle(st.rng, team, c.enemy, { hpBonusA: st.ludus.kitchen * CONFIG.ludus.kitchen.hpPerLevel, boostedB: boosted, boostMul: CONFIG.grudge.atk, traitsA: traitLevelsOf(team), traitsB: traitLevelsOf(c.enemy) }); // 특성은 편성에서 센다 — 나가는 팀끼리 (2026-09-18 사용자)
  for (const g of [...team, ...c.enemy]) { const x = res.stats[g.id]; if (!x) continue; const live = team.includes(g) ? g : (memberById(st.rivals, g.id)?.g ?? g); const cr = (live.career ??= {}); for (const [key, v] of Object.entries(x)) { if (key === 'dictata') { for (const [id, n] of Object.entries(x.dictata)) cr[`d:${id}`] = (cr[`d:${id}`] ?? 0) + n; } else cr[key] = (cr[key] ?? 0) + (v as number); } } // 행동 누적 → 경력 (숙련 딕타타 문턱의 재료, docs/09 2-α)
  const classic = c.classic === true || (c.size === 1 && (team[0].epithets ?? []).includes('omnia_solus')); // 정식 대결은 주최자가 주문한 계약에서만 (우연히 짝이 맞는 건 보너스가 아니다 — 2026-09-18). 만능 검투사는 어떤 짝이든 볼거리
  const HK = HOST[c.host];
  const rent = Math.round(team.reduce((s, g) => s + rentFee(g, c.tier), 0) * HK.rent); // 인색한 유지는 깎고 황제는 후하다
  const expense = fightExpense(team, c.tier);
  const won = res.winner === 'A';
  const acc = acceptedOf(c); const sine = acc.includes('sine_missione'); const clauseMul = acc.reduce((m, id) => m * CLAUSES[id].prizeMul, 1); // 특약: 상금 배율 (차양 −10%, 시네 미시오네 +50%)
  const basePrize = Math.round(CONFIG.prizePerTier * c.tier * HK.prize * clauseMul * (c.classic ? CONFIG.classicContract.prize : 1) * (c.challenge ? CONFIG.challenge.prize : 1)); // 도전 계약: 상금 ×1.5 // 정식 대결: 주최자가 제대로 된 흥행에 값을 치른다
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
  const killMine = (g: Gladiator, how: string) => { g.talentKnown = true; /* 첫 경기에서 죽어도 자질은 밝혀진 셈: 배상(valueOf)에 자질값을 반영한다 (Codex 리뷰 지적) */ g.alive = false; if ((g.status ?? 'slave') === 'slave') compensation += Math.round((valueOf(g) * CONFIG.deathComp.priceMult + g.wins * CONFIG.deathComp.perWin) * (g.origin === 'damnatus' ? CONFIG.origins.damnatus.comp : 1)); st.graveyard.push(g); st.roster = st.roster.filter(r => r !== g); st.history.push(`${seasonName(st.season)}: ${g.name} ${c.venue}에서 ${how} (${g.wins}승/${g.fights}전)`); };
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
      if (downed) { const f = judgeWinnerDowned(st.rng, injuryChanceOf(st)); if (f === 'injured') { g.injured = injurySeasons(st); g.injuries = (g.injuries ?? 0) + 1; } fates.push({ g, fate: f }); }
      else fates.push({ g, fate: 'unharmed' });
    } else if (downed) {
      const grudged = grudges.some(x => x.mine === g);
      const { fate, p } = sine ? { fate: 'dead' as Fate, p: 0 } : judgeLoser(st.rng, g, st.fame, c.host, classic, (st.events?.votum ? CONFIG.events.votum.missio : 0) + (grudged ? CONFIG.grudge.missio : 0) + (CONFIG.missio.tierBonus[c.tier] ?? 0), injuryChanceOf(st)); // 시네 미시오네: 판정 없이 죽는다 // 등급이 낮은 지방 경기일수록 주최자가 배상을 꺼려 살려 준다
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
  { const rv = rivalOf(st.rivals, c.rivalId); if (rv) { rv.vsMe ??= { wins: 0, losses: 0, draws: 0 }; if (won) rv.vsMe.losses++; else if (res.winner === 'B') rv.vsMe.wins++; else rv.vsMe.draws++;
    rv.purse += won ? CONFIG.rivals.purseLose : res.winner === 'B' ? CONFIG.rivals.purseWin : 0; // 파밀리아 살림: 우리와의 경기도 그들의 수입
    if (c.challenge) { if (won) { bumpMood(rv, -1); rv.revengeDue = st.season + 1; } else if (res.winner === 'B') bumpMood(rv, 1); } // 도전 경기: 지면 기세가 꺾이고 복수를 벼른다
    const star = rivalStar(rv); if (star && res.downed.B.some(d => d.id === star.id) && !c.challenge) { /* 흥행 경기에서 간판이 쓰러져도 기세 −1 */ bumpMood(rv, -1); } } } // 파밀리아 상대 전적
  // 상대 파밀리아에 결과 반영: 이긴 상대는 전적·명예, 쓰러진 상대는 실제 판정 (사망이면 명단에서 사라진다)
  const enemyFates: FightReport['enemyFates'] = []; const revenges: FightReport['revenges'] = [];
  for (const e of c.enemy) {
    const m = memberById(st.rivals, e.id); const live = m ? m.g : e; // 저장 후에는 객체가 다르므로 id 로 찾는다
    const downed = res.downed.B.some(d => d.id === e.id);
    live.fights++;
    if (downed && instantDeath(e.id)) { live.alive = false; if (m) m.rival.roster = m.rival.roster.filter(x => x !== live); enemyFates.push({ g: e, fate: 'dead', wound: true }); continue; } // 상대도 쓰러지는 순간 죽을 수 있다
    if (res.winner === 'B') { live.wins++; live.streak = (live.streak ?? 0) + 1; live.honor = Math.min(100, (live.honor ?? 0) + 3); maybePromote(live);
      for (const g of team) if (res.downed.A.includes(g)) { (g.beatenBy ??= []); if (!g.beatenBy.includes(live.id)) g.beatenBy.push(live.id); } }
    else if (won) { live.streak = 0;
      for (const g of team) if ((g.beatenBy ?? []).includes(live.id) && !res.downed.A.includes(g)) { revenges.push({ mine: g, enemy: e }); g.revenged = (g.revenged ?? 0) + 1; g.beatenBy = g.beatenBy!.filter(x => x !== live.id); g.honor = Math.min(100, (g.honor ?? 0) + CONFIG.grudge.revengeHonor); }
    }
    if (downed && won) {
      const { fate } = sine ? { fate: 'dead' as Fate } : judgeLoser(st.rng, live, st.fame, c.host, classic, (CONFIG.missio.tierBonus[c.tier] ?? 0));
      enemyFates.push({ g: e, fate });
      if (fate === 'dead') { live.alive = false; if (m) { const wasStar = rivalStar(m.rival) === live; m.rival.roster = m.rival.roster.filter(x => x !== live); if (wasStar) { bumpMood(m.rival, -2); m.rival.silentUntil = st.season + 1; st.history.push(`${seasonName(st.season)}: ${m.rival.name}의 간판 ${live.name}이(가) 죽었다 — 그 파밀리아가 조용해졌다`); } } }
      else { live.missios++; if (fate === 'injured') live.injured = 2; for (const g of team) if (!res.downed.A.includes(g)) { (g.spared ??= []); if (!g.spared.includes(live.id)) g.spared.push(live.id); } } // 살려 준 상대를 기억한다
    } else if (downed) enemyFates.push({ g: e, fate: 'unharmed' });
  }
  let fameDelta = 0;
  const fd = CONFIG.fameDelta;
  let winFame: number = fd.win; for (const [at, v] of fd.winAt) if (st.fame >= at) winFame = v; // 명성이 높을수록 승리 한 번의 값이 작다
  if (won && c.challenge) fameDelta += CONFIG.challenge.fame; // 도전 계약을 이기면 이름이 난다
  if (won) fameDelta += winFame + (classic ? fd.classicWin : 0) + HK.fameWin + (c.host === 'candidate' && team.some(g => fansOf(g) >= FANS_STAR) ? 1 : 0); // 선거 후보는 스타가 나온 경기에 표가 모인다
  if (HK.honorAll) for (const g of team) if (g.alive) g.honor = Math.min(100, (g.honor ?? 0) + HK.honorAll); // 장례 경기: 출전 자체가 기록에 남는다
  else if (res.winner === 'B') fameDelta += fd.lose;
  const H = CONFIG.honor; const crowned = won && fameDelta >= 5; // 주최자 만족 = 화관
  if (crowned) for (const g of team) if (g.alive) g.crowns = (g.crowns ?? 0) + 1;
  if (team.some(g => (g.epithets ?? []).includes('martia'))) fameDelta += 1; // '군신의 기쁨': 출전만으로 관중이 온다
  for (const id of acc) fameDelta += CLAUSES[id].fame; // 차양·살수: 관중이 몰린다
  if (won) for (const id of acc) if (CLAUSES[id].winnerHonor) for (const g of team) if (g.alive && !res.downed.A.includes(g)) g.honor = Math.min(100, (g.honor ?? 0) + CLAUSES[id].winnerHonor); // 시네 미시오네 승자 명예
  const evHonor = (st.events?.cena ? CONFIG.events.cena.honor : 0) + (st.events?.pompa ? CONFIG.events.pompa.honor : 0) + (st.events?.edicta ? CONFIG.events.edicta.honor : 0); // 행사: 만찬·행렬·벽화에 이름이 오른 검투사
  const newEpithets: FightReport['newEpithets'] = [];
  for (const g of team) { if (!g.alive) continue; for (const e of grantEpithets(g)) { newEpithets.push({ g, e }); st.history.push(`${seasonName(st.season)}: ${g.name} 별칭 '${e.name}' 을 얻다`); } if (won && (g.epithets ?? []).includes('suspirium')) g.honor = Math.min(100, (g.honor ?? 0) + 2); }
  for (const g of team) { if (!g.alive) continue; const d = evHonor + (won ? H.win + (c.tier - 1) * H.perTier + (classic ? H.classic : 0) + (crowned ? H.crown : 0) : res.winner === 'B' ? H.lose : 0); g.honor = Math.max(0, Math.min(100, (g.honor ?? 0) + d)); }
  fameDelta += fates.filter(f => f.fate === 'dead').length * fd.death;
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
  return { contract: c, team, winner: res.winner, mounted: res.mounted, turns: res.turns, log: res.log, events: res.events, frames: res.frames, duration: res.duration, initialHp: res.initialHp, downed: res.downed.A, awakened, bet, clauses: acc, guestGift, rent, expense, salary, prize, compensation, fates, promoted, fameDelta, classic, rudis, newEpithets, enemyFates, grudges, revenges };
}

// 남은 계약 거절. 벌점은 시즌당 1회, 그리고 실제로 받을 수 있었던 계약이 있을 때만 (인원·베테라누스 부족은 벌점 없음)
// 거절 벌점: 받을 수 있었던 '중요한' 계약(등급 2·3 — 큰 지방 경기·로마)을 안 치렀을 때만 시즌당 1회. 등급 1 소규모 무누스는 거절해도 벌점 없음
export const isImportant = (c: Contract) => c.tier >= 2 && !c.classic; // 정식 대결은 요청이지 의무가 아니다 — 못 채워도 벌점 없음
export function refuseAll(st: GameState): number {
  const penalized = st.fame >= CONFIG.fameDelta.refuseFrom && st.contracts.some(c => isImportant(c) && canFulfill(st, c)); // 아직 이름이 없을 때(호감도 40 미만)는 거절해도 벌점 없음
  const d = penalized ? CONFIG.fameDelta.refuse : 0;
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
  const F = CONFIG.fatigue; const overworked = st.roster.filter(g => (g.fatigue ?? 0) >= F.overworkAt && st.rng.chance(overworkChance(g.fatigue ?? 0)));
  for (const g of overworked) { g.alive = false; st.graveyard.push(g); st.roster = st.roster.filter(r => r !== g); st.history.push(`${seasonName(st.season)}: ${g.name} 혹사 끝에 쓰러져 죽다 (피로 ${g.fatigue})`); }
  st.lastLeft = leftNow.map(g => g.name); st.lastFreed = freedNow.map(g => g.name); st.lastOverwork = overworked.map(g => g.name);
  const active = st.history.some(h => h.startsWith(seasonName(st.season)) && /승|패|무 대여/.test(h));
  const evFame = (st.events?.cena ? CONFIG.events.cena.fame : 0) + (st.events?.pompa ? CONFIG.events.pompa.fame : 0) + (st.events?.guests ? CONFIG.events.guests.fame : 0);
  st.fame = Math.max(0, Math.min(100, st.fame + evFame));
  const recoverSet = new Set(st.roster.filter(g => g.injured > 0 && inBed(st, g))); st.lastNoBed = st.roster.filter(g => g.injured > 0 && !recoverSet.has(g)).map(g => g.name); // 침상에 누운 부상자만 낫는다. 눕지 않은 부상자는 이번 시즌 회복 없음
  for (const g of st.roster) { const q = cellQuality(st, g); if (g.injured > 0 && recoverSet.has(g)) g.injured--; if (!g.fought) g.fatigue = Math.max(0, (g.fatigue ?? 0) - (q >= 1 ? 2 : 1) - (st.ludus.medicine >= CONFIG.ludus.medicine.fatigueRestAt ? 1 : 0)); /* 의술 5단계: 의사가 몸을 돌봐 피로 회복 +1 */ if (q >= 3) g.honor = Math.min(100, (g.honor ?? 0) + 1); g.fought = false; g.trained = false; } // 쉰 검투사는 피로 회복 (좋은 숙소는 −2), 최고 숙소는 명예 +1
  pruneBeds(st); prunePalus(st); // 나은 사람은 침상에서 내려오고, 다친 사람·떠난 사람은 팔루스에서 내려온다
  let decay: number = CONFIG.fameDelta.decay; for (const [at, v] of CONFIG.fameDelta.decayAt) if (st.fame >= at) decay = v; // 망각: 기본 −1, 호감도 50↑ −2, 80↑ −3 (명성은 유지하기 어렵다)
  st.fame = Math.max(0, st.fame + decay + (active ? CONFIG.fameDelta.active : 0)); // 출전했으면 +1
  if (st.money < 0) { st.over = true; st.reason = '파산'; return { upkeep, gift }; }
  if (CONFIG.seasons > 0 && st.season >= CONFIG.seasons) { st.over = true; st.reason = `${CONFIG.seasons}시즌 완료`; return { upkeep, gift }; }
  st.season++;
  if ((st.season - 1) % 4 === 0) { // 새해: 모두 한 살. 라니스타는 정해진 나이에 은퇴하거나, 55세부터 해마다 병으로 물러날 수 있다
    for (const g of st.roster) g.age = (g.age ?? 22) + 1;
    st.lanista.age++;
    if (!st.pendingSuccession && st.rng.chance(mortality(st.lanista.age))) retire(st, true); // 나이별 사망 확률 (정해진 은퇴 나이는 없다)
  }
  startSeason(st);
  return { upkeep, gift };
}

export function score(st: GameState): number {
  return st.money + st.roster.reduce((s, g) => s + sellPrice(g), 0) + st.fame * 100;
}

// ---------- 저장 ----------
export interface SaveData { v: 1; rng: number; color?: string; formTeam?: number; season: number; money: number; fame: number; roster: Gladiator[]; graveyard: Gladiator[]; contracts: Contract[]; market: Gladiator[]; marketRerolls?: number; pendingChallenges?: Contract[]; challengeSent?: number; history: string[]; over: boolean; reason?: string; nextId: number; ludus?: unknown; events?: SeasonEvents; applicants?: Gladiator[]; rivals?: Rival[]; lanista?: Lanista; pendingSuccession?: boolean; lineageLog?: string[]; hall?: HallEntry[]; guestPromise?: boolean; }
export function serialize(st: GameState): SaveData {
  return { v: 1, rng: st.rng.state, color: st.color, formTeam: st.formTeam, season: st.season, money: st.money, fame: st.fame, roster: st.roster, graveyard: st.graveyard, contracts: st.contracts, market: st.market, marketRerolls: st.marketRerolls, pendingChallenges: st.pendingChallenges, challengeSent: st.challengeSent, history: st.history, over: st.over, reason: st.reason, nextId: peekNextId(), ludus: st.ludus, events: st.events, applicants: st.applicants, rivals: st.rivals, lanista: st.lanista, pendingSuccession: st.pendingSuccession, lineageLog: st.lineageLog, hall: st.hall, guestPromise: st.guestPromise };
}
// 구 저장(cells 숫자·infirmary·yard) → 새 구조
function migrateLudus(l: unknown): Ludus {
  if (!l || typeof l !== 'object') return newLudus();
  const o = l as Record<string, unknown>;
  if (Array.isArray(o.cells)) { const L = { ...newLudus(), ...(o as unknown as Ludus) } as Ludus & { stands?: number }; delete L.stands; if (!Array.isArray(L.bedsUse)) L.bedsUse = []; if (!Array.isArray(L.palusUse)) L.palusUse = []; return L; }
  const n = typeof o.cells === 'number' ? o.cells : 0, inf = typeof o.infirmary === 'number' ? o.infirmary : 0, yd = typeof o.yard === 'number' ? o.yard : 0;
  const L = newLudus(); L.cells = Array(CONFIG.ludus.cells.start + n * CONFIG.ludus.cells.per).fill(0); L.beds = inf >= 1 ? 2 : 1; L.medicine = inf * 2; L.palus = [2, 4, 6][yd] ?? 2; return L;
}
export function deserialize(d: SaveData): GameState {
  const rng = new Rng(1); rng.state = d.rng;
  setNextId(d.nextId);
  const contracts = d.contracts.map(c => ({ ...c, host: migrateHost(c.host as string), size: (c.size ?? c.enemy.length) as 1 | 2 | 3 })); // 구 저장: size 없음
  for (const g of [...d.roster, ...d.market, ...(d.applicants ?? []), ...contracts.flatMap(c => c.enemy)]) { if (g.age == null) g.age = g.rank === 'tiro' ? 20 : 27; /* 구 저장: 나이 없음 */ if (g.base.hand == null) g.base.hand = TYPE_STATS[g.type]?.hand ?? g.base.spd; delete (g.base as { range?: number }).range; } // 구 저장(2026-09-20): 손놀림 없음 → 유형 기본치, 사거리 칸은 지운다
  for (const r of d.rivals ?? []) { const def = RIVAL_DEFS.find(x => x.id === r.id); if (r.mood == null) r.mood = 0; if (r.purse == null) r.purse = CONFIG.rivals.purseStart[r.profile ?? 'local']; if (!r.focus) r.focus = def?.focus ?? 'bigShield+gladius'; } // 구 저장(2026-09-20): 파밀리아 살림 없음
  return { rng, color: d.color, formTeam: d.formTeam, season: d.season, money: d.money, fame: d.fame, roster: d.roster, graveyard: d.graveyard, contracts, market: d.market, marketRerolls: d.marketRerolls ?? 0, pendingChallenges: (d.pendingChallenges ?? []).map(c => ({ ...c, host: migrateHost(c.host), size: c.size ?? 1 })), challengeSent: d.challengeSent, applicants: d.applicants ?? [], rivals: (d.rivals ?? makeRivals(rng, d.season)).map(r => ({ ...r, vsMe: r.vsMe ?? { wins: 0, losses: 0, draws: 0 } })), lanista: d.lanista ? { name: d.lanista.name, age: d.lanista.age, trait: d.lanista.trait, type: d.lanista.type, since: d.lanista.since, dead: d.lanista.dead } : makeLanista(rng, d.season), pendingSuccession: d.pendingSuccession, lineageLog: d.lineageLog, guestPromise: d.guestPromise, hall: d.hall ?? d.roster.filter(g => g.status === 'rudiarius' || g.status === 'doctor').map(g => ({ name: g.name, type: g.type, wins: g.wins, fights: g.fights, honor: g.honor ?? 0, season: g.rudisSeason ?? d.season, epithets: [...(g.epithets ?? [])], how: 'rudis' as const })), history: d.history, over: d.over && !(CONFIG.seasons === 0 && /시즌 완료$/.test(d.reason ?? '')), reason: CONFIG.seasons === 0 && /시즌 완료$/.test(d.reason ?? '') ? undefined : d.reason /* 시즌 제한이 있던 옛 저장의 '12시즌 완료' 종료는 되살린다 */, ludus: migrateLudus(d.ludus), events: { cena: false, pompa: false, votum: false, edicta: false, guests: false, ...(d.events ?? {}) } };
}

// 계약 난이도 표시: 상대 전력 ÷ 내 최선 팀(같은 인원, 출전 가능한 검투사 중 상위) 전력. 0.85 미만 약함 · 1.15 초과 강함
export function difficultyOf(st: GameState, c: Contract): { ratio: number; label: 'weak' | 'even' | 'strong' } | null {
  const mine = st.roster.filter(g => g.alive && g.status !== 'doctor').sort((a, b) => powerOf(b) - powerOf(a)).slice(0, c.size);
  if (mine.length < c.size) return null;
  const ratio = teamPower(c.enemy) / Math.max(1, teamPower(mine));
  return { ratio, label: ratio < 0.85 ? 'weak' : ratio > 1.15 ? 'strong' : 'even' };
}
