// The code the battle rows have taken holds no number, and every file and bots' function the battles' counts list is
// there (B-06, T7, the rules pulled out: Runs 3c and 3d, the battles). Each function or table the family's rows have
// taken holds no number other than 0 and 1 (the battles' factors, bands and tables are read from content's rows
// instead). Each row adds what it takes to TAKEN (the bots' race row B-06ah took the first). With them, the ratchet's
// three counts of the battles' numbers (tools/ratchet.ts's battleNumbersInEngine over src/engine/battle/ but its facts'
// files and two files of src/engine/units/, personalCombatNumbersInEngine over src/engine/personal-combat/ but its
// facts' file, and battleNumbersInTheBots over the bots' battle estimate's listed functions, by their helper
// battleNumbersByFunction), which only fall. A count of listed files or functions can be lowered by moving a number out
// of them, so each one listed must still be there: a function a row empties stays in its list at 0.
//
// Level 0 (static): the files' syntax trees; nothing runs.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { ROOT } from '../../tools/build.ts';
import {
  battleNumbersByFunction,
  battleNumbersInEngine,
  battleNumbersInTheBots,
  compare,
  countsBattleNumbers,
  countsPersonalCombatNumbers,
  personalCombatNumbersInEngine,
  readBaseline,
  THE_BATTLES_FILES_IN_THE_UNITS_FOLDER,
  THE_BATTLES_FUNCTIONS_IN_THE_BOTS,
  theCodeFiles,
} from '../../tools/ratchet.ts';

/** The top level of a file: what no function or table holds. */
const TOP = '(top)';

/** Each function or table (or a file's top level) the battle rows have taken, by its file, from the row that took it:
 *  each of the family's rows adds what it takes (and a row of another family whose move empties one). */
const TAKEN: readonly (readonly [file: string, fn: string, row: string])[] = [
  [
    'src/engine/bots/intel.ts',
    'botRaceTerrainMult',
    "B-06ah, the kin's factors from the kin rule's content, the gifts' from their rows",
  ],
  [
    'src/engine/battle/terrain-and-unit-strength.ts',
    'TERRAIN_MODS',
    "B-06ax, the ground's table: content's (KC_EACH_UNIT_TYPES_FACTOR_ON_EACH_GROUND), the same object",
  ],
  [
    'src/engine/battle/fates.ts',
    'BATTLE_MARGIN_BANDS',
    "B-06ay1, the margin bands: content's (KC_A_BATTLES_MARGIN_BANDS_AND_EACH_SIDES_CHANCES_IN_THEM), the same list",
  ],
  [
    'src/engine/battle/the-death-chances-a-battle-carried-on-round-after-round-scales-by.ts',
    'CARRYON_DEATH_STEP',
    "B-06ay1, the carry-on's step: content's row (KC_A_CARRIED_ON_BATTLES_DEATH_CHANCES_BY_ITS_ROUNDS) (B-06bd: moved from combatVsNPC's file)",
  ],
  [
    'src/engine/battle/the-death-chances-a-battle-carried-on-round-after-round-scales-by.ts',
    'CARRYON_DEATH_CAP',
    "B-06ay1, the carry-on's cap: content's row (KC_A_CARRIED_ON_BATTLES_DEATH_CHANCES_BY_ITS_ROUNDS) (B-06bd: moved from combatVsNPC's file)",
  ],
  [
    'src/engine/battle/lines.ts',
    'BATTLE_FRONT_RANGE',
    "B-06ay2, the battle grid: content's rows (the front's range, who faces whom, the lines' factors and limits)",
  ],
  [
    'src/engine/battle/lines.ts',
    'BATTLE_FACING',
    "B-06ay2, the battle grid: content's rows (the front's range, who faces whom, the lines' factors and limits)",
  ],
  [
    'src/engine/battle/lines.ts',
    'BATTLE_LINE_MULTS',
    "B-06ay2, the battle grid: content's rows (the front's range, who faces whom, the lines' factors and limits)",
  ],
  [
    'src/engine/battle/lines.ts',
    'BATTLE_LINE_MULTS_FLANK',
    "B-06ay2, the battle grid: content's rows (the front's range, who faces whom, the lines' factors and limits)",
  ],
  [
    'src/engine/battle/lines.ts',
    'BATTLE_RANGED_IN_FRONT',
    "B-06ay2, the battle grid: content's rows (the front's range, who faces whom, the lines' factors and limits)",
  ],
  [
    'src/engine/battle/lines.ts',
    'BATTLE_FLYER_BEYOND_CAP',
    "B-06ay2, the battle grid: content's rows (the front's range, who faces whom, the lines' factors and limits)",
  ],
  [
    'src/engine/battle/lines.ts',
    'BATTLE_FLYER_CAP_MIN',
    "B-06ay2, the battle grid: content's rows (the front's range, who faces whom, the lines' factors and limits)",
  ],
  [
    'src/engine/battle/lines.ts',
    'BATTLE_FLANK_TAC_CAP',
    "B-06ay2, the battle grid: content's rows (the front's range, who faces whom, the lines' factors and limits)",
  ],
  [
    'src/engine/battle/lines.ts',
    'BATTLE_LINEUP_MAX',
    "B-06ay2, the battle grid: content's rows (the front's range, who faces whom, the lines' factors and limits)",
  ],
  [
    'src/engine/battle/terrain-and-unit-strength.ts',
    'MISSILE_SHOT_PCT',
    "B-06ay2, the battle's single factors: content's rows (a volley and Archery; a unit's strength after the damage, at sea, under the illusion)",
  ],
  [
    'src/engine/battle/terrain-and-unit-strength.ts',
    'MISSILE_ARCH_PER_LVL',
    "B-06ay2, the battle's single factors: content's rows (a volley and Archery; a unit's strength after the damage, at sea, under the illusion)",
  ],
  [
    'src/engine/battle/terrain-and-unit-strength.ts',
    'MISSILE_CAP_FRACTION',
    "B-06ay2, the battle's single factors: content's rows (a volley and Archery; a unit's strength after the damage, at sea, under the illusion)",
  ],
  [
    'src/engine/battle/terrain-and-unit-strength.ts',
    'missileShotDamage',
    "B-06ay2, the battle's single factors: content's rows (a volley and Archery; a unit's strength after the damage, at sea, under the illusion)",
  ],
  [
    'src/engine/battle/terrain-and-unit-strength.ts',
    'applyMissileHit',
    "B-06ay2, the battle's single factors: content's rows (a volley and Archery; a unit's strength after the damage, at sea, under the illusion)",
  ],
  [
    'src/engine/battle/terrain-and-unit-strength.ts',
    'PREBATTLE_STR_FLOOR',
    "B-06ay2, the battle's single factors: content's rows (a volley and Archery; a unit's strength after the damage, at sea, under the illusion)",
  ],
  [
    'src/engine/battle/terrain-and-unit-strength.ts',
    'SEA_LAND_PENALTY',
    "B-06ay2, the battle's single factors: content's rows (a volley and Archery; a unit's strength after the damage, at sea, under the illusion)",
  ],
  [
    'src/engine/battle/terrain-and-unit-strength.ts',
    'illusoryTerrainMult',
    "B-06ay2, the battle's single factors: content's rows (a volley and Archery; a unit's strength after the damage, at sea, under the illusion)",
  ],
  [
    'src/engine/battle/the-strength-a-host-carried-over-the-sea-by-flyers-keeps.ts',
    'SEA_AIRBORNE_LAND_PENALTY',
    "B-06ay2, the battle's single factors: content's rows (a volley and Archery; a unit's strength after the damage, at sea, under the illusion) (B-06bc: moved from combatVsNPC's file)",
  ],
  [
    'src/engine/battle/the-strength-a-host-carried-over-the-sea-by-flyers-keeps.ts',
    'SEA_AIRBORNE_FLYER_PENALTY',
    "B-06ay2, the battle's single factors: content's rows (a volley and Archery; a unit's strength after the damage, at sea, under the illusion) (B-06bc: moved from combatVsNPC's file)",
  ],
  [
    'src/engine/battle/ladder.ts',
    'ARCHERY_MISSILE_PCT',
    "B-06ay2, the battle's single factors: content's rows (a volley and Archery; a unit's strength after the damage, at sea, under the illusion)",
  ],
  [
    'src/engine/battle/hosts-gained-in-a-province.ts',
    'GUARD_FLIGHT_CHANCE',
    "B-06ay2, a beaten guard's survivors: content's row (KC_A_BEATEN_GUARDS_SURVIVORS_CHANCES)",
  ],
  [
    'src/engine/battle/hosts-gained-in-a-province.ts',
    'GUARD_DEMOTE_CHANCE',
    "B-06ay2, a beaten guard's survivors: content's row (KC_A_BEATEN_GUARDS_SURVIVORS_CHANCES)",
  ],
  [
    'src/engine/battle/strength.ts',
    '_MISSILE_CAP_FRAC',
    "B-06ba (the review's 2), the volleys' cap: content's row, the one MISSILE_CAP_FRACTION reads (KC_A_VOLLEYS_NUMBERS_AND_A_COMMANDERS_ARCHERY_IN_A_BATTLE)",
  ],
  [
    'src/engine/battle/the-battle-between-heroes/h5-to-h7-sanctuary-the-mastery-orders-the-lines-fortune-and-the-result.ts',
    'sanctuaryTheMasteryOrdersTheLinesTheFortuneAndTheResultOfTheBattleBetweenHeroes',
    "B-06bk, the battle between heroes' numbers: content's rows (Sanctuary's, the mastery orders', the defenders' ground explored)",
  ],
  [
    'src/engine/battle/best-commander.ts',
    'commandScore',
    "B-06bm, the best commander's score: the shared rows (KC_A_COMMANDERS_TACTICAL_AND_NAVAL_IN_A_BATTLE, KC_A_CURSED_COMMANDERS_SKILL_IN_A_BATTLE)",
  ],
  [
    'src/engine/battle/battle-report-lines-and-force-markers.ts',
    'terrainNoteList',
    "B-06bm, the ground's note: content's row (KC_THE_GROUNDS_FACTORS_A_BATTLES_NOTE_NAMES_A_UNIT_FOR)",
  ],
  [
    'src/engine/battle/blood-harvest-and-iron-throne.ts',
    'ironThroneRaise',
    "B-06bm, the Iron Throne's chance: content's row (KC_THE_WONDERS_FIGURES_IN_A_BATTLE)",
  ],
  [
    'src/engine/battle/pre-battle-duels.ts',
    'preBattleDuel',
    "B-06bm, a pre-battle duel's figures: content's row (KC_A_PRE_BATTLE_DUELS_FIGURES)",
  ],
  [
    'src/engine/battle/strength.ts',
    'missileCap',
    "B-06bm, a winged rider's volley cap: content's row (KC_A_VOLLEYS_NUMBERS_AND_A_COMMANDERS_ARCHERY_IN_A_BATTLE)",
  ],
  [
    'src/engine/units/defend-ride-outs-ambushes-and-reinforcements.ts',
    'runDefendAmbush',
    "B-06bm, a lone defender's ambush: content's row (KC_THE_CHANCE_A_LONE_DEFENDERS_AMBUSH_LANDS)",
  ],
  [
    'src/engine/units/sea-lift-stranding-and-retreats.ts',
    'seaLiftShortfall',
    "B-06bm, the stranding's half-berths and Naval's mastery: content's rows (KC_A_SEA_LIFTS_HALF_BERTHS_AS_THE_STRANDING_COUNTS_THEM, KC_A_COMMANDERS_MARCH_AND_NAVAL_MASTERY_ON_THE_GROUND_AND_AT_SEA)",
  ],
  [
    'src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts',
    'PC_MELEE_HIT_BASE',
    "B-06bn, a blow's chance to hit: content's row (KC_A_BLOWS_CHANCE_TO_HIT_IN_PERSONAL_COMBAT)",
  ],
  [
    'src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts',
    'PC_MELEE_HIT_PER_LVL',
    "B-06bn, a blow's chance to hit: content's row (KC_A_BLOWS_CHANCE_TO_HIT_IN_PERSONAL_COMBAT)",
  ],
  [
    'src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts',
    'PC_HIT_SKILL_CAP',
    "B-06bn, a blow's chance to hit: content's row (KC_A_BLOWS_CHANCE_TO_HIT_IN_PERSONAL_COMBAT)",
  ],
  [
    'src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts',
    'PC_HIT_PER_LVL_ABOVE',
    "B-06bn, a blow's chance to hit: content's row (KC_A_BLOWS_CHANCE_TO_HIT_IN_PERSONAL_COMBAT)",
  ],
  [
    'src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts',
    'PC_HIT_MAX',
    "B-06bn, a blow's chance to hit: content's row (KC_A_BLOWS_CHANCE_TO_HIT_IN_PERSONAL_COMBAT)",
  ],
  [
    'src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts',
    'PC_HIT_MIN',
    "B-06bn, a blow's chance to hit: content's row (KC_A_BLOWS_CHANCE_TO_HIT_IN_PERSONAL_COMBAT)",
  ],
  [
    'src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts',
    'pcMeleeDamage',
    "B-06bn, a blow's damage: content's row (KC_A_BLOWS_DAMAGE_IN_PERSONAL_COMBAT)",
  ],
  [
    'src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts',
    'pcStunWard',
    "B-06bn, a full ward: the guardian perks' row (THE_NUMBERS_THE_CODE_WRITES_FOR_A_GUARDIANS_PERKS.aFullWard)",
  ],
  [
    'src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts',
    'pcStunTurned',
    "B-06bn, a full ward: the guardian perks' row (THE_NUMBERS_THE_CODE_WRITES_FOR_A_GUARDIANS_PERKS.aFullWard)",
  ],
  [
    'src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts',
    'PC_TERROR_BASE',
    "B-06bn, the courage test: content's row (KC_THE_CHANCE_A_FIGHTER_BREAKS_BEFORE_A_TERROR)",
  ],
  [
    'src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts',
    'PC_TERROR_PER_LVL',
    "B-06bn, the courage test: content's row (KC_THE_CHANCE_A_FIGHTER_BREAKS_BEFORE_A_TERROR)",
  ],
  [
    'src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts',
    'PC_TERROR_MIN',
    "B-06bn, the courage test: content's row (KC_THE_CHANCE_A_FIGHTER_BREAKS_BEFORE_A_TERROR)",
  ],
  [
    'src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts',
    'PC_TERROR_MAX',
    "B-06bn, the courage test: content's row (KC_THE_CHANCE_A_FIGHTER_BREAKS_BEFORE_A_TERROR)",
  ],
  [
    'src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts',
    'PC_TERROR_BY_POWER',
    "B-06bn, the courage test: content's row (KC_THE_CHANCE_A_FIGHTER_BREAKS_BEFORE_A_TERROR)",
  ],
  [
    'src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts',
    'pcCourageChance',
    "B-06bn, the courage test: content's row (KC_THE_CHANCE_A_FIGHTER_BREAKS_BEFORE_A_TERROR)",
  ],
  [
    'src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts',
    'pcSustainMult',
    "B-06bn, the sustain's fade: the guardian perks' row (THE_NUMBERS_THE_CODE_WRITES_FOR_A_GUARDIANS_PERKS.theSustainsFade)",
  ],
  [
    'src/engine/personal-combat/helpers.ts',
    'PC_WEAK_MULT',
    "B-06bn, a weakness, the damage floor and the lingering harms: content's row (KC_A_WEAKNESS_THE_DAMAGE_FLOOR_AND_THE_LINGERING_HARMS_IN_PERSONAL_COMBAT)",
  ],
  [
    'src/engine/personal-combat/helpers.ts',
    'PC_DMG_FLOOR_FRACTION',
    "B-06bn, a weakness, the damage floor and the lingering harms: content's row (KC_A_WEAKNESS_THE_DAMAGE_FLOOR_AND_THE_LINGERING_HARMS_IN_PERSONAL_COMBAT)",
  ],
  [
    'src/engine/personal-combat/helpers.ts',
    'PC_MAX_LINGER_ROUNDS',
    "B-06bn, a weakness, the damage floor and the lingering harms: content's row (KC_A_WEAKNESS_THE_DAMAGE_FLOOR_AND_THE_LINGERING_HARMS_IN_PERSONAL_COMBAT)",
  ],
  [
    'src/engine/personal-combat/helpers.ts',
    'PC_PEN_FADE_MIN',
    "B-06bn, a weakness, the damage floor and the lingering harms: content's row (KC_A_WEAKNESS_THE_DAMAGE_FLOOR_AND_THE_LINGERING_HARMS_IN_PERSONAL_COMBAT)",
  ],
  [
    'src/engine/personal-combat/duels-and-character-encounters.ts',
    'DUEL_FLEE_DROP',
    "B-06bn, a duel's and a hero's encounter's figures: content's row (KC_A_DUELS_AND_A_HEROS_ENCOUNTERS_FIGURES)",
  ],
  [
    'src/engine/personal-combat/duels-and-character-encounters.ts',
    'resolveDuel',
    "B-06bn, a duel's and a hero's encounter's figures: content's row (KC_A_DUELS_AND_A_HEROS_ENCOUNTERS_FIGURES)",
  ],
  [
    'src/engine/personal-combat/duels-and-character-encounters.ts',
    'resolveCharVsChar',
    "B-06bn, a duel's and a hero's encounter's figures: content's row (KC_A_DUELS_AND_A_HEROS_ENCOUNTERS_FIGURES)",
  ],
  [
    'src/engine/personal-combat/speed-encounter-plans-and-combatants.ts',
    'pcSpeedOf',
    "B-06bo, a fighter's speed: content's row (KC_A_FIGHTERS_SPEED_IN_PERSONAL_COMBAT)",
  ],
  [
    'src/engine/personal-combat/speed-encounter-plans-and-combatants.ts',
    'ARCHERY_FIELDCRAFT_PCT',
    "B-06bo, a change of range: content's row (KC_THE_CHANCE_A_FIGHTER_CHANGES_RANGE_IN_PERSONAL_COMBAT)",
  ],
  [
    'src/engine/personal-combat/speed-encounter-plans-and-combatants.ts',
    'pcMoveCheck',
    "B-06bo, a change of range: content's row (KC_THE_CHANCE_A_FIGHTER_CHANGES_RANGE_IN_PERSONAL_COMBAT)",
  ],
  [
    'src/engine/personal-combat/speed-encounter-plans-and-combatants.ts',
    'autoEncounterPlan',
    "B-06bo, the plan of a hero with no orders: content's row (KC_THE_ENCOUNTER_PLAN_OF_A_HERO_WITH_NO_ORDERS)",
  ],
  [
    'src/engine/personal-combat/speed-encounter-plans-and-combatants.ts',
    'pcCharCombatant',
    "B-06bo, a hero's hit points and his mastery perks: content's rows (KC_A_FIGHTERS_HIT_POINTS_AS_HE_ENTERS_A_PERSONAL_COMBAT, KC_THE_MASTERY_PERKS_OF_MELEE_AND_ARCHERY_IN_PERSONAL_COMBAT, KC_THE_MOST_HP_OF_A_FIGHTER_WHOSE_RECORD_HOLDS_NONE)",
  ],
  [
    'src/engine/personal-combat/speed-encounter-plans-and-combatants.ts',
    'pcMonsterCombatant',
    "B-06bo, a guardian's hit points: content's row (KC_A_FIGHTERS_HIT_POINTS_AS_HE_ENTERS_A_PERSONAL_COMBAT)",
  ],
  [
    'src/engine/personal-combat/melee-flight-and-archery.ts',
    'pcFleeChance',
    "B-06bo, a flight: content's rows (KC_THE_CHANCE_A_FIGHTER_FLEES_IN_PERSONAL_COMBAT, KC_A_FIGHTERS_SPEED_IN_PERSONAL_COMBAT)",
  ],
  [
    'src/engine/personal-combat/melee-flight-and-archery.ts',
    'pcFreeStrike',
    "B-06bo, a guardian's rebirth: content's row (KC_A_GUARDIANS_REBIRTH_IN_PERSONAL_COMBAT)",
  ],
  [
    'src/engine/personal-combat/melee-flight-and-archery.ts',
    'pcAdvanceOrStrike',
    "B-06bo, a fast guardian's advance: content's rows (KC_A_FIGHTERS_SPEED_IN_PERSONAL_COMBAT, KC_THE_CHANCE_A_FIGHTER_CHANGES_RANGE_IN_PERSONAL_COMBAT)",
  ],
  [
    'src/engine/personal-combat/melee-flight-and-archery.ts',
    'ARCHERY_VOLLEY_AT',
    "B-06bo, an arrow: content's row (KC_AN_ARROW_IN_PERSONAL_COMBAT)",
  ],
  [
    'src/engine/personal-combat/melee-flight-and-archery.ts',
    'pcVolleySize',
    "B-06bo, an arrow: content's row (KC_AN_ARROW_IN_PERSONAL_COMBAT)",
  ],
  [
    'src/engine/personal-combat/melee-flight-and-archery.ts',
    'pcArrowDamage',
    "B-06bo, an arrow: content's row (KC_AN_ARROW_IN_PERSONAL_COMBAT)",
  ],
  [
    'src/engine/personal-combat/melee-flight-and-archery.ts',
    'pcFireOne',
    "B-06bo, the mastery perks: content's row (KC_THE_MASTERY_PERKS_OF_MELEE_AND_ARCHERY_IN_PERSONAL_COMBAT)",
  ],
  [
    'src/engine/personal-combat/tactics-combat-items-and-actions.ts',
    'pcTemperFallback',
    "B-06bo, the most HP of a fighter whose record holds none: content's row (KC_THE_MOST_HP_OF_A_FIGHTER_WHOSE_RECORD_HOLDS_NONE)",
  ],
  [
    'src/engine/personal-combat/tactics-combat-items-and-actions.ts',
    'pcCombatItemWanted',
    "B-06bo, the most HP of a fighter whose record holds none: content's row (KC_THE_MOST_HP_OF_A_FIGHTER_WHOSE_RECORD_HOLDS_NONE)",
  ],
  [
    'src/engine/personal-combat/tactics-combat-items-and-actions.ts',
    'pcUseCombatItem',
    "B-06bo, the most HP of a fighter whose record holds none: content's row (KC_THE_MOST_HP_OF_A_FIGHTER_WHOSE_RECORD_HOLDS_NONE)",
  ],
  [
    'src/engine/personal-combat/lair-guardians-and-the-odds.ts',
    'monsterTraits',
    "B-06bp, a guardian's hidden traits: content's row (KC_A_GUARDIANS_HIDDEN_TRAITS_IN_PERSONAL_COMBAT)",
  ],
  [
    'src/engine/personal-combat/lair-guardians-and-the-odds.ts',
    'RUMOUR_SIM_FIGHTS',
    "B-06bp, a lair guardian's fight: content's row (KC_A_LAIR_GUARDIANS_FIGHT)",
  ],
  [
    'src/engine/personal-combat/combat-spells-and-guardian-abilities.ts',
    'pcCastCombatSpell',
    "B-06bp, a combat spell's cast: content's rows (KC_A_COMBAT_SPELL_CAST_IN_PERSONAL_COMBAT, KC_THE_MOST_HP_OF_A_FIGHTER_WHOSE_RECORD_HOLDS_NONE)",
  ],
];

const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');

test.for(TAKEN)('%s: %s holds no number (%s)', ([file, fn]) => {
  const isCounted =
    countsBattleNumbers(file) ||
    countsPersonalCombatNumbers(file) ||
    THE_BATTLES_FUNCTIONS_IN_THE_BOTS.some(([f, g]) => f === file && g === fn);
  expect(isCounted, `${file}'s ${fn} is one the battles' counts read`).toBe(true);
  const counts = battleNumbersByFunction(file, read(file));
  expect(fn === TOP || counts.has(fn), `${file} declares ${fn}`).toBe(true);
  expect(counts.get(fn) ?? 0, `${fn}'s numbers (the ratchet's helper)`).toBe(0);
});

test.for(THE_BATTLES_FILES_IN_THE_UNITS_FOLDER)('%s, which the battles count lists, is there', (file) => {
  expect(fs.existsSync(path.join(ROOT, file)), `${file} is there`).toBe(true);
  expect(countsBattleNumbers(file), `${file} is counted`).toBe(true);
});

test.for(THE_BATTLES_FUNCTIONS_IN_THE_BOTS)('%s declares %s, which the bots battle count lists', ([file, fn]) => {
  expect(fs.existsSync(path.join(ROOT, file)), `${file} is there`).toBe(true);
  expect(battleNumbersByFunction(file, read(file)).has(fn), `${file} declares ${fn}`).toBe(true);
});

test("no bots' function is listed twice, and each is in src/engine/bots/", () => {
  const keys = THE_BATTLES_FUNCTIONS_IN_THE_BOTS.map(([file, fn]) => `${file} ${fn}`);
  expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
  expect(THE_BATTLES_FUNCTIONS_IN_THE_BOTS.filter(([file]) => !file.startsWith('src/engine/bots/'))).toEqual([]);
});

// The files each count reads: every file of src/engine/battle/ (a folder of its own inside it too) but a facts' file,
// the units' two listed files, and every file of src/engine/personal-combat/ but its facts' file; the folders and the
// facts' files the rule names are there, so it reads what it says.
test('the battles count reads src/engine/battle/ and two units files, personal combat its own folder, no facts file', () => {
  for (const folder of ['src/engine/battle', 'src/engine/personal-combat'])
    expect(fs.existsSync(path.join(ROOT, folder)), `${folder} is there`).toBe(true);
  for (const facts of [
    'src/engine/battle/the-facts-a-battles-lines-record.ts',
    'src/engine/personal-combat/the-facts-a-personal-combats-lines-record.ts',
  ])
    expect(fs.existsSync(path.join(ROOT, facts)), `${facts} is there`).toBe(true);
  expect(
    [
      'src/engine/battle/battles-against-province-defenders.ts',
      'src/engine/battle/the-battle-against-the-defenders/n0-to-n2-the-set-up-the-duel-and-the-sides-to-the-home-ground.ts',
      'src/engine/battle/the-facts-a-battles-lines-record.ts',
      'src/engine/units/sea-lift-stranding-and-retreats.ts',
      'src/engine/units/movement-pools.ts',
      'src/engine/personal-combat/melee-flight-and-archery.ts',
      'src/content/kingdoms-call-data.ts',
    ].map(countsBattleNumbers),
  ).toEqual([true, true, false, true, false, false, false]);
  expect(
    [
      'src/engine/personal-combat/melee-flight-and-archery.ts',
      'src/engine/personal-combat/the-facts-a-personal-combats-lines-record.ts',
      'src/engine/battle/fates.ts',
    ].map(countsPersonalCombatNumbers),
  ).toEqual([true, false, false]);
});

// The helper is the world's making's rule: each number other than 0 and 1 in a top-level function or table (a nested
// function, named or not, counts for the top-level one around it), none of a literal type's or an element's index.
test("the ratchet's helper counts each number other than 0 and 1, by top-level function and table", () => {
  const planted = `
    type Band = 2 | 3;
    export const BANDS = [{ at: 0.25, mult: 1.5 }, { at: 1, mult: 0 }];
    export function planted(list: number[], band: Band) {
      const inner = () => 1.25 * list[2];
      return inner() + band * 2 + 1 + 0 + -5;
    }`;
  expect(Object.fromEntries(battleNumbersByFunction('src/engine/battle/planted.ts', planted))).toEqual({
    [TOP]: 0,
    BANDS: 2,
    planted: 3,
  });
});

// The counts on the tree are the ratchet's baselines; a number planted where a count reads raises it by one, and the
// ratchet fails on it; one where none reads (a facts' file, another units file, a bots' function not listed) doesn't.
type TheBattlesCounts = 'battleNumbersInEngine' | 'personalCombatNumbersInEngine' | 'battleNumbersInTheBots';
const THE_COUNTS: Readonly<
  Record<TheBattlesCounts, (codeFiles: readonly (readonly [file: string, text: string])[]) => number>
> = { battleNumbersInEngine, personalCombatNumbersInEngine, battleNumbersInTheBots };
test.for([
  ['src/engine/battle/fates.ts', 'aPlantedBand', 'battleNumbersInEngine', 1],
  [
    'src/engine/battle/the-battle-against-defenders/s01-a-planted-stage.ts',
    'aPlantedStage',
    'battleNumbersInEngine',
    1,
  ],
  ['src/engine/units/defend-ride-outs-ambushes-and-reinforcements.ts', 'aPlantedRideOut', 'battleNumbersInEngine', 1],
  ['src/engine/battle/the-facts-a-battles-lines-record.ts', 'aPlantedFact', 'battleNumbersInEngine', 0],
  ['src/engine/units/movement-pools.ts', 'aPlantedPool', 'battleNumbersInEngine', 0],
  [
    'src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts',
    'aPlantedToHit',
    'personalCombatNumbersInEngine',
    1,
  ],
  ['src/engine/bots/intel.ts', 'botMarginFor', 'battleNumbersInTheBots', 1],
  ['src/engine/bots/intel.ts', 'aPlantedBotGuess', 'battleNumbersInTheBots', 0],
] as const)('%s, in %s: a number raises %s by %i', ([file, fn, count, rise]) => {
  const files = theCodeFiles();
  const theCount = THE_COUNTS[count];
  const asTheyAre = { ...readBaseline(), [count]: theCount(files) };
  expect(asTheyAre[count], `${count} on the tree as it is`).toBe(readBaseline()[count]);
  const plant = `\nexport function ${fn}() { return 5; }\n`;
  const withThePlant = files.some(([f]) => f === file)
    ? files.map(([f, text]): [string, string] => (f === file ? [f, `${text}${plant}`] : [f, text]))
    : [...files, [file, plant] as const];
  const planted = { ...asTheyAre, [count]: theCount(withThePlant) };
  expect(planted[count], `${count} with a 5 planted in ${fn} of ${file}`).toBe(Number(asTheyAre[count]) + rise);
  const { rose } = compare(asTheyAre, planted);
  expect(rose).toHaveLength(rise);
  expect(rose.filter((r) => r.startsWith(`${count} rose from `))).toEqual(rose);
});
