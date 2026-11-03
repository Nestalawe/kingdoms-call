// 2026-10-15 (Toby, D1; R-110): another realm's hero sharing a province with one of yours at the end of the turn is
// always seen: their Spy can no longer slip them past your hero. Only Invisibility still hides them, and wandering
// heroes keep their small chance to slip by. Without a Spy you learn only the hero's name, the realm they serve and the
// rough size of their army, wherever they stand (your own land included): no race, alignment, renown or exact count.
// What a realm's turn data says (buildTurnReport, src/views/turn-report.ts, on what the realm may see: playerView):
//   • the map's characters (worldMeta), the hero sightings and the heroes its orders can target;
//   • the province character intelligence (provinceCharIntelOf, from the view's heroesInItsProvinceIntelligence): the
//     heroes the one sight rule (enemyCharVisibleTo) passes, in a province where it has a hero or that it spied, the
//     exact count for its own heroes and the rough size for anyone else's.
// And the warnings of a hero beside yours (generateIntrusionNotifications, src/engine/turn/intrusion-warnings.ts)
// give the same rough size, whatever the watcher's Spy. The map popup's words are
// page/the-player-portals-map-popup-gives-your-heros-count-and-another-realms-rough-size.test.ts; the rulebook's, and
// the player portal reading whether a target leads troops, static/the-rulebook-says-another-realms-hero-beside-yours-
// is-always-seen-and-only-roughly.test.ts.
//
// Level 1 (unit): buildTurnReport called on what realm 0 may see of a world the engine makes on its modules
// (tests/lib/a-staged-turn-on-the-engines-modules.ts) from KC_SEED, the heroes staged by the test in a free land
// province and in the realm's capital; the report-time Spy roll staged by stamping its result (_unspottedTurn) on the
// heroes, Invisibility by its own stamp (_invisTurn). The warnings: the function called on a hand-made state. Not
// lower: what each realm sees is computed from the world.
//
// Until plan P1-14g this was most of tests/sight-shared-province.test.js, which called buildTurnReport on the booted GM
// page. Its checks of the report are kept as they were; "the province character intel uses the one sight rule" and
// "…sends the exact count for your own heroes only", which read playerView's and provinceCharIntelOf's text, are the
// intelligence those functions build (plan P1-14's Decision 3); and the two of the warnings, which read the GM page's
// text, are a call to the warnings.
import { expect, test } from 'vitest';
import { aStagedTurnOnTheEnginesModules } from '../lib/a-staged-turn-on-the-engines-modules.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

interface Unit {
  type: string;
  quality: string;
}
interface Character {
  id: number;
  name: string;
  player: number | null;
  alive: boolean;
  race: string;
  location: number;
  armies: Unit[];
  isKing?: boolean;
  _unspottedTurn?: number | null;
  _invisTurn?: number;
  [key: string]: unknown;
}
interface Province {
  id: number;
  terrain: string;
  owner: number | null;
  characters: number[];
  [key: string]: unknown;
}
interface World {
  turn: number;
  players: { name: string; homeProvinceId: number }[];
  characters: Character[];
  world: { provinces: Province[] };
}
interface OnTheMap {
  id: number;
  ownerName?: string;
  armyBand?: string;
  armyCount?: number;
}
interface Sighting {
  name: string;
  type: string;
  armyBand?: string;
  race?: string;
  alignment?: string;
  topSkill?: unknown;
  text: string;
}
interface Target {
  id: number;
  armyBand?: string;
  leadsArmies?: boolean;
  [key: string]: unknown;
}
interface InTheIntelligence {
  name: string;
  category: string;
  armyBand?: string;
  armyCount?: number;
}
interface Report {
  worldMeta?: { provinces?: ({ id: number; characters?: OnTheMap[] } | null)[] };
  heroSightings?: Sighting[];
  visibleChars?: Target[];
  provinceCharIntel?: { provId: number; spied: boolean; characters: InTheIntelligence[] }[];
}

const army = (n: number): Unit[] =>
  Array.from({ length: n }, () => ({ type: 'Shieldwall Levies', quality: 'Average' }));

/** Realm 0's hero and realm 1's beside him, in a free land province (its local chieftain stays: he is not the
 *  subject), realm 1's leading four companies and stamped as having rolled to slip by unseen; a wanderer there, stamped
 *  so too; and the realm's capital. `report(itsLines?)` builds realm 0's turn data from what it may see. */
async function stage() {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { playerView } = await import('../../src/views/what-each-realm-may-see-of-the-world.ts');
  const { buildTurnReport } = await import('../../src/views/turn-report.ts');
  const { enemyCharVisibleTo } =
    await import('../../src/engine/sight/heroes-in-sight-features-discovered-and-army-size-bands.ts');
  const { S } = sc.world({ realms: 2 });
  const G = S as unknown as World;
  const P = G.world.provinces;
  const moveTo = (c: Character, p: Province) => {
    const old = P[c.location];
    if (old) old.characters = old.characters.filter((id) => id !== c.id);
    if (!p.characters.includes(c.id)) p.characters.push(c.id);
    c.location = p.id;
  };
  const mine = G.characters.find((c) => c.alive && c.player === 0);
  const theirs = G.characters.find((c) => c.alive && c.player === 1);
  const wild = P.find((p) => p.terrain !== 'sea' && p.owner == null);
  const home0 = P[G.players[0]?.homeProvinceId ?? -1];
  if (!mine || !theirs || !wild || !home0)
    throw new Error('could not stage: a hero for each realm, an unowned province and a capital');
  const T = G.turn;
  moveTo(mine, wild);
  moveTo(theirs, wild);
  theirs.armies = army(4);
  theirs._unspottedTurn = T;
  /** A copy of realm 1's hero, given the next id, standing in `p`. */
  const another = (p: Province, more: Partial<Character>): Character => {
    const c: Character = { ...(JSON.parse(JSON.stringify(theirs)) as Character), id: G.characters.length, ...more };
    G.characters.push(c);
    p.characters.push(c.id);
    c.location = p.id;
    return c;
  };
  const wander = another(wild, { player: null, name: 'Wanderer Test', armies: [], _unspottedTurn: T, isKing: false });
  const viewOf = (itsLines?: Record<string, unknown>) => playerView(S as never, 0, itsLines as never);
  const report = (itsLines?: Record<string, unknown>): Report =>
    buildTurnReport(viewOf(itsLines), (itsLines ?? null) as never);
  const chars = (rep: Report, id: number) => rep.worldMeta?.provinces?.find((r) => r?.id === id)?.characters ?? [];
  return { G, P, T, mine, theirs, wander, wild, home0, moveTo, another, viewOf, report, chars, enemyCharVisibleTo };
}

test("another realm's hero beside yours is on your map and in your sightings, with name, realm and rough size only", async () => {
  const { G, mine, theirs, wander, wild, report, chars } = await stage();
  const rep = report();
  const seen = chars(rep, wild.id).find((c) => c.id === theirs.id);
  expect(
    seen,
    "another realm's hero sharing a province with yours is on your map, though their Spy rolled to hide",
  ).toBeDefined();
  expect(seen?.ownerName, '…with the realm they serve').toBe(G.players[1]?.name);
  expect(seen?.armyBand, '…and the rough size of their army').toBe('a modest band');
  expect(seen && 'armyCount' in seen, '…but not the exact count').toBe(false);
  const own = chars(rep, wild.id).find((c) => c.id === mine.id);
  expect(own?.armyCount, 'your own hero still shows the exact count').toBe(mine.armies.length);
  expect(
    chars(rep, wild.id).some((c) => c.id === wander.id),
    'a wandering hero who rolled to slip by is still unseen',
  ).toBe(false);
  const sight = (rep.heroSightings ?? []).find((s) => s.name === theirs.name);
  expect(sight?.type, 'the hero sightings list them').toBe('enemy');
  expect(sight?.armyBand, '…with the rough size').toBe('leads a modest band');
  expect([sight?.race, sight?.alignment, sight?.topSkill].filter(Boolean), '…and no race, alignment or renown').toEqual(
    [],
  );
  expect(sight?.text, '…in the text too').not.toMatch(new RegExp(`${theirs.race}|renowned|legendary|heroic`, 'i'));
});

test('the heroes your orders can target follow the same rule, and a lone hero is listed as leading no troops', async () => {
  const { theirs, wander, report } = await stage();
  const vc = (report().visibleChars ?? []).find((x) => x.id === theirs.id);
  expect(vc, "another realm's hero beside yours is in the list your orders can target").toBeDefined();
  expect(
    { armyBand: vc?.armyBand, leadsArmies: vc?.leadsArmies },
    '…with the rough size and whether they lead troops',
  ).toEqual({ armyBand: 'a modest band', leadsArmies: true });
  const leak = ['race', 'alignment', 'armies', 'skills', 'temper', 'hp', 'maxHp', 'pay'].filter((k) => vc && k in vc);
  expect(leak, '…and nothing more').toEqual([]);
  expect(
    (report().visibleChars ?? []).some((x) => x.id === wander.id),
    'a wandering hero who rolled to slip by is not in the target list',
  ).toBe(false);
  // a lone hero of another realm (no troops): still nothing but name and realm
  theirs.armies = [];
  const lone = (report().visibleChars ?? []).find((x) => x.id === theirs.id);
  expect(lone, 'a lone hero of another realm is listed').toBeDefined();
  expect(
    { leadsArmies: lone?.leadsArmies, hp: lone && 'hp' in lone, temper: lone && 'temper' in lone },
    '…as leading no troops, with no hit points or temper',
  ).toEqual({ leadsArmies: false, hp: false, temper: false });
});

test('a hero under Invisibility is not seen, even beside your hero, nor in the target list', async () => {
  const { T, theirs, wild, report, chars } = await stage();
  theirs._invisTurn = T;
  const rep = report();
  expect(
    chars(rep, wild.id).some((c) => c.id === theirs.id) ||
      (rep.heroSightings ?? []).some((s) => s.name === theirs.name),
    'a hero under Invisibility is not seen, even beside your hero',
  ).toBe(false);
  expect(
    (rep.visibleChars ?? []).some((x) => x.id === theirs.id),
    '…nor in the target list',
  ).toBe(false);
});

test('an intruder leading troops in your land, with none of your heroes there, is seen by name, realm and rough size', async () => {
  const { G, theirs, wild, home0, moveTo, report } = await stage();
  // every hero of the realm stays out of its capital (in the wild province), so none of them stands beside the intruder
  G.characters
    .filter((c) => c.alive && c.player === 0)
    .forEach((c) => {
      moveTo(c, wild);
    });
  moveTo(theirs, home0);
  theirs._unspottedTurn = null;
  theirs.armies = army(1);
  const intruder = (report().heroSightings ?? []).find((s) => s.name === theirs.name);
  expect(intruder, 'an intruder leading troops in your land is seen').toBeDefined();
  const text = `("${intruder?.text ?? ''}")`;
  expect(
    [intruder?.race, intruder?.alignment, intruder?.topSkill].filter(Boolean),
    `…described only by name, realm and rough size: no race, alignment or renown ${text}`,
  ).toEqual([]);
  expect(intruder?.armyBand, `…and the rough size ${text}`).toBe('leads a small escort (a few units)');
});

test("the province character intelligence lists the heroes the one sight rule passes, the exact count for one's own only", async () => {
  const { G, P, T, mine, theirs, wander, wild, another, viewOf, report, enemyCharVisibleTo } = await stage();
  // beside them a second hero of realm 1's, under Invisibility; and a province no hero of realm 0's stands in, which it
  // spied this turn, holding a wanderer who rolled to slip by and another hero under Invisibility
  const veiled = another(wild, { name: 'Veiled Test', isKing: false, _invisTurn: T });
  const spied = P.find(
    (p) =>
      p.terrain !== 'sea' &&
      p.owner == null &&
      p.id !== wild.id &&
      !p.characters.some((id) => G.characters[id]?.player === 0),
  );
  if (!spied) throw new Error('could not stage: a second free land province');
  const spiedWanderer = another(spied, {
    player: null,
    name: 'Spied Wanderer Test',
    armies: [],
    _unspottedTurn: T,
    isKing: false,
  });
  const spiedVeiled = another(spied, { name: 'Spied Veiled Test', isKing: false, _invisTurn: T });
  const itsLines = {
    spiedProvincesAndTheirFirstPhase: { [spied.id]: 1 },
    provincesWithABattleLineItRead: new Set(),
    provincesItStoodOnAtSomePhase: new Set(),
    provinceEvents: [],
    lastTurnLog: [],
    spyActivity: [],
  };
  const intel = report(itsLines).provinceCharIntel ?? [];
  const namesIn = (id: number) =>
    (intel.find((e) => e.provId === id)?.characters ?? []).map((c) => c.name).sort((a, b) => a.localeCompare(b, 'en'));
  // the sight rule, asked directly, with the province intelligence's sight: realm 0's heroes' places and the provinces
  // it spied by its lines (not the provinces it holds)
  const sight = {
    ownedProvIds: new Set<number>(),
    ownCharLocs: new Set(G.characters.filter((c) => c.alive && c.player === 0).map((c) => c.location)),
    spiedThisTurn: new Set([spied.id]),
  };
  const passes = (p: Province) =>
    G.characters
      .filter((c) => c.alive && c.location === p.id)
      .filter((c) => c.player === 0 || enemyCharVisibleTo(G as never, 0, c as never, sight))
      .map((c) => c.name)
      .sort((a, b) => a.localeCompare(b, 'en'));
  expect(namesIn(wild.id), "beside your hero: your own and the other realm's, as the sight rule passes them").toEqual(
    passes(wild),
  );
  expect(namesIn(wild.id), '…which lists both, and neither the wanderer nor the hero under Invisibility').toEqual(
    expect.arrayContaining([mine.name, theirs.name]),
  );
  expect(namesIn(wild.id).filter((n) => n === wander.name || n === veiled.name)).toEqual([]);
  expect(namesIn(spied.id), 'in the province it spied: as the sight rule passes them').toEqual(passes(spied));
  expect(namesIn(spied.id), '…the wanderer, pierced by the Spy, and not the hero under Invisibility').toContain(
    spiedWanderer.name,
  );
  expect(namesIn(spied.id)).not.toContain(spiedVeiled.name);
  const entry = (id: number, name: string) =>
    intel.find((e) => e.provId === id)?.characters.find((c) => c.name === name);
  const own = entry(wild.id, mine.name);
  expect(
    { category: own?.category, armyCount: own?.armyCount, band: own && 'armyBand' in own },
    'the exact count for your own hero',
  ).toEqual({
    category: 'own',
    armyCount: mine.armies.length,
    band: false,
  });
  const other = entry(wild.id, theirs.name);
  expect(
    { category: other?.category, armyBand: other?.armyBand, count: other && 'armyCount' in other },
    "…the rough size for another realm's",
  ).toEqual({ category: 'enemy', armyBand: 'a modest band', count: false });
  const wanderer = entry(spied.id, spiedWanderer.name);
  expect(
    { category: wanderer?.category, armyBand: wanderer?.armyBand, count: wanderer && 'armyCount' in wanderer },
    '…and for a wanderer',
  ).toEqual({ category: 'neutral', armyBand: 'no armies', count: false });
  // the view the section copies them from (heroesInItsProvinceIntelligence) holds the exact count for its own hero and
  // the rough size for anyone else's, and not the other
  const inTheView = (
    viewOf(itsLines).provinces[wild.id] as {
      heroesInItsProvinceIntelligence?: { id: number; armyCount: unknown; armyBand: unknown }[];
    }
  ).heroesInItsProvinceIntelligence;
  const sizeOf = (id: number) => {
    const h = inTheView?.find((x) => x.id === id);
    return { armyCount: h?.armyCount, armyBand: h?.armyBand };
  };
  expect(sizeOf(mine.id), "the realm's view: the exact count for its own hero").toEqual({
    armyCount: mine.armies.length,
    armyBand: null,
  });
  expect(sizeOf(theirs.id), "…the rough size for another realm's").toEqual({
    armyCount: null,
    armyBand: 'a modest band',
  });
});

test("the warnings of a hero beside yours or in your land give his force's rough size, whatever the watcher's Spy", async () => {
  await import('../lib/the-whole-engine.ts');
  const { createTurnContext } = await import('../../src/engine/turn/context.ts');
  const { generateIntrusionNotifications } = await import('../../src/engine/turn/intrusion-warnings.ts');
  const sizes = (spy: number) => {
    const G = {
      turn: 4,
      relations: {},
      players: [
        { name: 'Esterhold', provinces: [3] },
        { name: 'Varn', provinces: [] },
      ],
      characters: [
        { id: 0, name: 'Wren', player: 0, alive: true, location: 2, armies: [], skills: { spy } },
        { id: 1, name: 'Thorn', player: 1, alive: true, location: 2, armies: army(4), skills: {} },
        { id: 2, name: 'Bryn', player: 1, alive: true, location: 3, armies: army(7), skills: {} },
      ],
      world: { provinces: [null, null, { id: 2, name: 'Wendmeadow' }, { id: 3, name: 'Esterhold Vale' }] },
    };
    const tc = createTurnContext(G, [], 3) as unknown as {
      _intrusionAcc: Map<
        string,
        { targetPi: number; acName: string; branch: string; forceByPhase: Record<number, string> }
      >;
    };
    Object.assign(tc, { SEASONS: ['Spring', 'Summer', 'Autumn', 'Late Autumn', 'Winter'], _intrusionAcc: new Map() });
    generateIntrusionNotifications(tc as never, 1);
    return [...tc._intrusionAcc.values()]
      .filter((r) => r.targetPi === 0)
      .map((r) => [r.acName, r.branch, r.forceByPhase[1]]);
  };
  const expected = [
    ['Thorn', 'known', 'a modest band'],
    ['Bryn', 'own', 'a sizeable host'],
  ];
  expect(sizes(0), 'the warnings give the rough size to a watcher of no Spy').toEqual(expected);
  expect(sizes(10), '…and the same to a master spy').toEqual(expected);
});
