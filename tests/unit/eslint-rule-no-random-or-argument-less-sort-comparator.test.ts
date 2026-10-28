// kc/no-random-or-argument-less-sort-comparator (tools/eslint-rules/; plan P1-13, Decision 8), the rule that replaced
// tests/sort-comparators.test.js: a sort whose comparator draws a random number or takes no arguments is refused,
// since its order (and how many dice it uses) depends on the JavaScript engine's sort, so a newer engine makes a
// different world from the same seed. Each case of the old test is here: a random comparator, a random tie-break, one
// with no arguments; comments, strings and a sort with no comparator pass. Where the rule runs (src/, public/, the
// templates' scripts) is tests/static/harness.test.ts's and the templates' test's.
// Level 1 (unit): ESLint's RuleTester runs the rule's code on snippets, which a static test, running nothing, can't.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// `kc/no-random-or-argument-less-sort-comparator` (`tools/eslint-rules/`, P1-13c), the rule that replaced
// `sort-comparators`, run by ESLint's RuleTester: a `.sort(…)` or `.toSorted(…)` whose comparator takes no arguments,
// or whose arguments call `Math.random`, `Math['random']`, `kcRng`, `rnd`, `rng` or `random` (as a name or a method; a
// random tie-break too) is refused; a sort with no comparator or a real one, a shuffle before the sort, a function
// merely named `sort`, comments and strings pass; JavaScript and TypeScript. Red with the argument-less check taken
// out. Level 1: the rule's code runs on snippets, which a static test, running nothing, can't. TypeScript, in `unit/`
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, test } from 'vitest';
import rule from '../../tools/eslint-rules/no-random-or-argument-less-sort-comparator.ts';

RuleTester.describe = describe;
RuleTester.it = test;

const tester = new RuleTester({ languageOptions: { ecmaVersion: 'latest', sourceType: 'module' } });
const random = [{ messageId: 'random' }];
const argumentless = [{ messageId: 'argumentless' }];

tester.run('kc/no-random-or-argument-less-sort-comparator', rule, {
  valid: [
    'list.sort();',
    'list.sort((a, b) => a - b);',
    'list.sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);',
    'list.sort(byName);',
    'list.toSorted(function (a, b) { return a.n - b.n; });',
    // the dice drawn outside the comparator: a shuffle, then a sort by a real key
    'shuffleP(list, rnd).sort((a, b) => a.n - b.n);',
    'const r = rnd(); list.sort((a, b) => a.n - b.n);',
    // a function that happens to be called sort, not an array's
    'sort(() => Math.random());',
    // comments and strings
    '// list.sort(() => Math.random() - 0.5)\nconst s = ".sort(() => Math.random() - 0.5)";',
    {
      code: 'list.sort((a: { n: number }, b: { n: number }) => a.n - b.n);',
      languageOptions: { parser: tseslint.parser },
    },
  ],
  invalid: [
    { code: 'list.sort(() => Math.random() - 0.5);', errors: argumentless },
    { code: 'list.sort((a, b) => Math.random() - 0.5);', errors: random },
    { code: 'list.sort((a, b) => a.n - b.n || Math.random() - 0.5);', errors: random },
    { code: "list.sort((a, b) => Math['random']() - 0.5);", errors: random },
    { code: 'list.sort((a, b) => rnd() - 0.5);', errors: random },
    { code: 'list.sort((a, b) => a.n - b.n || this.rng() - 0.5);', errors: random },
    { code: 'list.sort((a, b) => kcRng() - 0.5);', errors: random },
    { code: 'list.sort(function (a, b) { return random() < 0.5 ? -1 : 1; });', errors: random },
    { code: 'list.sort(tieBreak(rnd()));', errors: random },
    { code: 'list.sort(function () { return 0; });', errors: argumentless },
    { code: 'list.toSorted(() => 1);', errors: argumentless },
    { code: 'rows.map((r) => r).sort((a, b) => a.k - b.k || rng() - 0.5);', errors: random },
    {
      code: 'list.sort((a: number, b: number): number => a - b || Math.random() - 0.5);',
      languageOptions: { parser: tseslint.parser },
      errors: random,
    },
  ],
});
