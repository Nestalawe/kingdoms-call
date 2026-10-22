// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { KC_SKILLS, SAGE_DISCOVERIES_P } from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';
import { TEMPERS_P } from '../world/tables.ts';
import { nextHeroName } from '../names.ts';
import { ownedConsecratedProvs } from '../heroes/fame-and-consecration.ts';
import { discBlockedIds, discEligible, gdActive } from '../discoveries.ts';
import { emit } from './events-and-their-audiences.ts';

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
// body keeps resolveTurn's indent (plan P1-08's Decisions).

export function newTurnCounterKingSuccessionSummonsAndSpellsEndAndTheGrandDesigns(turnContext) {
  const { G } = turnContext;
  // 7. Advance turn counter
  G.turn = (G.turn || 1) + 1;

  // 7a-bis. A Divine king awaiting return whose realm no longer holds ANY consecrated ground cannot
  // come back (only a king can consecrate, so none can be made while he lies dead): the grace is
  // lost now and 7b crowns an heir in this same pass.
  (G.players || []).forEach((p, pi) => {
    if (!p || p.alignment !== 'Divine') return;
    G.characters
      .filter((c) => c.isKing && c.player === pi && !c.alive && c._divineReturn)
      .forEach((k) => {
        if (ownedConsecratedProvs(G, pi).length > 0) return;
        delete k._divineReturn;
        emit(turnContext, {
          type: 'system',
          text: `✨ The realm's last consecrated ground is gone, and with it the way back for ${k.name}: the divine cannot restore a monarch where no holy ground remains. An heir takes the crown.`,
          audience: { actor: pi, realms: [pi] },
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
      p.alignment === 'Divine' &&
      (p.provinces || []).length > 0 &&
      G.characters.some(
        (c) =>
          c.isKing &&
          c.player === pi &&
          !c.alive &&
          c._divineReturn &&
          (G.heroGraveyard || []).some((g) => g.id === c.id),
      )
    ) {
      p.heirPending = false;
      return;
    }
    // No living king. If we haven't already crowned an heir, do so now so the player has a new king
    // (with skills to allocate) ready for next turn's orders.
    const wealthiest = (p.provinces || []).reduce((best, pid) => {
      const pv = G.world.provinces[pid];
      return !best || (pv && pv.tax > best.tax) ? { id: pid, tax: pv?.tax || 0 } : best;
    }, null);
    const heirProv = wealthiest ? G.world.provinces[wealthiest.id] : null;
    if (!heirProv) {
      // No provinces left — the line has ended; the player is effectively eliminated.
      if (!p._eliminated) {
        p._eliminated = true;
        p._eliminatedTurn = G.turn;
        emit(turnContext, {
          type: 'system',
          text: `⚠ ${p.name}'s king has fallen and no lands remain — their dynasty is extinguished.`,
          audience: { actor: pi, realms: [pi] },
        });
      }
      return;
    }
    p.heirPending = false;
    const deadKing = G.characters.find((c) => c.isKing && c.player === pi && !c.alive);
    if (deadKing) deadKing.isKing = false; // demote the fallen king so the realm has exactly one monarch
    const heirSkills = { melee: 2, archery: 1, sage: 1 };
    if (p.alignment === 'Divine') heirSkills.white = (heirSkills.white || 0) + 1;
    if (p.alignment === 'Druidic') heirSkills.druid = (heirSkills.druid || 0) + 1;
    if (p.alignment === 'Evil') heirSkills.druid = (heirSkills.druid || 0) + 1; // 2026-10-13: as the king
    if (p.alignment === 'Pagan') heirSkills.explorer = (heirSkills.explorer || 0) + 1;
    if (p.alignment === 'Undead') heirSkills.necromancy = (heirSkills.necromancy || 0) + 1;
    const heirName =
      typeof nextHeroName === 'function'
        ? nextHeroName(p.alignment || 'Neutral')
        : deadKing
          ? 'Heir of ' + deadKing.name
          : 'The New Monarch';
    const heir = {
      id: G.characters.length,
      name: heirName,
      isKing: true,
      player: pi,
      race: p.race || 'Human',
      alignment: p.alignment || 'Neutral',
      temper: TEMPERS_P[Math.floor(kcRng() * TEMPERS_P.length)], // provisional — the player may rename and re-temper their heir
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
    G.characters.push(heir);
    heirProv.characters = heirProv.characters || [];
    if (!heirProv.characters.includes(heir.id)) heirProv.characters.push(heir.id);
    emit(turnContext, {
      type: 'system',
      text: `👑 With the old king fallen, ${heir.name} is crowned in ${heirProv.name}. Name them, choose their Temper and allocate their 4 remaining skill points before submitting orders.`,
      audience: { actor: pi, realms: [pi] },
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
  (G.world.provinces || []).forEach((p) => {
    if (p && (p.garrisonArmies || []).some((a) => a && a._temporary))
      p.garrisonArmies = p.garrisonArmies.filter((a) => !(a && a._temporary));
  });
  if ((G.mercenaries || []).some((m) => m && m._temporary))
    G.mercenaries = G.mercenaries.filter((m) => !(m && m._temporary));
  G.characters.forEach((c) => {
    // Reset hiredInPhase so they act from all phases next turn
    if (c.hiredInPhase != null && c.hiredInPhase >= 0) {
      c.hiredInPhase = -1; // -1 = hired before this turn, fully active
    }
    if ((c.armies || []).some((a) => a._temporary)) {
      // Summoned elementals hold together only for the turn that called them. Previously they were
      // filtered out silently and the player simply found them missing next turn.
      const _gone = c.armies.filter((a) => a._temporary);
      c.armies = c.armies.filter((a) => !a._temporary);
      const _names = _gone.map((a) => `${a.unitName || a.type}${a.unitName ? ` (${a.type})` : ''}`).join(', ');
      emit(turnContext, {
        type: 'explore',
        text: `\u2728 As the season turns, ${_names} ${_gone.length === 1 ? 'is' : 'are'} released from ${_gone.length === 1 ? 'its' : 'their'} bonds and ${_gone.length === 1 ? 'returns' : 'return'} to the Elemental Realm, leaving ${c.name}'s host.`,
        audience: { actor: c.player, realms: [c.player].filter((x) => x !== null) },
        province: c.location,
      });
    }
    // PAGAN: Wild Hunt bindings outlast elementals by WILD_HUNT_TURNS full turns, then break.
    // G.turn has ALREADY been advanced (step 7 above) by the time this sweep runs, so the old `>=`
    // released the beasts at the end of the very turn they were bound. `>` = they serve through the
    // whole of turn _wildHuntUntilTurn and are released only when that turn ends.
    if ((c.armies || []).some((a) => a._wildHuntUntilTurn != null && G.turn > a._wildHuntUntilTurn)) {
      const _wild = c.armies.filter((a) => a._wildHuntUntilTurn != null && G.turn > a._wildHuntUntilTurn);
      c.armies = c.armies.filter((a) => !(a._wildHuntUntilTurn != null && G.turn > a._wildHuntUntilTurn));
      const _wnames = _wild.map((a) => `${a.unitName || a.type} (${a.type})`).join(', ');
      emit(turnContext, {
        type: 'explore',
        text: `\u{1F43E} The Wild Hunt is done — ${_wnames} slip the binding and melt back into the wilds, leaving ${c.name}'s host.`,
        audience: { actor: c.player, realms: [c.player].filter((x) => x !== null) },
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
    if (c._phantoms && c._phantoms.length) c._phantoms = []; // phantasmal armies fade as the turn ends
    delete c._curseHalveStat;
    delete c._necroAutoUsed;
    // Units fully recover between turns — clear any lingering battle-scoped strength loss
    // (e.g. a Telekinetic Storm cast in an action phase that saw no ensuing battle).
    (c.armies || []).forEach((a) => {
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
  G.world.provinces.forEach((p) => {
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
    (p.neutralDefenders || []).forEach((a) => {
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
    (p.features || []).forEach((f) => {
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
    (p.garrisonArmies || []).forEach((a) => {
      if (a && a._terrorMult != null) delete a._terrorMult;
    }); // 2026-09-24: Terror is a battle-scoped modifier
  });

  // 7c2. sd35 Order of the Golden Shield: the king's earned-HP gain from a win is doubled, nothing
  // per-turn.

  // GRAND DESIGN — Evil (Iron Throne of Skulls): apply this turn's queued skeleton-rises to the
  // real winners.
  (G._pendingRises || []).forEach((r) => {
    const _ch = (G.characters || []).find((c) => c && c.id === r.charId);
    if (_ch && _ch.alive) {
      _ch.armies = _ch.armies || [];
      _ch.armies.push(r.unit);
    }
  });
  G._pendingRises = [];

  // GRAND DESIGN — Neutral (Grand Library): one guaranteed Sage discovery each turn, reported.
  (G.players || []).forEach((pl, pi) => {
    if (!gdActive(turnContext, pi, 'Neutral')) return;
    pl.discoveries = pl.discoveries || [];
    const _known = new Set(pl.discoveries.map((d) => d.id));
    const _blkGL = discBlockedIds(pl);
    const _avail = SAGE_DISCOVERIES_P.filter(
      (d) => !_known.has(d.id) && !_blkGL.has(String(d.id)) && discEligible(d, pl),
    ); // race/alignment eligibility; never a forgotten or awaiting-choice discovery
    if (_avail.length === 0) {
      emit(turnContext, {
        type: 'system',
        text: `\ud83d\udcda Grand Library: your scholars have already unlocked every known discovery.`,
        audience: { actor: pi, realms: [pi] },
      });
      return;
    }
    const _d = _avail[Math.floor(kcRng() * _avail.length)];
    pl.discoveries.push({ id: _d.id, name: _d.name, category: _d.category, desc: _d.desc, turnDiscovered: G.turn });
    emit(turnContext, {
      type: 'explore',
      text: `\ud83d\udcda Grand Library: this turn your scholars uncover \u2014 **${_d.name}** (${_d.category}). ${_d.desc}`,
      audience: { actor: pi, realms: [pi] },
    });
  });
}
