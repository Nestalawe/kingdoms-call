// The bots' diplomacy in a whole turn (plan P1-08l1, lifted out of resolveTurn): each bot realm's Treat or war on each
// rival it had met when the turn began, by the grudge, Safe Start, the Aggressive setting, a claim to the throne, the
// grudge's truce, alignment and the war assessment, made before the first phase and again just before diplomacy is
// resolved. Each case of lib/bot-diplomacy-cases.ts staged on the middle of a bot world, from plain realms each holding
// only its seat with a living king there, and played through resolveTurn with the slot rows the case sends (the realms
// it makes bots' with no player), every die fixed for the whole turn; the realms' declarations are read once the bots
// have declared before the first phase and again just before diplomacy is resolved. Level 2 (scenario): the bots
// declare twice in a turn, around the phases, and only a whole turn plays both as the game does.
// unit/bot-diplomacy-called-directly.test.ts calls the function directly.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The bots' diplomacy (P1-08l1, `botDiplomacyTreatsAndWarsByAlignmentTheGrudgeAndAReckoningClaim`, lifted out of
// `resolveTurn`), played through a whole turn from slot rows each case writes (from plain realms of the Divine creed
// each holding only its seat with a living king there, every realm having met every other, the realms the case names
// bots', each case of `lib/bot-diplomacy-cases.ts`, in game terms, the dice fixed for the whole turn); the realms'
// declarations are read once the bots have declared before the first phase and again just before diplomacy is resolved.
// Where the bots' strength reckoning or war assessment (`bots/war.ts`) decides, the case stands it in for the turn by a
// fixed answer, recording what it is handed. The grudge: a human realm's war on a bot remembered on the bot's record
// before the first phase and kept; none for a Treat, a human's war on a human, a bot's war on a bot, a war on a bot the
// realm has not met, or under Safe Start; one on a bot the realm has met though the bot has not met it; not written
// twice, after those held, in realm order; a record not a list made one; a grudge stops a Treat from the turn war is
// declared. Alignment: a Treat to a rival of the bot's creed or one step from it, at peace or at war, never to an ally,
// nor at peace to a realm allied to one of its foes (at war still); never weighed for war; two bots each to the other
// (no alliance in a game of three). The war assessment for a rival two or more steps away: war if judged so and not at
// war already; peace (a Treat) only at war and without a grudge; told whether that rival offered peace this turn, a
// bot's Treat a peace for the bot weighed after it; an ally of any creed kept, not weighed; an Evil bot's war standing
// at once. The Aggressive setting: war on every human realm met (of the bot's creed, an ally: the alliance broken), not
// on one at war already, bots treated as ever, a claim and a grudge's truce not weighed. A claim to the throne: war on
// the claimant (ally or not, not when at war already), a Treat to everyone else of any creed but an ally or a human
// held in a grudge; a bot allied to the claimant and of his creed keeps faith; the claimant's own diplomacy ordinary;
// no claim when his king is not living; realm 0's claim; two bots against a human claimant. The truce: at five times
// the bot's strength a truce dated this turn and a Treat, a little under none; held above twice, kept while allied with
// nothing declared, ended at twice (an alliance broken, at peace no Treat); a grudge against another creed weighed; a
// strength of nothing read as one; only a rival held in a grudge weighed; weighed again after the phases. Who declares:
// nothing under Safe Start, from the turn it ends; a human realm's declarations never written; a conceded bot, one with
// neither king nor land, and a fallen king's realm with no land declare nothing and are not declared on; land or a king
// enough; only realms met when the turn began, in the order met, not itself or a realm the game lacks; every bot for
// itself; none without bots. The two declarations: alike, the second from the rivals met when the turn began, a war
// standing from the first phase weighed again. Level 2: the bots declare twice in a turn, around the phases, and only a
// whole turn plays both as the game does
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { BOT_DIPLOMACY_CASES, playCase, stageCase } from '../lib/bot-diplomacy-cases.ts';
import { board } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });

describe.each(BOT_DIPLOMACY_CASES)('%s, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { got, want } = c.check(playCase(b, c, s), s);
    expect(got).toEqual(want);
  });
});
