// The balance matrix's hashes (tools/balance/hash.ts, P1-02a): prose is taken out of the play hash and nothing else
// is; words, clock readings and the stand-in database's stamps are handled as the matrix needs. Level 1 (unit): pure
// functions on small made-up values.
import { describe, expect, test } from 'vitest';
import {
  playHash,
  proseHash,
  reportSectionHashes,
  TURN_COLUMNS,
  turnHashes,
  withoutStamps,
} from '../../tools/balance/hash.ts';

// A small state; `edit` changes one field.
interface Fields {
  id: number;
  name: string;
  hp: number;
  lore: string;
  desc: string;
  mode: string;
  ranAt: string;
}
const FIELDS: Fields = {
  id: 7,
  name: 'Aldo the Bold',
  hp: 12,
  lore: 'Born in the marsh.',
  desc: 'Scales of iron.',
  mode: 'manual',
  ranAt: '2026-10-01T12:00:00.004Z',
};
const make = (f: Fields) => ({
  turn: 3,
  characters: [{ id: f.id, name: f.name, hp: f.hp, lore: f.lore }],
  world: { provinces: [{ id: 0, owner: 1, features: [{ monster: { name: 'Wyrm', desc: f.desc } }] }] },
  turnMode: { mode: f.mode, turnRanAt: f.ranAt },
});
const state = make(FIELDS);
const changed = (edit: Partial<Fields>) => make({ ...FIELDS, ...edit });

describe('the play hash', () => {
  test('ignores the words: desc, lore, flavour and text', () => {
    const reworded = changed({ lore: 'Born in the hills.', desc: 'Scales of bronze.' });
    expect(playHash(reworded)).toBe(playHash(state));
    expect(playHash([{ type: 'combat', text: 'A wins.' }])).toBe(playHash([{ type: 'combat', text: 'B wins.' }]));
  });

  test('sees everything else, names included', () => {
    expect(playHash(changed({ hp: 11 }))).not.toBe(playHash(state));
    expect(playHash(changed({ name: 'Aldo the Brave' }))).not.toBe(playHash(state));
    expect(playHash(changed({ id: 8 }))).not.toBe(playHash(state));
    expect(playHash([{ type: 'combat', text: 'A wins.' }])).not.toBe(playHash([{ type: 'move', text: 'A wins.' }]));
  });

  test('ignores clock readings: the pinned clock moves on at each reading', () => {
    expect(playHash(changed({ ranAt: '2026-10-01T12:00:00.019Z' }))).toBe(playHash(state));
    expect(playHash(changed({ mode: '2026-10-01' }))).not.toBe(playHash(state));
  });
});

describe('the words hash', () => {
  test('sees only the words', () => {
    expect(proseHash(changed({ lore: 'Born in the hills.' }))).not.toBe(proseHash(state));
    expect(proseHash(changed({ hp: 1 }))).toBe(proseHash(state));
    expect(proseHash([{ type: 'combat', text: 'A wins.' }])).not.toBe(proseHash([{ type: 'combat', text: 'A won.' }]));
  });
});

describe('a turn', () => {
  const telemetry = [{ id: 'row1', created_at: 'x', build: 'GM 2026.10.16-0819 tel1', turn: 1, outcomes: { id: 3 } }];
  const report = { engineStamp: '2026.10.16-0819', lastTurnLog: [{ text: 'You hold.' }], kingdom: { gold: 4 } };
  const turn = { state, gmLog: [{ type: 'move', text: 'A moves.' }], telemetry, report };

  test('drops the stand-in database stamps and the build stamp at the top of a row or report only', () => {
    expect(withoutStamps(telemetry[0])).toEqual({ turn: 1, outcomes: { id: 3 } });
    expect(withoutStamps(report)).toEqual({ lastTurnLog: [{ text: 'You hold.' }], kingdom: { gold: 4 } });
    const restamped = { ...turn, telemetry: [{ ...telemetry[0], id: 'row9', build: 'GM 2026.10.17-0900 tel1' }] };
    expect(turnHashes(restamped)).toBe(turnHashes(turn));
    expect(turnHashes({ ...turn, report: { ...report, engineStamp: 'other' } })).toBe(turnHashes(turn));
  });

  test('gives one hash per column; a bot game has no report columns', () => {
    const cols = turnHashes(turn).split(' ');
    expect(cols).toHaveLength(TURN_COLUMNS.length);
    expect(cols.every((c) => /^[0-9a-f]{12}$/.test(c))).toBe(true);
    expect(
      turnHashes({ ...turn, report: null })
        .split(' ')
        .slice(-2),
    ).toEqual(['', '']);
  });

  test('a rewording moves only the words columns', () => {
    const reworded = turnHashes({
      ...turn,
      gmLog: [{ type: 'move', text: 'A marches.' }],
      report: { ...report, lastTurnLog: [{ text: 'You stand.' }] },
    }).split(' ');
    const before = turnHashes(turn).split(' ');
    const moved = TURN_COLUMNS.filter((_, i) => reworded[i] !== before[i]);
    expect(moved).toEqual(['logText', 'reportText']);
  });

  test('a report section hashes its play and words apart', () => {
    const a = reportSectionHashes(report);
    const b = reportSectionHashes({ ...report, lastTurnLog: [{ text: 'You stand.' }] });
    expect(Object.keys(a)).toEqual(['lastTurnLog', 'kingdom']);
    expect(b['lastTurnLog']?.[0]).toBe(a['lastTurnLog']?.[0]);
    expect(b['lastTurnLog']?.[1]).not.toBe(a['lastTurnLog']?.[1]);
    expect(b['kingdom']).toEqual(a['kingdom']);
  });
});
