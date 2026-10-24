// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { relOfReport, spotEnemyInOwnedProvince } from '../heroes/fame-and-consecration.ts';
import { armySizeBand } from '../sight/heroes-in-sight-features-discovered-and-army-size-bands.ts';
import { emit, THE_HERO_WHOSE_ORDER_IS_RESOLVING } from './events-and-their-audiences.ts';

// ── INTRUSION WARNINGS (plan P1-08b: lifted out of resolveTurn) ────
// After each phase, the warnings a realm gets of enemy heroes in its land or beside its own heroes. It takes the turn's
// context first (src/engine/turn/context.ts): the state, the seasons' names and the turn's warnings so far
// (_intrusionAcc), which flushIntrusionNotifications (plan P1-08i1, below) writes into the log after the phases.
// ── INTRUSION NOTIFICATIONS ────
// After each phase resolves, scan for situations where players need to be notified about things
// happening in their territory or in provinces where their heroes are present.
export function generateIntrusionNotifications(turnContext, ph) {
  const { SEASONS, G, _intrusionAcc } = turnContext;
  const phaseLabel = SEASONS[ph];
  G.players.forEach((targetPlayer, targetPi) => {
    const targetOwnedProvs = new Set(targetPlayer.provinces || []);
    const targetCharProvs = new Set(
      (G.characters || []).filter((c) => c.player === targetPi && c.alive).map((c) => c.location),
    );
    const targetKnownProvs = new Set([...targetOwnedProvs, ...targetCharProvs]);

    // Check every other player's characters
    G.players.forEach((actingPlayer, actingPi) => {
      if (actingPi === targetPi) return;
      const actingChars = (G.characters || []).filter((c) => c.player === actingPi && c.alive);
      actingChars.forEach((ac) => {
        const acProv = G.world.provinces[ac.location];
        if (!acProv) return;
        if (ac._invisTurn === G.turn) return; // 2026-10-15 (Toby): a hero under Invisibility is not noticed
        const inOwnedProv = targetOwnedProvs.has(ac.location);
        // 2026-10-15 (Toby): a lone enemy lurking in your land with none of your heroes there is
        // reported only if your people spot them — the same roll the report makes for this hero,
        // province and turn (the report is built after the turn counter advances, hence G.turn+1).
        if (
          inOwnedProv &&
          !targetCharProvs.has(ac.location) &&
          !(ac.armies || []).length &&
          relOfReport(G, targetPi, actingPi) === 'enemy' &&
          !spotEnemyInOwnedProvince(G, targetPi, acProv, ac, G.turn + 1)
        )
          return;
        const inKnownProv = targetKnownProvs.has(ac.location);
        if (!inKnownProv) return; // target doesn't know about this province

        // 2026-10-15 (Toby, D1): the same rough size the map gives, whatever the watcher's Spy
        const forceDesc = armySizeBand((ac.armies || []).length);

        // Accumulate the sighting; a single consolidated line per (target, hero, province) is
        // emitted after the turn resolves (see flushIntrusionNotifications). actor is left null
        // on the eventual log so the spotted (intruding) player never receives the owner's line.
        const branch = inOwnedProv ? 'own' : 'known';
        const key = `${targetPi}|${ac.id}|${ac.location}|${branch}`;
        let rec = _intrusionAcc.get(key);
        if (!rec) {
          rec = {
            targetPi,
            branch,
            actingName: actingPlayer.name,
            acName: ac.name,
            provName: acProv.name,
            provId: ac.location,
            phases: [],
            forceByPhase: {},
          };
          _intrusionAcc.set(key, rec);
        }
        if (!rec.phases.includes(ph)) rec.phases.push(ph);
        rec.forceByPhase[ph] = forceDesc;
      });
    });

    // (Wandering hero sightings are reported once at end of turn in the Intelligence
    // section's "Wandering Heroes" list — no need to log each phase's movement here.)
  });
}

export function flushIntrusionNotifications(turnContext) {
  const { SEASONS, _intrusionAcc } = turnContext;
  const fmtPhases = (phs) => {
    const s = [...phs].sort((a, b) => a - b);
    if (s.length === 1) return SEASONS[s[0]];
    const contiguous = s[s.length - 1] - s[0] === s.length - 1;
    if (contiguous) return `${SEASONS[s[0]]}\u2013${SEASONS[s[s.length - 1]]}`; // en-dash range
    return s.map((p) => SEASONS[p]).join(', ');
  };
  _intrusionAcc.forEach((rec) => {
    const s = [...rec.phases].sort((a, b) => a - b);
    const lastPh = s[s.length - 1];
    const uniqForces = [...new Set(s.map((p) => rec.forceByPhase[p]))];
    const forceStr =
      uniqForces.length === 1
        ? `They appear to be leading ${uniqForces[0]}.`
        : `Their strength shifted — most recently (${SEASONS[lastPh]}) leading ${rec.forceByPhase[lastPh]}.`;
    const phaseStr = fmtPhases(s);
    if (rec.branch === 'own') {
      emit(turnContext, {
        type: 'combat',
        text: `[Intelligence] ${rec.acName} of ${rec.actingName} was spotted in your province of ${rec.provName} during ${phaseStr}. ${forceStr}`,
        audience: { actor: null, realms: [rec.targetPi] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: rec.provId,
      });
    } else {
      emit(turnContext, {
        type: 'system',
        text: `[Intelligence] A hero of ${rec.actingName} (${rec.acName}) shared ${rec.provName} with your forces during ${phaseStr}. ${forceStr}`,
        audience: { actor: null, realms: [rec.targetPi] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: rec.provId,
      });
    }
  });
}
