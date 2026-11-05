// The battle magic lines no matrix game reaches keep their values (plan P1-19's spells family, row P1-19u). By the
// matrix's coverage of both sets (P1-19's scoping, and npm run proof:unreached on the row), no game reaches a hero's
// Control Undead against neutral guards, his Holy Symbol on undead guards, or a Fireball cast with an Ember Rune. This
// plays each: Control Undead's unit drawn leaves the guards and joins the hero's host; each undead guard loses a quarter
// of its base strength, rounded up, and the living nothing; a Fireball halves the strongest unit, and with an Ember Rune
// the two strongest, between two heroes' hosts and against guards. It calls combatVsNPC and combatVsChar on a world the
// engine makes from a fixed seed; from the moment the hero's spell is chosen (pickBattleSpell, stood in by vi.spyOn,
// which calls the real one) the dice are fed in order (kcRng.use): the cast roll, then Control Undead's draw; every
// other die is a seeded stream's. What the spell did is read when Flak Screen first runs (applyFlakScreen, stood in
// likewise), after the battle magic and the units' strikes, before the volley.
// Control Undead against guards adds the unit drawn to the hero's host twice when the battle's hero is the world's own
// (Parked "Control Undead against neutral guards may add the turned unit twice"): this pins today's count, so its fix
// changes this test with it.
// Since P1-19v it plays a hero's units' strike against guards too, which no game reaches with a totem carried: his
// Totem of the Thunderhead adds its 25 to his Stone Giants' chance, and nothing once he is slain before the battle (his
// host fights on, leaderless), the strike's roll fed so that the miss's line gives the chance.
// Since R-126 (plan question 27, P1-23af) it plays battle magic's one rule against guards, as between heroes, which no
// game reaches: their commander's Lightning Bolt past 5 strikes 5 companies, and a Telekinetic Storm either way, at sea
// or at a commander with no Tactical, marks him, cuts nothing and says it finds no command to disrupt.
// Since P1-10b24 it plays their commander's Control Undead as a battle's copy of himself, which no game reaches: the
// world's own commander gains the hero's undead company (twice, as the hero's own does: Parked).
// The battles and the spell choice keep their names and signatures, so this passes on the code before the registry
// took battle magic (P1-19u's base) and the strikes (P1-19v's), as after; R-126's cases fail before it.
// Level 1 (unit): the engine's modules called directly (plan P1-14a), with the dice that decide fed in order; no turn
// is played. Not lower: the lines sit inside combatVsNPC and combatVsChar. Not higher: a whole turn adds dice before
// the battle, and a cast that succeeds at most 95 times in 100 (the Decisions named a scenario case on the staged
// turn: its cast roll can't be fed, so it would pass by luck).
import '../lib/the-whole-engine.ts';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { ALL_MAGIC_ITEMS_P, KC_MAGIC_SCHOOLS, KC_SEASONS } from '../../src/content/kingdoms-call-data.ts';
import { kcRng, kcRngStream } from '../../src/engine/rng.ts';
import { generateBotSetups, isBotRow } from '../../src/engine/bots/setup.ts';
import { generateNewGame } from '../../src/engine/world/generate.ts';
import { createTurnContext } from '../../src/engine/turn/context.ts';
import { combatVsChar } from '../../src/engine/battle/battles-between-heroes.ts';
import { combatVsNPC } from '../../src/engine/battle/battles-against-province-defenders.ts';
import * as strength from '../../src/engine/battle/strength.ts';
import * as spellChoice from '../../src/engine/magic/pre-battle-spell-choice.ts';
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

/** A company of Men-at-Arms (base strength 6) of the quality and name given, and anything more. */
const aCompany = (quality: string, unitName: string, more: Partial<ArmyInABattle> = {}): ArmyInABattle => ({
  type: 'Men-at-Arms',
  quality,
  race: 'Human',
  unitName,
  ...more,
});

/** What a battle shows of the attacker's battle spell: the lines of its battle magic (kind and facts), and each side's
 *  units, with what this battle took off each, when Flak Screen first runs. */
interface WhatTheBattleShows {
  readonly lines: readonly Record<string, unknown>[];
  /** The lines of each side's battle spell cast (its name and level, its chance and roll). */
  readonly theCasts: readonly Record<string, unknown>[];
  /** The lines of the units' strikes before the battle (plan P1-19v). */
  readonly theStrikes: readonly Record<string, unknown>[];
  readonly theAttackers: readonly (readonly [unitName: string, lost: number])[];
  readonly theDefenders: readonly (readonly [unitName: string, lost: number])[];
  /** Whether a Telekinetic Storm marked each commander, and the share of his Tactical bonus it left him, after the
   *  battle: the hero's, and realm 1's king's (the guards' commander, or the other host's). */
  readonly theTacticalLeft: Readonly<Record<'ofTheHero' | 'ofTheirCommander', readonly [unknown, unknown]>>;
  /** The companies the world's realm 1's king holds after the battle (the guards' commander, or the other host's). */
  readonly theirCommandersHostInTheWorld: readonly string[];
}

/** The guards' commander (realm 1's king, made a warlord of no realm, at the head of the guards): his skills (every
 *  magic school 0 but those given, so he casts only the battle spell his plan names, `CA:<spell>`, or none for ''),
 *  refusing any challenge, wearing the item named, if any. And whether the battle is fought at sea. */
interface TheGuardsSide {
  readonly theirCommander?: {
    readonly skills: Readonly<Record<string, number>>;
    readonly spell: string;
    /** An item he wears, by its name. */
    readonly item?: string;
  };
  readonly atSea?: boolean;
  /** He leads them as a battle's copy of himself, as a stalled battle hands him (the world keeps the real one). */
  readonly asABattlesCopy?: boolean;
}

/** A battle on land (or at sea) in which realm 0's king (Elemental, White and Necromancy 5, and any skills given)
 *  casts the battle spell his plan names (`CA:<spell>`; none for ''), carrying the item named, at the head of his host
 *  (the First Shields, or the host given, with the Druid given; slain before the battle, if so): against `defenders`,
 *  either neutral guards (combatVsNPC) with no commander or the one given, or realm 1's king's host, who casts nothing
 *  (combatVsChar). From the moment his spell is chosen the next dice are `dice`, in order (the cast roll first: 0 rolls
 *  a 1; his, or with none his foe's); every other die is a seeded stream's. */
function aBattle(
  battle: 'against the guards' | 'between two hosts',
  spell: string,
  defenders: readonly ArmyInABattle[],
  dice: readonly number[],
  item?: string,
  theHero: {
    readonly host?: readonly ArmyInABattle[];
    readonly isSlain?: boolean;
    readonly druid?: number;
    readonly skills?: Readonly<Record<string, number>>;
  } = {},
  theGuards: TheGuardsSide = {},
): WhatTheBattleShows {
  const G = JSON.parse(THE_WORLD) as World;
  const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], 3), { KC_SEASONS, isBotRow });
  tc._currentPhase = 1;
  tc._logCtx.phase = 1;
  G.relations['0-1'] = 'enemy';
  const [atk, def] = [0, 1].map((p) => G.characters.find((c) => c.alive && c.player === p && c.isKing));
  // a free plain (or a free sea), emptied: no one else stands there, and it holds nothing of its own
  const terrain = theGuards.atSea ? 'sea' : 'plain';
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
  atk.armies = theHero.host ? [...theHero.host] : [aCompany('Average', 'the First Shields')];
  atk.skills = {
    ...atk.skills,
    elemental: 5,
    white: 5,
    necromancy: 5,
    ...(theHero.druid === undefined ? {} : { druid: theHero.druid }),
    ...theHero.skills,
  };
  if (theHero.isSlain) atk.alive = false;
  atk.encounterPlan = { tactics: [spell ? `CA:${spell}` : 'ME', 'ME', 'ME', 'ME', 'ME'], duelStance: 'refuse' };
  const rune = item ? ALL_MAGIC_ITEMS_P.find((it) => it.name === item) : undefined;
  atk.items = rune ? [{ ...rune, id: 1, equipped: true }] : [];

  const stream = kcRngStream(7);
  /** The dice fed so far, once the hero's spell is chosen (none before). */
  const fed: { count: number | null } = { count: null };
  const realPick = spellChoice.pickBattleSpell;
  vi.spyOn(spellChoice, 'pickBattleSpell').mockImplementation((...args) => {
    fed.count ??= 0;
    return realPick(...args);
  });
  const seen: { at: Pick<WhatTheBattleShows, 'theAttackers' | 'theDefenders'> | null } = { at: null };
  const lost = (units: Parameters<typeof strength.applyFlakScreen>[0]) =>
    (units ?? []).map((u) => [u?.unitName ?? '', u?._tempStrReduction ?? 0] as const);
  const realFlakScreen = strength.applyFlakScreen;
  vi.spyOn(strength, 'applyFlakScreen').mockImplementation((...args) => {
    seen.at ??= { theAttackers: lost(args[0]), theDefenders: lost(args[1]) };
    realFlakScreen(...args);
  });
  const was = kcRng.use(() =>
    fed.count !== null && fed.count < dice.length ? (dice[fed.count++] ?? stream()) : stream(),
  );
  let narrative: NarrativeLine[];
  try {
    if (battle === 'between two hosts') {
      moveTo(def);
      def.armies = [...defenders];
      def.encounterPlan = { tactics: ['ME', 'ME', 'ME', 'ME', 'ME'], duelStance: 'refuse' };
      narrative = (
        combatVsChar(...([tc, atk, def, field] as unknown as Parameters<typeof combatVsChar>)) as {
          narrative: NarrativeLine[];
        }
      ).narrative;
    } else {
      field.owner = null;
      field.neutralDefenders = [...defenders];
      const theirs = theGuards.theirCommander;
      if (theirs) {
        moveTo(def);
        const theirItem = theirs.item ? ALL_MAGIC_ITEMS_P.find((it) => it.name === theirs.item) : undefined;
        Object.assign(def, {
          player: null,
          armies: [],
          items: theirItem ? [{ ...theirItem, id: 2, equipped: true }] : [],
        });
        def.skills = {
          ...def.skills,
          ...Object.fromEntries(KC_MAGIC_SCHOOLS.map((school) => [school, 0])),
          ...theirs.skills,
        };
        def.encounterPlan = {
          tactics: [theirs.spell ? `CA:${theirs.spell}` : 'ME', 'ME', 'ME', 'ME', 'ME'],
          duelStance: 'refuse',
        };
      }
      narrative = (
        combatVsNPC(
          ...([tc, atk, field, theirs ? (theGuards.asABattlesCopy ? { ...def } : def) : null] as unknown as Parameters<
            typeof combatVsNPC
          >),
        ) as {
          narrative: NarrativeLine[];
        }
      ).narrative;
    }
  } finally {
    kcRng.use(was);
  }
  if (fed.count === null) throw new Error('the spell choice was never stood in');
  if (!seen.at) throw new Error('Flak Screen never ran');
  const lines = narrative.flatMap((l) =>
    typeof l === 'object' && /fireball|lightning bolt|telekinetic storm|control undead|holy symbol/.test(l.kind)
      ? [{ ...l }]
      : [],
  );
  const theStrikes = narrative.flatMap((l) => (typeof l === 'object' && l.kind.includes('power') ? [{ ...l }] : []));
  const theCasts = narrative.flatMap((l) =>
    typeof l === 'object' && l.kind.includes('casts a spell before the battle') ? [{ ...l }] : [],
  );
  const theTacticalLeft = (c: Character) => [c['_tacticalHalved'], c['_tacticalMult']] as const;
  return {
    lines,
    theStrikes,
    theCasts,
    ...seen.at,
    theTacticalLeft: { ofTheHero: theTacticalLeft(atk), ofTheirCommander: theTacticalLeft(def) },
    theirCommandersHostInTheWorld: def.armies.map((a) => a.unitName),
  };
}

describe("a hero's battle magic against neutral guards, in the lines no game reaches", () => {
  test('Control Undead: the second undead drawn of two leaves the guards and joins his host (twice: Parked)', () => {
    const shown = aBattle(
      'against the guards',
      'Control Undead',
      [
        aCompany('Average', 'the Mill Watch'),
        aCompany('Average', 'the Bone Watch', { _isSkeletal: true }),
        aCompany('Average', 'the Grey Watch', { race: 'Undead' }),
      ],
      [0, 0.6],
    );
    expect(shown.lines).toHaveLength(1);
    expect(shown.lines[0]).toMatchObject({
      kind: "control undead turns a defending undead unit to the attacker's side",
      turnedUnitName: 'the Grey Watch',
    });
    expect(shown.theDefenders.map(([name]) => name)).toEqual(['the Mill Watch', 'the Bone Watch']);
    expect(shown.theAttackers.map(([name]) => name)).toEqual(['the First Shields', 'the Grey Watch', 'the Grey Watch']);
  });

  test('Holy Symbol: each undead guard loses a quarter of its base strength, rounded up; the living nothing', () => {
    const shown = aBattle(
      'against the guards',
      'Holy Symbol',
      [
        aCompany('Average', 'the Mill Watch'),
        aCompany('Average', 'the Bone Watch', { _isSkeletal: true }),
        aCompany('Green', 'the Ash Watch', { _isSkeletal: true }),
      ],
      [0],
    );
    expect(shown.lines).toEqual([{ kind: 'a holy symbol sears the defending undead', undeadUnitCount: 2 }]);
    expect(shown.theDefenders).toEqual([
      ['the Mill Watch', 0],
      ['the Bone Watch', 3],
      ['the Ash Watch', 2],
    ]);
  });
});

describe.for(['against the guards', 'between two hosts'] as const)('Fireball with an Ember Rune, %s', (battle) => {
  const defenders = [
    aCompany('Average', 'the Mill Watch'),
    aCompany('Elite', 'the Old Guard'),
    aCompany('Crack', 'the Hill Watch'),
  ];
  const theLine =
    battle === 'against the guards'
      ? "a fireball engulfs the defenders' strongest units"
      : "a fireball halves the enemy's strongest units";
  test('without it, the strongest unit loses half its base strength', () => {
    const shown = aBattle(battle, 'Fireball', defenders, [0]);
    expect(shown.lines).toEqual([{ kind: theLine, fireballHitUnitNames: ['the Old Guard'] }]);
    expect(shown.theDefenders).toEqual([
      ['the Mill Watch', 0],
      ['the Old Guard', 15],
      ['the Hill Watch', 0],
    ]);
  });
  test('with it, the two strongest', () => {
    const shown = aBattle(battle, 'Fireball', defenders, [0], 'Ember Rune');
    expect(shown.lines).toEqual([{ kind: theLine, fireballHitUnitNames: ['the Old Guard', 'the Hill Watch'] }]);
    expect(shown.theDefenders).toEqual([
      ['the Mill Watch', 0],
      ['the Old Guard', 15],
      ['the Hill Watch', 12],
    ]);
  });
});

describe("a hero's units' strikes against neutral guards, in the lines no game reaches (plan P1-19v)", () => {
  // He casts no battle spell, so the first dice fed are his Stone Giants': their one strike drawn (any die), then its
  // roll, a 100: it misses whatever its chance (90% at most), and the line says the chance it had. He carries the Totem
  // of the Thunderhead (+25) and has no Druid.
  const theGiants = [{ type: 'Stone Giants', quality: 'Average', race: 'Stone Giant', unitName: 'the Hill Giants' }];
  const theGuards = [aCompany('Average', 'the Mill Watch')];
  const theMiss = (chance: number) => ({
    kind: "a unit's power gathers but never strikes",
    unitName: 'the Hill Giants',
    powerName: 'Boulder Barrage',
    strikeChancePct: chance,
    druidLevel: 0,
  });
  test('leading them, his totem adds to their chance: 30% and 25%', () => {
    const shown = aBattle('against the guards', '', theGuards, [0, 0.995], 'Totem of the Thunderhead', {
      host: theGiants,
      druid: 0,
    });
    expect(shown.theStrikes).toEqual([theMiss(55)]);
  });
  test('slain before the battle (his host fights on, leaderless), his totem adds nothing: 30%', () => {
    const shown = aBattle('against the guards', '', theGuards, [0, 0.995], 'Totem of the Thunderhead', {
      host: theGiants,
      druid: 0,
      isSlain: true,
    });
    expect(shown.theStrikes).toEqual([theMiss(30)]);
  });
});

describe('battle magic against neutral guards follows the rule between heroes, in the lines no game reaches (R-126)', () => {
  // Their commander (realm 1's king, a warlord of no realm) refuses the hero's challenge, as the hero refuses his.
  const theGuards = [aCompany('Average', 'the Mill Watch')];
  const SCATTERS = "a telekinetic storm scatters the enemy commander's formations";
  const FINDS_NONE = 'a telekinetic storm finds no tactical command to disrupt';
  const aStormLine = (kind: string) => ({
    kind,
    enemyCommanderName: { heroName: expect.any(String) as unknown, leaderless: false },
  });

  test("their commander's Lightning Bolt at Elemental 7 (5 and an Orb of the Storm) strikes 5 of the hero's 8 companies", () => {
    // The hero casts nothing, so the first die fed is their commander's cast roll.
    const theHost = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth'].map((n) =>
      aCompany('Average', `the ${n} Shields`),
    );
    const shown = aBattle(
      'against the guards',
      '',
      theGuards,
      [0],
      undefined,
      { host: theHost },
      {
        theirCommander: { skills: { elemental: 5 }, spell: 'Lightning Bolt', item: 'Orb of the Storm' },
      },
    );
    expect(shown.theCasts).toMatchObject([
      { kind: 'the defender casts a spell before the battle', spellName: 'Lightning Bolt', spellLevel: 7 },
    ]);
    expect(shown.lines).toEqual([{ kind: 'a lightning bolt sears the attacking units', unitCount: 5 }]);
  });

  // Their commander's Control Undead (Necromancy 5) at the hero, who casts nothing: the first die fed is its cast roll,
  // the second the undead drawn. Led by a battle's copy of himself (a shallow one, sharing his list of companies), the
  // world's own commander gains the unit too, twice, as the hero's own does (Parked; no game reaches it: a game's guard is
  // the world's own; plan P1-10b24).
  test("their commander's Control Undead, as a battle's copy, turns the hero's undead company to the world's commander (twice: Parked)", () => {
    const shown = aBattle(
      'against the guards',
      '',
      theGuards,
      [0, 0],
      undefined,
      {
        host: [
          aCompany('Average', 'the First Shields'),
          aCompany('Average', 'the Bone Shields', { _isSkeletal: true }),
        ],
      },
      { theirCommander: { skills: { necromancy: 5 }, spell: 'Control Undead' }, asABattlesCopy: true },
    );
    expect(shown.lines).toEqual([
      {
        kind: "control undead turns an enemy undead unit to the caster's side",
        turnedUnitName: 'the Bone Shields',
        casterName: expect.any(String) as unknown,
      },
    ]);
    expect(shown.theirCommandersHostInTheWorld).toEqual(['the Bone Shields', 'the Bone Shields']);
  });

  // The hero's Telekinetic Storm at their commander (Psychic 5): it halves a Tactical he has, on land; a commander with
  // none, or at sea, is only marked, and the line says the storm finds no command to disrupt.
  test.for([
    ['with Tactical 3, on land: cut to half', 3, false, SCATTERS, 0.5],
    ['with no Tactical, on land: marked, nothing cut', 0, false, FINDS_NONE, 1],
    ['with Tactical 3, at sea: marked, nothing cut', 3, true, FINDS_NONE, 1],
  ] as const)("the hero's storm at their commander %s", ([, tactical, atSea, line, left]) => {
    const shown = aBattle(
      'against the guards',
      'Telekinetic Storm',
      theGuards,
      [0],
      undefined,
      {
        skills: { psychic: 5 },
      },
      { theirCommander: { skills: { tactical }, spell: '' }, atSea },
    );
    expect(shown.lines).toEqual([aStormLine(line)]);
    expect(shown.theTacticalLeft.ofTheirCommander).toEqual([true, left]);
  });

  // Their commander's Telekinetic Storm (Psychic 5) at the hero, who casts nothing: the first die fed is its cast roll.
  test.for([
    ['with Tactical 2, on land: cut to half', 2, false, SCATTERS, 0.5],
    ['with no Tactical, on land: marked, nothing cut', 0, false, FINDS_NONE, 1],
    ['with Tactical 2, at sea: marked, nothing cut', 2, true, FINDS_NONE, 1],
  ] as const)("their commander's storm at the hero %s", ([, tactical, atSea, line, left]) => {
    const shown = aBattle(
      'against the guards',
      '',
      theGuards,
      [0],
      undefined,
      { skills: { tactical } },
      {
        theirCommander: { skills: { psychic: 5 }, spell: 'Telekinetic Storm' },
        atSea,
      },
    );
    expect(shown.lines).toEqual([aStormLine(line)]);
    expect(shown.theTacticalLeft.ofTheHero).toEqual([true, left]);
  });
});
