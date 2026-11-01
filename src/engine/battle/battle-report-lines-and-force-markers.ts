import { druIdPenaltyMult } from '../world/tables.ts';
import { getDruidLevel } from '../rules-on-plain-values/beasts-a-hero-may-lead-and-the-druid-each-unit-needs.ts';
import { dragonTamed } from '../discoveries.ts';
import {
  A_TIER_WORKED_OUT_FROM_THE_WORDS_OF_THE_BATTLES_LINES,
  emit,
  emitNarrLine,
  isALineForEveryoneInTheFight,
  narrate,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
} from '../turn/events-and-their-audiences.ts';
import { effStat } from '../heroes/effective-skills-and-hidden-heroes.ts';
import { seaPenalty, terrainMod } from './terrain-and-unit-strength.ts';
import type { Quality } from '../../content/kingdoms-call-data.ts';
import type { Army, Character, Province } from '../../schemas/saved-game-state.ts';
import type { TurnContext } from '../turn/context.ts';
import type { FightLine, NarrativeLine } from '../turn/events-and-their-audiences.ts';
import {
  THE_PLACE_OF_A_BATTLES_LOSSES_TALLY,
  type AForceDrawnUpForBattle,
  type ASideAsABattlesReportLinesNameIt,
  type AUnitTheTerrainMarks,
  type AUnitsDruidShortfall,
  type HowAForceComesOnInItsHeader,
  type TheForceABattlesHeaderNames,
} from './the-facts-a-battles-lines-record.ts';

// ── BATTLE REPORT LINES AND FORCE MARKERS (plan P1-08c: lifted out of resolveTurn) ────
// The lines a battle report is built from: a force's header row (forceMarker), a unit's quality in words, a hero's
// battlecry, a side's Druid shortfall and terrain notes, and emitBattle, which files a battle's lines in the GM's log
// with its number (turnContext._battleSeq) and each line's tier. forceMarker, druidShortfallLine and emitBattle take the
// turn's context first (src/engine/turn/context.ts); the rest read no turn state.
// ── Structured battle-force marker (items 2 & 3) ── The fact of a single parseable log line the player
// Chronicle expands into: a header coloured in the owner's map colour (neutral = dark grey) + one
// icon row per unit (same look as "Your Realm"). Since P1-12c3 it returns the fact, and the views write its words
// ('⚑FORCE⚑' and the header as JSON: src/views/prose/the-words-of-a-battles-lines.ts).
// theForce: the force the header names, as a record (P1-12d29: the prose writes its name). playerIdx null → neutral.
// role: 'attacker' | 'defender'. howItComesOn: its header's verb as its values (P1-12d20: the prose writes the words),
// or none for an empty verb.
export function forceMarker(
  turnContext: TurnContext,
  theForce: TheForceABattlesHeaderNames,
  playerIdx: number | null | undefined,
  role: string | null | undefined,
  armies: Army[] | null | undefined,
  howItComesOn?: HowAForceComesOnInItsHeader | null,
  opts?: { guard?: boolean | undefined } | null,
): AForceDrawnUpForBattle {
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
  // on under a captain (_leaderlessHost) — its header must not present the dead man as leading it. The check reads the
  // name as the header writes it (P1-12d29: a copy of the prose's words, below), and the fact holds the fallen
  // commander it found; the prose writes "<his name>'s leaderless host".
  const _nm = theNameAForcesHeaderIsCheckedBy(theForce);
  let fallenCommandersName: string | null = null;
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
      fallenCommandersName = _dead.name.replace(' (wandering)', '');
    }
  }
  return {
    kind: 'a force drawn up for battle',
    theForce,
    fallenCommandersName,
    color,
    neutral: playerIdx == null,
    guard,
    role: role || '',
    howItComesOn: howItComesOn ?? null,
    armies: arr,
  };
}

/** The name a force's header gives before the leaderless check, " (wandering)" cut: a copy of the prose's words
 *  (theNameOfTheForceAHeaderNames, src/views/prose/the-words-of-a-battles-lines.ts) for forceMarker's leaderless check
 *  alone, word for word as the battles composed it before P1-12d29 (the realm's brackets only for a hero who serves one:
 *  P1-23a). A unit case pins it to the prose's words over every form (the views test); it goes with the Parked fix of
 *  the check (the battle telling forceMarker its side is leaderless). */
export function theNameAForcesHeaderIsCheckedBy(theForce: TheForceABattlesHeaderNames): string {
  let name: string;
  switch (theForce.kind) {
    case 'a hero, with the realm he serves':
      name = `${theForce.heroName}${theForce.servesARealm ? ` (${String(theForce.realmName)})` : ''}`;
      break;
    case "a province's guard at the head of its force":
      name = theForce.guardName;
      break;
    case "a realm's garrison at a province":
      name = `${theForce.ownerName}'s garrison at ${theForce.provName}`;
      break;
    case "a province's own defenders with no one to lead them":
      name = `The defenders of ${theForce.provName}`;
      break;
  }
  return name.replace(' (wandering)', '');
}

export function qualityAdj(quality: Quality) {
  return (
    { Green: 'inexperienced', Average: 'seasoned', Veteran: 'veteran', Elite: 'elite', Crack: 'crack' }[quality] ||
    'seasoned'
  );
}

// A character's Encounter-Plan "battlecry" — the words they shout at an enemy (a monster in a
// feature, or a rival character) as combat/duel begins. Stored in encounterPlan.notes by the
// player portal's "Describe your battlecry" field.
export function battlecryOf(ch: Character | null | undefined) {
  const n = ch && ch.encounterPlan && ch.encounterPlan.notes;
  return typeof n === 'string' ? n.trim() : '';
}
export function pushBattlecry(narrative: NarrativeLine[], ch: Character, foeName: string) {
  const cry = battlecryOf(ch);
  if (!cry) return;
  narrate(narrative, { kind: 'a hero cries out his battlecry to his foe', heroName: ch.name, foeName, battlecry: cry });
}

// ── BATTLE-REPORT AUDIENCE ────
// Full blow-by-blow goes ONLY to the battle's participants (the player(s) whose commanders
// fought): emitBattle files every line with the fight's audience (told to the participants, seen
// 'battle'). The one-line result summary (tier 's') was meant for onlookers too — players who had
// a (non-fighting) character in the province — but the line never carried the summary flag the
// report filter looks for, so today it reaches the participants alone, like the rest (plan P1-12,
// Decision 3: kept as it is until Toby answers the onlookers' question).
// Druid shortfall for one side — ONE line naming every under-led unit (2026-09-23d; was one line a
// unit). Same test both paths used: a unit short of its Druid requirement whose penalty actually
// bites (skeletal / exempt / tamed units return 1.0 and are left out). Inside runTurn because
// dragonTamed is.
export function druidShortfallLine(
  turnContext: TurnContext,
  sideName: ASideAsABattlesReportLinesNameIt,
  ch: Character | null | undefined,
  force: Army[] | null | undefined,
  align: string,
) {
  if (!ch) return null;
  const lvl = effStat(turnContext, ch, 'druid');
  const shortfalls: AUnitsDruidShortfall[] = [];
  (force || []).forEach((a) => {
    if (!a || a._phantom) return;
    const req = getDruidLevel(a.type);
    if (Math.max(0, req - lvl) <= 0) return;
    const pen = druIdPenaltyMult(ch, a, align, dragonTamed(turnContext, ch, a));
    if (!(pen < 1)) return;
    shortfalls.push({ unitType: a.type, penalty: pen });
  });
  if (!shortfalls.length) return null;
  return {
    kind: "a side's Druid cannot fully command its units",
    sideName,
    unitCount: shortfalls.length,
    shortfalls,
  };
}
// Terrain note for one side of a battle: "Free Lances +15%, 2× Forest Ents −40%" (2026-09-23d: both
// battle paths share this — the PvP copy printed "Free Lances:+15%" and mixed both sides
// together). Inside runTurn because terrainMod / seaPenalty are (despite their column-0 indent).
export function terrainNoteList(force: Army[] | null | undefined, terrain: string): AUnitTheTerrainMarks[] | null {
  const marked: AUnitTheTerrainMarks[] = [];
  (force || []).forEach((a) => {
    if (!a || a._phantom) return;
    const combined = terrainMod(a.type, terrain) * seaPenalty(a.type, terrain);
    if (combined < 0.85 || combined > 1.05) marked.push({ unitType: a.type, multiplier: combined });
  });
  return marked.length ? marked : null;
}

export function emitBattle(
  turnContext: TurnContext,
  battle: { narrative?: NarrativeLine[] | undefined; summaryText?: NarrativeLine | undefined } | null | undefined,
  prov: Province | null | undefined,
  ph: number | null | undefined,
  participants: (number | null | undefined)[] | null | undefined,
  opts?: {
    actor?: number | null | undefined;
    charId?: number | null | undefined;
    charIds?: number[] | null | undefined;
    summaryText?: NarrativeLine | undefined;
  } | null,
) {
  opts = opts || {};
  const parts = (participants || []).filter((x) => x != null);
  // Every line of the battle, told to those who fought in it (and to the realm whose battle it is), in its province
  // and at its phase. A battle with no province would be read by the world, as buildReports reads a public line with
  // none (no battle has none today).
  const provinceId = prov && prov.id;
  const fight: FightLine = {
    type: 'combat',
    audience: {
      realms: parts,
      actor: opts.actor != null ? opts.actor : null,
      seen: provinceId == null ? 'world' : 'battle',
    },
    province: provinceId,
    phase: ph != null ? ph : undefined,
    hero: opts.charId ?? THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    heroes: opts.charIds || null,
  };
  // 2026-09-23d (Toby item 1): every line is tagged with this battle's id and its tier, and a
  // losses tally is added (short view only) where the casualty sections begin — see
  // theTiersOfABattlesLines / battleTallyLine. The player portal folds the full report behind a button.
  // Since P1-12c3 the tiers and the tally are worked out in the views, once the battle's lines are all filed (since
  // P1-12d34 the tiers from the lines' kinds, the tally from their words: theTurnsLinesInWords,
  // src/views/prose/the-words-of-each-line.ts): each line is filed with its tier still to work out, and the tally's
  // place after them, with the fight's event (its audience, hero and place, as the tally had). A tally is made from lines for everyone in the fight (the casualty lists, a breach), so a battle with none
  // has no place for one.
  const _bid = ++turnContext._battleSeq;
  const _lines = (battle && battle.narrative) || [];
  _lines.forEach((line) => {
    emitNarrLine(turnContext, line, {
      ...fight,
      battle: { id: _bid, tier: A_TIER_WORKED_OUT_FROM_THE_WORDS_OF_THE_BATTLES_LINES },
    });
  });
  if (_lines.some(isALineForEveryoneInTheFight))
    emit(turnContext, {
      ...fight,
      fact: THE_PLACE_OF_A_BATTLES_LOSSES_TALLY,
      battle: { id: _bid, tier: 't' },
    });
  // Read with an `if`, not `||` (P1-12d12): TypeScript can't reduce the union `||` makes of every kind of line.
  let sTxt = opts.summaryText;
  if (!sTxt && battle) sTxt = battle.summaryText;
  if (sTxt) emit(turnContext, { ...fight, fact: sTxt, battle: { id: _bid, tier: 's' } });
}
