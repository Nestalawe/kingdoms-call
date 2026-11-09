import { safeStartLocked } from '../army-tables.ts';
import { KC_SKILLS } from '../../content/kingdoms-call-data.ts';
import { TEMPERS_P } from '../world/tables.ts';
import { noteServedRealm } from '../heroes/charms-and-neutrals.ts';
import { asItsGuardReadsIt } from '../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import type { TurnContext, TurnOrder } from './context.ts';
import type { Character, GameState, Province, Realm, SkillLevels } from '../../schemas/saved-game-state.ts';

// ── THE SET-UP: THE TURN'S START REPAIRS AND THE MERGE OF THE REALMS' ORDERS (plan P1-08k7: two stages taken out of
// the start of resolveTurn's own body; P1-08n: two lines of it before them) ──────────────────────────────────────────
// Each once a turn and before any line is logged (the turn's log isn't ready yet: what they have to tell is kept for later), in
// this order:
//   1. as the save is read, before the turn's context is made: last turn's crossed swords cleared from the map (plan
//      P1-08n). It takes the save (G), as the save's upgrades beside its call do, and a failure in it is a save that
//      can't be read;
//   2. once the context is made: every realm stamped a bot's or a human's from the slot rows (plan P1-08n);
//   3. the turn's start: how many heroes in a realm's service the save's upgrade took the " (wandering)" tag off
//      (its four turn-start repairs, since P1-15f2) kept on the save, told at the turn's end; then the turn's orders
//      and its scratch lists start empty, every living hero noting the realm he serves, and every living realm's hero
//      starts with five empty phases (Defend, later);
//   4. the merge of the realms' orders: each realm that sent orders has its hero order kept, its declarations (or the
//      Safe Start's refusal), research choices, Reckoning call, messages and concession collected for later stages,
//      orders stamped for another turn refused, the orders of heroes it means to hire, raise or charm held until the
//      order lands, every other hero's phases written, a conceded realm's heroes made to hold, its encounter plans
//      set (or held, for a hero not yet its own), and a new heir's skills, name and temper applied. A realm's orders,
//      encounter plans and heir's choices are taken only for its own heroes (the rest set aside, and the GM told); a
//      plan keeps only the fields a plan has; an heir's skills only as his crowned skills plus at most his points.
// But for the first, each takes the turn's context (src/engine/turn/context.ts) and nothing else: the merge makes the
// collectors afresh each turn, joins them to the context and fills them (staleOrderWarnings, diploDeclarations,
// safeStartRefused, discoveryChoicePicks, reckoningCalls, playerMessages), which later stages and the bots read there
// (they were declared in resolveTurn until plan P1-08l2). The bodies keep resolveTurn's indent (plan P1-08's Decisions).

/** The save as the swords' clearing reads it, as it is read (its world, its provinces' list or a province may be
 *  missing: the body's guards). */
interface TheSaveAsTheSwordsClearingReadsIt {
  readonly world?:
    | {
        readonly provinces?:
          | readonly (Pick<Province, '_hadBattleThisTurn' | '_combatPlayersThisTurn'> | null | undefined)[]
          | null
          | undefined;
      }
    | null
    | undefined;
}
/** The state as the turn's start writes it: the heroes' orders for the turn (the saved state holds them cleared), and
 *  the turn's lists of the heroes raised and of the orders and plans held for a hero a realm means to raise, charm or
 *  hire (none in the saved state's schema; each filled by the merge and read by the orders). */
type TheStateAsTheTurnsStartWritesIt = Omit<GameState, 'turnOrders'> & {
  turnOrders: Record<string, (TurnOrder | null | undefined)[] | undefined>;
  _resurrectedThisTurn?: unknown[];
  _pendingResurrectOrders?: unknown[];
  _pendingCharmOrders?: unknown[];
  _pendingHireOrders?: unknown[];
  _pendingSynthPlans?: unknown[];
};
/** The world's characters, where the code tests the list for a gap. */
function theCharactersOf(G: Pick<GameState, 'characters'>): readonly (Character | null | undefined)[] {
  return asItsGuardReadsIt(G.characters) ?? [];
}
/** The realms, where the code tests the list for a gap. */
function theRealmsOf(G: Pick<GameState, 'players'>): readonly (Realm | null | undefined)[] {
  return asItsGuardReadsIt(G.players) ?? [];
}
/** A value whose fields JavaScript reads (any value but `null` and `undefined`), each field as `unknown`. */
type AValueReadByItsFields = Readonly<Partial<Record<string, unknown>>>;
function aValueReadByItsFields(v: unknown): v is AValueReadByItsFields {
  return v !== null && v !== undefined;
}
/** A value the merge reads `v || {}`: as it is where it is truthy, else `{}`. */
function itOrAnEmptyObject(v: unknown): AValueReadByItsFields {
  if (v && aValueReadByItsFields(v)) return v;
  return {};
}
/** A value the merge reads `v || ''` (an heir's name as it was sent: words, or any value): as it is where it is truthy,
 *  else `''`. */
function itOrNoWords(v: unknown): unknown {
  if (v) return v;
  return '';
}
/** What a realm's slot row holds of its orders, as the merge reads it: parsed when it is words (JSON), else as it is
 *  (`{}` for none); for `null`, the TypeError the merge's first read of it threw. */
function theOrdersAsTheRealmSentThem(held: unknown): AValueReadByItsFields {
  const raw: unknown = typeof held === 'string' ? JSON.parse(held) : itOrAnEmptyObject(held);
  if (!aValueReadByItsFields(raw))
    throw new TypeError(`Cannot read properties of ${String(raw)} (reading 'heroOrder')`);
  return raw;
}

export function lastTurnsBattleAndDuelSwordsClearedFromTheMap(G: TheSaveAsTheSwordsClearingReadsIt): void {
  // THE MAP'S "THIS TURN" SWORDS. _hadBattleThisTurn (red) and _combatPlayersThisTurn (purple
  // duel swords) were deleted at the very end of runTurn — but only AFTER game_state had been
  // saved, so the saved state still carried them and the next turn loaded last turn's fights,
  // reporting them a second time (the "duel icon that won't go away"). Clear them here, at the
  // top of the turn, whatever the save held. (Since P1-12b2 this is the only place they are
  // cleared: the reports write nothing to the world.)
  (G.world?.provinces ?? []).forEach((p) => {
    if (p) {
      delete p._hadBattleThisTurn;
      delete p._combatPlayersThisTurn;
    }
  });
}

export function everyRealmStampedBotOrHumanFromTheBotSlotRows(turnContext: TurnContext): void {
  const { G, _botPlayerIdx } = turnContext;
  // Sept 2026 (bot strategy batch): stamp the bot flag onto the persisted player objects so the
  // module-level bot passes can tell bot realms from human ones (botIsBotPlayer) — bots never war
  // one another while a human king still reigns, and coordinate against the humans instead.
  theRealmsOf(G).forEach((p, i) => {
    if (p) p._isBot = _botPlayerIdx.has(i);
  });
}

export function turnStartRepairsAndAFreshSlateOfOrdersForEveryHero(turnContext: TurnContext): void {
  const G: TheStateAsTheTurnsStartWritesIt = turnContext.G;
  // the turn's start repairs are the save's upgrade's (src/engine/saves/, plan P1-15f2), after its check: a neutral
  // hero's beast race, a stranded guard, a stranded hull's marker, a crowned hero's ' (wandering)' tag. How many tags it
  // took off is kept on the save here, where the repair wrote it, and the turn's end tells the GM.
  // SCOPE TRAP: `log` is a const arrow declared far below inside runTurn, so it is in its temporal dead zone here —
  // the count is stashed on G and reported by the turn-end integrity block instead.
  G._nameRepairs = turnContext.whatTheSavesUpgradeFound.heroesInARealmsServiceWhoseWanderingTagWasTakenOff;

  // 2. Merge all player orders into G.turnOrders + apply encounter plans
  // CRITICAL: reset turnOrders completely first — stale orders from a previous turn
  // must NEVER carry over. Every character starts this turn with a clean slate (Defend).
  G.turnOrders = {};
  // Per-turn scratch lists persisted inside game_state. These were never cleared, so a hero raised
  // in an earlier turn stayed in _resurrectedThisTurn for the rest of the game — and if they later
  // died again, every future Resurrect (even a successful roll) was refused with "has already been
  // raised this turn" while the body stayed in the graveyard (player report, Sept 2026). Stale
  // pending pre-orders for a resurrect/charm target could likewise be re-applied turns later.
  G._resurrectedThisTurn = [];
  G._pendingResurrectOrders = [];
  theCharactersOf(G).forEach((ch) => {
    if (ch?.alive && ch.player != null) noteServedRealm(ch, ch.player);
  }); // service history (Resurrect)
  G._pendingCharmOrders = [];
  G._pendingHireOrders = []; // 2026-09-21: hire pre-orders are held, not written straight to the real hero
  G._pendingSynthPlans = []; // 2026-09-21: encounter plans from hire/resurrect/charm pre-order cards
  (asItsGuardReadsIt(G.characters) ?? [])
    .filter((c) => c.player !== null && c.alive)
    .forEach((c) => {
      G.turnOrders[c.id] = [null, null, null, null, null];
    });
}

// A hero of realm `pi`, by his id as a realm's orders name him (the id's digits alone), or null.
function heroOfTheRealm(G: Pick<GameState, 'characters'>, pi: number, charId: string): Character | null {
  const key = charId;
  if (!/^\d+$/.test(key)) return null;
  const ch = theCharactersOf(G).find((c) => c && String(c.id) === key);
  return ch?.player === pi ? ch : null;
}

// An encounter plan as a realm sends it, kept to the fields a plan has (its tactics, notes, duel stance and an Evil
// hero's conquest doctrine), each of its kind; null when what was sent is no plan.
function encounterPlanAsAPlanHasIt(plan: unknown): NonNullable<Character['encounterPlan']> | null {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return null;
  const sent = itOrAnEmptyObject(plan);
  const kept: NonNullable<Character['encounterPlan']> = {};
  const tactics = sent['tactics'];
  if (Array.isArray(tactics)) {
    const sentTactics: readonly unknown[] = tactics;
    kept.tactics = sentTactics.filter((t): t is string => typeof t === 'string');
  }
  const notes = sent['notes'];
  if (typeof notes === 'string') kept.notes = notes;
  const duelStance = sent['duelStance'];
  if (typeof duelStance === 'string') kept.duelStance = duelStance;
  const evilMode = sent['evilMode'];
  if (typeof evilMode === 'string') kept.evilMode = evilMode;
  return kept;
}

// A new heir's skills as his realm sends them, if they are his crowned skills (as the save holds them) plus at most the
// points he may place (_pendingSkillAllocation), no more than 2 in one skill (the player portal's rule, as for a new
// king), each a skill the game has, at a whole level; otherwise null.
function heirsSkillsWithinHisPoints(
  ch: { readonly skills?: SkillLevels | undefined; readonly _pendingSkillAllocation?: number | undefined },
  sent: unknown,
): SkillLevels | null {
  if (!sent || typeof sent !== 'object' || Array.isArray(sent)) return null;
  const crowned = ch.skills ?? {};
  const held = ch._pendingSkillAllocation;
  const points = held !== undefined && Number.isInteger(held) ? held : 0;
  if (!skillsTheGameHasEachAtAWholeLevel(sent)) return null;
  let placed = 0;
  for (const k of KC_SKILLS) {
    const was = Number(crowned[k]) || 0;
    const now = sent[k] ?? was;
    if (now < was || now - was > 2) return null;
    placed += now - was;
  }
  if (placed > points) return null;
  return { ...crowned, ...sent };
}
/** Skills as a realm sends them for its heir, each a skill the game has, at a whole level (each skill's name tested
 *  before its level). */
function skillsTheGameHasEachAtAWholeLevel(sent: object): sent is Partial<Record<(typeof KC_SKILLS)[number], number>> {
  const theSkills: readonly string[] = KC_SKILLS;
  return !Object.keys(sent).some((k) => !theSkills.includes(k) || !Number.isInteger(Reflect.get(sent, k)));
}

export function mergeTheRealmsSubmittedOrdersDeclarationsMessagesAndEncounterPlans(turnContext: TurnContext): void {
  const { freshPlayers, expectedTurnToRun } = turnContext;
  const G: TheStateAsTheTurnsStartWritesIt = turnContext.G;
  // Encounter plans persist across turns until the player changes them, so we do NOT wipe them here
  // — the new submissions below overwrite only the characters whose orders include a plan. Collect
  // warnings about rejected stale orders (logged once the turn's log is ready)
  const staleOrderWarnings: string[] = [];
  turnContext.staleOrderWarnings = staleOrderWarnings;
  // Diplomacy declarations submitted this turn, keyed by player index → { targetPlayerIndex: 'treat'|'enemy' }.
  // Recorded here, applied at end of turn (relations change "at the start of the next turn").
  const diploDeclarations: TurnContext['diploDeclarations'] = {};
  turnContext.diploDeclarations = diploDeclarations;
  // (each realm's declarations as it sent them, an object of any fields: written through a view of the same record)
  const declarationsAsSent: Record<number, unknown> = diploDeclarations;
  const safeStartRefused: number[] = []; // SAFE START: realms whose declarations were discarded this turn (told privately)
  turnContext.safeStartRefused = safeStartRefused;
  const discoveryChoicePicks: TurnContext['discoveryChoicePicks'] = {}; // research choice: player index → {pendingKey: keptDiscoveryId}
  turnContext.discoveryChoicePicks = discoveryChoicePicks;
  const picksAsSent: Record<number, unknown> = discoveryChoicePicks; // (as the declarations: as each realm sent them)
  // Victory: players who Called the Reckoning this turn (king-only, one per realm).
  const reckoningCalls = new Set<number>();
  turnContext.reckoningCalls = reckoningCalls;
  // player-to-player messages submitted with orders, keyed by sender index → [{to, text}].
  // `to` is an array of recipient player indices, or the string 'all'. Delivered into each
  // recipient's report below (this turn's report, which they read before ordering next turn).
  const playerMessages: TurnContext['playerMessages'] = {};
  turnContext.playerMessages = playerMessages;
  const messagesAsSent: Record<number, unknown> = playerMessages; // (as the declarations: each realm's list as it sent it)
  freshPlayers
    .filter((p) => p.user_id && p.orders)
    .forEach((gp) => {
      const raw = theOrdersAsTheRealmSentThem(gp.orders);
      // Detect new format: {orders:{charId:[phases]}, encounterPlans:{}, forTurn:N} vs old format:
      // {charId:[phases]}
      let ordersObj = raw;
      let epObj: AValueReadByItsFields = {};
      let kingSkillsObj: AValueReadByItsFields = {};
      let forTurn: unknown = null;
      // the player's own arrangement of their heroes in the orders column, sent as an array of
      // character ids. Stored on the realm so it survives this turn's run and shapes every later
      // report (buildTurnReport sorts by it). Read BEFORE the format sniff below, because a bare
      // reorder on an otherwise untouched form is a payload with no meaningful orders in it.
      const heroOrderSent = raw['heroOrder'];
      if (Array.isArray(heroOrderSent)) {
        const itsRealm = G.players[gp.player_index];
        if (itsRealm) {
          const heroOrderAsSent: readonly unknown[] = heroOrderSent;
          itsRealm.heroOrder = heroOrderAsSent.slice(0, 200).map(String);
        }
      }
      if (raw['orders'] !== undefined && raw['encounterPlans'] !== undefined) {
        ordersObj = itOrAnEmptyObject(raw['orders']);
        epObj = itOrAnEmptyObject(raw['encounterPlans']);
        kingSkillsObj = itOrAnEmptyObject(raw['kingSkills']);
        forTurn = raw['forTurn'] ?? null;
        // Diplomacy declarations (king-only, one stance per target). Validated at resolution time
        // against the encountered set; stored raw here.
        const diplomacySent = raw['diplomacy'];
        if (diplomacySent && typeof diplomacySent === 'object') {
          // SAFE START (2026-09-29): before the orders for Turn SAFE_START_TURN no Treat or war may be
          // declared — the declarations are discarded and the realm is told why.
          if (safeStartLocked(G, expectedTurnToRun)) {
            const stancesSent: readonly unknown[] = Object.values(diplomacySent);
            if (stancesSent.some((v) => v === 'treat' || v === 'enemy')) safeStartRefused.push(gp.player_index);
          } else declarationsAsSent[gp.player_index] = diplomacySent;
        }
        // RESEARCH CHOICE: which of each pending pair to keep ({key: discoveryId}); honoured only when
        // the payload is for this turn (a stale draft's picks are ignored like its orders).
        const choicesSent = raw['discoveryChoices'];
        if (
          choicesSent &&
          typeof choicesSent === 'object' &&
          (raw['forTurn'] == null || raw['forTurn'] === expectedTurnToRun)
        )
          picksAsSent[gp.player_index] = choicesSent;
        if (raw['callReckoning'] === true && !G.players[gp.player_index]?.conceded) reckoningCalls.add(gp.player_index);
        const messagesSent = raw['messages'];
        if (Array.isArray(messagesSent)) messagesAsSent[gp.player_index] = messagesSent;
        // CONCEDE. A realm that concedes is out of the game for good — its characters do nothing but
        // Defend from now on (enforced below every turn, whatever is submitted).
        if (raw['concede'] === true) {
          const conceding = G.players[gp.player_index];
          if (conceding && !conceding.conceded) {
            conceding.conceded = true;
            conceding.concededTurn = expectedTurnToRun;
            staleOrderWarnings.push(
              `\u{1F3F3} ${conceding.name} has CONCEDED the game. Its heroes lay down their ambitions and will only defend what they hold from now on.`,
            ); // logged (public) once the turn's log exists
          }
        }
      }
      // CRITICAL: reject orders that were stamped for a different turn (stale submissions)
      if (forTurn !== null && forTurn !== expectedTurnToRun) {
        const stampedFor: unknown = forTurn; // (the turn the orders name, as they name it: words, a number or any value)
        staleOrderWarnings.push(
          `⚠ Ignoring stale orders from ${(G.players[gp.player_index]?.name ?? '') || 'a player'} — submitted for Turn ${String(stampedFor)}, not Turn ${String(expectedTurnToRun)}.`,
        );
        return; // skip this player's stale orders entirely
      }
      const realmName = (G.players[gp.player_index]?.name ?? '') || 'a player';
      // What the realm sent for heroes not in its service, set aside (the GM is told, once, below).
      const notItsOwn: string[] = [];
      const setAside = (charId: string) => {
        if (!notItsOwn.includes(charId)) notItsOwn.push(charId);
      };
      // (each hero's phases as the realm sent them, a list of anything: written through a view of the same record)
      const turnOrdersAsSent: Record<string, unknown> = G.turnOrders;
      Object.entries(ordersObj).forEach(([charId, phaseOrders]) => {
        if (charId === 'heroOrder') return; // an array, but not a character's phase orders
        if (!Array.isArray(phaseOrders)) return;
        // Handle synthetic RESURRECTION IDs: 'resurrect_HEROID_via_CASTERID_phPH' A player who orders
        // Resurrect in phase PH may pre-write orders for the hero they intend to raise, exactly as
        // they can for a hero they intend to hire. These are held as PENDING and are only written
        // into turnOrders inside the successful white_resurrect branch — never here. That matters: a
        // corpse can be targeted by more than one player in the same turn, and writing straight to
        // G.turnOrders[realHeroId] would let a player who LOST the race to raise a body still puppet
        // that hero for the rest of the turn. Orders are also scoped to phases AFTER the cast, since
        // the hero is still dead in every phase up to and including it.
        const resMatch = /^resurrect_(\d+)_via_(\d+)_ph(\d+)$/.exec(charId);
        if (resMatch) {
          G._pendingResurrectOrders ??= [];
          G._pendingResurrectOrders.push({
            heroId: parseInt(String(resMatch[1])),
            casterId: parseInt(String(resMatch[2])),
            castPhase: parseInt(String(resMatch[3])),
            player: gp.player_index,
            orders: phaseOrders,
          });
          return;
        }
        // Handle synthetic hired hero IDs: 'hired_HEROID_via_CHARID_phPH'.
        // 2026-09-21: these are now held as PENDING and written into turnOrders only inside the
        // successful `case 'hire'` branch — never here. Previously they were committed to the REAL
        // hero's turnOrders at ingestion, before any hire was attempted, so a player who LOST the
        // race (a rival hired the same wandering hero first, or the offer was refused / unaffordable)
        // still puppeted that hero for the rest of the turn, under the winner's banner. Resurrect and
        // Charm were given exactly this protection; hire had the identical exposure and none of it.
        const hiredMatch = /^hired_(\d+)_via_(.+)_ph(\d+)$/.exec(charId); // the hirer may itself be a synthetic (nested-hire) id
        if (hiredMatch) {
          G._pendingHireOrders ??= [];
          G._pendingHireOrders.push({
            heroId: parseInt(String(hiredMatch[1])),
            viaId: String(hiredMatch[2]), // the hiring character's id (or a nested synthetic id)
            plannedPhase: parseInt(String(hiredMatch[3])),
            player: gp.player_index,
            orders: phaseOrders,
          });
          return;
        }
        // Handle synthetic CHARM IDs: 'charm_HEROID_via_CASTERID_phPH'. A player who orders Charm on
        // a wandering hero may pre-write orders for the hero they intend to sway, exactly as for a
        // hire or a resurrect. Held as PENDING and only written into turnOrders inside the successful
        // psychic_charm branch — never here — so a failed cast (or a rival charming the same hero
        // first) leaves no trace.
        const charmMatch = /^charm_(\d+)_via_(\d+)_ph(\d+)$/.exec(charId);
        if (charmMatch) {
          G._pendingCharmOrders ??= [];
          G._pendingCharmOrders.push({
            heroId: parseInt(String(charmMatch[1])),
            casterId: parseInt(String(charmMatch[2])),
            castPhase: parseInt(String(charmMatch[3])),
            player: gp.player_index,
            orders: phaseOrders,
          });
          return;
        }
        if (!heroOfTheRealm(G, gp.player_index, charId)) {
          setAside(charId);
          return;
        }
        turnOrdersAsSent[charId] = phaseOrders;
      });
      // a conceded realm's characters ALWAYS hold — override whatever was submitted.
      theRealmsOf(G).forEach((p, pi) => {
        if (!p?.conceded) return;
        (asItsGuardReadsIt(G.characters) ?? [])
          .filter((c) => c.alive && c.player === pi)
          .forEach((c) => {
            G.turnOrders[c.id] = [0, 1, 2, 3, 4].map(() => ({
              action: 'defend',
              target: '',
              extra: '',
              desc: 'Hold (conceded)',
            }));
          });
      });
      // Apply encounter plans to characters.
      Object.entries(epObj).forEach(([charId, plan]) => {
        const syn = /^(?:hired|resurrect|charm)_(\d+)_via_.+_ph\d+$/.exec(charId); // allow synthetic (nested) caster id
        if (syn) {
          // 2026-09-21: a plan on a card for a hero not yet in this realm's service is held until the
          // hire/raise/charm actually lands (see applyPendingSynthPlan). An encounter plan persists
          // turn to turn, so writing it here let a rival set a hero's combat stance for good.
          const kept = encounterPlanAsAPlanHasIt(plan);
          if (!kept) return;
          G._pendingSynthPlans ??= [];
          G._pendingSynthPlans.push({ heroId: parseInt(String(syn[1])), player: gp.player_index, plan: kept });
          return;
        }
        const kept = encounterPlanAsAPlanHasIt(plan);
        if (!kept) return;
        const ch = heroOfTheRealm(G, gp.player_index, charId);
        if (ch) ch.encounterPlan = kept;
        else setAside(charId);
      });
      // Apply royal-succession skill allocations to a newly-crowned heir, then retire the flags.
      Object.entries(kingSkillsObj).forEach(([charId, allocSent]) => {
        if (!allocSent) return;
        const alloc = itOrAnEmptyObject(allocSent);
        const ch = heroOfTheRealm(G, gp.player_index, charId);
        if (!ch) {
          setAside(charId);
          return;
        }
        if (ch._isHeir) {
          if (alloc['skills']) {
            const skills = heirsSkillsWithinHisPoints(ch, alloc['skills']);
            if (skills) ch.skills = skills;
            else
              staleOrderWarnings.push(
                `⚠ Set aside from ${realmName}'s orders: skills for its heir ${ch.name} that are not his crowned skills plus at most ${String(Number(ch._pendingSkillAllocation) || 0)} points (no more than 2 in one skill); he keeps his crowned skills.`,
              );
          }
          // The player may christen their heir and choose the Temper they were raised with.
          const nm = String(itOrNoWords(alloc['name'])).trim().slice(0, 40);
          if (nm) ch.name = nm;
          const temperSent = alloc['temper'];
          if (temperSent && typeof temperSent === 'string' && TEMPERS_P.includes(temperSent)) ch.temper = temperSent;
          delete ch._isHeir;
          delete ch._pendingSkillAllocation;
        }
      });
      if (notItsOwn.length)
        staleOrderWarnings.push(
          `⚠ Set aside from ${realmName}'s orders: what it sent for heroes not in its service (${notItsOwn.join(', ')}).`,
        ); // logged (to the GM alone) once the turn's log exists
    });
}
