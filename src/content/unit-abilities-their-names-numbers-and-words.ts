// The unit abilities the rule registry holds (plan P1-19, Decision 3): one row per ability, keyed by its slug, with its
// unit, its name as the books write it, its numbers each with how the books write it, and the units it reaches or counts
// when more than its own. The registry (src/engine/rules/the-registry-of-content-effects.ts) has one entry for each row
// and no other: a row with no entry, or an entry with no row, fails to compile. A row exists only for an effect the
// registry holds, so no row waits for its code. Change a number here, and the books with it: tests/static/
// each-unit-abilitys-name-and-numbers-are-in-both-books.test.ts reads every row against the unit's blurb in the player
// portal and its roster row in the rulebook.
//
// Below the rows, the blurbs themselves (UNIT_ABILITIES, plan P1-19e, moved word for word from the player portal): each
// unit's abilities as the player portal shows them, keyed by unit. The player portal imports them, and its page's entry
// (ui/player/page.ts) lists this file, so the words tests read them as the page's.
import { KC_UNIT_CLASS, type UnitType } from './kingdoms-call-data.ts';

/** How the books write a number: a multiplier as `×1.25`; a fraction added as `+10%` (0.1); a chance as `30%` (0.3);
 *  full strength (×1, where others fight at less) as `no penalty`, or as `full strength` (a unit's place in the line);
 *  a unit's base strength as `base strength 6`; a share of a unit's strength as `55%` (0.55); ×2 as `double` and ×0.5
 *  as `half`; a count as a word (`two`). A number the
 *  books leave out (Driven Before Them's cap, which the units beside them never reach) says so, and the words test
 *  checks that they still do. */
export type HowTheBooksWriteANumber =
  | 'a multiplier'
  | 'a fraction added'
  | 'a chance'
  | 'no penalty'
  | 'full strength'
  | 'a base strength'
  | 'a share'
  | 'double'
  | 'half'
  | 'a count in words'
  | 'a fraction the books leave out';

/** One number of an ability, and how the books write it. */
export interface ANumberOfAnAbility {
  readonly value: number;
  readonly theBooksWriteIt: HowTheBooksWriteANumber;
}

/** A row: what the books and the registry's effect read of one ability. */
export interface AUnitAbilityAsTheBooksWriteIt {
  /** The unit that has it (its blurb and its roster row name it). */
  readonly unit: UnitType;
  /** Its name, as both books write it. */
  readonly name: string;
  /** Its numbers, by what each is for. */
  readonly numbers: Readonly<Record<string, ANumberOfAnAbility>>;
  /** The units of the force it counts (Sheer Numbers: the orc foot), when it counts the others in the force. */
  readonly counts?: readonly UnitType[];
  /** The units it acts on, when not only its own: every unit of the force the ships land (Reaver Crews), or the units
   *  named (Hold the Gate: every garrison, the data file's class; Sergeants: the Levies beside the Men-at-Arms). A class
   *  of the data file is a list of strings: the registry's unit test checks that each is a unit type. */
  readonly reaches?: 'every unit of the force' | readonly string[];
  /** The unit it counts as for another ability (Town Watch: a Human Garrison counts as Levies for Shieldwall). */
  readonly countsAs?: UnitType;
  /** The grounds it acts on, when not every ground (a terrain's name: Woodland Skirmish, in forest and jungle). */
  readonly onTheGround?: readonly string[];
  /** Its words in the strength ladder, where they differ from its name (Spear Hedge, when Purity breaks it). */
  readonly wordsInTheLadder?: Readonly<Record<string, string>>;
}

/** The unit abilities the registry holds, in the order the battle code meets them: the strength of a unit in its
 *  whole force (plan P1-19a), then a unit meeting another or shooting over its line (P1-19b), then the whole line
 *  (P1-19c), then a unit's fate after the battle (P1-19d), then the volley before the battle and a land unit at sea
 *  (P1-19g), then a unit's place in the battle grid (P1-19h). */
export const UNIT_ABILITIES_THE_REGISTRY_HOLDS = {
  // Orc: goblins are worth little alone and a great deal in a mob.
  'sheer-numbers': {
    unit: 'Goblin Horde',
    name: 'Sheer Numbers',
    numbers: {
      perOtherOrcFootUnit: { value: 0.1, theBooksWriteIt: 'a fraction added' },
      atMost: { value: 0.3, theBooksWriteIt: 'a fraction added' },
    },
    counts: ['Goblin Horde', 'Orc Berserkers', 'Orc Garrison'],
  },
  // Orc: troops put ashore by longships hit the beach at a run.
  'reaver-crews': {
    unit: 'Orcish Longships',
    name: 'Reaver Crews',
    numbers: { theForceTheyLand: { value: 0.25, theBooksWriteIt: 'a fraction added' } },
    reaches: 'every unit of the force',
  },
  // Sharks are worthless alone and deadly in numbers (as the goblins' Sheer Numbers).
  'shoal-swarm': {
    unit: 'Shark Shoals',
    name: 'Shoal Swarm',
    numbers: {
      perOtherShoal: { value: 0.1, theBooksWriteIt: 'a fraction added' },
      atMost: { value: 0.3, theBooksWriteIt: 'a fraction added' },
    },
    counts: ['Shark Shoals'],
  },
  'relentless-hunt': {
    unit: 'Manticore Pride',
    name: 'Relentless Hunt',
    numbers: { attacking: { value: 1.25, theBooksWriteIt: 'a multiplier' } },
  },
  'stone-deterrent': {
    unit: 'Basilisk Brood',
    name: 'Stone Deterrent',
    numbers: { defending: { value: 1.25, theBooksWriteIt: 'a multiplier' } },
  },
  'tidal-might': {
    unit: 'Sea Giants',
    name: 'Tidal Might',
    numbers: { inACoastalLandProvince: { value: 1.2, theBooksWriteIt: 'a multiplier' } },
  },
  'deepwater-grasp': {
    unit: 'Eldritch Kraken',
    name: 'Deepwater Grasp',
    numbers: { atSea: { value: 1.35, theBooksWriteIt: 'a multiplier' } },
  },
  wyrmscale: {
    unit: 'Elder Dragons',
    name: 'Wyrmscale',
    numbers: { inEveryBattle: { value: 1.25, theBooksWriteIt: 'a multiplier' } },
  },
  'air-superiority': {
    unit: 'Crimson Rocs',
    name: 'Air Superiority',
    numbers: { whenTheEnemyFieldsRangedUnits: { value: 1.3, theBooksWriteIt: 'a multiplier' } },
  },
  // ── A unit meeting another, or shooting over its line (plan P1-19b: abilityFront and abilityBack) ──
  // What a unit does to the unit it meets (a matchup that sets the multiplier, or one that multiplies it).
  halberds: {
    unit: 'Men-at-Arms',
    name: 'Halberds',
    numbers: { facingCavalry: { value: 1.25, theBooksWriteIt: 'a multiplier' } },
  },
  'lance-charge': {
    unit: 'Gilded Lances',
    name: 'Lance Charge',
    numbers: { facingFoot: { value: 1.15, theBooksWriteIt: 'a multiplier' } },
  },
  frenzy: {
    unit: 'Orc Berserkers',
    name: 'Frenzy',
    numbers: { facingFoot: { value: 1.15, theBooksWriteIt: 'a multiplier' } },
  },
  'wolves-panic-horses': {
    unit: 'Warg Riders',
    name: 'Wolves Panic Horses',
    numbers: { facingCavalry: { value: 1.25, theBooksWriteIt: 'a multiplier' } },
  },
  // Its matchup; and, in the grid (plan P1-19h), the open flank slot no rider fills, which it may hold.
  'stoop-on-the-horses': {
    unit: 'Eagle Riders',
    name: 'Stoop on the Horses',
    numbers: { facingCavalry: { value: 1.25, theBooksWriteIt: 'a multiplier' } },
  },
  harriers: {
    unit: 'Free Lances',
    name: 'Harriers',
    numbers: { inAFlankDuel: { value: 1.15, theBooksWriteIt: 'a multiplier' } },
  },
  'woodland-skirmish': {
    unit: 'Forest Wardens',
    name: 'Woodland Skirmish',
    numbers: { inTheWoods: { value: 1.15, theBooksWriteIt: 'a multiplier' } },
    onTheGround: ['forest', 'jungle'],
  },
  bloodthirsty: {
    unit: 'Orc Garrison',
    name: 'Bloodthirsty',
    numbers: { defendingFacingFoot: { value: 1.15, theBooksWriteIt: 'a multiplier' } },
  },
  // The beasts (2026-10-13, Creatures and Monsters V): the walking beasts' matchups, and the unicorns' Purity.
  maul: {
    unit: 'Great Bears',
    name: 'Maul',
    numbers: { facingFoot: { value: 1.15, theBooksWriteIt: 'a multiplier' } },
  },
  trample: {
    unit: 'Mammoth Host',
    name: 'Trample',
    numbers: { facingFoot: { value: 1.15, theBooksWriteIt: 'a multiplier' } },
  },
  'many-heads': {
    unit: 'Dread Hydras',
    name: 'Many Heads',
    numbers: { facingFoot: { value: 1.25, theBooksWriteIt: 'a multiplier' } },
  },
  purity: {
    unit: 'Unicorn Herd',
    name: 'Purity',
    numbers: { facingMonstersAndSkeletons: { value: 1.25, theBooksWriteIt: 'a multiplier' } },
  },
  // What the unit it meets does to it. 2026-10-12 (Toby): Purity breaks a Spear Hedge or a Boulder Wall: the Unicorn
  // Herd is never held to their cap.
  'spear-hedge': {
    unit: 'Shieldwall Levies',
    name: 'Spear Hedge',
    numbers: { cavalryFacingThemAtMost: { value: 0.75, theBooksWriteIt: 'a multiplier' } },
    wordsInTheLadder: { whenPurityBreaksIt: 'Purity breaks the Spear Hedge' },
  },
  'boulder-wall': {
    unit: 'Stone Giants',
    name: 'Boulder Wall',
    numbers: { cavalryFacingThemAtMost: { value: 0.75, theBooksWriteIt: 'a multiplier' } },
    wordsInTheLadder: { whenPurityBreaksIt: 'Purity breaks the Boulder Wall' },
  },
  unbreakable: {
    unit: 'Dwarven Guard',
    name: 'Unbreakable',
    numbers: { footFacingThem: { value: 0.85, theBooksWriteIt: 'a multiplier' } },
  },
  'stone-halls': {
    unit: 'Dwarf Garrison',
    name: 'Stone Halls',
    numbers: { footFacingItInTheMountains: { value: 0.9, theBooksWriteIt: 'a multiplier' } },
    onTheGround: ['mountain'],
  },
  'thorn-hedge': {
    unit: 'Elven Garrison',
    name: 'Thorn Hedge',
    numbers: { cavalryFacingItInTheWoods: { value: 0.85, theBooksWriteIt: 'a multiplier' } },
    onTheGround: ['forest', 'jungle'],
  },
  // What a shooter in the second line does to its target, the enemy front unit it shoots.
  'bodkin-points': {
    unit: 'Yeoman Longbows',
    name: 'Bodkin Points',
    numbers: { shootingCavalry: { value: 1, theBooksWriteIt: 'no penalty' } },
  },
  'volley-at-the-charge': {
    unit: 'Elven Bowmen',
    name: 'Volley at the Charge',
    numbers: { shootingCavalry: { value: 1.25, theBooksWriteIt: 'a multiplier' } },
  },
  // Its matchup, and its choice of target along the enemy front (the whole line, P1-19c: battleFaceSide).
  marksmen: {
    unit: 'Shadow Archers',
    name: 'Marksmen',
    numbers: { shootingArchers: { value: 1.25, theBooksWriteIt: 'a multiplier' } },
  },
  'armour-piercing': {
    unit: 'Ironwood Crossbows',
    name: 'Armour-Piercing',
    numbers: {
      shootingAStrongUnit: { value: 1.25, theBooksWriteIt: 'a multiplier' },
      aStrongUnitsBaseStrengthAtLeast: { value: 6, theBooksWriteIt: 'a base strength' },
    },
  },
  bombard: {
    unit: 'Mountain Guns',
    name: 'Bombard',
    numbers: { whateverTheyShoot: { value: 1.15, theBooksWriteIt: 'a multiplier' } },
  },
  // What the target does to the shooter.
  'arrow-fodder': {
    unit: 'Goblin Horde',
    name: 'Arrow Fodder',
    numbers: { archersShootingThem: { value: 0.75, theBooksWriteIt: 'a multiplier' } },
  },
  // ── The whole line (plan P1-19c: battleFaceSide) ──
  // Held when hit from the side: a unit at a wrapped end of its front that the enemy line hits from the side is not hit
  // (Unbreakable, the Dwarven Guard's, is its row above).
  rooted: { unit: 'Forest Ents', name: 'Rooted', numbers: {} },
  // Every garrison holds the gate, defending, not only the Human Garrison the books name: the engine's rule since
  // 2026-10-11, kept as it is while Toby is asked which he meant.
  'hold-the-gate': {
    unit: 'Human Garrison',
    name: 'Hold the Gate',
    numbers: {},
    reaches: KC_UNIT_CLASS.garrison,
  },
  // Beside and behind it in the front line.
  shieldwall: {
    unit: 'Shieldwall Levies',
    name: 'Shieldwall',
    numbers: { withAnArcherBehind: { value: 1.25, theBooksWriteIt: 'a multiplier' } },
  },
  'town-watch': { unit: 'Human Garrison', name: 'Town Watch', numbers: {}, countsAs: 'Shieldwall Levies' },
  sergeants: {
    unit: 'Men-at-Arms',
    name: 'Sergeants',
    numbers: { leviesBesideThem: { value: 1.1, theBooksWriteIt: 'a multiplier' } },
    reaches: ['Shieldwall Levies'],
  },
  'driven-before-them': {
    unit: 'Orc Berserkers',
    name: 'Driven Before Them',
    numbers: {
      perGoblinHordeBeside: { value: 0.1, theBooksWriteIt: 'a fraction added' },
      // Two units at most stand beside them (+20%), so the cap never binds.
      atMost: { value: 0.3, theBooksWriteIt: 'a fraction the books leave out' },
    },
    counts: ['Goblin Horde'],
  },
  // Marked by the enemy's line: with the unit on the other side, a unit of mine it marks fights at less.
  'terror-from-above': {
    unit: 'Wyvern Riders',
    name: 'Terror From Above',
    numbers: { theStrongestFrontUnit: { value: 0.85, theBooksWriteIt: 'a multiplier' } },
  },
  'dive-on-the-bowmen': {
    unit: 'Noble Griffons',
    name: 'Dive on the Bowmen',
    numbers: { theStrongestSecondLineArcher: { value: 0.75, theBooksWriteIt: 'a multiplier' } },
    wordsInTheLadder: { onTheArcherTheyDiveOn: 'Griffon dive' },
  },
  'storm-wings': {
    unit: 'Thunderbirds',
    name: 'Storm Wings',
    numbers: { everyUnitInTheAir: { value: 0.85, theBooksWriteIt: 'a multiplier' } },
  },
  // Marksmen's choice of target is its row above. Turns an anchored line: a free enemy rider that turns the flank even
  // when foot anchor both ends.
  'battering-horns': { unit: 'Ironhoof Rams', name: 'Battering Horns', numbers: {} },
  // What a flyer does.
  'flak-gunners': {
    unit: 'Gnomish Gyrocopters',
    name: 'Flak Gunners',
    numbers: { whenTheEnemyHasFlyers: { value: 1.25, theBooksWriteIt: 'a multiplier' } },
  },
  // ── A unit's fate after the battle (plan P1-19d: rollUnitFates) ──
  // A beaten unit fails its death roll: a Cave Trolls company that fails it after a lost battle shrugs it off three
  // times in ten (2026-10-13, the beast abilities). Not in a victory: the hide knits in flight, not in the press of the
  // win.
  'regenerating-hide': {
    unit: 'Cave Trolls',
    name: 'Regenerating Hide',
    numbers: { afterALostBattle: { value: 0.3, theBooksWriteIt: 'a chance' } },
  },
  // A beaten unit fails its demotion roll: with a Gilded Lances unit in the force, the Levies and the Men-at-Arms (its
  // reach) never lose a tier in defeat; they hold, as under a Shield Fort (2026-10-11, Toby).
  'knightly-example': {
    unit: 'Gilded Lances',
    name: 'Knightly Example',
    numbers: {},
    reaches: ['Shieldwall Levies', 'Men-at-Arms'],
  },
  // ── The volley before the battle (plan P1-19g: abilityMissileUnits, missileCap, missileCapReached,
  // missileTargetPool, archeryBlockedBy, eyesOfTheForestLine, missileDamageMult, abilityVolleys, applyMissileHit) ──
  // Who shoots, though it is no ranged unit: a galleon at sea, a floating battery; the Elven Garrison in the woods.
  broadside: { unit: 'Galleon Fleet', name: 'Broadside', numbers: {}, onTheGround: ['sea'] },
  'tree-watch': { unit: 'Elven Garrison', name: 'Tree Watch', numbers: {}, onTheGround: ['forest', 'jungle'] },
  // Who shoots first: the guns, so they get the clear shot before the cap fills. And a shot's damage, below: siege guns
  // are built for breaking fortifications (every garrison).
  bombardment: {
    unit: 'Mountain Guns',
    name: 'Bombardment',
    numbers: { againstAGarrison: { value: 0.5, theBooksWriteIt: 'a fraction added' } },
  },
  // The shooters see what hides: with Eagle Riders flying with them, an Ambush is spoiled and Shadow Archers are seen
  // (2026-10-11).
  'eyes-of-the-forest': { unit: 'Eagle Riders', name: 'Eyes of the Forest', numbers: {} },
  // Stops the volley: Forest Wardens in the woods, attacking or defending, deny the side facing them its volley.
  ambush: { unit: 'Forest Wardens', name: 'Ambush', numbers: {}, onTheGround: ['forest', 'jungle'] },
  // May be shot at: Shadow Archers shoot from hiding; arrows and bolts don't tell against plated warships, nor against
  // the Great Turtles' shells (2026-10-13, the beast abilities).
  'loosed-from-cover': { unit: 'Shadow Archers', name: 'Loosed From Cover', numbers: {} },
  'armoured-hulls': { unit: 'Dwarf Ironclads', name: 'Armoured Hulls', numbers: {} },
  'shell-wall': { unit: 'Great Turtles', name: 'Shell Wall', numbers: {} },
  // How many volleys: defending Longbows loose two.
  'prepared-ground': {
    unit: 'Yeoman Longbows',
    name: 'Prepared Ground',
    numbers: { volleysDefending: { value: 2, theBooksWriteIt: 'a count in words' } },
  },
  // A shot's damage: elven bows in elven woods; the guns at a garrison (Bombardment, above); the Black Arrows loose
  // hardest going forward (2026-10-11, Toby: the Longbows' Massed Volley retired, Raiders' Volley arrives).
  'woodland-volley': {
    unit: 'Elven Bowmen',
    name: 'Woodland Volley',
    numbers: { inTheWoods: { value: 2, theBooksWriteIt: 'double' } },
    onTheGround: ['forest', 'jungle'],
  },
  'raiders-volley': {
    unit: 'Black Arrows',
    name: "Raiders' Volley",
    numbers: { attacking: { value: 1.5, theBooksWriteIt: 'a multiplier' } },
  },
  // What the target does to a shot: a volley at the Great Bears does half, rounded up, after a flyer's double.
  'thick-hide': {
    unit: 'Great Bears',
    name: 'Thick Hide',
    numbers: { aShotsDamage: { value: 0.5, theBooksWriteIt: 'half' } },
  },
  // The softening limit: heavy bolts grind a target past the point bows can manage (the usual limit is 40% of its
  // strength, 80% of a winged rider's).
  'punch-through': {
    unit: 'Ironwood Crossbows',
    name: 'Punch Through',
    numbers: {
      aTargetOnTheGround: { value: 0.55, theBooksWriteIt: 'a share' },
      aWingedRider: { value: 0.9, theBooksWriteIt: 'a share' },
    },
  },
  // A land unit at sea (strength, in armStr): the ranged units of a force with Elven Galleys shoot from steady decks and
  // don't suffer a land unit's penalty at sea. (Its effect reads the ranged units from the data file's class: a reach
  // named here would leave a read of the class in the player page's bundle.)
  'sea-archers': { unit: 'Elven Galleys', name: 'Sea Archers', numbers: {} },
  // ── A unit's place in the battle grid (plan P1-19h: battleGrid, battleRegrid, abilityFlanksRough) ──
  // A rider takes the flank on rough ground: the one flank slot rough ground allows goes to cavalry bred for it, the
  // Stag Riders and the Unicorn Herd in the woods, the Ironhoof Rams in the mountains (2026-10-11 and 2026-10-13). (On
  // open ground a flank slot no rider fills may go to the Eagle Riders: Stoop on the Horses, above.)
  'through-the-trees': {
    unit: 'Stag Riders',
    name: 'Through the Trees',
    numbers: {},
    onTheGround: ['forest', 'jungle'],
  },
  'through-the-glades': {
    unit: 'Unicorn Herd',
    name: 'Through the Glades',
    numbers: {},
    onTheGround: ['forest', 'jungle'],
  },
  'crag-charge': { unit: 'Ironhoof Rams', name: 'Crag Charge', numbers: {}, onTheGround: ['mountain'] },
  // Its place in the line: the orcs' archers fight hand to hand at full strength in the front, where other archers
  // fight at ×0.75; the Titans reach over the front at full strength from the second line, where others fight at ×0.5
  // (2026-10-13, the beast abilities).
  'brawling-archers': {
    unit: 'Black Arrows',
    name: 'Brawling Archers',
    numbers: { inTheFrontLine: { value: 1, theBooksWriteIt: 'full strength' } },
  },
  'colossal-bulk': {
    unit: 'Titan Warbeasts',
    name: 'Colossal Bulk',
    numbers: { inTheSecondLine: { value: 1, theBooksWriteIt: 'full strength' } },
  },
} as const satisfies Record<string, AUnitAbilityAsTheBooksWriteIt>;

/** The slug of an ability the registry holds. */
export type UnitAbilitySlug = keyof typeof UNIT_ABILITIES_THE_REGISTRY_HOLDS;

// Every humanoid land unit has a MATCHUP ability (what it does to the unit it meets in the battle line,
// or shoots over its fighter at) and ONE more; the fleets keep theirs. 2026-10-11 (Toby, the unit
// abilities). Kept in step with battleFaceSide / abilityFront / abilityBack, the volley helpers and
// rollUnitFates in the GM portal; tests/abilities-words holds the names to the rulebook's roster.
export const UNIT_ABILITIES = {
  'Shieldwall Levies':
    "Spear Hedge — cavalry facing them in the line fights at no better than ×0.75 (the Unicorn Herd's Purity breaks it). Shieldwall — ×1.25 when an archer stands in the second line behind them.",
  'Men-at-Arms': 'Halberds — ×1.25 facing cavalry. Sergeants — Levies beside them in the front line fight ×1.1.',
  'Free Lances':
    'Harriers — ×1.15 in a flank duel. Ride Them Down — in plains and desert only, each adds +6% to enemy losses when your side wins (max +18%). Works the same against neutral defenders — and theirs works the same against you.',
  'Yeoman Longbows':
    'Bodkin Points — no penalty shooting cavalry from the second line (other archers fire at ×0.75). Prepared Ground — defending, they loose two pre-battle volleys.',
  'Gilded Lances':
    'Lance Charge — ×1.15 facing foot, where cavalry is usually ×0.85 (a Spear Hedge still stops it). Knightly Example — while a Gilded Lances unit is in the army, your Levies and Men-at-Arms never lose a tier in defeat.',
  'Noble Griffons':
    'Dive on the Bowmen — the enemy’s strongest second-line archer fights ×0.75. Screech Dive — a diving pre-battle strike scatters one enemy unit (2–4), one chance in two whatever the commander’s Druid.',
  'Human Garrison':
    'Hold the Gate — defending, never hit from the side when the enemy line wraps its end. Town Watch — counts as Levies for Shieldwall and for anchoring the line.',
  'Galleon Fleet': 'Broadside — fires in the pre-battle archery phase during sea battles.',
  'Forest Wardens':
    'Woodland Skirmish — ×1.15 in forest and jungle, whatever they face. Ambush — in forest or jungle, the side facing them gets no archery phase at all (unless Eagle Riders fly with it). Works attacking or defending, and against province defenders as well as another realm.',
  'Elven Bowmen':
    'Volley at the Charge — ×1.25 shooting cavalry from the second line. Woodland Volley — double volley damage in forest and jungle.',
  'Shadow Archers':
    'Marksmen — ×1.25 shooting archers from the second line, and they pick the best target anywhere along the enemy front. Loosed From Cover — cannot be targeted by enemy volleys (unless Eagle Riders fly with the shooters).',
  'Stag Riders':
    'Through the Trees — the one cavalry that takes a flank in forest and jungle. Forest Runners — ×1.1 in forest and no penalty in jungle (see the roster).',
  'Eagle Riders':
    'Stoop on the Horses — on open ground they may hold a flank slot no rider fills, and fight cavalry at ×1.25. Eyes of the Forest — while they fly with your shooters, an enemy Ambush is spoiled and Shadow Archers can be shot at.',
  'Elven Garrison':
    'Thorn Hedge — cavalry facing it in forest or jungle ×0.85. Tree Watch — in forest or jungle it shoots in the archery step like an archer unit.',
  'Elven Galleys': 'Sea Archers — your ranged units ignore the land-unit penalty at sea.',
  'Dwarven Guard':
    "Unbreakable — foot facing them in the line ×0.85, and they are never hit from the side. Shield Fort — when at least half the front line is Guard (a Dwarf Garrison counts), a beaten force never routs: with a retreat open it withdraws in good order (immune to pursuit losses and to demotion in retreat); trapped, it locks shields and holds the province contested with no flight casualties. In every battle, and for a province's own Guard defenders too.",
  'Ironwood Crossbows':
    'Armour-Piercing — ×1.25 shooting a unit of base strength 6 or more from the second line. Punch Through — can soften a target to 55% instead of the usual 40% limit (90% instead of 80% against a winged rider).',
  'Mountain Guns':
    'Bombard — ×1.15 from the second line, whatever they shoot. Bombardment — fire before all other ranged units, and +50% volley damage against garrisons.',
  'Ironhoof Rams':
    'Battering Horns — a Ram riding free turns the enemy flank even when infantry anchor both ends of its line. Crag Charge — the one cavalry that takes a flank in the mountains.',
  'Gnomish Gyrocopters':
    'Flak Gunners — ×1.25 when the enemy has flyers. Flak Screen — each engages one enemy flying unit before the battle (−30% strength). No two gyrocopters engage the same flyer.',
  'Dwarf Garrison': 'Stone Halls — foot facing it in the mountains ×0.9. Deep Halls — counts as Guard for Shield Fort.',
  'Dwarf Ironclads': 'Armoured Hulls — immune to pre-battle volleys.',
  'Goblin Horde':
    'Arrow Fodder — second-line archers shooting them fire at ×0.75. Sheer Numbers — +10% strength per other orc foot unit in the force (Goblin Hordes, Berserkers, the Orc Garrison), max +30%.',
  'Orc Berserkers':
    'Frenzy — ×1.15 facing foot. Driven Before Them — +10% for each Goblin Horde beside them in the front line.',
  'Black Arrows':
    'Brawling Archers — full strength when forced into the front line, where other archers fight ×0.75. Raiders’ Volley — their pre-battle volley does ×1.5 when attacking.',
  'Warg Riders':
    'Wolves Panic Horses — ×1.25 facing cavalry. Run Them Down — if at least half your winning force are Wargs, they run the beaten army down on the field: every beaten unit is 15% more likely to be destroyed in the rout, on any ground (not against a Dwarven Shield Fort). There is no chase afterwards. Against neutral guards, who never flee, they end the fight fast instead: half casualties for you on a win.',
  'Wyvern Riders':
    'Terror From Above — the enemy’s strongest front-line unit fights ×0.85. Acid Spit — a pre-battle strike on one enemy unit (2–5), one chance in two whatever the commander’s Druid.',
  'Orc Garrison':
    'Bloodthirsty — defending, ×1.15 facing foot. Raiders’ Muster — an orcish province that sees an orc realm win there gains a Goblin Horde in its garrison at turn’s end, for nothing.',
  'Orcish Longships':
    'Reaver Crews — the whole force fights at +25% in any battle the phase it lands from these ships, even if another hero takes command of the combined host.',
  'Whale Cohort': 'Breach and Swamp — 25% chance each to sink one enemy fleet outright before the battle is fought.',
  // ── Creature / Monster / primal army abilities ── Each carries an always-on signature multiplier
  // PLUS a pre-battle strike (fires in the pre-battle magic phase; its chance rises with the
  // commanding hero’s Druid skill — 30% base, +10% per level, hard cap 90%; see primalStrikeChance (the winged riders’ own strikes: a flat 50%, 2026-10-11)
  // in the GM portal. 2026-09-27: this comment read "20% base" and had done for some time.
  // (The Noble Griffons' blurb is with the other human units above: a second key here would silently replace it.)
  Thunderbirds:
    'Storm Wings — every enemy unit in the air fights ×0.85. Lightning Strike: a pre-battle strike on one enemy unit (4–8). Storm-birds of the high crags that fight from the air, taking no place in the line.',
  'Forest Ents':
    'Rooted — never hit from the side when the enemy line wraps their end. Choking Spores: a pre-battle strike across the whole enemy line (2–4 each). At home in forest and jungle (terrain ×1.15), withering in the desert.',
  'Stone Giants':
    "Boulder Wall — cavalry facing them fights at no better than ×0.75 (the Unicorn Herd's Purity breaks it). Boulder Barrage: a pre-battle strike that shatters one enemy unit (4–7). At home in the mountains (terrain ×1.15); slow.",
  'Cave Trolls':
    'Regenerating Hide — after a lost battle, a 30% chance to shrug off a death roll. Hurled Rubble: a pre-battle strike on one enemy unit (4–7). At home in the mountains and the forest (terrain ×1.15 and ×1.1).',
  'Manticore Pride':
    'Relentless Hunt — ×1.25 strength when their side is the attacker, and when at least half the winning force are Manticores the beaten foe takes +15% rout losses. Spine Volley: a pre-battle strike across every enemy unit (2–4 each). Fights from the air.',
  'Basilisk Brood':
    'Stone Deterrent — ×1.25 strength when their side is defending. Petrifying Gaze: a pre-battle strike across the whole enemy line (2–4 each).',
  'Crimson Rocs':
    'Air Superiority — ×1.3 strength when the enemy fields ranged troops. Thunderous Stoop: a pre-battle strike scatters one enemy unit (5–9). Fights from the air, taking no place in the line.',
  'Elder Dragons':
    'Wyrmscale — ×1.25 strength in every battle. Dragonfire Breath: a pre-battle strike that washes every enemy unit in fire (3–6 each). Fights from the air, taking no place in the line.',
  'Titan Warbeasts':
    'Colossal Bulk — fights from the second line at full strength. World-Shaking Charge: a pre-battle strike that unbalances every enemy unit (3–6 each). At home on the plain and in the desert (terrain ×1.1).',
  'Sea Giants':
    'Tidal Might — ×1.2 strength in a coastal land province (one bordering the sea). Tidal Surge: a pre-battle strike on one enemy unit (4–8).',
  'Eldritch Kraken':
    'Deepwater Grasp — ×1.35 strength at sea. Crushing Coils: a pre-battle strike that drags one enemy unit under (5–9).',
  'Dread Hydras':
    'Many Heads — ×1.25 facing foot. Venom Breath: a pre-battle strike across the whole enemy line (3–6 each). The greatest of the Monsters, at home in jungle and forest (terrain ×1.1 and ×1.05).',
  'Shark Shoals':
    'Shoal Swarm — +10% strength per other Shark Shoals in the force, to +30%. Feeding Frenzy — when at least half the winning force are shoals, a foe beaten at sea takes +15% rout losses. A shoal is no hull: it carries nothing.',
  'Great Bears':
    'Maul — ×1.15 facing foot. Thick Hide — pre-battle volleys against them do half. At home in forest and mountain (terrain ×1.1), poor in the desert; move 3.',
  'Unicorn Herd':
    'Purity — ×1.25 facing Monsters and skeletons, and it breaks a Spear Hedge or a Boulder Wall (no ×0.75 cap). Through the Glades — the one cavalry, with the Stag Riders, that takes a flank in forest and jungle. At home on the plain and in the forest (terrain ×1.1).',
  'Mammoth Host':
    'Trample — ×1.15 facing foot. Stampede: a pre-battle strike across the whole enemy line (2–4 each). At home on the open plain (terrain ×1.1), ill at ease under trees; slow.',
  'Great Turtles':
    'Island Back — carries two land units a hull, where a fleet carries one. Shell Wall — immune to pre-battle volleys, as the Ironclads. Island-backed turtles of the prosperous seas that swim under their own power; slow.',
};
