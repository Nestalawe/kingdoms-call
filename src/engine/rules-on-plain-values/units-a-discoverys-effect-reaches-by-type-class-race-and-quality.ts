// The units a discovery's effect reaches: by its type, its class, its race and its quality (moved from
// src/engine/discoveries.ts by plan P1-19aa, as they were, so that the discoveries' effects in src/engine/rules/ and the
// engine's own readers ask one rule: the rules there may import only the content and this folder).
import { KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import type { TheEffectOfADiscovery } from '../../content/discovery-effects-their-kinds-numbers-and-words.ts';
import {
  CREATURE_ARMIES,
  FLYING_TYPES,
  MONSTER_ARMIES,
} from './units-that-fly-sail-or-can-be-carried-through-the-air.ts';

/** A unit as the discoveries read it (a saved game's army's fields: this folder doesn't import the save's schema). */
export interface AUnitAsTheDiscoveriesReadIt {
  readonly type: string;
  readonly race?: string;
  readonly quality?: string;
  readonly _isSkeletal?: boolean | undefined;
}
/** A unit, or its type's name with `typeOnly` true (the recruit price and the recruit quality ask of a type). */
export type AUnitOrItsTypesName =
  [army: string, typeOnly: true] | [army: AUnitAsTheDiscoveriesReadIt | null | undefined, typeOnly?: false];

export const DISC_CLS_SETS = {
  cavalry: new Set([
    'Free Lances',
    'Gilded Lances',
    'Warg Riders',
    'Eagle Riders',
    'Noble Griffons',
    'Stag Riders',
    'Ironhoof Rams',
  ]),
  infantry: new Set(['Shieldwall Levies', 'Dwarven Guard', 'Orc Berserkers', 'Men-at-Arms']),
  missile: new Set(KC_UNIT_CLASS.missile),
  fleet: new Set(KC_UNIT_CLASS.carrier),
  flyer: new Set(KC_UNIT_CLASS.aerial),
  garrison: new Set(KC_UNIT_CLASS.garrison),
};
export function discUnitIs(cls: string, ...[army, typeOnly]: AUnitOrItsTypesName) {
  // the unit's type; '' where there is none (no unit, or a name without typeOnly), which no set holds
  const t = (typeOnly ? army : army?.type) ?? '';
  if (cls === 'primal') return CREATURE_ARMIES.has(t) || MONSTER_ARMIES.has(t);
  if (cls === 'creature') return CREATURE_ARMIES.has(t);
  if (cls === 'monster') return MONSTER_ARMIES.has(t);
  if (cls === 'skeletal') return !typeOnly && !!army?._isSkeletal;
  // 2026-09-27 (Toby item 1): the four HUMANOID RACIAL FLYERS — Eagle Riders, Noble Griffons,
  // Gnomish Gyrocopters and Wyvern Riders (FLYING_TYPES) — are riders and crews of the playable
  // races, raised in their own race's provinces and carrying that race on `army.race`. They sit in
  // CREATURE_ARMIES / MONSTER_ARMIES for the Druid and Druidic/Evil rules (their MOUNTS are beasts),
  // but for everything that asks "is this one of my own people?" they are their race's soldiers and
  // must take the same benefits and penalties as the rest of the racial roster. Every RACE-keyed
  // effect already reached them through `army.race`; this class was the one place that did not, so a
  // realm's humanoid creed discoveries (recruit cost, upkeep, promotion, death reduction, mercenary
  // price) skipped exactly those four units. They are folded in here. Fleets and the skeletal dead
  // stay out, as do the true wild beasts.
  if (cls === 'humanoid')
    return (
      (FLYING_TYPES.has(t) || (!CREATURE_ARMIES.has(t) && !MONSTER_ARMIES.has(t))) &&
      !DISC_CLS_SETS.fleet.has(t) &&
      !(typeof army === 'object' && army?._isSkeletal)
    );
  const setsByClass: Readonly<Partial<Record<string, ReadonlySet<string>>>> = DISC_CLS_SETS;
  const st = setsByClass[cls];
  return !!st?.has(t);
}
// Does a unit-filtered effect (race / types / cls) apply to this army? (typeOnly: `army` is a type
// name.)
export function discUnitMatch(e: TheEffectOfADiscovery | null | undefined, ...unitOrItsTypesName: AUnitOrItsTypesName) {
  if (!e) return false;
  const [army, typeOnly] = unitOrItsTypesName;
  // the unit's type; '' where there is none (no unit), which no effect's list holds
  const t = (typeOnly ? army : army?.type) ?? '';
  if (e.types && !e.types.includes(t)) return false;
  if (e.cls && !discUnitIs(e.cls, ...unitOrItsTypesName)) return false;
  if (e.race) {
    const r = typeOnly ? (ARMY_RACE_OF_TYPE[t] ?? null) : (army?.race ?? '') || null;
    if (r !== e.race) return false;
  }
  if (Array.isArray(e.quality)) {
    const q = typeOnly ? 'Average' : (army?.quality ?? '') || 'Average';
    if (!e.quality.includes(q)) return false;
  }
  return true;
}
export const ARMY_RACE_OF_TYPE: Readonly<Partial<Record<string, string>>> = {
  'Shieldwall Levies': 'Human',
  'Free Lances': 'Human',
  'Yeoman Longbows': 'Human',
  'Gilded Lances': 'Human',
  'Human Garrison': 'Human',
  'Men-at-Arms': 'Human',
  'Elven Bowmen': 'Elven',
  'Forest Wardens': 'Elven',
  'Shadow Archers': 'Elven',
  'Eagle Riders': 'Elven',
  'Elven Galleys': 'Elven',
  'Elven Garrison': 'Elven',
  'Stag Riders': 'Elven',
  'Dwarven Guard': 'Dwarven',
  'Ironwood Crossbows': 'Dwarven',
  'Mountain Guns': 'Dwarven',
  'Dwarf Ironclads': 'Dwarven',
  'Gnomish Gyrocopters': 'Dwarven',
  'Dwarf Garrison': 'Dwarven',
  'Ironhoof Rams': 'Dwarven',
  'Warg Riders': 'Orcish',
  'Orc Berserkers': 'Orcish',
  'Goblin Horde': 'Orcish',
  'Wyvern Riders': 'Orcish',
  'Orcish Longships': 'Orcish',
  'Black Arrows': 'Orcish',
  'Orc Garrison': 'Orcish',
};
