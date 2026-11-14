// An Undead host's skeletal fervour against a province's defenders is its king's or its hero's (plan P1-19's alignment
// abilities family, row P1-19au1: skeletal fervour moved into the family's registry, whose runner combatVsNPC asks with
// the attacker's own king or hero). An Undead realm's host with a skeletal company in it fights at ×1.5 under the king
// in person ("…under their Undead king! (+50% strength)") and at ×1.3 under any other commander ("…know no fear (+30%
// strength…"), and its whole force's line multiplies by that fanaticism; a host with no skeletal company, neither. The matrix plays both, but no test read which line a battle
// against a province writes for whom: handing the runner the wrong commander (the king for a hero, or none) turns it.
// Undead's zeal is 0%, so no die can seize the host and take a line's place.
//
// Level 1 (unit): combatVsNPC called directly (tests/lib/a-battle-called-directly.ts) on a world the engine makes from
// KC_SEED; no turn is played. Not lower: the line is written inside the battle, from the host on the field. Passes on
// the row's base (P1-19at2) as on the row.
import '../lib/the-whole-engine.ts';
import { expect, test } from 'vitest';
import {
  aBattleAgainstTheProvince,
  aFieldAndTheGroundBesideIt,
  aGuardMadeByTheTest,
  attackFrom,
  aWorld,
  type Company,
  companies,
  MELEE_AND_NO_DUEL,
  own,
  theTurnsContext,
} from '../lib/a-battle-called-directly.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

/** Realm 0, Undead, attacks a guard on a plain: its king or its first other hero, at the head of the host given. The
 *  battle's lines that name the skeletal legions, and the fanaticism its whole force's line multiplies by (none if it
 *  doesn't). */
function theSkeletalLinesOf(theKingLeads: boolean, host: Company[]): { lines: string[]; theFactor: string | null } {
  const G = aWorld(SEED);
  const tc = theTurnsContext(G);
  const realm = G.players[0];
  const H = G.characters.find((c) => c.alive && c.player === 0 && c.isKing === theKingLeads);
  if (!realm || !H) throw new Error(`realm 0 has no ${theKingLeads ? 'king' : 'hero but its king'}`);
  realm.alignment = 'Undead';
  realm['discoveries'] = [];
  const { field, from } = aFieldAndTheGroundBesideIt(G, { terrain: 'plain' });
  own(G, from, 0);
  const guard = aGuardMadeByTheTest(G, field, companies('Shieldwall Levies', 1, 'Green'));
  attackFrom(G, H, from, field);
  H.armies = host;
  H.items = [];
  H.encounterPlan = MELEE_AND_NO_DUEL();
  const { words, text } = aBattleAgainstTheProvince(tc, H, field, guard);
  return {
    lines: words.filter((w) => w.includes('skeletal legions')),
    theFactor: /Whole force: [^\n]*× fanaticism ×([\d.]+)/.exec(text)?.[1] ?? null,
  };
}

const aSkeletalHost = (): Company[] => [
  ...companies('Men-at-Arms', 1, 'Average', 'Human'),
  { ...companies('Men-at-Arms', 1, 'Average', 'Human')[0], unitName: 'Risen Company', _isSkeletal: true } as Company,
];

test('under the king in person, a skeletal host fights with undying fanaticism under its Undead king (+50%)', () => {
  const { lines, theFactor } = theSkeletalLinesOf(true, aSkeletalHost());
  expect(theFactor).toBe('1.5');
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatch(
    /skeletal legions fight with undying fanaticism under their Undead king! \(\+50% strength\)$/,
  );
});

test('under any other commander, a skeletal host knows no fear (+30%)', () => {
  const { lines, theFactor } = theSkeletalLinesOf(false, aSkeletalHost());
  expect(theFactor).toBe('1.3');
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatch(/skeletal legions know no fear \(\+30% strength — undying fanaticism\)\.$/);
});

test('a host with no skeletal company has neither line, under the king or a hero', () => {
  for (const theKingLeads of [true, false])
    expect(theSkeletalLinesOf(theKingLeads, companies('Men-at-Arms', 2, 'Average', 'Human'))).toEqual({
      lines: [],
      theFactor: null,
    });
});
