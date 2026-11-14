# The alignment abilities' registry: its stages, and how to add an ability

The rule registry is described in [the rule registry and the one source for shared rules](the-rule-registry-and-the-one-source-for-shared-rules.md).
This file is its part for a realm's alignment's abilities (plan P1-19's alignment abilities family, from P1-19at1).
The family is modelled on [the discoveries'](the-discoveries-registry-its-stages-and-how-to-add-a-discoverys-effect.md):
its abilities belong to a realm and act all through the turn.

## What an alignment ability is

An **alignment ability** is a rule a realm holds because of its alignment: the Neutral trade, a creed's zeal, a creed's
order. It is one row in `src/content/alignment-abilities-their-keys-names-numbers-and-words.ts` and one entry in
`src/engine/rules/the-registry-of-alignment-abilities.ts`, keyed by the same slug (`'neutral-trade'`). Its effects are
in `src/engine/rules/alignment-abilities/`, a file per group of stages.

- **A row** gives the alignment that holds it, **how it is used**, and every number the books state for it. How it is
  used is a union: `'always on'` (it acts at its stages whenever they are reached), or an order (`"a king's order"` or
  `"a hero's order"`), whose row adds the key the turn dispatches it by, its name and the other names the turn reads.
  Each number is `{ value, writtenAs, inItsCreedsSection, … }`: how the books write it (as it is, as a word, as the turn
  it lasts until, as a percentage) and the words around it in each place that states it (the rulebook's creed section
  and its paragraph on gold, the intro's table, the report's summary, the join form). An effect reads its numbers from
  its row, and keeps the sum as the code wrote it: the trade's 20 divides the income by `100 / 20`, exactly 5, as
  `income / 5` did (`income * 0.2` would drift by a gold).
- **A row's key** is unique against the discoveries' names and their effects' slugs (ad04 is "Tithes", so no key may be
  `'tithes'`), and the five alignment orders' keys (`consecrate`, `call-to-arms`, `broker`, `harvest-the-field`,
  `perform-rite`) are left for their rows: today the orders are rows of
  `src/content/alignment-orders-their-keys-names-creeds-numbers-and-words.ts`, with no registry entry.
- **The registry** ends `satisfies Record<AlignmentAbilitySlug, AlignmentAbilityEntry>`, both ways, as the other
  registries do: a row with no entry, or an entry with no row, fails to compile. Its stages are the hook points' own
  (one union, `TheStagesOfEachHookPoint`, in `the-registry-of-content-effects.ts`); its orders are its own list,
  `THE_ORDER_OF_EACH_STAGE_OF_THE_ALIGNMENT_ABILITIES`. Within a stage the effects run in the order the list gives,
  and every multiply keeps today's order.
- **A runner is handed the alignment the rule reads**: the realm's today; the leader's or the fighter's own where the
  rule reads his (the Druid waiver, mercy), never another one. It asks, in the stage's order, the effects of the
  abilities that alignment holds, and adds, multiplies or picks them as the old code did. The resolvers keep their
  names and ask the runner.
- **No effect draws a die.** An effect that rolls returns its chance, and the resolver draws where it drew before.

## The stages written so far

**The turn's end** (P1-19at1, `alignment-abilities/a-realms-alignment-at-the-turns-end.ts`):

- `turnEnd`'s **a realm's alignment adds to its tax** (the Neutral trade; `neutralTradeGold`, which Early Winter's
  collection and the report's forecast ask, both with the provinces' income after their own tax, the discoveries'
  and the Wonder's). It is handed the income, and returns the gold. The runner adds them.

## Outside the family

- **The ladder of alignments** (hire wages by distance, the Divine-Undead hiring ban, mercy by the foe's alignment,
  heroes dealt within one step, the bots' diplomacy by distance) is a table beside the rows, not abilities.
- **Skeletal upkeep** and its disband order are a unit's rule: any realm with skeletons pays it (Necromancy, the Iron
  Throne), not Undead's alone.
- **The creed discoveries, the alignment-only items, guardians' Anathema and the Grand Designs** keep their own
  registries. A row names one by its key when it reads it.
- **The bots** read the rows' numbers; their own alignment checks wait for the bots' step.
- **The order form** keeps a hand-written widget for each alignment order: a new order's row does not appear on it by
  itself.

## The tests

- `tests/unit/the-rule-registry-holds-each-effect-once-in-the-order-of-its-stage.test.ts`: each effect once in its
  stage's order; each row's alignment one, and its key no discovery's name or slug and no order's; the runners' sums
  (the trade's, over 301 incomes, against `neutralTradeGold`).
- `tests/static/the-rule-registry-fails-to-compile-when-an-effect-and-its-content-row-part.test.ts`: a row with no
  entry, and an entry with no row, fail to compile.
- `tests/static/each-alignment-orders-name-creed-and-numbers-are-in-the-books-as-its-row-says.test.ts`: each number
  of each row in each place its row names.
- `tests/static/the-code-the-alignment-abilities-registry-has-taken-names-no-alignment.test.ts`, with the ratchet's
  `alignmentChecksInEngine` (162 before P1-19at1, 161 after it): the functions taken name no alignment, and the
  engine's names of an alignment outside `src/engine/rules/` only fall. The bots' and a race's `'Undead'` count too, so
  the count stays above 0.

## How to add an ability

1. **Its row**, in the content file: its slug, its alignment, how it is used, and each number with how and where the
   books write it. Write the books' words first (the words test reads them).
2. **Its effect** at a stage, in the stage's file under `src/engine/rules/alignment-abilities/`, reading its numbers
   from its row; **its entry** in the registry, and its slug in the stage's order.
3. **A new stage**: its signature goes into `TheStagesOfEachHookPoint` (under today's hook points: `turnStart`,
   `orderOutcome`, `fate`, `turnEnd`, …), its runner into the registry, and the resolver asks the runner. A stage no
   live rule uses isn't declared.
4. **Its test**: a unit case of the effect and the runner, and the function it takes listed in the static test above.
