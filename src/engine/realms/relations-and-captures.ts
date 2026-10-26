// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import {
  alignProto,
  isCreatureProvince,
  isMonsterProvince,
  protoAlignOf,
  protoBeastRoomExtra,
} from '../alignment-prototypes.ts';
import { KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import { beastCommandRoom } from '../world/tables.ts';
import { kcRng } from '../rng.ts';
import { QUALITY_TIERS } from '../army-tables.ts';
import { consecCaptureXpPct, consecratedIds } from '../heroes/fame-and-consecration.ts';
import { armyUnitName } from '../dice-and-army-names.ts';
import { discSum } from '../discoveries.ts';
import { emit, THE_HERO_WHOSE_ORDER_IS_RESOLVING } from '../turn/events-and-their-audiences.ts';

// ── RELATIONS AND CAPTURES (plan P1-08a: lifted out of resolveTurn) ────
// Who is at war or allied with whom (G.relations, keyed "minIdx-maxIdx": see "DIPLOMACY" in resolveTurn), and what
// happens when a province changes hands: its consecration breaks, its old owner is told, and an Evil conqueror loots
// or enslaves. Each takes the turn's context first (src/engine/turn/context.ts), but relKeyOf, which reads none.
// ── PROVINCE CAPTURE ────
// Every path that hands a province to a new realm goes through here. When the ground was another
// player's, that player gets a line in their REALM EVENTS for the phase — who took it (hero and
// realm) and how many units the conqueror was leading. A capture from neutral/unowned ground
// notifies nobody. Filed with no hero (hero: null, as notifyProvinceOwner does) so the line is never the
// conqueror's and never lands in a character section.
export function breakConsecrationOnCapture(turnContext, prov, prev, newOwner, byChar, _ph) {
  const { G } = turnContext;
  const pl = G.players[prev];
  if (!pl) return;
  const list = consecratedIds(pl);
  const at = list.indexOf(prov.id);
  if (at < 0) return;
  list.splice(at, 1);
  // PROTOTYPE Undead (round 2): Desecrate — holy ground an Undead kit realm takes is despoiled at once
  if (newOwner != null && protoAlignOf(G, newOwner) === 'Undead' && prov._despoiled == null && prov.terrain !== 'sea') {
    prov._despoiled = G.turn;
    prov.tax = 1;
    prov.armyTypes = [];
    emit(turnContext, {
      type: 'combat',
      text: `☠ Desecrate: the altars of ${prov.name} are thrown down and its fields salted with grave-dust — the land is dead, and pays 1 tax for ever.`,
      audience: { actor: newOwner, realms: [newOwner, prev] },
      province: prov.id,
      hero: byChar ? byChar.id : null,
      phase: _ph,
    });
  }
  emit(turnContext, {
    type: 'system',
    text: `✨ The consecration of ${prov.name} is broken — it has passed from ${pl.name}'s hands, and the hallowed light departs. The crown may sanctify new ground in its place.`,
    audience: { actor: null, realms: [prev] },
    province: prov.id,
    hero: null,
    phase: _ph ?? 'none',
    form: 'bare',
  });
  if (!byChar || newOwner == null) return;
  const units = (byChar.armies || []).filter((a) => a && !a._died && !a._disbanded && !a._phantom);
  if (!units.length) return;
  const _pct = consecCaptureXpPct(G.players[newOwner]); // Undead 100 · Evil 50 · others 0
  const rose = [];
  units.forEach((a) => {
    const qi = QUALITY_TIERS.indexOf(a.quality);
    if (a._isSkeletal) return; // skeletons never change quality by any means
    if (qi < 0 || qi >= QUALITY_TIERS.length - 1) return; // Elite (or unknown) cannot rise
    if (_pct > 0 && kcRng() * 100 < _pct) {
      a.quality = QUALITY_TIERS[qi + 1];
      rose.push(`${a.unitName || armyUnitName(a.type)} (now ${a.quality})`);
    }
  });
  emit(turnContext, {
    type: 'combat',
    text: `✨ ${byChar.name}'s column casts down the altars of ${prov.name} — the ground is holy no longer. ${rose.length ? `Flushed with the deed, ${rose.join(', ')} gain${rose.length === 1 ? 's' : ''} an experience level.` : _pct > 0 ? 'None of the troops is the better for it.' : 'The troops take no pride in the sacrilege.'}`,
    audience: { actor: newOwner, realms: [newOwner] },
    province: prov.id,
    hero: byChar.id,
    phase: _ph,
  });
}
export function setProvinceOwner(turnContext, prov, newOwner, byChar, ph) {
  const { _tel, G } = turnContext;
  if (!prov) return;
  const prev = prov.owner;
  prov.owner = newOwner;
  if (prev != null && prev !== newOwner && alignProto(G, 'Good')) {
    // PROTOTYPE Good (round 2): Reclaim remembers who lost the province and when (only while the kit is on, so a game
    // without it keeps today's saved state to the byte)
    prov._lostFrom = prev;
    prov._lostTurn = G.turn;
  }
  if (prev !== newOwner) {
    try {
      _tel.captures.push({
        ph: ph != null ? ph : (turnContext._logCtx.phase ?? turnContext._currentPhase),
        prov: prov.id,
        terrain: prov.terrain,
        tax: prov.tax || 0,
        from: prev,
        to: newOwner,
        charId: byChar ? byChar.id : null,
      });
    } catch (_te) {}
  }
  // HOLY GROUND FALLS. A consecrated province that changes hands loses its consecration at once
  // (not at the end-of-turn sweep, which remains as the safety net), and every real unit of the
  // conquering column has a consecCaptureXpPct() chance (Undead 100 · Evil 50 · else 0) to gain an experience level.
  if (prev != null && prev !== newOwner)
    breakConsecrationOnCapture(
      turnContext,
      prov,
      prev,
      newOwner,
      byChar,
      ph != null ? ph : turnContext._logCtx.phase != null ? turnContext._logCtx.phase : turnContext._currentPhase,
    );
  // PROTOTYPE round 5: a Druidic kit realm taking an unclaimed creature province, or an Evil one an unclaimed monster
  // province, is joined by a company of its beasts (into the captor's host if he has room to lead it, else the garrison)
  if (prev == null && newOwner != null && byChar && byChar.alive) {
    // (a dead captor leads nothing and acts no more this turn)
    const _k = protoAlignOf(G, newOwner);
    const _cls =
      _k === 'Druidic' && isCreatureProvince(prov)
        ? 'creature'
        : _k === 'Evil' && isMonsterProvince(prov)
          ? 'monster'
          : null;
    if (_cls) {
      const _set = new Set(KC_UNIT_CLASS[_cls]);
      const _kind = (prov.armyTypes || []).find((t) => _set.has(t));
      if (_kind) {
        // round 11: a pack that submits is Green; round 12: so is what the pits yield
        const _u = {
          type: _kind,
          quality: 'Green',
          race: prov.race || 'Primal',
          unitName: armyUnitName(_kind),
        };
        // round 8: only a captor with room to lead the beasts gains them (round 5-7: else into the garrison)
        const _room = beastCommandRoom(byChar, G.characters || [], protoBeastRoomExtra(G, byChar)) > 0;
        if (!_room) return;
        (byChar.armies = byChar.armies || []).push(_u);
        emit(turnContext, {
          type: 'hire',
          text:
            _cls === 'creature'
              ? `🐾 The pack submits: ${_u.unitName} (${_kind}) of ${prov.name} come to ${byChar.name}${_room ? "'s side" : "'s garrison"}.`
              : `🩸 The pits yield: ${_u.unitName} (${_kind}) of ${prov.name} are chained to ${byChar.name}${_room ? "'s host" : "'s garrison"}.`,
          audience: { actor: newOwner, realms: [newOwner] },
          province: prov.id,
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          phase: ph != null ? ph : turnContext._currentPhase,
        });
      }
    }
  }
  if (prev == null || prev === newOwner || newOwner == null) return;
  const _ph =
    ph != null ? ph : turnContext._logCtx.phase != null ? turnContext._logCtx.phase : turnContext._currentPhase;
  const who = byChar ? byChar.name : 'an unknown commander';
  const realm = newOwner != null && G.players[newOwner] ? G.players[newOwner].name : 'an enemy realm';
  const n = byChar ? (byChar.armies || []).filter((a) => a && !a._died && !a._disbanded && !a._phantom).length : 0;
  const led = byChar ? (n > 0 ? `, leading ${n} unit${n !== 1 ? 's' : ''}` : ', leading no units') : '';
  const text = `🏴 ${prov.name} has been captured from you by ${who} (${realm})${led}.`;
  // type 'system', NOT 'combat': the report re-files combat lines under the viewer's commander
  // who fought in that province that phase (battleCommanders), which would pull this out of Realm
  // Events.
  emit(turnContext, {
    type: 'system',
    text,
    audience: { actor: null, realms: [prev] },
    province: prov.id,
    hero: null,
    phase: _ph ?? 'none',
    form: 'bare',
  });
}

export function relKeyOf(a, b) {
  return a < b ? a + '-' + b : b + '-' + a;
}
export function relationBetween(turnContext, a, b) {
  const { G } = turnContext;
  if (a == null || b == null) return 'neutral';
  if (a === b) return 'self';
  return G.relations[relKeyOf(a, b)] || 'neutral';
}
export function areEnemies(turnContext, a, b) {
  return relationBetween(turnContext, a, b) === 'enemy';
}
export function areAllied(turnContext, a, b) {
  return relationBetween(turnContext, a, b) === 'allied';
}
// A realm may declare a Treat or war only on a realm it has met (its record of meetings): diplomacy's resolution reads
// no other declaration, and the bots' grudge is recorded only from a war it would read.
export function realmHasMet(turnContext, from, to) {
  return (((turnContext.G.players || [])[from] || {})._encountered || []).includes(to);
}
// a valid RETREAT destination is a FRIENDLY province — one the player owns, or one held by an
// ally. Never a neutral or enemy province (a beaten force cannot fall back onto ground it does
// not hold).
export function isFriendlyProvFor(turnContext, prov, pi) {
  return !!prov && pi != null && (prov.owner === pi || (prov.owner != null && areAllied(turnContext, pi, prov.owner)));
}

// ── EVIL conquest doctrine (loot OR enslave) ── applied whenever an Evil character CONQUERS a
// province by force. Now every conquest site calls this. Runs once per province per turn.
export function applyEvilConquest(turnContext, cc, prov, pl) {
  const { G } = turnContext;
  if (!cc || !prov || !pl) return;
  if (G.players[cc.player]?.alignment !== 'Evil') return;
  if (prov._evilConqTurn === G.turn) return;
  prov._evilConqTurn = G.turn;
  const mode = cc.encounterPlan?.evilMode || 'terror';
  const humanoid = prov.terrain !== 'sea' && !String(prov.race || '').startsWith('Primal');
  if (mode === 'enslave' && humanoid && alignProto(G, 'Evil')) {
    // PROTOTYPE Evil: the beaten folk are pressed into the conqueror's own column as a wage-free Green company
    const enType = (prov.armyTypes && prov.armyTypes[0]) || 'Shieldwall Levies';
    cc.armies = cc.armies || [];
    cc.armies.push({
      type: enType,
      quality: 'Green',
      race: prov.race || 'Human',
      unitName: `${armyUnitName(enType)} (Slaves)`,
      _slave: true,
    });
    prov._enslavedUntil = G.turn + 3;
    emit(turnContext, {
      type: 'combat',
      text: `⛓ Enslavement: ${cc.name} marches the beaten folk of ${prov.name} off in chains — a Green ${enType} joins the column, paid nothing, and the province seethes (−1 tax for 3 turns).`,
      audience: { actor: cc.player, realms: [cc.player], seen: 'battle' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
  } else if (mode === 'enslave' && humanoid) {
    const enType = (prov.armyTypes && prov.armyTypes[0]) || 'Shieldwall Levies';
    prov.garrisonArmies = prov.garrisonArmies || [];
    prov.garrisonArmies.push({
      type: enType,
      quality: 'Green',
      race: prov.race || 'Human',
      unitName: armyUnitName(enType),
    });
    prov._enslavedUntil = G.turn + 3;
    emit(turnContext, {
      type: 'combat',
      text: `⛓ Enslavement: ${cc.name} presses the beaten folk of ${prov.name} into service — a Green ${enType} joins the garrison in chains, but the province seethes (−1 tax for 3 turns).`,
      audience: { actor: cc.player, realms: [cc.player], seen: 'battle' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
  } else {
    if (mode === 'enslave' && !humanoid)
      emit(turnContext, {
        type: 'combat',
        text: `⛓ ${cc.name} would enslave ${prov.name}, but there are no humanoid folk here to press — the forces plunder instead.`,
        audience: { actor: cc.player, realms: [cc.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    const loot = Math.floor(
      (prov.tax || 0) *
        (0.5 +
          discSum(turnContext, cc.player, 'plunder', 'pct', (e) => !e.terrains || e.terrains.includes(prov.terrain))),
    ); // + plunder discoveries
    if (loot > 0) {
      pl.gold = (pl.gold || 0) + loot;
      emit(turnContext, {
        type: 'combat',
        text: `⚔ Evil looting: ${cc.name}'s forces plunder ${prov.name} — ${loot}g seized immediately!`,
        audience: { actor: cc.player, realms: [cc.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    }
  }
}
