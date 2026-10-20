// The tests' way of reading the site's code (tests/lib/source.ts, plan P1-09a) reads the same whatever the layout: for
// every file of the site's own code, its canonical layout (compactOf) and its strings (stringsOf) are the same as
// written and once Prettier has laid it out otherwise (lines a half as long and the other quotes: unlike the
// repository's own settings, which P1-09c applies to src/, it changes every file, before that row and after), and so
// is each helper's answer on a few real files. A declaration with `export` in front, and a TypeScript file, read as the
// classic script they will be after the module switch (P1-09d) and the rename (P1-09e).
// Level 1 (unit): the helpers on src/ and on copies of it made here, in a temporary folder.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import * as prettier from 'prettier';
import { afterAll, describe, expect, test } from 'vitest';
import { filesUnder, ROOT } from '../../tools/build.ts';
import {
  callsTo,
  compactCode,
  compactDeclaration,
  compactOf,
  entriesOf,
  initializersOf,
  plantAtStart,
  plantBefore,
  replaceInitializer,
  scriptOf,
  sourceFrom,
  sourceOf,
  SRC,
  statementsBetween,
  statementsFollowing,
  stringsOf,
  topLevelNames,
} from '../lib/source.ts';

const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-source-'));
afterAll(() => {
  fs.rmSync(copy, { recursive: true, force: true });
});
const settings = JSON.parse(fs.readFileSync(path.join(ROOT, '.prettierrc.json'), 'utf8')) as {
  printWidth: number;
  singleQuote: boolean;
};
const options = { ...settings, printWidth: Math.round(settings.printWidth / 2), singleQuote: !settings.singleQuote };
const own = filesUnder(SRC).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'));
// src/ laid out otherwise by Prettier, file by file, into the copy
for (const f of own) fs.mkdirSync(path.dirname(path.join(copy, f)), { recursive: true });
await Promise.all(
  own.map(async (f) => {
    const text = fs.readFileSync(path.join(SRC, f), 'utf8');
    fs.writeFileSync(path.join(copy, f), await prettier.format(text, { ...options, filepath: f }));
  }),
);
const pretty = { src: copy };

// Each of the two checks below reads every file twice: about 2 s here and 4 to 8 s on a CI runner, so they have time
// enough of their own (Vitest's default, 5 s, failed on a slow runner).
const EVERY_FILE_TWICE_MS = 60_000;

describe('every file of the site reads the same laid out otherwise', () => {
  test(
    `${String(own.length)} files: the same canonical layout`,
    () => {
      const differ = own.filter((f) => compactOf(f) !== compactOf(f, pretty));
      expect(differ).toEqual([]);
    },
    EVERY_FILE_TWICE_MS,
  );
  test(
    `${String(own.length)} files: the same strings, in the same order`,
    () => {
      const differ = own.filter((f) => JSON.stringify(stringsOf(f)) !== JSON.stringify(stringsOf(f, pretty)));
      expect(differ).toEqual([]);
    },
    EVERY_FILE_TWICE_MS,
  );
  test('Prettier did change the files (the copy is not the source)', () => {
    const changed = own.filter(
      (f) => fs.readFileSync(path.join(SRC, f), 'utf8') !== fs.readFileSync(path.join(copy, f), 'utf8'),
    );
    expect(changed.length).toBeGreaterThan(own.length * 0.9);
  });
});

describe('each helper gives the same answer on both layouts', () => {
  type Read = (o: { src?: string }) => unknown;
  const reads: [string, Read][] = [
    ['topLevelNames', (o) => topLevelNames('ui/gm/hall-of-fame.ts', o)],
    [
      'sourceFrom, run as a script',
      (o) => {
        const KC_UNIT_CLASS = { sea: [], aerial: [], creature: [], monster: [], missile: [], cavalry: [] };
        const ctx = vm.createContext({ KC_UNIT_CLASS });
        vm.runInContext(
          sourceFrom('ui/gm/hall-of-fame.ts', '_LB_SEA', 'lbSumStr', o) + ';this._t=typeof lbSumStr',
          ctx,
        );
        return ctx['_t'] as unknown;
      },
    ],
    [
      'sourceOf and scriptOf, run as a script',
      (o) =>
        JSON.stringify(
          vm.runInNewContext(
            scriptOf('content/kingdoms-call-data.ts', o) +
              ';' +
              sourceOf('engine/battle/lines.ts', ['BATTLE_FRONT_RANGE'], o) +
              ';[BATTLE_FRONT_RANGE, KC_PHASE_NAMES]',
          ),
        ),
    ],
    [
      'statementsBetween',
      (o) => compactCode(statementsBetween('engine/world/generate.ts', 'generateNewGame', 'cellIdRC', 'cellDistRC', o)),
    ],
    ['statementsFollowing', (o) => statementsFollowing('kingdoms-call-gm-portal.html', /hauls out/, 4, o)],
    ['initializersOf', (o) => initializersOf('ui/gm/startup.ts', 'KC_SHARED_TABLE_NAMES', o).map(compactCode)],
    ['entriesOf', (o) => entriesOf('ui/player/briefing-and-submit.ts', 'UNIT_ABILITIES', o)],
    ['callsTo', (o) => callsTo('engine/battle/battles-between-heroes.ts', 'trySkillGain', o)],
    [
      'compactDeclaration',
      (o) =>
        compactDeclaration(
          'engine/orders/order-dispatch-the-checks-before-a-hero-order-and-the-switch.ts',
          'processOrder',
          o,
        ),
    ],
  ];
  test.each(reads)('%s', (_, read) => {
    const asWritten = read({});
    expect(asWritten).toBeTruthy();
    expect(read(pretty)).toEqual(asWritten);
  });
  test('sourceFrom gives the functions it names', () => {
    expect(reads[1]?.[1]({})).toBe('function');
  });
});

describe('a module, a TypeScript file and a declared global, read as the classic script they will be', () => {
  const dense = "const A={a:'x'};\nfunction f(n){ return A.a+n; }\nlet hits=[f(1)];\n";
  const asModule =
    "import { g } from './g.js';\nexport const A={a:'x'};\nexport function f(n){ return A.a+n; }\nexport let hits=[f(1)];\nexport { g };\n";
  const asTypeScript =
    "import { g } from './g.ts';\nexport const A: Record<string, string> = { a: 'x' };\nexport function f(n: number): string {\n  return A['a'] + n;\n}\nexport let hits: string[] = [f(1)];\nexport type T = number;\nexport { g };\n";
  // a page variable its files and tests share, as a declared global (plan P1-09b): read as a declaration too
  const asDeclaredGlobal = "const A={a:'x'};\nfunction f(n){ return A.a+n; }\nglobalThis.hits=[f(1)];\n";
  const files = {
    'dense.js': dense,
    'module.js': asModule,
    'typescript.ts': asTypeScript,
    'declared-global.js': asDeclaredGlobal,
  };
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(copy, name), text);
  const value = (code: string) => vm.runInNewContext(code + ';[A.a, f(2), hits[0]]') as unknown;
  test.each(Object.keys(files))('%s', (name) => {
    expect(topLevelNames(path.join(copy, name))).toEqual(['A', 'f', 'hits']);
    expect(value(sourceOf(path.join(copy, name), ['A', 'f', 'hits']))).toEqual(['x', 'x2', 'x1']);
    expect(value(scriptOf(path.join(copy, name)))).toEqual(['x', 'x2', 'x1']);
    expect(compactDeclaration(path.join(copy, name), 'f')).toMatch(/^(export )?function f\(n\)\{return A/);
    expect(stringsOf(path.join(copy, name)).filter((s) => s === 'x')).toEqual(['x']);
  });
  // P1-09e renamed every file of src/ .ts with no type in it: each piece must read byte for byte as it did as .js (a
  // test matches `30`, not `"use strict";\n(30);\n`, the reprint transpileModule would give).
  test('a .ts file with no types reads as the same text named .js, byte for byte', () => {
    const text = "import { g } from './g.ts';\nexport const N = 30;\nexport const L = [\n  'a',\n  'b',\n];\n";
    for (const name of ['untyped.js', 'untyped.ts']) fs.writeFileSync(path.join(copy, name), text);
    const reads = (name: string) => [
      initializersOf(path.join(copy, name), 'N'),
      initializersOf(path.join(copy, name), 'L'),
      sourceOf(path.join(copy, name), ['N', 'L']),
      scriptOf(path.join(copy, name)),
    ];
    expect(reads('untyped.ts')).toEqual(reads('untyped.js'));
    expect(reads('untyped.ts')[0]).toEqual(['(30)']);
    // and a piece with types has them stripped, whichever TypeScript-only form it uses
    const typed = 'export const A = f<number>(x!) as number;\nexport function g(a?: string): void {}\n';
    fs.writeFileSync(path.join(copy, 'typed.ts'), typed);
    expect(initializersOf(path.join(copy, 'typed.ts'), 'A')).toEqual(['f(x)']);
    expect(sourceOf(path.join(copy, 'typed.ts'), ['g'])).toBe('function g(a) { }\n');
  });
});

describe('the planting helpers put the line in the same place in either layout', () => {
  const file = 'engine/run-turn.ts';
  const planted = (o: { src?: string }) => {
    const code = fs.readFileSync(path.join(o.src ?? SRC, file), 'utf8');
    return [
      plantBefore(code, file, 'resolveTurn', 'turnLog', 'PLANTED_BEFORE();'),
      plantAtStart(code, file, 'resolveTurn', 'PLANTED_FIRST();'),
    ].map((c) => {
      fs.writeFileSync(path.join(copy, 'planted.js'), c);
      const body = compactDeclaration(path.join(copy, 'planted.js'), 'resolveTurn');
      return [body.indexOf('PLANTED_BEFORE();const{turnLog}=turnContext;'), body.indexOf('{PLANTED_FIRST();')];
    });
  };
  test('before the statement declaring turnLog, and first in the body', () => {
    const [before, first] = planted({});
    expect(before?.[0]).toBeGreaterThan(0);
    expect(first?.[1]).toBeGreaterThan(0);
    expect(planted(pretty).map((p) => p.map((i) => i > 0))).toEqual(planted({}).map((p) => p.map((i) => i > 0)));
  });
  test('replaceInitializer replaces the one value', () => {
    const code = fs.readFileSync(path.join(SRC, 'engine/world/generate.ts'), 'utf8');
    const out = replaceInitializer(code, 'engine/world/generate.ts', 'generateNewGame', '_freeNbrs', '[]');
    fs.writeFileSync(path.join(copy, 'generate.js'), out);
    expect(initializersOf(path.join(copy, 'generate.js'), '_freeNbrs')).toEqual(['([])']);
  });
});
