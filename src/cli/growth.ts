// 시즌이 갈수록 얼마나 강해지는가: 봇 판을 돌리며 시즌마다 우리 로스터 평균 전력·상대 평균 전력·승률을 적는다. npm run growth [N] [봇이름]
import { newGame } from '../core/game.js';
import { BOTS } from './bots.js';
import { powerOf } from '../core/gladiator.js';
import { CONFIG } from '../core/config.js';
const N = Number(process.argv[2] ?? 200); const botName = process.argv[3] ?? '가성비'; const bot = BOTS[botName]; if (!bot) { console.log('봇 이름:', Object.keys(BOTS).join(', ')); process.exit(1); }
const S = CONFIG.simSeasons; const acc = Array.from({ length: S + 1 }, () => ({ mine: 0, mineN: 0, best: 0, bestN: 0, enemy: 0, enemyN: 0, wins: 0, games: 0, atk: 0, def: 0, hp: 0, hand: 0, statN: 0 }));
for (let i = 0; i < N; i++) { const st = newGame(1000 + i);
  bot(st, r => { const s = st.season; if (s > S) return; const a = acc[s]; a.games++; if (r.winner === 'A') a.wins++;
    const mine = st.roster.filter(g => g.alive && g.status !== 'doctor'); for (const g of mine) { a.mine += powerOf(g); a.mineN++; const e = g.base; a.atk += e.atk; a.def += e.def; a.hp += e.hp; a.hand += e.hand; a.statN++; }
    if (mine.length) { a.best += Math.max(...mine.map(powerOf)); a.bestN++; }
    for (const e of r.contract.enemy) { a.enemy += powerOf(e); a.enemyN++; } }); }
console.log(`${botName} 봇 ${N}판 — 시즌별 평균 (전력 = 능력치 가중합, 공 4.5 자)`);
console.log('시즌  우리평균  으뜸  상대평균  승률   공    방    체력   손놀림');
for (let s = 1; s <= S; s++) { const a = acc[s]; if (!a.games) continue; console.log(String(s).padStart(3), (a.mine / a.mineN).toFixed(0).padStart(8), (a.best / a.bestN).toFixed(0).padStart(6), (a.enemy / a.enemyN).toFixed(0).padStart(8), `${(a.wins / a.games * 100).toFixed(0)}%`.padStart(6), (a.atk / a.statN).toFixed(1).padStart(6), (a.def / a.statN).toFixed(1).padStart(6), (a.hp / a.statN).toFixed(0).padStart(6), (a.hand / a.statN).toFixed(1).padStart(7)); }
