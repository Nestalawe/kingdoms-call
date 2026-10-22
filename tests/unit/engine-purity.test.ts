// The engine is pure (plan P1-18d): resolveTurn, and what it hands the shell for after the save (the Spy-stealth step,
// P1-12b2's, and what the reports read, P1-12b3's), and the reports (the views' buildReports, in the same bundle), run
// in a bare Node vm, loaded the one way (tests/lib/engine.ts). The test plays a whole game of the balance matrix there
// (scripted-05: realm 0 is a player's, on the matrix's scripted orders, and the other three are bots), from world
// generation to the end, each turn's state the next turn's input and every turn building its reports, as the shell
// plays it on the page (src/ui/gm/turn-shell.ts: each turn's seed drawn from the dice, the time of the run stamped).
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
import ts from 'typescript';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { readBaseline } from '../../tools/balance/baseline.ts';
import { TURN_COLUMNS, turnHashes } from '../../tools/balance/hash.ts';
import { MAX_TURNS, SCRIPTED_REALM } from '../../tools/balance/matrix.ts';
import { ROOT } from '../../tools/build.ts';
import { engineEntryFiles } from '../../tools/pages.ts';
import { loadEngine } from '../lib/engine.ts';
import { GAME, newWorld, PAGE_DRAWS_AS_IT_LOADS, slotRows, stampedAsTheShellSaves } from '../lib/matrix-game.ts';
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
  spyStealthAndInvisibilityStampedForTheReports(): void;
  whatTheReportsRead(): unknown;
}

interface Engine {
  engine: vm.Context;
  /** What the engine reached for that it may not: 'Date.now()', 'document', … */
  reaches: string[];
  /** What it said on console.warn and console.error. */
  said: string[];
  resolveTurn(state: string, rows: unknown, turn: number, seed?: number): Resolved;
  /** The views' buildReports (src/views/every-realms-report-and-the-lines-each-realm-reads.ts), as the shell calls it. */
  buildReports(whatTheReportsRead: unknown): {
    reports: { gp: { player_index?: unknown }; report: Report }[];
    tel: unknown;
  };
}

/** The hash columns the engine writes, and so the ones compared with the baseline: all but the shell's statistics rows
 *  and database writes. */
const ENGINE_COLUMNS = TURN_COLUMNS.filter((c) => c !== 'telemetry' && c !== 'writes');
const engineColumnsOf = (hashes: string) => {
  const all = hashes.split(' ');
  return ENGINE_COLUMNS.map((c) => `${c} ${all[TURN_COLUMNS.indexOf(c)] ?? ''}`).join(', ');
};

/** The shell's work around each turn that the matrix's hashes see (src/ui/gm/turn-shell.ts): the turn's seed, the
 *  page's next number as a 32-bit integer (0 read as 1); and the run's time stamped in the world's turn mode
 *  (stampedAsTheShellSaves). */
const shellSeed = (engine: vm.Context) => vm.runInContext('Math.floor(kcRng()*2**32)||1', engine) as number;

/** The engine, loaded the one way (from `src`, by default this checkout's src/), with the tripwires set. */
function pureEngine(src?: string): Engine {
  const engine = loadEngine(src === undefined ? { seed: GAME.seed } : { seed: GAME.seed, src });
  const reaches: string[] = [];
  const said: string[] = [];
  (vm.runInContext(TRIPWIRES, engine) as (r: string[], s: string[]) => void)(reaches, said);
  const resolveTurn = vm.runInContext('resolveTurn', engine) as Engine['resolveTurn'];
  const buildReports = vm.runInContext('buildReports', engine) as Engine['buildReports'];
  return { engine, reaches, said, resolveTurn, buildReports };
}

/** Every top-level variable the data file and the engine declare. (Its functions are code: the only ones that carry
 *  anything are kcRng's and kcClock's, and that is the dice and the clock.) */
function engineVariables(): string[] {
  const names: string[] = [];
  for (const file of engineEntryFiles()) {
    // TypeScript's parser, so a file with type annotations reads too (P1-11a1: the first engine file with type
    // annotations); exported or not, a variable statement is the same node
    const tree = ts.createSourceFile(
      file,
      fs.readFileSync(path.join(ROOT, 'src', file), 'utf8'),
      ts.ScriptTarget.Latest,
    );
    for (const statement of tree.statements)
      if (ts.isVariableStatement(statement))
        for (const d of statement.declarationList.declarations) if (ts.isIdentifier(d.name)) names.push(d.name.text);
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
      resolved.spyStealthAndInvisibilityStampedForTheReports();
      const { reports } = e.buildReports(resolved.whatTheReportsRead());
      if (turn === 1) {
        try {
          e.buildReports(resolved.whatTheReportsRead());
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
  // start of the reports (buildReports, lifted out of resolveTurn in P1-08d and into the views in P1-12b3: the statement
  // that lists the played realms).
  const AT = {
    resolution: { file: 'engine/run-turn.ts', fn: 'resolveTurn', before: 'turnLog' },
    reports: {
      file: 'views/every-realms-report-and-the-lines-each-realm-reads.ts',
      fn: 'buildReports',
      before: 'activePlayers',
    },
  };
  const originals = Object.fromEntries(
    Object.values(AT).map(({ file }) => [file, fs.readFileSync(path.join(copy, file), 'utf8')]),
  );
  const world = newWorld(pureEngine().engine);
  // The engine from the copy, with `line` planted before that statement in `file` (and `imports` at its top: a module
  // reaches another's table only by importing it), and every other file as it was.
  const planted = (
    { file, fn, before }: { file: string; fn: string; before: string },
    line: string,
    imports = '',
  ): Engine => {
    for (const [name, text] of Object.entries(originals)) fs.writeFileSync(path.join(copy, name), text);
    fs.writeFileSync(path.join(copy, file), imports + plantBefore(originals[file] ?? '', file, fn, before, line));
    return pureEngine(copy);
  };
  // Each fault uses what it reads: the bundler leaves out a call it knows has no effect when nothing reads its result
  // (`Date.now();` on its own), as it would any such call in the engine.
  const FAULTS = [
    ['Date.now()', "if (!Date.now()) throw new Error('no time');", 'the engine read the clock: Date.now()'],
    ['Math.random()', "if (Math.random() > 1) throw new Error('no dice');", 'the engine drew from Math.random()'],
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
    resolved.spyStealthAndInvisibilityStampedForTheReports();
    expect(() => e.buildReports(resolved.whatTheReportsRead())).toThrow(error);
    expect(new Set(e.reaches)).toEqual(new Set([reach]));
  });

  test('planted a write to a table, and a new global: the turn changes the one and adds the other', () => {
    const e = planted(
      AT.resolution,
      'SKILL_LABELS.planted=1; globalThis.kcPlanted=1;',
      "import { SKILL_LABELS } from './army-tables.ts';\n",
    );
    const snapshot = snapshotOf(e, engineVariables());
    const globals = vm.runInContext('()=>Object.getOwnPropertyNames(globalThis)', e.engine) as () => string[];
    const [was, had] = [snapshot(), new Set(globals())];
    const resolved = e.resolveTurn(world, slotRows(e.engine, world, 1), 1);
    resolved.spyStealthAndInvisibilityStampedForTheReports();
    e.buildReports(resolved.whatTheReportsRead());
    const now = snapshot();
    expect(Object.keys(now).filter((n) => now[n] !== was[n] && !RESEEDED.includes(n))).toEqual(['SKILL_LABELS']);
    expect(globals().filter((n) => !had.has(n))).toEqual(['kcPlanted']);
  });
});
