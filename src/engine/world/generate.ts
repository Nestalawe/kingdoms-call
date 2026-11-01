// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { BARROW_NAMES, HOLY_SITE_NAMES, HOLY_SITE_SHARE_OF_LAND, SITE_SHARE_OF_LAND } from '../alignment-prototypes.ts';
import {
  KC_HUMANOID_RACES,
  KC_RIVAL_RACE,
  KC_UNIT_CLASS,
  MONSTERS_P,
  PRIMAL_ARMY_DEFS_P,
  PRIMAL_UNIT_NAMES,
  PROVINCE_ARMIES_P,
} from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';
import { UNIT_Q_MULT } from '../rules-on-plain-values/unit-types-and-base-strength.ts';
import { HOME_FLEET_BY_RACE } from '../grand-design.ts';
import {
  COASTAL_NAVAL_CHANCE,
  HUMANOID_FLEET_TYPES,
  HUMANOID_RACES_GEN,
  PRIMAL_LAND_CHANCE,
  RACES_P,
  SEA_TYPES_GEN,
  SIGNATURE_TERRAIN_P,
  SIGNATURE_WEIGHT_P,
  TEMPERS_P,
  buildHumanoidPool,
  fullRaceLandRoster,
  provincePoolSize,
} from './tables.ts';
import { getDruidLevel } from '../rules-on-plain-values/beasts-a-hero-may-lead-and-the-druid-each-unit-needs.ts';
import { ALIGNMENTS_P } from '../rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import { ABILITIES_P, shuffleP } from '../battle/fortune.ts';
import {
  SEA_GUARDIAN_NAMES,
  _usedHeroEpithets,
  _usedHeroFirsts,
  _usedHeroNames,
  nextHeroName,
  renameLairsThematicP,
} from '../names.ts';
import {
  FEATURE_POOLS_P,
  ITEMS_BY_TIER,
  RITUAL_SITE_CHANCE_HUMANOID,
  RITUAL_SITE_NAMES,
} from '../items/tiers-and-hoards.ts';
import { ensureAllLairHoards } from '../items/lair-items.ts';
import { discoverFeat } from '../sight/heroes-in-sight-features-discovered-and-army-size-bands.ts';
import { GUARDIAN_TABLE_VER, computeMaxHp, maxHpPlayers } from '../heroes/skills-and-hp.ts';
import { grantMithrilToDwarves } from '../personal-combat/helpers.ts';
import { bestNeutralMix, neutralDefCount, rP, resyncNeutralDefenders } from '../units/drill-and-spoils.ts';
import { armyUnitName } from '../dice-and-army-names.ts';
import { REALM_COLOURS, REALM_COLOUR_FALLBACK } from '../bots/intel.ts';
import { getNeighborsP } from './map-helpers.ts';
import { LAIR_TIER_ROLL, assignLairGrades } from '../chances-and-lair-grades.ts';

// ── SEA SHARE (2026-09-25, Toby) ── the GM picks what share of the world is water, 20–80%.
// Before this the fill rolled sea at 28% (55% beside water) and the result was whatever came out:
// measured over 20 worlds per rung it averaged ~33% and ranged 18–50% on the same settings. The
// share is now EXACT (rounded to a province): the same clustered fill lays out coherent seas, then
// coasts are grown or shrunk until the count matches. Home cells and their tailored rings are never
// touched, so every home guarantee (≤2 sea neighbours, a poor and a prosperous land, a sea for a
// naval king) holds at any share.
export const SEA_PCT_MIN = 20,
  SEA_PCT_MAX = 80,
  SEA_PCT_DEFAULT = 35;
export function normSeaPct(v) {
  v = parseInt(v);
  if (!Number.isFinite(v)) v = SEA_PCT_DEFAULT;
  return Math.max(SEA_PCT_MIN, Math.min(SEA_PCT_MAX, v));
}
export function generateNewGame(setupPlayers, sz, maxTurns, genOpts) {
  const { cols, rows } = sz;
  const provinces = [];
  const seaPct = normSeaPct(genOpts && genOpts.seaPct);
  const seaTarget = seaPct / 100;
  const nameSet = new Set();
  // Fresh world → fresh name pools (a GM generating a second game in one session must not inherit
  // the first game's used given-names / descriptors).
  _usedHeroNames.clear();
  _usedHeroFirsts.clear();
  _usedHeroEpithets.clear();
  // SECRET Easter egg: reserve 'Garreth the Independent' BEFORE any hero is named, so no king or
  // starting/neutral hero can grab that given name or descriptor (item: unique names). A neutral
  // LAND province is chosen for him in the neutral-hero pass below.
  _usedHeroFirsts.add('Garreth');
  _usedHeroEpithets.add('the Independent');
  _usedHeroNames.add('Garreth the Independent');

  // Ritual sites (the old faith's standing stones) are only usable by a Pagan realm's Perform Rite.
  // With no Pagan player in the game they are dead weight — nobody can ever use them — so we
  // suppress them entirely at world gen. See the ritual-site block in the feature pass below.
  const hasPaganPlayer = setupPlayers.some((sp) => sp.alignment === 'Pagan');
  // PROTOTYPE (alignment ideas round 1): holy sites for a Divine realm and barrows for an Undead realm, when the kit is
  // on and such a realm plays (src/engine/alignment-prototypes.ts).
  const _protoList =
    genOpts && Array.isArray(genOpts.alignmentPrototypes) ? genOpts.alignmentPrototypes.filter(Boolean) : [];
  const hasHolySites = _protoList.includes('Divine') && setupPlayers.some((sp) => sp.alignment === 'Divine');
  const hasBarrows = _protoList.includes('Undead') && setupPlayers.some((sp) => sp.alignment === 'Undead');

  // Hex neighbour offsets + helpers (defined up front — king placement below needs them).
  const offEven = [
    [-1, -1],
    [-1, 0],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
  ];
  const offOdd = [
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, 0],
    [1, 1],
  ];
  const cellIdRC = (r, c) => r * cols + c;
  const neighbourCells = (r, c) => {
    const offs = r % 2 === 0 ? offEven : offOdd;
    return offs
      .map(([dr, dc]) => {
        const nr = r + dr;
        if (nr < 0 || nr >= rows) return null;
        const nc = (((c + dc) % cols) + cols) % cols;
        return { r: nr, c: nc, id: cellIdRC(nr, nc) };
      })
      .filter(Boolean);
  };
  const cellDistRC = (a, b) => {
    let dc = Math.abs(a.c - b.c);
    dc = Math.min(dc, cols - dc);
    const dr = Math.abs(a.r - b.r);
    return Math.max(dc, dr, (dc + dr) >> 1);
  };
  const navalLevelOf = (sp) => {
    let lvl = 0;
    if (sp && sp.skills)
      Object.entries(sp.skills).forEach(([k, v]) => {
        if ((k || '').toLowerCase() === 'naval') lvl += v;
      });
    return lvl;
  };
  const pickLand = () => {
    const t = ['plain', 'forest', 'mountain', 'desert', 'jungle'];
    return t[Math.floor(kcRng() * t.length)];
  };

  // ── THEMATIC PROVINCE NAMING ── Names are assigned in a dedicated pass AFTER the map is fully
  // populated (terrain, race and recruitable armies all final, including king home provinces), so
  // each province gets a name that fits both its people and its land — e.g. an Elven forest reads
  // very differently from an Orcish desert or a kraken-haunted deep.
  const NAME_PREFIX_BY_RACE = {
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
  const NAME_PREFIX_PRIMAL = [
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
  const NAME_SUFFIX_BY_TERRAIN = {
    plain: ['field', 'meadow', 'march', 'moor', 'hold', 'reach', 'down', 'wold', 'stead', 'heath', 'vale', 'ridge'],
    forest: ['wood', 'grove', 'thicket', 'hollow', 'glade', 'shaw', 'copse', 'weald', 'briar', 'root', 'leaf', 'fen'],
    mountain: ['peak', 'crag', 'spire', 'fell', 'cairn', 'tor', 'height', 'ridge', 'deep', 'delve', 'pass', 'stone'],
    desert: [
      'dune',
      'waste',
      'sands',
      'drift',
      'mesa',
      'scar',
      'barrens',
      'reach',
      'flats',
      'scree',
      'wells',
      'expanse',
    ],
    jungle: ['tangle', 'vale', 'verge', 'canopy', 'mire', 'delve', 'green', 'deep', 'vines', 'hollow', 'rot', 'fen'],
  };
  const NAME_SEA_BY_TYPE = {
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
  const pickFrom = (arr) => arr[Math.floor(kcRng() * arr.length)];
  const toRoman = (n) => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][n] || '' + n;
  const themedName = (p) => {
    if (p.terrain === 'sea') {
      let kind = 'open';
      if (p.race === 'Primal:Whale') kind = 'whale';
      else if (p.race === 'Primal:Shark') kind = 'shark';
      else if (p.race && p.race.startsWith('Primal:')) kind = 'primal';
      const pool = NAME_SEA_BY_TYPE[kind];
      return pickFrom(pool.pre) + pickFrom(pool.suf);
    }
    // Land: prefix reflects the people (or wild primal beasts), suffix reflects the terrain.
    const prePool =
      p.race && p.race.startsWith('Primal:')
        ? NAME_PREFIX_PRIMAL
        : NAME_PREFIX_BY_RACE[p.race] || NAME_PREFIX_BY_RACE.Human;
    const sufPool = NAME_SUFFIX_BY_TERRAIN[p.terrain] || NAME_SUFFIX_BY_TERRAIN.plain;
    return pickFrom(prePool) + pickFrom(sufPool);
  };
  const nameAllProvinces = () => {
    provinces.forEach((p) => {
      let name,
        tries = 0;
      do {
        name = themedName(p);
        tries++;
      } while (nameSet.has(name) && tries < 50);
      if (nameSet.has(name)) {
        let k = 2;
        while (nameSet.has(name + ' ' + toRoman(k))) k++;
        name = name + ' ' + toRoman(k);
      }
      nameSet.add(name);
      p.name = name;
    });
  };

  // ── PHASE 1: choose each king's HOME CELL first, as equidistant as possible ── Placing homes
  // before any terrain is decided lets us control player spacing directly rather than leaving it to
  // chance. Eligible cells exclude the top and bottom rows, so no king ever starts on the north or
  // south edge of the world. We build several candidate layouts by farthest-point placement and
  // keep the most spread-out one, so spacing is reliable (the player caps per map size assume this
  // — see MAP_MAX_PLAYERS in the setup form).
  const eligibleCells = [];
  for (let r = 1; r <= rows - 2; r++) for (let c = 0; c < cols; c++) eligibleCells.push({ r, c, id: cellIdRC(r, c) });
  const buildLayout = () => {
    const hc = [eligibleCells[Math.floor(kcRng() * eligibleCells.length)]]; // first king: random
    while (hc.length < setupPlayers.length) {
      // Farthest-point: pick the eligible cell whose NEAREST chosen king is as far away as
      // possible. Collect ALL cells that tie for the best distance and choose one at random.
      // Without this the scan order (row-first) always breaks ties toward the same rows, which —
      // combined with the horizontal map wrap — jams every king onto the top and bottom eligible
      // rows.
      let bestCells = [],
        bestMin = -1;
      for (const cell of eligibleCells) {
        if (hc.some((h) => h.id === cell.id)) continue;
        let minD = Infinity;
        for (const h of hc) {
          const d = cellDistRC(cell, h);
          if (d < minD) minD = d;
        }
        if (minD > bestMin) {
          bestMin = minD;
          bestCells = [cell];
        } else if (minD === bestMin) {
          bestCells.push(cell);
        }
      }
      hc.push(
        bestCells.length
          ? bestCells[Math.floor(kcRng() * bestCells.length)]
          : eligibleCells[Math.floor(kcRng() * eligibleCells.length)],
      );
    }
    return hc;
  };
  const layoutMinDist = (hc) => {
    let ms = Infinity;
    for (let a = 0; a < hc.length; a++)
      for (let b = a + 1; b < hc.length; b++) {
        const d = cellDistRC(hc[a], hc[b]);
        if (d < ms) ms = d;
      }
    return hc.length < 2 ? Infinity : ms;
  };
  // HARD FLOOR: a minimum spacing of 4 hexes — i.e. at least 3 empty ("neutral") provinces between
  // every pair of capitals. The map ladder (sizemap) is sized so this is reliably achievable at
  // each player count.
  const KING_MIN_SPACING = 4; // >=3 neutral hexes between capitals
  // 2026-09-27 (Toby item 1): capitals are now placed as FAR APART AS THE MAP ALLOWS, not merely
  // "far enough". The previous pass drew up to 1,200 farthest-point layouts, kept every one that
  // reached the floor of 4, and then chose among them AT RANDOM — so a world that could have seated
  // its kings 6 hexes apart routinely seated them at 4, and the spread was uneven because only the
  // single tightest pair was ever looked at. Three changes:
  //   1. SCORED, not merely floor-tested. `layoutScore` is a lexicographic triple —
  //      [minimum pairwise distance, −(number of pairs sitting at that minimum), Σ each king's
  //      nearest-neighbour distance]. The first term is the guarantee, the second breaks up
  //      crowding, and the third rewards an even spread once the tight pairs are settled.
  //   2. REFINED by hill-climbing (`refineLayout`): each king in turn is offered every free
  //      eligible cell and moved wherever the score improves, sweeping until nothing improves.
  //      Farthest-point placement is greedy and its random first seed routinely costs it a hex or
  //      two; the climb recovers that, and it is what makes the result even rather than merely
  //      spread. Sweeps are capped so world gen stays quick.
  //   3. The BEST-scoring refined layout wins, with a random draw only among EXACT ties — row
  //      variety is kept without paying for it in spacing.
  // `cellDistRC` is a lower bound on the true hex distance (max(|dc|,|dr|,(|dc|+|dr|)/2) on the
  // wrapped offset grid), so a layout accepted here is never closer than the floor in reality.
  const layoutScore = (hc) => {
    const n = hc.length;
    if (n < 2) return [Infinity, 0, Infinity];
    let mn = Infinity,
      nAtMin = 0;
    const near = new Array(n).fill(Infinity);
    for (let a = 0; a < n; a++)
      for (let b = a + 1; b < n; b++) {
        const d = cellDistRC(hc[a], hc[b]);
        if (d < near[a]) near[a] = d;
        if (d < near[b]) near[b] = d;
        if (d < mn) {
          mn = d;
          nAtMin = 1;
        } else if (d === mn) nAtMin++;
      }
    let nnSum = 0;
    for (let i = 0; i < n; i++) nnSum += near[i];
    return [mn, -nAtMin, nnSum];
  };
  const scoreCmp = (x, y) => {
    for (let i = 0; i < x.length; i++) {
      if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
    }
    return 0;
  };
  const HOME_REFINE_SWEEPS = 6;
  const refineLayout = (hc) => {
    let cur = hc.slice(),
      curS = layoutScore(cur);
    if (cur.length < 2) return [cur, curS];
    for (let sweep = 0; sweep < HOME_REFINE_SWEEPS; sweep++) {
      let moved = false;
      for (let k = 0; k < cur.length; k++) {
        const taken = new Set(cur.map((h) => h.id));
        let bestCell = null,
          bestS = curS;
        for (const cell of eligibleCells) {
          if (taken.has(cell.id)) continue;
          const keep = cur[k];
          cur[k] = cell;
          const s = layoutScore(cur);
          cur[k] = keep;
          if (scoreCmp(s, bestS) > 0) {
            bestS = s;
            bestCell = cell;
          }
        }
        if (bestCell) {
          cur[k] = bestCell;
          curS = bestS;
          moved = true;
        }
      }
      if (!moved) break;
    }
    return [cur, curS];
  };
  // Seeds: a handful of refined layouts is worth far more than a thousand raw ones, but on an
  // undersized custom map keep drawing (raw, unrefined, which is cheap) until something reaches the
  // floor before spending the refinement budget.
  const HOME_SEEDS = 10;
  const _cands = [];
  for (let att = 0; att < HOME_SEEDS; att++) _cands.push(refineLayout(buildLayout()));
  if (!_cands.some((x) => isFinite(x[1][0]) && x[1][0] >= KING_MIN_SPACING)) {
    for (let att = 0; att < 400; att++) {
      const raw = buildLayout();
      if (layoutMinDist(raw) >= KING_MIN_SPACING) {
        _cands.push(refineLayout(raw));
        break;
      }
    }
  }
  const _best = _cands.reduce((b, x) => (b == null || scoreCmp(x[1], b) > 0 ? x[1] : b), null);
  const _acceptable = _cands.filter((x) => scoreCmp(x[1], _best) === 0);
  const _pick = _acceptable.length ? _acceptable[Math.floor(kcRng() * _acceptable.length)] : _cands[0];
  let homeCells = _pick[0],
    homeMin = _pick[1][0];
  if (!(homeMin >= KING_MIN_SPACING))
    console.warn(
      `World gen: no home layout on a ${cols}x${rows} map keeps ${KING_MIN_SPACING} hexes between all ${setupPlayers.length} capitals (best ${homeMin}) — the map is too small for this many realms.`,
    );
  const homeIdSet = new Set(homeCells.map((h) => h.id));

  // ── PHASE 2: tailor each king's home NEIGHBOURHOOD ── Pre-assign terrain (and a tax band) to
  // specific ring cells so every home satisfies its rules:
  // >=2 adjacent land, >=1 poor (tax 2-3) land, >=1 prosperous (tax 4-6) land, and >=1 adjacent
  // sea IF that king started with Naval>=1. Everything else is filled by the general rule.
  // constraint[id] = { terrain, taxBand:'poor'|'prosperous'|null, isHome:bool }
  const constraint = {};
  // Sea cap: a home never borders more than HOME_MAX_SEA sea provinces. Every free ring cell is
  // decided HERE (sea at the general-fill base rate while under the cap, land otherwise) rather
  // than left to the random fill, so the cap is exact. The open-water guarantee for coastal homes
  // is applied after the sea post-pass below (see "home coastal guarantee").
  // 2026-09-25: the cap rises with the sea share — 3 from 60%, 4 from 70% — or a drowned world could
  // not be built: every home ring pinned at ≥4 land held the reachable share to ~70% (measured).
  // The ring still always holds the poor AND the prosperous land the home rules demand, so ≥2 land
  // neighbours survive at any share.
  const HOME_MAX_SEA = seaPct >= 70 ? 4 : seaPct >= 60 ? 3 : 2;
  // The fill's two rates scale with the chosen share: 0.28 / 0.55 were the old fixed figures, which
  // are exactly what a 40% target gives here (0.7× and 1.375× the share), so the shape of the seas is
  // unchanged at the old rates and simply seeds more or less water at other shares.
  const SEA_BASE_RATE = Math.min(0.9, seaTarget * 0.7),
    SEA_CLUSTER_RATE = Math.min(0.95, seaTarget * 1.375);
  // Ring cells roll at the fill's base rate; from 60% (where the cap opens) at its cluster rate, so a
  // drowned world's homes are island capitals rather than the one dry patch holding the share back.
  const HOME_RING_SEA_CHANCE = seaPct >= 60 ? SEA_CLUSTER_RATE : SEA_BASE_RATE;
  homeCells.forEach((home, ki) => {
    constraint[home.id] = { terrain: pickLand(), taxBand: null, isHome: true }; // home is land (race/pool set later)
    const ringAll = neighbourCells(home.r, home.c).filter((n) => !homeIdSet.has(n.id));
    let seaCount = ringAll.filter((n) => constraint[n.id] && constraint[n.id].terrain === 'sea').length; // pre-set by an overlapping ring
    const ring = ringAll.filter((n) => !constraint[n.id]); // free cells only
    const shuffled = shuffleP(ring);
    let i = 0;
    if (navalLevelOf(setupPlayers[ki]) >= 1 && i < shuffled.length && seaCount < HOME_MAX_SEA) {
      constraint[shuffled[i].id] = { terrain: 'sea', taxBand: null };
      i++;
      seaCount++;
    }
    if (i < shuffled.length) {
      constraint[shuffled[i].id] = { terrain: pickLand(), taxBand: 'poor' };
      i++;
    } // one poor land
    if (i < shuffled.length) {
      constraint[shuffled[i].id] = { terrain: pickLand(), taxBand: 'prosperous' };
      i++;
    } // one prosperous land
    for (; i < shuffled.length; i++) {
      if (seaCount < HOME_MAX_SEA && kcRng() < HOME_RING_SEA_CHANCE) {
        constraint[shuffled[i].id] = { terrain: 'sea', taxBand: null };
        seaCount++;
      } else constraint[shuffled[i].id] = { terrain: pickLand(), taxBand: null };
    }
  });

  // ── PHASE 3: generate every province ── Primal land provinces split evenly Creature / Monster.
  // We alternate deterministically (rather than a per-province coin-flip) so the count comes out
  // exactly half-and-half; parity is seeded randomly so it isn't always Creature-first. "Primal"
  // stays the internal umbrella — players only ever see the Creature / Monster label (see
  // formatRace / primalClass in the player portal).
  let _primalCreatureNext = kcRng() < 0.5;
  // Non-primal land provinces are split EXACTLY equally between the four humanoid races. A plain
  // per-province random draw drifted several provinces off even on a normal map, which visibly
  // favoured one race's units. Instead we deal from a repeatedly-reshuffled four-card deck: within
  // every block of four humanoid provinces each race appears once, so the totals can never differ
  // by more than the length of the final partial block.
  let _raceDeck = [];
  // Provisional race, replaced wholesale by the terrain-weighted allocation pass below. The pass
  // needs every province's terrain decided first, so the loop cannot make the final call itself.
  const nextHumanoidRace = () => {
    if (_raceDeck.length === 0) _raceDeck = shuffleP(RACES_P);
    return _raceDeck.pop();
  };
  // ── TERRAIN PRE-PASS: every cell's terrain is decided here, BEFORE the province loop, so the sea
  // share can be corrected to the exact target while nothing (tax, race, features) yet depends on it.
  // 1. Tailored cells take their Phase-2 terrain. 2. Free cells: the clustered fill — sea at the base
  // rate, or the cluster rate when the cell to the left or above is already water, so seas form
  // coherent lakes and coastlines rather than scattered hexes. 3. Grow or shrink the coasts among
  // FREE cells only until the sea count equals round(share × cells): too little water → a random
  // land cell touching sea becomes sea (a fresh lake is seeded only if no coast exists); too much →
  // a random sea cell touching land becomes land. Coherence survives because every change is made
  // at an existing shoreline.
  const terrainGrid = new Array(rows * cols);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const id = row * cols + col;
      const con = constraint[id];
      if (con) {
        terrainGrid[id] = con.terrain;
        continue;
      }
      const leftSea = col > 0 && terrainGrid[row * cols + (col - 1)] === 'sea';
      const upSea = row > 0 && terrainGrid[(row - 1) * cols + col] === 'sea';
      terrainGrid[id] = kcRng() < (leftSea || upSea ? SEA_CLUSTER_RATE : SEA_BASE_RATE) ? 'sea' : pickLand();
    }
  }
  {
    const freeIds = [];
    for (let id = 0; id < rows * cols; id++) if (!constraint[id]) freeIds.push(id);
    const nbrIds = (id) => neighbourCells(Math.floor(id / cols), id % cols).map((n) => n.id);
    const seaCount = () => terrainGrid.filter((t) => t === 'sea').length;
    const want = Math.round(seaTarget * rows * cols);
    let guard = 0;
    while (seaCount() < want && guard++ < rows * cols * 4) {
      let pool = freeIds.filter((id) => terrainGrid[id] !== 'sea' && nbrIds(id).some((n) => terrainGrid[n] === 'sea'));
      if (!pool.length) pool = freeIds.filter((id) => terrainGrid[id] !== 'sea'); // no shoreline at all: seed a lake
      if (!pool.length) break; // every free cell is already water
      terrainGrid[pool[Math.floor(kcRng() * pool.length)]] = 'sea';
    }
    guard = 0;
    while (seaCount() > want && guard++ < rows * cols * 4) {
      let pool = freeIds.filter((id) => terrainGrid[id] === 'sea' && nbrIds(id).some((n) => terrainGrid[n] !== 'sea'));
      if (!pool.length) pool = freeIds.filter((id) => terrainGrid[id] === 'sea');
      if (!pool.length) break; // only tailored sea is left (a naval king's harbour)
      terrainGrid[pool[Math.floor(kcRng() * pool.length)]] = pickLand();
    }
    const got = seaCount();
    if (got !== want)
      console.warn(
        `World gen: sea share ${seaPct}% asked for ${want} sea provinces on ${cols}x${rows}; the home neighbourhoods fix ${rows * cols - freeIds.length} cells, so ${got} was the nearest reachable.`,
      );
  }
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const id = row * cols + col;
      let taxOverride = null;
      const terrain = terrainGrid[id];
      const con = constraint[id];
      if (con) {
        // Home / tailored-neighbour cell: terrain (and sometimes tax band) was decided in Phase 2.
        if (con.taxBand === 'poor')
          taxOverride = rP(2, 3); // Poor = 2-3 (2026-09-21: no province is ever tax 1)
        else if (con.taxBand === 'prosperous') taxOverride = rP(4, 6); // Prosperous = 3-6; capped at 6 so this band never leaks into the Rich tier (tax>=7)
      }
      const baseTax =
        taxOverride != null
          ? taxOverride
          : {
              plain: rP(4, 9),
              desert: rP(2, 4),
              forest: rP(3, 7),
              jungle: rP(2, 6),
              mountain: rP(3, 7),
              sea: rP(0, 2),
            }[terrain];
      // PRIMAL_LAND_CHANCE of LAND provinces are Primal (non-humanoid), split evenly Creature /
      // Monster. Each such province recruits exactly ONE unit type — a single wild unit makes these
      // provinces special. Sea is never Primal at this stage (the sea post-pass below assigns sea
      // beasts separately).
      const isPrimal = terrain !== 'sea' && kcRng() < PRIMAL_LAND_CHANCE;
      let race,
        primalUnit = null;
      if (terrain === 'sea') {
        race = null;
      } else if (isPrimal) {
        // Alternate Creature / Monster for an exact half-and-half count across the map.
        const wantCreature = _primalCreatureNext;
        _primalCreatureNext = !_primalCreatureNext;
        // One terrain-appropriate unit per class. Every unit here is classified by the engine's
        // CREATURE_ARMIES / MONSTER_ARMIES sets (Druidic favours Creatures, Evil favours Monsters).
        // 2026-10-13 (Creatures and Monsters IV): Great Bears in forest and mountain, Unicorn Herd on the plain
        // and in the forest, Mammoth Host on the plain and in the desert. (CBT, the alignment pass's copy, must match.)
        const CREATURE_BY_TERRAIN = {
          plain: ['Thunderbirds', 'Stone Giants', 'Unicorn Herd', 'Mammoth Host'],
          desert: ['Stone Giants', 'Thunderbirds', 'Mammoth Host'],
          forest: ['Forest Ents', 'Thunderbirds', 'Great Bears', 'Unicorn Herd'],
          jungle: ['Forest Ents'],
          mountain: ['Stone Giants', 'Crimson Rocs', 'Thunderbirds', 'Great Bears'],
        };
        const MONSTER_BY_TERRAIN = {
          plain: ['Titan Warbeasts', 'Manticore Pride'],
          desert: ['Manticore Pride', 'Basilisk Brood'],
          forest: ['Cave Trolls', 'Basilisk Brood', 'Dread Hydras'],
          jungle: ['Basilisk Brood', 'Cave Trolls', 'Manticore Pride', 'Dread Hydras'],
          mountain: ['Cave Trolls', 'Elder Dragons'],
        };
        const pool =
          (wantCreature ? CREATURE_BY_TERRAIN : MONSTER_BY_TERRAIN)[terrain] ||
          (wantCreature ? ['Stone Giants'] : ['Cave Trolls']);
        primalUnit = pool[Math.floor(kcRng() * pool.length)];
        // Province race carries the singular sub-race noun (e.g. 'Primal:Stone Giant'); the player
        // portal maps that to "Creature (Stone Giant)" / "Monster (Cave Troll)" and never shows
        // "Primal".
        race = 'Primal:' + (PRIMAL_ARMY_DEFS_P[primalUnit]?.race || primalUnit);
      } else {
        race = nextHumanoidRace();
      }
      const population = terrain === 'sea' ? 0 : rP(1, 6);
      // Build army pool — primal provinces recruit their single wild unit; all others use the pool.
      let fullPool;
      if (primalUnit) {
        fullPool = [primalUnit];
      } else if (terrain === 'sea') {
        // Sea army pools are decided later by the province's sea TYPE (Primal / Whale / open
        // water), so leave it empty here — the sea post-processing pass sets armyTypes
        // definitively.
        fullPool = [];
      } else {
        // Regular land province: pull army types for this terrain + race
        fullPool = (PROVINCE_ARMIES_P[terrain] || {})[race] || ['Shieldwall Levies'];
      }
      // Randomise the available army pool: every humanoid province offers 2-3 recruitable unit
      // types IN ADDITION to its race's garrison unit (which is always available). Primal provinces
      // have a single wild unit and are capped by the size of their own pool.
      // (The king's home province gets its full racial pool restored separately.)
      let armyPool;
      if (HUMANOID_RACES_GEN.has(race)) {
        const hp = buildHumanoidPool(terrain, race, provincePoolSize(kcRng), kcRng); // provisional: the race-allocation pass below rebuilds it the same way (item 15: 2 or 3 types; home restores its full roster separately)
        armyPool = [...hp.types, ...hp.garrison];
      } else {
        // Primal (single wild unit) and sea provinces keep whatever their pool already holds.
        const nonGarrison = fullPool.filter((t) => !t.toLowerCase().includes('garrison'));
        const garrison = fullPool.filter((t) => t.toLowerCase().includes('garrison'));
        const poolCount = Math.min(nonGarrison.length, rP(2, 3));
        const shuffled = shuffleP(nonGarrison).slice(0, poolCount);
        armyPool = [...shuffled, ...garrison];
      }
      // Features (land provinces only): 2-4 explorable features each. Difficulty weighting for a
      // new lair — see LAIR DIFFICULTY below.
      const features = [];
      if (terrain !== 'sea') {
        const pool = FEATURE_POOLS_P[terrain] || FEATURE_POOLS_P.plain;
        const fcount = rP(2, 4);
        const used = new Set();
        for (let fi = 0; fi < fcount; fi++) {
          let fname,
            tries = 0;
          do {
            fname = pool[Math.floor(kcRng() * pool.length)];
            tries++;
          } while (used.has(fname) && tries < 20);
          used.add(fname);
          // Land features: exclude EVERY sea guardian so land lairs never get sea beasts.
          const landMonsters = MONSTERS_P.filter((m) => !SEA_GUARDIAN_NAMES.has(m.name));
          // ── LAIR DIFFICULTY ────
          // A lair now HAS a difficulty of its own, rolled first, and its guardian is drawn from
          // the beasts of that same standing. The tier is stored on the feature as `tier`, so the
          // difficulty shown never depends on whether the guardian has been identified yet.
          // Weighted toward the easier end: most country holds modest dangers.
          const _tier = LAIR_TIER_ROLL();
          const _pool = landMonsters.filter((mm) => mm.power === _tier);
          const _from = _pool.length ? _pool : landMonsters.length ? landMonsters : MONSTERS_P;
          const m = { ..._from[Math.floor(kcRng() * _from.length)] };
          features.push({
            name: fname,
            tier: m.power || _tier,
            monster: { ...m },
            discovered: false,
            cleared: false,
            treasure: Math.max(1, Math.round(rP(1, 10) * (0.4 + kcRng() * 0.6))),
          });
        }
        // ── PAGAN: ritual sites ── Standing stones of the old gods, where Pagan characters may
        // Perform Rites. Weighted heavily toward Primal country — the old faith lingers where the
        // wild things rule — which gives Pagans a reason to want the one terrain nobody else does.
        // ritualSite features carry NO guardian monster and are never "cleared"; discovery works
        // like any other feature
        // (Explore thresholds). Non-Pagans can find them; only Pagans can use them. Skipped entirely
        // when no player is Pagan, so a Pagan-less game is never littered with unusable sites.
        // 2026-09-07 batch 3: EVERY primal (creature or monster) land province holds a ritual site
        // — both rites can be performed there. 25% of humanoid land provinces also hold one, but
        // with no wild creatures to bind only the Blood Offering is possible there (the Wild Hunt
        // option is gated on the province's primal armyTypes in both the order form and the
        // engine).
        if (hasPaganPlayer && (isPrimal || kcRng() < RITUAL_SITE_CHANCE_HUMANOID)) {
          features.push({
            name: RITUAL_SITE_NAMES[Math.floor(kcRng() * RITUAL_SITE_NAMES.length)],
            ritualSite: true,
            monster: null,
            discovered: false,
            cleared: false,
            treasure: 0,
          });
        }
        // PROTOTYPE: a holy site (Divine, one land province in five since round 2) or a barrow (Undead, one in seven); a site like the
        // stones for finding and showing (ritualSite), set apart by siteKind so no rite answers there.
        if (hasHolySites && kcRng() < HOLY_SITE_SHARE_OF_LAND) {
          features.push({
            name: HOLY_SITE_NAMES[Math.floor(kcRng() * HOLY_SITE_NAMES.length)],
            ritualSite: true,
            siteKind: 'holy',
            monster: null,
            discovered: false,
            cleared: false,
            treasure: 0,
          });
        }
        if (hasBarrows && kcRng() < SITE_SHARE_OF_LAND) {
          features.push({
            name: BARROW_NAMES[Math.floor(kcRng() * BARROW_NAMES.length)],
            ritualSite: true,
            siteKind: 'barrow',
            monster: null,
            discovered: false,
            cleared: false,
            treasure: 0,
          });
        }
      }
      // Neutral defenders
      let neutralDefenders = [];
      if (terrain !== 'sea') {
        const isPrimalProv = race && race.startsWith('Primal:');
        // Neutral army count by wealth tier — Rich 3-4 / Prosperous 2-3 / Poor 1-2. Applies to
        // humanoid AND primal land alike; primal quality still leans Veteran below.
        const dc = neutralDefCount(baseTax);
        const defQuality = isPrimalProv ? (kcRng() < 0.5 ? 'Veteran' : 'Average') : 'Average';
        // Starting neutral defenders draw only from NON-Garrison army types (garrisons stay in
        // armyTypes so they remain recruitable once the province is owned, but no neutral army
        // begins the game as a Garrison unit). Fall back to the full pool only if a province
        // somehow has garrison-only types.
        const defenderPool = armyPool.filter((t) => !t.toLowerCase().includes('garrison'));
        const drawPool = defenderPool.length > 0 ? defenderPool : armyPool;
        for (let d = 0; d < dc; d++) {
          const dt = drawPool[Math.floor(kcRng() * drawPool.length)];
          neutralDefenders.push({ type: dt, quality: defQuality, race: race || 'Human', unitName: armyUnitName(dt) });
        }
      }
      provinces.push({
        id,
        row,
        col,
        name: null,
        terrain,
        tax: baseTax,
        race,
        population,
        owner: null,
        features,
        npcArmies: neutralDefenders.length,
        neutralDefenders,
        explored: 0,
        characters: [],
        armyTypes: armyPool,
        garrisonArmies: [],
        visitedBy: [],
      });
    }
  }

  // Post-generation: add fleet types to coastal provinces (land adjacent to sea) Whale Cohorts are
  // NOT an Elven unit — they are wild primal sea-beasts, raised only in the whale waters that
  // generate them, by any realm with the Druid skill to command them. ── Race allocation: weighted
  // towards each race's heartland, balanced to equal totals ── Two requirements pull against each
  // other. Races should cluster in their signature terrain
  // (Humans on plains, Elves in forest, Dwarves in mountains, Orcs in desert), but the four races
  // must also hold equal numbers of provinces — and terrain is NOT evenly distributed, so a plain
  // weighted draw would hand whichever race owns the commonest terrain a permanent advantage.
  //
  // Resolved by giving each race a hard quota of floor(n/4) provinces (the remainder spread at
  // random) and then, for each province in random order, drawing among the races that still have
  // quota left, weighted by SIGNATURE_WEIGHT_P for a terrain match and by each race's REMAINING
  // quota. The quota term is what keeps it balanced: a race that has been getting its way falls
  // back automatically as its allowance runs down. Totals are exact to within one province.
  {
    const humanoidProvs = provinces.filter((p) => p.terrain !== 'sea' && HUMANOID_RACES_GEN.has(p.race));
    const n = humanoidProvs.length;
    const quota = {};
    RACES_P.forEach((r) => {
      quota[r] = Math.floor(n / 4);
    });
    shuffleP(RACES_P)
      .slice(0, n - Math.floor(n / 4) * 4)
      .forEach((r) => {
        quota[r]++;
      });
    for (const p of shuffleP(humanoidProvs)) {
      const pool = RACES_P.filter((r) => quota[r] > 0);
      const cands = pool.length ? pool : [...RACES_P];
      const weights = cands.map(
        (r) => (SIGNATURE_TERRAIN_P[r] === p.terrain ? SIGNATURE_WEIGHT_P : 1) * Math.max(1, quota[r]),
      );
      let roll = kcRng() * weights.reduce((a, b) => a + b, 0),
        pick = cands[cands.length - 1];
      for (let i = 0; i < cands.length; i++) {
        roll -= weights[i];
        if (roll <= 0) {
          pick = cands[i];
          break;
        }
      }
      quota[pick]--;
      p.race = pick;
      // Rebuild everything downstream of race: the recruitable pool and the neutral garrison that
      // was rolled from it. Province count, wealth, terrain and features are untouched.
      const hp = buildHumanoidPool(p.terrain, pick, provincePoolSize(kcRng), kcRng); // item 15: 2 (75%) or 3 (25%)
      p.armyTypes = [...hp.types, ...hp.garrison];
      const drawPool = hp.types.length ? hp.types : p.armyTypes;
      (p.neutralDefenders || []).forEach((d) => {
        d.type = drawPool[Math.floor(kcRng() * drawPool.length)];
        d.race = pick;
        d.unitName = armyUnitName(d.type);
      });
    }
  }

  const FLEET_BY_RACE = {
    Human: ['Galleon Fleet'],
    Elven: ['Elven Galleys'],
    Dwarven: ['Dwarf Ironclads'],
    Orcish: ['Orcish Longships'],
  }; // Corsair Fleet retired (was Human alt); coastal Humans now build Galleon Fleet only
  provinces.forEach((p) => {
    if (p.terrain === 'sea') return; // sea handled separately below
    // Naval units are a HUMANOID shipbuilding tradition.
    if (!HUMANOID_RACES_GEN.has(p.race)) return;
    // Check if any neighbour is sea
    const offsets = p.row % 2 === 0 ? offEven : offOdd;
    const adjSea = offsets.some(([dr, dc]) => {
      const nr = p.row + dr;
      if (nr < 0 || nr >= rows) return false;
      const nc = (((p.col + dc) % cols) + cols) % cols;
      const nb = provinces[nr * cols + nc];
      return nb && nb.terrain === 'sea';
    });
    if (adjSea && kcRng() < COASTAL_NAVAL_CHANCE) {
      // share of coastal humanoid provinces with a fleet option
      const fleets = FLEET_BY_RACE[p.race || 'Human'] || ['Galleon Fleet'];
      const fleet = fleets[Math.floor(kcRng() * fleets.length)];
      if (!p.armyTypes.includes(fleet)) p.armyTypes.push(fleet);
    }
  });
  // Sea provinces: only non-humanoid sea armies — no Fleet/Corsair/Galleys/Longships Sea provinces
  // get non-humanoid sea armies only (no player fleets). Their army pool and tax are decided purely
  // by type: 20% Primal (Prosperous, tax 4-6), 20% poor waters (tax 2-3; dealt half whale waters and
  // half shark waters, turn about, so every world gets an even share — 2026-10-13, Toby: the Shark
  // Shoals are the Monsters' weak sea-beast as the Whale Cohort is the Creatures'), 60% open water
  // (no armies, tax 1).
  const PRIMAL_SEA_TYPES = KC_UNIT_CLASS.primalSea.filter((t) => t !== 'Shark Shoals'); // the prosperous seas' beasts; the Shark Shoals are the poor seas' (below)
  let _poorSeaShark = false;
  provinces
    .filter((p) => p.terrain === 'sea')
    .forEach((p) => {
      const r = kcRng();
      if (r < 0.2) {
        const chosen = PRIMAL_SEA_TYPES[Math.floor(kcRng() * PRIMAL_SEA_TYPES.length)];
        p.armyTypes = [chosen];
        p.race = 'Primal:' + chosen.replace(/s$/, '').replace('Eldritch Kraken', 'Kraken'); // 'Primal:Sea Giant' / 'Primal:Kraken'
        // Primal seas are Prosperous waters — tax 4-6, same band as prosperous land. (Capped at 6:
        // tax 7 displays as "Rich", so the old rP(4,7) was quietly minting rich sea provinces.)
        p.tax = rP(4, 6);
        // Defender count and quality (2026-10-13: both primal sea beasts are Druid 4; the Druid-5 Leviathans
        // are gone, so no sea is guarded by Veterans alone any more).
        const defCount = neutralDefCount(p.tax); // p.tax set to 4-6 above -> Prosperous 2-3
        const defQuality = kcRng() < 0.4 ? 'Veteran' : 'Average';
        const unitName = PRIMAL_UNIT_NAMES[chosen]?.[Math.floor(kcRng() * 5)] || 'the Ancient';
        p.neutralDefenders = Array.from({ length: defCount }, () => ({
          type: chosen,
          quality: defQuality,
          race: 'Primal',
          unitName: armyUnitName(chosen),
        }));
        p.npcArmies = defCount;
        p.explored = 0;
      } else if (r < 0.4) {
        // Poor waters: whale waters and shark waters, turn about.
        const beast = _poorSeaShark ? 'Shark Shoals' : 'Whale Cohort';
        _poorSeaShark = !_poorSeaShark;
        p.armyTypes = [beast];
        p.race = beast === 'Shark Shoals' ? 'Primal:Shark' : 'Primal:Whale';
        p.tax = rP(2, 3); // Poor waters — 2-3, matching the poor land band (2026-09-21: no 1-tax band province)
        const defCount = neutralDefCount(p.tax);
        p.neutralDefenders = Array.from({ length: defCount }, () => ({
          type: beast,
          quality: 'Average',
          race: 'Primal',
          unitName: armyUnitName(beast),
        }));
        p.npcArmies = defCount;
      } else {
        // Open water — no armies, no defenders, tax exactly 1.
        p.armyTypes = [];
        p.neutralDefenders = [];
        p.npcArmies = 0;
        p.tax = 1;
      }
    });

  // ── UNIFIED SEA FEATURES & GUARDIANS (item: every sea province gets 1-2 sea-themed features,
  // each guarded by a sea creature; wide pools keep even the largest maps varied). Applies to ALL
  // sea provinces — primal, whale AND open water — so open ocean is now worth exploring too.
  // Tougher guardians lurk in richer waters. This is the single source of sea features (the old
  // primal-only one-feature block above was removed).
  {
    const SEA_FEATURE_NAMES = [
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
    const _seaMons = MONSTERS_P.filter((m) => SEA_GUARDIAN_NAMES.has(m.name)); // shared module-level set
    const _byTier = {
      Weak: _seaMons.filter((m) => m.power === 'Weak'),
      Moderate: _seaMons.filter((m) => m.power === 'Moderate'),
      Powerful: _seaMons.filter((m) => m.power === 'Powerful'),
    };
    const _pickTier = (tax) => {
      const rr = kcRng();
      // 2026-09-10 item 6: softened alongside land lairs (was 50/50 P/M · 25/60/15 W/M/P · 70/30
      // W/M).
      if (tax >= 5) return rr < 0.35 ? 'Powerful' : rr < 0.85 ? 'Moderate' : 'Weak'; // rich/primal seas: nastier
      if (tax >= 3) return rr < 0.35 ? 'Weak' : rr < 0.9 ? 'Moderate' : 'Powerful';
      return rr < 0.75 ? 'Weak' : 'Moderate'; // poor / open water: mostly weak
    };
    provinces
      .filter((p) => p.terrain === 'sea')
      .forEach((p) => {
        const fcount = 1 + (kcRng() < 0.5 ? 1 : 0); // 1-2 features
        const used = new Set();
        p.features = []; // unified source — replace anything set earlier
        for (let fi = 0; fi < fcount; fi++) {
          let fname,
            tries = 0;
          do {
            fname = SEA_FEATURE_NAMES[Math.floor(kcRng() * SEA_FEATURE_NAMES.length)];
            tries++;
          } while (used.has(fname) && tries < 20);
          used.add(fname);
          const tier = _pickTier(p.tax || 1);
          const pool = _byTier[tier].length ? _byTier[tier] : _seaMons;
          const m = { ...pool[Math.floor(kcRng() * pool.length)] };
          p.features.push({
            name: fname,
            tier: m.power || '',
            discovered: false,
            cleared: false,
            monster: { ...m },
            treasure: Math.max(1, rP(m.minG, m.maxG)),
          });
        }
      });
  }

  // ── Home coastal guarantee: a home that borders any sea borders at least one OPEN-WATER sea (no
  // neutral defenders), so a king's first fleet always has somewhere to sail without a fight. Sea
  // features/guardians (lairs) are untouched - they never block movement.
  homeCells.forEach((home) => {
    const seas = neighbourCells(home.r, home.c)
      .map((n) => provinces[n.id])
      .filter((p) => p && p.terrain === 'sea');
    if (!seas.length || seas.some((p) => !(p.neutralDefenders || []).length)) return;
    const p = seas[Math.floor(kcRng() * seas.length)];
    p.armyTypes = [];
    p.neutralDefenders = [];
    p.npcArmies = 0;
    p.tax = 1;
    p.race = null;
  });

  // Player starts were already chosen up front (Phase 1) and their neighbourhoods tailored
  // (Phase 2). Here we simply take each king's pre-selected home province in order.
  const playerStarts = [];
  const allChars = [];
  let nextItemId = 0;

  // 2026-09-28 (Toby item 1): realm colours are dealt from a SHUFFLED palette. They used to be
  // REALM_COLOURS[player index], and humans always take the lowest indices (bots are appended after
  // them), so a player alone against bots was Rose (pink) in every game. shuffleP is the unbiased
  // Fisher-Yates at module top level; the palette's rules (terrain clearance, luma spacing) are
  // properties of the set, not of the seat, so any order keeps them.
  const _realmColourDeal = shuffleP(REALM_COLOURS);
  // The wild pools the home passes deal from: the alignment neighbour pass below and the
  // wild-country pass after the homes (item 12). Copies of CREATURE_BY_TERRAIN / MONSTER_BY_TERRAIN,
  // which are local to the province loop; tests/new-creatures and tests/primal-renames hold them together.
  const CBT = {
    plain: ['Thunderbirds', 'Stone Giants', 'Unicorn Herd', 'Mammoth Host'],
    desert: ['Stone Giants', 'Thunderbirds', 'Mammoth Host'],
    forest: ['Forest Ents', 'Thunderbirds', 'Great Bears', 'Unicorn Herd'],
    jungle: ['Forest Ents'],
    mountain: ['Stone Giants', 'Crimson Rocs', 'Thunderbirds', 'Great Bears'],
  }; // = CREATURE_BY_TERRAIN (tests/new-creatures holds the two together)
  const MBT = {
    plain: ['Titan Warbeasts', 'Manticore Pride'],
    desert: ['Manticore Pride', 'Basilisk Brood'],
    forest: ['Cave Trolls', 'Basilisk Brood', 'Dread Hydras'],
    jungle: ['Basilisk Brood', 'Cave Trolls', 'Manticore Pride', 'Dread Hydras'],
    mountain: ['Cave Trolls', 'Elder Dragons'],
  };
  const players = setupPlayers.map((sp, pi) => {
    const best = provinces[homeCells[pi].id];
    // Home province race always matches the king's race, and army pool updates accordingly
    best.owner = pi;
    best.npcArmies = 0;
    best.neutralDefenders = [];
    best.exploredBy = { [pi]: 100 };
    best.explored = 100;
    best.visitedBy = [pi];
    best.tax = 10;
    best.race = sp.race;
    // The home province is the ONE humanoid province exempt from the 2-3-types cap: a king opens
    // with his race's complete land roster. Restoring it here overwrites anything the coastal pass
    // added, so a coastal capital is re-offered its racial fleet on the same terms as any other
    // coastal humanoid province.
    best.armyTypes = fullRaceLandRoster(sp.race);
    if (!best.armyTypes.length) best.armyTypes = ['Shieldwall Levies'];
    {
      const hOffs = best.row % 2 === 0 ? offEven : offOdd;
      const homeCoastal = hOffs.some(([dr, dc]) => {
        const nr = best.row + dr;
        if (nr < 0 || nr >= rows) return false;
        const nc = (((best.col + dc) % cols) + cols) % cols;
        const nb = provinces[nr * cols + nc];
        return nb && nb.terrain === 'sea';
      });
      // 2026-09-25 (Toby): a coastal capital ALWAYS offers its race's fleet, at every sea share (was an
      // 80% roll). backfillHomeRosters applies the same rule to games already running.
      if (homeCoastal) {
        const hf =
          {
            Human: ['Galleon Fleet'],
            Elven: ['Elven Galleys'],
            Dwarven: ['Dwarf Ironclads'],
            Orcish: ['Orcish Longships'],
          }[sp.race] || []; // Corsair Fleet retired
        const pickH = hf[Math.floor(kcRng() * hf.length)];
        if (pickH && !best.armyTypes.includes(pickH)) best.armyTypes.push(pickH);
      }
    }
    // 100% explored = all features discovered at start (by the home's OWNER only)
    (best.features || []).forEach((f) => {
      discoverFeat(f, pi);
    });

    // ── Guarantee: the home is adjacent to one POOR (tax 2-3) and one PROSPEROUS (tax 4-6) land
    // province, BOTH of them HUMANOID, and at least one of the two of the king's OWN race. The
    // Phase-2 ring constraints usually place the tax bands; here we fix any shortfall (edge of map
    // / clustered starts) and enforce the race rules by re-racing the chosen neighbours in place
    // (terrain, tax and features kept; recruit pool and neutral garrison rebuilt).
    const _reRaceProvince = (conv, _race) => {
      conv.race = _race;
      const cHp = buildHumanoidPool(conv.terrain, _race, provincePoolSize(kcRng), kcRng);
      conv.armyTypes = [...cHp.types, ...cHp.garrison];
      // Coastal humanoid provinces keep their chance of a racial fleet, same rule as world gen.
      {
        const offs = conv.row % 2 === 0 ? offEven : offOdd;
        const convCoastal = offs.some(([dr, dc]) => {
          const nr = conv.row + dr;
          if (nr < 0 || nr >= rows) return false;
          const nc = (((conv.col + dc) % cols) + cols) % cols;
          const nb = provinces[nr * cols + nc];
          return nb && nb.terrain === 'sea';
        });
        if (convCoastal && kcRng() < COASTAL_NAVAL_CHANCE) {
          const cf =
            {
              Human: ['Galleon Fleet'],
              Elven: ['Elven Galleys'],
              Dwarven: ['Dwarf Ironclads'],
              Orcish: ['Orcish Longships'],
            }[_race] || []; // Corsair Fleet retired
          const pickF = cf[Math.floor(kcRng() * cf.length)];
          if (pickF && !conv.armyTypes.includes(pickF)) conv.armyTypes.push(pickF);
        }
      }
      // Rebuild the neutral garrison from the new pool. This runs BEFORE the neutral-guard hero
      // pass, so the hero picks up the corrected armies; province wealth still sets the count.
      const cDrawPool = conv.armyTypes.filter((t) => !t.toLowerCase().includes('garrison') && !SEA_TYPES_GEN.has(t));
      const cPool = cDrawPool.length > 0 ? cDrawPool : conv.armyTypes;
      const cCount = neutralDefCount(conv.tax);
      conv.neutralDefenders = Array.from({ length: cCount }, () => {
        const dt = cPool[Math.floor(kcRng() * cPool.length)];
        return { type: dt, quality: 'Average', race: _race, unitName: armyUnitName(dt) };
      });
      conv.npcArmies = conv.neutralDefenders.length;
      conv.name = null; // re-named thematically by the naming pass below
    };
    const _rawLandNbrs = getNeighborsP(best, cols, rows, provinces).filter(
      (n) => n && n.terrain !== 'sea' && n.owner == null,
    );
    const _isHumanoid = (n) => !!n && !String(n.race || '').startsWith('Primal');
    // when a tax band has to be FORCED, prefer a cell that is not an earlier king's guaranteed pair
    // member, so fixing this home can't silently break a neighbouring home's.
    const _earlierPair = new Set(playerStarts.flatMap((h) => h._homePairIds || []));
    const homeLandNbrs = [
      ..._rawLandNbrs.filter((n) => !_earlierPair.has(n.id)),
      ..._rawLandNbrs.filter((n) => _earlierPair.has(n.id)),
    ];
    // Pick the poor neighbour: an existing poor humanoid, else an existing poor primal, else force
    // one.
    let poorNbr =
      homeLandNbrs.find((n) => n.tax >= 2 && n.tax <= 3 && _isHumanoid(n)) ||
      homeLandNbrs.find((n) => n.tax >= 2 && n.tax <= 3) ||
      null;
    if (!poorNbr && homeLandNbrs.length >= 1) {
      poorNbr = homeLandNbrs[0];
      poorNbr.tax = rP(2, 3);
    }
    let prospNbr =
      homeLandNbrs.find((n) => n !== poorNbr && n.tax >= 4 && n.tax <= 6 && _isHumanoid(n)) ||
      homeLandNbrs.find((n) => n !== poorNbr && n.tax >= 4 && n.tax <= 6) ||
      null;
    if (!prospNbr) {
      const cands = homeLandNbrs.filter((n) => n !== poorNbr);
      if (cands.length) {
        prospNbr = cands[0];
        prospNbr.tax = rP(4, 6);
      }
    }
    // Both must be humanoid; at least one must be the king's race.
    const _pair = [poorNbr, prospNbr].filter(Boolean);
    _pair.forEach((n) => {
      if (!_isHumanoid(n)) _reRaceProvince(n, sp.race);
    });
    if (_pair.length && !_pair.some((n) => n.race === sp.race))
      _reRaceProvince(_pair[Math.floor(kcRng() * _pair.length)], sp.race);
    // Remember them so the alignment primal-neighbour pass below leaves them alone where it can.
    best._homePairIds = _pair.map((n) => n.id);
    // Belt-and-braces: some own-race land neighbour must exist (covers a home with no free ring
    // cells).
    if (homeLandNbrs.length && !homeLandNbrs.some((n) => n.race === sp.race)) _reRaceProvince(homeLandNbrs[0], sp.race);

    // ── Tasks 6 & 7: alignment starting primal neighbour ── Pagan kings open beside a PRIMAL
    // FOREST or JUNGLE province that holds a RITUAL SITE (somewhere to Perform Rites from turn
    // one). Druidic kings open beside a PRIMAL CREATURE province (Eagles, Ents, Giants, Rocs — a wild
    // host they can lead with no Druid requirement), and since 2026-10-13 (Toby, Creatures and
    // Monsters I) Evil kings beside a PRIMAL MONSTER province (Trolls, Basilisks, Manticores… — the
    // mirror). We convert a free neighbour, preferring one that is NOT the king's own-race homeland
    // guaranteed above.
    {
      const _align = sp.alignment;
      if (_align === 'Pagan' || _align === 'Druidic' || _align === 'Evil') {
        const _allFreeNbrs = getNeighborsP(best, cols, rows, provinces).filter(
          (n) => n && n.terrain !== 'sea' && n.owner == null,
        );
        // the poor/prosperous pair must be HUMANOID for EVERY home, so this pass may never convert
        // (a) this home's own pair, (b) an earlier king's pair, or (c) any cell in an earlier
        // king's ring (that would push their ring over the one-primal cap after their cap pass has
        // already run).
        const _protectedIds = new Set(best._homePairIds || []);
        playerStarts.forEach((h) => {
          (h._homePairIds || []).forEach((id) => _protectedIds.add(id));
          getNeighborsP(h, cols, rows, provinces).forEach((n) => {
            if (n) _protectedIds.add(n.id);
          });
        });
        const _freeNbrs = _allFreeNbrs.filter((n) => !_protectedIds.has(n.id)); // may be empty -> no alignment neighbour; the pair wins
        // don't clobber the just-guaranteed own-race neighbour if we can help it
        const _pick = (list) => {
          const notOwn = list.filter((n) => n.race !== sp.race);
          return notOwn.length ? notOwn : list;
        };
        let cand = null;
        if (_align === 'Pagan') {
          const pool = _pick(_freeNbrs);
          // prefer an existing forest/jungle neighbour; else re-terrain one to forest/jungle
          cand = pool.find((n) => n.terrain === 'forest' || n.terrain === 'jungle') || pool[0];
          if (cand) {
            if (cand.terrain !== 'forest' && cand.terrain !== 'jungle')
              cand.terrain = kcRng() < 0.5 ? 'forest' : 'jungle';
          }
        } else {
          // Druidic or Evil
          cand = _pick(_freeNbrs)[0];
        }
        if (cand) {
          const creatureOnly = _align === 'Druidic',
            monsterOnly = _align === 'Evil';
          const bank = creatureOnly
            ? CBT[cand.terrain] || ['Stone Giants']
            : monsterOnly
              ? MBT[cand.terrain] || ['Cave Trolls']
              : (kcRng() < 0.5 ? CBT : MBT)[cand.terrain] || ['Stone Giants'];
          const primalUnit = bank[Math.floor(kcRng() * bank.length)];
          cand.race = 'Primal:' + (PRIMAL_ARMY_DEFS_P[primalUnit]?.race || primalUnit);
          cand.armyTypes = [primalUnit];
          const dc = neutralDefCount(cand.tax);
          cand.neutralDefenders = Array.from({ length: dc }, () => ({
            type: primalUnit,
            quality: kcRng() < 0.5 ? 'Veteran' : 'Average',
            race: cand.race,
            unitName: armyUnitName(primalUnit),
          }));
          cand.npcArmies = cand.neutralDefenders.length;
          if (_align === 'Pagan' && !(cand.features || []).some((f) => f && f.ritualSite && !f.siteKind)) {
            cand.features = cand.features || [];
            cand.features.push({
              name: RITUAL_SITE_NAMES[Math.floor(kcRng() * RITUAL_SITE_NAMES.length)],
              ritualSite: true,
              monster: null,
              discovered: false,
              cleared: false,
              treasure: 0,
            });
          }
          cand.name = null; // re-named thematically by the naming pass
          best._alignPrimalId = cand.id;
        }
      }
    }

    // ── 2026-09-09: at most ONE primal province may border a home province ── World gen scatters
    // primal (creature/monster) provinces freely, so a home could open ringed by two or three of
    // them — unconquerable ground for a new realm. Keep one (the alignment-placed one if there is
    // one, else the first found) and re-race every other primal land neighbour as a humanoid
    // province of a random race (own-race guarantee above is untouched — it never picks a primal).
    {
      const _ringPrimal = getNeighborsP(best, cols, rows, provinces).filter(
        (n) => n && n.terrain !== 'sea' && n.owner == null && String(n.race || '').startsWith('Primal'),
      );
      if (_ringPrimal.length > 1) {
        const keepId =
          best._alignPrimalId != null && _ringPrimal.some((n) => n.id === best._alignPrimalId)
            ? best._alignPrimalId
            : _ringPrimal[0].id;
        const HUM = KC_HUMANOID_RACES.slice();
        _ringPrimal
          .filter((n) => n.id !== keepId)
          .forEach((n) => {
            _reRaceProvince(n, HUM[Math.floor(kcRng() * HUM.length)]);
          });
      }
      delete best._alignPrimalId;
    }

    // ── Guarantee: at least one WEAK feature in every player's home province ──
    {
      const SEA_MONS = new Set([
        'Sea Serpent',
        'Kraken Spawn',
        'Leviathan',
        'Leviathan Young',
        'Pirate Captain',
        'Ghost Galleon Crew',
        'Shark Pack',
        'Giant Crab',
      ]);
      const weakMons = MONSTERS_P.filter((mm) => mm.power === 'Weak' && !SEA_MONS.has(mm.name));
      if (weakMons.length > 0) {
        best.features = best.features || [];
        if (best.features.length === 0) {
          const wpool = FEATURE_POOLS_P[best.terrain] || FEATURE_POOLS_P.plain;
          best.features.push({
            name: wpool[Math.floor(kcRng() * wpool.length)],
            tier: 'Weak',
            monster: { ...weakMons[Math.floor(kcRng() * weakMons.length)] },
            discovered: true,
            discoveredBy: [pi],
            cleared: false,
            treasure: Math.max(1, rP(1, 6)),
          });
        } else if (!best.features.some((f) => f.monster && f.monster.power === 'Weak')) {
          // 2026-09-09g: softening a starting lair swaps its guardian, so its own difficulty must
          // follow — otherwise this one lair in the world reads Powerful while a Weak beast sits in
          // it.
          best.features[0].monster = { ...weakMons[Math.floor(kcRng() * weakMons.length)] };
          best.features[0].tier = 'Weak';
        }
      }
    }
    playerStarts.push(best);

    // Build king skills
    const kingSkills = { melee: 2, archery: 1, sage: 1 };
    if (sp.alignment === 'Divine') kingSkills.white = (kingSkills.white || 0) + 1;
    if (sp.alignment === 'Druidic') kingSkills.druid = (kingSkills.druid || 0) + 1;
    if (sp.alignment === 'Evil') kingSkills.druid = (kingSkills.druid || 0) + 1; // 2026-10-13 (Toby): the mirror — an Evil king drives his Monsters from turn one
    if (sp.alignment === 'Pagan') kingSkills.explorer = (kingSkills.explorer || 0) + 1; // the old faith walks the wild places
    if (sp.alignment === 'Undead') {
      kingSkills.necromancy = (kingSkills.necromancy || 0) + 1;
    }
    // Normalise any mixed-case skill keys from the join form to engine keys
    const SKILL_NORM = {
      Melee: 'melee',
      Archery: 'archery',
      Tactical: 'tactical',
      March: 'march',
      Naval: 'naval',
      Sage: 'sage',
      Spy: 'spy',
      Thief: 'thief',
      Druid: 'druid',
      Explorer: 'explorer',
      'White Magic': 'white',
      'Psychic Magic': 'psychic',
      'Illusory Magic': 'illusory',
      'Elemental Magic': 'elemental',
      Necromancy: 'necromancy',
      White: 'white',
      Psychic: 'psychic',
      Illusory: 'illusory',
      Elemental: 'elemental',
    };
    if (sp.skills)
      Object.entries(sp.skills).forEach(([k, v]) => {
        const normKey = SKILL_NORM[k] || k.toLowerCase();
        kingSkills[normKey] = (kingSkills[normKey] || 0) + v;
      });

    // A king who begins with any Naval skill must be able to put that skill to use: guarantee at
    // least one of their race's naval units is recruitable in their home province. The king still
    // starts with land armies only — this just adds the option to build a fleet from turn one.
    if ((kingSkills.naval || 0) >= 1) {
      const NAVAL_BY_RACE = { ...HOME_FLEET_BY_RACE };
      const navalUnit = NAVAL_BY_RACE[sp.race] || 'Galleon Fleet';
      best.armyTypes = best.armyTypes || [];
      if (!best.armyTypes.includes(navalUnit)) best.armyTypes.push(navalUnit);
    }

    const kingId = allChars.length;
    // King's starting armies are drawn from the province's LAND army pool only (no fleets), so a
    // Naval-skilled king still opens with land units and must recruit ships themselves.
    const startArmyPool = ((PROVINCE_ARMIES_P[best.terrain] || {})[sp.race] || ['Shieldwall Levies']).filter(
      (t) => !SEA_TYPES_GEN.has(t),
    );
    const king = {
      id: kingId,
      name: sp.kingName || sp.name,
      isKing: true,
      player: pi,
      race: sp.race,
      alignment: sp.alignment,
      temper: sp.temper,
      hp: 15,
      maxHp: 15,
      skills: kingSkills,
      aptitude: {},
      armies: (() => {
        const nonGarrison = startArmyPool.filter((t) => !t.toLowerCase().includes('garrison'));
        let pool = nonGarrison.length > 0 ? nonGarrison : startArmyPool;
        // Never hand a king a starting unit his own Druid skill can't lead cleanly. Own-race troops
        // are commanded as if Druid 1 (the same-race rule), so keep only types whose required Druid
        // level is within reach — this filters out exotic own-race beasts (Eagle Riders, Noble
        // Griffons, Wyvern Riders, etc.) that would otherwise saddle a low-Druid king with a
        // strength penalty from turn one. Fall back to the full pool only if nothing qualifies.
        const kingDruidReach = Math.max(1, kingSkills.druid || 0);
        const safe = pool.filter((t) => getDruidLevel(t) <= kingDruidReach);
        if (safe.length > 0) pool = safe;
        const t1 = pool[0] || 'Shieldwall Levies',
          t2 = pool[Math.min(1, pool.length - 1)] || pool[0] || 'Shieldwall Levies';
        const a1 = { type: t1, quality: 'Average', race: sp.race, unitName: armyUnitName(t1) };
        const a2 = { type: t2, quality: 'Average', race: sp.race, unitName: armyUnitName(t2) };
        return [a1, a2];
      })(),
      items: [],
      location: best.id,
      alive: true,
      merits: 0,
      taxBonus: 0,
      pay: 0,
      spellsUsedThisTurn: [],
      locationName: best.name,
    };
    ABILITIES_P.forEach((ab) => {
      king.aptitude[ab] = rP(1, 4);
    });
    // Undead kings get one skeletal starter army in addition to normal starting armies
    if (sp.alignment === 'Undead') {
      // PROTOTYPE Undead (round 23): a kit realm begins with two skeletal companies, not one
      const _skelStart = _protoList.includes('Undead') ? 2 : 1;
      for (let _k = 0; _k < _skelStart; _k++)
        king.armies.push({
          type: 'Shieldwall Levies',
          quality: 'Average',
          race: 'Undead',
          _isSkeletal: true,
          unitName: armyUnitName('Shieldwall Levies') + ' (Skeletal)',
        });
    }
    allChars.push(king);
    best.characters.push(kingId);

    // Starting heroes — pay = 1 (loyal to their liege). the FIRST hero shares the king's race; the
    // SECOND is a random race that bears no animosity toward the king's race
    // (Orcs↔Humans and Elves↔Dwarves are the feuding pairs), so a king never opens with a rival-kin
    // hero at his side (who would lead his native troops at −20%).
    const _RACE_RIVAL = { ...KC_RIVAL_RACE };
    const heroIds = [];
    for (let h = 0; h < 2; h++) {
      const hid = allChars.length;
      const hSkills = {};
      for (let s = 0; s < 3; s++) {
        const sk = ABILITIES_P[Math.floor(kcRng() * ABILITIES_P.length)];
        hSkills[sk] = (hSkills[sk] || 0) + 1;
      }
      const heroAlign = ALIGNMENTS_P[Math.max(0, Math.min(6, ALIGNMENTS_P.indexOf(sp.alignment) + rP(-1, 1)))];
      const _hRace =
        h === 0
          ? sp.race
          : (() => {
              const opts = RACES_P.filter((r) => r !== _RACE_RIVAL[sp.race]);
              return opts[Math.floor(kcRng() * opts.length)];
            })();
      const hero = {
        id: hid,
        name: nextHeroName(heroAlign),
        isKing: false,
        player: pi,
        race: _hRace, // hero 0 = king's race; hero 1 = random non-feuding race
        alignment: heroAlign,
        temper: TEMPERS_P[Math.floor(kcRng() * 4)],
        hp: 15,
        maxHp: 0,
        skills: hSkills,
        aptitude: {},
        armies: [],
        items: [],
        location: best.id,
        alive: true,
        merits: 0,
        taxBonus: 0,
        spellsUsedThisTurn: [],
        locationName: best.name,
        startingHero: true, // informational only — wage follows the standard skill formula
      };
      hero.maxHp = hero.hp;
      ABILITIES_P.forEach((ab) => {
        hero.aptitude[ab] = rP(1, 4);
      });
      // Same wage formula as every other hero: 3 starting skill points → ceil(3/4) = 1g.
      hero.pay = Math.max(1, Math.ceil(Object.values(hSkills).reduce((s, v) => s + v, 0) / 4));
      allChars.push(hero);
      best.characters.push(hid);
      heroIds.push(hid);
    }

    // homeProvinceId is the founding capital and is written ONCE, here. It is deliberately separate
    // from provinces[0], which shifts as land is won and lost — the player map is centred on this
    // province for the whole game, so it must never move under them mid-campaign.
    return {
      id: pi,
      name: sp.kingdomName || sp.name,
      kingName: sp.kingName || sp.name,
      _isBot: !!sp.isBot,
      color: _realmColourDeal[pi] || REALM_COLOUR_FALLBACK,
      race: sp.race,
      alignment: sp.alignment,
      temper: sp.temper,
      gold: 20,
      king: kingId,
      heroes: [...heroIds],
      provinces: [best.id],
      homeProvinceId: best.id,
      merits: 0,
      // ── Diplomacy (KC alliance system) ── players this king has ENCOUNTERED (seen a character or
      // province of). Only encountered players may be treated with. Accumulated in
      // updateProvinceMemory.
      _encountered: [],
    };
  });

  // ── WILD COUNTRY NEAR THE TWO CROWNS (2026-10-13, Toby item 12) ── A Druidic king must have at
  // least one land CREATURE province within two provinces of home, and an Evil king a land MONSTER
  // province, so each crown can reach its speciality early. The alignment pass above only tries to
  // put one beside the home, and it can find no free neighbour; later homes' cap passes can also
  // re-race a primal province that sits two steps from an earlier home. This pass runs after every
  // home is tailored and is the authority. Where nothing within two steps qualifies it converts one
  // cell, choosing in order: a cell exactly two steps away that borders no home (so no ring breaks
  // its one-primal cap), then a free cell in this home's own ring if that ring holds no primal yet.
  // It never touches a home, any king's poor/prosperous pair, or a primal cell that is another
  // crown's only qualifying province. Wrong-family primal cells are preferred over humanoid ones (the
  // wild country only changes sides), then cells not of the king's own race.
  {
    const _nb = (p) => getNeighborsP(p, cols, rows, provinces).filter(Boolean);
    const _within2 = (h) => {
      const one = _nb(h),
        seen = new Map(one.map((n) => [n.id, 1]));
      one.forEach((n) =>
        _nb(n).forEach((m) => {
          if (m.id !== h.id && !seen.has(m.id)) seen.set(m.id, 2);
        }),
      );
      return seen;
    };
    const _famOf = (p) => {
      if (!p || p.terrain === 'sea' || !String(p.race || '').startsWith('Primal')) return null;
      const t = (p.armyTypes || [])[0];
      return KC_UNIT_CLASS.creature.includes(t) ? 'creature' : KC_UNIT_CLASS.monster.includes(t) ? 'monster' : null;
    };
    const _homeIds = new Set(players.map((pl) => pl.homeProvinceId));
    const _pairIds = new Set(playerStarts.flatMap((h) => h._homePairIds || []));
    const _ringIds = new Set();
    playerStarts.forEach((h) => _nb(h).forEach((n) => _ringIds.add(n.id)));
    const _crowns = players
      .map((pl) => ({
        pl,
        want: pl.alignment === 'Druidic' ? 'creature' : pl.alignment === 'Evil' ? 'monster' : null,
        home: provinces[pl.homeProvinceId],
      }))
      .filter((x) => x.want && x.home);
    const _matches = (cr) =>
      [..._within2(cr.home).keys()].filter((id) => {
        const q = provinces[id];
        return q && q.owner == null && _famOf(q) === cr.want;
      });
    _crowns.forEach((cr) => {
      if (_matches(cr).length) return;
      const near = _within2(cr.home);
      const soleFor = (id) => _crowns.some((o) => o !== cr && _matches(o).length === 1 && _matches(o)[0] === id);
      const ok = (q) =>
        q && q.terrain !== 'sea' && q.owner == null && !_homeIds.has(q.id) && !_pairIds.has(q.id) && !soleFor(q.id);
      const ringHasPrimal = _nb(cr.home).some((n) => n.terrain !== 'sea' && String(n.race || '').startsWith('Primal'));
      const rank = (list) =>
        list.sort(
          (x, y) =>
            (_famOf(y) ? 1 : 0) - (_famOf(x) ? 1 : 0) ||
            (x.race === cr.pl.race ? 1 : 0) - (y.race === cr.pl.race ? 1 : 0),
        );
      const far = rank(
        shuffleP(
          [...near.entries()]
            .filter(([id, d]) => d === 2)
            .map(([id]) => provinces[id])
            .filter((q) => ok(q) && !_ringIds.has(q.id)),
        ),
      );
      const ring = ringHasPrimal ? [] : rank(shuffleP(_nb(cr.home).filter(ok)));
      const cand = far[0] || ring[0] || null;
      if (!cand) return;
      const bank = (cr.want === 'creature' ? CBT : MBT)[cand.terrain] || [
        cr.want === 'creature' ? 'Stone Giants' : 'Cave Trolls',
      ];
      const unit = bank[Math.floor(kcRng() * bank.length)];
      cand.race = 'Primal:' + (PRIMAL_ARMY_DEFS_P[unit]?.race || unit);
      cand.armyTypes = [unit];
      cand.neutralDefenders = Array.from({ length: neutralDefCount(cand.tax) }, () => ({
        type: unit,
        quality: kcRng() < 0.5 ? 'Veteran' : 'Average',
        race: cand.race,
        unitName: armyUnitName(unit),
      }));
      cand.npcArmies = cand.neutralDefenders.length;
      cand.name = null; // renamed by the thematic naming pass below
    });
  }

  // ── NEUTRAL RACE REBALANCE (2026-09-21) ── The allocation pass above deals the four humanoid
  // races EXACTLY evenly (to within one province) — but the home-tailoring passes that follow then
  // re-race provinces one at a time (own-race neighbour, primal-cap re-race to a RANDOM race,
  // alignment primal conversion), and an audit measured the final spread drifting up to 8 provinces
  // apart on a 5-realm map. This pass restores the promise for the NEUTRAL world. Home provinces are
  // left out of the count (their race is the king's choice), and nothing inside ANY home ring is
  // touched, so every home-neighbourhood guarantee stands exactly as tailored. A province is moved
  // from the most- to the least-held race, preferring one on the receiving race's heartland terrain
  // so the heartland clustering survives.
  {
    const _homeRing = new Set();
    playerStarts.forEach((h) => {
      _homeRing.add(h.id);
      getNeighborsP(h, cols, rows, provinces).forEach((n) => {
        if (n) _homeRing.add(n.id);
      });
    });
    const _neutralHum = () =>
      provinces.filter((p) => p && p.terrain !== 'sea' && p.owner === null && HUMANOID_RACES_GEN.has(p.race));
    const _reRace = (conv, _race) => {
      conv.race = _race;
      const cHp = buildHumanoidPool(conv.terrain, _race, provincePoolSize(kcRng), kcRng);
      conv.armyTypes = [...cHp.types, ...cHp.garrison];
      const offs = conv.row % 2 === 0 ? offEven : offOdd;
      const coastal = offs.some(([dr, dc]) => {
        const nr = conv.row + dr;
        if (nr < 0 || nr >= rows) return false;
        const nb = provinces[nr * cols + ((((conv.col + dc) % cols) + cols) % cols)];
        return nb && nb.terrain === 'sea';
      });
      if (coastal && kcRng() < COASTAL_NAVAL_CHANCE) {
        const f = HOME_FLEET_BY_RACE[_race];
        if (f && !conv.armyTypes.includes(f)) conv.armyTypes.push(f);
      }
      const pool = conv.armyTypes.filter((t) => !t.toLowerCase().includes('garrison') && !SEA_TYPES_GEN.has(t));
      const draw = pool.length ? pool : conv.armyTypes;
      conv.neutralDefenders = Array.from({ length: neutralDefCount(conv.tax) }, () => {
        const dt = draw[Math.floor(kcRng() * draw.length)];
        return { type: dt, quality: 'Average', race: _race, unitName: armyUnitName(dt) };
      });
      conv.npcArmies = conv.neutralDefenders.length;
      conv.name = null; // renamed by the thematic naming pass below
    };
    for (let guard = 0; guard < 500; guard++) {
      const cnt = {};
      RACES_P.forEach((r) => (cnt[r] = 0));
      _neutralHum().forEach((p) => cnt[p.race]++);
      const order = shuffleP(RACES_P).sort((a, b) => cnt[b] - cnt[a]);
      const hi = order[0],
        lo = order[order.length - 1];
      if (cnt[hi] - cnt[lo] <= 1) break;
      const movable = shuffleP(_neutralHum().filter((p) => p.race === hi && !_homeRing.has(p.id)));
      if (!movable.length) break;
      const pick =
        movable.find((p) => SIGNATURE_TERRAIN_P[lo] === p.terrain) ||
        movable.find((p) => SIGNATURE_TERRAIN_P[hi] !== p.terrain) ||
        movable[0];
      _reRace(pick, lo);
    }
  }

  // ── MINIMUM TAX FLOOR (2026-09-21) ── No LAND province may be worth 1 tax. The Poor band is
  // 2-3 everywhere it is rolled above, but terrain rolls, re-racing and future tailoring passes all
  // touch tax independently, so this single sweep is the authority: every land province is lifted to
  // at least 2 before garrisons are sized off its FINAL tax. Sea is deliberately exempt — open water
  // is pinned at tax 1 as the "worthless ocean" marker the home-coastal guarantee relies on.
  provinces.forEach((p) => {
    if (p && p.terrain !== 'sea' && (p.tax || 0) < 2) p.tax = 2;
  });

  // ── COASTAL SHIPYARDS (2026-09-21, Toby) ── EVERY humanoid land province that touches the sea offers
  // its race's fleet. The earlier passes gave one to COASTAL_NAVAL_CHANCE (80%) of coasts, and the
  // race-rebalance / re-race passes rebuild pools afterwards, so this final sweep is the authority.
  provinces.forEach((p) => {
    if (!p || p.terrain === 'sea' || !HUMANOID_RACES_GEN.has(p.race)) return;
    const coastal = neighbourCells(p.row, p.col).some((n) => {
      const q = provinces[n.id];
      return q && q.terrain === 'sea';
    });
    if (!coastal) return;
    p.armyTypes = p.armyTypes || [];
    if (p.armyTypes.some((t) => HUMANOID_FLEET_TYPES.has(t))) return;
    const fleet = (FLEET_BY_RACE[p.race] || ['Galleon Fleet'])[0];
    p.armyTypes.push(fleet);
  });

  // ── NEUTRAL DEFENDER BAND AUDIT ────
  // Every defender pass rolls its count from the province's tax AT THE TIME, but three passes above
  // change a province's tax AFTERWARDS and do not rebuild the garrison:
  // • the home poor-neighbour force (`poorNbr.tax=rP(2,3)`) — a Rich/Prosperous province keeps
  // its 3-4 or 2-3 defenders while displaying as Poor;
  // • the home prosperous-neighbour force (`prospNbr.tax=rP(4,6)`) — a POOR province is promoted to
  // Prosperous and keeps its 1-2 defenders. This is the reported bug: a province the player is
  // shown as "Prosperous" defended by a single army.
  // • `_reRaceProvince` rebuilds correctly, but only fires when a pair member is non-humanoid or
  // has to be re-raced to the king's race, so it cannot be relied on to clean up after the above.
  // Rather than patch each mutation site (and have the next one reintroduce it), this single sweep
  // is the authority: after ALL world-gen tailoring and BEFORE the neutral-guard heroes take
  // command of these arrays, every neutral land province is brought inside the band its FINAL tax
  // demands. Rich (tax>=7) 3-4 · Prosperous (tax 4-6) 2-3 · Poor (tax 2-3) 1-2 — the same
  // thresholds as the player-facing wealth label. Provinces already in band are left exactly as
  // generated.
  provinces.forEach((p) => {
    if (p && p.owner === null && p.terrain !== 'sea') resyncNeutralDefenders(p);
  });

  // ── THE STRONGEST NEUTRAL MIX (2026-10-13, Toby item 13) ── With the count final, every neutral
  // land province fields the most effective mix of its own units (bestNeutralMix), the same number
  // of units, each slot keeping the quality it was dealt. A unit keeps its company name when its type
  // is unchanged. Primal provinces offer one beast and are left as they are.
  provinces.forEach((p) => {
    if (!p || p.owner !== null || p.terrain === 'sea' || String(p.race || '').startsWith('Primal')) return;
    const defs = p.neutralDefenders || [];
    if (!defs.length) return;
    const quals = defs.map((d) => d.quality || 'Average').sort((a, b) => (UNIT_Q_MULT[b] || 2) - (UNIT_Q_MULT[a] || 2));
    const mix = bestNeutralMix(p.armyTypes, quals, p.terrain, p.race);
    if (!mix) return;
    const left = defs.slice();
    p.neutralDefenders = mix.map((t, i) => {
      const k = left.findIndex((d) => d.type === t && (d.quality || 'Average') === quals[i]);
      if (k >= 0) return left.splice(k, 1)[0];
      return { type: t, quality: quals[i], race: defs[0].race || p.race || 'Human', unitName: armyUnitName(t) };
    });
    p.npcArmies = p.neutralDefenders.length;
  });

  // Neutral heroes — one per non-home land province, and per sea province that has defenders,
  // leading the province's neutral armies (so sea provinces actually fight when entered) neutral
  // heroes now start with a spread of skills (INCLUDING magic schools) so they are more useful —
  // one skill at level 2 and one at level 1, dealt round-robin from NEUTRAL_SKILL_POOL so the
  // skills are spread evenly across the whole neutral-hero population rather than clustered.
  // NOT a copy of KC_MAGIC_SCHOOLS/KC_SKILLS: this ORDER is the tie-break priority. Leave it hand-kept (2026-09-27).
  const NEUTRAL_SKILL_POOL = [
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
  // neutral-hero traits are DEALT FROM RESHUFFLED DECKS rather than rolled. The old round-robin
  // cursor spread skills evenly but in province-id order, so the same skill recurred in a fixed
  // stride down the map; alignment/race/temper were independent rolls, which on a normal map easily
  // produced runs of identical results. A deck guarantees the intended proportions over every pass
  // and a fresh random ORDER each pass.
  const _mkDeck = (cards) => {
    let d = [];
    return () => {
      if (!d.length) d = shuffleP(cards);
      return d.pop();
    };
  };
  const _dealPrimary = _mkDeck(NEUTRAL_SKILL_POOL);
  const _dealSecondary = _mkDeck(NEUTRAL_SKILL_POOL);
  // Alignment mix: Divine/Undead 5%, Good/Evil 10%, Druidic/Pagan 20%, Neutral 30% — encoded as a
  // 20-card deck (1/2/4/6/4/2/1) so every 20 neutral heroes hit the mix exactly.
  const _dealAlign = _mkDeck([
    ...Array(1).fill('Divine'),
    ...Array(2).fill('Good'),
    ...Array(4).fill('Druidic'),
    ...Array(6).fill('Neutral'),
    ...Array(4).fill('Pagan'),
    ...Array(2).fill('Evil'),
    ...Array(1).fill('Undead'),
  ]);
  const _dealRace = _mkDeck(RACES_P);
  const _dealTemper = _mkDeck(TEMPERS_P.slice(0, 4));
  // ── SECRET Easter egg: reserve Garreth the Independent and pick which neutral LAND province he
  // guards. Reserving his name parts BEFORE the loop keeps "Garreth"/"the Independent" out of every
  // other hero's draw (item: unique names). He is otherwise an ordinary neutral guard.
  const _garrethLandProvs = provinces.filter(
    (p) => p.owner === null && p.terrain !== 'sea' && (p.neutralDefenders || []).length > 0,
  );
  const _garrethPool = _garrethLandProvs.length
    ? _garrethLandProvs
    : provinces.filter((p) => p.owner === null && (p.neutralDefenders || []).length > 0);
  const _garrethProvId = _garrethPool.length ? _garrethPool[Math.floor(kcRng() * _garrethPool.length)].id : null; // name reserved at top of generateNewGame
  provinces
    .filter((p) => p.owner === null && (p.terrain !== 'sea' || (p.neutralDefenders || []).length > 0))
    .forEach((lp) => {
      const hid = allChars.length;
      // a neutral hero is a PERSON — their race is always humanoid, even when they guard a sea or
      // primal (Creature/Monster) province. The monster class belongs to the ARMIES they lead, never
      // to the hero.
      const hrace = _dealRace();
      const hSkills = {};
      // Item 7 / deal one level-2 skill and one level-1 skill from two independent reshuffled decks,
      // so across all neutral heroes every skill appears equally often as the L2 pick and as the L1
      // pick, with no positional pattern. Magic schools are in the pool, so some neutral heroes can
      // cast.
      const _primary = _dealPrimary();
      let _secondary = _dealSecondary();
      if (_secondary === _primary) {
        const _alt = _dealSecondary();
        if (_alt !== _primary) _secondary = _alt;
        else _secondary = NEUTRAL_SKILL_POOL[(NEUTRAL_SKILL_POOL.indexOf(_primary) + 1) % NEUTRAL_SKILL_POOL.length];
      }
      hSkills[_primary] = 2;
      hSkills[_secondary] = (hSkills[_secondary] || 0) + 1;
      // Druidic neutral heroes are guaranteed the Druid skill (needed to lead primal armies without
      // penalty); if the deal didn't already give it, fold it into the level-1 slot.
      let wAlign = _dealAlign();
      if (wAlign === 'Druidic' && !hSkills.druid) hSkills.druid = 1;
      const _isGarreth = lp.id === _garrethProvId;
      if (_isGarreth) wAlign = 'Neutral'; // Garreth/the Independent are Neutral-pool names — keep it consistent
      const baseName = _isGarreth ? 'Garreth the Independent' : nextHeroName(wAlign);
      const h = {
        id: hid,
        name: baseName,
        isKing: false,
        player: null,
        _unkillable: _isGarreth, // SECRET: never dies (see _escapesTheEnd / handleHeroDeath)
        race: hrace,
        alignment: wAlign,
        temper: _dealTemper(),
        hp: 15,
        maxHp: 0,
        skills: hSkills,
        aptitude: {},
        // Neutral heroes carry the province's neutral armies
        armies: [...(lp.neutralDefenders || [])],
        items: [],
        location: lp.id,
        alive: true,
        merits: 0,
        taxBonus: 0,
        spellsUsedThisTurn: [],
        locationName: lp.name,
        _isNeutralGuard: true, // flag: currently defending their home province
        // NOTE: no encounterPlan here on purpose. autoEncounterPlan/ensureEncounterPlan live inside
        // runTurn's scope and are NOT reachable from generateNewGame — calling them here throws a
        // ReferenceError and world generation dies. NPC plans are built lazily at combat time.
      };
      h.maxHp = h.hp;
      ABILITIES_P.forEach((ab) => {
        h.aptitude[ab] = rP(1, 4);
      });
      h.pay = Math.max(1, 1 + Math.max(0, Math.ceil(Object.values(hSkills).reduce((s, v) => s + v, 0) / 4) - 1)); // wandering default; the hire desk quotes alignment + skill premium
      allChars.push(h);
      lp.characters.push(hid);
      // Province still keeps neutralDefenders for backward-compat intel display, but armies actually
      // live on the hero now
    });

  // ── THEMATIC NAMING PASS ── Every province now has its final terrain, race and army pool
  // (including king home provinces), so name them all thematically here, then point each
  // character's stored location name at the freshly-named province they occupy.
  nameAllProvinces();
  allChars.forEach((c) => {
    const pv = provinces[c.location];
    if (pv) c.locationName = pv.name;
  });

  // PROTOTYPE (ideas round 22, Toby): STARTING GRAVES — every land province begins with 1 to 3 graves of units it can
  // recruit (its field kinds; fleets never), of Green to Crack quality, for the necromancers to raise. Only when the
  // game is made with the switch (KC_START_GRAVES=1 in the matrix); otherwise no die is rolled and the world is unchanged.
  if (genOpts && genOpts.startingGraves === true) {
    const _sgTiers = ['Green', 'Average', 'Veteran', 'Crack'];
    const _sgField = (t) => !/garrison|fleet|galley|ironclad|longship|whale|shark/i.test(t);
    provinces.forEach((pv) => {
      if (!pv || pv.terrain === 'sea') return;
      const kinds = (pv.armyTypes || []).filter(_sgField);
      if (!kinds.length) return;
      const n = 1 + Math.floor(kcRng() * 3);
      pv.battleGraves = pv.battleGraves || [];
      for (let k = 0; k < n; k++) {
        const type = kinds[Math.floor(kcRng() * kinds.length)];
        const quality = _sgTiers[Math.floor(kcRng() * _sgTiers.length)];
        pv.battleGraves.push({ type, quality, race: pv.race || 'Primal', unitName: armyUnitName(type) });
      }
    });
  }

  // Build turnOrders
  const turnOrders = {};
  allChars
    .filter((c) => c.player !== null && c.alive)
    .forEach((c) => {
      turnOrders[c.id] = [null, null, null, null, null];
    });

  const _newGameState = {
    world: { provinces, cols, rows, seaPct },
    // the alignment kits switched on for this game (src/engine/alignment-prototypes.ts): the ideas round 1 prototypes
    ...(genOpts && Array.isArray(genOpts.alignmentPrototypes) && genOpts.alignmentPrototypes.filter(Boolean).length
      ? { alignmentPrototypes: genOpts.alignmentPrototypes.filter(Boolean) }
      : {}),
    ...(genOpts && genOpts.alignmentPrototypeTactics === true ? { alignmentPrototypeTactics: true } : {}),
    ...(genOpts && genOpts.botLairHunting === true ? { botLairHunting: true } : {}),
    ...(genOpts && genOpts.startingGraves === true ? { startingGraves: true } : {}),
    players,
    characters: allChars,
    mercenaries: [],
    // ── Diplomacy (KC alliance system) ── relations between players, keyed "minIdx-maxIdx" →
    // 'enemy' | 'allied'. Any pair absent from the map is NEUTRAL (the default). All players begin
    // Neutral to one another; relations only change at end of turn via mutual Treat / a war
    // declaration.
    relations: {},
    heroGraveyard: [],
    turn: 1,
    phase: 0,
    maxTurns,
    log: [],
    turnOrders,
    nextItemId: 0,
    _awardedItems: [],
  };
  grantMithrilToDwarves(_newGameState); // dwarf characters of a dwarf realm start suited in mithril
  // re-grade every lair before the hoards are stocked - always 22 legendary lairs, spread across
  // the world, with the weak country gathered around the homes.
  assignLairGrades(
    provinces,
    players.map((pl) => pl.homeProvinceId),
    sz.cols,
    sz.rows,
    ITEMS_BY_TIER[4].length,
  );
  // name every lair AFTER its guardian is settled, from that guardian's own pools, and uniquely
  // across the world. Must run after assignLairGrades, which re-draws the guardians.
  renameLairsThematicP(_newGameState);
  ensureAllLairHoards(_newGameState); // every lair's gold and magic decided now
  // 2026-09-10 revert: earned HP — every starting character opens with an empty pool (15 HP; 18 for
  // an Orc of an Orcish realm), at full health.
  maxHpPlayers.players = players;
  allChars.forEach((c) => {
    c.hpEarned = 0;
    c.maxHp = computeMaxHp(c, players);
    c.hp = c.maxHp;
  });
  _newGameState._maxHpV2 = true;
  _newGameState._maxHpV3 = true;
  _newGameState._guardiansV2 = true;
  _newGameState._guardiansVer = GUARDIAN_TABLE_VER;
  return _newGameState;
}
