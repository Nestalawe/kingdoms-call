// The rule registry of content effects (plan P1-19, Decisions 2, 3 and 6). A content effect (today a unit ability) is
// one row in src/content/ (its unit, name and numbers: unit-abilities-their-names-numbers-and-words.ts) and one entry
// here, keyed by the same slug, naming its effect at each stage of a hook point. A hook point is one of the engine's
// real decisions (the nine below); its stages run in the battle code's order, and within a stage the effects run in the
// order its list gives (THE_ORDER_OF_EACH_STAGE): a product of decimals, and the ladder's words, depend on it. Each
// stage's effect type says exactly what the stage hands it, read-only, and an effect returns a value: it changes
// nothing. The resolvers ask the runners at the bottom; an effect reads only what its stage hands it and the content
// (src/engine/rules/ imports only itself, src/engine/rules-on-plain-values/ and src/content/: npm run lint:arch).
//
// The hook points' types live here, in a file that holds code, not in a file of types alone: a file only `import type`
// reaches is in no page's bundle, and the build's checks refuse it (docs/traps.md).
import {
  UNIT_ABILITIES_THE_REGISTRY_HOLDS,
  type AUnitAbilityAsTheBooksWriteIt,
  type UnitAbilitySlug,
} from '../../content/unit-abilities-their-names-numbers-and-words.ts';
import { THE_STRENGTH_OF_A_UNIT_IN_ITS_FORCE } from './unit-abilities/the-strength-of-a-unit-in-its-force.ts';

/** A unit of a force as an effect reads it: its type. */
export interface AUnitOfAForce {
  readonly type: string;
}

/** What the stage "strength: the whole force" hands an effect (unitAbilityMult, inside armStr). */
export interface AUnitInItsForce {
  /** The unit's type. */
  readonly unitType: string;
  /** Its force, itself among them, with the holes the battle code leaves in a force. */
  readonly itsForce: readonly (AUnitOfAForce | null | undefined)[];
  /** Whether the enemy's force fields a ranged unit (the ladder's missile set, MISSILE_ARMIES_MASTER). */
  readonly theEnemyFieldsRangedUnits: boolean;
  /** Whether its side is the attacker. */
  readonly itsSideAttacks: boolean;
  /** Whether its force landed from longships this phase. */
  readonly landedFromLongshipsThisPhase: boolean;
  /** Whether the province borders the sea. */
  readonly coastal: boolean;
  /** The battle's ground (a terrain's name: 'sea', 'plain', …). */
  readonly ground: string | null | undefined;
}

/** The hook points, each a set of named stages in the order the engine runs them, and the effect type of each stage.
 *  A stage or a hook point typed `never` has no signature yet: its family's first row writes it (plan P1-19's Choice
 *  1), so an entry on it fails to compile meanwhile. */
export interface TheStagesOfEachHookPoint {
  readonly strength: {
    /** The unit's own factor from its force and the battle's facts; the runner multiplies them in the stage's order. */
    readonly 'the whole force': (facts: AUnitInItsForce) => number;
    readonly 'what a unit does to the unit it meets': never;
    readonly 'what the unit it meets does to it': never;
    readonly 'what a shooter does to its target': never;
    readonly 'what the target does to the shooter': never;
    readonly 'held when hit from the side': never;
    readonly 'beside and behind it in the front line': never;
    readonly 'marked by the enemy line': never;
    readonly 'a shooter picks its target': never;
    readonly 'turns an anchored line': never;
    readonly 'what a flyer does': never;
  };
  readonly volley: never;
  readonly fate: {
    readonly 'a beaten unit fails its death roll': never;
    readonly 'a beaten unit fails its demotion roll': never;
  };
  readonly movementCost: never;
  readonly orderValidity: never;
  readonly experience: never;
  readonly visibility: never;
  readonly turnStart: never;
  readonly turnEnd: never;
}

/** The nine hook points. */
export type HookPointName = keyof TheStagesOfEachHookPoint;

/** An entry: the ability's effect at each stage it acts in. */
export type UnitAbilityEntry = { readonly [H in HookPointName]?: Partial<TheStagesOfEachHookPoint[H]> };

type TheWholeForceEffect = TheStagesOfEachHookPoint['strength']['the whole force'];

/** One entry for each content row, and no other (a row with no entry fails to compile, TS1360; an entry with no row,
 *  TS2353). */
export const THE_REGISTRY_OF_UNIT_ABILITIES = {
  'sheer-numbers': { strength: { 'the whole force': THE_STRENGTH_OF_A_UNIT_IN_ITS_FORCE['sheer-numbers'] } },
  'reaver-crews': { strength: { 'the whole force': THE_STRENGTH_OF_A_UNIT_IN_ITS_FORCE['reaver-crews'] } },
  'shoal-swarm': { strength: { 'the whole force': THE_STRENGTH_OF_A_UNIT_IN_ITS_FORCE['shoal-swarm'] } },
  'relentless-hunt': { strength: { 'the whole force': THE_STRENGTH_OF_A_UNIT_IN_ITS_FORCE['relentless-hunt'] } },
  'stone-deterrent': { strength: { 'the whole force': THE_STRENGTH_OF_A_UNIT_IN_ITS_FORCE['stone-deterrent'] } },
  'tidal-might': { strength: { 'the whole force': THE_STRENGTH_OF_A_UNIT_IN_ITS_FORCE['tidal-might'] } },
  'deepwater-grasp': { strength: { 'the whole force': THE_STRENGTH_OF_A_UNIT_IN_ITS_FORCE['deepwater-grasp'] } },
  wyrmscale: { strength: { 'the whole force': THE_STRENGTH_OF_A_UNIT_IN_ITS_FORCE.wyrmscale } },
  'air-superiority': { strength: { 'the whole force': THE_STRENGTH_OF_A_UNIT_IN_ITS_FORCE['air-superiority'] } },
} satisfies Record<UnitAbilitySlug, UnitAbilityEntry>;

/** Each stage's order: the entries with an effect at the stage, each once, in the order they run (the battle code's
 *  order before the registry took them). */
export const THE_ORDER_OF_EACH_STAGE = {
  strength: {
    'the whole force': [
      'sheer-numbers',
      'reaver-crews',
      'shoal-swarm',
      'relentless-hunt',
      'stone-deterrent',
      'tidal-might',
      'deepwater-grasp',
      'wyrmscale',
      'air-superiority',
    ],
  },
} as const satisfies {
  readonly [H in HookPointName]?: { readonly [S in keyof TheStagesOfEachHookPoint[H]]?: readonly UnitAbilitySlug[] };
};

const ROWS: Readonly<Record<UnitAbilitySlug, AUnitAbilityAsTheBooksWriteIt>> = UNIT_ABILITIES_THE_REGISTRY_HOLDS;
const ENTRIES: Readonly<Record<UnitAbilitySlug, UnitAbilityEntry>> = THE_REGISTRY_OF_UNIT_ABILITIES;

/** The effects of "the whole force" that reach a unit of the type given (its own and those that reach every unit), in
 *  the stage's order. */
function theWholeForceEffectsReaching(unitType: string | null): readonly TheWholeForceEffect[] {
  return THE_ORDER_OF_EACH_STAGE.strength['the whole force'].flatMap((slug) => {
    const effect = ENTRIES[slug].strength?.['the whole force'];
    const row = ROWS[slug];
    return effect && (row.unit === unitType || row.reaches === 'every unit of the force') ? [effect] : [];
  });
}

// Built once, as the file loads, from the content: a battle does no more work than when the effects were inline.
const THE_WHOLE_FORCE_BY_UNIT = new Map<string, readonly TheWholeForceEffect[]>(
  Object.values(ROWS).map((row) => [row.unit, theWholeForceEffectsReaching(row.unit)]),
);
const THE_WHOLE_FORCE_FOR_ANY_OTHER_UNIT = theWholeForceEffectsReaching(null);

/** The runner of "strength: the whole force": the product of the unit's factors, in the stage's order. */
export function theStrengthOfAUnitInItsWholeForce(facts: AUnitInItsForce): number {
  let m = 1;
  for (const effect of THE_WHOLE_FORCE_BY_UNIT.get(facts.unitType) ?? THE_WHOLE_FORCE_FOR_ANY_OTHER_UNIT)
    m *= effect(facts);
  return m;
}
