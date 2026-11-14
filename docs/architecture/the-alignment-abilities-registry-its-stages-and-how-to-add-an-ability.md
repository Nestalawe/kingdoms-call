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
  rule reads his (the Druid waiver, mercy), never another one. A rule gated by something else today is handed that
  instead, and no alignment: the consecrated ground's tax is gated by the realm's consecration list. It asks, in the stage's order, the effects of the
  abilities that alignment holds, and adds, multiplies or picks them as the old code did. The resolvers keep their
  names and ask the runner.
- **No effect draws a die.** An effect that rolls returns its chance, and the resolver draws where it drew before.

## The stages written so far

**The turn's end** (P1-19at1, `alignment-abilities/a-realms-alignment-at-the-turns-end.ts`):

- `turnEnd`'s **a realm's alignment adds to its tax** (the Neutral trade; `neutralTradeGold`, which Early Winter's
  collection and the report's forecast ask, both with the provinces' income after their own tax, the discoveries'
  and the Wonder's). It is handed the income, and returns the gold. The runner adds them.
- `turnEnd`'s **a realm's consecrated ground raises a province's tax** (P1-19at2; Divine's +50%, a row with no name:
  the books never name it, and its key must not read as discovery ad04's "Tithes"). Early Winter's collection and the
  report's forecast ask it for a province the realm's consecration list holds (`isConsecrated`, as before), after Bless,
  an earthquake and Sabotage, and before Enslave and the discoveries. It is handed the tax so far and returns the new
  tax, `Math.round(t * (1 + 50 / 100))`, exactly today's `Math.round(t * 1.5)`; the caller notes the uplift.

**A side's zeal and fervour in a battle** (P1-19au1, `alignment-abilities/a-sides-zeal-and-fervour-in-a-battle.ts`),
asked by both battles (`combatVsChar`, `combatVsNPC`) where they read the old table and constants:

| Stage (`strength`) | Its abilities | What it is handed, and gives |
|---|---|---|
| **a realm's alignment gives a side its chance of zeal** | the seven creeds' zeal rows (Divine 50% to Undead 0%) | nothing; the creed's chance. The runner reads the side's realm's alignment (Neutral for none) and gives 0.1 for one no row holds, as the old `?? 0.1` did. The discoveries' share is added after it |
| **consecrated ground stirs a defender's zeal** | the doubling (Divine; no name in the books) | the chance so far, after the discoveries' share; `Math.min(1, chance × 2)`. Only `combatVsChar`, for a defender on a province his realm owns and its consecration list holds: handed no alignment |
| **a realm's alignment stirs a side's fervour** | skeletal fervour (Undead: ×1.5 under the king, ×1.3 under another), savage fury (Evil: ×1.25 with a Monster) | whether zeal seized the side, its king, its force; the strongest of 1, zeal's ×1.3 (the Divine row's: the books state it there) and each fervour that stirs, as the old `Math.max`, and the abilities that stirred (the lines name them) |

The battles still draw the rolls themselves, where they did: between heroes the attacker's, then the defender's, both
always (even at 0, and when a fervour wins); against a province's defenders the attacker's alone.

**The other battle factors, and the Banner** (P1-19au2, `alignment-abilities/the-other-battle-factors-of-a-realms-alignment.ts`):

| Stage | Its ability | Where it is asked, and what it gives |
|---|---|---|
| `strength`: **consecrated ground weakens an attacker's host** | Divine's −15% (no name in the books; the creeds it strikes are its row's list) | both battles, for a province its owner consecrated, handed the attacker's alignment as a fact; the factor in its place among the whole force's factors, `(100 − 15) / 100`, exactly 0.85 |
| `strength`: **a realm's alignment strengthens its defence of its own ground** | Good's Righteous Defence | both battles, after the siegecraft and before the own-ground discoveries; `defBonus *=` its `1 + 10 / 100`, exactly 1.1 |
| `strength`: **a realm's alignment strengthens a unit in the wild** | Druidic's Home of the Wild | `armStr`, after the unit's abilities, the realm's or the commander's creed; one rounded step (×1.5) |
| `strength`: **a realm's alignment strengthens a unit by its reign of fear** | Evil's Reign of Fear | `armStr`, after Terror, for an attacker on ground its Terror grips: its own rounded step; both battles' lines ask it of each unit |
| `fate`: **a realm's alignment holds a beaten host on the field** | Undead's Deathless March | the three routs (each its own companies), first in each chain |
| `movementCost`: **a realm's alignment helps converging columns unite** | Good's Banner of Fellowship | `resolveMoveOrder`, both rolls; its 15 points |

**Prices and the scholars** (P1-19av1, `alignment-abilities/the-prices-and-the-scholars-of-a-realms-alignment.ts`):

| Stage (`orderOutcome`) | Its ability | Where it is asked, and what it gives |
|---|---|---|
| **a realm's alignment cuts a mercenary band's price** | Neutral's 2g off | the Recruit Armies hire and the report's price, before the discoveries' and under the 1g floor; the gold, added |
| **a realm's alignment raises a Bless's yield** | Divine's blessing | `workBlessProvince`; the whole yield, `1 + 100 / 100` by the king, `1 + 80 / 100` by another (exactly 2 and 1.8), or null for the spell's own 1.6; the discoveries are added after it. The line's "by a Divine realm" is "not null" |
| **a realm's alignment adds to research** | Neutral's scholars | the Research order and the report's odds, after the Sage level's own points; the level × 5 |

**The Druid waiver** (Druidic Creatures, Evil Monsters: two rows, no number) is read by `druidNeedWaivedByAlignment`
in `src/engine/rules-on-plain-values/`, which the player portal shares and which may import only `src/content`: it
reads the rows' alignments, the realm's or the leader's own (Decision G), and their entries have no stage (the
registry's unit test lists them).

## Outside the family

- **The ladder of alignments** (hire wages by distance, the Divine-Undead hiring ban, mercy by the foe's alignment,
  heroes dealt within one step, the bots' diplomacy by distance) is a table beside the rows, not abilities:
  `THE_LADDER_OF_THE_ALIGNMENTS` in the content file (P1-19av2), with no registry entry. Its rungs' order is data (the
  heroes' deal draws by it). `alignments-and-a-wandering-heros-hire-wage.ts` reads it (`heroHireWage`, mercy's
  chance and laughter: the foe's own alignment), and the player portal shares that file.
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
  (the trade's, over 301 incomes, against `neutralTradeGold`; the consecrated tax's, over 301 taxes; zeal's chance by
  creed, the doubling, the fervours against the old `Math.max`, the other battle factors' and the Banner's, the
  prices', the scholars' and the Druid waiver's by creed).
- `tests/unit/the-sides-of-a-battle-between-heroes-in-the-lines-no-matrix-game-reaches.test.ts`: the doubling, with
  staged dice, after the discoveries' share; `…the-sides-and-the-defenders-of-a-battle-against-a-province-…`: the
  other battle factors at both battles.
- `tests/static/the-rule-registry-fails-to-compile-when-an-effect-and-its-content-row-part.test.ts`: a row with no
  entry, and an entry with no row, fail to compile.
- `tests/static/each-alignment-orders-name-creed-and-numbers-are-in-the-books-as-its-row-says.test.ts`: each number
  of each row in each place its row names; the ladder's rungs in the books' order, and its numbers in the rulebook.
- `tests/unit/the-combat-item-and-guardian-lines-no-matrix-game-reaches-keep-their-values.test.ts`: a plea's odds by
  the foe's alignment (75/50/20), and the Evil and Undead's laughter.
- `tests/static/the-code-the-alignment-abilities-registry-has-taken-names-no-alignment.test.ts`, with the ratchet's
  `alignmentChecksInEngine` (162 before P1-19at1, 161 after it and P1-19at2, 151 after P1-19au1, 133 after P1-19au2, 126 after P1-19av1, 119 after P1-19av2): the functions taken name no alignment, and the
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
