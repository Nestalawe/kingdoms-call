// Makes the save fixture of this build's version (plan P1-15c, Decision 6): a made-up game of three bot realms, from a
// fixed seed, played by the engine's modules imported directly as the GM page plays it (Turn 0's new world, then three
// turns, each on the turn's own seed drawn from the dice, saved as the turn's shell saves it), written as one line of
// JSON to tests/fixtures/saves/version-<n>.json, <n> the version the save holds (`schemaVersion`; 0 if it holds none).
// The names are the bots' own, drawn from the content's pools: no live game's.
//
//   npx tsx tools/saves/make-a-save-fixture-from-a-seeded-bot-game.ts
//
// A fixture is never edited once merged (as a merged migration): the script refuses to write over one. A change to the
// save's shape that bumps the version (CLAUDE.md, "Changes") runs it once, on the branch, for the new version's
// fixture. Version 0's was made by this script run on a copy of P1-15c's base (`git archive`, the script copied in):
// what live games held on the day the version came in. tests/unit/every-save-fixture-upgrades-parses-and-plays-a-
// turn.test.ts upgrades each fixture, parses it strictly and plays a turn on it.
import fs from 'node:fs';
import path from 'node:path';
import '../../tests/lib/the-whole-engine.ts';
import { generateBotSetups } from '../../src/engine/bots/setup.ts';
import { generateNewGame } from '../../src/engine/world/generate.ts';
import { resolveTurn } from '../../src/engine/run-turn.ts';
import { kcRng } from '../../src/engine/rng.ts';

/** The game's seed: its world, and through the dice each turn's seed. Chosen so the three turns release no hero (a
 *  released hero's `_releasedBy` is a field the schema doesn't know yet: STATUS, Parked), so a fixture's strict parse
 *  says whether the upgrade brings it to today's shape. */
const SEED = 15;
/** Three realms, on the GM page's map for three (Turn 0's `sizemap`), a fifth of it sea. */
const REALMS = 3;
const MAP = { cols: 8, rows: 7 };
const SEA_PCT = 20;
/** The turns played: the fixture is the save after the third. */
const TURNS = 3;
/** The page's clock, as the save keeps it (each turn's shell stamps the time it ran). */
const TIME = '2026-10-01T20:00:00.000Z';

type Save = Record<string, unknown> & { turn: number; schemaVersion?: number; turnMode?: Record<string, unknown> };
const plain = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Quiet while `body` runs: the engine logs as it makes the world and plays. */
function quietly<T>(body: () => T): T {
  const { log, warn } = console;
  console.log = () => undefined;
  console.warn = () => undefined;
  try {
    return body();
  } finally {
    console.log = log;
    console.warn = warn;
  }
}

kcRng.seed(SEED);
const setups = (generateBotSetups([], REALMS, 0) as Record<string, unknown>[]).map((b): Record<string, unknown> => ({
  ...b,
  gamePlayerId: 'gp' + String(b['id']),
  name: b['kingdomName'],
}));
// Turn 0, as the GM page makes the world (src/ui/gm/turn-zero.ts): an all-bot game, every turn run by hand
const world = plain(quietly(() => generateNewGame(setups, MAP, 0, { seaPct: SEA_PCT }) as Save));
world['botDiplomacy'] = 'normal';
world['botDifficulty'] = 'hard';
world.turnMode = { mode: 'manual', time: '20:00', everyDays: 1, nextDeadlineAt: null, turnRanAt: TIME };
let save = JSON.stringify(world);

// The slot rows, as the shell loads them: every realm a bot's
const rows = setups.map((s) => ({
  id: 'G1gp' + String(s['id']),
  game_id: 'G1',
  user_id: null,
  player_index: s['id'],
  display_name: s['name'],
  orders_submitted: false,
  orders: null,
  turn_report: JSON.stringify({ isBot: true, playerSetup: {} }),
}));

for (let turn = 1; turn <= TURNS; turn++) {
  // the shell's seed: one number from the dice, as a 32-bit integer (0 read as 1)
  const seed = Math.floor(kcRng() * 2 ** 32) || 1;
  const played = quietly(() => resolveTurn(save, plain(rows), turn, seed) as { state: string });
  const after = JSON.parse(played.state) as Save;
  if (after.turnMode) after.turnMode['turnRanAt'] = TIME; // as the shell saves it (src/ui/gm/turn-shell.ts)
  save = JSON.stringify(after);
}

const version = (JSON.parse(save) as Save).schemaVersion ?? 0;
const out = path.join(import.meta.dirname, '../../tests/fixtures/saves', `version-${String(version)}.json`);
if (fs.existsSync(out)) {
  console.error(`${path.relative(process.cwd(), out)} is there already: a fixture is never edited once merged`);
  process.exit(1);
}
fs.writeFileSync(out, save + '\n');
console.log(
  `${path.relative(process.cwd(), out)}: turn ${String((JSON.parse(save) as Save).turn)}, ${String(Buffer.byteLength(save))} bytes`,
);
