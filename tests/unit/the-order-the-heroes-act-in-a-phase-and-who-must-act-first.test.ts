// What a hero holds, on plain values (plan P1-11e16 moved these rules out of the phase pipeline, so the order form's
// replay of a phase can act its heroes in the turn's order): a hero's initiative (his skills added up, his March three
// times); the tier an order acts in (orders that stay put, then Move and Encounter, then Defend); which of two heroes
// acts first (the tier, then initiative, then the lower id); who must act before whom (a giver before his recipient, a
// friendly spell before its mark, a Pick Up after the Leaves, a comrade marching in before the giver, a pursuer after
// his quarry); and the order Kahn's sort gives (the dependencies first, a cycle in initiative order).
//
// Level 1 (unit): the functions of src/engine/rules-on-plain-values/the-order-the-heroes-act-in-a-phase-and-who-must-act-first.ts
// on made-up heroes and intents, and the engine's totalInit that asks the first. A lower level can't run a function. A
// fault planted in a shared function moves every caller at once, so these cases pin its answers;
// tests/unit/phase-order-and-province-bookkeeping.test.ts checks the engine's callers on made-up phases.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import {
  theHeroesWhoMustActFirstInAPhase,
  theInitiativeAHeroActsBy,
  theOrderTheHeroesActInAPhase,
  theTierAnOrderActsIn,
  whichOfTwoHeroesActsFirstInAPhase,
  type AHerosIntentAsWhoMustActFirstReadsIt,
} from '../../src/engine/rules-on-plain-values/the-order-the-heroes-act-in-a-phase-and-who-must-act-first.ts';
import { totalInit } from '../../src/engine/heroes/effective-skills-and-hidden-heroes.ts';

const SKILLS = [
  'melee',
  'archery',
  'tactical',
  'march',
  'naval',
  'sage',
  'spy',
  'thief',
  'druid',
  'explorer',
  'white',
  'psychic',
  'illusory',
  'elemental',
  'necromancy',
] as const;

describe('a hero’s initiative', () => {
  test('each skill counts its level once, but March three times', () => {
    for (const skill of SKILLS) {
      expect(theInitiativeAHeroActsBy({ skills: { [skill]: 2 } }), skill).toBe(skill === 'march' ? 6 : 2);
    }
  });

  test('his skills added up; a skill he lacks, and a hero with no skills, count none', () => {
    expect(theInitiativeAHeroActsBy({ skills: { melee: 3, march: 2, white: 1 } })).toBe(10);
    expect(theInitiativeAHeroActsBy({ skills: Object.fromEntries(SKILLS.map((s) => [s, 1])) })).toBe(17);
    expect(theInitiativeAHeroActsBy({ skills: {} })).toBe(0);
    expect(theInitiativeAHeroActsBy({ skills: null })).toBe(0);
    expect(theInitiativeAHeroActsBy({})).toBe(0);
    expect(theInitiativeAHeroActsBy({ skills: { melee: undefined, archery: 4 } })).toBe(4);
  });

  test('the engine’s totalInit asks it', () => {
    const hero = { skills: { march: 4, spy: 3, necromancy: 2 } };
    expect(totalInit(hero)).toBe(17);
    expect(totalInit({})).toBe(0);
  });
});

describe('the tier an order acts in, and which of two heroes acts first', () => {
  test('an order that stays put acts in tier 0, Move and Encounter (and Pursue) in 1, Defend in 2', () => {
    for (const kind of [
      'cast_spell',
      'give_item',
      'leave_army',
      'pickup_army',
      'recruit',
      'search',
      'forced_march',
      '',
    ])
      expect(theTierAnOrderActsIn(kind), kind).toBe(0);
    for (const kind of ['move', 'encounter', 'pursue']) expect(theTierAnOrderActsIn(kind), kind).toBe(1);
    expect(theTierAnOrderActsIn('defend')).toBe(2);
  });

  const hero = (id: number, action: string, melee: number) => ({ id, action, skills: { melee } });
  const first = (a: ReturnType<typeof hero>, b: ReturnType<typeof hero>) => whichOfTwoHeroesActsFirstInAPhase(a, b);

  test('the tier first, however quick the hero of a later tier', () => {
    expect(first(hero(5, 'search', 1), hero(2, 'move', 9))).toBe(-1);
    expect(first(hero(2, 'move', 9), hero(5, 'search', 1))).toBe(1);
    expect(first(hero(5, 'encounter', 1), hero(2, 'defend', 9))).toBe(-1);
    expect(first(hero(5, 'cast_spell', 0), hero(2, 'defend', 9))).toBe(-2);
  });

  test('within a tier the higher initiative first, by the difference', () => {
    expect(first(hero(7, 'move', 5), hero(1, 'move', 2))).toBe(-3);
    expect(first(hero(1, 'move', 2), hero(7, 'move', 5))).toBe(3);
    expect(first(hero(1, 'recruit', 4), hero(7, 'give_item', 1))).toBe(-3);
    expect(
      whichOfTwoHeroesActsFirstInAPhase(
        { id: 1, action: 'move', skills: { march: 1 } },
        { id: 2, action: 'move', skills: { melee: 2 } },
      ),
    ).toBe(-1);
  });

  test('a tie of tier and initiative goes to the lower id; a hero against himself is a tie', () => {
    expect(first(hero(3, 'move', 2), hero(8, 'encounter', 2))).toBe(-5);
    expect(first(hero(8, 'defend', 2), hero(3, 'defend', 2))).toBe(5);
    expect(first(hero(4, 'search', 2), hero(4, 'search', 2))).toBe(0);
  });
});

// ── Who must act first ────
type AnIntent = AHerosIntentAsWhoMustActFirstReadsIt;
const intent = (id: number, action: string, more: Partial<AnIntent> = {}): AnIntent => ({
  id,
  player: 0,
  action,
  fromId: 10,
  toId: null,
  order: { target: '', extra: '' },
  theHeroHisOrderHandsTo: null,
  theHeroHePursues: null,
  ...more,
});
const mustActFirst = (...intents: AnIntent[]) =>
  theHeroesWhoMustActFirstInAPhase(new Map(intents.map((it) => [it.id, it])));

describe('who must act first: a giver before his recipient, a friendly spell before its mark', () => {
  test('a Send Item or a Leave/Transfer Army to a comrade: the giver first', () => {
    expect(mustActFirst(intent(1, 'give_item', { theHeroHisOrderHandsTo: 2 }), intent(2, 'search'))).toEqual([[1, 2]]);
    expect(mustActFirst(intent(1, 'leave_army', { theHeroHisOrderHandsTo: 2 }), intent(2, 'defend'))).toEqual([[1, 2]]);
  });

  test('no edge to a hero of another realm, to himself, to one not acting, or to none named', () => {
    expect(
      mustActFirst(intent(1, 'give_item', { theHeroHisOrderHandsTo: 2 }), intent(2, 'search', { player: 1 })),
    ).toEqual([]);
    expect(mustActFirst(intent(1, 'give_item', { theHeroHisOrderHandsTo: 1 }))).toEqual([]);
    expect(mustActFirst(intent(1, 'give_item', { theHeroHisOrderHandsTo: 9 }), intent(2, 'search'))).toEqual([]);
    expect(mustActFirst(intent(1, 'leave_army'), intent(2, 'search'))).toEqual([]);
  });

  test('a recipient named on any other order is not one', () => {
    expect(mustActFirst(intent(1, 'search', { theHeroHisOrderHandsTo: 2 }), intent(2, 'recruit'))).toEqual([]);
  });

  test('a recipient marching into the giver’s province arrives first instead (rule (c)), never both ways', () => {
    expect(
      mustActFirst(intent(1, 'give_item', { theHeroHisOrderHandsTo: 2 }), intent(2, 'move', { fromId: 11, toId: 10 })),
    ).toEqual([[2, 1]]);
    // a recipient marching elsewhere still waits for the giver
    expect(
      mustActFirst(intent(1, 'give_item', { theHeroHisOrderHandsTo: 2 }), intent(2, 'move', { fromId: 10, toId: 12 })),
    ).toEqual([[1, 2]]);
  });

  test('a spell on a comrade (its mark in the extra choice): the caster first, but not on a foe or himself', () => {
    const caster = (extra: string) => intent(1, 'cast_spell', { order: { target: 'Oratory', extra } });
    expect(mustActFirst(caster('2'), intent(2, 'recruit'))).toEqual([[1, 2]]);
    expect(mustActFirst(caster('2'), intent(2, 'recruit', { player: 1 }))).toEqual([]);
    expect(mustActFirst(caster('1'), intent(2, 'recruit'))).toEqual([]);
    expect(mustActFirst(caster(''), intent(2, 'recruit'))).toEqual([]);
    expect(mustActFirst(caster('9'), intent(2, 'recruit'))).toEqual([]);
    // a mark marching into the caster's province is not waited for
    expect(mustActFirst(caster('2'), intent(2, 'move', { fromId: 11, toId: 10 }))).toEqual([]);
    // the mark is read from the extra choice, not the target
    expect(mustActFirst(intent(1, 'cast_spell', { order: { target: '2', extra: 'x' } }), intent(2, 'recruit'))).toEqual(
      [],
    );
  });
});

describe('who must act first: a Pick Up after the Leaves', () => {
  test('a Pick Up waits for every comrade leaving companies in his province', () => {
    expect(mustActFirst(intent(1, 'pickup_army'), intent(2, 'leave_army'), intent(3, 'leave_army'))).toEqual([
      [2, 1],
      [3, 1],
    ]);
  });

  test('not for a Leave in another province, of another realm, or another order', () => {
    expect(mustActFirst(intent(1, 'pickup_army'), intent(2, 'leave_army', { fromId: 11 }))).toEqual([]);
    expect(mustActFirst(intent(1, 'pickup_army'), intent(2, 'leave_army', { player: 1 }))).toEqual([]);
    expect(mustActFirst(intent(1, 'pickup_army'), intent(2, 'disband_army'))).toEqual([]);
    expect(mustActFirst(intent(1, 'pickup_army'), intent(2, 'pickup_army'))).toEqual([]);
  });
});

describe('who must act first: a comrade marching in before the giver', () => {
  test('a hero marching into a province where a comrade hands him something arrives first', () => {
    expect(
      mustActFirst(intent(1, 'move', { fromId: 11, toId: 10 }), intent(2, 'leave_army', { theHeroHisOrderHandsTo: 1 })),
    ).toEqual([[1, 2]]);
  });

  test('not into another province, with no march, or a march cancelled: the giver first then (rule (a))', () => {
    const giver = intent(2, 'give_item', { theHeroHisOrderHandsTo: 1 });
    expect(mustActFirst(intent(1, 'move', { fromId: 11, toId: 12 }), giver)).toEqual([[2, 1]]);
    expect(mustActFirst(intent(1, 'move', { fromId: 11 }), giver)).toEqual([[2, 1]]);
    // a cancelled march (now a Defend) arrives nowhere first
    expect(mustActFirst(intent(1, 'defend', { fromId: 11, toId: 10 }), giver)).toEqual([[2, 1]]);
  });

  test('not to a giver handing to another, or of another realm', () => {
    expect(
      mustActFirst(
        intent(1, 'move', { fromId: 11, toId: 10 }),
        intent(2, 'give_item', { theHeroHisOrderHandsTo: 3 }),
        intent(3, 'search', { fromId: 12 }),
      ),
    ).toEqual([[2, 3]]);
    expect(
      mustActFirst(
        intent(1, 'move', { fromId: 11, toId: 10 }),
        intent(2, 'give_item', { theHeroHisOrderHandsTo: 1, player: 1 }),
      ),
    ).toEqual([]);
  });

  test('only a Send Item or a Leave/Transfer Army waits; a province 0 is a destination', () => {
    expect(
      mustActFirst(
        intent(1, 'move', { fromId: 11, toId: 10 }),
        intent(2, 'cast_spell', { theHeroHisOrderHandsTo: 1, order: { target: '', extra: '' } }),
      ),
    ).toEqual([]);
    expect(
      mustActFirst(
        intent(1, 'move', { fromId: 11, toId: 0 }),
        intent(2, 'give_item', { theHeroHisOrderHandsTo: 1, fromId: 0 }),
      ),
    ).toEqual([[1, 2]]);
  });
});

describe('who must act first: a pursuer after his quarry', () => {
  test('an Encounter (or a Pursue) acts after the hero it names, of any realm', () => {
    expect(
      mustActFirst(intent(1, 'encounter', { order: { target: '2', extra: '' } }), intent(2, 'move', { player: 1 })),
    ).toEqual([[2, 1]]);
    expect(mustActFirst(intent(1, 'pursue', { order: { target: '2', extra: '' } }), intent(2, 'search'))).toEqual([
      [2, 1],
    ]);
  });

  test('not on himself, on a hero not acting, or on another order naming a hero', () => {
    expect(mustActFirst(intent(1, 'encounter', { order: { target: '1', extra: '' } }))).toEqual([]);
    expect(mustActFirst(intent(1, 'encounter', { order: { target: '9', extra: '' } }), intent(2, 'search'))).toEqual(
      [],
    );
    expect(mustActFirst(intent(1, 'encounter', { order: { target: 'x', extra: '' } }), intent(2, 'search'))).toEqual(
      [],
    );
    expect(mustActFirst(intent(1, 'move', { order: { target: '2', extra: '' } }), intent(2, 'search'))).toEqual([]);
  });

  test('a pursuit under way acts after its quarry, whatever his order; not on himself or a hero not acting', () => {
    expect(mustActFirst(intent(1, 'defend', { theHeroHePursues: 2 }), intent(2, 'move', { player: 1 }))).toEqual([
      [2, 1],
    ]);
    expect(mustActFirst(intent(1, 'defend', { theHeroHePursues: 1 }))).toEqual([]);
    expect(mustActFirst(intent(1, 'defend', { theHeroHePursues: 9 }), intent(2, 'search'))).toEqual([]);
  });

  test('a hero with no order this phase is waited for by no one, his pursuit too', () => {
    expect(mustActFirst(intent(1, 'defend', { order: null, theHeroHePursues: 2 }), intent(2, 'pickup_army'))).toEqual(
      [],
    );
    expect(
      mustActFirst(intent(1, 'give_item', { order: null, theHeroHisOrderHandsTo: 2 }), intent(2, 'search')),
    ).toEqual([]);
  });

  test('the edges in the heroes’ order, each hero’s rules in turn', () => {
    expect(
      mustActFirst(
        intent(1, 'encounter', { order: { target: '3', extra: '' }, theHeroHePursues: 4 }),
        intent(2, 'give_item', { theHeroHisOrderHandsTo: 3 }),
        intent(3, 'pickup_army'),
        intent(4, 'leave_army'),
      ),
    ).toEqual([
      [3, 1],
      [4, 1],
      [2, 3],
      [4, 3],
    ]);
  });
});

describe('the order the heroes act in a phase', () => {
  const hero = (id: number, action: string, melee: number) => ({ id, action, skills: { melee } });
  const ids = (heroes: { id: number }[]) => heroes.map((h) => h.id);

  test('with no dependency, the comparator’s order: the tier, then initiative, then the lower id', () => {
    const heroes = [
      hero(1, 'defend', 9),
      hero(2, 'move', 1),
      hero(3, 'search', 1),
      hero(4, 'move', 5),
      hero(5, 'search', 1),
    ];
    expect(ids(theOrderTheHeroesActInAPhase(heroes, []))).toEqual([3, 5, 4, 2, 1]);
  });

  test('a dependency comes first, past the tier and initiative', () => {
    const heroes = [hero(1, 'give_item', 9), hero(2, 'move', 1), hero(3, 'search', 5)];
    expect(ids(theOrderTheHeroesActInAPhase(heroes, [[2, 1]]))).toEqual([3, 2, 1]);
    expect(ids(theOrderTheHeroesActInAPhase(heroes, [[2, 3]]))).toEqual([1, 2, 3]);
  });

  test('once free, a waiting hero takes his place by the comparator among those ready', () => {
    const heroes = [hero(1, 'search', 1), hero(2, 'search', 9), hero(3, 'search', 5), hero(4, 'search', 3)];
    // 2 waits for 1; once 1 acts, 2 is the quickest ready
    expect(ids(theOrderTheHeroesActInAPhase(heroes, [[1, 2]]))).toEqual([3, 4, 1, 2]);
    expect(ids(theOrderTheHeroesActInAPhase(heroes, [[4, 2]]))).toEqual([3, 4, 2, 1]);
    // a hero waiting for two acts after both
    expect(
      ids(
        theOrderTheHeroesActInAPhase(heroes, [
          [1, 2],
          [4, 2],
        ]),
      ),
    ).toEqual([3, 4, 1, 2]);
  });

  test('a cycle: its heroes appended in initiative order after the rest, each once', () => {
    const heroes = [hero(1, 'give_item', 1), hero(2, 'give_item', 9), hero(3, 'search', 5)];
    expect(
      ids(
        theOrderTheHeroesActInAPhase(heroes, [
          [1, 2],
          [2, 1],
        ]),
      ),
    ).toEqual([3, 2, 1]);
  });

  test('a dependency on a hero not acting, or on himself, is dropped; a repeated one waits once', () => {
    const heroes = [hero(1, 'search', 1), hero(2, 'search', 9)];
    expect(
      ids(
        theOrderTheHeroesActInAPhase(heroes, [
          [7, 2],
          [2, 7],
          [2, 2],
        ]),
      ),
    ).toEqual([2, 1]);
    expect(
      ids(
        theOrderTheHeroesActInAPhase(heroes, [
          [1, 2],
          [1, 2],
        ]),
      ),
    ).toEqual([1, 2]);
  });

  test('the heroes handed in come back, the list handed in left as it was', () => {
    const heroes = [hero(1, 'search', 1), hero(2, 'search', 9)];
    const order = theOrderTheHeroesActInAPhase(heroes, []);
    expect(order[0]).toBe(heroes[1]);
    expect(ids(heroes)).toEqual([1, 2]);
    expect(theOrderTheHeroesActInAPhase([], [[1, 2]])).toEqual([]);
  });
});
