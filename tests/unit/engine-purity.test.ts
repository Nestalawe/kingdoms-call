// The engine is pure (plan P1-18d): resolveTurn, and the reports it builds after the save (buildReports), run in a bare
// Node vm, loaded the one way (tests/lib/engine.ts). The test plays a whole game of the balance matrix there
// (scripted-05: realm 0 is a player's, on the matrix's scripted orders, and the other three are bots), from world
// generation to the end, each turn's state the next turn's input and every turn building its reports. Then it plants
// faults in a copy of src/.
// - Date and Math.random are stand-ins, and document and sb tripwires: each notes the reach, then throws, so a reach is
//   seen even when a try in the engine swallows the throw. The engine reaches none of them. (window stays undefined,
//   so the three test hooks behind `typeof window`, _kcTest, __botDiag and __botHyg, stay off.)
// - The engine says nothing on console.warn or console.error, where a failure a try caught would show.
// - A turn changes no global but the dice (kcRng's slot) and the five caches the turn seeds afresh at its start
//   (seedUsedHeroNames, seedUsedArmyNames, _MAXHP_PLAYERS): every table is read-only, and no new global appears.
// - Each fault planted in the copy turns it red: Date.now(), Math.random(), document and sb, in the resolution and in
//   the reports.
// Level 1 (unit): the engine alone, with no page. It plays a whole game, world generation included, so that as much of
// the engine runs as a game reaches.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import * as acorn from 'acorn';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { engineFiles } from '../../src/manifest.ts';
import { MAP_SIZES, MAX_TURNS, matrix, SCRIPTED_REALM } from '../../tools/balance/matrix.ts';
import { scriptedOrders, type State } from '../../tools/balance/scripted.ts';
import { ROOT } from '../../tools/build.ts';
import { DATA_FILE, loadEngine } from '../lib/engine.ts';

const GAME = matrix('A').find((g) => g.id === 'scripted-05');
if (!GAME) throw new Error('the balance matrix has no game scripted-05');
const SPEC = GAME;

// The realms as tools/balance/play.ts sets them up: realm 0 the scripted player's, the others bots.
const SETUPS = Array.from({ length: SPEC.realms }, (_, i) => ({
  id: i,
  gamePlayerId: 'gp' + String(i),
  isBot: i !== SCRIPTED_REALM,
  name: 'Realm' + String(i),
  kingName: 'King' + String(i),
  kingdomName: 'Realm' + String(i),
  race: SPEC.races[i % SPEC.races.length],
  alignment: SPEC.alignments[i % SPEC.alignments.length],
  temper: 'Brave',
  skills: { melee: 1, tactical: 1, march: 1, white: 1, naval: i % 3 === 0 ? 1 : 0, sage: 1, explorer: 1 },
}));

/** The caches a turn seeds afresh at its start, so they carry nothing from one turn to the next. */
const RESEEDED = ['_usedHeroNames', '_usedHeroFirsts', '_usedHeroEpithets', '_usedArmyUnitNames', '_MAXHP_PLAYERS'];

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
  resolveTurn(state: string, rows: unknown, turn: number): Resolved;
}

/** The engine, loaded the one way (from `src`, by default this checkout's src/), with the tripwires set. */
function pureEngine(src?: string): Engine {
  const engine = loadEngine(src === undefined ? { seed: SPEC.seed } : { seed: SPEC.seed, src });
  const reaches: string[] = [];
  const said: string[] = [];
  (vm.runInContext(TRIPWIRES, engine) as (r: string[], s: string[]) => void)(reaches, said);
  const resolveTurn = vm.runInContext('resolveTurn', engine) as Engine['resolveTurn'];
  return { engine, reaches, said, resolveTurn };
}

/** A new world for the game, made by the engine itself, as the shell's caller saves it (JSON). */
function newWorld({ engine }: Engine): string {
  const make = vm.runInContext(
    `(setups,size,opts,diplomacy)=>{ const g=generateNewGame(JSON.parse(setups),JSON.parse(size),0,JSON.parse(opts));
      g.turnMode={mode:'manual',time:'20:00',everyDays:1,nextDeadlineAt:null,turnRanAt:null};
      g.botDifficulty='hard'; g.botDiplomacy=diplomacy; return JSON.stringify(g); }`,
    engine,
  ) as (...a: string[]) => string;
  return make(
    JSON.stringify(SETUPS),
    JSON.stringify(MAP_SIZES[SPEC.realms]),
    JSON.stringify({ seaPct: SPEC.seaPct }),
    SPEC.diplomacy,
  );
}

/** The game's slot rows for a turn, as the shell loads them: realm 0 with the scripted orders it sent, the others
 *  bots. Made in the vm, so they are its own objects, as the shell's are the page's. */
function slotRows({ engine }: Engine, state: string, turn: number): unknown {
  const orders = JSON.stringify(scriptedOrders(JSON.parse(state) as State, SCRIPTED_REALM, turn).orders);
  const rows = SETUPS.map((s) => ({
    id: 'G1gp' + String(s.id),
    game_id: 'G1',
    user_id: s.isBot ? null : 'u' + String(s.id),
    player_index: s.id,
    display_name: s.name,
    orders_submitted: !s.isBot,
    orders: s.isBot ? null : orders,
    turn_report: JSON.stringify(s.isBot ? { isBot: true, playerSetup: {} } : {}),
  }));
  return (vm.runInContext('(j)=>JSON.parse(j)', engine) as (j: string) => unknown)(JSON.stringify(rows));
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

/** A function, in the vm, that gives each of `names` as JSON (a Set or a Map as its entries). */
function snapshotOf({ engine }: Engine, names: string[]): () => Record<string, string> {
  const fields = names.map((n) => `${JSON.stringify(n)}:JSON.stringify(${n},plain)`).join(',');
  return vm.runInContext(
    `()=>{ const plain=(k,x)=>x instanceof Set?{set:[...x]}:x instanceof Map?{map:[...x]}:x; return {${fields}}; }`,
    engine,
  ) as () => Record<string, string>;
}

describe('a whole game, played in the bare vm', () => {
  const played = {
    turns: 0,
    /** Each turn's reports: the realm each was built for. */
    reports: [] as unknown[][],
    /** Each turn's new state, as the turn it now stands on. */
    nextTurns: [] as number[],
    logLines: [] as number[],
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
    let state = newWorld(e);
    const before = new Set(globals());
    let was = snapshot();
    for (let turn = 1; turn <= MAX_TURNS; turn++) {
      if ((JSON.parse(state) as { gameOver?: unknown }).gameOver) break;
      const resolved = e.resolveTurn(state, slotRows(e, state, turn), turn);
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
      state = resolved.state;
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
  const file = path.join(copy, 'engine', 'run-turn.js');
  const original = fs.readFileSync(file, 'utf8');
  // Where each fault goes: at the start of the five phases, and at the start of the reports.
  const AT = {
    resolution: '  // 4. Run all 5 phases\n',
    reports: '  const activePlayers=freshPlayers.filter(p=>p.user_id);\n',
  };
  const world = newWorld(pureEngine());
  // The engine from the copy, with `line` planted after `at`.
  const planted = (at: string, line: string): Engine => {
    if (original.split(at).length !== 2) throw new Error(`not once in run-turn.js: ${at}`);
    fs.writeFileSync(file, original.replace(at, `${at}  ${line}\n`));
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
    expect(() => e.resolveTurn(world, slotRows(e, world, 1), 1)).toThrow(error);
    expect(new Set(e.reaches)).toEqual(new Set([reach]));
  });

  test.each(FAULTS)('planted %s in the reports', (reach, line, error) => {
    const e = planted(AT.reports, line);
    const resolved = e.resolveTurn(world, slotRows(e, world, 1), 1);
    expect(() => resolved.buildReports()).toThrow(error);
    expect(new Set(e.reaches)).toEqual(new Set([reach]));
  });
});
