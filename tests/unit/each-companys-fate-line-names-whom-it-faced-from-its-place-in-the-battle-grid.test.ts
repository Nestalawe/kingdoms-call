// Each company's fate line names whom it faced, from its place in the battle grid (2026-10-12, Toby, the battle
// reports: who beat whom; plan P1-14k, the old `battle-faced-lines` script): grids placed and faced from rows made by
// the test (battleGrid and battleFacing, src/engine/battle/lines.ts), then battleFacedClauses on each.
//   • battleFacedClauses(grid, enemyOwner): army → whom it faced, whose words (theClauseOfWhomAUnitFaced, the prose's
//     since P1-12d5) are "facing X" / "shooting X over the line" / "in a flank duel with X" / "guarding the end against
//     X" / "wrapping the line at X" / "met at the end of the line by X" / "riding free round the flank" / "fighting
//     from the air" / "in the reserve" / "in the second line" / "shooting at an empty column" / "with nobody opposite",
//     X the enemy company as ownedUnitName writes it;
//   • rollUnitFates(force, {faced}) puts the clause after the company's own reference in every branch (death,
//     promotion, demotion, disbanding, the Shield Fort's fall-back, the Knightly Example, a rise despite defeat);
//     without `faced` the lines read exactly as before (each-units-fate-after-a-battle-… holds that wording);
//   • disbandLine (the prose's since P1-12d5) takes the clause the same way.
// (Since plan P1-12d35 the losses tally is written from the battle's facts: its case, the company credited to its own
// side and not to the one its clause names, is tests/unit/a-battles-losses-tally-is-written-from-the-facts-of-its-lines.test.ts.)
// The old script booted the GM portal to call these as its globals; "the GM portal boots" and "X() is declared at
// module level" are the imports now, and any page error is this file throwing (an unexpected console.error fails it:
// tests/setup/each.ts).
// Level 1 (unit): the clauses are a pure function of a faced grid, and the fate lines of the force, the dice and the
// clauses, called on the engine's modules. Not static: it places, faces and rolls. Not a scenario: a battle would only
// add its luck on top.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Who beat whom in the fate lines (`src/engine/battle/lines.ts`, `fates.ts`, on hand-made rows): `battleFacedClauses`
// turns a faced grid into a map of one clause per company ("facing X", "shooting X over the line", "in a flank duel
// with X", "guarding the end against X", "wrapping the line at X", "met at the end of the line by X", "riding free
// round the flank", "fighting from the air", "in the second line", "in the reserve", "shooting at an empty column",
// "with nobody opposite"); `rollUnitFates` puts the clause after the company's own reference in every branch (death,
// promotion, demotion, disbanding, the Shield Fort's fall-back, the Knightly Example, a rise despite defeat) and reads
// as before without one; `disbandLine` takes it too. Level 1: pure functions; a battle would only add luck
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import {
  battleFacedClauses,
  battleFacing,
  battleGrid,
  type BattleGrid,
  type BattleRow,
} from '../../src/engine/battle/lines.ts';
import { rollUnitFates, type UnitFateOptions } from '../../src/engine/battle/fates.ts';
import type { ArmyInABattle } from '../../src/engine/army-tables.ts';
import type { AUnitAsALineNamesIt, WhomAUnitFaced } from '../../src/engine/battle/the-facts-a-battles-lines-record.ts';
import { disbandLine, theClauseOfWhomAUnitFaced } from '../../src/views/prose/the-words-of-a-battles-lines.ts';
import { theWordsOf } from '../../src/views/prose/the-words-of-each-line.ts';
import { aRow, aSide, faced, plannedDice, type AFacedGrid } from '../lib/hand-made-battle-lines.ts';

/** A row of a type at Average, named: its strength from the hand-made table (the old script's, which agree). */
const row = (type: string, unitName: string): BattleRow => {
  const r = aRow(type);
  return { ...r, a: { type, quality: 'Average', race: '', unitName } };
};
/** A side's rows, so many of each type, by their names. */
const rows = (spec: readonly (readonly [type: string, names: readonly string[]])[]): BattleRow[] =>
  spec.flatMap(([type, names]) => names.map((nm) => row(type, nm)));

/** Both sides placed, each with the other as its enemy, and faced: `me` the attacker's grid, `them` the defender's. */
function fight(
  mine: BattleRow[],
  theirs: BattleRow[],
  W: number,
  terrain: string,
  tacMe = 0,
  tacThem = 0,
): { me: AFacedGrid; them: AFacedGrid } {
  const me = battleGrid(mine, W, terrain, { tac: tacMe, enemy: theirs, enemyTac: tacThem });
  const them = battleGrid(theirs, W, terrain, { tac: tacThem, enemy: mine, enemyTac: tacMe });
  battleFacing(me, them, terrain);
  return { me: faced(me), them: faced(them) };
}

/** The army of a side's row by its name. */
function armyOf(force: readonly BattleRow[], name: string | undefined): ArmyInABattle {
  const a = force.find((r) => r.a?.unitName === name)?.a;
  if (a?.unitName === undefined) throw new Error(`no company named ${String(name)}`);
  return a;
}
/** A company's clause in words, or undefined when the map holds none for it. */
const clauseOf = (map: Map<ArmyInABattle, WhomAUnitFaced>, force: readonly BattleRow[], name: string | undefined) => {
  const c = map.get(armyOf(force, name));
  return c && theClauseOfWhomAUnitFaced(c);
};
/** The names of a grid's front companies, column by column. */
const frontNames = (g: BattleGrid) => g.front.flatMap((x) => (x?.r.a ? [x.r.a.unitName] : []));

describe('the clauses, one per kind of place', () => {
  test('battleFacedClauses returns a map keyed by the army objects', () => {
    const A = rows([['Shieldwall Levies', ['Levy A1']]]);
    const r = fight(A, rows([['Shieldwall Levies', ['Levy B1']]]), 1, 'plain');
    const ca = battleFacedClauses(r.me, aSide('Gorbash'));
    expect(ca).toBeInstanceOf(Map);
    expect([...ca.keys()]).toEqual([armyOf(A, 'Levy A1')]);
  });

  // A plain, front of 3: Aldric's five Levies, two Longbows, a Free Lance and an Eagle company against Gorbash's three
  // Levies and two Wargs (Tactical 1: both ride the flanks; one duels the Free Lance, one rides free).
  describe('a plain, a front of three, with flank riders and an Eagle', () => {
    const A = rows([
      ['Shieldwall Levies', ['Levy A1', 'Levy A2', 'Levy A3', 'Levy A4', 'Levy A5']],
      ['Yeoman Longbows', ['Bow A1', 'Bow A2']],
      ['Free Lances', ['the Red Hand']],
      ['Eagle Riders', ['the Sky Host']],
    ]);
    const B = rows([
      ['Shieldwall Levies', ['Levy B1', 'Levy B2', 'Levy B3']],
      ['Warg Riders', ['Warg B1', 'Warg B2']],
    ]);
    const r = fight(A, B, 3, 'plain', 0, 1);
    const ca = battleFacedClauses(r.me, aSide('Gorbash'));
    const cb = battleFacedClauses(r.them, aSide('Aldric'));
    const front = frontNames(r.me);

    test('a front Levy faces the Levy opposite', () => {
      expect(front).toHaveLength(3);
      for (const nm of front) expect(clauseOf(ca, A, nm)).toMatch(/^facing Gorbash's Levy B\d$/);
    });

    test('a second-line Longbow shoots the Levy opposite', () => {
      expect(clauseOf(ca, A, 'Bow A1')).toMatch(/^shooting Gorbash's Levy B\d over the line$/);
      expect(clauseOf(ca, A, 'Bow A2')).toMatch(/^shooting Gorbash's Levy B\d over the line$/);
    });

    test('the two spare Levies stand in the second line and the reserve', () => {
      const spare = ['Levy A1', 'Levy A2', 'Levy A3', 'Levy A4', 'Levy A5']
        .filter((nm) => !front.includes(nm))
        .map((nm) => clauseOf(ca, A, nm))
        .sort();
      expect(spare).toEqual(['in the reserve', 'in the second line']);
    });

    test('the Free Lance duels a Warg', () => {
      expect(clauseOf(ca, A, 'the Red Hand')).toMatch(/^in a flank duel with Gorbash's Warg B\d$/);
    });

    test('the Eagles fight from the air', () => {
      expect(clauseOf(ca, A, 'the Sky Host')).toBe('fighting from the air');
    });

    test("Gorbash's Levies face Aldric's", () => {
      for (const nm of ['Levy B1', 'Levy B2', 'Levy B3'])
        expect(clauseOf(cb, B, nm)).toMatch(/^facing Aldric's Levy A\d$/);
    });

    test('one Warg duels the named Free Lance, the other rides free', () => {
      const wargs = ['Warg B1', 'Warg B2'].map((nm) => clauseOf(cb, B, nm)).sort();
      expect(wargs).toEqual([
        "in a flank duel with the Red Hand (Aldric's Free Lances)",
        'riding free round the flank',
      ]);
    });
  });

  // B plain, front of 5: five Levies against three Levies and a Free Lance that guards a threatened end
  describe('a plain, a front of five against three and a guarding rider', () => {
    const C = rows([['Shieldwall Levies', ['Levy C1', 'Levy C2', 'Levy C3', 'Levy C4', 'Levy C5']]]);
    const D = rows([
      ['Shieldwall Levies', ['Levy D1', 'Levy D2', 'Levy D3']],
      ['Free Lances', ['Lance D']],
    ]);
    const r = fight(C, D, 5, 'plain');
    const ca = battleFacedClauses(r.me, aSide('Gorbash'));
    const cb = battleFacedClauses(r.them, aSide('Aldric'));
    const kinds = ['Levy C1', 'Levy C2', 'Levy C3', 'Levy C4', 'Levy C5'].map((nm) => clauseOf(ca, C, nm));

    test('three Levies face', () => {
      expect(kinds.filter((s) => s !== undefined && /^facing Gorbash's Levy D\d$/.test(s))).toHaveLength(3);
    });

    test('the wrapping Levy the rider meets is "met at the end of the line by" it', () => {
      expect(kinds).toContain("met at the end of the line by Gorbash's Lance D");
    });

    test('the other wrapping Levy "wraps the line at" the end unit', () => {
      expect(kinds.some((s) => s !== undefined && /^wrapping the line at Gorbash's Levy D\d$/.test(s))).toBe(true);
    });

    test('the Free Lance guards the end', () => {
      expect(clauseOf(cb, D, 'Lance D')).toMatch(/^guarding the end against Aldric's Levy C\d$/);
    });
  });

  // C plain, front of 2: a Longbow behind a Levy with nobody opposite shoots at an empty column; against a side with
  // no front at all a Levy stands with nobody opposite
  test('one Longbow shoots the Levy, the other an empty column', () => {
    const E = rows([
      ['Shieldwall Levies', ['Levy E1', 'Levy E2']],
      ['Yeoman Longbows', ['Bow E1', 'Bow E2']],
    ]);
    const r = fight(E, rows([['Shieldwall Levies', ['Levy F1']]]), 2, 'plain');
    const ca = battleFacedClauses(r.me, aSide('Gorbash'));
    const bows = ['Bow E1', 'Bow E2'].map((nm) => clauseOf(ca, E, nm)).sort();
    expect(bows).toEqual(["shooting Gorbash's Levy F1 over the line", 'shooting at an empty column'].sort());
  });

  test('against a side with no front a Levy stands "with nobody opposite"', () => {
    const G = rows([['Shieldwall Levies', ['Levy G1']]]);
    const r = fight(G, rows([['Eagle Riders', ['the Talons']]]), 2, 'plain');
    const c = battleFacedClauses(r.me, aSide('Gorbash')).get(armyOf(G, 'Levy G1'));
    expect(frontNames(r.me)).toEqual(['Levy G1']);
    expect(c && theClauseOfWhomAUnitFaced(c)).toBe('with nobody opposite');
  });

  test('no grid, no clauses', () => {
    expect(battleFacedClauses(null, aSide('Gorbash')).size).toBe(0);
    expect(battleFacedClauses({ units: [] }, aSide('Gorbash')).size).toBe(0);
  });
});

describe('the fate lines carry the clause', () => {
  /** A unit of a type and quality, by its name. */
  const unit = (type: string, quality: string, unitName: string): ArmyInABattle => ({
    type,
    quality,
    race: '',
    unitName,
  });
  /** The words of each line the fates of a force say, on planned dice. */
  function run(
    force: ArmyInABattle[],
    o: UnitFateOptions,
    draws: readonly number[],
    whom?: UnitFateOptions['faced'],
  ): string[] {
    const lines: string[] = [];
    rollUnitFates(force, {
      ...o,
      rng: plannedDice(draws),
      say: (l) => lines.push(theWordsOf(l)),
      ...(whom ? { faced: whom } : {}),
    });
    return lines;
  }
  /** The force's company at i: there, or the test fails. */
  const at = (force: readonly ArmyInABattle[], i: number): ArmyInABattle => {
    const a = force[i];
    if (!a) throw new Error(`no company at ${String(i)}`);
    return a;
  };
  const facing = (how: 'faces' | 'shoots', theEnemyUnit: AUnitAsALineNamesIt): WhomAUnitFaced => ({
    kind: 'an enemy unit',
    how,
    theEnemyUnit,
  });
  // the enemy company a clause names, as the battle hands it: its record, ownedUnitName's form (plan P1-12d28)
  const enemy = (ownerName: string, unitName: string, type: string): AUnitAsALineNamesIt => ({
    kind: 'a unit named without its quality',
    owner: aSide(ownerName),
    unitName,
    type,
    quality: 'Average',
  });

  describe("a winner's lines", () => {
    const f = [
      unit('Shieldwall Levies', 'Average', 'Levy A1'),
      unit('Yeoman Longbows', 'Average', 'Bow A1'),
      unit('Eagle Riders', 'Veteran', 'the Sky Host'),
    ];
    const whom = new Map<ArmyInABattle, WhomAUnitFaced>([
      [at(f, 0), facing('faces', enemy('Gorbash', 'Levy B1', 'Shieldwall Levies'))],
      [at(f, 1), facing('shoots', enemy('Gorbash', 'Levy B2', 'Shieldwall Levies'))],
      [at(f, 2), { kind: 'it fought from the air' }],
    ]);
    const lines = run(
      f,
      { owner: aSide('Aldric'), won: true, dieAt: () => 0.1, promoteTo: () => 0.4 },
      [0.05, 0.3, 0.3],
      whom,
    );

    test("a winner's death names whom it faced", () => {
      expect(lines[0]).toBe(
        "— Aldric's Levy A1 (Shieldwall Levies, Average), facing Gorbash's Levy B1, were destroyed in the fighting.",
      );
    });

    test("a winner's promotion names whom it shot", () => {
      expect(lines[1]).toBe(
        "— Aldric's Bow A1 (Yeoman Longbows, Average), shooting Gorbash's Levy B2 over the line, earn promotion to Veteran!",
      );
    });

    test('a named company keeps its form, the clause after it', () => {
      expect(lines[2]).toBe(
        "— the Sky Host (Aldric's Eagle Riders, Veteran), fighting from the air, earn promotion to Crack!",
      );
    });
  });

  describe("a loser's lines", () => {
    const f = [
      unit('Orc Berserkers', 'Veteran', 'Zog'),
      unit('Goblin Horde', 'Average', 'Gob 1'),
      unit('Goblin Horde', 'Green', 'Gob 2'),
      unit('Warg Riders', 'Average', 'Fang'),
      unit('Dwarven Guard', 'Veteran', 'Durn'),
      unit('Shieldwall Levies', 'Average', 'Levy X'),
    ];
    const whom = new Map<ArmyInABattle, WhomAUnitFaced>(
      f.map((a, i) => [a, facing('faces', enemy('Aldric', `Levy A${String(i + 1)}`, 'Shieldwall Levies'))]),
    );
    const lines = run(
      f,
      {
        owner: aSide('Gorbash'),
        won: false,
        inTheRout: true,
        dieAt: () => 0.2,
        demoteAt: () => 0.3,
        promoteTo: () => 0.45,
      },
      [0.1, 0.5, 0.1, 0.5, 0.2, 0.5, 0.4, 0.5, 0.1, 0.5, 0.1],
      whom,
    );

    test("a loser's death", () => {
      expect(lines[0]).toBe(
        "— Gorbash's Zog (Orc Berserkers, Veteran), facing Aldric's Levy A1, were annihilated in the rout!",
      );
    });

    test('a demotion', () => {
      expect(lines[1]).toBe(
        "— Gorbash's Gob 1 (Goblin Horde, Average), facing Aldric's Levy A2, lost heart in defeat, reduced to Green.",
      );
    });

    test('a disbanding', () => {
      expect(lines[2]).toBe(
        "— Gorbash's Gob 2 (Goblin Horde), facing Aldric's Levy A3, have had enough — the survivors slip away to their villages and the unit disbands for good.",
      );
    });

    test('a rise despite defeat', () => {
      expect(lines[3]).toBe(
        "— Despite defeat, Gorbash's Fang (Warg Riders, Average), facing Aldric's Levy A4, improved to Veteran!",
      );
    });

    test('the Guard, outside a Shield Fort', () => {
      expect(lines[4]).toBe(
        "— Gorbash's Durn (Dwarven Guard, Veteran), facing Aldric's Levy A5, lost heart in defeat, reduced to Average.",
      );
    });

    test("the Shield Fort's fall-back", () => {
      const durn = at(f, 4);
      const said = run(
        [durn],
        {
          owner: aSide('Gorbash'),
          won: false,
          dieAt: () => 0,
          demoteAt: () => 0.5,
          promoteTo: () => 0.6,
          shieldFort: true,
        },
        [0.9, 0.1],
        whom,
      );
      expect(said[0]).toBe(
        "— Gorbash's Durn (Dwarven Guard, Average), facing Aldric's Levy A5, fall back behind the shield wall in good order.",
      );
    });

    test('the Knightly Example', () => {
      const lk = unit('Shieldwall Levies', 'Average', 'Levy K'); // a fresh company: Levy X was demoted above
      whom.set(lk, facing('faces', enemy('Aldric', 'Levy A6', 'Shieldwall Levies')));
      const said = run(
        [lk],
        {
          owner: aSide('Gorbash'),
          won: false,
          dieAt: () => 0,
          demoteAt: () => 0.5,
          promoteTo: () => 0.6,
          knightly: true,
        },
        [0.9, 0.1],
        whom,
      );
      expect(said[0]).toBe(
        "— Gorbash's Levy K (Shieldwall Levies, Average), facing Aldric's Levy A6, keep their nerve under the Knightly Example of the Gilded Lances and lose nothing in defeat.",
      );
    });

    // a company the map does not know, and no map at all, read as before
    test('a company with no clause reads as before', () => {
      const said = run(
        [unit('Shieldwall Levies', 'Average', 'Levy Z')],
        { owner: aSide('Aldric'), won: true, dieAt: () => 1, promoteTo: () => 1 },
        [0.5],
        whom,
      );
      expect(said[0]).toBe("— Aldric's Levy Z (Shieldwall Levies, Average) were destroyed in the fighting.");
    });
  });

  test('with no faced map the wording is unchanged', () => {
    const said = run(
      [unit('Shieldwall Levies', 'Average', 'Levy Z')],
      { owner: aSide('Aldric'), won: true, dieAt: () => 1, promoteTo: () => 1 },
      [0.5],
    );
    expect(said[0]).toBe("— Aldric's Levy Z (Shieldwall Levies, Average) were destroyed in the fighting.");
  });

  test('faced may be a function', () => {
    const said = run(
      [unit('Shieldwall Levies', 'Average', 'Levy Y')],
      { owner: aSide('Aldric'), won: true, dieAt: () => 1, promoteTo: () => 1 },
      [0.5],
      (a) => (a.unitName === 'Levy Y' ? { kind: 'nobody stood opposite' } : null),
    );
    expect(said[0]).toBe(
      "— Aldric's Levy Y (Shieldwall Levies, Average), with nobody opposite, were destroyed in the fighting.",
    );
  });

  test('disbandLine takes the clause after the company', () => {
    expect(disbandLine('Aldric', unit('Shieldwall Levies', 'Green', 'Levy Q'), "facing Gorbash's Gob 1")).toBe(
      "— Aldric's Levy Q (Shieldwall Levies), facing Gorbash's Gob 1, have had enough — the survivors slip away to their villages and the unit disbands for good.",
    );
  });

  test('…and reads as before without one', () => {
    expect(disbandLine('Aldric', unit('Shieldwall Levies', 'Green', 'Levy Q'))).toBe(
      "— Aldric's Levy Q (Shieldwall Levies) have had enough — the survivors slip away to their villages and the unit disbands for good.",
    );
  });
});
