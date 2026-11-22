# Architecture

How Kingdoms Call works now: one line a part, each linking to its topic file under
[architecture/](architecture/), which has the detail. Read this, then the topic file your work touches, then the
entries of [traps.md](traps.md) by title. Line numbers drift; search for the names given here.

## The shape in one paragraph

A static site with no server of its own. Every published page is an HTML file and its one script and one stylesheet
(`assets/<page>-<hash>.js`, `assets/<page>-<hash>.css`), built by Vite from the ES modules in `src/`. The pages talk
straight to a Supabase Postgres database from the browser, using supabase-js and the project's public (anon) key.
**The turn engine runs in the GM's browser tab**: the GM portal generates worlds, runs the bots, resolves turns and
writes each realm's report. Players only submit orders and read what they're given.

## The parts

- **Making a change** ([its topic file](architecture/making-a-change-the-six-kinds-and-the-plans-format.md)): the six kinds of work, what differs between them, and the one format every plan takes.
- **Where a change goes** ([its topic file](architecture/where-a-change-goes-from-an-item-in-game-terms-to-the-files.md)): from an item in game terms to its files, docs, rulings and tests, and the search that finds every copy of a rule.
- **The build** ([its topic file](architecture/the-build-from-src-to-site.md)): `npm run build` (Vite) builds `site/` from `src/`, the published and tested output, and the deploy keeps the files a cached page still names.
- **The rule registry and the shared rules** ([its topic file](architecture/the-rule-registry-and-the-one-source-for-shared-rules.md); an alignment's: [its guide](architecture/the-alignment-abilities-registry-its-stages-and-how-to-add-an-ability.md); the economy's: [its guide](architecture/the-economys-registry-its-stages-and-how-to-add-a-rule-of-the-economy.md); the minor titles': [its guide](architecture/the-minor-titles-registry-its-hook-points-and-how-to-add-a-perk.md)): a content effect is one row in `src/content/` and one entry in its family's registry, and `src/shared/` is the player portal's one door to the engine's rules.
- **A saved game** ([its topic file](architecture/a-saved-game-its-version-its-upgrade-its-check.md)): before every turn, `src/engine/saves/` upgrades the save step by step and checks it with the saved state's Zod schema.
- **The pages** ([its topic file](architecture/the-pages-how-a-portal-boots-and-how-a-page-builds-html.md)): each published file, the copy of supabase-js served with the site, the order a portal boots in, and `kcHtml`, the one way a page builds HTML.
- **The turn engine** ([its topic file](architecture/the-turn-engine.md)): `resolveTurn` (`src/engine/run-turn.ts`) works a turn out on plain data, and `runTurn` (`src/ui/gm/turn-shell.ts`) does the database and screen work around it.
- **The database** ([its topic file](architecture/the-database-and-what-it-holds.md)): Supabase Postgres, its structure in `supabase/schemas/`, enforcing inside it each rule that stops a player, since there is no server.
- **The toolchain and the checks** ([its topic file](architecture/the-toolchain-the-checks-and-the-harness.md)): Vitest, Playwright, TypeScript, ESLint and its own rules, dependency-cruiser, knip, Prettier, the hooks, the ratchet, CI and the mutant scorer.
- **The layers and the module map** ([its topic file](architecture/the-layers-of-src-and-the-module-map-generated-from-its-imports.md)): which folder of `src/` may import which, the known findings, unused code, and the map generated from the imports.
- **The tests' side** ([how the tests reach the site](architecture/how-the-tests-reach-the-site.md), [the balance matrix](architecture/the-balance-matrix.md)): how a test loads a page, the engine or the site's code, and the matrix that measures an engine change.

## The code's guardrails

These are CLAUDE.md's rules for the code (P1-09; the steps named bring the rest): (1) `src/engine/` and `src/views/` import no
Supabase client, `window` or UI code, so each function there runs on plain data (the imports: `npm run lint:arch`; the
page's names: lint); (2) no `Math.random` or `Date` there (lint: `Math.random` nowhere but `rng.ts`); (3) every line enters the GM's log through `emit`, with its
audience ([traps.md](traps.md#a-line-goes-through-emit)), and the engine emits events, never prose, which `src/views/` writes after perception (P1-12: `emit` throws on words, and lint refuses them); (4) a content effect lives in the rule registry, not in an `if` on its name inside a resolver (P1-19); (5) an
iteration order that can change a draw or the outcome is explicit; (6) all code and tests are TypeScript (P1-09e), with
no `any`, `@ts-ignore` or `eslint-disable` without a reviewed allowlist entry, and data crossing a boundary
(database, saved state, content) is parsed by its Zod schema (P1-10).
