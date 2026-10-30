// The combat spell and guardian power lines no game of the balance matrix reaches keep their values (plan P1-10b16).
// The lines P1-10b16 changed to free personal-combat/combat-spells-and-guardian-abilities.ts and
// personal-combat/resolve-personal-combat.ts of the ts-nocheck line that no game reaches, or reaches only in part, give
// the value each gave before (worked out by the rules as the files had them, with their ts-nocheck line):
// - a spell cast in a fight: one of no name (no school, nothing told), a school's limit reached, Spiritwrack's shrug
//   by the guardian's grade (none for a hero), Invisibility's cut to the foe's aim (the larger of the two, a NaN read
//   as none), Curse on the best of Melee, Archery and the best school, and Charm against a king, a mind lately swayed,
//   a will that resists it (or doesn't) and a guardian;
// - a guardian's power: an older save's damage range (no weight), a range of nothing, a power that raises his Melee,
//   and a power that kills outright (or never);
// - the fight: a Druid's beast ward halved by a curse on his Druid, or gone with it, and a Mirror Shard that makes the
//   illusion harder to see through.
// Level 1 (unit): each is a function on staged fighters, called on the engine's modules (tests/lib/personal-combat.ts,
// for the turn's context), the dice pinned with kcRng.use (pc.pinned). A static check can't run them, and no game
// reaches these lines.
import { describe, expect, test } from 'vitest';
import { clone, personalCombatEngine } from '../lib/personal-combat.ts';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';
import type { TurnContext } from '../../src/engine/turn/context.ts';
import type { Character, Item } from '../../src/schemas/saved-game-state.ts';
import type { AFighterInAPersonalCombat } from '../../src/engine/personal-combat/helpers.ts';

const pc = await personalCombatEngine();
/** The turn's context the engine made for this world (the test library's type names only the fields it reads). */
const tc = pc.turnContext as unknown as TurnContext;
const { pcCastCombatSpell, pcMonsterSpecial } =
  await import('../../src/engine/personal-combat/combat-spells-and-guardian-abilities.ts');
const { pcCharCombatant, pcMonsterCombatant } =
  await import('../../src/engine/personal-combat/speed-encounter-plans-and-combatants.ts');
const { resolvePersonalCombat } = await import('../../src/engine/personal-combat/resolve-personal-combat.ts');
const { ALL_MAGIC_ITEMS_P } = await import('../../src/content/kingdoms-call-data.ts');

type ASpecial = Parameters<typeof pcMonsterSpecial>[3];

/** Each line's kind. */
const kinds = (narrative: readonly NarrativeLine[]) => narrative.map((l) => (typeof l === 'string' ? l : l.kind));
/** The line of the kind given (its fact), or undefined. */
const lineOf = (narrative: readonly NarrativeLine[], kind: string) =>
  narrative.find((l): l is Exclude<NarrativeLine, string> => typeof l !== 'string' && l.kind === kind);
/** A fight's state as a spell finds it, at melee range. */
const aFight = () => ({ fledBy: null, parley: false, stoleBy: null, range: 'melee', mirror: null, feature: null });
/** A held copy of the item of that name, worn. */
const worn = (name: string): Item => {
  const it = (ALL_MAGIC_ITEMS_P as unknown as Item[]).find((i) => i.name === name);
  if (!it) throw new Error(`no ${name} among the items`);
  return { ...clone(it), equipped: true };
};
/** A hero's fighter (a copy of a living hero of the world), of the skills, items and record's fields given, at 40 HP. */
const aHero = (
  skills: Record<string, number> = {},
  {
    items = [],
    tactics = ['ME'],
    over = {},
  }: { items?: Item[]; tactics?: string[]; over?: Record<string, unknown> } = {},
): AFighterInAPersonalCombat => {
  const base = clone(pc.base);
  const record = {
    ...base,
    skills: { ...base.skills, ...skills },
    items,
    encounterPlan: { tactics, duelStance: 'accept' },
    ...over,
  } as unknown as Character;
  const h = pcCharCombatant(tc, record);
  h.hp = h.maxHp = 40;
  return h;
};
/** A guardian's fighter (a made-up humanoid of 200 HP and no specials), of the fields given, wearing no ward. */
const aGuardian = (over: Record<string, unknown> = {}): AFighterInAPersonalCombat => {
  const g = pcMonsterCombatant({ name: 'Made-up Ogre', cat: 'humanoid', power: 'Weak', hp: 200, melee: 2, ...over });
  g.arm = null;
  return g;
};
/** A spell cast by the caster on the target, the dice pinned (a cast roll of 2 takes hold at any chance). */
const cast = (
  caster: AFighterInAPersonalCombat,
  target: AFighterInAPersonalCombat,
  spell: string | undefined,
  dice: number | number[] = 0.01,
) => {
  const narrative: NarrativeLine[] = [];
  const took = pc.pinned(dice, () => pcCastCombatSpell(tc, caster, target, spell, narrative, aFight()));
  return { took, narrative };
};
/** A guardian's power used on the foe, the dice pinned. */
const usePower = (
  actor: AFighterInAPersonalCombat,
  foe: AFighterInAPersonalCombat,
  sp: ASpecial,
  dice: number | number[] = 0.5,
) => {
  const narrative: NarrativeLine[] = [];
  pc.pinned(dice, () => {
    pcMonsterSpecial(tc, actor, foe, sp, narrative, aFight());
  });
  return narrative;
};

describe('a spell cast in a fight', () => {
  test('a spell of no name has no school: nothing is cast and nothing told', () => {
    const { took, narrative } = cast(aHero({ white: 5 }), aGuardian(), undefined);
    expect(took).toBe(false);
    expect(narrative).toEqual([]);
  });

  test("a school's limit reached: the spell isn't cast, and the line says so", () => {
    const h = aHero({ illusory: 1 }); // one spell of the school a fight at level 1
    h.castSchool['illusory'] = 1;
    const { took, narrative } = cast(h, aGuardian(), 'Invisibility');
    expect(took).toBe(false);
    expect(kinds(narrative)).toEqual(["the caster's spell limit reached this combat"]);
  });

  test('Spiritwrack: a Powerful guardian may shrug it off 25 in 100, a Legendary 40, a lesser one and a hero never', () => {
    const shrug = (target: AFighterInAPersonalCombat) => {
      cast(aHero({ white: 5 }), target, 'Spiritwrack');
      return target.status._swShrugPct;
    };
    expect(shrug(aGuardian({ power: 'Powerful' }))).toBe(25);
    expect(shrug(aGuardian({ power: 'Legendary' }))).toBe(40);
    expect(shrug(aGuardian({ power: 'Moderate' }))).toBe(0);
    expect(shrug(aHero())).toBe(0);
  });

  test("Invisibility: the foe's aim is cut by 10 and 4 a level, or by more if it already was; a NaN cut is none", () => {
    const unseen = (before: number | undefined) => {
      const h = aHero({ illusory: 3 });
      if (before !== undefined) h.status.toHitReduce = before;
      const fleeBefore = h.status.fleeBonus;
      cast(h, aGuardian(), 'Invisibility');
      return [h.status.toHitReduce, h.status.fleeBonus - fleeBefore];
    };
    expect(unseen(undefined)).toEqual([22, 30]);
    expect(unseen(30)).toEqual([30, 30]);
    expect(unseen(Number.NaN)).toEqual([22, 30]);
  });

  test('Curse halves the best of Melee, Archery and the best school (Melee first on a tie)', () => {
    const cursed = (over: { melee: number; archery: number }, school: Partial<Record<string, number>> = {}) => {
      const g = aGuardian(over);
      g.melee = over.melee;
      g.archery = over.archery;
      Object.assign(g.school, school);
      const { narrative } = cast(aHero({ necromancy: 5 }), g, 'Curse');
      const line = lineOf(narrative, "the caster's curse withers the target");
      return [g.melee, g.archery, g.school.necromancy, line && 'bestKey' in line ? line.bestKey : 'none'];
    };
    expect(cursed({ melee: 6, archery: 2 })).toEqual([3, 2, 0, 'melee']);
    expect(cursed({ melee: 2, archery: 9 })).toEqual([2, 4, 0, 'archery']);
    expect(cursed({ melee: 2, archery: 1 }, { necromancy: 7 })).toEqual([2, 1, 3, 'magic']);
    expect(cursed({ melee: 5, archery: 5 })).toEqual([2, 5, 0, 'melee']);
    expect(cursed({ melee: 1, archery: 0 })).toEqual([0, 0, 0, 'melee']);
    expect(cursed({ melee: 0, archery: 0 })).toEqual([0, 0, 0, 'none']);
  });

  test("Charm: a king's will, a mind lately swayed and a will that resists it turn it; else the caster's flight doubles", () => {
    const charmed = (over: Record<string, unknown>, dice: number | number[] = 0.01) => {
      const caster = aHero({ psychic: 5 });
      const target = aHero({}, { over });
      const { narrative } = cast(caster, target, 'Charm', dice);
      const turned = kinds(narrative).find((k) => k.startsWith("the caster's charm"));
      const resisted = lineOf(narrative, "the caster's charm breaks against the target's will");
      return [
        turned ?? 'charmed',
        caster.status.fleeDoubled ?? false,
        resisted && 'targetRefCharmResist' in resisted ? resisted.targetRefCharmResist : null,
      ];
    };
    expect(charmed({ isKing: true })).toEqual(["the caster's charm washes over a crowned will", false, null]);
    expect(charmed({ isKing: false, _charmImmuneTurn: tc.G.turn })).toEqual([
      "the caster's charm slides off a mind lately swayed",
      false,
      null,
    ]);
    expect(charmed({ isKing: false, _charmImmuneTurn: tc.G.turn - 1 })).toEqual(['charmed', true, null]);
    expect(charmed({ isKing: false, _charmResist: 100 })).toEqual([
      "the caster's charm breaks against the target's will",
      false,
      100,
    ]);
    // a cast roll of 2, then a will's roll of 100: a will of 50 doesn't hold, one of 100 does
    expect(charmed({ isKing: false, _charmResist: 50 }, [0.01, 0.995])).toEqual(['charmed', true, null]);
    expect(charmed({ isKing: false, _charmResist: 100 }, [0.01, 0.995])).toEqual([
      "the caster's charm breaks against the target's will",
      false,
      100,
    ]);
    expect(charmed({ isKing: false, _charmResist: 0 })).toEqual(['charmed', true, null]);
    // a guardian has no crown, no swayed mind and no will against it
    const caster = aHero({ psychic: 5 });
    const { narrative } = cast(caster, aGuardian(), 'Charm');
    expect(kinds(narrative)).toContain("the caster charms the target's wits");
    expect(caster.status.fleeDoubled).toBe(true);
  });
});

describe("a guardian's power", () => {
  test("an older save's damage range (no weight, no words) is rolled by the dice; a range of nothing strikes no blow", () => {
    const struck = (dmg: number[], dice: number) => {
      const foe = aHero();
      const narrative = usePower(aGuardian(), foe, { name: 'Old Claw', dmg }, dice);
      return [40 - foe.hp, kinds(narrative).includes('a power tears into the foe')];
    };
    expect(struck([2, 6], 0)).toEqual([2, true]);
    expect(struck([2, 6], 0.99)).toEqual([6, true]);
    expect(struck([0, 3], 0.99)).toEqual([3, true]);
    expect(struck([0, 0], 0.99)).toEqual([0, false]);
  });

  test('a power that raises his Melee adds its number to it', () => {
    const g = aGuardian({ melee: 3 });
    g.melee = 3;
    const narrative = usePower(g, aHero(), { name: 'Battle Rage', dmgW: 0, effect: 'gains +2 melee' });
    expect(g.melee).toBe(5);
    expect(lineOf(narrative, "the guardian's melee surges")).toMatchObject({ actorMelee: 5 });
  });

  test('a power that kills outright: at 100 in 100 the foe falls, at 0 in 100 never', () => {
    const killed = (effect: string) => {
      const foe = aHero();
      const narrative = usePower(aGuardian(), foe, { name: 'Death Gaze', dmgW: 0, effect }, 0);
      return [foe.hp, kinds(narrative).includes('the foe is struck down where they stand')];
    };
    expect(killed('100% instant kill')).toEqual([0, true]);
    expect(killed('0% instant kill')).toEqual([40, false]);
  });
});

describe('the fight', () => {
  test("a Druid's beast ward: Druid 4 against a beast, halved by a curse on his Druid, or gone with his Druid", () => {
    const ward = (over: Record<string, unknown>) => {
      const h = aHero({ druid: 4 }, { over });
      const beast = aGuardian({ cat: 'beast' });
      pc.pinned(0.5, () => resolvePersonalCombat(tc, h, beast, { maxRounds: 1 }));
      return h.druidBeastWard;
    };
    expect(ward({})).toBe(4);
    expect(ward({ _curseHalveStat: 'druid' })).toBe(0); // 2: below the ward's 3
    expect(ward({ _curseHalveStat: 'melee' })).toBe(4);
    expect(ward({ _druidNegated: true })).toBe(0);
  });

  test('a Mirror Shard halves the chance to see through the illusion (5 for a guardian of no Melee, then 2.5)', () => {
    const disbelief = (items: Item[]) => {
      const h = aHero({ illusory: 5 }, { items, tactics: ['CA:Mirror Image', 'ME', 'ME', 'ME'] });
      const g = aGuardian({ melee: 0, hp: 500 });
      g.melee = 0;
      const res = pc.pinned(0.01, () => resolvePersonalCombat(tc, h, g, { maxRounds: 3 }));
      const line = lineOf(res.narrative, 'the victim sees through the illusion');
      return line && 'disbelief' in line ? line.disbelief : null;
    };
    expect(disbelief([])).toBe(5);
    expect(disbelief([worn('Mirror Shard')])).toBe(2.5);
  });
});
