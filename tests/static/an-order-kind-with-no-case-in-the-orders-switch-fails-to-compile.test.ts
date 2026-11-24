// A kind of order with no case in processOrder's switch fails to compile, naming the kind (P1-10z).
// processOrder (src/engine/orders/order-dispatch-the-checks-before-a-hero-order-and-the-switch.ts) reads an order's
// action as an OrderKind (src/engine/rules-on-plain-values/the-kind-of-order-each-name-of-an-order-reads-as.ts: since
// B-06al the hero orders' rows' keys, src/content/the-hero-orders-…), and its switch's default ends in
// `action satisfies never`. TypeScript compiles the dispatch file with copies of the three files, each with one fault
// planted, and must refuse each on its line, naming the kind:
// - a new row, Planted Order, among the hero orders' rows (its key and its name) and nothing else written for it;
// - Pursue's row read as a kind no row is (the kinds' file refuses it);
// - the Vanish order's case left out of the switch;
// - the Forced March's remapping to a Move left out (the switch has no case of its own for it).
// The files as they are compile with no error. Level 0 (static): the compiler reads the copies and nothing runs; a
// lower level has nothing to read. The dispatch file imports most of the engine, so each copy is a program of its own
// over the real tree with the planted text in place of the file's (the files' syntax trees shared between them).
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';
import { ROOT } from '../../tools/build.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const KINDS_FILE = path.join(
  ROOT,
  'src/engine/rules-on-plain-values/the-kind-of-order-each-name-of-an-order-reads-as.ts',
);
const DISPATCH_FILE = path.join(
  ROOT,
  'src/engine/orders/order-dispatch-the-checks-before-a-hero-order-and-the-switch.ts',
);
const KINDS = fs.readFileSync(KINDS_FILE, 'utf8');
const DISPATCH = fs.readFileSync(DISPATCH_FILE, 'utf8');
const ROWS_FILE = path.join(
  ROOT,
  'src/content/the-hero-orders-their-keys-the-names-the-turn-reads-them-by-and-their-tiers.ts',
);
const ROWS = fs.readFileSync(ROWS_FILE, 'utf8');

/** `text` with `from` replaced by `to`, where `from` is found exactly once (else the plant would miss: it throws). */
function replacedOnce(text: string, from: string, to: string): string {
  const at = text.indexOf(from);
  if (at < 0 || text.includes(from, at + 1)) throw new Error(`the plant's anchor is not in its file once: ${from}`);
  return text.slice(0, at) + to + text.slice(at + from.length);
}

/** A planted copy: the text of each of the three files (the file as it is where the plant leaves it). */
interface APlantedCopy {
  readonly rows: string;
  readonly kinds: string;
  readonly dispatch: string;
}

const PLANTS: Record<string, APlantedCopy> = {
  'as it is': { rows: ROWS, kinds: KINDS, dispatch: DISPATCH },
  "a new row, planted_order, among the hero orders' rows and nothing else written for it": {
    rows: replacedOnce(
      ROWS,
      '} as const satisfies Readonly<Record<string, AHeroOrder>>;\n',
      "  planted_order: { key: 'planted_order', theNamesTheTurnReads: ['planted order'], tier: 0 },\n" +
        '} as const satisfies Readonly<Record<string, AHeroOrder>>;\n',
    ),
    kinds: KINDS,
    dispatch: DISPATCH,
  },
  "Pursue's row read as a kind no row is": {
    rows: replacedOnce(ROWS, "readsAs: 'encounter'", "readsAs: 'planted_order'"),
    kinds: KINDS,
    dispatch: DISPATCH,
  },
  "the Vanish order's case left out of the switch": {
    rows: ROWS,
    kinds: KINDS,
    dispatch: replacedOnce(
      DISPATCH,
      "    case 'vanish':\n      resolveVanishOrder(turnContext, c, prov);\n      break;\n",
      '',
    ),
  },
  "the Forced March's remapping to a Move left out": {
    rows: ROWS,
    kinds: KINDS,
    dispatch: replacedOnce(DISPATCH, "    _fmSlip = true;\n    action = 'move';\n", '    _fmSlip = true;\n'),
  },
};

/** The kind a compiler message is about: the type a `satisfies never` found was not never, or a name given where a
 *  kind of order must be. */
const KIND_NAMED = /^Type '"([^"]+)"' (?:does not satisfy the expected type 'never'|is not assignable to type)/;

/** The compiler's options, as tsconfig.json gives them. */
function theCompilersOptions(): ts.CompilerOptions {
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
  return config.options;
}

/** The compiler's errors in the three files of each planted copy, as `TS<code> in <the function it stands in>: <the
 *  kind it names>` (or the message's first line, for an error of another kind). */
function errorsIn(copies: Record<string, APlantedCopy>): Record<string, string[]> {
  const options = theCompilersOptions();
  const theSyntaxTrees = new Map<string, ts.SourceFile>();
  let oldProgram: ts.Program | undefined;
  return Object.fromEntries(
    Object.entries(copies).map(([name, copy]) => {
      const planted = new Map([
        [ROWS_FILE, copy.rows],
        [KINDS_FILE, copy.kinds],
        [DISPATCH_FILE, copy.dispatch],
      ]);
      const host = ts.createCompilerHost(options, true);
      const readTheRealFile = host.getSourceFile.bind(host);
      host.readFile = (fileName) => planted.get(path.resolve(fileName)) ?? ts.sys.readFile(fileName);
      host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
        const text = planted.get(path.resolve(fileName));
        if (text !== undefined) return ts.createSourceFile(fileName, text, languageVersion, true);
        const known = theSyntaxTrees.get(fileName);
        if (known) return known;
        const read = readTheRealFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
        if (read) theSyntaxTrees.set(fileName, read);
        return read;
      };
      const program = ts.createProgram([DISPATCH_FILE], options, host, oldProgram);
      oldProgram = program;
      const errors = [ROWS_FILE, KINDS_FILE, DISPATCH_FILE].flatMap((file) => {
        const source = program.getSourceFile(file);
        if (!source) throw new Error(`${file} is not in the program of the copy "${name}"`);
        return [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)].map((d) => {
          const before = source.text.slice(0, d.start ?? 0);
          const where = [...before.matchAll(/^export function (\w+)/gm)].at(-1)?.[1] ?? path.basename(file);
          const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
          const kind = KIND_NAMED.exec(message)?.[1];
          return `TS${String(d.code)} in ${where}: ${kind ?? message.split('\n')[0] ?? ''}`;
        });
      });
      return [name, errors.sort()];
    }),
  );
}

test(
  'processOrder compiles as it is, and each planted copy fails, naming the kind',
  timeLimitForTheWork({ typeScriptPrograms: Object.keys(PLANTS).length }),
  () => {
    expect(errorsIn(PLANTS)).toEqual({
      'as it is': [],
      "a new row, planted_order, among the hero orders' rows and nothing else written for it": [
        'TS1360 in processOrder: planted_order',
      ],
      "Pursue's row read as a kind no row is": [
        'TS2322 in the-kind-of-order-each-name-of-an-order-reads-as.ts: planted_order',
      ],
      "the Vanish order's case left out of the switch": ['TS1360 in processOrder: vanish'],
      "the Forced March's remapping to a Move left out": ['TS1360 in processOrder: forced_march'],
    });
  },
);
