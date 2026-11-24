// S0 of the world's making (generateNewGame, src/engine/world/generate.ts; the stages: docs/architecture/
// the-worlds-making-its-stages-their-files-and-how-a-stage-is-moved-into-one.md): the set-up. Fresh hero-name pools
// with Garreth's name kept back, the Pagan flag, the content's tables by any name, the map's grid and its helpers,
// pickLand, and the naming pools and functions, which the naming pass (S17) runs once the map is whole. It draws no
// dice of its own: pickLand and the naming functions draw when a later stage calls them.
import {
  PRIMAL_ARMY_DEFS_P,
  PRIMAL_UNIT_NAMES,
  PROVINCE_ARMIES_P,
  THE_RACE_A_COMPANY_OR_PROVINCE_OF_NO_RACE_READS_AS,
} from '../../../content/kingdoms-call-data.ts';
import {
  THE_FIRST_HALVES_OF_A_PROVINCES_NAME_BY_ITS_RACE,
  THE_FIRST_HALVES_OF_A_WILD_PROVINCES_NAME,
  THE_HALVES_OF_A_SEAS_NAME_BY_THE_KIND_OF_SEA,
  THE_NUMERALS_A_REPEATED_PROVINCES_NAME_TAKES,
  THE_SECOND_HALVES_OF_A_PROVINCES_NAME_BY_ITS_TERRAIN,
  THE_TERRAINS_A_LAND_PROVINCE_IS_DEALT_IN_THE_ORDER_THE_DIE_READS_THEM,
} from '../../../content/the-worlds-making-its-name-pools-sea-features-wild-beasts-fleets-skill-pools-and-the-bots-realms.ts';
import { THE_PROVINCES_NAMES } from '../../../content/the-worlds-making-its-numbers-by-stage-the-sea-the-capitals-the-taxes-the-lairs-the-seas-the-homes-and-the-heroes.ts';
import { kcRng } from '../../rng.ts';
import {
  isTheRaceOneOfTheWildsSubRaces,
  theWildsSubRaceOf,
} from '../../rules-on-plain-values/whether-a-race-is-the-wilds-or-one-of-its-sub-races.ts';
import { HUMANOID_RACES_GEN } from '../tables.ts';
import { doTheRitualStonesStandWithARealmOf } from '../../rules-on-plain-values/the-world-each-creed-is-made-in-its-wild-country-its-first-skills-and-one-realm-a-game.ts';
import { _usedHeroEpithets, _usedHeroFirsts, _usedHeroNames } from '../../names.ts';
import { FEATURE_POOLS_P } from '../../items/tiers-and-hoards.ts';
import { normSeaPct } from './the-sea-share-the-gm-picks-from-the-least-to-the-most.ts';
import {
  type ACellOfTheGrid,
  type AProvinceAsTheWorldIsMadeIt,
  type ARealmAsTheSetUpHandsIt,
  theCardDealt,
} from './what-every-stage-shares-the-shapes-it-hands-on-and-its-two-checks.ts';

/** What the set-up reads: the realms as the setup hands them, the map's size, and the game's options (its sea share). */
export interface WhatTheSetUpReads {
  readonly setupPlayers: readonly ARealmAsTheSetUpHandsIt[];
  readonly sz: { readonly cols: number; readonly rows: number };
  readonly genOpts: { readonly seaPct?: unknown } | null | undefined;
}

/** S0, the set-up: what the later stages read of it, made in generateNewGame's order (the provinces' list, still empty,
 *  is the one every later stage fills and changes in place). */
export function theSetUpTheMapsGridAndTheProvincesNames({ setupPlayers, sz, genOpts }: WhatTheSetUpReads) {
  const { cols, rows } = sz;
  const provinces: AProvinceAsTheWorldIsMadeIt[] = [];
  const seaPct = normSeaPct(genOpts?.seaPct);
  const seaTarget = seaPct / 100;
  const nameSet = new Set<string>();
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
  // (the sites' table holds the alignment that must be in the game: P1-19ay1)
  const hasPaganPlayer = setupPlayers.some((sp) => doTheRitualStonesStandWithARealmOf(sp.alignment));
  // the content's tables by any name: the humanoid races, the primal units' rows, the land armies by terrain and race,
  // the features by terrain, the units' names by type
  const humanoidRaces: ReadonlySet<string | null | undefined> = HUMANOID_RACES_GEN;
  const primalDefs: Readonly<Partial<Record<string, { readonly race?: string | undefined }>>> = PRIMAL_ARMY_DEFS_P;
  const armiesByTerrainAndRace: Readonly<
    Partial<Record<string, Readonly<Partial<Record<string, readonly string[]>>>>>
  > = PROVINCE_ARMIES_P;
  const featurePools: Readonly<Partial<Record<string, readonly string[]>>> = FEATURE_POOLS_P;
  const unitNamesByType: Readonly<Partial<Record<string, readonly string[]>>> = PRIMAL_UNIT_NAMES;

  // Hex neighbour offsets + helpers (defined up front — king placement below needs them).
  const offEven: readonly (readonly [number, number])[] = [
    [-1, -1],
    [-1, 0],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
  ];
  const offOdd: readonly (readonly [number, number])[] = [
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, 0],
    [1, 1],
  ];
  const cellIdRC = (r: number, c: number) => r * cols + c;
  const neighbourCells = (r: number, c: number) => {
    const offs = r % 2 === 0 ? offEven : offOdd;
    return offs
      .map(([dr, dc]) => {
        const nr = r + dr;
        if (nr < 0 || nr >= rows) return null;
        const nc = (((c + dc) % cols) + cols) % cols;
        return { r: nr, c: nc, id: cellIdRC(nr, nc) };
      })
      .filter((n): n is ACellOfTheGrid => Boolean(n));
  };
  const cellDistRC = (a: ACellOfTheGrid, b: ACellOfTheGrid) => {
    let dc = Math.abs(a.c - b.c);
    dc = Math.min(dc, cols - dc);
    const dr = Math.abs(a.r - b.r);
    return Math.max(dc, dr, (dc + dr) >> 1);
  };
  const navalLevelOf = (sp: ARealmAsTheSetUpHandsIt | undefined) => {
    let lvl = 0;
    if (sp?.skills)
      Object.entries(sp.skills).forEach(([k, v]) => {
        if (k.toLowerCase() === 'naval') lvl += Number(v);
      });
    return lvl;
  };
  const pickLand = () => {
    const t = THE_TERRAINS_A_LAND_PROVINCE_IS_DEALT_IN_THE_ORDER_THE_DIE_READS_THEM;
    return theCardDealt(t[Math.floor(kcRng() * t.length)]);
  };

  // ── THEMATIC PROVINCE NAMING ── Names are assigned in a dedicated pass AFTER the map is fully
  // populated (terrain, race and recruitable armies all final, including king home provinces), so
  // each province gets a name that fits both its people and its land — e.g. an Elven forest reads
  // very differently from an Orcish desert or a kraken-haunted deep.
  const NAME_PREFIX_BY_RACE = THE_FIRST_HALVES_OF_A_PROVINCES_NAME_BY_ITS_RACE;
  const NAME_PREFIX_PRIMAL = THE_FIRST_HALVES_OF_A_WILD_PROVINCES_NAME;
  const NAME_SUFFIX_BY_TERRAIN = THE_SECOND_HALVES_OF_A_PROVINCES_NAME_BY_ITS_TERRAIN;
  const NAME_SEA_BY_TYPE = THE_HALVES_OF_A_SEAS_NAME_BY_THE_KIND_OF_SEA;
  const pickFrom = (arr: readonly string[]) => arr[Math.floor(kcRng() * arr.length)];
  const toRoman = (n: number) => (THE_NUMERALS_A_REPEATED_PROVINCES_NAME_TAKES[n] ?? '') || String(n);
  // the name pools by any race's and any terrain's name
  const prefixesByRace: Readonly<Partial<Record<string, readonly string[]>>> = NAME_PREFIX_BY_RACE;
  const suffixesByTerrain: Readonly<Partial<Record<string, readonly string[]>>> = NAME_SUFFIX_BY_TERRAIN;
  const themedName = (p: AProvinceAsTheWorldIsMadeIt) => {
    if (p.terrain === 'sea') {
      let kind: keyof typeof NAME_SEA_BY_TYPE = 'open';
      if (p.race === theWildsSubRaceOf('Whale')) kind = 'whale';
      else if (p.race === theWildsSubRaceOf('Shark')) kind = 'shark';
      else if (isTheRaceOneOfTheWildsSubRaces(p.race)) kind = 'primal';
      const pool = NAME_SEA_BY_TYPE[kind];
      return String(pickFrom(pool.pre)) + String(pickFrom(pool.suf));
    }
    // Land: prefix reflects the people (or wild primal beasts), suffix reflects the terrain.
    const prePool = isTheRaceOneOfTheWildsSubRaces(p.race)
      ? NAME_PREFIX_PRIMAL
      : (prefixesByRace[String(p.race)] ?? NAME_PREFIX_BY_RACE[THE_RACE_A_COMPANY_OR_PROVINCE_OF_NO_RACE_READS_AS]);
    const sufPool = suffixesByTerrain[p.terrain] ?? NAME_SUFFIX_BY_TERRAIN.plain;
    return String(pickFrom(prePool)) + String(pickFrom(sufPool));
  };
  const nameAllProvinces = () => {
    provinces.forEach((p) => {
      let name: string,
        tries = 0;
      do {
        name = themedName(p);
        tries++;
      } while (nameSet.has(name) && tries < THE_PROVINCES_NAMES.theTriesForANameNotYetTaken);
      if (nameSet.has(name)) {
        let k = 2;
        while (nameSet.has(name + ' ' + toRoman(k))) k++;
        name = name + ' ' + toRoman(k);
      }
      nameSet.add(name);
      p.name = name;
    });
  };
  return {
    cols,
    rows,
    provinces,
    seaPct,
    seaTarget,
    hasPaganPlayer,
    humanoidRaces,
    primalDefs,
    armiesByTerrainAndRace,
    featurePools,
    unitNamesByType,
    offEven,
    offOdd,
    cellIdRC,
    neighbourCells,
    cellDistRC,
    navalLevelOf,
    pickLand,
    nameAllProvinces,
  };
}
