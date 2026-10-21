// knip (plan P1-13, Decisions 2 and 4; npm run knip): files nothing imports, exports nothing reads, and dependencies
// nothing uses. The site's entries are the pages' own (each template's <script type="module" src>, read by
// tools/pages.ts, so there is no second list); the tests', the tools' and the balance scenarios' (tests/balance/
// scenarios/*.ts, loaded by name) are below. An export read only in its own file counts as used: P1-09d's codemod
// exported every top-level name. What knip finds is counted by the ratchet (unusedCode), so it only falls; plan P1-13's
// Decision 13 brings it to zero (P1-23), and then knip exits 0.
import type { KnipConfig } from 'knip';
import { pageEntries, pageNames } from './tools/pages.ts';

const pages = pageNames().flatMap((page) => pageEntries(page).modules.map((m) => 'src/' + m));

const config = {
  entry: [
    ...pages,
    'tools/*.ts',
    'tools/balance/*.ts',
    'tools/github/*.ts',
    'tools/deploy/*.ts',
    'tools/hooks/*.ts',
    'tests/*.test.js',
    'tests/tools/*.js',
    'tests/lib/*.{js,ts}',
    'tests/balance/scenarios/*.ts',
  ],
  project: ['src/**/*.ts', 'tools/**/*.ts', 'tests/**/*.{js,ts,mts}', '!tools/legacy/**', '!tests/quarantine/**'],
  ignore: ['tests/quarantine/**'],
  ignoreExportsUsedInFile: true,
} satisfies KnipConfig;

export default config;
