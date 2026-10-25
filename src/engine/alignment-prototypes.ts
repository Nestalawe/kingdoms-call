// ── ALIGNMENT PROTOTYPES (ideas rounds 1 and 2, 2026-10-25) ────
// Each alignment's proposed kit is switched on per game by `G.alignmentPrototypes`, a list of alignment names set when
// the game is created (the balance runner sets it from KC_ALIGN_PROTO). A kit is live for a realm only when its
// alignment is in the list, so the matrix can measure one alignment's kit at a time against today's rules. Nothing here
// is a decided rule: the Google Doc "Kingdoms Call - Alignments: ideas round 1" says what each kit is for.
import { KC_QUALITY_UP } from '../content/kingdoms-call-data.ts';
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
export const SITE_SHARE_OF_LAND = 1 / 7; // about one land province in seven holds a barrow
export const HOLY_SITE_SHARE_OF_LAND = 1 / 5; // round 2: and one in five a holy site
export const RITE_OF_AWAKENING_COST = 10;
export const RITE_OF_AWAKENING_TAX = 3; // round 2 (Votive Hoards): an awakened site pays +3 tax (round 1: +1)
// round 2: the Divine Power thresholds (a held holy site counts 1, a held AND consecrated one 2)
export const DIVINE_POWER_WHITE = 1; // every Divine hero casts White one level higher
export const DIVINE_POWER_RETURN = 3; // a fallen hero's return spends no consecration
export const DIVINE_POWER_UNLEASHED = 5; // the Crusade's ×1.5 in every battle
// round 2: the kings' orders and how long their effects hold
export const KING_ORDER_EVERY: Record<string, number> = {
  proclaim_crusade: 5,
  light_beacons: 6,
  embargo: 5,
  great_sacrifice: 5,
  dark_pact: 5,
  spread_plague: 5,
};
export const CRUSADE_TURNS = 3;
export const EMBARGO_TURNS = 3;
export const EMBARGO_TAX_MULT = 0.7;
export const SACRIFICE_TURNS = 3;
export const PLAGUE_TURNS = 3;
export const PROCLAIM_CRUSADE_COST = 5;
export const DARK_PACT_COST = 10;
export const DARK_PACT_HP = 5;
export const BEACONS_CAP = 6;
export const CALL_OF_THE_WILD_RANGE = 3;
export const RECLAIM_TURNS = 5;
export const PILGRIMS_COIN_PER_SITE = 3;
export const COUNTING_HOUSE_CAP = 5;
export const GRAVE_GOODS_PER_PROVINCE = 2;
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
  if (!kitRealm(G, pi, 'Divine')) return 0;
  return heldSites(G, pi, isHolySite).length + shiningSites(G, pi);
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
/** The Favour of the Old Gods: the Pagan host's strength multiplier (2 points ×1.3, 4 points ×1.5). */
export function paganFavourMult(G: GameState, pi: number): number {
  const n = paganFavourPoints(G, pi);
  return n >= 4 ? 1.5 : n >= 2 ? 1.3 : 1;
}

// ── Skills a kit lifts: the level a hero's skill counts as, over the trained and equipped level. Read by effStat.
export function protoSkillLift(G: GameState, c: Character | null | undefined, stat: string, base: number): number {
  if (c?.player == null) return 0;
  const align = protoAlignOf(G, c.player);
  if (!align) return 0;
  if (align === 'Neutral' && (stat === 'sage' || stat === 'spy' || stat === 'thief') && base >= 1) return 1; // Guilds
  if (align === 'Evil' && (stat === 'spy' || stat === 'thief') && base >= 1) return 1; // Dread: poisoners and spies
  if (align === 'Divine' && stat === 'white' && divinePower(G, c.player) >= DIVINE_POWER_WHITE) return 1; // Divine Power
  if (align === 'Undead' && stat === 'necromancy') return (base >= 1 ? 1 : 0) + Math.min(2, barrowsHeld(G, c.player)); // round 2: necromancers +1, and the barrows held
  if (align === 'Good' && stat === 'tactical' && base >= 1 && !c.isKing) return 1; // round 2: Captains of the Shield
  if (align === 'Druidic' && stat === 'druid' && base >= 1) return 1; // round 2: the circle's craft
  if (align === 'Pagan' && stat === 'explorer' && base >= 1) return 1; // round 2: Seers
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
      const dark = enemyAlign === 'Undead' || enemyAlign === 'Evil';
      const holy = !isAttacker && !!prov && prov.owner === pi && (pl.consecratedProvIds ?? []).includes(prov.id);
      const unleashed = divinePower(G, pi) >= DIVINE_POWER_UNLEASHED;
      const proclaimed = enemyPi != null && pl._crusadeVs === enemyPi && (pl._crusadeUntil ?? -1) >= G.turn; // round 2
      if (proclaimed) return { mult: 1.5, label: 'Proclaimed Crusade ×1.5' };
      if (dark || (isAttacker && monsterWild) || holy || unleashed)
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
    case 'Druidic':
    case 'Neutral':
      return nothing;
    case 'Pagan': {
      if ((pl._sacrificeUntil ?? -1) >= G.turn) return { mult: 1.5, label: 'Great Sacrifice ×1.5' }; // round 2
      const m = paganFavourMult(G, pi);
      return m > 1 ? { mult: m, label: `Favour of the Old Gods ×${m.toFixed(1)}` } : nothing;
    }
    case 'Evil': {
      const monsters = armies.some((a) => monsterTypes.has(a.type));
      if (!monsters) return nothing;
      return isAttacker ? { mult: 1.5, label: 'Savage Fury ×1.5' } : { mult: 1.25, label: 'Savage Fury ×1.25' }; // round 2: ×1.25 defending
    }
    case 'Undead': {
      // the king's x1.5 and a hero's x1.3 stay as they are; 3 despoiled provinces lift every commander to x1.5
      if (enemyAlign === 'Divine') return { mult: 1.5, label: 'Hatred of the Light ×1.5' }; // round 2: the mortal enemy
      const skel = armies.some((a) => a._isSkeletal);
      if (skel && leader && !leader.isKing && despoiledHeld(G, pi) >= 3)
        return { mult: 1.5, label: 'The Rising Tide ×1.5' };
      return null;
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
  if (pl.alignment === 'Good' && base <= 3 && !isWild(pv)) return 2;
  if (pl.alignment === 'Neutral' && base >= 4) return Math.round(taxSoFar * 0.5);
  return 0;
}

/** Round 2 (Embargo): what a realm's province tax is multiplied by this turn. */
export function embargoTaxMult(G: GameState, pl: Realm): number {
  return (pl._embargoUntil ?? -1) >= G.turn && alignProto(G, 'Neutral') ? EMBARGO_TAX_MULT : 1;
}
/** Round 2: the gold a kit pays a realm at tax time beyond its provinces' tax, itemised. Pilgrims' Coin (Divine),
 *  Counting-houses (Neutral), Tribute of Fear (Evil), Grave Goods (Undead). */
export function protoRealmGold(G: GameState, pi: number): { gold: number; note: string } {
  const align = protoAlignOf(G, pi);
  const pl = realmOf(G, pi);
  if (!align || !pl) return { gold: 0, note: '' };
  switch (align) {
    case 'Divine': {
      const g = PILGRIMS_COIN_PER_SITE * shiningSites(G, pi);
      return { gold: g, note: g ? ` (+${String(g)}g Pilgrims' Coin)` : '' };
    }
    case 'Neutral': {
      const g = Math.min(COUNTING_HOUSE_CAP, Math.floor(pl.gold / 10));
      return { gold: g, note: g ? ` (+${String(g)}g the counting-houses)` : '' };
    }
    case 'Evil': {
      let g = 0;
      for (const pv of G.world.provinces)
        if (pv.owner != null && pv.owner !== pi && pv._terrorisedBy === pi && pv._terrorStacks) g += pv._terrorStacks;
      return { gold: g, note: g ? ` (+${String(g)}g Tribute of Fear)` : '' };
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
    case 'Druidic':
      return (pv.terrain === 'forest' || pv.terrain === 'jungle' ? 8 : 0) + (wild ? 10 : 0);
    case 'Neutral':
      return pv.tax >= 4 ? 8 : 0;
    case 'Pagan':
      return has(isPaganStones) ? 10 : 0;
    case 'Evil':
      return wild ? 10 : 0;
    case 'Undead':
      return has(isBarrow) ? 12 : 0;
    default:
      return 0;
  }
}
