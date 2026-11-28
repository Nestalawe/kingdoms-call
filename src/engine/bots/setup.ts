import { ARMY_UNIT_NAMES } from '../../content/kingdoms-call-data.ts';
import {
  THE_BOTS_STARTING_SKILLS_BY_ALIGNMENT,
  THE_UNIT_WHOSE_COMPANIES_NAMES_NAME_A_BOTS_REALM_BY_ITS_RACE,
} from '../../content/the-worlds-making-its-name-pools-sea-features-wild-beasts-fleets-skill-pools-and-the-bots-realms.ts';
import { THE_BOTS_REALMS } from '../../content/the-worlds-making-its-numbers-by-stage-the-sea-the-capitals-the-taxes-the-lairs-the-seas-the-homes-and-the-heroes.ts';
import { kcRng } from '../rng.ts';
import { RACES_P, TEMPERS_P } from '../world/tables.ts';
import { ALIGNMENTS_P, alignDistP } from '../rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import { theAlignmentsOnlyOneRealmAGameMayHold } from '../rules-on-plain-values/the-world-each-creed-is-made-in-its-wild-country-its-first-skills-and-one-realm-a-game.ts';
import { _toRoman, nextHeroName } from '../names.ts';
import { asItsGuardReadsIt } from '../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import { BOT_ALLY_ALIGN_DIST } from './intel.ts';
import { THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION } from './the-weights-of-the-bots-first-version-what-a-unit-of-each-kind-of-result-is-worth.ts';
import { gameMetaOf } from '../rules-on-plain-values/a-games-settings-read-from-its-row.ts';
import type { GamesRowWithSettings } from '../rules-on-plain-values/a-games-settings-read-from-its-row.ts';
import { theOneThePickFell } from '../orders/spells/what-an-action-spell-of-the-cast-spell-order-is-handed.ts';
import { THE_ALIGNMENT_A_REALM_OF_NONE_READS_AS } from '../../content/alignment-abilities-their-keys-names-numbers-and-words.ts';

/** A games row as its setup-phase settings are read: its `meta`, its `game_state` (JSON or parsed) and its seats. */
interface AGamesRowAsItsSetUpIsRead extends GamesRowWithSettings {
  readonly game_state?: unknown;
  readonly max_players?: number | null | undefined;
}
/** A field of a value parsed from JSON, read as JavaScript reads `value[key]`: for `null` or `undefined`, the TypeError
 *  that read throws. */
function fieldAsJavaScriptReadsIt(value: unknown, key: string): unknown {
  if (value === null || value === undefined) {
    throw new TypeError(`Cannot read properties of ${String(value)} (reading '${key}')`);
  }
  return Reflect.get(Object(value), key);
}
/** A setup's settings as they are held, else none (`x || {}`). */
function aSetUpOrNone(held: unknown): unknown {
  if (held) return held;
  return {};
}
/** A human's setup as the bots' alignments read it: his alignment, if he has chosen one. */
interface AHumansSetupAsTheBotsReadIt {
  readonly alignment?: string | null | undefined;
}
/** A bot realm's setup, as the world's making takes it. */
interface ABotRealmsSetup {
  readonly id: number;
  readonly isBot: true;
  readonly kingName: string;
  readonly kingdomName: string;
  readonly race: string;
  readonly alignment: string;
  readonly temper: string;
  readonly skills: Readonly<Partial<Record<string, number>>>;
}

// ══ BOT PLAYERS — Phase 1: existence & identity ════
// GM-controlled bot realms. Phase 1 generates a bot's identity and persists its row; bots do NOT
// act yet (they submit no orders, so runTurn defaults their characters to Defend). A bot is marked
// by an `isBot:true` flag INSIDE its game_players.turn_report JSON — no Supabase column is required
// (an unknown insert column would be rejected). Bot rows have user_id === null.
// A game's slot as the turn hands it (any value: a bot's has no user, and its report says so).
export function isBotRow(p: unknown): boolean {
  if (!p || fieldAsJavaScriptReadsIt(p, 'user_id')) return false;
  // Disk-IO (2026-09-25): the game list and the auto-turn watcher now fetch slots WITHOUT
  // turn_report (it is the biggest column in the table). On such a row the only rows with no
  // user_id are bots — commitTurn0 deletes every user_id-null row before it inserts the bots, and
  // a human's row always carries a user_id — so a missing turn_report field reads as a bot.
  const report = fieldAsJavaScriptReadsIt(p, 'turn_report');
  if (report === undefined) return true;
  try {
    const r: unknown = typeof report === 'string' ? JSON.parse(report) : report;
    if (r && fieldAsJavaScriptReadsIt(r, 'isBot') === true) return true;
  } catch {
    // a report that isn't JSON reads as a human's
  }
  return false;
}
// Read {botCount, allBot} from a game's setup-phase config (stored in game_state at creation).
export function botConfigFor(game: AGamesRowAsItsSetUpIsRead) {
  let cfg: unknown = gameMetaOf(game) ?? {};
  if (!fieldAsJavaScriptReadsIt(cfg, 'v')) {
    try {
      cfg = typeof game.game_state === 'string' ? JSON.parse(game.game_state) : aSetUpOrNone(game.game_state);
    } catch {
      // a setup that isn't JSON keeps the settings read so far
    }
  }
  const maxP = (game.max_players ?? 0) || 0;
  const allBot = fieldAsJavaScriptReadsIt(cfg, 'allBot') === true;
  const botCount = allBot
    ? maxP
    : Math.max(0, Math.min(parseInt(String(fieldAsJavaScriptReadsIt(cfg, 'botCount'))) || 0, maxP));
  return { botCount, allBot };
}
// Read {private, invited[]} from a game's setup-phase game_state. Games with no `visibility` key
// (all pre-existing games, and every game once it goes active) read as Public with no invite list.
export function gameVisibility(game: AGamesRowAsItsSetUpIsRead) {
  let cfg: unknown = gameMetaOf(game) ?? {};
  if (!fieldAsJavaScriptReadsIt(cfg, 'v')) {
    try {
      cfg = typeof game.game_state === 'string' ? JSON.parse(game.game_state) : aSetUpOrNone(game.game_state);
    } catch {
      // a setup that isn't JSON keeps the settings read so far
    }
  }
  const isPrivate = fieldAsJavaScriptReadsIt(cfg, 'visibility') === 'private';
  const invited = fieldAsJavaScriptReadsIt(cfg, 'invited');
  return { private: isPrivate, invited: isPrivate && Array.isArray(invited) ? invited : [] };
}
// Alignment → four starting skill points (content's row says how they are chosen).
export const BOT_SKILL_BUILD = THE_BOTS_STARTING_SKILLS_BY_ALIGNMENT;
// Divine & Undead are one-per-game — the human join rule's rows (player portal UNIQUE_ALIGNS_CHECK: P1-19ay1).
export const BOT_UNIQUE_ALIGNS = theAlignmentsOnlyOneRealmAGameMayHold();
// Race → a signature unit whose faction-name pool (ARMY_UNIT_NAMES) we borrow for realm names (content's row).
export const BOT_KINGDOM_NAME_UNIT = THE_UNIT_WHOSE_COMPANIES_NAMES_NAME_A_BOTS_REALM_BY_ITS_RACE;
export const _usedBotKingdomNames = new Set<string>();
export function _capRealm(s: string) {
  return s.replace(/^the\b/, 'The');
}
export function botKingdomName(race: string) {
  // the tables read by any name: the races' units (no unit's name is ''), the units' names
  const unitOfRace: Readonly<Partial<Record<string, string>>> = BOT_KINGDOM_NAME_UNIT;
  const namesOfUnit: Readonly<Partial<Record<string, readonly string[]>>> = ARMY_UNIT_NAMES;
  const unit = unitOfRace[race] ?? 'Free Lances';
  const pool = (typeof ARMY_UNIT_NAMES !== 'undefined' ? namesOfUnit[unit] : undefined) ?? ['the Free Company'];
  for (let att = 0; att < THE_BOTS_REALMS.theTriesForANameNotYetTaken; att++) {
    const nm = theOneThePickFell(pool[Math.floor(kcRng() * pool.length)]);
    if (!_usedBotKingdomNames.has(nm)) {
      _usedBotKingdomNames.add(nm);
      return _capRealm(nm);
    }
  }
  const base = theOneThePickFell(pool[Math.floor(kcRng() * pool.length)]);
  let n = THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.botRealmsSetUp.theNumeralFromWhichARepeatedRealmNameIsNumbered,
    nm: string;
  do {
    nm = `${base} ${_toRoman(n)}`;
    n++;
  } while (_usedBotKingdomNames.has(nm));
  _usedBotKingdomNames.add(nm);
  return _capRealm(nm);
}
// Pick a bot alignment: spread across the field, never duplicate a unique alignment already taken.
export function pickBotAlignment(takenCounts: Readonly<Partial<Record<string, number>>>) {
  const used = new Set(Object.keys(takenCounts).filter((a) => Number(takenCounts[a]) > 0));
  const legal = ALIGNMENTS_P.filter((a) => !(BOT_UNIQUE_ALIGNS.includes(a) && used.has(a)));
  const unused = legal.filter((a) => !used.has(a));
  const pool = unused.length ? unused : legal.filter((a) => !BOT_UNIQUE_ALIGNS.includes(a));
  const safePool = pool.length ? pool : [THE_ALIGNMENT_A_REALM_OF_NONE_READS_AS];
  let bestN = Infinity;
  safePool.forEach((a) => {
    const n = takenCounts[a] ?? 0;
    if (n < bestN) bestN = n;
  });
  const ties = safePool.filter((a) => (takenCounts[a] ?? 0) === bestN);
  return theOneThePickFell(ties[Math.floor(kcRng() * ties.length)]);
}
// ── BALANCED ALIGNMENT SPREAD ────
// With humans in the game the bots' alignments are no longer merely "spread out": they are chosen
// so that EACH human faces roughly half bots who would ally with them and half who would go to war.
// Under the item 3 rule a bot's stance toward a human is fixed by the spectrum — alignDistP <= 1 is
// a future ally, >= 2 is a future enemy — so the alignments ARE the diplomacy, decided at world
// gen.
//
// Greedy, one bot slot at a time. For each legal candidate alignment we count, per human, whether
// that candidate would be a friend of theirs, and charge the side that human already has MORE of:
//
// cost = Σ_humans ( candidate is that human's friend ? friendsSoFar[h]: foesSoFar[h] )
//
// so every pick fills whichever column is currently shorter for each human, and the two converge on
// half and half. A small spread term keeps alignment variety (and so a varied world) when the
// balance term ties, and ties are then broken at random. Divine/Undead uniqueness is honoured
// exactly as
// pickBotAlignment does. `humanAligns` empty (an all-bot game) → fall back to pickBotAlignment.
export function pickBotAlignmentBalanced(
  takenCounts: Readonly<Partial<Record<string, number>>>,
  humanAligns: readonly string[] | null | undefined,
  friends: readonly number[],
  foes: readonly number[],
) {
  if (!humanAligns?.length) return pickBotAlignment(takenCounts);
  const used = new Set(Object.keys(takenCounts).filter((a) => Number(takenCounts[a]) > 0));
  const legal = ALIGNMENTS_P.filter((a) => !(BOT_UNIQUE_ALIGNS.includes(a) && used.has(a)));
  const pool = legal.length ? legal : [THE_ALIGNMENT_A_REALM_OF_NONE_READS_AS];
  let best: { readonly cost: number; readonly ties: string[] } | null = null;
  for (const a of pool) {
    let cost = 0;
    humanAligns.forEach((ha, h) => {
      const friendly = alignDistP(a, ha) <= BOT_ALLY_ALIGN_DIST;
      cost += friendly ? (friends[h] ?? 0) : (foes[h] ?? 0);
    });
    cost += (takenCounts[a] ?? 0) * THE_BOTS_REALMS.theCostOfEachRealmOfAnAlignmentInPlay; // mild preference for an alignment not yet in play
    if (!best || cost < best.cost) best = { cost, ties: [a] };
    else if (Math.abs(cost - best.cost) < 1e-9) best.ties.push(a);
  }
  if (best === null) throw new TypeError("Cannot read properties of null (reading 'ties')"); // the pool holds one
  return theOneThePickFell(best.ties[Math.floor(kcRng() * best.ties.length)]);
}
// Generate `count` bot setup objects, indexed startIndex..startIndex+count-1 (kept CONTIGUOUS with
// the human indices so generateNewGame's array-position player id matches
// game_players.player_index). humanSetups seed the alignment spread + uniqueness so bots avoid
// clustering on the humans' choices, and drive the half-friendly / half-hostile balance described
// above.
export function generateBotSetups(
  humanSetups: readonly AHumansSetupAsTheBotsReadIt[] | null | undefined,
  count: number,
  startIndex: number,
): ABotRealmsSetup[] {
  const takenCounts: Partial<Record<string, number>> = {};
  (humanSetups ?? []).forEach((s) => {
    if (s.alignment) takenCounts[s.alignment] = (takenCounts[s.alignment] ?? 0) + 1;
  });
  const humanAligns = (humanSetups ?? [])
    .map((s) => asItsGuardReadsIt(s)?.alignment)
    .filter((a): a is string => Boolean(a));
  const friends = humanAligns.map(() => 0),
    foes = humanAligns.map(() => 0);
  const bots: ABotRealmsSetup[] = [];
  for (let i = 0; i < count; i++) {
    const alignment = pickBotAlignmentBalanced(takenCounts, humanAligns, friends, foes);
    humanAligns.forEach((ha, h) => {
      if (alignDistP(alignment, ha) <= BOT_ALLY_ALIGN_DIST) friends[h] = Number(friends[h]) + 1;
      else foes[h] = Number(foes[h]) + 1;
    });
    takenCounts[alignment] = (takenCounts[alignment] ?? 0) + 1;
    const race = theOneThePickFell(RACES_P[Math.floor(kcRng() * RACES_P.length)]);
    const temper = theOneThePickFell(TEMPERS_P[Math.floor(kcRng() * TEMPERS_P.length)]);
    // the builds read by any alignment's name
    const buildOf: Readonly<Partial<Record<string, Readonly<Partial<Record<string, number>>>>>> = BOT_SKILL_BUILD;
    const skills = { ...(buildOf[alignment] ?? BOT_SKILL_BUILD[THE_ALIGNMENT_A_REALM_OF_NONE_READS_AS]) };
    bots.push({
      id: startIndex + i,
      isBot: true,
      kingName: nextHeroName(alignment),
      kingdomName: botKingdomName(race),
      race,
      alignment,
      temper,
      skills,
    });
  }
  return bots;
}
