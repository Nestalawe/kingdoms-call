// The invariants (tests/lib/invariants.ts, P1-04b) on a small made-up turn: it keeps every invariant, and each planted
// fault breaks exactly the invariant meant to catch it, saying what broke. Level 1 (unit): pure functions on made-up
// values; turn-fuzz and the balance matrix run the same checks over whole games (level 3).
import { describe, expect, test } from 'vitest';
import {
  checkTurn,
  describeBreaches,
  INVARIANTS,
  KNOWN_BREACHES,
  type SavedState,
  type Turn,
} from '../lib/invariants.ts';
import { LEAK_CHECKS } from '../lib/report-leaks.ts';

// Two realms on a three-province map. Wren (a hero of realm 0) died in phase 2 of this turn; Odo (realm 1) died in an
// earlier turn. A lair in province 2 holds the Lantern of Ash; Mithril Armour is the one item off the ledger.
function state(): SavedState {
  return {
    world: {
      provinces: [{ id: 0 }, { id: 1 }, { id: 2, features: [{ hoardItems: [{ id: 3, name: 'Lantern of Ash' }] }] }],
    },
    characters: [
      {
        id: 10,
        name: 'Aldo the Bold',
        alive: true,
        hp: 12,
        maxHp: 15,
        location: 0,
        armies: [{ type: 'Spearmen' }],
        items: [
          { id: 1, name: 'Mithril Armour' },
          { id: 2, name: 'Ring of Embers' },
        ],
      },
      {
        id: 11,
        name: 'Bera the Wise',
        alive: true,
        hp: 0,
        maxHp: 10,
        location: 1,
        armies: [],
        items: [{ id: 4, name: 'Mithril Armour' }],
      },
      {
        id: 12,
        name: 'Wren the Swift',
        alive: false,
        hp: 0,
        maxHp: 12,
        location: 1,
        armies: [],
        items: [{ id: 5, name: 'Grey Cloak' }],
      },
      { id: 13, name: 'Odo the Grim', alive: false, hp: 0, maxHp: 14, location: 2, armies: [], items: [] },
    ],
    mercenaries: [{ id: 'merc_1', unitName: 'the Free Lances', location: 2 }],
    _awardedItems: ['Ring of Embers', 'Lantern of Ash', 'Grey Cloak'],
  };
}

function turn(edit: (t: Turn) => void = () => undefined): Turn {
  const before = state();
  const wren = before.characters.find((c) => c.id === 12);
  if (wren) wren.alive = true;
  const t: Turn = {
    before,
    after: state(),
    gmLog: [
      { text: '— Spring —', charId: null, phase: 0 },
      { text: 'Wren the Swift moves to the Fens.', charId: 12, phase: 1 },
      { text: 'Wren the Swift is cut down!', charId: 12, phase: 2 },
      { text: 'Aldo the Bold practises Melee.', charId: 10, phase: 3 },
    ],
    telemetry: [{ outcomes: { deaths: { list: [{ ph: 2, charId: 12 }] } } }, { outcomes: {} }],
    players: [
      { player_index: 0, user_id: 'u0', orders_submitted: false },
      { player_index: 1, user_id: null, orders_submitted: true },
    ],
  };
  edit(t);
  return t;
}
const char = (t: Turn, id: number) => {
  const c = t.after.characters.find((x) => x.id === id);
  if (!c) throw new Error(`no character ${String(id)}`);
  return c;
};
const checksBroken = (t: Turn) => checkTurn(t).map((b) => b.check);

test('the made-up turn keeps every invariant', () => {
  expect(checkTurn(turn())).toEqual([]);
});

test('every invariant has a planted fault below', () => {
  expect(INVARIANTS.map((i) => i.name)).toEqual([
    'no NaN or undefined',
    'HP in range',
    'unique ids',
    'items match the ledger',
    'armies in real provinces',
    'the dead take no actions',
    'orders_submitted cleared',
  ]);
});

describe('each planted fault breaks its invariant, and only that one', () => {
  test.each<[string, string, (t: Turn) => void, RegExp]>([
    [
      'no NaN or undefined',
      'a sum gone wrong in the log',
      (t) => t.gmLog.push({ text: 'Aldo the Bold gains NaN gold.', charId: 10, phase: 4 }),
      /GM log line 4: "Aldo the Bold gains NaN gold\."/,
    ],
    [
      'no NaN or undefined',
      'a log line with no text',
      (t) => t.gmLog.push({ charId: null, phase: 4 }),
      /GM log line 4 has no text \(undefined\)/,
    ],
    [
      'no NaN or undefined',
      'a name gone wrong in the state',
      (t) => (char(t, 11).name = 'Bera of undefined'),
      /state\.characters\[1\]\.name: "Bera of undefined"/,
    ],
    [
      'no NaN or undefined',
      'a NaN value in a live state',
      (t) => ((t.after.world.provinces[0] as Record<string, unknown>)['tax'] = NaN),
      /state\.world\.provinces\[0\]\.tax is NaN/,
    ],
    [
      'no NaN or undefined',
      'an undefined value in a live state',
      (t) => t.after._awardedItems?.push(undefined),
      /state\._awardedItems\[3\] is undefined/,
    ],
    ['HP in range', 'more than the maximum', (t) => (char(t, 10).hp = 16), /Aldo the Bold \(id 10\) has 16 HP of 15/],
    ['HP in range', 'below zero', (t) => (char(t, 11).hp = -1), /Bera the Wise \(id 11\) has -1 HP of 10/],
    ['HP in range', 'saved as null (a NaN)', (t) => (char(t, 10).hp = null), /has null HP of 15/],
    ['HP in range', 'no maximum', (t) => delete char(t, 10).maxHp, /has 12 HP of undefined/],
    ['unique ids', 'two characters', (t) => (char(t, 13).id = 10), /two characters have id 10/],
    ['unique ids', 'two provinces', (t) => t.after.world.provinces.push({ id: 1 }), /two provinces have id 1/],
    [
      'unique ids',
      'two mercenary bands',
      (t) => t.after.mercenaries?.push({ id: 'merc_1', unitName: 'the Grey Company', location: 0 }),
      /two mercenary bands have id merc_1/,
    ],
    [
      'unique ids',
      'two items, one held and one in a hoard',
      (t) => char(t, 13).items?.push({ id: 3, name: 'Mithril Armour' }),
      /two items have id 3/,
    ],
    [
      'items match the ledger',
      'a found item held twice',
      (t) => char(t, 11).items?.push({ id: 9, name: 'Ring of Embers' }),
      /Ring of Embers is in 2 places: with Aldo the Bold \(id 10\); with Bera the Wise \(id 11\)/,
    ],
    [
      'items match the ledger',
      'a found item held and still in its hoard',
      (t) => char(t, 13).items?.push({ id: 9, name: 'Lantern of Ash' }),
      /Lantern of Ash is in 2 places: with Odo the Grim \(id 13\); in a hoard in province 2/,
    ],
    [
      'items match the ledger',
      'an item that was never found',
      (t) => char(t, 11).items?.push({ id: 9, name: 'Crown of Thorns' }),
      /Crown of Thorns \(with Bera the Wise \(id 11\)\) isn't on the ledger/,
    ],
    [
      'items match the ledger',
      'a name on the ledger twice',
      (t) => t.after._awardedItems?.push('Grey Cloak'),
      /the ledger names Grey Cloak twice/,
    ],
    [
      'armies in real provinces',
      'a hero leading an army off the map',
      (t) => (char(t, 10).location = 7),
      /Aldo the Bold \(id 10\) with 1 armies is in province 7, which isn't on the map/,
    ],
    [
      'armies in real provinces',
      'a hero nowhere',
      (t) => delete char(t, 11).location,
      /Bera the Wise \(id 11\) is in province undefined/,
    ],
    [
      'armies in real provinces',
      'a mercenary band off the map',
      (t) => t.after.mercenaries?.push({ id: 'merc_2', unitName: 'the Lost', location: 3 }),
      /mercenary band the Lost \(id merc_2\) is in province 3/,
    ],
    [
      'the dead take no actions',
      'a hero acting after dying in the turn',
      (t) => t.gmLog.push({ type: 'explore', text: 'Wren the Swift searches the ruins.', charId: 12, phase: 3 }),
      /Wren the Swift \(id 12\), dead in phase 2, acts in phase 3: "Wren the Swift searches the ruins\."/,
    ],
    [
      'the dead take no actions',
      'a hero dead before the turn acting in it',
      (t) => t.gmLog.push({ type: 'system', text: 'Odo the Grim rests.', charId: 13, phase: 0 }),
      /Odo the Grim \(id 13\), dead since before the turn, acts in phase 0/,
    ],
    [
      'orders_submitted cleared',
      "a player's realm still marked",
      (t) => t.players.push({ player_index: 2, user_id: 'u2', orders_submitted: true }),
      /realm 2 is still marked as having submitted its orders/,
    ],
  ])('%s: %s', (name, _fault, plant, says) => {
    const breaches = checkTurn(turn(plant));
    expect(breaches.map((b) => b.check)).toEqual([name]);
    expect(breaches[0]?.what.join('\n')).toMatch(says);
  });
});

describe('what each invariant allows', () => {
  test('a hero who dies in a phase has lines in it and before it', () => {
    expect(checksBroken(turn())).toEqual([]);
  });

  test("a fallen commander's leaderless host fights on under his id (R-019)", () => {
    const t = turn((x) => {
      x.gmLog.push({
        type: 'combat',
        text: "⚔ The battle resumes — Wren the Swift's leaderless host presses on.",
        charId: 12,
        phase: 3,
      });
      x.gmLog.push({ type: 'combat', text: '⚔ **Battle for the Fens**', charId: 13, phase: 1 });
    });
    expect(checksBroken(t)).toEqual([]);
  });

  test('a hero raised in the turn may act again', () => {
    const t = turn((x) => {
      char(x, 13).alive = true;
      char(x, 13).hp = 14;
      x.gmLog.push({ text: 'Odo the Grim rises from death at full health.', charId: 13, phase: 1 });
    });
    expect(checksBroken(t)).toEqual([]);
  });

  test('a hero killed twice in the turn counts from the last death', () => {
    const t = turn((x) => {
      x.telemetry.push({ outcomes: { deaths: { list: [{ ph: 3, charId: 12 }] } } });
      x.gmLog.push({ text: 'Wren the Swift, raised, falls again.', charId: 12, phase: 3 });
    });
    expect(checksBroken(t)).toEqual([]);
  });

  test("a death the telemetry didn't record is not checked", () => {
    const t = turn((x) => {
      x.telemetry = [];
      x.gmLog.push({ text: 'Wren the Swift searches the ruins.', charId: 12, phase: 3 });
    });
    expect(checksBroken(t)).toEqual([]);
  });

  test('a bot realm may keep its flag; a dead hero may stand anywhere', () => {
    const t = turn((x) => (char(x, 13).location = 99));
    expect(checksBroken(t)).toEqual([]);
  });

  test('words that only contain NaN or undefined are fine', () => {
    const t = turn((x) => x.gmLog.push({ text: 'Nanna of Undefinedmoor (sic) marches.', charId: 10, phase: 4 }));
    expect(checksBroken(t)).toEqual([]);
  });

  test('a long list is cut short with a count', () => {
    const t = turn((x) => {
      for (const c of x.after.characters) c.hp = -1;
    });
    expect(checkTurn(t)).toEqual([
      {
        check: 'HP in range',
        what: [
          'Aldo the Bold (id 10) has -1 HP of 15',
          'Bera the Wise (id 11) has -1 HP of 10',
          'Wren the Swift (id 12) has -1 HP of 12',
          'Odo the Grim (id 13) has -1 HP of 14',
        ],
      },
    ]);
    const many = turn((x) => {
      for (let i = 0; i < 7; i++) x.gmLog.push({ text: `Aldo spends NaN gold (${String(i)}).`, phase: 4 });
    });
    expect(checkTurn(many)[0]?.what).toHaveLength(6);
    expect(checkTurn(many)[0]?.what[5]).toBe('…and 2 more');
  });

  test('a failure message names the game, turn, check and what broke', () => {
    const t = turn((x) => (char(x, 10).hp = 16));
    expect(describeBreaches('G3 (seed 7) turn 12', checkTurn(t))).toBe(
      'G3 (seed 7) turn 12: HP in range: Aldo the Bold (id 10) has 16 HP of 15',
    );
  });
});

describe('the known breaches', () => {
  // A realmless hero's battle header, as the engine writes it today (the armies cut short).
  const header = (name: string, neutral: boolean, role: string) =>
    '⚑FORCE⚑' +
    JSON.stringify({ name, color: neutral ? null : '#906090', neutral, guard: false, role, verb: 'holds', armies: [] });

  test('each names an invariant or a leak check and says why', () => {
    for (const k of KNOWN_BREACHES) {
      expect([...INVARIANTS, ...LEAK_CHECKS].map((i) => i.name)).toContain(k.check);
      expect(k.why.length).toBeGreaterThan(20);
    }
  });

  test("a realmless defender's header is let through, and nothing else like it", () => {
    const withLine = (text: string) => turn((x) => x.gmLog.push({ type: 'combat', text, charId: 10, phase: 1 }));
    expect(checksBroken(withLine(header('Camael the Sacred (undefined)', true, 'defender')))).toEqual([]);
    for (const text of [
      header('Camael the Sacred (undefined)', false, 'defender'),
      header('Camael the Sacred (undefined)', true, 'attacker'),
      header('undefined (Realm0)', true, 'defender'),
      'Camael the Sacred (undefined) holds Wistreach.',
    ])
      expect(checksBroken(withLine(text)), text).toEqual(['no NaN or undefined']);
  });
});
