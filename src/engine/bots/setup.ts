// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { ARMY_UNIT_NAMES } from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';
import { ALIGNMENTS_P, RACES_P, TEMPERS_P, alignDistP } from '../world/tables.ts';
import { _toRoman, nextHeroName } from '../names.ts';
import { BOT_ALLY_ALIGN_DIST } from './intel.ts';

// ══ BOT PLAYERS — Phase 1: existence & identity ════
// GM-controlled bot realms. Phase 1 generates a bot's identity and persists its row; bots do NOT
// act yet (they submit no orders, so runTurn defaults their characters to Defend). A bot is marked
// by an `isBot:true` flag INSIDE its game_players.turn_report JSON — no Supabase column is required
// (an unknown insert column would be rejected). Bot rows have user_id === null.
export function isBotRow(p) {
  if (!p || p.user_id) return false;
  // Disk-IO (2026-09-25): the game list and the auto-turn watcher now fetch slots WITHOUT
  // turn_report (it is the biggest column in the table). On such a row the only rows with no
  // user_id are bots — commitTurn0 deletes every user_id-null row before it inserts the bots, and
  // a human's row always carries a user_id — so a missing turn_report field reads as a bot.
  if (p.turn_report === undefined) return true;
  try {
    const r = typeof p.turn_report === 'string' ? JSON.parse(p.turn_report) : p.turn_report;
    if (r && r.isBot === true) return true;
  } catch (e) {}
  return false;
}
export function gameMetaOf(game) {
  if (!game || game.meta == null) return null;
  try {
    const m = typeof game.meta === 'string' ? JSON.parse(game.meta) : game.meta;
    return m && typeof m === 'object' && m.v ? m : null;
  } catch (e) {
    return null;
  }
}
// Read {botCount, allBot} from a game's setup-phase config (stored in game_state at creation).
export function botConfigFor(game) {
  let cfg = gameMetaOf(game) || {};
  if (!cfg.v) {
    try {
      cfg = typeof game.game_state === 'string' ? JSON.parse(game.game_state) : game.game_state || {};
    } catch (e) {}
  }
  const maxP = game.max_players || 0;
  const allBot = cfg.allBot === true;
  const botCount = allBot ? maxP : Math.max(0, Math.min(parseInt(cfg.botCount) || 0, maxP));
  return { botCount, allBot };
}
// Read {private, invited[]} from a game's setup-phase game_state. Games with no `visibility` key
// (all pre-existing games, and every game once it goes active) read as Public with no invite list.
export function gameVisibility(game) {
  let cfg = gameMetaOf(game) || {};
  if (!cfg.v) {
    try {
      cfg = typeof game.game_state === 'string' ? JSON.parse(game.game_state) : game.game_state || {};
    } catch (e) {}
  }
  const isPrivate = cfg.visibility === 'private';
  return { private: isPrivate, invited: isPrivate && Array.isArray(cfg.invited) ? cfg.invited : [] };
}
// Alignment → four starting skill points, drawn from each alignment's Title signature lane
// (see KC-design-victory-and-titles.md §5). Real engine skills only (SKILL_LABELS). Each totals 4.
export const BOT_SKILL_BUILD = {
  // Sept 2026 (bot strategy batch): every build now carries Tactical >=1 so the bot king can drill
  // his host from turn 1 — Divine swaps druid->tactical, Neutral drops a Sage point, Pagan drops an
  // Explorer point.
  Divine: { white: 2, tactical: 1, melee: 1 },
  Good: { melee: 1, tactical: 1, march: 1, white: 1 },
  Druidic: { druid: 2, tactical: 1, archery: 1 },
  Neutral: { sage: 1, tactical: 1, spy: 1, thief: 1 },
  Pagan: { explorer: 1, elemental: 1, tactical: 1, melee: 1 },
  Evil: { melee: 2, tactical: 1, necromancy: 1 },
  Undead: { necromancy: 2, melee: 1, tactical: 1 },
};
// Divine & Undead are one-per-game — mirrors the human join rule (player portal
// UNIQUE_ALIGNS_CHECK).
export const BOT_UNIQUE_ALIGNS = ['Divine', 'Undead'];
// Race → a signature unit whose faction-name pool (ARMY_UNIT_NAMES) we borrow for realm names.
// This reuses existing themed pools rather than inventing new name content (the engine has no
// realm-name generator: human players type theirs).
export const BOT_KINGDOM_NAME_UNIT = {
  Human: 'Free Lances',
  Elven: 'Elven Bowmen',
  Dwarven: 'Dwarven Guard',
  Orcish: 'Orc Berserkers',
};
export const _usedBotKingdomNames = new Set();
export function _capRealm(s) {
  return String(s).replace(/^the\b/, 'The');
}
export function botKingdomName(race) {
  const unit = BOT_KINGDOM_NAME_UNIT[race] || 'Free Lances';
  const pool = (typeof ARMY_UNIT_NAMES !== 'undefined' && ARMY_UNIT_NAMES[unit]) || ['the Free Company'];
  for (let att = 0; att < 400; att++) {
    const nm = pool[Math.floor(kcRng() * pool.length)];
    if (!_usedBotKingdomNames.has(nm)) {
      _usedBotKingdomNames.add(nm);
      return _capRealm(nm);
    }
  }
  const base = pool[Math.floor(kcRng() * pool.length)];
  let n = 2,
    nm;
  do {
    nm = `${base} ${_toRoman(n)}`;
    n++;
  } while (_usedBotKingdomNames.has(nm));
  _usedBotKingdomNames.add(nm);
  return _capRealm(nm);
}
// Pick a bot alignment: spread across the field, never duplicate a unique alignment already taken.
export function pickBotAlignment(takenCounts) {
  const used = new Set(Object.keys(takenCounts).filter((a) => takenCounts[a] > 0));
  const legal = ALIGNMENTS_P.filter((a) => !(BOT_UNIQUE_ALIGNS.includes(a) && used.has(a)));
  const unused = legal.filter((a) => !used.has(a));
  const pool = unused.length ? unused : legal.filter((a) => !BOT_UNIQUE_ALIGNS.includes(a));
  const safePool = pool.length ? pool : ['Neutral'];
  let bestN = Infinity;
  safePool.forEach((a) => {
    const n = takenCounts[a] || 0;
    if (n < bestN) bestN = n;
  });
  const ties = safePool.filter((a) => (takenCounts[a] || 0) === bestN);
  return ties[Math.floor(kcRng() * ties.length)];
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
export function pickBotAlignmentBalanced(takenCounts, humanAligns, friends, foes) {
  if (!humanAligns || !humanAligns.length) return pickBotAlignment(takenCounts);
  const used = new Set(Object.keys(takenCounts).filter((a) => takenCounts[a] > 0));
  const legal = ALIGNMENTS_P.filter((a) => !(BOT_UNIQUE_ALIGNS.includes(a) && used.has(a)));
  const pool = legal.length ? legal : ['Neutral'];
  let best = null;
  pool.forEach((a) => {
    let cost = 0;
    humanAligns.forEach((ha, h) => {
      const friendly = alignDistP(a, ha) <= BOT_ALLY_ALIGN_DIST;
      cost += friendly ? friends[h] || 0 : foes[h] || 0;
    });
    cost += (takenCounts[a] || 0) * 0.25; // mild preference for an alignment not yet in play
    if (!best || cost < best.cost) best = { cost, ties: [a] };
    else if (Math.abs(cost - best.cost) < 1e-9) best.ties.push(a);
  });
  return best.ties[Math.floor(kcRng() * best.ties.length)];
}
// Generate `count` bot setup objects, indexed startIndex..startIndex+count-1 (kept CONTIGUOUS with
// the human indices so generateNewGame's array-position player id matches
// game_players.player_index). humanSetups seed the alignment spread + uniqueness so bots avoid
// clustering on the humans' choices, and drive the half-friendly / half-hostile balance described
// above.
export function generateBotSetups(humanSetups, count, startIndex) {
  const takenCounts = {};
  (humanSetups || []).forEach((s) => {
    if (s.alignment) takenCounts[s.alignment] = (takenCounts[s.alignment] || 0) + 1;
  });
  const humanAligns = (humanSetups || []).map((s) => s && s.alignment).filter(Boolean);
  const friends = humanAligns.map(() => 0),
    foes = humanAligns.map(() => 0);
  const bots = [];
  for (let i = 0; i < count; i++) {
    const alignment = pickBotAlignmentBalanced(takenCounts, humanAligns, friends, foes);
    humanAligns.forEach((ha, h) => {
      if (alignDistP(alignment, ha) <= BOT_ALLY_ALIGN_DIST) friends[h]++;
      else foes[h]++;
    });
    takenCounts[alignment] = (takenCounts[alignment] || 0) + 1;
    const race = RACES_P[Math.floor(kcRng() * RACES_P.length)];
    const temper = TEMPERS_P[Math.floor(kcRng() * TEMPERS_P.length)];
    const skills = { ...(BOT_SKILL_BUILD[alignment] || BOT_SKILL_BUILD.Neutral) };
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
