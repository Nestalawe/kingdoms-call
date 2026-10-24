// ── THE FACTS A BATTLE'S LINES RECORD (plan P1-12c3 and c5: P1-12's Decisions of 2026-10-24, Decisions 2, 5 and 6) ────
// A typed line records a fact, and the views write its words after perception (src/views/prose/the-words-of-a-
// battles-lines.ts): the engine no longer writes those words itself. Each kind below is one sentence's sense, with the
// fields its words are made from, and its audience (Decision 6: THE_AUDIENCE_OF_EACH_KIND_OF_A_BATTLES_LINE, which
// emitNarrLine reads). Rows c4 to c6 add the rest of the fights' lines: c5 every sentence of a battle between two
// heroes' hosts and of the duel before a battle (battle/battles-between-heroes.ts, battle/pre-battle-duels.ts), one
// kind per sentence, one field per value the sentence was written with, worked out where the line is told and in the
// sentence's order, so the words are the same by construction (TheFactOfOneOfABattlesSentences). A field may hold words
// itself (those named wordsIf…, …Words, …Plural, …Mark, …Names, …Notes, why, a verb, the fortune): P1-12d moves those
// words into the prose and merges the kinds into facts by sense. Words a battle's narrative takes from another file's
// helper (the kinship and terror lines, the ladder rows, the battlecries, the grid) stay words until P1-12c6.
// LineFact (src/engine/turn/events-and-their-audiences.ts) is the union of every area's kinds; a kind with no words in
// src/views/prose/ is a compile error there.
import type { TheAudienceOfAKindOfLine } from '../turn/events-and-their-audiences.ts';
import type { AValueInALinesWords } from '../personal-combat/the-facts-a-personal-combats-lines-record.ts';

/** One unit of a force drawn up for battle, as its header row shows it. */
export interface AUnitOfAForceDrawnUp {
  type: string;
  quality: string;
  unitName: string;
  race: string | null;
  phantom: boolean;
  skeletal: boolean;
  wildHunt: boolean;
  wildHuntUntil: number | null;
}

/** A side's force as a battle begins: its header (its name, its owner's colour, how it comes on) and one row per unit
 *  (forceMarker, battle-report-lines-and-force-markers.ts). Its words are the header's machine form, which the player
 *  page and the GM page draw as the force's rows. Its audience: the fight's. */
export interface AForceDrawnUpForBattle {
  kind: 'a force drawn up for battle';
  name: string;
  color: string | null;
  neutral: boolean;
  guard: boolean;
  role: string;
  verb: string;
  armies: AUnitOfAForceDrawnUp[];
}

/** Where a battle's losses tally goes (emitBattle files it after the battle's lines): the views work the tally out from
 *  the words of the battle's lines, and put it where the casualty lists begin, or leave it out when there is none to
 *  tally. It has no words of its own. Its audience: the fight's. */
export interface ABattlesLossesTalliedFromItsLines {
  kind: "a battle's losses, tallied from its lines";
}

/** One sentence of a battle's lines, each with its kind: one kind per sentence, one field per value it was written
 *  with. Their audience: the fight's. */
export type TheFactOfOneOfABattlesSentences =
  | {
      kind: "the attacker's lightning advance catches the defender unready";
      atkName: AValueInALinesWords;
      defName: AValueInALinesWords;
    }
  | {
      kind: 'the attacker moves into the province and a battle is initiated';
      atkName: string;
      attackersRealmName: string;
      provName: string;
      heldByName: string;
    }
  | { kind: 'the battle for a province begins'; provName: string }
  | {
      kind: 'the province still cowers under a reign of fear';
      provName: string;
      terrorHeroName: string;
      reignOfFearMultiplier: number;
    }
  | { kind: 'the attacker is cut down before the lines join, and a captain takes command'; atkName: string }
  | { kind: 'the defender is slain before his army, and a veteran takes command'; defName: string }
  | { kind: "the attacker fights to win back his realm's capital"; atkName: string; provName: string }
  | {
      kind: "the attacker's siegecraft wears down the defenders' fortifications";
      atkName: string;
      siegecraftReduction: string;
    }
  | { kind: "the defender's host defends ground held justly"; defName: string }
  | { kind: "the defender's realm holds its own ground the harder"; defName: string; ownGroundDefencePct: number }
  | { kind: "the defender's banner of the realm rallies the home defence"; defName: string }
  | { kind: "the attacker's siege mastery halves the defenders' fortifications"; atkName: AValueInALinesWords }
  | { kind: 'the defenders fight on home ground' }
  | {
      kind: "a side's skeletal legions fight with fanaticism under their undead king";
      sideName: string;
      undeadKingFanaticismPct: number;
    }
  | { kind: "a side's monsters are driven to savage fury"; sideName: string }
  | { kind: "a side's skeletal legions know no fear"; sideName: string; undeadHeroFanaticismPct: number }
  | { kind: "the attacker's forces fight with fanatical zeal"; atkName: string }
  | { kind: 'the defenders fight with fanatical zeal on consecrated ground'; provName: string; defName: string }
  | { kind: "the defender's forces fight with fanatical zeal"; defName: string }
  | {
      kind: 'the caster casts a spell before the battle';
      casterName: string;
      spellName: string;
      schoolLabel: string;
      spellLevel: number;
      castChance: number;
      castRoll: number;
      castMark: string;
    }
  | { kind: 'the spell before the battle fizzles' }
  | {
      kind: "a fireball halves the enemy's strongest units";
      fireballTargetsWords: string;
      fireballHitUnitNames: string;
    }
  | { kind: "a telekinetic storm scatters the enemy commander's formations"; enemyCommanderName: string }
  | { kind: 'a telekinetic storm finds no tactical command to disrupt'; enemyCommanderName: string }
  | { kind: "a psychic blast severs the enemy commander's bond with his beasts"; enemyCommanderName: string }
  | { kind: 'a lightning bolt weakens enemy units'; unitCount: number; unitsPlural: string }
  | { kind: "a curse withers the enemy commander's skill"; enemyCommanderName: string; cursedSkillLabel: string }
  | {
      kind: "control undead turns an enemy undead unit to the caster's side";
      turnedUnitName: string;
      casterName: string;
    }
  | { kind: 'control undead finds no enemy undead to turn' }
  | { kind: 'a holy symbol weakens enemy undead units'; undeadUnitCount: number; undeadUnitsPlural: string }
  | { kind: 'a holy symbol finds no enemy undead to smite' }
  | { kind: 'spiritwrack halves enemy missile units'; missileUnitCount: number; missileUnitsPlural: string }
  | { kind: 'spiritwrack finds no enemy missile troops' }
  | {
      kind: "a unit's power gathers but never strikes";
      unitName: string;
      powerName: string;
      strikeChancePct: number;
      druidWords: string;
    }
  | { kind: 'a unit uses its power in battle'; unitName: string; powerName: string; powerFlavour: string }
  | { kind: "a unit's power hits all enemy units"; enemyUnitCount: number; damage: number }
  | { kind: "a unit's power hits one enemy unit"; struckUnitName: string; damage: number }
  | { kind: "the hero's archers find no target among the forest wardens"; heroName: string }
  | {
      kind: "the hero's archery volley begins";
      heroName: string;
      missileUnitCount: number;
      missileUnitsPlural: string;
      wordsIfDoubleVolleys: string;
      wordsIfOneMoreShot: string;
      wordsIfPreparedGround: string;
    }
  | {
      kind: "a unit's shot glances off its target";
      shooterName: AValueInALinesWords;
      targetUnitName: AValueInALinesWords;
      whyTheShotGlances: AValueInALinesWords;
    }
  | {
      kind: "a unit's shot weakens its target";
      shooterName: string;
      targetUnitName: string;
      damage: number;
      wordsIfFlying: string;
      wordsIfThickHide: string;
      wordsIfAbilityMultiplier: string;
      wordsIfSoftenedToTheLimit: string;
    }
  | {
      kind: "a unit's target is already softened as far as arrows allow";
      shooterName: AValueInALinesWords;
      targetUnitName: AValueInALinesWords;
    }
  | {
      kind: "a side's whale cohort sinks an enemy ship";
      sideName: AValueInALinesWords;
      targetUnitName: AValueInALinesWords;
    }
  | { kind: "the terrain's effect on each side"; terrain: string; terrainNotes: string }
  | {
      kind: 'hosts airborne over open water fight at a penalty';
      airborneHostsWords: string;
      seaAirborneLandPenalty: number;
      seaAirborneFlyerPenalty: number;
    }
  | { kind: 'land units fight at sea at a penalty'; seaLandPenalty: number }
  | {
      kind: "a side's realm discoveries strengthen its army";
      sideName: AValueInALinesWords;
      discoveriesBonusPct: AValueInALinesWords;
    }
  | { kind: "the illusory ground of the province confuses a side's forces"; provName: string; sideName: string }
  | {
      kind: "the sanctuary wards of the province sap a side's attackers";
      provName: AValueInALinesWords;
      sideName: AValueInALinesWords;
    }
  | { kind: 'the attacker unfolds a grand stratagem'; atkName: string }
  | { kind: 'the defender unfolds a grand stratagem'; defName: AValueInALinesWords }
  | { kind: "the defender's feigned retreat springs shut"; defName: AValueInALinesWords }
  | { kind: 'the attacker storms ashore in a raid on the coast'; atkName: AValueInALinesWords }
  | {
      kind: "the consecrated ground of the province weakens the attacker's host";
      provName: string;
      atkName: string;
      attackersAlignment: string;
    }
  | { kind: "the battle's statistics begin" }
  | { kind: 'the fortune of the battle'; fortuneWords: string }
  | { kind: "the battle's outcome and its margin"; winnerName: string; severity: string; marginPct: string }
  | {
      kind: "a side's war-horn of the plains lets its free lances ride in rough country";
      sideName: AValueInALinesWords;
      terrain: AValueInALinesWords;
    }
  | { kind: "a side's free lances find no room to ride"; sideName: string; terrain: string }
  | {
      kind: "the loser's dwarven guard leave the manticore pride nothing to hunt";
      loserName: string;
      winnerName: string;
    }
  | {
      kind: "the winner's manticore pride hunt the broken companies";
      winnerName: string;
      runThemDownPct: number;
      loserName: string;
    }
  | {
      kind: "the loser's dwarven guard leave the shark shoals nothing in the water";
      loserName: AValueInALinesWords;
      winnerName: AValueInALinesWords;
    }
  | {
      kind: "the winner's shark shoals tear into the beaten crews";
      winnerName: AValueInALinesWords;
      loserName: AValueInALinesWords;
      runThemDownPct: AValueInALinesWords;
      loserName2: AValueInALinesWords;
    }
  | { kind: 'a unit is cut down with no escape'; unitName: string }
  | { kind: "a side's other forces survive the engagement"; allOrAllOther: string }
  | { kind: 'no units were left on the field to count' }
  | {
      kind: 'the attacker wins the battle and seizes the province';
      severityArticle: string;
      severity: string;
      atkName: string;
      winVerb: string;
      defName: string;
      provName: string;
    }
  | { kind: "the attacker's casualties begin"; atkName: string }
  | { kind: "the defender's casualties begin"; defName: string }
  | { kind: "the loser's dwarven guard leave the free lances no broken backs"; loserName: string; winnerName: string }
  | {
      kind: "the winner's free lances ride down the broken companies";
      winnerName: string;
      rideDownPct: number;
      loserName: string;
    }
  | { kind: "the loser's dwarven guard leave the warg riders no broken backs"; loserName: string; winnerName: string }
  | {
      kind: "the winner's warg riders run down the broken companies";
      winnerName: string;
      runThemDownPct: number;
      loserName: string;
    }
  | {
      kind: "the winner's corsairs close the sea lanes to the loser";
      winnerName: AValueInALinesWords;
      loserName: AValueInALinesWords;
    }
  | { kind: "the loser's skeletal host stands its ground in a deathless march"; loserName: string; provName: string }
  | { kind: "the loser's dwarven guard hold a shield fort with no road out"; loserName: string; provName: string }
  | { kind: 'the defender has nowhere to retreat'; defName: string }
  | {
      kind: "the defender's stronger host is pushed back but stays";
      defName: string;
      stayingHostStrength: string;
      victorsStrength: string;
      provName: string;
    }
  | { kind: "the loser's force is destroyed to the last"; loserName: string }
  | { kind: "the loser's dwarven guard withdraw behind a shield fort"; loserName: string }
  | { kind: 'the loser retreats to a province'; loserName: string; retreatToName: string }
  | { kind: "the loser's surviving forces"; loserName: string; survivingForces: string }
  | { kind: "the loser's forces are completely destroyed and he retreats alone"; loserName: string }
  | {
      kind: "the attacker wins the battle but the defender's survivors hold the province";
      severityArticle: string;
      severity: string;
      atkName: string;
      winVerb: string;
      defName: string;
      defName2: string;
      provName: string;
    }
  | {
      kind: "the attacker's assault is repelled and driven from the province";
      atkName: string;
      severityArticle: string;
      severity: string;
      defName: string;
      provName: string;
    }
  | { kind: 'the attacker has nowhere to retreat'; atkName: string; howTheyAreCutDown: string }
  | {
      kind: "the attacker's stronger host is thrown back but stays";
      atkName: string;
      stayingHostStrength: string;
      victorsStrength: string;
      provName: string;
    }
  | {
      kind: "the attacker's assault is repelled but not driven from the province";
      atkName: string;
      severityArticle: string;
      severity: string;
      defName: string;
      provName: string;
    }
  | { kind: "a commander's force is demoralised"; commanderName: string; why: string }
  | {
      kind: 'a commander rides out and challenges the other to single combat';
      challengerName: string;
      challengedName: string;
    }
  | { kind: 'the challenged commander will not answer the call'; challengedName: string }
  | { kind: 'a personal duel before the battle begins'; challengerName: string; challengedName: string }
  | { kind: "the duel's loser falls at death's door but is not slain"; loserName: string }
  | { kind: "the duel's loser is slain"; loserName: string }
  | { kind: 'the duel ends inconclusively' };

/** The facts a battle's lines record. */
export type TheFactOfABattlesLine =
  AForceDrawnUpForBattle | ABattlesLossesTalliedFromItsLines | TheFactOfOneOfABattlesSentences;

/** The place of a battle's losses tally, as emitBattle files it. */
export const THE_PLACE_OF_A_BATTLES_LOSSES_TALLY: ABattlesLossesTalliedFromItsLines = {
  kind: "a battle's losses, tallied from its lines",
};

/** Each kind's audience: the fight's (its type says so, so a kind given another is a compile error). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_A_BATTLES_LINE: Readonly<
  Record<TheFactOfABattlesLine['kind'], Extract<TheAudienceOfAKindOfLine, "the fight's">>
> = {
  'a force drawn up for battle': "the fight's",
  "a battle's losses, tallied from its lines": "the fight's",
  "the attacker's lightning advance catches the defender unready": "the fight's",
  'the attacker moves into the province and a battle is initiated': "the fight's",
  'the battle for a province begins': "the fight's",
  'the province still cowers under a reign of fear': "the fight's",
  'the attacker is cut down before the lines join, and a captain takes command': "the fight's",
  'the defender is slain before his army, and a veteran takes command': "the fight's",
  "the attacker fights to win back his realm's capital": "the fight's",
  "the attacker's siegecraft wears down the defenders' fortifications": "the fight's",
  "the defender's host defends ground held justly": "the fight's",
  "the defender's realm holds its own ground the harder": "the fight's",
  "the defender's banner of the realm rallies the home defence": "the fight's",
  "the attacker's siege mastery halves the defenders' fortifications": "the fight's",
  'the defenders fight on home ground': "the fight's",
  "a side's skeletal legions fight with fanaticism under their undead king": "the fight's",
  "a side's monsters are driven to savage fury": "the fight's",
  "a side's skeletal legions know no fear": "the fight's",
  "the attacker's forces fight with fanatical zeal": "the fight's",
  'the defenders fight with fanatical zeal on consecrated ground': "the fight's",
  "the defender's forces fight with fanatical zeal": "the fight's",
  'the caster casts a spell before the battle': "the fight's",
  'the spell before the battle fizzles': "the fight's",
  "a fireball halves the enemy's strongest units": "the fight's",
  "a telekinetic storm scatters the enemy commander's formations": "the fight's",
  'a telekinetic storm finds no tactical command to disrupt': "the fight's",
  "a psychic blast severs the enemy commander's bond with his beasts": "the fight's",
  'a lightning bolt weakens enemy units': "the fight's",
  "a curse withers the enemy commander's skill": "the fight's",
  "control undead turns an enemy undead unit to the caster's side": "the fight's",
  'control undead finds no enemy undead to turn': "the fight's",
  'a holy symbol weakens enemy undead units': "the fight's",
  'a holy symbol finds no enemy undead to smite': "the fight's",
  'spiritwrack halves enemy missile units': "the fight's",
  'spiritwrack finds no enemy missile troops': "the fight's",
  "a unit's power gathers but never strikes": "the fight's",
  'a unit uses its power in battle': "the fight's",
  "a unit's power hits all enemy units": "the fight's",
  "a unit's power hits one enemy unit": "the fight's",
  "the hero's archers find no target among the forest wardens": "the fight's",
  "the hero's archery volley begins": "the fight's",
  "a unit's shot glances off its target": "the fight's",
  "a unit's shot weakens its target": "the fight's",
  "a unit's target is already softened as far as arrows allow": "the fight's",
  "a side's whale cohort sinks an enemy ship": "the fight's",
  "the terrain's effect on each side": "the fight's",
  'hosts airborne over open water fight at a penalty': "the fight's",
  'land units fight at sea at a penalty': "the fight's",
  "a side's realm discoveries strengthen its army": "the fight's",
  "the illusory ground of the province confuses a side's forces": "the fight's",
  "the sanctuary wards of the province sap a side's attackers": "the fight's",
  'the attacker unfolds a grand stratagem': "the fight's",
  'the defender unfolds a grand stratagem': "the fight's",
  "the defender's feigned retreat springs shut": "the fight's",
  'the attacker storms ashore in a raid on the coast': "the fight's",
  "the consecrated ground of the province weakens the attacker's host": "the fight's",
  "the battle's statistics begin": "the fight's",
  'the fortune of the battle': "the fight's",
  "the battle's outcome and its margin": "the fight's",
  "a side's war-horn of the plains lets its free lances ride in rough country": "the fight's",
  "a side's free lances find no room to ride": "the fight's",
  "the loser's dwarven guard leave the manticore pride nothing to hunt": "the fight's",
  "the winner's manticore pride hunt the broken companies": "the fight's",
  "the loser's dwarven guard leave the shark shoals nothing in the water": "the fight's",
  "the winner's shark shoals tear into the beaten crews": "the fight's",
  'a unit is cut down with no escape': "the fight's",
  "a side's other forces survive the engagement": "the fight's",
  'no units were left on the field to count': "the fight's",
  'the attacker wins the battle and seizes the province': "the fight's",
  "the attacker's casualties begin": "the fight's",
  "the defender's casualties begin": "the fight's",
  "the loser's dwarven guard leave the free lances no broken backs": "the fight's",
  "the winner's free lances ride down the broken companies": "the fight's",
  "the loser's dwarven guard leave the warg riders no broken backs": "the fight's",
  "the winner's warg riders run down the broken companies": "the fight's",
  "the winner's corsairs close the sea lanes to the loser": "the fight's",
  "the loser's skeletal host stands its ground in a deathless march": "the fight's",
  "the loser's dwarven guard hold a shield fort with no road out": "the fight's",
  'the defender has nowhere to retreat': "the fight's",
  "the defender's stronger host is pushed back but stays": "the fight's",
  "the loser's force is destroyed to the last": "the fight's",
  "the loser's dwarven guard withdraw behind a shield fort": "the fight's",
  'the loser retreats to a province': "the fight's",
  "the loser's surviving forces": "the fight's",
  "the loser's forces are completely destroyed and he retreats alone": "the fight's",
  "the attacker wins the battle but the defender's survivors hold the province": "the fight's",
  "the attacker's assault is repelled and driven from the province": "the fight's",
  'the attacker has nowhere to retreat': "the fight's",
  "the attacker's stronger host is thrown back but stays": "the fight's",
  "the attacker's assault is repelled but not driven from the province": "the fight's",
  "a commander's force is demoralised": "the fight's",
  'a commander rides out and challenges the other to single combat': "the fight's",
  'the challenged commander will not answer the call': "the fight's",
  'a personal duel before the battle begins': "the fight's",
  "the duel's loser falls at death's door but is not slain": "the fight's",
  "the duel's loser is slain": "the fight's",
  'the duel ends inconclusively': "the fight's",
};
