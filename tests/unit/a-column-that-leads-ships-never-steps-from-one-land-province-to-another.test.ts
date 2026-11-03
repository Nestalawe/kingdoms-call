// 2026-10-08 (item 14): a column that leads ships never steps from one land province to another (ships cannot cross
// land), wherever it marches without a Move order: the Defend ride-outs (to a column crossing in, and to a host already
// standing in the watch), the ride-in to a raised host and the force-march reinforcement all ask canStepBetween. A
// column of two Galleon Fleets and two Heavy Infantry may not step from plain to plain, and may put out from the plain
// to sea; two Heavy Infantry alone may march from plain to plain.
//
// Level 1 (unit): canStepBetween (src/engine/units/movement-pools.ts) called on hand-made columns and provinces. The
// ride-outs that ask it, in whole turns, are
// tests/scenario/a-general-on-defend-who-leads-ships-never-rides-overland.test.ts.
//
// Until plan P1-14e the rule was checked only through those turns (tests/defend-naval-overland.test.js); this case is
// the conversion's lower half, the same fault seen one level down.
import { expect, test } from 'vitest';
import { canStepBetween } from '../../src/engine/units/movement-pools.ts';

const army = (type: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({ type, quality: 'Regular', unitName: `${type} ${String(i + 1)}` }));
const plain = (id: number) => ({ id, terrain: 'plain' });
const sea = (id: number) => ({ id, terrain: 'sea' });

test('a column that leads ships never steps from land to land; it may put to sea, and foot alone may march', () => {
  const admiral = { armies: [...army('Galleon Fleet', 2), ...army('Heavy Infantry', 2)] };
  const foot = { armies: army('Heavy Infantry', 2) };
  expect(
    {
      shipsAndFootOverland: canStepBetween(admiral, plain(1), plain(2), 'sea'),
      shipsAndFootOutToSea: canStepBetween(admiral, plain(1), sea(2), 'sea'),
      footOverland: canStepBetween(foot, plain(1), plain(2), 'land'),
    },
    'ships never cross land; they put to sea; foot march',
  ).toEqual({ shipsAndFootOverland: false, shipsAndFootOutToSea: true, footOverland: true });
});
