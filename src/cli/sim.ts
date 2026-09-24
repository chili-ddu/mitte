import { newGame, score } from '../core/game.js';
import { BOTS } from './bots.js';
import { CONFIG } from '../core/config.js';

const N = Number(process.argv[2] ?? 1000);
const S = Number(process.argv[3] ?? CONFIG.simSeasons); (CONFIG as { simSeasons: number }).simSeasons = S; // 두 번째 인자: 시즌 수 (기본 12)
console.log(`전략별 ${N}판 × ${S}시즌 시뮬레이션\n`);
console.log('전략'.padEnd(18), '파산율', '평균점수', '평균자금', '평균호감', '출전당사망', '평균사망수', '완주시 검투사수', '경기수', '승률', '평균규모', '졸업수', '6졸업률', '6졸업시즌', '간판이적', '판돈상실', '간판사고', '초청률', '초청시즌');
for (const [name, bot] of Object.entries(BOTS)) {
  const fameByYear: number[] = []; const fameN: number[] = [];
  let bankrupt = 0, sc = 0, money = 0, fame = 0, deaths = 0, fights = 0, roster = 0, done = 0, games = 0, wins = 0, grads = 0, full = 0, fullSeason = 0, gained = 0, lost = 0, starDied = 0, invited = 0, invitedSeason = 0;
  for (let i = 0; i < N; i++) {
    const st = newGame(1000 + i);
    let f = 0;
    let g6 = 0; bot(st, r => { f += r.team.length; games++; if (r.winner === 'A') wins++; if (r.challenge) { if (r.challenge.graduated) { g6++; if (g6 === 6) { full++; fullSeason += st.season; } } if (r.challenge.gained) gained++; if (r.challenge.lost) lost++; if (r.challenge.starDied) starDied++; } }, s2 => { if ((s2.season - 1) % 4 === 0 && s2.season > 1) { const y = (s2.season - 1) / 4 - 1; fameByYear[y] = (fameByYear[y] ?? 0) + s2.fame; fameN[y] = (fameN[y] ?? 0) + 1; } }); grads += g6; if (st.invited) { invited++; invitedSeason += st.invited; }
    if (st.reason === '파산') bankrupt++; else { done++; roster += st.roster.length; }
    sc += score(st); money += st.money; fame += st.fame; deaths += st.graveyard.length; fights += f;
  }
  console.log(name.padEnd(18), (bankrupt / N * 100).toFixed(1).padStart(5) + '%', Math.round(sc / N).toString().padStart(8), Math.round(money / N).toString().padStart(8), (fame / N).toFixed(1).padStart(8), (deaths / fights * 100).toFixed(1).padStart(9) + '%', (deaths / N).toFixed(2).padStart(9), done ? (roster / done).toFixed(1).padStart(12) : '-'.padStart(12), (games / N).toFixed(1).padStart(6), (wins / Math.max(1, games) * 100).toFixed(0).padStart(4) + '%', (fights / Math.max(1, games)).toFixed(2).padStart(6), (grads / N).toFixed(2).padStart(6), (full / N * 100).toFixed(0).padStart(6) + '%', (full ? fullSeason / full : 0).toFixed(1).padStart(8), (gained / N).toFixed(2).padStart(7), (lost / N).toFixed(2).padStart(7), (starDied / N).toFixed(2).padStart(7), (invited / N * 100).toFixed(0).padStart(5) + '%', (invited ? invitedSeason / invited : 0).toFixed(1).padStart(7));
  if (S >= 8) console.log('   연차별 호감도:', fameByYear.map((v, i) => `${i + 1}년 ${(v / fameN[i]).toFixed(0)}`).join(' · '));
}