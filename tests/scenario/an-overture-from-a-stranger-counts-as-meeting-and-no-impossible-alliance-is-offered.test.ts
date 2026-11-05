// 2026-10-08 (Toby, item 3; R-078): overtures of peace and alliance.
//   (a) A realm courted by a realm it has never met now counts as having met it, so it can answer.
//   (b) In a game of three realms or fewer no alliance can be forged, so an offer of one is not sent: nobody is told
//       to answer an offer that can't be accepted. Peace can still be offered.
//   (c) The courted realm's Diplomacy card entry carries the offer it received last turn (what the card shows is
//       page/the-player-portals-diplomacy-card-shows-the-offer-a-realm-received.test.ts).
//
// Level 2 (scenario): one real turn on the engine's modules (tests/lib/a-staged-turn-on-the-engines-modules.ts) from
// KC_SEED, as the shell plays it, two human realms and the rest bots: the overtures are resolved inside the turn
// from the orders realm 0 sends, and read in each realm's report built after it, so no lower level holds both. Realm 0
// has met realm 1, which has never met realm 0; realm 0's orders carry a Treat towards realm 1.
//
// Until plan P1-14h this was tests/overtures.test.js's turns, played on the booted GM page with the same worlds and
// orders. Its checks are kept as they were; "the GM portal boots" is the typed import, and "page errors 0" is "throws
// nothing": a console.error fails the test (tests/setup/each.ts).
import { expect, test } from 'vitest';
import { aStagedTurnOnTheEnginesModules } from '../lib/a-staged-turn-on-the-engines-modules.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

interface World {
  turn: number;
  safeStart?: boolean;
  relations?: Record<string, string>;
  players: { name: string; _encountered?: number[] }[];
}
interface Known {
  index: number;
  offeredUs?: string | null;
}
interface Report {
  lastTurnLog?: (string | { text?: string } | null)[];
  diplomacy?: { known?: Known[] };
}

/** One turn of a game of `n` realms, realms 0 and 1 human, `relation` between them; realm 0 sends a Treat. */
async function play(n: number, relation: string) {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { S, setup } = sc.world({ realms: n, cols: 16, rows: 9, seaPct: 30 });
  const G = S as unknown as World;
  const [p0, p1] = G.players;
  if (!p0 || !p1) throw new Error('could not stage: two realms');
  p0._encountered = [1];
  p1._encountered = []; // realm 1 has never met realm 0
  G.relations = G.relations ?? {};
  if (relation !== 'neutral') G.relations['0-1'] = relation;
  const orders = (pi: number) =>
    JSON.stringify({ orders: {}, encounterPlans: {}, forTurn: G.turn, diplomacy: pi === 0 ? { 1: 'treat' } : {} });
  const rows = setup.map((sp) => {
    const id = Number(sp.id);
    return {
      id: sp.gamePlayerId,
      user_id: id < 2 ? 'u' + String(id) : null,
      player_index: id,
      display_name: sp.name,
      orders: id < 2 ? orders(id) : null,
      orders_submitted: id < 2,
      turn_report: JSON.stringify({ isBot: id >= 2 }),
    };
  });
  const names = G.players.map((p) => p.name);
  const r = sc.play(S, rows);
  return {
    S2: r.S2 as unknown as World,
    rep0: (r.reports[0] ?? {}) as Report,
    rep1: (r.reports[1] ?? {}) as Report,
    names,
  };
}
const lines = (rep: Report) => (rep.lastTurnLog ?? []).map((e) => (typeof e === 'string' ? e : (e?.text ?? '')));
const knownOf = (rep: Report, index: number) => (rep.diplomacy?.known ?? []).find((k) => k.index === index);

test('in a game of four realms, an offer of alliance from a stranger is told, counts as meeting, and is on the card', async () => {
  const r = await play(4, 'neutral');
  expect(r.S2, 'the 4-realm turn resolved').toBeTruthy();
  const told = lines(r.rep1).filter((t) => t.includes('overture'));
  expect(
    told.some((t) => t.includes(r.names[0] ?? '?') && t.includes('alliance')),
    `realm 1 is told of realm 0's offer of alliance (${String(told.length)} line(s))`,
  ).toBe(true);
  expect(r.S2.players[1]?._encountered ?? [], '(a) being courted counts as meeting the realm that sent it').toContain(
    0,
  );
  const k0 = knownOf(r.rep1, 0);
  expect(k0, "(a) the sender is on realm 1's Diplomacy card, so it can answer").toBeDefined();
  expect(k0?.offeredUs, '(c) the card entry says an alliance was offered').toBe('alliance');
  const k1 = knownOf(r.rep0, 1);
  expect(k1 && !k1.offeredUs, "(c) the sender's own card shows no incoming offer from realm 1").toBe(true);
});

test('in a game of four realms at war, an offer of peace is labelled peace', async () => {
  const r = await play(4, 'enemy');
  expect(knownOf(r.rep1, 0)?.offeredUs, '(c) an offer of peace is labelled peace').toBe('peace');
});

test('in a game of three realms, no alliance can be offered, but peace still can', async () => {
  let r = await play(3, 'neutral');
  expect(r.S2, 'the 3-realm turn resolved').toBeTruthy();
  expect(
    lines(r.rep1).some((t) => t.includes('overture')),
    '(b) in a 3-realm game nobody is invited to answer an impossible alliance',
  ).toBe(false);
  expect(
    lines(r.rep0).some((t) => t.includes('overture') && t.includes('unanswered')),
    '(b) and the sender is not told their impossible offer "went unanswered"',
  ).toBe(false);
  const k0s = knownOf(r.rep1, 0);
  expect(!k0s?.offeredUs, '(b) no offer badge for an alliance that cannot be made').toBe(true);
  // ...but peace can still be offered in a small game.
  r = await play(3, 'enemy');
  expect(
    lines(r.rep1).some((t) => t.includes('overture of peace')),
    '(b) an offer of peace in a 3-realm game is still reported',
  ).toBe(true);
});
