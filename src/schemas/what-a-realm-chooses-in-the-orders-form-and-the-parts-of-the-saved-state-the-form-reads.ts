// ── What a realm chooses in the orders form, and the parts of the saved state the form reads (B-17n) ────
// The typed input of the player portal's payload (OrdersARealmSubmits, orders-a-realm-submits.ts): what a realm picks
// in the form for one turn, and the parts of the saved state the form is built from. The copy of the form that turns
// them into the payload is tools/balance/the-orders-the-player-portal-sends.ts, held to the portal by a page test
// (tests/page/the-scripted-realm-sends-what-the-player-portal-sends.test.ts). The types live here, where every layer
// may import them as types, so the engine and the bots can name the shape a player's orders take (BOT-V2).
//
// Plain types only: nothing parses them, and like the rest of src/schemas/ they are imported with `import type`.

/** The parts of a hero the form reads (the report's own heroes, from the saved state). */
export interface HeroTheFormLists {
  id: number;
  player: number | null;
  alive: boolean;
  isKing?: boolean;
  /** Where he stands: a Search Lair order's province. */
  location?: number;
  /** Fell this turn: the report lists him, with no form. */
  killedThisTurn?: boolean;
  /** The phase he was hired in this turn: the phases up to it are locked. */
  hiredInPhase?: number;
  /** A newly crowned heir, whose skills the player sets. */
  _isHeir?: boolean;
  _pendingSkillAllocation?: number;
  name?: string;
  temper?: string;
  skills?: Record<string, number>;
  encounterPlan?: { tactics?: string[]; notes?: string; duelStance?: string; evilMode?: string };
}
/** The parts of the saved state the form reads. */
export interface StateTheFormReads {
  characters: HeroTheFormLists[];
  players: { alignment?: string; heroOrder?: string[] }[];
}

/** One phase's order as the player picks it: the order's name in the form and the value of its target field. */
export interface AnOrderPicked {
  action: string;
  target: string;
}
/** A hero's plan as the player sets it: the tactics in order (the form's codes), the pre-battle school (`''` for none),
 *  the battle cry, the duel stance, and an Evil realm's conquest doctrine. */
export interface APlanSet {
  tactics: string[];
  school: string;
  notes: string;
  duelStance: string;
  evilMode?: string;
}
/** What a realm chose in the form for one turn. */
export interface WhatTheRealmChose {
  /** Each hero's orders by his id, phase by phase; a phase left at "— Choose —" is null or absent. */
  orders: Record<string, (AnOrderPicked | null)[]>;
  /** Each hero's plan by his id, and a hired hero's by his card's id; a hero not named keeps the plan the report
   *  shows, and a card the plan it starts with. */
  plans: Record<string, APlanSet>;
  /** An heir's points by his id, one skill a point, in the order spent. */
  heirPoints: Record<string, string[]>;
  /** Which lead of each pending research pair to keep: the pair's key → the lead's id. */
  discoveryChoices: Record<string, string>;
  /** The king's declarations: a realm's index → `'enemy'` or `'treat'`. */
  diplomacy: Record<string, string>;
}
