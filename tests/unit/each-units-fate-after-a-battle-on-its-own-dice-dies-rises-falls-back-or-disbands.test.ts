// Each unit's fate after a battle, on its own dice (plan P1-14k, the old `unit-fates` script): rollUnitFates
// (src/engine/battle/fates.ts), the per-unit rolls the four casualty loops share, driven with dice the test plans.
//   • the winner's rolls: below dieAt a unit dies ("destroyed in the fighting", its bones to dust for a skeleton);
//     otherwise below promoteTo it rises a tier (an Elite company, or a skeleton, simply survives); a victorious
//     defender's rise is told as "are hardened by victory to" (hardenedByVictory);
//   • the loser's rolls: below dieAt it dies, told as the site tells it (inTheRout: "annihilated in the rout");
//     otherwise a second roll: below demoteAt it falls back in good order under Shield Fort, else loses a tier or, from
//     Green, disbands; else below promoteTo it rises "despite defeat"; o.notable stamps _notable on a demoted or
//     promoted unit;
//   • the dice are drawn as the old loops drew them: one a unit, a second only for a beaten unit that neither died nor
//     is skeletal (the planned dice throw on a draw past their plan, so a test can't pass on dice it never planned);
//   • with no owner handed (a side's record since P1-12d28), a company's line and its disbanding name it alone;
//   • unitRef and ownedUnitName, moved to module level with it, keep their wording; demoteOrDisband, moved with them,
//     lowers a tier or, from Green, disbands.
// Each line's words are the prose's (theWordsOf: the lines are facts since P1-12c6). The old script booted the GM
// portal to call these as its globals; "the GM portal boots" and "X() is declared at module level" are the imports now
// (demoteOrDisband, which the old script only asked to be declared, is called here too), and any page error is this
// file throwing (an unexpected console.error fails it: tests/setup/each.ts).
// Level 1 (unit): a unit's fate is a pure function of its force, the thresholds and the dice, called on the engine's
// modules. Not static: it rolls. Not a scenario: a battle would only add its own dice on top.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// `rollUnitFates` (`src/engine/battle/fates.ts`) on planned dice: the winner's death and promotion rolls, the loser's
// death, demotion, disbanding, Shield Fort fall-back and despite-defeat promotion, skeletons that neither rise nor
// fall, the `_notable` stamp, the exact wording (through `theWordsOf`), and the dice drawn as before (one a unit, a
// second only for a beaten survivor that is not skeletal); with no owner, a company named alone; `unitRef`,
// `ownedUnitName` and `demoteOrDisband` keep their wording and tiers. Level 1: pure functions; a battle would only add
// dice
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { rollUnitFates, type UnitFateOptions } from '../../src/engine/battle/fates.ts';
import { demoteOrDisband, type ArmyInABattle } from '../../src/engine/army-tables.ts';
import { ownedUnitName } from '../../src/engine/army-tables.ts';
import { unitRef } from '../../src/engine/army-tables.ts';
import { theWordsOf } from '../../src/views/prose/the-words-of-each-line.ts';
import { plannedDice } from '../lib/hand-made-battle-lines.ts';

/** A unit of a type and quality, named after its type ("Shieldwall Levies 1"). */
const unit = (type: string, quality: string, extra: Partial<ArmyInABattle> = {}): ArmyInABattle => ({
  type,
  quality,
  race: '',
  unitName: `${type} 1`,
  ...extra,
});

/** A side's record, as the battle hands it: a hero's host, led. */
const owner = (heroName: string) => ({ heroName, leaderless: false });

/** The fates of a force on planned dice: the tally, each line's words, and how many dice were drawn. */
function run(force: ArmyInABattle[], o: UnitFateOptions, draws: readonly number[]) {
  const dice = plannedDice(draws);
  let used = 0;
  const rng = () => {
    const d = dice();
    used++;
    return d;
  };
  const lines: string[] = [];
  const r = rollUnitFates(force, { ...o, rng, say: (l) => lines.push(theWordsOf(l)) });
  return { r, lines, used };
}

describe("the winner's rolls", () => {
  const f = [
    unit('Shieldwall Levies', 'Average'),
    unit('Yeoman Longbows', 'Veteran'),
    unit('Dwarven Guard', 'Elite'),
    unit('Shieldwall Levies', 'Average', { _isSkeletal: true }),
  ];
  const t = run(
    f,
    { owner: owner('Aldric'), won: true, dieAt: () => 0.1, promoteTo: () => 0.4 },
    [0.05, 0.3, 0.3, 0.3],
  );

  test('a roll under dieAt kills', () => {
    expect(t.r.died).toBe(1);
    expect(f[0]?._died).toBe(true);
    expect(t.lines[0]).toBe(
      "— Aldric's Shieldwall Levies 1 (Shieldwall Levies, Average) were destroyed in the fighting.",
    );
  });

  test('a roll under promoteTo promotes and names the old tier', () => {
    expect(t.r.promoted).toBe(1);
    expect(f[1]?.quality).toBe('Crack');
    expect(t.lines[1]).toBe("— Aldric's Yeoman Longbows 1 (Yeoman Longbows, Veteran) earn promotion to Crack!");
  });

  test('an Elite company and a skeleton in the same window simply survive, with no line', () => {
    expect(t.r.survived).toBe(2);
    expect(f[2]?.quality).toBe('Elite');
    expect(f[3]?.quality).toBe('Average');
    expect(t.lines).toHaveLength(2);
  });

  test('one die per unit for a winner', () => {
    expect(t.used).toBe(4);
  });

  test('a winner is never stamped notable', () => {
    expect(f.some((a) => a._notable)).toBe(false);
  });

  test('a dead skeleton crumbles to dust', () => {
    const s = run(
      [unit('Shieldwall Levies', 'Average', { _isSkeletal: true })],
      { owner: owner('Aldric'), won: true, dieAt: () => 0.5, promoteTo: () => 1 },
      [0.1],
    );
    expect(s.lines[0]).toMatch(/were destroyed in the fighting\. Their bones crumble to dust — gone forever\.$/);
  });

  test("the victorious defender's verb", () => {
    const s = run(
      [unit('Free Lances', 'Green')],
      { owner: owner('Gorbash'), won: true, hardenedByVictory: true, dieAt: () => 0, promoteTo: () => 1 },
      [0.5],
    );
    expect(s.lines[0]).toBe("— Gorbash's Free Lances 1 (Free Lances, Green) are hardened by victory to Average!");
  });
});

describe("the loser's rolls", () => {
  const f = [
    unit('Orc Berserkers', 'Veteran'),
    unit('Goblin Horde', 'Average'),
    unit('Goblin Horde', 'Green'),
    unit('Warg Riders', 'Average'),
    unit('Orc Berserkers', 'Crack'),
    unit('Goblin Horde', 'Average', { _isSkeletal: true }),
  ];
  const t = run(
    f,
    {
      owner: owner('Gorbash'),
      won: false,
      inTheRout: true,
      dieAt: () => 0.2,
      demoteAt: () => 0.3,
      promoteTo: () => 0.45,
      notable: true,
    },
    [0.1, 0.5, 0.1, 0.5, 0.2, 0.5, 0.4, 0.5, 0.9, 0.5],
  );

  test("the site's death verb", () => {
    expect(t.r.died).toBe(1);
    expect(t.lines[0]).toBe("— Gorbash's Orc Berserkers 1 (Orc Berserkers, Veteran) were annihilated in the rout!");
  });

  test('a second roll under demoteAt loses a tier', () => {
    expect(t.r.demoted).toBe(1);
    expect(f[1]?.quality).toBe('Green');
    expect(f[1]?._notable).toBe(true);
    expect(t.lines[1]).toBe(
      "— Gorbash's Goblin Horde 1 (Goblin Horde, Average) lost heart in defeat, reduced to Green.",
    );
  });

  test('a Green company that would fall further disbands', () => {
    expect(t.r.disbanded).toBe(1);
    expect(f[2]?._disbanded).toBe(true);
    expect(t.lines[2]).toMatch(
      /have had enough — the survivors slip away to their villages and the unit disbands for good\.$/,
    );
  });

  test('a second roll between demoteAt and promoteTo rises despite defeat', () => {
    expect(t.r.promoted).toBe(1);
    expect(f[3]?.quality).toBe('Veteran');
    expect(f[3]?._notable).toBe(true);
    expect(t.lines[3]).toBe("— Despite defeat, Gorbash's Warg Riders 1 (Warg Riders, Average) improved to Veteran!");
  });

  test('a unit above both thresholds, and a skeleton, survive with no line', () => {
    expect(t.r.survived).toBe(2);
    expect(f[4]?.quality).toBe('Crack');
    expect(f[4]?._notable).toBeFalsy();
    expect(t.lines).toHaveLength(4);
  });

  test('a beaten unit that neither died nor is skeletal draws a second die; the dead and the skeletal draw one', () => {
    expect(t.used).toBe(10);
  });

  test('under Shield Fort a demotion is an orderly fall-back', () => {
    const s = run(
      [unit('Dwarven Guard', 'Veteran')],
      {
        owner: owner('Thorin'),
        won: false,
        dieAt: () => 0,
        demoteAt: () => 0.5,
        promoteTo: () => 0.6,
        shieldFort: true,
      },
      [0.9, 0.1],
    );
    expect(s.r.held).toBe(1);
    expect(s.r.demoted).toBe(0);
    expect(s.lines[0]).toBe(
      "— Thorin's Dwarven Guard 1 (Dwarven Guard, Veteran) fall back behind the shield wall in good order.",
    );
  });

  test('a surviving skeleton is never demoted, disbanded or promoted', () => {
    const s = run(
      [unit('Shieldwall Levies', 'Green', { _isSkeletal: true })],
      { owner: owner('Mort'), won: false, dieAt: () => 0.5, demoteAt: () => 1, promoteTo: () => 1 },
      [0.9],
    );
    expect(s.r.survived).toBe(1);
    expect(s.lines).toEqual([]);
  });

  test('a beaten unit above every threshold survives with no line', () => {
    const s = run(
      [unit('Shieldwall Levies', 'Average')],
      { owner: owner('Mort'), won: false, dieAt: () => 0, demoteAt: () => 0, promoteTo: () => 0 },
      [0.5, 0.5],
    );
    expect(s.r.survived).toBe(1);
    expect(s.lines).toEqual([]);
  });
});

test('an empty force rolls nothing', () => {
  expect(rollUnitFates(null, { won: true, dieAt: () => 1, promoteTo: () => 1 }).died).toBe(0);
});

describe('with no owner handed (plan P1-12d28: the owner is a side’s record)', () => {
  test('a company is named alone', () => {
    const s = run([unit('Shieldwall Levies', 'Average')], { won: true, dieAt: () => 1, promoteTo: () => 1 }, [0.5]);
    expect(s.lines[0]).toBe('— Shieldwall Levies 1 (Shieldwall Levies, Average) were destroyed in the fighting.');
  });

  test('…and so is its disbanding', () => {
    const s = run(
      [unit('Shieldwall Levies', 'Green')],
      { won: false, dieAt: () => 0, demoteAt: () => 1, promoteTo: () => 1 },
      [0.5, 0.5],
    );
    expect(s.r.disbanded).toBe(1);
    expect(s.lines[0]).toBe(
      '— Shieldwall Levies 1 (Shieldwall Levies) have had enough — the survivors slip away to their villages and the unit disbands for good.',
    );
  });
});

describe('the helpers that moved with it', () => {
  test('unitRef keeps its wording', () => {
    expect(unitRef('Aldric', { unitName: 'the Red Hand', type: 'Eagle Riders', quality: 'Elite' })).toBe(
      "the Red Hand (Aldric's Eagle Riders, Elite)",
    );
    expect(unitRef('', { unitName: '', type: 'Levies', quality: 'Green' })).toBe('Green Levies');
  });

  test('ownedUnitName keeps its wording', () => {
    expect(ownedUnitName('Aldric', { unitName: 'the Red Hand', type: 'Eagle Riders' })).toBe(
      "the Red Hand (Aldric's Eagle Riders)",
    );
    expect(ownedUnitName('Aldric', { unitName: '', type: 'Levies' })).toBe("Aldric's Levies");
  });

  test('demoteOrDisband lowers a tier, or from Green disbands (the old script asked only that it was declared)', () => {
    const veteran = unit('Shieldwall Levies', 'Veteran');
    expect(demoteOrDisband(veteran)).toBe(false);
    expect(veteran).toMatchObject({ quality: 'Average' });
    expect(veteran._disbanded).toBeUndefined();
    const green = unit('Shieldwall Levies', 'Green');
    expect(demoteOrDisband(green)).toBe(true);
    expect(green).toMatchObject({ quality: 'Green', _disbanded: true });
    expect(demoteOrDisband(null)).toBe(false);
  });
});
