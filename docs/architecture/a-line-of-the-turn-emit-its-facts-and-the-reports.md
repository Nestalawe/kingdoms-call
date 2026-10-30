# A line of the turn: `emit`, its facts and the reports

How a line of the turn reaches the GM's log and each realm's report. The trap in brief: [traps.md](../traps.md#a-line-goes-through-emit).

## A line goes through `emit`

Every line of the turn enters the GM's log (`turnContext.turnLog`) through `emit(turnContext, event)`, in
`src/engine/turn/events-and-their-audiences.ts`. The event says what happened (its type, and the fact its words are
written from: below), where and when (`province`, `phase`), whom it is about (`hero`, `heroes`, `battle`), and who may read it
(`audience`: `realms` told, the `actor`, `seen` by the `'world'`, by whoever is `'there'` or by those in the `'battle'`,
and `except` the realms that never read it). A line pushed past it chooses its own audience, the way the leaks the report
check finds were made.
- The lint rule `kc/narrative-lines-go-through-emit` refuses, in all of `src/engine` and `src/views` but the events file
  (since P1-12a4; folder by folder from P1-12a2), any write to `turnLog`, a `log(…)` call (but `console.log` and
  `Math.log`; there is no `log()` helper any more) and a narrative written by hand: add a fight's line with
  `narrate(narrative, line)`: a fact (below). Since P1-12d18 it also refuses a line handed as words: an event or a
  place with a `text` key (once it names its hero), and a string (a string literal, a template, a `+` or a choice with
  one) handed to `narrate`, `emitNarrLine`, `narrateAll` or `narrateAt`, alone or in an array written there. It runs on
  the untyped files too, which the compiler doesn't check. Lines already written move with `narrateAll` (a duel's
  narrative into a battle's, each line as it is), `narrateAt` (lines put in before a line) and `takeBackLinesFrom` (a
  blow that never landed). `emitBattle` and `emitNarrLine` write a fight's narrative out with the fight's event
  (`FightLine`: the event but its words), each line in order: a fact of a kind whose audience is its hero's realm alone
  to that realm alone (below), the rest to the fight's audience.
- **A line for one realm alone inside a fight is a kind whose audience says so** (P1-12c4; `narrateTo` and its
  `{ text, onlyPlayer, charId }` lines went). Each kind's audience is written once, beside the kind in its area's
  module, and its type says which (`THE_AUDIENCE_OF_EACH_KIND_OF_A_PERSONAL_COMBATS_LINE`: a kind given another is a
  compile error): the fight's, its hero's realm alone, or, for a kind filed on its own and not in a fight's narrative
  (a host gained in a province, a stalled battle: P1-12c6), its event's, the audience the event that files it names.
  Two kinds are for one realm alone: a hero's hit-point rise in a
  fight (`awardHpRoll`'s line) and the surgeons' word to a fallen duellist's own realm (`preBattleDuel`); each names its
  `realm` (and the rise its `hero`), and `emitNarrLine` files it told to that realm alone, with no heroes, under its
  hero (else the fight's). A new line the man across the field must not read is a new kind of that audience, and the
  leak check's own list of them (`KINDS_FOR_ONE_REALM_ALONE`, `tests/lib/report-leaks.ts`) gains it: the check "a line
  for one realm alone" reads every realm's report against the recorded events, whatever audience the engine gave them.
  The engine reads a fight's line by its kind, never its words: the mercy that stays a killing blow keeps a skill rise's
  words, a line for one realm alone and another area's fact, and drops the fight's own lines
  (`isAPersonalCombatsLine`, `isALineForEveryoneInTheFight`); the two searches for a battle's header find a battle
  between heroes' "Battle for …" line and its "… a battle is initiated." line by their kinds alone (P1-12c5, c6: no
  line of `battle/` is words any more, so `narrText` went). A line overwritten in place (a battle's heading, once the
  beaten side holds the field) is overwritten with a fact of another kind.
- **A line handed to a helper is an event but its words.** A helper that writes a line for its caller (`logSplit`,
  `reportHeroFall`, the skill rises held back in `_deferredSkillLogs`) takes the line's place as `EventButItsWords`
  (the event without its type and fact: `{ audience, province, hero, phase, … }`), and files it with
  `emit(turnContext, { type, fact, ...place })`. `reportHeroFall` takes the line as a fact, as `notifyTarget` does
  (since P1-12d11: one kind, "a hero is slain outside a battle", the way he fell a value, `how`, one for each of its 12
  callers), and who slew a hero is a record (`TheOneWhoSlewAHero`: a killer's name, or a lair's guardian and its
  province), not words. The skill rises held back (`_deferredSkillLogs`) hold their facts (since P1-12d12: a hero's
  experience lines' kinds) until `writeDeferredSkillLines` files each. What `notifyTarget` and `notifyProvinceOwner`
  are handed, and each half `logSplit` is handed, is a fact too, filed as `fact: line`. Build it as the event's own
  fields, never as the old `log()` meta
  (`targets`, `provinceId`, `charId`, `public`). A line seen by those there but with no province is seen by the world
  (`seen: 'world'`), as the report reads it: where the province may be missing, say so
  (`seen: prov ? 'there' : 'world'`).
- **Every event names its hero**. `hero` is a hero's id (`hero: c.id`), `null` for no hero, or
  `THE_HERO_WHOSE_ORDER_IS_RESOLVING` (a named constant in the events file) for the hero whose order is resolving
  (`turnContext._logCtx.charId`). `emit` files a line naming the constant under that hero only when the line already
  reaches his realm (it is told to it, is its deed, or is seen by the world or there; a battle's line reaches those who
  fought in it by being told), else under no hero. A realm reads every line filed under one of its heroes, so
  before that a line written while Aldric's order resolved, told only to the province's owner, reached Aldric's realm
  too. A hero who serves no realm keeps his lines. `emit` throws on an event with no `hero`; the lint rule refuses
  `emit`'s event, and an event's place (an object literal with an `audience`, as handed to `logSplit`,
  `reportHeroFall` or the held-back skill rises), written without `hero` and without a spread; a spread place carries
  its own. Before P1-12c2 a `hero` left out or `null` meant the hero whose order is resolving and `'none'` meant no
  hero; the script that named every hero made the first the constant and `'none'` `null` (a line for the GM alone, the
  Philosopher's Stone's note on the hoards, says `hero: null`:
  `tests/scenario/a-line-for-the-gm-alone-reaches-no-realm.test.ts`). Where a hero's id may be missing, say what then
  (`hero: dest ? dest.id : THE_HERO_WHOSE_ORDER_IS_RESOLVING`, or `?? THE_HERO_WHOSE_ORDER_IS_RESOLVING`). The cases:
  `tests/unit/emit-writes-the-lines-log-wrote.test.ts`; the audience check (`tests/lib/report-leaks.ts`) states the
  same rule apart. The area rows of P1-12c replace the constant with the hero each fact names. The `phase` falls back
  as before: left out or `null` is the phase of that order, else the phase resolving, else 99 once the phases are over;
  `phase: 'none'` is no phase.
- **A line records a fact, and the views write its words**. An event carries `fact` (one kind of `LineFact`), never
  its words: since P1-12d18 `TurnEvent` has no `text` and `NarrativeLine` is `LineFact`, and `emit` throws on an event
  handed as words (a `text`, or a string in the fact's place), as it throws on one with no hero. An area's kinds are typed beside its code
  (the battles': `src/engine/battle/the-facts-a-battles-lines-record.ts`, the force markers and, since P1-12c5 and c6,
  every sentence of `battle/`: a battle between heroes, the duel before a battle, a battle against a province's own
  defenders, a host gained in a province, a stalled battle, a war front, and the helpers that return a line, which
  return its fact; personal combat's:
  `src/engine/personal-combat/the-facts-a-personal-combats-lines-record.ts`, P1-12c4; since P1-12d5 the sea lift's lines
  in a battle, `src/engine/units/the-facts-the-sea-lifts-battle-lines-record.ts`, a hero's death's,
  `src/engine/heroes/the-facts-a-heros-death-lines-record.ts`, and the wanderer's escape's,
  `src/engine/the-facts-the-wanderers-escape-line-records.ts`; since P1-12d6 the Encounter and Defend orders', the order
  dispatch's, the item orders', the Research and Practice orders' and the Recruit and Hire orders', since P1-12d7
  the army orders', the realm works' and the war masteries', since P1-12d8 the espionage orders' and the explore and
  search orders', since P1-12d9 the Cast Spell order's, and since P1-12d10 the move order's, each beside its file in
  `src/engine/orders/`; since P1-12d12 a chase's, `src/engine/heroes/the-facts-a-chases-lines-record.ts`, and a hero's
  experience and hit points', `src/engine/heroes/the-facts-a-heros-experience-lines-record.ts`; since P1-12d13 the title
  intelligence's, `src/engine/titles/the-facts-the-title-intelligence-lines-record.ts`; since P1-12d14 the Defend
  watch's, a stranding at sea's and the war-spoils', `src/engine/units/the-facts-the-defend-watchs-lines-record.ts`,
  `the-facts-a-stranding-at-seas-lines-record.ts` and `the-facts-the-war-spoils-line-records.ts`; since P1-12d15 six
  areas of the turn's own lines in `src/engine/turn/`: the lines before the first phase, the new turn's, a phase's
  stages and intents', the intrusion warnings', a Defend watch met in battle's and a silent hero's season's
  (`the-facts-the-lines-before-the-first-phase-record.ts`, `the-facts-the-new-turns-lines-record.ts`, …); since
  P1-12d16 the season's close: the lines after the phases, diplomacy's and victory's, and Early Winter's
  (`the-facts-the-lines-after-the-phases-record.ts`, `the-facts-diplomacy-and-victorys-lines-record.ts`,
  `the-facts-early-winters-lines-record.ts`); since P1-12d17 the other folders', one beside each folder's files: what a
  spy learns (`src/engine/espionage/the-facts-what-a-spy-learns-lines-record.ts`), relations and captures
  (`realms/the-facts-relations-and-captures-lines-record.ts`), the Plague and the Bless ward
  (`magic/the-facts-plague-and-bless-ward-lines-record.ts`), a rallied garrison and Wraith's Touch
  (`world/the-facts-rallied-garrisons-and-wraiths-touch-lines-record.ts`; Wraith's Touch the fight's, told in a
  battle's narrative), a bot's concession (`bots/the-facts-a-bots-concession-line-records.ts`) and the Spy stealth's
  line (`turn/the-facts-the-spy-stealth-line-records.ts`, from `run-turn.ts`); one kind per
  sentence, one field per value it was written
  with, and a kind in one area only: `theWordsOf` routes a fact by its kind to its area's words, and a kind declared in
  two areas doesn't compile, where `LineFact` lists the areas), each with its fields and its audience, and
  `src/views/prose/` writes their words after the turn, one module per area (a new area adds its facts to `LineFact`'s
  list, its audience table to the route in `the-words-of-each-line.ts` and its own words module), a `switch` over the
  kinds with a `never` default: a new kind with no words doesn't compile there. TypeScript can't reduce the union of
  every kind (over a thousand since P1-12d12): `||`, `??` or `?:` on a `NarrativeLine` makes it try, and fails with
  TS2590 ("too complex to represent"); read such a value with an `if` (as `emitBattle` reads its summary line). `forceMarker` returns its fact, and `narrate` takes it as it
  takes words. **`src/engine/battle/` and `src/engine/personal-combat/` write no line's words**: a new line
  there is a new kind (its words in `src/views/prose/`), or a field of one where the words are a fragment (P1-12d moves
  those fields' words into the prose); since P1-12d5 the lines a battle took from another folder's helper (a unit
  disbanding, a sea trap, a naval hold and the naval split, the wanderer's escape, a hero's death) are kinds too, and
  since P1-12d6 every line of five order families, since P1-12d7 of eight, since P1-12d8 of ten, since P1-12d9 of eleven,
  since P1-12d10 of all twelve: `src/engine/orders/` writes no line's words (a new line there is a new kind); since
  P1-12d12 neither does `src/engine/heroes/` (a chase, a hero's experience and hit points, a hero's death), since
  P1-12d13 nor `src/engine/titles/` (the title intelligence: each line opens with its title's bracketed name, "[The
  Throne] ", written by the prose; the player page groups the title lines by it, `TITLE_INTEL_RE`, from the words
  stored, so a title's name changes there only with the page's grouping), since P1-12d14 nor `src/engine/units/` (the
  Defend watch, a stranding at sea, and the war-spoils, told in a battle's narrative as its words were; one field of a
  stranding's still holds words a caller hands in: why the column is short, from Early Winter's safety net), since
  P1-12d15 nor `src/engine/turn/`'s opening, and since P1-12d16 nor its season's close (diplomacy and victory, Early
  Winter, after the phases). Two fields there still hold words handed in: a line the order merge held
  (`staleOrderWarnings`, the set-up's words) and a neutral hero's lesson (`progressNeutralHeroes`' words, `heroes/`).
  Since P1-12d17 neither do the other folders (`espionage/`, `realms/`, `magic/`, `world/`, `bots/`, `run-turn.ts`):
  every place in `src/engine/` hands its line as a fact (but the words still handed through a parameter, listed above).
  **Words others read stay the same by construction**: the save check's line begins "[Save check] ", written by the
  prose (`the-words-of-the-new-turns-lines.ts`), and the balance matrix finds it by those words in the log stored
  (`THE_SAVE_CHECKS_LINE_BEGINS`, `tools/balance/a-game-fails-on-the-save-check.ts`); no game writes the line, so a
  unit case keeps the two the same (`tests/unit/the-balance-matrix-fails-a-game-on-the-save-check.test.ts`); the
  intrusion warnings and the Informant Network's lines open "[Intelligence] ", as the report's filter and the GM page
  read them; the game's end (the Reckoning called as the rivals concede, "🏆 THE GAME IS DECIDED — …", each realm's
  place in the Legacy standings) is written by the prose in the same words (`the-words-of-diplomacy-and-victorys-
  lines.ts`), which the player page reads from the log stored for its banner and standings (`_GE_HEAD_RE`,
  `_GE_STAND_RE`).
- **A fact holds values, and a copy of the world, never a part of it** (P1-12d; personal combat's facts since
  P1-12d2, a battle's since P1-12d3). Its words are written after the turn, when the fighter, his items or the units may have changed: a field
  holding a live part of the world (a hero, his item list, a status) would be read as it is then, not as it was told.
  So a fact holds a number, a flag, an id or a slug, a name, or a copy made as the line is told by a named function
  beside the kind (`aFightersWardAsTheLineTellsIt`, `theItemsAsTheLineNamesThem`, `aListAsTheLineTellsIt`, a battle's
  `theUnitsAsTheLineNamesThem`, `theFortuneAsTheLineTellsIt`, …), and no words: a plural from its count, a mark from its
  roll and its chance, a clause from the flag that chose it (named for what it says: `againstTheUnclean`,
  `itsTemperBreaksItOff`, `thickHideHalvesIt`), a number as the number (the prose rounds it: `n0`, `toFixed`), a unit
  ability's name from its content row (`UNIT_ABILITIES_THE_REGISTRY_HOLDS[slug].name`), all written in
  `src/views/prose/`. **A die drawn for words stays in the engine, where it was drawn, and the fact holds which face**
  (`aDecisiveBlow: rng(0, 1)`; a victory's verb, `winVerbIndex: Math.floor(kcRng() * THE_NUMBER_OF_VERBS_A_VICTORY_IS_TOLD_WITH)`,
  P1-12d3): the views drawing their own would move every draw after it. The table of words moves to the prose, and its
  length is pinned to the engine's count (`satisfies { length: … }`), so the two can't drift apart. The static test
  `a-lines-facts-hold-values-not-words` refuses a field holding words in an area its list names, but the labels (a
  fighter's, a battle's side's, guard's, realm's or unit's) and the slugs it lists; a facts module's kinds include the
  kinds of the records its facts hold (why a unit stands or faces as it does, a ladder's modifiers: P1-12d4), so a
  record's literal is read too. **The engine reads no word it wrote:** a choice made on a line's words (the faced
  clause once read the facing's "empty column") is made on the record's kind. It can't see words handed in through a
  parameter (the verb a battle hands a unit's fate, a force's header's verb); since P1-12d19 a daze's `what` and a
  lingering harm's source are records of the names they are written from (`TheSourceOfADaze`,
  `TheSourceOfALingeringHarm`, beside the combat spells' steps in `src/engine/rules/the-registry-of-content-effects.ts`),
  so the compiler refuses words there, and a lingering harm's identity is its source (the same refreshes it). Nothing in the matrix sees a fact holding a live part on a path played the same either way: a copy that
  freezes each fact as it is told (a throwaway script, P1-12d's scoping) makes the engine's next write to it throw. So **the engine's log holds no words for a
  typed line** (its `text` is `null`, its `fact` last): read a
  line's words from the GM's log in words (`theTurnsLinesInWords(turnLog).gmLog`, `src/views/prose/the-words-of-each-
  line.ts`), never from `resolveTurn`'s `log` or `turnContext.turnLog`. `buildReports` writes them before it picks any
  realm's lines and returns them as `gmLog`, which the shell saves; every harness that plays a turn reads them
  (`tests/lib/scenario-in-the-vm.ts`, `a-staged-turn-on-the-engines-modules.ts`, the board's `lines()` in
  `middle-of-a-bot-world.ts`, and since P1-12d6 the whole-turn case libraries `before-the-first-phase-cases.ts`,
  `set-up-and-order-merge-cases.ts` and `the-bots-plan-cases.ts`), and a test that reads a narrative, or a line a helper returns, writes a fact's words
  with `theWordsOf` (a personal combat's: `wordsOf` or `wordsForEveryoneInTheFight`, `tests/lib/personal-combat.ts`; on
  the booted GM portal, its `theWordsOf`: `tests/battle-grid.test.js`). A test that keeps a
  narrative's strings and drops the rest reads nothing of a typed line: read its words. **Never read `text` loosely**: a read of the engine's log that takes a missing `text` as empty (`e.text ?? ''`, `String(e.text)`,
  `e.text || ''`, `l.text === words`) passes for nothing once its line becomes a fact, and an assertion that a line is
  absent stays green whatever the engine writes; read the words pass. In this run a
  line's words are the same for every reader (the masking of unmet realms stays on them, R-046).
- **A battle's tiers and its tally come from its words, in the views.** `emitBattle` files each line with its tier
  still to work out (`A_TIER_WORKED_OUT_FROM_THE_WORDS_OF_THE_BATTLES_LINES`) and, after them, the place of its losses
  tally (a fact with no words, filed with the fight's event, so it keeps the fight's audience, hero and place; none when
  every line is for one realm alone). The words pass gives each line its tier (`battleLineTiers`) and writes the tally
  (`battleTallyLine`, both in `src/engine/battle/fates.ts`, unchanged) where the casualty lists begin, else after the
  lines, else nowhere. Nothing in the engine may read a line's tier, or the tally, as the turn goes on: they aren't
  there yet. The cases: `tests/unit/the-views-write-each-lines-words.test.ts`.
- Nothing stored changes in P1-12a, P1-12b or this run of P1-12c: the GM's log in words is today's line forms, key for
  key and in the same order (the old `log()`'s 17 keys; `form: 'bare'`, the 14 of the lines once pushed directly;
  `notFor` last when `except` is given), with no fact in it. The stored form changes once, declared, when the last area
  is typed (P1-12's Decisions of 2026-10-24, Decision 3). The balance matrix hashes the stored log (`writes`), and every
  realm's report is compared line for line (`npm run balance`). `tests/unit/emit-writes-the-lines-log-wrote.test.ts`
  checks the forms (its oracle against copies of the old code ran from P1-12a2 to P1-12a4, until every caller was
  converted).

## Views never write

Building the reports reads the world and the GM's log, and writes to neither (P1-12b2, P1-12's Decision 9). Every
realm's report is built from the same working copy, after the save, one realm after another: a write made while one
realm's report is built changes what the next realm's report reads, and the save never holds it, so nothing shows it
but the reports.
- A rule that changes the world belongs to the engine, before the reports: the Spy-stealth rolls and the Invisibility
  re-stamp are `spyStealthAndInvisibilityStampedForTheReports` (`src/engine/run-turn.ts`), an engine step `resolveTurn`
  hands the shell beside `whatTheReportsRead`. The shell calls it after the save and before the reports, on the turn's
  dice; `whatTheReportsRead` refuses to hand anything over before it, or twice. The reports are the views'
  (`buildReports` and `playerEvents`, `src/views/every-realms-report-and-the-lines-each-realm-reads.ts`, P1-12b3), which
  the engine doesn't import: the shell calls them with what the turn hands over. A harness that plays a turn calls the
  three, in that order. Only perception reads the world (`playerEvents` and `playerView`); the report
  itself (`buildTurnReport`) reads only what those two give it.
- The reports draw no dice either: since P1-12b3 they are lent none, so a draw there would come from the page's dice
  and shift the next turn's seed (the frozen-world test below counts the draws).
- A per-turn mark is cleared at the next turn's start, not after the reports: the battle flags (`_hadBattleThisTurn`,
  `_combatPlayersThisTurn`) stay on the working copy, and `lastTurnsBattleAndDuelSwordsClearedFromTheMap` clears them
  as the next turn reads the save.
- A helper the report calls must not write either, even the same value back: `normaliseEquipment` writes only a flag
  that changes, so `activeItems` and every helper that reads items through it are reads at report time, when every
  hero's items are already in order.
- `tests/unit/the-reports-are-built-on-a-world-that-cannot-be-written.test.ts` plays a whole game of the matrix with
  every report built on a world and a log that refuse every write (each write noted, then thrown), on dice that count
  every draw, and compares every
  report with the matrix's. A new write in a report, or in anything it calls, turns it red. `_MAXHP_PLAYERS`, a global
  the turn keeps, is not the world: it is P1-10's.
