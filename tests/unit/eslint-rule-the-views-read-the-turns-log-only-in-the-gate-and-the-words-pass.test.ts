// kc/the-views-read-the-turns-log-only-in-the-gate-and-the-words-pass (tools/eslint-rules/; B-18a): in the views, the
// turn's lines are read only by the gate that says which lines each realm reads (and how each reaches it) and by the
// words pass. Refused: a read of the turn's log (turnLog or gmLog, X.turnLog or X.gmLog, through `as`, `satisfies` and
// `!`): a member of it, a loop over it, a spread of it, a destructuring of its lines. Allowed: the log handed on whole
// (to the gate, the words pass, in an object, returned), taken out of an object, another list read, and a parameter
// of that name. Each refusal is red on its planted line. Where the rule runs (src/views/ but the gate and the words
// pass) is eslint.config.js's; tests/static/harness.test.ts checks it refuses a planted line there and nowhere else.
// Level 1 (unit): ESLint's RuleTester runs the rule's code on snippets, which a static test, running nothing, can't.
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, test } from 'vitest';
import rule from '../../tools/eslint-rules/the-views-read-the-turns-log-only-in-the-gate-and-the-words-pass.ts';

RuleTester.describe = describe;
RuleTester.it = test;

const tester = new RuleTester({ languageOptions: { ecmaVersion: 'latest', sourceType: 'module' } });
const read = [{ messageId: 'read' }];

tester.run('kc/the-views-read-the-turns-log-only-in-the-gate-and-the-words-pass', rule, {
  valid: [
    // the log handed on whole: to the gate, to the words pass, to playerEvents
    'const theLinesItReads = theLinesOfTheTurnTheRealmReads(turnLog, G, pi, sight);',
    'const inWords = theTurnsLinesInWords(whatTheReportsRead.turnLog);',
    'const itsLines = playerEvents(turnLog, G, pi, sight, theKindOfEachStoredLine);',
    // taken out of an object, put in one, returned
    'const { gmLog: turnLog, theKindOfEachStoredLine } = theTurnsLinesInWords(engineLog);',
    'const out = { reports, gmLog: turnLog };',
    'function f(turnLog) { return turnLog; }',
    // the lines the gate lets through, and another list, read
    'theLinesItReads.chronicle.filter(({ line }) => line.env);',
    'lastTurnLog.map((e) => e.text);',
    'const n = lines.length;',
    'for (const line of theLinesItReads.clairvoyance) use(line);',
  ],
  invalid: [
    // a member of it
    { code: 'turnLog.filter((e) => e.public);', errors: read },
    { code: 'gmLog.forEach((e) => use(e));', errors: read },
    { code: 'const first = turnLog[0];', errors: read },
    { code: 'const n = turnLog.length;', errors: read },
    { code: 'whatTheReportsRead.turnLog.map((e) => e.text);', errors: read },
    { code: "const n = built['gmLog'].length;", errors: read },
    // a loop over it
    { code: 'for (const e of turnLog) use(e);', errors: read },
    { code: 'for (const at in whatTheReportsRead.turnLog) use(at);', errors: read },
    // a spread of it
    { code: 'const copy = [...turnLog];', errors: read },
    { code: 'use(...gmLog);', errors: read },
    // a destructuring of its lines
    { code: 'const [first] = turnLog;', errors: read },
    { code: 'let first; [first] = gmLog;', errors: read },
  ],
});

tester.run('kc/the-views-read-the-turns-log-only-in-the-gate-and-the-words-pass, in TypeScript', rule, {
  valid: [
    {
      code: 'export function playerEvents(turnLog: readonly LogLine[], G: GameState) { return gate(turnLog, G); }',
      languageOptions: { parser: tseslint.parser },
    },
  ],
  invalid: [
    {
      code: '(turnLog as LogLine[]).filter((e) => e.public);',
      languageOptions: { parser: tseslint.parser },
      errors: read,
    },
    { code: 'const n = turnLog!.length;', languageOptions: { parser: tseslint.parser }, errors: read },
    {
      code: 'for (const e of (gmLog satisfies LogLine[])) use(e);',
      languageOptions: { parser: tseslint.parser },
      errors: read,
    },
  ],
});
