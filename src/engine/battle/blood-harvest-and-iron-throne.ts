import { kcRng } from '../rng.ts';
import { armyUnitName } from '../dice-and-army-names.ts';
import { gdActive } from '../discoveries.ts';
import { whatARealmsDiscoveriesAddToABloodHarvest } from '../rules/the-registry-of-discovery-effects.ts';
import { theGoldARealmsAlignmentClaimsForEachFoeDestroyed } from '../rules/the-registry-of-alignment-abilities.ts';
import { narrate } from '../turn/events-and-their-audiences.ts';
import type { NarrativeLine } from '../turn/events-and-their-audiences.ts';
import type { TurnContext } from '../turn/context.ts';
import type { Army } from '../../schemas/saved-game-state.ts';

// Its types (plan P1-10b9): each parameter typed as wide as the body's guards (plan P1-10b's Decision 3), so each guard
// stays. A unit's type is any string, as the schema holds it (armyUnitName takes any, since plan P1-10b's later rows).
/** A victor: his realm and id, each guarded. */
interface AVictor {
  readonly id?: number | null | undefined;
  readonly player?: number | null | undefined;
}
/** A fallen unit as the Iron Throne reads it. */
type AFallenUnit = Pick<Army, 'type' | 'quality' | 'unitName' | '_isSkeletal'>;

// ── BLOOD HARVEST AND THE IRON THRONE (plan P1-08c: lifted out of resolveTurn) ────
// What a victory gives back: a Pagan victor's gold from the fallen, and an Evil realm's fallen foes rising as its
// skeletons (the Iron Throne of Skulls). Both take the turn's context first (src/engine/turn/context.ts).
export function bloodHarvest(
  turnContext: Pick<TurnContext, 'G'>,
  winner: AVictor | null | undefined,
  destroyed: number,
  narrative: NarrativeLine[],
) {
  const { G } = turnContext;
  if (winner?.player == null || !(destroyed > 0)) return;
  // the Blood Harvest's gold for each foe (the alignment abilities' registry's since P1-19ax1: "fate: a realm's
  // alignment claims gold for each foe destroyed"), from its row
  const theGoldForEachFoe = theGoldARealmsAlignmentClaimsForEachFoeDestroyed(G.players[winner.player]?.alignment);
  if (theGoldForEachFoe === null) return;
  const _pl = G.players[winner.player];
  if (!_pl) return; // a Pagan realm: its alignment was read above
  // + ap09 Skull Tithe (the discoveries' registry's since plan P1-19af: "fate: a realm's discoveries add to a blood
  // harvest")
  const _take = destroyed * (theGoldForEachFoe + whatARealmsDiscoveriesAddToABloodHarvest(_pl));
  _pl.gold = (_pl.gold || 0) + _take;
  narrate(narrative, {
    kind: 'the blood harvest claims offerings from the fallen enemy units',
    fallenUnitCount: destroyed,
    offeringsGold: _take,
  });
}
// GRAND DESIGN — Evil (Iron Throne of Skulls): enemy units that fall in a battle you WIN have a
// 20% chance to rise as your skeletons. Copies are pushed into the winner's WORKING array before
// its survivor-filter, so they carry through to the surviving force. Already-skeletal dead are
// left be.
export function ironThroneRaise(
  turnContext: Pick<TurnContext, 'G'>,
  winnerChar: AVictor | null | undefined,
  // not readonly: Array.isArray narrows a readonly list to any[]
  deadUnits: (AFallenUnit | null | undefined)[] | null | undefined,
  narrative: NarrativeLine[] | null | undefined,
) {
  const { G } = turnContext;
  if (winnerChar?.player == null || winnerChar.id == null || !Array.isArray(deadUnits)) return;
  const _pl = G.players[winnerChar.player];
  if (!gdActive(turnContext, winnerChar.player, 'Evil')) return;
  // Combat runs on shallow COPIES whose sync-back keeps only armies already on the real
  // character, so a freshly-raised skeleton pushed to the copy is dropped. Queue by the winner's
  // real id; flush at turn end.
  let _r = 0;
  deadUnits.forEach((u) => {
    if (u && !u._isSkeletal && kcRng() < 0.2) {
      G._pendingRises ??= [];
      G._pendingRises.push({
        charId: winnerChar.id,
        unit: {
          type: u.type,
          quality: u.quality,
          race: 'Undead',
          _isSkeletal: true,
          unitName: `${String(u.unitName || armyUnitName(u.type))} (Skeletal)`,
        },
      });
      _r++;
    }
  });
  if (_r > 0 && narrative)
    narrate(narrative, { kind: "the iron throne of skulls raises the enemy's fallen as skeletons", raisedCount: _r });
}
