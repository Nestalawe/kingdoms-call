// The Cast Spell order in a whole turn (plan P1-08j7, the seventh family of processOrder's orders taken out of it): the
// casting itself (the spell named, the casting limits, a mastery spell once a turn, the cast chance and its roll, a
// spell item's cast, the Wailing Phylactery, a mark gone, vanished, veiled or cloaked) and every spell a hero can work
// as a phase order, school by school. Each case of lib/cast-spell-order-cases.ts staged on the middle of a bot world,
// from plain realms (`stageCase`), and played through resolveTurn, every realm human-held, every other hero Resting,
// with the case's dice fixed for the whole turn. Level 2 (scenario): the order is read inside resolveTurn (a spell
// item's Use Item becomes a cast there), the casting limit counts the hero's earlier orders of the turn, a hero raised
// or charmed takes up the orders his realm wrote for him, and the turn's end takes back what lasts only a turn (a
// charmed hero goes home, a summoned elemental dissolves, a flood recedes), so only a whole turn plays it as a realm
// gives it. It moved the Cast Spell part of xp-small-chances down (a fizzle's small chance to learn): that fixed the
// roll through a hook on a line of this order.
// unit/cast-spell-order-called-directly.test.ts calls the order's own function on the same cases, one phase at a time.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Cast Spell (P1-08j7), played through a whole turn as the Move's are (`playTurn`, from plain realms: `stageCase`):
// each case of `lib/cast-spell-order-cases.ts`, in game terms, with its dice fixed for the whole turn (every percentile
// roll at one number, every other die at one value: by default every roll lands and every other die is at its highest).
// The casting: a spell the game doesn't know, a battle-only spell; the roll told in full (30% and 10% a level, the
// discoveries, 95% at most), at the chance and one over; a fizzle does nothing and is a small chance at the school
// (once `xp-small-chances`), a spell that lands a lesson; the casting limit (1, 2, 3 a turn by level, each school
// apart, the order as the order form writes it, a blocked or refused cast spends no slot, a Grand Cathedral's Bless
// spends none and a Neutral realm's Wonder is no Cathedral, a spell item's cast is outside it); the casting limits at
// each level (P1-11a1: at White 1 to 5, one more action spell than the turn allows is blocked; at Necromancy 1 to 5,
// one more combat spell than a fight allows is refused, in the fight a failed Charm brings on); no skill, a mastery
// spell below its level or twice a turn, refused unrolled; a spell item's Use Item (95%, at least level 3, a small
// chance at Sage, never a mastery spell); the Wailing Phylactery (Necromancy only); a mark gone, fallen elsewhere,
// vanished (a friend still reached), veiled or cloaked (the Cloak of Many Faces as a lair deals it today hides nobody:
// Parked); a charmed hero won't turn on his own lord's people. Every spell, school by school: White (Resurrect: his
// realm's fallen here, the body named or the freshest, the orders written for the raised hero, a monarch borne home and
// his heir, every refusal; Part Sea, also after a Flood; Holy Symbol; Bless Province: +60%, +80% Divine, +100% a Divine
// king, Rites of Plenty, the ward, no stacking; Sanctuary; Divine Judgment), Psychic (Charm: a wanderer for good, an
// enemy until the season turns, the resistance, the immunity, the gulf, a dismissed hero, the backlash; Oratory;
// Clairvoyance; Psychic Blast and the wage; Telekinetic Storm; Mass Confusion; Dominate), Illusory (Illusory Terrain,
// Phantasmal Armies, Hide Lairs, Invisibility, Phantom Host, Veil), Elemental (Earthquake, Flood, Elemental Summon,
// Chain Lightning, Cataclysm; Flood after Part Sea leaves a sea "plains" for good: Parked) and Necromancy (Control
// Undead's scan and seizure, Skeletal Armies, Curse, Plague, Raise Wraiths, Death's Dominion), each with its reach, its
// refusals, a Bless ward where one applies, and who is told. Level 2: the order is read inside `resolveTurn` (a spell
// item's Use Item becomes a cast there), the casting limit counts the hero's earlier orders, a hero raised or charmed
// takes up the orders his realm wrote for him, and the turn's end takes back what lasts a turn
import { describe, expect, test } from 'vitest';
import { CAST_SPELL_ORDER_CASES, LANDS, stageCase } from '../lib/cast-spell-order-cases.ts';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { recordExperienceRolls, withCaseDice } from '../lib/espionage-order-cases.ts';
import { board, playTurn } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
const recording = recordExperienceRolls(engine);

describe.each(CAST_SPELL_ORDER_CASES)('Cast Spell (%s), in a whole turn', (_, cases) => {
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
