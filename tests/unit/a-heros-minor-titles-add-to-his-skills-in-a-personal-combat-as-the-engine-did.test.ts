// A hero's minor titles add to his skills in a personal combat as the engine did (B-06j): pcCharCombatant asks the
// minor titles' registry ("personalCombat: a hero's titles add to his skills") for his Melee and his Archery and their
// raw levels, where it added the Duelist's, the Marksman's, the Widowmaker's and the Relic-Hunter's +1 itself. For each
// of the sixteen sets of those four titles a hero may hold (none, each alone, any two, three, all four), his fighter's
// four figures are what the old sum gave (written here as it was), under the ceiling of 9 too; a title another hero
// holds adds nothing; each effect reads its levels from its title's rows (content's SKILL_EXTRA_MINORS, scope
// 'combat'); and the runner asks whether he holds a title only of those that add to the skill, in the stage's order, as
// the old sum asked `charMinor`.
// Level 1 (unit): the fighter is built by a function of the turn's context and the hero; a static test can't run it,
// and the matrix's games may give a hero who fights none of these titles, or never two at once.
import '../lib/the-whole-engine.ts';
import { expect, test, vi } from 'vitest';
import { KC_SEASONS } from '../../src/content/kingdoms-call-data.ts';
import {
  SKILL_EXTRA_MINORS,
  type AMinorTitlesSlug,
} from '../../src/content/the-minor-titles-their-keys-names-perks-requirements-and-how-each-holder-is-found.ts';
import { generateBotSetups, isBotRow } from '../../src/engine/bots/setup.ts';
import { effStat } from '../../src/engine/heroes/effective-skills-and-hidden-heroes.ts';
import { pcCharCombatant } from '../../src/engine/personal-combat/speed-encounter-plans-and-combatants.ts';
import { kcRng } from '../../src/engine/rng.ts';
import { A_HEROS_TITLES_ADD_TO_HIS_SKILLS } from '../../src/engine/rules/the-minor-titles/a-heros-titles-add-to-his-skills-in-a-personal-combat.ts';
import { theLevelsAHerosTitlesAddToHisSkillInAPersonalCombat } from '../../src/engine/rules/the-registry-of-the-minor-titles-perks.ts';
import { pcSkillCap, skillLevel } from '../../src/engine/titles/perks.ts';
import { createTurnContext } from '../../src/engine/turn/context.ts';
import { generateNewGame } from '../../src/engine/world/generate.ts';
import type { Character } from '../../src/schemas/saved-game-state.ts';
import { addTheFieldsResolveTurnAdds } from '../lib/the-fields-resolve-turn-adds-to-the-turns-context.ts';

type TheTitle = 'duelist' | 'marksman' | 'widowmaker' | 'relichunter';
const THE_TITLES: readonly TheTitle[] = ['duelist', 'marksman', 'widowmaker', 'relichunter'];

// A world of two bot realms, made by the engine from a fixed seed, kept as JSON: each case stages a fresh copy.
kcRng.seed(1);
const THE_WORLD = JSON.stringify(
  generateNewGame(
    generateBotSetups([], 2, 0).map((b) => ({ ...b, gamePlayerId: 'gp' + String(b.id), name: b.kingdomName })),
    { cols: 10, rows: 6 },
    999,
    { seaPct: 10 },
  ),
);

/** Realm 1's first hero who isn't its king, of the Melee and Archery given, no items, Cautious (no rage), his realm
 *  holding no discovery; he holds the titles given, and another hero of his realm holds those given to another. His
 *  fighter's Melee, Archery and their raw levels, and the same four by the sum as pcCharCombatant wrote it before B-06j
 *  (each title's +1 asked of `charMinor`'s holders, then the ceiling). */
function hisFighter(
  his: readonly TheTitle[],
  melee: number,
  archery: number,
  anotherHolds: readonly TheTitle[] = [],
): { readonly now: readonly (number | undefined)[]; readonly before: readonly number[] } {
  const G = JSON.parse(THE_WORLD) as { characters: Character[]; players: { discoveries: unknown[] }[] } & Record<
    string,
    unknown
  >;
  const tc = addTheFieldsResolveTurnAdds(createTurnContext(G as never, [], 3), { KC_SEASONS, isBotRow });
  const [hero, other] = G.characters.filter((c) => c.alive && c.player === 1 && !c.isKing);
  if (!hero || !other) throw new Error('the world has no two heroes in realm 1');
  for (const p of G.players) p.discoveries = [];
  Object.assign(hero, { skills: { ...hero.skills, melee, archery }, items: [], temper: 'Cautious' });
  const holder = (c: Character) => ({ charId: c.id, playerIndex: 1, name: 'n', perk: 'p' });
  G['_minorHolders'] = Object.fromEntries([
    ...anotherHolds.map((t) => [t, holder(other)] as const),
    ...his.map((t) => [t, holder(hero)] as const),
  ]);
  const holds = (t: TheTitle) => his.includes(t);
  const was = kcRng.use(() => 0.5);
  try {
    const f = pcCharCombatant(tc as never, hero);
    const m = effStat(tc as never, hero, 'melee');
    const a = effStat(tc as never, hero, 'archery');
    const meleeBefore = m + (holds('duelist') ? 1 : 0) + (holds('widowmaker') ? 1 : 0) + (holds('relichunter') ? 1 : 0);
    const archeryBefore =
      a + (holds('marksman') ? 1 : 0) + (holds('widowmaker') ? 1 : 0) + (holds('relichunter') ? 1 : 0);
    return {
      now: [f.melee, f.archery, f.meleeRaw, f.archeryRaw],
      before: [
        pcSkillCap(meleeBefore),
        pcSkillCap(archeryBefore),
        pcSkillCap(Math.max(skillLevel(hero, 'melee'), meleeBefore)),
        pcSkillCap(Math.max(skillLevel(hero, 'archery'), archeryBefore)),
      ],
    };
  } finally {
    kcRng.use(was);
  }
}

/** Every set of the four titles, from none to all four. */
const EVERY_SET: readonly (readonly TheTitle[])[] = Array.from({ length: 16 }, (_, bits) =>
  THE_TITLES.filter((_, i) => bits & (1 << i)),
);

test('Melee 3 and Archery 2: each title alone, and two at once, adds its +1 where its row says', () => {
  expect(hisFighter([], 3, 2).now, 'none').toEqual([3, 2, 3, 2]);
  expect(hisFighter(['duelist'], 3, 2).now, 'the Duelist: Melee').toEqual([4, 2, 4, 2]);
  expect(hisFighter(['marksman'], 3, 2).now, 'the Marksman: Archery').toEqual([3, 3, 3, 3]);
  expect(hisFighter(['widowmaker'], 3, 2).now, 'the Widowmaker: both').toEqual([4, 3, 4, 3]);
  expect(hisFighter(['relichunter'], 3, 2).now, 'the Relic-Hunter: both').toEqual([4, 3, 4, 3]);
  expect(hisFighter(['duelist', 'widowmaker'], 3, 2).now, 'the Duelist and the Widowmaker').toEqual([5, 3, 5, 3]);
  expect(hisFighter(['marksman', 'relichunter'], 3, 2).now, 'the Marksman and the Relic-Hunter').toEqual([4, 4, 4, 4]);
});

test.for([
  [3, 2],
  [8, 9],
  [1, 7],
] as const)('Melee %i and Archery %i: every set of the four titles gives what the old sum gave', ([melee, archery]) => {
  for (const his of EVERY_SET) {
    const { now, before } = hisFighter(his, melee, archery);
    expect(now, his.join(' and ') || 'none').toEqual(before);
  }
});

test('a title another hero of his realm holds adds nothing to him', () => {
  expect(hisFighter([], 3, 2, THE_TITLES).now).toEqual([3, 2, 3, 2]);
  expect(hisFighter(['duelist'], 3, 2, ['marksman', 'widowmaker', 'relichunter']).now).toEqual([4, 2, 4, 2]);
});

test("each effect gives its title's levels from its rows of scope 'combat', and 0 to a skill they don't name", () => {
  for (const t of THE_TITLES)
    for (const skill of ['melee', 'archery'] as const) {
      const fromTheRows = SKILL_EXTRA_MINORS.filter(([key, , , , scope]) => key === t && scope === 'combat')
        .filter(([, skills]) => skills.includes(skill))
        .reduce((s, [, , delta]) => s + delta, 0);
      expect(A_HEROS_TITLES_ADD_TO_HIS_SKILLS[t](skill), `${t}, ${skill}`).toBe(fromTheRows);
    }
  expect(A_HEROS_TITLES_ADD_TO_HIS_SKILLS.duelist('archery')).toBe(0);
  expect(A_HEROS_TITLES_ADD_TO_HIS_SKILLS.marksman('melee')).toBe(0);
});

test('the runner asks whether he holds a title only of those that add to the skill, in the order the old sum did', () => {
  const asked: AMinorTitlesSlug[] = [];
  const heHolds = vi.fn((t: AMinorTitlesSlug) => {
    asked.push(t);
    return t !== 'widowmaker';
  });
  expect(theLevelsAHerosTitlesAddToHisSkillInAPersonalCombat('melee', heHolds)).toBe(2);
  expect(asked, 'melee').toEqual(['duelist', 'widowmaker', 'relichunter']);
  asked.length = 0;
  expect(theLevelsAHerosTitlesAddToHisSkillInAPersonalCombat('archery', heHolds)).toBe(2);
  expect(asked, 'archery').toEqual(['marksman', 'widowmaker', 'relichunter']);
  expect(theLevelsAHerosTitlesAddToHisSkillInAPersonalCombat('melee', () => false)).toBe(0);
});
