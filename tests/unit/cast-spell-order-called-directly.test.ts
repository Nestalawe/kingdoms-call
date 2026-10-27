// The Cast Spell order's own function (plan P1-08j7: src/engine/orders/, the seventh family taken out of processOrder),
// called directly in the bare vm on the middle of a bot world (lib/middle-of-a-bot-world.ts). First the cases
// scenario/cast-spell-order-in-a-whole-turn.test.ts plays through a whole turn (lib/cast-spell-order-cases.ts), here
// one phase at a time, the orders read from the turn's list as processOrder reads them (a spell item's Use Item handed
// over as a cast, as processOrder turns it into one), with the same dice; then what the cases leave to a direct call:
// what the turn's end takes back (a Clairvoyance replaced, an illusion at a low die), the minor title Warlock (titles
// start at turn 5), a charmed hero's refusal and a mark named by a pre-order reference, the telemetry, each die where it
// falls; the helper a failed Charm calls, nested in processOrder until this row (the backlash, with the duel's outcome
// stood in); and properties of the spells. The balance matrix never gives a mastery spell, Part Sea, Holy Symbol,
// Clairvoyance, Hide Lairs or Control Undead's scan.
// Level 1: one function, called with what processOrder hands it.
import vm from 'node:vm';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { CAST_SPELL_ORDER_CASES, LANDS, stageCase, type CastSpellOrderCase } from '../lib/cast-spell-order-cases.ts';
import { botWorld, engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { recordExperienceRolls, withCaseDice } from '../lib/espionage-order-cases.ts';
import { companies, item } from '../lib/item-and-army-order-cases.ts';
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
  type Unit,
} from '../lib/middle-of-a-bot-world.ts';
import { plainRealms } from '../lib/recruit-hire-and-realm-works-order-cases.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
const recording = recordExperienceRolls(engine);
type Fn = (...a: unknown[]) => unknown;
const fn = (name: string) => engineFn(engine, name) as Fn;
const provOf = fn('provOf');
const SPELL_DEFS = vm.runInContext('SPELL_DEFS_P', engine) as Record<string, unknown>;

/** The spell item a Use Item names, as processOrder finds it: `{item, spell}`, or null. */
const itemCast = (c: Character, target: string) => {
  const it = c.items.find((x) => String(x['id']) === target || x['name'] === target);
  const effect = it?.['effect'] as { stat?: string; spell?: string } | undefined;
  return it && effect?.stat === 'castSpell' && effect.spell && SPELL_DEFS[effect.spell]
    ? { item: String(it['name']), spell: effect.spell }
    : null;
};
/** One order, as processOrder hands it over in phase `ph`: the Cast Spell function takes the context, then the hero,
 *  the order, the phase, its target and extra, his province, his realm and the spell item he works it from (or null),
 *  in that order. */
const play = (b: Board, c: Character, o: Order, ph = 0) => {
  b.tc._currentPhase = ph;
  b.tc._logCtx = { charId: c.id, phase: ph };
  const prov = provOf(b.tc, c);
  const player = c.player == null ? undefined : b.G.players[c.player];
  const { target, extra } = o;
  const action = fn('normaliseAction')(o) as string; // as processOrder reads it ("Cast Spell" from the order form)
  const castFrom = action === 'use_item' ? itemCast(c, target) : null;
  const call: Record<string, () => unknown> = {
    cast_spell: () => fn('resolveCastSpellOrder')(b.tc, c, o, ph, target, extra, prov, player, null),
    use_item: () =>
      castFrom
        ? fn('resolveCastSpellOrder')(b.tc, c, o, ph, target, extra, prov, player, castFrom)
        : fn('resolveUseItemOrder')(b.tc, c, target, prov),
    vanish: () => fn('resolveVanishOrder')(b.tc, c, prov),
    rest: () => fn('resolveRestOrder')(b.tc, c, prov),
    defend: () => undefined,
  };
  must(call[action], 'the order ' + action)();
  b.tc._logCtx = { charId: null, phase: null };
};
/** Runs `body` with the percentile rolls (d100) given in turn, and every other die at `die`. */
function rolls<T>(d100s: number[], body: () => T, die = 0.99999): T {
  const g = engine as unknown as Record<string, unknown>;
  const was = g['d100'];
  let i = 0;
  g['d100'] = () => must(d100s[i++], 'a d100 roll');
  try {
    return withDice(engine, [die], body);
  } finally {
    g['d100'] = was;
  }
}
const linesOf = (b: Board, c: Character) => b.lines().filter((l: Line) => l.charId === c.id);
const textOf = (b: Board, c: Character) =>
  linesOf(b, c)
    .map((l) => l.text)
    .join('\n');
const allText = (b: Board) =>
  b
    .lines()
    .map((l) => l.text)
    .join('\n');
const fresh = () => {
  const b = board(engine, world, 0);
  plainRealms(b);
  b.G.players.forEach((pl) => {
    pl['heroes'] = [];
  });
  return b;
};
const realm = (b: Board, i = 0) => must(b.G.players[i], 'realm ' + String(i));
const at = (b: Board, skills: Record<string, number> = {}, s: Partial<HeroSpec> = {}) =>
  hero(b, { player: 0, at: b.X, skills: { melee: 2, tactical: 2, march: 1, ...skills }, ...s });
const rival = (b: Board, s: Partial<HeroSpec> = {}, skills: Record<string, number> = {}) =>
  at(b, skills, { player: 1, ...s });
const o = (action: string, target: string | number = '', extra: string | number = ''): Order => ({
  action,
  target: String(target),
  extra: String(extra),
  desc: '',
});
const cast = (spell: string, extra: string | number = '') => o('cast_spell', spell, extra);
const ring1 = (b: Board, i: number) => must(b.ring1[i], 'a neighbour of the middle');
const G_ = (b: Board) => b.G as unknown as Record<string, unknown>;
/** Casts `spell` for `c` in phase `ph`, the order in the turn's list as processOrder reads it. */
const casts = (b: Board, c: Character, spell: string, extra: string | number = '', ph = 0) => {
  const order = cast(spell, extra);
  const list = b.G.turnOrders[c.id] ?? [null, null, null, null, null];
  list[ph] = order;
  b.G.turnOrders[c.id] = list;
  play(b, c, order, ph);
  return order as Order & { _castNotWorked?: boolean };
};

describe.each(CAST_SPELL_ORDER_CASES)('Cast Spell (%s), called directly: the whole-turn cases', (_, cases) => {
  test.each(cases.filter((c) => !c.wholeTurnOnly).map((c) => [c.name, c] as const))(
    '%s',
    (_name, c: CastSpellOrderCase) => {
      const b = board(engine, world, 0);
      const s = stageCase(b, c);
      b.G.turnOrders = Object.fromEntries(s.orders.map(([h, os]) => [h.id, os]));
      const { xp } = recording(() => {
        withCaseDice(engine, c.dice ?? LANDS, () => {
          for (let ph = 0; ph < 5; ph++)
            for (const [h] of s.orders) {
              const next = b.G.turnOrders[h.id]?.[ph];
              if (h.alive && next) play(b, h, next as Order, ph);
            }
        });
      });
      const { got, want } = c.check({ world: b.G, lines: linesOf(b, s.hero), all: b.lines(), turn: b.G.turn, xp }, s);
      expect(got).toEqual(want);
    },
  );
});

/** Runs `body` with personal combat stood in by `end` (the top-level resolveCharVsChar replaced in the vm for the
 *  test's length), recording the plans each side fought on. */
function duelEndsIn<T>(
  end: { atkHp: number; defHp: number; atkKilled?: boolean; defKilled?: boolean; narrative?: string[] },
  body: (plans: string[][][]) => T,
): T {
  const g = engine as unknown as Record<string, unknown>;
  const was = g['resolveCharVsChar'];
  const plans: string[][][] = [];
  g['resolveCharVsChar'] = (_tc: unknown, _a: unknown, _d: unknown, atkPlan: string[], defPlan: string[]) => {
    plans.push([[...atkPlan], [...defPlan]]);
    return { narrative: end.narrative ?? [], atkKilled: false, defKilled: false, ...end };
  };
  try {
    return body(plans);
  } finally {
    g['resolveCharVsChar'] = was;
  }
}
/** Runs `body`, recording each kill credited (the top-level awardKillXP wrapped in the vm for the test's length) as
 *  [killer, slain]. */
function killsIn(body: () => void): [unknown, unknown][] {
  const g = engine as unknown as Record<string, unknown>;
  const was = g['awardKillXP'] as Fn;
  const kills: [unknown, unknown][] = [];
  g['awardKillXP'] = (tc: unknown, killer: Character, slain: Character, ...rest: unknown[]) => {
    kills.push([killer.id, slain.id]);
    return was(tc, killer, slain, ...rest);
  };
  try {
    body();
  } finally {
    g['awardKillXP'] = was;
  }
  return kills;
}

// ── The casting ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('Cast Spell, called directly: the casting', () => {
  test("each cast is recorded in the turn's statistics: phase, realm, hero, spell, school, level, chance, whether it landed, an item", () => {
    const b = fresh();
    const h = at(b, { white: 3 });
    const censer = item(b, 'Censer of Plenty');
    const w = at(b, {});
    w.items = [censer];
    rolls([1, 100], () => {
      casts(b, h, 'Holy Symbol', '', 2);
      casts(b, h, 'Holy Symbol', '', 3);
    });
    rolls([1], () => {
      play(b, w, o('use_item', String(censer['id']), b.X.id), 1);
    });
    const tel = (b.tc['_tel'] as { spells: Record<string, unknown>[] }).spells;
    expect(tel).toEqual([
      { ph: 2, pi: 0, charId: h.id, spell: 'Holy Symbol', school: 'white', lvl: 3, chance: 60, ok: true, item: false },
      { ph: 3, pi: 0, charId: h.id, spell: 'Holy Symbol', school: 'white', lvl: 3, chance: 60, ok: false, item: false },
      {
        ph: 1,
        pi: 0,
        charId: w.id,
        spell: 'Bless Province',
        school: 'white',
        lvl: 3,
        chance: 95,
        ok: true,
        item: true,
      },
    ]);
  });

  test('a cast still works when the statistics have no list for spells', () => {
    const b = fresh();
    b.tc['_tel'] = {};
    const h = at(b, { white: 1 });
    rolls([1], () => casts(b, h, 'Holy Symbol'));
    expect(textOf(b, h)).toContain('there is nothing to cleanse');
  });

  test.each([
    [2, 1, 2],
    [3, 2, 3],
    [4, 3, 4],
  ])(
    'the Warlock (a minor title) casts once more a turn in his best school: White %i, limit %i, then %i',
    (white, plain, warlock) => {
      for (const [holds, want] of [
        [false, plain],
        [true, warlock],
      ] as const) {
        const b = fresh();
        const h = at(b, { white });
        if (holds) G_(b)['_minorHolders'] = { warlock: { charId: h.id } };
        rolls([1, 1, 1, 1, 1], () => {
          for (let ph = 0; ph < 5; ph++) casts(b, h, 'Holy Symbol', '', ph);
        });
        expect(linesOf(b, h).filter((l) => l.text.startsWith(`📊 ${h.name} casts`)).length).toBe(want);
      }
    },
  );

  test("the Warlock's extra cast is only in his best school", () => {
    const b = fresh();
    const h = at(b, { white: 2, psychic: 3 });
    G_(b)['_minorHolders'] = { warlock: { charId: h.id } };
    rolls([1, 1], () => {
      casts(b, h, 'Holy Symbol', '', 0);
      casts(b, h, 'Holy Symbol', '', 1);
    });
    expect(textOf(b, h)).toContain(`${h.name}: White Magic level 2 casting limit (1/1 per turn). Holy Symbol blocked.`);
  });

  test("a charmed enemy hero won't turn hostile magic on his own lord's people, and the refusal spends no slot", () => {
    const b = fresh();
    const h = at(b, { psychic: 2 });
    Object.assign(h, { _charmTempControl: true, _charmOriginalPlayer: 1 });
    const lord = rival(b, {}, { melee: 1 });
    const order = rolls([], () => casts(b, h, 'Psychic Blast', lord.id));
    expect(textOf(b, h)).toContain(
      `${h.name} lets the Psychic Blast die on their lips — the Charm bends their will, but not so far as to turn them on their own lord's people.`,
    );
    expect(order._castNotWorked).toBe(true);
    expect(lord.skills).toEqual({ melee: 1, tactical: 2, march: 1 });
  });

  test("a charmed hero may still turn other spells on his lord's people, and hostile ones on another realm's", () => {
    const b = fresh();
    const h = at(b, { psychic: 4 });
    Object.assign(h, { _charmTempControl: true, _charmOriginalPlayer: 1 });
    const lord = rival(b, {}, { melee: 1 });
    const other = at(b, {}, { player: 2 });
    rolls([1, 1], () => {
      casts(b, h, 'Clairvoyance', lord.id, 0);
      casts(b, h, 'Psychic Blast', other.id, 1);
    });
    expect(textOf(b, h)).toContain(`opens their mind's eye upon ${lord.name}`);
    expect(textOf(b, h)).toContain(`unleashes Psychic Blast — ${other.name}'s mind buckles`);
  });

  test('a hero of his realm named by a pre-order reference (a hero hired, raised or charmed this turn) is found by his id', () => {
    for (const kind of ['hired', 'resurrect', 'charm']) {
      const b = fresh();
      const h = at(b, { psychic: 1 });
      const f = at(b, {}, { troops: 2 });
      rolls([1], () => casts(b, h, 'Oratory', `${kind}_${String(f.id)}_via_${String(h.id)}_ph0`));
      expect(textOf(b, h)).toContain(`lifts ${f.name}'s troops`);
    }
  });

  test('a pre-order reference to a hero nobody knows falls back to the caster himself', () => {
    const b = fresh();
    const h = at(b, { psychic: 1 });
    rolls([1], () => casts(b, h, 'Oratory', `hired_99999_via_${String(h.id)}_ph0`));
    expect(textOf(b, h)).toContain(`lifts their own troops`);
  });

  test('a mastery spell worked last turn may be worked again this turn', () => {
    const b = fresh();
    const h = at(b, { white: 7 });
    h['_masterySpellUsed'] = { Sanctuary: b.G.turn - 1 };
    rolls([1], () => casts(b, h, 'Sanctuary', b.X.id));
    expect(b.X['_sanctuaryTurn']).toBe(b.G.turn);
    expect(h['_masterySpellUsed']).toEqual({ Sanctuary: b.G.turn });
  });

  test("a spell item's cast does not spend the Wailing Phylactery: the hero's own Necromancy spell after it still cannot fail", () => {
    const b = fresh();
    b.own(b.X, 0);
    const h = at(b, { necromancy: 3 });
    const bell = item(b, "Reaper's Bell");
    h.items = [bell, item(b, 'Wailing Phylactery')];
    b.X['battleGraves'] = companies(4);
    rolls([95, 100], () => {
      play(b, h, o('use_item', String(bell['id'])), 0);
      casts(b, h, 'Skeletal Armies', '', 1);
    });
    const t = textOf(b, h);
    expect(t).toContain(`casts Skeletal Armies (Necromancy 3): 95% chance [roll 95 ✓]`);
    expect(t).toContain(`casts Skeletal Armies (Necromancy 3): 100% chance [roll 100 ✓]`);
    expect(h['_necroAutoUsed']).toBe(true);
  });

  test('a cast refused at the casting limit, for want of skill or a mastery spell twice is marked as never worked', () => {
    const b = fresh();
    const h = at(b, { white: 7, psychic: 0 });
    const refused = rolls([1, 1], () => [
      casts(b, h, 'Sanctuary', b.X.id, 0),
      casts(b, h, 'Sanctuary', b.X.id, 1),
      casts(b, h, 'Oratory', '', 2),
    ]);
    expect(refused.map((x) => !!x._castNotWorked)).toEqual([false, true, true]);
  });
});

// ── What the turn's end takes back, seen mid-turn ───────────────────────────────────────────────────────────────
describe("Cast Spell, called directly: the spells' marks before the turn's end", () => {
  test('Part Sea: the parted sea is dry ground ("plains") marked with what it was, and fleets are barred from the next phase', () => {
    const b = fresh();
    const sea = ring1(b, 0);
    sea.terrain = 'sea';
    sea['_flooded'] = true;
    const h = at(b, { white: 1 });
    rolls([1], () => casts(b, h, 'Part Sea', sea.id, 2));
    expect([sea.terrain, sea['_partSea'], sea['_flooded']]).toEqual([
      'plains',
      { orig: 'sea', turn: b.G.turn, blockFleetsFromPhase: 3 },
      undefined,
    ]);
  });

  test('Flood: the province is sea, marked with what it was; on a parted sea, the parting is undone and "plains" is kept as what it was', () => {
    const b = fresh();
    const p = ring1(b, 0);
    const sea = ring1(b, 1);
    sea.terrain = 'sea';
    const h = at(b, { white: 1, elemental: 3 });
    rolls([1, 1, 1], () => {
      casts(b, h, 'Flood', p.id, 0);
      casts(b, h, 'Part Sea', sea.id, 1);
      casts(b, h, 'Flood', sea.id, 2);
    });
    expect([p.terrain, p['_flood']]).toEqual(['sea', { orig: 'plain', turn: b.G.turn }]);
    expect([sea.terrain, sea['_partSea'], sea['_flood']]).toEqual([
      'sea',
      undefined,
      { orig: 'plains', turn: b.G.turn },
    ]);
  });

  test.each([
    [0, 'Air Elemental', 'the Howling Gale'],
    [0.2, 'Fire Elemental', 'the Living Conflagration'],
    [0.4, 'Earth Elemental', 'the Walking Mountain'],
    [0.6, 'Water Elemental', 'the Surging Tide'],
    [0.8, 'Darkness Elemental', 'the Devouring Shade'],
  ])('Elemental Summon: a die of %f calls a %s (%s), a Veteran that lasts the turn', (die, type, unitName) => {
    const b = fresh();
    b.own(b.X, 0);
    const h = at(b, { elemental: 1 });
    rolls([1], () => casts(b, h, 'Elemental Summon'), die);
    expect(h.armies).toEqual([
      { type, quality: 'Veteran', race: 'Elemental', unitName, _temporary: true, _expiresAfterPhase: -1 },
    ]);
    expect(h['_elementalSummonedThisTurn']).toBe(true);
  });

  test('Clairvoyance: a new casting replaces the old, and the watch runs from the phase it was cast', () => {
    const b = fresh();
    const h = at(b, { psychic: 3 });
    const m1 = rival(b);
    const m2 = rival(b);
    m2['_clairvoyantBy'] = [2];
    rolls([1, 1], () => {
      casts(b, h, 'Clairvoyance', m1.id, 0);
      casts(b, h, 'Clairvoyance', m2.id, 1);
    });
    expect([m1['_clairvoyantBy'], m2['_clairvoyantBy']]).toEqual([[], [2, 0]]);
    expect((b.tc['clairWatch'] as Record<number, unknown>)[0]).toEqual({ charId: m2.id, fromPhase: 1 });
    expect(realm(b)['_clairCharThisTurn']).toBe(m2.id);
  });

  test.each([
    ['plain', [0.4], 'sea'],
    ['plain', [0.6, 0], 'forest'],
    ['plain', [0.6, 0.5], 'mountain'],
    ['forest', [0.6, 0], 'plain'],
    ['sea', [0.4, 0.3], 'forest'],
    ['sea', [0.4, 0.8], 'desert'],
    ['sea', [0.6], 'sea'],
  ])('Illusory Terrain: %s ground, dice %j, seems %s', (terrain, dice, fake) => {
    const b = fresh();
    b.X.terrain = terrain;
    const h = at(b, { illusory: 1 });
    const g = engine as unknown as Record<string, unknown>;
    const was = g['d100'];
    g['d100'] = () => 1;
    try {
      withDice(engine, dice, () => casts(b, h, 'Illusory Terrain', b.X.id));
    } finally {
      g['d100'] = was;
    }
    expect(b.X['_illusoryTerrain']).toEqual({ caster: 0, fake, appliedTurn: b.G.turn });
  });

  test('Oratory, Curse, phantoms, Invisibility and a Veil leave their marks on the hero for the turn', () => {
    const b = fresh();
    const h = at(b, { psychic: 6, illusory: 9, necromancy: 1 }, { troops: 10 });
    const m = rival(b);
    m.skills = { melee: 5 };
    rolls([1, 1, 1, 1, 1, 50], () => {
      casts(b, h, 'Oratory', '', 0);
      casts(b, h, 'Curse', m.id, 0);
      casts(b, h, 'Phantasmal Armies', '', 1);
      casts(b, h, 'Veil', '', 2);
      casts(b, h, 'Invisibility', '', 3);
    });
    expect(h['_oratoryBoost']).toBe(2);
    expect(m['_curses']).toEqual({ melee: 3 });
    expect((h['_phantoms'] as Unit[]).length).toBe(5);
    expect([h['_veilTurn'], h['_veilCastPhase'], h['_invisTurn']]).toEqual([b.G.turn, 2, b.G.turn]);
  });

  test("Phantasmal Armies' phantoms copy their company, tagged to it, and number the tags across the turn", () => {
    const b = fresh();
    const h = at(b, { illusory: 1 });
    h.armies = companies(10, 'Men-at-Arms', 'Crack');
    G_(b)['_phSeq'] = 4;
    rolls([1], () => casts(b, h, 'Phantasmal Armies'), 0);
    const tagged = h.armies.filter((u) => u['_phTag']);
    expect(tagged.map((u) => u['_phTag'])).toEqual(['ph5']);
    expect(h['_phantoms']).toEqual([
      { type: 'Men-at-Arms', quality: 'Crack', race: 'Human', unitName: tagged[0]?.unitName, _phantomOf: 'ph5' },
    ]);
  });
});

// ── Resurrect and Charm: the orders a realm wrote, and the guards a whole turn never reaches ─────────────────────
/** A fallen hero of `player` in the middle, his grave in the graveyard. */
const fallen = (b: Board, s: Partial<HeroSpec> = {}, grave: Record<string, unknown> = {}) => {
  const d = at(b, {}, s);
  d.alive = false;
  b.X.characters = b.X.characters.filter((id) => id !== d.id);
  const graves = (G_(b)['heroGraveyard'] as Record<string, unknown>[] | undefined) ?? [];
  G_(b)['heroGraveyard'] = [
    ...graves,
    {
      id: d.id,
      name: d.name,
      player: d.player,
      isKing: false,
      killedOnTurn: 0,
      location: b.X.id,
      served: [d.player],
      ...grave,
    },
  ];
  return d;
};
describe('Resurrect and Charm, called directly', () => {
  test('Resurrect: a body already raised this turn is not raised twice', () => {
    const b = fresh();
    const d = fallen(b);
    G_(b)['_resurrectedThisTurn'] = [d.id];
    const h = at(b, { white: 3 });
    rolls([1], () => casts(b, h, 'Resurrect', d.id));
    expect(textOf(b, h)).toContain(`${h.name}: ${d.name} has already been raised this turn.`);
    expect(d.alive).toBe(false);
  });

  test('Resurrect: a hero who is a king, though his grave does not say so, cannot be raised', () => {
    const b = fresh();
    const d = fallen(b, { king: true });
    const h = at(b, { white: 3 });
    rolls([1], () => casts(b, h, 'Resurrect', d.id));
    expect(textOf(b, h)).toContain(`${h.name}: kings cannot be resurrected.`);
    expect(d.alive).toBe(false);
  });

  test('Resurrect: with no graveyard at all, it is made, and nobody lies here', () => {
    const b = fresh();
    const h = at(b, { white: 3 });
    rolls([1], () => casts(b, h, 'Resurrect'));
    expect(G_(b)['heroGraveyard']).toEqual([]);
    expect(G_(b)['_resurrectedThisTurn']).toEqual([]);
    expect(textOf(b, h)).toContain(`no fallen hero you know of lies in ${b.X.name}`);
  });

  test('Resurrect: a body elsewhere is out of reach even when named and known', () => {
    const b = fresh();
    const d = fallen(b, {}, { location: ring1(b, 0).id });
    realm(b)['knownDeadHeroIds'] = [d.id];
    const h = at(b, { white: 3 });
    rolls([1], () => casts(b, h, 'Resurrect', d.id));
    expect(d.alive).toBe(false);
  });

  test("Resurrect: the realm's orders for the raised hero apply after the cast only; the rest of the turn is Defend; the caster's own card wins", () => {
    const b = fresh();
    const d = fallen(b);
    const h = at(b, { white: 3 });
    const other = at(b, { white: 1 });
    const mine = [o('rest'), o('rest'), o('explore'), o('defend'), null];
    const theirs = [o('rest'), o('rest'), o('rest'), o('rest'), o('rest')];
    G_(b)['_pendingResurrectOrders'] = [
      { heroId: d.id, casterId: other.id, castPhase: 1, player: 0, orders: theirs },
      { heroId: d.id, casterId: h.id, castPhase: 1, player: 0, orders: mine },
      { heroId: d.id, casterId: h.id, castPhase: 1, player: 1, orders: theirs },
    ];
    rolls([1], () => casts(b, h, 'Resurrect', d.id, 1));
    expect(b.G.turnOrders[d.id]).toEqual([
      null,
      null,
      mine[2],
      { action: 'defend', target: '', extra: '', desc: 'Defend' },
      { action: 'defend', target: '', extra: '', desc: 'Defend' },
    ]);
    expect(textOf(b, h)).toContain(
      `${d.name} takes up the orders ${realm(b).name} laid down for them — 1 phase of this turn remain to be acted on.`,
    );
  });

  test("Resurrect: another caster's card of the realm applies when the caster wrote none", () => {
    const b = fresh();
    const d = fallen(b);
    const h = at(b, { white: 3 });
    const other = at(b, { white: 1 });
    G_(b)['_pendingResurrectOrders'] = [
      { heroId: d.id, casterId: other.id, castPhase: 0, player: 0, orders: [null, o('explore'), null, null, null] },
    ];
    rolls([1], () => casts(b, h, 'Resurrect', d.id, 0));
    expect(b.G.turnOrders[d.id]?.[1]).toEqual(o('explore'));
  });

  test('Resurrect: a raised hero is put in the province once, and the graveyard forgets him', () => {
    const b = fresh();
    const d = fallen(b);
    b.X.characters.push(d.id);
    const h = at(b, { white: 3 });
    rolls([1], () => casts(b, h, 'Resurrect', d.id));
    expect(b.X.characters.filter((id) => id === d.id).length).toBe(1);
    expect(G_(b)['heroGraveyard']).toEqual([]);
    expect(G_(b)['_resurrectedThisTurn']).toEqual([d.id]);
    expect([d['killedThisTurn'], d['_justDefeated']]).toEqual([false, false]);
  });

  test("Charm: the realm's orders for the swayed hero apply after the cast only (the caster's own card); the rest is Defend; he can move at once", () => {
    const b = fresh();
    const w = at(b, {}, { player: null });
    w['alignment'] = 'Neutral';
    Object.assign(w, { _defend: { active: true }, _pursuit: { active: true, targetId: 1 }, _defendReactedPhase: 0 });
    const h = at(b, { psychic: 2 });
    const other = at(b, { psychic: 1 });
    G_(b)['_pendingCharmOrders'] = [
      { heroId: w.id, casterId: other.id, castPhase: 0, player: 0, orders: [null, o('rest'), o('rest'), null, null] },
      {
        heroId: w.id,
        casterId: h.id,
        castPhase: 0,
        player: 0,
        orders: [o('rest'), o('explore'), null, o('defend'), null],
      },
    ];
    rolls([1], () => casts(b, h, 'Charm', w.id, 0));
    expect(b.G.turnOrders[w.id]).toEqual([
      null,
      o('explore'),
      { action: 'defend', target: '', extra: '', desc: 'Defend' },
      { action: 'defend', target: '', extra: '', desc: 'Defend' },
      { action: 'defend', target: '', extra: '', desc: 'Defend' },
    ]);
    expect([w['_defend'], w['_pursuit'], w['_defendReactedPhase']]).toEqual([undefined, undefined, undefined]);
    expect((b.tc['movePoints'] as Record<number, number>)[w.id]).toBeGreaterThan(0);
    expect([w.player, w['hiredInPhase'], w['_charmedTurn']]).toEqual([0, 0, b.G.turn]);
  });

  test('Charm: an enemy hero seized is marked as charmed by the realm, from the phase of the cast, his own lord remembered', () => {
    const b = fresh();
    const m = rival(b);
    const h = at(b, { psychic: 2 });
    rolls([1], () => casts(b, h, 'Charm', m.id, 2));
    expect([
      m.player,
      m['_charmOriginalPlayer'],
      m['_charmedByPlayer'],
      m['_charmedForPhase'],
      m['_charmTempControl'],
      m['_charmControlFrom'],
      m['_charmedTurn'],
    ]).toEqual([0, 1, 0, 2, true, 2, b.G.turn]);
  });

  test('Charm: the resistance never passes 95%', () => {
    const b = fresh();
    const w = at(b, {}, { player: null });
    w['alignment'] = 'Neutral';
    w['_charmResist'] = 80;
    const h = at(b, { psychic: 2 });
    rolls([1, 90], () => casts(b, h, 'Charm', w.id));
    expect(w['_charmResist']).toBe(95);
  });
});

// ── The Charm's backlash (charmBacklash) ────────────────────────────────────────────────────────────────────────
describe('a failed Charm brings the hero down on the caster (charmBacklash), called directly', () => {
  const backlash = (b: Board, caster: Character, t: Character, why = { kind: 'the Charm fizzled' }) => {
    b.tc._logCtx = { charId: caster.id, phase: 0 };
    return fn('charmBacklash')(b.tc, b.X, caster, t, why);
  };
  const pair = (b: Board) => {
    const caster = at(b, { psychic: 2 });
    const t = rival(b);
    caster['encounterPlan'] = { tactics: ['ME'], duelStance: 'accept' };
    t['encounterPlan'] = { tactics: ['ME'], duelStance: 'accept' };
    return { caster, t };
  };
  test('no roll at all when the hero has gone, or fallen', () => {
    for (const how of ['gone', 'fallen']) {
      const b = fresh();
      const { caster, t } = pair(b);
      if (how === 'gone') t.location = ring1(b, 0).id;
      else t.alive = false;
      rolls([], () => backlash(b, caster, t));
      expect(b.lines()).toEqual([]);
    }
  });
  test.each([
    [50, true],
    [51, false],
  ])('a roll of %i: a fight is %s', (roll, fights) => {
    const b = fresh();
    const { caster, t } = pair(b);
    duelEndsIn({ atkHp: 10, defHp: 10 }, (plans) => {
      rolls([roll], () => backlash(b, caster, t, { kind: 'the Charm was resisted' }));
      expect(plans.length).toBe(fights ? 1 : 0);
    });
    expect(allText(b)).toContain(
      `📊 Charm backlash — ${t.name} may turn on ${caster.name} (the Charm was resisted): 50% [roll ${String(roll)} ${fights ? '✓' : '✗'}]`,
    );
    expect(b.X['_combatPlayersThisTurn'] ?? []).toEqual(fights ? [0, 1] : []);
  });
  test('either side leading with Flee: no fight, and the one slipping away is named', () => {
    for (const who of ['caster', 't'] as const) {
      const b = fresh();
      const p = pair(b);
      p[who]['encounterPlan'] = { tactics: ['FLEE', 'ME'], duelStance: 'accept' };
      duelEndsIn({ atkHp: 10, defHp: 10 }, (plans) => {
        rolls([1], () => backlash(b, p.caster, p.t));
        expect(plans).toEqual([]);
      });
      expect(allText(b)).toContain(
        `${p.t.name} rounds on ${p.caster.name} as the enchantment fails — but ${p[who].name} is already slipping away, and there is no encounter.`,
      );
    }
  });
  test("the duel is fought on each side's combat tactics only (a spell as cast kept); none left means Melee", () => {
    const b = fresh();
    const { caster, t } = pair(b);
    t['encounterPlan'] = { tactics: ['AR', 'XX', 'CA:Fireball', 'ME'], duelStance: 'accept' };
    caster['encounterPlan'] = { tactics: ['XX', 'YY'], duelStance: 'accept' };
    duelEndsIn({ atkHp: 10, defHp: 10 }, (plans) => {
      rolls([1], () => backlash(b, caster, t));
      expect(plans).toEqual([[['AR', 'CA:Fireball', 'ME'], ['ME']]]);
    });
  });
  test("the duel's HP stand, at least 1, for both; a wanderer's HP are not his to lose", () => {
    const b = fresh();
    const { caster, t } = pair(b);
    duelEndsIn({ atkHp: 3, defHp: 7 }, () => rolls([1], () => backlash(b, caster, t)));
    expect([t.hp, caster.hp, t.alive, caster.alive]).toEqual([3, 7, true, true]);
    const b2 = fresh();
    const p2 = pair(b2);
    p2.t.player = null;
    duelEndsIn({ atkHp: 3, defHp: 5 }, () => rolls([1], () => backlash(b2, p2.caster, p2.t)));
    expect([p2.t.hp, p2.caster.hp]).toEqual([20, 5]);
  });
  test('a blow past 0 HP leaves the fallen at 1 HP, not below', () => {
    const b = fresh();
    const { caster, t } = pair(b);
    duelEndsIn({ atkHp: -3, defHp: -2 }, () => rolls([1], () => backlash(b, caster, t)));
    // the kill credited to the caster first is worth a point of HP to him, so his count is 1 or more
    expect([t.hp, caster.hp >= 1, t.alive, caster.alive]).toEqual([1, true, false, false]);
  });
  test("the hero who turned on the caster is cut down: the kill is the caster's", () => {
    const b = fresh();
    const { caster, t } = pair(b);
    const kills = killsIn(() =>
      duelEndsIn({ atkHp: 0, defHp: 9, atkKilled: true }, () => rolls([1], () => backlash(b, caster, t))),
    );
    expect(t.alive).toBe(false);
    expect(kills).toEqual([[caster.id, t.id]]);
    expect(allText(b)).toContain(`${t.name} is cut down by the enchanter they turned on.`);
  });
  test("the caster is slain: the kill is the hero's", () => {
    const b = fresh();
    const { caster, t } = pair(b);
    const kills = killsIn(() =>
      duelEndsIn({ atkHp: 9, defHp: 0, defKilled: true }, () => rolls([1], () => backlash(b, caster, t))),
    );
    expect(caster.alive).toBe(false);
    expect(kills).toEqual([[t.id, caster.id]]);
    expect(allText(b)).toContain(`${caster.name} is slain — the failed Charm was their last spell.`);
  });
  test('one who cannot be killed escapes the end, at 1 HP, credited to nobody', () => {
    for (const who of ['caster', 't'] as const) {
      const b = fresh();
      const p = pair(b);
      p[who]['_unkillable'] = true;
      const end = who === 't' ? { atkHp: 0, defHp: 9, atkKilled: true } : { atkHp: 9, defHp: 0, defKilled: true };
      const kills = killsIn(() => duelEndsIn(end, () => rolls([1], () => backlash(b, p.caster, p.t))));
      expect([p[who].alive, p[who].hp, kills]).toEqual([true, 1, []]);
    }
  });
  test("the fight's lines go to both realms, the drawing of blades in public", () => {
    const b = fresh();
    const { caster, t } = pair(b);
    duelEndsIn({ atkHp: 9, defHp: 9, narrative: ['They clash.'] }, () => rolls([1], () => backlash(b, caster, t)));
    const drawn = b.lines().find((l) => l.text.includes('blades are drawn'));
    expect([drawn?.targets, drawn?.['public'], drawn?.['charIds']]).toEqual([[0, 1], true, [t.id, caster.id]]);
    expect(b.lines().find((l) => l.text === 'They clash.')?.targets).toEqual([0, 1]);
  });
});

// ── Properties ──────────────────────────────────────────────────────────────────────────────────────────────────
const seed = Number(process.env['KC_SEED']) >>> 0 || 1;
const TIERS = ['Green', 'Average', 'Veteran', 'Crack', 'Elite'];
const tier = (q: unknown) => TIERS.indexOf(String(q));
const LIMIT = (level: number) => (level >= 4 ? 3 : level >= 3 ? 2 : 1);
/** The cast chance: 30% and 10% a level, the level counted to 5, and 10% more at level 8 (a school's Magic Level 8), to
 *  95% at most. */
const CHANCE = (level: number) => Math.min(95, 30 + 10 * Math.min(5, level) + (level >= 8 ? 10 : 0));
const aCompany = fc.record({ quality: fc.constantFrom(...TIERS), skeletal: fc.boolean() });
const raise = (spec: { quality: string; skeletal: boolean }[], label = 'Foe'): Unit[] =>
  spec.map((x, k) => ({
    type: 'Men-at-Arms',
    quality: x.quality,
    race: 'Human',
    unitName: `${label} c${String(k)}`,
    ...(x.skeletal ? { _isSkeletal: true } : {}),
  }));
describe('Cast Spell, called directly: properties', () => {
  test('the casting limit: of k casts of one school in a turn, min(k, 1 / 2 / 3 by level) are rolled; the level shown and the chance count it to 5, with 10% more at level 8', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 9 }), fc.integer({ min: 1, max: 5 }), (level, k) => {
        const b = fresh();
        const h = at(b, { white: level });
        rolls([1, 1, 1, 1, 1], () => {
          for (let ph = 0; ph < k; ph++) casts(b, h, 'Holy Symbol', '', ph);
        });
        const rolled = linesOf(b, h).filter((l) => l.text.startsWith(`📊 ${h.name} casts`));
        expect(rolled.length).toBe(Math.min(k, LIMIT(level)));
        expect(
          rolled.every((l) =>
            l.text.includes(`(White Magic ${String(Math.min(5, level))}): ${String(CHANCE(level))}% chance`),
          ),
        ).toBe(true);
      }),
      { seed, numRuns: 60 },
    );
  });

  test('a cast lands exactly when its roll is within the chance, and only then does the spell work', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 9 }), fc.integer({ min: 1, max: 100 }), (level, roll) => {
        const b = fresh();
        const h = at(b, { white: level });
        rolls([roll], () => casts(b, h, 'Bless Province', b.X.id));
        expect(b.X['_blessedTurn'] === b.G.turn).toBe(roll <= CHANCE(level));
      }),
      { seed, numRuns: 80 },
    );
  });

  test('Curse: each skill is halved, rounded down, cast after cast; the skills themselves never change', () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.constantFrom('melee', 'tactical', 'march', 'spy', 'sage'), fc.integer({ min: 0, max: 9 })),
        fc.integer({ min: 1, max: 3 }),
        (skills, k) => {
          const b = fresh();
          const m = rival(b);
          m.skills = { ...skills };
          const h = at(b, { necromancy: 5 });
          rolls([1, 1, 1], () => {
            for (let ph = 0; ph < k; ph++) casts(b, h, 'Curse', m.id, ph);
          });
          const curses = (m['_curses'] as Record<string, number> | undefined) ?? {};
          for (const [sk, v] of Object.entries(skills)) {
            let now = v;
            for (let i = 0; i < k; i++) now = Math.floor(now / 2);
            expect(v - (curses[sk] ?? 0)).toBe(v > 0 ? now : v);
          }
          expect(m.skills).toEqual(skills);
        },
      ),
      { seed, numRuns: 60 },
    );
  });

  test('Psychic Blast: the skills fall by two levels in all (or all there are), none below 0', () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.constantFrom('melee', 'tactical', 'march', 'spy', 'sage'), fc.integer({ min: 0, max: 3 })),
        fc.double({ min: 0, max: 0.99999, noNaN: true }),
        (skills, die) => {
          const b = fresh();
          const m = rival(b);
          m.skills = { ...skills };
          const h = at(b, { psychic: 1 });
          const sum = (x: Record<string, number>) => Object.values(x).reduce((a, v) => a + v, 0);
          rolls([1], () => casts(b, h, 'Psychic Blast', m.id), die);
          expect(sum(skills) - sum(m.skills)).toBe(Math.min(2, sum(skills)));
          expect(Object.values(m.skills).every((v) => v >= 0)).toBe(true);
        },
      ),
      { seed, numRuns: 80 },
    );
  });

  test('Telekinetic Storm: min(level to 5, companies) are caught; each drops one tier, the Green and the dead are gone; no other changes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9 }),
        fc.array(aCompany, { minLength: 1, maxLength: 8 }),
        fc.double({ min: 0, max: 0.99999, noNaN: true }),
        (level, spec, die) => {
          const b = fresh();
          const m = rival(b);
          m.armies = raise(spec);
          const before = new Map(m.armies.map((u) => [u.unitName, { ...u }]));
          const h = at(b, { psychic: level });
          rolls([1], () => casts(b, h, 'Telekinetic Storm', m.id), die);
          const n = Math.min(Math.min(level, 5), spec.length);
          // each company struck, as what became of it: gone (only the Green and the dead may go) or one tier down
          const struck = [...before].flatMap(([name, u]) => {
            const now = m.armies.find((x) => x.unitName === name);
            if (!now) return [u['_isSkeletal'] === true || u.quality === 'Green' ? 'gone' : 'gone wrongly'];
            if (now.quality === u.quality) return [];
            return [tier(now.quality) === tier(u.quality) - 1 ? 'down a tier' : 'changed wrongly'];
          });
          expect(struck.length).toBe(n);
          expect(struck.filter((x) => x.endsWith('wrongly'))).toEqual([]);
        },
      ),
      { seed, numRuns: 80 },
    );
  });

  test('Dominate: a quarter (at least one) of his companies change hands, none made or lost', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 0, max: 3 }),
        fc.double({ min: 0, max: 0.99999, noNaN: true }),
        (n, own, die) => {
          const b = fresh();
          const m = rival(b);
          m.armies = companies(n, 'Men-at-Arms', 'Veteran', 'Foe');
          const h = at(b, { psychic: 9 }, { troops: own });
          const g = engine as unknown as Record<string, unknown>;
          const was = g['resolveUnitGainInProvince'];
          g['resolveUnitGainInProvince'] = () => undefined;
          try {
            rolls([1], () => casts(b, h, 'Dominate', m.id), die);
          } finally {
            g['resolveUnitGainInProvince'] = was;
          }
          const take = Math.max(1, Math.floor(n * 0.25));
          expect([m.armies.length, h.armies.length]).toEqual([n - take, own + take]);
        },
      ),
      { seed, numRuns: 60 },
    );
  });

  test('Chain Lightning: of three tenths of his companies caught, those blasted are gone, no more', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), fc.double({ min: 0, max: 0.99999, noNaN: true }), (n, die) => {
        const b = fresh();
        const m = rival(b);
        m.armies = companies(n);
        const h = at(b, { elemental: 7 });
        rolls([1], () => casts(b, h, 'Chain Lightning', m.id), die);
        const pool = Math.floor(n * 0.3);
        const killed = n - m.armies.length;
        expect(killed).toBe(die < 0.5 ? pool : 0);
      }),
      { seed, numRuns: 60 },
    );
  });

  test('Divine Judgment: 10 and 3 a level (to 5) of damage, never below 1 HP; 2 and one each two levels of companies smitten', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 9, max: 12 }),
        fc.integer({ min: 1, max: 60 }),
        fc.integer({ min: 0, max: 8 }),
        (level, hp, n) => {
          const b = fresh();
          const m = rival(b, { hp });
          m.armies = companies(n);
          const h = at(b, { white: level });
          rolls([1], () => casts(b, h, 'Divine Judgment', m.id));
          expect([m.hp, m.armies.length]).toEqual([Math.max(1, hp - 25), n - Math.min(n, 4)]);
        },
      ),
      { seed, numRuns: 40 },
    );
  });

  test("Skeletal Armies and Death's Dominion raise as many as their level allows (never more than lie there), the best dead first; none are lost", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9 }),
        fc.array(fc.constantFrom(...TIERS), { maxLength: 7 }),
        fc.boolean(),
        (level, qualities, dominion) => {
          const b = fresh();
          b.own(b.X, 0);
          b.X['battleGraves'] = qualities.map((q, k) => ({
            type: 'Men-at-Arms',
            quality: q,
            race: 'Human',
            unitName: `Dead c${String(k)}`,
          }));
          const h = at(b, { necromancy: dominion ? Math.max(9, level) : level });
          rolls([1], () => casts(b, h, dominion ? "Death's Dominion" : 'Skeletal Armies'));
          const want = dominion ? Math.min(5, Math.max(9, level)) : level >= 5 ? 3 : level >= 3 ? 2 : 1;
          const raised = Math.min(qualities.length, want);
          const left = (b.X['battleGraves'] as Unit[]).map((g) => tier(g.quality));
          expect([h.armies.length, left.length]).toEqual([raised, qualities.length - raised]);
          const taken = [...qualities]
            .map(tier)
            .sort((a, c) => c - a)
            .slice(0, raised);
          expect(Math.min(...taken, 9)).toBeGreaterThanOrEqual(Math.max(...left, -1));
        },
      ),
      { seed, numRuns: 80 },
    );
  });

  test('Bless Province: the ward is 50% and 5% a White level to 5; the tax rises by 60, 80 (Divine) or 100 (a Divine king)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9 }),
        fc.constantFrom('Divine', 'Neutral', 'Undead'),
        fc.boolean(),
        (level, alignment, king) => {
          const b = fresh();
          realm(b)['alignment'] = alignment;
          const h = at(b, { white: level }, { king });
          rolls([1], () => casts(b, h, 'Bless Province', b.X.id));
          expect(b.X['_blessWardPct']).toBe(50 + 5 * Math.min(5, level));
          expect(b.X['_blessedMult']).toBe(alignment === 'Divine' ? (king ? 2 : 1.8) : 1.6);
        },
      ),
      { seed, numRuns: 60 },
    );
  });

  test("a hostile spell on another realm's hero never touches a hero of his own realm", () => {
    const SPELLS = [
      'Psychic Blast',
      'Telekinetic Storm',
      'Curse',
      'Charm',
      'Control Undead',
      'Mass Confusion',
      'Dominate',
      'Chain Lightning',
      'Divine Judgment',
    ];
    fc.assert(
      fc.property(fc.constantFrom(...SPELLS), (spell) => {
        const b = fresh();
        const f = at(b, { melee: 3 }, { troops: 4 });
        const before = JSON.stringify(f);
        const h = at(b, { white: 9, psychic: 9, necromancy: 9, elemental: 9 });
        rolls([1, 1], () => casts(b, h, spell, f.id));
        expect(JSON.stringify(f)).toBe(before);
      }),
      { seed, numRuns: 30 },
    );
  });
});

// ── What the planted faults asked for: details only a direct call shows ────────────────────────────────────────
describe('Cast Spell, called directly: the details', () => {
  test("the backlash roll is the caster's realm's to see; a hero with no encounter plan is given one; a plan with no combat tactic fights in Melee", () => {
    const b = fresh();
    const caster = at(b, { psychic: 2 });
    caster['encounterPlan'] = { tactics: ['ME'], duelStance: 'accept' };
    const t = at(b, {}, { player: null });
    delete t['encounterPlan'];
    duelEndsIn({ atkHp: 9, defHp: 9 }, (plans) => {
      rolls([1], () => {
        b.tc._logCtx = { charId: caster.id, phase: 0 };
        fn('charmBacklash')(b.tc, b.X, caster, t, { kind: 'the Charm fizzled' });
      });
      // a wanderer with no plan of his own is given one, as any neutral hero is (ensureEncounterPlan)
      const own = (t['encounterPlan'] as { tactics: string[]; _auto?: boolean } | undefined) ?? { tactics: [] };
      expect([own._auto, plans.length]).toEqual([true, 1]);
    });
    expect(b.lines().find((l) => l.text.startsWith('📊 Charm backlash'))?.targets).toEqual([0]);
    const b2 = fresh();
    const c2 = at(b2, { psychic: 2 });
    c2['encounterPlan'] = { tactics: ['ME'], duelStance: 'accept' };
    const t2 = rival(b2);
    t2['encounterPlan'] = { tactics: ['XX', 'YY'], duelStance: 'accept' };
    duelEndsIn({ atkHp: 9, defHp: 9 }, (plans) => {
      rolls([1], () => fn('charmBacklash')(b2.tc, b2.X, c2, t2, { kind: 'the Charm fizzled' }));
      expect(plans).toEqual([[['ME'], ['ME']]]);
    });
  });

  test('a cast whose roll equals its chance is recorded as landed', () => {
    const b = fresh();
    const h = at(b, { white: 2 });
    rolls([50], () => casts(b, h, 'Holy Symbol'));
    expect((b.tc['_tel'] as { spells: { ok: boolean }[] }).spells.map((x) => x.ok)).toEqual([true]);
  });

  test("a pre-order reference to a hero nobody knows aims a province spell at the caster's own ground", () => {
    const b = fresh();
    const h = at(b, { white: 1 });
    rolls([1], () => casts(b, h, 'Bless Province', `hired_99999_via_${String(h.id)}_ph0`));
    expect(b.X['_blessedTurn']).toBe(b.G.turn);
  });

  test('Resurrect with no graveyard in the save does not fail', () => {
    const b = fresh();
    delete G_(b)['heroGraveyard'];
    delete G_(b)['_resurrectedThisTurn'];
    const h = at(b, { white: 3 });
    rolls([1], () => casts(b, h, 'Resurrect'));
    expect([G_(b)['heroGraveyard'], G_(b)['_resurrectedThisTurn']]).toEqual([[], []]);
    expect(textOf(b, h)).toContain('no fallen hero you know of lies in');
  });

  test('Charm aimed by a pre-order reference at a hero standing elsewhere finds nobody here', () => {
    const b = fresh();
    const w = at(b, {}, { player: null, at: ring1(b, 0) });
    const h = at(b, { psychic: 2 });
    rolls([1], () => casts(b, h, 'Charm', `charm_${String(w.id)}_via_${String(h.id)}_ph0`));
    expect(textOf(b, h)).toContain(`Charm: no valid target hero stands in ${b.X.name} this phase.`);
    expect(w.player).toBe(null);
  });

  test("Charm: last turn's immunity is cleared even when the Charm is then resisted", () => {
    const b = fresh();
    const m = rival(b);
    m['encounterPlan'] = { tactics: ['FL'], duelStance: 'refuse' };
    Object.assign(m, { _charmImmuneTurn: b.G.turn - 1, _charmResist: 30 });
    const h = at(b, { psychic: 2 });
    rolls([1, 1, 99], () => casts(b, h, 'Charm', m.id));
    expect(textOf(b, h)).toContain('breaks against');
    expect(m['_charmImmuneTurn']).toBeUndefined();
  });

  test('Charm: a swayed wanderer is given his movement for the rest of the turn', () => {
    const b = fresh();
    const w = at(b, {}, { player: null });
    w['alignment'] = 'Neutral';
    (b.tc['movePoints'] as Record<number, number>)[w.id] = 0;
    const h = at(b, { psychic: 2 });
    rolls([1], () => casts(b, h, 'Charm', w.id));
    expect((b.tc['movePoints'] as Record<number, number>)[w.id]).toBeGreaterThan(0);
  });

  test('Clairvoyance on a fallen hero names where his grave lies, not where he fell; a read keeps the skills as they were', () => {
    const b = fresh();
    const d = fallen(b, { player: 1 }, { location: ring1(b, 0).id });
    const h = at(b, { psychic: 3 });
    const m = rival(b, {}, { melee: 3 });
    rolls([1, 1], () => {
      casts(b, h, 'Clairvoyance', d.id, 0);
      casts(b, h, 'Clairvoyance', m.id, 1);
    });
    expect(textOf(b, h)).toContain(`Their body lies in ${ring1(b, 0).name}.`);
    m.skills['melee'] = 9;
    const read = (realm(b)['_spiedHeroSkills'] as Record<number, { skills: Record<string, number> }>)[m.id];
    expect(read?.skills['melee']).toBe(3);
  });

  test('Telekinetic Storm: the die picks which companies are caught (at its lowest, not the first)', () => {
    const picked = (die: number) => {
      const b = fresh();
      const m = rival(b);
      m.armies = companies(3, 'Men-at-Arms', 'Elite', 'Guard');
      const h = at(b, { psychic: 1 });
      rolls([1], () => casts(b, h, 'Telekinetic Storm', m.id), die);
      return m.armies.filter((u) => u.quality !== 'Elite').map((u) => u.unitName);
    };
    expect(picked(0.99999)).toEqual(['Guard c0']);
    expect(picked(0)).toEqual(['Guard c1']);
  });

  test("Phantasmal Armies: phantoms already marching with the host don't count towards it", () => {
    const b = fresh();
    const h = at(b, { illusory: 1 });
    h.armies = [
      ...companies(10),
      ...companies(10, 'Men-at-Arms', 'Average', 'Shade').map((u) => ({ ...u, _phantom: true })),
    ];
    rolls([1], () => casts(b, h, 'Phantasmal Armies'));
    expect(textOf(b, h)).toContain('conjures phantasmal duplicates of 1 of their humanoid army');
  });

  test('Control Undead: the company seized leaves the hero and marches with the caster', () => {
    const b = fresh();
    b.own(b.X, 0);
    const m = rival(b);
    m.armies = [
      ...companies(1, 'Men-at-Arms', 'Veteran', 'Living'),
      { ...(companies(1, 'Men-at-Arms', 'Veteran', 'Bones')[0] as Unit), _isSkeletal: true },
    ];
    const h = at(b, { necromancy: 1 });
    rolls([1], () => casts(b, h, 'Control Undead', m.id));
    expect([m.armies.map((u) => u.unitName), h.armies.map((u) => u.unitName)]).toEqual([['Living c0'], ['Bones c0']]);
  });

  test("Plague strikes at its caster's level: at Necromancy 2 a company sickens on a die under 20%, not on one of 20%", () => {
    for (const [die, sick] of [
      [0.15, true],
      [0.2, false],
    ] as const) {
      const b = fresh();
      const p = ring1(b, 0);
      b.own(p, 1);
      p.garrisonArmies = companies(1, 'Men-at-Arms', 'Veteran');
      const h = at(b, { necromancy: 2 });
      rolls([1], () => casts(b, h, 'Plague', p.id), die);
      expect(p.garrisonArmies[0]?.quality).toBe(sick ? 'Average' : 'Veteran');
    }
  });

  test('Cataclysm strikes only the hosts in the province, takes their companies off, and tells every realm struck and the owner', () => {
    const b = fresh();
    const p = ring1(b, 0);
    b.own(p, 1);
    const foe = rival(b, { at: p, troops: 5 });
    const ally = at(b, {}, { player: 2, at: p, troops: 2 });
    const away = rival(b, { at: ring1(b, 1), troops: 4 });
    const mine = at(b, {}, { at: p, troops: 3 });
    const h = at(b, { elemental: 9 });
    rolls([1], () => casts(b, h, 'Cataclysm', p.id));
    expect([foe.armies.length, ally.armies.length, away.armies.length, mine.armies.length]).toEqual([2, 0, 4, 3]);
    const line = b.lines().find((l) => l.text.startsWith(`☄ ${h.name} calls down a Cataclysm`));
    expect([...(line?.targets ?? [])].sort()).toEqual([1, 2]);
    expect(line?.text).toContain('— 5 enemy units destroyed');
  });

  test("Cataclysm's line goes to the province's owner even when none of his hosts stand there", () => {
    const b = fresh();
    const p = ring1(b, 0);
    b.own(p, 1);
    at(b, {}, { player: 2, at: p, troops: 2 });
    const h = at(b, { elemental: 9 });
    rolls([1], () => casts(b, h, 'Cataclysm', p.id));
    const line = b.lines().find((l) => l.text.startsWith(`☄ ${h.name} calls down a Cataclysm`));
    expect([...(line?.targets ?? [])].sort()).toEqual([1, 2]);
  });
});
