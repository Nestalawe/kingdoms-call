// The war orders in a whole turn (plan P1-08j8, the eighth family of processOrder's orders taken out of it): Encounter
// Character (the quarry checked, the chase set, then carried on in every later phase until the catch), Defend (the
// watch set, kept phase after phase, ridden out, answered in battle), and the war masteries: Blockade, Challenge,
// Rampage, Rain of Arrows, Sniper's Mark, and the flags a later battle of the turn reads (Feigned Retreat, Grand
// Stratagem, Lightning Advance, Raid the Coast). Each case of lib/war-order-cases.ts staged on the middle of a bot
// world, from plain realms (`stageCase`), and played through resolveTurn, every realm human-held, every hero without
// orders Resting, with the case's dice fixed for the whole turn. Level 2 (scenario): the phase loop carries a chase on
// and sets a watch at the top of the phase, a mastery is checked (once a turn, never for a charmed hero) before its
// order is read, and a mastery's flag shows only in a battle later in the turn, so only a whole turn plays them as a
// realm gives them.
// unit/war-orders-called-directly.test.ts calls each order's own function on the same cases, one phase at a time.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The war orders (P1-08j8), played through a whole turn as the Move's are (`playTurn`, from plain realms: `stageCase`):
// each case of `lib/war-order-cases.ts`, in game terms, with its dice fixed for the whole turn (by default every roll
// lands and every other die is at its highest). Encounter Character: a quarry nobody can find or fallen, himself, a
// charmed hero's own lord's people (another realm's are fair game), a rival king (a king may hunt one; any hero may
// seek his own), a cloaked, veiled or vanished quarry (his own realm's are still found), refused with no chase; the
// chase set, the catch rolled and a duel, a missed catch carried on every phase with his other orders waiting, a quarry
// two provinces off found the next phase, a pair hunting each other meeting once, an ally passed without bloodshed, a
// wanderer hunted, two columns forcing battle, a chase ending a watch. Defend: the watch made, kept phase after phase
// (a lone hero lying in wait), held over a Rest, set where he stands after a march, riding out to an enemy column
// entering his realm's province next door, already answered in battle that phase (or by a battle resumed at the top of
// the next), and set again later. The masteries (Blockade, Challenge, Rampage, Rain of Arrows, Sniper's Mark, Feigned
// Retreat, Grand Stratagem, Lightning Advance, Raid the Coast): below the level, no mark beside him, his own realm's,
// an ally's (no war), no fleet, refused with nothing spent; a blockade that forms bars an enemy fleet and not an
// ally's, and one that doesn't form bars nobody; the duel's wounds, merits, deaths and the one who can't be killed; the
// companies a strike cuts down; the Sniper's Mark at its chance and one over, a king's, wounds enough to kill; each
// flag read by a battle later in the turn (and not without the order); a raid's plunder; a mastery twice a turn, one
// refused for want of the skill still spent, a charmed hero's refusal. Level 2: the phase loop carries a chase on and
// pre-sets a watch, `processOrder` checks a mastery before its order, and a flag shows only in a later battle
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { recordExperienceRolls, withCaseDice } from '../lib/espionage-order-cases.ts';
import { board, playTurn } from '../lib/middle-of-a-bot-world.ts';
import { LANDS, WAR_ORDER_CASES, stageCase } from '../lib/war-order-cases.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
const recording = recordExperienceRolls(engine);

describe.each(WAR_ORDER_CASES)('%s, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { result, xp } = recording(() =>
      withCaseDice(engine, c.dice ?? LANDS, () =>
        playTurn(b, Object.fromEntries(s.orders.map(([h, os]) => [h.id, os])), s.written ?? {}),
      ),
    );
    const { got, want } = c.check(
      {
        world: result.after,
        lines: result.lines.filter((l) => l.charId === s.hero.id),
        all: result.lines,
        turn: b.G.turn,
        xp,
      },
      s,
    );
    expect(got).toEqual(want);
  });
});
