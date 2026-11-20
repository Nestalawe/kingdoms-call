// The turn's board (plan P1-08i3), on the engine's modules, imported directly, with no vm. P1-14m moved its tests here
// from the vm's board (since deleted): the same names, the same members on the board and the same staging, so each
// moved test kept its cases and its checks.
//
//   const engine = await loadTheEngineOnItsModules({ seed });   // fresh modules, the dice seeded `seed`
//   quietEngineLog(engine);
//   const world = botWorld(engine, 3, { cols: 10, rows: 8 });   // the vm's botWorld at the same seed, byte for byte
//   const { resolveMoveOrder } = await import('../../src/engine/orders/move-order-….ts');   // after the engine
//   const b = board(engine, world, 0);
//   const A = hero(b, { player: 0, at: b.X, troops: 2 });
//   withDice(engine, [0.1], () => resolveMoveOrder(b.tc, …));
//
// Each board is a fresh turn's context in one phase, on the world's JSON: the province at row 4, column 5 (X), its six
// neighbours (ring1) and theirs (ring2) are open plain, unowned, with no garrison, guard or lair; nobody stands anywhere
// and nobody has orders. Realms 0 and 1 are at war, 0 and 2 allied, 1 and 2 at peace. playTurn plays a whole turn
// from a board as staged. The context's fields come from lib/the-fields-resolve-turn-adds-to-the-turns-context.ts, the
// one list of them.
//
// Fresh modules (docs/architecture/how-the-tests-reach-the-site.md, "The engine's modules"): loadTheEngineOnItsModules
// calls vi.resetModules() and imports the whole engine again before it seeds the dice, as lib/engine.ts's loadEngine
// seeds a new vm. A module the test imports after it (`await import(…)`: a function to call, or one to stand in with
// vi.spyOn) is the same fresh one the board and the turn use. withDice and firstDie pin the modules' kcRng; withRolls
// fixes the modules' d100 (and pctRoll, which calls d100 inside its own file, where a stand-in doesn't reach).
//
// The types, `hero`, `playTurn` and the members a case reaches the engine through are
// tests/lib/the-board-a-case-is-staged-on-either-way.ts's (the case files import that file). On the modules a name is
// the export of the one module that defines it (`theModuleThatDefines`), and a stand-in is vi.spyOn on that module,
// which reaches the calls from other files only (docs/traps.md).
//
// tests/lib/the-middle-of-a-bot-world-on-the-engines-modules.ts (aBotBoard) is the bots' board: no turn's context, a
// world made on each call, and its own types; this file is the turn's board.
import { vi } from 'vitest';
import { addTheFieldsResolveTurnAdds } from './the-fields-resolve-turn-adds-to-the-turns-context.ts';
import {
  must,
  type AFunctionOfTheEngines,
  type AFunctionOrTableOfTheEngines,
  type Board as TheBoardACaseIsStagedOn,
  type Dice,
  type ExperienceRoll,
  type Line,
  type Order,
  type Province,
  type World,
} from './the-board-a-case-is-staged-on-either-way.ts';

// The shared types and the functions that go through the board a case is handed: one home, both boards
// (tests/lib/the-board-a-case-is-staged-on-either-way.ts).
export {
  allText,
  hero,
  linesOf,
  must,
  order,
  plan,
  playTurn,
  points,
  type Character,
  type HeroSpec,
  type Line,
  type Order,
  type PlayedTurn,
  type Province,
  type RealmSends,
  type TurnContext,
  type Unit,
  type World,
} from './the-board-a-case-is-staged-on-either-way.ts';

/** The engine's modules, fresh, with the dice seeded `seed`: lib/engine.ts's loadEngine({ seed }), on the modules. It
 *  holds what the board, the dice and the turn call; a test imports the rest after it (`await import(…)`). */
export async function loadTheEngineOnItsModules({ seed }: { seed: number }) {
  vi.resetModules();
  await import('./the-whole-engine.ts');
  const { kcRng } = await import('../../src/engine/rng.ts');
  const theDiceModule = await import('../../src/engine/dice-and-army-names.ts');
  const theExperienceModule = await import('../../src/engine/heroes/experience-skill-rises-and-earned-hp.ts');
  const theBotsEconomy = await import('../../src/engine/bots/economy.ts');
  const { KC_SEASONS } = await import('../../src/content/kingdoms-call-data.ts');
  const { generateBotSetups, isBotRow } = await import('../../src/engine/bots/setup.ts');
  const { generateNewGame } = await import('../../src/engine/world/generate.ts');
  const { getNeighborsP } = await import('../../src/engine/world/map-helpers.ts');
  const { createTurnContext } = await import('../../src/engine/turn/context.ts');
  const { resolveTurn } = await import('../../src/engine/run-turn.ts');
  const { theTurnsLinesInWords } = await import('../../src/views/prose/the-words-of-each-line.ts');
  const theModuleThatDefines = await theModulesThatDefineWhatACaseReads();
  kcRng.seed(seed);
  return {
    /** The console the modules log to (emit echoes each line of the GM's log there): this process's, as the vm's was. */
    console,
    kcRng,
    theDiceModule,
    theExperienceModule,
    /** The bots' last pass, and a stand-in for it on its module (asTheBotsPlan), each named. */
    runBotOrderHygiene: theBotsEconomy.runBotOrderHygiene,
    standInForTheBotsLastPass: () => vi.spyOn(theBotsEconomy, 'runBotOrderHygiene'),
    KC_SEASONS,
    generateBotSetups,
    isBotRow,
    generateNewGame,
    getNeighborsP,
    createTurnContext,
    resolveTurn,
    theTurnsLinesInWords,
    theModuleThatDefines,
  };
}
export type TheEngineOnItsModules = Awaited<ReturnType<typeof loadTheEngineOnItsModules>>;

/** The module of the engine's that defines each function and table a case reads by name (after the whole engine, so
 *  the fresh one the turn uses). */
async function theModulesThatDefineWhatACaseReads() {
  const data = await import('../../src/content/kingdoms-call-data.ts');
  const theTurn = await import('../../src/engine/run-turn.ts');
  const theReports = await import('../../src/views/every-realms-report-and-the-lines-each-realm-reads.ts');
  const theWords = await import('../../src/views/prose/the-words-of-each-line.ts');
  const setUp =
    await import('../../src/engine/turn/set-up-the-turns-start-repairs-and-the-merge-of-the-realms-orders.ts');
  const beforeTheFirstPhase =
    await import('../../src/engine/turn/before-the-first-phase-war-without-warning-research-choices-messages-move-pools-and-default-defend.ts');
  const phaseStages =
    await import('../../src/engine/turn/phase-stages-start-intents-and-reactions-orders-in-two-tiers-and-end.ts');
  const afterThePhases =
    await import('../../src/engine/turn/after-the-phases-stand-offs-the-dead-graves-couriers-mass-healing-cowards-and-location-names.ts');
  const diplomacyAndVictory =
    await import('../../src/engine/turn/diplomacy-resolution-and-victory-the-reckoning-elimination-concession-and-the-announcement.ts');
  const botDiplomacy =
    await import('../../src/engine/bots/bot-diplomacy-treats-and-wars-by-alignment-the-grudge-and-a-reckoning-claim.ts');
  const botWar = await import('../../src/engine/bots/war.ts');
  const botIntel = await import('../../src/engine/bots/intel.ts');
  const botsPlan =
    await import('../../src/engine/bots/bot-realms-plan-the-turn-concessions-movement-muster-economy-actions-hygiene-the-reckoning-and-the-duel-forecast.ts');
  const botMissions = await import('../../src/engine/bots/missions.ts');
  const botMovement = await import('../../src/engine/bots/movement.ts');
  const botPhaseOne = await import('../../src/engine/bots/phase-one.ts');
  const botEconomy = await import('../../src/engine/bots/economy.ts');
  const botSpellcraft = await import('../../src/engine/bots/spellcraft.ts');
  const reckoning = await import('../../src/engine/titles/reckoning.ts');
  const personalCombat = await import('../../src/engine/personal-combat/resolve-personal-combat.ts');
  const terrain = await import('../../src/engine/battle/terrain-and-unit-strength.ts');
  const baseStrength = await import('../../src/engine/rules-on-plain-values/unit-types-and-base-strength.ts');
  const flyOrSail =
    await import('../../src/engine/rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts');
  const fame = await import('../../src/engine/heroes/fame-and-consecration.ts');
  const discoveries = await import('../../src/engine/rules/the-registry-of-discovery-effects.ts');
  const worldTables = await import('../../src/engine/world/tables.ts');
  const armyTables = await import('../../src/engine/army-tables.ts');
  return {
    resolveTurn: theTurn,
    buildReports: theReports,
    theTurnsLinesInWords: theWords,
    turnStartRepairsAndAFreshSlateOfOrdersForEveryHero: setUp,
    mergeTheRealmsSubmittedOrdersDeclarationsMessagesAndEncounterPlans: setUp,
    relationsReadyAndLastTurnsResearchChoicesSettledWithTheBotsOwnPicks: beforeTheFirstPhase,
    warWithoutWarningTitlesHeldSafeStartAndStaleOrderLinesGmRemovalsAndMessages: beforeTheFirstPhase,
    movePoolsPerTurnTrackersEspionageResetsAndTheSaveSweepsBeforeTheBotsPlan: beforeTheFirstPhase,
    missingOrdersDefaultToDefendTheOrdersRecordAndTheWarFrontsAtTheStart: beforeTheFirstPhase,
    startPhaseHealingSnapshotsAndStalledBattles: phaseStages,
    afterThePhasesStandOffsTheDeadGravesCouriersMassHealingCowardsAndLocationNames: afterThePhases,
    diplomacyResolutionOverturesPeaceAlliancesWarAndWarFrontWarnings: diplomacyAndVictory,
    victoryTheReckoningEliminationConcessionAndTheAnnouncement: diplomacyAndVictory,
    botDiplomacyTreatsAndWarsByAlignmentTheGrudgeAndAReckoningClaim: botDiplomacy,
    botWarAssess: botWar,
    botOwnPower: botWar,
    botRivalPower: botWar,
    botAlignFriendly: botIntel,
    botRealmsPlanTheTurnConcessionsMovementMusterEconomyActionsSpringOrdersHygieneAndTheReckoning: botsPlan,
    runBotConcessions: botMissions,
    runBotMovement: botMovement,
    runBotPhaseOne: botPhaseOne,
    runBotEconomy: botEconomy,
    runBotActions: botSpellcraft,
    runBotOrderHygiene: botEconomy,
    runBotReckoning: reckoning,
    botResearchPick: botMissions,
    resolvePersonalCombat: personalCombat,
    terrainMod: terrain,
    seaPenalty: terrain,
    unitBaseStrength: baseStrength,
    ALL_MAGIC_ITEMS_P: data,
    LEGENDARY_ITEMS_P: data,
    MITHRIL_ARMOUR: fame,
    SAGE_DISCOVERIES_P: data,
    DISC_BY_ID: discoveries,
    KC_SKILLS: data,
    KC_SEASONS: data,
    RACES_P: worldTables,
    TERRAIN_MODS: terrain,
    SEA_TYPES: flyOrSail,
    AERIAL_TYPES: flyOrSail,
    TITLE_DEFS: data,
    MINOR_TITLES: reckoning,
    SKILL_LABELS: armyTables,
  } satisfies { [Name in AFunctionOrTableOfTheEngines]: Record<Name, unknown> };
}

/** A new world of bot realms, made by the engine itself, as JSON: lib/engine.ts's botWorld, on the modules. `realms`
 *  bot setups (generateBotSetups), on a map of `size`, with the world options `opts` (e.g. `{ seaPct: 45 }`). */
export function botWorld(
  engine: TheEngineOnItsModules,
  realms: number,
  size: { cols: number; rows: number },
  opts: Record<string, unknown> = {},
): string {
  const setup = engine
    .generateBotSetups([], realms, 0)
    .map((b) => ({ ...b, gamePlayerId: 'gp' + String(b.id), name: b.kingdomName }));
  const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
  return JSON.stringify(engine.generateNewGame(setup, copy(size), 999, copy(opts)));
}

/** A fresh turn's context on `state` (a world as JSON, or as an object, copied first), as resolveTurn makes it before
 *  the first phase. The state is parsed from its JSON, so the context holds its own copy. */
export function aFreshTurnsContextOnTheWorld(
  engine: TheEngineOnItsModules,
  state: object | string,
  { freshPlayers = [], turn = 1 }: { freshPlayers?: unknown[]; turn?: number } = {},
) {
  const json = typeof state === 'string' ? state : JSON.stringify(state);
  const players = JSON.parse(JSON.stringify(freshPlayers)) as Parameters<TheEngineOnItsModules['createTurnContext']>[1];
  return addTheFieldsResolveTurnAdds(engine.createTurnContext(JSON.parse(json), players, turn), engine);
}

/** Quiets the engine's console.log (emit echoes each line of the GM's log there) until the returned function is
 *  called: lib/engine.ts's quietEngineLog. */
export function quietEngineLog(engine: TheEngineOnItsModules): () => void {
  const was = engine.console.log;
  engine.console.log = () => undefined;
  return () => {
    engine.console.log = was;
  };
}

/** Runs `body` with the dice the engine draws pinned, in turn, to `dice` (each in [0, 1)); once they run out, the
 *  last one repeats. */
export function withDice<T>(engine: TheEngineOnItsModules, dice: number[], body: () => T): T {
  let i = 0;
  const was = engine.kcRng.use(() => must(dice[Math.min(i++, dice.length - 1)], 'a die'));
  try {
    return body();
  } finally {
    engine.kcRng.use(was);
  }
}

/** Runs `body` with the first die the engine draws pinned to `first`, the rest from the dice as they were. */
export function firstDie<T>(engine: TheEngineOnItsModules, first: number, body: () => T): T {
  let pinned = true;
  const was = engine.kcRng.use(() => {
    if (!pinned) return was();
    pinned = false;
    return first;
  });
  try {
    return body();
  } finally {
    engine.kcRng.use(was);
  }
}

/** Runs `body` with every percentile roll the engine makes (d100) fixed at `roll`, 1 to 100 (plan P1-08j6). Over a
 *  whole turn, with `withDice` fixing every other die, an order's rolls are certain however many dice the turn draws
 *  before them. d100 is stood in on its module, for its calls from other files; pctRoll, which calls it inside that
 *  file, is stood in too, playing as it is on dice of its own that make its d100 roll `roll` and draw nothing from the
 *  turn's: the vm's withRolls replaced the one global d100 every call reached, and drew no die. */
export function withRolls<T>(engine: TheEngineOnItsModules, roll: number, body: () => T): T {
  const dice = engine.theDiceModule;
  const pctRoll = dice.pctRoll;
  const theD100 = vi.spyOn(dice, 'd100').mockImplementation(() => roll);
  const thePctRoll = vi.spyOn(dice, 'pctRoll').mockImplementation((chance) => {
    // d100 is ⌊die × 100⌋ + 1: this die makes it `roll`
    const was = engine.kcRng.use(() => (roll - 0.5) / 100);
    try {
      return pctRoll(chance);
    } finally {
      engine.kcRng.use(was);
    }
  });
  try {
    return body();
  } finally {
    thePctRoll.mockRestore();
    theD100.mockRestore();
  }
}

/** Runs `body` with the percentile rolls the engine makes (d100) given in turn by `d100s`, 1 to 100, and every other
 *  die at `die`: the vm's stand-in for its one global d100, by a list. d100 is stood in on its module, for its calls
 *  from other files; pctRoll, which calls it inside that file, is stood in too, playing as it is on a die of its own
 *  that makes its d100 roll the next of `d100s`, as the vm's global d100 gave it. */
export function withThesePercentileRollsInTurn<T>(
  engine: TheEngineOnItsModules,
  d100s: number[],
  body: () => T,
  die: number,
): T {
  const dice = engine.theDiceModule;
  const pctRoll = dice.pctRoll;
  let i = 0;
  const theNextRoll = () => must(d100s[i++], 'a d100 roll');
  const theD100 = vi.spyOn(dice, 'd100').mockImplementation(theNextRoll);
  const thePctRoll = vi.spyOn(dice, 'pctRoll').mockImplementation((chance) => {
    // d100 is ⌊die × 100⌋ + 1: this die makes it the next roll
    const roll = theNextRoll();
    const was = engine.kcRng.use(() => (roll - 0.5) / 100);
    try {
      return pctRoll(chance);
    } finally {
      engine.kcRng.use(was);
    }
  });
  try {
    return withDice(engine, [die], body);
  } finally {
    thePctRoll.mockRestore();
    theD100.mockRestore();
  }
}

/** A fresh board on `world` (JSON from botWorld) in phase `ph`. */
export function board(engine: TheEngineOnItsModules, world: string, ph: number) {
  const getNeighborsP = engine.getNeighborsP as unknown as (
    p: Province,
    cols: number,
    rows: number,
    ps: Province[],
  ) => Province[];
  // lib/engine.ts's turnContext: the context made on the state parsed, no fresh players, turn 1
  const tc = aFreshTurnsContextOnTheWorld(engine, world);
  tc._currentPhase = ph;
  tc._logCtx.phase = ph;
  const G = tc.G as unknown as World;
  G.relations = { '0-1': 'enemy', '0-2': 'allied', '1-2': 'peace' };
  G.characters = [];
  G.turnOrders = {};
  G.mercenaries = [];
  const ps = G.world.provinces;
  ps.forEach((p) => {
    p.characters = [];
  });
  const nbrs = (p: Province) => getNeighborsP(p, G.world.cols, G.world.rows, ps);
  const X = must(
    ps.find((p) => p.row === 4 && p.col === 5),
    'the middle province',
  );
  const ring1 = nbrs(X);
  const ring2 = [...new Set(ring1.flatMap(nbrs))].filter((p) => p !== X && !ring1.includes(p));
  const near = [X, ...ring1, ...ring2];
  near.forEach((p) =>
    Object.assign(p, {
      terrain: 'plain',
      owner: null,
      features: [],
      garrisonArmies: [],
      neutralDefenders: [],
      npcArmies: 0,
    }),
  );
  G.players.forEach((pl) => {
    pl.provinces = pl.provinces.filter((id) => !near.some((p) => p.id === id));
  });
  const own = (p: Province, pi: number | null) => {
    G.players.forEach((pl) => {
      pl.provinces = pl.provinces.filter((id) => id !== p.id);
    });
    p.owner = pi;
    if (pi != null) must(G.players[pi], 'realm ' + String(pi)).provinces.push(p.id);
  };
  // The turn's lines so far in words, as the views write them (theTurnsLinesInWords, P1-12c3).
  const inWords = engine.theTurnsLinesInWords as unknown as (log: unknown) => { gmLog: Line[] };
  const lines = () => inWords(tc.turnLog).gmLog;
  // What the board gives a case that reaches its engine (the-board-a-case-is-staged-on-either-way.ts): each name's
  // export from the module that defines it, and this realm's JSON, Sets and Maps.
  const theModuleOf = (name: AFunctionOrTableOfTheEngines) =>
    engine.theModuleThatDefines[name] as unknown as Record<string, AFunctionOfTheEngines>;
  const reach = {
    withDice: <T>(dice: number[], body: () => T): T => withDice(engine, dice, body),
    firstDie: <T>(first: number, body: () => T): T => firstDie(engine, first, body),
    withRolls: <T>(roll: number, body: () => T): T => withRolls(engine, roll, body),
    theEnginesFunctionOrTable: (name: AFunctionOrTableOfTheEngines): unknown => theModuleOf(name)[name],
    standInForTheEnginesFunction: (
      name: AFunctionOrTableOfTheEngines,
      insteadOf: (was: AFunctionOfTheEngines) => (...args: never[]) => unknown,
    ) => {
      const theModule = theModuleOf(name);
      const was = must(theModule[name], name);
      const standIn = vi.spyOn(theModule, name).mockImplementation(insteadOf(was) as AFunctionOfTheEngines);
      return () => {
        standIn.mockRestore();
      };
    },
    parsedInTheEnginesRealm: (json: string): unknown => JSON.parse(json),
    aSetMadeInTheEnginesRealm: (json: string): unknown => new Set(JSON.parse(json) as unknown[]),
    aMapMadeInTheEnginesRealm: (json: string): unknown => new Map(JSON.parse(json) as [unknown, unknown][]),
  };
  const b = { engine, tc, G, ph, X, ring1, ring2, near, nbrs, own, lines, ...reach };
  return b satisfies TheBoardACaseIsStagedOn;
}
export type Board = ReturnType<typeof board>;

// ── What the tests that call the engine themselves hand it ───────────────────────────────────────────────────────────
/** Runs `body` with the case's dice, if it fixes them (the-board-a-case-is-staged-on-either-way.ts' withCaseDice, on
 *  the `engine` itself). */
export const withCaseDice = <T>(engine: TheEngineOnItsModules, dice: Dice | undefined, body: () => T): T =>
  dice ? withDice(engine, [dice.die], () => withRolls(engine, dice.roll, body)) : body();

/** Records every experience roll the engine starts (plan P1-08c) into the list `recordExperienceRolls` hands back for
 *  the length of `body`. trySkillGain is stood in by vi.spyOn on its module for
 *  the body's length, playing as it is once recorded, so it records the calls from other files only (docs/traps.md):
 *  not rollNavalVoyage's, the one call in trySkillGain's own file. A test that reads a voyage's roll stages around it.
 */
export const recordExperienceRolls = (engine: TheEngineOnItsModules) => {
  const theExperienceModule = engine.theExperienceModule;
  return <T>(body: () => T): { result: T; xp: ExperienceRoll[] } => {
    const xp: ExperienceRoll[] = [];
    const tryOne = theExperienceModule.trySkillGain;
    const theRecorder = vi
      .spyOn(theExperienceModule, 'trySkillGain')
      .mockImplementation((turnContext, char, skill, base, ...rest) => {
        xp.push({ id: char ? char.id : char, skill, base });
        tryOne(turnContext, char, skill, base, ...rest);
      });
    try {
      return { result: body(), xp };
    } finally {
      theRecorder.mockRestore();
    }
  };
};

/** Writes the orders `writes` gives (by hero) into the turn after the bots have planned theirs, for the length of a
 *  body. runBotOrderHygiene (the bots' last pass) is stood in by vi.spyOn on its module,
 *  playing as it is and then writing the orders in; the bots' plan calls it from another file, so the stand-in reaches
 *  it (docs/traps.md). */
export const asTheBotsPlan = (engine: TheEngineOnItsModules) => {
  const lastPass = engine.runBotOrderHygiene;
  return <T>(writes: Record<number, Order[]> | undefined, body: () => T): T => {
    const theLastPass = engine.standInForTheBotsLastPass().mockImplementation((G, botIdxSet) => {
      lastPass(G, botIdxSet);
      if (writes)
        Object.keys(writes).forEach((id) => {
          G.turnOrders[id] = JSON.parse(JSON.stringify(writes[Number(id)])) as (typeof G.turnOrders)[string];
        });
    });
    try {
      return body();
    } finally {
      theLastPass.mockRestore();
    }
  };
};
