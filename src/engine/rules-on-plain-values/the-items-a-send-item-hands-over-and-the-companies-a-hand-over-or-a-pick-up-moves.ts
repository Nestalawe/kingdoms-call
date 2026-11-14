// ── What a hero holds: the items a Send Item hands over, the companies a hand-over or a Pick Up moves (plan P1-11e14) ──
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a). Moved as they were from the item orders' Send Item and the army orders' Leave/Transfer and Pick
// Up (src/engine/orders/), so the order form's forecast of what a hero will hold can ask the same rules. A company is
// read as its realm sees it (`seenAs`: the engine hands unitAsItsRealmSeesIt, the report's companies are seen so
// already), and handed back as it came.
import { ALIGNMENT_ABILITIES } from '../../content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import { MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS } from '../../content/magic-item-effects-their-names-numbers-and-words.ts';
import {
  countsAgainstBeastCommand,
  type AUnitAsItsRealmSeesIt,
} from './beasts-a-hero-may-lead-and-the-druid-each-unit-needs.ts';

/** An item in a hero's pack as a Send Item order names it: by its place, its id or its name; its effect's key says
 *  whether it is the Mithril suit. A gap among the items is none. */
export type AnItemASendItemOrderNames =
  | {
      readonly id?: unknown;
      readonly name?: string | null | undefined;
      readonly effect?: { readonly stat?: string | null | undefined } | null | undefined;
    }
  | null
  | undefined;

/** Whether a held item is the Mithril suit, a relic granted to its wearer: its effect carries the key of the
 *  `mithril-armour` row (the items' registry's anItemIsTheMithrilSuit asks this). */
export function anItemIsTheMithrilSuitGrantedToItsWearer(item: AnItemASendItemOrderNames): boolean {
  return item?.effect?.stat === MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS['mithril-armour'].carriedAs.stat;
}

/** The places in a hero's pack a Send Item order hands over, highest first (each is taken out before the places below
 *  it shift), and whether a Mithril suit it names stays with its wearer (forged to him, it is never sent). "all" names
 *  every item; else each token is a place (a plain whole number in the pack's range: "3 Rings of Dawn" is a name) or
 *  an item's id or name. */
export function theItemsASendItemOrderHandsOver(
  held: readonly AnItemASendItemOrderNames[],
  // the order's target, as the turn hands it (words; a number from an older save's order)
  target: string | number | null | undefined,
): { readonly places: readonly number[]; readonly theMithrilSuitStays: boolean } {
  let idxs: number[];
  if (
    String((target ?? '') || '')
      .trim()
      .toLowerCase() === 'all'
  ) {
    idxs = held.map((_, i) => i);
  } else {
    // ── 2026-09-24 (Toby): a token may be a positional INDEX (as always) or an item ID / NAME ──
    // Send Item was index-only, and an index is only meaningful when the order form's list and
    // the engine's `c.items` are the same list in the same order. They are NOT for a PRE-ORDER
    // card: a hero being HIRED has a real pack the player has never seen, so the form's index 0
    // (the sword you sent them an hour ago) is some other item entirely at resolution — you
    // would send the wrong thing, chosen by an accident of ordering. Equip Items and Use Item
    // already addressed items by id-or-name for exactly this reason; Send Item now does too, so
    // the player form can name what it means whenever position cannot be trusted.
    // Backward compatible: a token that is a plain integer in range is still positional, so
    // every existing (and in-flight) order behaves identically. `String(n)===t` is what keeps a
    // name that merely STARTS with digits ("3 Rings of Dawn") out of the positional branch.
    const _toks = String((target ?? '') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    idxs = _toks
      .map((t) => {
        const n = parseInt(t);
        if (Number.isInteger(n) && String(n) === t && n >= 0 && n < held.length) return n;
        return held.findIndex((it) => it && (String(it.id) === t || it.name === t));
      })
      .filter((n) => Number.isInteger(n) && n >= 0 && n < held.length);
  }
  let uniq = [...new Set(idxs)].sort((a, b) => b - a);
  // A granted Mithril suit is forged to its wearer and cannot be sent on.
  let theMithrilSuitStays = false;
  if (uniq.some((i) => anItemIsTheMithrilSuitGrantedToItsWearer(held[i]))) {
    uniq = uniq.filter((i) => !anItemIsTheMithrilSuitGrantedToItsWearer(held[i]));
    theMithrilSuitStays = true;
  }
  return { places: uniq, theMithrilSuitStays };
}

/** A hand-over's recipient as the risen dead judge him: his own alignment, and his realm's. */
export interface AHandOversRecipientAsTheRisenDeadJudgeHim {
  readonly alignment: string | null | undefined;
  readonly hisRealmsAlignment: string | null | undefined;
}

/** Whether risen dead follow a hand-over to where it goes: into a garrison (no recipient) always; to a comrade only if
 *  he is Undead himself or serves an Undead realm. */
export function theRisenDeadFollowAHandOverTo(recipient: AHandOversRecipientAsTheRisenDeadJudgeHim | null): boolean {
  // its row's alignment (P1-19ax2: read here, not through the registry's runner, since the player portal shares this
  // file and it may import only src/content)
  const theUndead = ALIGNMENT_ABILITIES['the-risen-dead-follow-only-the-undead'].alignment;
  return !recipient || recipient.alignment === theUndead || recipient.hisRealmsAlignment === theUndead;
}

/** Where a hand-over's companies go, by the risen dead among them: where they refuse to follow (theyFollow false),
 *  the skeletal companies go to their graves and the rest are handed; else every company is handed. Each list keeps
 *  the companies' order. */
export function whereAHandOversRisenDeadGo<TheCompany>(
  companies: readonly TheCompany[],
  theyFollow: boolean,
  seenAs: (company: TheCompany) => AUnitAsItsRealmSeesIt,
): { readonly handed: TheCompany[]; readonly toTheirGraves: TheCompany[] } {
  const skelTransfer = companies.filter((a) => seenAs(a).skeletal);
  if (skelTransfer.length > 0 && !theyFollow) {
    return { handed: companies.filter((a) => !seenAs(a).skeletal), toTheirGraves: skelTransfer };
  }
  return { handed: [...companies], toTheirGraves: [] };
}

/** Which of the companies joining a leader's column he takes, and which are left where they were (Item 24,
 *  2026-10-12): in their order, each beast that counts against his beast command (countsAgainstBeastCommand) takes one
 *  place of the room his command leaves while any is left; past it, beasts are left. Other companies are always taken. */
export function theCompaniesALeaderTakesUpToHisBeastCommandsRoom<TheCompany>(
  joining: readonly TheCompany[],
  room: number,
  seenAs: (company: TheCompany) => AUnitAsItsRealmSeesIt,
): { readonly taken: TheCompany[]; readonly left: TheCompany[] } {
  let _room = room;
  const taken: TheCompany[] = [],
    left: TheCompany[] = [];
  joining.forEach((a) => {
    if (countsAgainstBeastCommand(seenAs(a))) {
      if (_room > 0) {
        _room--;
        taken.push(a);
      } else left.push(a);
    } else taken.push(a);
  });
  return { taken, left };
}

/** The places in a province's garrison a Pick Up order takes its companies from, in the order he takes them up: the
 *  last first. "all" takes every company; else each `g:N` token names a place in the garrison, once (a place out of
 *  range names none). */
export function theGarrisonPlacesAPickUpTakes(
  // the order's target, as the turn hands it (words; a number from an older save's order)
  target: string | number | null | undefined,
  garrisonSize: number,
): readonly number[] {
  if (((target ?? '') || '').toString().trim().toLowerCase() === 'all') {
    return Array.from({ length: garrisonSize }, (_, i) => garrisonSize - 1 - i);
  }
  // pick up a SELECTION of unled garrison units by index. The player form now offers
  // checkboxes and emits a comma-separated list like "g:0,g:2". Splice from the highest
  // index down so earlier removals don't shift the indices still to be taken.
  const idxs = String(target)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^g:\d+$/i.test(s))
    .map((s) => parseInt(s.slice(2)));
  return [...new Set(idxs)].filter((i) => Number.isInteger(i) && i >= 0 && i < garrisonSize).sort((a, b) => b - a);
}
