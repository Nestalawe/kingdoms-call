// B-17b (BOT-V7's first part): the bots' record of their choices, per bot realm and turn, kept outside the game's
// state. It counts each outcome of the order hygiene by its reason (the eight reasons it drops an order for, and the
// three changes it makes), each padding order by the kind the code that wrote it names (never by its words), the
// phases left empty, and each hero's cast limit and casts in each school. It is off unless a page asks for it.
// - The record's own functions, called directly: every reason counted (one twice), each padding kind counted, a copy
//   of a padding order keeping its kind, a limit recorded for a hero with no cast, and nothing kept while it is off.
// - Through the order hygiene (runBotOrderHygiene), with the page's ask stubbed: a second Psychic cast past the limit
//   of a hero at Psychic 2 is counted as over the limit, and his Psychic limit (1) and the one cast left are recorded.
// The matrix's page half turns it on (tools/balance/play.ts), so every matrix game proves it plays nothing otherwise.
// Level 1 (unit): the engine's modules on a world the engine makes from the run's seed
// (tests/lib/a-staged-turn-on-the-engines-modules.ts's world()); no turn is played, so no lower level holds a hero.
// The checks read only what the test sets (the hero's Psychic, his items and his orders), so any seed's world does.
import { beforeAll, expect, test, vi } from 'vitest';
import { aStagedTurnOnTheEnginesModules } from '../lib/a-staged-turn-on-the-engines-modules.ts';
import type * as TheBotsEconomy from '../../src/engine/bots/economy.ts';
import type * as TheBotsRecord from '../../src/engine/bots/the-bots-record-of-their-choices-per-realm-per-turn-kept-outside-the-save.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

type GameState = Parameters<typeof TheBotsEconomy.botCastLimit>[0];
type Character = Parameters<typeof TheBotsEconomy.botCastLimit>[1];
type TheRecord = TheBotsRecord.TheBotsRecordOfARealmsTurn;

let G: GameState;
let bot: Character;
let economy: typeof TheBotsEconomy;
let record: typeof TheBotsRecord;

beforeAll(async () => {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  // the same fresh modules the world was made with
  economy = await import('../../src/engine/bots/economy.ts');
  record =
    await import('../../src/engine/bots/the-bots-record-of-their-choices-per-realm-per-turn-kept-outside-the-save.ts');
  // `as`: the engine's world, as the bots' order check reads it
  G = sc.world({ realms: 2 }).S as unknown as GameState;
  const king = G.characters.find((c) => c.alive && c.player === 1 && c.isKing);
  if (!king) throw new Error('realm 1 has no king');
  bot = king;
  bot.items = [];
});

/** Another hero of the world (any: the record reads only his id and plan here). */
function theOtherHero(): Character {
  const other = G.characters.find((c) => c.id !== bot.id);
  if (!other) throw new Error('the world has one hero');
  return other;
}
const aHold = () => ({ action: 'defend', target: '', extra: '', desc: 'Hold' });

test('the record counts each of the order hygiene’s reasons, each padding kind, the empty phases and a hero’s cast limit', () => {
  const kept: TheRecord[] = [];
  // off: nothing is kept
  record.theBotsRecordCountsAHygienesOutcome(G, 1, 'overLimit');
  record.theBotsRecordOpensTheTurn(G, kept);
  for (const outcome of record.THE_ORDER_HYGIENES_OUTCOMES) record.theBotsRecordCountsAHygienesOutcome(G, 1, outcome);
  record.theBotsRecordCountsAHygienesOutcome(G, 1, 'practiceCapped');
  const hold = record.aPaddingOrder(G, 'hold', aHold());
  const post = record.aPaddingOrder(G, 'hold-the-post', { ...aHold(), desc: 'Hold the post' });
  // a padding order's copy pads as it does; an order with a padding's words but no kind doesn't
  const plan = [hold, record.aCopyOfAnOrderKeepingItsPaddingKind(G, hold), post, aHold(), null];
  // a second hero, padded with each other kind once
  const others = record.THE_KINDS_OF_PADDING_ORDER.filter((k) => k !== 'hold' && k !== 'hold-the-post');
  const second = others.map((k) => record.aPaddingOrder(G, k, aHold()));
  record.theBotsRecordClosesARealmsTurn(
    G,
    1,
    [
      { hero: bot, plan },
      { hero: theOtherHero(), plan: second },
    ],
    {
      schools: ['psychic', 'white'],
      theLimitOf: (hero, school) => (school === 'psychic' && hero.id === bot.id ? 2 : 0),
      theSchoolOfACast: () => null,
      practises: () => false,
    },
  );
  record.theBotsRecordClosesTheTurn(G);
  expect(kept.length, 'one record for the realm').toBe(1);
  const r = kept[0];
  for (const outcome of record.THE_ORDER_HYGIENES_OUTCOMES)
    expect(r?.hygiene[outcome], `the hygiene's ${outcome}`).toBe(outcome === 'practiceCapped' ? 2 : 1);
  expect(r?.padding.hold, 'the plain holds').toBe(2);
  expect(r?.padding['hold-the-post'], 'the holds of the post').toBe(1);
  for (const k of others) expect(r?.padding[k], `the padding of kind ${k}`).toBe(1);
  expect(others.length, 'five kinds beside the two holds').toBe(5);
  expect(r?.phasesLeftEmpty, 'the phases left empty').toBe(1);
  expect(r?.casts, 'his Psychic limit, with no cast; no White').toEqual([
    { hero: bot.id, school: 'psychic', limit: 2, limitTheHygieneApplies: 2, casts: 0 },
  ]);
  expect([r?.turn, r?.realm], 'the turn and the realm').toEqual([G.turn, 1]);
  // closed: the next turn's record opens afresh, and nothing is kept while it is off
  record.theBotsRecordCountsAHygienesOutcome(G, 1, 'overLimit');
  record.theBotsRecordClosesARealmsTurn(G, 1, [], {
    schools: [],
    theLimitOf: () => 0,
    theSchoolOfACast: () => null,
    practises: () => false,
  });
  expect(kept.length, 'nothing kept once the turn is closed').toBe(1);
  // a turn no page asks for keeps nothing, though the turn before was asked for and left open
  const theTurnBefore: TheRecord[] = [];
  record.theBotsRecordOpensTheTurn(G, theTurnBefore);
  record.theBotsRecordOpensTheTurn(G, null);
  record.theBotsRecordCountsAHygienesOutcome(G, 1, 'overLimit');
  record.theBotsRecordClosesARealmsTurn(G, 1, [], {
    schools: [],
    theLimitOf: () => 0,
    theSchoolOfACast: () => null,
    practises: () => false,
  });
  expect(theTurnBefore.length, 'nothing kept in a turn no page asks for').toBe(0);
});

/** The king's casts staged through the hygiene: his Psychic 2, no item, no title, and no other hero standing with him
 *  (each of whom could add to his skill), so the limits are his own. */
function theHygieneOnTheKingsPlan(plan: { action: string; target: string; extra: string; desc: string }[]) {
  bot.skills.psychic = 2;
  bot.items = [];
  G._minorHolders = {};
  const elsewhere = G.world.provinces.find((P) => P.id !== bot.location)?.id;
  if (elsewhere === undefined) throw new Error('the world has one province');
  for (const c of G.characters) if (c.id !== bot.id && c.location === bot.location) c.location = elsewhere;
  // `as`: a save holds no orders between turns (its schema: lists of null); the turn stages them here, as the bots'
  // pass meets them
  const orders = G.turnOrders as unknown as Record<
    number,
    { action: string; target: string; extra: string; desc: string }[] | undefined
  >;
  orders[bot.id] = plan;
  const kept: TheRecord[] = [];
  vi.stubGlobal('window', { __botChoices: kept });
  try {
    economy.theBotsRecordOpensForThePageThatAsks(G);
    economy.runBotOrderHygiene(G, new Set([1]));
  } finally {
    vi.unstubAllGlobals();
  }
  return kept.find((x) => x.realm === 1);
}
const aCast = (spell: string) => ({ action: 'cast_spell', target: spell, extra: String(bot.location), desc: '' });
const aRest = () => ({ action: 'rest', target: '', extra: '', desc: '' });

test('the order hygiene counts a cast past the limit in the realm’s record, and records the hero’s limit and casts', () => {
  const r = theHygieneOnTheKingsPlan([aCast('Clairvoyance'), aCast('Oratory'), aRest(), aRest(), aRest()]);
  expect(r?.hygiene.overLimit, 'the second Psychic cast, over the limit').toBe(1);
  expect(
    r?.casts.find((c) => c.hero === bot.id && c.school === 'psychic'),
    'his Psychic limit and the cast left',
  ).toEqual({ hero: bot.id, school: 'psychic', limit: 1, limitTheHygieneApplies: 1, casts: 1 });
});

test('a hero who practises, then casts twice, has the limit the hygiene applies recorded beside the one he began with', () => {
  const practice = { action: 'practice', target: 'psychic', extra: '', desc: '' };
  const r = theHygieneOnTheKingsPlan([practice, aCast('Clairvoyance'), aCast('Oratory'), aRest(), aRest()]);
  expect(r?.hygiene.overLimit ?? 0, 'no cast over the limit').toBe(0);
  expect(
    r?.casts.find((c) => c.hero === bot.id && c.school === 'psychic'),
    'his Psychic limit as the turn began (1), the one the hygiene applies (2), and both casts',
  ).toEqual({ hero: bot.id, school: 'psychic', limit: 1, limitTheHygieneApplies: 2, casts: 2 });
});
