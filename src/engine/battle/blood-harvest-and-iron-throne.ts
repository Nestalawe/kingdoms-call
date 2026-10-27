import { kcRng } from '../rng.ts';
import { BLOOD_HARVEST_PER_UNIT } from '../items/tiers-and-hoards.ts';
import { armyUnitName } from '../dice-and-army-names.ts';
import { discSum, gdActive } from '../discoveries.ts';
import { narrate } from '../turn/events-and-their-audiences.ts';
import type { NarrativeLine } from '../turn/events-and-their-audiences.ts';
import type { TurnContext } from '../turn/context.ts';
import type { UnitType } from '../../content/kingdoms-call-data.ts';
import type { Army } from '../../schemas/saved-game-state.ts';

// Its types (plan P1-10b9): each parameter typed as wide as the body's guards (plan P1-10b's Decision 3), so each guard
// stays. A unit's type is a UnitType where its name is drawn (armyUnitName takes one), though the schema's is any string.
/** A victor: his realm and id, each guarded. */
interface AVictor {
  readonly id?: number | null | undefined;
  readonly player?: number | null | undefined;
}
/** A fallen unit as the Iron Throne reads it. */
type AFallenUnit = Pick<Army, 'quality' | 'unitName' | '_isSkeletal'> & { readonly type: UnitType };

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
  if (G.players[winner.player]?.alignment !== 'Pagan') return;
  const _pl = G.players[winner.player];
  if (!_pl) return; // a Pagan realm: its alignment was read above
  const _take = destroyed * (BLOOD_HARVEST_PER_UNIT + discSum(turnContext, winner.player, 'bloodHarvest', 'gold')); // + ap09 Skull Tithe
  _pl.gold = (_pl.gold || 0) + _take;
  narrate(narrative, {
    kind: 'the blood harvest claims offerings from the fallen enemy units',
    fallenUnitCount: destroyed,
    fallenUnitsPlural: destroyed !== 1 ? 's' : '',
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
