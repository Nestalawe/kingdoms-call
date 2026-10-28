// The module map in docs/ARCHITECTURE.md is generated from the imports (plan P1-13, Decision 11): the block between
// its two markers is exactly what tools/module-map.ts draws from src/ today, so the map can't drift from the code.
// Level 0 (static): dependency-cruiser reads the sources and nothing runs.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The module map in `docs/ARCHITECTURE.md` (P1-13a, plan P1-13 Decision 11) is exactly what `tools/module-map.ts` draws
// with dependency-cruiser's Mermaid reporter from `src/` today, one box a folder; when it differs, the test prints the
// command that rewrites it (`npx tsx tools/module-map.ts --write`). Planted on a copy of `src/`: an import from the
// Overlord page to the data file adds its arrow, so the map would no longer match. Red with one arrow taken out of the
// docs' block. Level 0: dependency-cruiser reads the sources. TypeScript, in `static/`
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { ARCHITECTURE_FILE, blockIn, mapBlock, moduleMap, REWRITE_COMMAND } from '../../tools/module-map.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

describe('the module map in docs/ARCHITECTURE.md', () => {
  test('is the one dependency-cruiser draws from the imports today', timeLimitForTheWork({ toolRuns: 1 }), () => {
    const block = blockIn(fs.readFileSync(path.join(ROOT, ARCHITECTURE_FILE), 'utf8'));
    expect(block, `${ARCHITECTURE_FILE} has no module map block`).not.toBeNull();
    expect(block, `The module map is out of date. Rewrite it with:  ${REWRITE_COMMAND}`).toBe(mapBlock(moduleMap()));
  });

  test(
    'shows a folder of src/ and an import between folders, and changes when an import does',
    timeLimitForTheWork({ toolRuns: 2, everyFileReads: 1 }),
    () => {
      const map = moduleMap();
      expect(map).toMatch(/^flowchart LR\n/);
      expect(map).toContain('src_ui_player_-->src_shared_');
      expect(map).not.toContain('node_modules');
      // Planted on a copy of src/: the Overlord page imports the data file, an import between two folders it had none
      // between. The map drawn from the copy gains that arrow, so the block in the docs would no longer match.
      const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-module-map-'));
      try {
        fs.cpSync(path.join(ROOT, 'src'), path.join(copy, 'src'), { recursive: true });
        for (const f of ['.dependency-cruiser.mts', 'tsconfig.json'])
          fs.copyFileSync(path.join(ROOT, f), path.join(copy, f));
        fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(copy, 'node_modules'), 'dir');
        expect(map).not.toContain('src_ui_overlord_-->src_content_');
        fs.writeFileSync(
          path.join(copy, 'src/ui/overlord/planted-reads-the-data-file.ts'),
          "import { KC_SEASONS } from '../../content/kingdoms-call-data.ts';\nexport const planted = KC_SEASONS;\n",
        );
        const planted = moduleMap(copy);
        expect(planted).toContain('src_ui_overlord_-->src_content_');
        expect(mapBlock(planted)).not.toBe(mapBlock(map));
      } finally {
        fs.rmSync(copy, { recursive: true, force: true });
      }
    },
  );
});
