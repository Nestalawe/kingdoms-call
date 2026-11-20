// 2026-10-13 (the maintainers, Creatures and Monsters I): the two crowns in a real world and a real turn.
//   - world generation: in three worlds of three realms (Evil, Druidic and Neutral), an Evil king and a Druidic king
//     start at Druid +1 and a Neutral king gets none from his crown; in three worlds of one realm for each crown, an
//     Evil king opens beside a land Monster province and no other wild one, as a Druidic king beside a Creature one;
//   - Reign of Fear: an Evil host's Monsters fight ×1.5 attacking a province under its Terror (the ladder says so), the
//     Terror still demoralises the defenders, Evil's savage fury stays, and its Druid-1 king leads Cave Trolls with no
//     shortfall warning;
//   - Wild Ferocity is gone: a Druidic host with Forest Ents gets no ×1.25 line.
// (Call from the Pit was removed on 2026-10-12, item 22: tests/scenario/call-from-the-pit-and-awaken-the-wild-given-in-
// a-turn-raise-nothing-and-are-refused-in-plain-words.test.ts holds that.) The wild country within two provinces of
// home, over many worlds, is tests/unit/the-two-crowns-have-wild-country-within-two-provinces.test.ts; the books'
// promise is tests/static/the-books-promise-the-two-crowns-wild-country-near-home.test.ts.
//
// Level 2 (scenario): world generation and the order and battle paths live inside generateNewGame and resolveTurn, so
// only worlds and a turn reach them. Played on the engine's modules (tests/lib/a-staged-turn-on-the-engines-modules.ts)
// on worlds made from KC_SEED; the turn's scene is staged whatever the world (the targets' defenders, the Terror, the
// Druidic host, the Evil host the two troll companies alone, and the kings' Druid are set). The "beside" checks are
// made on worlds of one realm, where world generation's alignment pass always finds a free neighbour for the crown
// (the test says why), so they hold on any seed.
//
// Until plan P1-14z this was tests/two-crowns.test.js, a turn on the GM page (lib/scenario.ts); each check is kept as it
// was, the three worlds' checks each one test over the three, and its page-errors check went with the page. Two were
// restaged so that they hold on any seed, not on the dice: the "beside" checks moved to worlds of one realm (on the
// script's worlds of three realms, a later king's pass could find no free neighbour), and the Evil king leads only
// his trolls (a starting company of another people could raise a shortfall line of its own).
import { beforeAll, describe, expect, test } from 'vitest';
import { aStagedTurnOnTheEnginesModules, order, plan } from '../lib/a-staged-turn-on-the-engines-modules.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

interface Unit {
  type: string;
  quality: string;
  race: string;
  unitName: string;
}
interface Province {
  id: number;
  row: number;
  col: number;
  terrain: string;
  race?: string;
  owner?: number | null;
  armyTypes?: string[];
  neutralDefenders?: Unit[];
  npcArmies?: number;
  _terrorStacks?: number;
  _terrorTurn?: number;
  _terrorisedBy?: number;
}
interface Character {
  id: number;
  isKing?: boolean;
  player: number | null;
  skills?: Record<string, number>;
  armies?: Unit[];
}
interface World {
  turn: number;
  players: { homeProvinceId: number }[];
  characters: Character[];
  world: { cols: number; rows: number; provinces: Province[] };
}

/** What each check found in each world, by world: a value per world, as the old script printed it. */
const worlds: {
  evilDruid: number | undefined;
  druidicDruid: number | undefined;
  neutralDruid: number | undefined;
}[] = [];
/** Each crown's worlds of its own (one realm): its home ring's land provinces and its wild land neighbours' beasts. */
const crownsWorlds: Record<'Evil' | 'Druidic', { landInTheRing: number; wild: (string | null | undefined)[] }[]> = {
  Evil: [],
  Druidic: [],
};
const builds: Record<string, number> = {};
let MON = new Set<string>();
let CRE = new Set<string>();
let te = '';
let td = '';
let all = '';

beforeAll(async () => {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { getNeighborsP } = await import('../../src/engine/world/map-helpers.ts');
  const { KC_UNIT_CLASS } = await import('../../src/content/kingdoms-call-data.ts');
  const { BOT_SKILL_BUILD } = await import('../../src/engine/bots/setup.ts');
  MON = new Set(KC_UNIT_CLASS.monster);
  CRE = new Set(KC_UNIT_CLASS.creature);
  // A king's Druid is his crown's +1 on top of whatever his chosen skills hold (a bot king's build, here).
  // `as`: the bots' builds, by crown, each a skill's level by its name
  const theBuilds = BOT_SKILL_BUILD as Partial<Record<string, Partial<Record<string, number>>>>;
  for (const a of ['Evil', 'Druidic', 'Neutral']) builds[a] = theBuilds[a]?.['druid'] ?? 0;
  const nbrs = (S: World, p: Province) =>
    (getNeighborsP(p, S.world.cols, S.world.rows, S.world.provinces) as (Province | null | undefined)[]).filter(
      (q): q is Province => q != null,
    );
  const home = (S: World, pi: number): Province => {
    const h = S.world.provinces[S.players[pi]?.homeProvinceId ?? -1];
    if (!h) throw new Error(`realm ${String(pi)} has no home`);
    return h;
  };
  const king = (S: World, pi: number) => S.characters.find((c) => c.isKing === true && c.player === pi);
  const wildOf = (p: Province) => ((p.race ?? '').startsWith('Primal:') ? (p.armyTypes ?? [])[0] : null);

  // ── World generation, three worlds ──
  for (let k = 0; k < 3; k++) {
    // `as`: the engine's world, as the checks read it
    const S = sc.world({ realms: 3, alignments: ['Evil', 'Druidic', 'Neutral'] }).S as unknown as World;
    const druid = (c: Character | undefined) => (c ? (c.skills?.['druid'] ?? 0) : undefined);
    worlds.push({
      evilDruid: druid(king(S, 0)),
      druidicDruid: druid(king(S, 1)),
      neutralDruid: druid(king(S, 2)),
    });
  }
  // ── Each crown beside its wild country: three worlds of one realm each ──
  // The alignment pass converts a free land neighbour of the home (unowned, and not the home's poor and prosperous
  // pair) to the crown's wild kind, and the ring's cap then keeps that one and no other wild province. In a world of
  // one realm no other king's ring or pair is protected, and below a 60% sea share a home's ring holds at least four
  // land provinces (the home ring rule), so a free neighbour is always there: the guarantee holds on any seed.
  for (const crown of ['Evil', 'Druidic'] as const)
    for (let k = 0; k < 3; k++) {
      // `as`: the engine's world, as the checks read it
      const S = sc.world({ realms: 1, alignments: [crown] }).S as unknown as World;
      const ring = nbrs(S, home(S, 0));
      crownsWorlds[crown].push({
        landInTheRing: ring.filter((p) => p.terrain !== 'sea').length,
        wild: ring.filter((p) => p.terrain !== 'sea' && wildOf(p)).map(wildOf),
      });
    }

  // ── Reign of Fear, the waiver in a battle, and Wild Ferocity gone ──
  const r = sc.turn<World, { ek: number; dk: number; eT: number; dT: number }>({
    realms: 2,
    alignments: ['Evil', 'Druidic'],
    prepare(S) {
      const ek = king(S, 0);
      const dk = king(S, 1);
      if (!ek || !dk) throw new Error('a realm has no king');
      ek.skills = { ...ek.skills, druid: 1 };
      dk.skills = { ...dk.skills, druid: 1 };
      const pickTarget = (pi: number) =>
        nbrs(S, home(S, pi)).find(
          (p) => p.terrain !== 'sea' && p.owner == null && (p.neutralDefenders ?? []).length > 0,
        ) ?? nbrs(S, home(S, pi)).find((p) => p.terrain !== 'sea' && p.owner == null);
      const eT = pickTarget(0);
      const dT = pickTarget(1);
      if (!eT || !dT) throw new Error('a king has no free land beside his home');
      for (const t of [eT, dT])
        if (!(t.neutralDefenders ?? []).length) {
          t.neutralDefenders = [
            { type: 'Shieldwall Levies', quality: 'Average', race: 'Human', unitName: 'the Test Levies' },
          ];
          t.npcArmies = 1;
        }
      // ground the Evil realm terrorised last turn
      eT._terrorStacks = 1;
      eT._terrorTurn = S.turn - 1;
      eT._terrorisedBy = 0;
      // his host is the two troll companies alone, so a shortfall line could only be theirs (a starting company of
      // another people can be one he is short of, whatever the waiver)
      ek.armies = [
        { type: 'Cave Trolls', quality: 'Average', race: 'Primal', unitName: 'the Test Trolls' },
        { type: 'Cave Trolls', quality: 'Average', race: 'Primal', unitName: 'the Deep Trolls' },
      ];
      dk.armies = [
        ...(dk.armies ?? []),
        { type: 'Forest Ents', quality: 'Average', race: 'Primal', unitName: 'the Test Ents' },
      ];
      return { ek: ek.id, dk: dk.id, eT: eT.id, dT: dT.id };
    },
    orders: (_S, x) => ({ [x.ek]: plan(order('move', x.eT)), [x.dk]: plan(order('move', x.dT)) }),
  });
  te = r.text(r.extra.ek);
  td = r.text(r.extra.dk);
  all = r.text();
});

describe('world generation, in each of three worlds', () => {
  test('the Evil king starts with Druid +1', () => {
    expect(worlds.map((w) => w.evilDruid)).toEqual([1, 1, 1].map((n) => n + (builds['Evil'] ?? 0)));
  });
  test('the Druidic king starts with Druid +1', () => {
    expect(worlds.map((w) => w.druidicDruid)).toEqual([1, 1, 1].map((n) => n + (builds['Druidic'] ?? 0)));
  });
  test('a Neutral king gets no Druid from his crown', () => {
    expect(worlds.map((w) => w.neutralDruid)).toEqual([0, 0, 0].map((n) => n + (builds['Neutral'] ?? 0)));
  });
});

describe("each crown's capital, in three worlds of its own", () => {
  test("each home's ring holds at least four land provinces (the home ring rule, below a 60% sea share)", () => {
    expect([...crownsWorlds.Evil, ...crownsWorlds.Druidic].map((w) => w.landInTheRing >= 4)).toEqual(
      Array.from({ length: 6 }, () => true),
    );
  });
  test('the Evil king opens beside a land Monster province, and no other wild one', () => {
    for (const w of crownsWorlds.Evil)
      expect(
        w.wild.map((t) => t != null && MON.has(t)),
        `wild neighbours: ${w.wild.join(', ')}`,
      ).toEqual([true]);
  });
  test('the Druidic king opens beside a land Creature province, and no other wild one', () => {
    for (const w of crownsWorlds.Druidic)
      expect(
        w.wild.map((t) => t != null && CRE.has(t)),
        `wild neighbours: ${w.wild.join(', ')}`,
      ).toEqual([true]);
  });
});

describe('a turn: Reign of Fear, the Druid waiver and Wild Ferocity gone', () => {
  test('the Evil king fights in the terrorised province', () => {
    expect(te).toMatch(/Battle for|battle is initiated/);
  });
  test('the ladder names Reign of Fear ×1.5 on the trolls', () => {
    expect(te).toMatch(/Reign of Fear ×1\.5/);
  });
  test('the defenders there still fight demoralised by the Terror', () => {
    expect(te).toMatch(/Terror lingers/);
  });
  test("Evil's savage fury (×1.25 with a Monster in the host) stays, or the zeal roll fired, which outranks it and is the one line the report prints then", () => {
    expect(te).toMatch(/savage fury|fanatical zeal/);
  });
  test('the Druid-1 Evil king leads his trolls with no shortfall warning', () => {
    expect(te).not.toMatch(/Druid shortfall/);
  });
  test('the Druidic king fights too', () => {
    expect(td).toMatch(/Battle for|battle is initiated/);
  });
  test('Wild Ferocity is gone: no ×1.25 line for a Druidic host with a Creature', () => {
    expect(td).not.toMatch(/wild ferocity/i);
    expect(all).not.toMatch(/wild ferocity/i);
  });
});
