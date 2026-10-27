// ── THE WORDS OF THE ARMY ORDERS' LINES (plan P1-12d7: P1-12's Decisions of 2026-10-26, Decisions 3, 6 and 7) ──
// The views write the words of each fact the army orders' lines record (src/engine/orders/the-facts-the-army-orders-
// lines-record.ts), in the same words the engine wrote before (orders/army-orders-hand-over-garrison-disband-and-pick-
// up-companies-and-release-a-hero.ts). The words of a commander's beast command moved here from the engine
// (world/tables.ts) once the army orders, its last engine callers, recorded it as a fact; the Recruit and Hire orders'
// prose reads them here. strandLabel, which the engine still calls for its own lines, is imported from it and called on
// the units the fact copied as the line was told. A kind with no words here is a compile error (the `never` below).
import type {
  TheFactOfTheArmyOrdersLine,
  WhyAHandOverAtSeaIsRefused,
} from '../../engine/orders/the-facts-the-army-orders-lines-record.ts';
import type { AUnitAsDescribeArmyNamesIt } from '../../engine/dice-and-army-names.ts';
import type { ABeastCommandAsALineTellsIt } from '../../engine/world/tables.ts';
import { strandLabel } from '../../engine/units/sea-lift-stranding-and-retreats.ts';

/** The words of a commander's beast command: "Aldric can lead only 2 Creature or Monster units (Druid 2)". */
export function theWordsOfABeastCommand(command: ABeastCommandAsALineTellsIt): string {
  const d = command.druid;
  return `${command.commanderName} can lead only ${String(d)} Creature or Monster unit${d !== 1 ? 's' : ''} (Druid ${String(d)})`;
}

/** The units a line names, each by its name (or its type, if it has none), joined. */
function theUnitsByName(units: readonly AUnitAsDescribeArmyNamesIt[]): string {
  return units.map((a) => a.unitName || a.type).join(', ');
}

/** Why a hand-over at sea is refused, as its line says it. */
function whyAHandOverAtSeaIsRefused(why: WhyAHandOverAtSeaIsRefused, heroName: string): string {
  switch (why.kind) {
    case "the giver's remaining ships would be too few to carry his column":
      return `the ships that stay would be too few to carry the rest of ${heroName}'s column`;
    case "the recipient's ships could not carry the companies":
      return `${why.recipientName}'s ships could not carry them`;
  }
}

/** The words of one fact of the army orders' lines. */
export function theWordsOfTheArmyOrdersLine(fact: TheFactOfTheArmyOrdersLine): string {
  switch (fact.kind) {
    case 'a hero has no companies to hand over':
      return `${fact.heroName}: no armies to transfer.`;
    case 'the comrade named to take the companies had already marched on':
      return `${fact.heroName} cannot hand the troops to ${fact.recipientName} — they had already marched on to ${fact.provinceName} before the column could be handed over. The troops stay under ${fact.heroName}'s command.`;
    case 'companies can be handed only to a comrade of the realm standing here':
      return `${fact.heroName} cannot transfer armies — the recipient must be one of your own characters standing in ${fact.provinceName}.`;
    case 'a hero cannot garrison companies in a province his realm does not hold':
      return `${fact.heroName} cannot garrison armies in ${fact.provinceName} — you do not control this province, so there is no garrison to leave them in. The troops stay under their command.`;
    case 'the companies named to hand over are not in the column':
      return `${fact.heroName}: could not find specified armies to transfer.`;
    case 'a hand-over out on open water is refused': {
      const _lbl = theUnitsByName(fact.units);
      return `⚓ ${fact.heroName} cannot ${fact.recipientName !== null ? `hand ${_lbl} to ${fact.recipientName}` : `leave ${_lbl} in ${fact.provinceName}`} out on open water — ${whyAHandOverAtSeaIsRefused(fact.why, fact.heroName)}. The order is refused and the troops stay where they are.`;
    }
    case 'risen dead refuse to follow a commander who is not Undead':
      return `💀 ${fact.units.map((a) => a.unitName || a.type).join(', ')} refuse to follow a non-Undead commander — they dig their own graves and go to sleep.`;
    case "beasts beyond the recipient's beast command stay with the giver":
      return `🐾 ${theWordsOfABeastCommand(fact.beastCommand)}: ${fact.units.map((a) => a.unitName || a.type).join(', ')} ${fact.units.length === 1 ? 'stays' : 'stay'} with ${fact.heroName}.`;
    case 'a hero hands companies to a comrade':
      return `${fact.heroName} transfers ${fact.units.map((a) => a.unitName || a.type).join(', ')} to ${fact.recipientName}.`;
    case 'a comrade takes command of companies handed to him':
      return `⚔ ${fact.recipientName} takes command of ${fact.units.map((a) => a.unitName || a.type).join(', ')}, handed over by ${fact.heroName} in ${fact.provinceName}.`;
    case 'a hero leaves companies in the garrison':
      return `${fact.heroName} garrisons ${fact.unitTypes.join(', ')} in ${fact.provinceName}.`;
    case 'a hero who left every company behind travels light':
      return `${fact.heroName} left all armies behind in ${fact.provinceName} — now travelling light (land ${String(fact.landMovePoints)}, sea ${String(fact.seaMovePoints)} move points).`;
    case 'a king cannot release himself from his own service':
      return `${fact.heroName} wears the crown — a king cannot release himself from his own service.`;
    case 'a hero leading companies cannot be released':
      return `${fact.heroName} cannot be released while leading ${String(fact.companies)} unit${fact.companies !== 1 ? 's' : ''} — transfer, garrison or disband the troops first.`;
    case "a hero is released from the realm's service": {
      const named = fact.itemNames.filter((name) => name !== null);
      const _itemNote = fact.itemNames.length ? ` They take ${named.join(', ')} with them.` : '';
      return `🕊 ${fact.heroName} is released from ${fact.realmName ?? 'the realm'}'s service in ${fact.provinceName} and takes up the wanderer's life.${_itemNote} They may be hired again from next turn.`;
    }
    case 'a hero has no companies to disband':
      return `${fact.heroName}: no armies to disband.`;
    case 'the companies named to disband are not in the column':
      return `${fact.heroName}: could not find specified armies to disband.`;
    case 'risen dead cannot be disbanded as mercenaries':
      return `💀 ${fact.units.map((a) => a.unitName || a.type).join(', ')} cannot be disbanded as mercenaries — skeletal armies return to their graves and crumble to dust.`;
    case 'a hero disbands a company into a mercenary band':
      return `${fact.heroName} disbands ${fact.unitName || fact.unitType} (${fact.quality}) — they become a mercenary band in ${fact.provinceName}.`;
    case 'a hero who disbanded every company travels light':
      return `${fact.heroName} has disbanded all armies — now travelling light (land ${String(fact.landMovePoints)}, sea ${String(fact.seaMovePoints)} move points).`;
    case 'a hero finds no garrison companies to take up':
      return `${fact.heroName} finds no garrison armies in ${fact.provinceName} to pick up.`;
    case 'a hero takes command of the whole garrison':
      return `${fact.heroName} takes command of all ${String(fact.companies)} garrisoned unit${fact.companies !== 1 ? 's' : ''} in ${fact.provinceName}.`;
    case 'mercenaries are not taken up with a Pick Up order':
      return `${fact.heroName} cannot simply take up a mercenary band with a Pick Up order — mercenaries are hired through Recruit Armies. (Pick Up Army takes only unled garrison units.)`;
    case 'a hero finds no matching garrison companies to take up':
      return `${fact.heroName} finds no matching garrison armies in ${fact.provinceName} to pick up.`;
    case 'a hero takes command of companies chosen from the garrison': {
      const _lbl = fact.units
        .map((a) => (a.unitName ? a.unitName + ' (' + a.quality + ' ' + a.type + ')' : a.quality + ' ' + a.type))
        .join(', ');
      return `${fact.heroName} takes command of ${_lbl} from the garrison in ${fact.provinceName}.`;
    }
    case "a hero cannot take up a comrade's company":
      return `${fact.heroName}: cannot pick up army.`;
    case "a hero takes command of a comrade's company":
      return `${fact.heroName} takes command of ${fact.unitName ? fact.unitName + ' (' + fact.quality + ' ' + fact.unitType + ')' : fact.quality + ' ' + fact.unitType} from ${fact.comradeName}.`;
    case 'a hero takes up a company from the garrison':
      return `${fact.heroName} picks up ${fact.unitName ? fact.unitName + ' (' + fact.quality + ' ' + fact.unitType + ')' : fact.quality + ' ' + fact.unitType} from the garrison in ${fact.provinceName}.`;
    case "beasts taken up beyond the leader's beast command go back":
      return `🐾 ${theWordsOfABeastCommand(fact.beastCommand)}: ${fact.units.map((a) => a.unitName || a.type).join(', ')} ${fact.units.length === 1 ? 'stays' : 'stay'} ${fact.comradeName !== null ? `with ${fact.comradeName}` : `in the garrison of ${fact.provinceName}`}.`;
    case "units the leader's ships cannot carry on open water stay behind":
      return `⚓ ${fact.units.map(strandLabel).join(', ')} cannot be taken aboard — ${fact.heroName}'s ships have no room for them on open water, so ${fact.units.length === 1 ? 'it stays' : 'they stay'} ${fact.comradeName !== null ? `with ${fact.comradeName}` : `in the garrison of ${fact.provinceName}`}.`;
    case 'a hero now leads his column':
      return `${fact.heroName} now leads ${String(fact.companies)} arm${fact.companies !== 1 ? 'ies' : 'y'}. Land MPs: ${String(fact.landMovePoints)}, Sea MPs: ${String(fact.seaMovePoints)}.`;
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`the army orders' lines have no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
