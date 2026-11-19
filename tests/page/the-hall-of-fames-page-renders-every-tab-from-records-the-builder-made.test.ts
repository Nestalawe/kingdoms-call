// The Hall of Fame's page renders every tab, filter and Game Master's control from records the GM page's own builder
// made (buildGameRecords in src/ui/gm/hall-of-fame.ts), not from entries written by hand: the end-to-end check of the
// two halves, the builder's records and the board that reads them. Two parts, until plan P1-14z two scripts that cut
// the builder out of the file and ran it in a vm of their own:
// - leaderboard-render: 14 made-up games of 2 to 8 realms, one hidden, rendered to a visitor and in GM mode (?gm=1):
//   every tab shows a board and no `undefined`, `NaN` or `[object Object]`; the hidden game only for a GM who asks for
//   it; each filter keeps only the games it names; a GM's save, hide, remove and delete send the right writes. The
//   games come from a fixed seed (99) of the test's own: every run builds the same games, so the outcome is no luck.
// - leaderboard-realm-bests, its page half (its unit half: the builder's unit test): the game of
//   tests/lib/a-finished-game-of-two-realms-each-holding-its-own-best.ts on the board, where a search for a realm shows
//   only its own entries (ruling R-087).
// The builder runs on the engine's real tables; computeStandings is stood in (as the scripts' sandboxes did), so the
// games hold the Imperial Titles. Level 4 (page): the board boots in jsdom on the fake database (tests/lib/fake-db.ts)
// holding the records built. The board's other page test (the-hall-of-fames-page-on-the-values-handed-it) checks each
// line on entries written by hand, and the builder's unit test each record on values handed it; only here do the two
// meet, so no lower level can hold this.
import '../lib/the-whole-engine.ts';
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { bootJsdom, DB_VERSION, readPage, type PageWindow } from '../lib/boot.ts';
import { makeAFakeDbHoldingTheHallOfFame, type AChangeTheHallOfFameSent } from '../lib/fake-db.ts';
import {
  theGameOfTwoRealmsEachHoldingItsOwnBest,
  theThroneHeldByAshvale,
} from '../lib/a-finished-game-of-two-realms-each-holding-its-own-best.ts';
import { computeStandings } from '../../src/engine/titles/reckoning.ts';
import type { AHallOfFameEntry } from '../../src/db/the-db-interface-and-its-areas.ts';
import type { TheStateAsTheHallOfFameReadsIt } from '../../src/ui/gm/hall-of-fame.ts';

vi.mock('../../src/engine/titles/reckoning.ts', { spy: true });

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

let hof: typeof import('../../src/ui/gm/hall-of-fame.ts');
/** The builder's module, imported in Node once the GM page's config, the `supabase` global and a Db are stood in. */
async function theBuildersModule(): Promise<typeof import('../../src/ui/gm/hall-of-fame.ts')> {
  const { window } = bootJsdom('<!doctype html><html><body></body></html>');
  Object.assign(globalThis, {
    window,
    document: window['document'],
    HTMLElement: window['HTMLElement'],
    KC_CONFIG: { supabaseUrl: 'https://example.org', supabaseKey: 'a-made-up-key' },
    supabase: { createClient: () => ({}) },
    kcTheDbATestHandsThePage: { theDatabasesVersion: {} },
    currentUser: { id: 'gm-1' },
  });
  return import('../../src/ui/gm/hall-of-fame.ts');
}
/** A world of any shape, as a save of any age may hold one (the builder's type claims more of it). */
const aStateOfAnyShape = (state: object): TheStateAsTheHallOfFameReadsIt => state;
/** A built record as the database keeps it, through JSON; `hidden` as a GM set it. */
const asTheDatabaseKeepsIt = (row: unknown, hidden: boolean): AHallOfFameEntry => ({
  ...(JSON.parse(JSON.stringify(row)) as AHallOfFameEntry),
  ...(hidden ? { hidden } : {}),
});

// ── the 14 made-up games of leaderboard-render, from its seed and its draws, in its order ──────────────────────────
let seed = 99;
const rnd = (): number => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const pick = <T>(a: readonly T[]): T | undefined => a[Math.floor(rnd() * a.length)];
const RACES = ['Human', 'Elven', 'Dwarven', 'Orcish'];
const ALIGNS = ['Divine', 'Good', 'Evil', 'Druidic'];
// The script's seven made-up kinds, each now a real one of the class its stood-in tables gave it (missile, cavalry, a
// carrier at sea, a flying monster, a flying creature, a primal sea beast, foot of no class), so the builder's class
// records are reached on the engine's own tables.
const TYPES = [
  'Yeoman Longbows',
  'Free Lances',
  'Galleon Fleet',
  'Elder Dragons',
  'Crimson Rocs',
  'Whale Cohort',
  'Shieldwall Levies',
];
/** The seven skills of the script's stood-in table, in its order (one draw each). */
const SKILLS = ['melee', 'archery', 'tactical', 'white', 'necromancy', 'thief', 'naval'];
function aSnapshot(n: number) {
  const characters = [];
  for (let i = 0; i < n; i++) {
    const units = [];
    for (let u = 0; u < Math.floor(rnd() * 7); u++)
      units.push({
        t: pick(TYPES),
        q: pick(['Green', 'Average', 'Veteran', 'Elite']),
        ...(rnd() < 0.2 ? { sk: 1 } : {}),
      });
    const skills: Record<string, number> = {};
    SKILLS.forEach((k) => {
      if (rnd() < 0.5) skills[k] = 1 + Math.floor(rnd() * 9);
    });
    characters.push({
      id: i + 1,
      name: 'Hero ' + String(i + 1),
      king: i === 0,
      hp: 20 + Math.floor(rnd() * 30),
      maxHp: 40 + Math.floor(rnd() * 40),
      skills,
      units,
      items: ['Ring of Mist', 'Blade of Dawn'].slice(0, Math.floor(rnd() * 3)),
    });
  }
  return {
    gold: Math.floor(rnd() * 900),
    provinces: Math.floor(rnd() * 20),
    land: Math.floor(rnd() * 15),
    sea: Math.floor(rnd() * 5),
    tax: Math.floor(rnd() * 60),
    taxShare: Math.round(rnd() * 800) / 10,
    heroes: n - 1,
    units: Math.floor(rnd() * 40),
    str: Math.floor(rnd() * 600),
    garStr: Math.floor(rnd() * 200),
    items: Math.floor(rnd() * 8),
    relics: Math.floor(rnd() * 3),
    discoveries: Math.floor(rnd() * 12),
    consecrated: Math.floor(rnd() * 4),
    explored: Math.floor(rnd() * 40),
    characters,
  };
}
function aTurnsOutcomes(pi: number, np: number) {
  const bl = [];
  for (let i = 0; i < Math.floor(rnd() * 4); i++) {
    const atk = rnd() < 0.5;
    bl.push({
      prov: i,
      terrain: pick(['plains', 'forest', 'hills', 'sea']),
      kind: pick(['pvp', 'neutral', 'garrison']),
      atkPi: atk ? pi : (pi + 1) % np,
      defPi: atk ? (pi + 1) % np : pi,
      atkStr: 20 + Math.floor(rnd() * 400),
      defStr: 20 + Math.floor(rnd() * 400),
      atkUnits: Math.floor(rnd() * 12),
      defUnits: Math.floor(rnd() * 12),
      won: rnd() < 0.5,
      atkLost: Math.floor(rnd() * 6),
      defLost: Math.floor(rnd() * 6),
      carry: Math.floor(rnd() * 3),
      side: atk ? 'atk' : 'def',
      win: rnd() < 0.5,
    });
  }
  const en = [];
  for (let i = 0; i < Math.floor(rnd() * 3); i++)
    en.push({
      pi,
      charId: 1,
      prov: 2,
      feature: 'A ruined tower',
      guardian: pick(['Cave Wyrm', 'Frost Troll', 'Ancient Lich', 'Bone Drake']),
      power: pick(['Weak', 'Moderate', 'Powerful', 'Legendary']),
      won: rnd() < 0.65,
      fled: rnd() < 0.15,
      dmg: Math.floor(rnd() * 35),
      hpAfter: 1 + Math.floor(rnd() * 30),
      killed: rnd() < 0.08,
      tactics: ['ME'],
    });
  const cp = [];
  for (let i = 0; i < Math.floor(rnd() * 3); i++)
    cp.push({
      prov: i,
      terrain: pick(['plains', 'forest', 'sea']),
      tax: 1 + Math.floor(rnd() * 8),
      from: (pi + 1) % np,
      to: pi,
    });
  const de = [];
  for (let i = 0; i < Math.floor(rnd() * 2); i++)
    de.push({
      charId: 3,
      name: 'Rival',
      pi: (pi + 1) % np,
      king: rnd() < 0.25,
      killerPi: pi,
      killerId: 1,
      how: 'character',
    });
  const sp = [];
  for (let i = 0; i < Math.floor(rnd() * 4); i++)
    sp.push({
      pi,
      charId: 1,
      spell: pick(['Fireball', 'Curse', 'Resurrect', 'Lightning Bolt', 'Plague']),
      school: 'Elemental',
      lvl: 1 + Math.floor(rnd() * 5),
      chance: 5 + Math.floor(rnd() * 90),
      ok: rnd() < 0.6,
    });
  return {
    battles: {
      fought: bl.length,
      asAttacker: 1,
      won: bl.filter((b) => b.win).length,
      unitsLost: Math.floor(rnd() * 9),
      unitsKilled: Math.floor(rnd() * 9),
      list: bl,
    },
    encounters: {
      fought: en.length,
      won: en.filter((e) => e.won).length,
      fled: en.filter((e) => e.fled).length,
      heroKilled: 0,
      list: en,
    },
    captures: { gained: cp.length, lost: Math.floor(rnd() * 3), list: cp },
    deaths: { own: Math.floor(rnd() * 2), king: false, killed: de.length, list: de },
    spells: { cast: sp.length, ok: sp.filter((s) => s.ok).length, list: sp },
    delta: {
      gold: Math.floor(rnd() * 300 - 100),
      provinces: 1,
      tax: 2,
      units: 1,
      str: Math.floor(rnd() * 90 - 20),
      heroes: 0,
      items: 0,
      discoveries: 0,
      explored: 1,
    },
    rank: 1,
    score: Math.floor(rnd() * 300),
  };
}
/** The standings stood in for the 14 games, as the script's sandbox gave them: a holder for each of the four titles. */
const fourTitlesHeld = (): ReturnType<typeof computeStandings> => ({
  titles: {
    throne: { playerIndex: 0, merit: 44, charId: 1, prize: 0, name: 'The Throne' },
    marshal: { playerIndex: 1, merit: 31, charId: 2, prize: 0, name: 'The Marshal' },
    vault: { playerIndex: 0, merit: 820, charId: 1, prize: 0, name: 'The Vaultkeeper' },
    sea: { playerIndex: 2, merit: 12, charId: 2, prize: 0, name: 'The Sea' },
  },
  relics: [],
  standings: [],
  taxByPlayer: [],
  worldTax: 0,
  goldByPlayer: [],
  threshold: 0,
  perChar: {},
});
const NAMES = ['Alice', 'Bruno', 'Cara', 'Dev', 'Eli'];
/** The 14 games' records, the last one hidden: built once, from the seed. */
function theFourteenGamesRecords(): AHallOfFameEntry[] {
  seed = 99;
  const rows: AHallOfFameEntry[] = [];
  vi.mocked(computeStandings).mockImplementation(fourTitlesHeld);
  try {
    for (let i = 0; i < 14; i++) {
      const np = 2 + Math.floor(rnd() * 7);
      const nb = Math.floor(rnd() * (np + 1));
      const turns = 4 + Math.floor(rnd() * 22);
      const dip = rnd() < 0.5 ? 'hostile' : 'normal';
      const results = [];
      const players = [];
      const events = [];
      for (let pi = 0; pi < np; pi++) {
        const bot = pi >= np - nb;
        const result = {
          game_id: 'g' + String(i),
          game_name: 'The War of ' + String(i),
          player_index: pi,
          is_bot: bot,
          bot_difficulty: bot ? 'hard' : null,
          realm: 'Realm ' + String.fromCharCode(65 + pi),
          race: pick(RACES),
          alignment: pick(ALIGNS),
          rank: pi + 1,
          score: Math.floor(rnd() * 500),
          winner: pi === 0,
          victory: pick(['reckoning', 'elimination', 'concession']),
          turns,
          out_turn: rnd() < 0.3 ? 1 + Math.floor(rnd() * turns) : null,
          out_how: rnd() < 0.3 ? pick(['eliminated', 'conceded']) : null,
          setup: {
            mapSize: pick(['p4', 'p5', 'p6', 'p8']),
            cols: pick([9, 12, 15, 17]),
            rows: pick([7, 7, 8]),
            seaPct: pick([20, 35, 50]),
            realms: np,
            bots: nb,
            humans: np - nb,
            difficulty: 'hard',
            diplomacy: dip,
          },
          final: aSnapshot(1 + Math.floor(rnd() * 3)),
          created_at: new Date(Date.UTC(2026, 7 + (i % 2), 1 + i)).toISOString(),
        };
        results.push(result);
        players.push({
          player_index: pi,
          user_id: bot ? null : 'u' + String(pi),
          display_name: bot ? null : NAMES[pi % 5],
        });
        for (let t = 1; t <= turns; t++)
          events.push({
            turn: t,
            player_index: pi,
            is_bot: bot,
            realm: 'Realm ' + String.fromCharCode(65 + pi),
            race: result.race,
            alignment: result.alignment,
            post: aSnapshot(1 + Math.floor(rnd() * 3)),
            outcomes: aTurnsOutcomes(pi, np),
          });
      }
      const gameRow = {
        id: 'g' + String(i),
        name: 'The War of ' + String(i),
        gm_user_id: 'gm-1',
        created_at: new Date(Date.UTC(2026, 6, 1 + i)).toISOString(),
        max_turns: turns,
      };
      const gs = aStateOfAnyShape({
        players: new Array(np).fill(0).map(() => ({})),
        characters: [
          { id: 1, name: 'Aldric the Bold' },
          { id: 2, name: 'Bryn Stormcaller' },
        ],
        botDiplomacy: dip,
        botDifficulty: 'hard',
        world: { cols: 12, rows: 7 },
      });
      const row = hof.buildGameRecords('g' + String(i), gameRow, players, results, events, gs);
      if (!row) throw new Error('no record for game ' + String(i));
      rows.push(asTheDatabaseKeepsIt(row, i === 13));
    }
  } finally {
    vi.mocked(computeStandings).mockRestore();
  }
  return rows;
}

let ROWS: AHallOfFameEntry[] = [];
beforeAll(async () => {
  hof = await theBuildersModule();
  ROWS = theFourteenGamesRecords();
});

test("the records built hold the four titles stood in and each class's host, so the stand-in and the tables were reached", () => {
  const kinds = new Set(ROWS.flatMap((r) => Object.keys(r.records ?? {})));
  // a stand-in reaches only calls from other files: the titles show it reached the builder's
  expect([...kinds]).toEqual(
    expect.arrayContaining(['title_throne', 'title_marshal', 'title_vault', 'title_sea', 'grand_armada', 'sky_host']),
  );
  expect([...kinds]).toEqual(expect.arrayContaining(['beast_host', 'horse_host', 'arrow_storm']));
});

interface APage {
  readonly W: PageWindow;
  readonly doc: Document;
  readonly errors: string[];
  readonly call: (name: string, ...args: unknown[]) => unknown;
  readonly bodyHtml: () => string;
  readonly control: (id: string) => HTMLInputElement;
}
/** The board booted on `rows`, to a visitor or (`gm`) in GM mode, every page error, alert and console error noted. */
async function boot(rows: () => readonly AHallOfFameEntry[], changes: AChangeTheHallOfFameSent[], gm: boolean) {
  const errors: string[] = [];
  const { window: W } = bootJsdom(readPage('kingdoms-call-leaderboard.html'), {
    pretendToBeVisual: false,
    url: 'https://example.test/kingdoms-call-leaderboard.html' + (gm ? '?gm=1' : ''),
    supabase: { createClient: () => ({}) },
    db: makeAFakeDbHoldingTheHallOfFame(DB_VERSION, { rows, changes, signedIn: gm, isGm: gm }).db,
    setup(w) {
      w.addEventListener('error', (e) => errors.push(e.message));
      Object.assign(w, {
        confirm: () => true,
        alert: (m: string) => errors.push('alert: ' + m),
      });
      Object.assign(w.console, { error: (...a: unknown[]) => errors.push('console.error: ' + a.join(' ')) });
    },
  });
  await wait(400);
  const doc = W['document'] as Document;
  const call = (name: string, ...args: unknown[]): unknown => {
    const f: unknown = Reflect.get(W, name);
    if (typeof f !== 'function') throw new Error('no ' + name);
    return Reflect.apply(f, W, args);
  };
  const Input = W['HTMLInputElement'] as typeof HTMLInputElement;
  const Select = W['HTMLSelectElement'] as typeof HTMLSelectElement;
  const control = (id: string): HTMLInputElement => {
    const el = doc.getElementById(id);
    // a select's value and an input's are set alike; the checks below read only `value` and `checked`
    if (el instanceof Input || el instanceof Select) return el as HTMLInputElement;
    throw new Error('no control ' + id);
  };
  return { W, doc, errors, call, bodyHtml: () => doc.getElementById('body')?.innerHTML ?? '', control } satisfies APage;
}
/** A game on the board, as the filters read it. */
interface AGameFiltered {
  readonly game_id: string;
  readonly finished_at: string;
  readonly setup: {
    readonly bots?: number;
    readonly humans?: number;
    readonly realms?: number;
    readonly diplomacy?: string;
  };
}
/** The games the filters keep, from the page's own filtered(), read as the window's property (as the script read it:
 *  static/page-globals counts a name reached so, and this is the one test that reaches it). */
const filtered = (p: APage): readonly AGameFiltered[] => {
  const { W } = p;
  const f: unknown = W['filtered'];
  if (typeof f !== 'function') throw new Error('no filtered');
  return Reflect.apply(f, W, []) as readonly AGameFiltered[];
};

describe.each([
  ['to a visitor', false],
  ['in GM mode', true],
])('the 14 games built, %s', (_who, gm) => {
  let p: APage;
  const changes: AChangeTheHallOfFameSent[] = [];
  beforeAll(async () => {
    p = await boot(() => ROWS, changes, gm);
  });

  test('the board is shown, the spinner gone, and the GM pill says whether editing is on', () => {
    expect(p.doc.getElementById('spinner')?.style.display).toBe('none');
    expect(p.doc.getElementById('main')?.style.display).toBe('block');
    expect((p.doc.getElementById('gm-pill')?.innerHTML ?? '').includes('GM editing on')).toBe(gm);
  });
  test.each(['champions', 'achievements', 'peoples', 'games'])(
    'the %s tab: a board of more than 500 characters, with no undefined, NaN or [object Object] in it',
    (tab) => {
      p.call('setTab', tab);
      const html = p.bodyHtml();
      expect(html.length).toBeGreaterThan(500);
      expect(/.{0,60}(undefined|NaN|\[object Object\]).{0,60}/.exec(html)?.[0]).toBeUndefined();
    },
  );
  test('the hidden game is off the board', () => {
    p.call('setTab', 'games');
    expect(p.bodyHtml()).not.toMatch(/The War of 13/);
  });
  if (gm)
    test('"show hidden" ticked: the hidden game is on the board, and the edit controls are there', () => {
      p.control('f-hidden').checked = true;
      p.call('render');
      const html = p.bodyHtml();
      p.control('f-hidden').checked = false;
      p.call('render');
      expect(html).toMatch(/The War of 13/);
      expect(html).toMatch(/Remove from the board/);
    });
  else
    test('no edit controls are shown', () => {
      expect(p.bodyHtml()).not.toMatch(/Remove from the board/);
    });
  test('each filter keeps only the games it names, and clearing them gives the board back', () => {
    const before = filtered(p).length;
    const by = (id: string, value: string): readonly AGameFiltered[] => {
      p.control(id).value = value;
      p.call('render');
      return filtered(p);
    };
    expect(by('f-kind', 'human').filter((g) => (g.setup.bots ?? 0) !== 0)).toEqual([]);
    expect(by('f-kind', 'allbot').filter((g) => (g.setup.humans ?? 0) !== 0)).toEqual([]);
    by('f-kind', '');
    expect(by('f-diplo', 'hostile').filter((g) => g.setup.diplomacy !== 'hostile')).toEqual([]);
    by('f-diplo', '');
    expect(by('f-realms', '4').filter((g) => g.setup.realms !== 4)).toEqual([]);
    p.call('resetFilters');
    expect(filtered(p)).toHaveLength(before);
    const from = new Date('2026-09-01T00:00:00');
    expect(by('f-from', '2026-09-01').filter((g) => !(new Date(g.finished_at) >= from))).toEqual([]);
    p.call('resetFilters');
  });
  if (gm)
    test("a GM's save, hide, remove and delete each send their writes", async () => {
      const first = ROWS[0]?.game_id ?? '';
      const second = ROWS[1]?.game_id ?? '';
      changes.length = 0;
      p.call('setTab', 'games');
      p.call('toggleEdit', first);
      p.control('e-name-' + first).value = 'Renamed War';
      p.control('e-note-' + first).value = 'a note';
      p.control('e-date-' + first).value = '2026-05-04';
      await p.call('saveGame', first);
      await wait(60);
      const saved = changes.find((c) => c.op === 'update')?.payload;
      expect(saved).toMatchObject({ game_name: 'Renamed War', note: 'a note' });
      expect(saved).toHaveProperty('finished_at', expect.stringMatching(/2026-05-04/));
      changes.length = 0;
      await p.call('setHidden', first, true);
      expect(changes).toContainEqual(expect.objectContaining({ op: 'update', payload: { hidden: true } }));
      changes.length = 0;
      await p.call('deleteRecord', first, false);
      expect(changes.filter((c) => c.op === 'delete')).toHaveLength(1);
      expect(changes[0]?.table).toBe('game_records');
      changes.length = 0;
      await p.call('deleteRecord', second, true);
      expect(
        changes
          .filter((c) => c.op === 'delete')
          .map((c) => c.table)
          .sort(),
      ).toEqual(['game_records', 'game_results', 'turn_events']);
    });
  test('no page error, alert or console error on the way', () => {
    expect(p.errors).toEqual([]);
  });
});

describe("each realm's own best on the board, and a search for a realm (ruling R-087)", () => {
  let p: APage;
  /** The achievements' lists: each card's title and its entries' words. */
  const lists = (): { t: string; items: string[] }[] => {
    p.call('setTab', 'achievements');
    return [...p.doc.querySelectorAll('#body .ach')].map((a) => ({
      t: a.querySelector('.t')?.textContent ?? '',
      items: [...a.querySelectorAll('li')].map((li) => li.textContent),
    }));
  };
  beforeAll(async () => {
    const g = theGameOfTwoRealmsEachHoldingItsOwnBest;
    vi.mocked(computeStandings).mockImplementation(theThroneHeldByAshvale);
    let row: unknown;
    try {
      row = hof.buildGameRecords('g1', g.gameRow, g.players, g.results, g.events, aStateOfAnyShape(g.gs), g.names);
    } finally {
      vi.mocked(computeStandings).mockRestore();
    }
    p = await boot(() => [asTheDatabaseKeepsIt(row, false)], [], false);
  });
  test("the board lists both realms' battles of the same game", () => {
    const big = lists().find((a) => /battle/i.test(a.t) && a.items.some((t) => t.includes('500')));
    expect(big?.items.some((t) => t.includes('Brindmoor'))).toBe(true);
  });
  test("a search for a realm shows only its own entries, its fallen hero's Melee among them, and says so", () => {
    p.control('f-q').value = 'Brindmoor';
    p.call('render');
    const found = lists();
    const all = found.flatMap((a) => a.items);
    expect(all.length).toBeGreaterThan(0);
    expect(all.filter((t) => !t.includes('Brindmoor'))).toEqual([]);
    expect(found.some((a) => a.items.some((t) => t.includes('Fallowmere')))).toBe(true);
    expect(p.bodyHtml()).toMatch(/Showing only the realms and players matching your search/);
  });
  test('no page error on the way', () => {
    expect(p.errors).toEqual([]);
  });
});
