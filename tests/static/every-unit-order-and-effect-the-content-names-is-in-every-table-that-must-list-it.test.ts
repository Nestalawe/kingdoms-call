// Every unit, order and effect the content names is in every table that must list it (`content-complete`, plan step
// P1-10z). The compiler already refuses a unit left out of a table keyed by unit type
// (static/a-unit-left-out-of-a-data-table-fails-to-compile.test.ts) and an order kind with no case in the orders' switch
// (static/an-order-kind-with-no-case-in-the-orders-switch-fails-to-compile.test.ts). This test checks at run time what
// types can't: a name written as a plain string in one table (a list, a cell, a content row, a page's list, the books)
// that must be in another. Nothing throws when one is missed: the rule meant for it reaches nothing, the order reads
// as Defend, the book is silent. The tables, each with why it must list the names:
//
// Units: every name is a unit type (KC_UNIT_TYPE's keys: every table is keyed by them, so a name that is no type is a
// unit nobody has, and the rule written for it reaches no company):
//   1. KC_UNIT_CLASS's lists: the battle's and the sea's rules (the archery step, a hull's berth, Ride Them Down) find a
//      unit by its name in its class.
//   2. KC_DRUID_LEVELS' lists: the Druid a commander needs to lead each unit.
//   3. PROVINCE_ARMIES_P's cells: what a province of each ground and race raises.
//   4. BATTLE_ARMY_SPELLS: the winged riders' strikes before the battle, by the unit.
//   5. The discoveries' `types` and `withTypes` (in `effect` and `effect2`): the units a discovery strengthens or makes
//      cheaper.
//   6. The engine's ARMY_RACE_OF_TYPE and DISC_CLS_SETS: the race and the classes a discovery reaches a unit by.
//   7. LEGACY_UNIT_RENAMES' new names: what an old save's company becomes at the top of a turn.
//   8. World generation's wild pools (CREATURE_BY_TERRAIN and MONSTER_BY_TERRAIN, and their copies CBT and MBT): each
//      creature pool's names are Creatures, each monster pool's Monsters (Druidic realms favour the first, Evil the
//      second).
// Units: every unit that needs it is listed:
//   9. ARMY_RACE_OF_TYPE has the race of every unit of the four races' own (a unit type that is no Creature, no Monster
//      and no elemental): a discovery that lowers a race's recruiting price or raises its recruits' quality asks this
//      table, by the unit's type, before the company exists. The retired Corsair Fleet is left out: no province now
//      raises the fleet (ruling of 2026-10-15, tests/corsairs-retired.test.js).
//  10. The rulebook names every unit type: it is where a player reads what a company is. The retired Corsair Fleet is
//      left out: the books must not name it (the same ruling).
// Orders:
//  11. Every order the order form offers (ACTIONS) reads as its kind in PHASE_ACTION_MAP, by its name in lower case: a
//      name the map lacks reads as Defend, so the hero stands still.
//  12. Every order a bot or the balance matrix's scripted realm writes (an `action` written as a string in
//      src/engine/bots/ and tools/balance/) reads as a kind there too, for the same reason.
//  13. ACTIONS and ACTION_DISPLAY_ORDER (the form's order of the list) name the same orders: an order left out sinks to
//      the bottom of the list, a name only in the second is an order the form never offers.
//  14. The form offers every alignment order's row (THE_ALIGNMENT_ORDERS) and every mastery order's row
//      (THE_MASTERY_ORDERS) by its name.
//  15. Every kind of order (PHASE_ACTION_MAP's values) is a kind an order the form offers reads as: a kind no name the
//      form writes reads as is an order no player can give. Awaken the Wild and Call from the Pit are left out: they were
//      removed on 2026-10-12, and their kinds stay so that an order a save still holds is refused, not dropped
//      (docs/traps.md, "A realm's alignment's rule is a row of its abilities").
//  16. The rulebook names every order the form offers. The twenty mastery orders are left out: the rulebook says each
//      mastery's order or spell is revealed in play, not listed there.
// Effects:
//  17. Every spell a magic item casts is a spell of SPELL_DEFS_P: an item that names no spell casts nothing.
//  18. Every skill or school a discovery, a mastery order, a spell, a guardian's spell or a mastery's words names is a
//      skill of KC_SKILLS: a skill that is no skill is a level no hero holds.
//  19. Every class of unit a discovery names (`cls`, `withCls`) is one discUnitIs reads: a key of DISC_CLS_SETS, or a
//      class it tells by code (primal, creature, monster, skeletal, humanoid). Any other reaches no unit.
//
// A gap found today is in THE_GAPS_KNOWN_TODAY below, each with its backlog row (docs/backlog/, "Not yet assessed"):
// what a missing entry should be is a rule, for a maintainer, so the test never fills one. Each check's gaps must be
// exactly its known list: a new gap fails, and so does a known gap that is no longer one (its fix takes it out of the
// list, so the list only shrinks).
//
// Level 0 (static): the content's tables and the rules on plain values (which import only the content) are imported as
// plain data; the engine's and the order form's other tables are read by their syntax trees (tests/lib/source.ts) and
// their literal values evaluated on their own; the rulebook is read as written in src/. Nothing of the game runs.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { describe, expect, test } from 'vitest';
import { THE_ALIGNMENT_ORDERS } from '../../src/content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import {
  ALL_MAGIC_ITEMS_P,
  BATTLE_ARMY_SPELLS,
  KC_DRUID_LEVELS,
  KC_SKILLS,
  KC_UNIT_CLASS,
  KC_UNIT_TYPE,
  LEGENDARY_ITEMS_P,
  MASTERY_UNLOCKS,
  MONSTERS_P,
  PROVINCE_ARMIES_P,
  SAGE_DISCOVERIES_P,
  SPELL_DEFS_P,
  type ElementalUnitType,
} from '../../src/content/kingdoms-call-data.ts';
import { THE_MASTERY_ORDERS } from '../../src/content/mastery-orders-their-keys-names-skills-and-levels.ts';
import { theNameTheFormWritesOfTheAlignmentOrder } from '../../src/engine/rules-on-plain-values/the-alignment-orders-the-names-the-form-writes-and-who-may-give-each.ts';
import { PHASE_ACTION_MAP } from '../../src/engine/rules-on-plain-values/the-kind-of-order-each-name-of-an-order-reads-as.ts';
import {
  ARMY_RACE_OF_TYPE,
  DISC_CLS_SETS,
} from '../../src/engine/rules-on-plain-values/units-a-discoverys-effect-reaches-by-type-class-race-and-quality.ts';
import { ROOT } from '../../tools/build.ts';
import { compactDeclaration, entriesOf, initializersOf } from '../lib/source.ts';

const THE_ORDER_FORMS_LISTS =
  'ui/player/the-order-forms-ledger-practice-note-order-list-and-magic-levels-on-the-orders-handed-them.ts';
const WORLD_GENERATION = 'engine/world/generate.ts';
const THE_DISCOVERIES_CLASSES =
  'engine/rules-on-plain-values/units-a-discoverys-effect-reaches-by-type-class-race-and-quality.ts';

/** The gaps each check finds today, by the check's number above: each has its backlog row. */
const THE_GAPS_KNOWN_TODAY: Readonly<Partial<Record<number, readonly string[]>>> = {
  // KD-407: two Human units have no race in the table the recruiting price and quality discoveries read.
  9: ['Noble Griffons', 'Galleon Fleet'],
  // KD-408: the rulebook never names the five elementals a mage summons.
  10: ['Air Elemental', 'Fire Elemental', 'Earth Elemental', 'Water Elemental', 'Darkness Elemental'],
};

/** The retired Corsair Fleet: still a unit type, for the companies a save holds, but no province raises it and no book
 *  names it (ruling of 2026-10-15). */
const THE_RETIRED_CORSAIR_FLEET = 'Corsair Fleet';
/** The five elementals a mage summons: a new one fails to compile here until it is named. */
const THE_ELEMENTALS = {
  'Air Elemental': true,
  'Fire Elemental': true,
  'Earth Elemental': true,
  'Water Elemental': true,
  'Darkness Elemental': true,
} satisfies Record<ElementalUnitType, true>;
/** The two orders removed on 2026-10-12, whose kinds stay to refuse an order a save still holds. */
const THE_REMOVED_ORDERS_KINDS = ['awaken_wild', 'call_pit'];

const UNIT_TYPES = new Set(Object.keys(KC_UNIT_TYPE));
const SKILLS = new Set<string>(KC_SKILLS);
const THE_KIND_BY_NAME: Readonly<Partial<Record<string, string>>> = PHASE_ACTION_MAP;

/** The field `key` of a row of any shape (undefined where it has none). */
function fieldOf(row: unknown, key: string): unknown {
  if (typeof row !== 'object' || row === null) return undefined;
  return new Map<string, unknown>(Object.entries(row)).get(key);
}
/** The strings of a value that is a list (none for any other value). */
function stringsIn(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}
/** The items of a value that is a list (none for any other value). */
function theItemsOf(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value.map((item: unknown) => item) : [];
}
/** The keys and values of a value that is a table (none for any other value). */
function theEntriesOf(value: unknown): [key: string, value: unknown][] {
  return typeof value === 'object' && value !== null ? Object.entries(value) : [];
}
/** A list's strings, and the string of a value that is one. */
const stringOrStringsIn = (value: unknown): string[] => (typeof value === 'string' ? [value] : stringsIn(value));
/** Each name of `names` that `isListed` refuses, once, in the order first met, each with where it was met. */
function namesNotListed(
  names: readonly (readonly [where: string, name: string])[],
  isListed: (name: string) => boolean,
) {
  return [...new Set(names.filter(([, name]) => !isListed(name)).map(([where, name]) => `${where}: ${name}`))];
}
/** Each name of `names` not in `listed`, once, in the order first met. */
function notIn(names: Iterable<string>, listed: ReadonlySet<string>): string[] {
  return [...new Set([...names].filter((name) => !listed.has(name)))];
}

/** The value a literal declared in a file of src/ holds (the first declaration of `name`), evaluated on its own with
 *  `given` in scope: a list or a table of strings. */
function theLiteralDeclared(file: string, name: string, given: Record<string, unknown> = {}): unknown {
  const source = initializersOf(file, name)[0];
  if (source === undefined) throw new Error(`${file} declares no ${name}`);
  return vm.runInNewContext(source, { ...given });
}

/** Every string literal an object writes as its `action`, in the TypeScript files under each folder (from the root). */
function theActionsWrittenUnder(folders: readonly string[]): (readonly [where: string, name: string])[] {
  const found: (readonly [string, string])[] = [];
  for (const folder of folders)
    for (const file of fs.readdirSync(path.join(ROOT, folder), { recursive: true, encoding: 'utf8' })) {
      if (!file.endsWith('.ts')) continue;
      const where = path.join(folder, file);
      const tree = ts.createSourceFile(where, fs.readFileSync(path.join(ROOT, where), 'utf8'), ts.ScriptTarget.Latest);
      const visit = (node: ts.Node): void => {
        if (
          ts.isPropertyAssignment(node) &&
          ts.isIdentifier(node.name) &&
          node.name.text === 'action' &&
          ts.isStringLiteralLike(node.initializer)
        )
          found.push([where, node.initializer.text]);
        ts.forEachChild(node, visit);
      };
      visit(tree);
    }
  return found;
}

/** The rulebook's words as a reader sees them: the markup dropped, the spaces made one. */
const THE_RULEBOOK = fs
  .readFileSync(path.join(ROOT, 'src', 'kingdoms-call-rules.html'), 'utf8')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ');

const ACTIONS = stringsIn(
  theLiteralDeclared(THE_ORDER_FORMS_LISTS, 'ACTIONS', { theNameTheFormWritesOfTheAlignmentOrder }),
);
const ACTION_DISPLAY_ORDER = stringsIn(theLiteralDeclared(THE_ORDER_FORMS_LISTS, 'ACTION_DISPLAY_ORDER'));
const THE_WILD_POOLS = {
  creatures: ['CREATURE_BY_TERRAIN', 'CBT'],
  monsters: ['MONSTER_BY_TERRAIN', 'MBT'],
};
/** The names each of world generation's pools of one kind holds, each with its pool and ground. */
const theWildPoolsNames = (pools: readonly string[]) =>
  pools.flatMap((pool) =>
    theEntriesOf(theLiteralDeclared(WORLD_GENERATION, pool)).flatMap(([ground, names]) =>
      stringsIn(names).map((name) => [`${pool}.${ground}`, name] as const),
    ),
  );
/** Each discovery's effects (its `effect`, and its `effect2` where it has two), each with the discovery's id. */
const DISCOVERY_EFFECTS = SAGE_DISCOVERIES_P.flatMap((d) =>
  ['effect', 'effect2'].flatMap((key) => (fieldOf(d, key) === undefined ? [] : [[d.id, fieldOf(d, key)] as const])),
);
const MAGIC_ITEMS = [...ALL_MAGIC_ITEMS_P, ...LEGENDARY_ITEMS_P];

/** Each check by its number above: the names it finds missing from the table that must list them. */
const CHECKS: Readonly<Record<number, { readonly what: string; readonly gaps: () => string[] }>> = {
  1: {
    what: "KC_UNIT_CLASS's lists name unit types only",
    gaps: () =>
      namesNotListed(
        Object.entries(KC_UNIT_CLASS).flatMap(([cls, names]) => names.map((n) => [cls, n] as const)),
        (n) => UNIT_TYPES.has(n),
      ),
  },
  2: {
    what: "KC_DRUID_LEVELS' lists name unit types only",
    gaps: () =>
      namesNotListed(
        Object.entries(KC_DRUID_LEVELS).flatMap(([level, names]) => stringsIn(names).map((n) => [level, n] as const)),
        (n) => UNIT_TYPES.has(n),
      ),
  },
  3: {
    what: "PROVINCE_ARMIES_P's cells name unit types only",
    gaps: () =>
      namesNotListed(
        Object.entries(PROVINCE_ARMIES_P).flatMap(([ground, cells]) =>
          Object.entries(cells).flatMap(([race, names]) =>
            stringsIn(names).map((n) => [`${ground}.${race}`, n] as const),
          ),
        ),
        (n) => UNIT_TYPES.has(n),
      ),
  },
  4: {
    what: 'BATTLE_ARMY_SPELLS names unit types only',
    gaps: () => notIn(Object.keys(BATTLE_ARMY_SPELLS), UNIT_TYPES),
  },
  5: {
    what: "the discoveries' types and withTypes name unit types only",
    gaps: () =>
      namesNotListed(
        DISCOVERY_EFFECTS.flatMap(([id, effect]) =>
          [...stringsIn(fieldOf(effect, 'types')), ...stringsIn(fieldOf(effect, 'withTypes'))].map(
            (n) => [id, n] as const,
          ),
        ),
        (n) => UNIT_TYPES.has(n),
      ),
  },
  6: {
    what: "the engine's ARMY_RACE_OF_TYPE and DISC_CLS_SETS name unit types only",
    gaps: () =>
      namesNotListed(
        [
          ...Object.keys(ARMY_RACE_OF_TYPE).map((n) => ['ARMY_RACE_OF_TYPE', n] as const),
          ...Object.entries(DISC_CLS_SETS).flatMap(([cls, names]) =>
            [...names].map((n) => [`DISC_CLS_SETS.${cls}`, n] as const),
          ),
        ],
        (n) => UNIT_TYPES.has(n),
      ),
  },
  7: {
    what: "LEGACY_UNIT_RENAMES' new names are unit types",
    gaps: () =>
      notIn(
        entriesOf('engine/army-tables.ts', 'LEGACY_UNIT_RENAMES').map((e) => e.value),
        UNIT_TYPES,
      ),
  },
  8: {
    what: "world generation's creature pools name Creatures only, its monster pools Monsters only",
    gaps: () => [
      ...namesNotListed(theWildPoolsNames(THE_WILD_POOLS.creatures), (n) => KC_UNIT_CLASS.creature.includes(n)),
      ...namesNotListed(theWildPoolsNames(THE_WILD_POOLS.monsters), (n) => KC_UNIT_CLASS.monster.includes(n)),
    ],
  },
  9: {
    what: "ARMY_RACE_OF_TYPE has the race of every unit of the four races' own",
    gaps: () =>
      [...UNIT_TYPES].filter(
        (unit) =>
          !KC_UNIT_CLASS.creature.includes(unit) &&
          !KC_UNIT_CLASS.monster.includes(unit) &&
          !(unit in THE_ELEMENTALS) &&
          unit !== THE_RETIRED_CORSAIR_FLEET &&
          ARMY_RACE_OF_TYPE[unit] === undefined,
      ),
  },
  10: {
    what: 'the rulebook names every unit type',
    gaps: () => [...UNIT_TYPES].filter((unit) => unit !== THE_RETIRED_CORSAIR_FLEET && !THE_RULEBOOK.includes(unit)),
  },
  11: {
    what: 'every order the form offers reads as its kind',
    gaps: () => ACTIONS.filter((name) => THE_KIND_BY_NAME[name.toLowerCase()] === undefined),
  },
  12: {
    what: 'every order a bot or the scripted realm writes reads as a kind',
    gaps: () =>
      namesNotListed(
        theActionsWrittenUnder(['src/engine/bots', 'tools/balance']),
        (name) => THE_KIND_BY_NAME[name.toLowerCase().trim()] !== undefined,
      ),
  },
  13: {
    what: 'the form lists the orders it offers in the order ACTION_DISPLAY_ORDER gives, and no other',
    gaps: () => [
      ...notIn(ACTIONS, new Set(ACTION_DISPLAY_ORDER)).map((name) => `not placed: ${name}`),
      ...notIn(ACTION_DISPLAY_ORDER, new Set(ACTIONS)).map((name) => `not offered: ${name}`),
    ],
  },
  14: {
    what: "the form offers every alignment order's and every mastery order's row",
    gaps: () =>
      notIn(
        [...Object.values(THE_ALIGNMENT_ORDERS), ...Object.values(THE_MASTERY_ORDERS)].map((order) => order.name),
        new Set(ACTIONS),
      ),
  },
  15: {
    what: 'every kind of order is one an order the form offers reads as',
    gaps: () =>
      notIn(
        Object.values(PHASE_ACTION_MAP),
        new Set([...ACTIONS.map((name) => THE_KIND_BY_NAME[name.toLowerCase()] ?? ''), ...THE_REMOVED_ORDERS_KINDS]),
      ),
  },
  16: {
    what: 'the rulebook names every order the form offers but the mastery orders',
    gaps: () => {
      const mastery = new Set<string>(Object.values(THE_MASTERY_ORDERS).map((order) => order.name));
      return ACTIONS.filter((name) => !mastery.has(name) && !THE_RULEBOOK.includes(name));
    },
  },
  17: {
    what: 'every spell a magic item casts is a spell',
    gaps: () =>
      namesNotListed(
        MAGIC_ITEMS.flatMap((item) => stringsIn([fieldOf(item.effect, 'spell')]).map((n) => [item.name, n] as const)),
        (n) => n in SPELL_DEFS_P,
      ),
  },
  18: {
    what: 'every skill or school the content names is a skill',
    gaps: () =>
      namesNotListed(
        [
          ...DISCOVERY_EFFECTS.flatMap(([id, effect]) =>
            ['skills', 'skill', 'school'].flatMap((key) =>
              stringOrStringsIn(fieldOf(effect, key)).map((n) => [id, n] as const),
            ),
          ),
          ...Object.values(THE_MASTERY_ORDERS).map((order) => [order.name, order.skill] as const),
          ...Object.entries(SPELL_DEFS_P).map(([spell, def]) => [spell, def.school] as const),
          ...MONSTERS_P.flatMap((guardian) =>
            theItemsOf(fieldOf(guardian, 'spells')).flatMap((spell) =>
              stringOrStringsIn(fieldOf(spell, 'school')).map((n) => [guardian.name, n] as const),
            ),
          ),
          ...Object.keys(MASTERY_UNLOCKS).map((skill) => ['MASTERY_UNLOCKS', skill] as const),
        ],
        (n) => SKILLS.has(n),
      ),
  },
  19: {
    what: 'every class of unit a discovery names is one discUnitIs reads',
    gaps: () => {
      const byCode = [
        ...compactDeclaration(THE_DISCOVERIES_CLASSES, 'discUnitIs').matchAll(/\bcls\s*===\s*'([^']+)'/g),
      ].map((m) => m[1] ?? '');
      const classes = new Set([...Object.keys(DISC_CLS_SETS), ...byCode]);
      return namesNotListed(
        DISCOVERY_EFFECTS.flatMap(([id, effect]) =>
          [...stringOrStringsIn(fieldOf(effect, 'cls')), ...stringOrStringsIn(fieldOf(effect, 'withCls'))].map(
            (n) => [id, n] as const,
          ),
        ),
        (n) => classes.has(n),
      );
    },
  },
};

describe('every unit, order and effect the content names is in every table that must list it', () => {
  test.each(Object.entries(CHECKS).map(([n, check]) => [Number(n), check.what, check] as const))(
    '%i. %s (its gaps are exactly those known today)',
    (n, _what, check) => {
      expect(check.gaps()).toEqual(THE_GAPS_KNOWN_TODAY[n] ?? []);
    },
  );
  test('each check reads something: the tables it reads are not empty', () => {
    expect(ACTIONS.length).toBeGreaterThan(40);
    expect(ACTION_DISPLAY_ORDER.length).toBeGreaterThan(40);
    expect(theWildPoolsNames(THE_WILD_POOLS.creatures).length).toBeGreaterThan(10);
    expect(theWildPoolsNames(THE_WILD_POOLS.monsters).length).toBeGreaterThan(10);
    expect(theActionsWrittenUnder(['src/engine/bots', 'tools/balance']).length).toBeGreaterThan(50);
    expect(entriesOf('engine/army-tables.ts', 'LEGACY_UNIT_RENAMES').length).toBeGreaterThan(3);
    expect(compactDeclaration(THE_DISCOVERIES_CLASSES, 'discUnitIs')).toMatch(/cls\s*===\s*'primal'/);
    expect(DISCOVERY_EFFECTS.length).toBeGreaterThan(SAGE_DISCOVERIES_P.length);
  });
});
