// The rule registry fails to compile when an effect and its content row part (plan P1-19, Decisions 2 and 3): the
// registry (src/engine/rules/the-registry-of-content-effects.ts) ends with `satisfies Record<UnitAbilitySlug,
// UnitAbilityEntry>`, where UnitAbilitySlug is the keys of the content's rows (src/content/unit-abilities-their-names-
// numbers-and-words.ts). TypeScript compiles copies of the two files and of what they import, each with one fault
// planted, and must refuse each, naming the slug:
// - a content row with no entry (TS1360: the registry doesn't satisfy its type, the slug missing);
// - an entry with no content row (TS2353: a key the type doesn't know);
// - an entry with an effect at a stage that has no signature yet, and at a hook point that has none (both `never`
//   until their family's first row writes them: plan P1-19's Choice 1; TS2322). Since P1-19d every stage of `strength`
//   and `fate` has its signature, so the copy plants a stage typed `never` in `fate` beside the entry on it: the check
//   is of the mechanism a later family's first row leans on while it writes its stages. Since P1-19g `volley` has its
//   signature too, so the hook point's plant was on `movementCost`; since P1-19af that has its signature, so the plant
//   was on `turnStart`; since P1-19ag every hook point has its signature, so the copy plants a hook point typed `never`
//   beside `turnStart`, as it plants the stage, and the entry on it.
// Since P1-19m the items' registry (src/engine/rules/the-registry-of-magic-item-effects.ts) ends the same way, `satisfies
// Record<MagicItemEffectSlug, MagicItemEffectEntry>`, on the keys of its content rows (src/content/magic-item-effects-
// their-names-numbers-and-words.ts), and the copies plant the same two faults in it: an item's effect row with no entry
// (TS1360) and an entry with no row (TS2353), each naming the slug. Since P1-19u the spells' registry
// (src/engine/rules/the-registry-of-spell-effects.ts) ends the same way, `satisfies Record<SpellSlug, SpellEffectEntry>`,
// on the keys of its content rows (src/content/spell-effects-their-names-numbers-and-words.ts), and the copies plant the
// same two faults in it. Since P1-19aa the discoveries' registry (src/engine/rules/the-registry-of-discovery-effects.ts)
// ends the same way, `satisfies Record<DiscoveryEffectSlug, DiscoveryEffectEntry>`, on the keys of its content rows (the
// kinds of effect it holds: src/content/discovery-effects-their-kinds-numbers-and-words.ts), and the copies plant the
// same two faults in it. Since P1-19ai the guardian perks' registry (src/engine/rules/the-registry-of-guardian-perks.ts)
// ends the same way, `satisfies Record<GuardianPerkSlug, GuardianPerkEntry>`, on the keys of its content rows (the kinds
// of perk: src/content/guardian-perks-their-kinds-numbers-and-words.ts), and the copies plant the same two faults in it.
// The files as they are compile with no error. Level 0 (static): the compiler reads the copies and nothing runs; a
// lower level has nothing to read. The copies hold only src/content/, src/engine/rules/ and (since P1-19m)
// src/engine/rules-on-plain-values/ (the registries import nothing else: npm run lint:arch), so each compiles on its own
// with tsconfig.json's settings. About 2 s (the data file is read
// once a copy), so its limit is a TypeScript program's.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { afterAll, expect, test } from 'vitest';
import { filesUnder, ROOT } from '../../tools/build.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const REGISTRY = 'src/engine/rules/the-registry-of-content-effects.ts';
const ROWS = 'src/content/unit-abilities-their-names-numbers-and-words.ts';
const ITEMS_REGISTRY = 'src/engine/rules/the-registry-of-magic-item-effects.ts';
const ITEMS_ROWS = 'src/content/magic-item-effects-their-names-numbers-and-words.ts';
const SPELLS_REGISTRY = 'src/engine/rules/the-registry-of-spell-effects.ts';
const SPELLS_ROWS = 'src/content/spell-effects-their-names-numbers-and-words.ts';
const DISCOVERIES_REGISTRY = 'src/engine/rules/the-registry-of-discovery-effects.ts';
const DISCOVERIES_ROWS = 'src/content/discovery-effects-their-kinds-numbers-and-words.ts';
const PERKS_REGISTRY = 'src/engine/rules/the-registry-of-guardian-perks.ts';
const PERKS_ROWS = 'src/content/guardian-perks-their-kinds-numbers-and-words.ts';
/** The files a copy holds, whose errors it reads: the content and the registry's folder (since P1-19j, the rows of a
 *  unit no longer raised, which the content's rows read; since P1-19m, the items' rows; since P1-19u, the spells';
 *  since P1-19aa, the discoveries' kinds; since P1-19ai, the guardian perks' kinds). */
const COPIED = [
  'src/content/kingdoms-call-data.ts',
  'src/content/the-abilities-of-a-unit-no-longer-raised.ts',
  ROWS,
  ITEMS_ROWS,
  SPELLS_ROWS,
  DISCOVERIES_ROWS,
  PERKS_ROWS,
  ...filesUnder(path.join(ROOT, 'src', 'engine', 'rules')).map((f) => `src/engine/rules/${f}`),
];
/** And, since P1-19m, the rules on plain values, which the items' effects read (they import only themselves and the
 *  content): copied as they are, beside the others, and not read for errors (a copy's program holds only those the
 *  registries reach). */
const BESIDE = filesUnder(path.join(ROOT, 'src', 'engine', 'rules-on-plain-values')).map(
  (f) => `src/engine/rules-on-plain-values/${f}`,
);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-the-rule-registry-'));
afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** `text` with `from` replaced by `to`, where `from` is found exactly once (else the plant would miss: it throws). */
function replacedOnce(text: string, from: string, to: string): string {
  const at = text.indexOf(from);
  if (at < 0 || text.includes(from, at + 1)) throw new Error(`the plant's anchor is not in the file once: ${from}`);
  return text.slice(0, at) + to + text.slice(at + from.length);
}

const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const WYRMSCALE_ENTRY =
  "  wyrmscale: { strength: { 'the whole force': THE_STRENGTH_OF_A_UNIT_IN_ITS_FORCE.wyrmscale } },\n";
const SPIRITWRACK_ENTRY = `  spiritwrack: {
    strength: {
      'a battle spell is cast before the battle': A_BATTLE_SPELL_CAST_BEFORE_THE_BATTLE.spiritwrack,
      'a battle spell has something to strike': A_BATTLE_SPELL_HAS_SOMETHING_TO_STRIKE.spiritwrack,
    },
    personalCombat: { 'a combat spell takes hold': A_COMBAT_SPELL_THAT_HARMS_TAKES_HOLD.spiritwrack },
  },
`;
const SIEGECRAFT_ENTRY =
  '  siegecraft: { strength: { "a realm\'s discoveries add to a siege": A_REALMS_DISCOVERIES_ADD_TO_A_SIEGE.siegecraft } },\n';
const THORNS_ENTRY = '  thorns: {},\n';
const UNDEAD_BONUS_ENTRY =
  "  'undead-bonus': { strength: { \"the commander's items\": THE_COMMANDERS_ITEMS['undead-bonus'] } },\n";

/** Each copy: its name, and the files it changes (by path from the repository's root) with their planted text. */
const PLANTS: Record<string, Record<string, string>> = {
  'as they are': {},
  'a content row with no entry': {
    [ROWS]: replacedOnce(
      read(ROWS),
      '} as const satisfies Record<string, AUnitAbilityAsTheBooksWriteIt>;',
      "  'planted-ability': { unit: 'Goblin Horde', name: 'Planted Ability', numbers: {} },\n} as const satisfies Record<string, AUnitAbilityAsTheBooksWriteIt>;",
    ),
  },
  'an entry with no content row': {
    [REGISTRY]: replacedOnce(read(REGISTRY), WYRMSCALE_ENTRY, WYRMSCALE_ENTRY + "  'planted-ability': {},\n"),
  },
  'an effect at a stage with no signature yet': {
    [REGISTRY]: replacedOnce(
      replacedOnce(
        read(REGISTRY),
        "    readonly 'a beaten unit fails its demotion roll': (",
        "    readonly 'a planted stage with no signature yet': never;\n    readonly 'a beaten unit fails its demotion roll': (",
      ),
      WYRMSCALE_ENTRY,
      "  wyrmscale: {\n    strength: { 'the whole force': THE_STRENGTH_OF_A_UNIT_IN_ITS_FORCE.wyrmscale },\n    fate: { 'a planted stage with no signature yet': () => null },\n  },\n",
    ),
  },
  'an effect at a hook point with no signature yet': {
    [REGISTRY]: replacedOnce(
      replacedOnce(
        read(REGISTRY),
        '  readonly turnStart: {',
        '  readonly aPlantedHookPointWithNoSignatureYet: never;\n  readonly turnStart: {',
      ),
      WYRMSCALE_ENTRY,
      "  wyrmscale: {\n    strength: { 'the whole force': THE_STRENGTH_OF_A_UNIT_IN_ITS_FORCE.wyrmscale },\n    aPlantedHookPointWithNoSignatureYet: { \"a unit's step\": () => 1 },\n  },\n",
    ),
  },
  "an item's effect row with no entry": {
    [ITEMS_ROWS]: replacedOnce(
      read(ITEMS_ROWS),
      '} as const satisfies Record<string, AMagicItemEffectAsItsTextsWriteIt>;',
      "  'planted-effect': { name: 'Planted Effect', carriedAs: { stat: 'plantedBonus' }, numbers: {} },\n} as const satisfies Record<string, AMagicItemEffectAsItsTextsWriteIt>;",
    ),
  },
  "an item's effect entry with no row": {
    [ITEMS_REGISTRY]: replacedOnce(
      read(ITEMS_REGISTRY),
      UNDEAD_BONUS_ENTRY,
      UNDEAD_BONUS_ENTRY + "  'planted-effect': {},\n",
    ),
  },
  "a spell's row with no entry": {
    [SPELLS_ROWS]: replacedOnce(
      read(SPELLS_ROWS),
      '} as const satisfies Record<string, ASpellAsItsTextsWriteIt>;',
      "  'planted-spell': { name: 'Planted Spell', fn: 'planted_spell' },\n} as const satisfies Record<string, ASpellAsItsTextsWriteIt>;",
    ),
  },
  "a spell's entry with no row": {
    [SPELLS_REGISTRY]: replacedOnce(
      read(SPELLS_REGISTRY),
      SPIRITWRACK_ENTRY,
      SPIRITWRACK_ENTRY + "  'planted-spell': {},\n",
    ),
  },
  "a discovery kind's row with no entry": {
    [DISCOVERIES_ROWS]: replacedOnce(
      read(DISCOVERIES_ROWS),
      '} as const satisfies Record<string, AKindOfDiscoveryEffect>;',
      "  'planted-kind': { kind: 'plantedKind' },\n} as const satisfies Record<string, AKindOfDiscoveryEffect>;",
    ),
  },
  "a discovery kind's entry with no row": {
    [DISCOVERIES_REGISTRY]: replacedOnce(
      read(DISCOVERIES_REGISTRY),
      SIEGECRAFT_ENTRY,
      SIEGECRAFT_ENTRY + "  'planted-kind': {},\n",
    ),
  },
  "a guardian perk kind's row with no entry": {
    [PERKS_ROWS]: replacedOnce(
      read(PERKS_ROWS),
      '} as const satisfies Readonly<Record<string, AKindOfGuardianPerk>>;',
      "  'planted-perk': { carriedAs: { ward: 'plantedWard' }, theValueAtEachGrade: [1, 2, 3, 4], itsNumberIsWritten: 'as it is', itsWords: '{N}', inTheRulebook: { row: 'Planted', aCellWritesIt: '{N}' } },\n} as const satisfies Readonly<Record<string, AKindOfGuardianPerk>>;",
    ),
  },
  "a guardian perk kind's entry with no row": {
    [PERKS_REGISTRY]: replacedOnce(read(PERKS_REGISTRY), THORNS_ENTRY, THORNS_ENTRY + "  'planted-perk': {},\n"),
  },
};

/** The slug a compiler message is about: the key a `satisfies` found missing, or the key it doesn't know; else, for a
 *  value given where the type has no signature yet, that type. */
const KEY_NAMED = /Property '"?([^"']+)"?' is missing in type|and ''([^']+)'' does not exist in type/;
const NO_SIGNATURE = /is not assignable to type '(never|undefined)'\.$/;

/** The compiler's errors in each planted copy, as `TS<code> in <the declaration it stands in>: <the slug it names, or
 *  the type with no signature>` (the declaration alone, for an error of another kind). */
function errorsIn(copies: Record<string, Record<string, string>>): Record<string, string[]> {
  const dirOf = (name: string) => path.join(tmp, name.replace(/[^a-z]+/gi, '-'));
  for (const [name, planted] of Object.entries(copies)) {
    for (const file of [...COPIED, ...BESIDE]) {
      fs.mkdirSync(path.dirname(path.join(dirOf(name), file)), { recursive: true });
      fs.writeFileSync(path.join(dirOf(name), file), planted[file] ?? read(file));
    }
  }
  const config = ts.getParsedCommandLineOfConfigFile(
    path.join(ROOT, 'tsconfig.json'),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (d) => {
        throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n'));
      },
    },
  );
  if (!config) throw new Error('tsconfig.json could not be read');
  const program = ts.createProgram(
    Object.keys(copies).flatMap((name) => [
      path.join(dirOf(name), REGISTRY),
      path.join(dirOf(name), ITEMS_REGISTRY),
      path.join(dirOf(name), SPELLS_REGISTRY),
      path.join(dirOf(name), DISCOVERIES_REGISTRY),
      path.join(dirOf(name), PERKS_REGISTRY),
    ]),
    config.options,
  );
  return Object.fromEntries(
    Object.keys(copies).map((name) => {
      const errors = COPIED.flatMap((file) => {
        const source = program.getSourceFile(path.join(dirOf(name), file));
        if (!source) throw new Error(`${file} of the copy "${name}" is not in the program`);
        const text = source.getFullText();
        return [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)].map((d) => {
          const declaration = [
            ...text.slice(0, text.indexOf('\n', d.start ?? 0)).matchAll(/^(?:export )?const (\w+)/gm),
          ].at(-1)?.[1];
          const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
          const key = KEY_NAMED.exec(message);
          const named = key?.[1] ?? key?.[2] ?? NO_SIGNATURE.exec(message.split('\n')[0] ?? '')?.[1];
          return `TS${String(d.code)} in ${path.basename(file)}, ${declaration ?? '(top)'}${named ? ': ' + named : ''}`;
        });
      });
      return [name, errors.sort()];
    }),
  );
}

test(
  'the registry and its content rows compile as they are, and each planted copy fails, naming the slug',
  timeLimitForTheWork({ typeScriptPrograms: 1 }),
  () => {
    // The registry's widened view (ENTRIES, which the runners read) fails too wherever its literal does.
    const at = (declaration: string) => `${path.basename(REGISTRY)}, ${declaration}`;
    const atTheItems = (declaration: string) => `${path.basename(ITEMS_REGISTRY)}, ${declaration}`;
    const atTheSpells = (declaration: string) => `${path.basename(SPELLS_REGISTRY)}, ${declaration}`;
    const atTheDiscoveries = (declaration: string) => `${path.basename(DISCOVERIES_REGISTRY)}, ${declaration}`;
    const atThePerks = (declaration: string) => `${path.basename(PERKS_REGISTRY)}, ${declaration}`;
    expect(errorsIn(PLANTS)).toEqual({
      'as they are': [],
      'a content row with no entry': [
        `TS1360 in ${at('THE_REGISTRY_OF_UNIT_ABILITIES')}: planted-ability`,
        `TS2741 in ${at('ENTRIES')}: planted-ability`,
      ],
      'an entry with no content row': [`TS2353 in ${at('THE_REGISTRY_OF_UNIT_ABILITIES')}: planted-ability`],
      'an effect at a stage with no signature yet': [
        `TS2322 in ${at('ENTRIES')}`,
        `TS2322 in ${at('THE_REGISTRY_OF_UNIT_ABILITIES')}: undefined`,
      ],
      'an effect at a hook point with no signature yet': [
        `TS2322 in ${at('ENTRIES')}`,
        `TS2322 in ${at('THE_REGISTRY_OF_UNIT_ABILITIES')}: never`,
      ],
      "an item's effect row with no entry": [
        `TS1360 in ${atTheItems('THE_REGISTRY_OF_MAGIC_ITEM_EFFECTS')}: planted-effect`,
        `TS2741 in ${atTheItems('ENTRIES')}: planted-effect`,
      ],
      "an item's effect entry with no row": [
        `TS2353 in ${atTheItems('THE_REGISTRY_OF_MAGIC_ITEM_EFFECTS')}: planted-effect`,
      ],
      "a spell's row with no entry": [
        `TS1360 in ${atTheSpells('THE_REGISTRY_OF_SPELL_EFFECTS')}: planted-spell`,
        `TS2741 in ${atTheSpells('ENTRIES')}: planted-spell`,
      ],
      "a spell's entry with no row": [`TS2353 in ${atTheSpells('THE_REGISTRY_OF_SPELL_EFFECTS')}: planted-spell`],
      "a discovery kind's row with no entry": [
        `TS1360 in ${atTheDiscoveries('THE_REGISTRY_OF_DISCOVERY_EFFECTS')}: planted-kind`,
        `TS2741 in ${atTheDiscoveries('ENTRIES')}: planted-kind`,
      ],
      "a discovery kind's entry with no row": [
        `TS2353 in ${atTheDiscoveries('THE_REGISTRY_OF_DISCOVERY_EFFECTS')}: planted-kind`,
      ],
      "a guardian perk kind's row with no entry": [
        `TS1360 in ${atThePerks('THE_REGISTRY_OF_GUARDIAN_PERKS')}: planted-perk`,
        `TS2741 in ${atThePerks('ENTRIES')}: planted-perk`,
      ],
      "a guardian perk kind's entry with no row": [
        `TS2353 in ${atThePerks('THE_REGISTRY_OF_GUARDIAN_PERKS')}: planted-perk`,
      ],
    });
  },
);
