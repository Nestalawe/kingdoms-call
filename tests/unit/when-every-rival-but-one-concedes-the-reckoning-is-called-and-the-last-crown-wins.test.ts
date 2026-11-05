// 2026-09-27 (Toby, items 7 and 8; R-061): the moment every rival but one has conceded, the Reckoning is called at
// once: the realm still standing wins, by concession, and the final Legacy standings (every realm, its titles and its
// score) are published, the world told of both. The survivor's report flags each conceded rival as such, for its
// Diplomacy card. What the card shows is
// page/the-player-portals-diplomacy-card-shows-a-conceded-realm-and-an-extinguished-one.test.ts.
//
// Level 1 (unit): the turn's victory step (victoryTheReckoningEliminationConcessionAndTheAnnouncement, src/engine/turn/
// diplomacy-resolution-and-victory-…), called on the turn's context as the turn calls it after the phases, on a world
// of four realms the engine makes on its modules (tests/lib/a-staged-turn-on-the-engines-modules.ts) from KC_SEED; its
// lines in words through the views' theWordsOf; and realm 1's report (buildTurnReport on what it may see:
// playerView). Every realm but realm 1 has conceded this turn, and realm 1 has met them all, so its Diplomacy card has
// rows to show. Not lower: the end of the game is computed from the world. A turn need not run: nothing else in it
// decides the game's end.
//
// Until plan P1-14h this was the turns' part of tests/concede.test.js, which played two real turns of an all-bot game
// in the engine's bare vm at seed 1, every realm reported. Its checks are kept as they were: "a normal turn does not
// end the game" is the same step on the world before anyone concedes.
import { expect, test, vi } from 'vitest';
import { aStagedTurnOnTheEnginesModules } from '../lib/a-staged-turn-on-the-engines-modules.ts';
import { addTheFieldsResolveTurnAdds } from '../lib/the-fields-resolve-turn-adds-to-the-turns-context.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

interface World {
  turn: number;
  players: { conceded?: boolean; concededTurn?: number; _encountered?: number[] }[];
  gameOver?: {
    winner: number | null;
    byConcession?: boolean;
    byReckoning?: boolean;
    standings?: { titles?: unknown; score?: unknown }[];
  };
}

test('when every rival but one concedes, the Reckoning is called at once and the last crown wins', async () => {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { KC_SEASONS } = await import('../../src/content/kingdoms-call-data.ts');
  const { isBotRow } = await import('../../src/engine/bots/setup.ts');
  const { createTurnContext } = await import('../../src/engine/turn/context.ts');
  const { victoryTheReckoningEliminationConcessionAndTheAnnouncement: victory } =
    await import('../../src/engine/turn/diplomacy-resolution-and-victory-the-reckoning-elimination-concession-and-the-announcement.ts');
  const { theWordsOf } = await import('../../src/views/prose/the-words-of-each-line.ts');
  const { playerView } = await import('../../src/views/what-each-realm-may-see-of-the-world.ts');
  const { buildTurnReport } = await import('../../src/views/turn-report.ts');
  const { S } = sc.world({ realms: 4, cols: 12, rows: 7, seaPct: 35 });
  const G = S as unknown as World;
  vi.spyOn(console, 'log').mockImplementation(() => undefined); // emit echoes each line's kind
  /** The victory step on `G`, as the turn calls it after the phases; the words of the lines it writes. */
  const theVictoryStep = () => {
    const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], 3), { KC_SEASONS, isBotRow });
    tc._afterPhases = true;
    victory(tc as unknown as Parameters<typeof victory>[0]);
    return (tc.turnLog as { fact?: unknown }[]).filter((e) => e.fact).map((e) => theWordsOf(e.fact as never));
  };

  theVictoryStep();
  expect(G.gameOver, 'item 8: a normal turn does not end the game').toBeFalsy();

  // every realm but #1 concedes; the survivor has met them all, so the Diplomacy card has rows to show
  G.players.forEach((p, i) => {
    if (i !== 1) Object.assign(p, { conceded: true, concededTurn: G.turn });
  });
  const survivor = G.players[1];
  if (!survivor) throw new Error('could not stage: four realms');
  survivor._encountered = G.players.map((_, i) => i).filter((i) => i !== 1);
  const txt = theVictoryStep().join('\n');
  expect(G.gameOver, 'item 8: the game ends the turn the last rival concedes').toBeDefined();
  expect(G.gameOver?.winner, 'item 8: the realm still standing wins').toBe(1);
  expect(G.gameOver?.byConcession, 'item 8: recorded as won by concession').toBe(true);
  expect(G.gameOver?.byReckoning, 'item 8: the Reckoning was called').toBe(true);
  const st = G.gameOver?.standings ?? [];
  expect(st.length, 'item 8: every realm is in the final standings').toBe(G.players.length);
  expect(
    st.some((x) => Array.isArray(x.titles)),
    "item 8: the standings carry each realm's titles",
  ).toBe(true);
  expect(
    st.every((x) => typeof x.score === 'number'),
    'item 8: every realm has a Legacy score',
  ).toBe(true);
  expect(txt, 'item 8: the world is told the Reckoning has been called').toMatch(/THE RECKONING IS CALLED/);
  expect(txt, 'item 8: the result is announced').toMatch(/THE GAME IS DECIDED/);

  // the surviving realm's report must show the conceded rivals as such
  const known =
    (buildTurnReport(playerView(S as never, 1)) as { diplomacy?: { known?: { conceded?: boolean }[] } }).diplomacy
      ?.known ?? [];
  expect(known.length, 'item 7: the survivor has encountered realms to list').toBeGreaterThan(0);
  expect(
    known.filter((k) => k.conceded === true).length,
    'item 7: every rival is flagged conceded in the report payload',
  ).toBe(known.length);
});
