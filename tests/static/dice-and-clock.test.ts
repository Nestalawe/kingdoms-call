// The game's dice and the engine's clock each come from one place (P1-07). Every random number the site's own code
// draws comes from kcRng() (src/engine/rng.js), the one seeded generator, so a test can replay a whole game from its
// seed; and the engine and its views read the time only through kcClock() (src/engine/clock.js). So:
// - no Math.random anywhere in src/ but src/engine/rng.js and src/vendor/;
// - no Date in src/engine/ or src/views/ but src/engine/clock.js.
// Comments and strings don't count: scripts are parsed (TypeScript's parser reads .js and .ts alike), and only code is
// checked. Other files (the templates, the styles) have no code to parse, so their text is searched, outside HTML
// comments. Until P1-13's lint rule does the same. Level 0 (static): it reads the sources and runs nothing.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, test } from 'vitest';
import { filesUnder, ROOT } from '../../tools/build.ts';

const SRC = path.join(ROOT, 'src');
/** Where each ban doesn't apply, and why. */
const RANDOM_ALLOWED = new Set(['engine/rng.js']); // the generator itself
const DATE_ALLOWED = new Set(['engine/clock.js']); // the clock itself
const DATE_BANNED_IN = ['engine/', 'views/'];

/** One finding per banned read in `text` (the file `file`, relative to src/): "<file>:<line> <what>". */
function findings(file: string, text: string): string[] {
  const bansRandom = !file.startsWith('vendor/') && !RANDOM_ALLOWED.has(file);
  const bansDate = DATE_BANNED_IN.some((d) => file.startsWith(d)) && !DATE_ALLOWED.has(file);
  if (!bansRandom && !bansDate) return [];
  const found: string[] = [];
  const at = (pos: number, what: string) => {
    found.push(`${file}:${String(text.slice(0, pos).split('\n').length)} ${what}`);
  };
  if (!/\.(js|ts)$/.test(file)) {
    const code = text.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '));
    if (bansRandom) for (const m of code.matchAll(/\bMath\s*\.\s*random\b/g)) at(m.index, 'Math.random');
    if (bansDate) for (const m of code.matchAll(/\bDate\b/g)) at(m.index, 'Date');
    return found;
  }
  const kind = file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const isMath = (e: ts.Expression) =>
    (ts.isIdentifier(e) && e.text === 'Math') || (ts.isPropertyAccessExpression(e) && e.name.text === 'Math');
  const visit = (node: ts.Node) => {
    if (bansRandom && ts.isPropertyAccessExpression(node) && node.name.text === 'random' && isMath(node.expression))
      at(node.getStart(source), 'Math.random');
    if (
      bansRandom &&
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      node.argumentExpression.text === 'random' &&
      isMath(node.expression)
    )
      at(node.getStart(source), 'Math.random');
    if (bansDate && ts.isIdentifier(node) && node.text === 'Date') {
      const p = node.parent;
      // x.Date and { Date: … } name a property, not the Date global.
      const isPropertyName =
        (ts.isPropertyAccessExpression(p) && p.name === node) ||
        ((ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p)) && p.name === node);
      if (!isPropertyName) at(node.getStart(source), 'Date');
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe('dice come from kcRng() and the engine reads the time through kcClock()', () => {
  const files = filesUnder(SRC);

  test('the sources are there to check', () => {
    expect(files).toContain('engine/run-turn.js');
    expect(files).toContain('engine/world/generate.js');
    expect(files).toContain('views/hall-of-fame.js');
  });

  test('no Math.random in src/ (but rng.js and vendor/), and no Date in src/engine/ or src/views/ (but clock.js)', () => {
    expect(files.flatMap((f) => findings(f, fs.readFileSync(path.join(SRC, f), 'utf8')))).toEqual([]);
  });

  test('a planted Math.random() or Date in the engine is found; comments, strings and other places are not', () => {
    expect(findings('engine/x.js', 'function f(){ return Math.random(); }\n')).toEqual(['engine/x.js:1 Math.random']);
    expect(findings('engine/x.js', 'const t=\n  new Date().toISOString();\n')).toEqual(['engine/x.js:2 Date']);
    expect(findings('views/x.js', 'const id=`m_${Date.now()}`;')).toEqual(['views/x.js:1 Date']);
    expect(findings('engine/x.js', 'const r=Math["random"], g=window.Math.random;')).toEqual([
      'engine/x.js:1 Math.random',
      'engine/x.js:1 Math.random',
    ]);
    expect(findings('engine/x.js', 'const shuffle=(a,rnd=Math.random)=>a;')).toEqual(['engine/x.js:1 Math.random']);
    expect(findings('ui/gm/x.js', 'const tab=Math.random(), t=new Date();')).toEqual(['ui/gm/x.js:1 Math.random']);
    expect(findings('ui/gm/x.html', '<b onclick="Math.random()"></b><!-- Math.random() -->')).toEqual([
      'ui/gm/x.html:1 Math.random',
    ]);
    const quiet = [
      '// dice = Math.random()*range, read at new Date()',
      '/* Math.random */',
      "const s='Math.random and Date', o={Date:1}, d=o.Date;",
      'const r=kcRng(), t=kcClock();',
    ].join('\n');
    expect(findings('engine/x.js', quiet)).toEqual([]);
    expect(findings('engine/rng.js', 'Math.random();')).toEqual([]);
    expect(findings('engine/clock.js', 'Date.now();')).toEqual([]);
    expect(findings('vendor/lib.js', 'Math.random(); new Date();')).toEqual([]);
  });

  test('a Math.random() and a new Date() planted in the real run-turn.js are found', () => {
    const real = fs.readFileSync(path.join(SRC, 'engine/run-turn.js'), 'utf8');
    const before = findings('engine/run-turn.js', real);
    const planted = findings('engine/run-turn.js', real + '\nconst _x=Math.random(), _t=new Date();\n');
    expect(planted.length - before.length).toBe(2);
  });
});
