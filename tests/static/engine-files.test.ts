// The engine's file list (plan P1-18c): engineFiles() in src/manifest.ts is the GM page's main list filtered to
// engine/ and views/, so it is derived, not a second list kept in step by hand. Every file under src/engine/ and
// src/views/ must be on that main list, or tests/lib/engine.ts would never load it: the build already stops on a
// file no list names, but not on one listed only in another page.
// Level 0 (static): it reads the manifest and the folder tree; nothing runs.
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { engineFiles, PAGES } from '../../src/manifest.ts';
import { filesUnder, ROOT } from '../../tools/build.ts';

const ENGINE_FOLDERS = ['engine/', 'views/'];
const main = PAGES['kingdoms-call-gm-portal.html']?.blocks['main'] ?? [];
const inFolders = filesUnder(path.join(ROOT, 'src')).filter((f) => ENGINE_FOLDERS.some((d) => f.startsWith(d)));

describe('the engine is every file under src/engine/ and src/views/, in page order', () => {
  test('there are files to check', () => {
    expect(inFolders).toContain('engine/run-turn.js');
    expect(inFolders).toContain('views/turn-report.js');
  });

  test("every one is on the GM page's main list", () => {
    expect(inFolders.filter((f) => !main.includes(f))).toEqual([]);
  });

  test("engineFiles() is exactly those, in the main list's order, the dice and the clock first", () => {
    expect([...engineFiles()].sort()).toEqual([...inFolders].sort());
    expect(engineFiles()).toEqual(main.filter((f) => engineFiles().includes(f)));
    expect(engineFiles().slice(0, 2)).toEqual(['engine/rng.js', 'engine/clock.js']);
  });
});
