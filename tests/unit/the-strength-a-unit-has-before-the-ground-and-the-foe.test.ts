// The strength of a unit a hero leads before the ground and the foe (plan P1-11e38, R-135, question 45 (a)), the rule
// the army card shows: on staged heroes, units and realms, it is armStr's on no ground, with no foe and nothing of a
// battle around it, every step handed the engine's own facts (his mastery tiers, the share his Druid shortfall leaves,
// his realm's unit-strength effects, the items he uses, his Druid mastery, his minor titles). And the order its items'
// steps run in is the items' registry's order of the stage "strength: the commander's items".
// Level 1 (unit): pure functions called directly on the engine's modules, with no turn played and no die drawn. A lower
// level can't run them; a scenario would need a world in which a Druid 8 hero, a Necromancy 6 hero and the items meet,
// which no matrix game reaches (P1-11e's Decision 9).
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// `theStrengthAUnitHasBeforeTheGroundAndTheFoe` against `armStr` (terrain none, no battle context) on every staged unit
// under every staged hero: Druid 8 and 3, Necromancy 6, a hero with eight army items worn and one carried, a king holding
// the Naturalist's, the Cavalier's and the Ironclad's titles, heroes of each rival kin, in a Divine realm with six
// unit-strength discoveries (two that need a ground or a side, one a garrison alone) and a Pagan realm with none; the
// items' steps in the registry's order; the mastery tier of each trained level, and the effects of a kind the
// discoveries carry, an unknown id and a second effect among them.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { ALL_MAGIC_ITEMS_P } from '../../src/content/kingdoms-call-data.ts';
import { armStr, druidMasteryGain } from '../../src/engine/battle/terrain-and-unit-strength.ts';
import { druIdPenaltyMult } from '../../src/engine/world/tables.ts';
import { dragonTamed } from '../../src/engine/discoveries.ts';
import { perkTier } from '../../src/engine/titles/perks.ts';
import { activeItems } from '../../src/engine/items/equipment.ts';
import { charMinor } from '../../src/engine/titles/title-holders-and-battle-merit.ts';
import { theEffectsOfAKindARealmHolds } from '../../src/engine/rules/the-registry-of-discovery-effects.ts';
import { THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS } from '../../src/engine/rules/the-registry-of-magic-item-effects.ts';
import { THE_COMMANDERS_ITEMS } from '../../src/engine/rules-on-plain-values/the-strength-a-unit-has-after-the-steps-of-its-commanders-items.ts';
import { theEffectsOfAKindTheseDiscoveriesCarry } from '../../src/engine/rules-on-plain-values/the-factor-a-realms-unit-strength-discoveries-strengthen-a-unit-by.ts';
import { theMasteryTierATrainedLevelGives } from '../../src/engine/rules-on-plain-values/the-quality-a-commanders-druid-8-or-necromancy-6-lifts-a-unit-to-and-the-minor-titles-army-perks.ts';
import { theStrengthAUnitHasBeforeTheGroundAndTheFoe } from '../../src/engine/rules-on-plain-values/the-strength-a-unit-has-before-the-ground-and-the-foe.ts';
import type { ArmyInABattle, HeroInABattle } from '../../src/engine/army-tables.ts';
import type { TurnContext } from '../../src/engine/turn/context.ts';

/** An item of the content's catalogue, worn (or carried, `equipped` false). */
const item = (name: string, equipped = true) => {
  const it = ALL_MAGIC_ITEMS_P.find((x) => x.name === name);
  if (!it) throw new Error(`the items have no ${name}`);
  return { ...structuredClone(it), equipped };
};
/** Realm 0: a Divine realm of Humans with six unit-strength discoveries (War Drums, Fire Arrows, a garrison's alone, one
 *  on the plains defending, the Free Lances', the cavalry under the king) and an unknown id; realm 1: Pagan Elves with
 *  none. */
const discoveries = ['sd02', 'sd07', 'sd44', 'sd49', 'rh01', 'rh10', 'no-such-discovery'].map((id) => ({ id }));
const realms = [
  { alignment: 'Divine', race: 'Human', discoveries },
  { alignment: 'Pagan', race: 'Elven', discoveries: [] },
];
const heroes = [
  { id: 1, player: 1, race: 'Human', alignment: 'Pagan', skills: { druid: 8 }, items: [] },
  { id: 2, player: 1, race: 'Elven', alignment: 'Pagan', skills: { druid: 3 }, items: [] },
  { id: 3, player: 0, race: 'Orcish', alignment: 'Divine', skills: { necromancy: 6 }, items: [] },
  {
    id: 4,
    player: 0,
    race: 'Dwarven',
    alignment: 'Divine',
    skills: {},
    items: [
      'Battle Standard',
      'Golden Spur',
      "Legionnaire's Mark",
      'Eagle-Eye Pendant',
      'Kraken Figurehead',
      'Sea Chart of the Deep',
      'Black Sceptre',
      'Chalice of Dawn',
    ].map((n) => item(n)),
  },
  { id: 5, player: 0, race: 'Human', alignment: 'Divine', skills: {}, items: [item('Golden Spur', false)] },
  { id: 6, player: 0, race: 'Human', alignment: 'Divine', isKing: true, skills: { druid: 6 }, items: [] },
];
const G = {
  players: realms,
  characters: heroes,
  _titleHolders: {},
  _minorHolders: { naturalist: { charId: 6 }, cavalier: { charId: 6 }, ironclad: { charId: 6 } },
};
const turn = { G } as unknown as TurnContext;
const units: ArmyInABattle[] = [
  { type: 'Thunderbirds', quality: 'Average', race: '' },
  { type: 'Thunderbirds', quality: 'Elite', race: '' },
  { type: 'Men-at-Arms', quality: 'Average', race: 'Human' },
  { type: 'Men-at-Arms', quality: 'Veteran', race: 'Human', _isSkeletal: true },
  { type: 'Free Lances', quality: 'Green', race: 'Human' },
  { type: 'Yeoman Longbows', quality: 'Average', race: 'Human' },
  { type: 'Galleon Fleet', quality: 'Average', race: '' },
  { type: 'Shieldwall Levies', quality: 'Average', race: 'Elven' },
  { type: 'Shieldwall Levies', quality: 'Average', race: 'Dwarven' },
].map((u, i) => ({ unitName: `Test Company ${String(i)}`, ...u }));

/** The facts the card hands the rule, here from the engine's own functions on the staged hero and unit. */
const theRuleOn = (a: ArmyInABattle, h: HeroInABattle) => {
  const realm = realms[Number(h.player)];
  const alignment = realm?.alignment;
  const share = druIdPenaltyMult(h, a, alignment, dragonTamed(turn, h, a), G.characters);
  return theStrengthAUnitHasBeforeTheGroundAndTheFoe(
    { unitType: a.type, quality: a.quality, isSkeletal: Boolean(a._isSkeletal), race: a.race },
    {
      hisDruidMasteryTier: perkTier(h, 'druid'),
      hisNecromancyMasteryTier: perkTier(h, 'necromancy'),
      theShareHisDruidShortfallLeaves: share,
      theKingsRace: realm?.race,
      hisRace: h.race,
      theRealmsUnitStrengthEffects: theEffectsOfAKindARealmHolds(realm, 'unitStr'),
      heIsTheKing: h.isKing,
      theItemsHeUses: activeItems(h),
      theRealmsAlignment: alignment,
      hisDruidMasteryGain: druidMasteryGain(turn, h, a, alignment).gain,
      heHoldsTheMinorTitle: (title) => charMinor(turn, h, title),
    },
  ).strength;
};

describe('the strength of a unit before the ground and the foe (R-135, question 45 (a))', () => {
  test("is armStr's with no ground and no battle, on every staged unit under every staged hero", () => {
    const list = heroes.flatMap((x) =>
      units.map((u) => {
        const h = structuredClone(x) as unknown as HeroInABattle;
        const a = structuredClone(u);
        const battle = armStr(turn, a, structuredClone(h), realms[Number(h.player)]?.alignment, null, undefined);
        return { hero: h.id, unit: `${a.quality} ${a.type}`, rule: theRuleOn(a, h), battle };
      }),
    );
    expect(list).toHaveLength(54);
    expect(list.filter((x) => x.rule !== x.battle)).toEqual([]);
    // the question's Thunderbirds: 40 at their base, 59 under a Druid 8 hero (lifted to Veteran, then his mastery)
    expect(list.find((x) => x.hero === 1 && x.unit === 'Average Thunderbirds')?.battle).toBe(59);
    // the values are many, not one step's
    expect(new Set(list.map((x) => x.battle)).size).toBeGreaterThan(20);
  });

  test("the items' steps run in the registry's order of the stage", () => {
    expect(Object.keys(THE_COMMANDERS_ITEMS)).toEqual([
      ...THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS.strength["the commander's items"],
    ]);
  });

  test('the mastery tier of each trained level: the levels past 5, from 0 to 9', () => {
    expect([undefined, null, -1, 0, 5, 6, 8, 9, 12].map((l) => theMasteryTierATrainedLevelGives(l))).toEqual([
      0, 0, 0, 0, 0, 1, 3, 4, 4,
    ]);
  });

  test('the effects of a kind the discoveries carry: in their order, a second effect too, none of an unknown id', () => {
    expect(theEffectsOfAKindTheseDiscoveriesCarry(discoveries, 'unitStr').map((e) => e.pct)).toEqual([
      0.04, 0.14, 0.3, 0.3, 0.13, 0.18,
    ]);
    expect(theEffectsOfAKindTheseDiscoveriesCarry([null, { id: 'no-such-discovery' }], 'unitStr')).toEqual([]);
  });
});
