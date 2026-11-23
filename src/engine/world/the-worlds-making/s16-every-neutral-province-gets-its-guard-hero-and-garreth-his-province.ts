// S16 of the world's making (generateNewGame, src/engine/world/generate.ts; the stages: docs/architecture/
// the-worlds-making-its-stages-their-files-and-how-a-stage-is-moved-into-one.md): the neutral heroes. Garreth the
// Independent's province drawn first, then every unowned land province, and every sea with defenders, gets a neutral
// hero dealt from the decks (his skills, creed, race and temper) to lead its defenders, added to the heroes' list.
import { KC_A_HEROS_WAGE_IN_SERVICE } from '../../../content/kingdoms-call-data.ts';
import { THE_NEUTRAL_HEROES_SKILLS_IN_THEIR_TIE_BREAK_ORDER } from '../../../content/the-worlds-making-its-name-pools-sea-features-wild-beasts-fleets-skill-pools-and-the-bots-realms.ts';
import {
  GARRETH_THE_INDEPENDENT,
  THE_NEUTRAL_HEROES,
} from '../../../content/the-worlds-making-its-numbers-by-stage-the-sea-the-capitals-the-taxes-the-lairs-the-seas-the-homes-and-the-heroes.ts';
import { kcRng } from '../../rng.ts';
import { RACES_P, TEMPERS_P } from '../tables.ts';
import { theWageOfAHeroInService } from '../../rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import {
  theSkillAWandererOfTheAlignmentIsSureOf,
  theWanderingHeroesDeckOfAlignments,
} from '../../rules-on-plain-values/the-world-each-creed-is-made-in-its-wild-country-its-first-skills-and-one-realm-a-game.ts';
import { ABILITIES_P, shuffleP } from '../../battle/fortune.ts';
import { nextHeroName } from '../../names.ts';
import { rP } from '../../units/drill-and-spoils.ts';
import {
  type AHeroAsTheWorldMakesHim,
  type AProvinceAsTheWorldIsMadeIt,
  theCardDealt,
  theOneMadeSure,
} from './what-every-stage-shares-the-shapes-it-hands-on-and-its-two-checks.ts';

/** What the neutral heroes read: the provinces' list, and the homes' (S9's) heroes, the neutral heroes join. */
export interface WhatTheNeutralHeroesRead {
  readonly provinces: AProvinceAsTheWorldIsMadeIt[];
  readonly allChars: AHeroAsTheWorldMakesHim[];
}

/** S16, the neutral heroes: Garreth's province drawn, then a guard hero for every unowned land province and every
 *  sea with defenders, pushed onto the heroes' list and his province's, in place. It returns nothing: the naming
 *  pass (S17) reads them from the two lists. */
export function everyNeutralProvinceGetsItsGuardHeroAndGarrethHisProvince({
  provinces,
  allChars,
}: WhatTheNeutralHeroesRead) {
  // Neutral heroes — one per non-home land province, and per sea province that has defenders,
  // leading the province's neutral armies (so sea provinces actually fight when entered) neutral
  // heroes now start with a spread of skills (INCLUDING magic schools) so they are more useful —
  // one skill at level 2 and one at level 1, dealt round-robin from NEUTRAL_SKILL_POOL so the
  // skills are spread evenly across the whole neutral-hero population rather than clustered.
  // the order is the tie-break (content's row says why)
  const NEUTRAL_SKILL_POOL = THE_NEUTRAL_HEROES_SKILLS_IN_THEIR_TIE_BREAK_ORDER;
  // neutral-hero traits are DEALT FROM RESHUFFLED DECKS rather than rolled. The old round-robin
  // cursor spread skills evenly but in province-id order, so the same skill recurred in a fixed
  // stride down the map; alignment/race/temper were independent rolls, which on a normal map easily
  // produced runs of identical results. A deck guarantees the intended proportions over every pass
  // and a fresh random ORDER each pass.
  const _mkDeck = <Card>(cards: readonly Card[]) => {
    let d: Card[] = [];
    return () => {
      if (!d.length) d = shuffleP(cards);
      return theCardDealt(d.pop());
    };
  };
  const _dealPrimary = _mkDeck(NEUTRAL_SKILL_POOL);
  const _dealSecondary = _mkDeck(NEUTRAL_SKILL_POOL);
  // Alignment mix: Divine/Undead 5%, Good/Evil 10%, Druidic/Pagan 20%, Neutral 30% — encoded as a
  // 20-card deck (1/2/4/6/4/2/1) so every 20 neutral heroes hit the mix exactly (the ladder's column: P1-19ay1).
  const _dealAlign = _mkDeck(theWanderingHeroesDeckOfAlignments());
  const _dealRace = _mkDeck(RACES_P);
  const _dealTemper = _mkDeck(TEMPERS_P.slice(0, THE_NEUTRAL_HEROES.theTempersOneIsDealtFrom));
  // ── SECRET Easter egg: reserve Garreth the Independent and pick which neutral LAND province he
  // guards. Reserving his name parts BEFORE the loop keeps "Garreth"/"the Independent" out of every
  // other hero's draw (item: unique names). He is otherwise an ordinary neutral guard.
  const _garrethLandProvs = provinces.filter(
    (p) => p.owner === null && p.terrain !== 'sea' && p.neutralDefenders.length > 0,
  );
  const _garrethPool = _garrethLandProvs.length
    ? _garrethLandProvs
    : provinces.filter((p) => p.owner === null && p.neutralDefenders.length > 0);
  const _garrethProvId = _garrethPool.length
    ? theOneMadeSure(_garrethPool[Math.floor(kcRng() * _garrethPool.length)]).id
    : null; // name reserved at top of generateNewGame
  provinces
    .filter((p) => p.owner === null && (p.terrain !== 'sea' || p.neutralDefenders.length > 0))
    .forEach((lp) => {
      const hid = allChars.length;
      // a neutral hero is a PERSON — their race is always humanoid, even when they guard a sea or
      // primal (Creature/Monster) province. The monster class belongs to the ARMIES they lead, never
      // to the hero.
      const hrace = _dealRace();
      const hSkills: Partial<Record<string, number>> = {};
      // Item 7 / deal one level-2 skill and one level-1 skill from two independent reshuffled decks,
      // so across all neutral heroes every skill appears equally often as the L2 pick and as the L1
      // pick, with no positional pattern. Magic schools are in the pool, so some neutral heroes can
      // cast.
      const _primary = _dealPrimary();
      let _secondary = _dealSecondary();
      if (_secondary === _primary) {
        const _alt = _dealSecondary();
        if (_alt !== _primary) _secondary = _alt;
        else
          _secondary = theOneMadeSure(
            NEUTRAL_SKILL_POOL[(NEUTRAL_SKILL_POOL.indexOf(_primary) + 1) % NEUTRAL_SKILL_POOL.length],
          );
      }
      hSkills[_primary] = THE_NEUTRAL_HEROES.theLevelOfTheFirstSkill;
      hSkills[_secondary] = (hSkills[_secondary] ?? 0) + 1;
      // Druidic neutral heroes are guaranteed the Druid skill (needed to lead primal armies without
      // penalty); if the deal didn't already give it, fold it into the level-1 slot.
      let wAlign = _dealAlign();
      const _wanderersSkill = theSkillAWandererOfTheAlignmentIsSureOf(wAlign);
      if (_wanderersSkill !== undefined && !hSkills[_wanderersSkill]) hSkills[_wanderersSkill] = 1;
      const _isGarreth = lp.id === _garrethProvId;
      // Garreth/the Independent are Neutral-pool names — keep it consistent (his creed: the content's, P1-19bb5)
      if (_isGarreth) wAlign = GARRETH_THE_INDEPENDENT.theCreedHeIsMadeOf;
      const baseName = _isGarreth ? 'Garreth the Independent' : nextHeroName(wAlign);
      const h: AHeroAsTheWorldMakesHim = {
        id: hid,
        name: baseName,
        isKing: false,
        player: null,
        _unkillable: _isGarreth, // SECRET: never dies (see _escapesTheEnd / handleHeroDeath)
        race: hrace,
        alignment: wAlign,
        temper: _dealTemper(),
        hp: THE_NEUTRAL_HEROES.theHpOneIsMadeWith,
        maxHp: 0,
        skills: hSkills,
        aptitude: {},
        // Neutral heroes carry the province's neutral armies
        armies: [...lp.neutralDefenders],
        items: [],
        location: lp.id,
        alive: true,
        merits: 0,
        taxBonus: 0,
        spellsUsedThisTurn: [],
        locationName: lp.name,
        _isNeutralGuard: true, // flag: currently defending their home province
        // NOTE: no encounterPlan here on purpose. autoEncounterPlan/ensureEncounterPlan live inside
        // runTurn's scope and are NOT reachable from generateNewGame — calling them here throws a
        // ReferenceError and world generation dies. NPC plans are built lazily at combat time.
      };
      h.maxHp = h.hp;
      ABILITIES_P.forEach((ab) => {
        h.aptitude[ab] = rP(THE_NEUTRAL_HEROES.eachAptitude.theLeast, THE_NEUTRAL_HEROES.eachAptitude.theMost);
      });
      h.pay = theWageOfAHeroInService(KC_A_HEROS_WAGE_IN_SERVICE.theAllegianceOfAHeroNeverHired, h); // wandering default; the hire desk quotes alignment + skill premium
      allChars.push(h);
      lp.characters.push(hid);
      // Province still keeps neutralDefenders for backward-compat intel display, but armies actually
      // live on the hero now
    });
}
