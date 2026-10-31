// The combat item and guardian lines no game of the balance matrix reaches keep their values (plan P1-10b13, P1-10's
// Choice 2 of 2026-10-29: the cases P1-19s extends). The lines P1-10b13 changed to free personal-combat/tactics-combat-
// items-and-actions.ts of the ts-nocheck line that no game reaches give the value each gave before (worked out by the
// rules as the file had them, with its ts-nocheck line):
// - a value the code guards, missing: no tactic, effect, status, lingering list, penalty, kinds, specials, schools,
//   item list, item in a gap of it, foe, hero or guardian, grade, chance or words;
// - a number a `||` gave its fallback for, which `??` alone would keep: an item's 0 or missing threshold, amount,
//   rounds, count, penalty, bonus or images; a school's missing or NaN level; a grade the table lacks;
// - the uses no game sees take effect (P1-19's count: a healing, a draining, a silence's rounds, a terror, bane's
//   double, the Lock-Pick of Legends), a stun item, a daze riding a blow (and since plan P1-12d19, which hands its
//   source, the words of one a ward turns), and an item of no damage range, which throws where it threw;
// - and, since plan P1-19s moved the combat items into the items' registry (src/engine/rules/), the lines its planted
//   faults showed no test or game sees: a bane-stun against its kinds only, the order a fighter reaches for his items
//   in, and a guardian taking up its lair's hoard (its maximum HP at full health, its combat items, its armour, the
//   Warbringer Gauntlets and the blow they drive home);
// - and, since plan P1-12d28 (the line's foe a record since P1-12d25), the plea granted after a harm that is no blow: a
//   hero felled by a lingering burn is let go by his foe, a hero, who is named by his name, and staggers off at 1 HP.
// Level 1 (unit): each is a plain function on a staged fighter and item, called on the engine's modules (tests/lib/
// personal-combat.ts, for the turn's context), the dice pinned with kcRng.use (pc.pinned); a static check can't run
// them, and no game reaches these lines.
import { describe, expect, test } from 'vitest';
import { clone, personalCombatEngine } from '../lib/personal-combat.ts';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';
import type { AFighterInAPersonalCombat } from '../../src/engine/personal-combat/helpers.ts';
import type { TurnContext } from '../../src/engine/turn/context.ts';
import type { Item } from '../../src/schemas/saved-game-state.ts';

const pc = await personalCombatEngine();
/** The turn's context the engine made for this world (the test library's type names only the fields it reads). */
const tc = pc.turnContext as unknown as TurnContext;
const { pcAct, pcCombatItemWanted, pcNextTactic, pcTryCombatItem, pcUseCombatItem } =
  await import('../../src/engine/personal-combat/tactics-combat-items-and-actions.ts');
const { pcCharCombatant, pcMonsterCombatant, pcNewStatus } =
  await import('../../src/engine/personal-combat/speed-encounter-plans-and-combatants.ts');
const { pcPromotePending } = await import('../../src/engine/personal-combat/helpers.ts');
const { pcBuildGuardian } = await import('../../src/engine/personal-combat/lair-guardians-and-the-odds.ts');
const { pcMeleeDamage } = await import('../../src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts');
const { ALL_MAGIC_ITEMS_P } = await import('../../src/content/kingdoms-call-data.ts');
const { theWordsOf } = await import('../../src/views/prose/the-words-of-each-line.ts');

type Staged = Record<string, unknown>;
type AFight = Parameters<typeof pcAct>[4];
type AnItem = Parameters<typeof pcUseCombatItem>[3];
/** A plain fighter (a guardian of no perks, 20 HP, Melee 2, no wards, of the temper "None": no bonus), with the
 *  fields given; a field given as undefined is taken out. */
function fighter(over: Staged = {}): AFighterInAPersonalCombat {
  const f: Staged = { ...pcMonsterCombatant({ name: 'Made-up Mole', hp: 20, melee: 2 }), ...over };
  for (const [k, v] of Object.entries(over)) if (v === undefined) Reflect.deleteProperty(f, k);
  return f as unknown as AFighterInAPersonalCombat;
}
/** A fighter's status as pcNewStatus makes it, with the fields given; a field given as undefined is taken out. */
function status(over: Staged = {}) {
  const s: Staged = { ...pcNewStatus(), ...over };
  for (const [k, v] of Object.entries(over)) if (v === undefined) Reflect.deleteProperty(s, k);
  return s;
}
/** A fighter at `hp` of 20. */
const at = (hp: number, over: Staged = {}) => fighter({ hp, ...over });
/** A content item by its name (a copy). */
function item(name: string): AnItem {
  const it = ALL_MAGIC_ITEMS_P.find((i) => i.name === name);
  if (!it) throw new Error(`no item named ${name}`);
  return clone(it);
}
/** A made-up combat item of the effect given. */
const made = (effect: Staged, desc?: string): AnItem => ({
  name: 'A made-up charm',
  ...(desc === undefined ? {} : { desc }),
  effect: { stat: 'combatUse', ...effect },
});
/** A fight's state at the range given. */
const fight = (range = 'melee'): AFight => ({ range, fledBy: null, stoleBy: null, parley: false, feature: null });
/** Each line's kind. */
const kinds = (narrative: readonly NarrativeLine[]) => narrative.map((l) => (typeof l === 'string' ? l : l.kind));
/** `actor` uses `it` on `foe`, the dice pinned at `r`: the lines. */
function use(actor: AFighterInAPersonalCombat, foe: AFighterInAPersonalCombat, it: AnItem, r: number | number[] = 0) {
  const narrative: NarrativeLine[] = [];
  pc.pinned(r, () => {
    pcUseCombatItem(tc, actor, foe, it, narrative, fight());
  });
  return narrative;
}
/** Whether `actor` (at `hp` of 20) would use an item of the effect given against `foe` now. */
const wanted = (hp: number, effect: Staged, over: Staged = {}, foe = fighter()) =>
  pcCombatItemWanted(at(hp, over), foe, made(effect), null);
// Values the code guards as if they may be missing, which no caller leaves out today; these cases pass none.
const noFoe = null as unknown as AFighterInAPersonalCombat;

describe('the next tactic', () => {
  test('an empty or missing tactic in the plan is an ordinary attack', () => {
    const f = fighter({ tactics: ['', 'FI'], tacIdx: 0 });
    expect([pcNextTactic(f, fighter()), pcNextTactic(f, fighter())]).toEqual(['ME', 'FI']);
    expect(pcNextTactic(fighter({ tactics: [undefined], tacIdx: 0 }), fighter())).toBe('ME');
  });
});

describe('whether a combat item is wanted now', () => {
  test('an item of no effect is never wanted; a fighter of no status still weighs one', () => {
    expect(pcCombatItemWanted(at(5), fighter(), { name: 'A made-up charm' }, null)).toBe(false);
    expect(wanted(10, { use: 'hot' }, { status: undefined })).toBe(true);
    expect(wanted(10, { use: 'absorb' }, { status: undefined })).toBe(true);
  });
  // each use's threshold, as a share of 20 HP: a missing one or 0 falls back to its own
  test.each([
    ['heal', 0.5],
    ['hot', 0.7],
    ['secondwind', 0.6],
    ['invis', 0.5],
    ['mirror', 0.7],
    ['flee', 0.35],
    ['drain', 0.75],
  ])('%s: a missing threshold or 0 is %s', (use, below) => {
    const under = 20 * below - 1;
    const over = 20 * below + 1;
    // a second wind is wanted under its threshold only when something lingers or the fighter is low (under 0.4)
    const lingering = use === 'secondwind' ? { status: status({ hitPenalty: 10 }) } : { neverFlees: false };
    expect(wanted(under, { use }, lingering)).toBe(true);
    expect(wanted(under, { use, below: 0 }, lingering)).toBe(true);
    expect(wanted(over, { use }, lingering)).toBe(false);
    expect(wanted(over, { use, below: 0 }, lingering)).toBe(false);
  });
  test('a second wind or a dispel: no list of lingering harms and no penalty is nothing to lift', () => {
    const nothing = { status: status({ dot: undefined, hitPenalty: undefined }) };
    expect(wanted(10, { use: 'secondwind' }, nothing)).toBe(false);
    expect(wanted(10, { use: 'dispel' }, nothing)).toBe(false);
    expect(wanted(10, { use: 'secondwind' }, { status: status({ dot: undefined, hitPenalty: NaN }) })).toBe(false);
    expect(wanted(10, { use: 'dispel' }, { status: status({ hitPenalty: 15 }) })).toBe(true);
  });
  test('a ward, an unseeing or doubles: none held (missing or 0) is wanted, some held is not', () => {
    expect(wanted(19, { use: 'absorb' }, { status: status({ absorb: undefined }) })).toBe(true);
    expect(wanted(19, { use: 'absorb' }, { status: status({ absorb: 0 }) })).toBe(true);
    expect(wanted(19, { use: 'absorb' }, { status: status({ absorb: 4 }) })).toBe(false);
    expect(wanted(5, { use: 'invis' }, { status: status({ toHitReduce: undefined }) })).toBe(true);
    expect(wanted(5, { use: 'invis' }, { status: status({ toHitReduce: 0 }) })).toBe(true);
    expect(wanted(5, { use: 'invis' }, { status: status({ toHitReduce: 10 }) })).toBe(false);
    expect(wanted(5, { use: 'mirror' }, { status: status({ mirrorImages: undefined }) })).toBe(true);
    expect(wanted(5, { use: 'mirror' }, { status: status({ mirrorImages: 0 }) })).toBe(true);
    expect(wanted(5, { use: 'mirror' }, { status: status({ mirrorImages: 2 }) })).toBe(false);
  });
  test('a bane of no kinds is never wanted; one of the foe’s kind is', () => {
    expect(wanted(20, { use: 'bane' })).toBe(false);
    expect(wanted(20, { use: 'bane', vs: ['beast'] })).toBe(true);
  });
  test('a bane-stun: of no kinds, or of another kind, never wanted; of the foe’s kind, wanted', () => {
    expect(wanted(20, { use: 'banestun' })).toBe(false);
    expect(wanted(20, { use: 'banestun', vs: ['undead'] })).toBe(false);
    expect(wanted(20, { use: 'banestun', vs: ['beast'] })).toBe(true);
  });
  test('a silence: a foe of no specials or schools is not worth it; a caster is', () => {
    expect(wanted(20, { use: 'silence' }, {}, fighter({ specials: undefined, school: undefined }))).toBe(false);
    expect(wanted(20, { use: 'silence' }, {}, fighter({ specials: [], school: { white: 1 } }))).toBe(true);
    expect(wanted(20, { use: 'silence' }, {}, fighter({ specials: [{ name: 'Howl' }], school: undefined }))).toBe(true);
  });
});

describe('the item a fighter reaches for', () => {
  test('a gap in the list and an item of no effect are passed over', () => {
    const f = at(5, { combatItems: [null, { name: 'A made-up charm' }, item('Potion of Healing')] });
    const narrative: NarrativeLine[] = [];
    expect(pc.pinned(0, () => pcTryCombatItem(tc, f, fighter(), narrative, fight()))).toBe(true);
    expect([f.hp, [...(f._itemsUsed ?? [])]]).toEqual([13, ['Potion of Healing']]);
    const g = at(5, { combatItems: [{ name: 'A made-up charm' }] });
    expect(pcTryCombatItem(tc, g, fighter(), [], fight())).toBe(false);
  });
  test('of two items wanted now, the one of the use reached for first: a healing before a second wind', () => {
    const f = at(5, {
      status: status({ hitPenalty: 10 }),
      combatItems: [item('Elixir of Second Wind'), item('Potion of Healing')],
    });
    expect(pc.pinned(0, () => pcTryCombatItem(tc, f, fighter(), [], fight()))).toBe(true);
    expect([...(f._itemsUsed ?? [])]).toEqual(['Potion of Healing']);
  });
});

describe('a combat item used', () => {
  test('an item of no effect does nothing', () => {
    expect(kinds(use(fighter(), fighter(), { name: 'A made-up charm' }))).toEqual([
      'a fighter uses a combat item',
      'but nothing happens',
    ]);
  });
  test('a healing: its own amount, and 5 where it has none or 0', () => {
    const healed = (it: AnItem) => {
      const f = at(5);
      use(f, fighter(), it);
      return f.hp;
    };
    expect([
      healed(item('Potion of Healing')),
      healed(made({ use: 'heal' })),
      healed(made({ use: 'heal', amt: 0 })),
    ]).toEqual([13, 10, 10]);
  });
  test('a healing over time and a second wind: 3 a round for 3 rounds, and 10, where the item has none or 0', () => {
    const f = at(5);
    use(f, fighter(), made({ use: 'hot', amt: 0 }));
    expect(f.status.hot).toEqual({ amt: 3, rounds: 3, label: 'A made-up charm' });
    const g = at(5);
    use(g, fighter(), made({ use: 'hot' }));
    expect(g.status.hot).toEqual({ amt: 3, rounds: 3, label: 'A made-up charm' });
    const h = at(5);
    use(h, fighter(), made({ use: 'secondwind' }));
    expect(h.hp).toBe(15);
  });
  test('a blow: once where it has no count or 0; twice where it says so; no range throws, a short one is no number', () => {
    const struck = (effect: Staged) => {
      const foe = fighter({ hp: 40, maxHp: 40 });
      use(fighter(), foe, made({ use: 'dmg', dmg: [3, 3], ...effect }));
      return foe.hp;
    };
    expect([struck({}), struck({ times: 0 }), struck({ times: 2 })]).toEqual([37, 37, 34]);
    expect(() => use(fighter(), fighter(), made({ use: 'dmg' }))).toThrow(
      new TypeError("Cannot read properties of undefined (reading '0')"),
    );
    expect(() => use(fighter(), fighter(), made({ use: 'drain' }))).toThrow(
      new TypeError("Cannot read properties of undefined (reading '0')"),
    );
    expect(() => use(fighter(), fighter(), made({ use: 'dmg', dmg: null }))).toThrow(
      new TypeError("Cannot read properties of null (reading '0')"),
    );
    const foe = fighter();
    use(fighter(), foe, made({ use: 'dmg', dmg: [3] }));
    expect(foe.hp).toBeNaN();
  });
  test('bane’s double: a Scroll of Sunburst blazes twice as bright against the undead', () => {
    const undead = fighter({ hp: 40, maxHp: 40, cat: 'undead' });
    expect(kinds(use(fighter(), undead, item('Scroll of Sunburst')))).toContain(
      'a combat item blazes twice as bright against the foe',
    );
    expect(undead.hp).toBe(24);
    const beast = fighter({ hp: 40, maxHp: 40 });
    use(fighter(), beast, item('Scroll of Sunburst'));
    expect(beast.hp).toBe(32);
  });
  test('a daze riding a blow takes hold from the next round', () => {
    const foe = fighter({ hp: 40, maxHp: 40 });
    use(fighter(), foe, item('Thunder Stone'));
    expect(foe.status.stun).toBe(0);
    pcPromotePending(foe);
    expect(foe.status.stun).toBe(1);
  });
  // (plan P1-12d19: the item's daze is handed as its source, the item's name, and the prose writes these words)
  test("a daze riding a blow that a ward turns: the line names the item's daze, and none waits", () => {
    const foe = fighter({ hp: 40, maxHp: 40, arm: { stunImmune: true } });
    const said = pc.wordsOf(use(fighter(), foe, item('Thunder Stone')));
    expect(said.filter((l) => l.includes('finds no hold'))).toEqual([
      "  🜏 Made-up Mole cannot be held (its nature) — the Thunder Stone's daze finds no hold.",
    ]);
    pcPromotePending(foe);
    expect(foe.status.stun).toBe(0);
  });
  test('a draining: the actor drinks what it dealt', () => {
    const f = at(5);
    use(f, fighter({ hp: 40, maxHp: 40 }), item('Scroll of Life Drain'));
    expect(f.hp).toBe(10);
  });
  test('a stun item holds the foe its own rounds, and 1 where it has none or 0', () => {
    const held = (it: AnItem) => {
      const foe = fighter();
      use(fighter(), foe, it);
      return foe.status.stun;
    };
    expect([
      held(item('Scroll of Paralysis')),
      held(made({ use: 'stun' })),
      held(made({ use: 'stun', stun: 0 })),
    ]).toEqual([2, 1, 1]);
    expect([held(item('Beastbane Snare')), held(made({ use: 'banestun', vs: ['beast'] }))]).toEqual([
      item('Beastbane Snare').effect?.stun,
      1,
    ]);
  });
  test('a blinding: of no words or other words it fades, "for the rest of the fight" it stays; 15 where it has none', () => {
    const blinded = (it: AnItem) => {
      const foe = fighter();
      use(fighter(), foe, it);
      return [foe.status.hitPenalty, foe.status.hitPenaltyFixed];
    };
    expect(blinded(made({ use: 'pen' }))).toEqual([15, 0]);
    expect(blinded(made({ use: 'pen', hitPen: 0 }, 'A flash of light.'))).toEqual([15, 0]);
    expect(blinded(made({ use: 'pen', hitPen: 25 }, 'Blind for the rest of the fight.'))).toEqual([0, 25]);
  });
  test('a terror: a foe who fails the roll flees; one who holds is shaken by its own or 15', () => {
    const state = fight();
    const foe = fighter({ neverFlees: false });
    pc.pinned(0.1, () => {
      pcUseCombatItem(tc, fighter(), foe, item('Scroll of Terror'), [], state);
    });
    expect(state.fledBy).toBe(foe);
    const shaken = (it: AnItem) => {
      const held = fighter({ neverFlees: false });
      use(fighter(), held, it, 0.9);
      return held.status.hitPenalty;
    };
    expect([shaken(item('Wailing Horn')), shaken(made({ use: 'terror' }))]).toEqual([20, 15]);
  });
  test('a silence binds for its own rounds, and 3 where it has none', () => {
    const bound = (it: AnItem) => {
      const foe = fighter();
      use(fighter(), foe, it);
      return foe.status.silenceRounds;
    };
    expect([bound(item('Scroll of the Stilled Tongue')), bound(made({ use: 'silence' }))]).toEqual([4, 3]);
  });
  test('a focus: on none held (missing) or some, its own bonus or 10', () => {
    const focused = (it: AnItem, hitBonus: unknown) => {
      const f = fighter({ status: status({ hitBonus }) });
      use(f, fighter(), it);
      return f.status.hitBonus;
    };
    expect([focused(made({ use: 'focus' }), undefined), focused(made({ use: 'focus', hitBonus: 7 }), 5)]).toEqual([
      10, 12,
    ]);
  });
  test('a ward and doubles: 10 and 2 where the item has none', () => {
    const f = fighter();
    use(f, fighter(), made({ use: 'absorb' }));
    use(f, fighter(), made({ use: 'mirror' }));
    expect([f.status.absorb, f.status.mirrorImages]).toEqual([10, 2]);
  });
  test('flight and the unseen: 25 where the item has none; the unseen added to none held (missing) or some', () => {
    const f = fighter({ status: status({ toHitReduce: undefined }) });
    use(f, fighter(), made({ use: 'flee', toHitReduce: 10 }));
    expect([f.status.fleeBonus, f.status.toHitReduce]).toEqual([25, 10]);
    use(f, fighter(), item('Potion of Fleetness'));
    expect([f.status.fleeBonus, f.status.toHitReduce]).toEqual([50, 20]);
    const g = fighter({ status: status({ toHitReduce: undefined }) });
    use(g, fighter(), made({ use: 'invis' }));
    use(g, fighter(), item('Grey Cloak Draught'));
    expect(g.status.toHitReduce).toBe(45);
  });
});

describe("a combat item's lines name the fighter who uses it", () => {
  // Since plan P1-12d25 a fighter is a record the prose names; the words are those the engine wrote before: "The <name>"
  // for a guardian, his name for anyone else (pcUseCombatItem's `who`), in each line no game reaches.
  const theLines = (kind: string) => {
    const f = at(5, { kind, name: 'Made-up Mole' });
    const uses = [
      made({ use: 'heal' }),
      made({ use: 'secondwind' }),
      made({ use: 'buff', melee: 2 }),
      made({ use: 'focus' }),
      made({ use: 'flee' }),
      made({ use: 'invis' }),
    ];
    const narrative = uses.flatMap((it) => use(f, fighter(), it));
    narrative.push(
      ...use(at(5, { kind, name: 'Made-up Mole' }), fighter({ hp: 40, maxHp: 40 }), item('Scroll of Life Drain')),
    );
    return narrative.map((l) => theWordsOf(l));
  };
  test("a guardian is 'The <name>', a hero his name", () => {
    const guardians = theLines('monster');
    expect(guardians.filter((w) => /recovers|surges|eye sharpens|break away|stolen vigour/.test(w))).toEqual([
      '  The Made-up Mole recovers 5 HP. (HP 10)',
      '  The Made-up Mole recovers 10 HP and every lingering affliction lifts. (HP 20)',
      '  The Made-up Mole surges with strength — Melee 4.',
      "  The Made-up Mole's eye sharpens (+10% to hit).",
      '  The Made-up Mole is ready to break away (+25% to flee).',
      '  The Made-up Mole drinks the stolen vigour — +5 HP. (HP 10)',
    ]);
    expect(theLines('char').filter((w) => w.includes('eye sharpens'))).toEqual([
      "  Made-up Mole's eye sharpens (+10% to hit).",
    ]);
  });
});

describe('an action in the fight', () => {
  const act = (
    actor: AFighterInAPersonalCombat,
    foe: AFighterInAPersonalCombat,
    r: number | number[],
    state = fight(),
  ) => {
    const narrative: NarrativeLine[] = [];
    pc.pinned(r, () => {
      pcAct(tc, actor, foe, narrative, state);
    });
    return narrative;
  };
  test('a special: none listed, or a gap before it, is looked through; one of no chance is cast at 50%', () => {
    const state = fight('spell');
    act(fighter({ tactics: ['MS:Howl'], tacIdx: 0, specials: undefined }), fighter(), 0.9, state);
    expect(state.range).toBe('bow');
    const slipped = act(
      fighter({ tactics: ['MS:Howl'], tacIdx: 0, specials: [null, { name: 'Howl', effect: 'stun' }] }),
      fighter(),
      0.5,
    );
    expect(slipped[0]).toMatchObject({
      kind: 'a fighter gathers itself for a power but the moment slips away',
      castChancePct: 50,
    });
  });
  test('a spell chosen by the best school: a missing or NaN level counts as none', () => {
    const chosen = (school: Staged) => {
      const narrative = act(fighter({ tactics: ['CA'], tacIdx: 0, school }), fighter(), 0.99);
      return JSON.stringify(narrative);
    };
    expect(chosen({ necromancy: 1 })).toContain('Hand of Death');
    expect(chosen({ elemental: NaN, white: 0, necromancy: 0, illusory: 0, psychic: 1 })).toContain('Psychic Blast');
  });
  test('a theft: no foe, a foe of no hero or guardian, of no grade or a grade the table lacks, is a Weak one’s', () => {
    const hero = tc.G.characters.find((c) => c.alive && c.player != null);
    if (!hero) throw new Error('the world has no living hero of a realm');
    type TheItems = Parameters<typeof pcCharCombatant>[1]['items'];
    const thief = (items: TheItems = []) => {
      const f = pcCharCombatant(tc, { ...clone(hero), items, skills: { ...hero.skills, thief: 1 } });
      f.tactics = ['ST'];
      f.tacIdx = 0;
      return f;
    };
    const chance = (foe: AFighterInAPersonalCombat, items: TheItems = []) => {
      const line = act(thief(items), foe, 0.99)[0];
      if (typeof line !== 'object' || line.kind !== "a fighter's theft is noticed") throw new Error('no theft line');
      return [line.chance, line.tierPen];
    };
    // 50 + 10 × Thief 1 + the temper's steal mod, less the grade's penalty (within 5 to 95)
    const [weak] = chance(fighter({ power: undefined, ref: { power: 'Weak' } }));
    expect(chance(noFoe)).toEqual([weak, 0]);
    expect(chance(fighter({ ref: undefined }))).toEqual([weak, 0]);
    expect(chance(fighter({ ref: {} }))).toEqual([weak, 0]);
    expect(chance(fighter({ ref: { power: 'Mythic' } }))).toEqual([weak, 0]);
    expect(chance(fighter({ ref: { power: 'Legendary' } }))).toEqual([Number(weak) - 45, 45]);
    const lockPick = ALL_MAGIC_ITEMS_P.find((i) => i.name === 'Lock-Pick of Legends');
    if (!lockPick) throw new Error('no Lock-Pick of Legends in the content');
    // the Lock-Pick of Legends worn: its +1 Thief (10) and its own +20
    expect(chance(fighter({ ref: { power: 'Weak' } }), [{ ...clone(lockPick), id: 9001, equipped: true }])).toEqual([
      Number(weak) + 30,
      0,
    ]);
  });
});

describe('a guardian takes up its lair’s hoard', () => {
  /** A guardian of a kind that may wield anything (a made-up humanoid at full health), built as a lair fight builds it
   *  from a lair whose hoard is `hoard` (its hoard stocked already: no draw), and the lines. */
  const guardian = (hoard: AnItem[]) => {
    const m = { name: 'Made-up Ogre', cat: 'humanoid', power: 'Weak', hp: 20, melee: 2 };
    const narrative: NarrativeLine[] = [];
    const g = pcBuildGuardian(
      tc,
      // the content's items, staged as the hoard's saved items (pcBuildGuardian reads none of the fields they lack)
      { name: 'Made-up Ruin', monster: m, hoardItems: hoard as unknown as Item[], _hoardV2: true },
      m,
      narrative,
    );
    return { g, narrative };
  };
  test('an item of maximum HP adds its own to a guardian at full health', () => {
    const amulet = item('Amulet of Fortitude');
    const bonus = Number(amulet.effect?.bonus);
    expect(bonus).toBeGreaterThan(0);
    const { g, narrative } = guardian([amulet]);
    expect([g.maxHp, g.hp, g._hpItemBonus]).toEqual([20 + bonus, 20 + bonus, bonus]);
    expect(kinds(narrative)).toEqual(["the guardian has turned the hoard's magic to its own use"]);
  });
  test('a combat item joins its combat items; armour, its wards', () => {
    const { g } = guardian([item('Potion of Healing'), item('Dwarf-Forged Hauberk')]);
    expect((g.combatItems ?? []).map((it) => it.name)).toEqual(['Potion of Healing']);
    expect(g.arm?.meleeDR).toBe(item('Dwarf-Forged Hauberk').effect?.amt);
  });
  test('the Warbringer Gauntlets drive its blows home: 2 more damage a blow', () => {
    const { g } = guardian([item('Warbringer Gauntlets')]);
    expect(g.gauntlets).toBe(true);
    const blow = () => pc.pinned(0, () => pcMeleeDamage(g, fighter()));
    const driven = blow();
    g.gauntlets = false;
    expect(driven - blow()).toBe(2);
  });
});

describe('a plea granted after a harm that is no blow (plan P1-12d28)', () => {
  test('the foe, a hero, lets the fighter go: his own name, and the fighter staggers off at 1 HP', () => {
    /** A hero of the world, renamed, as a fight takes him up (pcCharCombatant). */
    const aHero = (id: number, name: string, temper: string) =>
      pc.call('pcCharCombatant', { ...clone(pc.base), id, name, temper }) as AFighterInAPersonalCombat;
    const spared = aHero(9101, 'Made-up Fennick', 'Cowardly'),
      foe = aHero(9102, 'Made-up Ostrander', 'Brave');
    // felled at the round's start by a lingering burn, before any blow: his plea is told at the end, and granted (a die
    // of 1 on the d100, under any alignment's mercy)
    spared.hp = 2;
    spared.status.dot = [
      { dmg: 5, rounds: 2, source: { kind: 'a combat item', itemName: "Vial of Alchemist's Fire" } },
    ];
    const res = pc.pinned(0.01, () => pc.call('resolvePersonalCombat', spared, foe, { maxRounds: 3 })) as {
      fledBy?: unknown;
      narrative: NarrativeLine[];
    };
    expect(kinds(res.narrative)).toContain('the foe lets a fighter go');
    expect(pc.wordsOf(res.narrative)).toContain(
      '  Made-up Ostrander lets them go — Made-up Fennick staggers from the field with their life. (HP 1)',
    );
    expect([res.fledBy === spared, spared.hp]).toEqual([true, 1]);
  });
});
