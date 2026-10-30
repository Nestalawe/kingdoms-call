// ── THE WORDS OF THE ITEMS A HERO GAINED (plan P1-12d21: P1-12d's battle slice, Decision 5) ─────────────────────
// Item 10 (Toby, 2026-10-13): every time a hero gains an item, the report says whether he puts it on at once, has no
// room for it (and what the slot already holds), needs no slot for it, or cannot use it. The engine settles the slots
// and records how he carries each (settleTheItemsAHeroGained, src/engine/items/equipment.ts); the views write the
// note here, in the same words the engine wrote before (gainedItemNote). Six kinds of line hold the record: a fight's
// (personal combat), a hero handed items, a thief's take, a lair's finder, a fallen foe's possessions, a courier's
// parcel.
import type { TheItemsAHeroGained } from '../../engine/items/equipment.ts';

/** Each slot's words, as the note names it when it is full. */
export const KC_SLOT_WORDS = {
  weapon: 'weapon slot',
  armour: 'armour slot',
  shield: 'shield slot',
  cloak: 'cloak slot',
  helm: 'helm slot',
  ring: 'both ring slots',
  amulet: 'amulet slot',
  combat: 'both combat-item slots',
};

/** The note of how a hero carries the items he gained ('' when there is nothing to say). */
export function theWordsOfTheItemsAHeroGained(gained: TheItemsAHeroGained | null): string {
  if (gained === null) return '';
  const heroName = gained.heroName;
  // the words read by any slot's name
  const slotWords: Readonly<Partial<Record<string, string>>> = KC_SLOT_WORDS;
  return (
    '🎒 ' +
    gained.items
      .map((it) => {
        const nm = 'the ' + it.itemName;
        switch (it.kind) {
          case 'he cannot use it':
            return `${heroName} cannot use ${nm} and carries it unused.`;
          case 'it needs no slot':
            return `${(nm[0] ?? '').toUpperCase() + nm.slice(1)} needs no slot: it works for ${heroName} at once.`;
          case 'he equips it at once':
            return `${heroName} equips ${nm} at once.`;
          case 'he has no room for it': {
            const sl = it.slot;
            const worn = it.wornNames.map((name) => 'the ' + name);
            return `${heroName} has no room to equip ${nm}: ${worn.length ? `the ${(slotWords[sl] ?? '') || sl + ' slot'} already ${worn.length > 1 ? 'hold' : 'holds'} ${worn.join(' and ')}` : `the ${(slotWords[sl] ?? '') || sl + ' slot'} is full`}, so it goes in the pack (an Equip Items order can swap it in).`;
          }
          default: {
            const none: never = it;
            throw new TypeError('no words for the way ' + JSON.stringify(none) + ' is carried');
          }
        }
      })
      .join(' ')
  );
}
