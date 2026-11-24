// The bots' races ask the race constants, the gifts' rows and the kin rule, and weigh them as race gifts (B-06ah, T7,
// the rules pulled out: the races' family), each with the bot's own figures as they were: botTuning's race overlay
// (the Bulwark's: both attack margins +0.1; the War-spoils': both −0.05 and the wage cap +0.05, never above the whole),
// by the gift the realm's race holds, from the first version's raceGift weights; botRaceTerrainMult's kin (the kin
// rule's factors, content's) and its gifts (Woodland Mastery's and the Bulwark's rows), multiplied unrounded, against
// the test it wrote inline over every race, ground and side; a recruit's province of no race read as content's race
// (botRecruitableTypes: the Druid's check of its own race, the old grudge's); no Call to Arms in a province of the
// wild's race (botSignaturePre); a sea's kind by the poor seas' race tags and the wild's sub-races (botSeaStrike); a
// scout's wild province (botScoutTarget). No matrix game shows which race reads which: the balance games hold the
// bots' plans only as a whole, and no seeded game holds a province of no race.
//
// Level 1 (unit): the bots' functions called directly with small synthetic states. Not lower: a static test can't run
// them, and the weights, the figures and the targets are what they hand on.
import { describe, expect, test } from 'vitest';
import { botRaceTerrainMult, botTuning } from '../../src/engine/bots/intel.ts';
import { botSeaStrike, botSignaturePre } from '../../src/engine/bots/missions.ts';
import { botScoutTarget } from '../../src/engine/bots/specialists.ts';
import { botRecruitableTypes } from '../../src/engine/bots/strategy.ts';
import type { GameState } from '../../src/schemas/saved-game-state.ts';

/** The races a realm, a unit or a commander may hold: the four peoples', none, the wild's, a beast's class and a word
 *  of no race. */
const RACES = ['Human', 'Elven', 'Dwarven', 'Orcish', '', undefined, 'Primal', 'Primal:Wolf', 'Monster', 'human'];

/** A number to four places, as the weights are compared. */
const four = (n: number) => String(Math.round(n * 10000) / 10000);

describe("botTuning: a race's overlay, by the gift its row gives", () => {
  test("a Dwarven realm's margins rise by 0.1, an Orcish realm's fall by 0.05 and its wages may take the whole income; no other race's move", () => {
    const theWeights = RACES.map((race) => {
      // `as`: a realm made of the few fields botTuning reads, as it reads them (a Neutral realm: no creed's overlay)
      const G = { botDifficulty: 'hard', players: [{ alignment: 'Neutral', race }] } as unknown as GameState;
      const T = botTuning(G, 0);
      return `${race ?? 'none'}: ${[T.kingAttackMargin, T.heroAttackMargin, T.upkeepCapFrac].map(four).join(' ')}`;
    });
    expect(theWeights.join('; ')).toBe(
      'Human: 1.242 1.104 0.97; Elven: 1.242 1.104 0.97; Dwarven: 1.342 1.204 0.97; Orcish: 1.192 1.054 1; : 1.242 1.104 0.97; ' +
        'none: 1.242 1.104 0.97; Primal: 1.242 1.104 0.97; Primal:Wolf: 1.242 1.104 0.97; Monster: 1.242 1.104 0.97; ' +
        'human: 1.242 1.104 0.97',
    );
  });
});

describe("botRaceTerrainMult: the kin rule's factors and the gifts' rows, unrounded (KD-466)", () => {
  /** The figure as the bot wrote it before B-06ah, its numbers and its races written in. */
  const asTheBotWroteIt = (
    uRace: string | null,
    oRace: string | null,
    lRace: string | null,
    terrain: string | null,
    defending: boolean | null,
  ) => {
    let m = 1;
    const RIV: Partial<Record<string, string>> = {
      Elven: 'Dwarven',
      Dwarven: 'Elven',
      Human: 'Orcish',
      Orcish: 'Human',
    };
    if (uRace) {
      if (oRace && uRace === oRace) m *= 1.2;
      if (lRace && uRace === lRace) m *= 1.2;
      if (lRace && RIV[uRace] === lRace) m *= 0.8;
    }
    if (uRace === 'Elven' && oRace === 'Elven' && (terrain === 'forest' || terrain === 'jungle')) m *= 1.5;
    if (uRace === 'Dwarven' && oRace === 'Dwarven' && defending) m *= 1.5;
    return m;
  };
  /** A race given as the bot read it: an empty one as none. */
  const aRaceOrNone = (race: string | undefined) => (race === undefined || race === '' ? null : race);
  const TERRAINS = [null, 'forest', 'jungle', 'plains', 'mountain'];
  const SIDES = [true, false, null];
  test('over every race of the unit, its realm and its leader, every ground and side, the figure is the one the bot wrote', () => {
    const differ: string[] = [];
    let compared = 0;
    for (const u of RACES)
      for (const o of RACES)
        for (const l of RACES)
          for (const terrain of TERRAINS)
            for (const defending of SIDES) {
              // `as`: a world of one realm and the turn, with no terrain figure handed in
              const G = { turn: 1, players: [{ race: o }] } as unknown as GameState;
              const figure = botRaceTerrainMult(
                G,
                { player: 0, race: l },
                { type: 'Free Lances', race: u },
                terrain,
                defending,
                0,
              );
              const expected = asTheBotWroteIt(aRaceOrNone(u), aRaceOrNone(o), aRaceOrNone(l), terrain, defending);
              compared++;
              if (figure !== expected) differ.push([u, o, l, terrain, defending, figure].map(String).join(' '));
            }
    expect(differ, `the figures that differ of ${String(compared)}`).toEqual([]);
  });
  test('an Elven company of an Elven realm led by an elf in the forest: ×1.2 ×1.2 ×1.5; a Dwarven one defending under an elf: ×1.2 ×0.8 ×1.5', () => {
    // `as`: worlds of one realm and the turn
    const elves = { turn: 1, players: [{ race: 'Elven' }] } as unknown as GameState;
    const dwarves = { turn: 1, players: [{ race: 'Dwarven' }] } as unknown as GameState;
    expect([
      botRaceTerrainMult(
        elves,
        { player: 0, race: 'Elven' },
        { type: 'Elven Bowmen', race: 'Elven' },
        'forest',
        false,
        0,
      ),
      botRaceTerrainMult(
        dwarves,
        { player: 0, race: 'Elven' },
        { type: 'Dwarven Guard', race: 'Dwarven' },
        'plains',
        true,
        0,
      ),
      botRaceTerrainMult(
        dwarves,
        { player: 0, race: 'Elven' },
        { type: 'Dwarven Guard', race: 'Dwarven' },
        'plains',
        false,
        0,
      ),
    ]).toEqual([1.2 * 1.2 * 1.5, 1.2 * 0.8 * 1.5, 1.2 * 0.8]);
  });
});

describe("botRecruitableTypes: a recruit's province of no race reads as content's race (Human)", () => {
  /** A row of three plains provinces of realm 0 (the map wraps): the recruit's (1), its neighbours 0 and 2; a commander
   *  of the race given in the recruit's province, his Druid 0. */
  const aMuster = (theRecruitsRace: string | undefined, theNeighboursRace: string | undefined, hisRace: string) => {
    const aProvince = (id: number, race: string | undefined, armyTypes: string[]) => ({
      id,
      row: 0,
      col: id,
      owner: 0,
      terrain: 'plains',
      race,
      armyTypes,
      tax: 5,
    });
    const recruits = aProvince(1, theRecruitsRace, ['Gnomish Gyrocopters', 'Free Lances']);
    const commander = { id: 1, player: 0, alive: true, race: hisRace, location: 1, skills: { druid: 0 }, armies: [] };
    const G = {
      turn: 4,
      world: {
        cols: 3,
        rows: 1,
        provinces: [aProvince(0, theNeighboursRace, ['Shieldwall Levies']), recruits, aProvince(2, 'Elven', [])],
      },
      players: [{ alignment: 'Neutral', race: hisRace, discoveries: [] }],
      characters: [commander],
    };
    // `as`: a world made of the few fields the muster reads, as it reads them
    return botRecruitableTypes(
      recruits as unknown as GameState['world']['provinces'][number],
      G as unknown as GameState,
      commander as unknown as GameState['characters'][number],
    );
  };
  test('a Human commander leads its Free Lances as his own (no Druid needed), so they rank above the Gyrocopters', () => {
    expect([aMuster(undefined, 'Human', 'Human'), aMuster('', 'Human', 'Human')]).toEqual([
      ['Free Lances', 'Gnomish Gyrocopters'],
      ['Free Lances', 'Gnomish Gyrocopters'],
    ]);
  });
  test("an Orcish commander raises nothing there (the old grudge) while his own kin's province is near; a near province of no race is no kin of his (his Human recruits need his Druid)", () => {
    expect([
      aMuster(undefined, 'Orcish', 'Orcish'),
      aMuster(undefined, undefined, 'Orcish'),
      aMuster('Human', undefined, 'Orcish'),
    ]).toEqual([[], ['Gnomish Gyrocopters', 'Free Lances'], ['Gnomish Gyrocopters', 'Free Lances']]);
  });
});

describe("botSignaturePre: no Call to Arms in a province of the wild's race", () => {
  test("a Good king calls to arms in a Human province, never in one of the wild's race or sub-race", () => {
    const theOrders = ['Human', 'Primal', 'Primal:Wolf'].map((race) => {
      const aProvince = (id: number) => ({
        id,
        row: 0,
        col: id,
        owner: 0,
        terrain: 'plains',
        name: `P${String(id)}`,
        race,
        tax: 5,
      });
      const king = { id: 1, player: 0, alive: true, isKing: true, location: 0, skills: {}, armies: [] };
      const G = {
        turn: 3,
        relations: {},
        world: { cols: 2, rows: 1, provinces: [aProvince(0), aProvince(1)] },
        players: [{ alignment: 'Good', race: 'Human', homeProvinceId: 0, gold: 50 }],
        characters: [king],
      };
      // `as`: a world made of the few fields the signature order reads, as it reads them
      const order = botSignaturePre(
        G as unknown as GameState,
        0,
        king as unknown as GameState['characters'][number],
        G.world.provinces[0] as unknown as GameState['world']['provinces'][number],
        { budget: 50, upkeep: 0, upkeepCap: 40, income: 0, warFooting: false, recruitedByProv: {} },
      );
      return `${race} ${order?.action ?? 'none'}`;
    });
    expect(theOrders.join(', ')).toBe('Human call_to_arms, Primal none, Primal:Wolf none');
  });
});

describe("botSeaStrike: a sea's kind, by the poor seas' race tags and the wild's sub-races", () => {
  test('an admiral of bare hulls takes the whale waters before a primal sea beside them, open water before both, and the first of two poor seas', () => {
    /** A row of four provinces (the map wraps): the admiral's coast (0), the whale waters east of it (1), unowned
     *  land (2), which bare hulls can't take, and a sea of the race given west of it (3), which he weighs first. */
    const theSeaClaimed = (theNearSeasRace: string | undefined) => {
      const aProvince = (id: number, terrain: string, owner: number | null, race: string | undefined) => ({
        id,
        row: 0,
        col: id,
        owner,
        terrain,
        name: `P${String(id)}`,
        race,
        tax: 1,
        neutralDefenders: [],
      });
      const admiral = {
        id: 1,
        player: 0,
        alive: true,
        location: 0,
        _botRole: 'admiral',
        skills: {},
        armies: [{ type: 'Elven Galleys', quality: 'Average', race: 'Elven' }],
      };
      const G = {
        turn: 3,
        relations: {},
        world: {
          cols: 4,
          rows: 1,
          provinces: [
            aProvince(0, 'plains', 0, 'Elven'),
            aProvince(1, 'sea', null, 'Primal:Whale'),
            aProvince(2, 'plains', null, 'Human'),
            aProvince(3, 'sea', null, theNearSeasRace),
          ],
        },
        players: [{ alignment: 'Neutral', race: 'Elven' }],
        characters: [admiral],
      };
      // `as`: a world made of the few fields the strike reads, as it reads them
      const T = botTuning(G as unknown as GameState, 0);
      const strike = botSeaStrike(
        G as unknown as GameState,
        0,
        admiral as unknown as GameState['characters'][number],
        G.world.provinces[0] as unknown as GameState['world']['provinces'][number],
        100,
        T,
        3,
      );
      return `${theNearSeasRace ?? 'none'}: ${String(strike?.N.id ?? 'none')}`;
    };
    expect(['Primal:Kraken', 'Primal:Shark', undefined].map(theSeaClaimed).join(', ')).toBe(
      'Primal:Kraken: 1, Primal:Shark: 3, none: 3',
    );
  });
});

describe("botScoutTarget: a province of the wild's sub-race is worth 15 more to scout", () => {
  test('of two unmapped provinces a step away, the scout takes the wild one, wherever it lies', () => {
    const theTarget = (races: readonly [string, string]) => {
      const aProvince = (id: number, race: string, mapped: number) => ({
        id,
        row: 0,
        col: id,
        owner: 0,
        terrain: 'plains',
        name: `P${String(id)}`,
        race,
        exploredBy: { 0: mapped },
      });
      const scout = { id: 1, player: 0, alive: true, location: 0, skills: {}, armies: [] };
      const G = {
        turn: 3,
        relations: {},
        world: {
          cols: 3,
          rows: 1,
          provinces: [aProvince(0, 'Human', 100), aProvince(1, races[0], 0), aProvince(2, races[1], 0)],
        },
        players: [{ alignment: 'Neutral', race: 'Human' }],
        characters: [scout],
      };
      // `as`: a world made of the few fields the scout's choice reads, as it reads them
      return botScoutTarget(G as unknown as GameState, 0, scout as unknown as GameState['characters'][number], 4)?.X.id;
    };
    expect([
      theTarget(['Human', 'Primal:Wolf']),
      theTarget(['Primal:Wolf', 'Human']),
      theTarget(['Human', 'Primal']),
    ]).toEqual([2, 1, 1]);
  });
});
