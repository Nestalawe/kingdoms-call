// A commander slain in the duel before a battle takes his skills out of it (R-161, row P1-23am): in both kinds of
// battle his companies fight without his Druid, and his Archery adds nothing to his bowmen's volley. Each case is
// played in both kinds of battle on one staged field: realm 0's king attacks a free plain, either its guards
// (combatVsNPC), led by realm 1's king made a warlord of no realm, or realm 1's king's own host (combatVsChar). Both
// realms and both kings are Neutral (no alignment waives a beast's Druid), and carry no items. The duel's outcome is
// fixed: the duel before the battle (preBattleDuel, stood in by vi.spyOn) slays the attacker, or no duel is fought.
// What each case reads depends on no die: the strength ladder's reasons on his Cave Trolls (Druid 4 to lead), and the
// Archery each of his Yeoman Longbows' shots is weighed with (applyMissileHit, stood in likewise, calling the real
// one). Every other die is a fixed stream's (kcRng.use), so the battle plays the same under any KC_SEED.
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
import * as duels from '../../src/engine/battle/pre-battle-duels.ts';
import * as strength from '../../src/engine/battle/terrain-and-unit-strength.ts';
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
  alignment?: string;
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
  players: { alignment?: string }[];
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

/** A company of the unit type and race given (Average), named. */
const aCompany = (type: string, race: string, unitName: string): ArmyInABattle => ({
  type,
  quality: 'Average',
  race,
  unitName,
});

/** What the battle shows: its lines, and the Archery each of the attacker's shots was weighed with. */
interface WhatTheBattleShows {
  readonly narrative: readonly NarrativeLine[];
  readonly theArcheryOfHisShots: readonly unknown[];
}

/** The battle staged: the attacker (his skills given, every other skill 0) leads his host against the defenders (led
 *  by a commander of no skills), and the duel before it slays him, or no duel is fought. */
function aBattle(
  battle: 'against the guards' | 'between two hosts',
  staging: {
    readonly theAttackersHost: readonly ArmyInABattle[];
    readonly hisSkills: Readonly<Record<string, number>>;
    readonly theDuelSlaysHim: boolean;
  },
): WhatTheBattleShows {
  const G = JSON.parse(THE_WORLD) as World;
  const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], 3), { KC_SEASONS, isBotRow });
  tc._currentPhase = 1;
  tc._logCtx.phase = 1;
  G.relations['0-1'] = 'enemy';
  for (const realm of G.players) realm.alignment = 'Neutral';
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
  const noSkills = Object.fromEntries(
    [...KC_MAGIC_SCHOOLS, 'tactical', 'naval', 'druid', 'archery'].map((skill) => [skill, 0]),
  );
  atk['_attackedFrom'] = atk.location;
  moveTo(atk);
  moveTo(def);
  for (const king of [atk, def]) {
    king.items = [];
    king.alignment = 'Neutral';
    king.encounterPlan = { tactics: ['ME', 'ME', 'ME', 'ME', 'ME'], duelStance: 'refuse' };
  }
  atk.armies = [...staging.theAttackersHost];
  atk.skills = { ...atk.skills, ...noSkills, ...staging.hisSkills };
  def.skills = { ...def.skills, ...noSkills };
  const theDefenders = [aCompany('Men-at-Arms', 'Human', 'the Mill Watch')];

  // the duel before the battle: it slays the attacker (he dies, as a duel's loser does), or none is fought
  const theDuel = vi.spyOn(duels, 'preBattleDuel').mockImplementation(() => {
    if (!staging.theDuelSlaysHim) return { atkMorale: 1, defMorale: 1 };
    atk.alive = false;
    return { atkMorale: 1, defMorale: 1, atkSlain: true, defSlain: false };
  });
  const theArcheryOfHisShots: unknown[] = [];
  const realHit = strength.applyMissileHit;
  const theHits = vi.spyOn(strength, 'applyMissileHit').mockImplementation((...args) => {
    if (args[2] && atk.armies.includes(args[2])) theArcheryOfHisShots.push(args[1]);
    return realHit(...args);
  });
  const was = kcRng.use(kcRngStream(7));
  let narrative: NarrativeLine[];
  try {
    if (battle === 'between two hosts') {
      def.armies = theDefenders;
      narrative = (
        combatVsChar(...([tc, atk, def, field] as unknown as Parameters<typeof combatVsChar>)) as {
          narrative: NarrativeLine[];
        }
      ).narrative;
    } else {
      field.neutralDefenders = theDefenders;
      Object.assign(def, { player: null, armies: [] });
      narrative = (
        combatVsNPC(...([tc, atk, field, def] as unknown as Parameters<typeof combatVsNPC>)) as {
          narrative: NarrativeLine[];
        }
      ).narrative;
    }
  } finally {
    kcRng.use(was);
    theDuel.mockRestore();
    theHits.mockRestore();
  }
  return { narrative, theArcheryOfHisShots };
}

const BATTLES = ['against the guards', 'between two hosts'] as const;

/** The reasons the strength ladder gives for the attacker's units' strength, read from its lines on his side. */
const theReasonsOnHisUnits = (shown: WhatTheBattleShows) => {
  const reasons: string[] = [];
  let onHisSide = false;
  for (const line of shown.narrative) {
    if (typeof line !== 'object') continue;
    if (line.kind === "a side's strength ladder begins") onHisSide = line.side === 'attacker';
    else if (line.kind === "the strength ladder's units" && onHisSide)
      for (const modifier of line.theUnitsModifiers) reasons.push(modifier.reason.kind);
  }
  return reasons;
};

describe.for(BATTLES)('A commander slain in the duel takes his Druid out of the battle, %s', (battle) => {
  const theTrolls = [aCompany('Cave Trolls', 'Troll', 'the Deep Hollow')];
  const theReasonsOnHisTrolls = (theDuelSlaysHim: boolean) =>
    theReasonsOnHisUnits(aBattle(battle, { theAttackersHost: theTrolls, hisSkills: { druid: 5 }, theDuelSlaysHim }));
  test('his Cave Trolls (Druid 4 to lead) fight under his Druid 5 while he lives, and without it once he is slain', () => {
    expect(theReasonsOnHisTrolls(false)).toEqual(["the commander's druid mastery"]);
    expect(theReasonsOnHisTrolls(true)).toEqual(["its commander's Druid falls short"]);
  });
});

describe.for(BATTLES)("A commander slain in the duel takes his Archery out of his bowmen's volley, %s", (battle) => {
  const theBowmen = [aCompany('Yeoman Longbows', 'Human', 'the Greenwood Bows')];
  /** The Archery each of his Longbows' shots before the battle is weighed with. */
  const theArcheryOfHisShots = (theDuelSlaysHim: boolean) =>
    aBattle(battle, { theAttackersHost: theBowmen, hisSkills: { archery: 5 }, theDuelSlaysHim }).theArcheryOfHisShots;
  test('his Yeoman Longbows shoot under his Archery 5 while he lives, and under none once he is slain', () => {
    const alive = theArcheryOfHisShots(false);
    expect(alive.length).toBeGreaterThan(0);
    expect(new Set(alive)).toEqual(new Set([5]));
    const slain = theArcheryOfHisShots(true);
    expect(slain.length).toBeGreaterThan(0);
    expect(new Set(slain)).toEqual(new Set([0]));
  });
});
