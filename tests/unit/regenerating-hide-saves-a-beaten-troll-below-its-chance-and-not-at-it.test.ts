// Regenerating Hide saves a beaten troll below its chance and not at it (plan P1-19d): a Cave Trolls company that fails
// its death roll after a lost battle lives when Regenerating Hide's die falls just under 30%, the chance both books give
// (the content's row holds it, and tests/static/each-unit-abilitys-name-and-numbers-are-in-both-books.test.ts holds the
// row to the books), and dies when the die falls at 30%. The die is drawn only when its condition holds: after a lost
// battle, by a Cave Trolls company that failed its death roll; a victory, or another unit, draws one die and no more.
// abilities-beasts feeds the hide 0.1 and 0.5 only, so a chance anywhere between passed it; this pins the boundary.
// Level 1 (unit): rollUnitFates called directly on the engine's modules (plan P1-14a), with its own dice, no turn
// played. Not lower: the chance is a value the code compares, which a syntax tree can't evaluate; not higher: the
// balance matrix never reaches it (no Cave Trolls fail a death roll in a lost battle in its games), so a chance of 31%
// changes no game of it.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { rollUnitFates } from '../../src/engine/battle/fates.ts';
import type { UnitFateOptions } from '../../src/engine/battle/fates.ts';
import type { ArmyInABattle } from '../../src/engine/army-tables.ts';
import type { TheFactOfOneOfABattlesSentences } from '../../src/engine/battle/the-facts-a-battles-lines-record.ts';

/** Regenerating Hide's chance, as both books write it (30%). */
const THE_CHANCE_THE_BOOKS_GIVE = 0.3;

/** The largest number below x (x positive): the die just under the chance. */
function theNumberJustUnder(x: number): number {
  const bits = new BigInt64Array(new Float64Array([x]).buffer);
  bits[0] = (bits[0] ?? 0n) - 1n;
  return new Float64Array(bits.buffer)[0] ?? Number.NaN;
}

const aCompany = (type: string): ArmyInABattle => ({ type, quality: 'Veteran', race: 'Primal', unitName: '' });

/** One company's fate after a battle, with the dice given: whether it died, the fates of the lines said (each a unit's
 *  fate in the battle since plan P1-12d27, its fate a slug), and how many dice it drew. Every roll fails the death roll (dieAt 1), and nothing demotes or promotes. */
function theFateOf(type: string, won: boolean, dice: readonly number[]) {
  let drawn = 0;
  const rng = () => dice[drawn++] ?? Number.NaN;
  const said: string[] = [];
  const say = (line: string | TheFactOfOneOfABattlesSentences) =>
    said.push(typeof line === 'string' ? line : line.kind === "a unit's fate in the battle" ? line.fate : line.kind);
  const company = aCompany(type);
  const rolls: UnitFateOptions = won
    ? { won: true, dieAt: () => 1, promoteTo: () => 0 }
    : { won: false, dieAt: () => 1, demoteAt: () => 0, promoteTo: () => 0 };
  const tally = rollUnitFates([company], { ...rolls, owner: { heroName: 'Aldric', leaderless: false }, rng, say });
  return { died: company._died === true, tally, said, drawn };
}

const LIVES = 'is cut down and rises again by its regenerating hide';
const DIES = 'dies';

describe('Regenerating Hide, after a lost battle', () => {
  test('a die just under 30% saves the trolls', () => {
    const fate = theFateOf('Cave Trolls', false, [0, theNumberJustUnder(THE_CHANCE_THE_BOOKS_GIVE)]);
    expect(theNumberJustUnder(THE_CHANCE_THE_BOOKS_GIVE)).toBeLessThan(THE_CHANCE_THE_BOOKS_GIVE);
    expect(fate).toMatchObject({ died: false, said: [LIVES], drawn: 2 });
    expect(fate.tally).toMatchObject({ died: 0, survived: 1 });
  });

  test('a die at 30% does not', () => {
    const fate = theFateOf('Cave Trolls', false, [0, THE_CHANCE_THE_BOOKS_GIVE]);
    expect(fate).toMatchObject({ died: true, said: [DIES], drawn: 2 });
    expect(fate.tally).toMatchObject({ died: 1, survived: 0 });
  });
});

describe('its die is drawn only when its condition holds', () => {
  test.for([
    ['Cave Trolls in a victory', 'Cave Trolls', true],
    ['another unit in a defeat', 'Stone Giants', false],
    ['another unit in a victory', 'Stone Giants', true],
  ] as const)('%s: one die, and the company dies', ([, type, won]) => {
    expect(theFateOf(type, won, [0, 0])).toMatchObject({ died: true, said: [DIES], drawn: 1 });
  });
});
