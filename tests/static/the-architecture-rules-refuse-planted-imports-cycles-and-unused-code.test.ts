// The architecture rules refuse what they are for (plan P1-13a, Decisions 2, 3 and 4). dependency-cruiser (npm run
// lint:arch, .dependency-cruiser.mts) passes on this tree with its known violations let through, and finds every one
// of them still there; on a copy of the repository it refuses one planted import for each of its rules, a cycle
// through imports that bring code among them, and lets a cycle of type-only imports through; a known violation that
// was fixed but left in the list is found, and the command docs/ARCHITECTURE.md gives takes it out. knip (npm run knip,
// knip.ts) finds a planted unused file, export and dependency, and the ratchet's count (unusedCode) rises by each.
// Level 0 (static): the two tools read the sources of temporary copies (node_modules linked) and nothing runs; each
// test takes a few seconds (knip about 1.5 s a run), so each has a time limit sized to its runs and copies, and so has
// the clean-up that removes the copies (tests/lib/time-limits.ts).
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The architecture rules (P1-13a, plan P1-13 Decisions 2 to 4). dependency-cruiser (`npm run lint:arch`,
// `.dependency-cruiser.mts`) passes on this tree with its known violations let through, and finds every one of them
// still there. On a copy of the repository it refuses one planted import for each of its 15 rules (an engine file
// reading the GM page's code, a cycle of two engine files through imports that bring code, the content, the rules on
// plain values, the rule registry (`src/engine/rules/` importing the dice, P1-19a), the views, `src/shared/`, `src/db/`
// and `ui/shared/` each importing outside what they may, a schema imported as code and re-exported with `export *`,
// `src/rulebook/` reading `src/db/`, the player page reading the GM page's code and the engine, supabase-js outside
// `src/db/`, a missing file), and nothing else, and `npm run lint:arch` fails there; it lets through a cycle of `import
// type` only, a schema's type imported or re-exported as a type, the rule registry reading the rules on plain values
// and the content, and the GM page reading the engine. A known violation fixed but left in the list is found, and `npx
// depcruise src --baseline --baseline-mode shrink-only` takes it out. knip (`npm run knip`, `knip.ts`) finds a planted
// unused file, export and dependency, and nothing else, and the ratchet's `unusedCode` rises by three. Red with the
// cycle rule counting type-only imports, with the engine's rule taken out, or with knip told to skip unused files.
// Level 0: the two tools read the sources of temporary copies and nothing runs (a few seconds a test). TypeScript, in
// `static/`
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { KNOWN_ARCHITECTURE_VIOLATIONS_FILE, unusedCode } from '../../tools/ratchet.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const DEPCRUISE = path.join(ROOT, 'node_modules', '.bin', 'depcruise');
const KNIP = path.join(ROOT, 'node_modules', '.bin', 'knip');
const copies: string[] = [];

// Three tests below make a copy each, and the clean-up removes all three: its limit is one allowance for each copy (it
// takes about 0.15 s on a laptop and 0.5 s on a runner, but went past Vitest's 10 s for a hook once on #239, run 40257932213).
afterAll(
  () => {
    for (const dir of copies) fs.rmSync(dir, { recursive: true, force: true });
  },
  timeLimitForTheWork({ everyFileReads: 3 }).timeout,
);

/** A copy of the files git knows (and new ones not yet added), with this repository's node_modules linked in. */
function copyOfTheRepository(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-architecture-rules-'));
  copies.push(dir);
  const listed = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: ROOT });
  for (const f of listed.toString().split('\0').filter(Boolean)) {
    if (!fs.existsSync(path.join(ROOT, f))) continue;
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
  }
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
  return dir;
}

function plant(dir: string, file: string, code: string): void {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), code);
}

/** npm run lint:arch's exit code in `dir`: what CI's static job and npm run check go by. */
const lintArch = (dir: string) =>
  spawnSync('npm', ['run', '--silent', 'lint:arch'], { cwd: dir, encoding: 'utf8' }).status;

interface Cruise {
  /** What breaks a rule and isn't a known violation: "<rule>: <from> -> <to>", sorted. */
  found: string[];
  /** The known violations found again, and let through. */
  known: number;
  /** The known violations no longer found. */
  stale: number;
}

function cruise(dir: string): Cruise {
  const r = spawnSync(DEPCRUISE, ['src', '--ignore-known', '--output-type', 'json'], {
    cwd: dir,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const { summary } = JSON.parse(r.stdout) as {
    summary: {
      violations: { from: string; to: string; rule: { name: string; severity: string } }[];
      ignore: number;
      baselineStale: number;
    };
  };
  return {
    found: summary.violations
      .filter((v) => v.rule.severity !== 'ignore')
      .map((v) => `${v.rule.name}: ${v.from} -> ${v.to}`)
      .sort(),
    known: summary.ignore,
    stale: summary.baselineStale,
  };
}

const knownList = (dir: string): unknown[] =>
  JSON.parse(fs.readFileSync(path.join(dir, KNOWN_ARCHITECTURE_VIOLATIONS_FILE), 'utf8')) as unknown[];

describe('dependency-cruiser: the layers and no cycle (npm run lint:arch)', () => {
  test('passes on this tree, and finds every known violation still there', timeLimitForTheWork({ toolRuns: 2 }), () => {
    expect(lintArch(ROOT)).toBe(0);
    const now = cruise(ROOT);
    expect(now.found).toEqual([]);
    expect(now.stale).toBe(0);
    expect(now.known).toBe(knownList(ROOT).length);
  });

  // One import planted for each rule, each a file of its own (or a line added to a real one) that imports a file
  // importing nothing, so it breaks that rule alone; and the imports the rules allow, which must pass.
  const PLANTED: { file: string; code: string; refused?: string }[] = [
    {
      // the plan's own case: an engine file reads the GM page's code
      file: 'src/engine/clock.ts',
      code: "\nimport { SEASONS } from '../ui/gm/config.ts';\nexport const plantedSeasons = SEASONS;\n",
      refused: 'the-engine-imports-only-the-engine-and-the-content: src/engine/clock.ts -> src/ui/gm/config.ts',
    },
    {
      file: 'src/engine/planted-cycle-a.ts',
      code: "import { plantedB } from './planted-cycle-b.ts';\nexport const plantedA = (): number => plantedB() + 1;\n",
      refused:
        'no-cycle-through-imports-that-bring-code: src/engine/planted-cycle-a.ts -> src/engine/planted-cycle-b.ts',
    },
    {
      file: 'src/engine/planted-cycle-b.ts',
      code: "import { plantedA } from './planted-cycle-a.ts';\nexport const plantedB = (): number => plantedA.length;\n",
    },
    {
      // a cycle of type-only imports brings no code: let through
      file: 'src/engine/planted-type-cycle-a.ts',
      code: "import type { PlantedB } from './planted-type-cycle-b.ts';\nexport interface PlantedA {\n  b?: PlantedB;\n}\n",
    },
    {
      file: 'src/engine/planted-type-cycle-b.ts',
      code: "import type { PlantedA } from './planted-type-cycle-a.ts';\nexport interface PlantedB {\n  a?: PlantedA;\n}\n",
    },
    {
      file: 'src/content/planted.ts',
      code: "import { kcEsc } from '../ui/shared/kc-safe.ts';\nexport const planted = kcEsc;\n",
      refused: 'the-content-imports-nothing: src/content/planted.ts -> src/ui/shared/kc-safe.ts',
    },
    {
      file: 'src/engine/rules-on-plain-values/planted.ts',
      code: "import { kcRngStream } from '../rng.ts';\nexport const planted = kcRngStream;\n",
      refused:
        'the-rules-on-plain-values-import-only-each-other-and-the-content: src/engine/rules-on-plain-values/planted.ts -> src/engine/rng.ts',
    },
    {
      // an effect of the rule registry reaches the dice only through its hook (plan P1-19, Decision 6)
      file: 'src/engine/rules/planted.ts',
      code: "import { kcRng } from '../rng.ts';\nexport const planted = kcRng;\n",
      refused:
        'the-rule-registry-imports-only-itself-the-rules-on-plain-values-and-the-content: src/engine/rules/planted.ts -> src/engine/rng.ts',
    },
    {
      // …and may read the rules on plain values and the content: let through
      file: 'src/engine/rules/planted-reads-the-rules-on-plain-values.ts',
      code: "import { unitBaseStrength } from '../rules-on-plain-values/unit-types-and-base-strength.ts';\nimport { KC_SEASONS } from '../../content/kingdoms-call-data.ts';\nexport const planted = [unitBaseStrength, KC_SEASONS];\n",
    },
    {
      file: 'src/views/planted.ts',
      code: "import { kcEsc } from '../ui/shared/kc-safe.ts';\nexport const planted = kcEsc;\n",
      refused:
        'the-views-import-only-the-views-the-engine-and-the-content: src/views/planted.ts -> src/ui/shared/kc-safe.ts',
    },
    {
      file: 'src/shared/planted.ts',
      code: "import { kcRngStream } from '../engine/rng.ts';\nexport const planted = kcRngStream;\n",
      refused:
        'shared-imports-only-the-views-the-rules-on-plain-values-and-the-content: src/shared/planted.ts -> src/engine/rng.ts',
    },
    {
      file: 'src/engine/planted-reads-a-schema-as-code.ts',
      code: "import { ProvinceIdSchema } from '../schemas/ids-of-provinces-heroes-and-realms.ts';\nexport const planted = ProvinceIdSchema;\n",
      refused:
        'the-schemas-are-imported-for-code-by-the-saves-upgrade-alone: src/engine/planted-reads-a-schema-as-code.ts -> src/schemas/ids-of-provinces-heroes-and-realms.ts',
    },
    {
      file: 'src/views/planted-re-exports-a-schema.ts',
      code: "export * from '../schemas/ids-of-provinces-heroes-and-realms.ts';\n",
      refused:
        'the-schemas-are-imported-for-code-by-the-saves-upgrade-alone: src/views/planted-re-exports-a-schema.ts -> src/schemas/ids-of-provinces-heroes-and-realms.ts',
    },
    {
      // the save's upgrade, whose check at load parses with the schemas (plan P1-15d), may import them for code: let
      // through (another engine file's value import is refused, above)
      file: 'src/engine/saves/upgrade-a-saved-game-and-check-it.ts',
      code: "import { ProvinceIdSchema } from '../../schemas/ids-of-provinces-heroes-and-realms.ts';\nexport const planted = ProvinceIdSchema;\n",
    },
    {
      // a schema's type, imported or re-exported as a type, from any folder: let through
      file: 'src/engine/planted-reads-a-schema-as-a-type.ts',
      code: "import type { ProvinceId } from '../schemas/ids-of-provinces-heroes-and-realms.ts';\nexport type Planted = ProvinceId;\n",
    },
    {
      file: 'src/ui/player/planted-re-exports-a-schemas-type.ts',
      code: "export type { ProvinceId } from '../../schemas/ids-of-provinces-heroes-and-realms.ts';\n",
    },
    {
      file: 'src/db/planted.ts',
      code: "import { kcRngStream } from '../engine/rng.ts';\nexport const planted = kcRngStream;\n",
      refused: 'the-database-code-imports-only-itself-and-the-schemas: src/db/planted.ts -> src/engine/rng.ts',
    },
    {
      file: 'src/rulebook/planted.ts',
      code: "import { kcDbGuard } from '../db/kc-db-guard.ts';\nexport const planted = kcDbGuard;\n",
      refused: 'only-the-pages-import-the-database-code: src/rulebook/planted.ts -> src/db/kc-db-guard.ts',
    },
    {
      file: 'src/ui/player/planted-reads-the-gm-pages-code.ts',
      code: "import { SEASONS } from '../gm/config.ts';\nexport const planted = SEASONS;\n",
      refused:
        'a-page-imports-no-other-pages-code-but-ui-shared: src/ui/player/planted-reads-the-gm-pages-code.ts -> src/ui/gm/config.ts',
    },
    {
      file: 'src/ui/shared/planted.ts',
      code: "import { KC_SEASONS } from '../../content/kingdoms-call-data.ts';\nexport const planted = KC_SEASONS;\n",
      refused: 'ui-shared-imports-only-itself: src/ui/shared/planted.ts -> src/content/kingdoms-call-data.ts',
    },
    {
      file: 'src/ui/player/planted-reads-the-engine.ts',
      code: "import { kcRngStream } from '../../engine/rng.ts';\nexport const planted = kcRngStream;\n",
      refused: 'only-the-gm-page-imports-the-engine: src/ui/player/planted-reads-the-engine.ts -> src/engine/rng.ts',
    },
    {
      // the GM page may import the engine (plan P1-13, Decision 3): let through
      file: 'src/ui/gm/planted-reads-the-engine.ts',
      code: "import { kcRngStream } from '../../engine/rng.ts';\nexport const planted = kcRngStream;\n",
    },
    {
      // supabase-js isn't installed (the pages read the copy served with the site), so this one breaks two rules
      file: 'src/ui/gm/planted-reads-supabase-js.ts',
      code: "import { createClient } from '@supabase/supabase-js';\nexport const planted = createClient;\n",
      refused: 'only-src-db-imports-supabase-js: src/ui/gm/planted-reads-supabase-js.ts -> @supabase/supabase-js',
    },
    {
      file: 'src/ui/gm/planted-reads-a-missing-file.ts',
      code: "import { nothing } from './no-such-file.ts';\nexport const planted = nothing;\n",
      refused: 'every-import-resolves: src/ui/gm/planted-reads-a-missing-file.ts -> ./no-such-file.ts',
    },
  ];

  test(
    'refuses one planted import for each rule, a runtime cycle among them, and lets type-only imports through',
    timeLimitForTheWork({ toolRuns: 2, everyFileReads: 1 }),
    () => {
      const dir = copyOfTheRepository();
      for (const { file, code } of PLANTED) {
        const was = fs.existsSync(path.join(dir, file)) ? fs.readFileSync(path.join(dir, file), 'utf8') : '';
        plant(dir, file, was + code);
      }
      const refused = PLANTED.flatMap((p) => (p.refused === undefined ? [] : [p.refused]));
      refused.push('every-import-resolves: src/ui/gm/planted-reads-supabase-js.ts -> @supabase/supabase-js');
      const now = cruise(dir);
      expect(now.found).toEqual(refused.sort());
      expect(now.stale).toBe(0);
      // every rule of the config is among them, so none is left untried
      const rules = [...new Set(now.found.map((f) => f.split(':')[0]))].sort();
      const configured = [
        ...fs.readFileSync(path.join(ROOT, '.dependency-cruiser.mts'), 'utf8').matchAll(/^ {6}name: '([^']+)',$/gm),
      ]
        .map((m) => m[1] ?? '')
        .sort();
      expect(rules).toEqual(configured);
      expect(lintArch(dir)).not.toBe(0);
    },
  );

  test(
    'finds a known violation that was fixed but left in the list, and the shrink-only command takes it out',
    timeLimitForTheWork({ toolRuns: 3, everyFileReads: 1 }),
    () => {
      const dir = copyOfTheRepository();
      const file = 'src/db/telemetry.ts';
      const line = "import { TITLE_DEFS } from '../content/kingdoms-call-data.ts';\n";
      const text = fs.readFileSync(path.join(dir, file), 'utf8');
      expect(text).toContain(line);
      plant(dir, file, text.replace(line, ''));
      const before = knownList(dir).length;
      expect(cruise(dir)).toEqual({ found: [], known: before - 1, stale: 1 });
      execFileSync(DEPCRUISE, ['src', '--baseline', '--baseline-mode', 'shrink-only'], { cwd: dir, stdio: 'ignore' });
      expect(knownList(dir).length).toBe(before - 1);
      expect(cruise(dir)).toEqual({ found: [], known: before - 1, stale: 0 });
    },
  );
});

describe('knip: unused files, exports and dependencies (npm run knip), counted by the ratchet', () => {
  /** knip's findings in `dir`: "<kind> <file> <name>". */
  function knip(dir: string): string[] {
    const r = spawnSync(KNIP, ['--reporter', 'json', '--no-progress'], {
      cwd: dir,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    const report = JSON.parse(r.stdout) as { issues: Record<string, unknown>[] };
    return report.issues.flatMap((issue) =>
      Object.entries(issue).flatMap(([kind, found]) =>
        Array.isArray(found)
          ? found.map((f: { name?: unknown }) => `${kind} ${String(issue['file'])} ${String(f.name)}`)
          : [],
      ),
    );
  }

  // knip on this tree, and the ratchet's count of it (unusedCode runs knip too), made once: the test reads them as they
  // are, beside the planted copy's own two runs.
  let before: string[] = [];
  let unusedHere = 0;
  beforeAll(
    () => {
      before = knip(ROOT);
      unusedHere = unusedCode(ROOT);
    },
    timeLimitForTheWork({ toolRuns: 2 }).timeout,
  );

  // knip twice on the planted copy (unusedCode runs it too), and the copy of the repository
  test(
    'finds a planted unused file, export and dependency, and unusedCode rises by three',
    timeLimitForTheWork({ toolRuns: 2, everyFileReads: 1 }),
    () => {
      expect(unusedHere).toBe(before.length);
      const dir = copyOfTheRepository();
      plant(dir, 'src/engine/planted-file-nothing-imports.ts', 'export const planted = 1;\n');
      const clock = fs.readFileSync(path.join(dir, 'src/engine/clock.ts'), 'utf8');
      plant(dir, 'src/engine/clock.ts', clock + '\nexport function plantedNothingCalls(): number {\n  return 1;\n}\n');
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as {
        devDependencies: Record<string, string>;
      };
      pkg.devDependencies['left-pad'] = '1.3.0';
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
      const after = knip(dir);
      expect(after.filter((f) => !before.includes(f)).sort()).toEqual([
        'devDependencies package.json left-pad',
        'exports src/engine/clock.ts plantedNothingCalls',
        'files src/engine/planted-file-nothing-imports.ts src/engine/planted-file-nothing-imports.ts',
      ]);
      expect(unusedCode(dir)).toBe(unusedHere + 3);
    },
  );
});
