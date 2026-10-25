// ── ALIGNMENT PROTOTYPES (ideas round 1, 2026-10-25) ────
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
export const SITE_SHARE_OF_LAND = 1 / 7; // about one land province in seven holds a holy site, and one in seven a barrow
export const RITE_OF_AWAKENING_COST = 10;
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

// ── Divine: Divine Power is the number of holy sites that shine (a holy site in a consecrated province the realm holds).
export function divinePower(G: GameState, pi: number): number {
  const pl = kitRealm(G, pi, 'Divine');
  if (!pl) return 0;
  const cons = pl.consecratedProvIds ?? [];
  return heldSites(G, pi, isHolySite).filter((pv) => cons.includes(pv.id)).length;
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
/** The Favour of the Old Gods: the Pagan host's strength multiplier. */
export function paganFavourMult(G: GameState, pi: number): number {
  const n = activatedSites(G, pi);
  return n >= 3 ? 1.5 : n >= 1 ? 1.3 : 1;
}

// ── Skills a kit lifts: the level a hero's skill counts as, over the trained and equipped level. Read by effStat.
export function protoSkillLift(G: GameState, c: Character | null | undefined, stat: string, base: number): number {
  if (c?.player == null) return 0;
  const align = protoAlignOf(G, c.player);
  if (!align) return 0;
  if (align === 'Neutral' && (stat === 'sage' || stat === 'spy' || stat === 'thief') && base >= 1) return 1; // Guilds
  if (align === 'Evil' && (stat === 'spy' || stat === 'thief') && base >= 1) return 1; // Dread: poisoners and spies
  if (align === 'Divine' && stat === 'white' && divinePower(G, c.player) >= 1) return 1; // Divine Power 1
  if (align === 'Undead' && stat === 'necromancy') return Math.min(2, barrowsHeld(G, c.player)); // barrows held
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
      const unleashed = divinePower(G, pi) >= 3;
      if (dark || (isAttacker && monsterWild) || holy || unleashed)
        return { mult: 1.5, label: holy && !dark ? 'Crusade: holy ground ×1.5' : 'Crusade ×1.5' };
      return nothing;
    }
    case 'Good': // the Shield of the Realm is the defence bonus, not a fervour
    case 'Druidic':
    case 'Neutral':
      return nothing;
    case 'Pagan': {
      const m = paganFavourMult(G, pi);
      return m > 1 ? { mult: m, label: `Favour of the Old Gods ×${m.toFixed(1)}` } : nothing;
    }
    case 'Evil': {
      const monsters = armies.some((a) => monsterTypes.has(a.type));
      return isAttacker && monsters ? { mult: 1.5, label: 'Savage Fury ×1.5' } : nothing;
    }
    case 'Undead': {
      // the king's x1.5 and a hero's x1.3 stay as they are; 3 despoiled provinces lift every commander to x1.5
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
