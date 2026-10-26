// The orders the player portal sends (plan P1-15e2; P1-15e's Decision 2): a typed copy of what `doSubmitOrders`
// (src/ui/player/briefing-and-submit.ts) writes to the realm's row, built from the saved state the turn will load and
// what the realm chose in the form. The balance matrix's scripted realm (scripted.ts) makes the choices; this builds
// the payload from them as the form does, so the matrix's games save what a human realm's orders save.
//
// The form is built from the realm's turn report, which the views write from the same world (src/views/turn-report.ts):
// so the heroes it lists, their order in the column, an heir's skills and the plans it starts from are read here from
// the saved state as the report reads them. The copy is held to the portal by a page test,
// tests/page/the-scripted-realm-sends-what-the-player-portal-sends.test.ts: the portal booted on the realm's report,
// given the same choices through its form, sends exactly this (docs/traps.md, "A rule written twice must change
// twice").
//
// What the form does that this copies:
// - five phase orders for **every hero the report lists**, alive or fallen this turn; a phase left at "— Choose —", a
//   phase locked before a hero was hired, and every phase of a fallen hero (who has no form) read `Defend`, with no
//   target. Each order's `desc` is its name, then ` — <target>` unless it is Move, Defend, Rest, Spy or Explore;
// - **a plan for every living hero**: the tactics in order (`ME` when none), then `CS:<school>` if a pre-battle school
//   is set; the battle cry; the duel stance (`refuse` by default); an Evil realm's conquest doctrine (`terror` by
//   default), which no other realm's form has. A plan not touched is the one the report shows;
// - for an heir, his skills with the points spent, the points left, his name and temper, and the skills he was crowned
//   with;
// - the declarations, the research picks, `callReckoning` and `concede` `false` (as the matrix's realm never calls nor
//   concedes), `messages` always `[]` (the composer was retired on 2026-09-27), the living heroes' ids in the column's
//   order, and the turn.
// What it doesn't copy, as the scripted realm never gives it: the hire, raise and charm cards, a Spy's ` — on <name>`,
// a Search Lair's `prov`, a draft (doSaveOrders).
import type { EncounterPlan, OrdersARealmSubmits, PhaseOrder } from '../../src/schemas/orders-a-realm-submits.ts';

/** The phases of a turn: the form's five seasons. */
export const PHASES = 5;

/** The parts of a hero the form reads (the report's own heroes, from the saved state). */
export interface HeroTheFormLists {
  id: number;
  player: number | null;
  alive: boolean;
  isKing?: boolean;
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
  /** Each hero's plan by his id; a hero not named keeps the plan the report shows. */
  plans: Record<string, APlanSet>;
  /** An heir's points by his id, one skill a point, in the order spent. */
  heirPoints: Record<string, string[]>;
  /** Which lead of each pending research pair to keep: the pair's key → the lead's id. */
  discoveryChoices: Record<string, string>;
  /** The king's declarations: a realm's index → `'enemy'` or `'treat'`. */
  diplomacy: Record<string, string>;
}

/** The orders whose `desc` names no target (doSubmitOrders). */
const NO_TARGET_IN_THE_DESC = new Set(['Move', 'Defend', 'Rest', 'Spy', 'Explore']);
/** How many points an heir spends over his crowned skills, and in one skill (allocateHeirSkill). */
const HEIR_POINTS = 4;
const HEIR_POINTS_IN_ONE_SKILL = 2;

/** The heroes the report lists, in the orders column's order: the realm's own, alive or fallen this turn, in the
 *  world's order, sorted by the realm's saved arrangement (heroes it doesn't name after, in that order), or else with
 *  the king and an heir first (turn-report.ts, then buildOrdersForm's applyHeroOrderP). */
export function theHeroesTheFormLists<H extends HeroTheFormLists>(
  S: { characters: H[]; players: StateTheFormReads['players'] },
  me: number,
): H[] {
  const listed = S.characters.filter((c) => c.player === me && (c.alive || c.killedThisTurn));
  const arrangement = (S.players[me]?.heroOrder ?? []).map(String);
  if (arrangement.length) {
    const rank = new Map(arrangement.map((id, i) => [id, i]));
    return listed.sort((a, b) => (rank.get(String(a.id)) ?? 1e9) - (rank.get(String(b.id)) ?? 1e9));
  }
  const first = (c: H) => (c.isKing || c._isHeir ? 0 : 1);
  return listed.sort((a, b) => first(a) - first(b));
}

/** The line the form writes for an order. */
export function descOf(action: string, target: string): string {
  return action + (target && !NO_TARGET_IN_THE_DESC.has(action) ? ` — ${target}` : '');
}

const defend = (): PhaseOrder => ({ action: 'Defend', target: '', extra: '', desc: 'Defend' });

/** A hero's five orders as the form sends them. */
function ordersOf(hero: HeroTheFormLists, picked: (AnOrderPicked | null)[] | undefined): PhaseOrder[] {
  const hired = hero.hiredInPhase ?? -1;
  return Array.from({ length: PHASES }, (_, ph) => {
    const o = picked?.[ph];
    // a fallen hero has no form, and a locked phase no select: both read Defend
    if (!o || !hero.alive || (hired >= 0 && ph <= hired)) return defend();
    return { action: o.action, target: o.target, extra: '', desc: descOf(o.action, o.target) };
  });
}

/** A living hero's plan as the form sends it: the one set, or the one the report shows. */
function planOf(hero: HeroTheFormLists, set: APlanSet | undefined, evil: boolean): EncounterPlan {
  const shown = hero.encounterPlan ?? { tactics: ['ME'], notes: '' };
  const shownTactics = shown.tactics ?? ['ME'];
  const isSchool = (t: string) => t.toUpperCase().startsWith('CS:');
  const tactics = set ? set.tactics : shownTactics.filter((t) => !isSchool(t));
  const school = set ? set.school : (shownTactics.find(isSchool) ?? '').slice(3).toLowerCase();
  // an empty field reads as its default, as the form's `value || …` does
  const orElse = (value: string | undefined, otherwise: string) =>
    value === undefined || value === '' ? otherwise : value;
  const plan: EncounterPlan = {
    tactics: [...(tactics.length ? tactics : ['ME']), ...(school ? [`CS:${school}`] : [])],
    notes: orElse(set ? set.notes : shown.notes, ''),
    duelStance: orElse(set ? set.duelStance : shown.duelStance, 'refuse'),
  };
  if (evil) plan.evilMode = orElse(set ? set.evilMode : shown.evilMode, 'terror');
  return plan;
}

/** An heir's choices as the form sends them: his crowned skills, with each point spent as allocateHeirSkill allows (no
 *  more than four over them, two in one skill; a point past that is refused, as the form's button is). */
function heirOf(hero: HeroTheFormLists, points: string[]): NonNullable<OrdersARealmSubmits['kingSkills']>[string] {
  const base = { ...(hero.skills ?? {}) };
  const skills = { ...base };
  const added = (k: string) => (skills[k] ?? 0) - (base[k] ?? 0);
  const totalAdded = () => Object.keys(skills).reduce((t, k) => t + Math.max(0, added(k)), 0);
  let pending = hero._pendingSkillAllocation ?? 0;
  for (const k of points) {
    if (totalAdded() >= HEIR_POINTS || added(k) >= HEIR_POINTS_IN_ONE_SKILL) continue;
    skills[k] = (skills[k] ?? 0) + 1;
    pending = HEIR_POINTS - totalAdded();
  }
  return { skills, pending, name: hero.name ?? '', temper: hero.temper ?? '', base };
}

/** What the player portal sends for realm `me` on `turn`, its form built from the saved state `S`, given `chose`. */
export function theOrdersThePlayerPortalSends(
  S: StateTheFormReads,
  me: number,
  turn: number,
  chose: WhatTheRealmChose,
): OrdersARealmSubmits {
  const heroes = theHeroesTheFormLists(S, me);
  const evil = S.players[me]?.alignment === 'Evil';
  const orders: Record<string, PhaseOrder[]> = {};
  const encounterPlans: Record<string, EncounterPlan> = {};
  const kingSkills: NonNullable<OrdersARealmSubmits['kingSkills']> = {};
  for (const hero of heroes) {
    const id = String(hero.id);
    orders[id] = ordersOf(hero, chose.orders[id]);
    if (hero.alive) encounterPlans[id] = planOf(hero, chose.plans[id], evil);
    if (hero._isHeir) kingSkills[id] = heirOf(hero, chose.heirPoints[id] ?? []);
  }
  return {
    orders,
    encounterPlans,
    kingSkills,
    diplomacy: { ...chose.diplomacy },
    discoveryChoices: { ...chose.discoveryChoices },
    callReckoning: false,
    concede: false,
    messages: [],
    heroOrder: heroes.filter((c) => c.alive).map((c) => String(c.id)),
    forTurn: turn,
  };
}
