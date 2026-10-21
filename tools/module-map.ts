// The module map in docs/ARCHITECTURE.md (plan P1-13, Decision 11): which folder of src/ imports which, drawn by
// dependency-cruiser's Mermaid reporter from the code itself (with .dependency-cruiser.mts's options), one box a
// folder; GitHub draws the block. tests/static/the-module-map-in-architecture-md-is-generated-from-the-imports.test.ts
// fails when the block differs from the code. Rewrite it with:  npx tsx tools/module-map.ts --write
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
export const ARCHITECTURE_FILE = 'docs/ARCHITECTURE.md';
export const REWRITE_COMMAND = 'npx tsx tools/module-map.ts --write';
const START = `<!-- The module map: generated from the imports by ${REWRITE_COMMAND}. Don't edit it by hand. -->`;
const END = '<!-- End of the module map. -->';

// One box a folder: the engine's rules on plain values apart from the rest of the engine, each page's code apart.
const FOLDERS = '^src/(engine/rules-on-plain-values|engine|views|content|shared|schemas|db|ui/[^/]+|rulebook)/';

/** The Mermaid flowchart of src/'s folders and the imports between them, as dependency-cruiser draws it. */
export function moduleMap(root = ROOT): string {
  const bin = path.join(ROOT, 'node_modules', '.bin', 'depcruise');
  const args = ['src', '--include-only', '^src/', '--exclude', '\\.d\\.ts$', '--collapse', FOLDERS];
  return execFileSync(bin, [...args, '--output-type', 'mermaid'], { cwd: root, encoding: 'utf8' }).trim();
}

/** The block between the two markers, as docs/ARCHITECTURE.md holds it (the markers and the fence around it). */
export function mapBlock(map: string): string {
  return `${START}\n\n\`\`\`mermaid\n${map}\n\`\`\`\n\n${END}`;
}

/** The text of docs/ARCHITECTURE.md from its first marker to its last, or null when it has no such block. */
export function blockIn(doc: string): string | null {
  const start = doc.indexOf(START);
  const end = doc.indexOf(END);
  return start < 0 || end < start ? null : doc.slice(start, end + END.length);
}

if (path.resolve(process.argv[1] ?? '') === import.meta.filename) {
  const file = path.join(ROOT, ARCHITECTURE_FILE);
  const doc = fs.readFileSync(file, 'utf8');
  const old = blockIn(doc);
  if (old === null) throw new Error(`${ARCHITECTURE_FILE} has no module map block (its first line: ${START})`);
  const now = mapBlock(moduleMap());
  if (process.argv.includes('--write')) {
    fs.writeFileSync(
      file,
      doc.replace(old, () => now),
    );
    console.log(old === now ? 'The module map was up to date.' : `Rewrote the module map in ${ARCHITECTURE_FILE}.`);
  } else {
    console.log(now);
  }
}
