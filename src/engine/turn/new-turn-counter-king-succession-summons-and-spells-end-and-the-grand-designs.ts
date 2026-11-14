import { KC_SKILLS, SAGE_DISCOVERIES_P } from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';
import { TEMPERS_P } from '../world/tables.ts';
import { nextHeroName } from '../names.ts';
import { ownedConsecratedProvs } from '../heroes/fame-and-consecration.ts';
import { discBlockedIds, discEligible, gdActive } from '../discoveries.ts';
import {
  emit,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  THE_PHASE_THE_LINE_IS_WRITTEN_IN,
} from './events-and-their-audiences.ts';
import type { TurnContext } from './context.ts';
import { theOneThePickFell } from '../orders/spells/what-an-action-spell-of-the-cast-spell-order-is-handed.ts';
import { asItsGuardReadsIt } from '../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import { theReturnARealmsAlignmentGivesItsFallen } from '../rules/the-registry-of-alignment-abilities.ts';
import { theSkillAKingOfTheAlignmentStartsWith } from '../rules-on-plain-values/the-world-each-creed-is-made-in-its-wild-country-its-first-skills-and-one-realm-a-game.ts';
import type { Army, Character, Mercenary, Province, Realm, SkillLevels } from '../../schemas/saved-game-state.ts';

/** A hero as the succession crowns him: his id and his realm's index plain numbers (the brands are the saved state's)
 *  and his aptitudes filled by any skill's name. The roll of heroes is written through a view of it: its schema is
 *  unchanged. */
type AnHeirAsTheSuccessionCrownsHim = Omit<Character, 'id' | 'player' | 'aptitude'> & {
  id: number;
  player: number | null;
  aptitude: Partial<Record<string, number>>;
};
/** A company as the new turn releases it or clears its battle's marks: summoned for the turn (`_temporary`), and the
 *  strength a spell or a battle took from it this turn. The saved state's schema lacks them: each is tested and
 *  deleted, never read for a value. */
type ACompanyAsTheNewTurnClearsIt = Army & {
  _temporary?: unknown;
  _tempStrReduction?: unknown;
  _turnStrReduction?: unknown;
  _archeryRed?: unknown;
  _laNoTerrain?: unknown;
  _flakTargeted?: unknown;
};
/** A hero as the new turn clears the turn's spell marks off him (the saved state's schema lacks them: each is
 *  deleted, never read). */
type AHeroAsTheNewTurnClearsHim = Character & {
  _partSeaThisPhase?: unknown;
  _elementalSummonedThisTurn?: unknown;
  _curses?: unknown;
  _mirrorImages?: unknown;
  _invisible?: unknown;
  _charmedByPlayer?: unknown;
  _charmedForPhase?: unknown;
  _oratoryBoost?: unknown;
  _clairvoyantBy?: unknown;
  _druidNegated?: unknown;
  _tacticalNegated?: unknown;
  _tacticalHalved?: unknown;
  _tacticalMult?: unknown;
  _phantasmalBonus?: unknown;
  _curseHalveStat?: unknown;
  _necroAutoUsed?: unknown;
};
/** A province as the new turn clears the turn's spell marks off it (the saved state's schema lacks them): an enemy's
 *  entry into its Illusory Terrain, and the marks tested and deleted; Part Sea's and a Flood's give back the terrain
 *  they hold. */
type AProvinceAsTheNewTurnClearsIt = Province & {
  _illusoryTerrain?: { _enteredByEnemy?: unknown } | undefined;
  _blessBonus?: unknown;
  _phantomArmies?: unknown;
  _featuresHidden?: unknown;
  _earthquakeSpeed?: unknown;
  _flooded?: unknown;
  _partSea?: { readonly orig: string } | undefined;
  _flood?: { readonly orig: string } | undefined;
  _holyBonus?: unknown;
  _oratoryBonus?: unknown;
  _tempStrReduction?: unknown;
  _turnStrReduction?: unknown;
};
/** A skeleton's rise the Iron Throne queued this turn (blood-harvest-and-iron-throne.ts): the winner's id and the
 *  company that rises. */
interface ARiseTheIronThroneQueued {
  charId: number;
  unit: { type: string; quality: string; race: string; _isSkeletal: boolean; unitName: string };
}
/** A value with every field the Iron Throne writes in a rise, each of its kind. */
function isARiseTheIronThroneQueued(v: unknown): v is ARiseTheIronThroneQueued {
  if (typeof v !== 'object' || v === null || !('charId' in v) || typeof v.charId !== 'number' || !('unit' in v))
    return false;
  const u = v.unit;
  return (
    typeof u === 'object' &&
    u !== null &&
    'type' in u &&
    typeof u.type === 'string' &&
    'quality' in u &&
    typeof u.quality === 'string' &&
    'race' in u &&
    typeof u.race === 'string' &&
    '_isSkeletal' in u &&
    typeof u._isSkeletal === 'boolean' &&
    'unitName' in u &&
    typeof u.unitName === 'string'
  );
}
/** One rise of the turn's queue, as the Grand Design reads it: the Iron Throne queues only rises (and the save holds
 *  the queue empty), so it throws for any other value, which nothing queues. */
function theRiseQueuedThere(queued: unknown): ARiseTheIronThroneQueued {
  if (isARiseTheIronThroneQueued(queued)) return queued;
  throw new TypeError('the Iron Throne queues only the rises it writes');
}

// ── THE NEW TURN, FIRST PART (plan P1-08k5a: one stage taken out of resolveTurn's own body) ─────────────────────────
// Once the turn's diplomacy and victory are settled (diplomacy-resolution-and-victory-….js), the turn counter moves on
// and the new turn begins, in this order:
//   1. the turn counter advances (G.turn);
//   2. a Divine king awaiting his return loses it if his realm holds no consecrated ground;
//   3. a realm whose king has fallen crowns an heir in its wealthiest province (his skills to allocate), or, with no
//      province left, its dynasty ends; a Divine king still awaiting his return is not replaced;
//   4. what was summoned for the turn leaves: temporary companies (on heroes, in garrisons, among the mercenaries) and
//      Wild Hunt bindings past their last turn; a hero hired this turn acts from every phase; the one-turn spell marks on
//      heroes, companies and provinces end (Illusory Terrain and hidden lairs may fade; Part Sea and Flood give the
//      land back);
//   5. the Grand Designs: the Iron Throne's skeleton rises join their winners, and the Grand Library gives each Neutral
//      realm that has it one Sage discovery.
// It takes the turn's context (src/engine/turn/context.ts) and nothing else: it reads no value of the phase loop's. The
// body keeps resolveTurn's indent (plan P1-08's Decisions). Each line it writes is a fact (since P1-12d15: the-facts-the-
// new-turns-lines-record.ts), its words written in the views.

export function newTurnCounterKingSuccessionSummonsAndSpellsEndAndTheGrandDesigns(turnContext: TurnContext): void {
  const { G } = turnContext;
  // 7. Advance turn counter
  G.turn = (G.turn || 1) + 1;

  // 7a-bis. A Divine king awaiting return whose realm no longer holds ANY consecrated ground cannot
  // come back (only a king can consecrate, so none can be made while he lies dead): the grace is
  // lost now and 7b crowns an heir in this same pass.
  (asItsGuardReadsIt(G.players) ?? []).forEach((p: Realm | null | undefined, pi) => {
    if (theReturnARealmsAlignmentGivesItsFallen(p?.alignment) === null) return; // Divine grace (its row)
    G.characters
      .filter((c) => c.isKing && c.player === pi && !c.alive && c._divineReturn)
      .forEach((k) => {
        if (ownedConsecratedProvs(G, pi).length > 0) return;
        delete k._divineReturn;
        emit(turnContext, {
          type: 'system',
          fact: { kind: 'a Divine king cannot return with no consecrated ground left', kingName: k.name },
          audience: { actor: pi, realms: [pi] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        });
      });
  });

  // 7b. King succession — crown an heir for any player whose king has died.
  G.players.forEach((p, pi) => {
    const aliveKing = G.characters.find((c) => c.isKing && c.player === pi && c.alive);
    if (aliveKing) {
      p.heirPending = false;
      return;
    } // reigning king is fine
    //a Divine king awaiting divine return is NOT replaced by an heir (while the realm holds land).
    if (
      theReturnARealmsAlignmentGivesItsFallen(p.alignment) !== null && // Divine grace (its row)
      (asItsGuardReadsIt(p.provinces) ?? []).length > 0 &&
      G.characters.some(
        (c) =>
          c.isKing &&
          c.player === pi &&
          !c.alive &&
          c._divineReturn &&
          (asItsGuardReadsIt(G.heroGraveyard) ?? []).some((g) => g.id === c.id),
      )
    ) {
      p.heirPending = false;
      return;
    }
    // No living king. If we haven't already crowned an heir, do so now so the player has a new king
    // (with skills to allocate) ready for next turn's orders.
    const wealthiest = (asItsGuardReadsIt(p.provinces) ?? []).reduce<{ id: number; tax: number } | null>(
      (best, pid) => {
        const pv = G.world.provinces[pid];
        return !best || (pv != null && pv.tax > best.tax) ? { id: pid, tax: (pv?.tax ?? 0) || 0 } : best;
      },
      null,
    );
    const heirProv = wealthiest ? G.world.provinces[wealthiest.id] : null;
    if (!heirProv) {
      // No provinces left — the line has ended; the player is effectively eliminated.
      if (!p._eliminated) {
        p._eliminated = true;
        p._eliminatedTurn = G.turn;
        emit(turnContext, {
          type: 'system',
          fact: {
            kind: "a realm's king has fallen with no lands left and the dynasty is extinguished",
            realmName: p.name,
          },
          audience: { actor: pi, realms: [pi] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        });
      }
      return;
    }
    p.heirPending = false;
    const deadKing = G.characters.find((c) => c.isKing && c.player === pi && !c.alive);
    if (deadKing) deadKing.isKing = false; // demote the fallen king so the realm has exactly one monarch
    const heirSkills: SkillLevels = { melee: 2, archery: 1, sage: 1 };
    // his alignment's skill a level more, as the king's (its row: P1-19ay1)
    const heirsSkill = theSkillAKingOfTheAlignmentStartsWith(p.alignment);
    if (heirsSkill) heirSkills[heirsSkill.theSkill] = (heirSkills[heirsSkill.theSkill] ?? 0) + heirsSkill.theLevelsMore;
    // (a test stands in an engine with no name-giver: tests/unit/new-turn-succession-and-summons-called-directly.test.ts)
    const heirName =
      typeof asItsGuardReadsIt(nextHeroName) === 'function'
        ? nextHeroName(p.alignment || 'Neutral')
        : deadKing
          ? 'Heir of ' + deadKing.name
          : 'The New Monarch';
    const heir: AnHeirAsTheSuccessionCrownsHim = {
      id: G.characters.length,
      name: heirName,
      isKing: true,
      player: pi,
      race: p.race || 'Human',
      alignment: p.alignment || 'Neutral',
      temper: theOneThePickFell(TEMPERS_P[Math.floor(kcRng() * TEMPERS_P.length)]), // provisional — the player may rename and re-temper their heir
      hp: 15,
      maxHp: 15,
      skills: heirSkills,
      aptitude: {}, // a new king rises at full royal vigour — 15 HP, same as a founding king
      armies: [],
      items: [],
      location: heirProv.id,
      alive: true,
      merits: 0,
      taxBonus: 0,
      pay: 0,
      spellsUsedThisTurn: [],
      locationName: heirProv.name,
      _isHeir: true,
      _crownedTurn: G.turn || 0,
      _pendingSkillAllocation: 4, // player allocates 4 more skills, and may set name + temper, before ordering
    };
    const ABILITIES_P2 = KC_SKILLS.slice();
    ABILITIES_P2.forEach((ab) => {
      heir.aptitude[ab] = Math.ceil(kcRng() * 4);
    });
    const theRollAsTheSuccessionWritesIt: AnHeirAsTheSuccessionCrownsHim[] = G.characters;
    theRollAsTheSuccessionWritesIt.push(heir);
    heirProv.characters = asItsGuardReadsIt(heirProv.characters) ?? [];
    if (!heirProv.characters.includes(heir.id)) heirProv.characters.push(heir.id);
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'an heir is crowned', heirName: heir.name, provinceName: heirProv.name },
      audience: { actor: pi, realms: [pi] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      province: heirProv.id,
    });
    // NOT public. This line is an instruction to one player — name your heir, set their temper,
    // spend their points — and it carried `public:true`, which for an entry with a provinceId means
    // "anyone who can see that province sees it". The coronation happens in the realm's wealthiest
    // province, which neighbours routinely see, so every realm was being told to go and name
    // somebody else's heir. Private to the bereaved realm; the world still learns the king fell
    // through the death announcement, which is a separate (and genuinely public) line.
  });

  // 7c. Expire temporary summons and reset hire phase flags first, a catch-all for any _temporary
  // summon that got ORPHANED off a character — e.g. a summoner who died mid-battle whose leaderless
  // host (elemental included) was later folded into a province garrison, or a temp unit that
  // somehow reached the mercenary pool. The per-character sweep below only sees living characters'
  // armies, so these would linger forever.
  (asItsGuardReadsIt(G.world.provinces) ?? []).forEach((p: Province | null | undefined) => {
    if (
      p &&
      (asItsGuardReadsIt(p.garrisonArmies) ?? []).some(
        (a: ACompanyAsTheNewTurnClearsIt | null | undefined) => a?._temporary,
      )
    )
      p.garrisonArmies = p.garrisonArmies.filter(
        (a: ACompanyAsTheNewTurnClearsIt | null | undefined) => !a?._temporary,
      );
  });
  if (
    (asItsGuardReadsIt(G.mercenaries) ?? []).some(
      (m: (Mercenary & { _temporary?: unknown }) | null | undefined) => m?._temporary,
    )
  )
    G.mercenaries = G.mercenaries.filter(
      (m: (Mercenary & { _temporary?: unknown }) | null | undefined) => !m?._temporary,
    );
  G.characters.forEach((c: AHeroAsTheNewTurnClearsHim) => {
    // Reset hiredInPhase so they act from all phases next turn
    if (c.hiredInPhase != null && c.hiredInPhase >= 0) {
      c.hiredInPhase = -1; // -1 = hired before this turn, fully active
    }
    if ((asItsGuardReadsIt(c.armies) ?? []).some((a: ACompanyAsTheNewTurnClearsIt) => a._temporary)) {
      // Summoned elementals hold together only for the turn that called them. Previously they were
      // filtered out silently and the player simply found them missing next turn.
      const _gone = c.armies.filter((a: ACompanyAsTheNewTurnClearsIt) => a._temporary);
      c.armies = c.armies.filter((a: ACompanyAsTheNewTurnClearsIt) => !a._temporary);
      emit(turnContext, {
        type: 'explore',
        fact: {
          kind: 'summoned elementals are released as the season turns',
          elementals: _gone.map((a) => ({ unitName: a.unitName || null, unitType: a.type })),
          heroName: c.name,
        },
        audience: { actor: c.player, realms: [c.player].filter((x) => x !== null) },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        province: c.location,
      });
    }
    // PAGAN: Wild Hunt bindings outlast elementals by WILD_HUNT_TURNS full turns, then break.
    // G.turn has ALREADY been advanced (step 7 above) by the time this sweep runs, so the old `>=`
    // released the beasts at the end of the very turn they were bound. `>` = they serve through the
    // whole of turn _wildHuntUntilTurn and are released only when that turn ends.
    if (
      (asItsGuardReadsIt(c.armies) ?? []).some((a) => a._wildHuntUntilTurn != null && G.turn > a._wildHuntUntilTurn)
    ) {
      const _wild = c.armies.filter((a) => a._wildHuntUntilTurn != null && G.turn > a._wildHuntUntilTurn);
      c.armies = c.armies.filter((a) => !(a._wildHuntUntilTurn != null && G.turn > a._wildHuntUntilTurn));
      emit(turnContext, {
        type: 'explore',
        fact: {
          kind: "the Wild Hunt's beasts slip the binding",
          beasts: _wild.map((a) => ({ unitName: a.unitName || null, unitType: a.type })),
          heroName: c.name,
        },
        audience: { actor: c.player, realms: [c.player].filter((x) => x !== null) },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        province: c.location,
      });
    }
    // Clear one-turn spell flags
    delete c._partSeaThisPhase;
    delete c._elementalSummonedThisTurn;
    delete c._curses;
    delete c._mirrorImages;
    delete c._invisible;
    // (_charmImmuneTurn is deliberately NOT cleared here — it names NEXT turn, and is dropped lazily
    // by the Charm cast itself once the season it guards has passed.)
    delete c._charmedByPlayer;
    delete c._charmedForPhase;
    delete c._charmOriginalPlayer;
    delete c._oratoryBoost;
    delete c._clairvoyantBy;
    delete c._druidNegated;
    delete c._tacticalNegated;
    delete c._tacticalHalved;
    delete c._tacticalMult;
    delete c._phantasmalBonus;
    if (c._phantoms?.length) c._phantoms = []; // phantasmal armies fade as the turn ends
    delete c._curseHalveStat;
    delete c._necroAutoUsed;
    // Units fully recover between turns — clear any lingering battle-scoped strength loss
    // (e.g. a Telekinetic Storm cast in an action phase that saw no ensuing battle).
    (asItsGuardReadsIt(c.armies) ?? []).forEach((a: ACompanyAsTheNewTurnClearsIt) => {
      if (a._tempStrReduction) delete a._tempStrReduction;
      if (a._terrorMult != null) delete a._terrorMult;
      if (a._turnStrReduction) delete a._turnStrReduction;
      if (a._archeryRed) delete a._archeryRed;
      if (a._tacUp) delete a._tacUp;
      if (a._drumUp) delete a._drumUp;
      if (a._laNoTerrain) delete a._laNoTerrain;
      if (a._flakTargeted) delete a._flakTargeted;
    });
  });
  G.world.provinces.forEach((p: AProvinceAsTheNewTurnClearsIt) => {
    if (p._blessBonus) {
      delete p._blessBonus;
    }
    // Illusory Terrain: an enemy hero who entered this turn dispels it at TURN'S END (not the
    // instant they arrive); otherwise it persists until it fades naturally (20%/turn).
    if (p._illusoryTerrain) {
      if (p._illusoryTerrain._enteredByEnemy || kcRng() < 0.2) {
        delete p._illusoryTerrain;
      }
    }
    // Clear any battle-scoped strength reductions still sitting on this province's neutral
    // defenders
    // (e.g. a Telekinetic Storm cast with no ensuing battle) so units fully recover between turns.
    (asItsGuardReadsIt(p.neutralDefenders) ?? []).forEach((a: ACompanyAsTheNewTurnClearsIt) => {
      if (a._tempStrReduction) delete a._tempStrReduction;
      if (a._terrorMult != null) delete a._terrorMult;
      if (a._turnStrReduction) delete a._turnStrReduction;
      if (a._archeryRed) delete a._archeryRed;
      if (a._tacUp) delete a._tacUp;
      if (a._drumUp) delete a._drumUp;
      if (a._laNoTerrain) delete a._laNoTerrain;
      if (a._flakTargeted) delete a._flakTargeted;
    });
    // Hidden features persist until they fade (10%/turn).
    (asItsGuardReadsIt(p.features) ?? []).forEach((f) => {
      if (f._hidden && kcRng() < 0.2) {
        delete f._hidden;
        delete f._hiddenBy;
      }
    });
    if (p._phantomArmies) delete p._phantomArmies;
    if (p._featuresHidden) delete p._featuresHidden;
    if (p._earthquakeTax) {
      delete p._earthquakeTax;
    }
    if (p._earthquakeSpeed) delete p._earthquakeSpeed;
    if (p._flooded) delete p._flooded;
    if (p._partSea) {
      p.terrain = p._partSea.orig;
      delete p._partSea;
    } // Part Sea: restore the sea
    if (p._flood) {
      p.terrain = p._flood.orig;
      delete p._flood;
    } // Flood: recedes at turn's end
    if (p._holyBonus) delete p._holyBonus;
    if (p._oratoryBonus) delete p._oratoryBonus;
    if (p._tempStrReduction) delete p._tempStrReduction;
    if (p._turnStrReduction) delete p._turnStrReduction;
    (asItsGuardReadsIt(p.garrisonArmies) ?? []).forEach((a: Army | null | undefined) => {
      if (a?._terrorMult != null) delete a._terrorMult;
    }); // 2026-09-24: Terror is a battle-scoped modifier
  });

  // 7c2. sd35 Order of the Golden Shield: the king's earned-HP gain from a win is doubled, nothing
  // per-turn.

  // GRAND DESIGN — Evil (Iron Throne of Skulls): apply this turn's queued skeleton-rises to the
  // real winners.
  (G._pendingRises ?? []).forEach((queued) => {
    const r = theRiseQueuedThere(queued);
    const _ch = (asItsGuardReadsIt(G.characters) ?? []).find((c: Character | null | undefined) => c?.id === r.charId);
    if (_ch?.alive) {
      _ch.armies = asItsGuardReadsIt(_ch.armies) ?? [];
      _ch.armies.push(r.unit);
    }
  });
  G._pendingRises = [];

  // GRAND DESIGN — Neutral (Grand Library): one guaranteed Sage discovery each turn, reported.
  (asItsGuardReadsIt(G.players) ?? []).forEach((pl, pi) => {
    if (!gdActive(turnContext, pi, 'Neutral')) return;
    pl.discoveries = asItsGuardReadsIt(pl.discoveries) ?? [];
    const _known = new Set(pl.discoveries.map((d) => d.id));
    const _blkGL = discBlockedIds(pl);
    const _avail = SAGE_DISCOVERIES_P.filter((d) => !_known.has(d.id) && !_blkGL.has(d.id) && discEligible(d, pl)); // race/alignment eligibility; never a forgotten or awaiting-choice discovery
    if (_avail.length === 0) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'the Grand Library has no discovery left to unlock' },
        audience: { actor: pi, realms: [pi] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      });
      return;
    }
    const _d = theOneThePickFell(_avail[Math.floor(kcRng() * _avail.length)]);
    pl.discoveries.push({ id: _d.id, name: _d.name, category: _d.category, desc: _d.desc, turnDiscovered: G.turn });
    emit(turnContext, {
      type: 'explore',
      fact: {
        kind: "the Grand Library's scholars uncover a discovery",
        discoveryName: _d.name,
        category: _d.category,
        description: _d.desc,
      },
      audience: { actor: pi, realms: [pi] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
  });
}
