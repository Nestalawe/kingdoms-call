// The item and army orders in a whole turn (plan P1-08j5, the fifth family of processOrder's orders taken out of it):
// Equip Items, Use Item, Send Item, Leave/Transfer Army, Release Hero, Disband Army and Pick Up Army. Each case of
// lib/item-and-army-order-cases.ts staged on the middle of a bot world, from plain realms (`stageCase`), and played
// through resolveTurn, every realm human-held, every other hero Resting. Level 2 (scenario): the order is read and
// checked inside resolveTurn (a hero held by an enchantment won't disband), a courier's parcel arrives at the turn's
// end, and the turn's end crumbles the dead left with no one to command them and moves bands of mercenaries on, so
// only a whole turn plays it as a realm gives it.
// unit/item-and-army-orders-called-directly.test.ts calls each order's own function on the same cases, one phase at a
// time.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Equip Items, Use Item, Send Item, Leave/Transfer Army, Release Hero, Disband Army and Pick Up Army (P1-08j5), played
// through a whole turn as the Move's are (`playTurn`, from plain realms: `stageCase`): each case of
// `lib/item-and-army-order-cases.ts`, in game terms. Equip Items: the named are worn, the rest taken off, a slot's
// limit kept (the first named wins, the rest told), an empty slot filled again, by name or id, never another folk's
// item. Use Item: refused for a hero held by a Charm, an item he lacks or one used; a passive item needs no using; the
// Philosopher's Stone as a lair yields it today is called passive (Parked: it can't be worked); an older save's Stone
// raises every company the realm leads and garrisons one grade (the dead, the Elite and other realms' left), is not
// spent on nothing, is gone, every realm told, every other copy struck from the hoards. Send Item: refused for a
// charmed giver or taker, nobody, a hire card not in service, another realm's or a fallen hero, himself, nothing that
// matches, Mithril Armour; by place, id or name, once each; at once beside him (the taker told, and whether he wears
// it) or by courier by the turn's end; told in the phase sent. Leave/Transfer Army: to a comrade beside him (by his
// place in the list of heroes, as the engine reads it) or a held province's garrison; refused for no companies, nothing
// that matches, a comrade elsewhere (where he went is named), fallen, another realm's, ground not held, and at sea a
// hand-over that leaves either side unshipped; the dead won't follow a living commander; beasts beyond the comrade's
// Druid stay. Release Hero: not a king, not while leading; a wanderer with what he carries, his later orders dropped,
// his asking price a wanderer's. Disband Army: each company a band of its kind and grade (or told retired at the turn's
// end), a fleet at sea, the dead crumble; refused for a hero held by an enchantment. Pick Up Army: "all", chosen
// places, the old forms, a band refused, beasts beyond his Druid and what his ships can't carry sent back. Level 2: the
// order is read and checked inside `resolveTurn`, a courier's parcel arrives at the turn's end, and the turn's end
// retires bands and crumbles unled dead
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { ITEM_AND_ARMY_ORDER_CASES, stageCase } from '../lib/item-and-army-order-cases.ts';
import { board, playTurn } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });

describe.each(ITEM_AND_ARMY_ORDER_CASES)('the %s order, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { after, lines } = playTurn(b, Object.fromEntries(s.orders.map(([h, os]) => [h.id, os])));
    const { got, want } = c.check(
      { world: after, lines: lines.filter((l) => l.charId === s.hero.id), all: lines, turn: b.G.turn },
      s,
    );
    expect(got).toEqual(want);
  });
});
