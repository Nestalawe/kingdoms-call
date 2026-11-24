// ── The order the heroes act in a phase, and who must act first (plan P1-11e16) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a). These read each hero who acts this phase as plain values: his id, his realm, his order's kind
// (normaliseAction's answer), where he stands and where his march takes him, his order's target and extra choice, the
// hero his Send Item or Leave/Transfer Army hands to, the hero he pursues, and his skills. The engine works each out
// from its world (turn/phase-intents-and-dependency-ordering.ts); the order form can from the report and its orders.
// Each order's kind is a hero order's row (THE_HERO_ORDERS, src/content/the-hero-orders-…): its tier, and its key where
// a rule names one kind (B-06am).
import { THE_HERO_ORDERS } from '../../content/the-hero-orders-their-keys-the-names-the-turn-reads-them-by-and-their-tiers.ts';

/** The skills a hero's initiative adds up, by name (each a level; a missing one counts none). */
type TheSkillsInitiativeAddsUp = Readonly<
  Partial<
    Record<
      | 'melee'
      | 'archery'
      | 'tactical'
      | 'march'
      | 'naval'
      | 'sage'
      | 'spy'
      | 'thief'
      | 'druid'
      | 'explorer'
      | 'white'
      | 'psychic'
      | 'illusory'
      | 'elemental'
      | 'necromancy',
      number | undefined
    >
  >
>;
/** A hero as his initiative reads him: his skills. */
export interface AHeroAsHisInitiativeReadsHim {
  readonly skills?: TheSkillsInitiativeAddsUp | null | undefined;
}
/** A hero's initiative (AK [3.0]): his skills added up, his March counted three times. */
export function theInitiativeAHeroActsBy(c: AHeroAsHisInitiativeReadsHim): number {
  const s: TheSkillsInitiativeAddsUp = c.skills ?? {};
  return (
    (Number(s.melee) || 0) +
    (Number(s.archery) || 0) +
    (Number(s.tactical) || 0) +
    (Number(s.march) || 0) * 3 +
    (Number(s.naval) || 0) +
    (Number(s.sage) || 0) +
    (Number(s.spy) || 0) +
    (Number(s.thief) || 0) +
    (Number(s.druid) || 0) +
    (Number(s.explorer) || 0) +
    (Number(s.white) || 0) +
    (Number(s.psychic) || 0) +
    (Number(s.illusory) || 0) +
    (Number(s.elemental) || 0) +
    (Number(s.necromancy) || 0)
  );
}

// Initiative comparator — AK [3.0]: highest total ability first (March ×3), ties broken by lowest
// character number. Actions resolve in tiers: all non-relocating orders (cast, recruit, give,
// search, spy, …) settle FIRST while everyone is still in their start-of-phase positions, THEN
// Move/Pursue relocate and any battles they start are fought, and Defend orders always come last.
// So a fast general can no longer march out and start a fight before a co-located caster gets to
// act. Dependency edges (theHeroesWhoMustActFirstInAPhase, e.g. a hero marching in to receive
// an item) still override this tiering through Kahn's topological sort, so the AK [3.0]
// exceptions that require a specific move-before/after ordering are preserved.
/** Each kind's tier, by its key, as its hero order's row writes it (Pursue's row among them: a saved name). */
const THE_TIER_EACH_KIND_OF_ORDER_ACTS_IN: ReadonlyMap<string, number> = new Map(
  Object.values(THE_HERO_ORDERS).map((row): [key: string, tier: number] => [row.key, row.tier]),
);
/** The tier an order's kind acts in, as its row writes it: 0 an order that stays put, 1 Move and Encounter (a chase,
 *  so it tiers with Move), 2 Defend. A name no row writes stays put (0). A Forced March's row writes 0 (answer 133). */
export function theTierAnOrderActsIn(d: string): number {
  return THE_TIER_EACH_KIND_OF_ORDER_ACTS_IN.get(d) ?? 0;
}
/** Whether an order's kind acts in the Moves' tier (1): a Move or an Encounter, and Pursue's saved name. */
export function anOrderActsInTheMovesTier(d: string): boolean {
  return theTierAnOrderActsIn(d) === 1;
}
/** Whether an order's kind acts after the orders that stay put: in the Moves' tier (1) or the Defend's (2). */
export function anOrderActsAfterTheOrdersThatStayPut(d: string): boolean {
  return theTierAnOrderActsIn(d) !== 0;
}

/** A hero as the phase's order reads him: his id, his order's kind this phase, and his skills. */
export interface AHeroAsThePhasesOrderReadsHim extends AHeroAsHisInitiativeReadsHim {
  readonly id: number;
  readonly action: string;
}
/** Which of two heroes acts first in a phase: below zero the first, above zero the second (a sort's comparator). */
export function whichOfTwoHeroesActsFirstInAPhase(
  a: AHeroAsThePhasesOrderReadsHim,
  b: AHeroAsThePhasesOrderReadsHim,
): number {
  const at = theTierAnOrderActsIn(a.action),
    bt = theTierAnOrderActsIn(b.action);
  if (at !== bt) return at - bt; // non-move → move/pursue → defend
  const d = theInitiativeAHeroActsBy(b) - theInitiativeAHeroActsBy(a);
  if (d !== 0) return d;
  return a.id - b.id;
}

/** What a hero acting this phase intends, as who must act first reads it. */
export interface AHerosIntentAsWhoMustActFirstReadsIt {
  readonly id: number;
  readonly player: number | null;
  /** his order's kind (normaliseAction's answer; a cancelled march's is Defend) */
  readonly action: string;
  /** where he stands as the phase begins (the order form's forecast gives none where it sees none, and undefined where
   *  the report gives his province no id) */
  readonly fromId: number | null | undefined;
  /** where his march takes him (none: no march; undefined, as the order form's forecast may give it) */
  readonly toId: number | null | undefined;
  readonly order: { readonly target: string; readonly extra: string } | null;
  /** the hero his Send Item or Leave/Transfer Army hands to (none for any other order, or none named) */
  readonly theHeroHisOrderHandsTo: number | null;
  /** the hero he pursues (none: no pursuit under way) */
  readonly theHeroHePursues: number | null;
}

// ── Dependency ordering (AK [3.0] exceptions) ────
// Returns [charId_before, charId_after] pairs meaning "before" must be processed first.
export function theHeroesWhoMustActFirstInAPhase(
  intents: ReadonlyMap<number, AHerosIntentAsWhoMustActFirstReadsIt>,
): [before: number, after: number][] {
  const edges: [before: number, after: number][] = [];
  const list = [...intents.values()];
  const byId = (id: number) => intents.get(id);

  list.forEach((it) => {
    const { order, action } = it;
    if (!order) return;
    const tgtId = parseInt(order.target);
    const tgt = isNaN(tgtId) ? null : byId(tgtId);

    // (a) A character doing something FOR a co-located ally goes first, so the ally can use it.
    // Give Item / Leave-Transfer Army to a named ally, and friendly action spells.
    // EXCEPTION: if that ally is marching INTO this province this phase, rule (c) below
    // applies instead and the ally arrives first — emitting both edges would make a cycle,
    // and Kahn's algorithm would then fall back to plain initiative and honour neither.
    const tgtArrivingHere = (t: AHerosIntentAsWhoMustActFirstReadsIt | null | undefined) =>
      !!t && t.action === THE_HERO_ORDERS.move.key && t.toId === it.fromId;
    // 2026-09-23: the RECIPIENT of Send Item / Transfer Army is in `extra` (the target holds item
    // indices / unit names). Reading `target` here linked the sender to whichever character's id
    // matched the first item index, and never to the real recipient.
    const _rcp =
      action === THE_HERO_ORDERS.give_item.key || action === THE_HERO_ORDERS.leave_army.key
        ? (() => {
            const r = it.theHeroHisOrderHandsTo;
            return r !== null ? byId(r) : null;
          })()
        : null;
    if (_rcp?.player === it.player && _rcp.id !== it.id && !tgtArrivingHere(_rcp)) {
      edges.push([it.id, _rcp.id]);
    }
    if (action === THE_HERO_ORDERS.cast_spell.key) {
      const spellTargetId = parseInt(order.extra);
      const st = isNaN(spellTargetId) ? null : byId(spellTargetId);
      if (st?.player === it.player && st.id !== it.id && !tgtArrivingHere(st)) edges.push([it.id, st.id]);
    }
    // (b) Pick Up waits for anyone Leaving armies in the same province this phase.
    if (action === THE_HERO_ORDERS.pickup_army.key) {
      list.forEach((other) => {
        if (other.id === it.id || other.player !== it.player) return;
        if (other.action !== THE_HERO_ORDERS.leave_army.key) return;
        if (other.fromId !== it.fromId) return;
        edges.push([other.id, it.id]);
      });
    }
    // (c) A character MOVING IN to a province where an ally intends to hand him something
    // arrives first — the ally waits for him (AK [3.0]).
    const itsDest = it.toId;
    if (action === THE_HERO_ORDERS.move.key && itsDest !== null) {
      list.forEach((other) => {
        if (other.id === it.id || other.player !== it.player) return;
        if (other.fromId !== itsDest) return;
        if (other.action !== THE_HERO_ORDERS.give_item.key && other.action !== THE_HERO_ORDERS.leave_army.key) return;
        const _oR = other.theHeroHisOrderHandsTo; // recipient is in extra (2026-09-23)
        if (_oR !== it.id) return;
        edges.push([it.id, other.id]);
      });
    }
    // (d) A pursuer acts immediately after the character he is chasing (AK [3.0]).
    if ((action === THE_HERO_ORDERS.pursue.key || action === THE_HERO_ORDERS.encounter.key) && tgt && tgt.id !== it.id)
      edges.push([tgt.id, it.id]); // an Encounter chaser acts right after their quarry
    if (it.theHeroHePursues !== null) {
      const pt = byId(it.theHeroHePursues);
      if (pt && pt.id !== it.id) edges.push([pt.id, it.id]);
    }
  });
  return edges;
}

// Kahn's algorithm over the dependency edges, using initiative order as the tie-break priority.
// Any characters left in a dependency cycle (e.g. two heroes each Giving to the other) are
// appended in plain initiative order rather than dropped.
/** The order the heroes act in a phase: the heroes who act (each once), and who must act before whom. */
export function theOrderTheHeroesActInAPhase<Hero extends AHeroAsThePhasesOrderReadsHim>(
  heroes: readonly Hero[],
  dependencies: readonly (readonly [before: number, after: number])[],
): Hero[] {
  const cmp = whichOfTwoHeroesActsFirstInAPhase;
  const nodes = [...heroes].sort(cmp);
  const actors = new Set(heroes.map((c) => c.id));
  const edges = dependencies.filter(([u, v]) => actors.has(u) && actors.has(v) && u !== v);
  const indeg = new Map<number, number>(nodes.map((c) => [c.id, 0]));
  const out = new Map<number, number[]>(nodes.map((c) => [c.id, []]));
  /** The heroes who wait for one (each actor has his list, and the edges join actors alone). */
  const theOnesWaitingFor = (id: number): number[] => {
    const waiting = out.get(id);
    if (waiting === undefined) throw new TypeError(`hero ${String(id)} is none of the phase's actors`);
    return waiting;
  };
  edges.forEach(([u, v]) => {
    theOnesWaitingFor(u).push(v);
    indeg.set(v, Number(indeg.get(v)) + 1);
  });
  const ready = nodes.filter((c) => indeg.get(c.id) === 0);
  const result: Hero[] = [];
  const placed = new Set<number>();
  while (ready.length) {
    ready.sort(cmp);
    const c = ready.shift();
    if (c === undefined) throw new TypeError('the list of the heroes ready to act held a gap'); // it holds heroes alone
    if (placed.has(c.id)) continue;
    placed.add(c.id);
    result.push(c);
    theOnesWaitingFor(c.id).forEach((v) => {
      indeg.set(v, Number(indeg.get(v)) - 1);
      if (indeg.get(v) === 0) {
        const n = nodes.find((x) => x.id === v);
        if (n && !placed.has(v)) ready.push(n);
      }
    });
  }
  nodes.forEach((c) => {
    if (!placed.has(c.id)) result.push(c);
  });
  return result;
}
