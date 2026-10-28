// Before the first phase in a whole turn (plan P1-08k8, four stages of resolveTurn's own body lifted out): once the
// realms' orders are merged, the relations made ready and last turn's research choices settled (the bots picking for
// themselves); war without warning, the titles held going into the turn, the Safe Start's and the stale orders' lines,
// the realms the GM removed, the realms' messages; the move pools, the turn's trackers, what lasts a turn cleared and
// the save's sweeps; and, once the bots have planned, the default to Defend, the turn's record of orders and the war
// fronts at the start. Each case of lib/before-the-first-phase-cases.ts staged on the middle of a bot world, from plain
// realms each holding only its seat with a living king there, and played through resolveTurn with the slot rows the
// case sends, the case's dice fixed for the whole turn; the world and the turn's context are read as the first phase
// begins. Level 2 (scenario): the stages are what the turn does between the merge and the first phase, around the
// bots' passes, and every phase reads what they set, so only a whole turn plays them as the game does.
// unit/before-the-first-phase-called-directly.test.ts calls the four stages directly.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Before the first phase (P1-08k8, four stages of `resolveTurn`'s own body between the merge and the first phase,
// around the bots' passes), played through a whole turn from slot rows each case writes (from plain realms each holding
// only its seat with a living king there, every realm a player's unless the case makes it a bot's, each case of
// `lib/before-the-first-phase-cases.ts`, in game terms, the dice fixed for the whole turn, its lines the GM's log in
// words: `theTurnsLinesInWords`, since P1-12d6); the world and the turn's context are read as the first phase begins.
// The relations: a save with none has them made, any kept. Last turn's research choices: the lead picked pursued (found
// as of last turn, the data file's, the other forgotten, the realm alone told), with none picked or a pick not among
// the leads the scholars' die (its highest the last lead, its lowest the first), a lead known passed over (told as no
// choice sent), both known the choice dropped, a lead the game no longer has never pursued but forgotten by its id, one
// lead with nothing to forget, nothing forgotten twice, after those forgotten before, a list of discoveries made, "a
// scholar" for a finder with no name, this turn's choice and one without leads left pending, each choice and every
// realm's in order; a bot realm's own pick. War without warning: an Evil or Undead realm's war on a realm it has met
// stands from the first phase (an ally's too), told to both by the system; not on a realm unmet, not again when at war,
// not for a Divine or Pagan realm, a Treat, a war on itself (even met), not under Safe Start; two wars and two realms'
// told in realm order; an Evil bot's. The titles held going into the turn: none before turn 5 whatever the save kept,
// from it the standings' (realm 0's Throne and Vaultkeeper) and the minor titles (its king's Colossus and Castellan),
// worked out afresh. The lines: each Safe Start refusal told privately, in the rows' order, none for no declaration;
// stale orders told to the GM, a concession to the world, in the merge's order after Safe Start's; the realms the GM
// removed told as withdrawn and the list gone, in its order, a realm the save lacks passed over, an empty list or one
// not a list (or text) kept. Messages: to the realm named with an unsigned dispatch and a copy to the sender (both of
// the end of the turn), to all (every other realm a player holds, in realm order whatever the rows' order; a list
// naming "all"), a seat nobody holds named, a realm named twice once, in the order named, realms as text, not to
// oneself (alone: nothing at all), not to realms the game lacks or a form it doesn't know, trimmed then cut to 1,000,
// nothing for empty or not text, every realm's in order. The move pools: a lone hero's flat 5 (and 5 at sea), a host's
// pace, March, every king's, none for a wanderer or the fallen, the turn's own. The trackers start empty, the seasons a
// copy; last turn's deaths, espionage (the ledger, the provinces spied becoming last turn's, Clairvoyance), watches,
// chases and attack routes cleared, what a realm learned of skills kept. The sweeps: a Dwarf of a Dwarven realm suited
// in mithril (no other), an old world's lairs renamed once and told (one, none), the guardians 5 HP frailer once, to no
// less than 5, their undamaged HP too, not a ritual site's, not twice; the retired Library struck; the Grand
// Cathedral's ward on its ground (or the home of an old one), none on ground lost, for a realm not Divine or without
// it. The default to Defend: a realm that sent nothing Defends, an empty phase Defend with no target, orders sent kept,
// a short list kept short, none for a wanderer or the fallen, five each; a bot's. The record of orders: each hero's
// five, declarations, a Reckoning call, a concession this turn (not one before), plans (twelve tactics), made once
// before the first phase (a hero released in Spring still in it), every realm's. The war fronts at the start: two hosts
// at war on one ground, a host on enemy land, none on ground still fought over, allies' or a lone hero's, two fronts
// each listed once. The order of it all. Level 2: the stages run between the merge and the first phase, around the
// bots, and every phase reads what they set
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { BEFORE_CASES, playCase, stageCase } from '../lib/before-the-first-phase-cases.ts';
import { board } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });

describe.each(BEFORE_CASES)('%s, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { got, want } = c.check(playCase(b, c, s), s);
    expect(got).toEqual(want);
  });
});
