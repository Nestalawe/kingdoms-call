// The sides and the defenders a battle names, in the lines no matrix game reaches, are the ones it names in play (plan
// P1-12d23: P1-12d's battle slice, Decision 6). By the matrix's coverage of both sets (npm run proof:unreached on the
// row), no game reaches, in a battle against a province's defenders: a province held by its neutral defenders with no
// guard to lead them, nor by a realm's garrison with none, that repels the attacker (the line and the defenders'
// casualties name "the defenders of <province>" and "the garrison of <province>", and, since P1-12d28, so does the
// clause of whom the attacker's company faced, "facing the defenders of <province>'s Company 0", and since P1-12d29 the
// defenders' force header, "The defenders of <province>" or "<realm>'s garrison at <province>"); an attacker storming
// ashore in a Raid the Coast; his corsairs taking his beaten force back to the ships; his Control Undead turning a
// defending unit.
// Since the mutation session of 2026-11-01, also a line the matrix reaches but no test read: the attacker's company
// cut down in the rout when the province's defenders repel him and he has nowhere to retreat (no retreat, stood in;
// the beaten keep every company in the battle's fates, stood in, and from then on every die is 0.1, under the 15%).
// Nor, in a battle between two heroes' hosts: the defender's realm holding its own ground the harder, or the beaten
// attacker's Dwarven Guard holding a Shield Fort with no road out. This plays each, the attacker (or both commanders)
// alive and slain before the battle (each side then fights on as "<name>'s leaderless host"), and reads each line's
// words. What no bot order sets is stood in (vi.spyOn): a force that holds the sea lanes (no realm raises Corsairs any
// more: Parked), where a beaten force can fall back to, a realm's defOwn discovery (since P1-19aa the share the
// discoveries' registry's runner gives, stood in where discSum's was), a Shield Fort and the losses a beaten force takes (so that it keeps a company to hold the fort with); Control Undead's dice are fed in order from
// the moment the hero's spell is chosen (pickBattleSpell, stood in, which calls the real one): the cast roll, then the
// unit drawn. Every other die is a seeded stream's.
// The battles keep their names and signatures, so this passes on the code before the row (P1-12d23's base), as after
// (but the defOwn case, restaged by P1-19aa on the runner, which its base doesn't have).
// Since P1-12d33, also the record the turn's statistics keep of a battle against a province's defenders, in the two
// forms no game reaches ('pvp': a realm's hero leading them, stood in as realm 1's king; 'neutral') and the garrison's,
// read through the views' theStatisticsOfTheTurn, which P1-12d33 adds (so those cases need its code).
// Level 1 (unit): combatVsNPC and combatVsChar called directly on a world the engine makes from a fixed seed; no turn
// is played. Not lower: the lines sit inside the two battles, and their words in the views. Not higher: a whole turn
// adds dice and orders before the battle, and the flags these lines read are set by orders no bot gives.
import '../lib/the-whole-engine.ts';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { KC_SEASONS } from '../../src/content/kingdoms-call-data.ts';
import { kcRng, kcRngStream } from '../../src/engine/rng.ts';
import { generateBotSetups, isBotRow } from '../../src/engine/bots/setup.ts';
import { generateNewGame } from '../../src/engine/world/generate.ts';
import { createTurnContext } from '../../src/engine/turn/context.ts';
import { getNeighborsP } from '../../src/engine/world/map-helpers.ts';
import { combatVsChar } from '../../src/engine/battle/battles-between-heroes.ts';
import { combatVsNPC } from '../../src/engine/battle/battles-against-province-defenders.ts';
import * as theRegistry from '../../src/engine/rules/the-registry-of-content-effects.ts';
import * as retreats from '../../src/engine/units/sea-lift-stranding-and-retreats.ts';
import * as movement from '../../src/engine/units/movement.ts';
import * as fates from '../../src/engine/battle/fates.ts';
import * as theDiscoveries from '../../src/engine/rules/the-registry-of-discovery-effects.ts';
import * as spellChoice from '../../src/engine/magic/pre-battle-spell-choice.ts';
import type { ArmyInABattle } from '../../src/engine/army-tables.ts';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';
import { theWordsOf } from '../../src/views/prose/the-words-of-each-line.ts';
import { theClauseOfWhomAUnitFaced } from '../../src/views/prose/the-words-of-a-battles-lines.ts';
import { addTheFieldsResolveTurnAdds } from '../lib/the-fields-resolve-turn-adds-to-the-turns-context.ts';
import { theStatisticsOfTheTurn } from '../../src/views/the-statistics-of-the-turn.ts';
import type { TurnTelemetry } from '../../src/engine/turn/context.ts';
import type { ABattleAsTheStatisticsRecordIt } from '../../src/engine/battle/the-facts-a-battles-lines-record.ts';

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
  encounterPlan?: { tactics: string[]; duelStance: string };
  [key: string]: unknown;
}
interface Province {
  id: number;
  name: string;
  terrain: string;
  owner: number | null;
  row: number;
  col: number;
  characters: (number | string)[];
  neutralDefenders?: ArmyInABattle[];
  [key: string]: unknown;
}
interface World {
  turn: number;
  relations: Record<string, string>;
  characters: Character[];
  players: { name: string }[];
  world: { cols: number; rows: number; provinces: Province[] };
}

// A world of two bot realms, made by the engine from a fixed seed, kept as JSON: each battle stages a fresh copy.
kcRng.seed(1);
const THE_WORLD = JSON.stringify(
  generateNewGame(
    (generateBotSetups([], 2, 0) as Record<string, unknown>[]).map((b) => ({
      ...b,
      gamePlayerId: 'gp' + String(b['id']),
      name: b['kingdomName'],
    })),
    { cols: 10, rows: 6 },
    999,
    { seaPct: 10 },
  ),
);

/** `n` companies of the type and quality given. */
const companies = (n: number, quality: string, type = 'Men-at-Arms'): ArmyInABattle[] =>
  Array.from({ length: n }, (_, i) => ({ type, quality, race: 'Human', unitName: `Company ${String(i)}` }));

/** What a battle shows: its lines' words, the names of its commanders (realm 1's king for a battle between heroes),
 *  of realm 1 and of its province. */
interface WhatTheBattleShows {
  readonly words: readonly string[];
  readonly atk: string;
  readonly def: string;
  readonly realm1: string;
  readonly province: string;
  /** The battles the turn's statistics record (P1-12d33), and the two commanders' ids. */
  readonly battles: readonly ABattleAsTheStatisticsRecordIt[];
  readonly atkId: number | string;
  readonly defId: number | string;
}

/** A battle on a plain with a sea beside it, free of anyone else, fought by realm 0's king (attacking) at the head of
 *  the host given: against the province's own defenders (`defenders`: combatVsNPC, no guard to lead them), or against
 *  realm 1's king and his host (`def`: combatVsChar). The attacker (and the defender) alive or slain before the
 *  battle; `stage` sets what the battle reads before it is fought; the dice a seeded stream's, but for `dice`, fed in
 *  order from the moment the attacker's battle spell is chosen. */
function aBattle(
  hosts: {
    readonly atk: ArmyInABattle[];
    readonly defenders?: ArmyInABattle[];
    readonly def?: ArmyInABattle[];
    /** In a battle against the province's defenders, realm 1's king leads them, as a guard would. */
    readonly ledByRealm1sKing?: boolean;
  },
  slain: boolean,
  stage: (G: World, atk: Character, def: Character, field: Province) => void,
  dice: readonly number[] = [],
): WhatTheBattleShows {
  const G = JSON.parse(THE_WORLD) as World;
  const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], 3), { KC_SEASONS, isBotRow });
  tc._currentPhase = 1;
  tc._logCtx.phase = 1;
  G.relations['0-1'] = 'enemy';
  const [atk, def] = [0, 1].map((p) => G.characters.find((c) => c.alive && c.player === p && c.isKing));
  const field = G.world.provinces.find(
    (p) =>
      p.terrain === 'plain' &&
      p.owner === null &&
      getNeighborsP(p, G.world.cols, G.world.rows, G.world.provinces).some((n) => n.terrain === 'sea'),
  );
  if (!atk || !def || !field) throw new Error('the world has no king in realm 0 or 1, or no free plain by the sea');
  Object.assign(field, { characters: [], features: [], garrisonArmies: [], npcArmies: 0 });
  const moveTo = (c: Character) => {
    const from = G.world.provinces[c.location];
    if (from) from.characters = from.characters.filter((id) => id !== c.id);
    c.location = field.id;
    field.characters.push(c.id);
  };
  atk['_attackedFrom'] = atk.location;
  moveTo(atk);
  atk.armies = hosts.atk;
  atk.encounterPlan = { tactics: ['ME', 'ME', 'ME', 'ME', 'ME'], duelStance: 'refuse' };
  if (slain) atk.alive = false;
  if (hosts.def) {
    moveTo(def);
    def.armies = hosts.def;
    def.encounterPlan = { tactics: ['ME', 'ME', 'ME', 'ME', 'ME'], duelStance: 'refuse' };
    if (slain) def.alive = false;
  } else field.neutralDefenders = hosts.defenders ?? [];
  stage(G, atk, def, field);
  const stream = kcRngStream(7);
  const fed: { count: number | null } = { count: null };
  const realPick = spellChoice.pickBattleSpell;
  vi.spyOn(spellChoice, 'pickBattleSpell').mockImplementation((...args) => {
    fed.count ??= 0;
    return realPick(...args);
  });
  const was = kcRng.use(() =>
    fed.count !== null && fed.count < dice.length ? (dice[fed.count++] ?? stream()) : stream(),
  );
  let narrative: NarrativeLine[];
  try {
    narrative = (
      (hosts.def
        ? combatVsChar(tc, atk, def, field)
        : combatVsNPC(tc, atk, field, hosts.ledByRealm1sKing ? def : null)) as {
        narrative: NarrativeLine[];
      }
    ).narrative;
  } finally {
    kcRng.use(was);
  }
  return {
    words: narrative.map((l) => theWordsOf(l)),
    atk: atk.name,
    def: def.name,
    realm1: G.players[1]?.name ?? '',
    province: field.name,
    battles: theStatisticsOfTheTurn(tc['_tel'] as TurnTelemetry).battles,
    atkId: atk.id,
    defId: def.id,
  };
}

/** The names the battle's force headers give (the header's machine form: the force a header names, a record since
 *  P1-12d29, written by the prose). */
const theHeadersNames = (words: readonly string[]): unknown[] =>
  words
    .filter((w) => w.startsWith('⚑FORCE⚑'))
    .map((w) => (JSON.parse(w.slice('⚑FORCE⚑'.length)) as { name: unknown }).name);

/** A side's name in a line: its commander's, or his host's once he fell before the battle. */
const sideOf = (name: string, slain: boolean) => (slain ? `${name}'s leaderless host` : name);

describe.each([false, true])('a battle against a province with no guard, the attacker slain before it: %s', (slain) => {
  test('held by its neutral defenders, it falls to a Raid the Coast', () => {
    const shown = aBattle({ atk: companies(8, 'Elite'), defenders: companies(1, 'Green') }, slain, (G, atk, _, f) => {
      atk['_raidCarriedAt'] = { turn: G.turn, prov: f.id };
    });
    const atk = sideOf(shown.atk, slain);
    expect(shown.words).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/, held by its neutral defenders — a battle is initiated\.$/),
        `  ⚓ ${atk} storms ashore in a Raid the Coast — +25% strength.`,
      ]),
    );
  });

  test('its neutral defenders repel the attacker, and his corsairs take his beaten force back to the ships', () => {
    vi.spyOn(theRegistry, 'aForceHoldsTheSeaLanes').mockReturnValue(true);
    vi.spyOn(retreats, 'retreatOptions').mockReturnValue([]);
    const shown = aBattle({ atk: companies(1, 'Green'), defenders: companies(8, 'Elite') }, slain, () => undefined);
    const atk = sideOf(shown.atk, slain);
    expect(shown.words).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          new RegExp(
            `^${atk}'s forces are repelled! .*, the defenders of ${shown.province} hold their ground — neutral defenders never retreat!$`,
          ),
        ),
        `🛡 **the defenders of ${shown.province}'s forces** (defender):`,
        `⛵ ${atk}'s corsairs stand off the shore with boats ready — the beaten force pulls back to the ships in good order rather than being cut down.`,
      ]),
    );
    // the defenders' force header names them as "The defenders of <province>" (no game reaches it)
    expect(theHeadersNames(shown.words)).toContain(`The defenders of ${shown.province}`);
  });

  test("held by a realm's garrison, it repels the attacker as the garrison of the province", () => {
    const shown = aBattle({ atk: companies(1, 'Green'), defenders: companies(8, 'Elite') }, slain, (_, __, ___, f) => {
      f.owner = 1;
    });
    const atk = sideOf(shown.atk, slain);
    expect(shown.words).toEqual(
      expect.arrayContaining([
        expect.stringMatching(new RegExp(`, held by ${shown.realm1}'s garrison — a battle is initiated\\.$`)),
        expect.stringMatching(
          new RegExp(
            `^${atk}'s forces are repelled! .*, the garrison of ${shown.province} hold their ground — the garrison holds its walls!$`,
          ),
        ),
        `🛡 **the garrison of ${shown.province}'s forces** (defender):`,
      ]),
    );
    // and the garrison's force header as "<realm>'s garrison at <province>"
    expect(theHeadersNames(shown.words)).toContain(`${shown.realm1}'s garrison at ${shown.province}`);
  });

  // Whom the attacker's company faced (battleFacedClauses, read at the deploy and handed to rollUnitFates as `faced`):
  // a company of the defenders, named as their owner (plan P1-12d28: the owner handed as a record, not words).
  test.each([
    ['its neutral defenders', 'the defenders of', () => undefined],
    ["a realm's garrison", 'the garrison of', (f: Province) => Object.assign(f, { owner: 1 })],
  ] as const)('held by %s, the attacker\'s company faced one of "%s" the province\'s companies', (_, owner, hold) => {
    const told: string[] = [];
    const realFates = fates.rollUnitFates;
    vi.spyOn(fates, 'rollUnitFates').mockImplementation((force, o) => {
      const f = o.faced;
      for (const a of force ?? []) {
        const whom = a && f ? (typeof f === 'function' ? f(a) : f.get?.(a)) : null;
        if (whom) told.push(theClauseOfWhomAUnitFaced(whom));
      }
      return realFates(force, o);
    });
    const shown = aBattle({ atk: companies(1, 'Green'), defenders: companies(8, 'Elite') }, slain, (_, __, ___, f) => {
      hold(f);
    });
    expect(told).toEqual([`facing ${owner} ${shown.province}'s Company 0`]);
  });

  test('its neutral defenders repel the attacker with nowhere to retreat: his company is cut down in the rout', () => {
    vi.spyOn(retreats, 'retreatOptions').mockReturnValue([]);
    // the beaten keep every company in the battle's fates; from then on every die is 0.1, under the 15% chance a
    // company with no road out is cut down
    vi.spyOn(fates, 'rollUnitFates').mockImplementation((force, o) => {
      if (!o.won) kcRng.use(() => 0.1);
      return { survived: (force ?? []).length, died: 0, promoted: 0, demoted: 0, disbanded: 0, held: 0 };
    });
    const shown = aBattle({ atk: companies(1, 'Green'), defenders: companies(8, 'Elite') }, slain, () => undefined);
    expect(shown.words).toContain(
      `${sideOf(shown.atk, slain)}'s forces have nowhere to retreat — they rally desperately but take heavy additional losses!`,
    );
    // the units' fates: the defenders' one line, then the attacker's company's
    expect(shown.words.filter((w) => w.startsWith('— '))).toEqual([
      '— All forces survive the engagement.',
      '— Company 0 are cut down in the rout — no escape!',
    ]);
  });
});

// The turn's statistics keep each battle's record (db/telemetry.ts writes it into turn_events), its kind and the
// defending realm by who defends the province (P1-12d33). By the matrix's coverage, no game reaches two of its forms: a
// realm's hero leading the defenders ('pvp', his realm defending) and a province's own defenders with no guard and no
// realm holding it, or held by the attacker's own realm ('neutral').
describe("the turn's statistics record a battle against a province's defenders by who defends it", () => {
  test.each([
    ['its own defenders, the province held by no realm', 'neutral', null],
    ["its own defenders, the province held by the attacker's realm", 'neutral', 0],
    ["a realm's garrison", 'garrison', 1],
  ] as const)('%s: recorded as %s', (_, kind, owner) => {
    const shown = aBattle({ atk: companies(8, 'Elite'), defenders: companies(1, 'Green') }, false, (_G, _a, _d, f) => {
      f.owner = owner;
    });
    expect(shown.battles.map((b) => [b.kind, b.atkPi, b.atkChar, b.defPi, b.defChar])).toEqual([
      [kind, 0, shown.atkId, owner === 1 ? 1 : null, null],
    ]);
  });

  test("a realm's hero leading the defenders: 'pvp', his realm and he defending", () => {
    const shown = aBattle(
      { atk: companies(8, 'Elite'), defenders: companies(1, 'Green'), ledByRealm1sKing: true },
      false,
      () => undefined,
    );
    expect(shown.battles.map((b) => [b.kind, b.atkPi, b.atkChar, b.defPi, b.defChar])).toEqual([
      ['pvp', 0, shown.atkId, 1, shown.defId],
    ]);
  });
});

test("a battle against a province's defenders: the attacker's Control Undead turns a defending unit to his side", () => {
  const shown = aBattle(
    {
      atk: companies(2, 'Average'),
      defenders: [{ type: 'Men-at-Arms', quality: 'Average', race: 'Undead', unitName: 'Grey Watch' }],
    },
    false,
    (_, atk) => {
      atk.skills = { ...atk.skills, necromancy: 5 };
      atk.encounterPlan = { tactics: ['CA:Control Undead', 'ME', 'ME', 'ME', 'ME'], duelStance: 'refuse' };
    },
    [0, 0],
  );
  expect(shown.words).toContain(`  ☠ Control Undead turns the Grey Watch — it defects to ${shown.atk}'s side!`);
});

describe.each([false, true])('a battle between heroes, both commanders slain before it: %s', (slain) => {
  test("the defender's realm holds its own ground the harder", () => {
    vi.spyOn(theDiscoveries, 'theShareARealmsDiscoveriesFortifyItsOwnGroundBy').mockReturnValue(0.1);
    const shown = aBattle({ atk: companies(2, 'Average'), def: companies(2, 'Average') }, slain, (_, __, ___, f) => {
      f.owner = 1;
    });
    expect(shown.words).toContain(
      `  🛡 ${sideOf(shown.def, slain)}'s realm holds its own ground the harder (+10% defence).`,
    );
  });

  test("the beaten attacker's Dwarven Guard hold a Shield Fort with no road out", () => {
    vi.spyOn(movement, 'shieldFortHolds').mockReturnValue(true);
    vi.spyOn(retreats, 'retreatOptions').mockReturnValue([]);
    // the beaten keep every company: the fort has someone to hold it
    vi.spyOn(fates, 'rollUnitFates').mockImplementation((force) => ({
      survived: (force ?? []).length,
      died: 0,
      promoted: 0,
      demoted: 0,
      disbanded: 0,
      held: 0,
    }));
    const shown = aBattle(
      { atk: companies(1, 'Green', 'Dwarven Guard'), def: companies(8, 'Elite') },
      slain,
      () => undefined,
    );
    expect(shown.words).toContainEqual(
      expect.stringContaining(
        ` — with no road out, ${sideOf(shown.atk, slain)}'s Dwarven Guard lock shields where they stand. None are cut down in flight, and ${shown.province} remains contested.`,
      ),
    );
  });
});
