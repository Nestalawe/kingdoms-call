import { sb } from './startup.js';
import { setConcede, setDiscoveryChoice, updateEquipTarget, updateRumourTarget } from './items-and-heroes.js';
import { jumpToReportSection, show } from './init.js';
import { mapZoom, setDeskView, setMobileView } from './layout.js';
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
} from './sign-in.js';
import {
  loadMyGames,
  loadOpenGames,
  pollForUpdates,
  refreshOpenReport,
  toggleArchivedGamesCard,
} from './game-lists.js';
import {
  adjustSkill,
  doJoinGame,
  hideSkillTip,
  joinGame,
  loadPastReport,
  returnToCurrentReport,
  showJoinGame,
  showSkillTip,
} from './join-and-chronicle.js';
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
} from './report.js';
import { renderTitles, setReckoningCall } from './titles.js';
import { rebuildTargetWrap, unitTypeOfP } from './order-chances.js';
import { groupHeroesByLocation, moveHeroBlock, poSeaAnalysis, refreshAllMoveModeNotes } from './move-analysis.js';
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
} from './orders-form.js';
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
} from './pre-orders.js';
import {
  cancelSubmit,
  doSaveOrders,
  doSubmitOrders,
  reviseOrders,
  updateAlignmentDesc,
  updateRaceDesc,
  updateTemperDesc,
} from './briefing-and-submit.js';
import { DRUID_LEVEL_OF_P, PRIMAL_ARMY_SPEEDS, druidNeedP } from './skills-and-projections.js';
import { buildTargetField, leaveToggleAll, updateLeaveTarget, updateRecruitTarget } from './order-targets.js';
import { popupKnownChars, terrorNoteP } from './map-symbols.js';
import { _closeMapTip, highlightMapProv, locateOnMap, showFullscreenMap, toggleMapIcon } from './map.js';
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
} from './dispatches.js';

// ── The player portal's deliberate globals (plan P1-09b; P1-09's Decision 7) ────
// Once the page's scripts are ES modules (P1-09d), a top-level name belongs to its own file: an inline on…="…" handler,
// a test's W.eval or a browser spec's page.evaluate can't reach it. This file, last on the page, puts on window the
// names they need, in two lists: first the names the page's inline handlers call (in its template and in its kcHtml
// strings), then the names its tests reach. Each name says the file that declares it. tests/static/page-globals.test.ts
// keeps both lists exact: a name a handler or a test needs that is missing fails it, and so does a name nothing needs.
// Only functions and constants go on a list, because a list copies each value once and a variable that changes later
// would go stale here. Those are declared globals instead (29 on this page): `globalThis.<name> = <value>;` where they
// are declared, read and written by their bare names. Until P1-09d the page's scripts share one global scope, where
// every name is already reached by its bare name, so the lists change nothing the page does.
// The names its inline handlers call.
Object.assign(window, {
  _closeMapTip, // ui/player/map.js
  acceptGmOffer, // ui/player/sign-in.js
  addEncounterTactic, // ui/player/orders-form.js
  adjustSkill, // ui/player/join-and-chronicle.js
  allocateHeirSkill, // ui/player/pre-orders.js
  cancelSubmit, // ui/player/briefing-and-submit.js
  changeDisplayName, // ui/player/sign-in.js
  changePassword, // ui/player/sign-in.js
  clearPreSchool, // ui/player/orders-form.js
  closeChangePassword, // ui/player/sign-in.js
  closeDisplayName, // ui/player/sign-in.js
  collapseAllChronicle, // ui/player/report.js
  collapseAllSections, // ui/player/report.js
  confirmEPSchool, // ui/player/orders-form.js
  confirmEPSpell, // ui/player/orders-form.js
  createMsgGroup, // ui/player/dispatches.js
  declineGmOffer, // ui/player/sign-in.js
  doJoinGame, // ui/player/join-and-chronicle.js
  doSaveOrders, // ui/player/briefing-and-submit.js
  doSignIn, // ui/player/sign-in.js
  doSignOut, // ui/player/sign-in.js
  doSignUp, // ui/player/sign-in.js
  doSubmitOrders, // ui/player/briefing-and-submit.js
  epDragStart, // ui/player/orders-form.js
  epDropTactic, // ui/player/orders-form.js
  epMoveTactic, // ui/player/orders-form.js
  groupHeroesByLocation, // ui/player/move-analysis.js
  hideSkillTip, // ui/player/join-and-chronicle.js
  highlightMapProv, // ui/player/map.js
  joinGame, // ui/player/join-and-chronicle.js
  jumpToReportSection, // ui/player/init.js
  leaveToggleAll, // ui/player/order-targets.js
  loadAllGames, // ui/player/sign-in.js
  loadOlderMessages, // ui/player/dispatches.js
  locateOnMap, // ui/player/map.js
  mapZoom, // ui/player/layout.js
  moveHeroBlock, // ui/player/move-analysis.js
  onActionChange, // ui/player/pre-orders.js
  onMoveEdited, // ui/player/pre-orders.js
  onMsgInput, // ui/player/dispatches.js
  onSpellChange, // ui/player/orders-form.js
  openGameFresh, // ui/player/sign-in.js
  openPreSchoolPicker, // ui/player/orders-form.js
  rebuildTargetWrap, // ui/player/order-chances.js
  refreshAllMoveModeNotes, // ui/player/move-analysis.js
  refreshMessages, // ui/player/dispatches.js
  refreshOpenReport, // ui/player/game-lists.js
  removeEncounterTactic, // ui/player/orders-form.js
  reportMessage, // ui/player/dispatches.js
  resubmitOrders, // ui/player/pre-orders.js
  returnToCurrentReport, // ui/player/join-and-chronicle.js
  reviseOrders, // ui/player/briefing-and-submit.js
  sendMessage, // ui/player/dispatches.js
  setAuthTab, // ui/player/sign-in.js
  setConcede, // ui/player/items-and-heroes.js
  setDeskView, // ui/player/layout.js
  setDiploChoice, // ui/player/report.js
  setDiscoveryChoice, // ui/player/items-and-heroes.js
  setHeirName, // ui/player/pre-orders.js
  setHeirTemper, // ui/player/pre-orders.js
  setMobileView, // ui/player/layout.js
  setReckoningCall, // ui/player/titles.js
  show, // ui/player/init.js
  showFullscreenMap, // ui/player/map.js
  showJoinGame, // ui/player/join-and-chronicle.js
  showSkillTip, // ui/player/join-and-chronicle.js
  submitChangePassword, // ui/player/sign-in.js
  submitDisplayName, // ui/player/sign-in.js
  submitOrders, // ui/player/pre-orders.js
  syncCharmCard, // ui/player/pre-orders.js
  syncHiredHeroCard, // ui/player/pre-orders.js
  syncResurrectCard, // ui/player/pre-orders.js
  toggleArchivedGamesCard, // ui/player/game-lists.js
  toggleBattleFold, // ui/player/report.js
  toggleMapIcon, // ui/player/map.js
  toggleMsgGroupPicker, // ui/player/dispatches.js
  toggleSection, // ui/player/report.js
  updateAlignmentDesc, // ui/player/briefing-and-submit.js
  updateBloodOffering, // ui/player/pre-orders.js
  updateEquipTarget, // ui/player/items-and-heroes.js
  updateLeaveTarget, // ui/player/order-targets.js
  updateRaceDesc, // ui/player/briefing-and-submit.js
  updateRecruitTarget, // ui/player/order-targets.js
  updateRumourTarget, // ui/player/items-and-heroes.js
  updateTemperDesc, // ui/player/briefing-and-submit.js
});
// The names its tests reach.
Object.assign(window, {
  _renderDiplomacyInto, // ui/player/report.js
  buildOrdersForm, // ui/player/orders-form.js
  buildTargetField, // ui/player/order-targets.js
  computeOrderLedgerP, // ui/player/orders-form.js
  DRUID_LEVEL_OF_P, // ui/player/skills-and-projections.js
  druidNeedP, // ui/player/skills-and-projections.js
  initMessaging, // ui/player/dispatches.js
  loadMessageRoster, // ui/player/dispatches.js
  loadMyGames, // ui/player/game-lists.js
  loadMyReports, // ui/player/dispatches.js
  loadOpenGames, // ui/player/game-lists.js
  loadPastReport, // ui/player/join-and-chronicle.js
  msgChannelKeyOf, // ui/player/dispatches.js
  msgContacts, // ui/player/dispatches.js
  openReport, // ui/player/report.js
  pollForUpdates, // ui/player/game-lists.js
  popupKnownChars, // ui/player/map-symbols.js
  poSeaAnalysis, // ui/player/move-analysis.js
  PRIMAL_ARMY_SPEEDS, // ui/player/skills-and-projections.js
  renderDiplomacy, // ui/player/report.js
  renderMessageThread, // ui/player/dispatches.js
  renderReportView, // ui/player/report.js
  renderTitles, // ui/player/titles.js
  sb, // ui/player/startup.js
  setMsgChannel, // ui/player/dispatches.js
  terrorNoteP, // ui/player/map-symbols.js
  unitTypeOfP, // ui/player/order-chances.js
  updateMsgComposer, // ui/player/dispatches.js
});
