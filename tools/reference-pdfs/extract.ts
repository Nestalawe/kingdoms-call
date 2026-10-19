// Dumps the game's tables to one JSON file for the reference PDFs (README.md here). The engine's tables come from the
// engine loaded as the tests load it (tests/lib/engine.ts); the player portal's few (the unit abilities, the orders list,
// the mastery-order hints and the alignment blurbs) are read out of its source, each a top-level `const`.
// Usage: npx tsx tools/reference-pdfs/extract.ts <out.json>
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadEngine } from '../../tests/lib/engine.ts';
import { ROOT } from '../build.ts';

const ENGINE_NAMES = [
  'KC_DATA_STAMP',
  'PRIMAL_ARMY_DEFS_P',
  'MASTERY_UNLOCKS',
  'PROVINCE_ARMIES_P',
  'TEMPER_TRAITS',
  'MONSTERS_P',
  'LAIR_POOLS_CAT_P',
  'LAIR_POOLS_MONSTER_P',
  'ALL_MAGIC_ITEMS_P',
  'LEGENDARY_ITEMS_P',
  'TITLE_DEFS',
  'SAGE_DISCOVERIES_P',
  'SPELL_DEFS_P',
  'KC_UNIT_CLASS',
  'KC_UNIT_TYPE',
  'KC_DRUID_LEVELS',
  'KC_UNIT_BASE_STR',
  'KC_UNIT_Q_MULT',
  'KC_SKILLS',
  'KC_MAGIC_SCHOOLS',
  'KC_SKILL_LABELS',
  'KC_ITEM_UNCAPPED_SKILLS',
  'KC_ITEM_SLOT_CAP',
  'KC_RUMOUR_COST_BY_POWER',
  'KC_CARRIER_BERTHS',
  'KC_BASIC_EXPLORE',
  'KC_ALIGNMENTS',
  'KC_TEMPERS',
  'KC_HUMANOID_RACES',
  'KC_RIVAL_RACE',
  'KC_GRAND_DESIGNS',
  'ARMY_COST_MASTER',
  'ARMY_SPEED_MASTER',
  'FANATIC_CHANCE_BY_ALIGN',
  'STEAL_TIER_PEN',
  'BATTLE_MAGIC_SPELL_NAMES',
  'TERRAIN_MODS',
  'MINOR_TITLES',
  'ENCOUNTER_CLEAR_GOLD_BANDS',
  'SIGNATURE_TERRAIN_P',
  'FEATURE_POOLS_P',
  'LAIR_ITEM_ODDS',
  'ITEM_TIER_TARGET',
  'GUARDIAN_MELEE_BASE',
  'RITUAL_SITE_NAMES',
  '_ITEM_NAME_ALTS',
];

/** The portal's tables: the file (under src/) and the `const` names read out of it. */
const PORTAL_TABLES: ReadonlyArray<readonly [file: string, names: readonly string[]]> = [
  ['ui/player/briefing-and-submit.js', ['UNIT_ABILITIES', 'DESCS']],
  ['ui/player/items-and-heroes.js', ['ACTIONS', 'L79_ORDERS']],
];

/** The source text of `const <name> = <literal>;` in a file, found by matching its brackets (strings and comments skipped). */
function constSource(src: string, name: string): string {
  const m = new RegExp(`(?:^|\\n)[ \\t]*const ${name}\\s*=`).exec(src);
  if (!m) throw new Error(`no const ${name}`);
  let i = m.index + m[0].length;
  while (i < src.length && !'[{('.includes(src.charAt(i))) i++;
  const open = src.charAt(i);
  const close = { '[': ']', '{': '}', '(': ')' }[open] ?? '';
  let depth = 0;
  let str: string | null = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  let j = i;
  for (; j < src.length; j++) {
    const ch = src.charAt(j);
    const next = src.charAt(j + 1);
    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        j++;
      }
      continue;
    }
    if (str !== null) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === str) str = null;
      continue;
    }
    if (ch === '/' && next === '/') {
      lineComment = true;
      continue;
    }
    if (ch === '/' && next === '*') {
      blockComment = true;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      str = ch;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        j++;
        break;
      }
    }
  }
  return `const ${name}=${src.slice(i, j)};`;
}

function main(): void {
  const outFile = process.argv[2];
  if (!outFile) throw new Error('usage: npx tsx tools/reference-pdfs/extract.ts <out.json>');
  const engine = loadEngine({ seed: 1 });
  const out: Record<string, unknown> = {};
  for (const name of ENGINE_NAMES) out[name] = vm.runInContext(name, engine);
  out['SEA_GUARDIAN_NAMES'] = [...(vm.runInContext('SEA_GUARDIAN_NAMES', engine) as Set<string>)];
  for (const [file, names] of PORTAL_TABLES) {
    const src = fs.readFileSync(path.join(ROOT, 'src', file), 'utf8');
    for (const name of names) {
      const context = vm.createContext({});
      out[name === 'DESCS' ? 'ALIGN_DESCS' : name] = vm.runInContext(`${constSource(src, name)}\n${name}`, context);
    }
  }
  fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
  const items = out['ALL_MAGIC_ITEMS_P'] as unknown[];
  const guardians = out['MONSTERS_P'] as unknown[];
  const discoveries = out['SAGE_DISCOVERIES_P'] as unknown[];
  console.log(
    `${String(items.length)} items, ${String(guardians.length)} guardians, ${String(discoveries.length)} discoveries -> ${outFile}`,
  );
}

main();
