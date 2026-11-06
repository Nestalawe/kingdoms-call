import { KC_UNIT_CLASS, SPELL_DEFS_P } from '../../content/kingdoms-call-data.ts';
import { SKILL_LABELS } from '../army-tables.ts';
import { heroHireWage } from '../rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import { effSkillOf } from '../heroes/skills-and-hp.ts';
import { UNIT_DRILL_BASE } from '../units/drill-and-spoils.ts';
import { BOT_HEX_DIRS, BOT_SEA_ALL, botNeighbourProv } from './intel.ts';
import { BOT_SPECIALIST_SKILLS } from './specialist-skills.ts';
import {
  BOT_SPECIALIST_ROLES,
  botFieldRecruitTokens,
  botGarrisonOrder,
  botHireOrder,
  botIsTeach,
  botLedger,
  botNearbyThreat,
  botPracticeSkill,
  botRecruitOrder,
  botRoles,
} from './strategy.ts';
import { BOT_SCHOOLS } from './schools.ts';
import { botOrderLocs, botPickupOrder } from './missions.ts';
import { skillLevel } from '../titles/perks.ts';
import { actionSpellsAHeroMayCastInASchoolEachTurn } from '../rules-on-plain-values/spells-each-school-allows-a-turn-and-a-fight.ts';
import { botPracticeFallback } from './spellcraft.ts';
import { theNameOfTheSpell } from './the-name-of-a-spell-by-its-slug.ts';
import { asItsGuardReadsIt } from '../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import type { PhaseOrder } from '../../schemas/orders-a-realm-submits.ts';
import type { Army, Character, GameState, Province } from '../../schemas/saved-game-state.ts';
import type { ABotRealmsLedger, TheBotLedgersTally } from './intel.ts';

// Its types (plan P1-10b48): each parameter typed as wide as the body's guards, so each guard stays.
declare global {
  /** The bots' two hooks for the study's harness (the engine's reviewed exception to its purity, eslint.config.js),
   *  read only where a page has set them: each bot realm's ledger a turn (`__botDiag`), the order hygiene's tally. */
  interface Window {
    __botDiag?: unknown;
    __botHyg?: Partial<Record<string, number>> | null | undefined;
  }
}
/** A phase's order as the passes read a plan: an order, or a gap the plan holds. */
type AnOrderAsThePassesReadIt = PhaseOrder | null | undefined;
/** The turn's orders as the passes read them, by hero (G.turnOrders). */
type TheTurnsOrdersAsThePassesHoldThem = Partial<Record<string, AnOrderAsThePassesReadIt[]>>;
/** The turn's orders, where the code tests a hero's plan for a gap. */
function theTurnsOrders(G: GameState): TheTurnsOrdersAsThePassesHoldThem {
  return G.turnOrders;
}
/** A hero's plan where the pass has made sure he holds one (each of `mine` holds a plan): for none, the TypeError its
 *  read would throw. */
function thePlanOf(G: GameState, c: Character): AnOrderAsThePassesReadIt[] {
  const o = theTurnsOrders(G)[c.id];
  if (o === undefined) throw new TypeError("Cannot read properties of undefined (reading '0')");
  return o;
}
/** The world's characters, where the code tests the list for a gap. */
function theCharactersOf(G: GameState): readonly (Character | null | undefined)[] {
  return asItsGuardReadsIt(G.characters) ?? [];
}
/** The realms, where the code tests the list for a gap. */
function theRealmsOf(G: GameState): readonly (GameState['players'][number] | null | undefined)[] {
  return asItsGuardReadsIt(G.players) ?? [];
}
/** A hero's units, where the code tests the list for a gap. */
function theUnitsWithGapsOf(c: Character): readonly (Army | null | undefined)[] {
  return asItsGuardReadsIt(c.armies) ?? [];
}
/** A province's recruitable kinds, where the code guards the list as if it may be missing. */
function theArmyTypesOf(P: Province): readonly (string | null | undefined)[] {
  return asItsGuardReadsIt(P.armyTypes) ?? [];
}
/** A hero's level in a skill read by any name (`(c.skills || {})[S] || 0`, as before: none for none). */
function theLevelOf(c: Character, S: string): number {
  const skills: Readonly<Partial<Record<string, number>>> = { ...asItsGuardReadsIt(c.skills) };
  return Number(skills[S]) || 0;
}
/** A skill's label, else its key (`SKILL_LABELS[sk] || sk`, as before: a label of no words gives the key). */
function theLabelOf(sk: string): string {
  const labels: Readonly<Partial<Record<string, string>>> = SKILL_LABELS;
  return (labels[sk] ?? '') || sk;
}
/** Whether a skill has a label (`SKILL_LABELS[S]`, read as words). */
function hasALabel(sk: string): boolean {
  const labels: Readonly<Partial<Record<string, string>>> = SKILL_LABELS;
  return !!labels[sk];
}
/** An order's target as words (`String`, as before: a plan another pass wrote may hold its target as a number). */
function theTargetAsWords(o: { readonly target: unknown }): string {
  return String(o.target);
}
/** A specialist's own craft (`BOT_SPECIALIST_SKILLS[c._botRole]`, as before: none for a hero of no role). */
function theCraftOf(c: Character): string | undefined {
  const crafts: Readonly<Partial<Record<string, string>>> = BOT_SPECIALIST_SKILLS;
  return c._botRole === undefined ? undefined : crafts[c._botRole];
}
/** The ledger's tally for the study, which botLedger always writes: for none, the TypeError its write would throw. */
function theTallyOf(L: ABotRealmsLedger): TheBotLedgersTally {
  if (L.diag === undefined) throw new TypeError("Cannot set properties of undefined (setting 'holdersIdle')");
  return L.diag;
}

// ══ BOT PLAYERS — Phase 3b: economy (recruit / hire) ════
// Runs AFTER runBotMovement: any bot character still HOLDING (no movement order) in an owned
// province spends the treasury on reinforcements. Tax income is PASSIVE in this engine (applied
// automatically each turn ~line 11672), so there is no "tax" order — expanding already grows a
// bot's income.
//
// SOLVENCY BY CONSTRUCTION: a unit's recruit cost is ALSO its per-turn upkeep/wage (see the note
// above ARMY_COST_MASTER). So recruitment is gated on BOTH an upfront gold reserve AND an upkeep
// cap (total wages kept ≤ 90% of the bot's tax income). This ties army size to economic base — a
// bot recruits more only as it expands — and prevents a wage spiral that would bankrupt it.
// The economy's helpers (BOT_NAVAL_TYPES, botRecruitableTypes, botUpkeep, botTaxIncome, botAtWar, botMaxEnemyStack and
// the fleet helpers) and botPracticeSkill (Phase 3c) are in bots/strategy.ts.
export function runBotEconomy(G: GameState, botIdxSet: ReadonlySet<number> | null | undefined) {
  if (!botIdxSet?.size || !asItsGuardReadsIt(G.world)) return;
  G.turnOrders = asItsGuardReadsIt(G.turnOrders) ?? {};
  botIdxSet.forEach((pi) => {
    const player = G.players[pi];
    if (!player || player.conceded) return; // conceded realms spend nothing
    const L = botLedger(G, pi),
      roles = botRoles(G, pi);
    if (
      L.budget < 1 ||
      (L.upkeep >= L.upkeepCap && !(L.nav && L.nav.upkeep < L.nav.cap) && !(L.air && L.air.upkeep < L.air.cap))
    )
      return; // broke or every wage cap committed
    // A holder is a bot character not doing anything yet. NOTE: runTurn pre-populates
    // G.turnOrders[c.id] with an all-null array before the bot passes, and runBotMovement writes
    // movers' plans — so "idle" means every phase is still null (or a plain Defend), never a real
    // action.
    const isIdle = (c: Character) => {
      const o = theTurnsOrders(G)[c.id];
      return !o || o.every((x) => x == null || x.action === 'defend' || botIsTeach(x));
    }; // a teaching phase (slayer school) is kept, the rest is filled
    // Leaders first (their host is the priority), then feeders raising troops to carry to a host.
    const holders = theCharactersOf(G)
      .filter((c): c is Character => c != null && c.alive && c.player === pi && !c._isHeir && isIdle(c))
      .sort((a, b) => (roles.leaders.includes(b.id) ? 1 : 0) - (roles.leaders.includes(a.id) ? 1 : 0));
    theTallyOf(L).holdersIdle = holders.length;
    theTallyOf(L).holdersInRecruit = holders.filter((c) => {
      const p = G.world.provinces[c.location];
      return p?.owner === pi && theArmyTypesOf(p).some((t) => t && !/garrison/i.test(t));
    }).length;
    holders.forEach((c) => {
      const prov = G.world.provinces[c.location];
      if (prov?.owner !== pi) return; // must control the province to raise troops
      const orders: AnOrderAsThePassesReadIt[] = [null, null, null, null, null];
      let ph = 0;
      const hire = botHireOrder(G, pi, c, L);
      if (hire) orders[ph++] = hire;
      // Field troops muster to a co-located LEADER's banner when one stands here; else to the
      // holder
      // (a feeder, who then carries them to the nearest host next turn).
      const ld = theCharactersOf(G).find(
        (l) => l?.alive && l.player === pi && roles.leaders.includes(l.id) && l.location === c.location,
      );
      const dest = ld && ld.id !== c.id ? ld.id : null;
      const toks = botFieldRecruitTokens(G, pi, c, prov, L);
      const ro = botRecruitOrder(toks, dest);
      if (ro && ph < 5) orders[ph++] = ro;
      // keep a single-unit garrison in every province (2/3 for valuable land / the capital once a
      // player is on our doorstep) — cheap tripwires, never a substitute for the field army.
      const go = botGarrisonOrder(G, pi, prov, L);
      if (go && ph < 5) orders[ph++] = go;
      {
        const prev = theTurnsOrders(G)[c.id] ?? [];
        const tp = [0, 1, 2, 3, 4].filter((p) => botIsTeach(prev[p])); // 2026-09-28: teaching phases stay where the slayer school put them
        if (tp.length && orders.some((o) => o)) {
          const q = orders.filter((o) => o);
          const merged: AnOrderAsThePassesReadIt[] = [null, null, null, null, null];
          tp.forEach((p) => {
            merged[p] = prev[p];
          });
          let k = 0;
          for (let p = 0; p < 5 && k < q.length; p++) {
            merged[p] ??= q[k++];
          }
          orders.splice(0, 5, ...merged);
          ph = merged.filter(Boolean).length;
        }
      }
      if (orders.some((o) => o)) {
        const tail = botPracticeFallback(G, pi, c);
        for (let p = 0; p < 5; p++)
          orders[p] ??=
            p === ph
              ? { action: 'defend', target: '', extra: '', desc: 'Hold' }
              : tail
                ? { ...tail }
                : { action: 'defend', target: '', extra: '', desc: 'Hold' };
        theTurnsOrders(G)[c.id] = orders;
      }
    });
    // Sept 2026 (§94, idle gold): recruit OPPORTUNITIES were the binding constraint, not the ceiling.
    // (a) A marching leader recruits in the first owned recruit province his plan stands in with a filler
    //     phase to spare (the filler after his last move is usually Practice/Defend).
    // (b) With 20g+ in the chest, a specialist still TRAINING in an owned recruit province spends one phase
    //     mustering troops to carry to the nearest host next year (an armed hero is a feeder).
    const filler = (o: AnOrderAsThePassesReadIt) =>
      !o || (['practice', 'defend', 'research', 'explore'].includes(o.action) && !botIsTeach(o)); // a teaching phase is not spare
    // review II A2: a leader, defender, armed hero or unassigned hero standing (or arriving) in an owned province
    // holding more than two garrison units takes the surplus up at his first filler phase there.
    theCharactersOf(G).forEach((c) => {
      if (!(c?.alive && c.player === pi && !c._isHeir)) return;
      if (c._botRole !== undefined && BOT_SPECIALIST_ROLES.has(c._botRole)) return; // scholars, scouts, spies, thieves and slayers stay unarmed
      const o = theTurnsOrders(G)[c.id];
      if (!Array.isArray(o)) return;
      let cur = G.world.provinces[c.location];
      if (!cur) return;
      for (let p = 0; p < 5; p++) {
        const x = o[p];
        if (x?.action === 'move') {
          let N: Province | null | undefined;
          if (theTargetAsWords(x).startsWith('dir:')) {
            const d = BOT_HEX_DIRS.indexOf(theTargetAsWords(x).slice(4));
            N = botNeighbourProv(G, cur, d);
          } else N = G.world.provinces[+x.target];
          if (!N) return;
          cur = N;
          continue;
        }
        if (x?.action === 'pickup_army') return;
        if (filler(x) && !(x?.action === 'defend' && p === 0 && c._botRole === 'defender')) {
          const po = botPickupOrder(G, pi, c, cur);
          if (po) {
            o[p] = po;
            return;
          }
        }
      }
    });
    theCharactersOf(G).forEach((c) => {
      if (!(c?.alive && c.player === pi && !c._isHeir)) return;
      const o = theTurnsOrders(G)[c.id];
      if (!o?.some((x) => x?.action === 'move')) return;
      if (!roles.leaders.includes(c.id)) return;
      let cur = G.world.provinces[c.location];
      if (!cur) return;
      for (let p = 0; p < 5; p++) {
        const x = o[p];
        if (x?.action === 'move') {
          let N: Province | null | undefined;
          if (theTargetAsWords(x).startsWith('dir:')) {
            const d = BOT_HEX_DIRS.indexOf(theTargetAsWords(x).slice(4));
            N = botNeighbourProv(G, cur, d);
          } else N = G.world.provinces[+x.target];
          if (!N) return;
          cur = N;
          continue;
        }
        if (filler(x) && cur.owner === pi && theArmyTypesOf(cur).length && L.budget >= 2 && L.upkeep < L.upkeepCap) {
          const toks = botFieldRecruitTokens(G, pi, c, cur, L).filter(
            (t) => !BOT_SEA_ALL.has(t.split('|')[0] ?? '') || c._botRole === 'admiral',
          );
          const ro = botRecruitOrder(toks, null);
          if (ro) {
            o[p] = ro;
          }
          return;
        }
      }
    });
    // Sept 2026 (Toby): the KING TEACHES THE SCHOLAR — generalised 2026-09-26 (Toby: slayers must train fast enough to
    // clear a lair a year): EVERY TRAINEE IS MENTORED. The engine's mentor rule makes a practice automatic when a
    // friendly character in the same province practises the same skill in the same phase at a HIGHER level. So for
    // every character practising skill S at level L, any co-located realm character above L whose phase is a filler
    // (a practice that is not a host drill, or a Hold with nothing near) practises S too. Levels 1→3 that took a
    // slayer five or six years solo (15–20% a phase) now take one, whenever a better swordsman stands with him
    // (botTrainOrders walks him to one).
    {
      const locs = (ch: Character) => {
        const o = theTurnsOrders(G)[ch.id] ?? [];
        const out: (number | null)[] = [];
        let cur: Province | null | undefined = G.world.provinces[ch.location];
        for (let p = 0; p < 5; p++) {
          out.push(cur ? cur.id : null);
          const x = o[p];
          if (x?.action === 'move' && cur) {
            let N: Province | null | undefined;
            if (theTargetAsWords(x).startsWith('dir:'))
              N = botNeighbourProv(G, cur, BOT_HEX_DIRS.indexOf(theTargetAsWords(x).slice(4)));
            else N = G.world.provinces[+x.target];
            cur = N ?? cur;
          }
        }
        return out;
      };
      const mine = theCharactersOf(G).filter(
        (x): x is Character =>
          x != null && x.alive && x.player === pi && !x._isHeir && Array.isArray(theTurnsOrders(G)[x.id]),
      );
      const L_ = new Map<number, (number | null)[]>();
      mine.forEach((x) => L_.set(x.id, locs(x)));
      /** A hero's places by phase, which L_ holds for each of `mine`: for none, the TypeError its read would throw. */
      const placesOf = (ch: Character) => {
        const l = L_.get(ch.id);
        if (l === undefined) throw new TypeError("Cannot read properties of undefined (reading '0')");
        return l;
      };
      const filler = (m: Character, p: number) => {
        const k = (theTurnsOrders(G)[m.id] ?? [])[p];
        if (!k) return true;
        if (k.action === 'practice')
          return !/drill the host|drill the fleet|lead the host cleanly/.test(k.desc || '') && !botIsTeach(k);
        return k.action === 'defend' && p > 0 && !botNearbyThreat(G, pi, m);
      };
      mine.forEach((t) => {
        const to = thePlanOf(G, t);
        const tl = placesOf(t);
        for (let p = 0; p < 5; p++) {
          const x = to[p];
          if (!(x?.action === 'practice' && x.target)) continue;
          const S = x.target;
          const lvl = theLevelOf(t, S);
          if (lvl >= 5) continue;
          // the best mentor standing here this phase — highest level above the trainee's
          let best: Character | null = null;
          for (const m of mine) {
            if (m.id === t.id) continue;
            const ml = theLevelOf(m, S);
            if (ml <= lvl) continue;
            if (placesOf(m)[p] == null || placesOf(m)[p] !== tl[p]) continue;
            if (!filler(m, p)) continue;
            if (!best || ml > theLevelOf(best, S)) best = m;
          }
          if (!best) continue;
          const mo = thePlanOf(G, best);
          const taught = mo[p];
          if (taught?.action === 'practice' && taught.target === S) continue; // already teaching
          mo[p] = {
            action: 'practice',
            target: S,
            extra: '',
            desc: 'Practice ' + theLabelOf(S) + ' (teach ' + t.name + ')',
          };
        }
      });
      // 2026-09-28 (Toby): SLAYER TRAINING PARTNERS. When a slayer practises Melee, Archery or a magic school, every
      // other realm character standing with him with that phase spare practises it too, whatever his own level:
      // one below the slayer is taught by him (the mentor rule — a guaranteed level), one at his level makes a
      // pair (+half the solo chance each), one above teaches him. A specialist's own craft practice (Sage, Spy…)
      // is left alone.
      const PARTNER_SK = new Set(['melee', 'archery', ...BOT_SCHOOLS]);
      mine
        .filter((t) => t._botRole === 'slayer')
        .forEach((t) => {
          const to = theTurnsOrders(G)[t.id];
          const tl = L_.get(t.id);
          if (!Array.isArray(to) || !tl) return;
          for (let p = 0; p < 5; p++) {
            const x = to[p];
            if (!(x?.action === 'practice' && PARTNER_SK.has(x.target))) continue;
            const S = x.target;
            if (theLevelOf(t, S) >= 5) continue;
            mine.forEach((m) => {
              if (m.id === t.id) return;
              const ml = L_.get(m.id);
              if (ml?.[p] == null || ml[p] !== tl[p]) return;
              if (!filler(m, p)) return;
              const mo = thePlanOf(G, m);
              const cur = mo[p];
              if (cur?.action === 'practice' && (cur.target === S || cur.target === theCraftOf(m))) return;
              if (theLevelOf(m, S) >= 5 && theLevelOf(t, S) >= theLevelOf(m, S)) return;
              mo[p] = {
                action: 'practice',
                target: S,
                extra: '',
                desc: 'Practice ' + theLabelOf(S) + ' (with ' + t.name + ')',
              };
            });
          }
        });
    }
    if (L.budget >= 20) {
      theCharactersOf(G).forEach((c) => {
        if (!(c?.alive && c.player === pi && !c.isKing && !c._isHeir && !theUnitsWithGapsOf(c).length)) return;
        if (L.budget < 2 || L.upkeep >= L.upkeepCap) return;
        const o = theTurnsOrders(G)[c.id];
        if (!o?.length || o.some((x) => x?.action === 'move')) return;
        const training = o.some((x) => x && (x.action === 'practice' || x.action === 'explore'));
        if (!training) return; // 2026-09-26: Explore is a filler phase too (the explore-first fallback had closed this muster path)
        if (c._botRole === 'scholar' || c._botRole === 'spy') return; // the court's scholars and spies keep at their books
        const prov = G.world.provinces[c.location];
        if (prov?.owner !== pi || !theArmyTypesOf(prov).length) return;
        const p = o.findIndex(
          (x) =>
            x &&
            (x.action === 'practice' || x.action === 'explore') &&
            !botIsTeach(x) &&
            !(x.desc || '').includes('(taught by '),
        );
        if (p < 0) return;
        const toks = botFieldRecruitTokens(G, pi, c, prov, L).filter((t) => !BOT_SEA_ALL.has(t.split('|')[0] ?? ''));
        const ro = botRecruitOrder(toks, null);
        if (ro) {
          ro.desc += ' (for the host)';
          o[p] = ro;
        }
      });
    }
    if (typeof window !== 'undefined' && Array.isArray(window.__botDiag))
      window.__botDiag.push({ turn: G.turn, pi, ...L.diag, budgetEnd: L.budget, upkeepEnd: L.upkeep }); // harness-only diagnostics
  });
}

// ══ BOT ORDER HYGIENE (2026-09-29, Toby) ════
// The last bot pass of the turn, after every planner has written its orders. A 30-game audit found 8.6% of bot
// orders could not have worked when they were given: Practice on a skill already at the drill cap of 5 (240 a
// game, many sources: the generic fillers, cross-training, the host/fleet drills), casts past the per-turn school
// limit (154 a game, mostly a second or third Elemental Summon / Skeletal Armies), a Hire of a hero the SAME realm
// had already hired, a hero the hirer will not be standing with, or one the treasury cannot pay (73), and column
// hand-overs whose Skeletal Armies then refuse a living commander and disband (2 a game).
// Rules (Toby): a hero at 5+ in a skill practises it ONLY to teach a comrade practising it beside him (or, for
// Tactical / Naval, to drill troops that can still improve). Heroes still train TOGETHER: a phase freed here is
// first offered to a comrade training in the same place (learn from him, teach him, or pair at equal level for
// +50% each), and a final pass pulls a free hero standing with a trainee into teaching or pairing with him.
export const BOT_PRACTICE_BASE = [0.25, 0.2, 0.15, 0.1, 0.05]; // the engine's solo chance by level (case 'practice')
export const BOT_HYG_CRAFT = new Set(['sage', 'explorer', 'spy', 'thief']);
/** The engine's solo chance at a level (`BOT_PRACTICE_BASE[Math.min(4, l)]`): for a level below 0, none, read as a
 *  number (`NaN`, as `undefined * 1.5` and `x >= undefined` read it). */
function theSoloChanceAt(l: number): number {
  return Number(BOT_PRACTICE_BASE[Math.min(4, l)]);
}
export function botDrillUseful(c: Character, S: string) {
  if (S !== 'tactical' && S !== 'naval') return false;
  const sea = new Set(asItsGuardReadsIt(KC_UNIT_CLASS)?.sea ?? []);
  const drillBase: Readonly<Partial<Record<string, number>>> = UNIT_DRILL_BASE;
  return theUnitsWithGapsOf(c).some(
    (a) =>
      a &&
      !a._isSkeletal &&
      !a._phantom &&
      (drillBase[a.quality] ?? 0) > 0 &&
      (S === 'naval' ? sea.has(a.type) : !sea.has(a.type)),
  );
}
// `practised`: Practice orders on this school earlier in the turn. Like the player's order form
// (item 16, 2026-10-13), the limit assumes each one succeeds (+1 a time, training stops at 5).
export function botCastLimit(G: GameState, c: Character, school: string, practised?: number) {
  const raw = skillLevel(c, school),
    pr = Number(practised) || 0;
  const l = Number(
    effSkillOf(
      pr && raw < 5 ? { ...c, skills: { ...c.skills, [school]: Math.min(5, raw + pr) } } : c,
      school,
      asItsGuardReadsIt(G.characters) ?? [],
    ),
  ); // a hero's figure, a number (effSkillOf gives none only for no hero)
  // the Warlock's extra cast in his best school as he stands before the practice: the Cast Spell order's rule (R-123)
  const warlock = G._minorHolders?.warlock?.charId === c.id;
  return actionSpellsAHeroMayCastInASchoolEachTurn(c, school, l, warlock);
}
export function runBotOrderHygiene(G: GameState, botIdxSet: ReadonlySet<number>) {
  const tally = typeof window !== 'undefined' && window.__botHyg ? window.__botHyg : null;
  const bump = (k: string) => {
    if (tally) tally[k] = (tally[k] ?? 0) + 1;
  };
  botIdxSet.forEach((pi) => {
    const P = theRealmsOf(G)[pi];
    if (!P) return;
    const mine = theCharactersOf(G).filter(
      (x): x is Character =>
        x != null && x.alive && x.player === pi && !x._isHeir && Array.isArray(theTurnsOrders(G)[x.id]),
    );
    if (!mine.length) return;
    const LOC = new Map<number, (number | null)[]>();
    mine.forEach((x) => LOC.set(x.id, botOrderLocs(G, x)));
    const lv = (ch: Character, S: string) => theLevelOf(ch, S);
    const ord = (ch: Character, p: number) => (theTurnsOrders(G)[ch.id] ?? [])[p];
    const at = (ch: Character, p: number) => {
      const l = LOC.get(ch.id);
      return l ? l[p] : null;
    };
    const here = (a: Character, b: Character, p: number) => at(a, p) != null && at(a, p) === at(b, p);
    const isPr = (o: AnOrderAsThePassesReadIt): o is PhaseOrder => !!(o?.action === 'practice' && o.target);
    const isDrill = (o: AnOrderAsThePassesReadIt) =>
      /drill the host|drill the fleet|lead the host cleanly/.test(o?.desc ?? '');
    /** Whether a hero's order in a phase is a practice of the skill. */
    const practises = (ch: Character, p: number, S: string) => {
      const k = ord(ch, p);
      return isPr(k) && k.target === S;
    };
    const dead: [Character, number][] = []; // [char, phase] slots to refill
    // ── 1. SPELLS: the per-turn school limit, and one Elemental Summon a turn
    const spells: Readonly<Partial<Record<string, { readonly school?: string | null | undefined }>>> = SPELL_DEFS_P;
    mine.forEach((c) => {
      const o = thePlanOf(G, c);
      const used: Partial<Record<string, number>> = {};
      let summoned = false;
      for (let p = 0; p < 5; p++) {
        const x = o[p];
        if (x?.action !== 'cast_spell') continue;
        const d = spells[x.target];
        if (!d?.school) continue;
        if (x.target === theNameOfTheSpell('elemental-summon')) {
          if (summoned) {
            dead.push([c, p]);
            bump('summonTwice');
            continue;
          }
          summoned = true;
        }
        const school = d.school;
        const lim = botCastLimit(
          G,
          c,
          school,
          o.slice(0, p).filter((y) => y?.action === 'practice' && y.target === school).length,
        );
        const castInTheSchool = used[school] ?? 0;
        used[school] = castInTheSchool;
        if (castInTheSchool >= lim) {
          dead.push([c, p]);
          bump('overLimit');
          continue;
        }
        used[school] = castInTheSchool + 1;
      }
    });
    // ── 2. HIRES: one order per hero per realm, the hirer standing where the hero is, a wage the treasury can meet
    {
      const taken = new Set();
      let gold = P.gold || 0;
      const H: [Character, number, PhaseOrder][] = [];
      mine.forEach((c) => {
        const o = thePlanOf(G, c);
        for (let p = 0; p < 5; p++) {
          const x = o[p];
          if (x?.action === 'hire') H.push([c, p, x]);
        }
      });
      H.sort((a, b) => a[1] - b[1]);
      H.forEach(([c, p, x]) => {
        const h = theCharactersOf(G).find((z) => z?.id === parseInt(x.target));
        if (h?.player !== null || !h.alive) {
          dead.push([c, p]);
          bump('hireGone');
          return;
        }
        if (taken.has(h.id)) {
          dead.push([c, p]);
          bump('hireTwice');
          return;
        }
        if (at(c, p) !== h.location) {
          dead.push([c, p]);
          bump('hireElsewhere');
          return;
        }
        const w = heroHireWage(P.alignment || 'Neutral', h.alignment, false, h);
        if (w == null || gold < w) {
          dead.push([c, p]);
          bump('hireUnaffordable');
          return;
        }
        taken.add(h.id);
        gold -= w;
      });
    }
    // ── 3. HAND-OVERS: Skeletal Armies follow only an Undead commander — keep them, pass on the rest
    mine.forEach((c) => {
      const o = thePlanOf(G, c);
      for (let p = 0; p < 5; p++) {
        const x = o[p];
        if (!(x?.action === 'leave_army' && x.extra)) continue;
        const r = theCharactersOf(G).find((z) => z?.id === parseInt(x.extra));
        if (!r) continue;
        const undead =
          r.alignment === 'Undead' || (r.player != null && theRealmsOf(G)[r.player]?.alignment === 'Undead');
        if (undead) continue;
        const skel = theUnitsWithGapsOf(c).filter((a) => a?._isSkeletal);
        if (!skel.length) continue;
        const live = theUnitsWithGapsOf(c).filter(
          (a): a is Army =>
            a != null &&
            !a._isSkeletal &&
            (x.target === 'all' ||
              theTargetAsWords(x)
                .split(',')
                .map((t) => t.trim())
                .some((t) => t === a.type || t === a.unitName)),
        );
        if (!live.length) {
          dead.push([c, p]);
          bump('handoverAllSkeletal');
          continue;
        }
        x.target = live.map((a) => (a.unitName && !a.unitName.includes(',') ? a.unitName : a.type)).join(',');
        x.desc = (x.desc || 'Hand column') + ' (the living only)';
        bump('handoverTrimmed');
      }
    });
    // ── 4. PRACTICE at the drill cap: only to teach, or to drill troops that can still improve
    mine.forEach((c) => {
      const o = thePlanOf(G, c);
      for (let p = 0; p < 5; p++) {
        const x = o[p];
        if (!isPr(x)) continue;
        const S = x.target;
        if (lv(c, S) < 5) continue;
        if ((S === 'tactical' || S === 'naval') && botDrillUseful(c, S)) continue;
        if (mine.some((t) => t.id !== c.id && here(t, c, p) && practises(t, p, S) && lv(t, S) < lv(c, S))) continue; // teaching
        dead.push([c, p]);
        bump('practiceCapped');
      }
    });
    // ── refill each dead slot: join a comrade training here, else own best skill below 5, else drill, else hold
    const filler = (c: Character, p: number): PhaseOrder => {
      let best: { readonly S: string; readonly sc: number; readonly t: Character } | null = null;
      for (const t of mine) {
        if (t.id === c.id || !here(t, c, p)) continue;
        const o = ord(t, p);
        if (!isPr(o) || isDrill(o)) continue;
        const S = o.target;
        if (!hasALabel(S)) continue;
        const me = lv(c, S),
          him = lv(t, S);
        let sc = 0;
        if (me < 5 && him > me) sc = 3;
        else if (him < me) sc = 2;
        else if (me < 5 && him === me) sc = 1;
        if (sc && (!best || sc > best.sc)) best = { S, sc, t };
      }
      if (best)
        return {
          action: 'practice',
          target: best.S,
          extra: '',
          desc:
            'Practice ' +
            theLabelOf(best.S) +
            ' (' +
            (best.sc === 3 ? 'taught by ' : best.sc === 2 ? 'teach ' : 'with ') +
            best.t.name +
            ')',
        };
      const S = botPracticeSkill(c);
      if (S) return { action: 'practice', target: S, extra: '', desc: 'Practice ' + theLabelOf(S) };
      if (botDrillUseful(c, 'tactical'))
        return { action: 'practice', target: 'tactical', extra: '', desc: 'Practice Tactical (drill the host)' };
      if (botDrillUseful(c, 'naval'))
        return { action: 'practice', target: 'naval', extra: '', desc: 'Practice Naval (drill the fleet)' };
      return { action: 'defend', target: '', extra: '', desc: 'Hold' };
    };
    dead.forEach(([c, p]) => {
      thePlanOf(G, c)[p] = null;
    });
    dead.forEach(([c, p]) => {
      const plan = thePlanOf(G, c);
      plan[p] ??= filler(c, p);
    });
    // ── 5. TRAIN TOGETHER: a free hero standing with a trainee teaches him (a certain level), or pairs with him at
    // equal level when the pair's +50% beats his own solo chance. "Free" = a plain practice (not a drill, a lesson,
    // a pairing, a specialist's own craft, a slayer's ladder) or a Hold after Spring with no threat near.
    const free = (m: Character, p: number) => {
      const k = ord(m, p);
      if (!k) return true;
      if (k.action === 'defend')
        return p > 0 && !/Watch|lies in wait/i.test(k.desc || '') && !botNearbyThreat(G, pi, m);
      if (!isPr(k) || isDrill(k) || /\((teach|taught by|with) /.test(k.desc || '')) return false;
      if (m._botRole === 'slayer' || m._botRole === 'mage') return false;
      if (BOT_HYG_CRAFT.has(k.target) && m._botRole !== undefined && BOT_SPECIALIST_ROLES.has(m._botRole)) return false;
      return true;
    };
    for (let p = 0; p < 5; p++) {
      mine.forEach((t) => {
        const x = ord(t, p);
        if (!isPr(x) || isDrill(x)) return;
        const S = x.target;
        const tl = lv(t, S);
        if (tl >= 5 || !hasALabel(S)) return;
        if (mine.some((m) => m.id !== t.id && here(m, t, p) && practises(m, p, S) && lv(m, S) > tl)) return; // already taught
        let mentor: Character | null = null;
        for (const m of mine) {
          if (m.id === t.id || !here(m, t, p) || !free(m, p)) continue;
          if (lv(m, S) > tl && (!mentor || lv(m, S) > lv(mentor, S))) mentor = m;
        }
        if (mentor) {
          thePlanOf(G, mentor)[p] = {
            action: 'practice',
            target: S,
            extra: '',
            desc: 'Practice ' + theLabelOf(S) + ' (teach ' + t.name + ')',
          };
          bump('teachAdded');
          return;
        }
        if (mine.some((m) => m.id !== t.id && here(m, t, p) && practises(m, p, S) && lv(m, S) === tl)) return; // already paired
        let peer: Character | null = null;
        for (const m of mine) {
          if (peer || m.id === t.id || !here(m, t, p) || !free(m, p) || lv(m, S) !== tl) continue;
          const k = ord(m, p);
          const own = isPr(k) ? (lv(m, k.target) < 5 ? theSoloChanceAt(lv(m, k.target)) : 0) : 0;
          if (theSoloChanceAt(tl) * 1.5 >= own) peer = m;
        }
        if (peer) {
          thePlanOf(G, peer)[p] = {
            action: 'practice',
            target: S,
            extra: '',
            desc: 'Practice ' + theLabelOf(S) + ' (with ' + t.name + ')',
          };
          bump('pairAdded');
        }
      });
    }
  });
}
