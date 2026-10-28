// The recruit, hire and realm's works orders in a whole turn (plan P1-08j3, the third family of processOrder's orders
// taken out of it): Recruit Armies, Hire Hero, Consecrate, Call to Arms, Broker, Harvest the Field, Awaken Grove, Wild
// Calling, Grand Design, and the refusal of the removed Awaken the Wild and Call from the Pit. Each case of
// lib/recruit-hire-and-realm-works-order-cases.ts staged on the middle of a bot world, from plain realms (`stageCase`),
// and played through resolveTurn, every realm human-held, every other hero Resting; the orders a realm writes for a
// hero it means to hire go in as it sends them (`hired_<hero>_via_<hirer>_ph<phase>`). Level 2 (scenario): the order is
// read, checked (a mastery once a turn) and carried out inside resolveTurn, and some of what it does reaches the turn's
// end (the grove's Ents go home), so only a whole turn plays it as a realm gives it.
// unit/recruit-hire-and-realm-works-orders-called-directly.test.ts calls each order's own function on the same cases,
// and on the ones the dice decide.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Recruiting, hiring and the realm's works (P1-08j3), played through a whole turn as the Move's are (`playTurn`, from
// plain realms: `stageCase`): each case of `lib/recruit-hire-and-realm-works-order-cases.ts`, in game terms. Recruit
// Armies raises the companies a held province offers, Average and paid for (one of a kind a season, two in the
// founder's home and for garrison companies), to the recruiter, a comrade here (who is told) or the garrison (named in
// either list); it refuses ground not held, a company the province doesn't raise, a beast of the deep on land and a
// treasury too poor; a beast for a column already leading all its Druid allows musters into the garrison; a Druid of 6
// pays half for beasts; a band roaming here is hired (2g off for a Neutral crown), takes empty ground, and isn't hired
// unpaid or into a full column. Hire Hero swears a wanderer for 2g, 1g per two steps between the creeds and his skills'
// worth, refused across the Divine–Undead gulf (unless Diplomatic Protocols), to a guard, a hero just driven home or
// just released, or an empty treasury; a dwarf gets mithril; the orders written for him land after the hire.
// Consecrate, Call to Arms and Broker with every refusal (crown, creed, ground, home march, side by side, White skill,
// once a turn, seen provinces, gold); Harvest the Field raises the best grave, Skeletal, warns a raiser without
// Necromancy; Awaken Grove (its Ents gone at the turn's end), Wild Calling and Grand Design with their masteries;
// Awaken the Wild and Call from the Pit refused in plain words. Garrison grades and a band left unhired are checked in
// the direct test: the turn's end may drill a garrison or move a band (a die). Level 2: the order is read, checked (a
// mastery once a turn) and carried out inside `resolveTurn`
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { board, playTurn, type Order } from '../lib/middle-of-a-bot-world.ts';
import { RECRUIT_HIRE_AND_WORKS_ORDER_CASES, stageCase } from '../lib/recruit-hire-and-realm-works-order-cases.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });

describe.each(RECRUIT_HIRE_AND_WORKS_ORDER_CASES)('the %s order, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const written: Record<number, Record<string, Order[]>> = {};
    if (s.written && s.other && s.hero.player != null) {
      const ph = s.orders.findIndex((x) => x.action === 'hire');
      written[s.hero.player] = { [`hired_${String(s.other.id)}_via_${String(s.hero.id)}_ph${String(ph)}`]: s.written };
    }
    const { after, lines } = playTurn(b, { [s.hero.id]: s.orders }, written);
    const { got, want } = c.check(
      { world: after, lines: lines.filter((l) => l.charId === s.hero.id), all: lines, turn: b.G.turn },
      s,
    );
    expect(got).toEqual(want);
  });
});
