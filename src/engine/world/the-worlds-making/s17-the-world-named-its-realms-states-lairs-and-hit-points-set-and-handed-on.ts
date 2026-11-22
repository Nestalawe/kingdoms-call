// S17 of the world's making (generateNewGame, src/engine/world/generate.ts; the stages: docs/architecture/
// the-worlds-making-its-stages-their-files-and-how-a-stage-is-moved-into-one.md): the world named and handed on. The
// naming pass, the kings' and heroes' empty turn orders, the new game's state (the realms all at peace), the dwarves'
// mithril, the lairs' grades, names and hoards, every hero's hit points, and the save's marks.
import { THE_SAVED_GAMES_VERSION_THIS_BUILD_WRITES } from '../../saves/the-saved-games-version-this-build-writes.ts';
import { renameLairsThematicP } from '../../names.ts';
import { ITEMS_BY_TIER } from '../../items/tiers-and-hoards.ts';
import { ensureAllLairHoards } from '../../items/lair-items.ts';
import { GUARDIAN_TABLE_VER, computeMaxHp, maxHpPlayers } from '../../heroes/skills-and-hp.ts';
import { grantMithrilToDwarves } from '../../personal-combat/helpers.ts';
import { assignLairGrades } from '../../chances-and-lair-grades.ts';
import type { eachHomeTailoredAndItsKingAndHeroesMade } from './s09-each-home-tailored-and-its-king-and-heroes-made.ts';
import type {
  AHeroAsTheWorldMakesHim,
  AProvinceAsTheWorldIsMadeIt,
} from './what-every-stage-shares-the-shapes-it-hands-on-and-its-two-checks.ts';

/** The realms as the homes (S9) make them: the new game's state holds them as they are. */
type TheRealmsAsTheHomesMakeThem = ReturnType<typeof eachHomeTailoredAndItsKingAndHeroesMade>['players'];

/** What the world named and handed on reads: the map's size as the call gives it and as the set-up (S0) makes it,
 *  the set-up's provinces' list, sea share and naming pass, the homes' (S9's) realms, the heroes (S9 and S16), and the
 *  game's last turn. */
export interface WhatTheWorldNamedAndHandedOnReads {
  readonly sz: { readonly cols: number; readonly rows: number };
  readonly maxTurns: number;
  readonly cols: number;
  readonly rows: number;
  readonly provinces: AProvinceAsTheWorldIsMadeIt[];
  readonly seaPct: number;
  readonly nameAllProvinces: () => void;
  readonly players: TheRealmsAsTheHomesMakeThem;
  readonly allChars: AHeroAsTheWorldMakesHim[];
}

/** S17, the world named and handed on: the provinces named and the heroes pointed at their names, the turn orders,
 *  the state, the mithril, the lairs graded, named and stocked, the hit points; it returns the new game's state. */
export function theWorldNamedItsRealmsStatesLairsAndHitPointsSetAndHandedOn({
  sz,
  maxTurns,
  cols,
  rows,
  provinces,
  seaPct,
  nameAllProvinces,
  players,
  allChars,
}: WhatTheWorldNamedAndHandedOnReads) {
  // ── THEMATIC NAMING PASS ── Every province now has its final terrain, race and army pool
  // (including king home provinces), so name them all thematically here, then point each
  // character's stored location name at the freshly-named province they occupy.
  nameAllProvinces();
  allChars.forEach((c) => {
    const pv = provinces[c.location];
    if (pv) c.locationName = pv.name;
  });

  // Build turnOrders
  const turnOrders: Partial<Record<number, null[]>> = {};
  allChars
    .filter((c) => c.player !== null && c.alive)
    .forEach((c) => {
      turnOrders[c.id] = [null, null, null, null, null];
    });

  const _newGameState = {
    world: { provinces, cols, rows, seaPct },
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
  // the save's marks, then the save's shape as this build writes it (P1-15c), on the same object in the same order
  return Object.assign(_newGameState, {
    _maxHpV2: true,
    _maxHpV3: true,
    _guardiansV2: true,
    _guardiansVer: GUARDIAN_TABLE_VER,
    schemaVersion: THE_SAVED_GAMES_VERSION_THIS_BUILD_WRITES,
  });
}
