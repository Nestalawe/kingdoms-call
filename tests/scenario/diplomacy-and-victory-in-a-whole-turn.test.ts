// Diplomacy resolution and victory in a whole turn (plan P1-08k4, two stages of resolveTurn's own body lifted out):
// once the seasons are over, the declarations the realms sent with their orders take effect (overtures told, peace
// made, alliances forged or broken, war declared, with war-front warnings for the hosts on the foe's ground); then the
// Reckoning (a claim lodged, standing, collapsing or judged, the bar eroding while none stands), elimination and
// concession decide whether the game is over, and the result is announced once. Each case of
// lib/diplomacy-and-victory-cases.ts staged on the middle of a bot world of three realms (or four, where an alliance is
// needed), from plain realms (`stageCase`), and played through resolveTurn, every realm human-held, every hero Resting
// unless the case says otherwise, with the case's dice fixed for the whole turn. Level 2 (scenario): the stages are
// what the turn does once the bots have spoken, reading what the realms sent with their orders, so only a whole turn
// plays them as the game does. unit/diplomacy-and-victory-called-directly.test.ts calls the stages directly.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Diplomacy resolution and victory (P1-08k4, two stages taken out of `resolveTurn`'s own body), played through a whole
// turn (`playTurn`, from plain realms: `stageCase`; each realm holding only its seat, so its share of the world is the
// case's; what a realm sends beside its orders: `sends`), each case of `lib/diplomacy-and-victory-cases.ts`, in game
// terms, on a world of three realms or four. Peace and war: a mutual Treat makes peace between enemies (each told, no
// overture told); war declared by either realm or both, told once to each; nothing for war on an enemy, a realm never
// met, or a declaration that is neither; a Treat alone told to the realm offered (an overture of peace it may answer,
// and it has met the sender) and to the sender as unanswered, also when answered by war; in a game of three a Treat to
// a realm at peace is dropped; pairs settled in order; last turn's overtures forgotten. Alliances (in a game of four):
// a mutual Treat between realms at peace makes allies, each named first in its own line; an offer alone or answered by
// war; allies treating each other (in a game of three: no alliance among so few kings); an ally declaring war breaks
// the alliance to peace (either realm, both: "have"), told of an offer first; a realm breaking with an Evil ally leaves
// them at peace; an Evil breaker at war from the first season, nothing more said. War fronts: a new war warns both
// realms of each host on the foe's land or beside his host ("1 unit"), not one at home, not the foe of a host under
// Invisibility, and none for peace or a broken alliance. The Reckoning: too early (before turn 10), lodged from turn 10
// (told to all, judged two turns on), a bloc's raised bar (one ally, two), only a king (none, or fallen while his
// heroes and another realm's king live), the share shown rounded down, short of the bar (alone, as a bloc), a lesser
// ally who must hold half the bar, the first able caller takes it and a later one isn't answered, an earlier one short
// and a later one able, no call heard while a claim stands. A claim: standing (also exactly at its bar), judged (the
// highest Legacy crowned, though an ally lodged it), collapsing (the bloc short, the claimant short of half, no land or
// hero), held to the bar set when lodged, an old save's against today's. The bar: falls 5 points a turn from turn 15
// while no claim stands, from where it stands, to the floor (and says so), not at the floor, before 15, while a claim
// stands or one is called, the turn the world is judged; falls the turn a claim collapses; a game of four's.
// Elimination: the last realm with land or a living hero wins (the result and the standings told to all), even with no
// land; a realm with no land whose heroes have all fallen is out; not while a realm keeps land or a hero; nobody when
// none is left; elimination before concession; the bar still falls first. Concession: every other realm conceding (this
// turn or before), allies left (the highest Legacy wins), a claim overtaken, every realm conceding ("No-one"); not one
// concession among three, nor three left of which two are allied. The result announced once, an older save's now, the
// standings by Legacy with their titles and relics. The order: Mass Healing after the phases still mends an ally whose
// alliance breaks this turn; an alliance made this turn widens a claim's bloc, one broken shrinks it; peace made
// doesn't stop a concession. Level 2: the stages are what the turn does once the bots have spoken, with what the realms
// sent
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { DIPLOMACY_AND_VICTORY_CASES, playCase, stageCase } from '../lib/diplomacy-and-victory-cases.ts';
import { board } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const worlds = { 3: botWorld(engine, 3, { cols: 10, rows: 8 }), 4: botWorld(engine, 4, { cols: 10, rows: 8 }) };

describe.each(DIPLOMACY_AND_VICTORY_CASES)('%s, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, worlds[c.realms ?? 3], 0);
    const s = stageCase(b, c);
    const { got, want } = c.check(playCase(b, c, s), s);
    expect(got).toEqual(want);
  });
});
