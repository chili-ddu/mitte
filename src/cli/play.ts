// 콘솔 대화형 플레이
import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { newGame, available, buy, sell, heal, fight, refuseAll, endSeason, validTeam, score, seasonName, type GameState } from '../core/game.js';
import { label, sellPrice, rentFee, TYPE_KO } from '../core/gladiator.js';
import { HOST_KO } from '../core/contracts.js';
import { computeSynergies, describeSynergies } from '../core/synergy.js';
import { survivalChance } from '../core/missio.js';
import { CONFIG } from '../core/config.js';
import type { Gladiator } from '../core/types.js';

const rl = readline.createInterface({ input: stdin, output: stdout });
const ask = (q: string) => rl.question(q);
const seed = Number(process.argv[2] ?? Date.now() % 100000);
const st = newGame(seed);
console.log(`\n=== 라니스타 (seed ${seed}) ===\n당신은 캄파니아의 검투사 양성소 주인입니다. 12시즌 동안 파산하지 않고 명성을 쌓으세요.\n`);

function status(st: GameState) {
  console.log(`\n--- ${seasonName(st.season)} | 자금 ${st.money} HS | 군중 호감도 ${st.fame} | 검투사 ${st.roster.length}명 (유지비 ${st.roster.length * CONFIG.upkeepPerGladiator}/시즌) ---`);
}
function rosterView(st: GameState) {
  if (!st.roster.length) { console.log('  (검투사 없음)'); return; }
  st.roster.forEach((g, i) => console.log(`  [${i}] ${label(g)} HP${g.base.hp} 공${g.base.atk} 방${g.base.def}${g.injured ? ' 부상' : ''} 매각가 ${sellPrice(g)}`));
}

async function marketPhase(st: GameState) {
  while (true) {
    console.log('\n[시장]');
    st.market.forEach((g, i) => console.log(`  (${i}) ${label(g)} HP${g.base.hp} 공${g.base.atk} 방${g.base.def} 가격 ${g.buyPrice}`));
    console.log('[내 루두스]'); rosterView(st);
    const a = (await ask('구매 b<번호> / 매각 s<번호> / 치료 h<번호> / 계속 Enter > ')).trim();
    if (!a) return;
    const n = Number(a.slice(1));
    if (a[0] === 'b' && st.market[n]) { if (!buy(st, st.market[n])) console.log('자금 부족'); }
    else if (a[0] === 's' && st.roster[n]) sell(st, st.roster[n]);
    else if (a[0] === 'h' && st.roster[n]) { if (!heal(st, st.roster[n])) console.log('치료 불가'); }
  }
}

async function contractPhase(st: GameState) {
  while (st.contracts.length) {
    console.log('\n[계약 제안]');
    st.contracts.forEach((c, i) => {
      const preview = c.enemyPreview.map(t => TYPE_KO[t]).join(', ') || '불명';
      console.log(`  (${i}) 등급${c.tier} ${c.venue} | ${HOST_KO[c.host]} | 상대 공개: ${preview} | 베테 ${c.needVeterans}명 필수 | 승리 상금 ${CONFIG.prizePerTier * c.tier}`);
    });
    const a = (await ask('계약 번호 / 모두 거절 r > ')).trim();
    if (a === 'r') { refuseAll(st); console.log('거절. 호감도 -2'); return; }
    const c = st.contracts[Number(a)]; if (!c) continue;
    const pool = available(st);
    if (pool.length < c.size) { console.log('출전 가능 검투사가 부족합니다'); continue; }
    console.log('[출전 가능]'); pool.forEach((g, i) => console.log(`  [${i}] ${label(g)} 대여료 ${rentFee(g, c.tier)}`));
    const sel = (await ask(`${c.size}명 선택 (예: 0 1 2) > `)).trim().split(/\s+/).map(Number);
    const team = sel.map(i => pool[i]).filter(Boolean) as Gladiator[];
    const err = validTeam(st, c, team); if (err) { console.log(err); continue; }
    const syn = computeSynergies(team);
    console.log(`시너지: ${describeSynergies(syn).join(', ') || '없음'}`);
    console.log(`패배 시 생존 확률: ${team.map(g => `${g.name} ${(survivalChance(g, st.fame, c.host, syn) * 100).toFixed(0)}%`).join(', ')}`);
    if ((await ask('출전? (y/n) > ')).trim() !== 'y') continue;
    const r = fight(st, c, team);
    console.log(`\n=== ${c.venue} ===`);
    r.log.forEach(l => console.log('  ' + l));
    console.log(`\n결과: ${r.winner === 'A' ? '승리' : r.winner === 'B' ? '패배' : '무승부'} (${r.turns}턴)`);
    for (const f of r.fates) console.log(`  ${f.g.name}: ${f.fate === 'dead' ? `사망 (생존 확률 ${(f.p! * 100).toFixed(0)}%였음)` : f.fate === 'injured' ? '부상' : '무사'}`);
    for (const g of r.promoted) console.log(`  ${g.name} 베테라누스 승급!`);
    console.log(`  대여료 +${r.rent} 상금 +${r.prize} 배상금 +${r.compensation} | 호감도 ${r.fameDelta >= 0 ? '+' : ''}${r.fameDelta}`);
    return;
  }
}

(async () => {
  while (!st.over) {
    status(st);
    await marketPhase(st);
    await contractPhase(st);
    const { upkeep } = endSeason(st);
    console.log(`\n시즌 종료. 유지비 -${upkeep}`);
  }
  status(st);
  console.log(`\n게임 종료: ${st.reason}. 최종 점수 ${score(st)}`);
  if (st.graveyard.length) console.log('묘비: ' + st.graveyard.map(g => `${g.name} ${g.wins}승/${g.fights}전`).join(' | '));
  rl.close();
})();
