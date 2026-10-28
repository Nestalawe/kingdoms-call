// The new turn's second part in a whole turn (plan P1-08k5b, a stage of resolveTurn's own body lifted out): once the
// turn counter has moved on and the new turn's first part is done (P1-08k5a's stage), the War Academy may drill each
// company a realm's heroes keep at home up a grade; Physick Gardens and Royal Physicians mend the wounded; the
// Informant Network names an enemy captain the realm can't see and the Arcane Observatory charts a province it hasn't
// mapped; a Divine realm's hero fallen a full turn ago rises on the nearest consecrated ground it holds, or never
// returns; graves rot; the mercenary bands retire or move on; the turn's flags are cleared, the save's repairs told,
// stale graves of the living purged, each realm remembers the graves it can see; wandering heroes recover and may
// drift; the turn's orders are cleared; every province's list of heroes is rebuilt, and a neutral guard left with no
// companies becomes a wanderer. Each case of lib/new-turn-war-academy-to-the-final-reconcile-cases.ts staged on the
// middle of a bot world, from plain realms each holding only its seat with a living king there (`stageCase`), and
// played through resolveTurn, every realm human-held, every hero Resting unless the case says otherwise, with the
// case's dice fixed for the whole turn. Level 2 (scenario): the stage is what the turn does after its first part,
// before the titles, so only a whole turn plays it as the game does.
// unit/new-turn-war-academy-to-the-final-reconcile-called-directly.test.ts calls the stage directly.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The new turn's second part (P1-08k5b, a stage taken out of `resolveTurn`'s own body), played through a whole turn
// (`playTurn`, from plain realms each holding only its seat with a living king there: k5a's `stageCase`), each case of
// `lib/new-turn-war-academy-to-the-final-reconcile-cases.ts`, in game terms, with the dice fixed for the whole turn.
// The War Academy: at a die under 7% each company the realm's heroes keep at home trains a grade (each told to the
// realm alone, hero by hero), at 7% none (told so); not an Elite company or the risen dead (then nothing said), not
// companies away or an ally's at the home; the home is the first province the realm holds with a tax of 10 or more, in
// the map's order; none without one, nor without the Academy; two realms each their own. The wounded mend: Physick
// Gardens 3 HP (told, the hero named), never past the maximum; Royal Physicians 4 for the king only; nobody for another
// realm's gardens. The Informant Network names one captain of another realm the realm can't see (an ally's too), the
// highest die the last of the roll, the lowest the first; nothing new for a captain on the realm's land or beside its
// hero, a king, a wanderer, the fallen; another realm's land and the realm's own fallen give it no eyes; two realms
// each their own. The Arcane Observatory charts one unmapped province in full (99% is unmapped), the last or the first
// by the die, says when all is mapped, after the informants and without them, each realm its own. The Divine return: a
// hero fallen the turn before rises on his realm's consecrated ground with half his HP, no companies or items, listed
// there, his grave gone, the ground spent; not yet when fallen this turn; with no ground (or ground taken) the grace is
// lost (told, the grave marked, never tried again); the nearer of two grounds, the richer of equals; not another creed
// or a wanderer; a king promised his return rises crowned (no heir), another fallen king doesn't; two heroes, one
// ground; each realm its own. Graves rot at a die of 10% or less, 5% on an Undead realm's ground, never under the
// Embalmers on its own. Mercenary bands retire under 25% (told to nobody, by kind when nameless) or move on to the
// province around them the die picks (even and odd rows, the map's edge and its wrap, land or sea, none with only sea
// around). The clean-up: the driven-from-home mark cleared; wanderers made whole (not guards, realms' heroes or the
// fallen); the save's repairs told (names, retired discoveries, singular and plural); stale graves of the living purged
// (a hold on the body released, another kept); each realm notes the graves it sees (in its land or beside its living
// heroes; not a king's; once); the dead seen this turn forgotten; the turn's orders and scratch lists cleared.
// Wanderers drift at 35% or less to land around them (the third, the first), never to sea; guards, realms' heroes and
// the fallen never; hale where they arrive. A guard whose last company was summoned for the turn is a wanderer at the
// end, too late to mend or drift. The order: every line in its order; the informants before the dead rise; the gardens
// before them; stale graves before the realms take note; the titles after the drills (the Grand Marshal's strength).
// Level 2: the stage is what the turn does after its first part, before the titles
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import {
  NEW_TURN_SECOND_PART_CASES,
  playCase,
  stageCase,
} from '../lib/new-turn-war-academy-to-the-final-reconcile-cases.ts';
import { board } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });

describe.each(NEW_TURN_SECOND_PART_CASES)('%s, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { got, want } = c.check(playCase(b, c, s), s);
    expect(got).toEqual(want);
  });
});
