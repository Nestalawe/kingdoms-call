// What each page keeps on `window` once its scripts are ES modules (plan P1-09b; P1-09's Decision 7). Each script page
// ends with src/ui/<page>/globals.ts: two Object.assign(window, { … }) lists, the names its inline handlers call and
// the names its tests reach. A variable a handler or a test reaches can't go on a list (the list copies its value once,
// and the copy goes stale once it changes): it is a declared global, `globalThis.<name> = <value>;` where it was
// declared. This test reads the templates, the scripts and the tests (tests/lib/page-globals.ts says how) and checks:
// - each list holds exactly what is needed, each name a function or a constant of the page, in the file it names;
// - no handler or test reaches a page variable that isn't a declared global;
// - no test stands a function in on a page (it would reach nothing once the page is modules);
// - the classic scripts a page keeps (its boot-failure reporter, kc-config.js, the staging footer) read none of its
//   module names;
// - every test's evaluated code is read, but the known calls below;
// - and on a copy of src/ with a fault planted, and on code written here, the checks see each fault.
// So a name a page needs and doesn't list fails here, before the switch to modules (P1-09d) would hide it.
// Level 0 (static): it reads the sources and the tests, and runs nothing.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { ROOT } from '../../tools/build.ts';
import { importsOf } from '../../tools/pages.ts';
import {
  entryOf,
  globalsFileOf,
  globalsLists,
  handlerNames,
  namesClassicScriptsRead,
  namesTestsReachOnPages,
  pageDeclarations,
  pagesOpenedBy,
  reachOfTestFile,
  SCRIPT_PAGE_NAMES,
  type PageReach,
  type ScriptPage,
} from '../lib/page-globals.ts';

/** Evaluating calls whose code isn't a string, a template, a function or a constant of their file, and why each is
 *  safe to leave unread. */
const UNREAD_ON_PURPOSE: Record<string, string[]> = {
  // the stand-in database for the browser (browserSource): it reads no page name
  'tests/browser/chromium-boot.spec.ts': ['page.addInitScript(browserSource.null)'],
  'tests/browser/orders-buttons-visible.spec.ts': ['page.addInitScript(browserSource.null)'],
  // the screen tours' code, which page-globals.ts reads as every string of the file
  'tests/lib/screens.js': ['w.eval(code)', 'p.evaluate(code)'],
};

const sorted = (names: Iterable<string>) => [...names].sort((a, b) => a.localeCompare(b, 'en'));

/** Everything wrong with the page's lists and its declared globals, read from `src`, with `reach` the tests' reach on
 *  it: one line per fault. */
function problemsOf(
  page: ScriptPage,
  reach: PageReach,
  src?: string,
  main: readonly string[] = importsOf(entryOf(page), src),
): string[] {
  const problems: string[] = [];
  const declarations = pageDeclarations(page, src);
  const lists = globalsLists(page, src);
  const handlers = handlerNames(page, src);
  const kindOf = (name: string) => declarations.get(name)?.kind;
  const isVariable = (name: string) => kindOf(name) === 'let' || kindOf(name) === 'var';
  if (main[main.length - 1] !== globalsFileOf(page))
    problems.push(`${globalsFileOf(page)} isn't the last file ${entryOf(page)} imports`);
  const listed = [...lists.handlers, ...lists.tests];
  for (const { name, file } of listed) {
    const d = declarations.get(name);
    if (!d) problems.push(`listed, but not a top-level name of the page: ${name}`);
    else if (d.kind === 'global') problems.push(`listed, but a declared global: ${name}`);
    else if (d.kind === 'let' || d.kind === 'var')
      problems.push(`listed, but a ${d.kind} (its copy would go stale): ${name}`);
    else if (d.file !== file) problems.push(`listed as from ${file || 'nowhere'}, but declared in ${d.file}: ${name}`);
  }
  const counts = new Map<string, number>();
  for (const { name } of listed) counts.set(name, (counts.get(name) ?? 0) + 1);
  for (const [name, n] of counts) if (n > 1) problems.push(`listed ${String(n)} times: ${name}`);
  const listable = (name: string) => kindOf(name) !== 'global' && !isVariable(name);
  const wantHandlers = sorted([...handlers.keys()].filter(listable));
  const wantTests = sorted([...reach.reads.keys()].filter((n) => listable(n) && !handlers.has(n)));
  const compare = (which: string, have: string[], want: string[]) => {
    for (const n of want) if (!have.includes(n)) problems.push(`missing from the ${which}' list: ${n}`);
    for (const n of have)
      if (!want.includes(n)) problems.push(`on the ${which}' list, but nothing there needs it: ${n}`);
  };
  compare('handlers', sorted(lists.handlers.map((l) => l.name)), wantHandlers);
  compare('tests', sorted(lists.tests.map((l) => l.name)), wantTests);
  for (const name of handlers.keys())
    if (isVariable(name))
      problems.push(`an inline handler reaches a ${String(kindOf(name))} that isn't a declared global: ${name}`);
  for (const [name, by] of reach.reads)
    if (isVariable(name))
      problems.push(
        `a test reaches a ${String(kindOf(name))} that isn't a declared global: ${name} (${by.join('; ')})`,
      );
  for (const [name, by] of reach.writes)
    if (kindOf(name) !== 'global' && !isVariable(name))
      problems.push(`a test stands in a page ${String(kindOf(name))}: ${name} (${by.join('; ')})`);
  for (const [name, by] of namesClassicScriptsRead(page, src))
    problems.push(`a classic script reads a module name: ${name} (${by.join('; ')})`);
  return problems;
}

const reach = namesTestsReachOnPages();

describe.each(SCRIPT_PAGE_NAMES)('%s', (page) => {
  test('its globals.ts lists exactly what its handlers and its tests reach, and every variable they reach is a declared global', () => {
    expect(problemsOf(page, reach.pages[page])).toEqual([]);
  });

  test('the lists are not empty', () => {
    const lists = globalsLists(page);
    expect(lists.handlers.length, 'the handlers list').toBeGreaterThan(0);
    expect(lists.tests.length, 'the tests list').toBeGreaterThan(0);
  });
});

test('every evaluating call in the tests has code that is read, but the known ones', () => {
  expect(reach.unread).toEqual(UNREAD_ON_PURPOSE);
});

test('the declared globals are on the two portals and the Hall of Fame, as many as found', () => {
  const declared = (page: ScriptPage) =>
    sorted([...pageDeclarations(page)].filter(([, d]) => d.kind === 'global').map(([n]) => n));
  expect(declared('kingdoms-call-gm-portal.html')).toContain('currentGame');
  expect(declared('kingdoms-call-player-portal.html')).toContain('currentReport');
  expect(declared('kingdoms-call-leaderboard.html')).toEqual(['GAMES']);
  expect(declared('kingdoms-call-overlord.html')).toEqual([]);
});

describe('a fault planted in a copy of src/ is seen', () => {
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-page-globals-'));
  fs.cpSync(path.join(ROOT, 'src'), copy, { recursive: true });
  afterAll(() => {
    fs.rmSync(copy, { recursive: true, force: true });
  });
  const GM: ScriptPage = 'kingdoms-call-gm-portal.html';
  const PLAYER: ScriptPage = 'kingdoms-call-player-portal.html';
  /** The problems of `page` once `edit` has changed `file` in the copy (relative to src/), with the file put back. */
  const plantedProblems = (page: ScriptPage, file: string, edit: (text: string) => string): string[] => {
    const full = path.join(copy, file);
    const was = fs.readFileSync(full, 'utf8');
    const now = edit(was);
    expect(now, 'the plant changed the file').not.toBe(was);
    fs.writeFileSync(full, now);
    try {
      return problemsOf(page, reach.pages[page], copy);
    } finally {
      fs.writeFileSync(full, was);
    }
  };
  const drop = (name: string) => (text: string) => text.replace(new RegExp(`^  ${name}, //.*\\n`, 'm'), '');

  test('a handler name taken off the first list', () => {
    expect(plantedProblems(GM, 'ui/gm/globals.ts', drop('runTurn0'))).toEqual([
      "missing from the handlers' list: runTurn0",
    ]);
  });

  test('a name a test reaches taken off the second list', () => {
    expect(plantedProblems(PLAYER, 'ui/player/globals.ts', drop('buildOrdersForm'))).toEqual([
      "missing from the tests' list: buildOrdersForm",
    ]);
  });

  test('a name nothing needs put on a list', () => {
    expect(
      plantedProblems(GM, 'ui/gm/globals.ts', (t) =>
        t.replace('  runTurn0, //', '  resolveTurn, // engine/run-turn.ts\n  runTurn0, //'),
      ),
    ).toEqual(["on the handlers' list, but nothing there needs it: resolveTurn"]);
  });

  test('a name listed with the wrong file', () => {
    expect(
      plantedProblems(GM, 'ui/gm/globals.ts', (t) =>
        t.replace('  runTurn0, // ui/gm/turn-zero.ts', '  runTurn0, // ui/gm/start.ts'),
      ),
    ).toEqual(['listed as from ui/gm/start.ts, but declared in ui/gm/turn-zero.ts: runTurn0']);
  });

  test('a declared global put back as a let', () => {
    const problems = plantedProblems(GM, 'ui/gm/config.ts', (t) =>
      t.replace('globalThis.currentGame = null;', 'let currentGame = null;'),
    );
    expect(problems).toContain("an inline handler reaches a let that isn't a declared global: currentGame");
    expect(problems.some((p) => p.startsWith("a test reaches a let that isn't a declared global: currentGame ("))).toBe(
      true,
    );
  });

  test('a variable put on a list', () => {
    const problems = plantedProblems(PLAYER, 'ui/player/globals.ts', (t) =>
      t.replace('  buildOrdersForm, //', '  _deskRightView, // ui/player/layout.ts\n  buildOrdersForm, //'),
    );
    expect(problems).toContain('listed, but a let (its copy would go stale): _deskRightView');
  });

  test('globals.ts not the last file the entry imports', () => {
    const main = importsOf(entryOf(GM));
    const moved = [...main.slice(0, -2), globalsFileOf(GM), ...main.slice(-2, -1)];
    expect(problemsOf(GM, reach.pages[GM], undefined, moved)).toEqual([
      "ui/gm/globals.ts isn't the last file ui/gm/page.ts imports",
    ]);
  });
});

describe('what a test reaches on a page is read from its code', () => {
  const GM_BOOT = "const W=bootJsdom(readPage('kingdoms-call-gm-portal.html')).window;\n";
  const reached = (code: string) => {
    const r = reachOfTestFile('tests/planted.test.js', GM_BOOT + code);
    return { reads: sorted(r.reads.keys()), writes: sorted(r.writes.keys()), unread: r.unread };
  };

  test('the pages a file opens', () => {
    expect(pagesOpenedBy(GM_BOOT)).toEqual(['kingdoms-call-gm-portal.html']);
    expect(pagesOpenedBy('const sc=await bootScenario();')).toEqual(['kingdoms-call-gm-portal.html']);
    expect(pagesOpenedBy("const sc=scenarioInTheVm({seed:1}); readPage('kingdoms-call-gm-portal.html');")).toEqual([]);
  });

  test('a string, a template, a function and a constant handed to eval or evaluate', () => {
    expect(reached("W.eval('runTurn()');").reads).toContain('runTurn');
    expect(reached('W.eval(`openGame(${id})`);').reads).toContain('openGame');
    expect(reached('await page.evaluate(() => loadGames());').reads).toContain('loadGames');
    expect(reached("const CODE='renderGameList()'; W.eval(CODE);").reads).toContain('renderGameList');
  });

  test("a wrapper's argument, a window's property, and what is assigned", () => {
    expect(reached("const ev=x=>W.eval(x); ev('showNewGame()');").reads).toContain('showNewGame');
    expect(reached("W.generateNewGame([]); W['probeTelemetry']();").reads).toEqual(
      expect.arrayContaining(['generateNewGame', 'probeTelemetry']),
    );
    expect(reached("W.eval('currentGame={id:1}'); W.runTurn=()=>{}; W['openGame']=null;").writes).toEqual([
      'currentGame',
      'openGame',
      'runTurn',
    ]);
  });

  test("the engine's vm is not a page, and code that can't be read is reported", () => {
    const vmOnly = reached(
      "const sc=scenarioInTheVm({seed:1}); const V=sc.W; const P=sc.W; P.trySkillGain=null; P.eval('d100()');",
    );
    expect(vmOnly.reads).not.toContain('trySkillGain');
    expect(vmOnly.reads).not.toContain('d100');
    expect(reached('W.eval(makeCode());').unread).toEqual(['W.eval(makeCode())']);
  });
});
