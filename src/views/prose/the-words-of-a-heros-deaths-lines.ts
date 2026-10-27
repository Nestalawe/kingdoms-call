// ── THE WORDS OF A HERO'S DEATH LINES (plan P1-12d5: P1-12's Decisions of 2026-10-26, Decisions 2 and 6) ──
// The views write the words of each fact a hero's death lines record (src/engine/heroes/the-facts-a-heros-death-lines-
// record.ts), in the same words the engine wrote before (heroes/hero-death-and-leaderless-hosts.ts). fmtRoll, which the
// engine still calls elsewhere, is imported from it. A kind with no words here is a compile error (the `never` below).
import type {
  TheFactOfAHerosDeathsLine,
  TheSurgeonsReachAFallenHeroTooLate,
} from '../../engine/heroes/the-facts-a-heros-death-lines-record.ts';
import type { AUnitAsDescribeArmyNamesIt } from '../../engine/dice-and-army-names.ts';
import { fmtRoll } from '../../engine/dice-and-army-names.ts';

/** How the dead commander fell, as his host's line says it: to whom, when known. */
function howTheyFell(slainBy: string | null): string {
  return slainBy ? `after their commander fell to ${slainBy}` : 'after their fall';
}

/** The summoned units whose binding fails, named: each its name and its type, or its type. */
function theSummonedUnits(units: readonly AUnitAsDescribeArmyNamesIt[]): string {
  return units.map((a) => `${a.unitName || a.type}${a.unitName ? ` (${a.type})` : ''}`).join(', ');
}

/** How many units a spared coward leaves behind: "1 unit", "3 units". */
function theUnits(count: number): string {
  return `${String(count)} unit${count !== 1 ? 's' : ''}`;
}

/** The words of the surgeons' line when they come too late (a hero's death's, and a duel's for his realm alone). */
export function theWordsOfTheSurgeonsComingTooLate(fact: Omit<TheSurgeonsReachAFallenHeroTooLate, 'kind'>): string {
  return `\u{1FA79} Battlefield Surgery: the surgeons reach ${fact.heroName} too late. ${fmtRoll(fact.chance, fact.roll)}`;
}

/** The words of one fact of a hero's death lines. */
export function theWordsOfAHerosDeathsLine(fact: TheFactOfAHerosDeathsLine): string {
  switch (fact.kind) {
    case 'the surgeons reach a fallen hero too late':
      return theWordsOfTheSurgeonsComingTooLate(fact);
    case "the binding of a fallen hero's summoned units fails": {
      const one = fact.units.length === 1;
      return `✨ With ${fact.heroName} fallen, the binding fails and ${theSummonedUnits(fact.units)} ${one ? 'dissolves' : 'dissolve'} back into the ${one ? 'realm that' : 'realms that'} spawned ${one ? 'it' : 'them'}.`;
    }
    case "a fallen hero's armies scatter as mercenaries":
      return fact.slainBy
        ? `${fact.heroName}'s armies, their commander slain by ${fact.slainBy}, scatter — they wander as mercenaries near ${fact.provinceName || 'their last position'}.`
        : `${fact.heroName}'s armies scatter — they wander as mercenaries near ${fact.provinceName || 'their last position'}.`;
    case "a fallen hero's armies garrison his realm's province":
      return `${fact.heroName}'s armies garrison in ${fact.provinceName} ${howTheyFell(fact.slainBy)}.`;
    case "a fallen hero's armies hold the open sea and claim it for his realm":
      return `${fact.heroName}'s armies hold ${fact.provinceName} ${howTheyFell(fact.slainBy)} — the water is claimed for ${fact.realmName ?? 'the realm'} and they garrison it.`;
    case "a fallen hero's leaderless armies retreat to his realm's ground":
      return fact.slainBy
        ? `${fact.heroName}'s leaderless armies retreat to ${fact.provinceName}, their commander slain by ${fact.slainBy}.`
        : `${fact.heroName}'s leaderless armies retreat to ${fact.provinceName}.`;
    case "a spared coward's host falls in under another commander":
      return `🏳 ${fact.heroName} begged for his life and is gone, but his host does not follow him: ${theUnits(fact.unitCount)} hold their ground in ${fact.provinceName} and fall in under ${fact.heirName}.`;
    case "a spared coward's host takes its place in the province's garrison":
      return `🏳 ${fact.heroName} abandons his command in ${fact.provinceName} — with no officer left to lead them, ${theUnits(fact.unitCount)} of his host take their place in the province garrison.`;
    case 'a spared coward slips away and leaves his host leaderless':
      return `🏳 ${fact.heroName} slips away from ${fact.provinceName} with his life, leaving ${theUnits(fact.unitCount)} leaderless on ground the realm does not hold.`;
    case "a hero is struck down at death's door but not slain":
      return `\u{1FA79} ${fact.heroName} is struck down — at death's door, but not slain.`;
    case 'the blow meant for a vanished hero passes through shadow':
      return `🌫 The blow meant for ${fact.heroName} passes through shadow — they vanished, and cannot be touched this season.`;
    case 'Battlefield Surgery saves a fallen hero':
      return `\u{1FA79} Battlefield Surgery: ${fact.heroName} is dragged from the field at death's door — the realm's surgeons pull ${fact.isKing ? 'the king' : 'them'} back with 1 HP. ${fmtRoll(fact.chance, fact.roll)}`;
    case "a fallen commander's host fights on under its senior captain":
      return `⚑ ${fact.heroName} has fallen, but the battle for ${fact.provinceName} is not done — the senior captain takes up the banner and the host fights on.`;
    case "a fallen hero's possessions pass on":
      return `${fact.heroName}'s possessions — ${fact.itemNames.join(', ')} — pass to ${fact.recipientName}.`;
    case "a hero takes a fallen foe's possessions":
      return `🗡 ${fact.recipientName} takes ${fact.heroName}'s possessions from the fallen: ${fact.itemNames.join(', ')}.`;
    case "a fallen hero's possessions are lost with no heir":
      return `${fact.heroName}'s possessions are lost — no heir to receive them.`;
    case 'a fallen Divine monarch will rise again on holy ground':
      return `✨ ${fact.heroName}, monarch of a Divine realm, has fallen — but the divine do not abandon their anointed while the realm keeps holy ground. No heir will be crowned: the crown lies empty for one full turn, and ${fact.heroName} will rise again at the start of the turn after next, in the nearest consecrated province (which gives up its consecration to restore them), at half health, without armies or items. Should the realm lose all its consecrated ground first, the grace is lost and an heir is crowned. Until then the realm has no king: no diplomacy may be declared and no Reckoning called.`;
    case 'a fallen Divine monarch has no holy ground to return to':
      return `✨ ${fact.heroName}, monarch of a Divine realm, has fallen — and the realm holds no consecrated ground to which the divine could return them. An heir must take the crown.`;
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`a hero's death lines have no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
