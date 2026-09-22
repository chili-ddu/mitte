// 전설 검투사 (2026-09-22 사용자): 천부 자질 = 고유 인물. 자질을 굴려 천부가 나오면 일반 검투사가 아니라 이 풀에서 살아 있지 않은 인물을 꺼낸다.
// 이름·유형·시작 나이·성장형·잠재·고유 딕타타·외형이 고정이고 나이만 흐른다. 유형마다 한 명. 죽거나 나가면 풀로 돌아가고 다음 사람이 그 이름을 물려받는다(검투사 예명은 실제로 대물림됐다).
// 잠재는 나이와 맞물려 정했다: 늦게 나오는(26세) 프리스쿠스·베루스는 1.55, 어린(19세) 켈라두스·크레스켄스는 1.8 — 같은 유형·같은 나이 일반 베테라누스 상대 1대1 승률 60~80% 를 노린다
// 출연 조건은 없다 — 2% 주사위뿐. 사연은 카드 한 줄과 고정 수치의 근거일 뿐이다. 스파르타쿠스는 시대(기원전 73)가 안 맞아 뺐다.
import type { GType, Gladiator } from './types.js';
import type { Growth } from './growth.js';
export interface Legend { id: string; name: string; type: GType; age: number; growth: Growth; pot: number; dictata: string; lore: string; real: boolean }
const L = (id: string, name: string, type: GType, age: number, curve: Growth['curve'], trait: Growth['trait'], one: Growth['one'], pot: number, lore: string, real = true): Legend => ({ id, name, type, age, growth: { curve, trait, one, curveKnown: true, traitKnown: true }, pot, dictata: `L_${id}`, lore, real });
export const LEGENDS: Legend[] = [
  L('flamma', '플람마', 'secutor', 22, 'late', 'field', undefined, 1.6, '시리아 출신. 34전 21승, 루디스를 네 번 거절하고 30세에 죽었다 (시칠리아 묘비)'),
  L('spiculus', '스피쿨루스', 'murmillo', 24, 'normal', 'even', undefined, 1.7, '네로가 총애해 집과 땅을 내렸다. 네로가 죽던 밤 그를 찾았으나 오지 않았다 (수에토니우스)'),
  L('celadus', '켈라두스', 'thraex', 19, 'early', 'field', undefined, 1.8, '"소녀들의 한숨, 세 번 싸워 세 번 이긴 켈라두스" (폼페이 낙서)'),
  L('crescens', '크레스켄스', 'retiarius', 19, 'early', 'pupil', undefined, 1.8, '"밤의 소녀들의 의사, 크레스켄스" (폼페이 낙서)'),
  L('priscus', '프리스쿠스', 'provocator', 26, 'late', 'one', 'def', 1.55, '콜로세움 개장 경기에서 베루스와 끝내 승부를 못 내 둘 다 루디스를 받았다 (마르티알리스)'),
  L('verus', '베루스', 'hoplomachus', 26, 'normal', 'pupil', undefined, 1.6, '프리스쿠스의 맞수. 같은 날 같은 나무 검을 받았다 (마르티알리스)'),
  L('tetraites', '테트라이테스', 'eques', 23, 'normal', 'even', undefined, 1.7, '유리잔에 새겨져 갈리아·브리타니아까지 팔린 이름. 프루덴스를 꺾었다'),
  L('hermes', '헤르메스', 'dimachaerus', 21, 'early', 'even', undefined, 1.8, '"세 가지 무기로 싸우고 세 가지로 이긴다" (마르티알리스 5.24)'),
  L('columbus', '콜룸부스', 'scissor', 21, 'late', 'field', undefined, 1.7, '"비둘기". 폼페이 낙서에 이름만 남았다 — 유형은 가공', false),
  L('prudens', '프루덴스', 'laquearius', 23, 'normal', 'pupil', undefined, 1.75, '테트라이테스의 상대로 유리잔에 함께 새겨졌다 — 유형은 가공', false),
];
export const LEGEND_BY_ID: Record<string, Legend> = Object.fromEntries(LEGENDS.map(l => [l.id, l]));
export const legendOfType = (type: GType) => LEGENDS.find(l => l.type === type);
// 지금 살아 있는 전설의 id — 이 안에 있으면 풀에서 못 꺼낸다 (켈라·시장·지원자·계약 상대·파밀리아·도전장)
export function takenLegends(lists: Gladiator[][]): Set<string> { const s = new Set<string>(); for (const l of lists) for (const g of l) if (g.legend && g.alive) s.add(g.legend); return s; }
// 몇 대인가: 그 이름으로 죽거나 나간 사람 수 + 1 (우리 기록 기준)
export const legendGen = (id: string, graveyard: Gladiator[], hallNames: string[]): number => { const l = LEGEND_BY_ID[id]; if (!l) return 1; return 1 + graveyard.filter(g => g.legend === id).length + hallNames.filter(n => n === l.name).length; };
