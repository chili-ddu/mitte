import type { Gladiator, HostKind } from './types.js';
import { Rng } from './rng.js';
import { CONFIG } from './config.js';
import { epithetMods } from './epithets.js';
import { HOST } from './hosts.js';

export type Fate = 'unharmed' | 'injured' | 'dead';

export function survivalChance(g: Gladiator, fame: number, host: HostKind, classic = false, extra = 0): number {
  const m = CONFIG.missio;
  let p = m.base + fame * m.perFame + Math.min(g.wins, m.maxWins) * m.perWin + HOST[host].missio;
  if (classic) p += m.classic; // 전통 짝: 관중이 좋은 경기를 봤다
  p += (g.honor ?? 0) * CONFIG.honor.missioPer; // 인기 있는 검투사는 관중이 살려 달라 외친다
  p += extra; // 봉헌 등
  p += epithetMods(g).missio; // 별칭 '불사'
  if (g.origin === 'captive') p += CONFIG.origins.captive.missio; // 이방인 포로에게 관중은 냉담
  p -= Math.max(0, (g.fatigue ?? 0) - CONFIG.fatigue.free) * CONFIG.fatigue.missioPenalty;
  return Math.min(0.98, Math.max(0.02, p));
}

// 패배 측 쓰러진 검투사
export function judgeLoser(rng: Rng, g: Gladiator, fame: number, host: HostKind, classic = false, extra = 0, injuryChance: number = CONFIG.missio.injuryChance): { fate: Fate; p: number } { // injuryChance: 내 검투사는 의술 단계로 내려간다
  const p = survivalChance(g, fame, host, classic, extra);
  if (!rng.chance(p)) return { fate: 'dead', p };
  return { fate: rng.chance(injuryChance) ? 'injured' : 'unharmed', p };
}
// 승리 측 쓰러진 검투사: 사망 없음
export function judgeWinnerDowned(rng: Rng, injuryChance: number = CONFIG.missio.injuryChance): Fate {
  return rng.chance(injuryChance) ? 'injured' : 'unharmed';
}
