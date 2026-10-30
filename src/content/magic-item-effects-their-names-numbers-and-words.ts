// The magic items' effects the rule registry holds (plan P1-19's items family, Decision 3): one row per effect, keyed
// by its slug, with the key a held copy of an item carries it by, the numbers the code writes for it (each with how the
// item's texts write it) and the units it reaches. The items' registry (src/engine/rules/the-registry-of-magic-item-
// effects.ts) has one entry for each row and no other: a row with no entry, or an entry with no row, fails to compile.
//
// A saved item is a whole copy (its name, texts and `effect`), and the registry reads each copy's own key and base name,
// never content's copy of the item (Decision 2; docs/traps.md, "Live saves keep copies"): a row holds only what the
// code wrote inline before the registry took it, so an old save's copy works as it did. Change a number here, and the
// texts of every item that carries it: tests/unit/each-magic-item-states-the-numbers-its-effect-has.test.ts reads every
// row against the desc and lore of each item in play that carries it.
import { KC_UNIT_CLASS, type UnitType } from './kingdoms-call-data.ts';

/** How an item's texts write a number: a multiplier as the share it adds (×1.25 as `+25%`); strength added as `+2`; a
 *  share in words (0.5 as "half", or "halved"); volleys in words (2 as "two volleys"); extra shots in words (1 as "one
 *  extra shot"); a share as a percentage (0.1 as `10%`); gold for each province (1 as `+1g`, `+1 gold` or "1 extra
 *  gold"); skill levels added (1 as `+1`, or "one level"); damage turned aside (1 as "1 less"); a chance in
 *  percentage points (5 as `5%`); a multiplier in words (2 as "doubled"); damage added (2 as `+2 damage`, or "2 extra
 *  damage"); how many of the strongest enemy units a battle spell strikes, in words (2 as "two strongest"); rounds added,
 *  in words (1 as "an extra round"); a multiplier as the share more (×1.1 as `10% more`). */
export type HowAnItemsTextsWriteANumber =
  | 'a multiplier, as the share it adds'
  | 'strength added'
  | 'a share, in words'
  | 'volleys, in words'
  | 'extra shots, in words'
  | 'a share, as a percentage'
  | 'gold, for each province'
  | 'skill levels added'
  | 'damage turned aside'
  | 'a chance, in percentage points'
  | 'a multiplier, in words'
  | 'damage added'
  | 'the strongest units, in words'
  | 'rounds added, in words'
  | 'a multiplier, as the share more';

/** One number of an item's effect, and how the item's texts write it. */
export interface ANumberOfAnItemsEffect {
  readonly value: number;
  readonly theTextsWriteIt: HowAnItemsTextsWriteANumber;
}

/** The effects a held copy carries on the item itself, beside its `effect` (Parked: one key per effect, later). */
export type AnItemsOwnField = 'fleetStr' | 'landFullAtSea' | 'exploreMove' | 'emberTwo' | 'primalStrike';

/** The riders a held copy carries for personal combat (its `effect.pc`), beside a ward: each carried when above 0. */
export type ARiderAnItemCarries = 'aura' | 'burn' | 'drain' | 'hitBonus' | 'dmgBonus';

/** A field of a combat item's effect that carries an effect of its own, beside its use: the kinds of foe its blows
 *  strike twice as hard (`doubleVs`). */
export type AFieldOfACombatItemsEffect = 'doubleVs';

/** The `effect.stat` of a combat item: a potion, scroll or device carried into a personal combat, used once a fight
 *  (its `effect.use` says how), which a hero brings from his active items and a guardian from the hoard it wields. */
export const THE_STAT_OF_A_COMBAT_ITEM = 'combatUse';

/** The `effect.stat` of an item worn as armour: its effect is a ward (`effect.ward`, with its amount, percentage or
 *  hits), which personal combat merges into the wards its bearer wears. */
export const THE_STAT_OF_AN_ITEM_WORN_AS_ARMOUR = 'armour';

/** The key a held copy of an item carries an effect by: its `effect.stat`, a field of the item's own (true when set),
 *  the item's base name (a second name of a tier-1 or tier-2 item counts as its base's, as hasItemBase reads it), a
 *  ward (its armour's `effect.ward`, or its rider's `effect.pc.ward`: a guardian's perk of the same ward reaches the
 *  same effect), a rider (its `effect.pc`'s, above 0), a combat item's use (its `effect.use`), or a field of a combat
 *  item's effect (true when set). */
export type TheKeyAnItemCarriesItsEffectBy =
  | { readonly stat: string }
  | { readonly field: AnItemsOwnField }
  | { readonly itemName: string }
  | { readonly ward: string }
  | { readonly rider: ARiderAnItemCarries }
  | { readonly use: string }
  | { readonly effectField: AFieldOfACombatItemsEffect };

/** A row: what the registry's effect and the items' texts read of one effect. */
export interface AMagicItemEffectAsItsTextsWriteIt {
  /** The item the code named it by, before the registry took it (the first of the items that carry it). */
  readonly name: string;
  /** The key a held copy carries it by. */
  readonly carriedAs: TheKeyAnItemCarriesItsEffectBy;
  /** Its numbers, by what each is for (none where the effect is a waiver or a step up a tier). */
  readonly numbers: Readonly<Record<string, ANumberOfAnItemsEffect>>;
  /** The units it reaches, when not every unit the bearer leads: the units named (a class of the data file is a list
   *  of strings: the registry's unit test checks that each is a unit type), or the skeletal units (a mark the raising
   *  writes on the unit, not a type). */
  readonly reaches?: readonly string[] | 'the skeletal units';
  /** The realm's alignment it needs, when it acts for one realm only. */
  readonly forARealmThatIs?: string;
  /** The numbers the code takes when a held copy carries none of its own (no item's texts state them: each item in play
   *  carries its own). */
  readonly theNumbersOfACopyThatCarriesNone?: Readonly<Record<string, number>>;
  /** The numbers by which a fighter judges when to reach for a combat item (his judgement, not the item's power: no
   *  item's texts state them). */
  readonly theNumbersAFighterWeighsItBy?: Readonly<Record<string, number>>;
  /** The numbers by which the treasury weighs what an item carrying it is worth (an item's worth sets its tier, so the
   *  lairs that hold it, and a bot's choice of what to carry: no item's texts state them). */
  readonly theWorthOfItInTheTreasury?: Readonly<Record<string, number>>;
}

// The cavalry, infantry, archers and heavy engines the commander's items reach (until P1-19m armStr's CAV_I, INF_I,
// ARCH_I and HEAVY_I). Each item's texts name fewer (plan NEXT.md question 21: Parked "Thirty items' texts name fewer
// units, or another rule, than the battle gives"); these are what the battle gives.
const THE_CAVALRY_THE_LANCERS_ITEMS_REACH: readonly UnitType[] = [
  'Free Lances',
  'Gilded Lances',
  'Warg Riders',
  'Eagle Riders',
  'Noble Griffons',
  'Stag Riders',
  'Ironhoof Rams',
];
const THE_INFANTRY_THE_LEGIONS_ITEMS_REACH: readonly UnitType[] = [
  'Shieldwall Levies',
  'Dwarven Guard',
  'Orc Berserkers',
  'Men-at-Arms',
];
const THE_ARCHERS_THE_BOWMANS_ITEMS_REACH: readonly UnitType[] = [
  'Yeoman Longbows',
  'Elven Bowmen',
  'Shadow Archers',
  'Ironwood Crossbows',
  'Black Arrows',
];
const THE_HEAVY_ENGINES_THE_ENGINEERS_ITEMS_REACH: readonly UnitType[] = ['Mountain Guns', 'Dwarf Ironclads'];

// What the treasury weighs a ward at (an item's worth, plan P1-19t): an amount at so much a point; a percentage at a
// point for so many percentage points; a flag at its own worth, and a percentage it carries beside at a point for so
// many percentage points.
const THE_WORTH_OF_A_WARD_OF_AN_AMOUNT = { aPointIsWorth: 1.2 } as const;
const THE_WORTH_OF_A_WARD_OF_A_PERCENTAGE = { percentagePointsForAPoint: 7 } as const;
const THE_PERCENTAGE_POINTS_A_FLAG_WARD_CARRIES_FOR_A_POINT = 10;
// What the treasury weighs a combat item's blows at: its damage, its lingering harm, a round stunned and a penalty to
// hit, and what striking a foe of its kinds alone takes off (the plain blow's 0).
const THE_WORTH_OF_A_BLOW = {
  damageForAPoint: 3,
  lingeringHarmForAPoint: 2,
  aRoundStunnedIsWorth: 2,
  toHitPenaltyForAPoint: 6,
} as const;

/** The magic items' effects the registry holds, in the order the battle code meets them: the commander's items on
 *  each unit he leads, then his items at sea (plan P1-19m); the commanders' items at the defenders' fortifications, at
 *  the volley and in the rout (plan P1-19n); then a hero's items in the realm's tax at the turn's end, and in his orders
 *  (plan P1-19o); then a hero's items in his own standing: his maximum hit points, his temper and his skills (plan
 *  P1-19p); then what a fighter wears in personal combat: his wards, his riders and the Mithril suit (plan P1-19q),
 *  with the numbers the fight wrote for what each does (plan P1-19r); then the combat items a fighter carries into it,
 *  the Lock-Pick's steal and the Warbringer Gauntlets' blow (plan P1-19s); then the kinds of item the treasury weighs as
 *  a whole (plan P1-19t). */
export const MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS = {
  // ── The commander's items (strength, in armStr: after the unit's own modifiers, before its factors from its force),
  // each step rounded as it goes. ──
  // Every army the bearer leads fights +2, whatever the item's own bonus: the two relic standards say +4 and +6 and give
  // +2 too (plan NEXT.md question 20; Parked "The two relic standards give +2, not their +4 and +6").
  'army-bonus': {
    name: 'Battle Standard',
    carriedAs: { stat: 'armyBonus' },
    numbers: { strengthAdded: { value: 2, theTextsWriteIt: 'strength added' } },
  },
  'cavalry-bonus': {
    name: 'Golden Spur',
    carriedAs: { stat: 'cavBonus' },
    numbers: { multiplier: { value: 1.25, theTextsWriteIt: 'a multiplier, as the share it adds' } },
    reaches: THE_CAVALRY_THE_LANCERS_ITEMS_REACH,
  },
  'infantry-bonus': {
    name: "Legionnaire's Mark",
    carriedAs: { stat: 'infBonus' },
    numbers: { multiplier: { value: 1.2, theTextsWriteIt: 'a multiplier, as the share it adds' } },
    reaches: THE_INFANTRY_THE_LEGIONS_ITEMS_REACH,
  },
  'archer-bonus': {
    name: 'Eagle-Eye Pendant',
    carriedAs: { stat: 'archerStr' },
    numbers: { multiplier: { value: 1.3, theTextsWriteIt: 'a multiplier, as the share it adds' } },
    reaches: THE_ARCHERS_THE_BOWMANS_ITEMS_REACH,
  },
  'heavy-bonus': {
    name: "Engineer's Blueprint",
    carriedAs: { stat: 'heavyBonus' },
    numbers: { strengthAdded: { value: 4, theTextsWriteIt: 'strength added' } },
    reaches: THE_HEAVY_ENGINES_THE_ENGINEERS_ITEMS_REACH,
  },
  // The fleets the bearer leads fight one quality tier higher (none past Elite). No item in play carries it now: the
  // relic's copy in play carries `fleetQuality`, which nothing reads (Parked); an older save's copy still may.
  'naval-bonus': {
    name: 'Kraken Figurehead',
    carriedAs: { stat: 'navalBonus' },
    numbers: {},
    reaches: KC_UNIT_CLASS.carrier,
  },
  'fleet-strength': {
    name: 'Sea Chart of the Deep',
    carriedAs: { field: 'fleetStr' },
    numbers: { strengthAdded: { value: 1, theTextsWriteIt: 'strength added' } },
    reaches: KC_UNIT_CLASS.carrier,
  },
  'admirals-spyglass': {
    name: "Admiral's Spyglass",
    carriedAs: { itemName: "Admiral's Spyglass" },
    numbers: { strengthAdded: { value: 2, theTextsWriteIt: 'strength added' } },
    reaches: KC_UNIT_CLASS.carrier,
  },
  'chalice-of-dawn': {
    name: 'Chalice of Dawn',
    carriedAs: { itemName: 'Chalice of Dawn' },
    numbers: { multiplier: { value: 1.15, theTextsWriteIt: 'a multiplier, as the share it adds' } },
    forARealmThatIs: 'Divine',
  },
  'undead-bonus': {
    name: 'Black Sceptre',
    carriedAs: { stat: 'undeadBonus' },
    numbers: { strengthAdded: { value: 4, theTextsWriteIt: 'strength added' } },
    reaches: 'the skeletal units',
  },
  // ── A hero's items and his battle spell (strength, before an army battle, where his Fireball is cast: plan P1-19u) ──
  // The bearer's Fireball strikes the two strongest enemy units instead of one.
  'fireball-strikes-two': {
    name: 'Ember Rune',
    carriedAs: { field: 'emberTwo' },
    numbers: { theStrongestUnitsStruck: { value: 2, theTextsWriteIt: 'the strongest units, in words' } },
  },
  // ── A commander's items and his units' strikes (strength, before an army battle, where each unit's strike rolls its
  // chance: plan P1-19v) ──
  // The pre-battle strikes of the units he leads fire more often, by the copy's own bonus (in percentage points).
  'strike-chance-bonus': { name: 'Totem of the Thunderhead', carriedAs: { stat: 'primalStrike' }, numbers: {} },
  // The same, by a field of the copy's own (an item that carries another effect too: the Druid's, beside it).
  'strike-chance-field': { name: "Beastcaller's Warhorn", carriedAs: { field: 'primalStrike' }, numbers: {} },
  // ── The commander's items at sea (strength, in armStr, where the sea's penalty would cut a land unit he leads):
  // the penalty is waived, as for a commander of Naval's eighth level. ──
  'land-units-at-full-strength-at-sea': {
    name: "Tide-Caller's Horn",
    carriedAs: { field: 'landFullAtSea' },
    numbers: {},
  },
  // ── The commanders' items at the defenders' fortifications (strength, in both battles, after the province's and the
  // realm's own bonuses), in this order: the defender's, then the attacker's (the siege halves what home defence
  // added). ──
  // The defenders' position fights ×1.25 when they defend their founding home and the bearer leads them. Its items'
  // texts say "+1 quality tier" or "+1 level", and some "your own provinces" (plan NEXT.md question 22; Parked "The
  // home-defence items say a quality tier in any province of one's own; the battle gives ×1.25 at the home alone").
  'home-defence-bonus': {
    name: 'Banner of the Realm',
    carriedAs: { stat: 'homeDefBonus' },
    numbers: { multiplier: { value: 1.25, theTextsWriteIt: 'a multiplier, as the share it adds' } },
  },
  // The defenders' fortifications, beyond the bare ×1, are halved when the bearer attacks. Five of its items say "Siege
  // bonus +1" (plan NEXT.md question 21).
  'siege-bonus': {
    name: "Siege Master's Ring",
    carriedAs: { stat: 'siegeBonus' },
    numbers: { theShareOfTheFortificationsLeft: { value: 0.5, theTextsWriteIt: 'a share, in words' } },
  },
  // ── The commander's items at the volley before the battle (volley, in both battles), in this order. ──
  'quiver-of-the-hawk': {
    name: 'Quiver of the Hawk',
    carriedAs: { itemName: 'Quiver of the Hawk' },
    numbers: { volleys: { value: 2, theTextsWriteIt: 'volleys, in words' } },
  },
  'quiver-of-many-arrows': {
    name: 'Quiver of Many Arrows',
    carriedAs: { itemName: 'Quiver of Many Arrows' },
    numbers: { extraShots: { value: 1, theTextsWriteIt: 'extra shots, in words' } },
  },
  // ── The commander's items in the rout (fate). ──
  // The Free Lances he leads ride the beaten down on any ground (Ride Them Down's share is the unit ability's).
  'war-horn-of-the-plains': {
    name: 'War-Horn of the Plains',
    carriedAs: { itemName: 'War-Horn of the Plains' },
    numbers: {},
  },
  // The force he leads never retreats from a lost battle against neutral guards: it stands. Its items' texts say
  // "Shieldwall Levies" or "Infantry"; between heroes it does nothing (plan NEXT.md question 23; Parked "The
  // Shield-Wall Rune holds only against neutral guards, and for the whole force").
  'shield-wall-rune': {
    name: 'Shield-Wall Rune',
    carriedAs: { stat: 'infStay' },
    numbers: {},
  },
  // ── A hero's items in the realm's tax (turnEnd, in Early Winter): flat gold, then gold for each province the realm
  // holds; together capped by the realm's ceiling on bonus gold (capItemTaxGold, in src/engine/discoveries.ts). ──
  // Each copy adds its own `effect.bonus` in gold (the copy's number, not content's: no number here). Four of its items
  // say "Tax income +3%" and give 3 gold (plan NEXT.md question 24; Parked "Four tax items say +3% and give 3 gold").
  'tax-bonus': {
    name: 'Ring of Wealth',
    carriedAs: { stat: 'taxBonus' },
    numbers: {},
    theWorthOfItInTheTreasury: { aGoldIsWorth: 1.2 },
  },
  // The realm gains this much for each province it holds when any of its heroes carries one; two give no more.
  'tax-per-province': {
    name: "Merchant's Ledger",
    carriedAs: { stat: 'taxPerProv' },
    numbers: { goldForEachProvince: { value: 1, theTextsWriteIt: 'gold, for each province' } },
  },
  // ── A hero's items in his orders (orderOutcome), each in its order's resolver. ──
  // His Spy order succeeds without a roll. Only an older save's copy carries `oracle`: the relic a lair deals today
  // carries `spyAuto`, which nothing reads (Parked "Three more relics never work").
  'crystal-orb': {
    name: 'Crystal Orb',
    carriedAs: { stat: 'oracle' },
    numbers: {},
  },
  // His Explore order reveals one more lair of the province the map hasn't reached (the order draws which).
  'philosophers-lens': {
    name: "Philosopher's Lens",
    carriedAs: { itemName: "Philosopher's Lens" },
    numbers: {},
  },
  // His Rest order heals a tenth of his maximum hit points more, rounded; two heal no more.
  'iron-heart-talisman': {
    name: 'Iron Heart Talisman',
    carriedAs: { itemName: 'Iron Heart Talisman' },
    numbers: { theShareOfMaximumHpHealed: { value: 0.1, theTextsWriteIt: 'a share, as a percentage' } },
  },
  // Each move into a province explores more of it: the copy's own `exploreMove` (20 on every item in play; the copy's
  // number, not content's: no number here). Two add both.
  'travellers-cloak': {
    name: "Traveller's Cloak",
    carriedAs: { field: 'exploreMove' },
    numbers: {},
  },
  // Used (a Use Item order, and the bots' plan), every unit of his realm, led or in a garrison, rises a quality tier
  // (from the tables: no number here). Only an older save's copy carries `massPromote`: the relic a lair deals today
  // carries `promoteAll`, which nothing reads (Parked "A Philosopher's Stone can never be worked").
  'philosophers-stone': {
    name: "Philosopher's Stone",
    carriedAs: { stat: 'massPromote' },
    numbers: {},
  },
  // ── A hero's standing (aHerosStanding): his maximum hit points, the temper he fights with, and his skills. ──
  // His maximum hit points rise by each copy's own `effect.bonus` (the copy's number, not content's: no number here); two
  // copies of one name count once.
  'maximum-hp': {
    name: 'Amulet of Fortitude',
    carriedAs: { stat: 'maxHp' },
    numbers: {},
    theWorthOfItInTheTreasury: { aHitPointIsWorth: 0.7 },
  },
  // He fights with the copy's own `effect.temper` in personal combat, over his own (the copy's word: no number here); the
  // first of his items that carries one.
  temper: {
    name: 'Warmask of the Red Rage',
    carriedAs: { stat: 'temper' },
    numbers: {},
    theWorthOfItInTheTreasury: { worth: 3 },
  },
  // Every hero of the bearer's realm in his province, the bearer too, has this many levels more in every skill, whatever
  // the copy's own bonus (one bearer counts: two give no more). The skill's ceiling caps it, as it caps every bonus.
  'crown-of-command': {
    name: 'Crown of Command',
    carriedAs: { stat: 'aura' },
    numbers: { theLevelsItAddsToEverySkill: { value: 1, theTextsWriteIt: 'skill levels added' } },
  },
  // ── What a fighter wears in personal combat (personalCombat): the wards of his armour and of his items' riders, merged
  // into one table (pcArmourMerge: an amount adds, a percentage takes the best, a flag is set), and his items' other
  // riders (pcApplyFx). A guardian's perk of the same ward or rider reaches the same effect. Each copy carries its own
  // amount, percentage or hits (the copy's number, not content's: no number here), but where a row says. What each
  // ward does in a fight (pcTakeHit, pcRoundStart, the chance to hit, the blow, a stun, a spell's burn: plan P1-19r)
  // reads the same copy's numbers, and here the ones the code wrote itself. ──
  'melee-damage-turned-aside': {
    name: 'Dwarf-Forged Hauberk',
    carriedAs: { ward: 'meleeDR' },
    numbers: {},
    theWorthOfItInTheTreasury: THE_WORTH_OF_A_WARD_OF_AN_AMOUNT,
  },
  'arrow-damage-turned-aside': {
    name: 'Arrow-Turning Brigandine',
    carriedAs: { ward: 'arrowDR' },
    numbers: {},
    theWorthOfItInTheTreasury: THE_WORTH_OF_A_WARD_OF_AN_AMOUNT,
  },
  // against a beast, vermin or a dragon
  'nature-damage-turned-aside': {
    name: 'Serpent-Scale Coat',
    carriedAs: { ward: 'natureDR' },
    numbers: {},
    theWorthOfItInTheTreasury: THE_WORTH_OF_A_WARD_OF_AN_AMOUNT,
  },
  // against the undead or a fiend
  'dark-damage-turned-aside': {
    name: 'Grave-Iron Plate',
    carriedAs: { ward: 'darkDR' },
    numbers: {},
    theWorthOfItInTheTreasury: THE_WORTH_OF_A_WARD_OF_AN_AMOUNT,
  },
  thorns: {
    name: 'Thornwood Cuirass',
    carriedAs: { ward: 'thorns' },
    numbers: {},
    theWorthOfItInTheTreasury: THE_WORTH_OF_A_WARD_OF_AN_AMOUNT,
  },
  regeneration: {
    name: 'Troll-Hide Jerkin',
    carriedAs: { ward: 'regen' },
    numbers: {},
    theWorthOfItInTheTreasury: THE_WORTH_OF_A_WARD_OF_AN_AMOUNT,
  },
  'spell-damage-cut': {
    name: 'Spellwarded Robe',
    carriedAs: { ward: 'spellPct' },
    numbers: {},
    theWorthOfItInTheTreasury: THE_WORTH_OF_A_WARD_OF_A_PERCENTAGE,
  },
  dodge: {
    name: 'Quicksilver Mail',
    carriedAs: { ward: 'dodge' },
    numbers: {},
    theWorthOfItInTheTreasury: THE_WORTH_OF_A_WARD_OF_A_PERCENTAGE,
  },
  block: {
    name: 'Tower Shield of the Wall',
    carriedAs: { ward: 'block' },
    numbers: {},
    theWorthOfItInTheTreasury: THE_WORTH_OF_A_WARD_OF_A_PERCENTAGE,
  },
  'a-hits-damage-capped': {
    name: 'Bulwark Breastplate',
    carriedAs: { ward: 'cap' },
    numbers: {},
    theWorthOfItInTheTreasury: THE_WORTH_OF_A_WARD_OF_A_PERCENTAGE,
  },
  // Once a fight, the first time a hit leaves him below this share of his maximum HP, he recovers the copy's share.
  'second-wind': {
    name: 'Last-Stand Plate',
    carriedAs: { ward: 'secondWind' },
    numbers: { belowThisShareOfHisMaximumHp: { value: 0.3, theTextsWriteIt: 'a share, as a percentage' } },
    theWorthOfItInTheTreasury: {
      worth: 4,
      percentagePointsForAPoint: THE_PERCENTAGE_POINTS_A_FLAG_WARD_CARRIES_FOR_A_POINT,
    },
  },
  // While he is below this share of his maximum HP, every hit on him deals the copy's share less.
  'damage-cut-at-low-hp': {
    name: "Warden's Scale",
    carriedAs: { ward: 'lowHp' },
    numbers: { belowThisShareOfHisMaximumHp: { value: 0.5, theTextsWriteIt: 'a share, in words' } },
    theWorthOfItInTheTreasury: THE_WORTH_OF_A_WARD_OF_A_PERCENTAGE,
  },
  'the-first-hit-drunk': {
    name: 'Blood-Bound Cuirass',
    carriedAs: { ward: 'firstHit' },
    numbers: {},
    theWorthOfItInTheTreasury: {
      worth: 2.5,
      percentagePointsForAPoint: THE_PERCENTAGE_POINTS_A_FLAG_WARD_CARRIES_FOR_A_POINT,
    },
  },
  'lingering-harm-turned-aside': {
    name: 'Ashen Plate',
    carriedAs: { ward: 'dotImmune' },
    numbers: {},
    theWorthOfItInTheTreasury: {
      worth: 3,
      percentagePointsForAPoint: THE_PERCENTAGE_POINTS_A_FLAG_WARD_CARRIES_FOR_A_POINT,
    },
  },
  // A to-hit penalty fades twice as fast, and a daze is shrugged off at the start of a round on this chance. No item in
  // play carries it: the engine's load-time pass rewrites its one item.
  resist: {
    name: 'Steadfast Harness',
    carriedAs: { ward: 'resist' },
    numbers: { theChanceToShrugOffADaze: { value: 0.5, theTextsWriteIt: 'a share, in words' } },
    theWorthOfItInTheTreasury: THE_WORTH_OF_A_WARD_OF_A_PERCENTAGE,
  },
  'arrow-block': {
    name: 'Kite Shield of the Marches',
    carriedAs: { ward: 'arrowBlock' },
    numbers: {},
    theWorthOfItInTheTreasury: THE_WORTH_OF_A_WARD_OF_A_PERCENTAGE,
  },
  // Melee blows deal 1 less, and foes have 5% less chance to hit (the best dodge worn): whatever the copy carries.
  buckler: {
    name: 'Bronze Buckler',
    carriedAs: { ward: 'buckler' },
    numbers: {
      meleeDamageTurnedAside: { value: 1, theTextsWriteIt: 'damage turned aside' },
      dodge: { value: 5, theTextsWriteIt: 'a chance, in percentage points' },
    },
    theWorthOfItInTheTreasury: {
      worth: 2.5,
      percentagePointsForAPoint: THE_PERCENTAGE_POINTS_A_FLAG_WARD_CARRIES_FOR_A_POINT,
    },
  },
  // The first hits of a fight to land deal a share less: the copy's own hits and percentage (every item in play
  // carries both), or these.
  'open-guard': {
    name: 'Oaken Roundshield',
    carriedAs: { ward: 'openGuard' },
    numbers: {},
    theNumbersOfACopyThatCarriesNone: { hits: 2, pct: 50 },
    theWorthOfItInTheTreasury: THE_WORTH_OF_A_WARD_OF_A_PERCENTAGE,
  },
  'spell-block': {
    name: 'Mirror-Bright Shield',
    carriedAs: { ward: 'spellBlock' },
    numbers: {},
    theWorthOfItInTheTreasury: THE_WORTH_OF_A_WARD_OF_A_PERCENTAGE,
  },
  'round-ward': {
    name: 'Shield of the Ward-Saints',
    carriedAs: { ward: 'roundWard' },
    numbers: {},
    theWorthOfItInTheTreasury: THE_WORTH_OF_A_WARD_OF_AN_AMOUNT,
  },
  'stun-immunity': {
    name: 'Dragonbone Shield',
    carriedAs: { ward: 'stunImmune' },
    numbers: {},
    theWorthOfItInTheTreasury: {
      worth: 3,
      percentagePointsForAPoint: THE_PERCENTAGE_POINTS_A_FLAG_WARD_CARRIES_FOR_A_POINT,
    },
  },
  // His foes have less chance to hit him, the whole fight: the best of his counts.
  'aura-rider': {
    name: "Oathkeeper's Blade",
    carriedAs: { rider: 'aura' },
    numbers: {},
    theWorthOfItInTheTreasury: { pointsForAPoint: 4 },
  },
  // A foe at melee range takes this much each round: his add.
  'burn-rider': {
    name: 'Brand of the Salamander',
    carriedAs: { rider: 'burn' },
    numbers: {},
    theWorthOfItInTheTreasury: { aPointIsWorth: 1.5 },
  },
  // He heals a share of the melee damage he deals: the best of his counts.
  'drain-rider': {
    name: 'Grave-Cold Blade',
    carriedAs: { rider: 'drain' },
    numbers: {},
    theWorthOfItInTheTreasury: { aPointIsWorth: 5 },
  },
  // His chance to hit: his add.
  'hit-bonus-rider': {
    name: "Warden's Poleaxe",
    carriedAs: { rider: 'hitBonus' },
    numbers: {},
    theWorthOfItInTheTreasury: { pointsForAPoint: 4 },
  },
  // His blows' damage: his add.
  'damage-bonus-rider': {
    name: 'Kingsteel Longsword',
    carriedAs: { rider: 'dmgBonus' },
    numbers: {},
    theWorthOfItInTheTreasury: { aPointIsWorth: 1.2 },
  },
  // A dwarven birthright in no table (src/engine/heroes/fame-and-consecration.ts): he fights in Mithril, and every melee
  // blow or arrow that lands on him deals this much less (never below 1), whatever the copy's own bonus; a realm's
  // Mithril Craft adds to it (pcCharCombatant's mithrilDR, which pcTakeHit reads).
  'mithril-armour': {
    name: 'Mithril Armour',
    carriedAs: { stat: 'mithrilArmour' },
    numbers: { damageTurnedAside: { value: 2, theTextsWriteIt: 'damage turned aside' } },
    theWorthOfItInTheTreasury: { aPointOfItsBonusIsWorth: 3 },
  },
  // ── The combat items (personalCombat, plan P1-19s): the potions, scrolls and devices a fighter carries into a personal
  // combat, each used once a fight. A fighter reaches for them in the order of the registry's stage (pcTryCombatItem; the
  // rows here are in that order too), each when its moment has come (pcCombatItemWanted), and uses it (pcUseCombatItem). Each copy carries its own numbers (its threshold `below`,
  // its amount, rounds, damage range, penalty, …: the copy's, not content's); where a copy carries none (or 0) the code
  // takes the row's (no item's texts state them: each item in play carries its own, but the Grey Cloak Draught's
  // threshold). A guardian wielding a lair's hoard uses them as a hero does. ──
  // He recovers hit points (never past his maximum) when below a share of his maximum.
  'combat-item-heals': {
    name: 'Potion of Healing',
    carriedAs: { use: 'heal' },
    numbers: {},
    theNumbersOfACopyThatCarriesNone: { below: 0.5, amt: 5 },
    theWorthOfItInTheTreasury: { hitPointsHealedForAPoint: 2.5 },
  },
  // He recovers hit points and every lingering harm, penalty and blinding lifts, when below a share of his maximum and
  // something lingers on him, or he is badly hurt.
  'combat-item-second-wind': {
    name: 'Elixir of Second Wind',
    carriedAs: { use: 'secondwind' },
    numbers: {},
    theNumbersOfACopyThatCarriesNone: { below: 0.6, amt: 10 },
    theNumbersAFighterWeighsItBy: { aPenaltyWorthLifting: 10, belowThisShareOfHisMaximumHpWhateverLingers: 0.4 },
    theWorthOfItInTheTreasury: { hitPointsHealedForAPoint: 2.5, whatLiftsIsWorth: 1 },
  },
  // He recovers hit points each round for some rounds, when below a share of his maximum and no such warmth is on him.
  'combat-item-heals-over-time': {
    name: 'Potion of Regeneration',
    carriedAs: { use: 'hot' },
    numbers: {},
    theNumbersOfACopyThatCarriesNone: { below: 0.7, amt: 3, rounds: 3 },
    theWorthOfItInTheTreasury: { hitPointsHealedForAPoint: 3 },
  },
  // A ward soaks the damage of the hits on him (and may turn some back), when he is hurt and holds no such ward.
  'combat-item-wards': {
    name: 'Potion of Iron Skin',
    carriedAs: { use: 'absorb' },
    numbers: {},
    theNumbersOfACopyThatCarriesNone: { absorb: 10 },
    theWorthOfItInTheTreasury: { damageSoakedForAPoint: 3 },
  },
  // His foes have less chance to hit him, when below a share of his maximum and he is not already unseen.
  'combat-item-hides': {
    name: 'Potion of Invisibility',
    carriedAs: { use: 'invis' },
    numbers: {},
    theNumbersOfACopyThatCarriesNone: { below: 0.5, toHitReduce: 25 },
    theWorthOfItInTheTreasury: { toHitReducedForAPoint: 6 },
  },
  // Images of him step out and take hits for him, when below a share of his maximum and none is left.
  'combat-item-mirror-images': {
    name: 'Potion of Mirrors',
    carriedAs: { use: 'mirror' },
    numbers: {},
    theNumbersOfACopyThatCarriesNone: { below: 0.7, images: 2 },
    theWorthOfItInTheTreasury: { anImageIsWorth: 1.5 },
  },
  // His chance to break away rises (and his foes may have less chance to hit him), when below a share of his maximum
  // and he may flee.
  'combat-item-flight': {
    name: 'Smoke Bomb',
    carriedAs: { use: 'flee' },
    numbers: {},
    theNumbersOfACopyThatCarriesNone: { below: 0.35, fleeBonus: 25 },
    theWorthOfItInTheTreasury: { fleeBonusForAPoint: 12, toHitReducedForAPoint: 8 },
  },
  // Every lingering harm, penalty and blinding on him lifts, when something lingers or a penalty is worth lifting.
  'combat-item-dispels': {
    name: 'Scroll of Dispel',
    carriedAs: { use: 'dispel' },
    numbers: {},
    theNumbersAFighterWeighsItBy: { aPenaltyWorthLifting: 15 },
    theWorthOfItInTheTreasury: { worth: 3 },
  },
  // A blow at the foe as a damaging item's, against a foe of the kinds it names only.
  'combat-item-bane': {
    name: 'Flask of Holy Water',
    carriedAs: { use: 'bane' },
    numbers: {},
    theNumbersOfACopyThatCarriesNone: { times: 1 },
    theWorthOfItInTheTreasury: { ...THE_WORTH_OF_A_BLOW, forStrikingItsKindsAlone: -1 },
  },
  // The foe is held, losing actions, against a foe of the kinds it names only.
  'combat-item-bane-stun': {
    name: 'Beastbane Snare',
    carriedAs: { use: 'banestun' },
    numbers: {},
    // its blows' count where a copy carries none: the treasury's (its worth weighs blows as a damaging item's)
    theNumbersOfACopyThatCarriesNone: { stun: 1, times: 1 },
    theWorthOfItInTheTreasury: { ...THE_WORTH_OF_A_BLOW, forStrikingItsKindsAlone: -1 },
  },
  // His Melee or Archery rises for the rest of the fight.
  'combat-item-strengthens': {
    name: 'Potion of Strength',
    carriedAs: { use: 'buff' },
    numbers: {},
    theWorthOfItInTheTreasury: { aPointAddedIsWorth: 3 },
  },
  // His chance to hit rises for the rest of the fight.
  'combat-item-focuses': {
    name: 'Elixir of Focus',
    carriedAs: { use: 'focus' },
    numbers: {},
    theNumbersOfACopyThatCarriesNone: { hitBonus: 10 },
    theWorthOfItInTheTreasury: { toHitBonusForAPoint: 4 },
  },
  // The foe's magic and powers are bound for some rounds, when the foe has any.
  'combat-item-silences': {
    name: 'Scroll of Silence',
    carriedAs: { use: 'silence' },
    numbers: {},
    theNumbersOfACopyThatCarriesNone: { rounds: 3 },
    theWorthOfItInTheTreasury: { aRoundSilencedIsWorth: 1.2 },
  },
  // The foe is held, losing actions.
  'combat-item-stuns': {
    name: 'Scroll of Paralysis',
    carriedAs: { use: 'stun' },
    numbers: {},
    theNumbersOfACopyThatCarriesNone: { stun: 1 },
    theWorthOfItInTheTreasury: { aRoundStunnedIsWorth: 2.5 },
  },
  // The foe can barely see to strike: a penalty that fades, or stays the whole fight where the item's words say "for
  // the rest of the fight".
  'combat-item-blinds': {
    name: 'Scroll of Blindness',
    carriedAs: { use: 'pen' },
    numbers: {},
    theNumbersOfACopyThatCarriesNone: { hitPen: 15 },
    theWorthOfItInTheTreasury: { toHitPenaltyForAPoint: 6 },
  },
  // The foe's Melee or Archery falls for the rest of the fight.
  'combat-item-weakens': {
    name: 'Scroll of Weakness',
    carriedAs: { use: 'weak' },
    numbers: {},
    theWorthOfItInTheTreasury: { aPointTakenIsWorth: 2.5 },
  },
  // A foe who may flee does so on this chance (the fight's draw); else he is shaken, a penalty to hit. Neither item in
  // play states the chance (plan NEXT.md question 26; Parked "The two terror items don't say a foe flees half the
  // time").
  'combat-item-terrifies': {
    name: 'Scroll of Terror',
    carriedAs: { use: 'terror' },
    numbers: { theChanceTheFoeFlees: { value: 0.5, theTextsWriteIt: 'a share, in words' } },
    theNumbersOfACopyThatCarriesNone: { hitPen: 15 },
    theWorthOfItInTheTreasury: { worth: 3, toHitPenaltyForAPoint: 10 },
  },
  // Blows at the foe, each its own draw of the copy's damage range, then what rides on them (a lingering burn, a
  // penalty to hit and a daze, from the next round).
  'combat-item-damages': {
    name: 'Scroll of Fire',
    carriedAs: { use: 'dmg' },
    numbers: {},
    theNumbersOfACopyThatCarriesNone: { times: 1 },
    theWorthOfItInTheTreasury: { ...THE_WORTH_OF_A_BLOW, forStrikingItsKindsAlone: 0 },
  },
  // A blow at the foe, and he drinks what it dealt, when below a share of his maximum.
  'combat-item-drains': {
    name: 'Scroll of Life Drain',
    carriedAs: { use: 'drain' },
    numbers: {},
    theNumbersOfACopyThatCarriesNone: { below: 0.75 },
    theWorthOfItInTheTreasury: { damageForAPoint: 2.2 },
  },
  // Each blow of a damaging item lands this many times as hard on a foe of the kinds it names (bane's double).
  'combat-item-doubled-against-its-kinds': {
    name: 'Scroll of Sunburst',
    carriedAs: { effectField: 'doubleVs' },
    numbers: { multiplier: { value: 2, theTextsWriteIt: 'a multiplier, in words' } },
  },
  // ── The items that change a steal and a blow in personal combat, and a guardian wielding its lair's hoard (plan
  // P1-19s). ──
  // His chance to steal in an encounter rises by this much (the Thief's action, pcAct).
  'lock-pick-of-legends': {
    name: 'Lock-Pick of Legends',
    carriedAs: { itemName: 'Lock-Pick of Legends' },
    numbers: { stealChance: { value: 20, theTextsWriteIt: 'a chance, in percentage points' } },
  },
  // Every melee blow its bearer lands deals this much more (pcMeleeDamage): a hero's, or a guardian's that wields them
  // from its hoard.
  'warbringer-gauntlets': {
    name: 'Warbringer Gauntlets',
    carriedAs: { itemName: 'Warbringer Gauntlets' },
    numbers: { damageAdded: { value: 2, theTextsWriteIt: 'damage added' } },
  },
  // ── The items that change a hero's combat spell in personal combat (plan P1-19w), each his own spell's. ──
  // His Psychic Blast stuns for one round more, after any doubling (2026-10-15, Toby, D4).
  dreamstone: {
    name: 'Dreamstone',
    carriedAs: { itemName: 'Dreamstone' },
    numbers: { theRoundsAdded: { value: 1, theTextsWriteIt: 'rounds added, in words' } },
  },
  // His Hand of Death bites ×1.1.
  'deaths-finger-ring': {
    name: "Death's Finger Ring",
    carriedAs: { itemName: "Death's Finger Ring" },
    numbers: { multiplier: { value: 1.1, theTextsWriteIt: 'a multiplier, as the share more' } },
  },
  // His Mirror Image is seen through at half the chance (plan P1-19x).
  'mirror-shard': {
    name: 'Mirror Shard',
    carriedAs: { itemName: 'Mirror Shard' },
    numbers: { multiplier: { value: 0.5, theTextsWriteIt: 'a share, in words' } },
  },
  // ── The kinds of item the treasury weighs as a whole (treasury, plan P1-19t: an item's role, what it is for, and its
  // worth, read as the engine loads, to tier each item, and by a bot choosing what to carry). Above, the effects of an
  // item's stat, use, ward or rider that the treasury weighs carry their worth too. Each kind is named by the first item
  // that carries it whose name no other row holds. ──
  // An item worn as armour fights: its worth is its ward's, and so much a point of its bonus.
  'an-item-worn-as-armour': {
    name: 'Padded Gambeson',
    carriedAs: { stat: THE_STAT_OF_AN_ITEM_WORN_AS_ARMOUR },
    numbers: {},
    theWorthOfItInTheTreasury: { aPointOfItsBonusIsWorth: 3 },
  },
  // A combat item fights: its worth is its use's.
  'a-combat-item': { name: 'Elixir of Vigour', carriedAs: { stat: THE_STAT_OF_A_COMBAT_ITEM }, numbers: {} },
  // An item whose power is its riders alone fights: its stat is worth nothing, its riders their own worth.
  'an-item-of-riders-alone': {
    name: 'Serpent-Fang Dagger',
    carriedAs: { stat: 'pc' },
    numbers: {},
    theWorthOfItInTheTreasury: { worth: 0 },
  },
  // A charm that casts a spell (what it casts is the spells family's, plan P1-19's items family, Decision 5): worth so
  // much, and so much a level of its spell (a spell that states no level counts as this one).
  'a-spell-charm': {
    name: 'Phial of the Dawn',
    carriedAs: { stat: 'castSpell' },
    numbers: {},
    theWorthOfItInTheTreasury: { worth: 3, aLevelOfItsSpellIsWorth: 1.2, theLevelOfASpellThatStatesNone: 2 },
  },
} as const satisfies Record<string, AMagicItemEffectAsItsTextsWriteIt>;

/** The slug of an effect the registry holds. */
export type MagicItemEffectSlug = keyof typeof MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS;
