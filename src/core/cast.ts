// 고정 명부(docs/08-campaign.md 10절): 세계의 검투사는 랜덤 생성이 아니라 미리 정한 명부에서 나온다. 시장 등급 세트 56(등급×유형) + 메인 파밀리아 소속 24.
// 능력치는 항목별 seed 로 굴려 항상 같다(시드는 등장 순서만 정한다). 이름은 랜덤 풀에서 예약한다
import castJson from '../../data/cast.json' with { type: 'json' };
import type { Gladiator, GType, Lineage } from './types.js';
import { Rng } from './rng.js';
import { CONFIG } from './config.js';
import { makeGladiator, valueOf, RESERVED_NAMES } from './gladiator.js';
import { grantRandomSkills } from './skills.js';
import type { Talent } from './talent.js';

export interface CastEntry { id: string; name: string; type: GType; lineage: Lineage; talent: Talent; role: 'market' | 'member'; familia?: number; seed: number; scaeva?: boolean }
export const CAST: CastEntry[] = castJson as CastEntry[];
export const castById = (id: string): CastEntry | undefined => CAST.find(e => e.id === id);
for (const e of CAST) RESERVED_NAMES.add(e.name);

export interface CastState { app: number; gone?: boolean; taken?: boolean } // app: 시장에 선 횟수 · gone: 안 팔려 떠남(파밀리아 보충 인원이 된다) · taken: 누군가의 로스터에 있음(또는 죽음)
export type CastBook = Record<string, CastState>;
export const castState = (book: CastBook, id: string): CastState => (book[id] ??= { app: 0 });

// 등급별 나이·서열 띠: 천부는 어리고(희귀), 평범은 폭이 넓다. 나이는 게임 시작 시점 기준이고 늦게 나오면 그만큼 먹는다
const AGE_BAND: Record<Talent, [number, number, number]> = { 3: [18, 24, 25], 2: [19, 27, 25], 1: [18, 29, 26], 0: [17, 30, 27] }; // [최소, 최대, 이 나이부터 베테라누스]
export function makeFromCast(e: CastEntry, season: number, opts: { member?: boolean } = {}): Gladiator {
  const rng = new Rng(e.seed); const years = Math.floor((season - 1) / 4);
  const [a0, a1, vetAt] = opts.member ? [19, 28, 24] : AGE_BAND[e.talent]; /* 소속: 24세부터 베테라누스 (5할). 이 비율이 초반 난이도의 손잡이 — 2할이면 12시즌 승률 53~67%, 4할 54~67%, 5.5할 37~48%, 6.4할 34~44% (2026-09-24 측정) */ const age0 = rng.int(a0, a1); const age = age0 + years;
  const rank = age >= vetAt ? 'veteranus' : 'tiro';
  const g = makeGladiator(rng, rank, { type: e.type, lineage: e.lineage, name: e.name, season });
  g.age = age; g.talent = e.talent; g.talentKnown = false; g.castId = e.id; g.boughtSeason = season; if (e.scaeva) g.scaeva = true;
  g.origin = 'slave'; if (!opts.member) { const O = CONFIG.origins; const r = rng.next(); // 출신: 천부·비범은 죄수가 아니다
    if (r < O.mix.captive) { g.origin = 'captive'; g.base.atk += O.captive.atk; g.base.hp += O.captive.hp; }
    else if (e.talent <= 1 && r < O.mix.captive + O.mix.damnatus) { g.origin = 'damnatus'; g.base.atk = Math.max(1, g.base.atk + O.damnatus.stat); g.base.def = Math.max(0, g.base.def + O.damnatus.stat); } }
  if (rank === 'veteranus') grantRandomSkills(rng, g, rng.int(CONFIG.skills.rivalSkillsVet[0], CONFIG.skills.rivalSkillsVet[1]));
  g.buyPrice = valueOf(g); return g;
}
