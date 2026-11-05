import { theNameOfAPlayersRealm } from '../turn/log-line-helpers.ts';
import { areEnemies } from '../realms/relations-and-captures.ts';
import { isVeiled } from '../heroes/effective-skills-and-hidden-heroes.ts';
import { armyTotalStr } from './best-commander.ts';
import { settleRalliedGarrisons } from '../world/province-bookkeeping-and-rallied-garrisons.ts';
import { resolveStalledBattles } from './stalled-battles-and-beaten-guards.ts';
import { resolveUnitGainInProvince, theSeasonOfThePhase } from './hosts-gained-in-a-province.ts';
import { emit } from '../turn/events-and-their-audiences.ts';
import { asItsGuardReadsIt } from '../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import type { AHeroAsAHostGainedHasHim } from './hosts-gained-in-a-province.ts';
import type { Army, Character, Province } from '../../schemas/saved-game-state.ts';
import type { TurnContext } from '../turn/context.ts';

/** A host caught on a war front (warFrontThreats): the hero, the province he stands in, and why: it is enemy ground, or
 *  an enemy host stands there too. */
interface AHostOnAWarFront {
  c: Character;
  prov: Province;
  onEnemyLand: boolean;
  facesEnemyHost: boolean;
}

// ── WAR FRONTS AND ENEMY STAND-OFFS (plan P1-08i3: lifted out of resolveTurn) ────
// A province where the armed hosts of two warring realms stand together is flagged as a battle waiting to happen
// (flagEnemyStandoffs). A host that stands on enemy ground, or beside an enemy host, when the turn begins gets Spring
// to act (warFrontThreats; resolveTurn keeps the start-of-turn list, the context's _warFrontAtStart and
// _warFrontProvs), and at the end of Spring turns on the province if it is still there (resolveWarFronts). They take
// the turn's context first (src/engine/turn/context.ts).
// ── ENEMY STAND-OFF SWEEP ────
// Any province where the armed, UNVEILED forces of two warring realms stand together is a battle
// waiting to happen: flag it so resolveStalledBattles joins the fight and the province shows as
// contested. This is the intermittent "holds armed forces of 2 players but is NOT flagged
// _battleUnresolved" failure in scenario.js.
export function flagEnemyStandoffs(turnContext: TurnContext, exceptProvIds?: ReadonlySet<number> | null): void {
  const { G } = turnContext;
  (asItsGuardReadsIt(G.world.provinces) ?? []).forEach((pv: Province | null | undefined) => {
    if (!pv || pv._battleUnresolved) return;
    if (exceptProvIds?.has(pv.id)) return; // a fresh war front — settled at the end of Spring (resolveWarFronts)
    const _vf = (asItsGuardReadsIt(G.characters) ?? []).filter(
      (ch) =>
        ch.alive &&
        ch.location === pv.id &&
        (asItsGuardReadsIt(ch.armies) ?? []).length > 0 &&
        ch.player != null &&
        !isVeiled(turnContext, ch),
    );
    const _vpl = [...new Set(_vf.map((ch) => ch.player))];
    let _vep = false;
    for (let i = 0; i < _vpl.length && !_vep; i++)
      for (let j = i + 1; j < _vpl.length; j++)
        if (areEnemies(turnContext, _vpl[i], _vpl[j])) {
          _vep = true;
          break;
        }
    if (_vep) pv._battleUnresolved = true;
  });
}

// ── WAR FRONTS (Toby 2026-09-19) ── Two realms find themselves at war at the start of a turn
// while one's host already stands on the other's ground (it came in under an alliance, or war was
// declared with the columns side by side), or while both hosts share a province. Nothing marched,
// so no move triggered a battle — and before this rule nothing happened at all (a column could sit
// in enemy land indefinitely), or the co-located hosts clashed at the very top of Spring with no
// chance to withdraw. Now the host gets Spring to act: withdraw, reinforce, or be reinforced. At
// the END of Spring — after every order of the phase, the Defend step and all marches — any host
// still standing where it stood at the start of the turn turns on the province: it is the
// ATTACKER, exactly like a host raised there (resolveUnitGainInProvince), so the owner's
// commanders and standing garrison defend with the defender's edge, adjacent generals on Defend
// ride in first (defendAnswerUnitGain), and an undefended province is simply taken. A province
// already fought over in Spring (a march into it, a raised host) is not fought over twice here;
// anything still contested carries on through the ordinary stalled-battle sweep. Contests left
// over from LAST turn (already flagged _battleUnresolved) are not war fronts — they resume at the
// top of Spring as before.
export function warFrontThreats(turnContext: TurnContext): AHostOnAWarFront[] {
  const { G } = turnContext;
  const out: AHostOnAWarFront[] = [];
  (asItsGuardReadsIt(G.characters) ?? []).forEach((c: Character | null | undefined) => {
    if (
      !c ||
      !c.alive ||
      c.player == null ||
      asItsGuardReadsIt(c.location) == null ||
      !(asItsGuardReadsIt(c.armies) ?? []).some((a: Army | null | undefined) => a && !a._phantom)
    )
      return;
    if (isVeiled(turnContext, c)) return;
    const p = G.world.provinces[c.location];
    if (!p) return;
    const onEnemyLand = p.owner != null && p.owner !== c.player && areEnemies(turnContext, c.player, p.owner);
    const facesEnemyHost = (asItsGuardReadsIt(G.characters) ?? []).some(
      (o: Character | null | undefined) =>
        o &&
        o.alive &&
        o.id !== c.id &&
        o.location === p.id &&
        o.player != null &&
        o.player !== c.player &&
        (asItsGuardReadsIt(o.armies) ?? []).some((a: Army | null | undefined) => a && !a._phantom) &&
        areEnemies(turnContext, c.player, o.player) &&
        !isVeiled(turnContext, o),
    );
    if (onEnemyLand || facesEnemyHost) out.push({ c, prov: p, onEnemyLand, facesEnemyHost });
  });
  return out;
}

/** Whether the fight for a province is left hanging, read as the province holds it now (an assault may have left it so
 *  since it was last tested). */
function theContestIsLeftHanging(prov: Province): boolean | undefined {
  return prov._battleUnresolved;
}
export function resolveWarFronts(turnContext: TurnContext, ph: number): void {
  const { _warFrontAtStart, _warFrontProvs, G, SEASONS } = turnContext;
  if (!_warFrontAtStart.size) return;
  _warFrontProvs.forEach((pid) => {
    const prov = G.world.provinces[pid];
    if (!prov) return;
    // a province already fought over this phase (a march into it, a host raised there, a
    // resumed contest) has had its battle — the ordinary sweep takes it from here
    if (prov._battleUnresolved || prov._hadBattleThisTurn) return;
    const here = () =>
      warFrontThreats(turnContext).filter((t) => t.prov.id === pid && _warFrontAtStart.get(t.c.id) === pid);
    const byStr = (a: AHostOnAWarFront, b: AHostOnAWarFront) =>
      armyTotalStr(turnContext, b.c, prov) - armyTotalStr(turnContext, a.c, prov);
    const assault = (c: AHeroAsAHostGainedHasHim) => {
      const theOwnersRealm = prov.owner != null ? G.players[prov.owner] : undefined;
      const ownerNm = theOwnersRealm ? theOwnersRealm.name : null;
      turnContext._combatSkillProv = null;
      turnContext._logCtx = { charId: c.id, phase: ph };
      emit(turnContext, {
        type: 'combat',
        fact: {
          kind: "a hero's host turns on a province it has shared with a realm at war",
          attackersRealmName: (c.player === null ? undefined : G.players[c.player])?.name,
          ownersRealmName: ownerNm,
          cName: c.name,
          realmTag: theNameOfAPlayersRealm(turnContext, c.player),
          unitCount: c.armies.length,
          provName: prov.name,
          seasonName: theSeasonOfThePhase(SEASONS, ph),
        },
        audience: { actor: c.player, realms: [c.player, prov.owner].filter((x) => x != null), seen: 'battle' },
        province: prov.id,
        hero: c.id,
        phase: ph,
      });
      c._warFront = true;
      try {
        resolveUnitGainInProvince(turnContext, c, prov, ph);
      } finally {
        delete c._warFront;
      }
      turnContext._logCtx = { charId: null, phase: null };
      turnContext._combatSkillProv = null;
    };
    // 1. hosts standing on ENEMY-OWNED ground — each column assaults in turn, strongest first,
    // until the province falls or the fight is left hanging
    const invaders = here()
      .filter((t) => t.onEnemyLand)
      .sort(byStr);
    if (invaders.length) {
      for (const t of invaders) {
        const c = t.c;
        if (theContestIsLeftHanging(prov)) break;
        if (!c.alive || c.location !== pid || !(asItsGuardReadsIt(c.armies) ?? []).length) continue;
        if (prov.owner == null || prov.owner === c.player || !areEnemies(turnContext, c.player, prov.owner)) continue;
        assault(c);
      }
      return;
    }
    // 2. hosts of warring realms sharing ground neither of them owns
    const facing = here()
      .filter((t) => t.facesEnemyHost)
      .sort(byStr);
    if (!facing.length) return;
    if (prov.owner == null) {
      const theStrongest = facing[0];
      if (!theStrongest) throw new TypeError("Cannot read properties of undefined (reading 'c')"); // (one faces here)
      assault(theStrongest.c);
      return;
    }
    // …a third realm's land (allied or neutral to both): the two hosts fight each other there and
    // the province stays with its owner
    prov._battleUnresolved = true;
    resolveStalledBattles(turnContext, ph, pid, true);
    turnContext._logCtx = { charId: null, phase: null };
    turnContext._combatSkillProv = null;
  });
  settleRalliedGarrisons(turnContext);
}
