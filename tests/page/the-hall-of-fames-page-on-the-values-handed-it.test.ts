// The Hall of Fame's page on the values handed it (plan P1-16j2): the lines P1-16j2 changed in
// src/ui/leaderboard/main.ts that the screen tours don't reach, or reach only in part (its filters, its sums and
// sorts on a record's odd JSON, the GM's edits, the reads that fail), each pinned to what the untyped page gave.
// And (P1-21s) each record's best entry first, the most or the least as the record asks, and a third place counted
// in the top 3.
// Level 4 (page): the page boots in jsdom on the fake database (tests/lib/fake-db.ts) holding made-up entries; the
// file can't be imported alone (it boots itself on import), and its sums show only on its screens.
import { describe, expect, test } from 'vitest';
import { bootJsdom, DB_VERSION, readPage, type PageWindow } from '../lib/boot.js';
import { makeAFakeDbHoldingTheHallOfFame, type AChangeTheHallOfFameSent } from '../lib/fake-db.ts';
import type { AHallOfFameEntry, Db } from '../../src/db/the-db-interface-and-its-areas.ts';
import type { Json } from '../../src/db/database.types.ts';

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** A made-up finished game's entry. */
const anEntry = (id: string, columns: Partial<AHallOfFameEntry>): AHallOfFameEntry => ({
  build: 'lb3',
  created_at: '2026-01-02T00:00:00Z',
  finished_at: '2026-10-10T12:00:00Z',
  game_id: id,
  game_name: 'Game ' + id,
  gm_user_id: 'gm-1',
  hidden: false,
  note: null,
  records: {},
  setup: { realms: 2, humans: 2, bots: 0 },
  standings: [],
  started_at: '2026-09-10T12:00:00Z',
  totals: {},
  turns: 12,
  victory: 'reckoning',
  winner_is_bot: false,
  winner_player: null,
  winner_realm: 'Thornmere',
  ...columns,
});

interface APage {
  readonly W: PageWindow;
  readonly doc: Document;
  readonly changes: AChangeTheHallOfFameSent[];
  readonly errors: string[];
  readonly call: (name: string, ...args: unknown[]) => unknown;
  readonly body: () => string;
  readonly prompted: unknown[];
}
interface Booting {
  readonly rows: readonly AHallOfFameEntry[];
  readonly gm?: boolean;
  readonly overlord?: boolean;
  readonly names?: readonly { id: string; name: string | null }[];
  readonly db?: (db: Db) => Db;
  readonly confirm?: boolean;
  readonly prompt?: string | null;
}
async function boot(o: Booting): Promise<APage> {
  const changes: AChangeTheHallOfFameSent[] = [];
  const errors: string[] = [];
  const prompted: unknown[] = [];
  const fake = makeAFakeDbHoldingTheHallOfFame(DB_VERSION, {
    rows: () => o.rows,
    changes,
    signedIn: true,
    me: 'gm-1',
    isGm: o.gm === true,
    isOverlord: o.overlord === true,
    names: o.names ?? [],
  });
  const { window: W } = bootJsdom(readPage('kingdoms-call-leaderboard.html'), {
    url: 'https://example.test/kingdoms-call-leaderboard.html' + (o.gm === true || o.overlord === true ? '?gm=1' : ''),
    supabase: { createClient: () => ({}) },
    db: o.db ? o.db(fake.db) : fake.db,
    setup(w) {
      w.addEventListener('error', (e) => errors.push(e.message));
      Object.assign(w, {
        alert: (m: string) => errors.push('alert: ' + m),
        confirm: () => o.confirm ?? true,
        prompt: (_words: string, held: unknown) => {
          prompted.push(held);
          return o.prompt === undefined ? 'Ada' : o.prompt;
        },
      });
    },
  });
  await wait(300);
  const doc = W['document'] as Document;
  const call = (name: string, ...args: unknown[]): unknown => {
    const f: unknown = Reflect.get(W, name);
    if (typeof f !== 'function') throw new Error('no ' + name);
    return Reflect.apply(f, W, args);
  };
  return { W, doc, changes, errors, call, body: () => doc.getElementById('body')?.textContent ?? '', prompted };
}
const setControl = (p: APage, id: string, value: string): void => {
  const el = p.doc.getElementById(id);
  const Input = p.W['HTMLInputElement'] as typeof HTMLInputElement;
  const Select = p.W['HTMLSelectElement'] as typeof HTMLSelectElement;
  if (el instanceof Select) {
    if (![...el.options].some((o) => o.value === value)) {
      const option = p.doc.createElement('option');
      option.value = value;
      el.append(option);
    }
    el.value = value;
  } else if (el instanceof Input) el.value = value;
  else throw new Error('no control ' + id);
};
/** What a call into the page threw, in words (its errors are the page realm's classes), or 'nothing'. */
const thrown = (f: () => unknown): string => {
  try {
    f();
    return 'nothing';
  } catch (e) {
    return String(e);
  }
};
/** What a page's promise was refused with, in words, or 'nothing'. */
const refused = async (promise: unknown): Promise<string> => {
  try {
    await promise;
    return 'nothing';
  } catch (e) {
    return String(e);
  }
};
const filteredIds = (p: APage): unknown[] => {
  const games = p.call('filtered') as readonly { game_id: unknown }[];
  return Array.from(games, (g) => g.game_id);
};

describe("the filters, on a game's setup as its row holds it", () => {
  const rows = [
    anEntry('a', { setup: { realms: 4, bots: '2', seaPct: 25, diplomacy: 'hostile' }, turns: 5, victory: null }),
    anEntry('b', { setup: { realms: '3', humans: 3, seaPct: 40 }, turns: 15, finished_at: null }),
    anEntry('c', { setup: { realms: 2, humans: 0, bots: 2, seaPct: 50 }, turns: null, victory: 'conquest' }),
    anEntry('d', { setup: null, turns: 25, finished_at: '2026-05-01T12:00:00Z' }),
  ];
  test('each kind of opponent, the bots, the realms, the humans and the diplomacy', async () => {
    const p = await boot({ rows });
    const by = (id: string, value: string): unknown[] => {
      p.call('resetFilters');
      setControl(p, id, value);
      return filteredIds(p);
    };
    expect(by('f-kind', 'human')).toEqual(['b', 'd']);
    expect(by('f-kind', 'withbots')).toEqual(['a', 'c']);
    expect(by('f-kind', 'allbot')).toEqual(['c', 'd']);
    expect(by('f-kind', 'mixed')).toEqual(['a']);
    expect(by('f-bots', '2')).toEqual(['a', 'c']);
    expect(by('f-bots', '0')).toEqual(['b', 'd']);
    expect(by('f-realms', '3')).toEqual(['b']);
    expect(by('f-realms', '')).toEqual(['a', 'b', 'c', 'd']);
    expect(by('f-humans', '2')).toEqual(['a']);
    expect(by('f-humans', '0')).toEqual(['c', 'd']);
    expect(by('f-diplo', 'normal')).toEqual(['b', 'c', 'd']);
    expect(by('f-diplo', 'hostile')).toEqual(['a']);
  });
  test('the sea, the victory, the length, the dates and the search', async () => {
    const p = await boot({
      rows: rows.map((r, i) =>
        i === 0 ? { ...r, standings: [{ realm: 'Osk', player: 'Brin' }, 0], winner_realm: null } : r,
      ),
    });
    const by = (id: string, value: string): unknown[] => {
      p.call('resetFilters');
      setControl(p, id, value);
      return filteredIds(p);
    };
    expect(by('f-sea', 'lo')).toEqual(['a']);
    expect(by('f-sea', 'mid')).toEqual(['b']);
    expect(by('f-sea', 'hi')).toEqual(['c']);
    expect(by('f-vic', 'conquest')).toEqual(['c']);
    expect(by('f-vic', 'reckoning')).toEqual(['b', 'd']);
    expect(by('f-len', 's')).toEqual(['a', 'c']);
    expect(by('f-len', 'm')).toEqual(['b']);
    expect(by('f-len', 'l')).toEqual(['d']);
    expect(by('f-from', '2026-06-01')).toEqual(['a', 'c']);
    expect(by('f-to', '2026-06-01')).toEqual(['b', 'd']);
    p.call('resetFilters');
    setControl(p, 'f-q', 'brin');
    expect(filteredIds(p)).toEqual(['a']);
  });
  test('the search through realms, players and names; none matching', async () => {
    const p = await boot({
      rows: [
        anEntry('a', { standings: [{ realm: 'Osk', player: 'Brin' }, 0, false] }),
        anEntry('b', { game_name: null, note: 'a long one', standings: [{ realm: 'Vey', uid: 'u-9' }] }),
      ],
      names: [{ id: 'u-9', name: 'Cass' }],
    });
    setControl(p, 'f-q', 'brin');
    expect(filteredIds(p)).toEqual(['a']);
    setControl(p, 'f-q', 'cass');
    expect(filteredIds(p)).toEqual(['b']);
    setControl(p, 'f-q', 'long');
    expect(filteredIds(p)).toEqual(['b']);
    setControl(p, 'f-q', 'nobody');
    p.call('render');
    expect(p.body()).toContain('No recorded game matches these filters.');
    expect(p.doc.getElementById('filter-count')?.textContent).toBe('0 of 2 recorded games');
  });
  test('the filters at their edges: one bot, no humans, bots held as nothing, no realms, a sea share of 28', async () => {
    const p = await boot({
      rows: [
        anEntry('e', { setup: { realms: 3, humans: 0, bots: 1 } }),
        anEntry('f', { setup: { realms: 2, bots: '' } }),
        anEntry('g', { setup: { realms: 2, bots: 1, humans: 1, seaPct: 28 } }),
        anEntry('i', { setup: { realms: 0, humans: 2 } }),
      ],
    });
    const by = (id: string, value: string): unknown[] => {
      p.call('resetFilters');
      setControl(p, id, value);
      return filteredIds(p);
    };
    expect(by('f-kind', 'human')).toEqual(['f', 'i']);
    expect(by('f-kind', 'withbots')).toEqual(['e', 'g']);
    expect(by('f-kind', 'allbot')).toEqual(['e']);
    expect(by('f-bots', '0')).toEqual(['f', 'i']);
    expect(by('f-realms', '0')).toEqual([]);
    expect(by('f-sea', 'lo')).toEqual(['g']);
    by('f-humans', '1');
    p.call('render');
    expect(p.doc.getElementById('filter-count')?.textContent).toBe('1 of 4 recorded games');
  });
  test("the filters' choices: the numbers in order, the maps by their words", async () => {
    const p = await boot({
      rows: [
        anEntry('a', { setup: { bots: 10, realms: '4', humans: 1, cols: '9', rows: 7 } }),
        anEntry('b', { setup: { bots: 2, realms: 12, humans: null, mapSize: 'large' } }),
        anEntry('c', { setup: { bots: 9, realms: 4, cols: 12, rows: 0, mapSize: 'archipelago' } }),
      ],
    });
    const options = (id: string): string[] =>
      [...(p.doc.getElementById(id)?.querySelectorAll('option') ?? [])].map((o) => o.value);
    expect(options('f-bots')).toEqual(['', '2', '9', '10']);
    expect(options('f-realms')).toEqual(['', '4', '4', '12']);
    expect(options('f-humans')).toEqual(['', '1']);
    expect(options('f-map')).toEqual(['', '9×7', 'archipelago', 'large']);
  });
});

describe("the boards' sums and sorts, on a record's values as its row holds them", () => {
  test('the champions: a score and a rank held as words add as words; a name with no account; many realms', async () => {
    const st = (realm: string, more: Record<string, Json>): Json => ({ realm, ...more });
    const p = await boot({
      rows: [
        anEntry('a', {
          standings: [
            st('R1', { uid: 'u-1', rank: '2', score: '10', winner: true, titles: 'ab' }),
            st('R2', { player: 'Dun', rank: 1, score: 7, titles: 5 }),
            st('R2', { player: 'R2', score: 3 }),
          ],
        }),
        anEntry('b', { standings: [st('R3', { uid: 'u-1', rank: 1, score: 4 }), st('R4', { bot: true, score: 9 })] }),
        anEntry('c', { standings: [st('R5', { uid: 'u-1' }), st('R6', { uid: 'u-1' }), st('R7', { uid: 'u-1' })] }),
      ],
      names: [{ id: 'u-1', name: 'Ada' }],
    });
    p.call('setTab', 'champions');
    const rows = [...p.doc.querySelectorAll('#champ-table tr')].map((r) => r.textContent);
    expect(rows[1]).toBe('1Ada5120%210.5102R1, R3, R5, R6 +1');
    expect(rows[2]).toBe('2Dun100%11.07NaNR2');
    expect(rows).toHaveLength(3);
    expect(p.body()).toContain('Human realms7');
  });
  test('the champions: a tie on wins ordered by scores added as words; a profile with no name', async () => {
    const p = await boot({
      rows: [
        anEntry('a', {
          standings: [
            { uid: 'u-1', realm: 'A1', score: '5' },
            { uid: 'u-2', realm: 'B1', score: 20 },
          ],
        }),
        anEntry('b', {
          standings: [
            { uid: 'u-1', realm: 'A2', score: 6 },
            { uid: 'u-7', player: 'Pat', realm: 'C1' },
          ],
        }),
      ],
      names: [
        { id: 'u-1', name: 'Ada' },
        { id: 'u-2', name: 'Bo' },
        { id: 'u-7', name: null },
      ],
    });
    p.call('setTab', 'champions');
    const names = [...p.doc.querySelectorAll('#champ-table tr td:nth-child(2)')].map((c) => c.textContent);
    expect(names).toEqual(['Ada', 'Bo', 'Pat']);
  });
  test('the humans and bots, the finest campaigns and the games: a standing that is none stops the board', async () => {
    const rows = [anEntry('a', { standings: [{ realm: 'R1', score: 2 }] })];
    const p = await boot({ rows });
    rows.push(anEntry('b', { standings: [{ realm: 'R2', score: 1 }, null] }));
    expect(await refused(p.call('loadAll'))).toMatch(/^TypeError/);
    for (const tab of ['champions', 'games']) expect(thrown(() => p.call('setTab', tab))).toMatch(/^TypeError/);
    rows.splice(0, 2, anEntry('c', { standings: [null, { realm: 'R3', score: 1 }] }));
    expect(await refused(p.call('loadAll'))).toMatch(/^TypeError/);
  });
  test('the finest campaigns: a 0 in the standings reads as a human realm with nothing', async () => {
    const p = await boot({
      rows: [anEntry('a', { standings: [{ realm: 'R1', score: '5', prov: 3, str: 'x', titles: ['t'] }, 0] })],
    });
    p.call('setTab', 'champions');
    expect(p.body()).toContain('Human realms200%');
    expect(p.body()).toContain('1R1—53—1Game a');
    expect(p.body()).toContain('2————0Game a');
  });
  test('the achievements: labels sorted by their words, a skill record, a guardian power, a game with no name', async () => {
    const p = await boot({
      rows: [
        anEntry('a', {
          game_name: null,
          standings: [{ pi: 0, realm: 'Osk', race: 'Elf', al: 'Good' }],
          records: {
            sk_stealth: { v: 4, pi: 0, t: 3, det: 'at night', who: 'Lira' },
            most_heroes: { v: '1e999', pi: 0, t: 0 },
            guardian_slain: [{ v: 3.4, pi: 0 }, { v: '9' }],
            fastest_ten: [
              { v: 9, pi: 0 },
              { v: '4', pi: 1, realm: 'Old', player: 'P', bot: true },
            ],
          },
        }),
      ],
    });
    p.call('setTab', 'achievements');
    const text = p.body();
    expect(text).toContain('Highest stealth4Lira · Osk');
    expect(text).toContain('Elf · Good · turn 3 · at night ·  · 10 Oct 2026');
    expect(text).toContain('PowerfulOsk');
    expect(text).toContain('📖 Skills at their heightHighest stealth');
    expect(text).toContain('Largest courtMost living heroes serving at once—OskElf · Good · turn 0 ·');
    expect(text).toContain('Legendarythe game itself');
    expect(text).toMatch(/turn 4Old \(P\)/);
  });
  test('a label that is no words stops the board, as localeCompare did', async () => {
    const p = await boot({
      rows: [anEntry('a', { records: { most_land: { v: 2, lbl: 7 }, most_sea: { v: 1, lbl: 8 } } })],
    });
    expect(thrown(() => p.call('setTab', 'achievements'))).toMatch(/^TypeError/);
  });
  test('the search narrows the achievements to a realm, passing over a standing that is nothing', async () => {
    const p = await boot({
      rows: [
        anEntry('a', {
          standings: [0, { pi: 1, realm: 'Osk' }, { pi: 2, realm: 'Vey' }],
          records: {
            richest: [
              { v: 5, pi: 1 },
              { v: 9, pi: 2 },
            ],
          },
        }),
      ],
    });
    setControl(p, 'f-q', 'OSK');
    p.call('setTab', 'achievements');
    expect(p.body()).toContain('Showing only the realms and players matching your search');
    expect(p.body()).toContain('5Osk');
    expect(p.body()).not.toContain('Vey');
  });
  test("the achievements: each record's best entry first, the most where more is best and the least where less is", async () => {
    const p = await boot({
      rows: [
        anEntry('a', { records: { most_land: { v: 5, pi: 0 }, fastest_ten: { v: 20, pi: 0, d: 'min' } } }),
        anEntry('b', { records: { most_land: { v: 9, pi: 0 }, fastest_ten: { v: 80, pi: 0, d: 'min' } } }),
      ],
    });
    p.call('setTab', 'achievements');
    const firstOf = (words: string): unknown => {
      const card = [...p.doc.querySelectorAll('.ach')].find((c) => c.querySelector('.n')?.textContent === words);
      return card?.querySelector('li .v')?.textContent;
    };
    expect(firstOf('Most land provinces held at once')).toBe('9');
    expect(firstOf('Earliest turn a realm reached ten')).toBe('turn 20');
  });
  test('the champions: a third place counts as a finish in the top 3', async () => {
    const p = await boot({
      rows: [anEntry('a', { standings: [{ uid: 'u-1', realm: 'R1', rank: 3, score: 4 }] })],
      names: [{ id: 'u-1', name: 'Ada' }],
    });
    p.call('setTab', 'champions');
    const cells = [...p.doc.querySelectorAll('#champ-table tr:nth-child(2) td')].map((c) => c.textContent);
    expect(cells[1]).toBe('Ada');
    expect(cells[5]).toBe('1');
  });
  test('the races and creeds: sums held as words, a game with no victory and no turns', async () => {
    const p = await boot({
      rows: [
        anEntry('a', {
          victory: null,
          turns: null,
          setup: { realms: '3' },
          standings: [
            { race: 'Elf', al: 'Good', score: '10', prov: '2', winner: true },
            { race: 'Elf', score: 5, prov: 4 },
            { al: 'Evil' },
          ],
        }),
        anEntry('b', { victory: null, turns: 8, setup: { realms: 2 } }),
        anEntry('c', { victory: '', turns: 2, setup: { realms: 1 } }),
      ],
    });
    p.call('setTab', 'peoples');
    const text = p.body();
    expect(text).toContain('Elf2150%5312');
    expect(text).toContain('Elf · Good11100%102');
    expect(text).toContain('unfinished300%3107');
  });
  test('the games: a missing turn count, a sea share, a bot winner, a fate and the totals held as words', async () => {
    const p = await boot({
      rows: [
        anEntry('a', {
          turns: 0,
          victory: null,
          winner_realm: null,
          winner_is_bot: true,
          setup: { realms: 3, bots: 1, seaPct: '30', cols: 5, rows: 4 },
          standings: [
            { rank: 0, realm: 'R1', outHow: 'conceded', outTurn: 4, titles: 'xy' },
            { realm: 'R2', outHow: 'eliminated', bot: true },
          ],
          totals: { battles: '3', spells: null, deaths: 0 },
          winner_player: 'Wyn',
        }),
        anEntry('b', {
          finished_at: 'soon',
          winner_realm: '',
          victory: '',
          standings: [
            { realm: 'Q1', player: 'Quill' },
            { realm: 'Q2', player: 'Wren', winner: true },
          ],
        }),
      ],
      names: [{ id: 'u-7', name: null }],
    });
    p.call('setTab', 'games');
    const text = p.body();
    expect(text).toContain('Game a—3 (2👤 1🤖)1normal5×4 · 30% sea— (Wyn)—');
    expect(text).toContain('—Game b122 (2👤 0🤖)all human—— (Wren)—');
    expect(text).toContain('—R1———————2conceded turn 4');
    expect(text).toContain('eliminated');
    expect(text).toContain('3 battles · 0 units destroyed');
  });
});

describe("the Game Master's diagnostics and edits", () => {
  test('the diagnostics: an older build, a row with no build or date, the names no profile holds', async () => {
    const p = await boot({
      gm: true,
      rows: [
        anEntry('a', { build: null, finished_at: null, standings: [{ uid: 'u-1', realm: 'R' }, 0] }),
        anEntry('b', { build: 'lb1', standings: [{ realm: 'S', player: 'S' }] }),
        anEntry('c', { build: 'lb2', standings: [{ uid: 'u-3', realm: 'T' }] }),
        anEntry('d', { build: '', standings: [{ realm: 'U' }] }),
      ],
      names: [{ id: 'u-2', name: 'Bo' }],
    });
    const text = p.body();
    expect(text).toContain('3 of 4 games were recorded by an older build');
    expect(text).toContain('Newest row built bylb1');
    expect(text).toMatch(/Builds present\s*unknown · lb1 · lb2\s*Human/);
    expect(text).toContain('2 player slots carry an account, but none of them matches');
  });
  test('the edit box of a game with no date or note, opened and closed; a game shown and hidden', async () => {
    const p = await boot({ gm: true, rows: [anEntry('a', { finished_at: null, note: null })] });
    p.call('setTab', 'games');
    const date = p.doc.getElementById('e-date-a') as HTMLInputElement | null;
    expect(date?.value).toBe('');
    p.call('toggleEdit', 'a');
    expect(p.doc.getElementById('det-a')?.style.display).toBe('table-row');
    expect(p.doc.getElementById('edit-a')?.style.display).toBe('block');
    p.call('toggleEdit', 'a');
    expect(p.doc.getElementById('edit-a')?.style.display).toBe('none');
    await p.call('setHidden', 'a', true);
    expect(p.changes).toContainEqual({ table: 'game_records', op: 'update', payload: { hidden: true } });
    expect(p.body()).toContain('No recorded game matches these filters.');
  });
  test('Save: the name and note trimmed, empty ones none, the date at noon; then the board again', async () => {
    const p = await boot({ gm: true, rows: [anEntry('a', {})] });
    p.call('setTab', 'games');
    setControl(p, 'e-name-a', '  ');
    setControl(p, 'e-note-a', '  ');
    setControl(p, 'e-date-a', '2026-03-04');
    await p.call('saveGame', 'a');
    expect(p.changes.at(-1)).toEqual({
      table: 'game_records',
      op: 'update',
      payload: { game_name: null, note: null, finished_at: '2026-03-04T12:00:00.000Z' },
    });
    expect(p.doc.getElementById('e-msg-a')?.textContent).toBe('Saved.');
    await wait(600);
    expect(p.body()).toContain('4 Mar 2026');
    p.call('setTab', 'games');
    p.doc.getElementById('e-msg-a')?.remove();
    expect(await refused(p.call('saveGame', 'a'))).toMatch(/^TypeError/);
  });
  test('Save refused: the refusal in the box', async () => {
    const p = await boot({
      gm: true,
      rows: [anEntry('a', {})],
      db: (db) => ({
        ...db,
        theHallOfFame: {
          ...db.theHallOfFame,
          changeThisGamesEntry: () => Promise.resolve({ data: null, error: { message: 'no <b>' }, status: 403 }),
        },
      }),
    });
    p.call('setTab', 'games');
    await p.call('saveGame', 'a');
    expect(p.doc.getElementById('e-msg-a')?.textContent).toBe('no <b>');
    await p.call('setHidden', 'a', true);
    expect(p.errors).toContain('alert: no <b>');
  });
  test('Remove and Delete: the entry, then its results and turns; a refusal named; cancelled, nothing', async () => {
    const p = await boot({ gm: true, rows: [anEntry('a', {}), anEntry('b', {})] });
    await p.call('deleteRecord', 'a', true);
    expect(p.changes.filter((c) => c.op === 'delete').map((c) => c.table)).toEqual([
      'game_records',
      'game_results',
      'turn_events',
    ]);
    expect(filteredIds(p)).toEqual(['b']);
    const refused = await boot({
      gm: true,
      rows: [anEntry('a', {})],
      db: (db) => ({
        ...db,
        theStatistics: {
          ...db.theStatistics,
          deleteThisGamesResults: () => Promise.resolve({ data: null, error: null, status: 204 }),
        },
        theHallOfFame: {
          ...db.theHallOfFame,
          deleteThisGamesEntry: () => Promise.resolve({ data: null, error: { message: 'kept' }, status: 403 }),
        },
      }),
    });
    await refused.call('deleteRecord', 'a', true);
    expect(refused.errors).toContain('alert: kept');
    expect(filteredIds(refused)).toEqual(['a']);
    const kept = await boot({ gm: true, confirm: false, rows: [anEntry('a', {})] });
    await kept.call('deleteRecord', 'zz', false);
    expect(kept.changes.filter((c) => c.op === 'delete')).toEqual([]);
    expect(filteredIds(kept)).toEqual(['a']);
  });
  test('the Overlord renames a player: cancelled, empty, refused, done', async () => {
    const rows = [anEntry('a', { standings: [{ uid: 'u-1', realm: 'R' }] })];
    const cancelled = await boot({ overlord: true, prompt: null, rows });
    await cancelled.call('renamePlayer', 'u-1');
    expect(cancelled.changes.filter((c) => c.rpc === 'rename_player')).toEqual([]);
    const empty = await boot({ overlord: true, prompt: '  ', rows });
    await empty.call('renamePlayer', 'u-1');
    expect(empty.doc.getElementById('rename-msg')?.textContent).toBe('A player needs a name — nothing changed.');
    const done = await boot({ overlord: true, prompt: ' Bea ', rows, names: [{ id: 'u-1', name: 'Ann' }] });
    await done.call('renamePlayer', 'u-1');
    expect(done.prompted).toEqual(['Ann']);
    expect(done.changes).toContainEqual({ rpc: 'rename_player', args: { p_user: 'u-1', p_name: 'Bea' } });
    expect(done.doc.getElementById('rename-msg')?.textContent).toBe('Renamed to Bea — on every game they have played.');
  });
});

describe('the reads that fail, and the page with nothing to show', () => {
  test('no session read, no GM check, no names: the board as a visitor sees it', async () => {
    const throws = (): Promise<never> => Promise.reject(new Error('offline'));
    const p = await boot({
      gm: true,
      rows: [anEntry('a', { standings: [{ realm: 'R', player: 'Pell' }] })],
      db: (db) => ({
        ...db,
        signingIn: { ...db.signingIn, theSessionKeptInThisBrowser: throws },
        theAccountsNames: { ...db.theAccountsNames, theNameOfEveryAccount: throws },
      }),
    });
    expect(p.doc.getElementById('gm-pill')?.innerHTML).toBe('');
    expect(p.body()).toContain('Pell');
    const noGm = await boot({
      gm: true,
      rows: [anEntry('a', {})],
      db: (db) => ({
        ...db,
        theRoles: { ...db.theRoles, isTheSignedInAccountTheOverlord: throws },
        theAccountsNames: {
          ...db.theAccountsNames,
          theNameOfEveryAccount: () => Promise.resolve({ data: null, error: null, status: 200 }),
        },
      }),
    });
    expect(noGm.doc.getElementById('gm-pill')?.innerHTML).toBe('');
  });
  test('the entries unread: the refusal named; none at all: the board empty', async () => {
    const refused = await boot({
      rows: [],
      db: (db) => ({
        ...db,
        theHallOfFame: {
          ...db.theHallOfFame,
          everyEntryNewestFinishedFirstFromRowToRow: () =>
            Promise.resolve({ data: null, error: { message: 'no table' }, status: 404 }),
        },
      }),
    });
    expect(refused.doc.getElementById('msg')?.textContent).toContain('could not be read. no table');
    const thrown = await boot({
      rows: [],
      db: (db) => ({
        ...db,
        theHallOfFame: {
          ...db.theHallOfFame,
          everyEntryNewestFinishedFirstFromRowToRow: () => Promise.reject(new Error('')),
        },
      }),
    });
    expect(thrown.doc.getElementById('msg')?.textContent).toContain('could not be read. Error');
    const none = await boot({
      rows: [],
      db: (db) => ({
        ...db,
        theHallOfFame: {
          ...db.theHallOfFame,
          everyEntryNewestFinishedFirstFromRowToRow: () => Promise.resolve({ data: null, error: null, status: 200 }),
        },
      }),
    });
    expect(none.doc.getElementById('msg')?.textContent).toContain('No finished games have been recorded yet.');
    expect(none.doc.getElementById('foot')?.textContent).toBe('');
  });
  test('an element the page reads that is missing stops it, as reading it did', async () => {
    const p = await boot({ rows: [anEntry('a', {})] });
    p.doc.getElementById('f-kind')?.remove();
    expect(thrown(() => p.call('filtered'))).toMatch(/^TypeError/);
    p.doc.getElementById('foot')?.remove();
    expect(thrown(() => p.call('render'))).toMatch(/^TypeError/);
  });
});
