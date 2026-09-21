// 숙련 딕타타 문턱 측정: 봇 판을 돌리며 시즌마다 로스터가 익힌 딕타타 수와 어느 자리가 몇 시즌에 차는지 잰다. npm run mastery [N] [doctor:0|1]
import { newGame } from '../core/game.js';
import { BOTS } from './bots.js';
import { CONFIG } from '../core/config.js';
import { MASTERY_BY_ID } from '../core/dictata.js';
const N = Number(process.argv[2] ?? 200); const needDoctor = (process.argv[3] ?? '0') === '1'; (CONFIG.mastery as { needDoctor: boolean }).needDoctor = needDoctor;
const S = CONFIG.simSeasons; const per = Array.from({ length: S + 1 }, () => ({ learned: 0, roster: 0 })); const firstAt: number[] = [], thirdAt: number[] = []; const byId: Record<string, number> = {};
for (let i = 0; i < N; i++) { const st = newGame(1000 + i); const seen = new Map<number, number>();
  BOTS['가성비'](st, () => { const s = st.season; if (s > S) return; const a = per[s]; for (const g of st.roster) { if (!g.alive) continue; a.roster++; const n = (g.dictata ?? []).length; a.learned += n; const prev = seen.get(g.id) ?? 0; if (n >= 1 && prev < 1) firstAt.push(s); if (n >= 3 && prev < 3) thirdAt.push(s); seen.set(g.id, n); } });
  for (const g of [...st.roster, ...st.graveyard]) for (const id of g.dictata ?? []) byId[id] = (byId[id] ?? 0) + 1; }
const med = (a: number[]) => a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null;
console.log(`가성비 봇 ${N}판 · 독토르 조건 ${needDoctor ? '켬' : '끔'} — 시즌별 검투사당 익힌 딕타타 수`);
console.log(Array.from({ length: S }, (_, k) => `${k + 1}:${(per[k + 1].learned / Math.max(1, per[k + 1].roster)).toFixed(2)}`).join('  '));
console.log(`첫째 자리 중앙값 ${med(firstAt)}시즌 (${firstAt.length}명) · 셋째 자리 중앙값 ${med(thirdAt)}시즌 (${thirdAt.length}명)`);
console.log('많이 익힌 것:', Object.entries(byId).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([id, n]) => `${MASTERY_BY_ID[id]?.name ?? id} ${n}`).join(' · '));
