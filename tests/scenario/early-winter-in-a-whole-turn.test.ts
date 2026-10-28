// Early Winter in a whole turn (plan P1-08k2, a stage of resolveTurn's phase loop lifted out): once the last season's
// orders are done, a hero an enemy Charm seized goes home to his own lord; each realm is told its treasury and collects
// its taxes (each province's marks, the discoveries, the heroes' tax gold, interest, trade, the Thief network, the
// minor titles); it owes and pays its wages after the discounts, or, short, loses its rawest companies first (the dead
// last, a ship carrying troops at sea kept), then heroes may desert; Raiders' Muster draws a Goblin Horde to an orcish
// province an orc realm won; and the unled garrison companies drill. Each case of lib/early-winter-cases.ts staged on
// the middle of a bot world, from plain realms (`stageCase`), and played through resolveTurn, every realm human-held,
// every hero Resting, with the case's dice fixed for the whole turn. Level 2 (scenario): Early Winter is what the turn
// does after its last season, so only a whole turn plays it as the game does.
// unit/early-winter-called-directly.test.ts calls the stage directly on the same cases.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Early Winter (P1-08k2, when it left `resolveTurn`'s phase loop), played through a whole turn (`playTurn`, from plain
// realms: `stageCase`; realm 0 holding only the provinces a case gives it, `holdsOnly`): each case of
// `lib/early-winter-cases.ts`, in game terms, with its dice fixed for the whole turn. A hero an enemy Charm seized goes
// home to his own lord before the taxes, told to his lord, the Charm's marks gone, and his own lord pays his wage (one
// already home, or fallen, or with no lord on record). The taxes: the treasury told (not to a realm with no land, no
// living hero and no gold), the header first; a province shaken or sabotaged this turn yields nothing (last turn's
// marks nothing); Bless Province (+60%, or the blessing's own measure), consecration (+50%, told), both; enslavement
// (−1 to its last turn, never below nothing); earthquake damage; a province-tax discovery and its 5% ceiling; the Free
// City Charter; the heroes' tax gold and the Merchant's Ledger under one ceiling; Merchant Guilds' interest (and no
// collection told without province income); Taxation Records under its ceiling; neutral trade; the Thief network; the
// Castellan, the Cutpurse and the Champion of the People. The wages: every company in the field and in garrison, every
// hero but the king; summoned companies and the Wild Hunt free, the dead 1, an unknown kind 2; Orcish war-spoils (the
// halves carried); Druid 6 and the Druidic Grand Design; an upkeep discovery and the Host-Leader; hero wage
// discoveries; the figures kept for the report, and "no wages to pay". A realm that can't pay: warned, emptied, its
// rawest companies first, garrison or field alike, the dead last, never a summoned company, the Wild Hunt or a
// Deathless Legion's dead; a ship carrying troops at sea passed over, then taken once they've gone, or kept and told;
// heroes deserting, the best paid first, until the debt is met (and one whose loyalty holds). Raiders' Muster (and not
// for a stale mark, folk or a realm not orcish, or nobody's province). The garrison drill at its chance (a Human
// company of a Human realm twice as readily, one line a province; never the dead, the Wild Hunt or no known grade, nor
// nobody's garrison), after the wages. Level 2: Early Winter is what the turn does after its last season
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { EARLY_WINTER_CASES, playCase, stageCase } from '../lib/early-winter-cases.ts';
import { board } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });

describe.each(EARLY_WINTER_CASES)('%s, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { got, want } = c.check(playCase(b, c, s), s);
    expect(got).toEqual(want);
  });
});
