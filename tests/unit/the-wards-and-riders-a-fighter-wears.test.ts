// The wards and riders a fighter in a personal combat wears, and how his fighter is built (plan P1-10b11, P1-10's
// Choice 2 of 2026-10-29: the cases P1-19q extends). Each ward kind merges into his table as its rule says, from an item
// and from a guardian's perk, over every ward in play (the content's items, their riders and the guardians' perks); the
// riders add or take the best; and the lines P1-10b11 changed to free personal-combat/helpers.ts and
// speed-encounter-plans-and-combatants.ts of the ts-nocheck line that no game of the balance matrix reaches keep the
// value each had before (worked out by the files as they were, with their ts-nocheck line):
// - a value the code guards, missing: no fighter, status, list, queue, function, table, ward, kind, name, item, effect,
//   hero, state, realms, heroes, hit points, maximum, tactics, speed, grade, specials or weakness; a gap in a list;
// - a number a `||` gave its fallback for, which `??` alone would keep: a 0 or a missing amount, percentage or hit
//   count (the content holds none: the saved item's schema allows one), a speed or a temper the table lacks;
// - the ward kinds no game merges (resist, which no item or perk has), and each kind merged onto one already worn.
// Since plan P1-19q each ward's and each rider's merge, and the Mithril suit, are the items' registry's
// (src/engine/rules/magic-items/what-a-fighter-wears-in-a-personal-combat.ts), reached through the same functions: the
// cases read them as before, and one more, a hero who wears the suit fights in Mithril.
// Level 1 (unit): each is a plain function on a staged fighter, ward or hero, called on the engine's modules (the
// hero's builder through tests/lib/personal-combat.ts, for the turn's context); a static check can't run them, and no
// game reaches these lines. No line here draws a die (no temper has a rage); a staged table is put back as it was.
import { describe, expect, test } from 'vitest';
import { clone, personalCombatEngine } from '../lib/personal-combat.ts';
import type { Character } from '../../src/schemas/saved-game-state.ts';
import type {
  AFighterInAPersonalCombat,
  AWardAsTheMergeReadsIt,
  TheRidersOfAnItemOrAPerk,
  TheWardsAFighterWears,
} from '../../src/engine/personal-combat/helpers.ts';

const pc = await personalCombatEngine();
const {
  applyItemMaxHp,
  grantMithrilTo,
  grantMithrilToDwarves,
  isMithril,
  mithrilQualifies,
  pcArmourMerge,
  pcArmourOf,
  pcDeferEffect,
  pcLearnWeakness,
  pcLingerRounds,
  pcPromotePending,
  pcPushDot,
  transferableItems,
} = await import('../../src/engine/personal-combat/helpers.ts');
const {
  duelStanceOf,
  ensureEncounterPlan,
  pcApplyFx,
  pcApplyItemFx,
  pcMonsterCombatant,
  pcMonsterPlan,
  pcMoveCheck,
  pcSpecialHealsSelf,
  pcSpeedOf,
} = await import('../../src/engine/personal-combat/speed-encounter-plans-and-combatants.ts');
const { ALL_MAGIC_ITEMS_P, LEGENDARY_ITEMS_P, MONSTERS_P } = await import('../../src/content/kingdoms-call-data.ts');
const { _ITEM_ALT_BASE } =
  await import('../../src/engine/rules-on-plain-values/items-slots-races-and-who-may-use-them.ts');

/** A hero of a realm in the test's world, to stage heroes from (a copy each time). */
const aHero = (): Character => {
  const hero = (pc.turnContext.G['characters'] as Character[]).find((c) => c.alive && c.player != null);
  if (!hero) throw new Error('the world has no living hero of a realm');
  return { ...clone(hero), items: [], encounterPlan: { tactics: ['ME'] } };
};
/** The hero's fighter, built by the engine with the turn's context. */
const heroFighter = (hero: unknown) => pc.call('pcCharCombatant', hero) as AFighterInAPersonalCombat;
/** A guardian's fighter of no perks, as plain as the builder makes one. */
const aPlainFighter = () => pcMonsterCombatant({ name: 'Made-up Mole', hp: 12 });

// ── The wards ──

type WardKind = 'add' | 'best' | 'flag';
/** Each ward kind's rule (pcArmourMerge): a flat amount added, the best percentage, or a flag set. */
const KINDS: Record<string, WardKind> = {
  meleeDR: 'add',
  arrowDR: 'add',
  natureDR: 'add',
  darkDR: 'add',
  thorns: 'add',
  regen: 'add',
  roundWard: 'add',
  spellPct: 'best',
  dodge: 'best',
  block: 'best',
  cap: 'best',
  secondWind: 'best',
  lowHp: 'best',
  arrowBlock: 'best',
  spellBlock: 'best',
  stunWard: 'best',
  dotWard: 'best',
  firstHit: 'flag',
  dotImmune: 'flag',
  resist: 'flag',
  stunImmune: 'flag',
};
/** The three kinds with a rule of their own: the buckler, the open guard and a ward against one school. */
const OWN_RULES = ['buckler', 'openGuard', 'schoolWard'];

/** What a table holding `before` holds after the ward `w` named `name` merges in, by the rules above. */
function merged(before: TheWardsAFighterWears, w: AWardAsTheMergeReadsIt, name: string): TheWardsAFighterWears {
  const t: TheWardsAFighterWears = { ...before, names: [...before.names] };
  const rec = t as unknown as Record<string, unknown>;
  const k = w.ward ?? '';
  const num = (key: string) => {
    const v = rec[key];
    return typeof v === 'number' ? v : 0;
  };
  if (KINDS[k] === 'add') rec[k] = num(k) + (w.amt ?? 0);
  else if (KINDS[k] === 'best') rec[k] = Math.max(num(k), w.pct ?? 0);
  else if (KINDS[k] === 'flag') rec[k] = true;
  else if (k === 'buckler') {
    t.meleeDR = num('meleeDR') + 1;
    t.dodge = Math.max(num('dodge'), 5);
  } else if (k === 'openGuard') {
    t.openGuardHits = Math.max(num('openGuardHits'), (w.hits ?? 0) || 2);
    t.openGuardPct = Math.max(num('openGuardPct'), (w.pct ?? 0) || 50);
  } else if (k === 'schoolWard') {
    if (w.school) t.schoolWard = { ...t.schoolWard, [w.school]: Math.max(t.schoolWard?.[w.school] ?? 0, w.pct ?? 0) };
  } else return t;
  if (!t.names.includes(name)) t.names.push(name);
  return t;
}
/** A table that already wears one of every ward: 3 of each amount and percentage, every flag, 3 against White. */
const aFullTable = (): TheWardsAFighterWears => {
  const t: Record<string, unknown> = { names: ['Made-up Old Plate'], schoolWard: { white: 3 } };
  for (const [k, kind] of Object.entries(KINDS)) t[k] = kind === 'flag' ? true : 3;
  t['openGuardHits'] = 3;
  t['openGuardPct'] = 3;
  return t as unknown as TheWardsAFighterWears;
};

interface AWardInPlay {
  readonly from: string;
  readonly name: string;
  readonly ward: AWardAsTheMergeReadsIt;
}
interface AnItemInPlay {
  name: string;
  effect: AWardAsTheMergeReadsIt & { stat?: string; pc?: TheRidersOfAnItemOrAPerk };
}
/** A guardian of the table, as far as its perks. */
interface AGuardianInPlay {
  passives?: { name: string; fx: TheRidersOfAnItemOrAPerk }[];
}
const ITEMS = [...ALL_MAGIC_ITEMS_P, ...LEGENDARY_ITEMS_P] as unknown as AnItemInPlay[];
const PERKS = (MONSTERS_P as unknown as AGuardianInPlay[]).flatMap((m) => m.passives ?? []);
/** Every ward in play: an armour's effect, an item's rider that is a ward, a guardian's perk that is one. */
const WARDS_IN_PLAY: AWardInPlay[] = [
  ...ITEMS.filter((it) => it.effect.stat === 'armour').map((it) => ({
    from: 'an item',
    name: it.name,
    ward: it.effect,
  })),
  ...ITEMS.filter((it) => it.effect.pc?.ward).map((it) => ({
    from: 'a rider',
    name: it.name,
    ward: it.effect.pc ?? {},
  })),
  ...PERKS.filter((p) => p.fx.ward).map((p) => ({ from: 'a perk', name: p.name, ward: p.fx })),
];

describe('each ward in play merges into a fighter’s table as its rule says', () => {
  const kindsInPlay = [...new Set(WARDS_IN_PLAY.map((w) => w.ward.ward ?? ''))].sort();

  test('the wards in play are every kind but resist, from items and perks alike', () => {
    expect(kindsInPlay).toEqual([...Object.keys(KINDS), ...OWN_RULES].filter((k) => k !== 'resist').sort());
    expect(new Set(WARDS_IN_PLAY.map((w) => w.from))).toEqual(new Set(['an item', 'a rider', 'a perk']));
  });

  test.each(kindsInPlay)('%s: from each item, rider and perk that has it, onto no table and onto one', (kind) => {
    for (const { from, name, ward } of WARDS_IN_PLAY.filter((w) => w.ward.ward === kind)) {
      const said = `${kind} from ${from}, ${name}`;
      expect(pcArmourMerge(null, ward, name), said).toEqual(merged({ names: [] }, ward, name));
      expect(pcArmourMerge(aFullTable(), ward, name), said).toEqual(merged(aFullTable(), ward, name));
    }
  });

  test.each([...Object.keys(KINDS), ...OWN_RULES])(
    '%s with no amount, percentage or hits: as a 0 (its own defaults)',
    (kind) => {
      expect(pcArmourMerge(null, { ward: kind }, 'Made-up Charm')).toEqual(
        merged({ names: [] }, { ward: kind }, 'Made-up Charm'),
      );
      expect(pcArmourMerge(aFullTable(), { ward: kind }, 'Made-up Charm')).toEqual(
        merged(aFullTable(), { ward: kind }, 'Made-up Charm'),
      );
    },
  );

  test('the buckler adds 1 to a melee ward and keeps a better dodge worn', () => {
    expect(pcArmourMerge({ names: [], meleeDR: 2, dodge: 10 }, { ward: 'buckler' }, 'Made-up Buckler')).toEqual({
      names: ['Made-up Buckler'],
      meleeDR: 3,
      dodge: 10,
    });
  });

  test('resist, which no item or perk has, sets its flag', () => {
    expect(pcArmourMerge(undefined, { ward: 'resist' }, 'Made-up Mantle')).toEqual({
      names: ['Made-up Mantle'],
      resist: true,
    });
  });

  test('the open guard: 0 hits and 0 percent take its defaults (2 hits, 50%), and a better guard worn stays', () => {
    expect(pcArmourMerge(null, { ward: 'openGuard', hits: 0, pct: 0 }, 'Made-up Buckler')).toEqual({
      names: ['Made-up Buckler'],
      openGuardHits: 2,
      openGuardPct: 50,
    });
    expect(
      pcArmourMerge({ names: [], openGuardHits: 4, openGuardPct: 70 }, { ward: 'openGuard', hits: 3 }, 'X'),
    ).toEqual({
      names: ['X'],
      openGuardHits: 4,
      openGuardPct: 70,
    });
  });

  test('a ward against a school: none without a school; the best against the same school; none of no percentage', () => {
    expect(pcArmourMerge(null, { ward: 'schoolWard', pct: 20 }, 'Made-up Sigil')).toEqual({ names: ['Made-up Sigil'] });
    const worn: TheWardsAFighterWears = { names: [], schoolWard: { white: 30, psychic: 10 } };
    const after = pcArmourMerge(worn, { ward: 'schoolWard', school: 'white', pct: 20 }, 'Made-up Sigil');
    expect(after.schoolWard).toEqual({ white: 30, psychic: 10 });
    expect(pcArmourMerge(after, { ward: 'schoolWard', school: 'psychic', pct: 25 }, 'Y').schoolWard).toEqual({
      white: 30,
      psychic: 25,
    });
    expect(pcArmourMerge(null, { ward: 'schoolWard', school: 'necromancy' }, 'Z').schoolWard).toEqual({
      necromancy: 0,
    });
  });

  test('the merge’s guards: no ward, no kind and a kind no rule names change nothing; a name counts once', () => {
    expect(pcArmourMerge(null, null, 'Made-up Plate')).toEqual({ names: [] });
    expect(pcArmourMerge(null, {}, 'Made-up Plate')).toEqual({ names: [] });
    expect(pcArmourMerge({ names: ['A'], meleeDR: 1 }, { ward: 'nonsuch', amt: 9 }, 'B')).toEqual({
      names: ['A'],
      meleeDR: 1,
    });
    expect(pcArmourMerge(null, { ward: 'meleeDR', amt: 1 }, undefined)).toEqual({ names: [], meleeDR: 1 });
    expect(pcArmourMerge(null, { ward: 'meleeDR', amt: 1 }, '')).toEqual({ names: [], meleeDR: 1 });
    const twice = pcArmourMerge(pcArmourMerge(null, { ward: 'meleeDR', amt: 1 }, 'C'), { ward: 'thorns', amt: 2 }, 'C');
    expect(twice).toEqual({ names: ['C'], meleeDR: 1, thorns: 2 });
  });
});

describe('the armour a hero wears: one table from his worn armour', () => {
  const mail = { stat: 'armour', ward: 'meleeDR', amt: 2 };

  test('no list, a gap, an item of no effect and an item that isn’t armour give no table', () => {
    expect(pcArmourOf(undefined)).toBeNull();
    expect(
      pcArmourOf([null, undefined, { name: 'Made-up Pebble' }, { name: 'Made-up Ring', effect: { stat: 'melee' } }]),
    ).toBeNull();
  });

  test('a piece and its second name count once; a gap among them is passed over', () => {
    expect(
      pcArmourOf([null, { name: 'Dwarf-Forged Hauberk', effect: mail }, { name: 'Deepstone Mail', effect: mail }]),
    ).toEqual({ names: ['Dwarf-Forged Hauberk'], meleeDR: 2 });
  });

  test('a second name that names no piece (an empty base) counts each piece by its own name', () => {
    _ITEM_ALT_BASE['Made-up Plate A'] = '';
    _ITEM_ALT_BASE['Made-up Plate B'] = '';
    try {
      expect(
        pcArmourOf([
          { name: 'Made-up Plate A', effect: mail },
          { name: 'Made-up Plate B', effect: mail },
        ]),
      ).toEqual({
        names: ['Made-up Plate A', 'Made-up Plate B'],
        meleeDR: 4,
      });
    } finally {
      delete _ITEM_ALT_BASE['Made-up Plate A'];
      delete _ITEM_ALT_BASE['Made-up Plate B'];
    }
  });
});

// ── The riders ──

describe('the riders an item or a perk gives a fighter', () => {
  test('each rider on a fighter of none: the aura, the burn, the drain, the damage and the hit bonus', () => {
    const f = aPlainFighter();
    pcApplyFx(f, { aura: 10, burn: 2, drain: 0.2, dmgBonus: 1, hitBonus: 5 }, 'Made-up Torc');
    expect([f.aura, f.burn, f.drain, f.dmgBonus, f.status.hitBonus]).toEqual([10, 2, 0.2, 1, 5]);
  });

  test('onto riders worn: the best aura and drain stay; the burn, the damage and the hit bonus add', () => {
    const f = aPlainFighter();
    f.aura = 20;
    f.drain = 0.5;
    f.burn = 1;
    f.dmgBonus = 2;
    f.status.hitBonus = 3;
    pcApplyFx(f, { aura: 10, burn: 2, drain: 0.2, dmgBonus: 1, hitBonus: 5 }, 'Made-up Torc');
    expect([f.aura, f.drain, f.burn, f.dmgBonus, f.status.hitBonus]).toEqual([20, 0.5, 3, 3, 8]);
    pcApplyFx(f, { aura: 30, drain: 0.6 }, 'Made-up Torc');
    expect([f.aura, f.drain]).toEqual([30, 0.6]);
  });

  test('a ward among the riders merges into his wards; no rider, and no fighter, change nothing', () => {
    const f = aPlainFighter();
    pcApplyFx(f, { ward: 'thorns', amt: 2, aura: 0 }, 'Made-up Thornmail');
    expect(f.arm).toEqual({ names: ['Made-up Thornmail'], thorns: 2 });
    expect(f.aura).toBeUndefined();
    const before = clone(f);
    pcApplyFx(f, null, 'X');
    pcApplyFx(f, {}, 'X');
    pcApplyFx(null, { aura: 5 }, 'X');
    expect(f).toEqual(before);
  });

  test('a hero’s items: no list, a gap and an item of no effect give no rider; a rider item’s does, once a name', () => {
    const f = aPlainFighter();
    pcApplyItemFx(f, undefined);
    pcApplyItemFx(f, [null, { name: 'Made-up Pebble' }, { name: 'Made-up Stone', effect: {} }]);
    expect(f.aura).toBeUndefined();
    const torc = { name: 'Made-up Torc', effect: { pc: { burn: 2 } } };
    pcApplyItemFx(f, [torc, torc]);
    expect(f.burn).toBe(2);
  });

  test('a hero’s item whose rider is a ward: it merges into his wards, once a name', () => {
    const f = aPlainFighter();
    const charm = { name: 'Made-up Charm', effect: { pc: { ward: 'thorns', amt: 2 } } };
    pcApplyItemFx(f, [charm, charm]);
    expect(f.arm).toEqual({ names: ['Made-up Charm'], thorns: 2 });
  });
});

// ── The fighter's build ──

describe('a guardian’s fighter', () => {
  test('a guardian staged with nothing: 10 HP, “creature”, Melee 1, no bow, medium, Weak, no weakness, no wards', () => {
    const f = pcMonsterCombatant({});
    expect([f.hp, f.maxHp, f.name, f.melee, f.archery, f.speedName, f.power, f.weak, f.arm]).toEqual([
      10,
      10,
      'creature',
      1,
      0,
      'medium',
      'Weak',
      null,
      undefined,
    ]);
    expect(f.specials).toEqual([]);
    expect(f.tactics).toEqual(Array<string>(12).fill('ME'));
  });

  test('empty words and 0s take the defaults: a name, a speed and a grade of none; 0 HP, Melee 0', () => {
    const f = pcMonsterCombatant({ name: '', speed: '', power: '', hp: 0, melee: 0, archery: 0 });
    expect([f.hp, f.name, f.melee, f.speedName, f.power]).toEqual([10, 'creature', 1, 'medium', 'Weak']);
    expect(pcMonsterCombatant({ hp: 0, _hpFull: 0 }).maxHp).toBe(0);
  });

  test('a Legendary guardian keeps his own tighter cap, and takes his grade’s where his own is looser', () => {
    const perk = (pct: number) => ({ passives: [{ name: 'Made-up Hide', desc: '', fx: { ward: 'cap', pct } }] });
    expect(pcMonsterCombatant({ power: 'Legendary', ...perk(15) }).arm?.cap).toBe(15);
    expect(pcMonsterCombatant({ power: 'Legendary', ...perk(30) }).arm?.cap).toBe(30);
    expect(pcMonsterCombatant({ power: 'Legendary' }).arm).toEqual({ names: ['its sheer bulk'], cap: 20 });
  });

  test('his perks: none; a perk of no words; one whose effect names no ward, an empty one; a kind named twice', () => {
    expect(pcMonsterCombatant({ passives: [] }).perks).toBeUndefined();
    const f = pcMonsterCombatant({
      passives: [
        { name: 'Made-up Gaze', fx: { aura: 5 } },
        { name: 'Made-up Blank', desc: 'nothing', fx: { ward: '', pct: 5 } },
        { name: 'Made-up Void', desc: 'void', fx: {} },
        { name: 'Made-up Second Gaze', desc: 'again', fx: { aura: 7 } },
      ],
    });
    expect(f.perks).toEqual([
      { name: 'Made-up Gaze', desc: '' },
      { name: 'Made-up Blank', desc: 'nothing' },
      { name: 'Made-up Void', desc: 'void' },
      { name: 'Made-up Second Gaze', desc: 'again' },
    ]);
    expect([f.passiveName, f.passiveDesc, f._perkName, f.aura]).toEqual([
      'Made-up Gaze',
      '',
      { aura: 'Made-up Gaze', ward: 'Made-up Blank' },
      7,
    ]);
    expect(pcMonsterCombatant({ passive: { name: 'Made-up Old Perk', fx: { burn: 1 } } }).passiveName).toBe(
      'Made-up Old Perk',
    );
  });

  test('his plan: no specials and no bow is twelve blows; a special that heals waits for the end', () => {
    expect(pcMonsterPlan({})).toEqual(Array<string>(12).fill('ME'));
    expect(pcSpecialHealsSelf(null)).toBe(false);
    expect(pcSpecialHealsSelf({})).toBe(false);
    expect(pcSpecialHealsSelf({ effect: null })).toBe(false);
    expect(pcSpecialHealsSelf({ effect: 'regains 5 HP' })).toBe(true);
  });

  test('his speed: none, empty, or a speed the table lacks is medium (2)', () => {
    for (const speedName of [undefined, '', 'swift'])
      expect(pcSpeedOf({ kind: 'monster', speedName, archery: 0, temper: 'None' })).toBe(2);
    expect(pcSpeedOf({ kind: 'monster', speedName: 'fast', archery: 0, temper: 'None' })).toBe(3);
  });
});

describe('a hero’s fighter', () => {
  test('a hero of no hit points enters at his maximum; at 0 he enters at 0, the unkillable wanderer at half', () => {
    const hero = aHero();
    const noHp: Partial<Character> = { ...hero, maxHp: 24 };
    delete noHp.hp;
    expect(heroFighter(noHp).hp).toBe(24);
    expect(heroFighter({ ...hero, maxHp: 24, hp: 0 }).hp).toBe(0);
    expect(heroFighter({ ...hero, maxHp: 24, hp: 0, _unkillable: true }).hp).toBe(12);
  });

  test('a maximum of 0 is 20; a plan of no tactics fights by blows; a speed bonus he carries counts', () => {
    const hero = aHero();
    const f = heroFighter({ ...hero, maxHp: 0, hp: 9, encounterPlan: {}, _speedBonus: 1 });
    expect([f.maxHp, f.hp, f.tactics, f.speedBonus]).toEqual([20, 9, ['ME'], 1]);
    expect(pcSpeedOf(f)).toBe(3);
  });

  test('an item of no effect is no suit of Mithril and no combat item', () => {
    const hero = aHero();
    const f = heroFighter({ ...hero, items: [{ name: 'Made-up Pebble', desc: '', lore: '', tier: 1, id: 900 }] });
    expect([f.mithril, f.combatItems]).toEqual([false, []]);
  });

  test('a hero who wears the Mithril suit fights in Mithril (the suit is no ward of his table)', () => {
    const hero = aHero();
    const suit = { name: 'Mithril Armour', desc: '', lore: '', tier: 1, id: 902, effect: { stat: 'mithrilArmour' } };
    expect([heroFighter({ ...hero, items: [suit] }).mithril, heroFighter({ ...hero, items: [suit] }).arm]).toEqual([
      true,
      null,
    ]);
  });

  test('keeping range: a hero of no trained archery level counts his bow’s', () => {
    const foe = { kind: 'monster' as const, speedName: 'medium', archery: 0, temper: 'None' };
    expect(pcMoveCheck({ kind: 'character', archery: 2, temper: 'Brave' }, foe, 'advance')).toBe(70);
    expect(pcMoveCheck({ kind: 'character', archery: 2, archeryRaw: 0, temper: 'Brave' }, foe, 'advance')).toBe(60);
  });

  test('his answer to a challenge: none, no plan, a stance not in the list, a wanderer of a temper with none', () => {
    const hero = aHero();
    expect(duelStanceOf(null)).toBe('refuse');
    expect(duelStanceOf({ ...hero, temper: 'Brave', encounterPlan: undefined })).toBe('refuse');
    expect(duelStanceOf({ ...hero, temper: 'Brave', encounterPlan: { duelStance: 'parley' } })).toBe('refuse');
    expect(duelStanceOf({ ...hero, player: null, temper: 'Cowardly', encounterPlan: {} })).toBe('refuse');
    expect(duelStanceOf({ ...hero, player: null, temper: 'None', encounterPlan: {} })).toBe('accept');
  });

  test('a plan made for him: no hero; no bots’ list; a bot’s own stance with none set; a temper with no stance', () => {
    const tc = { ...pc.turnContext, _botPlayerIdx: undefined } as unknown as Parameters<typeof ensureEncounterPlan>[0];
    expect(ensureEncounterPlan(tc, null)).toBeNull();
    const wanderer = { ...aHero(), player: null, temper: 'None', encounterPlan: { _botStance: true } };
    const plan = ensureEncounterPlan(tc, wanderer);
    expect([plan?.duelStance, plan?._botStance, plan?._auto]).toEqual(['accept', false, true]);
    const realmsHero = { ...aHero(), encounterPlan: undefined };
    expect(ensureEncounterPlan(tc, realmsHero)).toBeUndefined();
  });
});

// ── The fight's status, a guardian's weakness learnt, the Mithril suit ──

describe('a fighter’s lingering harm and his riders that wait a round', () => {
  test('a lingering harm’s rounds: words, none and not a number', () => {
    expect([pcLingerRounds('2.9'), pcLingerRounds('x'), pcLingerRounds(undefined), pcLingerRounds(NaN)]).toEqual([
      2, 1, 1, 1,
    ]);
  });

  test('no fighter or no status takes none; no list starts one; a gap in the list is passed over', () => {
    expect(pcPushDot(null, 3, 2, 'Made-up Bleed')).toBeNull();
    expect(pcPushDot({}, 3, 2, 'Made-up Bleed')).toBeNull();
    const f: { status: { dot?: ({ dmg: number; rounds: number; label: string } | null)[] } } = { status: {} };
    expect(pcPushDot(f, 3, 2, 'Made-up Bleed')).toEqual({ dmg: 3, rounds: 2, label: 'Made-up Bleed' });
    f.status.dot = [null];
    pcPushDot(f, 3, 2, 'Made-up Bleed');
    expect(f.status.dot).toEqual([null, { dmg: 3, rounds: 2, label: 'Made-up Bleed' }]);
  });

  test('no damage, 0 or not a number is 1; no label or an empty one is “Lingering harm”, and refreshes it', () => {
    const f = { status: { dot: [] } };
    expect(pcPushDot(f, undefined, 1, undefined)).toEqual({ dmg: 1, rounds: 1, label: 'Lingering harm' });
    expect(pcPushDot(f, 0, 1, '')).toEqual({ dmg: 1, rounds: 1, label: 'Lingering harm' });
    expect(pcPushDot(f, NaN, 3, null)).toEqual({ dmg: 1, rounds: 3, label: 'Lingering harm' });
    expect(f.status.dot).toHaveLength(1);
  });

  test('a rider deferred: no fighter, no status or no function hangs none; no queue starts one; each runs once', () => {
    let ran = 0;
    const fn = () => {
      ran++;
    };
    expect([pcDeferEffect(null, fn), pcDeferEffect({}, fn), pcDeferEffect({ status: {} }, null)]).toEqual([
      false,
      false,
      false,
    ]);
    const f: { status: { _pending?: (() => void)[] } } = { status: {} };
    expect(pcDeferEffect(f, fn)).toBe(true);
    pcPromotePending(null);
    pcPromotePending({});
    pcPromotePending({ status: {} });
    pcPromotePending(f);
    pcPromotePending(f);
    expect([ran, f.status._pending]).toEqual([1, []]);
  });

  test('a weakness learnt by a realm of a state with no realms: none', () => {
    expect(pcLearnWeakness({}, 0, 'Made-up Wyrm')).toBe(false);
  });
});

describe('the Mithril suit and a max-HP item', () => {
  const suit = { name: 'Mithril Armour', effect: { stat: 'mithrilArmour' } };

  test('which items are the suit, and which may change hands: no item, no effect, no list', () => {
    expect([isMithril(null), isMithril({ name: 'Made-up Pebble' }), isMithril(suit)]).toEqual([false, false, true]);
    expect(transferableItems(undefined)).toEqual([]);
    expect(transferableItems([null, suit, { name: 'Made-up Pebble' }])).toEqual([null, { name: 'Made-up Pebble' }]);
  });

  test('who qualifies: no hero, no state, no realms, his realm not there', () => {
    const dwarf = { race: 'Dwarven', player: 1 };
    expect(mithrilQualifies(null, { players: [] })).toBe(false);
    expect(mithrilQualifies(dwarf, null)).toBe(false);
    expect(mithrilQualifies(dwarf, {})).toBe(false);
    expect(mithrilQualifies(dwarf, { players: [{ race: 'Dwarven' }] })).toBe(false);
    expect(mithrilQualifies(dwarf, { players: [{ race: 'Dwarven' }, { race: 'Dwarven' }] })).toBe(true);
  });

  test('a suit granted: no hero, a hero of no items, an item of no effect, a state of no next id', () => {
    grantMithrilTo(null, {});
    const gs: { nextItemId?: number } = {};
    const hero: { items?: Character['items'] } = {};
    grantMithrilTo(hero, gs);
    expect([hero.items?.map((it) => [it.name, it.id]), gs.nextItemId]).toEqual([[['Mithril Armour', 0]], 1]);
    const another = { items: [{ name: 'Made-up Pebble' }] as unknown as Character['items'] };
    grantMithrilTo(another, gs);
    expect([another.items.map((it) => [it.name, it.id]), gs.nextItemId]).toEqual([
      [
        ['Made-up Pebble', undefined],
        ['Mithril Armour', 1],
      ],
      2,
    ]);
  });

  test('the pass over the dwarves: no state, no heroes, no realms change nothing', () => {
    grantMithrilToDwarves(null);
    grantMithrilToDwarves({});
    grantMithrilToDwarves({ players: [] });
    const worn = { ...suit, desc: '', lore: '', tier: 1, id: 901 };
    const gs = { characters: [{ ...aHero(), items: [worn] }] };
    grantMithrilToDwarves(gs);
    expect(gs.characters[0]?.items).toEqual([worn]);
  });

  test('a max-HP item of no effect: the hero’s maximum is worked out again', () => {
    const hero = { ...aHero(), maxHp: 999, hp: 999 };
    applyItemMaxHp(hero, { effect: null });
    expect(hero.maxHp).toBeLessThan(999);
  });
});
