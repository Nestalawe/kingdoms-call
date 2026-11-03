// 2026-10-12 (Toby, the battle reports: who beat whom): the lines a real turn writes.
//   • a province battle's casualty lines name whom each company fought (the attacker's and the defenders'); the losses
//     tally still counts each side's own losses;
//   • a beaten guard's survivors' lines name the host that beat them.
// A fallen commander's host told who slew them is tests/unit/fallen-commander-host.test.ts; each fate of a beaten
// guard's survivors, with fixed dice, is tests/unit/stalled-battles-unit-gain-and-war-fronts.test.ts.
//
// Level 2 (scenario): what a real turn's battle writes, its casualty sections, its tally and the beaten guard's
// survivors eroded after it (which are written across the phase, past the battle itself), so only a whole turn shows
// it; played on the engine's modules (tests/lib/a-staged-turn-on-the-engines-modules.ts), on a world made from KC_SEED.
// The scene is chosen and set by the staging, on every world: a guard made by the test (no skill, no items, Cautious:
// he calls out nobody, and the hero refuses no challenge, so neither host is demoralised) with three Average companies,
// alone in a free land province (made a plain) beside a land province of realm 0's, where realm 0's first hero is put
// with Druid 1 (every company at full strength, whatever his race) at the head of five Elite companies. The odds are
// overwhelming (an edge of 5.8× or more, and fortune never overturns 4×: src/engine/battle/fortune.ts), so the attacker
// always wins. One attacking company, the Red Hand, is sure to fall: a stand-in on rollUnitFates (a vi.spyOn on
// engine/battle/fates.ts, which the battle calls from another file) makes its death roll certain in the first fates
// the winner rolls (its die is still drawn, so the dice after it are the turn's own); so the attacker's casualty
// section has a line on every world, and the tally an attacker's loss. Which fate each other company draws is the
// dice's, so the checks hold for every line that appears rather than for one line in particular.
//
// Until plan P1-14c this was tests/battle-faced-turn.test.js, a turn on the GM portal (lib/scenario.js) that searched
// the map for a guard: there an overwhelming attacker rarely lost a company, so its two checks of the attacker's lines
// usually saw none (none on CI's seed). Its checks are kept, those two now with a line to read.
import { expect, test, vi } from 'vitest';
import { aStagedTurnOnTheEnginesModules, order, plan } from '../lib/a-staged-turn-on-the-engines-modules.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

interface Province {
  id: number;
  row: number;
  col: number;
  name: string;
  terrain: string;
  owner: number | null;
  characters?: number[];
  [key: string]: unknown;
}
interface Company {
  type: string;
  quality: string;
  unitName: string;
}
interface Character {
  id: number;
  name: string;
  player: number | null;
  alive?: boolean;
  isKing?: boolean;
  location: number;
  locationName?: string;
  items?: unknown[];
  skills?: Record<string, number>;
  armies?: Company[];
  [key: string]: unknown;
}
interface World {
  players: { provinces: number[] }[];
  characters: Character[];
  world: { cols: number; rows: number; provinces: Province[] };
}

const CLAUSE =
  /, (facing|shooting|in a flank duel with|guarding the end against|wrapping the line at|met at the end of the line by|riding free round the flank|fighting from the air|in the reserve|in the second line|shooting at an empty column|with nobody opposite)\b/;
const DEF = ['Shieldwall Levies 1', 'Shieldwall Levies 2', 'Goblin Horde 1'];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test("a province battle's casualty lines name whom each company fought, and its tally counts each side's own losses", async () => {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { getNeighborsP } = await import('../../src/engine/world/map-helpers.ts');
  const fates = await import('../../src/engine/battle/fates.ts');
  // The Red Hand falls in the first fates the winner rolls: its death roll certain, its die still drawn.
  const rollUnitFates = fates.rollUnitFates;
  const theRedHandsFate = { set: false };
  vi.spyOn(fates, 'rollUnitFates').mockImplementation((...[force, o]: Parameters<typeof rollUnitFates>) => {
    if (theRedHandsFate.set || !o.won || !(force ?? []).some((a) => a?.unitName === 'the Red Hand'))
      return rollUnitFates(force, o);
    theRedHandsFate.set = true;
    const dieAt = o.dieAt;
    return rollUnitFates(force, { ...o, dieAt: (a) => (a.unitName === 'the Red Hand' ? 1 : dieAt(a)) });
  });

  const land = (p: Province | null | undefined): p is Province => p != null && p.terrain !== 'sea';
  const place = (S: World, c: Character, p: Province) => {
    S.world.provinces.forEach((q) => {
      q.characters = (q.characters ?? []).filter((id) => id !== c.id);
    });
    p.characters = [...(p.characters ?? []), c.id];
    c.location = p.id;
    c.locationName = p.name;
  };
  const own = (S: World, p: Province, pi: number) => {
    S.players.forEach((pl) => {
      pl.provinces = pl.provinces.filter((id) => id !== p.id);
    });
    p.owner = pi;
    S.players[pi]?.provinces.push(p.id);
    Object.assign(p, { neutralDefenders: [], npcArmies: 0, features: [], garrisonArmies: [] });
  };
  const named = (type: string, quality: string, names: string[]): Company[] =>
    names.map((unitName) => ({ type, quality, unitName }));

  const r = sc.turn<World, { H: Character; guard: Character; N: Province }>({
    cols: 10,
    rows: 6,
    seaPct: 10,
    prepare(S) {
      const H = S.characters.find((c) => c.alive && c.player === 0 && !c.isKing);
      // N: the guard's province, a free land province (no realm's) beside a land province, the first such; P: that
      // neighbour, made realm 0's, where the hero is put. Everyone else in either is taken off the map.
      const N = S.world.provinces.find(
        (q) =>
          land(q) &&
          q.owner == null &&
          (getNeighborsP(q, S.world.cols, S.world.rows, S.world.provinces) as (Province | null)[]).some(
            (y) => land(y) && y.id !== q.id,
          ),
      );
      const P =
        N &&
        (getNeighborsP(N, S.world.cols, S.world.rows, S.world.provinces) as (Province | null)[]).find(
          (y): y is Province => land(y) && y.id !== N.id,
        );
      if (!H || !N || !P) throw new Error('could not stage: no hero, or no free land province beside land');
      S.characters = S.characters.filter((c) => c.player != null || (c.location !== N.id && c.location !== P.id));
      [N, P].forEach((p) => {
        p.characters = (p.characters ?? []).filter((id) => S.characters.some((c) => c.id === id));
      });
      own(S, P, 0);
      Object.assign(N, { terrain: 'plain', features: [], garrisonArmies: [] });
      const id = Math.max(...S.characters.map((c) => c.id)) + 1;
      const armies = named('Shieldwall Levies', 'Average', DEF.slice(0, 2)).concat(
        named('Goblin Horde', 'Average', DEF.slice(2)),
      );
      const guard: Character = {
        id,
        name: 'Warden Testcairn',
        isKing: false,
        player: null,
        race: 'Human',
        alignment: 'Neutral',
        temper: 'Cautious',
        hp: 10,
        maxHp: 10,
        skills: {},
        aptitude: {},
        items: [],
        alive: true,
        merits: 0,
        taxBonus: 0,
        spellsUsedThisTurn: [],
        location: N.id,
        locationName: N.name,
        _isNeutralGuard: true,
        armies,
      };
      S.characters.push(guard);
      N.characters = [...(N.characters ?? []), id];
      N['neutralDefenders'] = [...armies];
      N['npcArmies'] = 3;
      place(S, H, P);
      H.items = [];
      H.skills = { ...H.skills, archery: 0, tactical: 0, druid: 1 };
      H.armies = named('Men-at-Arms', 'Elite', ['the Red Hand', 'the Grey Company']).concat(
        named('Yeoman Longbows', 'Elite', ['the Ashen Bows', 'the Oak Bows']),
        named('Free Lances', 'Elite', ['the Wind Riders']),
      );
      return { H, guard, N };
    },
    orders: (_S, c) => ({ [c.H.id]: plan(order('move', c.N.id)) }),
  });
  const H = r.extra.H;
  const guardName = r.extra.guard.name.replace(' (wandering)', '');
  const all = r.log.map((e) => e.text ?? '');
  expect(
    theRedHandsFate.set,
    "the stand-in is reached: the winner's fates are rolled with the Red Hand among them",
  ).toBe(true);
  const atkHead = all.findIndex((l) => l === `⚔ **${H.name}'s forces** (attacker):`);
  const defHead = all.findIndex((l) => /^🛡 \*\*.+'s forces\*\* \(defender\):$/.test(l));
  expect(atkHead, "the report has the attacker's casualty section").toBeGreaterThanOrEqual(0);
  expect(defHead, "…and, after it, the defenders'").toBeGreaterThan(atkHead);
  expect(all.join('\n'), 'the attacker wins (overwhelming odds)').toMatch(
    new RegExp(`${esc(H.name)}'s forces (rout|break|scatter|overwhelm|destroy) `),
  );
  const nextHead = (i: number) => {
    const j = all.slice(i + 1).findIndex((l) => /^(⚔|🛡) \*\*/.test(l));
    return j < 0 ? -1 : i + 1 + j;
  };
  const section = (from: number, to: number) =>
    all
      .slice(from + 1, to < 0 ? undefined : to)
      .filter((l) => l.startsWith('— ') && !/forces survive the engagement|None left to fight/.test(l));
  const atkLines = section(atkHead, nextHead(atkHead));
  expect(
    atkLines.some((l) => l.includes('the Red Hand')),
    "the attacker's section has the Red Hand's line (it is sure to fall)",
  ).toBe(true);
  expect(
    atkLines.filter((l) => !CLAUSE.test(l)),
    "every fate line of the attacker's names whom the company fought",
  ).toEqual([]);
  expect(
    atkLines.filter(
      (l) => !/^— (Despite defeat, )?(the \w+ \w+ \(.+?'s (Men-at-Arms|Yeoman Longbows|Free Lances), Elite\))/.test(l),
    ),
    "the attacker's companies keep their named form first",
  ).toEqual([]);
  // Every defending company writes a line in the first battle: destroyed (naming whom it faced), cut down in the trap,
  // or eroded afterwards (naming the victor's host). Its lines are the ones whose subject it is, by their form ("—
  // <guard>'s <company> (…" or "— <company> are cut down…"), never an attacker's line that names it; and only the first
  // battle's (from its "⚔ **Battle for" heading to the next), since survivors who hold the ground fight again in a
  // later phase, where a company already reduced to Green that loses heart disbands, a line that names nobody. The
  // staged companies are Average, so in the first battle none can disband.
  const battleHeads = all.flatMap((l, i) => (l.startsWith('⚔ **Battle for ') ? [i] : []));
  const firstBattle = battleHeads.length ? all.slice(battleHeads[0], battleHeads[1]) : [];
  for (const nm of DEF) {
    const itsOwn = new RegExp(`^— (${esc(guardName)}'s ${esc(nm)} \\(|${esc(nm)} are cut down with no escape!$)`);
    const mine = firstBattle.filter((l) => itsOwn.test(l));
    expect(mine.length, `${nm} gets a line`).toBeGreaterThanOrEqual(1);
    expect(
      mine.filter(
        (l) =>
          !(
            (l.endsWith('were destroyed in the rout!') && CLAUSE.test(l)) ||
            l.endsWith('are cut down with no escape!') ||
            (l.includes(`${H.name}'s host`) &&
              /break ranks and flee before|beaten by|hold their ground unbroken against/.test(l))
          ),
      ),
      `${nm}'s lines name whom they fought or who beat them`,
    ).toEqual([]);
  }
  // The tally counts each side's own losses (the first battle's: survivors who hold the ground fight again in a later
  // phase, and that battle writes its own tally).
  const ti = all.findIndex((l) => l.startsWith('⚰ Losses — '));
  const tl = ti >= 0 ? all[ti] : undefined;
  const block = (() => {
    if (ti < 0) return [];
    const j = all.slice(ti + 1).findIndex((l) => l.startsWith('⚑FORCE⚑'));
    return all.slice(ti, j < 0 ? undefined : ti + 1 + j);
  })();
  const defLost = block.filter(
    (l) => DEF.some((nm) => l.includes(nm)) && /were destroyed in the rout!$|are cut down with no escape!$/.test(l),
  ).length;
  const atkLost = block.filter((l) => l.startsWith('— ') && l.includes('were destroyed in the fighting.')).length;
  expect(tl, 'the report carries a losses tally').toBeDefined();
  const side = (nm: string) => {
    const m = new RegExp(`\\*\\*${esc(nm)}\\*\\*: (no units lost|(\\d+) of (\\d+) units? lost)`).exec(tl ?? '');
    return m ? (m[2] ? Number(m[2]) : 0) : null;
  };
  expect(atkLost, "the tally's block has the Red Hand's loss").toBeGreaterThanOrEqual(1);
  expect(side(H.name), `the tally's attacker losses match the lines: "${tl ?? ''}"`).toBe(atkLost);
  expect(side(guardName), "the tally's defender losses match the lines").toBe(defLost);
});
