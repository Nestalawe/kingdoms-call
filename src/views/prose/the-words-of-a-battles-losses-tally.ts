// ── THE WORDS OF A BATTLE'S LOSSES TALLY (plan P1-12d35: P1-12d's Decisions of 2026-11-01, Decision 2) ──
// One line for the short account of a battle: "⚰ Losses — **Vervain**: 1 of 6 units lost (Shadow Archers) · …". The
// views write it from the facts of the battle's lines (theTurnsLinesInWords puts it where the casualty lists begin):
// - each side's units, from its force drawn up for battle (`armies`, phantoms left out): the "of 6" and the types;
// - each side's name, from its casualty list's header (the label the header's words give), else its role;
// - each company's fate, credited to the side whose header names the company's owner as its line names him, else to
//   the side whose casualty list it follows; counted by its fate: lost (it dies, is cut down with no escape, or is cut
//   down and rises again by its Regenerating Hide: question 37), disbanded, demoted or promoted, or not at all;
// - its type, found on its side's force: by its type where its line names the type (a company named with its quality,
//   or as it disbands, or by its type when it has no name), else by its name (a company named by its name alone, as a
//   company cut down with no escape is): the type of its side's company of that name; else "unit";
// - a whale cohort's breach before the lines join: a hull lost by the side the fact names.
// A fate before the first casualty list is not counted; a battle with no side to tally has no tally.
import type { LineFact } from '../../engine/turn/events-and-their-audiences.ts';
import type { AValueInALinesWords } from '../../engine/personal-combat/the-facts-a-personal-combats-lines-record.ts';
import type {
  AUnitAsALineNamesIt,
  AUnitOfAForceDrawnUp,
  TheOwnerOfABattlesUnits,
} from '../../engine/battle/the-facts-a-battles-lines-record.ts';
import { theLabelOfASide, theLabelOfASideOrTheDefenders } from './the-words-of-a-battles-lines.ts';

/** A side of a battle, as a force's role names it. */
type TheRoleOfASide = 'attacker' | 'defender';

/** How the tally counts a company's fate: lost, disbanded, demoted, promoted. */
type HowTheTallyCountsAFate = 'lost' | 'disbanded' | 'demoted' | 'promoted';

/** A company, as the tally finds it on its side's force: its type, its name, and whether its line names its type. */
interface ACompanyAsTheTallyFindsIt {
  type: string;
  unitName: string | null | undefined;
  itsLineNamesItsType: boolean;
}

/** A company's fate, as the tally reads it: the owner its line names (his label, or null when it names none), the
 *  company, and how it is counted. */
interface ACompanysFateInTheTally {
  owner: string | null;
  company: ACompanyAsTheTallyFindsIt;
  counted: HowTheTallyCountsAFate;
}

/** A side, as its tally counts it: its name, its role, the types it lost and those that disbanded, and how many of its
 *  companies were demoted and promoted. */
interface ASidesLossesInTheTally {
  name: string;
  role: TheRoleOfASide;
  lost: string[];
  disbanded: string[];
  demoted: number;
  promoted: number;
}

/** The owner a company's line names: his label, or null when the line names none (a company named by its name or type
 *  alone, or one with no owner). */
function theOwnerItsLineNames(owner: TheOwnerOfABattlesUnits | null): string | null {
  if (!owner) return null;
  const label = theLabelOfASideOrTheDefenders(owner);
  return label === '' ? null : label;
}

/** The owner a unit's record names, as its line writes it. */
function theOwnerOfTheUnitItsLineNames(unit: AUnitAsALineNamesIt): string | null {
  return unit.kind === 'a unit named by its name or type alone' ? null : theOwnerItsLineNames(unit.owner);
}

/** A unit's record as the tally finds it: its line names its type unless it names the unit by its name (ownedUnitName's
 *  "Aldric's Ford Watch", or its name alone), as unitRef, ownedUnitName and theLabelOfAUnit write it. */
function aUnitAsTheTallyFindsIt(unit: AUnitAsALineNamesIt): ACompanyAsTheTallyFindsIt {
  const namedWithItsTypeInBrackets = /^the\s/i.test(unit.unitName);
  const itsLineNamesItsType =
    unit.kind === 'a unit named with its quality' ||
    !unit.unitName ||
    (unit.kind === 'a unit named without its quality' && namedWithItsTypeInBrackets);
  return { type: unit.type, unitName: unit.unitName, itsLineNamesItsType };
}

/** A company as its line names it when it disbands (disbandLine: always with its type). */
const aDisbandingCompany = (unitType: string, unitName: string | null | undefined): ACompanyAsTheTallyFindsIt => ({
  type: unitType,
  unitName,
  itsLineNamesItsType: true,
});

/** A line's fact, when it is a company's fate the tally counts: its owner, the company and its count; else null. */
function aCompanysFateTheTallyCounts(fact: LineFact): ACompanysFateInTheTally | null {
  if (fact.kind === "a unit's fate in the battle") {
    if (fact.fate === 'has had enough and disbands')
      return {
        owner: theOwnerItsLineNames(fact.theUnitsOwner),
        company: aDisbandingCompany(fact.unitType, fact.unitName),
        counted: 'disbanded',
      };
    const asTheUnit = (counted: HowTheTallyCountsAFate): ACompanysFateInTheTally => ({
      owner: theOwnerOfTheUnitItsLineNames(fact.theUnit),
      company: aUnitAsTheTallyFindsIt(fact.theUnit),
      counted,
    });
    switch (fact.fate) {
      case 'dies':
      case 'is cut down with no escape':
      case 'is cut down and rises again by its regenerating hide':
        return asTheUnit('lost');
      case 'rises a tier':
        return asTheUnit('promoted');
      case 'loses heart and falls a tier':
        return asTheUnit('demoted');
      case 'falls back behind the shield wall in good order':
      case 'keeps its nerve under the knightly example':
        return null;
    }
  }
  if (fact.kind === "a beaten guard's surviving unit's fate") {
    switch (fact.fate) {
      case 'loses heart and falls a tier':
        return {
          owner: theOwnerOfTheUnitItsLineNames(fact.theUnit),
          company: aUnitAsTheTallyFindsIt(fact.theUnit),
          counted: 'demoted',
        };
      case 'has had enough and disbands':
        return {
          owner: theOwnerItsLineNames(fact.theGuard),
          company: aDisbandingCompany(fact.unitType, fact.unitName),
          counted: 'disbanded',
        };
      case 'breaks ranks and flees as mercenaries':
      case 'holds its ground unbroken':
        return null;
    }
  }
  return null;
}

/** A hull a whale cohort sinks, as its line names it: by its name, else by its type (its name is its type then). */
function theSunkHull(targetUnitName: AValueInALinesWords, targetUnitType: string): ACompanyAsTheTallyFindsIt {
  return {
    type: targetUnitType,
    unitName: String(targetUnitName),
    itsLineNamesItsType: targetUnitName === targetUnitType,
  };
}

/** The types of a list, each with how many times it comes (in the order each first comes): "2× Levies, Archers". */
function theTypesCounted(types: readonly string[]): string {
  const counts = new Map<string, number>();
  types.forEach((type) => counts.set(type, (counts.get(type) ?? 0) + 1));
  return [...counts].map(([type, n]) => (n > 1 ? `${String(n)}× ${type}` : type)).join(', ');
}

/** The losses tally of a battle, from the facts of its lines in their order (a line with no fact is read as nothing):
 *  "⚰ Losses — **<side>**: <n> of <units> units lost (<types>), <n> disbanded (<types>), <n> demoted, <n> promoted ·
 *  …", the attacker first; null when no side has a casualty list or a hull lost. */
export function theWordsOfABattlesLossesTally(facts: readonly (LineFact | undefined)[]): string | null {
  const theUnitsOfEachSide: Record<TheRoleOfASide, AUnitOfAForceDrawnUp[]> = { attacker: [], defender: [] };
  // Each side's casualty list's header, in the order they come (the first of each side's).
  const theHeaders: { role: TheRoleOfASide; label: string }[] = [];
  for (const fact of facts) {
    if (fact === undefined) continue;
    if (fact.kind === 'a force drawn up for battle') {
      if (fact.role === 'attacker' || fact.role === 'defender')
        theUnitsOfEachSide[fact.role].push(...fact.armies.filter((unit) => !unit.phantom));
    } else if (fact.kind === "the attacker's casualties begin") {
      if (!theHeaders.some((h) => h.role === 'attacker'))
        theHeaders.push({ role: 'attacker', label: theLabelOfASide(fact.atkName) });
    } else if (fact.kind === "the defender's casualties begin") {
      if (!theHeaders.some((h) => h.role === 'defender'))
        theHeaders.push({ role: 'defender', label: theLabelOfASideOrTheDefenders(fact.defName) });
    }
  }
  const sides: ASidesLossesInTheTally[] = [];
  const theSide = (role: TheRoleOfASide): ASidesLossesInTheTally => {
    let side = sides.find((s) => s.role === role);
    if (!side) {
      side = {
        name: theHeaders.find((h) => h.role === role)?.label ?? role,
        role,
        lost: [],
        disbanded: [],
        demoted: 0,
        promoted: 0,
      };
      sides.push(side);
    }
    return side;
  };
  /** A company's type as its side's force has it: its own, where its line names its type and the force lists it; else
   *  that of the force's company of its name (one named other than its type); else "unit". */
  const theTypeOnItsSidesForce = (company: ACompanyAsTheTallyFindsIt, role: TheRoleOfASide): string => {
    const force = theUnitsOfEachSide[role];
    if (company.itsLineNamesItsType && company.type && force.some((unit) => unit.type === company.type))
      return company.type;
    const ofItsName = company.unitName
      ? force.find((unit) => unit.unitName && unit.unitName !== unit.type && unit.unitName === company.unitName)
      : undefined;
    return ofItsName !== undefined && ofItsName.type !== '' ? ofItsName.type : 'unit';
  };
  let theListItFollows: TheRoleOfASide | null = null;
  for (const fact of facts) {
    if (fact === undefined) continue;
    if (fact.kind === "a side's whale cohort sinks an enemy ship") {
      const role = fact.theSideWhoseShipSinks;
      theSide(role).lost.push(theTypeOnItsSidesForce(theSunkHull(fact.targetUnitName, fact.targetUnitType), role));
      continue;
    }
    if (fact.kind === 'a whale cohort sinks a defending ship before a shot is fired') {
      theSide('defender').lost.push(
        theTypeOnItsSidesForce(theSunkHull(fact.targetUnitName, fact.targetUnitType), 'defender'),
      );
      continue;
    }
    if (fact.kind === "the attacker's casualties begin" || fact.kind === "the defender's casualties begin") {
      theListItFollows = fact.kind === "the attacker's casualties begin" ? 'attacker' : 'defender';
      theSide(theListItFollows);
      continue;
    }
    if (theListItFollows === null) continue;
    const fate = aCompanysFateTheTallyCounts(fact);
    if (fate === null) continue;
    const owner = fate.owner;
    const side = theSide(theHeaders.find((h) => owner !== null && h.label === owner)?.role ?? theListItFollows);
    switch (fate.counted) {
      case 'lost':
        side.lost.push(theTypeOnItsSidesForce(fate.company, side.role));
        break;
      case 'disbanded':
        side.disbanded.push(theTypeOnItsSidesForce(fate.company, side.role));
        break;
      case 'demoted':
        side.demoted++;
        break;
      case 'promoted':
        side.promoted++;
        break;
    }
  }
  if (!sides.length) return null;
  sides.sort((a, b) => (a.role === 'attacker' ? 0 : 1) - (b.role === 'attacker' ? 0 : 1));
  const parts = sides.map((side) => {
    const units = theUnitsOfEachSide[side.role].length,
      n = side.lost.length;
    const bits = [
      n
        ? `${String(n)}${units ? ` of ${String(units)}` : ''} unit${(units || n) !== 1 ? 's' : ''} lost (${theTypesCounted(side.lost)})`
        : 'no units lost',
    ];
    if (side.disbanded.length)
      bits.push(`${String(side.disbanded.length)} disbanded (${theTypesCounted(side.disbanded)})`);
    if (side.demoted) bits.push(`${String(side.demoted)} demoted`);
    if (side.promoted) bits.push(`${String(side.promoted)} promoted`);
    return `**${side.name}**: ${bits.join(', ')}`;
  });
  return `⚰ Losses — ${parts.join(' · ')}.`;
}
