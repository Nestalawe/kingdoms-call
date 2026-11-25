// npm run ratchet: the harness can only get stronger. Counts what weakens it (switched-off checks, allowlist
// entries, JavaScript not yet TypeScript (the tests' and tools', and the site's in src/, apart), quarantined tests,
// tests on the engine's vm loader, the engine's checks of a unit by its
// type's name, of an item's effect by its key or an item by its name, of a spell by its name or its `fn`, of a discovery by its id or its effect's kind, of a guardian's perk and of an alignment order by its key, its naming of an alignment, the economy's numbers in the engine and in the bots, the engine's checks of a title, the world's making's numbers and lists, the engine's naming of a race, a temper, an order's kind and a relation, the battles' and personal combat's numbers in the engine and in the bots, the sight rules' numbers, the portal's naming of an alignment, ESLint's suppressed findings, the import rules' known violations and what knip finds unused) and fails if
// any count is above its baseline in tests/ratchet.json. When a count falls, it says so: lower the baseline in the
// same PR (npm run ratchet -- --update only ever lowers it). tests/static/harness.test.ts runs the same comparison,
// so npm test and CI fail too.
//
// It counts the files git knows, plus new ones not yet added (not git-ignored ones, nor local folders such as plan/).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { z } from 'zod';
import { theStagesTheListHolds } from './the-worlds-makings-stages-read-from-their-list-in-src.ts';
import {
  _ITEM_NAME_ALTS,
  ALL_MAGIC_ITEMS_P,
  KC_ALIGNMENTS,
  KC_HUMANOID_RACES,
  KC_SKILLS,
  KC_TEMPERS,
  KC_UNIT_TYPE,
  LEGENDARY_ITEMS_P,
  MONSTERS_P,
  SAGE_DISCOVERIES_P,
  SPELL_DEFS_P,
  TITLE_DEFS,
} from '../src/content/kingdoms-call-data.ts';
import { THE_ALIGNMENT_ORDERS } from '../src/content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import { THE_HERO_ORDERS } from '../src/content/the-hero-orders-their-keys-the-names-the-turn-reads-them-by-and-their-tiers.ts';
import {
  THE_STATES_TWO_REALMS_STAND_IN,
  THE_TREAT_DECLARATION,
} from '../src/content/the-relations-between-two-realms-the-three-states-a-pair-stands-in-and-the-treat-declaration.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
export const BASELINE_FILE = path.join(ROOT, 'tests', 'ratchet.json');

export type Counts = Record<string, number>;

// Lists of reviewed exceptions: each entry lets something through that a check would otherwise refuse. The one today
// is kc/html-is-built-only-through-kc-html's option, in eslint.config.js (plan P1-13, Decision 8).
export const ALLOWLISTS = [{ file: 'eslint.config.js', name: 'HTML_EXCEPTIONS' }];

const CODE = /\.(ts|mts|cts|js|mjs|cjs|html)$/;
// Built from parts, so this file doesn't count itself.
const TS_IGNORE = new RegExp('@ts-' + '(ignore|expect-error)');
const ESLINT_DISABLE = new RegExp('eslint-' + 'disable');

function files(): string[] {
  const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: ROOT });
  return [...new Set(out.toString().split('\0').filter(Boolean))]
    .filter((f) => fs.existsSync(path.join(ROOT, f)))
    .sort();
}

const lines = (text: string, re: RegExp) => text.split('\n').filter((l) => re.test(l)).length;

// The ts-nocheck line has no count: lint refuses it in every TypeScript file (eslint.config.js's ban-ts-comment; plan
// P1-10, Decision 9), so its two counts, on the engine's side and in the UI, retired at 0 (P1-16v), as plan P1-13's
// Decision 13 retires a baseline at 0.
// The tests on the old database stand-in have no count: the stand-in is deleted (plan P1-17s2), so an import of it
// fails to resolve, and the count retired with it.

/** The counts read from the code files' text (the switch-offs of a check), for the files given as [path from the
 *  repository's root, text]. */
export function countsFromTheCodeFiles(codeFiles: readonly (readonly [file: string, text: string])[]): Counts {
  const counts = { tsIgnore: 0, eslintDisable: 0 };
  for (const [f, text] of codeFiles) {
    if (!CODE.test(f)) continue;
    counts.tsIgnore += lines(text, TS_IGNORE);
    counts.eslintDisable += lines(text, ESLINT_DISABLE);
  }
  return counts;
}

/** The code files git knows, each with its text, as countsFromTheCodeFiles reads them. */
export function theCodeFiles(all = files()): [file: string, text: string][] {
  return all.filter((f) => CODE.test(f)).map((f) => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]);
}

// The engine's loader (plan P1-09, Decision 11): the engine's bundle run in a vm. P1-14 moved the tests to importing
// the engine's modules directly; three test files still reach it, themselves or through a helper of tests/
// (unit/engine-loads, unit/engine-purity, scenario/pursuit-one-battle:
// docs/architecture/how-the-tests-reach-the-site.md says why), and their number only falls.
const ENGINE_LOADER = 'tests/lib/engine.ts';
/** The test files (tests/**\/*.test.{js,ts}, not the quarantine) whose relative imports and requires reach the
 *  engine's loader. */
export function vmLoaderTests(all: string[]): number {
  const known = new Set(all);
  const importsOf = (f: string): string[] =>
    [...fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/(?:\bfrom\s+|\brequire\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)]
      .map((m) => path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1] ?? '')))
      .flatMap((t) =>
        ['', '.ts', '.js']
          .map((x) => t + x)
          .filter((x) => known.has(x))
          .slice(0, 1),
      );
  const memo = new Map<string, boolean>();
  const reaches = (f: string, seen: Set<string>): boolean => {
    const kept = memo.get(f);
    if (kept !== undefined) return kept;
    if (seen.has(f)) return false;
    seen.add(f);
    const r = importsOf(f).some((g) => g === ENGINE_LOADER || reaches(g, seen));
    memo.set(f, r);
    return r;
  };
  return all.filter((f) => /^tests\/(?!quarantine\/).*\.test\.[jt]s$/.test(f) && reaches(f, new Set())).length;
}

// The engine's checks of a unit by its type's name (plan P1-19, Decision 7): a string naming a unit type of
// KC_UNIT_TYPE that the code compares (===, !==, ==, !=, a case), looks up by (a table's ['…']) or passes to has,
// get, includes or indexOf, counted by syntax tree in the files of src/engine/ outside src/engine/rules/. The rule
// registry takes them out family by family (an effect asks its content row, by slug), so the count only falls.
// tests/static/the-resolvers-the-registry-has-taken-name-no-unit-type.test.ts counts the functions the registry has
// taken, with unitNameChecksByFunction, at 0 each.
const UNIT_TYPE_NAMES: ReadonlySet<string> = new Set(Object.keys(KC_UNIT_TYPE));
const COMPARISONS = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);
const LOOKUPS = new Set(['has', 'get', 'includes', 'indexOf']);
/** Whether a string literal is a check of a unit by its type's name (above). */
function isAUnitNameCheck(node: ts.StringLiteral): boolean {
  if (!UNIT_TYPE_NAMES.has(node.text)) return false;
  const p = node.parent;
  return (
    (ts.isBinaryExpression(p) && COMPARISONS.has(p.operatorToken.kind)) ||
    ts.isCaseClause(p) ||
    (ts.isElementAccessExpression(p) && p.argumentExpression === node) ||
    (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) && LOOKUPS.has(p.expression.name.text))
  );
}
/** The name a function is declared by (a function or a method, or a variable an arrow or a function is given to). */
function nameOfAFunction(node: ts.Node): string | null {
  if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name) return node.name.getText();
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.initializer &&
    (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
  )
    return node.name.text;
  return null;
}
/** Each function of a file, by its name, with the unit-name checks in it (0 for a function with none); a check
 *  inside a nested function that has no name counts for the named one around it, and one outside any function for
 *  '(top)'. */
export function unitNameChecksByFunction(file: string, text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const visit = (node: ts.Node, inside: string): void => {
    const named = nameOfAFunction(node);
    if (named) counts.set(named, counts.get(named) ?? 0);
    const fn = named ?? inside;
    if (ts.isStringLiteral(node) && isAUnitNameCheck(node)) counts.set(fn, (counts.get(fn) ?? 0) + 1);
    ts.forEachChild(node, (child) => {
      visit(child, fn);
    });
  };
  visit(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true), '(top)');
  return counts;
}
/** The files whose unit-name checks unitNameChecksInEngine counts. */
export const countsUnitNameChecks = (file: string): boolean =>
  file.startsWith('src/engine/') && !file.startsWith('src/engine/rules/') && file.endsWith('.ts');
/** The unit-name checks in the files of src/engine/ outside src/engine/rules/, for the files given as [path from the
 *  repository's root, text]. */
export function unitNameChecksInEngine(codeFiles: readonly (readonly [file: string, text: string])[]): number {
  let n = 0;
  for (const [file, text] of codeFiles) {
    if (!countsUnitNameChecks(file)) continue;
    for (const count of unitNameChecksByFunction(file, text).values()) n += count;
  }
  return n;
}

// The engine's checks of an item's effect by its key, or of an item by its name (plan P1-19's items family, Decision 6
// and Choice 4): a string naming an item's effect key (a `stat` that isn't a skill, a `use`, a `ward` or a rider's
// `pc.ward`) or an item (its name, or a second name of it), read from the content's tables, Mithril Armour added (a
// dwarven birthright in no table), that the code compares with a `stat`, `use`, `ward` or `st`, a `.name` or
// `_ITEM_ALT_BASE` (===, !==, ==, !=), switches on one of those, or passes to hasItemBase, has or itemStat, counted by
// syntax tree in the files of src/engine/ outside src/engine/rules/. The items' registry takes them out row by row (an
// effect is found by the key a held copy carries, in src/engine/rules/), so the count only falls.
// tests/static/the-resolvers-the-item-registry-has-taken-name-no-item-effect.test.ts counts the functions the registry
// has taken, with itemEffectChecksByFunction, at 0 each. The vocabulary is the content's tables as written: the engine's
// load-time pass (src/engine/items/) rewrites the list of items, and this file never loads the engine.
if (ALL_MAGIC_ITEMS_P.some((item) => '_score' in item))
  throw new Error("tools/ratchet.ts reads the items' vocabulary as content writes it: import it before the engine.");
const SKILLS: ReadonlySet<string> = new Set(KC_SKILLS);
/** Every string naming an item's effect key or an item (above). */
export const ITEM_EFFECT_VOCABULARY: ReadonlySet<string> = new Set([
  ...[...ALL_MAGIC_ITEMS_P, ...LEGENDARY_ITEMS_P].flatMap((item) => {
    const effect: { stat?: string; use?: string; ward?: string; pc?: { ward?: string } } = item.effect;
    return [
      ...(SKILLS.has(effect.stat ?? '') ? [] : [effect.stat]),
      effect.use,
      effect.ward,
      effect.pc?.ward,
      item.name,
    ].filter((word) => word !== undefined);
  }),
  ...Object.entries(_ITEM_NAME_ALTS).flat(2),
  'mithrilArmour',
  'Mithril Armour',
]);
/** The text of the other side of a comparison, or of a switch, that makes a string in it a check of an item. */
const AN_ITEMS_KEY_OR_NAME = /(\.|\b)(stat|use|ward|st)\b|\.name\b|_ITEM_ALT_BASE/;
const AN_ITEMS_LOOKUPS = new Set(['hasItemBase', 'has', 'itemStat']);
/** Whether a string literal is a check of an item's effect by its key, or of an item by its name (above). */
function isAnItemEffectCheck(node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral): boolean {
  if (!ITEM_EFFECT_VOCABULARY.has(node.text)) return false;
  const p = node.parent;
  if (ts.isBinaryExpression(p) && COMPARISONS.has(p.operatorToken.kind))
    return AN_ITEMS_KEY_OR_NAME.test((p.left === node ? p.right : p.left).getText());
  if (ts.isCaseClause(p)) return AN_ITEMS_KEY_OR_NAME.test(p.parent.parent.expression.getText());
  return (
    ts.isCallExpression(p) &&
    p.arguments.some((argument) => argument === node) &&
    AN_ITEMS_LOOKUPS.has(p.expression.getText())
  );
}
/** Each function of a file, by its name, with the item-effect checks in it (0 for a function with none); a check
 *  inside a nested function that has no name counts for the named one around it, and one outside any function for
 *  '(top)'. */
export function itemEffectChecksByFunction(file: string, text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const visit = (node: ts.Node, inside: string): void => {
    const named = nameOfAFunction(node);
    if (named) counts.set(named, counts.get(named) ?? 0);
    const fn = named ?? inside;
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && isAnItemEffectCheck(node))
      counts.set(fn, (counts.get(fn) ?? 0) + 1);
    ts.forEachChild(node, (child) => {
      visit(child, fn);
    });
  };
  visit(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true), '(top)');
  return counts;
}
/** The item-effect checks in the files of src/engine/ outside src/engine/rules/ (the files unitNameChecksInEngine
 *  counts), for the files given as [path from the repository's root, text]. */
export function itemEffectChecksInEngine(codeFiles: readonly (readonly [file: string, text: string])[]): number {
  let n = 0;
  for (const [file, text] of codeFiles) {
    if (!countsUnitNameChecks(file)) continue;
    for (const count of itemEffectChecksByFunction(file, text).values()) n += count;
  }
  return n;
}

// The engine's checks of a spell by its name or its key (plan P1-19's spells family, Decision 5): a string naming a
// spell (a key of SPELL_DEFS_P) or its `fn` (`'white_resurrect'`), that the code compares (===, !==, ==, !=), switches
// on (a case), or passes to has, includes, indexOf or get (a method of any object, or has or includes alone), counted by
// syntax tree in the files of src/engine/ outside src/engine/rules/ (the scoping's spell-checks.mts rule). The spells'
// registry takes them out row by row (an effect is found by its spell's row, in src/engine/rules/), so the count only
// falls. tests/static/the-resolvers-the-spell-registry-has-taken-name-no-spell.test.ts counts the functions the
// registry has taken, with spellChecksByFunction, at 0 each.
/** Every string naming a spell or its `fn` (above). */
export const SPELL_VOCABULARY: ReadonlySet<string> = new Set(
  Object.entries(SPELL_DEFS_P).flatMap(([name, spell]) => [name, spell.fn]),
);
/** The calls a spell's name or `fn` handed to is a check: a method of these names, or has or includes alone. */
const A_SPELLS_LOOKUP_METHODS = new Set(['has', 'includes', 'indexOf', 'get']);
const A_SPELLS_LOOKUP_FUNCTIONS = new Set(['has', 'includes']);
/** Whether a string literal is a check of a spell by its name or its `fn` (above). */
function isASpellCheck(node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral): boolean {
  if (!SPELL_VOCABULARY.has(node.text)) return false;
  const p = node.parent;
  if (ts.isBinaryExpression(p)) return COMPARISONS.has(p.operatorToken.kind);
  if (ts.isCaseClause(p)) return true;
  if (!ts.isCallExpression(p) || !p.arguments.some((argument) => argument === node)) return false;
  const callee = p.expression;
  return ts.isPropertyAccessExpression(callee)
    ? A_SPELLS_LOOKUP_METHODS.has(callee.name.text)
    : ts.isIdentifier(callee) && A_SPELLS_LOOKUP_FUNCTIONS.has(callee.text);
}
/** Each function of a file, by its name, with the spell checks in it (0 for a function with none); a check inside a
 *  nested function that has no name counts for the named one around it, and one outside any function for '(top)'. */
export function spellChecksByFunction(file: string, text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const visit = (node: ts.Node, inside: string): void => {
    const named = nameOfAFunction(node);
    if (named) counts.set(named, counts.get(named) ?? 0);
    const fn = named ?? inside;
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && isASpellCheck(node))
      counts.set(fn, (counts.get(fn) ?? 0) + 1);
    ts.forEachChild(node, (child) => {
      visit(child, fn);
    });
  };
  visit(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true), '(top)');
  return counts;
}
/** The spell checks in the files of src/engine/ outside src/engine/rules/ (the files unitNameChecksInEngine counts),
 *  for the files given as [path from the repository's root, text]. */
export function spellChecksInEngine(codeFiles: readonly (readonly [file: string, text: string])[]): number {
  let n = 0;
  for (const [file, text] of codeFiles) {
    if (!countsUnitNameChecks(file)) continue;
    for (const count of spellChecksByFunction(file, text).values()) n += count;
  }
  return n;
}

// The engine's checks of a discovery by its id or of a discovery's effect by its kind (plan P1-19's discoveries family,
// Decision 6): a string naming a discovery of SAGE_DISCOVERIES_P by its id (`'sd40'`), anywhere but where a reader of
// the discoveries takes no id (below), or naming an effect's kind (`'unitStr'`) as the kind a reader takes or compared
// with an effect's `.kind` or `.type`, counted by syntax tree in the files of src/engine/ outside src/engine/rules/ (the
// scoping's disc-checks.mts rule). The readers: hasDisc, discParam, discEff, discSum, discEffectsOf, discSumOf, and the
// bots' botHasDisc, each with the place of the id or kind it takes. The vocabulary is content's, so the two
// retired ids (sd30 and sd34, which a save's mending names) aren't counted. The discoveries' registry takes them out
// row by row (an effect is found by its kind, in src/engine/rules/), so the count only falls.
// tests/static/the-resolvers-the-discovery-registry-has-taken-name-no-discovery.test.ts counts the functions the
// registry has taken, with discoveryChecksByFunction, at 0 each.
/** Every discovery's id, and every kind of effect, as content writes them. */
export const DISCOVERY_IDS: ReadonlySet<string> = new Set(SAGE_DISCOVERIES_P.map((d) => d.id));
export const DISCOVERY_EFFECT_KINDS: ReadonlySet<string> = new Set(
  SAGE_DISCOVERIES_P.flatMap((d): readonly { readonly kind?: string }[] => [
    ...('effect' in d ? [d.effect] : []),
    ...('effect2' in d ? [d.effect2] : []),
  ]).flatMap((e) => (e.kind === undefined ? [] : [e.kind])),
);
/** The readers of the discoveries, each with the place of the id or the kind it takes. */
const A_DISCOVERYS_READERS: ReadonlyMap<string, number> = new Map([
  ['hasDisc', 2],
  ['botHasDisc', 2],
  ['discParam', 0],
  ['discEff', 2],
  ['discSum', 2],
  ['discEffectsOf', 1],
  ['discSumOf', 1],
]);
/** Whether a string literal is a check of a discovery by its id or of an effect by its kind (above). */
function isADiscoveryCheck(node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral): boolean {
  const isAnId = DISCOVERY_IDS.has(node.text);
  if (!isAnId && !DISCOVERY_EFFECT_KINDS.has(node.text)) return false;
  const p = node.parent;
  if (ts.isCallExpression(p) && p.arguments.some((argument) => argument === node)) {
    const callee = p.expression;
    const name = ts.isPropertyAccessExpression(callee) ? callee.name.text : callee.getText();
    const at = A_DISCOVERYS_READERS.get(name);
    if (at !== undefined) return p.arguments.indexOf(node) === at;
    return isAnId;
  }
  if (isAnId) return true;
  if (!ts.isBinaryExpression(p) || !COMPARISONS.has(p.operatorToken.kind)) return false;
  const other = p.left === node ? p.right : p.left;
  return /\.(kind|type)$/.test(other.getText());
}
/** Each function of a file, by its name, with the discovery checks in it (0 for a function with none); a check inside a
 *  nested function that has no name counts for the named one around it, and one outside any function for '(top)'. */
export function discoveryChecksByFunction(file: string, text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const visit = (node: ts.Node, inside: string): void => {
    const named = nameOfAFunction(node);
    if (named) counts.set(named, counts.get(named) ?? 0);
    const fn = named ?? inside;
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && isADiscoveryCheck(node))
      counts.set(fn, (counts.get(fn) ?? 0) + 1);
    ts.forEachChild(node, (child) => {
      visit(child, fn);
    });
  };
  visit(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true), '(top)');
  return counts;
}
/** The discovery checks in the files of src/engine/ outside src/engine/rules/ (the files unitNameChecksInEngine
 *  counts), for the files given as [path from the repository's root, text]. */
export function discoveryChecksInEngine(codeFiles: readonly (readonly [file: string, text: string])[]): number {
  let n = 0;
  for (const [file, text] of codeFiles) {
    if (!countsUnitNameChecks(file)) continue;
    for (const count of discoveryChecksByFunction(file, text).values()) n += count;
  }
  return n;
}

// The engine's checks of a guardian's perk (plan P1-19's guardian perks, Decision 5): in the files of src/engine/
// outside src/engine/rules/, counted by syntax tree (the scoping's perk-checks.mts rule): (a) a string naming a kind of
// perk (a perk's `fx.ward`, or its rider's key, as MONSTERS_P writes them) that the code compares (===, !==, ==, !=),
// switches on (a case), or passes to has, includes, get or indexOf (a method, or a function of that name) or to the
// lines' perk finders; (b) a use of a field of the wards a fighter wears (`x.arm.f`, `x.arm?.f`, `x.arm['f']`, or
// through a name the function binds to `x.arm`; not `names`, the lines'), or of a ward only a guardian's perk sets
// (`stunWard`, `dotWard`, `schoolWard`: a perk's ward no item carries) on anything; (c) in src/engine/personal-combat/
// only (a hero's skill aura is an `aura` elsewhere), a read of a fighter's rider (a perk's rider key, or the aura's
// mark on his foe, `auraPenalty`): not a write (`=`), nor a field handed whole to a call. The guardian perks' registry
// takes them out row by row (an effect reads a perk's ward or rider, in src/engine/rules/), so the count only falls.
// tests/static/the-resolvers-the-guardian-registry-has-taken-name-no-perk.test.ts counts the functions the registry has
// taken, with guardianPerkChecksByFunction, at 0 each.
/** A guardian's perks' effects as content writes them (`fx`): a ward, or a rider by its key. */
const THE_PERKS_EFFECTS: readonly Readonly<Record<string, unknown>>[] = MONSTERS_P.flatMap((guardian) =>
  guardian.passives.map((perk): Readonly<Record<string, unknown>> => perk.fx),
);
/** The fields of a perk's effect that hold its number or its school, not its kind. */
const A_PERKS_OTHER_FIELDS: ReadonlySet<string> = new Set(['ward', 'pct', 'amt', 'school']);
/** Every kind of guardian perk: a perk's ward, or its rider's key (above). */
export const GUARDIAN_PERK_VOCABULARY: ReadonlySet<string> = new Set(
  THE_PERKS_EFFECTS.flatMap((fx) =>
    typeof fx['ward'] === 'string' ? [fx['ward']] : Object.keys(fx).filter((key) => !A_PERKS_OTHER_FIELDS.has(key)),
  ),
);
/** The wards only a guardian's perk sets: a perk's ward that no item carries (as an armour's or a rider's ward). */
const A_GUARDIANS_OWN_WARDS: ReadonlySet<string> = new Set(
  THE_PERKS_EFFECTS.flatMap((fx) => (typeof fx['ward'] === 'string' ? [fx['ward']] : [])).filter(
    (ward) =>
      ![...ALL_MAGIC_ITEMS_P, ...LEGENDARY_ITEMS_P].some((item) => {
        const effect: { ward?: string; pc?: { ward?: string } } = item.effect;
        return effect.ward === ward || effect.pc?.ward === ward;
      }),
  ),
);
/** A fighter's riders as the fight reads them: a perk's rider keys, and the aura's mark on his foe. */
const A_FIGHTERS_RIDERS: ReadonlySet<string> = new Set([
  ...THE_PERKS_EFFECTS.flatMap((fx) =>
    typeof fx['ward'] === 'string' ? [] : Object.keys(fx).filter((key) => !A_PERKS_OTHER_FIELDS.has(key)),
  ),
  'auraPenalty',
]);
/** The calls a kind of perk handed to is a check: a lookup, or one of the lines' perk finders. */
const A_PERKS_LOOKUPS = new Set([
  'has',
  'includes',
  'get',
  'indexOf',
  'aFightersPerkNameAsTheLineTellsIt',
  'aFightersWardAsTheLineTellsIt',
]);
/** An expression without its parentheses and its `!`. */
function withoutItsParentheses(node: ts.Expression): ts.Expression {
  return ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node)
    ? withoutItsParentheses(node.expression)
    : node;
}
/** Each function of a file, by its name, with the checks of a guardian's perk in it (0 for a function with none); a
 *  check inside a nested function that has no name counts for the named one around it, and one outside any function
 *  for '(top)'. A name bound to a fighter's wards is the named function's. */
export function guardianPerkChecksByFunction(file: string, text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const inPersonalCombat = file.startsWith('src/engine/personal-combat/');
  const add = (fn: string): void => {
    counts.set(fn, (counts.get(fn) ?? 0) + 1);
  };
  const isTheWards = (node: ts.Expression, bound: ReadonlySet<string>): boolean => {
    const b = withoutItsParentheses(node);
    return (ts.isPropertyAccessExpression(b) && b.name.text === 'arm') || (ts.isIdentifier(b) && bound.has(b.text));
  };
  const visit = (node: ts.Node, inside: string, bound: Set<string>): void => {
    const named = nameOfAFunction(node);
    if (named) counts.set(named, counts.get(named) ?? 0);
    const fn = named ?? inside;
    const theBound = named ? new Set<string>() : bound;
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      isTheWards(node.initializer, theBound)
    )
      theBound.add(node.name.text);
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      GUARDIAN_PERK_VOCABULARY.has(node.text)
    ) {
      const p = node.parent;
      if ((ts.isBinaryExpression(p) && COMPARISONS.has(p.operatorToken.kind)) || ts.isCaseClause(p)) add(fn);
      else if (ts.isCallExpression(p) && p.arguments.some((argument) => argument === node)) {
        const callee = p.expression;
        if (A_PERKS_LOOKUPS.has(ts.isPropertyAccessExpression(callee) ? callee.name.text : callee.getText())) add(fn);
      }
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const field = ts.isPropertyAccessExpression(node)
        ? node.name.text
        : ts.isStringLiteral(node.argumentExpression)
          ? node.argumentExpression.text
          : null;
      if (field !== null && field !== 'names' && isTheWards(node.expression, theBound)) add(fn);
      else if (field !== null && A_GUARDIANS_OWN_WARDS.has(field)) add(fn);
      else if (field !== null && inPersonalCombat && A_FIGHTERS_RIDERS.has(field)) {
        const p = node.parent;
        const written =
          ts.isBinaryExpression(p) && p.left === node && p.operatorToken.kind === ts.SyntaxKind.EqualsToken;
        const handedWhole =
          ts.isPropertyAssignment(p) &&
          p.initializer === node &&
          ts.isObjectLiteralExpression(p.parent) &&
          ts.isCallExpression(p.parent.parent);
        if (!written && !handedWhole) add(fn);
      }
    }
    ts.forEachChild(node, (child) => {
      visit(child, fn, theBound);
    });
  };
  visit(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true), '(top)', new Set());
  return counts;
}
/** The checks of a guardian's perk in the files of src/engine/ outside src/engine/rules/ (the files
 *  unitNameChecksInEngine counts), for the files given as [path from the repository's root, text]. */
export function guardianPerkChecksInEngine(codeFiles: readonly (readonly [file: string, text: string])[]): number {
  let n = 0;
  for (const [file, text] of codeFiles) {
    if (!countsUnitNameChecks(file)) continue;
    for (const count of guardianPerkChecksByFunction(file, text).values()) n += count;
  }
  return n;
}

// The engine's naming of an alignment order by its key (plan P1-19's alignment orders, Decision 4): a string naming a
// row's key (THE_ALIGNMENT_ORDERS, in content: `'consecrate'`, `'harvest_field'`), anywhere but a literal type (a
// check, a `case`, a lookup, an order written, a list, a map's value), counted by syntax tree in the files of
// src/engine/ outside src/engine/rules/ (the scoping's align-checks.mts rule). The rows take them out (the turn, the
// dispatch and the bots read a row's key), so the count only falls.
// tests/static/the-code-the-alignment-orders-rows-have-taken-names-no-orders-key.test.ts counts the functions the rows
// have taken, with alignmentOrderChecksByFunction, at 0 each.
/** Every alignment order's key, as content writes it. */
export const ALIGNMENT_ORDER_VOCABULARY: ReadonlySet<string> = new Set(
  Object.values(THE_ALIGNMENT_ORDERS).map((order): string => order.key),
);
/** Each function of a file, by its name, with the alignment orders' keys named in it (0 for a function with none); one
 *  inside a nested function that has no name counts for the named one around it, and one outside any function for
 *  '(top)'. */
export function alignmentOrderChecksByFunction(file: string, text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const visit = (node: ts.Node, inside: string): void => {
    const named = nameOfAFunction(node);
    if (named) counts.set(named, counts.get(named) ?? 0);
    const fn = named ?? inside;
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      ALIGNMENT_ORDER_VOCABULARY.has(node.text) &&
      !ts.isLiteralTypeNode(node.parent)
    )
      counts.set(fn, (counts.get(fn) ?? 0) + 1);
    ts.forEachChild(node, (child) => {
      visit(child, fn);
    });
  };
  visit(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true), '(top)');
  return counts;
}
/** The alignment orders' keys named in the files of src/engine/ outside src/engine/rules/ (the files
 *  unitNameChecksInEngine counts), for the files given as [path from the repository's root, text]. */
export function alignmentOrderChecksInEngine(codeFiles: readonly (readonly [file: string, text: string])[]): number {
  let n = 0;
  for (const [file, text] of codeFiles) {
    if (!countsUnitNameChecks(file)) continue;
    for (const count of alignmentOrderChecksByFunction(file, text).values()) n += count;
  }
  return n;
}

// The engine's naming of an alignment (plan P1-19's alignment abilities family, Decision A): a string naming one of the
// seven alignments (KC_ALIGNMENTS, in content: `'Neutral'`, `'Undead'`), anywhere but a literal type (a check, a `case`,
// a lookup, a list, a map's key or value), counted by syntax tree in the files of src/engine/ outside src/engine/rules/,
// as alignmentOrderChecksInEngine counts the orders' keys. The family's rows take them out (a rule reads its ability's
// row, through the registry's runner), so the count only falls; the bots' (Decision B), the lines no row moves and a
// race's name that is an alignment's too (`'Undead'`) count as well, so it won't reach 0 with the family.
// tests/static/the-code-the-alignment-abilities-registry-has-taken-names-no-alignment.test.ts counts the functions the
// registry has taken, with alignmentChecksByFunction, at 0 each.
/** Every alignment's name, as content writes it. */
export const ALIGNMENT_VOCABULARY: ReadonlySet<string> = new Set<string>(KC_ALIGNMENTS);
/** Each function of a file, by its name, with the alignments' names in it (0 for a function with none); one inside a
 *  nested function that has no name counts for the named one around it, and one outside any function for '(top)'. */
export function alignmentChecksByFunction(file: string, text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const visit = (node: ts.Node, inside: string): void => {
    const named = nameOfAFunction(node);
    if (named) counts.set(named, counts.get(named) ?? 0);
    const fn = named ?? inside;
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      ALIGNMENT_VOCABULARY.has(node.text) &&
      !ts.isLiteralTypeNode(node.parent)
    )
      counts.set(fn, (counts.get(fn) ?? 0) + 1);
    ts.forEachChild(node, (child) => {
      visit(child, fn);
    });
  };
  visit(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true), '(top)');
  return counts;
}
/** The alignments' names in the files of src/engine/ outside src/engine/rules/ (the files unitNameChecksInEngine
 *  counts), for the files given as [path from the repository's root, text]. */
export function alignmentChecksInEngine(codeFiles: readonly (readonly [file: string, text: string])[]): number {
  let n = 0;
  for (const [file, text] of codeFiles) {
    if (!countsUnitNameChecks(file)) continue;
    for (const count of alignmentChecksByFunction(file, text).values()) n += count;
  }
  return n;
}

// The economy's numbers written in the engine's code (B-06, T7, the rules pulled out: its economy family, B-06b to
// B-06h): a number other than 0 (not a literal type, nor the index of an element read, `a[1]`) in one of the functions
// and tables THE_ECONOMYS_FUNCTIONS_AND_TABLES_IN_THE_ENGINE lists (the taxes and wages of Early Winter, the price
// table, the lairs' gold, the caps, the orders' prices, the wage rules), counted by syntax tree, as the scoping counted
// them (2026-11-22). economyNumbersInTheBots counts the same in the bots' copies of the ledger and the wages
// (THE_ECONOMYS_FUNCTIONS_IN_THE_BOTS). A function nested inside a listed one, named or not, counts for it, and a
// table is a top-level `const`. The family's rows move the numbers into content's rows, so both counts only fall. A
// listed function a row empties stays in its list at 0, so a number moved to an engine function outside the lists
// can't hide:
// tests/static/the-code-the-economys-rows-have-taken-holds-no-number-and-every-listed-function-is-there.test.ts
// holds the functions the rows have taken at 0 each, and fails on a listed function the code no longer declares (it
// leaves its list in its row's pull request).
/** The economy's functions and tables in the engine, outside src/engine/rules/ and the bots, by their file. */
export const THE_ECONOMYS_FUNCTIONS_AND_TABLES_IN_THE_ENGINE: readonly (readonly [file: string, fn: string])[] = [
  [
    'src/engine/turn/early-winter-charms-fade-taxes-wages-raiders-muster-and-garrison-drill.ts',
    'earlyWinterCharmsFadeTaxesWagesRaidersMusterAndGarrisonDrill',
  ],
  ['src/engine/army-tables.ts', 'ARMY_COST_MASTER'],
  ['src/engine/world/tables.ts', 'ENCOUNTER_CLEAR_GOLD_BANDS'],
  ['src/engine/world/tables.ts', 'encounterClearGold'],
  ['src/engine/world/tables.ts', 'ensureLairHoard'],
  ['src/engine/discoveries.ts', 'TAX_BONUS_CAP_PCT'],
  ['src/engine/discoveries.ts', 'taxBonusCap'],
  ['src/engine/discoveries.ts', 'capItemTaxGold'],
  ['src/engine/items/tiers-and-hoards.ts', 'WILD_HUNT_COST'],
  ['src/engine/items/tiers-and-hoards.ts', 'wildHuntPrice'],
  ['src/engine/items/tiers-and-hoards.ts', 'GRAND_HEIST_RICH_TAX'],
  [
    'src/engine/rules-on-plain-values/the-chance-a-practice-alone-raises-a-skill-and-the-price-and-wage-a-druid-or-a-host-leader-cuts.ts',
    'thePriceADruidPaysForABeast',
  ],
  [
    'src/engine/rules-on-plain-values/the-chance-a-practice-alone-raises-a-skill-and-the-price-and-wage-a-druid-or-a-host-leader-cuts.ts',
    'theWageABeastPaysUnderADruid',
  ],
  ['src/engine/rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts', 'heroSkillWage'],
  ['src/engine/rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts', 'theWageOfAHeroInService'],
  [
    'src/engine/rules-on-plain-values/the-chance-a-practice-alone-raises-a-skill-and-the-price-and-wage-a-druid-or-a-host-leader-cuts.ts',
    'theHostLeadersCut',
  ],
  [
    'src/engine/rules-on-plain-values/a-wage-after-each-cut-and-ceiling-a-realms-discoveries-make.ts',
    'aWageAfterEachCut',
  ],
  [
    'src/engine/rules-on-plain-values/a-wage-after-each-cut-and-ceiling-a-realms-discoveries-make.ts',
    'aWageUnderEachCeiling',
  ],
  [
    'src/engine/rules-on-plain-values/a-wage-after-each-cut-and-ceiling-a-realms-discoveries-make.ts',
    'aHerosWageAfterTheCutsAndTheCeilings',
  ],
  ['src/engine/orders/recruit-and-hire-orders-companies-mercenaries-and-heroes.ts', 'resolveRecruitArmiesOrder'],
  ['src/engine/orders/recruit-and-hire-orders-companies-mercenaries-and-heroes.ts', 'resolveHireHeroOrder'],
  ['src/engine/heroes/effective-skills-and-hidden-heroes.ts', 'recalcHeroPay'],
  [
    'src/engine/rules-on-plain-values/the-price-of-a-company-of-a-type-and-the-wage-a-company-draws-before-its-cuts.ts',
    'thePriceOfACompanyOfAType',
  ],
  [
    'src/engine/rules-on-plain-values/the-price-of-a-company-of-a-type-and-the-wage-a-company-draws-before-its-cuts.ts',
    'theWageOfACompany',
  ],
  [
    'src/engine/rules-on-plain-values/the-price-of-a-company-of-a-type-and-the-wage-a-company-draws-before-its-cuts.ts',
    'thePriceOfAMercenaryBand',
  ],
  [
    'src/engine/rules-on-plain-values/the-gold-a-lairs-hoard-holds-drawn-from-its-guardians-band.ts',
    'theGoldALairsHoardHoldsOnADie',
  ],
];
/** The bots' copies of the economy: their ledger, their wages, their tax and what they can afford. */
export const THE_ECONOMYS_FUNCTIONS_IN_THE_BOTS: readonly (readonly [file: string, fn: string])[] = [
  ['src/engine/bots/strategy.ts', 'botLedger'],
  ['src/engine/bots/strategy.ts', 'botUpkeep'],
  ['src/engine/bots/strategy.ts', 'botTaxIncome'],
  ['src/engine/bots/strategy.ts', 'botCanAfford'],
];
/** The name a function or a table is declared by, as the economy's count reads it: a function or a method, or a
 *  top-level `const` (a table, or an arrow or a function given to it). */
function nameOfAnEconomysFunctionOrTable(node: ts.Node): string | null {
  if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name) return node.name.getText();
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    ts.isVariableDeclarationList(node.parent) &&
    ts.isVariableStatement(node.parent.parent) &&
    ts.isSourceFile(node.parent.parent.parent)
  )
    return node.name.text;
  return null;
}
/** Each function and top-level table of a file, by its name, with the numbers other than 0 written in it (0 for one
 *  with none), a literal type's and an element's index aside; a number inside a nested function counts for the
 *  function or table around it, and one outside any for '(top)'. */
export function economyNumbersByFunction(file: string, text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const visit = (node: ts.Node, inside: string): void => {
    const named = nameOfAnEconomysFunctionOrTable(node);
    if (named) counts.set(named, counts.get(named) ?? 0);
    const fn = named ?? inside;
    if (
      ts.isNumericLiteral(node) &&
      Number(node.text) !== 0 &&
      !ts.isLiteralTypeNode(node.parent) &&
      !(ts.isElementAccessExpression(node.parent) && node.parent.argumentExpression === node)
    )
      counts.set(fn, (counts.get(fn) ?? 0) + 1);
    ts.forEachChild(node, (child) => {
      visit(child, fn);
    });
  };
  visit(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true), '(top)');
  return counts;
}
/** The numbers in the functions and tables listed, for the files given as [path from the repository's root, text]. */
function economyNumbersIn(
  listed: readonly (readonly [file: string, fn: string])[],
  codeFiles: readonly (readonly [file: string, text: string])[],
): number {
  let n = 0;
  for (const [file, text] of codeFiles) {
    const theFunctions = listed.filter(([f]) => f === file).map(([, fn]) => fn);
    if (theFunctions.length === 0) continue;
    const counts = economyNumbersByFunction(file, text);
    for (const fn of theFunctions) n += counts.get(fn) ?? 0;
  }
  return n;
}
/** The economy's numbers in the engine's functions and tables listed (above). */
export const economyNumbersInEngine = (codeFiles: readonly (readonly [file: string, text: string])[]): number =>
  economyNumbersIn(THE_ECONOMYS_FUNCTIONS_AND_TABLES_IN_THE_ENGINE, codeFiles);
/** The economy's numbers in the bots' functions listed (above). */
export const economyNumbersInTheBots = (codeFiles: readonly (readonly [file: string, text: string])[]): number =>
  economyNumbersIn(THE_ECONOMYS_FUNCTIONS_IN_THE_BOTS, codeFiles);

// The engine's checks of a title by its key or its name (B-06, T7, the rules pulled out: its Reckoning and titles
// family, B-06i to B-06r): a string naming an Imperial Title (TITLE_DEFS, in content) or a minor title (MINOR_TITLES,
// in content since B-06i, read from its syntax tree as it was in the engine), by its key
// (`'duelist'`) or its name (`'The Duelist'`), anywhere but a literal type, counted by syntax tree in the files of
// src/engine/ outside src/engine/rules/, the bots' included, as the scoping counted them (2026-11-22). Six Imperial keys
// are left out of the words: `sea`, `spy`, `monster`, `beast`, `wild` and `arch` are also a terrain's, a skill's, a
// category's, a rite's or a ladder's words, so a string of theirs is mostly not a title. The count can't see a title
// read as a property's key (`G._minorHolders?.warlock`), nor one of the six keys. The family's rows move the titles'
// rules into content's rows, so the count only falls.
// tests/static/the-code-the-titles-rows-have-taken-names-no-title.test.ts holds the functions the rows have taken at
// 0 each, with titleChecksByFunction.
/** The six Imperial keys that are another rule's words too (above). */
export const THE_IMPERIAL_KEYS_THAT_ARE_OTHER_WORDS: ReadonlySet<string> = new Set([
  'sea',
  'spy',
  'monster',
  'beast',
  'wild',
  'arch',
]);
/** The file that declares MINOR_TITLES (B-06i: content's rows; it was src/engine/titles/reckoning.ts's). */
export const THE_MINOR_TITLES_FILE =
  'src/content/the-minor-titles-their-keys-names-perks-requirements-and-how-each-holder-is-found.ts';
/** Each minor title's key and name, in the order written, read from the syntax tree of the array MINOR_TITLES (behind
 *  a `satisfies`, and an `as const` within it). */
export function theMinorTitlesKeysAndNames(text: string): string[] {
  const source = ts.createSourceFile(THE_MINOR_TITLES_FILE, text, ts.ScriptTarget.Latest, true);
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const d of statement.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || d.name.text !== 'MINOR_TITLES' || !d.initializer) continue;
      const typed = ts.isSatisfiesExpression(d.initializer) ? d.initializer.expression : d.initializer;
      const list = ts.isAsExpression(typed) ? typed.expression : typed;
      if (!ts.isArrayLiteralExpression(list)) break;
      return list.elements.flatMap((title) =>
        ts.isObjectLiteralExpression(title)
          ? title.properties.flatMap((p) =>
              ts.isPropertyAssignment(p) &&
              ts.isIdentifier(p.name) &&
              (p.name.text === 'key' || p.name.text === 'name') &&
              ts.isStringLiteral(p.initializer)
                ? [p.initializer.text]
                : [],
            )
          : [],
      );
    }
  }
  throw new Error(`${THE_MINOR_TITLES_FILE}: no "const MINOR_TITLES = [...]" found. The ratchet reads its titles.`);
}
/** Every string naming a title by its key or its name (above). */
export const TITLE_VOCABULARY: ReadonlySet<string> = new Set(
  [
    ...TITLE_DEFS.flatMap((title): string[] => [title.key, title.name]),
    ...theMinorTitlesKeysAndNames(fs.readFileSync(path.join(ROOT, THE_MINOR_TITLES_FILE), 'utf8')),
  ].filter((word) => !THE_IMPERIAL_KEYS_THAT_ARE_OTHER_WORDS.has(word)),
);
/** Each function of a file, by its name, with the titles' keys and names in it (0 for a function with none); one
 *  inside a nested function that has no name counts for the named one around it, and one outside any function for
 *  '(top)'. */
export function titleChecksByFunction(file: string, text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const visit = (node: ts.Node, inside: string): void => {
    const named = nameOfAFunction(node);
    if (named) counts.set(named, counts.get(named) ?? 0);
    const fn = named ?? inside;
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      TITLE_VOCABULARY.has(node.text) &&
      !ts.isLiteralTypeNode(node.parent)
    )
      counts.set(fn, (counts.get(fn) ?? 0) + 1);
    ts.forEachChild(node, (child) => {
      visit(child, fn);
    });
  };
  visit(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true), '(top)');
  return counts;
}
/** The titles' keys and names in the files of src/engine/ outside src/engine/rules/ (the files unitNameChecksInEngine
 *  counts), for the files given as [path from the repository's root, text]. */
export function titleChecksInEngine(codeFiles: readonly (readonly [file: string, text: string])[]): number {
  let n = 0;
  for (const [file, text] of codeFiles) {
    if (!countsUnitNameChecks(file)) continue;
    for (const count of titleChecksByFunction(file, text).values()) n += count;
  }
  return n;
}

// The world's making's numbers and lists written in the engine's code (B-06, T7, the rules pulled out: its world
// generation family, B-06s to B-06ab), as B-06s (#732) set them on 2026-11-22 (the stages:
// docs/architecture/the-worlds-making-its-stages-their-files-and-how-a-stage-is-moved-into-one.md): in the functions
// and tables THE_WORLDS_MAKINGS_FUNCTIONS_AND_TABLES lists (generateNewGame and the sea share's limits, the province
// pools and their chances, the bots' realms), counted by syntax tree. worldMakingNumbersInEngine counts
// each number other than 0 and 1 (not a literal type, nor the index of an element read, `a[2]`); 1s are left out, as
// most of generateNewGame's are its structure (`rows - 2`, `+ 1`, `length - 1`). worldMakingListsInEngine counts each
// string that is an element of an array literal (`['plain', 'forest']`, the one inside `new Set([...])` too): the name
// pools, the terrains, the beasts, the fleets. Everything a top-level function or table holds counts for it, its nested
// functions' too, named or not. The family's rows move the lists and the numbers into content's rows, so both counts
// only fall; a listed function a row moves keeps its entry at its new home, and one a row empties stays at 0 (the
// stages' functions are read from their list in src/, tools/the-worlds-makings-stages-read-from-their-list-in-src.ts):
// tests/static/the-code-the-worlds-making-rows-have-taken-holds-no-number-nor-list-and-every-listed-function-is-there.test.ts
// holds the functions the rows have taken, and fails on a listed function the code no longer declares.
/** The world's making's functions and tables, by their file: what the counts above read. */
export const THE_WORLDS_MAKINGS_FUNCTIONS_AND_TABLES: readonly (readonly [file: string, fn: string])[] = [
  ['src/engine/world/the-worlds-making/the-sea-share-the-gm-picks-from-the-least-to-the-most.ts', 'SEA_PCT_MIN'],
  ['src/engine/world/the-worlds-making/the-sea-share-the-gm-picks-from-the-least-to-the-most.ts', 'SEA_PCT_MAX'],
  ['src/engine/world/the-worlds-making/the-sea-share-the-gm-picks-from-the-least-to-the-most.ts', 'SEA_PCT_DEFAULT'],
  ['src/engine/world/the-worlds-making/the-sea-share-the-gm-picks-from-the-least-to-the-most.ts', 'normSeaPct'],
  ['src/engine/world/generate.ts', 'generateNewGame'],
  // The stages' functions, S0 to S17, as their list in src/ holds them: a new stage's entry there is counted here.
  ...theStagesTheListHolds().map((s): readonly [file: string, fn: string] => [s.file, s.fn]),
  ['src/engine/world/tables.ts', 'SIGNATURE_WEIGHT_P'],
  ['src/engine/world/tables.ts', 'provincePoolSize'],
  ['src/engine/world/tables.ts', 'FLYER_PROVINCE_KEEP'],
  ['src/engine/world/tables.ts', 'PRIMAL_LAND_CHANCE'],
  ['src/engine/world/tables.ts', 'COASTAL_NAVAL_CHANCE'],
  ['src/engine/world/tables.ts', 'buildHumanoidPool'],
  ['src/engine/world/tables.ts', 'LAND_TERRAINS_GEN'],
  ['src/engine/world/tables.ts', 'HUMANOID_FLEET_TYPES'],
  ['src/engine/bots/setup.ts', 'BOT_SKILL_BUILD'],
  ['src/engine/bots/setup.ts', 'BOT_KINGDOM_NAME_UNIT'],
  ['src/engine/bots/setup.ts', 'botKingdomName'],
  ['src/engine/bots/setup.ts', 'pickBotAlignmentBalanced'],
  ['src/engine/bots/setup.ts', 'generateBotSetups'],
];
/** The name a top-level function or table is declared by: a function, or a `const` (a table, or an arrow or a
 *  function given to it). */
function nameOfATopLevelFunctionOrTable(node: ts.Node): string | null {
  if (ts.isFunctionDeclaration(node) && node.name && ts.isSourceFile(node.parent)) return node.name.text;
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    ts.isVariableDeclarationList(node.parent) &&
    ts.isVariableStatement(node.parent.parent) &&
    ts.isSourceFile(node.parent.parent.parent)
  )
    return node.name.text;
  return null;
}
/** What the world's making's two counts find in one function or table. */
export interface TheWorldsMakingsCounts {
  /** The numbers other than 0 and 1, a literal type's and an element's index aside. */
  numbers: number;
  /** The strings that are an array literal's elements. */
  lists: number;
}
/** Each top-level function and table of a file, by its name, with its numbers and its lists' strings (above; 0 for one
 *  with none); what a nested function holds counts for the top-level one around it, and what no top-level function or
 *  table holds for '(top)'. */
export function worldMakingCountsByFunction(file: string, text: string): Map<string, TheWorldsMakingsCounts> {
  const counts = new Map<string, TheWorldsMakingsCounts>();
  const theCountsOf = (fn: string): TheWorldsMakingsCounts => {
    const kept = counts.get(fn) ?? { numbers: 0, lists: 0 };
    counts.set(fn, kept);
    return kept;
  };
  const visit = (node: ts.Node, inside: string): void => {
    const named = nameOfATopLevelFunctionOrTable(node);
    const fn = named ?? inside;
    const theirs = theCountsOf(fn);
    if (
      ts.isNumericLiteral(node) &&
      Number(node.text) !== 0 &&
      Number(node.text) !== 1 &&
      !ts.isLiteralTypeNode(node.parent) &&
      !(ts.isElementAccessExpression(node.parent) && node.parent.argumentExpression === node)
    )
      theirs.numbers++;
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      ts.isArrayLiteralExpression(node.parent)
    )
      theirs.lists++;
    ts.forEachChild(node, (child) => {
      visit(child, fn);
    });
  };
  visit(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true), '(top)');
  return counts;
}
/** One of the world's making's counts over the functions and tables listed, for the files given as [path from the
 *  repository's root, text]. */
function worldMakingCountIn(
  what: keyof TheWorldsMakingsCounts,
  codeFiles: readonly (readonly [file: string, text: string])[],
): number {
  let n = 0;
  for (const [file, text] of codeFiles) {
    const theFunctions = THE_WORLDS_MAKINGS_FUNCTIONS_AND_TABLES.filter(([f]) => f === file).map(([, fn]) => fn);
    if (theFunctions.length === 0) continue;
    const counts = worldMakingCountsByFunction(file, text);
    for (const fn of theFunctions) n += counts.get(fn)?.[what] ?? 0;
  }
  return n;
}
/** The world's making's numbers in the functions and tables listed (above). */
export const worldMakingNumbersInEngine = (codeFiles: readonly (readonly [file: string, text: string])[]): number =>
  worldMakingCountIn('numbers', codeFiles);
/** The world's making's lists' strings in the functions and tables listed (above). */
export const worldMakingListsInEngine = (codeFiles: readonly (readonly [file: string, text: string])[]): number =>
  worldMakingCountIn('lists', codeFiles);

// The counts of B-06's Run 3 (T7, the rules pulled out: the races and the tempers, the hero orders, diplomacy, the
// battles and the player portal's alignments), set on 2026-11-24 by Run 3a's first row (#756) on main c5b3b437. Each
// family's rows move its rules into content's rows and the registry (the ratchet's paragraph in
// docs/architecture/the-toolchain-the-checks-and-the-harness.md; the registry's in
// docs/architecture/the-rule-registry-and-the-one-source-for-shared-rules.md), so each count only falls. Each has its
// by-function helper, and a static test (named in its comment) holds the functions its rows have taken at 0. Every
// syntax tree they read is parsed once and shared (theSyntaxTreeOf): nine counts over the same files, one parse each.
const theSyntaxTrees = new Map<string, { text: string; tree: ts.SourceFile }>();
/** A file's syntax tree, parsed once for its text and kept for every count that reads it. */
function theSyntaxTreeOf(file: string, text: string): ts.SourceFile {
  const kept = theSyntaxTrees.get(file);
  if (kept?.text === text) return kept.tree;
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  theSyntaxTrees.set(file, { text, tree });
  return tree;
}
/** A string that one of a count's listed functions holds but is not the count's word: its file, its function (or
 *  '(top)'), the word, and why. Each lets one such string of its function through. */
export type AWordThatIsNotTheCountsWord = readonly [file: string, fn: string, word: string, why: string];
/** Each function of a file, by its name, with the strings in it that are a count's word (0 for a function with none),
 *  a literal type's and an import's aside; one inside a nested function that has no name counts for the named one
 *  around it, and one outside any function for '(top)'. Each listed exception lets one of its function's words
 *  through. */
function theWordsNamedByFunction(
  file: string,
  text: string,
  isTheWord: (word: string) => boolean,
  exceptions: readonly AWordThatIsNotTheCountsWord[] = [],
): Map<string, number> {
  const counts = new Map<string, number>();
  const letThrough = exceptions.filter(([f]) => f === file).map(([, fn, word]) => ({ fn, word, left: 1 }));
  const visit = (node: ts.Node, inside: string): void => {
    const named = nameOfAFunction(node);
    if (named) counts.set(named, counts.get(named) ?? 0);
    const fn = named ?? inside;
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      isTheWord(node.text) &&
      !ts.isLiteralTypeNode(node.parent) &&
      !ts.isImportDeclaration(node.parent)
    ) {
      const exception = letThrough.find((e) => e.fn === fn && e.word === node.text && e.left > 0);
      if (exception) exception.left--;
      else counts.set(fn, (counts.get(fn) ?? 0) + 1);
    }
    ts.forEachChild(node, (child) => {
      visit(child, fn);
    });
  };
  visit(theSyntaxTreeOf(file, text), '(top)');
  return counts;
}
/** A by-function count's total over the files it reads, for the files given as [path from the repository's root,
 *  text]. */
function theTotalOf(
  byFunction: (file: string, text: string) => ReadonlyMap<string, number>,
  reads: (file: string) => boolean,
  codeFiles: readonly (readonly [file: string, text: string])[],
): number {
  let n = 0;
  for (const [file, text] of codeFiles) {
    if (!reads(file)) continue;
    for (const count of byFunction(file, text).values()) n += count;
  }
  return n;
}

// The engine's naming of a race (Run 3a, the races): a string naming a humanoid race (KC_HUMANOID_RACES, in content:
// `'Human'`, `'Elven'`, `'Dwarven'`, `'Orcish'`), the wild's race (`'Primal'`, or a sub-race `'Primal:…'`) or a beast's
// class (`'Creature'`, `'Monster'`), anywhere but a literal type, counted by syntax tree in the files of src/engine/
// outside src/engine/rules/ (the bots' and the world's making's included), as alignmentChecksInEngine counts an
// alignment. The count can't see a race as a property's key (`{ Human: 'plain' }`), a race inside a unit's name
// (`'Orc Garrison'`) or a lower-case form; each row of the family names those it takes.
// tests/static/the-code-the-race-rows-have-taken-names-no-race.test.ts holds the functions the rows have taken at 0
// each, with raceChecksByFunction.
/** The words of the races' count: the humanoid races, the wild's race and the beasts' two classes. */
export const RACE_VOCABULARY: ReadonlySet<string> = new Set<string>([
  ...KC_HUMANOID_RACES,
  'Primal',
  'Creature',
  'Monster',
]);
/** Whether a string names a race (above): a word of the vocabulary, or a sub-race of the wild (`'Primal:Wolf'`). */
export const namesARace = (word: string): boolean => RACE_VOCABULARY.has(word) || word.startsWith('Primal:');
/** Each function of a file, by its name, with the races named in it (theWordsNamedByFunction's rule). */
export const raceChecksByFunction = (file: string, text: string): Map<string, number> =>
  theWordsNamedByFunction(file, text, namesARace);
/** The races named in the files of src/engine/ outside src/engine/rules/ (the files unitNameChecksInEngine counts). */
export const raceChecksInEngine = (codeFiles: readonly (readonly [file: string, text: string])[]): number =>
  theTotalOf(raceChecksByFunction, countsUnitNameChecks, codeFiles);

// The engine's naming of a temper (Run 3a, the tempers): a string naming one of KC_TEMPERS (in content: `'Berserk'`,
// `'Brave'`, `'Cautious'`, `'Cowardly'`), counted as the races are. `'None'`, the guardians' row of no temper, is too
// common a word to count. The tempers' numbers are content's already (TEMPER_TRAITS); the count can't see a temper as a
// property's key (`TEMPER_TRAITS.Brave`, a table keyed by temper).
// tests/static/the-code-the-temper-rows-have-taken-names-no-temper.test.ts holds the functions the rows have taken at 0
// each, with temperChecksByFunction.
/** Every temper's name, as content writes it. */
export const TEMPER_VOCABULARY: ReadonlySet<string> = new Set<string>(KC_TEMPERS);
/** Each function of a file, by its name, with the tempers named in it (theWordsNamedByFunction's rule). */
export const temperChecksByFunction = (file: string, text: string): Map<string, number> =>
  theWordsNamedByFunction(file, text, (word) => TEMPER_VOCABULARY.has(word));
/** The tempers named in the files of src/engine/ outside src/engine/rules/ (the files unitNameChecksInEngine counts). */
export const temperChecksInEngine = (codeFiles: readonly (readonly [file: string, text: string])[]): number =>
  theTotalOf(temperChecksByFunction, countsUnitNameChecks, codeFiles);

// The engine's checks of an order by its kind (Run 3b, the hero orders): a string naming a kind of order (the hero
// orders' rows' keys, in content: OrderKind's kinds, and `'pursue'`, a saved name the turn still reads, but the five
// alignment orders' keys, which their rows give and alignmentOrderChecksInEngine counts) that the code (a)
// compares (===, !==, ==, !=) with an order's kind: an expression ending `action` (`o.action`, `_action`), a call of
// normaliseAction, or a name the function binds to one (`const a = o.action`, or a parameter of a function whose name
// says Order); (b) is a `case` of a switch over one; (c) is an element of an array literal whose strings, two or more,
// are all kinds, any other element not a string (a list of kinds, a row's key beside them or not); (d) gives as a
// default (`|| 'defend'`) or assigns to an action (`o.action = 'rest'`); or (e) is a value of the kinds' own table
// (PHASE_ACTION_MAP). Counted by syntax tree in the files of src/engine/ outside src/engine/rules/;
// orderKindChecksInTheBots counts the same in src/engine/bots/, and orderKindChecksInEngine the rest,
// as the economy's two counts are split. Not counted, each for its sense: an order the code writes (`action: 'move'`, a
// bot's or a hire's pre-order), a line's kind (`type: 'move'`), a skill or a line's split handed to a call (`'spy'`),
// a list that mixes kinds with roles, skills or stances, and a comparison or switch over anything else (a duel's stance
// `'challenge'`, a bot's role `'spy'`: a name is bound in its own function only).
// tests/static/the-code-the-order-rows-have-taken-names-no-order-kind.test.ts holds the functions the rows have taken
// at 0 each, with orderKindChecksByFunction.
/** The file that declares OrderKind and PHASE_ACTION_MAP. */
export const THE_ORDER_KINDS_FILE =
  'src/engine/rules-on-plain-values/the-kind-of-order-each-name-of-an-order-reads-as.ts';
/** Every kind of order the count reads (above): the hero orders' rows' keys (content, THE_HERO_ORDERS: OrderKind's
 *  kinds and Pursue's row), but the alignment orders'. */
export const ORDER_KIND_VOCABULARY: ReadonlySet<string> = new Set(
  Object.values(THE_HERO_ORDERS)
    .map((row): string => row.key)
    .filter((kind) => !ALIGNMENT_ORDER_VOCABULARY.has(kind)),
);
/** The text of an expression that is an order's kind: one ending `action`, or a call of normaliseAction. */
const AN_ORDERS_KIND = /(\.|^)_?action$|^normaliseAction\(|^\(?\(?\w+\.action \?\? ''\)/;
/** The names a function binds to an order's kind, anywhere in it (its nested functions' too): a variable given an
 *  order's kind, and, for a function whose name says Order, its parameters. */
function theNamesBoundToAnOrdersKindIn(fn: ts.Node): Set<string> {
  const bound = new Set<string>();
  const collect = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      AN_ORDERS_KIND.test(node.initializer.getText())
    )
      bound.add(node.name.text);
    if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
      const owner = node.parent;
      const ownersName =
        (ts.isFunctionDeclaration(owner) || ts.isMethodDeclaration(owner) || ts.isFunctionExpression(owner)) &&
        owner.name
          ? owner.name.getText()
          : '';
      if (ownersName.includes('Order')) bound.add(node.name.text);
    }
    ts.forEachChild(node, collect);
  };
  collect(fn);
  return bound;
}
/** Whether a string literal of the vocabulary is a check of an order's kind (above), with the names bound around it. */
function isAnOrderKindCheck(
  node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral,
  bound: ReadonlySet<string>,
  inTheKindsFile: boolean,
): boolean {
  const isAnOrdersKind = (e: ts.Expression): boolean => {
    const t = e.getText().trim();
    return AN_ORDERS_KIND.test(t) || (ts.isIdentifier(e) && bound.has(t));
  };
  let p = node.parent;
  while (ts.isParenthesizedExpression(p)) p = p.parent;
  if (ts.isBinaryExpression(p) && COMPARISONS.has(p.operatorToken.kind))
    return isAnOrdersKind(p.left === node || p.left.getText() === node.getText() ? p.right : p.left);
  if (ts.isCaseClause(p)) return isAnOrdersKind(p.parent.parent.expression);
  if (ts.isArrayLiteralExpression(p)) {
    // a list of kinds: its string literals all kinds, two or more of them, any other element not a string (a row's
    // key beside them hides none)
    const theWords = p.elements.filter(
      (e): e is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral =>
        ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e),
    );
    return theWords.length > 1 && theWords.every((e) => ORDER_KIND_VOCABULARY.has(e.text));
  }
  if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.BarBarToken) return true;
  if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.EqualsToken)
    return isAnOrdersKind(p.left) || p.left.getText().includes('action');
  if (ts.isPropertyAssignment(p) && p.initializer === node) {
    const field = p.name.getText();
    return inTheKindsFile && field !== 'type' && field !== 'action';
  }
  return false;
}
/** Each function of a file, by its name, with the checks of an order's kind in it (0 for a function with none); one
 *  inside a nested function that has no name counts for the named one around it, and one outside any function for
 *  '(top)'. A name is bound to an order's kind in the named function that binds it (and the functions inside it). */
export function orderKindChecksByFunction(file: string, text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const inTheKindsFile = file === THE_ORDER_KINDS_FILE;
  const visit = (node: ts.Node, inside: string, bound: ReadonlySet<string>): void => {
    const named = nameOfAFunction(node);
    if (named) counts.set(named, counts.get(named) ?? 0);
    const fn = named ?? inside;
    const theBound = named ? new Set([...bound, ...theNamesBoundToAnOrdersKindIn(node)]) : bound;
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      ORDER_KIND_VOCABULARY.has(node.text) &&
      !ts.isLiteralTypeNode(node.parent) &&
      isAnOrderKindCheck(node, theBound, inTheKindsFile)
    )
      counts.set(fn, (counts.get(fn) ?? 0) + 1);
    ts.forEachChild(node, (child) => {
      visit(child, fn, theBound);
    });
  };
  const tree = theSyntaxTreeOf(file, text);
  visit(tree, '(top)', theNamesBoundToAnOrdersKindOutsideEveryFunction(tree));
  return counts;
}
/** The names bound to an order's kind outside every named function of a file (its top level). */
function theNamesBoundToAnOrdersKindOutsideEveryFunction(tree: ts.SourceFile): Set<string> {
  const bound = new Set<string>();
  const collect = (node: ts.Node): void => {
    if (nameOfAFunction(node)) return;
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      AN_ORDERS_KIND.test(node.initializer.getText())
    )
      bound.add(node.name.text);
    ts.forEachChild(node, collect);
  };
  collect(tree);
  return bound;
}
/** The files of the bots, which orderKindChecksInTheBots counts. */
const isTheBots = (file: string): boolean => file.startsWith('src/engine/bots/');
/** The checks of an order's kind in the engine's files outside src/engine/rules/ and the bots. */
export const orderKindChecksInEngine = (codeFiles: readonly (readonly [file: string, text: string])[]): number =>
  theTotalOf(orderKindChecksByFunction, (f) => countsUnitNameChecks(f) && !isTheBots(f), codeFiles);
/** The checks of an order's kind in the bots' files (src/engine/bots/). */
export const orderKindChecksInTheBots = (codeFiles: readonly (readonly [file: string, text: string])[]): number =>
  theTotalOf(orderKindChecksByFunction, (f) => countsUnitNameChecks(f) && isTheBots(f), codeFiles);

// The engine's naming of a relation between two realms (Run 3b, diplomacy): a string naming a relation's state or the
// Treat declaration (`'enemy'`, `'allied'`, `'neutral'`, `'treat'`), anywhere but a literal type, counted by syntax tree
// in the files of src/engine/ outside src/engine/rules/, the bots' included, as the races are. 'peace', 'war',
// 'hostile' and 'self' are left out: the bots' own decisions, the GM's setting and the relation reader's own value. Two
// strings are a `'neutral'` of another sense, listed so that the count can reach 0: a battle's kind and a death's cause.
// tests/static/the-code-the-relation-rows-have-taken-names-no-relation.test.ts holds the functions the rows have taken
// at 0 each, with relationChecksByFunction.
/** The words of the relations' count: the three states two realms stand in and the Treat declaration, from the
 *  content. */
export const RELATION_VOCABULARY: ReadonlySet<string> = new Set<string>([
  ...Object.values(THE_STATES_TWO_REALMS_STAND_IN),
  THE_TREAT_DECLARATION,
]);
/** The two `'neutral'`s that are no relation (above). */
export const THE_RELATION_WORDS_THAT_ARE_NOT_A_RELATION: readonly AWordThatIsNotTheCountsWord[] = [
  [
    'src/engine/battle/the-battle-against-the-defenders/n11-to-n13-the-casualties-the-rout-and-the-end.ts',
    'theCasualtiesTheRoutAndTheEndOfTheBattleAgainstTheDefenders',
    'neutral',
    "the battle's kind: a battle against a province's neutral defenders",
  ],
  [
    'src/engine/heroes/hero-death-and-leaderless-hosts.ts',
    'handleHeroDeath',
    'neutral',
    "the death's cause: a hero killed by a hero who serves no realm",
  ],
];
/** Each function of a file, by its name, with the relations named in it (theWordsNamedByFunction's rule), the two
 *  listed exceptions let through. */
export const relationChecksByFunction = (file: string, text: string): Map<string, number> =>
  theWordsNamedByFunction(
    file,
    text,
    (word) => RELATION_VOCABULARY.has(word),
    THE_RELATION_WORDS_THAT_ARE_NOT_A_RELATION,
  );
/** The relations named in the files of src/engine/ outside src/engine/rules/ (the files unitNameChecksInEngine
 *  counts). */
export const relationChecksInEngine = (codeFiles: readonly (readonly [file: string, text: string])[]): number =>
  theTotalOf(relationChecksByFunction, countsUnitNameChecks, codeFiles);

// The battles' numbers written in the engine's code (Runs 3c and 3d, the battles): worldMakingNumbersInEngine's rule
// (each number other than 0 and 1, not a literal type nor an element's index), by top-level function and table, in
// every file of src/engine/battle/ (its folders' too: a stage split out of a battle is counted where it goes) but its
// facts' files (`the-facts-…`, a line's words), and in the two files of src/engine/units/ the battles' ride-outs and
// retreats are in. personalCombatNumbersInEngine counts the same in src/engine/personal-combat/ but its facts' file,
// and battleNumbersInTheBots in the bots' battle estimate, its functions listed (THE_BATTLES_FUNCTIONS_IN_THE_BOTS):
// a listed function a row empties stays in the list at 0, so a number moved out of the list can't hide.
// tests/static/the-code-the-battle-rows-have-taken-holds-no-number-and-every-listed-function-is-there.test.ts holds the
// functions the rows have taken at 0 each, with battleNumbersByFunction, and fails on a listed file or bots' function
// the code no longer has.
/** The files of src/engine/units/ that the battles' count reads beside src/engine/battle/. */
export const THE_BATTLES_FILES_IN_THE_UNITS_FOLDER: readonly string[] = [
  'src/engine/units/defend-ride-outs-ambushes-and-reinforcements.ts',
  'src/engine/units/sea-lift-stranding-and-retreats.ts',
];
/** Whether a file is a facts' file (`the-facts-…`), whose numbers are a line's, not a rule's. */
const isAFactsFile = (file: string): boolean => path.posix.basename(file).startsWith('the-facts-');
/** The files whose numbers battleNumbersInEngine counts. */
export const countsBattleNumbers = (file: string): boolean =>
  file.endsWith('.ts') &&
  ((file.startsWith('src/engine/battle/') && !isAFactsFile(file)) ||
    THE_BATTLES_FILES_IN_THE_UNITS_FOLDER.includes(file));
/** The files whose numbers personalCombatNumbersInEngine counts. */
export const countsPersonalCombatNumbers = (file: string): boolean =>
  file.endsWith('.ts') && file.startsWith('src/engine/personal-combat/') && !isAFactsFile(file);
/** The bots' battle estimate: their strength of a host, their ground factor, their guess of a defence, their margin,
 *  the defence bonus they assume and their Druid shortfall. */
export const THE_BATTLES_FUNCTIONS_IN_THE_BOTS: readonly (readonly [file: string, fn: string])[] = [
  ['src/engine/bots/intel.ts', 'botBattleForce'],
  ['src/engine/bots/intel.ts', 'botRaceTerrainMult'],
  ['src/engine/bots/intel.ts', 'botGuessDefence'],
  ['src/engine/bots/intel.ts', 'botMarginFor'],
  ['src/engine/bots/intel.ts', 'BOT_DEF_BONUS'],
  ['src/engine/bots/intel.ts', 'botDruidShortfall'],
];
/** Each top-level function and table of a file, by its name, with its numbers other than 0 and 1 (the world's
 *  making's rule, worldMakingCountsByFunction's numbers). */
export function battleNumbersByFunction(file: string, text: string): Map<string, number> {
  return new Map([...worldMakingCountsByFunction(file, text)].map(([fn, c]): [string, number] => [fn, c.numbers]));
}
/** The battles' numbers in the files of src/engine/battle/ but its facts' files, and in the units' two files. */
export const battleNumbersInEngine = (codeFiles: readonly (readonly [file: string, text: string])[]): number =>
  theTotalOf(battleNumbersByFunction, countsBattleNumbers, codeFiles);
/** Personal combat's numbers in the files of src/engine/personal-combat/ but its facts' file. */
export const personalCombatNumbersInEngine = (codeFiles: readonly (readonly [file: string, text: string])[]): number =>
  theTotalOf(battleNumbersByFunction, countsPersonalCombatNumbers, codeFiles);
/** The battles' numbers in the bots' functions listed (above). */
export function battleNumbersInTheBots(codeFiles: readonly (readonly [file: string, text: string])[]): number {
  let n = 0;
  for (const [file, text] of codeFiles) {
    const theFunctions = THE_BATTLES_FUNCTIONS_IN_THE_BOTS.filter(([f]) => f === file).map(([, fn]) => fn);
    if (theFunctions.length === 0) continue;
    const counts = battleNumbersByFunction(file, text);
    for (const fn of theFunctions) n += counts.get(fn) ?? 0;
  }
  return n;
}

// The sight rules' numbers written in the engine's code (Run 3e, sight's part, from #SIGHT_PR; the ratchet's paragraph
// of docs/architecture/the-toolchain-the-checks-and-the-harness.md): economyNumbersByFunction's rule (each number
// other than 0, not a literal type nor an element's index) in the sight functions THE_SIGHTS_FUNCTIONS_IN_THE_ENGINE
// lists (armySizeBand, enemyCharVisibleTo and nearSpiedProvIds in src/engine/sight/, spotEnemyInOwnedProvince and
// applySpySuccess), counted by syntax tree. The sight rules' sets of provinces and heroes are not numbers, so no count
// reads them. The family's rows move the numbers into content's rows, so the count only falls. A listed function a
// row empties stays in the list at 0, so a number moved out of the list can't hide:
// tests/static/the-code-the-sight-rows-have-taken-holds-no-number-and-every-listed-function-is-there.test.ts holds
// the functions the rows have taken (and the two that hold none from the start) at 0 each, and fails on a listed file
// or function the code no longer has.
/** The engine's sight functions sightNumbersInEngine counts. */
export const THE_SIGHTS_FUNCTIONS_IN_THE_ENGINE: readonly (readonly [file: string, fn: string])[] = [
  ['src/engine/sight/heroes-in-sight-features-discovered-and-army-size-bands.ts', 'armySizeBand'],
  ['src/engine/sight/heroes-in-sight-features-discovered-and-army-size-bands.ts', 'enemyCharVisibleTo'],
  ['src/engine/sight/heroes-in-sight-features-discovered-and-army-size-bands.ts', 'nearSpiedProvIds'],
  ['src/engine/heroes/fame-and-consecration.ts', 'spotEnemyInOwnedProvince'],
  ['src/engine/espionage/what-a-spy-learns.ts', 'applySpySuccess'],
];
/** The sight rules' numbers in the engine's functions listed (above). */
export const sightNumbersInEngine = (codeFiles: readonly (readonly [file: string, text: string])[]): number =>
  economyNumbersIn(THE_SIGHTS_FUNCTIONS_IN_THE_ENGINE, codeFiles);

// The player portal's naming of an alignment (Run 3e, the portal's alignment rules): alignmentChecksByFunction's rule
// (a string naming one of KC_ALIGNMENTS, anywhere but a literal type) in the files of src/ui/, src/views/ and
// src/shared/, where the portal and the views restate an alignment's rule (a realm of none reads as Neutral, the beasts'
// guide, the Research forecast). None is listed as another word: the map's name for the relation "neutral" is
// content's (B-06bu). The count can't see an alignment's rule written in prose or a page's HTML.
// tests/static/the-portal-code-the-alignment-rows-have-taken-names-no-alignment.test.ts holds the functions the rows
// have taken at 0 each, with alignmentChecksOutsideTheEngineByFunction.
/** The files alignmentChecksOutsideTheEngine counts: the TypeScript of src/ui/, src/views/ and src/shared/. */
export const countsAlignmentChecksOutsideTheEngine = (file: string): boolean =>
  /^src\/(ui|views|shared)\//.test(file) && file.endsWith('.ts') && !file.endsWith('.d.ts');
/** Each function of a file, by its name, with the alignments named in it (theWordsNamedByFunction's rule). */
export const alignmentChecksOutsideTheEngineByFunction = (file: string, text: string): Map<string, number> =>
  theWordsNamedByFunction(file, text, (word) => ALIGNMENT_VOCABULARY.has(word));
/** The alignments named in the portal's, the views' and the shared files (above). */
export const alignmentChecksOutsideTheEngine = (
  codeFiles: readonly (readonly [file: string, text: string])[],
): number => theTotalOf(alignmentChecksOutsideTheEngineByFunction, countsAlignmentChecksOutsideTheEngine, codeFiles);

// The number of entries in the array (or new Set([...])) a top-level `const <name> =` holds.
export function allowlistLength(file: string, name: string): number {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const d of statement.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || d.name.text !== name || !d.initializer) continue;
      let init = d.initializer;
      if (ts.isNewExpression(init) && init.arguments?.[0]) init = init.arguments[0];
      if (ts.isArrayLiteralExpression(init)) return init.elements.length;
    }
  }
  throw new Error(`${file}: no "const ${name} = [...]" found. The ratchet counts its entries: update ALLOWLISTS.`);
}

// ESLint's suppressed findings (plan P1-13, Decisions 4 and 13): every rule is an error (eslint.config.js), and what
// the rules found when they came in is listed in ESLint's bulk suppressions, per file and rule with a count, which the
// command line reads (a new finding fails; a suppressed one that no longer occurs fails until it is pruned). Counted
// here, the sum of the counts, so the list only shrinks (the one rise allowed is plan P1-13's Decision 5: a file freed
// from the type check's switch-off may add its own typed findings, listed in its PR).
export const ESLINT_SUPPRESSIONS_FILE = 'eslint-suppressions.json';
// ESLint's own format: file, then rule, then how many of that rule's findings the file may hold.
const Suppressions = z.record(z.string(), z.record(z.string(), z.strictObject({ count: z.int().positive() })));
export function eslintSuppressions(): number {
  const list = Suppressions.parse(JSON.parse(fs.readFileSync(path.join(ROOT, ESLINT_SUPPRESSIONS_FILE), 'utf8')));
  return Object.values(list)
    .flatMap((rules) => Object.values(rules))
    .reduce((n, entry) => n + entry.count, 0);
}

// The import rules' known violations (plan P1-13, Decision 4): what broke a rule of .dependency-cruiser.cjs when it came
// in, listed in this file and let through by npm run lint:arch (--ignore-known). Counted here, so the list only shrinks;
// a finding fixed leaves it in the same PR (tests/static/the-architecture-rules-refuse-planted-imports-cycles-and-
// unused-code.test.ts fails on an entry that no longer occurs).
export const KNOWN_ARCHITECTURE_VIOLATIONS_FILE = '.dependency-cruiser-known-violations.json';
export function knownArchitectureViolations(): number {
  const list: unknown = JSON.parse(fs.readFileSync(path.join(ROOT, KNOWN_ARCHITECTURE_VIOLATIONS_FILE), 'utf8'));
  if (!Array.isArray(list)) throw new Error(`${KNOWN_ARCHITECTURE_VIOLATIONS_FILE} is not a list of violations.`);
  return list.length;
}

// What knip finds (plan P1-13, Decision 4; knip.ts): unused files, exports, types and dependencies, and the rest of its
// kinds. knip keeps no list of known findings, so their number is counted here and only falls. It runs in a child
// process (its API is asynchronous; this count isn't) and exits 1 when it finds anything: its report is still on stdout.
export function unusedCode(root = ROOT): number {
  const bin = path.join(ROOT, 'node_modules', '.bin', 'knip');
  let out: string;
  try {
    out = execFileSync(bin, ['--reporter', 'json', '--no-progress'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (e) {
    const stdout = (e as { stdout?: unknown }).stdout;
    if (typeof stdout !== 'string' || !stdout.startsWith('{')) throw e;
    out = stdout;
  }
  const report = JSON.parse(out) as { issues: Record<string, unknown>[] };
  let n = 0;
  for (const issue of report.issues) {
    for (const found of Object.values(issue)) if (Array.isArray(found)) n += found.length;
  }
  return n;
}

export function measure(): Counts {
  const all = files();
  const codeFiles = theCodeFiles(all);
  return {
    ...countsFromTheCodeFiles(codeFiles),
    allowlistEntries: ALLOWLISTS.reduce((n, a) => n + allowlistLength(a.file, a.name), 0),
    javascriptFiles: all.filter((f) => /\.(js|mjs|cjs)$/.test(f) && !/^(src|public)\//.test(f)).length,
    // The site's own code, inline in its pages until P1-05 split it into src/ (so it wasn't counted before then). Since
    // P1-09e src/ is all TypeScript, so what is left is public/'s two classic scripts, copied as they are (kc-config.js,
    // which staging overwrites, and the staging footer: P1-09d moved them from src/), counted so that no other joins
    // them. The supabase-js copy in public/vendor/ (src/vendor/ until P1-09d) isn't the site's code.
    sourceJavascriptFiles: all.filter(
      (f) => f.endsWith('.js') && /^(src|public)\//.test(f) && !/^(src|public)\/vendor\//.test(f),
    ).length,
    quarantinedTests: all.filter((f) => f.startsWith('tests/quarantine/') && /\.test\.[jt]s$/.test(f)).length,
    vmLoaderTests: vmLoaderTests(all),
    unitNameChecksInEngine: unitNameChecksInEngine(codeFiles),
    itemEffectChecksInEngine: itemEffectChecksInEngine(codeFiles),
    spellChecksInEngine: spellChecksInEngine(codeFiles),
    discoveryChecksInEngine: discoveryChecksInEngine(codeFiles),
    guardianPerkChecksInEngine: guardianPerkChecksInEngine(codeFiles),
    alignmentOrderChecksInEngine: alignmentOrderChecksInEngine(codeFiles),
    alignmentChecksInEngine: alignmentChecksInEngine(codeFiles),
    economyNumbersInEngine: economyNumbersInEngine(codeFiles),
    economyNumbersInTheBots: economyNumbersInTheBots(codeFiles),
    titleChecksInEngine: titleChecksInEngine(codeFiles),
    worldMakingNumbersInEngine: worldMakingNumbersInEngine(codeFiles),
    worldMakingListsInEngine: worldMakingListsInEngine(codeFiles),
    raceChecksInEngine: raceChecksInEngine(codeFiles),
    temperChecksInEngine: temperChecksInEngine(codeFiles),
    orderKindChecksInEngine: orderKindChecksInEngine(codeFiles),
    orderKindChecksInTheBots: orderKindChecksInTheBots(codeFiles),
    relationChecksInEngine: relationChecksInEngine(codeFiles),
    battleNumbersInEngine: battleNumbersInEngine(codeFiles),
    personalCombatNumbersInEngine: personalCombatNumbersInEngine(codeFiles),
    battleNumbersInTheBots: battleNumbersInTheBots(codeFiles),
    sightNumbersInEngine: sightNumbersInEngine(codeFiles),
    alignmentChecksOutsideTheEngine: alignmentChecksOutsideTheEngine(codeFiles),
    eslintSuppressions: eslintSuppressions(),
    knownArchitectureViolations: knownArchitectureViolations(),
    unusedCode: unusedCode(),
  };
}

export function readBaseline(): Counts {
  const json = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) as { counts: Counts };
  return json.counts;
}

// What rose (fails), what fell (lower the baseline), and any count the baseline lacks (fails: add it).
export function compare(baseline: Counts, now: Counts): { rose: string[]; fell: string[] } {
  const rose: string[] = [];
  const fell: string[] = [];
  for (const [key, n] of Object.entries(now)) {
    const was = baseline[key];
    if (was === undefined) rose.push(`${key}: ${String(n)}, but tests/ratchet.json has no baseline for it. Add it.`);
    else if (n > was)
      rose.push(
        `${key} rose from ${String(was)} to ${String(n)}. Take the new one out rather than raise the baseline.`,
      );
    else if (n < was) fell.push(`${key} fell from ${String(was)} to ${String(n)}.`);
  }
  for (const key of Object.keys(baseline)) {
    if (!(key in now)) rose.push(`${key} is in tests/ratchet.json but no longer counted (tools/ratchet.ts).`);
  }
  return { rose, fell };
}

if (path.resolve(process.argv[1] ?? '') === import.meta.filename) {
  const baseline = readBaseline();
  const now = measure();
  const { rose, fell } = compare(baseline, now);
  for (const [key, n] of Object.entries(now)) console.log(`${key}: ${String(n)} (baseline ${String(baseline[key])})`);
  if (fell.length && process.argv.includes('--update')) {
    const lowered = Object.fromEntries(Object.entries(baseline).map(([k, v]) => [k, Math.min(v, now[k] ?? v)]));
    const json = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) as Record<string, unknown>;
    fs.writeFileSync(BASELINE_FILE, JSON.stringify({ ...json, counts: lowered }, null, 2) + '\n');
    console.log('\nLowered tests/ratchet.json: commit it with this change.');
  } else if (fell.length) {
    console.log(`\n${fell.join('\n')}\nGood: lower the baseline in this PR with  npm run ratchet -- --update`);
  }
  if (rose.length) {
    console.log(`\nThe ratchet failed:\n${rose.join('\n')}`);
    process.exitCode = 1;
  }
}
