# Where a change goes: from an item in game terms to the files

Toby's items speak of the game: a spell, a title, a warning in the report. This file takes an item from those words to
the folders and files that hold it, the topic file and the traps with the detail, the rulings that bind it and the tests
that pin it. It names places and links to the rules; it restates none of them. Read [CLAUDE.md](../../CLAUDE.md) first.

## Find every place first: the search

An item's rule is often written in more than one place ([traps.md](../traps.md#a-rule-written-twice-must-change-twice)),
so find them all before you plan the change. Search; don't read the long files whole.

1. **The rulings.** Search the index for the item's nouns, `grep -i '<noun>' docs/rulings/README.md` (it is about 37 KB).
   A ruling's "Enforced by" column names the tests that hold it. Read the ruling's own file before you change its rule.
2. **The tests.** Search the list, `grep -i '<noun>' tests/every-test-its-level-and-what-it-checks.md` (about 97 KB).
   A test's header says which code it reaches; that is often the quickest way into `src/`.
3. **The code, by three keys:**
   - the content's **key**: its id or slug as `src/content/` spells it (a discovery's id, an ability's slug);
   - its **nouns** as players read them (the spell's name, the title's name, "spotted");
   - its **numbers**: the figure the item changes, and when a number moves, the old figure too (in `src/views/prose/`,
     the content rows' words and both rulebooks).
4. **The function and its callers.** Once you find the function that works the rule out, search its name: every caller
   is a place the change reaches (the order, the report's forecast, the player's form). Then search the rule's numbers
   and words again outside it, for copies written inline (a battle file, a duel, the report).
5. **The player portal's copies** that still restate an engine rule are the ones `tests/lib/player-portal-copies.ts`
   loads (its forecasts: their test imports them). A rule it shares is written once, in `src/engine/rules-on-plain-values/`.

The player portal's files are named after their first section, not everything they hold: find a field, a forecast or
a hint by its words or its function's name, not by the file's name.

## The areas of the game and their folders

| Area, in game terms | Where in `src/engine/` (and beside it) |
|---|---|
| Heroes: skills, experience, hit points, fame, death, chases | `heroes/` |
| Armies and units: marching, recruits, drill, the sea lift, Defend | `units/`, the tables in `army-tables.ts` |
| Battles | `battle/` |
| Personal combat: duels, encounters, lair guardians | `personal-combat/` |
| Spells: the cast chance, battle magic, Plague and the Bless ward | `chances-and-lair-grades.ts`, `magic/`, the Cast Spell order's `orders/spells/` |
| Magic items | `items/`, and their effects in `rules/magic-items/` |
| Discoveries | `discoveries.ts`, and their effects in `rules/discoveries/` |
| Imperial titles: who holds one, the reckoning (the merit toward one is added by the order or spell that earns it: search its counter) | `titles/` |
| Sight: who sees whom, spotting, what a province shows | `sight/`, and `src/views/what-each-realm-may-see-of-the-world.ts` |
| The warnings of a rival's hero in your land | `turn/intrusion-warnings.ts` |
| Spies: what a spy learns | `espionage/`, and the espionage orders in `orders/` |
| Relations between realms, captures | `realms/` |
| The turn's steps: the new turn, the phases, Early Winter, after the phases, diplomacy and victory | `turn/` |
| The world and the map | `world/` |
| Bots | `bots/` |
| Graves, the Grand Designs | `graves.ts`, `grand-design.ts` |

How a turn runs, and what `resolveTurn` calls in order: [the turn engine](the-turn-engine.md) and
[the turn's context](the-turns-context-and-calling-its-helpers-and-stages-from-a-test.md#what-resolveturn-calls-in-order).

## By kind of change

### A number of a unit, spell, item, perk or discovery

- **Where:** the tables of `src/content/kingdoms-call-data.ts`, the one source both portals read (each table's name
  says what it holds: `SPELL_DEFS_P`, `ALL_MAGIC_ITEMS_P`, `SAGE_DISCOVERIES_P`, `MONSTERS_P`, `TITLE_DEFS` and the
  `KC_` tables), or an effect's row in its family's file in `src/content/`, whose names end in `numbers-and-words.ts`.
  A unit's cost and speed are in `src/engine/army-tables.ts`.
- **The words:** a row's own text, and the tables of both rulebooks (below).
- **What a game already running holds:** whether a realm that holds the thing, or a save that copied it, gets the new
  number: [Live saves keep copies](../traps.md#live-saves-keep-copies).
- **The tests:** the static `tests/static/each-*` family checks that a row's numbers are in its words (and for most,
  in the rulebook's table), one test a family (`each-spells-numbers-are-in-its-blurb-and-the-rulebooks-table.test.ts`, and the
  discoveries', perks', unit abilities' and alignment orders').
- **The detail:** [adding or changing content](adding-or-changing-content-units-orders-and-discoveries.md); a new unit:
  [A new army unit is a dozen tables](../traps.md#a-new-army-unit-is-a-dozen-tables); keep a table's order:
  [Order is data](../traps.md#order-is-data).

### A new or changed content effect (an ability, an item's power, a spell's, a discovery's, a perk)

- **Where:** one row in `src/content/` and one entry in its registry, `src/engine/rules/the-registry-of-*.ts`, with the
  effect in `src/engine/rules/<family>/`. Never an `if` on the content's name inside a resolver
  ([the guardrails](../ARCHITECTURE.md#the-codes-guardrails)).
- **The detail:** [the rule registry](the-rule-registry-and-the-one-source-for-shared-rules.md#the-rule-registry); a
  spell's, a discovery's or a perk's own "how to add" section in
  [the spells' registry](the-spells-registry-its-stages-and-how-to-add-a-spells-effect.md#how-to-add-a-spells-effect),
  [the discoveries'](the-discoveries-registry-its-stages-and-how-to-add-a-discoverys-effect.md#how-to-add-a-discoverys-effect)
  and [the guardian perks'](the-guardian-perks-registry-its-stages-and-how-to-add-a-perk.md#how-to-add-a-perk).
- **The trap:** [An effect reads only what its hook hands it](../traps.md#an-effect-reads-only-what-its-hook-hands-it).

### A battle's or a fight's rule

- **Where:** `src/engine/battle/` (a battle between armies) or `src/engine/personal-combat/` (heroes and guardians
  fighting). The cast chance and the lairs' grades are in `src/engine/chances-and-lair-grades.ts`.
- **The tests:** a battle or a fight called on its own (`tests/lib/a-battle-called-directly.ts`,
  `tests/lib/personal-combat.ts`), or a staged turn. Fix the dice so the outcome is certain
  ([Dice come from `kcRng()`](../traps.md#dice-come-from-kcrng); [tests/README.md](../../tests/README.md#the-same-answer-every-time)).
- **The balance:** an engine change carries its balance report ([CLAUDE.md](../../CLAUDE.md#rules);
  [the balance matrix](the-balance-matrix.md)).

### An order

- **Where:** `src/engine/orders/`, one file a family of orders, each file's name listing its orders. The checks before
  a hero's order, and the switch that picks its resolver, are in
  `src/engine/orders/order-dispatch-the-checks-before-a-hero-order-and-the-switch.ts`. An alignment order is one row
  of `src/content/alignment-orders-their-keys-names-creeds-numbers-and-words.ts`, and a mastery order one row of
  `src/content/mastery-orders-their-keys-names-skills-and-levels.ts`.
- **What a realm sends:** its shape is `src/schemas/orders-a-realm-submits.ts`; the player's form is in `src/ui/player/`.
  The bots give orders too (`src/engine/bots/`), and the balance matrix's scripted realm copies what the form sends
  (`tools/balance/`, a dangerous path).
- **The tests:** each family's cases, `tests/lib/<family>-cases.ts`, run once called directly (`tests/unit/*-called-directly.test.ts`)
  and once in a whole turn (`tests/scenario/*-in-a-whole-turn.test.ts`).
- **The detail:** [An alignment order is written in a dozen places](../traps.md#an-alignment-order-is-written-in-a-dozen-places),
  [a mastery order](adding-or-changing-content-units-orders-and-discoveries.md#a-mastery-order-is-one-row-and-its-resolvers-level),
  and where the form's copies are ([A rule written twice](../traps.md#a-rule-written-twice-must-change-twice)).

### What a report says, and who reads it

A line of the report is three things in three places:
- **the fact:** the engine records what happened, as values, in the `the-facts-*-record.ts` file beside the code that
  makes it;
- **the audience:** who may read it, given when it enters the log through `emit`
  (`src/engine/turn/events-and-their-audiences.ts`);
- **the words:** written after the turn, in `src/views/prose/the-words-of-*.ts`, one file an area.

Each realm's report is put together in `src/views/every-realms-report-and-the-lines-each-realm-reads.ts`, from what
that realm may see (`src/views/what-each-realm-may-see-of-the-world.ts`); its sections and forecasts are
`src/views/turn-report.ts`; the player's screen shows it in `src/ui/player/report.ts`.
- **The detail:** [a line of the turn](a-line-of-the-turn-emit-its-facts-and-the-reports.md); the traps
  [A line goes through `emit`](../traps.md#a-line-goes-through-emit) and [Views never write](../traps.md#views-never-write).
- **The tests:** `tests/static/a-lines-facts-hold-values-not-words.test.ts`, and the runs that look for a line reaching
  a realm that may not read it (`tests/lib/report-leaks.ts`).

### The player portal's forms, forecasts and hints

- **Where:** `src/ui/player/`. A rule of the engine it uses comes through its one door,
  `src/shared/the-engines-rules-the-player-portal-shares.ts`, from `src/engine/rules-on-plain-values/`. The figures the
  GM works out for a realm (a cast chance a school, say) reach the portal in the report (`src/views/turn-report.ts`).
  The forecasts of where a hero will stand, what he will carry and lead, and what a garrison will hold, after the orders
  so far: `src/ui/player/the-order-forms-forecast-where-a-hero-stands-what-he-carries-and-leads.ts` (P1-11e3; since
  P1-11e10 with the column the Move note counts and its sea lift, which the march forecast reads). Since P1-11e41 they
  read only the report and the orders handed to them; the page hands them, in
  `src/ui/player/the-orders-the-form-holds-handed-to-its-forecasts.ts` (a snapshot of the form's fields a forecast).
  The treasury ledger, the notes that quote an order's chance (the Practice Skill note), the order list and the levels
  of magic a hero's practices may raise, with the tables they read, the same way since P1-11e42:
  `src/ui/player/the-order-forms-ledger-practice-note-order-list-and-magic-levels-on-the-orders-handed-them.ts`.
- **The detail:** [the one source for shared rules](the-rule-registry-and-the-one-source-for-shared-rules.md#kingdoms-call-datats-the-one-source-for-shared-rules);
  the copies left are `tests/lib/player-portal-copies.ts`'s.

### The rulebooks' words

- **Where:** the full rulebook, `src/kingdoms-call-rules.html`, and the short one, `src/kingdoms-call-rules-intro.html`.
  Words players read elsewhere: a content row's text in `src/content/`, the join screen's blurbs
  (`src/ui/player/join-and-chronicle.ts`), the spell hints below the order form
  (`src/ui/player/the-hints-the-order-form-shows-below-each-spell.ts`) and the report's prose.
- **The tests:** the static tests named for what the books say (`tests/static/the-books-say-*`,
  `tests/static/the-rulebook-says-*`, `tests/static/text-players-read-says-what-the-game-does-after-the-rulebook-review.test.ts`)
  and `tests/rulebook-review-words.test.js`. Search for the old words in them: a test may pin the words you change.
  Each test names the book it reads: where it reads only the full one, search the short one yourself.

### A page's screen

- **Where:** the page, `src/<page>.html`, and its code, `src/ui/<page>/` (its entry `page.ts`); the code all pages
  share is `src/ui/shared/`.
- **The detail:** [the pages](the-pages-how-a-portal-boots-and-how-a-page-builds-html.md); the traps
  [HTML is built only through `kcHtml`](../traps.md#html-is-built-only-through-kchtml) and
  [Nothing is on `window` but `globals.ts`](../traps.md#nothing-is-on-window-but-globalsts).
- **The tests:** page tests (`tests/page/`) and the browser specs (`tests/browser/`).

### The database

- **Where:** `supabase/schemas/`, then a generated migration. It is its own pull request, and the site's change another
  ([CLAUDE.md](../../CLAUDE.md#database-changes); [supabase/README.md](../../supabase/README.md#the-rules-every-database-change-follows)).
- **The detail:** [the database](the-database-and-what-it-holds.md); [A site change that needs a database change](../traps.md#a-site-change-that-needs-a-database-change).

### The save's shape

A change to what a saved game holds follows [CLAUDE.md's rule](../../CLAUDE.md#rules) and
[a saved game](a-saved-game-its-version-its-upgrade-its-check.md#a-change-to-the-saves-shape-needs-its-version). This
paragraph is completed when the work on the saves lands.

## The test for an item

The lowest level that can express it ([the levels](../../tests/README.md#the-levels)), first and failing
([Proving it fails first](../../tests/README.md#proving-it-fails-first)). Look first for a test that already pins the
rule (the search above): it shows the rule as it is today. A new file under `src/` is imported where it is used
([the build](the-build-from-src-to-site.md#edit-src-never-site)).
