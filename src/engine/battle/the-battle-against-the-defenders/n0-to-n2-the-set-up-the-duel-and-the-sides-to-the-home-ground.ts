// The battle against a province's defenders (combatVsNPC, src/engine/battle/battles-against-province-defenders.ts), its
// first stage, B-06az: the set-up (the negations, the tiers that fight, the deploy line, Terror; the battle proof's N0),
// the duel before the battle (N1) and the sides (N2: a slain commander, Tactical, the defender's edge and Siege,
// Righteous Defence, the items at the walls, home), moved here as they were, the same statements in the same order.
// combatVsNPC calls it where they stood and takes, under the same names, what its later stages read. Nothing it hands
// on is written after it (its three lets, tactSkill, defBonus and navalSkillAtk, are final here), so each is handed on
// as a value. The battle proof (tools/proof/README.md, section 8) finds N1's and N2's anchors in this file; the draws
// above N1's (the tiers that fight, the attack's verb) have no anchor above them here, so they count under the caller's
// line, N0, as they did.
//
// The battle's state, the lets its stages share (who writes each and who reads it), is written with its type in the
// file of the first stage that writes it, n3-to-n4-the-attackers-pre-battle-magic-army-spells-archery-flak-and-breach.ts
// (B-06ba).
import { theAlignmentARealmReadsAs } from '../../rules-on-plain-values/the-alignment-a-realm-reads-as-its-own-or-the-one-a-realm-of-none-reads-as.ts';
import { KC_UNIT_CLASS } from '../../../content/kingdoms-call-data.ts';
import { kcRng } from '../../rng.ts';
import { theDefendersFortificationsAfterTheCommandersItems } from '../../rules/the-registry-of-magic-item-effects.ts';
import {
  theFactorARealmsAlignmentStrengthensAUnitByItsReignOfFear,
  theFactorARealmsAlignmentStrengthensItsDefenceOfItsOwnGroundBy,
} from '../../rules/the-registry-of-alignment-abilities.ts';
import { SKILL_LABELS } from '../../army-tables.ts';
import { ARCHERY_MISSILE_PCT } from '../ladder.ts';
import { homeFounderOf } from '../../grand-design.ts';
import { activeItems } from '../../items/equipment.ts';
import { dispFloor } from '../../rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import { injectPhantoms } from '../../world/map-helpers.ts';
import { perkTier } from '../../titles/perks.ts';
import {
  theShareARealmsDiscoveriesFortifyItsOwnGroundBy,
  whatARealmsDiscoveriesAddToASiege,
} from '../../rules/the-registry-of-discovery-effects.ts';
import { charMinor } from '../../titles/title-holders-and-battle-merit.ts';
import { theLevelsAHerosTitlesAddToHisTacticalInABattle } from '../../rules/the-registry-of-the-minor-titles-perks.ts';
import { effStat } from '../../heroes/effective-skills-and-hidden-heroes.ts';
import { REIGN_OF_FEAR_MULT, armStr, kinNarrative, provIsCoastal } from '../terrain-and-unit-strength.ts';
import { realCharOf } from '../best-commander.ts';
import { forceMarker } from '../battle-report-lines-and-force-markers.ts';
import { consumeTerror } from '../evil-terror.ts';
import { reignOfFearHere } from '../../world/the-marks-on-a-province-consecrated-ground-terror-and-enslave.ts';
import { magicItemsLine } from '../../personal-combat/duels-and-character-encounters.ts';
import { preBattleDuel } from '../pre-battle-duels.ts';
import {
  THE_NUMBER_OF_VERBS_AN_ATTACK_IS_TOLD_WITH,
  THE_VERB_A_PROVINCES_DEFENDERS_STAND_WITH,
} from '../the-facts-a-battles-lines-record.ts';
import { narrate } from '../../turn/events-and-their-audiences.ts';
import type { NarrativeLine } from '../../turn/events-and-their-audiences.ts';
import type { TheDefendersOfAProvince } from '../the-facts-a-battles-lines-record.ts';
import { asItsGuardReadsIt } from '../../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import type { TurnContext } from '../../turn/context.ts';
import type { ArmyInABattle, HeroInABattle, ProvinceInABattle } from '../../army-tables.ts';

/** A unit in the battle against a province's defenders: a unit in a battle, and the marks only this battle writes: a
 *  defending hull a whale cohort sinks before a shot is fired, and a defender who falls though his side holds the
 *  ground (each cleared before the battle returns, or the unit spliced out). */
export type AUnitInTheBattleAgainstTheDefenders = ArmyInABattle & { _sunk?: boolean; _defDied?: boolean };
/** An item as the War Drum's test reads it: its flag, if it has one (only the War Drum does). */
type AnItemAsTheWarDrumReadsIt = object & { readonly drumTierUp?: unknown };

/** The first stage of the battle against a province's defenders: the set-up, the duel and the sides, to the home
 *  ground and the commander's Archery and Naval. It returns what the later stages read, each final here. */
export function theSetUpTheDuelAndTheSidesOfTheBattleAgainstTheDefenders(
  turnContext: TurnContext,
  c: HeroInABattle,
  prov: ProvinceInABattle,
  neutralGuardHero: HeroInABattle | null | undefined,
) {
  const { G } = turnContext;
  // the attacker and the province as the body's guards read them (each read unguarded below too)
  const theAttackerAsTheGuardsReadHim = asItsGuardReadsIt(c),
    theProvinceAsTheGuardsReadIt = asItsGuardReadsIt(prov);
  turnContext._combatSkillProv = asItsGuardReadsIt(theProvinceAsTheGuardsReadIt?.id) ?? null; // battle-series key (cleared at each loop boundary)
  // a resumed battle is another carry-on round (deadlier); a fresh clash resets the count.
  if (theProvinceAsTheGuardsReadIt) {
    if (theAttackerAsTheGuardsReadHim?._resumeBattle && !c._openingClash)
      prov._carryOnRounds = (prov._carryOnRounds ?? 0) + 1;
    else prov._carryOnRounds = 0;
  }
  const narrative: NarrativeLine[] = [];
  // Battle-scoped psychic negations start clear each battle (set by pre-battle magic below).
  if (theAttackerAsTheGuardsReadHim) {
    c._druidNegated = false;
    c._tacticalNegated = false;
    c._tacticalHalved = false;
    c._tacticalMult = 1;
    c._curseHalveStat = null;
    if (c._massConfusedTurn === G.turn) c._tacticalNegated = true;
  }
  if (neutralGuardHero) {
    neutralGuardHero._druidNegated = false;
    neutralGuardHero._tacticalNegated = false;
    neutralGuardHero._tacticalHalved = false;
    neutralGuardHero._tacticalMult = 1;
    neutralGuardHero._curseHalveStat = null;
  }
  // TACTICAL L6 (10%/unit) & War Drum (20%/unit) — decide ONCE, here, which of c's units fight a
  // tier higher this battle.
  if (theAttackerAsTheGuardsReadHim && Array.isArray(c.armies)) {
    const _tac = perkTier(c, 'tactical') > 0,
      _drum = activeItems(c).some((it: AnItemAsTheWarDrumReadsIt | null | undefined) => it?.drumTierUp);
    c.armies.forEach((a: AUnitInTheBattleAgainstTheDefenders | null | undefined) => {
      if (a) {
        a._tacUp = _tac && kcRng() < 0.1;
        a._drumUp = _drum && kcRng() < 0.2;
      }
    });
  }
  const _cLA = theAttackerAsTheGuardsReadHim?._lightningAdvanceTurn === G.turn; // MARCH L9 Lightning Advance: defenders fight with no terrain / magic / archery this battle
  const armies: AUnitInTheBattleAgainstTheDefenders[] = asItsGuardReadsIt(c.armies) ?? [];
  const defenders: AUnitInTheBattleAgainstTheDefenders[] = asItsGuardReadsIt(prov.neutralDefenders) ?? [];
  // the attacker's realm (none for a hero who serves no realm, as JavaScript reads G.players[null])
  const theAttackersRealm = c.player === null ? undefined : G.players[c.player];
  injectPhantoms(c, realCharOf(turnContext, c)); // PHANTASMAL/PHANTOM HOST: spectral doubles join the fight (removed at battle end)

  // Setup — the deployment is described BEFORE the challenge is issued, so a commander slain in
  // the pre-battle duel is not narrated "standing firm" after they have already fallen. frame HOW
  // the battle began — who advanced, into whose ground — so the report doesn't jump straight into
  // combat with no context. Item: an enemy-OWNED province defended only by its garrison (no
  // commander) must not read like a neutral fight — name the crown that holds it and colour its
  // garrison as theirs.
  const _npcOwnersRealm = prov.owner != null ? G.players[prov.owner] : undefined;
  const _npcOwnerName = _npcOwnersRealm ? _npcOwnersRealm.name || null : null;
  const _npcHeldBy: TheDefendersOfAProvince = neutralGuardHero
    ? { kind: 'the defenders led by their guard', guardName: neutralGuardHero.name.replace(' (wandering)', '') }
    : _npcOwnerName
      ? { kind: "a realm's garrison with no guard to lead it", ownerName: _npcOwnerName }
      : { kind: 'neutral defenders with no guard to lead them' }; // the prose writes the label (plan P1-12d23)
  // Items 6 & 11: the "moves into … a battle is initiated" line is ALWAYS the first line of a
  // battle report — before terror, flak or any other pre-battle note.
  if (!c._resumeBattle)
    narrate(narrative, {
      kind: 'the attacker moves into a province held by its defenders and a battle is initiated',
      cName: c.name,
      aRealmsHero: c.player != null,
      attackersRealmName: theAttackersRealm?.name,
      provName: prov.name,
      heldByName: _npcHeldBy,
    }); // same opener as PvP
  // Evil Terror: if this province was terrorised on a previous turn, demoralise its defenders
  // (stacking). Reign of Fear is read first: the attacker's Monsters fight ×1.5 on ground its Terror grips.
  const _fearAtk = reignOfFearHere(prov, c.player);
  consumeTerror(prov, defenders, narrative);
  // (the Reign of Fear's runner, the alignment abilities' registry's, P1-19au2: a unit it strengthens)
  if (
    _fearAtk &&
    armies.some(
      (a: AUnitInTheBattleAgainstTheDefenders | null | undefined) =>
        a &&
        theFactorARealmsAlignmentStrengthensAUnitByItsReignOfFear(
          c.player != null ? G.players[c.player]?.alignment : null,
          { theUnitType: a.type },
        ) !== null,
    )
  )
    narrate(narrative, {
      kind: 'the province still cowers under a reign of fear',
      provName: prov.name,
      terrorHeroName: c.name,
      reignOfFearMultiplier: REIGN_OF_FEAR_MULT,
    });
  narrate(narrative, { kind: 'the battle for a province begins', provName: prov.name });
  {
    const _ic = magicItemsLine(c);
    if (_ic) narrate(narrative, _ic);
  } // commander's magic items in play
  {
    const _kA = kinNarrative(armies, c, c.player != null ? G.players[c.player]?.race : null, {
      kind: "a hero's host in the battle",
      heroName: c.name,
    });
    if (_kA) narrate(narrative, _kA); // item 7
    const _kD = kinNarrative(
      defenders,
      neutralGuardHero ?? null,
      prov.owner != null ? G.players[prov.owner]?.race : null,
      { kind: "a province's defenders, whoever leads them", provName: prov.name },
    );
    if (_kD) narrate(narrative, _kD);
  }
  {
    const _aS = Math.round(
      armies.reduce(
        (t, a: AUnitInTheBattleAgainstTheDefenders | null | undefined) =>
          t +
          (a && !a._phantom
            ? armStr(turnContext, a, c, c.player != null ? G.players[c.player]?.alignment : null, prov.terrain, {
                force: armies,
                enemyForce: defenders,
                isAttacker: true,
                amphibious: !!c._amphibiousAssault,
                coastal: provIsCoastal(G, prov),
                reignOfFear: _fearAtk,
              })
            : 0),
        0,
      ),
    ); // 2026-09-18 · 2026-09-23b: same ctx as the battle rows
    narrate(
      narrative,
      forceMarker(
        turnContext,
        {
          kind: 'a hero, with the realm he serves',
          heroName: c.name,
          servesARealm: c.player != null,
          realmName: theAttackersRealm?.name,
        },
        c.player,
        'attacker',
        armies,
        {
          itsVerbs: 'an attack',
          verbIndex: Math.floor(kcRng() * THE_NUMBER_OF_VERBS_AN_ATTACK_IS_TOLD_WITH),
          provName: prov.name,
          armyStrength: _aS,
          tacticalLevel: null,
        },
      ),
    ); // realm named, as in PvP
    // 2026-09-24 (Toby item 2): the defending side's header carries its own post-modifier strength
    // in the SAME format as the attacker's (and as PvP) — terrain, kinship, abilities and the
    // chieftain's own bonuses all counted, before Tactical / battle lines / dice.
    const _dS = Math.round(
      defenders.reduce(
        (t, a: AUnitInTheBattleAgainstTheDefenders | null | undefined) =>
          t +
          (a && !a._phantom
            ? armStr(
                turnContext,
                a,
                neutralGuardHero ?? null,
                prov.owner != null ? G.players[prov.owner]?.alignment : null,
                prov.terrain,
                { force: defenders, enemyForce: armies, isAttacker: false, coastal: provIsCoastal(G, prov) },
              )
            : 0),
        0,
      ),
    );
    if (neutralGuardHero) {
      narrate(
        narrative,
        forceMarker(
          turnContext,
          { kind: "a province's guard at the head of its force", guardName: neutralGuardHero.name },
          null,
          'defender',
          defenders,
          {
            itsVerbs: 'a defence',
            verbIndex: THE_VERB_A_PROVINCES_DEFENDERS_STAND_WITH,
            provName: prov.name,
            armyStrength: _dS,
            tacticalLevel: null,
          },
          { guard: true },
        ),
      );
    } else {
      narrate(
        narrative,
        forceMarker(
          turnContext,
          _npcOwnerName
            ? { kind: "a realm's garrison at a province", ownerName: _npcOwnerName, provName: prov.name }
            : { kind: "a province's own defenders with no one to lead them", provName: prov.name },
          prov.owner ?? null,
          'defender',
          defenders,
          {
            itsVerbs: 'a defence',
            verbIndex: THE_VERB_A_PROVINCES_DEFENDERS_STAND_WITH,
            provName: prov.name,
            armyStrength: _dS,
            tacticalLevel: null,
          },
        ),
      );
    }
  }

  // ── Duel before battle ── Only when the province has a commander to answer for it; leaderless
  // garrisons have nobody to ride out. The guardian's stance comes from their Temper. 2026-09-13:
  // a duel with the local chieftain may advance ONE skill, no more. Scoped with try/finally so a
  // throw inside the duel can never leave the cap latched on for the rest of the turn.
  let _npcDuel;
  turnContext._chieftainDuelGain = neutralGuardHero?._isNeutralGuard ? { used: false } : null;
  try {
    _npcDuel = preBattleDuel(turnContext, c, neutralGuardHero, narrative);
  } finally {
    turnContext._chieftainDuelGain = null;
  }
  const _npcAtkMorale = _npcDuel.atkMorale,
    _npcDefMorale = _npcDuel.defMorale;
  // `|| c.alive===false` — the commander may have been killed in an EARLIER phase (duel,
  // encounter, pursuit, spell) while pinned in this contested province. His host fights on, and
  // must fight on exactly as it would after a pre-battle duel death: no Tactical, Archery, Naval,
  // Druid or spellcraft.
  const atkCmdrSlain = !!_npcDuel.atkSlain || asItsGuardReadsIt(c.alive) === false,
    defCmdrSlain = !!_npcDuel.defSlain;
  if (defCmdrSlain && neutralGuardHero)
    // (the duel slays a defender only where there is one)
    narrate(narrative, {
      kind: 'the guard is slain before his host, and a sergeant of the garrison takes up the banner',
      guardName: neutralGuardHero.name.replace(' (wandering)', ''),
    });
  if (atkCmdrSlain)
    narrate(narrative, {
      kind: 'the attacker is cut down before the lines join, and the eldest captain takes command',
      cName: c.name,
    });
  // below the duel, an attacker slain in single combat is spoken of as the stand-in who took
  // command, not the fallen leader — the setup lines and the death notice above keep the name.
  const cName = atkCmdrSlain ? `${c.name}'s leaderless host` : c.name; // slain → the host acts, not the dead commander
  // The attacker's side as the facts hold it (plan P1-12d23): the record the label above is written from; the prose
  // writes the label (theLabelOfASide). Since P1-12d30 the battle's report lines take it too, since P1-12d31 the lines
  // before the volleys, and since P1-12d32 the sea lift's.
  const atkSide = { heroName: c.name, leaderless: atkCmdrSlain };
  // A slain commander's skills die with them: the stand-in provides no Tactical, Archery, Naval,
  // Druid or spellcraft for the rest of this battle.
  const defHero = defCmdrSlain ? null : (neutralGuardHero ?? null);
  let tactSkill =
    atkCmdrSlain || c._tacticalNegated
      ? 0
      : effStat(turnContext, c, 'tactical') +
        theLevelsAHerosTitlesAddToHisTacticalInABattle((title) => charMinor(turnContext, c, title));
  if (c._curseHalveStat === 'tactical') tactSkill = Math.floor(tactSkill / 2); // LEVEL 6+ PERK — Grand Tactician
  const tactBonus = Math.min(2.0, 1 + tactSkill * 0.2); // Tactical battle bonus hard-capped at ×2.0 (incl. titles)
  // Tactical only applies to land armies (not flying or naval) per AK 4.1.1 Tactical only applies
  // in land provinces AND to land units
  const isLandBattle = prov.terrain !== 'sea';
  // 2026-09-23d: the "📊 X commands: Tactical N (×m to K land units)" line is gone — the Battle-stats
  // ladder names Tactical on the units it reaches, and this line still counted only ground units
  // (flyers take Tactical since 2026-09-23c), so the two disagreed. (Its count of the land units, read by nothing since,
  // went with P1-10b24.)
  if (tactSkill > 0 && !isLandBattle)
    narrate(narrative, { kind: "the attacker's Tactical command does not apply at sea", cName: atkSide });
  const effectiveTactBonus = isLandBattle ? tactBonus : 1;

  // Terrain and defender bonus sd03 Siege Engines: attacker with this discovery reduces defender
  // bonus
  let defBonus = 1.25; // sd03 Siege Engines is now an ordinary `siege` effect (below)
  {
    const _sg = whatARealmsDiscoveriesAddToASiege(theAttackersRealm, {
      theAttackersUnits: asItsGuardReadsIt(c.armies) ?? [],
    });
    if (_sg > 0) {
      defBonus = Math.max(1, defBonus - _sg);
      narrate(narrative, {
        kind: "the attacker's siegecraft wears down the defenders' fortifications",
        atkName: atkSide,
        siegecraft: _sg,
      });
    }
  } // rd09 / ro10
  // GOOD — Righteous Defence: a Good realm's own soil is defended with quiet, unshakable
  // conviction (+10% to the defence of any province the Good player OWNS).
  // (the alignment abilities' registry's runner, P1-19au2)
  if (prov.owner != null && prov.owner !== c.player) {
    const _righteous = theFactorARealmsAlignmentStrengthensItsDefenceOfItsOwnGroundBy(G.players[prov.owner]?.alignment);
    if (_righteous !== null) {
      defBonus *= _righteous;
      narrate(narrative, { kind: 'the defenders of a province defend ground held justly', provName: prov.name });
    }
  }
  // The attacker's items at the defenders' fortifications: the items' registry's "strength: the defenders'
  // fortifications" (plan P1-19n: his siege mastery). Against neutral guards no defender's items are read.
  {
    const _fort = theDefendersFortificationsAfterTheCommandersItems(
      { theDefendersFightAtTheirHome: false },
      { theAttackersItems: () => activeItems(c) },
      defBonus,
    );
    defBonus = _fort.theBonus;
    for (const _line of _fort.theLines)
      if (_line === "the attacker's siege mastery halves the defenders' fortifications")
        narrate(narrative, {
          kind: "the attacker's siege mastery halves the defenders' fortifications",
          atkName: atkSide,
        });
  }
  // (The Wyverns' cut to a neutral defence's bonus, Dread's stand-in here, was retired with the unit
  // abilities, 2026-10-11: Terror From Above bears on the strongest front unit, in battleFaceSide.)
  // home ground belongs ONLY to the province's founding owner — their own garrison defending it
  // (×1.2, i.e. ×1.5 total with the defender's edge), or the founder attacking to win their
  // captured capital back (×1.5). Any other holder gets nothing.
  const _founderN = homeFounderOf(G, prov.id);
  const isHome = _founderN != null && prov.owner === _founderN;
  const atkHome = _founderN != null && c.player === _founderN && prov.owner !== _founderN;
  if (isHome) narrate(narrative, { kind: 'the defenders fight on home soil' });
  if (atkHome)
    narrate(narrative, {
      kind: "the attacker fights to win back his realm's capital",
      atkName: atkSide,
      provName: prov.name,
    });
  {
    const _dOwn =
      prov.owner != null && prov.owner !== c.player
        ? theShareARealmsDiscoveriesFortifyItsOwnGroundBy(G.players[prov.owner], {
            isItTheRealmsHome: () => homeFounderOf(G, prov.id) === prov.owner,
          })
        : 0;
    if (_dOwn > 0) {
      defBonus *= 1 + _dOwn;
      narrate(narrative, {
        kind: "the defender's realm holds its own ground the harder",
        defName: { kind: 'the realm that holds the province', realmName: _npcOwnersRealm?.name },
        ownGroundDefencePct: dispFloor(_dOwn * 100),
      });
    }
  } // defOwn discoveries
  const homeBonus = isHome ? 1.2 : 1;
  const atkHomeBonus = atkHome ? 1.5 : 1;

  // Calculate strengths with some narrative
  const MISSILE_ARMIES = new Set(KC_UNIT_CLASS.missile);
  // the skills' labels, read by any school a plan names
  const skillLabels: Readonly<Partial<Record<string, string>>> = SKILL_LABELS;
  const archSkillAtk = atkCmdrSlain ? 0 : effStat(turnContext, c, 'archery');
  const archMissileBonus = 1 + archSkillAtk * ARCHERY_MISSILE_PCT; // 2026-09-23b (Toby): Archery lifts missile units +5%/level · sd07 Fire Arrows is a `unitStr` missile effect (armStr)
  let navalSkillAtk = atkCmdrSlain ? 0 : effStat(turnContext, c, 'naval');
  if (c._curseHalveStat === 'naval') navalSkillAtk = Math.floor(navalSkillAtk / 2); // Curse (battle magic) can wither Naval command
  const navalFleetBonus = 1 + navalSkillAtk * 0.2;
  const _provCoastal = provIsCoastal(G, prov); // Sea Giants' Tidal Might
  const playerAlign = theAlignmentARealmReadsAs(theAttackersRealm?.alignment);
  return {
    G,
    theAttackerAsTheGuardsReadHim,
    narrative,
    _cLA,
    armies,
    defenders,
    theAttackersRealm,
    _fearAtk,
    _npcAtkMorale,
    _npcDefMorale,
    atkCmdrSlain,
    cName,
    atkSide,
    defHero,
    tactSkill,
    isLandBattle,
    effectiveTactBonus,
    defBonus,
    homeBonus,
    atkHomeBonus,
    MISSILE_ARMIES,
    skillLabels,
    archSkillAtk,
    archMissileBonus,
    navalSkillAtk,
    navalFleetBonus,
    _provCoastal,
    playerAlign,
  };
}
