// How many garrison companies a bot realm keeps in a province (botGarrisonTarget, src/engine/bots/strategy.ts). Under the
// bot switch (KC_BOT_LAIRS=1, G.botLairHunting) round 5 of the alignment tests stopped every bot but the Good ones from
// garrisoning at all, and the hand-played games showed what that costs: an empty capital falls to any host that walks
// in. Now the capital is held whatever the switch says (bot improvements, step 4): one company in peace, two once an
// enemy host is seen beside the realm's land, none while the Safe Start holds. The rest of the realm's land keeps the
// switch's rule (no garrison but the Good kit's), and a game without the switch keeps today's.
// Level 1 (unit): botGarrisonTarget called directly in the bare vm (tests/lib/engine.ts) on the middle of a bot world
// (tests/lib/middle-of-a-bot-world.ts). A lower level can't hold the realm's land and the enemy host beside it.
import { describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { board, hero, type Province } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
const garrisonTarget = engineFn(engine, 'botGarrisonTarget') as (G: unknown, prov: Province, pi: number) => number;

/** Realm 0 (Pagan, no kit) holds the middle province as its capital and the province next door; `turn` is the turn
 *  (the game has the Safe Start, which holds to turn 6); with `enemyBeside`, an enemy host (realm 1, at war) stands in that province. */
function stage(o: { lairSwitch: boolean; turn: number; enemyBeside: boolean }) {
  const b = board(engine, world, 0);
  const G = b.G as unknown as Record<string, unknown> & { players: Record<string, unknown>[] };
  G['turn'] = o.turn;
  G['botLairHunting'] = o.lairSwitch;
  G['safeStart'] = true;
  const me = G.players[0];
  if (!me) throw new Error('no realm 0');
  me['alignment'] = 'Pagan';
  me['homeProvinceId'] = b.X.id;
  b.own(b.X, 0);
  const next = b.ring1[0];
  const rich = b.ring1[1];
  if (!next || !rich) throw new Error('no neighbours');
  b.own(next, 0);
  b.own(rich, 0);
  rich['tax'] = 8;
  if (o.enemyBeside) hero(b, { player: 1, at: next, troops: 4 });
  return { capital: garrisonTarget(b.G, b.X, 0), rich: garrisonTarget(b.G, rich, 0) };
}

describe('under the bot switch, a bot realm that is not Good', () => {
  test('keeps one company in its capital in peace', () => {
    expect(stage({ lairSwitch: true, turn: 10, enemyBeside: false }).capital).toBe(1);
  });
  test('keeps two in its capital once an enemy host is seen beside its land', () => {
    expect(stage({ lairSwitch: true, turn: 10, enemyBeside: true }).capital).toBe(2);
  });
  test('keeps none in its capital while the Safe Start holds', () => {
    expect(stage({ lairSwitch: true, turn: 2, enemyBeside: false }).capital).toBe(0);
  });
  test('keeps none in the rest of its land, even rich land beside an enemy host, as before', () => {
    expect(stage({ lairSwitch: true, turn: 10, enemyBeside: true }).rich).toBe(0);
  });
});

describe('without the bot switch, as before', () => {
  test('one company in the capital in peace, none in other land', () => {
    expect(stage({ lairSwitch: false, turn: 10, enemyBeside: false })).toEqual({ capital: 1, rich: 0 });
  });
  test('two in the capital and one in rich land once an enemy host is seen beside it', () => {
    expect(stage({ lairSwitch: false, turn: 10, enemyBeside: true })).toEqual({ capital: 2, rich: 1 });
  });
});
