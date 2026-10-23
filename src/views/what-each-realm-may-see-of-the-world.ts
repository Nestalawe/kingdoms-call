// ── WHAT EACH REALM MAY SEE OF THE WORLD (plan P1-12b4: P1-12's Decision 11, part 1: the map and the provinces) ────
// playerView(state, realm, itsLines) is what one realm may see of the world once the turn is over, worked out in one
// place with the sight rules (src/engine/sight/) applied: the realm itself (me: whole, with its memory), the map's grid
// and centre, the province sets each sight rule gives, the hero it watches by Clairvoyance, and every province as this
// realm sees it: how (its own, a hero of its own there at the turn's end, spied, next to a spied one, next to its own
// land, once visited, next to one it owns or visited, remembered), what of it that sight shows, the features it knows
// and the heroes it sees there. The report's sections of the map and the provinces read only this
// (src/views/turn-report.ts: ownedProvinces, intel's lines of the provinces, knownFeatures, visitedProvinceIds,
// worldMeta, provinceOrderData and availableHeroesByProv; and buildReports' battle markers, provinceCharIntel and
// provinceEvents). P1-12b5 adds the rest of the heroes and the realms, and buildTurnReport then takes no state.
//
// Each fact of a province is here only when some section of the report shows it, under that section's sight (said
// above each), so the view holds no more of the world than the report does. The values are the world's own, copied as
// they are (no default put in: the sections keep the defaults they always had); where a fact comes from an engine
// helper TypeScript doesn't check yet (P1-10b), its type here is unknown. A record is read as a saved state may hold
// it (AsSaved: any field missing or null), so each guard the report's code had is kept.
//
// The two breaches the leak check lets through (P1-23's entries 2 and 4) are carried as they are, in fields named for
// them (knownBreach…), so P1-23 changes one field each.
//
// It writes nothing and draws no dice (tests/unit/the-reports-are-built-on-a-world-that-cannot-be-written.test.ts).
// The cases of each sight rule: tests/unit/what-each-realm-may-see-of-the-world.test.ts.
import { discTaxAdd, realmBaseTax, taxBonusCap } from '../engine/discoveries.ts';
import { gdActiveFor, homeFounderOf, homeProvinceIdFor, mapCentreColFor } from '../engine/grand-design.ts';
import { graveIntelFor } from '../engine/graves.ts';
import { graveServedOther } from '../engine/heroes/charms-and-neutrals.ts';
import { provinceConsecrated } from '../engine/heroes/fame-and-consecration.ts';
import { activeItems } from '../engine/items/equipment.ts';
import { monsterCatLabel } from '../engine/items/tiers-and-hoards.ts';
import { TITLES_PUBLIC_FROM_TURN } from '../engine/titles/perks.ts';
import {
  MINOR_TITLES,
  computeMinorTitles,
  computeStandings,
  extraSkillBonuses,
  reckoningBlocShare,
  reckoningCallEligibility,
  titleRaceFor,
} from '../engine/titles/reckoning.ts';
import { topSkillOf } from '../engine/rules-on-plain-values/skills-in-order-and-a-heros-fame-in-words.ts';
import { heroHireWage } from '../engine/rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import {
  armySizeBand,
  encounterUntargetableReason,
  enemyCharVisibleTo,
  featDiscovered,
  nearSpiedProvIds,
} from '../engine/sight/heroes-in-sight-features-discovered-and-army-size-bands.ts';
import type { SightContext } from '../engine/sight/heroes-in-sight-features-discovered-and-army-size-bands.ts';
import { garrisonMoveRate } from '../engine/units/movement.ts';
import type { Army, Character, GameState, Grave, Province, Realm } from '../schemas/saved-game-state.ts';

/** A record as a saved state may hold it: any field missing or null (an older save). */
type AsSaved<T> = { readonly [K in keyof T]?: T[K] | null | undefined };
const asSaved = <T>(x: T): AsSaved<T> => x;
/** A hero's skills as topSkillOf takes them: the levels he holds (one left undefined is skipped, as topSkillOf skips a
 *  level that isn't above 0). */
const skillsOf = (c: Character) => ({
  skills: Object.fromEntries(
    Object.entries(asSaved(c).skills ?? {}).filter((e): e is [string, number] => e[1] !== undefined),
  ),
});
/** A value of the world as it is: possibly missing or null. */
type AsItIs<T> = T | null | undefined;

/** What the realm's lines of the turn show (playerEvents, src/views/every-realms-report-and-the-lines-each-realm-
 *  reads.ts): the provinces it spied, and from which phase; the provinces whose battle it read a line of or stood on at
 *  some phase; and the province events it reads (env lines, before they are given their province's name). */
export interface WhatItsLinesShow {
  spiedProvincesAndTheirFirstPhase: Readonly<Record<string, number>>;
  provincesWithABattleLineItRead: ReadonlySet<unknown>;
  provincesItStoodOnAtSomePhase: ReadonlySet<unknown>;
  provinceEvents: readonly { provinceId: unknown }[];
}

/** A unit of an army as the realm sees it. Race, skeleton and the Wild Hunt's term: only where the report shows them
 *  (its own garrisons and the garrisons of provinces it has visited). */
export interface ArmyAsSeen {
  type: AsItIs<string>;
  quality: AsItIs<string>;
  unitName: AsItIs<string>;
  race?: AsItIs<string>;
  _isSkeletal?: AsItIs<boolean>;
  _wildHuntUntilTurn?: AsItIs<number>;
  /** How far and how an unled unit of its own moves (garrisonMoveRate): its own garrisons only. */
  movement?: unknown;
}

/** A hero as the realm sees him where he stands. */
export interface HeroAsSeen {
  id: AsItIs<number>;
  name: AsItIs<string>;
  isKing: AsItIs<boolean>;
  /** The realm he serves (null: none). */
  player: AsItIs<number>;
  isNeutralGuard: boolean;
  /** The name and colour of the realm he serves, as his banner shows them (undefined: he serves none). */
  realmName: AsItIs<string>;
  realmColor: AsItIs<string>;
  /** How many units he leads: for a hero of its own (and in P1-23's entry 4's list). */
  armyCount: number | null;
  /** The rough size of his force at a glance (armySizeBand): for anyone else's hero. */
  armyBand: string | null;
  /** The units he leads: in the province intelligence only, for a hero of its own or one in a province it spied. */
  armies?: ArmyAsSeen[] | null;
}

/** Another realm's hero, or one who serves no realm, as this realm sees him where he stands (P1-12b5): in the list of
 *  the heroes it sees (the map's sight rule: the hero sightings and the Encounter list) or of those beside its own heroes
 *  (the sight rule as that list has always asked it: no Spy's next-door glance; the Charm order's list). */
export interface OtherHeroAsSeen {
  id: AsItIs<number>;
  name: AsItIs<string>;
  isKing: AsItIs<boolean>;
  location: number;
  /** The realm he serves (null: none). */
  player: AsItIs<number>;
  isNeutralGuard: boolean;
  /** The name and colour of the realm he serves, as his banner shows them (undefined: he serves none). */
  realmName: AsItIs<string>;
  realmColor: AsItIs<string>;
  /** Whether he leads units, and their rough number at a glance (armySizeBand): never the exact count. */
  leadsArmies: boolean;
  armyBand: string;
  /** A hero who serves no realm: his race and alignment (public, as the Hire list shows them). */
  race?: AsItIs<string>;
  alignment?: AsItIs<string>;
  /** In the list of the heroes it sees, a hero who serves no realm: his temper, his fame (his best skill, topSkillOf)
   *  and what hiring him costs this realm (heroHireWage; null: he won't serve it, or he guards the province). */
  temper?: AsItIs<string>;
  topSkill?: { skill: string; level: number } | null;
  hireWage?: number | null;
  /** In the list of the heroes it sees, a hero of a realm: why he can't be encountered (encounterUntargetableReason),
   *  or null. */
  untargetable?: unknown;
  /** Beside its own: charmed last turn, so closed to Charm this turn. */
  charmImmune?: boolean;
  /** Beside its own, an unarmed hero who serves no realm and isn't a king: his skills, hit points and pay (the Charm
   *  order's card). */
  skills?: AsItIs<Character['skills']>;
  hp?: AsItIs<number>;
  maxHp?: AsItIs<number>;
  pay?: AsItIs<number>;
}

/** A fallen hero this realm knows of (P1-12b5): its own, one whose fall it saw this turn, one it has ever known of, or
 *  one whose body lies where it sees now (its own land, a hero of its own there, spied). As the graveyard records him,
 *  with the name of the province he lies in and whether he ever served another realm (graveServedOther). */
export interface GraveAsKnown {
  id: AsItIs<number>;
  name: AsItIs<string>;
  player: AsItIs<number>;
  killedOnTurn: AsItIs<number>;
  race: AsItIs<string>;
  alignment: AsItIs<string>;
  temper: AsItIs<string>;
  skills: AsItIs<Grave['skills']>;
  isKing: AsItIs<boolean>;
  _monarch: AsItIs<boolean>;
  location: AsItIs<number>;
  locationName: AsItIs<string>;
  servedOther: unknown;
}

/** Another realm as this realm knows it (P1-12b5). */
export interface RealmAsSeen {
  index: number;
  /** It has met the realm: itself, a realm it has encountered, or every realm once the game is over. */
  met: boolean;
  /** Its name and colour, once met (null before). */
  name: AsItIs<string>;
  color: AsItIs<string>;
  /** What its diplomacy card shows of a realm it has encountered (not itself): its alignment, whether it has conceded
   *  (and when) or been eliminated, and the relation between the two (undefined: none recorded, neutral). */
  alignment?: AsItIs<string>;
  conceded?: AsItIs<boolean>;
  concededTurn?: AsItIs<number>;
  eliminated?: AsItIs<boolean>;
  relation?: AsItIs<string>;
}

/** A wandering hero this realm could hire, where it sees him (the hiring list's sight: no Spy's next-door glance). */
export interface WandererAsSeen {
  id: AsItIs<number>;
  name: AsItIs<string>;
  race: AsItIs<string>;
  alignment: AsItIs<string>;
  temper: AsItIs<string>;
  /** His fame: his best skill (topSkillOf), never the whole list. */
  topSkill: { skill: string; level: number } | null;
  pay: AsItIs<number>;
  /** What hiring him costs this realm (heroHireWage; null: he won't serve it). */
  hireWage: number | null;
}

/** A feature of a province (a lair, a ruin, a ritual site) the realm knows: it has discovered it, explored the
 *  province far enough to see it (the feature's share of 100%), or it is a ritual site in the realm's own land. */
export interface FeatureAsKnown {
  /** Its place among the province's features (the order forms and the lair rumours name it by this). */
  index: number;
  name: AsItIs<string>;
  cleared: AsItIs<boolean>;
  ritualSite: AsItIs<boolean>;
  monsterName: AsItIs<string>;
  monsterPower: AsItIs<string>;
  tier: AsItIs<string>;
  monsterCat: unknown;
  /** Its treasure: once discovered (null before). */
  treasure: AsItIs<number>;
  /** Discovered by this realm (featDiscovered). */
  discovered: boolean;
  /** This realm has explored the province far enough to see it. */
  revealedByExploring: boolean;
}

/** The terror that grips a province, for an Evil realm (terrorReadingOf reads it): every province. */
export interface TerrorAsSeen {
  _terrorStacks: AsItIs<number>;
  _terrorTurn: AsItIs<number>;
  _terrorPct: AsItIs<number>;
  _terrorisedBy: AsItIs<number>;
}

/** How the realm sees a province. */
export interface HowSeen {
  /** Its own (the realm's list of provinces). */
  owned: boolean;
  /** One of its heroes has set foot in it, this turn or any before (visitedBy). */
  visited: boolean;
  /** Next to a province it owns or has visited, and neither itself. */
  nextToOwnedOrVisited: boolean;
  /** A hero of its own, alive, stands in it as the turn ends. */
  heroThere: boolean;
  /** It spied the province this turn (the realm's record). */
  spied: boolean;
  /** It spied the province this turn, by the lines it reads (its Spy's lines). */
  spiedByItsLines: boolean;
  /** Next to a province it spied this turn (seen as if a hero of its own stood there). */
  nextToSpied: boolean;
  /** Next to a province it owns, and not its own. */
  nextToOwned: boolean;
  /** The hero it watches by Clairvoyance ends the turn here. */
  watchedHeroThere: boolean;
  /** A province event it reads happened here. */
  aProvinceEventItReadsHappenedHere: boolean;
  /** It witnessed a battle here this turn: it read a line of the battle, or a hero of its own stood here at some phase. */
  witnessedABattle: boolean;
}

/** One province as the realm sees it: its place on the map always; the rest when, and as far as, it sees it. */
export interface ProvinceAsSeen {
  id: number;
  row: number;
  col: number;
  /** The provinces next to it, as the map draws them (the hex grid, wrapping east to west). */
  neighbours: number[];
  seen: HowSeen;
  /** How it looked when one of its heroes last saw it (the realm's memory), or null. */
  remembered: NonNullable<Realm['_provMemory']>[string] | null;
  /** How far this realm has explored it (its own record). */
  explored: AsItIs<number>;
  /** A hero of its own leads an army here now. */
  ownArmyHere: boolean;
  /** A hero of its own fought in personal combat here this turn. */
  thisRealmFoughtHere: boolean;
  /** The features it knows here, in the province's order. */
  features: FeatureAsKnown[];
  /** The wandering heroes here it could hire. */
  wanderersItCouldHire: WandererAsSeen[];
  /** Its name: when the realm sees the province now, it is in its order forms, it spied it, a line it reads happened
   *  here, or it sees a hero here. */
  name?: AsItIs<string>;
  /** Its land as it is (Illusory Terrain fools only the map): its own, visited, next to either, or a hero of its own
   *  there (the order forms). */
  terrain?: AsItIs<string>;
  /** Its land as it looks to this realm (an Illusory Terrain cast by another realm shows its false land): on the map. */
  terrainAsItLooks?: AsItIs<string>;
  /** Race, tax and the units it raises: on the map now, or in the order forms. */
  race?: AsItIs<string>;
  tax?: AsItIs<number>;
  armyTypes?: AsItIs<string[]>;
  /** Who holds it: on the map now, or once visited (the province intelligence). */
  owner?: AsItIs<number>;
  /** The name and colour of the realm that holds it, its capital's crown, its holy ground (Consecrate), its Wonder,
   *  and a battle left unresolved: on the map now. */
  ownerRealmName?: AsItIs<string>;
  ownerRealmColor?: AsItIs<string>;
  isHomeCapitalOfOwner?: boolean;
  consecrated?: unknown;
  grandDesign?: { name: AsItIs<string>; ownerRealmName: AsItIs<string>; active: unknown } | null;
  battleUnresolved?: AsItIs<boolean>;
  /** A battle was fought here this turn: on the map now, or a battle it witnessed. */
  hadBattleThisTurn?: AsItIs<boolean>;
  /** Its population, and whether it is the capital this realm founded: its own provinces. */
  population?: AsItIs<number>;
  foundedByThisRealm?: boolean;
  /** The last turn of an Enslave's resentment and the tax an earthquake still takes: its own provinces (the tax
   *  forecast). */
  _enslavedUntil?: AsItIs<number>;
  _earthquakeTax?: AsItIs<number>;
  /** The units garrisoned here: its own, visited, or a hero of its own there or spied (race, skeleton and the Wild
   *  Hunt's term for its own and visited ones only). */
  garrison?: ArmyAsSeen[];
  /** The neutral guard (a local chieftain and his armies, or the province's own defenders): its own or visited. The
   *  units themselves when its own or spied, else their number; the chieftain's race and skills when its own. */
  neutralGuard?: {
    leader: { id?: AsItIs<number>; name: AsItIs<string>; race?: AsItIs<string>; skills?: unknown } | null;
    armyCount: number;
    armies: ArmyAsSeen[] | null;
  };
  /** The heroes the map shows here (the sight rule: line of sight, Invisibility, a Spy's pierce, the Spy contest in its
   *  own land, the next-to-spied glance): its own provinces, a hero of its own there, spied, or next to a spied one. */
  heroesOnTheMap?: HeroAsSeen[];
  /** The heroes its province intelligence lists (the sight rule as that list has always asked it: no Spy contest in
   *  its own land, the provinces spied by its lines): a hero of its own there, or spied by its lines. */
  heroesInItsProvinceIntelligence?: HeroAsSeen[];
  /** An Evil realm sees the terror that grips every province. */
  terror?: TerrorAsSeen;
  /** KNOWN BREACH, P1-23's entry 2 (KNOWN_BREACHES' "an unmet realm"): a province it once visited and doesn't hold
   *  names the realm that holds it now, met or not. */
  knownBreachTheOwnersNameThoughItMayBeUnmet?: AsItIs<string>;
  /** KNOWN BREACH, P1-23's entry 4 (its KNOWN_BREACHES entry, ownedProvinces): in its own provinces, the heroes there
   *  as that list has always had them, each with the number of units he leads. */
  knownBreachEveryHeroThereSeenOrNot?: HeroAsSeen[];
}

/** What one realm may see of the world: the map and the provinces (P1-12b4), its heroes and the others it sees, the
 *  dead, the mercenaries, the realms, the titles and its books (P1-12b5). */
export interface PlayerView {
  realm: number;
  turn: number;
  /** The realm itself, whole, with its memory (provinces remembered, rumours, spied skills, discoveries). */
  me: Realm;
  map: { cols: number; rows: number; centreCol: unknown };
  /** The province sets each sight rule gives (the hero lists, the dead and the mercenaries read them). */
  sight: {
    owned: ReadonlySet<number>;
    visited: ReadonlySet<number>;
    heroThere: ReadonlySet<number>;
    spied: ReadonlySet<number>;
    nextToSpied: ReadonlySet<number>;
  };
  /** The hero it watches by Clairvoyance (alive, another realm's), and where he ends the turn. */
  watchedByClairvoyance: { hero: HeroAsSeen; location: number } | null;
  provinces: ProvinceAsSeen[];
  /** Its own heroes, whole: alive, or fallen this turn (so the report shows a fallen hero's own section), in the
   *  world's order. */
  ownHeroes: Character[];
  /** The bonuses each of them gets where he uses a skill, by his id (extraSkillBonuses: the minor titles he holds, the
   *  realm's Veteran Training), as the report has always worked them out: from this turn's minor titles once the
   *  titles are public, else last turn's. */
  extraSkillBonusesOfItsHeroes: Partial<Record<string, unknown>>;
  /** The heroes it sees, by the map's sight rule, in the world's order: the hero sightings and the Encounter list. */
  heroesItSees: OtherHeroAsSeen[];
  /** The heroes standing beside its own, by the sight rule as that list has always asked it, in the world's order. */
  heroesBesideItsOwn: OtherHeroAsSeen[];
  /** Of the heroes it has ever seen (its memory, and those beside its own now), the ids of those alive and serving a
   *  realm now (the Clairvoyance list keeps only those). */
  heroesItHasSeenAliveAndServingARealm: ReadonlySet<unknown>;
  /** The fallen heroes it knows of, in the graveyard's order. */
  theDeadItKnowsOf: GraveAsKnown[];
  /** The mercenaries where it sees now (its own land, a hero of its own there, spied), in their order. */
  mercenariesItSees: {
    id: AsItIs<string>;
    type: AsItIs<string>;
    quality: AsItIs<string>;
    unitName: AsItIs<string>;
    race: AsItIs<string>;
    location: AsItIs<number>;
    isSea: AsItIs<boolean>;
  }[];
  /** The graveyards it knows of, as graveIntelFor shapes them (with their provinces' names). */
  graveIntel: unknown;
  /** Every realm of the game, by index, as this realm knows it. */
  realms: RealmAsSeen[];
  /** Safe Start: no diplomacy before turn SAFE_START_TURN. */
  safeStart: boolean;
  /** The titles, worked out from the whole world (computeStandings, computeMinorTitles), as the report reads them. Who
   *  holds each title, the standings, the minor titles, and this realm's place in each race: from turn
   *  TITLES_PUBLIC_FROM_TURN, or once the game is over (null before). Always: its share of the world's tax for the
   *  Reckoning and whether it may call it, and the titles it won and lost this turn. The names of the realms and heroes
   *  these hold are as the world has them: the report writes "An unknown realm" for one it hasn't met (the Titles card). */
  titles: {
    public: boolean;
    holders: unknown;
    standings: unknown;
    minor: unknown;
    race: unknown;
    blocShare: unknown;
    eligibility: unknown;
    gains: unknown;
    losses: unknown;
    /** The name of each hero holding a title or a minor title, by his id (public titles only). */
    heroNames: ReadonlyMap<unknown, AsItIs<string>>;
    /** Last turn's minor titles held by its own heroes (the minor-title perks the report shows before the titles are
     *  public, and the Swift and the Sea-Wolf's march). */
    lastTurnsMinorHoldersOfItsHeroes: Partial<Record<string, unknown>>;
  };
  /** The Reckoning called (who called it, who stands with him, when it was called and when it resolves), or null. */
  reckoning: {
    by: AsItIs<number>;
    bloc: AsItIs<number[]>;
    calledTurn: AsItIs<number>;
    resolveAtTurn: AsItIs<number>;
  } | null;
  /** The game's end, as the world records it (public: every realm is named then), or null. */
  gameOver: GameState['gameOver'] | null;
  /** Its books: what its tax forecast and its wages need of the world. The bare tax of the provinces whose record names
   *  it their owner (realmBaseTax), the discoveries' tax gold of each of its provinces in its list's order (discTaxAdd,
   *  capped as the collector caps it; null where the province is missing), whether its Wonder blesses it (Good: tax;
   *  Druidic: wages), and the provinces whose record names it their owner (how many; their garrisons' units, which it
   *  pays). */
  books: {
    baseTax: unknown;
    discoveryTaxGoldOfEachOfItsProvinces: unknown[];
    wonderBlesses: { Good: boolean; Druidic: boolean };
    provincesItHoldsByTheirRecord: number;
    unitsGarrisonedInTheProvincesItHolds: Army[];
  };
  /** The tables the player portal colours names with (report-leaks' LOOKUP_TABLES): every realm's name and colour, and
   *  every hero alive or fallen this turn with a name and no cloak, with his realm's colour. Not trimmed to what the
   *  realm knows until P2-06 (Theo, 2026-10-17). */
  lookupTables: {
    realms: { name: AsItIs<string>; color: AsItIs<string> }[];
    heroes: { name: string; player: AsItIs<number>; realmColor: AsItIs<string>; isNeutralGuard: AsItIs<boolean> }[];
  };
}

// The hex grid's neighbours (an even row's and an odd row's), wrapping east to west, as the map draws them.
const OFFSETS_EVEN: readonly (readonly [number, number])[] = [
  [-1, -1],
  [-1, 0],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
];
const OFFSETS_ODD: readonly (readonly [number, number])[] = [
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, 0],
  [1, 1],
];

/** What realm `realm` may see of `state`, the world after the turn; `itsLines`, what its lines of the turn show
 *  (absent for a report built with no turn: Turn 0, the tests' staged worlds). */
export function playerView(state: GameState, realm: number, itsLines?: WhatItsLinesShow): PlayerView {
  const me = state.players[realm];
  if (!me) throw new Error(`playerView: there is no realm ${String(realm)}`);
  const player = asSaved(me);
  const { cols, rows, provinces } = state.world;
  const characters = state.characters;

  // ── The province sets (each sight rule's) ──
  const ownedProvIds = new Set<number>(player.provinces ?? []);
  const visitedProvIds = new Set<number>(
    provinces.filter((p) => (asSaved(p).visitedBy ?? []).includes(realm)).map((p) => p.id),
  );
  // next to a province it owns or visited (the order forms list them, for a recruit that fires if it takes one)
  const adjacentProvIds = new Set<number>();
  provinces.forEach((p) => {
    if (!visitedProvIds.has(p.id) && !ownedProvIds.has(p.id)) return;
    const offsets = p.row % 2 === 0 ? OFFSETS_EVEN : OFFSETS_ODD;
    offsets.forEach(([dr, dc]) => {
      const nr = p.row + dr;
      if (nr < 0 || nr >= rows) return;
      const nc = (((p.col + dc) % cols) + cols) % cols;
      const nid = nr * cols + nc;
      if (!visitedProvIds.has(nid) && !ownedProvIds.has(nid)) adjacentProvIds.add(nid);
    });
  });
  const ownCharLocs = new Set<number>(characters.filter((c) => c.alive && c.player === realm).map((c) => c.location));
  const spiedThisTurn = new Set<number>(player._spiedProvincesThisTurn ?? []);
  const nearSpied = nearSpiedProvIds(state, spiedThisTurn); // D2: seen as if a hero stood there
  // next to a province it owns: its borders, watched all turn
  const ownedAdjacentIds = new Set<number>();
  provinces.forEach((p) => {
    if (!ownedProvIds.has(p.id)) return;
    const offs = p.row % 2 === 0 ? OFFSETS_EVEN : OFFSETS_ODD;
    offs.forEach(([dr, dc]) => {
      const nr = p.row + dr;
      if (nr < 0 || nr >= rows) return;
      const nc = (((p.col + dc) % cols) + cols) % cols;
      const nid = nr * cols + nc;
      if (!ownedProvIds.has(nid)) ownedAdjacentIds.add(nid);
    });
  });
  const mem = player._provMemory ?? {};
  // the hero it watches by Clairvoyance is drawn wherever he ends the turn
  const clairId = player._clairCharThisTurn ?? null;
  const clairChar =
    clairId != null ? characters.find((x) => asSaved(x).id === clairId && x.alive && x.player !== realm) : undefined;
  const spiedByItsLines = new Set(Object.keys(itsLines?.spiedProvincesAndTheirFirstPhase ?? {}).map(Number));
  const provincesOfItsProvinceEvents = new Set((itsLines?.provinceEvents ?? []).map((e) => e.provinceId));
  const evil = player.alignment === 'Evil';
  const sd31 = (player.discoveries ?? []).some((d: AsItIs<{ id: string }>) => d?.id === 'sd31');

  // ── The sight rule's three questions (as each section has always asked it) ──
  const mapSight: SightContext = { ownedProvIds, ownCharLocs, spiedThisTurn, nearSpied };
  const hiringSight: SightContext = { ownedProvIds, ownCharLocs, spiedThisTurn };
  const provinceIntelligenceSight: SightContext = {
    ownedProvIds: new Set(),
    ownCharLocs,
    spiedThisTurn: spiedByItsLines,
  };

  const heroAsSeen = (c: Character, how: 'map' | 'everyHero' | 'intelligence', spied = false): HeroAsSeen => {
    const h = asSaved(c);
    const armies = h.armies ?? [];
    const own = h.player === realm;
    const realmOf = h.player != null ? asSaved(state.players[h.player]) : undefined;
    return {
      id: h.id,
      name: h.name,
      isKing: h.isKing,
      player: h.player,
      isNeutralGuard: !!h._isNeutralGuard,
      realmName: realmOf?.name,
      realmColor: realmOf?.color,
      armyCount: own || how === 'everyHero' ? armies.length : null,
      armyBand: own || how === 'everyHero' ? null : armySizeBand(armies.length),
      ...(how === 'intelligence'
        ? {
            armies:
              own || spied
                ? armies.map((a) => ({
                    type: asSaved(a).type,
                    quality: asSaved(a).quality,
                    unitName: asSaved(a).unitName,
                  }))
                : null,
          }
        : {}),
    };
  };
  // ── Its heroes, and the other heroes it sees (P1-12b5) ──
  const ownHeroes = characters.filter((c) => c.player === realm && (c.alive || c.killedThisTurn));
  // where its heroes stand, or fell this turn (the report names the province with each)
  const placesOfItsHeroes = new Set<number>(ownHeroes.map((c) => c.location));
  const otherHeroAsSeen = (c: Character, list: 'itSees' | 'besideItsOwn'): OtherHeroAsSeen => {
    const h = asSaved(c);
    const armies = h.armies ?? [];
    const realmOf = h.player != null ? asSaved(state.players[h.player]) : undefined;
    return {
      id: h.id,
      name: h.name,
      isKing: h.isKing,
      location: c.location,
      player: h.player,
      isNeutralGuard: !!h._isNeutralGuard,
      realmName: realmOf?.name,
      realmColor: realmOf?.color,
      leadsArmies: armies.length > 0,
      armyBand: armySizeBand(armies.length),
      // the hero sightings: a hero who serves no realm (player null) and one who serves a realm (any other)
      ...(list === 'itSees' && h.player === null
        ? {
            race: h.race,
            alignment: h.alignment,
            temper: h.temper,
            topSkill: topSkillOf(skillsOf(c)),
            hireWage: h._isNeutralGuard ? null : heroHireWage(me.alignment || 'Neutral', c.alignment, sd31, c),
          }
        : {}),
      ...(list === 'itSees' && h.player !== null ? { untargetable: encounterUntargetableReason(c) } : {}),
      // the list beside its own heroes: a hero who serves no realm (player null or missing)
      ...(list === 'besideItsOwn' && h.player == null ? { race: h.race, alignment: h.alignment } : {}),
      ...(list === 'besideItsOwn' ? { charmImmune: h._charmImmuneTurn === (state.turn || 1) } : {}),
      ...(list === 'besideItsOwn' && h.player == null && !h.isKing && armies.length === 0
        ? { skills: h.skills, temper: h.temper, hp: h.hp, maxHp: h.maxHp, pay: h.pay }
        : {}),
    };
  };
  // the map's sight rule (the hero sightings and the Encounter list); the list beside its own heroes asks it as it has
  // always asked it (the hiring list's sight)
  const heroesItSees = characters
    .filter((c) => c.alive && c.player !== realm && enemyCharVisibleTo(state, realm, c, mapSight))
    .map((c) => otherHeroAsSeen(c, 'itSees'));
  const heroesBesideItsOwn = characters
    .filter(
      (c) =>
        c.alive &&
        c.player !== realm &&
        ownCharLocs.has(c.location) &&
        enemyCharVisibleTo(state, realm, c, hiringSight),
    )
    .map((c) => otherHeroAsSeen(c, 'besideItsOwn'));
  // of the heroes it has ever seen, those alive and serving a realm now
  const heroesItHasSeen = new Set<unknown>([
    ...Object.values(player.seenCharIntel ?? {}).map((x) => x.id),
    ...heroesBesideItsOwn.map((x) => x.id),
  ]);
  const heroesItHasSeenAliveAndServingARealm = new Set<unknown>(
    [...heroesItHasSeen].filter((id) => {
      const live = characters.find((ch) => ch.id === id);
      return !!live && live.alive && live.player != null;
    }),
  );

  // ── The dead it knows of, and the mercenaries where it sees now (P1-12b5) ──
  const world = asSaved(state);
  const seenDeadThisTurn = new Set<unknown>(player.seenDeadHeroIds ?? []);
  const deadKnownEver = new Set<unknown>(player.knownDeadHeroIds ?? []);
  const inSightNow = new Set<unknown>([...ownedProvIds, ...ownCharLocs, ...spiedThisTurn]);
  const theDeadItKnowsOf: GraveAsKnown[] = (world.heroGraveyard ?? [])
    .filter((g) => {
      const r = asSaved(g);
      return (
        r.player === realm ||
        deadKnownEver.has(r.id) ||
        seenDeadThisTurn.has(r.id) ||
        (r.location != null && inSightNow.has(r.location))
      );
    })
    .map((g) => {
      const r = asSaved(g);
      const servedOther: unknown = graveServedOther(g, realm);
      return {
        id: r.id,
        name: r.name,
        player: r.player,
        killedOnTurn: r.killedOnTurn,
        race: r.race,
        alignment: r.alignment,
        temper: r.temper,
        skills: r.skills,
        isKing: r.isKing,
        _monarch: r._monarch,
        location: r.location,
        locationName: r.location != null ? asSaved(provinces[r.location])?.name : undefined,
        servedOther,
      };
    });
  const mercenariesItSees = (world.mercenaries ?? [])
    .filter((m) => inSightNow.has(m.location))
    .map((m) => {
      const r = asSaved(m);
      return {
        id: r.id,
        type: r.type,
        quality: r.quality,
        unitName: r.unitName,
        race: r.race,
        location: r.location,
        isSea: r.isSea,
      };
    });

  // ── The realms, as it knows them (P1-12b5) ──
  const encountered = player._encountered ?? [];
  const metRealms = new Set<unknown>([realm, ...encountered]);
  const realmsAsSaved: readonly AsItIs<Realm>[] = state.players;
  const realms: RealmAsSeen[] = realmsAsSaved.map((p, i) => {
    const met = metRealms.has(i) || !!world.gameOver;
    const relationKey = realm < i ? `${String(realm)}-${String(i)}` : `${String(i)}-${String(realm)}`;
    return {
      index: i,
      met,
      name: met ? p?.name : null,
      color: met ? p?.color : null,
      ...(i !== realm && encountered.includes(i)
        ? {
            alignment: p?.alignment,
            conceded: p?.conceded,
            concededTurn: p?.concededTurn,
            eliminated: p?._eliminated,
            relation: world.relations?.[relationKey],
          }
        : {}),
    };
  });

  // ── The titles, worked out from the whole world as the report always has (P1-12b5) ──
  const titlesPublic = (state.turn || 1) >= TITLES_PUBLIC_FROM_TURN || !!world.gameOver;
  const standingsNow = computeStandings(state); // worked out whether public or not, as the Titles card always has
  const minorNow: Partial<Record<string, unknown>> = titlesPublic ? computeMinorTitles(state) : {};
  const lastTurnsMinor: Partial<Record<string, unknown>> = world._minorHolders ?? {};
  const charIdOf = (h: unknown): unknown =>
    typeof h === 'object' && h !== null && 'charId' in h ? h.charId : undefined;
  const idsOfItsHeroes = new Set<unknown>(ownHeroes.map((c) => c.id));
  // the minor titles whose perks count for its heroes: this turn's once public, else last turn's
  const minorTitlesThatCount: Partial<Record<string, unknown>> = {};
  MINOR_TITLES.forEach((t) => {
    // (the report's `||`: the same here, a holder being a record or nothing)
    const h = minorNow[t.key] ?? lastTurnsMinor[t.key];
    if (h) minorTitlesThatCount[t.key] = h;
  });
  const extraSkillBonusesOfItsHeroes: Partial<Record<string, unknown>> = {};
  ownHeroes.forEach((c) => {
    extraSkillBonusesOfItsHeroes[String(c.id)] = extraSkillBonuses(c, state, minorTitlesThatCount);
  });
  const heroNames = new Map<unknown, AsItIs<string>>();
  if (titlesPublic) {
    const holders: Partial<Record<string, unknown>> = standingsNow.titles;
    [...Object.values(holders), ...Object.values(minorNow)].forEach((h) => {
      const id = charIdOf(h);
      if (id != null) heroNames.set(id, characters.find((c) => c.id === id)?.name);
    });
  }
  const rk = world.reckoning;

  // ── Its books (P1-12b5): what its tax forecast and wages need of the world ──
  const baseTax: unknown = realmBaseTax(state, realm);
  const discoveryTaxAccounts = new Map<unknown, unknown>();
  const discoveryTaxCap: unknown = taxBonusCap(baseTax);
  const discoveryTaxGoldOfEachOfItsProvinces = (player.provinces ?? []).map((pid) => {
    const pv = provinces[pid];
    return pv ? discTaxAdd(me, pv, state, realm, discoveryTaxAccounts, discoveryTaxCap) : null;
  });
  const provincesItHoldsByTheirRecord = provinces.filter((p) => p.owner === realm);

  const armyAsSeen = (a: Army, whole: boolean, ownGarrison: boolean): ArmyAsSeen => {
    const s = asSaved(a);
    return {
      type: s.type,
      quality: s.quality,
      unitName: s.unitName,
      ...(whole ? { race: s.race, _isSkeletal: s._isSkeletal, _wildHuntUntilTurn: s._wildHuntUntilTurn } : {}),
      ...(ownGarrison ? { movement: garrisonMoveRate(a, me) } : {}),
    };
  };

  const provinceAsSeen = (p: Province): ProvinceAsSeen => {
    const q = asSaved(p);
    const owned = ownedProvIds.has(p.id);
    const visited = visitedProvIds.has(p.id);
    const heroThere = ownCharLocs.has(p.id);
    const spied = spiedThisTurn.has(p.id);
    const nextToSpied = nearSpied.has(p.id);
    const nextToOwned = ownedAdjacentIds.has(p.id);
    const watchedHeroThere = clairChar?.location === p.id;
    const spiedHereByItsLines = spiedByItsLines.has(p.id);
    const seen: HowSeen = {
      owned,
      visited,
      nextToOwnedOrVisited: adjacentProvIds.has(p.id),
      heroThere,
      spied,
      spiedByItsLines: spiedHereByItsLines,
      nextToSpied,
      nextToOwned,
      watchedHeroThere,
      aProvinceEventItReadsHappenedHere: provincesOfItsProvinceEvents.has(p.id),
      witnessedABattle:
        !!itsLines &&
        (itsLines.provincesWithABattleLineItRead.has(p.id) || itsLines.provincesItStoodOnAtSomePhase.has(p.id)),
    };
    // The sights the sections read under (each fact below names the ones it is shown under).
    const onTheMapNow = owned || heroThere || spied || nextToOwned || nextToSpied || watchedHeroThere;
    const inItsOrderForms = owned || visited || seen.nextToOwnedOrVisited || heroThere;

    const neighbours = (p.row % 2 === 0 ? OFFSETS_EVEN : OFFSETS_ODD)
      .map(([dr, dc]) => {
        const nr = p.row + dr;
        if (nr < 0 || nr >= rows) return null;
        const nc = (((p.col + dc) % cols) + cols) % cols;
        return nr * cols + nc;
      })
      .filter((n) => n !== null);

    const total = (q.features ?? []).length;
    const explored = q.exploredBy?.[String(realm)] ?? 0;
    const features: FeatureAsKnown[] = [];
    (q.features ?? []).forEach((f, idx) => {
      const threshold = total > 0 ? Math.ceil(100 / total) * (idx + 1) : 100;
      const discovered = featDiscovered(f, realm);
      const revealedByExploring = explored >= threshold;
      if (!(discovered || revealedByExploring || (owned && !!f.ritualSite))) return;
      const g = asSaved(f);
      features.push({
        index: idx,
        name: g.name,
        cleared: g.cleared,
        ritualSite: g.ritualSite,
        monsterName: g.monster?.name,
        monsterPower: g.monster?.power,
        tier: g.tier,
        monsterCat: monsterCatLabel(f.monster),
        treasure: discovered ? g.treasure : null,
        discovered,
        revealedByExploring,
      });
    });

    const wanderersItCouldHire: WandererAsSeen[] = characters
      .filter(
        (c) =>
          c.player === null &&
          c.alive &&
          c.location === p.id &&
          !asSaved(c)._isNeutralGuard &&
          !asSaved(c)._justDefeated &&
          enemyCharVisibleTo(state, realm, c, hiringSight),
      )
      .map((h) => ({
        id: asSaved(h).id,
        name: asSaved(h).name,
        race: asSaved(h).race,
        alignment: asSaved(h).alignment,
        temper: asSaved(h).temper,
        topSkill: topSkillOf(skillsOf(h)),
        pay: asSaved(h).pay,
        hireWage: heroHireWage(me.alignment || 'Neutral', h.alignment, sd31, h),
      }));

    const heroesOnTheMap =
      owned || heroThere || spied || nextToSpied
        ? (q.characters ?? []).flatMap((cid) => {
            const c = characters[cid];
            if (!c?.alive) return [];
            if (c.player !== realm && !enemyCharVisibleTo(state, realm, c, mapSight)) return [];
            return [heroAsSeen(c, 'map')];
          })
        : null;
    const heroesInItsProvinceIntelligence =
      heroThere || spiedHereByItsLines
        ? characters
            .filter((c) => c.alive && c.location === p.id)
            .filter((c) => c.player === realm || enemyCharVisibleTo(state, realm, c, provinceIntelligenceSight))
            .map((c) => heroAsSeen(c, 'intelligence', spiedHereByItsLines))
        : null;
    const named =
      onTheMapNow ||
      inItsOrderForms ||
      spiedHereByItsLines ||
      seen.aProvinceEventItReadsHappenedHere ||
      wanderersItCouldHire.length > 0 ||
      (heroesOnTheMap ?? []).length > 0 ||
      (heroesInItsProvinceIntelligence ?? []).length > 0 ||
      placesOfItsHeroes.has(p.id);

    // the neutral guard: a local chieftain leading the province's defenders, else the defenders it keeps
    const guard =
      owned || visited
        ? characters.find((c) => c.alive && c.player === null && asSaved(c)._isNeutralGuard && c.location === p.id)
        : undefined;
    const guardArmies = guard ? (asSaved(guard).armies ?? []) : (q.neutralDefenders ?? []);
    const ownerRealm = q.owner != null ? asSaved(state.players[q.owner]) : undefined;
    const gd = q.grandDesign;

    return {
      id: p.id,
      row: p.row,
      col: p.col,
      neighbours,
      seen,
      remembered: mem[String(p.id)] ?? null,
      explored: q.exploredBy?.[String(realm)],
      ownArmyHere: characters.some(
        (c) => c.alive && c.player === realm && c.location === p.id && (asSaved(c).armies ?? []).length > 0,
      ),
      thisRealmFoughtHere: (q._combatPlayersThisTurn ?? []).includes(realm),
      features,
      wanderersItCouldHire,
      ...(named ? { name: q.name } : {}),
      ...(inItsOrderForms ? { terrain: q.terrain } : {}),
      ...(onTheMapNow
        ? {
            terrainAsItLooks:
              q._illusoryTerrain && q._illusoryTerrain.caster !== realm ? q._illusoryTerrain.fake : q.terrain,
          }
        : {}),
      ...(onTheMapNow || inItsOrderForms ? { race: q.race, tax: q.tax, armyTypes: q.armyTypes } : {}),
      ...(onTheMapNow || visited ? { owner: q.owner } : {}),
      ...(onTheMapNow
        ? {
            ownerRealmName: ownerRealm?.name,
            ownerRealmColor: ownerRealm?.color,
            isHomeCapitalOfOwner: q.owner != null && homeProvinceIdFor(state, q.owner) === p.id,
            consecrated: provinceConsecrated(state, p),
            grandDesign: gd
              ? {
                  name: gd.name,
                  ownerRealmName: asSaved(state.players[gd.owner])?.name,
                  active: gdActiveFor(state, gd.owner, undefined),
                }
              : null,
            battleUnresolved: q._battleUnresolved,
          }
        : {}),
      ...(onTheMapNow || seen.witnessedABattle ? { hadBattleThisTurn: q._hadBattleThisTurn } : {}),
      ...(owned
        ? {
            population: q.population,
            foundedByThisRealm: homeFounderOf(state, p.id) === realm,
            _enslavedUntil: q._enslavedUntil,
            _earthquakeTax: q._earthquakeTax,
          }
        : {}),
      ...(owned || visited || heroThere || spied
        ? { garrison: (q.garrisonArmies ?? []).map((a) => armyAsSeen(a, owned || visited, owned)) }
        : {}),
      ...(owned || visited
        ? {
            neutralGuard: {
              leader: guard
                ? owned
                  ? { id: guard.id, name: guard.name, race: guard.race, skills: guard.skills }
                  : { name: guard.name }
                : null,
              armyCount: guardArmies.length,
              armies: owned || spied ? guardArmies.map((a) => armyAsSeen(a, false, false)) : null,
            },
          }
        : {}),
      ...(heroesOnTheMap ? { heroesOnTheMap } : {}),
      ...(heroesInItsProvinceIntelligence ? { heroesInItsProvinceIntelligence } : {}),
      ...(evil
        ? {
            terror: {
              _terrorStacks: q._terrorStacks,
              _terrorTurn: q._terrorTurn,
              _terrorPct: q._terrorPct,
              _terrorisedBy: q._terrorisedBy,
            },
          }
        : {}),
      ...(visited && !owned ? { knownBreachTheOwnersNameThoughItMayBeUnmet: ownerRealm?.name } : {}),
      ...(owned
        ? {
            knownBreachEveryHeroThereSeenOrNot: (q.characters ?? []).flatMap((cid) => {
              const c = characters[cid];
              return c?.alive ? [heroAsSeen(c, 'everyHero')] : [];
            }),
          }
        : {}),
    };
  };

  return {
    realm,
    turn: state.turn,
    me,
    map: { cols, rows, centreCol: mapCentreColFor(state, realm) },
    sight: {
      owned: ownedProvIds,
      visited: visitedProvIds,
      heroThere: ownCharLocs,
      spied: spiedThisTurn,
      nextToSpied: nearSpied,
    },
    watchedByClairvoyance: clairChar ? { hero: heroAsSeen(clairChar, 'map'), location: clairChar.location } : null,
    provinces: provinces.map(provinceAsSeen),
    ownHeroes,
    extraSkillBonusesOfItsHeroes,
    heroesItSees,
    heroesBesideItsOwn,
    heroesItHasSeenAliveAndServingARealm,
    theDeadItKnowsOf,
    mercenariesItSees,
    graveIntel: graveIntelFor(state, me),
    realms,
    safeStart: !!world.safeStart,
    titles: {
      public: titlesPublic,
      holders: titlesPublic ? standingsNow.titles : null,
      standings: titlesPublic ? standingsNow.standings : null,
      minor: titlesPublic ? minorNow : null,
      race: titlesPublic ? titleRaceFor(state, standingsNow, realm) : null,
      blocShare: reckoningBlocShare(state, realm),
      eligibility: reckoningCallEligibility(state, realm),
      gains: world._titleGainsByPlayer?.[String(realm)] ?? [],
      losses: world._titleLossesByPlayer?.[String(realm)] ?? [],
      heroNames,
      lastTurnsMinorHoldersOfItsHeroes: Object.fromEntries(
        Object.entries(lastTurnsMinor).filter(([, h]) => idsOfItsHeroes.has(charIdOf(h))),
      ),
    },
    reckoning: rk ? { by: rk.by, bloc: rk.bloc, calledTurn: rk.calledTurn, resolveAtTurn: rk.resolveAtTurn } : null,
    gameOver: world.gameOver ?? null,
    books: {
      baseTax,
      discoveryTaxGoldOfEachOfItsProvinces,
      wonderBlesses: { Good: gdActiveFor(state, realm, 'Good'), Druidic: gdActiveFor(state, realm, 'Druidic') },
      provincesItHoldsByTheirRecord: provincesItHoldsByTheirRecord.length,
      unitsGarrisonedInTheProvincesItHolds: provincesItHoldsByTheirRecord.flatMap(
        (p) => asSaved(p).garrisonArmies ?? [],
      ),
    },
    lookupTables: {
      realms: realmsAsSaved.map((p) => ({ name: p?.name, color: p?.color })),
      heroes: characters
        .filter(
          (c) =>
            !!c.name &&
            (c.alive || c.killedThisTurn) &&
            !activeItems(c).some((it) => asSaved(it).effect?.stat === 'hidden'),
        )
        .map((c) => ({
          name: c.name,
          player: asSaved(c).player,
          realmColor: c.player != null ? realmsAsSaved[c.player]?.color : undefined,
          isNeutralGuard: asSaved(c)._isNeutralGuard,
        })),
    },
  };
}
