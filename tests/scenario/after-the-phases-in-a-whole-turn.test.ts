// After the phases in a whole turn (plan P1-08k3, the first stage of resolveTurn's own body lifted out): once the five
// seasons are played, a stand-off struck in the last one is flagged; skeletal companies with no necromancer to lead
// them crumble, their realm told; a necromancer who never moved senses the graves where he stands; a wandering hero may
// learn a skill; a consecrated province that changed hands loses its blessing; couriers deliver their parcels; Elven
// companies that slipped a lost battle reach home; a fallen commander's host is settled; intrusions are told once;
// lair guardians recover; Mass Healing mends a White master's friends; maximum HP is resynced, with an old save's note;
// a coward spared on the field goes home, his host left behind; and every location name is brought up to date. Each
// case of lib/after-the-phases-cases.ts staged on the middle of a bot world, from plain realms (`stageCase`), and
// played through resolveTurn, every realm human-held, every hero Resting unless the case says otherwise, with the
// case's dice fixed for the whole turn. Level 2 (scenario): the stage is what the turn does after its phases, so only
// a whole turn plays it as the game does. unit/after-the-phases-called-directly.test.ts calls the stage directly.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// What the turn settles once its five seasons are played (P1-08k3, the first stage taken out of `resolveTurn`'s own
// body), played through a whole turn (`playTurn`, from plain realms: `stageCase`): each case of
// `lib/after-the-phases-cases.ts`, in game terms, with its dice fixed for the whole turn. The dead need a master:
// skeletal companies under a hero with no Necromancy (an item's Necromancy is enough), or set down in a garrison,
// crumble while the living stay, one line a realm, its parts joined ("It crumbles" for one part, "They crumble" for
// more), each realm told of its own; a wanderer's dead stand; a garrison nobody holds loses its dead untold. Graves
// underfoot: a necromancer who never moved senses the graves where he stands (his realm learns only that they are
// there), bare ground forgets an old record, one who marched in is not told again. A wandering hero hones his best
// skill from turn 5. A consecrated province an enemy holds, or nobody, loses its blessing (told publicly, as a province
// event; an old save's single province read as the list; two lost told in order; each realm in its own name). Couriers:
// a parcel in a living hero's pack, told, then how he wears it, his maximum HP at once; to a fallen hero's own king,
// not another hero or realm; lost when no king lives, for an unknown or a wandering hero; an emptied parcel nothing;
// two in the order sent; none left waiting. Elven companies that slipped a lost battle reach the seat, or the richest
// province, or scatter when no land is left. A living hero carries no leaderless-host mark; a fallen one no note of his
// killer. An intrusion told once, after the phases. A lair guardian recovers. Mass Healing: a White master mends
// himself and every wounded friend beside him by half their maximum (rounded up), to the maximum, once; not an enemy, a
// wanderer, a realm at peace, a friend elsewhere, the fallen, nor from White 5, a wandering or a fallen master. An old
// save's earned-HP note, once, publicly. A coward spared this turn goes home (his realm's seat, or its richest
// province; an ally's to his own), his host left to a comrade, the garrison, or leaderless; not one already home,
// spared earlier, fallen, or of a landless realm. Every location name brought up to date. The order of the parts. Level
// 2: the stage is what the turn does after its phases
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { AFTER_THE_PHASES_CASES, playCase, stageCase } from '../lib/after-the-phases-cases.ts';
import { board } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });

describe.each(AFTER_THE_PHASES_CASES)('%s, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { got, want } = c.check(playCase(b, c, s), s);
    expect(got).toEqual(want);
  });
});
