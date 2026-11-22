// The world's making's lists (B-06, T7, the rules pulled out: its world generation family, from B-06t), word for word
// and in the order the making read them: the words a province's and a sea's name are made of, the sea features, the
// wild beasts a primal province is dealt by its terrain, the fleet a humanoid race builds on a coast, the neutral
// heroes' skills, and the bots' realms' starting skills and names. The world's making (src/engine/world/generate.ts,
// src/engine/world/tables.ts and src/engine/bots/setup.ts) reads each from here. Their order is data: a die picks an
// element by its place, so a list reordered makes other worlds from the same seed. Nothing here imports the engine.

/** The terrains a land province is dealt, in the order the die reads them (pickLand). Not the engine's
 *  LAND_TERRAINS_GEN, whose order differs: merging the two would deal other terrains from the same dice. */
export const THE_TERRAINS_A_LAND_PROVINCE_IS_DEALT_IN_THE_ORDER_THE_DIE_READS_THEM = [
  'plain',
  'forest',
  'mountain',
  'desert',
  'jungle',
] as const;

/** The first half of a land province's name, by the race of its people. */
export const THE_FIRST_HALVES_OF_A_PROVINCES_NAME_BY_ITS_RACE: Readonly<
  Record<'Human' | 'Elven' | 'Dwarven' | 'Orcish', readonly string[]>
> = {
  Human: [
    'Iron',
    'Stone',
    'High',
    'Old',
    'Gold',
    'Silver',
    'Storm',
    'Red',
    'Ash',
    'East',
    'West',
    'Grey',
    'Fair',
    'Duns',
    'Wold',
    'Marl',
    'Bram',
    'Wend',
    'Ald',
    'Hart',
  ],
  Elven: [
    'Silver',
    'Moon',
    'Star',
    'Leaf',
    'Dawn',
    'Sil',
    'Aer',
    'Elu',
    'Lorn',
    'Cael',
    'Fae',
    'Gil',
    'Lith',
    'Myr',
    'Thal',
    'Nym',
    'Elen',
    'Yll',
    'Wist',
    'Aely',
  ],
  Dwarven: [
    'Iron',
    'Stone',
    'Deep',
    'Gold',
    'Grim',
    'Kaz',
    'Dur',
    'Bar',
    'Khaz',
    'Grom',
    'Thur',
    'Kron',
    'Bal',
    'Dun',
    'Forge',
    'Anvil',
    'Coal',
    'Rune',
    'Brom',
    'Hald',
  ],
  Orcish: [
    'Blood',
    'Skull',
    'Bone',
    'Gor',
    'Grash',
    'Mor',
    'Uruk',
    'Kra',
    'Zog',
    'Gna',
    'Rot',
    'Dread',
    'Gash',
    'Mag',
    'Grish',
    'Nar',
    'Vak',
    'Ur',
    'Krul',
    'Rok',
  ],
};
/** The first half of a wild (primal) land province's name. */
export const THE_FIRST_HALVES_OF_A_WILD_PROVINCES_NAME: readonly string[] = [
  'Wyrm',
  'Beast',
  'Wild',
  'Titan',
  'Dread',
  'Ancient',
  'Grim',
  'Feral',
  'Elder',
  'Savage',
  'Broken',
  'Fang',
  'Talon',
  'Scale',
  'Horn',
  'Ruin',
  'Storm',
  'Blight',
];
/** The second half of a land province's name, by its terrain. */
export const THE_SECOND_HALVES_OF_A_PROVINCES_NAME_BY_ITS_TERRAIN: Readonly<
  Record<'plain' | 'forest' | 'mountain' | 'desert' | 'jungle', readonly string[]>
> = {
  plain: ['field', 'meadow', 'march', 'moor', 'hold', 'reach', 'down', 'wold', 'stead', 'heath', 'vale', 'ridge'],
  forest: ['wood', 'grove', 'thicket', 'hollow', 'glade', 'shaw', 'copse', 'weald', 'briar', 'root', 'leaf', 'fen'],
  mountain: ['peak', 'crag', 'spire', 'fell', 'cairn', 'tor', 'height', 'ridge', 'deep', 'delve', 'pass', 'stone'],
  desert: ['dune', 'waste', 'sands', 'drift', 'mesa', 'scar', 'barrens', 'reach', 'flats', 'scree', 'wells', 'expanse'],
  jungle: ['tangle', 'vale', 'verge', 'canopy', 'mire', 'delve', 'green', 'deep', 'vines', 'hollow', 'rot', 'fen'],
};
/** A sea's name, its first half and its second, by the kind of sea: primal waters, whale waters, shark waters and
 *  open water. */
export const THE_HALVES_OF_A_SEAS_NAME_BY_THE_KIND_OF_SEA: Readonly<
  Record<'primal' | 'whale' | 'shark' | 'open', { readonly pre: readonly string[]; readonly suf: readonly string[] }>
> = {
  primal: {
    pre: [
      'Kraken',
      'Wyrm',
      'Serpent',
      'Abyssal',
      'Drowned',
      'Sunken',
      'Titan',
      'Leviathan',
      'Dread',
      'Deep',
      'Black',
      'Storm',
    ],
    suf: [' Deep', ' Abyss', ' Maw', ' Trench', ' Reach', ' Fathoms', ' Gulf', ' Dark'],
  },
  whale: {
    pre: ['Whale', 'Grey', 'Cold', 'Deep', 'Wander', 'Song', 'Tide', 'Mist', 'Roam', 'Bower'],
    suf: [' Sound', ' Waters', ' Bay', ' Reach', ' Passage', ' Run', ' Sea', ' Shoals'],
  },
  shark: {
    pre: ['Shark', 'Red', 'Fin', 'Hunger', 'Blood', 'Teeth', 'Reef', 'Sandbar', 'Wreck', 'Carrion'],
    suf: [' Shallows', ' Bank', ' Reef', ' Shoals', ' Bar', ' Flats', ' Sound', ' Run'],
  }, // 2026-10-13: shark waters
  open: {
    pre: ['Storm', 'Grey', 'Salt', 'Foam', 'Pale', 'Azure', 'Wild', 'Bitter', 'Calm', 'Wide', 'Open', 'Far'],
    suf: [' Sea', ' Straits', ' Channel', ' Gulf', ' Waters', ' Expanse', ' Reach', ' Ocean', ' Bight'],
  },
};
/** The numeral a province's name takes when another province already holds it, by its place (from II; '' for 0). */
export const THE_NUMERALS_A_REPEATED_PROVINCES_NAME_TAKES: readonly string[] = [
  '',
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
];

/** The wild beasts a primal land province is dealt, by its terrain: the Creatures (Druidic realms favour them). Read
 *  by the province pass, the creed's starting neighbour and the wild country near the two crowns. */
export const THE_WILD_CREATURES_BY_TERRAIN: Readonly<
  Record<'plain' | 'desert' | 'forest' | 'jungle' | 'mountain', readonly string[]>
> = {
  plain: ['Thunderbirds', 'Stone Giants', 'Unicorn Herd', 'Mammoth Host'],
  desert: ['Stone Giants', 'Thunderbirds', 'Mammoth Host'],
  forest: ['Forest Ents', 'Thunderbirds', 'Great Bears', 'Unicorn Herd'],
  jungle: ['Forest Ents'],
  mountain: ['Stone Giants', 'Crimson Rocs', 'Thunderbirds', 'Great Bears'],
};
/** The wild beasts a primal land province is dealt, by its terrain: the Monsters (Evil realms favour them). */
export const THE_WILD_MONSTERS_BY_TERRAIN: Readonly<
  Record<'plain' | 'desert' | 'forest' | 'jungle' | 'mountain', readonly string[]>
> = {
  plain: ['Titan Warbeasts', 'Manticore Pride'],
  desert: ['Manticore Pride', 'Basilisk Brood'],
  forest: ['Cave Trolls', 'Basilisk Brood', 'Dread Hydras'],
  jungle: ['Basilisk Brood', 'Cave Trolls', 'Manticore Pride', 'Dread Hydras'],
  mountain: ['Cave Trolls', 'Elder Dragons'],
};

/** The fleet each humanoid race builds in a coastal province: the coastal fleets, a coastal capital's fleet, a
 *  re-raced neighbour's, the coastal shipyards. The Corsair Fleet is retired (it was the Humans' second). */
export const THE_FLEETS_A_HUMANOID_RACE_BUILDS_ON_A_COAST: Readonly<
  Record<'Human' | 'Elven' | 'Dwarven' | 'Orcish', readonly string[]>
> = {
  Human: ['Galleon Fleet'],
  Elven: ['Elven Galleys'],
  Dwarven: ['Dwarf Ironclads'],
  Orcish: ['Orcish Longships'],
};
/** Every humanoid fleet type, the retired Corsair Fleet too (a save's companies may still be one). */
export const THE_HUMANOID_FLEET_TYPES: readonly string[] = [
  'Galleon Fleet',
  'Corsair Fleet',
  'Elven Galleys',
  'Dwarf Ironclads',
  'Orcish Longships',
];

/** The sea features a sea province is dealt (one or two each). */
export const THE_SEA_FEATURES_NAMES: readonly string[] = [
  'Sunken Ship',
  'Sea Cave',
  'Kraken Lair',
  'Mermaid Grotto',
  'Ghost Galleon',
  'Coral Fortress',
  'Pirate Cove',
  'Lighthouse Ruin',
  'Drowned Temple',
  'Barnacle Reef',
  'Whalebone Graveyard',
  'Tide Pools',
  'Sea-Witch\u2019s Cove',
  'Wreckers\u2019 Shoal',
  'Abyssal Trench',
  'Siren Rocks',
  'Salt Marsh Delta',
  'Smugglers\u2019 Grotto',
  'Sunken City',
  'Reef of Bones',
  'Storm-Wrack',
  'Glasswater Shallows',
  'Drowned Lighthouse',
  'Coral Labyrinth',
];
/** The sea beasts the home's weak lair leaves out of its guardians (KD-424: not SEA_GUARDIAN_NAMES, which it was
 *  meant to be). */
export const THE_SEA_BEASTS_A_HOMES_WEAK_LAIR_LEAVES_OUT: readonly string[] = [
  'Sea Serpent',
  'Kraken Spawn',
  'Leviathan',
  'Leviathan Young',
  'Pirate Captain',
  'Ghost Galleon Crew',
  'Shark Pack',
  'Giant Crab',
];

/** The skills a neutral hero is dealt, one at level 2 and one at level 1. NOT a copy of KC_MAGIC_SCHOOLS or
 *  KC_SKILLS: this ORDER is the tie-break priority. Leave it hand-kept (2026-09-27). */
export const THE_NEUTRAL_HEROES_SKILLS_IN_THEIR_TIE_BREAK_ORDER: readonly string[] = [
  'melee',
  'archery',
  'tactical',
  'march',
  'explorer',
  'naval',
  'sage',
  'spy',
  'thief',
  'druid',
  'white',
  'psychic',
  'illusory',
  'elemental',
  'necromancy',
];

// The bots' realms (drawn up before the world, as the GM page's Turn 0 does: src/engine/bots/setup.ts).
// Alignment → four starting skill points, drawn from each alignment's Title signature lane
// (see KC-design-victory-and-titles.md §5). Real engine skills only (SKILL_LABELS). Each totals 4.
export const THE_BOTS_STARTING_SKILLS_BY_ALIGNMENT = {
  // Sept 2026 (bot strategy batch): every build now carries Tactical >=1 so the bot king can drill
  // his host from turn 1 — Divine swaps druid->tactical, Neutral drops a Sage point, Pagan drops an
  // Explorer point.
  Divine: { white: 2, tactical: 1, melee: 1 },
  Good: { melee: 1, tactical: 1, march: 1, white: 1 },
  Druidic: { druid: 2, tactical: 1, archery: 1 },
  Neutral: { sage: 1, tactical: 1, spy: 1, thief: 1 },
  Pagan: { explorer: 1, elemental: 1, tactical: 1, melee: 1 },
  Evil: { melee: 2, tactical: 1, necromancy: 1 },
  Undead: { necromancy: 2, melee: 1, tactical: 1 },
};
// Race → a signature unit whose faction-name pool (ARMY_UNIT_NAMES) we borrow for realm names.
// This reuses existing themed pools rather than inventing new name content (the engine has no
// realm-name generator: human players type theirs).
export const THE_UNIT_WHOSE_COMPANIES_NAMES_NAME_A_BOTS_REALM_BY_ITS_RACE = {
  Human: 'Free Lances',
  Elven: 'Elven Bowmen',
  Dwarven: 'Dwarven Guard',
  Orcish: 'Orc Berserkers',
};
