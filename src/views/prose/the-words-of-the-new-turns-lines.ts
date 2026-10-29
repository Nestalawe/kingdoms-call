// ── THE WORDS OF THE NEW TURN'S LINES (plan P1-12d15: P1-12's Decisions of 2026-10-29, Decision 3) ──
// The views write the words of each fact the new turn's lines record (src/engine/turn/the-facts-the-new-turns-lines-
// record.ts), in the same words the engine wrote before (turn/new-turn-counter-king-succession-summons-and-spells-end-
// and-the-grand-designs.ts and turn/new-turn-war-academy-informants-divine-resurrection-graves-mercenaries-wanderers-
// and-the-final-reconcile.ts): a province with no name "unknown", a terrain with none "unknown terrain", a unit by its
// name and type or by its type alone, the units released joined with commas, and the plurals from the counts. The save
// check's line begins "[Save check] " (the balance matrix reads it: tools/balance/a-game-fails-on-the-save-check.ts) and
// its places are written by the save's check's own words (whatTheSavesCheckFoundInWords). A kind with no words here is
// a compile error (the `never` below).
import type {
  AUnitAsTheNewTurnNamesIt,
  TheFactOfANewTurnsLine,
} from '../../engine/turn/the-facts-the-new-turns-lines-record.ts';
import { whatTheSavesCheckFoundInWords } from '../../engine/saves/what-the-saves-check-found-in-words.ts';

/** An elemental released, as the line names it: "Storm Lord (Air Elemental)", or its type alone. */
function anElementalsName(unit: AUnitAsTheNewTurnNamesIt): string {
  return `${unit.unitName ?? unit.unitType}${unit.unitName ? ` (${unit.unitType})` : ''}`;
}

/** A beast of the Wild Hunt, as the line names it: its name, else its type, and its type. */
function aBeastsName(unit: AUnitAsTheNewTurnNamesIt): string {
  return `${unit.unitName ?? unit.unitType} (${unit.unitType})`;
}

/** The words of one fact of the new turn's lines. */
export function theWordsOfANewTurnsLine(fact: TheFactOfANewTurnsLine): string {
  switch (fact.kind) {
    case 'a Divine king cannot return with no consecrated ground left':
      return `✨ The realm's last consecrated ground is gone, and with it the way back for ${fact.kingName}: the divine cannot restore a monarch where no holy ground remains. An heir takes the crown.`;
    case "a realm's king has fallen with no lands left and the dynasty is extinguished":
      return `⚠ ${fact.realmName}'s king has fallen and no lands remain — their dynasty is extinguished.`;
    case 'an heir is crowned':
      return `👑 With the old king fallen, ${fact.heirName} is crowned in ${fact.provinceName}. Name them, choose their Temper and allocate their 4 remaining skill points before submitting orders.`;
    case 'summoned elementals are released as the season turns': {
      const one = fact.elementals.length === 1;
      return `✨ As the season turns, ${fact.elementals.map(anElementalsName).join(', ')} ${one ? 'is' : 'are'} released from ${one ? 'its' : 'their'} bonds and ${one ? 'returns' : 'return'} to the Elemental Realm, leaving ${fact.heroName}'s host.`;
    }
    case "the Wild Hunt's beasts slip the binding":
      return `\u{1F43E} The Wild Hunt is done — ${fact.beasts.map(aBeastsName).join(', ')} slip the binding and melt back into the wilds, leaving ${fact.heroName}'s host.`;
    case 'the Grand Library has no discovery left to unlock':
      return `📚 Grand Library: your scholars have already unlocked every known discovery.`;
    case "the Grand Library's scholars uncover a discovery":
      return `📚 Grand Library: this turn your scholars uncover — **${fact.discoveryName}** (${fact.category}). ${fact.description}`;
    case 'the War Academy drills a company up a grade':
      return `War Academy: ${fact.unitName ? fact.unitName + ' (' + fact.unitType + ')' : 'a ' + fact.unitType} in ${fact.provinceName} trains to ${fact.quality}!`;
    case "the War Academy's drills produce no promotion":
      return `War Academy: the drills in ${fact.provinceName} produced no promotions this turn.`;
    case "a hero's wounds knit in the physick gardens":
      return `🌿 ${fact.heroName}'s wounds knit in the physick gardens: +${String(fact.healed)} HP (${String(fact.hp)}/${String(fact.maxHp)}).`;
    case 'the informants surface no enemy captain unseen':
      return `[Intelligence] Your informants surface nothing new — every enemy captain they could name is already within your sight.`;
    case 'the Informant Network names where an unseen enemy captain was last':
      return `[Intelligence] Informant Network reports: ${fact.heroName} of ${String(fact.realmName)} — unseen by your own eyes — was last in ${fact.provinceName ?? 'unknown'}.`;
    case 'the Arcane Observatory finds no uncharted province left':
      return `🔭 Arcane Observatory: your astronomers find no uncharted province left to study — the whole known world is already mapped in full.`;
    case 'the Arcane Observatory charts a province in full':
      return `🔭 Arcane Observatory: your astronomers chart **${fact.provinceName}** (${fact.terrain ?? 'unknown terrain'}) in full from afar — the province is now 100% explored.`;
    case 'a Divine hero does not return with no consecrated ground held':
      return `✨ ${fact.heroName} does not return. The divine restore the fallen only upon consecrated ground, and the realm holds none — the grace is lost. (The body remains where it lies; a Resurrect spell may yet reach it.)`;
    case 'a Divine hero returns to life on the nearest consecrated ground':
      return `✨ **Divine Resurrection**: ${fact.heroName}${fact.wasKing ? ', your monarch,' : ''} returns to life by the grace of the divine! They appear in ${fact.provinceName}, the nearest consecrated ground, with ${String(fact.hp)} HP — no armies or items, but their spirit and skills endure. The miracle spends the province's consecration: ${fact.provinceName} is holy ground no longer, and the crown may sanctify new ground in its place.${fact.wasKing ? ' The crown is worn once more.' : ''}`;
    case 'a mercenary band retires and disperses':
      return `The mercenary band ${fact.bandName} in ${fact.provinceName ?? 'unknown'} has retired and dispersed.`;
    case "the heroes' wandering tags are corrected":
      return `[Integrity] ${String(fact.heroes)} hero${fact.heroes !== 1 ? 'es' : ''} in a realm's service still bore the “(wandering)” tag — the name has been corrected.`;
    case 'retired Sage discoveries are removed from the realms':
      return `[Integrity] ${String(fact.discoveries)} retired Sage discover${fact.discoveries !== 1 ? 'ies were' : 'y was'} removed from realm records.`;
    case "the save the turn loaded differs from this build's schema":
      return `[Save check] ${whatTheSavesCheckFoundInWords(fact.places)}`;
    case 'a stale grave of a living hero is removed':
      return `[Integrity] ${fact.heroName} was listed in the graveyard while alive — the stale grave has been removed.`;
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`the new turn's lines have no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
