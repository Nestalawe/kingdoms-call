// The bots' worth of the alignment abilities asks the rules' factors and the first version's weights (plan P1-19bb8,
// the bots' worth hook's third kind), each with the bot's own conditions and numbers as they were: a host's fervour in
// the bots' estimates (botFervourMult: savage fury's and skeletal fervour's factors, the strongest counting, and
// Righteous Defence's on any defence; none with no commander), a recruit's worth (botRecruitableTypes' effOf: savage
// fury's factor for each Monster unit of an Evil realm), the court's size (botHeroCap: one hero more for the realm whose
// dearest wanderer asks the least, a Neutral realm), the scholars wanted (botSpecialistRoles: one more for a realm whose
// alignment adds to research) and the Sage level a scholar researches from (botScholarOrders, botRoleWork and
// botRoleReady: 1 for that realm, 2 for any other). By creed, and for a realm of none (its alignment empty), which the
// court and the scholars read as it is, not as Neutral. No matrix game shows which creed reads which factor or weight:
// the balance games hold the bots' plans only as a whole.
//
// Level 1 (unit): the bots' functions called directly with small synthetic states. Not lower: a static test can't run
// them, and the factors and the levels are what they hand on.
import { describe, expect, test } from 'vitest';
import { botFervourMult } from '../../src/engine/bots/intel.ts';
import { botHeroCap, botRecruitableTypes } from '../../src/engine/bots/strategy.ts';
import { botRoleReady, botRoleWork, botScholarOrders, botSpecialistRoles } from '../../src/engine/bots/specialists.ts';
import type { Character, GameState } from '../../src/schemas/saved-game-state.ts';

/** The seven creeds, in the ladder's order, and a realm of none's empty alignment. */
const CREEDS = ['Divine', 'Good', 'Druidic', 'Neutral', 'Pagan', 'Evil', 'Undead', ''] as const;

/** A Human realm of the alignment given, with 10g, one plains province (Ashford) and one sea province, and its
 *  heroes. */
function aRealm(alignment: string, heroes: readonly object[] = []): GameState {
  // `as`: a world made of the few fields the bots' functions here read, as each reads them
  return {
    turn: 5,
    players: [{ alignment, race: 'Human', gold: 10 }],
    characters: heroes,
    world: {
      cols: 3,
      rows: 1,
      provinces: [
        { id: 0, row: 0, col: 0, owner: 0, terrain: 'plains', name: 'Ashford', race: 'Human', tax: 5 },
        { id: 1, row: 0, col: 1, owner: 0, terrain: 'sea', name: 'The Narrows' },
      ],
    },
  } as unknown as GameState;
}

/** What each creed answers, one line a creed (a realm of none's as "none"). */
const byCreed = (answer: (alignment: string) => string) =>
  CREEDS.map((creed) => `${creed || 'none'}: ${answer(creed)}`).join('; ');

describe("botFervourMult: the rules' factors, with the bot's own conditions", () => {
  /** A Monster (Cave Trolls) and a skeletal company. */
  const aMonsterAndTheDead = [{ type: 'Cave Trolls' }, { type: 'Shieldwall Levies', _isSkeletal: true }];
  /** A host's fervour under a commander of realm 0 (none: a commander of no realm), by the creed given. */
  const theFervour = (
    alignment: string,
    commander: { readonly player: number | null; readonly isKing: boolean },
    host: readonly (object | null)[],
    defending: boolean,
  ) => botFervourMult(aRealm(alignment), commander, host as Parameters<typeof botFervourMult>[2], defending);
  test('a king defending with a Monster and the dead; a hero attacking with them; a hero defending with levies; a host with a gap; a garrison of no commander', () => {
    const theFactors = byCreed((creed) =>
      [
        theFervour(creed, { player: 0, isKing: true }, aMonsterAndTheDead, true),
        theFervour(creed, { player: 0, isKing: false }, aMonsterAndTheDead, false),
        theFervour(creed, { player: 0, isKing: false }, [{ type: 'Shieldwall Levies' }], true),
        theFervour(creed, { player: 0, isKing: false }, [null, { type: 'Cave Trolls' }], false),
        theFervour(creed, { player: null, isKing: false }, aMonsterAndTheDead, true),
      ].join(' '),
    );
    expect(theFactors).toBe(
      'Divine: 1 1 1 1 1; Good: 1.1 1 1.1 1 1; Druidic: 1 1 1 1 1; Neutral: 1 1 1 1 1; Pagan: 1 1 1 1 1; ' +
        'Evil: 1.25 1.25 1 1.25 1; Undead: 1.5 1.3 1 1 1; none: 1 1 1 1 1',
    );
  });
});

describe("botRecruitableTypes' effOf: savage fury's factor for each Monster unit of an Evil realm", () => {
  test('a Druid-5 Human commander ranks Crimson Rocs (15), Stone Giants (13) and Cave Trolls (11, a Monster); an Evil one puts the Trolls (×1.25) above the Giants', () => {
    const theRanks = byCreed((creed) => {
      const aProvince = { id: 2, race: 'Human', armyTypes: ['Cave Trolls', 'Stone Giants', 'Crimson Rocs'] };
      const aCommander = { player: 0, race: 'Human', skills: { druid: 5 }, armies: [] };
      return botRecruitableTypes(
        aProvince as Parameters<typeof botRecruitableTypes>[0],
        aRealm(creed),
        aCommander as unknown as Character,
      ).join(', ');
    });
    const theOthers = 'Crimson Rocs, Stone Giants, Cave Trolls';
    expect(theRanks).toBe(
      `Divine: ${theOthers}; Good: ${theOthers}; Druidic: ${theOthers}; Neutral: ${theOthers}; Pagan: ${theOthers}; ` +
        `Evil: Crimson Rocs, Cave Trolls, Stone Giants; Undead: ${theOthers}; none: ${theOthers}`,
    );
  });
});

describe('botHeroCap: one hero more for the realm whose dearest wanderer asks the least', () => {
  test('a realm of one land province and 10g wants 5 heroes; a Neutral realm 6; a realm of none 5', () => {
    expect(byCreed((creed) => String(botHeroCap(aRealm(creed), 0)))).toBe(
      'Divine: 5; Good: 5; Druidic: 5; Neutral: 6; Pagan: 5; Evil: 5; Undead: 5; none: 5',
    );
  });
});

describe('the scholars: one more for a realm whose alignment adds to research, and the Sage level they research from', () => {
  /** A hero of realm 0 in Ashford, of the Sage level given (no king in the realm). */
  const aScholar = (sage: number) => ({
    id: 3,
    player: 0,
    alive: true,
    name: 'Wren',
    location: 0,
    skills: { sage },
    items: [],
    armies: [],
  });
  test('a Neutral realm wants one scholar more than any other, a realm of none none more', () => {
    const aDivineRealms = botSpecialistRoles(aRealm('Divine'), 0).want['scholar'] ?? 0;
    expect(
      byCreed((creed) => String((botSpecialistRoles(aRealm(creed), 0).want['scholar'] ?? 0) - aDivineRealms)),
    ).toBe('Divine: 0; Good: 0; Druidic: 0; Neutral: 1; Pagan: 0; Evil: 0; Undead: 0; none: 0');
  });
  test("a Neutral realm's Sage 1 scholar is ready, researches and has work; any other realm's trains until Sage 2", () => {
    const theScholars = byCreed((creed) =>
      [1, 2]
        .map((sage) => {
          const hero = aScholar(sage);
          const G = aRealm(creed, [hero]);
          const asAHero = hero as unknown as Character;
          const orders = botScholarOrders(G, 0, asAHero, []).map((o) => o?.action);
          const work = botRoleWork(G, 0, asAHero, [], 'scholar', null);
          return `Sage ${String(sage)} ${botRoleReady(G, 0, hero, 'scholar') ? 'ready' : 'not ready'} ${orders[0] ?? 'none'} ${work ? 'works' : 'no work'}`;
        })
        .join(', '),
    );
    const theOthers = 'Sage 1 not ready practice no work, Sage 2 ready research works';
    expect(theScholars).toBe(
      `Divine: ${theOthers}; Good: ${theOthers}; Druidic: ${theOthers}; ` +
        'Neutral: Sage 1 ready research works, Sage 2 ready research works; ' +
        `Pagan: ${theOthers}; Evil: ${theOthers}; Undead: ${theOthers}; none: ${theOthers}`,
    );
  });
});
