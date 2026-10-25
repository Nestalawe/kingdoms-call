// The rule registry fails to compile when an effect and its content row part (plan P1-19, Decisions 2 and 3): the
// registry (src/engine/rules/the-registry-of-content-effects.ts) ends with `satisfies Record<UnitAbilitySlug,
// UnitAbilityEntry>`, where UnitAbilitySlug is the keys of the content's rows (src/content/unit-abilities-their-names-
// numbers-and-words.ts). TypeScript compiles copies of the two files and of what they import, each with one fault
// planted, and must refuse each, naming the slug:
// - a content row with no entry (TS1360: the registry doesn't satisfy its type, the slug missing);
// - an entry with no content row (TS2353: a key the type doesn't know);
// - an entry with an effect at a stage that has no signature yet, and at a hook point that has none (both `never`
//   until their family's first row writes them: plan P1-19's Choice 1; TS2322).
// The files as they are compile with no error. Level 0 (static): the compiler reads the copies and nothing runs; a
// lower level has nothing to read. The copies hold only src/content/ and src/engine/rules/ (the registry imports nothing
// else: npm run lint:arch), so each compiles on its own with tsconfig.json's settings. About 2 s (the data file is read
// once a copy), so its limit is a TypeScript program's.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { afterAll, expect, test } from 'vitest';
import { filesUnder, ROOT } from '../../tools/build.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const REGISTRY = 'src/engine/rules/the-registry-of-content-effects.ts';
const ROWS = 'src/content/unit-abilities-their-names-numbers-and-words.ts';
/** The files a copy holds: the content and the registry's folder. */
const COPIED = [
  'src/content/kingdoms-call-data.ts',
  ROWS,
  ...filesUnder(path.join(ROOT, 'src', 'engine', 'rules')).map((f) => `src/engine/rules/${f}`),
];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-the-rule-registry-'));
afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** `text` with `from` replaced by `to`, where `from` is found exactly once (else the plant would miss: it throws). */
function replacedOnce(text: string, from: string, to: string): string {
  const at = text.indexOf(from);
  if (at < 0 || text.includes(from, at + 1)) throw new Error(`the plant's anchor is not in the file once: ${from}`);
  return text.slice(0, at) + to + text.slice(at + from.length);
}

const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const WYRMSCALE_ENTRY =
  "  wyrmscale: { strength: { 'the whole force': THE_STRENGTH_OF_A_UNIT_IN_ITS_FORCE.wyrmscale } },\n";

/** Each copy: its name, and the files it changes (by path from the repository's root) with their planted text. */
const PLANTS: Record<string, Record<string, string>> = {
  'as they are': {},
  'a content row with no entry': {
    [ROWS]: replacedOnce(
      read(ROWS),
      '} as const satisfies Record<string, AUnitAbilityAsTheBooksWriteIt>;',
      "  'planted-ability': { unit: 'Goblin Horde', name: 'Planted Ability', numbers: {} },\n} as const satisfies Record<string, AUnitAbilityAsTheBooksWriteIt>;",
    ),
  },
  'an entry with no content row': {
    [REGISTRY]: replacedOnce(read(REGISTRY), WYRMSCALE_ENTRY, WYRMSCALE_ENTRY + "  'planted-ability': {},\n"),
  },
  'an effect at a stage with no signature yet': {
    [REGISTRY]: replacedOnce(
      read(REGISTRY),
      WYRMSCALE_ENTRY,
      "  wyrmscale: {\n    strength: { 'the whole force': THE_STRENGTH_OF_A_UNIT_IN_ITS_FORCE.wyrmscale },\n    fate: { 'a beaten unit fails its death roll': () => null },\n  },\n",
    ),
  },
  'an effect at a hook point with no signature yet': {
    [REGISTRY]: replacedOnce(
      read(REGISTRY),
      WYRMSCALE_ENTRY,
      "  wyrmscale: {\n    strength: { 'the whole force': THE_STRENGTH_OF_A_UNIT_IN_ITS_FORCE.wyrmscale },\n    volley: { 'who shoots': () => true },\n  },\n",
    ),
  },
};

/** The slug a compiler message is about: the key a `satisfies` found missing, or the key it doesn't know; else, for a
 *  value given where the type has no signature yet, that type. */
const KEY_NAMED = /Property '"?([^"']+)"?' is missing in type|and ''([^']+)'' does not exist in type/;
const NO_SIGNATURE = /is not assignable to type '(never|undefined)'\.$/;

/** The compiler's errors in each planted copy, as `TS<code> in <the declaration it stands in>: <the slug it names, or
 *  the type with no signature>` (the declaration alone, for an error of another kind). */
function errorsIn(copies: Record<string, Record<string, string>>): Record<string, string[]> {
  const dirOf = (name: string) => path.join(tmp, name.replace(/[^a-z]+/gi, '-'));
  for (const [name, planted] of Object.entries(copies)) {
    for (const file of COPIED) {
      fs.mkdirSync(path.dirname(path.join(dirOf(name), file)), { recursive: true });
      fs.writeFileSync(path.join(dirOf(name), file), planted[file] ?? read(file));
    }
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
  const program = ts.createProgram(
    Object.keys(copies).map((name) => path.join(dirOf(name), REGISTRY)),
    config.options,
  );
  return Object.fromEntries(
    Object.keys(copies).map((name) => {
      const errors = COPIED.flatMap((file) => {
        const source = program.getSourceFile(path.join(dirOf(name), file));
        if (!source) throw new Error(`${file} of the copy "${name}" is not in the program`);
        const text = source.getFullText();
        return [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)].map((d) => {
          const declaration = [
            ...text.slice(0, text.indexOf('\n', d.start ?? 0)).matchAll(/^(?:export )?const (\w+)/gm),
          ].at(-1)?.[1];
          const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
          const key = KEY_NAMED.exec(message);
          const named = key?.[1] ?? key?.[2] ?? NO_SIGNATURE.exec(message.split('\n')[0] ?? '')?.[1];
          return `TS${String(d.code)} in ${path.basename(file)}, ${declaration ?? '(top)'}${named ? ': ' + named : ''}`;
        });
      });
      return [name, errors.sort()];
    }),
  );
}

test(
  'the registry and its content rows compile as they are, and each planted copy fails, naming the slug',
  timeLimitForTheWork({ typeScriptPrograms: 1 }),
  () => {
    // The registry's widened view (ENTRIES, which the runners read) fails too wherever its literal does.
    const at = (declaration: string) => `${path.basename(REGISTRY)}, ${declaration}`;
    expect(errorsIn(PLANTS)).toEqual({
      'as they are': [],
      'a content row with no entry': [
        `TS1360 in ${at('THE_REGISTRY_OF_UNIT_ABILITIES')}: planted-ability`,
        `TS2741 in ${at('ENTRIES')}: planted-ability`,
      ],
      'an entry with no content row': [`TS2353 in ${at('THE_REGISTRY_OF_UNIT_ABILITIES')}: planted-ability`],
      'an effect at a stage with no signature yet': [
        `TS2322 in ${at('ENTRIES')}`,
        `TS2322 in ${at('THE_REGISTRY_OF_UNIT_ABILITIES')}: undefined`,
      ],
      'an effect at a hook point with no signature yet': [
        `TS2322 in ${at('ENTRIES')}`,
        `TS2322 in ${at('THE_REGISTRY_OF_UNIT_ABILITIES')}: never`,
      ],
    });
  },
);
