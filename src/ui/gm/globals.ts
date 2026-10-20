import {
  ALL_MAGIC_ITEMS_P,
  KC_UNIT_CLASS,
  LAIR_POOLS_CAT_P,
  LAIR_POOLS_MONSTER_P,
  MONSTERS_P,
  PRIMAL_ARMY_DEFS_P,
  PROVINCE_ARMIES_P,
  SAGE_DISCOVERIES_P,
} from '../../content/kingdoms-call-data.ts';
import { kcRng, kcRngStream } from '../../engine/rng.ts';
import { KC_BUILD_STAMP } from './startup.ts';
import {
  ARMY_COST_MASTER,
  ARMY_SPEED_MASTER,
  LEGACY_UNIT_RENAMES,
  disbandLine,
  migrateLegacyUnitNames,
  ownedUnitName,
  unitRef,
} from '../../engine/army-tables.ts';
import { battleTallyLine, rollUnitFates } from '../../engine/battle/fates.ts';
import {
  BATTLE_FACING,
  BATTLE_FRONT_RANGE,
  battleDeploy,
  battleFacedClauses,
  battleFacing,
  battleFacingStage,
  battleFrontWidth,
  battleGrid,
  battleGridLines,
  battleGridStage,
  battleLegal,
  battleLineTotal,
  battleMovesLine,
  battleRole,
  battleScout,
  battleScoutLine,
  battleWidthChoices,
  battleWidthLine,
  rollBattleWidth,
} from '../../engine/battle/lines.ts';
import { shieldFortHolds } from '../../engine/units/movement.ts';
import {
  abilityMissileUnits,
  archeryBlockedBy,
  missileDamageMult,
  missileTargetPool,
  unitAbilityMult,
} from '../../engine/battle/strength.ts';
import { sb } from './config.ts';
import {
  changePassword,
  closeChangePassword,
  deleteReportedDispatch,
  doSignIn,
  doSignOut,
  loadReportedDispatches,
  show,
  submitChangePassword,
} from './sign-in.ts';
import {
  closeEditInvites,
  createGame,
  loadGames,
  openEditInvites,
  renderGameList,
  renderInviteCheckboxes,
  saveEditInvites,
  showNewGame,
  toggleInvite,
  updateBotHint,
  updateGameVisibility,
  updateMaxPlayersForMap,
  updateSeaHint,
} from './game-list.ts';
import { openGame } from './game-detail.ts';
import { backfillHomeRosters, homeProvinceIdFor } from '../../engine/grand-design.ts';
import { deleteGame, loadTurnLog } from './turn-log.ts';
import { commitTurn0, runTurn0 } from './turn-zero.ts';
import { druIdPenaltyMult, getDruidLevel, unitTypeOf } from '../../engine/world/tables.ts';
import { pickLairNameP } from '../../engine/names.ts';
import { itemEffectKey, lairItemTier } from '../../engine/items/tiers-and-hoards.ts';
import { itemRaceOf } from '../../engine/heroes/fame-and-consecration.ts';
import { activeItems, gainedItemNote, itemSlot } from '../../engine/items/equipment.ts';
import { migrateLairGuardiansV2 } from '../../engine/heroes/skills-and-hp.ts';
import { neutralDefBand } from '../../engine/units/drill-and-spoils.ts';
import {
  buildGameMeta,
  gameArchived,
  probeGameMeta,
  probeMessaging,
  probeTelemetry,
  renderMessagingBanner,
  renderTelemetryBanner,
  setGameArchived,
  toggleArchivedView,
} from '../../db/game-meta.ts';
import { exportStats, forgetDeletedGames, openStats, renderStats } from './stats-tab.ts';
import {
  _LB_SEA,
  backfillGameRecords,
  buildGameRecords,
  probeLeaderboard,
  renderLeaderboardBanner,
  writeGameRecord,
} from './hall-of-fame.ts';
import {
  removePlayer,
  saveBlockEliminated,
  saveBotDiplomacy,
  saveTurnMode,
  updateTurnModeFields,
} from './turn-mode.ts';
import { autoTurnTick, refreshIfNewerBuild } from './auto-turn.ts';
import { BOT_SKILL_BUILD, generateBotSetups } from '../../engine/bots/setup.ts';
import { botBattleForce } from '../../engine/bots/intel.ts';
import { botRaiseTargets } from '../../engine/bots/movement.ts';
import { generateNewGame } from '../../engine/world/generate.ts';
import { getNeighborsP, hexDistP } from '../../engine/world/map-helpers.ts';
import { castChanceFor, guardCastChance, primalStrikeChance } from '../../engine/chances-and-lair-grades.ts';
import { buildTurnReport } from '../../views/turn-report.ts';
import { runTurn } from './turn-shell.ts';

// ── The GM portal's deliberate globals (plan P1-09b; P1-09's Decision 7) ────
// The page's scripts are ES modules (P1-09d), so a top-level name belongs to its own file: an inline on…="…" handler, a
// test's W.eval or a browser spec's page.evaluate can't reach it. This file, the last one its entry (page.ts) imports,
// puts on window the names they need, in two lists: first the names the page's inline handlers call (in its template
// and in its kcHtml strings), then the names its tests reach. Each name says the file that declares it.
// tests/static/page-globals.test.ts keeps both lists exact: a name a handler or a test needs that is missing fails it,
// and so does a name nothing needs. Only functions and constants go on a list, because a list copies each value once
// and a variable that changes later would go stale here. Those are declared globals instead (14 on this page):
// `globalThis.<name> = <value>;` where they are declared, read and written by their bare names.
// The names its inline handlers call.
Object.assign(window, {
  backfillGameRecords, // ui/gm/hall-of-fame.ts
  changePassword, // ui/gm/sign-in.ts
  closeChangePassword, // ui/gm/sign-in.ts
  closeEditInvites, // ui/gm/game-list.ts
  commitTurn0, // ui/gm/turn-zero.ts
  createGame, // ui/gm/game-list.ts
  deleteGame, // ui/gm/turn-log.ts
  deleteReportedDispatch, // ui/gm/sign-in.ts
  doSignIn, // ui/gm/sign-in.ts
  doSignOut, // ui/gm/sign-in.ts
  exportStats, // ui/gm/stats-tab.ts
  forgetDeletedGames, // ui/gm/stats-tab.ts
  gameArchived, // db/game-meta.ts
  loadGames, // ui/gm/game-list.ts
  openEditInvites, // ui/gm/game-list.ts
  openGame, // ui/gm/game-detail.ts
  openStats, // ui/gm/stats-tab.ts
  removePlayer, // ui/gm/turn-mode.ts
  renderGameList, // ui/gm/game-list.ts
  renderInviteCheckboxes, // ui/gm/game-list.ts
  renderStats, // ui/gm/stats-tab.ts
  runTurn, // ui/gm/turn-shell.ts
  runTurn0, // ui/gm/turn-zero.ts
  saveBlockEliminated, // ui/gm/turn-mode.ts
  saveBotDiplomacy, // ui/gm/turn-mode.ts
  saveEditInvites, // ui/gm/game-list.ts
  saveTurnMode, // ui/gm/turn-mode.ts
  setGameArchived, // db/game-meta.ts
  show, // ui/gm/sign-in.ts
  showNewGame, // ui/gm/game-list.ts
  submitChangePassword, // ui/gm/sign-in.ts
  toggleArchivedView, // db/game-meta.ts
  toggleInvite, // ui/gm/game-list.ts
  updateBotHint, // ui/gm/game-list.ts
  updateGameVisibility, // ui/gm/game-list.ts
  updateMaxPlayersForMap, // ui/gm/game-list.ts
  updateSeaHint, // ui/gm/game-list.ts
  updateTurnModeFields, // ui/gm/turn-mode.ts
});
// The names its tests reach.
Object.assign(window, {
  _LB_SEA, // ui/gm/hall-of-fame.ts
  abilityMissileUnits, // engine/battle/strength.ts
  activeItems, // engine/items/equipment.ts
  ALL_MAGIC_ITEMS_P, // content/kingdoms-call-data.ts
  archeryBlockedBy, // engine/battle/strength.ts
  ARMY_COST_MASTER, // engine/army-tables.ts
  ARMY_SPEED_MASTER, // engine/army-tables.ts
  autoTurnTick, // ui/gm/auto-turn.ts
  backfillHomeRosters, // engine/grand-design.ts
  BATTLE_FACING, // engine/battle/lines.ts
  BATTLE_FRONT_RANGE, // engine/battle/lines.ts
  battleDeploy, // engine/battle/lines.ts
  battleFacedClauses, // engine/battle/lines.ts
  battleFacing, // engine/battle/lines.ts
  battleFacingStage, // engine/battle/lines.ts
  battleFrontWidth, // engine/battle/lines.ts
  battleGrid, // engine/battle/lines.ts
  battleGridLines, // engine/battle/lines.ts
  battleGridStage, // engine/battle/lines.ts
  battleLegal, // engine/battle/lines.ts
  battleLineTotal, // engine/battle/lines.ts
  battleMovesLine, // engine/battle/lines.ts
  battleRole, // engine/battle/lines.ts
  battleScout, // engine/battle/lines.ts
  battleScoutLine, // engine/battle/lines.ts
  battleTallyLine, // engine/battle/fates.ts
  battleWidthChoices, // engine/battle/lines.ts
  battleWidthLine, // engine/battle/lines.ts
  BOT_SKILL_BUILD, // engine/bots/setup.ts
  botBattleForce, // engine/bots/intel.ts
  botRaiseTargets, // engine/bots/movement.ts
  buildGameMeta, // db/game-meta.ts
  buildGameRecords, // ui/gm/hall-of-fame.ts
  buildTurnReport, // views/turn-report.ts
  castChanceFor, // engine/chances-and-lair-grades.ts
  disbandLine, // engine/army-tables.ts
  druIdPenaltyMult, // engine/world/tables.ts
  gainedItemNote, // engine/items/equipment.ts
  generateBotSetups, // engine/bots/setup.ts
  generateNewGame, // engine/world/generate.ts
  getDruidLevel, // engine/world/tables.ts
  getNeighborsP, // engine/world/map-helpers.ts
  guardCastChance, // engine/chances-and-lair-grades.ts
  hexDistP, // engine/world/map-helpers.ts
  homeProvinceIdFor, // engine/grand-design.ts
  itemEffectKey, // engine/items/tiers-and-hoards.ts
  itemRaceOf, // engine/heroes/fame-and-consecration.ts
  itemSlot, // engine/items/equipment.ts
  KC_BUILD_STAMP, // ui/gm/startup.ts
  KC_UNIT_CLASS, // content/kingdoms-call-data.ts
  kcRng, // engine/rng.ts
  kcRngStream, // engine/rng.ts
  LAIR_POOLS_CAT_P, // content/kingdoms-call-data.ts
  LAIR_POOLS_MONSTER_P, // content/kingdoms-call-data.ts
  lairItemTier, // engine/items/tiers-and-hoards.ts
  LEGACY_UNIT_RENAMES, // engine/army-tables.ts
  loadReportedDispatches, // ui/gm/sign-in.ts
  loadTurnLog, // ui/gm/turn-log.ts
  migrateLairGuardiansV2, // engine/heroes/skills-and-hp.ts
  migrateLegacyUnitNames, // engine/army-tables.ts
  missileDamageMult, // engine/battle/strength.ts
  missileTargetPool, // engine/battle/strength.ts
  MONSTERS_P, // content/kingdoms-call-data.ts
  neutralDefBand, // engine/units/drill-and-spoils.ts
  ownedUnitName, // engine/army-tables.ts
  pickLairNameP, // engine/names.ts
  PRIMAL_ARMY_DEFS_P, // content/kingdoms-call-data.ts
  primalStrikeChance, // engine/chances-and-lair-grades.ts
  probeGameMeta, // db/game-meta.ts
  probeLeaderboard, // ui/gm/hall-of-fame.ts
  probeMessaging, // db/game-meta.ts
  probeTelemetry, // db/game-meta.ts
  PROVINCE_ARMIES_P, // content/kingdoms-call-data.ts
  refreshIfNewerBuild, // ui/gm/auto-turn.ts
  renderLeaderboardBanner, // ui/gm/hall-of-fame.ts
  renderMessagingBanner, // db/game-meta.ts
  renderTelemetryBanner, // db/game-meta.ts
  rollBattleWidth, // engine/battle/lines.ts
  rollUnitFates, // engine/battle/fates.ts
  SAGE_DISCOVERIES_P, // content/kingdoms-call-data.ts
  sb, // ui/gm/config.ts
  shieldFortHolds, // engine/units/movement.ts
  unitAbilityMult, // engine/battle/strength.ts
  unitRef, // engine/army-tables.ts
  unitTypeOf, // engine/world/tables.ts
  writeGameRecord, // ui/gm/hall-of-fame.ts
});
