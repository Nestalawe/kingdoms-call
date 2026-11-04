// Properties of three rules lifted out of resolveTurn in plan P1-08f (fast-check, seeded from KC_SEED):
//   • flee spoils (duelFleeItemDrop): a character who breaks off a fight with another may drop one item, which the one
//     who held the field takes. Nothing is made or lost: the two carry the same items between them before and after,
//     at most one changes hands, Mithril never does, and only a roll within the 50% chance drops anything;
//   • the Hunting Rumours reading (rumourOddsBand): every kill rate from 0% to 100% reads as exactly one band, and a
//     higher rate never reads worse;
//   • the Hunting Rumours sandbox (simulateLairOdds): the background fights write nothing to the world, the hero, the
//     lair or the GM's log, and the odds are a whole percentage of the fights won.
// Level 1 (unit): each function called directly on the engine's modules (tests/lib/personal-combat.ts), on a world the engine
// makes. The matrix runs all three; these say what holds for any input, not only the matrix's games.
// Since P1-10b23 (the duels' file freed of its ts-nocheck line), the case its changed lines no matrix game reaches asked
// for: flee spoils on a battle's copies of the two heroes reach the real heroes, and each copy keeps in step.
import fc from 'fast-check';
import { expect, test } from 'vitest';
import { clone, personalCombatEngine, type Character } from '../lib/personal-combat.ts';
import { timeLimitForPropertyRuns } from '../lib/time-limits.ts';

// fast-check's run count (tests/setup/fast-check.ts): 100, or 1,000 under KC_FULL. Each property's time limit is 50
// ms an input, so npm test's 100 keep Vitest's 5 s and KC_FULL's 1,000 get 50 s (tests/lib/time-limits.ts).
const RUNS = fc.readConfigureGlobal().numRuns ?? 100;

const { call, pinned, turnContext, MON } = await personalCombatEngine();
const { ALL_MAGIC_ITEMS_P, LEGENDARY_ITEMS_P } = await import('../../src/content/kingdoms-call-data.ts');
const { MITHRIL_ARMOUR } = await import('../../src/engine/heroes/fame-and-consecration.ts');
const { RUMOUR_ODDS_BANDS } =
  await import('../../src/engine/rules-on-plain-values/the-bands-hunting-rumours-reads-a-heros-odds-in-and-the-key-a-lair-is-remembered-by.ts');
const G = turnContext.G as { characters: Character[]; players: Record<string, unknown>[] };

type Item = { name: string; tier?: unknown; effect?: { stat?: string }; [key: string]: unknown };
/** The game's item tables and Mithril (a relic the Dwarves are granted), one of each name and tier. */
const ITEMS = ([...ALL_MAGIC_ITEMS_P, ...LEGENDARY_ITEMS_P, MITHRIL_ARMOUR] as Item[]).filter(
  (it, i, all) => all.findIndex((x) => x.name === it.name && x.tier === it.tier) === i,
);
const MITHRIL = ITEMS.findIndex((it) => it.effect?.stat === 'mithrilArmour');
const [runner, stayer] = G.characters.filter((c) => c.alive && c.player != null);
const names = (items: Item[]) => items.map((it) => `${it.name}|${String(it.tier)}`).sort();

test(
  'flee spoils: no item is made or lost, at most one changes hands, Mithril never does',
  timeLimitForPropertyRuns(RUNS, 50),
  () => {
    if (!runner || !stayer || MITHRIL < 0) throw new Error('no two heroes, or no Mithril in the item tables');
    const index = fc.oneof(fc.constant(MITHRIL), fc.integer({ min: 0, max: ITEMS.length - 1 }));
    fc.assert(
      fc.property(
        fc.uniqueArray(index, { maxLength: 6 }),
        fc.uniqueArray(index, { maxLength: 3 }),
        fc.integer({ min: 1, max: 100 }),
        fc.double({ min: 0, max: 0.9999, noNaN: true }),
        (mine, theirs, roll, pick) => {
          runner.items = mine.map((i) => clone(ITEMS[i] as Item));
          stayer.items = theirs.map((i) => clone(ITEMS[i] as Item));
          const before = names([...(runner.items as Item[]), ...(stayer.items as Item[])]);
          const runnerHad = (runner.items as Item[]).slice();
          // the d100 roll (the dice's next value, made to give it), then which item drops
          const dropped = pinned([(roll - 0.5) / 100, pick], () =>
            call('duelFleeItemDrop', { kind: 'character', ref: runner }, { kind: 'character', ref: stayer }, []),
          ) as Item | null;
          const after = names([...(runner.items as Item[]), ...(stayer.items as Item[])]);
          expect(after).toEqual(before);
          const moved = runnerHad.filter((it) => !(runner.items as Item[]).includes(it));
          expect(moved).toEqual(dropped ? [dropped] : []);
          expect(dropped?.effect?.stat).not.toBe('mithrilArmour');
          expect(dropped == null || (stayer.items as Item[]).includes(dropped)).toBe(true);
          const couldDrop = runnerHad.some((it) => it.effect?.stat !== 'mithrilArmour');
          expect(dropped != null).toBe(couldDrop && roll <= 50);
        },
      ),
    );
  },
);

test('flee spoils on a battle’s copies: the item leaves the real runner for the real stayer, and each copy keeps in step', () => {
  if (!runner || !stayer) throw new Error('no two heroes');
  const [first] = ITEMS.filter((it) => it.effect?.stat !== 'mithrilArmour');
  if (!first) throw new Error('no item in the item tables');
  const had = [runner.items, stayer.items];
  try {
    const [lesser, greater] = [
      { ...clone(first), tier: 1 },
      { ...clone(first), tier: 2 },
    ];
    runner.items = [lesser, greater];
    stayer.items = [];
    // the copies a battle fights on, each holding its own copy of his items (as a copy made through JSON does)
    const runnersCopy = { ...runner, items: runner.items.map((it) => clone(it)) };
    const stayersCopy = { ...stayer, items: [] as Item[] };
    // a d100 of 1 (within the 50% chance), then the first of his items drops
    const dropped = pinned([0.005, 0], () =>
      call('duelFleeItemDrop', { kind: 'character', ref: runnersCopy }, { kind: 'character', ref: stayersCopy }, []),
    );
    expect(dropped).toBe(lesser);
    expect(runner.items).toEqual([greater]);
    expect(stayer.items).toEqual([lesser]);
    // the runner's copy lets go of its copy of the item dropped, and keeps the one of the same name and another tier
    expect(runnersCopy.items.map((it) => it['tier'])).toEqual([2]);
    expect(stayersCopy.items).toEqual([lesser]);
  } finally {
    [runner.items, stayer.items] = had as [Character['items'], Character['items']];
  }
});

test(
  'the Hunting Rumours reading: one band for every kill rate, and a higher rate never reads worse',
  timeLimitForPropertyRuns(RUNS, 50),
  () => {
    const BANDS = RUMOUR_ODDS_BANDS as unknown[];
    const band = (pct: number) => BANDS.indexOf(call('rumourOddsBand', pct));
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), fc.integer({ min: 0, max: 100 }), (a, b) => {
        const [lower, higher] = [Math.min(a, b), Math.max(a, b)];
        expect(band(lower)).toBeGreaterThanOrEqual(0);
        expect(band(lower)).toBeLessThanOrEqual(band(higher));
      }),
    );
    expect(band(0)).toBe(0);
    expect(band(100)).toBe(BANDS.length - 1);
  },
);

test('the Hunting Rumours sandbox writes nothing, and the odds are a whole percentage of the fights won', () => {
  if (!runner) throw new Error('no hero');
  const realm = G.players[runner.player as number];
  if (!realm) throw new Error('the hero has no realm');
  // Staged as a hero in play is: a realm with no record of weaknesses gets an empty one back from the sandbox's
  // snapshot, and a hero's items have been through the equip pass (normaliseEquipment, which any read of their skills
  // runs on every character), so the world's JSON compares whole.
  realm['_knownWeak'] ??= {};
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: MON.length - 1 }),
      fc.record({ melee: fc.nat(9), archery: fc.nat(9), white: fc.nat(9), elemental: fc.nat(9) }),
      fc.uniqueArray(fc.integer({ min: 0, max: ITEMS.length - 1 }), { maxLength: 4 }),
      fc.integer({ min: 1, max: 5 }),
      (g, skills, kit, fights) => {
        runner.skills = { ...runner.skills, ...skills };
        runner.items = kit.map((i) => clone(ITEMS[i] as Item));
        for (const c of G.characters) call('normaliseEquipment', c);
        const feature = { name: 'Ruin', monster: clone(MON[g]), hoardItems: [], _hoardV2: true };
        const world = JSON.stringify(G);
        const lair = JSON.stringify(feature);
        const logLines = turnContext.turnLog.length;
        const odds = call('simulateLairOdds', runner, feature, fights) as { pct: number; wins: number; fights: number };
        expect(JSON.stringify(G)).toBe(world);
        expect(JSON.stringify(feature)).toBe(lair);
        expect(turnContext.turnLog.length).toBe(logLines);
        expect(turnContext['_pcSimulating']).toBe(false);
        expect(odds.fights).toBe(fights);
        expect(odds.wins).toBeGreaterThanOrEqual(0);
        expect(odds.wins).toBeLessThanOrEqual(fights);
        expect(odds.pct).toBe(Math.round((100 * odds.wins) / fights));
      },
    ),
    { numRuns: 50 },
  );
});
