// The bots read a realm of none (an empty alignment, or a realm off the list) as the content says
// (THE_ALIGNMENT_A_REALM_OF_NONE_READS_AS, Neutral; plan P1-19bb6): botAlignOf; the strength estimates (botEffForce,
// botBattleForce, botDruidShortfall), whose Druid waivers a realm of none doesn't get, its fervour (botFervourMult) and
// the kinds it raises first (botRecruitableTypes' effOf); the Hire Hero order's wage (botHireOrder) and the order
// hygiene's check of it (runBotOrderHygiene); and the set-up's two picks of a bot's alignment, which take Neutral when
// no alignment is left, and its first skills, which are Neutral's for an alignment with no build. No matrix game holds
// a realm of none, and the ladder of the alignments always leaves a bot one to take, so the set-up's cases stand the
// ladder's list in (vi.mock on its module, which the set-up's file imports it from; the stand-in is asserted reached).
//
// Level 1 (unit): the bots' functions called directly with small synthetic states, the dice seeded (kcRng). Not lower:
// a static test can't run them, and what a realm of none reads as is what they hand on.
import { afterEach, describe, expect, test, vi } from 'vitest';
import type * as TheLadderAndTheHireWage from '../../src/engine/rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import { kcRng } from '../../src/engine/rng.ts';
import {
  botAlignOf,
  botBattleForce,
  botDruidShortfall,
  botEffForce,
  botFervourMult,
} from '../../src/engine/bots/intel.ts';
import { botHireOrder, botRecruitableTypes } from '../../src/engine/bots/strategy.ts';
import { runBotOrderHygiene } from '../../src/engine/bots/economy.ts';
import {
  BOT_SKILL_BUILD,
  generateBotSetups,
  pickBotAlignment,
  pickBotAlignmentBalanced,
} from '../../src/engine/bots/setup.ts';
import type { GameState } from '../../src/schemas/saved-game-state.ts';

/** The ladder's list of the alignments as the set-up reads it: the ladder's own, unless a case stands one in. */
const theStandIn = vi.hoisted(() => ({ list: null as string[] | null, reads: 0 }));
vi.mock(
  '../../src/engine/rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts',
  async (importOriginal) => {
    const theModule = await importOriginal<typeof TheLadderAndTheHireWage>();
    return {
      ...theModule,
      get ALIGNMENTS_P() {
        if (theStandIn.list === null) return theModule.ALIGNMENTS_P;
        theStandIn.reads++;
        return theStandIn.list;
      },
    };
  },
);
afterEach(() => {
  theStandIn.list = null;
  theStandIn.reads = 0;
});

/** The alignments a realm is given: none (an empty one, none at all), Neutral and the creeds whose waivers differ. */
const ALIGNMENTS = ['', undefined, 'Neutral', 'Druidic', 'Evil', 'Good'] as const;

describe("botAlignOf: a realm's alignment, or a realm of none's", () => {
  test('an empty alignment, none given and a realm off the list read as Neutral; a creed as it is', () => {
    const G = { players: [{ alignment: '' }, {}, { alignment: 'Pagan' }] };
    const read = (pi: number) => botAlignOf(G as unknown as Pick<GameState, 'players'>, pi);
    expect([read(0), read(1), read(2), read(3)]).toEqual(['Neutral', 'Neutral', 'Pagan', 'Neutral']);
  });
});

describe('the strength estimates: a realm of none gets no Druid waiver nor fervour, as a Neutral realm', () => {
  /** A Druid-0 Human commander of a realm of the alignment given: his strength, battle strength and Druid shortfall with
   *  an Elder Dragon (a Monster), and with a Great Bear (a Creature); his fervour defending; and the kinds he raises
   *  first in a Human province of levies and dragons. */
  const estimates = (alignment: (typeof ALIGNMENTS)[number]) => {
    const G = {
      players: [alignment === undefined ? { race: 'Human' } : { alignment, race: 'Human' }],
      turn: -2,
      world: { provinces: [] },
    };
    const c = { player: 0, race: 'Human', skills: {}, armies: [] };
    const each = (type: string) => {
      const beasts = [{ type, race: 'Primal', quality: 'Average' }];
      return [botEffForce(G, c, beasts), botBattleForce(G, c, beasts, 'plains', {}), botDruidShortfall(G, c, beasts)];
    };
    const aProvince = { id: 1, race: 'Human', armyTypes: ['Shieldwall Levies', 'Elder Dragons'] };
    return {
      dragon: each('Elder Dragons'),
      bear: each('Great Bears'),
      fervour: botFervourMult(G, c, [], true),
      raised: botRecruitableTypes(
        aProvince as Parameters<typeof botRecruitableTypes>[0],
        G as unknown as Parameters<typeof botRecruitableTypes>[1],
        c as unknown as Parameters<typeof botRecruitableTypes>[2],
      ),
    };
  };
  test("an empty alignment and none given estimate as a Neutral realm, unlike a Druidic, an Evil or a Good realm's", () => {
    const [none, nothing, neutral, druidic, evil, good] = ALIGNMENTS.map(estimates);
    expect(none, 'an empty alignment estimates as Neutral').toEqual(neutral);
    expect(nothing, 'no alignment given estimates as Neutral').toEqual(neutral);
    expect(neutral?.bear[2], "a Neutral realm's shortfall under a Great Bear").not.toEqual(druidic?.bear[2]);
    expect(neutral?.dragon, "a Neutral realm's estimates under an Elder Dragon").not.toEqual(evil?.dragon);
    expect(neutral?.raised, "a Neutral realm's first kinds raised").not.toEqual(evil?.raised);
    expect(neutral?.fervour, "a Neutral realm's fervour defending").not.toEqual(good?.fervour);
  });
});

describe("botHireOrder: a realm of none pays a wanderer's wage as a Neutral realm", () => {
  /** What a realm of the alignment given spends to hire an Undead wanderer of no skills beside its hero. */
  const theWageSpent = (alignment: (typeof ALIGNMENTS)[number]) => {
    const G = {
      turn: 3,
      world: { cols: 2, rows: 1, provinces: [{ id: 0, row: 0, col: 0, owner: 0, terrain: 'plains' }] },
      players: [alignment === undefined ? {} : { alignment }],
      characters: [{ id: 2, name: 'Mara', player: null, alive: true, location: 0, alignment: 'Undead', skills: {} }],
    };
    const L = { budget: 40, upkeep: 0, upkeepCap: 40, income: 0, warFooting: false, recruitedByProv: {} };
    const order = botHireOrder(
      G as unknown as GameState,
      0,
      { id: 1, location: 0 } as unknown as Parameters<typeof botHireOrder>[2],
      L,
    );
    return { order: order?.action ?? null, spent: 40 - L.budget };
  };
  test("an empty alignment and none given hire at 3g, a Neutral realm's wage (3 steps); a Druidic or Good realm pays 4g, an Evil one 2g", () => {
    const theWages = ALIGNMENTS.map(theWageSpent).map((x) => `${x.order ?? 'none'} ${String(x.spent)}g`);
    expect(theWages.join(', '), "'', none, Neutral, Druidic, Evil, Good").toBe(
      'hire 3g, hire 3g, hire 3g, hire 4g, hire 2g, hire 4g',
    );
  });
});

describe("runBotOrderHygiene: a realm of none's hire is met at a Neutral realm's wage", () => {
  /** Whether a realm of the alignment given, with 3g, keeps its hero's order to hire an Undead wanderer beside him. */
  const theHireKept = (alignment: (typeof ALIGNMENTS)[number]) => {
    const G = {
      turn: 3,
      world: { cols: 2, rows: 1, provinces: [{ id: 0, row: 0, col: 0, owner: 0, terrain: 'plains', name: 'Ashford' }] },
      players: [alignment === undefined ? { gold: 3 } : { alignment, gold: 3 }],
      characters: [
        { id: 1, name: 'Wren', player: 0, alive: true, location: 0, maxHp: 20, hp: 20, skills: {} },
        { id: 5, name: 'Mara', player: null, alive: true, location: 0, alignment: 'Undead', skills: {} },
      ],
      turnOrders: { 1: [{ action: 'hire', target: '5', extra: '', desc: 'Hire Mara' }, null, null, null, null] },
    };
    const thePagesTally: Partial<Record<string, number>> = {};
    vi.stubGlobal('window', { __botHyg: thePagesTally });
    try {
      runBotOrderHygiene(G as unknown as GameState, new Set([0]));
    } finally {
      vi.unstubAllGlobals();
    }
    return `${G.turnOrders[1][0]?.action ?? 'none'}, ${String(thePagesTally['hireUnaffordable'] ?? 0)} unaffordable`;
  };
  test('an empty alignment and none given keep the hire at 3g, as a Neutral realm; a Druidic or Good realm (4g) drops it for a practice', () => {
    expect(ALIGNMENTS.map(theHireKept).join('; '), "'', none, Neutral, Druidic, Evil, Good").toBe(
      'hire, 0 unaffordable; hire, 0 unaffordable; hire, 0 unaffordable; practice, 1 unaffordable; hire, 0 unaffordable; practice, 1 unaffordable',
    );
  });
});

describe("the set-up: a bot with no alignment left takes Neutral, and an alignment with no build Neutral's skills", () => {
  test('pickBotAlignment with the ladder emptied deals Neutral', () => {
    theStandIn.list = [];
    kcRng.seed(5);
    expect(pickBotAlignment({})).toBe('Neutral');
    expect(theStandIn.reads, 'the set-up reads the stand-in ladder').toBeGreaterThan(0);
  });
  test('pickBotAlignmentBalanced beside a Good human, with the ladder emptied, deals Neutral', () => {
    theStandIn.list = [];
    kcRng.seed(5);
    expect(pickBotAlignmentBalanced({}, ['Good'], [0], [0])).toBe('Neutral');
    expect(theStandIn.reads, 'the set-up reads the stand-in ladder').toBeGreaterThan(0);
  });
  test("a bot dealt an alignment with no build starts with Neutral's skills", () => {
    theStandIn.list = ['Nowhere'];
    kcRng.seed(5);
    const [bot] = generateBotSetups([], 1, 0);
    expect(theStandIn.reads, 'the set-up reads the stand-in ladder').toBeGreaterThan(0);
    expect(bot?.alignment).toBe('Nowhere');
    expect(bot?.skills).toEqual({ ...BOT_SKILL_BUILD.Neutral });
    expect(bot?.skills).not.toEqual({ ...BOT_SKILL_BUILD.Good });
  });
});
