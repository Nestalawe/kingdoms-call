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
 *  percentage points (5 as `5%`). */
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
  | 'a chance, in percentage points';

/** One number of an item's effect, and how the item's texts write it. */
export interface ANumberOfAnItemsEffect {
  readonly value: number;
  readonly theTextsWriteIt: HowAnItemsTextsWriteANumber;
}

/** The three effects a held copy carries on the item itself, beside its `effect` (Parked: one key per effect, later). */
export type AnItemsOwnField = 'fleetStr' | 'landFullAtSea' | 'exploreMove';

/** The riders a held copy carries for personal combat (its `effect.pc`), beside a ward: each carried when above 0. */
export type ARiderAnItemCarries = 'aura' | 'burn' | 'drain' | 'hitBonus' | 'dmgBonus';

/** The `effect.stat` of an item worn as armour: its effect is a ward (`effect.ward`, with its amount, percentage or
 *  hits), which personal combat merges into the wards its bearer wears. */
export const THE_STAT_OF_AN_ITEM_WORN_AS_ARMOUR = 'armour';

/** The key a held copy of an item carries an effect by: its `effect.stat`, a field of the item's own (true when set),
 *  the item's base name (a second name of a tier-1 or tier-2 item counts as its base's, as hasItemBase reads it), a
 *  ward (its armour's `effect.ward`, or its rider's `effect.pc.ward`: a guardian's perk of the same ward reaches the
 *  same effect), or a rider (its `effect.pc`'s, above 0). */
export type TheKeyAnItemCarriesItsEffectBy =
  | { readonly stat: string }
  | { readonly field: AnItemsOwnField }
  | { readonly itemName: string }
  | { readonly ward: string }
  | { readonly rider: ARiderAnItemCarries };

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

/** The magic items' effects the registry holds, in the order the battle code meets them: the commander's items on
 *  each unit he leads, then his items at sea (plan P1-19m); the commanders' items at the defenders' fortifications, at
 *  the volley and in the rout (plan P1-19n); then a hero's items in the realm's tax at the turn's end, and in his orders
 *  (plan P1-19o); then a hero's items in his own standing: his maximum hit points, his temper and his skills (plan
 *  P1-19p); then what a fighter wears in personal combat: his wards, his riders and the Mithril suit (plan P1-19q),
 *  with the numbers the fight wrote for what each does (plan P1-19r). */
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
  },
  // He fights with the copy's own `effect.temper` in personal combat, over his own (the copy's word: no number here); the
  // first of his items that carries one.
  temper: {
    name: 'Warmask of the Red Rage',
    carriedAs: { stat: 'temper' },
    numbers: {},
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
  'melee-damage-turned-aside': { name: 'Dwarf-Forged Hauberk', carriedAs: { ward: 'meleeDR' }, numbers: {} },
  'arrow-damage-turned-aside': { name: 'Arrow-Turning Brigandine', carriedAs: { ward: 'arrowDR' }, numbers: {} },
  // against a beast, vermin or a dragon
  'nature-damage-turned-aside': { name: 'Serpent-Scale Coat', carriedAs: { ward: 'natureDR' }, numbers: {} },
  // against the undead or a fiend
  'dark-damage-turned-aside': { name: 'Grave-Iron Plate', carriedAs: { ward: 'darkDR' }, numbers: {} },
  thorns: { name: 'Thornwood Cuirass', carriedAs: { ward: 'thorns' }, numbers: {} },
  regeneration: { name: 'Troll-Hide Jerkin', carriedAs: { ward: 'regen' }, numbers: {} },
  'spell-damage-cut': { name: 'Spellwarded Robe', carriedAs: { ward: 'spellPct' }, numbers: {} },
  dodge: { name: 'Quicksilver Mail', carriedAs: { ward: 'dodge' }, numbers: {} },
  block: { name: 'Tower Shield of the Wall', carriedAs: { ward: 'block' }, numbers: {} },
  'a-hits-damage-capped': { name: 'Bulwark Breastplate', carriedAs: { ward: 'cap' }, numbers: {} },
  // Once a fight, the first time a hit leaves him below this share of his maximum HP, he recovers the copy's share.
  'second-wind': {
    name: 'Last-Stand Plate',
    carriedAs: { ward: 'secondWind' },
    numbers: { belowThisShareOfHisMaximumHp: { value: 0.3, theTextsWriteIt: 'a share, as a percentage' } },
  },
  // While he is below this share of his maximum HP, every hit on him deals the copy's share less.
  'damage-cut-at-low-hp': {
    name: "Warden's Scale",
    carriedAs: { ward: 'lowHp' },
    numbers: { belowThisShareOfHisMaximumHp: { value: 0.5, theTextsWriteIt: 'a share, in words' } },
  },
  'the-first-hit-drunk': { name: 'Blood-Bound Cuirass', carriedAs: { ward: 'firstHit' }, numbers: {} },
  'lingering-harm-turned-aside': { name: 'Ashen Plate', carriedAs: { ward: 'dotImmune' }, numbers: {} },
  // A to-hit penalty fades twice as fast, and a daze is shrugged off at the start of a round on this chance. No item in
  // play carries it: the engine's load-time pass rewrites its one item.
  resist: {
    name: 'Steadfast Harness',
    carriedAs: { ward: 'resist' },
    numbers: { theChanceToShrugOffADaze: { value: 0.5, theTextsWriteIt: 'a share, in words' } },
  },
  'arrow-block': { name: 'Kite Shield of the Marches', carriedAs: { ward: 'arrowBlock' }, numbers: {} },
  // Melee blows deal 1 less, and foes have 5% less chance to hit (the best dodge worn): whatever the copy carries.
  buckler: {
    name: 'Bronze Buckler',
    carriedAs: { ward: 'buckler' },
    numbers: {
      meleeDamageTurnedAside: { value: 1, theTextsWriteIt: 'damage turned aside' },
      dodge: { value: 5, theTextsWriteIt: 'a chance, in percentage points' },
    },
  },
  // The first hits of a fight to land deal a share less: the copy's own hits and percentage (every item in play
  // carries both), or these.
  'open-guard': {
    name: 'Oaken Roundshield',
    carriedAs: { ward: 'openGuard' },
    numbers: {},
    theNumbersOfACopyThatCarriesNone: { hits: 2, pct: 50 },
  },
  'spell-block': { name: 'Mirror-Bright Shield', carriedAs: { ward: 'spellBlock' }, numbers: {} },
  'round-ward': { name: 'Shield of the Ward-Saints', carriedAs: { ward: 'roundWard' }, numbers: {} },
  'stun-immunity': { name: 'Dragonbone Shield', carriedAs: { ward: 'stunImmune' }, numbers: {} },
  // His foes have less chance to hit him, the whole fight: the best of his counts.
  'aura-rider': { name: "Oathkeeper's Blade", carriedAs: { rider: 'aura' }, numbers: {} },
  // A foe at melee range takes this much each round: his add.
  'burn-rider': { name: 'Brand of the Salamander', carriedAs: { rider: 'burn' }, numbers: {} },
  // He heals a share of the melee damage he deals: the best of his counts.
  'drain-rider': { name: 'Grave-Cold Blade', carriedAs: { rider: 'drain' }, numbers: {} },
  // His chance to hit: his add.
  'hit-bonus-rider': { name: "Warden's Poleaxe", carriedAs: { rider: 'hitBonus' }, numbers: {} },
  // His blows' damage: his add.
  'damage-bonus-rider': { name: 'Kingsteel Longsword', carriedAs: { rider: 'dmgBonus' }, numbers: {} },
  // A dwarven birthright in no table (src/engine/heroes/fame-and-consecration.ts): he fights in Mithril, and every melee
  // blow or arrow that lands on him deals this much less (never below 1), whatever the copy's own bonus; a realm's
  // Mithril Craft adds to it (pcCharCombatant's mithrilDR, which pcTakeHit reads).
  'mithril-armour': {
    name: 'Mithril Armour',
    carriedAs: { stat: 'mithrilArmour' },
    numbers: { damageTurnedAside: { value: 2, theTextsWriteIt: 'damage turned aside' } },
  },
} as const satisfies Record<string, AMagicItemEffectAsItsTextsWriteIt>;

/** The slug of an effect the registry holds. */
export type MagicItemEffectSlug = keyof typeof MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS;
