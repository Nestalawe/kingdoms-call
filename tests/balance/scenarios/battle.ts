// The battle matchup (plan P1-03, the first named scenario): a commander of a Human realm leads 6 Elite Yeoman Longbows
// into the hills against an enemy commander of a Dwarven realm holding them with 6 Average Dwarven Guard. Both
// commanders are plain (Melee 1, Tactical 1, no items), so the units, the ground and the dice decide. Measured on the
// first clash: the same battle is recorded again each season both sides stay in the field. About even on main (Elite
// Dwarven Guard win almost every time), so a change to the battle's sums moves the share either way.
import { order, plan } from '../../lib/scenario.js';
import {
  atWar,
  companies,
  firstClashIn,
  heroOf,
  measure,
  own,
  place,
  type Province,
  type Scenario,
  type World,
} from '../../../tools/balance/scenario.ts';

const scenario: Scenario = {
  title: '6 Elite Yeoman Longbows attack 6 Average Dwarven Guard in the hills',
  runs: 400,
  figures: ['battles: attacker won', 'battles: units lost by the attacker', 'battles: units lost by the defender'],
  async play(sc) {
    const turn = await sc.turn<World, { attacker: number; hills: Province }>({
      realms: 2,
      races: ['Human', 'Dwarven'],
      seaPct: 10,
      prepare(S, W) {
        atWar(S, 0, 1);
        const land = S.world.provinces.filter((p) => p.terrain !== 'sea');
        const next = (p: Province) =>
          (W.getNeighborsP(p, S.world.cols, S.world.rows, S.world.provinces) as (Province | null)[]).find(
            (q) => q != null && q.terrain !== 'sea',
          );
        const from = land.find((p) => next(p));
        const hills = from && next(from);
        if (!from || !hills) throw new Error('could not stage: no two land provinces side by side');
        own(S, from, 0);
        own(S, hills, 1);
        hills.terrain = 'hills';
        const attacker = heroOf(S, 0);
        const defender = heroOf(S, 1);
        place(S, attacker, from);
        place(S, defender, hills);
        for (const c of [attacker, defender]) {
          c.items = [];
          c.skills = { melee: 1, tactical: 1 };
        }
        attacker.armies = companies('Yeoman Longbows', 'Elite', 6);
        defender.armies = companies('Dwarven Guard', 'Average', 6);
        return { attacker: attacker.id, hills };
      },
      orders: (_S, x) => ({ [x.attacker]: plan(order('move', x.hills.id)) }),
    });
    return measure(turn, firstClashIn(turn, turn.extra.hills.id));
  },
};
export default scenario;
