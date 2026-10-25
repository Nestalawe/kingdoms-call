// ── The orders a realm submits (plan P1-10a1) ────
// What a player's row sends the turn (game_players.orders, as JSON): the form the player portal writes
// (ui/player/briefing-and-submit.ts) and the merge reads (engine/turn/set-up-the-turns-start-repairs-and-the-merge-of-
// the-realms-orders.ts). The merge reads the ten fields below. The balance matrix's scripted realm sends four of them
// (orders, encounterPlans, forTurn, diplomacy), and every payload it sent parses; the six others are written from the
// portal's form and the merge's reads, and are optional, as the scripted realm leaves them out. A bot sends nothing.
// The merge also reads an older form (the heroes' orders alone, with no encounterPlans), which no page sends now.
//
// Objects are z.object, so a type has exactly the keys named; the tests parse strictly (tests/lib/strict-schema.ts).
// Imported as types only (the save's check at load reads the saved state's schema alone, P1-15d); nothing parses a
// submitted row at run time yet (P1-17 parses rows at the edge).
import { z } from 'zod';
import { SkillLevelsSchema } from './saved-game-state.ts';

/** One phase's order for one hero: the order's name as the form shows it (`Move`, `Cast Spell`, …), its target and
 *  extra choice, and the line the form wrote for it. A Search Lair order also names the province the form planned it
 *  in, so the engine never searches another lair if the march there fails. */
export const PhaseOrderSchema = z.object({
  action: z.string(),
  target: z.string(),
  extra: z.string(),
  desc: z.string(),
  prov: z.number().optional(),
});
export type PhaseOrder = z.infer<typeof PhaseOrderSchema>;

/** A hero's plan for a fight: his tactics in order (`ME`, …, and `CS:<school>` for a spell cast first), the player's
 *  notes, whether he accepts a duel, and an Evil hero's conquest doctrine (`'terror'` or `'enslave'`). */
export const EncounterPlanSchema = z.object({
  tactics: z.array(z.string()),
  notes: z.string(),
  duelStance: z.string(),
  evilMode: z.string().optional(),
});
export type EncounterPlan = z.infer<typeof EncounterPlanSchema>;

/** A newly crowned heir's skills as the player set them, with the name and temper chosen for him. */
export const HeirChoicesSchema = z.object({
  skills: SkillLevelsSchema,
  pending: z.number(),
  name: z.string(),
  temper: z.string(),
  base: SkillLevelsSchema,
});
export type HeirChoices = z.infer<typeof HeirChoicesSchema>;

/** A dispatch to other realms: to every realm (`'all'`) or to the realms listed by index. */
export const DispatchSchema = z.object({
  to: z.union([z.literal('all'), z.array(z.union([z.number(), z.string()]))]),
  text: z.string(),
});
export type Dispatch = z.infer<typeof DispatchSchema>;

export const OrdersARealmSubmitsSchema = z.object({
  /** Each hero's five phase orders, by his id; a hero the realm means to hire, raise or charm this turn by a
   *  synthetic id (`hired_<hero>_via_<hirer>_ph<phase>`, `resurrect_…`, `charm_…`), held until that lands. */
  orders: z.record(z.string(), z.array(PhaseOrderSchema)),
  /** Each hero's plan for a fight, by the same ids. */
  encounterPlans: z.record(z.string(), EncounterPlanSchema),
  /** The turn the orders were written for: orders for another turn are refused. */
  forTurn: z.number(),
  /** The king's stance toward each realm, by its index: `'treat'`, `'enemy'`, …. */
  diplomacy: z.record(z.string(), z.string()),
  /** A newly crowned heir's choices, by his id. */
  kingSkills: z.record(z.string(), HeirChoicesSchema).optional(),
  /** Which of each pending pair of research leads to keep: the pair's key → the lead's id. */
  discoveryChoices: z.record(z.string(), z.string()).optional(),
  /** The realm calls the Reckoning. */
  callReckoning: z.boolean().optional(),
  /** The realm concedes the game. */
  concede: z.boolean().optional(),
  /** Dispatches to other realms. */
  messages: z.array(DispatchSchema).optional(),
  /** The player's own order of his heroes in the orders column, by id. */
  heroOrder: z.array(z.string()).optional(),
});
export type OrdersARealmSubmits = z.infer<typeof OrdersARealmSubmitsSchema>;
