import { sb } from './startup.ts';
import { setConcede, setDiscoveryChoice, updateEquipTarget, updateRumourTarget } from './items-and-heroes.ts';
import { jumpToReportSection, show } from './init.ts';
import { mapZoom, setDeskView, setMobileView } from './layout.ts';
import {
  acceptGmOffer,
  changeDisplayName,
  changePassword,
  closeChangePassword,
  closeDisplayName,
  declineGmOffer,
  doSignIn,
  doSignOut,
  doSignUp,
  loadAllGames,
  openGameFresh,
  setAuthTab,
  submitChangePassword,
  submitDisplayName,
} from './sign-in.ts';
import {
  loadMyGames,
  loadOpenGames,
  pollForUpdates,
  refreshOpenReport,
  toggleArchivedGamesCard,
} from './game-lists.ts';
import {
  adjustSkill,
  doJoinGame,
  hideSkillTip,
  joinGame,
  loadPastReport,
  returnToCurrentReport,
  showJoinGame,
  showSkillTip,
} from './join-and-chronicle.ts';
import {
  _renderDiplomacyInto,
  collapseAllChronicle,
  collapseAllSections,
  openReport,
  renderDiplomacy,
  renderReportView,
  setDiploChoice,
  toggleBattleFold,
  toggleSection,
} from './report.ts';
import { renderReckoningOrders, renderTitles, setReckoningCall } from './titles.ts';
import { rebuildTargetWrap } from './order-chances.ts';
import { groupHeroesByLocation, moveHeroBlock, poSeaAnalysis, refreshAllMoveModeNotes } from './move-analysis.ts';
import {
  addEncounterTactic,
  buildOrdersForm,
  clearPreSchool,
  computeOrderLedgerP,
  confirmEPSchool,
  confirmEPSpell,
  epDragStart,
  epDropTactic,
  epMoveTactic,
  onSpellChange,
  openPreSchoolPicker,
  removeEncounterTactic,
} from './orders-form.ts';
import {
  allocateHeirSkill,
  onActionChange,
  onMoveEdited,
  resubmitOrders,
  setHeirName,
  setHeirTemper,
  submitOrders,
  syncCharmCard,
  syncHiredHeroCard,
  syncResurrectCard,
  updateBloodOffering,
} from './pre-orders.ts';
import {
  cancelSubmit,
  doSaveOrders,
  doSubmitOrders,
  reviseOrders,
  updateAlignmentDesc,
  updateRaceDesc,
  updateTemperDesc,
} from './briefing-and-submit.ts';
import { DRUID_LEVEL_OF_P, PRIMAL_ARMY_SPEEDS, druidNeedP } from './skills-and-projections.ts';
import { buildTargetField, leaveToggleAll, updateLeaveTarget, updateRecruitTarget } from './order-targets.ts';
import { popupKnownChars, terrorNoteP } from './map-symbols.ts';
import { _closeMapTip, highlightMapProv, locateOnMap, showFullscreenMap, toggleMapIcon } from './map.ts';
import {
  createMsgGroup,
  initMessaging,
  loadMessageRoster,
  loadMyReports,
  loadOlderMessages,
  msgChannelKeyOf,
  msgContacts,
  onMsgInput,
  refreshMessages,
  renderMessageThread,
  reportMessage,
  sendMessage,
  setMsgChannel,
  toggleMsgGroupPicker,
  updateMsgComposer,
} from './dispatches.ts';
import { unitTypeOf } from '../../shared/the-engines-rules-the-player-portal-shares.ts';

// ── The player portal's deliberate globals (plan P1-09b; P1-09's Decision 7) ────
// The page's scripts are ES modules (P1-09d), so a top-level name belongs to its own file: an inline on…="…" handler, a
// test's W.eval or a browser spec's page.evaluate can't reach it. This file, the last one its entry (page.ts) imports,
// puts on window the names they need, in two lists: first the names the page's inline handlers call (in its template
// and in its kcHtml strings), then the names its tests reach. Each name says the file that declares it.
// tests/static/page-globals.test.ts keeps both lists exact: a name a handler or a test needs that is missing fails it,
// and so does a name nothing needs. Only functions and constants go on a list, because a list copies each value once
// and a variable that changes later would go stale here. Those are declared globals instead (29 on this page):
// `globalThis.<name> = <value>;` where they are declared, read and written by their bare names.
// The names its inline handlers call.
Object.assign(window, {
  _closeMapTip, // ui/player/map.ts
  acceptGmOffer, // ui/player/sign-in.ts
  addEncounterTactic, // ui/player/orders-form.ts
  adjustSkill, // ui/player/join-and-chronicle.ts
  allocateHeirSkill, // ui/player/pre-orders.ts
  cancelSubmit, // ui/player/briefing-and-submit.ts
  changeDisplayName, // ui/player/sign-in.ts
  changePassword, // ui/player/sign-in.ts
  clearPreSchool, // ui/player/orders-form.ts
  closeChangePassword, // ui/player/sign-in.ts
  closeDisplayName, // ui/player/sign-in.ts
  collapseAllChronicle, // ui/player/report.ts
  collapseAllSections, // ui/player/report.ts
  confirmEPSchool, // ui/player/orders-form.ts
  confirmEPSpell, // ui/player/orders-form.ts
  createMsgGroup, // ui/player/dispatches.ts
  declineGmOffer, // ui/player/sign-in.ts
  doJoinGame, // ui/player/join-and-chronicle.ts
  doSaveOrders, // ui/player/briefing-and-submit.ts
  doSignIn, // ui/player/sign-in.ts
  doSignOut, // ui/player/sign-in.ts
  doSignUp, // ui/player/sign-in.ts
  doSubmitOrders, // ui/player/briefing-and-submit.ts
  epDragStart, // ui/player/orders-form.ts
  epDropTactic, // ui/player/orders-form.ts
  epMoveTactic, // ui/player/orders-form.ts
  groupHeroesByLocation, // ui/player/move-analysis.ts
  hideSkillTip, // ui/player/join-and-chronicle.ts
  highlightMapProv, // ui/player/map.ts
  joinGame, // ui/player/join-and-chronicle.ts
  jumpToReportSection, // ui/player/init.ts
  leaveToggleAll, // ui/player/order-targets.ts
  loadAllGames, // ui/player/sign-in.ts
  loadOlderMessages, // ui/player/dispatches.ts
  locateOnMap, // ui/player/map.ts
  mapZoom, // ui/player/layout.ts
  moveHeroBlock, // ui/player/move-analysis.ts
  onActionChange, // ui/player/pre-orders.ts
  onMoveEdited, // ui/player/pre-orders.ts
  onMsgInput, // ui/player/dispatches.ts
  onSpellChange, // ui/player/orders-form.ts
  openGameFresh, // ui/player/sign-in.ts
  openPreSchoolPicker, // ui/player/orders-form.ts
  rebuildTargetWrap, // ui/player/order-chances.ts
  refreshAllMoveModeNotes, // ui/player/move-analysis.ts
  refreshMessages, // ui/player/dispatches.ts
  refreshOpenReport, // ui/player/game-lists.ts
  removeEncounterTactic, // ui/player/orders-form.ts
  reportMessage, // ui/player/dispatches.ts
  resubmitOrders, // ui/player/pre-orders.ts
  returnToCurrentReport, // ui/player/join-and-chronicle.ts
  reviseOrders, // ui/player/briefing-and-submit.ts
  sendMessage, // ui/player/dispatches.ts
  setAuthTab, // ui/player/sign-in.ts
  setConcede, // ui/player/items-and-heroes.ts
  setDeskView, // ui/player/layout.ts
  setDiploChoice, // ui/player/report.ts
  setDiscoveryChoice, // ui/player/items-and-heroes.ts
  setHeirName, // ui/player/pre-orders.ts
  setHeirTemper, // ui/player/pre-orders.ts
  setMobileView, // ui/player/layout.ts
  setReckoningCall, // ui/player/titles.ts
  show, // ui/player/init.ts
  showFullscreenMap, // ui/player/map.ts
  showJoinGame, // ui/player/join-and-chronicle.ts
  showSkillTip, // ui/player/join-and-chronicle.ts
  submitChangePassword, // ui/player/sign-in.ts
  submitDisplayName, // ui/player/sign-in.ts
  submitOrders, // ui/player/pre-orders.ts
  syncCharmCard, // ui/player/pre-orders.ts
  syncHiredHeroCard, // ui/player/pre-orders.ts
  syncResurrectCard, // ui/player/pre-orders.ts
  toggleArchivedGamesCard, // ui/player/game-lists.ts
  toggleBattleFold, // ui/player/report.ts
  toggleMapIcon, // ui/player/map.ts
  toggleMsgGroupPicker, // ui/player/dispatches.ts
  toggleSection, // ui/player/report.ts
  updateAlignmentDesc, // ui/player/briefing-and-submit.ts
  updateBloodOffering, // ui/player/pre-orders.ts
  updateEquipTarget, // ui/player/items-and-heroes.ts
  updateLeaveTarget, // ui/player/order-targets.ts
  updateRaceDesc, // ui/player/briefing-and-submit.ts
  updateRecruitTarget, // ui/player/order-targets.ts
  updateRumourTarget, // ui/player/items-and-heroes.ts
  updateTemperDesc, // ui/player/briefing-and-submit.ts
});
// The names its tests reach.
Object.assign(window, {
  _renderDiplomacyInto, // ui/player/report.ts
  buildOrdersForm, // ui/player/orders-form.ts
  buildTargetField, // ui/player/order-targets.ts
  computeOrderLedgerP, // ui/player/orders-form.ts
  DRUID_LEVEL_OF_P, // ui/player/skills-and-projections.ts
  druidNeedP, // ui/player/skills-and-projections.ts
  initMessaging, // ui/player/dispatches.ts
  loadMessageRoster, // ui/player/dispatches.ts
  loadMyGames, // ui/player/game-lists.ts
  loadMyReports, // ui/player/dispatches.ts
  loadOpenGames, // ui/player/game-lists.ts
  loadPastReport, // ui/player/join-and-chronicle.ts
  msgChannelKeyOf, // ui/player/dispatches.ts
  msgContacts, // ui/player/dispatches.ts
  openReport, // ui/player/report.ts
  pollForUpdates, // ui/player/game-lists.ts
  popupKnownChars, // ui/player/map-symbols.ts
  poSeaAnalysis, // ui/player/move-analysis.ts
  PRIMAL_ARMY_SPEEDS, // ui/player/skills-and-projections.ts
  renderDiplomacy, // ui/player/report.ts
  renderMessageThread, // ui/player/dispatches.ts
  renderReckoningOrders, // ui/player/titles.ts
  renderReportView, // ui/player/report.ts
  renderTitles, // ui/player/titles.ts
  sb, // ui/player/startup.ts
  setMsgChannel, // ui/player/dispatches.ts
  terrorNoteP, // ui/player/map-symbols.ts
  unitTypeOf, // engine/rules-on-plain-values/unit-types-and-base-strength.ts
  updateMsgComposer, // ui/player/dispatches.ts
});
