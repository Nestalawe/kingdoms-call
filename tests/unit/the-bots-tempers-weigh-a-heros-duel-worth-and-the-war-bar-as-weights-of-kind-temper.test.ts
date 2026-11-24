// The bots' tempers weigh a hero's duel worth and the war bar as weights of kind temper (B-06aj, T7, the rules pulled
// out: the tempers' family), each with the bot's own figures as they were: botDuelRating adds Berserk 6, Brave 4,
// Cautious 5 and any other temper (Cowardly, none, the guardians' None, a name no row has) 0, from the first version's
// `temper` weights, against the chain it wrote inline; it reads the hero's own temper, not the one his items give him
// (KD-467: a Cowardly hero in a Berserk war-mask rates as Cowardly). The war bar's table (BOT_WAR.temper, read by the
// king's temper in botWarAssess) is Berserk −0.25, Brave −0.1, Cautious +0.15 and Cowardly +0.3, from the same weights.
// No matrix game shows which temper reads which: the balance games hold the bots' plans only as a whole, and the bar
// is clamped at its floor for a Berserk king of a realm still expanding.
//
// Level 1 (unit): the bots' function and table read directly with small synthetic heroes. Not lower: a static test
// can't run them, and the figures are what they hand on.
import { describe, expect, test } from 'vitest';
import { botDuelRating } from '../../src/engine/bots/spellcraft.ts';
import { BOT_WAR } from '../../src/engine/bots/war.ts';
import type { Character } from '../../src/schemas/saved-game-state.ts';

/** The tempers a hero may hold: the four, none, the guardians' row of no temper, a word of no temper, and the names
 *  every object answers to (a table read by its key must not find them). */
const TEMPERS = [
  'Berserk',
  'Brave',
  'Cautious',
  'Cowardly',
  '',
  undefined,
  'None',
  'berserk',
  'constructor',
  'toString',
  '__proto__',
];

/** A hero of 20 hit points, Melee 1 and no items, of the temper given (and the items given). */
const aHeroOfTheTemper = (temper: string | undefined, items: readonly object[] = []) =>
  // `as`: a hero made of the few fields botDuelRating reads, as it reads them
  ({ hp: 20, maxHp: 20, skills: { melee: 1 }, temper, items }) as unknown as Character;

/** The temper's part of the figure as the bot wrote it before B-06aj, its numbers and its tempers written in. */
const asTheBotWroteIt = (t: string) => (t === 'Berserk' ? 6 : t === 'Brave' ? 4 : t === 'Cautious' ? 5 : 0);

describe("botDuelRating: a hero's temper, by the temper weights", () => {
  test('each temper adds what the bot wrote: Berserk 6, Brave 4, Cautious 5, any other nothing', () => {
    const theFigures = TEMPERS.map((t) => `${t ?? 'none'}: ${String(botDuelRating(aHeroOfTheTemper(t)))}`);
    const asItWas = TEMPERS.map((t) => `${t ?? 'none'}: ${String(20 + 6 + asTheBotWroteIt(t ?? ''))}`);
    expect(theFigures.join('; '), 'every temper against the old chain').toBe(asItWas.join('; '));
    expect(theFigures.join('; ')).toBe(
      'Berserk: 32; Brave: 30; Cautious: 31; Cowardly: 26; : 26; none: 26; None: 26; berserk: 26; constructor: 26; ' +
        'toString: 26; __proto__: 26',
    );
  });

  test("a Cowardly hero in a Berserk war-mask rates by his own temper, not the mask's (the bot's figure, KD-467)", () => {
    const theWarmask = { name: 'Warmask of the Red Rage', effect: { stat: 'temper', temper: 'Berserk', bonus: 0 } };
    // 20 hit points, Melee 1 (6), one item (3), Cowardly (0): the mask's Berserk would add 6 more
    expect(botDuelRating(aHeroOfTheTemper('Cowardly', [theWarmask])), 'a Cowardly hero in the mask').toBe(29);
  });
});

describe("the war bar's table: what a king's temper adds, by the temper weights", () => {
  test('Berserk −0.25, Brave −0.1, Cautious +0.15, Cowardly +0.3, each in its place, and no other temper', () => {
    expect(BOT_WAR.temper).toEqual({ Berserk: -0.25, Brave: -0.1, Cautious: 0.15, Cowardly: 0.3 });
    expect(Object.keys(BOT_WAR.temper), 'the tempers the table names, in its order').toEqual([
      'Berserk',
      'Brave',
      'Cautious',
      'Cowardly',
    ]);
  });
});
