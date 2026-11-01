// The bots name no spell (plan P1-19's spells family, row P1-19an): no file of src/engine/bots/ holds a string that is a
// spell's name (a key of SPELL_DEFS_P) or its `fn` (`'white_resurrect'`), whatever the code does with it (compared,
// handed to a call, held in a list, the value of an order's `target`, or a case). A bot finds a spell by its slug, in
// content (src/content/spell-effects-their-names-numbers-and-words.ts), through one lookup
// (src/engine/bots/the-name-of-a-spell-by-its-slug.ts) that throws on a slug content doesn't hold: a renamed spell stops
// the bots at their first turn instead of leaving a string that matches nothing. The bots' files are untyped (the
// road's Level 4), so the compiler can't check a slug; this test holds the names out, and the first bot turn of a
// game, the slugs.
//
// Red on its row's base by design (87 strings in seven files: spellcraft 25, phase-one 22, specialists 17, strategy 11,
// movement 8, missions 3, economy 1), as the spells registry's static test was: the one exception to refactor-only's
// rule that new tests pass before and after (Theo, 2026-10-25; the spells family's Decision 5, which row an extends to
// the bots).
// Level 0 (static): the files' syntax trees and the content's spells as written; nothing runs.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';
import { ROOT } from '../../tools/build.ts';
import { SPELL_VOCABULARY } from '../../tools/ratchet.ts';

/** Every string of the text that is a spell's name or `fn`, in the order written, with its line (1-based): a string
 *  anywhere (a list, an order's target, a comparison, a case, a call's argument), a template with no holes too. */
function everySpellWordIn(file: string, text: string): string[] {
  const found: string[] = [];
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node): void => {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && SPELL_VOCABULARY.has(node.text))
      found.push(`${node.text} (line ${String(source.getLineAndCharacterOfPosition(node.getStart()).line + 1)})`);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const BOTS = path.join(ROOT, 'src/engine/bots');
const THE_BOTS_FILES = fs
  .readdirSync(BOTS)
  .filter((name) => name.endsWith('.ts'))
  .sort();

test('the bots have files to read', () => {
  expect(THE_BOTS_FILES.length).toBeGreaterThan(10);
  expect(THE_BOTS_FILES).toContain('spellcraft.ts');
});

test.for(THE_BOTS_FILES)('src/engine/bots/%s names no spell or fn', (name) => {
  expect(everySpellWordIn(name, fs.readFileSync(path.join(BOTS, name), 'utf8'))).toEqual([]);
});

// The finder finds what it should: a name in each place the bots had one, an `fn`, a template with no holes; and none of
// the strings that aren't a spell (a school, a line of text that holds a name, a word that is not in the vocabulary).
test('the finder reads a spell in every place a bot wrote one, and nothing else', () => {
  const planted = `
    const a = x.target === 'Flood' && { target: 'Invisibility' };
    const b = ['Oratory', 'Phantasmal Armies'], c = push('psychic', 'Charm', id, 'Charm ' + name);
    const d = school === 'necromancy' ? 'Skeletal Armies' : \`Elemental Summon\`;
    switch (t) { case 'Resurrect': return 'white_resurrect'; }
    const notSpells = ['psychic', 'Cast Curse on ' + name, 'flood', 'Breath of Fire', \`Plague \${n}\`];`;
  expect(everySpellWordIn('planted.ts', planted)).toEqual([
    'Flood (line 2)',
    'Invisibility (line 2)',
    'Oratory (line 3)',
    'Phantasmal Armies (line 3)',
    'Charm (line 3)',
    'Skeletal Armies (line 4)',
    'Elemental Summon (line 4)',
    'Resurrect (line 5)',
    'white_resurrect (line 5)',
  ]);
});
