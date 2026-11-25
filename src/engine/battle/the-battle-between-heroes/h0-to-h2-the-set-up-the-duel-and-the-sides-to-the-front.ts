// The battle between two heroes' hosts (combatVsChar, src/engine/battle/battles-between-heroes.ts), its first stage,
// B-06bf: the set-up and the titles' merit tally (the battle proof's H0), the duel before the battle (H1), and the
// sides (H2: Righteous Defence, the zeal, Consecrate's seizure, home and the front's width, to each commander's Archery
// and Naval), moved here as they were, the same statements in the same order. combatVsChar calls it where they stood
// and takes, under the same names, what its later stages read. Each value it hands on is final here but two: the
// front's width, which the scout's deploy changes in a later stage (so H5 holds its own `let` of it, from the width
// rolled here, and hands on the deploy's), and the titles' merit tally, which `_tallyLost` (made here) writes from the
// later stages (so it is the battle's state, handed on by reference). The battle proof (tools/proof/README.md,
// section 8) finds H1's and H2's anchors in this file; the draws above H1's (the tiers that fight) have no anchor above
// them here, so they count under the caller's line, H0, as they did.
//
// The battle's state: every `let` of combatVsChar, the stage that writes it and the stages that read it (the stages
// are the battle proof's, H0 to H10; each later cut follows this table). A `let` final within the stage that writes it
// is handed on as a value; one a later stage still writes after another reads it is shared by reference, in the
// battle's state (below), from the row whose cut falls between the writer and the reader.
//
// | let | written in | read in | how the stages share it |
// |---|---|---|---|
// | `_mAtkLost`, `_mDefLost` (the titles' merit tally) | H0 (made), H4 and H10 (`_tallyLost`, made in H0, called there) | H10 (the statistics' record, the battle's return) | the battle's state, `theBattlesState` (B-06bf) |
// | `atkTact`, `defTact` | H0 (a Curse halves it), H1 (a commander slain in the duel) | H0, H5, H7, H9, the command stage's builders | a value, final after H1 |
// | `atkTactBonus`, `defTactBonus` | H0, H1 (a commander slain in the duel) | H7, the command stage's builders | a value, final after H1 |
// | `defBonus` | H1 (made; Siege), H2 (Righteous Defence, the realm's own ground, the commanders' items) | H5, H9 | a value, final after H2 |
// | `_defFanPct` | H2 (made; Consecrate) | H2 | this stage's own |
// | `pvpFront` (the front's width) | H2 (rolled), H5 (the scout's deploy) | H4, H5, H7, H9 | a value: H4 is handed the width rolled here (nothing changes it before H5); H5's own `let` from it, its deploy's width handed on (B-06bi), final there |
// | `atkNav`, `defNav` | H2 (made; a Curse halves it) | H2, the command stage's builders | a value, final in H2 |
// | `atkOrd`, `defOrd` (the mastery orders) | H5 | H5, H9 | H5's own, then a value, final there (B-06bi) |
// | `_stayLo`, `_stayWi` | H9 (`_wantsToStay`) | H9 | H9's own |
// | `_heldField` | H9 | H9 | H9's own |
// | `defFriendlyAdj`, `atkFriendlyAdj` | H9 | H9 | H9's own |
//
// The command stage's builders (`_pvpCtx`, `_pvpCmd`, `_pvpRow`: each unit's strength on the ground with its
// commander's Archery, Naval or Tactical and Illusory Terrain) stood in H2's text; they are a file of their own beside
// the stages (the-command-stages-builders-…, B-06bh), made in H4 once Illusory Terrain's two flags, which `_pvpCmd`
// reads, are set. H4 calls `_pvpRow` and hands it on; H9 calls it. They draw no die.
import { theAlignmentARealmReadsAs } from '../../rules-on-plain-values/the-alignment-a-realm-reads-as-its-own-or-the-one-a-realm-of-none-reads-as.ts';
import { KC_UNIT_CLASS } from '../../../content/kingdoms-call-data.ts';
import { kcRng } from '../../rng.ts';
import { theDefendersFortificationsAfterTheCommandersItems } from '../../rules/the-registry-of-magic-item-effects.ts';
import {
  theAlignmentASideFightsUnder,
  theChanceOfZealARealmsAlignmentGivesASide,
  theChanceOfZealOfADefenderOnConsecratedGround,
  theFactorARealmsAlignmentStrengthensAUnitByItsReignOfFear,
  theFactorARealmsAlignmentStrengthensItsDefenceOfItsOwnGroundBy,
  theFervourOfASide,
} from '../../rules/the-registry-of-alignment-abilities.ts';
import { rollBattleWidth } from '../lines.ts';
import { ARCHERY_MISSILE_PCT, UNDEAD_SKEL_HERO_FAN, UNDEAD_SKEL_KING_FAN } from '../ladder.ts';
import { homeFounderOf } from '../../grand-design.ts';
import { isConsecrated } from '../../world/the-marks-on-a-province-consecrated-ground-terror-and-enslave.ts';
import { activeItems } from '../../items/equipment.ts';
import { dispFloor } from '../../rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import { applyWraithTouch, injectPhantoms } from '../../world/map-helpers.ts';
import { perkTier } from '../../titles/perks.ts';
import {
  theShareARealmsDiscoveriesFortifyItsOwnGroundBy,
  whatARealmsDiscoveriesAddToASidesFanaticism,
  whatARealmsDiscoveriesAddToASiege,
} from '../../rules/the-registry-of-discovery-effects.ts';
import { noteFieldBattle, recordBattleCmdrs } from '../../turn/mercenary-ids-and-battle-records.ts';
import { charMinor } from '../../titles/title-holders-and-battle-merit.ts';
import { theLevelsAHerosTitlesAddToHisTacticalInABattle } from '../../rules/the-registry-of-the-minor-titles-perks.ts';
import { effStat } from '../../heroes/effective-skills-and-hidden-heroes.ts';
import { REIGN_OF_FEAR_MULT, armStr, kinNarrative, provIsCoastal } from '../terrain-and-unit-strength.ts';
import { realCharOf } from '../best-commander.ts';
import { forceMarker } from '../battle-report-lines-and-force-markers.ts';
import { consumeTerror } from '../evil-terror.ts';
import { reignOfFearHere } from '../../world/the-marks-on-a-province-consecrated-ground-terror-and-enslave.ts';
import { ensureEncounterPlan } from '../../personal-combat/speed-encounter-plans-and-combatants.ts';
import { magicItemsLine } from '../../personal-combat/duels-and-character-encounters.ts';
import { preBattleDuel } from '../pre-battle-duels.ts';
import { narrate } from '../../turn/events-and-their-audiences.ts';
import {
  THE_VERB_A_HERO_ATTACKS_A_HEROS_HOST_WITH,
  THE_VERB_A_HERO_HOLDS_A_PROVINCE_WITH,
} from '../the-facts-a-battles-lines-record.ts';
import type { NarrativeLine } from '../../turn/events-and-their-audiences.ts';
import type { ArmyInABattle, HeroInABattle, ProvinceInABattle } from '../../army-tables.ts';
import type { TurnContext } from '../../turn/context.ts';
import { asItsGuardReadsIt } from '../../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';

/** An item as the War Drum's test reads it: its flag, if it has one (only the War Drum does). */
type AnItemAsTheWarDrumReadsIt = object & { readonly drumTierUp?: unknown };

/** The battle's state: what its stages share by reference, each field written by one stage and read by a later one
 *  (the table above). The titles' merit tally: the units each side has lost, counted once a unit (`_tallyLost`). */
export interface TheStateTheStagesOfTheBattleBetweenHeroesShare {
  _mAtkLost: number;
  _mDefLost: number;
}

/** The first stage of the battle between two heroes' hosts: the set-up, the duel and the sides, to the front's width
 *  and each commander's Archery and Naval. It returns what the later stages read, each final here but the front's
 *  width, and the battle's state. */
export function theSetUpTheDuelAndTheSidesOfTheBattleBetweenHeroes(
  turnContext: TurnContext,
  atk: HeroInABattle,
  def: HeroInABattle,
  prov: ProvinceInABattle,
) {
  const { G } = turnContext;
  // the two heroes and the province as the body's guards read them (each read unguarded below too)
  const theAttackerAsTheGuardsReadHim = asItsGuardReadsIt(atk),
    theDefenderAsTheGuardsReadHim = asItsGuardReadsIt(def),
    theProvinceAsTheGuardsReadIt = asItsGuardReadsIt(prov);
  turnContext._combatSkillProv = asItsGuardReadsIt(theProvinceAsTheGuardsReadIt?.id) ?? null; // battle-series key (cleared at each loop boundary)
  // a resumed battle is another carry-on round (deadlier); a fresh clash resets the count.
  if (theProvinceAsTheGuardsReadIt) {
    if (theAttackerAsTheGuardsReadHim?._resumeBattle && !atk._openingClash)
      prov._carryOnRounds = (prov._carryOnRounds ?? 0) + 1;
    else prov._carryOnRounds = 0;
  }
  ensureEncounterPlan(turnContext, atk);
  ensureEncounterPlan(turnContext, def); // bots/NPCs get auto battle-magic + duel tactics
  // Record both sides' commanders for this province/phase BEFORE any fighting (a duel death or a
  // nested processOrder can clobber _logCtx mid-battle). atk/def are pooled copies but keep the
  // real commander's id, so the per-player report can file the battle under either player's hero.
  recordBattleCmdrs(turnContext, theProvinceAsTheGuardsReadIt?.id, asItsGuardReadsIt(turnContext._logCtx)?.phase, [
    theAttackerAsTheGuardsReadHim?.id,
    theDefenderAsTheGuardsReadHim?.id,
  ]);
  const _fieldIds = noteFieldBattle(turnContext, atk, def, prov); // one battle per phase, for both sides (item 7)
  // TACTICAL L6 (10%/unit) & War Drum (20%/unit) — decide ONCE per side which units fight a tier
  // higher this battle.
  [atk, def].forEach((_ld: HeroInABattle | null | undefined) => {
    if (_ld && Array.isArray(_ld.armies)) {
      const _tac = perkTier(_ld, 'tactical') > 0,
        _drum = activeItems(_ld).some((it: AnItemAsTheWarDrumReadsIt | null | undefined) => it?.drumTierUp);
      _ld.armies.forEach((a: ArmyInABattle | null | undefined) => {
        if (a) {
          a._tacUp = _tac && kcRng() < 0.1;
          a._drumUp = _drum && kcRng() < 0.2;
        }
      });
    }
  });
  const narrative: NarrativeLine[] = [];
  const _atkLA = theAttackerAsTheGuardsReadHim?._lightningAdvanceTurn === G.turn; // MARCH L9 Lightning Advance
  if (_atkLA) {
    (asItsGuardReadsIt(def.armies) ?? []).forEach((a: ArmyInABattle | null | undefined) => {
      if (a) a._laNoTerrain = true;
    });
    narrate(narrative, {
      kind: "the attacker's lightning advance catches the defender unready",
      atkName: atk.name,
      defName: def.name,
    });
  }
  applyWraithTouch(asItsGuardReadsIt(atk.armies) ?? [], asItsGuardReadsIt(def.armies) ?? [], narrative);
  applyWraithTouch(asItsGuardReadsIt(def.armies) ?? [], asItsGuardReadsIt(atk.armies) ?? [], narrative); // Wraith's Touch
  injectPhantoms(atk, realCharOf(turnContext, atk));
  injectPhantoms(def, realCharOf(turnContext, def)); // PHANTASMAL/PHANTOM HOST: spectral doubles join the fight (removed at battle end)
  // Battle-scoped psychic negations start clear each battle (set by pre-battle magic below).
  if (theAttackerAsTheGuardsReadHim) {
    atk._druidNegated = false;
    atk._tacticalNegated = false;
    atk._tacticalHalved = false;
    atk._tacticalMult = 1;
    atk._curseHalveStat = null;
    if (atk._massConfusedTurn === G.turn) atk._tacticalNegated = true;
  }
  if (theDefenderAsTheGuardsReadHim) {
    def._druidNegated = false;
    def._tacticalNegated = false;
    def._tacticalHalved = false;
    def._tacticalMult = 1;
    def._curseHalveStat = null;
    if (def._massConfusedTurn === G.turn) def._tacticalNegated = true;
  }
  const atkArmies: ArmyInABattle[] = asItsGuardReadsIt(atk.armies) ?? [];
  const defArmies: ArmyInABattle[] = asItsGuardReadsIt(def.armies) ?? [];
  // each hero's realm (none for a hero who serves no realm, as JavaScript reads G.players[null])
  const theAttackersRealm = atk.player === null ? undefined : G.players[atk.player],
    theDefendersRealm = def.player === null ? undefined : G.players[def.player];
  // ── TITLE MERIT casualty tally ────
  // army arrays AFTER this function returned — but every branch below ends with
  // `atk.armies=atkArmies.filter(a=>!a._died…)`, so the caller only ever saw SURVIVORS. Both
  // casualty counts were therefore always 0, tm.marshal never left 0, and computeStandings
  // requires merit > 0 to hand out the Title. The battle now reports its own losses.
  // `atkArmies`/`defArmies` keep pointing at the ORIGINAL arrays (filter returns a new one), so a
  // sweep at the end sees every _died flag; the naval branch SPLICES in place, so it tallies
  // first. Phantom copies are illusions and are never counted as real losses.
  const theBattlesState: TheStateTheStagesOfTheBattleBetweenHeroesShare = { _mAtkLost: 0, _mDefLost: 0 };
  const _tallyLost = () => {
    atkArmies.forEach((a: ArmyInABattle | null | undefined) => {
      if (a?._died && !a._phantom && !a._meritTallied) {
        a._meritTallied = true;
        theBattlesState._mAtkLost++;
      }
    });
    defArmies.forEach((a: ArmyInABattle | null | undefined) => {
      if (a?._died && !a._phantom && !a._meritTallied) {
        a._meritTallied = true;
        theBattlesState._mDefLost++;
      }
    });
  };
  let atkTact = atk._tacticalNegated
    ? 0
    : effStat(turnContext, atk, 'tactical') +
      theLevelsAHerosTitlesAddToHisTacticalInABattle((title) => charMinor(turnContext, atk, title));
  if (atk._curseHalveStat === 'tactical') atkTact = Math.floor(atkTact / 2); // LEVEL 6+ PERK — Grand Tactician
  let defTact = def._tacticalNegated
    ? 0
    : effStat(turnContext, def, 'tactical') +
      theLevelsAHerosTitlesAddToHisTacticalInABattle((title) => charMinor(turnContext, def, title));
  if (def._curseHalveStat === 'tactical') defTact = Math.floor(defTact / 2); // LEVEL 6+ PERK — Grand Tactician
  // Tactical bonus only applies in land provinces
  const isPvPSea = prov.terrain === 'sea';
  let atkTactBonus = isPvPSea ? 1 : Math.min(2.0, 1 + atkTact * 0.2); // cap ×2.0
  let defTactBonus = isPvPSea ? 1 : Math.min(2.0, 1 + defTact * 0.2); // cap ×2.0

  // frame how the battle began for PvP too — who advanced, into whose province.
  const _pvpOwnersRealm = prov.owner != null ? G.players[prov.owner] : undefined;
  const _pvpHeldBy = _pvpOwnersRealm ? _pvpOwnersRealm.name : (theDefendersRealm?.name ?? '') || def.name;
  if (!atk._resumeBattle)
    narrate(narrative, {
      kind: 'the attacker moves into the province and a battle is initiated',
      atkName: atk.name,
      attackersRealmName: theAttackersRealm?.name,
      provName: prov.name,
      heldByName: _pvpHeldBy,
    });
  narrate(narrative, { kind: 'the battle for a province begins', provName: prov.name });
  {
    const _ia = magicItemsLine(atk),
      _id = magicItemsLine(def);
    if (_ia) narrate(narrative, _ia);
    if (_id) narrate(narrative, _id);
  } // item 5
  {
    const _kA = kinNarrative(atkArmies, atk, (theAttackersRealm?.race ?? '') || null, {
      kind: "a hero's host in the battle",
      heroName: atk.name,
    });
    if (_kA) narrate(narrative, _kA); // item 7
    const _kD = kinNarrative(defArmies, def, (theDefendersRealm?.race ?? '') || null, {
      kind: "a hero's host in the battle",
      heroName: def.name,
    });
    if (_kD) narrate(narrative, _kD);
  }
  // each side's army strength on the ground: every per-unit modifier (terrain, kinship, Dwarven
  // Bulwark, unit abilities, Druid bond…) — before Tactical, battle lines, force-wide multipliers
  // and the dice. 2026-09-23b: now built with the SAME ctx the battle uses (it had none, so a
  // defending Dwarven host showed 32 here and fought from 48); it equals the ladder's "Units" stage
  // before any pre-battle volleys or spells land.
  // Reign of Fear (2026-10-13): read before the Terror is consumed below — an attacker whose own Terror still
  // grips this province has its Monsters at ×1.5 (an Evil realm only; armStr checks the alignment). Since
  // 2026-10-12 (Toby) it fires only when attacking: a defender never has it.
  const _fearAtk = reignOfFearHere(prov, atk.player),
    _fearDef = false;
  {
    const _dcC = provIsCoastal(G, prov);
    const _aS = Math.round(
      atkArmies.reduce(
        (t, a: ArmyInABattle | null | undefined) =>
          t +
          (a && !a._phantom
            ? armStr(turnContext, a, atk, theAttackersRealm?.alignment, prov.terrain, {
                force: atkArmies,
                enemyForce: defArmies,
                isAttacker: true,
                amphibious: !!atk._amphibiousAssault,
                coastal: _dcC,
                reignOfFear: _fearAtk,
              })
            : 0),
        0,
      ),
    );
    const _dS = Math.round(
      defArmies.reduce(
        (t, a: ArmyInABattle | null | undefined) =>
          t +
          (a && !a._phantom
            ? armStr(turnContext, a, def, def.player != null ? theDefendersRealm?.alignment : null, prov.terrain, {
                force: defArmies,
                enemyForce: atkArmies,
                isAttacker: false,
                coastal: _dcC,
                reignOfFear: _fearDef,
              })
            : 0),
        0,
      ),
    );
    narrate(
      narrative,
      forceMarker(
        turnContext,
        {
          kind: 'a hero, with the realm he serves',
          heroName: atk.name,
          servesARealm: atk.player != null,
          realmName: theAttackersRealm?.name,
        },
        atk.player,
        'attacker',
        atkArmies,
        {
          itsVerbs: 'an attack',
          verbIndex: THE_VERB_A_HERO_ATTACKS_A_HEROS_HOST_WITH,
          provName: prov.name,
          armyStrength: _aS,
          tacticalLevel: atkTact,
        },
      ),
    );
    narrate(
      narrative,
      forceMarker(
        turnContext,
        {
          kind: 'a hero, with the realm he serves',
          heroName: def.name,
          servesARealm: def.player != null,
          realmName: theDefendersRealm?.name,
        },
        def.player,
        'defender',
        defArmies,
        {
          itsVerbs: 'a defence',
          verbIndex: THE_VERB_A_HERO_HOLDS_A_PROVINCE_WITH,
          provName: prov.name,
          armyStrength: _dS,
          tacticalLevel: defTact,
        },
      ),
    );
  }
  // Evil Terror: a province terrorised on a previous turn demoralises whoever defends it now
  // (stacking).
  consumeTerror(prov, defArmies, narrative);
  for (const [_f, _hr, _hn, _ar] of [
    [_fearAtk, theAttackersRealm, atk.name, atkArmies],
    [_fearDef, theDefendersRealm, def.name, defArmies],
  ] as const) {
    // (the Reign of Fear's runner, the alignment abilities' registry's, P1-19au2: a unit it strengthens)
    if (
      _f &&
      _ar.some(
        (a: ArmyInABattle | null | undefined) =>
          a &&
          theFactorARealmsAlignmentStrengthensAUnitByItsReignOfFear(_hr?.alignment, { theUnitType: a.type }) !== null,
      )
    )
      narrate(narrative, {
        kind: 'the province still cowers under a reign of fear',
        provName: prov.name,
        terrorHeroName: _hn,
        reignOfFearMultiplier: REIGN_OF_FEAR_MULT,
      });
  }

  // ── DUEL BEFORE BATTLE (Adventurer Kings rules) ── A commander challenges to a duel if their
  // encounter plan contains an aggressive action (Melee/Fire Arrow/Cast offensive spell) AND no
  // Flee anywhere in the plan. To REFUSE a challenge, the FIRST tactic must be Flee. Flee
  // anywhere else means the commander fights the duel first, then flees. Any Flee in the plan
  // means they won't challenge. Flee always works but reduces that commander's troops by 25%.
  // Otherwise one commander is slain and the loser's troops are reduced by 25%. ── The challenge
  // to single combat ── Driven entirely by each commander's Duel Stance, set in the player
  // portal.
  const _duelOutcome = preBattleDuel(turnContext, atk, def, narrative);
  const atkMorale = _duelOutcome.atkMorale,
    defMorale = _duelOutcome.defMorale;
  // `||.alive===false` — see combatVsNPC: either commander may already be dead, leading a
  // leaderless host into a battle that has run over from an earlier phase.
  const atkCmdrSlain = !!_duelOutcome.atkSlain || asItsGuardReadsIt(atk.alive) === false;
  const defCmdrSlain = !!_duelOutcome.defSlain || asItsGuardReadsIt(def.alive) === false;
  // A commander slain in the duel takes their skills to the grave: the host fights on under the
  // senior surviving captain — demoralised (handled above), and with no Tactical, Archery, Naval,
  // Druid or spellcraft for this battle. Their surviving armies are dispersed AFTER the battle
  // (garrison / retreat / mercenaries) by the end-of-phase fallen-commander sweep.
  if (atkCmdrSlain) {
    narrate(narrative, {
      kind: 'the attacker is cut down before the lines join, and a captain takes command',
      atkName: atk.name,
    });
    atkTact = 0;
    atkTactBonus = 1;
    atk._druidNegated = true;
    atk._tacticalNegated = true;
  }
  if (defCmdrSlain) {
    narrate(narrative, {
      kind: 'the defender is slain before his army, and a veteran takes command',
      defName: def.name,
    });
    defTact = 0;
    defTactBonus = 1;
    def._druidNegated = true;
    def._tacticalNegated = true;
  }

  // once a commander falls in the pre-battle duel, the rest of the report must not keep speaking
  // of "their" forces — the host now answers to the stand-in who took up the banner. These
  // display names are used everywhere below the duel; before the duel (deployment, the duel
  // itself, the death notice) the real names still stand.
  const atkName = atkCmdrSlain ? `${atk.name}'s leaderless host` : atk.name; // item 12
  const defName = defCmdrSlain ? `${def.name}'s leaderless host` : def.name; // item 12
  // Each side as the facts hold it (plan P1-12d22): the record the label above is written from; the prose writes the
  // label (theLabelOfASide). Since P1-12d30 the battle's report lines take it too, since P1-12d31 the pursuit lines, and
  // since P1-12d32 the sea lift's.
  const atkSide = { heroName: atk.name, leaderless: atkCmdrSlain };
  const defSide = { heroName: def.name, leaderless: defCmdrSlain };

  // No challenge issued: nobody is shamed and no duel is fought, whatever the stances were.

  // Province and defender bonuses Item 4: home ground belongs ONLY to the province's founding
  // owner — defending their own capital (×1.2, ×1.5 total with the defender's edge) or attacking
  // to win it back (×1.5).
  const _founderP = homeFounderOf(G, prov.id);
  const isHome = _founderP != null && def.player === _founderP && prov.owner === _founderP;
  const atkHomeP = _founderP != null && atk.player === _founderP && prov.owner !== _founderP;
  const atkHomeBonusP = atkHomeP ? 1.5 : 1;
  if (atkHomeP)
    narrate(narrative, {
      kind: "the attacker fights to win back his realm's capital",
      atkName: atkSide,
      provName: prov.name,
    });
  let defBonus = 1.25 * (isHome ? 1.2 : 1);
  // sd03 Siege Engines (and the race `siege` discoveries rd09 / ro10) — previously sd03 was
  // honoured only in battles against neutral guards, never in realm-vs-realm battles.
  {
    const _sg = whatARealmsDiscoveriesAddToASiege(theAttackersRealm, { theAttackersUnits: atkArmies });
    if (_sg > 0) {
      defBonus = Math.max(1, defBonus - _sg);
      narrate(narrative, {
        kind: "the attacker's siegecraft wears down the defenders' fortifications",
        atkName: atkSide,
        siegecraft: _sg,
      });
    }
  }
  // GOOD — Righteous Defence: +10% when a Good player defends a province they own (the alignment abilities'
  // registry's runner, P1-19au2).
  if (prov.owner === def.player) {
    const _righteous = theFactorARealmsAlignmentStrengthensItsDefenceOfItsOwnGroundBy(theDefendersRealm?.alignment);
    if (_righteous !== null) {
      defBonus *= _righteous;
      narrate(narrative, { kind: "the defender's host defends ground held justly", defName: defSide });
    }
  }
  {
    const _dOwnP =
      prov.owner != null && prov.owner === def.player
        ? theShareARealmsDiscoveriesFortifyItsOwnGroundBy(theDefendersRealm, {
            isItTheRealmsHome: () => homeFounderOf(G, prov.id) === def.player,
          })
        : 0;
    if (_dOwnP > 0) {
      defBonus *= 1 + _dOwnP;
      narrate(narrative, {
        kind: "the defender's realm holds its own ground the harder",
        defName: defSide,
        ownGroundDefencePct: dispFloor(_dOwnP * 100),
      });
    }
  } // defOwn discoveries
  // The commanders' items at the defenders' fortifications: the items' registry's "strength: the defenders'
  // fortifications" (plan P1-19n: the defender's banner at his home, then the attacker's siege mastery), each side's
  // items asked only when an effect would act for it.
  {
    const _fort = theDefendersFortificationsAfterTheCommandersItems(
      { theDefendersFightAtTheirHome: isHome && prov.owner === def.player },
      { theDefendersItems: () => activeItems(def), theAttackersItems: () => activeItems(atk) },
      defBonus,
    );
    defBonus = _fort.theBonus;
    for (const _line of _fort.theLines) {
      if (_line === "the defender's banner rallies the home defence")
        narrate(narrative, { kind: "the defender's banner of the realm rallies the home defence", defName: defSide });
      else
        narrate(narrative, {
          kind: "the attacker's siege mastery halves the defenders' fortifications",
          atkName: atkSide,
        });
    }
  }
  if (isHome) narrate(narrative, { kind: 'the defenders fight on home ground' });
  // (2026-09-23d: "📊 X leads the defense: Tactical N" retired — the deployment line and the ladder both name it.)

  // Fanaticism: each side's chance of zeal its realm's alignment gives (the alignment abilities' registry, P1-19au1)
  const atkAlign = theAlignmentASideFightsUnder(theAttackersRealm?.alignment);
  // (The Wyverns' Dread, −15% to the other side's fanaticism, was retired with the unit abilities,
  // 2026-10-11: Terror From Above now bears on the enemy's strongest front unit, in battleFaceSide.)
  const _atkFanPct = Math.max(
    0,
    theChanceOfZealARealmsAlignmentGivesASide(theAttackersRealm?.alignment) +
      whatARealmsDiscoveriesAddToASidesFanaticism(theAttackersRealm, {
        theSide: 'atk',
        theGround: prov.terrain,
        theForce: atkArmies,
      }),
  ); // fanatic discoveries
  let _defFanPct = Math.max(
    0,
    theChanceOfZealARealmsAlignmentGivesASide(theDefendersRealm?.alignment) +
      whatARealmsDiscoveriesAddToASidesFanaticism(theDefendersRealm, {
        theSide: 'def',
        theGround: prov.terrain,
        theForce: defArmies,
      }),
  );
  // DIVINE — Consecrate: defenders on consecrated ground are TWICE as likely to be seized by
  // fanatical zeal (they fight before the altars of their gods).
  const _consecratedHere = def.player != null && isConsecrated(theDefendersRealm, prov.id) && prov.owner === def.player;
  if (_consecratedHere) {
    _defFanPct = theChanceOfZealOfADefenderOnConsecratedGround({ theChance: _defFanPct });
  }
  // Both sides roll, the attacker first, always (even at 0, and when a fervour wins).
  const atkFanatic = kcRng() < _atkFanPct;
  const defFanatic = kcRng() < _defFanPct;
  // Strongest fervour counts (max) — the old precedence chain let a ×1.3 zeal roll mask the
  // skeletal bonus once that bonus rose above it. Skeletal armies fight with fervour under any Undead
  // commander, the more under the king in person; an Evil host with Monsters fights with savage fury.
  // (Wild Ferocity, the Druidic ×1.25 with any Creature, retired 2026-10-13.)
  const atkFervour = theFervourOfASide(theAttackersRealm?.alignment, {
    isItSeizedByZeal: atkFanatic,
    isItLedByTheKing: atk.isKing,
    theForce: atkArmies,
  });
  const defFervour = theFervourOfASide(theDefendersRealm?.alignment, {
    isItSeizedByZeal: defFanatic,
    isItLedByTheKing: def.isKing,
    theForce: defArmies,
  });
  const atkSkelFanatic = atkFervour.theAbilitiesThatStirredIt.includes('skeletal-fervour') && atk.isKing;
  const defSkelFanatic = defFervour.theAbilitiesThatStirredIt.includes('skeletal-fervour') && def.isKing;
  const atkSkelHero = atkFervour.theAbilitiesThatStirredIt.includes('skeletal-fervour') && !atk.isKing;
  const defSkelHero = defFervour.theAbilitiesThatStirredIt.includes('skeletal-fervour') && !def.isKing;
  const atkEvilMonster = atkFervour.theAbilitiesThatStirredIt.includes('savage-fury');
  const defEvilMonster = defFervour.theAbilitiesThatStirredIt.includes('savage-fury');
  const atkFanMult = atkFervour.theFactor;
  const defFanMult = defFervour.theFactor;
  if (atkSkelFanatic)
    narrate(narrative, {
      kind: "a side's skeletal legions fight with fanaticism under their undead king",
      sideName: atkSide,
      undeadKingFanaticismPct: Math.round((UNDEAD_SKEL_KING_FAN - 1) * 100),
    });
  if (defSkelFanatic)
    narrate(narrative, {
      kind: "a side's skeletal legions fight with fanaticism under their undead king",
      sideName: defSide,
      undeadKingFanaticismPct: Math.round((UNDEAD_SKEL_KING_FAN - 1) * 100),
    });
  if (atkEvilMonster && !atkFanatic)
    narrate(narrative, { kind: "a side's monsters are driven to savage fury", sideName: atkSide });
  if (defEvilMonster && !defFanatic)
    narrate(narrative, { kind: "a side's monsters are driven to savage fury", sideName: defSide });
  if (atkSkelHero)
    narrate(narrative, {
      kind: "a side's skeletal legions know no fear",
      sideName: atkSide,
      undeadHeroFanaticismPct: Math.round((UNDEAD_SKEL_HERO_FAN - 1) * 100),
    });
  if (defSkelHero)
    narrate(narrative, {
      kind: "a side's skeletal legions know no fear",
      sideName: defSide,
      undeadHeroFanaticismPct: Math.round((UNDEAD_SKEL_HERO_FAN - 1) * 100),
    });
  if (atkFanatic && !atkSkelFanatic && !atkSkelHero)
    narrate(narrative, { kind: "the attacker's forces fight with fanatical zeal", atkName: atkSide });
  if (defFanatic && !defSkelFanatic && !defSkelHero && _consecratedHere)
    narrate(narrative, {
      kind: 'the defenders fight with fanatical zeal on consecrated ground',
      provName: prov.name,
      defName: defSide,
    });
  else if (defFanatic && !defSkelFanatic && !defSkelHero)
    narrate(narrative, { kind: "the defender's forces fight with fanatical zeal", defName: defSide });

  // Terrain sets the front-line width — how many units fight in the front row (the rest form a
  // reduced-effect reserve). This is the ONE source of truth for the front width, used by BOTH
  // the narrative here and the front-line strength computation below, so they can never disagree.
  // mechanic used a fixed 3 — the "battlefront one wide vs three wide" inconsistency Toby saw.)
  const pvpFront = rollBattleWidth(prov.terrain); // 2026-10-11: rolled once per battle, shared by both sides; the scout may take one wider or narrower (battleDeploy); the report names it with the grid

  // Compute strengths — mirrors combatVsNPC with full bonuses
  const MISSILE_A = new Set(KC_UNIT_CLASS.missile);
  const atkArch = atkCmdrSlain ? 0 : effStat(turnContext, atk, 'archery');
  const atkArchBonus = 1 + atkArch * ARCHERY_MISSILE_PCT; // +5%/level (2026-09-23b) · sd07 Fire Arrows now via armStr (unitStr missile)
  const defArch = defCmdrSlain ? 0 : effStat(turnContext, def, 'archery');
  const defArchBonus = 1 + defArch * ARCHERY_MISSILE_PCT;
  let atkNav = atkCmdrSlain ? 0 : effStat(turnContext, atk, 'naval');
  if (atk._curseHalveStat === 'naval') atkNav = Math.floor(atkNav / 2);
  const atkNavBonus = 1 + atkNav * 0.2;
  let defNav = defCmdrSlain ? 0 : effStat(turnContext, def, 'naval');
  if (def._curseHalveStat === 'naval') defNav = Math.floor(defNav / 2);
  const defNavBonus = 1 + defNav * 0.2;
  const atkAlign2 = theAlignmentARealmReadsAs(theAttackersRealm?.alignment);
  const defAlign2 = theAlignmentARealmReadsAs(theDefendersRealm?.alignment);

  const pvpTerrain = prov.terrain;
  const pvpIsLand = pvpTerrain !== 'sea';
  const _pvpCoastal = provIsCoastal(G, prov); // Sea Giants' Tidal Might
  return {
    G,
    theAttackerAsTheGuardsReadHim,
    theDefenderAsTheGuardsReadHim,
    theProvinceAsTheGuardsReadIt,
    _fieldIds,
    narrative,
    _atkLA,
    atkArmies,
    defArmies,
    theAttackersRealm,
    theDefendersRealm,
    theBattlesState,
    _tallyLost,
    atkTact,
    defTact,
    isPvPSea,
    atkTactBonus,
    defTactBonus,
    _fearAtk,
    _fearDef,
    atkMorale,
    defMorale,
    atkCmdrSlain,
    defCmdrSlain,
    atkName,
    defName,
    atkSide,
    defSide,
    atkHomeBonusP,
    defBonus,
    atkAlign,
    _consecratedHere,
    atkSkelFanatic,
    defSkelFanatic,
    atkSkelHero,
    defSkelHero,
    atkEvilMonster,
    defEvilMonster,
    atkFanMult,
    defFanMult,
    pvpFront,
    MISSILE_A,
    atkArch,
    atkArchBonus,
    defArch,
    defArchBonus,
    atkNav,
    atkNavBonus,
    defNav,
    defNavBonus,
    atkAlign2,
    defAlign2,
    pvpTerrain,
    pvpIsLand,
    _pvpCoastal,
  };
}
