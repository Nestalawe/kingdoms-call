// A line's facts hold values, not words (plan P1-12d, P1-12's Decisions of 2026-10-26, Decisions 2 and 10): every fact
// literal in src/engine/ whose kind an area of the list below declares holds plain values only (a number, a flag, an
// id or a slug, a name as the world or the content holds it, a copy of a list or a record), never words the engine
// composed (a clause, a plural, a mark, a join, a number formatted for reading). The views write every word
// (src/views/prose/). And no facts module imports the world's types (src/schemas/): a fact never holds a part of the
// world. P1-12d2 lists personal combat, P1-12d3 the battles, P1-12d4 the strength ladder and the grid, P1-12d5 the sea
// lift's lines in a battle, a hero's death and the wanderer's escape, P1-12d6 five order families (Encounter and
// Defend, the order dispatch, the item orders, Research and Practice, Recruit and Hire), P1-12d7 three more (the army
// orders, the realm works, the war masteries), P1-12d8 two more (espionage, explore and search), P1-12d9 the Cast Spell
// order, P1-12d10 the move order, P1-12d11 a hero slain outside a battle (reportHeroFall's 12 callers, in a hero's
// death's area), P1-12d12 a chase and a hero's experience and hit points (and the equip note at a death), P1-12d13
// the title intelligence, P1-12d14 the Defend watch, a stranding at sea and the war-spoils, P1-12d15 the lines before
// the first phase, the new turn, a phase's stages and intents, the intrusion warnings, a Defend watch met in battle and a
// silent hero's season, P1-12d16 the season's close (the lines after the phases, diplomacy's and victory's, and Early
// Winter's: their records too, the crumbling companies, a title's perk of gold, a garrison company drilled), P1-12d17
// the other folders (what a spy learns, relations and captures, the Plague and the Bless ward, a rallied garrison and
// Wraith's Touch, a bot's concession, the Spy stealth's line). A facts
// module's kinds include the kinds of the records its facts hold (P1-12d4: why a
// unit stands or faces as it does, whom it faced, each modifier of the ladder; P1-12d6: why a practice's chance is what
// it is, where companies muster, why a company was not raised; P1-12d7: why a hand-over at sea is refused, where a Wild
// Calling tore beasts from; P1-12d8: what a thief was caught at; P1-12d9: why a charmed mind may turn on its enchanter,
// a company a Telekinetic Storm strikes; P1-12d10: the troops that rally to a defender), so a record's literal is read
// too, and a record's `kind` that a facts module declares
// is the record's name, not words.
//
// The rule, by syntax tree: a field holds words when its value is, or holds, a string or a template with text in it,
// reached as the value (through a conditional's two branches, +, ||, ??, &&, a template's placeholders, String(), an
// array or an object), through a call to a word helper (its name ends in Line, Words, Word, Label, Clause, Narrative,
// Note, Names, Tag, Verb, Plural, Text, Roll or Icon; or describeArmy, pcSkillLabel, pcWardWord, pcPerkWord,
// monsterCatLabel, fmtRoll, hpGainLine, _pct, forceLabel, realmTag, unitRef, ownedUnitName, aAn (a word's article),
// n0 (a number rounded for reading: P1-12d3); or join, or toFixed),
// through a table of words written in the same file, or through a variable of the same file, by its declaration or a
// later assignment (= or +=). A string that is a call's argument or a comparison's operand is not the value's words.
// The scoping's scanner (P1-12d) counted every string inside a field's expression, so it counted numbers (a damage
// dealt by a call that names its spell) and missed a field handed a variable that a template built.
//
// What it lets through, by kind and field (Decision 2): the fighters' labels ("The Barrow Wight", a hero's name: the
// facts-by-sense slice names a side) and a battle's side's, guard's, realm's or unit's label ("Aldric's leaderless
// host", "the defenders of Highmoor", a realm's tag, "Aldric's Free Lances (Free Lances, Veteran)"), the order's
// action (a slug: P1-12d6), five slugs or names a string literal gives
// (a strike's class, its channel, a guardian's grade as the content names it, a school's name as the content names it,
// a realm's alignment, a unit's quality, the line an ability places a unit in; since P1-12d11 the way a hero slain
// outside a battle fell, `how`; since P1-12d15 an heir's name as the engine names him, `heirName`). It can't see words
// handed in through a function's parameter, so those are typed as values: since P1-12d19 a daze's `what` and a
// lingering harm's source are records (TheSourceOfADaze, TheSourceOfALingeringHarm), and since P1-12d20 a unit's fate's
// verb is a flag (`inTheRout`, `hardenedByVictory`), a force's header's verb its values (HowAForceComesOnInItsHeader)
// and a battle's severity its band's slug (TheSeverityOfABattle), so the compiler refuses words there from a typed
// caller (the two battle files that call them are still untyped); since P1-12d21 how a hero carries the items he
// gained is a record (TheItemsAHeroGained: settleTheItemsAHeroGained, src/engine/items/equipment.ts, in place of
// gainedItemNote's words).
//
// Red on its base by design (P1-12d2's base: 139 fields of personal combat's facts; P1-12d3's: 121
// fields of the battles' facts; P1-12d4's: the 10 the list of the ladder's and the grid's let through; P1-12d5's,
// P1-12d6's, P1-12d7's, P1-12d8's, P1-12d9's, P1-12d10's, P1-12d12's, P1-12d13's, P1-12d14's, P1-12d15's,
// P1-12d16's and P1-12d17's: their areas' facts modules, which their
// bases lack), as the static
// tests of P1-19's
// rows are: the one exception to refactor-only's rule that new tests pass before and after (Theo, 2026-10-25).
// Level 0 (static): the files' syntax trees; nothing runs.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// A line's facts hold values, not words (plan P1-12d, P1-12's Decisions of 2026-10-26, Decisions 2 and 10): every fact
// literal in `src/engine/` of a kind an area of its list declares (P1-12d2: personal combat; P1-12d3: a battle;
// P1-12d4: the strength ladder and the grid, whose records' kinds the facts module declares too; P1-12d5: the sea
// lift's lines in a battle, a hero's death, the wanderer's escape; P1-12d6: the Encounter and Defend orders, the order
// dispatch, the item orders, the Research and Practice orders, the Recruit and Hire orders; P1-12d7: the army orders,
// the realm works orders, the war mastery orders; P1-12d8: the espionage orders, the explore and search orders;
// P1-12d9: the Cast Spell order; P1-12d10: the move order; P1-12d12: a chase, a hero's experience and hit points;
// P1-12d13: the title intelligence; P1-12d14: the Defend watch, a stranding at sea, the war-spoils; P1-12d15: the lines
// before the first phase, the new turn, a phase's stages and intents, the intrusion warnings, a Defend watch met in
// battle, a silent hero's season; P1-12d16: the lines after the phases, diplomacy's and victory's, Early Winter's;
// P1-12d17: what a spy learns, relations and captures, the Plague and the Bless ward, a rallied garrison and Wraith's
// Touch, a bot's concession, the Spy stealth's line) holds
// no field whose value is, or holds, words: a string or
// a template with text reached as the value (through a conditional's branches, `+`, `||`, `??`, `&&`, a placeholder,
// `String()`, an array or a record), a word helper's call (by its name, `aAn` and `n0` since P1-12d3, or `join` and
// `toFixed`), a table of words of the same file, or a variable of the same file by its declaration or a later
// assignment (`=`, `+=`); a call's argument or a comparison's operand isn't the value's words. It lets through, by kind
// and field, the fighters' labels (`foeWho`, `who`: Decision 2) and a battle's side's, guard's, realm's and unit's
// labels (`cName`, `atkName`, `defName`, `loserName`, `guardName`, `realmTag`, `unitName`, …: 27 fields), the enemy
// unit a unit faced (`theEnemyUnit`, a unit's label), a disbanding unit's owner (`ownerName`, a side's or a guard's
// label, P1-12d5), and seven slugs or names (`strikeClass`, `channel`, `tier`, `schoolLabel`, `attackersAlignment`, a unit's
// `quality`, the line an ability places a unit in, `itsLine`; since P1-12d6 the order's `action`, a slug; since P1-12d7
// a company raised's `quality`, `unitType` and `unitName` as the world or the content holds them, Call to Arms' and
// Harvest the Field's (since P1-12d17 an Evil conquest's enslaved folk's `unitType` too); since P1-12d8 the class
// of lair Discover Lost Ruin names, `lairClass`; since P1-12d9 a skeletal company's `quality`, `unitType` and
// `unitName` as the world holds them, Skeletal Armies', and the Wraiths' `unitName`, Raise Wraiths'; since P1-12d11
// the way a hero slain outside a battle fell, `how`, each of reportHeroFall's 12 callers'; since P1-12d12 the realm's
// tag of a challenger his quarry's realm learns of, `realmTag`; since P1-12d15 an heir's name as the engine names him,
// `heirName`; an item's equip note, `gainedItemNote`, until P1-12d21 made it a record); a record's `kind`
// that a facts module declares is the record's name, not words (P1-12d6: where the companies muster; P1-12d7: why a
// hand-over at sea is refused, where a Wild Calling tore beasts from; P1-12d8: what a thief was caught at; P1-12d9: why
// a charmed mind may turn on its enchanter, a company a Telekinetic Storm strikes; P1-12d10: the troops that rally to a
// defender), and its literal is read as a kind of its module. And no facts module imports `src/schemas/`. Its own
// planted file: 16 ways of handing words (and a spread) refused (a record of a kind no facts module declares among
// them, P1-12d6), 10 values let through (a record of a declared kind). Red on its base by design (P1-12d2's base: 113
// fields of personal combat's facts; P1-12d3's: 121 of a battle's; P1-12d4's: the 10 of the ladder and the grid it
// listed; P1-12d5's: its three areas' facts modules, which the base lacks, and the disbanding kind; P1-12d6's: its five
// areas' facts modules; P1-12d7's: its three; P1-12d8's: its two; P1-12d9's: its one; P1-12d12's: its two;
// P1-12d13's: its one; P1-12d14's: its three; P1-12d15's: its six; P1-12d16's: its three; P1-12d17's: its six), the one
// exception to
// `refactor-only`'s rule (Theo, 2026-10-25). It can't see words handed in through a parameter. Level 0: syntax trees;
// nothing runs. TypeScript, in `static/`
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';
import { ROOT } from '../../tools/build.ts';

/** Each area whose facts hold no words, by its facts module, from the row that made it so. */
const AREAS: readonly (readonly [area: string, factsModule: string, row: string])[] = [
  ['personal combat', 'src/engine/personal-combat/the-facts-a-personal-combats-lines-record.ts', 'P1-12d2'],
  ['a battle', 'src/engine/battle/the-facts-a-battles-lines-record.ts', 'P1-12d3'],
  ["the sea lift's lines in a battle", 'src/engine/units/the-facts-the-sea-lifts-battle-lines-record.ts', 'P1-12d5'],
  ["a hero's death", 'src/engine/heroes/the-facts-a-heros-death-lines-record.ts', 'P1-12d5'],
  ["the wanderer's escape", 'src/engine/the-facts-the-wanderers-escape-line-records.ts', 'P1-12d5'],
  [
    'the Encounter and Defend orders',
    'src/engine/orders/the-facts-the-encounter-and-defend-orders-lines-record.ts',
    'P1-12d6',
  ],
  ['the order dispatch', 'src/engine/orders/the-facts-the-order-dispatchs-lines-record.ts', 'P1-12d6'],
  ['the item orders', 'src/engine/orders/the-facts-the-item-orders-lines-record.ts', 'P1-12d6'],
  [
    'the research and practice orders',
    'src/engine/orders/the-facts-the-research-and-practice-orders-lines-record.ts',
    'P1-12d6',
  ],
  ['the recruit and hire orders', 'src/engine/orders/the-facts-the-recruit-and-hire-orders-lines-record.ts', 'P1-12d6'],
  ['the army orders', 'src/engine/orders/the-facts-the-army-orders-lines-record.ts', 'P1-12d7'],
  ['the realm works orders', 'src/engine/orders/the-facts-the-realm-works-orders-lines-record.ts', 'P1-12d7'],
  ['the war mastery orders', 'src/engine/orders/the-facts-the-war-mastery-orders-lines-record.ts', 'P1-12d7'],
  ['the espionage orders', 'src/engine/orders/the-facts-the-espionage-orders-lines-record.ts', 'P1-12d8'],
  [
    'the explore and search orders',
    'src/engine/orders/the-facts-the-explore-and-search-orders-lines-record.ts',
    'P1-12d8',
  ],
  ['the Cast Spell order', 'src/engine/orders/the-facts-the-cast-spell-orders-lines-record.ts', 'P1-12d9'],
  ['the move order', 'src/engine/orders/the-facts-the-move-orders-lines-record.ts', 'P1-12d10'],
  ['a chase', 'src/engine/heroes/the-facts-a-chases-lines-record.ts', 'P1-12d12'],
  ["a hero's experience and hit points", 'src/engine/heroes/the-facts-a-heros-experience-lines-record.ts', 'P1-12d12'],
  ['the title intelligence', 'src/engine/titles/the-facts-the-title-intelligence-lines-record.ts', 'P1-12d13'],
  ['the Defend watch', 'src/engine/units/the-facts-the-defend-watchs-lines-record.ts', 'P1-12d14'],
  ['a stranding at sea', 'src/engine/units/the-facts-a-stranding-at-seas-lines-record.ts', 'P1-12d14'],
  ['the war-spoils', 'src/engine/units/the-facts-the-war-spoils-line-records.ts', 'P1-12d14'],
  [
    'the lines before the first phase',
    'src/engine/turn/the-facts-the-lines-before-the-first-phase-record.ts',
    'P1-12d15',
  ],
  ['the new turn', 'src/engine/turn/the-facts-the-new-turns-lines-record.ts', 'P1-12d15'],
  ["a phase's stages and intents", 'src/engine/turn/the-facts-a-phases-lines-record.ts', 'P1-12d15'],
  ['the intrusion warnings', 'src/engine/turn/the-facts-the-intrusion-warnings-lines-record.ts', 'P1-12d15'],
  [
    'a Defend watch met in battle',
    'src/engine/turn/the-facts-a-defend-watch-met-in-battle-lines-record.ts',
    'P1-12d15',
  ],
  ["a silent hero's season", 'src/engine/turn/the-facts-a-silent-heros-season-line-records.ts', 'P1-12d15'],
  ['the lines after the phases', 'src/engine/turn/the-facts-the-lines-after-the-phases-record.ts', 'P1-12d16'],
  ["diplomacy's and victory's lines", 'src/engine/turn/the-facts-diplomacy-and-victorys-lines-record.ts', 'P1-12d16'],
  ["Early Winter's lines", 'src/engine/turn/the-facts-early-winters-lines-record.ts', 'P1-12d16'],
  ['what a spy learns', 'src/engine/espionage/the-facts-what-a-spy-learns-lines-record.ts', 'P1-12d17'],
  ['relations and captures', 'src/engine/realms/the-facts-relations-and-captures-lines-record.ts', 'P1-12d17'],
  ['the Plague and the Bless ward', 'src/engine/magic/the-facts-plague-and-bless-ward-lines-record.ts', 'P1-12d17'],
  [
    "a rallied garrison and Wraith's Touch",
    'src/engine/world/the-facts-rallied-garrisons-and-wraiths-touch-lines-record.ts',
    'P1-12d17',
  ],
  ["a bot's concession", 'src/engine/bots/the-facts-a-bots-concession-line-records.ts', 'P1-12d17'],
  ["the Spy stealth's line", 'src/engine/turn/the-facts-the-spy-stealth-line-records.ts', 'P1-12d17'],
];

/** Every facts module (none may import the world's types). */
const FACTS_MODULES: readonly string[] = [
  'src/engine/battle/the-facts-a-battles-lines-record.ts',
  'src/engine/personal-combat/the-facts-a-personal-combats-lines-record.ts',
  'src/engine/units/the-facts-the-sea-lifts-battle-lines-record.ts',
  'src/engine/heroes/the-facts-a-heros-death-lines-record.ts',
  'src/engine/the-facts-the-wanderers-escape-line-records.ts',
  'src/engine/orders/the-facts-the-encounter-and-defend-orders-lines-record.ts',
  'src/engine/orders/the-facts-the-order-dispatchs-lines-record.ts',
  'src/engine/orders/the-facts-the-item-orders-lines-record.ts',
  'src/engine/orders/the-facts-the-research-and-practice-orders-lines-record.ts',
  'src/engine/orders/the-facts-the-recruit-and-hire-orders-lines-record.ts',
  'src/engine/orders/the-facts-the-army-orders-lines-record.ts',
  'src/engine/orders/the-facts-the-realm-works-orders-lines-record.ts',
  'src/engine/orders/the-facts-the-war-mastery-orders-lines-record.ts',
  'src/engine/orders/the-facts-the-espionage-orders-lines-record.ts',
  'src/engine/orders/the-facts-the-explore-and-search-orders-lines-record.ts',
  'src/engine/orders/the-facts-the-cast-spell-orders-lines-record.ts',
  'src/engine/orders/the-facts-the-move-orders-lines-record.ts',
  'src/engine/heroes/the-facts-a-chases-lines-record.ts',
  'src/engine/heroes/the-facts-a-heros-experience-lines-record.ts',
  'src/engine/titles/the-facts-the-title-intelligence-lines-record.ts',
  'src/engine/units/the-facts-the-defend-watchs-lines-record.ts',
  'src/engine/units/the-facts-a-stranding-at-seas-lines-record.ts',
  'src/engine/units/the-facts-the-war-spoils-line-records.ts',
  'src/engine/turn/the-facts-the-lines-before-the-first-phase-record.ts',
  'src/engine/turn/the-facts-the-new-turns-lines-record.ts',
  'src/engine/turn/the-facts-a-phases-lines-record.ts',
  'src/engine/turn/the-facts-the-intrusion-warnings-lines-record.ts',
  'src/engine/turn/the-facts-a-defend-watch-met-in-battle-lines-record.ts',
  'src/engine/turn/the-facts-a-silent-heros-season-line-records.ts',
  'src/engine/turn/the-facts-the-lines-after-the-phases-record.ts',
  'src/engine/turn/the-facts-diplomacy-and-victorys-lines-record.ts',
  'src/engine/turn/the-facts-early-winters-lines-record.ts',
  'src/engine/espionage/the-facts-what-a-spy-learns-lines-record.ts',
  'src/engine/realms/the-facts-relations-and-captures-lines-record.ts',
  'src/engine/magic/the-facts-plague-and-bless-ward-lines-record.ts',
  'src/engine/world/the-facts-rallied-garrisons-and-wraiths-touch-lines-record.ts',
  'src/engine/bots/the-facts-a-bots-concession-line-records.ts',
  'src/engine/turn/the-facts-the-spy-stealth-line-records.ts',
];

/** A fighter's label: still a field's words in this slice (Decision 2), by its field, with the kinds that hold it. */
const LABELS: Readonly<Record<string, readonly string[]>> = {
  // `The ${foe.name}` for a guardian, else the hero's name (resolvePersonalCombat's mercy)
  foeWho: [
    'as their strength fails a fighter begs the foe for mercy',
    'as the foe draws for the killing shot a fighter begs for their life',
    'as the foe readies a power for the killing stroke a fighter begs',
    'beaten and bleeding a fighter sees the killing blow coming',
    'as the foe closes for the kill a fighter cries out for mercy',
    'the guardian pauses over its prey and lets a fighter crawl away',
    'the foe lets a fighter go',
    'the foe lowers their bow and lets a fighter go',
    'the foe lets a power die unspent',
    'the foe stays the blow and lets a fighter go',
    'the foe lowers their weapon in disgust and lets a fighter go',
    'the stroke never falls and the foe spares a fighter',
    'the foe knows nothing of mercy',
    'the foe laughs at the plea',
    'the foe is deaf to the plea',
    'there is no pity in the foe',
  ],
  // `The ${actor.name}` for a guardian, else the hero's name (pcUseCombatItem)
  who: [
    'a fighter uses a combat item',
    'a fighter recovers hit points',
    'a fighter recovers hit points and every lingering affliction lifts',
    'a fighter drinks the stolen vigour',
    'a fighter surges with strength',
    "a fighter's eye sharpens",
    'a fighter is ready to break away',
    'a fighter fades from sight the foe',
  ],
  // A battle's side, as the battle names it: a hero, "Aldric's leaderless host" when he fell, "Aldric's host" (the
  // battles' tally and the tiers find a side by these words; the facts-by-sense slice names a side)
  name: ['a force drawn up for battle'],
  cName: [
    "control undead turns a defending undead unit to the attacker's side",
    'the attacker casts a spell before the battle against the defenders',
    'the attacker has nowhere to retreat and takes further losses',
    'the attacker is repelled by the defenders',
    'the attacker storms ashore in a raid on the coast against the defenders',
    'the attacker sweeps into a province with no one left to stand against him',
    'the attacker unfolds a grand stratagem against the defenders',
    'the attacker wins the battle against the defenders',
    "the attacker's Tactical command does not apply at sea",
    "the attacker's corsairs take his beaten force back to the ships",
    "the attacker's dwarven guard leave the defenders' free lances no broken backs",
    "the attacker's forces retreat to a province",
    "the attacker's free lances find no room to ride",
    "the attacker's free lances ride down the defenders' broken companies",
    "the attacker's monsters are driven to savage fury",
    "the attacker's shield-wall holds and the infantry stand their ground",
    "the attacker's troops fight with fanatical zeal",
    "the attacker's warg riders halve his losses",
    "the defenders' archers find no target among the attacker's forest wardens",
    "the defenders' dwarven guard leave the attacker's free lances no broken backs",
    "the defenders' free lances ride down the attacker's broken companies",
    "the terrain's effect on the attacker's units",
  ],
  atkName: [
    "the attacker fights to win back his realm's capital",
    "the attacker's casualties begin",
    "the attacker's siege mastery halves the defenders' fortifications",
    "the attacker's siegecraft wears down the defenders' fortifications",
    "the consecrated ground of the province weakens the attacker's host",
  ],
  defName: ["the defender's casualties begin", "the defender's realm holds its own ground the harder"],
  loserName: [
    "the loser's dwarven guard hold a shield fort with no road out",
    "the loser's dwarven guard withdraw behind a shield fort",
    "the loser's skeletal host stands its ground in a deathless march",
  ],
  sideName: [
    "a side's skeletal legions fight with fanaticism under their undead king",
    "a side's skeletal legions know no fear",
    "a side's war-horn of the plains lets its free lances ride in rough country",
    "the illusory ground of the province confuses a side's forces",
  ],
  heroName: ["the hero's archers find no target among the forest wardens"],
  enemyCommanderName: [
    "a curse withers the enemy commander's skill",
    "a psychic blast severs the enemy commander's bond with his beasts",
    "a telekinetic storm scatters the enemy commander's formations",
  ],
  atkLabel: ['the fortune of the battle'],
  defLabel: ['the fortune of the battle'],
  attackersName: ["the onlookers' summary of a battle"],
  hostName: [
    'a host holds a province unopposed and secures it',
    'the hero has the better of the fighting but enemy forces still hold their ground',
    'the hero has the better of the fighting but leaderless defenders still hold the field',
    'the hero has the better of the fighting but the guard still holds the field',
    "the hero has the better of the fighting but the province's garrison still holds",
    'the hero overcomes the defenders and claims the province for his realm',
  ],
  attackersHostName: [
    "an unfinished battle against a province's defenders resumes",
    'an unfinished battle between two hosts resumes',
    'the attacker breaks off a stalled battle and retreats',
    'the attacker finally overcomes the defenders and claims a province',
    'the attacker is pinned in a province with no way out',
    "war comes to a province two realms' hosts share",
  ],
  defendersHostName: [
    'an unfinished battle between two hosts resumes',
    "war comes to a province two realms' hosts share",
  ],
  winnersHostName: ['the winner of a stalled battle secures a province'],
  victorsHost: [
    "a beaten guard's surviving unit breaks ranks and flees as mercenaries",
    "a beaten guard's surviving unit holds its ground unbroken",
    "a beaten guard's surviving unit loses heart and is reduced a tier",
  ],
  // A guard's label: "Ulric and their forces", "the defenders of Highmoor", "the garrison of Highmoor", "the leaderless
  // garrison", whom a province is held by
  guardName: [
    "a beaten guard's surviving unit holds its ground unbroken",
    "a beaten guard's surviving unit loses heart and is reduced a tier",
    'the attacker wins the battle against the defenders',
  ],
  defName2: ['the attacker is repelled by the defenders'],
  heldByName: ['the attacker moves into a province held by its defenders and a battle is initiated'],
  defendersName: ["an unfinished battle against a province's defenders resumes", "the onlookers' summary of a battle"],
  // A realm's tag, " (Westmarch)" (realmTag)
  realmTag: [
    "a hero not at war with the province's realm gains a host inside it",
    "a hero's host turns on a province it has shared with a realm at war",
    'the hero turns a newly gathered host on a province and a battle is initiated',
    "the province's owner learns his defenders still hold against the hero",
    "the province's owner learns the hero was beaten back",
    "a quarry's realm learns a lone challenger came for him",
    'a defender rides in to meet a host raised in a province of his realm',
  ],
  attackersRealmTag: ["war comes to a province two realms' hosts share"],
  defendersRealmTag: ["war comes to a province two realms' hosts share"],
  // A unit's label, "Aldric's Free Lances (Free Lances, Veteran)" (unitRef, ownedUnitName)
  unitName: [
    "a beaten guard's surviving unit breaks ranks and flees as mercenaries",
    "a beaten guard's surviving unit holds its ground unbroken",
    'a unit is cut down with no escape',
  ],
  defendingUnitName: ['a defending unit is destroyed in the fighting', 'a defending unit is destroyed in the rout'],
  unitNameAtItsOldQuality: ["a beaten guard's surviving unit loses heart and is reduced a tier"],
  // the units' owner as a unit's disbanding names him: a side's label, or a guard's ("the defenders")
  ownerName: ['a beaten unit has had enough and disbands'],
  // the enemy unit a unit faced, as its fate's line names it (ownedUnitName: battleFacedClauses)
  theEnemyUnit: ['an enemy unit'],
};

/** Not words, though a string literal gives them, by field, with the kinds that hold it. */
const NOT_WORDS: Readonly<Record<string, readonly string[]>> = {
  // the order's action as the order names it ('disband_army', 'rampage', …): a slug the prose reads
  action: ['a charmed hero will not carry out an order of his captor', 'a hero has already used a mastery this turn'],
  // the class of the killing strike, 'melee', 'ranged' or 'power': a slug the prose reads
  strikeClass: [
    'as the foe readies a power for the killing stroke a fighter begs',
    'the foe lets a power die unspent',
    'the foe knows nothing of mercy',
    'the foe laughs at the plea',
    'the foe is deaf to the plea',
    'there is no pity in the foe',
  ],
  // a strike's channel, 'melee', 'archery' or 'spell' (PC_CHANNEL): a slug the prose reads
  channel: [
    'the first harm to reach the target is drunk by their armour',
    "the target's shield takes the blow square on",
    "the target's mithril armour turns aside some of the harm",
    "the hunter finds the target's weakness",
    "the target reads the beast's every move",
    "the target's armour turns aside some of the harm",
    'the target turns aside all they can but the harm still lands',
  ],
  // a guardian's grade as the content names it ('Weak' when it has none)
  tier: ['a fighter slips past the guardian and seizes the prize', "a fighter's theft is noticed"],
  // a magic school's name as the content names it (SKILL_LABELS), else its slug: 'elemental' for a spell with none
  schoolLabel: ['the defender casts a spell before the battle'],
  // a realm's alignment as the world names it ('Neutral' when it has none): the prose writes it in lower case
  attackersAlignment: ["the consecrated ground of the province weakens the attacker's host"],
  // the quality a unit fights at, as the world names it ('Average' when it has none): armStr's trace; and the quality of a
  // company raised, as the world holds it ('Green' when no discovery raises it: Call to Arms; the grave's: Harvest the
  // Field, P1-12d7; the grave's, or a tier up: Skeletal Armies, P1-12d9)
  quality: [
    'it fights at another quality',
    'the folk answer a Call to Arms',
    'the corpse-carters raise a skeletal company',
    'a skeletal company rises from the graves',
  ],
  // the type of a company raised, as the content names it (a province's garrison type, else its race's: Call to Arms;
  // the grave's: Skeletal Armies, P1-12d9; the province's first army type, else Shieldwall Levies, as the garrison then
  // holds it: an Evil conquest's enslaved folk, P1-12d17)
  unitType: [
    'the folk answer a Call to Arms',
    'a skeletal company rises from the graves',
    'an Evil conqueror presses the beaten folk into the garrison in chains',
  ],
  // the name of a company raised, as the world holds it (the grave's company, "(Skeletal)": Harvest the Field; and
  // since P1-12d9 Skeletal Armies', and Raise Wraiths' "Wraiths (…)")
  unitName: [
    'the corpse-carters raise a skeletal company',
    'a raiser with no Necromancy is warned his dead will crumble',
    'a skeletal company rises from the graves',
    'the dead are bound into Wraiths',
    'onlookers see the dead bound into Wraiths',
  ],
  // the line an ability places a unit in, 'front' or 'second': a slug the prose reads (battleRegrid)
  itsLine: ['its ability gives it its place'],
  // the class of lair Discover Lost Ruin names, as the order names it ('Weak', 'Moderate', 'Powerful', 'Legendary',
  // 'Ritual'; 'Weak' when it names none): a slug the prose reads (P1-12d8)
  lairClass: ['a hero finds no site of a class left to lay bare', 'a hero lays bare the sites of a class'],
  // the way a hero slain outside a battle fell, one for each caller of reportHeroFall ('in the duel', "a thief's end",
  // …): a slug the prose reads (P1-12d11)
  how: ['a hero is slain outside a battle'],
  // an heir's name, as the engine names him and the world then holds it (nextHeroName; its fallbacks, "Heir of …" and
  // "The New Monarch", are the name the world would hold too): a name, not the line's words (P1-12d15)
  heirName: ['an heir is crowned'],
};

const WORD_HELPER =
  /(Line|Lines|Words|Word|Label|Clause|Clauses|Narrative|Note|Names|Tag|Verb|Plural|Text|Roll|Icon)$|^(describeArmy|pcSkillLabel|pcWardWord|pcPerkWord|monsterCatLabel|fmtRoll|hpGainLine|_pct|forceLabel|realmTag|unitRef|ownedUnitName|aAn|n0)$/;
/** String methods whose result holds the words of the string they are called on. */
const ON_ITS_STRING = new Set(['toLowerCase', 'toUpperCase', 'trim', 'slice', 'replace', 'padStart', 'padEnd']);
/** Calls that write words of what they are given. */
const WRITE_WORDS = new Set(['join', 'toFixed', 'concat', 'repeat']);

/** Every declaration (with a value) and every assignment (= or +=) to each name in a file, in the file's order: read
 *  once a file, for every field of every area (the rule runs over the whole engine for each area). */
const THE_NAMES_OF_EACH_FILE = new WeakMap<
  ts.SourceFile,
  Map<string, { declarations: ts.VariableDeclaration[]; assignments: ts.BinaryExpression[] }>
>();
function theNamesOf(sf: ts.SourceFile) {
  let names = THE_NAMES_OF_EACH_FILE.get(sf);
  if (names) return names;
  const found = new Map<string, { declarations: ts.VariableDeclaration[]; assignments: ts.BinaryExpression[] }>();
  const of = (name: string) => {
    let entry = found.get(name);
    if (!entry) found.set(name, (entry = { declarations: [], assignments: [] }));
    return entry;
  };
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer)
      of(node.name.text).declarations.push(node);
    if (
      ts.isBinaryExpression(node) &&
      ts.isIdentifier(node.left) &&
      (node.operatorToken.kind === ts.SyntaxKind.EqualsToken ||
        node.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken)
    )
      of(node.left.text).assignments.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  names = found;
  THE_NAMES_OF_EACH_FILE.set(sf, names);
  return names;
}

/** Every expression a variable is given before a place in a file: its last declaration before the place, and every
 *  assignment (= or +=) to it after that declaration and before the place. */
function whatAVariableIsGiven(sf: ts.SourceFile, name: string, before: number): ts.Expression[] {
  const names = theNamesOf(sf).get(name);
  if (!names) return [];
  let declaration: ts.VariableDeclaration | undefined;
  for (const node of names.declarations)
    if (node.getStart(sf) < before && (!declaration || node.getStart(sf) > declaration.getStart(sf)))
      declaration = node;
  if (!declaration?.initializer) return [];
  const from = declaration.getStart(sf);
  return [
    declaration.initializer,
    ...names.assignments.filter((a) => a.getStart(sf) < before && a.getStart(sf) > from).map((a) => a.right),
  ];
}

/** Every kind the facts modules declare: a record's kind among them is the record's name, not words (its literal is
 *  read as a kind of its module: P1-12d6, where the companies muster). */
let THE_KINDS_THE_FACTS_MODULES_DECLARE: ReadonlySet<string> | undefined;
function isTheKindOfADeclaredRecord(sf: ts.SourceFile, p: ts.ObjectLiteralElementLike): boolean {
  THE_KINDS_THE_FACTS_MODULES_DECLARE ??= new Set(FACTS_MODULES.flatMap((file) => [...kindsDeclaredIn(file)]));
  return (
    ts.isPropertyAssignment(p) &&
    p.name.getText(sf) === 'kind' &&
    ts.isStringLiteralLike(p.initializer) &&
    THE_KINDS_THE_FACTS_MODULES_DECLARE.has(p.initializer.text)
  );
}

/** Why a value holds words (null: it holds none). */
function whyItHoldsWords(
  sf: ts.SourceFile,
  value: ts.Expression,
  place: number,
  seen: ReadonlySet<string>,
): string | null {
  const inner = (e: ts.Expression): string | null => whyItHoldsWords(sf, e, place, seen);
  const first = (es: readonly ts.Expression[]): string | null => {
    for (const e of es) {
      const why = inner(e);
      if (why) return why;
    }
    return null;
  };
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))
    return value.text ? `the words ${JSON.stringify(value.text)}` : null;
  if (ts.isTemplateExpression(value)) {
    const text = value.head.text + value.templateSpans.map((s) => s.literal.text).join('');
    return text
      ? `a template with the words ${JSON.stringify(text)}`
      : first(value.templateSpans.map((s) => s.expression));
  }
  if (
    ts.isParenthesizedExpression(value) ||
    ts.isAsExpression(value) ||
    ts.isNonNullExpression(value) ||
    ts.isSatisfiesExpression(value)
  )
    return inner(value.expression);
  if (ts.isConditionalExpression(value)) return first([value.whenTrue, value.whenFalse]);
  if (ts.isBinaryExpression(value)) {
    const operator = value.operatorToken.kind;
    return operator === ts.SyntaxKind.PlusToken ||
      operator === ts.SyntaxKind.BarBarToken ||
      operator === ts.SyntaxKind.QuestionQuestionToken ||
      operator === ts.SyntaxKind.AmpersandAmpersandToken
      ? first([value.left, value.right])
      : null;
  }
  if (ts.isArrayLiteralExpression(value)) return first(value.elements);
  if (ts.isObjectLiteralExpression(value))
    return first(
      value.properties.flatMap((p) =>
        isTheKindOfADeclaredRecord(sf, p)
          ? []
          : ts.isPropertyAssignment(p)
            ? [p.initializer]
            : ts.isShorthandPropertyAssignment(p)
              ? [p.name]
              : [],
      ),
    );
  if (ts.isElementAccessExpression(value) || ts.isPropertyAccessExpression(value)) {
    let table: ts.Expression = value.expression;
    while (ts.isParenthesizedExpression(table)) table = table.expression;
    if (ts.isIdentifier(table) && !seen.has(table.text)) {
      const given = whatAVariableIsGiven(sf, table.text, place);
      table = given.length === 1 && given[0] ? given[0] : table;
    }
    return ts.isObjectLiteralExpression(table) || ts.isArrayLiteralExpression(table)
      ? inner(table) && `a table of words (${value.expression.getText(sf)})`
      : null;
  }
  if (ts.isCallExpression(value)) {
    const callee = value.expression;
    const name = ts.isPropertyAccessExpression(callee) ? callee.name.text : ts.isIdentifier(callee) ? callee.text : '';
    if (name === 'String' && value.arguments[0]) return inner(value.arguments[0]);
    if (WRITE_WORDS.has(name) && ts.isPropertyAccessExpression(callee)) return `words written by ${name}`;
    if (ON_ITS_STRING.has(name) && ts.isPropertyAccessExpression(callee)) return inner(callee.expression);
    return WORD_HELPER.test(name) ? `the word helper ${name}` : null;
  }
  if (ts.isIdentifier(value) && !seen.has(value.text)) {
    const inside = new Set([...seen, value.text]);
    for (const given of whatAVariableIsGiven(sf, value.text, place)) {
      const why = whyItHoldsWords(sf, given, given.getStart(sf), inside);
      if (why) return `${value.text}, given ${why}`;
    }
  }
  return null;
}

/** The kinds a facts module declares (each `kind: '…'` of its types). */
function kindsDeclaredIn(file: string): Set<string> {
  const sf = ts.createSourceFile(file, fs.readFileSync(path.join(ROOT, file), 'utf8'), ts.ScriptTarget.Latest, true);
  const kinds = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertySignature(node) &&
      node.name.getText(sf) === 'kind' &&
      node.type &&
      ts.isLiteralTypeNode(node.type) &&
      ts.isStringLiteral(node.type.literal)
    )
      kinds.add(node.type.literal.text);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return kinds;
}

/** Every field of a fact literal of the kinds given that holds words, in a file's text: "line kind field: why". */
/** Each file's syntax tree, parsed once for every area (by its path and its text). */
const THE_TREE_OF_EACH_FILE = new Map<string, ts.SourceFile>();
function theTreeOf(file: string, text: string): ts.SourceFile {
  const key = `${file}\0${text}`;
  let sf = THE_TREE_OF_EACH_FILE.get(key);
  if (!sf) THE_TREE_OF_EACH_FILE.set(key, (sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)));
  return sf;
}

function fieldsHoldingWords(file: string, text: string, kinds: ReadonlySet<string>): string[] {
  const sf = theTreeOf(file, text);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node)) {
      const kindField = node.properties.find(
        (p): p is ts.PropertyAssignment =>
          ts.isPropertyAssignment(p) && p.name.getText(sf) === 'kind' && ts.isStringLiteralLike(p.initializer),
      );
      const kind = kindField && ts.isStringLiteralLike(kindField.initializer) ? kindField.initializer.text : null;
      if (kind !== null && kinds.has(kind))
        for (const field of node.properties) {
          if (field === kindField) continue;
          const name =
            ts.isPropertyAssignment(field) || ts.isShorthandPropertyAssignment(field) ? field.name.getText(sf) : '';
          const value = ts.isPropertyAssignment(field)
            ? field.initializer
            : ts.isShorthandPropertyAssignment(field)
              ? field.name
              : null;
          const why = value ? whyItHoldsWords(sf, value, node.getStart(sf), new Set()) : 'a spread: its fields unseen';
          if (why && !LABELS[name]?.includes(kind) && !NOT_WORDS[name]?.includes(kind)) {
            const line = sf.getLineAndCharacterOfPosition(field.getStart(sf)).line + 1;
            found.push(`${String(line)} ${kind} ${name}: ${why}`);
          }
        }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** Every .ts file under a folder of the repository, by its path from the root. */
function filesUnder(folder: string): string[] {
  return fs
    .readdirSync(path.join(ROOT, folder), { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.ts'))
    .map((f) => path.join(folder, f))
    .sort();
}

test.for(AREAS)("%s's facts hold values, not words (%s, %s)", ([, factsModule]) => {
  const kinds = kindsDeclaredIn(factsModule);
  expect(kinds.size, `the kinds ${factsModule} declares`).toBeGreaterThan(0);
  const found = filesUnder('src/engine').flatMap((file) =>
    fieldsHoldingWords(file, fs.readFileSync(path.join(ROOT, file), 'utf8'), kinds).map((f) => `${file}:${f}`),
  );
  expect(found).toEqual([]);
});

test.for(FACTS_MODULES)('%s imports none of the world’s types (src/schemas/)', (file) => {
  const sf = ts.createSourceFile(file, fs.readFileSync(path.join(ROOT, file), 'utf8'), ts.ScriptTarget.Latest, true);
  const imports = sf.statements
    .filter(ts.isImportDeclaration)
    .map((i) => (ts.isStringLiteral(i.moduleSpecifier) ? i.moduleSpecifier.text : ''));
  expect(imports.filter((from) => from.includes('schemas/'))).toEqual([]);
});

// The rule finds what it should: each way a field can hold words, planted in one file, and none of the values.
test('the rule refuses every way of handing words, and lets every value through', () => {
  const kinds = new Set(['a planted line']);
  const planted = `
    const table = { Weak: 'a dangerous' };
    const clause = 'a clause';
    let built = '';
    built += \` and \${n} more\`;
    const count = pcHitSkill(foe, 'melee'), roll = d100(), copy = aListAsTheLineTellsIt(names);
    narrate(narrative, {
      kind: 'a planted line',
      words: 'a word',
      plural: n !== 1 ? 's' : '',
      mark: roll <= chance ? ' ✓' : ' ✗',
      template: \`\${n}%\`,
      onlyInAPlaceholder: \`\${clause}\`,
      joined: names.join(', '),
      formatted: pct.toFixed(0),
      helper: fmtRoll(chance, roll),
      icon: pcWardIcon(target),
      fallback: what || 'the daze',
      lowered: clause.toLowerCase(),
      fromATable: table[power],
      throughAVariable: clause,
      builtUp: built,
      inARecord: { odds: \` (\${mercy}%)\` },
      ...spread,
      aNumber: count,
      aRoll: roll,
      aName: target.name,
      aFlag: target.kind === 'monster',
      aCopy: copy,
      aRecord: { mercy, shown },
      anArgument: theNamesAsTheLineTellsThem(spells.slice(0, 4)),
      aKey: aFightersWardAsTheLineTellsIt(target, 'schoolWard'),
      aSlug: PC_CHANNEL[kind],
      aRecordOfADeclaredKind: { kind: 'a hero practises alone', level: n },
      aRecordOfNoDeclaredKind: { kind: 'words no facts module declares', level: n },
    });
    narrate(narrative, { kind: 'another area', words: 'its words' });`;
  expect(fieldsHoldingWords('planted.ts', planted, kinds).map((f) => f.split(':')[0]?.split(' ').pop())).toEqual([
    'words',
    'plural',
    'mark',
    'template',
    'onlyInAPlaceholder',
    'joined',
    'formatted',
    'helper',
    'icon',
    'fallback',
    'lowered',
    'fromATable',
    'throughAVariable',
    'builtUp',
    'inARecord',
    '',
    'aRecordOfNoDeclaredKind',
  ]);
});
