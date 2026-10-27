import { homeFounderOf } from '../grand-design.ts';
import { isLegendaryItem } from '../rules-on-plain-values/items-slots-races-and-who-may-use-them.ts';
import { hexDistP } from '../world/map-helpers.ts';
import { perkTier } from '../titles/perks.ts';
import { discProvCoastal, discSumOf } from '../discoveries.ts';
import type { GameState, Item, Province, SkillLevels } from '../../schemas/saved-game-state.ts';

// Its types (plan P1-10b9): each parameter typed as wide as the body's guards (plan P1-10b's Decision 3), so each guard
// stays, though a state the turn hands always holds what it guards. Ids are plain numbers (the schema brands them).
/** An item as its name is listed: its name, its words and its tier (the LEGENDARY mark). */
type AnItemAsListed = Pick<Item, 'name'> & Partial<Pick<Item, 'desc' | 'tier'>>;
/** A realm as consecration reads it: its alignment, and its consecrated provinces (an older save's single one, which
 *  the first read folds into the list). */
interface ARealmAsConsecrationReadsIt {
  readonly alignment?: string | undefined;
  consecratedProvIds?: number[] | undefined;
  consecratedProvId?: number | null | undefined;
}
/** A province as consecration and spotting read it. */
interface AProvinceAsTheseRead {
  readonly id: number;
  readonly owner?: number | null | undefined;
  readonly tax: number;
  readonly row: number;
  readonly col: number;
  readonly terrain: string;
  readonly characters?: readonly number[] | null | undefined;
}
/** A hero as the names' safety nets read it (a guard, a wanderer, a crown's hero). */
interface AHeroAsTheNamesRead {
  name?: string | null | undefined;
  _isNeutralGuard?: boolean | undefined;
  readonly player?: number | null | undefined;
  readonly alive?: boolean | undefined;
  readonly location: number;
  readonly armies?: readonly unknown[] | null | undefined;
}
/** A hero as spotting reads it: a lurker's id and skills, a watcher's realm and skills (and, for the Wonders' home,
 *  where a king stands). */
type AHeroAsSpottingReadsIt = NonNullable<NonNullable<Parameters<typeof homeFounderOf>[0]>['characters']>[number] & {
  readonly id: number;
  readonly alive: boolean;
  readonly skills?: Partial<SkillLevels> | null | undefined;
};
/** The state as these read it: the realms, the heroes (by id), the relations, the turn and the map. */
interface TheStateAsTheseReadIt {
  readonly players?: readonly (ARealmAsConsecrationReadsIt & Parameters<typeof discSumOf>[0])[] | null | undefined;
  readonly characters: readonly AHeroAsSpottingReadsIt[];
  readonly relations?: Readonly<Partial<Record<string, string>>> | null | undefined;
  readonly turn: number;
  readonly world: Pick<GameState['world'], 'cols' | 'rows'> & {
    readonly provinces: readonly (AProvinceAsTheseRead | null | undefined)[];
  };
}

export function itemNameList(items: readonly AnItemAsListed[] | null | undefined, withDesc?: boolean) {
  const wd = withDesc !== false;
  return (items ?? [])
    .map((d) => (isLegendaryItem(d) ? 'the LEGENDARY ' : 'the ') + d.name + (wd && d.desc ? ' (' + d.desc + ')' : ''))
    .join(', ');
}

// ── MITHRIL ARMOUR ── A GRANTED (never lair-rolled) relic worn by Dwarven characters of a Dwarven
// realm. Kept out of ALL_MAGIC_ITEMS_P so rollMagicItem never awards it and every qualifying dwarf
// can hold their own copy. Effect stat 'mithrilArmour' reduces melee damage dealt to the wearer by
// 2 (applied per-hit in pcMeleeDamage; non-stacking — one suit is enough).
export const MITHRIL_ARMOUR = {
  name: 'Mithril Armour',
  slot: 'armour',
  desc: 'Melee and arrow attacks against the wearer deal 2 less damage',
  lore: "A suit of the dwarves' own mithril, light as linen and harder than steel; granted to every dwarven character of a dwarven realm and never found in a lair. Every melee blow or arrow that lands on the wearer deals 2 less damage (never below 1).",
  effect: { stat: 'mithrilArmour', bonus: 2 },
  tier: 1,
};
// duplicate items of the SAME type (same name) do NOT stack — a character may hold several, but
// only ONE of each name has any effect. Every place that sums item effects runs the item list
// through this first. (Different items that happen to share a stat still stack normally.) a Divine
// realm may now hold MULTIPLE consecrated provinces — up to the king's White skill level, that many
// at any one time. Consecration is stored as a LIST
// (player.consecratedProvIds); this helper returns it, migrating any legacy single `consecratedProvId`
// save into the list on first read.
// 2026-09-24 (Toby item 7): only the profane profit from casting down altars — an UNDEAD realm's
// column always rises a level, an EVIL realm's has a 50% chance per unit, everyone else gains nothing.
export const CONSEC_CAPTURE_XP_PCT_BY_ALIGNMENT = { Undead: 100, Evil: 50 };
export function consecCaptureXpPct(pl: { readonly alignment: string } | null | undefined) {
  // the table read by any alignment's name
  const pctByAlignment: Readonly<Partial<Record<string, number>>> = CONSEC_CAPTURE_XP_PCT_BY_ALIGNMENT;
  return (pl && pctByAlignment[pl.alignment]) ?? 0; // 100 or 50, never 0
}
export function consecratedIds(pl: ARealmAsConsecrationReadsIt | null | undefined) {
  if (!pl) return [];
  if (!Array.isArray(pl.consecratedProvIds)) {
    pl.consecratedProvIds = pl.consecratedProvId != null ? [pl.consecratedProvId] : [];
    if ('consecratedProvId' in pl) delete pl.consecratedProvId; // fold the old single field into the list
  }
  return pl.consecratedProvIds;
}
export function isConsecrated(pl: ARealmAsConsecrationReadsIt | null | undefined, provId: number) {
  return consecratedIds(pl).includes(provId);
}
// DIVINE RETURN needs holy ground. The consecrated provinces a realm still OWNS — the only places a
// fallen Divine character can be restored. `nearestConsecratedProv` picks the one closest (hex
// distance, ties → the richer) to where the body lies.
export function ownedConsecratedProvs(state: TheStateAsTheseReadIt, pi: number) {
  const pl = (state.players ?? [])[pi];
  if (!pl) return [];
  return consecratedIds(pl)
    .map((id) => state.world.provinces[id])
    .filter((pv): pv is AProvinceAsTheseRead => pv?.owner === pi);
}
export function nearestConsecratedProv(
  state: TheStateAsTheseReadIt,
  pi: number,
  fromProvId: number | null | undefined,
): AProvinceAsTheseRead | null | undefined {
  const list = ownedConsecratedProvs(state, pi);
  if (!list.length) return null;
  const from = fromProvId != null ? state.world.provinces[fromProvId] : null;
  if (!from) return list[0];
  let best: AProvinceAsTheseRead | null = null,
    bd = Infinity;
  list.forEach((pv) => {
    const d = hexDistP(from, pv, state.world.cols);
    if (d < bd || (d === bd && (pv.tax || 0) > (Number(best?.tax) || 0))) {
      bd = d;
      best = pv;
    }
  });
  return best;
}
// a neutral province guard becomes an ordinary wandering hero (hireable, listed under Wandering
// Heroes, labelled "(wandering)"). Used when a guard survives the loss of his last unit, and by the
// turn-start / pre-report safety net for any guard left troopless or standing in a player's land.
export function demoteGuardToWanderer(h: AHeroAsTheNamesRead | null | undefined) {
  if (!h) return;
  h._isNeutralGuard = false; // (armies are left as they are — the combat site has already emptied them)
  const base = (h.name ?? '').replace(/\s*\(wandering\)/gi, '').trim();
  h.name = base + ' (wandering)';
}
// the inverse of demoteGuardToWanderer. The ' (wandering)' suffix is baked into the NAME, so EVERY
// path that puts a masterless hero into a realm's service must take it off again — the Hire order
// did, but Charm's permanent join and Resurrect did not, leaving heroes called "Marigold the Bright
// (wandering)" serving a crown. One helper, used by all of them.
export function claimWandererName(h: Pick<AHeroAsTheNamesRead, 'name'> | null | undefined) {
  if (!h) return;
  h.name = (h.name ?? '').replace(/\s*\(wandering\)/gi, '').trim();
}
// Safety net for saves already carrying the bug (and for any future path that forgets): no
// character who serves a crown may wear the wandering tag. Run at turn start. Returns the number
// repaired.
export function normaliseOwnedNames(gs: {
  readonly characters?: readonly (AHeroAsTheNamesRead | null | undefined)[] | null | undefined;
}) {
  let n = 0;
  (gs.characters ?? []).forEach((c) => {
    if (c?.player == null) return;
    if (/\(wandering\)/i.test(c.name ?? '')) {
      claimWandererName(c);
      n++;
    }
  });
  return n;
}
// Safety net: every living neutral "guard" who leads no troops, or who stands in a province a
// player now owns, is really a wanderer — normalise them. Returns the number repaired.
export function normaliseStrandedGuards(gs: {
  readonly characters?: readonly (AHeroAsTheNamesRead | null | undefined)[] | null | undefined;
  readonly world?:
    | { readonly provinces?: readonly (Pick<Province, 'owner'> | null | undefined)[] | null | undefined }
    | null
    | undefined;
}) {
  let n = 0;
  (gs.characters ?? []).forEach((c) => {
    if (c?.player !== null || !c.alive || !c._isNeutralGuard) return;
    const pv = (gs.world?.provinces ?? [])[c.location];
    if ((c.armies ?? []).length === 0 || pv?.owner != null) {
      demoteGuardToWanderer(c);
      n++;
    }
  });
  return n;
}
// consecration is holy ground anyone can SEE (altars, standing stones), not a private fact of the
// owner. This tells us whether a province is consecrated by its CURRENT owner, so the map can mark
// it for every player who can see the province — not only the Divine king who blessed it.
export function provinceConsecrated(
  gs: Pick<TheStateAsTheseReadIt, 'players'> | null | undefined,
  prov: Pick<AProvinceAsTheseRead, 'id' | 'owner'> | null | undefined,
) {
  if (prov?.owner == null) return false;
  const owner = gs?.players?.[prov.owner];
  return !!owner && isConsecrated(owner, prov.id);
}
// relation lookup usable at MODULE level (buildTurnReport can't reach the runTurn-nested
// areEnemies/relationBetween). Relations live in gs.relations keyed "min-max".
export function relOfReport(
  gs: Pick<TheStateAsTheseReadIt, 'relations'>,
  a: number | null | undefined,
  b: number | null | undefined,
) {
  if (a == null || b == null || a === b) return 'neutral';
  const k = a < b ? `${String(a)}-${String(b)}` : `${String(b)}-${String(a)}`;
  const rel = gs.relations?.[k] ?? '';
  return rel || 'neutral';
}
// Deterministic 0..1 roll so the same (turn, viewer, enemy, province) always resolves the same way
// — the map is built once, but this keeps a GM preview and the saved report identical, and re-rolls
// each turn.
export function detRoll(turn: number, viewerPi: number, charId: number, provId: number) {
  let h = 2166136261 >>> 0;
  const s = `${String(turn)}|${String(viewerPi)}|${String(charId)}|${String(provId)}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h >>> 0) / 4294967296;
}
// Detection of an ENEMY character lurking in a province you OWN but have no character standing in.
// Chance = your exploration% of the province, −20%/enemy Spy level (cap L5), +10%/highest friendly
// (own or allied) Spy level present (cap L5), clamped 5–95%. Replaces the flat _unspottedTurn cloak
// for owned provinces. Kings roll exactly as heroes do. Returns true if spotted.
export function spotEnemyInOwnedProvince(
  gs: TheStateAsTheseReadIt,
  viewerPi: number,
  prov: AProvinceAsTheseRead,
  enemyChar: Pick<AHeroAsSpottingReadsIt, 'id' | 'skills'>,
  turn?: number | null,
) {
  // turn: the report's turn (default gs.turn)
  // 2026-09-21 — A PROVINCE YOU HOLD IS GROUND YOU KNOW.
  // This read `exploredBy[viewerPi]`, and NOTHING writes that on conquest — only marching in does,
  // at +10% (+5%/Explorer) a visit. So a province taken by the sword sat at 10–20% "explored" for
  // its new owner forever, and the sum below fell straight through the 5% floor against any hero
  // with a single point of Spy. The result: the surviving heroes of a realm whose lands had all
  // been overrun could stand still in the conqueror's own province and be invisible ~95% of turns
  // — never in a sighting, never on the map, never in the Encounter list, so no one could get at
  // them at all. This function is ONLY ever called for a province the viewer owns (see
  // enemyCharVisibleTo), so the owner's knowledge of the ground is full by definition: his
  // tax-collectors, garrison and villagers walk it every day, whatever share of it his explorers
  // happened to chart. The contest that remains is the one that was always meant to be here — the
  // lurker's Spy against the watchers'.
  const explored = 100;
  const enemySpy = Math.min(5, Number(enemyChar.skills?.spy) || 0);
  let friendlySpy = 0;
  (prov.characters ?? []).forEach((cid) => {
    const f = gs.characters[cid];
    if (!f || !f.alive || f.player == null) return;
    const friendly = f.player === viewerPi || relOfReport(gs, viewerPi, f.player) === 'allied';
    if (friendly) friendlySpy = Math.max(friendlySpy, Number(f.skills?.spy) || 0);
  });
  friendlySpy = Math.min(5, friendlySpy);
  // …and no one hides in another realm's land indefinitely. The floor is 25%, not 5%: a Spy-5 hero
  // squatting in a province you hold is now found roughly every fourth turn instead of every
  // twentieth, so a hunt can always eventually be brought to him. Shimmer still halves it.
  let chance = Math.max(
    25,
    Math.min(
      95,
      explored -
        20 * enemySpy +
        10 * friendlySpy +
        discSumOf(
          gs.players?.[viewerPi],
          'spotLurker',
          'pct',
          (e) =>
            (!e.terrains || e.terrains.includes(prov.terrain)) &&
            (!e.home || homeFounderOf(gs, prov.id) === viewerPi) &&
            (!e.coastal || discProvCoastal(gs, prov)),
        ),
    ),
  ); // + spotLurker discoveries (sd60 Watch Houses)
  if (perkTier(enemyChar, 'illusory') >= 1) chance = Math.max(5, chance * 0.5); // ILLUSORY L6 (Shimmer): half as likely to be found
  return detRoll(turn ?? gs.turn, viewerPi, enemyChar.id, prov.id) * 100 < chance;
}
