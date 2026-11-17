// The Stop hook (tools/hooks/before-stop.ts) runs npm run check only for a session whose transcript shows an edit tool
// (Edit, Write, MultiEdit, NotebookEdit) used on a file inside the repository: a conductor whose rows' agents edit, or a
// session that only reads, stops without the whole check on a tree another session is changing.
// - made-up transcripts: an edit inside the repository (absolute or relative, a notebook too) is seen; one outside it, a
//   folder whose name only starts like the repository's, a read, a shell command, a tool's result or a line that isn't
//   JSON is not;
// - a transcript that can't be read, or none named, is checked (the safe side);
// - the hook itself, handed a transcript with no edit, ends with nothing to say, having decided before it reads the
//   files' state or runs the check.
// Level 1 (unit): plain text, and the hook once in its own process. Static can't: it runs code.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { checksThisSession, theSessionEditedTheRepository } from '../../tools/hooks/before-stop.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const repo = '/work/a-repository';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-stop-hook-test-'));
afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** A transcript line: an assistant's message using `name` with `input`. */
const use = (name: string, input: object) =>
  JSON.stringify({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [
        { type: 'text', text: 'on it' },
        { type: 'tool_use', id: 't1', name, input },
      ],
    },
  });
const transcript = (...lines: string[]) =>
  [JSON.stringify({ type: 'user', message: { content: 'go' } }), ...lines].join('\n');

describe('an edit of the repository, read from the transcript', () => {
  test.each([
    [
      'Edit, by its absolute path',
      use('Edit', { file_path: `${repo}/src/engine/x.ts`, old_string: 'a', new_string: 'b' }),
    ],
    ['Write, by a path from the root', use('Write', { file_path: 'docs/a.md', content: 'x' })],
    ['MultiEdit', use('MultiEdit', { file_path: `${repo}/tests/a.test.ts`, edits: [] })],
    ['NotebookEdit, by its notebook path', use('NotebookEdit', { notebook_path: `${repo}/n.ipynb`, new_source: 'x' })],
  ])('is seen: %s', (_, line) => {
    expect(theSessionEditedTheRepository(transcript(line), repo)).toBe(true);
  });

  test.each([
    ['an edit outside the repository', use('Write', { file_path: '/tmp/kc-conductor/brief-R1.md', content: 'x' })],
    ['an edit of a folder whose name only starts like it', use('Edit', { file_path: `${repo}-old/src/x.ts` })],
    ['the repository itself, not a file in it', use('Write', { file_path: repo })],
    ['a read', use('Read', { file_path: `${repo}/src/engine/x.ts` })],
    ['a shell command, even one that writes', use('Bash', { command: `sed -i '' s/a/b/ ${repo}/src/x.ts` })],
    [
      "a tool's result naming an edit",
      JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', content: '"tool_use" Edit' }] } }),
    ],
    ['a line that is not JSON', '{"tool_use" Edit file_path'],
  ])('is not seen: %s', (_, line) => {
    expect(theSessionEditedTheRepository(transcript(line), repo)).toBe(false);
  });
});

describe('whether a stop is checked', () => {
  test('is checked when no transcript is named, or it cannot be read', () => {
    expect(checksThisSession(undefined, repo)).toBe(true);
    expect(checksThisSession(path.join(tmp, 'none.jsonl'), repo)).toBe(true);
  });

  test('follows the transcript when it is read', () => {
    const edited = path.join(tmp, 'edited.jsonl');
    const read = path.join(tmp, 'read.jsonl');
    fs.writeFileSync(edited, transcript(use('Edit', { file_path: `${repo}/src/x.ts` })));
    fs.writeFileSync(read, transcript(use('Read', { file_path: `${repo}/src/x.ts` })));
    expect(checksThisSession(edited, repo)).toBe(true);
    expect(checksThisSession(read, repo)).toBe(false);
  });

  test(
    'the hook, handed a session that edited nothing, ends at once without the check',
    timeLimitForTheWork({ toolRuns: 1 }),
    () => {
      const read = path.join(tmp, 'only-read.jsonl');
      fs.writeFileSync(read, transcript(use('Read', { file_path: path.join(ROOT, 'CLAUDE.md') })));
      const out = execFileSync(
        path.join(ROOT, 'node_modules', '.bin', 'tsx'),
        [path.join(ROOT, 'tools', 'hooks', 'before-stop.ts')],
        {
          cwd: ROOT,
          encoding: 'utf8',
          input: JSON.stringify({ session_id: 'a-test', hook_event_name: 'Stop', transcript_path: read }),
          timeout: 15_000,
        },
      );
      expect(out).toBe('');
      // and it decides before anything else of the check's: the files' state, or the check itself
      const main =
        fs.readFileSync(path.join(ROOT, 'tools', 'hooks', 'before-stop.ts'), 'utf8').split('async function main')[1] ??
        '';
      const decides = main.indexOf('if (!checksThisSession(input.transcript_path, ROOT)) return 0;');
      expect(decides).toBeGreaterThan(0);
      expect(decides).toBeLessThan(main.indexOf('fingerprint()'));
      expect(decides).toBeLessThan(main.indexOf('await runCheck()'));
    },
  );
});
