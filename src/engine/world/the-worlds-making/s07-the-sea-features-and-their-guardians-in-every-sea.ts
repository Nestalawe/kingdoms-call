// S7 of the world's making (generateNewGame, src/engine/world/generate.ts; the stages: docs/architecture/
// the-worlds-making-its-stages-their-files-and-how-a-stage-is-moved-into-one.md): the sea features and their guardians.
// Every sea gets one or two sea features, each guarded by a sea beast, tougher in richer waters, in place on the
// provinces' list.
import { MONSTERS_P } from '../../../content/kingdoms-call-data.ts';
import { THE_SEA_FEATURES_NAMES } from '../../../content/the-worlds-making-its-name-pools-sea-features-wild-beasts-fleets-skill-pools-and-the-bots-realms.ts';
import { THE_SEA_FEATURES_AND_THEIR_GUARDIANS } from '../../../content/the-worlds-making-its-numbers-by-stage-the-sea-the-capitals-the-taxes-the-lairs-the-seas-the-homes-and-the-heroes.ts';
import { kcRng } from '../../rng.ts';
import { SEA_GUARDIAN_NAMES } from '../../names.ts';
import { rP } from '../../units/drill-and-spoils.ts';
import {
  type AProvinceAsTheWorldIsMadeIt,
  theOneMadeSure,
} from './what-every-stage-shares-the-shapes-it-hands-on-and-its-two-checks.ts';

/** What the sea features read: the provinces' list (the seas made by kind in S6, filled in place). */
export interface WhatTheSeaFeaturesRead {
  readonly provinces: AProvinceAsTheWorldIsMadeIt[];
}

/** S7, the sea features and their guardians: each sea's features set in place. It returns nothing: the later stages
 *  read them from the provinces' list. */
export function theSeaFeaturesAndTheirGuardiansInEverySea({ provinces }: WhatTheSeaFeaturesRead) {
  // ── UNIFIED SEA FEATURES & GUARDIANS (item: every sea province gets 1-2 sea-themed features,
  // each guarded by a sea creature; wide pools keep even the largest maps varied). Applies to ALL
  // sea provinces — primal, whale AND open water — so open ocean is now worth exploring too.
  // Tougher guardians lurk in richer waters. This is the single source of sea features (the old
  // primal-only one-feature block above was removed).
  {
    const SEA_FEATURE_NAMES = THE_SEA_FEATURES_NAMES;
    const _seaMons = MONSTERS_P.filter((m) => SEA_GUARDIAN_NAMES.has(m.name)); // shared module-level set
    const _byTier = {
      Weak: _seaMons.filter((m) => m.power === 'Weak'),
      Moderate: _seaMons.filter((m) => m.power === 'Moderate'),
      Powerful: _seaMons.filter((m) => m.power === 'Powerful'),
    };
    const _pickTier = (tax: number) => {
      const rr = kcRng();
      // 2026-09-10 item 6: softened alongside land lairs (was 50/50 P/M · 25/60/15 W/M/P · 70/30
      // W/M).
      const { theRichSeas, theMiddlingSeas, theOtherSeas } = THE_SEA_FEATURES_AND_THEIR_GUARDIANS;
      if (tax >= theRichSeas.theTaxFrom)
        return rr < theRichSeas.theDieUnderWhichPowerful
          ? 'Powerful'
          : rr < theRichSeas.theDieUnderWhichModerate
            ? 'Moderate'
            : 'Weak'; // rich/primal seas: nastier
      if (tax >= theMiddlingSeas.theTaxFrom)
        return rr < theMiddlingSeas.theDieUnderWhichWeak
          ? 'Weak'
          : rr < theMiddlingSeas.theDieUnderWhichModerate
            ? 'Moderate'
            : 'Powerful';
      return rr < theOtherSeas.theDieUnderWhichWeak ? 'Weak' : 'Moderate'; // poor / open water: mostly weak
    };
    provinces
      .filter((p) => p.terrain === 'sea')
      .forEach((p) => {
        const fcount = 1 + (kcRng() < THE_SEA_FEATURES_AND_THEIR_GUARDIANS.theChanceOfASecondFeature ? 1 : 0); // 1-2 features
        const used = new Set<string>();
        p.features = []; // unified source — replace anything set earlier
        for (let fi = 0; fi < fcount; fi++) {
          let fname: string,
            tries = 0;
          do {
            fname = theOneMadeSure(SEA_FEATURE_NAMES[Math.floor(kcRng() * SEA_FEATURE_NAMES.length)]);
            tries++;
          } while (used.has(fname) && tries < THE_SEA_FEATURES_AND_THEIR_GUARDIANS.theTriesForAFeaturesNameNotYetTaken);
          used.add(fname);
          const tier = _pickTier(p.tax || 1);
          const pool = _byTier[tier].length ? _byTier[tier] : _seaMons;
          const m = { ...theOneMadeSure(pool[Math.floor(kcRng() * pool.length)]) };
          p.features.push({
            name: fname,
            tier: m.power || '',
            discovered: false,
            cleared: false,
            monster: { ...m },
            treasure: Math.max(1, rP(m.minG, m.maxG)),
          });
        }
      });
  }
}
