// Each of a realm's own heroes' cards in its turn report names the share of a province the items he wears add as he
// marches into it (`theShareHisWornItemsAddToAMarchIn`, plan P1-11e8): the items' registry's runner on his worn
// items, as the Move order asks it. The order form's Explore note will read it (P1-11e13); until then nothing reads
// it. R-125: only a worn Traveller's Cloak (any of its names) adds its 20%; a spare one in his pack adds nothing.
// Who sees what doesn't change (P1-11's Decision 6): the field is on a realm's own heroes' cards alone.
//
// Level 2 (scenario): the report is built from a world after a turn, and the field is checked against the share the
// turn's Move order maps; played on the engine's modules (tests/lib/a-staged-turn-on-the-engines-modules.ts) on a
// world made from KC_SEED. Not lower: the field is the report's, built from what a realm may see of the world.
//
// Staged: realm 0's hero A wears a Travelworn Drape (a Traveller's Cloak by another name) and marches in Spring from
// a plain province of his realm's into a free plain one beside it, none of it mapped by his realm; realm 0's king wears
// nothing; realm 1's hero wears a Shadowcloak and carries a spare Travelworn Drape. Every hero's Explorer is 0, and none
// leads companies, so the turn's share is 10 plus his items'.
import { expect, test } from 'vitest';
import { aStagedTurnOnTheEnginesModules, order, plan } from '../lib/a-staged-turn-on-the-engines-modules.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;
const FIELD = 'theShareHisWornItemsAddToAMarchIn';

interface Province {
  id: number;
  row: number;
  col: number;
  name: string;
  terrain: string;
  owner: number | null;
  characters?: number[];
  exploredBy?: Record<string, number>;
  [key: string]: unknown;
}
interface Item {
  name: string;
  [key: string]: unknown;
}
interface Character {
  id: number;
  name: string;
  player: number | null;
  alive?: boolean;
  isKing?: boolean;
  location: number;
  locationName?: string;
  armies?: unknown[];
  items?: Item[];
  skills?: Record<string, number>;
  [key: string]: unknown;
}
interface World {
  players: { provinces: number[] }[];
  characters: Character[];
  world: { cols: number; rows: number; provinces: Province[] };
}
interface Scene {
  from: Province;
  into: Province;
  A: Character;
  king: Character;
  B: Character;
}
type Card = Record<string, unknown> & { id: number };

async function theTurn() {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { getNeighborsP } = await import('../../src/engine/world/map-helpers.ts');
  const { ALL_MAGIC_ITEMS_P } = await import('../../src/content/kingdoms-call-data.ts');
  // (the catalogue as the engine holds it once loaded: its alternates added)
  const catalogue = ALL_MAGIC_ITEMS_P as unknown as Item[];
  let itemId = 71_000;
  const anItem = (name: string, equipped: boolean): Item => {
    const it = catalogue.find((x) => x.name === name);
    if (!it) throw new Error(`the catalogue has no ${name}`);
    return { ...(JSON.parse(JSON.stringify(it)) as Item), id: itemId++, equipped };
  };
  const r = sc.turn<World, Scene>({
    realms: 2,
    prepare(S) {
      const land = (p: Province) => p.terrain !== 'sea';
      const free = (p: Province) => !S.characters.some((c) => c.alive && c.player != null && c.location === p.id);
      const nb = (p: Province) =>
        (getNeighborsP(p, S.world.cols, S.world.rows, S.world.provinces) as (Province | null)[]).filter(
          (q): q is Province => q != null,
        );
      let pick: { from: Province; into: Province } | null = null;
      for (const from of S.world.provinces.filter((p) => land(p) && free(p) && p.owner == null)) {
        const into = nb(from).find((q) => land(q) && free(q) && q.owner == null);
        if (into) {
          pick = { from, into };
          break;
        }
      }
      if (!pick) throw new Error('could not stage: no two free unowned land provinces side by side');
      const { from, into } = pick;
      // (no wanderer or chieftain in either: the march meets no one)
      S.characters = S.characters.filter((c) => c.player != null || (c.location !== from.id && c.location !== into.id));
      // his realm's province he marches from, and the free one he marches into, both plain and empty
      from.owner = 0;
      S.players[0]?.provinces.push(from.id);
      for (const p of [from, into])
        Object.assign(p, {
          terrain: 'plain',
          neutralDefenders: [],
          npcArmies: 0,
          features: [],
          garrisonArmies: [],
          exploredBy: {},
        });
      for (const p of [from, into])
        p.characters = (p.characters ?? []).filter((id) => S.characters.some((c) => c.id === id));
      const place = (c: Character, p: Province) => {
        S.world.provinces.forEach((q) => {
          q.characters = (q.characters ?? []).filter((id) => id !== c.id);
        });
        p.characters = [...(p.characters ?? []), c.id];
        c.location = p.id;
        c.locationName = p.name;
      };
      const A = S.characters.find((c) => c.alive && c.player === 0 && !c.isKing);
      const king = S.characters.find((c) => c.alive && c.player === 0 && c.isKing);
      const B = S.characters.find((c) => c.alive && c.player === 1 && !c.isKing);
      if (!A || !king || !B) throw new Error('could not stage: realm 0 needs a hero and a king, realm 1 a hero');
      for (const c of [A, king, B]) {
        c.skills = { ...(c.skills ?? {}), explorer: 0, march: 0 };
        c.armies = [];
      }
      place(A, from);
      A.items = [anItem('Travelworn Drape', true)];
      king.items = [];
      B.items = [anItem('Shadowcloak', true), anItem('Travelworn Drape', false)];
      return { from, into, A, king, B };
    },
    orders: (_S, x) => ({ [x.A.id]: plan(order('move', x.into.id)) }),
  });
  const cards = (realm: number): Card[] => {
    const report = r.reports[realm];
    if (!report) throw new Error(`no report for realm ${String(realm)}`);
    return report['characters'] as Card[];
  };
  return { r, cards, ...r.extra };
}

/** Every object in `report` that carries the field, wherever it sits. */
function everyHolderOfTheField(report: unknown): Card[] {
  const out: Card[] = [];
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === 'object' && v !== null) {
      if (FIELD in v) out.push(v as unknown as Card);
      Object.values(v).forEach(walk);
    }
  };
  walk(report);
  return out;
}

test("a hero wearing a Travelworn Drape: his card names its 20%, the share the turn's march into a province adds", async () => {
  const { r, cards, A, into } = await theTurn();
  const card = cards(0).find((c) => c.id === A.id);
  expect(card?.[FIELD], "the Drape's 20% on his card").toBe(20);
  const after = (r.S2['world'] as World['world']).provinces[into.id];
  expect((r.S2['characters'] as Character[]).find((c) => c.id === A.id)?.location, 'he marched in (staging)').toBe(
    into.id,
  );
  expect(after?.exploredBy?.['0'], "the turn's march in: 10, and his card's share").toBe(10 + Number(card?.[FIELD]));
});

test('a hero who wears nothing, and one whose Drape is a spare in his pack: their cards name 0', async () => {
  const { cards, king, B } = await theTurn();
  expect(cards(0).find((c) => c.id === king.id)?.[FIELD], 'the king who wears nothing').toBe(0);
  expect(cards(1).find((c) => c.id === B.id)?.[FIELD], 'a Shadowcloak worn, a Drape in his pack').toBe(0);
});

test("the field is on a realm's own heroes' cards alone: no realm reads another realm's heroes' share", async () => {
  const { r, cards, A, king, B } = await theTurn();
  const ownIds = (realm: number) =>
    (r.S2['characters'] as Character[]).filter((c) => c.player === realm).map((c) => c.id);
  for (const realm of [0, 1]) {
    const report = r.reports[realm];
    const holders = everyHolderOfTheField(report);
    expect(holders.length, `realm ${String(realm)}: every card of its own heroes, and nothing else`).toBe(
      cards(realm).length,
    );
    expect(
      holders.every((h) => ownIds(realm).includes(h.id) && cards(realm).includes(h)),
      `realm ${String(realm)}: each holder is its own hero's card`,
    ).toBe(true);
    expect(
      holders.every((h) => typeof h[FIELD] === 'number'),
      `realm ${String(realm)}: each a number`,
    ).toBe(true);
  }
  expect(cards(0).map((c) => c.id)).toEqual(expect.arrayContaining([A.id, king.id]));
  expect(cards(1).map((c) => c.id)).toContain(B.id);
  expect(
    everyHolderOfTheField(r.reports[1]).some((h) => h.id === A.id || h.id === king.id),
    "realm 1 reads no share of realm 0's heroes",
  ).toBe(false);
  expect(
    everyHolderOfTheField(r.reports[0]).some((h) => h.id === B.id),
    "realm 0 reads no share of realm 1's hero",
  ).toBe(false);
});
