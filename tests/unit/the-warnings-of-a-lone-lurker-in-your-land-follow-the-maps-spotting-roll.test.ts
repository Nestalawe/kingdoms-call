// 2026-10-15 (Toby): the warnings about another realm's hero in your land follow the same spotting roll as the map:
// an enemy hero leading no troops, in a province of yours with none of your heroes there, is reported only if your
// people spot them (spotEnemyInOwnedProvince, the roll the report makes for the same hero, province and turn). A hero
// of a realm you are not at war with is always reported, as the map always shows them.
//
// Level 1 (unit): on a world the engine makes on its modules (tests/lib/a-staged-turn-on-the-engines-modules.ts) from
// KC_SEED, three realms, realm 0 at war with realm 1 only, its heroes moved out of its capital, and in the capital a
// hero of realm 1's and one of realm 2's, each leading no troops and given a name of its own: the warnings called as
// the turn calls them (generateIntrusionNotifications at each phase's end, then flushIntrusionNotifications), their
// lines in words through the views' theWordsOf, read as the old script read the turn's log (the lines for realm 0
// that open "[Intelligence]"); and realm 0's report (buildTurnReport on what it may see: playerView). The roll is
// stood in by vi.spyOn on its module (src/engine/heroes/fame-and-consecration.ts), called from the warnings' file and
// the sight rule's: a hero the test marks wins it, so no luck decides it; the test shows it is asked of the lurker.
// Not lower: the warnings and the sightings are computed from the world.
//
// Until plan P1-14h this was tests/intrusion-lurker.test.js, which played one real turn in the engine's bare vm with
// the roll stood in there. Its four checks are kept as they were; one is added (stricter: plan P1-14's Decision 2):
// the roll stood in is asked of the lurker, by the warnings and by the report.
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
}
interface Province {
  id: number;
  terrain: string;
  characters: number[];
}
interface World {
  turn: number;
  relations: Record<string, string>;
  players: { homeProvinceId: number }[];
  characters: Character[];
  world: { cols: number; rows: number; provinces: Province[] };
}

test('a lone lurker who wins the spotting roll is neither warned of nor sighted; a hero of a realm at peace is both', async () => {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { KC_SEASONS } = await import('../../src/content/kingdoms-call-data.ts');
  const { isBotRow } = await import('../../src/engine/bots/setup.ts');
  const { createTurnContext } = await import('../../src/engine/turn/context.ts');
  const { getNeighborsP } = await import('../../src/engine/world/map-helpers.ts');
  const { generateIntrusionNotifications, flushIntrusionNotifications } =
    await import('../../src/engine/turn/intrusion-warnings.ts');
  const { theWordsOf } = await import('../../src/views/prose/the-words-of-each-line.ts');
  const { playerView } = await import('../../src/views/what-each-realm-may-see-of-the-world.ts');
  const { buildTurnReport } = await import('../../src/views/turn-report.ts');
  const spotting = await import('../../src/engine/heroes/fame-and-consecration.ts');
  const { S } = sc.world({ realms: 3 });
  const G = S as unknown as World;
  const P = G.world.provinces;
  const home = P[G.players[0]?.homeProvinceId ?? -1];
  if (!home) throw new Error('could not stage: a capital for realm 0');
  G.relations = { ...G.relations, '0-1': 'enemy' }; // at war with realm 1; realm 2 stays neutral
  const moveTo = (c: Character, p: Province) => {
    const old = P[c.location];
    if (old) old.characters = old.characters.filter((id) => id !== c.id);
    if (!p.characters.includes(c.id)) p.characters.push(c.id);
    c.location = p.id;
  };
  // the home realm's own heroes leave for a neighbouring province, so none of them stands beside the intruders
  const away = getNeighborsP<Province>(home as never, G.world.cols, G.world.rows, P).find((p) => p.terrain !== 'sea');
  const lurker = G.characters.filter((c) => c.alive && c.player === 1)[1];
  const peaceful = G.characters.filter((c) => c.alive && c.player === 2)[1];
  if (!away || !lurker || !peaceful)
    throw new Error('could not stage: land beside the capital and two heroes each for realms 1 and 2');
  G.characters
    .filter((c) => c.alive && c.player === 0)
    .forEach((c) => {
      moveTo(c, away);
    });
  // the warnings and the sightings name the heroes, and the world may deal two the same name: these get their own
  lurker.name = 'Lurka Testshade';
  peaceful.name = 'Pax Testcalm';
  // both win the roll if it is asked; it is never asked for a realm at peace
  const winsTheRoll = new Set([lurker.id, peaceful.id]);
  [lurker, peaceful].forEach((c) => {
    moveTo(c, home);
    c.armies = [];
  });
  vi.spyOn(console, 'log').mockImplementation(() => undefined); // emit echoes each line's kind
  const asked: number[] = [];
  const roll = spotting.spotEnemyInOwnedProvince;
  vi.spyOn(spotting, 'spotEnemyInOwnedProvince').mockImplementation((...args: Parameters<typeof roll>) => {
    const enemy = args[3];
    asked.push(enemy.id);
    return winsTheRoll.has(enemy.id) ? false : roll(...args);
  });

  const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], 3), { KC_SEASONS, isBotRow });
  for (let ph = 0; ph < 5; ph++) {
    tc._currentPhase = ph;
    generateIntrusionNotifications(tc as never, ph);
  }
  tc._currentPhase = null;
  tc._afterPhases = true;
  flushIntrusionNotifications(tc as never);
  const alerts = (tc.turnLog as { targets?: number[]; fact?: unknown }[])
    .filter((e) => (e.targets ?? []).includes(0) && e.fact)
    .map((e) => theWordsOf(e.fact as never))
    .filter((t) => t.startsWith('[Intelligence]'));
  expect(
    alerts.some((t) => t.includes(peaceful.name)),
    `a hero of a realm at peace in your land is reported (${String(alerts.length)} alert(s))`,
  ).toBe(true);
  expect(
    alerts.filter((t) => t.includes(lurker.name)),
    'a lone lurker who won the spotting roll is not',
  ).toEqual([]);
  expect(asked, '…the spotting roll asked of the lurker by the warnings').toContain(lurker.id);

  asked.length = 0;
  const sightings = (buildTurnReport(playerView(S as never, 0)) as { heroSightings?: { name: string }[] })
    .heroSightings;
  expect(
    (sightings ?? []).some((s) => s.name === lurker.name),
    '…and the report agrees: the lurker is not among the sightings',
  ).toBe(false);
  expect(
    (sightings ?? []).some((s) => s.name === peaceful.name),
    '…while the hero at peace is',
  ).toBe(true);
  expect(asked, '…the spotting roll asked of the lurker by the report').toContain(lurker.id);
});
