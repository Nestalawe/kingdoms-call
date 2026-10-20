// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { safeStartLocked } from '../army-tables.ts';
import { botAlignFriendly } from './intel.ts';
import { BOT_WAR, botOwnPower, botRivalPower, botWarAssess } from './war.ts';
import { areAllied, relationBetween } from '../realms/relations-and-captures.ts';

// ── BOT DIPLOMACY: TREATS AND WARS BY ALIGNMENT, THE GRUDGE AND A RECKONING CLAIM (plan P1-08l1: lifted out of
// resolveTurn) ──────────────────────────────────────────────────────────────────────────────────────────────────────
// Each bot realm writes its declarations for the turn into the realms' declarations (turnContext.diploDeclarations),
// as a human realm's arrive with its orders: a Treat or war on each rival it had met when the turn began
// (turnContext._botEncounteredAtStart). Before that, a human realm's declaration of war on a bot is remembered for good
// (the grudge, kept on the bot's own record). The rules, in order, are in the comment at the top of the function.
// resolveTurn calls it twice: before the first phase, between the research choices and war without warning, so an Evil
// or Undead bot's war is in force this very turn; and again after the phases, just before diplomacy is resolved, on the
// world as the phases left it (the same rivals: those met when the turn began). It does nothing while Safe Start holds.
// It takes the turn's context (src/engine/turn/context.ts) and nothing else; its lines keep resolveTurn's indent (plan
// P1-08's Decisions).
export function botDiplomacyTreatsAndWarsByAlignmentTheGrudgeAndAReckoningClaim(turnContext) {
  const { G, diploDeclarations, _botPlayerIdx, _botEncounteredAtStart } = turnContext;
  if (safeStartLocked(G, G.turn)) return; // SAFE START: bots make no Treat or declaration before Turn SAFE_START_TURN either
  // ── BOT DIPLOMACY — ALIGNMENT DECIDES ────
  //
  // ALIGNMENTS_P is the moral spectrum — Divine(0) Good(1) Druidic(2) Neutral(3) Pagan(4) Evil(5)
  // Undead(6) — and it is now the WHOLE of a bot's foreign policy, replacing the old war-on-contact
  // default and the "bots are one bloc while a human king lives" rule:
  //
  // alignDistP <= 1 (same alignment, or one step along the spectrum)
  // → TREAT, every turn, until the pact is sealed. The engine moves one step per turn and only
  // on a MUTUAL treat (Enemy→Neutral→Allied), so a bot simply keeps offering: two adjacent
  // bots ally by construction (both sides declare in this same pass), and a human ally-to-be
  // joins by treating back. Stops once allied — there is nothing further to offer.
  // alignDistP >= 2 → WAR, if not already at war. No exceptions: a Divine bot fights Pagan, Evil and
  // Undead crowns whoever they are, human or bot.
  //
  // Because a distant rival is never treated with, a bot can never BE allied to a realm 2+ steps
  // away, so the war declaration above can never break one of its own alliances.
  //
  // ── LATE-GAME ESCAPE HATCH ────
  // Alignment governs the whole game EXCEPT at the very end. Once a rival holds a LIVE RECKONING
  // CLAIM, the bots' own alliance with him is no longer worth more than the game: every bot not
  // making the claim declares war on the claimant, even an alignment-brother it has been allied
  // with for twenty turns, and treats every OTHER realm (including ones 2+ steps away) so the field
  // can unite to deny him. This is deliberately narrower than the old coalition: it needs an actual
  // claim on the board, not merely a front-runner near the threshold, so ordinary play stays purely
  // alignment-driven and legible from the alignment wheel alone.
  // ── THE GRUDGE ────
  // A HUMAN king who declares war on a bot has burned that bridge permanently. The bot remembers it
  // for the rest of the game and will never again offer that realm a Treat — not when their
  // alignments sit one step apart, not when the field is uniting to deny a Reckoning claim. Since a
  // pact can only be sealed by a MUTUAL treat, refusing to offer is enough to make an alliance (or
  // even a return to peace) impossible. Stored on the bot's own player record so it survives the
  // save, and recorded from the raw declarations before they are resolved, so the grudge is already
  // in force on the very turn war is declared.
  Object.keys(diploDeclarations).forEach((k) => {
    const from = Number(k);
    if (!Number.isInteger(from) || _botPlayerIdx.has(from)) return; // human declarations only
    const decl = diploDeclarations[from] || {};
    Object.keys(decl).forEach((k2) => {
      const to = Number(k2);
      if (decl[k2] !== 'enemy' || !_botPlayerIdx.has(to)) return;
      const bp = (G.players || [])[to];
      if (!bp) return;
      if (!Array.isArray(bp.botGrudges)) bp.botGrudges = [];
      if (!bp.botGrudges.includes(from)) bp.botGrudges.push(from);
    });
  });
  const _grudgeAgainst = (botIdx, rival) => (((G.players || [])[botIdx] || {}).botGrudges || []).includes(rival);

  const _kingAliveIdx = new Set(
    (G.characters || []).filter((c) => c && c.alive && c.isKing && c.player != null).map((c) => c.player),
  );
  const _hasLand = (idx) => (((G.players || [])[idx] || {}).provinces || []).length > 0;
  const _conceded = (idx) => !!((G.players || [])[idx] || {}).conceded;
  // The claimant, if any — the only thing that can override alignment.
  const claimBy = G.reckoning && G.reckoning.by != null && _kingAliveIdx.has(G.reckoning.by) ? G.reckoning.by : -1;
  _botPlayerIdx.forEach((idx) => {
    if (_conceded(idx)) return; // a conceded realm makes no declarations
    if (!_kingAliveIdx.has(idx) && !_hasLand(idx)) return;
    // 2026-09-21 (Toby): a bot ALLIED with the claimant AND of the same alignment keeps faith — it
    // neither breaks with him nor joins a coalition against him; it just plays its ordinary
    // alignment diplomacy (so it stays his ally).
    const _loyalToClaimant =
      claimBy >= 0 &&
      claimBy !== idx &&
      areAllied(turnContext, idx, claimBy) &&
      ((G.players || [])[idx] || {}).alignment != null &&
      ((G.players || [])[idx] || {}).alignment === ((G.players || [])[claimBy] || {}).alignment;
    const denyingAClaim = claimBy >= 0 && claimBy !== idx && !_loyalToClaimant;
    (_botEncounteredAtStart[idx] || []).forEach((rival) => {
      if (rival == null || rival === idx) return;
      if (!(G.players || [])[rival]) return;
      if (_conceded(rival)) return; // a realm that has quit is not worth a declaration
      if (!_kingAliveIdx.has(rival) && !_hasLand(rival)) return; // skip already-defeated realms
      // 2026-09-26b (Toby item 10): AGGRESSIVE bot diplomacy (chosen at game creation) — every bot
      // is at war with every HUMAN realm it has met and never offers one a Treat, whatever the
      // alignment wheel or a Reckoning claim says. Bot-to-bot diplomacy is unchanged.
      if (G.botDiplomacy === 'hostile' && !_botPlayerIdx.has(rival)) {
        if (relationBetween(turnContext, idx, rival) !== 'enemy')
          (diploDeclarations[idx] = diploDeclarations[idx] || {})[rival] = 'enemy';
        return;
      }
      if (denyingAClaim) {
        if (rival === claimBy) {
          // The crown is on the table: break with him, ally or not.
          if (relationBetween(turnContext, idx, rival) !== 'enemy')
            (diploDeclarations[idx] = diploDeclarations[idx] || {})[rival] = 'enemy';
        } else if (!areAllied(turnContext, idx, rival) && !_grudgeAgainst(idx, rival)) {
          // Everyone else is a potential partner in denying the claim, whatever their alignment —
          // except a human king who once declared war on us. That grudge outlasts the endgame.
          (diploDeclarations[idx] = diploDeclarations[idx] || {})[rival] = 'treat';
        }
        return;
      }
      // THE GRUDGE: they declared war on us once. No overture, ever again (no alliance, no peace
      // offer, no acceptance), whatever the alignment wheel or the war assessment says.
      const _grudge = _grudgeAgainst(idx, rival);
      // 2026-09-29b (Toby): THE GRUDGE BENDS ONLY TO SURVIVAL. If the human it holds a grudge against
      // is 5× the bot's strength (as the bot reckons it), the bot swallows its pride and treats —
      // for peace, then an alliance — to save itself. Once the human is no more than 2× its
      // strength again, it remembers the grudge and breaks the alliance. (The flag in between is
      // hysteresis, so it does not flip every turn.)
      if (_grudge) {
        const _bp = (G.players || [])[idx];
        _bp._botGrudgeTruce = _bp._botGrudgeTruce || {};
        const _r = botOwnPower(G, idx) / Math.max(1, botRivalPower(G, idx, rival));
        if (_r <= 1 / BOT_WAR.grudgeYield) _bp._botGrudgeTruce[rival] = G.turn || 0;
        else if (_r >= 1 / BOT_WAR.grudgeRecall) delete _bp._botGrudgeTruce[rival];
        if (_bp._botGrudgeTruce[rival] != null) {
          if (!areAllied(turnContext, idx, rival))
            (diploDeclarations[idx] = diploDeclarations[idx] || {})[rival] = 'treat';
          return;
        }
        if (areAllied(turnContext, idx, rival)) {
          (diploDeclarations[idx] = diploDeclarations[idx] || {})[rival] = 'enemy';
          return;
        } // the grudge remembered
      }
      // 2026-09-29b (Toby): a bot never ALLIES with a realm that is allied to any of its enemies
      // (alliances are known to all). Peace (Enemy→Neutral) is still possible.
      const _alliedToMyFoe = (G.players || []).some(
        (q, k) =>
          q &&
          k !== idx &&
          k !== rival &&
          relationBetween(turnContext, idx, k) === 'enemy' &&
          relationBetween(turnContext, rival, k) === 'allied',
      );
      if (botAlignFriendly(G, idx, rival)) {
        if (
          !_grudge &&
          !areAllied(turnContext, idx, rival) &&
          !(_alliedToMyFoe && relationBetween(turnContext, idx, rival) === 'neutral')
        )
          (diploDeclarations[idx] = diploDeclarations[idx] || {})[rival] = 'treat';
        return;
      }
      // 2026-09-29 (Toby): an ally of any alignment is kept faith with; otherwise war and peace are
      // a JUDGEMENT (botWarAssess) — strength, a prize on the border, opportunity, expansion first,
      // other wars, temper — not automatic on contact.
      if (areAllied(turnContext, idx, rival)) return;
      const _wa = botWarAssess(G, idx, rival, { offeredPeace: (diploDeclarations[rival] || {})[idx] === 'treat' });
      if (_wa.decision === 'war' && relationBetween(turnContext, idx, rival) !== 'enemy')
        (diploDeclarations[idx] = diploDeclarations[idx] || {})[rival] = 'enemy';
      else if (_wa.decision === 'peace' && !_grudge && relationBetween(turnContext, idx, rival) === 'enemy')
        (diploDeclarations[idx] = diploDeclarations[idx] || {})[rival] = 'treat';
    });
  });
}
