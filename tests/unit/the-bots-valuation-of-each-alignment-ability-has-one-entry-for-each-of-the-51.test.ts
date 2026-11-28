// The bots' valuation of each alignment ability has one entry for each of the 51 (B-17p; BOT-V5): the table in
// src/engine/bots/the-bots-valuation-of-each-alignment-ability-keyed-by-the-ability.ts holds every row of
// ALIGNMENT_ABILITIES and no other, in the rows' order. The compiler refuses a missing key too (`satisfies
// Record<AlignmentAbilitySlug, …>`); this test also turns red when a key is left out or added. Each entry asked of a
// rule's runner names the registry's own runner for that ability, and the table holds what today's bots do: 9 asked of
// a runner, 11 chosen by a pass of the plan, 15 with nothing to choose, 16 not valued yet.
//
// Level 1 (unit): the table and the registry read directly. Not lower: a static test reads the text, not which
// function an entry holds.
import { describe, expect, test } from 'vitest';
import { ALIGNMENT_ABILITIES } from '../../src/content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import { THE_BOTS_VALUATION_OF_EACH_ALIGNMENT_ABILITY } from '../../src/engine/bots/the-bots-valuation-of-each-alignment-ability-keyed-by-the-ability.ts';
import {
  theConquestDoctrineOfARealmsAlignment,
  theFactorARealmsAlignmentStrengthensItsDefenceOfItsOwnGroundBy,
  theFervourOfASide,
  theGoldARealmsAlignmentClaimsForEachFoeDestroyed,
  theReturnARealmsAlignmentGivesItsFallen,
  theYieldOfABlessARealmsAlignmentGives,
  whatARealmsAlignmentAddsToConvergingColumnsChanceToUnite,
  whatARealmsAlignmentAddsToResearch,
} from '../../src/engine/rules/the-registry-of-alignment-abilities.ts';

const TABLE = THE_BOTS_VALUATION_OF_EACH_ALIGNMENT_ABILITY;

describe("the bots' valuation of each alignment ability", () => {
  test('one entry for each of the 51 rows, and no other, in the rows order', () => {
    const theRows = Object.keys(ALIGNMENT_ABILITIES);
    expect(theRows.length, 'the rows').toBe(51);
    expect(Object.keys(TABLE), `the table's keys: ${Object.keys(TABLE).join(', ')}`).toEqual(theRows);
  });

  test("each entry asked of a rule's runner names the registry's runner for its ability", () => {
    const theRunners: Record<string, unknown> = {
      'savage-fury': theFervourOfASide,
      'skeletal-fervour': theFervourOfASide,
      'righteous-defence': theFactorARealmsAlignmentStrengthensItsDefenceOfItsOwnGroundBy,
      'banner-of-fellowship': whatARealmsAlignmentAddsToConvergingColumnsChanceToUnite,
      'the-divine-blessing': theYieldOfABlessARealmsAlignmentGives,
      'neutral-scholars': whatARealmsAlignmentAddsToResearch,
      'divine-grace': theReturnARealmsAlignmentGivesItsFallen,
      'a-pagan-victors-blood-harvest': theGoldARealmsAlignmentClaimsForEachFoeDestroyed,
      'plunder-or-enslave': theConquestDoctrineOfARealmsAlignment,
    };
    const asked = Object.entries(TABLE).flatMap(([slug, entry]) =>
      'theRunner' in entry ? [{ slug, theRunner: entry.theRunner }] : [],
    );
    expect(asked.map(({ slug }) => slug).sort(), 'the abilities asked of a runner').toEqual(
      Object.keys(theRunners).sort(),
    );
    for (const { slug, theRunner } of asked) expect(theRunner, `${slug}'s runner`).toBe(theRunners[slug]);
  });

  test('the count of each kind, as the bots value them today', () => {
    const theCounts: Record<string, number> = {};
    for (const entry of Object.values(TABLE)) theCounts[entry.how] = (theCounts[entry.how] ?? 0) + 1;
    expect(theCounts).toEqual({
      "asked of the rule's runner, weighed by its kind": 9,
      'chosen by a pass of the plan': 11,
      'nothing to choose': 15,
      'not valued yet': 16,
    });
  });
});
