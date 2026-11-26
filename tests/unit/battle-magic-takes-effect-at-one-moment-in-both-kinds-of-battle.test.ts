// Battle magic takes effect at one moment in both kinds of battle (R-162, row P1-23an): what a battle's magic stops
// or takes away holds the same against a province's guards as between two heroes' hosts. Lightning Advance stops all
// the defenders' magic before the battle: their commander's battle spell (a guard leader's too) and their
// gyrocopters' Flak Screen (a hero's too). Mass Confusion takes a guard leader's Tactical from his battle, as it takes
// a hero's. Each case is played in both kinds of battle on one staged field: realm 0's king attacks a free plain,
// either its guards (combatVsNPC), led by realm 1's king made a warlord of no realm, or realm 1's king's own host
// (combatVsChar). Both commanders refuse any challenge, so no duel is fought. What each case reads depends on no die:
// a commander's cast line is written before his roll, a gyrocopter always harries a flyer left in the enemy's host,
// and the Tactical the lines are deployed with (battleDeploy, stood in by vi.spyOn, which calls the real one) is the
// commander's skill. Every die is a fixed stream's (kcRng.use), so the battle plays the same under any KC_SEED.
// Level 1 (unit): the battles called directly, no turn played. Not lower: each rule sits inside a battle's stages.
// Not higher: a turn adds dice before the battle and nothing the rule reads.
import '../lib/the-whole-engine.ts';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { KC_MAGIC_SCHOOLS, KC_SEASONS } from '../../src/content/kingdoms-call-data.ts';
import { kcRng, kcRngStream } from '../../src/engine/rng.ts';
import { generateBotSetups, isBotRow } from '../../src/engine/bots/setup.ts';
import { generateNewGame } from '../../src/engine/world/generate.ts';
import { createTurnContext } from '../../src/engine/turn/context.ts';
import { combatVsChar } from '../../src/engine/battle/battles-between-heroes.ts';
import { combatVsNPC } from '../../src/engine/battle/battles-against-province-defenders.ts';
import * as lines from '../../src/engine/battle/lines.ts';
import type { ArmyInABattle } from '../../src/engine/army-tables.ts';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';
import { addTheFieldsResolveTurnAdds } from '../lib/the-fields-resolve-turn-adds-to-the-turns-context.ts';

// The GM's log echoes each line on the console: quiet while the battles write lines.
const consoleLog = console.log;
beforeAll(() => {
  console.log = () => undefined;
});
afterAll(() => {
  console.log = consoleLog;
});
afterEach(() => {
  vi.restoreAllMocks();
});

interface Character {
  id: number | string;
  name: string;
  player: number | null;
  isKing?: boolean;
  alive: boolean;
  location: number;
  armies: ArmyInABattle[];
  skills?: Record<string, number>;
  items?: unknown[];
  encounterPlan?: { tactics: string[]; duelStance: string };
  [key: string]: unknown;
}
interface Province {
  id: number;
  terrain: string;
  owner: number | null;
  characters: (number | string)[];
  neutralDefenders?: ArmyInABattle[];
  [key: string]: unknown;
}
interface World {
  turn: number;
  relations: Record<string, string>;
  characters: Character[];
  world: { provinces: Province[] };
}

// A world of two bot realms, made by the engine from a fixed seed, kept as JSON: each battle stages a fresh copy.
kcRng.seed(1);
const THE_WORLD = JSON.stringify(
  generateNewGame(
    generateBotSetups([], 2, 0).map((b) => ({
      ...b,
      gamePlayerId: 'gp' + String(b.id),
      name: b.kingdomName,
    })),
    { cols: 10, rows: 6 },
    999,
    { seaPct: 10 },
  ),
);

/** A company of the unit type given (Average, Human), named. */
const aCompany = (type: string, unitName: string): ArmyInABattle => ({
  type,
  quality: 'Average',
  race: 'Human',
  unitName,
});

/** How the battle is staged: the attacker's host and whether he ordered a Lightning Advance this turn; the
 *  defenders' units (the guards, or the other king's host), and their commander's skills, the battle spell his plan
 *  names (`CA:<spell>`, or none), and whether a Mass Confusion took his Tactical this turn. */
interface TheStaging {
  readonly theAttackersHost: readonly ArmyInABattle[];
  readonly aLightningAdvance?: boolean;
  readonly theDefenders: readonly ArmyInABattle[];
  readonly theirCommander: {
    readonly skills: Readonly<Record<string, number>>;
    readonly spell?: string;
    readonly massConfused?: boolean;
  };
}

/** What the battle shows: its lines, the defenders' commander's name, and the Tactical each side's lines were
 *  deployed with. */
interface WhatTheBattleShows {
  readonly narrative: readonly NarrativeLine[];
  readonly theirCommandersName: string;
  readonly theTacticalDeployedWith: { readonly ofTheAttacker: unknown; readonly ofTheDefenders: unknown };
}

function aBattle(battle: 'against the guards' | 'between two hosts', staging: TheStaging): WhatTheBattleShows {
  const G = JSON.parse(THE_WORLD) as World;
  const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], 3), { KC_SEASONS, isBotRow });
  tc._currentPhase = 1;
  tc._logCtx.phase = 1;
  G.relations['0-1'] = 'enemy';
  const [atk, def] = [0, 1].map((p) => G.characters.find((c) => c.alive && c.player === p && c.isKing));
  // a free plain, emptied: no one else stands there, and it holds nothing of its own
  const field = G.world.provinces.find((p) => p.terrain === 'plain' && p.owner === null);
  if (!atk || !def || !field) throw new Error('the world has no king in realm 0 or 1, or no free plain');
  Object.assign(field, { characters: [], features: [], garrisonArmies: [], npcArmies: 0 });
  const moveTo = (c: Character) => {
    const from = G.world.provinces[c.location];
    if (from) from.characters = from.characters.filter((id) => id !== c.id);
    c.location = field.id;
    field.characters.push(c.id);
  };
  atk['_attackedFrom'] = atk.location;
  moveTo(atk);
  atk.armies = [...staging.theAttackersHost];
  atk.encounterPlan = { tactics: ['ME', 'ME', 'ME', 'ME', 'ME'], duelStance: 'refuse' };
  if (staging.aLightningAdvance) atk['_lightningAdvanceTurn'] = G.turn;
  moveTo(def);
  const theirs = staging.theirCommander;
  def.skills = {
    ...def.skills,
    ...Object.fromEntries(KC_MAGIC_SCHOOLS.map((school) => [school, 0])),
    ...theirs.skills,
  };
  def.items = [];
  def.encounterPlan = {
    tactics: [theirs.spell ? `CA:${theirs.spell}` : 'ME', 'ME', 'ME', 'ME', 'ME'],
    duelStance: 'refuse',
  };
  if (theirs.massConfused) def['_massConfusedTurn'] = G.turn;

  const deployed: { tacA?: unknown; tacD?: unknown } = {};
  const realDeploy = lines.battleDeploy;
  const theDeploy = vi.spyOn(lines, 'battleDeploy').mockImplementation((...args) => {
    deployed.tacA = args[2].tacA;
    deployed.tacD = args[2].tacD;
    return realDeploy(...args);
  });
  const was = kcRng.use(kcRngStream(7));
  let narrative: NarrativeLine[];
  try {
    if (battle === 'between two hosts') {
      def.armies = [...staging.theDefenders];
      narrative = (
        combatVsChar(...([tc, atk, def, field] as unknown as Parameters<typeof combatVsChar>)) as {
          narrative: NarrativeLine[];
        }
      ).narrative;
    } else {
      field.neutralDefenders = [...staging.theDefenders];
      Object.assign(def, { player: null, armies: [] });
      narrative = (
        combatVsNPC(...([tc, atk, field, def] as unknown as Parameters<typeof combatVsNPC>)) as {
          narrative: NarrativeLine[];
        }
      ).narrative;
    }
  } finally {
    kcRng.use(was);
    theDeploy.mockRestore();
  }
  return {
    narrative,
    theirCommandersName: def.name,
    theTacticalDeployedWith: { ofTheAttacker: deployed.tacA, ofTheDefenders: deployed.tacD },
  };
}

const BATTLES = ['against the guards', 'between two hosts'] as const;

/** The lines of a commander's battle spell cast before the battle (his name, the spell, his chance and roll). */
const theirCasts = (shown: WhatTheBattleShows) =>
  shown.narrative.filter(
    (l) =>
      typeof l === 'object' &&
      l.kind.includes('casts a spell before the battle') &&
      JSON.stringify(l).includes(`"casterName":${JSON.stringify(shown.theirCommandersName)}`),
  );
/** The lines of a side's gyrocopters climbing to meet the enemy's flyers: the defenders', as the attacker has none. */
const theirFlakScreen = (shown: WhatTheBattleShows) =>
  shown.narrative.filter(
    (l) => typeof l === 'object' && l.kind === "a side's gyrocopters climb to meet the enemy's flyers",
  );

describe.for(BATTLES)('Lightning Advance stops all the defenders magic, %s', (battle) => {
  const casting: TheStaging = {
    theAttackersHost: [aCompany('Men-at-Arms', 'the First Shields')],
    theDefenders: [aCompany('Men-at-Arms', 'the Mill Watch')],
    theirCommander: { skills: { elemental: 5 }, spell: 'Lightning Bolt' },
  };
  test("their commander's battle spell: cast on his ground, never under a Lightning Advance", () => {
    expect(theirCasts(aBattle(battle, casting))).toHaveLength(1);
    expect(theirCasts(aBattle(battle, { ...casting, aLightningAdvance: true }))).toEqual([]);
  });

  const flak: TheStaging = {
    theAttackersHost: [aCompany('Eagle Riders', 'the High Wings')],
    theDefenders: [aCompany('Gnomish Gyrocopters', 'the Copper Rotors')],
    theirCommander: { skills: {} },
  };
  test("their gyrocopters' Flak Screen: it harries the attacker's flyers on their ground, never under a Lightning Advance", () => {
    expect(theirFlakScreen(aBattle(battle, flak))).toHaveLength(1);
    expect(theirFlakScreen(aBattle(battle, { ...flak, aLightningAdvance: true }))).toEqual([]);
  });
});

describe.for(BATTLES)('Mass Confusion takes the defending commander’s Tactical, %s', (battle) => {
  const staging: TheStaging = {
    theAttackersHost: [aCompany('Men-at-Arms', 'the First Shields')],
    theDefenders: [aCompany('Men-at-Arms', 'the Mill Watch')],
    theirCommander: { skills: { tactical: 4 } },
  };
  test('his lines are deployed with his Tactical, and with none once Mass Confusion grips him', () => {
    const unconfused = aBattle(battle, staging).theTacticalDeployedWith.ofTheDefenders;
    expect(unconfused).toBeGreaterThanOrEqual(4);
    expect(
      aBattle(battle, { ...staging, theirCommander: { ...staging.theirCommander, massConfused: true } })
        .theTacticalDeployedWith.ofTheDefenders,
    ).toBe(0);
  });
});
