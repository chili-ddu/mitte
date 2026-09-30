// 고정 명부 (docs/11 10절): 시장에 서는 검투사는 랜덤 생성이 아니라 미리 정한 등급 세트에서 나온다 — 유형 10 × (천부 1·비범 2·재능 2·평범 2) = 70.
// 능력치는 항목별 seed 로 굴려 언제 나와도 같다(게임 시드는 등장 순서만 정한다). 명부의 이름은 랜덤 풀에서 빼 둔다(RESERVED_NAMES). 전설 열 명(legends.ts)은 명부의 전설급으로 파밀리아 얼굴이 되며 시장에는 서지 않는다 (2026-09-30 옛 main 바탕으로 다시 얹음)
import castJson from '../../data/cast.json' with { type: 'json' };
import type { Gladiator, GType, Lineage } from './types.js';
import { Rng } from './rng.js';
import { CONFIG } from './config.js';
import { makeGladiator, valueOf, RESERVED_NAMES } from './gladiator.js';
import type { Talent } from './talent.js';

export interface CastEntry { id: string; name: string; type: GType; lineage: Lineage; talent: Talent; role: 'market' | 'member'; familia?: number; seed: number; scaeva?: boolean; region?: 'campania' | 'roma' }
export const CAST: CastEntry[] = castJson as CastEntry[];
export const castById = (id: string): CastEntry | undefined => CAST.find(e => e.id === id);
for (const e of CAST) RESERVED_NAMES.add(e.name);

export interface CastState { app: number; gone?: boolean; taken?: boolean } // app: 시장에 선 횟수 · gone: 안 팔려 떠남(다른 라니스타에게 팔렸다 — 파밀리아 보충 인원 후보) · taken: 누군가의 로스터에 있음(또는 죽음)
export type CastBook = Record<string, CastState>;
export const castState = (book: CastBook, id: string): CastState => (book[id] ??= { app: 0 });

// 등급별 나이 띠 [최소, 최대, 이 나이부터 베테라누스]: 천부는 어리고(희귀), 평범은 폭이 넓다. 게임 시작 시점 기준이고 늦게 나오면 그만큼 먹는다 — 나이만큼 자란 몸(growth.ts)이라 늦게 나온 천부는 더 자라 있고 더 비싸다
const AGE_BAND: Record<Talent, [number, number, number]> = { 3: [18, 24, 25], 2: [19, 27, 25], 1: [18, 29, 26], 0: [17, 30, 27] };
export function makeFromCast(e: CastEntry, season: number, opts: { member?: boolean; age?: number; plain?: boolean } = {}): Gladiator { /* age: 나이를 지정(시작 검투사) — 띠 굴림은 그래도 소비해 뒤 굴림이 안 밀린다 · plain: 출신 굴림 없이 노예(시작 검투사 — 루두스에 딸려 온 사람에게 죄수 감점을 주지 않는다) */
  const rng = new Rng(e.seed); const years = Math.floor((season - 1) / 4);
  const [a0, a1, vetAt] = opts.member ? [19, 28, 24] : AGE_BAND[e.talent]; const rolled = rng.int(a0, a1) + years; const age = opts.age ?? rolled;
  const rank = age >= vetAt ? 'veteranus' : 'tiro';
  const g = makeGladiator(rng, rank, { type: e.type, lineage: e.lineage, name: e.name, talent: e.talent, age }); /* taken 을 안 넘기므로 천부가 전설로 바뀌지 않는다 — 전설은 파밀리아 얼굴 */
  g.castId = e.id; g.boughtSeason = season; if (e.scaeva) g.scaeva = true;
  g.origin = 'slave'; if (!opts.member && !opts.plain) { const O = CONFIG.origins; const r = rng.next(); /* 출신도 항목에 고정 (seed). 천부·비범은 죄수가 아니다. 출신 보정은 상한도 같이 옮긴다 (market.ts 옛 withOrigin 과 같다) */
    if (r < O.mix.captive) { g.origin = 'captive'; g.base.atk += O.captive.atk; g.base.hp += O.captive.hp; if (g.cap) { g.cap.atk += O.captive.atk; g.cap.hp += O.captive.hp; } }
    else if (e.talent <= 1 && r < O.mix.captive + O.mix.damnatus) { g.origin = 'damnatus'; g.base.atk = Math.max(1, g.base.atk + O.damnatus.stat); g.base.def = Math.max(0, g.base.def + O.damnatus.stat); if (g.cap) { g.cap.atk = Math.max(g.base.atk, g.cap.atk + O.damnatus.stat); g.cap.def = Math.max(g.base.def, g.cap.def + O.damnatus.stat); } } }
  g.buyPrice = valueOf(g); return g;
}
