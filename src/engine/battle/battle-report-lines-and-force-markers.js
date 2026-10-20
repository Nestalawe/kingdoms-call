import { battleLineTiers, battleTallyLine } from './fates.js';
import { druIdPenaltyMult, getDruidLevel } from '../world/tables.js';
import { dispFloor } from '../dice-and-army-names.js';
import { dragonTamed } from '../discoveries.js';
import { emitNarrLine, narrText } from '../turn/log-line-helpers.js';
import { effStat } from '../heroes/effective-skills-and-hidden-heroes.js';
import { seaPenalty, terrainMod } from './terrain-and-unit-strength.js';

// ── BATTLE REPORT LINES AND FORCE MARKERS (plan P1-08c: lifted out of resolveTurn) ────
// The lines a battle report is built from: a force's header row (forceMarker), a unit's quality in words, a hero's
// battlecry, a side's Druid shortfall and terrain notes, and emitBattle, which files a battle's lines in the GM's log
// with its number (turnContext._battleSeq) and each line's tier. forceMarker, druidShortfallLine and emitBattle take the
// turn's context first (src/engine/turn/context.js); the rest read no turn state.
// ── Structured battle-force marker (items 2 & 3) ── Emits a single parseable log line the player
// Chronicle expands into: a header coloured in the owner's map colour (neutral = dark grey) + one
// icon row per unit (same look as "Your Realm").
// playerIdx null → neutral. role: 'attacker' | 'defender'. verbText overrides the default verb.
export function forceMarker(turnContext, name, playerIdx, role, armies, verbText, opts) {
  const { G } = turnContext;
  const color = playerIdx != null && G.players[playerIdx] ? G.players[playerIdx].color || null : null;
  const guard = !!(opts && opts.guard); // a local chieftain's force — the player portal tints it chieftain-brown
  const arr = (armies || []).map((a) => ({
    type: a.type,
    quality: a.quality,
    unitName: a.unitName || '',
    race: a.race || null,
    phantom: !!a._phantom,
    skeletal: !!a._isSkeletal,
    wildHunt: a._wildHuntUntilTurn != null,
    wildHuntUntil: a._wildHuntUntilTurn != null ? a._wildHuntUntilTurn : null,
  })); // Wild Hunt tag rides into battle rows too
  // 2026-09-23 (Toby item 10): a host whose commander fell earlier in the battle series fights
  // on under a captain (_leaderlessHost) — its header must not present the dead man as leading it.
  let _nm = (name || '').replace(' (wandering)', '');
  {
    const _dead = (G.characters || []).find(
      (ch) =>
        ch &&
        ch.alive === false &&
        ch._leaderlessHost &&
        ch.name &&
        _nm.startsWith(ch.name.replace(' (wandering)', '')),
    );
    if (_dead && !/leaderless/i.test(_nm)) {
      const _dn = _dead.name.replace(' (wandering)', '');
      _nm = `${_dn}'s leaderless host` + _nm.slice(_dn.length);
    }
  }
  return (
    '⚑FORCE⚑' +
    JSON.stringify({
      name: _nm,
      color,
      neutral: playerIdx == null,
      guard,
      role: role || '',
      verb: verbText || '',
      armies: arr,
    })
  );
}

export function qualityAdj(quality) {
  return (
    { Green: 'inexperienced', Average: 'seasoned', Veteran: 'veteran', Elite: 'elite', Crack: 'crack' }[quality] ||
    'seasoned'
  );
}

// A character's Encounter-Plan "battlecry" — the words they shout at an enemy (a monster in a
// feature, or a rival character) as combat/duel begins. Stored in encounterPlan.notes by the
// player portal's "Describe your battlecry" field.
export function battlecryOf(ch) {
  const n = ch && ch.encounterPlan && ch.encounterPlan.notes;
  return typeof n === 'string' ? n.trim() : '';
}
export function pushBattlecry(narrative, ch, foeName) {
  const cry = battlecryOf(ch);
  if (!cry) return;
  narrative.push(`📣 ${ch.name} cries out to ${foeName}: “${cry}”`);
}

// ── BATTLE-REPORT AUDIENCE ────
// Full blow-by-blow goes ONLY to the battle's participants (the player(s) whose commanders
// fought). A one-line result summary additionally goes to onlookers — players who had a
// (non-fighting) character in the province. Everyone else sees nothing. This is enforced by the
// report filter using the flags set here: detail lines carry battleDetail:true and target the
// participants; the summary line carries summary:true. (Participants are also in `targets`, so
// they always get the detail.)
// Druid shortfall for one side — ONE line naming every under-led unit (2026-09-23d; was one line a
// unit). Same test both paths used: a unit short of its Druid requirement whose penalty actually
// bites (skeletal / exempt / tamed units return 1.0 and are left out). Inside runTurn because
// dragonTamed is.
export function druidShortfallLine(turnContext, sideName, ch, force, align) {
  if (!ch) return null;
  const lvl = effStat(turnContext, ch, 'druid');
  const m = new Map();
  (force || []).forEach((a) => {
    if (!a || a._phantom) return;
    const req = getDruidLevel(a.type);
    if (Math.max(0, req - lvl) <= 0) return;
    const pen = druIdPenaltyMult(ch, a, align, dragonTamed(turnContext, ch, a));
    if (!(pen < 1)) return;
    const k = `${a.type} −${dispFloor((1 - pen) * 100)}%`;
    m.set(k, (m.get(k) || 0) + 1);
  });
  if (!m.size) return null;
  const n = [...m.values()].reduce((s, x) => s + x, 0);
  return `⚠ Druid shortfall — ${sideName} cannot fully command ${n} unit${n !== 1 ? 's' : ''}: ${[...m].map(([k, c]) => (c > 1 ? `${c}× ${k}` : k)).join(', ')}.`;
}
// Terrain note for one side of a battle: "Free Lances +15%, 2× Forest Ents −40%" (2026-09-23d: both
// battle paths share this — the PvP copy printed "Free Lances:+15%" and mixed both sides
// together). Inside runTurn because terrainMod / seaPenalty are (despite their column-0 indent).
export function terrainNoteList(force, terrain) {
  const m = new Map();
  (force || []).forEach((a) => {
    if (!a || a._phantom) return;
    const combined = terrainMod(a.type, terrain) * seaPenalty(a.type, terrain);
    if (combined < 0.85 || combined > 1.05) {
      const k = `${a.type} ${combined > 1 ? '+' : '−'}${dispFloor(Math.abs(combined - 1) * 100)}%`;
      m.set(k, (m.get(k) || 0) + 1);
    }
  });
  return m.size ? [...m].map(([k, n]) => (n > 1 ? `${n}× ${k}` : k)).join(', ') : null;
}

export function emitBattle(turnContext, battle, prov, ph, participants, opts) {
  const { log } = turnContext;
  opts = opts || {};
  const parts = (participants || []).filter((x) => x != null);
  const base = {
    provinceId: prov && prov.id,
    phase: ph != null ? ph : undefined,
    public: true,
    actor: opts.actor != null ? opts.actor : null,
    charId: opts.charId !== undefined ? opts.charId : null,
    charIds: opts.charIds || null,
    targets: parts,
  };
  // 2026-09-23d (Toby item 1): every line is tagged with this battle's id and its tier, and a
  // losses tally is added (short view only) where the casualty sections begin — see
  // battleLineTiers / battleTallyLine. The player portal folds the full report behind a button.
  const _bid = ++turnContext._battleSeq;
  const _lines = (battle && battle.narrative) || [];
  const _texts = _lines.map(narrText);
  const _tiers = battleLineTiers(_texts);
  let _tally = null;
  try {
    _tally = battleTallyLine(_texts);
  } catch (_e) {
    _tally = null;
  }
  let _tallyDone = false;
  _lines.forEach((line, i) => {
    if (_tally && !_tallyDone && i === _tiers.casIdx) {
      log('combat', _tally, { ...base, battleDetail: true, battleId: _bid, bTier: 't' });
      _tallyDone = true;
    }
    emitNarrLine(turnContext, 'combat', line, {
      ...base,
      battleDetail: true,
      battleId: _bid,
      bTier: _tiers.t[i] || 'k',
    });
  });
  if (_tally && !_tallyDone) log('combat', _tally, { ...base, battleDetail: true, battleId: _bid, bTier: 't' });
  const sTxt = opts.summaryText || (battle && battle.summaryText);
  if (sTxt) log('combat', sTxt, { ...base, summary: true, battleId: _bid, bTier: 's' });
}
