// The research and practice orders' own functions (plan P1-08j4: src/engine/orders/, the fourth family taken out of
// processOrder), called directly in the bare vm on the middle of a bot world (lib/middle-of-a-bot-world.ts). First the
// cases scenario/research-and-practice-orders-in-a-whole-turn.test.ts plays through a whole turn
// (lib/research-and-practice-order-cases.ts), here one phase at a time, with the skills of the start of each phase
// noted as the turn notes them; then what the dice decide, with the rolls fixed (`rolls`: the d100s in turn, every
// other die high), and what the balance matrix never reaches: a named field of Research (the bots study "any"), an
// unlooked-for find and its bounds, the Loreseeker, a chance past a hundred, Research Breakthrough (no bot gives it),
// the drills' dice and what they skip, the Colossus and the Iron Heart Talisman; and properties of each order.
// Level 1: one function, called with what processOrder hands it.
// Moved down here (plan P1-14), from tests that fixed the rolls through a hook on a line of the engine: the five
// Research orders of research-persevere and the Human's practice of practice-human (now a whole-turn case).
import vm from 'node:vm';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import {
  board,
  hero,
  must,
  withDice,
  type Board,
  type Character,
  type HeroSpec,
  type Line,
  type Order,
} from '../lib/middle-of-a-bot-world.ts';
import { companies, plainRealms } from '../lib/recruit-hire-and-realm-works-order-cases.ts';
import {
  HIDDEN_FIELDS,
  RESEARCH_AND_PRACTICE_ORDER_CASES,
  discoveries,
  eligible,
  knows,
  knowsHidden,
  stageCase,
  type ResearchAndPracticeOrderCase,
} from '../lib/research-and-practice-order-cases.ts';
import { compactDeclaration } from '../lib/source.ts';

const DISPATCH = 'engine/orders/order-dispatch-the-checks-before-a-hero-order-and-the-switch.js';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
type Fn = (...a: unknown[]) => unknown;
const fn = (name: string) => engineFn(engine, name) as Fn;
const provOf = fn('provOf');

/** The skills every hero has at the start of phase `ph`, as the turn notes them before the phase's orders. */
const startPhase = (b: Board, ph: number) => {
  const G = b.G as unknown as Record<string, unknown>;
  G['_phaseSkillSnapshot'] = Object.fromEntries(b.G.characters.map((c) => [c.id, { ...c.skills }]));
  b.tc._currentPhase = ph;
};
/** One order, as processOrder hands it over in phase `ph`: each function takes the context, then the values it reads
 *  of processOrder's (the hero, the phase, the target, his province, his realm), in that order. */
const play = (b: Board, c: Character, o: Order, ph = 0) => {
  b.tc._currentPhase = ph;
  b.tc._logCtx = { charId: c.id, phase: ph };
  const prov = provOf(b.tc, c);
  const player = b.G.players[must(c.player, 'a realm')];
  const { action, target } = o;
  const call: Record<string, () => unknown> = {
    research: () => fn('resolveResearchOrder')(b.tc, c, ph, target, player),
    practice: () => fn('resolvePracticeSkillOrder')(b.tc, c, ph, target),
    rest: () => fn('resolveRestOrder')(b.tc, c, prov),
    research_breakthrough: () => fn('resolveResearchBreakthroughOrder')(b.tc, c),
  };
  must(call[action], 'the order ' + action)();
  b.tc._logCtx = { charId: null, phase: null };
};
/** Runs `body` with the engine's d100 rolls given in turn by `d100s` (it throws if they run out), and every other die
 *  from `dice` (by default 0.999: no skill rise from the order, the last of any list picked). */
function rolls<T>(d100s: number[], body: () => T, dice = [0.999]): T {
  const g = engine as unknown as Record<string, unknown>;
  const was = g['d100'];
  let i = 0;
  g['d100'] = () => must(d100s[i++], 'a d100 roll');
  try {
    return withDice(engine, dice, body);
  } finally {
    g['d100'] = was;
  }
}
const linesOf = (b: Board, c: Character) => b.lines().filter((l: Line) => l.charId === c.id);
const textOf = (b: Board, c: Character) =>
  linesOf(b, c)
    .map((l) => l.text)
    .join('\n');
const fresh = () => {
  const b = board(engine, world, 0);
  plainRealms(b);
  startPhase(b, 0);
  return b;
};
const at = (b: Board, s: Partial<HeroSpec> & { race?: string } = {}) => {
  const { race, ...spec } = s;
  const h = hero(b, { player: 0, at: b.X, ...spec });
  if (race) h['race'] = race;
  return h;
};
const skilled = (skills: Record<string, number>) => ({ melee: 2, tactical: 2, march: 1, spy: 0, ...skills });
const realm = (b: Board, i = 0) => must(b.G.players[i], 'realm ' + String(i));
const o = (action: string, target = ''): Order => ({ action, target, extra: '', desc: '' });
const ids = (b: Board, i = 0) => ((realm(b, i)['discoveries'] as { id: string }[] | undefined) ?? []).map((d) => d.id);
const gold = (b: Board) => realm(b)['gold'] as number;
const chances = (b: Board, c: Character) =>
  linesOf(b, c)
    .filter((l) => l.text.startsWith('📊 Research'))
    .map((l) => Number((/(\d+)% chance/.exec(l.text) ?? [])[1]));
const SKILLGAIN = vm.runInContext('({std:SKILLGAIN_STD, common:SKILLGAIN_COMMON})', engine) as {
  std: number;
  common: number;
};
type Roll = { id: unknown; skill: string; base: unknown };
// every experience roll, recorded as it starts by a wrapper around the top-level trySkillGain (plan P1-08c)
vm.runInContext(
  `{ const tryOne=trySkillGain;
     trySkillGain=function(turnContext, char, skill, base){
       if(globalThis.__xp) globalThis.__xp.push({id:char&&char.id,skill,base});
       return tryOne.apply(this, arguments); }; }`,
  engine,
);
const rollsIn = (body: () => void): Roll[] => {
  const rs: Roll[] = [];
  engine['__xp'] = rs;
  try {
    body();
  } finally {
    engine['__xp'] = undefined;
  }
  return rs;
};
const sageRolls = (rs: Roll[]) => rs.filter((r) => r.skill === 'sage').map((r) => r.base);

describe.each(RESEARCH_AND_PRACTICE_ORDER_CASES)('the %s order, called directly: the whole-turn cases', (_, cases) => {
  test.each(cases.filter((c) => !c.wholeTurnOnly).map((c) => [c.name, c] as const))(
    '%s',
    (_name, c: ResearchAndPracticeOrderCase) => {
      const b = board(engine, world, 0);
      const s = stageCase(b, c);
      // the orders as the turn holds them once read: Practice looks there for comrades at the same drill
      b.G.turnOrders = Object.fromEntries(s.orders.map(([h, os]) => [h.id, os]));
      for (let ph = 0; ph < 5; ph++) {
        startPhase(b, ph);
        for (const [h, os] of s.orders) play(b, h, must(os[ph], 'an order'), ph);
      }
      const { got, want } = c.check({ world: b.G, lines: linesOf(b, s.hero), all: b.lines(), turn: b.G.turn }, s);
      expect(got).toEqual(want);
    },
  );
});

// ── Research ────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Research, called directly', () => {
  const scholar = (b: Board, sage: number, extra: Partial<HeroSpec> = {}) =>
    at(b, { king: true, skills: skilled({ sage }), ...extra });

  test('an unlooked-for find comes first, from a hidden field, instead of the ordinary roll, and resets Perseverance', () => {
    const b = fresh();
    const h = scholar(b, 5);
    h['_researchFailStreak'] = { turn: b.G.turn, n: 2 };
    const xp = rollsIn(() => {
      rolls([1], () => {
        play(b, h, o('research', 'Military'));
      });
    });
    const found = ids(b);
    const hidden = discoveries(b).filter((d) => HIDDEN_FIELDS.includes(d.category));
    expect({
      found: found.length,
      hidden: hidden.some((d) => d.id === found[0]),
      told: textOf(b, h).includes('💡 An unlooked-for find!'),
      rolled: chances(b, h).length,
      streak: h['_researchFailStreak'],
      xp: sageRolls(xp),
    }).toEqual({
      found: 1,
      hidden: true,
      told: true,
      rolled: 0,
      streak: { turn: b.G.turn, n: 0 },
      xp: [SKILLGAIN.std],
    });
  });

  test('a find wins a Sage 6 5g, and a Sage 8 a point of tax in a province the realm holds', () => {
    const b = fresh();
    b.own(b.X, 0);
    b.X['tax'] = 4;
    const h = scholar(b, 8);
    const before = gold(b);
    rolls([1], () => {
      play(b, h, o('research', 'any'));
    });
    expect({ gold: gold(b) - before, tax: b.X['tax'] }).toEqual({ gold: 5, tax: 5 });
  });

  test('the find’s chance is a fifth of the ordinary one, at least one in a hundred and at most ten', () => {
    const finds = (sage: number, roll: number, set: (b: Board, h: Character) => void = () => undefined) => {
      const b = fresh();
      const h = scholar(b, sage);
      set(b, h);
      rolls([roll, 100], () => {
        play(b, h, o('research', 'any'));
      });
      return ids(b).length;
    };
    const lore = (b: Board, h: Character) => {
      realm(b)['alignment'] = 'Neutral';
      knows(b, (d) => d.id === 'an06');
      (b.G as unknown as Record<string, unknown>)['_minorHolders'] = { loreseeker: { charId: h.id } };
    };
    expect({
      sage5: [finds(5, 5), finds(5, 6)],
      sage1: [finds(1, 1), finds(1, 2)],
      // Neutral Sage 5, the Loreseeker and Open Archives: 59 in a hundred, so a fifth would be 11
      capped: [finds(5, 10, lore) - 1, finds(5, 11, lore) - 1],
    }).toEqual({ sage5: [1, 0], sage1: [1, 0], capped: [1, 0] });
  });

  test('a discovery in a field of several: two to choose between next turn, a Sage 6 wins 5g, a Sage 8 a point of tax', () => {
    const b = fresh();
    knowsHidden(b);
    b.own(b.X, 0);
    b.X['tax'] = 4;
    const h = scholar(b, 8);
    const before = gold(b);
    const xp = rollsIn(() => {
      rolls([100, 1], () => {
        play(b, h, o('research', 'Military'), 2);
      });
    });
    const military = discoveries(b).filter((d) => d.category === 'Military');
    const offered = realm(b)['pendingDiscoveryChoices'] as Record<string, unknown>[];
    expect({
      offered,
      gold: gold(b) - before,
      tax: b.X['tax'],
      streak: h['_researchFailStreak'],
      xp: sageRolls(xp),
    }).toEqual({
      // every die high: the last of the field first, then the one before it
      offered: [
        {
          key: `rc${String(b.G.turn)}_${String(h.id)}_2`,
          turn: b.G.turn,
          charId: h.id,
          charName: h.name,
          category: 'Military',
          options: [military[military.length - 1]?.id, military[military.length - 2]?.id],
        },
      ],
      gold: 5,
      tax: 5,
      streak: { turn: b.G.turn, n: 0 },
      xp: [SKILLGAIN.std],
    });
  });

  test('the two offered are never the same discovery, and never of a hidden field, even for “any”', () => {
    const b = fresh();
    const military = discoveries(b).filter((d) => d.category === 'Military');
    const [first, second] = [must(military[0], 'a discovery'), must(military[1], 'another')];
    const offer = (dice: number[]) => {
      const c = fresh();
      knows(c, (d) => !HIDDEN_FIELDS.includes(d.category) && d.id !== first.id && d.id !== second.id);
      const k = scholar(c, 5);
      rolls(
        [100, 1],
        () => {
          play(c, k, o('research', 'any'));
        },
        dice,
      );
      return (realm(c)['pendingDiscoveryChoices'] as { options: string[] }[])[0]?.options;
    };
    expect([offer([0, 0, 0.999]), offer([0.999, 0.999, 0.999])]).toEqual([
      [first.id, second.id],
      [second.id, first.id],
    ]);
  });

  test('a point of tax only on the realm’s own ground, and never past ten', () => {
    const tax = (own: boolean, was: number) => {
      const b = fresh();
      knowsHidden(b);
      if (own) b.own(b.X, 0);
      b.X['tax'] = was;
      const h = scholar(b, 8);
      rolls([100, 1], () => {
        play(b, h, o('research', 'any'));
      });
      return b.X['tax'];
    };
    expect([tax(true, 10), tax(false, 4)]).toEqual([10, 4]);
  });

  test('the field’s last discovery is made outright; an order of “any” is a choice among every field', () => {
    const b = fresh();
    knowsHidden(b);
    const military = discoveries(b).filter((d) => d.category === 'Military');
    const last = must(military[0], 'a Military discovery');
    knows(b, (d) => d.category === 'Military' && d.id !== last.id);
    const h = scholar(b, 6);
    const before = gold(b);
    rolls([100, 1], () => {
      play(b, h, o('research', 'Military'));
    });
    const any = fresh();
    knowsHidden(any);
    const k = scholar(any, 5);
    rolls([100, 1], () => {
      play(any, k, o('research', 'any'));
    });
    const anyChoice = (realm(any)['pendingDiscoveryChoices'] as { category: string; options: string[] }[])[0];
    expect({
      made: ids(b).includes(last.id),
      gold: gold(b) - before,
      offered: realm(b)['pendingDiscoveryChoices'],
      told: textOf(b, h).includes(`**${last.name}** (Military) discovered — the last discovery this field still holds`),
      anyCategory: anyChoice?.category,
      anyOptions: anyChoice?.options.length,
    }).toEqual({ made: true, gold: 5, offered: undefined, told: true, anyCategory: '', anyOptions: 2 });
  });

  test('a roll at the chance finds; one above it doesn’t', () => {
    const finds = (roll: number) => {
      const b = fresh();
      knowsHidden(b);
      const h = scholar(b, 5);
      rolls([100, roll], () => {
        play(b, h, o('research', 'any'));
      });
      return (realm(b)['pendingDiscoveryChoices'] as unknown[] | undefined)?.length ?? 0;
    };
    expect([finds(25), finds(26)]).toEqual([1, 0]);
  });

  test('a fruitless season: a common chance of Sage, and the next Research this turn is likelier', () => {
    const b = fresh();
    knowsHidden(b);
    const h = scholar(b, 3);
    const xp = rollsIn(() => {
      rolls([100, 100], () => {
        play(b, h, o('research', 'any'));
      });
    });
    expect({
      told: textOf(b, h).includes('researches hard but makes no new discovery this turn.'),
      streak: h['_researchFailStreak'],
      xp: sageRolls(xp),
    }).toEqual({ told: true, streak: { turn: b.G.turn, n: 1 }, xp: [SKILLGAIN.common] });
  });

  test('a roll that lands when every discovery is made finds nothing, and teaches nothing', () => {
    const b = fresh();
    knows(b, () => true);
    const h = scholar(b, 5);
    const xp = rollsIn(() => {
      rolls([100, 1], () => {
        play(b, h, o('research', 'any'));
      });
    });
    expect({
      told: textOf(b, h).includes('the roll succeeded but all known discoveries have already been made by your realm'),
      xp: sageRolls(xp),
    }).toEqual({ told: true, xp: [] });
  });

  // moved down from research-persevere (its hooks on the two research rolls)
  test('Perseverance: fail, fail, fail, find, fail: each failure ×1.2, cumulatively; the find resets it', () => {
    const b = fresh();
    knowsHidden(b);
    realm(b)['alignment'] = 'Good';
    const h = scholar(b, 5);
    rolls([100, 100, 100, 100, 100, 100, 100, 1, 100, 100], () => {
      for (let ph = 0; ph < 5; ph++) play(b, h, o('research', 'any'), ph);
    });
    const lines = linesOf(b, h).filter((l) => l.text.startsWith('📊 Research'));
    expect({
      chances: chances(b, h),
      why: (lines[1]?.text ?? '').includes('×1.20 for 1 earlier failed Research this turn'),
      why3: (lines[3]?.text ?? '').includes('×1.73 for 3 earlier failed Research orders this turn'),
      plain: !/×|undefined|NaN/.test(lines[4]?.text ?? '×'),
      clean: !lines.some((l) => /undefined|NaN/.test(l.text)),
      streak: h['_researchFailStreak'],
    }).toEqual({
      chances: [25, 30, 36, 43, 25],
      why: true,
      why3: true,
      plain: true,
      clean: true,
      streak: { turn: b.G.turn, n: 1 },
    });
  });

  test('Perseverance is of this turn only: last turn’s failures count for nothing', () => {
    const b = fresh();
    knowsHidden(b);
    const h = scholar(b, 5);
    h['_researchFailStreak'] = { turn: b.G.turn - 1, n: 3 };
    rolls([100, 100], () => {
      play(b, h, o('research', 'any'));
    });
    expect(chances(b, h)).toEqual([25]);
  });

  test('the chance never passes a hundred', () => {
    const b = fresh();
    knowsHidden(b);
    realm(b)['alignment'] = 'Neutral';
    const h = scholar(b, 5);
    h['_researchFailStreak'] = { turn: b.G.turn, n: 5 };
    rolls([100, 100], () => {
      play(b, h, o('research', 'any'));
    });
    expect(chances(b, h)).toEqual([100]);
  });

  test('the Loreseeker adds five in a hundred', () => {
    const b = fresh();
    knowsHidden(b);
    const h = scholar(b, 3);
    (b.G as unknown as Record<string, unknown>)['_minorHolders'] = { loreseeker: { charId: h.id } };
    rolls([100, 100], () => {
      play(b, h, o('research', 'any'));
    });
    expect(chances(b, h)).toEqual([20]);
  });

  test('a spent field turns to another chosen by the dice among those with something left, in the table’s order', () => {
    const b = fresh();
    knowsHidden(b);
    knows(b, (d) => d.category === 'Military');
    const pl = realm(b);
    const open = [
      ...new Set(
        discoveries(b)
          .filter(
            (d) =>
              !ids(b).includes(d.id) &&
              !HIDDEN_FIELDS.includes(d.category) &&
              eligible(d, String(pl['alignment']), String(pl['race'])),
          )
          .map((d) => d.category),
      ),
    ];
    const h = scholar(b, 3);
    withDice(engine, [0, 0.999], () => {
      play(b, h, o('research', 'Military'));
    });
    expect(textOf(b, h)).toContain(`and turns instead to ${must(open[0], 'an open field')}.`);
  });
});

// ── Practice Skill ──────────────────────────────────────────────────────────────────────────────────────────────
describe('Practice Skill, called directly', () => {
  const elf = (b: Board, skills: Record<string, number>, extra: Partial<HeroSpec> = {}) =>
    at(b, { race: 'Elven', skills: skilled(skills), ...extra });
  const practiceChances = (b: Board, c: Character) =>
    linesOf(b, c)
      .filter((l) => l.text.includes(' practises '))
      .map((l) => Number((/(\d+)% \[roll/.exec(l.text) ?? [])[1]));

  test('an order naming no skill does nothing at all', () => {
    const b = fresh();
    const h = elf(b, { spy: 1 });
    play(b, h, o('practice'));
    expect({ lines: linesOf(b, h).length, spy: h.skills['spy'] }).toEqual({ lines: 0, spy: 1 });
  });

  test('a roll at the chance rises; one above it doesn’t', () => {
    const rise = (roll: number) => {
      const b = fresh();
      const h = elf(b, { spy: 3 });
      rolls([roll], () => {
        play(b, h, o('practice', 'spy'));
      });
      return h.skills['spy'];
    };
    expect([rise(10), rise(11)]).toEqual([4, 3]);
  });

  test('Perseverance: each failure this turn ×1.2, cumulatively, for any skill; a rise resets it', () => {
    const b = fresh();
    const h = elf(b, { spy: 3, thief: 3 });
    rolls([100, 100, 100, 1, 100], () => {
      ['spy', 'thief', 'spy', 'spy', 'spy'].forEach((s, ph) => {
        play(b, h, o('practice', s), ph);
      });
    });
    const lines = linesOf(b, h).filter((l) => l.text.includes(' practises '));
    expect({
      chances: practiceChances(b, h),
      why: (lines[2]?.text ?? '').includes('×1.44 for 2 earlier failed practices this turn'),
      spy: h.skills['spy'],
      streak: h['_practiceFailStreak'],
    }).toEqual({
      // Spy 3 alone is 10; after three failures ×1.728 (17); then Spy 4 is 5 afresh
      chances: [10, 12, 14, 17, 5],
      why: true,
      spy: 4,
      streak: { turn: b.G.turn, n: 1 },
    });
  });

  test('Perseverance is of this turn only: last turn’s failures count for nothing', () => {
    const b = fresh();
    const h = elf(b, { spy: 3 });
    h['_practiceFailStreak'] = { turn: b.G.turn - 1, n: 3 };
    rolls([100], () => {
      play(b, h, o('practice', 'spy'));
    });
    expect(practiceChances(b, h)).toEqual([10]);
  });

  test('a comrade who rose earlier this phase is still a peer, not a mentor: the levels are the phase’s start', () => {
    const second = (level: number) => {
      const b = fresh();
      const first = elf(b, { spy: level });
      const h = elf(b, { spy: level });
      b.G.turnOrders = Object.fromEntries(b.G.characters.map((c) => [c.id, [o('practice', 'spy')]]));
      startPhase(b, 0);
      rolls([1, 100], () => {
        play(b, first, o('practice', 'spy'));
        play(b, h, o('practice', 'spy'));
      });
      return { first: first.skills['spy'], chance: practiceChances(b, h)[0], spy: h.skills['spy'] };
    };
    // level 0: a skill not yet learned is absent from the note of the phase's start, and still reads 0
    expect([second(1), second(0)]).toEqual([
      { first: 2, chance: 30, spy: 1 },
      { first: 1, chance: 37, spy: 0 },
    ]);
  });

  test('a comrade’s order written “Practice Skill” or “Practice Ability” is the same drill', () => {
    const chance = (action: string) => {
      const b = fresh();
      const h = elf(b, { spy: 1 });
      const p = elf(b, { spy: 1 });
      b.G.turnOrders = { [p.id]: [o(action, 'Spy')] };
      startPhase(b, 0);
      rolls([100], () => {
        play(b, h, o('practice', 'spy'));
      });
      return practiceChances(b, h)[0];
    };
    expect([chance('Practice Skill'), chance('practice ability'), chance('rest')]).toEqual([30, 30, 20]);
  });

  test('a rise is the phase’s one skill rise: it counts in the turn’s tally and voids the phase’s field candidate', () => {
    const b = fresh();
    const h = elf(b, { spy: 3 });
    h['_sgPending'] = { phase: 2, skill: 'melee' };
    rolls([1], () => {
      play(b, h, o('practice', 'spy'), 2);
    });
    const log = h['_sgLog'] as { turnGains: Record<string, number>; gainedPhases: Record<number, boolean> };
    expect({ gains: log.turnGains, phases: log.gainedPhases, pending: h['_sgPending'] }).toEqual({
      gains: { spy: 1 },
      phases: { 2: true },
      pending: null,
    });
  });

  test('a field candidate of another phase is kept; with no phase on the line, the turn’s current phase is closed', () => {
    const b = fresh();
    const h = elf(b, { spy: 3 });
    h['_sgPending'] = { phase: 1, skill: 'melee' };
    b.tc._currentPhase = 3;
    b.tc._logCtx = { charId: h.id, phase: null };
    rolls([1], () => {
      fn('resolvePracticeSkillOrder')(b.tc, h, 3, 'spy');
    });
    const log = h['_sgLog'] as { gainedPhases: Record<number, boolean> };
    expect({ phases: log.gainedPhases, pending: h['_sgPending'] }).toEqual({
      phases: { 3: true },
      pending: { phase: 1, skill: 'melee' },
    });
  });

  test('without a note of the phase’s start, the levels are read as they stand', () => {
    const b = fresh();
    const h = elf(b, { spy: 1 });
    elf(b, { spy: 3 });
    (b.G as unknown as Record<string, unknown>)['_phaseSkillSnapshot'] = undefined;
    const ph = 0;
    b.G.turnOrders = Object.fromEntries(b.G.characters.map((c) => [c.id, [o('practice', 'spy')]]));
    play(b, h, o('practice', 'spy'), ph);
    expect(h.skills['spy']).toBe(2);
  });

  // the drills: a die for each company, at its grade's chance × the skill × 2 for Human folk of a Human realm
  test('Tactical drills: a Green Human company of a Human realm at 5% × level × 2; an Elven one at half that', () => {
    const drill = (race: string, die: number) => {
      const b = fresh();
      const h = elf(b, { tactical: 2 });
      h.armies = companies(1, 'Men-at-Arms', 'Green', race);
      withDice(engine, [0.999, die], () => {
        play(b, h, o('practice', 'tactical'));
      });
      return { grade: h.armies.map((a) => a.quality)[0], told: textOf(b, h).includes('advances to **Average**') };
    };
    expect([drill('Human', 0.19), drill('Human', 0.2), drill('Elven', 0.09), drill('Elven', 0.1)]).toEqual([
      { grade: 'Average', told: true },
      { grade: 'Green', told: false },
      { grade: 'Average', told: true },
      { grade: 'Green', told: false },
    ]);
  });

  test('a rise in Tactical drills at the new level', () => {
    const b = fresh();
    const h = elf(b, { tactical: 2 });
    h.armies = companies(1, 'Men-at-Arms', 'Green');
    // the practice roll lands (Tactical 3), then 0.25: under 5% × 3 × 2, over 5% × 2 × 2
    withDice(engine, [0, 0.25], () => {
      play(b, h, o('practice', 'tactical'));
    });
    expect({ tactical: h.skills['tactical'], grade: h.armies[0]?.quality }).toEqual({ tactical: 3, grade: 'Average' });
  });

  test('the skeletal dead are never drilled', () => {
    const b = fresh();
    const h = elf(b, { tactical: 3 });
    h.armies = companies(2, 'Men-at-Arms', 'Green').map((a) => ({ ...a, _isSkeletal: true }));
    withDice(engine, [0.999, 0], () => {
      play(b, h, o('practice', 'tactical'));
    });
    expect({
      grades: h.armies.map((a) => a.quality),
      told: textOf(b, h).includes('practises Tactical theory alone'),
    }).toEqual({ grades: ['Green', 'Green'], told: true });
  });

  test('Naval drills the fleets he leads, and not his land companies', () => {
    const fleet = (vm.runInContext('KC_UNIT_CLASS.sea', engine) as string[])[0] ?? '';
    const b = fresh();
    const h = elf(b, { naval: 3 });
    h.armies = [...companies(1, fleet, 'Green'), ...companies(1, 'Men-at-Arms', 'Green')];
    withDice(engine, [0.999, 0], () => {
      play(b, h, o('practice', 'naval'));
    });
    expect({
      grades: h.armies.map((a) => a.quality),
      told: textOf(b, h).includes(`Naval drills: ${fleet} c0 (${fleet}) advances to **Average**!`),
    }).toEqual({ grades: ['Average', 'Green'], told: true });
  });

  test('a king draws no wage, so a rise raises none', () => {
    const b = fresh();
    const h = at(b, { king: true, race: 'Elven', skills: skilled({ spy: 3 }) });
    rolls([1], () => {
      play(b, h, o('practice', 'spy'));
    });
    expect({ pay: h['pay'], told: textOf(b, h).includes('wage') }).toEqual({ pay: undefined, told: false });
  });

  test('property: a practice raises the skill by one at most, never past 5, and certainly beside a better comrade', () => {
    const comrade = fc.record({
      level: fc.nat(6),
      realm: fc.constantFrom(0, 0, 2),
      skill: fc.constantFrom('spy', 'thief'),
    });
    const seen = { taught: 0, rose: 0, stayed: 0 };
    fc.assert(
      fc.property(
        fc.nat(7),
        fc.array(comrade, { maxLength: 3 }),
        fc.integer({ min: 1, max: 100 }),
        (level, others, roll) => {
          const b = fresh();
          const h = elf(b, { spy: level });
          const os = others.map((x) => {
            const c = hero(b, { player: x.realm, at: b.X, skills: skilled({ spy: x.level, thief: x.level }) });
            return { c, ...x };
          });
          b.G.turnOrders = Object.fromEntries(os.map(({ c, skill }) => [c.id, [o('practice', skill)]]));
          startPhase(b, 0);
          rolls([roll], () => {
            play(b, h, o('practice', 'spy'));
          });
          const after = h.skills['spy'] ?? 0;
          const taught = level < 5 && os.some((x) => x.realm === 0 && x.skill === 'spy' && x.level > level);
          expect(after - level).toBeGreaterThanOrEqual(0);
          expect(after - level).toBeLessThanOrEqual(level < 5 ? 1 : 0);
          expect(taught ? after : level + 1).toBe(level + 1);
          seen[taught ? 'taught' : after > level ? 'rose' : 'stayed']++;
        },
      ),
    );
    expect(Object.values(seen).every((n) => n > 0)).toBe(true);
  });
});

// ── Rest ────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Rest, called directly', () => {
  const healed = (b: Board, c: Character) => Number((/\+(\d+) HP/.exec(textOf(b, c)) ?? [])[1]);

  test('the Colossus recovers two more', () => {
    const b = fresh();
    realm(b)['alignment'] = 'Good';
    const h = at(b, { king: true });
    h.hp = 5;
    (b.G as unknown as Record<string, unknown>)['_minorHolders'] = { colossus: { charId: h.id } };
    play(b, h, o('rest'));
    expect({ healed: healed(b, h), hp: h.hp }).toEqual({ healed: 8, hp: 13 });
  });

  test('the Iron Heart Talisman, worn, adds a tenth of his maximum', () => {
    const talisman = JSON.parse(
      vm.runInContext(`JSON.stringify(ALL_MAGIC_ITEMS_P.find(i=>i.name==='Iron Heart Talisman'))`, engine) as string,
    ) as Record<string, unknown>;
    const b = fresh();
    realm(b)['alignment'] = 'Good';
    const h = at(b, { king: true, hp: 30 });
    h.items = [{ ...talisman, id: 7001, equipped: true }];
    h.hp = 5;
    play(b, h, o('rest'));
    expect({ healed: healed(b, h), hp: h.hp }).toEqual({ healed: 12, hp: 17 });
  });

  test('property: a Rest never takes HP away and never heals past the maximum', () => {
    const restDiscoveries = ['sd28', 'ad06', 'ag06', 'au07', 'ap20'];
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 60 }),
        fc.nat(60),
        fc.constantFrom('Divine', 'Good', 'Druidic', 'Pagan', 'Neutral'),
        fc.subarray(restDiscoveries),
        fc.boolean(),
        fc.constantFrom('plain', 'forest', 'jungle'),
        (max, hp0, alignment, known, own, terrain) => {
          const b = fresh();
          realm(b)['alignment'] = alignment;
          b.X.terrain = terrain;
          knows(b, (d) => known.includes(d.id));
          if (own) {
            b.own(b.X, 0);
            realm(b)['homeProvinceId'] = b.X.id;
          }
          const h = at(b, { king: true, hp: max });
          h.hp = Math.min(hp0, max);
          const was = h.hp;
          play(b, h, o('rest'));
          expect(h.hp).toBeGreaterThanOrEqual(was);
          expect(h.hp).toBeLessThanOrEqual(max);
          expect(healed(b, h)).toBeGreaterThanOrEqual(known.includes('sd28') ? 0 : 1);
        },
      ),
    );
  });
});

// ── Research Breakthrough ───────────────────────────────────────────────────────────────────────────────────────
describe('Research Breakthrough, called directly', () => {
  test('the dice choose among every discovery the realm may make, the hidden fields too, and a Sage roll follows', () => {
    const made = (die: number) => {
      const b = fresh();
      const h = at(b, { king: true, skills: skilled({ sage: 7 }) });
      const xp = rollsIn(() => {
        withDice(engine, [die, 0.999], () => {
          play(b, h, o('research_breakthrough'));
        });
      });
      return { id: ids(b)[0], xp: sageRolls(xp), told: textOf(b, h).includes('drives a Research Breakthrough') };
    };
    const b = fresh();
    const pl = realm(b);
    const open = discoveries(b).filter((d) => eligible(d, String(pl['alignment']), String(pl['race'])));
    expect([made(0), made(0.999)]).toEqual([
      { id: open[0]?.id, xp: [SKILLGAIN.std], told: true },
      { id: open[open.length - 1]?.id, xp: [SKILLGAIN.std], told: true },
    ]);
  });

  test('with nothing left to find, a Sage roll all the same', () => {
    const b = fresh();
    knows(b, () => true);
    const h = at(b, { king: true, skills: skilled({ sage: 7 }) });
    const xp = rollsIn(() => {
      play(b, h, o('research_breakthrough'));
    });
    expect(sageRolls(xp)).toEqual([SKILLGAIN.std]);
  });

  test('property: one order makes one discovery, of the realm’s table, never one it knew', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Divine', 'Good', 'Undead', 'Neutral'),
        fc.constantFrom('Human', 'Elven', 'Dwarven', 'Orcish'),
        fc.double({ min: 0, max: 0.999, noNaN: true }),
        fc.nat(296),
        (alignment, race, die, knownCount) => {
          const b = fresh();
          Object.assign(realm(b), { alignment, race });
          const table = discoveries(b).filter((d) => eligible(d, alignment, race));
          const knew = new Set(table.slice(0, Math.min(knownCount, table.length)).map((d) => d.id));
          knows(b, (d) => knew.has(d.id));
          const h = at(b, { king: true, skills: skilled({ sage: 7 }) });
          withDice(engine, [die, 0.999], () => {
            play(b, h, o('research_breakthrough'));
          });
          const fresh2 = ids(b).filter((id) => !knew.has(id));
          expect(fresh2.length).toBe(knew.size < table.length ? 1 : 0);
          for (const id of fresh2) expect(table.some((d) => d.id === id)).toBe(true);
        },
      ),
    );
  });
});

test('every order of the family is a function of its own, and processOrder only calls it', () => {
  // processOrder is top-level since P1-08j9; read in one layout whatever the file's (tests/lib/source.ts, plan P1-09a)
  const src = compactDeclaration(DISPATCH, 'processOrder');
  for (const [key, name] of [
    ['research', 'resolveResearchOrder'],
    ['practice', 'resolvePracticeSkillOrder'],
    ['rest', 'resolveRestOrder'],
    ['research_breakthrough', 'resolveResearchBreakthroughOrder'],
  ] as const) {
    expect(typeof fn(name)).toBe('function');
    expect(src).toMatch(new RegExp(`case '${key}':${name}\\(turnContext,c[^)]*\\);break;`));
  }
});
