// A hero's minor titles on a march and on an order, as the engine did (B-06l): the Swift's and the Sea-Wolf's +1 move
// point (computeMovePoolMax), the Warlock's extra cast in his best school (resolveCastSpellOrder), the Shadow's unseen
// spying (resolveSpyOrder, both places), the Loreseeker's level of Sage (resolveResearchOrder), the Colossus's +2 hit
// points at rest (resolveRestOrder) and the Trailblazer's ×1.05 (resolveExploreOrder), each of which the engine checked
// by the title's key, are now the effects of a stage of movementCost, orderValidity and orderOutcome in the minor
// titles' registry, their numbers in the titles' rows.
// - The move pools: for each set of the Swift and the Sea-Wolf a hero may hold (none, each, both), on a hero alone, a
//   land column, a fleet alone at sea, levies aboard a galleon and a flying column, his pools are the old rule's: the
//   pools of a hero who holds none, each +1 where the pool exists and he holds its title.
// - Each runner alone: what each stage's effect gives, from its title's row, for a holder and for a hero who holds
//   none; whether he holds a title is asked only of the titles of the stage that act, in the stage's order.
// - The rows: one title's row names each new number (the Trailblazer's 1.05, the Colossus's 2, the Warlock's 1), so the
//   order form's and the bots' shared rules, which say whether he holds the title, read the same number.
// The orders' own cases, called directly, are beside their orders' others: espionage-orders-called-directly (the
// Shadow, and the dice he draws), research-and-practice-orders-called-directly (the Loreseeker, the Colossus),
// cast-spell-order-called-directly (the Warlock), explore-and-search-orders-called-directly (the Trailblazer).
// Level 1 (unit): computeMovePoolMax is a function of the turn's context, on the engine's modules (a world the engine
// makes from a fixed seed, no turn played); the runners are functions of what they are handed. A static test can't run
// them, and the matrix may never give a hero the Sea-Wolf with a fleet alone at sea, nor the Swift with no land pool.
// No die is drawn.
import '../lib/the-whole-engine.ts';
import { afterAll, expect, test } from 'vitest';
import {
  MINOR_TITLES,
  type AMinorTitleAsItsRowWritesIt,
  type AMinorTitlesSlug,
} from '../../src/content/the-minor-titles-their-keys-names-perks-requirements-and-how-each-holder-is-found.ts';
import {
  aHerosTitlesKeepHisSpyingUnseen,
  theCastsAHerosTitlesAddInHisBestSchool,
  theFactorAHerosTitlesMultiplyTheShareOfAProvinceHeMapsBy,
  theHitPointsAHerosTitlesAddToARestsHeal,
  theLevelsAHerosTitlesAddToHisSageInResearch,
  theMovePointsAHerosTitlesAddToHisPool,
} from '../../src/engine/rules/the-registry-of-the-minor-titles-perks.ts';
import {
  aFreshTurnsContextOnTheWorld,
  botWorld,
  loadTheEngineOnItsModules,
  quietEngineLog,
} from '../lib/the-middle-of-a-bot-world-in-a-turn-on-the-engines-modules.ts';

const engine = await loadTheEngineOnItsModules({ seed: 1 });
const restoreLog = quietEngineLog(engine);
afterAll(restoreLog);
const world = botWorld(engine, 2, { cols: 10, rows: 6 }, { seaPct: 20 });
const tc = aFreshTurnsContextOnTheWorld(engine, world);
interface Pools {
  land: number;
  sea: number;
  seaActive: boolean;
  cap: string;
}
const thePools = await import('../../src/engine/units/movement-pools.ts');
const computeMovePoolMax = thePools.computeMovePoolMax as unknown as (t: typeof tc, c: object) => Pools;

/** A hero of no realm, with no items or discoveries, leading companies of these types. */
const hero = (types: readonly string[]) => ({
  id: 'tst',
  name: 'Tester',
  player: null,
  alive: true,
  skills: { march: 2, naval: 2 },
  items: [],
  armies: types.map((t) => ({ type: t, quality: 'Average', unitName: 'the ' + t })),
});
/** His pools, holding these titles (the holders the turn worked out at its start). */
function hisPools(types: readonly string[], holds: readonly AMinorTitlesSlug[]): Pools {
  const G: Record<string, unknown> = tc.G;
  const was = G['_minorHolders'];
  G['_minorHolders'] = Object.fromEntries(holds.map((t) => [t, { charId: 'tst' }]));
  try {
    return computeMovePoolMax(tc, hero(types));
  } finally {
    G['_minorHolders'] = was;
  }
}

const THE_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  'a hero alone': [],
  'a land column': ['Shieldwall Levies', 'Free Lances'],
  'a fleet alone at sea': ['Corsair Fleet'],
  'levies aboard a galleon': ['Shieldwall Levies', 'Galleon Fleet'],
  'a flying column': ['Thunderbirds'],
};
const EVERY_SET: readonly (readonly AMinorTitlesSlug[])[] = [[], ['swift'], ['seawolf'], ['swift', 'seawolf']];

test.for(Object.entries(THE_COLUMNS))(
  "%s: his pools under the Swift and the Sea-Wolf are the old rule's (+1 each, where the pool exists)",
  ([column, types]) => {
    const none = hisPools(types, []);
    for (const holds of EVERY_SET) {
      const theOldRule = {
        ...none,
        land: none.land + (holds.includes('swift') && none.land > 0 ? 1 : 0),
        sea: none.sea + (holds.includes('seawolf') && none.sea > 0 ? 1 : 0),
      };
      expect(hisPools(types, holds), `${column}, holding ${holds.join(' and ') || 'none'}`).toEqual(theOldRule);
    }
  },
);

test('the columns reach each case: a pool of none on land (a fleet alone), and both pools', () => {
  expect(hisPools(['Corsair Fleet'], ['swift', 'seawolf'])).toMatchObject({
    land: 0,
    sea: hisPools(['Corsair Fleet'], []).sea + 1,
  });
  expect(hisPools(['Shieldwall Levies', 'Free Lances'], ['seawolf']).sea).toBe(0);
});

/** A runner of one of the row's stages: handed whether he holds a title, it gives a number or a yes or no. */
type ARunner = (holds: (t: AMinorTitlesSlug) => boolean) => number | boolean;
/** A runner's asks, in order, and its answer for a hero who holds the titles named. */
function asked(run: ARunner, holding: readonly AMinorTitlesSlug[]) {
  const asks: AMinorTitlesSlug[] = [];
  const answer = run((t) => {
    asks.push(t);
    return holding.includes(t);
  });
  return { answer, asks };
}

const THE_RUNNERS: readonly (readonly [
  stage: string,
  run: ARunner,
  title: AMinorTitlesSlug,
  held: number | boolean,
  none: number | boolean,
])[] = [
  ['the land pool', (h) => theMovePointsAHerosTitlesAddToHisPool('land', h), 'swift', 1, 0],
  ['the sea pool', (h) => theMovePointsAHerosTitlesAddToHisPool('sea', h), 'seawolf', 1, 0],
  ['the casts in his best school', theCastsAHerosTitlesAddInHisBestSchool, 'warlock', 1, 0],
  ['his spying unseen', aHerosTitlesKeepHisSpyingUnseen, 'shadow', true, false],
  ['his Sage in research', theLevelsAHerosTitlesAddToHisSageInResearch, 'loreseeker', 1, 0],
  ["a rest's heal", theHitPointsAHerosTitlesAddToARestsHeal, 'colossus', 2, 0],
  ['the share of a province he maps', theFactorAHerosTitlesMultiplyTheShareOfAProvinceHeMapsBy, 'trailblazer', 1.05, 1],
];
test.for(THE_RUNNERS)("%s: its title alone gives its row's number, asked of it alone", ([, run, title, held, none]) => {
  const everyOtherTitle = MINOR_TITLES.map((t) => t.key).filter((k) => k !== title);
  expect(asked(run, [title]), 'its holder').toEqual({ answer: held, asks: [title] });
  expect(asked(run, []), 'a hero who holds none').toEqual({ answer: none, asks: [title] });
  expect(asked(run, everyOtherTitle), 'a hero who holds every other title').toEqual({ answer: none, asks: [title] });
});

test("one title's row names each of the new numbers: the Trailblazer's ×1.05, the Colossus's +2, the Warlock's +1", () => {
  const rows: readonly AMinorTitleAsItsRowWritesIt[] = MINOR_TITLES;
  const named = (field: keyof AMinorTitleAsItsRowWritesIt) =>
    rows.filter((row) => row[field] !== undefined).map((row) => [row.key, row[field]]);
  expect(named('theShareOfAProvinceItsHolderMapsIsMultipliedBy')).toEqual([['trailblazer', 1.05]]);
  expect(named('theHitPointsItsHolderRecoversMoreWhenResting')).toEqual([['colossus', 2]]);
  expect(named('theSpellsMoreItsHolderMayCastInHisBestSchoolEachTurn')).toEqual([['warlock', 1]]);
});
