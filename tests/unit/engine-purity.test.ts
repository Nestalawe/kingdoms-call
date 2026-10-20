// The engine is pure (plan P1-18d): resolveTurn, and the reports it builds after the save (buildReports), run in a bare
// Node vm, loaded the one way (tests/lib/engine.ts). The test plays a whole game of the balance matrix there
// (scripted-05: realm 0 is a player's, on the matrix's scripted orders, and the other three are bots), from world
// generation to the end, each turn's state the next turn's input and every turn building its reports, as the shell
// plays it on the page (src/ui/gm/turn-shell.js: each turn's seed drawn from the dice, the time of the run stamped).
// Then it plants faults in a copy of src/.
// - It is the matrix's own game (plan P1-09b): each turn's state, GM log and report hash as the committed baseline holds
//   them (tests/balance/baseline/matrix.json), words included. So the engine alone and the GM page play the same game
//   (P1-09's Decision 14), and once the page is built otherwise (P1-09d) this still says so. Only the shell's own work,
//   the statistics rows and the database writes, isn't compared: there is no shell here.
// - Date and Math.random are stand-ins, and document and sb tripwires: each notes the reach, then throws, so a reach is
//   seen even when a try in the engine swallows the throw. The engine reaches none of them. (window stays undefined,
//   so the bots' two test hooks behind `typeof window`, __botDiag and __botHyg, stay off.)
// - The engine says nothing on console.warn or console.error, where a failure a try caught would show.
// - A turn changes no global but the dice (kcRng's slot) and the five caches the turn seeds afresh at its start
//   (seedUsedHeroNames, seedUsedArmyNames, maxHpPlayers): every table is read-only, and no new global appears.
// - Each fault planted in the copy turns it red: Date.now(), Math.random(), document and sb, in the resolution and in
//   the reports; and a write to a table and a new global, which the check of the globals sees.
// Level 1 (unit): the engine alone, with no page. It plays a whole game, world generation included, so that as much of
// the engine runs as a game reaches.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import * as acorn from 'acorn';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { engineFiles } from '../../src/manifest.ts';
import { readBaseline } from '../../tools/balance/baseline.ts';
import { TURN_COLUMNS, turnHashes } from '../../tools/balance/hash.ts';
import { MAX_TURNS, SCRIPTED_REALM, START } from '../../tools/balance/matrix.ts';
import { ROOT } from '../../tools/build.ts';
import { DATA_FILE, loadEngine } from '../lib/engine.ts';
import { GAME, newWorld, slotRows } from '../lib/matrix-game.ts';
import { plantBefore } from '../lib/source.ts';

/** The caches a turn seeds afresh at its start, so they carry nothing from one turn to the next. */
const RESEEDED = ['_usedHeroNames', '_usedHeroFirsts', '_usedHeroEpithets', '_usedArmyUnitNames', 'maxHpPlayers'];

// Run in the vm once it has loaded: the clock and Math.random become stand-ins that note the reach and throw,
// document and sb tripwires that do the same, and the console quiet but for warnings and errors, which are noted.
const TRIPWIRES = `(reaches, said)=>{
  const reach=(what)=>{ reaches.push(what); return what; };
  const noClock=(how)=>{ throw new Error('the engine read the clock: '+reach(how)); };
  function NoDate(){ noClock('new Date()'); }
  NoDate.now=()=>noClock('Date.now()'); NoDate.parse=()=>noClock('Date.parse()'); NoDate.UTC=()=>noClock('Date.UTC()');
  globalThis.Date=NoDate;
  Math.random=()=>{ throw new Error('the engine drew from '+reach('Math.random()')); };
  for(const name of ['document','sb']) Object.defineProperty(globalThis,name,{get(){ throw new ReferenceError(reach(name)+' is not defined'); }});
  const tell=(how)=>(...a)=>{ said.push(how+': '+a.map(String).join(' ')); };
  globalThis.console={log(){},info(){},debug(){},warn:tell('warn'),error:tell('error')};
}`;

interface Report {
  playerIndex?: unknown;
}

interface Resolved {
  state: string;
  log: unknown[];
  buildReports(): { reports: { gp: { player_index?: unknown }; report: Report }[]; tel: unknown };
}

interface Engine {
  engine: vm.Context;
  /** What the engine reached for that it may not: 'Date.now()', 'document', … */
  reaches: string[];
  /** What it said on console.warn and console.error. */
  said: string[];
  resolveTurn(state: string, rows: unknown, turn: number, seed?: number): Resolved;
}

/** How many numbers the GM page draws from its dice as it loads, before the matrix makes its world: one, its tab's id
 *  (`_tabId`, src/ui/gm/auto-turn.js). The page and the engine start from the same seed, so the world is the matrix's
 *  only once the engine's dice have moved on as far. */
const PAGE_DRAWS_AS_IT_LOADS = 1;

/** The hash columns the engine writes, and so the ones compared with the baseline: all but the shell's statistics rows
 *  and database writes. */
const ENGINE_COLUMNS = TURN_COLUMNS.filter((c) => c !== 'telemetry' && c !== 'writes');
const engineColumnsOf = (hashes: string) => {
  const all = hashes.split(' ');
  return ENGINE_COLUMNS.map((c) => `${c} ${all[TURN_COLUMNS.indexOf(c)] ?? ''}`).join(', ');
};

/** The shell's work around each turn that the matrix's hashes see (src/ui/gm/turn-shell.js): the turn's seed, the
 *  page's next number as a 32-bit integer (0 read as 1); and the run's time stamped in the world's turn mode. Any time
 *  will do: the hashes read every time as the same. */
const shellSeed = (engine: vm.Context) => vm.runInContext('Math.floor(kcRng()*2**32)||1', engine) as number;
function stampedAsTheShellSaves(state: string): string {
  const world = JSON.parse(state) as { turnMode?: Record<string, unknown> };
  if (world.turnMode) world.turnMode['turnRanAt'] = START;
  return JSON.stringify(world);
}

/** The engine, loaded the one way (from `src`, by default this checkout's src/), with the tripwires set. */
function pureEngine(src?: string): Engine {
  const engine = loadEngine(src === undefined ? { seed: GAME.seed } : { seed: GAME.seed, src });
  const reaches: string[] = [];
  const said: string[] = [];
  (vm.runInContext(TRIPWIRES, engine) as (r: string[], s: string[]) => void)(reaches, said);
  const resolveTurn = vm.runInContext('resolveTurn', engine) as Engine['resolveTurn'];
  return { engine, reaches, said, resolveTurn };
}

/** Every top-level variable the data file and the engine declare. (Its functions are code: the only ones that carry
 *  anything are kcRng's and kcClock's, and that is the dice and the clock.) */
function engineVariables(): string[] {
  const names: string[] = [];
  for (const file of [DATA_FILE, ...engineFiles()]) {
    const program = acorn.parse(fs.readFileSync(path.join(ROOT, 'src', file), 'utf8'), {
      ecmaVersion: 'latest',
      sourceType: 'script',
    });
    for (const s of program.body)
      if (s.type === 'VariableDeclaration')
        for (const d of s.declarations) if (d.id.type === 'Identifier') names.push(d.id.name);
  }
  return names;
}

/** A function that gives each of `names` as JSON (a Set or a Map as its entries), read in the vm. A top-level `let` or
 *  `const` is no property of the vm's global object, so only code that names it can read it: the names go into that
 *  code as plain identifiers, nothing else, and the values come back in the same order. */
function snapshotOf({ engine }: Engine, names: string[]): () => Record<string, string> {
  const notIdentifiers = names.filter((n) => !/^[A-Za-z_$][\w$]*$/.test(n));
  if (notIdentifiers.length) throw new Error(`not plain identifiers: ${notIdentifiers.join(' ')}`);
  const values = vm.runInContext(
    `()=>{ const plain=(k,x)=>x instanceof Set?{set:[...x]}:x instanceof Map?{map:[...x]}:x;
      return [${names.join(',')}].map((v)=>JSON.stringify(v,plain)); }`,
    engine,
  ) as () => string[];
  return () => {
    const now = values();
    return Object.fromEntries(names.map((n, i) => [n, now[i] ?? '']));
  };
}

describe('a whole game, played in the bare vm', () => {
  const played = {
    turns: 0,
    /** Each turn's reports: the realm each was built for. */
    reports: [] as unknown[][],
    /** Each turn's new state, as the turn it now stands on. */
    nextTurns: [] as number[],
    logLines: [] as number[],
    /** Each turn's hashes, as the balance matrix keeps them (tools/balance/hash.ts). */
    hashes: [] as string[],
    secondCall: '',
    /** The engine's globals a turn changed, and the turns it changed them in. */
    changed: new Map<string, number[]>(),
    added: [] as string[],
    reaches: [] as string[],
    said: [] as string[],
  };

  beforeAll(() => {
    const e = pureEngine();
    const names = engineVariables();
    const snapshot = snapshotOf(e, names);
    const globals = vm.runInContext('()=>Object.getOwnPropertyNames(globalThis)', e.engine) as () => string[];
    for (let i = 0; i < PAGE_DRAWS_AS_IT_LOADS; i++) vm.runInContext('kcRng()', e.engine);
    let state = newWorld(e.engine);
    const before = new Set(globals());
    let was = snapshot();
    for (let turn = 1; turn <= MAX_TURNS; turn++) {
      if ((JSON.parse(state) as { gameOver?: unknown }).gameOver) break;
      const resolved = e.resolveTurn(state, slotRows(e.engine, state, turn), turn, shellSeed(e.engine));
      const { reports } = resolved.buildReports();
      if (turn === 1) {
        try {
          resolved.buildReports();
        } catch (err) {
          played.secondCall = String((err as { message?: unknown }).message); // the vm's own Error, not this realm's
        }
      }
      played.turns++;
      played.reports.push(reports.map((r) => [r.gp.player_index, r.report.playerIndex]));
      played.nextTurns.push((JSON.parse(resolved.state) as { turn: number }).turn);
      played.logLines.push(resolved.log.length);
      const now = snapshot();
      for (const n of names) if (now[n] !== was[n]) played.changed.set(n, [...(played.changed.get(n) ?? []), turn]);
      was = now;
      state = stampedAsTheShellSaves(resolved.state);
      const mine = reports.find((r) => r.gp.player_index === SCRIPTED_REALM);
      played.hashes.push(
        turnHashes({
          state: JSON.parse(state) as unknown,
          gmLog: JSON.parse(JSON.stringify(resolved.log)) as unknown[],
          telemetry: [],
          report: mine ? (JSON.parse(JSON.stringify(mine.report)) as Record<string, unknown>) : null,
          writes: [],
        }),
      );
    }
    played.added = globals().filter((n) => !before.has(n));
    played.reaches = e.reaches;
    played.said = e.said;
  });

  test('every turn resolves and builds its reports, and the reports are built once', () => {
    expect(played.turns, 'the game played on past its first turn').toBeGreaterThan(1);
    expect(played.nextTurns).toEqual(played.nextTurns.map((_, i) => i + 2));
    expect(
      played.logLines.every((n) => n > 0),
      'every turn has a GM log',
    ).toBe(true);
    expect(played.reports, "one report a turn, the player's, for its own realm").toEqual(
      played.nextTurns.map(() => [[SCRIPTED_REALM, SCRIPTED_REALM]]),
    );
    expect(played.secondCall).toBe('buildReports() runs once a turn');
  });

  test("it is the balance matrix's game: each turn's state, GM log and report hash as the baseline holds them", () => {
    const kept = readBaseline('A').find((g) => g.id === GAME.id);
    expect(kept, `the baseline has ${GAME.id}`).toBeDefined();
    expect(played.hashes.map(engineColumnsOf)).toEqual((kept?.turns ?? []).map(engineColumnsOf));
  });

  test('it reaches no clock, no Math.random, no screen and no database, and says nothing on the console', () => {
    expect(played.reaches).toEqual([]);
    expect(played.said).toEqual([]);
  });

  test('a turn changes no global but the five caches it seeds afresh, and adds none', () => {
    expect([...played.changed.keys()].filter((n) => !RESEEDED.includes(n))).toEqual([]);
    expect(played.added).toEqual([]);
  });
});

describe('a fault planted in a copy of src/ turns it red', () => {
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-purity-'));
  afterAll(() => {
    fs.rmSync(copy, { recursive: true, force: true });
  });
  fs.cpSync(path.join(ROOT, 'src'), copy, { recursive: true });
  // Where each fault goes, found by the syntax tree (tests/lib/source.ts, plan P1-09a: until then by an exact line): in
  // resolveTurn, just before the five phases (the statement that takes the turn's log from its context), and at the
  // start of the reports (buildReports, lifted out of resolveTurn in P1-08d: the statement that lists the played realms).
  const AT = {
    resolution: { file: 'engine/run-turn.js', fn: 'resolveTurn', before: 'turnLog' },
    reports: { file: 'engine/turn/realm-reports-and-spy-stealth.js', fn: 'buildReports', before: 'activePlayers' },
  };
  const originals = Object.fromEntries(
    Object.values(AT).map(({ file }) => [file, fs.readFileSync(path.join(copy, file), 'utf8')]),
  );
  const world = newWorld(pureEngine().engine);
  // The engine from the copy, with `line` planted before that statement in `file`, and every other file as it was.
  const planted = ({ file, fn, before }: { file: string; fn: string; before: string }, line: string): Engine => {
    for (const [name, text] of Object.entries(originals)) fs.writeFileSync(path.join(copy, name), text);
    fs.writeFileSync(path.join(copy, file), plantBefore(originals[file] ?? '', file, fn, before, line));
    return pureEngine(copy);
  };
  const FAULTS = [
    ['Date.now()', 'Date.now();', 'the engine read the clock: Date.now()'],
    ['Math.random()', 'Math.random();', 'the engine drew from Math.random()'],
    ['document', 'document.title;', 'document is not defined'],
    ['sb', "sb.from('games');", 'sb is not defined'],
  ] as const;

  // A tripwire on a global name can be read more than once for one reach (node:vm looks the name up on its global
  // object), so the reaches are compared as a set.
  test.each(FAULTS)('planted %s in the resolution', (reach, line, error) => {
    const e = planted(AT.resolution, line);
    expect(() => e.resolveTurn(world, slotRows(e.engine, world, 1), 1)).toThrow(error);
    expect(new Set(e.reaches)).toEqual(new Set([reach]));
  });

  test.each(FAULTS)('planted %s in the reports', (reach, line, error) => {
    const e = planted(AT.reports, line);
    const resolved = e.resolveTurn(world, slotRows(e.engine, world, 1), 1);
    expect(() => resolved.buildReports()).toThrow(error);
    expect(new Set(e.reaches)).toEqual(new Set([reach]));
  });

  test('planted a write to a table, and a new global: the turn changes the one and adds the other', () => {
    const e = planted(AT.resolution, 'SKILL_LABELS.planted=1; globalThis.kcPlanted=1;');
    const snapshot = snapshotOf(e, engineVariables());
    const globals = vm.runInContext('()=>Object.getOwnPropertyNames(globalThis)', e.engine) as () => string[];
    const [was, had] = [snapshot(), new Set(globals())];
    e.resolveTurn(world, slotRows(e.engine, world, 1), 1).buildReports();
    const now = snapshot();
    expect(Object.keys(now).filter((n) => now[n] !== was[n] && !RESEEDED.includes(n))).toEqual(['SKILL_LABELS']);
    expect(globals().filter((n) => !had.has(n))).toEqual(['kcPlanted']);
  });
});
