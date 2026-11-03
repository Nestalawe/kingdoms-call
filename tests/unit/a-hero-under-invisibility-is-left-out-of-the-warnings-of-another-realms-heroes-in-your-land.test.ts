// 2026-10-15 (Toby): the warnings about another realm's hero in your land (or beside your heroes) no longer give away
// a hero under Invisibility. A visible intruder is still reported.
//
// Level 1 (unit): the warnings (generateIntrusionNotifications at each phase's end, then flushIntrusionNotifications
// after the phases: src/engine/turn/intrusion-warnings.ts) called as the turn calls them, on the turn's context, on a
// world the engine makes on its modules (tests/lib/a-staged-turn-on-the-engines-modules.ts) from KC_SEED; their lines
// in words through the views' theWordsOf, read as the old script read the turn's log: the lines for realm 0 that open
// "[Intelligence]". Two heroes of realm 1's, leading no troops and each given a name of its own (the lines are read by
// name), stand in realm 0's capital all turn, one under Invisibility (stamped as if cast), so no roll decides it. Not
// lower: the warnings are computed from the world. That a whole turn calls them in every season and tells them once
// after is scenario/after-the-phases-in-a-whole-turn's ("an enemy hero in the realm all turn is told once, …").
//
// Until plan P1-14h this was tests/intrusion-invisible.test.js, which played one real turn on the booted GM page. Its
// two checks are kept as they were; one is added (stricter: plan P1-14's Decision 2): the same hero without
// Invisibility is warned of, so it is the Invisibility that hides him.
import { expect, test, vi } from 'vitest';
import { aStagedTurnOnTheEnginesModules } from '../lib/a-staged-turn-on-the-engines-modules.ts';
import { addTheFieldsResolveTurnAdds } from '../lib/the-fields-resolve-turn-adds-to-the-turns-context.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

interface Character {
  id: number;
  name: string;
  player: number | null;
  alive: boolean;
  location: number;
  armies: unknown[];
  _invisTurn?: number;
}
interface Province {
  id: number;
  characters: number[];
}
interface World {
  turn: number;
  players: { homeProvinceId: number }[];
  characters: Character[];
  world: { provinces: Province[] };
}

/** Realm 1's second and third heroes, leading no troops, in realm 0's capital; `warnings(G)` gives the words of the
 *  warnings' lines for realm 0, the five phases played as the turn plays them. */
async function stage() {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { KC_SEASONS } = await import('../../src/content/kingdoms-call-data.ts');
  const { isBotRow } = await import('../../src/engine/bots/setup.ts');
  const { createTurnContext } = await import('../../src/engine/turn/context.ts');
  const { generateIntrusionNotifications, flushIntrusionNotifications } =
    await import('../../src/engine/turn/intrusion-warnings.ts');
  const { theWordsOf } = await import('../../src/views/prose/the-words-of-each-line.ts');
  const { S } = sc.world({ realms: 2 });
  const G = S as unknown as World;
  const P = G.world.provinces;
  const home = P[G.players[0]?.homeProvinceId ?? -1];
  const [, hid, seen] = G.characters.filter((c) => c.alive && c.player === 1);
  if (!home || !hid || !seen) throw new Error('could not stage: a capital for realm 0 and three heroes for realm 1');
  const moveTo = (c: Character, p: Province) => {
    const old = P[c.location];
    if (old) old.characters = old.characters.filter((id) => id !== c.id);
    if (!p.characters.includes(c.id)) p.characters.push(c.id);
    c.location = p.id;
  };
  [hid, seen].forEach((c) => {
    moveTo(c, home);
    c.armies = [];
  });
  hid._invisTurn = G.turn;
  // the warnings name the heroes, and the world may deal two the same name: these two get names of their own
  hid.name = 'Hidda Testveil';
  seen.name = 'Seren Testopen';
  vi.spyOn(console, 'log').mockImplementation(() => undefined); // emit echoes each line's kind
  const warnings = () => {
    const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], 3), { KC_SEASONS, isBotRow });
    for (let ph = 0; ph < 5; ph++) {
      tc._currentPhase = ph;
      generateIntrusionNotifications(tc as never, ph);
    }
    tc._currentPhase = null;
    tc._afterPhases = true;
    flushIntrusionNotifications(tc as never);
    return (tc.turnLog as { targets?: number[]; fact?: unknown }[])
      .filter((e) => (e.targets ?? []).includes(0) && e.fact)
      .map((e) => theWordsOf(e.fact as never))
      .filter((t) => t.startsWith('[Intelligence]'));
  };
  return { G, hid, seen, warnings };
}

test("a hero under Invisibility is left out of the warnings of another realm's heroes in your land; a visible one is not", async () => {
  const { hid, seen, warnings } = await stage();
  const alerts = warnings();
  expect(
    alerts.some((t) => t.includes(seen.name)),
    `a visible intruder is still reported (${String(alerts.length)} alert(s))`,
  ).toBe(true);
  expect(
    alerts.filter((t) => t.includes(hid.name)),
    'a hero under Invisibility is not',
  ).toEqual([]);
  delete hid._invisTurn;
  expect(
    warnings().some((t) => t.includes(hid.name)),
    '…and the same hero without Invisibility is',
  ).toBe(true);
});
