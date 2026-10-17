// Mercenary band ids (P1-18b): a band made during a turn is named `merc_t<turn>_<n>`, counted afresh each turn, with
// no clock and no dice in it, so the turn's dice don't depend on how many bands it makes. The `merc_` prefix the
// hire code tests for is kept, and the form can't meet an old `merc_<ms>_<b36>` id.
// Level 2 (scenario): the ids are made inside runTurn, by a nested function, so only a real turn reaches them.
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

test('bands made in a turn are numbered for the turn, and can be hired by that id', async () => {
  const r = await sc.turn<World, { king: number; turn: number }>({
    realms: 2,
    prepare(S) {
      const king = S.characters.find((c) => c.alive !== false && c.player === 0);
      if (!king) throw new Error('realm 0 has no hero');
      king.armies = [
        { type: 'Shieldwall Levies', quality: 'Average', unitName: 'First Levy' },
        { type: 'Shieldwall Levies', quality: 'Average', unitName: 'Second Levy' },
      ];
      (S.players[0] ?? {}).gold = 50;
      S.mercenaries = [];
      return { king: king.id, turn: S.turn };
    },
    orders: (_S, x) => ({
      [x.king]: plan(order('disband_army', 'all'), order('recruit', `merc:merc_t${String(x.turn)}_2`)),
    }),
  });
  const S2 = r.S2 as World;
  const t = r.extra.turn;
  expect(r.text(r.extra.king)).toMatch(/hires mercenary band Second Levy/);
  expect((S2.mercenaries ?? []).map((m) => m.id)).toEqual([`merc_t${String(t)}_1`]);
  const king = S2.characters.find((c) => c.id === r.extra.king);
  expect((king?.armies ?? []).map((a) => a.unitName)).toContain('Second Levy');
  expect(sc.errs).toEqual([]);
});
