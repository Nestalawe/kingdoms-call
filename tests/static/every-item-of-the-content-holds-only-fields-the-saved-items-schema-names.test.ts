// Every item of the content's tables holds only fields the saved item's schema names (plan P1-15f7): each row of
// ALL_MAGIC_ITEMS_P and LEGENDARY_ITEMS_P, with the `id` the engine gives an item as a hero gains it, parses strictly
// against `ItemSchema` (src/schemas/saved-game-state.ts), at any depth (its `effect` and a rider's `pc` too). An item a
// hero holds is saved with his other fields, and the save's check at load (P1-15d) refuses a field the schema doesn't
// name, so a row with one would put a `[Save check]` line in the GM's turn message once a hero gains it. The engine's
// copies of a row under another name (`_tripleLowerTierItems`) hold the row's fields, so the rows are enough. Red on its
// base by design: the War Drum of the Ancients carried `drumTierUp`, which the schema didn't name (Parked since P1-10b9).
// Level 0 (static): the content's tables as written and the schema; nothing of the game runs.
import { expect, test } from 'vitest';
import { ALL_MAGIC_ITEMS_P, LEGENDARY_ITEMS_P } from '../../src/content/kingdoms-call-data.ts';
import { ItemSchema } from '../../src/schemas/saved-game-state.ts';
import { strictIssues } from '../lib/strict-schema.ts';

test('every item of the content parses strictly as a saved item, its fields each one the schema names', () => {
  const rows = [...ALL_MAGIC_ITEMS_P, ...LEGENDARY_ITEMS_P];
  // the tables are read whole: a few hundred rows, the War Drum among them
  expect(rows.length).toBeGreaterThan(400);
  expect(rows.some((row) => row.name === 'War Drum of the Ancients')).toBe(true);
  const refused = rows.flatMap((row) =>
    strictIssues(ItemSchema, { ...row, id: 1 }).map((issue) => `${row.name}: ${issue}`),
  );
  expect(refused).toEqual([]);
});
