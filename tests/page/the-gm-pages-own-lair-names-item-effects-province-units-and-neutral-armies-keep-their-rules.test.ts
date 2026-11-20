// The GM page's own lair names, item effects, province units and neutral armies, read with the page's own functions
// and tables:
//   - the lair name picker (pickLairNameP), staged with every land name of its element already given out (the stock,
//     LAIR_POOLS_CAT_P, LAIR_POOLS_MONSTER_P, MONSTERS_P) and "Wolf Den" already a lair in the province, never
//     qualifies a base this province holds, and four more lairs there get four different bases (2026-10-13, item 4,
//     the ruling R-108);
//   - an amulet and a trinket with one effect (the Carved Bead and the Engineer's Blueprint, ALL_MAGIC_ITEMS_P) are one
//     effect to itemEffectKey (2026-10-13, item 5, the ruling R-052);
//   - the rulebook gives the rule "two units three times in four, three one time in four", and its table of land units
//     by terrain and race is the page's list (PROVINCE_ARMIES_P, less garrisons and KC_UNIT_CLASS.sea) (2026-10-14,
//     item 15);
//   - on one world the page made (2 realms on 8×5), every lair holds exactly one item, of its guardian's tier
//     (lairItemTier), and no two lairs within 3 provinces (hexDistP) hold the same effect; every neutral province
//     fields its most effective mix (botBattleForce) of its own units, as many as its wealth band gives
//     (neutralDefBand), and its guard leads exactly those (2026-10-13, items 5 and 13).
//
// Level 4 (page): the GM page booted in jsdom (tests/lib/boot.ts) on the fake database (tests/lib/fake-db.ts), its dice
// seeded from KC_SEED. The rules and tables are the engine's modules, and a unit test could read them there; but these
// calls are the last a test makes to twelve names the GM page keeps for its tests (src/ui/gm/globals.ts). Without them
// tests/static/page-globals.test.ts fails, and taking the names off is a change to src/, which plan P1-14z makes none
// of. The worlds' checks over every map size are the simulation tests on the engine's modules
// (tests/simulation/no-province-of-a-new-world-…, no-two-lairs-near-each-other-…, every-neutral-province-fields-… and
// an-ordinary-province-offers-…); this world's checks are the same functions'
// (tests/lib/the-lair-items-and-the-neutral-armies-a-new-world-deals.ts), and hold on any world. The rulebook is read
// from the built site, as the script read it.
//
// Until plan P1-14z these were checks of tests/lair-province-unique.test.js, tests/lair-effects-spread.test.js,
// tests/neutral-best-mix.test.js and tests/province-pools.test.js, on the booted GM page; each is kept as it was, with
// the scripts' page-errors check.
import { afterAll, beforeAll, expect, test } from 'vitest';
import { bootJsdom, DB_VERSION, readPage, type PageWindow } from '../lib/boot.ts';
import { makeAFakeDb } from '../lib/fake-db.ts';
import {
  theLairsItems,
  theNeutralArmies,
  type ANewWorld,
} from '../lib/the-lair-items-and-the-neutral-armies-a-new-world-deals.ts';
import { timeLimitGivenAsANumber } from '../lib/time-limits.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

let W: PageWindow;
const errors: string[] = [];

/** One of the page's functions, called from here. */
const aPageFunction =
  (f: unknown, name: string) =>
  (...args: unknown[]): unknown => {
    if (typeof f !== 'function') throw new Error(`the GM page has no function ${name}`);
    return Reflect.apply(f, undefined, args);
  };
/** A copy of what the page hands back, as plain data. */
const plain = (x: unknown): unknown => JSON.parse(JSON.stringify(x));
const asStrings = (x: unknown): string[] => (Array.isArray(x) ? x.map(String) : []);

/** The connectives a place-qualified lair name puts before its province's name (src/engine/names.ts). */
const CONNECTIVES = [
  'of',
  'beneath',
  'under',
  'below',
  'beyond',
  'within',
  'on the marches of',
  'in the shadow of',
  'at the roots of',
  'hard by',
];
/** A lair name's base: without a numbered suffix and without its place-qualifier. */
const baseOf = (name: string, province: string) => {
  const b = name.replace(/ \(\d+\)$/, '');
  for (const c of CONNECTIVES) {
    const s = ` ${c} ${province}`;
    if (b.endsWith(s)) return b.slice(0, -s.length);
  }
  return b;
};

let landStock = new Set<string>();
const picks: string[] = [];
let lairItems: ReturnType<typeof theLairsItems> = { lairs: 0, notOne: 0, wrongTier: 0, close: [] };
let neutralArmies: ReturnType<typeof theNeutralArmies> = {
  checked: 0,
  mixed: 0,
  weak: [],
  band: [],
  foreign: [],
  guard: [],
};

// Booted as the scripts booted it: the errors its scripts throw are kept, its console is silenced, and it is given
// 0.5 s; then its world of 2 realms (about 0.3 s on a laptop).
beforeAll(async () => {
  ({ window: W } = bootJsdom(readPage('kingdoms-call-gm-portal.html'), {
    supabase: { createClient: () => ({}) },
    db: makeAFakeDb([DB_VERSION]).db,
    seed: SEED,
    setup(w) {
      w.addEventListener('error', (e) => errors.push(e.error?.stack ?? e.message));
      w.console.error = (...a: unknown[]) => {
        const t = a.map(String).join(' ');
        if (/Could not load|stub|fetch/i.test(t)) return;
        errors.push('console.error: ' + t);
      };
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
    },
  }));
  await new Promise((resolve) => setTimeout(resolve, 500));

  // ── The name picker, staged: every land name already given out, and "Wolf Den" already a lair in this province ──
  const pools = W.eval('Object.values(LAIR_POOLS_CAT_P).flatMap(pl=>pl.land||[])');
  landStock = new Set(asStrings(pools));
  // a beast with no signature names of its own (LAIR_POOLS_MONSTER_P), so the picker reads its category's stock
  const wolf = W.eval("MONSTERS_P.find(m=>m.cat==='beast'&&!(LAIR_POOLS_MONSTER_P[m.name]||[]).length)") ?? {
    cat: 'beast',
  };
  const pick = aPageFunction(W['pickLairNameP'], 'pickLairNameP');
  const here = new Set(['Wolf Den']);
  for (let i = 0; i < 4; i++) {
    const nm = String(pick(wolf, 'forest', new Set(landStock), 'Karnholt', null, here));
    picks.push(nm);
    here.add(baseOf(nm, 'Karnholt'));
  }

  // ── One world the page made, read with the page's own functions ──
  const setups = aPageFunction(W['generateBotSetups'], 'generateBotSetups')([], 2, 0);
  const setup = (Array.isArray(setups) ? setups : []).map((b: { id: number; kingdomName: string }) => ({
    ...b,
    gamePlayerId: 'gp' + String(b.id),
    name: b.kingdomName,
  }));
  const made: unknown = await aPageFunction(W['generateNewGame'], 'generateNewGame')(setup, { cols: 8, rows: 5 }, 999, {
    seaPct: 25,
  });
  // `as`: the page's world, as the checks read it
  const S = plain(made) as ANewWorld;
  const lairItemTier = aPageFunction(W['lairItemTier'], 'lairItemTier');
  const hexDistP = aPageFunction(W['hexDistP'], 'hexDistP');
  lairItems = theLairsItems(S, 8, 3, {
    lairItemTier: (power) => Number(lairItemTier(power)),
    hexDistP: (a, b, cols) => Number(hexDistP(a, b, cols)),
  });
  const neutralDefBand = aPageFunction(W['neutralDefBand'], 'neutralDefBand');
  const botBattleForce = aPageFunction(W['botBattleForce'], 'botBattleForce');
  neutralArmies = theNeutralArmies(S, {
    seaUnits: asStrings(W.eval('KC_UNIT_CLASS.sea')),
    neutralDefBand: (tax) => asStrings(neutralDefBand(tax)).map(Number),
    botBattleForce: (G, c, armies, terrain, opts) => Number(botBattleForce(G, c, armies, terrain, opts)),
  });
}, timeLimitGivenAsANumber(15_000).timeout);
afterAll(() => {
  W.close();
});

test('the land name stock was read', () => {
  expect(landStock.has('Wolf Den')).toBe(true);
});
test('with every name taken, the picker never qualifies a base this province holds', () => {
  expect(picks.filter((n) => baseOf(n, 'Karnholt') === 'Wolf Den')).toEqual([]);
});
test('…and four more lairs there get four different bases', () => {
  expect(new Set(picks.map((n) => baseOf(n, 'Karnholt'))).size, picks.join(' / ')).toBe(4);
});

test('an amulet and a trinket with one effect count as the same effect', () => {
  const key = aPageFunction(W['itemEffectKey'], 'itemEffectKey');
  const bead = W.eval("ALL_MAGIC_ITEMS_P.find(i=>i.name==='Carved Bead')");
  const blue = W.eval("ALL_MAGIC_ITEMS_P.find(i=>i.name==='Engineer\\'s Blueprint')");
  expect(bead).toBeTruthy();
  expect(blue).toBeTruthy();
  expect(key(bead)).toBe(key(blue));
});

const theRulebook = () => readPage('kingdoms-call-rules.html');
test('the rulebook gives the 2-or-3 rule', () => {
  expect(theRulebook()).toMatch(/two units three times in four, three one time in four/);
});
test("the rulebook's table of units by terrain and race matches the game's list", () => {
  // The rulebook's table is the game's list, written out: every terrain and race, the same units.
  const tbl = /<caption>Land units a province can offer, by terrain and race<\/caption>([\s\S]*?)<\/table>/.exec(
    theRulebook(),
  )?.[1];
  expect(tbl, 'the table').toBeTruthy();
  const land = (t: string, r: string): string[] =>
    asStrings(
      W.eval(
        `((PROVINCE_ARMIES_P[${JSON.stringify(t)}]||{})[${JSON.stringify(r)}]||[]).filter(u=>!/garrison/i.test(u)&&!KC_UNIT_CLASS.sea.includes(u))`,
      ),
    );
  const TN = { plain: 'Plains', desert: 'Desert', forest: 'Forest', jungle: 'Jungle', mountain: 'Mountain' };
  const RS = ['Human', 'Elven', 'Dwarven', 'Orcish'];
  const wrong: string[] = [];
  for (const [t, name] of Object.entries(TN)) {
    const row = new RegExp('<tr><td>' + name + '</td>((?:<td>[^<]*</td>){4})</tr>').exec(tbl ?? '');
    if (!row) {
      wrong.push(name + ': no row');
      continue;
    }
    const cells = [...(row[1] ?? '').matchAll(/<td>([^<]*)<\/td>/g)].map((m) =>
      (m[1] ?? '').split(', ').filter(Boolean),
    );
    RS.forEach((r, i) => {
      if (JSON.stringify(cells[i]) !== JSON.stringify(land(t, r)))
        wrong.push(`${name} ${r}: "${(cells[i] ?? []).join(', ')}"`);
    });
  }
  expect(wrong).toEqual([]);
});

test("the page's world: every lair holds exactly one item, of its guardian's own tier", () => {
  expect(lairItems.lairs).toBeGreaterThan(0);
  expect(lairItems.notOne).toBe(0);
  expect(lairItems.wrongTier).toBe(0);
});
test("the page's world: no two lairs within 3 provinces hold the same effect", () => {
  expect(lairItems.close).toEqual([]);
});
test("the page's world: every neutral province fields its most effective mix", () => {
  expect(neutralArmies.checked).toBeGreaterThan(0);
  expect(neutralArmies.weak).toEqual([]);
});
test("the page's world: every neutral province keeps its wealth band's number of units", () => {
  expect(neutralArmies.band).toEqual([]);
});
test("the page's world: every unit is one the province itself offers, and each guard leads exactly them", () => {
  expect(neutralArmies.foreign).toEqual([]);
  expect(neutralArmies.guard).toEqual([]);
});
test('no page errors', () => {
  expect(errors.map((error) => error.split('\n')[0])).toEqual([]);
});
