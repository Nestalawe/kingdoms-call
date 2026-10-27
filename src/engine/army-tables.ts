import {
  KC_ITEM_UNCAPPED_SKILLS,
  KC_QUALITY_TIERS,
  KC_SKILL_LABELS,
  KC_UNIT_CLASS,
  PRIMAL_ARMY_DEFS_P,
} from '../content/kingdoms-call-data.ts';
import type { HumanoidUnitType } from '../content/kingdoms-call-data.ts';
import type { Army, Character, GameState, Grave, Province } from '../schemas/saved-game-state.ts';

// ── A UNIT AND A HERO IN A BATTLE ────
// A battle writes marks on its units and its commanders that last for that battle only, and wipes them at the battle's
// end, before the state is saved (2026-09-27: `_flakTargeted` was never wiped, so it was saved, and a flyer harried
// once was immune to Flak Screen for the rest of the game). The turn's marks (below each type's battle marks) last the
// turn, and the new turn wipes them before the save. Neither kind is in the saved state's schema: a save that holds
// one fails the strict parse in the schemas' tests. An Army passes where an ArmyInABattle is wanted (each mark is
// optional), so no caller changes.
/** A unit in a battle: an army and the marks the battle writes on it. */
export type ArmyInABattle = Army & {
  /** The strength the enemy's arrows have taken off it this battle (missileCapReached caps it). */
  _archeryRed?: number;
  /** The strength it lost before the clash (Flak Screen, a pre-battle strike). */
  _tempStrReduction?: number;
  /** A flyer a gyrocopter has already harried this battle (applyFlakScreen). */
  _flakTargeted?: boolean;
  /** A unit forced below Green (demoteOrDisband): its force drops it, and no grave records it. */
  _disbanded?: boolean;
  /** A spectral double's fighting copy (injectPhantoms): the tag of the unit it mirrors. clearPhantomCopies drops
   *  every copy at the battle's end. */
  _phantomOf?: string | undefined;
  // The turn's marks (armStr reads them): written during the turn, wiped by the new turn before the save.
  /** Lightning Advance's ambushed side (March 9): no terrain bonus. Set by both battles; wiped by the battle's end and
   *  the new turn. */
  _laNoTerrain?: boolean;
  /** A strength loss meant to last the whole turn (applyPrebattleDamage). Set by nothing today (Parked: the dead
   *  marks); wiped by the new turn. */
  _turnStrReduction?: number;
  // The turn's marks Early Winter reads (plan P1-10b7).
  /** A unit summoned for the turn (an elemental of Summon Elemental, the Grove of Awaken Grove): it draws no wage and
   *  is never disbanded for one. Set where it is summoned; the new turn removes the unit itself. */
  _temporary?: boolean;
};
/** A hero in a battle: a character and the marks the battle writes on him. */
export type HeroInABattle = Character & {
  /** How much of his Tactical bonus is left (tacMulted): 1 unless Telekinetic Storm halved it to 0.5. */
  _tacticalMult?: number;
  // The turn's marks (armStr reads them): written during the turn, wiped by the new turn before the save.
  /** Oratory's quality tiers (1, or 2 with Words of Awe): set by the spell; armStr reads `true` as 1. Wiped by the new
   *  turn. */
  _oratoryBoost?: number | boolean;
  /** Phantasmal Armies' bonus to the units he leads (0.1 a caster level). Set by nothing today (Parked: the dead
   *  marks); wiped by both battles' ends and the new turn. */
  _phantasmalBonus?: number;
  /** The skill a Curse halves this battle ('tactical', 'druid' or 'naval': bestCurseSkill). Cleared at each battle's
   *  start and set by its pre-battle magic, in both battles; wiped by the new turn. */
  _curseHalveStat?: string | null;
  /** Psychic Blast has negated his Druid this battle. Cleared at each battle's start and set by its pre-battle magic,
   *  in both battles; wiped by the new turn. */
  _druidNegated?: boolean;
  // The turn's marks Early Winter reads (plan P1-10b7): the Charm spell sets all three when it seizes an enemy hero's
  // command for the rest of the turn (beside the saved _charmTempControl and _charmOriginalPlayer).
  /** The phase from which he acts on his charmer's orders (actingThisPhase). Wiped by Early Winter, when he returns
   *  to his own lord. */
  _charmControlFrom?: number;
  /** The realm whose hero cast the Charm. Wiped by Early Winter and the new turn. */
  _charmedByPlayer?: number | null;
  /** The phase the Charm took hold. Wiped by Early Winter and the new turn. */
  _charmedForPhase?: number;
};
/** A province in a turn: a province and the mark a battle writes on it. */
export type ProvinceInABattle = Province & {
  /** Raiders' Muster: the turn an orc victory was won here (set by both battles). Early Winter reads it that turn,
   *  adding a Goblin Horde to an orc realm's garrison, and wipes it then (an older turn's too). */
  _raidersMuster?: number;
};

// ════
// MASTER UNIT TABLES — single source of truth
// ════
// They were identical by luck, not by construction: editing recruitment price without editing the
// wage table would silently make a unit cost one amount to raise and another to keep. Every one of
// those names is now an alias of the master below. DO NOT re-inline a local copy — add entries here
// instead.
//
// Cost is BOTH the recruitment price and the per-turn wage: a unit costs its price again every turn
// it exists. 2026-10-11 (Toby, the army roster): Forest Wardens 3→2, Shadow Archers 3→4, Ironwood
// Crossbows 3→2; their base strengths moved with them (KC_UNIT_BASE_STR). tests/roster holds both.
export const ARMY_COST_MASTER: Record<string, number> = {
  // ── Human ──
  'Shieldwall Levies': 2,
  'Free Lances': 3,
  'Yeoman Longbows': 2,
  'Gilded Lances': 4,
  'Human Garrison': 1,
  'Noble Griffons': 4,
  'Galleon Fleet': 3,
  'Corsair Fleet': 3,
  'Men-at-Arms': 3,
  // ── Elven ──
  'Elven Bowmen': 3,
  'Forest Wardens': 2,
  'Shadow Archers': 4,
  'Elven Garrison': 1,
  'Eagle Riders': 4,
  'Elven Galleys': 3,
  'Whale Cohort': 3,
  'Stag Riders': 3,
  // ── Dwarven ──
  'Dwarven Guard': 3,
  'Ironwood Crossbows': 2,
  'Mountain Guns': 4,
  'Dwarf Garrison': 1,
  'Gnomish Gyrocopters': 3,
  'Dwarf Ironclads': 4,
  'Ironhoof Rams': 3,
  // ── Orcish ──
  'Warg Riders': 3,
  'Orc Berserkers': 3,
  'Goblin Horde': 2,
  'Orc Garrison': 1,
  'Wyvern Riders': 4,
  'Orcish Longships': 3,
  'Black Arrows': 2,
  // Primal units: their cost is written ONCE, in PRIMAL_ARMY_DEFS_P (kingdoms-call-data.ts), and
  // added below — 2026-09-27, it used to be re-typed here and kept "in step" by hand.
} satisfies Record<HumanoidUnitType, number>;
Object.entries(PRIMAL_ARMY_DEFS_P).forEach(([t, d]) => {
  ARMY_COST_MASTER[t] = d.cost;
});
// 2026-10-11 (Toby, the army roster): land move rates by kind — garrisons 1; line foot, archers and
// guns 2; heavy horse and the special foot (Wardens, Berserkers, Shadow Archers) 3; light horse 4;
// the winged riders 5 (Gyrocopters 4). tests/roster holds this table to the decided roster.
export const ARMY_SPEED_MASTER: Record<string, number> = {
  // ── Human ──
  'Shieldwall Levies': 2,
  'Free Lances': 4,
  'Yeoman Longbows': 2,
  'Gilded Lances': 3,
  'Human Garrison': 1,
  'Noble Griffons': 5,
  'Galleon Fleet': 3,
  'Corsair Fleet': 4,
  'Men-at-Arms': 2,
  // ── Elven ──
  'Elven Bowmen': 2,
  'Forest Wardens': 3,
  'Shadow Archers': 3,
  'Elven Garrison': 1,
  'Eagle Riders': 5,
  'Elven Galleys': 4,
  'Whale Cohort': 5,
  'Stag Riders': 4,
  // ── Dwarven ──
  'Dwarven Guard': 2,
  'Ironwood Crossbows': 2,
  'Mountain Guns': 2,
  'Dwarf Garrison': 1,
  'Gnomish Gyrocopters': 4,
  'Dwarf Ironclads': 2,
  'Ironhoof Rams': 3,
  // ── Orcish ──
  'Warg Riders': 4,
  'Orc Berserkers': 3,
  'Goblin Horde': 2,
  'Orc Garrison': 1,
  'Wyvern Riders': 5,
  'Orcish Longships': 3,
  'Black Arrows': 2,
  // Primal units: speed written ONCE, in PRIMAL_ARMY_DEFS_P (kingdoms-call-data.ts), added below.
} satisfies Record<HumanoidUnitType, number>;
Object.entries(PRIMAL_ARMY_DEFS_P).forEach(([t, d]) => {
  ARMY_SPEED_MASTER[t] = d.speed;
});
// Top-level copy of the primal sea beasts for report/order-data builders that run outside the
// resolution scope. Built from KC_UNIT_CLASS (kingdoms-call-data.ts), like PRIMAL_SEA_TYPES.
export const PRIMAL_SEA_NAMES = new Set(KC_UNIT_CLASS.primalSea);
// ── DISPLAY ROUNDING ────
// Battle maths is done in floats (flank ×0.5, tactical ×1.2, dice = kcRng()*range), but a
// player report should never show a decimal — "roll 7.2384719283" is noise, not information. n0()
// is a DISPLAY-ONLY rounder: use it on every number interpolated into narrative/log text. It must
// NEVER be used on a value that feeds back into the maths, and it is deliberately NOT applied to
// multipliers — "× tactical ×1.2" rounded to "×1" would be meaningless.
export function n0(x: unknown): string {
  const v = Number(x);
  return Number.isFinite(v) ? String(Math.round(v)) : String(x);
}
// ════
// UNIT ABILITIES — single source of truth
// ════
// Every humanoid unit has one always-on ability. They hook into four places: armStr (force
// composition), the pre-battle archery phase, the Flak Screen phase, and the casualty/retreat
// block. Keep the sets below in sync with UNIT_BASE_STR — there is no separate ability table. ──
// UNIT QUALITY ── Green is the LOWEST tier; there is no rank below it. A unit forced to drop below
// Green does not die and does not become mercenaries — it DISBANDS: the men melt back into the
// population and the unit ceases to exist. Disbanded units are never recorded in battle graves
// (nobody was killed) and can never be raised as skeletons.
export const QUALITY_TIERS: string[] = KC_QUALITY_TIERS.slice();
// Returns true if the unit disbanded. Callers MUST drop units flagged _disbanded from their force
// and must NOT pass them to recordBattleGraves.
export function demoteOrDisband(a: ArmyInABattle | null | undefined): boolean {
  if (!a) return false;
  const qi = QUALITY_TIERS.indexOf(a.quality);
  if (qi > 0) {
    a.quality = QUALITY_TIERS[qi - 1] ?? a.quality;
    return false;
  }
  a._disbanded = true;
  return true;
}
export function disbandLine(
  owner: string | null | undefined,
  a: Pick<Army, 'type' | 'unitName'>,
  clause?: string | null,
): string {
  // 2026-09-23d: a unit NAMED "the …" reads "the Pale Shades (Vervain's Shadow Archers)", never
  // "Vervain's the Pale Shades" (same rule as unitRef). `clause` (2026-10-12): whom they fought, after the name.
  const _core =
    a.unitName && /^the\s/i.test(a.unitName)
      ? `${a.unitName} (${owner ? owner + "'s " : ''}${a.type})`
      : `${owner ? owner + "'s " : ''}${a.unitName ? a.unitName + ' (' + a.type + ')' : a.type}`;
  return `— ${_core}${clause ? `, ${clause},` : ''} have had enough — the survivors slip away to their villages and the unit disbands for good.`;
}
// "Atk's Warg Riders" / "the Red Hand (Atk's Eagle Riders)" — an owner plus a unit's name or type,
// never "Atk's the Red Hand" (2026-09-23d). Module level since 2026-10-11 (they were inside runTurn).
export function ownedUnitName(
  ownerName: string | null | undefined,
  a: Pick<Army, 'type' | 'unitName'> | null | undefined,
): string {
  if (a?.unitName && /^the\s/i.test(a.unitName))
    return `${a.unitName} (${ownerName ? ownerName + "'s " : ''}${a.type})`;
  const nameOrType = a ? a.unitName || a.type : '';
  return `${ownerName ? ownerName + "'s " : ''}${nameOrType || 'unit'}`;
}
export function unitRef(ownerName: string | null | undefined, a: Pick<Army, 'type' | 'unitName' | 'quality'>): string {
  // 2026-09-23d: "the Pale Shades (Vervain's Shadow Archers, Average)" — never "Vervain's the Pale Shades".
  if (a.unitName && /^the\s/i.test(a.unitName))
    return `${a.unitName} (${ownerName ? ownerName + "'s " : ''}${a.type}, ${a.quality})`;
  const core = a.unitName ? `${a.unitName} (${a.type}, ${a.quality})` : `${a.quality} ${a.type}`;
  return ownerName ? `${ownerName}'s ${core}` : core;
}

// ── SKILLS ────
// TRAINING gives its benefit up to level 5; levels 6-9 buy mastery perks and mastery orders
// instead. Magic items and the Crown of Command aura stack above that ONLY for melee and archery,
// to the skill ceiling of 9. Those two are special: the engine already gives levels past 5 a real
// meaning there — meleeRaw/archeryRaw drive the damage roll, to-hit climbs +5% per level past 5,
// and perkTier reads the same scale. Every other skill (tactical, naval, sage, druid, spy, thief,
// explorer, march and the five magic schools) has no defined behaviour above 5, and the engine is
// tuned around that cap in a dozen places, so their bonuses still stop at 5.
export const SKILL_BENEFIT_CAP = 5,
  SKILL_MAX = 9;
// the five magic schools JOIN melee and archery as skills whose item and aura bonuses stack on top
// of a trained 5, to the ceiling of 9. What that buys is CAST CHANCE only — +10% a level to the 95%
// ceiling — because every spell EFFECT is computed on `Math.min(lvl,5)`
// (pcCastCombatSpell's `lvlEff`, the action phase's `spellLevelEff`, the Bless ward, Phantasmal
// Armies). The per-turn cast limit already tops out at 3 from level 4, and the per-fight limit at 2
// from level 2, so neither moves either. A relic focus therefore makes a master more RELIABLE,
// never more powerful — which is the distinction Toby asked for.
export const ITEM_UNCAPPED_SKILLS = new Set(KC_ITEM_UNCAPPED_SKILLS);
export const SKILL_LABELS = { ...KC_SKILL_LABELS };
// ── ONE-SOURCE ENGINE TABLES (2026-09-27, Toby: collapse to one source) ──────────────────────────
// GM-only tables that had been re-typed at every site that needed them. Each old site now reads
// the one below. (Tables BOTH portals need live in kingdoms-call-data.ts as KC_*.)
// Personal-combat tactic codes a duel keeps from an encounter plan (Steal, Talk, Scout and the rest
// are lair-only and dropped). FI / FIRE / ARROW is ARCHERY — the code the player portal writes for
// "Fire Arrow" and that autoEncounterPlan writes for every ranged hero. Four of the five copies of
// this list omitted it, so an archer's shots were silently deleted from Encounter Character,
// breaking-ranks, caught-thief and failed-charm duels (DEV_LOG §277). AR / ARCHERY are not engine
// codes (pcAct has no case for them — they fall through to melee); kept so an old plan still acts.
export const COMBAT_ONLY_TACTICS = new Set([
  'ME',
  'MELEE',
  'AR',
  'ARCHERY',
  'FI',
  'FIRE',
  'ARROW',
  'CA',
  'SPELL',
  'FL',
  'FLEE',
]);
// Spells that also work as BATTLE MAGIC (pre-battle phase of an army battle).
export const BATTLE_MAGIC_SPELL_NAMES = [
  'Holy Symbol',
  'Spiritwrack',
  'Fireball',
  'Telekinetic Storm',
  'Lightning Bolt',
  'Curse',
  'Psychic Blast',
  'Control Undead',
];
// Chance an army is seized by fanatical zeal, by the realm's alignment.
export const FANATIC_CHANCE_BY_ALIGN = {
  Divine: 0.5,
  Good: 0.4,
  Druidic: 0.2,
  Neutral: 0.1,
  Pagan: 0.15,
  Evil: 0.25,
  Undead: 0.0,
};
// Lair guardian grade as a number ('' = unknown). The bot's lair ladder and its target sorting.
export const GUARDIAN_POWER_RANK = { '': 0, Weak: 1, Moderate: 2, Powerful: 3, Legendary: 4 };
// Steal from a lair: the success penalty (percentage points) for the guardian's grade.
export const STEAL_TIER_PEN = { Weak: 0, Moderate: 15, Powerful: 30, Legendary: 45 };
// The one attack spell a caster reaches for in each school (NPC guards, and duels with no named spell).
export const NPC_SCHOOL_SPELL = {
  elemental: 'Lightning Bolt',
  necromancy: 'Hand of Death',
  white: 'Holy Symbol',
  psychic: 'Psychic Blast',
  illusory: 'Mirror Image',
};

// ── ONCE PER TURN (mastery) ── the 20 L7/L9 mastery ORDERS; each may be attempted only once per
// turn per character (mirrors the mastery-spell once-per-turn rule in the cast handler).
export const MASTERY_ORDER_KEYS = new Set([
  'challenge',
  'rampage',
  'rain_of_arrows',
  'snipers_mark',
  'feigned_retreat',
  'grand_stratagem',
  'forced_march',
  'lightning_advance',
  'blockade',
  'raid_coast',
  'research_breakthrough',
  'grand_design',
  'sabotage',
  'assassinate',
  'grand_heist',
  'vanish',
  'awaken_grove',
  'wild_calling',
  'chart_unknown',
  'discover_ruin',
]);
export const MASTERY_ORDER_LABEL = {
  challenge: 'Challenge',
  rampage: 'Rampage',
  rain_of_arrows: 'Rain of Arrows',
  snipers_mark: "Sniper's Mark",
  feigned_retreat: 'Feigned Retreat',
  grand_stratagem: 'Grand Stratagem',
  forced_march: 'Forced March',
  lightning_advance: 'Lightning Advance',
  blockade: 'Blockade',
  raid_coast: 'Raid the Coast',
  research_breakthrough: 'Research Breakthrough',
  grand_design: 'Grand Design',
  sabotage: 'Sabotage',
  assassinate: 'Assassinate',
  grand_heist: 'Grand Heist',
  vanish: 'Vanish',
  awaken_grove: 'Awaken Grove',
  wild_calling: 'Wild Calling',
  chart_unknown: 'Chart the Unknown',
  discover_ruin: 'Discover Lost Ruin',
};
// Alignment-signature orders, by engine action key. Used with MASTERY_ORDER_KEYS to decide what a
// charmed enemy hero may not be made to do.
export const ALIGNMENT_ORDER_KEYS = new Set(['consecrate', 'call_to_arms', 'broker', 'harvest_field', 'rite']); // Awaken the Wild and Call from the Pit removed 2026-10-12 (item 22)
// the character-targeted hostile spells a seized enemy hero will not aim at their ORIGINAL lord's
// characters (the Encounter order is refused on the same grounds).
export const CHARMED_NO_TURN_SPELLS = new Set([
  'Psychic Blast',
  'Telekinetic Storm',
  'Curse',
  'Charm',
  'Control Undead',
  'Dominate',
]);

// Spells whose named CHARACTER target must be standing in the caster's own province. Each of these
// branches already refuses an absent target — but it did so BELOW the cast roll, so a caster whose
// target had marched away (most often a general on Defend who rode out at the top of the phase)
// burned the roll and the per-turn casting slot on a spell that was never worked. The guard is
// hoisted above the roll instead (DEV_LOG: "a guard after the cast roll is not a guard").
// Keyed by SPELL_DEFS_P.fn. Province-targeted spells and the remote scry (Clairvoyance) are absent.
export const SPELL_FNS_NEED_COLOCATED_TARGET = new Set([
  'psychic_charm',
  'psychic_blast',
  'psychic_storm',
  'psychic_oratory',
  'illusory_phantasmal',
  'necromancy_control',
  'necromancy_curse',
  'white_judgment',
  'psychic_massconfusion',
  'psychic_dominate',
  'elemental_chainlightning',
]);

// SAFE START (2026-09-29): a setup option. While on, no realm may Treat or declare war until the
// orders for Turn SAFE_START_TURN — player declarations are discarded (with a private notice) and bots
// make none. `turn` is the turn being resolved (games.turn when its orders are run).
export const SAFE_START_TURN = 6;
export function safeStartLocked(gs: Pick<GameState, 'safeStart'> | null | undefined, turn: unknown): boolean {
  return !!gs?.safeStart && (Number(turn) || 0) < SAFE_START_TURN;
}
// BOTS' reading of Safe Start (2026-09-29): true while even NEXT turn is still locked, so no war can
// touch the realm before its next orders — the bot posts no defenders and leaves the capital
// ungarrisoned, putting every hero and levy into expansion. On the last locked turn (Turn
// SAFE_START_TURN−1) this turns false, so the defenders and the capital garrison are raised in time
// for the first turn on which war may be declared.
export function botSafeWindow(G: Pick<GameState, 'safeStart' | 'turn'> | null | undefined): boolean {
  return safeStartLocked(G, (G?.turn ?? 0) + 1);
}

// ── LEGACY UNIT-TYPE MIGRATION ────
// Army type is stored as a raw string on every army object, inside the game_state JSON in Supabase.
// The five Human/Dwarven units below were renamed in v2026.09.06-1601. Any game saved before that
// still carries the old strings, and every lookup table (cost, speed, strength, terrain, druid
// level, missile/flying/sea sets, name pools) is keyed by the new ones — so an unmigrated save
// would silently fall back to default stats. This walks a loaded state and rewrites them. Safe to
// run repeatedly: unknown//already-migrated names pass through untouched.
export const LEGACY_UNIT_RENAMES: Readonly<Record<string, string>> = {
  Infantry: 'Shieldwall Levies',
  Cavalry: 'Free Lances',
  Longbowmen: 'Yeoman Longbows',
  Knights: 'Gilded Lances',
  Crossbowmen: 'Ironwood Crossbows',
  // 2026-10-13 (Toby, Creatures and Monsters II): Giant Eagles became Thunderbirds (the elves already ride
  // eagles) and Kraken Tentacles Eldritch Kraken; Leviathan Pods were replaced by the Dread Hydras, a LAND
  // Monster, so a running game's Leviathan companies become Eldritch Kraken (a land beast cannot swim) and
  // Leviathan waters Kraken waters (LEGACY_RACE_RENAMES below).
  'Giant Eagles': 'Thunderbirds',
  'Kraken Tentacles': 'Eldritch Kraken',
  'Leviathan Pods': 'Eldritch Kraken',
};
// A province's (or a company's) primal race string, where the beast it names was renamed.
export const LEGACY_RACE_RENAMES: Readonly<Record<string, string>> = {
  'Primal:Giant Eagle': 'Primal:Thunderbird',
  'Primal:Leviathan': 'Primal:Kraken',
};
// The saved state as migrateLegacyUnitNames reads it: today's, or an older save's, so any field it reads may be
// missing (the guards below say so), and a hero's grave is today's plus the companies he led (`armies`), which nothing
// writes today (an older save's field, or dead code). P1-15 types the old saves; until then their shape is
// declared here, with only the fields this function reads. Today's GameState passes.
interface UnitOfAnOldSave {
  type?: string | null;
  race?: string | null;
}
type UnitsOfAnOldSave = readonly (UnitOfAnOldSave | null | undefined)[] | null | undefined;
interface ProvinceOfAnOldSave {
  race?: string | null;
  garrisonArmies?: UnitsOfAnOldSave;
  neutralDefenders?: UnitsOfAnOldSave;
  armyTypes?: string[] | null;
  battleGraves?: UnitsOfAnOldSave;
}
interface StateOfAnOldSave {
  readonly characters?: readonly { readonly armies?: UnitsOfAnOldSave }[] | null;
  readonly world?: { readonly provinces?: readonly (ProvinceOfAnOldSave | null | undefined)[] | null } | null;
  readonly heroGraveyard?: readonly ((Grave & { readonly armies?: UnitsOfAnOldSave }) | null | undefined)[] | null;
}
export function migrateLegacyUnitNames(
  state: StateOfAnOldSave | null | undefined,
): StateOfAnOldSave | null | undefined {
  if (!state || typeof state !== 'object') return state;
  let n = 0;
  const fixArmyList = (list: UnitsOfAnOldSave) => {
    (list ?? []).forEach((a) => {
      const toType = a?.type ? LEGACY_UNIT_RENAMES[a.type] : undefined;
      if (a && toType) {
        a.type = toType;
        n++;
      }
      const toRace = a?.race ? LEGACY_RACE_RENAMES[a.race] : undefined;
      if (a && toRace) {
        a.race = toRace;
        n++;
      }
    });
  };
  (state.characters ?? []).forEach((c) => {
    fixArmyList(c.armies);
  });
  (state.world?.provinces ?? []).forEach((p) => {
    if (!p) return;
    const toRace = p.race ? LEGACY_RACE_RENAMES[p.race] : undefined;
    if (toRace) {
      p.race = toRace;
      n++;
    }
    fixArmyList(p.garrisonArmies);
    fixArmyList(p.neutralDefenders);
    if (Array.isArray(p.armyTypes))
      p.armyTypes = p.armyTypes.map((t) => {
        const to = LEGACY_UNIT_RENAMES[t];
        if (to) {
          n++;
          return to;
        }
        return t;
      });
    (p.battleGraves ?? []).forEach((g) => {
      const to = g?.type ? LEGACY_UNIT_RENAMES[g.type] : undefined;
      if (g && to) {
        g.type = to;
        n++;
      }
    });
  });
  (state.heroGraveyard ?? []).forEach((g) => {
    fixArmyList(g?.armies);
  });
  if (n > 0) console.log(`[migration] renamed ${String(n)} legacy unit reference(s) to the current names.`);
  return state;
}
