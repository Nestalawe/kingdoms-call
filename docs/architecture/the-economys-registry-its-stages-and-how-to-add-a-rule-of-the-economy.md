# The economy's registry: its stages, and how to add a rule of the economy

The rule registry is described in [the rule registry and the one source for shared rules](the-rule-registry-and-the-one-source-for-shared-rules.md).
This file is its part for the economy: the rules of a realm's gold (B-06, T7, the rules pulled out: its economy
family, from B-06c), and the bots' worth of gold (B-06h, [below](#the-bots-worth-of-gold-a-bot-versions-weights-by-kind-of-result)).

## What a rule of the economy is

A **rule of the economy** is a rule that adds to or takes from a realm's gold: a mark on a province's tax, a minor
title's gold, a mastery's stipend, a cut of a company's wage. It is one row in `src/content/the-economys-rules-their-keys-names-and-numbers.ts`
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
  turn's marks and this turn's war-spoils out, and reads the end-of-turn holders of the minor titles with no check of
  `TITLE_PERKS_ENABLED`.
- **A rule the player portal shares** (the Druid's half, the Host-Leader's cut: the order form's ledger and the army
  card read them) keeps its function in `src/engine/rules-on-plain-values/`, reading its row's numbers, and its
  effect asks it.

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
  Castellan's gold for every 5 provinces, rounded down (none below 5), each asked only of a hero who holds the title
  that gives it (which title: the minor titles' registry, B-06m). The runner gives each that pays, with its slug,
  in the stage's order: Early Winter asks it hero by hero and notes each on the tax line in that order
  (`THE_PERK_EACH_MINOR_TITLES_GOLD_IS_NOTED_BY`); the forecast asks it once for the realm's heroes, as one hero holds a
  title, and reads each title's gold by its slug.
- **A realm's gold beyond its tax from a hero's mastery**: the Thief network's 5, hero by hero.

Three stages of `turnEnd` for the wages, in the order Early Winter's wages reach them (B-06d,
`the-economy/a-companys-wage-and-a-realms-company-wages-at-the-turns-end.ts`). A company that draws no wage, and a
skeletal one's flat 1g (`theWageOfACompany`), are the caller's, before them. Each other company's wage runs, in order:
its type's price, **a company's wage this turn**, **a company's wage under its leader**, the upkeep discoveries (the
discoveries' registry). Once every company's wage is added: **a realm's company wages under its Host-Leader**, then
the heroes' wages.

- **A company's wage this turn** (Early Winter alone; the forecast leaves it out, as the stamped wages cover it): the
  Orcish war-spoils, half the wage of an Orcish company of an Orcish realm that won attacking this turn, rounded down.
  The half golds are carried in one carry a realm, handed to each company in turn (the heroes' companies in their
  order, then the garrisons in the provinces' order), and paid once a whole gold builds up (within 1e-9). A company
  whose half falls below 1g pays 1g, and neither banks a half gold nor spends one.
- **A company's wage under its leader**: the Druid's half, for a beast a Druid 6 leads or any under the Druidic Wonder
  (the caller asks which), rounded down, 1g at the least. The same row gives the half price a Druid 6 recruiter pays.
- **A realm's company wages under its Host-Leader**: 1g less for each company he leads that draws a wage, the wages
  never below nothing (the caller asks who holds the title).

Three stages of `turnEnd` for a realm that can't pay its wages, in the order Early Winter reaches them (B-06e,
`the-economy/a-realm-that-cannot-pay-its-wages-disbands-its-companies-and-its-heroes-desert.ts`). The dice are Early
Winter's, drawn as before and handed in: every company of the realm draws its die for the line, in the realm's order
(the heroes' companies, then the garrisons), before any is passed over; a hero draws his only while the shortfall lasts.

- **A company's rank in the line to disband unpaid**: the dead after the living, then the grades in content's order
  (`KC_QUALITY_TIERS`), a company of no known grade as Average. The line compares the ranks rank by rank, the stage's
  order deciding, then the dice (`theOrderOfTwoCompaniesInTheLineToDisbandUnpaid`). What never goes for want of pay
  (a summons, the Wild Hunt, the dead of a Deathless Legion) is the caller's, as before.
- **A company is spared disbanding unpaid**: a ship whose column is at open sea and still needs it to carry its troops
  (the caller asks that only of a ship). Early Winter asks it again for each ship it spared each time a company goes.
- **An unpaid hero deserts**: on a die above 0.4, each hero the best paid first (the caller's stable sort), while the
  shortfall lasts. A shortfall left after the last hero is forgiven.

A hero's wage in service is no stage: one formula, `theWageOfAHeroInService`
(`src/engine/rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts`), its numbers in content's
`KC_A_HEROS_WAGE_IN_SERVICE`. It is what his allegiance was bargained at (1g for a hero never hired), plus his skill
premium (`heroSkillWage`: a gold for every 4 skill points, rounded up, less 1), 1g at the least. `recalcHeroPay`, the
world's founding and wandering heroes and the release read it. The hire desk quotes the same premium (`heroHireWage`).

The orders' prices are no stage either: content's values, beside the price table in `kingdoms-call-data.ts` (B-06f).
A mercenary band's price is one rule, `thePriceOfAMercenaryBand` (its type's price, less the alignment's cut, plus
the discoveries', 1g at the least), which the Recruit Armies order and the report's price read. A Wild Hunt whose
beast the table doesn't price costs 6g (`wildHuntPrice`: the rite, the report and the bots), and a province of tax 7
or more is rich enough for a Grand Heist (`GRAND_HEIST_RICH_TAX`: the order and the bots). The bots still price their
recruits at the table's bare price.

Gold found is no stage either (B-06g). A lair's gold is content's band for its guardian's power (Weak 5-8, Moderate
12-18, Powerful 20-30, Legendary 40-60; 1-5 for a power the table doesn't list), rolled by one rule on plain values,
`theGoldALairsHoardHoldsOnADie`, with the die its caller draws where it drew it: `encounterClearGold` (a scout's figure
and a clear's, rolled once and kept) and `ensureLairHoard` (the hoard stocked as the world is made, or a lair first
read). A Sage 6's 5g for each new discovery is content's value, read at the Research order's three finds. A raid's
loot has no number of its own: a coastal raid takes the province's whole tax, and an Evil conquest's plunder is the
alignment abilities' and the discoveries' registries' shares. The spies' gold and the duel purse stay with espionage
and the duels.

## The bots' worth of gold: a bot version's weights, by kind of result

The rule says what, the bot says how much ([the decision](../decisions/README.md#the-decisions-on-how-the-work-runs)).
The bots' ledger (`botLedger`, `src/engine/bots/strategy.ts`) asks the rules what its gold comes to, and reads what it
makes of that gold from its version's weights file.

- **What the rules say:** the bots' upkeep (`botUpkeep`) asks `aCompanyDrawsNoWage` and `theWageOfACompany` (a
  skeletal company's 1g, else its type's price or 2g), as the ledger's own column wages do, and adds each hero's pay.
  It leaves out what Early Winter's wages add (the Druid's half, the war spoils, the upkeep discoveries, the
  Host-Leader's cut: KD-432), and the bots' tax income (`botTaxIncome`) is the provinces' bare tax (KD-433): no
  stage agrees with either, so each keeps its own code until its fix.
- **What the bot says:** `THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION`
  (`src/engine/bots/the-weights-of-the-bots-first-version-what-a-unit-of-each-kind-of-result-is-worth.ts`), keyed by
  the kind of result, never by the effect. Its `gold` holds the ledger's numbers, each named for what it weighs: the
  enemy host that puts a realm on a war footing, the share of the income its wages may take then and the chest it
  keeps then, the size of a small realm and the share of its free treasury its wages may lean on, and the defenders'
  full strength and the share of the wage ceiling held back for them. The kinds (`AKindOfResultABotWeighs`) and a kind's shape are
  in `src/engine/bots/intel.ts`; the file ends `satisfies Record<AKindOfResultABotWeighs, …>`, so a kind it gives no
  weights fails to compile. Content holds no bot number.
- **A later bot version** is a weights file of its own beside this one, of the same kinds and names, for the bots
  to read in its place (after T7, the old bot played against the new). A new kind joins the kinds, and every version's
  file gives it its weights: a title is the second kind
  ([the bots' worth of a title](the-minor-titles-registry-its-hook-points-and-how-to-add-a-perk.md#the-bots-worth-of-a-title)),
  an alignment ability the third
  ([the bots' worth of an alignment ability](the-alignment-abilities-registry-its-stages-and-how-to-add-an-ability.md#the-bots-worth-of-an-alignment-ability)),
  a race's gift the fourth
  ([the bots' worth of a race's gift](the-race-gifts-registry-its-stages-and-how-to-add-a-gift.md#the-bots-worth-of-a-races-gift)),
  a temper the fifth
  ([the bots' worth of a temper](adding-or-changing-content-units-orders-and-discoveries.md#the-bots-worth-of-a-temper)),
  a point of a host's strength the sixth
  ([the bots' estimate of a battle](where-a-change-goes-from-an-item-in-game-terms-to-the-files.md#a-battles-or-a-fights-rule)).

## The tests

- `tests/static/the-rule-registry-fails-to-compile-when-an-effect-and-its-content-row-part.test.ts`: a row with no
  entry, and an entry with no row, fail to compile.
- `tests/unit/the-rule-registry-holds-each-effect-once-in-the-order-of-its-stage.test.ts`: each effect once in its
  stage's order, every entry at a stage, no two rows' name.
- `tests/unit/the-economys-registry-a-provinces-tax-and-a-realms-gold-beyond-it.test.ts`,
  `tests/unit/the-economys-registry-a-companys-wage-and-a-realms-company-wages.test.ts` and
  `tests/unit/the-economys-registry-a-realm-that-cannot-pay-its-wages.test.ts`: each runner against the
  line it replaced, on every case; Early Winter's own cases (`tests/lib/early-winter-cases.ts`) and the report's
  (`tests/unit/realm-reports.test.ts`) hold the callers.
- `tests/unit/a-heros-wage-in-service-is-one-formula-the-turn-the-worlds-making-and-the-release-read.test.ts`: the
  formula against each copy it replaced.
- `tests/unit/the-bots-first-versions-weights-weigh-every-kind-of-result-and-hold-the-numbers-the-ledger-wrote.test.ts`:
  the weights file weighs every kind and no other (a kind with no weight fails to compile), and holds botLedger's
  numbers; `tests/unit/the-bots-plan-called-directly.test.ts` holds the ledger and the upkeep on what no game hands them.
- The ratchet's `economyNumbersInEngine` and `economyNumbersInTheBots`, which only fall, and the economy's static test
  of the functions its rows have taken
  (`tests/static/the-code-the-economys-rows-have-taken-holds-no-number-and-every-listed-function-is-there.test.ts`).

## How to add a rule of the economy

1. Its row in `src/content/the-economys-rules-their-keys-names-and-numbers.ts`: its slug, its name, its numbers.
2. Its effect in the stage's file under `src/engine/rules/the-economy/`, reading its numbers from its row and only the
   facts its stage hands it (a new stage: its signature in `TheStagesOfEachHookPoint`, its facts' type beside the
   others, and its runner in the registry's file).
3. Its entry in the registry, and its place in `THE_ORDER_OF_EACH_STAGE_OF_THE_ECONOMY`.
4. Its words where the books state it (the rulebook, the report's text): a change of a number is a rule change
   ([traps.md](../traps.md#a-rule-written-twice-must-change-twice)).
