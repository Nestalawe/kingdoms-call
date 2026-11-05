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
// And the lines plan P1-10b33 changed to free the sea lift's and a hero's death's files (units/sea-lift-stranding-and-
// retreats.ts, heroes/hero-death-and-leaderless-hosts.ts) that no game reaches:
// - a column stranded at sea with no shore of its realm beside it (settleStrandedAtSea): on unowned, undefended water
//   the units put ashore hold and claim it, the realm keeping its provinces; in another realm's waters they are lost,
//   the line naming whose; a fallen commander's host on such water does the same (disperseDeadCharArmies); a fallen
//   hero or a spared coward with no list of units leaves none;
// - a hero's death (handleHeroDeath): a battle's copy handed in (the real hero dies, with the copy's hit points); a
//   stand-in with no id; a vanished hero and the wanderer, who live at half their most hit points, the line their
//   slayer's realm's and seen in the battle; no options; Battlefield Surgery's lines of the phase resolving; slain by
//   no one named; his possessions taken by a slayer the world doesn't hold, one with no id, or one of another realm;
// - a retreat by sea: to the water a landing came from only when it is unowned and undefended (retreatOptions,
//   navalSplitRetreat), the units the hulls can't carry joining the garrison of the realm's ground beside it, and each
//   function handed a list that is missing.
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
import {
  abandonHostOnFlight,
  disperseDeadCharArmies,
  handleHeroDeath,
} from '../../src/engine/heroes/hero-death-and-leaderless-hosts.ts';
import {
  _navalLeaveBehind,
  bestRetreat,
  clearNavalHold,
  navalHeldIn,
  navalHoldLine,
  navalSplitRetreat,
  pickStrandedUnits,
  preferDryGround,
  retreatOptions,
  seaLiftShortfall,
  seaTrapLine,
  settleStrandedAtSea,
} from '../../src/engine/units/sea-lift-stranding-and-retreats.ts';
import { getNeighborsP } from '../../src/engine/world/map-helpers.ts';
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

// ── P1-10b33: the sea lift, the stranding, the retreats and a hero's death ──
/** A unit of the type given, Average and Human, by the name given. */
const aUnit = (type: string, unitName: string) => ({ type, quality: 'Average', race: 'Human', unitName });
/** A province of the world as these cases stage it. */
interface AStagedProvince {
  id: number;
  name: string;
  terrain: string;
  owner: number | null;
  row: number;
  col: number;
  tax: number;
  characters: number[];
  garrisonArmies: unknown[];
  neutralDefenders: unknown[];
}
/** A realm of the world as these cases stage it. */
interface AStagedRealm {
  name: string;
  provinces: number[];
  discoveries?: unknown[];
}
/** A hero of the world as these cases stage him. */
type AStagedHero = Record<string, unknown> & { id: number; player: number | null; location: number; name: string };
/** The world as these cases stage it. */
interface TheStagedWorld {
  turn: number;
  characters: AStagedHero[];
  players: AStagedRealm[];
  mercenaries: unknown[];
  heroGraveyard: unknown[];
  world: { cols: number; rows: number; provinces: AStagedProvince[] };
}
/** A fresh copy of the world, its turn's context, and the lines it has told (each line's fact). */
function aStagedWorld() {
  const G = JSON.parse(THE_WORLD) as TheStagedWorld;
  const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], 3), { KC_SEASONS, isBotRow });
  const told = () => tc.turnLog.map((l) => l['fact'] as Record<string, unknown>);
  const neighbours = (p: AStagedProvince) =>
    getNeighborsP(p, G.world.cols, G.world.rows, G.world.provinces).filter((q) => q.id !== p.id);
  return { G, tc, told, neighbours };
}
/** In the world given: a province made open sea, unowned and undefended, every province beside it the enemy's (realm
 *  1's) dry land; and Seren (hero 1, realm 0's) put there, leading the units given. */
function aSeaWithNoShoreOfTheRealms(S: ReturnType<typeof aStagedWorld>, armies: unknown[]) {
  const sea = S.G.world.provinces.find((p) => S.neighbours(p).length >= 4 && p.owner == null);
  const seren = S.G.characters.find((c) => c.id === 1);
  if (!sea || !seren) throw new Error('could not stage: no province with four beside it, or no Seren');
  Object.assign(sea, { terrain: 'sea', owner: null, neutralDefenders: [], garrisonArmies: [] });
  for (const q of S.neighbours(sea)) Object.assign(q, { terrain: 'plain', owner: 1 });
  Object.assign(seren, { location: sea.id, armies });
  return { sea, seren };
}

describe('a column stranded at sea with no shore of its realm beside it', () => {
  test('on unowned, undefended water, the units put ashore hold it and claim it: the realm keeps what it held', () => {
    const S = aStagedWorld();
    const { sea } = aSeaWithNoShoreOfTheRealms(S, [
      aUnit('Free Lances', 'the Red Lances'),
      aUnit('Free Lances', 'the Grey Lances'),
    ]);
    const realm0 = S.G.players[0];
    const held = [...(realm0?.provinces ?? [])];
    settleStrandedAtSea(S.tc as never, 2);
    expect({
      owner: sea.owner,
      provinces: realm0?.provinces,
      garrison: sea.garrisonArmies.map((a) => (a as { unitName: string }).unitName),
      kinds: S.told().map((f) => f['kind']),
    }).toEqual({
      owner: 0,
      provinces: [...held, sea.id],
      garrison: ['the Red Lances', 'the Grey Lances'],
      kinds: ['units a column cannot carry hold and claim an unowned sea province'],
    });
  });

  test("in another realm's waters they are lost, the line naming whose waters they were", () => {
    const S = aStagedWorld();
    const { sea } = aSeaWithNoShoreOfTheRealms(S, [aUnit('Free Lances', 'the Red Lances')]);
    sea.owner = 1;
    settleStrandedAtSea(S.tc as never, 2);
    const [line] = S.told();
    expect([line?.['kind'], line?.['waters'], sea.garrisonArmies]).toEqual([
      'units a column cannot carry are lost at sea',
      { realmName: S.G.players[1]?.name },
      [],
    ]);
  });
});

describe("a fallen commander's host, and a host with no list of units", () => {
  test('a commander who falls on unowned, undefended water: his host holds it and claims it, his realm keeping its own', () => {
    const S = aStagedWorld();
    const { sea, seren } = aSeaWithNoShoreOfTheRealms(S, [aUnit('Free Lances', 'the Red Lances')]);
    const realm0 = S.G.players[0];
    const held = [...(realm0?.provinces ?? [])];
    disperseDeadCharArmies(S.tc as never, seren as never);
    expect({
      owner: sea.owner,
      provinces: realm0?.provinces,
      garrison: sea.garrisonArmies.map((a) => (a as { unitName: string }).unitName),
      line: S.told().map((f) => [f['kind'], f['realmName']]),
      hisArmies: seren['armies'],
    }).toEqual({
      owner: 0,
      provinces: [...held, sea.id],
      garrison: ['the Red Lances'],
      line: [["a fallen hero's armies hold the open sea and claim it for his realm", realm0?.name]],
      hisArmies: [],
    });
  });

  test('a fallen hero with no list of units disperses none; a spared coward with none leaves none behind', () => {
    const S = aStagedWorld();
    const fallen: Record<string, unknown> = { name: 'Wend the Stranger', player: 0, location: 21 };
    disperseDeadCharArmies(S.tc as never, fallen as never);
    const coward = { ...aStandIn(), location: 21 };
    expect([fallen['armies'], abandonHostOnFlight(S.tc as never, coward as never), S.told()]).toEqual([[], 0, []]);
  });
});

/** The world's Seren (hero 1, realm 0's), staged as given. */
function serenOf(S: ReturnType<typeof aStagedWorld>, staged: Record<string, unknown> = {}) {
  const seren = S.G.characters.find((c) => c.id === 1);
  if (!seren) throw new Error('the world has no Seren');
  return Object.assign(seren, staged);
}
/** The line told first: its fact's kind, its actor, the realms told, its province, its hero and its phase. */
const theFirstLine = (S: ReturnType<typeof aStagedWorld>) => {
  const l = S.tc.turnLog[0];
  return (
    l && [(l['fact'] as { kind: string }).kind, l['actor'], l['targets'], l['provinceId'], l['charId'], l['phase']]
  );
};

describe("a hero's death: a battle's copy, a stand-in with no id, a vanished hero, the wanderer, no options", () => {
  test("a battle's copy handed in: the real hero dies, with the copy's hit points, and the copy mirrors him", () => {
    const S = aStagedWorld();
    const seren = serenOf(S, { hp: 6 });
    const copy: AStagedHero = { ...seren, hp: 0 };
    const died = handleHeroDeath(S.tc as never, copy as never, null, {});
    expect([died, seren['alive'], seren['hp'], copy['alive'], copy['killedThisTurn']]).toEqual([
      true,
      false,
      0,
      false,
      true,
    ]);
  });

  test("a stand-in with no id dies himself; the world's first hero lives", () => {
    const S = aStagedWorld();
    const standIn: Record<string, unknown> = { ...aStandIn(), id: undefined, location: 21, armies: [], items: [] };
    const died = handleHeroDeath(S.tc as never, standIn as never, null, {});
    expect([died, standIn['alive'], S.G.characters[0]?.['alive']]).toEqual([true, false, true]);
  });

  // The killer is of the fallen hero's realm, and the hero whose order resolves of the other: the line, seen by those
  // in the battle (not the world), is filed under no hero.
  test.each([
    [
      'a vanished hero: the blow passes through shadow',
      '_vanishTurn',
      'vanished',
      'the blow meant for a vanished hero passes through shadow',
      [0],
    ],
    ['the wanderer slips the blow', '_unkillable', 'escaped', 'the wanderer slips a killing blow', []],
  ])(
    "%s: he lives at half his most hit points, the line his slayer's realm's, seen in the battle",
    (_, mark, outcome, kind, realms) => {
      const S = aStagedWorld();
      const seren = serenOf(S, { [mark]: mark === '_vanishTurn' ? S.G.turn : true, hp: 0, maxHp: 15 });
      const killer = S.G.characters.find((c) => c.id === 0);
      S.tc._logCtx = { charId: 4, phase: 2 };
      const opts: Record<string, unknown> = {};
      const died = handleHeroDeath(S.tc as never, seren as never, killer as never, opts);
      expect([died, opts['outcome'], seren['hp'], seren['alive'], seren['killedThisTurn'], theFirstLine(S)]).toEqual([
        false,
        outcome,
        8,
        true,
        false,
        [kind, 0, realms, 21, null, 2],
      ]);
    },
  );

  test('handed no options, he dies as with none asked', () => {
    const S = aStagedWorld();
    const seren = serenOf(S);
    expect([handleHeroDeath(S.tc as never, seren as never, null), seren['alive']]).toEqual([true, false]);
  });
});

describe("a hero's death: Battlefield Surgery's lines, who slew him, and who takes his possessions", () => {
  /** Seren of a realm holding Battlefield Surgery falls between orders in the phase resolving (2), the dice at the
   *  draw given: what she is told, handed back for her caller to tell. */
  const theSurgeonsLine = (draw: number) => {
    const S = aStagedWorld();
    const realm0 = S.G.players[0];
    if (realm0) realm0.discoveries = [{ id: 'sd36' }];
    const seren = serenOf(S);
    Object.assign(S.tc, { _logCtx: { charId: null, phase: null }, _currentPhase: 2 });
    const opts: { lines: { fact: { kind: string }; place: { phase: unknown } }[]; outcome?: string } = { lines: [] };
    const was = kcRng.use(() => draw);
    try {
      handleHeroDeath(S.tc as never, seren as never, null, opts as never);
    } finally {
      kcRng.use(was);
    }
    return [opts.outcome, opts.lines.map((l) => [l.fact.kind, l.place.phase])];
  };

  test("the surgeons' line, saved or too late, is of the phase resolving", () => {
    expect([theSurgeonsLine(0), theSurgeonsLine(0.999)]).toEqual([
      ['surgery', [['Battlefield Surgery saves a fallen hero', 2]]],
      ['died', [['the surgeons reach a fallen hero too late', 2]]],
    ]);
  });

  test('slain by no one named: his host, garrisoning his realm, is told of no slayer', () => {
    const S = aStagedWorld();
    const seren = serenOf(S, { armies: [aUnit('Free Lances', 'the Red Lances')] });
    handleHeroDeath(S.tc as never, seren as never, null, {});
    const line = S.told().find((f) => f['kind'] === "a fallen hero's armies garrison his realm's province");
    expect(line?.['slainBy']).toBeNull();
  });

  /** Seren, carrying a blade, slain by the killer given: whether he carries the blade after, and which of the world's
   *  heroes do; and the lines' kinds and phases
   *  (between orders, in the phase resolving, 3). */
  const theBladeAfter = (S: ReturnType<typeof aStagedWorld>, killer: Record<string, unknown>) => {
    const blade = { id: 77, name: 'the Wolf-Tooth Blade', desc: '', lore: '', effect: { stat: 'melee', bonus: 1 } };
    const seren = serenOf(S, { items: [blade] });
    Object.assign(S.tc, { _logCtx: { charId: null, phase: null }, _currentPhase: 3 });
    handleHeroDeath(S.tc as never, seren as never, killer as never, {});
    const carries = (c: Record<string, unknown>) => ((c['items'] as unknown[] | undefined) ?? []).includes(blade);
    return [
      [carries(killer), S.G.characters.filter(carries).map((c) => c.name)],
      S.tc.turnLog
        .filter((l) => (l['fact'] as { kind: string }).kind.includes('possessions'))
        .map((l) => [(l['fact'] as { kind: string }).kind, l['phase']]),
    ];
  };

  test("a slayer the world doesn't hold takes the blade himself, no hero of the world; one with no id too", () => {
    const S = aStagedWorld();
    const stranger = { ...aStandIn(), player: null, items: [] };
    const nameless = { ...aStandIn(), id: undefined, player: null, name: 'the Nameless', items: [] };
    expect([theBladeAfter(S, stranger)[0], theBladeAfter(aStagedWorld(), nameless)[0]]).toEqual([
      [true, []],
      [true, []],
    ]);
  });

  test('a slayer of another realm takes it, told of it in the phase resolving', () => {
    const S = aStagedWorld();
    const wodan = S.G.characters.find((c) => c.id === 4);
    if (!wodan) throw new Error('the world has no Wodan');
    expect(theBladeAfter(S, wodan)).toEqual([
      [true, [wodan.name]],
      [
        ["a fallen hero's possessions pass on", 3],
        ["a hero takes a fallen foe's possessions", 3],
        ["a hero notes how he carries a fallen foe's possessions", 3],
      ],
    ]);
  });
});

describe('a retreat by sea: the water a landing came from, a fleet that leaves units ashore, and lists missing', () => {
  /** A beaten landing: Seren in a land province of the enemy's, leading a galleon and the units given, the water she
   *  came from beside it (unowned, and defended or not), every other province beside it the enemy's dry land. */
  function aBeatenLanding(defended: boolean, theWatersOwner: number | null, units: unknown[]) {
    const S = aStagedWorld();
    const landing = S.G.world.provinces.find((p) => S.neighbours(p).length >= 4);
    if (!landing) throw new Error('could not stage: no province with four beside it');
    Object.assign(landing, { terrain: 'plain', owner: 1 });
    const [water, ...rest] = S.neighbours(landing);
    if (!water) throw new Error('could not stage: no water beside the landing');
    for (const q of rest) Object.assign(q, { terrain: 'plain', owner: 1 });
    Object.assign(water, {
      terrain: 'sea',
      owner: theWatersOwner,
      neutralDefenders: defended ? [aUnit('Galleon Fleet', 'the Sea Wolves')] : [],
    });
    const seren = serenOf(S, {
      location: landing.id,
      _attackedFrom: water.id,
      armies: [aUnit('Galleon Fleet', 'the Swan'), ...units],
    });
    landing.characters.push(seren.id);
    return { S, landing, water, rest, seren };
  }

  test('it may fall back to the water it came from only when that is unowned and undefended', () => {
    const to = (defended: boolean, owner: number | null) => {
      const { S, landing, seren, water } = aBeatenLanding(defended, owner, []);
      return retreatOptions(S.tc as never, seren as never, landing as never, seren['armies'] as never).map(
        (p) => p.id === water.id,
      );
    };
    expect([to(false, null), to(true, null), to(false, 1)]).toEqual([[true], [], []]);
  });

  test("its fleet puts to sea on that water, the beaten side's line naming it; defended, the fleet holds the province", () => {
    const split = (defended: boolean) => {
      const { S, landing, seren, water } = aBeatenLanding(defended, null, []);
      const narrative: { kind: string; destinationName?: string }[] = [];
      const side = { label: 'Seren' };
      const r = navalSplitRetreat(
        S.tc as never,
        seren as never,
        landing as never,
        seren['armies'] as never,
        narrative as never,
        side as never,
      );
      return [r, seren.location === water.id, narrative.map((l) => [l.kind, l.destinationName === water.name])];
    };
    expect([split(false), split(true)]).toEqual([
      ['left', true, [['a beaten fleet puts to sea with what its hulls can carry', true]]],
      ['stay', false, [['a beaten fleet with no friendly water holds the province', false]]],
    ]);
  });

  test("the units its hulls can't carry fall back overland to the realm's own ground beside it, and join its garrison", () => {
    const { S, landing, seren, rest } = aBeatenLanding(false, null, [
      aUnit('Free Lances', 'the Red Lances'),
      aUnit('Free Lances', 'the Grey Lances'),
    ]);
    const home = rest[0];
    if (!home) throw new Error('could not stage: no ground beside the landing');
    Object.assign(home, { owner: 0, garrisonArmies: [] });
    const narrative: { kind: string }[] = [];
    navalSplitRetreat(
      S.tc as never,
      seren as never,
      landing as never,
      seren['armies'] as never,
      narrative as never,
      { label: 'Seren' } as never,
    );
    expect([
      home.garrisonArmies.map((a) => (a as { unitName: string }).unitName),
      narrative.map((l) => l.kind),
    ]).toEqual([
      ['the Red Lances'],
      [
        'a beaten fleet puts to sea with what its hulls can carry',
        'units the fleet cannot carry fall back overland and join a garrison',
      ],
    ]);
  });

  test('hulls left ashore with no units: the line names no holder; a list missing reads as none', () => {
    const { S, landing, seren, water } = aBeatenLanding(false, null, []);
    const side = { label: 'Seren' };
    clearNavalHold(undefined); // (no province: nothing to clear, and no throw)
    expect({
      noHolder: navalHoldLine(S.tc as never, landing as never, [], null).holdersRealmName,
      holder: navalHoldLine(
        S.tc as never,
        landing as never,
        [{ ...aUnit('Galleon Fleet', 'the Swan'), _navalHold: 1 }],
        null,
      ).holdersRealmName,
      shortfall: seaLiftShortfall(undefined, null),
      stranded: pickStrandedUnits(undefined, null),
      best: bestRetreat(S.tc as never, seren as never, undefined),
      options: retreatOptions(S.tc as never, seren as never, landing as never, undefined).length >= 0,
      dry: preferDryGround(undefined),
      leftBehind: _navalLeaveBehind(
        S.tc as never,
        seren as never,
        landing as never,
        undefined,
        'no friendly water lies alongside for the ships to sail to',
        [],
        side as never,
      ),
      held: navalHeldIn(undefined),
      split: navalSplitRetreat(S.tc as never, seren as never, landing as never, undefined, [], side as never),
      trapped: seaTrapLine(side as never, seren as never, water as never, undefined),
    }).toEqual({
      noHolder: null,
      holder: S.G.players[1]?.name,
      shortfall: 0,
      stranded: [],
      best: null,
      options: true,
      dry: [],
      leftBehind: false,
      held: [],
      split: '',
      trapped: null,
    });
  });
});
