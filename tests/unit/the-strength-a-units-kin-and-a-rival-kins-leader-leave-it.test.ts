// The strength a unit's kin and a rival kin's leader leave it (plan P1-11c5: src/engine/rules-on-plain-values/the-
// strength-a-units-kin-and-a-rival-kins-leader-leave-it.ts), called directly: ×1.2 for a unit of its king's race, ×1.2
// for one of its leader's, then ×0.8 under a leader of its rival kin, each rounded as it is taken, and which of them
// counted. The battle's armStr and the army card on the player's report both ask it; the parity test
// (the-player-portals-copies-agree-with-the-engine, "the army card's strength of a unit is the battle's …") shows the
// card's line and the battle agree on it. The file imports only the content, so the test imports it as it is, with no
// engine loaded.
// Level 1 (unit): a function of a number and three races.
import { expect, test } from 'vitest';
import { theStrengthAUnitsKinAndARivalKinsLeaderLeaveIt as kin } from '../../src/engine/rules-on-plain-values/the-strength-a-units-kin-and-a-rival-kins-leader-leave-it.ts';

const none = { itsKingIsOfItsKin: false, itsLeaderIsOfItsKin: false, aLeaderOfItsRivalKinLeadsIt: false };

test("its king's kin and its leader's are ×1.2 each, rounded as each is taken", () => {
  expect(kin(12, 'Elven', 'Human', null)).toEqual({ strength: 12, ...none });
  expect(kin(12, 'Elven', 'Elven', null)).toEqual({ strength: 14, ...none, itsKingIsOfItsKin: true });
  expect(kin(12, 'Elven', 'Human', 'Elven')).toEqual({ strength: 14, ...none, itsLeaderIsOfItsKin: true });
  expect(kin(12, 'Elven', 'Elven', 'Elven')).toEqual({
    strength: 17,
    ...none,
    itsKingIsOfItsKin: true,
    itsLeaderIsOfItsKin: true,
  });
  // rounded at each step: 3 → 3.6, 4 → 4.8, 5 (not 3 × 1.44 = 4.32, 4)
  expect(kin(3, 'Human', 'Human', 'Human').strength).toBe(5);
});

test('a leader of its rival kin is ×0.8, rounded, after its kin: Elves and Dwarves, Humans and Orcs', () => {
  for (const [unit, leader] of [
    ['Elven', 'Dwarven'],
    ['Dwarven', 'Elven'],
    ['Human', 'Orcish'],
    ['Orcish', 'Human'],
  ] as const)
    expect(kin(12, unit, null, leader)).toEqual({ strength: 10, ...none, aLeaderOfItsRivalKinLeadsIt: true });
  // with its king's kin: 12 → 14.4, 14 → 11.2, 11
  expect(kin(12, 'Human', 'Human', 'Orcish')).toEqual({
    strength: 11,
    ...none,
    itsKingIsOfItsKin: true,
    aLeaderOfItsRivalKinLeadsIt: true,
  });
  // the rival kin after the kin: 3 → 3.6, 4 → 3.2, 3 (the other way round, 3 → 2.4, 2 → 2.4, 2)
  expect(kin(3, 'Human', 'Human', 'Orcish').strength).toBe(3);
  // no rival: Elves and Humans, Dwarves and Orcs
  expect(kin(12, 'Elven', null, 'Human')).toEqual({ strength: 12, ...none });
  expect(kin(12, 'Dwarven', null, 'Orcish')).toEqual({ strength: 12, ...none });
});

test('a unit, king or leader with no race is no one’s kin and no one’s rival', () => {
  for (const noRace of [null, undefined, ''])
    expect(kin(12, noRace, noRace, noRace)).toEqual({ strength: 12, ...none });
  for (const noRace of [null, undefined, '']) {
    expect(kin(12, noRace, 'Human', 'Orcish')).toEqual({ strength: 12, ...none });
    expect(kin(12, 'Human', noRace, noRace)).toEqual({ strength: 12, ...none });
  }
});
