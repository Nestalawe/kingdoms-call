// 2026-10-13 (item 16): cast orders assume that every Practice order earlier in the turn succeeds, in how many spells
// the hero may cast. The bots' order check (runBotOrderHygiene, with botCastLimit) counts a bot's earlier practice
// orders the same way, so it no longer strikes out a cast that relies on one. The player's side is
// tests/page/the-encounter-plans-spell-picker-assumes-a-practice-this-turn-succeeds.test.ts; the engine's part (a cast
// refused because a practice had not yet raised the school spends no casting slot) is
// tests/scenario/research-and-practice-orders-in-a-whole-turn.test.ts.
//
// Level 1 (unit): botCastLimit and runBotOrderHygiene are called directly on the engine's modules, on a world the
// engine makes from the run's seed (tests/lib/a-staged-turn-on-the-engines-modules.ts's world()); no turn is played.
// Any world does: the bot king's Psychic and items are set before the checks. Until plan P1-14z this was the first
// half of tests/cast-practice-assumed.test.js, which made its world on the booted GM page.
import { beforeAll, expect, test, vi } from 'vitest';
import { aStagedTurnOnTheEnginesModules } from '../lib/a-staged-turn-on-the-engines-modules.ts';
import type * as TheBotsEconomy from '../../src/engine/bots/economy.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

type GameState = Parameters<typeof TheBotsEconomy.botCastLimit>[0];
type Character = Parameters<typeof TheBotsEconomy.botCastLimit>[1];

let G: GameState;
let bot: Character;
let economy: typeof TheBotsEconomy;

beforeAll(async () => {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  // the same fresh module the world was made with
  economy = await import('../../src/engine/bots/economy.ts');
  // `as`: the engine's world, as the bots' order check reads it
  G = sc.world({ realms: 2 }).S as unknown as GameState;
  const king = G.characters.find((c) => c.alive && c.player === 1 && c.isKing);
  if (!king) throw new Error('realm 1 has no king');
  bot = king;
  bot.skills.psychic = 2;
  bot.items = [];
});

test('botCastLimit counts each earlier practice as a level (Psychic 2: one spell, two after a practice, three after two)', () => {
  expect([
    economy.botCastLimit(G, bot, 'psychic'),
    economy.botCastLimit(G, bot, 'psychic', 1),
    economy.botCastLimit(G, bot, 'psychic', 2),
  ]).toEqual([1, 2, 3]);
});

test('a bot that practises Psychic keeps both later Psychic casts', () => {
  // `as`: a save holds no orders between turns (its schema: lists of null); the turn stages them here, as the bots'
  // pass meets them
  const orders = G.turnOrders as unknown as Record<
    number,
    { action: string; target: string; extra: string; desc: string }[] | undefined
  >;
  orders[bot.id] = [
    { action: 'practice', target: 'psychic', extra: '', desc: '' },
    { action: 'cast_spell', target: 'Clairvoyance', extra: String(bot.location), desc: '' },
    { action: 'cast_spell', target: 'Oratory', extra: String(bot.id), desc: '' },
    { action: 'rest', target: '', extra: '', desc: '' },
    { action: 'rest', target: '', extra: '', desc: '' },
  ];
  // the check's tally of what it struck out, which it keeps on the page's window
  const tally: Partial<Record<string, number>> = {};
  vi.stubGlobal('window', { __botHyg: tally });
  try {
    economy.runBotOrderHygiene(G, new Set([1]));
  } finally {
    vi.unstubAllGlobals();
  }
  const o = orders[bot.id] ?? [];
  expect(o.map((x) => x.action)).toEqual(['practice', 'cast_spell', 'cast_spell', 'rest', 'rest']);
  expect(tally['overLimit'] ?? 0).toBe(0);
});
