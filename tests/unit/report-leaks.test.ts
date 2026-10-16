// The report-leak check (tests/lib/report-leaks.ts, P1-04c) on a small made-up turn: it passes, each planted leak
// breaks exactly the check meant to catch it, saying what leaked, and what the rules allow passes. Level 1 (unit): pure
// functions on made-up values; turn-fuzz, report-privacy and the balance matrix run the same checks over whole games
// (level 3).
import { describe, expect, test } from 'vitest';
import { checkLeaks, checkTurn, type SavedState, type Turn } from '../lib/invariants.ts';
import { LEAK_CHECKS, type RealmReport } from '../lib/report-leaks.ts';

// Three realms. Ashmark (0) and Brightvale (1) have met; neither has met Coldharbour (2), whose hero Corin cast
// Invisibility in phase 1 of the turn just played (turn 7: the state after it is turn 8). Ashmark and Brightvale have
// human players, so they get reports; Coldharbour is a bot.
function state(): SavedState {
  return {
    turn: 8,
    world: { provinces: [{ id: 0 }, { id: 1 }, { id: 2 }] },
    players: [
      { name: 'Ashmark', _encountered: [1] },
      { name: 'Brightvale', _encountered: [0] },
      { name: 'Coldharbour', _encountered: [] },
    ],
    characters: [
      { id: 10, name: 'Aldo the Bold', player: 0, alive: true, hp: 10, maxHp: 12, location: 0 },
      { id: 11, name: 'Bera the Wise', player: 1, alive: true, hp: 10, maxHp: 10, location: 1 },
      { id: 12, name: 'Corin the Grey', player: 2, alive: true, hp: 10, maxHp: 10, location: 2, _invisTurn: 7 },
      { id: 13, name: 'Dorn the Red', player: 2, alive: true, hp: 10, maxHp: 10, location: 1 },
    ],
  };
}
const HARDENED = '💪 Aldo the Bold is hardened by the wounds of the fight — maximum HP +2 → 12.';
const INVISIBLE =
  '✨ Corin the Grey weaves Invisibility about themself — no enemy eye will find them for the rest of this turn.';

function turn(edit: (t: Turn, r: RealmReport[]) => void = () => undefined): Turn {
  const reports: RealmReport[] = [
    {
      realm: 0,
      report: {
        lastTurnLog: [
          { text: 'Turn 7 begins. Ashmark stands ready.', phase: null },
          { text: 'Aldo the Bold moves to Fenwick.', phase: 1 },
          { text: HARDENED, phase: 2 },
          { text: 'An unknown realm claims Coldmere.', phase: 3 },
        ],
        worldMeta: { provinces: [{ id: 0, characters: [{ id: 10, name: 'Aldo the Bold', ownerName: 'Ashmark' }] }] },
        everSeenChars: [{ id: 12, name: 'Corin the Grey' }],
        allKingdoms: [
          { index: 0, name: 'Ashmark' },
          { index: 1, name: 'Brightvale' },
          { index: 2, name: 'Coldharbour' },
        ],
        nameColors: [{ name: 'Corin the Grey' }, { name: 'Dorn the Red' }],
      },
    },
    { realm: 1, report: { lastTurnLog: [{ text: 'Bera the Wise rests.', phase: 0 }], intel: [] } },
  ];
  const t: Turn = {
    before: state(),
    after: state(),
    gmLog: [
      { text: 'Corin the Grey moves to Coldmere.', actor: 2, targets: [2], charId: 12, phase: 0 },
      { text: 'Bera the Wise rests.', actor: 1, targets: [1], charId: 11, phase: 0 },
      { text: 'Bera the Wise hails Corin the Grey.', actor: 1, targets: [1], charId: 11, phase: 1 },
      { text: INVISIBLE, actor: 2, targets: [2], charId: 12, phase: 1 },
      { text: 'Aldo the Bold moves to Fenwick.', actor: 0, targets: [0], charId: 10, phase: 1 },
      { text: HARDENED, actor: null, targets: [0], charId: 10, phase: 2 },
      { text: 'An unknown realm claims Coldmere.', actor: 2, targets: [], public: true, phase: 3 },
    ],
    telemetry: [],
    players: [],
    reports,
  };
  edit(t, reports);
  return t;
}
/** Realm `realm`'s report in `r`. */
const of = (r: RealmReport[], realm: number) => {
  const x = r.find((y) => y.realm === realm);
  if (!x) throw new Error(`no report for realm ${String(realm)}`);
  return x.report;
};
/** Adds a chronicle line to realm `realm`'s report. */
const line = (r: RealmReport[], realm: number, text: string, phase: number | null = 2) =>
  (of(r, realm)['lastTurnLog'] as unknown[]).push({ text, phase });
const leaks = (t: Turn) => checkLeaks(t).map((b) => b.check);
const char = (s: SavedState, id: number) => {
  const c = s.characters.find((x) => x.id === id);
  if (!c) throw new Error(`no character ${String(id)}`);
  return c;
};

test('the made-up turn passes every leak check and every invariant', () => {
  expect(checkTurn(turn())).toEqual([]);
});

test('every leak check has a planted leak below', () => {
  expect(LEAK_CHECKS.map((c) => c.name)).toEqual(["another realm's private line", 'an unmet realm', 'an unseen hero']);
});

test('checkTurn runs the leak checks after the invariants', () => {
  const t = turn((_, r) => line(r, 1, HARDENED));
  expect(checkTurn(t).map((b) => b.check)).toEqual(["another realm's private line"]);
});

describe('each planted leak breaks its check, and only that one', () => {
  test.each<[string, string, (t: Turn, r: RealmReport[]) => void, RegExp]>([
    [
      "another realm's private line",
      "an enemy hero's hit-point rise (the leak af9c247 shipped)",
      (_, r) => line(r, 1, HARDENED),
      /^realm 1 reads a hit-point rise of realm 0's Aldo the Bold at lastTurnLog\[1\]: "💪 Aldo the Bold is hardened/,
    ],
    [
      "another realm's private line",
      'a line naming no hero, read by two realms',
      (_, r) => {
        line(r, 0, '📯 Call to Arms! The folk of Fenwick answer their king.');
        line(r, 1, '📯 Call to Arms! The folk of Fenwick answer their king.');
      },
      /^realms 0, 1 all read "📯 Call to Arms!/,
    ],
    [
      'an unmet realm',
      'a chronicle line its reader is no party to',
      (t, r) => {
        t.gmLog.push({ text: 'Coldharbour claims Coldmere.', actor: 2, targets: [], public: true, phase: 3 });
        line(r, 0, 'Coldharbour claims Coldmere.', 3);
      },
      /^realm 0 hasn't met realm 2, but its report names it at lastTurnLog\[4\]\.text: "Coldharbour claims Coldmere\."/,
    ],
    [
      'an unmet realm',
      'another section of the report',
      (_, r) => (of(r, 1)['diplomacy'] = { known: [{ index: 2, name: 'Coldharbour' }] }),
      /^realm 1 hasn't met realm 2, but its report names it at diplomacy\.known\[0\]\.name: "Coldharbour"/,
    ],
    [
      'an unseen hero',
      'the map shows him',
      (_, r) => {
        const map = of(r, 0)['worldMeta'] as { provinces: { characters: unknown[] }[] };
        map.provinces[0]?.characters.push({ id: 12, name: 'Corin the Grey', ownerName: 'Ashmark' });
      },
      /^realm 0 sees Corin the Grey \(id 12, invisible from phase 1\) at worldMeta\.provinces\[0\]\.characters\[1\]$/,
    ],
    [
      'an unseen hero',
      'a sighting without an id',
      (_, r) => (of(r, 1)['heroSightings'] = [{ type: 'enemy', name: 'Corin the Grey', locationName: 'Coldmere' }]),
      /^realm 1 sees Corin the Grey \(id 12, invisible from phase 1\) at heroSightings\[0\]$/,
    ],
    [
      'an unseen hero',
      'his reader names him after the cast: one breach for the phase, with a count',
      (_, r) => {
        line(r, 0, 'Aldo the Bold glimpses Corin the Grey on the road.');
        line(r, 0, 'Corin the Grey slips away.');
      },
      /^realm 0 reads of Corin the Grey \(id 12, invisible from phase 1\) in phase 2 at lastTurnLog\[4\]: "Aldo the Bold glimpses Corin the Grey on the road\." \(and 1 more lines like it that phase\)$/,
    ],
    [
      'an unseen hero',
      'later in the phase he cast it',
      (t, r) => {
        t.gmLog.push({ text: 'Aldo the Bold hails Corin the Grey.', actor: 0, targets: [0, 1], phase: 1 });
        line(r, 1, 'Aldo the Bold hails Corin the Grey.', 1);
      },
      /^realm 1 reads of Corin the Grey \(id 12, invisible from phase 1\) in phase 1 at lastTurnLog\[1\]/,
    ],
    [
      'an unseen hero',
      'spy activity',
      (_, r) =>
        (of(r, 1)['spyActivity'] = [{ provId: 2, lines: [{ phase: 3, text: 'Corin the Grey searches the ruins.' }] }]),
      /^realm 1 reads of Corin the Grey \(id 12, invisible from phase 1\) in phase 3 at spyActivity\[0\]\.lines\[0\]/,
    ],
  ])('%s: %s', (check, _what, plant, what) => {
    const breaches = checkLeaks(turn(plant));
    expect(breaches.map((b) => b.check)).toEqual([check]);
    expect(breaches[0]?.what.join('\n')).toMatch(what);
  });
});

describe('what each leak check allows', () => {
  test('a private line naming a hero of no realm, or read by one realm only', () => {
    const t = turn((x, r) => {
      x.after.characters.push({ id: 14, name: 'Old Hask', player: null, alive: true, hp: 5, maxHp: 5, location: 0 });
      line(r, 1, '💪 Old Hask is hardened by the victory — maximum HP +1 → 6.');
      line(r, 1, '📯 Call to Arms! The folk of Brightford answer their king.');
    });
    expect(leaks(t)).toEqual([]);
  });

  test("Clairvoyance shows the watched hero's private lines (the rulebook)", () => {
    expect(leaks(turn((_, r) => line(r, 1, '🔮 Clairvoyance — ' + HARDENED)))).toEqual([]);
  });

  test('a Charm hands a hero to the caster for the turn: the caster reads his private lines', () => {
    const hardened = '💪 Bera the Wise is hardened by the wounds of the fight — maximum HP +1 → 11.';
    const charmed = (t: Turn, r: RealmReport[], targets: number[]) => {
      char(t.after, 11)._charmedTurn = 7;
      t.gmLog.push({ text: 'Bera the Wise marches to Fenwick.', actor: 0, targets, charId: 11, phase: 2 });
      line(r, 0, hardened, 3);
    };
    expect(
      leaks(
        turn((t, r) => {
          charmed(t, r, [0]);
        }),
      ),
    ).toEqual([]);
    // A line about him that realm 0 sent to his own realm is no sign it held him; nor is acting through him uncharmed.
    expect(
      leaks(
        turn((t, r) => {
          charmed(t, r, [1]);
        }),
      ),
    ).toEqual(["another realm's private line"]);
    expect(leaks(turn((t, r) => (charmed(t, r, [0]), delete char(t.after, 11)._charmedTurn)))).toEqual([
      "another realm's private line",
    ]);
  });

  test('a name two heroes share is not checked, a wanderer\'s "(wandering)" aside', () => {
    const twin = (t: Turn, name: string) =>
      t.after.characters.push({ id: 15, name, player: 0, alive: true, hp: 5, maxHp: 5, location: 0 });
    expect(
      leaks(
        turn(
          (t, r) => (twin(t, 'Bera the Wise (wandering)'), line(r, 0, '💪 Bera the Wise is hardened by the victory.')),
        ),
      ),
    ).toEqual([]);
    expect(leaks(turn((t, r) => (twin(t, 'Corin the Grey'), line(r, 0, 'Corin the Grey keeps watch.'))))).toEqual([]);
  });

  test("a met realm's name holding an unmet one: the longest name first", () => {
    const names = (t: Turn) => {
      const p = t.after.players ?? [];
      p[0] = { name: 'The Outriders of the Ford', _encountered: [1] };
      p[2] = { name: 'The Outriders' };
    };
    expect(leaks(turn((t, r) => (names(t), line(r, 0, 'The Outriders of the Ford stand ready.'))))).toEqual([]);
    expect(leaks(turn((t, r) => (names(t), line(r, 0, 'The Outriders claim Coldmere.'))))).toEqual(['an unmet realm']);
  });

  test('a line naming an unmet realm that its reader is a party to (R-046)', () => {
    const war = '⚔ Coldharbour declares war on Ashmark and marches without warning.';
    expect(
      leaks(turn((t, r) => (t.gmLog.push({ text: war, actor: 2, targets: [0], phase: 0 }), line(r, 0, war, 0)))),
    ).toEqual([]);
  });

  test('a realm seen through its hero is met; the parked list of its own provinces does not meet it', () => {
    const seen = (r: RealmReport[]) =>
      (of(r, 1)['heroSightings'] = [{ type: 'enemy', name: 'Dorn the Red', kingdom: 'Coldharbour' }]);
    expect(leaks(turn((_, r) => seen(r)))).toEqual([]);
    const owned = (r: RealmReport[]) =>
      (of(r, 1)['ownedProvinces'] = [
        { id: 1, characters: [{ id: 13, name: 'Dorn the Red', ownerName: 'Coldharbour' }] },
      ]);
    expect(leaks(turn((_, r) => owned(r)))).toEqual(['an unmet realm']);
  });

  test('every name once the game is over; a name inside a longer one; a name a met realm shares', () => {
    const named = (r: RealmReport[]) => line(r, 0, 'Coldharbour claims Coldmere.', 3);
    expect(leaks(turn((t, r) => ((t.after.gameOver = { winner: 0 }), named(r))))).toEqual([]);
    expect(leaks(turn((t) => ((t.after.players ?? [])[2] = { name: 'Ash' })))).toEqual([]);
    expect(leaks(turn((t, r) => (((t.after.players ?? [])[2] = { name: 'Brightvale' }), named(r))))).toEqual([]);
  });

  test('an invisible hero named before he cast it: an earlier phase, or earlier in the same phase', () => {
    const t = turn((_, r) => {
      line(r, 1, 'Bera the Wise passes Corin the Grey on the road.', 0);
      line(r, 1, 'Bera the Wise hails Corin the Grey.', 1);
    });
    expect(leaks(t)).toEqual([]);
  });

  test('from the phase he acts on the reader: his deed, a notice of it, and what follows', () => {
    const t = turn((x, r) => {
      x.gmLog.push(
        { text: '⚔ Corin the Grey springs upon Aldo the Bold!', actor: 2, targets: [2, 0], phase: 3 },
        { text: '☠ A Curse from Corin the Grey settles over Aldo the Bold.', actor: null, targets: [0], phase: 4 },
      );
      line(r, 0, "Aldo the Bold's possessions — Rod of Iron — pass to Corin the Grey.", 3);
      line(r, 0, '⚔ Corin the Grey springs upon Aldo the Bold!', 3);
      line(r, 0, '☠ A Curse from Corin the Grey settles over Aldo the Bold.', 4);
    });
    expect(leaks(t)).toEqual([]);
  });

  test('title intelligence, memory, and the lookup tables name him without seeing him', () => {
    expect(
      leaks(turn((_, r) => line(r, 0, '[The Archmage] Illusory: Corin the Grey (Level 3) leads the race.', 99))),
    ).toEqual([]);
  });

  test('Clairvoyance pierces it; his own realm, now or when the turn began, sees him; a hero not invisible is seen', () => {
    const shown = (r: RealmReport[]) => (of(r, 0)['visibleChars'] = [{ id: 12, name: 'Corin the Grey' }]);
    const clair = (t: Turn) =>
      ((t.after.players ?? [])[0] = { name: 'Ashmark', _encountered: [1], _clairCharThisTurn: 12 });
    expect(leaks(turn((t, r) => (clair(t), shown(r))))).toEqual([]);
    const wasOurs = (t: Turn) => (char(t.before, 12).player = 0);
    expect(leaks(turn((t, r) => (wasOurs(t), shown(r))))).toEqual([]);
    const noInvis = (t: Turn) => delete char(t.after, 12)._invisTurn;
    expect(leaks(turn((t, r) => (noInvis(t), shown(r))))).toEqual([]);
  });
});

describe('the known breaches of the leak checks', () => {
  test("a visited province naming its unmet owner in the realm's intelligence is let through, and nothing else like it", () => {
    const intel = (text: string) => turn((_, r) => (of(r, 1)['intel'] = [text]));
    expect(leaks(intel('Coldmere (marsh): controlled by Coldharbour.'))).toEqual([]);
    expect(leaks(intel('Coldharbour holds Coldmere.'))).toEqual(['an unmet realm']);
    expect(leaks(intel('Coldmere (marsh): controlled by Coldharbour, who march on you.'))).toEqual(['an unmet realm']);
    expect(leaks(turn((_, r) => line(r, 1, 'Coldmere (marsh): controlled by Coldharbour.')))).toEqual([
      'an unmet realm',
    ]);
  });

  test("an invisible hero in the list of the realm's own provinces is let through; on the map he is not", () => {
    const at = (key: string) =>
      turn((_, r) => (of(r, 1)[key] = [{ id: 1, characters: [{ id: 12, name: 'Corin the Grey', ownerName: null }] }]));
    expect(leaks(at('ownedProvinces'))).toEqual([]);
    expect(leaks(turn((_, r) => (of(r, 1)['visibleChars'] = [{ id: 12, name: 'Corin the Grey' }])))).toEqual([
      'an unseen hero',
    ]);
  });

  test("a line of the reader's own order naming an invisible hero is let through; any other line is not", () => {
    // Aldo's ambush, as realm 0's own order logs it, and the fight it starts.
    const ambush = '📊 Ambush — Aldo the Bold (Spy 0) lies in wait for Corin the Grey: 10% [roll 9 ✓]';
    const fight = '⚔ Aldo the Bold springs from cover and sets upon Corin the Grey in Fenwick!';
    const own = (t: Turn, r: RealmReport[]) => {
      for (const text of [ambush, fight]) {
        t.gmLog.push({ text, actor: 0, targets: [0], phase: 2 });
        line(r, 0, text);
      }
    };
    expect(leaks(turn(own))).toEqual([]);
    // The same lines, logged for another realm's action (Brightvale's) or not in the GM log at all.
    const others = (t: Turn, r: RealmReport[]) => {
      t.gmLog.push({ text: ambush, actor: 1, targets: [0, 1], phase: 2 });
      line(r, 0, ambush);
      line(r, 0, fight);
    };
    expect(leaks(turn(others))).toEqual(['an unseen hero']);
    // A line of another kind in the same phase isn't hidden behind the parked kind.
    const both = (t: Turn, r: RealmReport[]) => (own(t, r), line(r, 0, 'Aldo the Bold glimpses Corin the Grey.'));
    expect(checkLeaks(turn(both)).flatMap((b) => b.what)).toEqual([
      'realm 0 reads of Corin the Grey (id 12, invisible from phase 1) in phase 2 at lastTurnLog[6]: "Aldo the Bold glimpses Corin the Grey."',
    ]);
  });
});
