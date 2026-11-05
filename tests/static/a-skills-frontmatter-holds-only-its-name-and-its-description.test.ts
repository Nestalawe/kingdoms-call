// A Claude Code skill's frontmatter holds only its name and its description. A skill is a folder under the skills'
// folder (tests/the-docs-budgets.json, "skills") with its SKILL.md, whose frontmatter Claude Code reads. Other keys
// there change what a session may do while the skill runs, such as `allowed-tools` (tools used without asking),
// `hooks`, `model` and `context`, so a skill that holds one is more than words.
// Level 0 (static): it reads files and nothing runs; there is no code to call, so no lower level exists.
// - Each skill's folder holds its SKILL.md.
// - Its SKILL.md opens with frontmatter between two "---" lines.
// - The frontmatter's keys are `name` and `description`, each once, and nothing else.
// The skills' links, anchors and backticked paths are checked by tests/docs.test.js, and each skill's bytes by
// tests/static/the-docs-an-agent-reads-first-stay-within-their-budgets.test.ts.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

const BUDGETS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'the-docs-budgets.json'), 'utf8')) as {
  skills: { folder: string };
};

const THE_KEYS_A_SKILL_MAY_HOLD = ['description', 'name'];

/** What is wrong with one skill's SKILL.md, or nothing. */
function findingsOfASkill(skill: string): string[] {
  const file = path.join(ROOT, skill, 'SKILL.md');
  if (!fs.existsSync(file)) return [`${skill}: no SKILL.md`];
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const end = lines.indexOf('---', 1);
  if (lines[0] !== '---' || end < 0) return [`${skill}/SKILL.md: no frontmatter between two "---" lines at its top`];
  // A key starts its line; a line that starts with a space or a tab continues the value above it.
  const keys = lines
    .slice(1, end)
    .flatMap((line) => /^([^\s#][^:]*):/.exec(line)?.[1] ?? [])
    .map((key) => key.trim());
  return keys.slice().sort().join(',') === THE_KEYS_A_SKILL_MAY_HOLD.join(',')
    ? []
    : [`${skill}/SKILL.md: its frontmatter holds ${keys.join(', ') || 'no key'}`];
}

test("a skill's frontmatter holds only its name and its description", () => {
  const { folder } = BUDGETS.skills;
  const skills = fs.existsSync(path.join(ROOT, folder))
    ? fs
        .readdirSync(path.join(ROOT, folder), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => `${folder}/${entry.name}`)
    : [];
  expect(
    skills.flatMap(findingsOfASkill),
    'A skill is words: give its frontmatter only a name and a description',
  ).toEqual([]);
});
