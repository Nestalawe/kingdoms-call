// The ability check's stand-ins each name an open backlog row (B-17e, BOT-S3: each stand-in is listed by name with
// its backlog row, and the list is meant to empty, A2). Without it, a stand-in could name a row that was never written,
// or one already deleted, and stay on the list with nothing to empty it.
// Level 0 (static): it reads the check's list and the backlog's files; nothing of the game runs.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { THE_ABILITIES_THE_GAMES_NEED_NOT_SHOW } from '../../tools/balance/the-check-that-every-alignment-ability-is-used-in-some-game.ts';

const BACKLOG = path.resolve(import.meta.dirname, '..', '..', 'docs', 'backlog');

test("each stand-in's row is an open row of the backlog, and names the check's list", () => {
  const rows = fs
    .readdirSync(BACKLOG)
    .filter((f) => f.endsWith('.md') && !f.startsWith('finished-'))
    .flatMap((f) => fs.readFileSync(path.join(BACKLOG, f), 'utf8').split('\n'))
    .filter((l) => l.startsWith('| KD-'));
  const missing = Object.entries(THE_ABILITIES_THE_GAMES_NEED_NOT_SHOW).flatMap(([key, e]) => {
    if (!('row' in e)) return [];
    const row = rows.find((l) => l.startsWith(`| ${e.row} |`));
    return row?.includes('stand-in list') ? [] : [`${key}: ${e.row}`];
  });
  expect(missing, `stand-ins whose row is not open, or doesn't name the list: ${missing.join(', ')}`).toEqual([]);
});
