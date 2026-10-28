// The espionage orders in a whole turn (plan P1-08j6, the sixth family of processOrder's orders taken out of it): Spy
// (on a province or on a hero), Steal, Sabotage, Grand Heist, Assassinate and Vanish. Each case of
// lib/espionage-order-cases.ts staged on the middle of a bot world, from plain realms (`stageCase`), and played through
// resolveTurn, every realm human-held, every other hero Resting, with the case's dice fixed for the whole turn. Level 2
// (scenario): the order is read and checked inside resolveTurn (a mastery order once a turn), a hero who vanished or a
// parcel sent earlier in the turn changes what a later order finds, and the turn's end tells the realms, so only a whole
// turn plays it as a realm gives it. It moved the Spy and Steal parts of xp-small-chances down (the small chance to
// learn after a miss): those fixed the rolls through a hook on a line of these orders.
// unit/espionage-orders-called-directly.test.ts calls each order's own function on the same cases, one phase at a time.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Spy (on a province or on a hero), Steal, Sabotage, Grand Heist, Assassinate and Vanish (P1-08j6), played through a
// whole turn as the Move's are (`playTurn`, from plain realms: `stageCase`): each case of
// `lib/espionage-order-cases.ts`, in game terms, with its dice fixed for the whole turn (`withRolls`: every percentile
// roll at one number; `withDice`: every other die at one value). Spy on a province: a Master Spy or a Crystal Orb needs
// no roll; the chance by Spy level, Forgery Arts and Cipher Scripts (only on their realm's ground); a miss learns
// nothing, raises no alarm and is a small chance at Spy (once `xp-small-chances`); the realm holding the ground warned
// unless it is his own or a disguise holds (Disguise Techniques; an old disguise put aside); a capital's secrets; he
// spies out where he stands, whatever the order names. Spy on a hero: not found elsewhere, his own realm's or fallen; a
// Cloak of Many Faces hides; a read keeps every skill, item and company; a miss is a small chance at Spy and sees only
// whether he was noticed; the catch by both Spy levels, whose land, Informer Rewards; caught, the hero's realm told and
// a duel unless the hero refuses; a wanderer read, no realm told; a vanished spy melts away. The Crystal Orb and the
// Cloak of Many Faces as a lair deals them today do nothing (Parked); older copies work. Steal: no Thief; the
// garrison's pay (no paymaster in ground nobody, he or no garrison holds; 1 gold a company, halved; an empty treasury;
// caught and beaten, or slipped away); a hero elsewhere, a comrade, one vanished, a wanderer with nothing; an item
// lifted, else gold (5%, at least 1, an empty purse), never Mithril, never a master thief's; halved against troops,
// capped at 95; a miss is a small chance at Thief (once `xp-small-chances`), driven off, a duel, or slipped away.
// Sabotage: Spy 7; no province, his own, an ally's refused; an enemy's coffers yield nothing, one company burns; once a
// turn. Grand Heist: Thief 7; ground nobody, he or an ally holds; neither capital nor rich; 70%, 75% and twice the take
// for a master thief, halved when guarded (a garrison, a hero leading troops); a quarter of the treasury; a parcel on
// the realm's roads cut (another realm's not); a miss slips away, is beaten off, or run down by a hero there (not the
// king if another stands by); once a turn. Assassinate: Spy 9; a mark elsewhere, a comrade, one vanished, an ally's
// refused; 79%, a king 54% and his guard told; slain, the field marked, Spymaster credit; a miss; a wanderer; one who
// can't be killed; once a turn. Vanish: Thief 9; the rest of the turn; once a turn. Level 2: the order is read and
// checked inside `resolveTurn` (a mastery order once a turn), a hero who vanished or a parcel sent earlier changes what
// a later order finds, and the turn's end delivers parcels
import { describe, expect, test } from 'vitest';
import { botWorld, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { ESPIONAGE_ORDER_CASES, recordExperienceRolls, stageCase, withCaseDice } from '../lib/espionage-order-cases.ts';
import { board, playTurn } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
const recording = recordExperienceRolls(engine);

describe.each(ESPIONAGE_ORDER_CASES)('the %s order, in a whole turn', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { result, xp } = recording(() =>
      withCaseDice(engine, c.dice, () => playTurn(b, Object.fromEntries(s.orders.map(([h, os]) => [h.id, os])))),
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
