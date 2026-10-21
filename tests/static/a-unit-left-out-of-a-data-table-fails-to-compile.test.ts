// The data file's tables keyed by unit type fail to compile when a unit is left out of one that must list it (plan
// P1-10a2): src/content/kingdoms-call-data.ts ends each with `satisfies` on the part it covers (UnitType and its three
// parts are declared there). TypeScript compiles copies of the file, each with one fault planted, and must refuse
// each in the tables named, naming the unit:
// - a humanoid unit's base strength left out (KC_UNIT_BASE_STR), and an elemental's;
// - a new unit type with nothing else written for it (its base strength and its names are missing);
// - a unit's names left out (ARMY_UNIT_NAMES with PRIMAL_UNIT_NAMES name every unit type);
// - a primal unit KC_UNIT_TYPE doesn't list (PRIMAL_ARMY_DEFS_P, ARMY_UNIT_NAMES and KC_CARRIER_BERTHS name unit
//   types only).
// The file as it is compiles with no error. Level 0 (static): the compiler reads the copies and nothing runs; a lower
// level has nothing to read. The data file imports nothing, so each copy compiles on its own (with tsconfig.json's
// settings), not the whole repository.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { afterAll, expect, test } from 'vitest';
import { ROOT } from '../../tools/build.ts';
import { DATA_FILE } from '../../tools/pages.ts';

const DATA = fs.readFileSync(path.join(ROOT, 'src', DATA_FILE), 'utf8');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-unit-tables-'));
afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** `text` with `from` replaced by `to`, where `from` is found exactly once (else the plant would miss: it throws). */
function replacedOnce(text: string, from: string, to: string): string {
  const at = text.indexOf(from);
  if (at < 0 || text.indexOf(from, at + 1) >= 0)
    throw new Error(`the plant's anchor is not in the data file once: ${from}`);
  return text.slice(0, at) + to + text.slice(at + from.length);
}

const PLANTS: Record<string, string> = {
  'as it is': DATA,
  "Black Arrows' base strength left out": replacedOnce(DATA, "    'Black Arrows': 4,\n", ''),
  "the Darkness Elemental's base strength left out": replacedOnce(DATA, "    'Darkness Elemental': 11,\n", ''),
  'a new unit type, Planted Pikemen, with nothing else written for it': replacedOnce(
    DATA,
    "  'Black Arrows': 'ranged',\n",
    "  'Black Arrows': 'ranged',\n  'Planted Pikemen': 'infantry',\n",
  ),
  "Black Arrows' names left out": DATA.replace(/^ {2}'Black Arrows': \[\n(?: {4}'[^'\n]*',\n)+ {2}\],\n/m, ''),
  'Great Turtles left out of KC_UNIT_TYPE': replacedOnce(DATA, "  'Great Turtles': 'naval',\n", ''),
};

/** The unit a compiler message is about: the key a `satisfies` found missing, or the key it doesn't know. */
const KEY_NAMED = /Property '"([^"]+)"' is missing in type|and ''([^']+)'' does not exist in type/;

/** The compiler's errors in each planted copy, as `TS<code> in <the table it stands in>: <the unit it names>` (or the
 *  message's first line, for an error of another kind). */
function errorsIn(copies: Record<string, string>): Record<string, string[]> {
  const fileOf = (name: string) => path.join(tmp, name.replace(/[^a-z]+/gi, '-'), 'kingdoms-call-data.ts');
  for (const [name, text] of Object.entries(copies)) {
    fs.mkdirSync(path.dirname(fileOf(name)), { recursive: true });
    fs.writeFileSync(fileOf(name), text);
  }
  const config = ts.getParsedCommandLineOfConfigFile(
    path.join(ROOT, 'tsconfig.json'),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (d) => {
        throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n'));
      },
    },
  );
  if (!config) throw new Error('tsconfig.json could not be read');
  const program = ts.createProgram(Object.keys(copies).map(fileOf), config.options);
  return Object.fromEntries(
    Object.entries(copies).map(([name, text]) => {
      const source = program.getSourceFile(fileOf(name));
      if (!source) throw new Error(`the copy "${name}" is not in the program`);
      const errors = [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)].map(
        (d) => {
          const before = text.slice(0, d.start ?? 0);
          const table = [...before.matchAll(/^export const (\w+)/gm)].at(-1)?.[1] ?? '(top)';
          const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
          const key = KEY_NAMED.exec(message);
          return `TS${String(d.code)} in ${table}: ${key?.[1] ?? key?.[2] ?? message.split('\n')[0] ?? ''}`;
        },
      );
      return [name, errors.sort()];
    }),
  );
}

test('the data file compiles as it is, and each planted copy fails in the tables that must list the unit', () => {
  expect(errorsIn(PLANTS)).toEqual({
    'as it is': [],
    "Black Arrows' base strength left out": ['TS1360 in KC_UNIT_BASE_STR: Black Arrows'],
    "the Darkness Elemental's base strength left out": ['TS1360 in KC_UNIT_BASE_STR: Darkness Elemental'],
    'a new unit type, Planted Pikemen, with nothing else written for it': [
      'TS1360 in ARMY_UNIT_NAMES: Planted Pikemen',
      'TS1360 in KC_UNIT_BASE_STR: Planted Pikemen',
    ],
    "Black Arrows' names left out": ['TS1360 in ARMY_UNIT_NAMES: Black Arrows'],
    'Great Turtles left out of KC_UNIT_TYPE': [
      'TS2353 in ARMY_UNIT_NAMES: Great Turtles',
      'TS2353 in KC_CARRIER_BERTHS: Great Turtles',
      'TS2353 in PRIMAL_ARMY_DEFS_P: Great Turtles',
    ],
  });
});
