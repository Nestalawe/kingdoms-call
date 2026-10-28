// Every saved game's version is kept as a fixture (tests/fixtures/saves/version-<n>.json, plan P1-15c, Decision 6): a
// made-up game of three bot realms after its third turn, made by tools/saves/make-a-save-fixture-from-a-seeded-bot-
// game.ts with the build of its day. Version 0 is what every live game held the day the version came in. Here each
// fixture is upgraded (upgradeGameState, src/engine/saves/upgrade-a-saved-game-and-check-it.ts) and then:
// - it is at the version this build writes, and parses strictly against the saved state's schema (tests/lib/strict-
//   schema.ts: a field the schema doesn't know fails too), so a change to the save's shape that an older save can't
//   meet turns this red until a numbered step mends it (CLAUDE.md, "Changes");
// - upgraded again, it is the same;
// - one turn is played on it, as the GM page plays one (resolveTurn, then the reports), and the turn keeps every
//   invariant (tests/lib/invariants.ts's checkTurn).
// And: a fixture is kept for every version from 0 to this build's, one each, and the numbered steps are numbered 1 to
// it; a save from a newer build is refused before anything changes, by the upgrade and by the turn; a new world
// carries the version this build writes.
// Each fixture holds no released hero: a released hero's `_releasedBy` is a field the schema doesn't know yet (STATUS,
// Parked), and the fixture's seed was chosen so its strict parse says only whether the upgrade brings it to today's
// shape. The turn is played on the dice of KC_SEED: the invariants hold on every seed.
// Level 1 (unit): the upgrade and the parse are functions of a save, and one turn of a three-realm game, played on the
// engine's modules imported directly, takes about a second; a static test can't upgrade a save, and a scenario's
// staged world isn't a save an older build wrote.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The save fixtures (`fixtures/saves/version-<n>.json`, one per version, each a made-up game of three bot realms after
// its third turn, made by `tools/saves/make-a-save-fixture-from-a-seeded-bot-game.ts` with the build of its day;
// version 0 by P1-15c's base, what live games held that day). Each fixture upgraded by `upgradeGameState`: at the
// version this build writes, parsed strictly (`lib/strict-schema.ts`), upgraded twice as once, and one turn played on
// it by direct import (`lib/a-staged-turn-on-the-engines-modules.ts`'s `play`, on the dice of `KC_SEED`) keeping every
// invariant (`lib/invariants.ts`). One fixture for each version from 0 to this build's, and the numbered steps numbered
// 1 to it; a save from a newer build refused by the upgrade, unchanged, and by the turn; a new world at this build's
// version. Red with the stamp left out, the refusal taken out, or world generation's stamp taken out; each of the six
// passes left out leaves it green (the fixture holds no old shape:
// `a-saved-games-old-shapes-are-mended-before-the-turn` stages them). Level 1: the upgrade and the parse are functions
// of a save, one turn of a three-realm game about a second; a static test can't upgrade a save. A fixture is never
// edited once merged. TypeScript, in `unit/`
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import '../lib/the-whole-engine.ts';
import { generateNewGame } from '../../src/engine/world/generate.ts';
import { resolveTurn } from '../../src/engine/run-turn.ts';
import { generateBotSetups } from '../../src/engine/bots/setup.ts';
import {
  THE_NUMBERED_STEPS_OF_THE_UPGRADE,
  upgradeGameState,
} from '../../src/engine/saves/upgrade-a-saved-game-and-check-it.ts';
import { THE_SAVED_GAMES_VERSION_THIS_BUILD_WRITES } from '../../src/engine/saves/the-saved-games-version-this-build-writes.ts';
import { GameStateSchema } from '../../src/schemas/saved-game-state.ts';
import { strictIssues } from '../lib/strict-schema.ts';
import { aStagedTurnOnTheEnginesModules } from '../lib/a-staged-turn-on-the-engines-modules.ts';
import { checkTurn, describeBreaches, type SavedState } from '../lib/invariants.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;
const NOW = THE_SAVED_GAMES_VERSION_THIS_BUILD_WRITES;
const FIXTURES = path.join(import.meta.dirname, '../fixtures/saves');

/** A save as the upgrade takes it. */
type Save = Parameters<typeof upgradeGameState>[0];
const fixtureOf = (version: number): string =>
  fs.readFileSync(path.join(FIXTURES, `version-${String(version)}.json`), 'utf8');
const upgraded = (json: string): Save => {
  const save = JSON.parse(json) as Save;
  upgradeGameState(save);
  return save;
};
/** The versions from 0 to this build's. */
const VERSIONS = Array.from({ length: NOW + 1 }, (_, v) => v);

/** The slot rows of an all-bot game, as the shell loads them. */
const botRows = (save: Save) =>
  save.players.map((_, pi) => ({
    id: 'G1gp' + String(pi),
    game_id: 'G1',
    user_id: null,
    player_index: pi,
    display_name: 'Realm' + String(pi),
    orders_submitted: false,
    orders: null,
    turn_report: JSON.stringify({ isBot: true, playerSetup: {} }),
  }));

describe('a fixture for every version', () => {
  test('one fixture each, from version 0 to the version this build writes', () => {
    expect(fs.readdirSync(FIXTURES).sort()).toEqual(VERSIONS.map((v) => `version-${String(v)}.json`).sort());
  });

  test('the numbered steps are numbered 1 to the version this build writes, in order', () => {
    expect(THE_NUMBERED_STEPS_OF_THE_UPGRADE.map((s) => s.version)).toEqual(VERSIONS.slice(1));
  });

  test.for(VERSIONS)('version %i holds its version, as the build of its day wrote it', (version) => {
    const save = JSON.parse(fixtureOf(version)) as { schemaVersion?: unknown; turn: unknown };
    expect(save.schemaVersion).toBe(version === 0 ? undefined : version);
    expect(save.turn).toBe(4);
  });
});

describe.for(VERSIONS)('the fixture of version %i', (version) => {
  const json = fixtureOf(version);

  test('upgraded, it is at the version this build writes and parses strictly', () => {
    const save = upgraded(json);
    expect(save.schemaVersion).toBe(NOW);
    expect(strictIssues(GameStateSchema, save)).toEqual([]);
  });

  test('upgraded twice, it is as upgraded once', () => {
    const once = upgraded(json);
    const twice = upgraded(JSON.stringify(once));
    expect(twice).toEqual(once);
  });

  test('a turn played on it keeps every invariant', async () => {
    const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
    const before = JSON.parse(json) as Save;
    const rows = botRows(before);
    const played = sc.play(json, rows);
    expect(played.S2['schemaVersion']).toBe(NOW);
    expect(played.S2.turn).toBe(before.turn + 1);
    expect(played.log.length).toBeGreaterThan(0);
    const deaths = (played.collected['deaths'] ?? []) as { ph?: unknown; charId?: unknown }[];
    const breaches = checkTurn({
      before: before as unknown as SavedState,
      after: played.S2 as unknown as SavedState,
      gmLog: played.log,
      telemetry: [{ outcomes: { deaths: { list: deaths } } }],
      players: rows,
    });
    expect(breaches, describeBreaches(`turn ${String(before.turn)}`, breaches)).toEqual([]);
  });
});

describe('a save from a newer build is refused before anything changes', () => {
  const newer = (): Save => ({ ...upgraded(fixtureOf(NOW)), schemaVersion: NOW + 1 });
  const says = new RegExp(
    `^This game was saved by a newer version of Kingdoms Call \\(save version ${String(NOW + 1)}; this page knows ` +
      `${String(NOW)}\\)\\. Reload this page\\.$`,
  );

  test('by the upgrade, which leaves it as it was', () => {
    const save = newer();
    const as = structuredClone(save);
    expect(() => upgradeGameState(save)).toThrow(says);
    expect(save).toEqual(as);
  });

  test('by the turn, which can’t read it (the shell puts the orders back)', () => {
    const save = newer();
    expect(() => {
      resolveTurn(JSON.stringify(save), botRows(save), save.turn, 1);
    }).toThrow(new RegExp('^Could not read the saved game: ' + says.source.slice(1)));
  });
});

test('a new world carries the version this build writes', () => {
  const setups = (generateBotSetups([], 3, 0) as Record<string, unknown>[]).map((b) => ({
    ...b,
    gamePlayerId: 'gp' + String(b['id']),
    name: b['kingdomName'],
  }));
  const world = generateNewGame(setups, { cols: 8, rows: 7 }, 0, {}) as { schemaVersion?: unknown };
  expect(world.schemaVersion).toBe(NOW);
});
