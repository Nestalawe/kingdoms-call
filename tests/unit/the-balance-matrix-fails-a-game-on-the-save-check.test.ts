// The balance matrix fails a game on the save's check (plan P1-15e1, P1-15e's Decision 3;
// tools/balance/a-game-fails-on-the-save-check.ts, which tools/balance/play.ts calls after every turn and after the
// last):
// - a turn's GM log with no `[Save check]` line finds nothing; with one, each place it names is found, as the check
//   named it, and a count of places it doesn't name ("and 2 more") is found too;
// - the last save, upgraded and checked on a copy: the made-up save of version 1 (tests/fixtures/saves/version-1.json)
//   as it is finds nothing; with a key the schema doesn't know (a battle's mark left on a company), that place;
// - the list of known places: each entry is anchored and names its Parked entry; an entry lets exactly its place through
//   (in a line and in the last save) and no other place, not even its path with another kind, nor a count.
// The staged lines are made by the engine's own words (whatTheSavesCheckFoundInWords), so a change to them that the
// matrix's reading misses turns this red.
// Level 1 (unit): both checks are functions of a log and of a save (the upgrade and the strict parse of the fixture take
// about a second); a static test can't parse a save. The matrix's run is the row's proof, not a test.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  KNOWN_PLACES_THE_SAVE_CHECK_FINDS,
  THE_SAVE_CHECKS_LINE_BEGINS,
  whatTheSaveCheckFindsOnTheLastSave,
  whatTheSaveCheckFoundInATurnsLog,
  type AKnownPlaceTheSaveCheckFinds,
} from '../../tools/balance/a-game-fails-on-the-save-check.ts';
import {
  THE_CHECKS_FINDINGS_NAMED_AT_MOST,
  whatTheSavesCheckFoundInWords,
} from '../../src/engine/saves/what-the-saves-check-found-in-words.ts';

const FIXTURE = fs.readFileSync(path.join(import.meta.dirname, '../fixtures/saves/version-1.json'), 'utf8');

/** The turn's line for the GM, as the engine writes it (engine/turn/new-turn-war-academy-…-the-final-reconcile.ts). */
const theSaveChecksLine = (places: string[]) => ({
  type: 'system',
  text: `[Save check] ${whatTheSavesCheckFoundInWords(places)}`,
});
/** A turn's GM log around it: lines of the turn's end that aren't the check's. */
const aTurnsLog = (...lines: { type: string; text: string }[]) => [
  { type: 'system', text: 'Turn 7 begins.' },
  { type: 'system', text: '[Integrity] Repaired 1 thing.' },
  ...lines,
  { type: 'system', text: 'The Sage Council convenes.' },
];

const THE_LEAKED_MARK = "characters.0.armies.2: a field this build doesn't know, _flakTargeted";
const A_MISSING_FIELD = 'players.1._botLadder: missing, and this build needs it';
const ANOTHER_KIND = 'characters.0.armies.2._flakTargeted: not the kind of value this build expects (number)';

type Obj = Record<string, unknown>;
const listIn = (o: Obj, key: string): Obj[] => {
  const v = o[key];
  return Array.isArray(v) ? v.filter((x): x is Obj => typeof x === 'object' && x !== null) : [];
};
/** The fixture with a battle's mark left on the third company of realm 0's king (characters.0), as a leak would. */
function theFixtureWithALeakedMark(): string {
  const save = JSON.parse(FIXTURE) as Obj;
  const king = listIn(save, 'characters')[0];
  if (king?.['id'] !== 0 || king['player'] !== 0) throw new Error('characters.0 is no longer realm 0’s king');
  const company = listIn(king, 'armies')[2];
  if (!company) throw new Error('realm 0’s king leads no third company');
  company['_flakTargeted'] = 'Captain Ostrel of the Ember Coast';
  return JSON.stringify(save);
}

/** An entry for the leaked mark alone, as one would be written when it is parked. */
const THE_LEAKED_MARK_KNOWN: AKnownPlaceTheSaveCheckFinds = {
  place: /^characters\.\d+\.armies\.\d+: a field this build doesn't know, _flakTargeted$/,
  parked: 'A battle’s mark left on a company in the save (a made-up entry, for this test)',
};

describe("a turn's GM log", () => {
  test('without a [Save check] line, nothing is found', () => {
    expect(whatTheSaveCheckFoundInATurnsLog(aTurnsLog())).toEqual([]);
    expect(whatTheSaveCheckFoundInATurnsLog([])).toEqual([]);
  });

  test('with one, each place it names is found, as the check named it', () => {
    expect(whatTheSaveCheckFoundInATurnsLog(aTurnsLog(theSaveChecksLine([THE_LEAKED_MARK])))).toEqual([
      THE_LEAKED_MARK,
    ]);
    expect(whatTheSaveCheckFoundInATurnsLog(aTurnsLog(theSaveChecksLine([THE_LEAKED_MARK, A_MISSING_FIELD])))).toEqual([
      THE_LEAKED_MARK,
      A_MISSING_FIELD,
    ]);
  });

  test('the places past the ten it names are found as their count', () => {
    const twelve = Array.from(
      { length: 12 },
      (_, i) => `characters.${String(i)}.x: a field this build doesn't know, y`,
    );
    expect(whatTheSaveCheckFoundInATurnsLog([theSaveChecksLine(twelve)])).toEqual([
      ...twelve.slice(0, THE_CHECKS_FINDINGS_NAMED_AT_MOST),
      'and 2 more',
    ]);
  });

  test('a line that begins as the check’s but not in its words is found whole', () => {
    const odd = THE_SAVE_CHECKS_LINE_BEGINS + 'something else';
    expect(whatTheSaveCheckFoundInATurnsLog([{ text: odd }])).toEqual([odd]);
  });
});

describe('the last save', () => {
  test('a save as this build writes it: nothing is found', () => {
    expect(whatTheSaveCheckFindsOnTheLastSave(FIXTURE)).toEqual([]);
  });

  test('with a key the schema doesn’t know: its place, and never its value', () => {
    const found = whatTheSaveCheckFindsOnTheLastSave(theFixtureWithALeakedMark());
    expect(found).toEqual([THE_LEAKED_MARK]);
    expect(found.join(' ')).not.toContain('Ostrel');
  });
});

describe('the known places', () => {
  test('each is anchored at both ends and names its Parked entry', () => {
    for (const k of KNOWN_PLACES_THE_SAVE_CHECK_FINDS) {
      expect(k.place.source).toMatch(/^\^.*\$$/);
      expect(k.parked.length).toBeGreaterThan(20);
    }
  });

  test('an entry lets exactly its place through, in a line, and no other', () => {
    const found = (places: string[]) =>
      whatTheSaveCheckFoundInATurnsLog(aTurnsLog(theSaveChecksLine(places)), [THE_LEAKED_MARK_KNOWN]);
    expect(found([THE_LEAKED_MARK])).toEqual([]);
    expect(found([THE_LEAKED_MARK, A_MISSING_FIELD])).toEqual([A_MISSING_FIELD]);
    for (const other of [
      A_MISSING_FIELD,
      ANOTHER_KIND,
      "characters.0.armies.2: a field this build doesn't know, _flakTargetedNow",
      "characters.0: a field this build doesn't know, _flakTargeted",
    ])
      expect(found([other]), other).toEqual([other]);
  });

  test('a count of places the line doesn’t name is never let through', () => {
    const twelve = Array.from({ length: 12 }, () => THE_LEAKED_MARK);
    expect(
      whatTheSaveCheckFoundInATurnsLog(
        [theSaveChecksLine(twelve)],
        [THE_LEAKED_MARK_KNOWN, { place: /.*/, parked: '' }],
      ),
    ).toEqual(['and 2 more']);
  });

  test('an entry lets its place through on the last save', () => {
    expect(whatTheSaveCheckFindsOnTheLastSave(theFixtureWithALeakedMark(), [THE_LEAKED_MARK_KNOWN])).toEqual([]);
  });
});
