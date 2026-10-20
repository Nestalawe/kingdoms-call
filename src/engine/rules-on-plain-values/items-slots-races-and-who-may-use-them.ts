// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
// ── Items: legendary or not, their slots, their races and who may use them (plan P1-11a3) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a).
import { KC_ITEM_RACE_ALIAS, _ITEM_NAME_ALTS } from '../../content/kingdoms-call-data.ts';

export function isLegendaryItem(it) {
  return !!it && it.tier === 4;
}

export const ITEM_SLOT_OF = {
  'Blade of Fury': 'weapon',
  'Elven Longbow': 'weapon',
  'Staff of the Wildwood': 'weapon',
  'Sword of the First Emperor': 'weapon',
  'Black Sceptre': 'weapon',
  'Warbringer Gauntlets': 'armour',
  'Gloves of the Nightcrawler': 'armour',
  'Boots of the Wind': 'armour',
  'Tower Shield of the Wall': 'shield',
  'Anvil-Brand Shield': 'shield',
  'Shield of the Innocent': 'shield', // shield slot; overrides any stale inline slot — see itemSlot
  "Traveller's Cloak": 'cloak',
  Shadowcloak: 'cloak',
  'Veil of Illusions': 'cloak',
  'Cloak of Many Faces': 'cloak',
  "Sage's Crown": 'helm',
  'Crown of Command': 'helm',
  'Imperial Regalia': 'helm',
  'Ring of the Explorer': 'ring',
  "Death's Finger Ring": 'ring',
  "Siege Master's Ring": 'ring',
  'Ring of Wealth': 'ring',
  'Mithril Armour': 'armour', // the granted suit now occupies the armour slot
  "Mind's Eye Amulet": 'amulet',
  'Amulet of Fortitude': 'amulet',
  'Iron Heart Talisman': 'amulet',
  'Eagle-Eye Pendant': 'amulet',
  "Legionnaire's Mark": 'amulet',
};
// the two alternate-named clones of every tier-1/2 item share the base item's slot (previously
// 'Sword of Wrath' etc. had no slot and so were ALWAYS active, bypassing Equip Items).
export const _ITEM_ALT_BASE = {};
Object.entries(_ITEM_NAME_ALTS).forEach(([base, alts]) =>
  alts.forEach((a) => {
    _ITEM_ALT_BASE[a] = base;
  }),
);
export const _SHIELD_BASES = new Set([
  'Tower Shield of the Wall',
  'Anvil-Brand Shield',
  'Shield of the Innocent',
  'Kite Shield of the Marches',
  'Bronze Buckler',
  'Oaken Roundshield',
  'Mirror-Bright Shield',
  'Shield of the Ward-Saints',
  'Dragonbone Shield',
]);
export function itemSlot(it) {
  if (!it) return null;
  // a SHIELD is a shield even when its power is a once-per-fight ward - the Anvil-Brand Shield is
  // strapped to the arm, not drunk. The shield test therefore comes first.
  if (_SHIELD_BASES.has(_ITEM_ALT_BASE[it.name] || it.name)) return 'shield';
  if (it.effect && it.effect.stat === 'combatUse') return 'combat'; // every other potion, scroll or device is a COMBAT ITEM and takes a Combat Item slot (two per character). This test runs BEFORE `it.slot` is read, so items saved with the old inline slot:'consumable' re-resolve here with no migration.
  if (it.effect && it.effect.stat === 'mithrilArmour') return 'armour'; // Mithril is worn in the armour slot // 2026-09-10: shields moved to their own slot — beats a stale inline slot on a saved copy
  if (it.slot !== undefined) return it.slot || null;
  return ITEM_SLOT_OF[it.name] || ITEM_SLOT_OF[_ITEM_ALT_BASE[it.name]] || null;
}

// Which race / alignment an item is bound to, if any; an item a character cannot use is inert in
// their hands. 2026-09-10 item 3: race-bound items were tagged 'Elf'/'Dwarf'/'Orc' while characters
// carry 'Elven'/ 'Dwarven'/'Orcish', so every non-Human race-bound item was inert in its OWN race's
// hands. The item data now uses the canonical names; this alias map keeps items already rolled into
// saved games working.
export const _ITEM_RACE_ALIAS = { ...KC_ITEM_RACE_ALIAS };
export function itemRaceOf(it) {
  const r = it && it.race;
  return r ? _ITEM_RACE_ALIAS[r] || r : r;
}
export function itemUsableBy(it, c) {
  if (!it) return false;
  if (it.race && (!c || c.race !== itemRaceOf(it))) return false;
  if (it.alignment && (!c || c.alignment !== it.alignment)) return false;
  return true;
}
