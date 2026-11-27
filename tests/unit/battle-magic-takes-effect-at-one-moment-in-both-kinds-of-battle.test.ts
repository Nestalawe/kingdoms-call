// Battle magic takes effect at one moment in both kinds of battle (R-162, row P1-23an): each spell takes effect before
// the skills and strikes it changes are counted, against a province's guards as between two heroes' hosts. Lightning
// Advance stops all the defenders' magic before the battle: their commander's battle spell (a guard leader's too) and
// their gyrocopters' Flak Screen (a hero's too). Mass Confusion takes a guard leader's Tactical, as a hero's. A Curse
// on Tactical or Naval, cast by either side, halves the skill the battle counts. Their commander's spell that cancels
// the attacker's Druid comes before his beasts strike, so they strike with none. Each case is played in both kinds of
// battle on one staged field: realm 0's king attacks a free plain, either its guards (combatVsNPC), led by realm 1's
// king made a warlord of no realm, or realm 1's king's own host (combatVsChar). Both commanders refuse any challenge,
// so no duel is fought, and every d100 is fixed at 1 (stood in by vi.spyOn), so each battle spell is cast. What each case
// reads depends on no other die: a commander's cast line, a gyrocopter harrying the one flyer, the Tactical the lines
// are deployed with (battleDeploy, stood in likewise, calling the real one), the Naval the ladder lifts a fleet by,
// the Druid a beast's strike is weighed with (the spells' registry's, stood in likewise).
// Every other die is a fixed stream's (kcRng.use), so the battle plays the same under any KC_SEED.
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
import * as dice from '../../src/engine/dice-and-army-names.ts';
import * as spellEffects from '../../src/engine/rules/the-registry-of-spell-effects.ts';
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

/** How the battle is staged: the attacker's host, his skills and battle spell (none, unless given), and whether he
 *  ordered a Lightning Advance this turn; the
 *  defenders' units (the guards, or the other king's host), and their commander's skills, the battle spell his plan
 *  names (`CA:<spell>`, or none), and whether a Mass Confusion took his Tactical this turn. */
interface TheStaging {
  readonly theAttackersHost: readonly ArmyInABattle[];
  readonly theAttacker?: { readonly skills: Readonly<Record<string, number>>; readonly spell: string };
  readonly aLightningAdvance?: boolean;
  /** The battle is fought at sea (a free sea), not on a free plain. */
  readonly atSea?: boolean;
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
  // a free plain (or sea), emptied: no one else stands there, and it holds nothing of its own
  const terrain = staging.atSea ? 'sea' : 'plain';
  const field = G.world.provinces.find((p) => p.terrain === terrain && p.owner === null);
  if (!atk || !def || !field) throw new Error(`the world has no king in realm 0 or 1, or no free ${terrain}`);
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
  atk.skills = {
    ...atk.skills,
    ...Object.fromEntries(KC_MAGIC_SCHOOLS.map((school) => [school, 0])),
    ...staging.theAttacker?.skills,
  };
  atk.items = [];
  const hisSpell = staging.theAttacker?.spell;
  atk.encounterPlan = { tactics: [hisSpell ? `CA:${hisSpell}` : 'ME', 'ME', 'ME', 'ME', 'ME'], duelStance: 'refuse' };
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
  // every d100 rolls a 1: each battle spell cast is cast
  const theRolls = vi.spyOn(dice, 'd100').mockReturnValue(1);
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
    theRolls.mockRestore();
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
    expect(unconfused).toBe(4);
    expect(
      aBattle(battle, { ...staging, theirCommander: { ...staging.theirCommander, massConfused: true } })
        .theTacticalDeployedWith.ofTheDefenders,
    ).toBe(0);
  });
});

describe.for(BATTLES)('A Curse on Tactical changes the battle, whichever side casts it, %s', (battle) => {
  const plain: TheStaging = {
    theAttackersHost: [aCompany('Men-at-Arms', 'the First Shields')],
    theAttacker: { skills: { tactical: 4, naval: 0, druid: 0 }, spell: '' },
    theDefenders: [aCompany('Men-at-Arms', 'the Mill Watch')],
    theirCommander: { skills: { tactical: 4, naval: 0, druid: 0 } },
  };
  test("the attacker's Curse halves their commander's Tactical in the lines", () => {
    const shown = aBattle(battle, {
      ...plain,
      theAttacker: { skills: { tactical: 4, naval: 0, druid: 0, necromancy: 5 }, spell: 'Curse' },
    });
    expect(shown.theTacticalDeployedWith).toEqual({ ofTheAttacker: 4, ofTheDefenders: 2 });
  });
  test("their commander's Curse halves the attacker's Tactical in the lines", () => {
    const shown = aBattle(battle, {
      ...plain,
      theirCommander: { skills: { tactical: 4, naval: 0, druid: 0, necromancy: 5 }, spell: 'Curse' },
    });
    expect(shown.theTacticalDeployedWith).toEqual({ ofTheAttacker: 2, ofTheDefenders: 4 });
  });
  test('with no Curse, each side deploys with its Tactical', () => {
    expect(aBattle(battle, plain).theTacticalDeployedWith).toEqual({ ofTheAttacker: 4, ofTheDefenders: 4 });
  });
});

/** The Naval levels the battle's strength ladder lifts a side's fleets by, as its lines record them. */
const theNavalLevelsInTheLadder = (shown: WhatTheBattleShows) =>
  [...JSON.stringify(shown.narrative).matchAll(/"kind":"naval","level":(\d+)/g)].map((m) => Number(m[1]));

describe.for(BATTLES)('A Curse on Naval changes the battle, whichever side casts it, %s', (battle) => {
  const aFleet = [aCompany('Elven Galleys', 'the Swan')];
  const theLandHost = [aCompany('Men-at-Arms', 'the Mill Watch')];
  const aNavalCommander = { tactical: 0, naval: 4, druid: 0 };
  test("their commander's Curse halves the Naval the attacker's fleet is lifted by", () => {
    const shown = (aCurse: boolean) =>
      aBattle(battle, {
        theAttackersHost: aFleet,
        theAttacker: { skills: aNavalCommander, spell: '' },
        theDefenders: theLandHost,
        theirCommander: {
          skills: { tactical: 0, naval: 0, druid: 0, necromancy: aCurse ? 5 : 0 },
          spell: aCurse ? 'Curse' : '',
        },
      });
    expect(theNavalLevelsInTheLadder(shown(false))).toEqual([4]);
    expect(theNavalLevelsInTheLadder(shown(true))).toEqual([2]);
  });
  // (a guard casts a battle spell of any school he knows, his plan or none: with no Curse, he knows no Necromancy)
  test("the attacker's Curse halves the Naval their fleet is lifted by", () => {
    const shown = (aCurse: boolean) =>
      aBattle(battle, {
        theAttackersHost: [aCompany('Men-at-Arms', 'the First Shields')],
        theAttacker: {
          skills: { tactical: 0, naval: 0, druid: 0, necromancy: aCurse ? 5 : 0 },
          spell: aCurse ? 'Curse' : '',
        },
        theDefenders: aFleet,
        theirCommander: { skills: aNavalCommander },
      });
    expect(theNavalLevelsInTheLadder(shown(false))).toEqual([4]);
    expect(theNavalLevelsInTheLadder(shown(true))).toEqual([2]);
  });
});

describe.for(BATTLES)("A spell that cancels Druid comes before the beasts' strikes, %s", (battle) => {
  const theGiants = [{ type: 'Stone Giants', quality: 'Average', race: 'Stone Giant', unitName: 'the Hill Giants' }];
  /** The Druid level each strike of the attacker's Stone Giants is weighed with, under their commander's Psychic
   *  Blast or none. */
  const theDruidHisGiantsStrikeWith = (aBlast: boolean) => {
    const levels: unknown[] = [];
    const real = spellEffects.whatAUnitsStrikeMayDoBeforeTheBattle;
    const theStrikes = vi.spyOn(spellEffects, 'whatAUnitsStrikeMayDoBeforeTheBattle').mockImplementation((facts) => {
      if (facts.theUnitsType === 'Stone Giants') levels.push(facts.theDruidLevel);
      return real(facts);
    });
    try {
      aBattle(battle, {
        theAttackersHost: theGiants,
        theAttacker: { skills: { tactical: 0, naval: 0, druid: 4 }, spell: '' },
        theDefenders: [aCompany('Men-at-Arms', 'the Mill Watch')],
        theirCommander: {
          skills: { tactical: 0, naval: 0, druid: 0, psychic: aBlast ? 5 : 0 },
          spell: aBlast ? 'Psychic Blast' : '',
        },
      });
    } finally {
      theStrikes.mockRestore();
    }
    return levels;
  };
  test("their commander's Psychic Blast takes the attacker's Druid from his beasts' strikes", () => {
    expect(theDruidHisGiantsStrikeWith(false)).toEqual([4]);
    expect(theDruidHisGiantsStrikeWith(true)).toEqual([0]);
  });
});

describe('A Curse on Tactical: the lines that name the Tactical name the level it leaves', () => {
  test("between heroes, the defender's header names the Tactical the Curse leaves him", () => {
    const shown = aBattle('between two hosts', {
      theAttackersHost: [aCompany('Men-at-Arms', 'the First Shields')],
      theAttacker: { skills: { tactical: 0, naval: 0, druid: 0, necromancy: 5 }, spell: 'Curse' },
      theDefenders: [aCompany('Men-at-Arms', 'the Mill Watch')],
      theirCommander: { skills: { tactical: 4, naval: 0, druid: 0 } },
    });
    const theDefendersHeader = shown.narrative.find(
      (l) => typeof l === 'object' && l.kind === 'a force drawn up for battle' && l.role === 'defender',
    );
    expect(JSON.stringify(theDefendersHeader)).toContain('"tacticalLevel":2');
  });
  test.for([false, true])(
    "against guards at sea, a Curse that leaves the hero no Tactical leaves no line that it doesn't apply (cursed: %s)",
    (cursed) => {
      const shown = aBattle('against the guards', {
        atSea: true,
        theAttackersHost: [aCompany('Men-at-Arms', 'the First Shields')],
        theAttacker: { skills: { tactical: 1, naval: 0, druid: 0 }, spell: '' },
        theDefenders: [aCompany('Men-at-Arms', 'the Mill Watch')],
        theirCommander: {
          skills: { tactical: 0, naval: 0, druid: 0, necromancy: cursed ? 5 : 0 },
          spell: cursed ? 'Curse' : '',
        },
      });
      const theLines = shown.narrative.filter(
        (l) => typeof l === 'object' && l.kind === "the attacker's Tactical command does not apply at sea",
      );
      expect(theLines).toHaveLength(cursed ? 0 : 1);
    },
  );
});
