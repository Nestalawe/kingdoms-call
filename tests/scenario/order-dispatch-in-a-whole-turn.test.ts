// The checks processOrder makes before any hero's order, in a whole turn (plan P1-08j9, processOrder lifted out of
// resolveTurn): a hero who joined another's assault superseded; the order's name as the order form or an old save
// writes it; a bot's Practice on a skill at 5 and a bot's Search (too hurt, talk not heard, written for another
// province); the battle lock on a Move or an Encounter; a charmed enemy hero's refusals; a mastery once a turn; the
// Forced March; a spell item's Use Item. Each case of lib/order-dispatch-cases.ts staged on the middle of a bot world,
// from plain realms (`stageCase`), and played through resolveTurn, every realm human-held but the bots a case names
// (their heroes' orders written in as the bots' own), every hero without orders Resting, with the case's dice fixed for
// the whole turn. Level 2 (scenario): the phase loop makes what most checks read (an assault a friend joins, a battle
// joined earlier in the season, a skill risen in an earlier one, a mastery already spent), and the bots plan inside the
// turn, so only a whole turn plays them as the game does.
// unit/order-dispatch-called-directly.test.ts calls processOrder itself on the same cases, one phase at a time.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The checks `processOrder` makes before any hero's order (P1-08j9, when it left `resolveTurn`), played through a whole
// turn (`playTurn`, from plain realms: `stageCase`): each case of `lib/order-dispatch-cases.ts`, in game terms, with
// its dice fixed for the whole turn. A friend carried into another's assault has his own order superseded, told under
// his name (and not when he misses the timing); an order the game doesn't know, or with no name, is a Defend; the order
// form's names in any case are read the same; an old save's Pursue is an Encounter; every line of an order is filed
// under the hero and the season. A bot's Practice on a skill at 5 (the realm a bot, its hero's orders written in after
// the bots plan: `asTheBotsPlan`) switches to his best skill below 5, or the first of Melee, Tactical and March he
// lacks, or a Defend when he has none; not for a player's realm or a skill below 5; it switches in a later season once
// the skill rises to 5; it stays to teach a comrade practising it beside him at a lower level, and not for one at his
// level, elsewhere, practising another skill, in another season or of another realm; Tactical stays to drill companies
// that can still improve, not Elite ones, and Melee or Naval with only land companies switch. A bot's Search: too hurt
// (below the share his orders name, and not at it), talk heard by him this turn at the band named or better (and not
// worse, another's, an earlier turn's, another realm's or none), the lower band at full health or the health named, no
// lair at the place named; a search written for another province, or one the map doesn't have, is abandoned (and not
// one written for where he stands, or for none); only the first reason is told. The battle lock: an Encounter, an old
// Pursue and a Move (by a hero handed his companies earlier in the season) out of a province whose battle was left
// unresolved this season are refused; a hero of the realm with no companies, and a Defend, are not. A charmed enemy
// hero won't disband, perform any of the five rites or spend any of the twenty masteries (and the refused mastery isn't
// spent), but obeys any other order; a hero won over for good spends his. A mastery twice a turn (the second refused),
// two masteries, last turn's charge, one already spent, two heroes, one refused for want of the skill (still spent),
// and the order form's name. Forced March slips past a battle on a low die, a Move doesn't; one refused below March 7
// is still spent. A spell item's Use Item is a cast, by id or by name; an item whose spell the game doesn't know, or
// one he doesn't carry, isn't. Level 2: the phase loop makes what most checks read (an assault a friend joins, a battle
// joined earlier in the season, a skill risen in an earlier one, a mastery already spent) and the bots plan inside the
// turn
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { recordExperienceRolls } from '../lib/espionage-order-cases.ts';
import { board } from '../lib/middle-of-a-bot-world.ts';
import { ORDER_DISPATCH_CASES, asTheBotsPlan, playCase, stageCase } from '../lib/order-dispatch-cases.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
const recording = recordExperienceRolls(engine);
const bots = asTheBotsPlan(engine);

describe.each(ORDER_DISPATCH_CASES)('%s, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { got, want } = c.check(playCase(b, c, s, bots, recording), s);
    expect(got).toEqual(want);
  });
});
