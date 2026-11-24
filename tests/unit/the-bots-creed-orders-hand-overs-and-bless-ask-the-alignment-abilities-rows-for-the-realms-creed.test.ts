// The bots' creed orders, their hand-overs and their Bless ask the alignment abilities' rows for the realm's creed
// (plan P1-19bb7), each with the bot's own conditions and numbers as they were: the signature order a king gives by his
// realm's creed (botSignaturePre: Consecrate, Call to Arms, Harvest the Field, Broker, each by its order's row; none for
// a Druidic, a Pagan or an Evil realm), Consecrate's own check (botConsecrateOK) and Perform Rite's (botRitePre), each
// by its row's creed; the order hygiene's hand-over (runBotOrderHygiene), which keeps the risen dead only with a comrade
// who is Undead himself or serves an Undead realm (the-risen-dead-follow-only-the-undead); and the cast plan's Bless
// (botCastPlan), which a hero leaves to his king where the realm's creed raises the king's Bless (the Divine blessing).
// No matrix game shows which creed reads which row: the balance games hold the bots' plans only as a whole.
//
// Level 1 (unit): the bots' functions called directly with small synthetic states. Not lower: a static test can't run
// them, and which creed each answers for is what they hand on.
import { describe, expect, test, vi } from 'vitest';
import { botConsecrateOK, botRitePre, botSignaturePre } from '../../src/engine/bots/missions.ts';
import { runBotOrderHygiene } from '../../src/engine/bots/economy.ts';
import { botCastPlan } from '../../src/engine/bots/spellcraft.ts';
import type { GameState } from '../../src/schemas/saved-game-state.ts';

/** The seven creeds, in the ladder's order. */
const CREEDS = ['Divine', 'Good', 'Druidic', 'Neutral', 'Pagan', 'Evil', 'Undead'] as const;

/** A row of four plains provinces of realm 0, east to west (the map wraps): its king stands in Ashford (0), with
 *  graves, a ritual site and a wild kind; its home is Brindle (2), two steps away, where a Neutral wanderer stands. */
const aKingdom = (alignment: string) => {
  const aProvince = (id: number, name: string, more: Record<string, unknown> = {}) => ({
    id,
    row: 0,
    col: id,
    owner: 0,
    terrain: 'plains',
    name,
    race: 'Human',
    tax: 5,
    ...more,
  });
  const ashford = aProvince(0, 'Ashford', {
    battleGraves: [{ turn: 2, count: 3 }],
    features: [{ name: 'The Stones', ritualSite: true, discovered: true }],
    armyTypes: ['Shieldwall Levies', 'Great Bears'],
  });
  const king = {
    id: 1,
    name: 'Aldric',
    player: 0,
    alive: true,
    isKing: true,
    location: 0,
    skills: { white: 1, necromancy: 1 },
    armies: [
      { type: 'Shieldwall Levies', quality: 'Average', race: 'Human' },
      { type: 'Shieldwall Levies', quality: 'Average', race: 'Human' },
    ],
  };
  const wanderer = { id: 2, name: 'Mara', player: null, alive: true, location: 2, alignment: 'Neutral', skills: {} };
  const G = {
    turn: 3,
    relations: {},
    world: {
      cols: 4,
      rows: 1,
      provinces: [ashford, aProvince(1, 'Barrow'), aProvince(2, 'Brindle'), aProvince(3, 'Coldwater')],
    },
    players: [{ alignment, homeProvinceId: 2, gold: 50 }],
    characters: [king, wanderer],
  };
  return { G: G as unknown as GameState, king: king as unknown as GameState['characters'][number], ashford };
};
/** A bot realm's ledger with gold to spend. */
const aLedger = () => ({ budget: 50, upkeep: 0, upkeepCap: 40, income: 0, warFooting: false, recruitedByProv: {} });

describe("botSignaturePre: a king gives his creed's order, by its row", () => {
  test('a Divine king consecrates, a Good one calls to arms, a Neutral one brokers, an Undead one harvests the field; the others give none', () => {
    const theOrders = CREEDS.map((creed) => {
      const { G, king, ashford } = aKingdom(creed);
      const order = botSignaturePre(G, 0, king, G.world.provinces[ashford.id], aLedger());
      return `${creed} ${order?.action ?? 'none'}`;
    });
    expect(theOrders.join(', ')).toBe(
      'Divine consecrate, Good call_to_arms, Druidic none, Neutral broker, Pagan none, Evil none, Undead harvest_field',
    );
  });
});

describe("botConsecrateOK: only a realm of Consecrate's creed", () => {
  test('a Divine king may consecrate Ashford; a king of any other creed may not', () => {
    const theAnswers = CREEDS.map((creed) => {
      const { G, king, ashford } = aKingdom(creed);
      return `${creed} ${String(botConsecrateOK(G, 0, king, G.world.provinces[ashford.id]))}`;
    });
    expect(theAnswers.join(', ')).toBe(
      'Divine true, Good false, Druidic false, Neutral false, Pagan false, Evil false, Undead false',
    );
  });
});

describe("botRitePre: only a realm of Perform Rite's creed", () => {
  test("a Pagan host at a ritual site with a fight ahead binds the wild kind; a host of any other creed doesn't", () => {
    const theRites = CREEDS.map((creed) => {
      const { G, king, ashford } = aKingdom(creed);
      const rite = botRitePre(G, 0, king, G.world.provinces[ashford.id], aLedger(), true);
      return `${creed} ${rite ? `${rite.action} ${rite.target}` : 'none'}`;
    });
    expect(theRites.join(', ')).toBe(
      'Divine none, Good none, Druidic none, Neutral none, Pagan rite wild hunt, Evil none, Undead none',
    );
  });
});

describe('runBotOrderHygiene: the risen dead follow a hand-over only to an Undead comrade or one of an Undead realm', () => {
  /** A Good realm's hero hands his host (a skeletal company and a living one) to the comrade given; what the hygiene
   *  leaves of the order, and its tally of trimmed hand-overs. */
  const theHandOver = (comrade: { readonly alignment: string; readonly realm: string | null }) => {
    const realms = [{ alignment: 'Good', gold: 0 }, ...(comrade.realm === null ? [] : [{ alignment: comrade.realm }])];
    const G = {
      turn: 3,
      world: { cols: 2, rows: 1, provinces: [{ id: 0, row: 0, col: 0, owner: 0, terrain: 'plains', name: 'Ashford' }] },
      players: realms,
      characters: [
        {
          id: 1,
          name: 'Wren',
          player: 0,
          alive: true,
          location: 0,
          maxHp: 20,
          hp: 20,
          skills: {},
          armies: [
            { type: 'Skeleton Warriors', _isSkeletal: true },
            { type: 'Shieldwall Levies', unitName: 'Ashford Levy' },
          ],
        },
        { id: 5, name: 'Mara', player: comrade.realm === null ? null : 1, alive: true, location: 0, ...comrade },
      ],
      turnOrders: {
        1: [{ action: 'leave_army', target: 'all', extra: '5', desc: 'Hand column' }, null, null, null, null],
      },
    };
    const thePagesTally: Partial<Record<string, number>> = {};
    vi.stubGlobal('window', { __botHyg: thePagesTally });
    try {
      runBotOrderHygiene(G as unknown as GameState, new Set([0]));
    } finally {
      vi.unstubAllGlobals();
    }
    const x = G.turnOrders[1][0];
    return `${x?.target ?? 'none'} (${x?.desc ?? ''}), ${String(thePagesTally['handoverTrimmed'] ?? 0)} trimmed`;
  };
  test('an Undead comrade, or a Good one of an Undead realm, takes the whole host; a Good one of a Good realm or of none, the living only', () => {
    const theHandOvers = [
      theHandOver({ alignment: 'Undead', realm: null }),
      theHandOver({ alignment: 'Good', realm: 'Undead' }),
      theHandOver({ alignment: 'Good', realm: 'Good' }),
      theHandOver({ alignment: 'Good', realm: null }),
    ];
    expect(theHandOvers.join('; '), 'an Undead comrade; of an Undead realm; of a Good realm; of none').toBe(
      'all (Hand column), 0 trimmed; all (Hand column), 0 trimmed; Ashford Levy (Hand column (the living only)), 1 trimmed; Ashford Levy (Hand column (the living only)), 1 trimmed',
    );
  });
});

describe("botCastPlan: a hero leaves the Bless to his king where the realm's creed raises the king's", () => {
  test('a hero of White 1 beside his king of White 1 blesses Ashford unless his realm is Divine', () => {
    const theBlesses = CREEDS.map((creed) => {
      const { G, ashford } = aKingdom(creed);
      const hero = { id: 3, name: 'Wren', player: 0, alive: true, location: 0, skills: { white: 1 } };
      const theHero = hero as unknown as GameState['characters'][number];
      G.characters.push(theHero);
      const plan = botCastPlan(G, 0, theHero, G.world.provinces[ashford.id], null);
      return `${creed} ${plan.some((x) => x.target === 'Bless Province') ? 'blesses' : 'leaves it'}`;
    });
    expect(theBlesses.join(', ')).toBe(
      'Divine leaves it, Good blesses, Druidic blesses, Neutral blesses, Pagan blesses, Evil blesses, Undead blesses',
    );
  });
});
