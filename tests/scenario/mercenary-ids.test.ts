// Mercenary band ids (P1-18b): a band made during a turn is named `merc_t<turn>_<n>`, counted afresh each turn, with
// no clock and no dice in it, so the turn's dice don't depend on how many bands it makes. The `merc_` prefix the
// hire code tests for is kept, and the form can't meet an old `merc_<ms>_<b36>` id.
// Level 2 (scenario): the ids are made inside runTurn, by a nested function, so only a real turn reaches them.
// The king hires both bands back by id in the same turn: a hire by id proves the id, and a band left in the pool could
// retire at the end of the turn (a 1-in-4 roll), which the turn's dice decide (restaged for P1-18e, which gave each
// turn its own dice: the first band had stayed in the pool, and survived only on the dice).
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Mercenary band ids (P1-18b): bands made in a turn are `merc_t<turn>_<n>`, counted afresh each turn, with no clock or
// dice in them. A king disbands two armies and hires both bands back by those ids in the same turn: a hire by id proves
// the id, and no band is left in the pool, where it could retire at the end of the turn on a roll (restaged in P1-18e:
// the first band had stayed there, and passed only on the dice). Level 2: the ids are made by a function nested in
// `resolveTurn`, so only a real turn reaches them. TypeScript, in `scenario/`
import { expect, test } from 'vitest';
import { bootScenario, order, plan } from '../lib/scenario.js';

interface Army {
  type: string;
  quality: string;
  unitName?: string;
}
interface World {
  turn: number;
  players: { gold?: number }[];
  characters: { id: number; player: number | null; alive?: boolean; armies?: Army[] }[];
  mercenaries?: { id: string; type: string }[];
}

const sc = await bootScenario();

test('bands made in a turn are numbered for the turn, and can be hired by those ids', async () => {
  const r = await sc.turn<World, { king: number; turn: number }>({
    realms: 2,
    prepare(S) {
      const king = S.characters.find((c) => c.alive !== false && c.player === 0);
      if (!king) throw new Error('realm 0 has no hero');
      king.armies = [
        { type: 'Shieldwall Levies', quality: 'Average', unitName: 'First Levy' },
        { type: 'Shieldwall Levies', quality: 'Average', unitName: 'Second Levy' },
      ];
      (S.players[0] ?? {}).gold = 100;
      S.mercenaries = [];
      return { king: king.id, turn: S.turn };
    },
    orders: (_S, x) => ({
      [x.king]: plan(
        order('disband_army', 'all'),
        order('recruit', `merc:merc_t${String(x.turn)}_2,merc:merc_t${String(x.turn)}_1`),
      ),
    }),
  });
  const S2 = r.S2 as World;
  expect(r.text(r.extra.king)).toMatch(/hires mercenary band First Levy/);
  expect(r.text(r.extra.king)).toMatch(/hires mercenary band Second Levy/);
  expect(S2.mercenaries ?? [], 'both bands were hired from the pool').toEqual([]);
  const king = S2.characters.find((c) => c.id === r.extra.king);
  expect((king?.armies ?? []).map((a) => a.unitName).sort()).toEqual(['First Levy', 'Second Levy']);
  expect(sc.errs).toEqual([]);
});
