// The board a case is staged on, either way the tests reach the engine (P1-14m): what the case files
// (tests/lib/*-cases.ts) take from a board, so one case file serves the vm board (tests/lib/middle-of-a-bot-world.ts)
// and the modules board (tests/lib/the-middle-of-a-bot-world-in-a-turn-on-the-engines-modules.ts) alike. It holds the
// shared types, `must`, `order` and `plan`, and the functions a case calls that go through the board it is handed:
// `hero`, `playTurn`, `withCaseDice`, `linesInWords`, `points`, `linesOf`, `allText`. Both boards re-export them.
//
// A board gives its staging (the turn's context in one phase, the middle province X and its rings; the boards'
// headers say how each is made) and the members that reach its engine: the dice (`withDice`, `firstDie`,
// `withRolls`), one of the engine's functions or tables by name (`theEnginesFunctionOrTable`), a stand-in for one of
// its functions for a while (`standInForTheEnginesFunction`), and values made in the engine's own realm (the vm's
// objects are its own: `parsedInTheEnginesRealm`, `aSetMadeInTheEnginesRealm`, `aMapMadeInTheEnginesRealm`). On the
// vm a name is the bundle's top-level name; on the modules, the export of the one module that defines it.
//
// It imports nothing that reaches tests/lib/engine.ts (tools/ratchet.ts's vmLoaderTests follows every import, types
// too), so a test whose case files import only this file and each other can leave the vm.
import type { TurnContext } from './the-fields-resolve-turn-adds-to-the-turns-context.ts';

export interface Unit {
  type: string;
  quality: string;
  race: string;
  unitName: string;
  _died?: boolean;
  _disbanded?: boolean;
  [key: string]: unknown;
}
export interface Province {
  id: number;
  row: number;
  col: number;
  name: string;
  terrain: string;
  owner: number | null;
  characters: number[];
  garrisonArmies: Unit[];
  neutralDefenders: Unit[];
  npcArmies: number;
  visitedBy?: number[];
  _battleUnresolved?: boolean;
  _hadBattleThisTurn?: boolean;
  _leaderlessDefenders?: boolean;
  [key: string]: unknown;
}
export interface Character {
  id: number;
  name: string;
  player: number | null;
  isKing: boolean;
  alive: boolean;
  location: number;
  armies: Unit[];
  skills: Record<string, number>;
  hp: number;
  maxHp: number;
  items: Record<string, unknown>[];
  _pursuit?: { active: boolean; targetId: number; setPhase?: number };
  _foughtStalledBattlePhase?: number;
  _encounteredThisPhase?: number;
  _isNeutralGuard?: boolean;
  _leaderlessHost?: boolean;
  _defend?: { active: boolean };
  [key: string]: unknown;
}
export interface World {
  turn: number;
  relations: Record<string, string>;
  players: { name: string; provinces: number[]; [key: string]: unknown }[];
  characters: Character[];
  mercenaries?: { type: string; quality: string; location: number; id: string; [key: string]: unknown }[];
  turnOrders: Record<number, ({ action: string; target?: string } | null)[]>;
  world: { cols: number; rows: number; provinces: Province[] };
}
export interface Line {
  type: string;
  text: string;
  charId: number | null;
  provinceId: number | null;
  actor?: number | null;
  targets?: number[];
  /** The phase (0–4; 99 for the end of the turn), or null. */
  phase?: number | null;
  [key: string]: unknown;
}

const must = <T>(x: T | undefined | null, what: string): T => {
  if (x == null) throw new Error('missing ' + what);
  return x;
};
export { must };

/** The engine's functions and tables a case reads or stands in by name, through its board. */
export const THE_ENGINES_FUNCTIONS_AND_TABLES_A_CASE_READS = [
  // the turn, its reports and its lines in words
  'resolveTurn',
  'buildReports',
  'theTurnsLinesInWords',
  // the turn's stages, called or stood in
  'turnStartRepairsAndAFreshSlateOfOrdersForEveryHero',
  'mergeTheRealmsSubmittedOrdersDeclarationsMessagesAndEncounterPlans',
  'relationsReadyAndLastTurnsResearchChoicesSettledWithTheBotsOwnPicks',
  'warWithoutWarningTitlesHeldSafeStartAndStaleOrderLinesGmRemovalsAndMessages',
  'movePoolsPerTurnTrackersEspionageResetsAndTheSaveSweepsBeforeTheBotsPlan',
  'missingOrdersDefaultToDefendTheOrdersRecordAndTheWarFrontsAtTheStart',
  'startPhaseHealingSnapshotsAndStalledBattles',
  'afterThePhasesStandOffsTheDeadGravesCouriersMassHealingCowardsAndLocationNames',
  'diplomacyResolutionOverturesPeaceAlliancesWarAndWarFrontWarnings',
  'victoryTheReckoningEliminationConcessionAndTheAnnouncement',
  // the bots: their declarations and their helpers, their plan and its passes
  'botDiplomacyTreatsAndWarsByAlignmentTheGrudgeAndAReckoningClaim',
  'botWarAssess',
  'botOwnPower',
  'botRivalPower',
  'botAlignFriendly',
  'botRealmsPlanTheTurnConcessionsMovementMusterEconomyActionsSpringOrdersHygieneAndTheReckoning',
  'runBotConcessions',
  'runBotMovement',
  'runBotPhaseOne',
  'runBotEconomy',
  'runBotActions',
  'runBotOrderHygiene',
  'runBotReckoning',
  'botResearchPick',
  // a fight, and a company's strength
  'resolvePersonalCombat',
  'terrainMod',
  'seaPenalty',
  'unitBaseStrength',
  // the tables
  'ALL_MAGIC_ITEMS_P',
  'LEGENDARY_ITEMS_P',
  'MITHRIL_ARMOUR',
  'SAGE_DISCOVERIES_P',
  'DISC_BY_ID',
  'KC_SKILLS',
  'KC_SEASONS',
  'RACES_P',
  'TERRAIN_MODS',
  'SEA_TYPES',
  'AERIAL_TYPES',
  'TITLE_DEFS',
  'MINOR_TITLES',
  'SKILL_LABELS',
] as const;
export type AFunctionOrTableOfTheEngines = (typeof THE_ENGINES_FUNCTIONS_AND_TABLES_A_CASE_READS)[number];
/** One of the engine's functions, as a stand-in is handed it. */
export type AFunctionOfTheEngines = (...args: unknown[]) => unknown;

/** What every board gives a case: its staging, and the members that reach its engine. */
export interface Board {
  tc: TurnContext;
  G: World;
  ph: number;
  /** The middle province (row 4, column 5), its six neighbours, and theirs. */
  X: Province;
  ring1: Province[];
  ring2: Province[];
  near: Province[];
  nbrs(p: Province): Province[];
  /** Makes `p` realm `pi`'s (or nobody's). */
  own(p: Province, pi: number | null): void;
  /** The turn's lines so far in words, as the views write them (theTurnsLinesInWords). */
  lines(): Line[];
  /** Runs `body` with the dice the engine draws pinned, in turn, to `dice`; once they run out, the last one repeats. */
  withDice<T>(dice: number[], body: () => T): T;
  /** Runs `body` with the first die the engine draws pinned to `first`, the rest as they were. */
  firstDie<T>(first: number, body: () => T): T;
  /** Runs `body` with every percentile roll (d100) the engine makes fixed at `roll`, 1 to 100. */
  withRolls<T>(roll: number, body: () => T): T;
  /** One of the engine's functions or tables, by name: the engine's own, not a copy. */
  theEnginesFunctionOrTable(name: AFunctionOrTableOfTheEngines): unknown;
  /** Stands `insteadOf(was)` in for the engine's function `name` (`was`: the function as it was), until the returned
   *  function is called. */
  standInForTheEnginesFunction(
    name: AFunctionOrTableOfTheEngines,
    insteadOf: (was: AFunctionOfTheEngines) => (...args: never[]) => unknown,
  ): () => void;
  /** `json` parsed in the engine's realm (the vm's objects and arrays are its own). */
  parsedInTheEnginesRealm(json: string): unknown;
  /** A Set of the values in the JSON list `json`, made in the engine's realm. */
  aSetMadeInTheEnginesRealm(json: string): unknown;
  /** A Map of the entries in the JSON list `json`, made in the engine's realm. */
  aMapMadeInTheEnginesRealm(json: string): unknown;
}

/** The dice for the whole turn: every percentile roll (d100) at `roll` (1 to 100), every other die at `die` ([0, 1)). */
export interface Dice {
  roll: number;
  die: number;
}
/** An experience roll, as trySkillGain starts it: whose, which skill, at what chance. */
export interface ExperienceRoll {
  id: unknown;
  skill: string;
  base: unknown;
}

/** Runs `body` with the case's dice on `b`'s engine, if it fixes them. */
export const withCaseDice = <T>(b: Board, dice: Dice | undefined, body: () => T): T =>
  dice ? b.withDice([dice.die], () => b.withRolls(dice.roll, body)) : body();

/** A turn's log in words, as the views write them and the GM's log stores them (theTurnsLinesInWords). */
export const linesInWords = (b: Board, log: unknown): Line[] =>
  (b.theEnginesFunctionOrTable('theTurnsLinesInWords') as (l: unknown) => { gmLog: Line[] })(log).gmLog;

export interface HeroSpec {
  player: number | null;
  at: Province;
  /** Companies of `type` (default Men-at-Arms) of `quality` (default Regular). */
  troops?: number;
  type?: string;
  quality?: string;
  land?: number;
  sea?: number;
  king?: boolean;
  skills?: Record<string, number>;
  hp?: number;
}
let nextId = 9000;
/** Stands a new hero of `player` in `at`, leading `troops` companies, with `land` and `sea` points of movement left. */
export function hero(b: Board, s: HeroSpec): Character {
  const id = ++nextId;
  const type = s.type ?? 'Men-at-Arms';
  const armies: Unit[] = Array.from({ length: s.troops ?? 0 }, (_, k) => ({
    type,
    quality: s.quality ?? 'Regular',
    race: 'Human',
    unitName: `${type} #${String(id)}.${String(k)}`,
  }));
  const c: Character = {
    id,
    name: `Hero ${String(id)}`,
    isKing: !!s.king,
    player: s.player,
    race: 'Human',
    alignment: 'Divine',
    temper: 'Cautious',
    hp: s.hp ?? 20,
    maxHp: s.hp ?? 20,
    skills: s.skills ?? { melee: 2, tactical: 2, march: 1, spy: 0 },
    aptitude: {},
    armies,
    items: [],
    location: s.at.id,
    locationName: s.at.name,
    alive: true,
    merits: 0,
    spellsUsedThisTurn: [],
  };
  b.G.characters.push(c);
  s.at.characters.push(id);
  const pools = b.tc as unknown as Record<string, Record<number, unknown>>;
  must(pools['movePoints'], 'movePoints')[id] = s.land ?? 1;
  must(pools['seaMovePoints'], 'seaMovePoints')[id] = s.sea ?? 0;
  must(pools['seaMoveActive'], 'seaMoveActive')[id] = false;
  must(pools['seaCap'], 'seaCap')[id] = 'land';
  return c;
}
/** One phase's order, as a realm sends it. */
export interface Order {
  action: string;
  target: string;
  extra: string;
  desc: string;
}
/** An order: `order('move', 12)`. */
export const order = (action: string, target: string | number = '', extra: string | number = ''): Order => ({
  action,
  target: String(target),
  extra: String(extra),
  desc: '',
});
/** Five orders: the given ones first, then Rest. */
export const plan = (...orders: Order[]): Order[] => [
  ...orders.slice(0, 5),
  ...Array.from({ length: Math.max(0, 5 - orders.length) }, () => order('rest')),
];
/** What a realm sends with its orders beside them: its declarations (realm index → 'treat' or 'enemy'), a call for
 *  the Reckoning, a concession. */
export interface RealmSends {
  diplomacy?: Record<number, 'treat' | 'enemy'>;
  callReckoning?: boolean;
  concede?: boolean;
}
export interface PlayedTurn {
  /** The world after the turn, as saved. */
  after: World;
  /** The GM's log of the turn, in words (as the views write it: theTurnsLinesInWords). */
  lines: Line[];
}
/** Plays one whole turn (resolveTurn) from the board as staged: every realm human-held, each hero given orders here
 *  doing them, every other hero Resting, safe start over. The turn works out its own move points; the board's context
 *  isn't used. `written` adds orders a realm sends under a key of its own (the orders written for a hero it means to
 *  hire, `hired_<hero>_via_<hirer>_ph<phase>`), by realm. The realms in `bots` are bot realms (a slot row with no player
 *  and `isBot` in its report), which plan their own orders in the turn. `sends` gives what a realm sends with its
 *  orders beside them (its declarations toward other realms, a call for the Reckoning, a concession), by realm; by
 *  default nothing. No seed is given: the turn draws from the engine's dice. The slot rows are parsed in the engine's
 *  realm, as the turn loads them. */
export function playTurn(
  b: Board,
  orders: Record<number, Order[]>,
  written: Record<number, Record<string, Order[]>> = {},
  bots: number[] = [],
  sends: Record<number, RealmSends> = {},
): PlayedTurn {
  const G = b.G as World & { safeStart?: boolean };
  G.safeStart = false;
  const rows = G.players.map((_, i) => ({
    id: 'G1gp' + String(i),
    game_id: 'G1',
    user_id: bots.includes(i) ? null : 'u' + String(i),
    player_index: i,
    display_name: 'Realm ' + String(i),
    orders_submitted: true,
    orders: JSON.stringify({
      orders: {
        ...Object.fromEntries(
          G.characters.filter((c) => c.alive && c.player === i).map((c) => [c.id, orders[c.id] ?? plan()]),
        ),
        ...written[i],
      },
      encounterPlans: {},
      kingSkills: {},
      diplomacy: sends[i]?.diplomacy ?? {},
      discoveryChoices: {},
      callReckoning: sends[i]?.callReckoning ?? false,
      concede: sends[i]?.concede ?? false,
      messages: [],
      heroOrder: [],
      forTurn: G.turn,
    }),
    turn_report: bots.includes(i) ? '{"isBot":true}' : '{}',
  }));
  const resolveTurn = b.theEnginesFunctionOrTable('resolveTurn') as (
    state: string,
    rows: unknown,
    turn: number,
  ) => { state: string; log: unknown };
  const resolved = resolveTurn(JSON.stringify(G), b.parsedInTheEnginesRealm(JSON.stringify(rows)), G.turn);
  return { after: JSON.parse(resolved.state) as World, lines: linesInWords(b, resolved.log) };
}
/** A hero's points of movement left. */
export const points = (b: Board, c: Character) => {
  const pools = b.tc as unknown as Record<string, Record<number, number>>;
  return { land: pools['movePoints']?.[c.id] ?? 0, sea: pools['seaMovePoints']?.[c.id] ?? 0 };
};
/** A hero's own lines in the log. */
export const linesOf = (b: Board, c: Character) => b.lines().filter((l) => l.charId === c.id);
/** Every line of the log, as one string, for matching. */
export const allText = (b: Board) =>
  b
    .lines()
    .map((l) => l.text)
    .join('\n');
export type { TurnContext };
