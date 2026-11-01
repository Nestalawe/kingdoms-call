import {
  HERO_EPITHET_OVERFLOW,
  HERO_NAME_PARTS,
  LAIR_POOLS_CAT_P,
  LAIR_POOLS_MONSTER_P,
} from '../content/kingdoms-call-data.ts';
import { THE_NUMBERS_THE_CODE_WRITES_FOR_A_GUARDIANS_PERKS } from '../content/guardian-perks-their-kinds-numbers-and-words.ts';
import { kcRng } from './rng.ts';
import { shuffleP } from './battle/fortune.ts';
import type { Character } from '../schemas/saved-game-state.ts';
import {
  THE_NUMBER_OF_WAYS_THE_WANDERER_ESCAPES,
  type TheFactOfTheWanderersEscape,
} from './the-facts-the-wanderers-escape-line-records.ts';

// The name tables, read by any alignment's, guardian's or category's name.
interface NamePartsOfAnAlignment {
  readonly firsts?: readonly string[] | undefined;
  readonly epithets?: readonly string[] | undefined;
}
type NamePartsOfEachAlignment = Readonly<Record<string, NamePartsOfAnAlignment | undefined>>;
interface LairNamesOfACategory {
  readonly land?: readonly string[] | undefined;
  readonly sea?: readonly string[] | undefined;
}
// A guardian as the lair names read it (a test's may hold its category alone).
interface AGuardianAsTheseRead {
  readonly cat?: string | null | undefined;
  readonly name?: string | undefined;
}

// ── UNIQUE-NAME OVERFLOW POOLS (KC item: no two characters share a given name OR a descriptor) ──
// A game names up to ~184 neutral heroes on the largest map, plus kings and heirs (~210 names).
// Each alignment's flavoured pools alone cannot supply that many DISTINCT epithets, so these
// alignment-neutral overflow pools top the shared master lists up well past any hero count. A hero
// still draws from its own alignment's flavoured pool FIRST (for theme); only when that is spent
// does it borrow from the shared master list. Given/epithet uniqueness is tracked globally.
export const HERO_FIRST_OVERFLOW = [
  'Aldwin',
  'Brenna',
  'Caldor',
  'Dagna',
  'Emeric',
  'Faelan',
  'Gwendra',
  'Harlan',
  'Ilsa',
  'Joran',
  'Kaethe',
  'Loras',
  'Maeve',
  'Nolwenn',
  'Ottar',
  'Peredur',
  'Quenna',
  'Rhoswen',
  'Sefton',
  'Talia',
  'Ulric',
  'Vanwen',
  'Warin',
  'Ysolde',
  'Zephyr',
  'Aldous',
  'Bewick',
  'Corwin',
  'Deryn',
  'Efa',
  'Faramund',
  'Gethin',
  'Hedric',
  'Isolt',
  'Jarl',
  'Kestrel',
  'Lorcan',
  'Morwen',
  'Nesta',
  'Odric',
  'Padrig',
  'Quillon',
  'Rowena',
  'Selwyn',
  'Tamsin',
  'Ulla',
  'Vesta',
  'Wilmot',
  'Yorath',
  'Aldreth',
  'Bricta',
  'Cadmar',
  'Deirwen',
  'Emlyn',
  'Fendrel',
  'Gwyneth',
  'Hale',
  'Isembard',
  'Jocelin',
  'Kenna',
  'Lisenn',
  'Mabon',
  'Nyle',
  'Osric',
  'Perren',
  'Rulf',
  'Sabra',
  'Tegan',
  'Ualan',
  'Voss',
  'Wenna',
  'Yestin',
  'Aldarra',
  'Bram',
  'Ceridwen',
  'Doryn',
  'Elgin',
  'Ferrun',
  'Gomer',
  'Haldis',
];
// Shared master lists = every alignment's flavoured names + the overflow. Built once at load.
export const ALL_HERO_FIRSTS = (() => {
  const set = new Set<string>();
  const namePartsOf: NamePartsOfEachAlignment = HERO_NAME_PARTS;
  Object.values(namePartsOf).forEach((v) => {
    (v?.firsts ?? []).forEach((x) => set.add(x));
  });
  HERO_FIRST_OVERFLOW.forEach((x) => set.add(x));
  return [...set];
})();
export const ALL_HERO_EPITHETS = (() => {
  const set = new Set<string>();
  const namePartsOf: NamePartsOfEachAlignment = HERO_NAME_PARTS;
  Object.values(namePartsOf).forEach((v) => {
    (v?.epithets ?? []).forEach((x) => set.add(x));
  });
  HERO_EPITHET_OVERFLOW.forEach((x) => set.add(x));
  return [...set];
})();
export const _usedHeroFirsts = new Set<string>();
export const _usedHeroEpithets = new Set<string>();
// Draw an unused entry: try the preferred (alignment) pool first, then the shared master list.
export function _pickUnusedNamePart(
  prefPool: readonly string[] | null | undefined,
  masterPool: readonly string[],
  usedSet: Set<string>,
) {
  for (const pool of [prefPool ?? [], masterPool]) {
    const shuffled = shuffleP(pool);
    for (const x of shuffled) {
      if (!usedSet.has(x)) {
        usedSet.add(x);
        return x;
      }
    }
  }
  return null;
}
// ── SECRET: the wanderer who cannot fall. One neutral hero each game is Garreth the Independent,
// who somehow survives every killing blow. No rules/help text ever mentions him — Easter egg only.
export function _escapesTheEnd(ch: Pick<Character, '_unkillable'> | null | undefined) {
  return !!ch?._unkillable;
}
// The line he slips the blow with: which of its sentences a die picks, here, in its place (the prose writes the words:
// src/views/prose/the-words-of-the-wanderers-escape.ts; plan P1-12d5).
export function _garrethEscapeLine(
  ch: { readonly name?: string | undefined } | null | undefined,
): TheFactOfTheWanderersEscape {
  return {
    kind: 'the wanderer slips a killing blow',
    heroName: ch?.name ?? '',
    whichSentence: Math.floor(kcRng() * THE_NUMBER_OF_WAYS_THE_WANDERER_ESCAPES),
  };
}
export const _usedHeroNames = new Set<string>();
export function _toRoman(n: number) {
  const M = ['', 'X', 'XX', 'XXX'],
    C = ['', 'C', 'CC', 'CCC', 'CD', 'D', 'DC', 'DCC', 'DCCC', 'CM'],
    X = ['', 'X', 'XX', 'XXX', 'XL', 'L', 'LX', 'LXX', 'LXXX', 'XC'],
    I = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
  return (
    String(M[Math.floor(n / 1000)]) +
    String(C[Math.floor((n % 1000) / 100)]) +
    String(X[Math.floor((n % 100) / 10)]) +
    String(I[n % 10])
  );
}
export function nextHeroName(alignment: string) {
  const namePartsOf: NamePartsOfEachAlignment = HERO_NAME_PARTS;
  const parts = namePartsOf[alignment] ?? HERO_NAME_PARTS.Neutral;
  // Unique GIVEN name and unique DESCRIPTOR, tracked globally across the whole game (item: no two
  // characters share a name or a descriptor). Prefer the alignment's flavoured pools, then the
  // shared master lists (all alignments + overflow). Pools are sized well past any hero count.
  let first = _pickUnusedNamePart(parts.firsts, ALL_HERO_FIRSTS, _usedHeroFirsts);
  let ep = _pickUnusedNamePart(parts.epithets, ALL_HERO_EPITHETS, _usedHeroEpithets);
  // Theoretical safety net (never reached while pools exceed the hero count): mint a unique variant
  // by appending a numeral so the FULL name still can't collide.
  if (!first) {
    let n = 2,
      cand: string,
      base = ALL_HERO_FIRSTS[0] ?? 'Wanderer';
    do {
      cand = `${base} ${_toRoman(n)}`;
      n++;
    } while (_usedHeroFirsts.has(cand));
    first = cand;
    _usedHeroFirsts.add(first);
  }
  if (!ep) {
    let n = 2,
      cand: string,
      base = ALL_HERO_EPITHETS[0] ?? 'the Unknown';
    do {
      cand = `${base} ${_toRoman(n)}`;
      n++;
    } while (_usedHeroEpithets.has(cand));
    ep = cand;
    _usedHeroEpithets.add(ep);
  }
  let nm = `${first} ${ep}`;
  if (_usedHeroNames.has(nm)) {
    let n = 2,
      cand: string;
    do {
      cand = `${nm} ${_toRoman(n)}`;
      n++;
    } while (_usedHeroNames.has(cand));
    nm = cand;
  }
  _usedHeroNames.add(nm);
  return nm;
}
export function seedUsedHeroNames(gameState: {
  readonly characters?: readonly ({ readonly name?: string | undefined } | null | undefined)[] | null | undefined;
}) {
  _usedHeroNames.clear();
  _usedHeroFirsts.clear();
  _usedHeroEpithets.clear();
  (gameState.characters ?? []).forEach((c) => {
    if (!c?.name) return;
    _usedHeroNames.add(c.name);
    const sp = c.name.indexOf(' ');
    if (sp > 0) {
      _usedHeroFirsts.add(c.name.slice(0, sp));
      _usedHeroEpithets.add(c.name.slice(sp + 1));
    } else _usedHeroFirsts.add(c.name);
  });
}
// every guardian special's castChance raised +20 (was 30–55%, now 50–75%). 2026-09-15: the share of
// a character's MAXIMUM HP that a single guardian attack may never exceed. Applied silently in
// pcTakeHit to any hit a character takes in a lair fight.
// 2026-10-08 (Toby item 4a): HALF, not a third, and for EVERY hit in personal combat — a guardian on
// a hero, a hero on a guardian, a hero on a hero in a duel. A tighter cap the target already carries
// (GUARDIAN_BODY_CAP_PCT, a cap ward) is applied first and still wins.
export const PC_HIT_CAP_FRAC = 1 / 2;
// 2026-10-08 (Toby item 2): a guardian's melee blow rolls a base that grows with its tier, then adds
// its Melee (+1 a level since 2026-10-14, item 20; a hero's blow adds ⌈Melee ÷ 2⌉) (pcMeleeDamage). Heroes keep 1–3. A special's damage is
// that same blow × the special's weight, so it grows with the tier too.
export const GUARDIAN_MELEE_BASE = { Weak: [1, 3], Moderate: [2, 5], Powerful: [3, 7], Legendary: [4, 9] };
// the mirror of the rule above, pointing the other way — A LEGENDARY CREATURE CANNOT BE FELLED BY
// ONE BLOW. Measured on the 2026-09-15 build, the whole Legendary band collapsed from a 43% hero
// win rate to 97% across a SINGLE rung of hero progression: the rung that first hands out tier-4
// relics. The Vial of the Riven Sky rolls 26–36 damage in one action against an 82 HP Kraken, and
// the great blades hit nearly as hard, so the band was decided by which relic the player happened
// to be carrying rather than by the fight. Capping a single hit at a share of the creature's own
// total blunts exactly that burst and leaves an ordinary sword arm alone, which turns the top band
// back into a long fight. Applied in pcMonsterCombatant and merged as a ward, so a creature that
// already declares a cap of its own (Kraken, Elder Titan) is unaffected.
// Its figure is the guardian perks' content (plan P1-19ai).
export const GUARDIAN_BODY_CAP_PCT = THE_NUMBERS_THE_CODE_WRITES_FOR_A_GUARDIANS_PERKS.theCapOfEachGrade;
// One name for one lair, drawn from the guardian's own pool, never repeated in the world. `used` is
// the live set of names already given out. Falls back to a place-suffixed form
// ("Wolf Den of Karnholt") when a guardian's pools are exhausted, so uniqueness always holds.
// The connectives a place-qualified lair name uses ("Wolf Den beneath Karnholt").
export const LAIR_NAME_CONNECTIVES_P = [
  'of',
  'beneath',
  'under',
  'below',
  'beyond',
  'within',
  'on the marches of',
  'in the shadow of',
  'at the roots of',
  'hard by',
];
// A lair's BASE name: its name without the place qualifier or a number ("Wolf Den beneath Karnholt (2)"
// → "Wolf Den"). 2026-10-13 (item 4, Toby): no province holds two lairs with the same base name.
export function lairBaseNameP(name: string | null | undefined, provName: string | null | undefined) {
  let b = (name ?? '').replace(/ \(\d+\)$/, '');
  if (provName) {
    for (const conn of LAIR_NAME_CONNECTIVES_P) {
      const suf = ` ${conn} ${provName}`;
      if (b.endsWith(suf)) {
        b = b.slice(0, -suf.length);
        break;
      }
    }
  }
  return b;
}
// `provBases` (optional): the base names the lairs already named in this province carry; none of
// them is given again here.
export function pickLairNameP(
  monster: AGuardianAsTheseRead | null | undefined,
  terrain: string | null | undefined,
  used: Set<string>,
  provName: string | null | undefined,
  rnd: (() => number) | null | undefined,
  provBases?: ReadonlySet<string> | null,
) {
  const lairNamesOfAGuardian: Readonly<Record<string, readonly string[] | undefined>> = LAIR_POOLS_MONSTER_P;
  const lairNamesOfACategory: Readonly<Record<string, LairNamesOfACategory | undefined>> = LAIR_POOLS_CAT_P;
  const R = rnd ?? kcRng;
  const here = provBases ?? new Set<string>();
  const isSea = terrain === 'sea';
  const catOrEmpty = monster?.cat ?? '';
  const cat = catOrEmpty || 'beast';
  // (a guardian with no name reads the table at "undefined", as JavaScript does: no guardian has that name)
  const sig = (monster ? lairNamesOfAGuardian[String(monster.name)] : undefined) ?? [];
  const pools = lairNamesOfACategory[cat] ?? LAIR_POOLS_CAT_P.beast;
  const generic = isSea ? (pools.sea ?? []) : (pools.land ?? []);
  // Signature names first (a great power should read as one), then the category pool.
  const ordered = [...sig, ...generic]; // (the tables have no holes, which a filter would have skipped)
  const free = ordered.filter((n) => !used.has(n) && !here.has(n));
  if (free.length) {
    const pick = free[Math.floor(R() * free.length)];
    if (pick === undefined) throw new RangeError('the dice fell outside the names'); // never met: R() is below 1
    used.add(pick);
    return pick;
  }
  // ── 2026-09-15: NO LAIR IS EVER A NUMBERED DUPLICATE ────
  // The old fallback went straight from "this guardian's own pools are exhausted" to `${base} of
  // ${provName}`, and if THAT was taken too it appended "(2)", "(3)"… — which is how "⭐ Chittering
  // Deep of Runedrift (2)" happened. Two lairs in one province with guardians of the same category
  // is entirely ordinary on a large map, so the numbered form was reachable in normal play. There
  // are now three widening steps before a number is even considered, and between them they make a
  // collision vanishingly unlikely:
  //
  // 1. Borrow from EVERY category of the right element (land or sea), not just this guardian's.
  // One guardian's pool is a dozen names; the element's whole stock is a hundred or more.
  // 2. Place-qualify with a VARIED connective — "of", "beneath", "under", "below" and so on —
  // so a second lair in the same province reads as a different place rather than a copy.
  // 3. Qualify a DIFFERENT base name by the same means, which multiplies the two pools together.
  //
  // Only if all of that is exhausted does a number appear, and a world would have to be absurd for
  // it to get that far.
  const elementAll: string[] = [];
  for (const k in lairNamesOfACategory) {
    const pl = lairNamesOfACategory[k] ?? {};
    (isSea ? (pl.sea ?? []) : (pl.land ?? [])).forEach((n2) => {
      if (!elementAll.includes(n2)) elementAll.push(n2);
    });
  }
  const freeAny = elementAll.filter((n2) => !used.has(n2) && !here.has(n2));
  if (freeAny.length) {
    const pick = freeAny[Math.floor(R() * freeAny.length)];
    if (pick === undefined) throw new RangeError('the dice fell outside the names'); // never met: R() is below 1
    used.add(pick);
    return pick;
  }

  // Step 2/3: place-qualify, varying both the connective and the base.
  const CONNECTIVES = LAIR_NAME_CONNECTIVES_P;
  const _allBases = ordered.length ? ordered : elementAll.length ? elementAll : ['Forgotten Lair'];
  // a base this province already holds is never used again here; the wider element stock is
  // borrowed before that rule would ever bend
  let bases = _allBases.filter((b) => !here.has(b));
  if (!bases.length) bases = elementAll.filter((b) => !here.has(b));
  if (!bases.length) bases = _allBases;
  if (provName) {
    for (const conn of CONNECTIVES) {
      for (const b of bases) {
        const cand = `${b} ${conn} ${provName}`;
        if (!used.has(cand)) {
          used.add(cand);
          return cand;
        }
      }
    }
  }
  // True last resort — should be unreachable in any sane world.
  const base = bases[Math.floor(R() * bases.length)];
  // never met: bases is never empty (it falls back to every base, and those to one), and R() is below 1
  if (base === undefined) throw new RangeError('the dice fell outside the names');
  let name = provName ? `${base} of ${provName}` : base;
  let n = 2;
  while (used.has(name)) {
    name = `${provName ? `${base} of ${provName}` : base} (${String(n++)})`;
  }
  used.add(name);
  return name;
}
// A feature as the lair names read it: a ritual site keeps its name; a lair is named from its guardian.
interface AFeatureAsTheseRead {
  name?: string | undefined;
  readonly ritualSite?: boolean | undefined;
  readonly monster?: AGuardianAsTheseRead | null | undefined;
}
interface AProvinceAsTheseRead {
  readonly name: string;
  readonly terrain: string;
  readonly features?: readonly (AFeatureAsTheseRead | null | undefined)[] | null | undefined;
}
// Rename every lair in the world from its guardian's pools, uniquely. Run once at world generation
// (after the regrade pass has settled each lair's guardian) and once as a migration on any older save.
// Ritual sites keep their sacred names — they have no guardian to be thematic about.
export function renameLairsThematicP(
  gs:
    | {
        readonly world?: { readonly provinces?: (AProvinceAsTheseRead | null | undefined)[] | null | undefined } | null;
        _lairNamesV3?: boolean | undefined;
        _lairNamesV2?: boolean | undefined;
      }
    | null
    | undefined,
) {
  if (!gs?.world || !Array.isArray(gs.world.provinces)) return 0;
  const used = new Set<string>();
  gs.world.provinces.forEach((p) => {
    (p?.features ?? []).forEach((f) => {
      if (f?.ritualSite && f.name) used.add(f.name);
    });
  });
  let n = 0;
  gs.world.provinces.forEach((p) => {
    const bases = new Set<string>(); // 2026-10-13 (item 4): one lair per base name in a province
    if (!p) return; // a gap in the map has no features (it read none)
    (p.features ?? []).forEach((f) => {
      if (!f || f.ritualSite || !f.monster) return;
      f.name = pickLairNameP(f.monster, p.terrain, used, p.name, null, bases);
      n++;
      bases.add(lairBaseNameP(f.name, p.name));
    });
  });
  gs._lairNamesV3 = true;
  gs._lairNamesV2 = true;
  return n;
}
export const SEA_GUARDIAN_NAMES = new Set([
  'Sea Serpent',
  'Kraken Spawn',
  'Storm Eagle',
  'Giant Crab',
  'Shark Pack',
  'Reef Piranha Swarm',
  'Drowned Deckhand',
  'Giant Barnacle',
  'Siren',
  'Reef Siren',
  'Sea Hag',
  'Merrow Raider',
  'Anglerfish Horror',
  'Electric Eel Swarm',
  'Pirate Captain',
  'Ghost Galleon Crew',
  'Deep One Priest',
  'Abyssal Horror',
  'Leviathan',
  'Deep Leviathan',
  'Leviathan Young',
  'Drowned Oarsman',
  'Stinging Jellyfish Bloom',
  'Wreck Moray',
  'Smuggler Lookout',
  'Drowned Bosun',
  'Sea Troll',
  'Giant Sea Turtle',
  "Wreckers' Gang",
  'Drowned Admiral',
  'Sea Wyrm',
  'Giant Octopus',
  'Kraken',
]);
export const MONSTER_CAT_ITEM_USE = {
  humanoid: 'all',
  undead: 'all',
  giant: 'all',
  fiend: 'all',
  fey: 'trinket',
  dragon: 'trinket',
  beast: 'none',
  vermin: 'none',
  aberration: 'none',
  elemental: 'none',
  construct: 'none',
};
export const _TRINKET_SLOTS = new Set(['ring', 'amulet', 'cloak', 'helm', 'combat']); // combat items added 2026-09-11 as 'consumable' (they had no slot before, so were always wieldable); renamed to the Combat Item slot 2026-09-14
export function monsterCat(m: AGuardianAsTheseRead | null | undefined) {
  if (m?.cat) return m.cat;
  const n = (m?.name ?? '').toLowerCase();
  if (
    /lich|skelet|zombie|wraith|ghoul|vampir|bone|death knight|undead|ghost|spectr|drowned|wight|mumm|banshee|dracolich/.test(
      n,
    )
  )
    return 'undead';
  if (/demon|devil|fiend|hell|chaos|brimstone|imp\b|archdemon/.test(n)) return 'fiend';
  if (/dragon|wyrm|wyvern|drake|hydra/.test(n)) return 'dragon';
  if (/giant|troll|ogre|titan/.test(n) && !/giant (rat|wasp|spider|centipede|crab|barnacle|toad|sea|octopus)/.test(n))
    return 'giant';
  if (/golem|sentinel|construct|statue/.test(n)) return 'construct';
  if (/harpy|sprite|siren|hag|pixie|dryad/.test(n)) return 'fey';
  if (/rat|wasp|bat|spider|centipede|piranha|barnacle|crab|leech|mite|jellyfish|swarm/.test(n)) return 'vermin';
  if (/kraken|horror|octopus|abyssal/.test(n)) return 'aberration';
  if (/elemental|devil\b/.test(n)) return 'elemental';
  if (
    /goblin|bandit|cutthroat|assassin|kobold|pirate|merrow|priest|scout|hobgoblin|orc|gnoll|minotaur|shaman|smuggler|wrecker|medusa|warlord|captain|deckhand/.test(
      n,
    )
  )
    return 'humanoid';
  return 'beast';
}
