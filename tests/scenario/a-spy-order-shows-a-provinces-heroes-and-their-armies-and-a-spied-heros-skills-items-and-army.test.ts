// 2026-10-15 (Toby, D2 and D9; R-111): what a Spy order shows.
//   • Spying a province shows every character there and the army units each leads (type and quality), but no hero's
//     skills; it also shows the characters in every neighbouring province, as a hero standing there would see them
//     (name, realm, rough size).
//   • Spying a hero shows all their skills, the magic items they carry and the army units they lead, in the turn
//     report. That holds for a local chieftain as for another realm's hero (D9).
// The rulebook's words are static/the-rulebook-says-what-a-province-spy-and-a-hero-spy-reveal.test.ts.
//
// Level 2 (scenario): one real turn on the engine's modules (tests/lib/a-staged-turn-on-the-engines-modules.ts) from
// KC_SEED, as the shell plays it: the Spy order is resolved in the turn's phases and what it learned is read by the
// report built after them, so no lower level holds both. The scene is staged on every world: a free land province (X)
// beside free land (Y), no realm's hero in either; in X a local chieftain made by the test (`_isNeutralGuard`), his
// companies the province's defenders, three heroes of realm 0's with Spy 6 (Master Spy: the order cannot fail, so no
// roll decides it) and two of realm 1's; in Y a third of realm 1's. Y is land: a hero put at sea with no fleet leaves
// his units ashore. A spy on a hero may still be caught (5% at the least), so the two spied on refuse a brawl (their
// duel stance): none follows to kill either. The three of realm 1's are given names of their own, as the report lists
// heroes by name and the world may deal two heroes the same one.
//
// Until plan P1-14h this was tests/spy-reveals.test.js, which played the turn on the booted GM page and searched the
// map for a guarded province with a quiet neighbour. Its checks of the turn are kept as they were, its staging check
// with them (the staging throws); the rulebook's four are the static test above.
import { expect, test } from 'vitest';
import { aStagedTurnOnTheEnginesModules, order, plan } from '../lib/a-staged-turn-on-the-engines-modules.ts';

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
  location: number;
  armies: Unit[];
  skills: Record<string, number>;
  items: unknown[];
  _isNeutralGuard?: boolean;
  [key: string]: unknown;
}
interface Province {
  id: number;
  name: string;
  terrain: string;
  owner: number | null;
  characters: number[];
  [key: string]: unknown;
}
interface World {
  turn: number;
  characters: Character[];
  players: { _spiedHeroSkills?: Record<number, SpiedHero> }[];
  world: { cols: number; rows: number; provinces: Province[] };
}
interface SpiedHero {
  skills?: Record<string, number>;
  items?: string[];
  armies?: Unit[];
}
interface Sighting {
  name: string;
  armyBand?: string;
  spiedSkills?: Record<string, number>;
  spiedItems?: string[];
  spiedArmies?: Unit[];
}
interface Report {
  provinceCharIntel?: {
    provId: number;
    spied: boolean;
    characters?: { name: string; armies?: Unit[]; spiedSkills?: unknown }[];
  }[];
  worldMeta?: { provinces?: ({ id: number; characters?: { id: number; armyBand?: string }[] } | null)[] };
  heroSightings?: Sighting[];
}
interface Ids {
  A: number;
  D: number;
  F: number;
  B: number;
  E: number;
  C: number;
  chief: number;
  X: number;
  Y: number;
}

test("a Spy order shows a province's heroes and their armies, the heroes beside it, and a spied hero's skills, items and army", async () => {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { getNeighborsP } = await import('../../src/engine/world/map-helpers.ts');
  const r = sc.turn<World, Ids>({
    realms: 2,
    prepare(S) {
      const P = S.world.provinces;
      const moveTo = (c: Character, p: Province) => {
        const old = P[c.location];
        if (old) old.characters = old.characters.filter((id) => id !== c.id);
        if (!p.characters.includes(c.id)) p.characters.push(c.id);
        c.location = p.id;
      };
      const aRealmsHeroIn = (p: Province) =>
        S.characters.some((c) => c.alive && c.player != null && c.location === p.id);
      const free = (p: Province | undefined): p is Province =>
        !!p && p.terrain !== 'sea' && p.owner == null && !aRealmsHeroIn(p);
      const freeNeighbour = (p: Province) =>
        getNeighborsP<Province>(p as never, S.world.cols, S.world.rows, P).find((n) => n.id !== p.id && free(n));
      const X = P.find((p) => free(p) && freeNeighbour(p));
      const Y = X && freeNeighbour(X);
      const mine = S.characters.filter((c) => c.alive && c.player === 0);
      const theirs = S.characters.filter((c) => c.alive && c.player === 1);
      const [A, D, F] = mine;
      const [B, E, C] = theirs;
      if (!X || !Y || !A || !D || !F || !B || !E || !C)
        throw new Error(
          'could not stage: the staged world has a free land province beside free land, and three heroes a realm',
        );
      // a spy on a hero may be caught (at 5% at least) and set upon; the two spied on refuse a brawl, so none follows
      const refuse = () => ({ tactics: ['ME'], notes: '', duelStance: 'refuse' });
      const guardArmies: Unit[] = [{ type: 'Militia', quality: 'Green' }];
      const chief: Character = {
        id: S.characters.length, // the next id: the engine finds a character by its place in the list
        name: 'Warden Testcairn',
        isKing: false,
        player: null,
        race: 'Human',
        alignment: 'Neutral',
        hp: 15,
        maxHp: 15,
        hpEarned: 0,
        skills: {},
        aptitude: {},
        items: [],
        alive: true,
        merits: 0,
        taxBonus: 0,
        spellsUsedThisTurn: [],
        location: X.id,
        locationName: X.name,
        _isNeutralGuard: true,
        armies: guardArmies,
        encounterPlan: refuse(),
      };
      S.characters.push(chief);
      X.characters.push(chief.id);
      Object.assign(X, { neutralDefenders: [...guardArmies], npcArmies: guardArmies.length });
      [A, D, F].forEach((c) => {
        moveTo(c, X);
        c.skills = { ...c.skills, spy: 6 };
      });
      moveTo(B, X);
      moveTo(E, X);
      moveTo(C, Y);
      // the report names the heroes it lists, and the world may deal two the same name: these three get names of their own
      B.name = 'Bryn Testvale';
      E.name = 'Edda Testmoor';
      C.name = 'Cael Testford';
      B.armies = [
        { type: 'Shieldwall Levies', quality: 'Veteran' },
        { type: 'Free Lances', quality: 'Average' },
      ];
      E.armies = [{ type: 'Yeoman Longbows', quality: 'Elite' }];
      E.items = [{ name: 'Ring of Testing', slot: 'ring', effect: {} }];
      E.skills = { ...E.skills, melee: 3, tactical: 2 };
      E['encounterPlan'] = refuse();
      C.armies = [0, 1, 2].map(() => ({ type: 'Shieldwall Levies', quality: 'Green' }));
      [B, E, C].forEach((c) => {
        c.skills = { ...c.skills, spy: 0 };
      });
      return { A: A.id, D: D.id, F: F.id, B: B.id, E: E.id, C: C.id, chief: chief.id, X: X.id, Y: Y.id };
    },
    orders: (_S, x) => ({
      [x.A]: plan(order('spy', '')),
      [x.D]: plan(order('spy', 'char:' + String(x.E))),
      [x.F]: plan(order('spy', 'char:' + String(x.chief))),
    }),
  });
  const ids = r.extra;
  const nameOf = (id: number) => r.S.characters.find((c) => c.id === id)?.name;
  const rep = (r.reports[0] ?? {}) as Report;
  const rec = (r.S2 as unknown as World).players[0]?._spiedHeroSkills ?? {};

  // ── Spying the province ──
  const pci = (rep.provinceCharIntel ?? []).find((p) => p.provId === ids.X && p.spied);
  expect(pci, 'the spied province has its entry in the report').toBeDefined();
  const b = (pci?.characters ?? []).find((c) => c.name === nameOf(ids.B));
  expect(
    b?.armies?.length === 2 && b.armies.some((a) => a.type === 'Free Lances' && a.quality === 'Average'),
    `…showing the army units another realm's hero leads, by type and quality (got ${JSON.stringify(b?.armies)})`,
  ).toBe(true);
  expect(rec[ids.B], "…but a province spy records no hero's skills").toBeUndefined();
  expect(b && !b.spiedSkills, '…and the report shows none for them').toBe(true);
  const nearC = rep.worldMeta?.provinces?.find((p) => p?.id === ids.Y)?.characters ?? [];
  const c = nearC.find((x) => x.id === ids.C);
  expect(c, 'a hero in a neighbouring province is on the map, as if your hero stood there').toBeDefined();
  expect(
    c?.armyBand === 'a modest band' && !('armyCount' in c),
    `…with the rough size of their army (got ${String(c?.armyBand)})`,
  ).toBe(true);
  expect(
    (rep.heroSightings ?? []).some((s) => s.name === nameOf(ids.C) && s.armyBand === 'leads a modest band'),
    '…and in the hero sightings',
  ).toBe(true);

  // ── Spying a hero of another realm ──
  const e = rec[ids.E];
  expect(e, 'spying a hero records what was learned').toBeDefined();
  expect(e?.skills?.['melee'] === 3 && e.skills['tactical'] === 2, '…every skill level').toBe(true);
  expect(e?.items, `…the magic items they carry (got ${JSON.stringify(e?.items)})`).toContain('Ring of Testing');
  expect(
    e?.armies?.length === 1 && e.armies[0]?.type === 'Yeoman Longbows' && e.armies[0].quality === 'Elite',
    `…and the army units they lead (got ${JSON.stringify(e?.armies)})`,
  ).toBe(true);
  const es = (rep.heroSightings ?? []).find((s) => s.name === nameOf(ids.E));
  expect(
    es?.spiedSkills?.['melee'] === 3 &&
      (es.spiedItems ?? []).includes('Ring of Testing') &&
      (es.spiedArmies ?? []).length === 1,
    `the report's hero sighting shows the skills, items and army (got ${JSON.stringify(es && { s: es.spiedSkills, i: es.spiedItems, a: es.spiedArmies })})`,
  ).toBe(true);
  const spysLines = r.text(ids.D);
  expect(
    spysLines.includes('Ring of Testing') && spysLines.includes('Yeoman Longbows'),
    "the spy's own report line names the items and the army",
  ).toBe(true);

  // ── Spying a local chieftain (D9) ──
  const ch = rec[ids.chief];
  expect(
    !!ch?.skills && Array.isArray(ch.items) && Array.isArray(ch.armies),
    `spying a local chieftain records their skills, items and army (got ${JSON.stringify(ch)})`,
  ).toBe(true);
  const chs = (rep.heroSightings ?? []).find((s) => s.name === nameOf(ids.chief));
  expect(chs?.spiedSkills, '…and the report shows their skills').toBeTruthy();
});
