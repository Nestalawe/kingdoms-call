// The new turn's first part in a whole turn (plan P1-08k5a, a stage of resolveTurn's own body lifted out): once
// diplomacy and victory are settled, the turn counter moves on; a Divine king awaiting his return loses it if his realm
// holds no consecrated ground; a realm whose king has fallen crowns an heir in its wealthiest province, or, with no land
// left, its dynasty ends; what was summoned for the turn leaves, a hero hired this turn acts from every phase, and the
// one-turn spell marks end (Illusory Terrain and hidden lairs may fade, Part Sea and Flood give the land back); then the
// Iron Throne's risen skeletons join their winners and the Grand Library gives a Neutral realm one Sage discovery. Each
// case of lib/new-turn-succession-and-summons-cases.ts staged on the middle of a bot world, from plain realms each
// holding only its seat with a living king there (`stageCase`), and played through resolveTurn, every realm
// human-held, every hero Resting unless the case says otherwise, with the case's dice fixed for the whole turn. Level 2
// (scenario): the stage is what the turn does once diplomacy and victory are settled, before the rest of the turn's
// end, so only a whole turn plays it as the game does. unit/new-turn-succession-and-summons-called-directly.test.ts
// calls the stage directly.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The new turn's first part (P1-08k5a, a stage taken out of `resolveTurn`'s own body), played through a whole turn
// (`playTurn`, from plain realms each holding only its seat with a living king there: `stageCase`), each case of
// `lib/new-turn-succession-and-summons-cases.ts`, in game terms, with the dice fixed for the whole turn. The turn
// counter moves on by one. A Divine king awaiting his return: his way back is lost when his realm holds no consecrated
// ground (or only ground another realm has taken), told to his realm alone, and an heir is crowned the same turn; kept
// while it holds some (an old save's single consecrated province too), with no heir and nobody waiting for one; not for
// another creed's king or a fallen hero who isn't king; each realm told only of its own; a king whose grave is gone is
// succeeded; a realm with no land loses the way back and its dynasty. Succession: an heir crowned in the realm's
// richest province (the first of equals), told to the realm alone, with 15 HP, the creed's skills (each creed, an Elf
// realm's folk), an aptitude of 4 in every skill and the last Temper at the highest die, 4 points to allocate, no
// companies or items, his id his place in the list; the fallen king no longer king; also while the realm's heroes live
// on, or while a fallen hero (not the king) is promised his return; none while a king lives; no land: the dynasty
// extinguished, told once, on the new turn; two realms each crown their own. What was summoned for the turn: an
// elemental leaves its summoner's host (one line, two together, one with no name, a wanderer's told to nobody);
// summoned companies in a garrison or among the mercenaries vanish silently; Wild Hunt beasts slip the binding after
// their last turn and not before (two packs in one line), after the elemental's line; a hero hired partway through the
// turn acts from every phase next turn. One-turn spells end: a hero's marks (the Charm's immunity stays), phantom
// companies, companies' and neutral defenders' battle marks, a garrison's Terror only, a province's marks; a parted sea
// is sea again, a flooded province land again, both: the Flood's land; Illusory Terrain an enemy walked into is
// dispelled, otherwise it fades and a hidden lair is seen again only on a die under 20%. The Grand Designs: the Iron
// Throne's risen skeletons join their living winner, none for the fallen or the gone, none left waiting; the Grand
// Library gives a Neutral realm one discovery (the last it may learn at the highest die, the first at the lowest, the
// one left whatever the die), an old save's Wonder too, nothing for a Wonder lost or another creed, never one known,
// forgotten, awaiting a choice or of another folk or creed (then: told it knows all), each realm its own. The order:
// every part in one turn in its order; the turn moves on before an heir is crowned, a dynasty ends or a discovery is
// made; the Reckoning judged on the turn played (a call on turn 9 too early); a lost way back not tried again by the
// Divine resurrection; a summoned elemental gone before the War Academy drills. Level 2: the stage is what the turn
// does once diplomacy and victory are settled, before the rest of the turn's end
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { NEW_TURN_CASES, playCase, stageCase } from '../lib/new-turn-succession-and-summons-cases.ts';
import { board } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });

describe.each(NEW_TURN_CASES)('%s, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { got, want } = c.check(playCase(b, c, s), s);
    expect(got).toEqual(want);
  });
});
