// ── VERSION 2: AN OLDER SAVE'S SHAPES MENDED ONCE (plan P1-15f5, 2026-11-08) ────
// The numbered step of version 2 (THE_NUMBERED_STEPS_OF_THE_UPGRADE, upgrade-a-saved-game-and-check-it.ts). On a save
// below version 2, once, after the upgrade's passes and before the check, each shape an older build wrote that a reader
// worked out as it read it is given the value that reader works out, so the save meets the saved state's schema. The
// readers of 1 to 5 no longer read the older shape (plan P1-15f6): this step is the only place that does.
//   1. a feature's treasure held as `{ gold }` (sea features before v1054) becomes the number, as featureTreasure read it;
//   2. a guardian's single perk (`passive`) becomes its list (`passives`, as guardianPassives read it), and goes;
//   3. a guardian's special with no weight (`dmgW`) and no damage range that deals damage is given the weight 0, as the
//      fight reads it, and a special with a weight loses the range it no longer reads (`dmg`);
//   4. a lair's items left by the fallen (`lairItems`) go into its hoard, as the stocking (ensureLairHoard) moves them;
//      a stocked lair's cached clearing gold (`_clearGold`, never read once the hoard is stocked) goes;
//   5. a stocked lair with no record of its first hoard (`_hoardGoldOrig`) is given its hoard, as a theft reads it;
//   6. a fallen hero's grave with no list of the realms he served (`served`) is given an empty one (graveServedOther);
//   7. every item in a hero's pack or a lair's hoard: with no lore, given its lore as itemLore reads it; its race under
//      an old name (Elf, Dwarf, …) given today's (itemRaceOf); an inline slot another rule beats (an old 'consumable',
//      a shield's) given the slot that wins (itemSlot);
//   8. a game begun before 26 September, with no bots' diplomacy, given "normal", which every reader takes.
// Left as they are, with no value a reader works out to give: a special's damage range that deals damage (the dice
// roll it), a ritual site's items left by the fallen (the stocking passes a ritual site over), a lair not yet stocked
// (the turn's stocking reads its `_clearGold`, or rolls it), and a realm's old vault (a field the schema doesn't hold).
// It draws no dice and writes no line, and is safe to repeat.
import { featureTreasure } from '../world/tables.ts';
import { itemLore } from '../items/tiers-and-hoards.ts';
import { itemRaceOf, itemSlot } from '../rules-on-plain-values/items-slots-races-and-who-may-use-them.ts';

/** An item as the step reads it: an older save's may hold no lore, a race under an old name, a stale inline slot. */
interface AnItemAsTheStepReadsIt {
  readonly name: string;
  readonly desc?: string;
  readonly effect?: { readonly stat?: string | undefined } | null;
  lore?: string;
  race?: string | null | undefined;
  slot?: string | null | undefined;
}
/** A guardian's special as the step reads it: an older save's may hold a damage range and no weight. */
interface AGuardiansSpecialAsTheStepReadsIt {
  dmgW?: number | null | undefined;
  dmg?: readonly (number | null | undefined)[] | null | undefined;
}
/** A guardian's perk as the step reads it. */
interface AGuardiansPerkAsTheStepReadsIt {
  readonly fx?: unknown;
}
/** A feature as the step reads it: an older save's lair may hold its treasure as `{ gold }`, items left by the fallen,
 *  a cached clearing gold, a guardian of an older table. */
interface AFeatureAsTheStepReadsIt {
  readonly ritualSite?: boolean | undefined;
  readonly _hoardV2?: boolean | undefined;
  treasure?: number | { gold?: number | undefined } | null | undefined;
  hoardItems?: (AnItemAsTheStepReadsIt | null | undefined)[] | undefined;
  lairItems?: (AnItemAsTheStepReadsIt | null | undefined)[] | null | undefined;
  _clearGold?: number | null | undefined;
  _hoardGoldOrig?: number | null | undefined;
  readonly monster?:
    | {
        passives?: (AGuardiansPerkAsTheStepReadsIt | null | undefined)[] | null | undefined;
        passive?: AGuardiansPerkAsTheStepReadsIt | null | undefined;
        readonly spells?: readonly (AGuardiansSpecialAsTheStepReadsIt | null | undefined)[] | null | undefined;
      }
    | null
    | undefined;
}
type AListOf<T> = readonly (T | null | undefined)[] | null | undefined;
/** A save as the step reads it: any list may hold a gap, and an older save may lack it. Today's GameState passes. */
interface ASaveAsTheStepReadsIt {
  readonly world?:
    { readonly provinces?: AListOf<{ readonly features?: AListOf<AFeatureAsTheStepReadsIt> }> } | null | undefined;
  readonly characters?: AListOf<{ readonly items?: AListOf<AnItemAsTheStepReadsIt> }>;
  readonly heroGraveyard?: AListOf<{ served?: readonly number[] | null | undefined }>;
  botDiplomacy?: string | null | undefined;
}

/** 2, 3: a guardian of an older table: its single perk into its list, each special's weight as the fight reads it. */
function aGuardianOfAnOlderTableMended(m: NonNullable<AFeatureAsTheStepReadsIt['monster']>): void {
  if ('passive' in m) {
    if (!Array.isArray(m.passives)) m.passives = m.passive?.fx ? [m.passive] : [];
    delete m.passive;
  }
  (m.spells ?? []).forEach((sp) => {
    if (!sp) return;
    if (sp.dmgW != null) {
      delete sp.dmg;
      return;
    }
    const range = sp.dmg;
    if (range && (Number(range[0]) > 0 || Number(range[1]) > 0)) return; // the dice roll it: no weight equals it
    sp.dmgW = 0;
    delete sp.dmg;
  });
}

/** 1, 4, 5: a feature's treasure as a number, a lair's items left by the fallen in its hoard, a stocked lair's first
 *  hoard on record and its cached clearing gold gone. */
function aFeatureOfAnOlderSaveMended(f: AFeatureAsTheStepReadsIt): void {
  if (typeof f.treasure === 'object' && f.treasure !== null) f.treasure = Math.max(0, Number(f.treasure.gold) || 0);
  if (f.monster) aGuardianOfAnOlderTableMended(f.monster);
  if (f.ritualSite) return;
  if (Array.isArray(f.lairItems)) {
    const hoard = Array.isArray(f.hoardItems) ? f.hoardItems : [];
    hoard.push(...f.lairItems);
    f.hoardItems = hoard;
    delete f.lairItems;
  }
  if (!f._hoardV2) return;
  delete f._clearGold;
  f._hoardGoldOrig ??= featureTreasure({ treasure: f.treasure });
}

/** 7: an item's lore, race and slot as today's readers work them out. */
function anItemOfAnOlderSaveMended(it: AnItemAsTheStepReadsIt | null | undefined): void {
  if (!it) return;
  if (typeof it.lore !== 'string') it.lore = itemLore(it);
  const race = itemRaceOf(it);
  if (race && race !== it.race) it.race = race;
  if (typeof it.slot !== 'string') return;
  const slot = itemSlot(it);
  if (slot !== null && slot !== it.slot) it.slot = slot;
}

/** Mends, in place, a save of version 1 or below into version 2's shape (the header's list). */
export function anOlderSavesShapesMendedOnce(save: ASaveAsTheStepReadsIt): void {
  (save.world?.provinces ?? []).forEach((p) => {
    (p?.features ?? []).forEach((f) => {
      if (f) aFeatureOfAnOlderSaveMended(f);
    });
  });
  (save.characters ?? []).forEach((c) => {
    (c?.items ?? []).forEach(anItemOfAnOlderSaveMended);
  });
  (save.world?.provinces ?? []).forEach((p) => {
    (p?.features ?? []).forEach((f) => {
      (f?.hoardItems ?? []).forEach(anItemOfAnOlderSaveMended);
    });
  });
  (save.heroGraveyard ?? []).forEach((g) => {
    if (g && !Array.isArray(g.served)) g.served = [];
  });
  save.botDiplomacy ??= 'normal';
}
