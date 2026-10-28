// ── THE FACTS THE EXPLORE AND SEARCH ORDERS' LINES RECORD (plan P1-12d8: P1-12's Decisions of 2026-10-26, Decisions 2,
// 6 and 7) ──
// The lines the explore and search orders write (orders/explore-and-search-orders-maps-lairs-rites-and-rumours.ts):
// Explore (the province mapped, the sites found, the richer land, the Philosopher's Lens, the veiling illusion),
// Perform Rite (the Wild Hunt and the Blood Offering, each refused or performed), Hunting Rumours (each lair's talk:
// its price, the guardian's weakness, its hoard and the hero's chances), Search Lair (what the hero finds, takes or
// leaves, and the lore of the items won), Chart the Unknown and Discover Lost Ruin. Each kind holds plain values: a
// hero's, a province's, a site's, a guardian's or an item's name as the world or the content holds it (null where the
// world has none: the prose writes the words for it), a count, a share mapped, a price, a chance and its roll, a flag
// for a clause chosen by it, a lair's class or a guardian's grade as the order or the content names it, and the sites,
// beasts, companies and items a line names copied as it is told; the prose writes every word (src/views/prose/the-
// words-of-the-explore-and-search-orders-lines.ts). One field holds words still: the note of how a hero carries what a
// lair gave up (gainedItemNote, src/engine/items/equipment.ts, which also settles what he wears: the items' area, a
// later slice), listed by the static test. Each is filed on its own, with the audience its event names (Decision 6:
// its event's). A hero slain by a lair's guardian is told by reportHeroFall (heroes/), which still takes his line's
// words from its caller: the Parked "words a caller hands in".
import type { TheAudienceOfAKindOfLine } from '../turn/events-and-their-audiences.ts';
import type {
  AGuardianAsItsKindIsRead,
  AnItemAsTheLineNamesIt,
} from '../personal-combat/the-facts-a-personal-combats-lines-record.ts';

/** A site a hero's exploring brings to light, as the line names it: its name, whether it is a ritual site, and its
 *  guardian's name (null: none named; the prose says "a creature"). */
export interface ASiteFoundAsTheLineNamesIt {
  readonly name: string;
  readonly isARitualSite: boolean;
  readonly guardianName: string | null;
}

/** The sites a hero's exploring brings to light, copied as the line is told. */
export function theSitesFoundAsTheLineNamesThem(
  sites: readonly {
    readonly name: string;
    readonly ritualSite?: boolean | undefined;
    readonly monster?: { readonly name?: string | undefined } | null | undefined;
  }[],
): ASiteFoundAsTheLineNamesIt[] {
  return sites.map((f) => ({ name: f.name, isARitualSite: !!f.ritualSite, guardianName: f.monster?.name ?? null }));
}

/** An item as its lore is read: its name, its tier (a legendary item is named so), its lore and description, and its
 *  effect's stat (Mithril Armour's lore is its own). */
export interface AnItemAsItsLoreIsTold {
  readonly name: string;
  readonly tier?: number;
  readonly lore?: string;
  readonly desc?: string;
  readonly effect?: { readonly stat?: string | undefined } | null;
}

/** The items whose lore a line tells, copied as the line is told (itemLoreLines' words, src/engine/items/tiers-and-
 *  hoards.ts): a field the item lacks is left out. */
export function theItemsAsTheirLoreIsTold(
  items: readonly {
    readonly name: string;
    readonly tier?: number | undefined;
    readonly lore?: string | undefined;
    readonly desc?: string | undefined;
    readonly effect?: { readonly stat?: string | undefined } | null | undefined;
  }[],
): AnItemAsItsLoreIsTold[] {
  return items.map((it) => {
    const copy: {
      name: string;
      tier?: number;
      lore?: string;
      desc?: string;
      effect?: { readonly stat?: string | undefined } | null;
    } = { name: it.name };
    if (it.tier !== undefined) copy.tier = it.tier;
    if (it.lore !== undefined) copy.lore = it.lore;
    if (it.desc !== undefined) copy.desc = it.desc;
    if (it.effect !== undefined) copy.effect = it.effect ? { stat: it.effect.stat } : it.effect;
    return copy;
  });
}

/** A beast bound by the Wild Hunt, as the line names it: its company's name and its type. */
export interface ABeastBoundAsTheLineNamesIt {
  readonly unitName: string;
  readonly type: string;
}

/** A company raised by a Blood Offering, as the line names it: its name (else its type) and the quality it rises to. */
export interface ACompanyEmpoweredAsTheLineNamesIt {
  readonly name: string;
  readonly quality: string;
}

/** The sites Discover Lost Ruin lays bare in one province, as the line names them: the province's name and each site's
 *  (null: a site with no name; the prose says "a hidden lair"). */
export interface TheSitesLaidBareInAProvince {
  readonly provinceName: string;
  readonly siteNames: readonly (string | null)[];
}

/** What a line of the explore and search orders records. */
export type TheFactOfTheExploreAndSearchOrdersLine =
  | { kind: "an Explorer's survey reveals richer land"; heroName: string; provinceName: string; tax: number }
  | { kind: "the Philosopher's Lens shows a hero a hidden site"; heroName: string; siteName: string }
  | { kind: "a veiling illusion clouds a hero's exploring"; heroName: string; provinceName: string }
  | {
      kind: 'a hero explores a province and discovers a site';
      heroName: string;
      provinceName: string;
      /** The share mapped this phase, and the share mapped now, in percent. */
      gain: number;
      explored: number;
      site: ASiteFoundAsTheLineNamesIt;
    }
  | {
      kind: 'a hero explores a province and uncovers several sites';
      heroName: string;
      provinceName: string;
      gain: number;
      explored: number;
      sites: ASiteFoundAsTheLineNamesIt[];
    }
  | {
      kind: 'a hero explores a province and finds no new site';
      heroName: string;
      provinceName: string;
      gain: number;
      explored: number;
    }
  | { kind: 'a hero who does not keep the old faith cannot perform rites'; heroName: string }
  | { kind: 'a hero finds no ritual site for a rite'; heroName: string; provinceName: string }
  | {
      kind: 'the stones have already answered a rite this turn';
      heroName: string;
      siteName: string;
      provinceName: string;
    }
  | { kind: 'nothing wild answers the Wild Hunt'; heroName: string; siteName: string; provinceName: string }
  | { kind: 'a hero cannot afford the Wild Hunt offerings'; heroName: string; price: number }
  | {
      kind: 'a hero performs the Rite of the Wild Hunt';
      heroName: string;
      siteName: string;
      price: number;
      /** The beasts that answer, copied as the line is told. */
      beasts: ABeastBoundAsTheLineNamesIt[];
    }
  | { kind: 'a hero makes no Blood Offering'; heroName: string }
  | {
      kind: 'a hero makes a Blood Offering';
      heroName: string;
      siteName: string;
      /** The companies given to the old gods, by name (else type), copied as the line is told. */
      offered: string[];
      count: number;
      /** The companies their strength passes to, each with the quality it rose to, copied as the line is told. */
      empowered: ACompanyEmpoweredAsTheLineNamesIt[];
    }
  | { kind: 'a hero asks after the lairs of a province but none is known'; heroName: string; provinceName: string }
  | { kind: 'a hero spends the season hunting rumours of lairs'; heroName: string; provinceName: string; lairs: number }
  | {
      kind: "a hero cannot afford a lair's rumours";
      heroName: string;
      price: number;
      siteName: string;
      /** The gold in the treasury. */
      treasury: number;
    }
  | {
      kind: "a lair's rumours are bought";
      price: number;
      siteName: string;
      guardianName: string;
      /** The guardian as its kind's label reads it. */
      guardianKind: AGuardianAsItsKindIsRead;
      /** Its grade as the content names it; null: none (the prose writes "weak"). */
      grade: string | null;
    }
  | {
      kind: "the rumours tell a guardian's weakness";
      weaknessName: string;
      weaknessDesc: string;
      /** The realm learns it now, for every such guardian. */
      theRealmMarksItNow: boolean;
      guardianName: string;
    }
  | { kind: 'the rumours tell a guardian has no weakness'; guardianName: string }
  | {
      kind: "the rumours tell a lair's hoard";
      guardianName: string;
      gold: number;
      /** The hoard's magic, copied as the line is told. */
      hoardItems: AnItemAsTheLineNamesIt[];
      /** The names of the items a thief has lifted from it, and of those its guardian wields, copied. */
      stolenItemNames: string[];
      wieldedItemNames: string[];
    }
  | {
      kind: "the rumours tell a hero's chances against a guardian";
      /** The hero's share of wins in the simulated fights, in percent: the prose reads its band. */
      winPercent: number;
      guardianName: string;
    }
  | { kind: 'nobody could say how a hero would fare against a guardian'; heroName: string }
  | { kind: 'a hero searches a province with no sites'; heroName: string; provinceName: string }
  | { kind: 'the lair a hero meant to search is not here'; heroName: string; provinceName: string }
  | {
      kind: 'a hero walks a ritual site';
      heroName: string;
      siteName: string;
      provinceName: string;
      /** A Pagan may Perform Rites here. */
      isPagan: boolean;
    }
  | { kind: 'a hero revisits a cleared lair'; heroName: string; siteName: string; provinceName: string }
  | {
      kind: "a guardian drags a fallen hero's possessions into its hoard";
      /** The guardian, as the world names it; null: none (the prose says "guardian"). */
      guardianName: string | null;
      heroName: string;
      itemNames: string[];
    }
  | {
      kind: 'a thief finds a hoard already picked clean';
      heroName: string;
      guardianName: string | null;
      siteName: string;
    }
  | {
      kind: "a thief escapes with gold from a lair's hoard";
      heroName: string;
      gold: number;
      siteName: string;
      thiefLevel: number;
      guardianName: string | null;
      /** The gold still hidden there. */
      left: number;
    }
  | { kind: 'a Legendary relic cannot be lifted from a lair'; heroName: string; guardianName: string | null }
  | {
      kind: "a thief slips a magic item from a lair's hoard";
      heroName: string;
      isLegendary: boolean;
      itemName: string;
      itemDesc: string;
      chance: number;
      roll: number;
    }
  | {
      kind: 'a hero notes how he carries what a lair gave up';
      /** gainedItemNote's words (the items' area: a later slice). */
      gainedItemNote: string;
    }
  | { kind: "a thief cannot get near a hoard's magic"; heroName: string; chance: number; roll: number }
  | { kind: "the realm's lore yields an extra find"; itemName: string }
  | {
      kind: 'the lore of the items a lair gave up';
      /** The items, copied as their lore is told. */
      items: AnItemAsItsLoreIsTold[];
    }
  | {
      kind: 'a hero clears a lair and hauls out its magic';
      heroName: string;
      gold: number;
      siteName: string;
      items: AnItemAsTheLineNamesIt[];
    }
  | { kind: 'among the bones a hero recovers what the fallen left'; heroName: string; items: AnItemAsTheLineNamesIt[] }
  | {
      kind: 'a hero clears a lair that holds no magic';
      heroName: string;
      gold: number;
      siteName: string;
      /** The names of the items a thief lifted first, copied. */
      stolenItemNames: string[];
    }
  | { kind: 'a hero is forced to retreat from a lair'; heroName: string; siteName: string; hp: number; maxHp: number }
  | { kind: 'a hero lacks the Explorer mastery to Chart the Unknown'; heroName: string }
  | { kind: 'Chart the Unknown reaches no further than a bordering province'; heroName: string; provinceName: string }
  | {
      kind: 'a hero charts a province in full';
      heroName: string;
      provinceName: string;
      /** Where he charts it from, across the border; null: he stands in it. */
      fromProvinceName: string | null;
      neighbours: number;
      /** The neighbours glimpsed for the first time. */
      newlyGlimpsed: number;
    }
  | { kind: 'a hero lacks the Explorer mastery to Discover a Lost Ruin'; heroName: string }
  | {
      kind: 'a hero finds no site of a class left to lay bare';
      heroName: string;
      provinceName: string;
      /** The class the order names: 'Weak', 'Moderate', 'Powerful', 'Legendary' or 'Ritual'. */
      lairClass: string;
    }
  | {
      kind: 'a hero lays bare the sites of a class';
      heroName: string;
      lairClass: string;
      sites: number;
      /** The sites laid bare in each province, in the order the line lists them. */
      byProvince: TheSitesLaidBareInAProvince[];
    };

/** Each kind's audience: its event's (a kind filed on its own). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_THE_EXPLORE_AND_SEARCH_ORDERS_LINE: Readonly<
  Record<TheFactOfTheExploreAndSearchOrdersLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  "an Explorer's survey reveals richer land": "its event's",
  "the Philosopher's Lens shows a hero a hidden site": "its event's",
  "a veiling illusion clouds a hero's exploring": "its event's",
  'a hero explores a province and discovers a site': "its event's",
  'a hero explores a province and uncovers several sites': "its event's",
  'a hero explores a province and finds no new site': "its event's",
  'a hero who does not keep the old faith cannot perform rites': "its event's",
  'a hero finds no ritual site for a rite': "its event's",
  'the stones have already answered a rite this turn': "its event's",
  'nothing wild answers the Wild Hunt': "its event's",
  'a hero cannot afford the Wild Hunt offerings': "its event's",
  'a hero performs the Rite of the Wild Hunt': "its event's",
  'a hero makes no Blood Offering': "its event's",
  'a hero makes a Blood Offering': "its event's",
  'a hero asks after the lairs of a province but none is known': "its event's",
  'a hero spends the season hunting rumours of lairs': "its event's",
  "a hero cannot afford a lair's rumours": "its event's",
  "a lair's rumours are bought": "its event's",
  "the rumours tell a guardian's weakness": "its event's",
  'the rumours tell a guardian has no weakness': "its event's",
  "the rumours tell a lair's hoard": "its event's",
  "the rumours tell a hero's chances against a guardian": "its event's",
  'nobody could say how a hero would fare against a guardian': "its event's",
  'a hero searches a province with no sites': "its event's",
  'the lair a hero meant to search is not here': "its event's",
  'a hero walks a ritual site': "its event's",
  'a hero revisits a cleared lair': "its event's",
  "a guardian drags a fallen hero's possessions into its hoard": "its event's",
  'a thief finds a hoard already picked clean': "its event's",
  "a thief escapes with gold from a lair's hoard": "its event's",
  'a Legendary relic cannot be lifted from a lair': "its event's",
  "a thief slips a magic item from a lair's hoard": "its event's",
  'a hero notes how he carries what a lair gave up': "its event's",
  "a thief cannot get near a hoard's magic": "its event's",
  "the realm's lore yields an extra find": "its event's",
  'the lore of the items a lair gave up': "its event's",
  'a hero clears a lair and hauls out its magic': "its event's",
  'among the bones a hero recovers what the fallen left': "its event's",
  'a hero clears a lair that holds no magic': "its event's",
  'a hero is forced to retreat from a lair': "its event's",
  'a hero lacks the Explorer mastery to Chart the Unknown': "its event's",
  'Chart the Unknown reaches no further than a bordering province': "its event's",
  'a hero charts a province in full': "its event's",
  'a hero lacks the Explorer mastery to Discover a Lost Ruin': "its event's",
  'a hero finds no site of a class left to lay bare': "its event's",
  'a hero lays bare the sites of a class': "its event's",
};
