// 2026-10-09 (item 7, Toby's ruling): Warg Riders' Run Them Down. A warg-heavy victor runs the beaten army down ON THE
// FIELD (each beaten unit +15% to be destroyed in the rout) and never sets off after the beaten commander. Before, the
// wargs took up a chase that replaced the commander's own orders in later phases. Here an Orc general (realm 0's
// king, six Elite Warg Riders) takes realm 1's province in Spring from its king (two Green Light Infantry) and is
// ordered home in Early Summer: he must go home, and no chase must start.
//
// Level 2 (scenario): what is checked spans the turn's phases (the battle in Spring, the march home in Early Summer, no
// chase in any phase), so only a whole turn shows it; played on the engine's modules
// (tests/lib/a-staged-turn-on-the-engines-modules.ts), on a world made from KC_SEED. The scene is chosen and set by
// the staging, on every world: the land province with the most land neighbours (the one taken), its first land
// neighbour (the general's start, his own) and another beyond it (realm 1's), all three cleared of every other
// character; the win is not luck (six Elite Warg Riders against two Green companies).
// "No chase is taken up" reads the kind of every line the turn stores (theTurnsLinesInWords, which buildReports calls
// from its own file: a vi.spyOn on its module records each call): none is of a chase's kinds
// (THE_AUDIENCE_OF_EACH_KIND_OF_A_CHASES_LINE). The recorder is shown reached: it sees the Run Them Down line's kind.
//
// Until plan P1-14c this was tests/warg-run-down.test.js, a turn on the GM portal (lib/scenario.js) that searched the
// map for the scene, and whose chase check matched three phrases, two of them no line has held since the wargs'
// chase was retired ("need no order", "already away after"). Its checks are kept, that one by every chase kind.
import { expect, test, vi } from 'vitest';
import { aStagedTurnOnTheEnginesModules, order, plan } from '../lib/a-staged-turn-on-the-engines-modules.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

interface Province {
  id: number;
  row: number;
  col: number;
  name: string;
  terrain: string;
  owner: number | null;
  characters?: number[];
  [key: string]: unknown;
}
interface Character {
  id: number;
  name: string;
  player: number | null;
  alive?: boolean;
  isKing?: boolean;
  location: number;
  locationName?: string;
  armies?: { type: string; quality: string; unitName: string }[];
}
interface World {
  relations?: Record<string, string>;
  players: { provinces: number[] }[];
  characters: Character[];
  world: { cols: number; rows: number; provinces: Province[] };
}

test('a warg-heavy victor runs the beaten down on the field, takes up no chase, and marches home on his own order', async () => {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { getNeighborsP } = await import('../../src/engine/world/map-helpers.ts');
  const words = await import('../../src/views/prose/the-words-of-each-line.ts');
  const { THE_AUDIENCE_OF_EACH_KIND_OF_A_CHASES_LINE } =
    await import('../../src/engine/heroes/the-facts-a-chases-lines-record.ts');
  // The kind of each line the turn stores, as buildReports reads them.
  const kinds: (string | null)[] = [];
  const theTurnsLinesInWords = words.theTurnsLinesInWords;
  vi.spyOn(words, 'theTurnsLinesInWords').mockImplementation((...args: Parameters<typeof theTurnsLinesInWords>) => {
    const inWords = theTurnsLinesInWords(...args);
    kinds.push(...inWords.theKindOfEachStoredLine);
    return inWords;
  });

  const land = (p: Province | null | undefined): p is Province => p != null && p.terrain !== 'sea';
  const landNeighbours = (S: World, p: Province) =>
    (getNeighborsP(p, S.world.cols, S.world.rows, S.world.provinces) as (Province | null)[]).filter(land);
  const place = (S: World, c: Character, p: Province) => {
    S.world.provinces.forEach((q) => {
      q.characters = (q.characters ?? []).filter((id) => id !== c.id);
    });
    p.characters = [...(p.characters ?? []), c.id];
    c.location = p.id;
    c.locationName = p.name;
  };
  const own = (S: World, p: Province, pi: number) => {
    S.players.forEach((pl) => {
      pl.provinces = pl.provinces.filter((id) => id !== p.id);
    });
    p.owner = pi;
    S.players[pi]?.provinces.push(p.id);
    Object.assign(p, { neutralDefenders: [], npcArmies: 0, features: [], garrisonArmies: [] });
  };
  const army = (type: string, n: number, quality: string) =>
    Array.from({ length: n }, (_, i) => ({ type, quality, unitName: `${type} ${String(i + 1)}` }));

  const r = sc.turn<World, { A: Character; B: Character; X: Province; Z: Province }>({
    cols: 10,
    rows: 6,
    seaPct: 10,
    prepare(S) {
      S.relations = { ...S.relations, '0-1': 'enemy' };
      const A = S.characters.find((c) => c.alive && c.player === 0 && c.isKing);
      const B = S.characters.find((c) => c.alive && c.player === 1 && c.isKing);
      // X: the province taken, the land province with the most land neighbours (the first such); Z: the general's
      // start, its first land neighbour; Y: realm 1's ground beyond, a land neighbour of X's not beside Z if any.
      const X = S.world.provinces
        .filter(land)
        .reduce<Province | undefined>(
          (best, p) => (!best || landNeighbours(S, p).length > landNeighbours(S, best).length ? p : best),
          undefined,
        );
      const around = X ? landNeighbours(S, X) : [];
      const Z = around[0];
      const Y =
        Z && around.find((q) => q.id !== Z.id && !landNeighbours(S, Z).some((z) => z.id === q.id))
          ? around.find((q) => q.id !== Z.id && !landNeighbours(S, Z).some((z) => z.id === q.id))
          : around[1];
      if (!A || !B || !X || !Y || !Z || around.length < 3)
        throw new Error('could not stage: no king, or no land province with three land neighbours');
      const scene = [X.id, Y.id, Z.id];
      S.characters = S.characters.filter((c) => c.player != null || !scene.includes(c.location));
      [X, Y, Z].forEach((p) => {
        p.characters = (p.characters ?? []).filter((id) => S.characters.some((c) => c.id === id));
      });
      own(S, X, 1);
      own(S, Y, 1);
      own(S, Z, 0);
      place(S, A, Z);
      A.armies = army('Warg Riders', 6, 'Elite'); // overwhelming, so the win is not luck
      place(S, B, X);
      B.armies = army('Light Infantry', 2, 'Green');
      return { A, B, X, Z };
    },
    orders: (_S, c) => ({ [c.A.id]: plan(order('move', c.X.id), order('move', c.Z.id)) }),
  });
  const { A, X, Z } = r.extra;
  const t = r.text();
  const spring = r.log
    .filter((e) => e.phase === 0)
    .map((e) => e.text)
    .join('\n');
  expect(
    /Battle for /.test(spring) && spring.includes(`${A.name}'s forces defeat`),
    `${A.name}'s wargs win the battle for ${X.name} (staging)`,
  ).toBe(true);
  expect(spring, 'the battle report shows the wargs running the beaten army down (+15% losses)').toMatch(
    /Warg Riders run down the broken companies .*\(\+15% losses/,
  );
  expect(kinds, "the recorder sees the Run Them Down line's kind (it is reached)").toContain(
    "the winner's warg riders run down the broken companies",
  );
  expect(kinds.length, 'the recorder sees every line the turn stores').toBe(r.log.length);
  const chaseKinds = new Set<string>(Object.keys(THE_AUDIENCE_OF_EACH_KIND_OF_A_CHASES_LINE));
  expect(
    kinds.filter((k) => k != null && chaseKinds.has(k)),
    'no chase is taken up after the battle: no line of a chase’s kinds in the turn',
  ).toEqual([]);
  expect(t.includes('on the trail of'), 'no chase is taken up after the battle').toBe(false);
  expect(
    r.log.some(
      (e) =>
        /(rides|presses on) into|runs .* to ground|closing on/.test(e.text ?? '') && (e.text ?? '').includes(A.name),
    ),
    'no pursuit move or chase battle later in the turn',
  ).toBe(false);
  const after = (r.S2['characters'] as Character[]).find((c) => c.id === A.id);
  expect(after?.location, `${A.name} obeys his own order and marches home to ${Z.name} in Early Summer`).toBe(Z.id);
});
