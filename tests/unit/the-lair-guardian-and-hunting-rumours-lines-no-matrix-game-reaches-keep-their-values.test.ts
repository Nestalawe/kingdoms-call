// The lair guardian and Hunting Rumours lines no game of the balance matrix reaches keep their values (plan P1-10b14).
// The lines P1-10b14 changed to free personal-combat/lair-guardians-and-the-odds.ts of the ts-nocheck line that no game
// reaches, or reaches only in part, give the value each gave before (worked out by the rules as the file had them,
// with its ts-nocheck line):
// - a guardian's traits: one of no name is read by its kind alone; a speed the table lacks, or none, closes in 3;
// - a guardian taking up its lair's hoard: a lair of no hoard list (a ritual site), an item of no effect, and a skill
//   item of no bonus, 0 or NaN, which adds nothing;
// - the band of the odds past the last band's bound (101 or more, NaN): the last band;
// - the Hunting Rumours' odds: none for no hero, no lair or a lair of no guardian; a hero of no realm measured with no
//   realm's record touched; a realm that has learned no weakness keeps an empty record; a guardian of no full HP
//   fights the copies at his HP, or 10 when he has none or 0; the hero's copies carry an id no hero carries;
// - a hero's fight at a lair: a lair of no guardian fought as a creature of 10 HP and no grade; a guardian of no full
//   HP described by his HP (or 10), or of no HP by his full HP, and healed to it when he isn't beaten; and the rout's
//   dropped item: a battle's copy of a hero (the real record drops it, the copy loses each of its name and tier and
//   keeps a gap in its list), a hero of no id (he drops it himself), a hero of no items (nothing to drop) and a lair of
//   no hoard list (the item starts one).
// Level 1 (unit): each is a function on a staged guardian, lair or hero, called on the engine's modules (tests/lib/
// personal-combat.ts, for the turn's context), the dice pinned with kcRng.use (pc.pinned); the fight itself stands in
// where only its end matters (a spy on resolvePersonalCombat's module), and a spy on the guardian's builder reads what
// it was given. A static check can't run them, and no game reaches these lines.
import { afterEach, describe, expect, test, vi } from 'vitest';
import { clone, personalCombatEngine } from '../lib/personal-combat.ts';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';
import type { TurnContext } from '../../src/engine/turn/context.ts';
import type { Character, Item } from '../../src/schemas/saved-game-state.ts';
import type { AFighterInAPersonalCombat } from '../../src/engine/personal-combat/helpers.ts';

const pc = await personalCombatEngine();
/** The turn's context the engine made for this world (the test library's type names only the fields it reads). */
const tc = pc.turnContext as unknown as TurnContext;
const lair = await import('../../src/engine/personal-combat/lair-guardians-and-the-odds.ts');
const builders = await import('../../src/engine/personal-combat/speed-encounter-plans-and-combatants.ts');
const theFight = await import('../../src/engine/personal-combat/resolve-personal-combat.ts');
const { monsterTraits, pcBuildGuardian, rumourOddsBand, RUMOUR_ODDS_BANDS, simulateLairOdds, resolveEncounter } = lair;

type ALair = Parameters<typeof pcBuildGuardian>[1];
type AGuardian = Parameters<typeof pcBuildGuardian>[2];
type ALairFoughtAt = Parameters<typeof resolveEncounter>[2];

afterEach(() => {
  vi.restoreAllMocks();
});

/** Each line's kind. */
const kinds = (narrative: readonly NarrativeLine[]) => narrative.map((l) => (typeof l === 'string' ? l : l.kind));
/** The line of the kind given (its fact), or undefined. */
const lineOf = (narrative: readonly NarrativeLine[], kind: string) =>
  narrative.find((l): l is Exclude<NarrativeLine, string> => typeof l !== 'string' && l.kind === kind);
/** A made-up item of the effect given, as a hoard or a pack holds it (an id, a tier). */
const anItem = (name: string, effect: Partial<Item['effect']> | undefined, tier = 1): Item =>
  ({ name, desc: '', lore: '', tier, id: 9000 + tier, ...(effect === undefined ? {} : { effect }) }) as Item;
/** A made-up guardian of a kind that may wield anything (a humanoid of 20 HP, Melee 2), with the fields given. */
const aGuardian = (over: Record<string, unknown> = {}): AGuardian => ({
  name: 'Made-up Ogre',
  cat: 'humanoid',
  power: 'Weak',
  hp: 20,
  melee: 2,
  ...over,
});
/** A lair whose hoard is stocked already (no draw), of the guardian and hoard given. */
const aLair = (monster: AGuardian | null, hoardItems: Item[] = []): ALairFoughtAt => ({
  name: 'Made-up Ruin',
  monster,
  hoardItems,
  _hoardV2: true,
});
/** A living hero of a realm in the world (a copy), with the fields given. */
const aHero = (over: Record<string, unknown> = {}): Character =>
  ({ ...clone(pc.base), ...over }) as unknown as Character;

describe('a guardian’s traits', () => {
  test('a guardian of no name is read by its kind alone', () => {
    expect(monsterTraits({ cat: 'humanoid' })).toEqual({
      mods: { melee: 1, archery: 1, spell: 1 },
      pacifiable: false,
      closeRounds: 3,
    });
    expect(monsterTraits({ cat: 'beast' }).mods).toEqual({ melee: 1.1, archery: 1, spell: 1 });
  });
  test('a speed the table lacks, or none, closes in 3 rounds; its own speeds in 2, 3 and 4', () => {
    const closes = (speed: string | undefined) => monsterTraits({ cat: 'humanoid', speed }).closeRounds;
    expect([undefined, '', 'glacial', 'fast', 'medium', 'slow'].map(closes)).toEqual([3, 3, 3, 2, 3, 4]);
  });
});

describe('a guardian takes up its lair’s hoard', () => {
  /** The guardian built for a fight at `feature`, and the lines. */
  const built = (feature: ALair, m = aGuardian()) => {
    const narrative: NarrativeLine[] = [];
    const g = pcBuildGuardian(tc, feature, m, narrative);
    return { g, narrative };
  };
  test('a lair of no hoard list (a ritual site, which is never stocked): nothing wielded, no line', () => {
    const { g, narrative } = built({ name: 'Made-up Circle', ritualSite: true });
    expect([g.wielded, g.combatItems, g.melee]).toEqual([undefined, undefined, 2]);
    expect(narrative).toEqual([]);
  });
  test('an item of no effect is wielded and does nothing', () => {
    const trinket = anItem('A made-up trinket', undefined);
    const { g, narrative } = built(aLair(null, [trinket]));
    expect([g.wielded, g.combatItems, g.melee, g.archery, g.maxHp, g._hpItemBonus]).toEqual([
      [trinket],
      [],
      2,
      0,
      20,
      0,
    ]);
    expect(kinds(narrative)).toEqual(["the guardian has turned the hoard's magic to its own use"]);
  });
  test.each([
    ['no', undefined],
    ['0', 0],
    ['NaN', NaN],
  ])('a Melee or Archery item of %s bonus adds nothing', (_, bonus) => {
    const blade = anItem('A made-up blade', { stat: 'melee', ...(bonus === undefined ? {} : { bonus }) });
    const bow = anItem('A made-up bow', { stat: 'archery', ...(bonus === undefined ? {} : { bonus }) });
    const { g } = built(aLair(null, [blade, bow]));
    expect([g.melee, g.archery]).toEqual([2, 0]);
    expect(built(aLair(null, [anItem('A made-up blade', { stat: 'melee', bonus: 2 })])).g.melee).toBe(4);
  });
});

describe('the band of the odds', () => {
  test('a kill rate past the last band’s bound (101 or more, or NaN) reads the last band', () => {
    const last = RUMOUR_ODDS_BANDS[RUMOUR_ODDS_BANDS.length - 1];
    expect([rumourOddsBand(101), rumourOddsBand(150), rumourOddsBand(NaN)]).toEqual([last, last, last]);
    expect(rumourOddsBand(100)).toBe(last);
    expect(rumourOddsBand(0)).toBe(RUMOUR_ODDS_BANDS[0]);
  });
});

describe('the Hunting Rumours’ odds', () => {
  test('no hero, no lair, or a lair of no guardian: no odds', () => {
    const f = aLair(aGuardian());
    expect([
      simulateLairOdds(tc, null, f, 1),
      simulateLairOdds(tc, undefined, f, 1),
      simulateLairOdds(tc, aHero(), null, 1),
      simulateLairOdds(tc, aHero(), undefined, 1),
      simulateLairOdds(tc, aHero(), aLair(null), 1),
      simulateLairOdds(tc, aHero(), { name: 'Made-up Ruin' }, 1),
    ]).toEqual([null, null, null, null, null, null]);
  });
  test('a hero of no realm is measured, and no realm’s record of weaknesses is touched', () => {
    const before = JSON.stringify(tc.G.players);
    const odds = pc.pinned(0.5, () => simulateLairOdds(tc, aHero({ player: null }), aLair(aGuardian()), 2));
    expect(odds?.fights).toBe(2);
    expect(JSON.stringify(tc.G.players)).toBe(before);
  });
  test('a realm that has learned no weakness keeps an empty record of them', () => {
    const hero = aHero();
    const realm = tc.G.players[Number(hero.player)];
    if (!realm) throw new Error('the hero has no realm');
    const had = realm._knownWeak;
    delete realm._knownWeak;
    try {
      pc.pinned(0.5, () => simulateLairOdds(tc, hero, aLair(aGuardian()), 2));
      expect(realm._knownWeak).toEqual({});
    } finally {
      if (had === undefined) delete realm._knownWeak;
      else realm._knownWeak = had;
    }
  });
  test('a guardian of no full HP fights the copies at his HP, or 10 when he has none or 0; the lair’s is untouched', () => {
    const build = builders.pcMonsterCombatant;
    const seen: { hp?: number | undefined; _hpFull?: number | null | undefined }[] = [];
    vi.spyOn(builders, 'pcMonsterCombatant').mockImplementation((m) => {
      seen.push({ hp: m.hp, _hpFull: m._hpFull });
      return build(m);
    });
    const guardians = [
      aGuardian({ hp: 14 }),
      aGuardian({ hp: 0 }),
      aGuardian({ hp: undefined }),
      aGuardian({ hp: 6, _hpFull: 9 }),
    ];
    for (const g of guardians) pc.pinned(0.5, () => simulateLairOdds(tc, aHero(), aLair(g), 1));
    expect(seen).toEqual([
      { hp: 14, _hpFull: 14 },
      { hp: 10, _hpFull: 10 },
      { hp: 10, _hpFull: 10 },
      { hp: 9, _hpFull: 9 },
    ]);
    expect(guardians.map((g) => [g.hp, g._hpFull])).toEqual([
      [14, undefined],
      [0, undefined],
      [undefined, undefined],
      [6, 9],
    ]);
  });
  test('the hero’s copies each carry an id no hero carries, and the hero himself is untouched', () => {
    const build = builders.pcCharCombatant;
    const ids: unknown[] = [];
    vi.spyOn(builders, 'pcCharCombatant').mockImplementation((context, ch) => {
      ids.push(ch.id);
      return build(context, ch);
    });
    const hero = aHero();
    const before = JSON.stringify(hero);
    pc.pinned(0.5, () => simulateLairOdds(tc, hero, aLair(aGuardian()), 3));
    expect(ids).toEqual(['rumour_sim_0', 'rumour_sim_1', 'rumour_sim_2']);
    expect(JSON.stringify(hero)).toBe(before);
  });
});

describe('a hero’s fight at a lair', () => {
  /** The fight stands in: it ends as `end` says, the hero (the first fighter) left at `heroHp`. */
  const theFightEnds = (end: 'a draw' | 'the hero flees', heroHp: number, guardianHp: number) =>
    vi
      .spyOn(theFight, 'resolvePersonalCombat')
      .mockImplementation((_context: unknown, A: AFighterInAPersonalCombat) => ({
        winner: null,
        loser: null,
        fledBy: end === 'the hero flees' ? A : null,
        parley: false,
        stoleBy: null,
        aHp: heroHp,
        bHp: guardianHp,
        narrative: [],
      }));
  /** The hero's fight at `feature`, the dice pinned at 0 (a dropped item: the roll 1, the first item): the lines. */
  const fought = (c: Character, feature: ALairFoughtAt) =>
    pc.pinned(0, () => resolveEncounter(tc, c, feature, { name: 'Made-up Vale' }, ['ME'], null, () => 0, null))
      .narrative;

  test('a lair of no guardian is fought as a creature of 10 HP and no grade', () => {
    theFightEnds('a draw', 10, 10);
    const narrative = fought(aHero(), aLair(null));
    expect(lineOf(narrative, 'within lurks the guardian blocking the path')).toEqual({
      kind: 'within lurks the guardian blocking the path',
      mPower: '',
      mName: 'creature',
      mKind: { cat: undefined, name: 'creature' },
      monsterPower: '',
    });
    expect(kinds(narrative)).not.toContain('the guardian is already wounded by someone before');
  });
  test('a guardian of no grade is told as one of none', () => {
    theFightEnds('a draw', 10, 20);
    const narrative = fought(aHero(), aLair(aGuardian({ power: undefined })));
    expect(lineOf(narrative, 'within lurks the guardian blocking the path')).toMatchObject({ monsterPower: '' });
  });
  test('a guardian of no full HP is described by his HP, or 10 when he has none or 0; of no HP, by his full HP', () => {
    const wounded = (g: AGuardian) => {
      theFightEnds('a draw', 10, 0);
      return lineOf(fought(aHero(), aLair(g)), 'the guardian is already wounded by someone before');
    };
    expect(wounded(aGuardian({ hp: 7 }))).toBeUndefined();
    expect(wounded(aGuardian({ hp: 0 }))).toMatchObject({ monHp: 0, monFullHp: 10 });
    expect(wounded(aGuardian({ hp: undefined, _hpFull: 12 }))).toBeUndefined();
    expect(wounded(aGuardian({ hp: 5, _hpFull: 12 }))).toMatchObject({ monHp: 5, monFullHp: 12 });
  });
  test('a guardian of no full HP who is not beaten heals to his HP, or 10 when he has none or 0', () => {
    const healed = (g: AGuardian) => {
      theFightEnds('a draw', 10, 1);
      fought(aHero(), aLair(g));
      return [g.hp, g._hpFull];
    };
    expect([healed(aGuardian({ hp: 7 })), healed(aGuardian({ hp: 0 })), healed(aGuardian({ hp: undefined }))]).toEqual([
      [7, 7],
      [10, 10],
      [10, 10],
    ]);
  });

  describe('the rout: a hero who flees may drop an item into the hoard', () => {
    /** A hero of the world with the items given (his real record, in the world's list), and a lair. */
    const aRealHero = (items: Item[]) => {
      const real = tc.G.characters.find((c) => c.alive && c.player != null);
      if (!real) throw new Error('the world has no living hero of a realm');
      real.items = items;
      return real;
    };
    test('a battle’s copy of a hero: the real record drops it, and the copy loses each of its name and tier, keeping a gap in its list', () => {
      const ring = anItem('A made-up ring', { stat: 'melee', bonus: 1 }, 2);
      const sameRing = anItem('A made-up ring', { stat: 'melee', bonus: 1 }, 2);
      const lesserRing = anItem('A made-up ring', { stat: 'melee', bonus: 1 }, 1);
      const real = aRealHero([ring]);
      const copy = { ...real, items: [ring, sameRing, lesserRing, null] } as unknown as Character;
      const feature = aLair(aGuardian());
      theFightEnds('the hero flees', 5, 20);
      const narrative = fought(copy, feature);
      expect(kinds(narrative)).toContain('in the rout the hero drops an item into the hoard');
      expect(real.items).toEqual([]);
      expect(copy.items).toEqual([lesserRing, null]);
      expect(feature.hoardItems).toEqual([ring]);
    });
    test('a hero of no id drops it himself', () => {
      const ring = anItem('A made-up ring', { stat: 'melee', bonus: 1 }, 2);
      const real = aRealHero([anItem('A made-up amulet', { stat: 'melee', bonus: 1 }, 3)]);
      const nobody = { ...real, id: undefined, items: [ring] } as unknown as Character;
      const feature = aLair(aGuardian());
      theFightEnds('the hero flees', 5, 20);
      fought(nobody, feature);
      expect([nobody.items, feature.hoardItems, real.items.length]).toEqual([[], [ring], 1]);
    });
    test('a hero of no items has nothing to drop', () => {
      const feature = aLair(aGuardian());
      const empty = aHero({ id: undefined, items: undefined });
      theFightEnds('the hero flees', 5, 20);
      const narrative = fought(empty, feature);
      expect(kinds(narrative)).toContain('the hero turns and flees from the guardian');
      expect(kinds(narrative)).not.toContain('the runner scrambles clear with a chance of dropping something');
      expect(feature.hoardItems).toEqual([]);
    });
    test('a lair of no hoard list (a ritual site) starts one with the dropped item', () => {
      const ring = anItem('A made-up ring', { stat: 'melee', bonus: 1 }, 2);
      const hero = aHero({ id: undefined, items: [ring] });
      const site: ALairFoughtAt = { name: 'Made-up Circle', monster: aGuardian(), ritualSite: true };
      theFightEnds('the hero flees', 5, 20);
      fought(hero, site);
      expect(site.hoardItems).toEqual([ring]);
    });
  });
});
