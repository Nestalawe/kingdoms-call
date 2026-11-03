// 2026-10-08 (item 12): the price of hiring a wandering hero is the same in the turn report, the Hire Hero dropdown,
// the Broker list and the order ledger: the price the hire really charges. A hero who has grown while wandering asks a
// premium for skill on top of the alignment rate; the report quoted it, while the order form worked the price out from
// alignment alone and quoted less. The report's figure is
// unit/a-seasoned-wanderers-hire-price-in-the-report-counts-his-skill.test.ts.
//
// Level 4 (page): the dropdown, the list and the ledger are the player portal's own code (buildTargetField,
// computeOrderLedgerP and the order form, on its globals currentGamePlayer and currentReport), in modules that load the
// portal's start-up (which calls supabase.createClient as it loads), so only the booted page shows them: the portal
// booted in jsdom (tests/lib/boot.js) on the stand-in database (tests/lib/stub-db.js's cannedStub, which answers every
// read with nothing), given the report one real turn wrote. The turn is played on the engine's modules
// (tests/lib/a-staged-turn-on-the-engines-modules.ts) from KC_SEED, with a seasoned wanderer of realm 0's alignment
// staged in its capital.
//
// Until plan P1-14g this was tests/hire-price.test.js, which played the turn on the booted GM page. Its checks of the
// portal are kept as they were, and its staging checks with them; "page errors 0" is "no page error" and "throws
// nothing": a console.error fails the test (tests/setup/each.ts).
import { afterAll, beforeAll, expect, test } from 'vitest';
import { aStagedTurnOnTheEnginesModules } from '../lib/a-staged-turn-on-the-engines-modules.ts';
import { bootJsdom, readPage, type PageWindow } from '../lib/boot.js';
import { cannedStub } from '../lib/stub-db.js';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

interface Province {
  id: number;
  name: string;
  terrain: string;
  owner: number | null;
  row: number;
  col: number;
  characters?: number[];
}
interface World {
  players: { alignment: string; provinces?: number[] }[];
  characters: {
    id: number;
    player: number | null;
    alive: boolean;
    isKing?: boolean;
    location: number;
    [key: string]: unknown;
  }[];
  world: { cols: number; rows: number; provinces: Province[] };
}
interface Hero {
  id: number;
  isKing?: boolean;
  locationId?: number;
  locationName?: string;
}
interface Report {
  turn: number;
  kingdom: { alignment: string };
  characters?: Hero[];
  heroSightings?: { name: string; pay?: number }[];
  provinceOrderData?: Record<
    string,
    { availableHeroes?: { id: number; hireWage?: number; locationId: number; locationName: string }[] }
  >;
}

const errs: string[] = [];
let P: PageWindow;
beforeAll(async () => {
  P = bootJsdom(readPage('kingdoms-call-player-portal.html'), {
    supabase: { createClient: () => cannedStub({ rows: () => ({}), writes: [] }) },
    setup(w) {
      w.addEventListener('error', (e) => errs.push(e.error?.stack ?? e.message));
      w.console.error = (...a: unknown[]) => errs.push('console.error: ' + a.map(String).join(' '));
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
    },
  }).window;
  await new Promise((resolve) => setTimeout(resolve, 400));
});
afterAll(() => {
  P.close();
});

// The turn is played inside the test, so a console.error in it fails the test (tests/setup/each.ts reads a test's own).
test('the Hire Hero dropdown, the Broker list and the order ledger quote the price the report quotes', async () => {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { getNeighborsP } = await import('../../src/engine/world/map-helpers.ts');
  const r = sc.turn<World, number>({
    prepare(S) {
      const king = S.characters.find((c) => c.alive && c.player === 0 && c.isKing);
      const home = king && S.world.provinces[king.location];
      if (!king || !home) throw new Error('could not stage: a king in a province');
      // A seasoned wanderer of the realm's own alignment, standing in the capital: alignment rate 2g, and 15 skill
      // levels → a 3g premium.
      const id = Math.max(...S.characters.map((c) => c.id)) + 1;
      S.characters.push({
        id,
        name: 'Wenna the Seasoned (wandering)',
        player: null,
        alive: true,
        race: 'Human',
        alignment: S.players[0]?.alignment,
        temper: 'Brave',
        hp: 20,
        maxHp: 20,
        skills: { melee: 6, tactical: 5, march: 4 },
        items: [],
        armies: [],
        location: home.id,
        locationName: home.name,
        pay: 1,
      });
      home.characters = [...(home.characters ?? []), id];
      // Wanderers drift to a neighbouring province at the end of a turn (35%). Realm 0 holds every land province around
      // the capital, so wherever she ends up she is in sight and for hire — the report is the same whichever way the
      // drift falls, not a matter of luck.
      getNeighborsP(home, S.world.cols, S.world.rows, S.world.provinces)
        .filter((p) => p.terrain !== 'sea')
        .forEach((p) => {
          S.players.forEach((pl) => {
            pl.provinces = (pl.provinces ?? []).filter((x) => x !== p.id);
          });
          p.owner = 0;
          S.players[0]?.provinces?.push(p.id);
        });
      return id;
    },
  });
  const wennaId = r.extra;
  const rep = r.reports[0] as Report | undefined;
  expect(rep, 'realm 0 received a report').toBeDefined();
  if (!rep) return;
  const seen = (rep.heroSightings ?? []).find((s) => s.name.includes('Wenna'));
  const avail = Object.values(rep.provinceOrderData ?? {})
    .flatMap((pd) => pd.availableHeroes ?? [])
    .find((h) => h.id === wennaId);
  expect(seen && avail, 'the wanderer is in the report and offered for hire (staging)').toBeTruthy();
  if (!seen || !avail) return;
  const price = seen.pay;
  expect(price, 'the report quotes the full price: 2g alignment rate + 3g for skill = 5g').toBe(5);
  expect(avail.hireWage, 'the hire data carries the same price').toBe(price);

  // The player portal, rendering that report.
  P['__rep'] = rep;
  P.eval(`currentGamePlayer={id:'gpx',orders:null}; currentReport=__rep;`);
  // Hire Hero offers the heroes in the hirer's own province, and the order form lists only those; she may have drifted
  // out of the capital at the end of the turn, so the king (the hirer below) is placed where she stands before the form
  // is built. Either province is the realm's own.
  const king = (rep.characters ?? []).find((c) => c.isKing);
  if (!king) throw new Error('the report has no king');
  king.locationId = avail.locationId;
  king.locationName = avail.locationName;
  (P['buildOrdersForm'] as (chars: unknown, a: boolean, b: null, turn: number) => void)(
    P.eval('currentReport.characters'),
    false,
    null,
    rep.turn,
  );
  const doc = P['document'] as Document;
  const opt = (html: unknown) =>
    /<option[^>]*value="(?:hire:)?\d+"[^>]*>[^<]*Wenna[^<]*<\/option>/.exec(String(html))?.[0] ?? '';
  const plainText = (html: string) => {
    const el = doc.createElement('div');
    el.innerHTML = html;
    return el.textContent.trim();
  };
  const g = (html: unknown) => {
    const m = /(\d+)g\/turn/.exec(opt(html));
    return m ? Number(m[1]) : null;
  };
  const field = P['buildTargetField'] as (hero: Hero, slot: number, o: { action: string }) => unknown;
  const hireHtml = field(king, 0, { action: 'Hire Hero' });
  expect(g(hireHtml), `the Hire Hero dropdown quotes ${String(price)}g (${plainText(opt(hireHtml))})`).toBe(price);
  // The Broker list (a Neutral king) reads the same figure.
  P.eval(`currentReport.kingdom.alignment='Neutral';`);
  const brokerHtml = field(king, 0, { action: 'Broker' });
  expect(g(brokerHtml), `the Broker list quotes ${String(price)}g`).toBe(price);
  P.eval(`currentReport.kingdom.alignment=${JSON.stringify(rep.kingdom.alignment)};`);
  // The order ledger counts the same gold for a queued hire.
  const sel = doc.getElementById(`po-action-${String(king.id)}-0`) as HTMLSelectElement | null;
  if (sel) {
    if (![...sel.options].some((o) => o.value === 'Hire Hero')) {
      const o = doc.createElement('option');
      o.value = 'Hire Hero';
      sel.appendChild(o);
    }
    sel.value = 'Hire Hero';
    (P['onActionChange'] as (id: number, slot: number) => void)(king.id, 0);
    const t = doc.getElementById(`po-target-${String(king.id)}-0`) as HTMLSelectElement | null;
    if (t) t.value = String(wennaId);
  }
  const L = (P['computeOrderLedgerP'] as () => { cats?: { heroes?: { g?: number } } } | null)();
  expect(L?.cats?.heroes?.g, `the order ledger counts ${String(price)}g for the hire`).toBe(price);
  expect(errs, 'no page error').toEqual([]);
});
