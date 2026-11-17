// A kind of order with no case in processOrder's switch fails to compile, naming the kind (P1-10z).
// processOrder (src/engine/orders/order-dispatch-the-checks-before-a-hero-order-and-the-switch.ts) reads an order's
// action as an OrderKind (src/engine/rules-on-plain-values/the-kind-of-order-each-name-of-an-order-reads-as.ts), and
// its switch's default ends in `action satisfies never`. TypeScript compiles the dispatch file with copies of the two
// files, each with one fault planted, and must refuse each on the default's line, naming the kind:
// - a new kind, Planted Order, added to OrderKind and nothing else written for it;
// - the same kind with its name in PHASE_ACTION_MAP too;
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

/** `text` with `from` replaced by `to`, where `from` is found exactly once (else the plant would miss: it throws). */
function replacedOnce(text: string, from: string, to: string): string {
  const at = text.indexOf(from);
  if (at < 0 || text.includes(from, at + 1)) throw new Error(`the plant's anchor is not in its file once: ${from}`);
  return text.slice(0, at) + to + text.slice(at + from.length);
}

/** A planted copy: the text of each of the two files (the file as it is where the plant leaves it). */
interface APlantedCopy {
  readonly kinds: string;
  readonly dispatch: string;
}

const A_NEW_KIND = replacedOnce(KINDS, "  | 'grand_design';\n", "  | 'grand_design'\n  | 'planted_order';\n");
const PLANTS: Record<string, APlantedCopy> = {
  'as it is': { kinds: KINDS, dispatch: DISPATCH },
  'a new kind, planted_order, in OrderKind and nothing else written for it': { kinds: A_NEW_KIND, dispatch: DISPATCH },
  'the new kind with its name in PHASE_ACTION_MAP too': {
    kinds: replacedOnce(
      A_NEW_KIND,
      "  grand_design: 'grand_design',\n",
      "  grand_design: 'grand_design',\n  'planted order': 'planted_order',\n",
    ),
    dispatch: DISPATCH,
  },
  "the Vanish order's case left out of the switch": {
    kinds: KINDS,
    dispatch: replacedOnce(
      DISPATCH,
      "    case 'vanish':\n      resolveVanishOrder(turnContext, c, prov);\n      break;\n",
      '',
    ),
  },
  "the Forced March's remapping to a Move left out": {
    kinds: KINDS,
    dispatch: replacedOnce(DISPATCH, "    _fmSlip = true;\n    action = 'move';\n", '    _fmSlip = true;\n'),
  },
};

/** The kind a compiler message is about: the type a `satisfies never` found was not never. */
const KIND_NAMED = /^Type '"([^"]+)"' does not satisfy the expected type 'never'/;

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

/** The compiler's errors in the two files of each planted copy, as `TS<code> in <the function it stands in>: <the
 *  kind it names>` (or the message's first line, for an error of another kind). */
function errorsIn(copies: Record<string, APlantedCopy>): Record<string, string[]> {
  const options = theCompilersOptions();
  const theSyntaxTrees = new Map<string, ts.SourceFile>();
  let oldProgram: ts.Program | undefined;
  return Object.fromEntries(
    Object.entries(copies).map(([name, copy]) => {
      const planted = new Map([
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
      const errors = [KINDS_FILE, DISPATCH_FILE].flatMap((file) => {
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
  "processOrder compiles as it is, and each planted copy fails on its switch's default, naming the kind",
  timeLimitForTheWork({ typeScriptPrograms: Object.keys(PLANTS).length }),
  () => {
    expect(errorsIn(PLANTS)).toEqual({
      'as it is': [],
      'a new kind, planted_order, in OrderKind and nothing else written for it': [
        'TS1360 in processOrder: planted_order',
      ],
      'the new kind with its name in PHASE_ACTION_MAP too': ['TS1360 in processOrder: planted_order'],
      "the Vanish order's case left out of the switch": ['TS1360 in processOrder: vanish'],
      "the Forced March's remapping to a Move left out": ['TS1360 in processOrder: forced_march'],
    });
  },
);
