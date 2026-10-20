import { kcRng } from '../rng.ts';
import { BLOOD_HARVEST_PER_UNIT } from '../items/tiers-and-hoards.ts';
import { armyUnitName } from '../dice-and-army-names.ts';
import { discSum, gdActive } from '../discoveries.ts';

// ── BLOOD HARVEST AND THE IRON THRONE (plan P1-08c: lifted out of resolveTurn) ────
// What a victory gives back: a Pagan victor's gold from the fallen, and an Evil realm's fallen foes rising as its
// skeletons (the Iron Throne of Skulls). Both take the turn's context first (src/engine/turn/context.ts).
export function bloodHarvest(turnContext, winner, destroyed, narrative) {
  const { G } = turnContext;
  if (!winner || winner.player == null || !(destroyed > 0)) return;
  if (G.players[winner.player]?.alignment !== 'Pagan') return;
  const _pl = G.players[winner.player];
  const _take = destroyed * (BLOOD_HARVEST_PER_UNIT + discSum(turnContext, winner.player, 'bloodHarvest', 'gold')); // + ap09 Skull Tithe
  _pl.gold = (_pl.gold || 0) + _take;
  narrative.push(
    `\u{1FA78} Blood Harvest — the old gods claim their due from ${destroyed} fallen enemy unit${destroyed !== 1 ? 's' : ''}: +${_take}g in offerings.`,
  );
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
    narrative.push(
      `\u{1F480} Iron Throne of Skulls — ${_r} of the enemy's fallen claw their way up to serve as your skeletons.`,
    );
}
