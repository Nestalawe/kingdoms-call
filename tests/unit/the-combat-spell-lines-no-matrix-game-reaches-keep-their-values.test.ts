// The combat spell and guardian power lines no game of the balance matrix reaches keep their values (plan P1-10b16).
// The lines P1-10b16 changed to free personal-combat/combat-spells-and-guardian-abilities.ts and
// personal-combat/resolve-personal-combat.ts of the ts-nocheck line that no game reaches, or reaches only in part, give
// the value each gave before (worked out by the rules as the files had them, with their ts-nocheck line):
// - a spell cast in a fight: one of no name (no school, nothing told), a school's limit reached, Spiritwrack's shrug
//   by the guardian's grade (none for a hero), Invisibility's cut to the foe's aim (the larger of the two, a NaN read
//   as none), Curse on the best of Melee, Archery and the best school, and Charm against a king, a mind lately swayed,
//   a will that resists it (or doesn't) and a guardian, and (the mutation session of 2026-10-31) the dice it draws: no
//   die for the will of a foe never charmed;
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
//   on Hand of Death's bite (the items' registry), and its chance missed;
// - since P1-19x, the other combat spells, through the spells' registry, where no game meets them, or meets them only in
//   part: Control Undead's grip on the undead (its rounds counted to 5, its line, the caster's name for the grip a ward
//   turns) and its line for the living, Invisibility's line and its +15% to a thief's steal (pcAct), Mirror Image cast
//   with no fight (a forecast's bare cast) and again while an image fights, the phantom it conjures (its share of the
//   target's health now, its rounds, its plan with the Mirror Image casts stripped), and the chance a hero sees through
//   the image: 4% a skill level together, between 2% and 90%.
// Level 1 (unit): each is a function on staged fighters, called on the engine's modules (tests/lib/personal-combat.ts,
// for the turn's context), the dice pinned with kcRng.use (pc.pinned). A static check can't run them, and no game
// reaches these lines.
import { describe, expect, test } from 'vitest';
import { clone, personalCombatEngine } from '../lib/personal-combat.ts';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';
import type { TurnContext } from '../../src/engine/turn/context.ts';
import type { Character, Item } from '../../src/schemas/saved-game-state.ts';
import type { AFighterInAPersonalCombat } from '../../src/engine/personal-combat/helpers.ts';
import type { AMirrorImageInAFight } from '../../src/engine/personal-combat/combat-spells-and-guardian-abilities.ts';

const pc = await personalCombatEngine();
/** The turn's context the engine made for this world (the test library's type names only the fields it reads). */
const tc = pc.turnContext as unknown as TurnContext;
const { pcCastCombatSpell, pcMonsterSpecial } =
  await import('../../src/engine/personal-combat/combat-spells-and-guardian-abilities.ts');
const { pcCharCombatant, pcMonsterCombatant } =
  await import('../../src/engine/personal-combat/speed-encounter-plans-and-combatants.ts');
const { pcAct } = await import('../../src/engine/personal-combat/tactics-combat-items-and-actions.ts');
const { resolvePersonalCombat } = await import('../../src/engine/personal-combat/resolve-personal-combat.ts');
const { ALL_MAGIC_ITEMS_P } = await import('../../src/content/kingdoms-call-data.ts');
// the engine's dice, the fresh module the functions above draw from (to count the dice a spell draws)
const { kcRng } = await import('../../src/engine/rng.ts');
// since P1-12d19 a daze's and a lingering harm's source is a record; the words, read through the prose
const { theWordsOfTheSourceOfADaze, theWordsOfTheSourceOfALingeringHarm } =
  await import('../../src/views/prose/the-words-of-a-personal-combats-lines.ts');

type ASpecial = Parameters<typeof pcMonsterSpecial>[3];

/** Each line's kind. */
const kinds = (narrative: readonly NarrativeLine[]) => narrative.map((l) => (typeof l === 'string' ? l : l.kind));
/** The line of the kind given (its fact), or undefined. */
const lineOf = (narrative: readonly NarrativeLine[], kind: string) =>
  narrative.find((l): l is Exclude<NarrativeLine, string> => typeof l !== 'string' && l.kind === kind);
/** A fight's state as a spell finds it, at melee range. */
const aFight = () => ({ fledBy: null, parley: false, stoleBy: null, range: 'melee', mirror: null, feature: null });
/** A fight's state as a spell finds it, with the Mirror Image given fighting (or none). */
const aFightWith = (mirror: AMirrorImageInAFight | null) => ({ ...aFight(), mirror });
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

  test("Charm on a foe never charmed (a will of 0) draws the cast's die alone; a will of 50 draws one more for it", () => {
    /** The dice the Charm draws, every one a 2 (a cast roll of 2 takes hold), and whether the caster's flight doubles.
     *  The caster has had his experience roll of this fight already, so a cast that takes hold draws no die for it. */
    const draws = (charmResist: number) => {
      const caster = aHero({ psychic: 5 });
      caster._xpGained = true;
      const target = aHero({}, { over: { isKing: false, _charmResist: charmResist } });
      let n = 0;
      const real = kcRng.use(() => {
        n++;
        return 0.01;
      });
      try {
        pcCastCombatSpell(tc, caster, target, 'Charm', [], aFight());
      } finally {
        kcRng.use(real);
      }
      return [n, caster.status.fleeDoubled ?? false];
    };
    expect(draws(0)).toEqual([1, true]);
    expect(draws(50)).toEqual([2, false]);
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
    expect(g.status.dot.map((d) => [d.dmg, d.rounds, theWordsOfTheSourceOfALingeringHarm(d.source)])).toEqual([
      [10, 3, 'Fireball burns'],
    ]);
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

describe("the other combat spells (plan P1-19x: the spells' registry)", () => {
  test('Control Undead cast at Necromancy 7 (set on the fighter) on an undead guardian: gripped 5 rounds, and the line says 5', () => {
    const h = aHero({ necromancy: 5 });
    h.school.necromancy = 7;
    const g = aGuardian({ cat: 'undead', isUndead: true });
    g.isUndead = true;
    const { took, narrative } = cast(h, g, 'Control Undead');
    expect(took).toBe(true);
    expect(g.status.stun).toBe(5);
    expect(lineOf(narrative, 'the caster seizes the undead target')).toEqual({
      kind: 'the caster seizes the undead target',
      casterName: h.name,
      targetName: 'Made-up Ogre',
      cuR: 5,
    });
  });

  test("Control Undead on an undead guardian who wards off a stun: the ward's line names the caster's grip, and no seizing", () => {
    const h = aHero({ necromancy: 2 });
    const g = aGuardian({ isUndead: true });
    g.isUndead = true;
    g.arm = { stunImmune: true } as unknown as AFighterInAPersonalCombat['arm'];
    const { narrative } = cast(h, g, 'Control Undead');
    expect(g.status.stun).toBe(0);
    const turned = lineOf(narrative, 'the target cannot be held');
    expect(turned?.kind === 'the target cannot be held' && theWordsOfTheSourceOfADaze(turned.what)).toBe(
      `${h.name}'s grip`,
    );
    expect(kinds(narrative)).not.toContain('the caster seizes the undead target');
  });

  test('Control Undead on the living: no grip, and the line names the target alone', () => {
    const g = aGuardian();
    const { took, narrative } = cast(aHero({ necromancy: 5 }), g, 'Control Undead');
    expect(took).toBe(true);
    expect(g.status.stun).toBe(0);
    expect(lineOf(narrative, 'control undead has no hold over the living')).toEqual({
      kind: 'control undead has no hold over the living',
      targetName: 'Made-up Ogre',
    });
  });

  test('Control Undead on a fiend that is not undead: no grip, as on the living', () => {
    const g = aGuardian({ cat: 'fiend' });
    const { narrative } = cast(aHero({ necromancy: 5 }), g, 'Control Undead');
    expect(g.status.stun).toBe(0);
    expect(kinds(narrative)).toContain('control undead has no hold over the living');
  });

  test("Curse's lines: the skill withered and the level it is left at, or no ability to wither", () => {
    const h = aHero({ necromancy: 5 });
    const g = aGuardian();
    g.melee = 2;
    g.archery = 7;
    const withered = cast(h, g, 'Curse').narrative;
    expect(lineOf(withered, "the caster's curse withers the target")).toEqual({
      kind: "the caster's curse withers the target",
      casterName: h.name,
      targetName: 'Made-up Ogre',
      bestKey: 'archery',
      bestSchool: 'white',
      bestAbilityLevel: 3,
    });
    const none = aGuardian();
    none.melee = 0;
    none.archery = 0;
    const again = aHero({ necromancy: 5 }); // a spell is cast once a fight
    expect(lineOf(cast(again, none, 'Curse').narrative, "the caster's curse finds no ability")).toEqual({
      kind: "the caster's curse finds no ability",
      casterName: again.name,
      targetName: 'Made-up Ogre',
    });
  });

  test("Invisibility at Illusory 3: the line gives the 22% it cuts the foes' aim by", () => {
    const h = aHero({ illusory: 3 });
    const { narrative } = cast(h, aGuardian(), 'Invisibility');
    expect(lineOf(narrative, 'the caster fades from sight')).toEqual({
      kind: 'the caster fades from sight',
      casterName: h.name,
      invPct: 22,
    });
  });

  test('Invisibility adds its 30% to a flight bonus the caster already has', () => {
    const h = aHero({ illusory: 1 });
    h.status.fleeBonus = 5;
    cast(h, aGuardian(), 'Invisibility');
    expect(h.status.fleeBonus).toBe(35);
  });

  test("Invisibility adds 15% to a thief's steal in the fight he cast it in, and nothing before", () => {
    const steal = (spellsCast: string[]) => {
      const h = aHero({ thief: 1 }, { tactics: ['ST'] });
      h.castSpells.push(...spellsCast);
      const narrative: NarrativeLine[] = [];
      pc.pinned(0.99, () => {
        pcAct(tc, h, aGuardian(), narrative, aFight());
      });
      const line = lineOf(narrative, "a fighter's theft is noticed");
      return line && 'chance' in line ? line.chance : null;
    };
    const without = steal([]);
    expect(typeof without).toBe('number');
    expect(steal(['Invisibility'])).toBe(Number(without) + 15);
    expect(steal(['Fireball'])).toBe(without);
  });

  test("Mirror Image cast with no fight (a forecast's bare cast): the line alone", () => {
    const h = aHero({ illusory: 5 });
    const narrative: NarrativeLine[] = [];
    const took = pc.pinned(0.01, () => pcCastCombatSpell(tc, h, aGuardian(), 'Mirror Image', narrative, null));
    expect(took).toBe(true);
    expect(lineOf(narrative, 'the caster conjures a mirror image')).toEqual({
      kind: 'the caster conjures a mirror image',
      casterName: h.name,
    });
  });

  test('Mirror Image cast again while an image fights: both images vanish, and the line says so', () => {
    const h = aHero({ illusory: 5 });
    const g = aGuardian();
    const fight = aFightWith({ caster: h, victim: g, phantasm: g, life: 2 });
    const narrative: NarrativeLine[] = [];
    pc.pinned(0.01, () => pcCastCombatSpell(tc, h, g, 'Mirror Image', narrative, fight));
    expect(fight.mirror).toBeNull();
    expect(lineOf(narrative, 'the caster weaves a second mirror image')).toEqual({
      kind: 'the caster weaves a second mirror image',
      casterName: h.name,
    });
    expect(kinds(narrative)).not.toContain('the caster conjures a phantom of the target');
  });

  test("Mirror Image's phantom: 40% of the target's health now, 3 rounds, his plan with its Mirror Image casts stripped", () => {
    const conjured = (hp: number, tactics: string[] | null) => {
      const h = aHero({ illusory: 5 });
      const g = aGuardian({ hp: 200 });
      g.hp = hp;
      (g as unknown as { tactics: string[] | null }).tactics = tactics;
      const fight = aFightWith(null);
      const narrative: NarrativeLine[] = [];
      pc.pinned(0.01, () => pcCastCombatSpell(tc, h, g, 'Mirror Image', narrative, fight));
      const m = fight.mirror;
      return {
        image: m && [m.phantasm.kind, m.phantasm.name, m.phantasm.hp, m.phantasm.maxHp, m.phantasm.tactics, m.life],
        theSame: m && [m.caster === h, m.victim === g, m.phantasm.ref === g.ref, m.phantasm.status !== g.status],
        line: lineOf(narrative, 'the caster conjures a phantom of the target'),
        casterName: h.name,
      };
    };
    const a = conjured(37, ['CA:Mirror Image', 'ME', 'cast:mirror  IMAGE', 'FI']);
    expect(a.image).toEqual(['phantasm', "Made-up Ogre's mirror image", 15, 15, ['ME', 'FI'], 3]);
    expect(a.theSame).toEqual([true, true, true, true]);
    expect(a.line).toEqual({
      kind: 'the caster conjures a phantom of the target',
      casterName: a.casterName,
      targetName: 'Made-up Ogre',
      targetName2: 'Made-up Ogre',
      casterName2: a.casterName,
    });
    expect(conjured(1, ['CA:Mirror Image']).image).toEqual([
      'phantasm',
      "Made-up Ogre's mirror image",
      1,
      1,
      ['ME'],
      3,
    ]);
    expect(conjured(10, null).image?.[4]).toEqual(['ME']);
  });

  test('a hero sees through a Mirror Image at 4% for each of his skill levels together, between 2% and 90%', () => {
    const disbelief = (skills: Record<string, number>) => {
      const h = aHero({ illusory: 5 }, { tactics: ['CA:Mirror Image', 'ME', 'ME', 'ME'] });
      const victim = aHero({}, { over: { skills } });
      victim.hp = victim.maxHp = 500;
      const res = pc.pinned(0.01, () => resolvePersonalCombat(tc, h, victim, { maxRounds: 3 }));
      const line = lineOf(res.narrative, 'the victim sees through the illusion');
      return line && 'disbelief' in line ? line.disbelief : null;
    };
    expect(disbelief({ melee: 2, archery: 1, white: 3 })).toBe(24);
    expect(disbelief({ melee: 9, archery: 9, white: 9, thief: 9 })).toBe(90);
    expect(disbelief({})).toBe(2);
  });

  test('a guardian sees through a Mirror Image at 5% and 3% for each level of his Melee', () => {
    const h = aHero({ illusory: 5 }, { tactics: ['CA:Mirror Image', 'ME', 'ME', 'ME'] });
    const g = aGuardian({ melee: 4, hp: 500 });
    g.melee = 4;
    const res = pc.pinned(0.01, () => resolvePersonalCombat(tc, h, g, { maxRounds: 3 }));
    expect(lineOf(res.narrative, 'the victim sees through the illusion')).toMatchObject({ disbelief: 17 });
  });
});
