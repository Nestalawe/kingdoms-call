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
// test's W.eval or a browser spec's page.evaluate can't reach it. This file, the last one its entry (page.js) imports,
// puts on window the names they need, in two lists: first the names the page's inline handlers call (in its template
// and in its kcHtml strings), then the names its tests reach. Each name says the file that declares it.
// tests/static/page-globals.test.ts keeps both lists exact: a name a handler or a test needs that is missing fails it,
// and so does a name nothing needs. Only functions and constants go on a list, because a list copies each value once
// and a variable that changes later would go stale here. Those are declared globals instead (14 on this page):
// `globalThis.<name> = <value>;` where they are declared, read and written by their bare names.
// The names its inline handlers call.
Object.assign(window, {
  backfillGameRecords, // ui/gm/hall-of-fame.js
  changePassword, // ui/gm/sign-in.js
  closeChangePassword, // ui/gm/sign-in.js
  closeEditInvites, // ui/gm/game-list.js
  commitTurn0, // ui/gm/turn-zero.js
  createGame, // ui/gm/game-list.js
  deleteGame, // ui/gm/turn-log.js
  deleteReportedDispatch, // ui/gm/sign-in.js
  doSignIn, // ui/gm/sign-in.js
  doSignOut, // ui/gm/sign-in.js
  exportStats, // ui/gm/stats-tab.js
  forgetDeletedGames, // ui/gm/stats-tab.js
  gameArchived, // db/game-meta.js
  loadGames, // ui/gm/game-list.js
  openEditInvites, // ui/gm/game-list.js
  openGame, // ui/gm/game-detail.js
  openStats, // ui/gm/stats-tab.js
  removePlayer, // ui/gm/turn-mode.js
  renderGameList, // ui/gm/game-list.js
  renderInviteCheckboxes, // ui/gm/game-list.js
  renderStats, // ui/gm/stats-tab.js
  runTurn, // ui/gm/turn-shell.js
  runTurn0, // ui/gm/turn-zero.js
  saveBlockEliminated, // ui/gm/turn-mode.js
  saveBotDiplomacy, // ui/gm/turn-mode.js
  saveEditInvites, // ui/gm/game-list.js
  saveTurnMode, // ui/gm/turn-mode.js
  setGameArchived, // db/game-meta.js
  show, // ui/gm/sign-in.js
  showNewGame, // ui/gm/game-list.js
  submitChangePassword, // ui/gm/sign-in.js
  toggleArchivedView, // db/game-meta.js
  toggleInvite, // ui/gm/game-list.js
  updateBotHint, // ui/gm/game-list.js
  updateGameVisibility, // ui/gm/game-list.js
  updateMaxPlayersForMap, // ui/gm/game-list.js
  updateSeaHint, // ui/gm/game-list.js
  updateTurnModeFields, // ui/gm/turn-mode.js
});
// The names its tests reach.
Object.assign(window, {
  _LB_SEA, // ui/gm/hall-of-fame.js
  abilityMissileUnits, // engine/battle/strength.js
  activeItems, // engine/items/equipment.js
  ALL_MAGIC_ITEMS_P, // content/kingdoms-call-data.js
  archeryBlockedBy, // engine/battle/strength.js
  ARMY_COST_MASTER, // engine/army-tables.js
  ARMY_SPEED_MASTER, // engine/army-tables.js
  autoTurnTick, // ui/gm/auto-turn.js
  backfillHomeRosters, // engine/grand-design.js
  BATTLE_FACING, // engine/battle/lines.js
  BATTLE_FRONT_RANGE, // engine/battle/lines.js
  battleDeploy, // engine/battle/lines.js
  battleFacedClauses, // engine/battle/lines.js
  battleFacing, // engine/battle/lines.js
  battleFacingStage, // engine/battle/lines.js
  battleFrontWidth, // engine/battle/lines.js
  battleGrid, // engine/battle/lines.js
  battleGridLines, // engine/battle/lines.js
  battleGridStage, // engine/battle/lines.js
  battleLegal, // engine/battle/lines.js
  battleLineTotal, // engine/battle/lines.js
  battleMovesLine, // engine/battle/lines.js
  battleRole, // engine/battle/lines.js
  battleScout, // engine/battle/lines.js
  battleScoutLine, // engine/battle/lines.js
  battleTallyLine, // engine/battle/fates.js
  battleWidthChoices, // engine/battle/lines.js
  battleWidthLine, // engine/battle/lines.js
  BOT_SKILL_BUILD, // engine/bots/setup.js
  botBattleForce, // engine/bots/intel.js
  botRaiseTargets, // engine/bots/movement.js
  buildGameMeta, // db/game-meta.js
  buildGameRecords, // ui/gm/hall-of-fame.js
  buildTurnReport, // views/turn-report.js
  castChanceFor, // engine/chances-and-lair-grades.js
  disbandLine, // engine/army-tables.js
  druIdPenaltyMult, // engine/world/tables.js
  gainedItemNote, // engine/items/equipment.js
  generateBotSetups, // engine/bots/setup.js
  generateNewGame, // engine/world/generate.js
  getDruidLevel, // engine/world/tables.js
  getNeighborsP, // engine/world/map-helpers.js
  guardCastChance, // engine/chances-and-lair-grades.js
  hexDistP, // engine/world/map-helpers.js
  homeProvinceIdFor, // engine/grand-design.js
  itemEffectKey, // engine/items/tiers-and-hoards.js
  itemRaceOf, // engine/heroes/fame-and-consecration.js
  itemSlot, // engine/items/equipment.js
  KC_BUILD_STAMP, // ui/gm/startup.js
  KC_UNIT_CLASS, // content/kingdoms-call-data.js
  kcRng, // engine/rng.js
  kcRngStream, // engine/rng.js
  LAIR_POOLS_CAT_P, // content/kingdoms-call-data.js
  LAIR_POOLS_MONSTER_P, // content/kingdoms-call-data.js
  lairItemTier, // engine/items/tiers-and-hoards.js
  LEGACY_UNIT_RENAMES, // engine/army-tables.js
  loadReportedDispatches, // ui/gm/sign-in.js
  loadTurnLog, // ui/gm/turn-log.js
  migrateLairGuardiansV2, // engine/heroes/skills-and-hp.js
  migrateLegacyUnitNames, // engine/army-tables.js
  missileDamageMult, // engine/battle/strength.js
  missileTargetPool, // engine/battle/strength.js
  MONSTERS_P, // content/kingdoms-call-data.js
  neutralDefBand, // engine/units/drill-and-spoils.js
  ownedUnitName, // engine/army-tables.js
  pickLairNameP, // engine/names.js
  PRIMAL_ARMY_DEFS_P, // content/kingdoms-call-data.js
  primalStrikeChance, // engine/chances-and-lair-grades.js
  probeGameMeta, // db/game-meta.js
  probeLeaderboard, // ui/gm/hall-of-fame.js
  probeMessaging, // db/game-meta.js
  probeTelemetry, // db/game-meta.js
  PROVINCE_ARMIES_P, // content/kingdoms-call-data.js
  refreshIfNewerBuild, // ui/gm/auto-turn.js
  renderLeaderboardBanner, // ui/gm/hall-of-fame.js
  renderMessagingBanner, // db/game-meta.js
  renderTelemetryBanner, // db/game-meta.js
  rollBattleWidth, // engine/battle/lines.js
  rollUnitFates, // engine/battle/fates.js
  SAGE_DISCOVERIES_P, // content/kingdoms-call-data.js
  sb, // ui/gm/config.js
  shieldFortHolds, // engine/units/movement.js
  unitAbilityMult, // engine/battle/strength.js
  unitRef, // engine/army-tables.js
  unitTypeOf, // engine/world/tables.js
  writeGameRecord, // ui/gm/hall-of-fame.js
});
