import { monarchRestProvId } from '../grand-design.ts';
import { senseGravesUnderfoot } from '../graves.ts';
import { consecratedIds, relOfReport } from '../heroes/fame-and-consecration.ts';
import { settleTheItemsAHeroGained } from '../items/equipment.ts';
import { maxHpPlayers } from '../heroes/skills-and-hp.ts';
import { applyItemMaxHp } from '../personal-combat/helpers.ts';
import { perkTier } from '../titles/perks.ts';
import { progressNeutralHeroes } from '../heroes/charms-and-neutrals.ts';
import { MASS_HEALING_PCT, healFeatureMonsters } from '../chances-and-lair-grades.ts';
import { effStat } from '../heroes/effective-skills-and-hidden-heroes.ts';
import { flushIntrusionNotifications } from './intrusion-warnings.ts';
import { resolveAllPendingSkillGains, syncAllMaxHp } from '../heroes/experience-skill-rises-and-earned-hp.ts';
import {
  emit,
  writeDeferredSkillLines,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  THE_PHASE_THE_LINE_IS_WRITTEN_IN,
} from './events-and-their-audiences.ts';
import { abandonHostOnFlight, disperseDeadCharArmies } from '../heroes/hero-death-and-leaderless-hosts.ts';
import { reconcileProvinceCharacters } from '../world/province-bookkeeping-and-rallied-garrisons.ts';
import { flagEnemyStandoffs } from '../battle/war-fronts-and-enemy-stand-offs.ts';
import type { ElvenEscape, TurnContext } from './context.ts';
import type { SkeletalCompaniesThatCrumbled } from './the-facts-the-lines-after-the-phases-record.ts';
import { asItsGuardReadsIt } from '../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import type { Army, Character, GameState, Province, Realm } from '../../schemas/saved-game-state.ts';

// ── AFTER THE PHASES (plan P1-08k3: the first stage taken out of resolveTurn's own body) ──────────────────────────
// Once the turn's five phases are played (no phase is current any more, and every later line is filed after them),
// the turn settles what the seasons left, in this order:
//   1. a stand-off struck in the last phase is flagged, so the saved map shows the province contested;
//   2. the dead need a master: skeletal companies led by a character with no Necromancy, or left in a garrison, crumble;
//   3. graves underfoot: a necromancer who never moved senses the battlefield dead where he stands;
//   4. neutral heroes may learn a skill; a consecrated province that has changed hands loses its blessing;
//   5. couriers deliver the parcels sent across provinces; Elven companies that slipped a lost battle reach home;
//   6. skill rises still pending are told; a fallen commander's host garrisons, retreats or scatters; intrusions are
//      told once each; wounded lair guardians recover; Mass Healing mends friends standing with a White master;
//   7. every maximum HP is resynced (with a save's one-time note on the earned-HP pool);
//   8. a coward spared on the field makes his way home, his host left behind, and the provinces' lists are rebuilt;
//   9. every hero's location name is brought up to date.
// It takes the turn's context (src/engine/turn/context.ts) and nothing else: it reads no value of the phase loop's.
// Each line is a fact (since P1-12d16: the-facts-the-lines-after-the-phases-record.ts), its words written in the views.
// The body keeps resolveTurn's indent (plan P1-08's Decisions).

/** A parcel on the road as the couriers read it (a gap in the list is passed over). */
type AParcelOnTheRoad = NonNullable<GameState['_itemDeliveries']>[number];
/** A fallen hero as his death marked him: who slew him (`_slainBy`, handleHeroDeath's mark, which the saved state
 *  lacks), cleared here once his host is told. */
type AHeroAsHisDeathMarksHim = object & { _slainBy?: unknown };

export function afterThePhasesStandOffsTheDeadGravesCouriersMassHealingCowardsAndLocationNames(
  turnContext: TurnContext,
): void {
  const { G, _elvenEscapeQueue } = turnContext;
  // A stand-off struck in the final phase is still a stand-off: flag it now so the state that is
  // SAVED (and every player's map) shows the province as contested, and the fight is joined at the
  // first sweep of next turn rather than being invisible for a whole season.
  flagEnemyStandoffs(turnContext);

  // ── THE DEAD NEED A MASTER ────
  // A skeletal unit is animate only while someone is animating it. It must be led by a CHARACTER
  // (hero or king) with at least Necromancy 1; left with anyone else, or set down as a province
  // garrison where nobody leads it at all, it falls apart. The owning realm is always told, by name
  // and place, so a host does not quietly shrink between turns.
  //
  // Read through `effStat`, so a character who holds the school only through an ITEM still keeps
  // the dead standing — the magic is what matters, not where it came from.
  //
  // TIMING, deliberately: this runs ONCE at END OF TURN rather than after every phase. The rule is
  // absolute (you cannot hold skeletons without a necromancer) but a realm is still free to move a
  // skeletal host between two necromancers within a turn — dropping it to a garrison in phase 2 and
  // picking it up in phase 3 is a legitimate manoeuvre, and an end-of-phase sweep would destroy the
  // host mid-handover.
  {
    // playerIndex -> [ the companies that crumbled, each a record of where (since P1-12d16: the line's fact holds them) ]
    const _crumbled: Record<number, SkeletalCompaniesThatCrumbled[]> = {};
    const _note = (pi: number | null | undefined, where: SkeletalCompaniesThatCrumbled) => {
      if (pi == null) return;
      const here = _crumbled[pi] ?? [];
      _crumbled[pi] = here;
      here.push(where);
    };
    // (a) led by a character with no Necromancy
    (asItsGuardReadsIt(G.characters) ?? []).forEach((c: Character | null | undefined) => {
      if (c?.player == null || !Array.isArray(c.armies) || !c.armies.length) return;
      if (effStat(turnContext, c, 'necromancy') >= 1) return;
      const dead = c.armies.filter((a: Army | null | undefined) => a?._isSkeletal);
      if (!dead.length) return;
      c.armies = c.armies.filter((a: Army | null | undefined) => !a?._isSkeletal);
      const pv = G.world.provinces[c.location];
      _note(c.player, {
        kind: 'skeletal companies crumble under a hero with no Necromancy',
        unitCount: dead.length,
        heroName: c.name,
        provinceName: pv ? pv.name : null,
      });
    });
    // (b) set down as a garrison, where no character leads them at all
    (asItsGuardReadsIt(G.world.provinces) ?? []).forEach((pv: Province | null | undefined) => {
      if (!pv || !Array.isArray(pv.garrisonArmies) || !pv.garrisonArmies.length) return;
      const dead = pv.garrisonArmies.filter((a: Army | null | undefined) => a?._isSkeletal);
      if (!dead.length) return;
      pv.garrisonArmies = pv.garrisonArmies.filter((a: Army | null | undefined) => !a?._isSkeletal);
      _note(pv.owner, {
        kind: 'skeletal companies left to garrison a province crumble',
        unitCount: dead.length,
        provinceName: pv.name,
      });
    });
    Object.entries(_crumbled).forEach(([k, crumbled]) => {
      const pi = +k;
      emit(turnContext, {
        type: 'hire',
        fact: { kind: 'skeletal companies crumble with no necromancer to hold them', crumbled },
        audience: { actor: pi, realms: [pi] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        system: true,
      });
    });
  }

  // ── GRAVES UNDERFOOT ────
  // Every character with at least one level of Necromancy senses the battlefield dead of the ground
  // they stand on. They learn only THAT graves are there, never what lies in them — Control
  // Undead's province scan is what buys the roll of the dead, and it records its own richer entry
  // when it is cast (see necromancy_control __scan__). Item 7: the reading now happens at EVERY
  // march-in during the phase loop as well
  // (see senseGravesUnderfoot at the move choke-point), so a necromancer marching three provinces
  // reads all three, not only the one they stop in. This end-of-turn sweep therefore only catches
  // whoever never moved — senseGravesUnderfoot's own per-turn guard skips anyone already read here.
  (asItsGuardReadsIt(G.characters) ?? []).forEach((c: Character | null | undefined) => {
    if (!c?.alive || c.player == null) return;
    const pv = G.world.provinces[c.location];
    if (!pv) return;
    senseGravesUnderfoot(G, c, pv, (p2) => {
      emit(turnContext, {
        type: 'explore',
        fact: { kind: 'a necromancer senses graves underfoot', heroName: c.name, provinceName: p2.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        province: p2.id,
      });
    });
  });

  // ── NEUTRAL HERO PROGRESSION (2026-09-17 (late), Toby item 1) ────
  // Wandering heroes and local chieftains do not stand still while nobody commands them. From the
  // END of turn NEUTRAL_PROG_FROM_TURN onward, every living neutral hero (player===null — wanderers
  // and neutral-guard chieftains alike) rolls NEUTRAL_PROG_PCT once a turn. On a success, exactly
  // ONE skill point is gained:
  // • sharing a province with another neutral hero → they learn from them: the skill raised is the
  // OTHER hero's highest skill (a random one of them if several tie);
  // • alone → one of their own EXISTING skills (level ≥1), chosen at random.
  // Never more than one point per hero per turn, never past SKILL_MAX. A learner already at the cap
  // in the peer's best skill falls back to the alone rule rather than wasting the roll. Implemented
  // in progressNeutralHeroes (module scope) so the harness can drive it directly.
  // 2026-09-23 (Toby): 25% a turn (was 50%), and never past level 5 by this route (NEUTRAL_PROG_CAP).
  progressNeutralHeroes(G, (txt, pv) => {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a neutral hero learns a skill', words: txt },
      audience: { realms: [] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      province: pv ? pv.id : null,
      system: true,
    });
  });

  // ── DE-CONSECRATION ── A consecrated province that has passed out of the Divine king's hands
  // this turn (captured by an enemy, or otherwise no longer owned) loses its blessing — which also
  // frees a slot so the king may hallow new ground next turn (up to his White skill level).
  (asItsGuardReadsIt(G.players) ?? []).forEach((pl: Realm | null | undefined, pi) => {
    if (!pl) return;
    const list = consecratedIds(pl);
    if (!list.length) return;
    const kept = list.filter((pid) => {
      const pv = G.world.provinces[pid];
      return pv?.owner === pi;
    });
    if (kept.length !== list.length) {
      list
        .filter((pid) => !kept.includes(pid))
        .forEach((pid) => {
          const pv = G.world.provinces[pid];
          if (pv)
            emit(turnContext, {
              type: 'system',
              fact: {
                kind: 'a consecration is broken as its province passes from the realm',
                provinceName: pv.name,
                realmName: pl.name,
              },
              audience: { actor: pi, realms: [pi], seen: 'there' },
              hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
              phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
              province: pid,
              env: true,
            });
        });
      pl.consecratedProvIds = kept;
    }
  });

  // ── COURIER DELIVERIES ── Cross-province Send Item arrivals reach their recipient now, as the
  // season closes, so the items are in hand from the START of next turn (not usable this turn). If
  // the recipient fell this turn the parcel routes to their king (if one lives), else it is lost.
  if (Array.isArray(G._itemDeliveries) && G._itemDeliveries.length) {
    G._itemDeliveries.forEach((d: AParcelOnTheRoad | null | undefined) => {
      // A parcel whose contents were cut out by a Grand Heist is no parcel at all — skip it rather
      // than announce an empty courier arriving.
      // (its items, tested a list here, are read as that list below: no `|| []` can be reached)
      if (!d || !Array.isArray(d.items) || d.items.length === 0) return;
      let dest: Character | null | undefined = (asItsGuardReadsIt(G.characters) ?? []).find(
        (ch: Character | null | undefined) => ch?.id === d.toId && ch.alive,
      );
      if (!dest) {
        const _orig = (asItsGuardReadsIt(G.characters) ?? []).find(
          (ch: Character | null | undefined) => ch?.id === d.toId,
        );
        const pi = _orig ? _orig.player : null;
        dest =
          pi != null
            ? (asItsGuardReadsIt(G.characters) ?? []).find(
                (ch: Character | null | undefined) => ch?.alive && ch.player === pi && ch.isKing,
              )
            : null;
      }
      // the parcel's items by name, joined: a lost parcel whose items have no names is told of by no line
      const nm = d.items.map((it) => it.name).join(', ');
      if (!dest) {
        if (nm)
          emit(turnContext, {
            type: 'hire',
            fact: {
              kind: "a courier's parcel finds no one left to receive it",
              itemNames: d.items.map((it) => it.name),
              senderName: (d.fromName ?? '') || null,
            },
            audience: { actor: null, realms: [] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            phase: 99,
          });
        return;
      }
      const reached = dest; // (read into a const: the closure below reads him too)
      const hisItems = asItsGuardReadsIt(reached.items) ?? [];
      reached.items = hisItems;
      d.items.forEach((item) => {
        hisItems.push(item);
        applyItemMaxHp(reached, item); /* item 6 */
      });
      emit(turnContext, {
        type: 'hire',
        fact: {
          kind: "a courier's parcel reaches its hero as the season closes",
          heroName: reached.name,
          itemNames: d.items.map((it) => it.name),
          senderName: (d.fromName ?? '') || null,
        },
        audience: { actor: reached.player, realms: [reached.player] },
        hero: reached.id,
        phase: 99,
      });
      {
        const _gn = settleTheItemsAHeroGained(reached, d.items);
        if (_gn)
          emit(turnContext, {
            type: 'hire',
            fact: { kind: "a hero a courier's parcel reaches notes how he carries it", theItemsHeGained: _gn },
            audience: { actor: reached.player, realms: [reached.player] },
            hero: reached.id,
            phase: 99,
          });
      } // item 10
    });
    G._itemDeliveries = [];
  }

  // ── ELVEN ESCAPE delivery ── Units that slipped a lost battle make for home NOW, when the turn's
  // fighting is done and ownership is final. Each is placed in the king's home province (or the
  // realm's wealthiest remaining province if the home has fallen); a dynasty that holds no land at
  // all has nowhere to run to, and those survivors are lost. They arrive as garrison of the
  // province.
  if (Array.isArray(_elvenEscapeQueue) && _elvenEscapeQueue.length) {
    const _byPlayer: Record<number, ElvenEscape['unit'][]> = {};
    _elvenEscapeQueue.forEach((e) => {
      const here = _byPlayer[e.player] ?? [];
      _byPlayer[e.player] = here;
      here.push(e.unit);
    });
    Object.entries(_byPlayer).forEach(([pk, units]) => {
      const pi = +pk;
      const destId = monarchRestProvId(G, pi);
      const dest = destId != null ? G.world.provinces[destId] : null;
      if (!dest) {
        emit(turnContext, {
          type: 'combat',
          fact: {
            kind: 'Elven companies that slipped a battle scatter with no land to return to',
            unitCount: units.length,
            realmName: (G.players[pi]?.name ?? '') || null,
          },
          audience: { actor: null, realms: [pi] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          phase: 99,
        });
        return;
      }
      const garrisonNow = asItsGuardReadsIt(dest.garrisonArmies) ?? [];
      dest.garrisonArmies = garrisonNow;
      // (the same list, as the escaped companies join it: each as the queue holds it)
      const theGarrisonTheEscapesJoin: (Army | ElvenEscape['unit'])[] = garrisonNow;
      units.forEach((u) => theGarrisonTheEscapesJoin.push(u));
      emit(turnContext, {
        type: 'combat',
        fact: {
          kind: 'Elven companies that slipped a battle find their way home',
          unitNames: units.map((u) => (u.unitName ?? '') || u.type),
          provinceName: dest.name,
        },
        audience: { actor: pi, realms: [pi] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: dest.id,
        phase: 99,
      });
    });
    _elvenEscapeQueue.length = 0;
  }

  // Item 12 safety net: flush any incidental skill-rises that were earned after the last in-phase
  // flush (none expected today, but this guarantees no such line is ever silently dropped).
  resolveAllPendingSkillGains(turnContext);
  if (turnContext._deferredSkillLogs.length) {
    writeDeferredSkillLines(turnContext, turnContext._deferredSkillLogs);
    turnContext._deferredSkillLogs = [];
  }

  // ── Fallen-commander backstop ── The per-phase sweep deliberately leaves a leaderless host in
  // place while its province is still contested. The turn is over now, so nothing is left to fight:
  // whatever survived garrisons, retreats or scatters. This also bounds the state — no army can
  // stay attached to a corpse across a turn boundary, whatever happened during the turn.
  (asItsGuardReadsIt(G.characters) ?? []).forEach((dc) => {
    if (dc.alive) {
      delete dc._leaderlessHost;
      return;
    }
    delete dc._leaderlessHost;
    if ((asItsGuardReadsIt(dc.armies) ?? []).length > 0) disperseDeadCharArmies(turnContext, dc);
    const heAsHisDeathMarkedHim: AHeroAsHisDeathMarksHim = dc;
    delete heAsHisDeathMarkedHim._slainBy; // a commander who fell with no host keeps no note of the killer in the saved state
  });

  // Intel collapse: emit one consolidated intrusion line per (target, hero, province) now that all
  // phases are resolved, instead of a separate line each phase.
  flushIntrusionNotifications(turnContext);

  // Wounded feature guardians recover over the year between turns.
  healFeatureMonsters(turnContext);

  // ── WHITE L6 (Mass Healing) ── A master of the White arts standing among friendly characters at
  // year's end mends their wounds: each own/allied living character sharing their province (the
  // healer included) heals HALF their max HP. Runs after all combat.
  {
    const _mhDone = new Set<number>();
    (asItsGuardReadsIt(G.characters) ?? []).forEach((healer: Character | null | undefined) => {
      if (!healer?.alive || healer.player == null || asItsGuardReadsIt(healer.location) == null) return;
      if (perkTier(healer, 'white') < 1) return; // WHITE L6+
      (asItsGuardReadsIt(G.characters) ?? []).forEach((t: Character | null | undefined) => {
        if (!t?.alive || t.location !== healer.location || _mhDone.has(t.id)) return;
        const friendly =
          t.player === healer.player || (t.player != null && relOfReport(G, healer.player, t.player) === 'allied');
        if (!friendly) return;
        const max = t.maxHp || 20;
        if ((asItsGuardReadsIt(t.hp) ?? max) < max) {
          const _before = asItsGuardReadsIt(t.hp) ?? max;
          t.hp = Math.min(max, _before + Math.max(1, Math.ceil(max * MASS_HEALING_PCT)));
          _mhDone.add(t.id);
          emit(turnContext, {
            type: 'system',
            fact: {
              kind: "a master's Mass Healing mends a friend's wounds",
              healerName: healer.name,
              healedName: t.name,
              healsHimself: t.id === healer.id,
              hpGained: t.hp - _before,
              hp: t.hp,
              maxHp: max,
            },
            audience: { actor: t.player, realms: [t.player] },
            hero: t.id,
            phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
            province: t.location,
          });
        } else {
          _mhDone.add(t.id);
        }
      });
    });
  }

  // ── MAX-HP SYNC ── every living character's maximum HP is resynced (earned pool + kit + realm
  // discoveries) at the close of the turn and any change is announced in their Chronicle. Combat
  // wins announce their own gain at the moment of victory (rollHpGain); this catches item/discovery
  // moves.
  maxHpPlayers.players = G.players;
  turnContext.whatTheSavesUpgradeFound.heroesCarriedOverToTheEarnedHpPool.forEach((r) => {
    // one-time note for saves migrated to the earned-HP pool (the save's upgrade found them: engine/saves/)
    const ch = (asItsGuardReadsIt(G.characters) ?? []).find((c: Character | null | undefined) => c?.id === r.charId);
    if (!ch) return;
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: "a hero's maximum hit points are now earned in battle",
        heroName: ch.name,
        oldMaxHp: r.old,
        newMaxHp: r.nu,
      },
      audience: { actor: r.player, realms: [r.player], seen: 'world' },
      hero: ch.id,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
  });
  syncAllMaxHp(turnContext); // end-of-turn pass (also run after every phase — see the phase loop)

  // ── Spared cowards slink home ── A Cowardly commander who begged for mercy this turn abandons
  // the field; by next turn they have made their way back to their king's seat (home province, or
  // the wealthiest province still held if home has fallen). Done after all phases so it reads the
  // final ownership map. Characters with no land left (dynasty landless) simply stay where they
  // fled.
  // 2026-09-26 (Toby item 7) — HE RUNS; THE HOST DOES NOT. A man who throws down his sword and begs
  // for his life does not then lead his army home in good order. Whatever he was leading STAYS on
  // the ground he fled from: it falls in behind another commander of his realm still standing
  // there, or takes its place in the province garrison if the realm holds the ground, or — on
  // foreign soil with nobody left to lead it — meets exactly the fate a fallen commander's
  // leaderless host meets (falls back to adjacent friendly land, else scatters as mercenaries).
  (asItsGuardReadsIt(G.characters) ?? []).forEach((c) => {
    if (c._mercyFledTurn !== G.turn || !c.alive) return;
    // (asked only for a hero of a realm: for one of none it finds no realm at G.players[null], and gives none)
    const dest = c.player === null ? null : monarchRestProvId(G, c.player);
    if (dest != null && dest !== c.location) {
      abandonHostOnFlight(turnContext, c); // the host stays on the field he ran from — see the note above
      const heAsHeGoesHome: { location: number } = c; // (the same hero: the place found is a plain number)
      heAsHeGoesHome.location = dest;
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: 'a coward spared on the field makes his way home',
          heroName: c.name,
          provinceName: (G.world.provinces[dest]?.name ?? '') || null,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: c.id,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        province: dest,
      });
    }
  });
  reconcileProvinceCharacters(turnContext); // rebuild province.characters after any mercy relocations

  // 6. Update location names for all characters
  (asItsGuardReadsIt(G.characters) ?? []).forEach((c) => {
    const p = G.world.provinces[c.location];
    if (p) c.locationName = p.name;
  });
}
