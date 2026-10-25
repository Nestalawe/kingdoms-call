// The layers of src/ and no import cycle (plan P1-13, Decisions 2 and 3; npm run lint:arch). Every rule is an error.
// What broke a rule when it came in (P1-13a) is listed in .dependency-cruiser-known-violations.json and let through
// (--ignore-known); the ratchet counts that list (knownArchitectureViolations), so it only shrinks. A finding fixed
// leaves the list in the same PR: npx depcruise src --baseline --baseline-mode shrink-only removes it, adding nothing.
//
// A layer's own folder, and the folders it may import from, are in each rule's pathNot. `import type` and
// `export type … from` bring no code (TypeScript erases them), so src/schemas/, which holds only types, may be
// imported that way from anywhere, and only that way. A cycle counts only through imports that bring code.

import type { IConfiguration } from 'dependency-cruiser';

/** The folders a layer may import from, as a pattern for a rule's `to.pathNot`. Schemas are types: any layer may
 *  import them as types (the rule `schemas-are-imported-as-types-only` refuses the other ways). */
const mayImport = (...folders: string[]): string => `^src/(${[...folders, 'schemas'].join('|')})/`;

const config: IConfiguration = {
  forbidden: [
    {
      name: 'no-cycle-through-imports-that-bring-code',
      comment:
        'Two files that import each other (through any chain) run in an order neither can rely on: a constant read as a file loads can be unset (docs/traps.md). A cycle through type-only imports brings no code and is let through.',
      severity: 'error',
      from: { path: '^src/' },
      to: { circular: true, viaOnly: { dependencyTypesNot: ['type-only'] } },
    },
    {
      name: 'the-content-imports-nothing',
      comment: 'The data file is the one source of shared rules: it reads nothing from the code that reads it.',
      severity: 'error',
      from: { path: '^src/content/' },
      to: { path: '^src/', pathNot: mayImport('content') },
    },
    {
      name: 'the-engine-imports-only-the-engine-and-the-content',
      comment: 'The engine runs on plain data: no view, page, database or shared code.',
      severity: 'error',
      from: { path: '^src/engine/', pathNot: '^src/engine/rules-on-plain-values/' },
      to: { path: '^src/', pathNot: mayImport('engine', 'content') },
    },
    {
      name: 'the-rules-on-plain-values-import-only-each-other-and-the-content',
      comment:
        'The rules the player portal shares (plan P1-11a) need no world: they read only the content and each other.',
      severity: 'error',
      from: { path: '^src/engine/rules-on-plain-values/' },
      to: { path: '^src/', pathNot: mayImport('engine/rules-on-plain-values', 'content') },
    },
    {
      name: 'the-rule-registry-imports-only-itself-the-rules-on-plain-values-and-the-content',
      comment:
        "An effect reads only what its hook hands it (plan P1-19, Decision 6): src/engine/rules/ reaches the dice, the turn's state or a report only through its stage, never by an import.",
      severity: 'error',
      from: { path: '^src/engine/rules/' },
      to: { path: '^src/', pathNot: mayImport('engine/rules', 'engine/rules-on-plain-values', 'content') },
    },
    {
      name: 'the-views-import-only-the-views-the-engine-and-the-content',
      comment: 'What a realm sees is written from the engine and the content, never from a page or the database.',
      severity: 'error',
      from: { path: '^src/views/' },
      to: { path: '^src/', pathNot: mayImport('views', 'engine', 'content') },
    },
    {
      name: 'shared-imports-only-the-views-the-rules-on-plain-values-and-the-content',
      comment:
        "src/shared/ is the player portal's one door to the engine (plan P1-11, Decision 2): the rules on plain values only.",
      severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: '^src/', pathNot: mayImport('shared', 'views', 'engine/rules-on-plain-values', 'content') },
    },
    {
      name: 'schemas-are-imported-as-types-only',
      comment:
        'src/schemas/ holds the types of the saved world (plan P1-10a1): no page bundles it, so no file imports code from it.',
      severity: 'error',
      from: { path: '^src/', pathNot: '^src/schemas/' },
      to: { path: '^src/schemas/', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'the-database-code-imports-only-itself-and-the-schemas',
      comment:
        'src/db/ talks to the database for the pages (the access layer from plan P1-17): it imports no page, engine or view.',
      severity: 'error',
      from: { path: '^src/db/' },
      to: { path: '^src/', pathNot: mayImport('db') },
    },
    {
      name: 'only-the-pages-import-the-database-code',
      comment: 'The engine, the views, the content and the shared rules never talk to the database.',
      severity: 'error',
      from: { path: '^src/', pathNot: '^src/(ui|db)/' },
      to: { path: '^src/db/' },
    },
    {
      name: 'a-page-imports-no-other-pages-code-but-ui-shared',
      comment: "Each page is built on its own: another page's code would come into its bundle.",
      severity: 'error',
      from: { path: '^src/ui/([^/]+)/' },
      to: { path: '^src/ui/', pathNot: ['^src/ui/$1/', '^src/ui/shared/'] },
    },
    {
      name: 'ui-shared-imports-only-itself',
      comment: "The pages' shared helpers (kcHtml, kcEsc) stand alone.",
      severity: 'error',
      from: { path: '^src/ui/shared/' },
      to: { path: '^src/', pathNot: mayImport('ui/shared') },
    },
    {
      name: 'only-the-gm-page-imports-the-engine',
      comment:
        'The GM page runs the turn and edits the world, so it imports the engine (plan P1-13, Decision 3). Every other page reaches the engine only through src/shared/ and src/views/.',
      severity: 'error',
      from: { path: '^src/(ui|rulebook)/', pathNot: '^src/ui/(gm|shared)/' },
      to: { path: '^src/engine/' },
    },
    {
      name: 'only-src-db-imports-supabase-js',
      comment:
        'The database client is reached through src/db/ only (none imports it until plan P1-17; the pages read the copy served with the site).',
      severity: 'error',
      from: { pathNot: '^src/db/' },
      to: { path: '@supabase/supabase-js' },
    },
    {
      name: 'every-import-resolves',
      comment: 'An import of a file that does not exist stops the build; here it is named before.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    doNotFollow: { path: 'node_modules' },
    enhancedResolveOptions: { extensions: ['.ts', '.js'] },
    // The module map in docs/ARCHITECTURE.md (tools/module-map.ts) is the Mermaid reporter's, one box a folder.
    reporterOptions: { mermaid: { minify: false } },
  },
};

export default config;
