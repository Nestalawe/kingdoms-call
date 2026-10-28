// The titles at the turn's end in a whole turn (plan P1-08k6, the last two stages of resolveTurn's own body lifted
// out): once the new turn is done, from turn 5 (or once the game is over) the realm holding each Imperial Title is told
// what it shows of the realms it has met — the Throne, the Vaultkeeper, the Grand Marshal, the Sea Lord, the
// Monster-Bane, the Loremaster (who copies one rival's fresh discovery), the Archmage, the Hierophant, the Deathpriest
// (who files what Grave-sight finds), the Spymaster, the Cartographer, the Beastlord and the Wildwarden — with one line
// for the realms it hasn't met; then each realm's titles won and lost since last turn are worked out for its report,
// and this turn's holders kept for the next. Each case of lib/titles-at-the-turns-end-cases.ts staged on the middle of
// a bot world, from plain realms each holding only its seat with a living king there (`stageCase`), and played through
// resolveTurn, every realm human-held, every hero Resting unless the case says otherwise, with the case's dice fixed
// for the whole turn. Level 2 (scenario): the stages are what the turn does last, once the new turn is done, so only a
// whole turn plays them as the game does.
// unit/titles-at-the-turns-end-called-directly.test.ts calls the two stages directly.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The titles at the turn's end (P1-08k6, the last two stages of `resolveTurn`'s own body: once immediately-invoked
// functions, named functions now), played through a whole turn (`playTurn`, from plain realms each holding only its
// seat with a living king there: k5a's `stageCase`), each case of `lib/titles-at-the-turns-end-cases.ts`, in game
// terms, with the dice fixed for the whole turn. The intel: nothing before turn 5, from it each title held tells its
// holder alone, in the titles' order, after the phases; once the game is over, before turn 5 too. The Throne: the
// holder's own share of the world tax base rounded down, each realm it has met rounded, in realm order; one line for
// the realms it hasn't met ("One realm … it", "2 realms … them"), not counting a realm conceded or eliminated; the
// largest tax base holds it, none in a world with no tax. The Vaultkeeper: each treasury after the turn's taxes and
// wages; the richest holds it. The Grand Marshal and the Sea Lord: each realm's strongest land army or fleet (land
// companies and fleets kept apart), its commander and where he stands, the first of equals, or none; a fallen
// commander's and an unmet realm's not named. The Monster-Bane: each realm's foremost living slayer and his tally, the
// first of equals, or none. The Loremaster: every discovery each met realm holds ("1 discovery"), or none; one made on
// the turn just played that the holder lacks copied (the die picks among them, across the realms in order), never one
// known, older or an unmet realm's. The Archmage: the foremost living mage of each school outside the holder's realm,
// of a met realm or none, by level then total skills, the first of equals. The Hierophant: every fallen hero the realm
// can see (its own anywhere, the dead in its land or where its heroes stand, a king as a king) with his skills highest
// first, or none; no line of the unmet. The Deathpriest: each province holding crack or elite dead, in the map's order,
// filed under Graveyards Known as a partial reading by the realm holding it alone, or none. The Spymaster: each act of
// espionage against the realm's land by its agent, then the roll with a count; espionage elsewhere is a quiet turn. The
// Cartographer: each atlas (fully charted, the share mapped, rounded), or no rival to survey. The Beastlord and the
// Wildwarden: monsters and creatures led and garrisoned (no other company), the largest host led (the first of equals),
// or all garrisoned, or none. The title changes: before turn 5 none, this turn's holders kept as not public; the first
// public turn every title held announced to its realm as its first standing, Imperial then minor, none lost (with or
// without a snapshot); after it, a title taken by another realm (a realm's, a hero's, a minor one) won by the new
// holder and lost by the old with who took it; one fallen vacant lost to nobody; a hero's title passing within the
// realm won again, lost by nobody; a realm's title kept under another king neither; an old snapshot with no holders:
// every title won. The order: the treasuries read after the taxes and wages; a discovery copied before the changes are
// worked out. Level 2: the stages are what the turn does last, once the new turn is done
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { TITLE_CASES, playCase, stageCase } from '../lib/titles-at-the-turns-end-cases.ts';
import { board } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });

describe.each(TITLE_CASES)('%s, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { got, want } = c.check(playCase(b, c, s), s);
    expect(got).toEqual(want);
  });
});
