// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kcArg, kcHtml } from '../shared/kc-safe.ts';
import { MASTERY_UNLOCKS } from '../../content/kingdoms-call-data.ts';
import {
  dispFloor,
  theActionSpellsAimedAtAHero,
  theActionSpellsAimedAtAProvince,
} from '../../shared/the-engines-rules-the-player-portal-shares.ts';
import { orderTargetCharsP, preOrderTagP, realmNameP, realmOptStyleP } from './items-and-heroes.ts';
import { SPELL_HINTS } from './order-chances.ts';
import { SKILL_LABELS } from './move-analysis.ts';
import { predictedLocation, provDirectionLabel } from './order-targets.ts';
import { leadsArmiesP, reportColour } from './map-symbols.ts';

// ── SKILL MASTERY reference ────
// A permanent, always-available reference: for every one of your characters who has pushed a skill
// to level 6 or beyond (reachable only through hard experience), list what that mastery grants —
// the passives that deepen and any new orders/spells unlocked — cumulatively from level 6 up to
// their current level.
// 2026-09-27 (Toby: collapse to one source): this was a hand-kept mirror of MASTERY_UNLOCKS and had
// drifted on TEN entries — it told players that Melee, Archery and the magic schools at level 6/8
// grant nothing, while the engine gives Parry, Counterattack, Impalement, Trueshot, Words of Awe,
// Shimmer, Elemental Armour and the Necromantic Arts. It now reads the engine's own table from
// kingdoms-call-data.ts, so the two cannot disagree again.
export const MASTERY_EFFECTS = MASTERY_UNLOCKS;
export function renderMastery(report) {
  const card = document.getElementById('mastery-card');
  const el = document.getElementById('report-mastery');
  if (!card || !el) return;
  const chars = (report.characters || []).filter((c) => c && c.alive !== false);
  // Collect, per character, the skills at level 6+ and the cumulative effect lines.
  const rows = [];
  chars.forEach((c) => {
    const sk = c.skills || {};
    const mastered = Object.keys(sk)
      .filter((k) => sk[k] >= 6 && MASTERY_EFFECTS[k])
      .sort((a, b) => sk[b] - sk[a] || a.localeCompare(b));
    if (mastered.length === 0) return;
    const skillBlocks = mastered.map((k) => {
      const lvl = sk[k];
      const effs = [];
      for (let L = 6; L <= lvl; L++) {
        const d = MASTERY_EFFECTS[k][L];
        if (d) effs.push({ L, d });
      }
      const lines = effs.map(
        (e) =>
          kcHtml`<div style="font-size:.76rem;padding:1px 0 1px 10px"><span style="color:var(--gold);font-family:Cinzel,serif;font-size:.68rem">L${e.L}</span> ${e.d}</div>`,
      );
      return kcHtml`<div style="margin:3px 0 5px">
        <div style="font-size:.8rem"><strong>${SKILL_LABELS[k] || k} ${lvl}</strong></div>
        ${lines}
      </div>`;
    });
    rows.push(kcHtml`<div class="intel-entry" style="border-left-color:#8a6a1a">
      <div style="font-family:'Cinzel',serif;font-size:.82rem;color:#6a4a10">${c.isKing ? '👑' : '⚔'} ${c.name}</div>
      ${skillBlocks}
    </div>`);
  });
  const _rjM = document.getElementById('rj-mastery'); // the jump-bar button follows the card
  if (rows.length === 0) {
    card.style.display = 'none';
    el.innerHTML = '';
    if (_rjM) _rjM.style.display = 'none';
    return;
  }
  card.style.display = '';
  if (_rjM) _rjM.style.display = '';
  el.innerHTML = kcHtml`<div style="font-size:.72rem;color:#332c20;margin-bottom:6px">A standing reference to the mastery each of your characters has earned — consult it whenever you plan their orders.</div>${rows}`;
}

// ── TITLES & VICTORY (Reckoning) ────
export const _TITLE_ORDER = [
  ['throne', 'The Throne', 20],
  ['vault', 'The Vaultkeeper', 10],
  ['marshal', 'The Grand Marshal', 10],
  ['sea', 'The Sea Lord', 10],
  ['monster', 'The Monster-Bane', 10],
  ['lore', 'The Loremaster', 10],
  ['arch', 'The Archmage', 10],
  ['hiero', 'The Hierophant', 10],
  ['necro', 'The Deathpriest', 10],
];
// One sentence on where this realm stands in a title race, from the engine's `race` record
// (titleRaceFor in the GM portal). Shared by the Titles card and the Intelligence Reports block.
export function titleRaceLine(r) {
  if (!r) return '';
  const who = r.charName ? kcHtml`<strong>${r.charName}</strong>` : '';
  if (r.mine)
    return r.unchallenged
      ? kcHtml`${who || 'Your realm'} holds this title <strong>unchallenged</strong> — no rival has any standing.`
      : kcHtml`${who || 'Your realm'} holds this title, <strong>${r.leadPct} percentage point${r.leadPct === 1 ? '' : 's'}</strong> ahead of the closest rival${r.leadPct === 0 ? ' — level with them, and holding it only by precedence' : ''}.`;
  if (r.vacant) return `Vacant — no character in the world has any standing yet.`;
  if (!r.charName || !(r.pct > 0)) return `None of your characters has any standing toward this title yet.`;
  return kcHtml`Your best: ${who} — at <strong>${r.pct}%</strong> of the holder's standing.`;
}
// (titleStandingIntelHTML removed 2026-09-21 — the Intelligence card's "Your standing in the
// Imperial Titles" block duplicated the per-title percentages that 🏆 Titles & Victory already
// prints against each title. titleRaceLine above is still the single source of that wording.)
export function renderTitles(report) {
  const el = document.getElementById('report-titles');
  if (!el) return;
  const t = (report && report.titles) || {};
  // Game over → final result.
  if (t.gameOver) {
    const go = t.gameOver;
    const board = (go.standings || [])
      .slice()
      .sort((a, b) => b.score - a.score)
      .map(
        (s, i) =>
          kcHtml`<tr style="${s.index === go.winner ? 'font-weight:700;background:#fdf3d8' : ''}"><td style="padding:3px 8px">${i + 1}</td><td style="padding:3px 8px;color:${reportColour(s.color) || '#333'}">${s.name}</td><td style="padding:3px 8px;text-align:right">${s.score}</td><td style="padding:3px 8px;font-size:.75rem;color:#2f281c">${(s.titleNames || []).join(', ')}${s.relics ? `${s.titleNames && s.titleNames.length ? ' · ' : ''}${s.relics} relic${s.relics !== 1 ? 's' : ''}` : ''}</td></tr>`,
      );
    el.innerHTML = kcHtml`<div style="background:#fdf3d8;border:1px solid var(--gold);border-radius:3px;padding:10px 12px;margin-bottom:8px">
      <div style="font-family:'Cinzel',serif;font-size:1rem;color:var(--crimson)">🏆 ${go.winnerName || 'No-one'} ${go.byElimination ? 'is the last realm standing' : go.byConcession ? 'holds the field — every rival has conceded' : 'is judged supreme at the Reckoning'}!</div></div>
      <table style="width:100%;border-collapse:collapse;font-size:.85rem"><thead><tr style="color:#332c20;font-size:.72rem;text-align:left"><th style="padding:3px 8px">#</th><th style="padding:3px 8px">Realm</th><th style="padding:3px 8px;text-align:right">Legacy</th><th style="padding:3px 8px">Titles held</th></tr></thead><tbody>${board}</tbody></table>`;
    return;
  }
  if (!t.public) {
    el.innerHTML = kcHtml`<em style="color:#3a3224;font-size:.85rem">The Imperial Titles are contested in secret until Turn ${t.publicFromTurn || 5}. Standings appear then.</em>`;
    return;
  }
  const nPlayers = (t.standings || []).length || 2;
  const pct = dispFloor((t.myShare || 0) * 100),
    thr = Math.ceil(dispFloor((t.threshold || 0) * 100 * 1e6) / 1e6); // a 41.6% share shows 41, never "42% (need 42%)"
  // the caller's OWN share and the personal floor (half the bar).
  const ownPct = dispFloor((t.myOwnShare != null ? t.myOwnShare : t.myShare || 0) * 100),
    minPct = Math.ceil(dispFloor((t.callerMin || 0) * 100 * 1e6) / 1e6);

  // ── titles newly WON this turn (character or realm), with how + effect ──
  let gainsHtml = '';
  const gains = t.gains || [];
  if (gains.length) {
    // On the turn titles first go public every held title is announced as the player's initial
    // standing
    // (g.initial); on later turns only titles that change hands appear (freshly won).
    const initial = gains.some((g) => g.initial);
    const header = initial
      ? `🏅 The Imperial Titles are now public — title${gains.length !== 1 ? 's' : ''} you hold`
      : `🎉 New title${gains.length !== 1 ? 's' : ''} won this turn`;
    const verb = initial ? 'Earned by' : 'Won by';
    gainsHtml = kcHtml`<div style="background:#fdf3d8;border:1px solid var(--gold);border-radius:3px;padding:8px 10px;margin-bottom:10px">
      <div style="font-family:'Cinzel',serif;font-size:.8rem;color:var(--crimson);margin-bottom:4px">${header}</div>
      ${gains.map(
        (g) => kcHtml`<div style="font-size:.78rem;color:#444;margin-bottom:5px;line-height:1.45">
        <strong>${g.scope === 'minor' ? '🎖' : '🏆'} ${g.name}</strong> — ${g.charName ? `${g.charName} of ` : ''}<span style="color:var(--forest)">${g.kingdomName || 'your realm'}</span>.
        <br><span style="color:#2a2419">${verb}: ${g.req || ''}</span>
        <br><span style="color:#1d541d">Effect: ${g.perk || ''}</span></div>`,
      )}</div>`;
  }

  // ── titles LOST this turn — the old holder is told a rival took it, or it fell vacant. ──
  let lossesHtml = '';
  const losses = t.losses || [];
  if (losses.length) {
    lossesHtml = kcHtml`<div style="background:#f6e0e0;border:1px solid var(--crimson);border-radius:3px;padding:8px 10px;margin-bottom:10px">
      <div style="font-family:'Cinzel',serif;font-size:.8rem;color:var(--crimson);margin-bottom:4px">⚔ Title${losses.length !== 1 ? 's' : ''} lost this turn</div>
      ${losses.map(
        (l) => kcHtml`<div style="font-size:.78rem;color:#444;margin-bottom:5px;line-height:1.45">
        <strong>${l.scope === 'minor' ? '🎖' : '🏆'} ${l.name}</strong> — ${
          l.vacant
            ? kcHtml`now stands <span style="color:#3a3224">vacant</span>.`
            : kcHtml`claimed by ${l.newCharName ? `${l.newCharName} of ` : ''}<span style="color:var(--crimson)">${l.newHolderName || 'a rival'}</span>.`
        }</div>`,
      )}</div>`;
  }

  // ── Reckoning status banner (once called) ──
  let banner = '';
  if (t.reckoning) {
    banner = kcHtml`<div style="background:#f7e9d0;border:1px solid var(--gold);border-radius:3px;padding:8px 10px;margin-bottom:10px;font-size:.85rem">
      👑 <strong>The Reckoning has been called${t.reckoning.byName ? ` by ${t.reckoning.byName}` : ''}.</strong> The world is judged at the end of <strong>Turn ${t.reckoning.resolveAtTurn}</strong> unless the claim is broken. ${t.reckoning.mine ? 'This is your claim — hold your dominance.' : "Drive the claimant's bloc below the threshold to shatter it."}</div>`;
  }

  // ── Standings board ──
  // 2026-09-27 (Toby item 3): a realm this crown has not yet MET arrives from the engine already
  // nameless ("An unknown realm") with no colour. Its score and its titles are public knowledge and
  // are still shown; only its identity is withheld. Rendered in grey italics so it is plainly a
  // blank on the map rather than a realm someone has oddly named.
  const _unmetStyle = 'color:#5a5348;font-style:italic';
  const board = (t.standings || [])
    .slice()
    .sort((a, b) => b.score - a.score)
    .map(
      (s, i) =>
        kcHtml`<tr style="${s.index === (currentReport && currentReport.playerIndex) ? 'font-weight:700' : ''}"><td style="padding:2px 8px">${i + 1}</td><td style="padding:2px 8px;${s.unmet ? _unmetStyle : `color:${reportColour(s.color) || '#333'}`}">${s.name}${s.unmet ? kcHtml` <span style="font-size:.66rem;opacity:.8">(not yet encountered)</span>` : ''}</td><td style="padding:2px 8px;text-align:right">${s.score}</td></tr>`,
    );

  // ── the Imperial Titles — holder (character + realm), how earned, perk while held ──
  const holders = t.holders || {};
  // _TITLE_ORDER fixes the order of the original nine; every other title the engine ships (the
  // Spymaster, Cartographer, Beastlord, Wildwarden and any added later) follows, named and priced
  // from the payload — the list can no longer fall behind TITLE_DEFS.
  const _titleRows = _TITLE_ORDER
    .map((r) => r.slice())
    .concat(
      Object.keys(holders)
        .filter((k) => !_TITLE_ORDER.some((r) => r[0] === k))
        .map((k) => [k, holders[k].name || k, holders[k].prize || 0]),
    );
  // 2026-09-21 — THE ORDER OF THIS LIST. The titles this realm HOLDS are printed first (keeping the
  // canonical order among themselves); everything else follows, nearest-to-won first. "Nearest" is
  // the engine's own `race` record: a VACANT title sorts to the head of the unheld group (no one
  // holds it, so there is no standing to overhaul), then `race.pct` — this realm's best character
  // as a percentage of the current holder's standing — highest first. A row whose report carries no
  // `race` record at all (a turn resolved by a GM build that predates the percentages) keeps the
  // canonical order at the tail rather than pretending to a position. The sort is stable, so equal
  // percentages never shuffle between renders.
  const _heldBy = (k) => {
    const h = holders[k] || {};
    return !!(h.race ? h.race.mine : h.mine);
  };
  const _closeness = (k) => {
    const r = (holders[k] || {}).race;
    if (!r) return -1;
    if (r.vacant) return 1000;
    return typeof r.pct === 'number' ? r.pct : 0;
  };
  _titleRows.forEach((row, i) => {
    row._i = i;
  });
  _titleRows.sort((a, b) => {
    const ha = _heldBy(a[0]),
      hb = _heldBy(b[0]);
    if (ha !== hb) return ha ? -1 : 1;
    if (ha) return a._i - b._i;
    const ca = _closeness(a[0]),
      cb = _closeness(b[0]);
    if (ca !== cb) return cb - ca;
    return a._i - b._i;
  });
  const majorHtml = _titleRows.map(([k, name, prize]) => {
    const h = holders[k] || {};
    // Your realm's place in the race for this title (percentages only — see titleRaceFor).
    const r = h.race || null;
    const raceLine = r
      ? titleRaceLine(r)
      : kcHtml`<span style="color:#3a3224">Standing percentages are missing from this turn report — it was resolved by ${report && report.engineStamp ? kcHtml`<strong>the GM portal's build ${report.engineStamp}</strong>, which predates them` : 'a GM portal build that predates them'}. They appear once a turn is resolved by a GM portal build from 20 September 2026 or later.</span>`;
    const raceHtml = raceLine
      ? kcHtml`<div style="font-size:.74rem;margin:1px 0;color:${r && r.mine ? 'var(--forest)' : '#5a4a2a'}">📊 ${raceLine}</div>`
      : '';
    const who = h.holderName
      ? h.unmet
        ? kcHtml`<span style="${_unmetStyle}">${h.charName ? `${h.charName} of ` : ''}${h.holderName}</span> <span style="font-size:.66rem;color:#5a5348">— a realm you have not yet encountered</span>`
        : h.kingdomLevel
          ? kcHtml`${h.charName ? `${h.charName} — ` : ''}<span style="color:${h.mine ? 'var(--forest)' : '#333'};font-weight:${h.mine ? '700' : '400'}">${h.holderName}</span>`
          : kcHtml`${h.charName || '—'} <span style="color:${h.mine ? 'var(--forest)' : '#777'};font-weight:${h.mine ? '700' : '400'}">(${h.holderName})</span>`
      : kcHtml`<span style="color:#3a3224">— vacant —</span>`;
    return kcHtml`<div style="border-bottom:1px solid var(--parchment-dark);padding:5px 0">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline">
        <strong style="font-size:.82rem">🏆 ${name}</strong>
        <span style="color:#3a3224;font-size:.72rem;white-space:nowrap">${prize} pts</span>
      </div>
      <div style="font-size:.78rem;margin:1px 0">Held by: ${who}</div>
      ${raceHtml}
      <div style="font-size:.7rem;color:#2f281c;line-height:1.4">Earn: ${h.req || ''}<br><span style="color:#1d541d">While held: ${h.perk || ''}</span></div>
    </div>`;
  });

  // ── how to Call the Reckoning (always shown while titles are public) ──
  const _minTurn = t.reckoningMinTurn || 10;
  const _solo = Math.ceil(dispFloor((t.soloThreshold != null ? t.soloThreshold : t.threshold || 0) * 100 * 1e6) / 1e6);
  const _step = Math.round((t.allyStep || 0) * 100);
  const _nAllies = Math.max(0, (t.blocSize || 1) - 1);
  const reckoningInfo = kcHtml`<div style="background:#f5f0e8;border:1px solid var(--parchment-dark);border-radius:3px;padding:8px 10px;margin-top:12px;font-size:.74rem;color:#231e16;line-height:1.5">
    <div style="font-family:'Cinzel',serif;font-size:.72rem;color:var(--crimson);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;font-weight:700">Calling the Reckoning</div>
    There is no turn limit — the game ends only when one realm is left standing, or when a dominant realm <strong>Calls the Reckoning</strong> and forces a final scoring. To call it:
    <ul style="margin:4px 0 4px 16px;padding:0">
      <li>it must be <strong>Turn ${_minTurn}</strong> or later — the throne cannot be claimed while the realms are still settling; and</li>
      <li>your <strong>King must be alive</strong> — it is a King-only act; and</li>
      <li>your realm, <strong>together with the realms you are directly allied to</strong>, must control at least <strong>${thr}%</strong> of the world's total tax base.</li>
      <li><strong>Every ally raises the bar.</strong> A realm standing alone needs <strong>${_solo}%</strong> in a ${nPlayers}-realm game; each ally in your bloc adds <strong>${_step} points</strong> to that (you have ${_nAllies} all${_nAllies === 1 ? 'y' : 'ies'}, so your bar is ${thr}%). An alliance is a way to reach the endgame, never a cheaper one — and an ally who brings less than ${_step}% of the world makes your claim harder, not easier.</li>
      <li><strong>Your bloc is yours alone.</strong> It is you and the realms YOU are allied to. An ally's other alliances are their business and count for nothing here — so if you are allied to B and B is allied to D, D is not in your bloc.</li>
      <li>if the bar is carried by an alliance, <strong>you must personally hold at least ${minPct}%</strong> — half your bloc's bar — in your own right. The throne is claimed by a realm, not by a passenger in someone else's bloc, so it is the bloc's greatest realm that lodges the claim. (If the claimant is later cut below ${minPct}% the claim collapses, even if the bloc still clears ${thr}%.)</li>
    </ul>
    Calling it announces the claim to every realm and begins a <strong>2-turn grace period</strong>. The bar is fixed at the moment you lodge the claim, so breaking off an alliance afterwards costs you your ally's lands without lowering what you must hold. If rivals drive your bloc back below ${thr}% before it resolves, the claim lapses and play continues. If you still hold the threshold at the end of the second turn, Legacy is scored and the highest total wins. Allies end the game together but still compete for every Title — an alliance is a route to the endgame, not a shared victory.
  </div>`;

  // ── Call the Reckoning control ──
  let callCtrl = '';
  if (t.canCallReckoning) {
    callCtrl = reckoningCall
      ? kcHtml`<div style="background:#fdeaea;border:1px solid var(--crimson);border-radius:3px;padding:8px 10px;margin-top:10px;font-size:.85rem">👑 <strong>You will Call the Reckoning this turn.</strong> If your bloc still holds ${thr}%+ when orders resolve, the endgame begins (a 2-turn grace, then the world is judged). <button onclick="setReckoningCall(false)" style="font-size:.66rem;padding:2px 8px;border:1px solid #999;background:#eee;border-radius:2px;cursor:pointer;margin-left:6px">cancel</button></div>`
      : kcHtml`<div style="margin-top:10px"><button onclick="setReckoningCall(true)" style="font-family:'Cinzel',serif;font-size:.72rem;padding:7px 14px;border:1px solid #5a1010;background:var(--crimson);color:#fff;border-radius:2px;cursor:pointer">👑 Call the Reckoning</button>
        <div style="font-size:.72rem;color:#2f281c;margin-top:4px">Your bloc commands <strong>${pct}%</strong> of the world (need ${thr}%). Calling it forces a final scoring in two turns — submit orders to lodge the claim.</div></div>`;
  } else if (!t.reckoning && t.callBlockedReason === 'tooEarly') {
    callCtrl = kcHtml`<div style="font-size:.72rem;color:#3a3224;margin-top:10px">The throne cannot be claimed before <strong>Turn ${t.reckoningMinTurn || 10}</strong>. Your bloc commands ${pct}% of the world; ${thr}% will be needed when the claim opens.</div>`;
  } else if (!t.reckoning) {
    callCtrl =
      t.callBlockedReason === 'callerShort'
        ? kcHtml`<div style="font-size:.72rem;color:#3a3224;margin-top:10px">Your bloc commands ${pct}% of the world — enough to Call the Reckoning — but your own realm holds just ${ownPct}% of it, and a claimant must personally hold ${minPct}%. The claim must be lodged by the greatest realm in your alliance.</div>`
        : kcHtml`<div style="font-size:.72rem;color:#3a3224;margin-top:10px">Your bloc commands ${pct}% of the world; ${thr}% is needed to Call the Reckoning.</div>`;
  }

  // ── Always show the realm's share of the world's total tax base (land AND sea) and the Reckoning
  // threshold, so the leader (and everyone) can gauge how close they are to calling it. The Throne
  // holder — who by definition commands the largest tax base — is called out by name.
  const throneMine = !!(t.holders && t.holders.throne && t.holders.throne.mine);
  const _gap = thr - pct;
  const shareLine = kcHtml`<div style="background:#f0f4ea;border:1px solid #cdd8bf;border-radius:3px;padding:7px 10px;margin-bottom:10px;font-size:.78rem;color:#3a4a2a;line-height:1.5">
    ${throneMine ? kcHtml`👑 <strong>You hold The Throne</strong> — the largest tax base in the world. ` : ''}Your bloc commands <strong>${pct}%</strong> of the world's tax base; the Reckoning can be called at <strong>${thr}%</strong>.${_gap > 0 ? kcHtml` <span style="color:#2f281c">(${_gap} more percentage point${_gap !== 1 ? 's' : ''} to go.)</span>` : t.callBlockedReason === 'callerShort' ? kcHtml` <span style="color:#654c0c">Your bloc meets the threshold, but your own realm holds ${ownPct}% and a claimant must personally hold ${minPct}% — your strongest ally must lodge the claim.</span>` : kcHtml` <span style="color:#1d541d">You meet the threshold.</span>`}
  </div>`;
  el.innerHTML = kcHtml`${gainsHtml}${lossesHtml}${banner}${shareLine}<div style="font-size:.75rem;color:#332c20;margin-bottom:3px">Standings (Legacy)</div>
       <table style="width:100%;border-collapse:collapse;font-size:.85rem;margin-bottom:12px"><tbody>${board}</tbody></table>
       <div style="font-size:.75rem;color:#332c20;margin-bottom:2px">The Imperial Titles — who holds them &amp; how they are won <span style="color:#aaa">(yours first, then the ones you stand closest to winning)</span></div>
       ${majorHtml}${callCtrl}${reckoningInfo}${renderMinorTitles(t)}`;
}
export function renderMinorTitles(t) {
  const m = t && t.minor;
  if (!m) return '';
  // list ONLY the minor titles held by this player's own characters.
  const mine = m.mine || [];
  const mineHtml = mine.length
    ? mine.map(
        (x) => kcHtml`<div style="border-bottom:1px dotted var(--parchment-dark);padding:4px 0;font-size:.76rem">
        <span class="pill" style="background:#eef3e6;color:#3a5a2a;margin:0">🎖 ${x.name}</span>
        <span style="color:#231e16"> — ${x.holderName || ''}</span>
        <div style="font-size:.68rem;color:#2f281c;line-height:1.4">Earn: ${x.req || ''}<br><span style="color:#1d541d">Perk: ${x.perk || ''}</span></div>
      </div>`,
      )
    : kcHtml`<div style="font-size:.78rem;color:#3a3224;margin-top:4px">Your characters hold no minor titles yet. Each is awarded to the single best character in the world by its measure — win one and it appears here.</div>`;
  return kcHtml`<div style="margin-top:14px;border-top:1px dashed var(--parchment-dark);padding-top:8px">
    <div style="font-size:.8rem;color:#332c20;margin-bottom:4px">🎖 Your minor titles <span style="font-size:.72rem">(honorary — each grants a perk but never counts toward victory)</span></div>
    ${mineHtml}
  </div>`;
}
export function setReckoningCall(v) {
  reckoningCall = !!v;
  if (currentReport) renderTitles(currentReport);
  renderReckoningOrders();
}
//the Call the Reckoning control ALSO lives in Orders → 🏰 Realm, beside Concede —
// and when it cannot be called the section still says where the button will be and what is missing
// (titles not yet public / king dead / share short / already called), so a player never hunts for it.
export function renderReckoningOrders() {
  const w = document.getElementById('reckoning-wrap');
  if (!w) return;
  const t = (currentReport && currentReport.titles) || {};
  const pct = dispFloor((t.myShare || 0) * 100),
    thr = Math.ceil(dispFloor((t.threshold || 0) * 100 * 1e6) / 1e6); // a 41.6% share shows 41, never "42% (need 42%)"
  // the caller's OWN share and the personal floor (half the bar).
  const ownPct = dispFloor((t.myOwnShare != null ? t.myOwnShare : t.myShare || 0) * 100),
    minPct = Math.ceil(dispFloor((t.callerMin || 0) * 100 * 1e6) / 1e6);
  if (t.gameOver) {
    w.innerHTML = kcHtml`<div style="color:#2f281c">The game is over — there is nothing left to call.</div>`;
    return;
  }
  if (t.reckoning) {
    w.innerHTML = kcHtml`<div style="background:#f7e9d0;border:1px solid var(--gold);border-radius:3px;padding:6px 8px">👑 <strong>The Reckoning has already been called${t.reckoning.byName ? ` by ${t.reckoning.byName}` : ''}.</strong> The world is judged at the end of Turn ${t.reckoning.resolveAtTurn} unless the claim is broken.</div>`;
    return;
  }
  if (t.canCallReckoning) {
    w.innerHTML = reckoningCall
      ? kcHtml`<div style="background:#fdeaea;border:1px solid var(--crimson);border-radius:3px;padding:6px 8px;font-size:.78rem">👑 <strong>You will Call the Reckoning with these orders.</strong> If your bloc still holds ${thr}%+ when orders resolve, the endgame begins (a 2-turn grace, then the world is judged). <button type="button" onclick="setReckoningCall(false)" style="margin-left:6px;font-size:.66rem;padding:2px 8px;border:1px solid #999;background:#eee;border-radius:2px;cursor:pointer">cancel</button></div>`
      : kcHtml`<div><button type="button" onclick="setReckoningCall(true)" style="font-family:'Cinzel',serif;font-size:.72rem;padding:6px 12px;border:1px solid #5a1010;background:var(--crimson);color:#fff;border-radius:2px;cursor:pointer">👑 Call the Reckoning</button>
          <div style="color:#2f281c;margin-top:4px">Your bloc commands <strong>${pct}%</strong> of the world's tax base (need ${thr}%). Calling it forces a final scoring in two turns — submit orders to lodge the claim.</div></div>`;
    return;
  }
  // Not available — say why, and where the button will appear.
  let why;
  if (t.callBlockedReason === 'tooEarly')
    why = kcHtml`The throne cannot be claimed before <strong>Turn ${t.reckoningMinTurn || 10}</strong> — the realms are still settling and the world will not yet be judged.`;
  else if (t.public === false)
    why = `The Imperial Titles are contested in secret until Turn ${t.publicFromTurn || 5} — the Reckoning cannot be called before then.`;
  else if (t.kingAlive === false)
    why = kcHtml`Only a living <strong>King</strong> may call it — your king is dead, so the call must wait for the heir.`;
  else if (t.callBlockedReason === 'callerShort')
    why = kcHtml`Your bloc commands <strong>${pct}%</strong> of the world's tax base — enough to call it — but the claim belongs to whoever lodges it, and your own realm holds only <strong>${ownPct}%</strong>. A claimant must personally hold <strong>${minPct}%</strong> (half the ${thr}% bar), so the greatest realm in your alliance must be the one to call it.`;
  else if (pct < thr) {
    const _na = Math.max(0, (t.blocSize || 1) - 1),
      _so = Math.ceil(dispFloor((t.soloThreshold != null ? t.soloThreshold : t.threshold || 0) * 100 * 1e6) / 1e6);
    why = kcHtml`Your bloc commands <strong>${pct}%</strong> of the world's tax base; <strong>${thr}%</strong> is needed <span style="color:#2f281c">(${thr - pct} more percentage point${thr - pct !== 1 ? 's' : ''} to go)</span>.${_na > 0 ? kcHtml` <span style="color:#654c0c">Standing alone the bar would be ${_so}% — each of your ${_na} all${_na === 1 ? 'y' : 'ies'} raises it by ${Math.round((t.allyStep || 0) * 100)} points.</span>` : ''}`;
  } else why = kcHtml`Your bloc commands <strong>${pct}%</strong> of the world's tax base (need ${thr}%).`;
  w.innerHTML = kcHtml`<div style="color:#231e16;line-height:1.5">${why} The <strong>👑 Call the Reckoning</strong> button will appear here when you qualify.</div>`;
}

// the spell-target (secondary) field builder, extracted from the Cast Spell form so the Use Item
// form can offer the same province / character targeting for spell items.
export function spellSecondaryHtml(report, c, ph, selSpell, extra, target) {
  const NEEDS_PROV = theActionSpellsAimedAtAProvince();
  const NEEDS_CHAR = theActionSpellsAimedAtAHero();
  let secondaryHtml = '';
  if (NEEDS_PROV.has(selSpell)) {
    // All province spells reach only the province the caster occupies THIS PHASE or one
    // adjacent to it (the GM engine enforces the same rule at resolution). Part Sea
    // additionally requires a sea province; Flood a land province; Hide Lairs a province with
    // lairs this player has discovered.
    const wmProvs = report.worldMeta?.provinces || [];
    const curLoc = predictedLocation(c.id, ph);
    const curId = curLoc ? curLoc.id : c.locationId;
    const curP = wmProvs.find((p) => p.id === curId);
    const candIds = [curId, ...((curP && curP.neighbors) || [])];
    const kfNames = new Set((report.knownFeatures || []).filter((f) => !f.cleared).map((f) => f.province));
    const provOpts = candIds
      .map((pid) => {
        const p = wmProvs.find((x) => x.id === pid);
        if (!p) return '';
        const t = p.terrain; // null for unexplored tiles (and possibly illusory — the map is what you see)
        // Part Sea may target any land OR sea province in reach — a land province flooded to sea
        // later this turn can then be reverted (the Flood counter), so no terrain filter for Part
        // Sea.
        if (selSpell === 'Flood' && (t === 'sea' || t == null)) return '';
        if (selSpell === 'Hide Lairs') {
          const hasKnownFeature = (p.features || []).length > 0 || (p.name && kfNames.has(p.name));
          if (!hasKnownFeature) return '';
        }
        // Bless boosts a province's tax at collection, so list each candidate's tax base to help
        // the player pick the richest target. Only shown for Bless (other province spells don't
        // care about tax) and only when the tax base is actually known for that province.
        const taxLbl = selSpell === 'Bless Province' && p.tax != null ? ` · tax base ${p.tax}g` : '';
        const label =
          (p.name || `Unknown province (${provDirectionLabel(curId, pid, wmProvs, report.worldMeta?.cols) || '?'})`) +
          (pid === curId ? ' (here)' : '') +
          (t ? ` — ${t}` : '') +
          taxLbl;
        return kcHtml`<option value="${pid}" ${extra == pid ? 'selected' : ''}>${label}</option>`;
      })
      .filter(Boolean);
    secondaryHtml = provOpts.length
      ? kcHtml`<select id="po-extra-${c.id}-${ph}" style="margin-top:4px"><option value="">— Target province —</option>${provOpts}</select>
          <div style="font-size:.72rem;color:var(--stone);margin-top:2px">${SPELL_HINTS[selSpell] || ''}</div>`
      : kcHtml`<input id="po-extra-${c.id}-${ph}" type="text" value="" placeholder="${selSpell === 'Part Sea' ? 'No province here or adjacent' : selSpell === 'Flood' ? 'No land province here or adjacent' : selSpell === 'Hide Lairs' ? 'No discovered lairs here or adjacent' : 'No valid target province in reach'}" disabled>
          <div style="font-size:.72rem;color:var(--stone);margin-top:2px">${SPELL_HINTS[selSpell] || ''}</div>`;
  } else if (NEEDS_CHAR.has(selSpell)) {
    const casterLoc = predictedLocation(c.id, ph)?.id ?? c.locationId;
    let charOpts = '';
    if (selSpell === 'Resurrect') {
      // Resurrect shows dead heroes the player knows of. Kings can never be resurrected, and
      // the body must lie in the caster's province at cast time — bodies at the caster's
      // predicted location are marked ✓; others are listed so the player can plan a move there.
      // 2026-09-12: every body the player can SEE is listed. One the rules forbid raising is
      // shown greyed with the reason (`raisable`/`whyNot` from the GM report) rather than
      // silently dropped — a body on the map that is simply absent from this list reads as a
      // bug. Raisable bodies sort first. Older reports carry no flags, so default to raisable
      // and fall back to the previous king filter. 2026-09-17 (late): ONLY the bodies lying in
      // the caster's province (predicted for this phase) are listed. A body elsewhere is not
      // offered at all — move there first, and the later-phase form will show it.
      const casterHereName = (predictedLocation(c.id, ph) || {}).name;
      const _bodies = (report.knownDeadHeroes || report.deadHeroes || [])
        .filter((x) => {
          if (x.locationId != null && casterLoc != null) return String(x.locationId) === String(casterLoc);
          return casterHereName && x.locationName === casterHereName; // older reports carry no locationId
        })
        .map((x) => {
          const _r = x.raisable !== undefined ? !!x.raisable : !x.isKing || !!x.isMonarch;
          const _w = x.whyNot || (x.isKing && !x.isMonarch ? 'kings cannot be resurrected' : 'not a legal target');
          return { ...x, _r, _w };
        })
        .sort((a, b) => (b._r ? 1 : 0) - (a._r ? 1 : 0));
      charOpts = _bodies.map((x) => {
        const who = x.isMonarch
          ? ' 👑 (your fallen monarch — reclaims the throne)'
          : x.wasOwnHero
            ? ''
            : ` ⚔ (${x.player != null ? realmNameP(x.player, report) + ' hero' : 'wandering hero'})`;
        if (!x._r)
          return kcHtml`<option value="" disabled>${x.isMonarch ? '👑 ' : ''}${x.name} — cannot be raised: ${x._w}</option>`;
        return kcHtml`<option value="${x.id}"${x.wasOwnHero ? '' : realmOptStyleP(x.player, report)} ${extra == x.id ? 'selected' : ''}>${x.isMonarch ? '👑 ' : ''}${x.name}${who} — died turn ${x.killedOnTurn || '?'}</option>`;
      });
      if (!charOpts.length)
        charOpts = kcHtml`<option value="" disabled>No fallen hero lies in ${casterHereName || 'this province'} — only bodies in the caster's province can be raised; move there first</option>`;
    } else if (selSpell === 'Charm') {
      // Charm: a LONE hero (leading no armies) in the caster's province — wandering (joins you)
      // or enemy (command seized for the turn). Kings are immune, army-leaders are beyond its
      // reach.
      // (The engine enforces all of this — this list simply matches it.)
      // A hero charmed last turn is closed to Charm for the whole of this one.
      const targets = (report.visibleChars || []).filter(
        (x) =>
          x.alive !== false &&
          x.locationId === casterLoc &&
          !x.isKing &&
          !leadsArmiesP(x) &&
          !x.charmImmune &&
          (x.player === null || x.player !== c.player),
      );
      charOpts = targets.map(
        (x) =>
          kcHtml`<option value="${x.id}"${realmOptStyleP(x.player, report)} ${extra == x.id ? 'selected' : ''}>${x.name}${x.player === null ? ' (wandering — joins you free)' : ` ⚔ (${realmNameP(x.player, report)}, no armies — yours for the turn)`} — ${x.locationName || '?'}</option>`,
      );
      if (!charOpts.length)
        charOpts = kcHtml`<option value="" disabled>No valid target — needs a lone hero (wandering or enemy, leading no armies) in this province (kings are immune, and so is anyone charmed last turn)</option>`;
    } else if (selSpell === 'Oratory') {
      // Oratory: self, or own characters predicted to be in the same province this phase.
      const selfOpt = kcHtml`<option value="${c.id}" ${extra == c.id ? 'selected' : ''}>${c.name} (self)</option>`;
      const allies = orderTargetCharsP(report, ph, { allowCharmEnemy: true }).filter(
        (x) => x.id !== c.id && (predictedLocation(x.id, ph)?.id ?? x.locationId) === casterLoc,
      );
      charOpts = [
        selfOpt,
        ...allies.map(
          (x) =>
            kcHtml`<option value="${x.id}" ${extra == x.id ? 'selected' : ''}>${x.name} — ${x.locationName || '?'}${preOrderTagP(x)}</option>`,
        ),
      ];
    } else if (selSpell === 'Phantasmal Armies') {
      // Phantasmal Armies: self, or any friendly hero in the SAME province this phase. The buff
      // no longer requires armies at cast time — it sits on the target and is spent by their
      // next battle, so it still helps if they pick up or recruit armies in a later phase.
      const selfOpt = kcHtml`<option value="${c.id}" ${extra == c.id ? 'selected' : ''}>${c.name} (self)</option>`;
      const allies = orderTargetCharsP(report, ph, { allowCharmEnemy: true }).filter(
        (x) => x.id !== c.id && (predictedLocation(x.id, ph)?.id ?? x.locationId) === casterLoc,
      );
      charOpts = [
        selfOpt,
        ...allies.map(
          (x) =>
            kcHtml`<option value="${x.id}" ${extra == x.id ? 'selected' : ''}>${x.name} — ${x.locationName || '?'}${preOrderTagP(x)}</option>`,
        ),
      ];
    } else if (selSpell === 'Clairvoyance') {
      // Clairvoyance: any character you have seen AT ANY POINT in the game — drawn from the
      // persistent sighting record (everSeenChars), plus anyone visible right now.
      const seen = (
        report.everSeenChars && report.everSeenChars.length ? report.everSeenChars : report.visibleChars || []
      )
        .filter((x) => x && x.player != null && !x.isWandering) // neutral/wandering heroes are not valid Clairvoyance targets
        .slice()
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      charOpts = seen.map(
        (x) =>
          kcHtml`<option value="${x.id}"${x.player === c.player ? '' : realmOptStyleP(x.player, report)} ${extra == x.id ? 'selected' : ''}>${x.name}${x.player === c.player ? ' (yours)' : ` ⚔ (${realmNameP(x.player, report)})`} — last seen: ${x.lastLocName || x.locationName || '?'}${x.lastSeenTurn ? ` (turn ${x.lastSeenTurn})` : ''}</option>`,
      );
      if (!charOpts.length)
        charOpts = kcHtml`<option value="" disabled>You have not seen any enemy characters yet</option>`;
    } else if (selSpell === 'Control Undead') {
      // Control Undead: seize an undead unit from an enemy/neutral hero here, OR scan this
      // province to reveal the dead army units lying in it. 2026-09-15: the province scan is
      // the DEFAULT. The scan is now preselected whenever no other target is saved, so the
      // obvious reading of "cast Control Undead here" is also what happens.
      const _cuNoTarget = extra === '' || extra == null;
      const scanOpt = kcHtml`<option value="__scan__" ${extra === '__scan__' || _cuNoTarget ? 'selected' : ''}>🔍 Cast on THIS province — reveal the dead army units here</option>`;
      const targets = (report.visibleChars || []).filter((x) => x.player !== c.player && x.locationId === casterLoc);
      const enemyOpts = targets.map(
        (x) =>
          kcHtml`<option value="${x.id}"${realmOptStyleP(x.player, report)} ${extra == x.id ? 'selected' : ''}>${x.name}${x.player === null ? ' (wandering)' : ` ⚔ (${realmNameP(x.player, report)})`} — seize one undead unit from them</option>`,
      );
      charOpts = [scanOpt, ...enemyOpts];
    } else if (selSpell === 'Telekinetic Storm') {
      // Telekinetic Storm: a neutral or enemy hero LEADING ARMIES in the caster's province —
      // there is nothing to scatter around a hero marching alone.
      const targets = (report.visibleChars || []).filter(
        (x) => x.player !== c.player && x.locationId === casterLoc && leadsArmiesP(x),
      );
      charOpts = targets.map(
        (x) =>
          kcHtml`<option value="${x.id}"${realmOptStyleP(x.player, report)} ${extra == x.id ? 'selected' : ''}>${x.name}${x.player === null ? ' (wandering)' : ` ⚔ (${realmNameP(x.player, report)})`} — ${x.armyBand || x.armies + ' unit' + (x.armies !== 1 ? 's' : '')} — ${x.locationName || '?'}</option>`,
      );
      if (!charOpts.length)
        charOpts = kcHtml`<option value="" disabled>No enemy/neutral hero leading armies in this province</option>`;
    } else {
      // Other character-target spells (Psychic Blast, Curse, Control Undead fallthrough).
      // Target visible enemy/neutral characters in the same province.
      const targets = (report.visibleChars || []).filter((x) => x.player !== c.player && x.locationId === casterLoc);
      charOpts = targets.map(
        (x) =>
          kcHtml`<option value="${x.id}"${realmOptStyleP(x.player, report)} ${extra == x.id ? 'selected' : ''}>${x.name}${x.player === null ? ' (wandering)' : ` ⚔ (${realmNameP(x.player, report)})`} — ${x.locationName || '?'}</option>`,
      );
      if (!charOpts.length)
        charOpts = kcHtml`<option value="" disabled>No enemy/neutral heroes in this province</option>`;
    }
    // Control Undead is the one spell here whose default is a PROVINCE, not a character, so it
    // gets its own placeholder — "— Target character —" above a preselected province scan reads
    // as though nothing has been chosen.
    const _ph0 = selSpell === 'Control Undead' ? '— Choose what to cast it on —' : '— Target character —';
    secondaryHtml = kcHtml`<select id="po-extra-${c.id}-${ph}" style="margin-top:4px" onchange="syncResurrectCard(${kcArg(String(c.id))},${kcArg(ph)});syncCharmCard(${kcArg(String(c.id))},${kcArg(ph)})"><option value="">${_ph0}</option>${charOpts}</select>
          <div style="font-size:.72rem;color:var(--stone);margin-top:2px">${SPELL_HINTS[selSpell] || ''}</div>`;
  } else {
    secondaryHtml = kcHtml`<input id="po-extra-${c.id}-${ph}" type="hidden" value=""><div style="font-size:.72rem;color:var(--stone);margin-top:2px">${SPELL_HINTS[selSpell] || ''}</div>`;
  }
  return secondaryHtml;
}
