// ── THE WORDS OF THE ITEM ORDERS' LINES (plan P1-12d6: P1-12's Decisions of 2026-10-26, Decisions 6 and 7) ──
// The views write the words of each fact the item orders' lines record (src/engine/orders/the-facts-the-item-orders-
// lines-record.ts), in the same words the engine wrote before (orders/item-orders-equip-use-and-send-magic-items.ts).
// A kind with no words here is a compile error (the `never` below).
import type { TheFactOfTheItemOrdersLine } from '../../engine/orders/the-facts-the-item-orders-lines-record.ts';

/** The words of one fact of the item orders' lines. */
export function theWordsOfTheItemOrdersLine(fact: TheFactOfTheItemOrdersLine): string {
  switch (fact.kind) {
    case 'a hero carries nothing that can be worn or wielded':
      return `${fact.heroName} carries nothing that can be worn or wielded.`;
    case 'a hero arms and dresses for the season': {
      const worn = fact.worn.map((it) => `${it.name} [${it.slot}]`);
      return `\u{1F6E1} ${fact.heroName} arms and dresses for the season — now wearing: ${worn.join(', ') || 'nothing'}.${fact.refused.length ? ` Could not also wear ${fact.refused.join(', ')} (slot already filled).` : ''}`;
    }
    case 'a charmed hero will not spend what he carries':
      return `${fact.heroName} will not spend what they carry at another's bidding — a mind held by enchantment keeps its treasures to itself.`;
    case 'a hero has no such item to use':
      return `${fact.heroName}: no such item to use.`;
    case 'an item has already been used':
      return `The ${fact.itemName} has already been used.`;
    case "the Philosopher's Stone finds nothing to work on and is not spent":
      return `${fact.heroName} raises the ${fact.stoneName}, but there is nothing for it to work on — ${fact.theRealmHasNoUnits ? 'your realm has no armies in the field or in garrison' : 'every unit you command is already Elite'}. The Stone is NOT spent, and may be invoked another turn.`;
    case "the GM's note of the undiscovered Stones struck from the lair hoards":
      return `(GM note: ${String(fact.struck)} undiscovered ${fact.stoneName}${fact.struck !== 1 ? 's were' : ' was'} struck from the world's lair hoards — the artefact is destroyed.)`;
    case "the Philosopher's Stone raises the realm's units a tier and crumbles": {
      const led = fact.led;
      const garr = fact.garrisoned;
      const _parts = [`${String(led)} marching under your commanders`, `${String(garr)} in your garrisons`].filter(
        (_, i) => (i === 0 ? led : garr) > 0,
      );
      return `✨ ${fact.heroName} invokes the ${fact.stoneName} — a wave of power sweeps the realm and ${String(fact.raised)} army unit${fact.raised !== 1 ? 's' : ''} advance one quality tier (${_parts.join(', ')}${fact.alreadyElite > 0 ? `; ${String(fact.alreadyElite)} already Elite and unchanged` : ''}). The Stone crumbles to grey dust in ${fact.heroName}'s hands: its work is done, and there is not another in the world.`;
    }
    case "the world sees the Philosopher's Stone burned out":
      return `🌍 A light passes over the world: somewhere in ${fact.provinceName}, ${fact.isTheirOwnHero ? `your own ${fact.heroName}` : (fact.realmName ?? 'a distant realm')} has worked the ${fact.stoneName} and burned it out. Every soldier of that realm stands a little taller tonight — and the Stone itself is gone from the world for good. No lair will yield another.`;
    case 'a passive item needs no using':
      return `The ${fact.itemName} is a passive item and does not need to be used — its power is always active.`;
    case 'a charmed hero will part with nothing':
      return `${fact.heroName} will part with nothing — a mind held by enchantment guards its own possessions, whatever it is bidden.`;
    case 'a hero cannot send items: there is no such recipient':
      return `${fact.heroName}: cannot send item — no such recipient.`;
    case 'a hero keeps the items: the recipient is held by a Charm':
      return `${fact.heroName} keeps the items — ${fact.recipientName} is held by a Charm, and an enchanted mind is trusted with nothing. Send them on once the hero serves you of their own will.`;
    case "a hero keeps the items: the recipient is not in the realm's service":
      return `${fact.heroName} keeps the items — ${fact.recipientName} is not in your service${fact.recipientIsAlive ? '' : ' (they have fallen)'}: the hire, raising or charm did not land (or has not happened yet), so nothing is sent.`;
    case "items can be sent only to the realm's own living heroes":
      return `${fact.heroName}: items can only be sent to one of your own living characters.`;
    case 'a hero cannot send items to himself':
      return `${fact.heroName}: cannot send items to themselves.`;
    case 'Mithril Armour is forged to its wearer and cannot be sent':
      return `${fact.heroName}: Mithril Armour is forged to its wearer and cannot be sent — it stays in their pack.`;
    case 'a hero cannot send the item':
      return `${fact.heroName}: cannot send item.`;
    case 'a hero hands items to a comrade beside him':
      return `${fact.heroName} hands ${fact.itemNames.join(', ')} to ${fact.recipientName}.`;
    case 'a hero receives items from a comrade':
      return `📦 ${fact.recipientName} receives ${fact.itemNames.join(', ')} from ${fact.heroName}.`;
    case 'a hero handed items notes how he carries them':
      return fact.gainedItemNote;
    case 'a hero sends items by courier':
      return `${fact.heroName} dispatches ${fact.itemNames.join(', ')} by courier to ${fact.recipientName} in ${fact.provinceName ?? 'a distant province'} — it will arrive by turn's end.`;
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`the item orders' lines have no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
