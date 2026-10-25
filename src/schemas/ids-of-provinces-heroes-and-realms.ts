// ── The ids of a province, a hero and a realm (plan P1-10a1) ────
// Each is a number in the saved state, branded so that one kind can't be passed where another is wanted (plan P1-10,
// Decision 5): a hero's id where a province's is expected fails to compile. A branded id passes wherever a plain number
// is wanted, not the reverse, so code that reads an id from the state keeps its brand and code that works one out uses
// `number`. The state's id fields use them (saved-game-state.ts: `id`, `location`, `player`, `owner`). The brand is a
// type only: parsing checks a number, as `z.number()` does. An item's id gets its brand when items get ids (P1-20).
//
// src/schemas/ is imported as types only (`import type`) but by the save's upgrade, whose check at load parses with the
// saved state's schema (P1-15d): tests/static/pages-build.test.ts refuses any other value import of it from src/.
import { z } from 'zod';

/** A province's id: its index in `world.provinces`. */
export const ProvinceIdSchema = z.number().brand<'ProvinceId'>();
export type ProvinceId = z.infer<typeof ProvinceIdSchema>;

/** A hero's id (a king's too), in `characters` and in the graveyard. */
export const CharacterIdSchema = z.number().brand<'CharacterId'>();
export type CharacterId = z.infer<typeof CharacterIdSchema>;

/** A realm's index in `players`: a hero's `player`, a province's `owner`. */
export const RealmIndexSchema = z.number().brand<'RealmIndex'>();
export type RealmIndex = z.infer<typeof RealmIndexSchema>;
