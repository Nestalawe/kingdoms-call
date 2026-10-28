// The set-up in a whole turn (plan P1-08k7, the first two stages of resolveTurn's own body lifted out): once the save is
// read and the bots' flags stamped, the turn's start repairs (a wandering hero's beast race, a stranded guard, a
// stranded hull's marker, a "(wandering)" tag on a realm's hero, last turn's orders and scratch lists, the realm each
// hero serves), then the merge of the realms' orders (which rows are read and in what form; the heroes' order in the
// column; orders for another turn; declarations and Safe Start; research choices; the Reckoning; messages;
// concession; orders and plans held for a hero to come; encounter plans; a new heir's choices). Each case of
// lib/set-up-and-order-merge-cases.ts staged on the middle of a bot world, from plain realms each holding only its seat
// with a living king there, and played through resolveTurn with the slot rows the case sends, the case's dice fixed
// for the whole turn; what the set-up leaves is read as the first phase begins, and what follows from it after the
// turn. Level 2 (scenario): the stages are what the turn does first, and what they set is read by every stage after
// them, so only a whole turn plays them as the game does.
// unit/set-up-and-order-merge-called-directly.test.ts calls the two stages directly.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The set-up (P1-08k7, the first two stages of `resolveTurn`'s own body: the turn's start repairs, then the merge of
// the realms' orders), played through a whole turn from slot rows each case writes (`playCase`, from plain realms each
// holding only its seat with a living king there: k5a's `stageCase`; every realm a player's, sending its heroes Resting
// for this turn unless the case says otherwise), each case of `lib/set-up-and-order-merge-cases.ts`, in game terms,
// with the dice fixed for the whole turn, its lines the GM's log in words (`theTurnsLinesInWords`, since P1-12d6, when
// the orders' lines became facts); what the set-up leaves is read as the first phase begins
// (`startPhaseHealingSnapshotsAndStalledBattles` wrapped), what follows from it after the turn, and the turn's record
// of orders from the reports. The repairs: a wandering hero wearing a beast's race (Monster, Creature) given the
// people's race at his id, a realm's hero and a wandering Elf left as they are; a neutral guard with no companies or in
// a realm's land a wanderer, one leading companies on unclaimed ground still a guard; no stranded hull's marker (of any
// phase, 0 too) on a garrison company; a realm's hero bearing "(wandering)" mended and the GM told the count at the
// turn's end, none told with none; last turn's orders, and orders for a hero no longer in play, gone; the five per-turn
// lists empty; each living hero of a realm noting his realm once, a wanderer and a fallen hero not; five phases for
// every living realm hero. The merge: a seat nobody holds and a realm that sent nothing not read; orders as an object
// or as text, in today's form or the older one (each hero's phases alone), all read; a payload with no encounter plans
// (or with plans and no orders) read as the older form, one with plans set to nothing in today's; the rows read
// whatever their order; phases that aren't a list given to nobody. The heroes' order in the column kept as text, the
// first 200 places, an order that isn't a list leaving it as it was, in the older form too and from a payload for
// another turn. Orders for another turn (later or earlier) refused, the GM told, the hero Defending, no encounter plan
// or heir's choices taken, though the realm's declaration, messages and concession are (the concession told first);
// orders with no turn on them read. Declarations taken (war made at the turn's end), set aside under Safe Start (war or
// Treat) with the realm alone told, nothing told for none or neutral, Safe Start over with the orders for turn 6 and
// holding on turn 5; declarations as text or nothing not read. Research choices: the lead picked pursued; one sent with
// orders for another turn, or as text, not taken (the scholars choose), one with no turn taken. The Reckoning: a call
// taken (too early, told so), none from a realm that conceded before or sent as text, a call taken with a concession in
// the same orders, two realms' calls both taken. Messages: delivered to the realm they are for with a copy to the
// sender, every message in its order, every realm's; none as text. Concession: the realm out from this turn, everyone
// told, its heroes holding whatever they were ordered; not told again for a realm that conceded before; not taken as
// text; a realm conceded before holding whatever it sends, or with no orders of its own once another realm's are read;
// Defending as any hero when no realm's orders are read; its fallen hero given none; concessions told in the rows'
// order. Orders written for a hero a realm means to raise, hire (the hirer as sent, a hirer to be hired too) or charm
// held, not given to him; two realms' orders for one body both held; keys not of the form set aside, held for nobody.
// Encounter plans set and kept, only the fields a plan has (tactics, notes, duel stance, conquest doctrine), each of
// its kind, a held plan's too; one sent as nothing or as text leaving the hero's, plans on hire, raise and charm cards
// held (not set), a card's nothing or a malformed card's key not held, a plan for nobody harmless. A new heir's skills,
// name (trimmed, then cut to 40) and temper applied and his marks taken off; his skills only as his crowned skills plus
// at most the points the save gives him (fewer kept), no more than 2 in one, none lowered, each a skill the game has at
// a whole level, sent by skill, else set aside with the GM told; an unknown temper and an empty name leaving his own; a
// hero not an heir left alone; an heir sent nothing still an heir. Only a realm's own heroes: orders, plans and heir's
// choices for another realm's hero or a wanderer set aside, whichever row comes first, the GM told in one line per
// realm, each hero once in the order sent; nothing told when all are its own. The record of orders: a realm's heroes'
// orders, declarations, Reckoning call, concession and plans as merged; nothing for a realm that sent nothing. Level 2:
// the stages are what the turn does first, and every stage after them reads what they set
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { SET_UP_CASES, playCase, stageCase } from '../lib/set-up-and-order-merge-cases.ts';
import { board } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });

describe.each(SET_UP_CASES)('%s, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { got, want } = c.check(playCase(b, c, s), s);
    expect(got).toEqual(want);
  });
});
