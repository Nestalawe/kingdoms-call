// 2026-10-08 (item 7): a chase (an Encounter order) obeys ONE BATTLE PER PHASE, and a chase battle the hunter wins
// takes the province like any other battle (R-083).
// (1) The story from play, as it can still happen with an Encounter: the hunter's quarry turns and attacks him first (a
//     quarry acts before its hunter), so the hunter fights as the DEFENDER, and then, the same season, rode on after
//     the quarry into a second battle. Staged with a high-Spy hunter: whenever the chase is allowed to run that season
//     he leaves the ground he has just held.
// (2) The chase battle itself: the report said the hunter "seized" the province, but its owner never changed.
// Both cases are staged so their outcome is overwhelming, not a matter of luck. (The Warg Riders no longer chase at
// all: see warg-run-down.)
// Level 2 (scenario): what is checked is a whole turn's order of events (one battle a phase, the chase held over to the
// next season, the province's owner after it). The other ways a chase is held over, or met, are staged on the
// functions directly in unit/pursuits-and-the-catch-roll.test.ts. It was tests/pursuit-one-battle.test.js, whose
// code-anchor hook replaced `    const chance=pursuitCatchChance(c,quarry);` to make the catch certain; since plan
// P1-08i3 pursuitCatchChance is a top-level function, wrapped on the page instead. The checks are the same.
import { expect, test } from 'vitest';
import { bootScenario, order, plan, type ScenarioWindow } from '../lib/scenario.js';

interface Province {
  id: number;
  name: string;
  terrain: string;
  owner: number | null;
  characters?: number[];
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
  armies?: { type: string; quality: string; unitName: string }[];
  skills?: Record<string, number>;
}
interface World {
  relations?: Record<string, string>;
  players: { provinces: number[] }[];
  characters: Character[];
  world: { cols: number; rows: number; provinces: Province[] };
}

const sc = await bootScenario();
const W = sc.W as ScenarioWindow & Record<string, unknown>;
// The catch is made certain for case (2), as the old hook did: a missed catch would leave the two armies in a
// stand-off, fought as an ordinary resumed battle instead.
const realCatch = W['pursuitCatchChance'] as (...a: unknown[]) => number;
W['pursuitCatchChance'] = (...a: unknown[]) =>
  W['__KC_CATCH'] != null ? (W['__KC_CATCH'] as number) : realCatch(...a);

const nb = (S: World, p: Province) =>
  (W.getNeighborsP(p, S.world.cols, S.world.rows, S.world.provinces) as (Province | null)[]).filter(
    (q): q is Province => !!q,
  );
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
const army = (type: string, n: number, quality: string) =>
  Array.from({ length: n }, (_, i) => ({ type, quality, unitName: `${type} ${String(i + 1)}` }));
const kings = (S: World) => {
  const A = S.characters.find((c) => c.alive !== false && c.player === 0 && c.isKing);
  const B = S.characters.find((c) => c.alive !== false && c.player === 1 && c.isKing);
  if (!A || !B) throw new Error('a realm has no king');
  return { A, B };
};
/** Clears the provinces of everyone but the realms' own heroes. */
const clear = (S: World, ps: Province[]) => {
  S.characters = S.characters.filter((c) => c.player != null || !ps.some((p) => p.id === c.location));
  ps.forEach((p) => {
    p.characters = (p.characters ?? []).filter((id) => S.characters.some((c) => c.id === id));
  });
};
const text = (e: { text?: unknown }) => (typeof e.text === 'string' ? e.text : '');

test('(1) a hunter attacked by his quarry first holds the chase over to the next season', async () => {
  W['__KC_CATCH'] = null;
  const r = await sc.turn<World, { A: Character; B: Character; X: Province }>({
    realms: 2,
    cols: 10,
    rows: 6,
    seaPct: 10,
    prepare(S) {
      S.relations = { ...(S.relations ?? {}), '0-1': 'enemy' };
      const { A, B } = kings(S); // the hunter, and the quarry
      // Z: the hunter's start; X: his ground on the way; Y: the quarry's province beyond it
      let X: Province | undefined, Y: Province | undefined, Z: Province | undefined;
      for (const p of S.world.provinces.filter((p) => p.terrain !== 'sea')) {
        const n = nb(S, p).filter((q) => q.terrain !== 'sea');
        if (n.length >= 3) {
          X = p;
          Z = n[0];
          const z = Z;
          Y = n.find((q) => z && q.id !== z.id && !nb(S, z).some((w) => w.id === q.id)) ?? n[1];
          break;
        }
      }
      if (!X || !Y || !Z) throw new Error('no three provinces in a row');
      clear(S, [X, Y, Z]);
      own(S, X, 0);
      own(S, Y, 1);
      own(S, Z, 0);
      place(S, A, Z);
      A.armies = army('Heavy Infantry', 5, 'Veteran');
      A.skills = { ...(A.skills ?? {}), spy: 9 };
      place(S, B, Y);
      B.armies = army('Light Infantry', 3, 'Green');
      B.skills = { ...(B.skills ?? {}), spy: 0 };
      return { A, B, X };
    },
    orders: (_S, c) => ({
      [c.A.id]: plan(order('encounter', c.B.id)), // hunt the quarry down
      [c.B.id]: plan(order('rest'), order('move', c.X.id)), // …who turns and attacks him in Early Summer
    }),
  });
  const { A, X } = r.extra;
  expect(
    r.log.some((e) => e.phase === 0 && /presses on into .*trail of/.test(text(e)) && text(e).includes(X.name)),
    `the hunter closes in to ${X.name} in Spring (staging)`,
  ).toBe(true);
  const p1 = r.log.filter((e) => e.phase === 1);
  const battles = p1.map(text).filter((t) => /^⚔ \*\*Battle for /.test(t));
  expect(
    battles.some((t) => t.includes(X.name)),
    `the quarry's attack on ${X.name} was fought (staging)`,
  ).toBe(true);
  expect(battles, `${A.name} fights one battle in Early Summer`).toHaveLength(1);
  expect(
    p1.some((e) => /chase after .* must wait/.test(text(e))),
    'the chase waits for the next season',
  ).toBe(true);
  expect(
    p1.some(
      (e) =>
        /(rides|presses on) into .*(finds|trail of)/.test(text(e)) && (e.charId === A.id || text(e).startsWith(A.name)),
    ),
    `${A.name} stays in ${X.name} for the season`,
  ).toBe(false);
  expect(sc.errs).toEqual([]);
});

test('(2) a chase battle the hunter wins takes the province, and his report says so', async () => {
  // Hunter and quarry start next door to each other: the hunter in his own province X, the quarry in his own province
  // Y, with ground of his own (V) to fall back to. The catch is certain, and six Elite Warg Riders against two Green
  // levies win the battle.
  W['__KC_CATCH'] = 100;
  try {
    const r = await sc.turn<World, { A: Character; Y: Province }>({
      realms: 2,
      cols: 10,
      rows: 6,
      seaPct: 10,
      prepare(S) {
        S.relations = { ...(S.relations ?? {}), '0-1': 'enemy' };
        const { A, B } = kings(S);
        let X: Province | undefined, Y: Province | undefined, V: Province | undefined;
        for (const p of S.world.provinces.filter((p) => p.terrain !== 'sea')) {
          const n = nb(S, p).filter((q) => q.terrain !== 'sea');
          if (n.length >= 2) {
            Y = p;
            X = n[0];
            const x = X;
            V = n.find((q) => x && q.id !== x.id && !nb(S, x).some((z) => z.id === q.id)) ?? n[1];
            break;
          }
        }
        if (!X || !Y || !V) throw new Error('no three provinces together');
        clear(S, [X, Y, V]);
        own(S, X, 0);
        own(S, Y, 1);
        own(S, V, 1);
        place(S, A, X);
        A.armies = army('Warg Riders', 6, 'Elite');
        A.skills = { ...(A.skills ?? {}), spy: 9 };
        place(S, B, Y);
        B.armies = army('Light Infantry', 2, 'Green');
        B.skills = { ...(B.skills ?? {}), spy: 0 };
        return { A, Y };
      },
      orders: (S) => {
        const { A, B } = kings(S);
        return { [A.id]: plan(order('encounter', B.id)) }; // the chase, as an Encounter order sets it
      },
    });
    const { A, Y } = r.extra;
    const forced = r.log.find((e) => /runs .* to ground .* forces battle/.test(text(e)));
    expect(forced, 'the hunter runs the quarry to ground and forces battle (staging)').toBeTruthy();
    expect(
      r.log.some((e) => e.phase === forced?.phase && text(e).includes(A.name + "'s forces defeat")),
      '…and wins it (staging)',
    ).toBe(true);
    const S2 = r.S2 as World;
    expect(S2.world.provinces[Y.id]?.owner, `winning the chase battle takes ${Y.name}`).toBe(0);
    expect(
      r.log.some((e) => /claims .* for /.test(text(e)) && text(e).includes(Y.name)),
      '…and his report says he claims it',
    ).toBe(true);
    expect(sc.errs).toEqual([]);
  } finally {
    W['__KC_CATCH'] = null;
  }
});
