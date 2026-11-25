// The reports read a realm of none and a fallen hero of none as the alignment its row names (B-06, T7, the rules pulled
// out: Run 3e's portal row, B-06br), THE_ALIGNMENT_A_REALM_OF_NONE_READS_AS (Neutral), through the engine's helper
// (theAlignmentARealmReadsAs, src/engine/rules-on-plain-values/):
// - a wandering hero's hire price, in the hero sightings (what each realm may see's otherHeroAsSeen) and in the hire
//   data the order form reads (its provinceAsSeen), for a realm of no alignment or of an empty one: the price a realm of
//   the row's alignment is quoted;
// - a fallen hero of no alignment on the report (src/views/turn-report.ts): the row's alignment; one of an alignment
//   keeps his.
// Level 1 (unit): the report built by buildTurnReport on what realm 0 may see (playerView) of a world the engine makes
// on its modules (tests/lib/a-staged-turn-on-the-engines-modules.ts) from KC_SEED, the realm's alignment, the wanderer
// (his race, alignment, temper and skills) and the fallen heroes staged by the test. Not lower: the price and the grave
// are worked out from the realm and the hero in the view. No matrix game holds a realm or a fallen hero of none.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { THE_ALIGNMENT_A_REALM_OF_NONE_READS_AS } from '../../src/content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import { aStagedTurnOnTheEnginesModules } from '../lib/a-staged-turn-on-the-engines-modules.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

interface AWorld {
  turn: number;
  players: Record<string, unknown>[];
  characters: {
    id: number;
    player: number | null;
    alive?: boolean;
    isKing?: boolean;
    location: number;
    [key: string]: unknown;
  }[];
  world: { provinces: { id: number; name: string; characters?: number[] }[] };
  heroGraveyard?: Record<string, unknown>[];
}
interface AReport {
  heroSightings?: { name: string; pay?: number }[];
  provinceOrderData?: Record<string, { availableHeroes?: { id: number; hireWage?: number | null }[] }>;
  knownDeadHeroes?: { id: number; alignment?: string }[];
}

/** A world of two realms from KC_SEED, and what the report of realm 0, of the alignment given (none: the key left
 *  out), says of an Undead wanderer standing in its capital and of three fallen heroes of its own. */
async function theReportOfARealmOf(alignment: string | undefined) {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { playerView } = await import('../../src/views/what-each-realm-may-see-of-the-world.ts');
  const { buildTurnReport } = await import('../../src/views/turn-report.ts');
  const { S } = sc.world({ realms: 2 });
  const G = S as unknown as AWorld;
  const [realm0] = G.players;
  const king = G.characters.find((c) => c.alive && c.player === 0 && c.isKing);
  const home = king && G.world.provinces[king.location];
  if (!realm0 || !king || !home) throw new Error('could not stage: a realm, its king in a province');
  if (alignment === undefined) delete realm0['alignment'];
  else realm0['alignment'] = alignment;
  const id = Math.max(...G.characters.map((c) => c.id)) + 1;
  G.characters.push({
    id,
    name: 'Morwen the Pale (wandering)',
    player: null,
    alive: true,
    race: 'Human',
    alignment: 'Undead',
    temper: 'Brave',
    hp: 20,
    maxHp: 20,
    skills: { melee: 2, archery: 1 },
    items: [],
    armies: [],
    location: home.id,
    locationName: home.name,
    pay: 1,
  });
  home.characters = [...(home.characters ?? []), id];
  const aGrave = (graveId: number, more: Record<string, unknown>) => ({
    id: graveId,
    name: `Fallen ${String(graveId)}`,
    player: 0,
    killedOnTurn: G.turn,
    location: king.location,
    skills: {},
    temper: 'Brave',
    ...more,
  });
  G.heroGraveyard = [aGrave(9001, {}), aGrave(9002, { alignment: '' }), aGrave(9003, { alignment: 'Evil' })];
  realm0['knownDeadHeroIds'] = [9001, 9002, 9003];
  const rep = buildTurnReport(playerView(S as never, 0)) as AReport;
  const seen = (rep.heroSightings ?? []).find((s) => s.name.includes('Morwen'));
  const offered = Object.values(rep.provinceOrderData ?? {})
    .flatMap((pd) => pd.availableHeroes ?? [])
    .find((h) => h.id === id);
  const alignmentOf = (graveId: number) => (rep.knownDeadHeroes ?? []).find((g) => g.id === graveId)?.alignment;
  return {
    price: [seen?.pay, offered?.hireWage],
    fallen: [alignmentOf(9001), alignmentOf(9002), alignmentOf(9003)],
  };
}

describe("a realm of none's report reads it as the alignment its row names", () => {
  test("a wanderer's price, sighted and for hire: the price a realm of the row's alignment is quoted", async () => {
    const asTheRow = await theReportOfARealmOf(THE_ALIGNMENT_A_REALM_OF_NONE_READS_AS);
    expect(asTheRow.price, "the row's alignment: a 2g rate, +1g for the steps to Undead, +0g for skill").toEqual([
      3, 3,
    ]);
    expect((await theReportOfARealmOf(undefined)).price, 'a realm of no alignment').toEqual(asTheRow.price);
    expect((await theReportOfARealmOf('')).price, 'a realm of an empty alignment').toEqual(asTheRow.price);
  });
  test("a fallen hero of no alignment, or an empty one, reads as the row's alignment; one of an alignment keeps his", async () => {
    const none = THE_ALIGNMENT_A_REALM_OF_NONE_READS_AS;
    expect((await theReportOfARealmOf(none)).fallen).toEqual([none, none, 'Evil']);
  });
});
