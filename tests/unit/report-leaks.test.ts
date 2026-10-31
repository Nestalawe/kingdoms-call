// The report-leak check (tests/lib/report-leaks.ts, P1-04c) on a small made-up turn: it passes, each planted leak
// breaks exactly the check meant to catch it, saying what leaked, and what the rules allow passes. The audience check
// (P1-12b3, P1-12's Decision 12) on a made-up turn of its own, with the events it was emitted from and its sight: each
// line read that no event admits is a breach, and what the audience model admits passes; and the check of the kinds for
// one realm alone (P1-12c4) on the same turn. Level 1 (unit): pure
// functions on made-up values; turn-fuzz, report-privacy and the balance matrix run the same checks over whole games
// (level 3; the audience check where the turn's events are recorded: the matrix's every-realm half).
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The report-leak check (`lib/report-leaks.ts`, P1-04c) on a small made-up turn that passes; each planted leak (an
// enemy hero's hit-point rise, the `af9c247` leak; a private line two realms read; an unmet realm named in a line or
// another section; an invisible hero on the map, in the list of the reader's own provinces, in a sighting, in a line
// later in the phase he cast it or after it, in spy activity; a private line in province events, P1-12a1) breaks only
// its own check, saying what leaked; what they allow (Clairvoyance, a line the reader is a party to, a realm met
// through its hero, the game over, a Charm's caster, a namesake, the longest name first, lines before the cast, the
// hero's deeds on the reader and what follows, title intelligence); in spy activity (R-118) another realm's hit-point
// rise breaks it, as in the chronicle, and a rival's deed (his Call to Arms) doesn't, though two chronicles reading it
// do; `KNOWN_BREACHES` lets through only its own lines (a line of the reader's own order naming an invisible hero). The
// audience check (P1-12b3, P1-12's Decision 12) on a made-up turn of its own, with its events and
// sight, that passes: each line read that no event admits breaks it alone (another realm's private line; a line seen
// there where the reader had no eyes that phase; the public half of a pair by the realm it excepts; a battle it didn't
// fight; a line no event wrote, or in another phase; a province event; a world line made nameless from an event that
// wasn't the world's; a Clairvoyance line from before the watch, about another hero, or with no watch; a spy's feed
// line of another province, or from its spy's own phase; a line told to another realm, filed under the reader's hero
// only because his order was resolving, P1-12c1); what the model admits passes (a line naming its hero; one filed under
// the hero whose order was resolving when told to his realm then, its deed or seen there, read by the realm that holds
// him as the report is built; one of a hero who served no realm, P1-12c1; a line seen in a battle through a spy's
// lingering sight, an unmet realm read as "an unknown realm"); with no events recorded it checks nothing; a spy's
// lingering sight (R-118) admits a rival's deed there, never his realm's news, a kind for one realm alone or a line
// that excepts the reader. The check of a line for one realm alone (P1-12c4, P1-12's Decision 6; R-117, R-118) on the
// same turn: its own list names the four kinds; read by its own
// realm, no breach; planted, each breaks it alone (the surgeons' word given the battle's audience and read across the
// field, which the audience check admits; given the world, in province events; a maximum-HP rise outside a fight seen
// there, read by the province's owner; in another realm's spy feed); let through: Clairvoyance, the same words from a
// line for everyone, the realm its hero joined, no events recorded. Level 1: a lower
// level can't run a check; turn-fuzz, report-privacy and the matrix (every realm's report, since P1-12a1; with the
// audience check, since P1-12b3) run them over games. TypeScript, in `unit/`
import { describe, expect, test } from 'vitest';
import { checkLeaks, checkTurn, type SavedState, type Turn } from '../lib/invariants.ts';
import {
  KINDS_FOR_ONE_REALM_ALONE,
  LEAK_CHECKS,
  type EventAsEmitted,
  type Perception,
  type RealmReport,
} from '../lib/report-leaks.ts';

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
  expect(LEAK_CHECKS.map((c) => c.name)).toEqual([
    "another realm's private line",
    'an unmet realm',
    'an unseen hero',
    'a line its audience does not admit',
    'a line for one realm alone',
  ]);
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
      'in province events, a part of the report beside the chronicle (P1-12a1)',
      (_, r) => (of(r, 1)['provinceEvents'] = [{ text: HARDENED, phase: 2, provinceId: 0 }]),
      /^realm 1 reads a hit-point rise of realm 0's Aldo the Bold at provinceEvents\[0\]: "💪 Aldo the Bold is hardened/,
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
      'the list of its own provinces shows him',
      (_, r) =>
        (of(r, 1)['ownedProvinces'] = [{ id: 1, characters: [{ id: 12, name: 'Corin the Grey', ownerName: null }] }]),
      /^realm 1 sees Corin the Grey \(id 12, invisible from phase 1\) at ownedProvinces\[0\]\.characters\[0\]$/,
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

  test('a realm seen through its hero is met; the list of its own provinces (the map’s again) does not meet it', () => {
    const seen = (r: RealmReport[]) =>
      (of(r, 1)['heroSightings'] = [{ type: 'enemy', name: 'Dorn the Red', kingdom: 'Coldharbour' }]);
    expect(leaks(turn((_, r) => seen(r)))).toEqual([]);
    const owned = (r: RealmReport[]) =>
      (of(r, 1)['ownedProvinces'] = [
        { id: 1, characters: [{ id: 13, name: 'Dorn the Red', ownerName: 'Coldharbour' }] },
      ]);
    expect(leaks(turn((_, r) => owned(r)))).toEqual(['an unmet realm']);
  });

  test("a province's owner in the intelligence: an unmet realm is “an unknown realm”, never its name (R-046)", () => {
    const intel = (text: string) => turn((_, r) => (of(r, 1)['intel'] = [text]));
    expect(leaks(intel('Coldmere (marsh): controlled by an unknown realm.'))).toEqual([]);
    expect(leaks(intel('Coldmere (marsh): controlled by Coldharbour.'))).toEqual(['an unmet realm']);
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

// R-118 (P1-23d; P1-12a1 checks every part of a report): a spy who stays in a province reads what rival heroes do
// there, never their realm's own news. Another realm's hit-point rise in spy activity breaks the check, as in the
// chronicle; a rival's deed read through the spy (his Call to Arms) is no private line, though two chronicles reading
// it still are.
test("another realm's hit-point rise in spy activity breaks the check; a rival's deed read through a spy does not", () => {
  const spied = (text: string) => (_: Turn, r: RealmReport[]) =>
    (of(r, 1)['spyActivity'] = [{ provId: 0, provName: 'Fenwick', sincePhase: 1, lines: [{ phase: 2, text }] }]);
  const privateLines = LEAK_CHECKS.find((c) => c.name === "another realm's private line")?.check;
  expect(privateLines?.(turn(spied(HARDENED)))).toEqual([
    `realm 1 reads a hit-point rise of realm 0's Aldo the Bold at spyActivity[0].lines[0]: "${HARDENED}"`,
  ]);
  expect(leaks(turn(spied(HARDENED)))).toEqual(["another realm's private line"]);
  expect(leaks(turn((_, r) => line(r, 1, HARDENED)))).toEqual(["another realm's private line"]);
  const call = '📯 Call to Arms! The folk of Fenwick answer their king.';
  expect(leaks(turn((t, r) => (line(r, 0, call), spied(call)(t, r))))).toEqual([]);
  expect(leaks(turn((_, r) => (line(r, 0, call), line(r, 1, call))))).toEqual(["another realm's private line"]);
});

describe('the known breaches of the leak checks', () => {
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

// ── THE AUDIENCE CHECK (P1-12b3) ────
// The same three realms (Ashmark 0 and Brightvale 1 have met; neither has met Coldharbour 2), each owning one province:
// Ashmark Wexby (0), Brightvale Fenwick (1), Coldharbour Coldmere (2). Nobody is invisible. Aldo (Ashmark) moves to
// Fenwick in phase 1 and stands there through phase 2; he spies on Coldmere in phase 1. Brightvale watches Dorn
// (Coldharbour) by Clairvoyance from phase 2. Each report holds exactly the lines the audience model admits.
const ev = (
  text: string,
  phase: number | null,
  audience: EventAsEmitted['audience'],
  place: {
    province?: number | null;
    hero?: number | null;
    /** Left out: the hero is named when one is given (false: emit filed the line under the hero whose order was
     *  resolving). */
    heroNamed?: boolean;
    /** The realm the hero served as the line was written (left out: none). */
    heroRealmThen?: number | null;
    heroes?: number[] | null;
    spy?: boolean;
    type?: string;
    /** The kind of fact its line records, and the realm the fact names (left out: none). */
    kind?: string;
    factsRealm?: number;
  } = {},
): EventAsEmitted => ({
  type: place.type ?? 'system',
  text,
  audience,
  province: place.province ?? null,
  phase,
  hero: place.hero ?? null,
  heroNamed: place.heroNamed ?? place.hero != null,
  heroRealmThen: place.heroRealmThen ?? null,
  heroes: place.heroes ?? null,
  spy: place.spy ?? false,
  kind: place.kind ?? null,
  factsRealm: place.factsRealm ?? null,
});
const MOVES = 'Aldo the Bold moves to Fenwick.';
const RESTS = 'Bera the Wise rests.';
const STRANGER = 'A stranger is seen near Fenwick.';
const SCOUT = 'Your scout spots a stranger near Fenwick.';
const SPIES = 'Aldo the Bold spies on Coldmere.';
const STORM = 'A storm lashes Fenwick.';
const BATTLE = '⚔ The battle for Fenwick: Aldo the Bold against Bera the Wise.';
const MUSTERS = 'Dorn the Red musters in Fenwick.';
const MARCHES = 'Dorn the Red marches out of Coldmere.';
const CLASH = '⚔ Dorn the Red clashes with raiders in Coldmere.';
const WARD = '✨ Dorn the Red weaves a ward about himself.';
const RIDES = 'Dorn the Red rides to Fenwick.';
const CLAIMS = 'Coldharbour claims Coldmere.';
const PRICE = "📜 The crown's price falls.";
const SCRY = '🔮 Clairvoyance — ';
const STANDS = '🔮 Clairvoyance — as the turn ends, Dorn the Red stands in Coldmere. They are marked on your map.';

function perceived(edit: (t: Turn, r: RealmReport[], p: Perception) => void = () => undefined): Turn {
  const s = (): SavedState => {
    const x = state();
    delete char(x, 12)._invisTurn;
    (x.players ?? []).forEach((p, i) => (p.provinces = [i]));
    return x;
  };
  const p: Perception = {
    events: [
      ev(RESTS, 0, { actor: 1, realms: [1] }, { hero: 11, province: 1 }),
      ev(MOVES, 1, { actor: 0, realms: [0] }, { hero: 10, province: 1 }),
      ev(STRANGER, 1, { seen: 'there', except: [1] }, { province: 1 }),
      ev(SCOUT, 1, { realms: [1] }, { province: 1 }),
      ev(SPIES, 1, { actor: 0, realms: [0] }, { hero: 10, province: 2, spy: true }),
      ev(RIDES, 1, { actor: 2, realms: [2] }, { hero: 13, province: 1 }),
      ev(STORM, 2, { seen: 'there' }, { province: 1 }),
      ev(BATTLE, 2, { realms: [0, 1], seen: 'battle' }, { province: 1, hero: 10, heroes: [10, 11], type: 'combat' }),
      ev(HARDENED.replace('Aldo the Bold', 'Bera the Wise'), 2, { realms: [1] }, { hero: 11, province: 1 }),
      ev(MUSTERS, 3, { actor: 2, seen: 'there' }, { hero: 13, province: 1 }),
      ev(MARCHES, 3, { actor: 2, seen: 'there' }, { hero: 13, province: 2 }),
      ev(CLASH, 3, { realms: [2], seen: 'battle' }, { hero: 13, province: 2, type: 'combat' }),
      ev(WARD, 3, { actor: 2, realms: [2] }, { hero: 13, province: 2 }),
      ev(CLAIMS, 3, { seen: 'world' }),
      ev(PRICE, 99, { seen: 'world' }),
    ],
    presence: [
      { phase: 0, province: 1, realms: [1] },
      { phase: 1, province: 1, realms: [0, 1] },
      { phase: 2, province: 1, realms: [0, 1] },
      { phase: 3, province: 1, realms: [1] },
    ],
    clairvoyance: { 1: { charId: 13, fromPhase: 2 } },
  };
  const reports: RealmReport[] = [
    {
      realm: 0,
      report: {
        lastTurnLog: [
          { text: MOVES, phase: 1 },
          { text: STRANGER, phase: 1 },
          { text: SPIES, phase: 1 },
          { text: STORM, phase: 2 },
          { text: BATTLE, phase: 2 },
          { text: MARCHES, phase: 3 },
          { text: 'An unknown realm claims Coldmere.', phase: 3 },
          { text: PRICE, phase: 99 },
        ],
        provinceEvents: [{ text: STORM, phase: 2, provinceId: 1 }],
        spyActivity: [
          {
            provId: 2,
            provName: 'Coldmere',
            sincePhase: 2,
            lines: [
              { phase: 3, text: MARCHES },
              { phase: 3, text: CLASH },
            ],
          },
        ],
      },
    },
    {
      realm: 1,
      report: {
        lastTurnLog: [
          { text: RESTS, phase: 0 },
          { text: SCOUT, phase: 1 },
          { text: STORM, phase: 2 },
          { text: BATTLE, phase: 2 },
          { text: HARDENED.replace('Aldo the Bold', 'Bera the Wise'), phase: 2 },
          { text: MUSTERS, phase: 3 },
          { text: 'An unknown realm claims Coldmere.', phase: 3 },
          { text: SCRY + MARCHES, phase: 3 },
          { text: PRICE, phase: 99 },
          { text: STANDS, phase: null },
        ],
      },
    },
  ];
  const t: Turn = { before: s(), after: s(), gmLog: [], telemetry: [], players: [], reports, perception: p };
  edit(t, reports, p);
  return t;
}
/** Adds a line to a part (lastTurnLog, provinceEvents) of realm `realm`'s report. */
const read = (r: RealmReport[], realm: number, text: string, phase: number | null, part = 'lastTurnLog') => {
  const report = of(r, realm);
  report[part] = [...((report[part] as unknown[] | undefined) ?? []), { text, phase }];
};
/** Adds a line to realm `realm`'s spy activity in `province`. */
const spied = (r: RealmReport[], realm: number, province: number, text: string, phase: number) =>
  (of(r, realm)['spyActivity'] = [{ provId: province, sincePhase: 2, lines: [{ phase, text }] }]);
const audienceCheck = LEAK_CHECKS.find((c) => c.name === 'a line its audience does not admit')?.check;

describe('the audience check: every line a realm reads comes from an event whose audience admits it', () => {
  test('the made-up turn passes every leak check', () => {
    expect(checkLeaks(perceived())).toEqual([]);
  });

  test('without the turn’s events (a harness that records none), it checks nothing', () => {
    expect(
      audienceCheck?.(
        perceived((t, r) => {
          delete t.perception;
          read(r, 0, 'Aldo the Bold finds a dragon.', 2);
        }),
      ),
    ).toEqual([]);
  });

  test.each<[string, (t: Turn, r: RealmReport[], p: Perception) => void, string]>([
    [
      "another realm's private line (told to it alone)",
      (_, r) => {
        read(r, 0, SCOUT, 1);
      },
      'realm 0 reads a line its audience does not admit at lastTurnLog[8]',
    ],
    [
      'a line seen there, where it had no eyes that phase (a province it once stood in)',
      (_, r) => {
        read(r, 0, MUSTERS, 3);
      },
      'realm 0 reads a line its audience does not admit at lastTurnLog[8]',
    ],
    [
      'the public half of a pair, by the realm it excepts',
      (_, r) => {
        read(r, 1, STRANGER, 1);
      },
      'realm 1 reads a line its audience does not admit at lastTurnLog[10]',
    ],
    [
      'a battle it did not fight in (seen in the battle grants no onlooker)',
      (_, r, p) => {
        const battle = p.events.find((e) => e.text === BATTLE);
        if (battle) Object.assign(battle, { audience: { realms: [1], seen: 'battle' }, hero: 11, heroes: [11] });
      },
      'realm 0 reads a line its audience does not admit at lastTurnLog[4]',
    ],
    [
      // P1-12c1: a line filed under a hero only because his order was resolving reaches his realm by its audience alone.
      "a line told to another realm, filed under the reader's hero only because his order was resolving",
      (_, r, p) => {
        const told = 'Your garrison in Fenwick resumes its post.';
        p.events.push(ev(told, 1, { realms: [1] }, { hero: 10, heroNamed: false, heroRealmThen: 0, province: 1 }));
        read(r, 0, told, 1);
      },
      'realm 0 reads a line its audience does not admit at lastTurnLog[8]',
    ],
    [
      'a line no event of the turn wrote',
      (_, r) => {
        read(r, 0, 'Aldo the Bold finds a dragon.', 2);
      },
      'realm 0 reads a line its audience does not admit at lastTurnLog[8]',
    ],
    [
      'a line of the turn, in another phase than its own',
      (_, r) => {
        read(r, 0, RESTS, 1);
      },
      'realm 0 reads a line its audience does not admit at lastTurnLog[8]',
    ],
    [
      'a province event it may not read',
      (_, r) => {
        read(r, 0, WARD, 3, 'provinceEvents');
      },
      'realm 0 reads a line its audience does not admit at provinceEvents[1]',
    ],
    [
      "a world line made nameless, from an event that wasn't the world's",
      (_, r, p) => {
        const claim = p.events.find((e) => e.text === CLAIMS);
        if (claim) claim.audience = { realms: [2] };
      },
      'realm 0 reads a line its audience does not admit at lastTurnLog[6]',
    ],
    [
      'a Clairvoyance line from before the watch began',
      (_, r) => {
        read(r, 1, SCRY + RIDES, 1);
      },
      'realm 1 reads a line its audience does not admit at lastTurnLog[10]',
    ],
    [
      'a Clairvoyance line about another hero than the one it watches',
      (_, r) => {
        read(r, 1, SCRY + MOVES, 3);
      },
      'realm 1 reads a line its audience does not admit at lastTurnLog[10]',
    ],
    [
      'a Clairvoyance line with no watch',
      (_, r) => {
        read(r, 0, SCRY + MARCHES, 3);
      },
      'realm 0 reads a line its audience does not admit at lastTurnLog[8]',
    ],
    [
      "a spy's feed with a line of a province it didn't spy",
      (_, r) => spied(r, 0, 1, MUSTERS, 3),
      'realm 0 reads a line its audience does not admit at spyActivity[0].lines[0]',
    ],
    [
      "a spy's feed with a line from the phase its spy came, or before",
      (_, r, p) => {
        const sharpens = 'Dorn the Red sharpens his blade in Coldmere.';
        p.events.push(ev(sharpens, 1, { actor: 2, realms: [2] }, { hero: 13, province: 2 }));
        spied(r, 0, 2, sharpens, 1);
      },
      'realm 0 reads a line its audience does not admit at spyActivity[0].lines[0]',
    ],
  ])('%s', (_what, plant, at) => {
    const breaches = checkLeaks(perceived(plant));
    expect(breaches.map((b) => b.check)).toEqual(['a line its audience does not admit']);
    expect(breaches[0]?.what[0]).toMatch(new RegExp(`^${at.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: "`));
  });

  test('what the model admits: told, its own deed, its hero, the world, eyes there, a spy’s lingering sight, Clairvoyance', () => {
    // Each line of the made-up turn is one of these; the turn passes (above). The spy's lingering sight lets a line of
    // the spied province seen in a battle through, which no other grant gives the realm.
    expect(audienceCheck?.(perceived())).toEqual([]);
    expect(
      audienceCheck?.(
        perceived((_, __, p) => {
          const clash = p.events.find((e) => e.text === CLASH);
          if (clash) clash.province = 1;
        }),
      ),
    ).toEqual([`realm 0 reads a line its audience does not admit at spyActivity[0].lines[1]: "${CLASH}"`]);
    // P1-12c1: a line that names its hero is about him, whatever its audience; one filed under the hero whose order was
    // resolving is about him when it reached his realm then, so the realm holding him as the report is built reads it
    // (Aldo's own deed, a line told to Ashmark or one seen where he was, read by Brightvale had he joined it that turn),
    // or when he served no realm.
    const rests = 'Aldo the Bold rests and recovers.';
    const wage = "Aldo the Bold's wage is paid.";
    const digs = 'Aldo the Bold digs in before Coldmere.';
    const stranger = 'Ewan the Unsworn wanders into Fenwick.';
    const admitted = [
      perceived((_, r, p) => {
        p.events.push(ev(STORM, 1, {}, { hero: 10, heroRealmThen: 0, province: 1 }));
        read(r, 0, STORM, 1);
      }),
      perceived((t, r, p) => {
        char(t.after, 10).player = 1;
        p.events.push(ev(rests, 1, { actor: 0 }, { hero: 10, heroNamed: false, heroRealmThen: 0 }));
        read(r, 1, rests, 1);
      }),
      perceived((t, r, p) => {
        char(t.after, 10).player = 1;
        p.events.push(ev(wage, 1, { realms: [0] }, { hero: 10, heroNamed: false, heroRealmThen: 0 }));
        read(r, 1, wage, 1);
      }),
      perceived((t, r, p) => {
        char(t.after, 10).player = 1;
        p.events.push(ev(digs, 1, { seen: 'there' }, { hero: 10, heroNamed: false, heroRealmThen: 0, province: 2 }));
        read(r, 1, digs, 1);
      }),
      perceived((_, r, p) => {
        p.events.push(ev(stranger, 1, { realms: [2] }, { hero: 11, heroNamed: false, province: 1 }));
        read(r, 1, stranger, 1);
      }),
    ];
    expect(admitted.map((t) => audienceCheck?.(t))).toEqual([[], [], [], [], []]);
  });

  test("an unmet realm's name, read as “an unknown realm”, matches its event; another wording does not", () => {
    expect(
      audienceCheck?.(
        perceived((_, r) => {
          read(r, 1, 'An unknown realm claims Coldmere.', 3);
        }),
      ),
    ).toEqual([]);
    expect(
      audienceCheck?.(
        perceived((_, r) => {
          read(r, 1, 'An unknown realm seizes Coldmere.', 3);
        }),
      ),
    ).toEqual([
      'realm 1 reads a line its audience does not admit at lastTurnLog[10]: "An unknown realm seizes Coldmere."',
    ]);
  });

  // R-118 (P1-23d): a spy who stays reads what rival heroes do there (a deed) or anyone there could see, never their
  // realm's news (a line told to it with no deed), a kind for one realm alone, or a line that excepts the reader.
  test("a spy's lingering sight admits a rival's deed; not his realm's news, a kind for one realm alone, or a line that excepts it", () => {
    // Dorn's ward is his own deed (Coldharbour its actor, told to Coldharbour): read through the spy, not in the
    // chronicle, where realm 0 has no eyes on Coldmere.
    expect(leaks(perceived((_, r) => spied(r, 0, 2, WARD, 3)))).toEqual([]);
    expect(
      leaks(
        perceived((_, r) => {
          read(r, 0, WARD, 3);
        }),
      ),
    ).toEqual(['a line its audience does not admit']);
    const feels = '🩸 Dorn the Red feels a curse settle on him.';
    const hardened = '💪 Dorn the Red is hardened by the wounds of the fight — maximum HP +2 → 12.';
    const keptFrom = (text: string) =>
      `realm 0 reads, through its spy, a line its audience keeps from it at spyActivity[0].lines[0]: "${text}"`;
    const news = perceived((_, r, p) => {
      p.events.push(ev(feels, 3, { realms: [2] }, { hero: 13, province: 2 }));
      spied(r, 0, 2, feels, 3);
    });
    expect(audienceCheck?.(news)).toEqual([keptFrom(feels)]);
    expect(leaks(news)).toEqual(['a line its audience does not admit']);
    // planted with a deed, as before R-118: a kind for one realm alone is still kept from the spy
    const oneRealms = perceived((_, r, p) => {
      p.events.push(
        ev(
          hardened,
          3,
          { actor: 2, realms: [2] },
          { hero: 13, province: 2, kind: 'a hero is hardened after a fight', factsRealm: 2 },
        ),
      );
      spied(r, 0, 2, hardened, 3);
    });
    expect(audienceCheck?.(oneRealms)).toEqual([keptFrom(hardened)]);
    expect(leaks(oneRealms)).toEqual([
      "another realm's private line",
      'a line its audience does not admit',
      'a line for one realm alone',
    ]);
    const excepted = perceived((_, r, p) => {
      p.events.push(ev(STRANGER.replace('Fenwick', 'Coldmere'), 3, { seen: 'there', except: [0] }, { province: 2 }));
      spied(r, 0, 2, STRANGER.replace('Fenwick', 'Coldmere'), 3);
    });
    expect(audienceCheck?.(excepted)).toEqual([keptFrom(STRANGER.replace('Fenwick', 'Coldmere'))]);
  });
});

// ── A LINE FOR ONE REALM ALONE (P1-12c4) ────
// P1-12's Decision 6: a fight's line of a kind that is its hero's realm's alone (the surgeons' word to a fallen duellist's
// realm, a hero's hit-point rise) is read by that realm alone, whatever audience the engine gave it. On the audience
// check's made-up turn: Aldo (Ashmark) falls in the duel of the battle for Fenwick, and the surgeons come too late.
const SURGEONS = '🩹 Battlefield Surgery: the surgeons reach Aldo the Bold too late. (40% [roll 77 ✗])';
const forOneRealmAlone = LEAK_CHECKS.find((c) => c.name === 'a line for one realm alone')?.check;
/** The surgeons' line, recorded with `audience` (Ashmark's alone, or, planted, the battle's). */
const surgeons = (audience: EventAsEmitted['audience']) =>
  ev(SURGEONS, 2, audience, {
    province: 1,
    hero: 10,
    heroes: [10, 11],
    type: 'combat',
    kind: 'the surgeons reach a fallen duellist too late, for his realm alone',
    factsRealm: 0,
  });

/** R-117 (P1-23c): Aldo's maximum-HP rise outside a fight, as he stands in Fenwick in phase 2, recorded with `audience`
 *  (Ashmark's alone, or, planted, what anyone there sees, as before R-117). */
const RISES = "💪 Aldo the Bold's maximum HP rises by 4 to 22 (current HP 15).";
const rises = (audience: EventAsEmitted['audience']) =>
  ev(RISES, 2, audience, {
    province: 1,
    hero: 10,
    kind: "a hero's maximum hit points rise as the phase ends",
    factsRealm: 0,
  });

describe('a line for one realm alone is read by that realm and no other', () => {
  test('its own list names the four kinds for one realm alone', () => {
    expect(KINDS_FOR_ONE_REALM_ALONE).toEqual([
      "a hero's hit points rise in a fight, for his realm alone",
      'the surgeons reach a fallen duellist too late, for his realm alone',
      "a hero's maximum hit points rise as the phase ends",
      'a hero is hardened after a fight',
    ]);
  });

  test('read by its own realm, with its own audience: no breach', () => {
    const t = perceived((_, r, p) => {
      p.events.push(surgeons({ realms: [0], actor: null }));
      p.events.push(rises({ realms: [0] }));
      read(r, 0, SURGEONS, 2);
      read(r, 0, RISES, 2);
    });
    expect(checkLeaks(t)).toEqual([]);
  });

  test.each<[string, (t: Turn, r: RealmReport[], p: Perception) => void, string]>([
    [
      "given the battle's audience, read by the realm across the field (the audience check admits it)",
      (_, r, p) => {
        p.events.push(surgeons({ realms: [0, 1], seen: 'battle' }));
        read(r, 0, SURGEONS, 2);
        read(r, 1, SURGEONS, 2);
      },
      'realm 1 reads a line for realm 0 alone at lastTurnLog[10]',
    ],
    [
      'given the world, read by another realm in its province events',
      (_, r, p) => {
        p.events.push(surgeons({ seen: 'world' }));
        read(r, 1, SURGEONS, 2, 'provinceEvents');
      },
      'realm 1 reads a line for realm 0 alone at provinceEvents[0]',
    ],
    [
      "a maximum-HP rise outside a fight, seen there, read by the province's owner (the audience check admits it)",
      (_, r, p) => {
        p.events.push(rises({ actor: 0, realms: [0], seen: 'there' }));
        read(r, 0, RISES, 2);
        read(r, 1, RISES, 2);
      },
      'realm 1 reads a line for realm 0 alone at lastTurnLog[10]',
    ],
  ])('%s', (_what, plant, at) => {
    const breaches = checkLeaks(perceived(plant));
    expect(breaches.map((b) => b.check)).toEqual(['a line for one realm alone']);
    expect(breaches[0]?.what[0]).toMatch(new RegExp(`^${at.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: "`));
  });

  // In another realm's spy feed it breaks the check too (R-118: the spy never reads a rival realm's news).
  test("in another realm's spy feed it breaks the check, as in the chronicle", () => {
    const feed = perceived((_, r, p) => {
      p.events.push({ ...surgeons({ seen: 'there' }), province: 2, phase: 3 });
      r[1] = { realm: 1, report: { ...of(r, 1), spyActivity: [{ provId: 2, lines: [{ phase: 3, text: SURGEONS }] }] } };
    });
    expect(forOneRealmAlone?.(feed)).toEqual([
      `realm 1 reads a line for realm 0 alone at spyActivity[0].lines[0]: "${SURGEONS}"`,
    ]);
    expect(leaks(feed)).toEqual(['a line for one realm alone']);
  });

  test('let through: Clairvoyance, the same words from a line for everyone, the realm its hero joined, and a harness that records no events', () => {
    const scried = perceived((_, r, p) => {
      p.events.push(surgeons({ realms: [0, 1], seen: 'battle' }));
      read(r, 1, SCRY + SURGEONS, 2);
    });
    expect(forOneRealmAlone?.(scried)).toEqual([]);
    const shared = perceived((_, r, p) => {
      p.events.push(surgeons({ realms: [0], actor: null }));
      p.events.push(ev(SURGEONS, 2, { realms: [0, 1], seen: 'battle' }, { province: 1, hero: 10, type: 'combat' }));
      read(r, 1, SURGEONS, 2);
    });
    expect(forOneRealmAlone?.(shared)).toEqual([]);
    // the realm the hero it is filed under served this turn (he joined it): it reads his own lines (the audience model)
    const joined = perceived((t, r, p) => {
      char(t.after, 10).player = 1;
      p.events.push(surgeons({ realms: [0], actor: null }));
      read(r, 1, SURGEONS, 2);
    });
    expect(forOneRealmAlone?.(joined)).toEqual([]);
    const unrecorded = perceived((t, r, p) => {
      p.events.push(surgeons({ realms: [0, 1], seen: 'battle' }));
      read(r, 1, SURGEONS, 2);
      delete t.perception;
    });
    expect(forOneRealmAlone?.(unrecorded)).toEqual([]);
  });
});
