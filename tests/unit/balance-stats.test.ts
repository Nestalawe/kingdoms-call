// The balance matrix's statistics (tools/balance/stats.ts, P1-02a), from a small made-up game of two realms and two
// turns whose figures are worked out by hand. Level 1 (unit): a pure function on a fixture.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The balance matrix's statistics from a small made-up game worked out by hand: battles counted once, the leading unit
// type, lairs, deaths, spells by caster, realms at turns 10 and 20 (a shorter game with its last turn), chases; a
// missing slice is a zero only for counts per game. TypeScript, in `unit/`
import { describe, expect, test } from 'vitest';
import {
  gameStats,
  isShare,
  leadingUnit,
  valueOf,
  type Battle,
  type GameRecord,
  type TelemetryRow,
} from '../../tools/balance/stats.ts';

const battle = (b: Partial<Battle>): Battle => ({
  ph: 0,
  prov: 1,
  terrain: 'hills',
  kind: 'pvp',
  atkPi: 0,
  atkChar: 10,
  defPi: 1,
  defChar: 20,
  won: true,
  atkLost: 1,
  defLost: 2,
  side: 'atk',
  ...b,
});
const snap = (gold: number, chars: { id: number; units: string[] }[] = []) => ({
  gold,
  provinces: gold / 10,
  str: gold * 2,
  titles: gold > 25 ? ['throne'] : [],
  characters: chars.map((c) => ({ id: c.id, units: c.units.map((t) => ({ t })) })),
});
const row = (r: Partial<TelemetryRow> & { turn: number; player_index: number }): TelemetryRow => ({
  pre: snap(0),
  post: snap(0),
  outcomes: {
    battles: { list: [] },
    encounters: { list: [] },
    deaths: { list: [] },
    spells: { list: [] },
    delta: { items: 0 },
  },
  ...r,
});
const outcomes = (o: Partial<TelemetryRow['outcomes']>): TelemetryRow['outcomes'] => ({
  battles: { list: [] },
  encounters: { list: [] },
  deaths: { list: [] },
  spells: { list: [] },
  delta: { items: 0 },
  ...o,
});

// Turn 1: realm 0's archers attack realm 1 and win (a battle both rows list); a neutral guard attacks realm 1 and
// loses (only realm 1's row lists it). Realm 0's hero clears a Weak lair; realm 1's hero dies to it in a Moderate one
// (both rows list the death). Realm 0 casts two spells, one of them also listed in realm 1's row. Turn 2: realm 1 attacks a garrison in the forest and loses.
const pvp = battle({});
const game: GameRecord = {
  telemetry: [
    row({
      turn: 1,
      player_index: 0,
      pre: snap(10, [{ id: 10, units: ['Longbows', 'Pikes', 'Longbows'] }]),
      post: snap(20),
      orders: { chars: { '10': { ph: [{ a: 'encounter' }, null, { a: 'defend' }] } } },
      outcomes: outcomes({
        battles: { list: [pvp] },
        encounters: { list: [{ pi: 0, power: 'Weak', won: true, fled: false, killed: false }] },
        deaths: { list: [{ ph: 1, charId: 21, how: 'neutral' }] },
        spells: {
          list: [
            { pi: 0, school: 'white', ok: true },
            { pi: 0, school: 'white', ok: false },
          ],
        },
        delta: { items: 2 },
      }),
    }),
    row({
      turn: 1,
      player_index: 1,
      pre: snap(10, [{ id: 20, units: ['Guard'] }]),
      post: snap(30),
      orders: { chars: { '20': { ph: [{ a: 'pursue' }] } } },
      outcomes: outcomes({
        battles: {
          list: [
            { ...pvp, side: 'def' },
            battle({
              kind: 'neutral',
              atkPi: null,
              atkChar: 99,
              defChar: 20,
              won: false,
              side: 'def',
              terrain: 'plain',
            }),
          ],
        },
        encounters: { list: [{ pi: 1, power: 'Moderate', won: false, fled: false, killed: true }] },
        deaths: { list: [{ ph: 1, charId: 21, how: 'neutral' }] },
        spells: { list: [{ pi: 0, school: 'white', ok: true }] }, // realm 0's spell, seen from realm 1's row
        delta: { items: -1 },
      }),
    }),
    row({ turn: 2, player_index: 0, post: snap(40) }),
    row({
      turn: 2,
      player_index: 1,
      pre: snap(30, [{ id: 20, units: [] }]),
      post: snap(10),
      outcomes: outcomes({
        battles: {
          list: [battle({ kind: 'garrison', atkPi: 1, atkChar: 20, defPi: 0, won: false, terrain: 'forest' })],
        },
      }),
    }),
  ],
  gmLog: [
    { text: '📊 Pursuit — A (Spy 1) closing on B (Spy 0): 75% [roll 20 ✓]' },
    { text: '📊 Pursuit — A (Spy 1) closing on B (Spy 0): 75% [roll 90 ✗]' },
    { text: 'B slips away through the country around Fen — A keeps the trail but cannot close.' },
    { text: 'A has a battle on their hands in Fen this season — the chase after B must wait.' },
    { text: 'A closes on B in Fen, but the ground is already a battlefield this season — the reckoning must wait.' },
    { text: 3 },
  ],
  unresolved: [1, 0],
  gameOver: { turn: 2, byReckoning: true },
};
const s = gameStats(game);

describe('battles', () => {
  test('each is counted once: from the attacker, or the defender when the attacker is neutral', () => {
    expect(s['battles: fought']).toEqual([3, 1]);
    expect(s['battles: attacker won']).toEqual([1, 3]);
    expect(s['battles: attacker won | by kind: pvp']).toEqual([1, 1]);
    expect(s['battles: attacker won | by kind: neutral']).toEqual([0, 1]);
    expect(s['battles: attacker won | by terrain: forest']).toEqual([0, 1]);
    expect(s['battles: units lost by the attacker']).toEqual([3, 3]);
    expect(s['battles: units lost by the defender']).toEqual([6, 3]);
    expect(s['battles: provinces left unresolved']).toEqual([1, 1]);
  });

  test("by the realm side's leading unit type, from the start-of-turn army", () => {
    expect(s["battles: attacker won | by the realm's leading unit: Longbows"]).toEqual([1, 1]);
    expect(s["battles: attacker won | by the realm's leading unit: Guard"]).toEqual([0, 1]);
    expect(s["battles: attacker won | by the realm's leading unit: none"]).toEqual([0, 1]);
    expect(leadingUnit([{ t: 'A' }, { t: 'B' }, { t: 'B' }, { t: 'A' }])).toBe('A');
    expect(leadingUnit(undefined)).toBe('none');
  });
});

describe('lairs, heroes, spells, items and titles', () => {
  test('from each realm’s own row', () => {
    expect(s['lairs: attempts']).toEqual([2, 1]);
    expect(s['lairs: cleared']).toEqual([1, 2]);
    expect(s['lairs: cleared | by grade: Weak']).toEqual([1, 1]);
    expect(s['lairs: cleared | by grade: Moderate']).toEqual([0, 1]);
    expect(s['lairs: hero killed']).toEqual([1, 2]);
    expect(s['heroes: deaths']).toEqual([1, 1]);
    expect(s['heroes: deaths | by how: neutral']).toEqual([1, 1]);
    expect(s['spells: cast']).toEqual([2, 1]);
    expect(s['spells: succeeded | by school: white']).toEqual([1, 2]);
    expect(s['items: gained']).toEqual([2, 1]);
    expect(s['titles: held at the end']).toEqual([1, 1]);
  });
});

describe('realms and the game', () => {
  test('a game over before turn 10 or 20 counts with its last turn', () => {
    expect(s['realms: gold at turn 20']).toEqual([50, 2]);
    expect(s['realms: gold at turn 10']).toEqual([50, 2]);
    expect(s['realms: gold at the end']).toEqual([50, 2]);
    expect(s['realms: army strength at the end']).toEqual([100, 2]);
  });

  test('how and when it ended', () => {
    expect(s['game: ended']).toEqual([1, 1]);
    expect(s['game: length in turns']).toEqual([2, 1]);
    expect(s['game: ended | by: the Reckoning']).toEqual([1, 1]);
    expect(s['game: ended | by: elimination']).toEqual([0, 1]);
    const unfinished = gameStats({ ...game, gameOver: null });
    expect(unfinished['game: ended']).toEqual([0, 1]);
    expect(unfinished['game: length in turns']).toBeUndefined();
  });
});

describe('chases', () => {
  test('orders from the telemetry, catches and waits from the GM log', () => {
    expect(s['chases: Encounter orders']).toEqual([1, 1]);
    expect(s['chases: Pursue orders']).toEqual([1, 1]);
    expect(s['chases: caught']).toEqual([1, 2]);
    expect(s['chases: waited for a battle']).toEqual([2, 1]);
  });
});

describe('a statistic a game lacks', () => {
  test('is a zero for a count per game, and left out for anything else', () => {
    expect(valueOf(s, 'heroes: deaths | by how: character')).toEqual([0, 1]);
    expect(valueOf(s, 'lairs: cleared | by grade: Legendary')).toEqual([0, 0]);
  });

  test('shares are told apart from counts and means', () => {
    expect(isShare('battles: attacker won | by kind: pvp')).toBe(true);
    expect(isShare('battles: fought')).toBe(false);
    expect(isShare('realms: gold at turn 10')).toBe(false);
    expect(isShare('game: length in turns')).toBe(false);
  });
});
