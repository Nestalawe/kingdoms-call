// The project's own ESLint rules (plan P1-13, Decision 8): the incident rules, which replace the home-made static tests
// that checked them. eslint.config.js loads this plugin as `kc` (Node reads the TypeScript itself; this folder's
// package.json says its files are ES modules, so Node doesn't warn as it imports them). Each rule has its RuleTester
// test in tests/unit/eslint-rule-<name>.test.ts.
import type { ESLint } from 'eslint';
import bigTablesAndProfilesAreReadByNamedColumns from './big-tables-and-profiles-are-read-by-named-columns.ts';
import htmlIsBuiltOnlyThroughKcHtml from './html-is-built-only-through-kc-html.ts';
import narrativeLinesGoThroughEmit from './narrative-lines-go-through-emit.ts';
import noRandomOrArgumentLessSortComparator from './no-random-or-argument-less-sort-comparator.ts';

const plugin: ESLint.Plugin = {
  meta: { name: 'kc' },
  rules: {
    'big-tables-and-profiles-are-read-by-named-columns': bigTablesAndProfilesAreReadByNamedColumns,
    'html-is-built-only-through-kc-html': htmlIsBuiltOnlyThroughKcHtml,
    'narrative-lines-go-through-emit': narrativeLinesGoThroughEmit,
    'no-random-or-argument-less-sort-comparator': noRandomOrArgumentLessSortComparator,
  },
};

export default plugin;
