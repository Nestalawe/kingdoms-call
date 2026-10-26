// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { BLOOD_HARVEST_KIT_EXTRA, protoAlignOf } from '../alignment-prototypes.ts';
import { kcRng } from '../rng.ts';
import { BLOOD_HARVEST_PER_UNIT } from '../items/tiers-and-hoards.ts';
import { armyUnitName } from '../dice-and-army-names.ts';
import { discSum, gdActive } from '../discoveries.ts';
import { narrate } from '../turn/events-and-their-audiences.ts';

// ── BLOOD HARVEST AND THE IRON THRONE (plan P1-08c: lifted out of resolveTurn) ────
// What a victory gives back: a Pagan victor's gold from the fallen, and an Evil realm's fallen foes rising as its
// skeletons (the Iron Throne of Skulls). Both take the turn's context first (src/engine/turn/context.ts).
export function bloodHarvest(turnContext, winner, destroyed, narrative) {
  const { G } = turnContext;
  if (!winner || winner.player == null || !(destroyed > 0)) return;
  if (G.players[winner.player]?.alignment !== 'Pagan') return;
  const _pl = G.players[winner.player];
  const _kit = protoAlignOf(G, winner.player) === 'Pagan' ? BLOOD_HARVEST_KIT_EXTRA : 0; // PROTOTYPE Pagan (round 4)
  const _take =
    destroyed * (BLOOD_HARVEST_PER_UNIT + _kit + discSum(turnContext, winner.player, 'bloodHarvest', 'gold')); // + ap09 Skull Tithe
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
export function ironThroneRaise(turnContext, winnerChar, deadUnits, narrative) {
  const { G } = turnContext;
  if (!winnerChar || winnerChar.player == null || winnerChar.id == null || !Array.isArray(deadUnits)) return;
  const _pl = G.players[winnerChar.player];
  if (!gdActive(turnContext, winnerChar.player, 'Evil')) return;
  // Combat runs on shallow COPIES whose sync-back keeps only armies already on the real
  // character, so a freshly-raised skeleton pushed to the copy is dropped. Queue by the winner's
  // real id; flush at turn end.
  let _r = 0;
  deadUnits.forEach((u) => {
    if (u && !u._isSkeletal && kcRng() < 0.2) {
      G._pendingRises = G._pendingRises || [];
      G._pendingRises.push({
        charId: winnerChar.id,
        unit: {
          type: u.type,
          quality: u.quality,
          race: 'Undead',
          _isSkeletal: true,
          unitName: `${u.unitName || armyUnitName(u.type)} (Skeletal)`,
        },
      });
      _r++;
    }
  });
  if (_r > 0 && narrative)
    narrate(narrative, { kind: "the iron throne of skulls raises the enemy's fallen as skeletons", raisedCount: _r });
}
