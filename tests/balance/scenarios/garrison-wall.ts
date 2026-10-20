// A garrison holding on its own (the garrison experiment): a commander of a Human realm leads 4 Average Shieldwall
// Levies onto the plains of an enemy Human realm held by 2 Average Human Garrison and no commander. The commander is
// plain (Melee 1, Tactical 1, no items), so the units and the dice decide. Measured on the first clash. The attacker
// wins almost every time on main; a stronger garrison unit moves the share down.
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
  title: '4 Average Shieldwall Levies attack 2 Average Human Garrison holding the plains alone',
  runs: 400,
  figures: ['battles: attacker won', 'battles: units lost by the attacker', 'battles: units lost by the defender'],
  async play(sc) {
    const turn = await sc.turn<World, { attacker: number; plains: Province }>({
      realms: 2,
      races: ['Human', 'Human'],
      seaPct: 10,
      prepare(S, W) {
        atWar(S, 0, 1);
        const land = S.world.provinces.filter((p) => p.terrain !== 'sea');
        const next = (p: Province) =>
          (W.getNeighborsP(p, S.world.cols, S.world.rows, S.world.provinces) as (Province | null)[]).find(
            (q) => q != null && q.terrain !== 'sea',
          );
        const from = land.find((p) => next(p));
        const plains = from && next(from);
        if (!from || !plains) throw new Error('could not stage: no two land provinces side by side');
        own(S, from, 0);
        own(S, plains, 1);
        plains.terrain = 'plain';
        plains.garrisonArmies = companies('Human Garrison', 'Average', 2);
        const attacker = heroOf(S, 0);
        place(S, attacker, from);
        attacker.items = [];
        attacker.skills = { melee: 1, tactical: 1 };
        attacker.armies = companies('Shieldwall Levies', 'Average', 4);
        return { attacker: attacker.id, plains };
      },
      orders: (_S, x) => ({ [x.attacker]: plan(order('move', x.plains.id)) }),
    });
    return measure(turn, firstClashIn(turn, turn.extra.plains.id));
  },
};
export default scenario;
