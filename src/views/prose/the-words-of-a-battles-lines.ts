// ── THE WORDS OF A BATTLE'S LINES (plan P1-12c3, c5 and c6: P1-12's Decisions of 2026-10-24, Decisions 2 and 5) ──
// The views write the words of each fact a battle's lines record (src/engine/battle/the-facts-a-battles-lines-record.ts),
// after the engine, in the same words the engine wrote before. A kind with no words here is a compile error (the
// `never` below) and, from an untyped caller, a throw in play.
import { theRealmsTag } from './the-words-of-the-realm-works-orders-lines.ts';
import {
  THE_NUMBER_OF_VERBS_A_VICTORY_IS_TOLD_WITH,
  THE_NUMBER_OF_VERBS_AN_ATTACK_IS_TOLD_WITH,
  type ABattleIsDecided,
  type AContestForAProvinceIsDecided,
  type AUnitsFateInTheBattle,
  type ABeatenGuardsSurvivingUnitsFate,
  type ACommandMultiplierInTheLadder,
  type ASideAsABattlesReportLinesNameIt,
  type ASideOfABattle,
  type AUnitAsALineNamesIt,
  type TheDefendersOfAProvince,
  type ACommandMultiplierOfAUnit,
  type AFacingAsTheLadderTellsIt,
  type AForceWideModifierInTheLadder,
  type AModifierOfAUnitInTheLadder,
  type ASidesTacticalInTheLadder,
  type AUnitAsTheGridNamesIt,
  type AUnitsModifierInTheLadder,
  type AUnitsPlaceAsTheLadderTellsIt,
  type WhatLiftsAUnitsQuality,
  type WhomAUnitFaced,
  type WhomAUnitMeets,
  type WhyAUnitFacesAsItDoes,
  type WhyAUnitStandsWhereItDoes,
  type AUnitTheTerrainMarks,
  type AUnitsDruidShortfall,
  type TheClausesOfAShotThatWeakensItsTarget,
  type TheFactOfABattlesLine,
  type TheFortuneAsTheLineTellsIt,
  type TheSeverityOfABattle,
  type HowAForceComesOnInItsHeader,
  type TheForceABattlesHeaderNames,
  type WhyACommandersForceIsDemoralised,
} from '../../engine/battle/the-facts-a-battles-lines-record.ts';
import { describeArmy } from '../../engine/dice-and-army-names.ts';
import { ownedUnitName, unitRef } from '../../engine/army-tables.ts';
import { fortuneCdf, fortuneWinChance } from '../../engine/battle/fortune.ts';
import { dispFloor } from '../../engine/rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import type { UnitType } from '../../content/kingdoms-call-data.ts';
import {
  UNIT_ABILITIES_THE_REGISTRY_HOLDS,
  type AUnitAbilityAsTheBooksWriteIt,
  type UnitAbilitySlug,
} from '../../content/unit-abilities-their-names-numbers-and-words.ts';
import type { AnAbilityAsTheLadderNamesIt } from '../../engine/rules/the-registry-of-content-effects.ts';

// ── THE WORDS THE ENGINE WROTE INTO A BATTLE'S FACTS, WRITTEN HERE (plan P1-12d3: P1-12's Decisions of 2026-10-26,
// Decisions 2 to 5) ── each the same words, from the values the fact now holds; the word helpers below moved here
// from the engine with their last engine callers (aAn from battle/ladder.ts, n0 from army-tables.ts, curseSkillLabel
// from battle/terrain-and-unit-strength.ts, fortuneNarrative and its two edge helpers from battle/fortune.ts), and the
// table of a victory's verbs from battle/battles-against-province-defenders.ts.

/** A unit ability's name, as its content row holds it (Decision 5: a line names an ability from the content). */
function theNameOfTheAbility(slug: UnitAbilitySlug): string {
  return UNIT_ABILITIES_THE_REGISTRY_HOLDS[slug].name;
}

/** A side of a battle, as its label names it (plan P1-12d22; since P1-12d23 a hero's side against a province's
 *  defenders too; since P1-12d24 a host in a stalled battle and a hero's newly gathered host): its commander's name, or
 *  "<name>'s leaderless host" when he fell before the lines joined (the engine wrote it so: battles-between-heroes.ts,
 *  battles-against-province-defenders.ts, stalled-battles-and-beaten-guards.ts' forceLabel,
 *  hosts-gained-in-a-province.ts). */
function theLabelOfASide(side: ASideOfABattle): string {
  return side.leaderless ? `${side.heroName}'s leaderless host` : side.heroName;
}

/** The defenders of a province, as a battle against them names them (plan P1-12d23): their guard's name, with the
 *  words the line follows it with ("and their forces", "and the local defenders"), or the defenders with no guard to
 *  lead them, or the realm that holds the province (the engine wrote it so: battles-against-province-defenders.ts; since
 *  P1-12d24 stalled-battles-and-beaten-guards.ts and hosts-gained-in-a-province.ts' beaten guard). */
function theLabelOfTheDefenders(defenders: TheDefendersOfAProvince, afterTheGuardsName = ''): string {
  switch (defenders.kind) {
    case 'the defenders led by their guard':
      return defenders.guardName + afterTheGuardsName;
    case 'the defenders of a province with no guard to lead them':
      return `${defenders.capitalised ? 'The' : 'the'} defenders of ${defenders.provName}`;
    case "a realm's garrison of a province with no guard to lead it":
      return `the garrison of ${defenders.provName}`;
    case "a realm's garrison with no guard to lead it":
      return `${defenders.ownerName}'s garrison`;
    case 'neutral defenders with no guard to lead them':
      return 'its neutral defenders';
    case 'a leaderless garrison':
      return 'the leaderless garrison';
    case 'defenders with no guard to name them':
      return 'the defenders';
    case 'the realm that holds the province':
      return String(defenders.realmName);
  }
}

/** A defending side, as its label names it: a hero's side (a battle between heroes), or a province's defenders. */
function theLabelOfASideOrTheDefenders(defenders: ASideOfABattle | TheDefendersOfAProvince): string {
  return 'kind' in defenders ? theLabelOfTheDefenders(defenders) : theLabelOfASide(defenders);
}

/** A side as a battle's report lines name it (plan P1-12d30; the engine wrote it so: battles-between-heroes.ts and
 *  battles-against-province-defenders.ts handed ladderLines, kinNarrative, battleGridLines, battleScoutLine,
 *  battleMovesLine and druidShortfallLine the label, and since P1-12d31 applyFlakScreen and eyesOfTheForestLine): a side
 *  or a province's defenders as their labels name them, "<name>'s host", "the defenders of <province>" whoever leads
 *  them, "Guards", or "The defenders". */
function theLabelOfASideAsTheReportLinesNameIt(side: ASideAsABattlesReportLinesNameIt): string {
  if (!('kind' in side)) return theLabelOfASide(side);
  switch (side.kind) {
    case "a hero's host in the battle":
      return `${side.heroName}'s host`;
    case "a province's defenders, whoever leads them":
      return `the defenders of ${side.provName}`;
    case "a province's guards with no guard to name them":
      return 'Guards';
    case "a province's defenders with no guard to name them, as the lines before the volleys name them":
      return 'The defenders';
    default:
      return theLabelOfTheDefenders(side);
  }
}

/** The name a force's header gives (plan P1-12d29; the engine wrote it so: battles-between-heroes.ts and
 *  battles-against-province-defenders.ts, the realm's brackets only for a hero who serves one since P1-23a, and
 *  forceMarker the leaderless host): the hero and his realm, the guard, a realm's garrison at the province, or the
 *  province's defenders, " (wandering)" cut; "<his name>'s leaderless host" in place of the fallen commander's name
 *  where forceMarker found one. forceMarker's leaderless check reads a copy of these words
 *  (theNameAForcesHeaderIsCheckedBy). */
function theNameOfTheForceAHeaderNames(
  theForce: TheForceABattlesHeaderNames,
  fallenCommandersName: string | null,
): string {
  let name: string;
  switch (theForce.kind) {
    case 'a hero, with the realm he serves':
      name = `${theForce.heroName}${theForce.servesARealm ? ` (${String(theForce.realmName)})` : ''}`;
      break;
    case "a province's guard at the head of its force":
      name = theForce.guardName;
      break;
    case "a realm's garrison at a province":
      name = `${theForce.ownerName}'s garrison at ${theForce.provName}`;
      break;
    case "a province's own defenders with no one to lead them":
      name = `The defenders of ${theForce.provName}`;
      break;
  }
  name = name.replace(' (wandering)', '');
  return fallenCommandersName === null
    ? name
    : `${fallenCommandersName}'s leaderless host` + name.slice(fallenCommandersName.length);
}

/** A unit as a line names it (plan P1-12d25): its owner's label, then unitRef's form, ownedUnitName's, or its name or
 *  type alone (the engine wrote it so: battles-between-heroes.ts, battles-against-province-defenders.ts,
 *  hosts-gained-in-a-province.ts' beaten guard). */
function theLabelOfAUnit(unit: AUnitAsALineNamesIt): string {
  const owner = unit.owner ? theLabelOfASideOrTheDefenders(unit.owner) : null;
  switch (unit.kind) {
    case 'a unit named with its quality':
      return unitRef(owner, unit);
    case 'a unit named without its quality':
      return ownedUnitName(owner, unit);
    case 'a unit named by its name or type alone':
      return unit.unitName || unit.type;
  }
}

/** The verbs a victory is told with: the engine draws which (winVerbIndex), as many as it counts. Each reads
 *  "<name>'s forces <verb>" (2026-09-23b). */
const WIN_VERBS = ['rout', 'break', 'scatter', 'overwhelm', 'destroy'] as const satisfies {
  length: typeof THE_NUMBER_OF_VERBS_A_VICTORY_IS_TOLD_WITH;
};

/** The verb a victory is told with, by the index the engine drew. */
function theVerbAVictoryIsToldWith(index: number): string {
  return WIN_VERBS[index] ?? '';
}

/** The verbs an attack on a province is told with in its force's header: the engine draws which against a province's
 *  defenders (verbIndex), as many as it counts; a hero's host attacking another's is told with "attacks" (P1-12d20:
 *  the table moved here from battle/battles-against-province-defenders.ts, ATK_VERBS). */
const THE_VERBS_AN_ATTACK_IS_TOLD_WITH = [
  'advances on',
  'charges into',
  'storms',
  'attacks',
  'assaults',
  'drives into',
] as const satisfies { length: typeof THE_NUMBER_OF_VERBS_AN_ATTACK_IS_TOLD_WITH };

/** The verbs a defence is told with in its force's header (P1-12d20: the table moved here, DEF_VERBS): a hero holds the
 *  line in a province, a province's own defenders stand firm in it. */
const THE_VERBS_A_DEFENCE_IS_TOLD_WITH = [
  'holds the line in',
  'stands firm in',
  'defends',
  'fortifies',
  'guards',
] as const;

/** The verb of a force's header: "storms Highmoor under Tactical 2 command — army strength 40, with" (the Tactical clause
 *  only where the header names a level above 0). */
function theWordsOfHowAForceComesOn(how: HowAForceComesOnInItsHeader): string {
  const verbs: readonly string[] =
    how.itsVerbs === 'an attack' ? THE_VERBS_AN_ATTACK_IS_TOLD_WITH : THE_VERBS_A_DEFENCE_IS_TOLD_WITH;
  const tactical =
    how.tacticalLevel !== null && how.tacticalLevel > 0 ? ` under Tactical ${String(how.tacticalLevel)} command` : '';
  return `${verbs[how.verbIndex] ?? ''} ${how.provName}${tactical} — army strength ${String(how.armyStrength)}, with`;
}

/** The words of a battle's severity, by its margin band's slug (P1-12d20: the band's label was the word). */
const THE_WORDS_OF_A_BATTLES_SEVERITY: Readonly<Record<TheSeverityOfABattle, string>> = {
  pyrrhic: 'pyrrhic',
  narrow: 'narrow',
  clear: 'clear',
  decisive: 'decisive',
  crushing: 'crushing',
  annihilating: 'annihilating',
};

/** "a pyrrhic", "an annihilating": a battle's severity in words, with its article. */
function aSeverity(severity: TheSeverityOfABattle): string {
  const w = THE_WORDS_OF_A_BATTLES_SEVERITY[severity];
  return `${aAn(w)} ${w}`;
}

/** "a" or "an" before a word: "an annihilating battle". */
function aAn(w: string | null | undefined) {
  return /^[aeiou]/i.test(w ?? '') ? 'an' : 'a';
}

// ── DISPLAY ROUNDING ────
// Battle maths is done in floats (flank ×0.5, tactical ×1.2, dice = kcRng()*range), but a
// player report should never show a decimal — "roll 7.2384719283" is noise, not information. n0()
// is a DISPLAY-ONLY rounder: use it on every number interpolated into narrative/log text. It must
// NEVER be used on a value that feeds back into the maths, and it is deliberately NOT applied to
// multipliers — "× tactical ×1.2" rounded to "×1" would be meaningless.
function n0(x: unknown): string {
  const v = Number(x);
  return Number.isFinite(v) ? String(Math.round(v)) : String(x);
}

/** The name of the skill a Curse withers. */
function curseSkillLabel(stat: string | null | undefined) {
  return stat === 'naval' ? 'Naval command' : stat === 'druid' ? 'Druid mastery' : 'Tactical command';
}

// ── FORTUNE NARRATIVE ── the report no longer prints "strength × fortune 0.50 = …" per side
// (players read that as their army being weakened). Strengths are shown untouched; fortune is
// described as what it did to the EDGE: the pre-fortune ratio and win chance, which side luck ran
// with and how rare the roll was, and the post-fortune edge.
function fortuneEdgeNum(r: number) {
  const e = r >= 1 ? r : r > 0 ? 1 / r : Infinity;
  return !isFinite(e) ? '∞×' : `${e >= 10 ? e.toFixed(0) : e.toFixed(1)}×`;
}
function fortuneEdgeText(r: number) {
  const e = r >= 1 ? r : r > 0 ? 1 / r : Infinity;
  if (!isFinite(e)) return 'total superiority';
  if (e < 1.05) return 'an even match';
  return `a ${fortuneEdgeNum(r)} edge`;
}
function fortuneNarrative(
  atkLabel: string,
  defLabel: string,
  atkBase: number,
  defBase: number,
  fort: TheFortuneAsTheLineTellsIt,
) {
  if (!(defBase > 0)) return `${atkLabel} meets no effective resistance — **${atkLabel} wins**.`;
  if (!(atkBase > 0)) return `${atkLabel} brings no effective strength — **${defLabel} wins**.`;
  const r0 = atkBase / defBase,
    r1 = (atkBase * fort.atk) / (defBase * fort.def);
  const favoured = r0 >= 1 ? atkLabel : defLabel,
    winner = r1 >= 1 ? atkLabel : defLabel;
  const pAtk = fortuneWinChance(r0),
    pFav = r0 >= 1 ? pAtk : 1 - pAtk;
  const edge = `${favoured} holds ${fortuneEdgeText(r0)} (${String(dispFloor(pFav * 100))}% to win)`;
  const S = fort.S || 0,
    small = Math.abs(S) < Math.log(1.15);
  let luck;
  if (small) luck = `Fortune of battle: an even roll — luck played little part`;
  else {
    const side = S > 0 ? atkLabel : defLabel,
      tail = S > 0 ? 1 - fortuneCdf(S) : fortuneCdf(S);
    const adv = tail <= 0.05 ? 'strongly' : tail <= 0.2 ? 'firmly' : 'mildly';
    const rare =
      tail < 0.25 ? ` (a 1-in-${String(Math.min(1000, Math.max(4, Math.round(1 / Math.max(tail, 1e-4)))))} roll)` : '';
    luck = `Fortune of battle: luck ran ${adv} with ${side}${rare}`;
  }
  let outcome;
  if (winner === favoured) {
    const luckWithWinner = S > 0 === (winner === atkLabel);
    outcome = small
      ? ` — **${winner} wins**.`
      : luckWithWinner
        ? ` and widened the edge to ${fortuneEdgeNum(r1)} — **${winner} wins**.`
        : ` and trimmed the edge to ${fortuneEdgeNum(r1)} — not enough: **${winner} wins**.`;
  } else outcome = ` and overturned it — ${winner} finishes ${fortuneEdgeNum(r1)} ahead and **wins**.`;
  return `${edge}. ${luck}${outcome}`;
}
/** A name, else the words that stand for it when it has none (an empty name included). */
function theNameOrElse(name: string | null | undefined, otherwise: string): string {
  if (name) return name;
  return otherwise;
}

/** Units counted by their words, in the order each is first met: "2× Forest Ents −40%, Free Lances +15%". */
function countedByTheirWords(words: readonly string[]): string {
  const m = new Map<string, number>();
  words.forEach((k) => m.set(k, (m.get(k) ?? 0) + 1));
  return [...m].map(([k, c]) => (c > 1 ? `${String(c)}× ${k}` : k)).join(', ');
}

/** The units short of their commander's Druid, counted by type and shortfall (2026-09-23d: one line). */
function theWordsOfTheDruidShortfalls(shortfalls: readonly AUnitsDruidShortfall[]): string {
  return countedByTheirWords(shortfalls.map((u) => `${u.unitType} −${String(dispFloor((1 - u.penalty) * 100))}%`));
}

/** The units the ground marks, counted by type and how it marks them (2026-09-23d: both battle paths share it). */
function theWordsOfTheUnitsTheTerrainMarks(marked: readonly AUnitTheTerrainMarks[]): string {
  return countedByTheirWords(
    marked.map(
      (u) => `${u.unitType} ${u.multiplier > 1 ? '+' : '−'}${String(dispFloor(Math.abs(u.multiplier - 1) * 100))}%`,
    ),
  );
}

/** What a shot that weakens its target adds to its line, in this order. */
function theClausesOfTheShot(shot: TheClausesOfAShotThatWeakensItsTarget): string {
  return `${shot.againstAFlyer ? ' (×2 vs flying!)' : ''}${shot.thickHideHalvesIt ? ` (${theNameOfTheAbility('thick-hide')}: half)` : ''}${shot.shootersAbilityMultiplier > 1 ? ` (${shot.shootersUnitType} ability ×${shot.shootersAbilityMultiplier.toFixed(2)})` : ''}${shot.softenedToTheLimit ? ' (softened to the limit)' : ''}`;
}

/** The Druid's level a unit's strike was rolled at, or that none commands it. */
function theDruidAStrikeIsRolledAt(druidLevel: number): string {
  return druidLevel > 0 ? `, Druid ${String(druidLevel)}` : ', no commanding Druid';
}

/** "All" the forces survive, or "All other" when some unit's fate is told above. */
function allOrAllOther(someUnitsFateIsToldAbove: boolean): string {
  return someUnitsFateIsToldAbove ? 'All other' : 'All';
}

/** A battle's margin as a percentage of the strength on the field. */
function theMarginInPercent(margRatio: number): string {
  return (margRatio * 100).toFixed(0);
}

/** A unit as the overrun garrison's line names it: "Name (Type, Quality)", or "Quality Type" for a unit of no name. */
function aUnitOfTheGarrison(a: {
  readonly unitName?: string | undefined;
  readonly type: string;
  readonly quality: string;
}) {
  return a.unitName ? a.unitName + ' (' + a.type + ', ' + a.quality + ')' : a.quality + ' ' + a.type;
}

/** Kinship's counts in words, joined (P1-12c6's kinNarrative wrote them so). */
function theWordsOfKinship(both: number, kingOnly: number, leadOnly: number): string {
  const parts: string[] = [];
  if (both)
    parts.push(
      `${String(both)} unit${both !== 1 ? 's' : ''} of the king's own race under a commander of that blood (+44% strength)`,
    );
  if (kingOnly) parts.push(`${String(kingOnly)} unit${kingOnly !== 1 ? 's' : ''} of the king's race (+20%)`);
  if (leadOnly) parts.push(`${String(leadOnly)} unit${leadOnly !== 1 ? 's' : ''} of their commander's race (+20%)`);
  return parts.join('; ');
}

/** Why the scouting side scouts: it has explored more of the ground, else neither has and the defender's claim stands
 *  (2026-10-13, Toby, item 17: which side, never the figures). */
function whyItScouts(itsSideHasExploredMore: boolean, scoutName: string, otherSideName: string): string {
  return itsSideHasExploredMore
    ? `knows the ground better (${scoutName}'s side has explored more of it than ${otherSideName}'s)`
    : `knows the ground as well as the enemy (neither side has explored more of it), and the defender's claim stands`;
}

/** What the scout does with the front the dice allowed. */
function whatItDoesWithTheFront(W: number, roll: number): string {
  return W === roll
    ? `takes the front of ${String(W)} the dice allow`
    : W > roll
      ? `widens the front from ${String(roll)} to ${String(W)}`
      : `narrows the front from ${String(roll)} to ${String(W)}`;
}

/** How many times a side shifts its line, in words. */
function theShiftsOfALine(k: number): string {
  return k === 0
    ? 'holds the line as it stands'
    : k === 1
      ? 'shifts the line once'
      : k === 2
        ? 'shifts the line twice'
        : `shifts the line ${String(k)} times`;
}

// ── THE WORDS OF THE STRENGTH LADDER AND THE BATTLE GRID (plan P1-12d4: P1-12's Decisions of 2026-10-26, Decisions 2,
// 3, 5 and 8, Choice 2) ── written here from what the ladder's and the grid's lines record: each modifier's words (the
// labels armStr, the battles and the ladder composed), each unit's short code, the ground's words, each place and
// facing, and each ability's name from its content row. The word helpers below moved here from the engine with their
// last engine callers (ladderFm from battle/a-multiplier-written-as-the-strength-ladder-shows-it.ts; UNIT_SHORT,
// shortUnit, GROUND_WORDS, battleGridStage and battleFacingStage from battle/lines.ts), and the ladder's grouping of
// its modifiers from battle/ladder.ts, which grouped them by their words.

// A multiplier written as the strength ladder shows it (×1.4, ×1.375).
export function ladderFm(v: number) {
  let t = v.toFixed(3);
  while (t.endsWith('0') && !/\.\d$/.test(t)) t = t.slice(0, -1);
  return '×' + t;
} // ×1.4, ×2.0, ×1.44, ×1.375 — exact to 3 dp so the ladder can be checked by hand

/** A count and its noun, "1 unit", "3 units". */
const pl = (n: number, w: string) => `${String(n)} ${w}${n !== 1 ? 's' : ''}`;

// Short unit codes for the grid print (5 characters; a type not listed uses its first 5 letters).
export const UNIT_SHORT: Readonly<Record<string, string | undefined>> = {
  'Shieldwall Levies': 'Levy',
  'Free Lances': 'FreeL',
  'Yeoman Longbows': 'Bow',
  'Gilded Lances': 'Gild',
  'Noble Griffons': 'Grif',
  'Galleon Fleet': 'Gall',
  'Corsair Fleet': 'Cors',
  'Human Garrison': 'Garr',
  'Men-at-Arms': 'MaA',
  'Elven Bowmen': 'EBow',
  'Forest Wardens': 'Ward',
  'Shadow Archers': 'Shad',
  'Eagle Riders': 'Eagl',
  'Elven Galleys': 'Gally',
  'Elven Garrison': 'Garr',
  'Stag Riders': 'Stag',
  'Dwarven Guard': 'Guard',
  'Ironwood Crossbows': 'Xbow',
  'Mountain Guns': 'Gun',
  'Gnomish Gyrocopters': 'Gyro',
  'Dwarf Ironclads': 'Iron',
  'Dwarf Garrison': 'Garr',
  'Ironhoof Rams': 'Ram',
  'Warg Riders': 'Warg',
  'Orc Berserkers': 'Bers',
  'Goblin Horde': 'Gob',
  'Wyvern Riders': 'Wyv',
  'Orcish Longships': 'Long',
  'Orc Garrison': 'Garr',
  'Black Arrows': 'BlkAr',
  'Whale Cohort': 'Whale',
  'Shark Shoals': 'Shark',
  'Great Bears': 'Bear',
  'Unicorn Herd': 'Unicn',
  'Mammoth Host': 'Mamth',
  'Great Turtles': 'Turtl',
  'Stone Giants': 'Giant',
  'Forest Ents': 'Ent',
  Thunderbirds: 'Thund',
  'Crimson Rocs': 'Roc',
  'Cave Trolls': 'Troll',
  'Manticore Pride': 'Manti',
  'Basilisk Brood': 'Basil',
  'Sea Giants': 'SeaGt',
  'Eldritch Kraken': 'Krakn',
  'Elder Dragons': 'Drago',
  'Titan Warbeasts': 'Titan',
  'Dread Hydras': 'Hydra',
  'Air Elemental': 'AirEl',
  'Fire Elemental': 'FirEl',
  'Earth Elemental': 'ErtEl',
  'Water Elemental': 'WatEl',
  'Darkness Elemental': 'DrkEl',
} satisfies Record<UnitType, string>;
export function shortUnit(row: AUnitAsTheGridNamesIt | null | undefined) {
  const t = (row?.a ? row.a.type : '') || (row?.name ?? '') || 'unit'; // a type or a name that is '' reads the next
  return UNIT_SHORT[t] ?? t.replace(/[^A-Za-z]/g, '').slice(0, 5);
}
// The ground as the width line names it, and its verb.
export const GROUND_WORDS: Readonly<Record<string, readonly [string, string] | undefined>> = {
  plain: ['open ground', 'allows'],
  desert: ['desert', 'allows'],
  forest: ['forest', 'allows'],
  jungle: ['jungle', 'allows'],
  mountain: ['mountains', 'allow'],
  sea: ['open water', 'allows'],
};

/** An ability as the strength ladder names it: its row's words in the ladder, its name with the factor its words show,
 *  or its name (Decision 5: a line names an ability from the content). */
export function theWordsOfAnAbilityInTheLadder(ability: AnAbilityAsTheLadderNamesIt): string {
  const row: AUnitAbilityAsTheBooksWriteIt = UNIT_ABILITIES_THE_REGISTRY_HOLDS[ability.slug];
  if (ability.wordsInTheLadder !== undefined) return row.wordsInTheLadder?.[ability.wordsInTheLadder] ?? row.name;
  if (ability.factor !== undefined) return `${row.name} ×${ability.factor.toFixed(1)}`;
  return row.name;
}

/** Each ability that moved a figure, each after ", ". */
function theAbilitiesAfterCommas(abilities: readonly AnAbilityAsTheLadderNamesIt[]): string {
  return abilities.map((n) => ', ' + theWordsOfAnAbilityInTheLadder(n)).join('');
}

/** Why a unit stands where it does in its grid (battleRegrid), in words. */
export function theWordsOfWhyAUnitStandsWhereItDoes(why: WhyAUnitStandsWhereItDoes): string {
  switch (why.kind) {
    case 'its ability gives it its place':
      return why.itsLine === 'front'
        ? `${theNameOfTheAbility(why.ability.slug)} in the front line`
        : `${theNameOfTheAbility(why.ability.slug)}: full strength from the second line`;
    case 'a ranged unit in the front line':
      return 'ranged in the front line';
    case 'a unit in the front line':
      return 'front line';
    case 'a ranged unit shooting over its fighter':
      return 'shooting over the ' + shortUnit(why.theFighter);
    case 'a unit in the second line':
      return 'second line';
    case 'a unit in the reserve':
      return 'reserve';
    case 'a unit in the deep reserve':
      return 'deep reserve';
    case 'a rider on the flank':
      return 'on the flank';
    case 'a flyer in the air':
      return 'in the air';
    case 'a flyer in the air beyond the line':
      return 'in the air, beyond the line';
  }
}

/** Whom a unit meets, in words, after its own name. */
function theWordsOfWhomAUnitMeets(meets: WhomAUnitMeets): string {
  switch (meets.kind) {
    case 'it faces a unit':
      return ` v ${shortUnit(meets.theOther)}${theAbilitiesAfterCommas(meets.abilities)}`;
    case 'it is met by a rider':
      return ` met by ${shortUnit(meets.theOther)}${theAbilitiesAfterCommas(meets.abilities)}`;
    case "it wraps the line's end":
      return ' wraps the end';
    case 'it shoots a unit':
      return ` shoots ${shortUnit(meets.theOther)}${theAbilitiesAfterCommas(meets.abilities)}`;
    case 'it shoots at an empty column':
      return ' shoots at an empty column';
    case 'it duels a rider':
      return ` duels ${shortUnit(meets.theOther)}${theAbilitiesAfterCommas(meets.abilities)}`;
    case "it guards the line's end":
      return ` guards the end v ${meets.theOther ? shortUnit(meets.theOther) : 'nobody'}${theAbilitiesAfterCommas(meets.abilities)}`;
    case 'it rides free':
      return ' rides free';
  }
}

/** Why a unit fights at its facing's multiplier (battleFaceSide), in words: "Levy v Bow, Halberds, hit from the side". */
export function theWordsOfWhyAUnitFacesAsItDoes(why: WhyAUnitFacesAsItDoes): string {
  let words = shortUnit(why.theUnit);
  if (why.meets) words += theWordsOfWhomAUnitMeets(why.meets);
  if (why.atAWrappedEnd)
    words +=
      why.atAWrappedEnd.heldBy !== null ? `, ${theNameOfTheAbility(why.atAWrappedEnd.heldBy)}` : ', hit from the side';
  if (why.flankTurned)
    words +=
      why.flankTurned.byAnAbility !== null
        ? `, flank turned (${theNameOfTheAbility(why.flankTurned.byAnAbility)})`
        : ', flank turned';
  words += theAbilitiesAfterCommas(why.itsOwnAbilities);
  words += theAbilitiesAfterCommas(why.marks);
  return words;
}

// The ladder's Battle-lines stage: every unit's place and multiplier, grouped.
export function battleGridStage(g: { readonly units: readonly AUnitsPlaceAsTheLadderTellsIt[] }) {
  const groups = new Map<string, string[]>();
  g.units.forEach((u) => {
    const k = `${u.place} ×${String(u.mult)}`;
    const group = groups.get(k);
    if (group) group.push(shortUnit(u.row));
    else groups.set(k, [shortUnit(u.row)]);
  });
  return [...groups].map(([k, v]) => `${k}: ${v.join(', ')}`).join('; ');
}

// The ladder's stage: every matchup that moved a figure, grouped, then how many stood even.
export function battleFacingStage(
  g: { readonly face?: { readonly units: readonly AFacingAsTheLadderTellsIt[] } | null | undefined } | null | undefined,
) {
  const f = g?.face;
  if (!f) return '';
  const groups = new Map<string, number>();
  let even = 0;
  f.units.forEach((u) => {
    if (Math.abs(u.m - 1) < 1e-9) {
      even++;
      return;
    }
    const k = `${theWordsOfWhyAUnitFacesAsItDoes(u.why)} ${ladderFm(u.m)}`;
    groups.set(k, (groups.get(k) ?? 0) + 1);
  });
  const parts = [...groups].map(([k, n]) => (n > 1 ? `${k} (${String(n)} units)` : k));
  if (even) parts.push(`${String(even)} even`);
  return parts.join('; ');
}

/** What lifts a unit's quality, as the ladder's units stage names it. */
const WHAT_LIFTS_A_UNITS_QUALITY: Readonly<Record<WhatLiftsAUnitsQuality, string>> = {
  oratory: 'Oratory',
  druid: 'Druid mastery',
  necromancy: 'Necromantic mastery',
  tactical: 'Tactical mastery',
  'war-drum': 'War Drum',
};

/** A modifier of a unit's own figure, as the ladder's units stage names it. */
export function theWordsOfAUnitsModifier(reason: AUnitsModifierInTheLadder): string {
  switch (reason.kind) {
    case 'it fights at another quality':
      return `fights as ${reason.quality}${reason.liftedBy.length ? ` (${reason.liftedBy.map((w) => WHAT_LIFTS_A_UNITS_QUALITY[w]).join(' + ')})` : ''}`;
    case "its commander's Druid falls short":
      return `Druid shortfall ${ladderFm(reason.multiplier)}`;
    case 'its kin':
      return `kinship ${reason.bothTheKingsAndTheLeaders ? '×1.44' : '×1.2'}`;
    case 'a racial animosity':
      return 'racial animosity ×0.8';
    case 'the ground':
      return `${reason.terrain} terrain ${ladderFm(reason.multiplier)}`;
    case 'elven woodland mastery':
      return 'Elven Woodland Mastery ×1.5';
    case 'the dwarven bulwark':
      return 'Dwarven Bulwark ×1.5';
    case 'the standing stones':
      return 'Standing Stones ×1.25';
    case "the realm's unit discoveries":
      return `realm unit discoveries ${ladderFm(reason.multiplier)}`;
    case 'terror':
      return `Terror ${ladderFm(reason.multiplier)}`;
    case 'the reign of fear':
      return `Reign of Fear ${ladderFm(reason.multiplier)}`;
    case 'the pre-battle volleys and spells':
      return 'pre-battle volleys & spells';
    case 'phantasmal armies':
      return `Phantasmal Armies ${ladderFm(reason.multiplier)}`;
    case "the commander's magic items":
      return "commander's magic items";
    case "the unit's ability":
      return `${reason.unitType} ability ${ladderFm(reason.multiplier)}`;
    case 'the home of the wild':
      return 'Home of the Wild ×1.5';
    case "the commander's druid mastery":
      return `Druid mastery ×${reason.multiplier.toFixed(1)}`;
    case "a naturalist's or beastmaster's title":
      return 'Naturalist/Beastmaster title ×1.05';
    case "a cavalier's title":
      return 'Cavalier title ×1.05';
    case "an ironclad's title":
      return 'Ironclad title ×1.05';
  }
}

/** The units stage's modifiers, each named once with the units it reached (or the strength it added or took), in the
 *  order the units first met them: " (kinship ×1.2 (3 units); forest terrain ×0.75 (2 units))", or nothing. */
function theWordsOfTheUnitsModifiers(modifiers: readonly AModifierOfAUnitInTheLadder[]): string {
  const agg = new Map<string, { label: string; n: number; d: number; delta: boolean }>();
  modifiers.forEach((e) => {
    const label = theWordsOfAUnitsModifier(e.reason);
    const g = agg.get(label) ?? { label, n: 0, d: 0, delta: e.delta != null };
    g.n++;
    if (e.delta != null) g.d += e.delta;
    agg.set(label, g);
  });
  const unitMods = [...agg.values()]
    .filter((g) => !g.delta || Math.round(g.d) !== 0)
    .map((g) =>
      g.delta
        ? `${g.label} ${g.d >= 0 ? '+' : '−'}${String(Math.abs(Math.round(g.d)))}`
        : `${g.label} (${pl(g.n, 'unit')})`,
    );
  return unitMods.length ? ` (${unitMods.join('; ')})` : '';
}

/** A command multiplier, as the ladder's command stage names it. */
export function theWordsOfACommandMultiplier(reason: ACommandMultiplierInTheLadder): string {
  switch (reason.kind) {
    case 'archery':
      return `Archery ${String(reason.level)} ${ladderFm(reason.multiplier)}`;
    case 'naval':
      return `Naval ${String(reason.level)} ${ladderFm(reason.multiplier)}`;
    case 'tactical':
      return `Tactical ${ladderFm(reason.multiplier)}`;
    case 'tactical at its level':
      return `Tactical ${String(reason.level)} ${ladderFm(reason.multiplier)}`;
    case 'illusory terrain':
      return `illusory terrain ${ladderFm(reason.multiplier)}`;
  }
}

/** The command stage's multipliers, each named once with the units it reached, and what the side's Tactical left out:
 *  " (Tactical ×1.2 on 3 land/air units; fleets gain nothing from Tactical (1 unit))", or nothing. */
function theWordsOfTheCommand(
  multipliers: readonly ACommandMultiplierOfAUnit[],
  tact: ASidesTacticalInTheLadder | null,
  nUnits: number,
): string {
  const cagg = new Map<string, { label: string; key: string | undefined; n: number }>();
  multipliers.forEach((c) => {
    const label = theWordsOfACommandMultiplier(c.reason);
    const g = cagg.get(label) ?? { label, key: c.key, n: 0 };
    g.n++;
    cagg.set(label, g);
  });
  const cmd = [...cagg.values()].map((g) => `${g.label} on ${pl(g.n, g.key === 'tac' ? 'land/air unit' : 'unit')}`);
  // Tactical never lifts fleets or sea-beasts (they take Naval) — say so whenever it leaves units
  // out. Since 2026-09-23c it lifts flyers exactly as it lifts land units (Toby).
  if (tact && tact.mult > 1) {
    const tg = [...cagg.values()].find((g) => g.key === 'tac');
    const left = nUnits - (tg ? tg.n : 0);
    if (!tg)
      cmd.push(
        `${theWordsOfACommandMultiplier(tact.reason)} — no land or air units to command (fleets gain nothing from Tactical)`,
      );
    else if (left > 0) cmd.push(`fleets gain nothing from Tactical (${pl(left, 'unit')})`);
  }
  return cmd.length ? ` (${cmd.join('; ')})` : '';
}

/** A multiplier of the whole force, as the ladder names it. */
const A_FORCE_WIDE_MODIFIERS_WORDS: Readonly<Record<AForceWideModifierInTheLadder, string>> = {
  morale: 'morale',
  orders: 'orders',
  'home-ground': 'home ground',
  fanaticism: 'fanaticism',
  discoveries: 'discoveries',
  'consecrated-ground': 'consecrated ground',
  'defenders-position': "defender's position",
  home: 'home',
  'duel-morale': 'duel morale',
  'sanctuary-wards': 'sanctuary wards',
};

/** A side's name as its grid lines show it: its label's first word, eight wide; none when there is no side. */
function theSideAsTheGridShowsIt(side: ASideAsABattlesReportLinesNameIt | null | undefined): string {
  const label = side == null ? '' : theLabelOfASideAsTheReportLinesNameIt(side);
  const firstWord = label.split(/\s+/)[0] ?? ''; // split gives one word at least
  return firstWord.slice(0, 8).padEnd(8);
}

/** The clause a fate's line carries of whom a unit faced (battleFacedClauses). A word helper on plain values, moved here
 *  from battle/lines.ts with its last engine caller (disbandLine, plan P1-12d5). */
export function theClauseOfWhomAUnitFaced(w: WhomAUnitFaced): string {
  switch (w.kind) {
    case 'an enemy unit':
      return theClauseOfHowAUnitMetAnEnemyUnit(w.how, theLabelOfAUnit(w.theEnemyUnit));
    case 'it rode free':
      return 'riding free round the flank';
    case "it wrapped the line's end":
      return 'wrapping the end of the line';
    case "it guarded the line's end":
      return 'guarding the end of the line';
    case 'it fought from the air':
      return 'fighting from the air';
    case 'it stood in the reserve':
      return 'in the reserve';
    case 'it shot at an empty column':
      return 'shooting at an empty column';
    case 'it stood in the second line':
      return 'in the second line';
    case 'nobody stood opposite':
      return 'with nobody opposite';
  }
}
/** The clause of how a unit met the enemy unit it faced, by its facing's kind. */
function theClauseOfHowAUnitMetAnEnemyUnit(
  how: 'faces' | 'met' | 'wraps' | 'shoots' | 'duel' | 'guards',
  theEnemyUnit: string,
): string {
  switch (how) {
    case 'faces':
      return `facing ${theEnemyUnit}`;
    case 'met':
      return `met at the end of the line by ${theEnemyUnit}`;
    case 'wraps':
      return `wrapping the line at ${theEnemyUnit}`;
    case 'shoots':
      return `shooting ${theEnemyUnit} over the line`;
    case 'duel':
      return `in a flank duel with ${theEnemyUnit}`;
    case 'guards':
      return `guarding the end against ${theEnemyUnit}`;
  }
}
/** A unit's line when it has had enough and disbands: its owner and its name or type, whom it faced (a clause, after the
 *  name), and its fate. Moved here from army-tables.ts with its last engine callers (plan P1-12d5). */
export function disbandLine(
  owner: string | null | undefined,
  a: { readonly type: string; readonly unitName?: string | null | undefined },
  clause?: string | null,
): string {
  // 2026-09-23d: a unit NAMED "the …" reads "the Pale Shades (Vervain's Shadow Archers)", never
  // "Vervain's the Pale Shades" (same rule as unitRef). `clause` (2026-10-12): whom they fought, after the name.
  const _core =
    a.unitName && /^the\s/i.test(a.unitName)
      ? `${a.unitName} (${owner ? owner + "'s " : ''}${a.type})`
      : `${owner ? owner + "'s " : ''}${a.unitName ? a.unitName + ' (' + a.type + ')' : a.type}`;
  return `— ${_core}${clause ? `, ${clause},` : ''} have had enough — the survivors slip away to their villages and the unit disbands for good.`;
}
/** A unit as its fate's line names it: its reference (its label: since plan P1-12d28 the line holds its record), then
 *  whom it faced, between commas. */
function aUnitAndWhomItFaced(reference: AUnitAsALineNamesIt, whomItFaced: WhomAUnitFaced | null): string {
  return theLabelOfAUnit(reference) + (whomItFaced ? `, ${theClauseOfWhomAUnitFaced(whomItFaced)},` : '');
}

/** A grid's place, five wide: the unit's short code, or "·" for an empty place. */
function aCellOfTheGrid(x: AUnitAsTheGridNamesIt | null | undefined): string {
  return (x ? shortUnit(x) : '·').padEnd(5).slice(0, 5);
}

/** What a side's front line holds beside its places: its flanks, its flyers and its reserve, or nothing. */
function theFlanksTheAirAndTheReserve(
  flanks: readonly AUnitAsTheGridNamesIt[],
  air: readonly AUnitAsTheGridNamesIt[],
  reserve: readonly AUnitAsTheGridNamesIt[],
): string {
  const extras: string[] = [];
  if (flanks.length) extras.push('flanks: ' + flanks.map((x) => shortUnit(x)).join(', '));
  if (air.length) extras.push('air: ' + air.map((x) => shortUnit(x)).join(', '));
  if (reserve.length) extras.push('reserve: ' + reserve.map((x) => shortUnit(x)).join(', '));
  return extras.length ? ' ' + extras.join(' · ') : '';
}

/** The ground's words and verb on the width line: a ground the table doesn't name reads as itself, or "ground". */
function theGroundAndItsVerb(terrain: string): readonly [string, string] {
  return GROUND_WORDS[terrain] ?? [terrain || 'ground', 'allows'];
}

/** Why a commander's force is demoralised, in words (P1-12d11: the words preBattleDuel handed in before). */
const THE_WORDS_OF_WHY_A_FORCE_IS_DEMORALISED: Readonly<Record<WhyACommandersForceIsDemoralised, string>> = {
  'he refused the challenge': 'their commander refused the challenge',
  'he was driven from the field': 'their commander was driven from the field',
  'he fell in single combat': 'their commander fell in single combat',
  'he broke off the duel': 'their commander broke off the duel',
};

/** The words of a battle decided, as the fight's narrative tells it (plan P1-12d26): one sentence for each battle, winner
 *  and what becomes of the province, the same nine sentences its nine kinds had. */
function theWordsOfABattleDecided(fact: ABattleIsDecided): string {
  switch (fact.whatBecomesOfTheProvince) {
    case 'seized':
      return `After ${aSeverity(fact.severity)} battle, ${theLabelOfASide(fact.attackersSide)}'s forces ${theVerbAVictoryIsToldWith(fact.winVerbIndex)} ${theLabelOfASide(fact.defendersSide)}'s army and seize ${fact.provName}!`;
    case "held by the defender's survivors":
      return `After ${aSeverity(fact.severity)} battle, ${theLabelOfASide(fact.attackersSide)}'s forces ${theVerbAVictoryIsToldWith(fact.winVerbIndex)} ${theLabelOfASide(fact.defendersSide)}'s army — but ${theLabelOfASide(fact.defendersSide)}'s survivors do not yield ${fact.provName}.`;
    case 'the attacker is driven out':
      return `${theLabelOfASide(fact.attackersSide)}'s assault is repelled! After ${aSeverity(fact.severity)} engagement, ${theLabelOfASide(fact.defendersSide)} drives the attackers from ${fact.provName}.`;
    case 'the attacker is not driven out':
      return `${theLabelOfASide(fact.attackersSide)}'s assault is repelled! After ${aSeverity(fact.severity)} engagement, ${theLabelOfASide(fact.defendersSide)} throws the attackers back — but they are not yet driven from ${fact.provName}.`;
    case 'the beaten host stays, still the stronger':
      return fact.winnersRole === 'the attacker'
        ? `${theLabelOfASide(fact.defendersSide)}'s forces are pushed back but not broken — still the stronger host (${n0(fact.stayingHostStrength)} vs ${n0(fact.victorsStrength)} on the same footing, before fortune), they hold their ground in ${fact.provName} and re-form to fight on rather than retreat.`
        : `${theLabelOfASide(fact.attackersSide)}'s assault is thrown back but their host is still the stronger (${n0(fact.stayingHostStrength)} vs ${n0(fact.victorsStrength)} on the same footing, before fortune) — they hold the field in ${fact.provName} and re-form to press the attack again rather than retreat.`;
    case 'swept into, with no one left to stand':
      return `${theLabelOfASide(fact.attackersSide)}'s forces sweep into ${fact.provName} — nothing is left to stand against them.`;
    case 'the defenders are beaten':
      return `After ${aSeverity(fact.severity)} engagement (margin ${theMarginInPercent(fact.margRatio)}% of total strength), ${theLabelOfASide(fact.attackersSide)}'s forces ${theVerbAVictoryIsToldWith(fact.winVerbIndex)} ${theLabelOfTheDefenders(fact.theDefenders, ' and their forces')}!`;
    case 'held by its defenders':
      return `${theLabelOfASide(fact.attackersSide)}'s forces are repelled! After ${aSeverity(fact.severity)} engagement (margin ${theMarginInPercent(fact.margRatio)}%), ${theLabelOfTheDefenders(fact.theDefenders)} hold their ground — ${fact.aPlayersGarrison ? (fact.atSea ? 'the garrison holds these waters!' : 'the garrison holds its walls!') : 'neutral defenders never retreat!'}`;
  }
}

/** The words of a province still held when a contest for it is decided (plan P1-12d26): by whom, after which contest. */
function theWordsOfAProvinceStillHeld(
  fact: Extract<AContestForAProvinceIsDecided, { whatBecomesOfTheProvince: 'still held' }>,
): string {
  switch (fact.heldBy) {
    case 'its guard':
      return fact.contest === 'a host gathered in the province'
        ? `⚔ ${theLabelOfASide(fact.theHost)} has the better of the fighting in ${fact.provName}, but ${fact.guardName} still holds the field with ${String(fact.guardUnitCount)} unit${fact.guardUnitCount !== 1 ? 's' : ''} — the province is not yet taken.`
        : `💢 ${fact.guardName} still holds with survivors — ${fact.provName} remains contested and will be fought over again next phase!`;
    case 'leaderless defenders':
      return fact.contest === 'a host gathered in the province'
        ? `⚔ ${theLabelOfASide(fact.theHost)} has the better of the fighting in ${String(fact.provName)}, but ${String(fact.leaderlessUnitCount)} leaderless defending unit${fact.leaderlessUnitCount !== 1 ? 's' : ''} still hold the field — the province is not yet taken.`
        : `💢 Commanderless but unbroken, ${String(fact.leaderlessUnitCount)} surviving unit${fact.leaderlessUnitCount !== 1 ? 's' : ''} still contest ${String(fact.provName)} — the fight resumes next phase!`;
    case 'enemy forces':
      return `⚔ ${theLabelOfASide(fact.theHost)} has the better of the fighting in ${fact.provName}, but enemy forces still hold their ground — the province is not yet taken.`;
    case 'its garrison':
      return `⚔ ${theLabelOfASide(fact.theHost)} has the better of the fighting in ${String(fact.provName)}, but its garrison still ${fact.atSea ? 'holds these waters' : 'mans the walls'} — the province is not yet taken.`;
  }
}

/** The words of a contest for a province decided, as a line filed on its own tells it (plan P1-12d26): one sentence for
 *  each contest and what becomes of the province, the same thirteen sentences its thirteen kinds had. */
function theWordsOfAContestForAProvinceDecided(fact: AContestForAProvinceIsDecided): string {
  switch (fact.whatBecomesOfTheProvince) {
    case 'taken with no one to defend it':
      return fact.onAWarFront
        ? `No one stands to defend ${fact.provName} — ${fact.cName} takes control of it for ${fact.playerName}!`
        : `With fresh troops now at their back, ${fact.cName} takes control of ${fact.provName} for ${fact.playerName}!`;
    case 'still held':
      return theWordsOfAProvinceStillHeld(fact);
    case 'claimed':
      return fact.contest === 'a host gathered in the province'
        ? `${theLabelOfASide(fact.theHost)} overcomes the defenders and claims ${fact.provName} for ${fact.playerName}!`
        : `${theLabelOfASide(fact.theHost)} finally overcomes the defenders and claims ${fact.provName}!`;
    case 'the attacker breaks off and retreats':
      return `${theLabelOfASide(fact.theHost)} breaks off and retreats to ${String(fact.retreatToName)}.`;
    case 'secured by the winner':
      return `${theLabelOfASide(fact.theHost)} secures ${fact.provName}!`;
    case 'secured unopposed':
      return `${theLabelOfASide(fact.theHost)} holds ${fact.provName} unopposed and secures it.`;
  }
}

/** The words of a unit's fate in the battle, as the fight's narrative tells it (plan P1-12d27): one sentence for each
 *  fate, its side's role and its flags, the same sentences its twelve kinds had. */
function theWordsOfAUnitsFateInTheBattle(fact: AUnitsFateInTheBattle): string {
  switch (fact.fate) {
    case 'dies':
      return `— ${aUnitAndWhomItFaced(fact.theUnit, fact.whomItFaced)} ${fact.inTheRout ? 'were annihilated in the rout!' : fact.itsSideWon ? 'were destroyed in the fighting.' : 'were destroyed in the rout!'}${fact.itsBonesCrumble ? ' Their bones crumble to dust — gone forever.' : ''}`;
    case 'is cut down with no escape':
      return fact.inTheRout
        ? `— ${theLabelOfAUnit(fact.theUnit)} are cut down in the rout — no escape!${fact.itsBonesCrumble ? ' Their bones crumble to dust.' : ''}`
        : `— ${theLabelOfAUnit(fact.theUnit)} are cut down with no escape!`;
    case 'is cut down and rises again by its regenerating hide':
      return `— ${aUnitAndWhomItFaced(fact.theUnit, fact.whomItFaced)} are cut down — and rise again, the ${theNameOfTheAbility('regenerating-hide')} knitting flesh as they stagger clear.`;
    case 'rises a tier':
      return fact.itsSideWon
        ? `— ${aUnitAndWhomItFaced(fact.theUnit, fact.whomItFaced)} ${fact.hardenedByVictory ? 'are hardened by victory to' : 'earn promotion to'} ${fact.itsQualityAfter}!`
        : `— Despite defeat, ${aUnitAndWhomItFaced(fact.theUnit, fact.whomItFaced)} improved to ${fact.itsQualityAfter}!`;
    case 'falls back behind the shield wall in good order':
      return `— ${aUnitAndWhomItFaced(fact.theUnit, fact.whomItFaced)} fall back behind the shield wall in good order.`;
    case 'keeps its nerve under the knightly example':
      return `— ${aUnitAndWhomItFaced(fact.theUnit, fact.whomItFaced)} keep their nerve under the ${theNameOfTheAbility('knightly-example')} of the Gilded Lances and lose nothing in defeat.`;
    case 'loses heart and falls a tier':
      return `— ${aUnitAndWhomItFaced(fact.theUnit, fact.whomItFaced)} lost heart in defeat, reduced to ${fact.itsQualityAfter}.`;
    case 'has had enough and disbands':
      return disbandLine(
        fact.theUnitsOwner ? theLabelOfASideOrTheDefenders(fact.theUnitsOwner) : null,
        { type: fact.unitType, unitName: fact.unitName },
        fact.whomItFaced ? theClauseOfWhomAUnitFaced(fact.whomItFaced) : '',
      );
  }
}

/** The words of a beaten guard's surviving unit's fate, as a line filed on its own tells it (plan P1-12d27): one
 *  sentence for each fate, the same sentences its three kinds and the disbanding had. */
function theWordsOfABeatenGuardsSurvivingUnitsFate(fact: ABeatenGuardsSurvivingUnitsFate): string {
  switch (fact.fate) {
    case 'breaks ranks and flees as mercenaries':
      return `— ${theLabelOfAUnit(fact.theUnit)} break ranks and flee${fact.victorsHost ? ` before ${fact.victorsHost}'s host` : ''} — they now roam as mercenaries near ${fact.provName}.`;
    case 'loses heart and falls a tier':
      return `— ${theLabelOfAUnit(fact.theUnit)} lost heart in defeat, reduced to ${fact.itsQualityAfter} — ${fact.victorsHost ? `beaten by ${fact.victorsHost}'s host, ` : ''}they rally around ${theLabelOfTheDefenders(fact.theGuard)}.`;
    case 'holds its ground unbroken':
      return `— ${theLabelOfAUnit(fact.theUnit)} hold their ground unbroken${fact.victorsHost ? ` against ${fact.victorsHost}'s host` : ''} and rally around ${theLabelOfTheDefenders(fact.theGuard)}.`;
    case 'has had enough and disbands':
      return disbandLine(
        theLabelOfASideOrTheDefenders(fact.theGuard),
        { type: fact.unitType, unitName: fact.unitName },
        '',
      );
  }
}

/** The words of one fact of a battle's lines. */
export function theWordsOfABattlesLine(fact: TheFactOfABattlesLine): string {
  switch (fact.kind) {
    case 'a battle is decided':
      return theWordsOfABattleDecided(fact);
    case 'a contest for a province is decided':
      return theWordsOfAContestForAProvinceDecided(fact);
    case "a unit's fate in the battle":
      return theWordsOfAUnitsFateInTheBattle(fact);
    case "a beaten guard's surviving unit's fate":
      return theWordsOfABeatenGuardsSurvivingUnitsFate(fact);
    case 'a force drawn up for battle': {
      // The header's machine form, its keys in this order: the player page, the GM page, the battle's tiers and its
      // tally read it back (join-and-chronicle.ts, turn-log.ts, engine/battle/fates.ts).
      const { color, neutral, guard, role, howItComesOn, armies } = fact;
      const name = theNameOfTheForceAHeaderNames(fact.theForce, fact.fallenCommandersName);
      const verb = howItComesOn ? theWordsOfHowAForceComesOn(howItComesOn) : '';
      return '⚑FORCE⚑' + JSON.stringify({ name, color, neutral, guard, role, verb, armies });
    }
    case "a battle's losses, tallied from its lines":
      throw new Error(
        "a battle's losses tally is written from the words of the battle's lines (theTurnsLinesInWords), not on its own",
      );
    case "the attacker's lightning advance catches the defender unready":
      return `⚡ ${String(fact.atkName)}'s Lightning Advance catches ${String(fact.defName)} completely unready — no terrain advantage, no pre-battle magic and no answering volley.`;
    case 'the attacker moves into the province and a battle is initiated':
      return `➡️ ${fact.atkName}${fact.attackersRealmName != null ? ` (${fact.attackersRealmName})` : ''} moves into ${fact.provName}, held by ${fact.heldByName} — a battle is initiated.`;
    case 'the battle for a province begins':
      return `⚔ **Battle for ${fact.provName}**`;
    case 'the province still cowers under a reign of fear':
      return `💀 Reign of Fear — ${fact.provName} still cowers under ${fact.terrorHeroName}'s Terror, and the monsters of the host fight at ×${String(fact.reignOfFearMultiplier)}.`;
    case 'the attacker is cut down before the lines join, and a captain takes command':
      return `⚑ With ${fact.atkName} cut down before the lines were joined, the senior captain of the host takes command — the attack goes in regardless, though without their fallen leader's guiding hand.`;
    case 'the defender is slain before his army, and a veteran takes command':
      return `⚑ With ${fact.defName} slain before their army, a steady-handed veteran steps into command — the defence holds its ground, leaderless but unbowed.`;
    case "the attacker fights to win back his realm's capital":
      return `🏠 ${theLabelOfASide(fact.atkName)} fights to win back ${fact.provName}, the realm's own capital — home ground lends the assault ×1.5 strength.`;
    case "the attacker's siegecraft wears down the defenders' fortifications":
      return `  🏰 ${theLabelOfASide(fact.atkName)}'s siegecraft wears down the defenders' fortifications (province bonus −${fact.siegecraft.toFixed(2)}).`;
    case "the defender's host defends ground held justly":
      return `✝ Righteous Defence — ${theLabelOfASide(fact.defName)}'s host defends ground held justly (+10% defence).`;
    case "the defender's realm holds its own ground the harder":
      return `  🛡 ${theLabelOfASideOrTheDefenders(fact.defName)}'s realm holds its own ground the harder (+${String(fact.ownGroundDefencePct)}% defence).`;
    case "the defender's banner of the realm rallies the home defence":
      return `  🛡 ${theLabelOfASide(fact.defName)}'s Banner of the Realm rallies the home defense (+25%).`;
    case "the attacker's siege mastery halves the defenders' fortifications":
      return `  🏰 ${theLabelOfASide(fact.atkName)}'s siege mastery halves the defenders' fortifications.`;
    case 'the defenders fight on home ground':
      return `The defenders fight on home ground, gaining ×1.5 total defensive bonus.`;
    case "a side's skeletal legions fight with fanaticism under their undead king":
      return `${theLabelOfASide(fact.sideName)}'s skeletal legions fight with undying fanaticism under their Undead king! (+${String(fact.undeadKingFanaticismPct)}% strength)`;
    case "a side's monsters are driven to savage fury":
      return `${theLabelOfASide(fact.sideName)}'s monsters are driven to savage fury! (+25% strength)`;
    case "a side's skeletal legions know no fear":
      return `${theLabelOfASide(fact.sideName)}'s skeletal legions know no fear (+${String(fact.undeadHeroFanaticismPct)}% strength — undying fanaticism).`;
    case "the attacker's forces fight with fanatical zeal":
      return `${theLabelOfASide(fact.atkName)}'s forces fight with fanatical zeal! (+30% attacking strength)`;
    case 'the defenders fight with fanatical zeal on consecrated ground':
      return `✨ On the consecrated ground of ${fact.provName}, ${theLabelOfASide(fact.defName)}'s defenders fight before the altars of their gods with fanatical zeal! (+30% defending strength)`;
    case "the defender's forces fight with fanatical zeal":
      return `${theLabelOfASide(fact.defName)}'s forces fight with fanatical zeal! (+30% defending strength)`;
    case 'the caster casts a spell before the battle':
      return `✨ **Pre-battle Magic: ${fact.casterName} casts ${fact.spellName}** (${fact.schoolLabel} ${String(fact.spellLevel)}) — ${String(fact.castChance)}% [roll ${String(fact.castRoll)}${fact.castRoll <= fact.castChance ? ' ✓' : ' ✗'}]`;
    case 'the spell before the battle fizzles':
      return `  Spell fizzles.`;
    case "a fireball halves the enemy's strongest units":
      return `  🔥 Fireball halves the enemy's ${fact.fireballHitUnitNames.length > 1 ? 'two strongest units' : 'strongest unit'}, ${fact.fireballHitUnitNames.join(' and ')}.`;
    case "a telekinetic storm scatters the enemy commander's formations":
      return `  🌀 Telekinetic Storm scatters ${theLabelOfASide(fact.enemyCommanderName)}'s formations — their Tactical command is cut to half effectiveness this battle.`;
    case 'a telekinetic storm finds no tactical command to disrupt':
      return `  🌀 Telekinetic Storm rages, but ${theLabelOfASide(fact.enemyCommanderName)} has no tactical command to disrupt here.`;
    case "a psychic blast severs the enemy commander's bond with his beasts":
      return `  🧠 Psychic Blast severs ${theLabelOfASide(fact.enemyCommanderName)}'s bond with their beasts — their Druid skill is negated this battle.`;
    case 'a lightning bolt weakens enemy units':
      return `  ⚡ Lightning Bolt: ${String(fact.unitCount)} enemy unit${fact.unitCount !== 1 ? 's' : ''} lose 20% strength.`;
    case "a curse withers the enemy commander's skill":
      return `  ☠ Curse withers ${theLabelOfASide(fact.enemyCommanderName)}'s ${curseSkillLabel(fact.cursedSkill)} — halved for this battle.`;
    case "control undead turns an enemy undead unit to the caster's side":
      return `  ☠ Control Undead turns the ${fact.turnedUnitName} to ${fact.casterName}'s side!`;
    case 'control undead finds no enemy undead to turn':
      return `  ☠ Control Undead finds no enemy undead to turn.`;
    case 'a holy symbol weakens enemy undead units':
      return `  ✝ Holy Symbol: ${String(fact.undeadUnitCount)} enemy undead unit${fact.undeadUnitCount !== 1 ? 's' : ''} at 75% str.`;
    case 'a holy symbol finds no enemy undead to smite':
      return `  ✝ Holy Symbol: no enemy undead to smite.`;
    case 'spiritwrack halves enemy missile units':
      return `  Spiritwrack: ${String(fact.missileUnitCount)} enemy missile unit${fact.missileUnitCount !== 1 ? 's' : ''} at half str.`;
    case 'spiritwrack finds no enemy missile troops':
      return `  Spiritwrack: enemy fields no missile troops.`;
    case "a unit's power gathers but never strikes":
      return `〰 ${fact.unitName} gather for **${fact.powerName}**, but the moment passes — the strike never lands (${String(fact.strikeChancePct)}% chance${theDruidAStrikeIsRolledAt(fact.druidLevel)}).`;
    case 'a unit uses its power in battle':
      return `✨ ${fact.unitName} — **${fact.powerName}**: "${fact.powerFlavour}"`;
    case "a unit's power hits all enemy units":
      return `  Hits all ${String(fact.enemyUnitCount)} enemy units: −${String(fact.damage)} str.`;
    case "a unit's power hits one enemy unit":
      return `  Hits ${fact.struckUnitName}: −${String(fact.damage)} str.`;
    case "the hero's archers find no target among the forest wardens":
      return `🌲 ${theLabelOfASide(fact.heroName)}'s archers can find no target — Forest Wardens hold the thickets and the volley never comes.`;
    case "the hero's archery volley begins":
      return `🏹 ${fact.heroName}'s archery: ${String(fact.missileUnitCount)} unit${fact.missileUnitCount !== 1 ? 's' : ''}${fact.doubleVolleys ? ' (double volleys)' : ''}${fact.oneMoreShot ? ' (+1 shot)' : ''}${fact.preparedGround ? ` (${theNameOfTheAbility('prepared-ground')}: the Longbows loose twice)` : ''}`;
    case "a unit's shot glances off its target":
      return `  ${String(fact.shooterName)} → ${String(fact.targetUnitName)}: shot glances off the ${fact.whyTheShotGlances ?? 'armoured hull'}.`;
    case "a unit's shot weakens its target":
      return `  ${fact.shooterName} → ${fact.targetUnitName}: −${String(fact.damage)} str${theClausesOfTheShot(fact)}.`;
    case "a unit's target is already softened as far as arrows allow":
      return `  ${String(fact.shooterName)} → ${String(fact.targetUnitName)}: already softened as far as arrows allow.`;
    case "a side's whale cohort sinks an enemy ship":
      return `🌊 A ${String(fact.sideName)} whale cohort breaches beneath the ${String(fact.targetUnitName)} and rolls her over — she goes down with all hands before a shot is fired.`;
    case "the terrain's effect on each side":
      return `📊 Terrain (${fact.terrain}): ${[
        fact.unitsTheTerrainMarksOfTheAttacker
          ? `${theLabelOfASide(fact.atkName)} — ${theWordsOfTheUnitsTheTerrainMarks(fact.unitsTheTerrainMarksOfTheAttacker)}`
          : null,
        fact.unitsTheTerrainMarksOfTheDefender
          ? `${theLabelOfASide(fact.defName)} — ${theWordsOfTheUnitsTheTerrainMarks(fact.unitsTheTerrainMarksOfTheDefender)}`
          : null,
      ]
        .filter((notes) => notes !== null)
        .join('; ')}`;
    case 'hosts airborne over open water fight at a penalty':
      return `⚠ ${fact.attackersHostIsAirborne && fact.defendersHostIsAirborne ? 'Both hosts are' : (fact.attackersHostIsAirborne ? theLabelOfASide(fact.atkName) : theLabelOfASide(fact.defName)) + "'s host is"} airborne over open water: land units carried by flyers fight at ×${String(fact.seaAirborneLandPenalty)}, and the flyers carrying them at ×${String(fact.seaAirborneFlyerPenalty)}.`;
    case 'land units fight at sea at a penalty':
      return `⚠ Land units fighting at sea: ×${String(fact.seaLandPenalty)} strength penalty.`;
    case "a side's realm discoveries strengthen its army":
      return `${theLabelOfASide(fact.sideName)}'s realm discoveries: +${((fact.discoveriesBonus - 1) * 100).toFixed(0)}% army str.`;
    case "the illusory ground of the province confuses a side's forces":
      return `  🌫 The ever-shifting illusory ground of ${fact.provName} throws ${theLabelOfASide(fact.sideName)}'s forces into confusion — every unit fights as though mired in the worst terrain for its kind (at least −15% strength).`;
    case "the sanctuary wards of the province sap a side's attackers":
      return `  ✨ The sanctuary wards of ${String(fact.provName)} sap ${theLabelOfASide(fact.sideName)}'s attackers (−25% strength).`;
    case 'the attacker unfolds a grand stratagem':
      return `  📜 ${theLabelOfASide(fact.atkName)} unfolds a Grand Stratagem — the attack lands at +20% strength.`;
    case 'the defender unfolds a grand stratagem':
      return `  📜 ${theLabelOfASide(fact.defName)} unfolds a Grand Stratagem — the defence holds at +20% strength.`;
    case "the defender's feigned retreat springs shut":
      return `  🏳 ${theLabelOfASide(fact.defName)}'s Feigned Retreat springs shut — the counter-attack strikes at +25% strength.`;
    case 'the attacker storms ashore in a raid on the coast':
      return `  ⚓ ${theLabelOfASide(fact.atkName)} storms ashore in a Raid the Coast — the amphibious assault hits at +25% strength.`;
    case "the consecrated ground of the province weakens the attacker's host":
      return `✨ The ground of ${fact.provName} is consecrated — ${theLabelOfASide(fact.atkName)}'s ${fact.attackersAlignment.toLowerCase()} host falters on hallowed earth (−15% strength).`;
    case "the battle's statistics begin":
      return `📊 **Battle stats:**`;
    case 'the fortune of the battle':
      return `  ${fortuneNarrative(theLabelOfASide(fact.atkLabel), theLabelOfASideOrTheDefenders(fact.defLabel), fact.atkBase, fact.defBase, fact.fortune)}`;
    case "the battle's outcome and its margin":
      return `📊 Outcome: **${fact.winnerName} wins** — ${THE_WORDS_OF_A_BATTLES_SEVERITY[fact.severity]} (margin ${theMarginInPercent(fact.margRatio)}% of combined strength after fortune)`;
    case "a side's war-horn of the plains lets its free lances ride in rough country":
      return `📯 ${theLabelOfASide(fact.sideName)}'s War-Horn of the Plains sounds — the Free Lances ride the broken enemy down even in ${String(fact.terrain)} country.`;
    case "a side's free lances find no room to ride":
      return `🐎 ${theLabelOfASide(fact.sideName)}'s Free Lances find no room to ride in ${fact.terrain} country — the broken enemy scatters into cover.`;
    case "the loser's dwarven guard leave the manticore pride nothing to hunt":
      return `🛡 ${theLabelOfASide(fact.loserName)}'s Dwarven Guard lock shields as they give ground — ${theLabelOfASide(fact.winnerName)}'s Manticore Pride find no broken backs to hunt.`;
    case "the winner's manticore pride hunt the broken companies":
      return `🦂 ${theLabelOfASide(fact.winnerName)}'s Manticore Pride hunt the broken companies down before they can get clear (+${String(fact.runThemDownPct)}% losses to ${theLabelOfASide(fact.loserName)}).`;
    case "the loser's dwarven guard leave the shark shoals nothing in the water":
      return `🛡 ${theLabelOfASide(fact.loserName)}'s Dwarven Guard lock shields as they give ground — ${theLabelOfASide(fact.winnerName)}'s Shark Shoals find nothing in the water.`;
    case "the winner's shark shoals tear into the beaten crews":
      return `🦈 ${theNameOfTheAbility('feeding-frenzy')} — ${theLabelOfASide(fact.winnerName)}'s Shark Shoals tear into ${theLabelOfASide(fact.loserName)}'s beaten crews as they founder (+${String(fact.runThemDownPct)}% losses to ${theLabelOfASide(fact.loserName2)}).`;
    case "a side's other forces survive the engagement":
      return `— ${allOrAllOther(fact.someUnitsFateIsToldAbove)} forces survive the engagement.`;
    case 'no units were left on the field to count':
      return `— No units were left on the field to count.`;
    case "the attacker's casualties begin":
      return `⚔ **${theLabelOfASide(fact.atkName)}'s forces** (attacker):`;
    case "the defender's casualties begin":
      return `🛡 **${theLabelOfASideOrTheDefenders(fact.defName)}'s forces** (defender):`;
    case "the loser's dwarven guard leave the free lances no broken backs":
      return `🛡 ${theLabelOfASide(fact.loserName)}'s Dwarven Guard lock shields as they give ground — ${theLabelOfASide(fact.winnerName)}'s Free Lances find no broken backs to ride down.`;
    case "the winner's free lances ride down the broken companies":
      return `🐎 ${theLabelOfASide(fact.winnerName)}'s Free Lances ride down the broken companies (+${String(fact.rideDownPct)}% losses to ${theLabelOfASide(fact.loserName)}).`;
    case "the loser's dwarven guard leave the warg riders no broken backs":
      return `🛡 ${theLabelOfASide(fact.loserName)}'s Dwarven Guard lock shields as they give ground — ${theLabelOfASide(fact.winnerName)}'s Warg Riders find no broken backs to run down.`;
    case "the winner's warg riders run down the broken companies":
      return `🐺 ${theLabelOfASide(fact.winnerName)}'s Warg Riders run down the broken companies before they can get clear (+${String(fact.runThemDownPct)}% losses to ${theLabelOfASide(fact.loserName)}).`;
    case "the winner's corsairs close the sea lanes to the loser":
      return `⛵ ${theLabelOfASide(fact.winnerName)}'s corsairs close the sea lanes — ${theLabelOfASide(fact.loserName)} cannot slip away by water.`;
    case "the loser's skeletal host stands its ground in a deathless march":
      return `💀 Deathless March — ${theLabelOfASide(fact.loserName)}'s skeletal host has no fear to exploit: none are cut down in flight, and the dead stand their ground in ${fact.provName}.`;
    case "the loser's dwarven guard hold a shield fort with no road out":
      return `🛡 ${theNameOfTheAbility('shield-fort')} — with no road out, ${theLabelOfASide(fact.loserName)}'s Dwarven Guard lock shields where they stand. None are cut down in flight, and ${fact.provName} remains contested.`;
    case 'the defender has nowhere to retreat':
      return `${theLabelOfASide(fact.defName)} has nowhere to retreat — their forces take additional casualties!`;
    case "the loser's force is destroyed to the last":
      return `📊 ${theLabelOfASide(fact.loserName)}'s force is destroyed to the last — commander and column both.`;
    case "the loser's dwarven guard withdraw behind a shield fort":
      return `🛡 ${theNameOfTheAbility('shield-fort')} — ${theLabelOfASide(fact.loserName)}'s Dwarven Guard withdraw in good order behind locked shields.`;
    case 'the loser retreats to a province':
      return `${theLabelOfASide(fact.loserName)} retreats to ${fact.retreatToName}.`;
    case "the loser's surviving forces":
      return `📊 ${theLabelOfASide(fact.loserName)}'s surviving forces: ${describeArmy(fact.survivingForces)}.`;
    case "the loser's forces are completely destroyed and he retreats alone":
      return `📊 ${theLabelOfASide(fact.loserName)}'s forces are completely destroyed — they retreat alone.`;
    case 'the attacker has nowhere to retreat':
      return `${theLabelOfASide(fact.atkName)} has nowhere to retreat — their forces take additional casualties, ${fact.atSea ? 'hemmed in on open water' : 'cut down against the walls'} with no escape!`;
    case "a commander's force is demoralised":
      return `\u{1F4C9} ${fact.commanderName}'s force is demoralised — ${THE_WORDS_OF_WHY_A_FORCE_IS_DEMORALISED[fact.why]} (−20% strength this battle).`;
    case 'a commander rides out and challenges the other to single combat':
      return `— ${fact.challengerName} rides out and challenges ${fact.challengedName} to single combat. —`;
    case 'the challenged commander will not answer the call':
      return `${fact.challengedName} will not answer the call, and the watching ranks see it.`;
    case 'a personal duel before the battle begins':
      return `\u2694 — Personal duel: ${fact.challengerName} vs ${fact.challengedName} —`;
    case "the duel's loser falls at death's door but is not slain":
      return `\u{1FA79} ${fact.loserName} falls in the duel — at death's door, but not slain.`;
    case "the duel's loser is slain":
      return `\u{1F480} ${fact.loserName} is slain in the duel!`;
    case 'the duel ends inconclusively':
      return `The duel ends inconclusively — both commanders live to fight on, and neither host loses heart.`;
    case 'a hero cries out his battlecry to his foe':
      return `📣 ${String(fact.heroName)} cries out to ${String(fact.foeName)}: “${String(fact.battlecry)}”`;
    case "a side's Druid cannot fully command its units":
      return `⚠ Druid shortfall — ${theLabelOfASideAsTheReportLinesNameIt(fact.sideName)} cannot fully command ${String(fact.unitCount)} unit${fact.unitCount !== 1 ? 's' : ''}: ${theWordsOfTheDruidShortfalls(fact.shortfalls)}.`;
    case 'the attacker moves into a province held by its defenders and a battle is initiated':
      return `➡️ ${fact.cName}${fact.aRealmsHero ? ` (${String(fact.attackersRealmName)})` : ''} moves into ${fact.provName}, held by ${theLabelOfTheDefenders(fact.heldByName, ' and the local defenders')} — a battle is initiated.`;
    case 'the guard is slain before his host, and a sergeant of the garrison takes up the banner':
      return `⚑ With ${String(fact.guardName)} slain before the host, a battle-worn sergeant of the garrison takes up the fallen banner — the defenders close ranks and fight on, leaderless but unbowed.`;
    case 'the attacker is cut down before the lines join, and the eldest captain takes command':
      return `⚑ With ${fact.cName} cut down before the lines were even joined, the eldest captain of the host takes command — the attack goes in regardless, though without their fallen leader's guiding hand.`;
    case "the attacker's Tactical command does not apply at sea":
      return `📊 ${theLabelOfASide(fact.cName)}'s Tactical command does not apply in sea terrain.`;
    case 'the defenders of a province defend ground held justly':
      return `✝ Righteous Defence — the defenders of ${fact.provName} stand on ground they hold justly (+10% defence).`;
    case 'the defenders fight on home soil':
      return `The defenders fight on home soil, gaining an additional ×1.2 bonus.`;
    case 'the attacker casts a spell before the battle against the defenders':
      return `✨ **Pre-battle Magic: ${theLabelOfASide(fact.cName)} casts ${fact.spellName}** (${fact.schoolLabel} ${String(fact.spellLevel)}) — cast chance ${String(fact.castChance)}% [roll ${String(fact.castRoll)}${fact.castRoll <= fact.castChance ? ' ✓' : ' ✗'}]`;
    case "a fireball engulfs the defenders' strongest units":
      return `  🔥 Fireball engulfs the enemy's ${fact.fireballHitUnitNames.length > 1 ? 'two strongest units' : 'strongest unit'}, ${fact.fireballHitUnitNames.join(' and ')} — halved this battle.`;
    case 'a telekinetic storm finds no command among leaderless defenders':
      return `  🌀 Telekinetic Storm rages, but these leaderless defenders have no tactical command to unmake.`;
    case 'a psychic blast finds no commander among the defenders':
      return `  🧠 Psychic Blast reaches out, but these defenders have no commander to unmake.`;
    case 'a lightning bolt sears the defending units':
      return `  ⚡ Lightning Bolt sears ${String(fact.unitCount)} enemy unit${fact.unitCount !== 1 ? 's' : ''} — each loses 20% of its strength this battle.`;
    case 'a curse finds no commander among leaderless defenders':
      return `  ☠ Curse seeks a commander to wither, but these defenders are leaderless.`;
    case "control undead turns a defending undead unit to the attacker's side":
      return `  ☠ Control Undead turns the ${fact.turnedUnitName} — it defects to ${theLabelOfASide(fact.cName)}'s side!`;
    case 'control undead finds no undead among the defenders':
      return `  ☠ Control Undead reaches out, but the enemy fields no undead to turn.`;
    case 'a holy symbol sears the defending undead':
      return `  ✝ Holy Symbol sears the enemy undead — ${String(fact.undeadUnitCount)} undead unit${fact.undeadUnitCount !== 1 ? 's' : ''} fight at 75% strength.`;
    case 'a holy symbol finds no undead among the defenders':
      return `  ✝ Holy Symbol blazes, but no undead stand among the defenders.`;
    case "spiritwrack halves the defenders' missile units":
      return `  Spiritwrack unstrings the enemy's bows — ${String(fact.missileUnitCount)} missile unit${fact.missileUnitCount !== 1 ? 's' : ''} fight at half strength.`;
    case 'spiritwrack finds no missile troops among the defenders':
      return `  Spiritwrack howls, but the enemy fields no missile troops.`;
    case "the attacker's spell before the battle fizzles":
      return `  The spell fizzles — no pre-battle magical effect.`;
    case "a unit's power hits every defending unit":
      return `  ${fact.powerName} hits all ${String(fact.unitCount)} defending units: −${String(fact.damage)} strength each.`;
    case "a unit's power hits one unit of the other side":
      return `  ${fact.powerName} hits ${fact.struckUnitName}: −${String(fact.damage)} strength this battle.`;
    case 'a whale cohort sinks a defending ship before a shot is fired':
      return `🌊 A whale cohort breaches beneath the ${fact.targetUnitName} and rolls her over — she goes down before a shot is fired.`;
    case "the attacker's archery volley begins":
      return `🏹 **Pre-battle Archery Phase** — ${String(fact.missileUnitCount)} ranged unit${fact.missileUnitCount !== 1 ? 's' : ''}${fact.doubleVolleys ? ' (Quiver of the Hawk: double volleys)' : ''}${fact.oneMoreShot ? ' (Quiver of Many Arrows: +1 shot)' : ''}`;
    case 'a unit fires at its target and the shot glances off':
      return `  ${String(fact.shooterName)} fires at ${String(fact.targetUnitName)}, but the shot glances off the ${fact.whyTheShotGlances ?? 'armoured hull'}.`;
    case 'a unit fires at its target and weakens it':
      return `  ${fact.shooterName} fires at ${fact.targetUnitName}: −${String(fact.damage)} strength${theClausesOfTheShot(fact)}.`;
    case "an attacking unit's target is already softened as far as arrows allow":
      return `  ${String(fact.shooterName)} fires at ${String(fact.targetUnitName)}, but they are already softened as much as arrows can manage.`;
    case "the attacker's archery volley's total":
      return `📊 Archery phase total: −${String(fact.totalDamage)} strength spread across defenders (each unit softened by at most ${String(fact.arrowSofteningCapPct)}%).`;
    case 'the defender casts a spell before the battle':
      return `✨ Defender Magic: ${fact.casterName} casts ${fact.spellName} (${fact.schoolLabel} ${String(fact.spellLevel)}) — ${String(fact.castChance)}% chance [roll ${String(fact.castRoll)} ${fact.castRoll <= fact.castChance ? '✓' : '✗'}]`;
    case "a fireball halves the attackers' strongest unit":
      return `  🔥 Fireball halves the attackers' strongest unit, ${fact.targetUnitName} (−${String(fact.strengthLost)}).`;
    case 'a lightning bolt sears the attacking units':
      return `  ⚡ Lightning Bolt sears ${String(fact.unitCount)} attacking unit${fact.unitCount !== 1 ? 's' : ''} — each loses 20% of its strength.`;
    case 'control undead finds no undead among the attackers':
      return `  ☠ Control Undead finds no undead among the attackers.`;
    case 'a holy symbol sears the attacking undead':
      return `  ✝ Holy Symbol sears the attacking undead — ${String(fact.undeadUnitCount)} unit${fact.undeadUnitCount !== 1 ? 's' : ''} at 75% strength.`;
    case 'a holy symbol finds no undead among the attackers':
      return `  ✝ Holy Symbol blazes, but no undead assail this province.`;
    case "spiritwrack halves the attackers' missile units":
      return `  Spiritwrack unstrings the attackers' bows — ${String(fact.missileUnitCount)} missile unit${fact.missileUnitCount !== 1 ? 's' : ''} at half strength.`;
    case 'spiritwrack finds no missile troops among the attackers':
      return `  Spiritwrack howls, but the attackers field no missile troops.`;
    case "the defender's spell before the battle fizzles":
      return `  The spell fizzles — no defensive magical effect.`;
    case "the attacker's lightning advance catches the defenders unready":
      return `⚡ ${String(fact.cName)}'s Lightning Advance catches the defenders completely unready — they fight with no terrain advantage, no pre-battle magic and no answering volley.`;
    case "the defenders' archers find no target among the attacker's forest wardens":
      return `🌲 The defenders' archers can find no target — ${theLabelOfASide(fact.cName)}'s Forest Wardens hold the thickets and the answering volley never comes.`;
    case "the defenders' archery volley begins":
      return `🏹 **Defender Archery Phase** — ${String(fact.missileUnitCount)} ranged unit${fact.missileUnitCount !== 1 ? 's' : ''}${fact.preparedGround ? ` (${theNameOfTheAbility('prepared-ground')}: the Longbows loose twice)` : ''}`;
    case "a defending unit's target is already softened as far as arrows allow":
      return `  ${String(fact.unitName)} fires at ${String(fact.targetUnitName)}, but they are already as softened as arrows can manage.`;
    case "the defenders' archery volley's total":
      return `📊 Defender archery total: −${String(fact.totalDamage)} strength spread across attackers (each unit softened by at most ${String(fact.arrowSofteningCapPct)}%).`;
    case 'a defending unit uses its power in battle':
      return `✨ ${fact.unitName} (defending) — **${fact.powerName}**: "${fact.powerFlavour}"`;
    case "a unit's power hits every attacking unit":
      return `  ${fact.powerName} hits all ${String(fact.unitCount)} attacking units: −${String(fact.damage)} strength each.`;
    case "the terrain's effect on the attacker's units":
      return `📊 Terrain (${fact.terrain}): ${theLabelOfASide(fact.cName)} — ${theWordsOfTheUnitsTheTerrainMarks(fact.unitsTheTerrainMarks)}`;
    case 'hosts airborne over open water fight at a penalty against the defenders':
      return `⚠ Airborne over open water: land units carried by flyers fight at ×${String(fact.seaAirborneLandPenalty)}, and the flyers carrying them at ×${String(fact.seaAirborneFlyerPenalty)}.`;
    case 'land units fight at sea at a penalty against the defenders':
      return `⚠ Land units at sea: ×${String(fact.seaLandPenalty)} strength penalty.`;
    case 'the attacker unfolds a grand stratagem against the defenders':
      return `  📜 ${theLabelOfASide(fact.cName)} unfolds a Grand Stratagem — the assault lands at +20% strength.`;
    case 'the attacker storms ashore in a raid on the coast against the defenders':
      return `  ⚓ ${theLabelOfASide(fact.cName)} storms ashore in a Raid the Coast — +25% strength.`;
    case "the attacker's monsters are driven to savage fury":
      return `${theLabelOfASide(fact.cName)}'s monsters are driven to savage fury under their Evil overlord! (+25% strength)`;
    case "the attacker's troops fight with fanatical zeal":
      return `Seized by religious fervour, ${theLabelOfASide(fact.cName)}'s troops fight with fanatical zeal! (+30% strength)`;
    case "the attacker's realm discoveries strengthen his army":
      return `Realm discoveries grant +${((fact.discoveriesArmyBonus - 1) * 100).toFixed(0)}% army strength.`;
    case "the attacker's free lances find no room to ride":
      return `🐎 ${theLabelOfASide(fact.cName)}'s Free Lances find no room to ride in ${fact.terrain} country.`;
    case "the attacker's warg riders halve his losses":
      return `🐺 The warg packs are into the defenders before they can set themselves — the business is over quickly, and ${theLabelOfASide(fact.cName)}'s losses are halved.`;
    case 'every defending unit was lost before the lines closed':
      return `— None left to fight: every defending unit was lost before the lines closed.`;
    case "the defenders' dwarven guard leave the attacker's free lances no broken backs":
      return `🛡 The defenders' Dwarven Guard lock shields where they stand — ${theLabelOfASide(fact.cName)}'s Free Lances find no broken backs to ride down.`;
    case "the attacker's free lances ride down the defenders' broken companies":
      return `🐎 ${theLabelOfASide(fact.cName)}'s Free Lances ride down the broken companies across open ground (+${String(fact.extraLossesPct)}% losses).`;
    case 'the defenders have nowhere to retreat and hold a shield fort':
      return `🛡 ${theNameOfTheAbility('shield-fort')} — the defenders of ${fact.provName} have nowhere to retreat, so they lock shields where they stand. None are cut down.`;
    case 'the defenders have nowhere to retreat and take further losses':
      return `The defenders of ${fact.provName} have nowhere to retreat — they are pinned against their own ground and take further losses!`;
    case "the guard's host is destroyed and he is a masterless hero":
      return `— but every soldier of ${fact.guardName}'s band lies dead. With no host left to command, they are ${fact.provName}'s guardian no more — a masterless hero now.`;
    case "the attacker's dwarven guard leave the defenders' free lances no broken backs":
      return `🛡 ${theLabelOfASide(fact.cName)}'s Dwarven Guard lock shields as they give ground — the defenders' Free Lances find no broken backs to ride down.`;
    case "the defenders' free lances ride down the attacker's broken companies":
      return `🐎 The defenders' Free Lances range across the open ground and ride down ${theLabelOfASide(fact.cName)}'s broken companies (+${String(fact.extraLossesPct)}% losses).`;
    case "the attacker's corsairs take his beaten force back to the ships":
      return `⛵ ${theLabelOfASide(fact.cName)}'s corsairs stand off the shore with boats ready — the beaten force pulls back to the ships in good order rather than being cut down.`;
    case "the attacker's shield-wall holds and the infantry stand their ground":
      return `${theLabelOfASide(fact.cName)}'s Shield-Wall holds — the infantry refuse to retreat and stand their ground, come what may.`;
    case 'the attacker has nowhere to retreat and takes further losses':
      return `${theLabelOfASide(fact.cName)}'s forces have nowhere to retreat — they rally desperately but take heavy additional losses!`;
    case "the attacker's forces retreat to a province":
      return `${theLabelOfASide(fact.cName)}'s forces retreat to ${fact.retreatToName}.`;
    case "the onlookers' summary of a battle":
      return `⚔ Battle at ${fact.provName}: ${fact.won ? `${theLabelOfASide(fact.attackersName)}'s forces defeat ${theLabelOfASideOrTheDefenders(fact.defendersName)}` : fact.betweenTwoHeroesHosts ? `${theLabelOfASideOrTheDefenders(fact.defendersName)}'s forces hold against ${theLabelOfASide(fact.attackersName)}` : `${theLabelOfASideOrTheDefenders(fact.defendersName)} hold against ${theLabelOfASide(fact.attackersName)}`}.`;
    case 'the most seasoned captain takes command of the combined host':
      return `\u{1F396} ${fact.leaderName} takes command of the combined host at ${fact.provName} \u2014 the most seasoned captain on the field, and ${fact.previousCommanderName}'s troops fall in behind him.`;
    case 'the blood harvest claims offerings from the fallen enemy units':
      return `\u{1FA78} Blood Harvest — the old gods claim their due from ${String(fact.fallenUnitCount)} fallen enemy unit${fact.fallenUnitCount !== 1 ? 's' : ''}: +${String(fact.offeringsGold)}g in offerings.`;
    case "the iron throne of skulls raises the enemy's fallen as skeletons":
      return `\u{1F480} Iron Throne of Skulls — ${String(fact.raisedCount)} of the enemy's fallen claw their way up to serve as your skeletons.`;
    case 'terror radiates from a province after an evil victory':
      return `💀 Terror radiates from ${fact.provName}${fact.surroundingLands.length ? ` into the surrounding lands (${fact.surroundingLands.join(', ')})` : ''} — any army that next defends there fights demoralised (−${String(fact.terrorPctPerStack)}% per terror, stacking).`;
    case 'terror lingers in a province and its defenders fight demoralised':
      return `💀 Terror lingers in ${fact.provName} — defenders fight at −${String(fact.terrorPct)}% strength (${String(fact.terrorStacks)} terror stack${fact.terrorStacks !== 1 ? 's' : ''} from earlier Evil victories nearby).`;
    case "a hero not at war with the province's realm gains a host inside it":
      return `👁 ${fact.cName}${theRealmsTag(fact.realmTag)} now leads ${String(fact.unitCount)} unit${fact.unitCount !== 1 ? 's' : ''} inside your province of ${fact.provName}, but makes no move against it — ${fact.theRealmsAreAllied ? 'your realms are allied' : 'your realms are not at war'}. ${fact.provName2} remains yours.`;
    case "a hero's new host is still forming up in a province":
      return `${fact.cName}'s new host is still forming up in ${fact.provName} — whether the province can be taken will be settled before the season's marches begin.`;
    case 'the hero turns a newly gathered host on a province and a battle is initiated':
      return `➡️ ${fact.cName}${theRealmsTag(fact.realmTag)} turns a newly-gathered host on ${fact.provName}, held by ${fact.heldByName} — a battle is initiated.`;
    case 'the defenders riding in were keeping watch and are already in the line':
      return `🛡 ${fact.ridersNames.join(' and ')} ${fact.ridersNames.length > 1 ? 'were' : 'was'} keeping watch over ${fact.provName} and ${fact.ridersNames.length > 1 ? 'are' : 'is'} already in the line when ${fact.cName}'s ${fact.onAWarFront ? 'host turns on the province' : 'new host forms up'} — ${fact.provName2} is defended, not retaken.`;
    case 'the defender is reinforced by other heroes in the defence of a province':
      return `${fact.defenderName} is reinforced by ${fact.reinforcementsNames.join(', ')} in the defence of ${fact.provName}!`;
    case "the province's standing troops rally to the defender":
      return `🛡 The standing troops of ${fact.provName} rally to ${fact.leaderName}: the garrison (${String(fact.garrisonUnitCount)} unit${fact.garrisonUnitCount !== 1 ? 's' : ''} — ${describeArmy(fact.garrison)}) joins the defence.`;
    case 'a hero fell in the battle line beside the commander of the defence':
      return `⚔ ${String(fact.heroName)} stood in the battle line beside ${String(fact.leaderName)} in the defence of ${String(fact.provName)}, and fell there — the full account is under ${String(fact.leaderName2)}.`;
    case 'a hero stands in the battle line beside the commander of the defence':
      return `⚔ ${fact.heroName} stands in the battle line beside ${fact.leaderName} in the defence of ${fact.provName} — the full account is under ${fact.leaderName2}.`;
    case "the province's standing troops fall back with the defender":
      return `The standing troops of ${String(fact.provName)} fall back to ${String(fact.fellBackToName)} with ${String(fact.defenderName)} rather than be left to the enemy.`;
    case "the province's standing troops fall in with the defender as the battle continues":
      return `🛡 The standing troops of ${fact.provName} fall in with ${fact.defenderName} and fight on at their side as the battle continues.`;
    case "the province's garrison is overwhelmed as the province falls":
      return `🛡 The garrison of ${fact.provName} is overwhelmed as the province falls — ${fact.overrunUnits.map(aUnitOfTheGarrison).join(', ')} ${fact.overrunUnits.length === 1 ? 'is' : 'are'} cut down defending the walls.`;
    case "the province's owner learns his defenders still hold against the hero":
      return `⚔ ${fact.cName}${theRealmsTag(fact.realmTag)} fought for ${fact.provName} this phase and had the better of it, but your defenders still hold the ground — ${fact.provName2} is not yet taken. ${fact.heroFell ? `${fact.cName} fell in the fighting; his leaderless host` : fact.cName} stands there with ${String(fact.unitCount)} unit${fact.unitCount !== 1 ? 's' : ''}.`;
    case "the province's owner learns the hero was beaten back":
      return `🛡 ${fact.cName}${theRealmsTag(fact.realmTag)} fought for ${fact.provName} this phase and was beaten back — ${fact.provName2} remains yours.`;
    case "a side's strength ladder begins":
      return `  ${fact.side === 'attacker' ? 'Attacker' : 'Defender'} (${theLabelOfASideAsTheReportLinesNameIt(fact.sideName)}): ${pl(fact.unitCount, 'unit')} — strength **${String(fact.strength)}**`;
    case "the strength ladder's units":
      return `    · Units: base ${String(fact.baseStrength)} → ${String(fact.unitsStrength)}${theWordsOfTheUnitsModifiers(fact.theUnitsModifiers)}`;
    case "the strength ladder's command":
      return `    · Command: ${String(fact.unitsStrength)} → ${String(fact.commandStrength)}${theWordsOfTheCommand(fact.theCommandMultipliers, fact.theSidesTactical, fact.unitCount)}`;
    case "the strength ladder's force-wide modifiers":
      return `    · Whole force: ${String(fact.commandStrength)} ${fact.theForceWideModifiers.map((x) => `× ${A_FORCE_WIDE_MODIFIERS_WORDS[x.reason]} ${ladderFm(x.m)}`).join(' ')} = ${String(fact.wholeForceStrength)}`;
    case 'the strength ladder has no force-wide modifiers':
      return `    · Whole force: no force-wide modifiers — ${String(fact.wholeForceStrength)}`;
    case "the strength ladder's pre-battle damage":
      return `    · Pre-battle volleys & spells: ${String(fact.wholeForceStrength)} − ${String(fact.preBattleDamage)} = ${String(fact.afterPreBattleDamage)} (${pl(fact.unitsHit, 'unit')} hit; taken off the finished figures)`;
    case "the strength ladder's battle lines":
      return `    · Battle lines (front of ${String(fact.frontWidth)}): ${String(fact.afterPreBattleDamage)} → ${fact.whoFacesWhomFollows ? String(fact.battleLinesStrength) : '**' + String(fact.battleLinesStrength) + '**'} (${battleGridStage({ units: fact.theUnitsPlaces })})`;
    case "the strength ladder's who faces whom":
      return `    · Who faces whom: ${String(fact.battleLinesStrength)} → **${String(fact.facingStrength)}** (${battleFacingStage({ face: { units: fact.theFacings } })})`;
    case "the strength ladder's units behind the front":
      return `    · Battle lines: ${String(fact.afterPreBattleDamage)} → **${String(fact.battleLinesStrength)}** (${pl(fact.unitsBehindTheFront, 'unit')} behind the ${String(fact.frontWidth)}-unit front at ${fact.theLinesMultipliersBehindTheFront.map((x) => '×' + String(x)).join(' / ')})`;
    case 'the ground allows a front of a width':
      return `📊 Battle lines — the ${theGroundAndItsVerb(fact.terrain)[0]} ${theGroundAndItsVerb(fact.terrain)[1]} a front of ${String(fact.frontWidth)}.`;
    case "a side's front line in the battle grid":
      return `📊 ${theSideAsTheGridShowsIt(fact.sideName)} 1st │ ${fact.theFrontLine.map(aCellOfTheGrid).join(' ')} │${theFlanksTheAirAndTheReserve(fact.theFlanks, fact.theAir, fact.theReserve)}`;
    case "a side's second line in the battle grid":
      return `📊 ${theSideAsTheGridShowsIt(fact.sideName)} 2nd │ ${fact.theSecondLine.map(aCellOfTheGrid).join(' ')} │`;
    case 'the scouting side chooses the front':
      return `📊 Scouting — ${theLabelOfASideAsTheReportLinesNameIt(fact.scoutName)} ${whyItScouts(fact.itsSideHasExploredMore, theLabelOfASideAsTheReportLinesNameIt(fact.scoutName), theLabelOfASideAsTheReportLinesNameIt(fact.otherSideName))}: ${theLabelOfASideAsTheReportLinesNameIt(fact.scoutName2)} ${whatItDoesWithTheFront(fact.frontWidth, fact.frontTheDiceAllow)} and lines up second${fact.adjustments ? ` (${String(fact.adjustments)} ${fact.adjustments === 1 ? 'adjustment' : 'adjustments'})` : ''}.`;
    case 'each side shifts its battle line':
      return `📊 Tactics — ${theLabelOfASideAsTheReportLinesNameIt(fact.otherSideName)} ${theShiftsOfALine(fact.otherSidesMoves)}; ${theLabelOfASideAsTheReportLinesNameIt(fact.scoutName)} ${theShiftsOfALine(fact.scoutsMoves)}.`;
    case "an unfinished battle against a province's defenders resumes":
      return `⚔ The unfinished battle for ${fact.provName} resumes — ${theLabelOfASide(fact.attackersHostName)} presses the attack on ${theLabelOfTheDefenders(fact.defendersName)}.`;
    case 'the attacker is pinned in a province with no way out':
      return `${theLabelOfASide(fact.attackersHostName)} is pinned in ${fact.provName} with no way out — the struggle continues next phase.`;
    case 'a contest for a province lapses as the realms are no longer at war':
      return `The contest for ${fact.provName} lapses — ${theNameOrElse(fact.attackersRealmName, 'one side')} and ${theNameOrElse(fact.defendersRealmName, 'the other')} are no longer at war, and the two hosts stand down.`;
    case "war comes to a province two realms' hosts share":
      return `⚔ War has come to ${String(fact.provName)}: ${theLabelOfASide(fact.attackersHostName)}${theRealmsTag(fact.attackersRealmTag)} and ${theLabelOfASide(fact.defendersHostName)}${theRealmsTag(fact.defendersRealmTag)} have stood on the same ground since the season opened, and with ${String(fact.seasonName)}'s orders done they fall upon each other.`;
    case 'an unfinished battle between two hosts resumes':
      return `⚔ The unfinished battle for ${fact.provName} resumes — ${theLabelOfASide(fact.attackersHostName)} and ${theLabelOfASide(fact.defendersHostName)} clash again.`;
    case 'the eagle riders mark the forest wardens and spoil the ambush':
      return `🦅 ${theLabelOfASideAsTheReportLinesNameIt(fact.shooterName)}'s Eagle Riders mark the Forest Wardens in the thickets — the ${theNameOfTheAbility('ambush')} is spoiled and the volley flies.`;
    case 'the gyrocopters harry a flying unit off its line':
      return `  💨 Gyrocopters harry the ${fact.targetUnitName} — driven off their line (−${String(fact.strengthLost)} strength).`;
    case "a side's gyrocopters climb to meet the enemy's flyers":
      return `🌀 ${theLabelOfASideAsTheReportLinesNameIt(fact.sideName)}'s Gnomish Gyrocopters climb to meet the enemy's flyers — ${String(fact.engagedCount)} engaged.`;
    case "a side's units fight beside their own kin":
      return `🤝 Kinship — ${theLabelOfASideAsTheReportLinesNameIt(fact.sideName)}: ${theWordsOfKinship(fact.unitsOfTheKingsRaceUnderACommanderOfThatBlood, fact.unitsOfTheKingsRace, fact.unitsOfTheirCommandersRace)}.`;
    case "a hero's host turns on a province it has shared with a realm at war":
      return `⚔ War stands between ${theNameOrElse(fact.attackersRealmName, 'their realm')} and ${theNameOrElse(fact.ownersRealmName, 'the realm whose host shares the ground')}, and ${fact.cName}${theRealmsTag(fact.realmTag)} has held ${String(fact.unitCount)} unit${fact.unitCount !== 1 ? 's' : ''} in ${fact.provName} since the season opened. With ${fact.seasonName}'s orders done, the host turns on the province${fact.ownersRealmName ? ` of ${fact.ownersRealmName}` : ''}.`;
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`a battle's line records a fact with no words: ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
