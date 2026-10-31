import {
  KC_HUMANOID_RACES,
  KC_TEMPERS,
  KC_TERRAIN_COLORS,
  KC_UNIT_CLASS,
  PROVINCE_ARMIES_P,
  TEMPER_TRAITS,
} from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';
import { shuffleP } from '../battle/fortune.ts';
import { activeItems, rollMagicItem } from '../items/equipment.ts';
import { LAIR_ITEM_ODDS, awardedEffectSet, itemEffectKey } from '../items/tiers-and-hoards.ts';
import { HOME_FLEET_BY_RACE, homeProvinceIdFor } from '../grand-design.ts';
import { discProvCoastal } from '../discoveries.ts';
import { dedupeItemsByName, effSkillOf } from '../heroes/skills-and-hp.ts';
import {
  countsAgainstBeastCommand,
  druidALeaderBringsToAUnit,
  druidLevelALeaderNeeds,
  druidShortfall,
  strengthLeftByADruidShortfall,
  unitAsItsRealmSeesIt,
} from '../rules-on-plain-values/beasts-a-hero-may-lead-and-the-druid-each-unit-needs.ts';
import type { AHeroAsHisItemsAreRead, AnItemAsTheSlotsReadIt } from '../items/equipment.ts';

// Its types (plan P1-10b19): each parameter typed as wide as the body's guards (plan P1-10's Decision 2), so each guard
// stays. A table read by any string is read through a typed local inside its function.
/** A hero as his skill's level is read (effSkillOf's hero): his skills, curses and items, where he stands and whose he
 *  is. */
type AHeroAsHisSkillIsRead = NonNullable<Parameters<typeof effSkillOf>[0]>;
/** The heroes a skill's level is read beside (an aura's bearer among them), or none. */
type TheHeroesAsASkillIsReadBesideThem = Parameters<typeof effSkillOf>[2];
/** A unit as the beast command counts it: the engine's unit, as unitAsItsRealmSeesIt reads it. */
type AUnitAsTheBeastCommandCountsIt = Parameters<typeof unitAsItsRealmSeesIt>[0];
/** A hero as the beast command reads him: his skill's hero, whose he is, and the units he leads (a gap among them, or
 *  none). */
interface AHeroAsTheBeastCommandReadsHim extends AHeroAsHisSkillIsRead {
  readonly armies?: readonly (AUnitAsTheBeastCommandCountsIt | null | undefined)[] | null | undefined;
}
/** A commander as the battle's Druid check reads him: his race, alignment, Druid and items, and the marks a battle's
 *  magic and a neutral guard leave on him. */
interface ACommanderAsTheDruidCheckReadsHim extends AHeroAsHisItemsAreRead<AnItemAsTheSlotsReadIt> {
  readonly _isNeutralGuard?: boolean | undefined;
  readonly _druidNegated?: boolean | undefined;
  readonly _curseHalveStat?: string | null | undefined;
  readonly skills?: { readonly druid?: number | undefined } | null | undefined;
}
/** A unit as the battle's Druid check reads it: its type and race, and whether it is a skeleton. */
interface AUnitAsTheDruidCheckReadsIt {
  readonly type: string;
  readonly race?: string | null | undefined;
  readonly _isSkeletal?: boolean | undefined;
}
/** A feature's treasure as a save holds it: gold as a number, or (a sea feature saved before v1054) `{ gold }`. */
type AFeaturesTreasure = number | { gold?: number | undefined } | null | undefined;
/** An item in a lair's hoard, as the hoard's stocking moves it: one the lair held before hoards, or one rolled. */
interface AnItemInAHoard {
  readonly name: string;
}
/** A lair as its hoard is stocked and its gold read: its guardian's power, its treasure, its hoard and the marks the
 *  stocking leaves (each optional: an older save holds none). */
interface ALairAsItsHoardIsStocked {
  readonly ritualSite?: boolean | undefined;
  readonly cleared?: boolean | undefined;
  readonly monster?: { readonly power?: string | undefined } | null | undefined;
  treasure?: AFeaturesTreasure;
  hoardItems?: AnItemInAHoard[] | null | undefined;
  lairItems?: AnItemInAHoard[] | null | undefined;
  _hoardV2?: boolean | undefined;
  _clearGold?: number | null | undefined;
  _hoardGoldOrig?: number | null | undefined;
}
/** The state as a lair's stocking reads it: the items handed out (by name) and the next item's id. */
interface TheStateAsTheStockingReadsIt {
  _awardedItems?: string[] | null | undefined;
  nextItemId?: number | undefined;
}
/** A realm as the home rosters' backfill reads it: its race, and its home as homeProvinceIdFor finds it. */
type ARealmAsTheBackfillReadsIt = NonNullable<
  NonNullable<NonNullable<Parameters<typeof homeProvinceIdFor>[0]>['players']>[number]
> & { readonly race?: string | null | undefined };
/** A province as the home rosters' backfill reads it: its ground and race, the units it offers, and its place on the
 *  map (discProvCoastal's). */
type AProvinceAsTheBackfillReadsIt = NonNullable<
  NonNullable<NonNullable<NonNullable<Parameters<typeof homeProvinceIdFor>[0]>['world']>['provinces']>[number]
> &
  NonNullable<NonNullable<NonNullable<Parameters<typeof discProvCoastal>[0]>['world']>['provinces'][number]> & {
    readonly race?: string | null | undefined;
  };
/** The state as the home rosters' backfill reads it: the realms and the map, each guarded as if it may be missing. */
interface TheStateAsTheBackfillReadsIt {
  readonly players?: readonly (ARealmAsTheBackfillReadsIt | null | undefined)[] | null | undefined;
  readonly world?:
    | (NonNullable<NonNullable<Parameters<typeof discProvCoastal>[0]>['world']> & {
        readonly provinces: readonly (AProvinceAsTheBackfillReadsIt | null | undefined)[];
      })
    | null;
}

// ── INLINE GAME GENERATION ENGINE ────
// Self-contained mini game engine for the portal
// (mirrors the logic in kingdoms-call-gm.html / game.js)

export const TERRAIN_COLORS_P = { ...KC_TERRAIN_COLORS };
export const RACES_P = KC_HUMANOID_RACES.slice();
// The four playable humanoid races, as a Set, for world-gen membership tests (a province race is
// either one of these, null for open sea, or a 'Primal:<sub-race>' string).
export const HUMANOID_RACES_GEN = new Set(RACES_P);
export const LAND_TERRAINS_GEN = ['plain', 'desert', 'forest', 'jungle', 'mountain'];
// Each race's heartland. Province race allocation is weighted towards these terrains, so most Human
// provinces are plains, most Elven ones forest, and so on — while any race can still turn up
// anywhere. See the allocation pass in generateNewGame.
export const SIGNATURE_TERRAIN_P = { Human: 'plain', Elven: 'forest', Dwarven: 'mountain', Orcish: 'desert' };
// How much more likely a race is to be placed in its signature terrain than in any other. 6 puts
// roughly two thirds of a terrain's provinces with its signature race while leaving every race
// genuinely possible everywhere.
export const SIGNATURE_WEIGHT_P = 6;

// Every humanoid province offers 2 or 3 recruitable land types PLUS its racial garrison (and, on a
// coast, its race's fleet). 2026-10-14 (Toby, item 15): two three times in four, three one time in
// four (provincePoolSize), chosen at random from the units of the province's race that suit its
// terrain — its PROVINCE_ARMIES_P cell, never a unit from another terrain. A cell with only two land
// units (Human forest, Elven desert and mountain, Dwarven forest) always gives both.
// 2026-09-12: there were too many humanoid flyers in play. Half the provinces that would have
// offered one now offer another ground unit of the same cell instead, where the cell has one to
// spare; where it has none, the flyer stays (since item 15 nothing is borrowed from another terrain).
// The king's home province is untouched (fullRaceLandRoster always grants the complete racial roster).
export function provincePoolSize(rnd: (() => number) | null | undefined) {
  return (rnd ?? kcRng)() < 0.75 ? 2 : 3;
}
export const GEN_FLYER_TYPES = new Set(KC_UNIT_CLASS.flying);
export const FLYER_PROVINCE_KEEP = 0.5; // share of would-be flyer offers that survive
export function buildHumanoidPool(terrain: string, race: string, count: number, rnd: () => number) {
  // the cells read by any terrain's and race's name
  const cells: Readonly<Partial<Record<string, Readonly<Partial<Record<string, readonly string[]>>>>>> =
    PROVINCE_ARMIES_P;
  // (read in two steps: a race read on no cell reads the empty object's field, as it always did)
  const cell = cells[terrain] ?? {};
  const full = cell[race] ?? ['Shieldwall Levies'];
  const garrison = full.filter((t) => t.toLowerCase().includes('garrison'));
  const local = full.filter((t) => !t.toLowerCase().includes('garrison') && !SEA_TYPES_GEN.has(t));
  const shuffled = shuffleP(local, rnd);
  const types = shuffled.slice(0, count);
  // Ground units this province could offer instead of a flyer: only its own terrain's (item 15:
  // every unit offered suits the province). A cell with nothing to spare keeps its flyer.
  const localSpare = shuffled.slice(count).filter((t) => !GEN_FLYER_TYPES.has(t));
  // the flyers looked up by a pick that may be missing
  const flyers: ReadonlySet<string | undefined> = GEN_FLYER_TYPES;
  for (let i = 0; i < types.length; i++) {
    if (!flyers.has(types[i])) continue;
    if (rnd() < FLYER_PROVINCE_KEEP) continue; // this one keeps its flyers
    let sub: string | null = null;
    while (localSpare.length && !sub) {
      const t = localSpare.shift();
      // (the list was just found not empty, so t is one of its units)
      if (t !== undefined && !types.includes(t)) sub = t;
    }
    if (sub) types[i] = sub; // otherwise nothing to swap to — keep the flyer
  }
  return { types, garrison };
}
// A king's home province recruits EVERY land unit of his race — not just the roster of the home's
// own terrain. Union of the race's PROVINCE_ARMIES_P cells across all land terrains, non-garrison
// types first (in table order), the racial garrison last. Fleets are never added here: a coastal
// home earns its racial fleet through the coastal / Naval-skill rules.
export function fullRaceLandRoster(race: string) {
  // the cells read by any terrain's and race's name
  const cells: Readonly<Partial<Record<string, Readonly<Partial<Record<string, readonly string[]>>>>>> =
    PROVINCE_ARMIES_P;
  const seen = new Set<string>(),
    types: string[] = [],
    garrison: string[] = [];
  LAND_TERRAINS_GEN.forEach((t) => {
    const cell = cells[t] ?? {};
    (cell[race] ?? []).forEach((u) => {
      if (seen.has(u) || SEA_TYPES_GEN.has(u)) return;
      seen.add(u);
      (u.toLowerCase().includes('garrison') ? garrison : types).push(u);
    });
  });
  return [...types, ...garrison];
}
// Existing saves: every king's home province recruits his race's FULL land roster. Idempotent -
// appends any missing land type to the home's armyTypes, keeping fleets and order. Runs at the top
// of every runTurn; a no-op once the roster is complete.
export function backfillHomeRosters(gs: TheStateAsTheBackfillReadsIt | null | undefined) {
  (gs?.players ?? []).forEach((pl, pi) => {
    if (!pl) return;
    const hid = homeProvinceIdFor(gs, pi);
    const h = hid != null ? (gs?.world?.provinces ?? [])[hid] : null;
    if (!h || h.terrain === 'sea' || !pl.race || h.race !== pl.race) return;
    if (!Array.isArray(h.armyTypes)) h.armyTypes = [];
    // the units it offers, the same list each push below fills
    const armyTypes = h.armyTypes;
    fullRaceLandRoster(pl.race).forEach((u) => {
      if (!armyTypes.includes(u)) armyTypes.push(u);
    });
    // 2026-09-25 (Toby): a coastal capital always offers its racial fleet — add it to any running
    // game whose home rolled without one.
    const fleet = HOME_FLEET_BY_RACE[pl.race];
    if (fleet && !h.armyTypes.includes(fleet) && typeof discProvCoastal === 'function' && discProvCoastal(gs, h))
      h.armyTypes.push(fleet);
  });
}
// ── WORLD-GEN TUNING ── Share of LAND provinces that are Primal (wild Creature / Monster country).
// The remainder is split exactly equally between the four humanoid races.
export const PRIMAL_LAND_CHANCE = 0.3;
// Share of coastal HUMANOID provinces that also offer their race's naval unit, on top of their 2-3
// land types and their garrison. Primal and raceless coasts never offer one.
export const COASTAL_NAVAL_CHANCE = 0.8;
// Recruitable naval/fleet unit types (used during map generation, e.g. to keep them out of a king's
// starting land armies). Mirrors SEA_TYPES used in the resolution engine. 2026-09-17: a humanoid
// shipyard province turns out TWO hulls a season, not one. Every province offering one of these
// five types raises its per-turn recruit cap for that type from 1 to 2, the same allowance
// garrisons have had. Fleets are the slowest thing in the game to accumulate (one race, one hull
// type, only on a coast) and a navy was taking twice as long to build as an army. Read through
// twoATurn below.
export const HUMANOID_FLEET_TYPES = new Set([
  'Galleon Fleet',
  'Corsair Fleet',
  'Elven Galleys',
  'Dwarf Ironclads',
  'Orcish Longships',
]);
// The types a province raises TWO of in a turn: garrison units, the humanoid fleets, and — 2026-10-11
// (Toby, the army roster, decision 9) — the Goblin Horde wherever it is offered (the horde's numbers are
// its point). Everything else is one a turn outside the founder's own capital, which turns out two of
// anything. Read by getRecruitLimit (the engine's gate) and by the order form's `maxPerTurn` payload
// (buildTurnReport); tests/goblins-two-a-turn holds the two together.
export function twoATurn(armyType: string | null | undefined) {
  const t = armyType ?? '';
  return t.toLowerCase().includes('garrison') || HUMANOID_FLEET_TYPES.has(t) || t === 'Goblin Horde';
}
export const SEA_TYPES_GEN = new Set(KC_UNIT_CLASS.sea);

// Returns the effective quality after druid shortfall penalty shortfall of N = -N quality tiers
// (each missing level = 20% str penalty)
// ── BEAST COMMAND (2026-10-12, Toby item 24) ── A hero may lead only as many Creature and Monster units as his Druid
// level. Which units count is countsAgainstBeastCommand's (engine/rules-on-plain-values/, which the player portal
// shares), on a unit as its realm sees it: the engine hands it its own unit in the realm's names.
export function beastCommandCount(a: AUnitAsTheBeastCommandCountsIt | null | undefined) {
  return !!a && countsAgainstBeastCommand(unitAsItsRealmSeesIt(a));
}
export function beastsLed(c: AHeroAsTheBeastCommandReadsHim | null | undefined) {
  return (c?.armies ?? []).filter(beastCommandCount).length;
}
export function beastCommandRoom(
  c: AHeroAsTheBeastCommandReadsHim | null | undefined,
  chars: TheHeroesAsASkillIsReadBesideThem,
) {
  if (c?.player == null) return Infinity;
  return Math.max(0, (Number(effSkillOf(c, 'druid', chars ?? [])) | 0) - beastsLed(c));
}
// A commander's beast command, as a line tells it (plan P1-12d6): his name and his Druid as it counts, copied as the
// line is told. The Recruit and Hire orders' and the army orders' facts hold it, and the views write its words
// (theWordsOfABeastCommand, src/views/prose/the-words-of-the-army-orders-lines.ts, since P1-12d7: the army orders were
// its words' last engine callers).
/** A commander's beast command, as a line tells it: his name, and the Druid level that is the most beasts he leads. */
export interface ABeastCommandAsALineTellsIt {
  readonly commanderName: string;
  readonly druid: number;
}
export function theBeastCommandAsALineTellsIt(
  c: AHeroAsHisSkillIsRead & { readonly name: string },
  chars: TheHeroesAsASkillIsReadBesideThem,
): ABeastCommandAsALineTellsIt {
  return { commanderName: c.name, druid: Number(effSkillOf(c, 'druid', chars ?? [])) | 0 };
}
export function druIdPenaltyMult(
  heroChar: ACommanderAsTheDruidCheckReadsHim,
  army: AUnitAsTheDruidCheckReadsIt,
  playerAlignment: string | null | undefined,
  tamed: boolean,
) {
  // Skeletal armies never suffer Druid penalties — they are already dead
  if (army._isSkeletal) return 1.0;
  // Neutral guard heroes natively command their province's armies — no Druid penalty (no commander at all throws
  // here, as it did on his race's read below)
  if (heroChar._isNeutralGuard) return 1.0;
  const armyType = army.type;
  const heroRace = heroChar.race;

  const armyRace = army.race;
  // ── SAME-RACE RULE ── (druidALeaderBringsToAUnit, engine/rules-on-plain-values/) a commander leads troops of his
  // OWN race as if he had at least Druid 1. A unit's race is the race of the province it was raised in.
  const sameRace = !!(armyRace && armyRace === heroRace);

  // The waivers (druidLevelALeaderNeeds): a Druidic realm's Creatures, an Evil realm's Monsters (or a personally
  // Druidic or Evil commander's), and sd40 Dragon Taming's winged beasts. The realm alignment is the caller's
  // (druIdPenaltyMult is module-level; every combat call site passes it); so is `tamed`: the caller (inside runTurn,
  // where G is visible) passes tamed=true when the commander's realm holds the discovery and the army is a winged beast.
  const required = druidLevelALeaderNeeds(armyType, playerAlignment, heroChar.alignment, tamed);
  if (required === 0) return 1.0;

  // Psychic Blast (battle magic): this commander's Druid skill has been negated for the battle.
  let rawDruid = heroChar._druidNegated
    ? 0
    : Math.max(
        0,
        Math.min(
          5,
          (Number(heroChar.skills?.druid) || 0) +
            dedupeItemsByName(activeItems(heroChar)).reduce(
              (s, it) => s + (it.effect?.stat === 'druid' ? Number(it.effect.bonus) : 0),
              0,
            ),
        ),
      );
  // Curse (battle magic): if Druid is the commander's cursed ability, it is halved for the battle.
  if (heroChar._curseHalveStat === 'druid') rawDruid = Math.floor(rawDruid / 2);
  // Same-race troops are led as if the commander had at least Druid 1 for that race
  // (but a negated commander loses even that — their bond is severed).
  const herodruid = druidALeaderBringsToAUnit(rawDruid, sameRace && !heroChar._druidNegated);
  const shortfall = druidShortfall(required, herodruid);
  return strengthLeftByADruidShortfall(shortfall);
}
export const TEMPERS_P = KC_TEMPERS.slice();
/** A temper's traits as the fights read them: a row of TEMPER_TRAITS, its rage the [min, max] extra hit points the
 *  table's notes give it, or null (no row has one today). temperOf's return type, written for its typed callers
 *  (plan P1-10b11), so it is checked once this file is freed. */
type TheTraitsOfATemper = Omit<(typeof TEMPER_TRAITS)['Brave'], 'rageHp'> & {
  readonly rageHp: readonly [min: number, max: number] | null;
};
export function temperOf(t: string | null | undefined): TheTraitsOfATemper {
  // the rows read by any temper's name
  const rows: Readonly<Partial<Record<string, TheTraitsOfATemper>>> = TEMPER_TRAITS;
  return rows[String(t)] ?? TEMPER_TRAITS.Brave;
}
// A feature's steal-able treasure as a plain number. Tolerates the legacy {gold:n} shape that
// pre-v1054 sea features saved, so old games don't throw when a thief lifts from them.
export function featureTreasure(f: { readonly treasure?: AFeaturesTreasure } | null | undefined) {
  if (!f) return 0;
  const t = f.treasure;
  if (t == null) return 0;
  if (typeof t === 'object') return Math.max(0, Number(t.gold) || 0);
  return Math.max(0, t || 0);
}
export function setFeatureTreasure(f: { treasure?: AFeaturesTreasure } | null | undefined, v: number) {
  v = Math.max(0, Math.round(v));
  if (f && typeof f.treasure === 'object' && f.treasure) f.treasure.gold = v;
  else if (f) f.treasure = v;
}
// the gold a hero collects for CLEARING a feature guardian is a tier-band roll. We roll it ONCE and
// cache it on the feature, so a Scout can report the EXACT figure a clearer will receive and the
// victory branch pays out that same amount (rolled here if the site was never scouted).
export const ENCOUNTER_CLEAR_GOLD_BANDS = {
  Weak: [5, 8],
  Moderate: [12, 18],
  Powerful: [20, 30],
  Legendary: [40, 60],
} satisfies Record<string, readonly [min: number, max: number]>; // was 5–12 / 14–28 / 30–50 / 55–90
export function encounterClearGold(feat: ALairAsItsHoardIsStocked | null | undefined): number {
  if (!feat) return 0;
  if (feat._hoardV2) return featureTreasure(feat); // the one hoard figure
  if (feat._clearGold == null) {
    // the bands read by any power's name
    const bands: Readonly<Partial<Record<string, readonly [min: number, max: number]>>> = ENCOUNTER_CLEAR_GOLD_BANDS;
    const band = bands[(feat.monster?.power ?? '') || 'Weak'] ?? [1, 5];
    feat._clearGold = Math.floor(kcRng() * (band[1] - band[0] + 1)) + band[0];
  }
  return feat._clearGold;
}
export function ensureLairHoard(
  f: ALairAsItsHoardIsStocked | null | undefined,
  gs: TheStateAsTheStockingReadsIt | null | undefined,
  opts?: { readonly noItems?: boolean | undefined },
): void {
  if (!f || f.ritualSite) return;
  const _noItems = !!opts?.noItems; // balanced stocking (ensureAllLairHoards) fills items itself
  // the hoard, the same list each push below fills
  const hoardItems = Array.isArray(f.hoardItems) ? f.hoardItems : [];
  f.hoardItems = hoardItems;
  if (Array.isArray(f.lairItems) && f.lairItems.length) {
    hoardItems.push(...f.lairItems);
    f.lairItems = [];
  }
  if (f._hoardV2) return;
  f._hoardV2 = true;
  const power = (f.monster?.power ?? '') || 'Weak';
  // the bands and the odds read by any power's name
  const bands: Readonly<Partial<Record<string, readonly [min: number, max: number]>>> = ENCOUNTER_CLEAR_GOLD_BANDS;
  const odds: Readonly<Partial<Record<string, (typeof LAIR_ITEM_ODDS)['Weak']>>> = LAIR_ITEM_ODDS;
  const band = bands[power] ?? [1, 5];
  const gold = f._clearGold ?? Math.floor(kcRng() * (band[1] - band[0] + 1)) + band[0];
  delete f._clearGold;
  setFeatureTreasure(f, gold);
  // Thief revision: remember the hoard as it stood at generation — a thief's cut is a share of the
  // ORIGINAL pile, so each successive theft takes a like amount until it runs dry.
  f._hoardGoldOrig ??= gold;
  if (f.cleared || !gs || _noItems) return;
  if (!Array.isArray(gs._awardedItems)) gs._awardedItems = [];
  // the names handed out, the same list each roll below adds to
  const awarded = gs._awardedItems;
  const taken = new Set(awarded);
  const takenEff = awardedEffectSet(gs);
  const T = odds[power] ?? LAIR_ITEM_ODDS.Weak;
  const roll = () => {
    const base = rollMagicItem(power, taken, takenEff);
    if (!base) return;
    taken.add(base.name);
    takenEff.add(itemEffectKey(base));
    awarded.push(base.name);
    const id = Number(gs.nextItemId) || 0;
    gs.nextItemId = id + 1;
    const item = { ...base, effect: { ...base.effect }, id };
    hoardItems.push(item);
  };
  if (kcRng() < T.itemChance) roll();
  if (kcRng() < T.bonusItem) roll();
  if (kcRng() < (T.thirdItem || 0)) roll();
}
