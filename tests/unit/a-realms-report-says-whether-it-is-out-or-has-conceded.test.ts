// P0-25 (R-075): the turn report tells a realm that it is out. Each realm's own report says whether its dynasty is
// extinguished (`kingdom.eliminated`), as it says whether the realm has conceded (`kingdom.conceded`). The player
// portal reads both to decide what the realm may send in Dispatches; it never reads the world itself.
//
// Level 1 (unit): buildTurnReport (src/views/turn-report.ts) called on what each realm may see (playerView) of a world
// the engine makes on its modules (tests/lib/a-staged-turn-on-the-engines-modules.ts) from KC_SEED: realm 1's dynasty
// extinguished on an earlier turn, realm 2 conceded then, realm 0 playing on. Not lower: the flags are computed from
// the realm. A turn need not run: the turn's end builds each report by these two calls
// (src/views/every-realms-report-and-the-lines-each-realm-reads.ts' buildReports).
//
// Until plan P1-14g this was tests/eliminated-report.test.js, which played one real turn on the booted GM page and read
// each realm's report. Its checks are kept as they were; "no page errors" is "throws nothing": a console.error fails
// the test (tests/setup/each.ts).
import { expect, test } from 'vitest';
import { aStagedTurnOnTheEnginesModules } from '../lib/a-staged-turn-on-the-engines-modules.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

interface World {
  turn: number;
  players: Record<string, unknown>[];
}

test("each realm's report says whether it is extinguished, has conceded, or neither", async () => {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { playerView } = await import('../../src/views/what-each-realm-may-see-of-the-world.ts');
  const { buildTurnReport } = await import('../../src/views/turn-report.ts');
  const { S } = sc.world({ realms: 3 });
  const G = S as unknown as World;
  const [, out, conceded] = G.players;
  if (!out || !conceded) throw new Error('could not stage: three realms');
  // realm 1's dynasty was extinguished on an earlier turn; realm 2 has conceded; realm 0 plays on
  Object.assign(out, { _eliminated: true, _eliminatedTurn: G.turn - 1 });
  Object.assign(conceded, { conceded: true, concededTurn: G.turn - 1 });
  const k = (pi: number) => {
    const { kingdom } = buildTurnReport(playerView(S as never, pi)) as { kingdom: Record<string, unknown> };
    return { eliminated: kingdom['eliminated'], conceded: kingdom['conceded'] };
  };
  expect(k(0), 'a realm still in the game: neither').toEqual({ eliminated: false, conceded: false });
  expect(k(1).eliminated, "an extinguished realm's own report says so").toBe(true);
  expect(k(2), "a conceded realm's report says it conceded, not that it is extinguished").toEqual({
    eliminated: false,
    conceded: true,
  });
});
