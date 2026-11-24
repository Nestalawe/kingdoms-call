# The race gifts' registry: its stages, and how to add a gift

The rule registry is described in [the rule registry and the one source for shared rules](the-rule-registry-and-the-one-source-for-shared-rules.md).
This file is its part for the race gifts (B-06, T7, the races' family: B-06ae and B-06af; the bots' reads, B-06ah). The family is modelled on
[the alignment abilities'](the-alignment-abilities-registry-its-stages-and-how-to-add-an-ability.md): a gift belongs to
a realm of its race, as an ability belongs to a realm of its alignment.

## What a race gift is

A **race gift** is a rule a realm's own people bring it: the elves' Woodland Mastery, the dwarves' Bulwark. It is one
row in `src/content/the-race-gifts-their-keys-races-and-numbers.ts` and one entry in
`src/engine/rules/the-registry-of-the-race-gifts.ts`, keyed by the same slug (`'woodland-mastery'`). Its effects are in
`src/engine/rules/race-gifts/`, a file per group of stages.

- **A row** gives the gift's name as the books write it, its race (one of `KC_HUMANOID_RACES`), and what the turn reads
  for it: the factor a company of its race fights at (`theStrength`), the ground (`theGround`) or the side
  (`theSide`) it fights on to be given it; the factor a hero learns at (`theLearning`) or a company drills at
  (`theDrill`); a hero's hit points at the start and the shift of his hardening's bands; a fallen company's chance to
  flee home by the ground (`theFlightHome`).
- **The registry** ends `satisfies Record<RaceGiftSlug, RaceGiftEntry>`, both ways: a row with no entry, or an entry with
  no row, fails to compile. Its stages are the hook points' own (`TheStagesOfEachHookPoint`); its orders are
  `THE_ORDER_OF_EACH_STAGE_OF_THE_RACE_GIFTS`.
- **A runner is handed the race of the realm the rule reads** (the company's realm, the winner's, the hero's) and asks,
  in the stage's order, the effects of the gifts that race holds. Each effect checks the rest: its company's, its
  hero's or its province's race, its ground, its side. No effect draws a die, and none changes what it is handed.

## The stages written so far

**The battles** (B-06ae, `race-gifts/the-race-gifts-in-a-battle.ts`):

| Stage | Its gifts | Where it is asked, and what it gives |
|---|---|---|
| `strength`: **a race's gift strengthens a company of its realm** | Woodland Mastery (an Elven company in forest or jungle), the Bulwark (a Dwarven company defending) | `armStr`, after the ground and before the Standing Stones: a step for each gift, in the stage's order, each its own `Math.round(str × 1.5)` and its own reason on the ladder |
| `fate`: **a race's gift flags a province its realm wins a battle in** | Raiders' Muster (an Orcish province) | both battles, on the win: against a province's defenders the attacker's realm, between heroes the winner's. The turn's end musters the Goblin Horde (the Orc Garrison's unit ability) |
| `fate`: **a race's gift gives a company the spoils of a battle won attacking** | the War-spoils (an Orcish company) | `markOrcAttackWin`, which stamps the company with the turn (nothing for a realm whose race holds none, nor a phantom); Early Winter, whose half wage reads the stamp (the economy's row halves it) |

Home of the Wild, also a step of `armStr`, is the alignment abilities' (question 79 is open on it).

**The heroes and the companies** (B-06af, `race-gifts/the-race-gifts-on-heroes-and-companies.ts`):

| Stage | Its gifts | Where it is asked, and what it gives |
|---|---|---|
| `experience`: **a race's gift quickens a hero's learning** | Quick learners (a Human hero, ×1.5) | `trySkillGain`, on the chance a skill rises by experience; `resolvePracticeSkillOrder`, whether he practises at the quick learners' share (`theShareAQuickLearnerPractisesAt` reads the row's factor) |
| `experience`: **a race's gift quickens a company's drill** | Drillmasters (a Human company, ×2) | `humanXPMult`: a commander's drill, the garrison's drill, a rise after a battle |
| `aHerosStanding`: **a race's gift sets a hero's hit points** | Iron constitution (an Orcish hero: 18 at the start, each band 5 higher) | `hpStartOf`, `hpGainBand` and `maxHpIsOrc`; a hero of any other starts at 15 |
| `aHerosStanding`: **a race's gift suits a hero of its realm in mithril** | Mithril Armour (a Dwarven hero) | `mithrilQualifies` (the world's making's end and each turn's start), and the grant on a hire and on the Broker's hire |
| `fate`: **a race's gift gives a fallen company its chance to flee home** | Homeward Flight (an Elven company: 30 in desert or mountain, 60 in forest or jungle, 45 elsewhere) | `recordBattleGraves`, before the realm's discoveries add theirs; the die is drawn only for a company the gift reaches, not raised for the turn, not of the Wild Hunt and not fled already |

## The bots' worth of a race's gift

The rule says what, the bot says how much, as for
[the bots' worth of gold](the-economys-registry-its-stages-and-how-to-add-a-rule-of-the-economy.md#the-bots-worth-of-gold-a-bot-versions-weights-by-kind-of-result)
and [of an alignment ability](the-alignment-abilities-registry-its-stages-and-how-to-add-an-ability.md#the-bots-worth-of-an-alignment-ability)
(B-06ah). The bots name no race: they ask the rows and content's race constants.

- **What the rules say:** a company's strength in the bots' estimates (`botRaceTerrainMult`) takes the kin rule's
  factors (content's `THE_FACTORS_OF_THE_KIN_RULE`, which `theStrengthAUnitsKinAndARivalKinsLeaderLeaveIt` reads too)
  and the steps of the strength stage's runner for the owner's race, each multiplied unrounded (KD-466). Their tuning
  (`botTuning`) asks the runners whether a company of the realm's race defends at a gift's factor on any ground (the
  Bulwark) or the realm takes the spoils of a battle won attacking (the War-spoils): one overlay at most. A province of
  no race reads as `THE_RACE_A_COMPANY_OR_PROVINCE_OF_NO_RACE_READS_AS`, and the wild's race is asked of
  `isTheRaceTheWildsOrOneOfItsSubRaces` and `isTheRaceOneOfTheWildsSubRaces` (a Call to Arms, a recruit's grudge, a
  sea's kind, a scout's target); a poor sea is one of content's poor seas' race tags.
- **What the bot says:** the `raceGift` kind of the first version's weights: what such a realm adds to (or takes off)
  its king's and its heroes' attack margins, and the share of the income its wages may take more.

## The tests

- `tests/unit/the-race-gifts-each-a-row-of-content-and-the-battles-ask-their-runner.test.ts`: each runner against the
  engine's old tests over every pair of races, ground and side; `armStr`'s figure for a company of each gift;
  `markOrcAttackWin`'s stamp.
- `tests/unit/battles-between-heroes.test.ts`: Raiders' Muster's flag between heroes, a property with two fixed
  examples whose winner is known.
- `tests/unit/the-race-gifts-on-heroes-and-companies-each-a-row-of-content-and-the-engine-asks-their-runner.test.ts`:
  each runner against the old tests over every pair of races and ground; `humanXPMult`, the hit points and
  `mithrilQualifies`; `recordBattleGraves` with its die fed. Mithril Armour on a hire and on the Broker's:
  `tests/unit/recruit-hire-and-realm-works-orders-called-directly.test.ts`.
- The two registry tests (each effect once in its stage's order, each row's race a humanoid one; a row with no entry,
  and an entry with no row, fail to compile), and `tests/static/the-code-the-race-rows-have-taken-names-no-race.test.ts`
  with the ratchet's `raceChecksInEngine`.
- `tests/unit/the-bots-races-ask-the-race-constants-the-gifts-rows-and-the-kin-rule-and-weigh-them-as-race-gifts.test.ts`:
  the bots' reads of the gifts, the kin rule and the race constants, against the bot's old figures.

## How to add a gift

1. **Its row**, in the content file: its slug, its name, its race and what the turn reads for it.
2. **Its effect** at a stage, in the stage's file under `src/engine/rules/race-gifts/`, reading its row; **its entry** in
   the registry, and its slug in the stage's order.
3. **A new stage**: its signature goes into `TheStagesOfEachHookPoint`, its runner into the registry, and the rule's
   caller asks the runner.
4. **Its test**: a unit case of the effect and the runner, and each function it takes listed in the static test above.
