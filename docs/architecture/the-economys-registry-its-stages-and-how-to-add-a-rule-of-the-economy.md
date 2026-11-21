# The economy's registry: its stages, and how to add a rule of the economy

The rule registry is described in [the rule registry and the one source for shared rules](the-rule-registry-and-the-one-source-for-shared-rules.md).
This file is its part for the economy: the rules of a realm's gold (B-06, T7, the rules pulled out: its economy
family, from B-06c). The family's other rows (the wages, not paying, the orders' prices, gold found and taken) are in
[the backlog](../backlog/README.md).

## What a rule of the economy is

A **rule of the economy** is a rule that adds to or takes from a realm's gold: a mark on a province's tax, a minor
title's gold, a mastery's stipend. It is one row in `src/content/the-economys-rules-their-keys-names-and-numbers.ts`
and one entry in `src/engine/rules/the-registry-of-the-economys-rules.ts`, keyed by the same slug
(`'the-cutpurses-gold'`). Its effects are in `src/engine/rules/the-economy/`, a file per group of stages.

- **A row** gives its name as the books write it and the numbers the turn reads for it, by what each is
  (`theNumbers: { theGold: 2 }`). It holds only what the turn reads: **who holds** a title, a mastery or a Wonder is the
  caller's to ask, as before (`charMinor`, `perkTier`, `gdActive`, and the report's own holders), and the stage hands
  the answer to the effect. A check asked only when an effect needs it is handed as a function
  (`theFreeCityCharterStands`, `theProvincesHisRealmHolds`), so it is asked when it was before.
- **The registry** ends `satisfies Record<TheEconomysRuleSlug, EconomysRuleEntry>`, both ways, as the other
  registries do: a row with no entry, or an entry with no row, fails to compile. Its stages are the hook points' own
  (one union, `TheStagesOfEachHookPoint`, in `the-registry-of-content-effects.ts`); its orders are its own list,
  `THE_ORDER_OF_EACH_STAGE_OF_THE_ECONOMY`. Within a stage the effects run in the order the list gives.
- **A rule two copies write the same** (Early Winter's collection and the report's forecast) is asked of the one
  runner by both. Where the copies differ, each keeps its own code (no switch, no parameter): the forecast leaves this
  turn's marks out, and reads the end-of-turn holders of the minor titles with no check of `TITLE_PERKS_ENABLED`.

## The stages written so far

Five stages of `turnEnd`, in the order Early Winter's collection reaches them (B-06c,
`the-economy/a-provinces-tax-and-a-realms-gold-beyond-it-at-the-turns-end.ts`). A province's tax runs, in order:
its own tax, **a province's tax this turn**, its consecrated ground (the alignment abilities' registry), **a
province's tax while a mark lasts**, an earthquake's lasting damage, its discoveries (the discoveries' registry), and
**a province's tax from the realm's Wonder**. The stages are split where another registry's step comes between them,
so every step keeps its place.

- **A province's tax this turn** (Early Winter alone: the forecast can't know this turn's orders): an Earthquake or a
  Sabotage of this turn leaves nothing; a Bless of this turn multiplies by the blessing's own measure (`_blessedMult`,
  set by the cast), or the row's 1.6 where it recorded none, and rounds, as `Math.round(t * …)` did. Each effect is
  handed the tax the one before gave.
- **A province's tax while a mark lasts**: Enslave, a gold less while the province still resents it, never below
  nothing (the caller asks `theEnslavedProvinceStillPaysLess`).
- **A province's tax from the realm's Wonder**: the Free City Charter, 2 more on a province that keeps a garrison while
  Good's Wonder stands (the caller's `gdActive`, or the view's `wonderBlesses`, asked first).
- **A realm's gold beyond its tax from a hero's minor title**: the Cutpurse's 2, the Champion of the People's 2, the
  Castellan's gold for every 5 provinces, rounded down (none below 5). The runner gives each that pays, with its slug,
  in the stage's order: Early Winter asks it hero by hero and notes each on the tax line in that order
  (`THE_PERK_EACH_MINOR_TITLES_GOLD_IS_NOTED_BY`); the forecast asks it once for the realm's heroes, as one hero holds a
  title, and reads each title's gold by its slug.
- **A realm's gold beyond its tax from a hero's mastery**: the Thief network's 5, hero by hero.

## The tests

- `tests/static/the-rule-registry-fails-to-compile-when-an-effect-and-its-content-row-part.test.ts`: a row with no
  entry, and an entry with no row, fail to compile.
- `tests/unit/the-rule-registry-holds-each-effect-once-in-the-order-of-its-stage.test.ts`: each effect once in its
  stage's order, every entry at a stage, no two rows' name.
- `tests/unit/the-economys-registry-a-provinces-tax-and-a-realms-gold-beyond-it.test.ts`: each runner against the
  line it replaced, on every case; Early Winter's own cases (`tests/lib/early-winter-cases.ts`) and the report's
  (`tests/unit/realm-reports.test.ts`) hold the callers.
- The ratchet's `economyNumbersInEngine`, which only falls, and the economy's static test of the functions its rows
  have taken
  (`tests/static/the-code-the-economys-rows-have-taken-holds-no-number-and-every-listed-function-is-there.test.ts`).

## How to add a rule of the economy

1. Its row in `src/content/the-economys-rules-their-keys-names-and-numbers.ts`: its slug, its name, its numbers.
2. Its effect in the stage's file under `src/engine/rules/the-economy/`, reading its numbers from its row and only the
   facts its stage hands it (a new stage: its signature in `TheStagesOfEachHookPoint`, its facts' type beside the
   others, and its runner in the registry's file).
3. Its entry in the registry, and its place in `THE_ORDER_OF_EACH_STAGE_OF_THE_ECONOMY`.
4. Its words where the books state it (the rulebook, the report's text): a change of a number is a rule change
   ([traps.md](../traps.md#a-rule-written-twice-must-change-twice)).
