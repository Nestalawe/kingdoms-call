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
//   illusion harder to see through;
// - since P1-19w, the combat spells that harm, through the spells' registry, where no game meets them, or meets them
//   only in a forecast: Fireball's line (its share shown rounded down, its rounds, a ward's cut; a target with no
//   status burns not, and the line gives three rounds), Spiritwrack's (its rounds, a longer silence kept, the melee
//   halved, the shrug by the grade, none for the mirror image of a Powerful guardian), a level past 5 counted to 5
//   (Lightning Bolt's dice), Holy Symbol's heal for a caster of no maximum HP (of 20), Telekinetic Storm's
//   recoil (the caster takes a quarter of the hit back, whether or not it deals any), and the Death's Finger Ring's ×1.1
//   on Hand of Death's bite (the items' registry), and its chance missed.
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

describe("the combat spells that harm (plan P1-19w: the spells' registry)", () => {
  test("Fireball at Elemental 3 on a 100 HP guardian with a 40% spell ward: 10 a round for 3, the line's 9% and 40", () => {
    const g = aGuardian({ hp: 100 });
    g.arm = { spellPct: 40 } as unknown as AFighterInAPersonalCombat['arm'];
    const { narrative } = cast(aHero({ elemental: 3 }), g, 'Fireball');
    expect(g.status.dot.map((d) => [d.dmg, d.rounds, d.label])).toEqual([[10, 3, 'Fireball burns']]);
    expect(lineOf(narrative, 'a fireball engulfs the target and will burn')).toEqual({
      kind: 'a fireball engulfs the target and will burn',
      targetName: 'Made-up Ogre',
      fbPct: 9, // (10 + 2 × 3) × 0.6 = 9.6, shown rounded down
      burnRounds: 3,
      fbWard: 40,
    });
  });

  test('Fireball on a target with no status: no burn, and the line gives its three rounds', () => {
    const g = aGuardian({ hp: 100 });
    (g as unknown as { status: undefined }).status = undefined;
    const { narrative } = cast(aHero({ elemental: 5 }), g, 'Fireball');
    expect(lineOf(narrative, 'a fireball engulfs the target and will burn')).toMatchObject({
      fbPct: 20,
      burnRounds: 3,
    });
  });

  test("Spiritwrack at White 5 on a Powerful guardian already silenced 5 rounds: kept at 5, his melee halved 3, the line's 3 and 25", () => {
    const h = aHero({ white: 5 });
    const g = aGuardian({ power: 'Powerful' });
    g.status.silenceRounds = 5;
    const { narrative } = cast(h, g, 'Spiritwrack');
    expect([g.status.silenceRounds, g.status.meleeHalvedRounds, g.status._swShrugPct]).toEqual([5, 3, 25]);
    expect(lineOf(narrative, 'the caster binds the target with spiritwrack')).toEqual({
      kind: 'the caster binds the target with spiritwrack',
      casterName: h.name,
      targetName: 'Made-up Ogre',
      swR: 3,
      shr: 25,
      targetPower: 'Powerful',
    });
  });

  test('Spiritwrack on the mirror image of a Powerful guardian: an illusion has no grade, so it never shrugs it off', () => {
    const image = aGuardian({ power: 'Powerful' });
    image.kind = 'phantasm';
    cast(aHero({ white: 5 }), image, 'Spiritwrack');
    expect(image.status._swShrugPct).toBe(0);
  });

  test('Lightning Bolt cast at Elemental 7 (a level past 5, set on the fighter): its dice counted to 5, 15 at most', () => {
    const h = aHero({ elemental: 5 });
    h.school.elemental = 7;
    const g = aGuardian();
    cast(h, g, 'Lightning Bolt', [0.01, 0.99]); // a cast roll of 2, then every die its 3
    expect(200 - g.hp).toBe(15);
  });

  test('Holy Symbol cast by a fighter of no maximum HP: he recovers 10% of 20, up to 20', () => {
    const h = aHero({ white: 1 });
    h.maxHp = 0;
    h.hp = 5;
    const { narrative } = cast(h, aGuardian(), 'Holy Symbol');
    expect(h.hp).toBe(7);
    expect(lineOf(narrative, "the light closes the caster's hurts")).toEqual({
      kind: "the light closes the caster's hurts",
      casterName: h.name,
      healed: 2,
      casterHp: 7,
    });
    const nearlyWhole = aHero({ white: 1 });
    nearlyWhole.maxHp = 0;
    nearlyWhole.hp = 19;
    cast(nearlyWhole, aGuardian(), 'Holy Symbol');
    expect(nearlyWhole.hp).toBe(20);
  });

  test('Telekinetic Storm at Psychic 5 on a 200 HP guardian: 54 dealt, and the caster takes 14 back', () => {
    const h = aHero({ psychic: 5 });
    const g = aGuardian();
    const { took, narrative } = cast(h, g, 'Telekinetic Storm');
    expect(took).toBe(true);
    expect([g.hp, h.hp]).toEqual([146, 26]);
    expect(lineOf(narrative, 'a telekinetic storm rips the target')).toEqual({
      kind: 'a telekinetic storm rips the target',
      targetName: 'Made-up Ogre',
      dealt: 54,
      casterName: h.name,
      self: 14,
      targetHp: 146,
    });
  });

  test('Telekinetic Storm turned aside by a spell block: no harm and no line, but the caster still takes 14 back', () => {
    const h = aHero({ psychic: 5 });
    const g = aGuardian();
    g.arm = { spellBlock: 100 } as unknown as AFighterInAPersonalCombat['arm'];
    const { narrative } = cast(h, g, 'Telekinetic Storm');
    expect([g.hp, h.hp]).toEqual([200, 26]);
    expect(kinds(narrative)).not.toContain('a telekinetic storm rips the target');
  });

  test("Hand of Death at Necromancy 5 on a 200 HP guardian: 80, and 88 with a Death's Finger Ring (×1.1)", () => {
    const bite = (items: Item[]) => {
      const h = aHero({ necromancy: items.length ? 4 : 5 }, { items }); // the Ring's +1: Necromancy 5 either way
      const g = aGuardian();
      const { narrative } = cast(h, g, 'Hand of Death'); // a cast roll of 2, then the grip's roll of 1 under 50
      const line: unknown = lineOf(narrative, "the hand of death claims part of the target's health");
      return [200 - g.hp, line];
    };
    expect(bite([])).toEqual([
      80,
      {
        kind: "the hand of death claims part of the target's health",
        handOfDeathBitePct: 40,
        targetName: 'Made-up Ogre',
        dealt: 80,
        targetHp: 120,
      },
    ]);
    expect(bite([worn("Death's Finger Ring")])).toEqual([
      88,
      {
        kind: "the hand of death claims part of the target's health",
        handOfDeathBitePct: 40,
        targetName: 'Made-up Ogre',
        dealt: 88,
        targetHp: 112,
      },
    ]);
  });

  test('Hand of Death at Necromancy 5 missed (a roll of 99 against 50): no harm, and the line gives the chance', () => {
    const h = aHero({ necromancy: 4 }, { items: [worn("Death's Finger Ring")] });
    const g = aGuardian();
    const { narrative } = cast(h, g, 'Hand of Death', [0.01, 0.99]);
    expect(g.hp).toBe(200);
    expect(lineOf(narrative, "the caster's hand of death fails")).toEqual({
      kind: "the caster's hand of death fails",
      casterName: h.name,
      handOfDeathChancePct: 50,
    });
  });
});
