// The Encounter catch chance (plan P1-03, the third named scenario): a hero with an Encounter Character order stands in
// the same province as an enemy hero, both without armies or items, and rolls each season to corner them until the
// roll succeeds. The rule (#82, item 11): 70%, +5% per level of the hunter's Spy, −5% per level of the quarry's
// (tests/encounter-seventy.test.js). The runs take four Spy pairings in turn, so each is a slice of 100 runs; every roll
// counts as a case.
import { order, plan } from '../../lib/scenario.js';
import { atWar, heroOf, measure, own, place, type Scenario, type World } from '../../../tools/balance/scenario.ts';
import type { Stats } from '../../../tools/balance/stats.ts';

/** [hunter's Spy, quarry's Spy]: by the rule, 70%, 85%, 55% and 70%. */
const PAIRS: readonly (readonly [number, number])[] = [
  [0, 0],
  [3, 0],
  [0, 3],
  [3, 3],
];
const slice = ([h, q]: readonly [number, number]) => `chases: caught | by Spy: ${String(h)} against ${String(q)}`;

const scenario: Scenario = {
  title: 'A hero corners an enemy hero in the same province (Encounter Character), by Spy levels',
  runs: 400,
  figures: ['chases: caught', ...PAIRS.map(slice)],
  async play(sc, run) {
    const pair = PAIRS[(run - 1) % PAIRS.length] ?? [0, 0];
    const turn = await sc.turn<World, { hunter: number; quarry: number }>({
      realms: 2,
      seaPct: 10,
      prepare(S, W) {
        atWar(S, 0, 1);
        const ground = S.world.provinces.find((p) => p.terrain !== 'sea' && p.owner == null);
        if (!ground) throw new Error('could not stage: no land province without an owner');
        own(S, ground, 0);
        const hunter = heroOf(S, 0);
        const quarry = heroOf(S, 1);
        [hunter, quarry].forEach((c, i) => {
          place(S, c, ground);
          c.items = [];
          c.armies = [];
          c.skills = { ...c.skills, spy: pair[i] ?? 0 };
          const spy = W.effSkillOf(c, 'spy', S.characters);
          if (spy !== pair[i]) throw new Error(`could not stage: Spy ${String(pair[i])} counts as ${String(spy)}`);
        });
        return { hunter: hunter.id, quarry: quarry.id };
      },
      orders: (_S, x) => ({ [x.hunter]: plan(order('encounter', x.quarry)) }),
    });
    const stats: Stats = measure(turn);
    stats[slice(pair)] = stats['chases: caught'] ?? [0, 0];
    return stats;
  },
};
export default scenario;
