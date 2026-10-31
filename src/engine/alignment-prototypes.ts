// ── ALIGNMENT PROTOTYPES (ideas rounds 1 and 2, 2026-10-25) ────
// Each alignment's proposed kit is switched on per game by `G.alignmentPrototypes`, a list of alignment names set when
// the game is created (the balance runner sets it from KC_ALIGN_PROTO). A kit is live for a realm only when its
// alignment is in the list, so the matrix can measure one alignment's kit at a time against today's rules. Nothing here
// is a decided rule: the Google Doc "Kingdoms Call - Alignments: ideas round 1" says what each kit is for.
import { KC_QUALITY_UP, KC_UNIT_CLASS } from '../content/kingdoms-call-data.ts';
import type { Army, Character, GameState, Province, ProvinceFeature, Realm } from '../schemas/saved-game-state.ts';

/** Is the prototype kit of `align` switched on in this game? */
export function alignProto(G: GameState, align: string | null | undefined): boolean {
  const list = Array.isArray(G.alignmentPrototypes) ? G.alignmentPrototypes : [];
  return !!align && list.includes(align);
}
const realmOf = (G: GameState, pi: number | null | undefined): Realm | null =>
  pi == null ? null : (G.players[pi] ?? null);
/** The alignment of realm `pi` when its kit is on, else null. */
export function protoAlignOf(G: GameState, pi: number | null | undefined): string | null {
  if (!Array.isArray(G.alignmentPrototypes) || !G.alignmentPrototypes.length) return null; // no kit on: read nothing else
  const pl = realmOf(G, pi);
  return pl && alignProto(G, pl.alignment) ? pl.alignment : null;
}

// ── The map's sites. A holy site (Divine) or a barrow (Undead) is a feature carrying `ritualSite: true` so every path
// that finds, shows and remembers the old stones treats it alike, plus `siteKind: 'holy' | 'barrow'`. A Pagan rite is
// answered only by a site with no `siteKind`.
export const SITE_SHARE_OF_LAND = 1 / 5; // master list: about one land province in five holds a barrow (rounds 1-18: one in seven)
export const HOLY_SITE_SHARE_OF_LAND = 1 / 5; // round 2: and one in five a holy site
export const RITE_OF_AWAKENING_COST = 5; // master list (rounds 1-18: 10g)
export const RITE_OF_AWAKENING_TAX = 3; // round 2 (Votive Hoards): an awakened site pays +3 tax (round 1: +1)
// round 2: the Divine Power thresholds (a held holy site counts 1, a held AND consecrated one 2)
// master list (round 19): the gifts of the faith, one at each level of Divine Power
export const DIVINE_POWER_SANCTUARY = 1; // a hero on consecrated ground cannot be assassinated, charmed or robbed; healing doubled
export const DIVINE_POWER_RETURN = 2; // Grace abounding: a fallen hero's return spends no consecration (round 2: 3)
export const DIVINE_POWER_REVELATION = 3; // the realm sees every holy site on the map
export const DIVINE_POWER_PILGRIM_ROADS = 4; // a hero leading armies from consecrated ground marches as if March were 3 higher
export const DIVINE_POWER_ABSOLUTION = 5; // every curse, charm, plague and Terror on the realm is lifted at the end of the turn
export const DIVINE_POWER_TRIUMPHANT = 6; // every province counts as consecrated for Grace, the Last Rites and Sanctuary
export const PILGRIM_ROADS_MARCH = 3;
// round 2: the kings' orders and how long their effects hold
// round 5 (Toby): no king's order waits more than 3 turns; a cost decides instead
export const KING_ORDER_EVERY: Record<string, number> = {
  proclaim_crusade: 3,
  light_beacons: 3,
  embargo: 0, // master list: no waiting between Embargoes (rounds 2-18: 3)
  call_storm: 1, // master list: Call down the storm, once a turn
  dark_pact: 0, // every turn, at a price set by the monster
  bind_bones: 1, // master list: Bind the Bones, once a turn
};
export const CRUSADE_TURNS = 3;
export const EMBARGO_TURNS = 2; // round 4 (rounds 2-3: 3)
export const EMBARGO_TAX_MULT = 0.8; // round 3: −20% (round 2: −30%)
// round 5 (Toby): what the kits' orders cost. Those that were free cost now; see the round 5 document's review.
export const PROCLAIM_CRUSADE_COST = 6; // round 7 (rounds 5-6: 8; rounds 2-4: 5)
export const CONSECRATE_COST = 5; // Divine (was free)
export const GOOD_WORKS_COST = 0; // Good: master list makes it free again (rounds 5-18: 2g)
export const LIGHT_BEACONS_COST_PER_COMPANY = 2; // Good (was free)
export const GROW_WILD_COST = 8; // Druidic (was free)
export const CALL_WILD_COST = 2; // Druidic: master list, 2g a company that comes (rounds 5-18: 3g flat)
export const EMBARGO_COST = 5; // Neutral: master list (rounds 6-18: 4; round 5: 6; was free)
export const DESPOIL_COST = 5; // Undead: Blight the Land (master list; rounds 5-18: 3g)
export const BIND_BONES_COST = 2; // Undead: Bind the Bones, 2g a company
export const CALL_STORM_COST = 4; // Pagan: Call down the storm
export const DARK_PACT_COST_MULT = 1.5; // Evil: 1.5 × the monster's recruit cost (round 5: 2 ×; rounds 2-4: a flat 10g)
export const DARK_PACT_HP_SHARE = 0.4; // Evil: master list, 40% of the king's current HP (rounds 2-18: 5 HP)
// round 5: the mutual enemies and the beast provinces
export const CRUSADE_VS_UNDEAD_MULT = 1.75; // Divine against Undead forces (rounds 1-4: 1.5)
export const UNDEAD_GARRISON_CAP = 3; // skeletal companies the dead land raises into one garrison (round 7; rounds 5-6: 2)
export const PARLEY_MULT = 1.5; // Druidic storming an unclaimed creature province; Evil an unclaimed monster province
const CREATURES = new Set<string>(KC_UNIT_CLASS.creature);
const MONSTERS = new Set<string>(KC_UNIT_CLASS.monster);
export const isCreatureProvince = (pv: Province): boolean => isWild(pv) && pv.armyTypes.some((t) => CREATURES.has(t));
export const isMonsterProvince = (pv: Province): boolean => isWild(pv) && pv.armyTypes.some((t) => MONSTERS.has(t));
export const BEACONS_CAP = 6; // round 7 (rounds 3-6: 4; round 2: 6)
export const CALL_OF_THE_WILD_RANGE = 3;
export const RECLAIM_TURNS = 5; // round 21 (master list: 3; rounds 2-18: 5)
export const GRAVE_GOODS_PER_PROVINCE = 4; // round 7 (rounds 3-6: 3; round 2: 2)
// round 3's other tunings
export const CONDOTTIERI_MULT = 1.5; // Neutral: a hired company's strength (round 8; rounds 3-7: 1.3)
export const CONDOTTIERI_VS_BEASTS_MULT = 1.75; // Neutral (round 10): against a host with a creature or monster company in it
export const EMBARGO_BEAST_COST_MULT = 2; // Neutral (round 10): an embargoed realm's beasts cost double to recruit
export const DARK_PACT_QUALITY = 'Average'; // Evil: what the pact brings (round 8; rounds 3-7: Veteran; round 2: Elite)
export const BARROW_GRAVES_HUMANOID = 3; // Undead (master list): a held humanoid barrow keeps three graves filled
export const BARROW_GRAVES_WILD = 1; // and a creature or monster barrow one
export const WOOD_WAGE_MULT = 1 / 2; // Druidic: what a beast in the woods pays of its wage (master list: half; round 6: two-thirds)
export const BLOOD_HARVEST_KIT_EXTRA = 1; // Pagan (round 21): +1g a unit on Blood Harvest (2g a unit in all; rounds 8-20: 3g)
export const BLOOD_HARVEST_RISE_CHANCE = 0.5; // Pagan (master list): per unit slain, the chance one winning company rises a tier
export const BEAST_FRIEND_EXTRA = 2;
export const HOLY_SITE_NAMES = [
  'Shrine of the First Light',
  'Chapel of the Nine Candles',
  'Well of Saint Aldric',
  'Pilgrims’ Cross',
  'Tomb of the Blessed',
  'Hermit’s Spire',
  'Altar of Dawn',
  'Cloister of the Silent Choir',
];
export const BARROW_NAMES = [
  'Barrow of the Nameless King',
  'Crypt of Ash',
  'Gallows Hill',
  'Hollow Cairn',
  'Plague Pit of Morrow',
  'Mausoleum of the Drowned',
  'Bone Field',
  'Weeping Ossuary',
];
export const isPaganStones = (f: ProvinceFeature | null | undefined): boolean => !!(f && f.ritualSite && !f.siteKind);
export const isHolySite = (f: ProvinceFeature | null | undefined): boolean =>
  !!(f && f.ritualSite && f.siteKind === 'holy');
export const isBarrow = (f: ProvinceFeature | null | undefined): boolean =>
  !!(f && f.ritualSite && f.siteKind === 'barrow');
export const isWild = (pv: Province): boolean => (pv.race ?? '').startsWith('Primal');

/** The land and sea provinces around `pv` on the hex grid (the same six offsets as world generation, wrapping east to
 *  west, never past the top or bottom row). */
export function neighboursOf(G: GameState, pv: Province): Province[] {
  const { cols, rows, provinces } = G.world;
  const offs: [number, number][] =
    pv.row % 2 === 0
      ? [
          [-1, -1],
          [-1, 0],
          [0, -1],
          [0, 1],
          [1, -1],
          [1, 0],
        ]
      : [
          [-1, 0],
          [-1, 1],
          [0, -1],
          [0, 1],
          [1, 0],
          [1, 1],
        ];
  const out: Province[] = [];
  for (const [dr, dc] of offs) {
    const r = pv.row + dr;
    if (r < 0 || r >= rows) continue;
    const c = (((pv.col + dc) % cols) + cols) % cols;
    const n = provinces[r * cols + c];
    if (n) out.push(n);
  }
  return out;
}

/** The provinces of realm `pi` holding a feature `test` passes. */
export function heldSites(G: GameState, pi: number, test: (f: ProvinceFeature) => boolean): Province[] {
  const pl = realmOf(G, pi);
  if (!pl) return [];
  const out: Province[] = [];
  for (const id of pl.provinces) {
    const pv = G.world.provinces[id];
    if (!pv) continue;
    if (pv.owner === pi && pv.features.some(test)) out.push(pv);
  }
  return out;
}
const kitRealm = (G: GameState, pi: number, align: string): Realm | null => {
  const pl = realmOf(G, pi);
  if (!pl) return null;
  return pl.alignment === align && alignProto(G, align) ? pl : null;
};

// ── Divine: Divine Power counts the holy sites the realm holds, and again those that shine (a holy site in a consecrated
// province the realm holds): a shining site is worth 2 (round 2; round 1 counted shining sites alone).
export function shiningSites(G: GameState, pi: number): number {
  const pl = kitRealm(G, pi, 'Divine');
  if (!pl) return 0;
  const cons = pl.consecratedProvIds ?? [];
  return heldSites(G, pi, isHolySite).filter((pv) => cons.includes(pv.id)).length;
}
export function divinePower(G: GameState, pi: number): number {
  const pl = kitRealm(G, pi, 'Divine');
  if (!pl) return 0;
  const crusading = (pl._crusadeUntil ?? -1) >= G.turn ? 1 : 0; // round 3: a Proclaimed Crusade is +1 Power while it lasts
  return heldSites(G, pi, isHolySite).length + shiningSites(G, pi) + crusading;
}
/** Round 2: is the king's order `key` off its cooldown for realm `pl` this turn? */
export function kingOrderReady(G: GameState, pl: Realm, key: string): boolean {
  const last = pl._kingOrderLast?.[key];
  const every = KING_ORDER_EVERY[key] ?? 0;
  return last == null || G.turn - last >= every;
}
export function noteKingOrder(G: GameState, pl: Realm, key: string): void {
  pl._kingOrderLast = { ...(pl._kingOrderLast ?? {}), [key]: G.turn };
}
/** Round 2 (Beast-friend): the beasts a hero of a Druidic or Evil kit realm leads beyond his Druid level. */
export function protoBeastRoomExtra(G: GameState, c: Character | null | undefined): number {
  if (c?.player == null) return 0;
  const align = protoAlignOf(G, c.player);
  return align === 'Druidic' || align === 'Evil' ? BEAST_FRIEND_EXTRA : 0;
}
// ── Undead: barrows held, and despoiled provinces held.
export function barrowsHeld(G: GameState, pi: number): number {
  return kitRealm(G, pi, 'Undead') ? heldSites(G, pi, isBarrow).length : 0;
}
/** Master list: every blighted province adds this to the skeletal hosts' multiplier, to UNDEAD_FEAR_CAP. */
export const UNDEAD_FEAR_PER_BLIGHT = 0.05;
export const UNDEAD_FEAR_CAP = 2.0;
export const UNDEAD_FEAR_KING = 1.5;
export const UNDEAD_FEAR_HERO = 1.3;
export function undeadFearMult(G: GameState, pi: number, king: boolean): number {
  const base = king ? UNDEAD_FEAR_KING : UNDEAD_FEAR_HERO;
  return Math.min(UNDEAD_FEAR_CAP, Math.round((base + UNDEAD_FEAR_PER_BLIGHT * despoiledHeld(G, pi)) * 100) / 100);
}
export function despoiledHeld(G: GameState, pi: number): number {
  const pl = kitRealm(G, pi, 'Undead');
  if (!pl) return 0;
  return pl.provinces.filter((id) => {
    const pv = G.world.provinces[id];
    if (!pv) return false;
    return pv.owner === pi && pv._despoiled != null;
  }).length;
}
// ── Pagan: ritual sites the realm holds and has activated (a rite performed there while it was the realm's).
export function activatedSites(G: GameState, pi: number): number {
  const pl = kitRealm(G, pi, 'Pagan');
  if (!pl) return 0;
  return pl.provinces.filter((id) => {
    const pv = G.world.provinces[id];
    if (!pv) return false;
    return pv.owner === pi && pv._riteActivatedBy === pi && pv.features.some(isPaganStones);
  }).length;
}
/** Round 2: the Favour's points: 1 for each stones province the realm holds, 1 more for each it has woken. */
export function paganFavourPoints(G: GameState, pi: number): number {
  if (!kitRealm(G, pi, 'Pagan')) return 0;
  return heldSites(G, pi, isPaganStones).length + activatedSites(G, pi);
}
export const FAVOUR_PER_POINT = 0.1; // round 20 (master list: 0.15)
export const FAVOUR_CAP = 1.5; // round 21 (round 20: 1.6; master list: 1.9)
export const OLD_STONES_MULT = 1.9; // defending a stones province of the realm
/** The Favour of the Old Gods (round 20): ×(1 + 0.1 × points), to ×1.6 at 6 points (master list: 0.15 a point, to ×1.9). */
export function paganFavourMult(G: GameState, pi: number): number {
  const n = paganFavourPoints(G, pi);
  return Math.min(FAVOUR_CAP, Math.round((1 + FAVOUR_PER_POINT * n) * 100) / 100);
}

/** Master list: does `pv` count as consecrated for realm `pi` — consecrated, or any province it holds at Divine Power 6? */
export function countsConsecrated(G: GameState, pi: number | null | undefined, pv: Province | null | undefined): boolean {
  const pl = pi == null ? null : kitRealm(G, pi, 'Divine');
  if (!pl || !pv || pv.owner !== pi) return false;
  if ((pl.consecratedProvIds ?? []).includes(pv.id)) return true;
  return divinePower(G, pl.id) >= DIVINE_POWER_TRIUMPHANT && pv.terrain !== 'sea';
}
/** Master list (Sanctuary, Divine Power 1): is this Divine hero standing on consecrated ground of his realm? */
export function inSanctuary(G: GameState, c: Character | null | undefined): boolean {
  if (c?.player == null || protoAlignOf(G, c.player) !== 'Divine') return false;
  if (divinePower(G, c.player) < DIVINE_POWER_SANCTUARY) return false;
  return countsConsecrated(G, c.player, G.world.provinces[c.location]);
}
/** Master list (Pilgrim roads, Divine Power 4): the hero began this turn on consecrated ground of his realm. */
export function pilgrimRoads(G: GameState, c: Character): boolean {
  if (c.player == null || divinePower(G, c.player) < DIVINE_POWER_PILGRIM_ROADS) return false;
  const start = c._turnStartLoc ?? c.location;
  return countsConsecrated(G, c.player, G.world.provinces[start]);
}
/** Master list (the Crusade's Hounds of God and Holy wrath): is `quarry` a hero of the realm `pi` is on Crusade against? */
export function crusadeQuarry(G: GameState, pi: number | null | undefined, quarry: Character | null | undefined): boolean {
  const pl = pi == null ? null : kitRealm(G, pi, 'Divine');
  if (!pl || quarry?.player == null) return false;
  return pl._crusadeVs === quarry.player && (pl._crusadeUntil ?? -1) >= G.turn;
}

// ── Skills a kit lifts: the level a hero's skill counts as, over the trained and equipped level. Read by effStat.
/** Round 15: each alignment's own skill, which the general rule lifts by one. */
export const SIGNATURE_SKILL: Record<string, string> = {
  Divine: 'white',
  Good: 'tactical',
  Druidic: 'druid',
  Neutral: 'sage',
  Pagan: 'explorer',
  Evil: 'spy',
  Undead: 'necromancy',
};
export function protoSkillLift(G: GameState, c: Character | null | undefined, stat: string, base: number): number {
  if (c?.player == null) return 0;
  const align = protoAlignOf(G, c.player);
  if (!align) return 0;
  // Round 15 (the cut to six): one general rule in place of seven abilities. Every realm's heroes count one level
  // higher in their alignment's own skill, where they have it at all.
  if (stat === SIGNATURE_SKILL[align] && base >= 1)
    return 1 + (align === 'Undead' ? barrowsHeld(G, c.player) : 0); // master list: a barrow each, no cap
  if (align === 'Undead' && stat === 'necromancy') return barrowsHeld(G, c.player); // the barrows lift even a hero with none
  if (align === 'Neutral' && (stat === 'spy' || stat === 'thief') && base >= 1) return 1; // Guilds
  // master list, Divine Power 4 (Pilgrim roads): a hero leading armies who began the turn on consecrated ground
  if (align === 'Divine' && stat === 'march' && c.armies.length && pilgrimRoads(G, c)) return PILGRIM_ROADS_MARCH;
  return 0;
}

/** One quality tier up, for a muster a kit lifts (Neutral mercenaries, beasts raised in a held wild province). */
const QUALITY_UP: Record<string, string> = KC_QUALITY_UP;
export const qualityUp = (q: string): string => QUALITY_UP[q] ?? q;

// ── Fervour (the battle multiplier a kit gives a side, in place of the zeal roll). `pi` is the realm, `armies` its
// units, `enemyPi` the other side's realm (null for a neutral guard or wild province), `prov` the battlefield,
// `isAttacker` which side it is, `leader` its commander (null for an unled garrison). Returns null when the realm's kit is
// off (the old rules roll zeal as before); else { mult, label } with mult 1 when the kit gives nothing this battle.
export interface Fervour {
  mult: number;
  label: string;
}
export interface FervourSide {
  enemyPi: number | null;
  prov: Province | null | undefined;
  isAttacker: boolean;
  leader: Character | null | undefined;
  monsterTypes: Set<string>;
  /** the other side's companies, when known (round 8: the Crusade against the wild reads them) */
  enemyArmies?: Army[];
}
const nothing: Fervour = { mult: 1, label: '' };
export function protoFervour(G: GameState, pi: number, armies: Army[], side: FervourSide): Fervour | null {
  const align = protoAlignOf(G, pi);
  const pl = realmOf(G, pi);
  if (!align || !pl) return null;
  const { enemyPi, prov, isAttacker, leader, monsterTypes } = side;
  const enemy = realmOf(G, enemyPi);
  const enemyAlign = enemy ? enemy.alignment : null;
  switch (align) {
    case 'Divine': {
      const wild = !!prov && isWild(prov) && prov.owner == null;
      const monsterWild = wild && prov.armyTypes.some((t) => monsterTypes.has(t));
      const dark = enemyAlign === 'Evil';
      const holy = !isAttacker && !!prov && prov.owner === pi && (pl.consecratedProvIds ?? []).includes(prov.id);
      // round 20: the Proclaimed Crusade's ×1.5 against the named realm's hosts is back (the master list had dropped it);
      // Divine Power 3 no longer puts the ×1.5 in every battle (the gifts of the faith are elsewhere now)
      const proclaimed = enemyPi != null && pl._crusadeVs === enemyPi && (pl._crusadeUntil ?? -1) >= G.turn;
      if (enemyAlign === 'Undead') return { mult: CRUSADE_VS_UNDEAD_MULT, label: 'Crusade against the Undead ×1.75' }; // round 5
      if (proclaimed) return { mult: 1.5, label: 'Proclaimed Crusade ×1.5' };
      // round 8: the Crusade is against the wild too — any host with a creature or monster company in it
      if ((side.enemyArmies ?? []).some((a) => CREATURES.has(a.type) || MONSTERS.has(a.type)))
        return { mult: 1.5, label: 'Crusade against the wild ×1.5' };
      if (dark || (isAttacker && monsterWild) || holy)
        return { mult: 1.5, label: holy && !dark ? 'Crusade: holy ground ×1.5' : 'Crusade ×1.5' };
      return nothing;
    }
    case 'Good': {
      // the Shield of the Realm is the defence bonus, not a fervour; round 2: Reclaim, ×1.5 retaking land lately lost
      const lost =
        isAttacker &&
        !!prov &&
        prov._lostFrom === pi &&
        prov._lostTurn != null &&
        G.turn - prov._lostTurn <= RECLAIM_TURNS;
      return lost ? { mult: 1.5, label: 'Reclaim ×1.5' } : nothing;
    }
    case 'Druidic': // round 5: Parley with the Wild — storming an unclaimed creature province, the beasts half-yield
      if (isAttacker && !!prov && prov.owner == null && isCreatureProvince(prov))
        return { mult: PARLEY_MULT, label: 'Parley with the Wild ×1.5' };
      return nothing;
    case 'Neutral':
      return nothing;
    case 'Pagan': {
      // round 4: the Old Stones — a host defending a stones province of the realm fights at the Favour's maximum
      if (!isAttacker && !!prov && prov.owner === pi && prov.features.some(isPaganStones))
        return { mult: OLD_STONES_MULT, label: `The Old Stones ×${String(OLD_STONES_MULT)}` }; // ×1.9 (round 9: ×1.75)
      const m = paganFavourMult(G, pi);
      return m > 1 ? { mult: m, label: `Favour of the Old Gods ×${String(m)}` } : nothing;
    }
    case 'Evil': {
      // round 5: Dominion of the Pits — storming an unclaimed monster province, with or without monsters of your own;
      // round 6: and defending a monster province of the realm's
      const pits =
        !!prov &&
        isMonsterProvince(prov) &&
        ((isAttacker && prov.owner == null) || (!isAttacker && prov.owner === pi));
      const monsters = armies.some((a) => monsterTypes.has(a.type));
      const fury = monsters ? (isAttacker ? 1.5 : 1.25) : 1; // round 2: ×1.25 defending
      // master list: the Dominion of the Pits stacks with Savage Fury (as the Druids' Parley stacks with Home of the Wild)
      const mult = Math.round((pits ? PARLEY_MULT : 1) * fury * 100) / 100;
      if (mult <= 1) return nothing;
      const parts = [pits ? 'Dominion of the Pits ×1.5' : '', monsters ? `Savage Fury ×${String(fury)}` : ''].filter(Boolean);
      return { mult, label: parts.join(' and ') };
    }
    case 'Undead': {
      // master list (The dead fear nothing): the king's ×1.5 and a hero's ×1.3, + 0.05 for every blighted province the
      // realm holds, to ×2.0. (Hatred of the Light and the Rising Tide are gone.)
      const skel = armies.some((a) => a._isSkeletal);
      if (!skel) return nothing;
      const m = undeadFearMult(G, pi, !!leader?.isKing);
      return { mult: m, label: `The dead fear nothing ×${String(m)}` };
    }
    default:
      return null;
  }
}

// ── Tax a kit adds to one province (the tax step and the realm's report). Good's villages: a Poor humanoid province pays
// +2; Neutral's markets: a Prosperous or Rich province pays half again (in place of the flat +20%).
export function protoProvinceTaxAdd(G: GameState, pl: Realm, pv: Province, taxSoFar: number): number {
  if (pv.terrain === 'sea' || !alignProto(G, pl.alignment)) return 0;
  const base = pv.tax;
  if (pl.alignment === 'Good' && base <= 4 && !isWild(pv)) return 3; // round 21: tax 4 or less (master list: 3 or less); round 8: +3
  if (pl.alignment === 'Neutral' && base >= 4) return Math.round(taxSoFar * 0.5);
  return 0;
}

/** Round 2 (Embargo): what a realm's province tax is multiplied by this turn. */
export function embargoTaxMult(G: GameState, pl: Realm): number {
  return (pl._embargoUntil ?? -1) >= G.turn && alignProto(G, 'Neutral') ? EMBARGO_TAX_MULT : 1;
}
/** Master list (Healers' fees): what a Druidic hero standing in a humanoid province earns the realm this turn, or 0. */
export function healersFee(G: GameState, c: Character): number {
  if (c.player == null || !c.alive || protoAlignOf(G, c.player) !== 'Druidic') return 0;
  const pv = G.world.provinces[c.location];
  if (!pv || pv.terrain === 'sea' || isWild(pv)) return 0;
  if (pv._despoiled != null || pv._terrorStacks) return 0; // the blighted and the terrified have worse to think of
  if (pv.owner != null && (G.players[pv.owner]?.consecratedProvIds ?? []).includes(pv.id)) return 0; // the Church distrusts the druids
  const druid = c.skills.druid ?? 0;
  return druid > 0 ? Math.ceil((druid + 1) / 2) : 0; // half the Druid skill (the signature +1 counted), rounded up
}
/** Round 2: the gold a kit pays a realm at tax time beyond its provinces' tax, itemised. Healers' fees (Druidic),
 *  Tribute of Fear (Evil), Grave Goods (Undead). */
export function protoRealmGold(G: GameState, pi: number): { gold: number; note: string } {
  const align = protoAlignOf(G, pi);
  const pl = realmOf(G, pi);
  if (!align || !pl) return { gold: 0, note: '' };
  switch (align) {
    case 'Druidic': {
      let g = 0;
      for (const c of G.characters) if (c.player === pi) g += healersFee(G, c);
      return { gold: g, note: g ? ` (+${String(g)}g healers' fees)` : '' };
    }
    case 'Evil': {
      let g = 0;
      for (const pv of G.world.provinces)
        if (pv.owner != null && pv.owner !== pi && pv._terrorisedBy === pi && pv._terrorStacks) g += 1; // round 20: 1g a province (master list: a stack)
      return { gold: g, note: g ? ` (+${String(g)}g Tribute of Fear)` : '' }; // master list: no cap (round 3: 5g)
    }
    case 'Undead': {
      const g = GRAVE_GOODS_PER_PROVINCE * despoiledHeld(G, pi);
      return { gold: g, note: g ? ` (+${String(g)}g grave goods)` : '' };
    }
    default:
      return { gold: 0, note: '' };
  }
}

// ── Bot tactics for the kits (ideas round 1b). A second switch, `G.alignmentPrototypeTactics` (the balance runner sets it
// from KC_ALIGN_TACTICS=1), under which a bot realm whose kit is on plays to it: its strength estimate knows the kit's
// bonuses, its marching favours the ground the kit covets, it collects what the kit breeds, hires what the kit brings
// to market, and times the kit's orders. Off, the bots play as they do today, kit or no kit.
export function kitTactics(G: GameState, pi: number | null | undefined): string | null {
  if (G.alignmentPrototypeTactics !== true) return null;
  return protoAlignOf(G, pi);
}
/** How much a bot of realm `pi` wants province `pv` for its kit's sake, on top of the usual score (0 when it has no
 *  kit, no tactics, or the province holds nothing the kit covets). `known` says which features the realm has found. */
export function kitTargetBonus(G: GameState, pi: number, pv: Province, known: (f: ProvinceFeature) => boolean): number {
  const align = kitTactics(G, pi);
  if (!align || pv.terrain === 'sea') return 0;
  const has = (test: (f: ProvinceFeature) => boolean) => pv.features.some((f) => test(f) && known(f));
  const wild = isWild(pv);
  switch (align) {
    case 'Divine':
      return has(isHolySite) ? 15 : 0;
    case 'Good':
      return !wild && pv.tax <= 3 ? 8 : 0;
    case 'Druidic': // round 5: the creature provinces are the prize
      return (
        (pv.terrain === 'forest' || pv.terrain === 'jungle' ? 8 : 0) + (isCreatureProvince(pv) ? 30 : wild ? 10 : 0)
      );
    case 'Neutral':
      return pv.tax >= 4 ? 8 : 0;
    case 'Pagan':
      return has(isPaganStones) ? 10 : 0;
    case 'Evil': // round 5: the monster provinces are the prize
      return isMonsterProvince(pv) ? 30 : wild ? 10 : 0;
    case 'Undead':
      return has(isBarrow) ? 12 : 0;
    default:
      return 0;
  }
}
