import { kcHtml } from '../shared/kc-safe.ts';
import { THE_TEMPER_A_HERO_OF_NO_TEMPER_FIGHTS_WITH } from '../../content/kingdoms-call-data.ts';
import { SKILL_LABELS } from '../../engine/army-tables.ts';
import { thePagesDb } from './config.ts';
import { MAP_MAX_PLAYERS } from './game-list.ts';
import { renderOrdersStatus } from './game-detail.ts';
import { seedUsedHeroNames } from '../../engine/names.ts';
import { seedUsedArmyNames } from '../../engine/dice-and-army-names.ts';
import { normalizeTurnMode, parseGameState } from './startup.ts';
import { metaPatch } from './turn-mode.ts';
import { computeNextDeadline } from './turn-mode.ts';
import { botConfigFor, generateBotSetups, isBotRow } from '../../engine/bots/setup.ts';
import { generateNewGame, normSeaPct } from '../../engine/world/generate.ts';
import { buildTurnReport } from '../../views/turn-report.ts';
import { playerView } from '../../views/what-each-realm-may-see-of-the-world.ts';
import { runningBuildStamp } from './sign-in.ts';
import { theGameOpenNow } from './game-detail.ts';
import { theElementFound } from './game-list.ts';
import { theElementWithTheId } from '../shared/the-pages-element-with-the-id.ts';
import { theField, thisOrElse } from '../shared/a-value-of-any-kind-read-as-javascript-reads-it.ts';
import { asItsGuardReadsIt } from '../../engine/rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import { refuseASaveThatIsNotAGameInPlay } from '../../engine/saves/upgrade-a-saved-game-and-check-it.ts';
import type { ARealm } from '../../db/the-db-interface-and-its-areas.ts';

/** The Turn-0 plan the roster preview holds until the GM confirms it (src/globals.d.ts types it). */
type TheTurnZeroPlan = NonNullable<typeof _pendingTurn0>;
/** A realm's setup in the plan: a human's, from the realm's row, or a generated bot's. */
type ARealmsSetupInThePlan = TheTurnZeroPlan['humanSetups'][number] | TheTurnZeroPlan['botSetups'][number];
/** A realm's skills as its setup holds them. */
type TheSkillsOfASetUp = Readonly<Partial<Record<string, number>>>;
/** A game's settings as Turn 0 reads them: its state as the New Game form saved it, parsed (each field as held). */
interface TheSettingsTurnZeroReads {
  readonly mapSize?: unknown;
  readonly maxTurns?: number;
  readonly seaPct?: unknown;
  readonly botDifficulty?: unknown;
  readonly botDiplomacy?: unknown;
  readonly safeStart?: unknown;
}
/** A player's setup as his join wrote it into his realm's report (parsed from JSON): each field as he chose it. */
interface TheSetUpAPlayerJoinedWith {
  readonly kingName?: string;
  readonly kingdomName?: string;
  readonly race?: string;
  readonly alignment?: string;
  readonly temper?: string;
  readonly skills?: TheSkillsOfASetUp;
}
/** Settings parsed from JSON, as an object: their fields are read as their type claims (a maintainer's answer, 14
 *  November). */
function isTheSettingsTurnZeroReads(settings: unknown): settings is TheSettingsTurnZeroReads {
  return typeof settings === 'object' && settings !== null;
}
/** A game's settings as held: none throws the TypeError reading its map size threw; a value that is no object holds
 *  none of the fields read (`cfg.mapSize` on words or a number is `undefined`). */
function theSettingsAsHeld(cfg: unknown): TheSettingsTurnZeroReads {
  if (cfg === null || cfg === undefined)
    throw new TypeError(`Cannot read properties of ${String(cfg)} (reading 'mapSize')`);
  return isTheSettingsTurnZeroReads(cfg) ? cfg : {};
}
/** A player's setup parsed from JSON, as an object: its fields are read as their type claims (a maintainer's answer,
 *  14 November). */
function isASetUpAPlayerJoinedWith(setup: unknown): setup is TheSetUpAPlayerJoinedWith {
  return typeof setup === 'object' && setup !== null;
}
/** A setup's skills as held, else none (`s || {}`). */
function theSkillsOrNone(skills: TheSkillsOfASetUp | null | undefined): TheSkillsOfASetUp {
  if (skills) return skills;
  return {};
}
/** A value of any kind in words, as `String` writes it: the key a table is read by (`table[value]` reads it so). */
function inWords(value: unknown): string {
  return String(value);
}
/** The row the database made for a bot's realm: none throws the TypeError reading its id threw. */
function theRowMade(row: Pick<ARealm, 'id'> | null): Pick<ARealm, 'id'> {
  if (row === null) throw new TypeError("Cannot read properties of null (reading 'id')");
  return row;
}
/** A realm's row id in the plan: every bot's is written when its realm is made, above (none throws). */
function theRowIdOf(setup: { readonly gamePlayerId?: string | undefined }): string {
  if (setup.gamePlayerId === undefined) throw new TypeError('a realm of the plan has no row');
  return setup.gamePlayerId;
}

// ── TURN 0 — FULL INLINE MAP GENERATION ────
// Embeds the core map/character generation from kingdoms-call-gm.html so the GM portal is fully
// self-contained. Holds the prepared Turn-0 plan (human + bot setups) between the roster preview
// and confirmation.
// A declared global (plan P1-09b): one binding the page's files and its tests share (ui/gm/globals.ts says why).
globalThis._pendingTurn0 = null;

export async function runTurn0() {
  const msg = document.getElementById('detail-msg');
  theElementFound(msg).innerHTML = '<div class="msg-info">⏳ Preparing world setup…</div>';

  // Reload player list fresh
  const { data: players, error: pErr } = await thePagesDb.theTurnZeroAsTheGameMasterRunsIt.everyRealmOfThisGame(
    theGameOpenNow("read properties of null (reading 'id')").id,
  );
  if (pErr) {
    theElementFound(msg).innerHTML = String(
      kcHtml`<div class="msg-error">Could not load players: ${pErr.message}</div>`,
    );
    return;
  }
  // the game the GM has open (nothing sets it back to none once a game is open)
  const theGame = theGameOpenNow("read properties of null (reading 'game_state')");

  // Read game config from game_state
  let cfgHeld: unknown = {};
  try {
    cfgHeld =
      typeof theGame.game_state === 'string' ? JSON.parse(theGame.game_state) : thisOrElse(theGame.game_state, {});
  } catch {
    // a setup that isn't JSON reads as none
  }
  const cfg = theSettingsAsHeld(cfgHeld);
  const mapSize = thisOrElse(cfg.mapSize, 'p5');
  const maxTurns = (cfg.maxTurns ?? 0) || 12;
  // ── MAP LADDER ────
  // Every rung is the SMALLEST grid on which generateNewGame's own Phase-1 placement reliably meets
  // its KING_MIN_SPACING=4 floor (>=3 neutral hexes between every pair of capitals) — measured, not
  // guessed: 800 placement runs per grid, every rung at 100%, and 25 full live generations per rung
  // with every world-gen invariant re-checked (22 legendary lairs, <=2 sea and <=1 primal on a home
  // ring, poor + prosperous + own-race neighbours, naval king's sea). Grids one step smaller were
  // rejected for measured spacing failures, e.g. 8p 16x9 (0.4% of worlds) and 6p 13x8 (0.25%). 9
  // and 10 realms share 16x11 because the floor needs 9 eligible rows (rows-2), so rows<11 cannot
  // seat nine capitals at any width. Land per realm now runs 10.5-13.5 (was 14.3-16.0).
  // 2 8x5=40 (was 8x6=48) 3 8x7=56 (was 10x7=70) 4 9x7=63 (was 12x8=96)
  // 5 12x7=84 (was 13x9=117) 6 15x7=105 (was 15x9=135) 7 16x7=112 (was 16x10=160)
  // 8 17x8=136 (was 17x11=187) 9 16x11=176 (was 18x11=198) 10 16x11=176 (was 19x12=228)
  const theSizes = {
    p2: { cols: 8, rows: 5 },
    p3: { cols: 8, rows: 7 },
    p4: { cols: 9, rows: 7 },
    p5: { cols: 12, rows: 7 },
    p6: { cols: 15, rows: 7 },
    p7: { cols: 16, rows: 7 },
    p8: { cols: 17, rows: 8 },
    p9: { cols: 16, rows: 11 },
    p10: { cols: 16, rows: 11 },
  };
  // the ladder read by any map size's name
  const sizemap: Readonly<Partial<Record<string, { readonly cols: number; readonly rows: number }>>> = theSizes;
  const sz = sizemap[inWords(mapSize)] ?? theSizes.p5;
  const { botCount, allBot } = botConfigFor(theGame);

  // Human setups from joined rows (exclude any leftover bot rows from a prior aborted Turn 0).
  const humanRows = (players ?? []).filter((p) => !isBotRow(p));
  const humanSetups = humanRows
    .map((p): TheTurnZeroPlan['humanSetups'][number] => {
      let setup: TheSetUpAPlayerJoinedWith = {};
      try {
        const r: unknown =
          typeof p.turn_report === 'string' ? JSON.parse(p.turn_report) : thisOrElse(p.turn_report, {});
        const held = thisOrElse(theField(r, 'playerSetup'), {});
        if (isASetUpAPlayerJoinedWith(held)) setup = held;
      } catch {
        // a report that isn't JSON leaves the setup empty
      }
      return {
        id: p.player_index,
        gamePlayerId: p.id,
        isBot: false,
        name: p.display_name || `Player ${String(p.player_index + 1)}`,
        kingName: (setup.kingName ?? '') || p.display_name || `King ${String(p.player_index + 1)}`,
        kingdomName: (setup.kingdomName ?? '') || p.display_name || `Realm ${String(p.player_index + 1)}`,
        race: (setup.race ?? '') || 'Human',
        alignment: (setup.alignment ?? '') || 'Neutral',
        temper: (setup.temper ?? '') || THE_TEMPER_A_HERO_OF_NO_TEMPER_FIGHTS_WITH,
        skills: theSkillsOrNone(setup.skills),
      };
    })
    .sort((a, b) => a.id - b.id);

  // How many bots to generate. All-bot fills every slot; otherwise the configured count.
  const plannedBots = allBot ? theGame.max_players || 0 : botCount;
  const totalKingdoms = humanSetups.length + plannedBots;
  if (totalKingdoms < 2) {
    theElementFound(msg).innerHTML = String(
      kcHtml`<div class="msg-error">Need at least 2 realms to start (currently ${humanSetups.length} human${humanSetups.length !== 1 ? 's' : ''} + ${plannedBots} bot${plannedBots !== 1 ? 's' : ''}). ${allBot ? 'Raise Maximum Players.' : 'Wait for another player to join, or add bots at game creation.'}</div>`,
    );
    return;
  }

  // Bots take the indices immediately AFTER the humans, kept contiguous so generateNewGame's
  // array-position player id == game_players.player_index (reports route by index).
  const startIndex = humanSetups.length;
  const botSetups = plannedBots > 0 ? generateBotSetups(humanSetups, plannedBots, startIndex) : [];

  // 2026-09-21: the map rung is chosen for the realm count at game creation, but humans + bots can
  // exceed it (extra joins, bots added). Each rung is the smallest grid that reliably keeps >=3
  // provinces between every pair of capitals, so size the map for the realms actually starting.
  const theCaps: Readonly<Partial<Record<string, number>>> = MAP_MAX_PLAYERS;
  let _szUse = sz,
    _mapUse = mapSize;
  if (totalKingdoms > ((theCaps[inWords(mapSize)] ?? 0) || 10)) {
    const theMapUsed = 'p' + String(Math.min(10, totalKingdoms));
    _mapUse = theMapUsed;
    _szUse = sizemap[theMapUsed] ?? sz;
    console.warn(
      `Turn 0: ${String(totalKingdoms)} realms on a ${inWords(mapSize)} map — using the ${theMapUsed} map (${String(_szUse.cols)}x${String(_szUse.rows)}) so capitals stay 3+ provinces apart.`,
    );
  }
  _pendingTurn0 = {
    humanSetups,
    botSetups,
    sz: _szUse,
    maxTurns,
    mapSize: _mapUse,
    seaPct: normSeaPct(cfg.seaPct),
    botDifficulty: thisOrElse(cfg.botDifficulty, null),
    botDiplomacy: cfg.botDiplomacy === 'hostile' ? 'hostile' : 'normal',
    safeStart: Boolean(cfg.safeStart),
  };

  if (botSetups.length > 0) {
    renderTurn0Preview(); // GM confirms the generated roster before we commit anything
  } else {
    void commitTurn0(); // no bots → straight to generation (unchanged behaviour)
  }
}

// Render the Turn-0 roster (humans + generated bots) for GM sanity-check before committing.
export function renderTurn0Preview() {
  const msg = document.getElementById('detail-msg');
  if (!_pendingTurn0) {
    theElementFound(msg).innerHTML = '';
    return;
  }
  const { humanSetups, botSetups } = _pendingTurn0;
  const theLabels: Readonly<Partial<Record<string, string>>> = SKILL_LABELS;
  const skillStr = (s: TheSkillsOfASetUp | null | undefined) =>
    Object.entries(s ?? {})
      .filter(([, v]) => Number(v) > 0)
      .map(([k, v]) => `${(theLabels[k] ?? '') || k} ${String(v)}`)
      .join(', ') || '—';
  const row = (sp: ARealmsSetupInThePlan) => kcHtml`
    <div style="display:flex;flex-wrap:wrap;gap:6px 14px;align-items:baseline;padding:7px 10px;border:1px solid #d8cbb0;border-radius:3px;margin-bottom:6px;background:${sp.isBot ? '#f4efe4' : '#fff'}">
      <strong style="min-width:150px">${sp.isBot ? '🤖 ' : ''}${sp.kingdomName}</strong>
      <span style="color:var(--stone);font-size:.82rem">${sp.kingName} · ${sp.alignment} · ${sp.race} · ${sp.temper}</span>
      <span style="font-size:.78rem;opacity:.85;margin-left:auto">Skills: ${skillStr(sp.skills)}</span>
    </div>`;
  const humansHtml = humanSetups.length
    ? kcHtml`<div style="font-size:.8rem;color:var(--stone);margin:2px 0 4px">Human players (${humanSetups.length})</div>${humanSetups.map((sp) => row(sp))}`
    : '';
  const botsHtml = kcHtml`<div style="font-size:.8rem;color:var(--stone);margin:8px 0 4px">🤖 Bot realms (${botSetups.length})</div>${botSetups.map((sp) => row(sp))}`;
  theElementFound(msg).innerHTML = String(kcHtml`
    <div class="card" style="border-color:var(--crimson)">
      <h3 style="margin-top:0">Confirm the starting roster</h3>
      <div class="msg-info" style="margin-bottom:8px">Review the generated bot realms below. Generate the world to lock them in, or re-roll the bots.</div>
      ${humansHtml}
      ${botsHtml}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button class="btn btn-crimson" onclick="commitTurn0()">⚡ Generate World &amp; Start</button>
        <button class="btn btn-gold" onclick="runTurn0()">🎲 Re-roll Bots</button>
        <button class="btn btn-ghost" onclick="_pendingTurn0=null;document.getElementById('detail-msg').innerHTML=''">Cancel</button>
      </div>
    </div>`);
}

// Commit the prepared Turn-0 plan: persist bot rows, generate the world, push reports.
export async function commitTurn0() {
  const msg = document.getElementById('detail-msg');
  if (!_pendingTurn0) {
    theElementFound(msg).innerHTML = '<div class="msg-error">No pending setup — press Run Turn 0 again.</div>';
    return;
  }
  const { humanSetups, botSetups, sz, maxTurns, seaPct, botDiplomacy, safeStart } = _pendingTurn0;
  theElementFound(msg).innerHTML = '<div class="msg-info">⏳ Generating world map and starting positions…</div>';

  try {
    // 1. Persist bot rows first (clean slate: remove any leftover bot rows from an aborted run).
    // Bots are the only rows with a null user_id, so this only ever deletes bots.
    if (botSetups.length > 0) {
      await thePagesDb.theTurnZeroAsTheGameMasterRunsIt.removeEveryBotsRealmOfThisGame(
        theGameOpenNow("read properties of null (reading 'id')").id,
      );
      for (const b of botSetups) {
        const { data: brow, error: bErr } = await thePagesDb.theTurnZeroAsTheGameMasterRunsIt.makeThisBotsRealm({
          game_id: theGameOpenNow("read properties of null (reading 'id')").id,
          user_id: null,
          player_index: b.id,
          display_name: b.kingdomName,
          orders_submitted: false,
          // isBot marker lives in the JSON (no DB column needed); playerSetup mirrors a human join.
          turn_report: JSON.stringify({
            isBot: true,
            playerSetup: {
              kingName: b.kingName,
              kingdomName: b.kingdomName,
              race: b.race,
              alignment: b.alignment,
              temper: b.temper,
              skills: b.skills,
            },
            status: 'bot',
            waitingForTurn0: true,
          }),
        });
        if (bErr) {
          theElementFound(msg).innerHTML = String(
            kcHtml`<div class="msg-error">Could not create bot realm: ${bErr.message}</div>`,
          );
          return;
        }
        b.gamePlayerId = theRowMade(brow).id;
      }
    }

    // 2. Combined, index-sorted setup list — humans then bots, contiguous indices.
    const setupPlayers = [...humanSetups, ...botSetups]
      .map((sp: ARealmsSetupInThePlan) => ({
        id: sp.id,
        gamePlayerId: sp.gamePlayerId,
        isBot: sp.isBot,
        name: sp.kingdomName,
        kingName: sp.kingName,
        kingdomName: sp.kingdomName,
        race: sp.race,
        alignment: sp.alignment,
        temper: sp.temper,
        skills: sp.skills,
      }))
      .sort((a, b) => a.id - b.id);

    // 3. Generate the world.
    // (the world is made at once; the await of its value is kept, so what follows runs on the same tick as before)
    const gameState: unknown = await Promise.resolve(generateNewGame(setupPlayers, sz, maxTurns, { seaPct }));
    refuseASaveThatIsNotAGameInPlay(gameState); // a world just made holds its provinces, realms and heroes: never throws
    if (safeStart) gameState.safeStart = true; // 2026-09-29 (Toby): Safe Start — no diplomacy before Turn SAFE_START_TURN
    gameState.botDiplomacy = botDiplomacy === 'hostile' ? 'hostile' : 'normal'; // 2026-09-26b (Toby item 10): 'hostile' = bots always at war with humans, never allied
    gameState.botDifficulty = 'hard'; // 2026-09-26 (Toby item 9): every bot game plays at the one strength (Easy / Normal retired); the saved cfg value is ignored
    // Turn-running mode carries over from the setup config; a deadline clock starts now (Turn 0 =
    // the first "run").
    {
      const _tm = normalizeTurnMode(
        theField(parseGameState(theGameOpenNow("read properties of null (reading 'game_state')")), 'turnMode'),
      );
      _tm.turnRanAt = new Date().toISOString();
      _tm.nextDeadlineAt = _tm.mode === 'deadline' ? computeNextDeadline(_tm, new Date()) : null;
      const theWorldsTurnMode: { turnMode?: unknown } = gameState; // the turn mode as the page keeps it
      theWorldsTurnMode.turnMode = _tm;
    }
    seedUsedArmyNames(gameState);
    seedUsedHeroNames(gameState);
    const { error: saveErr } = await thePagesDb.theTurnZeroAsTheGameMasterRunsIt.startThisGame(
      theGameOpenNow("read properties of null (reading 'id')").id,
      {
        status: 'active',
        turn: 1,
        game_state: JSON.stringify(gameState),
        ...metaPatch(gameState),
      },
    );
    if (saveErr) {
      theElementFound(msg).innerHTML = String(
        kcHtml`<div class="msg-error">Error saving game: ${saveErr.message}</div>`,
      );
      return;
    }

    // 4. Push turn reports to every realm (humans and bots alike — a bot report is harmless and
    // lets the GM inspect a bot's starting position).
    const reportErrors: string[] = [];
    for (const sp of setupPlayers) {
      const report = buildTurnReport(playerView(gameState, sp.id)); // what the realm sees of the new world; no turn's lines yet
      const theReportStamped: { engineStamp: string | null } = report;
      theReportStamped.engineStamp = runningBuildStamp(); // which GM build wrote it
      const { error: rErr } = await thePagesDb.theTurnZeroAsTheGameMasterRunsIt.giveThisRealmItsFirstReport(
        theRowIdOf(sp),
        sp.isBot
          ? JSON.stringify({
              isBot: true,
              report,
              playerSetup: {
                kingName: sp.kingName,
                kingdomName: sp.kingdomName,
                race: sp.race,
                alignment: sp.alignment,
                temper: sp.temper,
                skills: sp.skills,
              },
            })
          : JSON.stringify(report),
      );
      if (rErr) reportErrors.push(rErr.message);
      try {
        await thePagesDb.theTurnZeroAsTheGameMasterRunsIt.writeThisLog({
          game_id: theGameOpenNow("read properties of null (reading 'id')").id,
          player_index: sp.id,
          turn: 0,
          entries: report,
        });
      } catch {
        /* best-effort */
      }
    }

    const botN = setupPlayers.filter((s) => s.isBot).length,
      humN = setupPlayers.length - botN;
    if (reportErrors.length > 0) {
      theElementFound(msg).innerHTML = String(
        kcHtml`<div class="msg-error">Game created but some reports failed: ${reportErrors.join(', ')}</div>`,
      );
    } else {
      theElementFound(msg).innerHTML = String(
        kcHtml`<div class="msg-success">✅ Turn 0 complete! Map generated for ${humN} human${humN !== 1 ? 's' : ''}${botN ? ` + ${String(botN)} bot${botN !== 1 ? 's' : ''}` : ''}. Players can now log in and see their realms.</div>`,
      );
    }
    _pendingTurn0 = null;
    const theGameStarted = theGameOpenNow("set properties of null (setting 'status')");
    theGameStarted.status = 'active';
    theGameStarted.turn = 1;
    theElementWithTheId('detail-run-turn0-wrap', HTMLElement).style.display = 'none';
    theElementWithTheId('detail-orders-card', HTMLElement).style.display = 'block';
    theElementWithTheId('detail-log-card', HTMLElement).style.display = 'none';
    const { data: refreshed } = await thePagesDb.theTurnZeroAsTheGameMasterRunsIt.thisGameWithItsRealms(
      theGameOpenNow("read properties of null (reading 'id')").id,
    );
    if (refreshed) {
      currentGame = refreshed;
      currentGamePlayers = asItsGuardReadsIt(refreshed.game_players) ?? [];
    }
    renderOrdersStatus(theGameOpenNow("read properties of null (reading 'meta')"));
  } catch (e) {
    theElementFound(msg).innerHTML = String(
      kcHtml`<div class="msg-error">Generation error: ${theField(e, 'message')}</div>`,
    );
    console.error(e);
  }
}
