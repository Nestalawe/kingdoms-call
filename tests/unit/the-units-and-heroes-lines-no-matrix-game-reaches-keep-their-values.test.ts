// The lines plan P1-10b32 changed to free the units', the heroes' and the province bookkeeping's files of the ts-nocheck
// line (src/engine/units/drill-and-spoils.ts, units/movement-pools.ts, heroes/experience-skill-rises-and-earned-hp.ts,
// world/province-bookkeeping-and-rallied-garrisons.ts: statements that keep every value, P1-10b's Decision 2) that no
// game of the balance matrix reaches. The matrix proves the others (both sets, every realm's report identical); these
// are proved here, each on the value it had before (worked out by the files as they were, with their ts-nocheck line):
// - a neutral province's defenders brought back inside its band (resyncNeutralDefenders): the extras drawn like its first
//   defender (his quality and race, a type from the province's own land types, not a garrison and not a ship), or with
//   none, an Average company of the province's race (else Human), from all its types when it offers no other, else the
//   first defender's type or Shieldwall Levies;
// - Clairvoyance's watch at a phase's end (updateProvinceMemory): a hero of another realm, watched from the cast's phase
//   on, is seen where he stands and his record kept; one of the realm's own (seen as he stands there, no record), one
//   fallen, or one watched from a later phase, isn't.
// - a skill rise rolled (trySkillGain) for a hero the world doesn't hold (a stand-in): written on his own book; for a
//   guardian, who isn't alive to it: none; in a chieftain's duel, one advance only; the foe of the duel it was earned in
//   named only for a hero who fought one; a rise drawn (resolvePendingSkillGain) in a province where he has risen this
//   turn keeps that rise's mark; a kill by a hero at 0 HP hardens him not at all (awardKillXP).
// Level 1 (unit): the functions called directly on the engine's modules (plan P1-14a) on a staged province or a world
// the engine makes from a fixed seed, with no turn played; a lower level can't run them. The dice are fed.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { KC_SEASONS } from '../../src/content/kingdoms-call-data.ts';
import { kcRng } from '../../src/engine/rng.ts';
import { generateBotSetups, isBotRow } from '../../src/engine/bots/setup.ts';
import { generateNewGame } from '../../src/engine/world/generate.ts';
import { createTurnContext } from '../../src/engine/turn/context.ts';
import { resyncNeutralDefenders } from '../../src/engine/units/drill-and-spoils.ts';
import { updateProvinceMemory } from '../../src/engine/world/province-bookkeeping-and-rallied-garrisons.ts';
import {
  awardKillXP,
  resolvePendingSkillGain,
  SKILLGAIN_STD,
  trySkillGain,
} from '../../src/engine/heroes/experience-skill-rises-and-earned-hp.ts';
import { addTheFieldsResolveTurnAdds } from '../lib/the-fields-resolve-turn-adds-to-the-turns-context.ts';

/** `f` with the dice fed 0 (every draw the first of its list, every band's low end). */
function withTheDiceAtNought<T>(f: () => T): T {
  const was = kcRng.use(() => 0);
  try {
    return f();
  } finally {
    kcRng.use(was);
  }
}

/** A neutral land province of the tax, the race and the types given, its defenders those given. */
const aNeutralProvince = (
  tax: number,
  race: string | null,
  armyTypes: string[],
  neutralDefenders: { type: string; quality: string; race: string; unitName: string }[],
) => ({
  id: 4,
  name: 'Thornmere',
  terrain: 'plain',
  owner: null,
  tax,
  race,
  armyTypes,
  neutralDefenders,
  npcArmies: 0,
});

describe("a neutral province's defenders brought back inside its band", () => {
  test('the extras are drawn like its first defender: his quality and race, a land type the province offers', () => {
    const prov = aNeutralProvince(
      7,
      'Human',
      ['Human Garrison', 'Galleon Fleet', 'Free Lances'],
      [{ type: 'Yeoman Longbows', quality: 'Veteran', race: 'Elven', unitName: 'the Hollow Bows' }],
    );
    const changed = withTheDiceAtNought(() => resyncNeutralDefenders(prov as never));
    expect({
      changed,
      npcArmies: prov.npcArmies,
      drawn: prov.neutralDefenders.map((d) => [d.type, d.quality, d.race, typeof d.unitName, d.unitName !== '']),
    }).toEqual({
      changed: true,
      npcArmies: 3,
      drawn: [
        ['Yeoman Longbows', 'Veteran', 'Elven', 'string', true],
        ['Free Lances', 'Veteran', 'Elven', 'string', true],
        ['Free Lances', 'Veteran', 'Elven', 'string', true],
      ],
    });
  });

  test("with none, an Average company of the province's race, else Human; from all its types when it offers no other", () => {
    const drawn = (race: string | null, armyTypes: string[]) => {
      const prov = aNeutralProvince(0, race, armyTypes, []);
      withTheDiceAtNought(() => resyncNeutralDefenders(prov as never));
      return prov.neutralDefenders.map((d) => [d.type, d.quality, d.race]);
    };
    expect({
      dwarven: drawn('Dwarven', ['Free Lances']),
      noRace: drawn(null, ['Free Lances']),
      emptyRace: drawn('', ['Free Lances']),
      onlyAGarrisonAndAShip: drawn('Orcish', ['Orc Garrison', 'Galleon Fleet']),
      noTypes: drawn('Orcish', []),
    }).toEqual({
      dwarven: [['Free Lances', 'Average', 'Dwarven']],
      noRace: [['Free Lances', 'Average', 'Human']],
      emptyRace: [['Free Lances', 'Average', 'Human']],
      onlyAGarrisonAndAShip: [['Orc Garrison', 'Average', 'Orcish']],
      noTypes: [['Shieldwall Levies', 'Average', 'Orcish']],
    });
  });
});

// A world of two bot realms, made by the engine from a fixed seed, kept as JSON: each case stages a fresh copy.
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

/** A hero as these cases read and stage him. */
interface AHero {
  id: number;
  player: number | null;
  alive: boolean;
  location: number;
  name: string;
  hpEarned?: number;
}
/** A province as these cases read it. */
interface AProvince {
  id: number;
  name: string;
}
/** A realm as these cases read it: what it remembers and the heroes it has seen. */
interface ARealm {
  _provMemory?: Record<string, unknown>;
  seenCharIntel?: Record<string, { lastLocId: number; lastLocName: string; player: number | null }>;
}
/** The world as these cases read it. */
interface World {
  turn: number;
  characters: AHero[];
  players: ARealm[];
  world: { provinces: AProvince[] };
}

/** Realm 0 at a phase's end, watching by Clairvoyance from the phase given a hero of the realm given (alive or fallen),
 *  who stands in a province realm 0 doesn't otherwise see: whether that province is remembered, and what realm 0's
 *  record of him says. */
function aWatchAtThePhasesEnd(hisRealm: number, fromPhase: number, alive: boolean) {
  const unseen = (() => {
    const G = JSON.parse(THE_WORLD) as World;
    const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], 3), { KC_SEASONS, isBotRow });
    updateProvinceMemory(tc as never, 2);
    const seen = G.players[0]?._provMemory ?? {};
    const where = G.world.provinces.find((p) => !(String(p.id) in seen));
    if (!where) throw new Error('realm 0 sees every province');
    return where.id;
  })();
  const G = JSON.parse(THE_WORLD) as World;
  const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], 3), { KC_SEASONS, isBotRow });
  const hero = G.characters.find((c) => c.player === hisRealm && c.alive);
  if (!hero) throw new Error(`the world has no hero of realm ${String(hisRealm)}`);
  Object.assign(hero, { location: unseen, alive });
  tc['clairWatch'] = { 0: { charId: hero.id, fromPhase } };
  updateProvinceMemory(tc as never, 2);
  const realm0 = G.players[0];
  const record = realm0?.seenCharIntel?.[String(hero.id)];
  return {
    remembered: String(unseen) in (realm0?._provMemory ?? {}),
    record: record && [record.lastLocId === unseen, record.lastLocName, record.player],
    provinceName: G.world.provinces[unseen]?.name,
  };
}

describe("Clairvoyance's watch at a phase's end", () => {
  test("a hero of another realm, watched from the cast's phase on, is seen where he stands, and his record kept", () => {
    const watched = aWatchAtThePhasesEnd(1, 1, true);
    expect(watched).toEqual({
      remembered: true,
      record: [true, watched.provinceName, 1],
      provinceName: watched.provinceName,
    });
  });

  test("one of the realm's own (his province is seen as he stands there), one fallen, or one watched later, isn't", () => {
    const notSeen = { remembered: false, record: undefined };
    const strip = ({ remembered, record }: ReturnType<typeof aWatchAtThePhasesEnd>) => ({ remembered, record });
    expect({
      own: strip(aWatchAtThePhasesEnd(0, 1, true)),
      fallen: strip(aWatchAtThePhasesEnd(1, 1, false)),
      later: strip(aWatchAtThePhasesEnd(1, 3, true)),
    }).toEqual({ own: { remembered: true, record: undefined }, fallen: notSeen, later: notSeen });
  });
});

describe("a skill rise rolled for a hero the world doesn't hold, and for a guardian", () => {
  test("a stand-in the world doesn't hold rolls on his own book; a guardian, who isn't alive to it, rolls none", () => {
    const G = JSON.parse(THE_WORLD) as World;
    const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], 3), { KC_SEASONS, isBotRow });
    const standIn: Record<string, unknown> = {
      id: 999,
      name: 'Wend the Stranger',
      alive: true,
      player: 0,
      race: 'Elven',
      skills: { melee: 2 },
    };
    const guardian = { name: 'the Ashen Wyrm', hp: 30 };
    withTheDiceAtNought(() => {
      trySkillGain(tc as never, standIn, 'melee', SKILLGAIN_STD);
      trySkillGain(tc as never, guardian, 'melee', SKILLGAIN_STD);
    });
    expect({ hisRises: standIn['_sgPending'], theGuardiansKeys: Object.keys(guardian) }).toEqual({
      hisRises: {
        turn: G.turn,
        phase: null,
        list: [{ skill: 'melee', prov: null, phase: null, duelWith: null }],
        done: false,
      },
      theGuardiansKeys: ['name', 'hp'],
    });
  });
});

/** A stand-in hero of realm 0 the world doesn't hold, his Melee at 2. */
const aStandIn = (): Record<string, unknown> => ({
  id: 999,
  name: 'Wend the Stranger',
  alive: true,
  player: 0,
  race: 'Elven',
  skills: { melee: 2 },
});

describe("a skill rise's guards, its duel's foe and its province's mark", () => {
  test("in a chieftain's duel, one advance only: the first spends it, the second rolls none", () => {
    const G = JSON.parse(THE_WORLD) as World;
    const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], 3), { KC_SEASONS, isBotRow });
    const [first, second] = [aStandIn(), { ...aStandIn(), id: 998 }];
    tc['_chieftainDuelGain'] = { used: false };
    withTheDiceAtNought(() => {
      trySkillGain(tc as never, first, 'melee', SKILLGAIN_STD);
      trySkillGain(tc as never, second as never, 'melee', SKILLGAIN_STD);
    });
    const hisCandidates = (h: Record<string, unknown>) => (h['_sgPending'] as { list: { skill: string }[] }).list;
    expect([tc['_chieftainDuelGain'], hisCandidates(first).map((e) => e.skill), hisCandidates(second)]).toEqual([
      { used: true },
      ['melee'],
      [],
    ]);
  });

  test('the foe of the duel it was earned in is named only for a hero who fought one', () => {
    const G = JSON.parse(THE_WORLD) as World;
    const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], 3), { KC_SEASONS, isBotRow });
    const [duellist, onlooker] = [aStandIn(), { ...aStandIn(), id: 998 }];
    tc['_duelFoes'] = new Map([[999, 'Gorm Ironjaw']]);
    withTheDiceAtNought(() => {
      trySkillGain(tc as never, duellist, 'melee', SKILLGAIN_STD);
      trySkillGain(tc as never, onlooker as never, 'melee', SKILLGAIN_STD);
    });
    const theFoe = (h: Record<string, unknown>) =>
      (h['_sgPending'] as { list: { duelWith: unknown }[] }).list[0]?.duelWith;
    expect([theFoe(duellist), theFoe(onlooker)]).toEqual(['Gorm Ironjaw', null]);
  });

  test("a rise drawn in a province where he has risen this turn keeps that rise's mark beside its own", () => {
    const G = JSON.parse(THE_WORLD) as World;
    const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], 3), { KC_SEASONS, isBotRow });
    const hero = {
      ...aStandIn(),
      _sgLog: {
        turn: G.turn,
        phaseNo: 1,
        phaseSkills: {},
        provSkills: { 5: { melee: true } },
        turnGains: {},
        turnSkills: {},
      },
      _sgPending: {
        turn: G.turn,
        phase: 2,
        list: [{ skill: 'tactical', prov: 5, phase: 2, duelWith: null }],
        done: false,
      },
    };
    withTheDiceAtNought(() => {
      resolvePendingSkillGain(tc as never, hero);
    });
    expect(hero._sgLog.provSkills).toEqual({ 5: { melee: true, tactical: true } });
  });

  test('a kill by a hero at 0 HP hardens him not at all; at 10 HP, it does', () => {
    const hardened = (hp: number) => {
      const G = JSON.parse(THE_WORLD) as World;
      const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], 3), { KC_SEASONS, isBotRow });
      const [killer, victim] = [G.characters.find((c) => c.player === 0), G.characters.find((c) => c.player === 1)];
      if (!killer || !victim) throw new Error('the world has no hero of realm 0 or 1');
      Object.assign(killer, { hp });
      Object.assign(victim, { alive: false, killedThisTurn: true });
      const before = Number(killer.hpEarned) || 0;
      withTheDiceAtNought(() => {
        awardKillXP(tc as never, killer as never, victim as never);
      });
      return (Number(killer.hpEarned) || 0) - before;
    };
    expect([hardened(0), hardened(10)]).toEqual([0, 2]);
  });
});
