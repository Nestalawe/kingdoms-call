// The check of a saved game at load (plan P1-15d, Decision 4) and the stop (P1-15f8, P1-15's Decision 8 and Choice 1,
// option 1). Once the save is upgraded, upgradeGameState (src/engine/saves/upgrade-a-saved-game-and-check-it.ts) parses
// it against the saved state's schema made strict (src/schemas/where-a-saved-game-differs-from-this-builds-schema.ts) and
// returns each place it differs, by its path and its kind. Before the turn, the GM page's shell runs the same on a copy
// (whatTheSavesCheckFindsBeforeTheTurn, src/engine/saves/the-saves-check-before-a-turn-and-the-known-leaks-it-lets-
// through.ts): a place not on its known list stops the turn; a known one lets it run, and the GM is told. On the
// made-up save of version 1 (tests/fixtures/saves/version-1.json):
// - as it is, the check finds nothing, nothing stops the turn, and the turn's GM log says nothing of it;
// - with a battle's mark left on a hero's company (`_flakTargeted`, not on the list) the stop names its path and field,
//   never its value; the copy leaves the loaded save as it was; resolveTurn itself still runs and tells (the matrix
//   fails a game on it), the GM's log holding one line, which no realm's report holds;
// - with a known leak (a battle's cut left on a garrison company) the turn runs and is told;
// - the known list: each entry anchored and naming its Parked entry, each letting exactly its place through;
// - the check on a copy draws none of the page's dice, an old world's lairs' renaming included;
// - the check never replaces the save; each kind is named without its value; at most ten places, then a count, in the
//   words of the told turn and of the stopped one;
// - a special's range that deals damage with no weight (left by version 2's step) stops the turn;
// - a save that isn't a game in play is refused before anything changes, by the upgrade and by the turn (the stop
//   names no place: the turn refuses it, in its own words).
// Level 1 (unit): the upgrade, the check and the stop's list are functions of a save, and one turn of the three-realm
// fixture, played on the engine's modules imported directly, takes about a second; a static test can't parse a save,
// and the GM page's message is the page test's (tests/page/turn-shell.test.ts, "the GM page plays a turn from a
// version-0 save").
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The check of a saved game at load (`upgradeGameState`'s last step: the save parsed against the saved state's schema
// made strict) and the GM page's stop before the turn (`whatTheSavesCheckFindsBeforeTheTurn`, P1-15f8: on a copy, a
// place not on `THE_KNOWN_LEAKS_A_TURN_STILL_RUNS_ON` stops the turn), on the version-1 fixture: as it is, nothing is
// found or stops the turn and the GM's log says nothing; with a battle's mark left on a hero's company
// (`_flakTargeted`), the stop names `characters.0.armies.2: a field this build doesn't know, _flakTargeted` and never
// its value, and leaves the loaded save (text or object) as it was; `resolveTurn` itself still runs, its GM log holding
// one `[Save check]` line (to no realm, at the turn's end), no realm's report (bots' too) holding any of it, and hands
// the shell the list; a known leak (`_tempStrReduction` on a garrison company) is let through and told; each known
// entry is anchored, names its Parked entry and lets exactly its place through (not the field on a hero's company, nor
// another field on a garrison company); the check on an old world without `_lairNamesV3` leaves the page's next draw
// as it was; a field of a later build is kept by the upgrade and in the save the turn writes (the check is not the
// save); a field of the wrong kind holding a text, a missing field and a key that isn't a field's name (shown as "(a
// key)") are named without their values; twelve places: all found, ten named and two counted, as told and as stopped;
// a special's damaging range with no weight stops the turn; a save that isn't a game in play is refused by the upgrade
// and the turn, the stop naming nothing. The stop's cases fail on their base (no stop). Planted on copies (`/tmp`, each
// red): the check taken out, the turn playing the parse's output, a key shown as it is, the GM's line told to a realm
// or left out, a save that isn't a game in play let through, the known list emptied, an entry unanchored, the copy's
// dice not lent, the stop run on the loaded save. Level 1: the upgrade, the check and the stop are functions of a save,
// one turn of the fixture by direct import about a second; a static test can't parse a save, and the turn's message is
// the page test's (`turn-shell`). TypeScript, in `unit/`
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import '../lib/the-whole-engine.ts';
import { resolveTurn } from '../../src/engine/run-turn.ts';
import { upgradeGameState } from '../../src/engine/saves/upgrade-a-saved-game-and-check-it.ts';
import {
  THE_KNOWN_LEAKS_A_TURN_STILL_RUNS_ON,
  whatTheSavesCheckFindsBeforeTheTurn,
} from '../../src/engine/saves/the-saves-check-before-a-turn-and-the-known-leaks-it-lets-through.ts';
import { kcRng } from '../../src/engine/rng.ts';
import {
  THE_CHECKS_FINDINGS_NAMED_AT_MOST,
  whatTheSavesCheckFoundInWords,
  whyTheSavesCheckStoppedTheTurnInWords,
} from '../../src/views/prose/what-the-saves-check-found-in-words.ts';
import { aStagedTurnOnTheEnginesModules, type Line } from '../lib/a-staged-turn-on-the-engines-modules.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;
const FIXTURE = fs.readFileSync(path.join(import.meta.dirname, '../fixtures/saves/version-1.json'), 'utf8');

type Obj = Record<string, unknown>;
/** The save as the upgrade takes it. */
type Save = Parameters<typeof upgradeGameState>[0];
const aCopyOfTheFixture = (): Obj => JSON.parse(FIXTURE) as Obj;
const listIn = (o: Obj, key: string): Obj[] => {
  const v = o[key];
  return Array.isArray(v) ? v.filter((x): x is Obj => typeof x === 'object' && x !== null) : [];
};
const must = <T>(x: T | undefined, what: string): T => {
  if (x === undefined) throw new Error(`the fixture holds no ${what}`);
  return x;
};
/** The upgrade's call on a save staged as a plain object (the test's staging is untyped, as a loaded save is). */
const upgrade = (save: Obj) => upgradeGameState(save as unknown as Save);
/** The check's findings for a save, on a copy. */
const findingsFor = (save: Obj): string[] => upgrade(structuredClone(save)).whereTheSaveDiffersFromThisBuildsSchema;

/** The slot rows of the fixture's all-bot game, as the shell loads them. */
const botRows = (save: Obj) =>
  listIn(save, 'players').map((_, pi) => ({
    id: 'G1gp' + String(pi),
    game_id: 'G1',
    user_id: null,
    player_index: pi,
    display_name: 'Realm' + String(pi),
    orders_submitted: false,
    orders: null,
    turn_report: JSON.stringify({ isBot: true, playerSetup: {} }),
  }));

/** Realm 0's king (characters.0 in the fixture), leading three companies: a battle's mark on his third. */
const A_LEAKED_MARKS_VALUE = 'Captain Ostrel of the Ember Coast';
function withALeakedMark(): Obj {
  const save = aCopyOfTheFixture();
  const king = must(listIn(save, 'characters')[0], 'hero');
  if (king['id'] !== 0 || king['player'] !== 0) throw new Error('characters.0 is no longer realm 0’s king');
  must(listIn(king, 'armies')[2], 'third company of realm 0’s king')['_flakTargeted'] = A_LEAKED_MARKS_VALUE;
  return save;
}
const THE_LEAKED_MARK = "characters.0.armies.2: a field this build doesn't know, _flakTargeted";
const saveCheckLines = (log: Line[]) => log.filter((l) => (l.text ?? '').startsWith('[Save check] '));

/** A battle's cut left on the fixture's first garrison company (world.provinces.12.garrisonArmies.0): a known leak. */
function withAKnownLeak(): Obj {
  const save = aCopyOfTheFixture();
  const provinces = listIn(must(save['world'] as Obj | undefined, 'world'), 'provinces');
  must(listIn(must(provinces[12], 'province 12'), 'garrisonArmies')[0], 'garrison company in province 12')[
    '_tempStrReduction'
  ] = 3;
  return save;
}
const THE_KNOWN_LEAK = "world.provinces.12.garrisonArmies.0: a field this build doesn't know, _tempStrReduction";

describe('a save as this build writes it', () => {
  test('the check finds nothing, nothing stops the turn, and the GM log says nothing of it', async () => {
    expect(findingsFor(aCopyOfTheFixture())).toEqual([]);
    expect(whatTheSavesCheckFindsBeforeTheTurn(FIXTURE)).toEqual({
      placesThatStopTheTurn: [],
      knownPlacesTheTurnRunsOn: [],
    });
    const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
    const played = sc.play(FIXTURE, botRows(aCopyOfTheFixture()));
    expect(played.S2.turn).toBe(5);
    expect(saveCheckLines(played.log)).toEqual([]);
  });
});

describe('the turn itself still runs on a save the check finds a place in, and tells the GM (the stop is the shell’s)', () => {
  test("the upgrade names the leaked mark's path and field, and not its value", () => {
    expect(findingsFor(withALeakedMark())).toEqual([THE_LEAKED_MARK]);
  });

  test("the turn runs, the GM's log names it in one line, and no realm's report holds any of it", async () => {
    const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
    sc.reportEveryRealm();
    const save = withALeakedMark();
    const played = sc.play(JSON.stringify(save), botRows(save));
    expect(played.S2.turn, 'the turn ran').toBe(5);
    const lines = saveCheckLines(played.log);
    expect(lines.map((l) => l.text)).toEqual([`[Save check] ${whatTheSavesCheckFoundInWords([THE_LEAKED_MARK])}`]);
    expect(lines[0]?.text).toContain(THE_LEAKED_MARK);
    expect(lines.map((l) => [l['targets'] ?? [], l.phase])).toEqual([[[], 99]]);
    expect(JSON.stringify(played.log)).not.toContain(A_LEAKED_MARKS_VALUE);
    const reports = Object.entries(played.reports);
    expect(reports.map(([pi]) => pi)).toEqual(['0', '1', '2']);
    for (const [pi, report] of reports) {
      const text = JSON.stringify(report);
      for (const word of ['_flakTargeted', 'Save check', 'this build', A_LEAKED_MARKS_VALUE])
        expect(text.includes(word), `realm ${pi}'s report holds ${word}`).toBe(false);
    }
  });

  test('the turn hands the shell what the check found', () => {
    const save = withALeakedMark();
    const quiet = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      const resolved = resolveTurn(JSON.stringify(save), botRows(save), 4, 1) as {
        whereTheSaveDiffersFromThisBuildsSchema: unknown;
      };
      expect(resolved.whereTheSaveDiffersFromThisBuildsSchema).toEqual([THE_LEAKED_MARK]);
    } finally {
      quiet.mockRestore();
    }
  });
});

describe('the stop: a place not on the known list stops the turn, before anything changes', () => {
  test('the leaked mark stops the turn: its path and field, not its value', () => {
    const found = whatTheSavesCheckFindsBeforeTheTurn(JSON.stringify(withALeakedMark()));
    expect(found).toEqual({ placesThatStopTheTurn: [THE_LEAKED_MARK], knownPlacesTheTurnRunsOn: [] });
    expect(JSON.stringify(found)).not.toContain(A_LEAKED_MARKS_VALUE);
  });

  test('the check runs on a copy: the loaded save, as text or as an object, is left as it was', () => {
    const save = withALeakedMark();
    delete save['_lairNamesV3']; // an old world: the upgrade would rename its lairs
    const asText = JSON.stringify(save);
    const as = structuredClone(save);
    expect(whatTheSavesCheckFindsBeforeTheTurn(save).placesThatStopTheTurn).toEqual([THE_LEAKED_MARK]);
    expect(save).toEqual(as);
    expect(whatTheSavesCheckFindsBeforeTheTurn(asText).placesThatStopTheTurn).toEqual([THE_LEAKED_MARK]);
  });

  test('a known leak lets the turn run: the turn is told, as before', async () => {
    const save = withAKnownLeak();
    expect(whatTheSavesCheckFindsBeforeTheTurn(JSON.stringify(save))).toEqual({
      placesThatStopTheTurn: [],
      knownPlacesTheTurnRunsOn: [THE_KNOWN_LEAK],
    });
    const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
    const played = sc.play(JSON.stringify(save), botRows(save));
    expect(played.S2.turn, 'the turn ran').toBe(5);
    expect(saveCheckLines(played.log).map((l) => l.text)).toEqual([
      `[Save check] ${whatTheSavesCheckFoundInWords([THE_KNOWN_LEAK])}`,
    ]);
  });

  test("a special's range that deals damage with no weight (version 2's step leaves it) stops the turn", () => {
    const save = aCopyOfTheFixture();
    const lair = listIn(must(save['world'] as Obj | undefined, 'world'), 'provinces')
      .flatMap((p) => listIn(p, 'features'))
      .find((f) => listIn((f['monster'] as Obj | undefined) ?? {}, 'spells').length > 0);
    const special = must(listIn(must(lair?.['monster'] as Obj | undefined, 'guardian'), 'spells')[0], 'special');
    delete special['dmgW'];
    special['dmg'] = [2, 5];
    const stops = whatTheSavesCheckFindsBeforeTheTurn(JSON.stringify(save)).placesThatStopTheTurn;
    expect(stops.map((p) => p.replace(/^world\.provinces\.\d+\.features\.\d+\./, ''))).toEqual([
      'monster.spells.0.dmgW: missing, and this build needs it',
      "monster.spells.0: a field this build doesn't know, dmg",
    ]);
  });

  test("the check on a copy draws none of the page's dice, an old world's lairs' renaming included", () => {
    const save = aCopyOfTheFixture();
    delete save['_lairNamesV3'];
    const asText = JSON.stringify(save);
    kcRng.seed(4321);
    const theNextDrawWithout = kcRng();
    kcRng.seed(4321);
    whatTheSavesCheckFindsBeforeTheTurn(asText);
    expect(kcRng()).toBe(theNextDrawWithout);
  });

  test('twelve places stop the turn: all named, and the words name ten and count two', () => {
    const save = aCopyOfTheFixture();
    const twelve = Array.from({ length: 12 }, (_, i) => `_markOfALaterBuild${String(i).padStart(2, '0')}`);
    for (const key of twelve) save[key] = true;
    const stops = whatTheSavesCheckFindsBeforeTheTurn(JSON.stringify(save)).placesThatStopTheTurn;
    expect(stops).toEqual(twelve.map((key) => `(the save itself): a field this build doesn't know, ${key}`));
    expect(whyTheSavesCheckStoppedTheTurnInWords(stops)).toBe(
      "The saved game holds 12 things this build of Kingdoms Call doesn't know, so the turn did not run. " +
        `Please send this list to the Kingdoms Call team: ${stops.slice(0, 10).join('; ')}; and 2 more.`,
    );
    expect(whyTheSavesCheckStoppedTheTurnInWords([THE_LEAKED_MARK])).toBe(
      "The saved game holds 1 thing this build of Kingdoms Call doesn't know, so the turn did not run. " +
        `Please send this list to the Kingdoms Call team: ${THE_LEAKED_MARK}.`,
    );
  });
});

describe('the known list', () => {
  const onTheList = (place: string) => THE_KNOWN_LEAKS_A_TURN_STILL_RUNS_ON.some((k) => k.place.test(place));

  test("the Parked leaks of a battle's marks, each anchored at both ends and naming its Parked entry", () => {
    expect(THE_KNOWN_LEAKS_A_TURN_STILL_RUNS_ON.map((k) => /, (\w+)\$$/.exec(k.place.source)?.[1])).toEqual([
      '_tempStrReduction',
      '_archeryRed',
      '_died',
      '_fromGarrison',
      '_slainBy',
    ]);
    const cuts = "A garrison unit can keep a battle's strength cuts in the save";
    const hulls = "A beaten force's hulls can carry a battle's marks into the garrison";
    expect(THE_KNOWN_LEAKS_A_TURN_STILL_RUNS_ON.map((k) => k.parked)).toEqual([
      `${cuts}; ${hulls}`,
      `${cuts}; ${hulls}`,
      cuts,
      'A garrison company can keep `_fromGarrison` in the save',
      'A hero slain and raised in the same turn keeps who slew him in the save',
    ]);
    for (const k of THE_KNOWN_LEAKS_A_TURN_STILL_RUNS_ON) {
      expect(k.place.source.startsWith('^') && k.place.source.endsWith('$'), k.place.source).toBe(true);
    }
  });

  test('each entry lets exactly its place through, and no other', () => {
    for (const field of ['_tempStrReduction', '_archeryRed', '_died', '_fromGarrison'])
      expect(onTheList(`world.provinces.53.garrisonArmies.0: a field this build doesn't know, ${field}`), field).toBe(
        true,
      );
    expect(onTheList("characters.17: a field this build doesn't know, _slainBy")).toBe(true);
    for (const other of [
      "characters.0.armies.2: a field this build doesn't know, _tempStrReduction", // a hero's company: not the leak
      "world.provinces.53.garrisonArmies.0: a field this build doesn't know, _flakTargeted", // another mark
      'world.provinces.53.garrisonArmies.0._tempStrReduction: not the kind of value this build expects (number)',
      "characters.17.armies.0: a field this build doesn't know, _slainBy",
      "x world.provinces.53.garrisonArmies.0: a field this build doesn't know, _died",
      "world.provinces.53.garrisonArmies.0: a field this build doesn't know, _diedOnce",
    ])
      expect(onTheList(other), other).toBe(false);
  });
});

describe('the check is not the save', () => {
  const A_FIELD_OF_A_LATER_BUILD = { aDayAWeekAhead: [1, 2, 3] };

  test('the upgrade keeps a field this build doesn’t know: it changes nothing the passes left', () => {
    const save = aCopyOfTheFixture();
    save['_aFieldOfALaterBuild'] = A_FIELD_OF_A_LATER_BUILD;
    const found = upgrade(save);
    expect(found.whereTheSaveDiffersFromThisBuildsSchema).toEqual([
      "(the save itself): a field this build doesn't know, _aFieldOfALaterBuild",
    ]);
    expect(save['_aFieldOfALaterBuild']).toEqual(A_FIELD_OF_A_LATER_BUILD);
    const upgradedAlone = aCopyOfTheFixture();
    upgrade(upgradedAlone);
    expect({ ...save, _aFieldOfALaterBuild: undefined }).toEqual({ ...upgradedAlone, _aFieldOfALaterBuild: undefined });
  });

  test('the turn plays the save as it was loaded, every key kept: the save it writes still holds the field', async () => {
    const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
    const save = aCopyOfTheFixture();
    save['_aFieldOfALaterBuild'] = A_FIELD_OF_A_LATER_BUILD;
    const played = sc.play(JSON.stringify(save), botRows(save));
    expect(played.S2.turn).toBe(5);
    expect(played.S2['_aFieldOfALaterBuild']).toEqual(A_FIELD_OF_A_LATER_BUILD);
  });
});

describe('each kind is named by its path, never by its value', () => {
  test('a field of the wrong kind holding a text', () => {
    const save = aCopyOfTheFixture();
    must(listIn(save, 'players')[0], 'realm')['heroOrder'] = A_LEAKED_MARKS_VALUE;
    const found = findingsFor(save);
    expect(found).toEqual(['players.0.heroOrder: not the kind of value this build expects (array)']);
    expect(found.join()).not.toContain(A_LEAKED_MARKS_VALUE);
  });

  test('a missing field', () => {
    const save = aCopyOfTheFixture();
    const realm = must(listIn(save, 'players')[0], 'realm');
    delete realm['gold'];
    expect(findingsFor(save)).toEqual(['players.0.gold: missing, and this build needs it']);
  });

  test("a key that isn't a field's name (a name a player chose) is shown as “(a key)”", () => {
    const save = aCopyOfTheFixture();
    must(listIn(must(listIn(save, 'characters')[0], 'hero'), 'armies')[0], 'company')[A_LEAKED_MARKS_VALUE] = true;
    const found = findingsFor(save);
    expect(found).toEqual(["characters.0.armies.0: a field this build doesn't know, (a key)"]);
    expect(found.join()).not.toContain(A_LEAKED_MARKS_VALUE);
  });
});

describe('at most ten places are named, then a count', () => {
  const twelve = Array.from({ length: 12 }, (_, i) => `_markOfALaterBuild${String(i).padStart(2, '0')}`);

  test('twelve fields this build doesn’t know: the check finds all twelve, and the words name ten and count two', () => {
    const save = aCopyOfTheFixture();
    for (const key of twelve) save[key] = true;
    const found = findingsFor(save);
    expect(found).toEqual(twelve.map((key) => `(the save itself): a field this build doesn't know, ${key}`));
    expect(THE_CHECKS_FINDINGS_NAMED_AT_MOST).toBe(10);
    const words = whatTheSavesCheckFoundInWords(found);
    expect(words).toBe(
      "The saved game holds 12 things this build of Kingdoms Call doesn't know, and the turn ran on it as it was. " +
        `Please send this list to the Kingdoms Call team: ${found.slice(0, 10).join('; ')}; and 2 more.`,
    );
    for (const key of twelve.slice(10)) expect(words).not.toContain(key);
  });

  test('one: “1 thing”, and no count', () => {
    expect(whatTheSavesCheckFoundInWords([THE_LEAKED_MARK])).toBe(
      "The saved game holds 1 thing this build of Kingdoms Call doesn't know, and the turn ran on it as it was. " +
        `Please send this list to the Kingdoms Call team: ${THE_LEAKED_MARK}.`,
    );
  });
});

describe('a save that isn’t a game in play is refused before anything changes', () => {
  const says =
    /^This game's save holds no game in play \(no provinces, realms or list of heroes\), so no turn can run on it\. Nothing was changed\.$/;
  const theNewGamesSettings = (): Obj => ({
    mapSize: 'p3',
    maxTurns: 12,
    allBot: true,
    turnMode: { mode: 'manual', time: '20:00', everyDays: 1 },
  });
  const aWorldWithNoRealms = (): Obj => ({ ...aCopyOfTheFixture(), players: [] });

  test.for([
    ["the new game's settings, before Turn 0", theNewGamesSettings],
    ['a world with no realms', aWorldWithNoRealms],
  ] as const)('%s: by the upgrade, which leaves it as it was', ([, make]) => {
    const save = make();
    const as = structuredClone(save);
    expect(() => upgrade(save)).toThrow(says);
    expect(save).toEqual(as);
  });

  test('the stop names no place: the turn refuses it, in its own words', () => {
    for (const make of [theNewGamesSettings, aWorldWithNoRealms])
      expect(whatTheSavesCheckFindsBeforeTheTurn(JSON.stringify(make()))).toEqual({
        placesThatStopTheTurn: [],
        knownPlacesTheTurnRunsOn: [],
      });
    expect(whatTheSavesCheckFindsBeforeTheTurn('not a save')).toEqual({
      placesThatStopTheTurn: [],
      knownPlacesTheTurnRunsOn: [],
    });
  });

  test('by the turn, which can’t read it (the shell puts the orders back)', () => {
    const save = theNewGamesSettings();
    expect(() => {
      resolveTurn(JSON.stringify(save), [], 1, 1);
    }).toThrow(new RegExp('^Could not read the saved game: ' + says.source.slice(1)));
  });
});
