import { newGame, score } from '../core/game.js';
import { BOTS } from './bots.js';
import { CONFIG } from '../core/config.js';

const N = Number(process.argv[2] ?? 1000);
const S = Number(process.argv[3] ?? CONFIG.simSeasons); (CONFIG as { simSeasons: number }).simSeasons = S; // 두 번째 인자: 시즌 수 (기본 12)
console.log(`전략별 ${N}판 × ${S}시즌 시뮬레이션\n`);
console.log('전략'.padEnd(18), '파산율', '평균점수', '평균자금', '평균호감', '출전당사망', '평균사망수', '완주시 검투사수', '경기수', '승률', '평균규모');
for (const [name, bot] of Object.entries(BOTS)) {
  let bankrupt = 0, sc = 0, money = 0, fame = 0, deaths = 0, fights = 0, roster = 0, done = 0, games = 0, wins = 0;
  for (let i = 0; i < N; i++) {
    const st = newGame(1000 + i);
    let f = 0;
    bot(st, r => { f += r.team.length; games++; if (r.winner === 'A') wins++; });
    if (st.reason === '파산') bankrupt++; else { done++; roster += st.roster.length; }
    sc += score(st); money += st.money; fame += st.fame; deaths += st.graveyard.length; fights += f;
  }
  console.log(name.padEnd(18), (bankrupt / N * 100).toFixed(1).padStart(5) + '%', Math.round(sc / N).toString().padStart(8), Math.round(money / N).toString().padStart(8), (fame / N).toFixed(1).padStart(8), (deaths / fights * 100).toFixed(1).padStart(9) + '%', (deaths / N).toFixed(2).padStart(9), done ? (roster / done).toFixed(1).padStart(12) : '-'.padStart(12), (games / N).toFixed(1).padStart(6), (wins / Math.max(1, games) * 100).toFixed(0).padStart(4) + '%', (fights / Math.max(1, games)).toFixed(2).padStart(6));
}
