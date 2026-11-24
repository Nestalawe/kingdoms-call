// S11 of the world's making (generateNewGame, src/engine/world/generate.ts; the stages: docs/architecture/
// the-worlds-making-its-stages-their-files-and-how-a-stage-is-moved-into-one.md): the neutral races rebalanced. The
// four humanoid races' neutral provinces outside every home's ring evened out to within one, a province at a time
// from the most-held race to the least, its army pool and defenders made again for its new race, in place on the
// provinces' list.
import { kcRng } from '../../rng.ts';
import {
  COASTAL_NAVAL_CHANCE,
  RACES_P,
  SEA_TYPES_GEN,
  SIGNATURE_TERRAIN_P,
  buildHumanoidPool,
  provincePoolSize,
  theFleetAHomeOfItsRaceOffers,
} from '../tables.ts';
import { shuffleP } from '../../battle/fortune.ts';
import { neutralDefCount } from '../../units/drill-and-spoils.ts';
import { armyUnitName } from '../../dice-and-army-names.ts';
import { getNeighborsP } from '../map-helpers.ts';
import {
  type AProvinceAsTheWorldIsMadeIt,
  theOneMadeSure,
} from './what-every-stage-shares-the-shapes-it-hands-on-and-its-two-checks.ts';

/** What the neutral races' rebalance reads: the set-up's (S0's) map size, provinces' list, humanoid races and the hex
 *  grid's neighbour offsets for even and odd rows, and the homes' (S9's) homes. */
export interface WhatTheNeutralRacesRebalanceReads {
  readonly cols: number;
  readonly rows: number;
  readonly provinces: AProvinceAsTheWorldIsMadeIt[];
  readonly humanoidRaces: ReadonlySet<string | null | undefined>;
  readonly offEven: readonly (readonly [number, number])[];
  readonly offOdd: readonly (readonly [number, number])[];
  readonly playerStarts: readonly AProvinceAsTheWorldIsMadeIt[];
}

/** S11, the neutral races rebalanced: neutral humanoid provinces outside the homes' rings re-raced in place. It
 *  returns nothing: the later stages read it from the provinces' list. */
export function theNeutralRacesRebalancedToWithinOneProvince({
  cols,
  rows,
  provinces,
  humanoidRaces,
  offEven,
  offOdd,
  playerStarts,
}: WhatTheNeutralRacesRebalanceReads) {
  // ── NEUTRAL RACE REBALANCE (2026-09-21) ── The allocation pass above deals the four humanoid
  // races EXACTLY evenly (to within one province) — but the home-tailoring passes that follow then
  // re-race provinces one at a time (own-race neighbour, primal-cap re-race to a RANDOM race,
  // alignment primal conversion), and an audit measured the final spread drifting up to 8 provinces
  // apart on a 5-realm map. This pass restores the promise for the NEUTRAL world. Home provinces are
  // left out of the count (their race is the king's choice), and nothing inside ANY home ring is
  // touched, so every home-neighbourhood guarantee stands exactly as tailored. A province is moved
  // from the most- to the least-held race, preferring one on the receiving race's heartland terrain
  // so the heartland clustering survives.
  {
    const _homeRing = new Set<number>();
    playerStarts.forEach((h) => {
      _homeRing.add(h.id);
      getNeighborsP(h, cols, rows, provinces).forEach((n) => {
        _homeRing.add(n.id);
      });
    });
    const _neutralHum = () =>
      provinces.filter((p) => p.terrain !== 'sea' && p.owner === null && humanoidRaces.has(p.race));
    const _reRace = (conv: AProvinceAsTheWorldIsMadeIt, _race: string) => {
      conv.race = _race;
      const cHp = buildHumanoidPool(conv.terrain, _race, provincePoolSize(kcRng), kcRng);
      conv.armyTypes = [...cHp.types, ...cHp.garrison];
      const offs = conv.row % 2 === 0 ? offEven : offOdd;
      const coastal = offs.some(([dr, dc]) => {
        const nr = conv.row + dr;
        if (nr < 0 || nr >= rows) return false;
        const nb = provinces[nr * cols + ((((conv.col + dc) % cols) + cols) % cols)];
        return nb?.terrain === 'sea';
      });
      if (coastal && kcRng() < COASTAL_NAVAL_CHANCE) {
        const f = theFleetAHomeOfItsRaceOffers(_race);
        if (f && !conv.armyTypes.includes(f)) conv.armyTypes.push(f);
      }
      const pool = conv.armyTypes.filter((t) => !t.toLowerCase().includes('garrison') && !SEA_TYPES_GEN.has(t));
      const draw = pool.length ? pool : conv.armyTypes;
      conv.neutralDefenders = Array.from({ length: neutralDefCount(conv.tax) }, () => {
        const dt = theOneMadeSure(draw[Math.floor(kcRng() * draw.length)]);
        return { type: dt, quality: 'Average', race: _race, unitName: theOneMadeSure(armyUnitName(dt)) };
      });
      conv.npcArmies = conv.neutralDefenders.length;
      conv.name = null; // renamed by the thematic naming pass below
    };
    for (let guard = 0; guard < 500; guard++) {
      const cnt: Partial<Record<string, number>> = {};
      RACES_P.forEach((r) => (cnt[r] = 0));
      _neutralHum().forEach((p) => {
        cnt[String(p.race)] = Number(cnt[String(p.race)]) + 1;
      });
      const order = shuffleP(RACES_P).sort((a, b) => Number(cnt[b]) - Number(cnt[a]));
      const hi = theOneMadeSure(order[0]),
        lo = theOneMadeSure(order[order.length - 1]);
      if (Number(cnt[hi]) - Number(cnt[lo]) <= 1) break;
      const movable = shuffleP(_neutralHum().filter((p) => p.race === hi && !_homeRing.has(p.id)));
      if (!movable.length) break;
      const pick = theOneMadeSure(
        movable.find((p) => SIGNATURE_TERRAIN_P[lo] === p.terrain) ??
          movable.find((p) => SIGNATURE_TERRAIN_P[hi] !== p.terrain) ??
          movable[0],
      );
      _reRace(pick, lo);
    }
  }
}
