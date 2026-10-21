// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kcRng } from '../rng.ts';
import { QUALITY_TIERS } from '../army-tables.ts';
import { consecCaptureXpPct, consecratedIds } from '../heroes/fame-and-consecration.ts';
import { armyUnitName } from '../dice-and-army-names.ts';
import { discSum } from '../discoveries.ts';

// ── RELATIONS AND CAPTURES (plan P1-08a: lifted out of resolveTurn) ────
// Who is at war or allied with whom (G.relations, keyed "minIdx-maxIdx": see "DIPLOMACY" in resolveTurn), and what
// happens when a province changes hands: its consecration breaks, its old owner is told, and an Evil conqueror loots
// or enslaves. Each takes the turn's context first (src/engine/turn/context.ts), but relKeyOf, which reads none.
// ── PROVINCE CAPTURE ────
// Every path that hands a province to a new realm goes through here. When the ground was another
// player's, that player gets a line in their REALM EVENTS for the phase — who took it (hero and
// realm) and how many units the conqueror was leading. A capture from neutral/unowned ground
// notifies nobody. Written straight to turnLog with charId:null (as notifyProvinceOwner does) so
// the line never inherits the conqueror's log context and never lands in a character section.
export function breakConsecrationOnCapture(turnContext, prov, prev, newOwner, byChar, _ph) {
  const { G, turnLog, log } = turnContext;
  const pl = G.players[prev];
  if (!pl) return;
  const list = consecratedIds(pl);
  const at = list.indexOf(prov.id);
  if (at < 0) return;
  list.splice(at, 1);
  turnLog.push({
    type: 'system',
    text: `✨ The consecration of ${prov.name} is broken — it has passed from ${pl.name}'s hands, and the hallowed light departs. The crown may sanctify new ground in its place.`,
    actor: null,
    targets: [prev],
    provinceId: prov.id,
    public: false,
    spy: false,
    system: false,
    armyEstimate: null,
    charId: null,
    charIds: null,
    phase: _ph,
    pinNotice: false,
    env: false,
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
  log(
    'combat',
    `✨ ${byChar.name}'s column casts down the altars of ${prov.name} — the ground is holy no longer. ${rose.length ? `Flushed with the deed, ${rose.join(', ')} gain${rose.length === 1 ? 's' : ''} an experience level.` : _pct > 0 ? 'None of the troops is the better for it.' : 'The troops take no pride in the sacrilege.'}`,
    { actor: newOwner, targets: [newOwner], provinceId: prov.id, charId: byChar.id, phase: _ph },
  );
}
export function setProvinceOwner(turnContext, prov, newOwner, byChar, ph) {
  const { _tel, G, turnLog } = turnContext;
  if (!prov) return;
  const prev = prov.owner;
  prov.owner = newOwner;
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
  turnLog.push({
    type: 'system',
    text,
    actor: null,
    targets: [prev],
    provinceId: prov.id,
    public: false,
    spy: false,
    system: false,
    armyEstimate: null,
    charId: null,
    charIds: null,
    phase: _ph,
    pinNotice: false,
    env: false,
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
  const { G, log } = turnContext;
  if (!cc || !prov || !pl) return;
  if (G.players[cc.player]?.alignment !== 'Evil') return;
  if (prov._evilConqTurn === G.turn) return;
  prov._evilConqTurn = G.turn;
  const mode = cc.encounterPlan?.evilMode || 'terror';
  const humanoid = prov.terrain !== 'sea' && !String(prov.race || '').startsWith('Primal');
  if (mode === 'enslave' && humanoid) {
    const enType = (prov.armyTypes && prov.armyTypes[0]) || 'Shieldwall Levies';
    prov.garrisonArmies = prov.garrisonArmies || [];
    prov.garrisonArmies.push({
      type: enType,
      quality: 'Green',
      race: prov.race || 'Human',
      unitName: armyUnitName(enType),
    });
    prov._enslavedUntil = G.turn + 3;
    log(
      'combat',
      `⛓ Enslavement: ${cc.name} presses the beaten folk of ${prov.name} into service — a Green ${enType} joins the garrison in chains, but the province seethes (−1 tax for 3 turns).`,
      { actor: cc.player, targets: [cc.player], provinceId: prov.id, public: true },
    );
  } else {
    if (mode === 'enslave' && !humanoid)
      log(
        'combat',
        `⛓ ${cc.name} would enslave ${prov.name}, but there are no humanoid folk here to press — the forces plunder instead.`,
        { actor: cc.player, targets: [cc.player], provinceId: prov.id },
      );
    const loot = Math.floor(
      (prov.tax || 0) *
        (0.5 +
          discSum(turnContext, cc.player, 'plunder', 'pct', (e) => !e.terrains || e.terrains.includes(prov.terrain))),
    ); // + plunder discoveries
    if (loot > 0) {
      pl.gold = (pl.gold || 0) + loot;
      log('combat', `⚔ Evil looting: ${cc.name}'s forces plunder ${prov.name} — ${loot}g seized immediately!`, {
        actor: cc.player,
        targets: [cc.player],
        provinceId: prov.id,
      });
    }
  }
}
